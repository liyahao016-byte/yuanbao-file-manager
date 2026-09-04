# 智能资产沉淀 · 融合方案 PRD v2.0

> **文档版本**：v2.0（AI 完整版）  
> **产品负责人**：文件工具组  
> **最后更新**：2026-09-01  
> **定位**：将「归档本簇」能力升级为独立的「智能资产沉淀」工具，以 AI 内容理解 + 向量语义检索为核心驱动力，帮助用户从海量工作文件中自动识别、持续沉淀可复用的文件资产，最终一键整合为结构化知识文档。

---

## 一、产品背景与问题定义

### 1.1 核心痛点

| 用户角色 | 痛点 | 现状 |
|----------|------|------|
| 产品经理 | 项目推进中产生大量中间产物（草稿、走查截图、临时笔记），真正有价值的终稿淹没其中 | 手动整理，容易遗漏 |
| 设计师 | 设计稿多版本迭代，最终交付版难以快速定位 | 依赖命名规范，但执行参差不齐 |
| 研发工程师 | Agent/Copilot 生成海量中间代码和配置文件，核心模块被噪声掩盖 | 无自动化过滤手段 |
| 所有角色 | 项目结束后，知识分散在文件夹各处，无法快速提取为可复用的知识资产 | 知识流失 |

### 1.2 产品目标

> **一句话定义**：用户选定一个工作区，告诉系统「什么样的文件是有价值的」，系统通过 **AI 内容理解 + 规则引擎** 自动识别并标记资产文件，沉淀为结构化索引，并可一键整合为 `.md` 知识文档。

**核心价值公式**：
```
海量工作文件 → [AI 理解 + 规则过滤] → 有价值的资产清单 → [AI 整合] → 一份可复用的知识文档
```

### 1.3 与现有功能的关系

| 维度 | 归档本簇（现有） | 快速归档（现有） | **智能资产沉淀（本 PRD）** |
|------|------------------|------------------|---------------------------|
| 触发 | 手动，一次归档一个簇 | 手动，随时记录一件事 | **手动扫描 + AI 自动识别** |
| 锚点 | 文件簇 | 事件 | **整个工作区** |
| AI 角色 | 预填标题 | 无 | **内容理解 + 分类判定 + 摘要生成 + 知识整合** |
| 产出物 | 归档时间线卡片 | 归档时间线卡片 | **资产索引看板 + 结构化 .md 知识文档** |
| 入口 | 智能文件夹簇卡片 | 侧边栏快速按钮 | **工具箱独立入口** |

---

## 二、用户旅程与核心流程

### 2.1 五步核心流程

```
Step 1          Step 2           Step 3              Step 4          Step 5
选工作区  →  定沉淀规则  →  AI 扫描 + 分类  →  资产看板  →  一键生成知识库
(选文件夹)    (标签+属性      (全量遍历文件        (浏览/搜索      (AI 整合全部资产
              +AI描述         AI读取内容判定       /手动裁决       输出结构化 .md)
              +预设模板)       ASSET/NOISE/          /语义搜索)
                              PENDING)
```

### 2.2 详细用户旅程

#### Step 1：选择工作区

- **入口**：工具箱页面 → 点击「智能资产沉淀」卡片
- **操作**：弹出系统文件夹选择器（Tauri `dialog.open`），选择一个本地工作目录
- **约束**：目录须存在且可读；递归深度上限 5 层；单目录文件数上限 10,000
- **记忆**：上次选择的路径存入 `asset_config` 表，下次打开自动回填

#### Step 2：定义沉淀规则

用户通过三维度组合定义「什么样的文件是资产」：

**维度 1：标签关键词（标记 ASSET 的正向规则）**
```
用户输入示例：终稿, 获批, final, approved, v3
含义：文件名或路径中包含这些关键词 → 命中即标记为 ASSET
```

**维度 2：属性过滤（排除 NOISE 的反向规则）**
| 过滤项 | 默认值 | 说明 |
|--------|--------|------|
| 排除目录 | `node_modules`, `.git`, `__pycache__`, `.next`, `dist`, `build` | 可增删 |
| 排除后缀 | `.log`, `.tmp`, `.cache`, `.lock`, `.DS_Store` | 可增删 |
| 最小文件大小 | 0 KB（不限制） | 可设置，如 > 1KB |
| 最大文件大小 | 500 MB | 超过跳过内容读取 |

