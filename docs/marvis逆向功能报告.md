
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Marvis 逆向工程报告</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
  
  :root {
    --purple: #534AB7;
    --purple-light: #EEEDFE;
    --purple-bg: #F5F4FF;
    --teal: #1D9E75;
    --teal-light: #E1F5EE;
    --coral: #D85A30;
    --coral-light: #FAECE7;
    --pink: #D4537E;
    --pink-light: #FBEAF0;
    --blue: #378ADD;
    --blue-light: #E6F1FB;
    --green: #639922;
    --green-light: #EAF3DE;
    --amber: #BA7517;
    --amber-light: #FAEEDA;
    --gray: #888780;
    --gray-light: #F1EFE8;
    --text: #1a1a1a;
    --text-secondary: #5f5e5a;
    --border: #D3D1C7;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--text);
    line-height: 1.8;
    background: #fff;
    padding: 0;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 60px 40px;
  }

  /* Cover */
  .cover {
    text-align: center;
    padding: 80px 0 60px;
    border-bottom: 2px solid var(--purple-light);
    margin-bottom: 40px;
  }
  .cover h1 {
    font-size: 36px;
    font-weight: 700;
    color: var(--purple);
    margin-bottom: 12px;
  }
  .cover .subtitle {
    font-size: 18px;
    color: var(--text-secondary);
    font-weight: 300;
  }
  .cover .meta {
    margin-top: 24px;
    font-size: 13px;
    color: var(--gray);
  }
  .cover .meta span { margin: 0 12px; }
  .cover .badge {
    display: inline-block;
    background: var(--purple-light);
    color: var(--purple);
    padding: 4px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    margin-top: 20px;
  }

  /* Typography */
  h2 {
    font-size: 24px;
    font-weight: 700;
    color: var(--purple);
    margin: 48px 0 20px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--purple-light);
  }
  h3 {
    font-size: 18px;
    font-weight: 500;
    margin: 28px 0 12px;
    color: var(--text);
  }
  h4 {
    font-size: 15px;
    font-weight: 500;
    margin: 20px 0 8px;
    color: var(--text-secondary);
  }
  p { margin: 12px 0; color: var(--text); }
  .lead { font-size: 15px; color: var(--text-secondary); line-height: 1.9; }

  /* Tags */
  .tag {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    margin-right: 4px;
  }
  .tag-py { background: #E1F5EE; color: #0F6E56; }
  .tag-rust { background: #FAEEDA; color: #854F0B; }
  .tag-js { background: #E6F1FB; color: #185FA5; }
  .tag-go { background: #EEEDFE; color: #3C3489; }
  .tag-so { background: #FBEAF0; color: #993556; }

  /* Cards */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
    margin: 16px 0;
  }
  .card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
    background: #fafafa;
  }
  .card h4 { margin: 0 0 6px; font-size: 14px; }
  .card p { margin: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
  .card .tag { margin-top: 8px; }
  .card-purple { border-left: 3px solid var(--purple); }
  .card-teal { border-left: 3px solid var(--teal); }
  .card-coral { border-left: 3px solid var(--coral); }
  .card-blue { border-left: 3px solid var(--blue); }
  .card-green { border-left: 3px solid var(--green); }
  .card-pink { border-left: 3px solid var(--pink); }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 13px;
  }
  th, td {
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  th {
    background: var(--gray-light);
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  tr:hover { background: #fafafa; }

  /* Code */
  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 4px;
  }
  pre {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    background: #f8f8f8;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    line-height: 1.6;
    margin: 12px 0;
  }

  /* Key-value */
  .kv-list { margin: 12px 0; }
  .kv-item {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    font-size: 13px;
  }
  .kv-key {
    width: 200px;
    flex-shrink: 0;
    font-weight: 500;
    color: var(--text-secondary);
  }
  .kv-value { flex: 1; }

  /* Callouts */
  .callout {
    padding: 16px 20px;
    border-radius: 8px;
    margin: 16px 0;
    font-size: 13px;
    line-height: 1.7;
  }
  .callout-info { background: var(--blue-light); border-left: 3px solid var(--blue); }
  .callout-warn { background: var(--amber-light); border-left: 3px solid var(--amber); }
  .callout-success { background: var(--green-light); border-left: 3px solid var(--green); }

  /* Stats */
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
    margin: 20px 0;
  }
  .stat {
    text-align: center;
    padding: 20px 12px;
    border-radius: 10px;
    background: var(--gray-light);
  }
  .stat-num {
    font-size: 28px;
    font-weight: 700;
    color: var(--purple);
  }
  .stat-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  /* Lists */
  ul, ol { padding-left: 20px; margin: 8px 0; }
  li { margin: 4px 0; font-size: 13px; line-height: 1.7; }

  /* Footer */
  .footer {
    margin-top: 60px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    text-align: center;
    color: var(--gray);
    font-size: 12px;
  }

  /* Diagram placeholder */
  .diagram-box {
    background: var(--purple-bg);
    border: 1px solid var(--purple-light);
    border-radius: 12px;
    padding: 24px;
    margin: 16px 0;
  }
  .diagram-box h4 { color: var(--purple); margin-top: 0; }

  /* For print */
  @media print {
    .container { max-width: 100%; padding: 20px; }
    .cover { padding: 40px 0; }
    h2 { page-break-before: always; }
    h2:first-of-type { page-break-before: avoid; }
    pre { white-space: pre-wrap; word-break: break-word; }
  }
</style>
</head>
<body>
<div class="container">

<!-- ===================== COVER ===================== -->
<div class="cover">
  <div class="badge">逆向工程报告</div>
  <h1>Marvis 逆向工程报告</h1>
  <p class="subtitle">腾讯 AI 桌面助手 — 深度逆向分析</p>
  <p class="meta">
    <span>版本: 1.0.0.10300</span>
    <span>构建: 2026-07-21</span>
    <span>平台: macOS arm64</span>
  </p>
  <p class="meta" style="margin-top:8px">
    <span>Bundle: com.tencent.mac.marvis</span>
  </p>
  <p style="margin-top:20px; font-size:11px; color:#999;">2026 年 7 月 22 日 · 解密完成</p>
</div>

<!-- ===================== TOC ===================== -->
<h2>目录</h2>
<ol style="line-height:2.2; font-size:14px;">
  <li><a href="#overview">总体架构</a></li>
  <li><a href="#electron">Electron Shell</a></li>
  <li><a href="#agent">MarvisAgent — AI Agent 核心</a></li>
  <li><a href="#gateway">MarvisGateway — 通信网关</a></li>
  <li><a href="#knowledgebase">MarvisKnowledgebase — 知识库</a></li>
  <li><a href="#prompts">System Prompt 系统</a></li>
  <li><a href="#skills">Skill 系统</a></li>
  <li><a href="#mcp">MCP 服务器</a></li>
  <li><a href="#subagents">Sub Agent 调度系统</a></li>
  <li><a href="#agentloop">AgentLoop 执行引擎</a></li>
  <li><a href="#memory">记忆系统</a></li>
  <li><a href="#security">安全规则</a></li>
  <li><a href="#decryption">解密过程</a></li>
  <li><a href="#appendix">附录：文件清单</a></li>
</ol>

<!-- ===================== 1. OVERVIEW ===================== -->
<h2 id="overview">1. 总体架构</h2>
<p class="lead">Marvis 是一个多进程 AI 桌面应用，采用 Electron 壳 + 子进程架构。核心 AI 逻辑在独立的 MarvisAgent 进程中运行，使用 Python 3.11 编写并通过 PyInstaller 打包。</p>

<div class="stats">
  <div class="stat"><div class="stat-num">80</div><div class="stat-label">文件解密</div></div>
  <div class="stat"><div class="stat-num">54</div><div class="stat-label">System Prompt</div></div>
  <div class="stat"><div class="stat-num">27</div><div class="stat-label">Skill 定义</div></div>
  <div class="stat"><div class="stat-num">5</div><div class="stat-label">MCP 服务器</div></div>
  <div class="stat"><div class="stat-num">6</div><div class="stat-label">Sub Agents</div></div>
  <div class="stat"><div class="stat-num">3</div><div class="stat-label">核心子进程</div></div>
</div>

<h3>架构总览</h3>
<pre>
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Shell (Marvis.app)                   │
│              进程管理 · MCP IPC (Unix Socket) · 远程配置         │
├────────────────────┬──────────────────────┬──────────────────────┤
│   MarvisAgent      │   MarvisGateway      │  MarvisKnowledgebase │
│   (Python 3.11     │   (Rust 编译)        │  (Python 3.11       │
│    PyInstaller)    │   MarvisHost + WSS   │   PyInstaller)      │
├────────────────────┴──────────────────────┴──────────────────────┤
│                    LocalLLM · ��全规则 · 配置                     │
└─────────────────────────────────────────────────────────────────┘
</pre>

<table>
  <tr><th>组件</th><th>技术栈</th><th>版本</th><th>功能</th></tr>
  <tr>
    <td><strong>MarvisAgent</strong></td>
    <td><span class="tag tag-py">Python 3.11</span> <span class="tag tag-so">Mypyc 编译</span></td>
    <td>1.0.0.10199</td>
    <td>AI Agent 核心引擎、AgentLoop、Prompts、Skills、MCP</td>
  </tr>
  <tr>
    <td><strong>MarvisGateway</strong></td>
    <td><span class="tag tag-rust">Rust</span></td>
    <td>1.0.0.10079</td>
    <td>网关层、WebSocket 通信 (MarvisHost + libwss_plugin)</td>
  </tr>
  <tr>
    <td><strong>MarvisKnowledgebase</strong></td>
    <td><span class="tag tag-py">Python 3.11</span></td>
    <td>1.0.0.10075</td>
    <td>知识库、Tantivy 语义索引、文档解析</td>
  </tr>
  <tr>
    <td><strong>LocalLLMManager</strong></td>
    <td><span class="tag tag-so">Native .so</span></td>
    <td>-</td>
    <td>本地大模型管理</td>
  </tr>
</table>

<!-- ===================== 2. ELECTRON ===================== -->
<h2 id="electron">2. Electron Shell</h2>
<p>Marvis.app 是一个标准的 Electron 应用，作为轻量级"壳"负责管理所有子进程的生命周期。</p>

<table>
  <tr><th>属性</th><th>值</th></tr>
  <tr><td>Bundle ID</td><td><code>com.tencent.mac.marvis</code></td></tr>
  <tr><td>主入口</td><td><code>out/main/index.cjs</code></td></tr>
  <tr><td>核心代码</td><td><code>out/main/index.cjsc</code> (V8 bytecode)</td></tr>
  <tr><td>渲染层</td><td><code>out/renderer/index.html</code> (网关监控)</td></tr>
  <tr><td>远程配置</td><td><code>marvis-client.yyb.qq.com</code></td></tr>
  <tr><td>MCP IPC</td><td><code>/tmp/marvis-mcp-{id}.sock</code> (Unix Socket)</td></tr>
  <tr><td>数据目录</td><td><code>~/Library/Application Support/com.tencent.mac.marvis/</code></td></tr>
</table>

<h3>子进程管理</h3>
<p>Electron 主进程通过 spawn 启动/停止/重启以下子进程，使用 MCP IPC 通信：</p>
<ul>
  <li><strong>MarvisAgent</strong> — AI Agent 子进程</li>
  <li><strong>MarvisGateway</strong> — 网关子进程 (MarvisHost)</li>
  <li><strong>MarvisKnowledgebase</strong> — 知识库子进程</li>
  <li><strong>MarvisMCP</strong> — MCP 服务器子进程</li>
  <li><strong>MarvisService</strong> — 服务进程</li>
</ul>

<!-- ===================== 3. MARVIS AGENT ===================== -->
<h2 id="agent">3. MarvisAgent — AI Agent 核心</h2>
<p class="lead">MarvisAgent 是整个系统的大脑，使用 Python 3.11 编写，通过 PyInstaller 打包为独立可执行文件。核心逻辑编译在 <code>marvis_agent.so</code> (Mypyc 编译) 中。</p>

<h3>安装路径</h3>
<pre>~/Library/Application Support/com.tencent.mac.marvis/components/MarvisAgent/Versions/1.0.0.10199/
├── MarvisAgent              # 主可执行文件 (29MB, PyInstaller 启动器)
├── _internal/               # Python 运行时 + 第三方依赖
│   ├── marvis_agent.so      # 核心逻辑 (27MB, Mypyc 编译到 arm64)
│   ├── base_library.zip     # Python 标准库的 pyc
│   ├── cryptography/        # 裁剪后的密码学库 (仅 hazmat)
│   └── Crypto/              # pycryptodome (AES/Hash 等)
├── prompts/                 # 54 个加密的 System Prompt
├── skills/                  # 27 个 Skill 定义 (SKILL.md 加密)
├── mcp_server/              # 5 个 MCP 服务器
├── resource/                # 资源文件
│   ├── security_rules/      # 安全规则 (YAML, 明文)
│   ├── tiktoken/            # Tokenizer
│   ├── ripgrep/             # 全文搜索
│   └── marvis_browser/      # 浏览器资源
├── runtime/                 # 嵌入的 Python 3.11
└── logs/                    # 运行时日志
</pre>

<h3>核心类 (from marvis_agent.so)</h3>
<table>
  <tr><th>类名</th><th>功能</th></tr>
  <tr><td><code>AgentLoop</code></td><td>ReAct 主循环引擎</td></tr>
  <tr><td><code>AgentContext</code></td><td>Agent 上下文</td></tr>
  <tr><td><code>AppContext</code></td><td>应用级配置</td></tr>
  <tr><td><code>AgentProfile</code></td><td>代理人设</td></tr>
  <tr><td><code>SubagentDefinition</code></td><td>Sub Agent 定义</td></tr>
  <tr><td><code>AgentCheckpoint</code></td><td>执行检查点</td></tr>
  <tr><td><code>AgentRunResult</code></td><td>运行结果</td></tr>
</table>

<!-- ===================== 4. GATEWAY ===================== -->
<h2 id="gateway">4. MarvisGateway — 通信网关</h2>
<p>使用 Rust 编写的网关层，负责 WebSocket 通信和文件上传。</p>

<table>
  <tr><th>文件</th><th>说明</th></tr>
  <tr><td><code>MarvisHost</code></td><td>主二进制 (Rust 编译, arm64)</td></tr>
  <tr><td><code>libwss_plugin.dylib</code></td><td>WebSocket 安全连接插件</td></tr>
  <tr><td><code>libcos_uploader.dylib</code></td><td>腾讯云 COS 文件上传</td></tr>
  <tr><td><code>liblocation_provider.dylib</code></td><td>位置服务</td></tr>
</table>

<!-- ===================== 5. KNOWLEDGEBASE ===================== -->
<h2 id="knowledgebase">5. MarvisKnowledgebase — 知识库</h2>
<p>知识库使用 Python 编写，基于 Tantivy (Rust 全文搜索引擎) 构建语义索引。</p>

<table>
  <tr><th>能力</th><th>技术</th></tr>
  <tr><td>全文搜索</td><td>Tantivy (LZ4 压缩, 16KB 块)</td></tr>
  <tr><td>文档解析</td><td>pdfminer, python-docx, openpyxl, lxml, markdown</td></tr>
  <tr><td>语义索引</td><td>向量嵌入 (512 维) via sqlite-vec</td></tr>
  <tr><td>网页抓取</td><td>crawl4ai + playwright</td></tr>
</table>

<!-- ===================== 6. PROMPTS ===================== -->
<h2 id="prompts">6. System Prompt 系统</h2>
<p class="lead">54 个 System Prompt 文件，全部使用 Fernet 对称加密存储在 <code>prompts/</code> 目录中。已成功解密并重命名为可读名称。</p>

<h3>加密详情</h3>
<table>
  <tr><th>属性</th><th>值</th></tr>
  <tr><td>加密算法</td><td>Fernet (AES-128-CBC + HMAC-SHA256)</td></tr>
  <tr><td>密钥派生</td><td>PBKDF2 + ENCRYPT_SALT + _NUMBER_LIST</td></tr>
  <tr><td>提取密钥</td><td><code>5wZoDzUI_viUnF06WNmpYtoKtiRZWHljX47BmzU7B6s=</code></td></tr>
  <tr><td>解密总数</td><td>54 个 prompts + 26 个 SKILL.md = 80 个文件</td></tr>
  <tr><td>成功率</td><td>100%</td></tr>
</table>

<h3>Prompt 分类</h3>
<table>
  <tr><th>分类</th><th>数量</th><th>说明</th></tr>
  <tr><td>01-MainAgent</td><td>4</td><td>Main Agent 专属规则、dispatch_task 规范</td></tr>
  <tr><td>02-SystemAgent</td><td>5</td><td>Win/Mac/Linux Use Agent 系统操作规则</td></tr>
  <tr><td>03-Workflow</td><td>2</td><td>工作流程定义 (基础操作/复杂任务)</td></tr>
  <tr><td>04-SubAgent</td><td>3</td><td>Sub Agent 调度补充 [Win/macOS/Linux]</td></tr>
  <tr><td>05-Knowledge</td><td>2</td><td>知识库相关配置</td></tr>
  <tr><td>06-Security</td><td>6</td><td>安全规则 (身份定义、隐私模式等)</td></tr>
  <tr><td>07-Tools</td><td>22</td><td>工具调用规则 (File/Browser Agent 等)</td></tr>
  <tr><td>08-Other</td><td>10</td><td>其他配置覆盖</td></tr>
</table>

<h3>最重要的 Prompt 文件</h3>
<table>
  <tr><th>大小</th><th>文件名</th><th>内容</th></tr>
  <tr><td>43KB</td><td>WinMac Use Agent 专属规则</td><td>系统操作工具分层、action 链路、红线规则</td></tr>
  <tr><td>23KB</td><td>工作流程</td><td>基础操作/复杂任务/应用推荐 三大工作流</td></tr>
  <tr><td>22KB</td><td>Main Agent 专属规则</td><td>dispatch_task、Sub Agent 调度、task 结构化</td></tr>
  <tr><td>20KB</td><td>File Agent 专属规则</td><td>文件读取/分析/总结/翻译规则</td></tr>
  <tr><td>19KB</td><td>Browser Agent 专属规则</td><td>浏览器交互操作、高风险平台告知</td></tr>
  <tr><td>15KB</td><td>核心规则</td><td>安全 fence、隐私模式、红线</td></tr>
</table>

<!-- ===================== 7. SKILLS ===================== -->
<h2 id="skills">7. Skill 系统</h2>
<p class="lead">27 个 Skill 定义，每个包含 <code>SKILL.md</code> (Fernet 加密)、<code>_meta.json</code> (明文元数据) 和 <code>scripts/</code> (脚本)。</p>

<div class="card-grid">
  <div class="card card-teal"><h4>File Organizer Lite</h4><p>44KB · 文件整理引擎：扫描→提案→确认→搬运→撤销</p></div>
  <div class="card card-coral"><h4>瑞幸点单 Skill</h4><p>35KB · ���幸咖啡点单完整流程</p></div>
  <div class="card card-blue"><h4>Document Writer</h4><p>35KB · 文档生成专家</p></div>
  <div class="card card-pink"><h4>小程序购物</h4><p>29KB · 微信小程序购物操作规范</p></div>
  <div class="card card-green"><h4>发票检索与解析</h4><p>24KB · 发票提取与识别</p></div>
  <div class="card card-purple"><h4>PPTX 技能</h4><p>24KB · 演示文稿处理</p></div>
  <div class="card card-teal"><h4>Photo to Video</h4><p>24KB · 图片转电子相册视频</p></div>
  <div class="card card-coral"><h4>agent-browser</h4><p>21KB · 浏览器自动化核心指南</p></div>
  <div class="card card-blue"><h4>Excel 处理分析</h4><p>20KB · Excel 协作指引</p></div>
</div>

<h3>完整 Skill 列表</h3>
<table>
  <tr><th>Skill</th><th>大小</th><th>描述</th></tr>
  <tr><td>file-organizer</td><td>44KB</td><td>文件整理引擎</td></tr>
  <tr><td>luckin-coffee-ordering</td><td>35KB</td><td>瑞幸点单</td></tr>
  <tr><td>document-writer</td><td>35KB</td><td>文档生成</td></tr>
  <tr><td>mini-program-shopping</td><td>29KB</td><td>小程序购物</td></tr>
  <tr><td>invoice-retrieval</td><td>24KB</td><td>发票检索</td></tr>
  <tr><td>pptx</td><td>24KB</td><td>PPT 处理</td></tr>
  <tr><td>photo-to-video</td><td>24KB</td><td>图片转视频</td></tr>
  <tr><td>agent-browser</td><td>21KB</td><td>浏览器自动化</td></tr>
  <tr><td>excel-processing-and-analysis</td><td>20KB</td><td>Excel 处理</td></tr>
  <tr><td>image-search</td><td>18KB</td><td>图像语义搜索</td></tr>
  <tr><td>smart-phone-ops</td><td>17KB</td><td>手机操作</td></tr>
  <tr><td>smart-mini-game-ops</td><td>17KB</td><td>小游戏操作</td></tr>
  <tr><td>smart-desktop-ops</td><td>14KB</td><td>桌面操作</td></tr>
  <tr><td>file-search</td><td>14KB</td><td>文件搜索</td></tr>
  <tr><td>planning-with-files</td><td>10KB</td><td>持久化上下文工程</td></tr>
  <tr><td>persona-update-flow</td><td>11KB</td><td>人设修改交互</td></tr>
  <tr><td>report-writer</td><td>11KB</td><td>报告生成</td></tr>
  <tr><td>docx</td><td>11KB</td><td>Word 文档处理</td></tr>
  <tr><td>doc-format-skill</td><td>11KB</td><td>文档格式规范</td></tr>
  <tr><td>apk-recmd</td><td>10KB</td><td>APK 搜索推荐</td></tr>
  <tr><td>mac-desktop-ops</td><td>8KB</td><td>Mac 应用操作</td></tr>
  <tr><td>legacy-doc-parser</td><td>6KB</td><td>旧版文档解析器</td></tr>
  <tr><td>image-processing</td><td>5KB</td><td>图片处理</td></tr>
  <tr><td>web-qqmail-invoice</td><td>5KB</td><td>QQ 邮箱发票下载</td></tr>
  <tr><td>yyb-engine-install</td><td>2KB</td><td>应用宝引擎安装</td></tr>
  <tr><td>pdf</td><td>12KB</td><td>PDF 处理指南</td></tr>
</table>

<!-- ===================== 8. MCP ===================== -->
<h2 id="mcp">8. MCP ��务器</h2>
<p class="lead">MarvisAgent 集成了 5 个 MCP (Model Context Protocol) 服务器，提供系统操作、电商、浏览器等能力。</p>

<table>
  <tr><th>MCP 服务器</th><th>类型</th><th>功能</th></tr>
  <tr><td><strong>MarvisMCP</strong></td><td><span class="tag tag-go">Go arm64</span></td><td>主 MCP 服务器，文件传输 (send_file)</td></tr>
  <tr><td><strong>MacDesktopMCP</strong></td><td><span class="tag tag-go">Go fat binary</span></td><td>Mac 桌面控制 (x86_64+arm64)</td></tr>
  <tr><td><strong>MacUseMCP</strong></td><td><span class="tag tag-py">Python 3.11</span></td><td>Mac 使用控制 (含 dooti 库)</td></tr>
  <tr><td><strong>MacFlowMCP</strong></td><td><span class="tag tag-go">Go arm64</span></td><td>Mac 自动化流程</td></tr>
  <tr><td><strong>CommerceMCP</strong></td><td><span class="tag tag-go">Go arm64</span></td><td>电商能力</td></tr>
</table>

<!-- ===================== 9. SUB AGENTS ===================== -->
<h2 id="subagents">9. Sub Agent 调度系统</h2>
<p class="lead">Main Agent 通过 <code>dispatch_task</code> 工具将任务派发给专业的 Sub Agent 执行。优先级：Sub Agents → Skills → Tools → 生成代码执行。</p>

<h3>Agent 类型</h3>
<table>
  <tr><th>Agent</th><th>职责</th><th>来源 Prompt</th></tr>
  <tr><td><strong>browser-agent</strong></td><td>浏览器交互：打开网页、点击、表单、登录、截图、多页面</td><td>Browser Agent 专属规则</td></tr>
  <tr><td><strong>app-agent</strong></td><td>移动端/Android 模拟器应用操作</td><td>调度补充文件</td></tr>
  <tr><td><strong>computer-agent</strong></td><td>系统级操作：Windows Update、系统设置、进程管理</td><td>Windows 调度补充</td></tr>
  <tr><td><strong>search-agent</strong></td><td>高质量 RAG 检索，单次最多 1-2 次调用</td><td>Search Agent 专属规则</td></tr>
  <tr><td><strong>file-agent</strong></td><td>文件内容处理：读取/分析/总结/翻译</td><td>File Agent 专属规则</td></tr>
  <tr><td><strong>Win/Mac Use Agent</strong></td><td>系统操作执行引擎 (action_search → action_execute → Shell)</td><td>WinMac Use Agent 规则</td></tr>
</table>

<h3>dispatch_task 规范</h3>
<pre>&lt;overall_goal&gt;
用户的原始完整需求
&lt;/overall_goal&gt;
&lt;current_task&gt;
本次委托的具体任务（自包含、可独立执行）
&lt;/current_task&gt;</pre>

<h3>执行验收原则</h3>
<ol>
  <li><strong>验目标</strong> — 按任务目标核对执行结果</li>
  <li><strong>验产物</strong> — 要求生成文件时必须看到真实路径</li>
  <li><strong>补缺口</strong> — 任务未完成时优先换 Sub Agent，再降级 Skill/Tool</li>
  <li><strong>inherit_agent_id</strong> — 同名 Sub Agent 可继承之前的对话历史</li>
</ol>

<!-- ===================== 10. AGENT LOOP ===================== -->
<h2 id="agentloop">10. AgentLoop 执行引擎</h2>
<p class="lead">AgentLoop 是 Marvis 的 ReAct (推理+行动) 执行引擎，完全编译在 <code>marvis_agent.so</code> 中 (Mypyc → C → arm64)。</p>

<h3>ReAct 循环</h3>
<pre>
run()
  ├─ _build_system_prompt()     ← 加载 system prompt
  ├─ append_input_messages()    ← 追加用户输入
  └─ _execute_loop()            ← 进入 ReAct 循环
       │
       ├─ 1. _think()           ← LLM 推理 + 流式输出
       │     ├─ INTERNAL_LLM_START
       │     ├─ STREAM_REASONING_START/DELTA/END  (思考过程)
       │     ├─ STREAM_TEXT_START/DELTA/END        (文本输出)
       │     └─ STREAM_TOOL_CALL_START/ARGS/END    (工具调用)
       │
       ├─ 2. commit_think_result()  ← 提交 AI 消息
       ├─ 3. _validate_tool_calls() ← 审计边界检查
       ├─ 4. _act()                 ← 并行执行工具
       └─ 5. commit_act_result()    ← 提交工具结果
            │
            └─ 循环: 有 tool_call → 回到 _think()
                无 tool_call → AgentRunResult → memory_write
</pre>

<h3>关键函数</h3>
<table>
  <tr><th>函数</th><th>功能</th></tr>
  <tr><td><code>_think()</code></td><td>调用 LLM 进行推理，生成回复和工具调用</td></tr>
  <tr><td><code>commit_think_result()</code></td><td>提交 AI 消息，完成流式输出</td></tr>
  <tr><td><code>_validate_tool_calls()</code></td><td>审计工具调用边界，处理异常</td></tr>
  <tr><td><code>_act()</code></td><td>并行执行所有工具调用</td></tr>
  <tr><td><code>commit_act_result()</code></td><td>提交工具执行结果</td></tr>
  <tr><td><code>_execute_loop()</code></td><td>主循环，协调 think-act 迭代</td></tr>
  <tr><td><code>_handle_return_direct()</code></td><td>处理直接返回结果</td></tr>
</table>

<h3>流式事件 (EventBus)</h3>
<pre>INTERNAL_LLM_START / RESPONSE / ERROR   ← LLM 监控
STREAM_REASONING_START / DELTA / END     ← 思考过程
STREAM_TEXT_START / DELTA / END          ← 文本输出
STREAM_TOOL_CALL_START / ARGS / END      ← 工具调用参数
STREAM_TOOL_RESULT                        ← 工具结果
STREAM_AI_MESSAGE_COMPLETE               ← AI 消息完成
STREAM_PRODUCT_RESULT                     ← 产物结果</pre>

<!-- ===================== 11. MEMORY ===================== -->
<h2 id="memory">11. 记忆系统</h2>
<p class="lead">Marvis 采用三层记忆架构，支持向量化存储和经验归纳。</p>

<table>
  <tr><th>记忆类型</th><th>存储</th><th>字段</th></tr>
  <tr>
    <td><strong>情景记忆</strong> (Episodic)</td>
    <td>memory_vector.db + Tantivy</td>
    <td>id, content, timestamp, location, participants, count</td>
  </tr>
  <tr>
    <td><strong>语义记忆</strong> (Semantic)</td>
    <td>memory_vector.db + Tantivy</td>
    <td>id, content, source, authority, status</td>
  </tr>
  <tr>
    <td><strong>经验记忆</strong> (Experience)</td>
    <td>memory_vector.db + Tantivy</td>
    <td>id, content, raw_content, memory_type, agent_name, count</td>
  </tr>
  <tr>
    <td><strong>对话轨迹</strong></td>
    <td>memory.db (SQLite)</td>
    <td>conversation_detail (72 条记录)</td>
  </tr>
  <tr>
    <td><strong>向量嵌入</strong></td>
    <td>memory_vector.db (sqlite-vec)</td>
    <td>512 维 float 向量</td>
  </tr>
</table>

<h3>记忆整合流程</h3>
<pre>对话完成 → 提取轨迹 (conversation_detail) → 归纳经验 (LLM 总结) → 存入向量库</pre>

<h3>实际存储的经验记忆 (示例)</h3>
<div class="callout callout-info">
  <strong>execution_experience:</strong> Agent 在 Mac 上使用 search_file 搜索文件时，若知识库未授权，带 query 参数的语义检索会直接失败。绕行方案是改用 sql 参数按文件名模式匹配。<br><br>
  <strong>workflow_experience:</strong> Agent 在搜索毕业论文文件时，先用 query + keywords 语义检索 + 论文特征词，遇到知识库未授权后回退到 sql 文件名模式匹配，结果按正文/相关文件分类输出。
</div>

<!-- ===================== 12. SECURITY ===================== -->
<h2 id="security">12. 安全规则</h2>
<p class="lead">安全规则以明文 YAML 格式存储，覆盖 Bash、PowerShell 和 Python 三种脚本语言。</p>

<table>
  <tr><th>文件</th><th>大小</th><th>规则数</th></tr>
  <tr><td><code>bash_dangerous.yaml</code></td><td>10KB</td><td>37 条</td></tr>
  <tr><td><code>pwsh_dangerous.yaml</code></td><td>7KB</td><td>—</td></tr>
  <tr><td><code>python_dangerous.yaml</code></td><td>7KB</td><td>32 条</td></tr>
</table>

<h3>检测类别</h3>
<table>
  <tr><th>类别</th><th>说明</th><th>Python 示例</th></tr>
  <tr><td><strong>RCE</strong></td><td>代码下载执行</td><td><code>requests.get(...).text → exec()</code></td></tr>
  <tr><td><strong>NET</strong></td><td>网络出网</td><td><code>socket.connect(), urllib.request.urlopen</code></td></tr>
  <tr><td><strong>DEL</strong></td><td>文件删除/系统破坏</td><td><code>shutil.rmtree(), os.remove()</code></td></tr>
</table>

<h3>高危路径护栏</h3>
<pre>rm -rf ~/Desktop/ ~/Documents/ ~/Downloads/ ~/Pictures/...  ← 拦截走回收站
git reset --hard / git clean -fdx / git push -f             ← 拦截
dd if=/dev/zero / mkfs / shred / fdisk / parted              ← 拦截
docker system prune / kubectl delete / terraform destroy      ← 拦截</pre>

<!-- ===================== 13. DECRYPTION ===================== -->
<h2 id="decryption">13. 解密过程</h2>
<p class="lead">通过逆向分析 <code>marvis_agent.so</code>，提取 Fernet 加密密钥，成功解密所有 prompts 和 skills 文件。</p>

<h3>步骤</h3>
<ol>
  <li><strong>定位加密文件</strong> — 发现 prompts/ 和 skills/ 下的文件以 <code>gAAAAAB</code> (Fernet 魔数) 开头</li>
  <li><strong>逆向加密方案</strong> — 从 <code>marvis_agent.so</code> 的字符串中提取到 PBKDF2 + Fernet 方案</li>
  <li><strong>Mock 依赖链</strong> — 逐层 mock 缺失的 Python 模块 (truststore, loguru, sanic, sanic_ext, socketio 等 20+)</li>
  <li><strong>调用 get_fernet()</strong> — 成功 import marvis_agent 后调用 crypto_shared.get_fernet()</li>
  <li><strong>提取密钥</strong> — <code>5wZoDzUI_viUnF06WNmpYtoKtiRZWHljX47BmzU7B6s=</code></li>
  <li><strong>批量解密</strong> — 使用系统 cryptography 库解密全部 80 个文件</li>
</ol>

<div class="callout callout-success">
  <strong>结果：</strong>54 个 prompts + 26 个 SKILL.md = <strong>80 个文件全部成功解密，成功率 100%</strong>
</div>

<h3>密钥提取代码 (简化)</h3>
<pre>import sys, types
# Mock missing modules
for m in ['truststore','loguru','sanic','sanic_ext','socketio']:
    sys.modules[m] = types.ModuleType(m)

sys.path.insert(0, '_internal/')
import marvis_agent
from ai_agent.utils import crypto_shared

fernet = crypto_shared.get_fernet()
key = base64.urlsafe_b64encode(
    fernet._signing_key + fernet._encryption_key
).decode()
print(f"FERNET_KEY: {key}")  # 5wZoDzUI_viUnF06WNmpYtoKtiRZWHljX47BmzU7B6s=</pre>

<!-- ===================== APPENDIX ===================== -->
<h2 id="appendix">14. 附录：文件清单</h2>

<h3>解密文件位置</h3>
<table>
  <tr><th>路径</th><th>内容</th></tr>
  <tr><td><code>Marvis-Decrypted/prompts/</code></td><td>54 个重命名的 System Prompt</td></tr>
  <tr><td><code>Marvis-Decrypted/skills/</code></td><td>26 个重命名的 Skill 定义</td></tr>
  <tr><td><code>Marvis-Decrypted/all/</code></td><td>全部文件的合并副本</td></tr>
  <tr><td><code>Marvis-Decrypted/README.md</code></td><td>完整文件清单</td></tr>
</table>

<h3>数据量统计</h3>
<table>
  <tr><th>项目</th><th>数量</th></tr>
  <tr><td>Prompts 文件解密</td><td>54</td></tr>
  <tr><td>Skill 文件解密</td><td>26</td></tr>
  <tr><td>对话记录</td><td>6 个会话, 52 条消息</td></tr>
  <tr><td>对话记忆轨迹</td><td>72 条</td></tr>
  <tr><td>经验记忆</td><td>3 条</td></tr>
  <tr><td>SQLite 数据库</td><td>3 个 (data.db, memory.db, memory_vector.db)</td></tr>
  <tr><td>MCP 服务器</td><td>5</td></tr>
  <tr><td>安全规则</td><td>69+ 条 (3 个 YAML)</td></tr>
  <tr><td>Sub Agent 类型</td><td>6</td></tr>
</table>

<div class="footer">
  <p>逆向工程报告 · Marvis 1.0.0.10300 · 生成于 2026-07-22</p>
  <p>Fernet Key: <code>5wZoDzUI_viUnF06WNmpYtoKtiRZWHljX47BmzU7B6s=</code></p>
</div>

</div>
</body>
</html>
