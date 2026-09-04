//! 知识归档模块 — archive.rs
//!
//! 独立于 lib.rs 的归档能力模块（遵循「一能力一模块」约定）。
//! 包含 4 个 Tauri 命令：
//!   - archive_file       : 写入一条归档记录（md + SQLite 双写）
//!   - query_archives     : 按日期/项目/优先级/标签筛选 + 聚合统计
//!   - get_archive_config : 读取 vault 路径与 Obsidian 模式
//!   - set_archive_config : 写入 vault 路径与 Obsidian 模式
//!
//! 以及内部辅助：
//!   - detect_obsidian    : 检测目录下是否有 .obsidian/ 文件夹
//!   - build_md_block     : 拼装 Markdown 归档段落
//!   - parse_md_blocks    : 反解析 daily note 中的所有归档段落（供 S5 重建索引用）

use chrono::{Datelike, Local};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

/// Shared AppState — 复用 lib.rs 中的定义
/// (archive.rs 通过 `use crate::AppState;` 在 lib.rs 中引入)
use crate::AppState;

// ── Data structures ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchiveEntry {
    pub id: String,
    pub date: String,
    pub time: String,
    pub title: String,
    pub project: Option<String>,
    pub priority: Option<String>,
    #[serde(rename = "durationMin")]
    pub duration_min: Option<i64>,
    pub output: Option<String>,
    pub blocker: Option<String>,
    #[serde(rename = "nextAction")]
    pub next_action: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "linkedFiles")]
    pub linked_files: Option<Vec<String>>,
    #[serde(rename = "mdPath")]
    pub md_path: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    // ── 需求看板扩展字段 ──
    #[serde(rename = "demandId")]
    pub demand_id: Option<String>,
    #[serde(rename = "nodeType")]
    pub node_type: Option<String>,
    pub attachments: Option<String>,
    #[serde(rename = "isKeyConclusion")]
    pub is_key_conclusion: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchiveInput {
    pub title: String,
    pub project: Option<String>,
    pub priority: Option<String>,
    #[serde(rename = "durationMin")]
    pub duration_min: Option<i64>,
    pub output: Option<String>,
    pub blocker: Option<String>,
    #[serde(rename = "nextAction")]
    pub next_action: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "linkedFiles")]
    pub linked_files: Option<Vec<String>>,
    /// 自定义归档目录（可选）：如果提供，则覆盖全局 vault_path
    #[serde(rename = "customVaultPath")]
    pub custom_vault_path: Option<String>,
    // ── 需求看板扩展字段 ──
    #[serde(rename = "demandId")]
    pub demand_id: Option<String>,
    #[serde(rename = "nodeType")]
    pub node_type: Option<String>,
    pub attachments: Option<String>,
    #[serde(rename = "isKeyConclusion")]
    pub is_key_conclusion: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ArchiveQueryResult {
    pub entries: Vec<ArchiveEntry>,
    #[serde(rename = "totalCount")]
    pub total_count: usize,
    #[serde(rename = "totalDurationMin")]
    pub total_duration_min: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchiveConfig {
    #[serde(rename = "vaultPath")]
    pub vault_path: Option<String>,
    #[serde(rename = "obsidianMode")]
    pub obsidian_mode: Option<bool>,
    #[serde(rename = "dailyPattern")]
    pub daily_pattern: Option<String>,
}

// ── Helper: Detect .obsidian/ folder ─────────────────────────────

pub fn detect_obsidian(dir: &str) -> bool {
    let obsidian_dir = Path::new(dir).join(".obsidian");
    obsidian_dir.is_dir()
}

// ── Tauri Command: detect_obsidian_vault ─────────────────────────

#[tauri::command]
pub async fn detect_obsidian_vault(path: String) -> Result<bool, String> {
    Ok(detect_obsidian(&path))
}

// ── Helper: Generate archive ID ──────────────────────────────────

fn generate_archive_id(date: &str, time: &str, title: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    format!("{}|{}|{}", date, time, title).hash(&mut hasher);
    format!("arc_{:016x}", hasher.finish())
}

// ── Helper: Build markdown block ─────────────────────────────────

fn build_md_block(input: &ArchiveInput, time_str: &str, obsidian_mode: bool) -> String {
    let mut lines = Vec::new();

    // Header: ### ✅ HH:MM title
    lines.push(format!("### ✅ {} {}", time_str, input.title));

    // Metadata line: project · priority · duration
    let mut meta_parts = Vec::new();
    if let Some(ref proj) = input.project {
        if !proj.is_empty() {
            meta_parts.push(format!("项目：{}", proj));
        }
    }
    if let Some(ref pri) = input.priority {
        if !pri.is_empty() {
            meta_parts.push(format!("优先级：{}", pri));
        }
    }
    if let Some(dur) = input.duration_min {
        if dur > 0 {
            meta_parts.push(format!("耗时：{} min", dur));
        }
    }
    if !meta_parts.is_empty() {
        lines.push(format!("- {}", meta_parts.join(" · ")));
    }

    // Output
    if let Some(ref out) = input.output {
        if !out.is_empty() {
            lines.push(format!("- 关键产出：{}", out));
        }
    }

    // Blocker
    if let Some(ref blk) = input.blocker {
        if !blk.is_empty() {
            lines.push(format!("- 卡点：{}", blk));
        }
    }

    // Next action
    if let Some(ref na) = input.next_action {
        if !na.is_empty() {
            lines.push(format!("- 下一步：{}", na));
        }
    }

    // Linked files
    if let Some(ref files) = input.linked_files {
        if !files.is_empty() {
            let file_refs: Vec<String> = files
                .iter()
                .map(|f| {
                    let fname = Path::new(f)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    if obsidian_mode {
                        format!("[[{}]]", fname)
                    } else {
                        fname
                    }
                })
                .collect();
            lines.push(format!("- 关联文件：{}", file_refs.join(" · ")));
        }
    }

    // Tags
    if let Some(ref tags) = input.tags {
        if !tags.is_empty() {
            let tag_strs: Vec<String> = tags
                .iter()
                .map(|t| {
                    let clean = t.trim().trim_start_matches('#');
                    if obsidian_mode {
                        format!("#{}", clean)
                    } else {
                        format!("#{}", clean)
                    }
                })
                .collect();
            lines.push(format!("- 标签：{}", tag_strs.join(" ")));
        }
    }

    lines.push(String::new()); // trailing newline
    lines.join("\n")
}

// ── Helper: Compute daily note path ──────────────────────────────

fn daily_note_path(vault_root: &str, date: &str) -> PathBuf {
    // Default pattern: {vaultRoot}/30-daily/{YYYY}/{MM}/{YYYY-MM-DD}.md
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() == 3 {
        Path::new(vault_root)
            .join("30-daily")
            .join(parts[0])
            .join(parts[1])
            .join(format!("{}.md", date))
    } else {
        Path::new(vault_root)
            .join("30-daily")
            .join(format!("{}.md", date))
    }
}

// ── Tauri Command: archive_file ──────────────────────────────────

#[tauri::command]
pub async fn archive_file(
    input: ArchiveInput,
    state: State<'_, AppState>,
) -> Result<ArchiveEntry, String> {
    let now = Local::now();
    let date_str = now.format("%Y-%m-%d").to_string();
    let time_str = now.format("%H:%M").to_string();
    let created_at = now.timestamp();

    // 1. Read config — 优先使用 input.custom_vault_path，否则读取全局配置
    let (vault_path, obsidian_mode) = {
        let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let global_vp: String = conn
            .query_row(
                "SELECT value FROM archive_config WHERE key = 'vault_path'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_default();
        let om: String = conn
            .query_row(
                "SELECT value FROM archive_config WHERE key = 'obsidian_mode'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "false".to_string());

        // 自定义路径优先
        let effective_vp = input
            .custom_vault_path
            .as_ref()
            .filter(|p| !p.is_empty())
            .map(|p| p.clone())
            .unwrap_or(global_vp);

        (effective_vp, om == "true")
    };

    if vault_path.is_empty() {
        return Err("归档目录未配置，请先在设置中配置归档路径".to_string());
    }

    // 2. Build md block
    let md_block = build_md_block(&input, &time_str, obsidian_mode);

    // 3. Write to daily note file (append)
    let note_path = daily_note_path(&vault_path, &date_str);

    // Ensure parent directories exist
    if let Some(parent) = note_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    // If file doesn't exist, create with frontmatter header
    if !note_path.exists() {
        let header = format!(
            "---\ndate: {}\ntags: [daily]\n---\n\n# {}\n\n",
            date_str, date_str
        );
        fs::write(&note_path, header)
            .map_err(|e| format!("创建 daily note 失败: {}", e))?;
    }

    // Append the archive block
    let mut existing = fs::read_to_string(&note_path)
        .map_err(|e| format!("读取 daily note 失败: {}", e))?;
    if !existing.ends_with('\n') {
        existing.push('\n');
    }
    existing.push_str(&md_block);
    fs::write(&note_path, &existing)
        .map_err(|e| format!("写入 daily note 失败: {}", e))?;

    // 4. Write to SQLite
    let archive_id = generate_archive_id(&date_str, &time_str, &input.title);
    let md_path_str = note_path.to_string_lossy().to_string();
    let tags_json = input
        .tags
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()));

    {
        let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

        let is_key_i = if input.is_key_conclusion.unwrap_or(false) { 1i32 } else { 0i32 };
        conn.execute(
            "INSERT OR REPLACE INTO archives (id, date, time, title, project, priority, duration_min, output, blocker, next_action, tags, md_path, created_at, demand_id, node_type, attachments, is_key_conclusion) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            rusqlite::params![
                archive_id,
                date_str,
                time_str,
                input.title,
                input.project,
                input.priority,
                input.duration_min,
                input.output,
                input.blocker,
                input.next_action,
                tags_json,
                md_path_str,
                created_at,
                input.demand_id,
                input.node_type.as_deref().unwrap_or("progress"),
                input.attachments,
                is_key_i,
            ],
        )
        .map_err(|e| format!("写入 archives 表失败: {}", e))?;

        // Insert linked files
        if let Some(ref files) = input.linked_files {
            for file_path in files {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO archive_files (archive_id, file_path) VALUES (?1, ?2)",
                    rusqlite::params![archive_id, file_path],
                );
            }
        }
    }

    // 5. Return the created entry
    Ok(ArchiveEntry {
        id: archive_id,
        date: date_str,
        time: time_str,
        title: input.title,
        project: input.project,
        priority: input.priority,
        duration_min: input.duration_min,
        output: input.output,
        blocker: input.blocker,
        next_action: input.next_action,
        tags: input.tags,
        linked_files: input.linked_files,
        md_path: Some(md_path_str),
        created_at: Some(created_at),
        demand_id: input.demand_id,
        node_type: input.node_type,
        attachments: input.attachments,
        is_key_conclusion: input.is_key_conclusion,
    })
}

// ── Tauri Command: query_archives ────────────────────────────────