**维度 3：AI 自然语言描述（AI 理解的高阶规则）**
```
用户输入示例：「我想保留所有跟 QQ 浏览器文件管理相关的终稿方案文档和竞品分析报告，
             过滤掉临时会议截图和草稿版本」
系统处理：Ollama 将自然语言解析为结构化意图，生成内部规则：
  - 正向意图：终稿方案文档、竞品分析报告、文件管理相关
  - 负向意图：临时会议截图、草稿版本
  - 语义向量：对描述文本做 embedding，后续与文件内容做相似度比对
```

**4 套预设模板**（降低上手门槛）：

| 模板名 | 预填标签 | 预填排除 | AI 描述预填 |
|--------|---------|---------|------------|
| 产品经理工作区 | `PRD`, `终稿`, `评审`, `竞品` | 常规 + `截图`, `临时` | 保留需求文档、竞品分析、评审纪要等终稿 |
| 设计师工作区 | `交付`, `定稿`, `标注` | 常规 + `_副本`, `未命名` | 保留最终交付的设计稿和标注文件 |
| 研发工程区 | `README`, `架构`, `API`, `spec` | 常规 + `test_output`, `coverage` | 保留核心模块代码、架构文档和 API 定义 |
| 通用知识库 | `笔记`, `总结`, `复盘` | 常规 | 保留有知识价值的文档 |

#### Step 3：AI 扫描与智能分类

**这是本方案的核心能力环节。**

触发方式：用户点击「开始扫描」按钮 → 全量遍历工作区文件

**4 阶段规则引擎（按优先级从高到低）**：

```
Phase 1：硬排除（~1ms/文件）
  输入：文件路径 + 元信息
  规则：后缀排除表 ∪ 目录排除表 ∪ 大小上限
  输出：命中 → NOISE（置信度 100%）；未命中 → 进入 Phase 2
  示例：node_modules/lodash/index.js → NOISE

Phase 2：标签关键词匹配（~1ms/文件）
  输入：文件名 + 路径
  规则：用户定义的正向标签关键词
  输出：命中 → ASSET（置信度 85%，后续 AI 可调整）；未命中 → 进入 Phase 3
  示例：PRD_智能文件夹_v3_final.docx → 命中 "final" → ASSET

Phase 3：AI 内容理解（~2-5s/文件）
  输入：文件前 2000 字（通过 file_parser 提取）
  处理：
    a. 调用 Ollama (qwen2.5:32b) 判断文件价值
    b. 同时将用户的自然语言描述意图作为上下文
    c. AI 返回：分类(ASSET/NOISE/PENDING) + 置信度(0-100) + 摘要(200字内)
  输出：
    - 置信度 ≥ 75 → 按 AI 判定分类
    - 置信度 50-74 → PENDING（待用户确认）
    - 置信度 < 50 → NOISE
  降级：Ollama 不可用时跳过此阶段，文件进入 Phase 4
  示例：读取一份 .docx 内容后 AI 判断「这是一份完整的竞品分析报告，包含市场数据
       和结论，属于有价值的资产」→ ASSET, 置信度 92

Phase 4：兜底处理
  未被前三阶段命中的文件 → PENDING（待用户手动裁决）
```

**AI 分类 Prompt 设计**：
```
你是一个专业的文件资产评估专家。请根据以下文件信息和用户的沉淀意图，判断该文件是否属于有价值的资产。

## 用户的沉淀意图
{user_description}

## 文件信息
- 文件名：{filename}
- 文件类型：{file_type}
- 文件大小：{file_size}
- 所在路径：{file_path}
- 内容摘要（前2000字）：
{content_snippet}

## 判断标准
- ASSET（资产）：有独立价值，可复用，是终稿/定稿/核心文件
- NOISE（噪声）：中间产物、临时文件、草稿、重复内容、自动生成的冗余文件
- PENDING（待确认）：你无法确定的文件

请严格按以下 JSON 格式返回，不要包含任何其他文字：
{"classification": "ASSET|NOISE|PENDING", "confidence": 0-100, "summary": "200字内的文件核心内容摘要", "reason": "分类理由"}
```

**向量嵌入（与分类并行执行）**：
```
对每个非 NOISE 文件：
  1. 提取文件内容文本（file_parser.read_text_snippet, max 2000 字）
  2. 拼接：文件名 + 路径关键词 + 内容摘要 + AI 生成的摘要
  3. 调用 generate_embedding()（bge-m3 模型，1024 维）
  4. 写入 asset_embeddings 虚拟表（sqlite-vec vec0）
```

