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
import CloudDriveView from './components/CloudDriveView';
import ToolboxView from './components/ToolboxView';
import SettingsModal from './components/SettingsModal';
import DocumentTranslateView from './components/DocumentTranslateView';
import FormatConvertView from './components/FormatConvertView';
import ArchiveFromClusterModal from './components/ArchiveFromClusterModal';
import QuickArchiveModal from './components/QuickArchiveModal';
import ArchiveSetupGuide from './components/ArchiveSetupGuide';
import ArchiveTimelineView from './components/ArchiveTimelineView';
import DemandKanbanView from './components/DemandKanbanView';
import ArchiveAIReportPanel from './components/ArchiveAIReportPanel';
import AssetBoardView from './components/AssetBoardView';

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
  ai: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 11.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm6 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 17.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z" /></svg>,
  cloud: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>,
  toolbox: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.34C18 2.54 15.46 0 12.34 0c-1.48 0-2.84.58-3.84 1.53L7 3H4C2.9 3 2 3.9 2 5v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8-3.86C13.34 2.51 14 3.38 14 4.66c0 .44-.09.85-.24 1.34H10.5l1.5-3.86zM11 8l-2 5h2l-1 5 5-7h-3l2-3h-3z"/></svg>,
  translate: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>,
  convert: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>,
  settings: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96a6.97 6.97 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6-3.6z"/></svg>
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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // 归档功能状态
  const [showArchiveFromCluster, setShowArchiveFromCluster] = useState(false);
  const [archiveClusterData, setArchiveClusterData] = useState({ clusterName: '', files: [] });
  const [showQuickArchive, setShowQuickArchive] = useState(false);
  const [showArchiveSetup, setShowArchiveSetup] = useState(false);
  const [archiveConfigured, setArchiveConfigured] = useState(() => localStorage.getItem('archive_configured') === 'true');
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0); // 用于归档后触发时间线刷新
  const [showAIReport, setShowAIReport] = useState(false); // AI 报告面板
  const [archiveContext, setArchiveContext] = useState(null); // 拉起归档表单时携带的上下文（需求节点 / 预填数据）

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

    // 同步写入自定义簇和钉住列表，以便在智能文件夹视图和侧边栏中展示
    try {
      const customClusters = JSON.parse(localStorage.getItem('smart_custom_clusters') || '[]');
      const updatedClusters = [newCluster, ...customClusters.filter(c => c.name !== folderName)];
      localStorage.setItem('smart_custom_clusters', JSON.stringify(updatedClusters));

      const pinnedIds = JSON.parse(localStorage.getItem('smart_pinned_ids') || '[]');
      if (!pinnedIds.includes(newCluster.id)) {
        localStorage.setItem('smart_pinned_ids', JSON.stringify([...pinnedIds, newCluster.id]));
      }

      window.dispatchEvent(new CustomEvent('smart_cluster_state_change'));
    } catch (e) {
      console.error('Failed to sync smart cluster state:', e);
    }

    // Trigger visual pulse animation on sidebar Smart Folders
    setHighlightSmartFolder(true);
    setTimeout(() => {
      setHighlightSmartFolder(false);
    }, 2000);
  };

  // 归档功能处理函数
  const handleArchiveFromCluster = async (clusterId, clusterName, files) => {
    if (!archiveConfigured) {
      setShowArchiveSetup(true);
      return;
    }
    // 二次检查后端配置
    try {
      if (window.__TAURI_INTERNALS__) {
        const config = await invoke('get_archive_config');
        if (!config || !config.vaultPath) {
          setShowArchiveSetup(true);
          return;
        }
      }
    } catch (e) {
      console.warn('[Archive] 检查配置失败:', e);
    }
    setArchiveClusterData({ clusterName, files });
    setShowArchiveFromCluster(true);
  };

  const handleQuickArchive = async () => {
    if (!archiveConfigured) {
      setShowArchiveSetup(true);
      return;
    }
    // 二次检查后端配置是否真实存在
    try {
      if (window.__TAURI_INTERNALS__) {
        const config = await invoke('get_archive_config');
        if (!config || !config.vaultPath) {
          // localStorage 标记了已配置，但后端实际没有 vault_path
          setShowArchiveSetup(true);
          return;
        }
      }
    } catch (e) {
      console.warn('[Archive] 检查配置失败:', e);
    }
    setShowQuickArchive(true);
  };

  const handleArchiveSetupComplete = async (config) => {
    localStorage.setItem('archive_configured', 'true');
    localStorage.setItem('archive_path', config.archivePath);
    localStorage.setItem('archive_obsidian', String(config.obsidianEnabled));
    // 写入 Rust 后端配置
    try {
      await invoke('set_archive_config', {
        config: {
          vaultPath: config.archivePath,
          obsidianMode: config.obsidianEnabled,
          dailyPattern: null,
        }
      });
      console.log('[Archive] 归档配置已保存到后端');
    } catch (err) {
      console.warn('[Archive] 配置保存到后端失败:', err);
    }
    setArchiveConfigured(true);
    setShowArchiveSetup(false);
  };

  const handleArchiveConfirm = async (data) => {
    console.log('[Archive] 归档数据:', data);
    try {
      const result = await invoke('archive_file', {
        input: {
          title: data.title || '',
          project: data.project || null,
          priority: data.priority || null,
          durationMin: data.duration ? parseInt(data.duration, 10) : null,
          output: data.output || null,
          blocker: data.blocker || null,
          nextAction: data.nextAction || null,
          tags: data.tags || [],
          linkedFiles: data.files || [],
          customVaultPath: data.customVaultPath || null,
          // 需求看板扩展字段
          demandId: data.demandId || null,
          nodeType: data.nodeType || null,
          isKeyConclusion: data.isKeyConclusion || false,
        }
      });
      console.log('[Archive] 归档成功:', result);
      setArchiveContext(null);
      // 归档成功：关闭弹窗 → 刷新时间线
      setShowArchiveFromCluster(false);
      setShowQuickArchive(false);
      setArchiveRefreshKey(prev => prev + 1);
      // 需求节点归档（带 demandId）：留在需求看板，方便继续推进时间线；
      // 普通归档：跳转到归档时间线查看结果
      if (!data.demandId) {
        handleNavClick('archive_timeline');
      }
    } catch (err) {
      console.error('[Archive] 归档写入失败:', err);
      // 向用户展示错误信息
      const errMsg = typeof err === 'string' ? err : (err?.message || '未知错误');
      if (errMsg.includes('归档目录未配置') || errMsg.includes('vault')) {
        // 归档目录未配置 —— 打开设置引导
        alert('归档目录尚未配置，请先设置归档存储路径。');
        setShowArchiveFromCluster(false);
        setShowQuickArchive(false);
        setShowArchiveSetup(true);
      } else {
        alert('归档失败：' + errMsg);
      }
    }
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
    qq: { name: '办公文件', icon: Icons.qq },
    pc: { name: '此电脑', icon: Icons.pc },
    cloud: { name: '个人云盘', icon: Icons.cloud },
    smart_folders: { name: '智能文件夹', icon: Icons.folder },
    cleanup: { name: '垃圾清理', icon: Icons.clean },
    toolbox: { name: '工具箱', icon: Icons.toolbox },
    translate: { name: '文档翻译', icon: Icons.translate },
    convert: { name: '格式转换', icon: Icons.convert },
    smart_contract: { name: '合同协议', icon: Icons.folder },
    smart_finance: { name: '财务发票', icon: Icons.folder },
    smart_resume: { name: '简历求职', icon: Icons.folder },
    archive_timeline: { name: '知识归档', icon: Icons.folder }
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
        return count;
      } catch (err) {
        console.error(err);
        throw err;
      }
    } else {
      // 浏览器 Web 调试/预览环境降级模拟
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return 12;
    }
  };

  if (!workspacePath) {
    return <WelcomeScreen onWorkspaceSelected={handleWorkspaceSelected} />;
  }

  return (
    <div className="app-container">
      {/* 左侧边栏 */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '36px' }}>
          {!isSidebarCollapsed && (
            <h1 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px', margin: 0, color: '#0f172a' }}>智能文件管理器</h1>
          )}
          <div
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--icon-color)', marginLeft: isSidebarCollapsed ? '-4px' : '0' }}
            title={isSidebarCollapsed ? '展开导航栏' : '收起导航栏'}
          >
            {isSidebarCollapsed ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
            )}
          </div>
        </div>

        {!isSidebarCollapsed && (
          <div style={{ padding: '0 16px', marginBottom: '14px' }}>
            <SmartSearchBox onSearch={handleSearch} activeSearchQuery={searchQuery} />
          </div>
        )}

        {/* Sidebar Nav Sections Wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', gap: '10px' }}>

          {/* 1. 快捷访问 */}
          <div className="nav-section" style={{ padding: '0 10px' }}>
            {!isSidebarCollapsed && (
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase', padding: '4px 8px 2px' }}>
                快捷访问
              </div>
            )}

            {/* 格式快捷入口胶囊 */}
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', gap: '4px', padding: '2px 4px', marginBottom: '4px' }}>
                {[
                  { id: 'smart_format_image', name: '图片' },
                  { id: 'smart_format_document', name: '文档' },
                  { id: 'smart_format_excel', name: '表格' },
                  { id: 'smart_format_media', name: '媒体' }
                ].map(item => {
                  const isActive = currentNav === item.id && !searchQuery;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      style={{
                        flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: '5px',
                        background: isActive ? 'rgba(0, 185, 107, 0.12)' : '#f1f5f9',
                        color: isActive ? 'var(--tag-green)' : '#475569',
                        fontSize: '11px', fontWeight: isActive ? '700' : '500', cursor: 'pointer',
                        border: isActive ? '1px solid rgba(0, 185, 107, 0.35)' : '1px solid #e2e8f0',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                  );
                })}
              </div>
            )}

            <ul style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: 0, margin: 0, listStyle: 'none' }}>
              {[
                { id: 'recent', name: '最近', icon: Icons.recent },
                { id: 'download', name: '下载', icon: Icons.download },
                { id: 'desktop', name: '桌面', icon: Icons.desktop },
                { id: 'wechat', name: '微信文件', icon: Icons.wechat },
                { id: 'qq', name: '办公文件', icon: Icons.qq },
                { id: 'pc', name: '此电脑', icon: Icons.pc },
              ].map(item => {
                const isActive = currentNav === item.id && !searchQuery;
                return (
                  <li
                    key={item.id}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: '6px',
                      background: isActive ? 'var(--bg-active)' : 'transparent',
                      color: isActive ? 'var(--tag-green)' : 'var(--text-primary)',
                      fontWeight: isActive ? '600' : '400', cursor: 'pointer', fontSize: '13px'
                    }}
                  >
                    <span style={{ color: isActive ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{item.icon}</span>
                    {!isSidebarCollapsed && <span>{item.name}</span>}
                  </li>
                );
              })}

              {/* 小云盘入口 */}
              <li
                className={`nav-item ${currentNav === 'cloud' && !searchQuery ? 'active' : ''}`}
                onClick={() => handleNavClick('cloud')}
                style={{
                  display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: '6px',
                  background: (currentNav === 'cloud' && !searchQuery) ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: (currentNav === 'cloud' && !searchQuery) ? '#6366f1' : 'var(--text-primary)',
                  fontWeight: (currentNav === 'cloud' && !searchQuery) ? '600' : '400', cursor: 'pointer', fontSize: '13px'
                }}
                title="个人云盘"
              >
                <span style={{ color: '#6366f1', marginRight: '8px', display: 'flex', opacity: (currentNav === 'cloud' && !searchQuery) ? 1 : 0.6 }}>{Icons.cloud}</span>
                {!isSidebarCollapsed && (
                  <>
                    <span style={{ flex: 1 }}>个人云盘</span>
                    <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: '600', marginLeft: '4px' }}>6</span>
                  </>
                )}
              </li>
            </ul>
          </div>

          {/* 2. 智能文件夹 */}
          <div className={`nav-section ${highlightSmartFolder ? 'smart-folder-pulse' : ''}`} style={{ padding: '0 10px' }}>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 2px' }}>
                <span style={{ fontSize: '11px', color: highlightSmartFolder ? 'var(--tag-green)' : '#94a3b8', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  智能文件夹 {highlightSmartFolder ? '✨' : ''}
                </span>
                <div
                  onClick={() => handleNavClick('smart_folders')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    padding: '2px 8px', borderRadius: '12px',
                    background: 'rgba(0, 185, 107, 0.08)',
                    border: '1px solid rgba(0, 185, 107, 0.25)',
                    color: 'var(--tag-green)', fontSize: '10px', fontWeight: '600',
                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,185,107,0.15)'; e.currentTarget.style.transform = 'translateX(1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,185,107,0.08)'; e.currentTarget.style.transform = 'none'; }}
                  title="查看全部智能分类文件夹"
                >
                  全部
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                </div>
              </div>
            )}
            {isSidebarCollapsed ? (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: 0, margin: 0 }}>
                <li
                  className={`nav-item ${(currentNav.startsWith('cluster_') || currentNav.startsWith('smart_') || currentNav === 'smart_folders') && !searchQuery ? 'active' : ''}`}
                  onClick={() => handleNavClick(smartStats.length > 0 ? smartStats[0].id : 'smart_folders')}
                  style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: '6px', background: ((currentNav.startsWith('cluster_') || currentNav.startsWith('smart_') || currentNav === 'smart_folders') && !searchQuery) ? 'var(--bg-active)' : 'transparent', color: ((currentNav.startsWith('cluster_') || currentNav.startsWith('smart_') || currentNav === 'smart_folders') && !searchQuery) ? 'var(--tag-green)' : 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}
                  title="智能文件夹"
                >
                  <span style={{ color: ((currentNav.startsWith('cluster_') || currentNav.startsWith('smart_') || currentNav === 'smart_folders') && !searchQuery) ? 'inherit' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{Icons.ai}</span>
                </li>
              </ul>
            ) : (
              <div style={{ maxHeight: '160px', overflowY: 'auto', paddingRight: '2px' }} className="custom-sidebar-scroll">
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: 0, margin: 0, listStyle: 'none' }}>
                  {(() => {
                    const pinnedIds = JSON.parse(localStorage.getItem('smart_pinned_ids') || '[]');
                    const deletedIds = JSON.parse(localStorage.getItem('smart_deleted_ids') || '[]');
                    const customClusters = JSON.parse(localStorage.getItem('smart_custom_clusters') || '[]');
                    const customNames = JSON.parse(localStorage.getItem('smart_cluster_custom_names') || '{}');

                    const rawStats = Array.isArray(smartStats) ? smartStats : [];
                    const allMap = new Map();
                    rawStats.forEach(s => allMap.set(s.id, { ...s, name: customNames[s.id] || s.name }));
                    customClusters.forEach(c => allMap.set(c.id, { ...c, name: customNames[c.id] || c.name }));

                    const themeList = Array.from(allMap.values()).filter(c =>
                      !c.id.startsWith('smart_format_') && c.category_type !== 'format' && !deletedIds.includes(c.id)
                    );

                    const pinnedList = themeList
                      .filter(c => pinnedIds.includes(c.id))
                      .sort((a, b) => pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id));

                    return pinnedList.map(cluster => {
                      const isActive = currentNav === cluster.id && !searchQuery;
                      return (
                        <li
                          key={cluster.id}
                          className={`nav-item ${isActive ? 'active' : ''}`}
                          onClick={() => handleNavClick(cluster.id)}
                          style={{
                            display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: '6px',
                            background: isActive ? 'var(--bg-active)' : 'transparent',
                            color: isActive ? 'var(--tag-green)' : 'var(--text-primary)',
                            fontWeight: isActive ? '600' : '400', cursor: 'pointer', fontSize: '12px'
                          }}
                          title={`${cluster.name} (已置顶)`}
                        >
                          <span style={{ color: isActive ? 'inherit' : '#ff9500', marginRight: '6px', fontSize: '13px', display: 'flex', alignItems: 'center' }}>📌</span>
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
            )}
          </div>

          {/* 3. 工具箱 - 大区标题 + 子功能列表 */}
          <div className="nav-section" style={{ padding: '0 10px' }}>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 2px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  工具箱
                </span>
                <div
                  onClick={() => handleNavClick('toolbox')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    padding: '2px 8px', borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    color: '#d97706', fontSize: '10px', fontWeight: '600',
                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.15)'; e.currentTarget.style.transform = 'translateX(1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; e.currentTarget.style.transform = 'none'; }}
                  title="查看全部工具"
                >
                  全部
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                </div>
              </div>
            )}

            <ul style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: 0, margin: 0, listStyle: 'none' }}>
              {[
                { id: 'archive_timeline', name: '需求看板', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>, badgeColor: '#059669' },
                { id: 'asset_board', name: '智能资产沉淀', icon: <span style={{ fontSize: '16px', display: 'flex', alignItems: 'center' }}>💎</span>, badgeColor: '#6366f1' },
                { id: 'translate', name: '文档翻译', icon: Icons.translate, badgeColor: '#3b82f6' },
                { id: 'cleanup', name: '垃圾清理', icon: Icons.clean, badgeColor: '#10b981' },
                { id: 'convert', name: '格式转换', icon: Icons.convert, badgeColor: '#f59e0b' },
              ].map(sub => {
                const isActive = currentNav === sub.id && !searchQuery;
                return (
                  <li
                    key={sub.id}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavClick(sub.id)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: '6px',
                      background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      color: isActive ? '#6366f1' : 'var(--text-primary)',
                      fontWeight: isActive ? '600' : '400',
                      cursor: 'pointer', fontSize: '13px',
                    }}
                    title={sub.name}
                  >
                    <span style={{ color: isActive ? '#6366f1' : 'var(--icon-color)', marginRight: '8px', display: 'flex' }}>{sub.icon}</span>
                    {!isSidebarCollapsed && <span style={{ flex: 1 }}>{sub.name}</span>}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 知识归档入口已移至工具箱下前两位 */}

          {/* 4. 个人标签 */}
          <div className="nav-section" style={{ padding: '0 10px' }}>
            {!isSidebarCollapsed && (
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase', padding: '4px 8px 2px' }}>
                个人标签
              </div>
            )}
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: 0, margin: 0, listStyle: 'none' }}>
              {[
                { id: 'tag_orange', name: '橙色', color: '#ff9500' },
                { id: 'tag_green', name: '绿色', color: '#34c759' },
                { id: 'tag_red', name: '红色', color: '#ff3b30' },
              ].map(tag => {
                const isActive = currentNav === tag.id && !searchQuery;
                return (
                  <li
                    key={tag.id}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavClick(tag.id)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: '6px',
                      background: isActive ? 'var(--bg-active)' : 'transparent',
                      color: isActive ? 'var(--tag-green)' : 'var(--text-primary)',
                      fontWeight: isActive ? '600' : '400', cursor: 'pointer', fontSize: '13px'
                    }}
                    title={`${tag.name}标签`}
                  >
                    <div
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', `tagcolor:${tag.id.split('_')[1]}`); e.dataTransfer.setData('tagcolor', tag.id.split('_')[1]); e.dataTransfer.setData('tagcolorcode', tag.color); }}
                      style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                    >
                      <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: tag.color, flexShrink: 0 }}></span>
                      </span>
                      {!isSidebarCollapsed && <span>{tag.name}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Sidebar Footer：左下角设置图标按钮 */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            style={{
              width: '100%', padding: '6px 10px', borderRadius: '6px',
              border: '1px solid #cbd5e1', background: '#ffffff',
              color: '#334155', fontSize: '12px', fontWeight: '500',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
              gap: '8px', transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
            title="设置 - 更新向量库与授权工作区"
          >
            <span style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}>{Icons.settings}</span>
            {!isSidebarCollapsed && <span>设置与管理</span>}
          </button>
        </div>
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
                  smart_scenario_archive: '归档记录',
                  smart_scenario_daily: '日记时间线',
                  smart_folders: '全部智能文件夹',
                };

                let title = navConfig[tab.currentNav]?.name || scenarioMap[tab.currentNav] || '';
                if (tab.currentNav.startsWith('tag_')) {
                  const colorMap = { orange: '橙色', green: '绿色', red: '红色' };
                  title = colorMap[tab.currentNav.split('_')[1]] || '标签';
                } else if (tab.currentNav.startsWith('cluster_') || tab.currentNav.startsWith('smart_')) {
                  const customNames = JSON.parse(localStorage.getItem('smart_cluster_custom_names') || '{}');
                  if (customNames[tab.currentNav]) {
                    title = customNames[tab.currentNav];
                  } else {
                    const matchedCluster = Array.isArray(smartStats) ? smartStats.find(s => s.id === tab.currentNav) : null;
                    if (matchedCluster) {
                      title = matchedCluster.name;
                    } else if (!title) {
                      title = tab.currentNav.replace(/^(cluster_group_|cluster_path_|cluster_|smart_)/, '');
                    }
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
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} isSmartFolderContext={currentNav.startsWith('smart_') && !searchQuery} />}
              </>
            ) : currentNav === 'cloud' ? (
              <CloudDriveView />
            ) : currentNav === 'translate' ? (
              <DocumentTranslateView workspacePath={workspacePath} />
            ) : currentNav === 'convert' ? (
              <FormatConvertView workspacePath={workspacePath} />
            ) : currentNav === 'toolbox' ? (
              <ToolboxView onNavClick={handleNavClick} />
            ) : currentNav === 'cleanup' ? (
              <CleanupDashboardView workspacePath={workspacePath} />
            ) : currentNav === 'archive_timeline' ? (
              <>
                <DemandKanbanView
                  key={archiveRefreshKey}
                  refreshKey={archiveRefreshKey}
                  onOpenArchiveModal={(demandCtx) => {
                    if (demandCtx && demandCtx.demandId) {
                      setArchiveContext({ demandId: demandCtx.demandId, demandTitle: demandCtx.demandTitle });
                    }
                    setShowQuickArchive(true);
                  }}
                  onPreviewFile={(file) => handlePreviewFile(file)}
                  onOpenAIReport={() => setShowAIReport(true)}
                />
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} />}
              </>
            ) : currentNav === 'asset_board' || currentNav === 'asset_distiller' ? (
              <AssetBoardView currentNav={currentNav} />
            ) : currentNav === 'smart_folders' ? (
              <>
                <SmartFolderView smartStats={smartStats} onNavClick={handleNavClick} onPreviewFile={(file) => handlePreviewFile(file)} onArchive={handleArchiveFromCluster} workspacePath={workspacePath} />
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} isSmartFolderContext={currentNav.startsWith('smart_') && !searchQuery} />}
              </>
            ) : currentNav === 'smart_contract' ? (
              <>
                <SmartFolderDetailView key="smart_contract" type="contract" workspacePath={workspacePath} onPreview={(file) => handlePreviewFile(file)} />
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} isSmartFolderContext={currentNav.startsWith('smart_') && !searchQuery} />}
              </>
            ) : currentNav === 'smart_finance' ? (
              <>
                <SmartFolderDetailView key="smart_finance" type="finance" workspacePath={workspacePath} onPreview={(file) => handlePreviewFile(file)} />
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} isSmartFolderContext={currentNav.startsWith('smart_') && !searchQuery} />}
              </>
            ) : currentNav === 'smart_resume' ? (
              <>
                <SmartFolderDetailView key="smart_resume" type="resume" workspacePath={workspacePath} onPreview={(file) => handlePreviewFile(file)} />
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} isSmartFolderContext={currentNav.startsWith('smart_') && !searchQuery} />}
              </>
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
                {previewFile && <PreviewerView file={previewFile} onClose={() => handlePreviewFile(null)} isSmartFolderContext={currentNav.startsWith('smart_') && !searchQuery} />}
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

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSyncEmbeddings={handleSyncEmbeddings}
        onResetWorkspace={handleResetWorkspace}
        workspacePath={workspacePath}
      />

      {/* 归档弹窗 */}
      {showArchiveFromCluster && (
        <ArchiveFromClusterModal
          clusterName={archiveClusterData.clusterName}
          files={archiveClusterData.files}
          onClose={() => setShowArchiveFromCluster(false)}
          onConfirm={handleArchiveConfirm}
        />
      )}

      {showQuickArchive && (
        <QuickArchiveModal
          onClose={() => { setShowQuickArchive(false); setArchiveContext(null); }}
          onConfirm={handleArchiveConfirm}
          prefill={archiveContext}
          demandContext={archiveContext?.demandId ? { demandId: archiveContext.demandId, demandTitle: archiveContext.demandTitle } : null}
        />
      )}

      {showArchiveSetup && (
        <ArchiveSetupGuide
          onClose={() => setShowArchiveSetup(false)}
          onComplete={handleArchiveSetupComplete}
        />
      )}

      {showAIReport && (
        <ArchiveAIReportPanel onClose={() => setShowAIReport(false)} />
      )}
    </div>
  );
}

export default App;
