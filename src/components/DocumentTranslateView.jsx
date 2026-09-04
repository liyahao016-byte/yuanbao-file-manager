import React, { useState } from 'react';

export default function DocumentTranslateView({ workspacePath }) {
  const [selectedFile, setSelectedFile] = useState({
    name: '2026_智能文件管理器_架构设计白皮书.pdf',
    size: '3.8 MB',
    pages: 24,
    detectedLang: '中文'
  });
  const [sourceLang, setSourceLang] = useState('自动检测 (中文)');
  const [targetLang, setTargetLang] = useState('英文 (English)');
  const [transMode, setTransMode] = useState('bilingual'); // 'bilingual' | 'targetOnly'
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleStartTranslate = () => {
    setIsTranslating(true);
    setProgress(0);
    setIsCompleted(false);

    let current = 0;
    const interval = setInterval(() => {
      current += 15;
      if (current >= 100) {
        setProgress(100);
        setIsTranslating(false);
        setIsCompleted(true);
        clearInterval(interval);
      } else {
        setProgress(current);
      }
    }, 200);
  };

  const handleSwapLangs = () => {
    const temp = sourceLang;
    setSourceLang(targetLang.includes('中文') ? '中文' : '英文');
    setTargetLang(temp.includes('中文') ? '英文 (English)' : '中文 (Chinese)');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflowY: 'auto' }}>
      
      {/* 顶部 Banner Header */}
      <div style={{
        padding: '20px 28px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
          }}>🌐</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>文档翻译</h2>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(0,185,107,0.1)', color: 'var(--tag-green)', fontWeight: '600' }}>
                支持保留原排版
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              支持 PDF / Word / PPT / Excel 原排版高质量双语翻译，数据本地引擎加密处理
            </p>
          </div>
        </div>

        {/* 模式选择 */}
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          <button
            onClick={() => setTransMode('bilingual')}
            style={{
              padding: '5px 12px', borderRadius: '6px', border: 'none',
              background: transMode === 'bilingual' ? '#ffffff' : 'transparent',
              color: transMode === 'bilingual' ? 'var(--tag-green)' : '#64748b',
              fontWeight: transMode === 'bilingual' ? '600' : '400',
              fontSize: '12px', cursor: 'pointer', boxShadow: transMode === 'bilingual' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            📄 双语对照
          </button>
          <button
            onClick={() => setTransMode('targetOnly')}
            style={{
              padding: '5px 12px', borderRadius: '6px', border: 'none',
              background: transMode === 'targetOnly' ? '#ffffff' : 'transparent',
              color: transMode === 'targetOnly' ? 'var(--tag-green)' : '#64748b',
              fontWeight: transMode === 'targetOnly' ? '600' : '400',
              fontSize: '12px', cursor: 'pointer', boxShadow: transMode === 'targetOnly' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            📝 仅保留译文
          </button>
        </div>
      </div>

      {/* 控制与语言选择 Bar */}
      <div style={{
        margin: '16px 28px 0', padding: '12px 20px', background: '#ffffff',
        borderRadius: '12px', border: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* 语言切换控制 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>源语言</span>
            <select
              value={sourceLang}
              onChange={e => setSourceLang(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                fontSize: '12px', fontWeight: '600', color: '#334155', background: '#f8fafc', outline: 'none'
              }}
            >
              <option>自动检测 (中文)</option>
              <option>英文 (English)</option>
              <option>日文 (Japanese)</option>
              <option>韩文 (Korean)</option>
              <option>德文 (German)</option>
            </select>
          </div>

          <button
            onClick={handleSwapLangs}
            title="切换源语言与目标语言"
            style={{
              marginTop: '12px', width: '32px', height: '32px', borderRadius: '50%',
              border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#475569',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
          >
            ⇄
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>目标语言</span>
            <select
              value={targetLang}
              onChange={e => setTargetLang(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--tag-green)',
                fontSize: '12px', fontWeight: '600', color: 'var(--tag-green)', background: 'rgba(0,185,107,0.05)', outline: 'none'
              }}
            >
              <option>英文 (English)</option>
              <option>中文 (Chinese)</option>
              <option>日文 (Japanese)</option>
              <option>韩文 (Korean)</option>
              <option>法文 (French)</option>
              <option>西班牙文 (Spanish)</option>
            </select>
          </div>
        </div>

        {/* 快速提示与专业术语库 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>💡 已自动匹配计算机/PM领域专属术语词典</span>
        </div>
      </div>

      {/* 主工作区网格 (左侧待翻译文件 + 右侧实时翻译预览) */}
      <div style={{ padding: '16px 28px 28px', display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px', flex: 1 }}>
        
        {/* 左侧：文件选择卡片 */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0',
          padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>1. 选择待翻译文档</h3>

          {/* Drag and drop upload box */}
          <div style={{
            border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '24px 16px',
            textAlign: 'center', background: '#f8fafc', cursor: 'pointer', transition: 'all 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--tag-green)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>拖拽文件到此处，或点击浏览</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>支持 PDF、Word (.docx)、PPT (.pptx)、Excel</div>
          </div>

          {/* 预选示例文件列表 */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>近期待处理文件推荐:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { name: '2026_智能文件管理器_架构设计白皮书.pdf', size: '3.8 MB', pages: 24, detectedLang: '中文' },
                { name: '西财期末复习资料_宏观经济学.docx', size: '1.2 MB', pages: 12, detectedLang: '中文' },
                { name: 'OpenAI_Agent_Architecture_Paper.pdf', size: '4.5 MB', pages: 30, detectedLang: '英文' }
              ].map(f => (
                <div
                  key={f.name}
                  onClick={() => setSelectedFile(f)}
                  style={{
                    padding: '8px 12px', borderRadius: '8px',
                    border: selectedFile.name === f.name ? '1.5px solid var(--tag-green)' : '1px solid #e2e8f0',
                    background: selectedFile.name === f.name ? 'rgba(0,185,107,0.06)' : '#ffffff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{f.size} · {f.pages} 页</div>
                  </div>
                  {selectedFile.name === f.name && <span style={{ color: 'var(--tag-green)', fontSize: '14px' }}>✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 翻译触发按钮与进度 */}
          <div style={{ marginTop: 'auto' }}>
            {isTranslating ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                  <span>⏳ 正在翻译中...</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', transition: 'width 0.2s ease' }} />
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartTranslate}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)', transition: 'all 0.15s'
                }}
              >
                ⚡️ 开始智能翻译
              </button>
            )}
          </div>

        </div>

        {/* 右侧：实时对照与导出预览面板 */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0',
          padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
              2. 翻译效果预览 ({transMode === 'bilingual' ? '双语对照' : '单语译文'})
            </h3>
            {isCompleted && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{
                  padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--tag-green)',
                  background: 'rgba(0,185,107,0.08)', color: 'var(--tag-green)', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                }}>
                  📥 导出双语对照 PDF
                </button>
                <button style={{
                  padding: '5px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#334155', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                }}>
                  📥 导出 Word 译文
                </button>
              </div>
            )}
          </div>

          {/* 对照预览内容区域 */}
          <div style={{
            flex: 1, border: '1px solid #f1f5f9', background: '#f8fafc', borderRadius: '8px',
            padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>段落 1 [原文 - 中文]</div>
              <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.6' }}>
                智能文件管理器是一款结合离线大模型与向量数据库的本地文件中台系统，旨在解决海量办公文档与代码资产的快速检索与分类归档需求。
              </div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '13px', color: '#10b981', fontWeight: '500', lineHeight: '1.6' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', display: 'block', marginBottom: '2px' }}>[译文 - 英文]</span>
                Smart File Manager is a local file middle-platform system combining offline LLMs and vector databases, designed to address rapid search and classification needs for massive office documents and code assets.
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>段落 2 [原文 - 中文]</div>
              <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.6' }}>
                系统提供跨平台客户端支持，采用极简响应式设计，所有文本解析与向量计算均在用户本地计算设备上高速执行。
              </div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '13px', color: '#10b981', fontWeight: '500', lineHeight: '1.6' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', display: 'block', marginBottom: '2px' }}>[译文 - 英文]</span>
                The system provides cross-platform client support with a minimalist responsive UI design, executing all text parsing and vector computations high-speed on local devices.
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
