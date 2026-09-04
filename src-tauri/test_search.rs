use rusqlite::Connection;

fn main() {
    let mut conn = Connection::open("/Users/superli/Library/Application Support/com.smart.filemanager/file_manager.db").unwrap();
    let query_clean = "简历";
    
    let mut fts_count = 0;
    // FTS
    let fts_sql = "
        SELECT f.id, fts.rank 
        FROM files_fts fts
        JOIN files f ON fts.rowid = f.rowid
        WHERE files_fts MATCH ?1
        ORDER BY rank
        LIMIT 500
    ";
    let fts_query = format!("\"{}\"", query_clean);
    if let Ok(mut stmt) = conn.prepare(fts_sql) {
        if let Ok(mut rows) = stmt.query([&fts_query]) {
            while let Ok(Some(row)) = rows.next() {
                fts_count += 1;
            }
        }
    }
    println!("FTS matched: {}", fts_count);
}
