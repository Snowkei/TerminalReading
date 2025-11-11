// WebDAV配置类型
export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
}

// 阅读进度类型
export interface ReadingProgress {
  fileName: string;
  chapter: string;
  position: number;
  chapterIndex?: number;
  lastReadTime: Date;
}

// 章节信息类型
export interface Chapter {
  title: string;
  content: string;
  startPosition: number;
  endPosition: number;
}

// 文件信息类型
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  hasProgress?: boolean;
  progress?: ReadingProgress;
  isLocalOnly?: boolean; // 是否仅存在于本地
}

// 自定义按键配置类型
export interface KeyBindings {
  previousChapter: string[]; // 上一章快捷键
  nextChapter: string[]; // 下一章快捷键
  exit: string[]; // 退出快捷键
  help: string[]; // 帮助快捷键
  chapterList: string[]; // 章节列表快捷键
  resetPosition?: string[]; // 回到顶部快捷键
  scrollDown?: string[]; // 滚动到底部快捷键
}

// 阅读设置类型
export interface ReadingSettings {
  linesPerPage: number;
  fontSize: number;
  chaptersPerPage: number; // 每页显示的章节数量
  keyBindings?: KeyBindings; // 自定义按键配置
  clearTerminalOnPageChange?: boolean; // 翻页时是否清空终端
  scrollTopOnPageChange?: boolean; // 翻章后是否自动回到顶部
}

// 应用配置类型
export interface AppConfig {
  reading: ReadingSettings;
  lastSyncTime?: Date; // 上次同步时间
}