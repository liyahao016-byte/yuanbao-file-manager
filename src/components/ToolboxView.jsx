import { useState } from 'react';

const TOOLS = [
  // --- 第一行：文档翻译（最突出，大卡片首位） ---
  {
    id: 'translate',
    name: '文档翻译',
    desc: '支持 PDF / Word / PPT 一键翻译，保留原格式排版',
    icon: '🌐',
    tag: '热门',
    tagColor: '#ef4444',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    featured: true,
    langs: ['中文 → 英文', '英文 → 中文', '日文 → 中文', '更多语言'],
  },
  // --- 智能资产沉淀 ---
  {
    id: 'asset_distiller',
    name: '智能资产沉淀',
    desc: '基于 sqlite-vec 向量数据库与 AI 混合检索，持续沉淀有价值资产并导出知识库',
    icon: '💎',
    tag: 'AI 沉淀',
    tagColor: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    featured: true,
  },
  // --- 垃圾清理 ---
  {
    id: 'cleanup',
    name: '垃圾清理',
    desc: '扫描重复文件、大文件、缓存垃圾，释放磁盘空间',
    icon: '🧹',
    tag: '推荐',
    tagColor: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    featured: false,
  },
  // --- 格式转换 ---
  {
    id: 'convert',
    name: '格式转换',
    desc: 'PDF、Word、PPT、图片等格式互转，本地处理不上传',
    icon: '🔄',
    tag: '',
    tagColor: '',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    featured: false,
    subTools: ['PDF → Word', 'Word → PDF', 'PPT → PDF', '图片 → PDF', 'PDF → 图片', 'JPG → PNG'],
  },
  // --- 文档编辑 ---
  {
    id: 'edit',
    name: '文档编辑',
    desc: '去水印、电子签名、文字标注、多文档合并，一站完成',
    icon: '✏️',
    tag: '',
    tagColor: '',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    featured: false,
    subTools: ['去水印', '电子签名', '文字标注', '文档合并', '文档拆分', 'PDF 加密'],
  },
];

const NAV_CATEGORIES = ['全部工具', '文档处理', '文件管理', '格式转换'];

export default function ToolboxView({ onNavClick, activeToolId }) {
  const [activeCategory, setActiveCategory] = useState(() => {
    if (activeToolId === 'translate') return '文档处理';
    if (activeToolId === 'convert') return '格式转换';
    if (activeToolId === 'cleanup') return '文件管理';
    return '全部工具';
  });
  const [hoveredId, setHoveredId] = useState(null);
  const [translateFrom, setTranslateFrom] = useState('中文');
  const [translateTo, setTranslateTo] = useState('英文');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fafbfc' }}>

      {/* Page Header */}
      <div style={{
        padding: '22px 28px 16px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* BG Decorations */}
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(99,102,241,0.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20px', left: '40%', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(59,130,246,0.08)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '22px' }}>🧰</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>工具箱</h2>
            <span style={{
              padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
              background: 'rgba(99,102,241,0.3)', color: '#a5b4fc',
            }}>5 个工具</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
            文档处理、格式转换、智能清理，本地运行，数据不出设备
          </p>
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {NAV_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activeCategory === cat ? '#6366f1' : 'rgba(255,255,255,0.08)',
                color: activeCategory === cat ? '#fff' : '#94a3b8',
                boxShadow: activeCategory === cat ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tools Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

        {/* ========== 文档翻译：Featured Large Card ========== */}
        {(() => {
          const tool = TOOLS[0];
          const isHovered = hoveredId === tool.id;
          return (
            <div
              key={tool.id}
              onMouseEnter={() => setHoveredId(tool.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                borderRadius: '16px',
                background: tool.gradient,
                padding: '24px',
                marginBottom: '16px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isHovered ? '0 12px 32px rgba(99,102,241,0.35)' : '0 4px 16px rgba(99,102,241,0.2)',
                transform: isHovered ? 'translateY(-2px)' : 'none',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
              }}
            >
              {/* BG Circle */}
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-30px', right: '80px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '28px' }}>{tool.icon}</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{tool.name}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
                      background: '#ef4444', color: '#fff',
                    }}>热门</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.75)', maxWidth: '400px' }}>
                    {tool.desc}
                  </p>
                </div>

                {/* Quick Action Button */}
                <button style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  立即使用 →
                </button>
              </div>

              {/* Language Quick Select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
                {['中文 → 英文', '英文 → 中文', '日文 → 中文', 'PDF → 双语对照'].map(opt => (
                  <button
                    key={opt}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ========== 其他工具：3列网格 ========== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {TOOLS.slice(1).map(tool => {
            const isHovered = hoveredId === tool.id;
            return (
              <div
                key={tool.id}
                onMouseEnter={() => setHoveredId(tool.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  borderRadius: '14px',
                  background: '#fff',
                  border: isHovered ? '1.5px solid rgba(99,102,241,0.25)' : '1px solid #e2e8f0',
                  padding: '18px',
                  cursor: 'pointer',
                  boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
                  transform: isHovered ? 'translateY(-2px)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => {
                  if (tool.id === 'cleanup' && onNavClick) onNavClick('cleanup');
                }}
              >
                {/* Top Gradient Strip */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: tool.gradient, borderRadius: '14px 14px 0 0',
                  opacity: isHovered ? 1 : 0, transition: 'opacity 0.2s'
                }} />

                {/* Icon + Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: `linear-gradient(135deg, ${tool.gradient.match(/#[\w]+/g)?.[0] || '#6366f1'}22 0%, ${tool.gradient.match(/#[\w]+/g)?.[1] || '#3b82f6'}11 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                    flexShrink: 0,
                  }}>
                    {tool.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {tool.name}
                      {tool.tag && (
                        <span style={{
                          padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600',
                          background: tool.tagColor + '18', color: tool.tagColor,
                        }}>{tool.tag}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
                  {tool.desc}
                </p>

                {/* Sub Tools Tags */}
                {tool.subTools && (
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {tool.subTools.map(sub => (
                      <span key={sub} style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '500',
                        background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
                      }}>{sub}</span>
                    ))}
                  </div>
                )}

                {/* Arrow */}
                <div style={{
                  position: 'absolute', bottom: '16px', right: '16px',
                  color: isHovered ? '#6366f1' : '#cbd5e1',
                  transition: 'all 0.2s', transform: isHovered ? 'translateX(2px)' : 'none',
                  fontSize: '16px', fontWeight: '600',
                }}>→</div>
              </div>
            );
          })}
        </div>

        {/* Coming Soon Placeholder */}
        <div style={{
          marginTop: '16px',
          padding: '16px',
          borderRadius: '12px',
          border: '1.5px dashed #e2e8f0',
          textAlign: 'center',
          color: '#94a3b8', fontSize: '12px'
        }}>
          🔧 更多工具持续上线中，敬请期待...
        </div>
      </div>
    </div>
  );
}
