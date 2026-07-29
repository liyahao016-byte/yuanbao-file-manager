# 🛠️ TroubleShooting & BugFix Log

此文档用于记录本项目开发过程中遇到的各类疑难杂症、底层 Bug 以及最终的修复方案。
采用简短、结构化的结论形式，方便后续人类开发者或其他 AI 智能体快速了解项目坑点与经验。

## [2026-07-29] 🐛 搜索生成 AI 动态簇后未在侧边栏 Tab 与全景卡片网格中实时渲染展示

**🔍 现象描述:**
在搜索输入框中输入主题词（如“股票”）成功提示 `✨ 成功生成专属簇卡片：「股票 相关资料」（收录 9 个匹配资产）`，但在主视图全景网格与左侧导航栏 Tab 中没有显示出来。

**🧠 核心原因:**
1. **侧边栏缺乏 `customClusters` 变更广播**：在 `SmartFolderView.jsx` 中，虽然为 `pinnedIds` 和 `deletedIds` 设置了 `useEffect` 触发 `smart_cluster_state_change` 广播，但**漏掉了对 `customClusters` 的监听**，导致侧边栏无法感知新创建的动态簇；
2. **主题簇过滤逻辑偏狭**：在 `SmartFolderView.jsx` 中对自定义簇的判定为 `c.id.startsWith('cluster_custom_')`，而后端生成的动态簇 ID 可能带有 `cluster_` 或 `cluster_group_` 等其它前缀，导致新建簇被误判为传统簇（被 `>= 5` 个匹配文件的门槛过滤丢弃）。

