import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const getFileIcon = (type, size = 16) => {
  switch (type) {
    case 'folder':
      return <svg viewBox="0 0 24 24" width={size} height={size} fill="#6bb5ff"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>;
    case 'pdf':
      return <svg viewBox="0 0 24 24" width={size} height={size} fill="#ef5350"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM14 11h1V8.5h-1V11z"/></svg>;
    case 'excel':
      return <svg viewBox="0 0 24 24" width={size} height={size} fill="#66bb6a"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-2.5l-1.5-2.5-1.5 2.5H8l2.5-3.5L8 9h2.5l1.5 2.5L13.5 9H16l-2.5 3.5L16 16zm-3-9V3.5L18.5 9H13z"/></svg>;
    case 'word':
      return <svg viewBox="0 0 24 24" width={size} height={size} fill="#42a5f5"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1.8 14l-1.4-3.5L9.4 16H7.8l2.2-5h1.6l1.2 3.3 1.2-3.3h1.6l2.2 5h-1.6l-1.4-3.5L13.8 16h-1.6zm.8-9V3.5L18.5 9H13z"/></svg>;
    case 'image':
      return <svg viewBox="0 0 24 24" width={size} height={size} fill="#29b6f6"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>;
    case 'video':
      return <svg viewBox="0 0 24 24" width={size} height={size} fill="#ab47bc"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-2zM9 16V9l7 3.5L9 16z"/></svg>;
    case 'ppt':
      return <svg viewBox="0 0 24 24" width={size} height={size} fill="#ffa726"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-3.5 14H9v-5h1.5v5zm.75-6.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zM13 9V3.5L18.5 9H13z"/></svg>;
    default:
      return <svg viewBox="0 0 24 24" width={size} height={size} fill="#9e9e9e"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>;
  }
};

const getLocalizedName = (path, name) => {
  if (path === '/Applications') return '应用程序';
  if (path === '/Users') return '用户';
  if (path === '/System') return '系统';
  if (path === '/Library') return '资源库';
  return name;
};

export default function FinderView({ initialPath = '/' }) {
  const [columns, setColumns] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      invoke('read_dir_shallow', { path: initialPath })
        .then(items => {
          setColumns([{ path: initialPath, items }]);
        })
        .catch(console.error);
    }
  }, [initialPath]);

  const handleItemClick = (columnIndex, item) => {
    if (item.type === 'folder') {
      const newColumns = columns.slice(0, columnIndex + 1);
      setColumns(newColumns);
      setSelectedFile(null);
      
      invoke('read_dir_shallow', { path: item.path })
        .then(items => {
          setColumns([...newColumns, { path: item.path, items }]);
        })
        .catch(console.error);
    } else {
      setColumns(columns.slice(0, columnIndex + 1));
      setSelectedFile(item);
    }
  };

  // 自动向右滚动以显示最新层级
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth'
      });
    }
  }, [columns, selectedFile]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', background: '#fff' }} ref={scrollContainerRef}>
      {columns.map((column, columnIndex) => {
        const items = column.items || [];
        
        return (
          <div key={column.path + columnIndex} style={{ 
            width: 260, 
            minWidth: 260, 
            borderRight: '1px solid var(--border-color)', 
            overflowY: 'auto', 
            height: '100%',
            backgroundColor: '#fff'
          }}>
            {items.map(item => {
              const isSelected = (columns[columnIndex + 1] && columns[columnIndex + 1].path === item.path) || selectedFile?.id === item.id;
              
              return (
                <div 
                  key={item.id}
                  onClick={() => handleItemClick(columnIndex, item)}
                  style={{ 
                    padding: '6px 12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    background: isSelected ? '#0058d0' : 'transparent',
                    color: isSelected ? '#fff' : 'inherit',
                    cursor: 'default',
                    userSelect: 'none',
                    margin: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                     <span style={{ display: 'flex', filter: isSelected ? 'brightness(0) invert(1)' : 'none' }}>
                        {getFileIcon(item.type, 18)}
                     </span>
                     <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.virtualName || getLocalizedName(item.path, item.name)}</span>
                  </div>
                  {item.type === 'folder' && <span style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--icon-color)', fontSize: '16px' }}>›</span>}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* 右侧预览面板 */}
      {selectedFile && (
        <div style={{ 
          width: 320, 
          minWidth: 320, 
          padding: '40px 24px', 
          height: '100%', 
          overflowY: 'auto',
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          backgroundColor: '#fafafa',
          borderRight: '1px solid var(--border-color)'
        }}>
           <div style={{ width: 120, height: 120, marginBottom: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
             {getFileIcon(selectedFile.type, 96)}
           </div>
           <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', textAlign: 'center', wordBreak: 'break-all', fontWeight: '500' }}>{selectedFile.name}</h3>
           <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: 32 }}>{selectedFile.size}</div>
           
           <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '12px' }}>
               <span style={{ color: 'var(--text-secondary)' }}>种类</span>
               <span style={{ fontWeight: '500' }}>{(selectedFile.type || 'unknown').toUpperCase()} 文件</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '12px' }}>
               <span style={{ color: 'var(--text-secondary)' }}>大小</span>
               <span style={{ fontWeight: '500' }}>{selectedFile.size}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '12px' }}>
               <span style={{ color: 'var(--text-secondary)' }}>修改日期</span>
               <span style={{ fontWeight: '500' }}>{selectedFile.updatedAt}</span>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