#[tauri::command]
pub async fn query_archives(
    date_from: Option<String>,
    date_to: Option<String>,
    project: Option<String>,
    priority: Option<String>,
    tag: Option<String>,
    search: Option<String>,
    state: State<'_, AppState>,
) -> Result<ArchiveQueryResult, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let mut sql = String::from(
        "SELECT a.id, a.date, a.time, a.title, a.project, a.priority, a.duration_min, a.output, a.blocker, a.next_action, a.tags, a.md_path, a.created_at, a.demand_id, a.node_type, a.attachments, a.is_key_conclusion FROM archives a WHERE 1=1"
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1;

    if let Some(ref df) = date_from {
        if !df.is_empty() {
            sql.push_str(&format!(" AND a.date >= ?{}", param_idx));
            params.push(Box::new(df.clone()));
            param_idx += 1;
        }
    }
    if let Some(ref dt) = date_to {
        if !dt.is_empty() {
            sql.push_str(&format!(" AND a.date <= ?{}", param_idx));
            params.push(Box::new(dt.clone()));
            param_idx += 1;
        }
    }
    if let Some(ref proj) = project {
        if !proj.is_empty() {
            sql.push_str(&format!(" AND a.project = ?{}", param_idx));
            params.push(Box::new(proj.clone()));
            param_idx += 1;
        }
    }
    if let Some(ref pri) = priority {
        if !pri.is_empty() {
            sql.push_str(&format!(" AND a.priority = ?{}", param_idx));
            params.push(Box::new(pri.clone()));
            param_idx += 1;
        }
    }
    if let Some(ref t) = tag {
        if !t.is_empty() {
            sql.push_str(&format!(" AND a.tags LIKE ?{}", param_idx));
            params.push(Box::new(format!("%\"{}\"%" , t)));
            param_idx += 1;
        }
    }
    if let Some(ref q) = search {
        if !q.is_empty() {
            sql.push_str(&format!(
                " AND (a.title LIKE ?{p} OR a.output LIKE ?{p} OR a.project LIKE ?{p} OR a.tags LIKE ?{p})",
                p = param_idx
            ));
            params.push(Box::new(format!("%{}%", q)));
            param_idx += 1;
        }
    }

    sql.push_str(" ORDER BY a.date DESC, a.time DESC");

    // Build params slice
    let params_ref: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL error: {}", e))?;
    let rows = stmt
        .query_map(params_ref.as_slice(), |row| {
            let is_key_raw: Option<i32> = row.get(16)?;
            Ok(ArchiveEntry {
                id: row.get(0)?,
                date: row.get(1)?,
                time: row.get(2)?,
                title: row.get(3)?,
                project: row.get(4)?,
                priority: row.get(5)?,
                duration_min: row.get(6)?,
                output: row.get(7)?,
                blocker: row.get(8)?,
                next_action: row.get(9)?,
                tags: row
                    .get::<_, Option<String>>(10)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                md_path: row.get(11)?,
                created_at: row.get(12)?,
                linked_files: None, // filled below
                demand_id: row.get(13)?,
                node_type: row.get(14)?,
                attachments: row.get(15)?,
                is_key_conclusion: Some(is_key_raw.unwrap_or(0) == 1),
            })
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut entries: Vec<ArchiveEntry> = Vec::new();
    for row_result in rows {
        if let Ok(entry) = row_result {
            entries.push(entry);
        }
    }

    // Fill linked files for each entry
    for entry in entries.iter_mut() {
        let files: Vec<String> = conn
            .prepare("SELECT file_path FROM archive_files WHERE archive_id = ?1")
            .ok()
            .and_then(|mut stmt| {
                stmt.query_map([&entry.id], |row| row.get(0))
                    .ok()
                    .map(|rows| rows.filter_map(|r| r.ok()).collect())
            })
            .unwrap_or_default();
        if !files.is_empty() {
            entry.linked_files = Some(files);
        }
    }

    let total_count = entries.len();
    let total_duration_min: i64 = entries
        .iter()
        .filter_map(|e| e.duration_min)
        .sum();

    Ok(ArchiveQueryResult {
        entries,
        total_count,
        total_duration_min,
    })
}

// ── Tauri Command: get_archive_config ────────────────────────────

#[tauri::command]
pub async fn get_archive_config(
    state: State<'_, AppState>,
) -> Result<ArchiveConfig, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let get_val = |key: &str| -> Option<String> {
        conn.query_row(
            "SELECT value FROM archive_config WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .ok()
    };

    let vault_path = get_val("vault_path");
    let obsidian_mode = get_val("obsidian_mode").map(|v| v == "true");
    let daily_pattern = get_val("daily_pattern");

    Ok(ArchiveConfig {
        vault_path,
        obsidian_mode,
        daily_pattern,
    })
}

// ── Tauri Command: set_archive_config ────────────────────────────

#[tauri::command]
pub async fn set_archive_config(
    config: ArchiveConfig,
    state: State<'_, AppState>,
) -> Result<ArchiveConfig, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let upsert = |key: &str, value: &str| -> Result<(), String> {
        conn.execute(
            "INSERT OR REPLACE INTO archive_config (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        )
        .map_err(|e| format!("Config write error: {}", e))?;
        Ok(())
    };

    // vault_path is required
    let vault_path = config.vault_path.clone().unwrap_or_default();
    if vault_path.is_empty() {
        return Err("归档目录路径不能为空".to_string());
    }

    // Validate directory exists
    if !Path::new(&vault_path).is_dir() {
        // Try to create it
        fs::create_dir_all(&vault_path)
            .map_err(|e| format!("创建归档目录失败: {}", e))?;
    }

    upsert("vault_path", &vault_path)?;

    // Auto-detect Obsidian if not explicitly set
    let obsidian_mode = config.obsidian_mode.unwrap_or_else(|| detect_obsidian(&vault_path));
    upsert("obsidian_mode", if obsidian_mode { "true" } else { "false" })?;

    // Daily pattern (default: 30-daily/{YYYY}/{MM}/{YYYY-MM-DD}.md)
    let pattern = config
        .daily_pattern
        .clone()
        .unwrap_or_else(|| "30-daily/{YYYY}/{MM}/{YYYY-MM-DD}.md".to_string());
    upsert("daily_pattern", &pattern)?;

    // Create PARA directory structure if vault is new
    let para_dirs = ["00-inbox", "10-projects", "20-areas", "30-daily", "90-archive"];
    for dir_name in &para_dirs {
        let dir_path = Path::new(&vault_path).join(dir_name);
        if !dir_path.exists() {
            let _ = fs::create_dir_all(&dir_path);
        }
    }

    Ok(ArchiveConfig {
        vault_path: Some(vault_path),
        obsidian_mode: Some(obsidian_mode),
        daily_pattern: Some(pattern),
    })
}

// ── Tauri Command: query_history_tags ─────────────────────────────
/// 从 archives 表中读取所有已使用过的标签（去重），按使用频次降序返回
#[tauri::command]
pub async fn query_history_tags(
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT tags FROM archives WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'")
        .map_err(|e| format!("SQL error: {}", e))?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Query error: {}", e))?;

    let mut tag_counts: HashMap<String, usize> = HashMap::new();

    for row_result in rows {
        if let Ok(tags_json) = row_result {
            if let Ok(tags) = serde_json::from_str::<Vec<String>>(&tags_json) {
                for tag in tags {
                    let clean = tag.trim().trim_start_matches('#').to_string();
                    if !clean.is_empty() {
                        *tag_counts.entry(clean).or_insert(0) += 1;
                    }
                }
            }
        }
    }

    // Sort by frequency descending, return top 30
    let mut sorted: Vec<(String, usize)> = tag_counts.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));

    Ok(sorted.into_iter().take(30).map(|(tag, _)| tag).collect())
}

// ── Tauri Command: query_recent_files ────────────────────────────
/// 返回最近操作过的文件列表（来自 files 表，按 modified_timestamp 降序）
#[derive(Debug, Serialize)]
pub struct RecentFileItem {
    pub name: String,
    pub path: String,
    pub size: String,
    #[serde(rename = "fileType")]
    pub file_type: String,
}

#[tauri::command]
pub async fn query_recent_files(
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<RecentFileItem>, String> {
    let max = limit.unwrap_or(20).min(50);
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let sql = format!(
        "SELECT name, path, size, file_type FROM files ORDER BY modified_timestamp DESC LIMIT {}",
        max
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL error: {}", e))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(RecentFileItem {
                name: row.get(0)?,
                path: row.get(1)?,
                size: row.get::<_, String>(2).unwrap_or_default(),
                file_type: row.get::<_, String>(3).unwrap_or_default(),
            })
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut items = Vec::new();
    for row_result in rows {
        if let Ok(item) = row_result {
            // Only include files that still exist on disk
            if Path::new(&item.path).exists() {
                items.push(item);
            }
        }
    }

    Ok(items)
}

// ── Tauri Command: ai_analyze_files ──────────────────────────────
/// AI 分析一组文件，返回建议的归档标题和关键产出摘要
#[derive(Debug, Serialize)]
pub struct AiAnalysisResult {
    pub title: String,
    pub output: String,
    pub tags: Vec<String>,
}

#[tauri::command]
pub async fn ai_analyze_files(
    file_paths: Vec<String>,
    cluster_name: Option<String>,
) -> Result<AiAnalysisResult, String> {
    // 1. Collect file snippets (use file_parser to read content)
    let mut snippets = Vec::new();
    let mut file_names = Vec::new();

    for fp in &file_paths {
        let p = Path::new(fp);
        let fname = p.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        file_names.push(fname.clone());

        // Read a short snippet for AI analysis
        match crate::file_parser::read_text_snippet(fp, 500) {
            Ok(snippet) if !snippet.is_empty() => {
                snippets.push(format!("文件「{}」内容摘要：{}", fname, snippet));
            }
            _ => {
                snippets.push(format!("文件「{}」（无法提取文本内容）", fname));
            }
        }
    }

    let files_summary = snippets.join("\n\n");
    let cluster_label = cluster_name.unwrap_or_else(|| "文件处理".to_string());

    // 2. Build prompt for Ollama
    let prompt = format!(
        r#"你是一个知识归档助手。请根据以下文件列表和内容摘要，生成一条归档记录的标题和关键产出描述。

文件簇名称：{}
文件列表和摘要：
{}

请严格按以下 JSON 格式输出，不要包含任何其他文字：
{{"title": "一句话归档标题", "output": "关键产出描述（2-3 句话）", "tags": ["标签1", "标签2"]}}
"#,
        cluster_label, files_summary
    );

    // 3. Call Ollama
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    #[derive(serde::Serialize)]
    struct GenReq<'a> {
        model: &'a str,
        prompt: &'a str,
        stream: bool,
    }

    #[derive(serde::Deserialize)]
    struct GenResp {
        response: String,
    }

    let req = GenReq {
        model: "qwen2.5:32b",
        prompt: &prompt,
        stream: false,
    };

    let ai_result = match client
        .post("http://localhost:11434/api/generate")
        .json(&req)
        .send()
        .await
    {
        Ok(res) => {
            match res.text().await {
                Ok(text) => {
                    match serde_json::from_str::<GenResp>(&text) {
                        Ok(body) => {
                            // Try to parse the AI response as our expected JSON
                            let resp_str = body.response.trim()
                                .replace("```json", "")
                                .replace("```", "")
                                .trim()
                                .to_string();
                            serde_json::from_str::<serde_json::Value>(&resp_str).ok()
                        }
                        Err(_) => None,
                    }
                }
                Err(_) => None,
            }
        }
        Err(_) => None,
    };

    // 4. Parse AI result or fallback
    if let Some(json_val) = ai_result {
        let title = json_val["title"]
            .as_str()
            .unwrap_or(&format!("{} 归档", cluster_label))
            .to_string();
        let output = json_val["output"]
            .as_str()
            .unwrap_or(&format!("已完成 {} 个文件的整理与归档。", file_paths.len()))
            .to_string();
        let tags: Vec<String> = json_val["tags"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        Ok(AiAnalysisResult { title, output, tags })
    } else {
        // Fallback: generate a basic result without AI
        let title = format!("{} 归档", cluster_label);
        let file_list_str = file_names
            .iter()
            .take(3)
            .cloned()
            .collect::<Vec<_>>()
            .join("、");
        let output = format!(
            "已完成 {} 个文件的整理与归档，包含{}{}的内容提取与分类。",
            file_paths.len(),
            file_list_str,
            if file_names.len() > 3 { "等文件" } else { "" }
        );

        Ok(AiAnalysisResult {
            title,
            output,
            tags: vec![],
        })
    }
}

// ── S5: MD Parser (反解析 daily note 中的归档段落) ───────────────

/// Parse a daily note file and extract all archive blocks.
/// Each block starts with `### ✅ HH:MM title` and contains subsequent `- field: value` lines.
pub fn parse_md_blocks(md_content: &str, md_path: &str, date: &str) -> Vec<ArchiveEntry> {
    let mut entries = Vec::new();
    let lines: Vec<&str> = md_content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();

        // Match: ### ✅ HH:MM title
        if line.starts_with("### ✅") || line.starts_with("### ✅ ") {
            let rest = line
                .trim_start_matches("### ✅")
                .trim_start_matches("### ✅ ")
                .trim();

            // Extract time (first 5 chars like "18:14")
            let (time_str, title) = if rest.len() >= 5 && rest.as_bytes()[2] == b':' {
                (rest[..5].to_string(), rest[5..].trim().to_string())
            } else {
                ("00:00".to_string(), rest.to_string())
            };

            let mut project = None;
            let mut priority = None;
            let mut duration_min = None;
            let mut output = None;
            let mut blocker = None;
            let mut next_action = None;
            let mut tags = Vec::new();
            let mut linked_files = Vec::new();

            i += 1;

            // Parse subsequent `- field: value` lines
            while i < lines.len() {
                let sub = lines[i].trim();
                if sub.starts_with("### ") || sub.starts_with("# ") || sub.starts_with("---") {
                    break; // next section
                }
                if sub.starts_with("- ") {
                    let content = &sub[2..];

                    // Parse meta line: 项目：X · 优先级：Y · 耗时：Z min
                    if content.contains("项目：") || content.contains("优先级：") || content.contains("耗时：") {
                        for part in content.split('·') {
                            let part = part.trim();
                            if let Some(val) = part.strip_prefix("项目：") {
                                project = Some(val.trim().to_string());
                            } else if let Some(val) = part.strip_prefix("优先级：") {
                                priority = Some(val.trim().to_string());
                            } else if let Some(val) = part.strip_prefix("耗时：") {
                                let num_str: String = val.chars().take_while(|c| c.is_ascii_digit()).collect();
                                duration_min = num_str.parse().ok();
                            }
                        }
                    } else if let Some(val) = content.strip_prefix("关键产出：") {
                        output = Some(val.trim().to_string());
                    } else if let Some(val) = content.strip_prefix("卡点：") {
                        blocker = Some(val.trim().to_string());
                    } else if let Some(val) = content.strip_prefix("下一步：") {
                        next_action = Some(val.trim().to_string());
                    } else if let Some(val) = content.strip_prefix("关联文件：") {
                        // Parse [[file]] or plain filenames separated by ·
                        for part in val.split('·') {
                            let clean = part
                                .trim()
                                .trim_start_matches("[[")
                                .trim_end_matches("]]")
                                .trim()
                                .to_string();
                            if !clean.is_empty() {
                                linked_files.push(clean);
                            }
                        }
                    } else if let Some(val) = content.strip_prefix("标签：") {
                        for part in val.split_whitespace() {
                            let tag = part.trim().trim_start_matches('#').to_string();
                            if !tag.is_empty() {
                                tags.push(tag);
                            }
                        }
                    }
                }
                i += 1;
            }

            let archive_id = generate_archive_id(date, &time_str, &title);
            entries.push(ArchiveEntry {
                id: archive_id,
                date: date.to_string(),
                time: time_str,
                title,
                project,
                priority,
                duration_min,
                output,
                blocker,
                next_action,
                tags: if tags.is_empty() { None } else { Some(tags) },
                linked_files: if linked_files.is_empty() {
                    None
                } else {
                    Some(linked_files)
                },
                md_path: Some(md_path.to_string()),
                created_at: None,
                demand_id: None,
                node_type: Some("progress".to_string()),
                attachments: None,
                is_key_conclusion: Some(false),
            });
        } else {
            i += 1;
        }
    }

    entries
}

