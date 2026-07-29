import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon } from '../utils/iconUtils';

export default function SmartFolderCard({
  cluster,
  isPinned,
  onPin,
  onDelete,
  onFullView,
  onPreviewFile,
  isDraggable = true,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const [files, setFiles] = useState([]);
  const [totalCount, setTotalCount] = useState(cluster.count || 0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTotalCount(cluster.count || 0);
  }, [cluster.count]);

  useEffect(() => {
    let isMounted = true;
    if (window.__TAURI_INTERNALS__) {
      setIsLoading(true);
      let fetchPromise;
      if (cluster.path) {
        fetchPromise = invoke('read_dir_shallow', { path: cluster.path });
      } else {
        fetchPromise = invoke('get_files_by_cluster', { theme: cluster.id || cluster.name, page: 1, pageSize: 1000 });
      }

      fetchPromise
        .then((res) => {
          if (isMounted && res) {
            setTotalCount(res.length);
            setFiles(res.slice(0, 12)); // 方案 4: 精细双列微型条展示 Top 12 个项目
          }
        })
        .catch(console.error)
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else {
      // 浏览器 Web 预览环境降级 Mock 列表 (按簇提供 10~12 个微型条数据)
      setIsLoading(false);
      const mockFilesMap = {
        '简历': [
          { id: 'm1', name: '李雅浩简历-腾讯云.pdf', fileType: 'pdf' },
          { id: 'm2', name: '李明五简历.docx', fileType: 'doc' },
          { id: 'm3', name: '李明四简历.docx', fileType: 'doc' },
          { id: 'm4', name: '高级前端工程师_李明.pdf', fileType: 'pdf' },
          { id: 'm5', name: '产品经理岗位履历.pdf', fileType: 'pdf' },
          { id: 'm6', name: '实习生个人简历模板.docx', fileType: 'doc' },
          { id: 'm7', name: '技术总监校招简历.pdf', fileType: 'pdf' },
          { id: 'm8', name: '英文简历_Resume_2026.pdf', fileType: 'pdf' },
          { id: 'm9', name: '李雅浩作品集列表.pdf', fileType: 'pdf' },
          { id: 'm10', name: '设计组招聘复试表.xlsx', fileType: 'xls' }
        ],
        '数据报表': [
          { id: 'd1', name: 'image_提取表格.xlsx', fileType: 'xls' },
          { id: 'd2', name: 'TRD_BwardQuotation.xlsx', fileType: 'xls' },
          { id: 'd3', name: '2026Q1营收数据明细.xlsx', fileType: 'xls' },
          { id: 'd4', name: '年度资产负债表_核算.xlsx', fileType: 'xls' },
          { id: 'd5', name: '部门预算支出统计表.xlsx', fileType: 'xls' },
          { id: 'd6', name: '用户留存与活跃数据.csv', fileType: 'csv' },
          { id: 'd7', name: '核心指标月度复盘.xlsx', fileType: 'xls' },
          { id: 'd8', name: '财务审计复核汇总.xlsx', fileType: 'xls' },
          { id: 'd9', name: '渠道投放ROI分析表.xlsx', fileType: 'xls' },
          { id: 'd10', name: '员工薪酬结构总表.xlsx', fileType: 'xls' }
        ],
        '方案报告': [
          { id: 'r1', name: '文件搜索调研报告 (1).doc', fileType: 'doc' },
          { id: 'r2', name: '李雅浩开题报告表.pdf', fileType: 'pdf' },
          { id: 'r3', name: '元宝文件管理器_白皮书.md', fileType: 'md' },
          { id: 'r4', name: '文件阵地页四种清理方案.doc', fileType: 'doc' },
          { id: 'r5', name: '智能聚类算法落地评估.pdf', fileType: 'pdf' },
          { id: 'r6', name: '端侧向量数据库性能报告.pdf', fileType: 'pdf' },
          { id: 'r7', name: '竞品分析与产品路演汇报.pptx', fileType: 'pptx' },
          { id: 'r8', name: '系统安全与隐私合规白皮书.pdf', fileType: 'pdf' },
          { id: 'r9', name: 'UI设计交互升级总结.docx', fileType: 'doc' },
          { id: 'r10', name: '项目一期里程碑验收报告.pdf', fileType: 'pdf' }
        ]
      };

      const matchedKey = Object.keys(mockFilesMap).find(k => cluster.name.includes(k));
      const defaultList = [
        { id: 'f1', name: `${cluster.name}_核心文档_01.pdf`, fileType: 'pdf' },
        { id: 'f2', name: `${cluster.name}_汇总数据_02.xlsx`, fileType: 'xls' },
        { id: 'f3', name: `${cluster.name}_设计初稿_03.png`, fileType: 'png' },
        { id: 'f4', name: `${cluster.name}_会议纪要_04.docx`, fileType: 'doc' },
        { id: 'f5', name: `${cluster.name}_分析报告_05.pdf`, fileType: 'pdf' },
        { id: 'f6', name: `${cluster.name}_配置规则_06.json`, fileType: 'code' },
        { id: 'f7', name: `${cluster.name}_资产清单_07.xlsx`, fileType: 'xls' },
        { id: 'f8', name: `${cluster.name}_演示文稿_08.pptx`, fileType: 'pptx' },
        { id: 'f9', name: `${cluster.name}_交付附件_09.zip`, fileType: 'zip' },
        { id: 'f10', name: `${cluster.name}_说明指南_10.md`, fileType: 'md' }
      ];

      setFiles(matchedKey ? mockFilesMap[matchedKey] : defaultList);
    }
    return () => {
      isMounted = false;
    };
  }, [cluster.id, cluster.path, cluster.name]);

  const getClusterIcon = (name, categoryType) => {
    if (categoryType === 'format' || cluster.id.startsWith('smart_format_')) {
      if (name.includes('图片')) return '🖼️';
      if (name.includes('文档')) return '📄';
      if (name.includes('表格')) return '📊';
      if (name.includes('媒体')) return '🎬';
    }
    if (name.includes('简历') || name.includes('求职')) return '💼';
    if (name.includes('合同') || name.includes('协议')) return '📜';
    if (name.includes('财务') || name.includes('发票')) return '💰';
    if (name.includes('方案') || name.includes('报告')) return '📄';
    if (name.includes('报表') || name.includes('明细')) return '📊';
    if (name.includes('设计') || name.includes('素材')) return '🎨';
    if (name.includes('论文') || name.includes('学习')) return '🎓';
    if (name.includes('影音') || name.includes('媒体')) return '🎬';
    if (name.includes('代码') || name.includes('工程')) return '💻';
    return '📁';
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: isPinned ? '2px solid var(--tag-green)' : '1px solid var(--border-color)',
        boxShadow: isPinned ? '0 8px 24px rgba(0,185,107,0.15)' : '0 4px 16px rgba(0,0,0,0.04)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: isDraggable ? 'grab' : 'default',
        position: 'relative',
      }}
    >
      {/* Top Banner / Title & Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cluster.name}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            共 {totalCount} 个文件
          </div>
        </div>

        {/* Action Controls Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isDraggable && (
            <>
              {/* 1. 📌 钉住按钮 */}
              <button
                onClick={() => onPin(cluster.id)}
                title={isPinned ? '取消置顶' : '📌 置顶钉住'}
                style={{
                  background: isPinned ? 'rgba(0, 185, 107, 0.15)' : '#f1f5f9',
                  border: isPinned ? '1px solid rgba(0, 185, 107, 0.3)' : '1px solid transparent',
                  borderRadius: '8px',
                  padding: '5px 9px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: isPinned ? 'var(--tag-green)' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isPinned) {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.color = '#1e293b';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPinned) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                📌
              </button>

              {/* 2. 🗑️ 加粗垃圾桶按钮 */}
              <button
                onClick={() => onDelete(cluster.id)}
                title="解散/删除此卡片簇"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid transparent',
                  borderRadius: '8px',
                  padding: '5px 9px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ stroke: 'currentColor', strokeWidth: 0.5 }}>
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </>
          )}

          {/* 3. 全视图 ➔ 按钮 */}
          <button
            onClick={() => onFullView(cluster.id)}
            style={{
              background: 'rgba(0, 185, 107, 0.1)',
              color: 'var(--tag-green)',
              border: '1px solid rgba(0, 185, 107, 0.25)',
              borderRadius: '8px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 185, 107, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 185, 107, 0.1)';
            }}
          >
            <span>全视图</span>
            <span>➔</span>
          </button>
        </div>
      </div>

      {/* 方案 4: 2 Column Micro-Pills (双列高密精细微型条展示层) */}
      <div style={{ marginTop: '2px' }}>
        {isLoading ? (
          <div style={{ fontSize: '12px', color: '#aaa', padding: '12px 0' }}>加载预览中...</div>
        ) : files.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#ccc', padding: '8px 0' }}>暂无预览文件</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '5px 8px',
              paddingRight: '2px',
            }}
          >
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => onPreviewFile && onPreviewFile(file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 7px',
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  overflow: 'hidden',
                  height: '26px',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f6ff';
                  e.currentTarget.style.borderColor = 'rgba(0,122,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#f1f5f9';
                }}
              >
                <span style={{ fontSize: '13px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {getFileIcon(file.type || file.fileType)}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '500',
                    color: '#334155',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.2'
                  }}
                  title={file.virtualName || file.name}
                >
                  {file.virtualName || file.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
