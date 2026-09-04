import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import DemandDetailPanel from './DemandDetailPanel';

/**
 * DemandKanbanView — 产品需求看板
 *
 * 两种显示模式：
 *  1. 全屏看板模式（未选中需求）：四列拖拽 + 统计卡片 + 搜索/筛选 + 新建弹窗
 *  2. 详情聚焦模式（选中某个需求）：看板缩为左侧侧边栏（单列紧凑卡片），需求详情占据主区域
 *     详情面板头部提供"← 返回"按钮，回到全屏看板模式。
 *
 *  v3 改动
 *  - 框架改版：详情占据主区域，看板缩回侧边栏
 *  - 详情面板头部"返回"按钮
 *  - 看板侧边栏模式下：按状态分组展示紧凑卡片（保留搜索/优先级筛选/新建入口）
 */

// ── 常量 ──────────────────────────────────────────────
const STATUS_COLUMNS = [
  { key: 'planning', label: '规划中', icon: '💡', color: '#8b5cf6', bg: '#faf9ff', borderColor: '#ede9fe', accentGrad: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', emptyText: '暂无规划需求', emptyIcon: '🗂' },
  { key: 'active',   label: '进行中', icon: '🚀', color: '#3b82f6', bg: '#f8faff', borderColor: '#dbeafe', accentGrad: 'linear-gradient(135deg, #60a5fa, #3b82f6)', emptyText: '暂无进行中需求', emptyIcon: '🏃' },
  { key: 'hold',     label: 'Hold',    icon: '⏸', color: '#f59e0b', bg: '#fffdf7', borderColor: '#fef3c7', accentGrad: 'linear-gradient(135deg, #fbbf24, #f59e0b)', emptyText: '暂无暂停需求', emptyIcon: '☕' },
  { key: 'done',     label: '已完成', icon: '✅', color: '#10b981', bg: '#f8fdfb', borderColor: '#d1fae5', accentGrad: 'linear-gradient(135deg, #34d399, #10b981)', emptyText: '暂无完成需求', emptyIcon: '🎉' },
];

const PHASES = ['需求调研', '方案设计', '评审排期', '开发联调', '测试验收', '灰度上线', '全量上线'];
const PHASE_INDEX = Object.fromEntries(PHASES.map((p, i) => [p, i]));
const PRIORITIES = ['P0', 'P1', 'P2'];

// 进度→看板状态映射：需求调研→规划中，全量上线→已完成，其余→进行中
const phaseToStatus = (phase) => {
  if (!phase) return 'planning';
  if (phase === '需求调研') return 'planning';
  if (phase === '全量上线') return 'done';
  return 'active';
};

const priorityStyles = {
  P0: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', glow: 'rgba(220,38,38,0.10)' },
  P1: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', glow: 'rgba(217,119,6,0.08)' },
  P2: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', glow: 'rgba(22,163,74,0.06)' },
};

// ── 主组件 ──────────────────────────────────────────
export default function DemandKanbanView({
  onOpenArchiveModal,
  refreshKey,
}) {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDemandId, setSelectedDemandId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false); // 顶部统一新建弹窗
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('P1');
  const [newPhase, setNewPhase] = useState('');
  const [newStatus, setNewStatus] = useState('planning');
  const [dragItem, setDragItem] = useState(null);
  const [filterPriority, setFilterPriority] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  // todo 侧栏已重构为右侧常驻 C 区（与 A 状态速览 / B 推进时间线并列），不再需要 visible 控制

  // ── 数据加载 ──
  const loadDemands = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke('query_demands', {
        status: null,
        search: searchQuery || null,
      });
      setDemands(data);
    } catch (e) {
      console.error('Failed to load demands:', e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { loadDemands(); }, [loadDemands, refreshKey]);

  // ── 按状态分组 ──
  const groupedDemands = useMemo(() => {
    const groups = {};
    STATUS_COLUMNS.forEach(col => { groups[col.key] = []; });
    demands.forEach(d => {
      const key = d.status || 'planning';
      if (groups[key]) {
        if (!filterPriority || d.priority === filterPriority) {
          groups[key].push(d);
        }
      }
    });
    return groups;
  }, [demands, filterPriority]);

  // ── 统计 ──
  const stats = useMemo(() => {
    return {
      total: demands.length,
      active: demands.filter(d => d.status === 'active').length,
      hasBlocker: demands.filter(d => d.blocker && d.blocker.trim()).length,
      done: demands.filter(d => d.status === 'done').length,
    };
  }, [demands]);

  // ── 新建需求 ──
  const handleCreateDemand = async () => {
    if (!newTitle.trim()) return;
    let finalStatus = newStatus;
    if (newPhase && newStatus !== 'hold') {
      finalStatus = phaseToStatus(newPhase);
    }
    try {
      await invoke('create_demand', {
        input: {
          title: newTitle.trim(),
          status: finalStatus,
          priority: newPriority,
          phase: newPhase || null,
        }
      });
      setNewTitle('');
      setNewPriority('P1');
      setNewPhase('');
      setNewStatus('planning');
      setShowNewForm(false);
      loadDemands();
    } catch (e) {
      console.error('Create demand failed:', e);
    }
  };

  // ── 拖拽（全屏看板模式用） ──
  const handleDragStart = (e, demand) => {
    setDragItem(demand);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', demand.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (!dragItem || dragItem.status === targetStatus) {
      setDragItem(null);
      return;
    }
    try {
      const update = { id: dragItem.id, status: targetStatus };
      if (targetStatus === 'planning' && dragItem.phase !== '需求调研') {
        update.phase = '需求调研';
      } else if (targetStatus === 'done') {
        update.phase = '全量上线';
      }
      if (targetStatus === 'active') {
        if (!dragItem.phase || dragItem.phase === '需求调研' || dragItem.phase === '全量上线') {
          update.phase = '方案设计';
        }
      }
      await invoke('update_demand', { input: update });
      loadDemands();
    } catch (err) {
      console.error('Update demand status failed:', err);
    }
    setDragItem(null);
  };

  // ── 选中/关闭详情 ──
  const openDetail = (demandId) => {
    setSelectedDemandId(demandId);
  };

  const closeDetail = () => {
    setSelectedDemandId(null);
  };

  // 当选中的 demand 已不存在（如删除），自动关闭
  useEffect(() => {
    if (selectedDemandId && !demands.find(d => d.id === selectedDemandId)) {
      setSelectedDemandId(null);
    }
  }, [demands, selectedDemandId]);

  const selectedDemand = demands.find(d => d.id === selectedDemandId) || null;
  const isCompact = !!selectedDemand;

  // todo 侧栏已重构为右侧常驻 C 区，不再有"自动展开"等 useEffect

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f8f9fb' }}>
      {isCompact ? (
          <CompactSidebar
            demands={demands}
            groupedDemands={groupedDemands}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchFocused={searchFocused}
            setSearchFocused={setSearchFocused}
            filterPriority={filterPriority}
            setFilterPriority={setFilterPriority}
            selectedDemandId={selectedDemandId}
            onSelect={openDetail}
            onNewDemand={() => setShowNewForm(true)}
            onBackToFull={() => closeDetail()}
          />
        ) : (
          // flex:1 1 0% + minWidth:0 —— 窗口宽度扩展时，本区域吸收全部新增宽度（todo 区固定不变）
          <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* ── 顶部栏 ── */}
            <div style={{
              padding: '20px 28px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
              background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fb 100%)',
              borderBottom: '1px solid rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                }}>
                  <span style={{ fontSize: 18, filter: 'brightness(10)' }}>📋</span>
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.3px' }}>
                    产品需求看板
                  </h2>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                    需求全景跟踪与协同
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* 搜索框 */}
                <div style={{ position: 'relative', transition: 'all 0.2s ease' }}>
                  <input
                    placeholder="搜索需求..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    style={{
                      width: searchFocused ? 240 : 200, padding: '8px 14px 8px 36px',
                      borderRadius: 10,
                      border: `1.5px solid ${searchFocused ? '#a5b4fc' : '#e5e7eb'}`,
                      fontSize: 13, outline: 'none',
                      background: searchFocused ? '#fff' : '#f3f4f6',
                      boxShadow: searchFocused ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
                      transition: 'all 0.2s ease',
                      color: '#374151',
                    }}
                  />
                  <span style={{
                    position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 15, color: searchFocused ? '#6366f1' : '#9ca3af',
                    transition: 'color 0.2s',
                  }}>🔍</span>
                </div>
                {/* 优先级筛选 */}
                <div style={{ display: 'flex', gap: 5, background: '#f3f4f6', padding: '3px 4px', borderRadius: 10 }}>
                  {PRIORITIES.map(p => {
                    const active = filterPriority === p;
                    return (
                      <button key={p} onClick={() => setFilterPriority(active ? null : p)} style={{
                        padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        background: active ? '#fff' : 'transparent',
                        color: active ? priorityStyles[p].text : '#9ca3af',
                        boxShadow: active ? `0 1px 4px ${priorityStyles[p].glow}` : 'none',
                      }}>{p}</button>
                    );
                  })}
                </div>
                {/* 新建需求按钮 */}
                <button
                  onClick={() => setShowNewForm(true)}
                  style={{
                    padding: '8px 18px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.4)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.3)'}
                >
                  <span style={{ fontSize: 15, fontWeight: 300 }}>+</span>
                  新建需求
                </button>
              </div>
            </div>

            {/* ── 统计卡片条 ── */}
            <div style={{
              padding: '10px 28px 14px', display: 'flex', gap: 10,
              flexShrink: 0,
            }}>
              {[
                { label: '总需求', value: stats.total, color: '#6366f1', bg: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', icon: '📊' },
                { label: '进行中', value: stats.active, color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)', icon: '🔥' },
                { label: '有卡点', value: stats.hasBlocker, color: '#ef4444', bg: 'linear-gradient(135deg, #fef2f2, #fee2e2)', icon: '⚠️' },
                { label: '已完成', value: stats.done, color: '#10b981', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', icon: '🎯' },
              ].map(s => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: s.bg, borderRadius: 10, padding: '8px 16px',
                  minWidth: 110,
                  border: '1px solid rgba(0,0,0,0.03)',
                }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, lineHeight: 1 }}>{s.label}</span>
                    <span style={{ fontWeight: 800, color: s.color, fontSize: 18, lineHeight: 1.3, letterSpacing: '-0.5px' }}>{s.value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── 看板主体 ── 2×2 网格布局 */}
            <div style={{
              flex: 1, padding: '4px 20px 16px',
              overflow: 'auto',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'auto auto',
                gap: 12,
                minHeight: 0,
              }}>
                {STATUS_COLUMNS.map(col => {
                  const items = groupedDemands[col.key] || [];
                  const isDraggingTarget = dragItem && dragItem.status !== col.key;

                  return (
                    <div
                      key={col.key}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.key)}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        background: col.bg,
                        borderRadius: 14,
                        border: `1px solid ${isDraggingTarget ? col.color : col.borderColor}`,
                        transition: 'all 0.2s ease',
                        boxShadow: isDraggingTarget
                          ? `0 0 0 2px ${col.color}30, 0 4px 16px ${col.color}15`
                          : '0 1px 3px rgba(0,0,0,0.03)',
                        overflow: 'hidden',
                        minHeight: 160,
                      }}
                    >
                      {/* 列头 */}
                      <div style={{
                        padding: '12px 14px 10px',
                        background: `linear-gradient(180deg, ${col.color}08 0%, transparent 100%)`,
                        borderBottom: `1px solid ${col.borderColor}`,
                        flexShrink: 0,
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>{col.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{col.label}</span>
                          </div>
                          <span style={{
                            fontSize: 12, fontWeight: 700, color: col.color,
                            background: `${col.color}12`,
                            padding: '2px 10px', borderRadius: 12,
                            minWidth: 24, textAlign: 'center',
                          }}>{items.length}</span>
                        </div>
                        <div style={{
                          height: 3, borderRadius: 2, marginTop: 8,
                          background: col.accentGrad,
                          opacity: 0.6,
                        }} />
                      </div>

                      {/* 卡片区 */}
                      <div style={{
                        flex: 1, overflowY: 'auto',
                        display: 'flex', flexDirection: 'column', gap: 8,
                        padding: '10px 10px 10px',
                        maxHeight: 400,
                      }}>
                        {items.length === 0 ? (
                          <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', padding: '28px 12px',
                            color: '#c4c7cd',
                          }}>
                            <span style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>{col.emptyIcon}</span>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{col.emptyText}</span>
                          </div>
                        ) : (
                          items.map(d => (
                            <DemandCard
                              key={d.id}
                              demand={d}
                              onDragStart={handleDragStart}
                              onClick={() => openDetail(d.id)}
                              isDone={col.key === 'done'}
                              accentColor={col.color}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {/* ── 详情面板（仅详情模式） ── */}
      {/* flex:1 1 0% + minWidth:0 —— 左侧 CompactSidebar(240 固定) 与右侧 todo 区(固定) 均不 grow，
          窗口变宽时新增宽度全部由本区域（需求流程区）吸收 */}
      {isCompact && selectedDemand && (
        <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', overflow: 'hidden', background: '#fff' }}>
          <DemandDetailPanel
            key={selectedDemand.id}
            demand={selectedDemand}
            mode="main"
            onBack={closeDetail}
            onClose={closeDetail}
            onUpdate={loadDemands}
            onOpenArchiveModal={onOpenArchiveModal}
          />
        </div>
      )}

      {/* ── 新建需求弹窗（两种模式共享） ── */}
      {showNewForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
        }}
          onClick={e => { if (e.target === e.currentTarget) { setShowNewForm(false); setNewTitle(''); } }}
        >
          <div style={{
            background: '#fff', borderRadius: 16, width: 480, maxWidth: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.12)', padding: 0, overflow: 'hidden',
          }}>
            {/* 弹窗头部 */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #f0f0f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
                <span style={{ marginRight: 8 }}>📋</span>新建需求
              </h3>
              <button onClick={() => { setShowNewForm(false); setNewTitle(''); }} style={{
                background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer',
              }}>✕</button>
            </div>

            {/* 弹窗内容 */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 需求名称 */}
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 6, display: 'block' }}>需求名称</label>
                <input
                  autoFocus
                  placeholder="输入需求名称..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newTitle.trim() && handleCreateDemand()}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none',
                    color: '#374151',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#a5b4fc'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* 当前进度 */}
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                  当前进度
                  <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                    选择后自动定位到对应看板
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PHASES.map(phase => {
                    const isActive = newPhase === phase;
                    const mappedStatus = phaseToStatus(phase);
                    const mappedCol = STATUS_COLUMNS.find(c => c.key === mappedStatus);
                    return (
                      <button
                        key={phase}
                        type="button"
                        onClick={() => {
                          setNewPhase(isActive ? '' : phase);
                          if (!isActive) setNewStatus(mappedStatus);
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 12,
                          fontWeight: isActive ? 600 : 400,
                          border: `1.5px solid ${isActive ? (mappedCol?.color || '#6366f1') : '#e5e7eb'}`,
                          background: isActive ? `${mappedCol?.color || '#6366f1'}10` : '#fff',
                          color: isActive ? (mappedCol?.color || '#4338ca') : '#64748b',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {phase}
                      </button>
                    );
                  })}
                </div>
                {newPhase && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                    {(() => {
                      const s = phaseToStatus(newPhase);
                      const col = STATUS_COLUMNS.find(c => c.key === s);
                      return `将自动归入「${col?.label || s}」看板`;
                    })()}
                  </div>
                )}
              </div>

              {/* 优先级 + 看板位置 */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 6, display: 'block' }}>优先级</label>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {PRIORITIES.map(p => (
                      <button key={p} onClick={() => setNewPriority(p)} style={{
                        padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: '1.5px solid',
                        background: newPriority === p ? priorityStyles[p].bg : '#fff',
                        color: newPriority === p ? priorityStyles[p].text : '#ccc',
                        borderColor: newPriority === p ? priorityStyles[p].border : '#f0f0f0',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>{p}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                    看板位置
                    <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 11, marginLeft: 4 }}>可手动调整</span>
                  </label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {STATUS_COLUMNS.map(col => {
                      const isActive = newStatus === col.key;
                      return (
                        <button key={col.key} onClick={() => setNewStatus(col.key)} style={{
                          padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: isActive ? 600 : 400,
                          border: `1.5px solid ${isActive ? col.color : '#e5e7eb'}`,
                          background: isActive ? `${col.color}10` : '#fff',
                          color: isActive ? col.color : '#9ca3af',
                          cursor: 'pointer', transition: 'all 0.15s',
                          flex: 1, textAlign: 'center',
                        }}>
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid #f0f0f0',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
            }}>
              <button onClick={() => { setShowNewForm(false); setNewTitle(''); }} style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer',
              }}>取消</button>
              <button
                onClick={handleCreateDemand}
                disabled={!newTitle.trim()}
                style={{
                  padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: 'none',
                  background: newTitle.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e5e7eb',
                  color: newTitle.trim() ? '#fff' : '#9ca3af',
                  cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: newTitle.trim() ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                }}
              >创建需求</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 紧凑侧边栏（详情聚焦模式用） ─────────────────────
function CompactSidebar({
  demands,
  groupedDemands,
  searchQuery,
  setSearchQuery,
  searchFocused,
  setSearchFocused,
  filterPriority,
  setFilterPriority,
  selectedDemandId,
  onSelect,
  onNewDemand,
  onBackToFull,
}) {
  const totalCount = demands.length;
  return (
    <div style={{
      width: 240, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: '#fff', borderRight: '1px solid #e5e7eb',
    }}>
      {/* 头部：标题 + 返回全屏按钮 */}
      <div style={{
        padding: '12px 12px 10px',
        borderBottom: '1px solid #f3f4f6',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fb 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button
            onClick={onBackToFull}
            title="返回全屏看板"
            style={{
              width: 28, height: 28, borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#374151', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
          >←</button>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 14, filter: 'brightness(10)' }}>📋</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#111827' }}>需求看板</h3>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>共 {totalCount} 个需求</span>
          </div>
          <button
            onClick={onNewDemand}
            title="新建需求"
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(99,102,241,0.45)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 6px rgba(99,102,241,0.3)'}
          >+</button>
        </div>

        {/* 搜索框 */}
        <div style={{ position: 'relative', transition: 'all 0.2s ease', marginBottom: 8 }}>
          <input
            placeholder="搜索需求..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              width: '100%', padding: '7px 12px 7px 32px',
              borderRadius: 8,
              border: `1.5px solid ${searchFocused ? '#a5b4fc' : '#e5e7eb'}`,
              fontSize: 12, outline: 'none',
              background: searchFocused ? '#fff' : '#f3f4f6',
              boxShadow: searchFocused ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
              transition: 'all 0.2s ease',
              color: '#374151',
            }}
          />
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: searchFocused ? '#6366f1' : '#9ca3af',
          }}>🔍</span>
        </div>

        {/* 优先级筛选 */}
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', padding: '3px 4px', borderRadius: 8 }}>
          {PRIORITIES.map(p => {
            const active = filterPriority === p;
            return (
              <button key={p} onClick={() => setFilterPriority(active ? null : p)} style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: active ? '#fff' : 'transparent',
                color: active ? priorityStyles[p].text : '#9ca3af',
                flex: 1,
                boxShadow: active ? `0 1px 3px ${priorityStyles[p].glow}` : 'none',
              }}>{p}</button>
            );
          })}
        </div>
      </div>

      {/* 卡片列表（按状态分组） */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 14px' }}>
        {totalCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 12px', color: '#c4c7cd' }}>
            <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.5 }}>📋</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>暂无需求</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>点击右上角 + 创建</div>
          </div>
        ) : (
          STATUS_COLUMNS.map(col => {
            const items = groupedDemands[col.key] || [];
            if (items.length === 0) return null;
            return (
              <div key={col.key} style={{ marginBottom: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginBottom: 6, paddingLeft: 4,
                }}>
                  <span style={{ fontSize: 11 }}>{col.icon}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: col.color,
                    letterSpacing: '0.3px',
                  }}>{col.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#9ca3af',
                    background: '#f3f4f6', padding: '1px 6px', borderRadius: 6,
                    marginLeft: 'auto',
                  }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map(d => (
                    <CompactDemandCard
                      key={d.id}
                      demand={d}
                      selected={d.id === selectedDemandId}
                      onClick={() => onSelect(d.id)}
                      accentColor={col.color}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── 紧凑卡片（侧边栏用） ───────────────────────────
function CompactDemandCard({ demand, selected, onClick, accentColor }) {
  const pStyle = priorityStyles[demand.priority] || priorityStyles.P1;
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: selected ? `${accentColor}10` : '#fafbfc',
        border: `1px solid ${selected ? accentColor : '#eef0f4'}`,
        borderLeft: `3px solid ${selected ? accentColor : (demand.blocker ? '#ef4444' : `${accentColor}50`)}`,
        borderRadius: 8,
        padding: '8px 10px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: selected ? `0 2px 8px ${accentColor}18` : 'none',
      }}
      onMouseEnter={e => {
        if (!selected) {
          e.currentTarget.style.background = '#f3f4f6';
          e.currentTarget.style.borderColor = '#d1d5db';
        }
      }}
      onMouseLeave={e => {
        if (!selected) {
          e.currentTarget.style.background = '#fafbfc';
          e.currentTarget.style.borderColor = '#eef0f4';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
          background: pStyle.bg, color: pStyle.text,
          border: `1px solid ${pStyle.border}`,
          flexShrink: 0,
        }}>{demand.priority || 'P1'}</span>
        <span style={{
          fontSize: 12, fontWeight: selected ? 600 : 500,
          color: selected ? '#111827' : '#1f2937',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, lineHeight: 1.4,
        }}>{demand.title}</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 10, color: '#9ca3af', marginTop: 4,
        paddingLeft: 2,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {demand.phase || '未设定'}
        </span>
        <span>·</span>
        <span>{demand.nodeCount || 0} 节点</span>
        {demand.blocker && (
          <>
            <span>·</span>
            <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ 有卡点</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── 需求卡片（全屏看板模式用，视觉增强版） ──────────
function DemandCard({ demand, onDragStart, onClick, isDone, accentColor }) {
  const [hovering, setHovering] = useState(false);
  const pStyle = priorityStyles[demand.priority] || priorityStyles.P1;

  const phaseProgress = useMemo(() => {
    if (!demand.phase) return 0;
    const idx = PHASE_INDEX[demand.phase];
    if (idx === undefined) return 0;
    return Math.round(((idx + 1) / PHASES.length) * 100);
  }, [demand.phase]);

  const nextTodoInfo = useMemo(() => {
    if (!demand.nextTodo) return null;
    const dateMatch = demand.nextTodo.match(/(\d{1,2}[\/\-\.]\d{1,2})/);
    return { text: demand.nextTodo, date: dateMatch ? dateMatch[1] : null };
  }, [demand.nextTodo]);

  const targetDateStr = useMemo(() => {
    if (!demand.targetDate) return null;
    return demand.targetDate.replace(/^\d{4}-/, '').replace('-', '/');
  }, [demand.targetDate]);

  const progressGrad = phaseProgress >= 80
    ? 'linear-gradient(90deg, #34d399, #10b981)'
    : phaseProgress >= 50
      ? 'linear-gradient(90deg, #60a5fa, #3b82f6)'
      : 'linear-gradient(90deg, #a78bfa, #8b5cf6)';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, demand)}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '10px 12px',
        border: `1px solid ${hovering ? '#d1d5db' : '#eef0f4'}`,
        boxShadow: hovering
          ? '0 6px 20px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)'
          : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        cursor: 'grab',
        transition: 'all 0.2s ease',
        opacity: isDone ? 0.6 : 1,
        position: 'relative',
        overflow: 'hidden',
        transform: hovering ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: demand.blocker
          ? 'linear-gradient(180deg, #ef4444, #dc2626)'
          : (accentColor || '#e5e7eb'),
        borderRadius: '12px 0 0 12px',
        opacity: demand.blocker ? 1 : 0.4,
        transition: 'opacity 0.2s',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingLeft: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
          background: pStyle.bg, color: pStyle.text,
          border: `1px solid ${pStyle.border}`,
          flexShrink: 0, letterSpacing: '0.5px',
        }}>{demand.priority || 'P1'}</span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#1f2937', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}>
          {demand.title}
        </span>
      </div>

      {demand.phase && (
        <div style={{ marginBottom: 8, paddingLeft: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: `${accentColor || '#6366f1'}0a`,
              color: accentColor || '#6366f1', fontWeight: 600,
              border: `1px solid ${accentColor || '#6366f1'}15`,
            }}>{demand.phase}</span>
            <span style={{
              fontSize: 10, color: '#9ca3af', fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}>{phaseProgress}%</span>
          </div>
          <div style={{
            height: 5, borderRadius: 3, background: '#f1f3f5', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${phaseProgress}%`, borderRadius: 3,
              background: progressGrad,
              transition: 'width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              boxShadow: phaseProgress > 0 ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }} />
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        fontSize: 11, color: '#9ca3af', paddingLeft: 6,
        marginBottom: (nextTodoInfo || demand.blocker) ? 6 : 0,
      }}>
        {targetDateStr && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: '#f5f3ff', padding: '2px 8px', borderRadius: 6,
            border: '1px solid #ede9fe',
          }}>
            <span style={{ fontSize: 10 }}>🎯</span>
            <span style={{ color: '#7c3aed', fontWeight: 600, fontSize: 10 }}>{targetDateStr}</span>
          </span>
        )}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          color: '#b0b5bf', fontSize: 10,
        }}>
          <span style={{ fontSize: 9 }}>📝</span>
          {demand.nodeCount || 0} 节点
        </span>
      </div>

      {nextTodoInfo && (
        <div style={{
          fontSize: 11, color: '#4b5563',
          padding: '5px 9px', marginLeft: 6,
          background: 'linear-gradient(135deg, #f0f9ff, #e8f4fd)',
          borderRadius: 8, border: '1px solid #dbeafe',
          display: 'flex', alignItems: 'center', gap: 5,
          marginBottom: demand.blocker ? 6 : 0,
        }}>
          <span style={{
            width: 4, height: 4, borderRadius: '50%',
            background: '#3b82f6', flexShrink: 0,
          }} />
          <span style={{
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: 11,
          }}>
            {nextTodoInfo.text}
          </span>
          {nextTodoInfo.date && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#2563eb',
              background: '#dbeafe', padding: '1px 6px', borderRadius: 4,
              flexShrink: 0, letterSpacing: '0.3px',
            }}>{nextTodoInfo.date}</span>
          )}
        </div>
      )}

      {demand.blocker && (
        <div style={{
          fontSize: 11, color: '#dc2626',
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 8px', marginLeft: 6,
          background: '#fef2f2', borderRadius: 6,
          border: '1px solid #fecaca',
        }}>
          <span style={{ fontSize: 11, flexShrink: 0 }}>⚠️</span>
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontWeight: 500,
          }}>
            {demand.blocker}
          </span>
        </div>
      )}
    </div>
  );
}