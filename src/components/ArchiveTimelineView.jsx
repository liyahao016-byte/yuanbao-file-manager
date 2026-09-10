import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

/**
 * ArchiveTimelineView — 归档时间线视图
 * 导航入口：侧边栏「知识归档」
 * 
 * 功能：
 * 1. 按日期倒序展示已归档的知识卡片
 * 2. 搜索框 + 标签筛选 + 优先级筛选
 * 3. 每张卡片可展开查看完整内容
 * 4. 空状态引导用户进行首次归档
 * 5. 本周/本月统计摘要卡片
 * 
 * 数据来源：Tauri invoke query_archives
 */

// ── Mock 数据已移除，数据库为空时展示空状态引导 ──────────────

// ── 优先级颜色映射 ──────────────────────────────────────
const priorityColors = {
  P0: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  P1: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  P2: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
};

// ── 格式化日期 ──────────────────────────────────────────
function formatDateLabel(dateStr) {
  const today = new Date();
  const date = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
  
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayLabel = weekDays[date.getDay()];
  
  if (diffDays === 0) return `今天 · ${dayLabel}`;
  if (diffDays === 1) return `昨天 · ${dayLabel}`;
  if (diffDays === 2) return `前天 · ${dayLabel}`;
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日 · ${dayLabel}`;
}

// ── 统计辅助函数 ────────────────────────────────────────
function computeStats(archives) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // 本周一
  weekStart.setHours(0, 0, 0, 0);
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const weekArchives = archives.filter(a => new Date(a.date + 'T00:00:00') >= weekStart);
  const monthArchives = archives.filter(a => new Date(a.date + 'T00:00:00') >= monthStart);
  
  return {
    weekCount: weekArchives.length,
    weekMinutes: weekArchives.reduce((sum, a) => sum + (a.durationMin || 0), 0),
    monthCount: monthArchives.length,
    monthMinutes: monthArchives.reduce((sum, a) => sum + (a.durationMin || 0), 0),
    totalCount: archives.length,
    allTags: [...new Set(archives.flatMap(a => a.tags || []))],
    allProjects: [...new Set(archives.map(a => a.project).filter(Boolean))],
  };
}

// ── 主组件 ──────────────────────────────────────────────
export default function ArchiveTimelineView({ onOpenArchiveModal, onPreviewFile, onOpenAIReport }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState('');
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [hoveredCard, setHoveredCard] = useState(null);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingArchive, setEditingArchive] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [saving, setSaving] = useState(false);

  // 加载归档数据（Tauri → 真实数据，浏览器 → 空列表）
  const loadArchives = useCallback(async () => {
    setLoading(true);
    try {
      if (window.__TAURI_INTERNALS__) {
        const result = await invoke('query_archives', {
          dateFrom: null, dateTo: null, project: null,
          priority: null, tag: null, search: null,
        });
        if (result && result.entries) {
          const normalized = result.entries.map(e => ({
            ...e,
            tags: e.tags || [],
            linkedFiles: e.linkedFiles || [],
            durationMin: e.durationMin || 0,
          }));
          setArchives(normalized);
        } else {
          setArchives([]);
        }
      } else {
        // 浏览器环境：展示空状态，不使用假数据
        setArchives([]);
      }
    } catch (err) {
      console.warn('query_archives failed:', err);
      setArchives([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadArchives(); }, [loadArchives]);
  
  // 计算统计数据
  const stats = useMemo(() => computeStats(archives), [archives]);
  
  // 过滤归档列表
  const filteredArchives = useMemo(() => {
    return archives.filter(archive => {
      // 搜索过滤
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (archive.title || '').toLowerCase().includes(q);
        const matchOutput = (archive.output || '').toLowerCase().includes(q);
        const matchProject = (archive.project || '').toLowerCase().includes(q);
        const archiveTags = archive.tags || [];
        const matchTags = archiveTags.some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchOutput && !matchProject && !matchTags) return false;
      }
      // 标签过滤
      if (selectedTags.length > 0) {
        const archiveTags = archive.tags || [];
        if (!selectedTags.some(tag => archiveTags.includes(tag))) return false;
      }
      // 优先级过滤
      if (selectedPriority && archive.priority !== selectedPriority) return false;
      return true;
    });
  }, [archives, searchQuery, selectedTags, selectedPriority]);
  
  // 按日期分组
  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredArchives.forEach(archive => {
      if (!groups[archive.date]) {
        groups[archive.date] = [];
      }
      groups[archive.date].push(archive);
    });
    // 日期倒序，每日内按时间倒序
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => b.time.localeCompare(a.time)),
      }));
  }, [filteredArchives]);
  
  const toggleExpand = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // ── 编辑归档 ──────────────────────────────────────
  const handleStartEdit = (archive, e) => {
    e.stopPropagation();
    setEditingArchive(archive.id);
    setEditForm({
      title: archive.title || '',
      project: archive.project || '',
      priority: archive.priority || '',
      durationMin: archive.durationMin || 0,
      output: archive.output || '',
      blocker: archive.blocker || '',
      nextAction: archive.nextAction || '',
      tags: (archive.tags || []).join(', '),
    });
    // 确保卡片展开
    setExpandedCards(prev => new Set(prev).add(archive.id));
  };

  const handleCancelEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingArchive(null);
    setEditForm({});
  };

  const handleSaveEdit = async (archiveId, e) => {
    if (e) e.stopPropagation();
    setSaving(true);
    try {
      const tagsArr = editForm.tags
        ? editForm.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
        : [];
      await invoke('update_archive', {
        archiveId,
        title: editForm.title || null,
        project: editForm.project || null,
        priority: editForm.priority || null,
        durationMin: editForm.durationMin ? parseInt(editForm.durationMin, 10) : null,
        output: editForm.output || null,
        blocker: editForm.blocker || null,
        nextAction: editForm.nextAction || null,
        tags: tagsArr.length > 0 ? tagsArr : null,
      });
      setEditingArchive(null);
      setEditForm({});
      loadArchives(); // 刷新数据
    } catch (err) {
      console.error('更新归档失败:', err);
      alert('更新失败: ' + (typeof err === 'string' ? err : JSON.stringify(err)));
    } finally {
      setSaving(false);
    }
  };

  // ── 删除归档 ──────────────────────────────────────
  const handleDeleteArchive = async (archiveId, e) => {
    if (e) e.stopPropagation();
    setSaving(true);
    try {
      await invoke('delete_archive', { archiveId });
      setDeleteConfirmId(null);
      loadArchives(); // 刷新数据
    } catch (err) {
      console.error('删除归档失败:', err);
      alert('删除失败: ' + (typeof err === 'string' ? err : JSON.stringify(err)));
    } finally {
      setSaving(false);
    }
  };
  
  // ── 空状态 ──────────────────────────────────────────
  if (!loading && archives.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', color: '#6b7280' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#9ca3af" strokeWidth="1.5">
            <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>还没有归档记录</div>
        <div style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6, maxWidth: 360 }}>
          完成一项工作后，通过智能文件夹的「归档本簇」或侧边栏的「快速归档」记录你的产出，构建个人知识时间线。
        </div>
        {onOpenArchiveModal && (
          <button
            onClick={onOpenArchiveModal}
            style={{
              marginTop: 24, padding: '10px 24px', background: '#10b981', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#059669'}
            onMouseOut={e => e.currentTarget.style.background = '#10b981'}
          >
            开始第一次归档
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#fafbfc', padding: '24px 32px' }}>
      
      {/* ── 顶部标题栏 ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>知识归档时间线</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              共 {stats.totalCount} 条归档 · 本周 {stats.weekCount} 条 · {Math.round(stats.weekMinutes / 60 * 10) / 10}h
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
          {onOpenAIReport && (
            <button
              onClick={onOpenAIReport}
              style={{
                padding: '8px 16px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
              </svg>
              AI 报告
            </button>
          )}
        
          {onOpenArchiveModal && (
            <button
              onClick={onOpenArchiveModal}
              style={{
                padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#059669'}
              onMouseOut={e => e.currentTarget.style.background = '#10b981'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" />
              </svg>
              新建归档
            </button>
          )}
        </div>
      </div>
      
      {/* ── 统计摘要卡片（紧凑版） ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: '本周归档', value: stats.weekCount, unit: '条', color: '#10b981', icon: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
          { label: '本周投入', value: `${(stats.weekMinutes / 60).toFixed(1)}`, unit: 'h', color: '#6366f1', icon: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
          { label: '本月归档', value: stats.monthCount, unit: '条', color: '#f59e0b', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z' },
          { label: '关联文件', value: archives.reduce((sum, a) => sum + (a.linkedFiles?.length || 0), 0), unit: '个', color: '#ec4899', icon: 'M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1' },
        ].map(({ label, value, unit, color, icon }) => (
          <div key={label} style={{
            background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${color}12`,
            }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                {value}<span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 2 }}>{unit}</span>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>
      
      {/* ── 搜索 + 筛选栏 ─────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #f0f0f0', marginBottom: 12 }}>
        {/* 搜索框 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb',
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索归档标题、产出、标签..."
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13, color: '#374151',
              }}
            />
            {searchQuery && (
              <span
                onClick={() => setSearchQuery('')}
                style={{ cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1 }}
              >
                &times;
              </span>
            )}
          </div>
          
          {/* 优先级筛选 */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['P0', 'P1', 'P2'].map(p => {
              const isActive = selectedPriority === p;
              const colors = priorityColors[p];
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(isActive ? '' : p)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: `1px solid ${isActive ? colors.border : '#e5e7eb'}`,
                    background: isActive ? colors.bg : '#fff',
                    color: isActive ? colors.text : '#9ca3af',
                    transition: 'all 0.15s',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* 标签筛选 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 4 }}>标签：</span>
          {stats.allTags.map(tag => {
            const isActive = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                  border: isActive ? '1px solid #10b981' : '1px solid #e5e7eb',
                  background: isActive ? '#ecfdf5' : '#f9fafb',
                  color: isActive ? '#059669' : '#6b7280',
                  fontWeight: isActive ? 500 : 400,
                  transition: 'all 0.15s',
                }}
              >
                #{tag}
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              style={{
                padding: '3px 8px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af',
              }}
            >
              清除
            </button>
          )}
        </div>
      </div>
      
      {/* ── 搜索结果提示 ─────────────────────────────── */}
      {(searchQuery || selectedTags.length > 0 || selectedPriority) && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12, paddingLeft: 4 }}>
          找到 {filteredArchives.length} 条归档记录
          {filteredArchives.length === 0 && <span> — 试试调整筛选条件</span>}
        </div>
      )}
      
      {/* ── 时间线主体 ─────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        {/* 时间线竖线 */}
        <div style={{
          position: 'absolute', left: 19, top: 0, bottom: 0, width: 2,
          background: 'linear-gradient(180deg, #10b981 0%, #e5e7eb 30%, #e5e7eb 100%)',
          borderRadius: 1,
        }} />
        
        {groupedByDate.map(({ date, items }, groupIdx) => (
          <div key={date} style={{ marginBottom: 28 }}>
            {/* 日期分隔头 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, position: 'relative',
            }}>
              {/* 时间线圆点 */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: groupIdx === 0 ? '#10b981' : '#e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid #fafbfc', zIndex: 1,
              }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={groupIdx === 0 ? '#fff' : '#9ca3af'} strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: groupIdx === 0 ? '#111827' : '#6b7280',
              }}>
                {formatDateLabel(date)}
              </div>
              <div style={{
                fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 10,
              }}>
                {items.length} 条
              </div>
            </div>
            
            {/* 当日卡片列表 */}
            <div style={{ marginLeft: 56, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(archive => {
                const isExpanded = expandedCards.has(archive.id);
                const isHovered = hoveredCard === archive.id;
                const pColor = priorityColors[archive.priority] || priorityColors.P2;
                
                return (
                  <div
                    key={archive.id}
                    onMouseEnter={() => setHoveredCard(archive.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      background: '#fff', borderRadius: 12, padding: '16px 20px',
                      border: `1px solid ${isHovered ? '#d1d5db' : '#f0f0f0'}`,
                      boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease', cursor: 'pointer',
                    }}
                    onClick={() => toggleExpand(archive.id)}
                  >
                    {/* 卡片头部 */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{archive.time}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                            background: pColor.bg, color: pColor.text, border: `1px solid ${pColor.border}`,
                          }}>
                            {archive.priority}
                          </span>
                          {archive.project && (
                            <span style={{
                              fontSize: 11, color: '#6366f1', background: '#eef2ff', padding: '1px 8px',
                              borderRadius: 4, border: '1px solid #e0e7ff',
                            }}>
                              {archive.project}
                            </span>
                          )}
                          {archive.durationMin > 0 && (
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>
                              ⏱ {archive.durationMin >= 60 ? `${(archive.durationMin / 60).toFixed(1)}h` : `${archive.durationMin}min`}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>
                          ✅ {archive.title}
                        </div>
                      </div>
                      
                      {/* 操作按钮（hover 时显示） + 展开/收起箭头 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {/* 编辑按钮 */}
                        {isHovered && editingArchive !== archive.id && (
                          <button
                            title="编辑此归档"
                            onClick={(e) => handleStartEdit(archive, e)}
                            style={{
                              width: 28, height: 28, borderRadius: 6, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              background: '#f0f4ff', border: '1px solid #c7d2fe',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#e0e7ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f0f4ff'; }}
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {/* 删除按钮 */}
                        {isHovered && editingArchive !== archive.id && (
                          <button
                            title="删除此归档"
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(archive.id); }}
                            style={{
                              width: 28, height: 28, borderRadius: 6, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              background: '#fef2f2', border: '1px solid #fecaca',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      
                      {/* 展开/收起箭头 */}
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: isHovered ? '#f3f4f6' : 'transparent',
                        transition: 'all 0.15s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#9ca3af" strokeWidth="2">
                          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      </div>
                    </div>
                    
                    {/* 产出摘要（始终显示） */}
                    <div style={{
                      fontSize: 13, color: '#6b7280', marginTop: 8, lineHeight: 1.5,
                      overflow: isExpanded ? 'visible' : 'hidden',
                      maxHeight: isExpanded ? 'none' : '20px',
                      textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap',
                    }}>
                      {archive.output}
                    </div>
                    
                    {/* 展开后的详细内容 */}
                    {isExpanded && (
                      <div style={{
                        marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        {archive.blocker && (
                          <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                            <span style={{ color: '#ef4444', fontWeight: 500, flexShrink: 0 }}>🚧 卡点：</span>
                            <span style={{ color: '#6b7280' }}>{archive.blocker}</span>
                          </div>
                        )}
                        {archive.nextAction && (
                          <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                            <span style={{ color: '#3b82f6', fontWeight: 500, flexShrink: 0 }}>➡️ 下一步：</span>
                            <span style={{ color: '#6b7280' }}>{archive.nextAction}</span>
                          </div>
                        )}
                        {archive.linkedFiles && archive.linkedFiles.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                              📎 附件（双击卡片直接打开文件）
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {archive.linkedFiles.map((filePath, i) => {
                                const fileName = filePath.split('/').pop() || filePath;
                                const ext = fileName.split('.').pop()?.toLowerCase() || '';
                                const previewable = ['png','jpg','jpeg','gif','webp','bmp','svg','txt','md','pdf','docx','xlsx','pptx','csv'].includes(ext);
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: 12, padding: '6px 10px', borderRadius: 8,
                                      background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151',
                                      display: 'flex', alignItems: 'center', gap: 8,
                                      transition: 'all 0.15s', cursor: 'pointer', userSelect: 'none',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
                                        invoke('open_file_in_default_app', { path: filePath }).catch(err => {
                                          alert('打开文件失败: ' + err);
                                        });
                                      } else {
                                        alert('【Web模式】双击打开文件:\n' + filePath);
                                      }
                                    }}
                                    title={`双击：使用默认程序打开文件\n点击右侧[定位]：在文件管理器中定位选中\n路径：${filePath}`}
                                  >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#6366f1" strokeWidth="2" style={{ flexShrink: 0 }}>
                                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                      <path d="M13 2v7h7" />
                                    </svg>
                                    <span
                                      style={{
                                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        color: '#4f46e5', fontWeight: 500,
                                      }}
                                    >
                                      {fileName}
                                    </span>
                                    {/* 预览按钮 */}
                                    {previewable && onPreviewFile && (
                                      <button
                                        title="预览文件"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onPreviewFile({ name: fileName, path: filePath });
                                        }}
                                        style={{
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          padding: '2px 8px', borderRadius: 4, border: '1px solid #c7d2fe',
                                          background: '#eef2ff', color: '#4338ca', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                                          transition: 'all 0.15s', fontWeight: 500,
                                        }}
                                      >
                                        预览
                                      </button>
                                    )}
                                    {/* 定位按钮 */}
                                    <button
                                      title="在 Finder / 文件管理器中定位此文件"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
                                          invoke('show_in_folder', { path: filePath }).catch(err => {
                                            alert('定位失败: ' + err);
                                          });
                                        } else {
                                          alert('【Web模式】已定位文件路径:\n' + filePath);
                                        }
                                      }}
                                      style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '2px 8px', borderRadius: 4, border: '1px solid #d1d5db',
                                        background: '#fff', color: '#374151', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                                        transition: 'all 0.15s', fontWeight: 500,
                                      }}
                                    >
                                      定位
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── 编辑表单（内联） ──────────────── */}
                        {editingArchive === archive.id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              marginTop: 12, padding: '14px 16px', background: '#f8faff',
                              borderRadius: 10, border: '1px solid #c7d2fe',
                              display: 'flex', flexDirection: 'column', gap: 10,
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5', marginBottom: 2 }}>
                              ✏️ 编辑归档
                            </div>
                            <div>
                              <label style={editLabelStyle}>标题</label>
                              <input
                                value={editForm.title || ''}
                                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                style={editInputStyle}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <label style={editLabelStyle}>项目</label>
                                <input
                                  value={editForm.project || ''}
                                  onChange={e => setEditForm(f => ({ ...f, project: e.target.value }))}
                                  style={editInputStyle}
                                />
                              </div>
                              <div style={{ width: 80 }}>
                                <label style={editLabelStyle}>优先级</label>
                                <select
                                  value={editForm.priority || ''}
                                  onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                                  style={{ ...editInputStyle, cursor: 'pointer' }}
                                >
                                  <option value="">-</option>
                                  <option value="P0">P0</option>
                                  <option value="P1">P1</option>
                                  <option value="P2">P2</option>
                                </select>
                              </div>
                              <div style={{ width: 90 }}>
                                <label style={editLabelStyle}>耗时(min)</label>
                                <input
                                  type="number" min="0" step="30"
                                  value={editForm.durationMin || ''}
                                  onChange={e => setEditForm(f => ({ ...f, durationMin: e.target.value }))}
                                  style={editInputStyle}
                                />
                              </div>
                            </div>
                            <div>
                              <label style={editLabelStyle}>关键产出</label>
                              <textarea
                                value={editForm.output || ''}
                                onChange={e => setEditForm(f => ({ ...f, output: e.target.value }))}
                                rows={3}
                                style={{ ...editInputStyle, resize: 'vertical', lineHeight: 1.5 }}
                              />
                            </div>
                            <div>
                              <label style={editLabelStyle}>卡点</label>
                              <input
                                value={editForm.blocker || ''}
                                onChange={e => setEditForm(f => ({ ...f, blocker: e.target.value }))}
                                style={editInputStyle}
                              />
                            </div>
                            <div>
                              <label style={editLabelStyle}>下一步</label>
                              <input
                                value={editForm.nextAction || ''}
                                onChange={e => setEditForm(f => ({ ...f, nextAction: e.target.value }))}
                                style={editInputStyle}
                              />
                            </div>
                            <div>
                              <label style={editLabelStyle}>标签 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（逗号分隔）</span></label>
                              <input
                                value={editForm.tags || ''}
                                onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))}
                                placeholder="标签1, 标签2, ..."
                                style={editInputStyle}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                              <button
                                onClick={handleCancelEdit}
                                disabled={saving}
                                style={{
                                  padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                                  border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
                                  cursor: 'pointer',
                                }}
                              >
                                取消
                              </button>
                              <button
                                onClick={(e) => handleSaveEdit(archive.id, e)}
                                disabled={saving || !editForm.title?.trim()}
                                style={{
                                  padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                                  border: 'none', background: saving ? '#a5b4fc' : '#4f46e5', color: '#fff',
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {saving ? '保存中...' : '保存修改'}
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                    
                    {/* ── 删除确认（不依赖展开状态，点删除按钮即显示） ── */}
                    {deleteConfirmId === archive.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          marginTop: 12, padding: '12px 16px', background: '#fef2f2',
                          borderRadius: 10, border: '1px solid #fecaca',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          ⚠️ 确认删除此归档？
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            disabled={saving}
                            style={{
                              padding: '5px 14px', borderRadius: 6, fontSize: 12,
                              border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
                              cursor: 'pointer', fontWeight: 500,
                            }}
                          >
                            取消
                          </button>
                          <button
                            onClick={(e) => handleDeleteArchive(archive.id, e)}
                            disabled={saving}
                            style={{
                              padding: '5px 14px', borderRadius: 6, fontSize: 12,
                              border: 'none', background: saving ? '#fca5a5' : '#dc2626', color: '#fff',
                              cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500,
                            }}
                          >
                            {saving ? '删除中...' : '确认删除'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 标签行（始终显示） */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {(archive.tags || []).map(tag => (
                        <span
                          key={tag}
                          onClick={e => { e.stopPropagation(); toggleTag(tag); }}
                          style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 10,
                            background: selectedTags.includes(tag) ? '#ecfdf5' : '#f3f4f6',
                            color: selectedTags.includes(tag) ? '#059669' : '#6b7280',
                            border: selectedTags.includes(tag) ? '1px solid #a7f3d0' : '1px solid transparent',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                      {!isExpanded && archive.linkedFiles?.length > 0 && (
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                          📎 {archive.linkedFiles.length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* 时间线底部 */}
        {groupedByDate.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '3px solid #fafbfc', zIndex: 1,
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#d1d5db" strokeWidth="2">
                <path d="M5 12h14M12 5v14" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontSize: 12, color: '#d1d5db' }}>更早的归档记录</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 编辑表单样式常量 ────────────────────────────
const editLabelStyle = {
  fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 4, display: 'block',
};

const editInputStyle = {
  width: '100%', padding: '6px 10px', borderRadius: 6,
  border: '1px solid #e2e8f0', fontSize: 12,
  outline: 'none', background: '#fff', color: '#374151',
  transition: 'border-color 0.15s ease',
};
