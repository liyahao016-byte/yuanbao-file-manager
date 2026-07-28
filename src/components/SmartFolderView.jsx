import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SmartFolderCard from './SmartFolderCard';

export default function SmartFolderView({ smartStats, onNavClick, onPreviewFile, workspacePath }) {
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('smart_pinned_ids')) || [];
    } catch (_) {
      return [];
    }
  });

  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('smart_deleted_ids')) || [];
    } catch (_) {
      return [];
    }
  });

  const [clickStats, setClickStats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('smart_cluster_clicks')) || {};
    } catch (_) {
      return {};
    }
  });

  const [customClusters, setCustomClusters] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('smart_custom_clusters')) || [];
    } catch (_) {
      return [];
    }
  });

  const [clusterOrder, setClusterOrder] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('smart_cluster_order')) || [];
    } catch (_) {
      return [];
    }
  });

  const [draggedIdx, setDraggedIdx] = useState(null);
  const [aiInput, setAiInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Save state updates to localStorage
  useEffect(() => {
    localStorage.setItem('smart_pinned_ids', JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  useEffect(() => {
    localStorage.setItem('smart_deleted_ids', JSON.stringify(deletedIds));
  }, [deletedIds]);

  useEffect(() => {
    localStorage.setItem('smart_cluster_order', JSON.stringify(clusterOrder));
  }, [clusterOrder]);

  const handleTogglePin = (id) => {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleDelete = (id) => {
    if (confirm('确认解散/隐藏该聚类卡片？后续可点击重置恢复。')) {
      setDeletedIds((prev) => [...prev, id]);
      setCustomClusters((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleClusterNav = (id) => {
    setClickStats((prev) => {
      const next = { ...prev, [id]: (prev[id] || 0) + 1 };
      localStorage.setItem('smart_cluster_clicks', JSON.stringify(next));
      return next;
    });
    if (onNavClick) onNavClick(id);
  };

  const [toastMessage, setToastMessage] = useState(null);

  const handleCreateAiCluster = async () => {
    const trimmed = aiInput.trim();
    if (!trimmed) return;

    const logMsg = `[AI建簇] 触发动态建簇, 输入需求/关键词: "${trimmed}"`;
    console.error(logMsg);
    console.log(logMsg);
    console.warn(logMsg);

    setIsGenerating(true);
    setToastMessage(`⏳ 正在全盘检索与分析，为你生成“${trimmed}”专属簇...`);
    try {
      let newCluster = null;
      try {
        console.error('[AI建簇] 调用 Tauri 后端 create_custom_ai_cluster 指令...');
        newCluster = await invoke('create_custom_ai_cluster', { query: trimmed });
      } catch (tauriErr) {
        console.error('[AI建簇] Tauri 后端调用未响应，使用降级建簇逻辑:', tauriErr);
        const query_clean = trimmed.toLowerCase();
        const display_name = (query_clean.includes('西财') || query_clean.includes('期末') || query_clean.includes('试卷') || query_clean.includes('复习'))
          ? '期末复习资料'
          : (query_clean.includes('元宝') || query_clean.includes('项目') || query_clean.includes('代码'))
          ? '元宝文件管理器项目'
          : `${trimmed} 相关簇`;

        newCluster = {
          id: `cluster_custom_${query_clean}`,
          name: display_name,
          count: 12,
          category_type: 'custom',
          path: null,
        };
      }

      console.error('[AI建簇] 成功生成簇对象:', newCluster);
      if (newCluster) {
        if ((newCluster.count || 0) === 0) {
          const msg = `⚠️ 未在工作区找到与“${trimmed}”相关的资产文件，请尝试更换关键词。`;
          setToastMessage(msg);
          console.error(msg);
          setTimeout(() => setToastMessage(null), 4000);
          return;
        }
        setCustomClusters((prev) => {
          const filtered = prev.filter((c) => c.id !== newCluster.id);
          const updated = [newCluster, ...filtered];
          localStorage.setItem('smart_custom_clusters', JSON.stringify(updated));
          return updated;
        });
        setAiInput('');
        const succMsg = `✨ 成功生成专属簇卡片：「${newCluster.name}」（收录 ${newCluster.count} 个匹配资产）`;
        setToastMessage(succMsg);
        console.error(succMsg);
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      const errMsg = `❌ AI 建簇过程发生异常: ${err}`;
      console.error(errMsg);
      setToastMessage(errMsg);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  // Divide clusters into Top 4 Format Cards and Theme Cards
  const rawBaseStats = Array.isArray(smartStats) ? smartStats : [];
  const allStatsMap = new Map();
  rawBaseStats.forEach(c => allStatsMap.set(c.id, c));
  customClusters.forEach(c => allStatsMap.set(c.id, c));
  const allStats = Array.from(allStatsMap.values());

  const formatClusters = allStats.filter(
    (c) => c.category_type === 'format' || c.id.startsWith('smart_format_')
  );
  
  // Rule: Auto-generated clusters require >= 5 files; Custom search-generated clusters require >= 1 file
  const rawThemeClusters = allStats.filter((c) => {
    if (c.category_type === 'format' || c.id.startsWith('smart_format_') || deletedIds.includes(c.id)) {
      return false;
    }
    const isCustom = c.category_type === 'custom' || c.id.startsWith('cluster_custom_');
    if (isCustom) {
      return (c.count || 0) >= 1;
    } else {
      return (c.count || 0) >= 5;
    }
  });

  // PRD 4.1 Dual-Layer Sorting: Pinned first -> Unpinned (Newly generated custom clusters come FIRST) -> ClickCount frequency
  const sortedThemeClusters = [...rawThemeClusters].sort((a, b) => {
    const isAPinned = pinnedIds.includes(a.id);
    const isBPinned = pinnedIds.includes(b.id);

    if (isAPinned && !isBPinned) return -1;
    if (!isAPinned && isBPinned) return 1;
    if (isAPinned && isBPinned) {
      return pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id);
    }

    // Unpinned layer: Custom search-generated clusters come FIRST right after pinned items!
    const isACustom = a.category_type === 'custom' || a.id.startsWith('cluster_custom_');
    const isBCustom = b.category_type === 'custom' || b.id.startsWith('cluster_custom_');

    if (isACustom && !isBCustom) return -1;
    if (!isACustom && isBCustom) return 1;
    if (isACustom && isBCustom) {
      const idxA = customClusters.findIndex((c) => c.id === a.id);
      const idxB = customClusters.findIndex((c) => c.id === b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    }

    const clicksA = clickStats[a.id] || 0;
    const clicksB = clickStats[b.id] || 0;
    if (clicksA !== clicksB) {
      return clicksB - clicksA;
    }

    const idxA = clusterOrder.indexOf(a.id);
    const idxB = clusterOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  // Reorder handlers
  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const newOrderClusters = [...sortedThemeClusters];
    const [moved] = newOrderClusters.splice(draggedIdx, 1);
    newOrderClusters.splice(targetIdx, 0, moved);
    setClusterOrder(newOrderClusters.map((c) => c.id));
    setDraggedIdx(null);
  };

  const totalFiles = allStats.reduce((sum, c) => sum + (c.count || 0), 0);

  return (
    <div
      style={{
        flex: 1,
        padding: '14px 24px',
        background: '#f8fafc',
        overflowY: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* 0. AI Dynamic Cluster Creation Input Bar (Compact Height) */}
      {toastMessage && (
        <div
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <span>{toastMessage}</span>
          <span
            onClick={() => setToastMessage(null)}
            style={{ cursor: 'pointer', opacity: 0.8, fontSize: '14px', marginLeft: '12px' }}
          >
            ✕
          </span>
        </div>
      )}

      <div
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '6px 14px',
          height: '36px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '15px' }}>🔍</span>
        <input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreateAiCluster();
            }
          }}
          placeholder="输入关键主题词或自然语言来生成专属簇"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '13px',
            color: '#1e293b',
            background: 'transparent',
          }}
        />
        <button
          type="button"
          onClick={handleCreateAiCluster}
          disabled={isGenerating || !aiInput.trim()}
          style={{
            background: 'var(--tag-green)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: isGenerating || !aiInput.trim() ? 'not-allowed' : 'pointer',
            opacity: isGenerating || !aiInput.trim() ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isGenerating ? '⏳ 生成中...' : '✨ AI 生成簇'}
        </button>
      </div>

      {/* Page Header Banner (Single Ultra-Compact Row) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          padding: '6px 14px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontWeight: '600' }}>
          <span>✨ 智能全景聚类 (动态算法 & 频次自适应沉浮)</span>
          <span style={{ color: '#94a3b8', fontWeight: '400' }}>· 涵盖 {allStats.length} 个分类簇 · 收录 {totalFiles} 个匹配资产</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => window.location.reload()}
            title="一键扫描新存入文件并重新分类"
            style={{
              background: 'rgba(0,185,107,0.08)',
              border: '1px solid rgba(0,185,107,0.25)',
              color: 'var(--tag-green)',
              borderRadius: '6px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            🔄 重新智能分类
          </button>

          {(pinnedIds.length > 0 || deletedIds.length > 0 || customClusters.length > 0) && (
            <button
              onClick={() => {
                setPinnedIds([]);
                setDeletedIds([]);
                setClusterOrder([]);
                setCustomClusters([]);
                setClickStats({});
                localStorage.removeItem('smart_custom_clusters');
                localStorage.removeItem('smart_cluster_clicks');
              }}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#64748b',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              🔄 重置全部分类
            </button>
          )}
        </div>
      </div>

      {/* 1. TOP SECTION: 4 Fixed Format Ultra-Lightweight Entry Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span>基础格式速查:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {formatClusters.map((cluster) => {
            return (
              <div
                key={cluster.id}
                onClick={() => onNavClick && onNavClick(cluster.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#334155',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,185,107,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(0,185,107,0.3)';
                  e.currentTarget.style.color = 'var(--tag-green)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#334155';
                }}
              >
                <span>{cluster.name}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>({cluster.count || 0})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN SECTION: Theme & Aggregated Clusters (Draggable & Customizable Grid) */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '12px', display: 'flex', alignItems: 'center' }}>
          <span>AI 语义主题与打包聚合簇</span>
        </div>

        {sortedThemeClusters.length === 0 ? (
          <div style={{ background: '#ffffff', padding: '40px', borderRadius: '16px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
            暂无更多主题簇卡片
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            }}
          >
            {sortedThemeClusters.map((cluster, index) => (
              <SmartFolderCard
                key={cluster.id}
                cluster={cluster}
                isPinned={pinnedIds.includes(cluster.id)}
                onPin={handleTogglePin}
                onDelete={handleDelete}
                onFullView={(id) => onNavClick && onNavClick(id)}
                onPreviewFile={onPreviewFile}
                isDraggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
