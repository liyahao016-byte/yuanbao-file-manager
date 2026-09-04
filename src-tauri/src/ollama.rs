use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct GenerateRequest<'a> {
    model: &'a str,
    prompt: &'a str,
    stream: bool,
}

#[derive(Deserialize)]
struct GenerateResponse {
    response: String,
}

#[derive(Serialize)]
struct EmbeddingRequest<'a> {
    model: &'a str,
    prompt: &'a str,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    embedding: Vec<f32>, // Ollama API returns an array of floats
}

pub async fn generate_smart_name(content: &str) -> Result<String, String> {
    let client = Client::new();
    let prompt = format!(
        r#"你是一个专业的文件整理专家。请根据提供的【内容摘要】，深度分析提炼，为该文件生成一个简洁、专业的新文件名。
请严格遵循以下规则：
1. 提取最核心的要素（如：核心主题、公司/人名、项目名、日期），用连字符 "-" 或下划线 "_" 拼接。
2. 【极其重要】严禁直接照抄原文件名！你必须且只能从内容摘要中提炼信息，进行从零开始的名称重构。
3. 【极其重要】如果某个信息（如日期、来源、金额）找不到，请直接省略，绝对不允许输出“未知”、“unknown”或“null”等字眼。
4. 关于时间/日期：仅提取正文内容中代表**真实业务节点**的时间（如“2025Q1”、“2024年12月合同”）。如果没有明确的业务时间，缺省跳过！绝对不要去猜测或生造系统时间。
5. 绝对不要包含文件的扩展名（如.pdf, .docx），也不要在名字前加任何分类前缀（如"图片类-"、"其他类-"）。
6. 结果应当极简清晰，例如："华为云服务框架合同-2025" 或 "京东报销单"。
只输出最终的文件名，不要包含任何其他解释、标点或换行。

目标文件信息：
{}
"#,
        content
    );

    let req = GenerateRequest {
        model: "qwen2.5:32b",
        prompt: &prompt,
        stream: false,
    };

    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Ollama API Error: {}", e))?;

    let text = res.text().await.map_err(|e| format!("Failed to read text: {}", e))?;
    let body: GenerateResponse = match serde_json::from_str(&text) {
        Ok(b) => b,
        Err(e) => {
            return Err(format!("Parse Error: {}. Raw response: {}", e, text));
        }
    };
    
    // Fallback logic to clean up hallucinations from the AI
    let mut clean_name = body.response.trim().to_string();
    clean_name = clean_name.replace("未知", "");
    clean_name = clean_name.replace("unknown", "");
    clean_name = clean_name.replace("null", "");
    clean_name = clean_name.replace("其他类-", "");
    clean_name = clean_name.replace("图片类-", "");
    clean_name = clean_name.replace("文档类-", "");
    clean_name = clean_name.replace("简历类-", "");
    clean_name = clean_name.replace("合同类-", "");
    clean_name = clean_name.replace("发票类-", "");
    clean_name = clean_name.replace("{", "");
    clean_name = clean_name.replace("}", "");
    
    // Clean up trailing or consecutive hyphens and underscores
    clean_name = clean_name.replace("--", "-");
    clean_name = clean_name.replace("__", "_");
    clean_name = clean_name.replace("_-", "-");
    clean_name = clean_name.replace("-_", "-");
    clean_name = clean_name.trim_matches(|c| c == '-' || c == '_').to_string();
    
    if clean_name.is_empty() {
        clean_name = String::from("AI_重命名结果异常");
    }

    Ok(clean_name)
}

