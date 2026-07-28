import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useState } from 'react';

export default function WelcomeScreen({ onWorkspaceSelected }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);

  const startStreamingScan = async (path) => {
    setIsScanning(true);
    let unlisten = null;
    try {
      unlisten = await listen('scan-progress', (event) => {
        setScannedCount(event.payload.scanned_count);
      });
      // Call stream backend command
      await invoke('scan_workspace_stream', { dirPath: path });
      // When done
      onWorkspaceSelected(path);
    } catch (e) {
      console.error(e);
      alert('扫描失败: ' + e);
      setIsScanning(false);
    } finally {
      if (unlisten) unlisten();
    }
  };

  const handleGrantAll = async () => {
    try {
      const home = await invoke('get_home_dir') || '~/';
      startStreamingScan(home);
    } catch (e) {
      startStreamingScan('~/'); // Fallback
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: '选择工作区文件夹'
      });
      if (selectedPath) {
        startStreamingScan(selectedPath);
      }
    } catch (err) {
      console.error('Failed to open dialog:', err);
    }
  };

  if (isScanning) {
    return (
      <div style={{
        width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', color: '#1a202c', fontFamily: 'system-ui'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px', animation: 'spin 2s linear infinite' }}>⚙️</div>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>正在构建本地数据库...</h2>
        <p style={{ marginTop: '16px', fontSize: '18px', color: '#4a5568' }}>
          已流式抓取文件数量: <span style={{ color: '#29b6f6', fontWeight: 'bold' }}>{scannedCount}</span>
        </p>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #e0e8f0 100%)',
      color: 'var(--text-primary)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        padding: '60px',
        borderRadius: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌌</div>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px', color: '#1a202c' }}>
          欢迎来到次世代文件管理
        </h1>
        <p style={{ fontSize: '15px', color: '#4a5568', lineHeight: '1.6', marginBottom: '40px' }}>
          请选择一个本地文件夹作为你的工作区。
          我们将在此建立极速的高维特征向量索引，为您带来毫秒级的智能语义检索体验。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <button 
            onClick={handleGrantAll}
            style={{
              background: '#2196F3',
              color: 'white',
              border: 'none',
              padding: '16px 32px',
              fontSize: '16px',
              fontWeight: '600',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(41, 182, 246, 0.3)',
              transition: 'all 0.2s',
              width: '100%'
            }}
          >
            一键授权全电脑文件 (推荐)
          </button>
          
          <button 
            onClick={handleSelectFolder}
            style={{
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '16px 32px',
              fontSize: '16px',
              fontWeight: '600',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%'
            }}
          >
            选择部分文件夹作为工作区
          </button>
        </div>
      </div>
    </div>
  );
}
