import React, { useState, useRef, useEffect } from 'react';
import FileListView from './FileListView';
import { getFileIcon } from '../utils/iconUtils';

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
  recent: '最近文件',
  desktop: '桌面',
  download: '下载',
  wechat: '微信文件',
  qq: '办公文件',
  pc: '此电脑'
};

const navNames = {
  recent: '最近文件',
  desktop: '桌面',
  download: '下载',
  wechat: '微信文件',
  qq: '办公文件',
  pc: '此电脑',
  smart_folders: '智能分类'
};

function MiniTabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onAddTab, onSwitchViewMode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', padding: '0 8px', height: '30px', userSelect: 'none' }}>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1, overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          let title = navNames[tab.currentNav] || scenarioMap[tab.currentNav] || tab.currentNav;
          if (tab.currentNav.startsWith('cluster_')) {
            title = tab.currentNav.replace(/^cluster_/, '');
          }
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                padding: '3px 8px 3px 10px',
                background: isActive ? '#ffffff' : 'transparent',
                borderRadius: isActive ? '4px 4px 0 0' : '4px',
                fontSize: '11px',
                fontWeight: isActive ? '600' : '400',
                display: 'flex',
                alignItems: 'center',
                color: isActive ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                border: isActive ? '1px solid #cbd5e1' : '1px solid transparent',
                borderBottom: isActive ? 'none' : '1px solid transparent',
                maxWidth: '150px',
                minWidth: '70px',
                position: 'relative',
                top: isActive ? '1px' : '0',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                  style={{ marginLeft: '4px', padding: '1px', color: '#94a3b8', borderRadius: '2px', display: 'flex', alignItems: 'center' }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  ✕
                </span>
              )}
            </div>
          );
        })}
        <button
          onClick={onAddTab}
          title="新建分类标签页"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px', padding: '0 4px', display: 'flex', alignItems: 'center' }}
          onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'}
          onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
        >
          +
        </button>
      </div>

      {onSwitchViewMode && (
        <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '4px', padding: '2px', border: '1px solid #cbd5e1', marginLeft: '8px' }}>
          <button
            onClick={() => onSwitchViewMode('columns')}
            title="单窗格视图"
            style={{
              padding: '2px 6px',
              borderRadius: '3px',
              background: 'transparent',
              color: '#64748b',
              border: 'none', cursor: 'pointer', display: 'flex'
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5z" /></svg>
          </button>
          <button
            onClick={() => onSwitchViewMode('split')}
            title="上下双窗格分屏"
            style={{
              padding: '2px 6px',
              borderRadius: '3px',
              background: '#e2e8f0',
              color: '#0f172a',
              border: 'none', cursor: 'pointer', display: 'flex'
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 3h18v8H3V3zm0 10h18v8H3v-8z" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default function SplitView({ 
  taggedFiles, 
  setTaggedFiles, 
  onPreview, 
  workspacePath, 
  setIsGlobalDragging, 
  setDraggedFile, 
  smartStats, 
  currentNav = 'recent',
  onSwitchViewMode
}) {
  const [topTabs, setTopTabs] = useState([
    { id: 'top_1', currentNav: currentNav || 'desktop' }
  ]);
  const [topActiveTabId, setTopActiveTabId] = useState('top_1');

  const [bottomTabs, setBottomTabs] = useState([
    { id: 'bot_1', currentNav: 'recent' }
  ]);
  const [bottomActiveTabId, setBottomActiveTabId] = useState('bot_1');

  const [topHeight, setTopHeight] = useState(50);
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  // Sync top active tab with sidebar navigation if changed
  useEffect(() => {
    if (currentNav) {
      setTopTabs(prev => prev.map(t => t.id === topActiveTabId ? { ...t, currentNav } : t));
    }
  }, [currentNav]);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    let newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    if (newHeight < 20) newHeight = 20;
    if (newHeight > 80) newHeight = 80;
    setTopHeight(newHeight);
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Top Pane Tab Handlers
  const handleAddTopTab = () => {
    const newId = `top_${Date.now()}`;
    setTopTabs(prev => [...prev, { id: newId, currentNav: 'desktop' }]);
    setTopActiveTabId(newId);
  };

  const handleCloseTopTab = (id) => {
    const next = topTabs.filter(t => t.id !== id);
    setTopTabs(next);
    if (topActiveTabId === id && next.length > 0) {
      setTopActiveTabId(next[next.length - 1].id);
    }
  };

  // Bottom Pane Tab Handlers
  const handleAddBottomTab = () => {
    const newId = `bot_${Date.now()}`;
    setBottomTabs(prev => [...prev, { id: newId, currentNav: 'download' }]);
    setBottomActiveTabId(newId);
  };

  const handleCloseBottomTab = (id) => {
    const next = bottomTabs.filter(t => t.id !== id);
    setBottomTabs(next);
    if (bottomActiveTabId === id && next.length > 0) {
      setBottomActiveTabId(next[next.length - 1].id);
    }
  };

  const activeTopTab = topTabs.find(t => t.id === topActiveTabId) || topTabs[0];
  const activeBottomTab = bottomTabs.find(t => t.id === bottomActiveTabId) || bottomTabs[0];

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', height: '100%', width: '100%' }}>
      {/* 上半屏幕 */}
      <div style={{ height: `${topHeight}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <MiniTabBar
          tabs={topTabs}
          activeTabId={topActiveTabId}
          onSelectTab={setTopActiveTabId}
          onCloseTab={handleCloseTopTab}
          onAddTab={handleAddTopTab}
          onSwitchViewMode={onSwitchViewMode}
        />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <FileListView 
            key={`top_${activeTopTab.id}_${activeTopTab.currentNav}`}
            category={activeTopTab.currentNav} 
            taggedFiles={taggedFiles} 
            setTaggedFiles={setTaggedFiles}
            onPreview={onPreview}
            workspacePath={workspacePath}
            setIsGlobalDragging={setIsGlobalDragging}
            setDraggedFile={setDraggedFile}
            smartStats={smartStats}
          />
        </div>
      </div>
      
      {/* 拖拽分割线 */}
      <div 
        onMouseDown={handleMouseDown}
        style={{ 
          height: '6px', 
          width: '100%',
          background: '#e2e8f0', 
          cursor: 'row-resize',
          zIndex: 10,
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = '#cbd5e1'}
        onMouseOut={(e) => e.currentTarget.style.background = '#e2e8f0'}
      >
        <div style={{ width: '32px', height: '3px', background: '#94a3b8', borderRadius: '2px' }}></div>
      </div>

      {/* 下半屏幕 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <MiniTabBar
          tabs={bottomTabs}
          activeTabId={bottomActiveTabId}
          onSelectTab={setBottomActiveTabId}
          onCloseTab={handleCloseBottomTab}
          onAddTab={handleAddBottomTab}
        />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <FileListView 
            key={`bottom_${activeBottomTab.id}_${activeBottomTab.currentNav}`}
            category={activeBottomTab.currentNav} 
            taggedFiles={taggedFiles} 
            setTaggedFiles={setTaggedFiles}
            onPreview={onPreview}
            workspacePath={workspacePath}
            setIsGlobalDragging={setIsGlobalDragging}
            setDraggedFile={setDraggedFile}
            smartStats={smartStats}
          />
        </div>
      </div>
    </div>
  );
}
