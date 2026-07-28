# 🤖 AI 智能体开发规范与日志维护协议 (Unified AGENTS Rules)

本协议适用于当前项目中的所有 AI Coding Agents。每次启动任务时，智能体必须读取本规则并严格遵守。

---

## 1. 强制任务准备流程 (Mandatory Warm-up)

在开始回答用户问题或编写任何代码前，AI 必须完成以下初始化检查：
1. **查阅已知问题与 Task Backlog**：必须调阅 `docs/04_待修改问题与后续迭代规划_Task_Backlog.md`，了解当前项目完成状态与悬而未决的问题。
2. **查阅架构演进与研发进展**：调阅 `docs/02_功能研发进度与里程碑日志_Development_Progress_Log.md` 和 `docs/03_技术架构演进与决策路线图_Tech_Decisions_Roadmap.md`，确保不违背已有架构决策。

---

## 2. 项目管理与研发铁律 (Core Principles)

1. **技术选型归档**：任何技术路线或底层库变更，必须同步维护在 `docs/03_技术架构演进与决策路线图_Tech_Decisions_Roadmap.md` 中。
2. **进度日志归档**：每一次功能交付后的 `walkthrough.md` 汇报，都必须自动追加合并到 `docs/02_功能研发进度与里程碑日志_Development_Progress_Log.md` 文件中。
3. **Bug 修复归档**：每一次排查并修复重大 Bug 后，必须将现象、根因分析与解决方案追加到 `docs/01_疑难故障排查与Bug修复日志_Troubleshooting_Log.md` 中。
4. **Task Backlog 同步**：完成任务或发现新问题时，必须同步勾选或新增 `docs/04_待修改问题与后续迭代规划_Task_Backlog.md` 中的 `[x]` / `[ ]` 选项。

---

## 3. 项目技术日志文档索引结构 (Log Directory Index)

项目的全部技术文档统一存放于 `docs/` 目录下，命名与职责划分如下：

| 文档名称 | 对应职责与内容说明 | 更新触发时机 |
| :--- | :--- | :--- |
| **`01_疑难故障排查与Bug修复日志_Troubleshooting_Log.md`** | 记录遇到的疑难 Bug、假死崩溃、数据丢帧现象及根因排查与修复结论。 | 每次成功排查或修复关键 Bug 后 |
| **`02_功能研发进度与里程碑日志_Development_Progress_Log.md`** | 记录新功能的交付 Walkthrough、核心功能点与用户体验升级总结。 | 每次新功能开发交付完成后 |
| **`03_技术架构演进与决策路线图_Tech_Decisions_Roadmap.md`** | 记录系统的重大技术选型（如 Tauri、SQLite-Vec、Apple Vision OCR）及决策理由。 | 发生技术选型或架构调整时 |
| **`04_待修改问题与后续迭代规划_Task_Backlog.md`** | 记录当前系统的 Known Issues、已完成 (`[x]`) 与待办 (`[ ]`) 清单。 | 发现新问题或完成已有任务时 |
| **`docs/implementation_plans/`** | 存放各个阶段的具体技术落地实施计划书 (`01_...`, `02_...`)。 | 制定新阶段研发计划时 |

---

## 4. 标准化日志写入规范 (Standard Logging Protocols)

### 规则 4.1: 故障排查日志 (Troubleshooting Log)
在修复任何 Bug 后，必须向 `docs/01_疑难故障排查与Bug修复日志_Troubleshooting_Log.md` 头部追加结构化记录，格式示例：
```markdown
## [YYYY-MM-DD] 🐛 <Bug 简短描述>

**🔍 现象描述:**
<问题表现、错误弹窗或异常行为>

**🧠 核心原因:**
<从代码层/数据层分析出的根本原因>

**✅ 解决方案:**
<具体的修复措施、核心代码变更及效果>
```

### 规则 4.2: 进度与 Walkthrough 日志 (Progress Log)
在新功能研发完成后，必须向 `docs/02_功能研发进度与里程碑日志_Development_Progress_Log.md` 头部追加记录，格式示例：
```markdown
## [YYYY-MM-DD] <功能特性名称> 交付完成！

### 🚀 1. <子特性名称>
- <详细说明>

### 📄 2. <测试与效果>
- <验证结果与使用说明>
```

---

## 5. 严禁事项 (Prohibitions)

1. **禁止创建无语义日志文件**：严禁创建形如 `test.txt`、`notes.md` 或无日期/主题的杂乱日志文件。必须统一写入 `docs/` 对应的标准化文件中。
2. **禁止覆盖历史记录**：更新日志时，必须使用追加模式（Append 到顶部/合适位置），保留所有历史迭代轨迹。
3. **保持文件名语义明确**：`docs/` 下的文件名必须清晰表达其内容，严禁使用含糊不清的文件名。
