import React, { useState } from 'react';
import SmartRenameModal from './SmartRenameModal';

const getFileIcon = (type) => {
  switch (type) {
    case 'pdf':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#ef5350"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM14 11h1V8.5h-1V11z"/></svg>;
    case 'excel':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#66bb6a"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-2.5l-1.5-2.5-1.5 2.5H8l2.5-3.5L8 9h2.5l1.5 2.5L13.5 9H16l-2.5 3.5L16 16zm-3-9V3.5L18.5 9H13z"/></svg>;
    case 'word':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#42a5f5"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1.8 14l-1.4-3.5L9.4 16H7.8l2.2-5h1.6l1.2 3.3 1.2-3.3h1.6l2.2 5h-1.6l-1.4-3.5L13.8 16h-1.6zm.8-9V3.5L18.5 9H13z"/></svg>;
    case 'ppt':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#ffa726"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-3.5 14H9v-5h1.5v5zm.75-6.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zM13 9V3.5L18.5 9H13z"/></svg>;
    default:
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#9e9e9e"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>;
  }
};

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

const METADATA = {
  contract: {
    title: '合同协议',
    keyword: '合同 / 协议 / 签署',
    desc: '基于本地语义向量检索，自动在工作区中归类包含合作、协议特征的文件。',
    actions: ['风险排查']
  },
  finance: {
    title: '财务发票',
    keyword: '发票 / 预算 / 财务',
    desc: '基于本地语义向量检索，自动聚合包含开支明细、票据信息的财务文件。',
    actions: ['提取发票', '格式转换']
  },
  resume: {
    title: '简历求职',
    keyword: '简历 / 面试 / 招聘',
    desc: '自动分类和提取应聘人员简历以及相关面试评估文档。',
    actions: ['简历润色', '经历提取']
  }
};

