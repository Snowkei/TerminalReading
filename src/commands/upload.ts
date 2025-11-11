import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { getWebDAVConfig } from '../utils/config';
import { WebDAVService } from '../services/webdav';

export const uploadCommand = new Command('upload')
  .description('上传本地文件到WebDAV服务器')
  .requiredOption('-p, --path <path>', '远程路径')
  .requiredOption('-t, --target <target>', '本地文件或目录路径')
  .action(async (options: any) => {
    try {
      const config = getWebDAVConfig();
      if (!config) {
        console.log(chalk.red('请先使用 "txread config" 配置WebDAV连接信息'));
        return;
      }
      
      const { path: remotePath, target } = options;
      const webdavService = new WebDAVService();
      
      // 初始化WebDAV客户端
      const initialized = webdavService.initialize(config);
      if (!initialized) {
        console.log(chalk.red('WebDAV客户端初始化失败'));
        return;
      }
      
      // 检查本地路径是否存在
      const localPath = path.resolve(target);
      if (!fs.existsSync(localPath)) {
        console.log(chalk.red(`本地路径不存在: ${localPath}`));
        return;
      }
      
      // 如果是目录，递归上传所有文件
      if (fs.statSync(localPath).isDirectory()) {
        console.log(chalk.blue('正在上传目录中的文件...'));
        const files = fs.readdirSync(localPath);
        let successCount = 0;
        let failCount = 0;
        let totalSize = 0;
        
        // 计算总大小
        for (const file of files) {
          const filePath = path.join(localPath, file);
          if (fs.statSync(filePath).isFile()) {
            totalSize += fs.statSync(filePath).size;
          }
        }
        
        console.log(chalk.blue(`总共需要上传 ${files.length} 个文件，总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`));
        
        for (const file of files) {
          const filePath = path.join(localPath, file);
          const remoteFilePath = path.posix.join(remotePath, file);
          
          // 过滤掉.DS_Store文件
          if (file === '.DS_Store') {
            console.log(chalk.yellow(`跳过系统文件: ${file}`));
            continue;
          }
          
          if (fs.statSync(filePath).isFile()) {
            const success = await webdavService.uploadFileWithProgress(filePath, remoteFilePath, file);
            if (success) {
              console.log(chalk.green(`\n✓ ${file} 上传成功`));
              successCount++;
            } else {
              console.log(chalk.red(`\n✗ ${file} 上传失败`));
              failCount++;
            }
          }
        }
        
        console.log(chalk.blue(`\n上传完成: 成功 ${successCount} 个文件，失败 ${failCount} 个文件`));
      } else {
        // 单个文件上传
        const fileName = path.basename(localPath);
        const remoteFilePath = path.posix.join(remotePath, fileName);
        const fileSize = fs.statSync(localPath).size;
        
        console.log(chalk.blue(`正在上传文件 ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`));
        
        const success = await webdavService.uploadFileWithProgress(localPath, remoteFilePath, fileName);
        if (success) {
          console.log(chalk.green(`\n文件 ${fileName} 上传成功`));
        } else {
          console.log(chalk.red(`\n文件 ${fileName} 上传失败`));
        }
      }
    } catch (error) {
      console.error(chalk.red('上传失败:'), error);
    }
  });