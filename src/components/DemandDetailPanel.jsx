import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * DemandDetailPanel — 需求详情侧边面板
 * 两个区域: A. 状态速览 / B. 推进时间线（附件随节点自动关联展示）
 */

const PHASES = ['需求调研', '方案设计', '评审排期', '开发联调', '测试验收', '灰度上线', '全量上线'];
const STATUSES = [
  { key: 'planning', label: '规划中', color: '#7c3aed' },
  { key: 'active',   label: '进行中', color: '#2563eb' },
  { key: 'hold',     label: 'Hold',    color: '#d97706' },
  { key: 'done',     label: '已完成', color: '#059669' },
];

const NODE_TYPES = {
  progress:   { label: '进展', icon: '▸', color: '#2563eb' },
  conclusion: { label: '结论', icon: '★', color: '#7c3aed' },
  document:   { label: '文档', icon: '📄', color: '#0891b2' },
  milestone:  { label: '里程碑', icon: '🏁', color: '#059669' },
  blocker:    { label: '卡点', icon: '⚠', color: '#dc2626' },
  // 阶段类型（当 nodeType 为阶段名时匹配）
  '需求调研':  { label: '需求调研', icon: '🔍', color: '#8b5cf6' },
  '方案设计':  { label: '方案设计', icon: '✏️', color: '#6366f1' },
  '评审排期':  { label: '评审排期', icon: '📋', color: '#2563eb' },
  '开发联调':  { label: '开发联调', icon: '⚙️', color: '#0891b2' },
  '测试验收':  { label: '测试验收', icon: '🧪', color: '#059669' },
  '灰度上线':  { label: '灰度上线', icon: '🚀', color: '#d97706' },
  '全量上线':  { label: '全量上线', icon: '🎉', color: '#10b981' },
};

// 解析「下一步」字段：拆出可选的 [YYYY-MM-DD] 日期前缀与纯文本
function parseNextActionField(raw) {
  if (!raw) return { text: '', date: '' };
  const m = String(raw).trim().match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.+)$/);
  if (m) return { text: m[2], date: m[1] };
  return { text: String(raw).trim(), date: '' };
}

