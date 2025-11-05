/// <reference types="jest" />
import { TextParserService } from '../src/services/textParser';

describe('TextParserService', () => {
  let textParser: TextParserService;

  beforeEach(() => {
    textParser = new TextParserService();
  });

  test('应该能够解析章节', () => {
    const content = `
第一章 开始
这是第一章的内容。

第二章 继续
这是第二章的内容。

第三章 结束
这是第三章的内容。
    `;

    const chapters = textParser.parseChapters(content);
    expect(chapters.length).toBe(3);
    expect(chapters[0].title).toBe('开始');
    expect(chapters[1].title).toBe('继续');
    expect(chapters[2].title).toBe('结束');
  });

  test('应该能够分页', () => {
    const content = '第1行\n第2行\n第3行\n第4行\n第5行\n第6行\n第7行\n第8行\n第9行\n第10行';
    const pages = textParser.paginateText(content, 3);
    
    expect(pages.length).toBe(4);
    expect(pages[0]).toBe('第1行\n第2行\n第3行');
    expect(pages[1]).toBe('第4行\n第5行\n第6行');
    expect(pages[2]).toBe('第7行\n第8行\n第9行');
    expect(pages[3]).toBe('第10行');
  });

  test('应该能够查找章节位置', () => {
    const content = `
第一章 开始
这是第一章的内容。

第二章 继续
这是第二章的内容。
    `;

    const position = textParser.findChapterPosition(content, '继续');
    expect(position).not.toBeNull();
    expect(position).toBeGreaterThan(0);
  });
});