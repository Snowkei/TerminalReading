import { createClient } from 'webdav';
import { WebDAVConfig, FileInfo, ReadingProgress, AppConfig } from '../types';
import * as path from 'path';
import * as fs from 'fs-extra';
import ProgressBar from 'progress';
import { getWebDAVConfigFileName } from '../utils/config';

export class WebDAVService {
  private client: any;
  private config: WebDAVConfig | null = null;
  private readonly PROGRESS_FILE_NAME = '.txread_progress.json';

  // 初始化WebDAV客户端
  initialize(config: WebDAVConfig): boolean {
    try {
      this.client = createClient(config.url, {
        username: config.username,
        password: config.password
      });
      this.config = config;
      return true;
    } catch (error) {
      console.error('初始化WebDAV客户端失败:', error);
      return false;
    }
  }

  // 检查连接是否正常
  async checkConnection(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      await this.client.getDirectoryContents('/');
      return true;
    } catch (error) {
      console.error('WebDAV连接检查失败:', error);
      return false;
    }
  }

  // 上传文件
  async uploadFile(localPath: string, remotePath: string): Promise<boolean> {
    if (!this.client) {
      console.error('WebDAV客户端未初始化');
      return false;
    }

    try {
      // 确保远程目录存在
      const remoteDir = path.dirname(remotePath);
      await this.ensureRemoteDirectory(remoteDir);
      
      // 上传文件
      const fileContent = await fs.readFile(localPath);
      await this.client.putFileContents(remotePath, fileContent);
      return true;
    } catch (error) {
      console.error('上传文件失败:', error);
      return false;
    }
  }

  // 上传文件（带进度条）
  async uploadFileWithProgress(localPath: string, remotePath: string, fileName?: string): Promise<boolean> {
    if (!this.client) {
      console.error('WebDAV客户端未初始化');
      return false;
    }

    try {
      // 确保远程目录存在
      const remoteDir = path.dirname(remotePath);
      await this.ensureRemoteDirectory(remoteDir);
      
      // 获取文件大小
      const fileStats = await fs.stat(localPath);
      const fileSize = fileStats.size;
      const displayName = fileName || path.basename(localPath);
      
      // 创建进度条
      const progressBar = new ProgressBar(`上传 ${displayName} [:bar] :percent :etas`, {
        complete: '=',
        incomplete: ' ',
        width: 40,
        total: fileSize
      });
      
      // 创建读取流
      const readStream = fs.createReadStream(localPath);
      
      // 上传文件流
      await this.client.putFileContents(remotePath, readStream, {
        onUploadProgress: (progress: { loaded: number; total: number }) => {
          progressBar.tick(progress.loaded - progressBar.curr);
        }
      });
      
      return true;
    } catch (error) {
      console.error('上传文件失败:', error);
      return false;
    }
  }

  // 确保远程目录存在
  private async ensureRemoteDirectory(remotePath: string): Promise<void> {
    if (!this.client) return;
    
    const parts = remotePath.split('/').filter(part => part !== '');
    let currentPath = '';
    
    for (const part of parts) {
      currentPath += '/' + part;
      try {
        await this.client.getDirectoryContents(currentPath);
      } catch (error) {
        // 目录不存在，创建它
        await this.client.createDirectory(currentPath);
      }
    }
  }

  // 获取文件列表
  async getFileList(remotePath: string = '/'): Promise<FileInfo[]> {
    if (!this.client) return [];
    
    try {
      const contents = await this.client.getDirectoryContents(remotePath) as any[];
      const progressMap = await this.getProgressMap();
      
      const fileList: FileInfo[] = [];
      
      for (const item of contents) {
        if (item.type === 'file') {
          // 过滤掉进度文件和配置文件
          if (item.basename === this.PROGRESS_FILE_NAME || item.basename === getWebDAVConfigFileName()) {
            continue;
          }
          
          const fileInfo: FileInfo = {
            name: item.basename,
            path: item.filename,
            size: item.size,
            lastModified: new Date(item.lastmod),
            hasProgress: progressMap.has(item.basename),
            progress: progressMap.get(item.basename)
          };
          fileList.push(fileInfo);
        } else if (item.type === 'directory') {
          // 检查目录中是否有同名文件（处理特殊WebDAV服务器行为）
          try {
            const dirContents = await this.client.getDirectoryContents(item.filename) as any[];
            const matchingFile = dirContents.find((dirItem: any) => 
              dirItem.type === 'file' && dirItem.basename === item.basename && 
              dirItem.basename !== this.PROGRESS_FILE_NAME && dirItem.basename !== getWebDAVConfigFileName()
            );
            
            if (matchingFile) {
              const fileInfo: FileInfo = {
                name: item.basename,
                path: `${item.filename}/${item.basename}`,
                size: matchingFile.size,
                lastModified: new Date(matchingFile.lastmod),
                hasProgress: progressMap.has(item.basename),
                progress: progressMap.get(item.basename)
              };
              fileList.push(fileInfo);
            }
          } catch (error) {
            // 忽略无法访问的目录
          }
        }
      }
      
      return fileList;
    } catch (error) {
      console.error('获取文件列表失败:', error);
      return [];
    }
  }

  // 下载文件内容
  async downloadFile(remotePath: string): Promise<string | null> {
    if (!this.client) return null;
    
    try {
      const content = await this.client.getFileContents(remotePath, { format: 'text' }) as string;
      return content;
    } catch (error) {
      console.error('下载文件失败:', error);
      return null;
    }
  }

  // 下载文件内容（带进度条）
  async downloadFileWithProgress(remotePath: string, localPath: string): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      // 获取文件信息
      const fileInfo = await this.client.stat(remotePath) as any;
      const fileSize = fileInfo.size;
      
      // 创建进度条
      const progressBar = new ProgressBar('下载中 [:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 40,
        total: fileSize
      });
      
      // 创建可写流
      const writeStream = fs.createWriteStream(localPath);
      
      // 获取文件流
      const readStream = await this.client.createReadStream(remotePath);
      
      return new Promise((resolve, reject) => {
        readStream.on('data', (chunk: Buffer) => {
          progressBar.tick(chunk.length);
          writeStream.write(chunk);
        });
        
        readStream.on('end', () => {
          writeStream.end();
          resolve(true);
        });
        
        readStream.on('error', (error: Error) => {
          console.error('下载文件失败:', error);
          reject(false);
        });
        
        writeStream.on('error', (error: Error) => {
          console.error('写入文件失败:', error);
          reject(false);
        });
      });
    } catch (error) {
      console.error('下载文件失败:', error);
      return false;
    }
  }

  // 获取进度映射
  private async getProgressMap(): Promise<Map<string, ReadingProgress>> {
    const progressMap = new Map<string, ReadingProgress>();
    
    try {
      if (!this.client) return progressMap;
      
      const progressContent = await this.client.getFileContents(this.PROGRESS_FILE_NAME, { format: 'text' }) as string;
      const progressList: ReadingProgress[] = JSON.parse(progressContent);
      
      for (const progress of progressList) {
        progressMap.set(progress.fileName, progress);
      }
    } catch (error) {
      // 进度文件不存在或读取失败，返回空映射
    }
    
    return progressMap;
  }

  // 同步阅读进度到WebDAV
  async syncProgress(progressList: ReadingProgress[]): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const progressContent = JSON.stringify(progressList, null, 2);
      await this.client.putFileContents(this.PROGRESS_FILE_NAME, progressContent);
      return true;
    } catch (error) {
      console.error('同步阅读进度失败:', error);
      return false;
    }
  }

  // 从WebDAV获取阅读进度
  async fetchProgress(): Promise<ReadingProgress[]> {
    if (!this.client) return [];
    
    try {
      const progressContent = await this.client.getFileContents(this.PROGRESS_FILE_NAME, { format: 'text' }) as string;
      return JSON.parse(progressContent);
    } catch (error) {
      // 进度文件不存在或读取失败，返回空数组
      return [];
    }
  }

  // 同步应用配置到WebDAV
  async syncAppConfig(config: AppConfig): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const configContent = JSON.stringify(config, null, 2);
      await this.client.putFileContents(getWebDAVConfigFileName(), configContent);
      return true;
    } catch (error) {
      console.error('同步应用配置失败:', error);
      return false;
    }
  }

  // 从WebDAV获取应用配置
  async fetchAppConfig(): Promise<AppConfig | null> {
    if (!this.client) return null;
    
    try {
      const configContent = await this.client.getFileContents(getWebDAVConfigFileName(), { format: 'text' }) as string;
      return JSON.parse(configContent);
    } catch (error) {
      // 配置文件不存在或读取失败，返回null
      return null;
    }
  }

  // 删除远程文件
  async deleteFile(remotePath: string): Promise<boolean> {
    if (!this.client) {
      console.error('WebDAV客户端未初始化');
      return false;
    }

    try {
      await this.client.deleteFile(remotePath);
      return true;
    } catch (error) {
      console.error('删除远程文件失败:', error);
      return false;
    }
  }
}