import { Chapter } from '../types';
import { TextParserService } from './textParser';
import { WebDAVService } from './webdav';
import { getReadingSettings, updateReadingProgress } from '../utils/config';
import { spawn } from 'child_process';

export class ReadingInterface {
  private chapters: Chapter[];
  private currentChapterIndex: number;
  private textParser: TextParserService;
  private fileName: string;
  private filePath: string;
  private webdavService: WebDAVService;
  private content: string;
  public onExit: (progress: { chapter: string; position: number; chapterIndex: number }) => void = () => {};
  private isBossModeActive: boolean = false; // 老板模式是否激活
  private originalDisplay: string = ''; // 保存原始显示内容

  constructor(
    fileName: string,
    filePath: string,
    content: string,
    webdavService: WebDAVService,
    startChapter: number = 0,
    chapters?: Chapter[]
  ) {
    this.fileName = fileName;
    this.filePath = filePath;
    this.content = content;
    this.webdavService = webdavService;
    this.textParser = new TextParserService();
    
    // 使用传入的章节列表或解析内容
    this.chapters = chapters || this.textParser.parseChapters(content);
    
    // 设置当前章节
    this.currentChapterIndex = startChapter;
    
    // 立即保存起始章节进度，确保"look 330"等命令能正确记录进度
    if (this.chapters.length > 0 && this.currentChapterIndex >= 0 && this.currentChapterIndex < this.chapters.length) {
      const currentChapter = this.chapters[this.currentChapterIndex];
      // 异步保存进度，不阻塞构造函数
      this.saveProgress(currentChapter.title, 0, this.currentChapterIndex).catch(error => {
        // 静默失败，不影响构造函数执行
      });
    }
    
    // 设置阅读界面 - 立即调用异步方法，但不等待其完成
    // 这样不会阻塞构造函数的执行
    this.setupKeyBindings().catch(error => {
      console.error('设置按键绑定失败:', error);
    });
  }

