import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { getWebDAVConfig, getFileReadingProgress, saveReadingProgress, getReadingProgress, getGlobalCacheDir, getGlobalCacheFilePath, ensureGlobalCacheDir } from '../utils/config';
import { WebDAVService } from '../services/webdav';

export const useCommand = new Command('use')
  .description('选择要阅读的文件')
  .argument('<filename_or_id>', '文件名或文件ID')
  .action(async (filenameOrId: string) => {
    try {
      const config = getWebDAVConfig();
      if (!config) {
        console.log(chalk.red('请先使用 "txread config" 配置WebDAV连接信息'));
        return;
      }
      
      const webdavService = new WebDAVService();
      
      // 初始化WebDAV客户端
      const initialized = webdavService.initialize(config);
      if (!initialized) {
        console.log(chalk.red('WebDAV客户端初始化失败'));
        return;
      }
      
      // 从WebDAV同步阅读进度
      console.log(chalk.blue('正在同步阅读进度...'));
      try {
        const remoteProgress = await webdavService.fetchProgress();
        if (remoteProgress.length > 0) {
          // 获取本地进度
          const localProgress = getReadingProgress();
          
          // 合并进度，以远程进度为主
          const mergedProgress = [...localProgress];
          
          for (const remote of remoteProgress) {
            const localIndex = mergedProgress.findIndex(p => p.fileName === remote.fileName);
            if (localIndex >= 0) {
              // 如果远程进度更新，则替换本地进度
              const localTime = new Date(mergedProgress[localIndex].lastReadTime).getTime();
              const remoteTime = new Date(remote.lastReadTime).getTime();
              if (remoteTime > localTime) {
                mergedProgress[localIndex] = remote;
              }
            } else {
              // 如果本地没有该文件进度，添加远程进度
              mergedProgress.push(remote);
            }
          }
          
          // 保存合并后的进度
          saveReadingProgress(mergedProgress);
          console.log(chalk.green('阅读进度同步完成'));
        }
      } catch (error) {
        console.log(chalk.yellow('阅读进度同步失败，将使用本地进度'));
      }
      
      console.log(chalk.blue(`正在查找文件: ${filenameOrId}`));
      
      // 获取文件列表
      const fileList = await webdavService.getFileList('/');
      
      // 检查输入是ID还是文件名
      let targetFile;
      if (/^\d+$/.test(filenameOrId)) {
        // 输入是ID，转换为索引
        const index = parseInt(filenameOrId) - 1;
        if (index >= 0 && index < fileList.length) {
          targetFile = fileList[index];
        }
      } else {
        // 输入是文件名
        targetFile = fileList.find(file => file.name === filenameOrId);
      }
      
      if (!targetFile) {
        console.log(chalk.red(`未找到文件: ${filenameOrId}`));
        return;
      }
      
      // 确保全局缓存目录存在
      ensureGlobalCacheDir();
      
      const localFilePath = getGlobalCacheFilePath(targetFile.name);
      
      // 检查本地文件是否存在
      if (fs.existsSync(localFilePath)) {
        console.log(chalk.green(`文件已存在于本地缓存: ${targetFile.name}`));
        console.log(chalk.blue('将直接使用本地缓存文件，无需重新下载'));
        
        // 保存当前使用的文件信息到全局缓存目录
        const useInfo = {
          filename: targetFile.name,
          filePath: targetFile.path,
          localFilePath,
          lastUsed: new Date().toISOString()
        };
        
        const useInfoPath = path.join(getGlobalCacheDir(), 'current.json');
        fs.writeJsonSync(useInfoPath, useInfo, { spaces: 2 });
        
        console.log(chalk.green(`已选择文件: ${targetFile.name}`));
        
        // 显示阅读进度
        const progress = getFileReadingProgress(targetFile.name);
        if (progress) {
          console.log(chalk.blue(`上次阅读位置: ${progress.chapter}`));
          console.log(chalk.blue(`上次阅读时间: ${progress.lastReadTime.toLocaleString()}`));
        } else {
          console.log(chalk.yellow('尚未开始阅读此文件'));
        }
        
        console.log(chalk.green('现在可以使用 "txread look" 开始阅读'));
        return;
      }
      
      // 本地文件不存在，需要下载
      console.log(chalk.blue(`文件不存在于本地缓存，正在下载: ${targetFile.name}`));
      
      // 使用带进度条的下载方法
      const success = await webdavService.downloadFileWithProgress(targetFile.path, localFilePath);
      if (!success) {
        console.log(chalk.red('文件下载失败'));
        return;
      }
      
      // 保存当前使用的文件信息到全局缓存目录
      const useInfo = {
        filename: targetFile.name,
        filePath: targetFile.path,
        localFilePath,
        lastUsed: new Date().toISOString()
      };
      
      const useInfoPath = path.join(getGlobalCacheDir(), 'current.json');
      fs.writeJsonSync(useInfoPath, useInfo, { spaces: 2 });
      
      console.log(chalk.green(`已选择文件: ${targetFile.name}`));
      
      // 显示阅读进度
      const progress = getFileReadingProgress(targetFile.name);
      if (progress) {
        console.log(chalk.blue(`上次阅读位置: ${progress.chapter}`));
        console.log(chalk.blue(`上次阅读时间: ${progress.lastReadTime.toLocaleString()}`));
      } else {
        console.log(chalk.yellow('尚未开始阅读此文件'));
      }
      
      console.log(chalk.green('现在可以使用 "txread look" 开始阅读'));
    } catch (error) {
      console.error(chalk.red('选择文件失败:'), error);
    }
  });