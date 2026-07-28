mod db;
mod ollama;

use serde::Serialize;
use std::fs;
use std::path::Path;
mod file_parser;
use chrono::{DateTime, Local};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;
use tauri::State;

fn is_whitelisted_ext(ext: &str) -> bool {
    let ext = ext.to_lowercase();
    matches!(
        ext.as_str(),
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "md" |
        "pages" | "numbers" | "key" | "jpg" | "jpeg" | "png" | "gif" | "svg" |
        "mp4" | "mov" | "mp3" | "psd" | "ai" | "figma"
    )
}

fn format_file_size(bytes: u64) -> String {
    let kb = bytes as f64 / 1024.0;
    let mb = kb / 1024.0;
    let gb = mb / 1024.0;

    if gb >= 1.0 {
        let s = format!("{:.2}", gb);
        let trimmed = s.trim_end_matches('0').trim_end_matches('.');
        format!("{} GB", trimmed)
    } else if mb >= 0.5 {
        let s = format!("{:.1}", mb);
        let trimmed = s.trim_end_matches('0').trim_end_matches('.');
        format!("{} MB", trimmed)
    } else {
        let kb_val = kb.round().max(1.0);
        format!("{:.0} KB", kb_val)
    }
}

struct AppState {
    db: Mutex<Connection>,
}

#[derive(Serialize)]
struct ExcelSheetData {
    name: String,
    rows: Vec<Vec<String>>,
}

#[derive(Serialize)]
struct ExcelPreviewData {
    sheets: Vec<ExcelSheetData>,
}

#[tauri::command]
async fn parse_excel_preview(path: String) -> Result<ExcelPreviewData, String> {
    use calamine::{open_workbook_auto, Data, Reader};
    tokio::task::spawn_blocking(move || {
        let mut workbook = open_workbook_auto(&path).map_err(|e| format!("无法读取 Excel 文件: {}", e))?;
        let sheet_names = workbook.sheet_names().to_vec();
        let mut sheets = Vec::new();

        for sheet_name in sheet_names {
            if let Ok(range) = workbook.worksheet_range(&sheet_name) {
                let mut rows = Vec::new();
                for row in range.rows().take(100) {
                    let row_data: Vec<String> = row.iter().take(20).map(|cell| match cell {
                        Data::Empty => String::new(),
                        Data::String(s) => s.trim().to_string(),
                        Data::Float(f) => {
                            let s = format!("{:.2}", f);
                            s.trim_end_matches('0').trim_end_matches('.').to_string()
                        },
                        Data::Int(i) => i.to_string(),
                        Data::Bool(b) => b.to_string(),
                        Data::DateTime(d) => format!("{}", d),
                        Data::Error(e) => format!("Err: {:?}", e),
                        _ => cell.to_string(),
                    }).collect();
                    rows.push(row_data);
                }
                sheets.push(ExcelSheetData {
                    name: sheet_name,
                    rows,
                });
            }
        }

        Ok(ExcelPreviewData { sheets })
    }).await.map_err(|e| e.to_string())?
}

#[derive(Serialize, Clone)]
struct FileItem {
    id: String,
    name: String,
    #[serde(rename = "type")]
    file_type: String,
    size: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    category: String,
    tags: Vec<String>,
    path: String,
    #[serde(rename = "aiSuggestion")]
    ai_suggestion: Option<String>,
    #[serde(rename = "virtualName")]
    virtual_name: Option<String>,
    #[serde(rename = "smartGroup")]
    smart_group: Option<String>,
}

use walkdir::WalkDir;