  private async setupKeyBindings(): Promise<void> {
    // 获取阅读设置
    const settings = getReadingSettings();
    const keyBindings = settings.keyBindings;
    
    // 清屏并显示初始内容
    this.updateDisplay();
    
    // 监听键盘输入
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (key: Buffer) => {
      const keyStr = key.toString();
      
      // 检查退出快捷键
      if (keyBindings?.exit.includes('q') && keyStr === 'q') {
        this.exit();
        return;
      }
      if (keyBindings?.exit.includes('ctrl+c') && keyStr === '\u0003') {
        this.exit();
        return;
      }
      
      // 检查上一章快捷键
      if (keyBindings?.previousChapter.includes('1') && keyStr === '1') {
        this.previousChapter().catch(error => {
          console.error('切换上一章失败:', error);
        });
        return;
      }
      if (keyBindings?.previousChapter.includes('up') && keyStr === '\u001b[A') {
        this.previousChapter().catch(error => {
          console.error('切换上一章失败:', error);
        });
        return;
      }
      if (keyBindings?.previousChapter.includes('[') && keyStr === '[') {
        this.previousChapter().catch(error => {
          console.error('切换上一章失败:', error);
        });
        return;
      }
      
      // 检查下一章快捷键
      if (keyBindings?.nextChapter.includes('2') && keyStr === '2') {
        this.nextChapter().catch(error => {
          console.error('切换下一章失败:', error);
        });
        return;
      }
      if (keyBindings?.nextChapter.includes('down') && keyStr === '\u001b[B') {
        this.nextChapter().catch(error => {
          console.error('切换下一章失败:', error);
        });
        return;
      }
      if (keyBindings?.nextChapter.includes(']') && keyStr === ']') {
        this.nextChapter().catch(error => {
          console.error('切换下一章失败:', error);
        });
        return;
      }
      
      // 检查帮助快捷键
      if (keyBindings?.help.includes('h') && keyStr === 'h') {
        this.showHelp();
        return;
      }
      if (keyBindings?.help.includes('?') && keyStr === '?') {
        this.showHelp();
        return;
      }
      
      // 检查回到顶部快捷键（支持 Home 键及其转义序列）
      if (keyBindings?.resetPosition && keyBindings.resetPosition.length > 0) {
        // 检查单个字符按键（如 'R' 或 'r'）
        if (keyStr.length === 1) {
          const upperKey = keyStr.toUpperCase();
          // 直接检查是否匹配配置中的任何单个字符按键
          const matched = keyBindings.resetPosition.some(binding => {
            return binding.length === 1 && binding.toUpperCase() === upperKey;
          });
          if (matched) {
            this.resetPosition();
            return;
          }
        }
        // 再检查转义序列（如 Home 键）
        if (this.isResetKeyMatch(keyBindings.resetPosition, keyStr)) {
          this.resetPosition();
          return;
        }
      } else {
        // 如果配置不存在，使用默认值 'R' 作为后备
        if (keyStr === 'r' || keyStr === 'R') {
          this.resetPosition();
          return;
        }
      }

      // 检查章节列表快捷键
      if (keyBindings?.chapterList.includes('g') && keyStr === 'g') {
        // 计算当前阅读章节所在的页码
        const settings = getReadingSettings();
        const pageSize = settings.chaptersPerPage;
        const currentPage = Math.floor(this.currentChapterIndex / pageSize) + 1;
        this.showChapterList(currentPage);
        return;
      }
      
      // 检查老板键快捷键
      if (keyBindings?.bossKey && keyBindings.bossKey.length > 0) {
        // 检查单个字符按键
        if (keyStr.length === 1) {
          const matched = keyBindings.bossKey.some(binding => {
            return binding.length === 1 && binding === keyStr;
          });
          if (matched) {
            this.toggleBossMode();
            return;
          }
        }
      } else {
        // 如果配置不存在，使用默认值 '`' 作为后备
        if (keyStr === '`') {
          this.toggleBossMode();
          return;
        }
      }
      
      // 检查滚动到底部快捷键（支持 End 键及其转义序列）
      if (keyBindings?.scrollDown && keyBindings.scrollDown.length > 0) {
        // 检查单个字符按键（如 'T' 或 't'）
        if (keyStr.length === 1) {
          const upperKey = keyStr.toUpperCase();
          // 直接检查是否匹配配置中的任何单个字符按键
          const matched = keyBindings.scrollDown.some(binding => {
            return binding.length === 1 && binding.toUpperCase() === upperKey;
          });
          if (matched) {
            this.scrollDown();
            return;
          }
        }
        // 再检查转义序列（如 End 键）
        if (this.isScrollDownKeyMatch(keyBindings.scrollDown, keyStr)) {
          this.scrollDown();
          return;
        }
      } else {
        // 如果配置不存在，使用默认值 'T' 作为后备
        if (keyStr === 't' || keyStr === 'T') {
          this.scrollDown();
          return;
        }
      }
    });
  }

  private updateDisplay(forceClear: boolean = false): void {
    // 获取阅读设置
    const settings = getReadingSettings();
    const keyBindings = settings.keyBindings;
    
    // 根据配置决定是否清空终端
    if (settings.clearTerminalOnPageChange || forceClear) {
      // 更彻底的清屏方法：先移动光标到顶部，然后清屏
      process.stdout.write('\x1b[H');  // 将光标移到左上角（第一行第一列）
      process.stdout.write('\x1b[2J'); // 清屏（从光标位置到屏幕末尾）
      process.stdout.write('\x1b[3J'); // 清除滚动缓冲区（清除整个终端历史）
      // 再次确保光标在顶部
      process.stdout.write('\x1b[H');
      console.clear();
    }
    
    const currentChapter = this.chapters[this.currentChapterIndex];

    // 显示文件名和章节标题
    console.log(`===== ${this.fileName} =====`);
    console.log(`章节${this.currentChapterIndex + 1}: ${currentChapter.title}`);
    
    // 显示分隔线
    console.log(''.padEnd(50, '='));
    
    // 显示整个章节内容
    console.log(currentChapter.content);
    
    // 显示分隔线
    console.log(''.padEnd(50, '='));
    
    const progressInfo = `进度: ${this.currentChapterIndex + 1}/${this.chapters.length}章`;
    
    console.log(`\n----- ${progressInfo} -----`);
    
    // 根据配置生成操作提示
    const prevKeys = (keyBindings?.previousChapter ?? []).map(key => {
      if (key === '1') return '1';
      if (key === 'up') return '↑';
      if (key === '[') return '[';
      return key;
    }).join('/') || '-';
    
    const nextKeys = (keyBindings?.nextChapter ?? []).map(key => {
      if (key === '2') return '2';
      if (key === 'down') return '↓';
      if (key === ']') return ']';
      return key;
    }).join('/') || '-';
    
    const helpKeys = (keyBindings?.help ?? []).map(key => {
      if (key === 'h') return 'h';
      if (key === '?') return '?';
      return key;
    }).join('/') || '-';
    
    const chapterListKeys = (keyBindings?.chapterList ?? []).map(key => {
      if (key === 'g') return 'g';
      return key;
    }).join('/') || '-';
    
    const resetKeys = (keyBindings?.resetPosition ?? []).map(k => {
      const low = k.toLowerCase();
      if (low === 'home') return 'Home';
      if (k.length === 1 && k.toUpperCase() === 'R') return 'R';
      if (k === '\u001b[H' || k === '\u001b[1~' || k === '\u001bOH') return 'Home';
      return k;
    }).join('/') || '-';

    const scrollDownKeys = (keyBindings?.scrollDown ?? []).map(k => {
      const low = k.toLowerCase();
      if (low === 'end') return 'End';
      if (k.length === 1 && k.toUpperCase() === 'T') return 'T';
      if (k === '\u001b[F' || k === '\u001b[4~' || k === '\u001bOF') return 'End';
      return k;
    }).join('/') || '-';

    const exitKeys = (keyBindings?.exit ?? []).map(key => {
      if (key === 'q') return 'q';
      if (key === 'ctrl+c') return 'Ctrl+C';
      return key;
    }).join('/') || '-';
    
    console.log(`操作: ${exitKeys}=退出 ${prevKeys}=上一章 ${nextKeys}=下一章 ${helpKeys}=帮助 ${chapterListKeys}=章节列表 ${resetKeys}=回到顶部 ${scrollDownKeys}=滚动到底部`);
  }

  private async previousChapter(): Promise<void> {
    if (this.currentChapterIndex > 0) {
      this.currentChapterIndex--;
      const currentChapter = this.chapters[this.currentChapterIndex];
      // 先更新显示，让用户体验流畅
      this.updateDisplay();
      // 确保滚动到顶部
      this.scrollToTop();
      // 异步保存进度，但不阻塞用户操作
      try {
        await this.saveProgress(currentChapter.title, 0, this.currentChapterIndex);
      } catch (error) {
        // 静默失败，不影响用户体验，但可以在调试模式下记录
        // console.debug('保存进度失败(上一章):', error);
      }
    }
  }

  private async nextChapter(): Promise<void> {
    if (this.currentChapterIndex < this.chapters.length - 1) {
      this.currentChapterIndex++;
      const currentChapter = this.chapters[this.currentChapterIndex];
      // 先更新显示，让用户体验流畅
      this.updateDisplay();
      // 确保滚动到顶部
      this.scrollToTop();
      // 异步保存进度，但不阻塞用户操作
      try {
        await this.saveProgress(currentChapter.title, 0, this.currentChapterIndex);
      } catch (error) {
        // 静默失败，不影响用户体验，但可以在调试模式下记录
        // console.debug('保存进度失败(下一章):', error);
      }
    }
  }

  private resetPosition(): void {
    // 直接调用scrollToTop方法
    this.scrollToTop();
  }

  private scrollToTop(): void {
    // macOS: 先尝试用 AppleScript 发送 Cmd+↑ 到前台终端
    if (process.platform === 'darwin' && this.tryMacScrollViewport('up')) {
      // AppleScript成功后，再执行清屏确保内容可见
      setTimeout(() => {
        process.stdout.write('\x1b[H');  // 光标到(1,1)
      }, 100);
      return;
    }
    
    // 回退方案：通过清滚动缓冲 + 清屏 + 光标复位模拟"到顶"
    process.stdout.write('\x1b[3J'); // 清滚动缓冲区
    process.stdout.write('\x1b[2J'); // 清屏
    process.stdout.write('\x1b[H');  // 光标到(1,1)
    console.clear();
    process.stdout.write('\x1b[H');  // 再确保到(1,1)
  }

  private scrollDown(): void {
    // macOS: 先尝试用 AppleScript 发送 Cmd+↓ 到前台终端
    if (process.platform === 'darwin' && this.tryMacScrollViewport('down')) {
      // AppleScript成功后，再执行清屏确保内容可见
      setTimeout(() => {
        // 将光标移到最后一行
        const height = process.stdout.rows || 24;
        process.stdout.write(`\x1b[${height}F`);
      }, 100);
      return;
    }
    
    // 回退方案：通过多次换行模拟"到底"
    // 获取终端高度
    const height = process.stdout.rows || 24;
    // 输出足够的换行符，确保内容滚动到底部
    for (let i = 0; i < height; i++) {
      console.log();
    }
    // 将光标移回最后一行
    process.stdout.write(`\x1b[${height}F`);
  }



  // 仅限 macOS: 使用 AppleScript 发送 Cmd+↑/Cmd+↓，真正滚动终端视口
  // 需要“系统偏好设置 > 安全性与隐私 > 辅助功能”授权当前终端
  private tryMacScrollViewport(direction: 'up' | 'down'): boolean {
    try {
      const keyCode = direction === 'up' ? 126 : 125; // 126=↑, 125=↓
      const script = `tell application "System Events" to key code ${keyCode} using command down`;
      const child = spawn('osascript', ['-e', script], {
        stdio: 'ignore',
        detached: true
      });
      child.unref();
      return true;
    } catch {
      return false;
    }
  }

  private isResetKeyMatch(bindingKeys: string[] | undefined, key: string): boolean {
    if (!bindingKeys?.length) return false;
    
    // 常见 Home 键序列：ESC [ H、ESC [ 1 ~、ESC O H
    const isHomeSequence = key === '\u001b[H' || key === '\u001b[1~' || key === '\u001bOH';
    
    return bindingKeys.some(binding => {
      const b = binding.toLowerCase();
      // 如果配置中有 'home'，匹配 Home 键序列
      if (b === 'home' && isHomeSequence) return true;
      // 匹配单个字符（如 'R'）
      if (binding.length === 1 && key.length === 1) {
        return binding.toUpperCase() === key.toUpperCase();
      }
      // 直接匹配转义序列
      return binding === key;
    });
  }

  private isScrollDownKeyMatch(bindingKeys: string[] | undefined, key: string): boolean {
    if (!bindingKeys?.length) return false;
    
    // 常见 End 键序列：ESC [ F、ESC [ 4 ~、ESC O F
    const isEndSequence = key === '\u001b[F' || key === '\u001b[4~' || key === '\u001bOF';
    
    return bindingKeys.some(binding => {
      const b = binding.toLowerCase();
      // 如果配置中有 'end'，匹配 End 键序列
      if (b === 'end' && isEndSequence) return true;
      // 匹配单个字符（如 'T'）
      if (binding.length === 1 && key.length === 1) {
        return binding.toUpperCase() === key.toUpperCase();
      }
      // 直接匹配转义序列
      return binding === key;
    });
  }

  private showHelp(): void {
    // 获取阅读设置
    const settings = getReadingSettings();
    const keyBindings = settings.keyBindings;
    
    // 根据配置决定是否清空终端
    if (settings.clearTerminalOnPageChange) {
      // 更彻底的清屏方法：先移动光标到顶部，然后清屏
      process.stdout.write('\x1b[H');  // 将光标移到左上角（第一行第一列）
      process.stdout.write('\x1b[2J'); // 清屏（从光标位置到屏幕末尾）
      process.stdout.write('\x1b[3J'); // 清除滚动缓冲区（清除整个终端历史）
      // 再次确保光标在顶部
      process.stdout.write('\x1b[H');
    }
    
    // 根据配置生成操作说明
    const prevKeys = (keyBindings?.previousChapter ?? []).map(key => {
      if (key === '1') return '1';
      if (key === 'up') return '↑';
      if (key === '[') return '[';
      return key;
    }).join(' 或 ') || '-';
    
    const nextKeys = (keyBindings?.nextChapter ?? []).map(key => {
      if (key === '2') return '2';
      if (key === 'down') return '↓';
      if (key === ']') return ']';
      return key;
    }).join(' 或 ') || '-';
    
    const helpKeys = (keyBindings?.help ?? []).map(key => {
      if (key === 'h') return 'h';
      if (key === '?') return '?';
      return key;
    }).join(' 或 ') || '-';
    
    const chapterListKeys = (keyBindings?.chapterList ?? []).map(key => {
      if (key === 'g') return 'g';
      return key;
    }).join(' 或 ') || '-';
    
    const resetKeys = (keyBindings?.resetPosition ?? []).map(k => {
    const low = k.toLowerCase();
    if (low === 'home') return 'Home';
    if (k.length === 1 && k.toUpperCase() === 'R') return 'R';
    if (k === '\u001b[H' || k === '\u001b[1~' || k === '\u001bOH') return 'Home';
    return k;
  }).join(' 或 ') || '-';

  const scrollDownKeys = (keyBindings?.scrollDown ?? []).map(k => {
    const low = k.toLowerCase();
    if (low === 'end') return 'End';
    if (k.length === 1 && k.toUpperCase() === 'T') return 'T';
    if (k === '\u001b[F' || k === '\u001b[4~' || k === '\u001bOF') return 'End';
    return k;
  }).join(' 或 ') || '-';

  const exitKeys = (keyBindings?.exit ?? []).map(key => {
    if (key === 'q') return 'q';
    if (key === 'ctrl+c') return 'Ctrl+C';
    return key;
  }).join(' 或 ') || '-';
    
    const bossKeys = (keyBindings?.bossKey ?? []).map(k => {
    if (k.length === 1 && k === '`') return '`';
    return k;
  }).join(' 或 ') || '`';

  console.log(`
===== 阅读器帮助 =====

基本操作:
  ${exitKeys}: 退出阅读器
  ${prevKeys}: 上一章
  ${nextKeys}: 下一章
  ${chapterListKeys}: 章节列表
  ${helpKeys}: 显示此帮助
  ${resetKeys}: 回到顶部
  ${scrollDownKeys}: 滚动到底部
  ${bossKeys}: 老板键 - 快速隐藏阅读内容

说明:
  - 每次显示整个章节内容
  - 翻页时${settings.clearTerminalOnPageChange ? '会' : '不会'}清空终端
  - 阅读进度会自动保存
  - 退出时会自动同步到WebDAV

按任意键返回阅读...
  `);
    
    // 等待用户按键
    process.stdin.once('data', (key: Buffer) => {
      const keyStr = key.toString();
      this.updateDisplay();
    });
  }

  private showChapterList(page: number = 1): void {
    // 获取阅读设置
    const settings = getReadingSettings();
    const keyBindings = settings.keyBindings;
    const pageSize = settings.chaptersPerPage;
    
    // 根据配置决定是否清空终端
    if (settings.clearTerminalOnPageChange) {
      // 更彻底的清屏方法：先移动光标到顶部，然后清屏
      process.stdout.write('\x1b[H');  // 将光标移到左上角（第一行第一列）
      process.stdout.write('\x1b[2J'); // 清屏（从光标位置到屏幕末尾）
      process.stdout.write('\x1b[3J'); // 清除滚动缓冲区（清除整个终端历史）
      // 再次确保光标在顶部
      process.stdout.write('\x1b[H');
    }
    
    // 计算总页数
    const totalPages = Math.ceil(this.chapters.length / pageSize);
    
    // 确保页码有效
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    
    console.log(`\n===== ${this.fileName} - 章节列表 (第 ${page}/${totalPages} 页) =====`);
    
    // 计算当前页的起始和结束索引
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, this.chapters.length);
    
    // 显示当前页的章节
    for (let i = startIndex; i < endIndex; i++) {
      const chapter = this.chapters[i];
      const marker = i === this.currentChapterIndex ? '→' : ' ';
      console.log(`${marker} [${i + 1}] ${chapter.title}`);
    }
    
    const progressInfo = `当前进度: ${this.currentChapterIndex + 1}/${this.chapters.length}章`;
    console.log(`\n${progressInfo}`);
    
    // 显示分页导航
    console.log('\n分页导航:');
    if (page > 1) {
      console.log(`  [p] 上一页`);
    }
    if (page < totalPages) {
      console.log(`  [n] 下一页`);
    }
    console.log(`  [数字] 跳转到章节所在页面`);
    console.log(`  [j+数字] 直接跳转阅读章节 (例如: j330)`);
    console.log(`  [\`] 老板键 - 快速隐藏阅读内容`);
    
    // 根据配置生成操作说明
    const helpKeys = (keyBindings?.help ?? []).map(key => {
      if (key === 'h') return 'h';
      if (key === '?') return '?';
      return key;
    }).join(' 或 ') || '-';
    
    const resetKeys = (keyBindings?.resetPosition ?? []).map(k => {
      const low = k.toLowerCase();
      if (low === 'home') return 'Home';
      if (k.length === 1 && k.toUpperCase() === 'R') return 'R';
      if (k === '\u001b[H' || k === '\u001b[1~' || k === '\u001bOH') return 'Home';
      return k;
    }).join(' 或 ') || '-';

    const exitKeys = (keyBindings?.exit ?? []).map(key => {
      if (key === 'q') return 'q';
      if (key === 'ctrl+c') return 'Ctrl+C';
      return key;
    }).join(' 或 ') || '-';
 
    console.log(`
按 ${exitKeys} 退出，${helpKeys} 返回阅读，${resetKeys} 回到顶部`);
    
    // 等待用户输入
    let inputBuffer = '';
    
    const handleInput = (key: Buffer) => {
      const keyStr = key.toString().trim();
      
      // 如果是回车键，处理缓冲区内容
      if (keyStr === '' || keyStr === '\r' || keyStr === '\n') {
        if (inputBuffer.length > 0) {
          processInput(inputBuffer);
          inputBuffer = '';
        } else {
          // 空输入，重新显示
          this.showChapterList(page);
        }
        return;
      }
      
      // 如果是ESC键，清空缓冲区并重新显示
      if (keyStr === '\u001b') {
        inputBuffer = '';
        this.showChapterList(page);
        return;
      }
      
      // 如果是退格键，删除最后一个字符
      if (keyStr === '\u007f' || keyStr === '\b') {
        inputBuffer = inputBuffer.slice(0, -1);
        // 显示当前输入内容
        process.stdout.write('\r输入: ' + inputBuffer + ' '.repeat(20 - inputBuffer.length) + '\r');
        return;
      }
      
      // 添加字符到缓冲区
      inputBuffer += keyStr;
      
      // 显示当前输入内容
      process.stdout.write('\r输入: ' + inputBuffer);
      
      // 如果输入以j开头且后面跟着数字，并且数字长度足够长，可以提前处理
      if (inputBuffer.startsWith('j') && inputBuffer.length > 1) {
        const numStr = inputBuffer.substring(1);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num >= 1 && num <= this.chapters.length) {
          // 如果输入的数字是有效的章节号，可以提示用户按回车确认
          process.stdout.write(` (按回车跳转到第${num}章)`);
        }
      }
    };
    
    const processInput = (input: string) => {
      input = input.trim();
      
      // 检查是否是老板键
      const bossKeys = keyBindings?.bossKey || ['`'];
      if (bossKeys.includes(input)) {
        this.toggleBossMode();
        return;
      }
      
      if (input === 'q' || input === '\u0003') { // Ctrl+C
        this.exit();
      } else if (input === 'h' || input === '?') {
        this.updateDisplay();
      } else if (this.isResetKeyMatch(keyBindings?.resetPosition, input)) {
        this.resetPosition();
      } else if (input === 'p' && page > 1) {
        // 上一页
        this.showChapterList(page - 1);
      } else if (input === 'n' && page < totalPages) {
        // 下一页
        this.showChapterList(page + 1);
      } else if (input.startsWith('j')) {
        // 处理j+数字命令，直接跳转阅读章节
        const chapterNumStr = input.substring(1);
        const chapterIndex = parseInt(chapterNumStr, 10);
        if (!isNaN(chapterIndex) && chapterIndex >= 1 && chapterIndex <= this.chapters.length) {
          this.currentChapterIndex = chapterIndex - 1;
          const currentChapter = this.chapters[this.currentChapterIndex];
          // 先更新显示，让用户体验流畅
          this.updateDisplay();
          // 异步保存进度，不使用await避免阻塞事件循环
          this.saveProgress(currentChapter.title, 0, this.currentChapterIndex).catch(error => {
            // 静默失败，不影响用户体验
          });
        } else {
          console.log(`\n无效的章节编号: ${chapterNumStr}，请输入1-${this.chapters.length}之间的数字`);
          this.showChapterList(page);
        }
      } else {
        // 处理纯数字输入，跳转到章节所在页面
        const chapterIndex = parseInt(input, 10);
        if (!isNaN(chapterIndex) && chapterIndex >= 1 && chapterIndex <= this.chapters.length) {
          // 计算章节所在的页面
          const targetPage = Math.ceil(chapterIndex / pageSize);
          if (targetPage !== page) {
            // 跳转到目标页面
            this.showChapterList(targetPage);
          } else {
            // 章节已在当前页面，询问是否直接跳转阅读
            console.log(`\n章节${chapterIndex}已在当前页面，是否直接跳转阅读？(y/n)`);
            process.stdin.once('data', (confirmKey: Buffer) => {
              const confirmStr = confirmKey.toString().trim().toLowerCase();
              if (confirmStr === 'y' || confirmStr === 'yes') {
                this.currentChapterIndex = chapterIndex - 1;
                const currentChapter = this.chapters[this.currentChapterIndex];
                this.updateDisplay();
                this.saveProgress(currentChapter.title, 0, this.currentChapterIndex).catch(error => {
                  // 静默失败，不影响用户体验
                });
              } else {
                // 重新显示当前页面
                this.showChapterList(page);
              }
            });
          }
        } else {
          console.log(`\n无效的输入: ${input}，请输入1-${this.chapters.length}之间的数字或导航命令`);
          this.showChapterList(page);
        }
      }
    };
    
    // 提示用户输入
    console.log('\n输入: ');
    
    // 移除所有现有的'data'监听器，避免重复触发
    process.stdin.removeAllListeners('data');
    process.stdin.on('data', handleInput);
  }

  // 启动阅读界面
  public start(): void {
    // 初始显示已在setupKeyBindings中处理
    // 保持进程运行
    return;
  }

  public exit(): void {
    // 恢复终端设置
    process.stdin.setRawMode(false);
    process.stdin.pause();
    
    // 获取当前章节信息
    const currentChapter = this.chapters[this.currentChapterIndex];
    
    // 保存阅读进度
    this.saveProgress(currentChapter.title, 0, this.currentChapterIndex)
      .then(() => {
        console.log('\n阅读进度已保存');
        // 调用退出回调
        this.onExit({
          chapter: currentChapter.title,
          position: 0,
          chapterIndex: this.currentChapterIndex
        });
        process.exit(0);
      })
      .catch(error => {
        console.error('保存阅读进度失败:', error);
        process.exit(1);
      });
  }

  private async saveProgress(chapterTitle: string, position: number, chapterIndex: number): Promise<void> {
    try {
      // 创建进度对象
      const progress = {
        fileName: this.fileName,
        chapter: chapterTitle,
        position,
        chapterIndex,
        lastReadTime: new Date()
      };
      
      // 1. 首先保存到本地文件（同步操作，确保优先完成）
      updateReadingProgress(this.fileName, chapterTitle, position, chapterIndex);
      
      // 2. 然后尝试同步到WebDAV（异步操作）
      try {
        await this.webdavService.syncProgress([progress]);
      } catch (webdavError) {
        // WebDAV同步失败不影响本地保存
        console.error('WebDAV同步失败，但本地进度已保存:', webdavError);
      }
    } catch (error) {
      console.error('保存阅读进度失败:', error);
      throw error;
    }
  }

  // 切换老板模式
  private toggleBossMode(): void {
    if (this.isBossModeActive) {
      // 退出老板模式，恢复原始显示
      this.restoreOriginalDisplay();
      this.isBossModeActive = false;
    } else {
      // 进入老板模式，显示伪装界面
      this.showBossScreen();
      this.isBossModeActive = true;
    }
  }

  // 显示伪装界面
  private showBossScreen(): void {
    // 保存当前终端内容
    this.originalDisplay = '\x1b[?47h'; // 保存屏幕内容
    
    // 清屏
    process.stdout.write('\x1b[H');  // 将光标移到左上角
    process.stdout.write('\x1b[2J'); // 清屏
    
    // 随机选择一种伪装界面
    const screens = [
      this.getCodeScreen,
      this.getLogScreen,
      this.getTerminalScreen,
      this.getServerStatusScreen
    ];
    
    const randomScreen = screens[Math.floor(Math.random() * screens.length)];
    randomScreen.call(this);
    
    // 在底部显示提示信息
    console.log('\n\x1b[90m按 ` 键返回阅读界面\x1b[0m');
  }

  // 恢复原始显示
  private restoreOriginalDisplay(): void {
    // 恢复屏幕内容
    process.stdout.write('\x1b[?47l'); // 恢复屏幕内容
    // 重新显示当前章节
    this.updateDisplay(true);
  }

  // 代码编辑器伪装界面
  private getCodeScreen(): void {
    console.log('\x1b[36m// 正在分析系统架构...\x1b[0m');
    console.log('\x1b[32mimport React, { useState, useEffect } from \'react\';\x1b[0m');
    console.log('\x1b[32mimport { connect } from \'react-redux\';\x1b[0m');
    console.log('\x1b[32mimport { fetchUserData } from \'../actions/userActions\';\x1b[0m');
    console.log('');
    console.log('\x1b[33mconst UserProfile = ({ userId, userData, dispatch }) => {\x1b[0m');
    console.log('\x1b[33m  const [loading, setLoading] = useState(true);\x1b[0m');
    console.log('\x1b[33m  const [error, setError] = useState(null);\x1b[0m');
    console.log('');
    console.log('\x1b[33m  useEffect(() => {\x1b[0m');
    console.log('\x1b[33m    const loadUserData = async () => {\x1b[0m');
    console.log('\x1b[33m      try {\x1b[0m');
    console.log('\x1b[33m        setLoading(true);\x1b[0m');
    console.log('\x1b[33m        await dispatch(fetchUserData(userId));\x1b[0m');
    console.log('\x1b[33m      } catch (err) {\x1b[0m');
    console.log('\x1b[31m        setError(\'Failed to load user data\');\x1b[0m');
    console.log('\x1b[33m      } finally {\x1b[0m');
    console.log('\x1b[33m        setLoading(false);\x1b[0m');
    console.log('\x1b[33m      }\x1b[0m');
    console.log('\x1b[33m    };\x1b[0m');
    console.log('');
    console.log('\x1b[33m    loadUserData();\x1b[0m');
    console.log('\x1b[33m  }, [userId, dispatch]);\x1b[0m');
    console.log('');
    console.log('\x1b[33m  if (loading) return <div>Loading...</div>;\x1b[0m');
    console.log('\x1b[33m  if (error) return <div>Error: {error}</div>;\x1b[0m');
    console.log('');
    console.log('\x1b[33m  return (\x1b[0m');
    console.log('\x1b[33m    <div className="user-profile">\x1b[0m');
    console.log('\x1b[33m      <h2>{userData.name}</h2>\x1b[0m');
    console.log('\x1b[33m      <p>Email: {userData.email}</p>\x1b[0m');
    console.log('\x1b[33m    </div>\x1b[0m');
    console.log('\x1b[33m  );\x1b[0m');
    console.log('\x1b[33m};\x1b[0m');
  }

  // 日志文件伪装界面
  private getLogScreen(): void {
    const now = new Date();
    console.log('\x1b[36m[INFO]\x1b[0m System initialization started');
    console.log(`\x1b[36m[INFO]\x1b[0m ${now.toISOString()} - Application startup sequence initiated`);
    console.log('\x1b[32m[SUCCESS]\x1b[0m Database connection established');
    console.log('\x1b[32m[SUCCESS]\x1b[0m Cache server connected: redis://localhost:6379');
    console.log('\x1b[33m[WARNING]\x1b[0m High memory usage detected: 78%');
    console.log('\x1b[36m[INFO]\x1b[0m Loading configuration files...');
    console.log('\x1b[32m[SUCCESS]\x1b[0m Configuration loaded successfully');
    console.log('\x1b[36m[INFO]\x1b[0m Starting API server on port 3000...');
    console.log('\x1b[32m[SUCCESS]\x1b[0m API server started successfully');
    console.log('\x1b[36m[INFO]\x1b[0m Initializing WebSocket connections...');
    console.log('\x1b[32m[SUCCESS]\x1b[0m WebSocket server initialized');
    console.log('\x1b[36m[INFO]\x1b[0m Running scheduled tasks...');
    console.log('\x1b[33m[WARNING]\x1b[0m Task "data-cleanup" took 2.3s (threshold: 2.0s)');
    console.log('\x1b[36m[INFO]\x1b[0m Checking for system updates...');
    console.log('\x1b[32m[SUCCESS]\x1b[0m System is up to date');
    console.log('\x1b[36m[INFO]\x1b[0m Monitoring system performance...');
    console.log(`\x1b[36m[INFO]\x1b[0m CPU Usage: ${Math.floor(Math.random() * 30 + 10)}%`);
    console.log(`\x1b[36m[INFO]\x1b[0m Memory Usage: ${Math.floor(Math.random() * 40 + 50)}%`);
    console.log(`\x1b[36m[INFO]\x1b[0m Disk Usage: ${Math.floor(Math.random() * 20 + 30)}%`);
    console.log('\x1b[36m[INFO]\x1b[0m System ready for incoming requests');
  }

  // 终端命令伪装界面
  private getTerminalScreen(): void {
    console.log('\x1b[32muser@development-server:~$\x1b[0m \x1b[36mcd /var/www/project\x1b[0m');
    console.log('\x1b[32muser@development-server:/var/www/project$\x1b[0m \x1b[36mgit status\x1b[0m');
    console.log('\x1b[33mOn branch feature/user-authentication\x1b[0m');
    console.log('\x1b[33mYour branch is ahead of \'origin/feature/user-authentication\' by 3 commits.\x1b[0m');
    console.log('\x1b[33m  (use "git push" to publish your local commits)\x1b[0m');
    console.log('');
    console.log('\x1b[32mChanges not staged for commit:\x1b[0m');
    console.log('\x1b[31m  modified:   src/components/UserProfile.js\x1b[0m');
    console.log('\x1b[31m  modified:   src/services/authService.js\x1b[0m');
    console.log('');
    console.log('\x1b[32mUntracked files:\x1b[0m');
    console.log('\x1b[31m  src/utils/validation.js\x1b[0m');
    console.log('');
    console.log('\x1b[33mno changes added to commit (use "git add" and/or "git commit -a")\x1b[0m');
    console.log('\x1b[32muser@development-server:/var/www/project$\x1b[0m \x1b[36mgit diff src/services/authService.js\x1b[0m');
    console.log('\x1b[36mdiff --git a/src/services/authService.js b/src/services/authService.js\x1b[0m');
    console.log('\x1b[36mindex 1234567..abcdefg 100644\x1b[0m');
    console.log('\x1b[36m--- a/src/services/authService.js\x1b[0m');
    console.log('\x1b[36m+++ b/src/services/authService.js\x1b[0m');
    console.log('\x1b[32m@@ -12,7 +12,8 @@\x1b[0m');
    console.log('\x1b[31m-const authenticateUser = async (username, password) => {\x1b[0m');
    console.log('\x1b[32m+const authenticateUser = async (username, password, options = {}) => {\x1b[0m');
    console.log('\x1b[32m+  const { rememberMe = false } = options;\x1b[0m');
    console.log('\x1b[36m   try {\x1b[0m');
    console.log('\x1b[36m     const response = await api.post(\'/auth/login\', { username, password });\x1b[0m');
  }

  // 服务器状态伪装界面
  private getServerStatusScreen(): void {
    console.log('\x1b[36m========================================\x1b[0m');
    console.log('\x1b[36m         SERVER STATUS DASHBOARD        \x1b[0m');
    console.log('\x1b[36m========================================\x1b[0m');
    console.log('');
    console.log('\x1b[33mSystem Information:\x1b[0m');
    console.log(`  Operating System: Linux Ubuntu 20.04 LTS`);
    console.log(`  Server Uptime: ${Math.floor(Math.random() * 30 + 1)} days, ${Math.floor(Math.random() * 24)} hours`);
    console.log(`  Load Average: ${(Math.random() * 2 + 0.5).toFixed(2)}, ${(Math.random() * 2 + 0.5).toFixed(2)}, ${(Math.random() * 2 + 0.5).toFixed(2)}`);
    console.log('');
    console.log('\x1b[33mResource Usage:\x1b[0m');
    console.log(`  CPU Usage: ${Math.floor(Math.random() * 30 + 10)}%`);
    console.log(`  Memory Usage: ${Math.floor(Math.random() * 1024 + 512)}MB / ${Math.floor(Math.random() * 2048 + 2048)}MB`);
    console.log(`  Disk Usage: ${Math.floor(Math.random() * 50 + 20)}%`);
    console.log(`  Network I/O: ${Math.floor(Math.random() * 100 + 10)}MB/s in, ${Math.floor(Math.random() * 100 + 10)}MB/s out`);
    console.log('');
    console.log('\x1b[33mService Status:\x1b[0m');
    console.log('  Web Server: \x1b[32m● Running\x1b[0m (PID: 1234, Port: 80, 443)');
    console.log('  Database: \x1b[32m● Running\x1b[0m (PostgreSQL 12.7, Port: 5432)');
    console.log('  Cache Server: \x1b[32m● Running\x1b[0m (Redis 6.2.6, Port: 6379)');
    console.log('  Message Queue: \x1b[32m● Running\x1b[0m (RabbitMQ 3.8.19, Port: 5672)');
    console.log('  Search Engine: \x1b[32m● Running\x1b[0m (Elasticsearch 7.15.0, Port: 9200)');
    console.log('');
    console.log('\x1b[33mRecent Activity:\x1b[0m');
    console.log(`  ${new Date().toISOString()} - API request processed in ${Math.floor(Math.random() * 100 + 20)}ms`);
    console.log(`  ${new Date(Date.now() - 60000).toISOString()} - Database backup completed successfully`);
    console.log(`  ${new Date(Date.now() - 120000).toISOString()} - Cache cleared and rebuilt`);
    console.log(`  ${new Date(Date.now() - 180000).toISOString()} - Security scan completed - no threats found`);
    console.log('');
    console.log('\x1b[36mLast updated: ' + new Date().toLocaleString() + '\x1b[0m');
  }
}