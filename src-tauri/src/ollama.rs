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
        r#"你是一个专业的文件整理专家。请根据已知的文件名和内容摘要，为该文件生成一个简洁、专业的新文件名。
请严格遵循以下规则：
1. 提取最核心的要素（如：核心主题、公司/人名、项目名、日期），用连字符 "-" 或下划线 "_" 拼接。
2. 【极其重要】如果某个信息（如日期、来源、金额）找不到，请直接省略，绝对不允许输出“未知”、“unknown”或“null”等字眼。
3. 绝对不要包含文件的扩展名（如.pdf, .docx），也不要在名字前加任何分类前缀（如"图片类-"、"其他类-"）。
4. 结果应当极简清晰，例如："华为云服务框架合同-2025" 或 "京东报销单"。
5. 如果提供的信息不足以进行有意义的提取，请直接对原文件名进行标点符号清理后返回，不要生造词汇。
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
    let client = Client::new();
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
