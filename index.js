// ========================================================================
// 记忆表格 v1.3.7
// SillyTavern 记忆管理系统 - 提供表格化记忆、自动总结、批量填表等功能
// ========================================================================
(function () {
    'use strict';

    // ===== 初始化全局对象（必须在最开始，供 prompt_manager.js 使用）=====
    window.Gaigai = window.Gaigai || {};

    // ===== 防重复加载检查 =====
    if (window.GaigaiLoaded) {
        console.warn('⚠️ 记忆表格已加载，跳过重复初始化');
        return;
    }
    window.GaigaiLoaded = true;

    console.log('🚀 记忆表格 v1.3.7 启动');

    // ===== 防止配置被后台同步覆盖的标志 =====
    window.isEditingConfig = false;

    // ==================== 全局常量定义 ====================
    const V = 'v1.3.7';
    const SK = 'gg_data';              // 数据存储键
    const UK = 'gg_ui';                // UI配置存储键
    const AK = 'gg_api';               // API配置存储键
    const CK = 'gg_config';            // 通用配置存储键
    const CWK = 'gg_col_widths';       // 列宽存储键
    const SMK = 'gg_summarized';       // 已总结行标记存储键
    const REPO_PATH = 'gaigai315/ST-Memory-Context';  // GitHub仓库路径

    // ===== UI主题配置 =====
    let UI = { c: '#dfdcdcff', bc: '#ffffff', tc: '#000000ff', darkMode: false };

    // ==================== 用户配置对象 ====================
    const C = {
        enabled: true,
        filterTags: '',
        filterMode: 'blacklist', // 'blacklist' (屏蔽) 或 'whitelist' (仅保留)
        contextLimit: false,
        contextLimitCount: 30,
        uiFold: false,
        uiFoldCount: 50,
        tableInj: true,
        tablePos: 'system',
        tablePosType: 'system_end',
        tableDepth: 0,
        autoSummary: false,
        autoSummaryFloor: 50,
        autoSummaryPrompt: false,      // 自动总结发起模式（true=静默发起，false=弹窗确认）
        autoSummarySilent: false,      // 自动总结完成模式（true=静默保存，false=弹窗编辑）
        autoSummaryDelay: false,       // 自动总结-延迟开关
        autoSummaryDelayCount: 5,      // 自动总结-延迟层数
        autoBackfill: false,
        autoBackfillFloor: 10,
        autoBackfillPrompt: false,     // 批量填表发起模式（true=静默发起，false=弹窗确认）
        autoBackfillSilent: false,     // 批量填表完成模式（true=静默保存，false=弹窗显示结果）
        autoBackfillDelay: false,      // 批量填表-延迟开关
        autoBackfillDelayCount: 5,     // 批量填表-延迟层数
        log: true,
        pc: true,
        hideTag: true,
        filterHistory: true,
        cloudSync: true,
        syncWorldInfo: false,          // 同步总结到世界书
        customTables: null             // 用户自定义表格结构（格式同 DEFAULT_TABLES）
    };

    // ==================== API配置对象 ====================
    // 用于独立API调用（批量填表、自动总结等AI功能）
    let API_CONFIG = {
        enableAI: false,
        useIndependentAPI: false,
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gemini-2.5-pro',
        temperature: 0.7,
        maxTokens: 65536,
        summarySource: 'chat', // ✅ 默认改为聊天历史，符合大多数用户直觉
        lastSummaryIndex: 0,
        lastBackfillIndex: 0
    };

    // ========================================================================
    // ⚠️ 提示词管理已迁移到 prompt_manager.js
    // 通过 window.Gaigai.PromptManager 访问提示词相关功能
    // ========================================================================


    // ========================================================================
    // 全局正则表达式和表格结构定义
    // ========================================================================

    // ----- Memory标签识别正则 -----
    const MEMORY_TAG_REGEX = /<(Memory|GaigaiMemory|memory|tableEdit|gaigaimemory|tableedit)>([\s\S]*?)<\/\1>/gi;

    // ----- 表格结构定义（9个表格） -----
    // ==================== 默认表格定义（出厂设置模板） ====================
    const DEFAULT_TABLES = [
        { n: '主线剧情', c: ['日期', '开始时间', '完结时间', '事件概要', '状态'] },
        { n: '支线追踪', c: ['状态', '支线名', '开始时间', '完结时间', '事件追踪', '关键NPC'] },
        { n: '角色状态', c: ['角色名', '状态变化', '时间', '原因', '当前位置'] },
        { n: '人物档案', c: ['姓名', '年龄', '身份', '地点', '性格', '备注'] },
        { n: '人物关系', c: ['角色A', '角色B', '关系描述', '情感态度'] },
        { n: '世界设定', c: ['设定名', '类型', '详细说明', '影响范围'] },
        { n: '物品追踪', c: ['物品名称', '物品描述', '当前位置', '持有者', '状态', '重要程度', '备注'] },
        { n: '约定', c: ['约定时间', '约定内容', '核心角色'] },
        { n: '记忆总结', c: ['表格类型', '总结内容'] }
    ];

    // ----- 默认列宽配置（单位：像素） -----
    const DEFAULT_COL_WIDTHS = {
        // 0号表：主线
        0: { '日期': 90, '开始时间': 80, '完结时间': 80, '状态': 60 },
        // 1号表：支线 (你觉得太宽的就是这里)
        1: { '状态': 60, '支线名': 100, '开始时间': 80, '完结时间': 80, '事件追踪': 150, '关键NPC': 80 },
        // 其他表默认改小
        2: { '时间': 100 },
        3: { '年龄': 40 },
        6: { '状态': 60, '重要程度': 60 },
        7: { '约定时间': 100 },
        8: { '表格类型': 100 }
    };

    // ========================================================================
    // 全局运行时变量
    // ========================================================================
    let userColWidths = {};        // 用户自定义列宽
    let userRowHeights = {};       // 用户自定义行高
    let summarizedRows = {};       // 已总结的行索引（用于标记绿色）
    let pageStack = [];
    let snapshotHistory = {}; // ✅ 存储每条消息的快照
    // 🔐【新增】用来存储所有会话的独立快照数据，key为chatId，实现会话隔离
    window.GaigaiSnapshotStore = window.GaigaiSnapshotStore || {};
    let lastProcessedMsgIndex = -1; // ✅ 最后处理的消息索引
    let isRegenerating = false; // ✅ 标记是否正在重新生成
    let deletedMsgIndex = -1; // ✅ 记录被删除的消息索引
    let processedMessages = new Set(); // ✅✅ 新增：防止重复处理同一消息
    let pendingTimers = {}; // ✅✅ 新增：追踪各楼层的延迟定时器，防止重Roll竞态
    let beforeGenerateSnapshotKey = null;
    let lastManualEditTime = 0; // ✨ 新增：记录用户最后一次手动编辑的时间
    let lastInternalSaveTime = 0;
    let isSummarizing = false;
    let isInitCooling = true; // ✨ 初始化冷却：防止刚加载页面时自动触发任务
    let saveChatDebounceTimer = null; // 🧹 性能优化：saveChat 防抖计时器
    let isChatSwitching = false; // 🔒 性能优化：会话切换锁，防止卡顿期间误操作

    // 🛡️ [辅助函数] 更新 lastManualEditTime 并同步到 window
    // 确保内部变量和外部模块（backfill_manager.js）的 window.lastManualEditTime 保持同步
    function updateLastManualEditTime() {
        const now = Date.now();
        lastManualEditTime = now;
        window.lastManualEditTime = now;
    }

    // ========================================================================
    // ========== 工具函数区：弹窗、CSRF令牌等辅助功能 ==========
    // ========================================================================

    /**
     * 自定义提示弹窗 (主题跟随)
     * @param {string} message - 提示信息
     * @param {string} title - 弹窗标题
     * @returns {Promise<void>}
     */
    function customAlert(message, title = '提示') {
        return new Promise((resolve) => {
            const id = 'custom-alert-' + Date.now();

            // 🌙 Dark Mode: 动态颜色
            const isDark = UI.darkMode;
            const dialogBg = isDark ? '#1e1e1e' : '#fff';
            const headerBg = isDark ? '#252525' : UI.c;
            const headerColor = isDark ? '#e0e0e0' : (UI.tc || '#ffffff');
            const bodyColor = isDark ? '#e0e0e0' : '#333';
            const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#eee';
            const btnBg = isDark ? '#252525' : UI.c;
            const btnColor = isDark ? '#e0e0e0' : (UI.tc || '#ffffff');

            const $overlay = $('<div>', {
                id: id,
                css: {
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.6)', zIndex: 20000005,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px', margin: 0
                }
            });

            const $dialog = $('<div>', {
                css: {
                    background: dialogBg, borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                    maxWidth: '500px', width: '90%',
                    maxHeight: '80vh', overflow: 'auto'
                }
            });

            const $header = $('<div>', {
                css: {
                    background: headerBg,
                    color: headerColor,
                    padding: '16px 20px', borderRadius: '12px 12px 0 0',
                    fontSize: '16px', fontWeight: '600'
                },
                text: title
            });

            const $body = $('<div>', {
                css: {
                    padding: '24px 20px', fontSize: '14px', lineHeight: '1.6',
                    color: bodyColor, whiteSpace: 'pre-wrap'
                },
                text: message
            });

            const $footer = $('<div>', {
                css: {
                    padding: '12px 20px', borderTop: `1px solid ${borderColor}`, textAlign: 'right'
                }
            });

            const $okBtn = $('<button>', {
                text: '确定',
                css: {
                    background: btnBg,
                    color: btnColor,
                    border: 'none', padding: '8px 24px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }
            }).on('click', () => {
                $overlay.remove();
                resolve(true);
            }).hover(
                function () { $(this).css('filter', 'brightness(0.9)'); },
                function () { $(this).css('filter', 'brightness(1)'); }
            );

            $footer.append($okBtn);
            $dialog.append($header, $body, $footer);
            $overlay.append($dialog);
            $('body').append($overlay);

            // ✅ [修复] 移除点击遮罩层关闭弹窗的功能，防止误操作
            // 只允许通过点击按钮或 ESC/Enter 键关闭
            // $overlay.on('click', (e) => {
            //     if (e.target === $overlay[0]) { $overlay.remove(); resolve(false); }
            // });

            $(document).on('keydown.' + id, (e) => {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    $(document).off('keydown.' + id); $overlay.remove(); resolve(true);
                }
            });
        });
    }

    /**
     * 自动任务确认弹窗（带顺延选项）
     * 用于批量填表和自动总结的发起前确认
     * @param {string} taskType - 任务类型 ('backfill'|'summary')
     * @param {number} currentFloor - 当前楼层数
     * @param {number} triggerFloor - 上次触发楼层
     * @param {number} threshold - 触发阈值
     * @returns {Promise<{action: 'confirm'|'cancel', postpone: number}>}
     */
    function showAutoTaskConfirm(taskType, currentFloor, triggerFloor, threshold) {
        return new Promise((resolve) => {
            const id = 'auto-task-confirm-' + Date.now();
            const taskName = taskType === 'backfill' ? '批量填表' : '楼层总结';
            const icon = taskType === 'backfill' ? '⚡' : '🤖';

            const message = `${icon} 已达到自动${taskName}触发条件！\n\n当前楼层：${currentFloor}\n上次记录：${triggerFloor}\n差值：${currentFloor - triggerFloor} 层（≥ ${threshold} 层触发）`;

            // 🌙 Dark Mode: 动态颜色
            const isDark = UI.darkMode;
            const dialogBg = isDark ? '#1e1e1e' : '#fff';
            const headerBg = isDark ? '#252525' : UI.c;
            const headerColor = isDark ? '#e0e0e0' : (UI.tc || '#ffffff');
            const bodyColor = isDark ? '#e0e0e0' : '#333';
            const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#eee';
            const inputBg = isDark ? '#333333' : '#ffffff';
            const inputBorder = isDark ? 'rgba(255,255,255,0.2)' : '#ddd';
            const labelColor = isDark ? '#aaa' : '#666';
            const btnBg = isDark ? '#252525' : UI.c;
            const btnColor = isDark ? '#e0e0e0' : (UI.tc || '#ffffff');
            const postponeBg = isDark ? 'rgba(255, 193, 7, 0.15)' : 'rgba(255, 193, 7, 0.1)';
            const postponeBorder = isDark ? 'rgba(255, 193, 7, 0.4)' : 'rgba(255, 193, 7, 0.3)';
            const postponeLabelColor = isDark ? '#ffb74d' : '#856404';

            const $overlay = $('<div>', {
                id: id,
                css: {
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    width: '100vw', height: '100vh',
                    background: 'transparent', // ✅ 变透明，不遮挡背景
                    zIndex: 10000000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px', margin: 0,
                    pointerEvents: 'none' // ✅ 关键：鼠标穿透，允许操作底层页面
                }
            });

            const $dialog = $('<div>', {
                css: {
                    background: dialogBg, borderRadius: '12px',
                    boxShadow: '0 5px 25px rgba(0,0,0,0.5)', // ✅ 增强阴影，因为没有黑色背景衬托
                    border: `1px solid ${borderColor}`, // ✅ 增加边框，增强辨识度
                    maxWidth: '450px', width: '90%',
                    maxHeight: '80vh', overflow: 'auto',
                    pointerEvents: 'auto' // ✅ 关键：恢复弹窗可交互
                }
            });

            const $header = $('<div>', {
                css: {
                    background: headerBg,
                    color: headerColor,
                    padding: '16px 20px', borderRadius: '12px 12px 0 0',
                    fontSize: '16px', fontWeight: '600'
                },
                text: `${icon} 自动${taskName}触发`
            });

            const $body = $('<div>', {
                css: {
                    padding: '24px 20px', fontSize: '14px', lineHeight: '1.6',
                    color: bodyColor
                }
            });

            const $message = $('<div>', {
                css: { whiteSpace: 'pre-wrap', marginBottom: '20px' },
                text: message
            });

            const $postponeSection = $('<div>', {
                css: {
                    background: postponeBg,
                    border: `1px solid ${postponeBorder}`,
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px'
                }
            });

            const $postponeLabel = $('<div>', {
                css: { fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: postponeLabelColor },
                text: '⏰ 临时顺延'
            });

            const $postponeInput = $('<div>', {
                css: { display: 'flex', alignItems: 'center', gap: '8px' }
            });

            const $input = $('<input>', {
                type: 'number',
                id: 'postpone-floors',
                value: '0',
                min: '0',
                max: '100',
                css: {
                    width: '80px',
                    padding: '6px',
                    border: `1px solid ${inputBorder}`,
                    borderRadius: '4px',
                    textAlign: 'center',
                    fontSize: '14px',
                    background: inputBg,
                    color: bodyColor
                }
            });

            const $inputLabel = $('<span>', {
                css: { fontSize: '13px', color: labelColor },
                text: '楼（0=立即执行，>0=延后N楼）'
            });

            $postponeInput.append($input, $inputLabel);
            $postponeSection.append($postponeLabel, $postponeInput);
            $body.append($message, $postponeSection);

            const $footer = $('<div>', {
                css: {
                    padding: '12px 20px', borderTop: `1px solid ${borderColor}`, textAlign: 'right',
                    display: 'flex', justifyContent: 'flex-end', gap: '10px'
                }
            });

            const $cancelBtn = $('<button>', {
                text: '取消',
                css: {
                    background: '#6c757d', color: '#ffffff',
                    border: 'none', padding: '8px 24px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }
            }).on('click', () => { $overlay.remove(); resolve({ action: 'cancel' }); });

            const $confirmBtn = $('<button>', {
                text: '确定',
                css: {
                    background: btnBg,
                    color: btnColor,
                    border: 'none', padding: '8px 24px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }
            }).on('click', () => {
                const postpone = parseInt($('#postpone-floors').val()) || 0;
                $overlay.remove();
                resolve({ action: 'confirm', postpone: postpone });
            });

            $cancelBtn.hover(function () { $(this).css('filter', 'brightness(0.9)') }, function () { $(this).css('filter', 'brightness(1)') });
            $confirmBtn.hover(function () { $(this).css('filter', 'brightness(0.9)') }, function () { $(this).css('filter', 'brightness(1)') });

            $footer.append($cancelBtn, $confirmBtn);
            $dialog.append($header, $body, $footer);
            $overlay.append($dialog);
            $('body').append($overlay);

            // ✅ 移除点击遮罩关闭的逻辑，因为遮罩层现在是穿透的，点击空白处应该操作底层页面

            $(document).on('keydown.' + id, (e) => {
                if (e.key === 'Escape') {
                    $(document).off('keydown.' + id);
                    $overlay.remove();
                    resolve({ action: 'cancel' });
                }
                else if (e.key === 'Enter') {
                    $(document).off('keydown.' + id);
                    const postpone = parseInt($('#postpone-floors').val()) || 0;
                    $overlay.remove();
                    resolve({ action: 'confirm', postpone: postpone });
                }
            });
        });
    }

    // ===== CSRF令牌缓存 =====
    let cachedCsrfToken = null;
    let csrfTokenCacheTime = 0;
    const CSRF_CACHE_LIFETIME = 60000; // 60秒缓存时间

    /**
     * 获取CSRF令牌（带缓存机制）
     * @returns {Promise<string>} CSRF令牌
     */
    async function getCsrfToken() {
        // 尝试从全局变量获取（兼容部分酒馆版本）
        if (typeof window.getRequestHeaders === 'function') {
            const headers = window.getRequestHeaders();
            if (headers['X-CSRF-Token']) return headers['X-CSRF-Token'];
        }

        const now = Date.now();
        if (cachedCsrfToken && (now - csrfTokenCacheTime < CSRF_CACHE_LIFETIME)) {
            return cachedCsrfToken;
        }

        try {
            const response = await fetch('/csrf-token');
            if (!response.ok) throw new Error('CSRF fetch failed');
            const data = await response.json();
            cachedCsrfToken = data.token;
            csrfTokenCacheTime = now;
            return data.token;
        } catch (error) {
            console.error('❌ 获取CSRF令牌失败:', error);
            // 最后的兜底：如果获取失败，返回空字符串，有时酒馆后端在某些配置下不需要
            return '';
        }
    }

    // ========================================================================
    // ✨ 世界书同步：V5.5 终极防截断版 (延迟读取策略)
    // 改进点：防抖(5s) -> 强制等待(3s) -> 【这才开始读取数据】 -> 写入
    // ========================================================================
    let syncDebounceTimer = null;
    let globalLastWorldInfoUid = -1;
    let globalWorldInfoEntriesCache = {};
    let worldInfoSyncQueue = Promise.resolve();

    async function syncToWorldInfo(content) {
        // 1. 基础检查
        if (!C.syncWorldInfo) return Promise.resolve();

        // 2. 防抖：重置倒计时
        if (syncDebounceTimer) {
            clearTimeout(syncDebounceTimer);
            console.log('⏳ [世界书同步] 倒计时重置 (5s)...');
        }

        // 3. 设置 5秒 防抖 (给AI生成留足时间)
        syncDebounceTimer = setTimeout(async () => {
            try {
                // 🛑 步骤 A: 先进行强制等待 (IO缓冲)
                // 这里的 5000ms 不仅是为了防文件锁，更是为了让数据彻底落稳
                console.log('⏳ [IO缓冲] 等待 5秒，确保数据完整并释放锁...');
                await new Promise(r => setTimeout(r, 5000)); 

                // 🔄 步骤 B: 等待结束后，再获取表格数据！(关键修改)
                // 这样能确保我们读到的是等待结束后的最新、最全的数据
                const summarySheet = m.get(8);
                if (!summarySheet || summarySheet.r.length === 0) {
                    console.log('⚠️ [世界书同步] 表格为空，跳过');
                    return;
                }

                console.log(`⚡ [世界书同步] 开始打包 ${summarySheet.r.length} 条数据...`);

                // --- 准备数据 ---
                const uniqueId = m.gid() || "Unknown_Chat";
                const safeName = uniqueId.replace(/[\\/:*?"<>|]/g, "_");
                const worldBookName = "Memory_Context_" + safeName;
                const importEntries = {};
                let maxUid = -1;

                // 构建全量数据
                summarySheet.r.forEach((row, index) => {
                    const uid = index;
                    maxUid = uid;
                    const title = row[0] || '无标题';
                    const rowContent = row[1] || '';
                    const note = (row[2] && row[2].trim()) ? ` [${row[2]}]` : '';

                    importEntries[uid] = {
                        uid: uid,
                        key: ["总结", "summary", "前情提要", "memory", "记忆"],
                        keysecondary: [],
                        comment: `[绑定对话: ${safeName}] 自动同步于 ${new Date().toLocaleString()}`,
                        content: `【${title}${note}】\n${rowContent}`,
                        constant: true,
                        vectorized: false,
                        enabled: true,
                        position: 1,
                        order: 100,
                        extensions: { position: 1, exclude_recursion: false, display_index: 0, probability: 100, useProbability: true }
                    };
                });

                const finalJson = { entries: importEntries, name: worldBookName };
                
                // 获取 CSRF
                let csrfToken = '';
                try { csrfToken = await getCsrfToken(); } catch (e) {}

                // --- 4. 尝试删除 (规避弹窗) ---
                try {
                    const delRes = await fetch('/api/worldinfo/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify({ name: worldBookName })
                    });

                    if (!delRes.ok) {
                        console.warn(`⚠️ [世界书同步] 删除旧文件返回 ${delRes.status}，可能文件被占用，尝试直接覆盖...`);
                    }
                } catch (e) {
                    console.warn('⚠️ [世界书同步] 删除请求异常，尝试直接覆盖:', e);
                }

                // 🛑 核心修复：给文件系统喘息时间，防止 500 错误导致的连带写入失败
                console.log('⏳ [IO缓冲] 等待文件句柄释放 (1.5s)...');
                await new Promise(r => setTimeout(r, 1500));

                // --- 5. 前端模拟上传 (触发UI刷新) ---
                console.log('⚡ [世界书同步] 准备写入 JSON，大小:', JSON.stringify(finalJson).length);
                const $fileInput = $('#world_import_file');
                if ($fileInput.length > 0) {
                    const file = new File([JSON.stringify(finalJson)], `${worldBookName}.json`, { type: "application/json" });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    $fileInput[0].files = dataTransfer.files;

                    console.log('⚡ [世界书同步] 触发前端刷新');
                    $fileInput[0].dispatchEvent(new Event('change', { bubbles: true }));
                    $fileInput.trigger('change');
                }

                // 更新缓存
                globalWorldInfoEntriesCache = importEntries;
                globalLastWorldInfoUid = maxUid;

            } catch (error) {
                console.error('❌ [世界书同步] 异常:', error);
            }
        }, 5000); // 5秒防抖

        return Promise.resolve();
    }

    /**
     * 自定义确认弹窗 (主题跟随)
     * @param {string} message - 确认信息
     * @param {string} title - 弹窗标题
     * @returns {Promise<boolean>} - true=确认, false=取消
     */
    function customConfirm(message, title = '确认') {
        return new Promise((resolve) => {
            const id = 'custom-confirm-' + Date.now();

            // 🌙 Dark Mode: 动态颜色
            const isDark = UI.darkMode;
            const dialogBg = isDark ? '#1e1e1e' : '#fff';
            const headerBg = isDark ? '#252525' : UI.c;
            const headerColor = isDark ? '#e0e0e0' : (UI.tc || '#ffffff');
            const bodyColor = isDark ? '#e0e0e0' : '#333';
            const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#eee';
            const btnBg = isDark ? '#252525' : UI.c;
            const btnColor = isDark ? '#e0e0e0' : (UI.tc || '#ffffff');

            const $overlay = $('<div>', {
                id: id,
                css: {
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.6)', zIndex: 20000005,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px', margin: 0
                }
            });

            const $dialog = $('<div>', {
                css: {
                    background: dialogBg, borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                    maxWidth: '500px', width: '90%',
                    maxHeight: '80vh', overflow: 'auto'
                }
            });

            const $header = $('<div>', {
                css: {
                    background: headerBg,
                    color: headerColor,
                    padding: '16px 20px', borderRadius: '12px 12px 0 0',
                    fontSize: '16px', fontWeight: '600'
                },
                text: title
            });

            const $body = $('<div>', {
                css: {
                    padding: '24px 20px', fontSize: '14px', lineHeight: '1.6',
                    color: bodyColor, whiteSpace: 'pre-wrap'
                },
                text: message
            });

            const $footer = $('<div>', {
                css: {
                    padding: '12px 20px', borderTop: `1px solid ${borderColor}`, textAlign: 'right',
                    display: 'flex', justifyContent: 'flex-end', gap: '10px'
                }
            });

            const $cancelBtn = $('<button>', {
                text: '取消',
                css: {
                    background: '#6c757d', color: '#ffffff',
                    border: 'none', padding: '8px 24px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }
            }).on('click', () => { $overlay.remove(); resolve(false); });

            const $okBtn = $('<button>', {
                text: '确定',
                css: {
                    background: btnBg,
                    color: btnColor,
                    border: 'none', padding: '8px 24px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }
            }).on('click', () => { $overlay.remove(); resolve(true); });

            // 悬停效果
            $cancelBtn.hover(function () { $(this).css('filter', 'brightness(0.9)') }, function () { $(this).css('filter', 'brightness(1)') });
            $okBtn.hover(function () { $(this).css('filter', 'brightness(0.9)') }, function () { $(this).css('filter', 'brightness(1)') });

            $footer.append($cancelBtn, $okBtn);
            $dialog.append($header, $body, $footer);
            $overlay.append($dialog);
            $('body').append($overlay);

            // ✅ [修复] 移除点击遮罩层关闭弹窗的功能，防止误操作
            // 只允许通过点击按钮或 ESC/Enter 键关闭
            // $overlay.on('click', (e) => {
            //     if (e.target === $overlay[0]) { $overlay.remove(); resolve(false); }
            // });

            $(document).on('keydown.' + id, (e) => {
                if (e.key === 'Escape') { $(document).off('keydown.' + id); $overlay.remove(); resolve(false); }
                else if (e.key === 'Enter') { $(document).off('keydown.' + id); $overlay.remove(); resolve(true); }
            });
        });
    }

    // ✅✅✅ [新增] AI 生成失败重试弹窗
    function customRetryAlert(message, title = '⚠️ 生成失败') {
        return new Promise((resolve) => {
            const id = 'custom-retry-' + Date.now();

            // 🌙 Dark Mode: 动态颜色
            const isDark = UI.darkMode;
            const dialogBg = isDark ? '#1e1e1e' : '#fff';
            const bodyColor = isDark ? '#e0e0e0' : '#333';
            const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#eee';

            const $overlay = $('<div>', {
                id: id,
                css: {
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.6)', zIndex: 20000005,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px', margin: 0
                }
            });

            const $dialog = $('<div>', {
                css: {
                    background: dialogBg, borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                    maxWidth: '500px', width: '90%',
                    maxHeight: '80vh', overflow: 'auto'
                }
            });

            const $header = $('<div>', {
                css: {
                    background: '#dc3545', // 红色警告背景
                    color: '#ffffff',
                    padding: '16px 20px', borderRadius: '12px 12px 0 0',
                    fontSize: '16px', fontWeight: '600'
                },
                text: title
            });

            const $body = $('<div>', {
                css: {
                    padding: '24px 20px', fontSize: '14px', lineHeight: '1.6',
                    color: bodyColor, whiteSpace: 'pre-wrap'
                },
                text: message
            });

            const $footer = $('<div>', {
                css: {
                    padding: '12px 20px', borderTop: `1px solid ${borderColor}`, textAlign: 'right',
                    display: 'flex', justifyContent: 'flex-end', gap: '10px'
                }
            });

            const $cancelBtn = $('<button>', {
                text: '🚫 放弃',
                css: {
                    background: '#6c757d', color: '#ffffff',
                    border: 'none', padding: '8px 24px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }
            }).on('click', () => { $overlay.remove(); resolve(false); });

            const $retryBtn = $('<button>', {
                text: '🔄 重试',
                css: {
                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', // 橙色醒目按钮
                    color: '#ffffff',
                    border: 'none', padding: '8px 24px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                    fontWeight: '600'
                }
            }).on('click', () => { $overlay.remove(); resolve(true); });

            // 悬停效果
            $cancelBtn.hover(function () { $(this).css('filter', 'brightness(0.9)') }, function () { $(this).css('filter', 'brightness(1)') });
            $retryBtn.hover(function () { $(this).css('filter', 'brightness(1.1)') }, function () { $(this).css('filter', 'brightness(1)') });

            $footer.append($cancelBtn, $retryBtn);
            $dialog.append($header, $body, $footer);
            $overlay.append($dialog);
            $('body').append($overlay);

            // ✅ [修复] 移除点击遮罩层关闭弹窗的功能，防止误操作
            // 只允许通过点击按钮或 ESC 键关闭
            // $overlay.on('click', (e) => {
            //     if (e.target === $overlay[0]) { $overlay.remove(); resolve(false); }
            // });

            $(document).on('keydown.' + id, (e) => {
                if (e.key === 'Escape') { $(document).off('keydown.' + id); $overlay.remove(); resolve(false); }
                else if (e.key === 'Enter') { $(document).off('keydown.' + id); $overlay.remove(); resolve(true); }
            });
        });
    }

    // ✅✅✅ [新增] 总结表删除选项弹窗
    /**
     * 总结表删除选项弹窗
     * @param {number} currentPage - 当前页码（从1开始）
     * @param {number} totalPages - 总页数
     * @returns {Promise<string|null>} - 'current'=删除当前页, 'all'=删除全部, null=取消
     */
    function showDeleteOptionsDialog(currentPage, totalPages) {
        return new Promise((resolve) => {
            const id = 'delete-options-' + Date.now();

            // 🌙 Dark Mode: 动态颜色
            const isDark = UI.darkMode;
            const dialogBg = isDark ? '#1e1e1e' : '#fff';
            const bodyColor = isDark ? '#e0e0e0' : '#333';
            const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#eee';

            const $overlay = $('<div>', {
                id: id,
                css: {
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.6)', zIndex: 20000005,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px', margin: 0
                }
            });

            const $dialog = $('<div>', {
                css: {
                    background: dialogBg, borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                    maxWidth: '500px', width: '90%',
                    maxHeight: '80vh', overflow: 'auto'
                }
            });

            const $header = $('<div>', {
                css: {
                    background: '#dc3545', // 红色警告背景
                    color: '#ffffff',
                    padding: '16px 20px', borderRadius: '12px 12px 0 0',
                    fontSize: '16px', fontWeight: '600'
                },
                text: '🗑️ 删除总结'
            });

            const $body = $('<div>', {
                css: {
                    padding: '24px 20px', fontSize: '14px', lineHeight: '1.6',
                    color: bodyColor
                }
            });

            const infoText = $('<div>', {
                css: { marginBottom: '16px', whiteSpace: 'pre-wrap' },
                text: `当前第 ${currentPage} 页，共 ${totalPages} 页总结\n\n请选择删除范围：`
            });

            const $footer = $('<div>', {
                css: {
                    padding: '12px 20px', borderTop: `1px solid ${borderColor}`, textAlign: 'right',
                    display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap'
                }
            });

            const $cancelBtn = $('<button>', {
                text: '✖️ 取消',
                css: {
                    background: '#6c757d', color: '#ffffff',
                    border: 'none', padding: '8px 20px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }
            }).on('click', () => { $overlay.remove(); resolve(null); });

            const $currentBtn = $('<button>', {
                text: `📄 删除当前页 (第${currentPage}页)`,
                css: {
                    background: '#ff9800', color: '#ffffff',
                    border: 'none', padding: '8px 20px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                    fontWeight: '600'
                }
            }).on('click', () => { $overlay.remove(); resolve('current'); });

            const $allBtn = $('<button>', {
                text: `🗑️ 删除全部 (${totalPages}页)`,
                css: {
                    background: '#dc3545', color: '#ffffff',
                    border: 'none', padding: '8px 20px', borderRadius: '6px',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                    fontWeight: '600'
                }
            }).on('click', () => { $overlay.remove(); resolve('all'); });

            // 悬停效果
            $cancelBtn.hover(function () { $(this).css('filter', 'brightness(0.9)') }, function () { $(this).css('filter', 'brightness(1)') });
            $currentBtn.hover(function () { $(this).css('filter', 'brightness(1.1)') }, function () { $(this).css('filter', 'brightness(1)') });
            $allBtn.hover(function () { $(this).css('filter', 'brightness(1.1)') }, function () { $(this).css('filter', 'brightness(1)') });

            $body.append(infoText);
            $footer.append($cancelBtn, $currentBtn, $allBtn);
            $dialog.append($header, $body, $footer);
            $overlay.append($dialog);
            $('body').append($overlay);

            // ✅ 不允许点击遮罩层关闭，防止误操作
            $(document).on('keydown.' + id, (e) => {
                if (e.key === 'Escape') {
                    $(document).off('keydown.' + id);
                    $overlay.remove();
                    resolve(null);
                }
            });
        });
    }

    // ✅✅✅ [新增] 分批总结配置弹窗
    // ✅✅✅ showBatchConfigDialog 已迁移到 summary_manager.js

    // ========================================================================
    // ========== 核心类定义：数据管理和存储 ==========
    // ========================================================================

    /**
     * 表格类 (Sheet)
     * 用于管理单个记忆表格的数据结构和操作
     * @property {string} n - 表格名称
     * @property {Array} c - 列名数组
     * @property {Array} r - 行数据数组
     */
    class S {
        constructor(n, c) { this.n = n; this.c = c; this.r = []; }
        upd(i, d) {
            if (i < 0) return;
            if (i === this.r.length) { this.r.push({}); }
            else if (i > this.r.length) { return; }

            Object.entries(d).forEach(([k, v]) => {
                // 🔥 修复：对于需要追加的列（主线剧情列3、支线追踪列4），增强去重逻辑
                if ((this.n === '主线剧情' && k == '3') || (this.n === '支线追踪' && k == '4')) {
                    if (this.r[i][k] && v) {
                        // 检查是否已包含相同内容
                        if (!this.r[i][k].includes(v.trim())) {
                            // 不包含 → 追加
                            this.r[i][k] += '；' + v.trim();
                        }
                        // 已包含或已追加 → 直接返回，不执行后面的覆盖逻辑
                        return;
                    }
                }
                // 对于非追加列，或追加列的首次赋值，直接覆盖
                this.r[i][k] = v;
            });
        }
        ins(d, insertAfterIndex = null) {
            if (insertAfterIndex !== null && insertAfterIndex >= 0 && insertAfterIndex < this.r.length) {
                // 在指定行的下方插入
                this.r.splice(insertAfterIndex + 1, 0, d);
            } else {
                // 默认追加到末尾
                this.r.push(d);
            }
        }
        del(i) { if (i >= 0 && i < this.r.length) this.r.splice(i, 1); }
        delMultiple(indices) {
            // 使用 Set 提高查找效率
            const toDelete = new Set(indices);
            // 重建数组：只保留不在删除名单里的行
            this.r = this.r.filter((_, index) => !toDelete.has(index));
        }
        clear() { this.r = []; }
        json() { return { n: this.n, c: this.c, r: this.r }; }
        from(d) { this.r = d.r || []; }

        // ✅ 过滤逻辑：只发未总结的行，但保留原始行号
        txt(ti) {
            if (this.r.length === 0) return '';
            let t = `【${this.n}】\n`;
            let visibleCount = 0;

            this.r.forEach((rw, ri) => {
                if (summarizedRows[ti] && summarizedRows[ti].includes(ri)) {
                    return; // 跳过绿色行
                }

                visibleCount++;
                // 🟢 重点：这里输出的是 ri (原始索引)，比如 [8], [9]
                t += `  [${ri}] `;
                this.c.forEach((cl, ci) => {
                    const v = rw[ci] || '';
                    if (v) t += `${cl}:${v} | `;
                });
                t += '\n';
            });

            if (visibleCount === 0) return '';
            return t;
        }
    }

    /**
     * 总结管理类 (Summary Manager)
     * 用于管理记忆总结的保存、加载和验证
     * @property {Object} m - 数据管理器引用
     */
    class SM {
        constructor(manager) { this.m = manager; }

        // ✅✅✅ 极简版保存逻辑：不合并，直接新增一行
        save(summaryData, note = "") {
            const sumSheet = this.m.get(8); // 获取第9个表格（索引8）即总结表

            // ✅ 【自动扩容】如果传入了备注，但总结表只有2列，自动添加第3列
            if (note && sumSheet.c.length < 3) {
                console.log('⚙️ [自动扩容] 检测到备注数据，但总结表只有2列，正在自动添加[备注]列...');

                // 1. 为表格实例添加列
                sumSheet.c.push("备注");

                // 2. 同步到全局配置 C.customTables
                // 如果 C.customTables 不存在或为空，先初始化它
                if (!C.customTables || !Array.isArray(C.customTables) || C.customTables.length === 0) {
                    // 基于当前 m.all() 的表格结构初始化 customTables
                    C.customTables = this.m.all().map(sheet => ({
                        n: sheet.n,
                        c: [...sheet.c]  // 深拷贝列数组
                    }));
                    console.log('📋 [自动扩容] 已初始化 C.customTables');
                }

                // 确保索引8存在且更新列定义
                if (C.customTables[8]) {
                    C.customTables[8].c = [...sumSheet.c];  // 同步列定义
                    console.log('✅ [自动扩容] C.customTables[8] 已更新为:', C.customTables[8].c);
                }

                // 3. 保存到 localStorage
                try {
                    localStorage.setItem(CK, JSON.stringify(C));
                    localStorage.setItem('gg_timestamp', Date.now().toString());  // ✅ 添加时间戳
                    console.log('💾 [自动扩容] 配置已保存到 localStorage');
                } catch (e) {
                    console.warn('⚠️ [自动扩容] localStorage 保存失败:', e);
                }

                // 4. 同步到云端
                if (typeof saveAllSettingsToCloud === 'function') {
                    saveAllSettingsToCloud().catch(err => {
                        console.warn('⚠️ [自动扩容] 云端同步失败:', err);
                    });
                    console.log('☁️ [自动扩容] 已触发云端同步');
                }

                console.log('✅ [自动扩容] 总结表已自动扩容至3列，备注功能已激活');
            }

            // 1. 处理内容，确保是纯文本
            let content = '';
            if (typeof summaryData === 'string') {
                content = summaryData.trim();
            } else if (Array.isArray(summaryData)) {
                // 防御性编程：万一传进来是数组，转成字符串
                content = summaryData.map(item => item.content || item).join('\n\n');
            }

            if (!content) return;

            // 2. 自动生成类型名称 (例如: 剧情总结 1, 剧情总结 2)
            // 逻辑：当前有多少行，下一个就是 N+1
            const nextIndex = sumSheet.r.length + 1;
            const typeName = `剧情总结 ${nextIndex}`;

            // 3. ✅ 增强：检查总结表是否有第 3 列（索引 2），支持备注功能
            const rowData = { 0: typeName, 1: content };

            // 扩容后，sumSheet.c.length 已经是 3，可以直接写入备注
            if (sumSheet.c.length > 2 && note) {
                rowData[2] = note;
                console.log(`📌 [总结保存] 自动填入备注: "${note}"`);
            }

            // 4. 插入新行
            sumSheet.ins(rowData);

            this.m.save();
        }

        // 读取逻辑也微调一下，让多条总结之间有间隔，方便AI理解
        load() {
            const sumSheet = this.m.get(8);
            if (!sumSheet || sumSheet.r.length === 0) return '';

            // 格式示例：
            // 【剧情总结 1】
            // ...内容...
            //
            // 【剧情总结 2】
            // ...内容...
            return sumSheet.r.map((row, i) => {
                // ✨✨✨ 核心修复：检查第 8 号表(总结表)的第 i 行是否被标记为隐藏
                // summarizedRows 是全局变量，存储了所有表格的隐藏行索引
                if (typeof summarizedRows !== 'undefined' && summarizedRows[8] && summarizedRows[8].includes(i)) {
                    return null; // 🚫 跳过被隐藏(变绿)的行
                }
                return `【${row[0] || '历史片段'}】\n${row[1] || ''}`;
            }).filter(t => t).join('\n\n');
        }

        // ✅✅✅ 升级版 loadArray：支持动态列 + 过滤隐藏行
        loadArray() {
            const sumSheet = this.m.get(8);
            if (!sumSheet || sumSheet.r.length === 0) return [];

            return sumSheet.r.map((row, i) => {
                // 🚫 过滤逻辑：检查是否被标记为隐藏（同 load() 方法）
                if (typeof summarizedRows !== 'undefined' && summarizedRows[8] && summarizedRows[8].includes(i)) {
                    return null; // 跳过隐藏的行
                }

                // 动态数据组装
                const type = row[0] || '综合'; // 第 0 列作为类型

                // 组合第 2 列及之后的所有列 + 第 1 列（正文）
                let content = '';

                // 1. 先处理第 2 列及之后的元数据列（如日期、天气等）
                const metaFields = [];
                for (let c = 2; c < row.length; c++) {
                    const value = row[c];
                    if (value && value.trim()) {
                        // 获取列名
                        const colName = sumSheet.c[c] || `列${c}`;
                        metaFields.push(`[${colName}: ${value}]`);
                    }
                }

                // 2. 如果有元数据，先拼接元数据，再加换行符
                if (metaFields.length > 0) {
                    content = metaFields.join(' ') + '\n';
                }

                // 3. 最后加上第 1 列的正文内容
                if (row[1] && row[1].trim()) {
                    content += row[1];
                }

                return { type, content: content.trim() };
            }).filter(item => item !== null); // 过滤掉被隐藏的行
        }
        clear() { this.m.get(8).clear(); this.m.save(); }
        has() { const s = this.m.get(8); return s.r.length > 0 && s.r[0][1]; }
    }

    /**
     * 数据管理器类 (Manager)
     * 核心类：管理所有表格数据的存储、加载、云同步等
     * 每个聊天对话有独立的实例（当开启角色独立存储时）
     * @property {Array} s - 所有表格实例数组
     * @property {string} id - 存储ID（chatId或charName_chatId）
     * @property {SM} sm - 总结管理器实例
     */
    class M {
        constructor() {
            this.s = [];
            this.id = null;
            this.initTables(DEFAULT_TABLES);
        }

        // 动态初始化表格结构（支持用户自定义）
        initTables(tableDefinitions, preserveData = true) {
            if (!tableDefinitions || !Array.isArray(tableDefinitions) || tableDefinitions.length === 0) {
                console.warn('⚠️ [initTables] 表格定义无效，使用默认结构');
                tableDefinitions = DEFAULT_TABLES;
            }

            // ✅ 1. 备份数据（仅在需要保留数据时）
            const backupData = [];
            if (preserveData) {
                if (this.s && Array.isArray(this.s)) {
                    this.s.forEach((sheet, index) => {
                        if (sheet && sheet.r && Array.isArray(sheet.r)) {
                            // 深拷贝行数据（使用 JSON 方式确保完全独立）
                            backupData[index] = JSON.parse(JSON.stringify(sheet.r));
                            console.log(`💾 [数据备份] 表${index} "${sheet.n}" 备份了 ${sheet.r.length} 行数据`);
                        }
                    });
                }
            }

            // ✅ 2. 清空当前表格
            this.s = [];

            // ✅ 3. 根据定义重新创建表格
            tableDefinitions.forEach(tb => {
                if (tb && tb.n && Array.isArray(tb.c)) {
                    this.s.push(new S(tb.n, tb.c));
                }
            });

            // ✅ 4. 恢复数据（仅在需要保留数据时）
            if (preserveData && backupData.length > 0) {
                this.s.forEach((newSheet, index) => {
                    if (backupData[index] && Array.isArray(backupData[index]) && backupData[index].length > 0) {
                        // 直接恢复行数据
                        newSheet.r = backupData[index];
                        console.log(`♻️ [数据恢复] 表${index} "${newSheet.n}" 恢复了 ${newSheet.r.length} 行数据`);
                    }
                });
            }

            // ✅ 5. 重新初始化总结管理器
            this.sm = new SM(this);

            console.log(`📋 [initTables] 已加载 ${this.s.length} 个表格:`, this.s.map(s => s.n).join(', '));
        }

        get(i) { return this.s[i]; }
        all() { return this.s; }

        // ✨✨✨ 核心修复：增强版熔断保护 (防止空数据覆盖)
        save(force = false) {
            const id = this.gid();
            if (!id) return;
            const ctx = this.ctx();
            
            // 计算当前内存中的总行数
            const totalRows = this.s.reduce((acc, sheet) => acc + (sheet.r ? sheet.r.length : 0), 0);

            // 🛑 [毁灭级熔断保护] 
            // 场景：用户打开酒馆，插件加载失败(内存为0)，但本地存档其实是有货的。
            // 此时如果触发自动保存，本地存档就会被清空。必须拦截！
            if (!force) {
                try {
                    const rawLocalData = localStorage.getItem(`${SK}_${id}`);
                    // 如果本地有存档
                    if (rawLocalData) {
                        const localData = JSON.parse(rawLocalData);
                        // 计算本地存档的行数
                        const localRows = localData.d ? localData.d.reduce((sum, sheet) => sum + (sheet.r ? sheet.r.length : 0), 0) : 0;

                        // ⚡️ 判定：如果本地有大量数据(>5行)，而当前内存几乎为空(<2行)
                        // 判定为“加载失败”，禁止覆盖保存！
                        if (localRows > 5 && totalRows < 2) {
                            console.error(`🛑 [严重熔断] 拦截了一次毁灭性保存！`);
                            console.error(`   原因：内存数据(${totalRows}行) 远少于 本地存档(${localRows}行)。可能因加载失败导致。`);
                            
                            // 仅提示一次，防止刷屏
                            if (!window.hasShownSaveWarning) {
                                if (typeof toastr !== 'undefined') toastr.error('⚠️ 数据加载异常，已阻止自动保存以保护存档！\n请尝试刷新页面。', '熔断保护');
                                window.hasShownSaveWarning = true;
                            }
                            return; // ⛔️ 终止保存
                        }
                    }
                } catch(e) { 
                    console.error('熔断检查出错', e); 
                }
            }

            const now = Date.now();
            lastInternalSaveTime = now;

            const data = {
                v: V,
                id: id,
                ts: now,
                d: this.s.map(sh => sh.json()),
                summarized: summarizedRows,
                colWidths: userColWidths,
                rowHeights: userRowHeights,
                // ✅ 新增：保存当前 API 进度指针到这个角色的存档里
                meta: {
                    lastSum: API_CONFIG.lastSummaryIndex,
                    lastBf: API_CONFIG.lastBackfillIndex
                },
                // ✅ Per-Chat Configuration: Save critical feature toggles for this chat
                config: {
                    enabled: C.enabled,
                    autoBackfill: C.autoBackfill,
                    autoSummary: C.autoSummary
                }
            };

            try { localStorage.setItem(`${SK}_${id}`, JSON.stringify(data)); } catch (e) { }
            
            // 云端同步逻辑 (保持不变)
            if (C.cloudSync) {
                try {
                    if (ctx && ctx.chatMetadata) {
                        ctx.chatMetadata.gaigai = data;
                        // 🧹 性能优化：使用 2 秒防抖
                        if (typeof ctx.saveChat === 'function') {
                            if (saveChatDebounceTimer) {
                                clearTimeout(saveChatDebounceTimer);
                            }
                            saveChatDebounceTimer = setTimeout(() => {
                                try {
                                    ctx.saveChat();
                                    // console.log('💾 [防抖保存] saveChat 已执行');
                                } catch (err) {
                                    console.error('❌ saveChat 执行失败:', err);
                                }
                            }, 2000); 
                        }
                    }
                } catch (e) { }
            }
        }

        // ✨✨✨ 核心修复：从角色存档恢复进度指针
        load() {
            const id = this.gid();
            if (!id) return;

            // ✅ Per-Chat Configuration: STEP 1 - Reset to Global Defaults
            // Always reload global config from localStorage to avoid carrying over settings from previous chat
            try {
                const globalConfigStr = localStorage.getItem(CK);
                if (globalConfigStr) {
                    const globalConfig = JSON.parse(globalConfigStr);
                    // Reset critical toggles to global defaults
                    if (globalConfig.enabled !== undefined) C.enabled = globalConfig.enabled;
                    if (globalConfig.autoBackfill !== undefined) C.autoBackfill = globalConfig.autoBackfill;
                    if (globalConfig.autoSummary !== undefined) C.autoSummary = globalConfig.autoSummary;
                    console.log('🔄 [配置重置] 已加载全局默认配置');
                }
            } catch (e) {
                console.warn('⚠️ [配置加载] 读取全局配置失败:', e);
            }

            if (this.id !== id) {
                // 🔄 检测到会话/角色切换，重置所有状态
                this.id = id;
                // 使用当前配置的表格结构（如有自定义则用自定义，否则用默认）
                const tableDef = (C.customTables && Array.isArray(C.customTables) && C.customTables.length > 0)
                    ? C.customTables
                    : DEFAULT_TABLES;
                this.initTables(tableDef, false); // 🔥 关键修复：切换会话时不保留旧数据
                lastInternalSaveTime = 0;
                summarizedRows = {}; // ✅ 核心修复：清空"已总结行"状态，防止跨会话串味
                userColWidths = {};   // ✅ 核心修复：清空列宽设置，防止跨会话串味
                userRowHeights = {};  // ✅ 核心修复：清空行高设置，防止跨会话串味

                // ✅ [修复] 会话切换时，重置进度指针（防止跨会话污染）
                API_CONFIG.lastSummaryIndex = 0;
                API_CONFIG.lastBackfillIndex = 0;
                localStorage.setItem(AK, JSON.stringify(API_CONFIG));

                console.log(`🔄 [会话切换] ID: ${id}，已重置所有状态 (包括已总结行、列宽、行高、进度指针)`);
            }
            let cloudData = null; let localData = null;
            if (C.cloudSync) { try { const ctx = this.ctx(); if (ctx && ctx.chatMetadata && ctx.chatMetadata.gaigai) cloudData = ctx.chatMetadata.gaigai; } catch (e) { } }

            // 🛡️ [防串味修复] 检查云端数据是否属于当前角色
            if (cloudData) {
                if (cloudData.id !== id) {
                    console.warn(`🔴 [数据隔离] 云端数据 ID 不匹配，已忽略。云端 ID: ${cloudData.id}，当前 ID: ${id}`);
                    cloudData = null; // 丢弃错误的云端数据，防止串味
                } else {
                    console.log(`✅ [数据验证] 云端数据 ID 匹配: ${id}`);
                }
            }

            try { const sv = localStorage.getItem(`${SK}_${id}`); if (sv) localData = JSON.parse(sv); } catch (e) { }

            // 🛡️ [防串味修复] 检查本地数据是否属于当前角色
            if (localData) {
                if (localData.id !== id) {
                    console.warn(`🔴 [数据隔离] 本地数据 ID 不匹配，已忽略。本地 ID: ${localData.id}，当前 ID: ${id}`);
                    localData = null; // 丢弃错误的本地数据，防止串味
                } else {
                    console.log(`✅ [数据验证] 本地数据 ID 匹配: ${id}`);
                }
            }

            let finalData = null;
            if (cloudData && localData) finalData = (cloudData.ts > localData.ts) ? cloudData : localData;
            else if (cloudData) finalData = cloudData;
            else if (localData) finalData = localData;

            if (finalData && finalData.ts <= lastInternalSaveTime) return;
            if (finalData && finalData.v && finalData.d) {
                finalData.d.forEach((sd, i) => { if (this.s[i]) this.s[i].from(sd); });
                if (finalData.summarized) summarizedRows = finalData.summarized;
                if (finalData.colWidths) userColWidths = finalData.colWidths;
                if (finalData.rowHeights) userRowHeights = finalData.rowHeights;

                // ✅ 恢复进度指针 (关键修复)
                if (finalData.meta) {
                    if (finalData.meta.lastSum !== undefined) API_CONFIG.lastSummaryIndex = finalData.meta.lastSum;
                    if (finalData.meta.lastBf !== undefined) API_CONFIG.lastBackfillIndex = finalData.meta.lastBf;

                    // 同步回全局配置，确保 shcf 显示正确
                    localStorage.setItem(AK, JSON.stringify(API_CONFIG));
                    console.log(`✅ [进度恢复] 总结指针: ${API_CONFIG.lastSummaryIndex}, 填表指针: ${API_CONFIG.lastBackfillIndex}`);
                }
                // ✅ [修复] 删除了旧版的强制归零逻辑
                // 如果存档中没有 meta 信息，保持当前内存中的配置不变
                // 这样可以兼容旧版存档，同时不会丢失用户的进度

                // ✅ Per-Chat Configuration: STEP 2 - Override with chat-specific config
                if (finalData.config) {
                    if (finalData.config.enabled !== undefined) C.enabled = finalData.config.enabled;
                    if (finalData.config.autoBackfill !== undefined) C.autoBackfill = finalData.config.autoBackfill;
                    if (finalData.config.autoSummary !== undefined) C.autoSummary = finalData.config.autoSummary;
                    console.log('✅ [每聊配置] 已加载此聊天的专属配置:', finalData.config);
                } else {
                    console.log('ℹ️ [每聊配置] 此聊天无专属配置，使用全局默认值');
                }

                lastInternalSaveTime = finalData.ts;
            }
            // ✅ [修复] 删除了 finalData 为 null 时强制归零的逻辑
            // 理由：
            // 1. 会话切换时已经在 1217-1220 行重置了进度指针
            // 2. 如果是同一会话但没有存档数据（例如临时加载失败），应该保持当前内存中的值
            // 3. 避免因临时性的数据读取失败而丢失用户的进度
        }

        gid() {
            try {
                const x = this.ctx();
                if (!x) return null;
                const chatId = x.chatMetadata?.file_name || x.chatId;
                if (!chatId) return null;
                if (C.pc) {
                    const charName = x.name2 || x.characterId;
                    if (!charName) return null;
                    return `${charName}_${chatId}`;
                }
                return chatId;
            } catch (e) { return null; }
        }

        ctx() { return (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null; }

        getTableText() { return this.s.slice(0, 8).map((s, i) => s.txt(i)).filter(t => t).join('\n'); }

        pmt() {
            let result = '';
            if (this.sm.has()) {
                result += '=== 📚 记忆总结（历史压缩数据，仅供参考） ===\n\n' + this.sm.load() + '\n\n=== 总结结束 ===\n\n';
            }

            const tableStr = this.s.slice(0, 8).map((s, i) => s.txt(i)).filter(t => t).join('\n');
            if (tableStr) {
                // ✅ 修改为：纯粹的状态描述，不带操作暗示，防止 AI 误解
                result += '【系统数据库：剧情记忆档案（仅供剧情参考，请勿在回复中生成此表格）】\n\n' + tableStr + '【记忆档案结束】\n';
            } else if (this.sm.has()) {
                result += '【系统数据库：剧情记忆档案（仅供剧情参考，请勿在回复中生成此表格）】\n\n⚠️ 所有详细数据已归档，当前可视为空。\n\n【记忆档案结束】\n';
            }

            // ✨✨✨ 核心修改：精简状态栏，只告诉 AI 下一个索引 ✨✨✨
            result += '\n[后台索引状态]\n';
            this.s.slice(0, 8).forEach((s, i) => {
                const displayName = i === 1 ? '支线追踪' : s.n;
                const nextIndex = s.r.length; // 下一个空位的索引
                result += `表${i} ${displayName}: ⏭️新增请用索引 ${nextIndex}\n`;
            });
            result += '[索引结束]\n';

            return result || '';
        }
    }

    // ✅✅ 快照管理系统（在类外面）
    function saveSnapshot(msgIndex) {
        try {
            const snapshot = {
                data: m.all().slice(0, 8).map(sh => JSON.parse(JSON.stringify(sh.json()))), // ✅ 只保存前8个表格，不保存总结表
                summarized: JSON.parse(JSON.stringify(summarizedRows)),
                timestamp: Date.now()
            };
            snapshotHistory[msgIndex] = snapshot;

            const totalRecords = snapshot.data.reduce((sum, s) => sum + s.r.length, 0);
            const details = snapshot.data.filter(s => s.r.length > 0).map(s => `${s.n}:${s.r.length}行`).join(', ');
            console.log(`📸 快照${msgIndex}已保存 - 共${totalRecords}条记录 ${details ? `[${details}]` : '[空]'}`);
        } catch (e) {
            console.error('❌ 快照保存失败:', e);
        }
    }

    // ✅✅✅ [新增] 强制更新当前快照 (用于手动编辑后的同步)
    function updateCurrentSnapshot() {
        try {
            const ctx = m.ctx();
            if (!ctx || !ctx.chat) return;

            // 获取当前最后一条消息的索引 (通常就是用户正在编辑的那条，或者是刚生成完的那条)
            const currentMsgIndex = ctx.chat.length - 1;
            if (currentMsgIndex < 0) return;

            // 立即保存一份最新的快照
            saveSnapshot(currentMsgIndex);
            console.log(`📝 [手动同步] 用户修改了表格，已更新快照: ${currentMsgIndex}`);
        } catch (e) {
            console.error('❌ 更新快照失败:', e);
        }
    }

    // ✅✅✅ [核心修复] 强力回档函数 (防止快照污染 - 深拷贝版)
    function restoreSnapshot(msgIndex) {
        try {
            // 1. 兼容处理：无论传入的是数字还是字符串，都统一处理
            const key = msgIndex.toString();
            const snapshot = snapshotHistory[key];

            if (!snapshot) {
                console.warn(`⚠️ [回档失败] 找不到快照ID: ${key}`);
                return false;
            }

            // 🛡️ [过期保护] 检查快照是否早于最后一次手动修改
            // 同步读取 window.lastManualEditTime（可能被 backfill_manager.js 更新）
            const currentManualEditTime = window.lastManualEditTime || lastManualEditTime;
            if (snapshot.timestamp < currentManualEditTime) {
                console.log(`🛡️ [保护] 检测到手动修改，跳过过时快照回滚 (快照:${new Date(snapshot.timestamp).toLocaleTimeString()}, 修改:${new Date(currentManualEditTime).toLocaleTimeString()})`);
                return false;
            }

            // 2. 先彻底清空当前表格，防止残留
            m.s.slice(0, 8).forEach(sheet => sheet.r = []);

            // 3. ✨✨✨ [关键修复] 强力深拷贝恢复 ✨✨✨
            // 旧代码是 m.s[i].from(sd)，这会导致当前表格和快照“连体”
            // 现在我们把快照里的数据“复印”一份全新的给表格，互不干扰
            snapshot.data.forEach((sd, i) => {
                if (i < 8 && m.s[i]) {
                    // 创建复印件，而不是直接引用
                    const deepCopyData = JSON.parse(JSON.stringify(sd));
                    m.s[i].from(deepCopyData);
                }
            });

            // 4. 恢复总结状态 (同样深拷贝)
            if (snapshot.summarized) {
                summarizedRows = JSON.parse(JSON.stringify(snapshot.summarized));
            } else {
                summarizedRows = {};
            }

            // 5. 强制锁定保存，防止被酒馆的自动保存覆盖
            lastManualEditTime = 0;
            m.save();

            const totalRecords = m.s.reduce((sum, s) => sum + s.r.length, 0);
            console.log(`✅ [完美回档] 快照${key}已恢复 (深拷贝模式，拒绝污染) - 当前行数:${totalRecords}`);

            return true;
        } catch (e) {
            console.error('❌ 快照恢复失败:', e);
            return false;
        }
    }

    function cleanOldSnapshots() {
        const allKeys = Object.keys(snapshotHistory);

        // ✅ 分别统计before和after快照
        const beforeKeys = allKeys.filter(k => k.startsWith('before_')).sort();
        const afterKeys = allKeys.filter(k => k.startsWith('after_')).sort();

        // 保留最近30对快照
        const maxPairs = 30;

        if (beforeKeys.length > maxPairs) {
            const toDeleteBefore = beforeKeys.slice(0, beforeKeys.length - maxPairs);
            toDeleteBefore.forEach(key => delete snapshotHistory[key]);
            console.log(`🧹 已清理 ${toDeleteBefore.length} 个旧before快照`);
        }

        if (afterKeys.length > maxPairs) {
            const toDeleteAfter = afterKeys.slice(0, afterKeys.length - maxPairs);
            toDeleteAfter.forEach(key => delete snapshotHistory[key]);
            console.log(`🧹 已清理 ${toDeleteAfter.length} 个旧after快照`);
        }
    }

    function parseOpenAIModelsResponse(data) {
        /** @type {any[]} */
        let rawModels = [];
        try {
            // 1) 顶层数组
            if (Array.isArray(data)) {
                rawModels = data;
            }
            // 2) 常见包装 { data: [...] }
            else if (Array.isArray(data?.data)) {
                rawModels = data.data;
            }
            // 3) { models: [...] }
            else if (Array.isArray(data?.models)) {
                rawModels = data.models;
            }
            // 4) 更深层 { data: { data: [...] } }
            else if (Array.isArray(data?.data?.data)) {
                rawModels = data.data.data;
            }
            // 5) 兜底：对象内第一个数组字段
            else if (data && typeof data === 'object') {
                for (const val of Object.values(data)) {
                    if (Array.isArray(val)) { rawModels = val; break; }
                }
            }
        } catch {
            // ignore extraction errors;
        }

        // MakerSuite/Gemini 专用过滤：若对象包含 supportedGenerationMethods，则仅保留包含 'generateContent' 的模型
        try {
            rawModels = (rawModels || []).filter(m => {
                const methods = m && typeof m === 'object' ? m.supportedGenerationMethods : undefined;
                return Array.isArray(methods) ? methods.includes('generateContent') : true;
            });
        } catch {
            // ignore filter errors
        }

        // 映射与归一化
        let models = (rawModels || [])
            .filter(m => m && (typeof m === 'string' || typeof m === 'object'))
            .map(m => {
                if (typeof m === 'string') {
                    return { id: m, name: m };
                }

                // 兼容多字段 id
                let id = m.id || m.name || m.model || m.slug || '';

                // 去掉常见前缀，例如 Google 风格的 'models/'
                if (typeof id === 'string' && id.startsWith('models/')) {
                    id = id.replace(/^models\//, '');
                }

                const name = m.displayName || m.name || m.id || id || undefined;
                // 简化映射，只保留 ID 和 name

                return id ? { id, name } : null;
            })
            .filter(Boolean);

        // 去重（按 id）
        const seen = new Set();
        models = models.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });

        // 排序（按 id 升序）
        models.sort((a, b) => a.id.localeCompare(b.id));

        return models;
    }

    const m = new M();

    // ✅✅✅ [已废弃] 旧版 loadConfig 函数已移除
    // 新版 loadConfig 函数位于文件末尾，使用 window.extension_settings 而非虚构的 API

    // 列宽管理
    // ❌ saveColWidths() 和 loadColWidths() 已废弃：
    // 列宽/行高现在通过 m.save()/m.load() 自动保存到会话存档中，确保多会话隔离

    function getColWidth(tableIndex, colName) {
        if (userColWidths[tableIndex] && userColWidths[tableIndex][colName]) {
            return userColWidths[tableIndex][colName];
        }
        if (DEFAULT_COL_WIDTHS[tableIndex] && DEFAULT_COL_WIDTHS[tableIndex][colName]) {
            return DEFAULT_COL_WIDTHS[tableIndex][colName];
        }
        return null;
    }

    function setColWidth(tableIndex, colName, width) {
        if (!userColWidths[tableIndex]) {
            userColWidths[tableIndex] = {};
        }
        userColWidths[tableIndex][colName] = width;

        // ✨✨✨ 关键修复：保存到当前会话存档，确保多会话隔离 ✨✨✨
        m.save();
    }

    async function resetColWidths() {
        if (await customConfirm('确定重置所有列宽和行高？', '重置视图')) {
            userColWidths = {};
            userRowHeights = {};
            // ✨✨✨ 保存到当前会话存档，确保重置操作同步
            m.save();
            await customAlert('视图已重置，请重新打开表格', '成功');

            // 自动刷新一下当前视图，不用手动重开
            if ($('#g-pop').length > 0) {
                shw();
            }
        }
    }

    // ✨✨✨ 视图设置窗口（轻量级悬浮窗版本） ✨✨✨
    function showViewSettings() {
        const currentRowHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--g-rh')) || 24;

        // 🌙 获取主题配置
        const isDark = UI.darkMode;
        const themeColor = UI.c;
        const textColor = UI.tc || '#333333'; // 防止未定义

        // 1. 创建几乎透明的遮罩层 (让用户能看到背后表格的实时变化)
        const $overlay = $('<div>', {
            id: 'g-view-overlay',
            css: {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.1)', // 几乎透明
                zIndex: 10000005,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }
        });

        // 2. 创建小窗口 (适配手机屏幕)
        const $box = $('<div>', {
            css: {
                background: isDark ? '#1e1e1e' : '#fff',
                color: textColor,
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
                width: '90vw',
                maxWidth: '320px',
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                position: 'relative',
                margin: 'auto'
            }
        });

        // 3. 标题栏 (含关闭按钮)
        const $header = $('<div>', {
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '5px'
            }
        });
        $header.append(`<h3 style="margin:0; font-size:16px; color:${textColor};">📏 视图设置</h3>`);

        const $closeBtn = $('<button>', {
            text: '×',
            css: {
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: isDark ? '#999' : '#999',
                padding: '0',
                lineHeight: '1'
            }
        }).on('click', () => $overlay.remove());

        $header.append($closeBtn);
        $box.append($header);

        // 4. 行高调整区域
        const $sliderContainer = $('<div>', {
            css: {
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa',
                padding: '12px',
                borderRadius: '8px',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee'
            }
        });
        $sliderContainer.append(`<div style="font-size:12px; font-weight:600; margin-bottom:8px; color:${textColor};">行高调整 (px)</div>`);

        const $controlRow = $('<div>', {
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }
        });

        // 滑块
        const $slider = $('<input>', {
            type: 'range',
            min: '18',
            max: '80',
            value: currentRowHeight,
            css: {
                flex: 1,
                cursor: 'pointer'
            }
        });

        // 输入框
        const $numInput = $('<input>', {
            type: 'number',
            min: '18',
            max: '80',
            value: currentRowHeight,
            css: {
                width: '50px',
                textAlign: 'center',
                padding: '4px',
                border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ddd',
                borderRadius: '4px',
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                color: textColor
            }
        });

        $controlRow.append($slider, $numInput);
        $sliderContainer.append($controlRow);
        $box.append($sliderContainer);

        // 5. 按钮区域
        const $btnGroup = $('<div>', {
            css: {
                display: 'flex',
                gap: '10px'
            }
        });

        const btnStyle = {
            flex: 1,
            padding: '10px',
            border: `1px solid ${themeColor}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600'
        };

        const $btnResetWidth = $('<button>', {
            text: '📐 重置列宽',
            css: Object.assign({}, btnStyle, {
                background: isDark ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: textColor
            })
        });

        const $btnResetHeight = $('<button>', {
            text: '📏 重置行高',
            css: Object.assign({}, btnStyle, {
                background: themeColor,
                color: '#fff'
            })
        });

        $btnGroup.append($btnResetWidth, $btnResetHeight);
        $box.append($btnGroup);

        $overlay.append($box);
        $('body').append($overlay);

        // --- 逻辑绑定 ---

        // 实时更新行高
        function updateHeight(val) {
            const h = Math.max(18, Math.min(80, parseInt(val) || 24));
            $slider.val(h);
            $numInput.val(h);
            document.documentElement.style.setProperty('--g-rh', h + 'px');

            // 强制重绘(Reflow)以确保表格立即响应
            const $tbl = $('.g-tbl-wrap table');
            if ($tbl.length) $tbl[0].offsetHeight;

            // 保存配置
            if (!userRowHeights) userRowHeights = {};
            userRowHeights['default'] = h;
            m.save();
        }

        $slider.on('input', e => updateHeight(e.target.value));
        $numInput.on('change', e => updateHeight(e.target.value));

        // 按钮事件
        $btnResetWidth.on('click', async () => {
            if (!await customConfirm('确定重置所有列宽设置？', '确认')) return;
            userColWidths = {};
            m.save();
            await customAlert('列宽已重置，表格将刷新', '成功');
            $overlay.remove();
            shw();
        });

        $btnResetHeight.on('click', async () => {
            if (!await customConfirm('确定重置所有自定义行高？\n(将恢复为默认 24px)', '确认')) return;

            // 1. 重置全局变量为 24px
            updateHeight(24);
            // 2. 清空保存的自定义行高数据
            userRowHeights = {};
            // 3. ✨✨✨ 核心修复：强制移除所有单元格的内联高度样式 ✨✨✨
            $('.g-tbl-wrap td').css('height', '');
            m.save();
            if (typeof toastr !== 'undefined') toastr.success('所有行高已重置', '视图设置');
        });

        // 点击遮罩关闭
        $overlay.on('click', e => {
            if (e.target === $overlay[0]) $overlay.remove();
        });

        // ESC键关闭
        $(document).on('keydown.viewSettings', e => {
            if (e.key === 'Escape') {
                $overlay.remove();
                $(document).off('keydown.viewSettings');
            }
        });

        // 窗口移除时清理事件
        $overlay.on('remove', () => {
            $(document).off('keydown.viewSettings');
        });
    }

    // 已总结行管理（已废弃全局保存，改为通过 m.save() 绑定角色ID）
    function saveSummarizedRows() {
        // ❌ 已废弃：不再保存到全局 LocalStorage
        // summarizedRows 现在通过 m.save() 中的 summarized 字段保存，绑定到角色ID
        // 这样每个角色/会话都有独立的"已总结行"状态，不会串味
    }

    function loadSummarizedRows() {
        // ❌ 已废弃：不再从全局 LocalStorage 加载
        // summarizedRows 现在通过 m.load() 从角色专属存档中恢复
        // 切换会话时会自动重置为 {}，然后加载该会话的专属状态
    }

    function markAsSummarized(tableIndex, rowIndex) {
        if (!summarizedRows[tableIndex]) {
            summarizedRows[tableIndex] = [];
        }
        if (!summarizedRows[tableIndex].includes(rowIndex)) {
            summarizedRows[tableIndex].push(rowIndex);
        }
        saveSummarizedRows();
    }

    function isSummarized(tableIndex, rowIndex) {
        return summarizedRows[tableIndex] && summarizedRows[tableIndex].includes(rowIndex);
    }

    function clearSummarizedMarks() {
        summarizedRows = {};
        saveSummarizedRows();
    }

    // ✨✨✨ 新增：公共提示词生成器（只需改这里，全局生效）✨✨✨
    function generateStrictPrompt(summary, history) {
        // ✨✨✨ 修复：生成状态栏信息 ✨✨✨
        const tableTextRaw = m.getTableText();
        let statusStr = '\n=== 📋 当前表格状态 ===\n';
        m.s.slice(0, 8).forEach((s, i) => {
            const displayName = i === 1 ? '支线追踪' : s.n;
            const nextIndex = s.r.length;
            statusStr += `表${i} ${displayName}: ⏭️新增请用索引 ${nextIndex}\n`;
        });
        statusStr += '=== 状态结束 ===\n';

        const currentTableData = tableTextRaw ? (tableTextRaw + statusStr) : statusStr;

        return `
${window.Gaigai.PromptManager.get('tablePrompt')}

【📚 前情提要 (已发生的剧情总结)】
${summary}

【📊 当前表格状态】
${currentTableData}

【🎬 近期剧情 (需要你整理的部分)】
${history}

==================================================
【⚠️⚠️⚠️ 最终执行指令 (非常重要) ⚠️⚠️⚠️】
由于当前表格可能为空，请你务必严格遵守以下格式，不要使用 XML！

1. 🛑 **严禁使用** <Table>, <Row>, <Cell> 等 XML 标签。
2. ✅ **必须使用** 脚本指令格式。
3. ✅ **必须补全日期**：insertRow/updateRow 时，第0列(日期)和第1列(时间)绝对不能为空！

【正确输出示范】
<Memory>
insertRow(0, {0: "2828年09月15日", 1: "07:50", 3: "赵六在阶梯教室送早餐...", 4: "进行中"})
updateRow(0, 0, {3: "张三带走了李四..."})
updateRow(1, 0, {4: "王五销毁了图纸..."})
</Memory>

请忽略所有思考过程，直接输出 <Memory> 标签内容：`;
    }

    function cleanMemoryTags(text) { if (!text) return text; return text.replace(MEMORY_TAG_REGEX, '').trim(); }

    /**
     * 核心过滤函数：根据黑/白名单处理内容
     * @param {string} content - 原始文本
     * @returns {string} - 处理后的文本
     */
    function filterContentByTags(content) {
        if (!content || !C.filterTags) return content;

        const tags = C.filterTags.split(/[,，]/).map(t => t.trim()).filter(t => t);
        if (tags.length === 0) return content;

        // 🟢 模式 A: 白名单 (只保留指定标签内的内容)
        if (C.filterMode === 'whitelist') {
            let extracted = [];
            let foundAny = false;

            tags.forEach(t => {
                let re;
                // ✅ 针对 HTML 注释的特殊处理 (白名单模式下通常不填注释，但也做兼容)
                if (t.startsWith('!--')) {
                    re = new RegExp('<' + t + '[\\s\\S]*?-->', 'gi');
                } else {
                    re = new RegExp(`<${t}(?:\\s+[^>]*)?>([\\s\\S]*?)(?:<\\/${t}>|$)`, 'gi');
                }

                let match;
                while ((match = re.exec(content)) !== null) {
                    if (match[1] && match[1].trim()) {
                        extracted.push(match[1].trim());
                        foundAny = true;
                    } else if (match[0]) {
                        // 兼容注释或其他无group捕获的情况
                        extracted.push(match[0].trim());
                        foundAny = true;
                    }
                }
            });

            // 策略：如果找到了白名单标签，就只返回标签里的内容；
            // 如果完全没找到任何白名单标签，说明这是一条普通消息，原样返回（防止误删正常对话）
            return foundAny ? extracted.join('\\n\\n') : content;
        }

        // ⚫ 模式 B: 黑名单 (删除指定标签及其内容) - 默认
        else {
            let temp = content;
            tags.forEach(t => {
                let re;
                if (t.startsWith('!--')) {
                    // ✅ 针对 HTML 注释的特殊处理 (匹配 <!-- ... -->)
                    // 例如填入 "!--" 则匹配所有 <!--...-->
                    // 填入 "!--run" 则匹配 <!--run...-->
                    re = new RegExp('<' + t + '[\\s\\S]*?-->', 'gi');
                } else {
                    // 原有的成对标签处理 <tag>...</tag>
                    re = new RegExp(`<${t}(?:\\s+[^>]*)?>[\\s\\S]*?<\\/${t}>`, 'gi');
                }
                temp = temp.replace(re, '');
            });
            return temp.trim();
        }
    }

    // ✅✅✅ 智能解析器 v3.6 (无敌兼容版)
    function prs(tx) {
        if (!tx) return [];

        tx = unesc(tx);

        // 1. 防吞清洗
        const commentStart = new RegExp('\\x3c!--', 'g');
        const commentEnd = new RegExp('--\\x3e', 'g');
        let cleanTx = tx.replace(commentStart, ' ').replace(commentEnd, ' ');

        // 2. 压扁换行，修正函数名空格
        cleanTx = cleanTx.replace(/\s+/g, ' ').replace(/Row\s+\(/g, 'Row(').trim();

        const cs = [];
        const commands = ['insertRow', 'updateRow', 'deleteRow'];

        commands.forEach(fn => {
            let searchIndex = 0;
            while (true) {
                const startIdx = cleanTx.indexOf(fn + '(', searchIndex);
                if (startIdx === -1) break;

                // 寻找闭合括号 (跳过引号内的括号)
                let openCount = 0;
                let endIdx = -1;
                let inQuote = false;
                let quoteChar = '';
                const paramStart = startIdx + fn.length;

                for (let i = paramStart; i < cleanTx.length; i++) {
                    const char = cleanTx[i];
                    if (!inQuote && (char === '"' || char === "'")) {
                        inQuote = true; quoteChar = char;
                    } else if (inQuote && char === quoteChar && cleanTx[i - 1] !== '\\') {
                        inQuote = false;
                    }

                    if (!inQuote) {
                        if (char === '(') openCount++;
                        else if (char === ')') {
                            openCount--;
                            if (openCount === 0) { endIdx = i; break; }
                        }
                    }
                }

                if (endIdx === -1) { searchIndex = startIdx + 1; continue; }

                // 提取参数并解析
                const argsStr = cleanTx.substring(startIdx + fn.length + 1, endIdx);
                const parsed = pag(argsStr, fn);
                if (parsed) {
                    cs.push({ t: fn.replace('Row', '').toLowerCase(), ...parsed });
                }

                searchIndex = endIdx + 1;
            }
        });
        return cs;
    }

    function pag(s, f) {
        try {
            const b1 = s.indexOf('{');
            const b2 = s.lastIndexOf('}');
            if (b1 === -1 || b2 === -1) return null;

            // 解析前面的数字索引
            const nsStr = s.substring(0, b1);
            const ns = nsStr.split(',').map(x => x.trim()).filter(x => x && !isNaN(x)).map(x => parseInt(x));

            // 解析后面的对象数据
            const ob = pob(s.substring(b1, b2 + 1));

            if (f === 'insertRow') return { ti: ns[0], ri: null, d: ob };
            if (f === 'updateRow') return { ti: ns[0], ri: ns[1], d: ob };
            if (f === 'deleteRow') return { ti: ns[0], ri: ns[1], d: null };
        } catch (e) { }
        return null;
    }

    // ⚡️ 核心重写：分情况处理单双引号，绝不遗漏
    function pob(s) {
        const d = {};
        s = s.trim().replace(/^\{|\}$/g, '').trim();

        // 匹配模式：
        // 1. 键：可以是数字，也可以带引号 "0" 或 '0'
        // 2. 值：双引号包围 "..." 或 单引号包围 '...'

        // 方案 A：双引号值 (例如 0: "abc")
        const rDouble = /(?:['"]?(\d+)['"]?)\s*:\s*"([^"]*)"/g;

        // 方案 B：单引号值 (例如 0: 'abc')
        const rSingle = /(?:['"]?(\d+)['"]?)\s*:\s*'([^']*)'/g;

        let mt;

        // 先扫一遍双引号的
        while ((mt = rDouble.exec(s)) !== null) {
            d[mt[1]] = mt[2];
        }

        // 再扫一遍单引号的
        while ((mt = rSingle.exec(s)) !== null) {
            // 如果键已经存在（被双引号逻辑抓到了），就跳过，防止冲突
            if (!d[mt[1]]) {
                d[mt[1]] = mt[2];
            }
        }

        return d;
    }

    function exe(cs) {
        cs.forEach(cm => {
            const sh = m.get(cm.ti);
            if (!sh) return;
            if (cm.t === 'update' && cm.ri !== null) sh.upd(cm.ri, cm.d);
            if (cm.t === 'insert') sh.ins(cm.d);
            if (cm.t === 'delete' && cm.ri !== null) sh.del(cm.ri);
        });
        // AI自动执行的指令，最后统一保存
        m.save();
    }

    function inj(ev) {
        // ✨✨✨ 1. [核心修复] 拦截总结模式 (防止 Prompt 污染) ✨✨✨
        if (isSummarizing) {
            // 如果正在执行总结任务，我们要把 System/Preset 里的变量全部“擦除”
            // 防止酒馆把 {{MEMORY_PROMPT}} 展开成 2000 字的规则发送给 AI
            const varsToRemove = ['{{MEMORY}}', '{{MEMORY_SUMMARY}}', '{{MEMORY_TABLE}}', '{{MEMORY_PROMPT}}'];

            ev.chat.forEach(msg => {
                let c = msg.content || msg.mes || '';
                if (!c) return;

                let modified = false;
                varsToRemove.forEach(v => {
                    if (c.includes(v)) {
                        c = c.replace(v, ''); // ⚡️ 直接替换为空字符串
                        modified = true;
                    }
                });

                if (modified) {
                    if (msg.content) msg.content = c;
                    if (msg.mes) msg.mes = c;
                }
            });

            console.log('🧹 [总结模式] 已清洗所有记忆变量，确保 Prompt 纯净。');
            return; // ⛔️ 强制结束！不再执行后续的表格注入逻辑
        }
        // ============================================================
        // 1. 准备数据组件 (拆解为原子部分，无论开关与否都准备，以备变量调用)
        // ============================================================
        let strSummary = '';
        let strTable = '';
        let strPrompt = '';

        // ✅ 新增：准备分区消息数组（用于变量替换时的分区发送）
        let summaryMessages = [];  // 总结表消息数组（按行）
        let tableMessages = [];     // 详情表消息数组（按表）

        // A. 准备总结数据 (如果有且未开启世界书同步)
        // 互斥逻辑：开启世界书同步后，由酒馆的世界书系统负责发送总结，插件不再重复注入
        if (m.sm.has() && !C.syncWorldInfo) {
            // ✅ 旧逻辑：合并字符串（用于兼容旧的变量替换）
            strSummary = '=== 📚 记忆总结（历史存档） ===\n\n' + m.sm.load() + '\n\n';

            // ✅ 新逻辑：按行拆分（用于分区发送）
            const summaryArray = m.sm.loadArray();
            summaryArray.forEach((item) => {
                summaryMessages.push({
                    role: 'system',
                    content: `【前情提要 - ${item.type || '历史'}】\n${item.content}`,
                    isGaigaiData: true
                });
            });
        }

        // B. 准备表格数据 (实时构建)
        // ✅ 旧逻辑：合并字符串（用于兼容旧的变量替换）
        const tableContent = m.s.slice(0, 8).map((s, i) => s.txt(i)).filter(t => t).join('\n');

        strTable += '【系统数据库：剧情记忆档案（仅供剧情参考，请勿在回复中生成此表格）】\n\n';

        if (tableContent) {
            strTable += tableContent;
        } else {
            strTable += '（暂无详细记录，请根据当前剧情建立新记录）\n';
        }
        strTable += '【记忆档案结束】\n';

        strTable += '\n[后台索引状态]\n';
        m.s.slice(0, 8).forEach((s, i) => {
            const displayName = i === 1 ? '支线追踪' : s.n;
            const nextIndex = s.r.length;
            strTable += `表${i} ${displayName}: ⏭️新增请用索引 ${nextIndex}\n`;
        });
        strTable += '[索引结束]\n';

        // ✅ 新逻辑：按表拆分（用于分区发送）
        m.s.slice(0, 8).forEach((sheet, i) => {
            if (sheet.r.length > 0) {
                // 动态获取表名，支持用户自定义
                const sheetName = sheet.n;
                const sheetContent = sheet.txt(i);

                // 添加状态栏信息
                const nextIndex = sheet.r.length;
                const statusInfo = `\n⏭️ 新增请用索引 ${nextIndex}`;

                tableMessages.push({
                    role: 'system',
                    content: `【当前表格状态 - ${sheetName}】\n${sheetContent}${statusInfo}`,
                    isGaigaiData: true
                });
            }
        });

        // C. 准备提示词 (仅当开关开启时，才准备提示词，因为关了就不应该填表)
        if (C.enabled && window.Gaigai.PromptManager.get('tablePrompt')) {
            strPrompt = window.Gaigai.PromptManager.get('tablePrompt');
        }

        // ============================================================
        // 2. 组合智能逻辑 (用于默认插入和 {{MEMORY}})
        // ============================================================
        let smartContent = '';
        let logMsgSmart = '';

        // 独立判断表格注入（读写分离：不受实时记录开关影响）
        if (C.tableInj) {
            smartContent = strSummary + strTable;
            logMsgSmart = "📊 完整数据(智能)";
        } else {
            smartContent = strSummary;
            logMsgSmart = "⚠️ 仅总结(智能)";
        }

        // ============================================================
        // 3. ✨✨✨ 核心逻辑：变量扫描与替换 (支持4个变量) ✨✨✨
        // ============================================================

        const varSmart = '{{MEMORY}}';          // 智能组合 (跟随开关)
        const varSum = '{{MEMORY_SUMMARY}}';  // 强制仅总结
        const varTable = '{{MEMORY_TABLE}}';    // 强制仅表格
        const varPrompt = '{{MEMORY_PROMPT}}';   // 填表规则

        let replacedSmart = false;
        let replacedPrompt = false;

        for (let i = 0; i < ev.chat.length; i++) {
            let msgContent = ev.chat[i].content || ev.chat[i].mes || '';
            let modified = false;

            // 1. 替换 {{MEMORY}} (智能组合)
            if (msgContent.includes(varSmart)) {
                msgContent = msgContent.replace(varSmart, smartContent);
                replacedSmart = true;
                modified = true;
                if (smartContent) console.log(`${logMsgSmart} 已注入 | 策略: 变量 ${varSmart} | 位置: #${i}`);
                else console.log(`🧹 变量清洗 | ${varSmart} 已移除 | 位置: #${i}`);
            }

            // 2. 替换 {{MEMORY_SUMMARY}} (强制总结)
            if (msgContent.includes(varSum)) {
                msgContent = msgContent.replace(varSum, strSummary);
                modified = true;
                if (strSummary) console.log(`📚 总结数据已注入 | 策略: 变量 ${varSum} | 位置: #${i}`);
                else console.log(`🧹 变量清洗 | ${varSum} 已移除 (无总结) | 位置: #${i}`);
            }

            // 3. 替换 {{MEMORY_TABLE}} (强制表格)
            if (msgContent.includes(varTable)) {
                msgContent = msgContent.replace(varTable, strTable);
                modified = true;
                if (strTable) console.log(`📊 表格详情已注入 | 策略: 变量 ${varTable} | 位置: #${i}`);
                else console.log(`🧹 变量清洗 | ${varTable} 已移除 (表格空) | 位置: #${i}`);
            }

            // 4. 替换 {{MEMORY_PROMPT}} (填表规则)
            if (msgContent.includes(varPrompt)) {
                msgContent = msgContent.replace(varPrompt, strPrompt);
                replacedPrompt = true;
                modified = true;
                if (strPrompt) console.log(`📝 提示词已注入 | 策略: 变量 ${varPrompt} | 位置: #${i}`);
                else console.log(`🧹 变量清洗 | ${varPrompt} 已移除 (开关关闭) | 位置: #${i}`);
            }

            if (modified) ev.chat[i].content = msgContent;
        }

        // ============================================================
        // 4. 备选逻辑：如果没有找到主变量，使用固定位置插入
        // ============================================================

        if (smartContent && !replacedSmart) {
            // 关键词锚点模式
            let insertIndex = 0;
            let strategyUsed = 'Position';

            if (C.injStrategy === 'keyword' && C.injKeyword) {
                strategyUsed = `Anchor("${C.injKeyword}")`;
                let foundIndex = -1;
                for (let i = ev.chat.length - 1; i >= 0; i--) {
                    const c = ev.chat[i].content || ev.chat[i].mes || '';
                    if (c.includes(C.injKeyword)) { foundIndex = i; break; }
                }
                if (foundIndex !== -1) insertIndex = foundIndex + 1;
                else {
                    strategyUsed = 'Anchor(Fail->Default)';
                    insertIndex = getInjectionPosition('system', 'system_end', 0, ev.chat);
                }
            } else {
                insertIndex = getInjectionPosition(C.tablePos, C.tablePosType, C.tableDepth, ev.chat);
            }

            // ✅ 新逻辑：使用分区消息数组，按顺序插入（总结按行 + 详情按表）
            const allMessages = [...summaryMessages, ...tableMessages];
            if (allMessages.length > 0) {
                // 批量插入所有消息
                ev.chat.splice(insertIndex, 0, ...allMessages);
                console.log(`${logMsgSmart} 已注入 (分区模式) | 策略: ${strategyUsed} | 位置: #${insertIndex} | 消息数: ${allMessages.length}`);
            } else {
                // 兼容旧逻辑：如果没有分区消息，使用合并字符串
                ev.chat.splice(insertIndex, 0, {
                    role: 'system',
                    content: smartContent,
                    isGaigaiData: true
                });
                console.log(`${logMsgSmart} 已注入 (兼容模式) | 策略: ${strategyUsed} | 位置: #${insertIndex}`);
            }
        }

        // 5. 注入提示词 (默认位置)
        if (strPrompt && !replacedPrompt) {
            const pmtPos = getInjectionPosition(
                window.Gaigai.PromptManager.get('tablePromptPos'),
                window.Gaigai.PromptManager.get('tablePromptPosType'),
                window.Gaigai.PromptManager.get('tablePromptDepth'),
                ev.chat
            );
            const role = getRoleByPosition(window.Gaigai.PromptManager.get('tablePromptPos'));

            ev.chat.splice(pmtPos, 0, {
                role,
                content: strPrompt,
                isGaigaiPrompt: true
            });
            console.log(`📝 提示词已注入 | 策略: 默认位置 | 位置: #${pmtPos}`);
        } else if (!C.enabled && !replacedPrompt) {
            console.log(`🚫 记忆已关，跳过提示词注入`);
        }

        // 6. 过滤历史 (适配手机插件)
        if (C.filterHistory) {
            ev.chat.forEach((msg) => {
                // 跳过插件自己注入的提示词、数据
                if (msg.isGaigaiPrompt || msg.isGaigaiData || msg.isPhoneMessage) return;

                // ✨✨✨ 核心修复：遇到 System (系统) 消息直接跳过，绝对不清洗！✨✨✨
                // 这样你的 {{MEMORY_PROMPT}} 展开后的 <Memory> 标签就不会被删掉了
                if (msg.role === 'system') return;

                // 跳过特定的手机消息格式
                if (msg.content && (msg.content.includes('📱 手机') || msg.content.includes('手机微信消息记录'))) return;

                // 仅清洗 Assistant (AI回复) 的历史记录，防止 AI 看到自己以前输出的数据库指令
                if (msg.role === 'assistant' || !msg.is_user) {
                    const fields = ['content', 'mes', 'message', 'text'];
                    fields.forEach(f => {
                        if (msg[f] && typeof msg[f] === 'string') msg[f] = msg[f].replace(MEMORY_TAG_REGEX, '').trim();
                    });
                }
            });
        }
    }

    function getRoleByPosition(pos) {
        if (pos === 'system') return 'system';
        return 'user';
    }

    function getInjectionPosition(pos, posType, depth, chat) {
        // ✅ 优化逻辑：优先插入到 "[Start a new Chat]" 分隔符之前，作为背景设定铺垫
        if (!chat || chat.length === 0) return 0;

        for (let i = 0; i < chat.length; i++) {
            const msg = chat[i];
            if (!msg) continue;

            // 1. 优先：插入到 "[Start a new Chat]" 分隔符之前
            // 注意：要判断 content 是否存在，防止报错
            if (msg.role === 'system' && msg.content && msg.content.includes('[Start a new Chat]')) {
                return i;
            }

            // 2. 兜底：插入到第一条用户/AI消息之前 (保持原有逻辑)
            if (msg.role === 'user' || msg.role === 'assistant') {
                return i;
            }
        }

        // 全是 System 且没找到特定标记，插到最后
        return chat.length;
    }

    // 终极修复：使用 TreeWalker 精准替换文本节点，绝对不触碰图片/DOM结构
    function hideMemoryTags() {
        if (!C.hideTag) return;

        // 1. 注入一次性 CSS 规则，这是最安全的隐藏方式
        if (!document.getElementById('gaigai-hide-style')) {
            $('<style id="gaigai-hide-style">memory, gaigaimemory, tableedit { display: none !important; }</style>').appendTo('head');
        }

        // ✅ 性能优化：只查找没有打过标记的元素，极大减少遍历数量
        $('.mes_text:not([data-gaigai-processed="true"])').each(function () {
            const root = this;
            // 标记已处理，防止重复扫描
            root.dataset.gaigaiProcessed = 'true';

            // 策略 A: 如果 <Memory> 被浏览器识别为标签，直接用 CSS 隐藏 (不通过 JS 修改)
            $(root).find('memory, gaigaimemory, tableedit').hide();

            // 策略 B: 如果 <Memory> 是纯文本，使用 TreeWalker 精准查找
            // 这种方式只会修改文字节点，旁边的 <img src="..."> 绝对不会被重置！
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            let node;
            const nodesToReplace = [];

            while (node = walker.nextNode()) {
                if (MEMORY_TAG_REGEX.test(node.nodeValue)) {
                    nodesToReplace.push(node);
                }
            }

            if (nodesToReplace.length > 0) {
                nodesToReplace.forEach(textNode => {
                    const span = document.createElement('span');
                    // 只替换文字内容，不触碰父级 innerHTML
                    const newHtml = textNode.nodeValue.replace(MEMORY_TAG_REGEX,
                        '<span class="g-hidden-tag" style="display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;">$&</span>');

                    span.innerHTML = newHtml;
                    // 原地替换文本节点
                    textNode.parentNode.replaceChild(span, textNode);
                });
            }
        });
    }

    // ========================================================================
    // ========== UI渲染和主题管理 ==========
    // ========================================================================

    /**
     * 主题应用函数
     * 应用用户自定义的主题颜色到所有UI元素
     */
    function thm() {
        // 1. 读取配置
        try {
            const savedUI = localStorage.getItem(UK);
            if (savedUI) {
                const parsed = JSON.parse(savedUI);
                if (parsed.c) UI.c = parsed.c;
                if (parsed.tc) UI.tc = parsed.tc;
                if (parsed.fs) UI.fs = parseInt(parsed.fs);
                if (parsed.bookBg !== undefined) UI.bookBg = parsed.bookBg; // ✅ 读取背景图设置
                if (parsed.darkMode !== undefined) UI.darkMode = parsed.darkMode; // ✅ 读取夜间模式设置
            }
        } catch (e) { console.warn('读取主题配置失败'); }

        // ✅ 夜间模式：设置不同的默认颜色
        if (!UI.c) {
            UI.c = UI.darkMode ? '#252525' : '#f0f0f0';  // 夜间默认深色表头，白天默认浅色
        }
        if (!UI.tc) {
            UI.tc = UI.darkMode ? '#ffffff' : '#333333';  // 夜间默认浅色字体，白天默认深色
        }
        if (!UI.fs || isNaN(UI.fs) || UI.fs < 10) UI.fs = 12;

        // ✅ 夜间模式安全检查：如果用户设置了深色字体，强制改为浅色确保可读性
        if (UI.darkMode && (UI.tc === '#333333' || UI.tc === '#000000' || UI.tc === '#000000ff')) {
            UI.tc = '#ffffff';
        }

        // 更新 CSS 变量
        document.documentElement.style.setProperty('--g-c', UI.c);
        document.documentElement.style.setProperty('--g-tc', UI.tc); // ✅ 添加字体颜色CSS变量
        document.documentElement.style.setProperty('--g-fs', UI.fs + 'px');

        // ✅ 修复：应用保存的行高设置
        const savedRowHeight = userRowHeights && userRowHeights['default'] ? userRowHeights['default'] : 24;
        document.documentElement.style.setProperty('--g-rh', savedRowHeight + 'px');

        const getRgbStr = (hex) => {
            let r = 0, g = 0, b = 0;
            if (hex.length === 4) {
                r = parseInt(hex[1] + hex[1], 16);
                g = parseInt(hex[2] + hex[2], 16);
                b = parseInt(hex[3] + hex[3], 16);
            } else if (hex.length === 7) {
                r = parseInt(hex.slice(1, 3), 16);
                g = parseInt(hex.slice(3, 5), 16);
                b = parseInt(hex.slice(5, 7), 16);
            }
            return `${r}, ${g}, ${b}`;
        };

        const rgbStr = getRgbStr(UI.c);
        const selectionBg = `rgba(${rgbStr}, 0.15)`;
        const hoverBg = `rgba(${rgbStr}, 0.08)`;
        const shadowColor = `rgba(${rgbStr}, 0.3)`;

        // ✅ 优化后的默认背景：米白色+微噪点质感（不刺眼，更像纸）
        const bookBgImage = UI.bookBg
            ? `url("${UI.bookBg}")`
            : `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E"), linear-gradient(to bottom, #fdfbf7, #f7f4ed)`;

        // 🌙【新增】定义深色纸张背景（深灰渐变 + 噪点）
        const bookBgImageDark = UI.bookBg
            ? `url("${UI.bookBg}")` // 如果用户自定义了图，就保持用户的
            : `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E"), linear-gradient(to bottom, #2b2b2b, #1a1a1a)`;

       // ✅ 🌙 Dark Mode: 动态变量定义 (深色毛玻璃版)
        const isDark = UI.darkMode;
        // 窗口背景：降低透明度到 0.75，让模糊效果透出来，颜色改为深灰黑
        const bg_window = isDark ? 'rgba(25, 25, 25, 0.75)' : 'rgba(252, 252, 252, 0.85)';
        // 面板背景：不再用实色，改为半透明黑，叠加在窗口上增加层次感
        const bg_panel  = isDark ? 'rgba(0, 0, 0, 0.25)' : '#fcfcfc';
        const bg_header = UI.c; 
        // 输入框：半透明黑，带有磨砂感
        const bg_input  = isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.8)';
        const color_text = UI.tc; 
        // 边框：稍微亮一点的白色半透明，营造玻璃边缘感
        const color_border = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)';
        const bg_table_wrap = isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)';
        const bg_table_cell = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.5)'; // 单元格极淡
        const bg_edit_focus = isDark ? 'rgba(60, 60, 60, 0.9)' : 'rgba(255, 249, 230, 0.95)';
        const bg_edit_hover = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 251, 240, 0.9)';
        const bg_row_num = isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(200, 200, 200, 0.4)';



        const style = `
        /* 1. 字体与重置 */
        #g-pop div, #g-pop p, #g-pop span, #g-pop td, #g-pop th, #g-pop button, #g-pop input, #g-pop select, #g-pop textarea, #g-pop h3, #g-pop h4,
        #g-edit-pop *, #g-summary-pop *, #g-about-pop * {
            font-family: "Segoe UI", Roboto, "Helvetica Neue", "Microsoft YaHei", "微软雅黑", Arial, sans-serif !important;
            line-height: 1.5;
            -webkit-font-smoothing: auto;
            box-sizing: border-box;
            color: ${color_text}; /* 🌙 动态文字颜色 */
            font-size: var(--g-fs, 12px) !important;
        }
        
        #g-pop i, .g-ov i { 
            font-weight: 900 !important; 
        }

        /* 2. 容器 */
        .g-ov { background: rgba(0, 0, 0, 0.5) !important; position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; z-index: 20000 !important; display: flex !important; align-items: center !important; justify-content: center !important; } /* 加深遮罩，让磨砂玻璃更突出 */
        .g-w {
            background: ${bg_window} !important; /* 🌙 动态窗口背景 */
            backdrop-filter: blur(20px) saturate(180%) !important; /* 磨砂玻璃模糊 */
            -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
            border: 1px solid ${color_border} !important;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3) !important;
            border-radius: 12px !important;
            display: flex !important; flex-direction: column !important;
            position: relative !important; margin: auto !important;
            transform: none !important; left: auto !important; top: auto !important;
        }

        /* 🌙 强制所有弹窗容器使用动态背景色 (覆盖 style.css 的固定白色) */
        #g-backfill-pop .g-w,
        #g-summary-pop .g-w,
        #g-optimize-pop .g-w,
        #g-edit-pop .g-w,
        #g-about-pop .g-w {
            background: ${bg_window} !important;
        }

        /* 3. 表格核心布局 */
        .g-tbc { width: 100% !important; height: 100% !important; overflow: hidden !important; display: flex; flex-direction: column !important; }
        
        .g-tbl-wrap {
            width: 100% !important;
            flex: 1 !important;
            background: ${bg_table_wrap} !important; /* 🌙 动态背景 */
            overflow: auto !important;
            padding-bottom: 150px !important;
            padding-right: 50px !important;
            box-sizing: border-box !important;
        }

        .g-tbl-wrap table {
            table-layout: fixed !important; 
            width: max-content !important; 
            min-width: auto !important; 
            border-collapse: separate !important; 
            border-spacing: 0 !important;
            margin: 0 !important;
        }

        .g-tbl-wrap th {
            background: ${bg_header} !important;
            color: ${color_text} !important;
            border-right: 1px solid ${color_border} !important;
            border-bottom: 1px solid ${color_border} !important;
            position: sticky !important; top: 0 !important; z-index: 10 !important;
            height: auto !important; min-height: 32px !important;
            padding: 4px 6px !important;
            font-size: var(--g-fs, 12px) !important; font-weight: bold !important;
            text-align: center !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
        }

/* 1. 单元格样式 */
        .g-tbl-wrap td {
            border-right: 1px solid ${color_border} !important;
            border-bottom: 1px solid ${color_border} !important;
            background: ${bg_table_cell} !important; /* 🌙 动态背景 */

            /* ✅ 修复1：只设默认高度，允许被 JS 拖拽覆盖 */
            height: 24px;

            /* ✅ 修复2：强制允许换行！没有这一句，拖下来也是一行字 */
            white-space: normal !important;

            padding: 0 !important;
            vertical-align: top !important; /* 文字顶对齐，拉大时好看 */
            overflow: hidden !important;
            position: relative !important;
            box-sizing: border-box !important;
        }
        
        /* 列宽拖拽条 (保持不变，但为了方便你复制，我放这里占位) */
        .g-col-resizer { 
            position: absolute !important; right: -5px !important; top: 0 !important; bottom: 0 !important; 
            width: 10px !important; cursor: col-resize !important; z-index: 20 !important; 
            background: transparent !important; 
        }
        .g-col-resizer:hover { background: ${hoverBg} !important; }
        .g-col-resizer:active { background: ${shadowColor} !important; border-right: 1px solid ${UI.c} !important; }

        /* 2. 行高拖拽条 */
        .g-row-resizer {
            position: absolute !important; 
            left: 0 !important; 
            right: 0 !important; 
            bottom: 0 !important;
            height: 8px !important; 
            cursor: row-resize !important; 
            z-index: 100 !important; 
            background: transparent !important;
        }
        
        /* 📱 手机端专项优化：超大触控热区 */
        @media (max-width: 600px) {
            .g-row-resizer {
                height: 30px !important; /* ✅ 加大到 30px，更容易按住 */
                bottom: -10px !important; /* ✅ 稍微下沉 */
            }
        }
        
        /* 鼠标放上去变色，提示这里可以拖 */
        .g-row-resizer:hover { 
            background: rgba(136, 136, 136, 0.2) !important; 
            border-bottom: 2px solid var(--g-c) !important; 
        }
        
        /* 拖动时变深色 */
        .g-row-resizer:active { 
            background: ${shadowColor} !important; 
            border-bottom: 2px solid ${UI.c} !important; 
        }

        .g-t.act { background: ${UI.c} !important; filter: brightness(0.9); color: ${UI.tc} !important; font-weight: bold !important; border: none !important; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.2) !important; }
        .g-row.g-selected td { background-color: ${selectionBg} !important; }
        .g-row.g-selected { outline: 2px solid ${UI.c} !important; outline-offset: -2px !important; }
        .g-row {
            cursor: pointer;
            transition: background-color 0.2s;
            transform: translate3d(0, 0, 0);
            will-change: background-color;
        }
        .g-row.g-summarized { background-color: rgba(0, 0, 0, 0.05) !important; }

        .g-hd { background: ${bg_header} !important; opacity: 0.98; border-bottom: 1px solid ${color_border} !important; padding: 0 16px !important; height: 50px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; flex-shrink: 0 !important; border-radius: 12px 12px 0 0 !important; }

        /* ✨✨✨ 标题栏优化：增大字号、强制颜色跟随主题 ✨✨✨ */
        .g-hd h3 {
            color: ${color_text} !important;
            margin: 0 !important;
            flex: 1;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        /* 2. 标题内容盒子：增加 #g-pop 前缀以覆盖全局重置 */
        #g-pop .g-title-box {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            color: ${color_text} !important;
        }

        /* 3. 主标题文字：增加 #g-pop 前缀 */
        #g-pop .g-title-box span:first-child {
            font-size: 18px !important;       /* 增大字号 */
            font-weight: 800 !important;
            letter-spacing: 1px !important;
            color: ${color_text} !important;       /* 强制跟随主题色 */
        }

        /* 4. 版本号标签：增加 #g-pop 前缀 & 强制颜色 */
        #g-pop .g-ver-tag {
            font-size: 12px !important;
            opacity: 0.8 !important;
            font-weight: normal !important;
            background: rgba(0,0,0,0.1) !important;
            padding: 2px 6px !important;
            border-radius: 4px !important;
            color: ${color_text} !important;       /* 强制跟随主题色 */
        }

        /* 修复图标颜色 */
        #g-about-btn {
            color: inherit !important;
            opacity: 0.8;
        }

        .g-x { background: transparent !important; border: none !important; color: ${color_text} !important; cursor: pointer !important; font-size: 20px !important; width: 32px !important; height: 32px !important; display: flex !important; align-items: center !important; justify-content: center !important; }
        .g-back { background: transparent !important; border: none !important; color: ${color_text} !important; cursor: pointer !important; font-size: var(--g-fs, 12px) !important; font-weight: 600 !important; display: flex !important; align-items: center !important; gap: 6px !important; padding: 4px 8px !important; border-radius: 4px !important; }
        .g-back:hover { background: rgba(255,255,255,0.2) !important; }

        .g-e { 
            /* 1. 填满格子 (改回绝对定位) */
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important; 
            height: 100% !important; 
            
            /* 2. ⚡️⚡️⚡️ 修复手机端滚动脱节 */
            transform: translateZ(0) !important;
            will-change: transform;
            
            /* 3. 允许换行 */
            white-space: pre-wrap !important; 
            word-break: break-all !important; 
            
            /* 4. 样式调整 */
            padding: 2px 4px !important;
            line-height: 1.4 !important;
            font-size: var(--g-fs, 12px) !important; 
            color: #333 !important; 
            
            /* 5. 去掉干扰 */
            border: none !important; 
            background: transparent !important; 
            resize: none !important;
            z-index: 1 !important; 
            overflow: hidden !important; 
        }
        
        .g-e:focus { outline: 2px solid ${bg_header} !important; outline-offset: -2px; background: ${bg_edit_focus} !important; /* 🌙 动态背景 */ box-shadow: 0 4px 12px ${shadowColor} !important; z-index: 10; position: relative; overflow-y: auto !important; align-items: flex-start !important; }
        .g-e:hover { background: ${bg_edit_hover} !important; /* 🌙 动态背景 */ box-shadow: inset 0 0 0 1px var(--g-c); }

        #g-pop input[type="number"], #g-pop input[type="text"], #g-pop input[type="password"], #g-pop select, #g-pop textarea { background: ${bg_input} !important; /* 🌙 动态背景 */ color: ${color_text} !important; border: 1px solid ${color_border} !important; font-size: var(--g-fs, 12px) !important; }
        .g-p input[type="number"], .g-p input[type="text"], .g-p select, .g-p textarea { color: ${color_text} !important; }
        
        .g-col-num { position: sticky !important; left: 0 !important; z-index: 11 !important; background: ${bg_header} !important; border-right: 1px solid ${color_border} !important; }
        tbody .g-col-num { background: ${bg_row_num} !important; /* 🌙 动态背景 */ z-index: 9 !important; }
        
        .g-tl button, .g-p button { background: ${bg_header} !important; color: ${color_text} !important; border: 1px solid ${color_border} !important; border-radius: 6px !important; padding: 6px 12px !important; font-size: var(--g-fs, 12px) !important; font-weight: 600 !important; cursor: pointer !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; white-space: nowrap !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; }
        
        #g-pop ::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
        #g-pop ::-webkit-scrollbar-thumb { background: ${bg_header} !important; border-radius: 10px !important; }
        #g-pop ::-webkit-scrollbar-thumb:hover { background: ${bg_header} !important; filter: brightness(0.8); }
        
        @media (max-width: 600px) {
            .g-w { width: 100vw !important; height: 85vh !important; bottom: 0 !important; border-radius: 12px 12px 0 0 !important; position: absolute !important; }
            .g-ts { flex-wrap: nowrap !important; overflow-x: auto !important; }
            .g-row-resizer { height: 12px !important; bottom: -6px !important; }
            .g-col-resizer { width: 20px !important; right: -10px !important; }
        }

        /* 📖 优化的笔记本样式 (复古手账风) - 手机端修复版 */
        .g-book-view {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background-color: #fdfbf7;
            background-image: ${bookBgImage} !important;
            background-size: cover !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            box-shadow: inset 25px 0 30px -10px rgba(0,0,0,0.15);
            padding: 30px 50px;
            box-sizing: border-box;
            font-family: "Georgia", "Songti SC", "SimSun", serif;
            color: #4a3b32;
            position: relative;
        }

        /* 头部：包含标题和翻页按钮 */
        .g-book-header {
            margin-bottom: 10px;
            border-bottom: 2px solid #8d6e63;
            padding-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap; /* 允许换行，这对手机很重要 */
            gap: 10px;
        }

        .g-book-title {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 1px;
            color: #4a3b32;
            margin: 0;
            min-width: 100px;
        }

        .g-book-content {
            flex: 1;
            overflow-y: auto;
            line-height: 1.8;
            font-size: 15px;
            color: #4a3b32;
            outline: none;
            white-space: pre-wrap;
            text-align: justify;
            padding-right: 10px;
            /* 隐藏滚动条 */
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .g-book-content::-webkit-scrollbar { display: none; }

        /* 控制栏：现在移到了顶部，样式要变简洁 */
        .g-book-controls {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: #5d4037;
            margin: 0;
            padding: 0;
            border: none;
            flex: 1;
            justify-content: flex-end; /* 靠右对齐 */
        }

        .g-book-btn {
            border: none;
            background: rgba(141, 110, 99, 0.1); /* 给按钮加点底色方便按 */
            cursor: pointer;
            font-size: 13px;
            color: #5d4037;
            padding: 4px 10px;
            border-radius: 4px;
            transition: all 0.2s;
            display: flex; align-items: center; gap: 5px;
        }

        .g-book-btn:hover:not(:disabled) {
            background: rgba(93, 64, 55, 0.15);
            transform: translateY(-1px);
        }

        .g-book-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            background: transparent;
        }

        .g-book-page-num { font-weight: bold; font-family: monospace; color: #555; }

        .g-book-view .g-e {
            position: relative !important;
            height: auto !important;
            width: auto !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        .g-book-content.g-e {
            padding: 10px 20px !important;
            min-height: 200px !important;
        }

        .g-book-meta-container {
            background: linear-gradient(to bottom, rgba(141, 110, 99, 0.08), transparent);
            border-bottom: 1px solid rgba(141, 110, 99, 0.25);
            padding: 8px 12px;
            margin: -5px 0 15px 0 !important;
            border-radius: 4px;
        }

        .g-book-meta-tags { display: flex; flex-wrap: wrap; gap: 8px; line-height: 1.5; }
        
        .g-book-meta-tag {
            font-size: 11px; padding: 2px 8px; background: rgba(255, 255, 255, 0.5);
            border-radius: 4px; color: #6d4c41; border: 1px solid rgba(141, 110, 99, 0.3);
            font-family: "Georgia", "Songti SC", serif; display: inline-flex; align-items: center; gap: 4px;
        }
        
        .g-book-meta-label { font-weight: 600; color: #8d6e63; font-size: 11px; }

        .g-book-page-input {
            width: 45px; text-align: center; font-weight: bold; font-family: monospace;
            color: #555; border: 1px solid #cbb0a1; border-radius: 4px; padding: 2px 0;
            background: rgba(255, 255, 255, 0.8); font-size: 12px;
        }

        /* 📱 手机端最终修复：限制高度，强制内部滚动 */
        @media (max-width: 600px) {
            /* 1. 弹窗固定大小，留出上下边距 */
            .g-w { 
                width: 100vw !important; 
                height: 85vh !important; /* 限制高度，不要撑满 */
                bottom: 0 !important; 
                border-radius: 12px 12px 0 0 !important; 
                position: absolute !important; 
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important; /* 关键：禁止整个弹窗滚动 */
            }

            /* 2. 内容区布局 */
            .g-bd { 
                flex: 1 !important; 
                height: 100% !important; 
                overflow: hidden !important; 
                padding: 0 !important; 
                display: flex !important;
                flex-direction: column !important;
            }

            /* 3. 笔记本容器：禁止撑开，强制压缩 */
            .g-book-view {
                flex: 1 !important; 
                height: 100% !important; 
                min-height: 0 !important; /* 魔法属性：允许被压缩 */
                padding: 5px 12px 10px 12px !important; 
                display: flex !important; 
                flex-direction: column !important; 
                overflow: hidden !important; 
                box-shadow: none !important;
            }

            /* 4. 头部固定 */
            .g-book-header {
                flex-shrink: 0 !important; /* 头部不许缩放 */
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 8px !important;
                padding-bottom: 5px !important;
                margin-bottom: 5px !important;
            }

            .g-book-title {
                font-size: 16px !important;
                text-align: center;
            }

            /* 控制栏 */
            .g-book-controls {
                width: 100% !important;
                justify-content: space-between !important;
                border-top: 1px dashed #cbb0a1 !important;
                padding-top: 5px !important;
                flex-shrink: 0 !important;
            }

            .g-book-btn {
                flex: 1 !important;
                justify-content: center !important;
                padding: 6px !important;
            }

            /* 5. 文本框：这就是你要改的地方 */
            .g-book-content.g-e {
                flex: 1 1 auto !important; 
                height: 100% !important; 
                min-height: 0 !important; /* 关键：允许比内容矮 */
                
                padding: 5px 5px 60px 5px !important; /* 底部留白60px，防止字被挡住 */
                font-size: 14px !important;

                /* 强制开启滚动条 */
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch !important;
            }
        }

       /* ============================================
           🌙 DARK MODE FORCE OVERRIDES (深色毛玻璃修复版)
           强制覆盖内联样式，确保夜间模式通透
           ============================================ */
        ${isDark ? `
            /* ========== 1. 强制输入框透明化 ========== */
            #g-pop textarea, #g-pop input, #g-pop select,
            .g-w textarea, .g-w input, .g-w select,
            #g-edit-pop textarea, #g-edit-pop input, #g-edit-pop select,
            body > div[style*="fixed"] textarea,
            body > div[style*="fixed"] input[type="text"],
            body > div[style*="fixed"] input[type="number"],
            body > div[style*="fixed"] select,
            /* 覆盖弹窗内的输入框 */
            #bf-popup-editor, #summary-editor, #opt-result-editor,
            #bf-custom-prompt, #opt-prompt, #bf-target-table,
            #opt-target, #opt-range-input, #summary-note {
                background-color: rgba(0, 0, 0, 0.4) !important; /* 半透明黑 */
                color: ${color_text} !important;
                border: 1px solid rgba(255, 255, 255, 0.15) !important;
                backdrop-filter: blur(5px); /* 输入框内微模糊 */
            }

            /* ✅ 修复：下拉框选项强制深色背景 (必须是实色，不能透明) */
            option {
                background-color: #080808ff !important; 
                color: ${color_text} !important;
            }

            /* ========== 2. 强制弹窗容器毛玻璃化 ========== */
            /* 这里的关键是把所有之前的 #fff 背景都变成半透明 */
            
            /* 针对白色背景的 div，强制改为深色半透明 */
            .g-ov > div[style*="background"][style*="#fff"],
            .g-ov > div[style*="background"][style*="rgb(255, 255, 255)"],
            body > div[style*="fixed"] div[style*="background:#fff"],
            .summary-action-box {
                background: rgba(30, 30, 30, 0.85) !important; /* 核心窗口背景 */
                backdrop-filter: blur(20px) saturate(180%) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6) !important;
            }

            /* 针对弹窗内的白色板块（如配置项背景），改为更淡的半透明 */
            .g-p div[style*="background: rgba(255,255,255"],
            .g-p div[style*="background:rgba(255,255,255"],
            .g-p div[style*="background:#fff"],
            #api-config-section,
            #auto-bf-settings,
            #auto-sum-settings {
                background: rgba(255, 255, 255, 0.05) !important; /* 微微提亮 */
                border-color: rgba(255, 255, 255, 0.1) !important;
            }

            /* ========== 3. 强制文字颜色 ========== */
            .g-ov div, .g-ov h3, .g-ov h4, .g-ov strong, .g-ov span, .g-ov label,
            .g-p, .g-w, .g-hd h3 {
                color: ${color_text} !important;
            }
            
            /* 弱化辅助文字颜色 */
            .g-p div[style*="color: #666"],
            .g-p div[style*="color:#666"],
            .g-p span[style*="opacity:0.7"],
            .g-p div[style*="opacity:0.8"] {
                color: rgba(255, 255, 255, 0.6) !important;
            }

            /* ========== 4. 按钮样式微调 ========== */
            /* 取消按钮/灰色按钮 */
            button[style*="background:#6c757d"],
            button[style*="background: #6c757d"],
            .summary-action-keep {
                background: rgba(255, 255, 255, 0.15) !important;
                color: ${color_text} !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
            }
            button[style*="background:#6c757d"]:hover {
                background: rgba(255, 255, 255, 0.25) !important;
            }

            /* ========== 5. 强制覆盖 specific ID 的弹窗背景 ========== */
            /* 这一步确保总结、追溯等弹窗也是毛玻璃 */
            #g-backfill-pop .g-w,
            #g-summary-pop .g-w,
            #g-optimize-pop .g-w,
            #g-edit-pop .g-w,
            #g-about-pop .g-w {
                background: rgba(30, 30, 30, 0.75) !important; /* 与主窗口一致 */
                backdrop-filter: blur(20px) saturate(180%) !important;
            }
            
            /* 配置页面的背景板 */
            #g-backfill-pop .g-p,
            #g-summary-pop .g-p,
            #g-optimize-pop .g-p {
                background: transparent !important; /* 让它透出 g-w 的毛玻璃 */
            }

            /* ========== 6. 表格单元格 ========== */
            .g-tbl-wrap td {
                background: rgba(255, 255, 255, 0.02) !important; /* 极淡的透明 */
                border-color: rgba(255, 255, 255, 0.08) !important;
            }
            .g-tbl-wrap th {
                border-color: rgba(255, 255, 255, 0.1) !important;
                background: rgba(30, 30, 30, 0.9) !important; /* 表头稍微实一点 */
            }
            /* 选中行 */
            .g-row.g-selected td {
                background: rgba(255, 255, 255, 0.1) !important;
            }

            /* ========== 7. 笔记本模式 (Notebook) ========== */
            /* 保持深色纸张质感，但也加深阴影 */
            .g-book-view {
                background-image: ${bookBgImageDark} !important;
                background-color: #1a1a1a !important;
                color: ${color_text} !important;
                box-shadow: inset 0 0 50px rgba(0,0,0,0.8) !important;
            }
            .g-book-btn {
                background: rgba(255, 255, 255, 0.05) !important;
                color: ${color_text} !important;
            }
            .g-book-meta-tag {
                background: rgba(255, 255, 255, 0.05) !important;
                border-color: rgba(255, 255, 255, 0.1) !important;
                color: #ccc !important;
            }
        ` : ''}

        /* ========== 📚 侧边目录样式 ========== */
        /* 目录容器 */
        .g-book-toc-panel {
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: 260px;
            background: ${bg_window};
            z-index: 100;
            box-shadow: 4px 0 15px rgba(0,0,0,0.2);
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            backdrop-filter: blur(10px);
            border-right: 1px solid ${color_border};
        }

        /* 展开状态 */
        .g-book-toc-panel.active {
            transform: translateX(0);
        }

        /* 目录头部 */
        .g-toc-header {
            padding: 15px;
            border-bottom: 1px solid ${color_border};
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: ${color_text};
            flex-shrink: 0;
        }

        /* 目录列表区 */
        .g-toc-list {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            padding-bottom: 60px;
        }

        /* 单个目录项 */
        .g-toc-item {
            padding: 10px;
            margin-bottom: 8px;
            border-radius: 6px;
            background: ${bg_table_cell};
            cursor: pointer;
            border: 1px solid ${color_border};
            transition: all 0.2s;
        }

        .g-toc-item:hover {
            background: ${bg_header};
            transform: translateX(4px);
            border-color: ${color_text};
        }

        /* 当前页高亮 */
        .g-toc-item.active {
            background: ${bg_header};
            border: 2px solid ${color_text};
            filter: brightness(1.1);
            color: ${color_text};
            font-weight: bold;
        }

        .g-toc-title {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 4px;
            color: ${color_text};
        }

        .g-toc-meta {
            font-size: 10px;
            opacity: 0.8;
            margin-bottom: 4px;
            display: inline-block;
            background: rgba(0,0,0,0.1);
            padding: 2px 6px;
            border-radius: 3px;
        }

        .g-toc-preview {
            font-size: 11px;
            opacity: 0.7;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* 遮罩层 (点击空白关闭) */
        .g-toc-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.3);
            z-index: 99;
            display: none;
        }

        .g-toc-overlay.active {
            display: block;
        }

        /* 📱 移动端适配 */
        @media (max-width: 768px) {
            .g-book-toc-panel {
                width: 80vw;
                max-width: 300px;
            }
        }
    `;
        
        $('#gaigai-theme').remove();
        $('<style id="gaigai-theme">').text(style).appendTo('head');
    }

    function pop(ttl, htm, showBack = false) {
        $('#g-pop').remove();
        thm(); // 重新应用样式

        const $o = $('<div>', { id: 'g-pop', class: 'g-ov' });
        const $p = $('<div>', { class: 'g-w' });
        const $h = $('<div>', { class: 'g-hd' });

        // 1. 左侧容器 (放返回按钮或占位)
        const $left = $('<div>', { css: { 'min-width': '60px', 'display': 'flex', 'align-items': 'center' } });
        if (showBack) {
            const $back = $('<button>', {
                class: 'g-back',
                html: '<i class="fa-solid fa-chevron-left"></i> 返回'
            }).on('click', goBack);
            $left.append($back);
        }

        // 2. 中间标题 (强制居中)
        // 如果 ttl 是 HTML 字符串（比如包含版本号），直接用 html()，否则用 text()
        const $title = $('<h3>');
        if (ttl.includes('<')) $title.html(ttl);
        else $title.text(ttl);

        // 3. 右侧容器 (放关闭按钮)
        const $right = $('<div>', { css: { 'min-width': '60px', 'display': 'flex', 'justify-content': 'flex-end', 'align-items': 'center' } });
        const $x = $('<button>', {
            class: 'g-x',
            text: '×'
        }).on('click', () => {
            window.isEditingConfig = false; // 关闭弹窗时重置编辑标志
            $o.remove();
            pageStack = [];
        });
        $right.append($x);

        // 组装标题栏
        $h.append($left, $title, $right);

        const $b = $('<div>', { class: 'g-bd', html: htm });
        $p.append($h, $b);
        $o.append($p);

        // ❌ [已禁用] 点击遮罩关闭 - 防止编辑时误触
        // $o.on('click', e => { if (e.target === $o[0]) { $o.remove(); pageStack = []; } });
        $(document).on('keydown.g', e => {
            if (e.key === 'Escape') {
                window.isEditingConfig = false; // Esc关闭时也重置编辑标志
                $o.remove();
                pageStack = [];
                $(document).off('keydown.g');
            }
        });

        $('body').append($o);
        return $p;
    }

    function navTo(title, contentFn) { pageStack.push(contentFn); contentFn(); }
    function goBack() { if (pageStack.length > 1) { pageStack.pop(); const prevFn = pageStack[pageStack.length - 1]; prevFn(); } else { pageStack = []; shw(); } }

    function showBigEditor(ti, ri, ci, currentValue) {
        const sh = m.get(ti);
        const colName = sh.c[ci];
        // 🌙 Dark Mode Fix: Remove inline background/color, let CSS from thm() handle it
        const h = `<div class="g-p"><h4>✏️ 编辑单元格</h4><p style="color:${UI.tc}; opacity:0.8; font-size:11px; margin-bottom:10px;">表格：<strong>${sh.n}</strong> | 行：<strong>${ri + 1}</strong> | 列：<strong>${colName}</strong></p><textarea id="big-editor" style="width:100%; height:300px; padding:10px; border:1px solid #ddd; border-radius:4px; font-size:12px; font-family:inherit; resize:vertical; line-height:1.6;">${esc(currentValue)}</textarea><div style="margin-top:12px;"><button id="save-edit" style="padding:6px 12px; background:${UI.c}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;">💾 保存</button><button id="cancel-edit" style="padding:6px 12px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;">取消</button></div></div>`;
        $('#g-edit-pop').remove();
        const $o = $('<div>', { id: 'g-edit-pop', class: 'g-ov', css: { 'z-index': '10000000' } });
        const $p = $('<div>', { class: 'g-w', css: { width: '600px', maxWidth: '90vw', height: 'auto' } });
        const $hd = $('<div>', { class: 'g-hd', html: `<h3 style="color:${UI.tc};">✏️ 编辑内容</h3>` });
        const $x = $('<button>', { class: 'g-x', text: '×', css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' } }).on('click', () => $o.remove());
        const $bd = $('<div>', { class: 'g-bd', html: h });
        $hd.append($x); $p.append($hd, $bd); $o.append($p); $('body').append($o);
        setTimeout(() => {
            $('#big-editor').focus();
            $('#save-edit').on('click', function () {
                const newValue = $('#big-editor').val();
                
                if (sh && sh.r[ri]) {
                    sh.r[ri][ci] = newValue;
                }

                lastManualEditTime = Date.now(); 
                m.save(true);
                
                updateCurrentSnapshot();

                // ✅ 修复：限定范围，只更新当前表格(g-tbc data-i=ti)里面的那个格子
                $(`.g-tbc[data-i="${ti}"] .g-e[data-r="${ri}"][data-c="${ci}"]`).text(newValue);
                $o.remove();
            });
            $('#cancel-edit').on('click', () => $o.remove());
            $o.on('keydown', e => { if (e.key === 'Escape') $o.remove(); });
        }, 100);
    }

    /**
     * 显示主界面（表格选择页）
     * 渲染所有表格的标签页和表格数据
     * ✨ 修复版：自动保持当前选中的标签页，防止刷新后跳回首页
     */
    function shw() {
        // ✅ 【会话检查】防止在酒馆主页加载残留数据
        const context = SillyTavern.getContext();
        if (!context || !context.chatId || !context.chat) {
            customAlert('⚠️ 请先进入一个聊天会话，然后再打开记忆表格。\n(当前处于主页或空闲状态)', '未检测到会话');
            return;
        }

        m.load(); // 强制重载数据
        pageStack = [shw];

        const ss = m.all();

        // ✨ 1. 优先使用保存的标签索引，如果未设置或超出范围则默认为 0
        let activeTabIndex = (lastActiveTabIndex !== null && lastActiveTabIndex !== undefined) ? lastActiveTabIndex : 0;
        if (activeTabIndex >= ss.length) {
            activeTabIndex = 0; // 如果保存的索引超出范围，重置为0
        }

        const tbs = ss.map((s, i) => {
            const count = s.r.length;
            const displayName = i === 1 ? '支线剧情' : s.n;
            // ✨ 2. 根据记录的索引设置激活状态
            const isActive = i === activeTabIndex ? ' act' : '';
            return `<button class="g-t${isActive}" data-i="${i}">${displayName} (${count})</button>`;
        }).join('');

        const tls = `
        <div class="g-btn-group">
            <button id="g-ad" title="新增一行">➕ 新增</button>
            <button id="g-dr" title="删除选中行">🗑️ 删除</button>
            <button id="g-toggle-sum" title="切换选中行的已总结状态">👁️ 显/隐</button>
            <button id="g-sm" title="AI智能总结">📝 总结</button>
            <button id="g-bf" title="追溯历史剧情填表">⚡ 追溯</button>
            <button id="g-ex" title="导出JSON备份">📥 导出</button>
            <button id="g-im" title="从JSON恢复数据">📤 导入</button>
            <button id="g-reset-width" title="视图设置">📏 视图</button>
            <button id="g-clear-tables" title="保留总结，清空详情">🧹 清表</button>
            <button id="g-ca" title="清空所有数据">💥 全清</button>
            <button id="g-tm" title="设置外观">🎨 主题</button>
            <button id="g-cf" title="插件设置">⚙️ 配置</button>
        </div>
    `;

        const tbls = ss.map((s, i) => gtb(s, i)).join('');

        const cleanVer = V.replace(/^v+/i, '');
        const titleHtml = `
        <div class="g-title-box">
            <span>记忆表格</span>
            <span class="g-ver-tag">v${cleanVer}</span>
            <i id="g-about-btn" class="fa-solid fa-circle-info"
               style="margin-left:6px; cursor:pointer; opacity:0.8; font-size:14px; transition:all 0.2s;"
               title="使用说明 & 检查更新"></i>
        </div>
    `;

        const h = `<div class="g-vw">
        <div class="g-ts">${tbs}</div>
        <div class="g-tl">${tls}</div>
        <div class="g-tb">${tbls}</div>
    </div>`;

        pop(titleHtml, h);

        checkForUpdates(V.replace(/^v+/i, ''));
        const lastReadVer = localStorage.getItem('gg_notice_ver');
        if (lastReadVer !== V) {
            setTimeout(() => { showAbout(true); }, 300);
        }

        setTimeout(bnd, 100);

        // ✨ 3. 渲染完成后，手动触发一次点击以确保内容显示正确 (模拟用户切换)
        setTimeout(() => {
            $('#g-about-btn').hover(
                function () { $(this).css({ opacity: 1, transform: 'scale(1.1)' }); },
                function () { $(this).css({ opacity: 0.8, transform: 'scale(1)' }); }
            ).on('click', (e) => {
                e.stopPropagation();
                showAbout();
            });

            // ⚡ 关键修复：强制切换到之前选中的标签对应的表格内容
            $('.g-tbc').hide(); // 先隐藏所有
            $(`.g-tbc[data-i="${activeTabIndex}"]`).css('display', 'flex'); // 显示目标
            lastActiveTabIndex = activeTabIndex; // ✨ 更新保存的标签索引

            // 确保复选框可见性
            $('#g-pop .g-row-select, #g-pop .g-select-all').css({
                'display': 'block', 'visibility': 'visible', 'opacity': '1',
                'position': 'relative', 'z-index': '99999', 'pointer-events': 'auto',
                '-webkit-appearance': 'checkbox', 'appearance': 'checkbox'
            });
        }, 100);

        // ✅ 检查默认提示词更新（延迟执行，等待界面渲染完毕）
        if (window.Gaigai.PromptManager && typeof window.Gaigai.PromptManager.checkUpdate === 'function') {
            setTimeout(() => {
                window.Gaigai.PromptManager.checkUpdate();
            }, 800);
        }
    }

    /**
     * 渲染笔记本视图（用于索引8的记忆总结表）
     * @param {Object} sheet - 表格数据对象
     * @param {number} tableIndex - 表格索引
     * @returns {string} - 返回笔记本视图的HTML字符串
     */
    /**
     * 渲染笔记本视图（用于索引8的记忆总结表）
     * 📱 修复版：将翻页按钮移到顶部，防止手机端看不见
     */
    function renderBookUI(sheet, tableIndex) {
        const v = tableIndex === 0 ? '' : 'display:none;';

        // 1. 空数据状态
        if (!sheet.r || sheet.r.length === 0) {
            return `<div class="g-tbc" data-i="${tableIndex}" style="${v}">
                <div class="g-book-view" style="justify-content:center; align-items:center; color:#8d6e63;">
                    <i class="fa-solid fa-book-open" style="font-size:48px; margin-bottom:10px; opacity:0.5;"></i>
                    <div>暂无记忆总结</div>
                    <div style="font-size:12px; margin-top:5px;">(请点击上方"总结"按钮生成)</div>
                </div>
            </div>`;
        }

        // 2. 修正页码
        if (currentBookPage >= sheet.r.length) currentBookPage = sheet.r.length - 1;
        if (currentBookPage < 0) currentBookPage = 0;

        // ✨✨✨ 生成目录 HTML ✨✨✨
        let tocItems = '';
        sheet.r.forEach((r, idx) => {
            const tTitle = r[0] || '无标题';
            const tContent = (r[1] || '').substring(0, 30);
            const tContentDisplay = tContent ? tContent + (r[1].length > 30 ? '...' : '') : '(暂无内容)';
            const tNote = r[2] ? `<div class="g-toc-meta">📌 ${esc(r[2])}</div>` : '';
            const activeClass = idx === currentBookPage ? ' active' : '';

            tocItems += `
                <div class="g-toc-item${activeClass}" data-page="${idx}" data-ti="${tableIndex}">
                    <div class="g-toc-title">${idx + 1}. ${esc(tTitle)}</div>
                    ${tNote}
                    <div class="g-toc-preview">${esc(tContentDisplay)}</div>
                </div>`;
        });

        const tocHtml = `
            <div class="g-toc-overlay" id="g-toc-overlay-${tableIndex}"></div>
            <div class="g-book-toc-panel" id="g-book-toc-${tableIndex}">
                <div class="g-toc-header">
                    <span>📚 目录导航</span>
                    <button id="g-toc-close-${tableIndex}" style="background:none;border:none;cursor:pointer;font-size:20px;color:inherit;padding:0;">×</button>
                </div>
                <div class="g-toc-list">
                    ${tocItems}
                </div>
            </div>
        `;

        const isHidden = isSummarized(tableIndex, currentBookPage);
        const row = sheet.r[currentBookPage];
        const title = row[0] || '无标题';
        const content = row[1] || '';

        // 3. 样式处理
        const hiddenStyle = isHidden ? 'opacity: 0.5; position: relative;' : '';
        const watermark = isHidden
            ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                           font-size: 80px; font-weight: bold; color: rgba(141, 110, 99, 0.1);
                           pointer-events: none; z-index: 0; user-select: none;">
                    已归档
                </div>`
            : '';

        // 4. 元数据栏（日期等）
        let metaSection = '';
        if (sheet.c && sheet.c.length > 2) {
            const metaItems = [];
            for (let i = 2; i < sheet.c.length; i++) {
                const colName = sheet.c[i];
                const colValue = row[i] || '';
                const displayValue = colValue || '(空)';
                const opacityStyle = colValue ? '' : 'opacity:0.5; font-style:italic;';

                metaItems.push(`
                    <div class="g-book-meta-tag">
                        <span class="g-book-meta-label">${esc(colName)}:</span>
                        <span class="g-e" contenteditable="true" spellcheck="false"
                              data-ti="${tableIndex}" data-r="${currentBookPage}" data-c="${i}"
                              style="${opacityStyle}"
                              title="点击编辑">${esc(displayValue)}</span>
                    </div>
                `);
            }
            if (metaItems.length > 0) {
                metaSection = `<div class="g-book-meta-container"><div class="g-book-meta-tags">${metaItems.join('')}</div></div>`;
            }
        }

        // 5. 准备控制栏（按钮组）
        const totalPages = sheet.r.length;
        const canPrev = currentBookPage > 0;
        const canNext = currentBookPage < totalPages - 1;

        const controlsHtml = `
            <div class="g-book-controls">
                <button class="g-book-btn g-book-toc-toggle" data-ti="${tableIndex}" style="margin-right:auto;">
                    <i class="fa-solid fa-list"></i> 目录
                </button>

                <button class="g-book-btn g-book-prev" data-ti="${tableIndex}" ${!canPrev ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-left"></i> 上一篇
                </button>

                <div style="display: flex; align-items: center; gap: 5px;">
                    <input type="number" class="g-book-page-input" id="g-book-page-jump"
                           value="${currentBookPage + 1}" min="1" max="${totalPages}"
                           data-ti="${tableIndex}">
                    <span>/ ${totalPages}</span>
                </div>

                <button class="g-book-btn g-book-next" data-ti="${tableIndex}" ${!canNext ? 'disabled' : ''}>
                    下一篇 <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        `;

        // 6. 组合HTML：注意 controlsHtml 被放到了 g-book-header 里面
        return `<div class="g-tbc" data-i="${tableIndex}" style="${v}">
            <div class="g-book-view" style="${hiddenStyle}; position: relative;">
                ${tocHtml}
                ${watermark}
                
                <!-- 头部：标题 + 按钮 -->
                <div class="g-book-header">
                    <div class="g-book-title g-e" contenteditable="true" spellcheck="false"
                         data-ti="${tableIndex}" data-r="${currentBookPage}" data-c="0">${esc(title)}</div>
                    
                    ${controlsHtml} <!-- 按钮在这里！ -->
                </div>

                ${metaSection}

                <div class="g-book-content g-e" contenteditable="true" spellcheck="false"
                     data-ti="${tableIndex}" data-r="${currentBookPage}" data-c="1">${esc(content)}</div>
            </div>
        </div>`;
    }

    function gtb(s, ti) {
        // 判断：如果是索引8（记忆总结表），使用笔记本视图
        if (ti === 8) {
            return renderBookUI(s, ti);
        }

        // 其他表格使用原来的表格视图
        const v = ti === 0 ? '' : 'display:none;';

        let h = `<div class="g-tbc" data-i="${ti}" style="${v}"><div class="g-tbl-wrap"><table>`;

        // 表头 (保留列宽拖拽)
        h += '<thead class="g-sticky"><tr>';
        h += '<th class="g-col-num" style="width:40px; min-width:40px; max-width:40px;">';
        h += '<input type="checkbox" class="g-select-all" data-ti="' + ti + '">';
        h += '</th>';

        // ✅✅✅ 把这段补回来！这是生成列标题的！
        s.c.forEach((c, ci) => {
            const width = getColWidth(ti, c) || 100;
            h += `<th style="width:${width}px;" data-ti="${ti}" data-col="${ci}" data-col-name="${esc(c)}">
            ${esc(c)}
            <div class="g-col-resizer" data-ti="${ti}" data-ci="${ci}" data-col-name="${esc(c)}" title="拖拽调整列宽"></div>
        </th>`;
        });

        h += '</tr></thead><tbody>'

        // 表格内容
        if (s.r.length === 0) {
            h += `<tr class="g-emp"><td colspan="${s.c.length + 1}">暂无数据</td></tr>`;
        } else {
            s.r.forEach((rw, ri) => {
                const summarizedClass = isSummarized(ti, ri) ? ' g-summarized' : '';
                h += `<tr data-r="${ri}" data-ti="${ti}" class="g-row${summarizedClass}">`;

                // ✅ 读取当前行的保存高度
                const rh = userRowHeights[ti] && userRowHeights[ti][ri];
                const heightStyle = rh ? `height:${rh}px !important;` : '';

                // 1. 左侧行号列 (带行高拖拽)
                h += `<td class="g-col-num" style="width:40px; min-width:40px; max-width:40px; ${heightStyle}">
                <div class="g-n">
                    <input type="checkbox" class="g-row-select" data-r="${ri}">
                    <div>${ri + 1}</div>
                    <div class="g-row-resizer" data-ti="${ti}" data-r="${ri}" title="拖拽调整行高"></div>
                </div>
            </td>`;

                // ✅ 数据列
                s.c.forEach((c, ci) => {
                    const val = rw[ci] || '';

                    // ✨【恢复直接编辑功能】
                    // ⚠️ 注意：<td> 不设置 width，只由 <th> 控制列宽，避免"拉长后无法缩回"的 Bug
                    h += `<td style="${heightStyle}" data-ti="${ti}" data-col="${ci}">
    <div class="g-e" contenteditable="true" spellcheck="false" data-r="${ri}" data-c="${ci}">${esc(val)}</div>
    <div class="g-row-resizer" data-ti="${ti}" data-r="${ri}" title="拖拽调整行高"></div>
</td>`;
                });
                h += '</tr>';
            });
        }
        h += '</tbody></table></div></div>';
        return h;
    }

    let selectedRow = null;
    let selectedTableIndex = null;
    let selectedRows = [];
    let currentBookPage = 0; // 记忆总结表的当前页码
    let lastActiveTabIndex = 0; // ✨ 保存上一次激活的标签索引，用于返回时恢复
    function bnd() {
        // 切换标签
        $('.g-t').off('click').on('click', function () {
            const i = $(this).data('i');
            $('.g-t').removeClass('act');
            $(this).addClass('act');

            $('.g-tbc').css('display', 'none');
            $(`.g-tbc[data-i="${i}"]`).css('display', 'flex');
            selectedRow = null;
            selectedRows = [];
            selectedTableIndex = i;
            lastActiveTabIndex = i; // ✨ 保存当前激活的标签索引
            $('.g-row').removeClass('g-selected');
            $('.g-row-select').prop('checked', false);
            $('.g-select-all').prop('checked', false);
        });

        // =========================================================
        // 📖 笔记本模式翻页事件绑定
        // =========================================================
        // 上一页按钮
        $('#g-pop').off('click', '.g-book-prev').on('click', '.g-book-prev', function () {
            const ti = parseInt($(this).data('ti'));
            if (currentBookPage > 0) {
                currentBookPage--;
                refreshBookView(ti);
            }
        });

        // 下一页按钮
        $('#g-pop').off('click', '.g-book-next').on('click', '.g-book-next', function () {
            const ti = parseInt($(this).data('ti'));
            const sheet = m.get(ti);
            if (sheet && currentBookPage < sheet.r.length - 1) {
                currentBookPage++;
                refreshBookView(ti);
            }
        });

        // 笔记本视图内容编辑保存（复用现有的blur保存逻辑）
        $('#g-pop').off('blur', '.g-book-view .g-e[contenteditable="true"]')
            .on('blur', '.g-book-view .g-e[contenteditable="true"]', function () {
                const $this = $(this);
                const r = parseInt($this.data('r'));
                const c = parseInt($this.data('c'));
                const ti = parseInt($this.data('ti'));
                const newVal = $this.text();

                const sh = m.get(ti);
                if (sh && sh.r[r]) {
                    sh.r[r][c] = newVal;
                    m.save(true);
                }
            });

        // ✅ 页码跳转输入框事件绑定
        $('#g-pop').off('change', '#g-book-page-jump').on('change', '#g-book-page-jump', function () {
            const ti = parseInt($(this).data('ti'));
            const sheet = m.get(ti);
            if (!sheet) return;

            let targetPage = parseInt($(this).val());
            // 限制范围：1 到 总页数
            if (targetPage < 1) targetPage = 1;
            if (targetPage > sheet.r.length) targetPage = sheet.r.length;

            // 更新当前页码（注意转换为索引）
            currentBookPage = targetPage - 1;
            refreshBookView(ti);
        });

        // 阻止输入框的回车键冒泡（防止触发其他快捷键）
        $('#g-pop').off('keydown', '#g-book-page-jump').on('keydown', '#g-book-page-jump', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                $(this).blur(); // 触发 change 事件
            }
        });

        // =========================================================
        // 📚 侧边目录事件绑定
        // =========================================================
        // 1. 打开目录：点击"目录"按钮
        $('#g-pop').off('click', '.g-book-toc-toggle').on('click', '.g-book-toc-toggle', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const ti = parseInt($(this).data('ti'));
            $(`#g-book-toc-${ti}`).addClass('active');
            $(`#g-toc-overlay-${ti}`).addClass('active');
        });

        // 2. 关闭目录：点击遮罩层
        $('#g-pop').off('click', '.g-toc-overlay').on('click', '.g-toc-overlay', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const $overlay = $(this);
            const overlayId = $overlay.attr('id');
            const ti = overlayId.replace('g-toc-overlay-', '');
            $(`#g-book-toc-${ti}`).removeClass('active');
            $overlay.removeClass('active');
        });

        // 3. 关闭目录：点击关闭按钮
        $('#g-pop').off('click', '[id^="g-toc-close-"]').on('click', '[id^="g-toc-close-"]', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const closeId = $(this).attr('id');
            const ti = closeId.replace('g-toc-close-', '');
            $(`#g-book-toc-${ti}`).removeClass('active');
            $(`#g-toc-overlay-${ti}`).removeClass('active');
        });

        // 4. 跳转页面：点击目录项
        $('#g-pop').off('click', '.g-toc-item').on('click', '.g-toc-item', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const targetPage = parseInt($(this).data('page'));
            const ti = parseInt($(this).data('ti'));

            // 更新当前页码
            currentBookPage = targetPage;

            // 刷新笔记本视图
            refreshBookView(ti);

            // 自动关闭目录（移动端体验优化）
            $(`#g-book-toc-${ti}`).removeClass('active');
            $(`#g-toc-overlay-${ti}`).removeClass('active');
        });

        // 辅助函数：刷新笔记本视图
        function refreshBookView(tableIndex) {
            const sheet = m.get(tableIndex);
            if (!sheet) return;

            const newHtml = renderBookUI(sheet, tableIndex);
            const $container = $(`.g-tbc[data-i="${tableIndex}"]`);
            $container.replaceWith(newHtml);

            // 重新显示（如果当前选中的是这个表格）
            const activeIndex = parseInt($('.g-t.act').data('i'));
            if (activeIndex === tableIndex) {
                $(`.g-tbc[data-i="${tableIndex}"]`).css('display', 'flex');
            }
        }

        // 全选/单选逻辑
        $('#g-pop').off('click', '.g-select-all').on('click', '.g-select-all', async function (e) {
            e.preventDefault(); // 阻止默认勾选行为
            e.stopPropagation();

            const ti = parseInt($(this).data('ti'));
            const sh = m.get(ti);
            if (!sh || sh.r.length === 0) return;

            // === 修复开始：定义夜间模式颜色 ===
            const isDark = UI.darkMode; 
            const boxBg = isDark ? '#1e1e1e' : '#fff'; // 背景色：黑/白
            const borderCol = isDark ? 'rgba(255,255,255,0.15)' : '#ddd'; // 边框色
            const btnCancelBg = isDark ? '#333' : '#fff'; // 取消按钮背景
            // === 修复结束 ===

            // 自定义三选一弹窗
            const id = 'select-all-dialog-' + Date.now();
            const $overlay = $('<div>', {
                id: id,
                css: {
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.5)', zIndex: 10000005,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }
            });

            const $box = $('<div>', {
                css: {
                    background: boxBg, // 使用动态背景色
                    borderRadius: '8px', padding: '20px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)', width: '300px',
                    border: '1px solid ' + borderCol, // 使用动态边框
                    display: 'flex', flexDirection: 'column', gap: '10px'
                }
            });

            $box.append(`<div style="font-weight:bold; margin-bottom:5px; text-align:center; color:var(--g-tc);">📊 批量状态操作</div>`);
            $box.append(`<div style="font-size:12px; color:var(--g-tc); opacity:0.8; margin-bottom:10px; text-align:center;">当前表格共 ${sh.r.length} 行，请选择操作：</div>`);

            // 定义通用按钮样式
            const btnStyle = `padding:10px; border:1px solid ${borderCol}; background:transparent; border-radius:5px; cursor:pointer; color:var(--g-tc) !important; font-weight:bold; font-size:13px;`;

            // 按钮1：全部显示
            const $btnShow = $('<button>', { text: '👁️ 全部显示 (白色)' })
                .attr('style', btnStyle)
                .on('click', () => {
                if (!summarizedRows[ti]) summarizedRows[ti] = [];
                summarizedRows[ti] = []; // 清空该表的隐藏列表
                finish();
                customAlert('✅ 已将本表所有行设为显示状态', '完成');
            });

            // 按钮2：全部隐藏
            const $btnHide = $('<button>', { text: '🙈 全部隐藏 (绿色)' })
                .attr('style', btnStyle)
                .on('click', () => {
                if (!summarizedRows[ti]) summarizedRows[ti] = [];
                // 将所有行索引加入列表
                summarizedRows[ti] = Array.from({ length: sh.r.length }, (_, k) => k);
                finish();
                customAlert('✅ 已将本表所有行设为已总结(隐藏)状态', '完成');
            });

            // 按钮3：仅全选 (保留原有功能)
            const $btnSelect = $('<button>', { text: '✔️ 仅全选' })
                .attr('style', btnStyle)
                .on('click', () => {
                $overlay.remove();
                // 手动触发原本的全选勾选逻辑
                const $cb = $(`.g-select-all[data-ti="${ti}"]`);
                const isChecked = !$cb.prop('checked'); // 切换状态
                $cb.prop('checked', isChecked);
                $(`.g-tbc[data-i="${ti}"] .g-row-select`).prop('checked', isChecked);
                updateSelectedRows();
            });

            const $btnCancel = $('<button>', { text: '取消' })
                .attr('style', `padding:8px; border:1px solid ${borderCol}; background:${btnCancelBg}; border-radius:5px; cursor:pointer; margin-top:5px; color:var(--g-tc) !important;`)
                .on('click', () => $overlay.remove());

            function finish() {
                saveSummarizedRows();
                m.save();
                refreshTable(ti);
                $overlay.remove();
            }

            $box.append($btnShow, $btnHide, $btnSelect, $btnCancel);
            $overlay.append($box);
            $('body').append($overlay);
        });

        $('#g-pop').off('change', '.g-row-select').on('change', '.g-row-select', function (e) {
            e.stopPropagation();
            updateSelectedRows();
        });

        function updateSelectedRows() {
            selectedRows = [];
            $('#g-pop .g-tbc:visible .g-row').removeClass('g-selected');
            $('#g-pop .g-tbc:visible .g-row-select:checked').each(function () {
                const rowIndex = parseInt($(this).data('r'));
                selectedRows.push(rowIndex);
                $(this).closest('.g-row').addClass('g-selected');
            });
        }

        // =========================================================
        // ✅✅✅ 1. 列宽拖拽 (保持原样)
        // =========================================================
        let isColResizing = false;
        let colStartX = 0;
        let colStartWidth = 0;
        let colTableIndex = 0;
        let colName = '';
        let $th = null;

        // 1. 鼠标/手指 按下 (绑定在拖拽条上)
        $('#g-pop').off('mousedown touchstart', '.g-col-resizer').on('mousedown touchstart', '.g-col-resizer', function (e) {
            e.preventDefault();
            e.stopPropagation();

            isColResizing = true;
            colTableIndex = parseInt($(this).data('ti'));
            colName = $(this).data('col-name'); // 获取列名用于保存

            // 锁定当前表头 TH 元素
            $th = $(this).closest('th');
            colStartWidth = $th.outerWidth();

            // 记录初始 X 坐标 (兼容移动端)
            colStartX = e.type === 'touchstart' ?
                (e.originalEvent.touches[0]?.pageX || e.pageX) :
                e.pageX;

            // 样式：改变鼠标，禁用文字选中
            $('body').css({ 'cursor': 'col-resize', 'user-select': 'none' });
        });

        // 2. 鼠标/手指 移动 (绑定在文档上，防止拖太快脱离)
        $(document).off('mousemove.colresizer touchmove.colresizer').on('mousemove.colresizer touchmove.colresizer', function (e) {
            if (!isColResizing || !$th) return;

            const currentX = e.type === 'touchmove' ?
                (e.originalEvent.touches[0]?.pageX || e.pageX) :
                e.pageX;

            const deltaX = currentX - colStartX;
            const newWidth = Math.max(30, colStartWidth + deltaX); // 最小宽度限制 30px

            // ⚡ 核心修改：直接修改 TH 的宽度
            $th.css('width', newWidth + 'px');
        });

        // 3. 鼠标/手指 抬起 (结束拖拽并保存)
        $(document).off('mouseup.colresizer touchend.colresizer').on('mouseup.colresizer touchend.colresizer', function (e) {
            if (!isColResizing) return;

            // 保存最后一次的宽度到配置里
            if ($th && colName) {
                const finalWidth = $th.outerWidth();
                setColWidth(colTableIndex, colName, finalWidth);
                console.log(`✅ 列 [${colName}] 宽度已保存：${finalWidth}px`);
            }

            // 还原光标和选中状态
            $('body').css({ 'cursor': '', 'user-select': '' });

            // 重置变量
            isColResizing = false;
            $th = null;
        });

        // 4. 辅助：防止拖拽时意外选中文字
        $(document).off('selectstart.colresizer').on('selectstart.colresizer', function (e) {
            if (isColResizing) {
                e.preventDefault();
                return false;
            }
        });

        // =========================================================
        // ✅✅✅ 2. 行高拖拽 (基础修复版)
        // =========================================================
        let isRowResizing = false;
        let rowStartY = 0;
        let rowStartHeight = 0;
        let $tr = null;

        $('#g-pop').off('mousedown touchstart', '.g-row-resizer').on('mousedown touchstart', '.g-row-resizer', function (e) {
            e.preventDefault();
            e.stopPropagation();

            isRowResizing = true;
            $tr = $(this).closest('tr');

            // 获取当前格子的高度
            const firstTd = $tr.find('td').get(0);
            // 如果没有 offsetHeight，就给个默认值 45
            rowStartHeight = firstTd ? firstTd.offsetHeight : 45;

            rowStartY = e.type === 'touchstart' ? (e.originalEvent.touches[0]?.pageY || e.pageY) : e.pageY;
            $('body').css({ 'cursor': 'row-resize', 'user-select': 'none' });
        });

        $(document).off('mousemove.rowresizer touchmove.rowresizer').on('mousemove.rowresizer touchmove.rowresizer', function (e) {
            if (!isRowResizing || !$tr) return;

            if (e.type === 'touchmove') e.preventDefault();

            const currentY = e.type === 'touchmove' ? (e.originalEvent.touches[0]?.pageY || e.pageY) : e.pageY;
            const deltaY = currentY - rowStartY;

            // 计算新高度
            const newHeight = Math.max(10, rowStartHeight + deltaY);

            // 🔥 只修改 TD 的高度
            // 因为 CSS 里 .g-e 写了 height: 100%，所以它会自动跟过来
            $tr.find('td').each(function () {
                this.style.setProperty('height', newHeight + 'px', 'important');
            });
        });

        $(document).off('mouseup.rowresizer touchend.rowresizer').on('mouseup.rowresizer touchend.rowresizer', function (e) {
            if (!isRowResizing || !$tr) return;

            // ✅ 新增：获取最终高度并保存
            const finalHeight = $tr.find('td').first().outerHeight();
            // 获取当前是哪个表、哪一行
            // 注意：我们在 gtb 里给 tr 加了 data-ti 和 data-r，这里可以直接取
            const ti = $tr.data('ti');
            const ri = $tr.data('r');

            if (ti !== undefined && ri !== undefined) {
                if (!userRowHeights[ti]) userRowHeights[ti] = {};
                userRowHeights[ti][ri] = finalHeight;

                // 立即保存到数据库
                console.log(`✅ 行高已保存: 表${ti} 行${ri} = ${finalHeight}px`);
                m.save();
            }

            $('body').css({ 'cursor': '', 'user-select': '' });
            isRowResizing = false;
            $tr = null;
        });

        // =========================================================
        // 3. 其他常规事件 (编辑、删除、新增)
        // =========================================================

        // ✨✨✨ 编辑单元格：PC端双击 + 移动端长按 ✨✨✨
        let longPressTimer = null;
        let touchStartTime = 0;

        // PC端：保留双击
        $('#g-pop').off('dblclick', '.g-e').on('dblclick', '.g-e', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const ti = parseInt($('.g-t.act').data('i'));
            const ri = parseInt($(this).data('r'));
            const ci = parseInt($(this).data('c'));
            const val = $(this).text();
            $(this).blur();
            showBigEditor(ti, ri, ci, val);
        });

        // 移动端：长按触发（500ms）
        $('#g-pop').off('touchstart', '.g-e').on('touchstart', '.g-e', function (e) {
            const $this = $(this);
            touchStartTime = Date.now();

            // 清除之前的计时器
            if (longPressTimer) clearTimeout(longPressTimer);

            // 500ms后触发大框编辑
            longPressTimer = setTimeout(function () {
                // 震动反馈（如果设备支持）
                if (navigator.vibrate) navigator.vibrate(50);

                const ti = parseInt($('.g-t.act').data('i'));
                const ri = parseInt($this.data('r'));
                const ci = parseInt($this.data('c'));
                const val = $this.text();

                // 取消默认编辑行为
                $this.blur();
                $this.attr('contenteditable', 'false');

                showBigEditor(ti, ri, ci, val);

                // 恢复可编辑
                setTimeout(() => $this.attr('contenteditable', 'true'), 100);
            }, 500);
        });

        // 移动端：取消长按（手指移动或抬起时）
        $('#g-pop').off('touchmove touchend touchcancel', '.g-e').on('touchmove touchend touchcancel', '.g-e', function (e) {
            // 如果手指移动了，取消长按
            if (e.type === 'touchmove') {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }

            // 如果手指抬起，检查是否是短按（用于正常编辑）
            if (e.type === 'touchend') {
                const touchDuration = Date.now() - touchStartTime;

                // 如果按下时间小于500ms，取消长按
                if (touchDuration < 500) {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }
            }

            // touchcancel 时也清除
            if (e.type === 'touchcancel') {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }
        });

        // 失焦保存
        $('#g-pop').off('blur', '.g-e').on('blur', '.g-e', function () {
            const ti = parseInt($('.g-t.act').data('i'));
            const ri = parseInt($(this).data('r'));
            const ci = parseInt($(this).data('c'));
            const v = $(this).text().trim(); // 获取你现在看到的文字（哪怕是空的）
            const sh = m.get(ti);
            
            // 确保这行数据存在
            if (sh && sh.r[ri]) {
                // 🛑 【核心修改】绕过 sh.upd() 智能追加逻辑，直接暴力写入！
                // 只有这样，你删成空白，它才会真的变成空白
                sh.r[ri][ci] = v; 
                
                lastManualEditTime = Date.now();
                m.save(true); // 强制保存，无视熔断保护
                updateTabCount(ti);

                // ✅ 同步快照，防止回档
                updateCurrentSnapshot();
            }
        });

        // 行点击事件（用于单选）
        $('#g-pop').off('click', '.g-row').on('click', '.g-row', function (e) {
            // 排除复选框和行号列
            // ✨ 修改：移除对 g-e 的屏蔽，允许点击单元格时也选中行
            // if ($(e.target).hasClass('g-e') || $(e.target).closest('.g-e').length > 0) return;
            // 如果点的是拖拽条，也不要触发选中
            if ($(e.target).hasClass('g-row-resizer')) return;
            if ($(e.target).is('input[type="checkbox"]') || $(e.target).closest('.g-col-num').length > 0) return;

            const $row = $(this);

            // 清除其他行的选中状态
            $('.g-row').removeClass('g-selected').css({ 'background-color': '', 'outline': '' });

            // ✨✨✨ 关键：只加类名，不写颜色
            $row.addClass('g-selected');

            selectedRow = parseInt($row.data('r'));
            selectedTableIndex = parseInt($('.g-t.act').data('i'));
        });

        // 删除按钮
        let isDeletingRow = false;  // 防止并发删除
        $('#g-dr').off('click').on('click', async function () {
            if (isDeletingRow) {
                console.log('⚠️ 删除操作进行中，请稍候...');
                return;
            }

            const ti = selectedTableIndex !== null ? selectedTableIndex : parseInt($('.g-t.act').data('i'));
            const sh = m.get(ti);
            if (!sh) return;

            // ✅ 拦截：总结表（索引8）使用笔记本视图专属删除逻辑
            if (ti === 8) {
                try {
                    isDeletingRow = true;  // 锁定

                    // 获取当前页码
                    const pageToDelete = currentBookPage;
                    const totalPages = sh.r.length;

                    // 边界检查
                    if (totalPages === 0) {
                        await customAlert('⚠️ 总结表为空，无需删除', '提示');
                        return;
                    }

                    if (pageToDelete < 0 || pageToDelete >= totalPages) {
                        await customAlert('⚠️ 当前页码无效', '错误');
                        return;
                    }

                    // ✅ [新增] 弹出选择框：删除当前页 还是 删除全部
                    const deleteOption = await showDeleteOptionsDialog(pageToDelete + 1, totalPages);

                    if (deleteOption === null) {
                        return; // 用户取消
                    }

                    if (deleteOption === 'current') {
                        // 删除当前页
                        sh.del(pageToDelete);

                        // ✅ 关键：同步更新 summarizedRows[8]
                        if (summarizedRows[8]) {
                            summarizedRows[8] = summarizedRows[8]
                                .filter(ri => ri !== pageToDelete)  // 移除被删除的索引
                                .map(ri => ri > pageToDelete ? ri - 1 : ri);  // 大于删除索引的都 -1（行号前移）
                            saveSummarizedRows();
                        }

                        // ✅ 边界处理：删除后，如果当前页超过了新的总页数，将其减 1
                        if (currentBookPage >= sh.r.length && currentBookPage > 0) {
                            currentBookPage--;
                        }

                        if (typeof toastr !== 'undefined') {
                            toastr.success(`第 ${pageToDelete + 1} 页已删除`, '删除成功', { timeOut: 1500, preventDuplicates: true });
                        }

                    } else if (deleteOption === 'all') {
                        // 删除全部总结
                        const originalCount = sh.r.length;

                        // 清空总结表
                        sh.r = [];

                        // 清空已总结标记
                        if (summarizedRows[8]) {
                            summarizedRows[8] = [];
                            saveSummarizedRows();
                        }

                        // 重置页码
                        currentBookPage = 0;

                        if (typeof toastr !== 'undefined') {
                            toastr.success(`已删除全部 ${originalCount} 页总结`, '删除成功', { timeOut: 2000, preventDuplicates: true });
                        }
                    }

                    // 保存并刷新视图
                    lastManualEditTime = Date.now();
                    m.save(true);
                    updateCurrentSnapshot();
                    refreshBookView(ti);
                    updateTabCount(ti);

                } finally {
                    isDeletingRow = false;  // 解锁
                }
                return; // 提前返回，不执行后面的通用逻辑
            }

            try {
                isDeletingRow = true;  // 锁定

                if (selectedRows.length > 0) {
                    if (!await customConfirm(`确定删除选中的 ${selectedRows.length} 行？`, '确认删除')) return;
                    sh.delMultiple(selectedRows);

                    // ✅ 修复索引重映射逻辑
                    if (summarizedRows[ti]) {
                        const toDelete = new Set(selectedRows);
                        summarizedRows[ti] = summarizedRows[ti]
                            .filter(ri => !toDelete.has(ri))  // 过滤掉被删除的行
                            .map(ri => {
                                // 计算有多少个被删除的索引小于当前索引
                                const offset = selectedRows.filter(delIdx => delIdx < ri).length;
                                return ri - offset;  // 新索引 = 原索引 - 前面被删除的数量
                            });
                        saveSummarizedRows();
                    }

                    selectedRows = [];
                } else if (selectedRow !== null) {
                    if (!await customConfirm(`确定删除第 ${selectedRow} 行？`, '确认删除')) return;
                    sh.del(selectedRow);

                    // ✅ 修复索引重映射逻辑
                    if (summarizedRows[ti]) {
                        summarizedRows[ti] = summarizedRows[ti]
                            .filter(ri => ri !== selectedRow)  // 过滤掉被删除的行
                            .map(ri => ri > selectedRow ? ri - 1 : ri);  // 大于删除索引的都 -1
                        saveSummarizedRows();
                    }

                    selectedRow = null;
                } else {
                    await customAlert('请先选中要删除的行（勾选复选框或点击行）', '提示');
                    return;
                }

                lastManualEditTime = Date.now();
                m.save(true);

                updateCurrentSnapshot();

                refreshTable(ti);
                updateTabCount(ti);

            } finally {
                isDeletingRow = false;  // 解锁
                $('.g-row-select').prop('checked', false);
                $('.g-select-all').prop('checked', false);
            }
        });

        // Delete键删除
        $(document).off('keydown.deleteRow').on('keydown.deleteRow', function (e) {
            if (e.key === 'Delete' && (selectedRow !== null || selectedRows.length > 0) && $('#g-pop').length > 0) {
                if ($(e.target).hasClass('g-e') || $(e.target).is('input, textarea')) return;
                $('#g-dr').click();
            }
        });

        // 新增行
        $('#g-ad').off('click').on('click', async function () {
            const ti = parseInt($('.g-t.act').data('i'));
            const sh = m.get(ti);
            if (!sh) return;

            // ✅ 拦截：总结表（索引8）使用笔记本视图专属新增逻辑
            if (ti === 8) {
                // 获取当前页码
                const insertAfterPage = currentBookPage;

                // 创建新行
                const nr = {};
                sh.c.forEach((_, i) => nr[i] = '');

                // 在当前页之后插入
                sh.ins(nr, insertAfterPage);

                // ✅ 关键：同步更新 summarizedRows[8]
                // 所有大于 currentBookPage 的索引值加 1（因为插入新页后，后面的行号后移了）
                if (summarizedRows[8]) {
                    summarizedRows[8] = summarizedRows[8].map(ri => {
                        return ri > insertAfterPage ? ri + 1 : ri;
                    });
                    saveSummarizedRows();
                }

                // ✅ 跳转：将 currentBookPage 加 1，自动翻页到这个新页面
                currentBookPage = insertAfterPage + 1;

                // 保存并刷新视图
                lastManualEditTime = Date.now();
                m.save(true);
                updateCurrentSnapshot();
                refreshBookView(ti);
                updateTabCount(ti);

                if (typeof toastr !== 'undefined') {
                    toastr.success(`已在第 ${insertAfterPage + 1} 页之后插入新页`, '新增成功', { timeOut: 1500, preventDuplicates: true });
                } else {
                    await customAlert(`✅ 已在第 ${insertAfterPage + 1} 页之后插入新页`, '完成');
                }

                return; // 提前返回，不执行后面的通用逻辑
            }

            // 通用逻辑：其他表格
            const nr = {};
            sh.c.forEach((_, i) => nr[i] = '');

            // 🔥 核心修改：优先在选中行下方插入
            let targetIndex = null;
            if (selectedRow !== null) {
                targetIndex = selectedRow; // 优先使用高亮行
            } else if (selectedRows && selectedRows.length > 0) {
                targetIndex = Math.max(...selectedRows); // 备选：复选框选中的最后一行
            }

            if (targetIndex !== null) {
                sh.ins(nr, targetIndex);
                console.log(`✅ 在索引 ${targetIndex} 后插入新行`);
            } else {
                sh.ins(nr); // 默认追加到末尾
            }

            lastManualEditTime = Date.now();
            m.save(true);
            refreshTable(ti);
            updateTabCount(ti);
            updateCurrentSnapshot();
        });

        // ✨✨✨ 新增：导入功能 (支持 JSON/TXT + 智能识别 + 增强兼容性) ✨✨✨
        $('#g-im').off('click').on('click', function () {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json, .txt, application/json, text/plain'; // ✅ 增强兼容性
            input.style.display = 'none';
            document.body.appendChild(input); // ✅ 确保挂载到 DOM

            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) {
                    // 用户取消选择，移除 input 元素
                    if (input.parentNode) {
                        document.body.removeChild(input);
                    }
                    return;
                }

                const reader = new FileReader();

                // ✅ 必须保留 async，否则后面的 await 会报错
                reader.onload = async event => {
                    try {
                        const jsonStr = event.target.result;
                        const data = JSON.parse(jsonStr);

                        // 兼容 's' (导出文件) 和 'd' (内部存档) 两种格式
                        const sheetsData = data.s || data.d;

                        if (!sheetsData || !Array.isArray(sheetsData)) {
                            // 🎨 美化：使用自定义弹窗报错
                            await customAlert('❌ 错误：这不是有效的记忆表格备份文件！\n(找不到数据数组)', '导入失败');
                            return;
                        }

                        // 🔍 智能识别数据结构
                        const sheetCount = sheetsData.length;
                        let importMode = 'full'; // 默认全量恢复
                        let confirmMsg = '';

                        if (sheetCount === 9) {
                            // 包含 9 个表格（详情表 0-7 + 总结表 8）
                            importMode = 'full';
                            confirmMsg = '📦 检测到完整备份（9 个表格）\n\n将恢复所有详情表和总结表';
                        } else if (sheetCount === 8) {
                            // 仅包含详情表 (0-7)
                            importMode = 'details';
                            confirmMsg = '📊 检测到详情表备份（8 个表格）\n\n将仅恢复详情表，保留现有总结表';
                        } else if (sheetCount === 1) {
                            // 仅包含总结表
                            importMode = 'summary';
                            confirmMsg = '📝 检测到总结表备份（1 个表格）\n\n将仅恢复总结表，保留现有详情表';
                        } else {
                            await customAlert(`⚠️ 数据格式异常！\n\n表格数量: ${sheetCount}\n预期: 1、8 或 9 个表格`, '格式错误');
                            return;
                        }

                        const timeStr = data.ts ? new Date(data.ts).toLocaleString() : (data.t ? new Date(data.t).toLocaleString() : '未知时间');

                        // 🎨 美化：使用自定义确认框
                        const fullConfirmMsg = `⚠️ 确定要导入吗？\n\n${confirmMsg}\n\n📅 备份时间: ${timeStr}\n\n这将覆盖对应的表格内容！`;
                        if (!await customConfirm(fullConfirmMsg, '确认导入')) return;

                        // 开始恢复（根据模式智能恢复）
                        if (importMode === 'full') {
                            // 全量恢复：覆盖所有表格
                            m.s.forEach((sheet, i) => {
                                if (sheetsData[i]) sheet.from(sheetsData[i]);
                            });
                        } else if (importMode === 'details') {
                            // 仅恢复详情表 (0-7)
                            for (let i = 0; i < 8 && i < sheetsData.length; i++) {
                                if (sheetsData[i]) m.s[i].from(sheetsData[i]);
                            }
                        } else if (importMode === 'summary') {
                            // 仅恢复总结表 (8)
                            if (sheetsData[0] && m.s[8]) {
                                m.s[8].from(sheetsData[0]);
                            }
                        }

                        if (data.summarized) summarizedRows = data.summarized;

                        // 强制保存并刷新
                        lastManualEditTime = Date.now();
                        m.save();
                        shw();

                        // 🎨 美化：成功提示（告知用户恢复了哪部分）
                        let successMsg = '✅ 导入成功！\n\n';
                        if (importMode === 'full') {
                            successMsg += '已恢复：所有详情表 + 总结表';
                        } else if (importMode === 'details') {
                            successMsg += '已恢复：详情表 (0-7)\n保留：现有总结表';
                        } else if (importMode === 'summary') {
                            successMsg += '已恢复：总结表\n保留：现有详情表';
                        }
                        await customAlert(successMsg, '完成');

                        updateCurrentSnapshot();

                    } catch (err) {
                        // 🎨 美化：异常提示
                        await customAlert('❌ 读取文件失败: ' + err.message, '错误');
                    } finally {
                        // ✅ 无论成功失败，都要移除 input 元素
                        if (input.parentNode) {
                            document.body.removeChild(input);
                        }
                    }
                };
                reader.readAsText(file);
            };

            input.value = ''; // ✅ 允许重复选择同一文件
            input.click();
        });

        $('#g-sm').off('click').on('click', () => {
            if (window.Gaigai.SummaryManager && typeof window.Gaigai.SummaryManager.showUI === 'function') {
                window.Gaigai.SummaryManager.showUI();
            } else {
                console.error('❌ [总结控制台] SummaryManager 未加载');
                customAlert('总结控制台未加载，请刷新页面重试', '错误');
            }
        });
        // ✨✨✨ 新增：导出选项窗口 ✨✨✨
        // ✨✨✨ 导出选项窗口 (轻量级模态窗) ✨✨✨
        function showExportOptions() {
            // 🌙 获取主题配置
            const isDark = UI.darkMode;
            const themeColor = UI.c;
            const textColor = UI.tc;

            // 1. 创建遮罩层
            const $overlay = $('<div>', {
                id: 'g-export-overlay',
                css: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 10000005,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    boxSizing: 'border-box'
                }
            });

            // 2. 创建小窗口容器
            const $box = $('<div>', {
                css: {
                    background: isDark ? '#1e1e1e' : '#fff',
                    color: textColor,
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    width: '320px',
                    maxWidth: '90vw',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative',
                    transform: 'scale(1)',
                    transition: 'all 0.2s'
                }
            });

            // 3. 标题
            const $title = $('<h3>', {
                text: '📥 导出备份',
                css: {
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    textAlign: 'center',
                    color: textColor
                }
            });

            // 4. 提示文字
            const $desc = $('<div>', {
                text: '请选择要导出的内容',
                css: {
                    fontSize: '12px',
                    color: textColor,
                    opacity: '0.8',
                    marginBottom: '8px',
                    textAlign: 'center'
                }
            });

            // 4.5. 格式选择复选框 (TXT 方便手机传输)
            const $formatContainer = $('<div>', {
                css: {
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa',
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0'
                }
            });

            const $formatCheckbox = $('<input>', {
                type: 'checkbox',
                id: 'export-txt-format',
                css: {
                    cursor: 'pointer',
                    width: '16px',
                    height: '16px'
                }
            });

            const $formatLabel = $('<label>', {
                for: 'export-txt-format',
                html: `📄 保存为 TXT 格式 <span style="font-size:11px;color:${textColor};opacity:0.6;">(方便手机传输)</span>`,
                css: {
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: textColor,
                    flex: 1,
                    userSelect: 'none'
                }
            });

            $formatContainer.append($formatCheckbox, $formatLabel);

            // 5. 按钮样式模板
            const btnStyle = {
                width: '100%',
                padding: '12px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: UI.tc,  // ✅【修正点】这里改成 UI.tc，跟随主题字体颜色
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            };

            // 6. 导出函数封装 (保持不变)
            function performExport(data, baseFilename, useTxtFormat = false) {
                // ... (这部分逻辑不用动，省略以节省空间) ...
                const exportData = { v: V, t: new Date().toISOString(), s: data.map(s => s.json()) };
                const jsonStr = JSON.stringify(exportData, null, 2);
                const extension = useTxtFormat ? '.txt' : '.json';
                const mimeType = useTxtFormat ? 'text/plain' : 'application/json';
                const filename = baseFilename.replace(/\.(json|txt)$/, '') + extension;
                const blob = new Blob([jsonStr], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = filename; a.click();
                URL.revokeObjectURL(url);
                $overlay.remove();
            }

            // 7. 全部导出按钮
            const $btnAll = $('<button>', {
                html: '📦 全部导出 (含总结)',
                css: { ...btnStyle, background: UI.c }
            }).on('click', function () {
                const useTxt = $formatCheckbox.is(':checked');
                performExport(m.all(), `memory_table_all_${m.gid()}_${Date.now()}`, useTxt);
            }).hover(
                function () { $(this).css('filter', 'brightness(0.9)'); },
                function () { $(this).css('filter', 'brightness(1)'); }
            );

            // 8. 仅导出总结按钮
            const $btnSummary = $('<button>', {
                html: '📝 仅导出总结',
                css: { ...btnStyle, background: UI.c, opacity: '0.9' }
            }).on('click', function () {
                const summarySheet = m.get(8);
                if (!summarySheet || summarySheet.r.length === 0) {
                    customAlert('当前没有总结数据可导出', '提示');
                    return;
                }
                const useTxt = $formatCheckbox.is(':checked');
                performExport([summarySheet], `memory_table_summary_${m.gid()}_${Date.now()}`, useTxt);
            }).hover(
                function () { $(this).css('filter', 'brightness(0.9)'); },
                function () { $(this).css('filter', 'brightness(1)'); }
            );

            // 9. 仅导出详情按钮
            const $btnDetails = $('<button>', {
                html: '📊 仅导出详情 (不含总结)',
                css: { ...btnStyle, background: UI.c, opacity: '0.8' }
            }).on('click', function () {
                const useTxt = $formatCheckbox.is(':checked');
                performExport(m.all().slice(0, 8), `memory_table_details_${m.gid()}_${Date.now()}`, useTxt);
            }).hover(
                function () { $(this).css('filter', 'brightness(0.9)'); },
                function () { $(this).css('filter', 'brightness(1)'); }
            );

            // 10. 取消按钮 (背景跟随主题色，但透明度降低以示区分)
            const $btnCancel = $('<button>', {
                text: '取消',
                css: {
                    ...btnStyle,
                    background: UI.c,      // ✅ 背景：跟随主题色
                    color: UI.tc,          // ✅ 文字：跟随字体设置
                    opacity: '0.6',        // ✅ 关键：降低透明度，表明它是"取消"操作，且不与上方按钮混淆
                    marginTop: '8px'
                }
            }).on('click', function () {
                $overlay.remove();
            }).hover(
                // 悬停时加深一点，增加交互感
                function () { $(this).css({ 'filter': 'brightness(0.9)', 'opacity': '0.8' }); },
                function () { $(this).css({ 'filter': 'brightness(1)', 'opacity': '0.6' }); }
            );

            // 11. 提示信息
            const $tip = $('<div>', {
                html: `💡 提示：<br>
                • 全部导出：包含所有9个表格<br>
                • 仅导出总结：仅第9个总结表<br>
                • 仅导出详情：前8个详情表`,
                css: {
                    padding: '10px',
                    background: 'rgba(33, 150, 243, 0.1)',
                    borderRadius: '6px',
                    fontSize: '10px',
                    color: '#1976d2',
                    lineHeight: '1.5',
                    marginTop: '4px'
                }
            });

            // 12. 组装窗口
            $box.append($title, $desc, $formatContainer, $btnAll, $btnSummary, $btnDetails, $btnCancel, $tip);
            $overlay.append($box);
            $('body').append($overlay);

            // 13. 绑定点击遮罩层关闭
            $overlay.on('click', function (e) {
                if (e.target === $overlay[0]) {
                    $overlay.remove();
                }
            });

            // 14. ESC键关闭
            $(document).on('keydown.exportOverlay', function (e) {
                if (e.key === 'Escape') {
                    $(document).off('keydown.exportOverlay');
                    $overlay.remove();
                }
            });
        }

        $('#g-ex').off('click').on('click', showExportOptions);
        $('#g-reset-width').off('click').on('click', showViewSettings);
        // ✅✅ 新增：清空表格（保留总结）
        $('#g-clear-tables').off('click').on('click', async function () {
            const hasSummary = m.sm.has();
            let confirmMsg = '确定清空所有详细表格吗？\n\n';

            if (hasSummary) {
                confirmMsg += '✅ 记忆总结将会保留\n';
                confirmMsg += '🗑️ 前8个表格的详细数据将被清空\n\n';
                confirmMsg += '建议先导出备份。';
            } else {
                confirmMsg += '⚠️ 当前没有总结，此操作将清空所有表格！\n\n建议先导出备份。';
            }

            if (!await customConfirm(confirmMsg, '清空表格')) return;

            // 只清空前8个表格（保留第9个总结表）
            m.all().slice(0, 8).forEach(s => s.clear());
            clearSummarizedMarks();
            lastManualEditTime = Date.now(); // ✨ 新增
            m.save();

            await customAlert(hasSummary ?
                '✅ 表格已清空，总结已保留\n\n下次聊天时AI会看到总结，从第0行开始记录新数据。' :
                '✅ 所有表格已清空',
                '完成'
            );

            $('#g-pop').remove();
            shw();
        });

        // ✅✅ 修改：全部清空（含总结）
        $('#g-ca').off('click').on('click', async function () {
            const hasSummary = m.sm.has();
            let confirmMsg = '⚠️⚠️⚠️ 危险操作 ⚠️⚠️⚠️\n\n确定清空所有数据吗？\n\n';

            if (hasSummary) {
                confirmMsg += '🗑️ 将删除所有详细表格\n';
                confirmMsg += '🗑️ 将删除记忆总结\n';
                confirmMsg += '🗑️ 将重置所有标记\n\n';
                confirmMsg += '💡 提示：如果想保留总结，请使用"清表格"按钮\n\n';
            } else {
                confirmMsg += '🗑️ 将删除所有表格数据\n\n';
            }

            confirmMsg += '此操作不可恢复！强烈建议先导出备份！';

            if (!await customConfirm(confirmMsg, '⚠️ 全部清空')) return;

            // 1. 清空所有表格（包括总结）
            m.all().forEach(s => s.clear());
            clearSummarizedMarks();
            lastManualEditTime = Date.now();

            // 2. 重置总结进度
            API_CONFIG.lastSummaryIndex = 0;
            API_CONFIG.lastBackfillIndex = 0;  // ✅ 修复：同时重置批量填表进度
            localStorage.setItem(AK, JSON.stringify(API_CONFIG));

            // 🌐 同步重置后的配置到云端
            await saveAllSettingsToCloud();

            // ✨✨✨ 关键修改：传入 true，强制突破熔断保护 ✨✨✨
            m.save(true);

            // ✨✨✨ 强制告诉酒馆保存当前状态 ✨✨✨
            if (m.ctx() && typeof m.ctx().saveChat === 'function') {
                m.ctx().saveChat();
                console.log('💾 [全清] 已强制触发酒馆保存，防止数据复活。');
            }

            // 3. 🛑 核心修复：彻底销毁所有历史快照，防止数据复活
            snapshotHistory = {};

            // 4. 重建一个空白的创世快照(-1)，确保系统知道现在是空的
            snapshotHistory['-1'] = {
                data: m.all().slice(0, 8).map(sh => JSON.parse(JSON.stringify(sh.json()))),
                summarized: {},
                timestamp: 0
            };

            console.log('💥 [全清执行] 所有数据已销毁，无法回档。');

            await customAlert('✅ 所有数据已清空（包括总结）', '完成');

            $('#g-pop').remove();
            shw();
        });
        $('#g-tm').off('click').on('click', () => navTo('主题设置', shtm));
        $('#g-bf').off('click').on('click', () => navTo('⚡ 剧情追溯填表', () => window.Gaigai.BackfillManager.showUI()));
        $('#g-cf').off('click').on('click', () => navTo('配置', shcf));

        // ✨✨✨ 修改：移除显隐操作的成功弹窗，只刷新表格 ✨✨✨
        // ✨✨✨ 新增：显/隐按钮逻辑（含总结表专属弹窗） ✨✨✨
        $('#g-toggle-sum').off('click').on('click', async function () {
            const ti = selectedTableIndex !== null ? selectedTableIndex : parseInt($('.g-t.act').data('i'));
            const sh = m.get(ti);

            // 0. 空表拦截
            if (!sh || sh.r.length === 0) {
                await customAlert('⚠️ 当前表格没有任何数据，无法执行显/隐操作。', '无数据');
                return;
            }

            // ✅ 分支 A：总结表 (Index 8) 专属操作面板
            if (ti === 8) {
                const id = 'sum-toggle-dialog-' + Date.now();
                const $overlay = $('<div>', {
                    id: id,
                    css: {
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        width: '100vw', height: '100vh',
                        background: 'rgba(0,0,0,0.5)', zIndex: 10000020,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }
                });

                const $box = $('<div>', {
                    css: {
                        background: '#fff', borderRadius: '12px', padding: '20px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                        width: '320px', maxWidth: '90vw', // ✨ 手机端自适应宽度
                        display: 'flex', flexDirection: 'column', gap: '10px'
                    }
                });

                const currentPageNum = currentBookPage + 1; // 转为人类可读的页码
                const totalPages = sh.r.length;
                const isCurrentHidden = isSummarized(8, currentBookPage);

                $box.append(`<div style="font-weight:bold; font-size:15px; text-align:center; color:#333;">👁️ 总结显/隐控制</div>`);
                $box.append(`<div style="font-size:12px; color:#666; text-align:center; margin-bottom:5px;">当前：第 ${currentPageNum} / ${totalPages} 篇</div>`);

                // 按钮样式
                const btnCss = "padding:10px; border:none; border-radius:6px; cursor:pointer; font-size:13px; color:#fff; font-weight:600; text-align:left; padding-left:15px;";

                // 1. 切换当前页
                const $btnCurrent = $('<button>', {
                    html: isCurrentHidden ? '👁️ 显示当前页 (第' + currentPageNum + '篇)' : '🙈 隐藏当前页 (第' + currentPageNum + '篇)',
                    css: btnCss + (isCurrentHidden ? "background:#17a2b8;" : "background:#ffc107; color:#333;")
                }).on('click', () => {
                    toggleRow(8, currentBookPage);
                    finish(`第 ${currentPageNum} 篇状态已切换`);
                });

                // 2. 隐藏/显示所有
                const $btnAll = $('<button>', {
                    html: '📚 将所有页面设为【隐藏/已归档】',
                    css: btnCss + "background:#28a745;"
                }).on('click', () => {
                    if (!summarizedRows[8]) summarizedRows[8] = [];
                    summarizedRows[8] = Array.from({ length: totalPages }, (_, k) => k);
                    finish('所有页面已设为隐藏');
                });

                // 3. 指定范围输入区
                const $rangeArea = $('<div>', { css: { display: 'flex', gap: '5px', marginTop: '5px', alignItems: 'center' } });
                const $rangeInput = $('<input>', {
                    type: 'text',
                    placeholder: '例: 1-3, 5',
                    css: {
                        flex: '1 1 auto',
                        minWidth: '0', // ✨ 关键：允许收缩到最小
                        padding: '6px 8px', // ✨ 减小内边距
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '12px',
                        boxSizing: 'border-box'
                    }
                });
                const $rangeBtn = $('<button>', {
                    text: '执行',
                    css: {
                        flex: '0 0 auto', // ✨ 按钮不伸缩
                        padding: '6px 12px', // ✨ 减小内边距
                        background: '#6c757d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap' // ✨ 防止文字换行
                    }
                }).on('click', () => {
                    const val = $rangeInput.val().trim();
                    if (!val) return;
                    processRange(val);
                });

                $rangeArea.append($rangeInput, $rangeBtn);

                const $cancelBtn = $('<button>', {
                    text: '取消',
                    css: "padding:8px; background:transparent; border:1px solid #ddd; border-radius:6px; color:#666; margin-top:5px; cursor:pointer;"
                }).on('click', () => $overlay.remove());

                // --- 辅助逻辑 ---
                function toggleRow(ti, ri) {
                    if (!summarizedRows[ti]) summarizedRows[ti] = [];
                    const idx = summarizedRows[ti].indexOf(ri);
                    if (idx > -1) summarizedRows[ti].splice(idx, 1);
                    else summarizedRows[ti].push(ri);
                }

                function processRange(str) {
                    if (!summarizedRows[8]) summarizedRows[8] = [];
                    const parts = str.split(/[,，]/);
                    let count = 0;
                    parts.forEach(p => {
                        if (p.includes('-')) {
                            const [s, e] = p.split('-').map(Number);
                            if (!isNaN(s) && !isNaN(e)) {
                                for (let i = s; i <= e; i++) {
                                    if (i > 0 && i <= totalPages) {
                                        if (!summarizedRows[8].includes(i - 1)) {
                                            summarizedRows[8].push(i - 1);
                                            count++;
                                        }
                                    }
                                }
                            }
                        } else {
                            const idx = parseInt(p);
                            if (!isNaN(idx) && idx > 0 && idx <= totalPages) {
                                if (!summarizedRows[8].includes(idx - 1)) {
                                    summarizedRows[8].push(idx - 1);
                                    count++;
                                }
                            }
                        }
                    });
                    finish(`已将指定范围内的 ${count} 篇设为隐藏`);
                }

                function finish(msg) {
                    saveSummarizedRows();
                    m.save(true);
                    // 刷新总结视图
                    const renderBookUI = window.Gaigai.renderBookUI || (function(){}); // 防止未引用
                    // 重新渲染当前页
                    if ($('.g-t.act').data('i') === 8) {
                         refreshTable(8); // 使用 refreshTable 刷新
                    }
                    $overlay.remove();
                    if (typeof toastr !== 'undefined') toastr.success(msg);
                }

                $box.append($btnCurrent, $btnAll, $rangeArea, $cancelBtn);
                $overlay.append($box);
                $('body').append($overlay);
                return;
            }

            // ✅ 分支 B: 普通表格 (Index 0-7) 的原有逻辑 (保持不变)
            if (selectedRows.length > 0) {
                if (!summarizedRows[ti]) summarizedRows[ti] = [];
                selectedRows.forEach(ri => {
                    const idx = summarizedRows[ti].indexOf(ri);
                    if (idx > -1) summarizedRows[ti].splice(idx, 1);
                    else summarizedRows[ti].push(ri);
                });
                saveSummarizedRows();
                m.save(true);
                refreshTable(ti);
                // await customAlert(...) // 原有弹窗可移除
            } else if (selectedRow !== null) {
                if (!summarizedRows[ti]) summarizedRows[ti] = [];
                const idx = summarizedRows[ti].indexOf(selectedRow);
                if (idx > -1) summarizedRows[ti].splice(idx, 1);
                else summarizedRows[ti].push(selectedRow);
                saveSummarizedRows();
                m.save(true);
                refreshTable(ti);
            } else {
                await customAlert('请先选中要操作的行（勾选复选框或点击行）', '提示');
            }
        });
    }

    function refreshTable(ti) {
        const sh = m.get(ti);
        const rowCount = sh.r.length;

        console.log(`🔄 [刷新表格] 表${ti}，当前行数：${rowCount}`);

        $(`.g-tbc[data-i="${ti}"]`).html($(gtb(sh, ti)).html());
        selectedRow = null;
        selectedRows = [];
        bnd();

        // ✅ 强制浏览器重排，防止 UI 假死
        document.getElementById('g-pop').offsetHeight;

        console.log(`✅ [刷新完成] 表${ti} UI已更新`);
    }

    function updateTabCount(ti) {
        const sh = m.get(ti);
        const displayName = ti === 1 ? '支线剧情' : sh.n;
        $(`.g-t[data-i="${ti}"]`).text(`${displayName} (${sh.r.length})`);
    }

    // ========================================================================
    // ========== AI总结功能模块 ==========
    // ========================================================================

    /**
     * 分批总结执行函数
     * 将大范围的总结任务切分成多个小批次顺序执行
     * @param {number} start - 起始楼层
     * @param {number} end - 结束楼层
     * @param {number} step - 每批的层数
     * @param {string} mode - 总结模式 'chat' 或 'table'
     * @param {boolean} silent - 是否静默执行（不弹窗确认每批）
     */
    /**
     * ✅✅✅ callAIForSummary 已完全迁移到 summary_manager.js
     *
     * 注意：此函数已不存在于 index.js，所有调用都应通过
     * window.Gaigai.SummaryManager.callAIForSummary() 进行
     */

    // ✅✅✅ 修正版：接收模式参数，精准控制弹窗逻辑 (修复黑色背景看不清问题)
    // ✅✅✅ showSummaryPreview 函数已迁移到 summary_manager.js

    function clearSummarizedData() {
        Object.keys(summarizedRows).forEach(ti => {
            const tableIndex = parseInt(ti);
            const sh = m.get(tableIndex);
            if (sh && summarizedRows[ti] && summarizedRows[ti].length > 0) {
                sh.delMultiple(summarizedRows[ti]);
            }
        });

        clearSummarizedMarks();
        m.save();
    }

    /* ==========================================
       URL 处理工具函数
       ========================================== */
    /**
     * URL 清洗、IP 修正和智能补全工具函数
     * @param {string} url - 原始 URL
     * @param {string} provider - API 提供商类型
     * @returns {string} - 处理后的 URL
     */
    function processApiUrl(url, provider) {
        if (!url) return '';

        // 如果是“独立反代”模式，直接原样返回！
        if (provider === 'proxy_only') {
            return url.trim(); 
        }


        // 1. 去除末尾斜杠
        url = url.trim().replace(/\/+$/, '');

        // 2. IP 修正：0.0.0.0 -> 127.0.0.1
        url = url.replace(/0\.0\.0\.0/g, '127.0.0.1');

        // 3. 智能补全 /v1
        // 如果 URL 不包含 /v1 且不包含 /chat 或 /models，且看起来像根域名
        // ✅ [修复] local provider 用户经常使用自定义端点（如 Oobabooga），不自动添加 /v1
        if (provider !== 'gemini' && provider !== 'claude' && provider !== 'local') {
            const urlParts = url.split('/');
            const isRootDomain = urlParts.length <= 3; // http://domain 或 http://domain:port

            if (!url.includes('/v1') &&
                !url.includes('/chat') &&
                !url.includes('/models') &&
                isRootDomain) {
                url = url + '/v1';
                console.log('🔧 [URL智能补全] 已自动添加 /v1 后缀:', url);
            }
        }

        return url;
    }

    /* ==========================================
       智能双通道 API 请求函数 (全面防屏蔽版)
       ========================================== */
    async function callIndependentAPI(prompt) {
        console.log('🚀 [API-独立模式] 智能路由启动...');

        // ========================================
        // 1. 准备数据
        // ========================================
        const model = API_CONFIG.model || 'gpt-3.5-turbo';
        let apiUrl = API_CONFIG.apiUrl.trim();
        const apiKey = API_CONFIG.apiKey.trim();  // 不做任何修改，保持原值（可能为空）
        // 如果用户没填或配置不存在，默认使用 8192 以防止报错
        const maxTokens = API_CONFIG.maxTokens || 8192;
        const temperature = API_CONFIG.temperature || 0.5;
        const provider = API_CONFIG.provider || 'openai';

        // ✅ URL 处理：使用统一工具函数（包含 0.0.0.0 -> 127.0.0.1 转换）
        apiUrl = processApiUrl(apiUrl, provider);
        console.log('🔧 [URL处理完成]:', apiUrl);

        // 数据清洗：System -> User (兼容性处理)
        let rawMessages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: String(prompt) }];
        const cleanMessages = rawMessages.map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.role === 'system' ? ('[System]: ' + m.content) : m.content
        }));

        // ========================================
        // 按需鉴权：只有当 Key 不为空时才构造 Authorization Header
        // ========================================
        let authHeader = undefined;
        if (apiKey) {
            authHeader = apiKey.startsWith('Bearer ') ? apiKey : ('Bearer ' + apiKey);
            console.log('🔑 [按需鉴权] Authorization Header 已构造 (Key 不为空)');
        } else {
            console.log('🔓 [无密码模式] 未检测到 API Key，跳过 Authorization Header');
        }

        // 🔧 Gemini 鉴权兼容性修复：智能判断是否使用 Authorization Header
        if (provider === 'gemini' && apiUrl.includes('googleapis.com')) {
            // 官方 Gemini API 使用 URL 参数鉴权 (key=xxx)，不能发送 Authorization Header
            // 否则会导致 401 错误
            console.log('🔍 检测到 Gemini 官方域名，禁用 Authorization Header (使用 URL 参数鉴权)');
            authHeader = undefined;
        } else if (provider === 'gemini' && authHeader) {
            // 自定义域名 (如 NewAPI/OneAPI 代理) 需要保留 Authorization Header
            console.log('🔧 检测到 Gemini 自定义域名，保留 Authorization Header (代理兼容模式)');
        }

        // ========================================
        // 分流逻辑
        // ========================================
const useProxy = (provider === 'local' || provider === 'openai' || provider === 'claude'|| provider === 'proxy_only' || provider === 'deepseek'|| provider === 'siliconflow');
const useDirect = (provider === 'compatible' || provider === 'gemini');

       // ==========================================
        // 🔴 通道 A: 后端代理 (local, openai, claude, proxy_only)
        // ==========================================
        if (useProxy) {
            try {
                console.log('📡 [后端代理模式] 通过酒馆后端发送请求...');

                // 获取 CSRF Token
                let csrfToken = '';
                try { csrfToken = await getCsrfToken(); } catch (e) { console.warn('⚠️ CSRF获取失败', e); }

                // ✨✨✨【修复插入点：智能拦截】✨✨✨
                // 只有当：提供商是"网页反代" (proxy_only) 且 模型名含"gemini"时，才走 Makersuite 修复路
                // 本地反代 (local) 走标准 custom 协议
                const isProxyGemini = (provider === 'proxy_only') && model.toLowerCase().includes('gemini');

                if (isProxyGemini) {
                    // === 分支 1: 针对网页端 Gemini 反代 (MakerSuite 修复逻辑) ===
                    console.log('🔧 [智能修正] 命中网页端 Gemini 反代，使用 Makersuite 协议...');
                    
                    // 1. URL 清洗：只留 Base URL
                    let cleanBaseUrl = apiUrl.replace(/\/v1(\/|$)/, '').replace(/\/chat\/completions(\/|$)/, '').replace(/\/+$/, '');
                    
                    // 2. 构造 Makersuite Payload (你验证通过的满分答案)
                    const proxyPayload = {
                        chat_completion_source: "makersuite",
                        reverse_proxy: cleanBaseUrl,
                        proxy_password: apiKey,
                        model: model,
                        messages: cleanMessages,
                        temperature: temperature,
                        max_tokens: maxTokens,
                        stream: false,
                        custom_prompt_post_processing: "strict",
                        use_makersuite_sysprompt: true,
                        safetySettings: [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                        ]
                    };

                    const proxyResponse = await fetch('/api/backends/chat-completions/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify(proxyPayload)
                    });

                    if (proxyResponse.ok) {
                        const text = await proxyResponse.text();
                        try {
                            const data = JSON.parse(text);
                            // 兼容 Makersuite 的各种返回
                            if (typeof data === 'string') return { success: true, summary: data };
                            if (data.choices?.[0]?.message?.content) return { success: true, summary: data.choices[0].message.content };
                            if (data.content) return { success: true, summary: data.content };
                            return { success: true, summary: text };
                        } catch (e) { return { success: true, summary: text }; }
                    }
                    const errText = await proxyResponse.text();
                    throw new Error(`反代修复模式报错: ${errText}`);

                } else {
                    // === 分支 2: 标准 Custom 协议 (本地反代 + OpenAI + Claude 等) ===
                    // 包括：本地反代(local)、OpenAI、Claude 等标准后端代理

                    // === 智能分流修复 (Key优先级 + 404修复) ===
                    
                    // 1. URL 清洗：OpenAI 模式会自动加 /chat/completions，如果用户填了，要剪掉
                    let cleanBaseUrl = apiUrl;
                    if (cleanBaseUrl.endsWith('/chat/completions')) {
                        cleanBaseUrl = cleanBaseUrl.replace(/\/chat\/completions\/?$/, '');
                    }

                    // 2. 确定模式：Claude 用 claude，其他(OpenAI/DeepSeek/反代)全用 openai
                    let targetSource = 'openai';
                    if (provider === 'claude') targetSource = 'claude';

                    // 构建酒馆后端代理 Payload
                    const proxyPayload = {
                        chat_completion_source: targetSource,
                        reverse_proxy: cleanBaseUrl,
                        proxy_password: apiKey,
                        
                        // 兼容字段 (留着保险)
                        custom_url: apiUrl,

                        // ✅ 基础 Headers
                        custom_include_headers: {
                            "Content-Type": "application/json"
                        },

                        model: model,
                        messages: cleanMessages,
                        temperature: temperature,
                        max_tokens: maxTokens,
                        stream: false,

                        // 兼容性参数
                        mode: 'chat',
                        instruction_mode: 'chat'
                    };

                    // ✨✨✨【Gemini 专享修复】即使是反代/本地，只要模型名含 gemini，强制注入安全设置 ✨✨✨
                    if (model.toLowerCase().includes('gemini')) {
                        console.log('🛡️ [后端代理] 检测到 Gemini 模型，强制注入安全豁免...');
                        // 注入 OpenAI 格式的安全设置 (兼容大多数中转)
                        proxyPayload.safety_settings = [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                        ];
                        // 注入 Gemini 原生格式 (双重保险)
                        proxyPayload.safetySettings = proxyPayload.safety_settings;
                        // 注入酒馆专用字段 (三重保险)
                        proxyPayload.gemini_safety_settings = proxyPayload.safety_settings;
                    }

                    // 🔑 只有当 Key 不为空时，才添加 Authorization Header
                    // (注意：这里直接使用了函数作用域里的 authHeader 变量，正如你原代码写的)
                    if (authHeader) {
                        proxyPayload.custom_include_headers["Authorization"] = authHeader;
                        console.log('🔑 [后端代理] Authorization Header 已添加 (有密码)');
                    } else {
                        console.log('🔓 [后端代理] 跳过 Authorization Header (无密码)');
                    }

                    console.log(`🌐 [后端代理] 目标: ${apiUrl} | 模型: ${model}`);

                    const proxyResponse = await fetch('/api/backends/chat-completions/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(proxyPayload)
                    });

                    // 检查 HTTP 状态码
                    if (proxyResponse.ok) {
                        const data = await proxyResponse.json();
                        // ✅ 这里保留了你的 parseApiResponse 调用
                        const result = parseApiResponse(data);
                        if (result.success) {
                            console.log('✅ [后端代理] 成功');
                            return result;
                        }
                        throw new Error('后端返回数据无法解析');
                    }

                    // 只有当 HTTP 状态码不是 2xx 时才读取错误信息
                    const errText = await proxyResponse.text();
                    console.warn(`⚠️ [后端代理失败] ${proxyResponse.status}: ${errText.substring(0, 200)}`);
                    throw new Error(`后端返回 ${proxyResponse.status}`);
                }

            } catch (e) {
                console.error(`❌ [后端代理] 失败: ${e.message}`);
                return {
                    success: false,
                    error: `后端代理失败: ${e.message}\n\n💡 提示：检查 API 地址和密钥是否正确`
                };
            }
        }

        // ==========================================
        // 通道 B: 浏览器直连 (compatible, deepseek, gemini)
        // ==========================================
        if (useDirect) {
            try {
                console.log('🌍 [浏览器直连模式] 直接请求目标 API...');

                // 构造直连 URL（智能拼接 endpoint）
                let directUrl = apiUrl;

                // 根据 Provider 智能拼接 endpoint
                if (provider === 'gemini') {
                    // Gemini 需要特殊处理：确保有 :generateContent
                    if (!directUrl.includes(':generateContent')) {
                        // 如果 URL 包含模型名，则在后面添加 :generateContent
                        if (directUrl.includes('/models/')) {
                            directUrl += ':generateContent';
                        } else {
                            // 否则添加完整路径
                            directUrl += `/models/${model}:generateContent`;
                        }
                    }
                } else {
                    // DeepSeek / Compatible 使用 /chat/completions
                    if (!directUrl.endsWith('/chat/completions') && !directUrl.includes('/chat/completions')) {
                        directUrl += '/chat/completions';
                    }
                }

                console.log(`🔗 [直连URL] ${directUrl}`);

                // ✅ 提前定义模型名（小写）用于条件判断
                const modelLower = (model || '').toLowerCase();

                // 构建请求体（根据 Provider 调整格式）
                let requestBody = {
                    model: model,
                    messages: cleanMessages,
                    temperature: temperature,
                    stream: true,  // ✅ 启用流式响应
                    stop: []  // ✅ 清空停止符
                };

                // Gemini 特殊格式处理
                if (provider === 'gemini') {
                    requestBody = {
                        contents: cleanMessages.map(m => ({
                            role: m.role === 'user' ? 'user' : 'model',
                            parts: [{ text: m.content }]
                        })),
                        generationConfig: {
                            temperature: temperature,
                            maxOutputTokens: maxTokens
                        }
                    };

                    // ✅ 仅当模型名包含 'gemini' 时才添加安全设置
                    if (modelLower.includes('gemini')) {
                        requestBody.safetySettings = [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                        ];
                    }

                    // Gemini 不支持标准流式，强制改回非流式
                    delete requestBody.stream;
                } else {
                    // 其他 Provider 添加 max_tokens
                    requestBody.max_tokens = maxTokens;
                }

                // ✅ 针对 Gemini 代理/兼容模式的特殊处理
                if (provider !== 'gemini' && modelLower.includes('gemini')) {
                    console.log('🔧 [Gemini 代理模式] 检测到模型名包含 gemini，强制注入安全设置');

                    // OpenAI 格式的安全设置（部分代理可能支持）
                    requestBody.safety_settings = [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ];

                    // Gemini 原生格式的安全设置（备用）
                    requestBody.safetySettings = [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ];
                }

                // 🔧 [Gemini 官方直连修复] 如果是官方域名，将 API Key 添加到 URL 参数
                if (provider === 'gemini' && authHeader === undefined) {
                    // 检查 URL 中是否已经包含 API Key 参数
                    if (!directUrl.includes('key=') && !directUrl.includes('goog_api_key=')) {
                        // 智能拼接：判断 URL 是否已有其他参数
                        directUrl += (directUrl.includes('?') ? '&' : '?') + 'key=' + apiKey;
                        console.log('🔑 [Gemini 官方] API Key 已添加到 URL 参数');
                    }
                }

                console.log(`📡 [最终请求 URL] ${directUrl.replace(apiKey, '***')}`);

                // 发送直连请求
                // 动态构建 headers：只有当 authHeader 存在时才添加 Authorization
                const headers = {
                    'Content-Type': 'application/json'
                };

                if (authHeader !== undefined) {
                    headers['Authorization'] = authHeader;
                }

                const directResponse = await fetch(directUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(requestBody)
                });

                if (!directResponse.ok) {
                    const errText = await directResponse.text();
                    throw new Error(`HTTP ${directResponse.status}: ${errText.substring(0, 500)}`);
                }

                // ✅ [伪流式响应处理] 实现健壮的 SSE 流式解析
                let fullText = '';  // 累积完整文本
                let fullReasoning = '';  // 累积思考内容（DeepSeek reasoning_content）

                // 判断是否为流式响应（仅根据服务器实际返回的 Content-Type 判断）
                // ✅ 修复：移除 requestBody.stream 判断，防止"假流"模型（请求 stream:true 但返回 json）解析失败
                const contentType = directResponse.headers.get('content-type') || '';
                const isStreamResponse = contentType.includes('text/event-stream');

                if (isStreamResponse && directResponse.body) {
                    console.log('🌊 [流式模式] 开始接收 SSE 流式响应...');

                    try {
                        const reader = directResponse.body.getReader();
                        const decoder = new TextDecoder('utf-8');
                        let buffer = '';  // 缓冲区，处理分片数据
                        let isTruncated = false;  // 标记是否因长度限制被截断

                        while (true) {
                            const { done, value } = await reader.read();

                            // ✅ 修复：先解码并追加到 buffer，无论是否 done
                            if (value) {
                                buffer += decoder.decode(value, { stream: !done });
                            } else if (done) {
                                // Flush 解码器缓存，防止最后一段字符丢失
                                buffer += decoder.decode();
                            }

                            // ✅ 修复：统一处理 buffer，按行分割
                            const lines = buffer.split('\n');

                            // ✅ 修复：如果流未结束，保留最后一行（可能不完整）
                            //         如果流结束了，处理所有行，不保留
                            if (!done) {
                                buffer = lines.pop() || '';
                            } else {
                                buffer = '';  // 清空，确保所有数据都被处理
                                console.log('✅ [流式模式] 接收完成，处理剩余的所有行');
                            }

                            // 处理每一行（相同的解析逻辑）
                            for (const line of lines) {
                                const trimmed = line.trim();

                                // 跳过空行和注释
                                if (!trimmed || trimmed.startsWith(':')) continue;

                                // 跳过 [DONE] 信号
                                if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') continue;

                                // 使用正则表达式匹配 SSE 前缀
                                const sseMatch = trimmed.match(/^data:\s*/);
                                if (sseMatch) {
                                    const jsonStr = trimmed.substring(sseMatch[0].length);

                                    // 跳过空 data 或 [DONE]
                                    if (!jsonStr || jsonStr === '[DONE]') continue;

                                    try {
                                        const chunk = JSON.parse(jsonStr);

                                        // 检测 finish_reason
                                        const finishReason = chunk.choices?.[0]?.finish_reason;
                                        if (finishReason) {
                                            if (finishReason === 'length') {
                                                isTruncated = true;
                                                console.warn('⚠️ [流式模式] 检测到输出因 Max Tokens 限制被截断');
                                            } else {
                                                console.log(`✅ [流式模式] 完成原因: ${finishReason}`);
                                            }
                                        }

                                        // DeepSeek 兼容 - 提取 reasoning_content
                                        const reasoningContent = chunk.choices?.[0]?.delta?.reasoning_content;
                                        if (reasoningContent) {
                                            fullReasoning += reasoningContent;  // ✅ 累积思考内容
                                            console.log('🧠 [DeepSeek] 检测到 reasoning_content，长度:', reasoningContent.length);
                                        }

                                        // 提取内容（OpenAI 标准格式）
                                        const delta = chunk.choices?.[0]?.delta?.content;
                                        if (delta) {
                                            fullText += delta;
                                        }

                                        // 兼容其他可能的格式
                                        if (!delta && chunk.choices?.[0]?.text) {
                                            fullText += chunk.choices[0].text;
                                        }

                                    } catch (parseErr) {
                                        console.warn('⚠️ [流式解析] JSON 解析失败:', parseErr.message);
                                        console.warn('   原始内容 (前100字符):', jsonStr.substring(0, 100));
                                        // ✅ 容错：尝试将原始内容作为纯文本追加，防止数据丢失
                                        if (jsonStr && jsonStr.trim() && !jsonStr.includes('[DONE]')) {
                                            fullText += jsonStr;
                                            console.log('📝 [容错处理] 已将无法解析的内容作为纯文本追加，长度:', jsonStr.length);
                                        }
                                    }
                                } else if (trimmed && !trimmed.startsWith(':')) {
                                    console.warn('⚠️ [流式解析] 无法识别的行格式 (前50字符):', trimmed.substring(0, 50));
                                }
                            }

                            // ✅ 修复：在处理完所有数据后再退出
                            if (done) break;
                        }

                        // 如果检测到截断，在文本末尾添加视觉标记
                        if (isTruncated) {
                            fullText += '\n\n[⚠️ 内容已因达到最大Token限制而截断]';
                            console.warn('⚠️ [流式模式] 已在输出末尾添加截断标记');
                        }

                        console.log(`✅ [流式模式] 累积文本长度: ${fullText.length} 字符`);
                        console.log(`🧠 [流式模式] 累积思考长度: ${fullReasoning.length} 字符`);

                        // ========================================
                        // 循环结束后处理：检测异常 + 清洗
                        // ========================================

                        // 1️⃣ 检测异常：如果正文全空，说明 AI 仅输出了思考过程（可能 Token 耗尽）
                        if (!fullText.trim() && fullReasoning.trim()) {
                            console.error('❌ [DeepSeek 异常] 正文为空，仅收到思考内容');
                            // 提取最后 200 个字符的思考内容用于错误提示
                            const reasoningPreview = fullReasoning.length > 200
                                ? '...' + fullReasoning.slice(-200)
                                : fullReasoning;
                            throw new Error(
                                `生成失败：AI 仅输出了思考过程，未输出正文（可能是 Token 耗尽）。\n\n` +
                                `💭 思考内容末尾（最后 200 字符）：\n${reasoningPreview}\n\n` +
                                `🔧 建议：减少每批处理的层数，或切换到非思考模型（如 GPT-4、Claude）。`
                            );
                        }

                        // 2️⃣ 清洗策略：无论来源如何，必须清洗掉 <think> 标签，只留正文
                        // 防止 DeepSeek 在 content 里混合输出了思考标签
                        if (fullText) {
                            const beforeClean = fullText.length;
                            fullText = fullText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                            const afterClean = fullText.length;

                            if (beforeClean !== afterClean) {
                                console.log(`🧹 [清洗完成] 已移除 <think> 标签，清洗前: ${beforeClean} 字符，清洗后: ${afterClean} 字符`);
                            }
                        }

                    } catch (streamErr) {
                        console.error('❌ [流式解析失败]', streamErr);
                        throw new Error(`流式读取失败: ${streamErr.message}`);
                    }

                } else {
                    // 降级：非流式响应，使用传统方式
                    console.log('📄 [非流式模式] 使用传统 JSON 解析...');
                    const data = await directResponse.json();
                    const result = parseApiResponse(data);

                    if (result.success) {
                        console.log('✅ [浏览器直连] 成功（非流式）！');
                        return result;
                    }

                    throw new Error('直连返回数据无法解析');
                }

                // 流式模式：返回累积的完整文本
                // 3️⃣ 最终校验与返回
                if (fullText && fullText.trim()) {
                    console.log('✅ [浏览器直连] 成功（流式）！长度:', fullText.length);
                    return {
                        success: true,
                        summary: fullText.trim()
                    };
                }

                throw new Error('流式响应经清洗后内容为空');

            } catch (e) {
                console.error('❌ [浏览器直连] 失败:', e);

                let errorMsg = `浏览器直连失败: ${e.message}`;
                if (e.message.includes('Failed to fetch') ||
                    e.message.includes('NetworkError') ||
                    e.message.includes('CORS')) {
                    errorMsg += '\n\n💡 可能是 CORS 跨域问题，建议切换到 "🔌 本地/内网" 模式使用后端代理';
                }

                return {
                    success: false,
                    error: errorMsg
                };
            }
        }

        // 如果没有匹配任何分流逻辑（不应该发生）
        return {
            success: false,
            error: `未知的 provider 类型: ${provider}`
        };
    }

    /**
     * 辅助函数：解析 API 响应（兼容多种格式）
     */
    function parseApiResponse(data) {
        // 检查是否有错误
        if (data.error) {
            const errMsg = data.error.message || JSON.stringify(data.error);
            throw new Error(`API 报错: ${errMsg}`);
        }

        let content = '';

        // 标准 OpenAI / DeepSeek 格式
        if (data.choices?.[0]?.message?.content) {
            content = data.choices[0].message.content;
        }
        // OpenAI 嵌套格式（某些代理返回）
        else if (data.data?.choices?.[0]?.message?.content) {
            content = data.data.choices[0].message.content;
        }
        // Google Gemini 格式
        else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            content = data.candidates[0].content.parts[0].text;
        }
        // Anthropic Claude 格式
        else if (data.content?.[0]?.text) {
            content = data.content[0].text;
        }
        // 旧版兼容格式
        else if (data.results?.[0]?.text) {
            content = data.results[0].text;
        }

        if (!content || !content.trim()) {
            // ✅ 检查是否因安全过滤被阻止
            const finishReason = data.choices?.[0]?.finish_reason ||
                data.data?.choices?.[0]?.finish_reason ||
                data.candidates?.[0]?.finishReason;

            if (finishReason === 'safety' || finishReason === 'content_filter' || finishReason === 'SAFETY') {
                throw new Error('Gemini Safety Filter triggered - 内容被安全审查拦截');
            }

            throw new Error('API 返回内容为空');
        }

        return { success: true, summary: content.trim() };
    }


    async function callTavernAPI(prompt) {
        try {
            const context = m.ctx();
            if (!context) return { success: false, error: '无法访问酒馆上下文' };

            console.log('🚀 [酒馆API] 准备发送...');

            // 1. 智能格式转换工具
            const convertPromptToString = (input) => {
                if (typeof input === 'string') return input;
                if (Array.isArray(input)) {
                    return input.map(m => {
                        const role = m.role === 'system' ? 'System' : (m.role === 'user' ? 'User' : 'Model');
                        return `### ${role}:\n${m.content}`;
                    }).join('\n\n') + '\n\n### Model:\n';
                }
                return String(input);
            };

            // 2. 检测是否为 Gemini 模型 (根据配置的模型名判断)
            // 如果配置里写了 gemini，或者当前酒馆选的模型名字里带 gemini
            const currentModel = API_CONFIG.model || 'unknown';
            const isGemini = currentModel.toLowerCase().includes('gemini');

            let finalPrompt = prompt;

            // ❌ [已禁用] Gemini 格式转换导致手机端返回空内容
            // 现代 SillyTavern 已支持 Gemini 的 messages 数组格式，不需要转换
            // if (isGemini) {
            //     console.log('✨ 检测到 Gemini 模型，正在将数组转换为纯文本以兼容酒馆后端...');
            //     finalPrompt = convertPromptToString(prompt);
            // } else {
            //     // 对于 OpenAI 等其他模型，确保是数组
            //     if (!Array.isArray(prompt)) {
            //         finalPrompt = [{ role: 'user', content: prompt }];
            //     }
            // }

            // ✅ 统一处理：确保 prompt 是数组格式
            if (!Array.isArray(prompt)) {
                finalPrompt = [{ role: 'user', content: String(prompt) }];
            }

            if (isGemini) {
                console.log('🛡️ 检测到 Gemini 模型，使用标准 messages 数组格式');
            }

            // 3. 调用酒馆接口
            if (typeof context.generateRaw === 'function') {
                let result;
                try {
                    // 构建生成参数
                    const generateParams = {
                        prompt: finalPrompt, // 👈 这里的格式已经根据模型自动适配了
                        images: [],
                        quiet: true,
                        dryRun: false,
                        skip_save: false,

                        // 🛡️ 纯净模式：关闭所有干扰项
                        include_world_info: false,
                        include_jailbreak: false,
                        include_character_card: false,
                        include_names: false,

                        // ✅ 强制指定最大输出长度 ( 65536 token 足够写出极长的总结)
                        max_tokens: 65536,
                        length: 65536,

                        // ✅✅✅ 清空停止符，防止遇到人名就截断
                        stop: [],
                        stop_sequence: []
                    };

                    // ✅ 仅当模型名包含 'gemini' 时才添加安全设置
                    if (isGemini) {
                        generateParams.safety_settings = [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                        ];
                    }

                    result = await context.generateRaw(generateParams);
                    console.log('✅ [直连] 调用成功');
                } catch (err) {
                    console.error('❌ 酒馆API调用失败:', err);
                    return { success: false, error: err.message };
                }

                // 4. 解析结果
                let summary = '';
                if (typeof result === 'string') summary = result;
                else if (result && result.text) summary = result.text;
                else if (result && result.content) summary = result.content;
                else if (result && result.body && result.body.text) summary = result.body.text;

                if (summary && summary.includes('<think>')) {
                    summary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                }

                if (summary && summary.trim()) return { success: true, summary };
            }

            return { success: false, error: '酒馆API未返回有效文本或版本不支持数组调用' };

        } catch (err) {
            console.error('❌ [酒馆API] 致命错误:', err);
            return { success: false, error: `API报错: ${err.message}` };
        }
    }

    function shtm() {
        // 1. 确保 UI.fs 有默认值，防止为空
        if (!UI.fs || isNaN(UI.fs)) UI.fs = 12;

        const h = `
    <div class="g-p">
        <h4>🎨 主题设置</h4>

        <!-- 🌙 夜间模式开关 -->
        <div style="background:rgba(0,0,0,0.05); padding:10px; border-radius:6px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <label style="font-weight:bold; margin:0; display:flex; align-items:center; gap:5px;">🌙 夜间模式 (Dark Mode)</label>
            <input type="checkbox" id="ui-dark-mode" ${UI.darkMode ? 'checked' : ''} style="width:20px; height:20px; cursor:pointer;">
        </div>

        <label>主题色（按钮、表头）：</label>
        <input type="color" id="tc" value="${UI.c}" style="width:100%; height:40px; border-radius:4px; border:1px solid #ddd; cursor:pointer;">
        <br><br>
        
        <label>字体颜色（文字）：</label>
        <input type="color" id="ttc" value="${UI.tc || '#ffffff'}" style="width:100%; height:40px; border-radius:4px; border:1px solid #ddd; cursor:pointer;">
        <br><br>

        <label style="display:flex; justify-content:space-between;">
            <span>字体大小 (全局)：</span>
            <span id="fs-val" style="font-weight:bold; color:${UI.c}">${UI.fs}px</span>
        </label>
        <input type="range" id="tfs" min="10" max="24" step="1" value="${UI.fs}"
            oninput="document.getElementById('fs-val').innerText = this.value + 'px'; document.documentElement.style.setProperty('--g-fs', this.value + 'px');"
            style="width:100%; cursor:pointer; margin-top:5px;">

        <div style="font-size:10px; color:#333; opacity:0.6; margin-top:4px;">拖动滑块实时调整表格文字大小</div>

        <div style="margin-top: 15px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 10px;">
            <label style="font-weight: 600; display:block; margin-bottom:5px;">📖 总结本背景图 (DIY)</label>

            <!-- 预览区域 -->
            <div id="bg-preview" style="width: 100%; height: 60px; background: #eee; border-radius: 6px; margin-bottom: 8px; background-size: cover; background-position: center; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;">
                ${UI.bookBg ? '' : '暂无背景，使用默认纸张'}
            </div>

            <div style="display: flex; gap: 5px;">
                <input type="text" id="bg-url" placeholder="输入图片 URL..." style="flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
                <button id="btn-clear-bg" style="padding: 5px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">🗑️</button>
            </div>

            <div style="margin-top: 5px; display: flex; align-items: center; gap: 8px;">
                 <label for="bg-file" style="cursor: pointer; background: #17a2b8; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; display: inline-block;">📂 选择本地图片</label>
                 <input type="file" id="bg-file" accept="image/*" style="display: none;">
                 <span style="font-size: 10px; color: #666;">(建议 < 1MB)</span>
            </div>
        </div>
        <br>

        < <div style="background:rgba(255,255,255,0.6); padding:10px; border-radius:4px; font-size:10px; margin-bottom:12px; color:#333333; border:1px solid rgba(0,0,0,0.1);">
            <strong>💡 提示：</strong><br>
            • 如果主题色较浅，请将字体颜色设为深色（如黑色）<br>
            • 字体过大可能会导致表格内容显示不全，请酌情调整
        </div>
        
        <button id="ts" style="padding:8px 16px; width:100%; margin-bottom:10px;">💾 保存</button>
        <button id="tr" style="padding:8px 16px; width:100%; background:#6c757d;">🔄 恢复默认</button>
    </div>`;

        pop('🎨 主题设置', h, true);

        // 强制初始化一次变量，防止打开时没有生效
        document.documentElement.style.setProperty('--g-fs', UI.fs + 'px');

        setTimeout(() => {
            // ✅ 🌙 夜间模式切换事件 (带记忆功能)
            $('#ui-dark-mode').off('change').on('change', function() {
                const isChecked = $(this).is(':checked'); // 目标状态

                // 1. 切换前：先保存【当前模式】的颜色到记忆库
                if (isChecked) {
                    // 即将进入夜间，说明刚才是在白天 -> 保存白天自定义配色
                    UI.day_c = UI.c;
                    UI.day_tc = UI.tc;
                } else {
                    // 即将进入白天，说明刚才是在夜间 -> 保存夜间自定义配色
                    UI.night_c = UI.c;
                    UI.night_tc = UI.tc;
                }

                // 2. 切换后：读取【目标模式】的记忆（如果有），否则用默认
                if (isChecked) {
                    // 🌙 切换到夜间
                    // 优先读取记忆中的夜间色，没有则用标准深色
                    UI.c = UI.night_c || '#252525';
                    UI.tc = UI.night_tc || '#ffffff';
                } else {
                    // ☀️ 切换到白天
                    // 优先读取记忆中的白天色，没有则用标准浅色
                    UI.c = UI.day_c || '#f0f0f0';
                    UI.tc = UI.day_tc || '#333333';
                }

                // 3. 更新界面控件
                $('#tc').val(UI.c);
                $('#ttc').val(UI.tc);

                // 4. 应用样式
                document.documentElement.style.setProperty('--g-c', UI.c);
                document.documentElement.style.setProperty('--g-tc', UI.tc);
                UI.darkMode = isChecked;

                // 5. 保存配置 (会连同记忆库一起保存到 localStorage)
                try { localStorage.setItem('gg_ui', JSON.stringify(UI)); } catch (e) { }
                
                if (typeof API_CONFIG !== 'undefined') {
                    API_CONFIG.darkMode = isChecked;
                    try { localStorage.setItem('gg_api', JSON.stringify(API_CONFIG)); } catch (e) { }
                }
                
                thm();

                if (typeof window.saveAllSettingsToCloud === 'function') {
                    window.saveAllSettingsToCloud().catch(err => {});
                }
            });

            // ✅ 这里的绑定作为双重保险
            // 使用 document 代理事件，确保一定能抓到元素
            $(document).off('input', '#tfs').on('input', '#tfs', function () {
                const val = $(this).val();
                $('#fs-val').text(val + 'px');
                // 同时更新 html 和 body，防止某些主题覆盖
                document.documentElement.style.setProperty('--g-fs', val + 'px');
                document.body.style.setProperty('--g-fs', val + 'px');
            });

            // ========================================
            // 📖 背景图设置事件绑定
            // ========================================

            // 初始化预览
            if (UI.bookBg) {
                $('#bg-preview').css('background-image', `url("${UI.bookBg}")`).text('');
            }

            // 1. 本地文件上传 (转 Base64)
            $('#bg-file').on('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;

                if (file.size > 2 * 1024 * 1024) { // 2MB 限制
                    alert('图片太大了！建议使用小于 2MB 的图片，否则可能导致卡顿。');
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(evt) {
                    const base64 = evt.target.result;
                    $('#bg-preview').css('background-image', `url("${base64}")`).text('');
                    UI.bookBg = base64; // 暂存到内存对象
                };
                reader.readAsDataURL(file);
            });

            // 2. URL 输入
            $('#bg-url').on('input', function() {
                const url = $(this).val();
                if (url) {
                    $('#bg-preview').css('background-image', `url("${url}")`).text('');
                    UI.bookBg = url;
                }
            });

            // 3. 清除按钮
            $('#btn-clear-bg').on('click', function() {
                UI.bookBg = '';
                $('#bg-preview').css('background-image', '').text('已清除，使用默认');
                $('#bg-url').val('');
                $('#bg-file').val('');
            });

            // ========================================
            // 保存按钮（同时保存所有主题设置包括背景图）
            // ========================================
            $('#ts').off('click').on('click', async function () {
                UI.c = $('#tc').val();
                UI.tc = $('#ttc').val();
                UI.fs = parseInt($('#tfs').val());
                UI.darkMode = $('#ui-dark-mode').is(':checked'); // ✅ 保存夜间模式状态
                // ✅ bookBg 已经在上面的事件中赋值到 UI.bookBg 了

                try { localStorage.setItem(UK, JSON.stringify(UI)); } catch (e) { }
                try { localStorage.setItem('gg_timestamp', Date.now().toString()); } catch (e) { }
                m.save();
                thm(); // 重新加载样式

                // 🌐 使用统一函数保存全量配置到服务端
                await saveAllSettingsToCloud();

                await customAlert('主题与字体设置已保存', '成功');
            });

            // 恢复默认按钮 (智能版：清除记忆 + 恢复默认)
            $('#tr').off('click').on('click', async function () {
                const isCurrentNight = $('#ui-dark-mode').is(':checked');
                const modeName = isCurrentNight ? '夜间' : '白天';

                if (!await customConfirm(`确定重置【${modeName}模式】的颜色配置？\n\n(字体大小和背景图也将重置)`, '恢复默认')) return;

                // 1. 恢复当前模式的默认值
                if (isCurrentNight) {
                    UI.c = '#252525';
                    UI.tc = '#ffffff';
                    UI.darkMode = true;
                    // ✨ 清除夜间记忆，下次切换回来就是默认了
                    delete UI.night_c;
                    delete UI.night_tc;
                } else {
                    UI.c = '#f0f0f0';
                    UI.tc = '#333333';
                    UI.darkMode = false;
                    // ✨ 清除白天记忆
                    delete UI.day_c;
                    delete UI.day_tc;
                }

                // 2. 重置公共属性
                UI.fs = 12;
                UI.bookBg = '';

                // 3. 保存与同步
                if (typeof API_CONFIG !== 'undefined') {
                    API_CONFIG.darkMode = UI.darkMode;
                    try { localStorage.setItem('gg_api', JSON.stringify(API_CONFIG)); } catch (e) { }
                }
                try { localStorage.setItem('gg_ui', JSON.stringify(UI)); } catch (e) { }
                
                m.save();
                thm();
                document.documentElement.style.setProperty('--g-fs', '12px');

                // 4. 刷新控件
                $('#ui-dark-mode').prop('checked', UI.darkMode);
                $('#tc').val(UI.c);
                $('#ttc').val(UI.tc);
                $('#tfs').val(12);
                $('#fs-val').text('12px');
                
                $('#bg-preview').css('background-image', '').text('暂无背景，使用默认纸张');
                $('#bg-url').val('');
                $('#bg-file').val('');

                // 5. 提示
                if (typeof toastr !== 'undefined') {
                    toastr.success(`已恢复【${modeName}模式】默认设置`, '成功');
                } else {
                    await customAlert(`已恢复【${modeName}模式】默认设置`, '成功');
                }
            });
        }, 100);
    }

    async function shapi() {
        await loadConfig(); // ✅ 强制刷新配置，确保读取到最新的 Provider 设置
        if (!API_CONFIG.summarySource) API_CONFIG.summarySource = 'chat';

        const h = `
    <div class="g-p">
        <h4>🤖 AI 总结配置</h4>
        
        <fieldset style="border:1px solid #ddd; padding:10px; border-radius:4px; margin-bottom:12px;">
            <legend style="font-size:11px; font-weight:600;">🚀 API 模式</legend>
            <label><input type="radio" name="api-mode" value="tavern" ${!API_CONFIG.useIndependentAPI ? 'checked' : ''}> 使用酒馆API（默认）</label>
            <br>
            <label><input type="radio" name="api-mode" value="independent" ${API_CONFIG.useIndependentAPI ? 'checked' : ''}> 使用独立API</label>
        </fieldset>
        
        <fieldset id="api-config-section" style="border:1px solid #ddd; padding:10px; border-radius:4px; margin-bottom:12px; ${API_CONFIG.useIndependentAPI ? '' : 'opacity:0.5; pointer-events:none;'}">
            <legend style="font-size:11px; font-weight:600;">独立API配置</legend>
            
            <label>API提供商：</label>
            <select id="api-provider" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; margin-bottom:10px;">
                <optgroup label="━━━ 后端代理 ━━━">
                    <option value="local" ${API_CONFIG.provider === 'local' ? 'selected' : ''}>本地/内网（本地反代）</option>
                    <option value="proxy_only" ${API_CONFIG.provider === 'proxy_only' ? 'selected' : ''}>反代(如build)</option>
                    <option value="openai" ${API_CONFIG.provider === 'openai' ? 'selected' : ''}>OpenAI 官方</option>
                    <option value="claude" ${API_CONFIG.provider === 'claude' ? 'selected' : ''}>Claude 官方</option>
                    <option value="deepseek" ${API_CONFIG.provider === 'deepseek' ? 'selected' : ''}>DeepSeek 官方</option>
                    <option value="siliconflow" ${API_CONFIG.provider === 'siliconflow' ? 'selected' : ''}>硅基流动 (SiliconFlow)</option>
                </optgroup>
                <optgroup label="━━━ 浏览器直连 ━━━">
                    <option value="compatible" ${API_CONFIG.provider === 'compatible' ? 'selected' : ''}>兼容端点 (中转/代理)</option>
                    <option value="gemini" ${API_CONFIG.provider === 'gemini' ? 'selected' : ''}>Google Gemini 官方</option>
                </optgroup>
            </select>
            
            <label>API地址 (Base URL)：</label>
            <input type="text" id="api-url" value="${API_CONFIG.apiUrl}" placeholder="例如: https://api.openai.com/v1" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:10px;">
            <div style="font-size:10px; color:${UI.tc}; opacity:0.7; margin-top:4px; margin-bottom:10px;">
                不行？在 URL 末尾添加 <code style="background:rgba(0,0,0,0.1); padding:1px 4px; border-radius:3px; font-family:monospace;">/v1</code> 试试！
                <code style="background:rgba(0,0,0,0.1); padding:1px 4px; border-radius:3px; font-family:monospace;">/chat/completions</code> 后缀会自动补全。
            </div>

            <label>API密钥 (Key)：</label>
            <div style="position: relative; margin-bottom: 10px;">
                <input type="password" id="api-key" value="${API_CONFIG.apiKey}" placeholder="sk-..." style="width:100%; padding:5px 30px 5px 5px; border:1px solid #ddd; border-radius:4px; font-size:10px;">
                <i id="toggle-key-btn" class="fa-solid fa-eye" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--g-tc); opacity: 0.6;" title="显示/隐藏密钥"></i>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label style="margin:0;">模型名称：</label>
                <span id="fetch-models-btn" style="cursor:pointer; font-size:10px; color:${UI.tc}; border:1px solid ${UI.c}; padding:1px 6px; border-radius:3px; background:rgba(127,127,127,0.1);">🔄 拉取模型列表</span>
            </div>

            <input type="text" id="api-model" value="${API_CONFIG.model}" placeholder="gpt-3.5-turbo" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:10px; margin-bottom:10px;">
            <select id="api-model-select" style="display:none; width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:10px; margin-bottom:10px;"></select>

            <label>最大输出长度 (Max Tokens)：</label>
            <input type="number" id="api-max-tokens" value="${API_CONFIG.maxTokens || 8192}" placeholder="DeepSeek填8192，Gemini填65536" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:10px; margin-bottom:10px;">

        </fieldset>
        
        <div style="display:flex; gap:10px;">
            <button id="save-api" style="flex:1; padding:6px 12px; background:${UI.c}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;">💾 保存设置</button>
            <button id="test-api" style="flex:1; padding:6px 12px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;" ${API_CONFIG.useIndependentAPI ? '' : 'disabled'}>🧪 测试连接</button>
        </div>
    </div>`;

        pop('🤖 AI总结配置', h, true);
        window.isEditingConfig = true; // 标记开始编辑配置，防止后台同步覆盖用户输入

        setTimeout(() => {

            // === 新增：小眼睛切换功能 ===
            $('#toggle-key-btn').off('click').on('click', function() {
                const $input = $('#api-key');
                const $icon = $(this);
                if ($input.attr('type') === 'password') {
                    $input.attr('type', 'text');
                    $icon.removeClass('fa-eye').addClass('fa-eye-slash');
                } else {
                    $input.attr('type', 'password');
                    $icon.removeClass('fa-eye-slash').addClass('fa-eye');
                }
            });
            
            $('input[name="api-mode"]').on('change', function () {
                const isIndependent = $(this).val() === 'independent';
                if (isIndependent) {
                    $('#api-config-section').css({ 'opacity': '1', 'pointer-events': 'auto' });
                    $('#test-api').prop('disabled', false);
                } else {
                    $('#api-config-section').css({ 'opacity': '0.5', 'pointer-events': 'none' });
                    $('#test-api').prop('disabled', true);
                }
            });

            $('#api-provider').on('change', function () {
                const provider = $(this).val();
                // 仅在用户主动切换下拉框时，才自动填充官方默认值
                if (provider === 'local') {
                    // local 模式：本地/内网 API (强制后端代理)
                    $('#api-url').val('http://127.0.0.1:7860/v1');
                    $('#api-model').val('gpt-3.5-turbo');
                    $('#api-url').attr('placeholder', '例如: http://127.0.0.1:7860');
                    $('#api-model').attr('placeholder', '例如: gpt-3.5-turbo');
                } else if (provider === 'proxy_only') {
                    // 独立反代：不自动填充特定死板的URL，但给个示例提示
                    $('#api-url').attr('placeholder', '例如: http://127.0.0.1:8889');
                    $('#api-model').attr('placeholder', '例如: gemini-2.5-pro');
                    // 也可以给个默认值方便你改（可选）
                    $('#api-url').val('http://127.0.0.1:8889');
                } else if (provider === 'compatible') {
                    // 兼容端点：不自动填充，保留用户输入
                    $('#api-url').attr('placeholder', '例如: https://api.xxx.com/v1 或 https://api.xxx.com/v1/chat/completions');
                    $('#api-model').attr('placeholder', '例如: gpt-4o, deepseek-chat, 或自定义模型名');
                } else if (provider === 'openai') {
                    $('#api-url').val('https://api.openai.com/v1');
                    $('#api-model').val('gpt-3.5-turbo');
                } else if (provider === 'deepseek') {
                    $('#api-url').val('https://api.deepseek.com/v1');
                    $('#api-model').val('deepseek-chat');
                } else if (provider === 'siliconflow') {
                    $('#api-url').val('https://api.siliconflow.cn/v1');
                    $('#api-model').val('deepseek-ai/DeepSeek-V3'); 
                } else if (provider === 'gemini') {
                    // Gemini 使用纯净的 Base URL，插件会自动拼接 /models/{model}:generateContent
                    $('#api-url').val('https://generativelanguage.googleapis.com/v1beta');
                    $('#api-model').val('gemini-1.5-flash');
                } else if (provider === 'claude') {
                    $('#api-url').val('https://api.anthropic.com/v1/messages');
                    $('#api-model').val('claude-3-5-sonnet-20241022');
                }
            });

            // ✨✨✨ 智能拉取模型 (鉴权修复版) ✨✨✨
            $('#fetch-models-btn').off('click').on('click', async function () {
                const btn = $(this);
                const originalText = btn.text();
                btn.text('拉取中...').prop('disabled', true);

                // ========================================
                // 1. 获取参数
                // ========================================
                let apiUrl = $('#api-url').val().trim();
                const apiKey = $('#api-key').val().trim();
                
                // ✅ 核心修复：提前构造鉴权头 (Bearer sk-...)
                // 这一点是之前漏掉的，导致部分中转站不认账
                let authHeader = undefined;
                if (apiKey) {
                    authHeader = apiKey.startsWith('Bearer ') ? apiKey : ('Bearer ' + apiKey);
                }

                const provider = $('#api-provider').val();

                // 🔧 IP 修正
                if (apiUrl.includes('0.0.0.0')) apiUrl = apiUrl.replace(/0\.0\.0\.0/g, '127.0.0.1');
                
                // 🔧 URL 智能补全
                if (typeof processApiUrl === 'function') {
                    apiUrl = processApiUrl(apiUrl, provider);
                } else {
                    apiUrl = apiUrl.replace(/\/+$/, '');
                    if (provider !== 'gemini' && !apiUrl.includes('/v1') && !apiUrl.includes('/chat')) apiUrl += '/v1';
                }

                let models = [];

                // ========================================
                // 2. 定义策略
                // ========================================
                // 🔴 强制代理组
                const forceProxy = (provider === 'local' || provider === 'openai' || provider === 'claude' || provider === 'proxy_only' || provider === 'deepseek' || provider === 'siliconflow');
                
                // 🟢 优先直连组 (兼容端点放这里，实现双保险)
                const tryDirect = (provider === 'compatible' || provider === 'gemini');

                // ========================================
                // 3. 封装后端代理逻辑 (修复 Header 问题)
                // ========================================
                const runProxyRequest = async () => {
                    console.log('📡 [后端代理] 正在通过酒馆后端转发请求...');
                    const csrfToken = await getCsrfToken();
                    
                    // ✅ 构造显式 Headers (关键修复)
                    const customHeaders = {
                        "Content-Type": "application/json"
                    };
                    if (authHeader) {
                        customHeaders["Authorization"] = authHeader;
                    }

                    // 智能判断模式，修复拉取失败
                    let targetSource = 'custom';
                    // 如果是 DeepSeek/OpenAI/硅基流动，强制用 openai 模式，这样才会请求 /models
                    if (provider === 'openai' || provider === 'deepseek' || provider === 'siliconflow') {
                        targetSource = 'openai';
                    }

                    const proxyPayload = {
                        chat_completion_source: targetSource, // ✅ 这里改成变量，不再死板写 custom
                        custom_url: apiUrl,
                        reverse_proxy: apiUrl,
                        proxy_password: apiKey, 
                        // ✅ 把鉴权头塞进去，确保中转站能收到 Key
                        custom_include_headers: customHeaders 
                    };

                    const response = await fetch('/api/backends/chat-completions/status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify(proxyPayload)
                    });

                    if (response.ok) {
                        const rawData = await response.json();
                        // 尝试解析
                        try { models = parseOpenAIModelsResponse(rawData); } catch (e) { }
                        
                        // 兜底解析
                        if (models.length === 0) {
                            if (rawData?.data && Array.isArray(rawData.data)) models = rawData.data;
                            else if (rawData?.models && Array.isArray(rawData.models)) models = rawData.models;
                            else if (Array.isArray(rawData)) models = rawData;
                        }
                        
                        models = models.map(m => ({ id: m.id || m.model || m.name, name: m.name || m.id || m.model }));

                        if (models.length > 0) {
                            console.log(`✅ [后端代理] 成功获取 ${models.length} 个模型`);
                            finish(models);
                            return true; 
                        }
                    }
                    throw new Error(`后端代理请求失败: ${response.status}`);
                };

                // ========================================
                // 4. 执行逻辑
                // ========================================
                try {
                    // 🚀 路径 A: 强制代理
                    if (forceProxy) {
                        await runProxyRequest();
                        return;
                    }

                    // 🚀 路径 B: 尝试直连 (带自动降级)
                    if (tryDirect) {
                        try {
                            console.log('🌍 [尝试] 浏览器直连模式...');
                            let directUrl = `${apiUrl}/models`;
                            let headers = { 'Content-Type': 'application/json' };

                            // 针对不同厂商处理 Key
                            if (provider === 'gemini') {
                                if (apiUrl.includes('googleapis.com')) {
                                    directUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                                } else {
                                    if (authHeader) headers['Authorization'] = authHeader;
                                }
                            } else {
                                // 兼容端点/DeepSeek
                                if (authHeader) headers['Authorization'] = authHeader;
                            }

                            const resp = await fetch(directUrl, { method: 'GET', headers: headers });
                            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                            
                            const data = await resp.json();
                            
                            if (provider === 'gemini' && data.models) {
                                models = data.models.map(m => ({ id: m.name.replace('models/', ''), name: m.displayName || m.name }));
                            } else {
                                models = parseOpenAIModelsResponse(data);
                            }

                            if (models.length > 0) {
                                console.log(`✅ [浏览器直连] 成功获取 ${models.length} 个模型`);
                                finish(models);
                                return;
                            }
                            throw new Error('解析结果为空');

                        } catch (directErr) {
                            console.warn(`⚠️ [直连失败] ${directErr.message}`);

                            // ⚡⚡⚡ 核心逻辑：Compatible 失败后自动呼叫后端救兵 ⚡⚡⚡
                            if (provider === 'compatible') {
                                console.log('🔄 [自动降级] 直连失败，正在切换到酒馆后端代理...');
                                if (typeof toastr !== 'undefined') toastr.warning('浏览器直连失败，尝试后端转发...', '自动降级', { timeOut: 2000 });
                                
                                await runProxyRequest(); // <--- 调用带Header的后端请求
                                return;
                            }
                            
                            throw directErr; 
                        }
                    }

                } catch (e) {
                    console.error('❌ 拉取失败:', e);
                    let msg = `拉取失败: ${e.message}`;
                    if (e.message.includes('Failed to fetch')) msg += '\n\n💡 可能是跨域(CORS)问题，且后端代理也无法连接。';
                    toastrOrAlert(msg, '错误', 'error');
                    btn.text(originalText).prop('disabled', false);
                }

                function finish(list) {
                    displayModelSelect(list);
                    toastrOrAlert(`成功获取 ${list.length} 个模型`, '成功', 'success');
                    btn.text(originalText).prop('disabled', false);
                }

                function displayModelSelect(models) {
                    const $select = $('#api-model-select');
                    const $input = $('#api-model');
                    $select.empty().append('<option value="__manual__">-- 手动输入 --</option>');
                    if (models.length > 0) {
                        models.forEach(m => $select.append(`<option value="${m.id}">${m.name || m.id}</option>`));
                        if (models.map(m => m.id).includes($input.val())) $select.val($input.val());
                        $input.hide(); $select.show();
                        $select.off('change').on('change', function () {
                            const val = $(this).val();
                            if (val === '__manual__') { $select.hide(); $input.show().focus(); } else { $input.val(val); }
                        });
                    } else {
                        $select.hide(); $input.show().focus();
                    }
                }

                function toastrOrAlert(message, title, type = 'info') {
                    if (typeof toastr !== 'undefined') toastr[type](message, title);
                    else customAlert(message, title);
                }
            });
            
            $('#save-api').on('click', async function () {
                API_CONFIG.useIndependentAPI = $('input[name="api-mode"]:checked').val() === 'independent';
                API_CONFIG.provider = $('#api-provider').val();

                // ✅ URL 清理：去除首尾空格和末尾斜杠，保存干净的 Base URL
                let apiUrl = $('#api-url').val().trim().replace(/\/+$/, '');
                API_CONFIG.apiUrl = apiUrl;

                API_CONFIG.apiKey = $('#api-key').val();
                API_CONFIG.model = $('#api-model').val();
                API_CONFIG.maxTokens = parseInt($('#api-max-tokens').val()) || 8192;
                API_CONFIG.temperature = 0.1;
                API_CONFIG.enableAI = true;
                try { localStorage.setItem(AK, JSON.stringify(API_CONFIG)); } catch (e) { }
                try { localStorage.setItem('gg_timestamp', Date.now().toString()); } catch (e) { }

                // 🌐 使用统一函数保存全量配置到服务端 (支持跨设备同步)
                await saveAllSettingsToCloud();

                await customAlert('✅ API配置已保存\n\n输出长度将根据模型自动优化', '成功');
            });

            $('#test-api').on('click', async function () {
                const testAPIWithRetry = async () => {
                    const btn = $(this);
                    const originalText = btn.text();
                    const testModel = $('#api-model').val().trim();

                    if (!testModel) {
                        await customAlert('请先填写模型名称！', '提示');
                        return;
                    }

                    $('#save-api').click();
                    btn.text('测试中...').prop('disabled', true);

                    try {
                        const testPrompt = "请简短回复：API连接测试是否成功？";
                        const result = await callIndependentAPI(testPrompt);

                        if (result.success) {
                            let alertMsg = `✅ API连接成功！`;
                            if (result.summary) alertMsg += `\n\nAI回复预览:\n${result.summary.slice(0, 100)}...`;
                            await customAlert(alertMsg, '成功');
                        } else {
                            // API 返回失败，弹出重试弹窗
                            const errorMsg = `❌ 连接失败\n\n${result.error}\n\n是否重新尝试？`;
                            const shouldRetry = await customRetryAlert(errorMsg, '⚠️ API 测试失败');

                            if (shouldRetry) {
                                console.log('🔄 [用户重试] 正在重新测试 API...');
                                btn.text(originalText).prop('disabled', false);
                                await testAPIWithRetry();  // 递归重试
                                return;
                            }
                        }
                    } catch (e) {
                        // 发生异常，弹出重试弹窗
                        const errorMsg = `❌ 错误：${e.message}\n\n是否重新尝试？`;
                        const shouldRetry = await customRetryAlert(errorMsg, '⚠️ API 测试异常');

                        if (shouldRetry) {
                            console.log('🔄 [用户重试] 正在重新测试 API...');
                            btn.text(originalText).prop('disabled', false);
                            await testAPIWithRetry();  // 递归重试
                            return;
                        }
                    } finally {
                        btn.text(originalText).prop('disabled', false);
                    }
                };

                await testAPIWithRetry.call(this);
            });
        }, 100);
    }

    // 按钮点击时，只需保存配置即可。

    // ✅✅✅ [新增] 独立的配置加载函数 (粘贴在这里)
    async function loadConfig() {
        // ✅ 检查全局保存标记，如果正在保存配置，则跳过加载
        if (window.isSavingConfig) {
            console.log('⏸️ [配置加载] 检测到正在保存配置，跳过本次加载以避免冲突');
            return;
        }

        // ✅ 检查是否正在编辑配置UI，防止后台同步覆盖用户输入
        if (window.isEditingConfig) {
            console.log('⏸️ [配置加载] 检测到正在编辑配置，跳过本次加载以避免覆盖用户输入');
            return;
        }

        console.log('🔄 [配置加载] 开始初始化...');

        const runtimeSummaryIndex = API_CONFIG.lastSummaryIndex;
        const runtimeBackfillIndex = API_CONFIG.lastBackfillIndex;

        let serverData = null;
        let localData = {};
        let needMigration = false;

        try {
            if (window.extension_settings && window.extension_settings.st_memory_table) {
                serverData = window.extension_settings.st_memory_table;
            } else {
                const csrf = await getCsrfToken();
                const res = await fetch('/api/settings/get', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
                    body: JSON.stringify({})
                });
                if (res.ok) {
                    const raw = await res.json();
                    const parsed = parseServerSettings(raw);
                    serverData = parsed?.extension_settings?.st_memory_table;
                }
            }
        } catch (e) { console.warn('服务端配置读取失败', e); }

        let localTimestamp = 0;
        try {
            if (localStorage.getItem(CK)) localData.config = JSON.parse(localStorage.getItem(CK));
            if (localStorage.getItem(AK)) localData.api = JSON.parse(localStorage.getItem(AK));
            if (localStorage.getItem(UK)) localData.ui = JSON.parse(localStorage.getItem(UK));
            // ❌ 删除旧的 prompts 读取

            const storedTimestamp = localStorage.getItem('gg_timestamp');
            if (storedTimestamp) localTimestamp = parseInt(storedTimestamp);
        } catch (e) { }

        const serverTimestamp = (serverData && serverData.lastModified) ? serverData.lastModified : 0;
        let useServerData = false;

        if (serverData && Object.keys(serverData).length > 0) {
            if (localTimestamp === 0 && serverTimestamp === 0) useServerData = true;
            else if (serverTimestamp >= localTimestamp) useServerData = true;
        }

        if (useServerData) {
            console.log('✅ [配置] 使用云端数据');
            if (serverData.config) Object.assign(C, serverData.config);

            // ✅ PROTECT PROGRESS POINTERS: Don't let global config overwrite chat-specific progress
            if (serverData.api) {
                delete serverData.api.lastSummaryIndex;
                delete serverData.api.lastBackfillIndex;
                Object.assign(API_CONFIG, serverData.api);
            }

            if (serverData.ui) Object.assign(UI, serverData.ui);

            // ✅ 新增：从云端恢复预设数据
            if (serverData.profiles && window.Gaigai.PromptManager) {
                window.Gaigai.PromptManager.saveProfilesData(serverData.profiles);
            }

            localStorage.setItem(CK, JSON.stringify(C));
            // ✅ Don't save progress pointers to localStorage - use cleaned version
            const cleanedApiForStorage = JSON.parse(JSON.stringify(API_CONFIG));
            delete cleanedApiForStorage.lastSummaryIndex;
            delete cleanedApiForStorage.lastBackfillIndex;
            localStorage.setItem(AK, JSON.stringify(cleanedApiForStorage));
            localStorage.setItem(UK, JSON.stringify(UI));
            localStorage.setItem('gg_timestamp', serverTimestamp.toString());
        }
        else if (localData.api || localData.config) {
            console.log('⚠️ [配置] 使用本地缓存');
            if (localData.config) Object.assign(C, localData.config);

            // ✅ PROTECT PROGRESS POINTERS: Don't let global config overwrite chat-specific progress
            if (localData.api) {
                delete localData.api.lastSummaryIndex;
                delete localData.api.lastBackfillIndex;
                Object.assign(API_CONFIG, localData.api);
            }

            if (localData.ui) Object.assign(UI, localData.ui);
            needMigration = true;
        }

        if (runtimeSummaryIndex !== undefined) API_CONFIG.lastSummaryIndex = runtimeSummaryIndex;
        if (runtimeBackfillIndex !== undefined) API_CONFIG.lastBackfillIndex = runtimeBackfillIndex;

        // 🛑 [安全修复] 严禁在读取配置阶段自动向服务器写入数据！
        // 如果读取失败，自动保存会导致用户的云端配置被默认设置覆盖清空。
        // 迁移操作应该由用户手动触发（点击"保存配置"按钮）。
        if (needMigration) {
            console.warn('⚠️ [配置迁移] 本地配置较新或云端缺失，将在用户下次手动保存时自动同步。');
            // 移除 toastr 弹窗：避免每次打开页面都弹出黄色警告，提升体验
        }
    }

    // ✅✅✅ [新增] 智能解析服务器设置数据（兼容不同版本的酒馆后端）
    function parseServerSettings(rawData) {
        // 如果数据被包裹在 settings 字符串中，进行解包
        if (rawData && typeof rawData.settings === 'string') {
            try {
                console.log('🔧 [解析] 检测到字符串包裹的配置，正在解包...');
                return JSON.parse(rawData.settings);
            } catch (e) {
                console.error('❌ [解析] 解包失败:', e);
                return rawData;
            }
        }
        console.log('✅ [解析] 配置格式正常，无需解包');
        return rawData;
    }

    // ✅✅✅ [新增] 统一的全量配置保存函数（使用 SillyTavern 原生方式）
    async function saveAllSettingsToCloud() {
        try {
            console.log('💾 [API] 开始保存配置到服务器...');

            // 1. Gather Data
            const cleanedApiConfig = JSON.parse(JSON.stringify(API_CONFIG));
            delete cleanedApiConfig.lastSummaryIndex;
            delete cleanedApiConfig.lastBackfillIndex;

            const allSettings = {
                config: C,
                api: cleanedApiConfig,
                ui: UI,
                profiles: window.Gaigai.PromptManager.getProfilesData(),  // ✅ 保存预设数据
                lastModified: Date.now()  // ✅ 添加时间戳用于防止冲突
            };

            console.log('🔒 [进度隔离] 已移除角色专属进度，仅保存通用配置');
            console.log(`⏰ [时间戳] 保存时间: ${new Date(allSettings.lastModified).toLocaleString()}`);

            // 2. Get CSRF
            let csrfToken = '';
            try { csrfToken = await getCsrfToken(); } catch (e) { }

            // 3. READ: Get current server settings strictly
            const getResponse = await fetch('/api/settings/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({})
            });

            if (!getResponse.ok) throw new Error('无法读取服务器配置');
            const rawResponse = await getResponse.json();
            const currentSettings = parseServerSettings(rawResponse);

            // 4. MODIFY: Inject plugin data safely
            if (!currentSettings.extension_settings) {
                currentSettings.extension_settings = {};
            }
            currentSettings.extension_settings.st_memory_table = allSettings;

            // 5. WRITE: Force save to disk immediately
            const saveResponse = await fetch('/api/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify(currentSettings)
            });

            if (!saveResponse.ok) throw new Error('无法写入服务器配置');

            // 6. BACKUP: Update local state
            if (!window.extension_settings) window.extension_settings = {};
            window.extension_settings.st_memory_table = allSettings;
            localStorage.setItem(CK, JSON.stringify(C));
            localStorage.setItem(AK, JSON.stringify(cleanedApiConfig)); // ✅ Use cleaned config without progress pointers
            localStorage.setItem(UK, JSON.stringify(UI));
            // ❌ 已删除：localStorage.setItem(PK, JSON.stringify(PROMPTS));
            // ✅ 预设数据现在由 PromptManager 管理，通过 profiles 保存

            // ✅ 关键修复：更新 serverData.lastModified，防止后续 loadConfig 误判回滚
            if (!window.serverData) window.serverData = {};
            window.serverData.lastModified = allSettings.lastModified;
            console.log(`✅ [时间戳更新] serverData.lastModified 已更新: ${new Date(allSettings.lastModified).toLocaleString()}`);

            console.log('✅ [API] 配置已强制写入 settings.json (Size:', JSON.stringify(allSettings).length, ')');
            // ✅ UX Improvement: Silent background sync (no toastr popup)
            // User gets feedback from manual button clicks, not from auto-save

        } catch (error) {
            console.error('❌ [API] 保存失败:', error);
            if (typeof toastr !== 'undefined') toastr.error(`保存失败: ${error.message}`, '错误');
        }
    }

    async function shcf() {
        // ⚡ [优化] 移除 loadConfig，使用 ochat 中预加载的数据，实现秒开
        const ctx = m.ctx();
        const totalCount = ctx && ctx.chat ? ctx.chat.length : 0;

        // ✅ 智能修正逻辑：如果指针超出范围，修正到当前最大值（而不是归零）
        if (totalCount > 0 && API_CONFIG.lastSummaryIndex > totalCount) {
            console.log(`⚠️ [进度修正] 总结指针超出范围，已修正为 ${totalCount}（原值: ${API_CONFIG.lastSummaryIndex}）`);
            API_CONFIG.lastSummaryIndex = totalCount;
        }
        if (totalCount > 0 && API_CONFIG.lastBackfillIndex > totalCount) {
            console.log(`⚠️ [进度修正] 填表指针超出范围，已修正为 ${totalCount}（原值: ${API_CONFIG.lastBackfillIndex}）`);
            API_CONFIG.lastBackfillIndex = totalCount;
        }
        // ✅ 如果指针未定义，初始化为 0
        if (API_CONFIG.lastSummaryIndex === undefined) API_CONFIG.lastSummaryIndex = 0;
        if (API_CONFIG.lastBackfillIndex === undefined) API_CONFIG.lastBackfillIndex = 0;

        const lastIndex = API_CONFIG.lastSummaryIndex;
        const lastBf = API_CONFIG.lastBackfillIndex;

        const h = `<div class="g-p" style="display: flex; flex-direction: column; gap: 12px;">
        <h4 style="margin:0 0 4px 0;">⚙️ 插件配置</h4>
        
        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                    <label style="font-weight: 600; display:block;">💡 实时填表</label>
                    <span style="font-size:10px; opacity:0.7;">每回合正文内回复 (与酒馆同一API)</span>
                </div>
                <input type="checkbox" id="c-enabled" ${C.enabled ? 'checked' : ''} style="transform: scale(1.2);">
            </div>
            
            <hr style="border: 0; border-top: 1px dashed rgba(0,0,0,0.1); margin: 5px 0 8px 0;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                    <label style="font-weight: 600; display:block;">⚡ 批量填表</label>
                    <span style="font-size:10px; opacity:0.7;">每隔N层填表 (建议配置独立API)</span>
                </div>
                <input type="checkbox" id="c-auto-bf" ${C.autoBackfill ? 'checked' : ''} style="transform: scale(1.2);">
            </div>
            
            <div id="auto-bf-settings" style="font-size: 11px; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px; margin-bottom: 5px; ${C.autoBackfill ? '' : 'display:none;'}">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <span>每</span>
                    <input type="number" id="c-auto-bf-floor" value="${C.autoBackfillFloor || 10}" min="2" style="width:50px; text-align:center; padding:2px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    <span>层触发一次</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; padding-left:8px; border-left:2px solid rgba(255,152,0,0.3);">
                    <input type="checkbox" id="c-auto-bf-delay" ${C.autoBackfillDelay ? 'checked' : ''} style="margin:0;">
                    <label for="c-auto-bf-delay" style="cursor:pointer; display:flex; align-items:center; gap:4px; margin:0;">
                        <span>⏱️ 延迟启动</span>
                    </label>
                    <span style="opacity:0.7;">|</span>
                    <span style="opacity:0.8;">滞后</span>
                    <input type="number" id="c-auto-bf-delay-count" value="${C.autoBackfillDelayCount || 5}" min="1" style="width:40px; text-align:center; padding:2px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    <span style="opacity:0.8;">层再执行</span>
                </div>
                <div style="background: rgba(33, 150, 243, 0.08); border: 1px solid rgba(33, 150, 243, 0.2); border-radius: 4px; padding: 8px; margin-bottom: 6px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #1976d2; font-size: 10px;">🔔 发起模式</div>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 2px;">
                        <input type="checkbox" id="c-auto-bf-prompt" ${C.autoBackfillPrompt ? 'checked' : ''}>
                        <span>🤫 触发前静默发起 (直接执行)</span>
                    </label>
                    <div style="font-size: 9px; color: #666; margin-left: 20px;">未勾选时弹窗确认</div>
                </div>
                <div style="background: rgba(76, 175, 80, 0.08); border: 1px solid rgba(76, 175, 80, 0.2); border-radius: 4px; padding: 8px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #388e3c; font-size: 10px;">✅ 完成模式</div>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 2px;">
                        <input type="checkbox" id="c-auto-bf-silent" ${C.autoBackfillSilent ? 'checked' : ''}>
                        <span>🤫 完成后静默保存 (不弹结果窗)</span>
                    </label>
                    <div style="font-size: 9px; color: ${UI.tc}; opacity:0.7; margin-left: 20px;">未勾选时弹窗显示填表结果</div>
                </div>
                <div style="margin-top:6px; color:${UI.tc}; opacity:0.7; font-size: 10px; text-align: center; display:flex; align-items:center; gap:6px; justify-content:center; flex-wrap: wrap;">
                    <span>进度指针:</span>
                    <input type="number" id="edit-last-bf" value="${lastBf}" min="0" max="${totalCount}" style="width:60px; text-align:center; padding:2px; border-radius:4px; border:1px solid rgba(0,0,0,0.2); font-size:10px;">
                    <span>层</span>
                    <button id="save-last-bf-btn" style="padding:2px 8px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:10px; white-space:nowrap;">修正</button>
                    <span>|</span>
                    <span id="reset-bf-range-btn" style="cursor:pointer; text-decoration:underline;">重置进度</span>
                    <span id="reset-bf-done-icon" style="display:none; color:green; margin-left:4px;">✔</span>
                </div>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <label style="font-weight: 600;">✂️ 隐藏楼层</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px;">留</span>
                    <input type="number" id="c-limit-count" value="${C.contextLimitCount}" min="5" style="width: 50px; text-align: center; border-radius: 4px; border:1px solid rgba(0,0,0,0.2);">
                    <input type="checkbox" id="c-limit-on" ${C.contextLimit ? 'checked' : ''}>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-weight: 600;">👁️ 楼层折叠</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px;">显</span>
                    <input type="number" id="c-uifold-count" value="${C.uiFoldCount || 50}" min="10" style="width: 50px; text-align: center; border-radius: 4px; border:1px solid rgba(0,0,0,0.2);">
                    <input type="checkbox" id="c-uifold-on" ${C.uiFold ? 'checked' : ''}>
                </div>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.92); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="font-weight: 600;">
                    💉 注入记忆表格
                    <i class="fa-solid fa-circle-info" id="memory-injection-info" style="margin-left: 6px; color: #17a2b8; cursor: pointer; font-size: 14px;"></i>
                </label>
                <input type="checkbox" id="c-table-inj" ${C.tableInj ? 'checked' : ''} style="transform: scale(1.2);">
            </div>

            <div style="font-size: 11px; opacity: 0.8; margin-bottom: 4px;">👇 备用方案 (当未找到 {{MEMORY}} 变量时)：</div>

            <div style="background: rgba(0,0,0,0.03); padding: 10px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.1); font-size: 11px; color: #666; line-height: 1.6;">
                <i class="fa-solid fa-circle-info" style="color: #17a2b8;"></i> <strong>默认策略：</strong><br>
                表格内容将作为 <strong>系统 (System)</strong> 消息，自动插入到 <strong>聊天记录 (Chat History)</strong> 的最上方（紧挨在 [Start a new Chat] 之前）。
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="font-weight: 600;">🤖 自动总结</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px;">每</span>
                    <input type="number" id="c-auto-floor" value="${C.autoSummaryFloor}" min="10" style="width: 50px; text-align: center; border-radius: 4px; border:1px solid rgba(0,0,0,0.2);">
                    <span style="font-size: 11px;">层</span>
                    <input type="checkbox" id="c-auto-sum" ${C.autoSummary ? 'checked' : ''} style="transform: scale(1.2);">
                </div>
            </div>
            
            <div id="auto-sum-settings" style="padding: 8px; background: rgba(0,0,0,0.03); border-radius: 4px; ${C.autoSummary ? '' : 'display:none;'}">
                <div style="display:flex; gap:15px; margin-bottom:8px;">
                    <label style="font-size:11px; display:flex; align-items:center; cursor:pointer; opacity:0.9;">
                        <input type="radio" name="cfg-sum-src" value="table" ${API_CONFIG.summarySource === 'table' ? 'checked' : ''} style="margin-right:4px;">
                        📊 仅表格
                    </label>
                    <label style="font-size:11px; display:flex; align-items:center; cursor:pointer; opacity:0.9;">
                        <input type="radio" name="cfg-sum-src" value="chat" ${API_CONFIG.summarySource === 'chat' ? 'checked' : ''} style="margin-right:4px;">
                        💬 聊天历史
                    </label>
                </div>

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; padding-left:8px; border-left:2px solid rgba(255,152,0,0.3); font-size:11px;">
                    <input type="checkbox" id="c-auto-sum-delay" ${C.autoSummaryDelay ? 'checked' : ''} style="margin:0;">
                    <label for="c-auto-sum-delay" style="cursor:pointer; display:flex; align-items:center; gap:4px; margin:0;">
                        <span>⏱️ 延迟启动</span>
                    </label>
                    <span style="opacity:0.7;">|</span>
                    <span style="opacity:0.8;">滞后</span>
                    <input type="number" id="c-auto-sum-delay-count" value="${C.autoSummaryDelayCount || 5}" min="1" style="width:40px; text-align:center; padding:2px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    <span style="opacity:0.8;">层再执行</span>
                </div>

                <div style="background: rgba(33, 150, 243, 0.08); border: 1px solid rgba(33, 150, 243, 0.2); border-radius: 4px; padding: 8px; margin-bottom: 6px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #1976d2; font-size: 10px;">🔔 发起模式</div>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 2px;">
                        <input type="checkbox" id="c-auto-sum-prompt" ${C.autoSummaryPrompt ? 'checked' : ''}>
                        <span>🤫 触发前静默发起 (直接执行)</span>
                    </label>
                    <div style="font-size: 9px; color: #666; margin-left: 20px;">未勾选时弹窗确认</div>
                </div>

                <div style="background: rgba(76, 175, 80, 0.08); border: 1px solid rgba(76, 175, 80, 0.2); border-radius: 4px; padding: 8px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #388e3c; font-size: 10px;">✅ 完成模式</div>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 2px;">
                        <input type="checkbox" id="c-auto-sum-silent" ${C.autoSummarySilent ? 'checked' : ''}>
                        <span>🤫 完成后静默保存 (不弹结果窗)</span>
                    </label>
                    <div style="font-size: 9px; color: #666; margin-left: 20px;">未勾选时弹窗显示总结结果</div>
                </div>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                <div style="font-weight: 600; color:var(--g-tc);">🏷️ 标签过滤</div>
                <div style="display:flex; gap:10px; font-size:11px; color:var(--g-tc);">
                    <label style="cursor:pointer;"><input type="radio" name="c-filter-mode" value="blacklist" ${C.filterMode !== 'whitelist' ? 'checked' : ''}> 🚫 黑名单(屏蔽)</label>
                    <label style="cursor:pointer;"><input type="radio" name="c-filter-mode" value="whitelist" ${C.filterMode === 'whitelist' ? 'checked' : ''}> ✅ 白名单(只留)</label>
                </div>
            </div>
            <div style="font-size:10px; color:var(--g-tc); opacity:0.7; margin-bottom:4px;">输入标签名，逗号分隔。例: <code style="background:rgba(0,0,0,0.1); padding:2px; color:var(--g-tc);">think, search</code></div>
            <input type="text" id="c-filter-tags" value="${esc(C.filterTags || '')}" placeholder="标签名..." style="width:100%; padding:5px; border:1px solid rgba(0,0,0,0.1); border-radius:4px; font-size:11px; font-family:monospace; color:var(--g-tc);">
            <div style="font-size:10px; color:#d63031; margin-top:4px;" id="filter-tip">
                ${C.filterMode === 'whitelist' ?
                '⚠️ 白名单模式：仅提取标签内的文字，丢弃其他所有内容（若未找到标签则保留原文）。' :
                '⚠️ 黑名单模式：删除标签及其内部的所有文字。'}
            </div>
        </div>

        <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 6px; padding: 10px; margin-top: 10px;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight: 600;">
                <input type="checkbox" id="c-sync-wi" ${C.syncWorldInfo ? 'checked' : ''}>
                <span>🌏 同步到世界书</span>
            </label>
            <div style="font-size: 10px; color: #666; margin-top: 6px; margin-left: 22px; line-height: 1.4;">
                将总结内容自动写入名为 <strong>[Memory_Context_Auto]</strong> 的世界书（常驻条目，触发词：总结/summary/前情提要/memory）
            </div>

            <!-- ✨✨✨ 新增：手动覆盖按钮区域 ✨✨✨ -->
            <div style="margin-top: 8px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 8px; display: flex; align-items: center; justify-content: flex-end;">
                <button id="btn-force-sync-wi" style="background: #ff9800; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-arrows-rotate"></i> 强制用总结表覆盖世界书
                </button>
            </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button id="open-api" style="flex:1; font-size:11px; padding:8px;">🤖 API配置</button>
            <button id="open-pmt" style="flex:1; font-size:11px; padding:8px;">📝 提示词</button>
        </div>
        <button id="save-cfg" style="width: 100%; padding: 8px; margin-top: 4px; font-weight: bold;">💾 保存配置</button>
        
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.1); text-align: center;">
            <button id="open-probe" style="width: 100%; padding: 8px; margin-bottom: 10px; background: #17a2b8; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🔍 最后发送内容 & Toke
            </button>

            <button id="force-cloud-load" title="强制从服务器拉取最新的 chatMetadata，解决手机/电脑数据不一致问题" style="width: 100%; padding: 8px; margin-bottom: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ☁️/🖥️ 强制读取服务端数据
            </button>
            <p style="font-size: 10px; color: #999; margin: -5px 0 10px 0;">解决多端同步问题（PC修改后移动端未更新）</p>

            <button id="rescue-btn" style="background: transparent; color: #dc3545; border: 1px dashed #dc3545; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; width: 100%;">
                🚑 扫描并恢复丢失的旧数据
            </button>
            <p style="font-size: 10px; color: #999; margin: 5px 0 0 0;">如果更新后表格变空，点此按钮尝试找回。</p>
        </div>
    </div>`;

        pop('⚙️ 配置', h, true);
        window.isEditingConfig = true; // 标记开始编辑配置，防止后台同步覆盖用户输入

        setTimeout(() => {
            // ✅✅✅ 新增：重置追溯进度
            $('#reset-bf-range-btn').on('click', async function () {
                API_CONFIG.lastBackfillIndex = 0;
                try { localStorage.setItem(AK, JSON.stringify(API_CONFIG)); } catch (e) { }

                // ✅ 同步到云端，防止 loadConfig 回滚
                if (typeof saveAllSettingsToCloud === 'function') {
                    await saveAllSettingsToCloud().catch(err => {
                        console.warn('⚠️ [重置追溯进度] 云端同步失败:', err);
                    });
                }

                m.save(); // ✅ 同步到聊天记录
                $('#edit-last-bf').val(0); // ✅ 更新输入框显示
                $('#reset-bf-done-icon').fadeIn().delay(1000).fadeOut();
            });

            // ✨✨✨ 新增：手动修正填表进度指针 ✨✨✨
            $('#save-last-bf-btn').on('click', async function () {
                const newValue = parseInt($('#edit-last-bf').val());

                // 验证输入
                if (isNaN(newValue)) {
                    await customAlert('请输入有效的数字', '错误');
                    return;
                }

                if (newValue < 0) {
                    await customAlert('进度不能为负数', '错误');
                    return;
                }

                if (newValue > totalCount) {
                    await customAlert(`进度不能超过当前总楼层数 (${totalCount})`, '错误');
                    return;
                }

                // 更新进度指针
                API_CONFIG.lastBackfillIndex = newValue;

                // 保存到 localStorage
                try { localStorage.setItem(AK, JSON.stringify(API_CONFIG)); } catch (e) { }

                // ✅ 关键步骤：同步到聊天记录元数据
                m.save();

                // ✅ 同步到云端服务器 (确保多设备一致性)
                await saveAllSettingsToCloud();

                // 成功提示
                if (typeof toastr !== 'undefined') {
                    toastr.success(`填表进度已修正为第 ${newValue} 层`, '进度修正', { timeOut: 1000, preventDuplicates: true });
                } else {
                    await customAlert(`✅ 填表进度已修正为第 ${newValue} 层\n\n已同步到本地和聊天记录`, '成功');
                }
            });

            // ✨✨✨ 自动总结开关的 UI 联动 ✨✨✨
            $('#c-auto-sum').on('change', function () {
                const isChecked = $(this).is(':checked');

                if (isChecked) {
                    $('#auto-sum-settings').slideDown();
                } else {
                    $('#auto-sum-settings').slideUp();
                }

                // ✅ Per-Chat Configuration: Update C and save to current chat immediately
                C.autoSummary = isChecked;
                m.save();
                console.log('💾 [每聊配置] 已保存自动总结设置到当前聊天:', isChecked);
            });

            // 💉 注入记忆表格说明图标点击事件
            $('#memory-injection-info').on('click', function () {
                // 🌙 Dark Mode Fix: Use dynamic colors based on darkMode setting
                const dialogBg = UI.darkMode ? '#1e1e1e' : '#ffffff';
                const titleColor = UI.darkMode ? '#e0e0e0' : '#333';
                const textColor = UI.darkMode ? '#c0c0c0' : '#555';
                const accentColor = UI.darkMode ? '#4db8ff' : '#155724';
                const codeBg = UI.darkMode ? '#2a2a2a' : '#f0f0f0';
                const borderColor = UI.darkMode ? 'rgba(255, 255, 255, 0.15)' : '#f0f0f0';

                // 创建一个小型弹窗而不是使用pop
                const $overlay = $('<div>', {
                    // class: 'g-ov', <--- 删掉了这一行
                    css: {
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.2)',
                        zIndex: 20000010,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }
                });

                const $dialog = $('<div>', {
                    css: {
                        background: dialogBg,
                        borderRadius: '12px',
                        padding: '20px',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                        margin: 'auto'
                    }
                });

                const $title = $('<div>', {
                    html: `<strong style="font-size: 15px; color: ${titleColor};">💉 变量模式说明</strong>`,
                    css: { marginBottom: '15px', paddingBottom: '10px', borderBottom: `2px solid ${borderColor}` }
                });

                const $content = $('<div>', {
                    css: { fontSize: '13px', lineHeight: '1.8', color: textColor },
                    html: `
                        <div style="margin-bottom: 12px; font-weight: 600; color: ${accentColor};">🌟 变量模式：</div>
                        <div style="margin-bottom: 12px;">与实时填表搭配使用，在酒馆的【预设】中随机一处插入变量调整填表提示词、总结内容、表格内容在上下文的位置：</div>
                        <div style="margin-bottom: 8px;">• 实时填表插入变量(全部表单含总结)：<code style="background:${codeBg}; color:${accentColor}; padding:2px 6px; border-radius:3px; font-weight:bold;">{{MEMORY}}</code> (跟随实时填表开关)</div>
                        <div style="margin-bottom: 8px;">• 表格插入变量(不含总结表)：<code style="background:${codeBg}; color:${accentColor}; padding:2px 6px; border-radius:3px; font-weight:bold;">{{MEMORY_TABLE}}</code> (强制发送表格内容)</div>
                        <div style="margin-bottom: 8px;">• 总结插入变量(不含其他表格)：<code style="background:${codeBg}; color:${accentColor}; padding:2px 6px; border-radius:3px; font-weight:bold;">{{MEMORY_SUMMARY}}</code> (强制发送总结内容)</div>
                        <div>• 填表规则插入变量：<code style="background:${codeBg}; color:${accentColor}; padding:2px 6px; border-radius:3px; font-weight:bold;">{{MEMORY_PROMPT}}</code></div>
                    `
                });

                const $closeBtn = $('<button>', {
                    text: '知道了',
                    css: {
                        marginTop: '15px',
                        padding: '8px 20px',
                        background: UI.c || '#888',
                        color: UI.tc || '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        width: '100%'
                    }
                }).on('click', () => $overlay.remove());

                $dialog.append($title, $content, $closeBtn);
                $overlay.append($dialog);
                $('body').append($overlay);

                // 点击遮罩层也可以关闭
                $overlay.on('click', function (e) {
                    if (e.target === $overlay[0]) {
                        $overlay.remove();
                    }
                });
            });

            $('#open-probe').on('click', function () {
                if (typeof window.Gaigai.showLastRequest === 'function') {
                    window.Gaigai.showLastRequest();
                } else {
                    customAlert('❌ 探针模块 (probe.js) 尚未加载。\n\n请确保 probe.js 文件存在于同级目录下，并尝试刷新页面。', '错误');
                }
            });

            // ✨✨✨ 新增：强制读取服务端数据（解决多端同步问题）
            // ✨✨✨ [修复版] 直接从服务器 API 获取最新 settings.json
            $('#force-cloud-load').off('click').on('click', async function () {
                const btn = $(this);
                const originalText = btn.text();
                btn.text('正在全量同步...').prop('disabled', true);

                try {
                    // 第一步：同步全局配置 (Settings)
                    console.log('🔄 [Step 1] 同步全局配置...');
                    const csrfToken = await getCsrfToken();

                    const response = await fetch('/api/settings/get?t=' + Date.now(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify({})
                    });

                    if (!response.ok) throw new Error(`配置同步失败: ${response.status}`);

                    const data = await response.json();
                    const parsedData = parseServerSettings(data);
                    const serverConfig = parsedData?.extension_settings?.st_memory_table;

                    if (serverConfig) {
                        if (serverConfig.config) Object.assign(C, serverConfig.config);
                        if (serverConfig.api) Object.assign(API_CONFIG, serverConfig.api);
                        if (serverConfig.ui) Object.assign(UI, serverConfig.ui);
                        // ✅ 处理预设数据（由 PromptManager 管理）
                        if (serverConfig.profiles) {
                            localStorage.setItem('gg_profiles', JSON.stringify(serverConfig.profiles));
                            console.log('✅ [云端加载] 预设数据已同步');
                        }

                        localStorage.setItem('gg_config', JSON.stringify(C));
                        localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                        localStorage.setItem('gg_ui', JSON.stringify(UI));

                        $('#c-enabled').prop('checked', C.enabled);
                        $('#c-auto-bf').prop('checked', C.autoBackfill);
                        $('#c-auto-sum').prop('checked', C.autoSummary);
                    }

                    // 第二步：同步记忆表格与进度 (Chat Metadata)
                    console.log('🔄 [Step 2] 同步表格数据与进度...');

                    const context = SillyTavern.getContext();
                    if (context && context.chatId) {
                        // 使用全局 window 对象调用
                        if (typeof window.loadChat === 'function') {
                            await window.loadChat(context.chatId);
                        } else {
                            console.warn('无法调用 loadChat，跳过刷新');
                        }

                        setTimeout(() => {
                            m.load();
                            shw();

                            customAlert('✅ 全量同步成功！\n\n1. 全局配置已更新\n2. 表格内容已更新\n3. 进度指针已更新', '同步完成');
                        }, 1500);
                    } else {
                        await customAlert('✅ 配置已同步，但未检测到活跃聊天，跳过数据同步。', '部分完成');
                    }

                } catch (error) {
                    console.error('❌ 同步失败:', error);
                    await customAlert(`❌ 同步失败：${error.message}`, '错误');
                } finally {
                    btn.text(originalText).prop('disabled', false);
                }
            });

            // 🚑 历史存档时光机按钮
            $('#rescue-btn').off('click').on('click', async function () {
                const btn = $(this);
                const originalText = btn.text();
                btn.text('正在扫描全盘...');

                // === 🌙 变量定义区 ===
                const isDark = UI.darkMode; 
                const bgColor = isDark ? '#1e1e1e' : '#fff';
                const txtColor = isDark ? '#e0e0e0' : UI.tc;
                const borderColor = isDark ? '1px solid rgba(255,255,255,0.15)' : 'none';
                const rowBorder = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee';
                const shadow = isDark ? '0 10px 40px rgba(0,0,0,0.6)' : '0 5px 20px rgba(0,0,0,0.3)';
                
                // ✨ 修复关键：定义按钮默认颜色
                // 如果是夜间模式，按钮文字用浅灰色(#e0e0e0)；如果是白天，用主题色(UI.c)
                const btnDefColor = isDark ? '#e0e0e0' : UI.c;
                const btnBorderColor = isDark ? 'rgba(255,255,255,0.3)' : UI.c;
                // ===================

                let backups = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('gg_data_')) {
                        try {
                            const raw = localStorage.getItem(key);
                            const d = JSON.parse(raw);
                            const count = d.d ? d.d.reduce((sum, sheet) => sum + (sheet.r ? sheet.r.length : 0), 0) : 0;
                            const ts = d.ts || 0;
                            backups.push({ key, count, ts, dateStr: new Date(ts).toLocaleString(), id: d.id, data: d });
                        } catch (e) { }
                    }
                }

                backups.sort((a, b) => b.ts - a.ts);

                if (backups.length === 0) {
                    await customAlert('❌ 未找到历史数据。', '扫描结果');
                    btn.text(originalText);
                    return;
                }

                const $overlay = $('<div>', { css: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', zIndex:20000020, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }});
                
                const $box = $('<div>', {
                    css: {
                        background: bgColor,
                        color: txtColor,
                        border: borderColor,
                        width:'500px',
                        maxWidth:'92vw',
                        maxHeight:'85vh',
                        margin:'auto',
                        padding:'15px',
                        borderRadius:'12px',
                        display:'flex',
                        flexDirection:'column',
                        overflow:'hidden',
                        boxShadow: shadow
                    }
                }).html(`
                    <h3 style="margin:0 0 15px 0; flex-shrink:0; display:flex; align-items:center; gap:8px;">
                        🚑 历史存档时光机
                    </h3>
                    <div style="flex:1; overflow-y:auto; margin-bottom:15px; border-radius:6px; border:${rowBorder};">
                        <table style="width:100%; font-size:12px; border-collapse: collapse;">
                            <thead style="position:sticky; top:0; background:${UI.c}; color:#fff;">
                                <tr><th style="padding:10px;">时间</th><th style="width:60px;">数据量</th><th style="width:60px;">操作</th></tr>
                            </thead>
                            <tbody>${backups.map(b => {
                                const countStyle = b.count > 0 ? 'color:#28a745; font-weight:bold;' : (isDark ? 'color:#777;' : 'color:#999;');
                                const subTextStyle = isDark ? 'color:#888;' : 'color:#999;';
                                
                                // ✨ 修改：按钮 style 中的 color 使用 btnDefColor 变量
                                return `<tr style="border-bottom:${rowBorder}; transition:background 0.2s;">
                                    <td style="padding:10px;">
                                        <div style="font-weight:600; margin-bottom:2px;">${b.dateStr}</div>
                                        <div style="font-size:10px; ${subTextStyle} white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${b.id}</div>
                                    </td>
                                    <td style="padding:10px; text-align:center; ${countStyle}">${b.count} 行</td>
                                    <td style="padding:10px; text-align:center;">
                                        <button class="restore-item-btn" data-key="${b.key}" style="padding:4px 10px; cursor:pointer; white-space:nowrap; background:transparent; border:1px solid ${btnBorderColor}; color:${btnDefColor}; border-radius:4px;">恢复</button>
                                    </td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <button id="close-rescue" style="padding:8px 20px; cursor:pointer; background:${isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0'}; border:none; border-radius:6px; color:${txtColor};">关闭</button>
                    </div>
                `);

                $overlay.append($box);
                $('body').append($overlay);

                $box.find('tr').hover(
                    function() { $(this).css('background', isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'); },
                    function() { $(this).css('background', 'transparent'); }
                );

                // ✨ 修复：鼠标移出时，恢复的颜色必须是 btnDefColor，而不是 UI.c
                $box.find('.restore-item-btn').hover(
                    function() { 
                        // 鼠标悬停：背景变主题色，字变白
                        $(this).css({background: UI.c, color: '#fff', border: `1px solid ${UI.c}`}); 
                    },
                    function() { 
                        // 鼠标移出：背景变透明，字变回默认色(夜间为白，白天为主题色)
                        $(this).css({background: 'transparent', color: btnDefColor, border: `1px solid ${btnBorderColor}`}); 
                    }
                ).on('click', async function() {
                    const key = $(this).data('key');
                    const target = backups.find(b => b.key === key);
                    if(await customConfirm(`确定回退到 ${target.dateStr} (包含 ${target.count} 行数据) 吗？\n\n⚠️ 当前未保存的内容将会丢失！`, '回档确认')) {
                        m.s.forEach((sheet, i) => {
                            if (target.data.d[i]) sheet.from(target.data.d[i]);
                            else sheet.clear();
                        });
                        if (target.data.summarized) summarizedRows = target.data.summarized;
                        m.save(true);
                        shw(); 
                        $overlay.remove();
                        if (typeof toastr !== 'undefined') toastr.success('✅ 数据已恢复！');
                    }
                });

                $('#close-rescue').on('click', () => $overlay.remove());
                
                $overlay.on('click', (e) => {
                    if(e.target === $overlay[0]) $overlay.remove();
                });

                btn.text(originalText);
            });
            
            // 互斥开关控制
            $('#c-enabled').on('change', async function () {
                const isChecked = $(this).is(':checked');

                if (isChecked) {
                    if ($('#c-auto-bf').is(':checked')) {
                        await customAlert('⚠️ 冲突提示\n\n【实时记忆填表】和【自动批量填表】不能同时开启。\n\n已自动关闭自动填表。', '模式切换');
                        $('#c-auto-bf').prop('checked', false);
                        $('#auto-bf-settings').slideUp();
                        C.autoBackfill = false; // Update config
                    }
                }

                // ✅ Per-Chat Configuration: Update C and save to current chat immediately
                C.enabled = isChecked;
                m.save();
                console.log('💾 [每聊配置] 已保存实时填表设置到当前聊天:', isChecked);
            });

            $('#c-auto-bf').on('change', async function () {
                const isChecked = $(this).is(':checked');

                if (isChecked) {
                    $('#auto-bf-settings').slideDown();
                    if ($('#c-enabled').is(':checked')) {
                        if (await customConfirm('⚠️ 模式切换\n\n开启【自动批量填表】需要关闭【实时记忆填表】。\n\n确定切换吗？', '确认')) {
                            $('#c-enabled').prop('checked', false);
                            C.enabled = false; // Update config
                        } else {
                            $(this).prop('checked', false);
                            $('#auto-bf-settings').slideUp();
                            return; // Don't save if user cancelled
                        }
                    }
                } else {
                    $('#auto-bf-settings').slideUp();
                }

                // ✅ Per-Chat Configuration: Update C and save to current chat immediately
                C.autoBackfill = isChecked;
                m.save();
                console.log('💾 [每聊配置] 已保存批量填表设置到当前聊天:', isChecked);
            });

            $('#save-cfg').on('click', async function () {
                // ✅ 设置全局保存标记，防止并发冲突
                window.isSavingConfig = true;
                console.log('🔒 [配置保存] 已锁定，暂停其他 loadConfig 调用');

                try {
                    // ✨ 保存旧配置状态，用于检测世界书同步的变化
                    const oldSyncWorldInfo = C.syncWorldInfo;

                    // ✅ 步骤 1：直接更新内存中的 C 对象（从 UI 读取）
                    C.enabled = $('#c-enabled').is(':checked');
                    C.autoBackfill = $('#c-auto-bf').is(':checked');
                    C.autoBackfillFloor = parseInt($('#c-auto-bf-floor').val()) || 10;
                    C.autoBackfillPrompt = $('#c-auto-bf-prompt').is(':checked');
                    C.autoBackfillSilent = $('#c-auto-bf-silent').is(':checked');
                    C.autoBackfillDelay = $('#c-auto-bf-delay').is(':checked');
                    C.autoBackfillDelayCount = parseInt($('#c-auto-bf-delay-count').val()) || 5;
                    C.contextLimit = $('#c-limit-on').is(':checked');
                    C.contextLimitCount = parseInt($('#c-limit-count').val());
                    C.uiFold = $('#c-uifold-on').is(':checked');
                    C.uiFoldCount = parseInt($('#c-uifold-count').val());
                    C.tableInj = $('#c-table-inj').is(':checked');
                    C.tablePos = 'system'; // ✨ 强制默认值：系统角色
                    C.tablePosType = $('#c-table-pos-type').val();
                    C.tableDepth = parseInt($('#c-table-depth').val()) || 0;
                    C.autoSummary = $('#c-auto-sum').is(':checked');
                    C.autoSummaryFloor = parseInt($('#c-auto-floor').val());
                    C.autoSummaryPrompt = $('#c-auto-sum-prompt').is(':checked');
                    C.autoSummarySilent = $('#c-auto-sum-silent').is(':checked');
                    C.autoSummaryDelay = $('#c-auto-sum-delay').is(':checked');
                    C.autoSummaryDelayCount = parseInt($('#c-auto-sum-delay-count').val()) || 5;
                    C.filterTags = $('#c-filter-tags').val();
                    C.filterMode = $('input[name="c-filter-mode"]:checked').val();
                    C.log = true;           // 默认开启日志
                    C.pc = true;            // 默认开启角色独立存储 (重要)
                    C.hideTag = true;       // 默认开启隐藏标签
                    C.filterHistory = true; // 默认开启历史过滤
                    C.syncWorldInfo = $('#c-sync-wi').is(':checked');

                    API_CONFIG.summarySource = $('input[name="cfg-sum-src"]:checked').val();

                    console.log('✅ [配置保存] 步骤1：内存对象已更新');

                    // ✅ 步骤 2：立即保存到 localStorage（确保本地持久化）
                    try {
                        localStorage.setItem(CK, JSON.stringify(C));
                        localStorage.setItem(AK, JSON.stringify(API_CONFIG));
                        localStorage.setItem('gg_timestamp', Date.now().toString());
                        console.log('✅ [配置保存] 步骤2：localStorage 已更新');
                    } catch (e) {
                        console.error('❌ [配置保存] localStorage 写入失败:', e);
                    }

                    // ✨ 检测世界书同步从开启到关闭的状态变化，提示用户手动禁用世界书条目
                    if (oldSyncWorldInfo === true && C.syncWorldInfo === false) {
                        await customAlert('⚠️ 检测到您关闭了世界书同步\n\n请务必手动前往酒馆顶部的【世界书/知识书】面板，禁用或删除 [Memory_Context_Auto] 条目，否则旧的总结内容仍会持续发送给 AI。\n\n💡 互斥机制：\n• 开启同步：由世界书发送总结（插件不重复注入）\n• 关闭同步：由插件注入总结（需手动清理世界书）', '重要提示');
                    }

                    // ✅ 步骤 3：异步保存到云端（不阻塞用户操作）
                    await saveAllSettingsToCloud();
                    console.log('✅ [配置保存] 步骤3：云端同步完成');

                    applyUiFold();

                    if (C.autoBackfill && C.enabled) {
                        C.enabled = false;
                        $('#c-enabled').prop('checked', false);
                        localStorage.setItem(CK, JSON.stringify(C));
                        localStorage.setItem('gg_timestamp', Date.now().toString());  // ✅ 添加时间戳

                        // ✅✅✅ 修复：自动关闭实时填表后，再次同步到云端
                        await saveAllSettingsToCloud().catch(err => {
                            console.warn('⚠️ [自动关闭实时填表] 云端同步失败:', err);
                        });
                    }

                    await customAlert('配置已保存', '成功');

                } catch (error) {
                    console.error('❌ [配置保存] 保存失败:', error);
                    await customAlert(`配置保存失败：${error.message}`, '错误');
                } finally {
                    // ✅ 无论成功失败，都要释放锁
                    window.isSavingConfig = false;
                    console.log('🔓 [配置保存] 已解锁');
                }
            });

            $('#open-api').on('click', () => navTo('AI总结配置', shapi));
            $('#open-pmt').on('click', () => navTo('提示词管理', window.Gaigai.PromptManager.showPromptManager));

            // ✨✨✨ 强制覆盖世界书 (V8 终极版：模拟前端导入) ✨✨✨
            $('#btn-force-sync-wi').off('click').on('click', async function() {
                const summarySheet = m.get(8);

                // 1. 安全拦截
                if (!summarySheet || summarySheet.r.length === 0) {
                    await customAlert('❌ 总结表格为空！\n\n无法执行覆盖操作。', '安全拦截');
                    return;
                }

                // 2. 确认提示
                const confirmMsg = `⚠️ 确定要强制覆盖吗？\n\n1. 当前世界书将被【清空】。\n2. 总结表中的 ${summarySheet.r.length} 条记录将被写入。`;
                if (!await customConfirm(confirmMsg, '覆盖确认')) {
                    return;
                }

                const btn = $(this);
                const oldText = btn.html();
                btn.html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...').prop('disabled', true);

                try {
                    // 3. 准备基础信息
                    const uniqueId = m.gid() || "Unknown_Chat";
                    const safeName = uniqueId.replace(/[\\/:*?"<>|]/g, "_");
                    const worldBookName = "Memory_Context_" + safeName;

                    // 4. 构建标准 World Info JSON
                    const importEntries = {};
                    let maxUid = -1;

                    summarySheet.r.forEach((row, index) => {
                        const uid = index; // 重置 UID，从 0 开始顺序排列
                        maxUid = uid;

                        const title = row[0] || '无标题';
                        const content = row[1] || '';
                        const note = (row[2] && row[2].trim()) ? ` [${row[2]}]` : '';

                        importEntries[uid] = {
                            uid: uid,
                            key: ["总结", "summary", "前情提要", "memory", "记忆"],
                            keysecondary: [],
                            comment: `[绑定对话: ${safeName}] 强制覆盖于 ${new Date().toLocaleString()}`,
                            content: `【${title}${note}】\n${content}`,
                            constant: true,
                            vectorized: false,
                            enabled: true,
                            position: 1, // 角色定义后
                            order: 100,
                            extensions: { position: 1, exclude_recursion: false, display_index: 0, probability: 100, useProbability: true }
                        };
                    });

                    const finalJson = {
                        entries: importEntries,
                        name: worldBookName
                    };

                    // 5. 关键步骤：模拟文件上传 (V8 方案)
                    const $fileInput = $('#world_import_file');
                    if ($fileInput.length === 0) {
                        throw new Error('未找到上传控件 #world_import_file，请确保位于酒馆主界面。');
                    }

                    // 创建虚拟文件
                    const file = new File([JSON.stringify(finalJson)], `${worldBookName}.json`, { type: "application/json" });

                    // 利用 DataTransfer 注入
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    $fileInput[0].files = dataTransfer.files;

                    // 触发导入
                    console.log('⚡ [强制覆盖] 触发前端模拟导入...');
                    $fileInput[0].dispatchEvent(new Event('change', { bubbles: true }));
                    $fileInput.trigger('change');

                    // 6. 更新本地缓存 (防止后续自动任务冲突)
                    if (typeof globalWorldInfoEntriesCache !== 'undefined') {
                        globalWorldInfoEntriesCache = importEntries;
                        globalLastWorldInfoUid = maxUid;
                    }

                    if (typeof toastr !== 'undefined') {
                        toastr.success(`已重置并加载 ${summarySheet.r.length} 条记录`, '覆盖成功');
                    }

                } catch (e) {
                    console.error(e);
                    await customAlert(`操作失败: ${e.message}`, '错误');
                } finally {
                    btn.html(oldText).prop('disabled', false);
                }
            });

            // ✨ 动态更新过滤模式提示文字
            $('input[name="c-filter-mode"]').on('change', function () {
                const mode = $(this).val();
                const tip = mode === 'whitelist' ?
                    '⚠️ 白名单模式：仅提取 <tag> 内的文字，丢弃其他所有内容（若未找到标签则保留原文）。' :
                    '⚠️ 黑名单模式：删除 <tag> 及其内部的所有文字。';
                $('#filter-tip').html(tip);
            });
        }, 100);
    }

    // ==================== 表格结构编辑器 ====================

    function esc(t) { const mp = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return String(t).replace(/[&<>"']/g, c => mp[c]); }

    // ✅ 新增：反转义函数，专门处理 AI 吐出来的 &lt;Memory&gt;
    function unesc(t) {
        return String(t)
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    }

    // ========================================================================
    // ========== 自动化功能模块：消息监听、批量填表、自动总结 ==========
    // ========================================================================

    /**
     * 消息监听核心函数（支持回滚处理和UI自动刷新）
     * 监听每条新消息，解析Memory标签，触发批量填表和自动总结
     * ✨ 已优化：加入防抖和延迟机制，确保 AI 消息完全生成后再处理
     * @param {number} id - 消息ID（可选，默认为最新消息）
     */
    function omsg(id) {
        try {
            const x = m.ctx();
            if (!x || !x.chat) return;
            const currentSessionId = m.gid(); // 🔒 锁定当前会话ID


            // 确定当前触发的消息ID
            const i = typeof id === 'number' ? id : x.chat.length - 1;
            const mg = x.chat[i];

            if (!mg || mg.is_user) return;

            const msgKey = i.toString();

            // 🛑 [核心修复] 移除 processedMessages 的拦截
            // 只要 omsg 被调用，就说明要么是新消息，要么是重Roll/Swipe，必须重新计算
            // 我们只保留定时器防抖，防止流式传输时频繁触发

            // 🧹 防抖：清除该楼层的旧定时器
            if (pendingTimers[msgKey]) {
                clearTimeout(pendingTimers[msgKey]);
                console.log(`🔄 [防抖] 已清除消息 ${msgKey} 的旧定时器`);
            }

            // ⏳ 保存新的定时器ID，延迟 1000ms 执行 (给流式传输缓冲时间，可调整为500-2000ms)
            console.log(`⏳ [延迟] 消息 ${msgKey} 将在 1 秒后处理（等待流式传输完成）`);
            pendingTimers[msgKey] = setTimeout(() => {
                try {

                    // 🛑 [防串味] 执行前再次检查ID，不对立刻停止
                if (m.gid() !== currentSessionId) {
                    console.warn('🛑 [安全拦截] 会话已变更，终止写入！');
                    return;
                }
                    // ✅ [修复进度指针重置] 在核心计算前加载最新配置，防止 API_CONFIG.lastBackfillIndex 被后台同步重置
                    m.load();

                    // 重新获取最新上下文
                    const x = m.ctx();
                    if (!x || !x.chat) return;
                    const mg = x.chat[i];
                    if (!mg) return; // 消息可能被删了

                    console.log(`⚡ [核心计算] 开始处理第 ${i} 楼 (Swipe: ${mg.swipe_id || 0})`);


                    // ============================================================
                    // 步骤 1: 回滚到基准线 (Base State)
                    // 逻辑：第N楼的状态 = 第N-1楼的快照 + 第N楼的新指令
                    // ============================================================
                    if (C.enabled) {
                        let baseIndex = i - 1;
                        let baseKey = null;

                        // 倒序查找最近的一个有效存档（最远找到 -1 创世快照）
                        while (baseIndex >= -1) {
                            const key = baseIndex.toString();
                            if (snapshotHistory[key]) {
                                baseKey = key;
                                break;
                            }
                            baseIndex--;
                        }

                        // 🛡️ 基准快照检查
                        if (baseKey) {
                            // ⚡ 强制回档！这一步非常关键
                            // 无论当前表格是什么样，必须先回到上一楼的样子
                            restoreSnapshot(baseKey);
                            console.log(`↺ [同步] 基准重置成功：已回滚至快照 [${baseKey}]`);
                        } else {
                            // [新增] 熔断机制：如果是非第一条消息且找不到基准快照，禁止继续写入
                            // 这通常发生在重Roll时丢失了上一个状态，继续写入会导致数据重复叠加
                            if (i > 0) {
                                console.error(`🛑 [熔断] 第 ${i} 楼找不到前序快照，已停止自动写入以防止数据污染/重复。`);
                                return; // 强制终止本次处理
                            }
                        }

                        // ============================================================
                        // 步骤 2: 读取当前楼层 (可能是重Roll的，可能是Swipe切回来的)
                        // ============================================================

                        // 获取当前显示的文本 (强制读取 swipes 里的对应分支)
                        const swipeId = mg.swipe_id ?? 0;
                        let tx = '';
                        if (mg.swipes && mg.swipes.length > swipeId) {
                            tx = mg.swipes[swipeId];
                        } else {
                            tx = mg.mes || ''; // 兜底
                        }

                        // ============================================================
                        // 步骤 3: 解析并执行指令 (Rehydration)
                        // ============================================================
                        const cs = prs(tx);
                        if (cs.length > 0) {
                            console.log(`⚡ [写入] 识别到 ${cs.length} 条指令，正在写入表格...`);
                            exe(cs);
                            m.save(); // 保存到本地存储

                            // ✅ [修复重复处理] 更新进度指针，防止自动总结和批量填表重复处理该楼层
                            API_CONFIG.lastSummaryIndex = i;
                            API_CONFIG.lastBackfillIndex = i;
                            localStorage.setItem(AK, JSON.stringify(API_CONFIG));

                            // ✅ 同步到云端，防止 loadConfig 回滚
                            if (typeof saveAllSettingsToCloud === 'function') {
                                saveAllSettingsToCloud().catch(err => {
                                    console.warn('⚠️ [实时填表] 云端同步失败:', err);
                                });
                            }

                            console.log(`✅ [实时填表] 进度指针已更新至第 ${i} 楼`);
                        } else {
                            console.log(`Testing: 第 ${i} 楼无指令，保持基准状态。`);
                        }

                        // ============================================================
                        // 步骤 4: 生成当前楼层的新快照 (Save Snapshot i)
                        // 这样第 i+1 楼就能用这个作为基准了
                        // ============================================================
                        const newSnapshot = {
                            data: m.all().slice(0, 8).map(sh => JSON.parse(JSON.stringify(sh.json()))),
                            summarized: JSON.parse(JSON.stringify(summarizedRows)),
                            timestamp: Date.now()
                        };
                        snapshotHistory[msgKey] = newSnapshot;
                        console.log(`📸 [快照] 第 ${i} 楼的新状态已封存。`);

                        cleanOldSnapshots();
                    }

                    // 🚦 标志位
                    let hasBackfilledThisTurn = false;

                    // ============================================================
                    // 模块 A-2: 自动批量填表
                    // ============================================================
                    if (C.autoBackfill && !isInitCooling) { // ✨ 只有冷却期过才允许触发
                        const lastBfIndex = API_CONFIG.lastBackfillIndex || 0;
                        const currentCount = x.chat.length;
                        const diff = currentCount - lastBfIndex;

                        // 计算有效阈值
                        const bfInterval = C.autoBackfillFloor || 10;
                        // 如果开启延迟，则阈值 = 间隔 + 延迟层数；否则阈值 = 间隔
                        const bfDelay = C.autoBackfillDelay ? (C.autoBackfillDelayCount || 0) : 0;
                        const bfThreshold = bfInterval + bfDelay;

                        if (diff >= bfThreshold) {
                            // 计算目标结束点 (Target End Floor)
                            // 如果开启延迟：结束点 = 上次位置 + 间隔 (只处理这一段，后面的留作缓冲)
                            // 如果关闭延迟：结束点 = 当前位置 (处理所有未记录的内容，保持旧逻辑)
                            const targetEndIndex = C.autoBackfillDelay ? (lastBfIndex + bfInterval) : currentCount;

                            console.log(`⚡ [Auto Backfill] 触发逻辑! 当前:${currentCount}, 上次:${lastBfIndex}, 间隔:${bfInterval}, 延迟:${bfDelay}, 阈值:${bfThreshold}, 目标结束点:${targetEndIndex}`);

                            // ✨ 发起模式逻辑（与完成模式一致）：勾选=静默，未勾选=弹窗
                            if (!C.autoBackfillPrompt) {
                                // 弹窗模式（未勾选时）
                                showAutoTaskConfirm('backfill', currentCount, lastBfIndex, bfThreshold).then(result => {
                                    if (result.action === 'confirm') {
                                        if (result.postpone > 0) {
                                            // 用户选择顺延
                                            API_CONFIG.lastBackfillIndex = currentCount - bfThreshold + result.postpone;
                                            localStorage.setItem(AK, JSON.stringify(API_CONFIG));

                                            // ✅✅✅ 修复：同步到云端，防止 loadConfig 回滚
                                            if (typeof saveAllSettingsToCloud === 'function') {
                                                saveAllSettingsToCloud().catch(err => {
                                                    console.warn('⚠️ [填表顺延] 云端同步失败:', err);
                                                });
                                            }

                                            m.save(); // ✅ 修复：同步进度到聊天记录
                                            console.log(`⏰ [批量填表] 顺延 ${result.postpone} 楼，新触发点：${API_CONFIG.lastBackfillIndex + bfThreshold}`);
                                            if (typeof toastr !== 'undefined') {
                                                toastr.info(`批量填表已顺延 ${result.postpone} 楼`, '记忆表格');
                                            }
                                        } else {
                                            // 立即执行
                                            if (window.Gaigai.BackfillManager && typeof window.Gaigai.BackfillManager.autoRunBackfill === 'function') {
                                                window.Gaigai.BackfillManager.autoRunBackfill(lastBfIndex, targetEndIndex);
                                                hasBackfilledThisTurn = true;
                                            }
                                        }
                                    } else {
                                        console.log(`🚫 [批量填表] 用户取消`);
                                    }
                                });
                            } else {
                                // 静默模式（勾选时）：直接执行
                                if (window.Gaigai.BackfillManager && typeof window.Gaigai.BackfillManager.autoRunBackfill === 'function') {
                                    window.Gaigai.BackfillManager.autoRunBackfill(lastBfIndex, targetEndIndex);
                                    hasBackfilledThisTurn = true;
                                }
                            }
                        }
                    }

                    // ============================================================
                    // 模块 B: 自动总结
                    // ============================================================
                    if (C.autoSummary && !isInitCooling) { // ✨ 只有冷却期过才允许触发
                        const lastIndex = API_CONFIG.lastSummaryIndex || 0;
                        const currentCount = x.chat.length;
                        const newMsgCount = currentCount - lastIndex;

                        // 计算有效阈值
                        const sumInterval = C.autoSummaryFloor || 50;
                        // 如果开启延迟，则阈值 = 间隔 + 延迟层数；否则阈值 = 间隔
                        const sumDelay = C.autoSummaryDelay ? (C.autoSummaryDelayCount || 0) : 0;
                        const sumThreshold = sumInterval + sumDelay;

                        if (newMsgCount >= sumThreshold) {
                            // 计算目标结束点 (Target End Floor)
                            // 如果开启延迟：结束点 = 上次位置 + 间隔 (只处理这一段，后面的留作缓冲)
                            // 如果关闭延迟：结束点 = 当前位置 (处理所有未记录的内容，保持旧逻辑)
                            const targetEndIndex = C.autoSummaryDelay ? (lastIndex + sumInterval) : currentCount;

                            if (hasBackfilledThisTurn) {
                                console.log(`🚦 [防撞车] 总结任务顺延。`);
                            } else {
                                console.log(`🤖 [Auto Summary] 触发逻辑! 当前:${currentCount}, 上次:${lastIndex}, 间隔:${sumInterval}, 延迟:${sumDelay}, 阈值:${sumThreshold}, 目标结束点:${targetEndIndex}`);

                                // ✨ 发起模式逻辑（与完成模式一致）：勾选=静默，未勾选=弹窗
                                if (!C.autoSummaryPrompt) {
                                    // 弹窗模式（未勾选时）
                                    showAutoTaskConfirm('summary', currentCount, lastIndex, sumThreshold).then(result => {
                                        if (result.action === 'confirm') {
                                            if (result.postpone > 0) {
                                                // 用户选择顺延
                                                API_CONFIG.lastSummaryIndex = currentCount - sumThreshold + result.postpone;
                                                localStorage.setItem(AK, JSON.stringify(API_CONFIG));

                                                // ✅✅✅ 修复：同步到云端，防止 loadConfig 回滚
                                                if (typeof saveAllSettingsToCloud === 'function') {
                                                    saveAllSettingsToCloud().catch(err => {
                                                        console.warn('⚠️ [总结顺延] 云端同步失败:', err);
                                                    });
                                                }

                                                m.save(); // ✅ 修复：同步进度到聊天记录
                                                console.log(`⏰ [自动总结] 顺延 ${result.postpone} 楼，新触发点：${API_CONFIG.lastSummaryIndex + sumThreshold}`);
                                                if (typeof toastr !== 'undefined') {
                                                    toastr.info(`自动总结已顺延 ${result.postpone} 楼`, '记忆表格');
                                                }
                                            } else {
                                                // 立即执行（传入目标结束点和完成后的静默参数）
                                                window.Gaigai.SummaryManager.callAIForSummary(null, targetEndIndex, null, C.autoSummarySilent);
                                            }
                                        } else {
                                            console.log(`🚫 [自动总结] 用户取消`);
                                        }
                                    });
                                } else {
                                    // 静默模式（勾选时）：直接执行
                                    window.Gaigai.SummaryManager.callAIForSummary(null, targetEndIndex, null, C.autoSummarySilent);
                                }
                            }
                        }
                    }

                    setTimeout(hideMemoryTags, 100);
                    setTimeout(applyUiFold, 200);

                    // ✨✨✨【UI 自动刷新】✨✨✨
                    // 如果表格窗口正开着，就刷新当前选中的那个表，让你立刻看到变化
                    if ($('#g-pop').length > 0) {
                        const activeTab = $('.g-t.act').data('i');
                        if (activeTab !== undefined) {
                            refreshTable(activeTab);
                            console.log(`🔄 [UI] 表格视图已自动刷新`);
                        }
                    }

                } catch (e) {
                    console.error('❌ omsg 执行错误:', e);
                } finally {
                    delete pendingTimers[msgKey];
                }
            }, 1000); // 延迟 1秒 (可根据流式传输速度调整为500-2000ms)

        } catch (e) {
            console.error('❌ omsg 错误:', e);
        }
    }

    /**
     * 自动追溯填表核心函数 (已修复：非静默模式下等待弹窗返回)
     * @param {number} start - 起始楼层索引
     * @param {number} end - 结束楼层索引
     * @param {boolean} isManual - 是否为手动触发
     */

    // ✅✅✅ [修正版] 聊天切换/初始化函数
    // ============================================================
    // 1. 聊天状态变更监听 (修复删楼后的快照链断裂)
    // ============================================================
    async function ochat() {
        // 🔒 性能优化：加锁，防止切换期间误操作
        isChatSwitching = true;
        // 🧹 [清理] 切换会话时，清除所有挂起的写入任务
        Object.keys(pendingTimers).forEach(key => {
            clearTimeout(pendingTimers[key]);
            delete pendingTimers[key];
        });
        console.log('🔒 [ochat] 会话切换锁已启用');

        // ✨✨✨ [防串味补丁] 切换会话时，彻底重置世界书同步缓存 ✨✨✨
        if (typeof globalWorldInfoEntriesCache !== 'undefined') {
            globalWorldInfoEntriesCache = {}; // 清空条目缓存
            globalLastWorldInfoUid = -1;      // 重置 UID 计数器
            worldInfoSyncQueue = Promise.resolve(); // 重置队列

            // 清理防抖计时器
            if (syncDebounceTimer) {
                clearTimeout(syncDebounceTimer);
                syncDebounceTimer = null;
            }

            console.log('🧹 [ochat] 已重置世界书同步缓存，防止跨会话污染');
        }

        // 🛑 FIX: Must await global config BEFORE loading chat specific config
        // This prevents race condition where loadConfig() overwrites chat-specific toggles
        try {
            await loadConfig();
            console.log('✅ [ochat] 全局配置已加载完成');
        } catch (e) {
            console.warn('⚠️ [Config] Pre-load failed:', e);
        }

        // 1. 🔐【关键修改】在切换前，将当前内存里的快照"归档"到旧会话的仓库中
        // m.id 此时还是旧会话的 ID
        if (m.id) {
            window.GaigaiSnapshotStore[m.id] = snapshotHistory;
            console.log(`💾 [ochat] 已暂存会话 [${m.id}] 的快照记录`);
        }

        // 2. 加载新会话数据 (这会更新 m.id)
        // NOW it is safe to load chat specific data (overriding globals)
        m.load();
        thm();

        // 重置楼层折叠状态
        window.Gaigai.foldOffset = 0;

        // 重置临时状态
        window.Gaigai.lastRequestData = null;
        lastInternalSaveTime = 0;
        lastProcessedMsgIndex = -1;
        isRegenerating = false;
        deletedMsgIndex = -1;
        processedMessages.clear();

        // 3. 🔐【关键修改】从仓库中"取出"新会话的快照 (如果之前存过)
        // 此时 m.id 已经是新会话的 ID 了
        if (m.id && window.GaigaiSnapshotStore[m.id]) {
            snapshotHistory = window.GaigaiSnapshotStore[m.id];
            console.log(`📂 [ochat] 已恢复会话 [${m.id}] 的独立快照记录`);
        } else {
            // 如果是第一次进入这个会话，初始化为空对象
            snapshotHistory = {};
            console.log(`🆕 [ochat] 会话 [${m.id}] 首次加载，初始化空快照`);
        }

        // 🧹 性能优化：只保留最近 50 条快照，释放内存
        const allKeys = Object.keys(snapshotHistory).map(Number).filter(k => !isNaN(k)).sort((a, b) => a - b);
        if (allKeys.length > 50) {
            const cutoff = allKeys[allKeys.length - 50];
            allKeys.forEach(k => {
                if (k < cutoff && k !== -1) {
                    delete snapshotHistory[k.toString()]; // -1是创世快照，保留
                }
            });
            console.log(`🧹 [性能优化] 已清理旧快照，保留最近 50 条 + 创世快照(-1)`);
        }

        // 4. 确保 -1 号创世快照存在 (兜底)
        if (!snapshotHistory['-1']) {
            snapshotHistory['-1'] = {
                data: m.all().slice(0, 8).map(sh => {
                    let copy = JSON.parse(JSON.stringify(sh.json()));
                    copy.r = [];
                    return copy;
                }),
                summarized: {},
                timestamp: 0
            };
            console.log(`🎬 [ochat] 已创建会话 [${m.id}] 的创世快照 [-1]`);
        }

        const ctx = m.ctx();
        const currentLen = ctx && ctx.chat ? ctx.chat.length : 0;

        console.log(`📂 [ochat] 检测到聊天变更 (当前楼层: ${currentLen})`);

        // 5. ⚡ [关键逻辑] 当楼层变化时(如删消息)，立即为当前的"最后一条消息"建立快照。
        // 这代表了"在该楼层结束时，表格的最终状态" (包含了用户的手动修改/全清)。
        // 这样下次重Roll后续楼层时，就能正确回滚到这个状态。
        if (currentLen > 0) {
            const lastIdx = currentLen - 1;
            const lastKey = lastIdx.toString();

            // 📸 立即保存当前表格状态为最新快照
            saveSnapshot(lastKey);
            console.log(`💾 [ochat] 已同步当前表格状态至快照 [${lastKey}]`);
        }

        setTimeout(hideMemoryTags, 500);
        setTimeout(applyUiFold, 600);

        // 🔓 性能优化：解锁，允许用户操作
        setTimeout(() => {
            isChatSwitching = false;
            console.log('🔓 [ochat] 会话切换锁已解除');
        }, 800); // 延迟解锁，确保所有初始化完成
    }

    // ✨✨✨ 核心逻辑：智能切分法 (防呆增强版) ✨✨✨
    function applyContextLimit(chat) {
        // 1. 安全检查：如果参数不对，或者没开开关，直接原样返回
        // 强制把 limit 转为数字，防止它是字符串导致计算错误
        const limit = parseInt(C.contextLimitCount) || 30;

        if (!C.contextLimit || !chat || chat.length <= limit) return chat;

        console.log(`✂️ [隐藏楼层] 开始计算: 当前总楼层 ${chat.length}, 限制保留 ${limit} 层`);

        // 2. 统计需要保留的“非系统消息”数量
        // 我们只切 User 和 Assistant 的水楼，绝不切 System (人设/世界书)
        let dialogueMsgIndices = [];
        chat.forEach((msg, index) => {
            if (msg.role !== 'system') {
                dialogueMsgIndices.push(index);
            }
        });

        // 3. 计算需要切掉多少条
        const totalDialogue = dialogueMsgIndices.length;
        const toKeep = limit;
        const toSkip = Math.max(0, totalDialogue - toKeep);

        if (toSkip === 0) return chat;

        // 4. 确定哪些索引(Index)是“老旧消息”，需要被切掉
        // slice(0, toSkip) 拿到的就是“最前面”的几条旧对话的索引
        const indicesToRemove = new Set(dialogueMsgIndices.slice(0, toSkip));

        // 🛑【三重保险】绝对保护最后 2 条消息，无论算法怎么算，最后2条打死不能切！
        // 防止因为计算误差导致AI看不到你刚才发的那句话
        const lastIndex = chat.length - 1;
        if (indicesToRemove.has(lastIndex)) indicesToRemove.delete(lastIndex);
        if (indicesToRemove.has(lastIndex - 1)) indicesToRemove.delete(lastIndex - 1);

        console.log(`   - 计划切除 ${indicesToRemove.size} 条旧对话，保留最近 ${toKeep} 条`);

        // 5. 生成新数组
        const newChat = chat.filter((msg, index) => {
            // 如果这个索引在“移除名单”里，就不要了
            if (indicesToRemove.has(index)) {
                return false;
            }
            // 其他的（System消息 + 最近的对话）全部保留
            return true;
        });

        console.log(`   - 清洗完毕，剩余 ${newChat.length} 条消息发送给AI`);
        return newChat;
    }

    // ============================================================
    // 2. 生成前预处理 (修复重Roll时的回档逻辑)
    // ============================================================
    function opmt(ev) {
        try {
            const data = ev.detail || ev;
            if (!data) return;
            if (data.dryRun || data.isDryRun || data.quiet || data.bg || data.no_update) return;
            if (isSummarizing) return;

            // 1. 使用全局索引计算 (解决 Prompt 截断导致找不到快照的问题)
            const globalCtx = m.ctx();
            const globalChat = globalCtx ? globalCtx.chat : null;

            if (C.enabled && globalChat && globalChat.length > 0) {
                let targetIndex = globalChat.length;
                const lastMsg = globalChat[globalChat.length - 1];

                // 判断是 新生成 还是 重Roll
                if (lastMsg && !lastMsg.is_user) {
                    targetIndex = globalChat.length - 1; // 重Roll当前最后一条 AI 消息
                    console.log(`♻️ [opmt] 检测到重Roll (目标层: ${targetIndex})`);
                } else {
                    console.log(`🆕 [opmt] 检测到新消息 (目标层: ${targetIndex})`);
                }

                const targetKey = targetIndex.toString();

                // 2. 🔍 寻找基准快照 (上一楼的状态)
                let baseIndex = targetIndex - 1;
                let baseKey = null;

                while (baseIndex >= -1) {
                    const key = baseIndex.toString();
                    if (snapshotHistory[key]) {
                        baseKey = key;
                        break;
                    }
                    baseIndex--;
                }

                // 3. ⏪ [核心步骤] 发送请求前，强制回滚表格！
                if (baseKey) {
                    restoreSnapshot(baseKey);
                    console.log(`↺ [opmt] 成功回档: 表格已恢复至基准 [${baseKey}]`);
                } else if (baseIndex === -1 && snapshotHistory['-1']) {
                    restoreSnapshot('-1');
                    console.log(`↺ [opmt] 成功回档: 表格已恢复至创世状态`);
                } else {
                    // ⚠️ 如果实在找不到存档，为了防止脏数据污染 Prompt，这里选择不做操作(保持现状)或清空
                    // 根据用户要求：保持现状可能导致AI不输出标签，但清空可能丢失手动数据。
                    // 由于 ochat 修复了快照链，理论上这里一定能找到 baseKey。
                    console.warn(`⚠️ [opmt] 警告: 未找到基准快照，将发送当前表格。`);
                }

                // 4. 🗑️ 销毁脏快照 (当前正在生成的这一楼的旧存档)
                if (snapshotHistory[targetKey]) {
                    delete snapshotHistory[targetKey];
                    console.log(`🗑️ [opmt] 已销毁旧的 [${targetKey}] 楼快照`);
                }

                if (pendingTimers[targetKey]) {
                    clearTimeout(pendingTimers[targetKey]);
                    delete pendingTimers[targetKey];
                }
            }

            isRegenerating = false;

            // 5. 隐藏楼层逻辑 (保持不变)
            let currentChat = data.chat;
            if (C.contextLimit && currentChat) {
                const limitedChat = applyContextLimit(currentChat);
                if (limitedChat.length !== currentChat.length) {
                    data.chat.splice(0, data.chat.length, ...limitedChat);
                    console.log(`✂️ 隐藏楼层已执行`);
                }
            }

            // 6. 注入 (此时表格已是回档后的干净状态)
            inj(ev);

            // 探针
            window.Gaigai.lastRequestData = {
                chat: JSON.parse(JSON.stringify(data.chat)),
                timestamp: Date.now(),
                model: API_CONFIG.model || 'Unknown'
            };

        } catch (e) {
            console.error('❌ opmt 错误:', e);
        }
    }

    // ✨✨✨ UI 折叠逻辑 (v5.1 修复版：嵌入式布局) ✨✨✨
    function applyUiFold() {
        const $chat = $('#chat');
        // 获取真实消息总数（排除隐藏标签）
        const total = $chat.find('.mes').length;
        // 获取用户设置的保留条数
        const keep = C.uiFoldCount || 50;
        // 每次多看几条
        const STEP = 10;

        // 初始化状态变量（如果不存在）
        if (typeof window.Gaigai.foldOffset === 'undefined') window.Gaigai.foldOffset = 0;
        if (typeof window.Gaigai.lastHideCount === 'undefined') window.Gaigai.lastHideCount = -1;

        // ✅ Clean Disable: If feature is OFF, clean up and exit
        if (!C.uiFold || total <= keep) {
            // Only clean up if we previously had the feature enabled
            if (window.Gaigai.lastHideCount !== -1) {
                $('#gaigai-fold-style').remove();
                $('#g-fold-controls').remove();
                window.Gaigai.lastHideCount = -1;
                window.Gaigai.foldOffset = 0;
                console.log('🧹 [Fold] Feature disabled, cleaned up DOM');
            }
            return;
        }

        // 计算需要隐藏的数量
        let hideCount = total - keep - window.Gaigai.foldOffset;
        if (hideCount < 0) hideCount = 0;

        // ✅ Early Exit: If state hasn't changed AND DOM exists, do nothing
        const $existingStyle = $('#gaigai-fold-style');
        const $existingControls = $('#g-fold-controls');

        if (hideCount === window.Gaigai.lastHideCount &&
            $existingStyle.length > 0 &&
            $existingControls.length > 0) {
            console.log(`⏭️ [Fold] State unchanged (hiding ${hideCount}), skipping DOM update`);
            return;
        }

        console.log(`🔄 [Fold] State changed: ${window.Gaigai.lastHideCount} → ${hideCount}, updating DOM`);

        // ✅ Graceful Update: Update existing style tag content
        const css = `
            /* 隐藏前 N 条消息 */
            #chat > .mes:nth-child(-n+${hideCount}) {
                display: ${hideCount > 0 ? 'none' : 'block'} !important;
            }
            /* 嵌入式控制条样式 (修复版) */
            #g-fold-controls {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
                padding: 10px 0;
                margin-bottom: 10px; /* 与下方消息拉开距离 */
                background: transparent;
            }
            .g-fold-btn {
                padding: 6px 16px; border-radius: 20px;
                background: rgba(0,0,0,0.6); color: #fff; cursor: pointer;
                font-size: 12px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.2);
                transition: all 0.2s; user-select: none; display: flex; align-items: center; gap: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .g-fold-btn:hover { background: rgba(0,0,0,0.8); transform: scale(1.05); }
            .g-fold-btn i { font-size: 14px; }
        `;

        if ($existingStyle.length > 0) {
            // Update existing style tag
            $existingStyle.text(css);
        } else {
            // Create new style tag
            $('<style id="gaigai-fold-style">').text(css).appendTo('head');
        }

        // ✅ Graceful Update: Update control buttons content
        let controlsHTML = '';

        // 按钮A: 再看10条
        if (hideCount > 0) {
            controlsHTML += `<div class="g-fold-btn" data-action="load-more" title="上方还有 ${hideCount} 条被折叠">
                <i class="fa-solid fa-clock-rotate-left"></i> 展开 ${STEP} 条 (剩余 ${hideCount})
            </div>`;
        }

        // 按钮B: 恢复折叠
        if (window.Gaigai.foldOffset > 0) {
            controlsHTML += `<div class="g-fold-btn" data-action="reset">
                <i class="fa-solid fa-compress"></i> 收起折叠
            </div>`;
        }

        if ($existingControls.length > 0) {
            // Update existing controls
            if (controlsHTML) {
                $existingControls.html(controlsHTML);

                // Re-bind event handlers (since we replaced HTML)
                $existingControls.find('[data-action="load-more"]').on('click', () => {
                    window.Gaigai.foldOffset += STEP;
                    applyUiFold();
                });

                $existingControls.find('[data-action="reset"]').on('click', () => {
                    window.Gaigai.foldOffset = 0;
                    applyUiFold();
                });
            } else {
                // No buttons needed, remove controls
                $existingControls.remove();
            }
        } else {
            // Create new controls if needed
            if (controlsHTML) {
                const $ctrlDiv = $('<div>', {
                    id: 'g-fold-controls',
                    html: controlsHTML
                });

                // Bind event handlers
                $ctrlDiv.find('[data-action="load-more"]').on('click', () => {
                    window.Gaigai.foldOffset += STEP;
                    applyUiFold();
                });

                $ctrlDiv.find('[data-action="reset"]').on('click', () => {
                    window.Gaigai.foldOffset = 0;
                    applyUiFold();
                });

                // ✨ 关键修复：插入到 #chat 容器的最前面
                $chat.prepend($ctrlDiv);
            }
        }

        // ✅ Update state tracker
        window.Gaigai.lastHideCount = hideCount;
    }

    // ========================================================================
    // ========== 初始化和事件监听 ==========
    // ========================================================================

    /**
     * 插件初始化函数
     * 等待依赖加载完成后，创建UI按钮，注册事件监听，启动插件
     */
    async function ini() {
        // 1. 基础依赖检查
        if (typeof $ === 'undefined' || typeof SillyTavern === 'undefined') {
            console.log('⏳ 等待依赖加载...');
            setTimeout(ini, 500);
            return;
        }

        // ✨✨✨ 核心修改：精准定位顶部工具栏 ✨✨✨
        // 策略：找到"高级格式化(A)"按钮或者"AI配置"按钮，把我们的按钮插在它们后面
        let $anchor = $('#advanced-formatting-button');
        if ($anchor.length === 0) $anchor = $('#ai-config-button');

        // 如果还是找不到（极少数情况），回退到找扩展菜单
        if ($anchor.length === 0) $anchor = $('#extensionsMenu');

        console.log('✅ 工具栏定位点已找到:', $anchor.attr('id'));

        // --- 加载设置 (异步加载配置以支持服务端同步) ---
        try { const sv = localStorage.getItem(UK); if (sv) UI = { ...UI, ...JSON.parse(sv) }; } catch (e) { }
        await loadConfig(); // 🌐 异步加载配置，支持服务端同步

        // ⚠️ PROMPTS 的加载和管理已移至 prompt_manager.js
        // prompt_manager.js 会在自己加载时自动调用 initProfiles() 进行数据迁移

        // loadColWidths(); // ❌ 已废弃：不再从全局加载，列宽/行高通过 m.load() 从会话存档加载
        // loadSummarizedRows(); // ❌ 已废弃：不再从全局加载，改为通过 m.load() 从角色专属存档加载
        m.load();
        thm();

        // ✨✨✨ 核心修复：创建“创世快照”(-1号)，代表对话开始前的空状态 ✨✨✨
        snapshotHistory['-1'] = {
            data: m.all().slice(0, 8).map(sh => JSON.parse(JSON.stringify(sh.json()))),
            summarized: JSON.parse(JSON.stringify(summarizedRows)),
            timestamp: 0 // 时间戳设为0，确保它比任何手动编辑都早
        };
        console.log("📸 [创世快照] 已创建初始空状态快照 '-1'。");

        // ✨✨✨ 修改重点：创建完美融入顶部栏的按钮 ✨✨✨
        $('#gaigai-wrapper').remove(); // 移除旧按钮防止重复

        // 1. 创建容器 (模仿酒馆的 drawer 结构，这样间距和高度会自动对齐)
        const $wrapper = $('<div>', {
            id: 'gaigai-wrapper',
            class: 'drawer' // 关键：使用 drawer 类名，骗过 CSS 让它认为这是原生按钮
        });

        // 2. 创建对齐容器
        const $toggle = $('<div>', { class: 'drawer-toggle' });

        // 3. 创建图标 (模仿原生图标样式)
        const $icon = $('<div>', {
            id: 'gaigai-top-btn',
            // 关键：使用 drawer-icon 类名，这样大小、颜色、鼠标悬停效果就和旁边的“A”图标一模一样了
            // ✨✨✨ 修复：添加 closedIcon 类，让它在未激活时保持半透明(变暗)，和其他图标一致
            class: 'drawer-icon fa-solid fa-table fa-fw interactable closedIcon', 
            title: '记忆表格',
            tabindex: '0'
        }).on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            shw(); // 点击打开表格
        });

        // 4. 组装
        $toggle.append($icon);
        $wrapper.append($toggle);

        // 5. 插入到定位点后面 (即"A"图标或者"AI配置"图标的右边)
        if ($anchor.length > 0) {
            $anchor.after($wrapper);
            console.log('✅ 按钮已成功插入到顶部工具栏');
        } else {
            console.warn('⚠️ 未找到工具栏定位点，尝试追加到 body');
            $('body').append($wrapper);
        }
        // ✨✨✨ 修改结束 ✨✨✨

        // ===== SillyTavern 事件监听注册 =====
        // 监听消息生成、对话切换、提示词准备等核心事件
        const x = m.ctx();
        if (x && x.eventSource) {
            try {
                // 监听AI消息生成完成事件（用于解析Memory标签）
                x.eventSource.on(x.event_types.CHARACTER_MESSAGE_RENDERED, function (id) { omsg(id); });

                // 监听对话切换事件（用于刷新数据和UI）
                x.eventSource.on(x.event_types.CHAT_CHANGED, function () { ochat(); });

                // 监听提示词准备事件（用于注入记忆表格）
                x.eventSource.on(x.event_types.CHAT_COMPLETION_PROMPT_READY, function (ev) { opmt(ev); });

                // 监听 Swipe 事件 (切换回复)
                x.eventSource.on(x.event_types.MESSAGE_SWIPED, function (id) {
                    console.log(`↔️ [Swipe触发] 第 ${id} 楼正在切换分支...`);

                    const key = id.toString();

                    // 1. 🛑 [第一步：立即刹车] 清除该楼层正在进行的任何写入计划
                    if (pendingTimers[key]) {
                        clearTimeout(pendingTimers[key]);
                        delete pendingTimers[key];
                        console.log(`🛑 [Swipe] 已终止第 ${id} 楼的挂起任务`);
                    }

                    // 2. ⏪ [第二步：时光倒流] 强制回滚到上一楼的状态
                    // 无论之前表格里是什么，必须先回到这一楼还没发生时的样子！
                    const prevKey = (id - 1).toString();
                    if (snapshotHistory[prevKey]) {
                        restoreSnapshot(prevKey);
                        console.log(`↺ [Swipe] 成功回档至基准线: 快照 [${prevKey}]`);
                    } else if (id === 0) {
                        restoreSnapshot('-1'); // 第0楼回滚到创世快照
                        console.log(`↺ [Swipe] 第0楼回档至创世快照`);
                    } else {
                        console.warn(`⚠️ [Swipe] 警告: 找不到上一楼的快照，无法回滚！`);
                    }

                    // 3. 🗑️ [第三步：清理现场] 销毁当前楼层的旧快照
                    // 因为这个快照属于"上一个分支"，现在已经作废了
                    if (snapshotHistory[key]) {
                        delete snapshotHistory[key];
                        console.log(`🗑️ [Swipe] 已销毁第 ${id} 楼的旧分支快照`);
                    }

                    // 4. ▶️ [第四步：重新开始] 触发读取逻辑
                    // 此时表格已经是干净的上一楼状态，omsg 会把当前显示的新分支当作"新消息"写入
                    setTimeout(() => {
                        console.log(`▶️ [Swipe] 开始读取新分支内容...`);
                        omsg(id);
                    }, 50);
                });

                // 🗑️ [已删除] 自动回档监听器 (MESSAGE_DELETED) 已移除，防止重Roll时数据错乱。

            } catch (e) {
                console.error('❌ 事件监听注册失败:', e);
            }
        }

        setTimeout(hideMemoryTags, 1000);
        console.log('✅ 记忆表格 v' + V + ' 已就绪');

        // ✨ 3秒冷却期后解除初始化冷却，允许自动任务触发
        setTimeout(() => {
            isInitCooling = false;
            console.log('✅ 初始化冷却期结束，自动任务已启用');
        }, 3000);
    } // <--- 这里是 ini 函数的结束大括号

    // ===== 初始化重试机制 =====
    let initRetryCount = 0;
    const maxRetries = 20; // 最多重试20次（10秒）

    /**
     * 初始化重试函数
     * 如果SillyTavern未加载完成，每500ms重试一次
     */
    function tryInit() {
        initRetryCount++;
        if (initRetryCount > maxRetries) {
            console.error('❌ 记忆表格初始化失败：超过最大重试次数');
            return;
        }
        ini();
    }

    // ========================================================================
    // ========== 插件启动入口 (动态加载依赖) ==========
    // ========================================================================

    // 🔧 自动获取 index.js 所在的目录路径（解决文件夹名称不匹配问题）
    function getExtensionPath() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute('src');
        // 只要路径以 /ST-Memory-Context/index.js 结尾，就提取其目录
        if (src && src.includes('ST-Memory-Context/index.js')) {
            return src.replace('/index.js', '');
        }
    }
    // 如果还没找到，尝试更宽泛的匹配（匹配当前文件名）
    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute('src');
        if (src && src.endsWith('index.js') && src.includes('extensions')) {
             return src.replace('/index.js', '');
        }
    }
    // 最后的兜底
    return 'scripts/extensions/third-party/ST-Memory-Context';
}

const EXTENSION_PATH = getExtensionPath();
console.log('📍 [Gaigai] 动态定位插件路径:', EXTENSION_PATH);

    function loadDependencies() {
        // 确保全局对象存在
        window.Gaigai = window.Gaigai || {};

        // 动态加载 prompt_manager.js
        const promptManagerUrl = `${EXTENSION_PATH}/prompt_manager.js`;
        $.getScript(promptManagerUrl)
            .done(function () {
                console.log('✅ [Loader] prompt_manager.js 加载成功');

                // 🆕 加载 backfill_manager.js
                const backfillManagerUrl = `${EXTENSION_PATH}/backfill_manager.js`;
                $.getScript(backfillManagerUrl)
                    .done(function () {
                        console.log('✅ [Loader] backfill_manager.js 加载成功');

                        // 🆕 加载 summary_manager.js
                        const summaryManagerUrl = `${EXTENSION_PATH}/summary_manager.js`;
                        $.getScript(summaryManagerUrl)
                            .done(function () {
                                console.log('✅ [Loader] summary_manager.js 加载成功');

                                // ✨ 验证模块是否成功挂载
                                if (!window.Gaigai.SummaryManager) {
                                    console.error('⚠️ [Loader] window.Gaigai.SummaryManager 未成功挂载！');
                                    console.error(`📍 尝试加载的 URL: ${summaryManagerUrl}`);
                                }
                                if (!window.Gaigai.BackfillManager) {
                                    console.error('⚠️ [Loader] window.Gaigai.BackfillManager 未成功挂载！');
                                    console.error(`📍 尝试加载的 URL: ${backfillManagerUrl}`);
                                }

                                // 所有依赖加载完后，再启动主初始化流程
                                setTimeout(tryInit, 500);
                            })
                            .fail(function (jqxhr, settings, exception) {
                                console.error('❌ [Loader] summary_manager.js 加载失败！');
                                console.error(`📍 尝试加载的 URL: ${summaryManagerUrl}`);
                                console.error(`📍 HTTP 状态码: ${jqxhr.status}`);
                                console.error(`📍 错误详情:`, exception);
                                console.error(`💡 提示：请检查文件是否存在，或控制台 Network 面板查看具体错误`);
                                // 即使加载失败，也继续初始化（降级模式）
                                setTimeout(tryInit, 500);
                            });
                    })
                    .fail(function (jqxhr, settings, exception) {
                        console.error('❌ [Loader] backfill_manager.js 加载失败！');
                        console.error(`📍 尝试加载的 URL: ${backfillManagerUrl}`);
                        console.error(`📍 HTTP 状态码: ${jqxhr.status}`);
                        console.error(`📍 错误详情:`, exception);
                        console.error(`💡 提示：请检查文件是否存在，或控制台 Network 面板查看具体错误`);
                        // 即使加载失败，也继续初始化（降级模式）
                        setTimeout(tryInit, 500);
                    });
            })
            .fail(function (jqxhr, settings, exception) {
                console.error('❌ [Loader] prompt_manager.js 加载失败！请检查文件夹名称是否为 ST-Memory-Context');
                console.error(`📍 尝试加载的 URL: ${promptManagerUrl}`);
                console.error(`📍 HTTP 状态码: ${jqxhr.status}`);
                console.error(`📍 错误详情:`, exception);
                console.error(`💡 提示：请检查 EXTENSION_PATH 是否正确，当前值为: ${EXTENSION_PATH}`);
                // 尝试备用路径（兼容某些改了文件夹名的用户）
                // 如果你的文件夹名字不是这个，请修改 EXTENSION_PATH 变量
            });
    }

    // 启动加载器
    loadDependencies();

    // ✅✅✅ 直接把核心变量挂到 window.Gaigai 上
    window.Gaigai = {
        v: V,
        m: m,
        shw: shw,
        shcf: shcf,  // ✅ 新增：暴露配置函数
        ui: UI,
        config_obj: C,
        esc: esc,
        unesc: unesc,   // ✅ 新增：暴露反转义函数给子模块使用
        pop: pop,
        customAlert: customAlert,
        customConfirm: customConfirm,  // ✨ 供 prompt_manager.js 使用
        cleanMemoryTags: cleanMemoryTags,
        MEMORY_TAG_REGEX: MEMORY_TAG_REGEX,
        config: API_CONFIG,
        saveAllSettingsToCloud: saveAllSettingsToCloud,  // ✨ 供 prompt_manager.js 使用
        navTo: navTo,   // ✅ 新增：暴露跳转函数
        goBack: goBack  // ✅ 新增：暴露返回函数
    };

    // ✅ 使用 Object.defineProperty 创建引用（实现双向同步）
    Object.defineProperty(window.Gaigai, 'snapshotHistory', {
        get() { return snapshotHistory; },
        set(val) { snapshotHistory = val; }
    });

    Object.defineProperty(window.Gaigai, 'isRegenerating', {
        get() { return isRegenerating; },
        set(val) { isRegenerating = val; }
    });

    Object.defineProperty(window.Gaigai, 'deletedMsgIndex', {
        get() { return deletedMsgIndex; },
        set(val) { deletedMsgIndex = val; }
    });

    // 🛡️ [关键同步] 暴露 lastManualEditTime，并同步 window.lastManualEditTime
    // 防止 backfill_manager.js 更新 window.lastManualEditTime 后，index.js 内部变量未同步
    Object.defineProperty(window.Gaigai, 'lastManualEditTime', {
        get() {
            // 优先读取 window.lastManualEditTime（可能被外部模块更新）
            return window.lastManualEditTime || lastManualEditTime;
        },
        set(val) {
            lastManualEditTime = val;
            window.lastManualEditTime = val; // 同步到 window
        }
    });

    // ✅ 工具函数直接暴露
    window.Gaigai.saveSnapshot = saveSnapshot;
    window.Gaigai.restoreSnapshot = restoreSnapshot;
    console.log('✅ window.Gaigai 已挂载', window.Gaigai);

    // === 🔌 公开核心工具供子模块使用 ===
    window.callIndependentAPI = callIndependentAPI;
    window.callTavernAPI = callTavernAPI;
    window.prs = prs;
    window.exe = exe;
    window.unesc = unesc; // ✅ 反转义函数，供 backfill_manager.js 和 summary_manager.js 使用
    window.markAsSummarized = markAsSummarized; // 总结模块需要这个
    window.updateCurrentSnapshot = updateCurrentSnapshot;
    window.refreshTable = refreshTable;
    window.updateTabCount = updateTabCount;
    window.syncToWorldInfo = syncToWorldInfo; // 总结模块需要同步到世界书
    window.customRetryAlert = customRetryAlert; // 重试弹窗
    // 同时也挂载到 Gaigai 对象上以备不时之需
    window.Gaigai.tools = { callIndependentAPI, callTavernAPI, prs, exe, filterContentByTags }; // ✅ 添加 filterContentByTags
    console.log('✅ [核心工具] 已公开给子模块使用');

    // ✨✨✨ 重写：关于页 & 更新检查 & 首次弹窗 (颜色修复版) ✨✨✨
    function showAbout(isAutoPopup = false) {
        const cleanVer = V.replace(/^v+/i, '');
        const repoUrl = `https://github.com/${REPO_PATH}`;

        // 检查是否已经勾选过“不再显示”
        const isChecked = localStorage.getItem('gg_notice_ver') === V;

        // 统一使用 #333 作为文字颜色，确保在白色磨砂背景上清晰可见
        const textColor = '#333333';

        const h = `
        <div class="g-p" style="display:flex; flex-direction:column; gap:12px; height:100%;">
            <!-- 头部版本信息 -->
            <div style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.3); border-radius:8px; padding:12px; text-align:center; flex-shrink:0;">
                <div style="font-size:18px; font-weight:bold; margin-bottom:5px; color:${textColor};">
                    📘 记忆表格 (Memory Context)
                </div>
                <div style="font-size:12px; opacity:0.8; margin-bottom:8px; color:${textColor};">当前版本: v${cleanVer}</div>
                <div id="update-status" style="background:rgba(0,0,0,0.05); padding:6px; border-radius:4px; font-size:11px; display:flex; align-items:center; justify-content:center; gap:8px; color:${textColor};">
                    ⏳ 正在连接 GitHub 检查更新...
                </div>
            </div>

            <div style="flex:1; overflow-y:auto; background:rgba(255,255,255,0.4); border-radius:8px; padding:15px; font-size:13px; line-height:1.6; border:1px solid rgba(255,255,255,0.3);">

                <!--⚠️ 备份警告 -->
                <div style="background:rgba(255, 165, 0, 0.1); border:1px solid rgba(255, 140, 0, 0.3); border-radius:6px; padding:8px; margin-bottom:15px; color:#d35400; font-size:11px; display:flex; align-items:center; gap:6px;">
                    ⚠️
                    <strong>安全提醒：</strong>更新插件前，请点击【📥 导出】备份数据！
                </div>

                <!-- ✅ 第一部分：本次更新日志 (高亮显示) -->
                <div style="margin-bottom:20px; border-bottom:1px dashed rgba(0,0,0,0.1); padding-bottom:15px;">
                    <h4 style="margin-top:0; margin-bottom:10px; color:${textColor}; display:flex; align-items:center; gap:6px;">
                        📢 本次更新内容 (v${cleanVer})
                    </h4>
                    <ul style="margin:0; padding-left:20px; font-size:12px; color:${textColor}; opacity:0.9;">
                        <li><strong> 增加总结的目录功能：</strong>新增总结表单的目录功能</li>
                        <li><strong> 重绘复选框：</strong>优化复选框或单选在某些主题不适配的情况</li>
                        <li><strong> 优化追溯功能：</strong>总结功能及追溯填表的优化功能</li>
                        <li><strong> 优化提示词：</strong>优化部分提示词，将总结提示词内对世界设定去除，统一由世界设定表单进行记录</li>
                    </ul>
                </div>

                <!-- 📘 第二部分：功能指南 -->
                <div>
                    <h4 style="margin-top:0; margin-bottom:10px; color:${textColor}; opacity:0.9;">
                        📘 功能介绍 & 新手引导
                    </h4>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                        <div style="background:rgba(255,255,255,0.3); padding:10px; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                            <div style="font-weight:bold; margin-bottom:4px; color:${textColor}; font-size:12px;">📊 填表模式 (二选一)</div>
                            <div style="font-size:11px; color:${textColor}; opacity:0.8;">
                                • <strong>实时填表：</strong> 每回合都写。优点是实时性强，缺点是费钱/慢。<br>
                                • <strong>批量填表：</strong> 每N楼写一次。优点是省Token、速度快。<br>
                                <span style="opacity:0.6; font-size:10px;">(推荐开启批量填表 + 独立API)</span>
                            </div>
                        </div>
                        <div style="background:rgba(255,255,255,0.3); padding:10px; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                            <div style="font-weight:bold; margin-bottom:4px; color:${textColor}; font-size:12px;">📝 总结模式</div>
                            <div style="font-size:11px; color:${textColor}; opacity:0.8;">
                                • <strong>表格源：</strong> 读取表格里的数据生成总结。<br>
                                • <strong>聊天源：</strong> 读取聊天记录生成总结。<br>
                                <span style="opacity:0.6; font-size:10px;">(可在配置中切换总结来源)</span>
                            </div>
                        </div>
                    </div>

                    <div style="background:rgba(76, 175, 80, 0.1); border:1px solid rgba(76, 175, 80, 0.3); padding:10px; border-radius:6px;">
                        <div style="font-weight:bold; color:#2e7d32; margin-bottom:4px; font-size:12px;">💡 新手/旧卡 推荐流程</div>
                        <ol style="margin:0; padding-left:15px; font-size:11px; color:#2e7d32;">
                            <li>点击 <strong>【⚡ 追溯】</strong> 按钮，进行一次全量或分批填表，补全历史数据。</li>
                            <li>前往 <strong>【⚙️ 配置】</strong>，开启 <strong>[批量填表]</strong> 和 <strong>[自动总结]</strong>。</li>
                            <li>享受全自动托管，AI 会自动维护记忆。</li>
                        </ol>
                    </div>
                </div>

                <div style="margin-top:15px; font-size:11px; text-align:center; opacity:0.7;">
                    <a href="${repoUrl}" target="_blank" style="text-decoration:none; color:${textColor}; border-bottom:1px dashed ${textColor};">
                       🔗 GitHub 项目主页
                    </a>
                </div>
            </div>

            <div style="padding-top:5px; border-top:1px solid rgba(255,255,255,0.2); text-align:right; flex-shrink:0;">
                <label style="font-size:12px; cursor:pointer; user-select:none; display:inline-flex; align-items:center; gap:6px; color:${textColor}; opacity:0.9;">
                    <input type="checkbox" id="dont-show-again" ${isChecked ? 'checked' : ''}>
                    不再自动弹出 v${cleanVer} 说明
                </label>
            </div>
        </div>`;

        $('#g-about-pop').remove();
        const $o = $('<div>', { id: 'g-about-pop', class: 'g-ov', css: { 'z-index': '10000002' } });
        const $p = $('<div>', { class: 'g-w', css: { width: '500px', maxWidth: '90vw', height: '650px', maxHeight: '85vh' } });
        const $hd = $('<div>', { class: 'g-hd' });

        const titleText = isAutoPopup ? '🎉 欢迎使用新版本' : '关于 & 指南';
        $hd.append(`<h3 style="color:${UI.tc}; flex:1;">${titleText}</h3>`);
        const $x = $('<button>', { class: 'g-x', text: '×', css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' } }).on('click', () => $o.remove());
        $hd.append($x);

        const $bd = $('<div>', { class: 'g-bd', html: h });
        $p.append($hd, $bd);
        $o.append($p);
        $('body').append($o);

        setTimeout(() => {
            $('#dont-show-again').on('change', function () {
                if ($(this).is(':checked')) {
                    localStorage.setItem('gg_notice_ver', V);
                } else {
                    localStorage.removeItem('gg_notice_ver');
                }
            });
            checkForUpdates(cleanVer);

            // ✅ [修复] 使用事件委托绑定更新按钮 (解决异步加载导致无法点击的问题)
            $(document).off('click', '#auto-update-plugin-btn').on('click', '#auto-update-plugin-btn', function (e) {
                e.preventDefault();
                e.stopPropagation();
                performPluginUpdate();
            });
        }, 100);

        $o.on('click', e => { if (e.target === $o[0]) $o.remove(); });
    }

    // ✨✨✨ 修复：版本更新检查函数 (v1.1.13 图标终极兼容版) ✨✨✨
    /**
     * 一键热更新插件（自动调用酒馆后端 API）
     */
    async function performPluginUpdate() {
        const btn = $('#auto-update-plugin-btn');
        const oldText = btn.text();
        btn.text('📥 下载中...').prop('disabled', true);

        try {
            // 步骤A: 获取 CSRF Token
            const csrf = await getCsrfToken();

            // 步骤B: 获取所有扩展列表
            const listRes = await fetch('/api/extensions/list', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': csrf,
                    'Content-Type': 'application/json'
                }
            });

            if (!listRes.ok) {
                throw new Error('无法获取扩展列表');
            }

            const extensions = await listRes.json();

            // 步骤C: 在列表中查找包含 gaigai315/ST-Memory-Context 的扩展
            const myExtension = extensions.find(e =>
                e.url && e.url.toLowerCase().includes('gaigai315/st-memory-context')
            );

            if (!myExtension) {
                throw new Error('未找到安装记录，请手动前往"扩展"页面更新');
            }

            console.log(`🔍 [热更新] 识别到插件目录: ${myExtension.name}`);

            // 步骤D: 发送更新请求
            btn.text('🔄 更新中...');
            const updateRes = await fetch('/api/extensions/update', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': csrf,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: myExtension.name })
            });

            if (!updateRes.ok) {
                const errorText = await updateRes.text();
                throw new Error(errorText || '更新请求失败');
            }

            const result = await updateRes.json();

            if (result.success === false) {
                throw new Error(result.error || '更新失败');
            }

            // 步骤E: 成功提示并刷新页面
            if (typeof toastr !== 'undefined') {
                toastr.success('🎉 更新成功！即将刷新页面...', '系统');
            }
            btn.text('✅ 更新完成');

            setTimeout(() => {
                location.reload();
            }, 1000);

        } catch (e) {
            // 步骤F: 错误处理
            console.error('[热更新] 失败:', e);

            // ✅ [修复] 使用友好的弹窗提示，而不仅仅是 toastr
            const errorMsg = `❌ 自动更新失败\n\n错误信息：${e.message}\n\n💡 解决方案：\n1. 检查网络连接\n2. 前往酒馆"扩展"页面手动更新\n3. 检查 CSRF Token 是否有效`;

            await customAlert(errorMsg, '更新失败');

            if (typeof toastr !== 'undefined') {
                toastr.error(e.message, '更新失败');
            }

            btn.text(oldText).prop('disabled', false);
        }
    }

    async function checkForUpdates(currentVer) {
        // 1. 获取UI元素
        const $status = $('#update-status'); // 说明页里的状态文字
        const $icon = $('#g-about-btn');     // 标题栏的图标

        try {
            // 2. 从 GitHub Raw 读取 main 分支的 index.js
            const rawUrl = `https://raw.githubusercontent.com/${REPO_PATH}/main/index.js`;
            const response = await fetch(rawUrl, { cache: "no-store" });
            if (!response.ok) throw new Error('无法连接 GitHub');
            const text = await response.text();
            const match = text.match(/const\s+V\s*=\s*['"]v?([\d\.]+)['"]/);

            if (match && match[1]) {
                const latestVer = match[1];
                const hasUpdate = compareVersions(latestVer, currentVer) > 0;

                if (hasUpdate) {
                    // ✨✨✨ 发现新版本：点亮图标 ✨✨✨
                    $icon.addClass('g-has-update').attr('title', `🚀 发现新版本: v${latestVer} (点击查看)`);

                    // 如果说明页正打开着，也更新里面的文字
                    if ($status.length > 0) {
                        $status.html(`
                            <div style="color:#d32f2f; font-weight:bold;">
                                ⬆️ 发现新版本: v${latestVer}
                            </div>
                            <button id="auto-update-plugin-btn" style="background:#d32f2f; color:#fff; padding:4px 12px; border:none; border-radius:6px; cursor:pointer; margin-left:5px; font-weight:bold; transition:all 0.2s;">
                                🚀 立即更新
                            </button>
                        `);
                    }
                } else {
                    // 没有新版本
                    $icon.removeClass('g-has-update').attr('title', '使用说明 & 检查更新'); // 移除红点

                    if ($status.length > 0) {
                        $status.html(`<div style="color:#28a745; font-weight:bold;">✅ 当前已是最新版本</div>`);
                    }
                }
            }
        } catch (e) {
            console.warn('自动更新检查失败:', e);
            if ($status.length > 0) {
                $status.html(`<div style="color:#ff9800;">⚠️ 检查失败: ${e.message}</div>`);
            }
        }
    }

    // 版本号比较辅助函数 (1.2.0 > 1.1.9)
    // ✨✨✨ 修复：加上 function 关键字 ✨✨✨
    function compareVersions(v1, v2) {
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    }

    // ✨✨✨ 探针模块 (内置版) ✨✨✨
    (function () {
        console.log('🔍 探针模块 (内置版) 已启动');

        // 1. Token 计算辅助函数
        function countTokens(text) {
            if (!text) return 0;
            try {
                if (window.GPT3Tokenizer) {
                    const tokenizer = new window.GPT3Tokenizer({ type: 'gpt3' });
                    return tokenizer.encode(text).bpe.length;
                }
                const ctx = SillyTavern.getContext();
                if (ctx && ctx.encode) return ctx.encode(text).length;
            } catch (e) { }
            return text.length;
        }

        // 2. 挂载显示函数到 Gaigai 对象
        // 必须等待 index.js 主体执行完，Gaigai 对象挂载后才能执行
        setTimeout(() => {
            if (!window.Gaigai) return;

            window.Gaigai.showLastRequest = function () {
                const lastData = window.Gaigai.lastRequestData;
                if (!lastData || !lastData.chat) {
                    // ✨ 修复：调用共享的 customAlert，保持 UI 风格一致
                    if (window.Gaigai.customAlert) {
                        window.Gaigai.customAlert('❌ 暂无记录！\n\n请先去发送一条消息，插件会自动捕获发送内容。', '🔍 探针数据为空');
                    } else {
                        alert('❌ 暂无记录！\n\n请先去发送一条消息，插件会自动捕获发送内容。');
                    }
                    return;
                }

                let UI = { c: '#888888' };

                try {
                    const savedUI = localStorage.getItem('gg_ui');
                    if (savedUI) UI = JSON.parse(savedUI);
                    else if (window.Gaigai.ui) UI = window.Gaigai.ui;
                } catch (e) { }

                const esc = window.Gaigai.esc || ((t) => t);
                const pop = window.Gaigai.pop;
                const chat = lastData.chat;
                let totalTokens = 0; // 初始化计数器
                let listHtml = '';

                // 🌙 夜间模式适配：根据 UI.darkMode 定义颜色变量
                let itemBg, summaryBg, contentBg, borderColor;
                if (UI.darkMode) {
                    // 夜间模式：深灰色背景
                    itemBg = 'rgba(40, 40, 40, 0.9)';
                    summaryBg = 'rgba(50, 50, 50, 0.9)';
                    contentBg = 'rgba(30, 30, 30, 0.5)';
                    borderColor = 'rgba(255, 255, 255, 0.1)';
                } else {
                    // 白天模式：白色半透明
                    itemBg = 'rgba(255, 255, 255, 0.5)';
                    summaryBg = 'rgba(255, 255, 255, 0.8)';
                    contentBg = 'rgba(255, 255, 255, 0.3)';
                    borderColor = 'rgba(0, 0, 0, 0.1)';
                }

                // 生成列表并计算 Token
                chat.forEach((msg, idx) => {
                    const content = msg.content || '';
                    // 简单的估算Token，仅供参考
                    const tokens = (msg.content && msg.content.length) ? Math.ceil(msg.content.length / 1.5) : 0;
                    totalTokens += tokens;
                    let roleName = msg.role.toUpperCase();
                    let roleColor = '#666';
                    let icon = '📄';

                    if (msg.role === 'system') {
                        roleName = 'SYSTEM (系统)';
                        roleColor = '#28a745'; icon = '⚙️';
                        if (msg.isGaigaiData) { roleName = 'MEMORY (记忆表格)'; roleColor = '#d35400'; icon = '📊'; }
                        if (msg.isGaigaiPrompt) { roleName = 'PROMPT (提示词)'; roleColor = '#e67e22'; icon = '📌'; }
                    } else if (msg.role === 'user') {
                        roleName = 'USER (用户)'; roleColor = '#2980b9'; icon = '🧑';
                    } else if (msg.role === 'assistant') {
                        roleName = 'ASSISTANT (AI)'; roleColor = '#8e44ad'; icon = '🤖';
                    }

                    listHtml += `
                <details class="g-probe-item" style="margin-bottom:8px; border:1px solid ${borderColor}; border-radius:6px; background:${itemBg};">
                    <summary style="padding:10px; background:${summaryBg}; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; user-select:none; outline:none;">
                        <div style="font-weight:bold; color:${roleColor}; font-size:12px; display:flex; align-items:center; gap:6px;">
                            <span>${icon}</span>
                            <span>${roleName}</span>
                            <span style="background:rgba(0,0,0,0.05); color:${UI.tc}; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:normal;">#${idx}</span>
                        </div>
                        <div style="font-size:11px; font-family:monospace; color:${UI.tc}; background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:4px;">
                            ${tokens} TK
                        </div>
                    </summary>
                    <div class="g-probe-content" style="padding:10px; font-size:12px; line-height:1.6; color:${UI.tc}; border-top:1px solid ${borderColor}; white-space:pre-wrap; font-family:'Segoe UI', monospace; word-break:break-word; max-height: 500px; overflow-y: auto; background: ${contentBg};">${esc(content)}</div>
                </details>`;
                });

                const h = `
            <div class="g-p" style="padding:15px; height:100%; display:flex; flex-direction:column;">
                <div style="flex:0 0 auto; background: linear-gradient(135deg, ${UI.c}EE, ${UI.c}99); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.25); color:${UI.tc}; padding:15px; border-radius:8px; margin-bottom:15px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div>
                            <div style="font-size:12px; opacity:0.9;">Total Tokens</div>
                            <div style="font-size:24px; font-weight:bold;">${totalTokens}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px; opacity:0.9;">Messages</div>
                            <div style="font-size:18px; font-weight:bold;">${chat.length} 条</div>
                        </div>
                    </div>
                    <div style="position:relative;">
                        <input type="text" id="g-probe-search-input" placeholder="搜索..."
                            style="width:100%; padding:8px 10px; padding-left:30px; border:1px solid rgba(255,255,255,0.3); border-radius:4px; background:rgba(0,0,0,0.2); color:${UI.tc}; font-size:12px; outline:none;">
                        <i class="fa-solid fa-search" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.6); font-size:12px;"></i>
                    </div>
                </div>
                <div id="g-probe-list" style="flex:1; overflow-y:auto; padding-right:5px;">${listHtml}</div>
            </div>`;

                if (pop) {
                    pop('🔍 最后发送内容 & Toke', h, true);
                    setTimeout(() => {
                        $('#g-probe-search-input').on('input', function () {
                            const val = $(this).val().toLowerCase().trim();
                            $('.g-probe-item').each(function () {
                                const $details = $(this);
                                const text = $details.find('.g-probe-content').text().toLowerCase();
                                if (!val) {
                                    $details.show().removeAttr('open').css('border', `1px solid ${borderColor}`);
                                } else if (text.includes(val)) {
                                    $details.show().attr('open', true).css('border', `2px solid ${UI.c}`);
                                } else {
                                    $details.hide();
                                }
                            });
                        });
                    }, 100);
                } else alert('UI库未加载');
            };
        }, 500); // 延迟500毫秒确保 window.Gaigai 已挂载
    })();
})();