**增量扫描策略**：
- 首次：全量扫描
- 后续：比对 `mtime`（文件修改时间），仅扫描新增和变更文件
- 文件删除检测：扫描时标记已不存在的文件为 `DELETED`

**扫描进度 UI**：
```
[=======>          ] 扫描中... 342/1,206 文件
Phase 1 排除: 489 | Phase 2 命中: 67 | Phase 3 AI判定中: 12
预计剩余时间: ~3 分钟
```

#### Step 4：资产看板

**统计摘要卡片**：
```
┌─────────────┬────────────┬────────────┬────────────┐
│  总文件数    │  应保留     │  已过滤     │  待确认     │
│  1,206      │  178       │  923       │  105       │
│             │  ■ ASSET   │  ■ NOISE   │  ■ PENDING │
└─────────────┴────────────┴────────────┴────────────┘
```

**三级 Tab 视图**：
- **全部**：所有已扫描文件，按分类着色
- **应保留（ASSET）**：已确认的资产文件，按置信度排序
- **待确认（PENDING）**：需要用户裁决的文件

**每条资产卡片信息**：
```
┌─────────────────────────────────────────────────────────┐
│ 📄 PRD_智能文件夹_v3_final.docx          置信度: 92%    │
│ 路径: /projects/qq-browser/docs/                        │
│ AI 摘要: 这是一份完整的智能文件夹产品需求文档，涵盖       │
│         功能定义、交互设计、技术方案三大部分...           │
│ 标签: #PRD #终稿 #智能文件夹                             │
│ 大小: 2.3 MB | 修改时间: 2026-08-25                     │
│                                                         │
│ [标记为噪声] [修改分类] [查看原文件]                      │
└─────────────────────────────────────────────────────────┘
```

**语义搜索**：
- 搜索框输入关键词或自然语言描述
- **双通道检索**：
  - 通道 1：FTS5 Trigram 关键词匹配（文件名 + 路径 + AI 摘要）→ 精确匹配
  - 通道 2：向量语义检索（sqlite-vec 余弦相似度）→ 语义泛化
  - 结果合并：RRF（Reciprocal Rank Fusion）融合排序
- 示例：搜索「竞品调研」→ 不仅命中文件名含「竞品」的文件，还能召回「市场分析报告」「行业对标文档」等语义相关文件

**待确认裁决**：
- 单个裁决：点击 PENDING 文件的「标记为资产」或「标记为噪声」
- 批量裁决：全选 → 批量标记为资产/噪声
- 学习反馈：用户的裁决记录写入 `asset_events` 表，下次相似文件 AI 可参考历史裁决

#### Step 5：一键生成知识库

**触发**：资产看板 → 筛选需要的资产（可选） → 点击「生成知识库」按钮

**生成流程**：
```
1. 收集所有 ASSET 文件列表（或用户筛选后的子集）
2. 逐文件调用 file_parser.read_text_snippet() 读取全文
3. 对每个文件调用 Ollama 提取核心内容：
   Prompt: 「请从以下文件内容中提取核心信息，去除格式化噪声和重复内容，
          保留关键结论、数据和决策。输出格式为 Markdown。」
4. AI 对提取的内容按主题进行聚类和组织：
   Prompt: 「请将以下多份文件的核心内容按主题归类，合并重复信息，
          生成一份结构清晰的知识库文档。每个章节注明来源文件。」
5. 组装最终 .md 文件，包含：
   - 文档头（生成时间、来源文件数、工作区路径）
   - 按主题分章节的正文
   - 每段内容标注来源文件引用（支持 Obsidian [[双链]] 可选）
   - 附录：完整资产文件清单
```

