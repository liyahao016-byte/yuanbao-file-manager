import React from 'react';

export const getFileIcon = (type, size = 28) => {
  const t = (type || '').toLowerCase();
  
  // 统一定义普通图标样式：文件基底 + 中心标识
  const baseRect = <rect x="3" y="2" width="18" height="20" rx="3" fill="currentColor" opacity="0.15" />;
  const baseOutline = <path d="M5,2 L14,2 L19,7 L19,20 C19,21.1 18.1,22 17,22 L5,22 C3.9,22 3,21.1 3,20 L3,4 C3,2.9 3.9,2 5,2 Z M13,2 L13,8 L19,8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />;
  
  // 辅助函数：绘制 Mac 风格的 Office 图标
  const renderMacOfficeIcon = (mainColor, letter, innerGraphic) => (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <defs>
        <linearGradient id={`grad-${letter}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mainColor} stopOpacity="0.7" />
          <stop offset="100%" stopColor={mainColor} />
        </linearGradient>
      </defs>
      {/* 外部文档主体 */}
      <rect x="5" y="2" width="15" height="20" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
      {/* 内部彩色渐变区域 */}
      <rect x="7" y="5" width="11" height="11" rx="2" fill={`url(#grad-${letter})`} />
      {/* 内部特征图形 (白线/网格等) */}
      {innerGraphic}
      {/* 左下角悬浮徽标 */}
      <rect x="2" y="13" width="10" height="9" rx="3" fill={mainColor} stroke="#ffffff" strokeWidth="1.5" />
      <text x="7" y="20.5" fill="#ffffff" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">{letter}</text>
    </svg>
  );

  switch (t) {
    case 'folder':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="#f59e0b">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
      );
    case 'pdf':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} color="#ef4444">
          {baseRect}{baseOutline}
          <text x="12" y="15" fill="currentColor" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">PDF</text>
        </svg>
      );
    case 'excel':
    case 'xlsx':
    case 'xls':
      return renderMacOfficeIcon(
        '#10b981', // 绿色
        'X',
        <path d="M7 8.5 L18 8.5 M12.5 5 L12.5 16" stroke="#ffffff" strokeWidth="1" opacity="0.7" />
      );
    case 'word':
    case 'doc':
    case 'docx':
      return renderMacOfficeIcon(
        '#2563eb', // 蓝色
        'W',
        <>
          <rect x="9" y="8" width="7" height="1.5" rx="0.5" fill="#ffffff" opacity="0.9" />
          <rect x="9" y="11.5" width="4.5" height="1.5" rx="0.5" fill="#ffffff" opacity="0.9" />
        </>
      );
    case 'ppt':
    case 'pptx':
      return renderMacOfficeIcon(
        '#ea580c', // 橙红
        'P',
        <>
          <circle cx="12.5" cy="10.5" r="3" fill="#ffffff" opacity="0.9" />
          <path d="M12.5 7.5 A3 3 0 0 1 15.5 10.5 L12.5 10.5 Z" fill="#ffffff" opacity="0.4" />
        </>
      );
    case 'image':
    case 'png':
    case 'jpg':
    case 'jpeg':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} color="#0ea5e9">
          {baseRect}{baseOutline}
          <circle cx="10" cy="11" r="1.5" fill="currentColor" />
          <path d="M7 17 L11 13 L14 16 L17 12 L19 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'video':
    case 'mp4':
    case 'mov':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} color="#8b5cf6">
          {baseRect}{baseOutline}
          <polygon points="10,10 15,13.5 10,17" fill="currentColor" />
        </svg>
      );
    case 'markdown':
    case 'md':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} color="#64748b">
          {baseRect}{baseOutline}
          <text x="12" y="15" fill="currentColor" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">M↓</text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} color="#94a3b8">
          {baseRect}{baseOutline}
          <path d="M8 12 L16 12 M8 15 L13 15 M8 9 L12 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
};
