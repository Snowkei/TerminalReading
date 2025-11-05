# txread - 终端阅读工具

一个支持WebDAV同步的终端txt文件阅读器，可以在终端中舒适地阅读txt文件，并自动记录阅读进度。

## 功能特点

- 📚 支持txt文件的章节解析和目录导航
- 📖 舒适的终端阅读界面，支持翻页和章节跳转
- ☁️ 通过WebDAV实现跨设备阅读进度同步
- 📝 自动记录阅读位置，下次打开从上次位置继续
- 📁 支持文件上传和管理
- ⌨️ 丰富的快捷键操作

## 安装

### 从npm安装

```bash
npm install -g txread
```

### 从源码安装

```bash
git clone https://github.com/Snowkei/TerminalReading.git
cd TerminalReading
npm install
npm run build
npm link
```

## 快速开始

1. 配置WebDAV连接：
   ```bash
   txread config -u 用户名 -p 密码 -l https://your-webdav-server.com/path
   ```

2. 上传本地文件到WebDAV：
   ```bash
   txread upload -p /remote/path -t /local/file/or/directory
   ```

3. 查看WebDAV上的文件列表：
   ```bash
   txread list
   ```

4. 选择要阅读的文件：
   ```bash
   txread use novel.txt
   ```

5. 查看文件章节目录：
   ```bash
   txread review
   ```

6. 开始阅读：
   ```bash
   txread look
   # 或者从指定章节开始
   txread look "第一章"
   ```

## 命令详解

### config - 配置WebDAV连接

配置与WebDAV服务器的连接信息。

```bash
txread config [options]
```

选项：
- `-u, --username <username>`: WebDAV用户名
- `-p, --password <password>`: WebDAV密码
- `-l, --url <url>`: WebDAV服务器URL

如果不提供选项，将通过交互式提示输入配置信息。

### upload - 上传文件

将本地文件或目录上传到WebDAV服务器。

```bash
txread upload -p <远程路径> -t <本地文件或目录>
```

选项：
- `-p, --path <path>`: 远程路径
- `-t, --target <target>`: 本地文件或目录路径

### list - 文件列表

获取WebDAV服务器上的文件列表，并显示阅读进度。

```bash
txread list [options]
```

选项：
- `-p, --path <path>`: 远程路径（默认：/）

### use - 选择文件

选择要阅读的文件，下载到本地缓存。

```bash
txread use <filename>
```

参数：
- `filename`: 要阅读的文件名

### review - 章节目录

解析文件，展示章节目录。

```bash
txread review [filename]
```

参数：
- `filename`: 文件名（可选，如果已使用use命令选择文件）

### look - 开始阅读

启动阅读界面，开始阅读文件。

```bash
txread look [chapter]
```

参数：
- `chapter`: 章节名称（可选，如果不指定则从上次阅读位置或开头开始）

### help - 帮助信息

显示帮助信息。

```bash
txread help
```

## 阅读器快捷键

在阅读界面中，可以使用以下快捷键：

- `q` 或 `Ctrl+C`: 退出阅读器
- `1` 或 `←` 或 `PageUp`: 上一页
- `2` 或 `→` 或 `PageDown` 或 `空格`: 下一页
- `↑` 或 `[`: 上一章
- `↓` 或 `]`: 下一章
- `g`: 显示章节列表，可按数字键跳转到对应章节
- `h` 或 `?`: 显示帮助信息

## WebDAV服务

txread支持任何标准的WebDAV服务，以下是一些常用的WebDAV服务：

-坚果云
- Nextcloud
- ownCloud
- 其他支持WebDAV的云存储服务

## 开发

### 技术栈

- TypeScript
- Node.js
- Commander.js (CLI框架)
- Blessed (终端UI)
- WebDAV客户端

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/yourusername/txread.git
cd txread

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建项目
npm run build

# 运行测试
npm test
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 更新日志

### v0.0.1

- 初始版本发布
- 支持WebDAV文件同步
- 实现终端阅读界面
- 支持章节解析和导航
- 支持阅读进度记录和同步
