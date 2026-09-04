import React, { useState } from 'react';

export default function FormatConvertView({ workspacePath }) {
  const [selectedDirection, setSelectedDirection] = useState('PDF → Word');
  const [selectedFile, setSelectedFile] = useState({
    name: '李雅浩-个人简历2026.pdf',
    size: '1.4 MB',
    format: 'PDF'
  });
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const DIRECTIONS = [
    { id: 'PDF → Word', icon: '📝', desc: '转为可编辑 Word (.docx)' },
    { id: 'Word → PDF', icon: '📄', desc: '高保真转为 PDF' },
    { id: 'PDF → Excel', icon: '📊', desc: '提取表格到 Excel (.xlsx)' },
    { id: 'PPT → PDF', icon: '📊', desc: '演示文稿转为 PDF' },
    { id: '图片 → PDF', icon: '🖼️', desc: '多图合并转 PDF' },
    { id: 'PDF → 图片', icon: '🖼️', desc: '导出为高清 PNG / JPG' },
  ];

  const handleStartConvert = () => {
    setIsConverting(true);
    setProgress(0);
    setIsCompleted(false);

    let current = 0;
    const interval = setInterval(() => {
      current += 20;
      if (current >= 100) {
        setProgress(100);
        setIsConverting(false);
        setIsCompleted(true);
        clearInterval(interval);
      } else {
        setProgress(current);
      }
    }, 180);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflowY: 'auto' }}>
      
      {/* 顶部 Header Banner */}
      <div style={{
        padding: '20px 28px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
          }}>🔄</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>格式转换与文档优化</h2>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245,158,11,0.1)', color: '#d97706', fontWeight: '600' }}>
                本地高速离线处理
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              支持 PDF、Word、PPT、Excel、图片格式高保真转换，格式字体无损还原
            </p>
          </div>
        </div>
      </div>

      {/* 1. 转换方向网格选择栏 */}
      <div style={{ padding: '20px 28px 0' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
          选择转换类型
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          {DIRECTIONS.map(d => {
            const isActive = selectedDirection === d.id;
            return (
              <div
                key={d.id}
                onClick={() => setSelectedDirection(d.id)}
                style={{
                  padding: '12px 10px', borderRadius: '10px',
                  background: isActive ? 'rgba(245,158,11,0.08)' : '#ffffff',
                  border: isActive ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                  boxShadow: isActive ? '0 2px 8px rgba(245,158,11,0.15)' : '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{d.icon}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: isActive ? '#d97706' : '#1e293b' }}>{d.id}</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{d.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 主工作区网格 (文件拖拽/选择区 + 转换设置面板) */}
      <div style={{ padding: '20px 28px 28px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px', flex: 1 }}>
        
        {/* 左侧：文件选择与拖拽 Dropzone */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
              添加需要转换的文件 [{selectedDirection}]
            </h3>
          </div>

          <div style={{
            border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '36px 20px',
            textAlign: 'center', background: '#f8fafc', cursor: 'pointer', transition: 'all 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#f59e0b'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📁</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>拖拽文件到此处，或点击添加文件</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>支持批量添加，单个文件最大支持 2GB</div>
          </div>

          {/* 预选示例文件列表 */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>待转换队列:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { name: '李雅浩-个人简历2026.pdf', size: '1.4 MB', format: 'PDF' },
                { name: '垃圾清理扫描与结束页分析.docx', size: '820 KB', format: 'DOCX' },
                { name: '财务收支明细执行表.xlsx', size: '2.1 MB', format: 'XLSX' }
              ].map(f => (
                <div
                  key={f.name}
                  onClick={() => setSelectedFile(f)}
                  style={{
                    padding: '10px 14px', borderRadius: '8px',
                    border: selectedFile.name === f.name ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                    background: selectedFile.name === f.name ? 'rgba(245,158,11,0.06)' : '#ffffff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>📄</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>{f.name}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{f.size} · 格式: {f.format}</div>
                    </div>
                  </div>
                  {selectedFile.name === f.name && <span style={{ color: '#d97706', fontSize: '14px', fontWeight: '700' }}>已选中</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：转换设置与导出面板 */}
        <div style={{
          background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>转换输出设置</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>输出保存位置</label>
              <select style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#334155' }}>
                <option>默认桌面 (sys:desktop)</option>
                <option>与源文件同目录</option>
                <option>下载文件夹 (sys:downloads)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>图像与排版质量</label>
              <select style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#334155' }}>
                <option>超清还原 (300 DPI 适合打印)</option>
                <option>标准质量 (150 DPI 体积均衡)</option>
                <option>极速压缩 (适合网络传输)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>开启 OCR 扫描文档识别</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>支持图片版扫描件提取可编辑文字</div>
              </div>
              <input type="checkbox" defaultChecked style={{ accentColor: '#f59e0b' }} />
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            {isConverting ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                  <span>⏳ 正在高保真转换中...</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)', transition: 'width 0.2s ease' }} />
                </div>
              </div>
            ) : isCompleted ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '8px', fontSize: '12px', fontWeight: '600', textAlign: 'center' }}>
                  🎉 格式转换完成！已保存至桌面
                </div>
                <button
                  onClick={() => setIsCompleted(false)}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: '8px', border: '1px solid #cbd5e1',
                    background: '#ffffff', color: '#334155', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  继续转换其他文件
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartConvert}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)', transition: 'all 0.15s'
                }}
              >
                🔄 立即转换并保存
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
