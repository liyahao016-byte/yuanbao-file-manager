use std::fs;
fn main() {
    let entries = std::fs::read_dir("/").unwrap();
    let mut names = vec![];
    for entry in entries.filter_map(Result::ok) {
        let path_buf = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') { continue; }
        names.push(file_name);
    }
    names.sort();
    println!("{:?}", names);
}
