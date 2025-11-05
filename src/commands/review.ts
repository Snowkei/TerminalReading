import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { getWebDAVConfig } from '../utils/config';
import { WebDAVService } from '../services/webdav';
import { TextParserService } from '../services/textParser';

export const reviewCommand = new Command('review')
  .description('解析文件，展示章节目录')
  .argument('[filename_or_id]', '文件名或文件ID（可选，如果已使用use命令选择文件）')
  .action(async (filenameOrId?: string) => {
    try {
      // 检查是否提供了文件名，或者是否已经使用了use命令
      let targetFilename = filenameOrId;
      let localFilePath: string | null = null;
      
      if (!targetFilename) {
        // 尝试从当前使用文件信息中获取
        const useInfoPath = path.join(process.cwd(), '.txread_cache', 'current.json');
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
        
        // 确保本地缓存目录存在
        const cacheDir = path.join(process.cwd(), '.txread_cache');
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        
        localFilePath = path.join(cacheDir, targetFile.name || '');
        
        // 检查本地文件是否存在且未修改
        let needDownload = true;
        if (fs.existsSync(localFilePath)) {
          const localStats = fs.statSync(localFilePath);
          const localModifiedTime = localStats.mtime;
          
          // 检查远程文件的修改时间
          let remoteModifiedTime;
          if (targetFile.lastModified instanceof Date) {
            remoteModifiedTime = targetFile.lastModified;
          } else if (typeof targetFile.lastModified === 'string') {
            remoteModifiedTime = new Date(targetFile.lastModified);
          }
          
          if (remoteModifiedTime && localModifiedTime >= remoteModifiedTime) {
            console.log(chalk.green(`本地文件已是最新版本: ${targetFile.name}`));
            needDownload = false;
          }
        }
        
        if (needDownload) {
          console.log(chalk.blue(`正在下载文件: ${targetFile.name}`));
          
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
      
      // 显示章节列表
      console.log(chalk.green(`\n文件 "${targetFilename}" 的章节列表:\n`));
      
      chapters.forEach((chapter, index) => {
        const chapterNum = (index + 1).toString().padStart(3, ' ');
        const title = chapter.title.length > 50 ? chapter.title.substring(0, 47) + '...' : chapter.title;
        console.log(`${chalk.cyan(chapterNum)}. ${title}`);
      });
      
      console.log(chalk.green(`\n共找到 ${chapters.length} 个章节`));
      console.log(chalk.blue('使用 "txread look [章节名称]" 或 "txread look [章节ID]" 开始阅读指定章节'));
      console.log(chalk.blue('使用 "txread look" 从上次阅读位置或开头开始阅读'));
    } catch (error) {
      console.error(chalk.red('获取章节列表失败:'), error);
    }
  });