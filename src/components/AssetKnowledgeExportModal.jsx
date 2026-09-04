import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function AssetKnowledgeExportModal({ task, onClose, onExportSuccess }) {
  const [kbName, setKbName] = useState(`${task?.name || '工作区'}_知识库`);
  const [obsidianMode, setObsidianMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultPath, setResultPath] = useState('');
  const [error, setError] = useState('');

  const handleExport = async () => {
    setLoading(true);
    setError('');

    try {
      if (window.__TAURI_INTERNALS__) {
        const result = await invoke('generate_knowledge_base', {
          taskId: task.id,
          kbName,
          outputDir: null, // default to workspace path
          obsidianMode,
        });
        setResultPath(result.outputPath);
        if (onExportSuccess) onExportSuccess(result);
      } else {
        // Dev mock
        setTimeout(() => {
          setResultPath(`${task?.workspacePath || '/Users/demo/Documents'}/${kbName}.md`);
        }, 1000);
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : '生成知识库失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
    }}>
      <div style={{
        width: '520px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>📖</span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                一键整合生成知识库文档
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                将已保留的资产整合为结构化 Markdown / Obsidian 双链
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div style={{ padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#ef4444', fontSize: '12px' }}>
              ⚠️ {error}
            </div>
          )}

          {resultPath ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎉</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                知识库文档生成成功！
              </div>
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                wordBreak: 'break-all',
                color: '#334155',
                marginBottom: '16px',
              }}>
                📄 {resultPath}
              </div>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 24px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                完成
              </button>
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px', display: 'block' }}>
                  文档标题
                </label>
                <input
                  type="text"
                  value={kbName}
                  onChange={(e) => setKbName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px', display: 'block' }}>
                  格式模式选择
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div
                    onClick={() => setObsidianMode(true)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: obsidianMode ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      backgroundColor: obsidianMode ? '#f5f3ff' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>💎 Obsidian 模式</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>包含 [[双链]] 引用 + 原生 #标签 + YAML 报头</div>
                  </div>
                  <div
                    onClick={() => setObsidianMode(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: !obsidianMode ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      backgroundColor: !obsidianMode ? '#f5f3ff' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>📄 标准 / Agent 上下文</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>通用纯 Markdown 格式，适合直接喂给 Agent</div>
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#f1f5f9',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#475569',
                lineHeight: '1.5',
              }}>
                💡 生成的文档将直接写入工作区根目录，涵盖选定资产的正文摘要、结构化索引及表格元数据。
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!resultPath && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: '#ffffff',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={loading}
              style={{
                padding: '8px 20px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '⏳ 正在生成中...' : '🚀 立即生成知识库'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
