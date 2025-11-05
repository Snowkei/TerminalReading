import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { saveWebDAVConfig, getWebDAVConfig } from '../utils/config';
import { WebDAVService } from '../services/webdav';

export const configCommand = new Command('config')
  .description('配置WebDAV连接信息')
  .option('-u, --url <url>', 'WebDAV服务器URL')
  .option('-n, --username <username>', '用户名')
  .option('-p, --password <password>', '密码')
  .action(async (options: any) => {
    try {
      let { username, password, url } = options;
      
      // 如果没有提供所有参数，则通过交互式提示获取
      if (!username || !password || !url) {
        const currentConfig = getWebDAVConfig();
        
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: '请输入WebDAV服务器URL:',
            default: currentConfig?.url || ''
          },
          {
            type: 'input',
            name: 'username',
            message: '请输入用户名:',
            default: currentConfig?.username || ''
          },
          {
            type: 'password',
            name: 'password',
            message: '请输入密码:',
            mask: '*',
            default: currentConfig?.password || ''
          }
        ]);
        
        url = answers.url;
        username = answers.username;
        password = answers.password;
      }
      
      // 验证配置
      console.log(chalk.blue('正在验证WebDAV连接...'));
      const webdavService = new WebDAVService();
      const initialized = webdavService.initialize({ url, username, password });
      
      if (!initialized) {
        console.log(chalk.red('WebDAV客户端初始化失败'));
        return;
      }
      
      const connected = await webdavService.checkConnection();
      if (!connected) {
        console.log(chalk.red('WebDAV连接失败，请检查配置信息'));
        return;
      }
      
      // 保存配置
      saveWebDAVConfig({ url, username, password });
      console.log(chalk.green('WebDAV配置保存成功！'));
    } catch (error) {
      console.error(chalk.red('配置失败:'), error);
    }
  });