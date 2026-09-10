import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * DemandTodoPanel — 【全景双栏：左月历 + 右高密双行 Todo 卡片列表】
 *
 * 新增功能：
 * 1. 👤 处理人（研发/设计/负责对接人）：输入框录入、卡片内气泡显示与快速修改。
 * 2. 📁 按项目分组：提供【📅 按时间】与【📁 按项目分组】视图切换控制，按项目聚合展示。
 * 3. ⏰ 设定提醒时间与系统/应用内闹钟：支持快捷选择（15分钟后/1小时后/今天18:00等）与自定义时间到点弹窗+桌面通知提醒。
 */

export default function DemandTodoPanel({
  onDoubleClickTodo,
  refreshKey = 0,
  onOpenNewDemand,
  onCompleteWithRecord,
  onTodoCountChange,
}) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null); // YYYY-MM-DD

  // 视图模式: 'time' (按时间) | 'project' (按项目分组)
  const [viewMode, setViewMode] = useState('time');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // 提醒闹钟与弹窗状态
  const [activeAlarmTodo, setActiveAlarmTodo] = useState(null);
  const [remindPickerTodo, setRemindPickerTodo] = useState(null); // 卡片快捷提醒设置弹窗
  const [remindPickerDateTime, setRemindPickerDateTime] = useState('');
  const [triggeredAlarmIds, setTriggeredAlarmIds] = useState(new Set());

  // 新建自定义 Todo 行状态
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customProject, setCustomProject] = useState('');
  const [customPriority, setCustomPriority] = useState('P1');
  const [customOwner, setCustomOwner] = useState('');
  const [customRemindAt, setCustomRemindAt] = useState('');
  const [customDate, setCustomDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // 已归档/已完成 Todo 查找区状态
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [completedTodos, setCompletedTodos] = useState([]);
  const [archivedSearchQuery, setArchivedSearchQuery] = useState('');

  // 编辑待办弹窗状态
  const [editingTodoItem, setEditingTodoItem] = useState(null);
  const [editFormTitle, setEditFormTitle] = useState('');
  const [editFormProject, setEditFormProject] = useState('');
  const [editFormPriority, setEditFormPriority] = useState('P1');
  const [editFormDate, setEditFormDate] = useState('');
  const [editFormOwner, setEditFormOwner] = useState('');
  const [editFormRemindAt, setEditFormRemindAt] = useState('');

  // 当前月历年月
  const [currentYearMonth, setCurrentYearMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  });

  // 读取 Todo 数据
  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      if (window.__TAURI_INTERNALS__) {
        const list = await invoke('query_demand_todos');
        const items = list || [];
        setTodos(items);
        onTodoCountChange?.(items.length);
      } else {
        const local = JSON.parse(localStorage.getItem('web_custom_todos') || '[]');
        setTodos(local);
        onTodoCountChange?.(local.length);
      }
    } catch (err) {
      console.error('[DemandTodoPanel] 加载 Todo 失败:', err);
    } finally {
      setLoading(false);
    }
  }, [onTodoCountChange]);

  // 读取已完成/归档 Todo 列表
  const fetchCompletedTodos = useCallback(async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const list = await invoke('query_completed_todos');
        setCompletedTodos(list || []);
      } else {
        const local = JSON.parse(localStorage.getItem('web_completed_todos') || '[]');
        setCompletedTodos(local);
      }
    } catch (err) {
      console.error('[DemandTodoPanel] 加载归档 Todo 失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
    fetchCompletedTodos();
  }, [fetchTodos, fetchCompletedTodos, refreshKey]);

  // 定时检验提醒闹钟（每 5 秒自动检视是否存在触发提醒的待办）
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      if (!todos || todos.length === 0) return;
      const now = new Date();
      const nowFormatted = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');

      todos.forEach(todo => {
        if (todo.remind_at && todo.remind_at.trim()) {
          const rTime = todo.remind_at.trim();
          if (rTime <= nowFormatted && !triggeredAlarmIds.has(todo.id)) {
            setTriggeredAlarmIds(prev => new Set([...prev, todo.id]));
            
            // 系统桌面通知
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('⏰ 待办事项提醒', {
                  body: `【${todo.demand_title || '待办'}】${todo.next_action || todo.title || ''}\n${todo.owner ? '👤 处理人: ' + todo.owner : ''}`,
                });
              } catch (e) {
                console.error('System notification error:', e);
              }
            }

            // 应用内应用级高亮闹钟弹窗
            setActiveAlarmTodo(todo);
          }
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [todos, triggeredAlarmIds]);

  // 聚合日期分布（供月历小红/橙/蓝点标注）
  const dateMap = useMemo(() => {
    const map = {};
    const todayStr = new Date().toISOString().split('T')[0];

    todos.forEach(t => {
      if (!t.target_date) return;
      const dStr = t.target_date.trim();
      if (!map[dStr]) {
        map[dStr] = { count: 0, hasOverdue: false, hasToday: false, items: [] };
      }
      map[dStr].count++;
      map[dStr].items.push(t);
      if (dStr < todayStr) map[dStr].hasOverdue = true;
      if (dStr === todayStr) map[dStr].hasToday = true;
    });

    return map;
  }, [todos]);

  // 生成当前月的日历网格日期
  const calendarDays = useMemo(() => {
    const { year, month } = currentYearMonth;
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    const days = [];
    const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 7 : firstDayOfMonth.getDay();

    for (let i = 1; i < startDayOfWeek; i++) {
      days.push({ day: null, dateStr: null });
    }

    const totalDays = lastDayOfMonth.getDate();
    for (let d = 1; d <= totalDays; d++) {
      const mm = String(month).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      days.push({ day: d, dateStr });
    }

    return days;
  }, [currentYearMonth]);

  // 打开编辑待办弹窗
  const handleOpenEditModal = (todo) => {
    setEditingTodoItem(todo);
    setEditFormTitle((todo.next_action || todo.title || '').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, ''));
    setEditFormProject(todo.demand_title || todo.project_name || '');
    setEditFormPriority(todo.priority || 'P1');
    setEditFormDate(todo.target_date || '');
    setEditFormOwner(todo.owner || '');
    setEditFormRemindAt(todo.remind_at ? todo.remind_at.replace(' ', 'T') : '');
  };

  // 保存待办属性修改
  const handleSaveEditModal = async () => {
    if (!editingTodoItem) return;
    const formattedRemind = editFormRemindAt ? editFormRemindAt.replace('T', ' ') : null;
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('update_todo_item', {
          id: editingTodoItem.id,
          demandId: editingTodoItem.demand_id || null,
          isCustom: editingTodoItem.is_custom,
          title: editFormTitle.trim(),
          projectName: editFormProject.trim() || null,
          priority: editFormPriority,
          targetDate: editFormDate || null,
          owner: editFormOwner.trim() || null,
          remindAt: formattedRemind,
        });
      } else {
        if (editingTodoItem.is_custom) {
          const local = JSON.parse(localStorage.getItem('web_custom_todos') || '[]');
          const updated = local.map(t => t.id === editingTodoItem.id ? {
            ...t,
            next_action: editFormTitle.trim(),
            demand_title: editFormProject.trim() || '独立待办',
            priority: editFormPriority,
            target_date: editFormDate,
            owner: editFormOwner.trim() || null,
            remind_at: formattedRemind,
          } : t);
          localStorage.setItem('web_custom_todos', JSON.stringify(updated));
        } else if (editingTodoItem.demand_id) {
          const localDemands = JSON.parse(localStorage.getItem('web_demands') || '[]');
          const updated = localDemands.map(d => d.id === editingTodoItem.demand_id ? {
            ...d,
            next_step: editFormTitle.trim(),
            title: editFormProject.trim() || d.title,
            priority: editFormPriority,
            target_date: editFormDate,
            owner: editFormOwner.trim() || null,
            remind_at: formattedRemind,
          } : d);
          localStorage.setItem('web_demands', JSON.stringify(updated));
        }
      }
      setEditingTodoItem(null);
      fetchTodos();
    } catch (err) {
      console.error('[DemandTodoPanel] 保存编辑失败:', err);
      alert('保存失败: ' + err);
    }
  };

  // 快捷更新设置提醒时间
  const handleSetReminder = async (todo, remindAtStr) => {
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('update_todo_item', {
          id: todo.id,
          demandId: todo.demand_id || null,
          isCustom: todo.is_custom,
          title: (todo.next_action || todo.title || '').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, ''),
          projectName: todo.demand_title || todo.project_name || null,
          priority: todo.priority || 'P1',
          targetDate: todo.target_date || null,
          owner: todo.owner || null,
          remindAt: remindAtStr || null,
        });
      } else {
        if (todo.is_custom) {
          const local = JSON.parse(localStorage.getItem('web_custom_todos') || '[]');
          const updated = local.map(t => t.id === todo.id ? { ...t, remind_at: remindAtStr } : t);
          localStorage.setItem('web_custom_todos', JSON.stringify(updated));
        } else if (todo.demand_id) {
          const localDemands = JSON.parse(localStorage.getItem('web_demands') || '[]');
          const updated = localDemands.map(d => d.id === todo.demand_id ? { ...d, remind_at: remindAtStr } : d);
          localStorage.setItem('web_demands', JSON.stringify(updated));
        }
      }
      setRemindPickerTodo(null);
      fetchTodos();
    } catch (err) {
      console.error('[DemandTodoPanel] 设置提醒失败:', err);
      alert('设置提醒失败: ' + err);
    }
  };

  // 删除待办事项
  const handleDeleteTodo = async (todo) => {
    const todoTitle = (todo.next_action || todo.title || todo.demand_title || '').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '');
    if (!window.confirm(`确定要彻底删除待办事项「${todoTitle}」吗？`)) return;
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('delete_todo_item', {
          id: todo.id,
          demandId: todo.demand_id || null,
          isCustom: todo.is_custom,
        });
      } else {
        if (todo.is_custom) {
          const local = JSON.parse(localStorage.getItem('web_custom_todos') || '[]');
          const updated = local.filter(t => t.id !== todo.id);
          localStorage.setItem('web_custom_todos', JSON.stringify(updated));
        } else if (todo.demand_id) {
          const localDemands = JSON.parse(localStorage.getItem('web_demands') || '[]');
          const updated = localDemands.map(d => d.id === todo.demand_id ? { ...d, next_step: null } : d);
          localStorage.setItem('web_demands', JSON.stringify(updated));
        }
      }
      fetchTodos();
    } catch (err) {
      console.error('[DemandTodoPanel] 删除待办失败:', err);
      alert('删除失败: ' + err);
    }
  };

  // 创建自定义 Todo
  const handleCreateCustom = async () => {
    if (!customTitle.trim()) {
      alert('请填写待办事项内容');
      return;
    }
    const formattedRemind = customRemindAt ? customRemindAt.replace('T', ' ') : null;
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('create_custom_todo', {
          title: customTitle.trim(),
          projectName: customProject.trim() || '独立待办',
          priority: customPriority,
          targetDate: customDate,
          owner: customOwner.trim() || null,
          remindAt: formattedRemind,
        });
      } else {
        const local = JSON.parse(localStorage.getItem('web_custom_todos') || '[]');
        const todayStr = new Date().toISOString().split('T')[0];
        const diffDays = Math.ceil((new Date(customDate) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
        let daysLeftText = '未定日';
        if (diffDays < 0) daysLeftText = `已逾期 ${Math.abs(diffDays)} 天`;
        else if (diffDays === 0) daysLeftText = '今天到期';
        else if (diffDays === 1) daysLeftText = '明天到期';
        else if (diffDays > 1) daysLeftText = `${diffDays} 天后`;

        const newTodo = {
          id: 'cst_' + Date.now(),
          demand_id: null,
          demand_title: customProject.trim() || '独立待办',
          priority: customPriority,
          phase: '个人待办',
          status: 'active',
          next_action: customTitle.trim(),
          target_date: customDate,
          blocker: null,
          ddl_status: diffDays < 0 ? 'OVERDUE' : diffDays === 0 ? 'TODAY' : 'UPCOMING',
          days_left_text: daysLeftText,
          days_left_num: diffDays,
          owner: customOwner.trim() || null,
          remind_at: formattedRemind,
          is_custom: true,
          last_updated_at: Date.now(),
        };
        localStorage.setItem('web_custom_todos', JSON.stringify([newTodo, ...local]));
      }
      setCustomTitle('');
      setCustomProject('');
      setCustomOwner('');
      setCustomRemindAt('');
      setShowAddCustom(false);
      fetchTodos();
    } catch (err) {
      alert('新建待办失败: ' + err);
    }
  };

  // 完成 Todo（快捷完成并归档）
  const handleCompleteTodo = async (todo, e) => {
    e?.stopPropagation?.();
    try {
      if (todo.is_custom) {
        if (window.__TAURI_INTERNALS__) {
          await invoke('complete_custom_todo', { id: todo.id });
        } else {
          const local = JSON.parse(localStorage.getItem('web_custom_todos') || '[]');
          const updated = local.filter(t => t.id !== todo.id);
          localStorage.setItem('web_custom_todos', JSON.stringify(updated));
          const localCompleted = JSON.parse(localStorage.getItem('web_completed_todos') || '[]');
          const cleanTitle = (todo.next_action || todo.demand_title || '独立待办').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '');
          const newCompleted = {
            id: todo.id,
            demand_id: null,
            title: cleanTitle,
            project_name: todo.demand_title || '独立待办',
            completed_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
            is_custom: true,
          };
          localStorage.setItem('web_completed_todos', JSON.stringify([newCompleted, ...localCompleted]));
        }
      } else if (todo.demand_id) {
        if (window.__TAURI_INTERNALS__) {
          await invoke('complete_demand_todo', { demandId: todo.demand_id });
        } else {
          const localDemands = JSON.parse(localStorage.getItem('web_demands') || '[]');
          const updated = localDemands.map(d => d.id === todo.demand_id ? { ...d, next_step: null } : d);
          localStorage.setItem('web_demands', JSON.stringify(updated));
          const localCompleted = JSON.parse(localStorage.getItem('web_completed_todos') || '[]');
          const cleanTitle = (todo.next_action || '节点待办').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '');
          const newCompleted = {
            id: 'arc_' + Date.now(),
            demand_id: todo.demand_id,
            title: cleanTitle,
            project_name: todo.demand_title || '需求待办',
            completed_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
            is_custom: false,
          };
          localStorage.setItem('web_completed_todos', JSON.stringify([newCompleted, ...localCompleted]));
        }
      }
      fetchTodos();
    } catch (err) {
      console.error('[DemandTodoPanel] 完成 Todo 失败:', err);
    }
  };

  // 删除归档记录
  const handleDeleteCompletedTodo = async (completedItem, e) => {
    e?.stopPropagation?.();
    if (!window.confirm(`确定要清除该归档记录「${completedItem.title}」吗？`)) return;
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('delete_completed_todo', {
          id: completedItem.id,
          isCustom: !!completedItem.is_custom,
        });
      } else {
        const localCompleted = JSON.parse(localStorage.getItem('web_completed_todos') || '[]');
        const updated = localCompleted.filter(c => c.id !== completedItem.id);
        localStorage.setItem('web_completed_todos', JSON.stringify(updated));
      }
      fetchCompletedTodos();
    } catch (err) {
      console.error('[DemandTodoPanel] 删除归档 Todo 失败:', err);
    }
  };

  // 过滤后的待办事项
  const filteredTodos = useMemo(() => {
    if (!selectedCalendarDate) return todos;
    return todos.filter(t => t.target_date && t.target_date.trim() === selectedCalendarDate);
  }, [todos, selectedCalendarDate]);

  // 按项目分组计算组别
  const groupedTodos = useMemo(() => {
    const map = {};
    filteredTodos.forEach(t => {
      const groupKey = (t.demand_title || t.project_name || '独立待办').trim();
      if (!map[groupKey]) {
        map[groupKey] = {
          name: groupKey,
          demand_id: t.demand_id,
          items: [],
          earliestNum: 99999,
        };
      }
      map[groupKey].items.push(t);
      if (t.days_left_num < map[groupKey].earliestNum) {
        map[groupKey].earliestNum = t.days_left_num;
      }
    });
    return Object.values(map).sort((a, b) => a.earliestNum - b.earliestNum);
  }, [filteredTodos]);

  // 搜索过滤后的归档 Todo 列表
  const filteredCompletedTodos = useMemo(() => {
    if (!archivedSearchQuery.trim()) return completedTodos;
    const q = archivedSearchQuery.toLowerCase();
    return completedTodos.filter(item =>
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.project_name && item.project_name.toLowerCase().includes(q))
    );
  }, [completedTodos, archivedSearchQuery]);

  // 单个 Todo 卡片渲染函数
  const renderTodoCard = (todo) => {
    const daysNum = todo.days_left_num;
    const daysText = todo.days_left_text;

    let tagBg = '#f1f5f9';
    let tagColor = '#475569';
    if (daysNum < 0) {
      tagBg = '#fef2f2'; tagColor = '#dc2626';
    } else if (daysNum === 0 || daysNum === 1) {
      tagBg = '#fffbeb'; tagColor = '#d97706';
    } else if (daysNum <= 3) {
      tagBg = '#eff6ff'; tagColor = '#2563eb';
    }

    let priBg = '#f1f5f9';
    let priText = '#64748b';
    if (todo.priority === 'P0') { priBg = '#fef2f2'; priText = '#dc2626'; }
    if (todo.priority === 'P1') { priBg = '#fffbeb'; priText = '#d97706'; }
    if (todo.priority === 'P2') { priBg = '#f0fdf4'; priText = '#16a34a'; }

    const fullTodoText = ((todo.next_action || todo.title || '').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '') || '推进下一步工作');

    return (
      <div
        key={todo.id}
        onDoubleClick={() => {
          if (!todo.is_custom && onDoubleClickTodo) {
            onDoubleClickTodo(todo);
          } else {
            handleOpenEditModal(todo);
          }
        }}
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          transition: 'box-shadow 0.15s ease, background 0.15s ease',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#f8fafc';
          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#ffffff';
          e.currentTarget.style.boxShadow = 'none';
        }}
        title={todo.is_custom ? '双击查看/编辑待办详情' : '双击联动左侧需求时间线详情页'}
      >
        {/* 第一行：元信息与显式操作按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            {/* 前置复选框：快捷完成归档 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCompleteTodo(todo, e);
              }}
              style={{
                width: 16, height: 16, borderRadius: 4,
                border: '1.5px solid #94a3b8', background: '#fff',
                cursor: 'pointer', flexShrink: 0, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.background = '#ecfdf5';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#94a3b8';
                e.currentTarget.style.background = '#fff';
              }}
              title="点击勾选完成并自动归档该待办"
            />

            {/* 优先级 Pill */}
            <span style={{
              padding: '1px 5px', borderRadius: '4px',
              background: priBg, color: priText, fontWeight: '700', fontSize: '10px',
              flexShrink: 0
            }}>
              {todo.priority || 'P1'}
            </span>

            {/* 项目/需求名称（完整无挤压展示） */}
            <span style={{
              fontWeight: '700', color: '#0f172a', fontSize: '12px',
              whiteSpace: 'nowrap', flexShrink: 0
            }}>
              {todo.demand_title}
            </span>

            {/* 👤 处理人/对接人标签 */}
            {todo.owner ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditModal(todo);
                }}
                style={{
                  padding: '1px 5px', borderRadius: '4px',
                  background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd',
                  fontWeight: '600', fontSize: '10px', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: '2px', cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                title="点击修改处理人"
              >
                👤 {todo.owner}
              </span>
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditModal(todo);
                }}
                style={{
                  padding: '1px 4px', borderRadius: '4px',
                  background: '#f8fafc', color: '#94a3b8', border: '1px dashed #cbd5e1',
                  fontWeight: '500', fontSize: '10px', flexShrink: 0,
                  cursor: 'pointer', whiteSpace: 'nowrap'
                }}
                title="点击添加研发/设计/对接处理人"
              >
                + 处理人
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '4px' }}>
            {/* 截止日期 */}
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
              {todo.target_date ? todo.target_date.slice(5) : '未定日'}
            </span>

            {/* 倒计时 Tag */}
            <span style={{
              padding: '1px 6px', borderRadius: '10px',
              background: tagBg, color: tagColor, fontWeight: '700', fontSize: '10px',
              whiteSpace: 'nowrap'
            }}>
              {daysText}
            </span>

            {/* ⏰ 提醒闹钟按钮（极简 Line SVG 图标） */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRemindPickerTodo(todo);
                setRemindPickerDateTime(todo.remind_at ? todo.remind_at.replace(' ', 'T') : '');
              }}
              style={{
                padding: '2px 6px', borderRadius: '6px',
                border: todo.remind_at ? '1px solid #fde68a' : '1px solid transparent',
                background: todo.remind_at ? '#fef3c7' : 'transparent',
                color: todo.remind_at ? '#d97706' : '#94a3b8',
                cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!todo.remind_at) {
                  e.currentTarget.style.color = '#d97706';
                  e.currentTarget.style.background = '#fffbeb';
                  e.currentTarget.style.borderColor = '#fde68a';
                }
              }}
              onMouseLeave={e => {
                if (!todo.remind_at) {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
              title={todo.remind_at ? `已设置提醒: ${todo.remind_at}（点击修改）` : '设置到期/跟进闹钟提醒'}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
              {todo.remind_at ? todo.remind_at.slice(5, 16) : ''}
            </button>

            {/* 显式编辑图标（复用时间线卡片图标样式 ✎） */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEditModal(todo);
              }}
              style={{
                width: 24, height: 24, borderRadius: 6,
                border: '1px solid transparent',
                background: 'transparent',
                color: '#cbd5e1',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#2563eb';
                e.currentTarget.style.background = '#eff6ff';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#cbd5e1';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              title="编辑此条待办属性（内容/处理人/优先级/日期/提醒）"
            >
              ✎
            </button>

            {/* 显式删除图标（复用时间线卡片图标样式 ×） */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTodo(todo);
              }}
              style={{
                width: 24, height: 24, borderRadius: 6,
                border: '1px solid transparent',
                background: 'transparent',
                color: '#cbd5e1',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.background = '#fef2f2';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#cbd5e1';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              title="彻底删除此条待办"
            >
              ×
            </button>
          </div>
        </div>

        {/* 第二行：展示待办事项内容 + 右下角【完成】按钮 */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justify: 'space-between',
          gap: '8px',
          paddingLeft: '22px',
          marginTop: '2px',
        }}>
          <div style={{
            fontSize: '12px',
            color: '#334155',
            fontWeight: '500',
            lineHeight: '1.45',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            flex: 1,
          }}>
            {fullTodoText}
          </div>

          {/* 右下角【完成】按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onCompleteWithRecord) {
                onCompleteWithRecord(todo);
              } else {
                handleCompleteTodo(todo, e);
              }
            }}
            style={{
              padding: '3px 10px',
              borderRadius: '6px',
              border: '1px solid #c7d2fe',
              background: '#eef2ff',
              color: '#4338ca',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#4338ca';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#4338ca';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#eef2ff';
              e.currentTarget.style.color = '#4338ca';
              e.currentTarget.style.borderColor = '#c7d2fe';
            }}
            title="完成该待办：拉起需求记录表，继承项目名称，卡点与内容置空"
          >
            ✓ 完成
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      width: '480px', minWidth: '440px', flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column',
      background: '#ffffff', borderLeft: '1px solid #e2e8f0', userSelect: 'none'
    }}>
      {/* ── 顶部 Header ── */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        gap: '8px',
        whiteSpace: 'nowrap',
      }}>
        <div style={{ minWidth: 0, flexShrink: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
            待办日程表 ({todos.length})
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            双击推进节点 / 支持处理人与闹钟提醒
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {/* 视图切换 Switcher: 按时间 vs 按项目分组 */}
          <div style={{
            display: 'flex', background: '#e2e8f0', padding: '2px', borderRadius: '6px', fontSize: '11px', flexShrink: 0
          }}>
            <button
              onClick={() => setViewMode('time')}
              style={{
                border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                background: viewMode === 'time' ? '#ffffff' : 'transparent',
                color: viewMode === 'time' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'time' ? '700' : '500',
                boxShadow: viewMode === 'time' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="按截止时间紧迫度排序展示"
            >
              📅 时间
            </button>
            <button
              onClick={() => setViewMode('project')}
              style={{
                border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                background: viewMode === 'project' ? '#ffffff' : 'transparent',
                color: viewMode === 'project' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'project' ? '700' : '500',
                boxShadow: viewMode === 'project' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="按相同项目/需求归类堆叠展示"
            >
              📁 项目分组
            </button>
          </div>

          {/* 已归档待办查找入口 */}
          <button
            onClick={() => {
              const nextState = !showArchivedModal;
              setShowArchivedModal(nextState);
              if (nextState) fetchCompletedTodos();
            }}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: `1px solid ${showArchivedModal ? '#818cf8' : '#cbd5e1'}`,
              background: showArchivedModal ? '#e0e7ff' : '#ffffff',
              color: showArchivedModal ? '#3730a3' : '#334155',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {showArchivedModal ? '关闭归档' : '📁 归档'}
          </button>

          <button
            onClick={() => setShowAddCustom(!showAddCustom)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: showAddCustom ? '#e2e8f0' : '#ffffff',
              color: '#334155',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {showAddCustom ? '取消' : '+ 自定义'}
          </button>
        </div>
      </div>

      {/* ── 展开区：已归档待办查找区 ── */}
      {showArchivedModal && (
        <div style={{
          padding: '12px 14px',
          background: '#f8fafc',
          borderBottom: '2px solid #e0e7ff',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '260px',
          overflowY: 'auto',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '700', color: '#3730a3', fontSize: '12px' }}>
              📁 已完成归档待办 ({completedTodos.length})
            </span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>按完成时间倒序排列</span>
          </div>

          <input
            type="text"
            placeholder="🔍 搜索归档待办 / 项目名称..."
            value={archivedSearchQuery}
            onChange={e => setArchivedSearchQuery(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #c7d2fe',
              fontSize: '11px',
              outline: 'none',
              background: '#ffffff',
            }}
          />

          {filteredCompletedTodos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: '11px' }}>
              未匹配到已归档的待办记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredCompletedTodos.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '11px' }}>✓</span>
                    <span style={{
                      fontWeight: '500', color: '#475569',
                      textDecoration: 'line-through',
                      fontSize: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: '4px',
                      background: '#f1f5f9', color: '#475569',
                      fontSize: '10px', fontWeight: '600'
                    }}>
                      {item.project_name}
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {item.completed_at}
                    </span>
                    <button
                      onClick={(e) => handleDeleteCompletedTodo(item, e)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        lineHeight: 1,
                        transition: 'color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#ef4444';
                        e.currentTarget.style.background = '#fef2f2';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="清除此条归档记录"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 左/上半部：月度日历盘 (Month Calendar) ── */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: '700', color: '#334155', fontSize: '12px' }}>
            {currentYearMonth.year}年 {currentYearMonth.month}月
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedCalendarDate && (
              <span
                onClick={() => setSelectedCalendarDate(null)}
                style={{ cursor: 'pointer', color: '#4f46e5', fontWeight: '600', fontSize: '11px', textDecoration: 'underline' }}
              >
                查看全部 ({selectedCalendarDate}) ✖
              </span>
            )}
            <button
              onClick={() => {
                let m = currentYearMonth.month - 1;
                let y = currentYearMonth.year;
                if (m < 1) { m = 12; y--; }
                setCurrentYearMonth({ year: y, month: m });
              }}
              style={{ border: 'none', background: '#f1f5f9', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }}
            >
              ‹
            </button>
            <button
              onClick={() => {
                let m = currentYearMonth.month + 1;
                let y = currentYearMonth.year;
                if (m > 12) { m = 1; y++; }
                setCurrentYearMonth({ year: y, month: m });
              }}
              style={{ border: 'none', background: '#f1f5f9', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }}
            >
              ›
            </button>
          </div>
        </div>

        {/* 星期 Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', color: '#94a3b8', fontSize: '10px', fontWeight: '600', marginBottom: '4px' }}>
          <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
        </div>

        {/* 日历 7xN 网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
          {calendarDays.map((item, idx) => {
            if (!item.day) {
              return <div key={`empty_${idx}`} style={{ height: '26px' }} />;
            }
            const info = dateMap[item.dateStr];
            const isSelected = selectedCalendarDate === item.dateStr;
            const isToday = item.dateStr === new Date().toISOString().split('T')[0];

            return (
              <div
                key={item.dateStr}
                onClick={() => {
                  if (info) {
                    setSelectedCalendarDate(isSelected ? null : item.dateStr);
                  }
                }}
                style={{
                  height: '26px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '5px',
                  cursor: info ? 'pointer' : 'default',
                  background: isSelected ? '#4f46e5' : isToday ? '#e0e7ff' : '#ffffff',
                  color: isSelected ? '#ffffff' : isToday ? '#4338ca' : info ? '#0f172a' : '#94a3b8',
                  fontWeight: isToday || info || isSelected ? '700' : '400',
                  position: 'relative',
                  border: isSelected ? '1px solid #4338ca' : '1px solid transparent',
                  fontSize: '11px',
                }}
              >
                <span>{item.day}</span>
                {info && (
                  <span style={{
                    width: '4px', height: '4px', borderRadius: '50%',
                    background: info.hasOverdue ? '#ef4444' : info.hasToday ? '#f59e0b' : '#3b82f6',
                    marginTop: '1px',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 新建自定义 Todo 行 ── */}
      {showAddCustom && (
        <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontWeight: '700', color: '#0369a1', fontSize: '11px' }}>快捷创建独立待办（支持设定处理人与闹钟提醒）</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select
              value={customPriority}
              onChange={e => setCustomPriority(e.target.value)}
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
            >
              <option value="P0">P0 (紧急)</option>
              <option value="P1">P1 (普通)</option>
              <option value="P2">P2 (低优)</option>
            </select>

            <input
              type="text"
              placeholder="项目/需求 (例: 垃圾清理)"
              value={customProject}
              onChange={e => setCustomProject(e.target.value)}
              style={{ width: '120px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
            />

            <input
              type="text"
              placeholder="👤 处理人 (如: 张三-前端)"
              value={customOwner}
              onChange={e => setCustomOwner(e.target.value)}
              style={{ width: '110px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
            />

            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
            />

            <input
              type="datetime-local"
              value={customRemindAt}
              onChange={e => setCustomRemindAt(e.target.value)}
              title="设置到期/跟进闹钟提醒时间"
              style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="具体要做的待办事项..."
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateCustom(); }}
              style={{ flex: 1, padding: '5px 8px', borderRadius: '4px', border: '1px solid #93c5fd', fontSize: '11px' }}
            />
            <button
              onClick={handleCreateCustom}
              style={{ padding: '5px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '11px' }}
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* ── 右半部：高密度双行 Todo 卡片列表 / 按项目分组 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
            加载待办集中...
          </div>
        ) : filteredTodos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>无匹配待办事项</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>所有跟进事项均已按时完成</div>
          </div>
        ) : viewMode === 'time' ? (
          /* 按截止时间线性视图 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTodos.map(todo => renderTodoCard(todo))}
          </div>
        ) : (
          /* 按相同项目/需求分组视图 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groupedTodos.map(group => {
              const isCollapsed = collapsedGroups[group.name];
              return (
                <div
                  key={group.name}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* 项目分组 Group Header */}
                  <div
                    onClick={() => {
                      setCollapsedGroups(prev => ({ ...prev, [group.name]: !prev[group.name] }));
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', padding: '4px 6px', userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {isCollapsed ? '►' : '▼'}
                      </span>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                        📁 {group.name}
                      </span>
                      <span style={{
                        padding: '1px 6px', borderRadius: '10px',
                        background: '#e2e8f0', color: '#475569', fontSize: '10px', fontWeight: '700'
                      }}>
                        {group.items.length} 项
                      </span>
                    </div>

                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {group.items[0]?.target_date ? `最快到期: ${group.items[0].target_date.slice(5)}` : ''}
                    </span>
                  </div>

                  {/* 组内 Todo Cards */}
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                      {group.items.map(todo => renderTodoCard(todo))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 快捷设置提醒时间 Popover ── */}
      {remindPickerTodo && (
        <div
          onClick={() => setRemindPickerTodo(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.3)', zIndex: 1200,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '12px', width: '340px', padding: '16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>⏰ 设置待办提醒闹钟</span>
              <span onClick={() => setRemindPickerTodo(null)} style={{ cursor: 'pointer', color: '#94a3b8', fontWeight: '700' }}>×</span>
            </div>

            <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600', lineHeight: 1.4 }}>
              【{remindPickerTodo.demand_title}】{(remindPickerTodo.next_action || remindPickerTodo.title || '').slice(0, 30)}...
            </div>

            {/* 快捷时间按钮预设 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                onClick={() => {
                  const d = new Date(Date.now() + 15 * 60 * 1000);
                  const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                  handleSetReminder(remindPickerTodo, str);
                }}
                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
              >
                ⚡ 15 分钟后
              </button>
              <button
                onClick={() => {
                  const d = new Date(Date.now() + 60 * 60 * 1000);
                  const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                  handleSetReminder(remindPickerTodo, str);
                }}
                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
              >
                ⚡ 1 小时后
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' 18:00';
                  handleSetReminder(remindPickerTodo, str);
                }}
                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
              >
                🌇 今天 18:00
              </button>
              <button
                onClick={() => {
                  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
                  const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' 09:00';
                  handleSetReminder(remindPickerTodo, str);
                }}
                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
              >
                🌅 明天 09:00
              </button>
            </div>

            {/* 自定义精确时间 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>自定义时间</label>
              <input
                type="datetime-local"
                value={remindPickerDateTime}
                onChange={e => setRemindPickerDateTime(e.target.value)}
                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              {remindPickerTodo.remind_at ? (
                <button
                  onClick={() => handleSetReminder(remindPickerTodo, null)}
                  style={{ border: 'none', background: 'transparent', color: '#ef4444', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  取消/清除提醒
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setRemindPickerTodo(null)}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '11px', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (!remindPickerDateTime) return;
                    handleSetReminder(remindPickerTodo, remindPickerDateTime.replace('T', ' '));
                  }}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '600', fontSize: '11px', cursor: 'pointer' }}
                >
                  确认提醒
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 到点应用内高亮闹钟提醒弹窗 (In-App Alarm Modal) ── */}
      {activeAlarmTodo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 2000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '400px', padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px',
            border: '2px solid #f59e0b', position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: '#fef3c7', color: '#d97706', fontSize: '22px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'bounce 1s infinite'
              }}>
                ⏰
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '16px', color: '#0f172a' }}>待办日程提醒到期</div>
                <div style={{ fontSize: '11px', color: '#d97706', fontWeight: '600' }}>提醒时间: {activeAlarmTodo.remind_at}</div>
              </div>
            </div>

            <div style={{
              padding: '12px', background: '#f8fafc', borderRadius: '10px',
              border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                📁 {activeAlarmTodo.demand_title}
              </div>
              <div style={{ fontSize: '13px', color: '#334155', fontWeight: '500', lineHeight: 1.4 }}>
                {(activeAlarmTodo.next_action || activeAlarmTodo.title || '').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '')}
              </div>
              {activeAlarmTodo.owner && (
                <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '600' }}>
                  👤 处理人: {activeAlarmTodo.owner}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  const d = new Date(Date.now() + 15 * 60 * 1000);
                  const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                  handleSetReminder(activeAlarmTodo, str);
                  setActiveAlarmTodo(null);
                }}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#475569', fontWeight: '600', fontSize: '12px', cursor: 'pointer'
                }}
              >
                稍后 15 分钟再提醒
              </button>
              <button
                onClick={() => {
                  handleSetReminder(activeAlarmTodo, null);
                  setActiveAlarmTodo(null);
                }}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: '#f59e0b', color: '#ffffff', fontWeight: '700', fontSize: '12px', cursor: 'pointer'
                }}
              >
                知道了 / 完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 编辑待办属性弹窗 ── */}
      {editingTodoItem && (
        <div
          onClick={() => setEditingTodoItem(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '12px', width: '460px', padding: '20px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>✏️ 编辑待办事项</span>
              <span onClick={() => setEditingTodoItem(null)} style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '16px', fontWeight: '700' }}>×</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>待办内容描述</label>
              <textarea
                rows={3}
                value={editFormTitle}
                onChange={e => setEditFormTitle(e.target.value)}
                placeholder="具体要做的待办事项..."
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>项目 / 需求名称</label>
                <input
                  type="text"
                  value={editFormProject}
                  onChange={e => setEditFormProject(e.target.value)}
                  style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>👤 处理人 / 负责对接人</label>
                <input
                  type="text"
                  placeholder="如: 张三 (前端)"
                  value={editFormOwner}
                  onChange={e => setEditFormOwner(e.target.value)}
                  style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ width: '90px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>优先级</label>
                <select
                  value={editFormPriority}
                  onChange={e => setEditFormPriority(e.target.value)}
                  style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                >
                  <option value="P0">P0 (紧急)</option>
                  <option value="P1">P1 (普通)</option>
                  <option value="P2">P2 (低优)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>截止日期</label>
                <input
                  type="date"
                  value={editFormDate}
                  onChange={e => setEditFormDate(e.target.value)}
                  style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>⏰ 提醒闹钟时间</label>
                <input
                  type="datetime-local"
                  value={editFormRemindAt}
                  onChange={e => setEditFormRemindAt(e.target.value)}
                  style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => setEditingTodoItem(null)}
                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleSaveEditModal}
                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部统计栏 */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b'
      }}>
        <span>共 {filteredTodos.length} 项需跟进</span>
        <button
          onClick={onOpenNewDemand}
          style={{
            border: 'none', background: '#4f46e5', color: '#fff', fontSize: '11px', fontWeight: '600',
            padding: '4px 10px', borderRadius: '5px', cursor: 'pointer'
          }}
        >
          + 新增需求
        </button>
      </div>
    </div>
  );
}
