with open("src-tauri/src/lib.rs", "r") as f:
    content = f.read()

# 1. Fix FTS Limit
old_fts = """            WHERE files_fts MATCH ?1
            ORDER BY rank
            LIMIT 50"""
new_fts = """            WHERE files_fts MATCH ?1
            ORDER BY rank
            LIMIT 500"""
content = content.replace(old_fts, new_fts)

# 2. Fix Vec Limit
old_vec = """                WHERE v.embedding MATCH ?1 AND k = 50"""
new_vec = """                WHERE v.embedding MATCH ?1 AND k = 200"""
content = content.replace(old_vec, new_vec)

# 3. Fix Fallback limit & snippet
old_fallback_where = """WHERE (lower(name) LIKE ?1 OR lower(path) LIKE ?1 OR lower(COALESCE(ai_suggestion, '')) LIKE ?1 OR lower(COALESCE(tags, '')) LIKE ?1)"""
new_fallback_where = """WHERE (lower(name) LIKE ?1 OR lower(path) LIKE ?1 OR lower(COALESCE(ai_suggestion, '')) LIKE ?1 OR lower(COALESCE(tags, '')) LIKE ?1 OR lower(COALESCE(content_snippet, '')) LIKE ?1)"""
content = content.replace(old_fallback_where, new_fallback_where)

old_fallback_limit = """sql.push_str(" LIMIT 50");"""
new_fallback_limit = """sql.push_str(" LIMIT 500");"""
content = content.replace(old_fallback_limit, new_fallback_limit)

# 4. We will add the LIKE fallback DIRECTLY into Step 1 if fts_results is empty!
# Wait, let's insert it exactly after the FTS loop.
search_block = """        for token in search_tokens {
            let escaped = token.replace("\\\"", "\"\"");
            let fts_query = format!("\\\"{}\\\"", escaped);
            if let Ok(mut stmt) = conn.prepare(fts_sql) {
                if let Ok(mut rows) = stmt.query([&fts_query]) {
                    let mut current_rank = 1.0;
                    while let Ok(Some(row)) = rows.next() {
                        if let Ok(id) = row.get::<_, String>(0) {
                            let entry = fts_results.entry(id).or_insert(current_rank);
                            if *entry > current_rank {
                                *entry = current_rank;
                            }
                            current_rank += 1.0;
                        }
                    }
                }
            }
        }"""

new_fallback_logic = search_block + """
        
        // If FTS fails (e.g., query length < 3 for trigram), run LIKE directly to populate fts_results
        if fts_results.is_empty() && !query_clean.is_empty() {
            let param = format!("%{}%", query_clean);
            let mut sql = String::from("
                SELECT id
                FROM files
                WHERE (lower(name) LIKE ?1 OR lower(path) LIKE ?1 OR lower(COALESCE(ai_suggestion, '')) LIKE ?1 OR lower(COALESCE(tags, '')) LIKE ?1 OR lower(COALESCE(content_snippet, '')) LIKE ?1)
            ");
            if !intent.file_types.is_empty() {
                let types_in = intent.file_types.iter().map(|t| format!("'{}'", t)).collect::<Vec<_>>().join(",");
                sql.push_str(&format!(" AND (lower(file_type) IN ({}) OR lower(name) LIKE '%.docx' OR lower(name) LIKE '%.pdf' OR lower(name) LIKE '%.xlsx' OR lower(name) LIKE '%.pptx')", types_in));
            }
            sql.push_str(" LIMIT 500");
            
            if let Ok(mut stmt) = conn.prepare(&sql) {
                if let Ok(mut rows) = stmt.query([&param]) {
                    let mut current_rank = 1.0;
                    while let Ok(Some(row)) = rows.next() {
                        if let Ok(id) = row.get::<_, String>(0) {
                            fts_results.insert(id, current_rank);
                            current_rank += 1.0;
                        }
                    }
                }
            }
        }"""

if search_block in content:
    content = content.replace(search_block, new_fallback_logic)
    print("Injected fallback into FTS")
else:
    print("Could not find FTS loop block")

with open("src-tauri/src/lib.rs", "w") as f:
    f.write(content)
