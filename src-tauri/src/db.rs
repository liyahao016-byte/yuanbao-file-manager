use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn init_db(app_dir: &PathBuf) -> Result<Connection> {
    // Register the sqlite-vec extension before opening the connection
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }

    let db_path = app_dir.join("file_manager.db");
    let conn = Connection::open(&db_path)?;

    // Create table for files
    conn.execute(
        "CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            size TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            path TEXT UNIQUE NOT NULL,
            ai_suggestion TEXT,
            virtual_name TEXT,
            tags TEXT,
            smart_group TEXT,
            modified_timestamp INTEGER,
            content_snippet TEXT
        )",
        [],
    )?;

    // Handle migrations for existing databases
    let _ = conn.execute("ALTER TABLE files ADD COLUMN virtual_name TEXT", []);
    let _ = conn.execute("ALTER TABLE files ADD COLUMN tags TEXT", []);
    let _ = conn.execute("ALTER TABLE files ADD COLUMN smart_group TEXT", []);
    let _ = conn.execute("ALTER TABLE files ADD COLUMN modified_timestamp INTEGER", []);
    let _ = conn.execute("ALTER TABLE files ADD COLUMN content_snippet TEXT", []);

    // Create table for recent files tracking
    conn.execute(
        "CREATE TABLE IF NOT EXISTS recent_files (
            path TEXT PRIMARY KEY,
            last_operated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Initialize FTS5 index for full-text search (keyword search)
    // We recreate it to ensure ai_suggestion is included
    // Also drop old triggers first to avoid conflicts after table recreation
    let _ = conn.execute("DROP TRIGGER IF EXISTS files_ai", []);
    let _ = conn.execute("DROP TRIGGER IF EXISTS files_ad", []);
    let _ = conn.execute("DROP TRIGGER IF EXISTS files_au", []);
    let _ = conn.execute("DROP TABLE IF EXISTS files_fts", []);
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            name, path, ai_suggestion, content_snippet, tokenize='trigram'
        )",
        [],
    )?;

    // Create triggers to keep FTS index updated when files change
    // Using standalone trigram FTS table (not content-sync), so use regular DELETE/INSERT
    conn.execute_batch(
        "
        CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
            INSERT INTO files_fts(rowid, name, path, ai_suggestion, content_snippet) VALUES (new.rowid, new.name, new.path, new.ai_suggestion, new.content_snippet);
        END;
        CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
            DELETE FROM files_fts WHERE rowid = old.rowid;
        END;
        CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
            DELETE FROM files_fts WHERE rowid = old.rowid;
            INSERT INTO files_fts(rowid, name, path, ai_suggestion, content_snippet) VALUES (new.rowid, new.name, new.path, new.ai_suggestion, new.content_snippet);
        END;
        "
    )?;

    // Populate FTS if empty
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM files_fts", [], |row| row.get(0)).unwrap_or(0);
    if count == 0 {
        let _ = conn.execute("INSERT INTO files_fts(rowid, name, path, ai_suggestion) SELECT rowid, name, path, ai_suggestion FROM files", []);
    }

    // Initialize sqlite-vec virtual table
    // bge-m3 produces 1024-dimensional embeddings
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS vec_files USING vec0(
            file_id TEXT PRIMARY KEY,
            embedding float[1024]
        )",
        [],
    )?;

    // ── Archive tables (知识归档 - 派生索引，md 为唯一真源) ──

    // Main archives table: each row = one archive entry (### ✅ HH:MM title block in daily note)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS archives (
            id            TEXT PRIMARY KEY,
            date          TEXT NOT NULL,
            time          TEXT NOT NULL,
            title         TEXT NOT NULL,
            project       TEXT,
            priority      TEXT,
            duration_min  INTEGER,
            output        TEXT,
            blocker       TEXT,
            next_action   TEXT,
            tags          TEXT,
            md_path       TEXT NOT NULL,
            created_at    INTEGER NOT NULL
        )",
        [],
    )?;

    // Junction table: archive <-> linked files (many-to-many)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS archive_files (
            archive_id    TEXT NOT NULL,
            file_path     TEXT NOT NULL,
            PRIMARY KEY (archive_id, file_path)
        )",
        [],
    )?;

    // Indexes for common queries (date range, project filter, priority filter)
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_archives_date     ON archives(date)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_archives_project  ON archives(project)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_archives_priority ON archives(priority)", []);

    // Archive config table (vault path, Obsidian mode, daily note pattern)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS archive_config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // ── Asset Distiller tables (智能资产沉淀) ──

    conn.execute(
        "CREATE TABLE IF NOT EXISTS asset_tasks (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            workspace_path  TEXT NOT NULL UNIQUE,
            status          TEXT NOT NULL DEFAULT 'idle',
            policy_tags     TEXT,
            policy_filters  TEXT,
            policy_template TEXT,
            exclude_dirs    TEXT,
            exclude_patterns TEXT,
            include_types   TEXT,
            ai_description  TEXT,
            total_files     INTEGER DEFAULT 0,
            asset_count     INTEGER DEFAULT 0,
            noise_count     INTEGER DEFAULT 0,
            pending_count   INTEGER DEFAULT 0,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL,
            last_scan_at    INTEGER
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS asset_items (
            id              TEXT PRIMARY KEY,
            task_id         TEXT NOT NULL,
            file_path       TEXT NOT NULL,
            file_name       TEXT NOT NULL,
            file_type       TEXT NOT NULL,
            file_size       INTEGER NOT NULL,
            file_mtime      INTEGER NOT NULL,
            classification  TEXT NOT NULL DEFAULT 'PENDING',
            confidence      REAL DEFAULT 0.0,
            match_rule      TEXT,
            tags            TEXT,
            ai_summary      TEXT,
            content_hash    TEXT,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL,
            FOREIGN KEY (task_id) REFERENCES asset_tasks(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS asset_kb_history (
            id              TEXT PRIMARY KEY,
            task_id         TEXT NOT NULL,
            output_path     TEXT NOT NULL,
            asset_count     INTEGER NOT NULL,
            file_size       INTEGER,
            obsidian_mode   INTEGER DEFAULT 0,
            created_at      INTEGER NOT NULL,
            FOREIGN KEY (task_id) REFERENCES asset_tasks(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Asset items indexes
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_asset_items_task  ON asset_items(task_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_asset_items_class ON asset_items(classification)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_asset_items_type  ON asset_items(file_type)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_asset_items_path  ON asset_items(file_path)", []);

    // Virtual table for asset embeddings (bge-m3 1024d)
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS asset_embeddings USING vec0(
            item_id TEXT PRIMARY KEY,
            embedding float[1024]
        )",
        [],
    )?;

    // ── 产品需求看板 tables ──

    // 需求表: 一个需求 = 一个产品工作项
    conn.execute(
        "CREATE TABLE IF NOT EXISTS demands (
            id                  TEXT PRIMARY KEY,
            title               TEXT NOT NULL,
            description         TEXT,
            status              TEXT NOT NULL DEFAULT 'planning',
            phase               TEXT,
            priority            TEXT DEFAULT 'P1',
            owner               TEXT,
            version             TEXT,
            expected_merge_date TEXT,
            online_date         TEXT,
            notes               TEXT,
            tags                TEXT,
            doc_links           TEXT,
            sort_order          INTEGER DEFAULT 0,
            created_at          INTEGER NOT NULL,
            updated_at          INTEGER NOT NULL
        )",
        [],
    )?;

    // 兼容旧库：字段支持增加
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN version TEXT", []);
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN expected_merge_date TEXT", []);
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN online_date TEXT", []);
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN notes TEXT", []);
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN next_step TEXT", []);
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN blocker TEXT", []);
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN target_date TEXT", []);
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN owner TEXT", []);
    let _ = conn.execute("ALTER TABLE demands ADD COLUMN remind_at TEXT", []);

    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_demands_status   ON demands(status)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_demands_priority ON demands(priority)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_demands_todo     ON demands(status, online_date, target_date)", []);

    // FTS5 Trigram 模糊搜索索引（用于需求节点与待办速查）
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS demand_nodes_fts USING fts5(
            archive_id, demand_id, title, content, blocker, next_action, tokenize='trigram'
        )",
        [],
    )?;

    // 独立自定义待办表（不关联需求的自由 Todo）
    conn.execute(
        "CREATE TABLE IF NOT EXISTS custom_todos (
            id           TEXT PRIMARY KEY,
            title        TEXT NOT NULL,
            project_name TEXT,
            priority     TEXT DEFAULT 'P1',
            target_date  TEXT NOT NULL,
            owner        TEXT,
            remind_at    TEXT,
            is_completed INTEGER DEFAULT 0,
            created_at   INTEGER NOT NULL,
            updated_at   INTEGER NOT NULL
        )",
        [],
    )?;

    let _ = conn.execute("ALTER TABLE custom_todos ADD COLUMN owner TEXT", []);
    let _ = conn.execute("ALTER TABLE custom_todos ADD COLUMN remind_at TEXT", []);
    let _ = conn.execute("ALTER TABLE archives ADD COLUMN owner TEXT", []);
    let _ = conn.execute("ALTER TABLE archives ADD COLUMN remind_at TEXT", []);

    // 需求级文档链接表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS demand_doc_links (
            id          TEXT PRIMARY KEY,
            demand_id   TEXT NOT NULL,
            name        TEXT NOT NULL,
            url         TEXT NOT NULL,
            doc_type    TEXT DEFAULT 'link',
            created_at  INTEGER,
            FOREIGN KEY (demand_id) REFERENCES demands(id) ON DELETE CASCADE
        )",
        [],
    )?;

    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_demand_doc_links_did ON demand_doc_links(demand_id)", []);

    // archives 表扩展: 新增 demand_id / node_type / attachments / is_key_conclusion
    let _ = conn.execute("ALTER TABLE archives ADD COLUMN demand_id TEXT REFERENCES demands(id)", []);
    let _ = conn.execute("ALTER TABLE archives ADD COLUMN node_type TEXT DEFAULT 'progress'", []);
    let _ = conn.execute("ALTER TABLE archives ADD COLUMN attachments TEXT", []);
    let _ = conn.execute("ALTER TABLE archives ADD COLUMN is_key_conclusion INTEGER DEFAULT 0", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_archives_demand  ON archives(demand_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_archives_keycon  ON archives(is_key_conclusion) WHERE is_key_conclusion = 1", []);

    // 需求相关文档与聊天截图拆解分块表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS demand_doc_chunks (
            id          TEXT PRIMARY KEY,
            demand_id   TEXT NOT NULL,
            archive_id  TEXT NOT NULL,
            file_path   TEXT NOT NULL,
            file_name   TEXT NOT NULL,
            asset_type  TEXT NOT NULL DEFAULT 'document',
            chunk_text  TEXT NOT NULL,
            created_at  INTEGER NOT NULL
        )",
        [],
    )?;

    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_demand_chunks_did ON demand_doc_chunks(demand_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_demand_chunks_aid ON demand_doc_chunks(archive_id)", []);

    // FTS5 引擎表 (用于文档正文与聊天截图 OCR 全文与模糊搜)
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS demand_doc_chunks_fts USING fts5(
            chunk_id UNINDEXED, demand_id UNINDEXED, archive_id UNINDEXED, file_name UNINDEXED, asset_type UNINDEXED, chunk_text, tokenize='trigram'
        )",
        [],
    )?;

    Ok(conn)
}