export default function DemandDetailPanel({ demand, onClose, onUpdate, onOpenArchiveModal, onBack, mode = 'sidebar' }) {
  const [nodes, setNodes] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [editField, setEditField] = useState(null); // 当前正在编辑的字段
  const [editValue, setEditValue] = useState('');
  const [panelWidth, setPanelWidth] = useState(mode === 'main' ? 720 : 420);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const dragRef = useRef(null);

  const isMain = mode === 'main';

  // ── 加载需求下的节点（时间倒序） ──
  const loadNodes = useCallback(async () => {
    if (!demand?.id) return;
    setLoadingNodes(true);
    try {
      const data = await invoke('query_demand_nodes', { demandId: demand.id });
      // 按时间倒序排列（最新的在最上面）
      const sorted = (data || []).sort((a, b) => {
        const ta = a.archivedAt || 0;
        const tb = b.archivedAt || 0;
        return tb - ta;
      });
      setNodes(sorted);
    } catch (e) {
      console.error('Load nodes failed:', e);
    } finally {
      setLoadingNodes(false);
    }
  }, [demand?.id]);

  useEffect(() => { loadNodes(); }, [loadNodes]);

  // ── 拖拽调宽（main 模式右侧手柄 / sidebar 模式左侧手柄） ──
  // side: 'right'（main 模式，手柄在右侧，向右拖=宽度增）
  //       'left'（sidebar 模式，手柄在左侧，向左拖=宽度增）
  const handleMouseDown = (e, side = 'left') => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: panelWidth };
    document.body.style.userSelect = 'none';
    const onMove = (ev) => {
      // 手柄在右：向右拖 = panelWidth 增大；手柄在左：向左拖 = panelWidth 增大
      const delta = ev.clientX - dragRef.current.startX;
      const diff = side === 'right' ? delta : -delta;
      // main 模式上限随窗口宽度动态（保证 todo 区至少有 360px），sidebar 模式上限固定 700
      const maxAllowed = isMain
        ? Math.max(800, window.innerWidth - 360)
        : 700;
      setPanelWidth(Math.max(340, Math.min(maxAllowed, dragRef.current.startW + diff)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      dragRef.current = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── 行内编辑提交 ──
  const handleSaveField = async (field) => {
    try {
      const update = { id: demand.id, [field]: editValue };
      await invoke('update_demand', { input: update });
      setEditField(null);
      onUpdate();
    } catch (e) {
      console.error('Update field failed:', e);
    }
  };

  // ── 删除需求 ──
  const handleDeleteDemand = async () => {
    try {
      await invoke('delete_demand', { id: demand.id });
      setDeleteConfirmId(null);
      onClose();
      onUpdate();
    } catch (e) {
      console.error('Delete demand failed:', e);
    }
  };

  // ── 记录新节点 ──
  const handleAddNode = () => {
    if (onOpenArchiveModal) {
      onOpenArchiveModal({ demandId: demand.id, demandTitle: demand.title });
    }
  };

  const statusObj = STATUSES.find(s => s.key === demand.status) || STATUSES[0];

  return (
    <div style={{
      // main 模式（需求流程区）：flex-grow 1 / flex-basis 0%
      //   → 窗口宽度超过「看板侧栏 240 + 详情区最小宽 + todo 区固定宽」之和后，
      //     全部新增宽度由本区域吸收（左右两侧均为固定宽度、不参与 grow）
      //   注意必须用 basis 0% 而非 auto：basis:auto 会退回读取 width，
      //   配合 width:100% 会让本区域尺寸锚定在父容器全宽上，导致 grow 失效。
      // sidebar 模式：panelWidth 用作 flex basis（固定宽度，由左侧手柄拖拽调整）
      flex: isMain ? '1 1 0%' : `0 0 ${panelWidth}px`,
      width: isMain ? 'auto' : '100%',
      minWidth: 0,
      maxWidth: '100%',
      borderLeft: isMain ? 'none' : '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      background: '#fff', position: 'relative', overflow: 'hidden',
    }}>
      {/* 拖拽手柄（仅 sidebar 模式：左侧） */}
      {/* main 模式下不设手柄：拖拽手柄统一由 todo 区左边缘承担（详情面板 ↔ todo 区 之间的分割线） */}
      {!isMain && (
        <div
          onMouseDown={(e) => handleMouseDown(e, 'left')}
          style={{
            position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize',
            zIndex: 10, background: 'transparent',
          }}
          onMouseEnter={e => e.target.style.background = '#2563eb33'}
          onMouseLeave={e => e.target.style.background = 'transparent'}
        />
      )}

      {/* 面板内容 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ── 头部 ── */}
        <div style={{
          padding: isMain ? '22px 40px 18px' : '16px 20px',
          borderBottom: '1px solid #f3f4f6', background: '#fafbfc',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              {isMain && onBack && (
                <button onClick={onBack} style={{
                  width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                  background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#374151', fontWeight: 600, flexShrink: 0,
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                  title="返回看板"
                >←</button>
              )}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 6,
                background: demand.priority === 'P0' ? '#fef2f2' : demand.priority === 'P2' ? '#f0fdf4' : '#fffbeb',
                color: demand.priority === 'P0' ? '#dc2626' : demand.priority === 'P2' ? '#16a34a' : '#d97706',
                border: `1px solid ${demand.priority === 'P0' ? '#fecaca' : demand.priority === 'P2' ? '#bbf7d0' : '#fde68a'}`,
                flexShrink: 0,
              }}>{demand.priority || 'P1'}</span>
              <h3 style={{
                fontSize: isMain ? 20 : 16, fontWeight: 700, color: '#1f2937', margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{demand.title}</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                background: `${statusObj.color}15`, color: statusObj.color,
              }}>
                {statusObj.label}{demand.phase ? ` · ${demand.phase}` : ''}
              </span>
              <button onClick={onClose} style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb',
                background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9ca3af',
              }}>✕</button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 12 }}>
            {demand.version && <span>版本: {demand.version}</span>}
            {demand.expectedMergeDate && <span>预计合流: {demand.expectedMergeDate}</span>}
            {demand.onlineDate && <span>上线: {demand.onlineDate}</span>}
            <span>节点 {nodes.length} 条</span>
            <span>创建于 {new Date(demand.createdAt * 1000).toLocaleDateString()}</span>
          </div>
        </div>

        {/* ── A. 状态速览 ── */}
        <StatusOverviewSection
          demand={demand}
          isMain={isMain}
          statusObj={statusObj}
          editField={editField}
          editValue={editValue}
          onStartEdit={(field, value) => {
            setEditField(field);
            setEditValue(value || '');
          }}
          onSave={handleSaveField}
          onCancelEdit={() => setEditField(null)}
          onChange={setEditValue}
        />

        {/* ── B. 推进时间线 ── 节点内容完整直接展示，每节点带可删除按钮 */}
        <TimelineSection
          nodes={nodes}
          loadingNodes={loadingNodes}
          isMain={isMain}
          onAddNode={handleAddNode}
          onNodeDeleted={loadNodes}
          onNodeUpdated={loadNodes}
        />

        {/* ── 底部操作区 ── */}
        <div style={{ padding: isMain ? '22px 40px' : '14px 20px', borderTop: '1px solid #f3f4f6' }}>
          {deleteConfirmId === demand.id ? (
            <div style={{
              padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>⚠️ 确认删除此需求？</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setDeleteConfirmId(null)} style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 11, border: '1px solid #e5e7eb',
                  background: '#fff', color: '#6b7280', cursor: 'pointer',
                }}>取消</button>
                <button onClick={handleDeleteDemand} style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 11, border: 'none',
                  background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 500,
                }}>确认删除</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirmId(demand.id)} style={{
              width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 12,
              border: '1px solid #fecaca', background: '#fff', color: '#ef4444',
              cursor: 'pointer', fontWeight: 500,
            }}>删除需求</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 行内可编辑字段 ──────────────────────────────────
