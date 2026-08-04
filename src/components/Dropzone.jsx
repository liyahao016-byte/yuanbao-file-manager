import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { getFileIcon } from '../utils/iconUtils';
import GroupNamingModal from './GroupNamingModal';

export default function Dropzone({ isGlobalDragging, draggedFile, workspacePath, onGroupSuccess }) {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isHovered, setIsHovered] = useState(false);
  const [isEdgeHovered, setIsEdgeHovered] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  
  const dropzoneRef = useRef(null);
  const panelRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Fetch staging files from ~/.yuanbao_staging
  const fetchStagingFiles = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const files = await invoke('get_staging_files');
        setStagedFiles(files || []);
      }
    } catch (e) {
      console.error('Failed to fetch staging files:', e);
    }
  };

  useEffect(() => {
    fetchStagingFiles();
  }, []);

  // Synchronize selectedIds with stagedFiles (default: select all)
  useEffect(() => {
    if (stagedFiles.length > 0) {
      setSelectedIds(new Set(stagedFiles.map(f => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [stagedFiles]);

  const toggleSelect = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === stagedFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stagedFiles.map(f => f.id)));
    }
  };

  const selectedStagedFiles = stagedFiles.filter(f => selectedIds.has(f.id));

  // Listen for refresh_workspace event
  useEffect(() => {
    const handleRefresh = () => {
      fetchStagingFiles();
    };
    window.addEventListener('refresh_workspace', handleRefresh);
    return () => {
      window.removeEventListener('refresh_workspace', handleRefresh);
    };
  }, []);

  // Process files moved to staging
  const handleDropFiles = async (paths) => {
    if (!paths || paths.length === 0) return;
    try {
      await invoke('move_files_to_staging', { paths });
      window.__draggedFile = null;
      await fetchStagingFiles();
      window.dispatchEvent(new CustomEvent('refresh_workspace'));
    } catch (err) {
      console.warn('[Dropzone] Move to staging notice:', err);
    }
  };

  // Handle native drop
  const handleNativeDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovered(false);

    let file = draggedFile || window.__draggedFile;
    let pathsToMove = [];

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      pathsToMove = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
      window.__draggedFile = null;
    } else {
      if (!file && e.dataTransfer) {
        try {
          const data = e.dataTransfer.getData('application/json');
          if (data) file = JSON.parse(data);
        } catch (_) {}
      }
      if (!file && e.dataTransfer) {
        const textPath = e.dataTransfer.getData('text/plain');
        if (textPath && textPath.startsWith('/')) {
          pathsToMove.push(textPath);
        }
      }
      if (file && !file.isTab && file.path) {
        pathsToMove.push(file.path);
        window.__draggedFile = null;
      }
    }

    if (pathsToMove.length > 0) {
      await handleDropFiles(pathsToMove);
    }
  };

  // Listen for Tauri native drop events
  useEffect(() => {
    const handleTauriNativeDrop = async (e) => {
      const paths = e.detail;
      if (paths && paths.length > 0) {
        await handleDropFiles(paths);
      }
    };

    const handleTauriInternalDrop = async () => {
      const file = window.__draggedFile;
      if (file && file.path) {
        await handleDropFiles([file.path]);
      }
    };

    window.addEventListener('tauri_native_drop', handleTauriNativeDrop);
    window.addEventListener('tauri_internal_drop', handleTauriInternalDrop);

    return () => {
      window.removeEventListener('tauri_native_drop', handleTauriNativeDrop);
      window.removeEventListener('tauri_internal_drop', handleTauriInternalDrop);
    };
  }, []);

  // Remove single staged file
  const handleRemove = (e, id) => {
    e.stopPropagation();
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Export selected staged files
  const handleExport = async () => {
    if (selectedStagedFiles.length === 0) return;
    try {
      const destDir = await open({ directory: true, multiple: false });
      if (destDir) {
        const paths = selectedStagedFiles.map(f => f.path);
        await invoke('export_files', { paths, destDir });
        alert(`成功导出 ${selectedStagedFiles.length} 个文件到 ${destDir}`);
        await fetchStagingFiles();
        window.dispatchEvent(new CustomEvent('refresh_workspace'));
      }
    } catch (err) {
      console.error(err);
      alert('导出失败: ' + err);
    }
  };

  // Group selected staged files
  const handleGroup = () => {
    if (selectedStagedFiles.length === 0) return;
    setShowGroupModal(true);
  };

  const handleGroupConfirm = (folderName, createdPath) => {
    setShowGroupModal(false);
    setIsPanelOpen(false);
    setStagedFiles([]);
    if (onGroupSuccess) {
      onGroupSuccess(folderName, createdPath);
    }
  };

  // Edge trigger hover open/close panel helpers
  const handleMouseEnterTrigger = () => {
    setIsEdgeHovered(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsPanelOpen(true);
  };

  const handleMouseLeaveTrigger = () => {
    setIsEdgeHovered(false);
    closeTimerRef.current = setTimeout(() => {
      setIsPanelOpen(false);
    }, 300);
  };

  const handleMouseEnterPanel = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsPanelOpen(true);
  };

  const handleMouseLeavePanel = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsPanelOpen(false);
    }, 300);
  };

  return (
    <>
      {/* 交互 1: 拖动文件时，弹出的全局收纳区 Sensored Drop Card */}
      {isGlobalDragging && (
        <div
          ref={dropzoneRef}
          onDrop={handleNativeDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsHovered(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsHovered(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsHovered(false);
          }}
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            width: '320px',
            height: '200px',
            zIndex: 99999,
            borderRadius: '20px',
            background: isHovered
              ? 'rgba(0, 122, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: isHovered
              ? '2px solid rgba(0, 122, 255, 0.85)'
              : '2px dashed rgba(0, 122, 255, 0.4)',
            boxShadow: isHovered
              ? '0 16px 48px rgba(0, 122, 255, 0.25)'
              : '0 16px 40px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            pointerEvents: 'all',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            animation: 'dropzone-appear-right 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: isHovered ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              transition: 'all 0.2s',
            }}
          >
            {isHovered ? '📥' : '📦'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#1a1a1a', marginBottom: '4px' }}>
              {isHovered ? '松手即可存入收纳区' : '拖放到此处存入收纳区'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>支持任意文件批量添加</div>
          </div>
          {stagedFiles.length > 0 && (
            <div
              style={{
                fontSize: '11px',
                color: '#007aff',
                background: 'rgba(0, 122, 255, 0.1)',
                padding: '3px 10px',
                borderRadius: '16px',
                fontWeight: '600',
              }}
            >
              收纳区已有 {stagedFiles.length} 个文件
            </div>
          )}
        </div>
      )}

      {/* 交互 2: 文件管理器右侧边的隐藏按钮 (Hover 提示，点击/hover 打开收纳区弹窗) */}
      {!isGlobalDragging && (
        <div
          onMouseEnter={handleMouseEnterTrigger}
          onMouseLeave={handleMouseLeaveTrigger}
          onClick={() => setIsPanelOpen(prev => !prev)}
          style={{
            position: 'fixed',
            right: isPanelOpen ? '280px' : '0',
            top: '50%',
            transform: 'translateY(-50%)',
            width: isEdgeHovered || isPanelOpen ? '28px' : '14px',
            minHeight: '84px',
            background: stagedFiles.length > 0 ? '#00b96b' : 'rgba(30, 30, 30, 0.75)',
            color: '#ffffff',
            borderRadius: '10px 0 0 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            zIndex: 99998,
            boxShadow: '-2px 0 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: '10px 0',
            opacity: isEdgeHovered || isPanelOpen || stagedFiles.length > 0 ? 1 : 0.35,
          }}
        >
          <span style={{ fontSize: '13px' }}>📦</span>
          {stagedFiles.length > 0 && (
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                padding: '1px 5px',
                fontSize: '10px',
                fontWeight: '700',
                minWidth: '16px',
                textAlign: 'center',
              }}
            >
              {stagedFiles.length}
            </span>
          )}
          <div
            style={{
              writingMode: 'vertical-rl',
              fontSize: '10px',
              letterSpacing: '2px',
              userSelect: 'none',
              transform: 'rotate(180deg)',
              marginTop: '2px',
              fontWeight: '600',
              display: isEdgeHovered || isPanelOpen ? 'block' : 'none',
            }}
          >
            收纳区
          </div>
        </div>
      )}

      {/* 交互 2 弹窗: 收纳区弹窗 (允许文件转入转出) */}
      {!isGlobalDragging && isPanelOpen && (
        <div
          ref={panelRef}
          onMouseEnter={handleMouseEnterPanel}
          onMouseLeave={handleMouseLeavePanel}
          onDrop={handleNativeDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            position: 'fixed',
            right: 0,
            top: '56px',
            bottom: '12px',
            width: '280px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '16px 0 0 16px',
            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.12)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 99997,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 弹窗 Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(250, 250, 250, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {stagedFiles.length > 0 && (
                <input
                  type="checkbox"
                  checked={stagedFiles.length > 0 && selectedIds.size === stagedFiles.length}
                  onChange={toggleSelectAll}
                  title={selectedIds.size === stagedFiles.length ? "全不选" : "全选"}
                  style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: '#00b96b' }}
                />
              )}
              <span style={{ fontSize: '16px' }}>📦</span>
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#1a1a1a' }}>
                收纳区
              </span>
              <span
                style={{
                  background: stagedFiles.length > 0 ? '#00b96b' : '#e0e0e0',
                  color: stagedFiles.length > 0 ? '#fff' : '#666',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                {selectedStagedFiles.length}/{stagedFiles.length}
              </span>
            </div>

            <button
              onClick={() => setIsPanelOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#999',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* 弹窗 文件列表 (支持选择/拖拽移出到 Finder) */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {stagedFiles.length === 0 ? (
              <div
                style={{
                  color: '#999',
                  fontSize: '12px',
                  textAlign: 'center',
                  marginTop: '40px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '28px', opacity: 0.4 }}>📦</span>
                <span>收纳区暂无文件</span>
                <span style={{ fontSize: '11px', color: '#bbb' }}>拖放文件或选择存入即可集中管理</span>
              </div>
            ) : (
              stagedFiles.map((file) => {
                const isSelected = selectedIds.has(file.id);
                return (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => {
                      window.__draggedFile = file;
                      e.dataTransfer.effectAllowed = 'copyMove';
                      if (file.path) {
                        e.dataTransfer.setData('text/plain', file.path);
                      }
                      try {
                        e.dataTransfer.setData('application/json', JSON.stringify(file));
                      } catch (_) {}
                    }}
                    onClick={(e) => toggleSelect(file.id, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(0, 185, 107, 0.06)' : '#ffffff',
                      border: isSelected ? '1px solid rgba(0, 185, 107, 0.35)' : '1px solid rgba(0, 0, 0, 0.06)',
                      boxShadow: isSelected ? '0 2px 8px rgba(0, 185, 107, 0.08)' : '0 2px 6px rgba(0, 0, 0, 0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'rgba(0, 122, 255, 0.4)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 122, 255, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.06)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.03)';
                      }
                    }}
                  >
                    {/* 复选框 */}
                    <div 
                      onClick={(e) => toggleSelect(file.id, e)}
                      style={{ 
                        width: '15px', 
                        height: '15px', 
                        borderRadius: '4px', 
                        border: isSelected ? 'none' : '1px solid #cbd5e1', 
                        background: isSelected ? '#00b96b' : '#fff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0 
                      }}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff">
                          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                        </svg>
                      )}
                    </div>

                    <span style={{ fontSize: '18px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {getFileIcon(file.type || file.fileType)}
                    </span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: isSelected ? '700' : '600',
                          color: isSelected ? '#007a44' : '#1a1a1a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {file.virtualName || file.name}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleRemove(e, file.id)}
                      title="移出收纳区"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ccc',
                        cursor: 'pointer',
                        fontSize: '14px',
                        lineHeight: 1,
                        padding: '2px 4px',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3b30')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* 弹窗 Footer 导出与聚合操作 */}
          {stagedFiles.length > 0 && (
            <div
              style={{
                padding: '12px',
                borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                background: 'rgba(250, 250, 250, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <button
                onClick={handleExport}
                disabled={selectedStagedFiles.length === 0}
                style={{
                  background: selectedStagedFiles.length > 0 ? '#00b96b' : '#e2e8f0',
                  color: selectedStagedFiles.length > 0 ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: selectedStagedFiles.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '12px',
                  boxShadow: selectedStagedFiles.length > 0 ? '0 2px 6px rgba(0, 185, 107, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                导出至本地 {selectedStagedFiles.length > 0 ? `(${selectedStagedFiles.length})` : ''}
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleGroup}
                  disabled={selectedStagedFiles.length === 0}
                  style={{
                    flex: 1,
                    background: selectedStagedFiles.length > 0 ? '#f0faf5' : '#f5f5f5',
                    color: selectedStagedFiles.length > 0 ? '#00b96b' : '#aaa',
                    border: selectedStagedFiles.length > 0 ? '1px solid rgba(0, 185, 107, 0.25)' : '1px solid #e8e8e8',
                    padding: '6px',
                    borderRadius: '8px',
                    cursor: selectedStagedFiles.length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '11px',
                    fontWeight: '600',
                    transition: 'all 0.15s ease',
                  }}
                >
                  打包聚合 {selectedStagedFiles.length > 0 ? `(${selectedStagedFiles.length})` : ''}
                </button>
                <button
                  onClick={() => setStagedFiles([])}
                  style={{
                    flex: 1,
                    background: '#f5f5f5',
                    color: '#888',
                    border: '1px solid #e8e8e8',
                    padding: '6px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  清空
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showGroupModal && (
        <GroupNamingModal
          stagedFiles={selectedStagedFiles}
          workspacePath={workspacePath}
          onClose={() => setShowGroupModal(false)}
          onConfirm={handleGroupConfirm}
        />
      )}
    </>
  );
}