#[tauri::command]
async fn get_files(dir_path: Option<String>, state: State<'_, AppState>) -> Result<Vec<FileItem>, String> {
    let dir_str = dir_path.unwrap_or_else(|| {
        dirs::desktop_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| String::from("/"))
    });

    let target_path = match dir_str.as_str() {
        "sys:downloads" => dirs::download_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| String::from("/")),
        "sys:desktop" => dirs::desktop_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| String::from("/")),
        "sys:recent" => String::from("sys:recent"),
        _ => dir_str.clone(),
    };

    let mut result = Vec::new();

    // 针对 recent 进行特殊的查询返回，不进行 WalkDir
    if target_path == "sys:recent" {
        if let Ok(conn) = state.db.lock() {
            let mut stmt = conn.prepare("
                SELECT f.id, f.name, f.file_type, f.size, f.updated_at, f.path, f.ai_suggestion, f.virtual_name, f.tags, f.smart_group 
                FROM files f
                JOIN recent_files r ON f.path = r.path
                ORDER BY r.last_operated_at DESC
            ").unwrap();
            
            let rows = stmt.query_map([], |row| {
                let tags_str: Option<String> = row.get(8)?;
                let tags = if let Some(s) = tags_str {
                    if s.is_empty() { vec![] } else { s.split(',').map(|s| s.to_string()).collect() }
                } else {
                    vec![]
                };
                
                Ok(FileItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    file_type: row.get(2)?,
                    size: row.get(3)?,
                    updated_at: row.get(4)?,
                    path: row.get(5)?,
                    ai_suggestion: row.get(6)?,
                    virtual_name: row.get(7)?,
                    tags,
                    smart_group: row.get(9)?,
                    category: "recent".to_string(),
                })
            });
            
            if let Ok(mapped_rows) = rows {
                for row in mapped_rows.flatten() {
                    result.push(row);
                }
            }
        }
        return Ok(result);
    }

    // 1. Gather all file entries first to avoid holding DB lock
    struct FileEntry {
        id_str: String,
        file_name: String,
        file_type: String,
        size_str: String,
        updated_at: String,
        path_str: String,
        modified_timestamp: i64,
    }
    let mut entries = Vec::new();

    if let Ok(dir_entries) = std::fs::read_dir(&target_path) {
        for entry_result in dir_entries {
            let entry = match entry_result {
                Ok(e) => e,
                Err(_) => continue,
            };

            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };

            let path_buf = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            
            if file_name.starts_with('.') {
                continue;
            }

            let is_dir = path_buf.is_dir();
            let extension = if is_dir {
                "folder".to_string()
            } else {
                path_buf.extension()
                    .map(|ext| ext.to_string_lossy().to_string().to_lowercase())
                    .unwrap_or_else(|| String::from("unknown"))
            };
            
            if !is_dir && !is_whitelisted_ext(&extension) {
                continue;
            }

            let file_type = if is_dir {
                if file_name.to_lowercase().ends_with(".app") {
                    "app".to_string()
                } else {
                    "folder".to_string()
                }
            } else {
                match extension.as_str() {
                    "pdf" => "pdf",
                    "doc" | "docx" | "txt" | "md" => "word",
                    "xls" | "xlsx" | "csv" => "excel",
                    "png" | "jpg" | "jpeg" | "gif" | "webp" => "image",
                    "mp4" | "mov" | "avi" => "video",
                    "zip" | "rar" | "7z" | "tar" | "gz" | "dmg" | "exe" | "pkg" => "default",
                    _ => "unknown",
                }.to_string()
            };

            let size_str = if is_dir {
                String::from("--")
            } else {
                format_file_size(metadata.len())
            };

        let updated_at = if let Ok(time) = metadata.modified() {
            let dt: DateTime<Local> = time.into();
            dt.format("%Y/%m/%d %H:%M").to_string()
        } else {
            String::from("Unknown")
        };

        let modified_timestamp = if let Ok(time) = metadata.modified() {
            time.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64
        } else {
            0
        };
        
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        path_buf.to_string_lossy().to_string().hash(&mut hasher);
        let id_str = format!("file_{}", hasher.finish());
        let path_str = path_buf.to_string_lossy().to_string();

            entries.push(FileEntry {
                id_str,
                file_name,
                file_type,
                size_str,
                updated_at,
                path_str,
                modified_timestamp,
            });
        }
    }

    // 2. Bulk insert via transaction
    if let Ok(mut conn) = state.db.lock() {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        {
            let mut stmt = tx.prepare("
                INSERT INTO files (id, name, file_type, size, updated_at, path, modified_timestamp) 
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                ON CONFLICT(path) DO UPDATE SET modified_timestamp=excluded.modified_timestamp, updated_at=excluded.updated_at, size=excluded.size
            ").map_err(|e| e.to_string())?;

            for e in entries {
                let _ = stmt.execute((&e.id_str, &e.file_name, &e.file_type, &e.size_str, &e.updated_at, &e.path_str, &e.modified_timestamp));
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
    }

    let mut result = Vec::new();

    // 从数据库中读取完整列表，并按照修改时间排序
    if let Ok(conn) = state.db.lock() {
        let mut stmt = conn.prepare("SELECT id, name, file_type, size, updated_at, path, ai_suggestion, virtual_name, tags, smart_group FROM files WHERE path LIKE ? ORDER BY modified_timestamp DESC").unwrap();
        let target_pattern = format!("{}%", target_path);
        let rows = stmt.query_map([target_pattern], |row| {
            let tags_str: Option<String> = row.get(8)?;
            let tags = if let Some(s) = tags_str {
                if s.is_empty() { vec![] } else { s.split(',').map(|s| s.to_string()).collect() }
            } else {
                vec![]
            };
            
            Ok(FileItem {
                id: row.get(0)?,
                name: row.get(1)?,
                file_type: row.get(2)?,
                size: row.get(3)?,
                updated_at: row.get(4)?,
                path: row.get(5)?,
                ai_suggestion: row.get(6)?,
                virtual_name: row.get(7)?,
                tags,
                smart_group: row.get(9)?,
                category: "desktop".to_string(), // Frontend logic can override this
            })
        });
        
        if let Ok(mapped_rows) = rows {
            for row in mapped_rows.flatten() {
                result.push(row);
            }
        }
    }

    Ok(result)
}

#[tauri::command]
async fn apply_virtual_rename(id: String, new_virtual_name: String, path: Option<String>, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(conn) = state.db.lock() {
        let mut rows = conn.execute(
            "UPDATE files SET virtual_name = ?1 WHERE id = ?2",
            (&new_virtual_name, &id),
        ).unwrap_or(0);
        
        // If ID didn't match (e.g. legacy DB entry), fall back to path match
        if rows == 0 {
            if let Some(ref p) = path {
                let _ = conn.execute(
                    "UPDATE files SET virtual_name = ?1 WHERE path = ?2",
                    (&new_virtual_name, p),
                );
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn sync_virtual_name_to_disk(id: String, state: State<'_, AppState>) -> Result<String, String> {
    let (old_path, virtual_name) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT path, virtual_name FROM files WHERE id = ?1").map_err(|e| e.to_string())?;
        stmt.query_row([&id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?)))
            .map_err(|e| e.to_string())?
    };

    let target_name = virtual_name.ok_or_else(|| "当前文件尚未生成或指定虚拟名称".to_string())?;
    let old_path_buf = std::path::PathBuf::from(&old_path);
    if !old_path_buf.exists() {
        return Err("源文件在磁盘上已被移动或删除".to_string());
    }

    let parent = old_path_buf.parent().ok_or_else(|| "无效的文件目录".to_string())?;
    let ext = old_path_buf.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mut sanitized_name = target_name.trim().replace('/', "_").replace('\\', "_").replace(':', "_");
    
    if !ext.is_empty() && !sanitized_name.to_lowercase().ends_with(&format!(".{}", ext.to_lowercase())) {
        sanitized_name = format!("{}.{}", sanitized_name, ext);
    }
    
    let new_path_buf = parent.join(&sanitized_name);
    let new_path_str = new_path_buf.to_string_lossy().to_string();

    if old_path_buf != new_path_buf {
        std::fs::rename(&old_path_buf, &new_path_buf).map_err(|e| format!("物理文件改名失败: {}", e))?;

        if let Ok(conn) = state.db.lock() {
            let _ = conn.execute(
                "UPDATE files SET path = ?1, name = ?2, virtual_name = ?3 WHERE id = ?4",
                (&new_path_str, &sanitized_name, &sanitized_name, &id),
            );
            let _ = conn.execute(
                "UPDATE recent_files SET path = ?1 WHERE path = ?2",
                (&new_path_str, &old_path),
            );
        }
    }

    Ok(new_path_str)
}

fn is_blacklisted_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    if lower.contains("/system/") 
        || lower.contains("/library/") 
        || lower.contains("/applications/") 
        || lower.contains("node_modules") 
        || lower.contains(".git/") 
        || lower.contains(".vscode") 
        || lower.contains("library/caches") 
        || lower.contains("/.trash/") {
        return true;
    }
    if let Some(filename) = std::path::Path::new(path).file_name().and_then(|n| n.to_str()) {
        if filename.starts_with('.') {
            return true;
        }
    }
    false
}

#[derive(Serialize)]
struct SmartCluster {
    id: String,
    name: String,
    count: usize,
    category_type: Option<String>,
    path: Option<String>,
}

#[tauri::command]
async fn get_smart_folder_stats(state: tauri::State<'_, AppState>) -> Result<Vec<SmartCluster>, String> {
    use std::collections::{HashMap, HashSet};
    use rusqlite::params;
    
    let mut clusters: Vec<SmartCluster> = Vec::new();
    let mut files = Vec::new();
    
    let mut img_count = 0;
    let mut doc_count = 0;
    let mut xls_count = 0;
    let mut media_count = 0;

    let mut scenario_counts: HashMap<&str, (usize, &str, &str)> = HashMap::new();
    // (count, id_str, display_name)
    scenario_counts.insert("resume", (0, "smart_scenario_resume", "求职简历"));
    scenario_counts.insert("contract", (0, "smart_scenario_contract", "合同协议"));
    scenario_counts.insert("invoice", (0, "smart_scenario_invoice", "财务发票"));
    scenario_counts.insert("report", (0, "smart_scenario_report", "方案报告"));
    scenario_counts.insert("data", (0, "smart_scenario_data", "数据报表"));
    scenario_counts.insert("design", (0, "smart_scenario_design", "设计素材"));
    scenario_counts.insert("study", (0, "smart_scenario_study", "学习备考"));
    scenario_counts.insert("media", (0, "smart_scenario_media", "影音媒体"));
    scenario_counts.insert("code", (0, "smart_scenario_code", "代码工程"));

    if let Ok(conn) = state.db.lock() {
        if let Ok(mut stmt) = conn.prepare("SELECT id, name, path FROM files") {
            if let Ok(rows) = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let path: String = row.get(2)?;
                Ok((id, name, path))
            }) {
                for r in rows.flatten() {
                    if is_blacklisted_path(&r.2) {
                        continue;
                    }

                    let ext = std::path::Path::new(&r.1)
                        .extension()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_lowercase();
                    match ext.as_str() {
                        "jpg" | "jpeg" | "png" | "gif" | "svg" | "webp" | "bmp" => img_count += 1,
                        "pdf" | "doc" | "docx" | "txt" | "md" | "pages" => doc_count += 1,
                        "xls" | "xlsx" | "csv" | "numbers" => xls_count += 1,
                        "mp4" | "mov" | "mp3" | "wav" | "m4a" | "avi" | "mkv" => media_count += 1,
                        _ => {}
                    }

                    let lower_name = r.1.to_lowercase();

                    // Scenario pattern matching (100% aligned with get_files_by_cluster)
                    if lower_name.contains("简历") || lower_name.contains("cv") || lower_name.contains("resume") || lower_name.contains("作品集") {
                        scenario_counts.get_mut("resume").unwrap().0 += 1;
                    }
                    if lower_name.contains("合同") || lower_name.contains("协议") || lower_name.contains("contract") || lower_name.contains("agreement") || lower_name.contains("意向书") || lower_name.contains("nda") {
                        scenario_counts.get_mut("contract").unwrap().0 += 1;
                    }
                    if lower_name.contains("发票") || lower_name.contains("收据") || lower_name.contains("invoice") || lower_name.contains("receipt") || lower_name.contains("报销") || lower_name.contains("账单") {
                        scenario_counts.get_mut("invoice").unwrap().0 += 1;
                    }
                    if lower_name.contains("方案") || lower_name.contains("报告") || lower_name.contains("总结") || lower_name.contains("纪要") || lower_name.contains("计划") || lower_name.contains("prd") {
                        scenario_counts.get_mut("report").unwrap().0 += 1;
                    }
                    if lower_name.contains("报表") || lower_name.contains("明细") || lower_name.contains("统计") || lower_name.contains("清单") || ext == "xlsx" || ext == "csv" || ext == "xls" || ext == "numbers" {
                        scenario_counts.get_mut("data").unwrap().0 += 1;
                    }
                    if lower_name.contains("设计") || lower_name.contains("ui") || lower_name.contains("图标") || ext == "psd" || ext == "sketch" || ext == "fig" || lower_name.contains(".psd") || lower_name.contains(".sketch") || lower_name.contains(".fig") {
                        scenario_counts.get_mut("design").unwrap().0 += 1;
                    }
                    if lower_name.contains("论文") || lower_name.contains("paper") || lower_name.contains("课件") || lower_name.contains("笔记") || lower_name.contains("教程") || lower_name.contains("考研") || lower_name.contains("试题") {
                        scenario_counts.get_mut("study").unwrap().0 += 1;
                    }
                    if ext == "mp4" || ext == "mov" || ext == "mp3" || ext == "wav" || ext == "m4a" || ext == "avi" || lower_name.contains("录音") || lower_name.contains("vlog") {
                        scenario_counts.get_mut("media").unwrap().0 += 1;
                    }
                    if lower_name.contains("源码") || lower_name.contains("脚本") || lower_name.contains("api") || ext == "rs" || ext == "js" || ext == "py" {
                        scenario_counts.get_mut("code").unwrap().0 += 1;
                    }

                    files.push((r.0, r.1));
                }
            }
        }
    }

    // 1. Top 4 Fixed Format Micro-Cards
    clusters.push(SmartCluster {
        id: String::from("smart_format_image"),
        name: String::from("图片资产"),
        count: img_count,
        category_type: Some(String::from("format")),
        path: None,
    });
    clusters.push(SmartCluster {
        id: String::from("smart_format_document"),
        name: String::from("文档资料"),
        count: doc_count,
        category_type: Some(String::from("format")),
        path: None,
    });
    clusters.push(SmartCluster {
        id: String::from("smart_format_excel"),
        name: String::from("表格数据"),
        count: xls_count,
        category_type: Some(String::from("format")),
        path: None,
    });
    clusters.push(SmartCluster {
        id: String::from("smart_format_media"),
        name: String::from("媒体资产"),
        count: media_count,
        category_type: Some(String::from("format")),
        path: None,
    });

    // 2. High-Value Business & Daily Scenarios (Auto-generated threshold: count >= 5)
    let mut scenario_list: Vec<(&str, usize, &str, &str)> = scenario_counts
        .into_iter()
        .map(|(k, (count, id_str, display_name))| (k, count, id_str, display_name))
        .filter(|(_, count, _, _)| *count >= 5)
        .collect();

    scenario_list.sort_by(|a, b| b.1.cmp(&a.1));

    for (_, count, id_str, display_name) in scenario_list {
        clusters.push(SmartCluster {
            id: String::from(id_str),
            name: String::from(display_name),
            count,
            category_type: Some(String::from("scenario")),
            path: None,
        });
    }

    // 3. Dynamic Theme & Content Clustering (Auto-generated threshold: count >= 5)
    let stopwords = ["新建", "副本", "复件", "测试", "文件", "档案", "内容", "下载", "桌面", "拷贝", "截图", "屏幕", "微信", "企业微信", "2985", "1784", "00", "01"];
    let mut ngram_counts: HashMap<String, HashSet<String>> = HashMap::new();
    
    for (id, name) in &files {
        let stem = std::path::Path::new(name).file_stem().unwrap_or_default().to_string_lossy().to_string();
        
        let mut tokens = Vec::new();
        let mut current_en = String::new();
        for c in stem.chars() {
            if c.is_ascii_alphabetic() {
                current_en.push(c);
            } else {
                if !current_en.is_empty() {
                    tokens.push(current_en.clone().to_lowercase());
                    current_en.clear();
                }
                if c.is_alphabetic() && !c.is_ascii() {
                    tokens.push(c.to_string());
                }
            }
        }
        if !current_en.is_empty() {
            tokens.push(current_en.to_lowercase());
        }

        for t in &tokens {
            if t.len() > 2 && t.chars().all(|c| c.is_ascii_alphabetic()) {
                if !stopwords.iter().any(|sw| t.contains(sw)) {
                    ngram_counts.entry(t.clone()).or_default().insert(id.clone());
                }
            }
        }
    }
    
    let mut candidate_clusters: Vec<(String, HashSet<String>)> = ngram_counts.into_iter()
        .filter(|(_, ids)| ids.len() >= 2)
        .collect();
    
    candidate_clusters.sort_by(|a, b| b.1.len().cmp(&a.1.len()));
    
    for (ngram, ids) in candidate_clusters.into_iter().take(6) {
        clusters.push(SmartCluster {
            id: format!("cluster_{}", ngram),
            name: ngram,
            count: ids.len(),
            category_type: Some(String::from("theme")),
            path: None,
        });
    }

    Ok(clusters)
}

#[tauri::command]
async fn get_files_by_cluster(
    theme: String,
    page: Option<u32>,
    page_size: Option<u32>,
    state: tauri::State<'_, AppState>
) -> Result<Vec<FileItem>, String> {
    use rusqlite::params;
    let mut result = Vec::new();
    let limit = page_size.unwrap_or(50);
    let offset = (page.unwrap_or(1).max(1) - 1) * limit;

    if let Ok(conn) = state.db.lock() {
        let (where_clause, param_val) = match theme.as_str() {
            "smart_format_image" | "图片资产" => (
                "lower(name) LIKE '%.jpg' OR lower(name) LIKE '%.jpeg' OR lower(name) LIKE '%.png' OR lower(name) LIKE '%.gif' OR lower(name) LIKE '%.svg' OR lower(name) LIKE '%.webp' OR lower(name) LIKE '%.bmp'".to_string(),
                None
            ),
            "smart_format_document" | "文档资料" => (
                "lower(name) LIKE '%.pdf' OR lower(name) LIKE '%.doc' OR lower(name) LIKE '%.docx' OR lower(name) LIKE '%.txt' OR lower(name) LIKE '%.md' OR lower(name) LIKE '%.pages'".to_string(),
                None
            ),
            "smart_format_excel" | "表格数据" => (
                "lower(name) LIKE '%.xls' OR lower(name) LIKE '%.xlsx' OR lower(name) LIKE '%.csv' OR lower(name) LIKE '%.numbers'".to_string(),
                None
            ),
            "smart_format_media" | "媒体资产" => (
                "lower(name) LIKE '%.mp4' OR lower(name) LIKE '%.mov' OR lower(name) LIKE '%.mp3' OR lower(name) LIKE '%.wav' OR lower(name) LIKE '%.m4a' OR lower(name) LIKE '%.avi'".to_string(),
                None
            ),
            "smart_scenario_resume" | "求职简历" | "求职简历与作品集" => (
                "name LIKE '%简历%' OR lower(name) LIKE '%cv%' OR lower(name) LIKE '%resume%' OR name LIKE '%作品集%'".to_string(),
                None
            ),
            "smart_scenario_contract" | "合同协议" | "合同协议与法律文件" => (
                "name LIKE '%合同%' OR name LIKE '%协议%' OR lower(name) LIKE '%contract%' OR lower(name) LIKE '%agreement%' OR name LIKE '%意向书%' OR lower(name) LIKE '%nda%'".to_string(),
                None
            ),
            "smart_scenario_invoice" | "财务发票" | "财务发票与报销凭证" => (
                "name LIKE '%发票%' OR name LIKE '%收据%' OR lower(name) LIKE '%invoice%' OR lower(name) LIKE '%receipt%' OR name LIKE '%报销%' OR name LIKE '%账单%'".to_string(),
                None
            ),
            "smart_scenario_report" | "方案报告" | "方案报告与工作文档" => (
                "name LIKE '%方案%' OR name LIKE '%报告%' OR name LIKE '%总结%' OR name LIKE '%纪要%' OR name LIKE '%计划%' OR lower(name) LIKE '%prd%'".to_string(),
                None
            ),
            "smart_scenario_data" | "数据报表" | "数据报表与统计表格" => (
                "name LIKE '%报表%' OR name LIKE '%明细%' OR name LIKE '%统计%' OR name LIKE '%清单%' OR lower(name) LIKE '%.xlsx' OR lower(name) LIKE '%.csv'".to_string(),
                None
            ),
            "smart_scenario_design" | "设计素材" | "设计素材与视觉资产" => (
                "name LIKE '%设计%' OR lower(name) LIKE '%ui%' OR name LIKE '%图标%' OR lower(name) LIKE '%.psd' OR lower(name) LIKE '%.sketch' OR lower(name) LIKE '%.fig%'".to_string(),
                None
            ),
            "smart_scenario_study" | "学习备考" | "学习备考与研究论文" => (
                "name LIKE '%论文%' OR lower(name) LIKE '%paper%' OR name LIKE '%课件%' OR name LIKE '%笔记%' OR name LIKE '%教程%' OR name LIKE '%考研%' OR name LIKE '%试题%'".to_string(),
                None
            ),
            "smart_scenario_media" | "影音媒体" | "影音媒体与个人记录" => (
                "lower(name) LIKE '%.mp4' OR lower(name) LIKE '%.mov' OR lower(name) LIKE '%.mp3' OR name LIKE '%录音%' OR lower(name) LIKE '%vlog%'".to_string(),
                None
            ),
            "smart_scenario_code" | "代码工程" | "代码工程与技术文档" => (
                "name LIKE '%源码%' OR name LIKE '%脚本%' OR lower(name) LIKE '%api%' OR lower(name) LIKE '%.rs' OR lower(name) LIKE '%.py'".to_string(),
                None
            ),
            _ => {
                let clean_theme = theme
                    .replace("cluster_custom_", "")
                    .replace("cluster_", "");
                ("(lower(name) LIKE ?1 OR lower(path) LIKE ?1)".to_string(), Some(format!("%{}%", clean_theme)))
            }
        };

        let sql = if param_val.is_some() {
            format!("SELECT id, name, file_type, size, updated_at, path, ai_suggestion, virtual_name, tags, smart_group FROM files WHERE ({}) ORDER BY updated_at DESC LIMIT {} OFFSET {}", where_clause, limit, offset)
        } else {
            format!("SELECT id, name, file_type, size, updated_at, path, ai_suggestion, virtual_name, tags, smart_group FROM files WHERE ({}) ORDER BY updated_at DESC LIMIT {} OFFSET {}", where_clause, limit, offset)
        };

        if let Ok(mut stmt) = conn.prepare(&sql) {
            let mapper = |row: &rusqlite::Row| -> rusqlite::Result<FileItem> {
                let path: String = row.get(5).unwrap_or_default();
                let tags_str: Option<String> = row.get(8).unwrap_or_default();
                let tags = if let Some(s) = tags_str {
                    if s.is_empty() { vec![] } else { s.split(',').map(|x| x.to_string()).collect() }
                } else { vec![] };
                
                Ok(FileItem {
                    id: row.get(0).unwrap_or_default(),
                    name: row.get(1).unwrap_or_default(),
                    file_type: row.get(2).unwrap_or_default(),
                    size: row.get(3).unwrap_or_default(),
                    updated_at: row.get(4).unwrap_or_default(),
                    path: path.clone(),
                    ai_suggestion: row.get(6).unwrap_or_default(),
                    virtual_name: row.get(7).unwrap_or_default(),
                    tags,
                    smart_group: row.get(9).unwrap_or_default(),
                    category: format!("cluster_{}", theme),
                })
            };

            let rows_result = if let Some(ref p) = param_val {
                stmt.query_map([p], mapper)
            } else {
                stmt.query_map([], mapper)
            };

            if let Ok(rows) = rows_result {
                for item in rows.flatten() {
                    if !is_blacklisted_path(&item.path) {
                        result.push(item);
                    }
                }
            }
        }
    }

    Ok(result)
}

#[tauri::command]
async fn update_file_tags(path: String, tags: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if let Ok(conn) = state.db.lock() {
        let path_obj = std::path::Path::new(&path);
        let name = path_obj.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_string();
        let metadata = std::fs::metadata(path_obj).ok();
        let size = metadata.as_ref().map(|m| format_file_size(m.len())).unwrap_or_default();
        let updated_at = metadata.as_ref().map(|m| {
            if let Ok(modified) = m.modified() {
                let dt: chrono::DateTime<chrono::Local> = modified.into();
                dt.format("%Y-%m-%d %H:%M:%S").to_string()
            } else { String::new() }
        }).unwrap_or_default();
        let ext = path_obj.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        let file_type = match ext.as_str() {
            "pdf" => "pdf", "doc" | "docx" => "word",
            "xls" | "xlsx" => "excel", "ppt" | "pptx" => "ppt",
            "jpg" | "jpeg" | "png" | "gif" | "heic" | "heif" => "image",
            "mp4" | "mov" | "avi" => "video",
            _ => if path_obj.is_dir() { 
                if name.to_lowercase().ends_with(".app") { "app" } else { "folder" }
            } else { 
                "unknown" 
            },
        };
        
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        path.hash(&mut hasher);
        let id = format!("file_{}", hasher.finish());
        
        conn.execute(
            "INSERT INTO files (id, name, file_type, size, updated_at, path, tags)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(path) DO UPDATE SET tags = excluded.tags",
            (&id, &name, &file_type, &size, &updated_at, &path, &tags),
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn rename_with_ai(path: String, name: String) -> Result<String, String> {
    let mut file_snippet;
    
    // Extract parent directory name as context (e.g. "中微" from "/Downloads/中微/14.pdf")
    let parent_dir_name = std::path::Path::new(&path)
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("");
        
    let context_prefix = if !parent_dir_name.is_empty() 
        && !["Downloads", "Desktop", "Documents", "downloads", "desktop"].contains(&parent_dir_name) {
        format!("所在分类文件夹: {}\n", parent_dir_name)
    } else {
        String::new()
    };

    if let Ok(content) = file_parser::read_text_snippet(&path, 2000) {
        let clean_content = content.trim();
        if !clean_content.is_empty() {
            file_snippet = format!("{}文件名: {}\n部分内容摘要:\n{}", context_prefix, name, clean_content);
        } else {
            file_snippet = format!("{}文件名: {}\n[特征：此文件为纯图片/扫描件 PDF，未嵌入矢量文字层]", context_prefix, name);
        }
    } else {
        file_snippet = format!("{}文件名: {}", context_prefix, name);
    }
    
    ollama::generate_smart_name(&file_snippet).await
}

#[tauri::command]
async fn sync_all_embeddings(state: State<'_, AppState>) -> Result<usize, String> {
    // 1. 获取所有需要向量化的文件（还没有在 vec_files 中）
    let missing_files: Vec<(String, String, String)> = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT id, name, path FROM files WHERE id NOT IN (SELECT file_id FROM vec_files)").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        }).map_err(|e| e.to_string())?;
        
        let mut files = Vec::new();
        for r in rows.flatten() {
            files.push(r);
        }
        files
    };

    let mut count = 0;
    // 2. 遍历调用 Ollama 获取向量并入库
    for (id, name, path) in missing_files {
        let mut content_for_embedding = format!("文件名: {}", name);
        if let Ok(text) = file_parser::read_text_snippet(&path, 2000) {
            if !text.trim().is_empty() {
                content_for_embedding = format!("文件名: {}\n内容摘要: {}", name, text);
            }
        }

        match ollama::generate_embedding(&content_for_embedding).await {
            Ok(embedding_vec) => {
                let bytes: &[u8] = bytemuck::cast_slice(&embedding_vec);
                if let Ok(conn) = state.db.lock() {
                    let _ = conn.execute(
                        "INSERT INTO vec_files (file_id, embedding) VALUES (?1, ?2)",
                        (&id, bytes),
                    );
                    count += 1;
                }
            }
            Err(e) => {
                println!("Failed to embed {}: {}", name, e);
            }
        }
    }
    
    Ok(count)
}

#[tauri::command]
async fn semantic_search(query: String, filter_category: Option<String>, state: State<'_, AppState>) -> Result<Vec<FileItem>, String> {
    // 1. Prepare FTS5 keyword query
    let fts_query = query.replace("\"", "\"\"");
    let fts_query_quoted = format!("\"{}\"", fts_query); // Exact phrase

    let mut fts_results: std::collections::HashMap<String, f32> = std::collections::HashMap::new();
    let mut vec_results: std::collections::HashMap<String, f32> = std::collections::HashMap::new();

    // 2. FTS5 Search (Full-Text)
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        
        let fts_sql = "
            SELECT f.id, fts.rank 
            FROM files_fts fts
            JOIN files f ON fts.rowid = f.rowid
            WHERE files_fts MATCH ?1
            ORDER BY rank
            LIMIT 50
        ";
        
        let mut fallback = false;
        if let Ok(mut stmt) = conn.prepare(fts_sql) {
            let mut succeeded = false;
            if let Ok(mut rows) = stmt.query([&fts_query_quoted]) {
                let mut current_rank = 1.0;
                while let Ok(Some(row)) = rows.next() {
                    let id: String = row.get(0).unwrap_or_default();
                    fts_results.insert(id, current_rank);
                    current_rank += 1.0;
                    succeeded = true;
                }
            }
            if !succeeded {
                fallback = true;
            }
        }
        
        if fallback {
            if let Ok(mut stmt) = conn.prepare(fts_sql) {
                if let Ok(mut rows) = stmt.query([&query]) {
                    let mut current_rank = 1.0;
                    while let Ok(Some(row)) = rows.next() {
                        let id: String = row.get(0).unwrap_or_default();
                        fts_results.insert(id, current_rank);
                        current_rank += 1.0;
                    }
                }
            }
        }
    }

    // 3. Vector Search (Semantic)
    if let Ok(query_embedding) = ollama::generate_embedding(&query).await {
        let query_bytes: &[u8] = bytemuck::cast_slice(&query_embedding);
        if let Ok(conn) = state.db.lock() {
            let vec_sql = "
                SELECT f.id, v.distance 
                FROM vec_files v
                JOIN files f ON v.file_id = f.id
                WHERE v.embedding MATCH ?1 AND k = 50
            ";
            if let Ok(mut stmt) = conn.prepare(vec_sql) {
                if let Ok(mut rows) = stmt.query([query_bytes]) {
                    let mut current_rank = 1.0;
                    while let Ok(Some(row)) = rows.next() {
                        let id: String = row.get(0).unwrap_or_default();
                        vec_results.insert(id, current_rank);
                        current_rank += 1.0;
                    }
                }
            }
        }
    }

    // 4. Reciprocal Rank Fusion (RRF) Merge
    let k = 60.0;
    let mut combined_scores: std::collections::HashMap<String, f32> = std::collections::HashMap::new();

    let mut all_ids = std::collections::HashSet::new();
    for id in fts_results.keys() { all_ids.insert(id.clone()); }
    for id in vec_results.keys() { all_ids.insert(id.clone()); }

    for id in all_ids {
        let mut score = 0.0;
        if let Some(rank) = fts_results.get(&id) {
            score += 1.0 / (k + rank);
        }
        if let Some(rank) = vec_results.get(&id) {
            score += 1.0 / (k + rank);
        }
        combined_scores.insert(id, score);
    }

    // 5. Fetch File Items and Boost
    let mut result = Vec::new();
    if !combined_scores.is_empty() {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        
        let ids: Vec<String> = combined_scores.keys().cloned().collect();
        let placeholders: String = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let mut sql = format!("
            SELECT id, name, file_type, size, updated_at, path, ai_suggestion, virtual_name, tags, smart_group
            FROM files
            WHERE id IN ({})
        ", placeholders);

        if let Some(ref cat) = filter_category {
            match cat.as_str() {
                "文档" => sql.push_str(" AND file_type IN ('word', 'pdf')"),
                "图片" => sql.push_str(" AND file_type = 'image'"),
                "视频" => sql.push_str(" AND file_type = 'video'"),
                _ => {} // "全部"
            }
        }

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let params = rusqlite::params_from_iter(ids.iter());
        
        let rows = stmt.query_map(params, |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let tags_str: Option<String> = row.get(8)?;
            let tags = if let Some(s) = tags_str {
                if s.is_empty() { vec![] } else { s.split(',').map(|x| x.to_string()).collect() }
            } else {
                vec![]
            };

            let mut final_score = *combined_scores.get(&id).unwrap_or(&0.0);
            
            // Boost factor: Title match
            if name.to_lowercase().contains(&query.to_lowercase()) {
                final_score += 0.5; // Significant boost
            }

            Ok((final_score, FileItem {
                id,
                name,
                file_type: row.get(2)?,
                size: row.get(3)?,
                updated_at: row.get(4)?,
                path: row.get(5)?,
                ai_suggestion: row.get(6)?,
                virtual_name: row.get(7)?,
                tags,
                smart_group: row.get(9)?,
                category: "search_result".to_string(),
            }))
        }).map_err(|e| e.to_string())?;

        let mut scored_items: Vec<(f32, FileItem)> = rows.flatten().collect();
        scored_items.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        result = scored_items.into_iter().take(200).map(|(_, item)| item).collect();
    }

    // 6. Direct SQL LIKE Fallback if FTS5 & Vector yield no results
    if result.is_empty() {
        if let Ok(conn) = state.db.lock() {
            let param = format!("%{}%", query.trim().to_lowercase());
            let mut sql = String::from("
                SELECT id, name, file_type, size, updated_at, path, ai_suggestion, virtual_name, tags, smart_group
                FROM files
                WHERE (lower(name) LIKE ?1 OR lower(path) LIKE ?1 OR lower(ai_suggestion) LIKE ?1)
            ");

            if let Some(cat) = &filter_category {
                match cat.as_str() {
                    "文档" => sql.push_str(" AND file_type IN ('word', 'pdf')"),
                    "图片" => sql.push_str(" AND file_type = 'image'"),
                    "视频" => sql.push_str(" AND file_type = 'video'"),
                    _ => {}
                }
            }

            sql.push_str(" LIMIT 200");

            if let Ok(mut stmt) = conn.prepare(&sql) {
                if let Ok(rows) = stmt.query_map([&param], |row| {
                    let tags_str: Option<String> = row.get(8)?;
                    let tags = if let Some(s) = tags_str {
                        if s.is_empty() { vec![] } else { s.split(',').map(|x| x.to_string()).collect() }
                    } else {
                        vec![]
                    };

                    Ok(FileItem {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        file_type: row.get(2)?,
                        size: row.get(3)?,
                        updated_at: row.get(4)?,
                        path: row.get(5)?,
                        ai_suggestion: row.get(6)?,
                        virtual_name: row.get(7)?,
                        tags,
                        smart_group: row.get(9)?,
                        category: "search_result".to_string(),
                    })
                }) {
                    result = rows.flatten().collect();
                }
            }
        }
    }

    Ok(result)
}

#[tauri::command]
async fn record_recent_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
        
    if let Ok(conn) = state.db.lock() {
        let _ = conn.execute(
            "INSERT INTO recent_files (path, last_operated_at) VALUES (?1, ?2)
             ON CONFLICT(path) DO UPDATE SET last_operated_at=excluded.last_operated_at",
            (&path, &timestamp),
        );
    }
    Ok(())
}

#[tauri::command]
async fn get_files_by_tag(tag: String, state: State<'_, AppState>) -> Result<Vec<FileItem>, String> {
    let mut result = Vec::new();
    if let Ok(conn) = state.db.lock() {
        let mut stmt = conn.prepare("SELECT id, name, file_type, size, updated_at, path, ai_suggestion, virtual_name, tags, smart_group FROM files WHERE tags LIKE ? ORDER BY modified_timestamp DESC").unwrap();
        let target_pattern = format!("%{}%", tag);
        let rows = stmt.query_map([target_pattern], |row| {
            let tags_str: Option<String> = row.get(8)?;
            let tags = if let Some(s) = tags_str {
                if s.is_empty() { vec![] } else { s.split(',').map(|s| s.to_string()).collect() }
            } else {
                vec![]
            };
            
            Ok(FileItem {
                id: row.get(0)?,
                name: row.get(1)?,
                file_type: row.get(2)?,
                size: row.get(3)?,
                updated_at: row.get(4)?,
                path: row.get(5)?,
                ai_suggestion: row.get(6)?,
                virtual_name: row.get(7)?,
                tags,
                smart_group: row.get(9)?,
                category: format!("tag_{}", tag),
            })
        }).map_err(|e| e.to_string())?;

        for row in rows.flatten() {
            // Because LIKE '%tag%' might match 'tag1' for 'tag', we do an exact match check in rust
            if row.tags.contains(&tag) {
                result.push(row);
            }
        }
    }
    Ok(result)
}

#[tauri::command]
async fn read_dir_shallow(path: String, state: State<'_, AppState>) -> Result<Vec<FileItem>, String> {
    let target_path = match path.as_str() {
        "sys:downloads" => dirs::download_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| String::from("/")),
        "sys:desktop" => dirs::desktop_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| String::from("/")),
        "sys:home" => dirs::home_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| String::from("/")),
        _ => path,
    };

    let mut result = Vec::new();
    let entries = std::fs::read_dir(&target_path).map_err(|e| e.to_string())?;
    
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    for entry in entries.filter_map(Result::ok) {
        let path_buf = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        
        if file_name.starts_with('.') { 
            continue; 
        }

        // 模拟 Mac HD 视图：在根目录下隐藏 unix 隐藏文件夹，只展示用户通常看到的几个标准文件夹
        if target_path == "/" && std::env::consts::OS == "macos" {
            let visible_root_folders = ["Applications", "Library", "System", "Users"];
            if !visible_root_folders.contains(&file_name.as_str()) {
                continue;
            }
        }
        
        let is_dir = path_buf.is_dir();
        let extension = if is_dir {
            "folder".to_string()
        } else {
            path_buf.extension()
                .map(|e| e.to_string_lossy().to_string().to_lowercase())
                .unwrap_or_else(|| "unknown".to_string())
        };

        if !is_dir && !is_whitelisted_ext(&extension) {
            continue;
        }

        let file_type = if is_dir {
            if file_name.to_lowercase().ends_with(".app") {
                "app".to_string()
            } else {
                "folder".to_string()
            }
        } else {
            match extension.as_str() {
                "pdf" => "pdf",
                "doc" | "docx" | "txt" | "md" => "word",
                "xls" | "xlsx" | "csv" => "excel",
                "png" | "jpg" | "jpeg" | "gif" | "webp" => "image",
                "mp4" | "mov" | "avi" => "video",
                "zip" | "rar" | "7z" | "tar" | "gz" | "dmg" | "exe" | "pkg" => "default",
                _ => "unknown",
            }.to_string()
        };

        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let size_str = if is_dir {
            String::from("--")
        } else {
            format_file_size(metadata.len())
        };

        let updated_at = if let Ok(time) = metadata.modified() {
            let dt: DateTime<Local> = time.into();
            dt.format("%Y/%m/%d %H:%M").to_string()
        } else {
            String::from("Unknown")
        };

        let path_str = path_buf.to_string_lossy().to_string();
        let mut hasher = DefaultHasher::new();
        path_str.hash(&mut hasher);
        let id_str = format!("file_{}", hasher.finish());

        let mut tags = vec![];
        let mut virtual_name = None;
        let mut ai_suggestion = None;
        let mut smart_group = None;

        if let Ok(conn) = state.db.lock() {
            if let Ok(mut stmt) = conn.prepare("SELECT tags, virtual_name, ai_suggestion, smart_group FROM files WHERE id = ?1") {
                if let Ok(mut rows) = stmt.query([&id_str]) {
                    if let Ok(Some(row)) = rows.next() {
                        let tags_str: Option<String> = row.get(0).unwrap_or(None);
                        if let Some(s) = tags_str {
                            if !s.is_empty() {
                                tags = s.split(',').map(|s| s.to_string()).collect();
                            }
                        }
                        virtual_name = row.get(1).unwrap_or(None);
                        ai_suggestion = row.get(2).unwrap_or(None);
                        smart_group = row.get(3).unwrap_or(None);
                    }
                }
            }
        }

        result.push(FileItem {
            id: id_str,
            name: file_name,
            file_type,
            size: size_str,
            updated_at,
            path: path_str,
            ai_suggestion,
            virtual_name,
            tags,
            smart_group,
            category: "pc".to_string(),
        });
    }

    result.sort_by(|a, b| {
        let a_is_folder = a.file_type == "folder";
        let b_is_folder = b.file_type == "folder";
        if a_is_folder == b_is_folder {
            a.name.cmp(&b.name)
        } else {
            b_is_folder.cmp(&a_is_folder)
        }
    });

    Ok(result)
}

