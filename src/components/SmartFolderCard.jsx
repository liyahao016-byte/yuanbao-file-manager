import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon } from '../utils/iconUtils';

export default function SmartFolderCard({
  cluster,
  isPinned,
  onPin,
  onDelete,
  onFullView,
  onPreviewFile,
  isDraggable = true,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const [files, setFiles] = useState([]);
  const [totalCount, setTotalCount] = useState(cluster.count || 0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTotalCount(cluster.count || 0);
  }, [cluster.count]);

  useEffect(() => {
    let isMounted = true;
    if (window.__TAURI_INTERNALS__) {
      setIsLoading(true);
      let fetchPromise;
      if (cluster.path) {
        fetchPromise = invoke('read_dir_shallow', { path: cluster.path });
      } else {
        fetchPromise = invoke('get_files_by_cluster', { theme: cluster.id || cluster.name, page: 1, pageSize: 1000 });
      }

      fetchPromise
        .then((res) => {
          if (isMounted && res) {
            setTotalCount(res.length);
            setFiles(res.slice(0, 8)); // Quick preview top 8 items
          }
        })
        .catch(console.error)
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [cluster.id, cluster.path]);

  const getClusterIcon = (name, categoryType) => {
    if (categoryType === 'format' || cluster.id.startsWith('smart_format_')) {
      if (name.includes('图片')) return '🖼️';
      if (name.includes('文档')) return '📄';
      if (name.includes('表格')) return '📊';
      if (name.includes('媒体')) return '🎬';
    }
    if (name.includes('简历') || name.includes('求职')) return '💼';
    if (name.includes('合同') || name.includes('协议')) return '📜';
    if (name.includes('财务') || name.includes('发票')) return '💰';
    if (name.includes('方案') || name.includes('报告')) return '📄';
    if (name.includes('报表') || name.includes('明细')) return '📊';
    if (name.includes('设计') || name.includes('素材')) return '🎨';
    if (name.includes('论文') || name.includes('学习')) return '🎓';
    if (name.includes('影音') || name.includes('媒体')) return '🎬';
    if (name.includes('代码') || name.includes('工程')) return '💻';
    return '📁';
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: isPinned ? '2px solid var(--tag-green)' : '1px solid var(--border-color)',
        boxShadow: isPinned ? '0 8px 24px rgba(0,185,107,0.15)' : '0 4px 16px rgba(0,0,0,0.04)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: isDraggable ? 'grab' : 'default',
        position: 'relative',
      }}
    >
      {/* Top Banner / Title & Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cluster.name}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            共 {totalCount} 个文件
          </div>
        </div>

        {/* Action Controls Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isDraggable && (
            <>
              {/* 1. 📌 钉住按钮 */}
              <button
                onClick={() => onPin(cluster.id)}
                title={isPinned ? '取消置顶' : '📌 置顶钉住'}
                style={{
                  background: isPinned ? 'rgba(0, 185, 107, 0.15)' : '#f1f5f9',
                  border: isPinned ? '1px solid rgba(0, 185, 107, 0.3)' : '1px solid transparent',
                  borderRadius: '8px',
                  padding: '5px 9px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: isPinned ? 'var(--tag-green)' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isPinned) {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.color = '#1e293b';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPinned) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                📌
              </button>

              {/* 2. 🗑️ 加粗垃圾桶按钮 */}
              <button
                onClick={() => onDelete(cluster.id)}
                title="解散/删除此卡片簇"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid transparent',
                  borderRadius: '8px',
                  padding: '5px 9px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ stroke: 'currentColor', strokeWidth: 0.5 }}>
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </>
          )}

          {/* 3. 全视图 ➔ 按钮 */}
          <button
            onClick={() => onFullView(cluster.id)}
            style={{
              background: 'rgba(0, 185, 107, 0.1)',
              color: 'var(--tag-green)',
              border: '1px solid rgba(0, 185, 107, 0.25)',
              borderRadius: '8px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 185, 107, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 185, 107, 0.1)';
            }}
          >
            <span>全视图</span>
            <span>➔</span>
          </button>
        </div>
      </div>

      {/* Inline Quick Preview Chips / Horizontal Bar */}
      <div style={{ marginTop: '4px' }}>
        {isLoading ? (
          <div style={{ fontSize: '12px', color: '#aaa', padding: '12px 0' }}>加载预览中...</div>
        ) : files.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#ccc', padding: '8px 0' }}>暂无预览文件</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '8px',
              maxHeight: '130px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => onPreviewFile && onPreviewFile(file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f6ff';
                  e.currentTarget.style.borderColor = 'rgba(0,122,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#f1f5f9';
                }}
              >
                <span style={{ fontSize: '16px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {getFileIcon(file.type || file.fileType)}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '500',
                    color: '#334155',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={file.virtualName || file.name}
                >
                  {file.virtualName || file.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