// ── AI 智能预填归档表单 ──────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PrefillResult {
    pub title: String,
    pub project: String,
    pub priority: String,
    #[serde(rename = "durationMin")]
    pub duration_min: String,
    pub output: String,
    pub blocker: String,
    #[serde(rename = "nextAction")]
    pub next_action: String,
    pub tags: Vec<String>,
    /// PM 需求流程中的当前阶段 (1-10)
    #[serde(rename = "currentStage")]
    pub current_stage: Option<String>,
    /// 每个字段的置信度 (0.0-1.0)，前端据此标记「AI 推荐」或「待确认」
    pub confidence: HashMap<String, f64>,
}

/// 将前端粘贴的图片二进制数据写入临时文件，返回文件路径
#[tauri::command]
pub fn write_temp_image(
    file_name: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("file_manager_ocr");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("创建临时目录失败: {}", e))?;
    let file_path = temp_dir.join(&file_name);
    std::fs::write(&file_path, &data)
        .map_err(|e| format!("写入临时图片失败: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

/// OCR 识别截图/照片并用 AI 总结关键结论
#[tauri::command]
pub async fn ocr_and_summarize(
    image_path: String,
) -> Result<String, String> {
    // 1. OCR 提取文字
    let ocr_text = crate::file_parser::perform_mac_ocr(&image_path)
        .ok_or_else(|| "OCR 识别失败：无法提取图片中的文字".to_string())?;

    if ocr_text.trim().is_empty() {
        return Err("图片中未识别到文字内容".to_string());
    }

    // 2. 用 Ollama 总结关键结论
    let prompt = format!(
        r#"以下是从一张截图/照片中 OCR 提取的文字内容。请用 1-3 句话总结其中的关键结论或核心信息。

要求：
1. 只总结截图中的实际内容（数据、结论、状态），不要描述"保存图片"、"截图归档"等操作过程
2. 简洁、有实质内容，直接输出总结
3. 不要包含任何前缀、解释或对截图操作本身的描述

OCR 提取内容：
{}

请直接输出总结："#,
        ocr_text.chars().take(2000).collect::<String>()
    );

    match call_ollama_generate(&prompt).await {
        Ok(summary) => Ok(summary.trim().to_string()),
        Err(_) => {
            // Ollama 不可用时，直接返回 OCR 原文（截取前 500 字）
            let truncated: String = ocr_text.chars().take(500).collect();
            Ok(truncated)
        }
    }
}

/// 多源信息聚合体——内部使用，不暴露
struct PrefillContext {
    file_contents: Vec<(String, String)>,     // (文件名, 文件内容片段)
    ai_summaries: Vec<(String, String)>,      // (文件名, 向量库中的 AI 摘要)
    file_metadata: Vec<(String, String, i64)>,// (文件名, 文件类型, 修改时间戳)
    history_projects: Vec<String>,            // 历史项目名
    history_tags: Vec<String>,                // 历史标签
    recent_archives: Vec<(String, String, Option<String>)>, // 最近5条归档的 (title, output, project)
}

/// 智能预填：接收用户选中的文件列表，多源融合后通过 AI 生成表单预填数据
#[tauri::command]
pub async fn smart_prefill_archive(
    state: State<'_, AppState>,
    file_paths: Vec<String>,
) -> Result<PrefillResult, String> {
    if file_paths.is_empty() {
        return Err("请至少选择一个文件".to_string());
    }

    // ── 阶段1: 多源数据采集（全在 DB lock 范围内完成）──
    let ctx = {
        let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

        // 1a. 解析文件内容
        let mut file_contents = Vec::new();
        let mut file_metadata = Vec::new();
        for fp in &file_paths {
            let p = Path::new(fp);
            let fname = p.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let ext = p.extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();
            let mtime = p.metadata()
                .and_then(|m| m.modified())
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
                .unwrap_or(0);

            file_metadata.push((fname.clone(), ext, mtime));

            // 读取较长的内容片段（3000字），为 AI 提供充足上下文
            match crate::file_parser::read_text_snippet(fp, 3000) {
                Ok(snippet) if !snippet.is_empty() => {
                    file_contents.push((fname, snippet));
                }
                _ => {
                    file_contents.push((fname, String::new()));
                }
            }
        }

        // 1b. 查向量库的 AI 摘要
        let mut ai_summaries = Vec::new();
        for fp in &file_paths {
            let fname = Path::new(fp)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let summary: Option<String> = conn
                .query_row(
                    "SELECT ai_summary FROM asset_items WHERE file_path = ?1 AND ai_summary IS NOT NULL",
                    rusqlite::params![fp],
                    |row| row.get(0),
                )
                .ok();
            if let Some(s) = summary {
                if !s.trim().is_empty() {
                    ai_summaries.push((fname, s));
                }
            }
        }

        // 1c. 查历史项目名（去重 + 按频次排序）
        let history_projects: Vec<String> = {
            let mut results = Vec::new();
            if let Ok(mut stmt) = conn.prepare("SELECT project, COUNT(*) as cnt FROM archives WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY cnt DESC LIMIT 20") {
                if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                    for r in rows.flatten() {
                        if !r.is_empty() {
                            results.push(r);
                        }
                    }
                }
            }
            results
        };

        // 1d. 查历史标签（去重 + 按频次排序 top 30）
        let history_tags: Vec<String> = {
            let mut tag_counts: HashMap<String, usize> = HashMap::new();
            if let Ok(mut stmt) = conn.prepare("SELECT tags FROM archives WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'") {
                if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                    for row in rows.flatten() {
                        if let Ok(tags) = serde_json::from_str::<Vec<String>>(&row) {
                            for tag in tags {
                                let clean = tag.trim().trim_start_matches('#').to_string();
                                if !clean.is_empty() {
                                    *tag_counts.entry(clean).or_insert(0) += 1;
                                }
                            }
                        }
                    }
                }
            }
            let mut sorted: Vec<(String, usize)> = tag_counts.into_iter().collect();
            sorted.sort_by(|a, b| b.1.cmp(&a.1));
            sorted.into_iter().take(30).map(|(t, _)| t).collect()
        };

        // 1e. 查最近5条归档记录（为上下文连续性提供参考）
        let recent_archives: Vec<(String, String, Option<String>)> = {
            let mut results = Vec::new();
            if let Ok(mut stmt) = conn.prepare(
                "SELECT title, output, project FROM archives ORDER BY created_at DESC LIMIT 5"
            ) {
                if let Ok(rows) = stmt.query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1).unwrap_or_default(),
                        row.get::<_, Option<String>>(2)?,
                    ))
                }) {
                    for r in rows.flatten() {
                        results.push(r);
                    }
                }
            }
            results
        };

        PrefillContext {
            file_contents,
            ai_summaries,
            file_metadata,
            history_projects,
            history_tags,
            recent_archives,
        }
    }; // conn dropped here — safe for await

    // ── 阶段2: 构建增强 prompt ──
    let prompt = build_smart_prefill_prompt(&ctx);

    // ── 阶段3: 调用 Ollama ──
    let ai_result = call_ollama_generate(&prompt).await;

    // ── 阶段4: 解析 AI 返回 + 置信度评估 ──
    match ai_result {
        Ok(raw_text) => parse_prefill_response(&raw_text, &ctx),
        Err(_) => Ok(build_fallback_prefill(&ctx)),
    }
}

/// 构建多维度增强 prompt
fn build_smart_prefill_prompt(ctx: &PrefillContext) -> String {
    // 文件内容区
    let files_section: String = ctx.file_contents.iter().map(|(name, content)| {
        if content.is_empty() {
            format!("### 文件: {}\n（无法提取文本内容）\n", name)
        } else {
            // 截取前 1500 字避免 prompt 过长
            let truncated: String = content.chars().take(1500).collect();
            format!("### 文件: {}\n{}\n", name, truncated)
        }
    }).collect::<Vec<_>>().join("\n");

    // 向量库 AI 摘要区（如果有）
    let summaries_section = if ctx.ai_summaries.is_empty() {
        String::new()
    } else {
        let items: String = ctx.ai_summaries.iter()
            .map(|(name, summary)| format!("- {}: {}", name, summary))
            .collect::<Vec<_>>()
            .join("\n");
        format!("\n## 向量知识库中的文件摘要（已预处理的高质量摘要，优先参考）\n{}\n", items)
    };

    // 文件元信息区
    let metadata_section: String = ctx.file_metadata.iter().map(|(name, ext, mtime)| {
        let time_str = chrono::DateTime::from_timestamp(*mtime, 0)
            .map(|dt| dt.with_timezone(&Local).format("%Y-%m-%d %H:%M").to_string())
            .unwrap_or_else(|| "未知".to_string());
        format!("- {} (类型: .{}, 最后修改: {})", name, ext, time_str)
    }).collect::<Vec<_>>().join("\n");

    // 历史项目名
    let projects_str = if ctx.history_projects.is_empty() {
        "（暂无历史项目）".to_string()
    } else {
        ctx.history_projects.join("、")
    };

    // 历史标签
    let tags_str = if ctx.history_tags.is_empty() {
        "（暂无历史标签）".to_string()
    } else {
        ctx.history_tags.iter().map(|t| format!("#{}", t)).collect::<Vec<_>>().join(" ")
    };

    // 最近归档记录
    let recent_section = if ctx.recent_archives.is_empty() {
        String::new()
    } else {
        let items: String = ctx.recent_archives.iter()
            .map(|(title, output, proj)| {
                format!("- 「{}」 项目:{} 产出:{}", title, proj.as_deref().unwrap_or("-"), output)
            })
            .collect::<Vec<_>>()
            .join("\n");
        format!("\n## 最近的归档记录（参考工作连续性和命名风格）\n{}\n", items)
    };

    format!(
        r#"你是一位资深产品经理的 AI 工作助手。用户选择了一些工作文件，你需要基于这些文件内容帮助用户快速填写归档表单。

## 产品经理标准需求流程（10 步）
1. 调研
2. 写需求文档
3. 和研发确认方案可行性，初步落定技术方案
4. 和设计对页面及交互
5. 给研发讲需求开始开发（或拉设计、研发一起开评审，共识方案）
6. 设计埋点上报
7. 走查-测试
8. 实验
9. LR 汇报
10. 发布

## 用户选择的文件
{files_section}
{summaries_section}
## 文件元信息
{metadata_section}

## 历史项目名（优先从中匹配，避免创建重复项目名）
{projects_str}

## 历史标签（优先复用已有标签）
{tags_str}
{recent_section}
## 你的任务

根据文件内容，推理出用户刚刚完成的工作，并填写以下归档表单。请遵循以下策略：

### 字段提取策略

1. **项目名**（最关键字段，决定归档归属）：
   - 提取路径：文件名中的主体名词 → 文档标题/一级标题中的主体名词 → 文中出现频率最高的专有名词 → 摘要中的关键主体
   - 优先从历史项目名中匹配，只有完全无匹配时才新建
   - 项目名应简短有辨识度，去掉"的""了"等虚词，例如"Q3增长策略"而不是"关于Q3用户增长策略的调研"

2. **标签**（2-4个，支持多维度）：
   - 可以是产品工作流程中的某一步（如"调研""需求文档""技术评审""走查测试"）
   - 也可以是具体项目名或功能模块名（如"AI归档""搜索优化""首页改版"）
   - 也可以是文档类型（如"PRD""竞品分析""数据报告""会议纪要"）
   - 优先复用历史标签，确保标签体系一致

3. **标题**：用「动词 + 对象 + 结果」的格式，15 字以内，如"完成 XX 功能 PRD 初稿"

4. **关键产出**（核心总结字段）：
   - 基于文件摘要和原文内容，总结本文件完成了什么任务、得到什么结果或结论
   - 格式：「完成了XX → 得出结论/产出了XX → 达到了XX程度」
   - 控制在 2-4 句话，要有实质内容而非泛泛描述

5. **优先级**：根据文档内容中的紧急程度关键词判断（紧急/P0/blocked → P0，常规推进 → P1，低优 → P2）

6. **耗时**：根据文档复杂度和完成度估算，以30分钟为最小单位，输出必须是30的整数倍（如30/60/90/120/150/180/240），需求文档通常 60-120 min，调研报告 30-60 min

7. **卡点**：从文件内容中提取待确认/待决策/阻塞项，没有则留空字符串

8. **待办**：根据需求流程推断下一步动作，如当前在「写需求文档」阶段则下一步是「和研发确认技术方案」

9. **当前阶段**：判断文件对应需求流程的哪一步（输出阶段名称如"写需求文档"，而非数字）

10. **置信度**：对每个字段给出 0.0-1.0 的置信度，依据是信息来源的充分程度

### 信息优先级
- 向量知识库中的摘要 > 文件原文内容 > 文件名推断 > 文件类型和时间推断
- 项目名优先从「文件名主体 + 文档标题」交叉验证，而非仅靠一个来源

严格按以下 JSON 格式输出，不要包含任何其他文字或 markdown 标记：
{{
  "title": "归档标题",
  "project": "项目名",
  "priority": "P0/P1/P2",
  "durationMin": "预估耗时分钟数（纯数字字符串）",
  "output": "关键产出描述",
  "blocker": "卡点描述，没有则为空字符串",
  "nextAction": "下一步待办",
  "tags": ["标签1", "标签2"],
  "currentStage": "当前所处的需求流程阶段名称",
  "confidence": {{
    "title": 0.9,
    "project": 0.8,
    "priority": 0.6,
    "durationMin": 0.5,
    "output": 0.85,
    "blocker": 0.7,
    "nextAction": 0.75,
    "tags": 0.8,
    "currentStage": 0.7
  }}
}}"#,
        files_section = files_section,
        summaries_section = summaries_section,
        metadata_section = metadata_section,
        projects_str = projects_str,
        tags_str = tags_str,
        recent_section = recent_section,
    )
}

