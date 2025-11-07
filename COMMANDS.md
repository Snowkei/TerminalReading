# txread 操作命令文档

## 概述

txread 是一个支持WebDAV同步的终端txt文件阅读器，可以在终端中舒适地阅读txt文件，并自动记录阅读进度。

## 命令列表

### 1. config - 配置WebDAV连接

配置与WebDAV服务器的连接信息。

#### 语法
```bash
npm start -- config [options]
```

#### 选项
- `-u, --username <username>`: WebDAV用户名
- `-p, --password <password>`: WebDAV密码
- `-l, --url <url>`: WebDAV服务器URL

#### 示例
```bash
# 使用选项直接配置
npm start -- config -u myusername -p mypassword -l https://dav.jianguoyun.com/dav/

# 交互式配置（不提供选项）
npm start -- config
```

#### 说明
如果不提供选项，程序将通过交互式提示输入配置信息。配置信息将保存在本地，后续命令会自动使用。

---

### 2. upload - 上传文件

将本地文件或目录上传到WebDAV服务器。

#### 语法
```bash
npm start -- upload -p <远程路径> -t <本地文件或目录>
```

#### 选项
- `-p, --path <path>`: 远程路径（必需）
- `-t, --target <target>`: 本地文件或目录路径（必需）

#### 示例
```bash
# 上传单个文件到根目录
npm start -- upload -p / -t "/path/to/local/file.txt"

# 上传单个文件到指定目录
npm start -- upload -p /books/ -t "/path/to/local/novel.txt"

# 上传整个目录
npm start -- upload -p /documents/ -t "/path/to/local/directory/"
```

#### 说明
- 如果是目录，将递归上传目录中的所有文件
- 远程路径如果不存在，会自动创建
- 上传成功后会显示成功和失败的文件数量

---

### 3. list - 文件列表

获取WebDAV服务器上的文件列表，并显示阅读进度。

#### 语法
```bash
npm start -- list [options]
```

#### 选项
- `-p, --path <path>`: 远程路径（可选，默认：/）

#### 示例
```bash
# 列出根目录下的文件
npm start -- list

# 列出指定目录下的文件
npm start -- list -p /books/

# 列出嵌套目录下的文件
npm start -- list -p /documents/novels/
```

#### 说明
- 显示文件ID、文件名、大小、最后修改时间和阅读进度
- 阅读进度状态包括：未开始、进行中、已完成
- 支持中文文件名显示
- 文件ID可用于快速选择文件，例如：`npm start -- use 1`

---

### 4. use - 选择文件

选择要阅读的文件，下载到本地缓存。

#### 语法
```bash
npm start -- use <filename_or_id>
```

#### 参数
- `filename_or_id`: 文件名或文件ID（必需）

#### 示例
```bash
# 使用文件名选择文件
npm start -- use "小说.txt"

# 使用文件ID选择文件（从list命令获取）
npm start -- use 1

# 选择包含特殊字符的文件名
npm start -- use "那货带去的景区能修仙考古！.txt"
```

#### 说明
- 文件可以从list命令输出的ID列获取
- 文件将从WebDAV服务器下载到本地缓存目录
- 下载完成后会显示上次阅读位置和阅读时间
- 选择文件后，可以使用look命令开始阅读
- 如果本地缓存文件不存在，会自动从服务器重新下载

---

### 5. review - 章节目录

解析文件，展示章节目录。

#### 语法
```bash
npm start -- review [filename_or_id]
```

#### 参数
- `filename_or_id`: 文件名或文件ID（可选，如果已使用use命令选择文件）

#### 示例
```bash
# 查看已选择文件的章节目录
npm start -- review

# 使用文件名查看章节目录
npm start -- review "小说.txt"

# 使用文件ID查看章节目录（从list命令获取）
npm start -- review 1
```

#### 说明
- 自动识别文件中的章节标题（通常以"第X章"开头）
- 显示章节ID和章节标题
- 章节ID可用于快速跳转到指定章节，例如：`npm start -- look 5`
- 可以查看文件的整体结构，方便导航

---

### 6. look - 开始阅读

启动阅读界面，开始阅读文件。

#### 语法
```bash
npm start -- look [chapter_or_id]
```

#### 参数
- `chapter_or_id`: 章节名称或章节ID（可选，如果不指定则从上次阅读位置或开头开始）

#### 示例
```bash
# 从上次阅读位置开始
npm start -- look

# 使用章节名称开始
npm start -- look "第一章"

# 使用章节ID开始（从review命令获取）
npm start -- look 5

# 从任意章节开始
npm start -- look "第十章 开始"
```

#### 说明
- 必须先使用use命令选择文件
- 章节ID可以从review命令输出的左侧列获取
- 阅读界面支持全屏显示，提供舒适的阅读体验
- 自动分页，适应终端窗口大小
- 支持章节导航和页码跳转

---

### 7. settings - 阅读设置

管理应用设置和配置，包括阅读参数和自定义快捷键。

#### 语法
```bash
npm start -- settings [options]
```

#### 选项
- `-s, --sync`: 从WebDAV同步配置
- `-u, --upload`: 上传配置到WebDAV
- `--show`: 显示当前配置
- `--set-chapters-per-page <number>`: 设置每页显示的章节数量 (5-100)
- `--set-lines-per-page <number>`: 设置每页显示的行数 (10-100)
- `--set-font-size <number>`: 设置字体大小 (8-32)
- `--set-clear-terminal <boolean>`: 设置翻页时是否清空终端 (true/false)
- `--set-prev-keys <keys>`: 设置上一章快捷键 (用逗号分隔，如: 1,up,[)
- `--set-next-keys <keys>`: 设置下一章快捷键 (用逗号分隔，如: 2,down,])
- `--set-exit-keys <keys>`: 设置退出快捷键 (用逗号分隔，如: q,ctrl+c)
- `--set-help-keys <keys>`: 设置帮助快捷键 (用逗号分隔，如: h,?)
- `--set-chapter-list-keys <keys>`: 设置章节列表快捷键 (用逗号分隔，如: g)

