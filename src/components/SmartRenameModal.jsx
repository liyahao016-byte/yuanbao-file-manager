import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function SmartRenameModal({ selectedFiles, onClose, onConfirm }) {
  const [status, setStatus] = useState('loading'); // 'loading', 'preview'
  const [previews, setPreviews] = useState([]);

  const generatePreviews = async () => {
    try {
      const newPreviews = await Promise.all(
        selectedFiles.map(async (f, index) => {
          let newName = f.name;
          let detectedType = "其他";
          let template = "{内容摘要关键词}-{来源}-{日期}";

          // If running in Tauri environment, call Ollama
          if (window.__TAURI_INTERNALS__) {
            try {
              // 传入真实文件路径与原文件名给后端
              const aiResult = await invoke('rename_with_ai', { path: f.path, name: f.name });
              newName = aiResult;
              detectedType = "AI智能提取";
              template = "{动态实体抽取}";
            } catch (err) {
              console.error("AI Rename failed:", err);
            }
          } else {
            // Mock fallback
            newName = `AI_renamed_${index}_${f.name}`;
          }

          return {
            id: f.id,
            path: f.path,
            oldName: f.name,
            newName: newName,
            detectedType,
            template
          };
        })
      );
      setPreviews(newPreviews);
      setStatus('preview');
    } catch (e) {
      console.error(e);
      setStatus('preview');
    }
  };

  useEffect(() => {
    generatePreviews();
  }, []);

  if (selectedFiles.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, 
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '760px', maxWidth: '90%', 
        boxShadow: '0 20px 24px -4px rgba(0,0,0,0.1), 0 8px 10px -4px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', fontWeight: '600' }}>
            <span style={{ color: 'var(--tag-green)', marginRight: '8px', fontSize: '20px' }}>✨</span>
            AI 智能批量重命名
          </h2>
          <button onClick={onClose} style={{ fontSize: '20px', color: '#999', cursor: 'pointer' }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', background: '#f8f9fa' }}>
          
          <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            AI 将根据内容特征，自动匹配对应的分层模板体系进行语义化命名。
          </div>

          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              <div style={{ flex: 1.2 }}>原文件名</div>
              <div style={{ flex: 1 }}>识别类型与模板</div>
              <div style={{ width: '32px', textAlign: 'center' }}></div>
              <div style={{ flex: 1.5 }}>新文件名 (预览)</div>
            </div>
            
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {status === 'loading' ? (
                // 骨架屏扫描动效
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div className="skeleton-scan" style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', background: '#e6f7ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✨</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>提取内容与元数据中...</div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>正在匹配底层分发模板</div>
                </div>
              ) : (
                previews.map((p) => (
                  <div key={p.id} style={{ display: 'flex', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', alignItems: 'center', fontSize: '13px' }}>
                    <div style={{ flex: 1.2, color: '#999', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>
                      {p.oldName}
                    </div>
                    
                    {/* 分层模板展示 */}
                    <div style={{ flex: 1, paddingRight: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', background: '#f0f5ff', color: '#1890ff', borderRadius: '4px', fontSize: '11px', fontWeight: '500', width: 'fit-content' }}>
                        {p.detectedType}
                      </span>
                      <span style={{ fontSize: '11px', color: '#bfbfbf', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.template}
                      </span>
                    </div>

                    <div style={{ width: '32px', textAlign: 'center', color: 'var(--tag-green)' }}>➔</div>
                    
                    <div style={{ flex: 1.5, color: 'var(--text-primary)', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: '8px' }}>
                      {p.newName}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#999', marginTop: '12px', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '6px' }}>ℹ️</span> 模板优先级高于自由生成，以保证命名一致性。无法解析或机密文件将不生成建议。
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fff' }}>
          <button 
            onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}
          >
            取消
          </button>
          <button 
            onClick={() => onConfirm(previews)}
            disabled={status === 'loading'}
            style={{ 
              padding: '8px 20px', borderRadius: '6px', border: 'none', 
              background: status === 'loading' ? '#b3e8cc' : 'var(--tag-green)', 
              color: '#fff', fontSize: '14px', cursor: status === 'loading' ? 'not-allowed' : 'pointer', 
              fontWeight: '500', boxShadow: status === 'loading' ? 'none' : '0 2px 6px rgba(0, 185, 107, 0.3)'
            }}
          >
            {status === 'loading' ? '正在匹配...' : '确认应用模板'}
          </button>
        </div>
      </div>
    </div>
  );
}