function FieldRow({ label, value, isEditing, onEdit, onSave, onCancel, valueColor, renderEditor, fullWidth }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
      gridColumn: fullWidth ? 'span 2' : undefined,
    }}>
      <span style={{ color: '#9ca3af', flexShrink: 0, minWidth: 50 }}>{label}:</span>
      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          {renderEditor()}
          <button onClick={onSave} style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none',
            background: '#2563eb', color: '#fff', cursor: 'pointer',
          }}>✓</button>
          <button onClick={onCancel} style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb',
            background: '#fff', color: '#9ca3af', cursor: 'pointer',
          }}>✕</button>
        </div>
      ) : (
        <span
          onClick={onEdit}
          style={{
            color: valueColor || '#374151', fontWeight: 500, cursor: 'pointer',
            borderBottom: '1px dashed #e5e7eb', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          title="点击编辑"
        >
          {value}
        </span>
      )}
    </div>
  );
}

// ── 区域标题（统一 A/B/C 风格：彩色字母 + 标题文字） ───────
function SectionTitle({ letter, color, title }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color }}>{letter}</span> {title}
    </div>
  );
}

// ── 统一输入框样式（所有行内编辑器复用） ───────────────
const editorInputStyle = { fontSize: 12, padding: '2px 6px', borderRadius: 4, border: '1px solid #d1d5db', outline: 'none' };

