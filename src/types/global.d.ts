// 全局类型声明文件
declare module 'chalk';
declare module 'inquirer';
declare module 'webdav';
declare module 'blessed';

// Jest全局类型
declare global {
  function describe(name: string, fn: () => void): void;
  function test(name: string, fn: () => void): void;
  function expect(value: any): any;
  function beforeEach(fn: () => void): void;
}