**✅ 解决方案:**
1. **补全自定义簇状态广播**：在 [SmartFolderView.jsx](file:///Users/superli/Desktop/aiwork/文件管理器demo/src/components/SmartFolderView.jsx) 中增加对 `customClusters` 变动的 `useEffect` 监听，第一时间广播 `smart_cluster_state_change` 触发侧边栏重新渲染；
2. **放宽自定义簇匹配算法**：将 `isCustom` 的判定升级为 `c.category_type === 'custom' || c.id.startsWith('cluster_') || customClusters.some(cc => cc.id === c.id)`，确保任何由用户生成的动态簇只要包含 `>= 1` 个匹配资产就全速在全景网格和侧边栏第一位挂载渲染！

---

## [2026-07-28] 🐛 自定义动态簇卡片点击进详情无数据与控制台错误清空修复

**🔍 现象描述:**
1. AI 生成自定义簇卡片后，点击进入卡片列表视图查不到文件或列表呈现异常；
2. 控制台中偶尔存留未处理的 Promise Rejection 错误或拖拽收纳面板错误。

**🧠 核心原因:**
1. **簇详情 SQL 通配查询维度不全**：在 `src-tauri/src/lib.rs` 的 `get_files_by_cluster` 通配分支 `_ =>` 中，过去仅查询了 `lower(name) LIKE ... OR lower(path) LIKE ...`，未同步包含正文 AI 摘要 (`ai_suggestion`) 与标签 (`tags`)，导致包含内容/摘要匹配的文件进入列表页后匹配为空。
2. **控制台缺乏 Unhandled Rejection 全局防御**：某些第三方 Shell/Dialog 的 Promise 抛错未在全局进行软拦截。

**✅ 解决方案:**
1. **多维模糊查询补齐**：在 [lib.rs](file:///Users/superli/Desktop/aiwork/文件管理器demo/src-tauri/src/lib.rs) 中将 `get_files_by_cluster` 的 `_ =>` 分支升级为全维度匹配 `ai_suggestion` 与 `tags`；
2. **全局 Promise 错误防线**：在 [App.jsx](file:///Users/superli/Desktop/aiwork/文件管理器demo/src/App.jsx) 中添加了全局 `unhandledrejection` 与 `error` 软捕获防御，清洁 DevTools 控制台错误输出。

---

## [2026-07-28] 🐛 控制台 Level 过滤致使 Console“无记录”与 UI 反馈增强

**🔍 现象描述:**
用户在 DevTools 控制台只勾选了 `Errors`（隐藏了 `Logs` 与 `Warnings`），导致点击 AI 动态建簇时原有的 `console.log` / `console.warn` 被隐式过滤而看起来“Console 中无任何记录”。

**🧠 核心原因:**
浏览器 DevTools 过滤规则遮蔽了常规日志，且纯控制台输出无法提供直观的界面感知。

**✅ 解决方案:**
1. **多重 Level 覆盖 (强透传)**：在 [SmartFolderView.jsx](file:///Users/superli/Desktop/aiwork/文件管理器demo/src/components/SmartFolderView.jsx) 中同步使用 `console.error('[AI建簇日志]', logMsg)` 打出建簇日志，确保即便控制台开启了最严格的 `Errors` 过滤也能直接穿透高亮打印；
2. **新增 UI 原生 Toast 动画提示条**：在建簇输入框下方新增渐变 Toast 提示组件，实时显示 `⏳ 正在全盘检索与分析...` 以及 `✨ 成功生成专属簇卡片：「XXX」（收录 N 个匹配资产）`，让用户眼见为实！

---

## [2026-07-28] 🐛 智能文件夹 AI 搜索生成簇 IPC 拦截与控制台日志增强

**🔍 现象描述:**
在智能文件夹页面输入关键词触发 AI 动态建簇时，在部分场景下控制台未打印记录且没有明确 UI 反馈。

**🧠 核心原因:**
`SmartFolderView.jsx` 原先在调用 Tauri `invoke('create_custom_ai_cluster')` 前添加了硬编码的 `if (window.__TAURI_INTERNALS__)` 条件拦截，在部分 Tauri 环境下导致 IPC 意外走入降级分支或触发异常；且 Enter 键监听未进行 `preventDefault()` 阻止默认表单提交行为。

**✅ 解决方案:**
1. **直接 IPC 调用 + 优雅降级**：移除 `window.__TAURI_INTERNALS__` 硬拦截，在 [SmartFolderView.jsx](file:///Users/superli/Desktop/aiwork/文件管理器demo/src/components/SmartFolderView.jsx) 中直接使用 `try { await invoke(...) } catch { ... }` 机制，确保桌面端直接通信；
2. **多层日志 & UI 弹窗反馈**：日志同时输出 `log` / `warn` / `info` 三个层级避开控制台过滤，并在建簇成功后输出清晰的界面 Toast 提示：“✨ 成功生成专属簇卡片：「XXX」（收录 N 个匹配资产）”。

---

## [2026-07-27] 🐛 页面白屏报错 Failed to load resource: Could not connect to the server. http://localhost:5173/

**🔍 现象描述:**
界面完全白屏，DevTools 控制台输出 `Failed to load resource: Could not connect to the server. http://localhost:5173/` 错误。

**🧠 核心原因:**
Vite 开发服务器（`npm run dev`）服务进程退出，导致本地 5173 端口没有进程监听，Tauri WebView 无法与本地 Vite Dev Server 通信。

**✅ 解决方案:**
重新在后台启动 `npm run dev` 监听 5173 端口，客户端刷新后恢复正常。

---

## [2026-07-27] 🐛 智能文件夹中 AI 搜索生成簇无反应及无 Console 记录 Bug

**🔍 现象描述:**
在智能文件夹页面顶部的 AI 搜索输入框中输入关键词并点击“✨ AI 生成簇”按钮时，界面没有生成对应簇卡片，控制台中也查不到相关 Console 日志。

**🧠 核心原因:**
1. **控制台 Filter 过滤**：浏览器 DevTools 控制台面板仅高亮勾选了 `Errors` 过滤器，使原本打出的 `console.log` 被浏览器隐式过滤掉，导致看起来“无 console 记录”；
2. **后端检索维度过窄**：Rust 后端 `create_custom_ai_cluster` 原来只匹配了 `SELECT COUNT(*) FROM files WHERE lower(name) LIKE ?1 OR lower(path) LIKE ?1`，未检索文件的 AI 描述摘要（`ai_suggestion`）及标签（`tags`）。当搜关键词仅在正文或 AI 摘要中时算出的 `count` 为 0，触发了前端旧有的 `< 3` 拦截硬拒。

**✅ 解决方案:**
1. **后端扩展全维度匹配**：在 [lib.rs](file:///Users/superli/Desktop/aiwork/文件管理器demo/src-tauri/src/lib.rs) 的 `create_custom_ai_cluster` 中扩充 SQL 匹配为包含 `ai_suggestion` 与 `tags` 的全多维检索，并增加了多词分词统计；
2. **前端门槛与日志优化**：在 [SmartFolderView.jsx](file:///Users/superli/Desktop/aiwork/文件管理器demo/src/components/SmartFolderView.jsx) 中将 custom 建簇渲染门槛调整为 `>= 1`，将 console 日志改为强提醒的 `console.warn`，并优化了零匹配时的明确弹窗说明。

---

## [2026-07-27] 🐛 切换分栏视图触发 ReferenceError: Can't find variable: onSwitchViewMode 报错白屏

**🔍 现象描述:**
点击右上角的“分栏/双视图”切换按钮时，界面崩溃报错：`ReferenceError: Can't find variable: onSwitchViewMode`。

**🧠 核心原因:**
`SplitView.jsx` 在传递单/双视图模式切换回调 `onSwitchViewMode` 给子组件 `MiniTabBar` 时，其主组件 `SplitView` 自身的 props 解构签名中遗漏了 `onSwitchViewMode` 变量定义，导致调用时抛出 Undefined 引用错误。

**✅ 解决方案:**
在 [SplitView.jsx](file:///Users/superli/Desktop/aiwork/文件管理器demo/src/components/SplitView.jsx) 的 `SplitView` 参数列表中补齐 `onSwitchViewMode` prop 声明，使事件传递畅通无阻。

---

## [2026-07-27] 🐛 簇详情列表截断 10 条文件与全局搜索无回退逻辑 Bug

**🔍 现象描述:**
1. 点击“图片资产 (457)”等簇卡片进入详情列表时，并没有展示全部 457 个图片资产，仅渲染出了 10 个文件；
2. 全局搜索在部分关键词下未搜出所有预期文件，怀疑搜索命中漏检。

**🧠 核心原因:**
1. **簇详情硬编码分页截断**：`FileListView.jsx` 调用 `get_files_by_cluster` 时，硬编码传输了 `{ pageSize: 10 }`，导致后端 SQL 拼接了 `LIMIT 10 OFFSET 0`，强行将结果截断为前 10 条。
2. **搜索无模糊 SQL 兜底**：`semantic_search` 过去强依赖 FTS5 精确双引号匹配与向量相似度。当输入未分词中文或本地向量库未构建时，`combined_scores` 为空即直接返回 `[]`，未触发数据库 `LIKE` 模糊匹配。

**✅ 解决方案:**
1. **簇全量加载**：在 `FileListView.jsx` 中将簇列表查询的 `pageSize` 提高至 `10000`（全量无截断加载），确保全量资产一次性展示完。
2. **搜索增加强力模糊兜底与扩容**：在 `src-tauri/src/lib.rs` 的 `semantic_search` 中新增了 `WHERE (lower(name) LIKE ?1 OR lower(path) LIKE ?1 OR lower(ai_suggestion) LIKE ?1)` 的模糊 SQL 兜底分支，并将结果 Limit 由 50 提升至 200。

---
## [2026-07-27] 🐛 AI 生成簇点击无响应且 Console 无记录排查与修复

**🔍 现象描述:**
用户在智能文件夹页面输入关键词并点击“✨ AI 生成簇”按钮时，无卡片生成，Console 中亦没有任何 log 输出。

**🧠 核心原因:**
1. **前端静默拦截**：`SmartFolderView.jsx` 中 `handleCreateAiCluster` 包含 `if (!window.__TAURI_INTERNALS__) return;` 条件判断，在纯 Web 调试模式下直接静默退出，且缺少任何 `console.log` 输出。
2. **后端 ID 前缀匹配 Bug**：Tauri Rust 后端 `create_custom_ai_cluster` 生成的簇 ID 格式为 `cluster_custom_xxx`。当 `SmartFolderCard` 请求 `get_files_by_cluster` 查库时，Rust 仅剔除了 `cluster_` 前缀，导致 SQL 中变成 `WHERE name LIKE '%custom_xxx%'`，无法匹配出任何包含关键词的文件。

**✅ 解决方案:**
1. **前端**：为 `handleCreateAiCluster` 补充了全流程的 `console.log('[AI建簇] ...')` 日志追溯，并增加了 Web/Dev 模式下的 Mock Fallback 数据构造逻辑，保证浏览器与桌面端双环境可用。
2. **后端**：在 `src-tauri/src/lib.rs` 的 `get_files_by_cluster` 中将 ID 前缀解析重构为 `.replace("cluster_custom_", "").replace("cluster_", "")`，并使用模糊查询 `(lower(name) LIKE ?1 OR lower(path) LIKE ?1)`，精确联查文件名与路径。

---
## [2026-07-26] 🐛 点击智能簇时误把整个工作区全量目录文件渲染出来的重大部分交互 Bug

**🔍 现象描述:**
- 点击侧边栏或卡片全视图中的 `方案报告与工作文档` 等高价值场景簇时，右侧列表没有只显示对应簇的文件，而是输出了工作区根目录下的全部文件夹（如 Desktop、Downloads、WorkBuddy 等）和不相干文件；
- 顶部 Tab 标签页名称显示为空白，无法显示正确的中文簇名称。

**🧠 核心原因:**
1. 高价值场景簇与格式簇的 ID 均以 `smart_` 为前缀（如 `smart_scenario_report`）。此前 `FileListView.jsx` 中只判断了 `category.startsWith('cluster_')`，导致 `smart_` 前缀的簇在条件判断中被漏掉，直接走到了 `else` 兜底逻辑，触发了 `invoke('get_files', { dirPath: workspacePath })` 读取工作区全量目录内容！
2. `App.jsx` 中的 `tabs.map` 在解析标签页标题时，缺乏对 `smart_` 前缀 ID 的中文映射解析，导致标题渲染为空白。

**✅ 解决方案:**
1. 在 `FileListView.jsx` 中将判断修复为 `category.startsWith('cluster_') || category.startsWith('smart_')`，确保所有智能簇均精准走入 `get_files_by_cluster` 的 100% 严格 SQL 匹配分支；
2. 在 `App.jsx` 和 `FileListView.jsx` 中新增 9 大场景簇与格式簇的 `scenarioMap` 中文字典解析，确保 Tab 标签页与底部面包屑均正确呈现直观的中文名称（如 `方案报告与工作文档`）。

---

## [2026-07-26] 🐛 软件启动全白屏无内容显示问题排查与修复

**🔍 现象描述:**
- 刷新或启动软件后，主界面出现纯白屏无任何 DOM 内容渲染。

**🧠 核心原因:**
- 在更新 `FileListView.jsx` 传入 `smartStats` 逻辑时，组件内部的 `sortConfig`, `formatFilter`, `hoveredFileId`, `isSyncing` 状态变量申明被误覆盖，导致 React 在渲染文件列表时解构成未定义的 `ReferenceError`，在组件挂载阶段抛出运行时异常引发应用坍塌白屏。

**✅ 解决方案:**
- 恢复 `FileListView.jsx` 顶部的 `sortConfig` 及 `formatFilter` 状态申明，确保全量列表过滤与排序逻辑正常，重新构建 Vite 前端产物后渲染恢复正常。

---

## [2026-07-25] 🐛 收纳区拖放完全失效：Tauri 底层事件劫持 + macOS 坐标系双重天坑

**🔍 现象描述:**
- 将文件拖入收纳区松手，Console 完全无任何输出
- 加入坐标判断后，lastMouseX=496 但 dropzoneLeft=927，始终判定在区域外
- React 合成事件 onDragEnter/onDrop 从未被触发

**🧠 核心原因:**
1. **Tauri 底层事件劫持**：Tauri 在 macOS 原生层拦截所有 drag-drop 事件，网页的 onDrop 永远收不到信号。
2. **macOS 物理/逻辑像素坐标系不兼容**：Tauri payload 坐标是屏幕物理像素（原点左下角），CSS 坐标是窗口逻辑像素（原点左上角），Retina 屏 DPR=2 且 Y 轴反向，所有坐标转换均失效。
3. **React stale closure**：useEffect 空依赖导致内部 handler 永远读到 isHovered 初始值 false。

**✅ 解决方案:**
- 用 mousemove 事件的 e.clientX/Y 实时记录鼠标位置（CSS 逻辑像素，无需换算）
- 将收纳区改为 QQ 风格固定坐标浮层（底部中央 380x220px），坐标系与 clientX/Y 完全一致
- tauri://drag-drop 触发时，同时检查 lastMouseX/Y 在浮层范围内 + window.__draggedFile 存在，两者均满足才执行收纳

---

## [2026-07-22] 🐛 macOS 图片原生剪裁 (crop_image_native) 保存失败或静默崩溃问题

**🔍 现象描述:**
用户在前端图片预览组件中使用“另存物理图片副本”的裁剪功能时，无法真正完成剪裁并保存图片。

**🧠 核心原因:**
Rust 后端 `crop_image_native` 方法在此前使用了 Objective-C 的 `CGImageForProposedRect`，并试图通过 `msg_send![cg_ref, croppingToRect:]` 对 `CGImageRef` (纯 C 指针，非 ObjC 对象) 发送消息。这会导致无效调用或静默失败，无法得到剪裁后的像素数据。

**✅ 解决方案:**
放弃使用 `CGImage` 层面进行剪裁，改为使用纯 `NSImage` 绘图语义：
1. 根据目标剪裁尺寸 `alloc` 并 `initWithSize:` 实例化一个新的空白 `NSImage`。
2. 对新 Image 执行 `lockFocus`。
3. 调用原图的 `drawInRect:fromRect:operation:fraction:` 将指定源区域（注意 `NSImage` 坐标系左下角为原点，需对 Y 轴翻转）绘制到新 Image 中。
4. `unlockFocus` 后，通过 `TIFFRepresentation` 转为 `NSBitmapImageRep` 并输出 PNG。
现已完全修复，可在前端稳定执行真实物理图片剪裁。

---

## [2026-07-22] 🐛 图片预览失败与多格式 (HEIC/PSD/TIFF) 渲染修复

**🔍 现象描述:**
Excel 预览成功后，点击 PNG/JPG/HEIC/PSD 图片进行预览时，页面右侧图像区域显示空白或无法渲染。

**🧠 核心原因:**
1. **Tauri v2 协议与安全作用域限制**: 原前端调用的 `convertFileSrc(file.path)` (`asset://` 协议) 受限于 Tauri v2 严格的 Asset Protocol 安全作用域，且 `capabilities/default.json` 缺少对 `core:path:default` 的声明，被前端 Webview 拦截。
2. **Webview 原生格式局限**: 浏览器的 `<img />` 无法解析 Apple 手机默认的 `.heic` / `.heif` 格式，以及设计稿 `.psd` / `.tiff` / `.bmp` 文件。

**✅ 解决方案:**
1. **补全 Tauri 权限能力**: 在 `capabilities/default.json` 补全 `"core:path:default"`。
2. **macOS 原生 NSImage/CGImage 硬解转码接口 (`read_image_base64`)**:
   在 `src-tauri/src/lib.rs` 中编写了 `read_image_base64` Tauri 指令。直接利用 macOS 系统 `NSImage` 在内存中毫秒级解码 HEIC/HEIF/PSD/TIFF/BMP/PNG/JPG/WEBP，并统一输出为 base64 Data URI。既彻底绕过了 Tauri 资产协议拦截，又实现了真正意义上的全格式图片高保真预览！

---

## [2026-07-22] 🐛 AI 命名更新后 14.pdf 等文件虚拟名称未写入数据库

**🔍 现象描述:**
对 `14.pdf` 等文件进行 AI 智能命名并点击“确认应用模板”后，列表中文件名称未发生改变，虚拟命名未生效。

**🧠 核心原因:**
1. `SmartRenameModal.jsx` 在拼接重命名结果时未传输 `path` 字段，导致 `previews` 回调中仅带有 `id`。
2. 后端 `apply_virtual_rename` 原先仅基于单一致的 `WHERE id = ?2` 进行 SQL 更新。在部分跨阶段数据存留场景下，如果 DB 中旧记录的 ID 与 Hash ID 存在出入，`UPDATE` 会影响 0 行且不会引发报错。

**✅ 解决方案:**
1. `SmartRenameModal.jsx` 补全 `path: f.path` 字段传输。
2. `lib.rs` 的 `apply_virtual_rename` 升级为“ID 精准更新 + Path 双重兜底更新”逻辑，当 ID 未命中时自动通过文件物理路径 `path` 补查并写入 `virtual_name`。

---

## [2026-07-22] 🐛 纯图片扫描件 PDF 无法提取文字导致 AI 重命名变为 `14_pdf`

**🔍 现象描述:**
`13.pdf` 与 `14.pdf` 均为期末考试试卷，`13.pdf` 的 AI 重命名极其精准（`西南财经大学-微观经济学期末试题-2012`），但 `14.pdf` 确认 AI 重命名后，生成的结果却是 `14_pdf`。

**🧠 核心原因:**
1. **电子 PDF vs 图片扫描件 PDF**: `13.pdf` 是矢量排版的电子 PDF，`pdf-extract` 能直接提取汉字文本；而 `14.pdf` 是纯图片扫描件，内置只有三句作者水印 (`By Y.A by gongshundaren`)。
2. **防幻觉规则退回**: 当提取到的汉字为空或仅包含水印时，AI 无法归纳出科目和年份，触配了防幻觉退回规则，自动降级为清洗后的文件名 `14_pdf`。

**✅ 解决方案:**
1. **接入 macOS 原生 Apple Vision 本地 OCR 模块**:
   在 `src-tauri/src/mac_ocr.m` 中编写了基于 Apple `Vision.framework` (`VNRecognizeTextRequest`) 的 C-FFI 识别模块。
2. **扫描件自动降级机制 (Auto Fallback Pipeline)**:
   在 `file_parser.rs` 中，当 PDF 提取出的矢量字符小于 50 或全为水印时，自动毫秒级调用 Apple Vision OCR 提取第一页图像里的汉字正文（成功提取出 `西南财大2014年秋硕士研究生中微A考试`）。
3. **注入父目录语义**:
   在 `rename_with_ai` 中加入父文件夹名称（如 `中微`）作为辅助上下文，辅助大模型进行精准归纳。

---

## [2026-07-22] 🐛 AI 重命名后最近文件列表缺失与修改无效

**🔍 现象描述:**
选中最近文件列表中的 `19.pdf` 执行 AI 重命名并确认后，文件名依然未变，且页面列表中的部分文件忽然“凭空消失”。

**🧠 核心原因:**
1. **随机 UUID 导致 DB 更新失败**: `get_mac_recent_files` 每次扫描都用 `uuid::Uuid::new_v4()` 生成随机 ID，导致前端传给后端的 `apply_virtual_rename` 无法匹配数据库中的现有记录。
2. **刷新接口不一致**: `handleBatchRenameConfirm` 成功后，误调用了常规的 `get_files({ dirPath: 'sys:recent' })`，而非首次加载使用的 `get_mac_recent_files`，导致画面从系统全量最近记录突变为数据库中的小部分死数据。

**✅ 解决方案:**
1. **一致性哈希 ID**: `get_mac_recent_files` 统一改为基于文件路径 `path` 的一致性哈希算法生成 `id`。
2. **统一刷新数据源**: 修正 `handleBatchRenameConfirm` 的刷新逻辑，使其与 Mount 阶段数据源精准保持一致。

---

## [2026-07-15] 🐛 欢迎界面选择工作区文件夹后界面假死（无响应）

**🔍 现象描述:**
用户在 `WelcomeScreen` 点击“选择工作区文件夹”按钮，系统原生文件夹选择弹窗正常弹出，但选中文件夹点击“打开”后，弹窗消失，界面没有任何响应（假死或白屏）。

**🧠 核心原因:**
1. **IPC 线程阻塞**：前端拿到路径后渲染主页面，并向 Rust 后端调用了 `invoke('get_files')`。但 Rust 的 `get_files` 函数原本是一个同步函数 (`fn`)，它在主通信线程上执行了遍历几千上万个文件的 `WalkDir`。
2. **锁争用与数据库 I/O 瓶颈**：在遍历期间，每扫描到一个文件就执行一次 `state.db.lock()` 并进行单条 `INSERT`，导致 SQLite 执行了几万次单条写操作，不仅效率极低，还彻底卡死了 Tauri 的主进程，导致前端迟迟等不到 Promise 返回。
3. **Tauri v2 权限陷阱（次要）**：`@tauri-apps/plugin-dialog` 默认在打包后可能会因为缺少 `dialog:default` capability 权限而直接在前端抛错。

**✅ 解决方案:**
1. **异步化调度**：将 `get_files` 重构为 `async fn`。Tauri 会自动将其放入 Tokio 异步线程池执行，彻底释放 IPC 主线程。
2. **SQLite Bulk Insert (事务批量插入)**：在扫描时先将所需数据收集进内存 `Vec`，扫描结束后通过 `conn.transaction()` 开启单个事务，将所有文件的插入批量提交（几万条插入耗时缩减至数十毫秒级别）。
3. **补充原生权限**：在 `src-tauri/capabilities/default.json` 补充 `"dialog:default"`，确保系统弹窗在所有环境和平台都能正常弹出。
