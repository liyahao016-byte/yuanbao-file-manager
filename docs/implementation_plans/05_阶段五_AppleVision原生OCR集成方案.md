# 阶段五实施方案：macOS 原生 Apple Vision 本地 OCR 模块

## 1. 架构目标
解决纯图片扫描件 PDF（如 `14.pdf`）以及图像资产无文本数据流导致 AI 命名退回为 `14_pdf` 的问题。实现零包体积增加 (+0MB)、零 API 费用与超高速本地 OCR。

## 2. 完成点
- [x] 创建原生 Objective-C 模块 `src-tauri/src/mac_ocr.m`，连接 macOS 系统 `Vision.framework` (`VNRecognizeTextRequest`)。
- [x] 在 `src-tauri/build.rs` 中通过 `cc` 编译器构建 `mac_ocr.m` 并自动链接 `Vision`, `PDFKit`, `CoreGraphics`, `AppKit` 框架。
- [x] 在 `src-tauri/src/file_parser.rs` 中实现智能降级识别：矢量 PDF 快速解析；图片 PDF / 图像资产自动调用 Apple Vision OCR。
- [x] 在 `rename_with_ai` 中增加父目录语义上下文注入与扫描件特征标记。
- [x] 完成 `file_parser::tests::test_scan_pdf_ocr` 自动化单元测试，对扫描件 `14.pdf` 在 1.49s 内精准提取出正文。