// ── A. 状态速览区（所有需求复用同一份渲染逻辑） ───────
function StatusOverviewSection({
  demand, isMain, statusObj,
  editField, editValue,
  onStartEdit, onSave, onCancelEdit, onChange,
}) {
  return (
    <div style={{ padding: isMain ? '22px 40px' : '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
      <SectionTitle letter="A" color="#2563eb" title="状态速览" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* 当前阶段 */}
        <FieldRow
          label="当前阶段"
          value={demand.phase || '未设定'}
          isEditing={editField === 'phase'}
          onEdit={() => onStartEdit('phase', demand.phase)}
          onSave={() => onSave('phase')}
          onCancel={onCancelEdit}
          valueColor="#2563eb"
          renderEditor={() => (
            <select value={editValue} onChange={e => onChange(e.target.value)} autoFocus style={editorInputStyle}>
              <option value="">未设定</option>
              {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        />
        {/* 状态 */}
        <FieldRow
          label="状态"
          value={statusObj.label}
          isEditing={editField === 'status'}
          onEdit={() => onStartEdit('status', demand.status)}
          onSave={() => onSave('status')}
          onCancel={onCancelEdit}
          valueColor={statusObj.color}
          renderEditor={() => (
            <select value={editValue} onChange={e => onChange(e.target.value)} autoFocus style={editorInputStyle}>
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          )}
        />
        {/* 版本字段 */}
        <FieldRow
          label="版本字段"
          value={demand.version || '未设定'}
          isEditing={editField === 'version'}
          onEdit={() => onStartEdit('version', demand.version)}
          onSave={() => onSave('version')}
          onCancel={onCancelEdit}
          renderEditor={() => (
            <input value={editValue} onChange={e => onChange(e.target.value)} autoFocus placeholder="如 V2.3 / Q3 灰度版"
              onKeyDown={e => e.key === 'Enter' && onSave('version')}
              style={{ ...editorInputStyle, width: '100%' }} />
          )}
        />
        {/* 优先级 */}
        <FieldRow
          label="优先级"
          value={demand.priority || 'P1'}
          valueColor={demand.priority === 'P0' ? '#dc2626' : demand.priority === 'P2' ? '#16a34a' : '#d97706'}
          isEditing={editField === 'priority'}
          onEdit={() => onStartEdit('priority', demand.priority || 'P1')}
          onSave={() => onSave('priority')}
          onCancel={onCancelEdit}
          renderEditor={() => (
            <select value={editValue} onChange={e => onChange(e.target.value)} autoFocus style={editorInputStyle}>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
            </select>
          )}
        />
        {/* 预计合流日期 */}
        <FieldRow
          label="预计合流日期"
          value={demand.expectedMergeDate || '未设定'}
          isEditing={editField === 'expectedMergeDate'}
          onEdit={() => onStartEdit('expectedMergeDate', demand.expectedMergeDate)}
          onSave={() => onSave('expectedMergeDate')}
          onCancel={onCancelEdit}
          renderEditor={() => (
            <input type="date" value={editValue} onChange={e => onChange(e.target.value)} autoFocus style={editorInputStyle} />
          )}
        />
        {/* 上线日期 */}
        <FieldRow
          label="上线日期"
          value={demand.onlineDate || '未设定'}
          isEditing={editField === 'onlineDate'}
          onEdit={() => onStartEdit('onlineDate', demand.onlineDate)}
          onSave={() => onSave('onlineDate')}
          onCancel={onCancelEdit}
          renderEditor={() => (
            <input type="date" value={editValue} onChange={e => onChange(e.target.value)} autoFocus style={editorInputStyle} />
          )}
        />
      </div>
      {/* 备注 (span 2) — 纯文本框，记录该需求的特殊记录点 */}
      <div style={{ marginTop: 8 }}>
        <FieldRow
          label="备注"
          value={demand.notes || '未填写'}
          valueColor={demand.notes ? '#374151' : '#9ca3af'}
          isEditing={editField === 'notes'}
          onEdit={() => onStartEdit('notes', demand.notes)}
          onSave={() => onSave('notes')}
          onCancel={onCancelEdit}
          fullWidth
          renderEditor={() => (
            <textarea value={editValue} onChange={e => onChange(e.target.value)} autoFocus placeholder="特殊记录点 / 注意事项"
              rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave('notes'); }}
              style={{
                ...editorInputStyle, width: '100%', resize: 'vertical',
                fontFamily: 'inherit', minHeight: 60, lineHeight: 1.6,
              }} />
          )}
        />
      </div>
    </div>
  );
}

// ── B. 推进时间线区（所有需求复用同一份渲染逻辑） ───────
function TimelineSection({ nodes, loadingNodes, isMain, onAddNode, onNodeDeleted, onNodeUpdated }) {
  return (
    <div style={{ padding: isMain ? '22px 40px' : '14px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#7c3aed' }}>B</span> 推进时间线
        </span>
        <button onClick={onAddNode} style={{
          fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500,
        }}>+ 记录节点</button>
      </div>

      {loadingNodes ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>加载中...</div>
      ) : nodes.length === 0 ? (
        <EmptyTimeline onAdd={onAddNode} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nodes.map(node => (
            <TimelineNodeCard
              key={node.id}
              node={node}
              onDeleted={onNodeDeleted}
              onUpdated={onNodeUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── B 区空态：友好引导（所有需求共用同一份） ─────────
function EmptyTimeline({ onAdd }) {
  return (
    <div style={{
      textAlign: 'center', padding: '32px 20px',
      background: 'linear-gradient(180deg, #fafbfc 0%, #f3f4f6 100%)',
      border: '1.5px dashed #d1d5db', borderRadius: 12,
    }}>
      <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.7 }}>📝</div>
      <div style={{ fontSize: 14, color: '#374151', fontWeight: 600, marginBottom: 6 }}>暂无推进节点</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14, lineHeight: 1.7 }}>
        建议在以下时机记录节点：<br/>
        <span style={{ color: '#6b7280' }}>• 完成关键调研 / 评审 / 设计稿时</span><br/>
        <span style={{ color: '#6b7280' }}>• 出现卡点或重要决策时</span><br/>
        <span style={{ color: '#6b7280' }}>• 推进到下一阶段时</span>
      </div>
      <button onClick={onAdd} style={{
        padding: '7px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600,
        background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff',
        border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(37,99,235,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.25)'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >+ 记录第一个节点</button>
    </div>
  );
}

// ── 节点卡片（所有需求的所有节点都走同一份渲染逻辑） ─────
function TimelineNodeCard({ node, onDeleted, onUpdated }) {
  const [hover, setHover] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // ── 编辑模式 state ──
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', output: '', blocker: '', nextAction: '', nextActionDate: '' });
  const [saving, setSaving] = useState(false);
  const nt = NODE_TYPES[node.nodeType] || NODE_TYPES.progress;
  const isKey = node.isKeyConclusion;
  const hasDetail = node.output || node.blocker || node.nextAction;

  // 进入编辑模式 — 预填表单
  const handleStartEdit = (e) => {
    e.stopPropagation();
    const na = parseNextActionField(node.nextAction);
    setEditForm({
      title: node.title || '',
      output: node.output || '',
      blocker: node.blocker || '',
      nextAction: na.text,
      nextActionDate: na.date,
    });
    setEditing(true);
  };

  // 取消编辑
  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditing(false);
  };

  // 保存编辑（调用 update_archive，仅更新支持的字段）
  const handleSaveEdit = async (e) => {
    e?.stopPropagation?.();
    if (saving) return;
    setSaving(true);
    try {
      // 下一步：若选择了日期，格式化为 [YYYY-MM-DD] 文本
      const nextActionStr = editForm.nextAction.trim()
        ? (editForm.nextActionDate ? `[${editForm.nextActionDate}] ${editForm.nextAction.trim()}` : editForm.nextAction.trim())
        : null;
      await invoke('update_archive', {
        archiveId: node.id,
        title: editForm.title,
        output: editForm.output,
        blocker: editForm.blocker,
        nextAction: nextActionStr,
      });
      setEditing(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Update node failed:', err);
      alert('保存节点失败：' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    try {
      await invoke('delete_archive_node', { archiveId: node.id });
      setConfirming(false);
      if (onDeleted) onDeleted();
    } catch (e) {
      console.error('Delete node failed:', e);
      alert('删除节点失败：' + (e?.message || e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); if (confirming && !deleting) setConfirming(false); }}
      style={{
        position: 'relative',
        background: isKey ? 'linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)' : '#fafbfc',
        border: `1px solid ${isKey ? '#fde68a' : '#e5e7eb'}`,
        borderLeft: `3px solid ${nt.color}`,
        borderRadius: 10,
        padding: '12px 14px',
        opacity: deleting ? 0.5 : 1,
        transition: 'opacity 0.2s, box-shadow 0.2s',
        boxShadow: hover ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      {/* 顶部行：日期 + 类型 + 关键结论 + 附件计数 + 删除 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
            {node.date} {node.time}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: `${nt.color}14`, color: nt.color,
          }}>{nt.icon} {nt.label}</span>
          {isKey && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: '#fef3c7', color: '#b45309',
            }}>★ 关键结论</span>
          )}
          {node.linkedFiles && node.linkedFiles.length > 0 && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 6,
              background: '#eef2ff', color: '#4338ca', fontWeight: 500,
            }}>📎 {node.linkedFiles.length}</span>
          )}
        </div>
        {/* 按钮区：编辑时显示保存/取消，确认删除时显示原确认 UI，否则显示编辑+删除按钮 */}
        <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          {confirming ? (
            <>
              <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>确定删除？</span>
              <button
                disabled={deleting}
                onClick={handleDelete}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6,
                  border: 'none', background: '#dc2626', color: '#fff',
                  cursor: deleting ? 'wait' : 'pointer', fontWeight: 600,
                }}
              >{deleting ? '删除中' : '确认'}</button>
              <button
                disabled={deleting}
                onClick={() => setConfirming(false)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6,
                  border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >取消</button>
            </>
          ) : editing ? (
            <>
              <button
                disabled={saving}
                onClick={handleSaveEdit}
                style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 6,
                  border: 'none', background: '#2563eb', color: '#fff',
                  cursor: saving ? 'wait' : 'pointer', fontWeight: 600,
                }}
              >{saving ? '保存中' : '保存'}</button>
              <button
                disabled={saving}
                onClick={handleCancelEdit}
                style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 6,
                  border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >取消</button>
            </>
          ) : (
            <>
              {/* 编辑按钮 */}
              <button
                onClick={handleStartEdit}
                style={{
                  width: 24, height: 24, borderRadius: 6,
                  border: '1px solid ' + (hover ? '#bfdbfe' : 'transparent'),
                  background: hover ? '#eff6ff' : 'transparent',
                  color: hover ? '#2563eb' : '#cbd5e1',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                title="编辑节点"
              >✎</button>
              {/* 删除按钮 */}
              <button
                onClick={() => setConfirming(true)}
                style={{
                  width: 24, height: 24, borderRadius: 6,
                  border: '1px solid ' + (hover ? '#fecaca' : 'transparent'),
                  background: hover ? '#fef2f2' : 'transparent',
                  color: hover ? '#dc2626' : '#cbd5e1',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                title="删除节点"
              >×</button>
            </>
          )}
        </div>
      </div>

      {/* 标题 / 编辑输入框 */}
      {editing ? (
        <div style={{ marginBottom: 10 }}>
          <input
            value={editForm.title}
            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
            placeholder="节点标题"
            autoFocus
            style={{
              width: '100%', padding: '6px 10px', fontSize: 13, fontWeight: 600,
              border: '1px solid #c7d2fe', borderRadius: 6, outline: 'none',
              background: '#fff', color: '#1f2937',
              boxSizing: 'border-box',
            }}
          />
        </div>
      ) : (
        <div style={{
          fontSize: 14, color: '#1f2937', fontWeight: isKey ? 700 : 600,
          lineHeight: 1.5, marginBottom: hasDetail ? 8 : 0,
        }}>{node.title}</div>
      )}

      {/* 详情块 / 编辑表单 */}
      {editing ? (
        <div style={{
          background: '#fff', borderRadius: 8, padding: '10px 12px',
          border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', lineHeight: 1.7,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* 产出 */}
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4, fontWeight: 600, letterSpacing: 0.3 }}>📝 产出</div>
            <textarea
              value={editForm.output}
              onChange={e => setEditForm(f => ({ ...f, output: e.target.value }))}
              placeholder="本次节点的产出/结论（可留空）"
              rows={2}
              style={{
                width: '100%', padding: '5px 8px', fontSize: 12,
                border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none',
                background: '#fafbfc', color: '#374151', resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
          {/* 卡点 */}
          <div>
            <div style={{ fontSize: 10, color: '#dc2626', marginBottom: 4, fontWeight: 600, letterSpacing: 0.3 }}>⚠ 卡点</div>
            <input
              value={editForm.blocker}
              onChange={e => setEditForm(f => ({ ...f, blocker: e.target.value }))}
              placeholder="当前阻塞点（可留空）"
              style={{
                width: '100%', padding: '5px 8px', fontSize: 12,
                border: '1px solid #fecaca', borderRadius: 6, outline: 'none',
                background: '#fef2f2', color: '#374151',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {/* 下一步（支持选择日期） */}
          <div>
            <div style={{ fontSize: 10, color: '#2563eb', marginBottom: 4, fontWeight: 600, letterSpacing: 0.3 }}>➤ 下一步（可设定日期）</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="date"
                value={editForm.nextActionDate}
                onChange={e => setEditForm(f => ({ ...f, nextActionDate: e.target.value }))}
                style={{
                  width: 138, padding: '5px 6px', fontSize: 11,
                  border: '1px solid #bfdbfe', borderRadius: 6, outline: 'none',
                  background: '#eff6ff', color: '#374151',
                  boxSizing: 'border-box', flexShrink: 0,
                }}
              />
              <input
                value={editForm.nextAction}
                onChange={e => setEditForm(f => ({ ...f, nextAction: e.target.value }))}
                placeholder="接下来要做什么（可留空）"
                style={{
                  flex: 1, padding: '5px 8px', fontSize: 12,
                  border: '1px solid #bfdbfe', borderRadius: 6, outline: 'none',
                  background: '#eff6ff', color: '#374151',
                  boxSizing: 'border-box', minWidth: 0,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        hasDetail && (
          <div style={{
            background: '#fff', borderRadius: 8, padding: '10px 12px',
            border: '1px solid #f3f4f6', fontSize: 12, color: '#374151', lineHeight: 1.7,
          }}>
            {node.output && (
              <div style={{ marginBottom: (node.blocker || node.nextAction) ? 8 : 0, whiteSpace: 'pre-wrap' }}>
                {node.output}
              </div>
            )}
            {node.blocker && (
              <div style={{
                color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
                padding: '6px 10px', borderRadius: 6, marginBottom: node.nextAction ? 6 : 0,
                fontWeight: 500,
              }}>⚠ 卡点: {node.blocker}</div>
            )}
            {node.nextAction && (
              <div style={{
                color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe',
                padding: '6px 10px', borderRadius: 6, fontWeight: 500,
              }}>➤ 下一步: {node.nextAction}</div>
            )}
          </div>
        )
      )}

      {/* 标签 */}
      {node.tags && node.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          {node.tags.map((t, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 8,
              background: '#eef2ff', color: '#4338ca', fontWeight: 500,
            }}>#{t}</span>
          ))}
        </div>
      )}

      {/* 附件/文档列表 */}
      {node.linkedFiles && node.linkedFiles.length > 0 && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px dashed #e5e7eb',
        }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 500 }}>📎 附件</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {node.linkedFiles.map((filePath, fi) => {
              const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
              const isImage = /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(fileName);
              return (
                <div
                  key={fi}
                  onClick={() => {
                    if (window.__TAURI_INTERNALS__) {
                      invoke('open_file_in_default_app', { path: filePath }).catch(console.error);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 6,
                    background: isImage ? '#eef2ff' : '#f3f4f6',
                    border: `1px solid ${isImage ? '#c7d2fe' : '#e5e7eb'}`,
                    cursor: 'pointer', fontSize: 11,
                    color: isImage ? '#4338ca' : '#6b7280',
                    maxWidth: '100%', overflow: 'hidden',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isImage ? '#dbeafe' : '#e5e7eb'}
                  onMouseLeave={e => e.currentTarget.style.background = isImage ? '#eef2ff' : '#f3f4f6'}
                  title={`点击打开: ${filePath}`}
                >
                  <span>{isImage ? '🖼' : '📄'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
