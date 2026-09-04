//! 智能资产沉淀后端实现 — asset.rs
//! 
//! 基于 sqlite-vec 向量数据库与 AI 混合检索（bge-m3 + FTS5 + 余弦相似度）

use chrono::Local;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use uuid::Uuid;
use walkdir::WalkDir;

use crate::file_parser;
use crate::ollama;
use crate::AppState;

// ── 数据结构定义 ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetFilter {
    pub field: String,    // file_type / file_size / file_mtime / file_name
    pub op: String,       // include / exclude / gt / lt / contains
    pub value: String,    // 筛选值
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetPolicy {
    pub tags: Vec<String>,              // 规则标签: ["#终稿", "#获批", "PRD"]
    pub filters: Vec<AssetFilter>,      // 属性过滤条件
    pub template: Option<String>,       // 模板名
    pub exclude_dirs: Vec<String>,      // 排除目录
    pub exclude_patterns: Vec<String>,  // 排除后缀/匹配模式
    pub include_types: Vec<String>,     // 类型白名单
    pub ai_description: Option<String>, // 自然语言描述
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetStats {
    #[serde(rename = "totalFiles")]
    pub total_files: i64,
    #[serde(rename = "assetCount")]
    pub asset_count: i64,
    #[serde(rename = "noiseCount")]
    pub noise_count: i64,
    #[serde(rename = "pendingCount")]
    pub pending_count: i64,
    #[serde(rename = "noiseBytes")]
    pub noise_bytes: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetTask {
    pub id: String,
    pub name: String,
    #[serde(rename = "workspacePath")]
    pub workspace_path: String,
    pub status: String, // idle / scanning / completed / error
    pub policy: AssetPolicy,
    pub stats: AssetStats,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "lastScanAt")]
    pub last_scan_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetItem {
    pub id: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "fileType")]
    pub file_type: String,
    #[serde(rename = "fileSize")]
    pub file_size: i64,
    #[serde(rename = "fileMtime")]
    pub file_mtime: i64,
    pub classification: String, // ASSET / NOISE / PENDING
    pub confidence: f64,
    #[serde(rename = "matchRule")]
    pub match_rule: Option<String>,
    pub tags: Vec<String>,
    #[serde(rename = "aiSummary")]
    pub ai_summary: Option<String>,
    #[serde(rename = "contentHash")]
    pub content_hash: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetQueryResult {
    pub items: Vec<AssetItem>,
    pub total: i64,
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KnowledgeBaseResult {
    #[serde(rename = "outputPath")]
    pub output_path: String,
    #[serde(rename = "assetCount")]
    pub asset_count: i64,
    #[serde(rename = "fileSize")]
    pub file_size: i64,
}

// ── 向量数学工具 ──

fn cosine_similarity(v1: &[f32], v2: &[f32]) -> f32 {
    if v1.len() != v2.len() || v1.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    let mut norm1 = 0.0f32;
    let mut norm2 = 0.0f32;
    for (a, b) in v1.iter().zip(v2.iter()) {
        dot += a * b;
        norm1 += a * a;
        norm2 += b * b;
    }
    if norm1 <= 0.0 || norm2 <= 0.0 {
        0.0
    } else {
        dot / (norm1.sqrt() * norm2.sqrt())
    }
}

// ── TAURI 命令实现 ──

/// 创建沉淀任务
#[tauri::command]
pub async fn create_asset_task(
    name: String,
    workspace_path: String,
    policy_tags: Vec<String>,
    policy_filters: Vec<AssetFilter>,
    policy_template: Option<String>,
    exclude_dirs: Vec<String>,
    exclude_patterns: Vec<String>,
    include_types: Vec<String>,
    ai_description: Option<String>,
    state: State<'_, AppState>,
) -> Result<AssetTask, String> {
    let path = Path::new(&workspace_path);
    if !path.exists() || !path.is_dir() {
        return Err("所选工作区路径不存在或不是文件夹".into());
    }

    let task_id = Uuid::new_v4().to_string();
    let now = Local::now().timestamp();

    let policy = AssetPolicy {
        tags: policy_tags.clone(),
        filters: policy_filters.clone(),
        template: policy_template.clone(),
        exclude_dirs: exclude_dirs.clone(),
        exclude_patterns: exclude_patterns.clone(),
        include_types: include_types.clone(),
        ai_description: ai_description.clone(),
    };

    let policy_tags_json = serde_json::to_string(&policy_tags).unwrap_or_default();
    let policy_filters_json = serde_json::to_string(&policy_filters).unwrap_or_default();
    let exclude_dirs_json = serde_json::to_string(&exclude_dirs).unwrap_or_default();
    let exclude_patterns_json = serde_json::to_string(&exclude_patterns).unwrap_or_default();
    let include_types_json = serde_json::to_string(&include_types).unwrap_or_default();

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO asset_tasks (
            id, name, workspace_path, status, policy_tags, policy_filters, policy_template,
            exclude_dirs, exclude_patterns, include_types, ai_description,
            total_files, asset_count, noise_count, pending_count, created_at, updated_at
        ) VALUES (?1, ?2, ?3, 'idle', ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, 0, 0, 0, ?11, ?12)",
        params![
            task_id,
            name,
            workspace_path,
            policy_tags_json,
            policy_filters_json,
            policy_template,
            exclude_dirs_json,
            exclude_patterns_json,
            include_types_json,
            ai_description,
            now,
            now
        ],
    )
    .map_err(|e| format!("写入任务信息失败: {}", e))?;

    let stats = AssetStats {
        total_files: 0,
        asset_count: 0,
        noise_count: 0,
        pending_count: 0,
        noise_bytes: 0,
    };

    Ok(AssetTask {
        id: task_id,
        name,
        workspace_path,
        status: "idle".into(),
        policy,
        stats,
        created_at: now,
        updated_at: now,
        last_scan_at: None,
    })
}

