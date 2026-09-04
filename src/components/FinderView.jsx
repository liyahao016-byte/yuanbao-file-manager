import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon } from '../utils/iconUtils';

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
