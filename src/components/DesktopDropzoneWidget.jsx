import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { getFileIcon } from '../utils/iconUtils';

export default function DesktopDropzoneWidget() {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const widgetRef = useRef(null);

  // Set transparent background on body for frameless window
  useEffect(() => {
    document.body.classList.add('transparent-window');
    return () => {
      document.body.classList.remove('transparent-window');
    };
  }, []);

  // Fetch staged files from Rust backend (~/.yuanbao_staging)
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

  // Handle drop logic
  const processDropPaths = async (paths) => {
    if (!paths || paths.length === 0) return;
    try {
      await invoke('move_files_to_staging', { paths });
      await fetchStagingFiles();
      // Notify main window to refresh workspace list
      if (window.__TAURI_INTERNALS__) {
        await emit('refresh_workspace', {});
      }
    } catch (err) {
      console.error('Failed to move files to staging:', err);
    }
  };

  // Listen for native Tauri drag-and-drop events & cross-window broadcasts
  useEffect(() => {
    let unlistenEnter, unlistenDrop, unlistenLeave, unlistenRefresh;

    const setupListeners = async () => {
      if (!window.__TAURI_INTERNALS__) return;

      unlistenEnter = await listen('tauri://drag-enter', () => {
        setIsDragOver(true);
      });

      unlistenLeave = await listen('tauri://drag-leave', () => {
        setIsDragOver(false);
      });

      unlistenDrop = await listen('tauri://drag-drop', async (event) => {
        setIsDragOver(false);
        const paths = event.payload?.paths;
        if (paths && paths.length > 0) {
          await processDropPaths(paths);
        }
      });

      unlistenRefresh = await listen('refresh_workspace', () => {
        fetchStagingFiles();
      });
    };

    setupListeners();

    return () => {
      if (unlistenEnter) unlistenEnter();
      if (unlistenLeave) unlistenLeave();
      if (unlistenDrop) unlistenDrop();
      if (unlistenRefresh) unlistenRefresh();
    };
  }, []);

  // HTML5 native drag & drop fallback
  const handleNativeDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    let pathsToMove = [];
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      pathsToMove = Array.from(e.dataTransfer.files)
        .map(f => f.path)
        .filter(Boolean);
    } else {
      const path = e.dataTransfer?.getData('text/plain');
      if (path && path.startsWith('/')) {
        pathsToMove.push(path);
      }
    }

    if (pathsToMove.length > 0) {
      await processDropPaths(pathsToMove);
    }
  };

  const handleRemoveItem = async (e, id) => {
    e.stopPropagation();
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleExportAll = async () => {
    if (stagedFiles.length === 0) return;
    try {
      const destDir = await open({ directory: true, multiple: false });
      if (destDir) {
        const paths = stagedFiles.map(f => f.path);
        await invoke('export_files', { paths, destDir });
        alert(`成功导出 ${stagedFiles.length} 个文件到 ${destDir}`);
        await fetchStagingFiles();
        if (window.__TAURI_INTERNALS__) {
          await emit('refresh_workspace', {});
        }
      }
    } catch (err) {
      console.error(err);
      alert('导出失败: ' + err);
    }
  };

  const handleGroup = () => {
    const name = prompt('请输入聚合文件夹名称:');
    if (name) {
      alert(`已生成聚合标签: ${name}`);
      setStagedFiles([]);
    }
  };

  const handleClearAll = () => {
    setStagedFiles([]);
  };

  // Mini / Collapsed Capsule View
  if (isCollapsed) {
    return (
      <div
        data-tauri-drag-region
        onClick={() => setIsCollapsed(false)}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          boxSizing: 'border-box',
        }}
      >
        <div
          data-tauri-drag-region
          style={{
            background: stagedFiles.length > 0 ? 'rgba(0, 185, 107, 0.95)' : 'rgba(30, 30, 30, 0.85)',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '24px',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.2)',
            userSelect: 'none',
            transition: 'transform 0.2s',
          }}
        >
          <span style={{ fontSize: '16px' }}>📥</span>
          <span style={{ fontWeight: '600', fontSize: '13px' }}>桌面收纳盒</span>
          <span
            style={{
              background: 'rgba(255,255,255,0.25)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '700',
            }}
          >
            {stagedFiles.length}
          </span>
        </div>
      </div>
    );
  }

  // Full QQ 闪传 Style Desktop Dropzone Window View
  return (
    <div
      ref={widgetRef}
      onDrop={handleNativeDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (!widgetRef.current?.contains(e.relatedTarget)) {
          setIsDragOver(false);
        }
      }}
      style={{
        width: '100vw',
        height: '100vh',
        boxSizing: 'border-box',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          borderRadius: '20px',
          background: isDragOver
            ? 'rgba(240, 246, 255, 0.95)'
            : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: isDragOver
            ? '2px dashed #007aff'
            : '1px solid rgba(230, 230, 230, 0.8)',
          boxShadow: isDragOver
            ? '0 16px 48px rgba(0,122,255,0.25)'
            : '0 16px 40px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
      >
        {/* Header / Drag Handle (QQ 闪传 风格) */}
        <div
          data-tauri-drag-region
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            background: 'rgba(250, 250, 250, 0.6)',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📥</span>
            <span data-tauri-drag-region style={{ fontWeight: '700', fontSize: '14px', color: '#1a1a1a' }}>
              桌面闪传收纳盒
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
              {stagedFiles.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setIsCollapsed(true)}
              title="折叠为胶囊"
              style={{
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: '#666',
                cursor: 'pointer',
              }}
            >
              ─
            </button>
          </div>
        </div>

        {/* Drag Active Overlay Prompt */}
        {isDragOver && (
          <div
            style={{
              position: 'absolute',
              top: '52px',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(235, 245, 255, 0.95)',
              zIndex: 90,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(0,122,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
              }}
            >
              📥
            </div>
            <div style={{ fontWeight: '700', fontSize: '16px', color: '#007aff' }}>
              松手即可添加文件到收纳盒
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>支持单文件或多文件直接存放</div>
          </div>
        )}

        {/* Content Body: Staged Files List */}
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
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                gap: '10px',
                padding: '24px 0',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                }}
              >
                📦
              </div>
              <div style={{ fontWeight: '600', fontSize: '13px', color: '#555' }}>
                拖放文件到此处收纳
              </div>
              <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', padding: '0 20px' }}>
                任意 Finder 文件或应用内文件均可直接扔进这里
              </div>
            </div>
          ) : (
            stagedFiles.map((file) => (
              <div
                key={file.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copyMove';
                  if (file.path) {
                    e.dataTransfer.setData('text/plain', file.path);
                  }
                  try {
                    e.dataTransfer.setData('application/json', JSON.stringify(file));
                  } catch (_) {}
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  cursor: 'grab',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = 'rgba(0, 122, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
                }}
              >
                <span style={{ fontSize: '20px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {getFileIcon(file.type || file.fileType)}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#1a1a1a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {file.virtualName || file.name}
                  </div>
                  {file.fileSize && (
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                      {file.fileSize}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => handleRemoveItem(e, file.id)}
                  title="移出收纳盒"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#bbb',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    padding: '2px 4px',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3b30')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {stagedFiles.length > 0 && (
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid rgba(0,0,0,0.06)',
              background: 'rgba(250, 250, 250, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <button
              onClick={handleExportAll}
              style={{
                background: '#00b96b',
                color: '#ffffff',
                border: 'none',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                boxShadow: '0 2px 6px rgba(0,185,107,0.25)',
              }}
            >
              全部导出至本地
            </button>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleGroup}
                style={{
                  flex: 1,
                  background: '#f0faf5',
                  color: '#00b96b',
                  border: '1px solid rgba(0,185,107,0.25)',
                  padding: '6px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              >
                打包聚合
              </button>
              <button
                onClick={handleClearAll}
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
    </div>
  );
}