/// 解析 Ollama 返回的 JSON 并构建 PrefillResult
fn parse_prefill_response(raw: &str, ctx: &PrefillContext) -> Result<PrefillResult, String> {
    // 清洗：去掉可能的 ```json 包裹
    let cleaned = raw.trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    match serde_json::from_str::<serde_json::Value>(cleaned) {
        Ok(json) => {
            let title = json["title"].as_str().unwrap_or("").to_string();
            let project = json["project"].as_str().unwrap_or("").to_string();
            let priority = json["priority"].as_str().unwrap_or("").to_string();
            let duration_min = json["durationMin"].as_str()
                .or_else(|| json["durationMin"].as_i64().map(|_| ""))
                .unwrap_or("")
                .to_string();
            // 如果 durationMin 是数字类型，转为字符串
            let duration_min = if duration_min.is_empty() {
                json["durationMin"].as_i64().map(|n| n.to_string()).unwrap_or_default()
            } else {
                duration_min
            };
            let output = json["output"].as_str().unwrap_or("").to_string();
            let blocker = json["blocker"].as_str().unwrap_or("").to_string();
            let next_action = json["nextAction"].as_str().unwrap_or("").to_string();
            let current_stage = json["currentStage"].as_str().map(|s| s.to_string());

            let tags: Vec<String> = json["tags"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            // 解析置信度
            let mut confidence = HashMap::new();
            if let Some(conf_obj) = json["confidence"].as_object() {
                for (k, v) in conf_obj {
                    if let Some(score) = v.as_f64() {
                        confidence.insert(k.clone(), score);
                    }
                }
            }

            // 后处理：交叉验证项目名
            let final_project = if !project.is_empty() {
                // 如果 AI 给的项目名在历史中有近似匹配，使用历史名
                let matched = ctx.history_projects.iter().find(|hp| {
                    hp.contains(&project) || project.contains(hp.as_str())
                });
                matched.cloned().unwrap_or(project)
            } else {
                project
            };

            // 后处理：标签去重 + 优先用历史标签
            let final_tags: Vec<String> = tags.iter().map(|t| {
                let clean = t.trim().trim_start_matches('#').to_string();
                // 如果历史标签中有完全匹配或近似匹配，使用历史版本
                ctx.history_tags.iter()
                    .find(|ht| ht.eq_ignore_ascii_case(&clean) || ht.contains(&clean) || clean.contains(ht.as_str()))
                    .cloned()
                    .unwrap_or(clean)
            }).collect();

            Ok(PrefillResult {
                title,
                project: final_project,
                priority,
                duration_min,
                output,
                blocker,
                next_action,
                tags: final_tags,
                current_stage,
                confidence,
            })
        }
        Err(_) => {
            // JSON 解析失败，返回 fallback
            Ok(build_fallback_prefill(ctx))
        }
    }
}

/// Ollama 不可用或返回解析失败时的降级结果
fn build_fallback_prefill(ctx: &PrefillContext) -> PrefillResult {
    let file_names: Vec<&str> = ctx.file_contents.iter()
        .map(|(n, _)| n.as_str())
        .collect();

    // 从文件名推断标题
    let title = if file_names.len() == 1 {
        // 去掉扩展名作为标题
        let name = file_names[0];
        let base = name.rsplit_once('.').map(|(base, _)| base).unwrap_or(name);
        format!("完成 {} 相关工作", base)
    } else {
        format!("完成 {} 等 {} 个文件的整理", file_names[0], file_names.len())
    };

    // 从文件名和内容推断可能的项目
    let project = ctx.history_projects.first().cloned().unwrap_or_default();

    // 用 AI 摘要作为产出描述
    let output = if !ctx.ai_summaries.is_empty() {
        ctx.ai_summaries.iter()
            .map(|(name, summary)| format!("{}:{}", name, summary))
            .collect::<Vec<_>>()
            .join("；")
    } else {
        format!("完成了 {} 个文件的产出", file_names.len())
    };

    let mut confidence = HashMap::new();
    confidence.insert("title".to_string(), 0.3);
    confidence.insert("project".to_string(), 0.2);
    confidence.insert("output".to_string(), if ctx.ai_summaries.is_empty() { 0.2 } else { 0.5 });

    PrefillResult {
        title,
        project,
        priority: String::new(),
        duration_min: String::new(),
        output,
        blocker: String::new(),
        next_action: String::new(),
        tags: vec![],
        current_stage: None,
        confidence,
    }
}

// ── 通用工具：写入文本文件 ─────────────────────────────────────
#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("写入文件失败: {}", e))
}

// ── AI Report: 周报生成 ─────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct AiReportResult {
    pub markdown: String,
    #[serde(rename = "recordCount")]
    pub record_count: usize,
    #[serde(rename = "totalMinutes")]
    pub total_minutes: i64,
}

/// 生成 AI 周报：自动读取本周（周一到今天）的所有归档记录，通过 Ollama 生成结构化周报
#[tauri::command]
pub async fn generate_weekly_report(
    state: State<'_, AppState>,
) -> Result<AiReportResult, String> {
    // 计算本周一和今天的日期
    let now = Local::now();
    let weekday = now.weekday().num_days_from_monday(); // 0=Mon, 6=Sun
    let monday = now - chrono::Duration::days(weekday as i64);
    let date_from = monday.format("%Y-%m-%d").to_string();
    let date_to = now.format("%Y-%m-%d").to_string();

    // 查询本周所有归档
    let entries = query_archives_internal(&state, Some(&date_from), Some(&date_to), None, None)?;

    if entries.is_empty() {
        return Ok(AiReportResult {
            markdown: format!(
                "# 周报（{} ~ {}）\n\n> 本周暂无归档记录。快速归档你的工作产出，AI 将为你生成结构化周报。\n",
                date_from, date_to
            ),
            record_count: 0,
            total_minutes: 0,
        });
    }

    let total_minutes: i64 = entries.iter().filter_map(|e| e.duration_min).sum();
    let record_count = entries.len();

    // 查询附件文件的 AI 摘要（使用作用域块确保 MutexGuard 在 await 前释放）
    let file_summaries = {
        let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let archive_ids: Vec<String> = entries.iter().map(|e| e.id.clone()).collect();
        query_file_summaries_for_archives(&conn, &archive_ids)
    };

    // 拼接归档数据摘要（含附件摘要）
    let entries_text = entries
        .iter()
        .map(|e| {
            let tags_str = e.tags.as_ref()
                .map(|t| t.join(", "))
                .unwrap_or_default();
            let mut line = format!(
                "- [{} {}] {} | 项目: {} | 优先级: {} | 耗时: {}min | 产出: {} | 卡点: {} | 下一步: {} | 标签: {}",
                e.date, e.time, e.title,
                e.project.as_deref().unwrap_or("-"),
                e.priority.as_deref().unwrap_or("-"),
                e.duration_min.unwrap_or(0),
                e.output.as_deref().unwrap_or("-"),
                e.blocker.as_deref().unwrap_or("无"),
                e.next_action.as_deref().unwrap_or("-"),
                if tags_str.is_empty() { "-".to_string() } else { tags_str },
            );
            // 附加附件摘要
            if let Some(files) = file_summaries.get(&e.id) {
                if !files.is_empty() {
                    let summaries: Vec<String> = files.iter()
                        .map(|(name, summary)| format!("    - 📎 {}: {}", name, summary))
                        .collect();
                    line.push_str(&format!("\n  附件摘要:\n{}", summaries.join("\n")));
                }
            }
            line
        })
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"你是一个专业的工作周报撰写助手。请根据以下本周的工作归档记录，生成一份结构化的工作周报。

## 周报时间范围
{} ~ {}（共 {} 条归档记录，累计投入 {} 小时）

## 本周归档数据
{}

## 周报要求
请严格按照以下 Markdown 格式输出周报，确保内容完整、专业：

```
# 工作周报（{} ~ {}）

## 一、本周工作总结

### 按项目分组
（将所有归档按项目分组，每个项目列出完成的事项和关键产出）

### 关键成果
（提炼本周最重要的 3-5 项成果，突出量化指标和交付物）

## 二、时间投入分析
（按项目统计时间分配，标注投入最多的方向）

## 三、卡点与风险
（汇总所有卡点，按严重程度排序，给出建议解决方案）

## 四、下周计划
（基于本周的"下一步"字段和卡点，整理出下周工作计划）

## 五、个人反思
（基于本周工作模式，给出 1-2 条效率提升建议）
```

注意：
1. 直接输出 Markdown 正文，不要包含 ``` 代码块标记
2. 内容要基于实际归档数据，不要编造
3. 适当使用 emoji 让报告更易读
4. 如果归档数据中有卡点，要重点分析并提出解决思路
5. 如果归档记录附带了附件摘要（📎标记），请将这些文件的内容纳入分析，作为工作产出的佐证
6. 关注「下一步」字段，据此生成合理的下周计划
"#,
        date_from, date_to, record_count, format!("{:.1}", total_minutes as f64 / 60.0),
        entries_text,
        date_from, date_to,
    );

    let markdown = call_ollama_generate(&prompt).await.unwrap_or_else(|_| {
        // Ollama 不可用时的降级输出
        generate_fallback_weekly_report(&entries, &date_from, &date_to)
    });

    Ok(AiReportResult {
        markdown,
        record_count,
        total_minutes,
    })
}

/// 生成项目总结：按指定标签读取所有相关归档记录，通过 Ollama 生成项目汇总
#[tauri::command]
pub async fn generate_project_summary(
    tags: Vec<String>,
    state: State<'_, AppState>,
) -> Result<AiReportResult, String> {
    if tags.is_empty() {
        return Err("请至少选择一个标签".to_string());
    }

    // 查询包含任一标签的所有归档
    let all_entries = query_archives_internal(&state, None, None, None, None)?;
    let entries: Vec<&ArchiveEntry> = all_entries
        .iter()
        .filter(|e| {
            if let Some(ref etags) = e.tags {
                tags.iter().any(|t| etags.contains(t))
            } else {
                false
            }
        })
        .collect();

    if entries.is_empty() {
        return Ok(AiReportResult {
            markdown: format!(
                "# 项目总结 — {}\n\n> 未找到与标签 [{}] 相关的归档记录。\n",
                tags.join(" / "),
                tags.join(", ")
            ),
            record_count: 0,
            total_minutes: 0,
        });
    }

    let total_minutes: i64 = entries.iter().filter_map(|e| e.duration_min).sum();
    let record_count = entries.len();

    // 查询附件文件的 AI 摘要（使用作用域块确保 MutexGuard 在 await 前释放）
    let file_summaries = {
        let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let archive_ids: Vec<String> = entries.iter().map(|e| e.id.clone()).collect();
        query_file_summaries_for_archives(&conn, &archive_ids)
    };

    let entries_text = entries
        .iter()
        .map(|e| {
            let mut line = format!(
                "- [{} {}] {} | 项目: {} | 优先级: {} | 耗时: {}min | 产出: {} | 卡点: {} | 下一步: {} | 标签: {}",
                e.date, e.time, e.title,
                e.project.as_deref().unwrap_or("-"),
                e.priority.as_deref().unwrap_or("-"),
                e.duration_min.unwrap_or(0),
                e.output.as_deref().unwrap_or("-"),
                e.blocker.as_deref().unwrap_or("无"),
                e.next_action.as_deref().unwrap_or("-"),
                e.tags.as_ref().map(|t| t.join(", ")).unwrap_or_default(),
            );
            if let Some(files) = file_summaries.get(&e.id) {
                if !files.is_empty() {
                    let summaries: Vec<String> = files.iter()
                        .map(|(name, summary)| format!("    - 📎 {}: {}", name, summary))
                        .collect();
                    line.push_str(&format!("\n  附件摘要:\n{}", summaries.join("\n")));
                }
            }
            line
        })
        .collect::<Vec<_>>()
        .join("\n");

    let tags_label = tags.join(" / ");
    let prompt = format!(
        r#"你是一个专业的项目总结撰写助手。请根据以下归档记录，生成一份关于「{}」方向的项目总结。

## 筛选标签
{}

## 归档数据（共 {} 条记录，累计投入 {} 小时）
{}

## 总结要求
请严格按照以下 Markdown 格式输出，确保内容完整、专业：

# 项目总结 — {}

## 一、项目概览
（项目背景、目标、当前所处阶段的总体概述）

## 二、工作进展
### 已完成事项
（按时间顺序列出所有已完成的工作，突出关键产出和交付物）

### 进行中事项
（基于"下一步"字段提炼仍在推进的事项）

## 三、关键成果
（提炼最重要的成果和里程碑，使用量化指标）

## 四、问题与卡点
（汇总所有遇到的卡点，分析根因，给出解决建议）

## 五、经验沉淀
（总结该项目中积累的可复用经验和方法论）

## 六、后续规划
（基于当前进展，给出下一步推进建议）

注意：
1. 直接输出 Markdown 正文，不要包含 ``` 代码块标记
2. 内容要基于实际归档数据，不要编造
3. 适当使用 emoji 让报告更易读
4. 如果归档记录附带了附件摘要（📎标记），请将文件内容纳入分析，作为项目成果的佐证
5. 重点分析卡点和待办，提出切实的解决建议
"#,
        tags_label, tags_label, record_count, format!("{:.1}", total_minutes as f64 / 60.0),
        entries_text, tags_label,
    );

    let markdown = call_ollama_generate(&prompt).await.unwrap_or_else(|_| {
        generate_fallback_project_summary(&entries, &tags_label)
    });

    Ok(AiReportResult {
        markdown,
        record_count,
        total_minutes,
    })
}

