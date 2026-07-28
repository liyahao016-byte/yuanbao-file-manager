import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function GroupNamingModal({ stagedFiles, workspacePath, onClose, onConfirm }) {
  const [folderName, setFolderName] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch AI smart naming recommendation on mount
  const fetchAiSuggestions = async () => {
    setIsAiLoading(true);
    try {
      const paths = stagedFiles.map(f => f.path).filter(Boolean);
      if (paths.length > 0 && window.__TAURI_INTERNALS__) {
        const suggestions = await invoke('generate_smart_group_name', { paths });
        if (suggestions && suggestions.length > 0) {
          setAiSuggestions(suggestions);
          setFolderName(suggestions[0]);
        }
      }
    } catch (err) {
      console.error('AI smart naming failed:', err);
      // Fallback name
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fallback = `归档打包_${timestamp}`;
      setFolderName(fallback);
      setAiSuggestions([fallback, `聚合资料_${timestamp}`]);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    fetchAiSuggestions();
  }, []);

  const handleConfirm = async () => {
    const name = folderName.trim();
    if (!name) return;

    setIsSubmitting(true);
    try {
      const paths = stagedFiles.map(f => f.path).filter(Boolean);
      let createdPath = '';
      if (window.__TAURI_INTERNALS__) {
        createdPath = await invoke('create_aggregate_folder', {
          paths,
          folderName: name,
          targetDir: workspacePath || null
        });
      }
      onConfirm(name, createdPath);
    } catch (err) {
      console.error('Failed to create aggregate folder:', err);
      alert('创建打包文件夹失败: ' + err);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '420px',
          maxWidth: '90vw',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'dropzone-appear 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📦</span>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>
                打包聚合归类
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                共 {stagedFiles.length} 个文件存入新智能文件夹
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: '#94a3b8',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* AI Recommendation Banner */}
          <div
            style={{
              background: isAiLoading ? 'rgba(0, 122, 255, 0.05)' : 'rgba(0, 185, 107, 0.08)',
              border: isAiLoading ? '1px solid rgba(0, 122, 255, 0.2)' : '1px solid rgba(0, 185, 107, 0.25)',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: isAiLoading ? '#007aff' : '#00b96b' }}>
                <span>✨</span>
                <span>{isAiLoading ? 'AI 正在分析收纳区文件并拟定主题...' : 'AI 推荐聚合主题名'}</span>
              </div>
              <button
                onClick={fetchAiSuggestions}
                disabled={isAiLoading}
                title="重新生成"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: '#64748b',
                  cursor: isAiLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ display: 'inline-block', transform: isAiLoading ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s linear' }}>
                  🔄
                </span>
                <span>重试</span>
              </button>
            </div>

            {/* AI Suggestion Tag Chips */}
            {!isAiLoading && aiSuggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                {aiSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFolderName(sug)}
                    style={{
                      background: folderName === sug ? '#00b96b' : '#ffffff',
                      color: folderName === sug ? '#ffffff' : '#334155',
                      border: folderName === sug ? 'none' : '1px solid #cbd5e1',
                      borderRadius: '14px',
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: folderName === sug ? '0 2px 6px rgba(0,185,107,0.3)' : 'none',
                    }}
                  >
                    {idx === 0 ? '🏆 ' : ''}{sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name Input Field */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              文件夹名称 (可手动修改):
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="请输入聚合文件夹名称..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: '600',
                color: '#0f172a',
                outline: 'none',
                transition: 'border 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#00b96b'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !folderName.trim()}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#00b96b',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isSubmitting || !folderName.trim() ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0,185,107,0.3)',
              opacity: isSubmitting || !folderName.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isSubmitting ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>创建中...</span>
              </>
            ) : (
              <>
                <span>确定打包</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
