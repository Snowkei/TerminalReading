import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import path from 'path';
import fs from 'fs-extra';
import { getWebDAVConfig, getGlobalCacheDir } from '../utils/config';
import { WebDAVService } from '../services/webdav';

export const listCommand = new Command('list')
  .description('列出WebDAV服务器上的文件')
  .option('-p, --path <path>', '远程路径', '/')
  .option('--page <page>', '页码', '1')
  .option('--page-size <size>', '每页显示数量', '10')
  .option('--no-upload', '不上传本地缺失的文件')
  .action(async (options: any) => {
    try {
      const config = getWebDAVConfig();
      if (!config) {
        console.log(chalk.red('请先使用 "txread config" 配置WebDAV连接信息'));
        return;
      }
      
      const { path: remotePath, page, pageSize, upload } = options;
      const webdavService = new WebDAVService();
      
      // 初始化WebDAV客户端
      const initialized = webdavService.initialize(config);
      if (!initialized) {
        console.log(chalk.red('WebDAV客户端初始化失败'));
        return;
      }
      
      console.log(chalk.blue(`正在获取 ${remotePath} 的文件列表...`));
      
      // 获取远程文件列表
      const remoteFileList = await webdavService.getFileList(remotePath);
      
      // 获取本地文件列表
      const localCacheDir = getGlobalCacheDir();
      let localFileList: string[] = [];
      
      if (fs.existsSync(localCacheDir)) {
        localFileList = fs.readdirSync(localCacheDir)
          .filter(file => {
            const filePath = path.join(localCacheDir, file);
            // 过滤掉.DS_Store文件
            if (file === '.DS_Store') {
              return false;
            }
            return fs.statSync(filePath).isFile();
          });
      }
      
      // 找出本地有但远程没有的文件
       const remoteFileNames = new Set(remoteFileList.map(file => file.name));
       const filesToUpload = localFileList.filter(fileName => !remoteFileNames.has(fileName));
       
       // 找出本地和远程都有的文件
       const commonFiles = localFileList.filter(fileName => remoteFileNames.has(fileName));
       
       // 显示文件统计信息
       console.log(chalk.blue(`本地文件: ${localFileList.length} 个`));
       console.log(chalk.blue(`远程文件: ${remoteFileList.length} 个`));
       if (commonFiles.length > 0) {
         console.log(chalk.green(`本地和远程共有的文件: ${commonFiles.length} 个`));
       }
       if (filesToUpload.length > 0) {
         console.log(chalk.yellow(`仅在本地存在的文件: ${filesToUpload.length} 个`));
       }
       
       // 上传本地缺失的文件
       if (upload && filesToUpload.length > 0) {
         console.log(chalk.yellow(`\n正在上传本地缺失的文件...`));
         
         for (const fileName of filesToUpload) {
           const localFilePath = path.join(localCacheDir, fileName);
           const remoteFilePath = path.posix.join(remotePath, fileName);
           
           try {
             const success = await webdavService.uploadFile(localFilePath, remoteFilePath);
             if (success) {
               console.log(chalk.green(`✓ ${fileName} 上传成功`));
             } else {
               console.log(chalk.red(`✗ ${fileName} 上传失败`));
             }
           } catch (error) {
             console.log(chalk.red(`✗ ${fileName} 上传失败:`, error));
           }
         }
         
         // 重新获取远程文件列表
         console.log(chalk.blue('\n重新获取远程文件列表...'));
         const updatedRemoteFileList = await webdavService.getFileList(remotePath);
         
         // 合并文件列表，避免重复
         const allFiles = [...updatedRemoteFileList];
         
         // 添加仅存在于本地的文件
         for (const fileName of localFileList) {
           if (!remoteFileNames.has(fileName)) {
             const localFilePath = path.join(localCacheDir, fileName);
             const stats = fs.statSync(localFilePath);
             
             allFiles.push({
               name: fileName,
               path: localFilePath,
               size: stats.size,
               lastModified: stats.mtime,
               hasProgress: false,
               progress: undefined,
               isLocalOnly: true
             });
           }
         }
         
         // 按最后修改时间排序
         allFiles.sort((a, b) => {
           const timeA = a.lastModified instanceof Date ? a.lastModified.getTime() : new Date(a.lastModified).getTime();
           const timeB = b.lastModified instanceof Date ? b.lastModified.getTime() : new Date(b.lastModified).getTime();
           return timeB - timeA;
         });
         
         // 分页显示
         console.log(chalk.blue(`\n文件列表 (共 ${allFiles.length} 个文件):`));
         displayFileList(allFiles, page, pageSize);
       } else {
         // 合并文件列表，避免重复
         const allFiles = [...remoteFileList];
         
         // 添加仅存在于本地的文件
         for (const fileName of localFileList) {
           if (!remoteFileNames.has(fileName)) {
             const localFilePath = path.join(localCacheDir, fileName);
             const stats = fs.statSync(localFilePath);
             
             allFiles.push({
               name: fileName,
               path: localFilePath,
               size: stats.size,
               lastModified: stats.mtime,
               hasProgress: false,
               progress: undefined,
               isLocalOnly: true
             });
           }
         }
         
         // 按最后修改时间排序
         allFiles.sort((a, b) => {
           const timeA = a.lastModified instanceof Date ? a.lastModified.getTime() : new Date(a.lastModified).getTime();
           const timeB = b.lastModified instanceof Date ? b.lastModified.getTime() : new Date(b.lastModified).getTime();
           return timeB - timeA;
         });
         
         // 分页显示
         console.log(chalk.blue(`\n文件列表 (共 ${allFiles.length} 个文件):`));
         displayFileList(allFiles, page, pageSize);
       }
    } catch (error) {
      console.error(chalk.red('获取文件列表失败:'), error);
    }
  });

