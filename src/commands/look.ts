import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { getWebDAVConfig, updateReadingProgress, getFileReadingProgress, getReadingProgress } from '../utils/config';
import { WebDAVService } from '../services/webdav';
import { ReadingInterface } from '../services/readingInterface';
import { TextParserService } from '../services/textParser';
import { ReadingProgress } from '../types';

export const lookCommand = new Command('look')
  .description('开始阅读文件')
  .argument('[chapter_or_id]', '章节名称或章节ID（可选）')
  .action(async (chapterOrId: string) => {
    try {
      // 检查是否已经使用了use命令
      const useInfoPath = path.join(process.cwd(), '.txread_cache', 'current.json');
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
      let startChapter = chapterOrId;
      if (!startChapter) {
        // 如果没有指定章节，尝试从上次阅读位置开始
        const progress = getFileReadingProgress(filename);
        if (progress) {
          startChapter = progress.chapter;
          console.log(chalk.blue(`从上次阅读位置开始: ${progress.chapter}`));
        } else {
          console.log(chalk.blue('从文件开头开始阅读'));
        }
      } else {
        // 检查输入是ID还是章节名称
        if (startChapter && /^\d+$/.test(startChapter)) {
          // 输入是ID，转换为章节名称
          const index = parseInt(startChapter) - 1;
          if (index >= 0 && index < chapters.length) {
            startChapter = chapters[index].title;
            console.log(chalk.blue(`从指定章节开始阅读: ${startChapter}`));
          } else {
            console.log(chalk.red(`无效的章节ID: ${chapterOrId}`));
            return;
          }
        } else {
          console.log(chalk.blue(`从指定章节开始阅读: ${startChapter}`));
        }
      }
      
      // 创建阅读界面
      const readingInterface = new ReadingInterface(
        content,
        filename,
        startChapter,
        async (progress) => {
          // 保存阅读进度
          updateReadingProgress(filename, progress.chapter, progress.position);
          
          // 同步到WebDAV
          const config = getWebDAVConfig();
          if (config) {
            const webdavService = new WebDAVService();
            const initialized = webdavService.initialize(config);
            if (initialized) {
              // 获取所有进度并同步到WebDAV
              const allProgress = getReadingProgress();
              await webdavService.syncProgress(allProgress);
              console.log(chalk.green('阅读进度已同步到WebDAV'));
            }
          }
          
          console.log(chalk.green('阅读进度已保存'));
        }
      );
      
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