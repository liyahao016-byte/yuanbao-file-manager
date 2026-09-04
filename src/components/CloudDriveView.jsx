import { useState } from 'react';

const CLOUD_FILES = [
  {
    id: 'cloud_1',
    name: '年度财务汇报_2026.pdf',
    size: '2.4 MB',
    type: 'PDF',
    uploadTime: '2026-08-20 18:32',
    status: 'synced',
    icon: '📄',
  },
  {
    id: 'cloud_2',
    name: 'PM-简历-李雅浩.docx',
    size: '120 KB',
    type: 'WORD',
    uploadTime: '2026-08-19 09:15',
    status: 'synced',
    icon: '📝',
  },
  {
    id: 'cloud_3',
    name: '项目进度跟踪表_Q3.xlsx',
    size: '340 KB',
    type: 'EXCEL',
    uploadTime: '2026-08-18 14:22',
    status: 'synced',
    icon: '📊',
  },
  {
    id: 'cloud_4',
    name: '产品方案演示.pptx',
    size: '5.1 MB',
    type: 'PPT',
    uploadTime: '2026-08-17 20:05',
    status: 'synced',
    icon: '📋',
  },
  {
    id: 'cloud_5',
    name: '服务合同-腾讯云2026.pdf',
    size: '890 KB',
    type: 'PDF',
    uploadTime: '2026-08-15 11:40',
    status: 'synced',
    icon: '📄',
  },
  {
    id: 'cloud_6',
    name: '产品截图合集.png',
    size: '8.6 MB',
    type: 'IMAGE',
    uploadTime: '2026-08-14 16:58',
    status: 'uploading',
    icon: '🖼️',
  },
];

const TYPE_COLORS = {
  PDF: { bg: 'rgba(239,68,68,0.08)', color: '#dc2626' },
  WORD: { bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8' },
  EXCEL: { bg: 'rgba(22,163,74,0.08)', color: '#15803d' },
  PPT: { bg: 'rgba(234,88,12,0.08)', color: '#c2410c' },
  IMAGE: { bg: 'rgba(124,58,237,0.08)', color: '#6d28d9' },
};

export default function CloudDriveView() {
  const [selectedId, setSelectedId] = useState(null);
  const [uploadHover, setUploadHover] = useState(false);

  const totalSize = '17.4 MB';
  const quota = '10 GB';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid #f1f5f9',
        background: 'linear-gradient(135deg, #f8faff 0%, #f0f7ff 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
            }}>☁️</div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>个人云盘</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                已上传 <strong>{totalSize}</strong> / {quota}
              </p>
            </div>
          </div>

          {/* Upload Button */}
          <button
            onMouseEnter={() => setUploadHover(true)}
            onMouseLeave={() => setUploadHover(false)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: uploadHover
                ? 'linear-gradient(135deg, #2563eb, #4f46e5)'
                : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: uploadHover ? '0 4px 16px rgba(99,102,241,0.4)' : '0 2px 8px rgba(99,102,241,0.25)',
              transition: 'all 0.2s ease',
              transform: uploadHover ? 'translateY(-1px)' : 'none',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
            上传文件
          </button>
        </div>

        {/* Storage Bar */}
        <div style={{ marginTop: '14px' }}>
          <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: '0.17%',
              background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
              borderRadius: '3px',
              transition: 'width 0.6s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>已使用 {totalSize}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>总容量 {quota}</span>
          </div>
        </div>
      </div>

      {/* File List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
        {/* Section Label */}
        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '12px', letterSpacing: '0.5px' }}>
          全部文件（{CLOUD_FILES.length} 个）
        </div>

        {/* Column Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px 80px 140px 80px',
          gap: '8px',
          padding: '6px 12px',
          fontSize: '11px', color: '#94a3b8', fontWeight: '600',
          marginBottom: '4px', borderBottom: '1px solid #f1f5f9'
        }}>
          <div />
          <div>文件名</div>
          <div>大小</div>
          <div>格式</div>
          <div>上传时间</div>
          <div>状态</div>
        </div>

        {/* Files */}
        {CLOUD_FILES.map(file => {
          const isSelected = selectedId === file.id;
          const typeStyle = TYPE_COLORS[file.type] || { bg: '#f1f5f9', color: '#475569' };

          return (
            <div
              key={file.id}
              onClick={() => setSelectedId(isSelected ? null : file.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 80px 80px 140px 80px',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
                border: isSelected ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent',
                cursor: 'pointer',
                alignItems: 'center',
                marginBottom: '2px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Icon */}
              <div style={{ fontSize: '22px', textAlign: 'center' }}>{file.icon}</div>

              {/* Name */}
              <div style={{
                fontSize: '13px', fontWeight: '500', color: '#0f172a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {file.name}
              </div>

              {/* Size */}
              <div style={{ fontSize: '12px', color: '#64748b' }}>{file.size}</div>

              {/* Type Badge */}
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '700',
                  background: typeStyle.bg,
                  color: typeStyle.color,
                  letterSpacing: '0.3px'
                }}>{file.type}</span>
              </div>

              {/* Upload Time */}
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{file.uploadTime}</div>

              {/* Status */}
              <div>
                {file.status === 'synced' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16a34a' }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    已同步
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#3b82f6' }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ animation: 'spin 1.5s linear infinite' }}>
                      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                    同步中
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Tip */}
      <div style={{
        padding: '10px 28px',
        borderTop: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '11px', color: '#94a3b8', background: '#fafafa'
      }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        云盘文件仅供在线访问，不占用本地磁盘空间。数据加密存储，隐私安全有保障。
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
