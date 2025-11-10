import { Chapter } from '../types';
import { TextParserService } from './textParser';
import { WebDAVService } from './webdav';
import { getReadingSettings } from '../utils/config';
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

  constructor(
    fileName: string,
    filePath: string,
    content: string,
    webdavService: WebDAVService,
    startChapter: number = 0
  ) {
    this.fileName = fileName;
    this.filePath = filePath;
    this.content = content;
    this.webdavService = webdavService;
    this.textParser = new TextParserService();
    
    // 解析章节
    this.chapters = this.textParser.parseChapters(content);
    
    // 设置当前章节
    this.currentChapterIndex = startChapter;
    
    // 设置阅读界面
    this.setupKeyBindings();
  }

  private setupKeyBindings(): void {
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
        this.previousChapter();
        return;
      }
      if (keyBindings?.previousChapter.includes('up') && keyStr === '\u001b[A') {
        this.previousChapter();
        return;
      }
      if (keyBindings?.previousChapter.includes('[') && keyStr === '[') {
        this.previousChapter();
        return;
      }
      
      // 检查下一章快捷键
      if (keyBindings?.nextChapter.includes('2') && keyStr === '2') {
        this.nextChapter();
        return;
      }
      if (keyBindings?.nextChapter.includes('down') && keyStr === '\u001b[B') {
        this.nextChapter();
        return;
      }
      if (keyBindings?.nextChapter.includes(']') && keyStr === ']') {
        this.nextChapter();
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
        this.showChapterList();
        return;
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

  private previousChapter(): void {
    if (this.currentChapterIndex > 0) {
      this.currentChapterIndex--;
      const currentChapter = this.chapters[this.currentChapterIndex];
      this.saveProgress(currentChapter.title, 0, this.currentChapterIndex);
      // 先更新显示，再调用resetPosition回到顶部
      this.updateDisplay();
      // 确保滚动到顶部
      this.scrollToTop();
    }
  }

  private nextChapter(): void {
    if (this.currentChapterIndex < this.chapters.length - 1) {
      this.currentChapterIndex++;
      const currentChapter = this.chapters[this.currentChapterIndex];
      this.saveProgress(currentChapter.title, 0, this.currentChapterIndex);
      // 先更新显示，再调用resetPosition回到顶部
      this.updateDisplay();
      // 确保滚动到顶部
      this.scrollToTop();
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

  private showChapterList(): void {
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
    
    console.log(`\n===== ${this.fileName} - 章节列表 =====`);
    
    this.chapters.forEach((chapter, index) => {
      const marker = index === this.currentChapterIndex ? '→' : ' ';
      console.log(`${marker} [${index + 1}] ${chapter.title}`);
    });
    
    const progressInfo = `当前进度: ${this.currentChapterIndex + 1}/${this.chapters.length}章`;
    console.log(`\n${progressInfo}`);
    
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
输入章节编号跳转，或按 ${exitKeys} 退出，${helpKeys} 返回阅读，${resetKeys} 回到顶部`);
    
    // 等待用户输入
    process.stdin.once('data', (key: Buffer) => {
      const keyStr = key.toString().trim();
      
      if (keyStr === 'q' || keyStr === '\u0003') { // Ctrl+C
        this.exit();
      } else if (keyStr === 'h' || keyStr === '?') {
        this.updateDisplay();
      } else if (this.isResetKeyMatch(keyBindings?.resetPosition, keyStr)) {
        this.resetPosition();
      } else {
        const chapterIndex = parseInt(keyStr, 10);
        if (!isNaN(chapterIndex) && chapterIndex >= 1 && chapterIndex <= this.chapters.length) {
          this.currentChapterIndex = chapterIndex - 1;
          const currentChapter = this.chapters[this.currentChapterIndex];
          this.saveProgress(currentChapter.title, 0, this.currentChapterIndex);
          this.updateDisplay();
        } else {
          console.log('无效的章节编号，请输入1到', this.chapters.length, '之间的数字');
          this.showChapterList();
        }
      }
    });
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
      
      // 保存进度到WebDAV
      await this.webdavService.syncProgress([progress]);
    } catch (error) {
      console.error('保存阅读进度到WebDAV失败:', error);
      throw error;
    }
  }
}