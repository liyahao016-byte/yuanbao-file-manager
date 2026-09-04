# 智能资产沉淀（Smart Asset Distiller）— 产品需求文档

> **文档版本**: v1.0  
> **产品线**: QQ浏览器 · 文件管理器  
> **所属模块**: 工具箱 → 智能资产沉淀  
> **作者**: AI 产品经理  
> **创建日期**: 2026-08-31  
> **状态**: 初稿 / 待评审

---

## 一、文档修订记录

| 版本 | 日期 | 修订内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-08-31 | 初稿，完成功能逻辑、用户旅程、技术方案 | — |

---

## 二、背景与动机

### 2.1 问题陈述

在日常办公中，用户的工作区（文件夹 / 项目目录）会随着协作和 AI 工具的使用而迅速膨胀：

| 痛点 | 典型场景 | 后果 |
|------|----------|------|
| **AI 中间产物泛滥** | Agent 生成的草稿、临时 JSON、中间日志成百上千 | 有价值的终稿淹没在噪声中 |
| **关键资产无法识别** | 述职报告终稿、方案 V3、获批合同散落在深层子目录 | 复用时找不到，重复劳动 |
| **知识体系断裂** | 做完项目后资产没有沉淀，下次启动同类项目从零开始 | 个人/团队经验无法复利 |
| **Agent 上下文低质** | 把整个工作区喂给 Agent，噪声过多导致幻觉/失焦 | AI 辅助效果打折 |

### 2.2 产品定位

**智能资产沉淀** = 一个持续运行的「资产过滤器」。

用户只需 **选择工作区 + 定义沉淀规则**，系统即可在后台持续监听文件变动，自动将「值得保留的文件资产」筛选出来，同时过滤掉中间产物和噪声文件。最终产出一个 **干净、可检索、可复用** 的资产库，既服务于个人知识体系，也可直接作为 Agent 的高质量上下文。

### 2.3 核心价值主张

```
从海量文件中沉淀出可提取、可复用的文件资产
—— 既可用作个人知识体系，又可用作 Agent 上下文
```

---

## 三、目标用户与场景

### 3.1 目标用户画像

| 维度 | 描述 |
|------|------|
| 角色 | 产品经理、设计师、研发工程师、运营、咨询顾问等知识工作者 |
| 特征 | 日均处理 50+ 文件，频繁使用 AI 辅助工具，跨项目协作 |
| 核心诉求 | 「做完项目后，关键资产能自动留下来，下次直接复用」 |

### 3.2 典型使用场景

#### 场景 A：产品经理的方案沉淀
> 小李用 AI 辅助写了一份 PRD，过程中产生了 12 个草稿版本、3 个 AI 对话记录、若干截图。项目结束后，他只想保留终稿 PRD（v3-final）、竞品分析表、用户调研报告。启用「智能资产沉淀」后，系统自动识别 final 版本并标记为资产，草稿和中间对话记录被自动过滤。

#### 场景 B：研发工程师的代码项目
> 开发目录中有 node_modules、build 产物、.log 文件、临时测试数据。工程师关心的是源码、配置文件、架构文档。配置沉淀规则后，系统只保留 .ts/.tsx/.md/.yaml 等源文件，忽略构建产物和日志。

#### 场景 C：为 Agent 准备高质量上下文
> 用户准备让 AI Agent 基于历史项目经验给出建议。直接指定资产库为 Agent 上下文，比喂整个工作区精准 10 倍。

---

## 四、功能概述

### 4.1 功能架构总览

