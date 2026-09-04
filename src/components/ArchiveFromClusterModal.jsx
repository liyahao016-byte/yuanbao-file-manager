import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

/**
 * ArchiveFromClusterModal — 「以文件为锚点」归档弹窗
 * 入口：簇卡片「归档本簇」按钮
 * 特点：文件列表预填且不可编辑，AI 读文件内容预填「关键产出」
 * 
 * 数据来源：
 * - AI 预填：invoke ai_analyze_files（Ollama 真实调用）
 * - historyTags：invoke query_history_tags（DB 真实查询）
 */
export default function ArchiveFromClusterModal({ clusterName, files = [], onClose, onConfirm }) {
  // 表单状态
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState('');
  const [duration, setDuration] = useState('');
  const [output, setOutput] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  
  // AI 预填状态
  const [aiStatus, setAiStatus] = useState('loading'); // 'loading' | 'done' | 'error'

  // 从后端加载的历史标签
  const [historyTags, setHistoryTags] = useState([]);

  // 归档目录选择：默认使用全局配置，可自定义
  const [defaultVaultPath, setDefaultVaultPath] = useState('');
  const [customVaultPath, setCustomVaultPath] = useState('');
  const [useCustomPath, setUseCustomPath] = useState(false);

  // 过滤后的标签建议
  const filteredTags = historyTags.filter(
    t => t.includes(tagInput) && !tags.includes(t)
  );

  // 加载历史标签和归档配置
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const [tagsResult, configResult] = await Promise.all([
            invoke('query_history_tags').catch(() => []),
            invoke('get_archive_config').catch(() => ({})),
          ]);
          setHistoryTags(tagsResult || []);
          if (configResult && configResult.vaultPath) {
            setDefaultVaultPath(configResult.vaultPath);
          }
        }
      } catch (err) {
        console.warn('Failed to load data:', err);
      }
    };
    loadData();
  }, []);

  // 选择自定义归档目录
  const handleSelectCustomDir = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: '选择归档目录',
      });
      if (selectedPath) {
        setCustomVaultPath(selectedPath);
        setUseCustomPath(true);
      }
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  };

  // AI 预填：调用 Ollama 分析文件内容
  useEffect(() => {
    let cancelled = false;

    const analyzeFiles = async () => {
      const filePaths = files.map(f => f.path).filter(Boolean);

      if (!window.__TAURI_INTERNALS__ || filePaths.length === 0) {
        // 浏览器降级：基本预填
        if (!cancelled) {
          setTitle(`${clusterName || '文件处理'} 归档`);
          setOutput(`已完成 ${files.length} 个文件的整理与归档。`);
          setAiStatus('done');
        }
        return;
      }

      try {
        const result = await invoke('ai_analyze_files', {
          filePaths,
          clusterName: clusterName || null,
        });

        if (!cancelled && result) {
          setTitle(result.title || `${clusterName || '文件处理'} 归档`);
          setOutput(result.output || `已完成 ${files.length} 个文件的整理与归档。`);
          // AI 建议的标签自动预填
          if (result.tags && result.tags.length > 0) {
            setTags(prev => {
              const merged = [...new Set([...prev, ...result.tags])];
              return merged;
            });
          }
          setAiStatus('done');
        }
      } catch (err) {
        console.warn('AI analysis failed, using fallback:', err);
        if (!cancelled) {
          // 降级：基本预填（不用假数据）
          setTitle(`${clusterName || '文件处理'} 归档`);
          const fileNames = files.slice(0, 3).map(f => f.name).join('、');
          setOutput(
            `已完成 ${files.length} 个文件的整理与归档${fileNames ? '，包含' + fileNames + (files.length > 3 ? '等文件' : '') : ''}。`
          );
          setAiStatus('done');
        }
      }
    };

    analyzeFiles();
    return () => { cancelled = true; };
  }, [clusterName, files]);

  const handleAddTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = () => {
    onConfirm?.({
      title, project, priority, duration,
      output, tags,
      files: files.map(f => f.path),
      customVaultPath: useCustomPath && customVaultPath ? customVaultPath : null,
      timestamp: new Date().toISOString()
    });
  };

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '640px', maxWidth: '90%',
        boxShadow: '0 20px 24px -4px rgba(0,0,0,0.1), 0 8px 10px -4px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', fontWeight: '600' }}>
            <span style={{ marginRight: '8px', fontSize: '18px' }}>📋</span>
            归档本簇
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '400', marginLeft: '12px' }}>
              {timeStr}
            </span>
          </h2>
          <button onClick={onClose} style={{ fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', background: '#fafbfc' }}>

          {/* 簇内文件列表（只读，来自文件簇） */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '8px' }}>
              簇内文件 · {files.length} 个
            </div>
            <div style={{
              background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px',
              maxHeight: '120px', overflowY: 'auto'
            }}>
              {files.length > 0 ? files.map((f, i) => (
                <div key={i} style={{
                  padding: '8px 12px', fontSize: '12px', color: '#475569',
                  borderBottom: i < files.length - 1 ? '1px solid #f5f5f5' : 'none',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span style={{ color: '#94a3b8' }}>📄</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{f.size || ''}</span>
                </div>
              )) : (
                <div style={{ padding: '12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                  无关联文件
                </div>
              )}
            </div>
          </div>

          {/* AI 预填骨架屏 */}
          {aiStatus === 'loading' && (
            <div style={{
              padding: '24px', textAlign: 'center', background: '#fff', borderRadius: '8px',
              border: '1px solid var(--border-color)', marginBottom: '16px'
            }}>
              <div style={{
                width: '40px', height: '40px', margin: '0 auto 12px',
                borderRadius: '50%', background: '#e6f7ef',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>
                <span>✨</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                AI 正在读取文件内容...
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                预填标题与关键产出
              </div>
            </div>
          )}

          {/* 表单区域 */}
          {aiStatus !== 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 标题 */}
              <div>
                <label style={labelStyle}>标题 <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="这件事的一句话概括"
                  style={inputStyle}
                />
              </div>

              {/* 项目 + 优先级（同行） */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>项目</label>
                  <input
                    type="text"
                    value={project}
                    onChange={e => setProject(e.target.value)}
                    placeholder="所属项目或方向"
                    style={inputStyle}
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <label style={labelStyle}>优先级</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">-</option>
                    <option value="P0">P0</option>
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                  </select>
                </div>
                <div style={{ width: '120px' }}>
                  <label style={labelStyle}>耗时</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    placeholder="如 45 min"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* 关键产出 */}
              <div>
                <label style={labelStyle}>关键产出 <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  value={output}
                  onChange={e => setOutput(e.target.value)}
                  placeholder="这件事产出了什么、做到了什么程度"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                />
              </div>

              {/* 自定义标签 */}
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>标签</label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '6px',
                  padding: '8px 10px', background: '#fff', borderRadius: '8px',
                  border: '1px solid #e2e8f0', minHeight: '38px', alignItems: 'center'
                }}>
                  {tags.map(tag => (
                    <span key={tag} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', background: 'rgba(0, 185, 107, 0.1)',
                      color: 'var(--tag-green)', borderRadius: '4px', fontSize: '12px', fontWeight: '500'
                    }}>
                      #{tag}
                      <span
                        onClick={() => handleRemoveTag(tag)}
                        style={{ cursor: 'pointer', fontSize: '14px', lineHeight: 1, color: '#94a3b8' }}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                    onKeyDown={handleTagKeyDown}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    placeholder={tags.length === 0 ? '输入标签，回车添加' : ''}
                    style={{
                      border: 'none', outline: 'none', fontSize: '12px',
                      flex: 1, minWidth: '80px', background: 'transparent'
                    }}
                  />
                </div>
                {/* 历史标签下拉 */}
                {showTagSuggestions && filteredTags.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginTop: '4px',
                    maxHeight: '150px', overflowY: 'auto'
                  }}>
                    {filteredTags.map(tag => (
                      <div
                        key={tag}
                        onMouseDown={() => handleAddTag(tag)}
                        style={{
                          padding: '8px 12px', fontSize: '12px', cursor: 'pointer',
                          color: '#475569', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: '#94a3b8' }}>#</span>
                        {tag}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 归档到 — 目录选择 */}
              <div>
                <label style={labelStyle}>归档到</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', background: '#fff', borderRadius: '8px',
                  border: '1px solid #e2e8f0', minHeight: '38px'
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>📂</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {useCustomPath && customVaultPath ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '12px', color: '#0f172a', fontFamily: 'monospace',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          {customVaultPath}
                        </span>
                        <span
                          onClick={() => { setUseCustomPath(false); setCustomVaultPath(''); }}
                          style={{
                            fontSize: '11px', color: '#6366f1', cursor: 'pointer',
                            flexShrink: 0, whiteSpace: 'nowrap'
                          }}
                        >
                          恢复默认
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '12px', color: '#64748b',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          {defaultVaultPath || '未配置归档目录'}
                        </span>
                        <span style={{
                          fontSize: '10px', color: '#94a3b8', background: '#f1f5f9',
                          padding: '1px 6px', borderRadius: '3px', flexShrink: 0
                        }}>
                          默认
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSelectCustomDir}
                    style={{
                      fontSize: '11px', color: '#6366f1', cursor: 'pointer',
                      padding: '4px 8px', borderRadius: '4px',
                      border: '1px solid #e0e7ff', background: '#f5f3ff',
                      whiteSpace: 'nowrap', flexShrink: 0, fontWeight: '500'
                    }}
                  >
                    选择文件夹
                  </button>
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                  可选择其他文件夹存放此次归档，不影响全局设置
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            归档记录将保存为 Markdown 文件
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px', borderRadius: '6px',
                border: '1px solid var(--border-color)', background: '#fff',
                color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', fontWeight: '500'
              }}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={aiStatus === 'loading' || !title.trim()}
              style={{
                padding: '8px 18px', borderRadius: '6px', border: 'none',
                background: (aiStatus === 'loading' || !title.trim()) ? '#b3e8cc' : 'var(--tag-green)',
                color: '#fff', fontSize: '13px',
                cursor: (aiStatus === 'loading' || !title.trim()) ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                boxShadow: (aiStatus === 'loading' || !title.trim()) ? 'none' : '0 2px 6px rgba(0, 185, 107, 0.3)'
              }}
            >
              {aiStatus === 'loading' ? 'AI 分析中...' : '确认归档'}
            </button>
          </div>
        </div>
      </div>

      {/* Pulse animation for AI loading */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

// 共用样式
const labelStyle = {
  fontSize: '12px', color: 'var(--text-secondary)',
  fontWeight: '500', marginBottom: '6px', display: 'block'
};

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: '8px',
  border: '1px solid #e2e8f0', fontSize: '13px',
  outline: 'none', background: '#fff', color: 'var(--text-primary)',
  transition: 'border-color 0.15s ease'
};
