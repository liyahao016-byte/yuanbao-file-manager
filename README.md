# 🚀 元宝文件管理器 (Yuanbao File Manager)

> **基于 Tauri 2.0 + Rust 底层引擎与 React 18 现代前端打造的下一代 AI 智能桌面文件管理与资产检索系统**。

[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![Rust Engine](https://img.shields.io/badge/Rust-Core-orange.svg)](https://www.rust-lang.org/)
[![Local First](https://img.shields.io/badge/Privacy-100%25%20Local-green.svg)](#-100-端侧隐私与极致性能)
[![Release](https://img.shields.io/badge/Download-macOS%20.dmg-brightgreen.svg)](https://github.com/liyahao016-byte/yuanbao-file-manager/releases)

---

## 🌟 核心亮点功能

### 1. 🤖 AI 智能全景聚类与自然语言动态建簇
- **全自动语义分类**：全盘资产自动归集为格式速查（图片、文档、表格、媒体）及 9 大预设场景簇（`求职简历`、`合同协议`、`财务发票`、`方案报告`、`数据报表`、`设计素材`、`学习备考`、`影音媒体`、`代码工程`）。
- **自然语言 AI 动态建簇**：在顶部搜索框输入任何主题（如“西财期末复习”、“股票分析”），全盘匹配正文与 AI 摘要，≥ 1 匹配即在首屏动态挂载生成专属簇。

### 2. ⚡️ BM25 + 向量混合检索 (Hybrid Search)
- **语义理解**：基于 BM25 文本精准匹配与 `sqlite-vec` 向量余弦相似度融合算分，搜“求职”自动关联匹配“简历.docx”，搜“报销”自动关联匹配“发票.pdf”。
- **匹配线索透明化**：结果中清楚显示命中原因（`命中文件名`、`命中文档正文`、`命中图片OCR`、`命中语义概念`）。

### 3. 🖥️ 多标签页与上下双视图分屏 (SplitView)
- **Chrome 式多 Tab 机制**：支持新建 `+` 标签页、拖拽与关闭，任何搜索自动开启新 Tab。
- **独立双 TabBar 上下分屏**：上下半屏各自拥有独立的自包含标签页栏，上栏开“最近文件”，下栏开“下载”，直接在两栏之间进行跨目录直观拖拽移动。

### 4. 📦 浮动收纳盘与 AI 智能打包命名
- **随手收纳**：将分散在各处的文件拖入右下角暂存收纳盘。
- **AI 智能打包**：一键分析暂存区文件的公共主题特征，推荐聚合文件夹名称，自动创建目录并将文件迁移入内。

### 5. 🔒 100% 端侧隐私与极致性能
- 本地嵌入 `sqlite-vec` 向量索引，文件解析与语义计算 100% 在本地完成，零数据上云。基于 Tauri 2.0 + Rust 异步驱动，较传统 Electron 应用节省 90% 内存。

---

## 🏛️ 详细白皮书与产品报告
详细的产品架构、算法公式、四大区域布局拆解与路演演说大纲请查阅：
📄 [元宝文件管理器_产品功能白皮书与路演汇报报告.md](docs/元宝文件管理器_产品功能白皮书与路演汇报报告.md)

---

## 🛠️ 本地开发指南 (Quick Start)

### 前置要求
- Node.js >= 18
- Rust 工具链 (`rustc`, `cargo`)

### 运行步骤
```bash
# 1. 克隆项目
git clone https://github.com/liyahao016-byte/yuanbao-file-manager.git
cd yuanbao-file-manager

# 2. 安装前端依赖
npm install

# 3. 启动桌面端开发环境
npm run tauri dev
```

### 构建打包
```bash
npm run tauri build
```
打包好的 `.dmg` 安装文件将存放在 `src-tauri/target/release/bundle/dmg/` 路径下。

---

## 📄 开源许可
MIT License © 2026 元宝文件管理器团队