#[tauri::command]
fn read_document_snippet(path: String) -> Result<String, String> {
    file_parser::read_text_snippet(&path, 500)
}

#[tauri::command]
fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "~/".to_string())
}

#[tauri::command]
async fn get_mac_recent_files(state: tauri::State<'_, AppState>) -> Result<Vec<FileItem>, String> {
    use std::process::Command;
    
    let mut custom_recent = std::collections::HashMap::new();
    if let Ok(conn) = state.db.lock() {
        if let Ok(mut stmt) = conn.prepare("SELECT path, last_operated_at FROM recent_files") {
            if let Ok(rows) = stmt.query_map([], |row| {
                let p: String = row.get(0)?;
                let ts: i64 = row.get(1)?;
                Ok((p, ts as u64))
            }) {
                for r in rows.flatten() {
                    custom_recent.insert(r.0, r.1);
                }
            }
        }
    }

    let output = Command::new("mdfind")
        .arg("-onlyin")
        .arg(dirs::home_dir().unwrap_or_default())
        .arg("kMDItemLastUsedDate = *")
        .output()
        .map_err(|e| format!("Failed to run mdfind: {}", e))?;
        
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut files_with_time: Vec<(String, u64)> = stdout
        .lines()
        .filter_map(|line| {
            let p = line.trim();
            if p.is_empty() { return None; }
            if let Ok(meta) = fs::metadata(p) {
                if !meta.is_dir() {
                    let atime = meta.accessed().unwrap_or(std::time::UNIX_EPOCH)
                        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
                    let custom_atime = custom_recent.remove(p).unwrap_or(0);
                    return Some((p.to_string(), std::cmp::max(atime, custom_atime)));
                }
            }
            None
        })
        .collect();
        
    for (p, ts) in custom_recent {
        if std::path::Path::new(&p).exists() {
            files_with_time.push((p, ts));
        }
    }
        
    // Sort descending by access time
    files_with_time.sort_by(|a, b| b.1.cmp(&a.1));
    
    // Take top 100
    let top_files: Vec<_> = files_with_time.into_iter().take(100).collect();
    
    let mut results = Vec::new();

    // Batch fetch metadata from files table to enrich the recent files
    let mut db_metadata = std::collections::HashMap::new();
    if let Ok(conn) = state.db.lock() {
        if let Ok(mut stmt) = conn.prepare("SELECT path, virtual_name, tags, smart_group, ai_suggestion FROM files") {
            if let Ok(rows) = stmt.query_map([], |row| {
                let p: String = row.get(0)?;
                let vn: Option<String> = row.get(1)?;
                let tags_str: Option<String> = row.get(2)?;
                let sg: Option<String> = row.get(3)?;
                let ai: Option<String> = row.get(4)?;
                Ok((p, vn, tags_str, sg, ai))
            }) {
                for r in rows.flatten() {
                    db_metadata.insert(r.0, (r.1, r.2, r.3, r.4));
                }
            }
        }
    }

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    for (path_str, access_ts) in top_files {
        let path = std::path::Path::new(&path_str);
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            let metadata = fs::metadata(path).ok();
            let size = metadata.as_ref().map(|m| format_file_size(m.len())).unwrap_or_else(|| "--".to_string());
            
            // Format the access time as the operation time
            let dt = chrono::DateTime::<chrono::Local>::from(
                std::time::UNIX_EPOCH + std::time::Duration::from_secs(access_ts)
            );
            let updated_at = dt.format("%Y-%m-%d %H:%M:%S").to_string();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if !is_whitelisted_ext(&ext) {
                continue;
            }
            let file_type = match ext.as_str() {
                "pdf" => "pdf", "doc" | "docx" | "txt" | "md" => "word",
                "xls" | "xlsx" | "csv" => "excel", "ppt" | "pptx" => "ppt",
                "jpg" | "jpeg" | "png" | "gif" | "heic" | "heif" | "webp" => "image",
                "mp4" | "mov" | "avi" => "video",
                "zip" | "rar" | "7z" | "tar" | "gz" | "dmg" | "exe" | "pkg" => "default",
                _ => "unknown",
            };
            
            let mut hasher = DefaultHasher::new();
            path_str.hash(&mut hasher);
            let id = format!("file_{}", hasher.finish());

            let (vn, tags_str, sg, ai) = db_metadata.remove(&path_str).unwrap_or((None, None, None, None));
            let tags = if let Some(s) = tags_str {
                if s.is_empty() { vec![] } else { s.split(',').map(|s| s.to_string()).collect() }
            } else { vec![] };

            results.push(FileItem {
                id,
                name: name.to_string(),
                file_type: file_type.to_string(),
                size,
                updated_at,
                path: path_str,
                ai_suggestion: ai,
                virtual_name: vn,
                tags,
                smart_group: sg,
                category: "recent".to_string(),
            });
        }
    }
    
    // Auto-insert them into the files table so they can be tagged/renamed immediately
    if let Ok(mut conn) = state.db.lock() {
        if let Ok(tx) = conn.transaction() {
            if let Ok(mut stmt) = tx.prepare("
                INSERT INTO files (id, name, file_type, size, updated_at, path, modified_timestamp) 
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                ON CONFLICT(path) DO NOTHING
            ") {
                for item in &results {
                    let _ = stmt.execute((&item.id, &item.name, &item.file_type, &item.size, &item.updated_at, &item.path, 0));
                }
            }
            let _ = tx.commit();
        }
    }
    
    Ok(results)
}

