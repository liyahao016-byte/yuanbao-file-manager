import { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

export default function PreviewerView({ file, onClose }) {
  const [snippet, setSnippet] = useState("");
  const [loading, setLoading] = useState(false);

  // Resizable width state (default 450px)
  const [width, setWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  // Image state
  const [imgSrc, setImgSrc] = useState('');
  const [imgLoading, setImgLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState(true); // true: fit window, false: custom zoom / 1:1

  // OCR state
  const [showOcrText, setShowOcrText] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Cropping State
  const [isCropping, setIsCropping] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 80 }); // Percentage-based: 0~100%
  const [cropSaving, setCropSaving] = useState(false);
  const [cropMsg, setCropMsg] = useState('');
  const imgRef = useRef(null);

  // Drag State for crop
  const dragInfo = useRef({
    isDragging: false,
    action: null,
    startX: 0,
    startY: 0,
    startBox: null
  });

  // Handle Crop Drag logic
  const handleCropMouseDown = (e, action) => {
    e.preventDefault();
    e.stopPropagation();
    dragInfo.current = {
      isDragging: true,
      action,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...cropBox }
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragInfo.current.isDragging || !imgRef.current) return;
      const { action, startX, startY, startBox } = dragInfo.current;
      
      const imgRect = imgRef.current.getBoundingClientRect();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // Convert delta to percentage of image container
      const pX = (deltaX / imgRect.width) * 100;
      const pY = (deltaY / imgRect.height) * 100;

      let newX = startBox.x;
      let newY = startBox.y;
      let newW = startBox.w;
      let newH = startBox.h;

      if (action === 'move') {
        newX = Math.max(0, Math.min(startBox.x + pX, 100 - startBox.w));
        newY = Math.max(0, Math.min(startBox.y + pY, 100 - startBox.h));
      } else {
        if (action.includes('w')) {
          newX = Math.max(0, Math.min(startBox.x + pX, startBox.x + startBox.w - 5));
          newW = startBox.w - (newX - startBox.x);
        }
        if (action.includes('e')) {
          newW = Math.max(5, Math.min(startBox.w + pX, 100 - startBox.x));
        }
        if (action.includes('n')) {
          newY = Math.max(0, Math.min(startBox.y + pY, startBox.y + startBox.h - 5));
          newH = startBox.h - (newY - startBox.y);
        }
        if (action.includes('s')) {
          newH = Math.max(5, Math.min(startBox.h + pY, 100 - startBox.y));
        }
      }

      setCropBox({ x: newX, y: newY, w: newW, h: newH });
    };

    const handleMouseUp = () => {
      dragInfo.current.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Excel state
  const [excelData, setExcelData] = useState(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState("");
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  const fileExt = (file?.name?.split('.').pop() || file?.type || file?.format || '').toLowerCase();
  const isImage = ['image', 'png', 'jpg', 'jpeg', 'gif', 'heic', 'heif', 'webp', 'svg', 'bmp', 'ico', 'psd', 'tiff', 'tif'].includes(fileExt) || (file?.type === 'image' || file?.file_type === 'image');
  const isVideo = ['video', 'mp4', 'mov', 'avi', 'mkv'].includes(fileExt);
  const isExcel = ['excel', 'xls', 'xlsx', 'csv'].includes(fileExt);

  useEffect(() => {
    if (!file) return;
    
    // Reset states on file change
    setZoom(1);
    setRotation(0);
    setFitMode(true);
    setShowOcrText(false);
    setOcrText("");
    setImgSrc("");
    setIsCropping(false);
    setCropBox({ x: 10, y: 10, w: 80, h: 80 });
    setExcelData(null);
    setExcelError("");
    setActiveSheetIndex(0);

    // If Image, load base64 image (supports HEIC/PSD/TIFF/PNG/JPG/WEBP)
    if (isImage && window.__TAURI_INTERNALS__) {
      setImgLoading(true);
      invoke('read_image_base64', { path: file.path })
        .then(res => setImgSrc(res))
        .catch(err => {
          console.error("Base64 read failed, fallback to convertFileSrc:", err);
          setImgSrc(convertFileSrc(file.path));
        })
        .finally(() => setImgLoading(false));
    }

    // If Excel, fetch Excel grid data
    if (isExcel && window.__TAURI_INTERNALS__) {
      setExcelLoading(true);
      invoke('parse_excel_preview', { path: file.path })
        .then(res => {
          if (res && res.sheets && res.sheets.length > 0) {
            setExcelData(res);
          } else {
            setExcelError("无有效表格数据");
          }
        })
        .catch(err => setExcelError(`[Excel解析错误] ${err}`))
        .finally(() => setExcelLoading(false));
    }
    
    // If Word/PDF/Other, fetch text snippet
    if (!isImage && !isVideo && !isExcel && window.__TAURI_INTERNALS__) {
      setLoading(true);
      invoke('read_document_snippet', { path: file.path })
        .then(res => setSnippet(res || "无可见文本内容..."))
        .catch(err => setSnippet(`[解析错误] ${err}`))
        .finally(() => setLoading(false));
    }
  }, [file]);

  const handleOpenNative = async () => {
    try {
      if (!file?.path) return;
      
      let appName = null;
      if (['doc', 'docx'].includes(fileExt)) {
        appName = 'Microsoft Word';
      } else if (['xls', 'xlsx', 'csv'].includes(fileExt)) {
        appName = 'Microsoft Excel';
      } else if (['md', 'markdown'].includes(fileExt)) {
        appName = 'Visual Studio Code';
      }
      
      if (window.__TAURI_INTERNALS__) {
        await invoke('open_file_with_app', { path: file.path, appName });
      } else {
        await open(file.path);
      }
    } catch (e) {
      console.error("Failed to open file with specific app:", e);
      // Fallback to default open if invoke fails or not in Tauri
      try {
        if (file?.path) await open(file.path);
      } catch (err) {
        console.error("Fallback open failed:", err);
      }
    }
  };

  const [isSyncingDisk, setIsSyncingDisk] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const handleSyncToDisk = async () => {
    if (!file?.id || !window.__TAURI_INTERNALS__) return;
    setIsSyncingDisk(true);
    setSyncStatusMsg('');
    try {
      const newPath = await invoke('sync_virtual_name_to_disk', { id: file.id });
      setSyncStatusMsg('✅ 物理文件改名成功！');
      file.path = newPath;
      if (file.virtualName) {
        file.name = file.virtualName;
      }
    } catch (err) {
      console.error(err);
      setSyncStatusMsg(`❌ 同步失败: ${err}`);
    } finally {
      setIsSyncingDisk(false);
    }
  };

  const handleExtractOcr = () => {
    if (ocrText) {
      setShowOcrText(!showOcrText);
      return;
    }
    if (!window.__TAURI_INTERNALS__) return;
    setOcrLoading(true);
    setShowOcrText(true);
    invoke('read_document_snippet', { path: file.path })
      .then(res => setOcrText(res || "未在图片中识别到文字"))
      .catch(err => setOcrText(`[OCR错误] ${err}`))
      .finally(() => setOcrLoading(false));
  };

  const handleCopyOcr = () => {
    if (ocrText) {
      navigator.clipboard.writeText(ocrText);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    }
  };

  // Canvas Crop & Base64 preview
  const handleApplyCanvasCrop = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;

    const realX = (cropBox.x / 100) * naturalW;
    const realY = (cropBox.y / 100) * naturalH;
    const realW = (cropBox.w / 100) * naturalW;
    const realH = (cropBox.h / 100) * naturalH;

    canvas.width = realW;
    canvas.height = realH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);

    const croppedBase64 = canvas.toDataURL('image/png');
    setImgSrc(croppedBase64);
    setIsCropping(false);
    setCropMsg('✨ 前端剪裁已应用，预览已更新！');
    setTimeout(() => setCropMsg(''), 3000);
  };

  // Native Crop Save to Disk
  const handleSaveNativeCrop = async (saveAsCopy = true) => {
    if (!file?.path || !imgRef.current || !window.__TAURI_INTERNALS__) return;
    const img = imgRef.current;
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;

    const realX = (cropBox.x / 100) * naturalW;
    const realY = (cropBox.y / 100) * naturalH;
    const realW = (cropBox.w / 100) * naturalW;
    const realH = (cropBox.h / 100) * naturalH;

    setCropSaving(true);
    try {
      const outPath = await invoke('crop_image_native', {
        path: file.path,
        x: realX,
        y: realY,
        width: realW,
        height: realH,
        saveAsCopy,
        save_as_copy: saveAsCopy
      });
      setCropMsg(`✅ 成功另存物理剪裁图片至: ${outPath.split('/').pop()}`);
      setIsCropping(false);
    } catch (err) {
      console.error(err);
      setCropMsg(`❌ 剪裁保存失败: ${err}`);
    } finally {
      setCropSaving(false);
      setTimeout(() => setCropMsg(''), 4000);
    }
  };

  // Helper for Excel column letter (0 -> A, 1 -> B, etc.)
  const getColName = (colIndex) => {
    let name = '';
    let i = colIndex;
    while (i >= 0) {
      name = String.fromCharCode((i % 26) + 65) + name;
      i = Math.floor(i / 26) - 1;
    }
    return name;
  };

  // Drag resizable handler
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const maxAllowed = Math.min(850, window.innerWidth * 0.7);
      const newWidth = Math.min(Math.max(280, startWidth + deltaX), maxAllowed);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div style={{ 
      flex: `0 0 ${width}px`, 
      width: `${width}px`, 
      maxWidth: '70vw', 
      minWidth: '280px', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#fafafa', 
      borderLeft: '1px solid var(--border-color)', 
      height: '100%',
      position: 'relative'
    }}>
      {/* Resizable Divider Handle on Left Edge */}
      <div 
        onMouseDown={handleMouseDown}
        title="按住向左/向右拖拽调节预览区与文件展示区宽度"
        style={{
          position: 'absolute',
          left: '-4px',
          top: 0,
          bottom: 0,
          width: '8px',
          cursor: 'col-resize',
          zIndex: 100,
          background: isResizing ? 'var(--tag-green)' : 'transparent',
          transition: 'background 0.15s ease'
        }}
        onMouseOver={(e) => { if (!isResizing) e.currentTarget.style.background = '#94a3b8'; }}
        onMouseOut={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Header Toolbar */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }} title={file?.virtualName || file?.name}>
          {file?.virtualName || file?.name || '预览'}
        </h3>
        <div style={{ display: 'flex', gap: '12px', color: 'var(--icon-color)', fontSize: '13px', alignItems: 'center' }}>
          <button 
            onClick={handleOpenNative} 
            style={{ padding: '4px 10px', fontSize: '12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}
            title="使用电脑默认程序打开完整文件"
          >
            系统应用打开
          </button>
          <span style={{ borderLeft: '1px solid #ccc', height: '16px' }}></span>
          {onClose && (
            <span style={{ cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center' }} onClick={onClose} title="关闭预览">✕</span>
          )}
        </div>
      </div>
      
      {/* Content Area */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc' }}>
        
        {/* Virtual Name vs Real File Name Banner */}
        {file?.virtualName && (
          <div style={{ 
            width: '100%', 
            marginBottom: '12px', 
            padding: '12px 16px', 
            background: '#f0fdf4', 
            border: '1px solid #bbf7d0', 
            borderRadius: '8px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#166534', fontWeight: '600', marginBottom: '4px' }}>
              <span style={{ marginRight: '6px' }}>✨</span> 智能映射模式 (半映射半实际)
            </div>
            <div style={{ color: '#15803d', fontSize: '12px', marginBottom: '2px' }}>
              <strong>虚拟显示名：</strong>{file.virtualName}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', wordBreak: 'break-all', marginBottom: '8px' }}>
              <strong>磁盘真实文件：</strong>{file.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={handleSyncToDisk}
                disabled={isSyncingDisk}
                style={{
                  padding: '4px 12px',
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: isSyncingDisk ? 'wait' : 'pointer',
                  fontWeight: '500'
                }}
              >
                {isSyncingDisk ? '同步中...' : '同步虚拟名到真实磁盘'}
              </button>
              {syncStatusMsg && (
                <span style={{ fontSize: '12px', color: syncStatusMsg.includes('❌') ? '#dc2626' : '#166534' }}>
                  {syncStatusMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 1. IMAGE PREVIEW WITH DARK FLOATING TOOLBAR & INTERACTIVE CROP */}
        {isImage ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* Elegant Light Toolbar */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              marginBottom: '12px', 
              background: 'rgba(255, 255, 255, 0.85)', 
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              color: '#334155', 
              padding: '6px 14px', 
              borderRadius: '16px', 
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              userSelect: 'none',
              zIndex: 10
            }}>
              {/* Zoom Out (-) */}
              <button 
                onClick={() => { setFitMode(false); setZoom(prev => Math.max(0.25, prev - 0.25)); }} 
                style={{ background: 'none', border: 'none', color: '#334155', fontSize: '16px', cursor: 'pointer', padding: '2px 6px', fontWeight: 'bold' }}
                title="缩小"
              >
                -
              </button>

              {/* Percentage Dropdown */}
              <select 
                value={fitMode ? 'fit' : `${Math.round(zoom * 100)}%`}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'fit') {
                    setFitMode(true);
                  } else {
                    setFitMode(false);
                    const num = parseInt(val) / 100;
                    setZoom(num);
                  }
                }}
                style={{
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="25%">25%</option>
                <option value="50%">50%</option>
                <option value="75%">75%</option>
                <option value="100%">100% (1:1)</option>
                <option value="150%">150%</option>
                <option value="200%">200%</option>
                <option value="fit">适应窗口</option>
              </select>

              {/* Zoom In (+) */}
              <button 
                onClick={() => { setFitMode(false); setZoom(prev => Math.min(3, prev + 0.25)); }} 
                style={{ background: 'none', border: 'none', color: '#334155', fontSize: '16px', cursor: 'pointer', padding: '2px 6px', fontWeight: 'bold' }}
                title="放大"
              >
                +
              </button>

              {/* 1:1 Original Size Button */}
              <button 
                onClick={() => { setFitMode(false); setZoom(1); setRotation(0); }} 
                style={{ 
                  background: !fitMode && zoom === 1 ? '#e2e8f0' : 'transparent', 
                  border: 'none', 
                  color: '#334155', 
                  fontSize: '12px', 
                  cursor: 'pointer', 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  fontWeight: '600',
                  transition: 'background 0.2s'
                }}
                title="1:1 原始像素显示"
              >
                1:1
              </button>

              {/* Fit Window Button */}
              <button 
                onClick={() => { setFitMode(true); setZoom(1); }} 
                style={{ 
                  background: fitMode ? '#e2e8f0' : 'transparent', 
                  border: 'none', 
                  color: '#334155', 
                  fontSize: '13px', 
                  cursor: 'pointer', 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  alignItems: 'center',
                  transition: 'background 0.2s'
                }}
                title="适应窗口大小"
              >
                🔳
              </button>

              <span style={{ borderLeft: '1px solid #e2e8f0', height: '14px', margin: '0 4px' }}></span>

              {/* 90 Rotate */}
              <button 
                onClick={() => setRotation((rotation + 90) % 360)} 
                style={{ background: 'transparent', border: 'none', color: '#334155', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="旋转 90 度"
              >
                🔄 90°
              </button>

              <span style={{ borderLeft: '1px solid #e2e8f0', height: '14px', margin: '0 4px' }}></span>

              {/* Crop Button */}
              <button 
                onClick={() => setIsCropping(!isCropping)} 
                style={{ 
                  background: isCropping ? '#e0f2fe' : 'transparent', 
                  border: 'none', 
                  color: isCropping ? '#0284c7' : '#334155', 
                  fontSize: '12px', 
                  cursor: 'pointer', 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  fontWeight: '500', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  transition: 'all 0.2s'
                }}
                title="裁剪图片"
              >
                ✂️ 裁剪
              </button>

              <span style={{ borderLeft: '1px solid #e2e8f0', height: '14px', margin: '0 4px' }}></span>

              {/* OCR Text Extract Button */}
              <button 
                onClick={handleExtractOcr}
                style={{ 
                  background: showOcrText ? '#e0e7ff' : 'transparent', 
                  border: 'none', 
                  color: showOcrText ? '#4f46e5' : '#334155', 
                  fontSize: '12px', 
                  cursor: 'pointer', 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  fontWeight: '500', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  transition: 'all 0.2s'
                }}
              >
                ✨ {showOcrText ? '收起提词' : '提词'}
              </button>
            </div>

            {cropMsg && (
              <div style={{ marginBottom: '8px', fontSize: '12px', color: cropMsg.includes('❌') ? '#dc2626' : '#166534', fontWeight: '500' }}>
                {cropMsg}
              </div>
            )}

            {/* Image Canvas Container */}
            <div style={{ 
              width: '100%', 
              maxHeight: fitMode ? '340px' : '480px', 
              overflow: fitMode ? 'hidden' : 'auto', 
              display: 'flex', 
              justify: 'center', 
              alignItems: 'center', 
              background: '#e2e8f0', 
              borderRadius: '8px', 
              padding: '16px',
              position: 'relative'
            }}>
              {imgLoading ? (
                <div style={{ fontSize: '13px', color: '#64748b' }}>🖼️ 正在解码图片格式...</div>
              ) : imgSrc ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img 
                    ref={imgRef}
                    src={imgSrc} 
                    alt="Preview" 
                    style={{ 
                      maxWidth: fitMode ? '100%' : 'none', 
                      maxHeight: fitMode ? '300px' : 'none', 
                      objectFit: fitMode ? 'contain' : 'initial', 
                      borderRadius: '4px', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease-out',
                      display: 'block'
                    }}
                  />

                  {/* Interactive Crop Selection Overlay */}
                  {isCropping && (
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(0,0,0,0.4)',
                      zIndex: 20
                    }}>
                        <div 
                          onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                          style={{
                          position: 'absolute',
                          left: `${cropBox.x}%`,
                          top: `${cropBox.y}%`,
                          width: `${cropBox.w}%`,
                          height: `${cropBox.h}%`,
                          border: '2px dashed #16a34a',
                          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                          cursor: 'move'
                        }}>
                          {/* Corner Handles */}
                          <div onMouseDown={(e) => handleCropMouseDown(e, 'nw')} style={{ position: 'absolute', top: '-5px', left: '-5px', width: '10px', height: '10px', background: '#16a34a', cursor: 'nwse-resize' }}></div>
                          <div onMouseDown={(e) => handleCropMouseDown(e, 'ne')} style={{ position: 'absolute', top: '-5px', right: '-5px', width: '10px', height: '10px', background: '#16a34a', cursor: 'nesw-resize' }}></div>
                          <div onMouseDown={(e) => handleCropMouseDown(e, 'sw')} style={{ position: 'absolute', bottom: '-5px', left: '-5px', width: '10px', height: '10px', background: '#16a34a', cursor: 'nesw-resize' }}></div>
                          <div onMouseDown={(e) => handleCropMouseDown(e, 'se')} style={{ position: 'absolute', bottom: '-5px', right: '-5px', width: '10px', height: '10px', background: '#16a34a', cursor: 'nwse-resize' }}></div>
                        </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>图片暂不可预览</div>
              )}
            </div>

            {/* Crop Control Action Bar */}
            {isCropping && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
                <button 
                  onClick={() => setIsCropping(false)}
                  style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button 
                  onClick={handleApplyCanvasCrop}
                  style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '500', cursor: 'pointer' }}
                >
                  ✂️ 应用当前视图剪裁
                </button>
                <button 
                  onClick={() => handleSaveNativeCrop(true)}
                  disabled={cropSaving}
                  style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: '500', cursor: cropSaving ? 'wait' : 'pointer' }}
                >
                  {cropSaving ? '物理保存中...' : '📄 另存物理图片副本'}
                </button>
              </div>
            )}

            {/* Apple Vision OCR Drawer */}
            {showOcrText && (
              <div style={{ width: '100%', marginTop: '16px', background: '#fff', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>✨</span> Apple Vision OCR 提词结果:
                  </span>
                  {ocrText && !ocrLoading && (
                    <button 
                      onClick={handleCopyOcr}
                      style={{ padding: '2px 8px', fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}
                    >
                      {copiedMsg ? '已复制！' : '复制全部'}
                    </button>
                  )}
                </div>
                {ocrLoading ? (
                  <div style={{ fontSize: '13px', color: '#64748b' }}>正在使用 macOS 原生 Vision 识别图内汉字...</div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                    {ocrText}
                  </div>
                )}
              </div>
            )}
          </div>

        /* 2. EXCEL GRID TABLE PREVIEW */
        ) : isExcel ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {excelLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>正在解析 Excel 工作表矩阵...</div>
              </div>
            ) : excelError ? (
              <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                {excelError}
              </div>
            ) : excelData && excelData.sheets && excelData.sheets.length > 0 ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                
                {/* Sheet Tabs */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', padding: '4px 8px 0 8px', gap: '4px' }}>
                  {excelData.sheets.map((sheet, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSheetIndex(idx)}
                      style={{
                        padding: '6px 14px',
                        border: '1px solid #e2e8f0',
                        borderBottom: idx === activeSheetIndex ? '2px solid #16a34a' : '1px solid #e2e8f0',
                        background: idx === activeSheetIndex ? '#fff' : '#f8fafc',
                        color: idx === activeSheetIndex ? '#166534' : '#64748b',
                        fontWeight: idx === activeSheetIndex ? '600' : '400',
                        fontSize: '12px',
                        borderRadius: '6px 6px 0 0',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      📄 {sheet.name}
                    </button>
                  ))}
                </div>

                {/* Grid Table Container */}
                <div style={{ maxHeight: '360px', overflow: 'auto', background: '#fff' }}>
                  {excelData.sheets[activeSheetIndex] && excelData.sheets[activeSheetIndex].rows.length > 0 ? (
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px', fontFamily: 'monospace' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'center' }}>
                          <th style={{ border: '1px solid #e2e8f0', width: '36px', padding: '6px', background: '#f1f5f9', fontWeight: '600' }}>#</th>
                          {excelData.sheets[activeSheetIndex].rows[0].map((_, colIdx) => (
                            <th key={colIdx} style={{ border: '1px solid #e2e8f0', padding: '6px 10px', minWidth: '70px', fontWeight: '600' }}>
                              {getColName(colIdx)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelData.sheets[activeSheetIndex].rows.map((row, rowIdx) => (
                          <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td style={{ border: '1px solid #e2e8f0', textAlign: 'center', background: '#f8fafc', color: '#94a3b8', fontWeight: '500' }}>
                              {rowIdx + 1}
                            </td>
                            {row.map((cellVal, colIdx) => (
                              <td 
                                key={colIdx} 
                                style={{ 
                                  border: '1px solid #e2e8f0', 
                                  padding: '6px 10px', 
                                  color: '#334155', 
                                  maxWidth: '180px', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}
                                title={cellVal}
                              >
                                {cellVal}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      该 Sheet 为空
                    </div>
                  )}
                </div>

                <div style={{ padding: '8px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>共 {excelData.sheets.length} 个工作表</span>
                  <span>展示前 100 行单元格数据</span>
                </div>
              </div>
            ) : null}
          </div>

        /* 3. VIDEO PREVIEW */
        ) : isVideo ? (
          <video 
            controls 
            src={window.__TAURI_INTERNALS__ ? convertFileSrc(file.path) : ''} 
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
        ) : (
          /* 4. WORD / PDF / TEXT FALLBACK */
          <div style={{ 
            width: '100%', 
            background: 'white', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)', 
            borderRadius: '8px', 
            padding: '24px',
            border: '1px solid #e2e8f0',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', background: '#eff6ff', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#3b82f6', fontSize: '22px' }}>📄</div>
              <div style={{ marginLeft: '14px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', wordBreak: 'break-all' }}>{file?.name}</h2>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{file?.size} • {file?.updatedAt}</div>
              </div>
            </div>
            
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', fontWeight: '500' }}>[文件内容摘要提取]</div>
            
            {loading ? (
              <div style={{ color: '#64748b', fontSize: '13px' }}>正在极速剥离文本内容...</div>
            ) : (
              <div style={{ 
                fontSize: '13.5px', 
                color: '#334155', 
                lineHeight: '1.6', 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
              }}>
                {snippet}
                {snippet?.length >= 500 && (
                  <div style={{ marginTop: '16px', color: '#3b82f6', fontSize: '12px', cursor: 'pointer', textAlign: 'center' }} onClick={handleOpenNative}>
                    ...片段截断，点击使用外部程序查看完整排版
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