**知识库文档示例**：
```markdown
# QQ浏览器文件管理器 · 项目知识库
> 自动生成于 2026-09-01 | 来源：28 份资产文件 | 工作区：/projects/qq-browser/

## 一、产品方案
### 1.1 智能文件夹 PRD（终稿）
> 来源：[[PRD_智能文件夹_v3_final.docx]]

- 核心功能：基于 AI 聚类的自动文件夹组织能力
- 关键决策：采用端侧 LLM 而非云端 API，保障数据安全
- 技术方案：sqlite-vec 向量检索 + qwen2.5:32b 内容理解
- P0 功能清单：自动聚类、手动拖拽调整、场景卡片...

### 1.2 智能标签设计方案
> 来源：[[智能标签_方案_0825.pdf]]

- 标签自动生成：AI 根据文件内容生成 3-5 个标签建议
- 标签体系：支持层级标签和自由标签两种模式
...

## 二、竞品分析
### 2.1 文件管理工具竞品对比
> 来源：[[竞品分析_文件管理.xlsx]]

- Eagle: 侧重设计资产管理，标签体系成熟，缺乏 AI 能力
- DEVONthink: AI 分类强大，但学习成本高，仅限 macOS
- Notion: 知识管理优秀，但文件管理薄弱
...

## 三、会议决策
### 3.1 产品评审纪要 0828
> 来源：[[会议纪要_0828.md]]

- 决策 1：智能文件夹优先做 P0 场景分类
- 决策 2：暂不接入云端 AI，MVP 使用端侧 Ollama
- 决策 3：归档功能与智能文件夹解耦，独立入口
...

---
## 附录：资产文件清单
| # | 文件名 | 类型 | 大小 | 分类置信度 |
|---|--------|------|------|-----------|
| 1 | PRD_智能文件夹_v3_final.docx | docx | 2.3MB | 92% |
| 2 | 竞品分析_文件管理.xlsx | xlsx | 1.1MB | 88% |
| ... | ... | ... | ... | ... |

---
*本文档由智能资产沉淀自动生成，原始文件可在资产看板中查看和管理*
```

**输出格式选项**：
- **标准 Markdown**（默认）：纯 `.md` 文件，通用兼容
- **Obsidian 增强**（可选）：包含 `[[wikilinks]]` 双链 + `#tag` + YAML frontmatter
- **Agent 上下文格式**（可选）：精简版，去除格式装饰，优化 Token 效率

---

## 三、AI 能力架构

### 3.1 AI 能力矩阵

本方案深度集成 4 项 AI 能力，全部基于项目已有的 Ollama + bge-m3 技术栈：

| AI 能力 | 使用场景 | 模型 | 已有基础 |
|---------|---------|------|---------|
| **内容理解分类** | Phase 3 判定 ASSET/NOISE/PENDING | qwen2.5:32b | `ollama.rs` 已有 generate 接口 |
| **自然语言→意图** | Step 2 解析用户描述为结构化规则 | qwen2.5:32b | `ollama.rs` 已有 parse_nl_intent |
| **向量嵌入** | 文件内容向量化 | bge-m3 (1024d) | `ollama.rs` 已有 generate_embedding |
| **AI 摘要 + 知识整合** | Step 3 摘要 + Step 5 知识库生成 | qwen2.5:32b | `ollama.rs` 已有 generate 接口 |

### 3.2 语义搜索架构

```
用户搜索请求
     │
     ├─→ 通道 1: FTS5 Trigram
     │     └─ 查询 asset_items_fts 表
     │     └─ 匹配：文件名 / 路径 / AI摘要
     │     └─ 返回 TOP 50 结果 + BM25 分数
     │
     ├─→ 通道 2: 向量语义检索
     │     └─ generate_embedding(query) → 1024d 向量
     │     └─ 查询 asset_embeddings 表（sqlite-vec 余弦距离）
     │     └─ 返回 TOP 50 结果 + 相似度分数
     │
     └─→ RRF 融合排序
           └─ score = Σ 1/(k + rank_i), k=60
           └─ 去重合并
           └─ 返回最终 TOP 20 结果
```

### 3.3 降级策略

AI 不是系统运转的必要条件。当 Ollama 服务不可用时：

| 层级 | 降级方式 | 用户感知 |
|------|---------|---------|
| Phase 3 分类 | 跳过 AI 判定，全部进 PENDING | PENDING 比例上升，需要更多手动裁决 |
| 向量嵌入 | 跳过写入 embedding | 语义搜索不可用，退化为关键词搜索 |
| AI 摘要 | 用文件名 + 路径 + 前 200 字作为摘要 | 摘要质量下降 |
| 知识库生成 | 仅生成文件清单列表，不做内容整合 | 产出从「知识文档」退化为「资产清单」 |

降级检测：扫描开始时 ping `http://localhost:11434/api/tags`，2 秒超时即判定不可用。

---

## 四、数据模型

### 4.1 新增 SQLite 表

#### 表 1：asset_tasks（沉淀任务）