```
┌─────────────────────────────────────────────────────┐
│                    工具箱入口                         │
│              「智能资产沉淀」卡片                      │
└───────────────┬─────────────────────────────────────┘
                │ 点击进入
                ▼
┌─────────────────────────────────────────────────────┐
│              Step 1: 选择工作区                       │
│    用户选择一个本地文件夹作为监听目标                    │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│          Step 2: 定义沉淀规则（Asset Policy）          │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐      │
│  │ 保留标签  │  │ 属性筛选  │  │ 自然语言描述  │      │
│  │ (Tags)   │  │(Filters) │  │ (NL Intent)  │      │
│  └──────────┘  └──────────┘  └──────────────┘      │
│                                                     │
│  示例：                                              │
│  - 标签: #终稿 #获批 #关键决策                         │
│  - 属性: 文件类型=PDF/DOCX, 大小>10KB, 排除 node_modules │
│  - 描述: "保留所有产品方案终稿和竞品分析报告"            │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│       Step 3: 后台持续监听 + 自动分类                  │
│                                                     │
│  ┌─────────┐    ┌──────────┐    ┌────────────┐     │
│  │FS Watcher│──→│Rule Engine│──→│ Asset Index │     │
│  │文件监听   │    │规则引擎    │    │ 资产索引库  │     │
│  └─────────┘    └──────────┘    └────────────┘     │
│                                                     │
│  新文件 / 文件变更 → 规则匹配 → 标记为「资产」或「噪声」  │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│         Step 4: 资产看板 + 输出                       │
│                                                     │
│  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ 资产看板      │  │ Agent 上下文│  │ 知识库导出  │  │
│  │ Asset Board  │  │ Context API│  │ Export      │  │
│  └──────────────┘  └────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 4.2 与现有归档功能的关系

| 维度 | 归档本簇（现有） | 智能资产沉淀（本 PRD） |
|------|------------------|----------------------|
| 触发方式 | 手动：从簇卡片点击归档 | **自动**：后台监听，持续运行 |
| 粒度 | 一次归档一个簇（一组文件） | **整个工作区**，持续过滤 |
| AI 参与 | 预填标题和产出 | **规则引擎 + AI 内容理解**，自动判断保留/过滤 |
| 输出形式 | 一条 Markdown 归档记录 | **资产索引库**，可查、可导、可作上下文 |
| 使用频率 | 低频，完成一批工作后手动触发 | 高频，**设置一次，持续受益** |
| 核心定位 | 工作留痕（记录做过的事） | **资产过滤**（沉淀有价值的文件） |

---

## 五、详细功能设计

### 5.1 入口与导航

#### 5.1.1 工具箱入口

在工具箱（ToolboxView）中新增一个工具卡片：

| 字段 | 值 |
|------|-----|
| id | `asset_distiller` |
| name | 智能资产沉淀 |
| desc | 监听工作区，自动从海量文件中筛选关键资产，过滤中间产物 |
| icon | 💎 |
| tag | AI |
| tagColor | #6366f1 |
| gradient | `linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)` |
| category | 文件管理 |

#### 5.1.2 侧边栏入口

在侧边栏「知识归档」section 下新增导航项：

```
知识归档
  ├── 归档时间线    (archive_timeline)     -- 已有
  ├── 资产看板      (asset_board)          -- 新增
  └── [快速归档]    按钮                    -- 已有
```

### 5.2 核心流程：创建沉淀任务

#### Step 1：选择工作区

| 项目 | 说明 |
|------|------|
| 交互方式 | 点击「选择文件夹」按钮，调用系统文件夹选择器（Tauri dialog） |
| 默认建议 | 如果用户已设置全局工作区路径，预填该路径 |
| 多工作区 | 支持创建多个沉淀任务，每个任务监听一个独立工作区 |
| 校验 | 路径必须存在且可读；不允许选择系统根目录 / Home 目录 |

**界面原型要点**：
- 大面积的文件夹图标 + 虚线拖拽区域
- 「选择文件夹」主按钮 + 「或拖拽文件夹到此处」提示
- 选择后显示路径 + 文件夹统计（文件数 / 总大小 / 子目录数）

#### Step 2：定义沉淀规则（Asset Policy）

沉淀规则是本功能的核心，由三个维度组合定义：

##### 2A. 标签维度（Tags）

用户通过标签定义「什么类型的文件值得沉淀」：

| 规则类型 | 示例 | 说明 |
|----------|------|------|
| 内容标签 | `#终稿` `#获批` `#V3` `#评审通过` | 基于文件名/内容中的关键词 |
| 类型标签 | `#方案` `#报告` `#合同` `#设计稿` | 基于文件的业务类型 |
| 阶段标签 | `#已交付` `#归档` `#里程碑` | 基于文件所处的业务阶段 |

**交互**：
- 预置常用标签模板（可一键勾选）
- 支持自定义标签（输入框 + 回车添加）
- 标签之间为「OR」关系：匹配任一标签即纳入

##### 2B. 属性维度（Filters）

基于文件元信息的硬性筛选条件：

| 属性 | 操作符 | 示例值 | 说明 |
|------|--------|--------|------|
| 文件类型 | 包含 / 排除 | `.pdf, .docx, .pptx, .md` | 白名单优先 |
| 文件大小 | 大于 / 小于 / 范围 | `> 10KB` | 过滤空文件和占位符 |
| 修改时间 | 最近 N 天 / 自定义范围 | `最近 30 天` | 时效性筛选 |
| 目录层级 | 包含 / 排除 | 排除 `node_modules, .git, dist, build` | 过滤构建产物 |
| 文件名模式 | 包含 / 排除 / 正则 | 排除 `*-draft-*`, `temp_*` | 过滤草稿和临时文件 |

