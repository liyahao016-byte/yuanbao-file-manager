use std::ffi::{CStr, CString};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

extern "C" {
    fn macos_ocr_pdf_or_image(c_path: *const std::os::raw::c_char) -> *mut std::os::raw::c_char;
    fn macos_ocr_free_string(ptr: *mut std::os::raw::c_char);
}

pub fn perform_mac_ocr(path: &str) -> Option<String> {
    let c_str = CString::new(path).ok()?;
    unsafe {
        let ptr = macos_ocr_pdf_or_image(c_str.as_ptr());
        if ptr.is_null() {
            return None;
        }
        let rust_str = CStr::from_ptr(ptr).to_string_lossy().into_owned();
        macos_ocr_free_string(ptr);
        let trimmed = rust_str.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }
}

/// Reads up to `max_chars` from a file, attempting to parse PDF and DOCX,
/// falling back to Apple Vision OCR for scanned PDFs & Images.
pub fn read_text_snippet(path: &str, max_chars: usize) -> Result<String, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }

    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();

    let text = match ext.as_str() {
        "pdf" => {
            let extracted = read_pdf(p).unwrap_or_default();
            let clean = extracted.trim();
            // If extracted text is short (< 50 chars) or contains repetitive watermark signatures (like "By Y.A"), run Apple Vision OCR!
            if clean.chars().count() < 50 || clean.contains("By Y.A") || clean.contains("gongshundaren") {
                if let Some(ocr_text) = perform_mac_ocr(path) {
                    ocr_text
                } else {
                    extracted
                }
            } else {
                extracted
            }
        },
        "png" | "jpg" | "jpeg" | "webp" | "heic" => {
            if let Some(ocr_text) = perform_mac_ocr(path) {
                ocr_text
            } else {
                String::new()
            }
        },
        "docx" => read_docx(p)?,
        "html" | "htm" => read_html(p)?,
        _ => read_plain_text(p)?,
    };

    let char_count = text.chars().count();
    let snippet = if char_count <= max_chars {
        text
    } else {
        let head_len = max_chars / 2;
        let tail_len = max_chars - head_len;
        
        let head: String = text.chars().take(head_len).collect();
        let tail: String = text.chars().skip(char_count - tail_len).collect();
        
        format!("{}\n\n...[中间超长内容已折叠]...\n\n{}", head, tail)
    };
    
    Ok(snippet.trim().to_string())
}

fn read_pdf(path: &Path) -> Result<String, String> {
    let path_buf = path.to_path_buf();
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        pdf_extract::extract_text(&path_buf)
    }));

    let path_str = path.to_str().unwrap_or_default();
    match result {
        Ok(Ok(t)) => Ok(t),
        Ok(Err(e)) => {
            if let Some(ocr_text) = perform_mac_ocr(path_str) {
                Ok(ocr_text)
            } else {
                Err(format!("Failed to parse PDF: {:?}", e))
            }
        }
        Err(_) => {
            if let Some(ocr_text) = perform_mac_ocr(path_str) {
                Ok(ocr_text)
            } else {
                Err("PDF parsing panicked on unsupported encoding".to_string())
            }
        }
    }
}

fn read_docx(path: &Path) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open DOCX: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to parse DOCX ZIP: {}", e))?;

    let mut doc_xml = String::new();
    if let Ok(mut xml_file) = archive.by_name("word/document.xml") {
        xml_file.read_to_string(&mut doc_xml).map_err(|e| format!("Failed to read document.xml: {}", e))?;
    } else {
        return Err("word/document.xml not found in DOCX".to_string());
    }

    let mut extracted = String::with_capacity(doc_xml.len());
    let mut in_tag = false;
    for c in doc_xml.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            extracted.push(c);
        }
    }

    Ok(extracted)
}

fn read_html(path: &Path) -> Result<String, String> {
    let content = std::fs::read_to_string(path).map_err(|e| format!("Failed to read HTML file: {}", e))?;
    let mut extracted = String::with_capacity(content.len());
    let mut in_tag = false;
    for c in content.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            extracted.push(c);
        }
    }
    // Collapse multiple whitespaces
    let clean: Vec<_> = extracted.split_whitespace().collect();
    Ok(clean.join(" "))
}

fn read_plain_text(path: &Path) -> Result<String, String> {
    let content = std::fs::read_to_string(path).map_err(|e| format!("Failed to read text file: {}", e))?;
    Ok(content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_pdf_ocr() {
        let pdf_path = "/Users/superli/Library/Mobile Documents/com~apple~CloudDocs/Downloads/中微/14.pdf";
        if Path::new(pdf_path).exists() {
            let res = read_text_snippet(pdf_path, 1000).unwrap();
            println!("=== TEST OCR EXTRACTED TEXT ===");
            println!("{}", res);
            assert!(res.contains("西南财大") || res.contains("中微") || res.contains("考试"));
        }
    }
}
