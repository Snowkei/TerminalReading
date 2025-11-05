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
}

// 阅读设置类型
export interface ReadingSettings {
  linesPerPage: number;
  fontSize: number;
}