/// 删除沉淀任务
#[tauri::command]
pub fn delete_asset_task(task_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let _ = conn.execute("DELETE FROM asset_items WHERE task_id = ?1", params![task_id]);
    let _ = conn.execute("DELETE FROM asset_kb_history WHERE task_id = ?1", params![task_id]);
    let _ = conn.execute("DELETE FROM asset_tasks WHERE id = ?1", params![task_id]);
    Ok(true)
}

/// 获取沉淀任务列表
#[tauri::command]
pub fn list_asset_tasks(state: State<'_, AppState>) -> Result<Vec<AssetTask>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, workspace_path, status, policy_tags, policy_filters, policy_template,
                    exclude_dirs, exclude_patterns, include_types, ai_description,
                    total_files, asset_count, noise_count, pending_count,
                    created_at, updated_at, last_scan_at
             FROM asset_tasks ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let tags_str: Option<String> = row.get(4)?;
            let filters_str: Option<String> = row.get(5)?;
            let exclude_dirs_str: Option<String> = row.get(7)?;
            let exclude_patterns_str: Option<String> = row.get(8)?;
            let include_types_str: Option<String> = row.get(9)?;

            let policy = AssetPolicy {
                tags: tags_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                filters: filters_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                template: row.get(6)?,
                exclude_dirs: exclude_dirs_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                exclude_patterns: exclude_patterns_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                include_types: include_types_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                ai_description: row.get(10)?,
            };

            let stats = AssetStats {
                total_files: row.get(11)?,
                asset_count: row.get(12)?,
                noise_count: row.get(13)?,
                pending_count: row.get(14)?,
                noise_bytes: 0,
            };

            Ok(AssetTask {
                id: row.get(0)?,
                name: row.get(1)?,
                workspace_path: row.get(2)?,
                status: row.get(3)?,
                policy,
                stats,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
                last_scan_at: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for r in rows.flatten() {
        tasks.push(r);
    }
    Ok(tasks)
}

/// 获取单任务详情
#[tauri::command]
pub fn get_asset_task(task_id: String, state: State<'_, AppState>) -> Result<AssetTask, String> {
    let tasks = list_asset_tasks(state)?;
    tasks.into_iter().find(|t| t.id == task_id).ok_or_else(|| "未找到对应的沉淀任务".into())
}

/// 执行基于向量数据库和 AI 语义匹配的扫描
#[tauri::command]
pub async fn scan_asset_task(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<AssetStats, String> {
    let task = get_asset_task(task_id.clone(), state.clone())?;
    let workspace = PathBuf::from(&task.workspace_path);

    if !workspace.exists() {
        return Err("工作区路径不存在".into());
    }

    // 更新状态为 scanning
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let _ = conn.execute(
            "UPDATE asset_tasks SET status = 'scanning' WHERE id = ?1",
            params![task_id],
        );
    }

    // 提前计算意图向量 (Intent Vector)
    let intent_embedding = if let Some(ref desc) = task.policy.ai_description {
        if !desc.trim().is_empty() {
            ollama::generate_embedding(desc).await.ok()
        } else {
            None
        }
    } else {
        None
    };

    let mut total_files = 0i64;
    let mut asset_count = 0i64;
    let mut noise_count = 0i64;
    let mut pending_count = 0i64;
    let mut noise_bytes = 0i64;

    let now = Local::now().timestamp();
    let default_exclude_dirs = vec![
        "node_modules",
        ".git",
        "dist",
        "build",
        "__pycache__",
        ".next",
        ".cache",
    ];

    let mut items_to_save: Vec<AssetItem> = Vec::new();
    let mut embeddings_to_save: Vec<(String, Vec<f32>)> = Vec::new();

    for entry in WalkDir::new(&workspace)
        .max_depth(8)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if path.is_dir() {
            continue;
        }

        let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }

        let path_str = path.to_string_lossy().to_string();
        total_files += 1;

        let metadata = match fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let file_size = metadata.len() as i64;
        let file_mtime = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(now);

        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        // ── Phase 1: 硬性排除 (目录 / 格式) ──
        let in_exclude_dir = default_exclude_dirs.iter().any(|d| path_str.contains(d))
            || task.policy.exclude_dirs.iter().any(|d| !d.trim().is_empty() && path_str.contains(d));

        let in_exclude_pattern = task.policy.exclude_patterns.iter().any(|pat| {
            let clean_pat = pat.trim_start_matches('*').trim_start_matches('.');
            file_name.to_lowercase().ends_with(clean_pat)
        });

        if in_exclude_dir || in_exclude_pattern {
            noise_count += 1;
            noise_bytes += file_size;
            items_to_save.push(AssetItem {
                id: Uuid::new_v4().to_string(),
                task_id: task_id.clone(),
                file_path: path_str,
                file_name,
                file_type: ext,
                file_size,
                file_mtime,
                classification: "NOISE".into(),
                confidence: 1.0,
                match_rule: Some("黑名单目录或后缀匹配".into()),
                tags: vec![],
                ai_summary: None,
                content_hash: None,
                created_at: now,
                updated_at: now,
            });
            continue;
        }

        // ── Phase 2: 正向标签匹配 ──
        let mut matched_tags = Vec::new();
        for tag in &task.policy.tags {
            let clean_tag = tag.trim_start_matches('#').to_lowercase();
            if file_name.to_lowercase().contains(&clean_tag) {
                matched_tags.push(tag.clone());
            }
        }

        if !matched_tags.is_empty() {
            asset_count += 1;
            items_to_save.push(AssetItem {
                id: Uuid::new_v4().to_string(),
                task_id: task_id.clone(),
                file_path: path_str,
                file_name,
                file_type: ext,
                file_size,
                file_mtime,
                classification: "ASSET".into(),
                confidence: 0.92,
                match_rule: Some(format!("命中标签: {}", matched_tags.join(","))),
                tags: matched_tags,
                ai_summary: None,
                content_hash: None,
                created_at: now,
                updated_at: now,
            });
            continue;
        }

        // ── Phase 3: 向量嵌入与 AI 相似度检索比对 ──
        let item_id = Uuid::new_v4().to_string();
        let snippet = file_parser::read_text_snippet(&path_str, 1500).unwrap_or_default();
        let mut classification = "PENDING".to_string();
        let mut confidence = 0.50f64;
        let mut match_rule = "向量比对待确认".to_string();
        let mut ai_summary = None;

        if !snippet.is_empty() {
            let summary_text = if snippet.len() > 200 {
                format!("{}...", &snippet[..200])
            } else {
                snippet.clone()
            };
            ai_summary = Some(summary_text);

            if let Some(ref intent_vec) = intent_embedding {
                let file_embed_text = format!("{} {}", file_name, snippet);
                if let Ok(file_vec) = ollama::generate_embedding(&file_embed_text).await {
                    let sim = cosine_similarity(intent_vec, &file_vec);
                    embeddings_to_save.push((item_id.clone(), file_vec));

                    if sim >= 0.62 {
                        classification = "ASSET".into();
                        confidence = (sim as f64 * 100.0).min(98.0);
                        match_rule = format!("AI向量契合度 ({:.0}%)", sim * 100.0);
                    } else if sim < 0.38 {
                        classification = "NOISE".into();
                        confidence = ((1.0 - sim) as f64 * 100.0).min(95.0);
                        match_rule = format!("AI向量契合度过低 ({:.0}%)", sim * 100.0);
                    } else {
                        classification = "PENDING".into();
                        confidence = (sim as f64 * 100.0);
                        match_rule = format!("AI向量比对中等契合 ({:.0}%)", sim * 100.0);
                    }
                }
            }
        }

        match classification.as_str() {
            "ASSET" => asset_count += 1,
            "NOISE" => {
                noise_count += 1;
                noise_bytes += file_size;
            }
            _ => pending_count += 1,
        }

        items_to_save.push(AssetItem {
            id: item_id,
            task_id: task_id.clone(),
            file_path: path_str,
            file_name,
            file_type: ext,
            file_size,
            file_mtime,
            classification,
            confidence,
            match_rule: Some(match_rule),
            tags: vec![],
            ai_summary,
            content_hash: None,
            created_at: now,
            updated_at: now,
        });
    }

    // ── 批量写入数据库 ──
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    // 删除原条目重新构建
    let _ = conn.execute("DELETE FROM asset_items WHERE task_id = ?1", params![task_id]);

    for item in items_to_save {
        let tags_json = serde_json::to_string(&item.tags).unwrap_or_default();
        let _ = conn.execute(
            "INSERT INTO asset_items (
                id, task_id, file_path, file_name, file_type, file_size, file_mtime,
                classification, confidence, match_rule, tags, ai_summary, content_hash,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                item.id,
                item.task_id,
                item.file_path,
                item.file_name,
                item.file_type,
                item.file_size,
                item.file_mtime,
                item.classification,
                item.confidence,
                item.match_rule,
                tags_json,
                item.ai_summary,
                item.content_hash,
                item.created_at,
                item.updated_at
            ],
        );
    }

    // 写入向量表
    for (item_id, vec) in embeddings_to_save {
        let bytes: &[u8] = bytemuck::cast_slice(&vec);
        let _ = conn.execute(
            "INSERT OR REPLACE INTO asset_embeddings (item_id, embedding) VALUES (?1, ?2)",
            params![item_id, bytes],
        );
    }

    // 更新任务统计
    let _ = conn.execute(
        "UPDATE asset_tasks SET status = 'idle', total_files = ?1, asset_count = ?2,
                noise_count = ?3, pending_count = ?4, last_scan_at = ?5, updated_at = ?5
         WHERE id = ?6",
        params![total_files, asset_count, noise_count, pending_count, now, task_id],
    );

    Ok(AssetStats {
        total_files,
        asset_count,
        noise_count,
        pending_count,
        noise_bytes,
    })
}

