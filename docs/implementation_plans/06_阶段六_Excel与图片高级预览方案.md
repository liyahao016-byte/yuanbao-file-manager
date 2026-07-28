# 阶段六实施方案：Excel 表格与图片高级预览模块

## 1. 架构目标
- **Excel 网格化预览**：通过 Rust `calamine` crate 毫秒级抓取 `.xls` / `.xlsx` / `.csv` 的多 Sheet 选项卡与单元格矩阵，前端使用可交互网格组件呈现在线表格预览。
- **图片高级预览 & 格式拓展**：支持滚轮缩放、旋转、HEIC/PSD 特殊格式离线转码渲染，并结合本地 Apple Vision OCR 实现图片内文字划词复制。

## 2. 计划步骤
- [ ] 在 `src-tauri/Cargo.toml` 中添加 `calamine` 依赖。
- [ ] 在 `src-tauri/src/lib.rs` 中新增 `parse_excel_preview` Tauri 指令。
- [ ] 创建前端 `ExcelPreviewView.jsx` 实现 Sheet 切页与 Excel 表格渲染。
- [ ] 在 `PreviewerView.jsx` 中增加图片控制栏（缩放/旋转/OCR文本抽取）。
