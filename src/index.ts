#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { configCommand } from './commands/config';
import { uploadCommand } from './commands/upload';
import { listCommand } from './commands/list';
import { useCommand } from './commands/use';
import { reviewCommand } from './commands/review';
import { lookCommand } from './commands/look';
import { helpCommand } from './commands/help';
import { settingsCommand } from './commands/settings';

// 确保当前文件有可执行权限
const currentFilePath = __filename;
try {
  const stats = fs.statSync(currentFilePath);
  // 检查是否有可执行权限
  if (!(stats.mode & parseInt('111', 8))) {
    // 如果没有可执行权限，尝试添加
    fs.chmodSync(currentFilePath, stats.mode | parseInt('111', 8));
  }
} catch (error) {
  // 忽略权限设置错误
}

const program = new Command();

program
  .name('txread')
  .description('终端阅读工具 - 支持WebDAV同步的txt文件阅读器')
  .version('0.0.2');

// 注册命令
program.addCommand(configCommand);
program.addCommand(uploadCommand);
program.addCommand(listCommand);
program.addCommand(useCommand);
program.addCommand(reviewCommand);
program.addCommand(lookCommand);
program.addCommand(helpCommand);
program.addCommand(settingsCommand);

// 处理未知命令
program.on('command:*', () => {
  console.error(chalk.red('未知命令，使用 "txread help" 查看可用命令'));
  process.exit(1);
});

// 解析命令行参数
program.parse();