```sql
CREATE TABLE IF NOT EXISTS asset_tasks (
    id              TEXT PRIMARY KEY,           -- 任务 ID (uuid)
    name            TEXT NOT NULL,              -- 任务名称
    workspace_path  TEXT NOT NULL,              -- 工作区路径
    status          TEXT NOT NULL DEFAULT 'active',  -- active / paused / completed
    -- 规则定义
    include_tags    TEXT,                       -- JSON: ["终稿", "获批", "final"]
    exclude_dirs    TEXT,                       -- JSON: [".git", "node_modules"]
    exclude_exts    TEXT,                       -- JSON: [".log", ".tmp"]
    min_size        INTEGER DEFAULT 0,
    max_size        INTEGER DEFAULT 524288000,  -- 500MB
    ai_description  TEXT,                       -- 用户自然语言描述
    ai_intent_json  TEXT,                       -- AI 解析后的结构化意图 JSON
    template_id     TEXT,                       -- 使用的预设模板 ID
    -- 统计
    total_files     INTEGER DEFAULT 0,
    asset_count     INTEGER DEFAULT 0,
    noise_count     INTEGER DEFAULT 0,
    pending_count   INTEGER DEFAULT 0,
    -- 时间戳
    last_scan_at    INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
```

#### 表 2：asset_items（资产条目）

```sql
CREATE TABLE IF NOT EXISTS asset_items (
    id              TEXT PRIMARY KEY,           -- 条目 ID (uuid)
    task_id         TEXT NOT NULL,              -- 关联的任务 ID
    file_path       TEXT NOT NULL,              -- 文件绝对路径
    file_name       TEXT NOT NULL,              -- 文件名
    file_type       TEXT,                       -- 文件后缀
    file_size       INTEGER,                    -- 文件大小 (bytes)
    file_mtime      INTEGER,                    -- 文件修改时间戳
    file_hash       TEXT,                       -- SHA256 哈希（前 64KB）
    -- AI 分类结果
    classification  TEXT NOT NULL DEFAULT 'PENDING',  -- ASSET / NOISE / PENDING / DELETED
    confidence      INTEGER DEFAULT 0,          -- 置信度 0-100
    ai_summary      TEXT,                       -- AI 生成的摘要
    ai_reason       TEXT,                       -- AI 分类理由
    classify_source TEXT DEFAULT 'rule',        -- rule / ai / user（分类来源）
    -- 匹配阶段
    matched_phase   INTEGER,                    -- 1=硬排除 2=标签 3=AI 4=兜底
    matched_rule    TEXT,                       -- 命中的具体规则
    -- 向量
    has_embedding   INTEGER DEFAULT 0,          -- 是否已生成 embedding
    -- 时间戳
    classified_at   INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    -- 约束
    UNIQUE(task_id, file_path)
);
CREATE INDEX IF NOT EXISTS idx_asset_items_task ON asset_items(task_id);
CREATE INDEX IF NOT EXISTS idx_asset_items_class ON asset_items(classification);
CREATE INDEX IF NOT EXISTS idx_asset_items_conf ON asset_items(confidence DESC);
```

#### 表 3：asset_embeddings（向量索引）

```sql
-- 复用 sqlite-vec 扩展，与现有 vec_files 表结构一致
CREATE VIRTUAL TABLE IF NOT EXISTS asset_embeddings USING vec0(
    item_id TEXT PRIMARY KEY,       -- 关联 asset_items.id
    embedding float[1024]           -- bge-m3 1024 维向量
);
```

