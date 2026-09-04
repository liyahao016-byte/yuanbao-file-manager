import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

/**
 * ArchiveAIReportPanel — AI 报告面板
 * 三个 Tab：周报生成 / 项目总结 / 分析报告
 * 
 * 入口：归档时间线顶栏「AI 报告」按钮
 */
export default function ArchiveAIReportPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly' | 'project' | 'analysis'
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null); // { markdown, recordCount, totalMinutes }
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 项目总结 — 标签选择
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  // 分析报告 — 自定义筛选
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [analysisTags, setAnalysisTags] = useState([]);

  // 加载历史标签
  useEffect(() => {
    const loadTags = async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const tags = await invoke('query_history_tags').catch(() => []);
          setAllTags(tags || []);
        }
      } catch (err) {
        console.warn('Failed to load tags:', err);
      }
    };
    loadTags();
  }, []);

  // 初始化日期默认值
  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDateTo(today);
    setDateFrom(thirtyDaysAgo);
  }, []);

  // 生成周报
  const handleGenerateWeekly = useCallback(async () => {
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const result = await invoke('generate_weekly_report');
      setReport(result);
    } catch (err) {
      setError(typeof err === 'string' ? err : '生成周报失败，请确保 Ollama 服务已启动');
    }
    setLoading(false);
  }, []);

  // 生成项目总结
  const handleGenerateProject = useCallback(async () => {
    if (selectedTags.length === 0) {
      setError('请至少选择一个标签');
      return;
    }
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const result = await invoke('generate_project_summary', { tags: selectedTags });
      setReport(result);
    } catch (err) {
      setError(typeof err === 'string' ? err : '生成项目总结失败');
    }
    setLoading(false);
  }, [selectedTags]);

  // 生成分析报告
  const handleGenerateAnalysis = useCallback(async () => {
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const result = await invoke('generate_analysis_report', {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        tags: analysisTags.length > 0 ? analysisTags : null,
      });
      setReport(result);
    } catch (err) {
      setError(typeof err === 'string' ? err : '生成分析报告失败');
    }
    setLoading(false);
  }, [dateFrom, dateTo, analysisTags]);

  // 复制到剪贴板
  const handleCopy = useCallback(async () => {
    if (!report?.markdown) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = report.markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [report]);

  // 导出为 .md 文件
  const handleExport = useCallback(async () => {
    if (!report?.markdown) return;
    try {
      const defaultName = activeTab === 'weekly' ? '周报.md'
        : activeTab === 'project' ? '项目总结.md'
        : '分析报告.md';

      if (window.__TAURI_INTERNALS__) {
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: 'Markdown', extensions: ['md'] }],
        });
        if (filePath) {
          await invoke('write_text_file', { path: filePath, content: report.markdown });
          alert('导出成功: ' + filePath);
        }
      }
    } catch (err) {
      console.warn('Export failed:', err);
      alert('导出失败: ' + err);
    }
  }, [report, activeTab]);

  // 标签切换辅助
  const toggleTag = (tag, list, setList) => {
    setList(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // 切换 tab 时清除报告
  const switchTab = (tab) => {
    setActiveTab(tab);
    setReport(null);
    setError('');
  };

  const tabs = [
    { key: 'weekly', label: '周报生成', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z', color: '#10b981' },
    { key: 'project', label: '项目总结', icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2', color: '#6366f1' },
    { key: 'analysis', label: '分析报告', icon: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z', color: '#f59e0b' },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999,
    }} onClick={onClose}>
      <div
        style={{
          width: 900, maxHeight: '90vh', background: '#fff', borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <path d="M22 6l-10 7L2 6" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>AI 智能报告</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>基于归档数据，AI 自动生成结构化报告</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '16px 28px 0', borderBottom: '1px solid #f0f0f0' }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                  background: isActive ? '#f8fafc' : 'transparent',
                  border: isActive ? '1px solid #e5e7eb' : '1px solid transparent',
                  borderBottom: isActive ? '1px solid #f8fafc' : '1px solid transparent',
                  marginBottom: -1,
                  color: isActive ? tab.color : '#9ca3af',
                  fontWeight: isActive ? 600 : 400, fontSize: 13,
                  transition: 'all 0.15s',
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
          {/* 周报生成 Tab */}
          {activeTab === 'weekly' && (
            <div>
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
                padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#166534' }}>
                    📅 自动读取本周归档数据
                  </div>
                  <div style={{ fontSize: 12, color: '#4ade80', marginTop: 4 }}>
                    AI 将读取本周一到今天的所有归档记录，按项目分组生成结构化周报
                  </div>
                </div>
                <button
                  onClick={handleGenerateWeekly}
                  disabled={loading}
                  style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? '#9ca3af' : '#10b981', color: '#fff',
                    fontSize: 14, fontWeight: 600, flexShrink: 0, transition: 'all 0.2s',
                  }}
                >
                  {loading ? '生成中...' : '生成周报'}
                </button>
              </div>
            </div>
          )}

          {/* 项目总结 Tab */}
          {activeTab === 'project' && (
            <div>
              <div style={{
                background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10,
                padding: '14px 18px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#3730a3', marginBottom: 8 }}>
                  🏷️ 选择标签生成项目总结
                </div>
                <div style={{ fontSize: 12, color: '#818cf8', marginBottom: 12 }}>
                  选择一个或多个标签，AI 将整合所有包含该标签的归档记录生成项目汇总
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {allTags.map(tag => {
                    const isActive = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag, selectedTags, setSelectedTags)}
                        style={{
                          padding: '4px 12px', borderRadius: 14, fontSize: 12, cursor: 'pointer',
                          border: isActive ? '1px solid #6366f1' : '1px solid #d1d5db',
                          background: isActive ? '#6366f1' : '#fff',
                          color: isActive ? '#fff' : '#6b7280',
                          fontWeight: isActive ? 500 : 400, transition: 'all 0.15s',
                        }}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                  {allTags.length === 0 && (
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>暂无历史标签，请先归档一些工作记录</span>
                  )}
                </div>
                <button
                  onClick={handleGenerateProject}
                  disabled={loading || selectedTags.length === 0}
                  style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none',
                    cursor: loading || selectedTags.length === 0 ? 'not-allowed' : 'pointer',
                    background: loading || selectedTags.length === 0 ? '#9ca3af' : '#6366f1',
                    color: '#fff', fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                  }}
                >
                  {loading ? '生成中...' : `生成项目总结${selectedTags.length > 0 ? `（${selectedTags.length} 个标签）` : ''}`}
                </button>
              </div>
            </div>
          )}

          {/* 分析报告 Tab */}
          {activeTab === 'analysis' && (
            <div>
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
                padding: '14px 18px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#92400e', marginBottom: 8 }}>
                  📊 自定义范围深度分析
                </div>
                <div style={{ fontSize: 12, color: '#d97706', marginBottom: 14 }}>
                  选择时间范围和标签，AI 将分析时间分配模式、项目效率、高频卡点并给出优化建议
                </div>

                {/* 时间范围选择 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, width: 60 }}>时间范围</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    style={{
                      padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                      fontSize: 12, color: '#374151', outline: 'none',
                    }}
                  />
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>至</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    style={{
                      padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                      fontSize: 12, color: '#374151', outline: 'none',
                    }}
                  />
                  {/* 快捷按钮 */}
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                    {[
                      { label: '本周', fn: () => {
                        const now = new Date();
                        const monday = new Date(now);
                        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
                        setDateFrom(monday.toISOString().split('T')[0]);
                        setDateTo(now.toISOString().split('T')[0]);
                      }},
                      { label: '本月', fn: () => {
                        const now = new Date();
                        setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
                        setDateTo(now.toISOString().split('T')[0]);
                      }},
                      { label: '近3月', fn: () => {
                        const now = new Date();
                        setDateFrom(new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                        setDateTo(now.toISOString().split('T')[0]);
                      }},
                    ].map(({ label, fn }) => (
                      <button
                        key={label}
                        onClick={fn}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                          border: '1px solid #d1d5db', background: '#fff', color: '#6b7280',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 标签过滤（可选） */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, width: 60, marginTop: 5 }}>标签筛选</span>
                  <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {allTags.map(tag => {
                      const isActive = analysisTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag, analysisTags, setAnalysisTags)}
                          style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                            border: isActive ? '1px solid #f59e0b' : '1px solid #d1d5db',
                            background: isActive ? '#fef3c7' : '#fff',
                            color: isActive ? '#92400e' : '#6b7280',
                            fontWeight: isActive ? 500 : 400, transition: 'all 0.15s',
                          }}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                    {analysisTags.length > 0 && (
                      <button
                        onClick={() => setAnalysisTags([])}
                        style={{
                          padding: '3px 8px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                          border: '1px solid #d1d5db', background: '#fff', color: '#9ca3af',
                        }}
                      >
                        清除
                      </button>
                    )}
                    <span style={{ fontSize: 11, color: '#9ca3af', lineHeight: '24px' }}>
                      {analysisTags.length === 0 ? '（不选则分析全部数据）' : `已选 ${analysisTags.length} 个`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleGenerateAnalysis}
                  disabled={loading}
                  style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? '#9ca3af' : '#f59e0b',
                    color: '#fff', fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                  }}
                >
                  {loading ? '分析中...' : '生成分析报告'}
                </button>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#dc2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          {/* 加载动画 */}
          {loading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '60px 0', color: '#6b7280',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: '3px solid #e5e7eb', borderTopColor: '#6366f1',
                animation: 'spin 1s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 16 }}>
                AI 正在分析归档数据并生成报告...
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                这可能需要 30-60 秒，请耐心等待
              </div>
            </div>
          )}

          {/* 报告输出 */}
          {report && !loading && (
            <div>
              {/* 统计信息 */}
              <div style={{
                display: 'flex', gap: 16, marginBottom: 16,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280',
                  background: '#f9fafb', padding: '6px 12px', borderRadius: 8,
                }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  分析了 <strong>{report.recordCount}</strong> 条归档记录
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280',
                  background: '#f9fafb', padding: '6px 12px', borderRadius: 8,
                }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6366f1" strokeWidth="2">
                    <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  累计 <strong>{(report.totalMinutes / 60).toFixed(1)}</strong> 小时
                </div>

                {/* 操作按钮 */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleCopy}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db',
                      background: copied ? '#ecfdf5' : '#fff', color: copied ? '#059669' : '#374151',
                      fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                      {copied ? (
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <>
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </>
                      )}
                    </svg>
                    {copied ? '已复制' : '复制'}
                  </button>
                  <button
                    onClick={handleExport}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db',
                      background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 15V3" strokeLinecap="round" />
                    </svg>
                    导出 .md
                  </button>
                </div>
              </div>

              {/* Markdown 渲染区域 */}
              <div
                style={{
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                  padding: '24px 28px', lineHeight: 1.8, fontSize: 14, color: '#374151',
                  maxHeight: '50vh', overflow: 'auto',
                }}
                className="markdown-report"
              >
                <MarkdownRenderer content={report.markdown} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 简易 Markdown 渲染器
 * 支持 h1-h6、列表、粗体、表格、引用块、行内代码
 */
function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 表格检测
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|[\s-|]+\|$/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(renderTable(tableLines, elements.length));
      continue;
    }

    // 标题
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '24px 0 12px', borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '20px 0 10px' }}>{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '16px 0 8px' }}>{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('#### ')) {
      elements.push(<h4 key={i} style={{ fontSize: 14, fontWeight: 600, color: '#4b5563', margin: '12px 0 6px' }}>{renderInline(line.slice(5))}</h4>);
    }
    // 引用块
    else if (line.startsWith('> ')) {
      elements.push(
        <div key={i} style={{
          borderLeft: '3px solid #6366f1', paddingLeft: 14, margin: '10px 0',
          color: '#6b7280', fontStyle: 'italic', fontSize: 13,
        }}>
          {renderInline(line.slice(2))}
        </div>
      );
    }
    // 无序列表
    else if (line.match(/^[-*] /)) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0', paddingLeft: 8 }}>
          <span style={{ color: '#10b981', flexShrink: 0 }}>•</span>
          <span>{renderInline(line.replace(/^[-*] /, ''))}</span>
        </div>
      );
    }
    // 缩进列表
    else if (line.match(/^\s{2,}[-*] /)) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 28 }}>
          <span style={{ color: '#9ca3af', flexShrink: 0 }}>◦</span>
          <span style={{ fontSize: 13 }}>{renderInline(line.replace(/^\s+[-*] /, ''))}</span>
        </div>
      );
    }
    // 有序列表
    else if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\./)[1];
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0', paddingLeft: 8 }}>
          <span style={{ color: '#6366f1', fontWeight: 600, flexShrink: 0, minWidth: 18 }}>{num}.</span>
          <span>{renderInline(line.replace(/^\d+\. /, ''))}</span>
        </div>
      );
    }
    // 分隔线
    else if (line.match(/^[-*_]{3,}$/)) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />);
    }
    // 空行
    else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 8 }} />);
    }
    // 普通段落
    else {
      elements.push(<p key={i} style={{ margin: '6px 0' }}>{renderInline(line)}</p>);
    }

    i++;
  }

  return <>{elements}</>;
}

