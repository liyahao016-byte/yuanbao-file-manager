import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

/**
 * ArchiveSetupGuide — 首次使用归档功能的引导配置弹窗
 * 触发时机：用户首次点击「归档本簇」或「快速归档」时，检测到尚未配置归档目录
 * 
 * 三步引导：
 *   Step 1 — 选择归档目录（必选）
 *   Step 2 — 自动检测 Obsidian 仓库 / 手动选择（可选增强）
 *   Step 3 — 确认配置摘要 & 完成
 * 
 * 当前为 UI 原型，所有数据为 mock，不调用 Rust 后端
 */
export default function ArchiveSetupGuide({ onClose, onComplete }) {
  const [step, setStep] = useState(1);

  // Step 1: 归档目录
  const [archivePath, setArchivePath] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);

  // Step 2: Obsidian 检测
  const [obsidianDetected, setObsidianDetected] = useState(false);
  const [obsidianEnabled, setObsidianEnabled] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionDone, setDetectionDone] = useState(false);

  // 选择归档目录 — Tauri 环境用原生目录选择器，浏览器 mock
  const handleSelectDir = async () => {
    setIsSelecting(true);
    try {
      if (window.__TAURI__) {
        const selectedPath = await open({
          directory: true,
          multiple: false,
          title: '选择归档目录',
        });
        if (selectedPath) {
          setArchivePath(selectedPath);
        }
      } else {
        // 浏览器降级 mock
        await new Promise(r => setTimeout(r, 800));
        setArchivePath('/Users/superli/Documents/my-archive');
      }
    } catch (err) {
      console.error('选择目录失败:', err);
    }
    setIsSelecting(false);
  };

  // Step 2 进入时自动检测 Obsidian
  useEffect(() => {
    if (step === 2 && !detectionDone && archivePath) {
      setIsDetecting(true);
      const doDetect = async () => {
        try {
          if (window.__TAURI__) {
            const detected = await invoke('detect_obsidian_vault', { path: archivePath });
            setObsidianDetected(detected);
            setObsidianEnabled(detected);
          } else {
            // 浏览器降级 mock
            await new Promise(r => setTimeout(r, 1500));
            const detected = Math.random() > 0.4;
            setObsidianDetected(detected);
            setObsidianEnabled(detected);
          }
        } catch (err) {
          console.warn('Obsidian 检测失败:', err);
          setObsidianDetected(false);
          setObsidianEnabled(false);
        }
        setIsDetecting(false);
        setDetectionDone(true);
      };
      doDetect();
    }
  }, [step, archivePath]);

  const handleComplete = () => {
    onComplete?.({
      archivePath,
      obsidianEnabled,
      timestamp: new Date().toISOString()
    });
  };

  const canProceedStep1 = archivePath.length > 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '520px', maxWidth: '90%',
        boxShadow: '0 24px 48px -12px rgba(0,0,0,0.15), 0 8px 16px -4px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>🗂️</span>
                配置归档空间
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                首次使用归档功能，需要设置存储位置。只需 {step === 3 ? '' : '几步'}即可完成。
              </p>
            </div>
            <button onClick={onClose} style={{
              fontSize: '18px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1,
              padding: '4px', borderRadius: '6px', background: 'transparent',
              transition: 'all 0.15s ease'
            }}>
              ×
            </button>
          </div>

          {/* 步骤指示器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginTop: '16px' }}>
            {[1, 2, 3].map((s, i) => (
              <React.Fragment key={s}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: step >= s ? 'var(--tag-green, #00b96b)' : '#e2e8f0',
                    color: step >= s ? '#fff' : '#94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: '700',
                    transition: 'all 0.3s ease'
                  }}>
                    {step > s ? '✓' : s}
                  </div>
                  <span style={{
                    fontSize: '12px', fontWeight: step === s ? '600' : '400',
                    color: step === s ? '#0f172a' : '#94a3b8',
                    whiteSpace: 'nowrap'
                  }}>
                    {s === 1 ? '选择目录' : s === 2 ? 'Obsidian 增强' : '确认完成'}
                  </span>
                </div>
                {i < 2 && (
                  <div style={{
                    flex: 1, height: '2px', margin: '0 10px',
                    background: step > s ? 'var(--tag-green, #00b96b)' : '#e2e8f0',
                    borderRadius: '1px', transition: 'all 0.3s ease'
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', minHeight: '220px' }}>

          {/* ===== Step 1: 选择归档目录 ===== */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                归档记录存储在哪里？
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '18px', lineHeight: '1.6' }}>
                选择一个本地文件夹作为归档目录，所有归档记录将以 Markdown 文件保存在此处。
                建议使用独立的文件夹（如 <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>~/Documents/my-archive</code>），方便管理。
              </p>

              {/* 目录选择区域 */}
              <div
                onClick={!isSelecting ? handleSelectDir : undefined}
                style={{
                  border: archivePath ? '2px solid var(--tag-green, #00b96b)' : '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: isSelecting ? 'wait' : 'pointer',
                  background: archivePath ? 'rgba(0, 185, 107, 0.03)' : '#fafbfc',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSelecting ? (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '8px', animation: 'pulse 1.5s ease-in-out infinite' }}>📂</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>正在打开目录选择器...</div>
                  </div>
                ) : archivePath ? (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>已选择归档目录</div>
                    <div style={{
                      fontSize: '12px', color: '#475569', fontFamily: 'monospace',
                      background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px',
                      display: 'inline-block', maxWidth: '100%', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {archivePath}
                    </div>
                    <div
                      onClick={(e) => { e.stopPropagation(); handleSelectDir(); }}
                      style={{ fontSize: '11px', color: '#6366f1', marginTop: '8px', cursor: 'pointer' }}
                    >
                      重新选择
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.8 }}>📂</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
                      点击选择文件夹
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      建议选择 Documents 或云同步目录下的专用文件夹
                    </div>
                  </div>
                )}
              </div>

              {/* 提示 */}
              {archivePath && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  marginTop: '14px', padding: '10px 12px',
                  background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>💡</span>
                  <span style={{ fontSize: '11px', color: '#92400e', lineHeight: '1.5' }}>
                    归档记录以 Markdown 格式存储，可用任何文本编辑器打开。如果该目录已包含 Obsidian 仓库，下一步将自动检测并启用增强模式。
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ===== Step 2: Obsidian 自动检测 ===== */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                Obsidian 增强模式（可选）
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '18px', lineHeight: '1.6' }}>
                如果归档目录是 Obsidian 仓库，将自动启用 wikilinks 双向链接、#tag 标签和 PARA 目录结构等增强特性。
              </p>

              {/* 检测状态 */}
              {isDetecting ? (
                <div style={{
                  padding: '32px', textAlign: 'center',
                  background: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    width: '48px', height: '48px', margin: '0 auto 12px',
                    borderRadius: '50%', background: '#f3e8ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px', animation: 'pulse 1.5s ease-in-out infinite'
                  }}>
                    🔍
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>正在检测归档目录...</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    查找 .obsidian/ 配置文件夹
                  </div>
                </div>
              ) : obsidianDetected ? (
                /* 检测到 Obsidian */
                <div style={{
                  border: '2px solid #a78bfa', borderRadius: '12px', overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '14px 16px', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                    display: 'flex', alignItems: 'center', gap: '10px'
                  }}>
                    <span style={{ fontSize: '20px' }}>🟣</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#5b21b6' }}>
                        检测到 Obsidian 仓库
                      </div>
                      <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '2px' }}>
                        发现 .obsidian/ 配置，可启用增强模式
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    {/* 增强模式开关 */}
                    <div
                      onClick={() => setObsidianEnabled(!obsidianEnabled)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', background: obsidianEnabled ? 'rgba(139, 92, 246, 0.05)' : '#f8fafc',
                        borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a' }}>启用 Obsidian 增强模式</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          自动使用 [[wikilinks]]、#tags 和 PARA 目录
                        </div>
                      </div>
                      {/* Toggle Switch */}
                      <div style={{
                        width: '40px', height: '22px', borderRadius: '11px',
                        background: obsidianEnabled ? '#8b5cf6' : '#cbd5e1',
                        padding: '2px', cursor: 'pointer', transition: 'background 0.2s ease',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '50%',
                          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                          transition: 'transform 0.2s ease',
                          transform: obsidianEnabled ? 'translateX(18px)' : 'translateX(0)'
                        }} />
                      </div>
                    </div>

                    {/* 增强功能列表 */}
                    {obsidianEnabled && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[
                          { icon: '🔗', label: 'Wikilinks 双向链接', desc: '归档记录之间自动建立双链关系' },
                          { icon: '🏷️', label: '#Tag 标签体系', desc: '标签以 Obsidian 原生格式写入 frontmatter' },
                          { icon: '📁', label: 'PARA 目录结构', desc: '按 Projects/Areas/Resources/Archive 组织' },
                        ].map(item => (
                          <div key={item.label} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '8px',
                            padding: '8px 10px', background: '#faf5ff', borderRadius: '6px'
                          }}>
                            <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#5b21b6' }}>{item.label}</div>
                              <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '1px' }}>{item.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* 未检测到 Obsidian */
                <div style={{
                  padding: '20px', textAlign: 'center',
                  background: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📝</div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
                    未检测到 Obsidian 仓库
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.6' }}>
                    将使用标准 Markdown 模式归档。
                    <br />后续如需使用 Obsidian，只需将归档目录设为 Obsidian 仓库即可自动切换。
                  </div>
                </div>
              )}

              {/* 补充说明 */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                marginTop: '14px', padding: '10px 12px',
                background: '#f0f9ff', border: '1px solid #e0f2fe', borderRadius: '8px'
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>ℹ️</span>
                <span style={{ fontSize: '11px', color: '#0369a1', lineHeight: '1.5' }}>
                  Obsidian 增强是可选的锦上添花，不启用也完全不影响归档功能。标准模式下的 .md 文件同样可以被任何 Markdown 编辑器打开。
                </span>
              </div>
            </div>
          )}

          {/* ===== Step 3: 确认配置 ===== */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                配置确认
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '18px', lineHeight: '1.6' }}>
                请确认以下配置信息，完成后即可开始归档。
              </p>

              {/* 配置摘要卡片 */}
              <div style={{
                background: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0',
                overflow: 'hidden'
              }}>
                {/* 归档目录 */}
                <div style={{
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(0, 185, 107, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0
                  }}>📂</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500', marginBottom: '2px' }}>归档目录</div>
                    <div style={{
                      fontSize: '12px', color: '#0f172a', fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {archivePath}
                    </div>
                  </div>
                  <span
                    onClick={() => setStep(1)}
                    style={{ fontSize: '11px', color: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                  >
                    修改
                  </span>
                </div>

                {/* Obsidian 模式 */}
                <div style={{
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: obsidianEnabled ? 'rgba(139, 92, 246, 0.1)' : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0
                  }}>
                    {obsidianEnabled ? '🟣' : '📝'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500', marginBottom: '2px' }}>写入模式</div>
                    <div style={{ fontSize: '12px', color: '#0f172a' }}>
                      {obsidianEnabled ? 'Obsidian 增强模式' : '标准 Markdown 模式'}
                    </div>
                  </div>
                  <span
                    onClick={() => setStep(2)}
                    style={{ fontSize: '11px', color: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                  >
                    修改
                  </span>
                </div>

                {/* 存储格式 */}
                <div style={{
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0
                  }}>💾</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500', marginBottom: '2px' }}>存储策略</div>
                    <div style={{ fontSize: '12px', color: '#0f172a' }}>
                      Markdown 为真 · SQLite 可重建派生索引
                    </div>
                  </div>
                </div>
              </div>

              {/* 完成提示 */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                marginTop: '16px', padding: '12px 14px',
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px'
              }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>🎉</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '2px' }}>
                    配置完成后即可开始归档
                  </div>
                  <div style={{ fontSize: '11px', color: '#15803d', lineHeight: '1.5' }}>
                    归档入口：簇卡片「归档本簇」按钮 ＋ 侧边栏「快速归档」按钮。
                    <br />所有配置后续可在设置中随时修改。
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            步骤 {step} / 3
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{
                  padding: '8px 18px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', background: '#fff',
                  color: '#475569', fontSize: '13px', cursor: 'pointer', fontWeight: '500'
                }}
              >
                上一步
              </button>
            )}
            {step === 1 && (
              <button
                onClick={onClose}
                style={{
                  padding: '8px 18px', borderRadius: '8px',
                  border: '1px solid #e2e8f0', background: '#fff',
                  color: '#475569', fontSize: '13px', cursor: 'pointer', fontWeight: '500'
                }}
              >
                稍后设置
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !canProceedStep1}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  background: (step === 1 && !canProceedStep1) ? '#b3e8cc' : 'var(--tag-green, #00b96b)',
                  color: '#fff', fontSize: '13px',
                  cursor: (step === 1 && !canProceedStep1) ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  boxShadow: (step === 1 && !canProceedStep1) ? 'none' : '0 2px 8px rgba(0, 185, 107, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                下一步
              </button>
            ) : (
              <button
                onClick={handleComplete}
                style={{
                  padding: '8px 24px', borderRadius: '8px', border: 'none',
                  background: 'var(--tag-green, #00b96b)',
                  color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(0, 185, 107, 0.25)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>完成配置</span>
                <span style={{ fontSize: '14px' }}>🚀</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