#### 示例
```bash
# 显示当前配置
npm start -- settings --show

# 设置每页显示行数
npm start -- settings --set-lines-per-page 30

# 设置翻页时不清空终端
npm start -- settings --set-clear-terminal false

# 设置自定义快捷键
npm start -- settings --set-prev-keys w
npm start -- settings --set-next-keys e

# 设置多个快捷键
npm start -- settings --set-prev-keys 1,up,[
npm start -- settings --set-next-keys 2,down,]

# 同步配置到WebDAV
npm start -- settings --upload

# 从WebDAV同步配置
npm start -- settings --sync
```

#### 说明
- 所有设置都会自动保存到本地配置文件
- 配置可以上传到WebDAV服务器，实现多设备同步
- 快捷键设置支持多个按键，用逗号分隔
- 有效的上一章快捷键：1, up, [
- 有效的下一章快捷键：2, down, ]
- 有效的退出快捷键：q, ctrl+c
- 有效的帮助快捷键：h, ?
- 有效的章节列表快捷键：g

---

### 8. help - 帮助信息

显示帮助信息。

#### 语法
```bash
npm start -- help
```

#### 示例
```bash
# 显示帮助信息
npm start -- help
```

#### 说明
- 显示所有可用命令及其简要说明
- 提供基本使用方法指导

---

## 阅读器快捷键

在阅读界面中，可以使用以下快捷键：

### 基本导航
- `q` 或 `Ctrl+C`: 退出阅读器
- `1` 或 `←`: 上一页
- `2` 或 `→` 或 `空格`: 下一页

### 章节导航
- `↑` 或 `[`: 上一章
- `↓` 或 `]`: 下一章

### 辅助功能
- `g`: 显示章节列表，可按数字键跳转到对应章节
- `h` 或 `?`: 显示帮助信息

### 说明
- 所有快捷键操作都会自动保存阅读进度
- 退出阅读器时，进度会自动同步到WebDAV服务器
- 支持跨设备阅读进度同步
- 快捷键可以通过settings命令自定义，例如：`npm start -- settings --set-prev-keys w`

---

### 首次使用
1. 配置WebDAV连接：
   ```bash
   npm start -- config -u 用户名 -p 密码 -l https://your-webdav-server.com/dav/
   ```

2. 上传本地文件：
   ```bash
   npm start -- upload -p / -t "/path/to/your/book.txt"
   ```

3. 查看文件列表：
   ```bash
   npm start -- list
   ```

4. 选择要阅读的文件：
   ```bash
   npm start -- use "book.txt"
   ```

5. 自定义阅读设置（可选）：
   ```bash
   npm start -- settings --show
   npm start -- settings --set-lines-per-page 30
   npm start -- settings --set-prev-keys w
   ```

6. 查看章节目录：
   ```bash
   npm start -- review
   ```

7. 开始阅读：
   ```bash
   npm start -- look
   ```

### 日常阅读
1. 查看文件列表和进度：
   ```bash
   npm start -- list
   ```

2. 选择要继续阅读的文件：
   ```bash
   npm start -- use "book.txt"
   ```

3. 从上次位置继续阅读：
   ```bash
   npm start -- look
   ```

### 上传新书
1. 上传新书：
   ```bash
   npm start -- upload -p / -t "/path/to/new/book.txt"
   ```

2. 选择新书：
   ```bash
   npm start -- use "book.txt"
   ```

3. 开始阅读：
   ```bash
   npm start -- look
   ```

---

## 注意事项

1. **文件路径**: 使用npm start时，需要在命令和参数之间添加`--`分隔符，确保参数被正确传递：
   ```bash
   npm start -- upload -p / -t "/path/to/file.txt"
   ```

2. **文件名**: 如果文件名包含空格或特殊字符，请使用引号括起来：
   ```bash
   npm start -- use "我的小说.txt"
   ```

3. **WebDAV路径**: 上传到根目录时，使用`/`作为路径：
   ```bash
   npm start -- upload -p / -t "/path/to/file.txt"
   ```

4. **阅读进度**: 阅读进度会自动保存和同步，无需手动操作。

5. **网络连接**: 使用WebDAV功能时，请确保网络连接正常。

---

## 故障排除

### 常见问题

1. **命令参数错误**
   - 确保使用`--`分隔符
   - 检查必需参数是否提供

2. **文件上传失败**
   - 检查WebDAV配置是否正确
   - 确认网络连接正常
   - 验证文件路径是否存在

3. **文件列表为空**
   - 确认远程路径是否正确
   - 检查WebDAV服务器是否可访问

4. **阅读界面显示异常**
   - 尝试重新选择文件
   - 检查文件编码是否为UTF-8

### 获取帮助

如果遇到问题，可以使用以下命令获取帮助：
```bash
npm start -- help
```

---

## 兼容的WebDAV服务

txread支持任何标准的WebDAV服务，以下是一些常用的WebDAV服务：

- 坚果云
- Nextcloud
- ownCloud
- 其他支持WebDAV的云存储服务

配置不同服务时，请参考相应服务的WebDAV连接文档获取正确的URL和认证信息。