/// 查询资产条目列表
#[tauri::command]
pub fn query_asset_items(
    task_id: String,
    classification: Option<String>,
    keyword: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    state: State<'_, AppState>,
) -> Result<AssetQueryResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let p = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(20).max(1);
    let offset = (p - 1) * ps;

    let mut sql = String::from("SELECT id, task_id, file_path, file_name, file_type, file_size, file_mtime, classification, confidence, match_rule, tags, ai_summary, content_hash, created_at, updated_at FROM asset_items WHERE task_id = ?1");
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(task_id.clone())];

    if let Some(ref class) = classification {
        if !class.is_empty() && class != "ALL" {
            sql.push_str(" AND classification = ?");
            params_vec.push(Box::new(class.clone()));
        }
    }

    if let Some(ref kw) = keyword {
        if !kw.trim().is_empty() {
            sql.push_str(" AND (file_name LIKE ? OR ai_summary LIKE ?)");
            let pattern = format!("%{}%", kw.trim());
            params_vec.push(Box::new(pattern.clone()));
            params_vec.push(Box::new(pattern));
        }
    }

    // 统计总数
    let count_sql = format!("SELECT COUNT(*) FROM ({})", sql);
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, params_refs.as_slice(), |r| r.get(0)).unwrap_or(0);

    sql.push_str(" ORDER BY confidence DESC, updated_at DESC LIMIT ? OFFSET ?");
    params_vec.push(Box::new(ps));
    params_vec.push(Box::new(offset));
    let params_refs_final: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params_refs_final.as_slice(), |row| {
        let tags_str: Option<String> = row.get(10)?;
        let tags = tags_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();

        Ok(AssetItem {
            id: row.get(0)?,
            task_id: row.get(1)?,
            file_path: row.get(2)?,
            file_name: row.get(3)?,
            file_type: row.get(4)?,
            file_size: row.get(5)?,
            file_mtime: row.get(6)?,
            classification: row.get(7)?,
            confidence: row.get(8)?,
            match_rule: row.get(9)?,
            tags,
            ai_summary: row.get(11)?,
            content_hash: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for r in rows.flatten() {
        items.push(r);
    }

    Ok(AssetQueryResult {
        items,
        total,
        page: p,
        page_size: ps,
    })
}

/// 分类单个资产
#[tauri::command]
pub fn classify_asset_item(
    item_id: String,
    classification: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = Local::now().timestamp();
    conn.execute(
        "UPDATE asset_items SET classification = ?1, confidence = 1.0, match_rule = '用户裁决', updated_at = ?2 WHERE id = ?3",
        params![classification, now, item_id],
    ).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 批量分类资产
#[tauri::command]
pub fn batch_classify_assets(
    item_ids: Vec<String>,
    classification: String,
    state: State<'_, AppState>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let now = Local::now().timestamp();
    let mut updated = 0i64;
    for id in item_ids {
        if conn.execute(
            "UPDATE asset_items SET classification = ?1, confidence = 1.0, match_rule = '用户批量裁决', updated_at = ?2 WHERE id = ?3",
            params![classification, now, id],
        ).is_ok() {
            updated += 1;
        }
    }
    Ok(updated)
}

/// 资产语义与双通道检索
#[tauri::command]
pub async fn search_assets(
    task_id: String,
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<AssetItem>, String> {
    let query_clean = query.trim().to_lowercase();
    if query_clean.is_empty() {
        let res = query_asset_items(task_id, Some("ASSET".into()), None, Some(1), Some(50), state)?;
        return Ok(res.items);
    }

    // 先做基础关键词匹配
    let base_res = query_asset_items(task_id.clone(), None, Some(query_clean.clone()), Some(1), Some(50), state.clone())?;
    let mut results = base_res.items;

    // 若有向量接口则做向量增强比对
    if let Ok(query_vec) = ollama::generate_embedding(&query_clean).await {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT item_id, embedding FROM asset_embeddings").map_err(|e| e.to_string())?;
        let vec_rows = stmt.query_map([], |row| {
            let item_id: String = row.get(0)?;
            let bytes: Vec<u8> = row.get(1)?;
            let vec: &[f32] = bytemuck::cast_slice(&bytes);
            Ok((item_id, vec.to_vec()))
        }).map_err(|e| e.to_string())?;

        let mut sim_map: HashMap<String, f32> = HashMap::new();
        for r in vec_rows.flatten() {
            let sim = cosine_similarity(&query_vec, &r.1);
            if sim > 0.45 {
                sim_map.insert(r.0, sim);
            }
        }

        if !sim_map.is_empty() {
            let ids: Vec<String> = sim_map.keys().cloned().collect();
            let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!("SELECT id, task_id, file_path, file_name, file_type, file_size, file_mtime, classification, confidence, match_rule, tags, ai_summary, content_hash, created_at, updated_at FROM asset_items WHERE id IN ({})", placeholders);

            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let params_refs: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
            let vec_items = stmt.query_map(params_refs.as_slice(), |row| {
                let tags_str: Option<String> = row.get(10)?;
                let tags = tags_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
                Ok(AssetItem {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    file_path: row.get(2)?,
                    file_name: row.get(3)?,
                    file_type: row.get(4)?,
                    file_size: row.get(5)?,
                    file_mtime: row.get(6)?,
                    classification: row.get(7)?,
                    confidence: row.get(8)?,
                    match_rule: row.get(9)?,
                    tags,
                    ai_summary: row.get(11)?,
                    content_hash: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            }).map_err(|e| e.to_string())?;

            for item in vec_items.flatten() {
                if !results.iter().any(|r| r.id == item.id) {
                    results.push(item);
                }
            }
        }
    }

    Ok(results)
}

/// 一键生成结构化 .md 知识库 / Obsidian / Agent 上下文
#[tauri::command]
pub async fn generate_knowledge_base(
    task_id: String,
    kb_name: Option<String>,
    output_dir: Option<String>,
    obsidian_mode: Option<bool>,
    state: State<'_, AppState>,
) -> Result<KnowledgeBaseResult, String> {
    let task = get_asset_task(task_id.clone(), state.clone())?;
    let items_res = query_asset_items(task_id.clone(), Some("ASSET".into()), None, Some(1), Some(200), state.clone())?;
    let assets = items_res.items;

    if assets.is_empty() {
        return Err("当前任务无任何保留的资产文件，无法生成知识库".into());
    }

    let is_obsidian = obsidian_mode.unwrap_or(false);
    let name = kb_name.unwrap_or_else(|| format!("{}_知识库", task.name));
    let target_dir = output_dir.unwrap_or_else(|| task.workspace_path.clone());
    let now_str = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut md = String::new();

    if is_obsidian {
        md.push_str("---\n");
        md.push_str(&format!("title: {}\n", name));
        md.push_str(&format!("date: {}\n", now_str));
        md.push_str("tags: [知识资产, 智能归档]\n");
        md.push_str(&format!("asset_count: {}\n", assets.len()));
        md.push_str("---\n\n");
    }

    md.push_str(&format!("# {}\n", name));
    md.push_str(&format!("> 自动生成时间：{} | 汇总资产数：{} 个 | 存储工作区：`{}`\n\n", now_str, assets.len(), task.workspace_path));

    md.push_str("## 目录\n");
    for (idx, asset) in assets.iter().enumerate() {
        md.push_str(&format!("{}. [{}]({})\n", idx + 1, asset.file_name, asset.file_path));
    }
    md.push_str("\n---\n\n");

    md.push_str("## 核心资产汇总\n\n");
    for (idx, asset) in assets.iter().enumerate() {
        md.push_str(&format!("### {}. {}\n", idx + 1, asset.file_name));
        if is_obsidian {
            md.push_str(&format!("> 📄 文件引用：[[{}]]\n", asset.file_name));
        } else {
            md.push_str(&format!("> 📄 文件路径：`{}`\n", asset.file_path));
        }
        if !asset.tags.is_empty() {
            let formatted_tags = asset.tags.iter().map(|t| if is_obsidian && !t.starts_with('#') { format!("#{}", t) } else { t.clone() }).collect::<Vec<_>>().join(" ");
            md.push_str(&format!("> 🏷️ 标签：{}\n", formatted_tags));
        }
        md.push_str(&format!("> ⚡ 匹配判定：{}\n\n", asset.match_rule.as_deref().unwrap_or("自动筛选")));

        if let Some(ref summary) = asset.ai_summary {
            md.push_str(&format!("**内容摘要**：\n{}\n\n", summary));
        } else {
            md.push_str("*暂无正文摘要*\n\n");
        }
        md.push_str("---\n\n");
    }

    md.push_str("## 附录：文件清单与元数据\n\n");
    md.push_str("| # | 文件名 | 类型 | 大小 | 匹配分值 |\n");
    md.push_str("|---|--------|------|------|----------|\n");
    for (idx, asset) in assets.iter().enumerate() {
        let size_kb = asset.file_size as f64 / 1024.0;
        let size_str = if size_kb > 1024.0 {
            format!("{:.2} MB", size_kb / 1024.0)
        } else {
            format!("{:.1} KB", size_kb)
        };
        md.push_str(&format!("| {} | {} | {} | {} | {:.0}% |\n", idx + 1, asset.file_name, asset.file_type, size_str, asset.confidence));
    }
    md.push_str("\n\n*本文档由智能资产沉淀系统生成*\n");

    let file_name_clean = format!("{}.md", name.replace("/", "_").replace(" ", "_"));
    let output_path = PathBuf::from(&target_dir).join(&file_name_clean);

    fs::write(&output_path, &md).map_err(|e| format!("写入知识库文件失败: {}", e))?;
    let file_size = md.len() as i64;
    let out_str = output_path.to_string_lossy().to_string();

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let _ = conn.execute(
        "INSERT INTO asset_kb_history (id, task_id, output_path, asset_count, file_size, obsidian_mode, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![Uuid::new_v4().to_string(), task_id, out_str, assets.len() as i64, file_size, if is_obsidian { 1 } else { 0 }, Local::now().timestamp()],
    );

    Ok(KnowledgeBaseResult {
        output_path: out_str,
        asset_count: assets.len() as i64,
        file_size,
    })
}

/// 获取沉淀统计数据
#[tauri::command]
pub fn get_asset_stats(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<AssetStats, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let total_files: i64 = conn.query_row("SELECT COUNT(*) FROM asset_items WHERE task_id = ?1", params![task_id], |r| r.get(0)).unwrap_or(0);
    let asset_count: i64 = conn.query_row("SELECT COUNT(*) FROM asset_items WHERE task_id = ?1 AND classification = 'ASSET'", params![task_id], |r| r.get(0)).unwrap_or(0);
    let noise_count: i64 = conn.query_row("SELECT COUNT(*) FROM asset_items WHERE task_id = ?1 AND classification = 'NOISE'", params![task_id], |r| r.get(0)).unwrap_or(0);
    let pending_count: i64 = conn.query_row("SELECT COUNT(*) FROM asset_items WHERE task_id = ?1 AND classification = 'PENDING'", params![task_id], |r| r.get(0)).unwrap_or(0);
    let noise_bytes: i64 = conn.query_row("SELECT COALESCE(SUM(file_size), 0) FROM asset_items WHERE task_id = ?1 AND classification = 'NOISE'", params![task_id], |r| r.get(0)).unwrap_or(0);

    Ok(AssetStats {
        total_files,
        asset_count,
        noise_count,
        pending_count,
        noise_bytes,
    })
}
