# 🪟 智能文件管理器：macOS 到 Windows 跨平台移植技术说明书

## （小白也能看懂的系统化移植指南）

---

> **写在前面**：由于本项目前端基于 **React 18**，底层基于 **Tauri 2.0 + Rust**，整体架构天然具备非常优秀的跨平台基因。
> 目前代码中只有少数功能调用了 macOS 特有的系统接口（例如 Apple Vision OCR、Finder 文件定位、Mac 最近文件记录等）。
> 只要将这几个“macOS 专用零部件”替换为“Windows 专用零部件”或“跨平台通用零部件”，就能完美实现 Windows 系统的原生运行！

---

## 目录

- [一、 跨平台移植的核心原理（通俗比喻）](#一-跨平台移植的核心原理通俗比喻)
- [二、 目前代码中依赖 macOS 的“硬骨头”全盘摸底](#二-目前代码中依赖-macos-的硬骨头全盘摸底)
- [三、 改造四大核心差异的技术路线（Mac 零部件 ➔ Win 零部件）](#三-改造四大核心差异的技术路线mac-零部件--win-零部件)
  - [1. 文件定位与打开 (Finder ➔ Explorer)](#1-文件定位与打开-finder--explorer)
  - [2. 图片 OCR 识别 (Apple Vision ➔ Windows Media OCR / 跨平台库)](#2-图片-ocr-识别-apple-vision--windows-media-ocr--跨平台库)
  - [3. 最近使用文件记录 (sfltool ➔ Windows Recent 快捷方式)](#3-最近使用文件记录-sfltool--windows-recent-快捷方式)
  - [4. 路径斜杠与盘符 (Mac / ➔ Windows C:\)](#4-路径斜杠与盘符-mac---windows-c)
- [四、 推荐的跨平台条件编译代码结构 (`#[cfg]` 机制)](#四-推荐的跨平台条件编译代码结构-cfg-机制)
- [五、 Windows 端打包发布与 CI/CD 流程](#五-windows-端打包发布与-cicd-流程)
- [六、 总结与逐步实施路线图](#六-总结与逐步实施路线图)

---

## 一、 跨平台移植的核心原理（通俗比喻）

如果你把《智能文件管理器》想象成一辆汽车：

- **车身外壳与中控台（前端 React）**：不管开在 Mac 的路上还是 Windows 的路上，仪表盘、按钮、标签页、多栏视图界面是 100% 通用的，不需要重新设计。
- **发动机（Rust 核心逻辑 + SQLite 向量库）**：Rust 语言天然支持跨平台编译，数据库、BM25 搜索、向量匹配在 Windows 下完全一样运行。
- **特定轮胎与底盘接口（macOS 特有 API）**：比如 Mac 的“防滑雪地胎”（Apple Vision OCR）、“Mac 专用转向轴”（macOS Finder 关联）。移植到 Windows 时，我们只需要为 Windows 装上“公路胎”（Windows API），车子就能顺畅地在 Windows 上飞驰。

---

## 二、 目前代码中依赖 macOS 的“硬骨头”全盘摸底

在当前源码中，共有 **4 个地方** 专门使用了 macOS 的专有技术，需要进行 Windows 适配：

| 序号        | 模块名称                | 当前 macOS 实现                                                 | Windows 平台对应实现                                          |            移植难度            |
| :---------- | :---------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------ | :-----------------------------: |
| **1** | **文件定位**      | 调用`open -R` 或 macOS Cocoa `NSWorkspace` 在 Finder 中定位 | 调用`explorer.exe /select,"C:\path\to\file"`                |        🟢 简单 (10分钟)        |
| **2** | **文件路径格式**  | UNIX 格式（如`/Users/superli/Desktop`）                       | Windows 盘符格式（如`C:\Users\superli\Desktop`）            | 🟢 简单 (Rust PathBuf 自动兼容) |
| **3** | **最近文件记录**  | 调用 macOS`sfltool` 读取系统 Bookmarkplist                    | 读取 Windows`APPDATA\Microsoft\Windows\Recent`              |        🟡 中等 (半小时)        |
| **4** | **图片 OCR 识别** | 调用 macOS Objective-C`mac_ocr.m` (Apple Vision)              | 调用 Windows 10/11 原生`Windows.Media.Ocr` 或轻量跨平台引擎 |       🟠 稍有挑战 (1小时)       |

---

## 三、 改造四大核心差异的技术路线（Mac 零部件 ➔ Win 零部件）

### 1. 文件定位与打开 (Finder ➔ Explorer)

- **macOS 当前做法**：
  Rust 之后端执行 Shell 命令 `open -R <file_path>`，系统会自动弹出 Finder 并高亮选中该文件。
- **Windows 改造方案**：
  在 Windows 下，执行 Windows 自带的资源管理器指令：
  ```rust
  // Windows 专属指令
  std::process::Command::new("explorer")
      .arg("/select,")
      .arg(path)
      .spawn();
  ```
- **效果**：在 Windows 上点击“定位”，会自动弹出 **Windows 资源管理器** 并在文件夹里高亮选中该文件。

---

### 2. 图片 OCR 识别 (Apple Vision ➔ Windows Native / Ort)

- **macOS 当前做法**：
  使用 `mac_ocr.m` 文件，借由 macOS 内置的 Apple Vision 深度学习框架识别图片文字。
- **Windows 改造方案（二选一）**：
  - **方案 A（推荐，无第三方依赖）**：调用 Windows 10/11 操作系统原生内置的 `Windows.Media.Ocr` API（Windows 自带 OCR 引擎，识别率极高且无需额外下载安装包）。
  - **方案 B（通用方案）**：使用纯 Rust 跨平台 ONNX 引擎（`ort`）或 Tesseract。
- **效果**：Windows 下的图片（发票截图、截屏、文档图片）同样能在本地秒级提取出文本文字用于语义搜索。

---

### 3. 最近使用文件记录 (sfltool ➔ Windows Recent)

- **macOS 当前做法**：
  调用 macOS `sfltool dump-bookmark` 提取系统最近打开的文件记录。
- **Windows 改造方案**：
  Windows 系统会自动将用户最近打开过的文件快捷方式存放在目录：
  `C:\Users\<用户名>\AppData\Roaming\Microsoft\Windows\Recent`
  在 Rust 中读取该目录下的快捷方式文件（`.lnk`），解析出真实的源文件路径即可。

---

### 4. 路径斜杠与盘符 (Mac `/` ➔ Windows `C:\`)

- **macOS 当前做法**：路径使用正斜杠 `/`（例如 `/Users/superli/Downloads`）。
- **Windows 改造方案**：
  - 在 Rust 后端：使用 Rust 官方推荐的 `std::path::Path` / `PathBuf`，Rust 会在编译时**自动根据操作系统将斜杠切换为 `\` 或 `/`**，无需人工硬编码！
  - 在 React 前端：默认预设目录由 `~/Desktop` 调整为Windows 环境变量 `USERPROFILE\Desktop`（例如 `C:\Users\Username\Desktop`）。系统还可增加 `C:\`、`D:\` 盘符快速导航入口。

---

## 四、 推荐的跨平台条件编译代码结构 (`#[cfg]` 机制)

Rust 语言提供了一个极为优雅的机制叫 **系统条件编译 (`#[cfg]`)**。
这意味着我们可以把 Mac 的代码和 Windows 的代码写在同一个项目里，Rust 会根据你在哪种系统上打包，自动挑选对应的代码，零冗余！

### 示例代码结构概念：

```rust
// 1. 文件定位函数：根据系统自动分支
#[cfg(target_os = "macos")]
pub fn reveal_in_file_manager(path: &str) {
    // macOS 执行 open -R
    std::process::Command::new("open").arg("-R").arg(path).spawn().ok();
}

#[cfg(target_os = "windows")]
pub fn reveal_in_file_manager(path: &str) {
    // Windows 执行 explorer /select,
    std::process::Command::new("explorer").arg(format!("/select,\"{}\"", path)).spawn().ok();
}

// 2. OCR 图片文本提取函数：根据系统自动分支
#[cfg(target_os = "macos")]
pub fn perform_ocr(image_path: &str) -> String {
    // 调用 Apple Vision (mac_ocr.m)
    call_apple_vision_ocr(image_path)
}

#[cfg(target_os = "windows")]
pub fn perform_ocr(image_path: &str) -> String {
    // 调用 Windows.Media.Ocr
    call_windows_media_ocr(image_path)
}
```

这种架构的好处是：**Mac 和 Windows 共享 95% 的核心逻辑**，只有 5% 的特定底层接口根据系统自动切换！

---

## 五、 Windows 端打包发布与 CI/CD 流程

在 Windows 电脑上（或者使用 GitHub Actions 云端）：

1. **一键生成 Windows 安装包**：
   运行命令：

   ```bash
   npm run tauri build
   ```

   Tauri 会自动在 Windows 上生成：

   - **`.msi` 安装包**（Windows 标准安装向导）
   - **`.exe` 安装包**（Setup 可执行文件）
2. **GitHub Actions 自动化双端构建**：
   可以配置 GitHub Actions 脚本，当你给仓库打 Tag 时：

   - GitHub 的 Mac 服务器帮你打出 `.dmg` 包；
   - GitHub 的 Windows 服务器帮你打出 `.msi` / `.exe` 包；
   - 自动合并挂载到 GitHub Releases 页面，实现 **Mac / Windows 用户同时一键下载各自系统的安装包**！

---

## 六、 总结与逐步实施路线图

如果你未来打算正式开启 Windows 端适配，可以按照以下 **4 步顺畅推进**：

1. **第一步（准备）**：在 Rust `lib.rs` 中引入 `#[cfg(target_os = "windows")]` 条件编译骨架；
2. **第二步（底层替换）**：将 `reveal_in_finder` 适配 Windows `explorer`，盘符目录兼容；
3. **第三步（OCR与历史适配）**：接入 Windows `Windows.Media.Ocr` API 替换 Mac 的 `mac_ocr.m`；
4. **第四步（构建测试）**：在 Windows 环境或 GitHub Actions 下执行 `npm run tauri build`，产出 `.exe` / `.msi` 安装包。

*说明书编写完成。目前全量代码保持不变，随时可按此路线图开展跨平台移植。*
