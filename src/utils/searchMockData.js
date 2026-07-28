export const getSearchMockResults = (query) => {
  const q = query || '';
  
  if (q.includes('合同') || q.includes('上周一')) {
    return [
      {
        id: 1, type: 'word', icon: 'W', iconColor: '#1890ff', 
        name: '2026公司标准合作框架模板.docx', size: '2.1 MB', time: '2026/06/15 14:24', date: '06/15',
        source: '微信接收',
        hitReason: '文件包含“合作协议”相关内容'
      },
      {
        id: 2, type: 'pdf', icon: 'P', iconColor: '#ff4d4f', 
        name: '补充协议最终版_印章扫描件.pdf', size: '5.6 MB', time: '2026/06/15 10:15', date: '06/15',
        source: '微信接收',
        hitReason: '...补充协议最终版...'
      },
      {
        id: 3, type: 'word', icon: 'W', iconColor: '#1890ff', 
        name: 'xx项目预算说明协议.docx', size: '1.4 MB', time: '2026/06/15 09:30', date: '06/15',
        source: '微信接收',
        hitReason: '文件包含“合同协议”相关内容'
      },
      {
        id: 4, type: 'txt', icon: 'T', iconColor: '#8c8c8c', 
        name: '未命名文档(3).txt', size: '8 KB', time: '2026/06/15 11:20', date: '06/15',
        source: '微信接收',
        hitReason: '...备用合同...'
      }
    ];
  }

  if (q.includes('昨天') || q.includes('元宝')) {
    return [
      {
        id: 1, type: 'pdf', icon: 'P', iconColor: '#ff4d4f', 
        name: '元宝功能重构商业化章程.pdf', size: '3.8 MB', time: '2026/06/23 15:30', date: '06/23',
        source: '手机浏览器下载',
        hitReason: '正文包含“元宝项目”相关内容'
      },
      {
        id: 2, type: 'txt', icon: 'T', iconColor: '#8c8c8c', 
        name: '元宝推进重点备注.txt', size: '15 KB', time: '2026/06/23 16:45', date: '06/23',
        source: '手机微信',
        hitReason: '文件包含“元宝项目”相关内容'
      },
      {
        id: 3, type: 'word', icon: 'W', iconColor: '#1890ff', 
        name: '元宝项目补充协议说明（1）.docx', size: '2.5 MB', time: '2026/06/23 14:10', date: '06/23',
        source: '手机浏览器下载',
        hitReason: '文件包含“元宝项目”相关内容'
      },
      {
        id: 4, type: 'pdf', icon: 'P', iconColor: '#ff4d4f', 
        name: '元宝-技术说明备忘录.pdf', size: '4.2 MB', time: '2026/06/23 17:20', date: '06/23',
        source: '手机微信',
        hitReason: '正文包含“元宝项目”相关内容'
      }
    ];
  }

  // 默认返回 case 1 (新能源)
  return [
    {
      id: 1, type: 'pdf', icon: 'P', iconColor: '#ff4d4f', 
      name: '2026新能源行业趋势前瞻及供应链白皮书.pdf', size: '3.2 MB', time: '2026/06/20 14:24', date: '06/20',
      source: 'QQ浏览器下载',
      hitReason: '关于新能源汽车在上游企...'
    },
    {
      id: 2, type: 'pdf', icon: 'P', iconColor: '#ff4d4f', 
      name: '2026蔚来新能源换电站核心痛点分析.pdf', size: '4.5 MB', time: '2026/06/12 09:30', date: '06/12',
      source: '微信接收',
      hitReason: '...在当下新能源换电效率瓶颈...'
    },
    {
      id: 3, type: 'word', icon: 'W', iconColor: '#1890ff', 
      name: '新能源汽车技术突破专家交流纪要.docx', size: '1.8 MB', time: '2026/06/18 10:15', date: '06/18',
      source: '微信接收',
      hitReason: '文件包含“新能源汽车电池”相关内容'
    },
    {
      id: 4, type: 'txt', icon: 'T', iconColor: '#8c8c8c', 
      name: '未命名文档(3).txt', size: '12 KB', time: '2026/05/14 11:20', date: '05/14',
      source: 'QQ接收',
      hitReason: '文件包含“新能源汽车行业面临的研发瓶颈...”相关内容'
    }
  ];
};