export default function SmartFolderDetailView({ type = 'contract', workspacePath, onPreview }) {
  const data = METADATA[type];
  const [files, setFiles] = useState([]);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [hoveredFileId, setHoveredFileId] = useState(null);

  React.useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      invoke('get_files', { dirPath: workspacePath || 'sys:desktop' })
        .then((res) => {
          if (res && res.length > 0) {
            let filteredFiles = [];
            if (type === 'contract') {
              filteredFiles = res.filter(f => f.name.match(/(合同|协议|签署|contract)/i) || (f.virtualName && f.virtualName.match(/(合同|协议|签署|contract)/i)));
            } else if (type === 'finance') {
              filteredFiles = res.filter(f => f.name.match(/(发票|报销|流水|财务|finance)/i) || (f.virtualName && f.virtualName.match(/(发票|报销|流水|财务|finance)/i)));
            } else if (type === 'resume') {
              filteredFiles = res.filter(f => f.name.match(/(简历|求职|应聘|面试|resume)/i) || (f.virtualName && f.virtualName.match(/(简历|求职|应聘|面试|resume)/i)));
            }
            // add mock reason
            filteredFiles = filteredFiles.map(f => ({ ...f, reason: `在文件名或特征中匹配到“${data.keyword.split(' / ')[0]}”` }));
            setFiles(filteredFiles);
          }
        })
        .catch(console.error);
    }
  }, [workspacePath, type]);

  const toggleActive = (id, e) => {
    e.stopPropagation();
    setFiles(files.map(f => f.id === id ? { ...f, active: !f.active } : f));
  };

  const handleDoubleClick = async (id, e, file) => {
    e.stopPropagation();
    if (onPreview) {
      onPreview(file);
    } else {
      try {
        if (file.path) await open(file.path);
      } catch (err) {
        console.error("Failed to open file natively:", err);
      }
    }
  };

  const selectedFiles = files.filter(f => f.active);

  const handleBatchRenameConfirm = async (previews) => {
    if (window.__TAURI_INTERNALS__) {
      try {
        for (const p of previews) {
          await invoke('apply_virtual_rename', { id: p.id, newVirtualName: p.newName, new_virtual_name: p.newName, path: p.path });
        }
        // update locally for snappy UI
        const previewMap = previews.reduce((acc, p) => ({ ...acc, [p.id]: p.newName }), {});
        setFiles(files.map(f => previewMap[f.id] ? { ...f, virtualName: previewMap[f.id], active: false } : f));
      } catch (err) {
        console.error("Rename failed", err);
      }
    }
    setIsRenameModalOpen(false);
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
        const file = files.find(f => f.id === fileId);
        if (!file) return;
        
        let currentTags = typeof file.tags === 'string' ? file.tags.split(',') : (file.tags || []);
        let newTags = [...currentTags];
        if (!newTags.includes(tagColor)) {
          newTags.push(tagColor);
          try {
            await invoke('update_file_tags', { path: file.path, tags: newTags.join(',') });
            setFiles(files.map(f => f.id === fileId ? { ...f, tags: newTags } : f));
          } catch (err) {
            console.error("Failed to update tags:", err);
          }
        }
      }
    }
  };

  const handleTagToggle = async (e, fileId, tagColor) => {
    e.stopPropagation();
    if (window.__TAURI_INTERNALS__) {
      const file = files.find(f => f.id === fileId);
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
        setFiles(files.map(f => f.id === fileId ? { ...f, tags: newTags } : f));
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
        }
      } catch (err) {
        console.error("Batch tag update failed", err);
      }
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', height: '100%', overflow: 'auto' }}>
      
      {/* 顶部 AI 聚类洞察区 (AI Insight Header) */}
      <div style={{ padding: '32px 40px', background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(0, 102, 255, 0.2)' }}>
             <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
              {data.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>包含 {data.count} 个文件</span>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ccc' }}></span>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--tag-green)', background: 'rgba(52, 199, 89, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ marginRight: '4px' }}><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h-2v5H6v-2H4v6h16v-6h-2v2h-2v-5h-2v5z"/></svg>
                AI 提取共性词: "{data.keyword}"
              </span>
            </div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {data.desc}
        </p>
      </div>

      {/* 批量操作栏 */}
      {selectedFiles.length > 0 && (
        <div style={{ padding: '12px 24px', background: '#f5f5f5', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>已选择 {selectedFiles.length} 项</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsRenameModalOpen(true)}
              style={{ background: 'var(--tag-green)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>✨</span> AI 智能命名
            </button>
            {data.actions && data.actions.map((action, idx) => (
              <button 
                key={idx}
                onClick={() => {}}
                style={{ background: '#e6f7ff', color: '#1890ff', border: '1px solid #bae7ff', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>✨</span> {action}
              </button>
            ))}
            
            <div style={{ display: 'flex', alignItems: 'center', background: '#e8e8e8', borderRadius: '6px', padding: '4px 8px', gap: '8px', marginLeft: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>标记为:</span>
              <button onClick={() => handleBatchTagToggle('orange')} title="橙色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff9500' }}></span></button>
              <button onClick={() => handleBatchTagToggle('green')} title="绿色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34c759' }}></span></button>
              <button onClick={() => handleBatchTagToggle('red')} title="红色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff3b30' }}></span></button>
            </div>
          </div>
        </div>
      )}

      {/* 列表表头 */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', color: 'var(--text-secondary)', fontSize: '13px', gap: '16px', alignItems: 'center', background: '#fafafa' }}>
        <div style={{ width: '40%' }}>文件名 ^</div>
        <div style={{ width: '15%' }}>大小</div>
        <div style={{ width: '20%' }}>修改日期</div>
        <div style={{ flex: 1 }}>✨ 聚类命中原因</div>
      </div>

      {/* 文件列表 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {files.map(file => (
          <div 
            key={file.id}
            onMouseEnter={() => setHoveredFileId(file.id)}
            onMouseLeave={() => setHoveredFileId(null)}
            onClick={(e) => toggleActive(file.id, e)}
            onDoubleClick={(e) => handleDoubleClick(file.id, e, file)}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, file.id)}
            style={{ 
              display: 'flex', 
              padding: '12px 24px', 
              borderBottom: '1px solid var(--border-color)',
              alignItems: 'center',
              cursor: 'pointer',
              background: file.active ? 'var(--bg-active)' : '#fff',
              transition: 'background 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '40%', gap: '16px' }}>
              <div style={{ width: '16px', height: '16px', border: file.active ? 'none' : '1px solid #d9d9d9', background: file.active ? 'var(--tag-green)' : '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {file.active && <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>}
              </div>
              {getFileIcon(file.type)}
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: file.active ? '500' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.virtualName || file.name}
                </span>
                {/* 颜色标签标记 */}
                {((typeof file.tags === 'string' ? file.tags.split(',') : (file.tags || []))).length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                    {(typeof file.tags === 'string' ? file.tags.split(',') : (file.tags || [])).map(color => (
                      <span key={color} style={{ 
                        width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                        background: color === 'orange' ? '#ff9500' : color === 'green' ? '#34c759' : '#ff3b30'
                      }}></span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {hoveredFileId === file.id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingRight: '8px', animation: 'fadeIn 0.2s', flex: 1, justifyContent: 'flex-end' }}>
                <button onClick={(e) => handleTagToggle(e, file.id, 'orange')} title="标记为橙色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff9500' }}></span></button>
                <button onClick={(e) => handleTagToggle(e, file.id, 'green')} title="标记为绿色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34c759' }}></span></button>
                <button onClick={(e) => handleTagToggle(e, file.id, 'red')} title="标记为红色" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff3b30' }}></span></button>
              </div>
            ) : (
              <>
                <div style={{ width: '15%', fontSize: '13px', color: 'var(--text-secondary)' }}>{file.size}</div>
                <div style={{ width: '20%', fontSize: '13px', color: 'var(--text-secondary)' }}>{file.updated_at}</div>
                <div style={{ flex: 1, fontSize: '13px', color: 'var(--tag-purple)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  {file.reason}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

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