**交互**：
- 每个条件行：属性下拉 + 操作符下拉 + 值输入
- 「+ 添加条件」按钮
- 条件之间为「AND」关系
- 提供预设模板：「办公文档」「代码项目」「设计资产」「通用」

##### 2C. 自然语言描述（NL Intent）

用户用一句话描述自己想沉淀什么：

```
示例输入：
  "保留所有产品方案终稿和竞品分析报告，过滤掉AI草稿和临时文件"
  "只保留源代码和架构文档，忽略构建产物"
  "保留所有获批的合同和法务审核通过的文件"
```

**处理逻辑**：
1. AI 解析用户意图，生成结构化规则（等效于标签 + 属性条件）
2. 在规则配置面板中展示 AI 生成的规则，用户确认/修改
3. 后续匹配时，AI 也会参与**内容级理解**（读取文件摘要判断是否符合意图）

#### Step 3：规则预览与确认

在用户完成规则配置后，系统立即执行一次**预扫描**：

| 展示内容 | 说明 |
|----------|------|
| 命中资产数 | 本次扫描识别出的资产文件数量 |
| 过滤文件数 | 被规则排除的文件数量 |
| 待 AI 研判 | 规则无法确定、需要 AI 内容理解介入的文件数 |
| 预览列表 | 展示前 20 个命中资产，用户可逐个确认/排除 |
| 存储预估 | 资产库索引预计占用空间 |

用户点击「确认启动」后，沉淀任务正式创建并开始后台监听。

### 5.3 后台监听引擎

#### 5.3.1 文件监听（FS Watcher）

| 项目 | 说明 |
|------|------|
| 监听技术 | Tauri + `notify` crate（Rust 文件系统事件库） |
| 监听事件 | Create / Modify / Rename / Delete |
| 防抖策略 | 同一文件 2 秒内的连续事件合并为一次处理 |
| 排除路径 | 按规则中的「排除目录」自动忽略，减少噪声 |
| 性能保护 | 单工作区最大监听 10,000 个文件，超出时提示用户缩小范围 |

#### 5.3.2 规则引擎（Rule Engine）

文件变更事件到达后，规则引擎按以下优先级进行匹配：

```
Priority 1: 硬性排除（黑名单路径、类型）
     ↓ 通过
Priority 2: 硬性保留（白名单类型、大小、时间范围）
     ↓ 通过
Priority 3: 标签匹配（文件名/路径中的关键词匹配标签）
     ↓ 不确定
Priority 4: AI 内容理解（读取文件前 2000 字，结合 NL Intent 判断）
     ↓
结果: ASSET / NOISE / PENDING（待用户确认）
```

**分类结果**：

| 分类 | 含义 | 后续处理 |
|------|------|----------|
| `ASSET` | 确认为有价值资产 | 写入资产索引，生成摘要 |
| `NOISE` | 确认为噪声/中间产物 | 记录到过滤日志，不入索引 |
| `PENDING` | 无法确定 | 在资产看板「待确认」区展示，等用户裁决 |

#### 5.3.3 资产索引（Asset Index）

每个被标记为 ASSET 的文件，系统自动生成一条索引记录：

```json
{
  "id": "asset_20260831_001",
  "file_path": "/Users/xxx/project/PRD_v3_final.docx",
  "file_name": "PRD_v3_final.docx",
  "file_type": "docx",
  "file_size": 245760,
  "modified_at": "2026-08-30T14:22:00",
  "discovered_at": "2026-08-31T10:15:30",
  "task_id": "task_001",
  "classification": "ASSET",
  "confidence": 0.92,
  "tags": ["#终稿", "#PRD", "#产品方案"],
  "ai_summary": "QQ浏览器文件管理器 v2.0 产品需求文档终稿，包含 5 大模块的详细功能设计...",
  "content_hash": "sha256:abc123...",
  "embedding_id": "vec_asset_001"
}
```

### 5.4 资产看板（Asset Board）

资产看板是用户查看和管理沉淀结果的核心界面。

#### 5.4.1 看板布局

