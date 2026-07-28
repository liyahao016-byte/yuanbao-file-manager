import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon } from '../utils/iconUtils';

const getChannel = (path) => {
  if (!path) return '本地文件';
  const lower = path.toLowerCase();
  if (lower.includes('wechat') || lower.includes('微信')) return '微信接收';
  if (lower.includes('qq')) return 'QQ接收';
  if (lower.includes('download') || lower.includes('下载')) return '浏览器下载';
  if (lower.includes('desktop') || lower.includes('桌面')) return '本地桌面';
  return '本地文件';
};
export default function SmartSearchBox({ onSearch, activeSearchQuery }) {
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const wrapperRef = useRef(null);
  // Ref so the click-outside handler always sees the latest value without re-registering
  const activeSearchQueryRef = useRef(activeSearchQuery);
  useEffect(() => { activeSearchQueryRef.current = activeSearchQuery; }, [activeSearchQuery]);

  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('searchHistory');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const [realResults, setRealResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // 点击外部收起：点击搜索展开栏以外的地方收起展开栏
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 当切换标签页/传入 activeSearchQuery 发生变化时更新输入框
  useEffect(() => {
    if (activeSearchQuery) {
      setQuery(activeSearchQuery);
    }
  }, [activeSearchQuery]);

  // 动态修改侧边栏宽度以实现横向展开和收缩效果
  useEffect(() => {
    const root = document.documentElement;
    if (isFocused) {
      root.style.setProperty('--sidebar-width', '380px');
    } else {
      root.style.setProperty('--sidebar-width', '240px');
    }
  }, [isFocused]);

  // 当切换到搜索结果标签页时，自动展开下拉并填入搜索词，方便二次搜索
  useEffect(() => {
    if (activeSearchQuery) {
      // 切换到搜索tab：填入当前词并展开
      setQuery(activeSearchQuery);
      setIsFocused(true);
    } else {
      // 切换到非搜索tab：收起下拉（不清空，保留上次输入）
      setIsFocused(false);
    }
  }, [activeSearchQuery]);

  // 实时搜索节流防抖
  useEffect(() => {
    if (query.trim() && window.__TAURI_INTERNALS__) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        invoke('semantic_search', { query, filterCategory: category })
          .then(async (res) => {
            const fetchedResults = res || [];
            // 只取前 10 个展示给用户
            const topResults = fetchedResults.slice(0, 10);
            setRealResults(topResults);
            setIsSearching(false);
            
            const resultsWithSnippets = [...topResults];
            for (let i = 0; i < resultsWithSnippets.length; i++) {
               try {
                 const snippet = await invoke('read_document_snippet', { path: resultsWithSnippets[i].path });
                 if (snippet) {
                   const cleanSnippet = snippet.replace(/\s+/g, ' ').substring(0, 30);
                   resultsWithSnippets[i].snippet = cleanSnippet;
                   setRealResults([...resultsWithSnippets]);
                 }
               } catch (e) {
                 // Ignore error
               }
            }
          })
          .catch(err => {
            console.error(err);
            setIsSearching(false);
          });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setRealResults([]);
      setIsSearching(false);
    }
  }, [query, category]);

  const saveHistory = (q) => {
    if (!q.trim()) return;
    const newHistory = [q, ...searchHistory.filter(h => h !== q)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      setIsFocused(false);
      saveHistory(query);
      if (onSearch) onSearch(query, category);
    }
  };

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    setCategory(newCat);
    if (query.trim() && onSearch) {
      onSearch(query, newCat);
    }
  };

  const handleClearHistory = (e) => {
    e.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginTop: '20px' }}>
      {/* 搜索框外壳 */}
      <div style={{ 
        background: '#fff', borderRadius: '8px', padding: '0 12px', 
        border: isFocused ? '1px solid var(--tag-green)' : '1px solid var(--border-color)', 
        display: 'flex', alignItems: 'center', 
        boxShadow: isFocused ? '0 0 0 2px rgba(0, 185, 107, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
        transition: 'all 0.2s', height: '40px'
      }}>
        
        {/* 左侧大类筛选器 */}
        <select 
          value={category} 
          onChange={handleCategoryChange}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '13px', marginRight: '8px',
            cursor: 'pointer'
          }}
        >
          <option>全部</option>
          <option>文档</option>
          <option>图片</option>
          <option>视频</option>
        </select>
        
        <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', marginRight: '12px' }}></div>

        <span style={{ color: 'var(--icon-color)', marginRight: '8px', fontSize: '16px' }}>✨</span>
        <input 
          type="text" 
          placeholder="描述你要搜索的文件" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '13px', fontFamily: 'inherit', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} 
        />
        {query && (
          <span 
            onClick={() => {setQuery(''); setIsFocused(false)}} 
            style={{ color: '#ccc', cursor: 'pointer', padding: '0 4px', fontSize: '14px', marginLeft: '8px' }}
          >✖</span>
        )}
      </div>

      {/* 智能检索下拉面板 */}
      {isFocused && (
        <div style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid var(--border-color)', zIndex: 100, overflow: 'hidden'
        }}>
          <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '16px' }}>
            
            {!query ? (
              // 【空态面板】：未输入内容时
              <>
                {/* 历史搜索 */}
                {searchHistory.length > 0 ? (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>历史搜索</span>
                      <span onClick={handleClearHistory} style={{ fontSize: '12px', color: '#999', cursor: 'pointer' }}>清除</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {searchHistory.map((h, i) => (
                        <div key={i} onClick={() => {setQuery(h); saveHistory(h); if(onSearch) onSearch(h); setIsFocused(false);}} style={{ background: '#f5f5f5', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          {h}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '20px 0' }}>暂无搜索历史</div>
                )}
              </>
            ) : (
              // 【输入态面板】：有输入内容时
              <div style={{ paddingTop: '8px' }}>
                {isSearching ? (
                  <div style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '20px 0' }}>正在检索中...</div>
                ) : realResults.length > 0 ? (
                  realResults.map((item) => (
                    <div key={item.id} 
                      onClick={() => { saveHistory(query); if(onSearch) onSearch(query); setIsFocused(false); }}
                      style={{ 
                        padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px',
                        transition: 'background 0.2s', display: 'flex', gap: '12px',
                        borderBottom: '1px solid #f0f0f0'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f9f9f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '2px' }}>
                         <span style={{ width: '28px', height: '28px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getFileIcon(item.type || item.fileType)}
                        </span>
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                            {item.name}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.updatedAt || 'Unknown'}</span>
                        </div>
  
                        {/* 可解释性命中反馈 */}
                        <div style={{ fontSize: '11px', color: '#666', background: '#f9f9f9', display: 'inline-flex', padding: '4px 8px', borderRadius: '4px', border: '1px solid #eee', marginBottom: '6px' }}>
                          <span style={{ color: '#009a52', fontWeight: '500', marginRight: '4px' }}>✨ 匹配线索：</span>
                          <span>渠道：{getChannel(item.path)} ｜ 主题：{item.snippet ? `正文包含“${item.snippet}...”` : '命中向量语义'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '20px 0' }}>未找到相关结果</div>
                )}
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