#[derive(Clone, Serialize)]
struct ScanProgress {
    scanned_count: usize,
    new_files: Vec<FileItem>,
}

#[tauri::command]
async fn scan_workspace_stream(dir_path: String, app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    use walkdir::WalkDir;
    use tauri::Emitter;
    
    // In Tauri v2, Emitter trait provides emit(). app.emit() works.
    
    let (tx, mut rx) = tokio::sync::mpsc::channel::<FileItem>(100);
    
    // Spawn a blocking thread to do WalkDir
    let dir_clone = dir_path.clone();
    tokio::task::spawn_blocking(move || {
        let walker = WalkDir::new(dir_clone).into_iter().filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            let is_hidden = name.starts_with('.');
            let is_ignored = name == "node_modules" || name == "target" || name == "dist" || name == ".git" || name == ".next";
            !is_hidden && !is_ignored
        });
        
        for entry in walker.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                let path_str = path.to_string_lossy();
                let name = entry.file_name().to_string_lossy().to_string();
                let metadata = entry.metadata().ok();
                let size = metadata.as_ref().map(|m| format_file_size(m.len())).unwrap_or_default();
                let timestamp = metadata.as_ref().and_then(|m| m.modified().ok())
                    .unwrap_or(std::time::SystemTime::now())
                    .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
                    
                let updated_at = metadata.as_ref().map(|m| {
                    if let Ok(modified) = m.modified() {
                        let dt: DateTime<Local> = modified.into();
                        dt.format("%Y-%m-%d %H:%M:%S").to_string()
                    } else {
                        String::new()
                    }
                }).unwrap_or_default();
                
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                
                if !is_whitelisted_ext(&ext) {
                    continue;
                }
                
                let file_type = match ext.as_str() {
                    "pdf" => "pdf", "doc" | "docx" | "txt" | "md" | "pages" | "numbers" | "key" => "word",
                    "xls" | "xlsx" => "excel", "ppt" | "pptx" => "ppt",
                    "jpg" | "jpeg" | "png" | "gif" | "svg" | "psd" | "ai" | "figma" => "image",
                    "mp4" | "mov" | "mp3" => "video",
                    _ => "unknown",
                };
                
                let item = FileItem {
                    id: uuid::Uuid::new_v4().to_string(),
                    name,
                    file_type: file_type.to_string(),
                    size,
                    updated_at,
                    path: path_str.to_string(),
                    ai_suggestion: None,
                    virtual_name: None,
                    tags: vec![],
                    smart_group: None,
                    category: "".to_string(),
                };
                
                let _ = tx.blocking_send(item);
            }
        }
    });

    let mut total_scanned = 0;
    let mut batch = Vec::new();
    
    // We fetch items from the channel
    while let Some(item) = rx.recv().await {
        batch.push(item);
        if batch.len() >= 50 {
            total_scanned += batch.len();
            // Bulk insert into SQLite
            if let Ok(mut conn) = state.db.lock() {
                if let Ok(tx) = conn.transaction() {
                    for f in &batch {
                        let _ = tx.execute(
                            "INSERT OR IGNORE INTO files (id, name, file_type, size, updated_at, path) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                            (&f.id, &f.name, &f.file_type, &f.size, &f.updated_at, &f.path),
                        );
                    }
                    let _ = tx.commit();
                }
            }
            
            // Emit to frontend
            let _ = app.emit("scan-progress", ScanProgress {
                scanned_count: total_scanned,
                new_files: batch.clone(),
            });
            batch.clear();
        }
    }
    
    // Insert remaining files
    if !batch.is_empty() {
        total_scanned += batch.len();
        if let Ok(mut conn) = state.db.lock() {
            if let Ok(tx) = conn.transaction() {
                for f in &batch {
                    let _ = tx.execute(
                        "INSERT OR IGNORE INTO files (id, name, file_type, size, updated_at, path) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        (&f.id, &f.name, &f.file_type, &f.size, &f.updated_at, &f.path),
                    );
                }
                let _ = tx.commit();
            }
        }
        let _ = app.emit("scan-progress", ScanProgress {
            scanned_count: total_scanned,
            new_files: batch.clone(),
        });
    }

    Ok(())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