// 分页显示文件列表
 function displayFileList(allFiles: any[], page: string, pageSize: string) {
   const totalPages = Math.ceil(allFiles.length / parseInt(pageSize));
   const currentPage = Math.min(Math.max(1, parseInt(page)), totalPages);
   const startIndex = (currentPage - 1) * parseInt(pageSize);
   const endIndex = Math.min(startIndex + parseInt(pageSize), allFiles.length);
   const filesToShow = allFiles.slice(startIndex, endIndex);
  
  if (allFiles.length === 0) {
    console.log(chalk.yellow('没有找到文件'));
    return;
  }
  
  // 创建表格显示文件列表
  const table = new Table({
    head: ['ID', '文件名', '大小', '最后修改时间', '位置', '阅读进度'],
    colWidths: [5, 25, 15, 20, 10, 25]
  });
  
  for (let i = 0; i < filesToShow.length; i++) {
    const file = filesToShow[i];
    const id = (startIndex + i + 1).toString();
    const size = formatFileSize(file.size);
    let lastModified = '';
    if (file.lastModified instanceof Date) {
      lastModified = file.lastModified.toLocaleDateString();
    } else if (typeof file.lastModified === 'string') {
      lastModified = new Date(file.lastModified).toLocaleDateString();
    }
    
    const location = file.isLocalOnly ? chalk.yellow('本地') : chalk.green('远程');
    
    let progressInfo = '未开始';
    
    if (file.hasProgress && file.progress) {
      const { chapter, lastReadTime, chapterIndex } = file.progress;
      let lastRead = '';
      if (lastReadTime instanceof Date) {
        lastRead = lastReadTime.toLocaleDateString();
      } else if (typeof lastReadTime === 'string') {
        lastRead = new Date(lastReadTime).toLocaleDateString();
      }
      const chapterLabel = typeof chapterIndex === 'number' && chapterIndex >= 0
        ? `第${chapterIndex + 1}章 ${chapter}`
        : chapter;
      progressInfo = `${chapterLabel} (${lastRead})`;
    }
    
    table.push([
      chalk.cyan(id),
      file.name,
      size,
      lastModified,
      location,
      progressInfo
    ]);
  }
  
  console.log(table.toString());
  
  // 显示分页信息
  console.log(chalk.blue(`\n第 ${currentPage}/${totalPages} 页，共 ${allFiles.length} 个文件`));
  
  if (currentPage < totalPages) {
    console.log(chalk.blue(`查看下一页: txread list --page ${currentPage + 1}`));
  }
  if (currentPage > 1) {
    console.log(chalk.blue(`查看上一页: txread list --page ${currentPage - 1}`));
  }
  
  console.log(chalk.blue('\n提示:'));
  console.log(chalk.blue('- 使用 "txread use <文件名>" 或 "txread use <ID>" 选择文件'));
  console.log(chalk.blue('- 使用 "txread review <文件名>" 或 "txread review <ID>" 查看章节列表'));
  console.log(chalk.blue('- 使用 "--no-upload" 选项可以禁止自动上传本地文件'));
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}