```
┌─────────────────────────────────────────────────────────┐
│  📊 资产看板                                   [设置] [导出] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  │
│  │  28     │  │  156    │  │  5      │  │  2.3 GB  │  │
│  │ 资产文件 │  │ 已过滤  │  │ 待确认  │  │ 节省空间  │  │
│  └─────────┘  └─────────┘  └─────────┘  └──────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  筛选: [全部标签 ▼] [全部类型 ▼] [搜索...]       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌── 资产列表 ────────────────────────────────────────┐  │
│  │ 💎 PRD_v3_final.docx        #终稿 #PRD     245KB  │  │
│  │    AI摘要: QQ浏览器文件管理器产品需求文档...         │  │
│  │    发现于 2026-08-30 · 置信度 92%                   │  │
│  │                          [预览] [移除] [编辑标签]   │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ 💎 竞品分析_文件管理.xlsx    #报告 #竞品     1.2MB  │  │
│  │    AI摘要: 主流文件管理工具竞品对比分析...           │  │
│  │    发现于 2026-08-29 · 置信度 88%                   │  │
│  │                          [预览] [移除] [编辑标签]   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌── 待确认 (5) ──────────────────────────────────────┐  │
│  │ ❓ meeting_notes_0828.md     AI建议: 保留            │  │
│  │    原因: 包含产品决策记录                            │  │
│  │                          [保留为资产] [标记为噪声]   │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 5.4.2 看板功能清单

| 功能 | 说明 |
|------|------|
| 统计摘要 | 资产数 / 已过滤数 / 待确认数 / 节省空间 |
| 搜索 | 全文搜索资产文件名和 AI 摘要 |
| 标签筛选 | 按标签过滤资产列表 |
| 类型筛选 | 按文件类型过滤（文档 / 表格 / 代码 / 图片） |
| 预览 | 点击预览，在右侧面板展示文件内容 |
| 移除 | 将误判的资产降级为噪声 |
| 补录 | 将误过滤的文件手动提升为资产 |
| 待确认处理 | 对 PENDING 文件逐个裁决：保留 / 过滤 |
| 批量操作 | 多选后批量标记、批量导出 |
| 导出 | 导出资产清单（Markdown / CSV / JSON） |

### 5.5 沉淀任务管理

支持用户创建和管理多个沉淀任务：

| 操作 | 说明 |
|------|------|
| 创建任务 | 选择工作区 + 定义规则 |
| 暂停/恢复 | 暂停后停止监听，恢复后重新开始 |
| 编辑规则 | 修改沉淀规则，修改后重新扫描 |
| 删除任务 | 删除任务及其索引数据（原文件不受影响） |
| 任务状态 | `运行中` / `已暂停` / `初始扫描中` / `错误` |

### 5.6 输出与消费

#### 5.6.1 个人知识体系

- 资产索引可与现有的「归档时间线」互通
- 支持将资产导出为结构化 Markdown（含 Obsidian 双链格式）
- 支持一键生成「项目资产总结」文档

#### 5.6.2 Agent 上下文

资产库可作为 Agent 的优质上下文源：

```
用户: "基于我过去项目的经验，帮我写一份新的 PRD"
Agent 读取:
  - 资产库中的 5 份历史 PRD（而非工作区中的 200+ 文件）
  - 每份 PRD 的 AI 摘要 + 核心内容片段
  → 输出高质量、有历史经验支撑的新 PRD
