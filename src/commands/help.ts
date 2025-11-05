import { Command } from 'commander';
import chalk from 'chalk';

export const helpCommand = new Command('help')
  .description('显示帮助信息')
  .action(() => {
    console.log(chalk.cyan.bold('txread - 终端阅读工具\n'));
    
    console.log(chalk.yellow.bold('基本命令:'));
    console.log('  config              配置WebDAV连接信息');
    console.log('  upload              上传本地文件到WebDAV服务器');
    console.log('  list                获取WebDAV服务器上的文件列表');
    console.log('  use <filename>      选择要阅读的文件');
    console.log('  review [file]   解析文件，展示章节目录');
    console.log('  look [chapter]      开始阅读文件');
    console.log('  help                显示此帮助信息\n');
    
    console.log(chalk.yellow.bold('详细说明:'));
    console.log(chalk.white.bold('  config'));
    console.log('    配置WebDAV连接信息');
    console.log('    选项:');
    console.log('      -u, --username <username>  用户名');
    console.log('      -p, --password <password>  密码');
    console.log('      -l, --url <url>            WebDAV服务器URL\n');
    
    console.log(chalk.white.bold('  upload'));
    console.log('    上传本地文件到WebDAV服务器');
    console.log('    选项:');
    console.log('      -p, --path <path>          远程路径');
    console.log('      -t, --target <target>      本地文件或目录路径\n');
    
    console.log(chalk.white.bold('  list'));
    console.log('    获取WebDAV服务器上的文件列表');
    console.log('    选项:');
    console.log('      -p, --path <path>          远程路径 (默认: /)\n');
    
    console.log(chalk.white.bold('  use'));
    console.log('    选择要阅读的文件');
    console.log('    参数:');
    console.log('      filename                    文件名\n');
    
    console.log(chalk.white.bold('  review'));
    console.log('    解析文件，展示章节目录');
    console.log('    参数:');
    console.log('      filename                    文件名 (可选，如果已使用use命令选择文件)\n');
    
    console.log(chalk.white.bold('  look'));
    console.log('    开始阅读文件');
    console.log('    参数:');
    console.log('      chapter                     章节名称 (可选)\n');
    
    console.log(chalk.yellow.bold('阅读器快捷键:'));
    console.log('  q 或 C-c        退出阅读器');
    console.log('  1 或 ← 或 PageUp 上一页');
    console.log('  2 或 → 或 PageDown 或 空格 下一页');
    console.log('  ↑ 或 [          上一章');
    console.log('  ↓ 或 ]          下一章');
    console.log('  g               显示章节列表');
    console.log('  h 或 ?          显示帮助\n');
    
    console.log(chalk.yellow.bold('使用示例:'));
    console.log('  txread config -u username -p password -l https://example.com/webdav');
    console.log('  txread upload -p /books -t ./local_books');
    console.log('  txread list');
    console.log('  txread use novel.txt');
    console.log('  txread review');
    console.log('  txread look');
    console.log('  txread look "第一章"');
  });