async fn get_staging_files(state: State<'_, AppState>) -> Result<Vec<FileItem>, String> {
    let staging_dir = dirs::home_dir()
        .map(|p| p.join(".yuanbao_staging"))
        .unwrap_or_else(|| std::path::PathBuf::from("/"));
    
    if !staging_dir.exists() {
        return Ok(Vec::new());
    }
    
    let path_str = staging_dir.to_string_lossy().to_string();
    read_dir_shallow(path_str, state).await
}

#[tauri::command]
async fn move_files_to_staging(paths: Vec<String>, state: State<'_, AppState>) -> Result<(), String> {
    let staging_dir = dirs::home_dir()
        .map(|p| p.join(".yuanbao_staging"))
        .unwrap_or_else(|| std::path::PathBuf::from("/"));
        
    if !staging_dir.exists() {
        std::fs::create_dir_all(&staging_dir).map_err(|e| e.to_string())?;
    }
    
    for path in paths {
        let src_path = std::path::Path::new(&path);
        if !src_path.exists() {
            continue;
        }
        
        let file_name = src_path.file_name().unwrap_or_default();
        let dest_path = staging_dir.join(file_name);
        
        // Use fs::rename if on same mount, fallback to copy+remove if cross-mount
        if let Err(_) = std::fs::rename(src_path, &dest_path) {
            // Fallback to cross-device move
            if src_path.is_dir() {
                // Moving directories cross-device is complex, skip for now or use fs_extra
                continue; 
            } else {
                std::fs::copy(src_path, &dest_path).map_err(|e| e.to_string())?;
                std::fs::remove_file(src_path).map_err(|e| e.to_string())?;
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn generate_smart_group_name(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut file_infos = Vec::new();
    for path in &paths {
        if let Ok(snippet) = read_document_snippet(path.clone()) {
            file_infos.push(snippet);
        } else {
            let filename = std::path::Path::new(path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            file_infos.push(format!("文件名: {}", filename));
        }
    }
    
    let summary = file_infos.join("\n---\n");
    match ollama::generate_group_folder_name(&summary).await {
        Ok(suggestions) => Ok(suggestions),
        Err(_) => {
            let now = Local::now().format("%Y%m%d_%H%M").to_string();
            Ok(vec![format!("归档打包_{}", now), format!("聚合资料_{}", now)])
        }
    }
}

#[tauri::command]
async fn create_aggregate_folder(paths: Vec<String>, folder_name: String, target_dir: Option<String>) -> Result<String, String> {
    let base_dir = if let Some(d) = target_dir {
        if !d.trim().is_empty() {
            std::path::PathBuf::from(d)
        } else {
            dirs::desktop_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from(".")))
        }
    } else {
        dirs::desktop_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from(".")))
    };
    
    let new_folder_path = base_dir.join(&folder_name);
    if !new_folder_path.exists() {
        std::fs::create_dir_all(&new_folder_path).map_err(|e| e.to_string())?;
    }
    
    for path in paths {
        let src_path = std::path::Path::new(&path);
        if !src_path.exists() {
            continue;
        }
        let file_name = src_path.file_name().unwrap_or_default();
        let dest_path = new_folder_path.join(file_name);
        
        if let Err(_) = std::fs::rename(src_path, &dest_path) {
            if !src_path.is_dir() {
                if let Ok(_) = std::fs::copy(src_path, &dest_path) {
                    let _ = std::fs::remove_file(src_path);
                }
            }
        }
    }
    
    Ok(new_folder_path.to_string_lossy().to_string())
}


pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
        get_files,
        apply_virtual_rename,
        sync_virtual_name_to_disk,
        get_smart_folder_stats,
        get_files_by_cluster,
        update_file_tags,
        rename_with_ai,
        sync_all_embeddings,
        semantic_search,
        record_recent_file,
        read_dir_shallow,
        get_files_by_tag,
        get_mac_recent_files,
        scan_workspace_stream,
        get_home_dir,
        read_document_snippet,
        parse_excel_preview,
        read_image_base64,
        crop_image_native,
        export_files,
        get_staging_files,
        move_files_to_staging,
        get_file_icons_batch,
        open_file_with_app,
        generate_smart_group_name,
        create_aggregate_folder,
        reveal_in_finder,
        create_custom_ai_cluster
    ])
    .setup(|app| {
      // 确定应用数据目录
      let app_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
      fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

      // 初始化数据库
      let db_conn = db::init_db(&app_dir).map_err(|e| e.to_string())?;
      app.manage(AppState {
          db: Mutex::new(db_conn),
      });

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
async fn get_file_icons_batch(paths: Vec<String>) -> Result<std::collections::HashMap<String, String>, String> {
    #[cfg(target_os = "macos")]
    {
        use objc::{class, msg_send, sel, sel_impl};
        use cocoa::base::{id, nil};
        use cocoa::foundation::NSString;
        use std::slice;
        use base64::{Engine as _, engine::general_purpose};

        let mut result = std::collections::HashMap::new();
        unsafe {
            let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
            for path in paths {
                let path_str = NSString::alloc(nil).init_str(&path);
                let image: id = msg_send![workspace, iconForFile: path_str];
                if image != nil {
                    let cg_ref: id = msg_send![image, CGImageForProposedRect: std::ptr::null_mut::<std::ffi::c_void>() context: nil hints: nil];
                    if cg_ref != nil {
                        let bitmap_rep: id = msg_send![class!(NSBitmapImageRep), alloc];
                        let bitmap_rep: id = msg_send![bitmap_rep, initWithCGImage: cg_ref];
                        let props: id = msg_send![class!(NSDictionary), dictionary];
                        let png_data: id = msg_send![bitmap_rep, representationUsingType: 4 /* NSPNGFileType */ properties: props];
                        
                        if png_data != nil {
                            let bytes: *const u8 = msg_send![png_data, bytes];
                            let length: usize = msg_send![png_data, length];
                            let slice = slice::from_raw_parts(bytes, length);
                            let b64 = general_purpose::STANDARD.encode(slice);
                            result.insert(path, b64);
                        }
                    }
                }
            }
        }
        Ok(result)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(std::collections::HashMap::new())
    }
}

#[tauri::command]
async fn read_image_base64(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let path_obj = std::path::Path::new(&path);
        let ext = path_obj.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        
        #[cfg(target_os = "macos")]
        {
            use objc::{class, msg_send, sel, sel_impl};
            use cocoa::base::{id, nil};
            use cocoa::foundation::NSString;
            use base64::{Engine as _, engine::general_purpose};

            unsafe {
                let path_str = NSString::alloc(nil).init_str(&path);
                let ns_image: id = msg_send![class!(NSImage), alloc];
                let ns_image: id = msg_send![ns_image, initWithContentsOfFile: path_str];

                if ns_image != nil {
                    let cg_ref: id = msg_send![ns_image, CGImageForProposedRect: std::ptr::null_mut::<std::ffi::c_void>() context: nil hints: nil];
                    if cg_ref != nil {
                        let bitmap_rep: id = msg_send![class!(NSBitmapImageRep), alloc];
                        let bitmap_rep: id = msg_send![bitmap_rep, initWithCGImage: cg_ref];
                        let props: id = msg_send![class!(NSDictionary), dictionary];
                        let png_data: id = msg_send![bitmap_rep, representationUsingType: 4 /* NSPNGFileType */ properties: props];

                        if png_data != nil {
                            let length: usize = msg_send![png_data, length];
                            let bytes_ptr: *const u8 = msg_send![png_data, bytes];
                            let slice = std::slice::from_raw_parts(bytes_ptr, length);
                            let b64 = general_purpose::STANDARD.encode(slice);
                            return Ok(format!("data:image/png;base64,{}", b64));
                        }
                    }
                }
            }
        }

        // Fallback for non-macOS or standard file read
        let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read image file: {}", e))?;
        use base64::{Engine as _, engine::general_purpose};
        let b64 = general_purpose::STANDARD.encode(&bytes);
        let mime = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            _ => "image/png",
        };
        Ok(format!("data:{};base64,{}", mime, b64))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn crop_image_native(
    path: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    save_as_copy: bool,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let path_obj = std::path::Path::new(&path);
        let parent = path_obj.parent().unwrap_or_else(|| std::path::Path::new("."));
        let stem = path_obj.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
        let ext = path_obj.extension().and_then(|e| e.to_str()).unwrap_or("png");

        let out_path = if save_as_copy {
            parent.join(format!("{}_cropped.{}", stem, ext))
        } else {
            path_obj.to_path_buf()
        };

        #[cfg(target_os = "macos")]
        {
            use objc::{class, msg_send, sel, sel_impl};
            use cocoa::base::{id, nil};
            use cocoa::foundation::{NSString, NSRect, NSPoint, NSSize};

            unsafe {
                let path_str = NSString::alloc(nil).init_str(&path);
                let ns_image: id = msg_send![class!(NSImage), alloc];
                let ns_image: id = msg_send![ns_image, initWithContentsOfFile: path_str];

                if ns_image != nil {
                    let img_size: NSSize = msg_send![ns_image, size];
                    let src_y = img_size.height - y - height;
                    
                    let target_size = NSSize::new(width.max(1.0), height.max(1.0));
                    let cropped_image: id = msg_send![class!(NSImage), alloc];
                    let cropped_image: id = msg_send![cropped_image, initWithSize: target_size];
                    
                    let _: () = msg_send![cropped_image, lockFocus];
                    let dest_rect = NSRect::new(NSPoint::new(0.0, 0.0), target_size);
                    let src_rect = NSRect::new(NSPoint::new(x.max(0.0), src_y.max(0.0)), target_size);
                    
                    let _: () = msg_send![ns_image, drawInRect:dest_rect fromRect:src_rect operation:1u64 fraction:1.0f64];
                    let _: () = msg_send![cropped_image, unlockFocus];
                    
                    let tiff_data: id = msg_send![cropped_image, TIFFRepresentation];
                    let bitmap_rep: id = msg_send![class!(NSBitmapImageRep), imageRepWithData: tiff_data];
                    let props: id = msg_send![class!(NSDictionary), dictionary];
                    let png_data: id = msg_send![bitmap_rep, representationUsingType: 4u64 /* NSPNGFileType */ properties: props];

                    if png_data != nil {
                        let out_str = NSString::alloc(nil).init_str(out_path.to_str().unwrap_or_default());
                        let _: bool = msg_send![png_data, writeToFile: out_str atomically: true];
                        return Ok(out_path.to_string_lossy().to_string());
                    }
                }
            }
        }

        Err("Native crop unavailable".to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_file_with_app(path: String, app_name: Option<String>) -> Result<(), String> {
    use std::process::Command;
    
    let mut success = false;
    
    if let Some(app) = app_name {
        let status = Command::new("open")
            .arg("-a")
            .arg(&app)
            .arg(&path)
            .status();
            
        if let Ok(st) = status {
            if st.success() {
                success = true;
            }
        }
    }
    
    // Fallback to default open if app fails or wasn't provided
    if !success {
        let status = Command::new("open")
            .arg(&path)
            .status();
            
        if let Ok(st) = status {
            if !st.success() {
                return Err("Failed to open file with default application".to_string());
            }
        } else {
            return Err("Failed to execute open command".to_string());
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn export_files(paths: Vec<String>, dest_dir: String) -> Result<(), String> {
    use std::path::Path;
    let dest_path = Path::new(&dest_dir);
    if !dest_path.exists() {
        return Err("目标文件夹不存在".into());
    }

    for path_str in paths {
        let src = Path::new(&path_str);
        if src.is_file() {
            if let Some(filename) = src.file_name() {
                let mut target_path = dest_path.join(filename);
                
                // Handle name collision
                let mut counter = 1;
                while target_path.exists() {
                    let stem = src.file_stem().unwrap_or_default().to_string_lossy();
                    let ext = src.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
                    target_path = dest_path.join(format!("{}_{}{}", stem, counter, ext));
                    counter += 1;
                }

                if let Err(e) = std::fs::copy(src, &target_path) {
                    return Err(format!("无法复制文件 {}: {}", src.display(), e));
                }
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    use std::process::Command;
    let status = Command::new("open")
        .arg("-R")
        .arg(&path)
        .status();
    match status {
        Ok(st) if st.success() => Ok(()),
        Ok(_) => Err("无法在 Finder 中定位该文件".to_string()),
        Err(e) => Err(format!("命令执行失败: {}", e)),
    }
}

#[tauri::command]
async fn create_custom_ai_cluster(
    query: String,
    state: tauri::State<'_, AppState>
) -> Result<SmartCluster, String> {
    let query_clean = query.trim().to_lowercase();
    if query_clean.is_empty() {
        return Err("请输入有效关键词".to_string());
    }

    let mut count = 0;
    if let Ok(conn) = state.db.lock() {
        // 全多维度匹配：文件名、路径、AI 摘要描述、标签
        let sql = "SELECT COUNT(*) FROM files WHERE lower(name) LIKE ?1 OR lower(path) LIKE ?1 OR lower(ai_suggestion) LIKE ?1 OR lower(tags) LIKE ?1";
        let param = format!("%{}%", query_clean);
        if let Ok(c) = conn.query_row(sql, [param], |row| row.get::<_, u32>(0)) {
            count = c as usize;
        }

        // 如果单字/短词精确包含数较少，尝试分词后再算一次
        if count == 0 {
            let terms: Vec<&str> = query_clean.split_whitespace().collect();
            for term in terms {
                let p = format!("%{}%", term);
                if let Ok(c) = conn.query_row(sql, [p], |row| row.get::<_, u32>(0)) {
                    count += c as usize;
                }
            }
        }
    }

    let cluster_id = format!("cluster_custom_{}", query_clean);
    let display_name = if query_clean.contains("西财") || query_clean.contains("期末") || query_clean.contains("试卷") || query_clean.contains("复习") {
        String::from("期末复习资料")
    } else if query_clean.contains("元宝") || query_clean.contains("项目") || query_clean.contains("代码") {
        String::from("元宝文件管理器项目")
    } else {
        format!("{} 相关资料", query.trim())
    };

    Ok(SmartCluster {
        id: cluster_id,
        name: display_name,
        count,
        category_type: Some(String::from("custom")),
        path: None,
    })
}