```

技术实现：
- 资产库提供 Tauri 命令接口 `query_assets`
- 返回资产列表 + 摘要 + 向量嵌入
- Agent 可通过语义搜索找到最相关的历史资产

---

## 六、数据模型设计

### 6.1 新增数据库表

#### `asset_tasks` — 沉淀任务表

```sql
CREATE TABLE IF NOT EXISTS asset_tasks (
    id              TEXT PRIMARY KEY,          -- 任务 ID (uuid)
    name            TEXT NOT NULL,             -- 任务名称 (用户自定义或自动生成)
    workspace_path  TEXT NOT NULL UNIQUE,      -- 监听的工作区路径
    status          TEXT NOT NULL DEFAULT 'running',  -- running / paused / scanning / error
    
    -- 规则定义 (JSON 序列化)
    policy_tags     TEXT,                      -- 标签规则: ["#终稿", "#获批", ...]
    policy_filters  TEXT,                      -- 属性筛选: JSON 数组
    policy_nl_desc  TEXT,                      -- 自然语言描述
    
    -- 统计信息
    total_files     INTEGER DEFAULT 0,         -- 工作区总文件数
    asset_count     INTEGER DEFAULT 0,         -- 资产数
    noise_count     INTEGER DEFAULT 0,         -- 噪声数
    pending_count   INTEGER DEFAULT 0,         -- 待确认数
    
    created_at      INTEGER NOT NULL,          -- 创建时间 (unix timestamp)
    updated_at      INTEGER NOT NULL,          -- 最后更新时间
    last_scan_at    INTEGER                    -- 最后扫描时间
);
```

#### `asset_items` — 资产索引表

```sql
CREATE TABLE IF NOT EXISTS asset_items (
    id              TEXT PRIMARY KEY,          -- 资产 ID (uuid)
    task_id         TEXT NOT NULL,             -- 所属任务 ID
    file_path       TEXT NOT NULL,             -- 文件绝对路径
    file_name       TEXT NOT NULL,             -- 文件名
    file_type       TEXT NOT NULL,             -- 文件扩展名
    file_size       INTEGER NOT NULL,          -- 文件大小 (bytes)
    modified_at     INTEGER NOT NULL,          -- 文件修改时间
    discovered_at   INTEGER NOT NULL,          -- 发现时间
    
    classification  TEXT NOT NULL DEFAULT 'ASSET',  -- ASSET / NOISE / PENDING
    confidence      REAL DEFAULT 0.0,          -- AI 判断置信度 (0.0 ~ 1.0)
    match_rule      TEXT,                      -- 命中的规则描述
    
    tags            TEXT,                      -- 标签: JSON 数组
    ai_summary      TEXT,                      -- AI 生成的内容摘要
    content_hash    TEXT,                      -- 文件内容 SHA256 (检测变更用)
    
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    
    FOREIGN KEY (task_id) REFERENCES asset_tasks(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_asset_items_task    ON asset_items(task_id);
CREATE INDEX IF NOT EXISTS idx_asset_items_class   ON asset_items(classification);
CREATE INDEX IF NOT EXISTS idx_asset_items_type    ON asset_items(file_type);
CREATE INDEX IF NOT EXISTS idx_asset_items_path    ON asset_items(file_path);
```

#### `asset_events` — 文件事件日志表

```sql
CREATE TABLE IF NOT EXISTS asset_events (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL,
    event_type      TEXT NOT NULL,             -- created / modified / renamed / deleted
    file_path       TEXT NOT NULL,
    old_path        TEXT,                      -- rename 时的旧路径
    classification  TEXT,                      -- 本次判定结果
    processed_at    INTEGER NOT NULL,
    
    FOREIGN KEY (task_id) REFERENCES asset_tasks(id)
);
```

### 6.2 向量索引扩展

复用现有的 `vec_files` 表（sqlite-vec），为资产文件存储内容嵌入向量：

```sql
-- 已有表结构，复用
CREATE VIRTUAL TABLE IF NOT EXISTS vec_files USING vec0(
    file_id TEXT PRIMARY KEY,
    embedding float[1024]
);
-- 资产文件的 embedding 以 "asset_{id}" 为 file_id 存入
```

### 6.3 配置表复用

复用现有 `archive_config` 表，新增配置项：

| key | value 示例 | 说明 |
|-----|-----------|------|
| `asset_distiller_enabled` | `"true"` | 全局开关 |
| `asset_default_export_format` | `"markdown"` | 默认导出格式 |

---

## 七、技术方案

### 7.1 技术架构图

```
┌─────────────── 前端 (React + Vite) ──────────────────────┐
│                                                          │
│  ToolboxView     AssetDistillerView    AssetBoardView    │
│  (工具箱入口)     (创建/编辑任务)        (资产看板)        │
│       │                │                    │            │
│       └────── invoke() ┼────────────────────┘            │
│                        │                                 │
├────────────── Tauri IPC Bridge ──────────────────────────┤
│                        │                                 │
│  ┌─────────── 后端 (Rust) ──────────────────────────────┐│
│  │                                                      ││
│  │  ┌──────────────┐  ┌──────────────┐                  ││
│  │  │ asset.rs     │  │ archive.rs   │  (已有模块)      ││
│  │  │ 资产沉淀模块  │  │ 知识归档模块  │                  ││
│  │  └──────┬───────┘  └──────────────┘                  ││
│  │         │                                            ││
│  │  ┌──────┴───────┐  ┌──────────────┐                  ││
│  │  │ fs_watcher   │  │ rule_engine  │                  ││
│  │  │ 文件监听器    │  │ 规则引擎     │                  ││
│  │  └──────────────┘  └──────┬───────┘                  ││
│  │                           │                          ││
│  │  ┌──────────────┐  ┌──────┴───────┐                  ││
│  │  │ SQLite       │  │ AI 判定层    │                  ││
│  │  │ + sqlite-vec │  │ (内容理解)   │                  ││
│  │  └──────────────┘  └──────────────┘                  ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 7.2 新增 Rust 模块：`asset.rs`

#### Tauri 命令清单

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `create_asset_task` | `workspace_path, name, policy` | `AssetTask` | 创建沉淀任务 |
| `update_asset_task` | `task_id, policy?, status?` | `AssetTask` | 更新任务配置/状态 |
| `delete_asset_task` | `task_id` | `bool` | 删除任务 |
| `list_asset_tasks` | — | `Vec<AssetTask>` | 列出所有任务 |
| `get_asset_task` | `task_id` | `AssetTask` | 获取任务详情 |
| `query_assets` | `task_id, classification?, tags?, file_type?, keyword?, page, page_size` | `AssetQueryResult` | 查询资产列表 |
| `classify_asset` | `item_id, classification` | `bool` | 手动分类（保留/过滤） |
| `batch_classify_assets` | `item_ids, classification` | `i64` | 批量分类 |
| `export_assets` | `task_id, format` | `String` (文件路径) | 导出资产清单 |
| `scan_workspace` | `task_id` | `ScanResult` | 手动触发全量扫描 |
| `get_asset_stats` | `task_id` | `AssetStats` | 获取统计信息 |

#### 核心数据结构

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct AssetPolicy {
    pub tags: Vec<String>,                // 标签规则
    pub filters: Vec<AssetFilter>,        // 属性筛选
    pub nl_description: Option<String>,   // 自然语言描述
    pub exclude_dirs: Vec<String>,        // 排除目录
    pub exclude_patterns: Vec<String>,    // 排除文件名模式
    pub include_types: Vec<String>,       // 保留文件类型白名单
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetFilter {
    pub field: String,       // file_type / file_size / modified_time / file_name
    pub operator: String,    // eq / ne / gt / lt / contains / excludes / regex
    pub value: String,       // 筛选值
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetTask {
    pub id: String,
    pub name: String,
    pub workspace_path: String,
    pub status: String,       // running / paused / scanning / error
    pub policy: AssetPolicy,
    pub stats: AssetStats,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetItem {
    pub id: String,
    pub task_id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub modified_at: i64,
    pub discovered_at: i64,
    pub classification: String,   // ASSET / NOISE / PENDING
    pub confidence: f64,
    pub match_rule: Option<String>,
    pub tags: Vec<String>,
    pub ai_summary: Option<String>,
    pub content_hash: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetStats {
    pub total_files: i64,
    pub asset_count: i64,
    pub noise_count: i64,
    pub pending_count: i64,
    pub saved_space_bytes: i64,   // 噪声文件总大小（节省空间量）
}
```

### 7.3 文件监听方案

```rust
// 使用 notify crate (跨平台文件系统监听)
// Cargo.toml 新增:
// notify = "6"

use notify::{Watcher, RecursiveMode, Event, EventKind};

// 每个 AssetTask 对应一个 watcher 实例
// 存储在 AppState 中: HashMap<task_id, notify::RecommendedWatcher>

// 事件处理流程:
// 1. Watcher 捕获事件 → 放入 mpsc channel
// 2. 后台线程消费 channel → 2秒防抖 → 调用 RuleEngine
// 3. RuleEngine 返回分类结果 → 写入 SQLite
// 4. 通过 Tauri event 通知前端刷新 UI
```

### 7.4 规则引擎流程

```rust
fn classify_file(
    file_path: &Path,
    policy: &AssetPolicy,
    ai_enabled: bool,
) -> ClassifyResult {
    // Phase 1: 硬性排除
    if is_excluded_by_dir(file_path, &policy.exclude_dirs) { return NOISE; }
    if is_excluded_by_pattern(file_path, &policy.exclude_patterns) { return NOISE; }
    
    // Phase 2: 类型白名单
    if !policy.include_types.is_empty() {
        if !is_included_type(file_path, &policy.include_types) { return NOISE; }
    }
    
    // Phase 3: 属性筛选
    let metadata = fs::metadata(file_path)?;
    if !pass_filters(&metadata, file_path, &policy.filters) { return NOISE; }
    
    // Phase 4: 标签匹配
    let file_name = file_path.file_name().to_str();
    if matches_any_tag(file_name, &policy.tags) { return ASSET(confidence: 0.85); }
    
    // Phase 5: AI 内容理解 (可选，异步)
    if ai_enabled && policy.nl_description.is_some() {
        let snippet = read_file_snippet(file_path, 2000)?;
        let result = ai_classify(snippet, policy.nl_description)?;
        return result;  // ASSET / NOISE / PENDING with confidence
    }
    
    // 默认: 待确认
    return PENDING(confidence: 0.5);
}
```

### 7.5 前端组件规划

| 组件 | 文件 | 职责 |
|------|------|------|
| `AssetDistillerSetup.jsx` | 新建 | 创建沉淀任务的向导（选工作区 → 定规则 → 预览 → 确认） |
| `AssetPolicyEditor.jsx` | 新建 | 沉淀规则编辑器（标签 + 属性 + NL 三维度） |
| `AssetBoardView.jsx` | 新建 | 资产看板主页（统计 + 列表 + 待确认） |
| `AssetItemCard.jsx` | 新建 | 单个资产项的卡片组件 |
| `AssetTaskManager.jsx` | 新建 | 多任务管理列表 |

---

## 八、用户旅程

### 8.1 首次使用旅程

```
用户打开工具箱
    │
    ├─→ 看到「智能资产沉淀」卡片（紫色渐变 + 💎 + AI 标签）
    │
    ├─→ 点击卡片 → 进入创建向导
    │     │
    │     ├─→ Step 1: 选择工作区文件夹
    │     │     └─→ 显示文件夹统计（89 个文件 · 3 层子目录 · 156 MB）
    │     │
    │     ├─→ Step 2: 定义沉淀规则
    │     │     ├─→ 选择预设模板「办公文档」
    │     │     │     └─→ 自动填充: 保留 .pdf/.docx/.pptx/.xlsx/.md
    │     │     │                    排除 node_modules, .git, dist
    │     │     ├─→ 添加自定义标签: #终稿 #获批
    │     │     └─→ 填写描述: "保留产品方案终稿和评审文档"
    │     │
    │     ├─→ Step 3: 预扫描结果
    │     │     └─→ 发现 12 个资产 · 65 个噪声 · 12 个待确认
    │     │         用户快速浏览，微调 2 个判定
    │     │
    │     └─→ 点击「确认启动」→ 任务开始运行
    │
    └─→ 自动跳转到「资产看板」
          └─→ 显示 12 个已识别资产 + 持续监听状态
```

### 8.2 日常使用旅程

```
用户正常工作（创建/编辑/删除文件）
    │
    ├─→ [后台] FS Watcher 捕获文件变更
    │     └─→ 规则引擎自动分类
    │           ├─→ 新的 final 版本 → 自动标记为 ASSET
    │           ├─→ 临时 .tmp 文件 → 自动标记为 NOISE
    │           └─→ 不确定的文件 → 标记为 PENDING
    │
    ├─→ 用户偶尔打开「资产看板」
    │     └─→ 看到新增资产 + 处理待确认项
    │
    └─→ 用户需要复用历史资产
          ├─→ 在看板中搜索/筛选
          └─→ 或让 Agent 从资产库中检索
```

---

## 九、规则预设模板

为降低上手门槛，提供 4 套预设模板：

### 9.1 办公文档模板

```json
{
  "name": "办公文档",
  "description": "适用于产品经理、运营、市场等岗位的日常办公场景",
  "tags": ["#终稿", "#final", "#获批", "#approved", "#评审", "#review"],
  "include_types": [".pdf", ".docx", ".pptx", ".xlsx", ".md", ".csv"],
  "exclude_dirs": ["node_modules", ".git", "dist", "build", "__pycache__", ".cache"],
  "exclude_patterns": ["*-draft-*", "temp_*", "~$*", "*.tmp", ".DS_Store"],
  "filters": [
    { "field": "file_size", "operator": "gt", "value": "1024" }
  ]
}
```

### 9.2 代码项目模板

```json
{
  "name": "代码项目",
  "description": "适用于研发工程师，保留源码和文档，过滤构建产物",
  "tags": ["#release", "#stable", "#config"],
  "include_types": [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".md", ".yaml", ".yml", ".toml", ".json"],
  "exclude_dirs": ["node_modules", ".git", "dist", "build", "target", "__pycache__", ".next", ".nuxt", "coverage", ".cache"],
  "exclude_patterns": ["*.log", "*.lock", "package-lock.json", "yarn.lock"],
  "filters": []
}
```

### 9.3 设计资产模板

```json
{
  "name": "设计资产",
  "description": "适用于设计师，保留高分辨率设计稿和交付物",
  "tags": ["#定稿", "#交付", "#final"],
  "include_types": [".psd", ".ai", ".sketch", ".fig", ".xd", ".png", ".jpg", ".svg", ".pdf"],
  "exclude_dirs": [".git", "node_modules", "cache"],
  "exclude_patterns": ["*-copy*", "*-副本*", "thumb_*", "*_preview*"],
  "filters": [
    { "field": "file_size", "operator": "gt", "value": "10240" }
  ]
}
```

### 9.4 通用模板

```json
{
  "name": "通用",
  "description": "适用于任意场景，仅做基本过滤",
  "tags": [],
  "include_types": [],
  "exclude_dirs": [".git", "node_modules", "__pycache__", ".cache"],
  "exclude_patterns": ["*.tmp", "*.log", "~$*", ".DS_Store", "Thumbs.db"],
  "filters": [
    { "field": "file_size", "operator": "gt", "value": "512" }
  ]
}
```

---

## 十、非功能需求

### 10.1 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 初始扫描速度 | ≤ 5 秒/千文件 | 纯规则匹配（不含 AI） |
| 事件响应延迟 | ≤ 3 秒 | 从文件变更到 UI 更新 |
| 内存占用 | ≤ 50 MB/任务 | 单个监听任务的增量内存 |
| SQLite 写入 | ≤ 10 ms/条 | 资产索引写入延迟 |
| 最大监听数 | 10,000 文件/任务 | 超出提示用户缩小范围 |

### 10.2 安全与隐私

| 要求 | 说明 |
|------|------|
| 本地处理 | 所有规则匹配和文件扫描在本地完成，文件内容不上传 |
| AI 层可选 | AI 内容理解为可选功能，用户可关闭，纯规则匹配仍可用 |
| 不修改文件 | 系统只读取和索引，**永远不修改或删除用户原始文件** |
| 数据清除 | 删除任务时，仅删除索引数据，用户文件不受影响 |

### 10.3 兼容性

| 平台 | 支持情况 |
|------|----------|
| macOS | 完整支持（FSEvents + notify crate） |
| Windows | 完整支持（ReadDirectoryChangesW） |
| Linux | 完整支持（inotify） |

---

## 十一、里程碑规划

| 阶段 | 范围 | 预计周期 |
|------|------|----------|
| **P0 — MVP** | 工具箱入口 + 选工作区 + 基础规则（类型/目录/模式） + 全量扫描 + 资产看板 | 2 周 |
| **P1 — 监听** | FS Watcher 后台监听 + 增量分类 + 事件防抖 + 任务管理 | 1 周 |
| **P2 — AI 增强** | NL 描述解析 + AI 内容理解 + 置信度评分 + 摘要生成 | 2 周 |
| **P3 — 输出消费** | Agent 上下文 API + 向量检索 + 资产导出 + Obsidian 集成 | 1 周 |

---

## 十二、开放问题

| # | 问题 | 影响范围 | 建议 |
|---|------|----------|------|
| 1 | AI 内容理解的模型选择？本地端侧模型 vs 云端 API | 性能 & 隐私 | 优先端侧小模型，大文件降级为规则 |
| 2 | 多任务同时监听时的性能上限？ | 系统资源 | 限制最大 3 个同时运行的任务 |
| 3 | 资产看板是否需要与归档时间线合并？ | 信息架构 | 建议保持独立，通过交叉链接互通 |
| 4 | PENDING 文件过多时如何降低用户负担？ | 体验 | AI 给出建议 + 批量操作 + 学习用户裁决 |
| 5 | 是否支持同一文件被多个任务命中？ | 数据模型 | 允许，每个任务独立索引 |

---

## 十三、附录

### A. 与现有模块的集成点

| 现有模块 | 集成方式 | 说明 |
|----------|----------|------|
| `archive.rs` (知识归档) | 共享 SQLite 连接 + 配置表 | 资产可导出为归档记录 |
| `db.rs` (数据库初始化) | 新增 3 张表的建表语句 | `asset_tasks` / `asset_items` / `asset_events` |
| `lib.rs` (应用入口) | `mod asset;` + 注册 11 个新命令 | 同现有模块注册模式 |
| `vec_files` (向量索引) | 复用表结构，资产以 `asset_` 前缀存入 | 支持语义搜索 |
| `ToolboxView.jsx` (工具箱) | 新增一个工具卡片 | 入口导航 |
| `App.jsx` (应用路由) | 新增 `asset_board` 导航项 | 侧边栏 + 路由 |

### B. 术语表

| 术语 | 定义 |
|------|------|
| 沉淀任务 (Asset Task) | 一个监听特定工作区的后台任务 |
| 沉淀规则 (Asset Policy) | 标签 + 属性 + NL 描述组合而成的筛选策略 |
| 资产 (Asset) | 被系统判定为有保留价值的文件 |
| 噪声 (Noise) | 被系统判定为中间产物/无需保留的文件 |
| 待确认 (Pending) | 系统无法确定，需用户裁决的文件 |
| 资产看板 (Asset Board) | 查看和管理沉淀结果的主界面 |

---

> **下一步**: 待产品评审确认后，按 P0 — MVP 阶段开始实施。