/// 生成分析报告：自定义时间范围 + 标签范围，AI 深度分析
#[tauri::command]
pub async fn generate_analysis_report(
    date_from: Option<String>,
    date_to: Option<String>,
    tags: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<AiReportResult, String> {
    let all_entries = query_archives_internal(
        &state,
        date_from.as_deref(),
        date_to.as_deref(),
        None,
        None,
    )?;

    // 按标签进一步过滤（如果指定了标签）
    let entries: Vec<&ArchiveEntry> = if let Some(ref filter_tags) = tags {
        if filter_tags.is_empty() {
            all_entries.iter().collect()
        } else {
            all_entries
                .iter()
                .filter(|e| {
                    if let Some(ref etags) = e.tags {
                        filter_tags.iter().any(|t| etags.contains(t))
                    } else {
                        false
                    }
                })
                .collect()
        }
    } else {
        all_entries.iter().collect()
    };

    let date_from_label = date_from.as_deref().unwrap_or("最早");
    let date_to_label = date_to.as_deref().unwrap_or("最新");
    let tags_label = tags
        .as_ref()
        .map(|t| t.join(", "))
        .unwrap_or_else(|| "全部".to_string());

    if entries.is_empty() {
        return Ok(AiReportResult {
            markdown: format!(
                "# 分析报告（{} ~ {}）\n\n> 在所选范围内未找到归档记录。请调整时间范围或标签筛选条件。\n",
                date_from_label, date_to_label
            ),
            record_count: 0,
            total_minutes: 0,
        });
    }

    let total_minutes: i64 = entries.iter().filter_map(|e| e.duration_min).sum();
    let record_count = entries.len();

    // 查询附件文件的 AI 摘要（使用作用域块确保 MutexGuard 在 await 前释放）
    let file_summaries = {
        let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;
        let archive_ids: Vec<String> = entries.iter().map(|e| e.id.clone()).collect();
        query_file_summaries_for_archives(&conn, &archive_ids)
    };

    // 构建详细的数据摘要（含附件摘要）
    let entries_text = entries
        .iter()
        .map(|e| {
            let mut line = format!(
                "- [{} {} {}] {} | 项目: {} | 优先级: {} | 耗时: {}min | 产出: {} | 卡点: {} | 下一步: {} | 标签: {}",
                e.date,
                chrono::NaiveDate::parse_from_str(&e.date, "%Y-%m-%d")
                    .map(|d| format!("{}", d.format("%A")))
                    .unwrap_or_default(),
                e.time,
                e.title,
                e.project.as_deref().unwrap_or("-"),
                e.priority.as_deref().unwrap_or("-"),
                e.duration_min.unwrap_or(0),
                e.output.as_deref().unwrap_or("-"),
                e.blocker.as_deref().unwrap_or("无"),
                e.next_action.as_deref().unwrap_or("-"),
                e.tags.as_ref().map(|t| t.join(", ")).unwrap_or_default(),
            );
            if let Some(files) = file_summaries.get(&e.id) {
                if !files.is_empty() {
                    let summaries: Vec<String> = files.iter()
                        .map(|(name, summary)| format!("    - 📎 {}: {}", name, summary))
                        .collect();
                    line.push_str(&format!("\n  附件摘要:\n{}", summaries.join("\n")));
                }
            }
            line
        })
        .collect::<Vec<_>>()
        .join("\n");

    // 预计算一些统计数据给 prompt 参考
    let mut project_time: HashMap<String, i64> = HashMap::new();
    let mut priority_count: HashMap<String, usize> = HashMap::new();
    let mut tag_count: HashMap<String, usize> = HashMap::new();
    let mut blocker_list: Vec<String> = Vec::new();

    for e in &entries {
        let proj = e.project.as_deref().unwrap_or("未分类").to_string();
        *project_time.entry(proj).or_insert(0) += e.duration_min.unwrap_or(0);

        let pri = e.priority.as_deref().unwrap_or("未设置").to_string();
        *priority_count.entry(pri).or_insert(0) += 1;

        if let Some(ref etags) = e.tags {
            for t in etags {
                *tag_count.entry(t.clone()).or_insert(0) += 1;
            }
        }

        if let Some(ref b) = e.blocker {
            if !b.is_empty() && b != "无" {
                blocker_list.push(format!("[{}] {}: {}", e.date, e.title, b));
            }
        }
    }

    let project_stats: String = project_time
        .iter()
        .map(|(k, v)| format!("  - {}: {}min ({:.1}h)", k, v, *v as f64 / 60.0))
        .collect::<Vec<_>>()
        .join("\n");

    let priority_stats: String = priority_count
        .iter()
        .map(|(k, v)| format!("  - {}: {}条", k, v))
        .collect::<Vec<_>>()
        .join("\n");

    let mut sorted_tags: Vec<(String, usize)> = tag_count.into_iter().collect();
    sorted_tags.sort_by(|a, b| b.1.cmp(&a.1));
    let top_tags: String = sorted_tags
        .iter()
        .take(10)
        .map(|(k, v)| format!("  - #{}: {}次", k, v))
        .collect::<Vec<_>>()
        .join("\n");

    let blockers_text = if blocker_list.is_empty() {
        "  无".to_string()
    } else {
        blocker_list.join("\n  ")
    };

    let prompt = format!(
        r#"你是一个专业的工作效率分析专家。请根据以下归档数据，生成一份深度分析报告。

## 分析范围
- 时间: {} ~ {}
- 标签: {}
- 共 {} 条归档记录，累计投入 {} 小时

## 预计算统计
### 项目时间分配
{}

### 优先级分布
{}

### 高频标签 TOP 10
{}

### 卡点清单
  {}

## 完整归档数据
{}

## 报告要求
请严格按照以下 Markdown 格式输出一份全面的分析报告：

# 工作分析报告（{} ~ {}）

## 一、整体概览
（用 2-3 段话概括这段时间的工作情况、关键数字）

## 二、时间分配分析
### 2.1 按项目分配
（基于预计算的项目时间分配数据，分析时间分配是否合理，是否有头重脚轻的问题）

### 2.2 按日期分布
（分析工作在每天/每周的分布规律，是否有集中突击或空白期）

### 2.3 按优先级分配
（分析 P0/P1/P2 的时间投入比例，是否与优先级匹配）

## 三、产出效率分析
### 3.1 高频工作主题
（基于高频标签和归档标题，识别当前的工作重心）

### 3.2 产出质量评估
（基于"关键产出"字段，评估产出的完整性和质量）

## 四、卡点与风险预警
### 4.1 高频卡点分析
（汇总所有卡点，分类归因：是资源不足？跨团队依赖？技术难题？需求不明确？）

### 4.2 潜在风险
（基于卡点趋势，预警可能恶化的风险项）

## 五、优化建议
### 5.1 时间管理建议
（基于时间分配分析，给出具体可操作的优化建议）

### 5.2 工作流程优化
（基于卡点和产出分析，建议流程层面的改进）

### 5.3 优先级调整建议
（如发现优先级与时间投入不匹配，给出调整建议）

注意：
1. 直接输出 Markdown 正文，不要包含 ``` 代码块标记
2. 分析必须基于实际数据，用数字说话
3. 建议必须具体可操作，不要泛泛而谈
4. 适当使用 emoji 和表格让报告更易读
5. 如果归档记录附带了附件摘要（📎标记），请将文件内容纳入分析，充实报告的论据
6. 重点关注高频卡点，分析其根因并给出系统性的解决方案
"#,
        date_from_label, date_to_label, tags_label,
        record_count, format!("{:.1}", total_minutes as f64 / 60.0),
        project_stats, priority_stats, top_tags, blockers_text,
        entries_text,
        date_from_label, date_to_label,
    );

    let markdown = call_ollama_generate(&prompt).await.unwrap_or_else(|_| {
        generate_fallback_analysis_report(&entries, date_from_label, date_to_label, &project_time, &blocker_list)
    });

    Ok(AiReportResult {
        markdown,
        record_count,
        total_minutes,
    })
}

// ── 内部辅助函数 ─────────────────────────────────────────────

/// 内部复用的归档查询（避免重复 State 解锁代码）
fn query_archives_internal(
    state: &State<'_, AppState>,
    date_from: Option<&str>,
    date_to: Option<&str>,
    project: Option<&str>,
    tag: Option<&str>,
) -> Result<Vec<ArchiveEntry>, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let mut sql = String::from(
        "SELECT id, date, time, title, project, priority, duration_min, output, blocker, next_action, tags, md_path, created_at, demand_id, node_type, attachments, is_key_conclusion FROM archives WHERE 1=1"
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(df) = date_from {
        if !df.is_empty() {
            sql.push_str(&format!(" AND date >= ?{}", idx));
            params.push(Box::new(df.to_string()));
            idx += 1;
        }
    }
    if let Some(dt) = date_to {
        if !dt.is_empty() {
            sql.push_str(&format!(" AND date <= ?{}", idx));
            params.push(Box::new(dt.to_string()));
            idx += 1;
        }
    }
    if let Some(proj) = project {
        if !proj.is_empty() {
            sql.push_str(&format!(" AND project = ?{}", idx));
            params.push(Box::new(proj.to_string()));
            idx += 1;
        }
    }
    if let Some(t) = tag {
        if !t.is_empty() {
            sql.push_str(&format!(" AND tags LIKE ?{}", idx));
            params.push(Box::new(format!("%\"{}\"%" , t)));
            let _ = idx; // suppress warning
        }
    }

    sql.push_str(" ORDER BY date DESC, time DESC");

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL error: {}", e))?;
    let rows = stmt
        .query_map(params_ref.as_slice(), |row| {
            let is_key_raw: Option<i32> = row.get(16)?;
            Ok(ArchiveEntry {
                id: row.get(0)?,
                date: row.get(1)?,
                time: row.get(2)?,
                title: row.get(3)?,
                project: row.get(4)?,
                priority: row.get(5)?,
                duration_min: row.get(6)?,
                output: row.get(7)?,
                blocker: row.get(8)?,
                next_action: row.get(9)?,
                tags: row.get::<_, Option<String>>(10)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                md_path: row.get(11)?,
                created_at: row.get(12)?,
                linked_files: None,
                demand_id: row.get(13)?,
                node_type: row.get(14)?,
                attachments: row.get(15)?,
                is_key_conclusion: Some(is_key_raw.unwrap_or(0) == 1),
            })
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut entries = Vec::new();
    for r in rows {
        if let Ok(e) = r { entries.push(e); }
    }
    Ok(entries)
}

/// 批量查询归档关联文件的 AI 摘要
/// 返回 HashMap<archive_id, Vec<(file_name, ai_summary)>>
fn query_file_summaries_for_archives(
    conn: &Connection,
    archive_ids: &[String],
) -> HashMap<String, Vec<(String, String)>> {
    let mut result: HashMap<String, Vec<(String, String)>> = HashMap::new();
    if archive_ids.is_empty() {
        return result;
    }

    // 批量查询：archive_files JOIN asset_items ON file_path
    // asset_items.ai_summary 即为向量库生成的文件摘要
    let placeholders: Vec<String> = (1..=archive_ids.len()).map(|i| format!("?{}", i)).collect();
    let sql = format!(
        "SELECT af.archive_id, af.file_path, COALESCE(ai.ai_summary, '') AS summary, ai.file_name
         FROM archive_files af
         LEFT JOIN asset_items ai ON af.file_path = ai.file_path
         WHERE af.archive_id IN ({})",
        placeholders.join(", ")
    );

    let params: Vec<&dyn rusqlite::types::ToSql> = archive_ids
        .iter()
        .map(|id| id as &dyn rusqlite::types::ToSql)
        .collect();

    if let Ok(mut stmt) = conn.prepare(&sql) {
        if let Ok(rows) = stmt.query_map(params.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,  // archive_id
                row.get::<_, String>(1)?,  // file_path
                row.get::<_, String>(2)?,  // summary
                row.get::<_, Option<String>>(3)?, // file_name from asset_items
            ))
        }) {
            for row in rows.flatten() {
                let (archive_id, file_path, summary, file_name) = row;
                // 使用 asset_items 中的 file_name，退回到从 path 提取
                let name = file_name.unwrap_or_else(|| {
                    file_path.split('/').last()
                        .or_else(|| file_path.split('\\').last())
                        .unwrap_or(&file_path)
                        .to_string()
                });
                let entry = result.entry(archive_id).or_default();
                if !summary.is_empty() {
                    entry.push((name, summary));
                } else {
                    // 没有 AI 摘要时，至少记录文件名
                    entry.push((name, String::from("（无摘要）")));
                }
            }
        }
    }
    result
}

/// Ollama generate 封装
async fn call_ollama_generate(prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    #[derive(serde::Serialize)]
    struct Req<'a> { model: &'a str, prompt: &'a str, stream: bool }
    #[derive(serde::Deserialize)]
    struct Resp { response: String }

    let req = Req { model: "qwen2.5:32b", prompt, stream: false };

    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Ollama 请求失败: {}", e))?;

    let text = res.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    let body: Resp = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let mut md = body.response.trim().to_string();
    // 清理可能的 ``` 包裹
    if md.starts_with("```markdown") || md.starts_with("```md") {
        if let Some(first_newline) = md.find('\n') {
            md = md[first_newline + 1..].to_string();
        }
    }
    if md.starts_with("```") {
        if let Some(first_newline) = md.find('\n') {
            md = md[first_newline + 1..].to_string();
        }
    }
    if md.ends_with("```") {
        md = md[..md.len() - 3].trim_end().to_string();
    }

    Ok(md)
}

/// 降级：无 AI 时的周报生成
fn generate_fallback_weekly_report(entries: &[ArchiveEntry], date_from: &str, date_to: &str) -> String {
    let total_min: i64 = entries.iter().filter_map(|e| e.duration_min).sum();
    let mut projects: HashMap<String, Vec<&ArchiveEntry>> = HashMap::new();
    for e in entries {
        let proj = e.project.as_deref().unwrap_or("未分类").to_string();
        projects.entry(proj).or_default().push(e);
    }

    let mut md = format!("# 工作周报（{} ~ {}）\n\n", date_from, date_to);
    md.push_str(&format!(
        "> 本周共 {} 条归档记录，累计投入 {:.1} 小时\n\n",
        entries.len(), total_min as f64 / 60.0
    ));
    md.push_str("## 按项目分组\n\n");
    for (proj, items) in &projects {
        let proj_min: i64 = items.iter().filter_map(|e| e.duration_min).sum();
        md.push_str(&format!("### {} （{}条, {:.1}h）\n\n", proj, items.len(), proj_min as f64 / 60.0));
        for e in items {
            md.push_str(&format!("- **[{} {}]** {}\n", e.date, e.time, e.title));
            if let Some(ref out) = e.output {
                md.push_str(&format!("  - 产出: {}\n", out));
            }
            if let Some(ref b) = e.blocker {
                if !b.is_empty() {
                    md.push_str(&format!("  - 🚧 卡点: {}\n", b));
                }
            }
        }
        md.push('\n');
    }
    md.push_str("---\n\n> ⚠️ AI 服务暂不可用，以上为基础数据汇总。启动 Ollama 后可获得 AI 深度分析。\n");
    md
}

/// 降级：无 AI 时的项目总结
fn generate_fallback_project_summary(entries: &[&ArchiveEntry], tags_label: &str) -> String {
    let total_min: i64 = entries.iter().filter_map(|e| e.duration_min).sum();
    let mut md = format!("# 项目总结 — {}\n\n", tags_label);
    md.push_str(&format!(
        "> 共 {} 条相关归档记录，累计投入 {:.1} 小时\n\n",
        entries.len(), total_min as f64 / 60.0
    ));
    md.push_str("## 工作进展\n\n");
    for e in entries {
        md.push_str(&format!("- **[{} {}]** {}\n", e.date, e.time, e.title));
        if let Some(ref out) = e.output { md.push_str(&format!("  - 产出: {}\n", out)); }
        if let Some(ref b) = e.blocker {
            if !b.is_empty() { md.push_str(&format!("  - 🚧 卡点: {}\n", b)); }
        }
    }
    md.push_str("\n---\n\n> ⚠️ AI 服务暂不可用，以上为基础数据汇总。\n");
    md
}

/// 降级：无 AI 时的分析报告
fn generate_fallback_analysis_report(
    entries: &[&ArchiveEntry],
    date_from: &str,
    date_to: &str,
    project_time: &HashMap<String, i64>,
    blocker_list: &[String],
) -> String {
    let total_min: i64 = entries.iter().filter_map(|e| e.duration_min).sum();
    let mut md = format!("# 工作分析报告（{} ~ {}）\n\n", date_from, date_to);
    md.push_str(&format!(
        "> 共 {} 条归档记录，累计投入 {:.1} 小时\n\n",
        entries.len(), total_min as f64 / 60.0
    ));
    md.push_str("## 项目时间分配\n\n");
    md.push_str("| 项目 | 耗时 | 占比 |\n|------|------|------|\n");
    for (proj, mins) in project_time {
        let pct = if total_min > 0 { *mins as f64 / total_min as f64 * 100.0 } else { 0.0 };
        md.push_str(&format!("| {} | {:.1}h | {:.0}% |\n", proj, *mins as f64 / 60.0, pct));
    }
    md.push('\n');
    if !blocker_list.is_empty() {
        md.push_str("## 卡点清单\n\n");
        for b in blocker_list { md.push_str(&format!("- {}\n", b)); }
        md.push('\n');
    }
    md.push_str("---\n\n> ⚠️ AI 服务暂不可用，以上为基础数据汇总。\n");
    md
}

// ── Rebuild index from vault (S5 full rebuild) ───────────────────

#[tauri::command]
pub async fn rebuild_archive_index(
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    // Get vault path
    let vault_path: String = conn
        .query_row(
            "SELECT value FROM archive_config WHERE key = 'vault_path'",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "归档目录未配置".to_string())?;

    let daily_dir = Path::new(&vault_path).join("30-daily");
    if !daily_dir.is_dir() {
        return Ok(0);
    }

    // Drop existing data
    conn.execute("DELETE FROM archive_files", [])
        .map_err(|e| format!("清空 archive_files 失败: {}", e))?;
    conn.execute("DELETE FROM archives", [])
        .map_err(|e| format!("清空 archives 失败: {}", e))?;

    // Walk all .md files under 30-daily/
    let mut total_count = 0;
    for entry in walkdir::WalkDir::new(&daily_dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        // Extract date from filename (YYYY-MM-DD.md)
        let filename = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        if filename.len() != 10 || filename.as_bytes()[4] != b'-' || filename.as_bytes()[7] != b'-' {
            continue; // not a date-formatted file
        }
        let date = filename;

        if let Ok(content) = fs::read_to_string(path) {
            let md_path_str = path.to_string_lossy().to_string();
            let entries = parse_md_blocks(&content, &md_path_str, date);

            for entry in &entries {
                let tags_json = entry
                    .tags
                    .as_ref()
                    .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()));

                let _ = conn.execute(
                    "INSERT OR REPLACE INTO archives (id, date, time, title, project, priority, duration_min, output, blocker, next_action, tags, md_path, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    rusqlite::params![
                        entry.id,
                        entry.date,
                        entry.time,
                        entry.title,
                        entry.project,
                        entry.priority,
                        entry.duration_min,
                        entry.output,
                        entry.blocker,
                        entry.next_action,
                        tags_json,
                        entry.md_path,
                        chrono::Local::now().timestamp(),
                    ],
                );

                if let Some(ref files) = entry.linked_files {
                    for file_path in files {
                        let _ = conn.execute(
                            "INSERT OR IGNORE INTO archive_files (archive_id, file_path) VALUES (?1, ?2)",
                            rusqlite::params![entry.id, file_path],
                        );
                    }
                }
            }

            total_count += entries.len();
        }
    }

    Ok(total_count)
}

