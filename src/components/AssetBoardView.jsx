import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import AssetWizardModal from './AssetWizardModal';
import AssetKnowledgeExportModal from './AssetKnowledgeExportModal';

export default function AssetBoardView({ currentNav }) {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('ASSET'); // ASSET, PENDING, ALL
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [showWizard, setShowWizard] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // 1. 初始化加载任务列表
  const loadTasks = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const taskList = await invoke('list_asset_tasks');
        setTasks(taskList);
        if (taskList.length > 0) {
          if (!activeTask || !taskList.find((t) => t.id === activeTask.id)) {
            setActiveTask(taskList[0]);
          }
        }
      } else {
        // Mock数据
        const mockTask = {
          id: 'mock_task_1',
          name: 'QQBrowser_资产沉淀库',
          workspacePath: '/Users/superli/Desktop/aiwork/文件管理器demo',
          status: 'idle',
          policy: {
            tags: ['PRD', '终稿', '评审', 'final'],
            aiDescription: '保留所有跟产品设计、竞品分析相关的终稿方案文档',
          },
          stats: {
            totalFiles: 142,
            assetCount: 28,
            noiseCount: 96,
            pendingCount: 18,
            noiseBytes: 345000000,
          },
        };
        setTasks([mockTask]);
        setActiveTask(mockTask);
      }
    } catch (err) {
      console.error('加载任务失败:', err);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // 2. 加载资产列表
  const loadItems = async () => {
    if (!activeTask) return;
    setLoading(true);
    try {
      if (window.__TAURI_INTERNALS__) {
        if (searchQuery.trim()) {
          const searchRes = await invoke('search_assets', {
            taskId: activeTask.id,
            query: searchQuery,
          });
          setItems(searchRes);
        } else {
          const res = await invoke('query_asset_items', {
            taskId: activeTask.id,
            classification: activeTab === 'ALL' ? null : activeTab,
            keyword: null,
            page: 1,
            pageSize: 100,
          });
          setItems(res.items);
        }
      } else {
        // Mock items
        const mockItems = [
          {
            id: 'item_1',
            taskId: activeTask.id,
            filePath: '/Users/superli/Desktop/aiwork/文件管理器demo/docs/智能资产沉淀_融合方案_PRD_v2.md',
            fileName: '智能资产沉淀_融合方案_PRD_v2.md',
            fileType: 'md',
            fileSize: 32320,
            classification: 'ASSET',
            confidence: 96.0,
            matchRule: 'AI向量契合度 (96%)',
            tags: ['PRD', '终稿'],
            aiSummary: '针对智能资产沉淀功能的完整 PRD 规范，基于 sqlite-vec 向量数据库与 bge-m3 语义搜索',
          },
          {
            id: 'item_2',
            taskId: activeTask.id,
            filePath: '/Users/superli/Desktop/aiwork/文件管理器demo/docs/智能资产沉淀_技术方案.md',
            fileName: '智能资产沉淀_技术方案.md',
            fileType: 'md',
            fileSize: 42720,
            classification: 'ASSET',
            confidence: 94.0,
            matchRule: 'AI向量契合度 (94%)',
            tags: ['技术方案'],
            aiSummary: 'Rust 后端 asset.rs 架构说明与 Tauri 8 大命令签名全集',
          },
          {
            id: 'item_3',
            taskId: activeTask.id,
            filePath: '/Users/superli/Desktop/aiwork/文件管理器demo/src/components/QuickArchiveModal.jsx',
            fileName: 'QuickArchiveModal.jsx',
            fileType: 'jsx',
            fileSize: 16076,
            classification: 'PENDING',
            confidence: 58.0,
            matchRule: 'AI向量比对中等契合 (58%)',
            tags: [],
            aiSummary: '快速归档 UI 原型弹窗组件',
          },
        ];

        if (activeTab === 'ASSET') {
          setItems(mockItems.filter((i) => i.classification === 'ASSET'));
        } else if (activeTab === 'PENDING') {
          setItems(mockItems.filter((i) => i.classification === 'PENDING'));
        } else {
          setItems(mockItems);
        }
      }
    } catch (err) {
      console.error('加载资产列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [activeTask, activeTab, searchQuery]);

  // 3. 执行重新扫描
  const handleRescan = async () => {
    if (!activeTask) return;
    setScanning(true);
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('scan_asset_task', { taskId: activeTask.id });
        await loadTasks();
        await loadItems();
      } else {
        setTimeout(async () => {
          setScanning(false);
          await loadItems();
        }, 1500);
      }
    } catch (err) {
      console.error('扫描失败:', err);
    } finally {
      setScanning(false);
    }
  };

  // 4. 单件裁决
  const handleClassify = async (itemId, newClass) => {
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('classify_asset_item', { itemId, classification: newClass });
        await loadTasks();
        await loadItems();
      } else {
        setItems(items.map((i) => (i.id === itemId ? { ...i, classification: newClass } : i)));
      }
    } catch (err) {
      console.error('裁决失败:', err);
    }
  };

  // 5. 批量裁决
  const handleBatchClassify = async (newClass) => {
    if (selectedIds.length === 0) return;
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('batch_classify_assets', { itemIds: selectedIds, classification: newClass });
        setSelectedIds([]);
        await loadTasks();
        await loadItems();
      } else {
        setItems(items.map((i) => (selectedIds.includes(i.id) ? { ...i, classification: newClass } : i)));
        setSelectedIds([]);
      }
    } catch (err) {
      console.error('批量裁决失败:', err);
    }
  };

  // 打开 Finder
  const handleOpenFolder = (path) => {
    if (window.__TAURI_INTERNALS__) {
      invoke('reveal_in_finder', { path });
    }
  };

  const stats = activeTask?.stats || { totalFiles: 0, assetCount: 0, noiseCount: 0, pendingCount: 0, noiseBytes: 0 };
  const savedMb = (stats.noiseBytes / (1024 * 1024)).toFixed(1);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
      {/* 顶部 Header */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            color: '#fff',
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)',
          }}>
            💎
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={activeTask?.id || ''}
                onChange={(e) => {
                  const found = tasks.find((t) => t.id === e.target.value);
                  if (found) setActiveTask(found);
                }}
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#0f172a',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                }}
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              📂 {activeTask?.workspacePath || '选定工作区'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowWizard(true)}
            style={{
              padding: '8px 14px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            ➕ 新增工作区
          </button>
          <button
            onClick={handleRescan}
            disabled={scanning}
            style={{
              padding: '8px 14px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              cursor: scanning ? 'not-allowed' : 'pointer',
            }}
          >
            {scanning ? '⏳ 向量扫描中...' : '🔄 重新扫描'}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            style={{
              padding: '8px 18px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
            }}
          >
            📖 生成知识库 / Obsidian
          </button>
        </div>
      </div>

      {/* 看板主体 */}
      <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 统计指标面板 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          {[
            { label: '工作区总文件', value: stats.totalFiles, unit: '个', color: '#3b82f6', bg: '#eff6ff' },
            { label: '保留资产 (ASSET)', value: stats.assetCount, unit: '个', color: '#10b981', bg: '#ecfdf5' },
            { label: '过滤噪声 (NOISE)', value: stats.noiseCount, unit: '个', color: '#64748b', bg: '#f8fafc' },
            { label: '待裁决 (PENDING)', value: stats.pendingCount, unit: '个', color: '#f59e0b', bg: '#fffbeb' },
            { label: '净化节省空间', value: savedMb, unit: 'MB', color: '#8b5cf6', bg: '#f5f3ff' },
          ].map((card, i) => (
            <div key={i} style={{
              backgroundColor: '#ffffff',
              padding: '14px 18px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{card.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: card.color, marginTop: '6px' }}>
                {card.value} <span style={{ fontSize: '12px', fontWeight: '400', color: '#94a3b8' }}>{card.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 搜索与过滤 Tab */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '14px 18px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}>
          {/* 三级 Tab */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            {[
              { id: 'ASSET', label: `已保留资产 (${stats.assetCount})` },
              { id: 'PENDING', label: `待确认裁决 (${stats.pendingCount})` },
              { id: 'ALL', label: `全量列表 (${stats.totalFiles})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === tab.id ? '#ffffff' : 'transparent',
                  color: activeTab === tab.id ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 向量 + 关键词混合搜索框 */}
          <div style={{ flex: 1, maxWidth: '360px', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 输入自然语言或关键词进行 AI 混合搜索..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                backgroundColor: '#f8fafc',
              }}
            />
            <span style={{ position: 'absolute', left: '10px', top: '8px', fontSize: '13px', color: '#94a3b8' }}>🔍</span>
          </div>
        </div>

        {/* 批量裁决控制栏 */}
        {activeTab === 'PENDING' && items.length > 0 && (
          <div style={{
            padding: '10px 16px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: '600' }}>
              <span>⚠️ 待确认资产区：请核对并批量裁决</span>
              <span>(已选 {selectedIds.length} 项)</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleBatchClassify('ASSET')}
                disabled={selectedIds.length === 0}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: selectedIds.length === 0 ? 0.5 : 1,
                }}
              >
                ✅ 批量保留为资产
              </button>
              <button
                onClick={() => handleBatchClassify('NOISE')}
                disabled={selectedIds.length === 0}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: selectedIds.length === 0 ? 0.5 : 1,
                }}
              >
                🗑️ 批量标记为噪声
              </button>
            </div>
          </div>
        )}

        {/* 资产卡片列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
              ⚡ 正在从向量数据库查询匹配条目...
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '12px', color: '#94a3b8', fontSize: '13px' }}>
              🍃 当前分类下暂无符合条件的文件
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {activeTab === 'PENDING' && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                            else setSelectedIds(selectedIds.filter((x) => x !== item.id));
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      )}
                      <span style={{ fontSize: '16px' }}>📄</span>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{item.fileName}</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: item.classification === 'ASSET' ? '#dcfce7' : item.classification === 'PENDING' ? '#fef3c7' : '#f1f5f9',
                        color: item.classification === 'ASSET' ? '#15803d' : item.classification === 'PENDING' ? '#b45309' : '#64748b',
                      }}>
                        {item.classification === 'ASSET' ? '💎 保留资产' : item.classification === 'PENDING' ? '❓ 待确认' : '🗑️ 噪声'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: '600', backgroundColor: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>
                        {item.matchRule || `置信度 ${item.confidence}%`}
                      </span>
                      <button
                        onClick={() => handleOpenFolder(item.filePath)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          color: '#475569',
                        }}
                      >
                        📂 定位原文件
                      </button>
                    </div>
                  </div>

                  {item.aiSummary && (
                    <div style={{ fontSize: '12px', color: '#475569', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', lineHeight: '1.4' }}>
                      <b>AI 摘要</b>: {item.aiSummary}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '12px' }}>
                      <span>路径: {item.filePath}</span>
                      <span>大小: {(item.fileSize / 1024).toFixed(1)} KB</span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {item.classification !== 'ASSET' && (
                        <button
                          onClick={() => handleClassify(item.id, 'ASSET')}
                          style={{
                            padding: '3px 10px',
                            backgroundColor: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#047857',
                            cursor: 'pointer',
                            fontWeight: '600',
                          }}
                        >
                          标记为资产
                        </button>
                      )}
                      {item.classification !== 'NOISE' && (
                        <button
                          onClick={() => handleClassify(item.id, 'NOISE')}
                          style={{
                            padding: '3px 10px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#b91c1c',
                            cursor: 'pointer',
                          }}
                        >
                          标记为噪声
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 向导弹窗 */}
      {showWizard && (
        <AssetWizardModal
          onClose={() => setShowWizard(false)}
          onTaskCreated={async () => {
            setShowWizard(false);
            await loadTasks();
            await loadItems();
          }}
        />
      )}

      {/* 导出导出弹窗 */}
      {showExportModal && activeTask && (
        <AssetKnowledgeExportModal
          task={activeTask}
          onClose={() => setShowExportModal(false)}
          onExportSuccess={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
