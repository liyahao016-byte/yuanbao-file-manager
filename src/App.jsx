import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import FileListView from './components/FileListView';
import PreviewerView from './components/PreviewerView';
import SplitView from './components/SplitView';
import SmartSearchBox from './components/SmartSearchBox';
import SmartFolderView from './components/SmartFolderView';
import SearchResultsView from './components/SearchResultsView';
import CleanupDashboardView from './components/CleanupDashboardView';
import SmartFolderDetailView from './components/SmartFolderDetailView';
import FinderView from './components/FinderView';
import WelcomeScreen from './components/WelcomeScreen';
import Dropzone from './components/Dropzone';

const Icons = {
  recent: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg>,
  download: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>,
  desktop: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z" /></svg>,
  wechat: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>,
  qq: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" /></svg>,
  pc: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" /></svg>,
  folder: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>,
  all: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zM10 5v6h5V5h-5zm6 0v6h5V5h-5z" /></svg>,
  list: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z" /></svg>,
  split: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 3v18h18V3H3zm16 16H5V5h14v14zm-6-2h4v-4h-4v4zm0-6h4V7h-4v4zm-6 6h4v-4H7v4zm0-6h4V7H7v4z" /></svg>,
  clean: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12V5z" /></svg>,
  ai: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 11.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm6 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 17.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z" /></svg>
};