#### 表 4：asset_items_fts（全文索引）

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS asset_items_fts USING fts5(
    file_name, file_path, ai_summary, tokenize='trigram'
);
-- 触发器自动同步（Insert / Update / Delete）
```

#### 表 5：asset_events（用户裁决 + 操作日志）

```sql
CREATE TABLE IF NOT EXISTS asset_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT NOT NULL,
    item_id     TEXT,                          -- 关联的资产条目
    event_type  TEXT NOT NULL,                 -- classify / reclassify / scan / export
    old_value   TEXT,                          -- 变更前的值
    new_value   TEXT,                          -- 变更后的值
    created_at  INTEGER NOT NULL
);
```

#### 表 6：asset_kb_history（知识库生成历史）

```sql
CREATE TABLE IF NOT EXISTS asset_kb_history (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL,
    output_path     TEXT NOT NULL,             -- 生成的 .md 文件路径
    asset_count     INTEGER,                   -- 本次整合的资产数
    format          TEXT DEFAULT 'markdown',   -- markdown / obsidian / agent
    generated_at    INTEGER NOT NULL
);
```

### 4.2 与现有表的关系

```
已有表（不修改）              新增表
┌──────────────┐          ┌──────────────────┐
│ files        │          │ asset_tasks      │
│ files_fts    │          │ asset_items      │
│ vec_files    │          │ asset_embeddings │
│ recent_files │          │ asset_items_fts  │
│ archives     │          │ asset_events     │
│ archive_files│          │ asset_kb_history │
│ archive_config│         └──────────────────┘
└──────────────┘
说明：asset_embeddings 是独立的 vec0 表，不与 vec_files 混用，
避免资产向量和文件管理向量互相干扰。
```

---

## 五、Tauri 命令设计

### 5.1 命令清单（10 个）

| # | 命令名 | 功能 | 对应步骤 |
|---|--------|------|---------|
| 1 | `create_asset_task` | 创建沉淀任务（含规则配置） | Step 1+2 |
| 2 | `update_asset_task` | 更新任务配置/状态 | Step 2 |
| 3 | `get_asset_task` | 获取任务详情 | Step 4 |
| 4 | `list_asset_tasks` | 列出所有任务 | 工具箱入口 |
| 5 | `scan_asset_task` | 执行扫描（全量/增量） | Step 3 |
| 6 | `query_asset_items` | 查询资产列表（含筛选排序分页） | Step 4 |
| 7 | `classify_asset_item` | 手动裁决单个文件分类 | Step 4 |
| 8 | `batch_classify_assets` | 批量裁决 | Step 4 |
| 9 | `search_assets` | 语义搜索（FTS5 + 向量双通道） | Step 4 |
| 10 | `generate_knowledge_base` | 一键生成 .md 知识库 | Step 5 |

### 5.2 核心命令签名

```rust
// ── 命令 1: 创建沉淀任务 ──
#[tauri::command]
pub async fn create_asset_task(
    name: String,
    workspace_path: String,
    include_tags: Option<Vec<String>>,
    exclude_dirs: Option<Vec<String>>,
    exclude_exts: Option<Vec<String>>,
    min_size: Option<i64>,
    max_size: Option<i64>,
    ai_description: Option<String>,
    template_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<AssetTask, String>

// ── 命令 5: 执行扫描 ──
#[tauri::command]
pub async fn scan_asset_task(
    task_id: String,
    force_full: Option<bool>,      // 强制全量扫描（忽略增量逻辑）
    state: State<'_, AppState>,
) -> Result<ScanResult, String>
// 内部逻辑：
// 1. 遍历 workspace_path，收集文件列表
// 2. 增量判断：比对 mtime，过滤未变更文件
// 3. Phase 1-4 规则引擎分类
// 4. 对非 NOISE 文件并行执行：
//    a. file_parser::read_text_snippet() 提取内容
//    b. Ollama generate → 分类 + 摘要
//    c. generate_embedding() → 写入 asset_embeddings
// 5. 更新 asset_items 表 + 统计计数
// 6. 返回 ScanResult { scanned, new_assets, new_noise, new_pending }

// ── 命令 9: 语义搜索 ──
#[tauri::command]
pub async fn search_assets(
    task_id: String,
    query: String,
    top_k: Option<usize>,          // 默认 20
    state: State<'_, AppState>,
) -> Result<Vec<AssetItemWithScore>, String>
// 内部逻辑：
// 1. FTS5 查询 → TOP 50 + BM25 score
// 2. generate_embedding(query) → vec 查询 asset_embeddings → TOP 50 + cosine distance
// 3. RRF 融合 → 去重 → 返回 TOP K

// ── 命令 10: 生成知识库 ──
#[tauri::command]
pub async fn generate_knowledge_base(
    task_id: String,
    item_ids: Option<Vec<String>>,  // 不传 = 全部 ASSET
    format: Option<String>,         // markdown / obsidian / agent
    output_dir: Option<String>,     // 不传 = workspace_path/knowledge_base/
    state: State<'_, AppState>,
) -> Result<KnowledgeBaseResult, String>
// 内部逻辑：
// 1. 查询 ASSET 文件列表
// 2. 逐文件 read_text_snippet + Ollama 提取核心内容
// 3. 收集所有提取内容 → Ollama 按主题组织
// 4. 拼装 .md 文件（含 frontmatter + 章节 + 来源引用 + 附录）
// 5. 写入文件 → 记录 asset_kb_history → 返回路径
```

---

## 六、前端组件设计

### 6.1 组件清单

| 组件 | 功能 | 嵌入位置 |
|------|------|---------|
| `AssetSetupWizard.jsx` | 创建任务向导（选工作区+定规则+预设模板） | 工具箱卡片点击后弹出 |
| `AssetDashboard.jsx` | 资产看板主视图（统计+Tab+列表+搜索） | 独立路由页面 |
| `AssetItemCard.jsx` | 单个资产卡片（摘要+标签+操作按钮） | 看板列表子组件 |
| `AssetSearchBar.jsx` | 语义搜索框（含搜索模式切换） | 看板顶部 |
| `AssetKnowledgeExport.jsx` | 知识库生成面板（格式选择+进度+预览） | 看板操作栏 |

### 6.2 路由与导航

```javascript
// App.jsx navConfig 新增
{ id: 'asset_dashboard', label: '资产看板', icon: '💎', group: 'tools' }

// ToolboxView.jsx 新增卡片
{
  id: 'smart_asset',
  title: '智能资产沉淀',
  description: 'AI 自动识别工作区中的有价值文件，一键整合为知识文档',
  icon: '💎',
  action: () => openAssetWizard()
}
```

---

## 七、性能设计

### 7.1 扫描性能

| 文件规模 | Phase 1-2 (规则) | Phase 3 (AI) | Phase 3 (embedding) | 总耗时预估 |
|---------|-----------------|-------------|--------------------:|-----------|
| 100 文件 | < 1s | ~50s (按50%进AI) | ~10s | ~1 分钟 |
| 1,000 文件 | < 2s | ~300s (按30%进AI) | ~60s | ~5 分钟 |
| 5,000 文件 | < 5s | ~600s (按15%进AI) | ~150s | ~12 分钟 |

**优化手段**：
- Phase 1-2 排除率通常 > 50%，大幅减少 AI 处理量
- AI 分类和 embedding 可并行（tokio::join!）
- 大文件（> 50MB）跳过内容读取，仅用元信息分类
- 增量扫描跳过未变更文件
- 扫描过程可随时暂停/取消

### 7.2 搜索性能

| 指标 | 预期 |
|------|------|
| FTS5 关键词搜索 | < 10ms |
| 向量 embedding 生成 | ~200ms (bge-m3) |
| sqlite-vec 向量检索 | < 50ms (1000 条资产) |
| RRF 融合 | < 5ms |
| 端到端搜索延迟 | < 500ms |

---

## 八、降级与容错

### 8.1 Ollama 不可用

- **检测时机**：任务创建时 + 扫描开始时
- **检测方式**：GET `http://localhost:11434/api/tags`，2 秒超时
- **降级表现**：
  - 创建任务：自然语言描述保存但不解析，提示用户「AI 能力暂时不可用，将使用纯规则匹配」
  - 扫描：Phase 3 整体跳过，所有未命中 Phase 1-2 的文件进入 PENDING
  - 搜索：向量通道关闭，退化为纯关键词搜索
  - 知识库生成：产出资产清单（文件列表+路径），不做内容整合

### 8.2 文件解析失败

- 二进制文件 / 加密文件 / 损坏文件 → 跳过内容读取，仅用文件名+路径+元信息参与分类
- 记录解析失败日志到 `asset_events`（event_type = 'parse_error'）

### 8.3 磁盘空间

- 知识库 `.md` 文件大小预估：每 100 个资产文件 → ~50-100KB 知识文档
- embedding 存储：每条 1024 × 4 bytes = 4KB，1000 条 ≈ 4MB

---

## 九、新增依赖

| 依赖 | 用途 | 现有/新增 | 说明 |
|------|------|----------|------|
| `ollama.rs` (qwen2.5:32b) | AI 生成 / 分类 / 摘要 | **已有** | 复用现有接口 |
| `ollama.rs` (bge-m3) | 向量嵌入 | **已有** | 复用 generate_embedding |
| `sqlite-vec` | 向量检索 | **已有** | 复用，新建 asset_embeddings 表 |
| `file_parser.rs` | 文件内容提取 | **已有** | 复用 read_text_snippet |
| `sha2` | 文件哈希（增量检测） | **新增** | 纯 Rust，零外部链接 |
| `uuid` | ID 生成 | **已有** | Cargo.toml 已含 |
| `walkdir` | 递归遍历目录 | **已有** | Cargo.toml 已含 |
| `chrono` | 时间处理 | **已有** | Cargo.toml 已含 |
| `tokio` | 异步并发 | **已有** | Tauri 2.0 自带 |

**新增 crate 仅 1 个：`sha2`**，其余全部复用项目已有技术栈。

---

## 十、实施里程碑

### M1：基础框架（2 天）
- [ ] `asset.rs` 模块创建 + 数据库表初始化
- [ ] `create_asset_task` / `get_asset_task` / `list_asset_tasks` / `update_asset_task` 四个 CRUD 命令
- [ ] `AssetSetupWizard.jsx` 向导组件（选工作区 + 定规则 + 4 套预设模板）
- [ ] 工具箱入口卡片
- [ ] lib.rs 注册新命令

### M2：扫描引擎（3 天）
- [ ] `scan_asset_task` 命令 — Phase 1-2 规则引擎
- [ ] `scan_asset_task` 命令 — Phase 3 AI 内容理解 + 分类
- [ ] `scan_asset_task` 命令 — 向量嵌入写入 asset_embeddings
- [ ] 增量扫描逻辑（mtime + hash 比对）
- [ ] 扫描进度前端进度条
- [ ] Ollama 降级处理

### M3：资产看板（2 天）
- [ ] `AssetDashboard.jsx` 看板主视图
- [ ] `query_asset_items` 命令（分页 + 筛选 + 排序）
- [ ] `classify_asset_item` / `batch_classify_assets` 裁决命令
- [ ] 统计摘要卡片 + 三级 Tab + 资产卡片组件
- [ ] PENDING 批量裁决 UI

### M4：语义搜索（2 天）
- [ ] `asset_items_fts` FTS5 表 + 触发器
- [ ] `search_assets` 命令 — FTS5 通道
- [ ] `search_assets` 命令 — 向量通道（asset_embeddings 查询）
- [ ] RRF 融合排序
- [ ] `AssetSearchBar.jsx` 搜索组件

### M5：知识库生成（2 天）
- [ ] `generate_knowledge_base` 命令
- [ ] AI Prompt 设计（内容提取 + 主题组织）
- [ ] 3 种输出格式（标准 Markdown / Obsidian 增强 / Agent 上下文）
- [ ] `AssetKnowledgeExport.jsx` 生成面板
- [ ] `asset_kb_history` 历史记录

### 总计：约 11 天

---

## 十一、效果预期

### 11.1 核心指标

| 指标 | 预期值 | 说明 |
|------|--------|------|
| 分类准确率 | ~90% | AI 内容理解 + 规则引擎组合 |
| PENDING 比例 | ~10% | 大部分文件被 Phase 1-3 自动判定 |
| 搜索召回率 | ~95% | FTS5 + 向量语义双通道 |
| 知识库文档质量 | 高 | AI 全文理解 + 主题整合 |
| 首次扫描耗时（1000 文件） | ~5 分钟 | AI 分类 + embedding 并行 |
| 增量扫描耗时 | < 30 秒 | 仅处理新增/变更文件 |

### 11.2 与纯规则方案的对比

| 维度 | 纯规则方案 | 本方案（AI 完整版） | 提升 |
|------|-----------|-------------------|------|
| 分类准确率 | ~70% | ~90% | **+20%** |
| PENDING 比例 | ~30% | ~10% | **-20%** |
| 搜索能力 | 仅关键词 | **关键词 + 语义** | 质变 |
| 知识库质量 | 资产清单 | **结构化知识文档** | 质变 |
| 用户操作量 | 需大量手动裁决 | 大部分自动 | 大幅减少 |

---

## 十二、开放问题与后续迭代

| # | 问题 | 当前策略 | 后续方向 |
|---|------|---------|---------|
| 1 | 扫描期间用户能否继续操作？ | MVP 为阻塞式扫描，显示进度条 | P2 引入后台异步扫描 |
| 2 | 多任务如何管理？ | 列表展示，互相独立 | P2 支持任务间对比 |
| 3 | AI 判定错误如何修正？ | 用户手动裁决 | P2 引入 few-shot 学习，参考历史裁决 |
| 4 | 知识库能否增量更新？ | MVP 每次全量重新生成 | P2 支持增量追加新资产 |
| 5 | 能否自动监听文件变更？ | MVP 手动触发扫描 | P3 引入 FS Watcher 后台监听 |
| 6 | 资产能否跨工作区复用？ | MVP 单工作区独立 | P3 支持全局资产库 |

---

> **文档结束**  
> 本 PRD 描述的智能资产沉淀功能，完整集成了 AI 内容理解、向量语义检索、自然语言规则解析等 AI 能力，旨在帮助用户从海量工作文件中自动沉淀可复用的知识资产。
