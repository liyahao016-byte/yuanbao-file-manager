import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const PRESET_TEMPLATES = [
  {
    id: 'pm',
    name: '产品经理工作区',
    icon: '📊',
    desc: '保留 PRD、终稿、评审、竞品分析，自动过滤草稿和临时截图',
    tags: ['PRD', '终稿', '评审', '竞品', 'v3', 'final'],
    excludeDirs: ['node_modules', '.git', 'dist', 'temp'],
    excludePatterns: ['*.tmp', '*.log', '~*'],
    includeTypes: ['.pdf', '.docx', '.pptx', '.xlsx', '.md'],
    aiDescription: '我想保留所有跟产品设计、竞品分析相关的终稿方案文档，过滤掉临时会议截图和草稿',
  },
  {
    id: 'design',
    name: '设计师工作区',
    icon: '🎨',
    desc: '保留最终交付的设计稿、标注文件，过滤草稿副本',
    tags: ['交付', '定稿', '标注', 'final', 'v2'],
    excludeDirs: ['.git', 'cache', 'node_modules'],
    excludePatterns: ['*_副本*', '*_draft*', '*.tmp'],
    includeTypes: ['.png', '.jpg', '.svg', '.psd', '.fig', '.pdf'],
    aiDescription: '保留所有最终交付的 UI 设计稿、图标标注和高清效果图，忽略草稿过程图',
  },
  {
    id: 'dev',
    name: '研发工程区',
    icon: '💻',
    desc: '保留架构文档、核心源码与 API 定义，过滤构建产物',
    tags: ['README', '架构', 'API', 'spec', 'release', 'config'],
    excludeDirs: ['node_modules', '.git', 'dist', 'build', 'target', '.next', 'coverage'],
    excludePatterns: ['*.log', '*.lock', '*.tmp'],
    includeTypes: ['.ts', '.tsx', '.rs', '.py', '.go', '.java', '.md', '.yaml'],
    aiDescription: '保留核心源码文件、架构设计说明和 API 定义规范，过滤构建编译中间产物和日志',
  },
  {
    id: 'general',
    name: '通用知识库',
    icon: '📚',
    desc: '保留有复用价值的笔记、总结与复盘文件',
    tags: ['笔记', '总结', '复盘', '核心', '知识'],
    excludeDirs: ['node_modules', '.git', 'dist'],
    excludePatterns: ['*.tmp', '*.log', '~*'],
    includeTypes: [],
    aiDescription: '保留有长期学习与复用价值的笔记、总结报告与会议复盘资料',
  },
];

