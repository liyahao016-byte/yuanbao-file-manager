# 深化文件夹与真实文件系统映射 (Implementation Plan)

该计划旨在彻底打通软件的前五个核心 Tab (最近、下载、桌面、微信/常用沟通工具、此电脑) 与 Mac 真实文件系统的关联，替换掉之前剩余的前端 Mock 和过滤逻辑。

## User Review Required

> [!IMPORTANT]
> **关于“最近 (Recent)” Tab 的定义**：
> 目前的规划是记录**用户在本软件中双击/预览打开过的文件**，只有在应用内操作过的文件才会出现在“最近”列表中，并按时间倒序。这是为了符合您“在该app中操作的文件”的需求。
> 
> **关于“此电脑 (This PC)” 的根目录**：
> 默认从 Mac 的根硬盘 `/` 开始向下浏览，类似于 Finder 最底层的 Macintosh HD。

## Open Questions

无。

## Proposed Changes

### 1. Database & Tracking (Backend)

#### [MODIFY] [lib.rs](file:///Users/superli/Desktop/aiwork/%E6%96%87%E4%BB%B6%E7%AE%A1%E7%90%86%E5%99%A8demo/src-tauri/src/lib.rs)
- **新增命令 `record_recent_file`**: 提供给前端调用，当文件被双击打开时，记录其路径和当前时间戳到 SQLite。
- **扩展 `get_files` 支持系统宏路径**:
  - `dirPath == "sys:downloads"` -> 映射至 `dirs::download_dir()`
  - `dirPath == "sys:desktop"` -> 映射至 `dirs::desktop_dir()`
  - `dirPath == "sys:recent"` -> 执行 `SELECT` 联表查询 `recent_files` 按照时间倒序返回。
- **新增命令 `read_dir_shallow`**: 用于“此电脑” (FinderView) 的单层级目录遍历。为了保证性能，该命令不递归，仅读取指定目录的子文件夹和文件。

#### [MODIFY] [db.rs](file:///Users/superli/Desktop/aiwork/%E6%96%87%E4%BB%B6%E7%AE%A1%E7%90%86%E5%99%A8demo/src-tauri/src/db.rs)
- 在 `init_db` 中新建表 `CREATE TABLE IF NOT EXISTS recent_files (path TEXT PRIMARY KEY, last_operated_at INTEGER NOT NULL)`。

### 2. Frontend Views (UI)

#### [MODIFY] [FileListView.jsx](file:///Users/superli/Desktop/aiwork/%E6%96%87%E4%BB%B6%E7%AE%A1%E7%90%86%E5%99%A8demo/src/components/FileListView.jsx)
- 根据传入的 `category` 决定传给 `get_files` 的 `dirPath` (`sys:recent`, `sys:downloads`, `sys:desktop` 或 workspace)。
- `category === 'wechat' || 'qq'` 强行置空。
- `category === 'recent'` 若数据为空，居中渲染浅色文字：“暂时没有最近操作过的文件”。
- 在 `handleDoubleClick` 中加入 `invoke('record_recent_file', { path })` 的调用以记录操作。

#### [MODIFY] [FinderView.jsx](file:///Users/superli/Desktop/aiwork/%E6%96%87%E4%BB%B6%E7%AE%A1%E7%90%86%E5%99%A8demo/src/components/FinderView.jsx)
- **移除硬编码 `fsData`**。
- 将状态改造为 `columns: [{ path: '/', items: [] }]`。
- 组件挂载时调用 `read_dir_shallow('/')` 获取硬盘根目录。
- 点击 `folder` 类型的项时，通过 `read_dir_shallow(item.path)` 获取子层级内容并追加到 `columns` 数组中，实现真正的 Mac 层级浏览。

## Verification Plan

### Automated Tests
- 无。

### Manual Verification
1. 启动应用，点击“下载”和“桌面”，验证是否能够正确展示真实的系统文件夹内容。
2. 点击“此电脑”，从根目录开始逐层点击文件夹，验证能否顺畅进入深层目录。
3. 双击打开任意几个文件，然后切换到“最近” Tab，验证文件是否按时间倒序排列出现。
4. 点击“微信/常用沟通工具”，验证是否出现空状态提示。
