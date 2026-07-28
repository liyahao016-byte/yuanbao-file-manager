use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

fn main() {
    let target_path = dirs::desktop_dir().unwrap();
    println!("Desktop: {:?}", target_path);
    if let Ok(entries) = std::fs::read_dir(&target_path) {
        for entry in entries.filter_map(Result::ok).take(5) {
            println!("- {}", entry.file_name().to_string_lossy());
        }
    }
}
