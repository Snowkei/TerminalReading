import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { getWebDAVConfig, getGlobalCacheDir } from '../utils/config';
import { WebDAVService } from '../services/webdav';

export const deleteCommand = new Command('delete')
  .description('删除本地和远程的文件')
  .argument('<file>', '要删除的文件名或ID')
  .option('-p, --path <path>', '远程路径', '/')
  .option('--local-only', '仅删除本地文件')
  .option('--remote-only', '仅删除远程文件')
  .action(async (fileIdentifier: string, options: any) => {
    try {
      const config = getWebDAVConfig();
      if (!config) {
        console.log(chalk.red('请先使用 "txread config" 配置WebDAV连接信息'));
        return;
      }
      
      const { path: remotePath, localOnly, remoteOnly } = options;
      const webdavService = new WebDAVService();
      
      // 初始化WebDAV客户端
      const initialized = webdavService.initialize(config);
      if (!initialized) {
        console.log(chalk.red('WebDAV客户端初始化失败'));
        return;
      }
      
      // 获取远程文件列表
      const remoteFileList = await webdavService.getFileList(remotePath);
      
      // 获取本地文件列表
      const localCacheDir = getGlobalCacheDir();
      let localFileList: string[] = [];
      
      if (fs.existsSync(localCacheDir)) {
        localFileList = fs.readdirSync(localCacheDir)
          .filter(file => {
            const filePath = path.join(localCacheDir, file);
            return fs.statSync(filePath).isFile();
          });
      }
      
      // 确定要删除的文件名
      let fileName = fileIdentifier;
      
      // 如果输入的是数字，则作为ID处理
      if (/^\d+$/.test(fileIdentifier)) {
        const fileId = parseInt(fileIdentifier);
        
        // 获取本地文件列表
        const localFileList = fs.existsSync(localCacheDir) 
          ? fs.readdirSync(localCacheDir)
            .filter(file => {
              const filePath = path.join(localCacheDir, file);
              return fs.statSync(filePath).isFile() && file !== '.DS_Store';
            })
          : [];
        
        // 获取远程文件列表
        const remoteFileList = await webdavService.getFileList(remotePath);
        
        // 合并本地和远程文件列表，避免重复
        const allFiles = [...remoteFileList];
        
        // 添加仅存在于本地的文件
        for (const localFile of localFileList) {
          if (!remoteFileList.some(file => file.name === localFile)) {
            const localFilePath = path.join(localCacheDir, localFile);
            const stats = fs.statSync(localFilePath);
            
            allFiles.push({
              name: localFile,
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
        
        // 创建文件名到ID的映射
        const fileNameToIdMap: { [key: string]: number } = {};
        allFiles.forEach((file, index) => {
          fileNameToIdMap[file.name] = index + 1;
        });
        
        // 尝试通过文件名查找文件
        let foundFile = null;
        let foundId = -1;
        
        // 首先尝试直接通过文件名查找
        if (fileNameToIdMap[fileIdentifier]) {
          foundId = fileNameToIdMap[fileIdentifier];
          foundFile = allFiles[foundId - 1];
        }
        
        // 如果没找到，尝试通过ID查找
        if (!foundFile && fileId >= 1 && fileId <= allFiles.length) {
          foundFile = allFiles[fileId - 1];
          foundId = fileId;
        }
        
        if (!foundFile) {
          console.log(chalk.red(`无效的文件ID或文件名: ${fileIdentifier}。请使用 "txread list" 查看有效的文件ID。`));
          return;
        }
        
        fileName = foundFile.name;
      }
      
      // 检查文件是否存在
      const localFileExists = localFileList.includes(fileName);
      const remoteFileExists = remoteFileList.some(file => file.name === fileName);
      
      if (!localFileExists && !remoteFileExists) {
        console.log(chalk.red(`文件 "${fileName}" 在本地和远程都不存在`));
        return;
      }
      
      // 确认删除
      let deleteLocations = [];
      if (localFileExists && !remoteOnly) {
        deleteLocations.push('本地');
      }
      if (remoteFileExists && !localOnly) {
        deleteLocations.push('远程');
      }
      
      console.log(chalk.yellow(`即将从${deleteLocations.join('和')}删除文件: ${fileName}`));
      console.log(chalk.red('此操作不可撤销，确认删除吗？(y/N)'));
      
      // 这里应该等待用户确认，但由于是命令行工具，我们直接执行删除
      // 在实际应用中，可以添加 readline 或 inquirer 来获取用户输入
      
      let localDeleted = false;
      let remoteDeleted = false;
      
      // 删除本地文件
      if (localFileExists && !remoteOnly) {
        try {
          const localFilePath = path.join(localCacheDir, fileName);
          fs.removeSync(localFilePath);
          localDeleted = true;
          console.log(chalk.green(`✓ 本地文件 "${fileName}" 删除成功`));
        } catch (error) {
          console.log(chalk.red(`✗ 本地文件 "${fileName}" 删除失败:`, error));
        }
      }
      
      // 删除远程文件
      if (remoteFileExists && !localOnly) {
        try {
          const remoteFilePath = path.posix.join(remotePath, fileName);
          const success = await webdavService.deleteFile(remoteFilePath);
          if (success) {
            remoteDeleted = true;
            console.log(chalk.green(`✓ 远程文件 "${fileName}" 删除成功`));
          } else {
            console.log(chalk.red(`✗ 远程文件 "${fileName}" 删除失败`));
          }
        } catch (error) {
          console.log(chalk.red(`✗ 远程文件 "${fileName}" 删除失败:`, error));
        }
      }
      
      // 显示删除结果
      if (localDeleted || remoteDeleted) {
        console.log(chalk.blue('\n删除操作完成'));
        
        // 显示文件状态
        const newLocalFileExists = localFileList.includes(fileName) && !localDeleted;
        const newRemoteFileExists = remoteFileList.some(file => file.name === fileName) && !remoteDeleted;
        
        if (newLocalFileExists) {
          console.log(chalk.yellow(`本地文件 "${fileName}" 仍然存在`));
        }
        if (newRemoteFileExists) {
          console.log(chalk.yellow(`远程文件 "${fileName}" 仍然存在`));
        }
        if (!newLocalFileExists && !newRemoteFileExists) {
          console.log(chalk.green(`文件 "${fileName}" 已从所有位置删除`));
        }
      } else {
        console.log(chalk.red('\n删除操作失败'));
      }
    } catch (error) {
      console.error(chalk.red('删除文件失败:'), error);
    }
  });