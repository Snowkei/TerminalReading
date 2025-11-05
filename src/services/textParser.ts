import { Chapter } from '../types';

export class TextParserService {
  // 解析文本文件，提取章节
  parseChapters(content: string): Chapter[] {
    const chapters: Chapter[] = [];
    
    // 常见的章节标题模式
    const chapterPatterns = [
      /^第[一二三四五六七八九十百千万\d]+章[：:\s]?(.+)$/gm,
      /^第[一二三四五六七八九十百千万\d]+节[：:\s]?(.+)$/gm,
      /^Chapter\s*\d+[：:\s]?(.+)$/gmi,
      /^\d+\.[\s]?(.+)$/gm,
      /^【(.+)】$/gm,
      /^【(.+)】$/gm
    ];
    
    // 尝试匹配章节标题
    let matches: RegExpExecArray[] = [];
    let patternIndex = -1;
    
    for (let i = 0; i < chapterPatterns.length; i++) {
      const pattern = chapterPatterns[i];
      pattern.lastIndex = 0; // 重置正则表达式状态
      const tempMatches = [];
      let match;
      
      while ((match = pattern.exec(content)) !== null) {
        tempMatches.push(match);
      }
      
      if (tempMatches.length > 0) {
        matches = tempMatches;
        patternIndex = i;
        break;
      }
    }
    
    // 如果没有找到章节，将整个内容作为一个章节
    if (matches.length === 0) {
      chapters.push({
        title: '全文',
        content: content,
        startPosition: 0,
        endPosition: content.length
      });
      return chapters;
    }
    
    // 合并相同标题的章节
    const chapterMap = new Map<string, { startIndex: number; endIndex: number; firstMatchIndex: number }>();
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const title = match[1] || match[0];
      const startPosition = match.index;
      
      // 计算结束位置（下一个章节开始的位置或文件末尾）
      let endPosition = content.length;
      if (i < matches.length - 1) {
        endPosition = matches[i + 1].index;
      }
      
      // 如果章节标题已存在，合并内容
      if (chapterMap.has(title)) {
        const existingChapter = chapterMap.get(title)!;
        existingChapter.endIndex = endPosition;
      } else {
        chapterMap.set(title, {
          startIndex: startPosition,
          endIndex: endPosition,
          firstMatchIndex: i
        });
      }
    }
    
    // 创建章节对象
    for (const [title, positions] of chapterMap) {
      // 获取第一次匹配的完整文本（包含章节标题）
      const firstMatch = matches[positions.firstMatchIndex];
      const fullChapterText = content.substring(positions.startIndex, positions.endIndex);
      
      // 从内容中移除重复的章节标题，只保留第一个
      const titlePattern = new RegExp(`^${firstMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gm');
      const cleanedContent = fullChapterText.replace(titlePattern, '');
      
      chapters.push({
        title: title.trim(),
        content: cleanedContent.trim(),
        startPosition: positions.startIndex,
        endPosition: positions.endIndex
      });
    }
    
    return chapters;
  }

  // 将文本分页
  paginateText(text: string, linesPerPage: number = 20): string[] {
    const lines = text.split('\n');
    const pages: string[] = [];
    
    for (let i = 0; i < lines.length; i += linesPerPage) {
      const pageLines = lines.slice(i, i + linesPerPage);
      pages.push(pageLines.join('\n'));
    }
    
    return pages;
  }

  // 查找章节位置
  findChapterPosition(content: string, chapterTitle: string): number | null {
    const chapters = this.parseChapters(content);
    const chapter = chapters.find(c => c.title.includes(chapterTitle) || chapterTitle.includes(c.title));
    
    return chapter ? chapter.startPosition : null;
  }

  // 获取指定位置的内容
  getContentAtPosition(content: string, position: number, length: number = 1000): string {
    if (position >= content.length) return '';
    
    const endPosition = Math.min(position + length, content.length);
    return content.substring(position, endPosition);
  }

  // 搜索文本中的关键词
  searchKeywords(content: string, keywords: string[]): { keyword: string; positions: number[] }[] {
    const results: { keyword: string; positions: number[] }[] = [];
    
    for (const keyword of keywords) {
      const positions: number[] = [];
      let index = content.indexOf(keyword);
      
      while (index !== -1) {
        positions.push(index);
        index = content.indexOf(keyword, index + 1);
      }
      
      if (positions.length > 0) {
        results.push({ keyword, positions });
      }
    }
    
    return results;
  }
}