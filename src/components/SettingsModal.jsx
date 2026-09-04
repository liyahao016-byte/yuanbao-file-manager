import React, { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, onSyncEmbeddings, onResetWorkspace, workspacePath }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, filename: '', percent: 0 });

  useEffect(() => {
    let unlisten = null;
    if (window.__TAURI_INTERNALS__ && window.__TAURI__?.event) {
      window.__TAURI__.event.listen('vec_sync_progress', (event) => {
        const payload = event.payload;
        if (payload) {
          const current = payload.current || 0;
          const total = payload.total || 1;
          const percent = Math.min(100, Math.round((current / total) * 100));
          setSyncProgress({
            current,
            total,
            filename: payload.filename || '',
            percent
          });
        }
      }).then(fn => { unlisten = fn; });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!isOpen) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus('正在扫描工作区文件与计算增量 Embedding 向量...');
    setSyncProgress({ current: 0, total: 0, filename: '准备扫描文件...', percent: 0 });

    // 浏览器 Web 预览模式平滑模拟进度
    let simulatedInterval = null;
    if (!window.__TAURI_INTERNALS__) {
      let step = 0;
      const totalSimulated = 18;
      simulatedInterval = setInterval(() => {
        step += 1;
        const current = Math.min(totalSimulated, step);
        const percent = Math.min(100, Math.round((current / totalSimulated) * 100));
        setSyncProgress({
          current,
          total: totalSimulated,
          filename: `示例文件_${current}.docx`,
          percent
        });
        if (current >= totalSimulated) {
          clearInterval(simulatedInterval);
        }
      }, 100);
    }

    try {
      let count = 0;
      if (onSyncEmbeddings) {
        count = await onSyncEmbeddings();
      }
      setSyncStatus(`✅ 已成功构建并同步 ${count ?? 0} 个文件的向量索引！`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      setSyncStatus('❌ 同步失败: ' + err);
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      if (simulatedInterval) clearInterval(simulatedInterval);
      setIsSyncing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#ffffff',
        width: '480px',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
            }}>⚙️</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>设置与管理</h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', marginTop: '2px' }}>AI 向量索引引擎与工作区存储授权</p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: '18px', padding: '4px 8px', borderRadius: '6px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Feature Card 1: Vector Index Sync */}
          <div style={{
            padding: '16px', borderRadius: '12px',
            border: '1px solid #e2e8f0', background: '#f8fafc',
            display: 'flex', flexDirection: 'column', gap: '10px',
            transition: 'all 0.15s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⚡️</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>更新向量库索引</span>
              </div>
              <span style={{
                fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'
              }}>Ollama 算法就绪</span>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
              扫描工作区中的未向量化文件，生成 1024 维 Embedding 向量。用于语义搜索、智能分类与场景聚类。
            </p>

            {/* 实时进度条展示 */}
            {isSyncing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: '#1e293b' }}>
                  <span>⏳ {syncProgress.total > 0 ? `正在处理: ${syncProgress.current} / ${syncProgress.total} 项` : '正在进行全盘对比分析...'}</span>
                  <span style={{ color: 'var(--tag-green)' }}>{syncProgress.percent}%</span>
                </div>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${syncProgress.percent}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', transition: 'width 0.2s ease' }} />
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {syncProgress.filename ? `📄 ${syncProgress.filename}` : '读取文本特征与向量映射...'}
                </div>
              </div>
            )}

            {syncStatus && !isSyncing && (
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '6px', textAlign: 'center' }}>
                {syncStatus}
              </div>
            )}

            <button
              onClick={handleSync}
              disabled={isSyncing}
              style={{
                marginTop: '4px', padding: '9px 16px', borderRadius: '8px',
                border: 'none', background: isSyncing ? '#cbd5e1' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff', fontSize: '12px', fontWeight: '700', cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                boxShadow: isSyncing ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.15s'
              }}
            >
              {isSyncing ? '⏳ 正在增量向量化中...' : '⚡️ 立即更新向量库'}
            </button>
          </div>

          {/* Feature Card 2: Workspace Authorization */}
          <div style={{
            padding: '16px', borderRadius: '12px',
            border: '1px solid #e2e8f0', background: '#f8fafc',
            display: 'flex', flexDirection: 'column', gap: '10px',
            transition: 'all 0.15s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📁</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>授权与切换工作区</span>
              </div>
              <span style={{
                fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'
              }}>已授权管理</span>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
              当前绑定的工作区目录:
            </p>
            <div style={{
              fontSize: '11px', fontFamily: 'monospace', color: '#334155', background: '#e2e8f0',
              padding: '6px 10px', borderRadius: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {workspacePath || '未指定（全盘管理模式）'}
            </div>

            <button
              onClick={() => {
                if (onResetWorkspace) onResetWorkspace();
                onClose();
              }}
              style={{
                marginTop: '4px', padding: '8px 16px', borderRadius: '8px',
                border: '1px solid #cbd5e1', background: '#ffffff',
                color: '#334155', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
            >
              🔄 重新授权 / 切换工作区路径
            </button>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa',
          display: 'flex', justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 18px', borderRadius: '6px', border: '1px solid #cbd5e1',
              background: '#ffffff', color: '#475569', fontSize: '12px', fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
