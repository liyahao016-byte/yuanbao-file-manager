use rusqlite::Connection;
use std::fs;

fn main() {
    let mut conn = Connection::open("/Users/superli/Library/Application Support/com.smart.filemanager/file_manager.db").unwrap();
    
    let mut stmt = conn.prepare("SELECT id, path FROM files WHERE content_snippet IS NULL AND file_type = 'word'").unwrap();
    let mut updates = Vec::new();
    
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).unwrap();
    
    for row in rows.flatten() {
        let (id, path) = row;
        if path.ends_with(".md") || path.ends_with(".txt") || path.ends_with(".html") {
            if let Ok(text) = fs::read_to_string(&path) {
                let snippet: String = text.chars().take(1000).collect();
                updates.push((id, snippet));
            }
        }
    }
    
    for (id, snippet) in updates {
        conn.execute("UPDATE files SET content_snippet = ?1 WHERE id = ?2", (&snippet, &id)).unwrap();
    }
    println!("Backfilled");
}