// ═══════════════════════════════════════════════════════
//  归档编辑 & 删除
// ═══════════════════════════════════════════════════════

/// 更新归档记录（标题、项目、优先级、耗时、产出、卡点、下一步、标签）
#[tauri::command]
pub async fn update_archive(
    state: State<'_, AppState>,
    archive_id: String,
    title: Option<String>,
    project: Option<String>,
    priority: Option<String>,
    duration_min: Option<i64>,
    output: Option<String>,
    blocker: Option<String>,
    next_action: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    // 先确认记录存在
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM archives WHERE id = ?1",
            rusqlite::params![archive_id],
            |row| row.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !exists {
        return Err(format!("归档记录 {} 不存在", archive_id));
    }

    // 动态构建 SET 子句
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = title {
        sets.push("title = ?".to_string());
        params.push(Box::new(v));
    }
    if let Some(v) = project {
        sets.push("project = ?".to_string());
        params.push(Box::new(v));
    }
    if let Some(v) = priority {
        sets.push("priority = ?".to_string());
        params.push(Box::new(v));
    }
    if let Some(v) = duration_min {
        sets.push("duration_min = ?".to_string());
        params.push(Box::new(v));
    }
    if let Some(v) = output {
        sets.push("output = ?".to_string());
        params.push(Box::new(v));
    }
    if let Some(v) = blocker {
        sets.push("blocker = ?".to_string());
        params.push(Box::new(v));
    }
    if let Some(v) = next_action {
        sets.push("next_action = ?".to_string());
        params.push(Box::new(v));
    }
    if let Some(v) = tags {
        let tags_str = v.join(",");
        sets.push("tags = ?".to_string());
        params.push(Box::new(tags_str));
    }

    if sets.is_empty() {
        return Ok(()); // 没有要更新的字段
    }

    let sql = format!("UPDATE archives SET {} WHERE id = ?", sets.join(", "));
    params.push(Box::new(archive_id));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("更新归档失败: {}", e))?;

    Ok(())
}

/// 删除归档记录及其关联附件记录
#[tauri::command]
pub async fn delete_archive(
    state: State<'_, AppState>,
    archive_id: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    // 先确认记录存在
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM archives WHERE id = ?1",
            rusqlite::params![archive_id],
            |row| row.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !exists {
        return Err(format!("归档记录 {} 不存在", archive_id));
    }

    // 删除关联附件记录
    conn.execute(
        "DELETE FROM archive_files WHERE archive_id = ?1",
        rusqlite::params![archive_id],
    )
    .map_err(|e| format!("删除附件关联失败: {}", e))?;

    // 删除归档主记录
    conn.execute(
        "DELETE FROM archives WHERE id = ?1",
        rusqlite::params![archive_id],
    )
    .map_err(|e| format!("删除归档失败: {}", e))?;

    Ok(())
}

