import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * TodoTrackerSidebar — 方案C 浮动侧边栏式 Todo 智能追踪
 * 
 * 增强功能：
 * 1. 手动添加 Todo（快速模板下拉 + 自定义输入）
 * 2. 双击 Todo 拉起归档表单
 * 3. 高优先级 / 逾期 Todo 闪烁提醒
 * 4. 链式 Todo 聚合展示（前后相连的历史待办）
 * 5. 按日期时间序列分栏展示，每天分隔明显
 */

// ── 快速模板 ──────────────────────────────────────────
const QUICK_TEMPLATES = [
  { label: '撰写需求文档', project: '', priority: 'normal' },
  { label: '跟进研发进度', project: '', priority: 'normal' },
  { label: '准备评审材料', project: '', priority: 'high' },
  { label: '整理会议纪要', project: '', priority: 'normal' },
  { label: '更新项目排期', project: '', priority: 'normal' },
  { label: '编写测试用例', project: '', priority: 'normal' },
  { label: '完成数据分析', project: '', priority: 'normal' },
  { label: '对齐设计方案', project: '', priority: 'high' },
];

const PRIORITY_OPTIONS = [
  { value: 'normal', label: '普通', color: '#6b7280' },
  { value: 'high', label: '高', color: '#f59e0b' },
  { value: 'urgent', label: '紧急', color: '#ef4444' },
];

// ── 日期格式化辅助 ────────────────────────────────────
function formatDateLabel(dateStr) {
  if (!dateStr) return '无日期';
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const date = new Date(dateStr + 'T00:00:00');
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayLabel = weekDays[date.getDay()];

  if (dateStr === todayStr) return `今天 · ${dayLabel}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (dateStr === yesterdayStr) return `昨天 · ${dayLabel}`;

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (dateStr === tomorrowStr) return `明天 · ${dayLabel}`;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日 · ${dayLabel}`;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d < today;
}

function isTodayDate(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateStr === todayStr;
}

