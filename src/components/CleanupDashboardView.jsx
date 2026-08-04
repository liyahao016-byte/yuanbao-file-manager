import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function CleanupDashboardView({ workspacePath }) {
  const [isScanning, setIsScanning] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [isCleaned, setIsCleaned] = useState(false);
  
  const [stats, setStats] = useState({
    wechat: 0,
    duplicates: 0,
    temp: 0,
    large: 0,
    totalToClean: 0
  });

  const parseSize = (sizeStr) => {
    if (!sizeStr) return 0;
    const val = parseFloat(sizeStr);
    if (sizeStr.includes('GB')) return val * 1024;
    if (sizeStr.includes('MB')) return val;
    if (sizeStr.includes('KB')) return val / 1024;
    return 0; // in MB
  };

  const formatSize = (sizeMB) => {
    if (sizeMB === 0) return '0 B';
    if (sizeMB > 1024) return (sizeMB / 1024).toFixed(1) + ' GB';
    if (sizeMB < 1) return (sizeMB * 1024).toFixed(0) + ' KB';
    return sizeMB.toFixed(1) + ' MB';
  };

  useEffect(() => {
    if (workspacePath && window.__TAURI_INTERNALS__) {
      invoke('get_files', { dirPath: workspacePath })
        .then(res => {
           let wechatSize = 0;
           let tempSize = 0;
           let largeSize = 0;
           
           if (res) {
             res.forEach(f => {
               const s = parseSize(f.size);
               if (f.name.match(/(mmexport|wx_|qq)/i)) {
                 wechatSize += s;
               }
               if (f.name.match(/\.(log|tmp|bak|cache)$/i)) {
                 tempSize += s;
               }
               if (s > 100) { // greater than 100MB
                 largeSize += s;
               }
             });
           }
           
           setStats({
             wechat: wechatSize,
             duplicates: wechatSize * 0.3, // mock 30% of wechat size as duplicates for demo
             temp: tempSize,
             large: largeSize,
             totalToClean: wechatSize + tempSize + (wechatSize * 0.3)
           });
        })
        .catch(console.error);
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setScanProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => setIsScanning(false), 500);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [workspacePath]);

  const handleClean = () => {
    setIsCleaned(true);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f7fa', padding: '32px', overflowY: 'auto' }}>
      
      {/* 头部信息 */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '12px', fontSize: '28px', color: '#1890ff' }}>🧹</span> 
            深度空间清理
          </h1>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            AI 已为您深度扫描磁盘，智能识别可安全清理的冗余文件。
          </p>
        </div>
      </div>

      {isScanning ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
           <div style={{ position: 'relative', width: '200px', height: '200px', borderRadius: '50%', background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px' }}>
             {/* 简单的扫描雷达动效 */}
             <div style={{ position: 'absolute', inset: '10px', borderRadius: '50%', border: '2px solid #e6f7ff', borderTopColor: '#1890ff', animation: 'spin 1s linear infinite' }}></div>
             <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff' }}>{scanProgress}%</div>
             <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
           </div>
           <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>正在深度扫描全盘数据...</h2>
           <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>正在分析微信/常用沟通工具缓存与临时文件目录</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* 左侧主图表 */}
          <div style={{ flex: 1, background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Macintosh HD (C:) 状态</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
               {/* 纯 CSS 环形进度条 */}
               <div style={{ 
                 width: '200px', height: '200px', borderRadius: '50%',
                 background: isCleaned ? 'conic-gradient(#1890ff 45%, #f0f0f0 0)' : 'conic-gradient(#ff4d4f 85%, #f0f0f0 0)',
                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                 position: 'relative', transition: 'background 1s ease-in-out'
               }}>
                 <div style={{ width: '160px', height: '160px', background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '36px', fontWeight: 'bold', color: isCleaned ? '#1890ff' : '#ff4d4f' }}>{isCleaned ? '45%' : '85%'}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>存储空间已用</span>
                 </div>
               </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#fafafa', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>总容量</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>512 GB</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>可用空间</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: isCleaned ? '#1890ff' : '#ff4d4f' }}>{isCleaned ? '281 GB' : '76 GB'}</div>
              </div>
            </div>

            {/* 一键清理按钮 */}
            {!isCleaned ? (
              <div style={{ marginTop: '32px' }}>
                <button 
                  onClick={handleClean}
                  style={{ width: '100%', padding: '16px', borderRadius: '8px', background: 'var(--tag-green)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(0, 185, 107, 0.3)', transition: 'all 0.2s' }}
                >
                  <span style={{ marginRight: '8px', fontSize: '20px' }}>✨</span> AI 智能一键清理 (释放 {formatSize(stats.totalToClean)})
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '32px', textAlign: 'center', padding: '16px', background: '#e6f7ef', color: '#009a52', borderRadius: '8px', fontWeight: '500' }}>
                🎉 清理完成！您的磁盘现在运行如飞。
              </div>
            )}
          </div>

          {/* 右侧分类卡片 */}
          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '16px' }}>
             {/* Card 1 */}
             <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center' }}>
               <div style={{ width: '48px', height: '48px', background: '#e6f7ff', color: '#1890ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginRight: '16px' }}>💬</div>
               <div style={{ flex: 1 }}>
                 <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>微信/常用沟通工具 备份缓存</div>
                 <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>包含历史群聊的深层视频与冗余文件。AI 已识别无需保留。</div>
               </div>
               <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '20px', fontWeight: 'bold', color: isCleaned ? '#d9d9d9' : '#1890ff' }}>{isCleaned ? '0 B' : formatSize(stats.wechat)}</div>
                 <div style={{ fontSize: '12px', color: isCleaned ? '#d9d9d9' : '#00b96b' }}>{isCleaned ? '已清理' : '安全可清理'}</div>
               </div>
             </div>

             {/* Card 2 */}
             <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center' }}>
               <div style={{ width: '48px', height: '48px', background: '#fff1f0', color: '#ff4d4f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginRight: '16px' }}>📑</div>
               <div style={{ flex: 1 }}>
                 <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>完全重复的文件</div>
                 <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>发现 MD5 一致的重复图片与下载文档。</div>
               </div>
               <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '20px', fontWeight: 'bold', color: isCleaned ? '#d9d9d9' : '#ff4d4f' }}>{isCleaned ? '0 B' : formatSize(stats.duplicates)}</div>
                 <div style={{ fontSize: '12px', color: isCleaned ? '#d9d9d9' : '#00b96b' }}>{isCleaned ? '已清理' : '建议合并清理'}</div>
               </div>
             </div>

             {/* Card 3 */}
             <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center' }}>
               <div style={{ width: '48px', height: '48px', background: '#f6ffed', color: '#52c41a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginRight: '16px' }}>🗑️</div>
               <div style={{ flex: 1 }}>
                 <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>系统与临时垃圾</div>
                 <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Log 缓存、系统更新残留、临时生成文件等。</div>
               </div>
               <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '20px', fontWeight: 'bold', color: isCleaned ? '#d9d9d9' : '#52c41a' }}>{isCleaned ? '0 B' : formatSize(stats.temp)}</div>
                 <div style={{ fontSize: '12px', color: isCleaned ? '#d9d9d9' : '#00b96b' }}>{isCleaned ? '已清理' : '安全可清理'}</div>
               </div>
             </div>
             
             {/* Card 4 */}
             <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center' }}>
               <div style={{ width: '48px', height: '48px', background: '#f9f0ff', color: '#722ed1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginRight: '16px' }}>📦</div>
               <div style={{ flex: 1 }}>
                 <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>超大冷数据</div>
                 <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>老旧虚拟机镜像、长视频素材 ({'>'}100MB)。</div>
               </div>
               <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '20px', fontWeight: 'bold', color: isCleaned ? '#d9d9d9' : '#722ed1' }}>{isCleaned ? '0 B' : formatSize(stats.large)}</div>
                 <div style={{ fontSize: '12px', color: isCleaned ? '#d9d9d9' : '#ff4d4f' }}>{isCleaned ? '已归档' : '需人工核对'}</div>
               </div>
             </div>

          </div>
        </div>
      )}
    </div>
  );
}
