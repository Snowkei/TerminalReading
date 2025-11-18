import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { getWebDAVConfig, updateReadingProgress, getFileReadingProgress, getReadingProgress, getGlobalCacheDir } from '../utils/config';
import { WebDAVService } from '../services/webdav';
import { ReadingInterface } from '../services/readingInterface';
import { TextParserService } from '../services/textParser';
import { ReadingProgress } from '../types';

export const lookCommand = new Command('look')
  .description('开始阅读文件')
  .argument('[chapter_or_id]', '章节名称或章节ID（可选）')
  .action(async (chapterOrId: string) => {
    try {
      // 检查是否已经使用了use命令，从全局缓存目录读取
      const useInfoPath = path.join(getGlobalCacheDir(), 'current.json');
      if (!fs.existsSync(useInfoPath)) {
        console.log(chalk.red('请先使用 "txread use" 命令选择要阅读的文件'));
        return;
      }
      
      const useInfo = fs.readJsonSync(useInfoPath);
      const { filename, localFilePath } = useInfo;
      
      // 检查本地文件是否存在
      if (!fs.existsSync(localFilePath)) {
        console.log(chalk.red('本地缓存文件不存在，请重新使用 "txread use" 命令选择文件'));
        return;
      }
      
      // 读取文件内容
      const content = fs.readFileSync(localFilePath, 'utf8');
      
      // 解析章节
      const textParser = new TextParserService();
      const chapters = textParser.parseChapters(content);
      
      // 确定起始章节
      let startChapterIndex = 0;
      
      // 如果没有指定章节，优先从上次阅读位置开始
      if (!chapterOrId) {
        // 首先尝试从上次阅读位置开始
        const progress = getFileReadingProgress(filename);
        if (progress) {
          if (typeof progress.chapterIndex === 'number' && progress.chapterIndex >= 0 && progress.chapterIndex < chapters.length) {
            startChapterIndex = progress.chapterIndex;
            const chapterTitle = chapters[startChapterIndex]?.title ?? progress.chapter;
            console.log(chalk.blue(`从上次阅读位置开始: 第${startChapterIndex + 1}章 ${chapterTitle}`));
          } else {
            const chapterIndex = chapters.findIndex(chapter => chapter.title === progress.chapter);
            if (chapterIndex >= 0) {
              startChapterIndex = chapterIndex;
              console.log(chalk.blue(`从上次阅读位置开始: ${progress.chapter}`));
            }
          }
        } else {
          // 如果没有进度记录，尝试从review命令保存的页码信息中获取起始章节
          const reviewInfoPath = path.join(getGlobalCacheDir(), 'review.json');
          if (fs.existsSync(reviewInfoPath)) {
            const reviewInfo = fs.readJsonSync(reviewInfoPath);
            
            // 检查review信息是否与当前文件匹配
            if (reviewInfo.filename === filename) {
              // 计算当前页的第一章索引
              const page = reviewInfo.page || 1;
              const pageSize = reviewInfo.pageSize || 10;
              const startIndex = (page - 1) * pageSize;
              
              // 如果索引有效，从当前页的第一章开始阅读
              if (startIndex >= 0 && startIndex < chapters.length) {
                startChapterIndex = startIndex;
                console.log(chalk.blue(`从当前页第一章节开始阅读: ${chapters[startIndex].title} (第${page}页)`));
              } else {
                console.log(chalk.yellow('页码信息无效，从文件开头开始阅读'));
              }
            }
          }
          
          // 如果仍然没有找到有效的起始章节，从文件开头开始
          if (startChapterIndex === 0) {
            console.log(chalk.blue('从文件开头开始阅读'));
          }
        }
      } else {
        // 检查输入是ID还是章节名称
        if (chapterOrId && /^\d+$/.test(chapterOrId)) {
          // 输入是ID，转换为章节索引
          const index = parseInt(chapterOrId) - 1;
          if (index >= 0 && index < chapters.length) {
            startChapterIndex = index;
            console.log(chalk.blue(`从指定章节开始阅读: ${chapters[index].title}`));
          } else {
            console.log(chalk.red(`无效的章节ID: ${chapterOrId}`));
            return;
          }
        } else {
          // 输入是章节名称，查找对应索引
          const chapterIndex = chapters.findIndex(chapter => chapter.title === chapterOrId);
          if (chapterIndex >= 0) {
            startChapterIndex = chapterIndex;
            console.log(chalk.blue(`从指定章节开始阅读: ${chapterOrId}`));
          } else {
            console.log(chalk.red(`未找到章节: ${chapterOrId}`));
            return;
          }
        }
      }
      
      // 创建WebDAV服务
      const config = getWebDAVConfig();
      let webdavService: WebDAVService | null = null;
      if (config) {
        webdavService = new WebDAVService();
        webdavService.initialize(config);
      }
      
      // 创建阅读界面
      const readingInterface = new ReadingInterface(
        filename,
        localFilePath,
        content,
        webdavService || new WebDAVService(),
        startChapterIndex,
        chapters
      );
      
      // 设置退出回调 - 简化流程，因为readingInterface已经处理了保存
      readingInterface.onExit = async (progress) => {
        try {
          // 阅读进度已在readingInterface.exit()中保存到本地和WebDAV
          // 这里只需要确认保存成功并显示消息
          console.log(chalk.green('阅读进度已保存'));
          
          // 检查是否需要额外的WebDAV同步（确保所有进度都同步）
          const config = getWebDAVConfig();
          if (config) {
            // 异步执行完整的WebDAV同步，但不阻塞退出
            (async () => {
              try {
                const webdavServiceSync = new WebDAVService();
                if (webdavServiceSync.initialize(config)) {
                  const allProgress = getReadingProgress();
                  await webdavServiceSync.syncProgress(allProgress);
                }
              } catch (error) {
                // 静默失败，不影响用户体验
              }
            })();
          }
        } catch (error) {
          // 即使发生错误，也应该继续退出流程
          console.error(chalk.red('处理退出回调时出错:'), error);
        }
      };
      
      // 启动阅读界面
      // 创建一个Promise来等待阅读界面退出
      await new Promise<void>((resolve) => {
        // 修改ReadingInterface的退出回调，使其在保存进度后resolve Promise
        const originalOnExit = readingInterface.onExit;
        readingInterface.onExit = async (progress) => {
          await originalOnExit(progress);
          resolve();
        };
        
        readingInterface.start();
      });
    } catch (error) {
      console.error(chalk.red('启动阅读界面失败:'), error);
    }
});