// ── 迷你日历组件 ─────────────────────────────────────
function MiniCalendar({ heatmap, selectedDate, onSelectDate }) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const weeks = ['一', '二', '三', '四', '五', '六', '日'];
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => setViewDate(new Date());

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button onClick={prevMonth} style={navBtnStyle}>{'<'}</button>
        <span onClick={goToday} style={{ fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }} title="回到今天">
          {year}年{monthNames[month]}
        </span>
        <button onClick={nextMonth} style={navBtnStyle}>{'>'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
        {weeks.map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', padding: '1px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`pad-${idx}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const count = heatmap[dateStr] || 0;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          let bg = 'transparent', textColor = '#374151';
          if (count === 1) { bg = '#dbeafe'; textColor = '#1d4ed8'; }
          else if (count === 2) { bg = '#93c5fd'; textColor = '#1e40af'; }
          else if (count >= 3) { bg = '#3b82f6'; textColor = '#fff'; }
          if (isSelected) { bg = '#6366f1'; textColor = '#fff'; }
          return (
            <div key={dateStr} onClick={() => onSelectDate?.(dateStr === selectedDate ? null : dateStr)}
              style={{ textAlign: 'center', fontSize: 11, padding: '3px 0', borderRadius: 4,
                cursor: count > 0 || isToday ? 'pointer' : 'default', background: bg, color: textColor,
                fontWeight: isToday ? 700 : 400, border: isToday ? '1.5px solid #6366f1' : '1.5px solid transparent',
                transition: 'all 0.15s', position: 'relative' }}
              title={count > 0 ? `${count} 条待办` : ''}>
              {day}
              {count > 0 && !isSelected && (
                <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                  width: 3, height: 3, borderRadius: '50%', background: count >= 3 ? '#fff' : '#3b82f6' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', padding: '2px 8px', borderRadius: 4 };

// ── 新增 Todo 表单 ─────────────────────────────────────
function AddTodoForm({ onAdd, onCancel, defaultDate }) {
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState(defaultDate || '');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState('normal');
  const [showTemplates, setShowTemplates] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // 当 defaultDate 变化时同步
  useEffect(() => { if (defaultDate) setDueDate(defaultDate); }, [defaultDate]);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), dueDate: dueDate || null, project: project || null, priority });
    setText(''); setDueDate(defaultDate || ''); setProject(''); setPriority('normal');
  };

  const handleTemplateSelect = (tmpl) => {
    setText(tmpl.label);
    if (tmpl.priority) setPriority(tmpl.priority);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 10, border: '1px solid #e2e8f0', marginBottom: 8 }}>
      {/* 文本输入 + 模板下拉 */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            placeholder="输入待办内容..."
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }}
            style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12,
              outline: 'none', background: '#fff' }}
          />
          <button onClick={() => setShowTemplates(!showTemplates)}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: showTemplates ? '#eef2ff' : '#fff',
              cursor: 'pointer', fontSize: 12, color: '#6366f1', flexShrink: 0 }}
            title="快速模板">
            📋
          </button>
        </div>
        {/* 模板下拉 */}
        {showTemplates && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4,
            background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: 180, overflow: 'auto' }}>
            {QUICK_TEMPLATES.map((tmpl, i) => (
              <div key={i} onClick={() => handleTemplateSelect(tmpl)}
                style={{ padding: '6px 12px', fontSize: 12, color: '#374151', cursor: 'pointer',
                  borderBottom: i < QUICK_TEMPLATES.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {tmpl.label}
                {tmpl.priority === 'high' && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6 }}>高优</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 第二行: 日期 + 项目 + 优先级 */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ flex: 1, padding: '3px 6px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 11, color: '#374151', background: '#fff' }}
        />
        <input value={project} onChange={e => setProject(e.target.value)} placeholder="项目"
          style={{ width: 60, padding: '3px 6px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 11, background: '#fff' }}
        />
        <select value={priority} onChange={e => setPriority(e.target.value)}
          style={{ width: 56, padding: '3px 2px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 11, background: '#fff',
            color: PRIORITY_OPTIONS.find(p => p.value === priority)?.color }}>
          {PRIORITY_OPTIONS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* 按钮行 */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel}
          style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff',
            fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
          取消
        </button>
        <button onClick={handleSubmit} disabled={!text.trim()}
          style={{ padding: '3px 12px', borderRadius: 5, border: 'none', background: text.trim() ? '#3b82f6' : '#d1d5db',
            fontSize: 11, color: '#fff', cursor: text.trim() ? 'pointer' : 'not-allowed', fontWeight: 500 }}>
          添加
        </button>
      </div>
    </div>
  );
}

// ── 编辑 Todo 表单 ─────────────────────────────────────
function EditTodoForm({ item, onSave, onCancel }) {
  const [text, setText] = useState(item.text || '');
  const [dueDate, setDueDate] = useState(item.dueDate || '');
  const [project, setProject] = useState(item.archiveProject || '');
  const [priority, setPriority] = useState(item.priority || 'normal');
  const inputRef = useRef(null);
  const isManual = item.source === 'manual';

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSave({ text: text.trim(), dueDate: dueDate || null, project: project || null, priority });
  };

  return (
    <div style={{ background: '#eef2ff', borderRadius: 10, padding: 10, border: '1px solid #c7d2fe', marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', marginBottom: 6 }}>✏️ 编辑待办</div>
      <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
        placeholder="待办内容"
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }}
        style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #c7d2fe', fontSize: 12,
          outline: 'none', background: '#fff', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ flex: 1, padding: '3px 6px', borderRadius: 5, border: '1px solid #c7d2fe', fontSize: 11, color: '#374151', background: '#fff' }}
        />
        {isManual && (
          <>
            <input value={project} onChange={e => setProject(e.target.value)} placeholder="项目"
              style={{ width: 60, padding: '3px 6px', borderRadius: 5, border: '1px solid #c7d2fe', fontSize: 11, background: '#fff' }}
            />
            <select value={priority} onChange={e => setPriority(e.target.value)}
              style={{ width: 56, padding: '3px 2px', borderRadius: 5, border: '1px solid #c7d2fe', fontSize: 11, background: '#fff',
                color: PRIORITY_OPTIONS.find(p => p.value === priority)?.color }}>
              {PRIORITY_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel}
          style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff',
            fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
          取消
        </button>
        <button onClick={handleSubmit} disabled={!text.trim()}
          style={{ padding: '3px 12px', borderRadius: 5, border: 'none', background: text.trim() ? '#4f46e5' : '#d1d5db',
            fontSize: 11, color: '#fff', cursor: text.trim() ? 'pointer' : 'not-allowed', fontWeight: 500 }}>
          保存
        </button>
      </div>
    </div>
  );
}

// ── 单条 Todo 项 ─────────────────────────────────────
function TodoItemCard({ item, onToggle, onDoubleClick, isHighPriority, compact, isUrgentBlinking, onDismissBlink, onEdit }) {
  const [hovering, setHovering] = useState(false);
  const isDone = item.status === 'done';
  const isManual = item.source === 'manual';
  const sourceIcon = item.source === 'manual' ? '✏️' : item.source === 'demand' ? '🎯' : '📄';

  // 点击该条目时取消闪烁
  const handleClick = () => {
    if (isUrgentBlinking && onDismissBlink) {
      onDismissBlink(item.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onDoubleClick={() => !isDone && onDoubleClick?.(item)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 7,
        padding: compact ? '5px 8px' : '6px 10px', borderRadius: 7,
        background: hovering && !isUrgentBlinking ? '#f8fafc' : 'transparent',
        transition: 'background 0.15s, box-shadow 0.3s, border-color 0.3s',
        opacity: isDone ? 0.5 : 1,
        cursor: isDone ? 'default' : 'pointer',
        animation: isUrgentBlinking ? 'urgentPulse 0.8s ease-in-out infinite' : 'none',
        borderLeft: isUrgentBlinking ? '4px solid #ef4444' : '3px solid transparent',
        boxShadow: isUrgentBlinking ? '0 0 8px rgba(239,68,68,0.3), inset 0 0 0 1px rgba(239,68,68,0.15)' : 'none',
        position: 'relative',
      }}
      title={isDone ? '' : '双击拉起归档表单'}
    >
      {/* 紧急闪烁角标 */}
      {isUrgentBlinking && (
        <div style={{
          position: 'absolute', top: -2, right: 6,
          fontSize: 9, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          padding: '1px 6px', borderRadius: '0 0 4px 4px',
          animation: 'urgentBadgePulse 0.8s ease-in-out infinite',
          boxShadow: '0 2px 6px rgba(239,68,68,0.4)',
          letterSpacing: '0.5px',
        }}>
          紧急
        </div>
      )}

      {/* 复选框 */}
      <div onClick={(e) => { e.stopPropagation(); onToggle(item.id, isDone ? 'pending' : 'done'); }}
        style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
          border: isDone ? 'none' : '2px solid #94a3b8',
          background: isDone ? '#10b981' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
        {isDone && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* 文本内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, color: isDone ? '#9ca3af' : '#1f2937',
          textDecoration: isDone ? 'line-through' : 'none',
          lineHeight: 1.4, wordBreak: 'break-word',
        }}>
          {item.text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
          {/* 来源标记 */}
          <span style={{ fontSize: 10, color: '#9ca3af', maxWidth: 120,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.archiveTitle}>
            {sourceIcon} {item.archiveTitle}
          </span>
          {/* 项目 */}
          {item.archiveProject && (
            <span style={{ fontSize: 10, padding: '0px 4px', borderRadius: 3, background: '#f0f9ff', color: '#0284c7' }}>
              {item.archiveProject}
            </span>
          )}
          {/* 优先级标识 */}
          {item.priority && item.priority !== 'normal' && (
            <span style={{
              fontSize: 9, padding: '0px 4px', borderRadius: 3, fontWeight: 600,
              background: item.priority === 'urgent' ? '#fef2f2' : '#fffbeb',
              color: item.priority === 'urgent' ? '#dc2626' : '#d97706',
            }}>
              {item.priority === 'urgent' ? '紧急' : '高优'}
            </span>
          )}
          {/* 链式标识 */}
          {item.chainId && item.parentTodoId && (
            <span style={{ fontSize: 9, color: '#8b5cf6', padding: '0px 4px', borderRadius: 3, background: '#f5f3ff' }}>
              🔗
            </span>
          )}
        </div>
      </div>

      {/* 编辑按钮（hover 显示） */}
      {!isDone && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit?.(item); }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            opacity: hovering ? 1 : 0,
            pointerEvents: hovering ? 'auto' : 'none',
            width: 20, height: 20, borderRadius: 5, border: 'none',
            background: '#eef2ff', color: '#6366f1', cursor: 'pointer',
            fontSize: 11, flexShrink: 0, marginTop: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 0.15s',
          }}
          title="编辑待办"
        >✏️</button>
      )}
    </div>
  );
}

// ── 链式 Todo 聚合组件 ────────────────────────────────
function ChainGroup({ chainId, items, onToggle, onDoubleClick }) {
  const [expanded, setExpanded] = useState(false);
  const current = items.find(i => i.status !== 'done') || items[items.length - 1];
  const history = items.filter(i => i.id !== current.id);

  if (items.length <= 1) return null;

  return (
    <div style={{ marginBottom: 4, background: '#faf5ff', borderRadius: 7, border: '1px solid #ede9fe', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', cursor: 'pointer', fontSize: 11, color: '#7c3aed' }}>
        <span>🔗</span>
        <span style={{ fontWeight: 600 }}>链式待办</span>
        <span style={{ opacity: 0.6, fontSize: 10 }}>({items.length} 条)</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {expanded && (
        <div style={{ padding: '0 6px 6px' }}>
          {history.map(item => (
            <div key={item.id} style={{ padding: '3px 6px', fontSize: 11, color: '#9ca3af', textDecoration: 'line-through', borderLeft: '2px solid #ddd6fe', marginLeft: 4, marginBottom: 2 }}>
              {item.text} <span style={{ fontSize: 9 }}>{item.dueDate || ''}</span>
            </div>
          ))}
          <div style={{ padding: '3px 6px', fontSize: 11, color: '#4c1d95', fontWeight: 500, borderLeft: '2px solid #7c3aed', marginLeft: 4 }}>
            ➡️ {current.text} <span style={{ fontSize: 9 }}>{current.dueDate || ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI 建议卡片 ──────────────────────────────────────
function AISuggestionCard() {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const loadSuggestion = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke('ai_todo_suggestions');
      setSuggestion(result);
    } catch (err) {
      setSuggestion('**AI 建议暂不可用**\n\n请确保 Ollama 服务已启动。');
    } finally { setLoading(false); }
  }, []);

  return (
    <div style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f0f9ff 100%)', borderRadius: 10,
      padding: collapsed ? '8px 10px' : '10px 12px', border: '1px solid #e9d5ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setCollapsed(c => !c)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13 }}>🤖</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed' }}>AI 建议</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {!collapsed && (
            <button onClick={e => { e.stopPropagation(); loadSuggestion(); }} disabled={loading}
              style={{ background: 'none', border: 'none', cursor: loading ? 'wait' : 'pointer',
                fontSize: 11, color: '#7c3aed', padding: '2px 6px', borderRadius: 4 }} title="刷新建议">
              {loading ? '⏳' : '🔄'}
            </button>
          )}
          <span style={{ fontSize: 11, color: '#a78bfa', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>
      {!collapsed && (
        <div style={{ marginTop: 6 }}>
          {suggestion ? (
            <div style={{ fontSize: 11, color: '#4c1d95', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {suggestion.split('\n').map((line, i) => {
                if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 600, marginTop: i > 0 ? 4 : 0 }}>{line.replace(/\*\*/g, '')}</div>;
                if (line.startsWith('- ')) return <div key={i} style={{ paddingLeft: 8 }}>{'  '}{line}</div>;
                return <div key={i}>{line}</div>;
              })}
            </div>
          ) : (
            <button onClick={loadSuggestion} disabled={loading}
              style={{ width: '100%', padding: '6px 0', background: '#ede9fe', border: '1px solid #ddd6fe',
                borderRadius: 6, cursor: loading ? 'wait' : 'pointer', fontSize: 11, color: '#7c3aed', fontWeight: 500 }}>
              {loading ? '正在分析...' : '✨ 获取 AI 建议'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 日期分栏头 ──────────────────────────────────────
function DateSectionHeader({ dateStr, count, isToday, isOverdue: overdue }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px 4px',
      borderBottom: '2px solid',
      borderColor: isToday ? '#3b82f6' : overdue ? '#ef4444' : '#e5e7eb',
      marginBottom: 4,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: isToday ? '#3b82f6' : overdue ? '#ef4444' : '#9ca3af',
      }} />
      <span style={{
        fontSize: 12, fontWeight: 600,
        color: isToday ? '#1d4ed8' : overdue ? '#dc2626' : '#374151',
      }}>
        {formatDateLabel(dateStr)}
      </span>
      <span style={{
        fontSize: 10, color: '#9ca3af', background: '#f3f4f6',
        padding: '0px 6px', borderRadius: 8,
      }}>
        {count}
      </span>
      {overdue && (
        <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 600 }}>逾期</span>
      )}
    </div>
  );
}

// ── 侧栏顶部标题栏：📋 待办追踪 + 数量徽章 + 新增 + ✕ ──
function TodoSidebarHeader({ pendingCount, showAddForm, onToggleAdd, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 15 }}>📋</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>待办追踪</span>
        {pendingCount > 0 && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>
            {pendingCount}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={onToggleAdd}
          style={{
            background: showAddForm ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 11, fontWeight: 600,
            padding: '4px 10px', borderRadius: 6,
            display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 1px 4px rgba(59,130,246,0.25)',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
          title="新增待办">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          新增
        </button>
        {onClose && (
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 4, color: '#b0b7c3', lineHeight: 1 }}
            title="收起侧边栏">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── 快速统计：4 个分组徽章（逾期/今天/本周/其他） ──
function TodoSidebarQuickStats({ todos }) {
  if (!todos) return null;
  const { overdue_count, today_count, this_week_count, later_count, no_date_count } = todos;
  return (
    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
      {overdue_count > 0 && (
        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#fef2f2', color: '#dc2626' }}>🔴 逾期 {overdue_count}</span>
      )}
      {today_count > 0 && (
        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#fffbeb', color: '#d97706' }}>🟡 今天 {today_count}</span>
      )}
      {this_week_count > 0 && (
        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#eff6ff', color: '#3b82f6' }}>🔵 本周 {this_week_count}</span>
      )}
      {(later_count + no_date_count) > 0 && (
        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>⚪ 其他 {later_count + no_date_count}</span>
      )}
    </div>
  );
}

// ── 已选日期筛选条 ───────────────────────────────────
function TodoSidebarDateFilterBar({ selectedDate, onClear }) {
  if (!selectedDate) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 8px', marginBottom: 6, borderRadius: 6, background: '#eef2ff', color: '#4338ca', fontSize: 11 }}>
      <span>📅 筛选: {selectedDate}</span>
      <button onClick={onClear}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6366f1' }}>
        清除
      </button>
    </div>
  );
}

// ── 侧栏空态（0 待办 / 0 某日待办） ──────────────
function TodoSidebarEmpty({ selectedDate, onAddForSelectedDate }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 12px' }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>🎯</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        {selectedDate ? '该日期暂无待办' : '暂无待办事项'}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        点击「新增」按钮手动添加{selectedDate ? '（将默认使用所选日期）' : ''}
      </div>
      {selectedDate && (
        <button
          onClick={onAddForSelectedDate}
          style={{
            padding: '5px 14px', borderRadius: 6, border: '1px dashed #c7d2fe',
            background: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          ➕ 添加 {formatDateLabel(selectedDate)} 的待办
        </button>
      )}
    </div>
  );
}

// ── 侧栏主列表：链式分组 + 日期分栏 ──────────────
function TodoSidebarList({ chainGroups, dateGroups, toggleTodo, handleDoubleClickTodo, blinkingIds, dismissBlink, onEdit }) {
  return (
    <>
      {/* 链式 Todo 聚合区域 */}
      {Object.keys(chainGroups).length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {Object.entries(chainGroups).map(([cid, items]) => (
            <ChainGroup key={cid} chainId={cid} items={items} onToggle={toggleTodo} onDoubleClick={handleDoubleClickTodo} />
          ))}
        </div>
      )}

      {/* 按日期时间序列分栏展示 */}
      {dateGroups.map(({ dateStr, items }) => (
        <div key={dateStr || '__no_date__'} style={{ marginBottom: 10 }}>
          <DateSectionHeader
            dateStr={dateStr}
            count={items.length}
            isToday={dateStr ? isTodayDate(dateStr) : false}
            isOverdue={dateStr ? isOverdue(dateStr) : false}
          />
          <div>
            {items.map(item => (
              <TodoItemCard
                key={item.id} item={item} onToggle={toggleTodo}
                onDoubleClick={handleDoubleClickTodo}
                isHighPriority={item.priority === 'high' || item.priority === 'urgent' || item.group === 'overdue'}
                isUrgentBlinking={blinkingIds.has(item.id)}
                onDismissBlink={dismissBlink}
                onEdit={onEdit}
                compact
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ── 显示/隐藏已完成按钮 ──────────────────────
function TodoSidebarShowDoneToggle({ showDone, doneCount, onToggle }) {
  if (!doneCount) return null;
  return (
    <button onClick={onToggle}
      style={{ width: '100%', padding: '6px 0', background: 'none', border: '1px dashed #e5e7eb',
        borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
      {showDone ? '隐藏已完成' : `显示已完成 (${doneCount})`}
    </button>
  );
}

// ── 动画 keyframes（侧栏滑入 + 紧急闪烁） ──────
function TodoSidebarAnimatedStyles() {
  return (
    <style>{`
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes urgentPulse {
        0% {
          background-color: rgba(239, 68, 68, 0.03);
          box-shadow: 0 0 4px rgba(239,68,68,0.15), inset 0 0 0 1px rgba(239,68,68,0.08);
        }
        50% {
          background-color: rgba(239, 68, 68, 0.15);
          box-shadow: 0 0 16px rgba(239,68,68,0.45), inset 0 0 0 1px rgba(239,68,68,0.3);
        }
        100% {
          background-color: rgba(239, 68, 68, 0.03);
          box-shadow: 0 0 4px rgba(239,68,68,0.15), inset 0 0 0 1px rgba(239,68,68,0.08);
        }
      }
      @keyframes urgentBadgePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.05); }
      }
      @keyframes todoBlink {
        0%, 100% { background-color: transparent; }
        50% { background-color: rgba(239, 68, 68, 0.06); }
      }
    `}</style>
  );
}

// ── 主组件 ──────────────────────────────────────────
export default function TodoTrackerSidebar({ visible, onClose, onOpenArchiveForTodo }) {
  const [todos, setTodos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null); // 当前正在编辑的 todo

  // ── 紧急闪烁管理 ──
  // blinkingIds: 当前正在闪烁的 todo id 集合
  const [blinkingIds, setBlinkingIds] = useState(new Set());
  const blinkTimerRef = useRef(null);

  // 加载 Todo 数据
  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke('query_todos');
      setTodos(result);
    } catch (err) {
      console.error('Failed to load todos:', err);
      setTodos({ items: [], overdue_count: 0, today_count: 0, this_week_count: 0, later_count: 0, no_date_count: 0, done_count: 0, heatmap: {} });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (visible) loadTodos();
  }, [visible, loadTodos]);

  // ── 归档数据变更时自动同步 ──
  // 记录节点新增/编辑/删除后，其「下一步」字段会成为待办来源，
  // 通过全局事件驱动 todo 区重新拉取，保证与时间线实时一致。
  useEffect(() => {
    const onArchiveChanged = () => { if (visible) loadTodos(); };
    window.addEventListener('archive_data_changed', onArchiveChanged);
    return () => window.removeEventListener('archive_data_changed', onArchiveChanged);
  }, [visible, loadTodos]);

  // ── 当 todos 加载完成且 visible 时，启动紧急闪烁 ──
  useEffect(() => {
    if (!visible || !todos?.items) {
      // 不可见时清理
      if (blinkTimerRef.current) {
        clearTimeout(blinkTimerRef.current);
        blinkTimerRef.current = null;
      }
      setBlinkingIds(new Set());
      return;
    }

    // 识别当天紧急 / 逾期且优先级高的 todo
    const urgentIds = new Set();
    const todayDate = new Date();
    const todayDateStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    
    for (const item of todos.items) {
      if (item.status === 'done') continue;
      const isUrgentPriority = item.priority === 'urgent';
      const isTodayItem = item.dueDate === todayDateStr;
      const isOverdueItem = item.dueDate && item.dueDate < todayDateStr;
      const isHighOrUrgent = item.priority === 'high' || item.priority === 'urgent';
      
      // 紧急优先级的当天/逾期 todo，或者逾期的高优 todo
      if ((isUrgentPriority && (isTodayItem || isOverdueItem)) || (isOverdueItem && isHighOrUrgent)) {
        urgentIds.add(item.id);
      }
    }

    if (urgentIds.size > 0) {
      setBlinkingIds(urgentIds);
      // 5 秒后自动停止闪烁
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      blinkTimerRef.current = setTimeout(() => {
        setBlinkingIds(new Set());
        blinkTimerRef.current = null;
      }, 5000);
    }

    return () => {
      if (blinkTimerRef.current) {
        clearTimeout(blinkTimerRef.current);
        blinkTimerRef.current = null;
      }
    };
  }, [visible, todos]);

  // 点击某条紧急 todo 后取消其闪烁
  const dismissBlink = useCallback((todoId) => {
    setBlinkingIds(prev => {
      const next = new Set(prev);
      next.delete(todoId);
      return next;
    });
  }, []);

  // 切换 Todo 状态
  const toggleTodo = useCallback(async (todoId, newStatus) => {
    try {
      await invoke('update_todo_status', { todoId, status: newStatus });
      // 乐观更新
      setTodos(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => {
            if (item.id === todoId) {
              const updated = { ...item, status: newStatus };
              if (newStatus === 'done') { updated.group = 'done'; updated.completedAt = Date.now() / 1000; }
              else {
                updated.completedAt = null;
                if (item.dueDate) {
                  const due = new Date(item.dueDate + 'T00:00:00');
                  const t = new Date(); t.setHours(0, 0, 0, 0);
                  if (due < t) updated.group = 'overdue';
                  else if (due.getTime() === t.getTime()) updated.group = 'today';
                  else {
                    const endOfWeek = new Date(t); endOfWeek.setDate(t.getDate() + (7 - t.getDay()));
                    updated.group = due <= endOfWeek ? 'this_week' : 'later';
                  }
                } else { updated.group = 'no_date'; }
              }
              return updated;
            }
            return item;
          }),
        };
      });
    } catch (err) { console.error('Failed to toggle todo:', err); loadTodos(); }
  }, [loadTodos]);

  // 手动添加 Todo —— 默认带上当前 selectedDate
  const handleAddTodo = useCallback(async ({ text, dueDate, project, priority }) => {
    try {
      await invoke('add_manual_todo', { text, dueDate, project, priority, parentTodoId: null });
      setShowAddForm(false);
      loadTodos();
    } catch (err) { console.error('Failed to add todo:', err); }
  }, [loadTodos]);

  // 编辑 Todo（支持 archive / demand / manual 三类来源）
  const handleUpdateTodo = useCallback(async ({ text, dueDate, project, priority }) => {
    if (!editingTodo) return;
    try {
      await invoke('update_todo', {
        todoId: editingTodo.id,
        text,
        dueDate,
        project,
        priority,
      });
      setEditingTodo(null);
      loadTodos();
    } catch (err) {
      console.error('Failed to update todo:', err);
      alert('编辑待办失败：' + (typeof err === 'string' ? err : (err?.message || '未知错误')));
    }
  }, [editingTodo, loadTodos]);

  // 双击拉起归档表单
  const handleDoubleClickTodo = useCallback((item) => {
    if (onOpenArchiveForTodo) {
      onOpenArchiveForTodo(item);
    }
  }, [onOpenArchiveForTodo]);

  // 获取今天的日期字符串，作为默认添加日期
  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  // 按选中日期过滤
  const filteredItems = useMemo(() => {
    if (!todos?.items) return [];
    let items = todos.items;
    if (selectedDate) items = items.filter(i => i.dueDate === selectedDate);
    if (!showDone) items = items.filter(i => i.group !== 'done');
    return items;
  }, [todos, selectedDate, showDone]);

  // 链式 Todo 聚合
  const { chainGroups, nonChainItems } = useMemo(() => {
    const chains = {};
    const singles = [];
    for (const item of filteredItems) {
      if (item.chainId && item.source === 'manual') {
        if (!chains[item.chainId]) chains[item.chainId] = [];
        chains[item.chainId].push(item);
      } else {
        singles.push(item);
      }
    }
    const chainGroups = {};
    const extraSingles = [];
    for (const [cid, items] of Object.entries(chains)) {
      if (items.length > 1) chainGroups[cid] = items;
      else extraSingles.push(...items);
    }
    return { chainGroups, nonChainItems: [...singles, ...extraSingles] };
  }, [filteredItems]);

  // 按日期分组（时间序列展示）—— 非链式条目
  const dateGroups = useMemo(() => {
    const groups = {};
    for (const item of nonChainItems) {
      const key = item.dueDate || '__no_date__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    // 排序：按预定完成时间「从近到远」升序（最近要做的排最前），无日期排最后
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '__no_date__') return 1;
      if (b === '__no_date__') return -1;
      return a.localeCompare(b);
    });
    return sortedKeys.map(key => ({
      dateStr: key === '__no_date__' ? null : key,
      items: groups[key],
    }));
  }, [nonChainItems]);

  const pendingCount = todos ? (todos.overdue_count + todos.today_count + todos.this_week_count + todos.later_count + todos.no_date_count) : 0;

  // ── 拖拽调整宽度（手柄在 todo 区右边缘，向右拖 = 宽度增大） ──
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(320);

  // 计算 todo 区动态上限：保证左侧看版有最小可用宽度（240px），且 todo 区不超过窗口宽度的 85%（防止挤没看版）
  const computeMaxWidth = useCallback(() => {
    return Math.max(280, Math.min(window.innerWidth - 240, Math.floor(window.innerWidth * 0.85)));
  }, []);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleDragMove = (ev) => {
      if (!isDraggingRef.current) return;
      // 手柄在 todo 区左边缘（贴近详情面板，作为两区域之间的分割线）
      // 拖手柄向左 → todo 区左边界向左 → 宽度增大
      // 拖手柄向右 → todo 区左边界向右 → 宽度减小
      const delta = ev.clientX - startXRef.current;
      const maxW = computeMaxWidth();
      const newW = Math.min(maxW, Math.max(260, startWidthRef.current - delta));
      setSidebarWidth(newW);
    };
    const handleDragEnd = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [sidebarWidth, computeMaxWidth]);

  // 窗口尺寸变化：
  // - 窗口变宽 → todo 区宽度保持不变（prev < maxW，Math.min 返回 prev），
  //   新增宽度全部由左侧需求流程区吸收
  // - 窗口变窄到会挤没看板时 → 才回收 todo 宽度到上限，保证看板至少 240px 可用
  useEffect(() => {
    const onResize = () => {
      setSidebarWidth(prev => Math.min(prev, computeMaxWidth()));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeMaxWidth]);

  // visible 默认 true（看板首页常驻右侧）；仅当显式传 false 才隐藏（兼容旧调用方）
  if (visible === false) return null;

  return (
    <div style={{
      // 固定宽度：flex-grow 0 / flex-shrink 0 / flex-basis sidebarWidth
      // → 页面（窗口）宽度扩展时 todo 区宽度保持不变，多出的空间全部由左侧需求流程区（flex:1）吸收
      flex: `0 0 ${sidebarWidth}px`,
      width: sidebarWidth,
      height: '100%', background: '#fff',
      display: 'flex', flexDirection: 'row',
      overflow: 'visible',  // 手柄要突出在 todo 区左外侧
      animation: 'slideInRight 0.25s ease-out',
      position: 'relative',
    }}>
      {/* ── 主内容区 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* ── 顶部标题栏 + 快速统计 ── */}
        <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <TodoSidebarHeader
            pendingCount={pendingCount}
            showAddForm={showAddForm}
            onToggleAdd={() => setShowAddForm(f => !f)}
            onClose={onClose}
          />
          {pendingCount > 0 && <TodoSidebarQuickStats todos={todos} />}
        </div>

        {/* ── 可滚动内容区 ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 10px' }}>
          {/* 新增 Todo 表单 —— 默认日期为 selectedDate 或今天 */}
          {showAddForm && (
            <div style={{ marginTop: 8 }}>
              <AddTodoForm
                onAdd={handleAddTodo}
                onCancel={() => setShowAddForm(false)}
                defaultDate={selectedDate || todayStr}
              />
            </div>
          )}

          {/* 日历热力图 */}
          <MiniCalendar heatmap={todos?.heatmap || {}} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

          {/* 已选日期筛选条 */}
          <TodoSidebarDateFilterBar
            selectedDate={selectedDate}
            onClear={() => setSelectedDate(null)}
          />

          {/* 编辑 Todo 表单（日历下方） */}
          {editingTodo && (
            <div style={{ marginTop: 6 }}>
              <EditTodoForm
                item={editingTodo}
                onSave={handleUpdateTodo}
                onCancel={() => setEditingTodo(null)}
              />
            </div>
          )}

          {/* 加载中 */}
          {loading && !todos && (
            <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>加载中...</div>
          )}

          {/* 空态（0 待办 / 0 某日待办） */}
          {todos && filteredItems.length === 0 && !showAddForm && (
            <TodoSidebarEmpty
              selectedDate={selectedDate}
              onAddForSelectedDate={() => setShowAddForm(true)}
            />
          )}

          {/* 主列表（链式分组 + 日期分栏） */}
          {dateGroups.length > 0 && (
            <TodoSidebarList
              chainGroups={chainGroups}
              dateGroups={dateGroups}
              toggleTodo={toggleTodo}
              handleDoubleClickTodo={handleDoubleClickTodo}
              blinkingIds={blinkingIds}
              dismissBlink={dismissBlink}
              onEdit={setEditingTodo}
            />
          )}

          {/* 显示/隐藏已完成 */}
          <TodoSidebarShowDoneToggle
            showDone={showDone}
            doneCount={todos?.done_count}
            onToggle={() => setShowDone(prev => !prev)}
          />

          {/* AI 建议卡片 — 自适应向下 */}
          {todos && pendingCount > 0 && (
            <div style={{ marginTop: 10 }}><AISuggestionCard /></div>
          )}
        </div>

        {/* 动画样式 */}
        <TodoSidebarAnimatedStyles />

        {/* ── 拖拽手柄（左边缘，贴近详情面板，作为两区域之间的分割线） ──
            手柄在 todo 区左侧时：
            - 拖手柄向左 → todo 区左边界向左 → 详情面板自适应扩大
            - 拖手柄向右 → todo 区左边界向右 → 详情面板自适应缩小
            位置：position: absolute, left: -3, 突出在 todo 区左边界外侧 3px（紧贴详情面板）
            hit area 8px（视觉指示线 3px + 左右 padding 5px） */}
        <div
          onMouseDown={handleDragStart}
          style={{
            position: 'absolute', left: -3, top: 0, bottom: 0, width: 8, cursor: 'col-resize',
            background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            zIndex: 10,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
          onMouseLeave={e => { if (!isDraggingRef.current) e.currentTarget.style.background = 'transparent'; }}
          title="拖动调整待办区宽度"
        >
          {/* 视觉指示线（紧贴 todo 区左边界 = 两区域之间） */}
          <div style={{
            width: 3, height: 32, borderRadius: 2, background: '#d1d5db',
            transition: 'background 0.15s',
          }} />
        </div>
      </div>
    </div>
  );
}
