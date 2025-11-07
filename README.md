# txread - 终端阅读工具

一个支持WebDAV同步的终端txt文件阅读器，可以在终端中舒适地阅读txt文件，并自动记录阅读进度。

## 功能特点

- 📚 支持txt文件的章节解析和目录导航
- 📖 舒适的终端阅读界面，支持翻页和章节跳转
- ☁️ 通过WebDAV实现跨设备阅读进度同步
- 📝 自动记录阅读位置，下次打开从上次位置继续
- 📁 支持文件上传和管理
- ⌨️ 丰富的快捷键操作
- 🌐 全局文件缓存，文件只需下载一次，所有终端会话共享
- ⚙️ 可配置的阅读设置，支持跨设备同步

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

## 全局缓存

txread使用全局缓存机制，文件只需下载一次，所有终端会话共享：

- 文件缓存位置：`~/.txread/cache/`
- 配置文件位置：`~/.txread/config.json`
- 应用配置位置：`~/.txread/app_config.json`
- 阅读进度位置：`~/.txread/.txread_progress.json`

这意味着您可以在任何终端窗口或目录中使用txread，而不需要重复下载文件。阅读进度和配置设置也会在所有终端会话中同步。

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

选择要阅读的文件，下载到全局缓存。

```bash
txread use <filename>
```

参数：
- `filename`: 要阅读的文件名

**缓存优化**：如果文件已存在于全局缓存中，系统会直接使用本地缓存，无需重新下载，并自动匹配对应的阅读进度和章节分页。这样可以提高响应速度，减少不必要的网络请求。

### review - 章节目录

解析文件，展示章节目录。

```bash
txread review [filename] [options]
```

参数：
- `filename`: 文件名（可选，如果已使用use命令选择文件）

选项：
- `-p, --page <number>`: 指定要显示的页码（默认：1）
- `-s, --page-size <number>`: 每页显示的章节数量（默认：50，范围：5-100）

**缓存优化**：与use命令一样，review命令也会检查文件是否已存在于全局缓存中。如果文件已存在，会直接使用本地缓存，无需重新下载。

**分页功能**：当章节较多时，review命令会自动分页显示，每页默认显示50个章节。您可以使用以下命令进行分页导航：

```bash
# 查看第2页
txread review --page 2

# 每页显示5个章节
txread review --page-size 5

# 查看第3页，每页显示15个章节
txread review --page 3 --page-size 15
```

### look - 开始阅读

启动阅读界面，开始阅读文件。

```bash
txread look [chapter]
```

参数：
- `chapter`: 章节名称（可选，如果不指定则从上次阅读位置或开头开始）

**全局缓存**：look命令直接从全局缓存目录中读取文件，无需重新下载。如果缓存文件不存在，会提示重新使用use命令选择文件。

### settings - 应用设置

管理应用设置和配置，支持跨设备同步。

```bash
txread settings [options]
```

选项：
- `-s, --sync`: 从WebDAV同步配置
- `-u, --upload`: 上传配置到WebDAV
- `--show`: 显示当前配置（默认操作）
- `--set-chapters-per-page <number>`: 设置每页显示的章节数量（5-100）
- `--set-lines-per-page <number>`: 设置每页显示的行数（10-100）
- `--set-font-size <number>`: 设置字体大小（8-32）

**配置同步**：settings命令支持将配置保存到WebDAV，实现跨设备同步。您可以在一台设备上设置好阅读偏好，然后在其他设备上同步这些设置。

```bash
# 显示当前配置
txread settings

# 设置每页显示50个章节
txread settings --set-chapters-per-page 50

# 设置每页显示30行
txread settings --set-lines-per-page 30

# 设置字体大小为16
txread settings --set-font-size 16

# 上传配置到WebDAV
txread settings --upload

# 从WebDAV同步配置
txread settings --sync
```

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
git clone https://github.com/snowkei/txread.git
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

详细的版本更新日志请查看 [CHANGELOG.md](./CHANGELOG.md) 文件。
