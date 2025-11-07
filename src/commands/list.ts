import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getWebDAVConfig, getReadingProgress } from '../utils/config';
import { WebDAVService } from '../services/webdav';

export const listCommand = new Command('list')
  .description('列出WebDAV服务器上的文件')
  .option('-p, --path <path>', '远程路径', '/')
  .action(async (options: any) => {
    try {
      const config = getWebDAVConfig();
      if (!config) {
        console.log(chalk.red('请先使用 "txread config" 配置WebDAV连接信息'));
        return;
      }
      
      const { path: remotePath } = options;
      const webdavService = new WebDAVService();
      
      // 初始化WebDAV客户端
      const initialized = webdavService.initialize(config);
      if (!initialized) {
        console.log(chalk.red('WebDAV客户端初始化失败'));
        return;
      }
      
      console.log(chalk.blue(`正在获取 ${remotePath} 的文件列表...`));
      
      // 获取文件列表
      const fileList = await webdavService.getFileList(remotePath);
      
      if (fileList.length === 0) {
        console.log(chalk.yellow('没有找到文件'));
        return;
      }
      
      // 创建表格显示文件列表
      const table = new Table({
        head: ['ID', '文件名', '大小', '最后修改时间', '阅读进度'],
        colWidths: [5, 25, 15, 20, 25]
      });
      
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const id = (i + 1).toString();
        const size = formatFileSize(file.size);
        let lastModified = '';
        if (file.lastModified instanceof Date) {
          lastModified = file.lastModified.toLocaleDateString();
        } else if (typeof file.lastModified === 'string') {
          lastModified = new Date(file.lastModified).toLocaleDateString();
        }
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
          progressInfo
        ]);
      }
      
      console.log(table.toString());
      
      console.log(chalk.blue('\n提示:'));
      console.log(chalk.blue('- 使用 "txread use <文件名>" 或 "txread use <ID>" 选择文件'));
      console.log(chalk.blue('- 使用 "txread review <文件名>" 或 "txread review <ID>" 查看章节列表'));
    } catch (error) {
      console.error(chalk.red('获取文件列表失败:'), error);
    }
  });

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}