export default function AssetWizardModal({ onClose, onTaskCreated }) {
  const [step, setStep] = useState(1); // 1: 选工作区, 2: 定规则, 3: 扫描与确认
  const [taskName, setTaskName] = useState('我的智能资产库');
  const [workspacePath, setWorkspacePath] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('pm');
  
  // 规则配置
  const [tags, setTags] = useState(['PRD', '终稿', '评审', 'final']);
  const [tagInput, setTagInput] = useState('');
  const [excludeDirs, setExcludeDirs] = useState(['node_modules', '.git', 'dist', 'build']);
  const [excludePatterns, setExcludePatterns] = useState(['*.log', '*.tmp', '~*']);
  const [aiDescription, setAiDescription] = useState('我想保留所有跟产品方案、竞品分析相关的终稿文档，过滤掉临时草稿');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 切换模板
  const applyTemplate = (tmpl) => {
    setSelectedTemplate(tmpl.id);
    setTags(tmpl.tags);
    setExcludeDirs(tmpl.excludeDirs);
    setExcludePatterns(tmpl.excludePatterns);
    if (tmpl.aiDescription) setAiDescription(tmpl.aiDescription);
  };

  // 选择文件夹
  const handleSelectFolder = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: '选择沉淀工作区文件夹',
        });
        if (selected) {
          const path = Array.isArray(selected) ? selected[0] : selected;
          setWorkspacePath(path);
          const folderName = path.split('/').pop() || '工作区';
          setTaskName(`${folderName}_资产库`);
        }
      } else {
        // 浏览器 Dev 模式 mock
        const mockPath = '/Users/demo/Documents/Projects/QQBrowser';
        setWorkspacePath(mockPath);
        setTaskName('QQBrowser_资产库');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 添加标签
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  // 创建任务并开始扫描
  const handleCreateAndScan = async () => {
    if (!workspacePath) {
      setError('请先选择工作区文件夹');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (window.__TAURI_INTERNALS__) {
        const task = await invoke('create_asset_task', {
          name: taskName,
          workspacePath,
          policyTags: tags,
          policyFilters: [],
          policyTemplate: selectedTemplate,
          excludeDirs,
          excludePatterns,
          includeTypes: [],
          aiDescription,
        });

        // 触发并发向量扫描
        await invoke('scan_asset_task', { taskId: task.id });
        onTaskCreated(task);
      } else {
        // Mock 创建
        setTimeout(() => {
          onTaskCreated({
            id: 'mock_task_1',
            name: taskName,
            workspacePath: workspacePath || '/Users/demo/Projects/QQBrowser',
            stats: { totalFiles: 86, assetCount: 18, noiseCount: 52, pendingCount: 16, noiseBytes: 24500000 },
          });
        }, 1200);
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : '创建沉淀任务失败');
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
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
    }}>
      <div style={{
        width: '680px',
        maxHeight: '90vh',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}>
              💎
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                创建智能资产沉淀任务
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                基于 sqlite-vec 向量数据库与 AI 混合检索，筛选高价值文件
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#94a3b8',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Step Navigation Bar */}
        <div style={{
          display: 'flex',
          padding: '12px 24px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          gap: '8px',
        }}>
          {[
            { num: 1, label: '1. 选择工作区' },
            { num: 2, label: '2. 规则与 AI 意图' },
            { num: 3, label: '3. 扫描与建立索引' },
          ].map((s) => (
            <div
              key={s.num}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                textAlign: 'center',
                backgroundColor: step === s.num ? '#ffffff' : 'transparent',
                color: step === s.num ? '#4f46e5' : '#64748b',
                boxShadow: step === s.num ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px', display: 'block' }}>
                  工作区名称
                </label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  placeholder="例如：QQ浏览器文件管理器项目"
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px', display: 'block' }}>
                  目标文件夹路径
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={workspacePath}
                    onChange={(e) => setWorkspacePath(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      backgroundColor: '#f8fafc',
                    }}
                    placeholder="请选择或粘贴本地工作区路径..."
                  />
                  <button
                    onClick={handleSelectFolder}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                    }}
                  >
                    📁 浏览...
                  </button>
                </div>
              </div>

              {/* 预设模板选择 */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '10px', display: 'block' }}>
                  选择预设沉淀模板
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      onClick={() => applyTemplate(tmpl)}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        border: selectedTemplate === tmpl.id ? '2px solid #6366f1' : '1px solid #e2e8f0',
                        backgroundColor: selectedTemplate === tmpl.id ? '#f5f3ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '18px' }}>{tmpl.icon}</span>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{tmpl.name}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                        {tmpl.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* 正向规则标签 */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px', display: 'block' }}>
                  正向保留标签（命中即标记为资产）
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        backgroundColor: '#e0e7ff',
                        color: '#3730a3',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    >
                      #{t}
                      <span
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                        style={{ cursor: 'pointer', opacity: 0.6 }}
                      >
                        ✕
                      </span>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="输入标签关键词（如：终稿、v3、评审），按回车添加..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                    }}
                  />
                  <button
                    onClick={handleAddTag}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    添加
                  </button>
                </div>
              </div>

              {/* 自然语言 AI 描述 */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px', display: 'block' }}>
                  🤖 AI 自然语言描述（用于向量语义比对）
                </label>
                <textarea
                  rows={3}
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #a5b4fc',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#faf5ff',
                    lineHeight: '1.5',
                  }}
                  placeholder="用一句话描述您想保留什么样的文件，系统将生成向量与正文比对..."
                />
              </div>

              {/* 排除规则 */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px', display: 'block' }}>
                  排除的目录与后缀黑名单
                </label>
                <div style={{ fontSize: '12px', color: '#64748b', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                  <div><b>目录排除</b>: {excludeDirs.join(', ')}</div>
                  <div style={{ marginTop: '4px' }}><b>后缀/模式</b>: {excludePatterns.join(', ')}</div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                准备开始基于向量数据库的智能沉淀
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.6' }}>
                系统将全量扫描工作区文件夹，通过 <b>bge-m3 向量嵌入</b> 与余弦相似度匹配，在数秒内自动归类资产与噪声文件。
              </div>

              <div style={{
                backgroundColor: '#f1f5f9',
                padding: '16px',
                borderRadius: '10px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#334155',
                marginBottom: '20px',
              }}>
                <div>📍 <b>目标工作区</b>: {workspacePath || '未选择'}</div>
                <div style={{ marginTop: '6px' }}>🏷️ <b>命中规则</b>: {tags.map(t => `#${t}`).join(' ')}</div>
                <div style={{ marginTop: '6px' }}>🤖 <b>向量意图</b>: {aiDescription}</div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
        }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              上一步
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: '10px' }}>
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

            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && !workspacePath) {
                    setError('请先选择工作区文件夹');
                    return;
                  }
                  setError('');
                  setStep(step + 1);
                }}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                }}
              >
                下一步
              </button>
            ) : (
              <button
                onClick={handleCreateAndScan}
                disabled={loading}
                style={{
                  padding: '8px 24px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '⚡ 正在向量扫描中...' : '🚀 开始智能沉淀'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
