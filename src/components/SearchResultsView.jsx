import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { renderToString } from 'react-dom/server';
import { getFileIcon } from '../utils/iconUtils';
import SmartRenameModal from './SmartRenameModal';

const getChannel = (path) => {
  if (!path) return '本地文件';
  const lower = path.toLowerCase();
  if (lower.includes('wechat') || lower.includes('微信')) return '微信接收';
  if (lower.includes('qq')) return 'QQ接收';
  if (lower.includes('download') || lower.includes('下载')) return '浏览器下载';
  if (lower.includes('desktop') || lower.includes('桌面')) return '本地桌面';
  return '本地文件';
};
export default function SearchResultsView({ query, category, onPreview, setIsGlobalDragging, setDraggedFile, onSearch }) {
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [results, setResults] = useState([]);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [formatFilter, setFormatFilter] = useState('all');
  const [localQuery, setLocalQuery] = useState(query);

  const selectedFiles = results.filter(f => selectedFileIds[f.id]);

  const parseSize = (sizeStr) => {
    if (!sizeStr) return 0;
    if (typeof sizeStr === 'number') return sizeStr;
    const match = sizeStr.toString().match(/([\d.]+)\s*(KB|MB|GB|B)/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === 'KB') return val * 1024;
    if (unit === 'MB') return val * 1024 * 1024;
    if (unit === 'GB') return val * 1024 * 1024 * 1024;
    return val;
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    return new Date(timeStr.replace(' ', 'T')).getTime();
  };

  const formatDisplaySize = (sizeVal) => {
    if (!sizeVal || sizeVal === '--') return '--';
    if (typeof sizeVal === 'number') {
      if (sizeVal < 1024) return `${sizeVal} B`;
      if (sizeVal < 1024 * 1024) return `${Math.round(sizeVal / 1024)} KB`;
      if (sizeVal < 1024 * 1024 * 1024) return `${(sizeVal / (1024 * 1024)).toFixed(1)} MB`;
      return `${(sizeVal / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    const str = String(sizeVal).trim();
    const match = str.match(/^([\d.]+)\s*(KB|MB|GB|B)?$/i);
    if (match) {
      const val = parseFloat(match[1]);
      const unit = (match[2] || 'KB').toUpperCase();
      let bytes = val;
      if (unit === 'KB') bytes = val * 1024;
      else if (unit === 'MB') bytes = val * 1024 * 1024;
      else if (unit === 'GB') bytes = val * 1024 * 1024 * 1024;

      if (bytes < 1024) return `${Math.round(bytes)} B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return str;
  };

  const availableFormats = Array.from(new Set(
    results.map(f => (f.format || f.type || f.fileType || '').toUpperCase()).filter(f => f && f !== 'FOLDER' && f !== 'UNKNOWN')
  )).sort();

  let renderFiles = [...results];

  if (formatFilter !== 'all') {
    renderFiles = renderFiles.filter(f => (f.format || f.type || f.fileType || '').toUpperCase() === formatFilter);
  }

  if (sortConfig.key) {
    renderFiles.sort((a, b) => {
      let valA = 0, valB = 0;
      if (sortConfig.key === 'size') {
        valA = parseSize(a.size);
        valB = parseSize(b.size);
      } else if (sortConfig.key === 'time') {
        valA = parseTime(a.updatedAt || a.updated_at || a.time);
        valB = parseTime(b.updatedAt || b.updated_at || b.time);
      }
      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newIds = {};
      results.forEach(f => newIds[f.id] = true);
      setSelectedFileIds(newIds);
    } else {
      setSelectedFileIds({});
    }
  };

  const handleToggleSelect = (e, id) => {
    e.stopPropagation();
    setSelectedFileIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    setIsLoading(true);
    if (window.__TAURI_INTERNALS__) {
      invoke('semantic_search', { query, filterCategory: category })
        .then(async (res) => {
          const fetchedResults = res || [];
          setResults(fetchedResults);
          setIsLoading(false);
          
          const resultsWithSnippets = [...fetchedResults];
          for (let i = 0; i < resultsWithSnippets.length; i++) {
             try {
               const snippet = await invoke('read_document_snippet', { path: resultsWithSnippets[i].path });
               if (snippet) {
                 const cleanSnippet = snippet.replace(/\s+/g, ' ').substring(0, 30);
                 resultsWithSnippets[i].snippet = cleanSnippet;
                 setResults([...resultsWithSnippets]);
               }
             } catch (e) {
               // Ignore error
             }
          }
        })
        .catch(err => {
          console.error(err);
          setIsLoading(false);
        });
    } else {
      setTimeout(() => {
        setIsLoading(false);
      }, 400);
    }
    // Clear selection and filters on new search
    setSelectedFileIds({});
    setSortConfig({ key: null, direction: 'asc' });
    setFormatFilter('all');
  }, [query, category]);

  const handleFileClick = (file) => {
    if (onPreview) onPreview(file);
    setToastMsg(`搜索词“${query}”已追加至 ${file.name} 的 user_tags 标签矩阵`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Sync localQuery when query prop changes (new tab)
  useEffect(() => { setLocalQuery(query); }, [query]);

  const handleReSearch = () => {
    const trimmed = localQuery.trim();
    if (!trimmed || !onSearch) return;
    onSearch(trimmed, category);
  };

  return (
    <div style={{ flex: 1, padding: '0', background: '#fff', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* 二次搜索框 - 大且醒目 */}
      <div style={{
        padding: '14px 24px',
        borderBottom: '1px solid var(--border-color)',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {/* 大搜索框 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: '12px',
          padding: '0 14px',
          transition: 'border-color 0.2s',
        }}
          onFocus={() => {}}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--tag-green)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReSearch()}
            placeholder="输入新的搜索内容..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '15px',
              color: '#1e293b',
              padding: '11px 0',
              fontFamily: 'inherit',
            }}
          />
          {localQuery && (
            <button
              onClick={() => setLocalQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              title="清空"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          )}
          <button
            onClick={handleReSearch}
            style={{
              background: 'var(--tag-green)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            搜索
          </button>
        </div>

        {/* 结果描述条 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {results.length > 0 && (
              <input 
                type="checkbox" 
                checked={Object.keys(selectedFileIds).length === results.length}
                onChange={handleSelectAll}
                style={{ cursor: 'pointer' }}
              />
            )}
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              找到与 <span style={{ color: 'var(--tag-green)', fontWeight: 'bold' }}>"{query}"</span> 相关的 {results.length} 个文件
            </div>
            {selectedFiles.length > 0 && (
              <button 
                onClick={() => setIsRenameModalOpen(true)}
                title="AI 智能批量重命名"
                style={{ 
                  background: 'var(--tag-green)', color: '#fff', border: 'none', 
                  borderRadius: '6px', padding: '4px 8px', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '500', boxShadow: '0 2px 4px rgba(0, 185, 107, 0.2)'
                }}
              >
                <span style={{ marginRight: '4px' }}>✨</span> AI 命名
              </button>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            ✨ AI 深度检索已启用
          </div>
        </div>
      </div>

      {/* 2. Table Column Headers Row (1:1 align with FileListView) */}
      {!isLoading && renderFiles.length > 0 && (
        <div style={{ padding: '6px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600', background: '#f8fafc', userSelect: 'none' }}>
          <div style={{ width: '16px', height: '16px', marginRight: '10px', flexShrink: 0 }} />
          <span 
            style={{ flex: 1, minWidth: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155' }}
            onClick={() => setSortConfig(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
          >
            文件名 {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '^'}
          </span>
          <span 
            style={{ width: '80px', textAlign: 'right', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', userSelect: 'none' }} 
            onClick={() => setSortConfig(prev => ({ key: 'size', direction: prev.key === 'size' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
          >
            大小
            <span style={{ display: 'flex', flexDirection: 'column', marginLeft: '4px', fontSize: '8px', lineHeight: 1 }}>
              <span style={{ color: sortConfig.key === 'size' && sortConfig.direction === 'asc' ? 'var(--tag-green)' : '#ccc' }}>▲</span>
              <span style={{ color: sortConfig.key === 'size' && sortConfig.direction === 'desc' ? 'var(--tag-green)' : '#ccc' }}>▼</span>
            </span>
          </span>
          <span style={{ width: '60px', marginLeft: '16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select 
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', appearance: 'none', paddingRight: '12px', zIndex: 1 }}
              >
                <option value="all">格式</option>
                {availableFormats.map(fmt => <option key={fmt} value={fmt}>{fmt}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 0, display: 'flex', flexDirection: 'column', fontSize: '8px', lineHeight: 1, pointerEvents: 'none' }}>
                <span style={{ color: '#ccc' }}>▲</span>
                <span style={{ color: '#ccc' }}>▼</span>
              </span>
            </div>
          </span>
          <span 
            style={{ width: '120px', marginLeft: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', userSelect: 'none' }}
            onClick={() => setSortConfig(prev => ({ key: 'time', direction: prev.key === 'time' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
          >
            操作时间
            <span style={{ display: 'flex', flexDirection: 'column', marginLeft: '4px', fontSize: '8px', lineHeight: 1 }}>
              <span style={{ color: sortConfig.key === 'time' && sortConfig.direction === 'asc' ? 'var(--tag-green)' : '#ccc' }}>▲</span>
              <span style={{ color: sortConfig.key === 'time' && sortConfig.direction === 'desc' ? 'var(--tag-green)' : '#ccc' }}>▼</span>
            </span>
          </span>
        </div>
      )}

      {/* 3. Table Rows Section (1:1 align with FileListView layout, spacing & formatting) */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {isLoading ? (
          // 骨架屏 (Skeleton Screen)
          <div className="skeleton-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#f5f5f5', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ width: '40%', height: '14px', background: '#f5f5f5', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                  <div style={{ width: '60%', height: '12px', background: '#f5f5f5', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                </div>
              </div>
            ))}
            <style>{`
              @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.4; }
                100% { opacity: 1; }
              }
            `}</style>
          </div>
        ) : (
          // 真实结果列表
          <div style={{ padding: '4px 8px' }}>
            {renderFiles.map(file => (
              <div key={file.id} 
                draggable={true}
                onDragStart={(e) => {
                  if (setIsGlobalDragging) setIsGlobalDragging(true);
                  if (setDraggedFile) setDraggedFile(file);
                  window.__draggedFile = file;
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData('application/json', JSON.stringify(file));
                  e.dataTransfer.setData('text/plain', file.id || file.path);
                  
                  // Custom macOS-style Drag Ghost
                  const ghost = document.createElement('div');
                  ghost.id = 'drag-ghost-capsule';
                  ghost.style.position = 'absolute';
                  ghost.style.top = '-1000px';
                  ghost.style.background = 'rgba(40, 40, 40, 0.85)';
                  ghost.style.color = '#fff';
                  ghost.style.padding = '6px 16px';
                  ghost.style.borderRadius = '24px';
                  ghost.style.display = 'flex';
                  ghost.style.alignItems = 'center';
                  ghost.style.gap = '8px';
                  ghost.style.fontSize = '14px';
                  ghost.style.fontWeight = '500';
                  ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                  ghost.style.backdropFilter = 'blur(10px)';
                  ghost.style.zIndex = '99999';
                  ghost.style.border = '1px solid rgba(255,255,255,0.1)';
                  
                  const iconHtml = renderToString(getFileIcon(file.type || file.fileType || file.format));
                  ghost.innerHTML = `<span style="display:flex;align-items:center;width:20px;height:20px;">${iconHtml}</span><span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</span>`;
                  
                  document.body.appendChild(ghost);
                  e.dataTransfer.setDragImage(ghost, 20, 20);
                }}
                onDragEnd={(e) => {
                  if (setIsGlobalDragging) setIsGlobalDragging(false);
                  e.currentTarget.style.opacity = '1';
                  const ghost = document.getElementById('drag-ghost-capsule');
                  if (ghost) ghost.remove();
                  setTimeout(() => {
                    if (setDraggedFile) setDraggedFile(null);
                    window.__draggedFile = null;
                  }, 100);
                }}
                className={`file-row ${selectedFileIds[file.id] ? 'selected' : ''}`}
                onClick={() => handleFileClick(file)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '6px 8px', 
                  borderRadius: '6px', 
                  background: selectedFileIds[file.id] ? 'var(--bg-active)' : 'transparent',
                  marginBottom: '2px',
                  cursor: 'pointer',
                  color: selectedFileIds[file.id] ? 'var(--tag-green)' : 'inherit',
                  transition: 'background 0.15s ease',
                }}
                onMouseOver={(e) => { if (!selectedFileIds[file.id]) e.currentTarget.style.background = 'var(--bg-active)'; }}
                onMouseOut={(e) => { if (!selectedFileIds[file.id]) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* 最左侧复选框 + 文件图标 (对齐 FileListView 规格) */}
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div 
                    onClick={(e) => handleToggleSelect(e, file.id)}
                    style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: selectedFileIds[file.id] ? 'none' : '1px solid #cbd5e1', 
                      background: selectedFileIds[file.id] ? 'var(--tag-green)' : '#fff', 
                      borderRadius: '4px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justify: 'center', 
                      marginRight: '8px', 
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {selectedFileIds[file.id] && (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', marginRight: '8px', flexShrink: 0 }}>
                    {getFileIcon(file.type || file.fileType || file.format)}
                  </span>
                </span>
                
                {/* 文件名 + AI 语义匹配线索 */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: selectedFileIds[file.id] ? '600' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file.name}
                  </span>
                  <div style={{ fontSize: '11px', color: '#666', background: '#f9f9f9', display: 'inline-flex', padding: '2px 6px', borderRadius: '4px', border: '1px solid #eee', width: 'fit-content', marginTop: '2px' }}>
                    <span style={{ color: '#009a52', fontWeight: '500', marginRight: '4px' }}>✨ 匹配线索：</span>
                    <span>渠道：{getChannel(file.path)} ｜ 主题：{file.snippet ? `正文包含“${file.snippet}...”` : '命中向量语义'}</span>
                  </div>
                </div>
                
                {/* 大小 (使用格式化函数: 48643 KB -> 47.5 MB) */}
                <span style={{ width: '80px', textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {formatDisplaySize(file.size)}
                </span>
                {/* 格式 */}
                <span style={{ width: '60px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', background: '#f5f5f5', borderRadius: '4px', padding: '2px 0', marginLeft: '16px', flexShrink: 0 }}>
                  {(file.format || file.type || file.fileType || 'UNKNOWN').toUpperCase()}
                </span>
                {/* 操作时间 */}
                <span style={{ width: '120px', fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '16px', flexShrink: 0 }}>
                  {file.updatedAt || file.updated_at || file.time || '--'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 点击反哺 Toast */}
      {toastMsg && (
        <div style={{
          position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '10px 24px', borderRadius: '24px',
          fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000,
          animation: 'fadeInUp 0.3s ease-out'
        }}>
          {toastMsg}
        </div>
      )}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* AI 命名弹窗 */}
      {isRenameModalOpen && (
        <SmartRenameModal 
          selectedFiles={selectedFiles} 
          onClose={() => setIsRenameModalOpen(false)}
          onConfirm={() => {
            setIsRenameModalOpen(false);
            setSelectedFileIds({});
          }}
        />
      )}
    </div>
  );
}
