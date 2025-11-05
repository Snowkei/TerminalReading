import { Chapter } from '../types';
import { TextParserService } from './textParser';
import * as readline from 'readline';

export class ReadingInterface {
  private content: string;
  private chapters: Chapter[];
  private currentChapterIndex: number;
  private currentPageIndex: number;
  private pages: string[][];
  private textParser: TextParserService;
  private fileName: string;
  public onExit: (progress: { chapter: string; position: number }) => void;
  private rl: readline.Interface;

  constructor(
    content: string,
    fileName: string,
    initialChapter?: string,
    onExit?: (progress: { chapter: string; position: number }) => void
  ) {
    this.content = content;
    this.fileName = fileName;
    this.textParser = new TextParserService();
    this.chapters = this.textParser.parseChapters(content);
    this.onExit = onExit || (() => {});

    // 初始化页面
    this.pages = this.chapters.map(chapter => 
      this.textParser.paginateText(chapter.content)
    );

    // 设置初始章节和页码
    if (initialChapter) {
      const chapterIndex = this.chapters.findIndex(chapter => 
        chapter.title.includes(initialChapter) || initialChapter.includes(chapter.title)
      );
      this.currentChapterIndex = chapterIndex >= 0 ? chapterIndex : 0;
    } else {
      this.currentChapterIndex = 0;
    }
    
    this.currentPageIndex = 0;

    // 创建readline接口
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // 设置键盘事件
    this.setupKeyBindings();
  }

  private setupKeyBindings(): void {
    // 清屏并显示初始内容
    this.updateDisplay();
    
    // 监听键盘输入
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (key: Buffer) => {
      const keyStr = key.toString();
      switch (keyStr) {
        case 'q': // 退出
        case '\u0003': // Ctrl+C
          this.exit();
          break;
        case '1': // 上一页
        case '\u001b[D': // 左箭头
          this.previousPage();
          break;
        case '2': // 下一页
        case ' ': // 空格
        case '\u001b[C': // 右箭头
          this.nextPage();
          break;
        case '\u001b[A': // 上箭头
        case '[': // 上一章
          this.previousChapter();
          break;
        case '\u001b[B': // 下箭头
        case ']': // 下一章
          this.nextChapter();
          break;
        case 'h': // 帮助
        case '?':
          this.showHelp();
          break;
        case 'g': // 章节列表
          this.showChapterList();
          break;
      }
    });
  }

  private updateDisplay(): void {
    // 使用 readline 移动光标并清屏
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    
    const currentChapter = this.chapters[this.currentChapterIndex];
    const currentPages = this.pages[this.currentChapterIndex];
    const currentPageContent = currentPages[this.currentPageIndex];

    // 显示内容
    console.log(`===== ${this.fileName} =====\n`);
    console.log(`章节: ${currentChapter.title}\n`);
    console.log(currentPageContent);
    
    const pageInfo = `页码: ${this.currentPageIndex + 1}/${currentPages.length}`;
    const progressInfo = `进度: ${this.currentChapterIndex + 1}/${this.chapters.length}章`;
    
    console.log(`\n----- ${pageInfo} | ${progressInfo} -----`);
    console.log('操作: q=退出 1/←=上一页 2/→/空格=下一页 ↑/[=上一章 ↓/]=下一章 h=帮助 g=章节列表');
  }

  private previousPage(): void {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
    } else if (this.currentChapterIndex > 0) {
      this.currentChapterIndex--;
      this.currentPageIndex = this.pages[this.currentChapterIndex].length - 1;
    }
    this.updateDisplay();
  }

  private nextPage(): void {
    const currentPages = this.pages[this.currentChapterIndex];
    if (this.currentPageIndex < currentPages.length - 1) {
      this.currentPageIndex++;
    } else if (this.currentChapterIndex < this.chapters.length - 1) {
      this.currentChapterIndex++;
      this.currentPageIndex = 0;
    }
    this.updateDisplay();
  }

  private previousChapter(): void {
    if (this.currentChapterIndex > 0) {
      this.currentChapterIndex--;
      this.currentPageIndex = 0;
    }
    this.updateDisplay();
  }

  private nextChapter(): void {
    if (this.currentChapterIndex < this.chapters.length - 1) {
      this.currentChapterIndex++;
      this.currentPageIndex = 0;
    }
    this.updateDisplay();
  }

  private showHelp(): void {
    // 使用 readline 移动光标并清屏
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    
    console.log(`
===== 阅读器帮助 =====

基本操作:
  q 或 Ctrl+C: 退出阅读器
  1 或 ←: 上一页
  2 或 → 或 空格: 下一页
  ↑ 或 [: 上一章
  ↓ 或 ]: 下一章
  g: 显示章节列表
  h 或 ?: 显示此帮助

说明:
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
    // 使用 readline 移动光标并清屏
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    
    console.log(`\n===== ${this.fileName} - 章节列表 =====\n`);
    
    this.chapters.forEach((chapter, index) => {
      const marker = index === this.currentChapterIndex ? '►' : ' ';
      const title = chapter.title.length > 40 ? chapter.title.substring(0, 37) + '...' : chapter.title;
      console.log(`${marker} ${index + 1}. ${title}`);
    });

    console.log('\n按数字键跳转到对应章节，按其他键返回...');
    
    // 等待用户按键
    process.stdin.once('data', (key: Buffer) => {
      const keyStr = key.toString();
      const chapterNum = parseInt(keyStr);
      if (chapterNum >= 1 && chapterNum <= this.chapters.length) {
        this.currentChapterIndex = chapterNum - 1;
        this.currentPageIndex = 0;
      }
      this.updateDisplay();
    });
  }

  private exit(): void {
    // 获取当前阅读位置
    const currentChapter = this.chapters[this.currentChapterIndex];
    const currentPosition = currentChapter.startPosition;
    
    // 调用退出回调
    this.onExit({
      chapter: currentChapter.title,
      position: currentPosition
    });

    // 恢复终端设置
    process.stdin.setRawMode(false);
    process.stdin.pause();
    this.rl.close();
    
    // 使用 readline 移动光标并清屏
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    console.log('阅读进度已保存');
  }

  // 启动阅读界面
  start(): void {
    // 初始显示已在setupKeyBindings中处理
    // 保持进程运行
    return;
  }
}