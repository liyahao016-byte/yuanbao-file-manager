use rusqlite::Connection;
fn main() {
    unsafe { rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(sqlite_vec::sqlite3_vec_init as *const ()))); }
    let conn = Connection::open("/Users/superli/Library/Application Support/com.smart.filemanager/file_manager.db").unwrap();
    let count: i64 = conn.query_row("SELECT count(*) FROM vec_files", [], |row| row.get(0)).unwrap_or(-1);
    println!("vec_files count: {}", count);
}
