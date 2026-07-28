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
            modified_timestamp INTEGER
        )",
        [],
    )?;

    // Handle migrations for existing databases
    let _ = conn.execute("ALTER TABLE files ADD COLUMN virtual_name TEXT", []);
    let _ = conn.execute("ALTER TABLE files ADD COLUMN tags TEXT", []);
    let _ = conn.execute("ALTER TABLE files ADD COLUMN smart_group TEXT", []);
    let _ = conn.execute("ALTER TABLE files ADD COLUMN modified_timestamp INTEGER", []);

    // Create table for recent files tracking
    conn.execute(
        "CREATE TABLE IF NOT EXISTS recent_files (
            path TEXT PRIMARY KEY,
            last_operated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Initialize FTS5 index for full-text search (keyword search)
    // Only works if sqlite is compiled with FTS5, which `bundled` feature usually supports
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            name, path, content='files', content_rowid='rowid'
        )",
        [],
    )?;

    // Create triggers to keep FTS index updated when files change
    conn.execute_batch(
        "
        CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
            INSERT INTO files_fts(rowid, name, path) VALUES (new.rowid, new.name, new.path);
        END;
        CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, name, path) VALUES('delete', old.rowid, old.name, old.path);
        END;
        CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, name, path) VALUES('delete', old.rowid, old.name, old.path);
            INSERT INTO files_fts(rowid, name, path) VALUES (new.rowid, new.name, new.path);
        END;
        "
    )?;

    // Initialize sqlite-vec virtual table
    // bge-m3 produces 1024-dimensional embeddings
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS vec_files USING vec0(
            file_id TEXT PRIMARY KEY,
            embedding float[1024]
        )",
        [],
    )?;

    Ok(conn)
}
