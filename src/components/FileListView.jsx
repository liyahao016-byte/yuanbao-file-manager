import { useState, useEffect } from 'react';
import SmartRenameModal from './SmartRenameModal';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

import { getFileIcon } from '../utils/iconUtils';
import { renderToString } from 'react-dom/server';

const getLocalizedName = (path, name) => {
  if (path === '/Applications') return '应用程序';
  if (path === '/Users') return '用户';
  if (path === '/System') return '系统';
  if (path === '/Library') return '资源库';
  return name;
};

export default function FileListView({ 
  category = 'recent', 
  taggedFiles = {}, 
  setTaggedFiles, 
  onPreview, 
  workspacePath, 
  onResetWorkspace,
  setIsGlobalDragging,
  setDraggedFile,
  smartStats = []
}) {
  const [files, setFiles] = useState([]);
  const [nativeIcons, setNativeIcons] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState({});

  const [hoveredFileId, setHoveredFileId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [formatFilter, setFormatFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [expandedFolders, setExpandedFolders] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [category]);

  useEffect(() => {
    if (category === 'wechat' || category === 'qq') {
      setFiles([]);
      return;
    }

    const doFetch = () => {
      if (window.__TAURI_INTERNALS__) {
        setIsLoading(true);
        let dirPath = workspacePath;
        if (category === 'recent') dirPath = 'sys:recent';
        if (category === 'download') dirPath = 'sys:downloads';
        if (category === 'desktop') dirPath = 'sys:desktop';
        if (category === 'pc') dirPath = '/';

        let fetchPromise;
        if (category.startsWith('tag_')) {
          const color = category.split('_')[1];
          fetchPromise = invoke('get_files_by_tag', { tag: color });
        } else if (category.startsWith('cluster_') || category.startsWith('smart_')) {
          const matchedItem = Array.isArray(smartStats) ? smartStats.find(s => s.id === category) : null;
          if (matchedItem && matchedItem.path) {
            fetchPromise = invoke('read_dir_shallow', { path: matchedItem.path });
          } else {
            fetchPromise = invoke('get_files_by_cluster', { theme: category, page: 1, pageSize: 10000 });
          }
        } else if (dirPath === 'sys:recent') {
          fetchPromise = invoke('get_mac_recent_files');
        } else if (['sys:downloads', 'sys:desktop', 'sys:home', '/'].includes(dirPath)) {
          fetchPromise = invoke('read_dir_shallow', { path: dirPath });
        } else {
          fetchPromise = invoke('get_files', { dirPath });
        }

        fetchPromise
          .then((res) => {
            if (res) {
              setFiles(res);
            }
          })
          .catch(console.error)
          .finally(() => setIsLoading(false));
      }
    };

    // Initial fetch
    doFetch();

    // Listen for cross-component refresh events (e.g. from Dropzone physical move)
    const handleRefresh = () => doFetch();
    window.addEventListener('refresh_workspace', handleRefresh);

    return () => window.removeEventListener('refresh_workspace', handleRefresh);
  }, [category, workspacePath]);

  useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      const allFiles = [...files];
      Object.values(expandedFolders).forEach(children => allFiles.push(...children));
      const pathsToFetch = allFiles.map(f => f.path).filter(path => path && !nativeIcons[path]);
      if (pathsToFetch.length > 0) {
        invoke('get_file_icons_batch', { paths: pathsToFetch })
          .then(res => setNativeIcons(prev => ({ ...prev, ...res })))
          .catch(console.error);
      }
    }
  }, [files, expandedFolders]);


  const handleSyncEmbeddings = async () => {
    if (window.__TAURI_INTERNALS__) {
      setIsSyncing(true);
      try {
        const count = await invoke('sync_all_embeddings');
        alert(`成功构建 ${count} 个文件的向量索引！`);
      } catch (err) {
        console.error(err);
        alert('构建向量失败: ' + err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleBatchExportToDesktop = async () => {
    if (selectedFiles.length === 0 || !window.__TAURI_INTERNALS__) return;
    try {
      const homeDir = await invoke('get_home_dir');
      const targetDir = homeDir + '/Desktop';
      const paths = selectedFiles.map(f => f.path);
      await invoke('export_files', { paths, destDir: targetDir });
      alert(`已成功将 ${paths.length} 个文件批量导出至桌面！`);
    } catch (err) {
      console.error('Export error:', err);
      alert('导出失败: ' + err);
    }
  };

  const handleBatchRevealInFinder = async () => {
    if (selectedFiles.length !== 1 || !window.__TAURI_INTERNALS__) return;
    try {
      await invoke('reveal_in_finder', { path: selectedFiles[0].path });
    } catch (err) {
      console.error('Reveal error:', err);
      alert('定位失败: ' + err);
    }
  };

  const handleRename = (id, newName) => {
    setFiles(files.map(f => f.id === id ? { ...f, name: newName, aiSuggestion: undefined } : f));
  };

  const toggleActive = (id, e, file) => {
    e.stopPropagation();
    setSelectedFileIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleDoubleClick = async (id, e, file) => {
    e.stopPropagation();
    if (file) {
      if (window.__TAURI_INTERNALS__) {
        invoke('record_recent_file', { path: file.path }).catch(console.error);
      }
      if (onPreview) {
        onPreview(file);
      }
    }
  };

  const toggleFolder = async (e, folder) => {
    e.stopPropagation();
    if (expandedFolders[folder.id]) {
      const newExpanded = { ...expandedFolders };
      delete newExpanded[folder.id];
      setExpandedFolders(newExpanded);
    } else {
      try {
        if (window.__TAURI_INTERNALS__) {
          const children = await invoke('read_dir_shallow', { path: folder.path });
          setExpandedFolders(prev => ({
            ...prev,
            [folder.id]: children
          }));
        }
      } catch (err) {
        console.error("Failed to load folder contents:", err);
      }
    }
  };

  // Flatten the tree for rendering
  const getRenderList = (list, depth = 0) => {
    let result = [];
    for (const item of list) {
      result.push({ ...item, depth });
      if (expandedFolders[item.id]) {
        result = result.concat(getRenderList(expandedFolders[item.id], depth + 1));
      }
    }
    return result;
  };
  
  const parseSize = (sizeStr) => {
    if (!sizeStr) return 0;
    if (typeof sizeStr === 'number') return sizeStr;
    const match = sizeStr.toString().match(/([\d.]+)\s*(KB|MB|GB|B)/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === 'KB') return val * 1024;
    if (unit === 'MB') return val * 1024 * 1024;
    if (unit === 'GB') return val * 1024 * 1024 * 1024;
    return val;
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    return new Date(timeStr.replace(' ', 'T')).getTime();
  };

  const rawRenderFiles = getRenderList(files);
  const availableFormats = Array.from(new Set(
    rawRenderFiles.map(f => (f.format || f.type || '').toUpperCase()).filter(f => f && f !== 'FOLDER')
  )).sort();

  let renderFiles = rawRenderFiles;
  
  if (formatFilter !== 'all') {
    renderFiles = renderFiles.filter(f => (f.format || f.type || '').toUpperCase() === formatFilter);
  }

  if (sortConfig.key) {
    renderFiles.sort((a, b) => {
      let valA = 0, valB = 0;
      if (sortConfig.key === 'size') {
        valA = parseSize(a.size);
        valB = parseSize(b.size);
      } else if (sortConfig.key === 'time') {
        valA = parseTime(a.updatedAt || a.updated_at || a.time);
        valB = parseTime(b.updatedAt || b.updated_at || b.time);
      }
      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });
  }

  const handleTagToggle = async (e, fileId, tagColor) => {
    e.stopPropagation();
    if (window.__TAURI_INTERNALS__) {
      const file = renderFiles.find(f => f.id === fileId);
      if (!file) return;
      
      let currentTags = typeof file.tags === 'string' ? file.tags.split(',') : (file.tags || []);
      let newTags = [...currentTags];
      
      if (newTags.includes(tagColor)) {
        newTags = newTags.filter(t => t !== tagColor);
      } else {
        newTags.push(tagColor);
      }
      
      try {
        await invoke('update_file_tags', { path: file.path, tags: newTags.join(',') });
        if (files.find(f => f.id === fileId)) {
          setFiles(files.map(f => f.id === fileId ? { ...f, tags: newTags } : f));
        } else if (file.parentId) {
          setExpandedFolders(prev => ({
            ...prev,
            [file.parentId]: prev[file.parentId].map(f => f.id === fileId ? { ...f, tags: newTags } : f)
          }));
        }
      } catch (err) {
        console.error("Failed to update tags:", err);
      }
    }
  };

  const handleBatchTagToggle = async (tagColor) => {
    if (window.__TAURI_INTERNALS__) {
      try {
        const fileUpdates = [];
        for (const file of selectedFiles) {
          let currentTags = typeof file.tags === 'string' ? file.tags.split(',') : (file.tags || []);
          let newTags = [...currentTags];
          if (!newTags.includes(tagColor)) {
            newTags.push(tagColor);
            await invoke('update_file_tags', { path: file.path, tags: newTags.join(',') });
            fileUpdates.push({ id: file.id, tags: newTags });
          }
        }
        
        if (fileUpdates.length > 0) {
          const updateMap = fileUpdates.reduce((acc, curr) => ({...acc, [curr.id]: curr.tags}), {});
          setFiles(files.map(f => updateMap[f.id] ? { ...f, tags: updateMap[f.id] } : f));
          
          setExpandedFolders(prev => {
            const next = { ...prev };
            for (const key in next) {
              next[key] = next[key].map(f => updateMap[f.id] ? { ...f, tags: updateMap[f.id] } : f);
            }
            return next;
          });
        }
      } catch (err) {
        console.error("Batch tag update failed", err);
      }
    }
  };

  const handleDrop = async (e, fileId) => {
    e.preventDefault();
    e.currentTarget.style.background = '';
    let tagColor = e.dataTransfer.getData('tagcolor') || e.dataTransfer.getData('tagColor');
    if (!tagColor) {
      const textData = e.dataTransfer.getData('text/plain');
      if (textData && textData.startsWith('tagcolor:')) {
        tagColor = textData.split(':')[1];
      }
    }
    
    if (tagColor) {
      if (window.__TAURI_INTERNALS__) {
        // Find current file in renderFiles
        const file = renderFiles.find(f => f.id === fileId);
        if (!file) return;
        
        let newTags = [...(file.tags || [])];
        if (!newTags.includes(tagColor)) {
          newTags.push(tagColor);
          try {
            await invoke('update_file_tags', { path: file.path, tags: newTags.join(',') });
            // Update local state (either in files or expandedFolders)
            if (files.find(f => f.id === fileId)) {
              setFiles(files.map(f => f.id === fileId ? { ...f, tags: newTags } : f));
            } else if (file.parentId) {
              setExpandedFolders(prev => ({
                ...prev,
                [file.parentId]: prev[file.parentId].map(f => f.id === fileId ? { ...f, tags: newTags } : f)
              }));
            }
          } catch (err) {
            console.error("Failed to update tags:", err);
          }
        }
      } else {
        // Mock UI fallback
        if (setTaggedFiles) {
          setTaggedFiles(prev => {
            const currentTags = prev[fileId] || [];
            if (!currentTags.includes(tagColor)) {
              return { ...prev, [fileId]: [...currentTags, tagColor] };
            }
            return prev;
          });
        }
      }
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.currentTarget.style.background = 'var(--bg-active)';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.style.background = 'var(--bg-active)';
  };

  const handleDragLeave = (e) => {
    e.currentTarget.style.background = '';
  };

  const selectedFiles = renderFiles.filter(f => selectedFileIds[f.id]);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  const handleBatchRenameConfirm = async (previews) => {
    if (window.__TAURI_INTERNALS__) {
      try {
        for (const p of previews) {
          await invoke('apply_virtual_rename', { id: p.id, newVirtualName: p.newName, new_virtual_name: p.newName, path: p.path });
        }
        // Refetch top level
        let dirPath = workspacePath;
        if (category === 'recent') dirPath = 'sys:recent';
        if (category === 'download') dirPath = 'sys:downloads';
        if (category === 'desktop') dirPath = 'sys:desktop';
        if (category === 'pc') dirPath = '/';

        let fetchPromise;
        if (category.startsWith('tag_')) {
          const color = category.split('_')[1];
          fetchPromise = invoke('get_files_by_tag', { tag: color });
        } else if (category.startsWith('cluster_')) {
          const theme = category.replace('cluster_', '');
          fetchPromise = invoke('get_files_by_cluster', { theme });
        } else if (dirPath === 'sys:recent') {
          fetchPromise = invoke('get_mac_recent_files');
        } else if (['sys:downloads', 'sys:desktop', 'sys:home', '/'].includes(dirPath)) {
          fetchPromise = invoke('read_dir_shallow', { path: dirPath });
        } else {
          fetchPromise = invoke('get_files', { dirPath });
        }
        
        const res = await fetchPromise;
        if (res) setFiles(res);
        // Clear selection
        setSelectedFileIds({});
      } catch (err) {
        console.error("Rename failed", err);
      }
    } else {
      const previewMap = previews.reduce((acc, p) => ({ ...acc, [p.id]: p.newName }), {});
      setFiles(files.map(f => previewMap[f.id] ? { ...f, name: previewMap[f.id] } : f));
      setSelectedFileIds({});
    }
    setIsRenameModalOpen(false);
  };

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* 合并后的单行表头与工具栏 (Combined Toolbar & Table Header Row) */}
      <div style={{ padding: '6px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '12px', fontWeight: '600', background: '#f8fafc', userSelect: 'none', minHeight: '34px' }}>
        <div style={{ width: '16px', height: '16px', marginRight: '10px', flexShrink: 0 }} />
        
        {/* 文件名 排序 + 工具按钮组 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155', flexShrink: 0 }}
            onClick={() => setSortConfig(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
          >
            文件名 {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '^'}
          </span>

          {/* 工具按钮组 (定位 / 导出 / AI 命名) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            {/* 定位 */}
            <button
              onClick={handleBatchRevealInFinder}
              disabled={selectedFiles.length !== 1}
              title={
                selectedFiles.length === 0
                  ? '请勾选列表中需在 Finder 中定位的文件'
                  : selectedFiles.length > 1
                  ? '多选文件时定位按钮置灰'
                  : '在 macOS Finder 中打开并定位此文件'
              }
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: selectedFiles.length === 1 ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                background: selectedFiles.length === 1 ? '#ffffff' : '#f8fafc',
                fontSize: '11px',
                cursor: selectedFiles.length === 1 ? 'pointer' : 'not-allowed',
                color: selectedFiles.length === 1 ? '#334155' : '#cbd5e1',
                fontWeight: '500',
                opacity: selectedFiles.length === 1 ? 1 : 0.6,
              }}
            >
              定位
            </button>

            {/* 导出 */}
            <button
              onClick={handleBatchExportToDesktop}
              disabled={selectedFiles.length === 0}
              title={selectedFiles.length === 0 ? '请勾选需要导出的文件' : `将勾选的 ${selectedFiles.length} 个文件批量导出至桌面`}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: selectedFiles.length > 0 ? '1px solid rgba(0, 185, 107, 0.3)' : '1px solid #e2e8f0',
                background: selectedFiles.length > 0 ? 'rgba(0, 185, 107, 0.08)' : '#f8fafc',
                fontSize: '11px',
                cursor: selectedFiles.length > 0 ? 'pointer' : 'not-allowed',
                color: selectedFiles.length > 0 ? 'var(--tag-green)' : '#cbd5e1',
                fontWeight: '600',
                opacity: selectedFiles.length > 0 ? 1 : 0.6,
              }}
            >
              导出 {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
            </button>

            {/* 勾选时展现 AI 命名与标签胶囊 */}
            {selectedFiles.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                <button 
                  onClick={() => setIsRenameModalOpen(true)}
                  title="AI 智能批量重命名"
                  style={{ 
                    background: 'var(--tag-green)', color: '#fff', border: 'none', 
                    borderRadius: '4px', padding: '2px 8px', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    fontSize: '11px', fontWeight: '500'
                  }}
                >
                  ✨ AI 命名
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', background: '#e2e8f0', borderRadius: '4px', padding: '2px 6px', gap: '6px' }}>
                  <button onClick={() => handleBatchTagToggle('orange')} title="橙色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff9500' }}></span></button>
                  <button onClick={() => handleBatchTagToggle('green')} title="绿色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34c759' }}></span></button>
                  <button onClick={() => handleBatchTagToggle('red')} title="红色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff3b30' }}></span></button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：大小、格式、操作时间 */}
        <span 
          style={{ width: '80px', textAlign: 'right', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', userSelect: 'none', flexShrink: 0 }} 
          onClick={() => setSortConfig(prev => ({ key: 'size', direction: prev.key === 'size' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
        >
          大小
          <span style={{ display: 'flex', flexDirection: 'column', marginLeft: '4px', fontSize: '8px', lineHeight: 1 }}>
            <span style={{ color: sortConfig.key === 'size' && sortConfig.direction === 'asc' ? 'var(--tag-green)' : '#ccc' }}>▲</span>
            <span style={{ color: sortConfig.key === 'size' && sortConfig.direction === 'desc' ? 'var(--tag-green)' : '#ccc' }}>▼</span>
          </span>
        </span>
        <span style={{ width: '60px', marginLeft: '16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select 
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', appearance: 'none', paddingRight: '12px', zIndex: 1 }}
            >
              <option value="all">格式</option>
              {availableFormats.map(fmt => <option key={fmt} value={fmt}>{fmt}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 0, display: 'flex', flexDirection: 'column', fontSize: '8px', lineHeight: 1, pointerEvents: 'none' }}>
              <span style={{ color: '#ccc' }}>▲</span>
              <span style={{ color: '#ccc' }}>▼</span>
            </span>
          </div>
        </span>
        <span 
          style={{ width: '120px', marginLeft: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', userSelect: 'none', flexShrink: 0 }}
          onClick={() => setSortConfig(prev => ({ key: 'time', direction: prev.key === 'time' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
        >
          操作时间
          <span style={{ display: 'flex', flexDirection: 'column', marginLeft: '4px', fontSize: '8px', lineHeight: 1 }}>
            <span style={{ color: sortConfig.key === 'time' && sortConfig.direction === 'asc' ? 'var(--tag-green)' : '#ccc' }}>▲</span>
            <span style={{ color: sortConfig.key === 'time' && sortConfig.direction === 'desc' ? 'var(--tag-green)' : '#ccc' }}>▼</span>
          </span>
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {files.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#999', fontSize: '14px', marginTop: '100px' }}>
            {category === 'recent' ? '暂时没有最近操作过的文件' : category === 'wechat' ? '暂时没有微信文件' : category === 'qq' ? '暂时没有办公文件' : '暂无文件'}
          </div>
        ) : (
          <div style={{ padding: '4px 8px' }}>
            {renderFiles.map((file) => (
            <div 
            key={file.id}
            draggable={true}
            onDragStart={(e) => {
              if (setIsGlobalDragging) setIsGlobalDragging(true);
              window.__isInternalDrag = true;
              if (setDraggedFile) setDraggedFile(file);
              window.__draggedFile = file;
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('application/json', JSON.stringify(file));
              e.dataTransfer.setData('text/plain', file.id || file.path);
              
              // Custom macOS-style Drag Ghost
              const ghost = document.createElement('div');
              ghost.id = 'drag-ghost-capsule';
              ghost.style.position = 'absolute';
              ghost.style.top = '-1000px';
              ghost.style.background = 'rgba(40, 40, 40, 0.85)';
              ghost.style.color = '#fff';
              ghost.style.padding = '6px 16px';
              ghost.style.borderRadius = '24px';
              ghost.style.display = 'flex';
              ghost.style.alignItems = 'center';
              ghost.style.gap = '8px';
              ghost.style.fontSize = '14px';
              ghost.style.fontWeight = '500';
              ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
              ghost.style.backdropFilter = 'blur(10px)';
              ghost.style.zIndex = '99999';
              ghost.style.border = '1px solid rgba(255,255,255,0.1)';
              
              const iconHtml = renderToString(getFileIcon(file.type || file.fileType));
              ghost.innerHTML = `<span style="display:flex;align-items:center;width:20px;height:20px;">${iconHtml}</span><span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</span>`;
              
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, 20, 20);
            }}
            onDragEnd={(e) => {
              window.__isInternalDrag = false;
              if (setIsGlobalDragging) setIsGlobalDragging(false);
              e.currentTarget.style.opacity = '1';
              const ghost = document.getElementById('drag-ghost-capsule');
              if (ghost) ghost.remove();
              setTimeout(() => {
                if (setDraggedFile) setDraggedFile(null);
                window.__draggedFile = null;
              }, 100);
            }}
            className={`file-row ${selectedFileIds[file.id] ? 'selected' : ''}`}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '4px 8px', 
              height: '34px',
              borderRadius: '6px', 
              background: (selectedFileIds[file.id] || file.aiSuggestion) ? 'var(--bg-active)' : 'transparent',
              marginBottom: '2px',
              cursor: 'pointer',
              color: selectedFileIds[file.id] ? 'var(--tag-green)' : 'inherit',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={() => setHoveredFileId(file.id)}
            onMouseLeave={() => setHoveredFileId(null)}
            onClick={(e) => toggleActive(file.id, e, file)}
            onDoubleClick={(e) => handleDoubleClick(file.id, e, file)}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, file.id)}
            >
              {/* 勾选框 + 文件图标 */}
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: `${(file.depth || 0) * 16}px` }}>
                {file.type === 'folder' && (
                  <span 
                    onClick={(evt) => toggleFolder(evt, file)}
                    style={{ cursor: 'pointer', color: 'var(--icon-color)', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', marginRight: '4px', transform: expandedFolders[file.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }}
                  >
                    ▶
                  </span>
                )}
                <div style={{ width: '16px', height: '16px', border: selectedFileIds[file.id] ? 'none' : '1px solid #cbd5e1', background: selectedFileIds[file.id] ? 'var(--tag-green)' : '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px', cursor: 'pointer' }}>
                  {selectedFileIds[file.id] && <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>}
                </div>
                {nativeIcons[file.path] ? (
                  <img src={`data:image/png;base64,${nativeIcons[file.path]}`} style={{ width: '20px', height: '20px', marginRight: '8px', flexShrink: 0 }} />
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', marginRight: '8px', flexShrink: 0 }}>
                    {getFileIcon(file.type || file.fileType)}
                  </span>
                )}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: selectedFileIds[file.id] ? '600' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.virtualName || getLocalizedName(file.path, file.name)}
                </span>
                
                {/* 颜色标签标记 */}
                {((window.__TAURI_INTERNALS__ ? (typeof file.tags === 'string' ? file.tags.split(',') : (file.tags || [])) : (taggedFiles[file.id] || []))).length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                    {(window.__TAURI_INTERNALS__ ? (typeof file.tags === 'string' ? file.tags.split(',') : (file.tags || [])) : (taggedFiles[file.id] || [])).map(color => (
                      <span key={color} style={{ 
                        width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                        background: color === 'orange' ? '#ff9500' : color === 'green' ? '#34c759' : '#ff3b30'
                      }}></span>
                    ))}
                  </div>
                )}
                
                {/* 智能重命名推荐框 */}
                {file.aiSuggestion && (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#e6f7ef', borderRadius: '6px', padding: '4px 6px 4px 10px', marginLeft: '12px', flexShrink: 0, border: '1px solid #c7ead9' }}>
                    <span style={{ color: '#009a52', marginRight: '12px', fontSize: '12px', fontWeight: '500' }}>AI建议: {file.aiSuggestion}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRename(file.id, file.aiSuggestion); }} 
                      style={{ background: 'var(--tag-green)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', boxShadow: '0 1px 2px rgba(0,185,107,0.2)' }}
                    >
                      AI命名
                    </button>
                  </div>
                )}
              </div>
              
              {hoveredFileId === file.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingRight: '8px', animation: 'fadeIn 0.2s' }}>
                  <button onClick={(e) => handleTagToggle(e, file.id, 'orange')} title="标记为橙色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff9500' }}></span></button>
                  <button onClick={(e) => handleTagToggle(e, file.id, 'green')} title="标记为绿色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34c759' }}></span></button>
                  <button onClick={(e) => handleTagToggle(e, file.id, 'red')} title="标记为红色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff3b30' }}></span></button>
                </div>
              ) : (
                <>
                  <span style={{ width: '80px', textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0 }}>{file.size || '--'}</span>
                  <span style={{ width: '60px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', background: '#f5f5f5', borderRadius: '4px', padding: '2px 0', marginLeft: '16px', flexShrink: 0 }}>{file.format || file.type.toUpperCase()}</span>
                  <span style={{ width: '120px', fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '16px', flexShrink: 0 }}>{file.updatedAt || file.time || '--'}</span>
                </>
              )}
            </div>
          ))}
          </div>
        )}
      </div>

      {/* 10 Items Pagination Control Bar */}
      {category.startsWith('cluster_') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '10px 16px', borderTop: '1px solid var(--border-color)', background: '#ffffff', userSelect: 'none', flexShrink: 0 }}>
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: currentPage <= 1 ? '#f1f5f9' : '#ffffff',
              color: currentPage <= 1 ? '#94a3b8' : 'var(--text-primary)',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '12px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease',
            }}
          >
            ◀ 上一页
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
            第 {currentPage} 页 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>(每页仅精准抓取 10 项)</span>
          </span>
          <button
            disabled={files.length < 10}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: files.length < 10 ? '#f1f5f9' : '#ffffff',
              color: files.length < 10 ? '#94a3b8' : 'var(--text-primary)',
              cursor: files.length < 10 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '12px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease',
            }}
          >
            下一页 ▶
          </button>
        </div>
      )}

      {/* 底部面包屑导航 */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-color)', background: '#fafafa', display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
        {(() => {
          const getBreadcrumbs = () => {
            switch(category) {
              case 'desktop': return ['我的 Mac', '用户', 'superli', '桌面'];
              case 'download': return ['我的 Mac', '用户', 'superli', '下载'];
              case 'wechat': return ['我的 Mac', '应用程序数据', '微信', '文件'];
              case 'qq': return ['我的 Mac', '应用程序数据', '常用沟通工具', '文件'];
              case 'recent': return ['我的 Mac', '最近使用'];
              default:
                if (category.startsWith('tag_')) {
                  const colorMap = { orange: '橙色', green: '绿色', red: '红色' };
                  return ['我的 Mac', '个人标签', colorMap[category.split('_')[1]] || '标签'];
                }
                if (category.startsWith('cluster_') || category.startsWith('smart_')) {
                  const scenarioMap = {
                    smart_format_image: '图片资产',
                    smart_format_document: '文档资料',
                    smart_format_excel: '表格数据',
                    smart_format_media: '媒体资产',
                    smart_scenario_resume: '求职简历与作品集',
                    smart_scenario_contract: '合同协议与法律文件',
                    smart_scenario_invoice: '财务发票与报销凭证',
                    smart_scenario_report: '方案报告与工作文档',
                    smart_scenario_data: '数据报表与统计表格',
                    smart_scenario_design: '设计素材与视觉资产',
                    smart_scenario_study: '学习备考与研究论文',
                    smart_scenario_media: '影音媒体与个人记录',
                    smart_scenario_code: '代码工程与技术文档',
                  };
                  const matchedCluster = Array.isArray(smartStats) ? smartStats.find(s => s.id === category) : null;
                  const name = matchedCluster ? matchedCluster.name : (scenarioMap[category] || category.replace(/^(cluster_group_|cluster_path_|cluster_|smart_)/, ''));
                  return ['我的 Mac', '智能文件夹', name];
                }
                return ['我的 Mac', category];
            }
          };
          const paths = getBreadcrumbs();
          return paths.map((path, index) => (
            <span key={index} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: index === paths.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              <span style={{ marginRight: '6px', color: index === 0 ? '#666' : '#ffd54f' }}>
                {index === 0 ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                )}
              </span> 
              {path}
              {index < paths.length - 1 && <span style={{ margin: '0 6px', color: 'var(--text-secondary)' }}>&gt;</span>}
            </span>
          ));
        })()}
      </div>

      {/* 智能重命名弹窗 */}
      {isRenameModalOpen && (
        <SmartRenameModal 
          selectedFiles={selectedFiles} 
          onClose={() => setIsRenameModalOpen(false)}
          onConfirm={handleBatchRenameConfirm}
        />
      )}
    </div>
  );
}
