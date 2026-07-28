use std::fs;
fn main() {
    if let Ok(entries) = fs::read_dir("/System") {
        for entry in entries {
            if let Ok(entry) = entry {
                if !entry.file_name().to_string_lossy().starts_with('.') {
                    println!("{:?}", entry.file_name());
                }
            }
        }
    }
}