/** 行内 Markdown 渲染：**粗体**、`代码`、emoji */
function renderInline(text) {
  if (!text) return text;
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 粗体
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // 行内代码
    const codeMatch = remaining.match(/`(.+?)`/);

    const matches = [
      boldMatch && { idx: remaining.indexOf(boldMatch[0]), match: boldMatch, type: 'bold' },
      codeMatch && { idx: remaining.indexOf(codeMatch[0]), match: codeMatch, type: 'code' },
    ].filter(Boolean).sort((a, b) => a.idx - b.idx);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0];
    if (first.idx > 0) {
      parts.push(remaining.slice(0, first.idx));
    }

    if (first.type === 'bold') {
      parts.push(<strong key={keyIdx++} style={{ fontWeight: 600, color: '#111827' }}>{first.match[1]}</strong>);
    } else if (first.type === 'code') {
      parts.push(
        <code key={keyIdx++} style={{
          background: '#f3f4f6', padding: '1px 5px', borderRadius: 4,
          fontSize: '0.9em', color: '#dc2626', fontFamily: 'monospace',
        }}>
          {first.match[1]}
        </code>
      );
    }

    remaining = remaining.slice(first.idx + first.match[0].length);
  }

  return parts;
}

/** 表格渲染 */
function renderTable(tableLines, baseKey) {
  if (tableLines.length < 2) return null;

  const parseRow = (line) => line.split('|').slice(1, -1).map(cell => cell.trim());
  const headers = parseRow(tableLines[0]);
  const rows = tableLines.slice(2).map(parseRow);

  return (
    <div key={baseKey} style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, j) => (
              <th key={j} style={{
                padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151',
                borderBottom: '2px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap',
              }}>{renderInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '6px 12px', borderBottom: '1px solid #f0f0f0', color: '#6b7280',
                }}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
