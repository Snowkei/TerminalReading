import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { WebDAVConfig, ReadingProgress } from '../types';

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.txread');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const PROGRESS_FILE = path.join(CONFIG_DIR, '.txread_progress.json');

// 确保配置目录存在
export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// 保存WebDAV配置
export function saveWebDAVConfig(config: WebDAVConfig): void {
  ensureConfigDir();
  fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
}

// 获取WebDAV配置
export function getWebDAVConfig(): WebDAVConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return fs.readJsonSync(CONFIG_FILE);
    }
    return null;
  } catch (error) {
    console.error('读取配置文件失败:', error);
    return null;
  }
}

// 保存阅读进度
export function saveReadingProgress(progress: ReadingProgress[]): void {
  ensureConfigDir();
  fs.writeJsonSync(PROGRESS_FILE, progress, { spaces: 2 });
}

// 获取阅读进度
export function getReadingProgress(): ReadingProgress[] {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return fs.readJsonSync(PROGRESS_FILE);
    }
    return [];
  } catch (error) {
    console.error('读取进度文件失败:', error);
    return [];
  }
}

// 更新特定文件的阅读进度
export function updateReadingProgress(fileName: string, chapter: string, position: number): void {
  const progressList = getReadingProgress();
  const existingIndex = progressList.findIndex(p => p.fileName === fileName);
  
  const newProgress: ReadingProgress = {
    fileName,
    chapter,
    position,
    lastReadTime: new Date()
  };
  
  if (existingIndex >= 0) {
    progressList[existingIndex] = newProgress;
  } else {
    progressList.push(newProgress);
  }
  
  saveReadingProgress(progressList);
}

// 获取特定文件的阅读进度
export function getFileReadingProgress(fileName: string): ReadingProgress | null {
  const progressList = getReadingProgress();
  return progressList.find(p => p.fileName === fileName) || null;
}