/// 删除需求看板中的单个推进节点，并清理该节点的关联信息：
///  1. archive_files 附件关联记录
///  2. archives 主记录
#[tauri::command]
pub async fn delete_archive_node(
    state: State<'_, AppState>,
    archive_id: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    // 确认记录存在
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM archives WHERE id = ?1",
            rusqlite::params![archive_id],
            |row| row.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !exists {
        return Err(format!("归档节点 {} 不存在", archive_id));
    }

    // 1. 删除附件关联记录
    conn.execute(
        "DELETE FROM archive_files WHERE archive_id = ?1",
        rusqlite::params![archive_id],
    )
    .map_err(|e| format!("删除附件关联失败: {}", e))?;

    // 2. 删除归档节点主记录
    conn.execute(
        "DELETE FROM archives WHERE id = ?1",
        rusqlite::params![archive_id],
    )
    .map_err(|e| format!("删除归档节点失败: {}", e))?;

    Ok(())
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  语音输入归档 — Voice Input for Quick Archive
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

extern "C" {
    fn macos_transcribe_audio(c_path: *const std::os::raw::c_char) -> *mut std::os::raw::c_char;
    fn macos_speech_free_string(ptr: *mut std::os::raw::c_char);
}

/// macOS 原生语音转文字（SFSpeechRecognizer）
/// 返回 Ok(text) 或 Err(error_description)
fn perform_mac_speech_recognition(audio_path: &str) -> Result<String, String> {
    let c_str = std::ffi::CString::new(audio_path)
        .map_err(|_| "音频路径包含非法字符".to_string())?;
    unsafe {
        let ptr = macos_transcribe_audio(c_str.as_ptr());
        if ptr.is_null() {
            return Err("语音识别返回空结果".to_string());
        }
        let rust_str = std::ffi::CStr::from_ptr(ptr).to_string_lossy().into_owned();
        macos_speech_free_string(ptr);
        let trimmed = rust_str.trim().to_string();

        // 解析 ERROR: 前缀的错误信息
        if trimmed.starts_with("ERROR:") {
            let err_code = &trimmed[6..];
            let msg = match err_code.split(':').next().unwrap_or("") {
                "null_path" => "音频文件路径无效",
                "file_not_found" => "音频文件不存在",
                "speech_auth_denied" => "语音识别权限被拒绝，请在「系统设置 → 隐私与安全性 → 语音识别」中授权本应用",
                "speech_auth_restricted" => "语音识别权限受限",
                "recognizer_unavailable" => "语音识别器不可用，请检查系统是否支持语音识别",
                "task_creation_failed" => "创建语音识别任务失败",
                "timeout" => "语音识别超时（60s），请缩短录音时长后重试",
                "empty_result" => "未能识别到语音内容，请尝试说话更清晰或靠近麦克风",
                s if s.starts_with("recognition_error") => {
                    // 格式: recognition_error:code:description
                    let parts: Vec<&str> = err_code.splitn(3, ':').collect();
                    if parts.len() >= 3 {
                        return Err(format!("语音识别错误({}): {}", parts[1], parts[2]));
                    }
                    "语音识别过程出错"
                },
                _ => "语音识别未知错误",
            };
            return Err(msg.to_string());
        }

        if trimmed.is_empty() {
            Err("未能识别到语音内容，请尝试说话更清晰或靠近麦克风".to_string())
        } else {
            Ok(trimmed)
        }
    }
}

/// 保存前端录制的音频数据到临时文件
#[tauri::command]
pub fn save_audio_file(
    data: Vec<u8>,
    format: String,
) -> Result<String, String> {
    let ext = match format.as_str() {
        "audio/wav" | "audio/wave" => "wav",
        "audio/mp4" | "audio/m4a" | "audio/aac" => "m4a",
        "audio/webm" => "webm",
        "audio/ogg" => "ogg",
        _ => "wav",
    };
    let temp_dir = std::env::temp_dir().join("file_manager_voice");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("创建临时目录失败: {}", e))?;
    let file_name = format!("voice_recording_{}.{}", chrono::Local::now().format("%Y%m%d_%H%M%S"), ext);
    let file_path = temp_dir.join(&file_name);
    std::fs::write(&file_path, &data).map_err(|e| format!("写入音频文件失败: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

/// 转写音频文件为文字（macOS 原生 SFSpeechRecognizer）
#[tauri::command]
pub async fn transcribe_audio(
    audio_path: String,
) -> Result<String, String> {
    // 先检查文件是否存在
    if !std::path::Path::new(&audio_path).exists() {
        return Err("音频文件不存在".to_string());
    }

    // ★ 关键修复：WKWebView MediaRecorder 实际输出 MP4/AAC 格式，
    // 即使前端报告 MIME type 为 audio/wav，文件内容也是 MP4。
    // 因此不管扩展名如何，统一先用 afconvert 转为标准 PCM WAV，
    // 再交给 SFSpeechRecognizer 识别。
    let wav_path = format!("{}_converted.wav",
        audio_path.rsplit_once('.').map(|(base, _)| base).unwrap_or(&audio_path));

    let convert_ok = {
        // 1. 优先 afconvert（macOS 内置）
        let output = std::process::Command::new("afconvert")
            .args([&audio_path, &wav_path, "-d", "LEI16@16000", "-f", "WAVE", "-c", "1"])
            .output();
        match output {
            Ok(o) if o.status.success() => true,
            _ => {
                // 2. afconvert 失败，尝试 ffmpeg
                let output2 = std::process::Command::new("ffmpeg")
                    .args(["-y", "-i", &audio_path, "-ar", "16000", "-ac", "1", "-f", "wav", &wav_path])
                    .output();
                match output2 {
                    Ok(o) if o.status.success() => true,
                    _ => false,
                }
            }
        }
    };

    let actual_path = if convert_ok && std::path::Path::new(&wav_path).exists() {
        wav_path
    } else {
        // 转换失败，直接用原文件尝试（SFSpeechRecognizer 也支持 MP4/M4A）
        audio_path.clone()
    };

    // 调用 macOS 原生语音识别
    perform_mac_speech_recognition(&actual_path)
}

/// 用 AI 解析语音转写文本 → 结构化归档表单字段
#[tauri::command]
pub async fn parse_voice_to_archive(
    transcript: String,
) -> Result<serde_json::Value, String> {
    if transcript.trim().is_empty() {
        return Err("语音内容为空".to_string());
    }

    let prompt = format!(
        r#"你是一个工作归档助手。用户通过语音输入描述了一件刚完成的工作事项，请从中提取结构化信息。

用户语音内容：
"{}"

请严格按照以下 JSON 格式输出（不要输出其他内容）：
{{
  "title": "事项标题（简洁概括，10-20字）",
  "project": "所属项目名（如果提到的话）",
  "priority": "优先级 P0/P1/P2（根据紧急程度判断，默认空字符串）",
  "output": "关键产出（做了什么、产出了什么，用1-3句话）",
  "blocker": "卡点/阻塞（如果提到的话，否则空字符串）",
  "durationMin": 预估耗时分钟数（数字，根据语境判断，默认 30）,
  "nextAction": "下一步待办（如果提到的话，多条用分号分隔）",
  "tags": ["相关标签1", "标签2"]
}}

注意：
1. title 应简洁有力，概括核心工作
2. output 应保留用户描述中的实质内容
3. 如果用户没有明确提到某个字段，合理推断或留空
4. tags 从内容中提取 1-3 个关键标签
5. 只输出 JSON，不要加 markdown 代码块标记"#,
        transcript.chars().take(2000).collect::<String>()
    );

    match call_ollama_generate(&prompt).await {
        Ok(raw) => {
            // 尝试解析为 JSON
            let cleaned = raw.trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim();
            match serde_json::from_str::<serde_json::Value>(cleaned) {
                Ok(val) => Ok(val),
                Err(_) => {
                    // AI 返回的不是合法 JSON，构建一个基础结构
                    Ok(serde_json::json!({
                        "title": transcript.chars().take(30).collect::<String>(),
                        "output": transcript.clone(),
                        "project": "",
                        "priority": "",
                        "blocker": "",
                        "durationMin": 30,
                        "nextAction": "",
                        "tags": []
                    }))
                }
            }
        }
        Err(_) => {
            // Ollama 不可用，直接用原文做降级处理
            Ok(serde_json::json!({
                "title": transcript.chars().take(30).collect::<String>(),
                "output": transcript.clone(),
                "project": "",
                "priority": "",
                "blocker": "",
                "durationMin": 30,
                "nextAction": "",
                "tags": []
            }))
        }
    }
}

// ── Tauri Command: parse_title_fields ────────────────────────────
/// 根据标题文本智能解析出项目名和标签
/// 策略：先尝试从历史项目列表中精确匹配，不命中再调 Ollama AI 解析
#[tauri::command]
pub async fn parse_title_fields(
    state: State<'_, AppState>,
    title: String,
) -> Result<serde_json::Value, String> {
    let trimmed = title.trim().to_string();
    if trimmed.is_empty() {
        return Ok(serde_json::json!({ "project": "", "tags": [] }));
    }

    // 1. 查询历史项目列表（按频次降序）
    let history_projects: Vec<String> = {
        let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;
        let mut projects = Vec::new();
        if let Ok(mut stmt) = conn.prepare(
            "SELECT project, COUNT(*) as cnt FROM archives WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY cnt DESC LIMIT 30"
        ) {
            if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                for r in rows.flatten() {
                    projects.push(r);
                }
            }
        }
        projects
    };

    // 2. 查询历史标签（按频次降序）
    let history_tags: Vec<String> = {
        let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;
        let mut tag_counts: HashMap<String, usize> = HashMap::new();
        if let Ok(mut stmt) = conn.prepare(
            "SELECT tags FROM archives WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'"
        ) {
            if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                for r in rows.flatten() {
                    if let Ok(tags) = serde_json::from_str::<Vec<String>>(&r) {
                        for tag in tags {
                            let clean = tag.trim().trim_start_matches('#').to_string();
                            if !clean.is_empty() {
                                *tag_counts.entry(clean).or_insert(0) += 1;
                            }
                        }
                    }
                }
            }
        }
        let mut sorted: Vec<(String, usize)> = tag_counts.into_iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(&a.1));
        sorted.into_iter().take(30).map(|(t, _)| t).collect()
    };

    // 3. 尝试本地精确匹配（不调 AI，零延迟）
    //    检查标题中是否包含任何历史项目名
    let mut matched_project = String::new();
    for proj in &history_projects {
        if trimmed.contains(proj.as_str()) {
            matched_project = proj.clone();
            break;
        }
    }

    // 4. 本地提取标签候选：匹配历史标签 + 从标题分词
    let mut local_tags: Vec<String> = Vec::new();
    for tag in &history_tags {
        if trimmed.contains(tag.as_str()) {
            local_tags.push(tag.clone());
        }
    }

    // 如果本地匹配到了项目名，就用本地结果（快速路径，无 AI 延迟）
    if !matched_project.is_empty() && !local_tags.is_empty() {
        return Ok(serde_json::json!({
            "project": matched_project,
            "tags": local_tags,
            "source": "local"
        }));
    }

    // 5. 调 Ollama AI 做更深层的语义解析
    let projects_hint = if history_projects.is_empty() {
        "（无历史项目）".to_string()
    } else {
        history_projects.join("、")
    };
    let tags_hint = if history_tags.is_empty() {
        "（无历史标签）".to_string()
    } else {
        history_tags.join("、")
    };

    let prompt = format!(
r#"你是一个产品经理工作归档助手。请根据用户输入的归档标题，提取出"项目名"和"标签列表"。

规则：
1. 项目名：从标题中识别出所属的产品/项目/模块名。优先匹配历史项目：[{projects}]。如果标题中没有明确的项目名，返回空字符串。
2. 标签：从标题中提取 2-4 个关键词作为标签。优先复用历史标签：[{tags}]。标签不带 # 号，纯中文或英文短词。标签应涵盖：项目名（如有）、动作类型（如测评/修复/设计/优化）、关键对象。
3. 不要编造标题中没有的信息。

示例：
标题："完成文档翻译测评" → {{"project":"文档翻译","tags":["文档翻译","测评"]}}
标题："修复文件搜索结果排序 bug" → {{"project":"文件搜索","tags":["文件搜索","bug修复","排序"]}}
标题："设计智能标签方案 V2" → {{"project":"智能标签","tags":["智能标签","方案设计","V2"]}}
标题："周会讨论下季度 OKR" → {{"project":"","tags":["周会","OKR","季度规划"]}}

请直接返回 JSON，不要解释：
标题："{title}"
"#,
        projects = projects_hint,
        tags = tags_hint,
        title = trimmed,
    );

    match call_ollama_generate(&prompt).await {
        Ok(raw) => {
            // 提取 JSON
            let json_str = if let Some(start) = raw.find('{') {
                if let Some(end) = raw.rfind('}') {
                    &raw[start..=end]
                } else { &raw }
            } else { &raw };

            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                let project = parsed["project"].as_str().unwrap_or("").to_string();
                let tags: Vec<String> = parsed["tags"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.trim_start_matches('#').to_string())).collect())
                    .unwrap_or_default();

                // 如果 AI 没解析到项目但本地有匹配，用本地的
                let final_project = if project.is_empty() && !matched_project.is_empty() {
                    matched_project
                } else {
                    project
                };

                // 合并本地 + AI 标签去重
                let mut final_tags = local_tags.clone();
                for t in tags {
                    if !final_tags.contains(&t) {
                        final_tags.push(t);
                    }
                }

                Ok(serde_json::json!({
                    "project": final_project,
                    "tags": final_tags,
                    "source": "ai"
                }))
            } else {
                // AI 返回格式不对，用本地结果
                Ok(serde_json::json!({
                    "project": matched_project,
                    "tags": local_tags,
                    "source": "local_fallback"
                }))
            }
        }
        Err(_) => {
            // Ollama 不可用，纯本地降级
            // 从标题简单分词提取标签
            if local_tags.is_empty() {
                // 简单拆分：按常见动词/名词模式切分
                let keywords: Vec<&str> = trimmed.split(|c: char| c == ' ' || c == '，' || c == '、' || c == '-' || c == '—').collect();
                for kw in keywords {
                    let kw = kw.trim();
                    if kw.len() >= 4 && kw.len() <= 30 {
                        local_tags.push(kw.to_string());
                    }
                }
            }
            Ok(serde_json::json!({
                "project": matched_project,
                "tags": local_tags,
                "source": "local_only"
            }))
        }
    }
}

