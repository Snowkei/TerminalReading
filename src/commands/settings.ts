import { Command } from 'commander';
import chalk from 'chalk';
import { getWebDAVConfig, mergeKeyBindings } from '../utils/config';
import { WebDAVService } from '../services/webdav';
import { getAppConfig, saveAppConfig, updateReadingSettings, getReadingSettings } from '../utils/config';
import { AppConfig, ReadingSettings } from '../types';

export const settingsCommand = new Command('settings')
  .description('管理应用设置和配置')
  .option('-s, --sync', '从WebDAV同步配置')
  .option('-u, --upload', '上传配置到WebDAV')
  .option('--show', '显示当前配置')
  .option('--set-chapters-per-page <number>', '设置每页显示的章节数量')
  .option('--set-lines-per-page <number>', '设置每页显示的行数')
  .option('--set-font-size <number>', '设置字体大小')
  .option('--set-clear-terminal <boolean>', '设置翻页时是否清空终端 (true/false)')
  .option('--set-prev-keys <keys>', '设置上一章快捷键 (用逗号分隔，如: a,up,[)')
  .option('--set-next-keys <keys>', '设置下一章快捷键 (用逗号分隔，如: d,down,])')
  .option('--set-exit-keys <keys>', '设置退出快捷键 (用逗号分隔，如: q,ctrl+c)')
  .option('--set-help-keys <keys>', '设置帮助快捷键 (用逗号分隔，如: h,?)')
  .option('--set-chapter-list-keys <keys>', '设置章节列表快捷键 (用逗号分隔，如: g)')
  .option('--set-reset-keys <keys>', '设置回到顶部快捷键 (用逗号分隔，如: r,R)')
  .action(async (options) => {
    try {
      // 如果没有提供任何选项，显示当前配置
      if (!options.sync && !options.upload && !options.show && 
          !options.setChaptersPerPage && !options.setLinesPerPage && !options.setFontSize &&
          !options.setClearTerminal && !options.setPrevKeys && !options.setNextKeys &&
          !options.setExitKeys && !options.setHelpKeys && !options.setChapterListKeys &&
          !options.setResetKeys) {
        options.show = true;
      }
      
      // 显示当前配置
      if (options.show) {
        const settings = getReadingSettings();
        console.log(chalk.green('\n当前阅读设置:\n'));
        console.log(chalk.cyan(`  每页章节数量: ${settings.chaptersPerPage}`));
        console.log(chalk.cyan(`  每页显示行数: ${settings.linesPerPage}`));
        console.log(chalk.cyan(`  字体大小: ${settings.fontSize}`));
        console.log(chalk.cyan(`  翻页时清空终端: ${settings.clearTerminalOnPageChange ? '是' : '否'}`));
        
        if (settings.keyBindings) {
          console.log(chalk.cyan(`  上一章快捷键: ${settings.keyBindings.previousChapter.join(', ')}`));
          console.log(chalk.cyan(`  下一章快捷键: ${settings.keyBindings.nextChapter.join(', ')}`));
          console.log(chalk.cyan(`  退出快捷键: ${settings.keyBindings.exit.join(', ')}`));
          console.log(chalk.cyan(`  帮助快捷键: ${settings.keyBindings.help.join(', ')}`));
          console.log(chalk.cyan(`  章节列表快捷键: ${settings.keyBindings.chapterList.join(', ')}`));
          if (settings.keyBindings.resetPosition) {
            console.log(chalk.cyan(`  回到顶部快捷键: ${settings.keyBindings.resetPosition.join(', ')}`));
          }
        }
        
        const config = getAppConfig();
        if (config.lastSyncTime) {
          console.log(chalk.cyan(`  上次同步时间: ${config.lastSyncTime.toLocaleString()}`));
        } else {
          console.log(chalk.yellow('  尚未同步过配置'));
        }
        return;
      }
      
      // 设置每页章节数量
      if (options.setChaptersPerPage) {
        const chaptersPerPage = parseInt(options.setChaptersPerPage);
        if (isNaN(chaptersPerPage) || chaptersPerPage < 5 || chaptersPerPage > 100) {
          console.log(chalk.red('每页章节数量必须是5-100之间的整数'));
          return;
        }
        
        updateReadingSettings({ chaptersPerPage });
        console.log(chalk.green(`已设置每页章节数量为: ${chaptersPerPage}`));
      }
      
      // 设置每页显示行数
      if (options.setLinesPerPage) {
        const linesPerPage = parseInt(options.setLinesPerPage);
        if (isNaN(linesPerPage) || linesPerPage < 10 || linesPerPage > 100) {
          console.log(chalk.red('每页显示行数必须是10-100之间的整数'));
          return;
        }
        
        updateReadingSettings({ linesPerPage });
        console.log(chalk.green(`已设置每页显示行数为: ${linesPerPage}`));
      }
      
      // 设置字体大小
      if (options.setFontSize) {
        const fontSize = parseInt(options.setFontSize);
        if (isNaN(fontSize) || fontSize < 8 || fontSize > 32) {
          console.log(chalk.red('字体大小必须是8-32之间的整数'));
          return;
        }
        
        updateReadingSettings({ fontSize });
        console.log(chalk.green(`已设置字体大小为: ${fontSize}`));
      }
      
      // 设置翻页时是否清空终端
      if (options.setClearTerminal !== undefined) {
        const clearTerminal = options.setClearTerminal.toLowerCase();
        if (clearTerminal !== 'true' && clearTerminal !== 'false') {
          console.log(chalk.red('翻页清空终端设置必须是 true 或 false'));
          return;
        }
        
        updateReadingSettings({ clearTerminalOnPageChange: clearTerminal === 'true' });
        console.log(chalk.green(`已设置翻页时清空终端为: ${clearTerminal === 'true' ? '是' : '否'}`));
      }
      
      // 设置自定义按键
      const parseKeyBindings = (keysStr: string, preserveCase = false): string[] => {
        const normalized = keysStr
          .split(',')
          .map(key => (preserveCase ? key.trim() : key.trim().toLowerCase()))
          .filter(key => key.length > 0);
        return normalized;
      };
      
      // 设置上一章快捷键
      if (options.setPrevKeys) {
        const prevKeys = parseKeyBindings(options.setPrevKeys);
        const validKeys = ['1', 'up', '['];
        const invalidKeys = prevKeys.filter(key => !validKeys.includes(key));
        
        if (invalidKeys.length > 0) {
          console.log(chalk.red(`无效的上一章快捷键: ${invalidKeys.join(', ')}。有效选项: ${validKeys.join(', ')}`));
          return;
        }
        
        const currentSettings = getReadingSettings();
        const currentKeyBindings = currentSettings.keyBindings
          ? mergeKeyBindings(currentSettings.keyBindings)
          : mergeKeyBindings();
        
        updateReadingSettings({ 
          keyBindings: {
            ...currentKeyBindings,
            previousChapter: prevKeys
          }
        });
        console.log(chalk.green(`已设置上一章快捷键为: ${prevKeys.join(', ')}`));
      }
      
      // 设置下一章快捷键
      if (options.setNextKeys) {
        const nextKeys = parseKeyBindings(options.setNextKeys);
        const validKeys = ['2', 'down', ']'];
        const invalidKeys = nextKeys.filter(key => !validKeys.includes(key));
        
        if (invalidKeys.length > 0) {
          console.log(chalk.red(`无效的下一章快捷键: ${invalidKeys.join(', ')}。有效选项: ${validKeys.join(', ')}`));
          return;
        }
        
        const currentSettings = getReadingSettings();
        const currentKeyBindings = currentSettings.keyBindings
          ? mergeKeyBindings(currentSettings.keyBindings)
          : mergeKeyBindings();
        
        updateReadingSettings({ 
          keyBindings: {
            ...currentKeyBindings,
            nextChapter: nextKeys
          }
        });
        console.log(chalk.green(`已设置下一章快捷键为: ${nextKeys.join(', ')}`));
      }
      
      // 设置退出快捷键
      if (options.setExitKeys) {
        const exitKeys = parseKeyBindings(options.setExitKeys);
        const validKeys = ['q', 'ctrl+c'];
        const invalidKeys = exitKeys.filter(key => !validKeys.includes(key));
        
        if (invalidKeys.length > 0) {
          console.log(chalk.red(`无效的退出快捷键: ${invalidKeys.join(', ')}。有效选项: ${validKeys.join(', ')}`));
          return;
        }
        
        const currentSettings = getReadingSettings();
        const currentKeyBindings = currentSettings.keyBindings
          ? mergeKeyBindings(currentSettings.keyBindings)
          : mergeKeyBindings();
        
        updateReadingSettings({ 
          keyBindings: {
            ...currentKeyBindings,
            exit: exitKeys
          }
        });
        console.log(chalk.green(`已设置退出快捷键为: ${exitKeys.join(', ')}`));
      }
      
      // 设置帮助快捷键
      if (options.setHelpKeys) {
        const helpKeys = parseKeyBindings(options.setHelpKeys);
        const validKeys = ['h', '?'];
        const invalidKeys = helpKeys.filter(key => !validKeys.includes(key));
        
        if (invalidKeys.length > 0) {
          console.log(chalk.red(`无效的帮助快捷键: ${invalidKeys.join(', ')}。有效选项: ${validKeys.join(', ')}`));
          return;
        }
        
        const currentSettings = getReadingSettings();
        const currentKeyBindings = currentSettings.keyBindings
          ? mergeKeyBindings(currentSettings.keyBindings)
          : mergeKeyBindings();
        
        updateReadingSettings({ 
          keyBindings: {
            ...currentKeyBindings,
            help: helpKeys
          }
        });
        console.log(chalk.green(`已设置帮助快捷键为: ${helpKeys.join(', ')}`));
      }
      
      // 设置章节列表快捷键
      if (options.setChapterListKeys) {
        const chapterListKeys = parseKeyBindings(options.setChapterListKeys);
        const validKeys = ['g'];
        const invalidKeys = chapterListKeys.filter(key => !validKeys.includes(key));
        
        if (invalidKeys.length > 0) {
          console.log(chalk.red(`无效的章节列表快捷键: ${invalidKeys.join(', ')}。有效选项: ${validKeys.join(', ')}`));
          return;
        }
        
        const currentSettings = getReadingSettings();
        const currentKeyBindings = currentSettings.keyBindings
          ? mergeKeyBindings(currentSettings.keyBindings)
          : mergeKeyBindings();
        
        updateReadingSettings({ 
          keyBindings: {
            ...currentKeyBindings,
            chapterList: chapterListKeys
          }
        });
        console.log(chalk.green(`已设置章节列表快捷键为: ${chapterListKeys.join(', ')}`));
      }

      // 设置回到顶部快捷键
      if (options.setResetKeys) {
        const resetKeys = parseKeyBindings(options.setResetKeys, true);
        if (resetKeys.length === 0) {
          console.log(chalk.red('回到顶部快捷键不能为空'));
          return;
        }

        const currentSettings = getReadingSettings();
        const currentKeyBindings = currentSettings.keyBindings
          ? mergeKeyBindings(currentSettings.keyBindings)
          : mergeKeyBindings();

        updateReadingSettings({
          keyBindings: {
            ...currentKeyBindings,
            resetPosition: resetKeys
          }
        });
        console.log(chalk.green(`已设置回到顶部快捷键为: ${resetKeys.join(', ')}`));
      }
      
      // 从WebDAV同步配置
      if (options.sync) {
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
        
        console.log(chalk.blue('正在从WebDAV同步配置...'));
        const remoteConfig = await webdavService.fetchAppConfig();
        
        if (remoteConfig) {
          // 更新本地配置
          const localConfig = getAppConfig();
          const mergedConfig: AppConfig = {
            reading: {
              ...localConfig.reading,
              ...remoteConfig.reading,
              keyBindings: mergeKeyBindings(
                localConfig.reading.keyBindings,
                remoteConfig.reading?.keyBindings
              )
            },
            lastSyncTime: new Date()
          };
          
          saveAppConfig(mergedConfig);
          console.log(chalk.green('配置同步成功'));
          
          // 显示同步后的配置
          const settings = mergedConfig.reading;
          console.log(chalk.green('\n同步后的阅读设置:\n'));
          console.log(chalk.cyan(`  每页章节数量: ${settings.chaptersPerPage}`));
          console.log(chalk.cyan(`  每页显示行数: ${settings.linesPerPage}`));
          console.log(chalk.cyan(`  字体大小: ${settings.fontSize}`));
          if (settings.keyBindings?.resetPosition) {
            console.log(chalk.cyan(`  回到顶部快捷键: ${settings.keyBindings.resetPosition.join(', ')}`));
          }
        } else {
          console.log(chalk.yellow('WebDAV上没有找到配置文件，将使用本地配置'));
        }
      }
      
      // 上传配置到WebDAV
      if (options.upload) {
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
        
        console.log(chalk.blue('正在上传配置到WebDAV...'));
        
        // 获取当前配置并更新同步时间
        const localConfig = getAppConfig();
        localConfig.lastSyncTime = new Date();
        
        const success = await webdavService.syncAppConfig(localConfig);
        
        if (success) {
          // 保存更新后的本地配置
          saveAppConfig(localConfig);
          console.log(chalk.green('配置上传成功'));
        } else {
          console.log(chalk.red('配置上传失败'));
        }
      }
    } catch (error) {
      console.error(chalk.red('设置管理失败:'), error);
    }
  });