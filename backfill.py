import sqlite3
import os

db_path = "/Users/superli/Library/Application Support/com.smart.filemanager/file_manager.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("SELECT id, path FROM files WHERE content_snippet IS NULL AND file_type = 'word'")
rows = c.fetchall()

updates = []
for row in rows:
    fid, fpath = row
    if fpath.endswith(".md") or fpath.endswith(".txt") or fpath.endswith(".html"):
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read(1000)
                updates.append((content, fid))
        except Exception as e:
            pass

if updates:
    c.executemany("UPDATE files SET content_snippet = ? WHERE id = ?", updates)
    conn.commit()
    print(f"Backfilled {len(updates)} files.")
else:
    print("No files to backfill.")

conn.close()
