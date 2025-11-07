import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { getWebDAVConfig, getGlobalCacheDir, getGlobalCacheFilePath, ensureGlobalCacheDir, getReadingSettings } from '../utils/config';
import { WebDAVService } from '../services/webdav';
import { TextParserService } from '../services/textParser';

// 分页显示章节列表
function displayChaptersPaginated(chapters: any[], filename: string, page: number = 1, pageSize: number = 10) {
  const totalPages = Math.ceil(chapters.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, chapters.length);
  
  console.log(chalk.green(`\n文件 "${filename}" 的章节列表 (第 ${page}/${totalPages} 页):\n`));
  
  for (let i = startIndex; i < endIndex; i++) {
    const chapter = chapters[i];
    const chapterNum = (i + 1).toString().padStart(3, ' ');
    const title = chapter.title.length > 50 ? chapter.title.substring(0, 47) + '...' : chapter.title;
    console.log(`${chalk.cyan(chapterNum)}. ${title}`);
  }
  
  console.log(chalk.green(`\n共找到 ${chapters.length} 个章节`));
  
  // 显示分页导航
  if (totalPages > 1) {
    console.log(chalk.blue('\n分页导航:'));
    if (page > 1) {
      console.log(chalk.blue(`  上一页: txread review --page ${page - 1}`));
    }
    if (page < totalPages) {
      console.log(chalk.blue(`  下一页: txread review --page ${page + 1}`));
    }
    console.log(chalk.blue(`  跳转: txread review --page [页码]`));
  }
  
  console.log(chalk.blue('\n使用 "txread look [章节名称]" 或 "txread look [章节ID]" 开始阅读指定章节'));
  console.log(chalk.blue('使用 "txread look" 从当前页第一章节开始阅读'));
}

export const reviewCommand = new Command('review')
  .description('解析文件，展示章节目录')
  .argument('[filename_or_id]', '文件名或文件ID（可选，如果已使用use命令选择文件）')
  .option('-p, --page <number>', '指定要显示的页码', '1')
  .option('-s, --page-size <number>', '每页显示的章节数量')
  .action(async (filenameOrId?: string, options?: { page?: string, pageSize?: string }) => {
    try {
      // 获取阅读设置，包括默认的每页章节数
      const readingSettings = getReadingSettings();
      
      // 解析分页选项
      const page = options?.page ? parseInt(options.page) : 1;
      const pageSize = options?.pageSize ? parseInt(options.pageSize) : readingSettings.chaptersPerPage;
      
      if (isNaN(page) || page < 1) {
        console.log(chalk.red('页码必须是大于0的整数'));
        return;
      }
      
      if (isNaN(pageSize) || pageSize < 5 || pageSize > 100) {
        console.log(chalk.red('每页章节数量必须是5-100之间的整数'));
        return;
      }
      
      // 检查是否提供了文件名，或者是否已经使用了use命令
      let targetFilename = filenameOrId;
      let localFilePath: string | null = null;
      
      if (!targetFilename) {
        // 尝试从全局缓存中的当前使用文件信息中获取
        const useInfoPath = path.join(getGlobalCacheDir(), 'current.json');
        if (fs.existsSync(useInfoPath)) {
          const useInfo = fs.readJsonSync(useInfoPath);
          targetFilename = useInfo.filename;
          localFilePath = useInfo.localFilePath;
        } else {
          console.log(chalk.red('请提供文件名或文件ID，或先使用 "txread use" 命令选择文件'));
          return;
        }
      }
      
      // 如果没有本地文件路径，尝试从WebDAV下载
      if (!localFilePath) {
        const config = getWebDAVConfig();
        if (!config) {
          console.log(chalk.red('请先使用 "txread config" 配置WebDAV连接信息'));
          return;
        }
        
        const webdavService = new WebDAVService();
        const initialized = webdavService.initialize(config);
        if (!initialized) {
          console.log(chalk.red('WebDAV客户端初始化失败'));
          return;
        }
        
        console.log(chalk.blue(`正在查找文件: ${targetFilename}`));
        
        // 获取文件列表
        const fileList = await webdavService.getFileList('/');
        
        // 检查输入是ID还是文件名
        let targetFile;
        if (targetFilename && /^\d+$/.test(targetFilename)) {
          // 输入是ID，转换为索引
          const index = parseInt(targetFilename) - 1;
          if (index >= 0 && index < fileList.length) {
            targetFile = fileList[index];
          }
        } else {
          // 输入是文件名
          targetFile = fileList.find(file => file.name === targetFilename);
        }
        
        if (!targetFile) {
          console.log(chalk.red(`未找到文件: ${targetFilename}`));
          return;
        }
        
        // 确保全局缓存目录存在
        ensureGlobalCacheDir();
        
        localFilePath = getGlobalCacheFilePath(targetFile.name || '');
        
        // 检查本地文件是否存在
        if (fs.existsSync(localFilePath)) {
          console.log(chalk.green(`文件已存在于本地缓存: ${targetFile.name}`));
          console.log(chalk.blue('将直接使用本地缓存文件，无需重新下载'));
        } else {
          // 本地文件不存在，需要下载
          console.log(chalk.blue(`文件不存在于本地缓存，正在下载: ${targetFile.name}`));
          
          // 使用带进度条的下载方法
          const success = await webdavService.downloadFileWithProgress(targetFile.path, localFilePath);
          if (!success) {
            console.log(chalk.red('文件下载失败'));
            return;
          }
        }
        
        // 更新目标文件名为实际文件名
        targetFilename = targetFile.name;
      }
      
      // 读取文件内容
      const content = fs.readFileSync(localFilePath, 'utf8');
      
      // 解析章节
      const textParser = new TextParserService();
      const chapters = textParser.parseChapters(content);
      
      if (chapters.length === 0) {
        console.log(chalk.yellow('未找到章节信息'));
        return;
      }
      
      // 保存当前页码信息到全局缓存
      ensureGlobalCacheDir();
      const reviewInfoPath = path.join(getGlobalCacheDir(), 'review.json');
      fs.writeJsonSync(reviewInfoPath, {
        filename: targetFilename,
        page: page,
        pageSize: pageSize,
        timestamp: new Date().toISOString()
      });
      
      // 使用分页显示章节列表
      displayChaptersPaginated(chapters, targetFilename || '未知文件', page, pageSize);
    } catch (error) {
      console.error(chalk.red('获取章节列表失败:'), error);
    }
  });