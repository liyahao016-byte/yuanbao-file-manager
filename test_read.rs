use std::fs;
fn main() {
    if let Ok(entries) = fs::read_dir("/") {
        for entry in entries {
            if let Ok(entry) = entry {
                println!("{:?}", entry.file_name());
            }
        }
    }
}