pub async fn generate_group_folder_name(files_summary: &str) -> Result<Vec<String>, String> {
    let client = Client::new();
    let prompt = format!(
        r#"你是一个专业的文件知识分类专家。请根据以下多份文件的名称和内容摘要，归纳总结出一个最符合整体主题的聚合文件夹名称。
请严格遵循以下规则：
1. 提取共同的核心主题（如项目名称、业务类别、主体机构、时间节点）。
2. 请输出 3 个候选名称，用中文逗号 "，" 分隔。第一个是最完整的主名称（如："2026-07_前端组件库重构与接口文档"），后两个是极简短名称（如："前端组件重构"，"接口与设计文档"）。
3. 绝对不要包含扩展名（如.pdf, .docx），也不要有解释说明、序号或标点符号。
只输出这 3 个名称（用逗号隔开），不要包含任何其他文字。

多文件列表信息：
{}
"#,
        files_summary
    );

    let req = GenerateRequest {
        model: "qwen2.5:32b",
        prompt: &prompt,
        stream: false,
    };

    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Ollama API Error: {}", e))?;

    let text = res.text().await.map_err(|e| format!("Failed to read text: {}", e))?;
    let body: GenerateResponse = match serde_json::from_str(&text) {
        Ok(b) => b,
        Err(e) => return Err(format!("Parse Error: {}. Raw response: {}", e, text)),
    };

    let clean_text = body.response.trim().replace("\n", "");
    let parts: Vec<String> = clean_text
        .split(|c| c == ',' || c == '，' || c == '、')
        .map(|s| s.trim().trim_matches(|c: char| c == '"' || c == '\'' || c == '`').to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if parts.is_empty() {
        Ok(vec![String::from("归档打包文件")])
    } else {
        Ok(parts)
    }
}

pub async fn generate_embedding(content: &str) -> Result<Vec<f32>, String> {
    use std::time::Duration;

    let client = Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .unwrap_or_else(|_| Client::new());

    let req = EmbeddingRequest {
        model: "bge-m3",
        prompt: content,
    };

    let res = client
        .post("http://localhost:11434/api/embeddings")
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Ollama API Error: {}", e))?;

    let body: EmbeddingResponse = res.json().await.map_err(|e| format!("Parse Error: {}", e))?;
    Ok(body.embedding)
}

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

static QUERY_EXPANSION_CACHE: OnceLock<Mutex<HashMap<String, Vec<String>>>> = OnceLock::new();

fn get_expansion_cache() -> &'static Mutex<HashMap<String, Vec<String>>> {
    QUERY_EXPANSION_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[allow(dead_code)]
pub async fn expand_query_terms(user_query: &str) -> Vec<String> {
    let clean_query = user_query.trim().to_lowercase();
    if clean_query.is_empty() {
        return Vec::new();
    }

    // 1. Check LRU Cache
    if let Ok(cache) = get_expansion_cache().lock() {
        if let Some(tokens) = cache.get(&clean_query) {
            return tokens.clone();
        }
    }

    // 2. AI Expansion via Qwen (with 1.2s timeout)
    let expanded = fetch_ai_expanded_tokens(&clean_query).await;

    // 3. Store in Cache
    if let Ok(mut cache) = get_expansion_cache().lock() {
        if cache.len() > 500 {
            cache.clear();
        }
        cache.insert(clean_query, expanded.clone());
    }

    expanded
}

async fn fetch_ai_expanded_tokens(clean_query: &str) -> Vec<String> {
    use std::time::Duration;

    let client = Client::builder()
        .timeout(Duration::from_millis(1200))
        .build()
        .unwrap_or_else(|_| Client::new());

    let prompt = format!(
        r#"你是一个搜索 Query 同义词与拼音扩展助手。请分析用户 Prompt "{}"。
请提取并扩展拼音首字母全称、同义词、近义词，严格按 JSON 格式输出：
{{"tokens": ["词1", "词2"]}}
重点规则：若输入为拼音首字母/英文缩写(如 lyh, zxl, ht, bg)，必须自动包含中文全称(如 ["lyh", "李雅浩"], ["ht", "合同"])。
只输出 JSON，不要包含 Markdown 标记或任何解释。
"#,
        clean_query
    );

    let req = GenerateRequest {
        model: "qwen2.5:32b",
        prompt: &prompt,
        stream: false,
    };

    let mut result_tokens = Vec::new();
    result_tokens.push(clean_query.to_string());

    if let Ok(res) = client.post("http://localhost:11434/api/generate").json(&req).send().await {
        if let Ok(text) = res.text().await {
            if let Ok(body) = serde_json::from_str::<GenerateResponse>(&text) {
                let resp_str = body.response.trim();
                let clean_json = resp_str
                    .replace("```json", "")
                    .replace("```", "")
                    .trim()
                    .to_string();
                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&clean_json) {
                    if let Some(arr) = json_val["tokens"].as_array() {
                        for v in arr {
                            if let Some(s) = v.as_str() {
                                let s_clean = s.trim().to_lowercase();
                                if !s_clean.is_empty() && s_clean != "null" && s_clean != "none" && !result_tokens.contains(&s_clean) {
                                    result_tokens.push(s_clean);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 规则防空与拼音兜底扩展
    fallback_expand_tokens(clean_query, &mut result_tokens);

    result_tokens
}

fn fallback_expand_tokens(clean_query: &str, tokens: &mut Vec<String>) {
    match clean_query {
        "lyh" => {
            if !tokens.contains(&"李雅浩".to_string()) { tokens.push("李雅浩".to_string()); }
        }
        "ht" => {
            if !tokens.contains(&"合同".to_string()) { tokens.push("合同".to_string()); }
            if !tokens.contains(&"协议".to_string()) { tokens.push("协议".to_string()); }
        }
        "bg" => {
            if !tokens.contains(&"报告".to_string()) { tokens.push("报告".to_string()); }
        }
        "fp" => {
            if !tokens.contains(&"发票".to_string()) { tokens.push("发票".to_string()); }
            if !tokens.contains(&"报销".to_string()) { tokens.push("报销".to_string()); }
        }
        "cw" => {
            if !tokens.contains(&"财务".to_string()) { tokens.push("财务".to_string()); }
        }
        "jl" => {
            if !tokens.contains(&"简历".to_string()) { tokens.push("简历".to_string()); }
        }
        _ => {}
    }

    // 中文 N-Gram 切词兜底 (如 "李雅浩" -> ["李雅浩", "李雅", "雅浩"])
    let chars: Vec<char> = clean_query.chars().collect();
    if chars.len() >= 3 && chars.iter().all(|c| c.is_alphabetic() && !c.is_ascii()) {
        let bigram1: String = chars[0..2].iter().collect();
        let bigram2: String = chars[1..3].iter().collect();
        if !tokens.contains(&bigram1) { tokens.push(bigram1); }
        if !tokens.contains(&bigram2) { tokens.push(bigram2); }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ParsedIntent {
    pub raw_query: String,
    pub date_target: Option<String>,
    pub file_types: Vec<String>,
    pub source_path_keyword: Option<String>,
    pub min_size_bytes: Option<u64>,
    pub topic_category: Option<String>,
    pub search_tokens: Vec<String>,
}

pub fn parse_nl_intent(user_prompt: &str) -> ParsedIntent {
    let lower = user_prompt.trim().to_lowercase();
    let mut intent = ParsedIntent {
        raw_query: user_prompt.trim().to_string(),
        ..Default::default()
    };

    if lower.is_empty() {
        return intent;
    }

    // 1. 日期提取 (8月22日, 2026-08-22, 08-22)
    intent.date_target = extract_date_from_prompt(&lower);

    // 2. 格式提取
    if lower.contains("word") || lower.contains("doc") || lower.contains("docx") || lower.contains("文档") {
        intent.file_types.extend(vec!["word".to_string(), "doc".to_string(), "docx".to_string(), "txt".to_string(), "md".to_string()]);
    }
    if lower.contains("excel") || lower.contains("xls") || lower.contains("xlsx") || lower.contains("表格") || lower.contains("csv") {
        intent.file_types.extend(vec!["excel".to_string(), "xls".to_string(), "xlsx".to_string(), "csv".to_string()]);
    }
    if lower.contains("pdf") {
        intent.file_types.push("pdf".to_string());
    }
    if lower.contains("ppt") || lower.contains("pptx") || lower.contains("演示") {
        intent.file_types.extend(vec!["ppt".to_string(), "pptx".to_string()]);
    }
    if lower.contains("图片") || lower.contains("照片") || lower.contains("png") || lower.contains("jpg") || lower.contains("jpeg") {
        intent.file_types.push("image".to_string());
    }
    if lower.contains("视频") || lower.contains("mp4") || lower.contains("mov") {
        intent.file_types.push("video".to_string());
    }

    // 3. 来源提取
    if lower.contains("微信") || lower.contains("wechat") || lower.contains("weixin") {
        intent.source_path_keyword = Some("wechat".to_string());
    } else if lower.contains("qq") {
        intent.source_path_keyword = Some("qq".to_string());
    } else if lower.contains("下载") || lower.contains("download") {
        intent.source_path_keyword = Some("download".to_string());
    } else if lower.contains("桌面") || lower.contains("desktop") {
        intent.source_path_keyword = Some("desktop".to_string());
    }

    // 4. 体积提取
    if lower.contains("大文件") {
        intent.min_size_bytes = Some(50 * 1024 * 1024);
    } else if lower.contains("10m") || lower.contains("10mb") {
        intent.min_size_bytes = Some(10 * 1024 * 1024);
    }

    // 5. 语义主题提取与同义词阵列构建 (方案 A+B)
    let mut tokens = vec![lower.clone()];
    if lower.contains("简历") || lower.contains("履历") || lower.contains("cv") || lower.contains("resume") {
        intent.topic_category = Some("简历".to_string());
        for t in &["简历", "履历", "cv", "resume", "求职信", "工作经历"] {
            if !tokens.contains(&t.to_string()) {
                tokens.push(t.to_string());
            }
        }
    } else if lower.contains("合同") || lower.contains("协议") {
        intent.topic_category = Some("合同".to_string());
        for t in &["合同", "协议", "契约", "签约"] {
            if !tokens.contains(&t.to_string()) {
                tokens.push(t.to_string());
            }
        }
    } else if lower.contains("发票") || lower.contains("报销") {
        intent.topic_category = Some("发票".to_string());
        for t in &["发票", "报销", "收据", "账单"] {
            if !tokens.contains(&t.to_string()) {
                tokens.push(t.to_string());
            }
        }
    } else if lower.contains("报告") || lower.contains("开题") {
        intent.topic_category = Some("报告".to_string());
        for t in &["报告", "开题", "总结", "汇报"] {
            if !tokens.contains(&t.to_string()) {
                tokens.push(t.to_string());
            }
        }
    } else if lower == "lyh" {
        tokens.push("李雅浩".to_string());
    }

    intent.search_tokens = tokens;
    intent
}

fn extract_date_from_prompt(text: &str) -> Option<String> {
    let current_year = chrono::Local::now().format("%Y").to_string();

    if let Some(idx) = text.find('月') {
        let start = text[..idx].chars().rev().take_while(|c| c.is_ascii_digit()).collect::<String>();
        let month_str: String = start.chars().rev().collect();
        let rest = &text[idx + '月'.len_utf8()..];
        let day_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !month_str.is_empty() && !day_str.is_empty() {
            if let (Ok(m), Ok(d)) = (month_str.parse::<u32>(), day_str.parse::<u32>()) {
                if m >= 1 && m <= 12 && d >= 1 && d <= 31 {
                    return Some(format!("{}-{:02}-{:02}", current_year, m, d));
                }
            }
        }
    }

    for word in text.split_whitespace() {
        if word.len() == 10 && word.as_bytes()[4] == b'-' && word.as_bytes()[7] == b'-' {
            return Some(word.to_string());
        }
    }

    None
}