// ══════════════════════════════════════════════════════════════════
// ── 产品需求看板 — Demand 相关数据结构与命令 ──────────────────────
// ══════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DemandEntry {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub phase: Option<String>,
    pub priority: Option<String>,
    pub owner: Option<String>,
    /// 版本字段（自由文本，如「V2.3」「Q3 灰度版」）
    pub version: Option<String>,
    /// 预计合流日期 (YYYY-MM-DD)
    #[serde(rename = "expectedMergeDate")]
    pub expected_merge_date: Option<String>,
    /// 上线日期 (YYYY-MM-DD)
    #[serde(rename = "onlineDate")]
    pub online_date: Option<String>,
    /// 备注：特殊记录点（纯文本）
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "docLinks")]
    pub doc_links: Option<Vec<DemandDocLink>>,
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    /// 聚合：该需求下的节点总数
    #[serde(rename = "nodeCount")]
    pub node_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DemandDocLink {
    pub id: String,
    pub name: String,
    pub url: String,
    #[serde(rename = "docType")]
    pub doc_type: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct DemandInput {
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub phase: Option<String>,
    pub priority: Option<String>,
    pub owner: Option<String>,
    pub version: Option<String>,
    #[serde(rename = "expectedMergeDate")]
    pub expected_merge_date: Option<String>,
    #[serde(rename = "onlineDate")]
    pub online_date: Option<String>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
}

fn generate_demand_id(title: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    let now = Local::now().timestamp_nanos_opt().unwrap_or(0);
    format!("{}|{}", title, now).hash(&mut hasher);
    format!("dmd_{:016x}", hasher.finish())
}

// ── Tauri Command: create_demand ─────────────────────────────────

#[tauri::command]
pub async fn create_demand(
    input: DemandInput,
    state: State<'_, AppState>,
) -> Result<DemandEntry, String> {
    let now = Local::now().timestamp();
    let id = generate_demand_id(&input.title);
    let tags_json = input.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()));

    let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;
    conn.execute(
        "INSERT INTO demands (id, title, description, status, phase, priority, owner, version, expected_merge_date, online_date, notes, tags, sort_order, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,0,?13,?13)",
        rusqlite::params![
            id,
            input.title,
            input.description,
            input.status.as_deref().unwrap_or("planning"),
            input.phase,
            input.priority.as_deref().unwrap_or("P1"),
            input.owner,
            input.version,
            input.expected_merge_date,
            input.online_date,
            input.notes,
            tags_json,
            now,
        ],
    ).map_err(|e| format!("创建需求失败: {}", e))?;

    Ok(DemandEntry {
        id,
        title: input.title,
        description: input.description,
        status: input.status.unwrap_or_else(|| "planning".to_string()),
        phase: input.phase,
        priority: input.priority.or(Some("P1".to_string())),
        owner: input.owner,
        version: input.version,
        expected_merge_date: input.expected_merge_date,
        online_date: input.online_date,
        notes: input.notes,
        tags: input.tags,
        doc_links: Some(vec![]),
        sort_order: Some(0),
        created_at: now,
        updated_at: now,
        node_count: Some(0),
    })
}

// ── Tauri Command: update_demand ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DemandUpdate {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub phase: Option<String>,
    pub priority: Option<String>,
    pub owner: Option<String>,
    pub version: Option<String>,
    #[serde(rename = "expectedMergeDate")]
    pub expected_merge_date: Option<String>,
    #[serde(rename = "onlineDate")]
    pub online_date: Option<String>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<i64>,
}

#[tauri::command]
pub async fn update_demand(
    input: DemandUpdate,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let now = Local::now().timestamp();
    let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];
    let mut idx = 2usize;

    macro_rules! maybe_set {
        ($field:ident, $col:expr) => {
            if let Some(ref val) = input.$field {
                sets.push(format!("{} = ?{}", $col, idx));
                params.push(Box::new(val.clone()));
                idx += 1;
            }
        };
    }
    maybe_set!(title, "title");
    maybe_set!(description, "description");
    maybe_set!(status, "status");
    maybe_set!(phase, "phase");
    maybe_set!(priority, "priority");
    maybe_set!(owner, "owner");
    maybe_set!(version, "version");
    maybe_set!(expected_merge_date, "expected_merge_date");
    maybe_set!(online_date, "online_date");
    maybe_set!(notes, "notes");
    if let Some(ref tags) = input.tags {
        sets.push(format!("tags = ?{}", idx));
        params.push(Box::new(serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())));
        idx += 1;
    }
    if let Some(so) = input.sort_order {
        sets.push(format!("sort_order = ?{}", idx));
        params.push(Box::new(so));
        idx += 1;
    }
    let _ = idx; // suppress warning

    let sql = format!("UPDATE demands SET {} WHERE id = ?{}", sets.join(", "), params.len() + 1);
    params.push(Box::new(input.id.clone()));

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_ref.as_slice())
        .map_err(|e| format!("更新需求失败: {}", e))?;

    Ok(input.id)
}

// ── Tauri Command: query_demands ─────────────────────────────────

#[tauri::command]
pub async fn query_demands(
    status: Option<String>,
    search: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<DemandEntry>, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;

    let mut sql = String::from("SELECT d.id, d.title, d.description, d.status, d.phase, d.priority, d.owner, d.version, d.expected_merge_date, d.online_date, d.notes, d.tags, d.sort_order, d.created_at, d.updated_at, (SELECT COUNT(*) FROM archives a WHERE a.demand_id = d.id) AS node_count FROM demands d WHERE 1=1");
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut pidx = 1;

    if let Some(ref s) = status {
        if !s.is_empty() {
            sql.push_str(&format!(" AND d.status = ?{}", pidx));
            params.push(Box::new(s.clone()));
            pidx += 1;
        }
    }
    if let Some(ref q) = search {
        if !q.is_empty() {
            sql.push_str(&format!(" AND (d.title LIKE ?{p} OR d.description LIKE ?{p} OR d.tags LIKE ?{p})", p = pidx));
            params.push(Box::new(format!("%{}%", q)));
            pidx += 1;
        }
    }
    let _ = pidx;

    sql.push_str(" ORDER BY d.sort_order ASC, d.updated_at DESC");

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL error: {}", e))?;
    let rows = stmt.query_map(params_ref.as_slice(), |row| {
        Ok(DemandEntry {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            status: row.get::<_, String>(3)?,
            phase: row.get(4)?,
            priority: row.get(5)?,
            owner: row.get(6)?,
            version: row.get(7)?,
            expected_merge_date: row.get(8)?,
            online_date: row.get(9)?,
            notes: row.get(10)?,
            tags: row.get::<_, Option<String>>(11)?.and_then(|s| serde_json::from_str(&s).ok()),
            sort_order: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
            doc_links: None, // filled below
            node_count: row.get(15)?,
        })
    }).map_err(|e| format!("Query error: {}", e))?;

    let mut demands: Vec<DemandEntry> = Vec::new();
    for r in rows {
        if let Ok(d) = r { demands.push(d); }
    }

    // Fill doc links for each demand
    for d in demands.iter_mut() {
        let links: Vec<DemandDocLink> = conn
            .prepare("SELECT id, name, url, doc_type, created_at FROM demand_doc_links WHERE demand_id = ?1 ORDER BY created_at DESC")
            .ok()
            .and_then(|mut stmt| {
                stmt.query_map([&d.id], |row| {
                    Ok(DemandDocLink {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        url: row.get(2)?,
                        doc_type: row.get(3)?,
                        created_at: row.get(4)?,
                    })
                }).ok().map(|rows| rows.filter_map(|r| r.ok()).collect())
            })
            .unwrap_or_default();
        d.doc_links = Some(links);
    }

    Ok(demands)
}

// ── Tauri Command: delete_demand ─────────────────────────────────

#[tauri::command]
pub async fn delete_demand(
    id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;
    // 将该需求下的所有归档节点解除关联（demand_id 置空）
    conn.execute("UPDATE archives SET demand_id = NULL WHERE demand_id = ?1", rusqlite::params![id])
        .map_err(|e| format!("解除归档关联失败: {}", e))?;
    // 删除文档链接
    conn.execute("DELETE FROM demand_doc_links WHERE demand_id = ?1", rusqlite::params![id])
        .map_err(|e| format!("删除文档链接失败: {}", e))?;
    // 删除需求
    conn.execute("DELETE FROM demands WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("删除需求失败: {}", e))?;
    Ok(id)
}

// ── Tauri Command: add_demand_doc_link ───────────────────────────

#[derive(Debug, Deserialize)]
pub struct DocLinkInput {
    #[serde(rename = "demandId")]
    pub demand_id: String,
    pub name: String,
    pub url: String,
    #[serde(rename = "docType")]
    pub doc_type: Option<String>,
}

#[tauri::command]
pub async fn add_demand_doc_link(
    input: DocLinkInput,
    state: State<'_, AppState>,
) -> Result<DemandDocLink, String> {
    let now = Local::now().timestamp();
    let id = {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        format!("{}|{}|{}", input.demand_id, input.url, now).hash(&mut hasher);
        format!("dl_{:016x}", hasher.finish())
    };

    let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;
    conn.execute(
        "INSERT INTO demand_doc_links (id, demand_id, name, url, doc_type, created_at) VALUES (?1,?2,?3,?4,?5,?6)",
        rusqlite::params![id, input.demand_id, input.name, input.url, input.doc_type.as_deref().unwrap_or("link"), now],
    ).map_err(|e| format!("添加文档链接失败: {}", e))?;

    Ok(DemandDocLink {
        id,
        name: input.name,
        url: input.url,
        doc_type: input.doc_type.or(Some("link".to_string())),
        created_at: Some(now),
    })
}

// ── Tauri Command: remove_demand_doc_link ────────────────────────

#[tauri::command]
pub async fn remove_demand_doc_link(
    id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;
    conn.execute("DELETE FROM demand_doc_links WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("删除文档链接失败: {}", e))?;
    Ok(id)
}

// ── Tauri Command: query_demand_nodes ────────────────────────────
/// 查询某个需求下的所有节点（归档记录），按日期倒序

#[tauri::command]
pub async fn query_demand_nodes(
    demand_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ArchiveEntry>, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;
    let mut stmt = conn.prepare(
        "SELECT id, date, time, title, project, priority, duration_min, output, blocker, next_action, tags, md_path, created_at, demand_id, node_type, attachments, is_key_conclusion FROM archives WHERE demand_id = ?1 ORDER BY date DESC, time DESC"
    ).map_err(|e| format!("SQL error: {}", e))?;

    let rows = stmt.query_map(rusqlite::params![demand_id], |row| {
        let is_key_raw: Option<i32> = row.get(16)?;
        Ok(ArchiveEntry {
            id: row.get(0)?,
            date: row.get(1)?,
            time: row.get(2)?,
            title: row.get(3)?,
            project: row.get(4)?,
            priority: row.get(5)?,
            duration_min: row.get(6)?,
            output: row.get(7)?,
            blocker: row.get(8)?,
            next_action: row.get(9)?,
            tags: row.get::<_, Option<String>>(10)?.and_then(|s| serde_json::from_str(&s).ok()),
            md_path: row.get(11)?,
            created_at: row.get(12)?,
            linked_files: None,
            demand_id: row.get(13)?,
            node_type: row.get(14)?,
            attachments: row.get(15)?,
            is_key_conclusion: Some(is_key_raw.unwrap_or(0) == 1),
        })
    }).map_err(|e| format!("Query error: {}", e))?;

    let mut entries: Vec<ArchiveEntry> = Vec::new();
    for r in rows {
        if let Ok(e) = r { entries.push(e); }
    }

    // Fill linked files
    for entry in entries.iter_mut() {
        let files: Vec<String> = conn
            .prepare("SELECT file_path FROM archive_files WHERE archive_id = ?1")
            .ok()
            .and_then(|mut stmt| {
                stmt.query_map([&entry.id], |row| row.get(0))
                    .ok()
                    .map(|rows| rows.filter_map(|r| r.ok()).collect())
            })
            .unwrap_or_default();
        if !files.is_empty() {
            entry.linked_files = Some(files);
        }
    }

    Ok(entries)
}

// ── Tauri Command: migrate_projects_to_demands ───────────────────
/// 将旧数据中 archives.project 自动迁移为 demands 记录

#[tauri::command]
pub async fn migrate_projects_to_demands(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let conn = state.db.lock().map_err(|e| format!("DB lock: {}", e))?;
    let now = Local::now().timestamp();

    // 查找所有有 project 但没有 demand_id 的归档
    let mut stmt = conn.prepare(
        "SELECT DISTINCT project FROM archives WHERE project IS NOT NULL AND project != '' AND (demand_id IS NULL OR demand_id = '')"
    ).map_err(|e| format!("SQL: {}", e))?;

    let projects: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| format!("Query: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let mut migrated = 0i64;
    for proj in &projects {
        // 检查是否已存在同名需求
        let existing_id: Option<String> = conn.query_row(
            "SELECT id FROM demands WHERE title = ?1",
            rusqlite::params![proj],
            |row| row.get(0),
        ).ok();

        let demand_id = if let Some(eid) = existing_id {
            eid
        } else {
            let did = generate_demand_id(proj);
            conn.execute(
                "INSERT INTO demands (id, title, status, priority, created_at, updated_at) VALUES (?1,?2,'active','P1',?3,?3)",
                rusqlite::params![did, proj, now],
            ).map_err(|e| format!("Insert demand: {}", e))?;
            did
        };

        // 关联归档
        let updated = conn.execute(
            "UPDATE archives SET demand_id = ?1 WHERE project = ?2 AND (demand_id IS NULL OR demand_id = '')",
            rusqlite::params![demand_id, proj],
        ).map_err(|e| format!("Update archives: {}", e))?;

        migrated += updated as i64;
    }

    Ok(serde_json::json!({
        "projectCount": projects.len(),
        "migratedArchives": migrated,
    }))
}
