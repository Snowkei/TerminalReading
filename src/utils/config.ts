import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { WebDAVConfig, ReadingProgress, AppConfig, ReadingSettings, KeyBindings } from '../types';

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.txread');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const PROGRESS_FILE = path.join(CONFIG_DIR, '.txread_progress.json');
const APP_CONFIG_FILE = path.join(CONFIG_DIR, 'app_config.json');

// 全局缓存目录
const GLOBAL_CACHE_DIR = path.join(CONFIG_DIR, 'cache');

// WebDAV上的配置文件名
const WEBDAV_CONFIG_FILE = '.txread_app_config.json';

export function mergeKeyBindings(
  ...bindings: Array<Partial<KeyBindings> | undefined>
): KeyBindings {
  const defaultBindings = DEFAULT_READING_SETTINGS.keyBindings ?? {
    previousChapter: [],
    nextChapter: [],
    exit: [],
    help: [],
    chapterList: [],
    resetPosition: [],
    scrollDown: [],
    bossKey: []
  };

  const result: KeyBindings = {
    previousChapter: [...defaultBindings.previousChapter],
    nextChapter: [...defaultBindings.nextChapter],
    exit: [...defaultBindings.exit],
    help: [...defaultBindings.help],
    chapterList: [...defaultBindings.chapterList],
    resetPosition: defaultBindings.resetPosition
      ? [...defaultBindings.resetPosition]
      : undefined,
    scrollDown: defaultBindings.scrollDown
      ? [...defaultBindings.scrollDown]
      : undefined,
    bossKey: defaultBindings.bossKey
      ? [...defaultBindings.bossKey]
      : undefined
  };

  bindings.forEach(binding => {
    if (!binding) return;
    if (binding.previousChapter) {
      result.previousChapter = [...binding.previousChapter];
    }
    if (binding.nextChapter) {
      result.nextChapter = [...binding.nextChapter];
    }
    if (binding.exit) {
      result.exit = [...binding.exit];
    }
    if (binding.help) {
      result.help = [...binding.help];
    }
    if (binding.chapterList) {
      result.chapterList = [...binding.chapterList];
    }
    if (binding.resetPosition && binding.resetPosition.length > 0) {
      result.resetPosition = [...binding.resetPosition];
    }
    if (binding.scrollDown && binding.scrollDown.length > 0) {
      result.scrollDown = [...binding.scrollDown];
    }
    if (binding.bossKey && binding.bossKey.length > 0) {
      result.bossKey = [...binding.bossKey];
    }
  });

  // 确保 resetPosition 始终有默认值（如果用户没有配置）
  if (!result.resetPosition || result.resetPosition.length === 0) {
    result.resetPosition = defaultBindings.resetPosition 
      ? [...defaultBindings.resetPosition] 
      : ['R', 'home'];
  }

  // 确保 scrollDown 始终有默认值（如果用户没有配置）
  if (!result.scrollDown || result.scrollDown.length === 0) {
    result.scrollDown = defaultBindings.scrollDown 
      ? [...defaultBindings.scrollDown] 
      : ['T', 'end'];
  }

  // 确保 bossKey 始终有默认值（如果用户没有配置）
  if (!result.bossKey || result.bossKey.length === 0) {
    result.bossKey = defaultBindings.bossKey 
      ? [...defaultBindings.bossKey] 
      : ['`'];
  }

  return result;
}

// 默认阅读设置
export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  linesPerPage: 20,
  chaptersPerPage: 50,
  fontSize: 14,
  keyBindings: {
    previousChapter: ['1', 'up', '['],
    nextChapter: ['2', 'down', ']'],
    exit: ['q', 'ctrl+c'],
    help: ['h', '?'],
    chapterList: ['g'],
    resetPosition: ['R', 'home'],
    scrollDown: ['T', 'end'],
    bossKey: ['`'] // 使用反引号作为默认老板键
  },
  clearTerminalOnPageChange: true,
  scrollTopOnPageChange: true
};

// 默认应用配置
const DEFAULT_APP_CONFIG: AppConfig = {
  reading: DEFAULT_READING_SETTINGS
};

// 确保配置目录存在
export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// 确保全局缓存目录存在
export function ensureGlobalCacheDir(): void {
  ensureConfigDir();
  if (!fs.existsSync(GLOBAL_CACHE_DIR)) {
    fs.mkdirSync(GLOBAL_CACHE_DIR, { recursive: true });
  }
}

// 获取全局缓存目录路径
export function getGlobalCacheDir(): string {
  return GLOBAL_CACHE_DIR;
}

// 获取全局缓存文件路径
export function getGlobalCacheFilePath(filename: string): string {
  return path.join(GLOBAL_CACHE_DIR, filename);
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
export function updateReadingProgress(
  fileName: string,
  chapter: string,
  position: number,
  chapterIndex?: number
): void {
  const progressList = getReadingProgress();
  const existingIndex = progressList.findIndex(p => p.fileName === fileName);
  const existingProgress = existingIndex >= 0 ? progressList[existingIndex] : undefined;
  
  const newProgress: ReadingProgress = {
    fileName,
    chapter,
    position,
    chapterIndex: chapterIndex ?? existingProgress?.chapterIndex,
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

// 保存应用配置
export function saveAppConfig(config: AppConfig): void {
  ensureConfigDir();
  fs.writeJsonSync(APP_CONFIG_FILE, config, { spaces: 2 });
}

// 获取应用配置
export function getAppConfig(): AppConfig {
  try {
    if (fs.existsSync(APP_CONFIG_FILE)) {
      const config = fs.readJsonSync(APP_CONFIG_FILE);
      // 确保配置包含所有必要的字段
      const mergedReading: ReadingSettings = {
        ...DEFAULT_READING_SETTINGS,
        ...config.reading,
        keyBindings: mergeKeyBindings(config.reading?.keyBindings)
      };

      return {
        reading: mergedReading,
        lastSyncTime: config.lastSyncTime
      };
    }
    return DEFAULT_APP_CONFIG;
  } catch (error) {
    console.error('读取应用配置文件失败:', error);
    return DEFAULT_APP_CONFIG;
  }
}

// 获取阅读设置
export function getReadingSettings(): ReadingSettings {
  const config = getAppConfig();
  return config.reading;
}

// 更新阅读设置
export function updateReadingSettings(settings: Partial<ReadingSettings>): void {
  const config = getAppConfig();
  const updatedReading: ReadingSettings = {
    ...config.reading,
    ...settings,
    keyBindings: mergeKeyBindings(config.reading.keyBindings, settings.keyBindings)
  };

  config.reading = updatedReading;
  saveAppConfig(config);
}

// 获取WebDAV配置文件名
export function getWebDAVConfigFileName(): string {
  return WEBDAV_CONFIG_FILE;
}