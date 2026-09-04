with open("src-tauri/src/lib.rs", "r") as f:
    content = f.read()

# Try injecting Fallback directly into FTS via regex
import re

# Match the end of FTS loop
pattern = r"(\s+current_rank \+= 1\.0;\s+}\s+}\s+}\s+}\s+})"
replacement = r"""\1

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

new_content = re.sub(pattern, replacement, content, count=1)
if new_content != content:
    print("Patched FTS fallback!")
else:
    print("Failed to patch FTS fallback")
    
# Let's check why Vec limit wasn't replaced
if "k = 50" in new_content:
    new_content = new_content.replace("k = 50", "k = 200")
    print("Patched vec limit")

# And FTS limit
if "LIMIT 50" in new_content:
    new_content = new_content.replace("LIMIT 50\n", "LIMIT 500\n")
    print("Patched FTS limit")

with open("src-tauri/src/lib.rs", "w") as f:
    f.write(new_content)
