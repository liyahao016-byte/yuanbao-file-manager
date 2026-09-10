import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

/**
 * QuickArchiveModal — AI 智能预填归档表单
 * 
 * 交互流程（文件优先 + 语音输入）:
 * 1. 用户先选择附件文件（也支持粘贴截图）
 * 2. 若有附件 → 调 smart_prefill_archive 获取 AI 预填数据
 * 3. 截图/照片 → OCR 提取 → AI 总结关键结论 → 填入产出
 * 4. 🎙️ 语音输入 → 录音 → macOS 原生转写 → AI 解析 → 自动填充表单
 * 5. 表单自动填入 AI 推荐内容
 * 6. 用户微调后确认归档
 */

// 简易日期提取工具
const extractTodoAndDate = (text) => {
  const dateRegex = /(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})/;
  const match = text.match(dateRegex);
  if (match) {
    return {
      text: text.replace(match[0], '').trim(),
      dueDate: match[0].includes('-') ? match[0] : new Date().getFullYear() + '-' + match[0]
    };
  }
  return { text, dueDate: '' };
};

export default function QuickArchiveModal({ onClose, onConfirm, prefill, demandContext }) {
  // 表单状态 — 如果传入 prefill 则用其内容预填（来源可以是任意需要预填表单的场景）
  const [title, setTitle] = useState(prefill?.text || '');
  const [project, setProject] = useState(prefill?.archiveProject || '');
  const [priority, setPriority] = useState(prefill?.priority === 'urgent' ? 'P0' : prefill?.priority === 'high' ? 'P1' : '');
  const [duration, setDuration] = useState('');
  const [output, setOutput] = useState('');
  const [blocker, setBlocker] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Todo 列表（支持多条待办，每条可选日期）
  const [todos, setTodos] = useState([]);

  // 附件
  const [attachments, setAttachments] = useState([]);

  // ── 需求看板扩展字段 ──
  const [demandId, setDemandId] = useState(demandContext?.demandId || '');
  const [nodeType, setNodeType] = useState(demandContext?.nodeType || 'progress');
  const [demandStatus, setDemandStatus] = useState(demandContext?.demandStatus || (demandContext?.nodeType === 'completion' ? 'done' : 'active'));
  const [isKeyConclusion, setIsKeyConclusion] = useState(false);
  const [demandsList, setDemandsList] = useState([]);

  // 历史标签 & 归档目录
  const [historyTags, setHistoryTags] = useState([]);
  const [defaultVaultPath, setDefaultVaultPath] = useState('');
  const [customVaultPath, setCustomVaultPath] = useState('');
  const [useCustomPath, setUseCustomPath] = useState(false);

  // AI 预填状态
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [prefillDone, setPrefillDone] = useState(false);
  const [confidence, setConfidence] = useState({});
  const [currentStage, setCurrentStage] = useState(null);
  const [prefillError, setPrefillError] = useState(null);
  const [userEdited, setUserEdited] = useState({});

  // OCR 状态
  const [isOcring, setIsOcring] = useState(false);
  const pasteAreaRef = useRef(null);

  // ── 语音输入状态 ──
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ── 标题智能解析状态 ──
  const [isTitleParsing, setIsTitleParsing] = useState(false);
  const titleParseTimerRef = useRef(null);
  const lastParsedTitleRef = useRef(''); // 避免重复解析同一标题
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    if (demandContext) {
      if (demandContext.demandId) setDemandId(demandContext.demandId);
      if (demandContext.nodeType) setNodeType(demandContext.nodeType);
      if (demandContext.demandStatus) setDemandStatus(demandContext.demandStatus);
      else if (demandContext.nodeType === 'completion') setDemandStatus('done');
      if (demandContext.title !== undefined) setTitle(demandContext.title);
      if (demandContext.defaultContent !== undefined) setOutput(demandContext.defaultContent);
      if (demandContext.blocker !== undefined) setBlocker(demandContext.blocker);
      if (demandContext.demandName) setProject(demandContext.demandName);

      // ── 需求 4 闭环：拉起弹窗时自动继承该需求上个节点的标签与归档路径 ──
      if (window.__TAURI_INTERNALS__ && demandContext.demandId) {
        invoke('get_latest_demand_node_meta', { demandId: demandContext.demandId })
          .then(meta => {
            if (meta) {
              if (meta.tags && meta.tags.length > 0) {
                setTags(meta.tags);
              }
              if (meta.custom_vault_path) {
                setCustomVaultPath(meta.custom_vault_path);
                setUseCustomPath(true);
              }
            }
          })
          .catch(err => console.warn('Inherit node meta error:', err));
      }
    }
  }, [demandContext]);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const [tagsResult, configResult, demandsResult] = await Promise.all([
            invoke('query_history_tags').catch(() => []),
            invoke('get_archive_config').catch(() => ({})),
            invoke('query_demands', { status: null }).catch(() => []),
          ]);
          setHistoryTags(tagsResult || []);
          if (configResult && configResult.vaultPath) {
            setDefaultVaultPath(configResult.vaultPath);
          }
          setDemandsList(demandsResult || []);
        }
      } catch (err) {
        console.warn('Failed to load history data:', err);
      }
    };
    loadData();
  }, []);

  // ── AI 预填核心逻辑 ──
  const handleAIPrefill = useCallback(async (filePaths) => {
    if (!filePaths || filePaths.length === 0) return;
    setIsPrefilling(true);
    setPrefillError(null);
    try {
      const result = await invoke('smart_prefill_archive', { filePaths });
      if (result.title) setTitle(result.title);
      if (result.project) setProject(result.project);
      if (result.priority) setPriority(result.priority);
      if (result.durationMin) {
        // 将 AI 返回的分钟数映射到最近的 30 分钟倍数
        const mins = parseInt(result.durationMin, 10);
        if (!isNaN(mins)) {
          const rounded = Math.max(30, Math.round(mins / 30) * 30);
          setDuration(String(rounded));
        }
      }
      if (result.output) setOutput(result.output);
      if (result.blocker) setBlocker(result.blocker);
      if (result.nextAction) {
        // 将 nextAction 拆入 todos 并解析可能的日期
        const lines = result.nextAction.split(/[;；\n]/).filter(l => l.trim());
        if (lines.length > 0) {
          setTodos(lines.map(l => {
            const parsed = extractTodoAndDate(l);
            return {
              text: parsed ? parsed.text : l.trim(),
              dueDate: parsed ? parsed.dueDate : '',
            };
          }));
        }
      }
      if (result.tags && result.tags.length > 0) setTags(result.tags);
      if (result.currentStage) setCurrentStage(result.currentStage);
      if (result.confidence) setConfidence(result.confidence);
      setPrefillDone(true);
      setUserEdited({});
    } catch (err) {
      console.error('AI prefill failed:', err);
      setPrefillError(typeof err === 'string' ? err : '预填失败，请手动填写');
    } finally {
      setIsPrefilling(false);
    }
  }, []);

  // 选择附件 + 自动触发 AI 预填
  const handleAddAttachments = async () => {
    try {
      const selected = await open({ multiple: true, title: '选择工作产出文件' });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        const newFiles = paths
          .filter(p => !attachments.find(a => a.path === p))
          .map(p => ({
            name: p.split('/').pop() || p.split('\\').pop() || p,
            path: p,
            isImage: false,
          }));
        if (newFiles.length > 0) {
          const updated = [...attachments, ...newFiles];
          setAttachments(updated);
          // 只对非图片文件触发预填
          const nonImagePaths = updated.filter(a => !a.isImage).map(a => a.path);
          if (nonImagePaths.length > 0) {
            handleAIPrefill(nonImagePaths);
          }
        }
      }
    } catch (err) {
      console.error('选择文件失败:', err);
    }
  };

  // ── 粘贴截图/照片 → OCR → 总结 → 填入产出 ──
  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;

        setIsOcring(true);
        try {
          // 将图片存为临时文件
          const buffer = await blob.arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          const ext = blob.type === 'image/png' ? 'png' : 'jpg';
          const tempName = `clipboard_${Date.now()}.${ext}`;
          // 写到临时目录
          const tempPath = await invoke('write_temp_image', {
            fileName: tempName,
            data: Array.from(uint8),
          }).catch(() => null);

          if (tempPath) {
            // 添加到附件列表
            setAttachments(prev => [...prev, {
              name: tempName,
              path: tempPath,
              isImage: true,
            }]);

            // OCR + AI 总结 → 只保留 OCR 识别内容，不添加"保存图片"描述
            const summary = await invoke('ocr_and_summarize', { imagePath: tempPath });
            if (summary && summary.trim()) {
              setOutput(prev => {
                // 如果之前有非 OCR 的预填内容，替换掉；只保留 OCR 结果
                if (!prev || !prev.trim()) {
                  return summary.trim();
                }
                // 已有内容时追加 OCR 结果（换行分隔）
                return `${prev}\n${summary.trim()}`;
              });
            }
          }
        } catch (err) {
          console.error('OCR 处理失败:', err);
        } finally {
          setIsOcring(false);
        }
        break;
      }
    }
  }, []);

  // 全局粘贴监听
  useEffect(() => {
    const handler = (e) => handlePaste(e);
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [handlePaste]);

  const handleRemoveAttachment = (path) => {
    setAttachments(attachments.filter(a => a.path !== path));
  };

  // ── 标题智能解析：提取项目名 + 标签 ──
  const parseTitleFields = useCallback(async (titleText) => {
    const trimmed = (titleText || '').trim();
    if (trimmed.length < 4 || trimmed === lastParsedTitleRef.current) return;
    lastParsedTitleRef.current = trimmed;

    try {
      setIsTitleParsing(true);
      const result = await invoke('parse_title_fields', { title: trimmed });
      console.log('[标题解析]', result);

      // 只填充空字段，不覆盖用户已手动编辑的内容
      if (result.project && !project && !userEdited.project) {
        setProject(result.project);
      }
      if (result.tags && result.tags.length > 0) {
        setTags(prev => {
          const existing = new Set(prev);
          const newTags = result.tags.filter(t => !existing.has(t));
          return newTags.length > 0 ? [...prev, ...newTags] : prev;
        });
      }
    } catch (err) {
      console.warn('[标题解析] 降级:', err);
    } finally {
      setIsTitleParsing(false);
    }
  }, [project, userEdited.project]);

  // 标题变化时防抖触发解析（800ms 无输入后触发）
  const handleTitleChange = useCallback((newTitle) => {
    setTitle(newTitle);
    if (prefillDone) setUserEdited(prev => ({ ...prev, title: true }));

    // 清除上一个定时器
    if (titleParseTimerRef.current) {
      clearTimeout(titleParseTimerRef.current);
    }

    // 设置新的防抖定时器
    if (newTitle.trim().length >= 4) {
      titleParseTimerRef.current = setTimeout(() => {
        parseTitleFields(newTitle);
      }, 800);
    }
  }, [parseTitleFields, prefillDone]);

  // 标题 onBlur 时立即触发解析（如果还没解析过）
  const handleTitleBlur = useCallback(() => {
    if (titleParseTimerRef.current) {
      clearTimeout(titleParseTimerRef.current);
      titleParseTimerRef.current = null;
    }
    if (title.trim().length >= 4 && title.trim() !== lastParsedTitleRef.current) {
      parseTitleFields(title);
    }
  }, [title, parseTitleFields]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (titleParseTimerRef.current) clearTimeout(titleParseTimerRef.current);
    };
  }, []);

  // ── 语音录制核心逻辑 ──
  const startRecording = useCallback(async () => {
    try {
      setVoiceError(null);
      setVoiceTranscript('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      // 尝试多种格式，WKWebView 支持有限
      const mimeTypes = ['audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg'];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }
      // 如果都不支持，使用默认
      const options = selectedMime ? { mimeType: selectedMime } : {};
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // 停止所有音轨
        stream.getTracks().forEach(track => track.stop());
        
        // 拼接音频数据
        const mimeType = mediaRecorder.mimeType || selectedMime || 'audio/wav';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        if (audioBlob.size < 1000) {
          setVoiceError('录音时间太短，请重试');
          setIsRecording(false);
          return;
        }

        // 开始转写
        setIsTranscribing(true);
        setIsRecording(false);
        
        try {
          // 1. 将音频数据发送到后端保存
          const buffer = await audioBlob.arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          
          const audioPath = await invoke('save_audio_file', {
            data: Array.from(uint8),
            format: mimeType,
          });

          // 2. 调用后端语音识别
          const transcript = await invoke('transcribe_audio', { audioPath });
          setVoiceTranscript(transcript);

          // 3. 用 AI 解析为结构化字段
          const parsed = await invoke('parse_voice_to_archive', { transcript });
          
          // 4. 填充表单（只覆盖空字段或由语音主动覆盖）
          if (parsed.title && !title.trim()) setTitle(parsed.title);
          if (parsed.project && !project.trim()) setProject(parsed.project);
          if (parsed.priority && !priority) setPriority(parsed.priority);
          if (parsed.output) {
            setOutput(prev => prev.trim() ? `${prev}\n${parsed.output}` : parsed.output);
          }
          if (parsed.blocker && !blocker.trim()) setBlocker(parsed.blocker);
          if (parsed.durationMin && !duration) {
            const mins = parseInt(parsed.durationMin, 10);
            if (!isNaN(mins)) {
              const rounded = Math.max(30, Math.round(mins / 30) * 30);
              setDuration(String(rounded));
            }
          }
          if (parsed.nextAction) {
            const lines = String(parsed.nextAction).split(/[;；\n]/).filter(l => l.trim());
            if (lines.length > 0) {
              setTodos(lines.map(l => {
                const p = extractTodoAndDate(l);
                return {
                  text: p ? p.text : l.trim(),
                  dueDate: p ? p.dueDate : '',
                };
              }));
            }
          }
          if (parsed.tags && Array.isArray(parsed.tags) && parsed.tags.length > 0) {
            setTags(prev => {
              const merged = [...new Set([...prev, ...parsed.tags])];
              return merged;
            });
          }
          setPrefillDone(true);
        } catch (err) {
          console.error('语音处理失败:', err);
          setVoiceError(typeof err === 'string' ? err : '语音识别失败，请重试或手动输入');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250); // 每 250ms 收集一次数据
      setIsRecording(true);
      setRecordingTime(0);
      
      // 计时器
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

    } catch (err) {
      console.error('麦克风权限获取失败:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('麦克风权限被拒绝。请前往 系统设置 → 隐私与安全性 → 麦克风，找到本应用（或终端）并开启权限，然后重启应用');
      } else if (err.name === 'NotFoundError') {
        setVoiceError('未检测到麦克风设备，请检查硬件连接');
      } else if (err.name === 'NotReadableError') {
        setVoiceError('麦克风被其他应用占用，请关闭后重试');
      } else {
        setVoiceError('无法访问麦克风: ' + (err.message || '未知错误'));
      }
    }
  }, [title, project, priority, blocker, duration, todos]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (!isTranscribing) {
      startRecording();
    }
  }, [isRecording, isTranscribing, startRecording, stopRecording]);

  // 快捷键 Ctrl+M / Cmd+M 切换录音
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording]);

  // 清理录音定时器
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleSelectCustomDir = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false, title: '选择归档目录' });
      if (selectedPath) {
        setCustomVaultPath(selectedPath);
        setUseCustomPath(true);
      }
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  };

  const effectiveVaultPath = useCustomPath && customVaultPath ? customVaultPath : defaultVaultPath;

  const filteredTags = historyTags.filter(t => t.includes(tagInput) && !tags.includes(t));

  const handleAddTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter(t => t !== tag));
  };

  const markEdited = (field) => {
    if (prefillDone) setUserEdited(prev => ({ ...prev, [field]: true }));
  };

  // ── 智能解析文本中的下一步待办与日期 ──
  const extractTodoAndDate = (text) => {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();
    if (!clean) return null;

    // 1. 拆分为独立句子，优先选取既有动作/指令关键词又包含明确日期/时间的句子
    const sentences = clean.split(/[。\n;；!！]/).map(s => s.trim()).filter(Boolean);
    let actionSentence = '';

    // 第一优先：既有时间词，又有行动指令（如 "明天7.15前需尽力修复这些主要功能问题"）
    for (const s of sentences) {
      if (/(明天|后天|下周|\d{1,2}[\.\/\-]\d{1,2}|月|日)/i.test(s) && /(需|要|跟进|下一步|计划|修复|上线|完成|排期|准备|提交|联调|测试|整改|落实|尽力)/i.test(s)) {
        actionSentence = s;
        break;
      }
    }

    // 第二优先：含有明确行动指令
    if (!actionSentence) {
      for (const s of sentences) {
        if (/(需|要|跟进|下一步|计划|修复|上线|完成|排期|准备|提交|联调|测试|整改|落实|尽力)/i.test(s)) {
          actionSentence = s;
          break;
        }
      }
    }

    // 若无明确动词关键词，但句中有明确时间标记，选取第一句
    if (!actionSentence && sentences.length > 0) {
      if (/(明天|后天|下周|月|日|\d{1,2}[\.\/\-]\d{1,2})/i.test(clean)) {
        actionSentence = sentences[0];
      }
    }

    if (!actionSentence) return null;

    // 2. 日期提取逻辑
    let parsedDueDate = '';
    const now = new Date();
    const year = now.getFullYear();

    // (A) 相对日期
    if (/明天/i.test(actionSentence) || /明天/i.test(clean)) {
      const tmr = new Date(now);
      tmr.setDate(tmr.getDate() + 1);
      parsedDueDate = tmr.toISOString().split('T')[0];
    } else if (/后天/i.test(actionSentence) || /后天/i.test(clean)) {
      const dayAfter = new Date(now);
      dayAfter.setDate(dayAfter.getDate() + 2);
      parsedDueDate = dayAfter.toISOString().split('T')[0];
    } else if (/下周/i.test(actionSentence) || /下周/i.test(clean)) {
      const dayOfWeek = now.getDay() || 7;
      const daysUntilNextMon = 8 - dayOfWeek;
      const nextMon = new Date(now);
      nextMon.setDate(nextMon.getDate() + daysUntilNextMon);
      parsedDueDate = nextMon.toISOString().split('T')[0];
    }

    // (B) 完整年月日：YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
    if (!parsedDueDate) {
      const fullDateMatch = actionSentence.match(/(\d{4})[\.\/\-](\d{1,2})[\.\/\-](\d{1,2})/);
      if (fullDateMatch) {
        const y = fullDateMatch[1];
        const m = String(fullDateMatch[2]).padStart(2, '0');
        const d = String(fullDateMatch[3]).padStart(2, '0');
        parsedDueDate = `${y}-${m}-${d}`;
      }
    }

    // (C) 月日格式：M.D前 / M月D日 / M/D (例: 7.15前, 7月15日, 09/15)
    if (!parsedDueDate) {
      const mdMatch = actionSentence.match(/(\d{1,2})[\.\/\-月](\d{1,2})(?:日|号|前|\s|$)/);
      if (mdMatch) {
        const m = String(mdMatch[1]).padStart(2, '0');
        const d = String(mdMatch[2]).padStart(2, '0');
        parsedDueDate = `${year}-${m}-${d}`;
      }
    }

    // 3. 提纯待办核心文本 (去掉时间词与动词引导词)
    let todoText = actionSentence
      .replace(/(明天|后天|大后天|下周[一二三四五六日]?|\d{4}[\.\/\-]\d{1,2}[\.\/\-]\d{1,2}|\d{1,2}[\.\/\-月]\d{1,2}(?:日|号|前)?)/gi, '')
      .replace(/^(前|需|要|尽力|计划|下一步|跟进|预计|在)+/i, '')
      .trim();

    if (todoText.length < 2) {
      todoText = actionSentence.trim();
    }

    return {
      text: todoText,
      dueDate: parsedDueDate
    };
  };

  // 实时解析内容 (output) 中的下一步行动与时间
  useEffect(() => {
    if (userEdited.nextAction) return; // 用户已手动调整时尊重用户输入
    if (!output || !output.trim()) {
      if (demandContext?.completedTodoItem) return;
      setTodos([]);
      return;
    }

    const parsed = extractTodoAndDate(output);
    if (parsed && parsed.text) {
      setTodos([{ text: parsed.text, dueDate: parsed.dueDate }]);
    } else {
      // 文本中未提取到明确下一步指令时，不填充虚假数据
      setTodos([]);
    }
  }, [output, userEdited.nextAction, demandContext]);

  // ── Todo 列表操作 ──
  const handleTodoChange = (idx, field, value) => {
    setTodos(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
    markEdited('nextAction');
  };

  const handleAddTodo = () => {
    setTodos(prev => [...prev, { text: '', dueDate: '' }]);
  };

  const handleRemoveTodo = (idx) => {
    setTodos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    // 将 todos 合并为 nextAction 字符串
    const nextActionStr = todos
      .filter(t => t.text.trim())
      .map(t => t.text.trim())
      .join('\n');

    onConfirm?.({
      title, project, priority, duration,
      output, blocker, nextAction: nextActionStr,
      tags,
      files: attachments.map(f => f.path),
      customVaultPath: useCustomPath && customVaultPath ? customVaultPath : null,
      timestamp: new Date().toISOString(),
      // 需求看板扩展字段
      demandId: demandId || null,
      nodeType: nodeType || 'progress',
      isKeyConclusion,
      demandStatus: demandId ? demandStatus : null,
      completedTodoItem: demandContext?.completedTodoItem || null,
    });
  };

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  // 今天的日期字符串 (YYYY-MM-DD)，用于日历默认最小值
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // AI 置信度标签已移除——不再在表单字段旁显示 AI 标识

  // PM 需求流程阶段
  const stages = ['调研', '需求文档', '确认技术方案', '设计对稿', '讲需求开发', '设计埋点', '走查测试', '实验', 'LR汇报', '发布'];

  // 耗时下拉选项 (0.5h ~ 8h)
  const durationOptions = [];
  for (let h = 0.5; h <= 8; h += 0.5) {
    const mins = h * 60;
    const label = h % 1 === 0 ? `${h}h` : `${h}h`;
    durationOptions.push({ value: String(mins), label });
  }

  return (
    <div
      onPaste={handlePaste}
      style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '620px', maxWidth: '92%',
        boxShadow: '0 20px 24px -4px rgba(0,0,0,0.1), 0 8px 10px -4px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', fontWeight: '600' }}>
            <span style={{ marginRight: '8px', fontSize: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </span>
            智能归档
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '400', marginLeft: '12px' }}>
              {timeStr}
            </span>
            {prefillDone && (
              <span style={{
                fontSize: '10px', color: '#16a34a', background: 'rgba(34,197,94,0.1)',
                padding: '2px 8px', borderRadius: '10px', marginLeft: '8px', fontWeight: '500'
              }}>
                AI 已预填
              </span>
            )}
            {isOcring && (
              <span style={{
                fontSize: '10px', color: '#6366f1', background: 'rgba(99,102,241,0.1)',
                padding: '2px 8px', borderRadius: '10px', marginLeft: '8px', fontWeight: '500'
              }}>
                OCR 识别中...
              </span>
            )}
            {isTranscribing && (
              <span style={{
                fontSize: '10px', color: '#8b5cf6', background: 'rgba(139,92,246,0.1)',
                padding: '2px 8px', borderRadius: '10px', marginLeft: '8px', fontWeight: '500',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10,
                  border: '2px solid #8b5cf6', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                }} />
                语音解析中...
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 语音输入按钮 */}
            <button
              onClick={toggleRecording}
              disabled={isTranscribing || isPrefilling || isOcring}
              title={isRecording ? '停止录音' : '语音输入 (Ctrl+M)'}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                border: isRecording ? '2px solid #ef4444' : '1.5px solid #e2e8f0',
                background: isRecording ? 'rgba(239, 68, 68, 0.08)' : '#f8fafc',
                cursor: (isTranscribing || isPrefilling || isOcring) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                animation: isRecording ? 'voicePulse 1.5s ease-in-out infinite' : 'none',
                opacity: (isTranscribing || isPrefilling || isOcring) ? 0.4 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" 
                stroke={isRecording ? '#ef4444' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <button onClick={onClose} style={{ fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1, background: 'none', border: 'none' }}>×</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', background: '#fafbfc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* ⭐ 第一步：选择文件 / 粘贴截图 */}
            <div
              ref={pasteAreaRef}
              style={{
                background: prefillDone ? 'rgba(34, 197, 94, 0.03)' : 'rgba(99, 102, 241, 0.03)',
                border: `1.5px ${isPrefilling || isOcring ? 'solid' : 'dashed'} ${prefillDone ? '#22c55e' : '#6366f1'}`,
                borderRadius: '10px', padding: '14px 16px',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: attachments.length > 0 ? '10px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{prefillDone ? '✅' : '📎'}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: prefillDone ? '#16a34a' : '#6366f1' }}>
                    {isPrefilling ? 'AI 正在分析文件内容...' : isOcring ? 'OCR 识别截图中...' : prefillDone ? `已分析 ${attachments.length} 个文件` : '第一步：选择文件或粘贴截图'}
                  </span>
                  {(isPrefilling || isOcring) && (
                    <span style={{
                      display: 'inline-block', width: '14px', height: '14px',
                      border: '2px solid #6366f1', borderTopColor: 'transparent',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                    }} />
                  )}
                </div>
                <button
                  onClick={handleAddAttachments}
                  disabled={isPrefilling || isOcring}
                  style={{
                    fontSize: '12px', color: '#6366f1', cursor: (isPrefilling || isOcring) ? 'not-allowed' : 'pointer',
                    padding: '5px 12px', borderRadius: '6px',
                    border: '1px solid #e0e7ff', background: (isPrefilling || isOcring) ? '#f1f5f9' : '#f5f3ff',
                    fontWeight: '500', opacity: (isPrefilling || isOcring) ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  {attachments.length > 0 ? '继续添加' : '选择文件'}
                </button>
              </div>

              {!attachments.length && !isPrefilling && !isOcring && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  选择文件后 AI 将自动分析内容预填表单 · 也支持 <strong style={{ color: '#6366f1' }}>Ctrl+V 粘贴截图</strong>（自动 OCR 提取结论）· <strong style={{ color: '#8b5cf6' }}>Ctrl+M 语音输入</strong>
                </div>
              )}

              {prefillError && (
                <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px' }}>
                  ⚠ {prefillError}（可手动填写）
                </div>
              )}

              {/* 已选文件列表 */}
              {attachments.length > 0 && (
                <div style={{
                  background: '#fff', borderRadius: '6px', maxHeight: '100px', overflowY: 'auto',
                  border: '1px solid #e2e8f0'
                }}>
                  {attachments.map((f, i) => (
                    <div key={f.path} style={{
                      padding: '6px 10px', fontSize: '11px', color: '#475569',
                      borderBottom: i < attachments.length - 1 ? '1px solid #f5f5f5' : 'none',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                      <span style={{ color: '#94a3b8' }}>{f.isImage ? '🖼' : '📄'}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      {f.isImage && <span style={{ fontSize: '9px', color: '#6366f1', background: '#ede9fe', padding: '1px 4px', borderRadius: '3px' }}>OCR</span>}
                      <span
                        onClick={() => handleRemoveAttachment(f.path)}
                        style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '13px', lineHeight: 1 }}
                      >×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🎙️ 语音输入面板 */}
            {(isRecording || isTranscribing || voiceTranscript || voiceError) && (
              <div style={{
                background: isRecording ? 'rgba(239, 68, 68, 0.03)' : isTranscribing ? 'rgba(139, 92, 246, 0.03)' : voiceError ? 'rgba(239, 68, 68, 0.02)' : 'rgba(34, 197, 94, 0.03)',
                border: `1.5px ${isRecording ? 'solid' : 'dashed'} ${isRecording ? '#ef4444' : isTranscribing ? '#8b5cf6' : voiceError ? '#fca5a5' : '#22c55e'}`,
                borderRadius: '10px', padding: '14px 16px',
                transition: 'all 0.3s ease',
              }}>
                {isRecording && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* 录音波形动画 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                          width: 3, borderRadius: 2, background: '#ef4444',
                          animation: `voiceWave 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                        }} />
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                        正在录音...
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}
                        {' · '}说完后点击停止或再按 Ctrl+M
                      </div>
                    </div>
                    <button onClick={stopRecording} style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #fca5a5',
                      background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#dc2626" stroke="none">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                      </svg>
                      停止
                    </button>
                  </div>
                )}

                {isTranscribing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      display: 'inline-block', width: 16, height: 16,
                      border: '2px solid #8b5cf6', borderTopColor: 'transparent',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                      flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>AI 正在解析语音内容...</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>识别 → 理解 → 自动填充表单</div>
                    </div>
                  </div>
                )}

                {voiceTranscript && !isRecording && !isTranscribing && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>🎙️</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>语音识别结果</span>
                      <button onClick={() => setVoiceTranscript('')} style={{
                        marginLeft: 'auto', fontSize: 10, color: '#9ca3af', cursor: 'pointer',
                        background: 'none', border: 'none', padding: '2px 4px',
                      }}>收起</button>
                    </div>
                    <div style={{
                      fontSize: 12, color: '#374151', lineHeight: 1.5,
                      padding: '8px 10px', background: '#fff', borderRadius: 6,
                      border: '1px solid #e2e8f0', maxHeight: 60, overflowY: 'auto',
                    }}>
                      {voiceTranscript}
                    </div>
                  </div>
                )}

                {voiceError && !isRecording && !isTranscribing && (
                  <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span>⚠</span>
                      <span style={{ fontWeight: 600 }}>语音输入异常</span>
                      <button onClick={() => { setVoiceError(null); startRecording(); }} style={{
                        marginLeft: 'auto', fontSize: 11, color: '#6366f1', cursor: 'pointer',
                        background: '#f5f3ff', border: '1px solid #e0e7ff', borderRadius: 4,
                        padding: '2px 10px', fontWeight: 500,
                      }}>重试</button>
                    </div>
                    <div style={{ color: '#b91c1c', lineHeight: 1.5 }}>{voiceError}</div>
                  </div>
                )}
              </div>
            )}

            {/* 需求流程阶段指示器 */}
            {prefillDone && currentStage && (
              <div style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px'
              }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '500' }}>
                  📋 AI 判断当前所处阶段
                </div>
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                  {stages.map((stage, idx) => {
                    const isActive = currentStage && (
                      currentStage.includes(stage) || stage.includes(currentStage) ||
                      (idx === 1 && currentStage.includes('需求文档')) ||
                      (idx === 2 && currentStage.includes('技术方案')) ||
                      (idx === 3 && currentStage.includes('设计')) ||
                      (idx === 4 && currentStage.includes('开发')) ||
                      (idx === 5 && currentStage.includes('埋点')) ||
                      (idx === 6 && (currentStage.includes('走查') || currentStage.includes('测试'))) ||
                      (idx === 7 && currentStage.includes('实验')) ||
                      (idx === 8 && currentStage.includes('汇报')) ||
                      (idx === 9 && currentStage.includes('发布'))
                    );
                    const isPast = stages.findIndex(s =>
                      currentStage && (currentStage.includes(s) || s.includes(currentStage))
                    );
                    const isBefore = isPast >= 0 && idx < isPast;
                    return (
                      <div key={stage} style={{
                        fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
                        background: isActive ? '#6366f1' : isBefore ? '#e0e7ff' : '#f1f5f9',
                        color: isActive ? '#fff' : isBefore ? '#6366f1' : '#94a3b8',
                        fontWeight: isActive ? '600' : '400',
                        whiteSpace: 'nowrap',
                      }}>
                        {idx + 1}.{stage}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 所属需求 + 节点类型 + 关键结论 */}
            {demandsList.length > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>
                    所属需求
                    {demandId && (
                      <span style={{
                        fontSize: 9, color: '#6366f1', fontWeight: 400, marginLeft: 6,
                        background: 'rgba(99,102,241,0.08)', padding: '1px 5px', borderRadius: 3,
                      }}>
                        已关联
                      </span>
                    )}
                  </label>
                  <select
                    value={demandId}
                    onChange={e => setDemandId(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">不关联需求（独立归档）</option>
                    {demandsList.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.priority ? `[${d.priority}] ` : ''}{d.title}
                        {d.status === 'active' ? ' 🟢' : d.status === 'hold' ? ' 🟡' : d.status === 'done' ? ' ✅' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: '130px' }}>
                  <label style={labelStyle}>节点类型</label>
                  <select
                    value={nodeType}
                    onChange={e => setNodeType(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="progress">📝 进展</option>
                    <option value="conclusion">💡 结论</option>
                    <option value="document">📄 文档</option>
                    <option value="milestone">🏁 里程碑</option>
                    <option value="blocker">🚫 卡点</option>
                  </select>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  paddingBottom: '2px', flexShrink: 0, height: '38px',
                }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    cursor: 'pointer', fontSize: '12px', color: isKeyConclusion ? '#f59e0b' : '#94a3b8',
                    fontWeight: isKeyConclusion ? '600' : '400',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}>
                    <input
                      type="checkbox"
                      checked={isKeyConclusion}
                      onChange={e => setIsKeyConclusion(e.target.checked)}
                      style={{ display: 'none' }}
                    />
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 18, height: 18, borderRadius: 4,
                      border: isKeyConclusion ? '2px solid #f59e0b' : '1.5px solid #cbd5e1',
                      background: isKeyConclusion ? '#fef3c7' : '#fff',
                      transition: 'all 0.15s',
                      fontSize: 12,
                    }}>
                      {isKeyConclusion && '⭐'}
                    </span>
                    关键结论
                  </label>
                </div>
              </div>
            )}

            {/* 内容（原"关键产出"，支持粘贴截图自动 OCR + 保存附件） */}
            <div>
              <label style={labelStyle}>
                内容
                {isOcring && <span style={{ fontSize: '10px', color: '#6366f1', marginLeft: '8px' }}>OCR 提取中...</span>}
                {isTitleParsing && (
                  <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 400, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    智能识别中…
                  </span>
                )}
              </label>
              <textarea
                value={output}
                onChange={e => { setOutput(e.target.value); markEdited('output'); }}
                placeholder="记录任何内容：做了什么、产出了什么、结论、想法…（支持粘贴截图自动 OCR 提取）"
                rows={4}
                autoFocus={!prefillDone}
                style={{
                  ...inputStyle, resize: 'vertical', lineHeight: '1.6',
                  borderColor: prefillDone && !userEdited.output && confidence.output >= 0.7 ? '#86efac' : '#e2e8f0',
                }}
              />
            </div>

            {/* 需求看板流转状态（当关联了需求时可直接切换需求状态列） */}
            {demandId && (
              <div>
                <label style={labelStyle}>
                  需求看板流转状态
                  <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '11px', marginLeft: '6px' }}>跟随本次记录实时切换需求在看板中的阶段列</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'active', label: '🟢 正常推进（进行中）' },
                    { key: 'hold', label: '🟡 Hold / 暂停挂起' },
                    { key: 'done', label: '✅ 全量上线 / 标记完成' },
                  ].map(st => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setNodeType(st.key === 'done' ? 'completion' : st.key === 'hold' ? 'blocker' : nodeType)}
                      onMouseDown={() => setDemandStatus(st.key)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: '8px', fontSize: '12px',
                        fontWeight: demandStatus === st.key ? '600' : '400',
                        border: `1.5px solid ${demandStatus === st.key ? '#6366f1' : '#e2e8f0'}`,
                        background: demandStatus === st.key ? '#eef2ff' : '#fff',
                        color: demandStatus === st.key ? '#4338ca' : '#64748b',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 卡点 */}
            <div>
              <label style={labelStyle}>
                卡点
                <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '11px', marginLeft: '4px' }}>遇到的问题或阻塞</span>
              </label>
              <textarea
                value={blocker}
                onChange={e => { setBlocker(e.target.value); markEdited('blocker'); }}
                placeholder="遇到什么阻塞、需要什么支持"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5', fontSize: '12px' }}
              />
            </div>

            {/* 待办 Todo 列表（支持多条 + 日历日期选择） */}
            <div>
              <label style={labelStyle}>
                待办
                <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '11px', marginLeft: '4px' }}>下一步行动计划</span>
              </label>
              <div style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px'
              }}>
                {todos.map((todo, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#cbd5e1', fontSize: '13px', flexShrink: 0 }}>☐</span>
                    <input
                      type="text"
                      value={todo.text}
                      onChange={e => handleTodoChange(idx, 'text', e.target.value)}
                      placeholder={idx === 0 ? '输入待办事项...' : '继续添加...'}
                      style={{
                        flex: 1, border: 'none', outline: 'none', fontSize: '12px',
                        padding: '4px 0', background: 'transparent', color: 'var(--text-primary)',
                        minWidth: 0,
                      }}
                    />
                    <input
                      type="date"
                      value={todo.dueDate}
                      min={todayStr}
                      onChange={e => handleTodoChange(idx, 'dueDate', e.target.value)}
                      title="选择截止日期"
                      style={{
                        fontSize: '11px',
                        fontWeight: '500',
                        border: todo.dueDate ? '1px solid #a7f3d0' : '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '3px 6px',
                        color: todo.dueDate ? '#065f46' : '#334155',
                        background: todo.dueDate ? '#ecfdf5' : '#ffffff',
                        cursor: 'pointer',
                        width: '126px',
                        flexShrink: 0,
                        outline: 'none',
                        boxShadow: todo.dueDate ? '0 1px 2px rgba(16,185,129,0.08)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    />
                    {todos.length > 1 && (
                      <span
                        onClick={() => handleRemoveTodo(idx)}
                        style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '14px', lineHeight: 1, flexShrink: 0 }}
                      >×</span>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddTodo}
                  style={{
                    fontSize: '11px', color: '#6366f1', cursor: 'pointer',
                    padding: '4px 8px', borderRadius: '4px', border: 'none',
                    background: 'transparent', textAlign: 'left', fontWeight: '500',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  添加待办
                </button>
              </div>
            </div>

            {/* 归档到 */}
            <div>
              <label style={labelStyle}>归档到</label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', background: '#fff', borderRadius: '8px',
                border: '1px solid #e2e8f0', minHeight: '38px'
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>📂</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {useCustomPath && customVaultPath ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '12px', color: '#0f172a', fontFamily: 'monospace',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                      }}>
                        {customVaultPath}
                      </span>
                      <span
                        onClick={() => { setUseCustomPath(false); setCustomVaultPath(''); }}
                        style={{ fontSize: '11px', color: '#6366f1', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        恢复默认
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '12px', color: '#64748b',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                      }}>
                        {defaultVaultPath || '未配置归档目录'}
                      </span>
                      <span style={{
                        fontSize: '10px', color: '#94a3b8', background: '#f1f5f9',
                        padding: '1px 6px', borderRadius: '3px', flexShrink: 0
                      }}>
                        默认
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSelectCustomDir}
                  style={{
                    fontSize: '11px', color: '#6366f1', cursor: 'pointer',
                    padding: '4px 8px', borderRadius: '4px',
                    border: '1px solid #e0e7ff', background: '#f5f3ff',
                    whiteSpace: 'nowrap', flexShrink: 0, fontWeight: '500'
                  }}
                >
                  选择文件夹
                </button>
              </div>
            </div>

            {/* 标签 */}
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>
                标签
                {tags.length > 0 && !userEdited.tags && lastParsedTitleRef.current && (
                  <span style={{ fontSize: 9, color: '#10b981', fontWeight: 400, marginLeft: 6, background: 'rgba(16,185,129,0.08)', padding: '1px 5px', borderRadius: 3 }}>
                    ✦ 自动识别
                  </span>
                )}
              </label>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px',
                padding: '8px 10px', background: '#fff', borderRadius: '8px',
                border: '1px solid #e2e8f0', minHeight: '38px', alignItems: 'center'
              }}>
                {tags.map(tag => (
                  <span key={tag} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', background: 'rgba(245, 158, 11, 0.1)',
                    color: '#d97706', borderRadius: '4px', fontSize: '12px', fontWeight: '500'
                  }}>
                    #{tag}
                    <span
                      onClick={() => handleRemoveTag(tag)}
                      style={{ cursor: 'pointer', fontSize: '14px', lineHeight: 1, color: '#94a3b8' }}
                    >×</span>
                  </span>
                ))}
                <input
                  type="text" value={tagInput}
                  onChange={e => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                  onKeyDown={handleTagKeyDown}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                  placeholder={tags.length === 0 ? '输入标签，回车添加' : ''}
                  style={{
                    border: 'none', outline: 'none', fontSize: '12px',
                    flex: 1, minWidth: '80px', background: 'transparent'
                  }}
                />
              </div>
              {showTagSuggestions && filteredTags.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginTop: '4px',
                  maxHeight: '150px', overflowY: 'auto'
                }}>
                  {filteredTags.map(tag => (
                    <div
                      key={tag}
                      onMouseDown={() => handleAddTag(tag)}
                      style={{
                        padding: '8px 12px', fontSize: '12px', cursor: 'pointer',
                        color: '#475569', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: '#94a3b8' }}>#</span>
                      {tag}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {prefillDone
              ? '✨ AI 已预填，请确认或修改后归档'
              : '归档记录将保存为 Markdown 文件'
            }
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px', borderRadius: '6px',
                border: '1px solid var(--border-color)', background: '#fff',
                color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', fontWeight: '500'
              }}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPrefilling}
              style={{
                padding: '8px 18px', borderRadius: '6px', border: 'none',
                background: isPrefilling ? '#fde68a' : '#f59e0b',
                color: '#fff', fontSize: '13px',
                cursor: isPrefilling ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                boxShadow: isPrefilling ? 'none' : '0 2px 6px rgba(245, 158, 11, 0.3)'
              }}
            >
              确认归档
            </button>
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes voicePulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
            50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          }
          @keyframes voiceWave {
            from { height: 4px; }
            to { height: 20px; }
          }
        `}</style>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: '12px', color: 'var(--text-secondary)',
  fontWeight: '500', marginBottom: '6px', display: 'flex', alignItems: 'center'
};

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: '8px',
  border: '1px solid #e2e8f0', fontSize: '13px',
  outline: 'none', background: '#fff', color: 'var(--text-primary)',
  transition: 'border-color 0.15s ease'
};