function App() {
  const [workspacePath, setWorkspacePath] = useState(() => localStorage.getItem('workspacePath') || '');
  const [tabs, setTabs] = useState([
    { id: 'tab_1', currentNav: 'recent', searchQuery: '', previewFile: null, viewMode: 'columns' }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab_1');

  const [taggedFiles, setTaggedFiles] = useState({}); // Global state for tags { id: ['color1', 'color2'] }
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [smartStats, setSmartStats] = useState([]);
  const [highlightSmartFolder, setHighlightSmartFolder] = useState(false);
  const [smartVersion, setSmartVersion] = useState(0);

  useEffect(() => {
    const handleSmartStateChange = () => {
      setSmartVersion(prev => prev + 1);
    };
    window.addEventListener('smart_cluster_state_change', handleSmartStateChange);
    return () => {
      window.removeEventListener('smart_cluster_state_change', handleSmartStateChange);
    };
  }, []);

  const [draggedFile, setDraggedFile] = useState(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);

  const handleGroupSuccess = (folderName, createdPath) => {
    const newCluster = {
      id: `cluster_group_${Date.now()}`,
      name: folderName,
      count: 1,
      path: createdPath
    };
    // Prepend new cluster to the top of smartStats (first position!)
    setSmartStats(prev => [newCluster, ...prev.filter(item => item.name !== folderName)]);

    // Trigger visual pulse animation on sidebar Smart Folders
    setHighlightSmartFolder(true);
    setTimeout(() => {
      setHighlightSmartFolder(false);
    }, 2000);
  };

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      if (window.__isInternalDrag) return;
      dragCounter++;
      setIsGlobalDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      if (window.__isInternalDrag) return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsGlobalDragging(false);
      }
    };

    // Tauri Native File Drop listeners (for Mac Finder drags)
    let unlistenDragEnter, unlistenDrop, unlistenDragLeave;
    const setupTauriListeners = async () => {
      unlistenDragEnter = await listen('tauri://drag-enter', (event) => {
        dragCounter++;
        setIsGlobalDragging(true);
      });
      unlistenDragLeave = await listen('tauri://drag-leave', (event) => {
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          setIsGlobalDragging(false);
        }
      });
      unlistenDrop = await listen('tauri://drag-drop', (event) => {
        dragCounter = 0;
        setIsGlobalDragging(false);
        // Dispatch custom event for Dropzone to handle
        if (event.payload && event.payload.paths && event.payload.paths.length > 0) {
          window.dispatchEvent(new CustomEvent('tauri_native_drop', { detail: event.payload.paths }));
        } else if (event.payload && event.payload.position) {
          window.dispatchEvent(new CustomEvent('tauri_internal_drop', { detail: event.payload.position }));
        }
      });
    };

    if (window.__TAURI_INTERNALS__) {
      setupTauriListeners();
    }

    // Track mouse position via mousemove - gives CSS logical pixels directly,
    // bypassing all macOS physical pixel / coordinate inversion issues.
    const handleMouseMove = (e) => {
      window.__lastMouseX = e.clientX;
      window.__lastMouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // For internal drags (from within the app)
    const handleDragStart = () => {
      window.__isInternalDrag = true;
      setIsGlobalDragging(true);
    };
    const handleDragEnd = () => {
      dragCounter = 0;
      setIsGlobalDragging(false);
    };
    const handleDragOver = (e) => {
      e.preventDefault();
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('dragend', handleDragEnd);

    // Global Promise Rejection & Error Protection
    const handleUnhandledRejection = (e) => {
      console.warn('[System Protection] Cleaned unhandled rejection:', e.reason);
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    };
    const handleGlobalError = (e) => {
      console.warn('[System Protection] Cleaned uncaught error:', e.message);
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('mousemove', handleMouseMove);
      if (unlistenDragEnter) unlistenDragEnter();
      if (unlistenDrop) unlistenDrop();
      if (unlistenDragLeave) unlistenDragLeave();
    };
  }, []);

  useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      invoke('get_smart_folder_stats', { dirPath: workspacePath || 'sys:desktop' })
        .then(stats => {
          if (stats) setSmartStats(stats);
        })
        .catch(console.error);
    }
  }, [workspacePath]);

  // 获取当前激活的标签页状态
  const activeTab = tabs.find(t => t.id === activeTabId);
  const currentNav = activeTab?.currentNav || '';
  const searchQuery = activeTab?.searchQuery || '';
  const searchCategory = activeTab?.searchCategory || '全部';
  const previewFile = activeTab?.previewFile || null;
  const viewMode = activeTab?.viewMode || 'columns';

  const updateActiveTab = (updates) => {
    if (!activeTabId) return;
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const handleNavClick = (nav) => {
    if (tabs.length === 0) {
      const newId = `tab_${Date.now()}`;
      setTabs([{ id: newId, currentNav: nav, searchQuery: '', previewFile: null, viewMode: 'columns' }]);
      setActiveTabId(newId);
    } else {
      updateActiveTab({ currentNav: nav, searchQuery: '' });
    }
  };

  const handleSearch = (query, category) => {
    // Always open search results in a NEW tab
    const newId = `tab_${Date.now()}`;
    const newTab = {
      id: newId,
      currentNav: 'recent',
      searchQuery: query,
      searchCategory: category || '全部',
      previewFile: null,
      viewMode: 'columns',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    // Always keep sidebar expanded when searching so user can re-search easily
    setIsSidebarCollapsed(false);
  };

  const handleViewMode = (mode) => updateActiveTab({ viewMode: mode });
  const handlePreviewFile = (file) => updateActiveTab({ previewFile: file });

  const handleAddTab = () => {
    const newId = `tab_${Date.now()}`;
    setTabs([...tabs, { id: newId, currentNav: 'recent', searchQuery: '', previewFile: null, viewMode: 'columns' }]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (id, e) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      if (newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId === targetId) return;
    const draggedIndex = tabs.findIndex(t => t.id === draggedId);
    const targetIndex = tabs.findIndex(t => t.id === targetId);
    const newTabs = [...tabs];
    const [removed] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, removed);
    setTabs(newTabs);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const navConfig = {
    recent: { name: '最近文件', icon: Icons.recent },
    desktop: { name: '桌面', icon: Icons.desktop },
    download: { name: '下载', icon: Icons.download },
    wechat: { name: '微信文件', icon: Icons.wechat },
    qq: { name: 'QQ文件', icon: Icons.qq },
    pc: { name: '此电脑', icon: Icons.pc },
    smart_folders: { name: '智能文件夹', icon: Icons.folder },
    cleanup: { name: '深度空间清理', icon: Icons.clean },
    smart_contract: { name: '合同协议', icon: Icons.folder },
    smart_finance: { name: '财务发票', icon: Icons.folder },
    smart_resume: { name: '简历求职', icon: Icons.folder }
  };
  const handleWorkspaceSelected = (path) => {
    localStorage.setItem('workspacePath', path);
    setWorkspacePath(path);
  };

  const handleResetWorkspace = () => {
    localStorage.removeItem('workspacePath');
    setWorkspacePath('');
  };

  const handleSyncEmbeddings = async () => {
    if (window.__TAURI_INTERNALS__) {
      try {
        const count = await invoke('sync_all_embeddings');
        alert(`成功构建 ${count} 个文件的向量索引！`);
      } catch (err) {
        console.error(err);
        alert('构建向量失败: ' + err);
      }
    }
  };

  if (!workspacePath) {
    return <WelcomeScreen onWorkspaceSelected={handleWorkspaceSelected} />;
  }

  return (
    <div className="app-container">
      {/* 左侧边栏 */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div style={{ padding: '0 20px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '32px' }}>
          {!isSidebarCollapsed && <h1 style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '0.5px', margin: 0 }}>元宝文件</h1>}
          <div
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--icon-color)', marginLeft: isSidebarCollapsed ? '-4px' : '0' }}
            title="收起/展开导航栏"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </div>
        </div>

        {/* 元宝文件下方的全局工具按钮组 */}
        {!isSidebarCollapsed && (
          <div style={{ padding: '0 20px', marginBottom: '10px', display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSyncEmbeddings}
              style={{
                flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1',
                background: '#ffffff', fontSize: '11px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#334155', fontWeight: '500',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              ⚡️ 同步向量
            </button>
            <button
              onClick={handleResetWorkspace}
              style={{
                flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1',
                background: '#ffffff', fontSize: '11px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#334155', fontWeight: '500',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              切换工作区
            </button>
          </div>
        )}

        {!isSidebarCollapsed && (
          <div style={{ padding: '0 20px', marginBottom: '8px' }}>
            <SmartSearchBox onSearch={handleSearch} activeSearchQuery={searchQuery} />
          </div>
        )}

        {/* Sidebar Nav Sections Wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, overflowY: 'auto' }}>
          {/* 1. 快捷访问 */}
          <div className="nav-section" style={{ padding: '0 10px' }}>
            {!isSidebarCollapsed && <div className="section-title" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', padding: '4px 10px', marginBottom: '2px', fontWeight: '600' }}>快捷访问</div>}
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <li
                className={`nav-item ${currentNav === 'recent' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('recent')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'recent' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'recent' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'recent' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}>
                <span style={{ color: (currentNav === 'recent' && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.recent}</span> {!isSidebarCollapsed && <span>最近</span>}
              </li>
              <li
                className={`nav-item ${currentNav === 'download' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('download')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'download' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'download' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'download' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}>
                <span style={{ color: (currentNav === 'download' && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.download}</span> {!isSidebarCollapsed && <span>下载</span>}
              </li>
              <li
                className={`nav-item ${currentNav === 'desktop' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('desktop')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'desktop' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'desktop' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'desktop' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}>
                <span style={{ color: (currentNav === 'desktop' && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.desktop}</span> {!isSidebarCollapsed && <span>桌面</span>}
              </li>
              <li
                className={`nav-item ${currentNav === 'wechat' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('wechat')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'wechat' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'wechat' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'wechat' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}>
                <span style={{ color: (currentNav === 'wechat' && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.wechat}</span> {!isSidebarCollapsed && <span>微信文件</span>}
              </li>
              <li
                className={`nav-item ${currentNav === 'qq' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('qq')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'qq' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'qq' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'qq' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}>
                <span style={{ color: (currentNav === 'qq' && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.qq}</span> {!isSidebarCollapsed && <span>QQ文件</span>}
              </li>
              <li
                className={`nav-item ${currentNav === 'pc' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('pc')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'pc' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'pc' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'pc' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}>
                <span style={{ color: (currentNav === 'pc' && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.pc}</span> {!isSidebarCollapsed && <span>此电脑</span>}
              </li>
            </ul>
          </div>

          {/* 2. 智能文件夹 */}
          <div className={`nav-section ${highlightSmartFolder ? 'smart-folder-pulse' : ''}`} style={{ padding: '0 10px', marginTop: '12px', transition: 'all 0.3s' }}>
            {!isSidebarCollapsed && (
              <div className="section-title" style={{ fontSize: '12px', color: highlightSmartFolder ? 'var(--tag-green)' : 'rgba(0,0,0,0.45)', padding: '4px 10px', marginBottom: '4px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>智能文件夹 {highlightSmartFolder ? '✨ 新增组群' : ''}</span>
              </div>
            )}
            {isSidebarCollapsed ? (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: 0, margin: 0 }}>
                <li
                  className={`nav-item ${(currentNav.startsWith('cluster_') || currentNav.startsWith('smart_') || currentNav === 'smart_folders') && !searchQuery ? 'active' : ''}`}
                  onClick={() => handleNavClick(smartStats.length > 0 ? smartStats[0].id : 'smart_folders')}
                  style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: ((currentNav.startsWith('cluster_') || currentNav.startsWith('smart_') || currentNav === 'smart_folders') && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: ((currentNav.startsWith('cluster_') || currentNav.startsWith('smart_') || currentNav === 'smart_folders') && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}
                  title="智能文件夹"
                >
                  <span style={{ color: ((currentNav.startsWith('cluster_') || currentNav.startsWith('smart_') || currentNav === 'smart_folders') && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.ai}</span>
                </li>
              </ul>
            ) : (
              <>
                {/* 方案 A：独立微型滚动条容器 (Max-Height 220px Scrollable) */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }} className="custom-sidebar-scroll">
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: 0, margin: 0, listStyle: 'none' }}>
                    {(() => {
                      // 读取右侧固化的 Pin / Delete / Click / Custom 状态进行 100% 同步排序与过滤
                      const pinnedIds = JSON.parse(localStorage.getItem('smart_pinned_ids') || '[]');
                      const deletedIds = JSON.parse(localStorage.getItem('smart_deleted_ids') || '[]');
                      const clickStats = JSON.parse(localStorage.getItem('smart_cluster_clicks') || '{}');
                      const customClusters = JSON.parse(localStorage.getItem('smart_custom_clusters') || '[]');

                      // 构造基础簇与分类映射
                      const formatPreset = [
                        { id: 'smart_format_image', name: '图片资产' },
                        { id: 'smart_format_document', name: '文档资料' },
                        { id: 'smart_format_excel', name: '表格数据' },
                        { id: 'smart_format_media', name: '媒体资产' }
                      ];

                      const rawStats = Array.isArray(smartStats) ? smartStats : [];
                      const allMap = new Map();
                      formatPreset.forEach(f => allMap.set(f.id, f));
                      rawStats.forEach(s => allMap.set(s.id, s));
                      customClusters.forEach(c => allMap.set(c.id, c));

                      // 1. 彻底过滤被用户解散/删除的簇 (deletedIds)
                      const allList = Array.from(allMap.values()).filter(c => !deletedIds.includes(c.id));

                      // 2. 完全与右侧齐平的动态排序算法
                      const sortedList = [...allList].sort((a, b) => {
                        const isAPinned = pinnedIds.includes(a.id);
                        const isBPinned = pinnedIds.includes(b.id);
                        if (isAPinned && !isBPinned) return -1;
                        if (!isAPinned && isBPinned) return 1;
                        if (isAPinned && isBPinned) return pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id);

                        const isACustom = a.category_type === 'custom' || a.id.startsWith('cluster_custom_');
                        const isBCustom = b.category_type === 'custom' || b.id.startsWith('cluster_custom_');
                        if (isACustom && !isBCustom) return -1;
                        if (!isACustom && isBCustom) return 1;

                        const clicksA = clickStats[a.id] || 0;
                        const clicksB = clickStats[b.id] || 0;
                        if (clicksA !== clicksB) return clicksB - clicksA;
                        return 0;
                      });

                      return sortedList.map(cluster => {
                        const isPinned = pinnedIds.includes(cluster.id);
                        const isActive = currentNav === cluster.id && !searchQuery;
                        return (
                          <li
                            key={cluster.id}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => handleNavClick(cluster.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: isActive ? 'var(--bg-active)' : 'transparent',
                              color: isActive ? 'var(--tag-green)' : 'var(--text-primary)',
                              fontWeight: isActive || isPinned ? '600' : '400',
                              cursor: 'pointer',
                              fontSize: '12px',
                              lineHeight: '1.4'
                            }}
                            title={`${cluster.name} ${isPinned ? '(已置顶)' : ''}`}
                          >
                            <span style={{ color: isActive ? 'inherit' : (isPinned ? '#ff9500' : 'var(--icon-color)'), marginRight: '6px', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                              {isPinned ? '📌' : Icons.folder}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{cluster.name}</span>
                            {cluster.count !== undefined && (
                              <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>{cluster.count}</span>
                            )}
                          </li>
                        );
                      });
                    })()}
                  </ul>
                </div>

                {/* 底部查看与管理全部卡片 */}
                <li
                  className={`nav-item ${currentNav === 'smart_folders' && !searchQuery ? 'active' : ''}`}
                  onClick={() => handleNavClick('smart_folders')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: (currentNav === 'smart_folders' && !searchQuery) ? 'var(--bg-active)' : 'rgba(0, 185, 107, 0.06)',
                    color: 'var(--tag-green)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '4px',
                    fontSize: '12px',
                    border: '1px dashed rgba(0, 185, 107, 0.3)',
                    transition: 'all 0.15s ease'
                  }}
                  title="在全景页面查看、排序、钉住与管理所有簇"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>✨</span> 查看与管理全景簇
                  </span>
                  <span>→</span>
                </li>
              </>
            )}
          </div>

          {/* 3. 工具箱 */}
          <div className="nav-section" style={{ padding: '0 10px', marginTop: '12px' }}>
            {!isSidebarCollapsed && <div className="section-title" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', padding: '4px 10px', marginBottom: '2px', fontWeight: '600' }}>工具箱</div>}
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <li
                className={`nav-item ${currentNav === 'cleanup' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('cleanup')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'cleanup' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'cleanup' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'cleanup' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}>
                <span style={{ color: (currentNav === 'cleanup' && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.clean}</span> 文件清理
              </li>
            </ul>
          </div>

          {/* 4. 个人标签 */}
          <div className="nav-section" style={{ padding: '0 10px', marginTop: '12px' }}>
            {!isSidebarCollapsed && <div className="section-title" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', padding: '4px 10px', marginBottom: '2px', fontWeight: '600' }}>个人标签</div>}
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <li
                className={`nav-item ${currentNav === 'tag_orange' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('tag_orange')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'tag_orange' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'tag_orange' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'tag_orange' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}
                title="橙色标签"
              >
                <div
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'tagcolor:orange'); e.dataTransfer.setData('tagcolor', 'orange'); e.dataTransfer.setData('tagcolorcode', '#ff9500'); }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                >
                  <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff9500', flexShrink: 0 }}></span>
                  </span>
                  {!isSidebarCollapsed && <span>橙色</span>}
                </div>
              </li>
              <li
                className={`nav-item ${currentNav === 'tag_green' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('tag_green')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'tag_green' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'tag_green' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'tag_green' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}
                title="绿色标签"
              >
                <div
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'tagcolor:green'); e.dataTransfer.setData('tagcolor', 'green'); e.dataTransfer.setData('tagcolorcode', '#34c759'); }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                >
                  <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34c759', flexShrink: 0 }}></span>
                  </span>
                  {!isSidebarCollapsed && <span>绿色</span>}
                </div>
              </li>
              <li
                className={`nav-item ${currentNav === 'tag_red' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('tag_red')}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: (currentNav === 'tag_red' && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: (currentNav === 'tag_red' && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: (currentNav === 'tag_red' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px' }}
                title="红色标签"
              >
                <div
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'tagcolor:red'); e.dataTransfer.setData('tagcolor', 'red'); e.dataTransfer.setData('tagcolorcode', '#ff3b30'); }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                >
                  <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff3b30', flexShrink: 0 }}></span>
                  </span>
                  {!isSidebarCollapsed && <span>红色</span>}
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Sidebar Footer */}
        {!isSidebarCollapsed && (
          <div style={{ padding: '16px 20px', color: 'var(--icon-color)', cursor: 'pointer' }}>
            <span>&laquo;</span>
          </div>
        )}
      </aside>

      {/* 主工作区 */}
      <main className="main-workspace">
        {/* 顶部标签栏 (仅单视图模式时显示最外层 TabBar) */}
        {viewMode === 'columns' && (
          <header className="tab-bar">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, overflowX: 'auto', padding: '0 8px' }}>
              {tabs.map((tab, index) => {
                const isActive = tab.id === activeTabId;
                const scenarioMap = {
                  smart_format_image: '图片资产',
                  smart_format_document: '文档资料',
                  smart_format_excel: '表格数据',
                  smart_format_media: '媒体资产',
                  smart_scenario_resume: '求职简历',
                  smart_scenario_contract: '合同协议',
                  smart_scenario_invoice: '财务发票',
                  smart_scenario_report: '方案报告',
                  smart_scenario_data: '数据报表',
                  smart_scenario_design: '设计素材',
                  smart_scenario_study: '学习备考',
                  smart_scenario_media: '影音媒体',
                  smart_scenario_code: '代码工程',
                  smart_folders: '全部智能文件夹',
                };

                let title = navConfig[tab.currentNav]?.name || scenarioMap[tab.currentNav] || '';
                if (tab.currentNav.startsWith('tag_')) {
                  const colorMap = { orange: '橙色', green: '绿色', red: '红色' };
                  title = colorMap[tab.currentNav.split('_')[1]] || '标签';
                } else if (tab.currentNav.startsWith('cluster_') || tab.currentNav.startsWith('smart_')) {
                  const matchedCluster = Array.isArray(smartStats) ? smartStats.find(s => s.id === tab.currentNav) : null;
                  if (matchedCluster) {
                    title = matchedCluster.name;
                  } else if (!title) {
                    title = tab.currentNav.replace(/^(cluster_group_|cluster_path_|cluster_|smart_)/, '');
                  }
                }
                if (tab.searchQuery) {
                  title = `搜索: ${tab.searchQuery}`;
                }
                const icon = tab.searchQuery ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg> : (navConfig[tab.currentNav]?.icon || Icons.folder);

                return (
                  <div
                    key={tab.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, tab.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, tab.id)}
                    onClick={() => setActiveTabId(tab.id)}
                    style={{
                      padding: '4px 10px 4px 12px',
                      background: isActive ? '#fff' : 'transparent',
                      borderRadius: isActive ? '6px 6px 0 0' : '6px',
                      fontSize: '12px',
                      fontWeight: isActive ? '500' : '400',
                      display: 'flex',
                      alignItems: 'center',
                      border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                      borderBottom: isActive ? 'none' : '1px solid transparent',
                      boxShadow: isActive ? '0 -1px 3px rgba(0,0,0,0.02)' : 'none',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      position: 'relative',
                      top: isActive ? '1px' : '0',
                      cursor: 'pointer',
                      minWidth: '90px',
                      maxWidth: '180px',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{ marginRight: '6px', display: 'flex', color: isActive ? 'var(--icon-color)' : 'inherit' }}>{icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                    <span
                      onClick={(e) => handleCloseTab(tab.id, e)}
                      style={{ marginLeft: '6px', padding: '2px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.color = '#333'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'inherit'; }}
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                    </span>
                  </div>
                )
              })}

              <span
                onClick={handleAddTab}
                style={{ color: 'var(--icon-color)', fontSize: '18px', cursor: 'pointer', padding: '1px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#eaeaea'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >+</span>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              {/* Window Controls (分屏/单栏切换) */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: '6px', padding: '4px', border: '1px solid var(--border-color)', visibility: (!activeTab || currentNav === 'smart_folders' || searchQuery) ? 'hidden' : 'visible' }}>
                <button
                  onClick={() => handleViewMode('columns')}
                  title="单窗格 + 预览"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: viewMode === 'columns' ? '#fff' : 'transparent',
                    boxShadow: viewMode === 'columns' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    color: viewMode === 'columns' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', display: 'flex'
                  }}
                >
                  {/* 单窗格 图标 */}
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5z" /></svg>
                </button>
                <button
                  onClick={() => handleViewMode('split')}
                  title="上下分屏"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: viewMode === 'split' ? '#fff' : 'transparent',
                    boxShadow: viewMode === 'split' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    color: viewMode === 'split' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', display: 'flex'
                  }}
                >
                  {/* 上下对半分布 图标 */}
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 3h18v8H3V3zm0 10h18v8H3v-8z" /></svg>
                </button>
              </div>
            </div>
          </header>
        )}



        <section className="content-area">
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#fff', height: '100%' }}>
            {!activeTab ? (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '24px', background: '#f5f5f5', borderRadius: '50%', color: '#ccc' }}>
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                </div>
                <span style={{ fontSize: '16px', fontWeight: '500' }}>新建标签页，开始你的工作区吧！</span>
                <span style={{ fontSize: '13px' }}>点击左侧导航栏任意分类或标签，即可一键唤起。</span>
              </div>
            ) : searchQuery ? (
              <>
                <SearchResultsView
                  query={searchQuery}
                  category={searchCategory}
                  onPreview={(file) => handlePreviewFile(file)}
                  setIsGlobalDragging={setIsGlobalDragging}
                  setDraggedFile={setDraggedFile}
                  onSearch={handleSearch}
                />
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} />}
              </>
            ) : currentNav === 'cleanup' ? (
              <CleanupDashboardView workspacePath={workspacePath} />
            ) : currentNav === 'smart_folders' ? (
              <SmartFolderView smartStats={smartStats} onNavClick={handleNavClick} onPreviewFile={(file) => handlePreviewFile(file)} workspacePath={workspacePath} />
            ) : currentNav === 'smart_contract' ? (
              <SmartFolderDetailView key="smart_contract" type="contract" workspacePath={workspacePath} />
            ) : currentNav === 'smart_finance' ? (
              <SmartFolderDetailView key="smart_finance" type="finance" workspacePath={workspacePath} />
            ) : currentNav === 'smart_resume' ? (
              <SmartFolderDetailView key="smart_resume" type="resume" workspacePath={workspacePath} />
            ) : viewMode === 'columns' ? (
              <>
                <FileListView
                  key={currentNav}
                  category={currentNav}
                  taggedFiles={taggedFiles}
                  setTaggedFiles={setTaggedFiles}
                  onPreview={(file) => handlePreviewFile(file)}
                  workspacePath={workspacePath}
                  onResetWorkspace={handleResetWorkspace}
                  setIsGlobalDragging={setIsGlobalDragging}
                  setDraggedFile={setDraggedFile}
                  smartStats={smartStats}
                />
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} />}
              </>
            ) : (
              <SplitView
                taggedFiles={taggedFiles}
                setTaggedFiles={setTaggedFiles}
                onPreview={(file) => handlePreviewFile(file)}
                workspacePath={workspacePath}
                setIsGlobalDragging={setIsGlobalDragging}
                setDraggedFile={setDraggedFile}
                smartStats={smartStats}
                currentNav={currentNav}
                onSwitchViewMode={(mode) => handleViewMode(mode)}
              />
            )}
          </div>
        </section>
      </main>

      <Dropzone
        isGlobalDragging={isGlobalDragging}
        draggedFile={draggedFile}
        workspacePath={workspacePath}
        onGroupSuccess={handleGroupSuccess}
      />
    </div>
  );
}

export default App;
