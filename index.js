// ========================================================================
// 记忆表格 v1.6.3
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

    console.log('🚀 记忆表格 v1.6.3 启动');

    // ===== 防止配置被后台同步覆盖的标志 =====
    window.isEditingConfig = false;

    // ===== 防止配置恢复期间触发保存的标志 (修复移动端竞态条件) =====
    let isRestoringSettings = false;

    // ==================== 全局常量定义 ====================
    const V = 'v1.6.3';
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
        enabled: true,          // ✅ 默认开启实时填表
        filterTags: '',         // 黑名单标签（去除）
        filterTagsWhite: '',    // 白名单标签（仅留）
        contextLimit: true,     // ✅ 默认开启隐藏楼层
        contextLimitCount: 30,  // ✅ 隐藏30楼
        tableInj: true,
        tablePos: 'system',
        tablePosType: 'system_end',
        tableDepth: 0,
        autoSummary: true,             // ✅ 默认开启自动总结
        autoSummaryFloor: 50,          // ✅ 50层触发
        autoSummaryPrompt: true,       // ✅ 默认静默发起（不弹窗确认）
        autoSummarySilent: true,       // ✅ 默认静默保存（不弹窗编辑）
        autoSummaryTargetTables: [],   // 🆕 自动总结的目标表格索引（空数组表示全部）
        autoSummaryDelay: true,        // ✅ 开启延迟
        autoSummaryDelayCount: 4,      // ✅ 延迟4楼
        autoBackfill: false,           // ❌ 默认关闭批量填表（避免与实时填表冲突）
        autoBackfillFloor: 20,         // ✅ 预设20层
        autoBackfillPrompt: true,      // ✅ 默认静默发起（不弹窗确认）
        autoBackfillSilent: true,      // ✅ 默认静默保存（不弹窗显示结果）
        autoBackfillDelay: true,       // ✅ 开启延迟
        autoBackfillDelayCount: 6,     // ✅ 延迟6楼
        log: true,
        pc: true,
        hideTag: true,
        filterHistory: true,
        cloudSync: true,
        syncWorldInfo: true,           // ✅ 默认开启世界书同步
        autoBindWI: true,              // ✅ 默认开启自动绑定世界书
        worldInfoVectorized: false,    // ❌ 默认关闭世界书自带向量化（已移除UI选项）
        // ==================== 独立向量检索配置 ====================
        vectorEnabled: false,          // ❌ 默认关闭独立向量检索
        vectorProvider: 'openai',      // 向量服务提供商
        vectorUrl: '',                 // 向量 API 地址
        vectorKey: '',                 // 向量 API 密钥
        vectorModel: 'BAAI/bge-m3',    // 向量模型名称
        vectorThreshold: 0.3,          // 相似度阈值 (0.0 - 1.0)
        vectorMaxCount: 10,            // 最大召回条数
        vectorSeparator: '===',        // 🆕 知识库文本切分符
        customTables: null,            // 用户自定义表格结构（格式同 DEFAULT_TABLES）
        reverseView: false             // ❌ 默认关闭倒序显示（最新行在上）
    };

    // ==================== API配置对象 ====================
    // 用于独立API调用（批量填表、自动总结等AI功能）
    let API_CONFIG = {
        enableAI: false,
        useIndependentAPI: false,
        provider: 'openai',
        apiUrl: '',
        apiKey: '',
        model: 'gemini-2.5-pro',
        temperature: 0.7,
        maxTokens: 65536,
        summarySource: 'table',    // ✅ 默认为表格总结（最佳实践）
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

    // ----- 表格结构定义（默认9个表格，支持动态扩展） -----
    // ==================== 默认表格定义（出厂设置模板） ====================
    // 最后一个表永远是"总结表"，前面的都是"数据表"
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
        // 🛡️ [Fix] Prevent duplicate popups
        const fixedId = 'gg-auto-task-confirm-modal';
        if ($('#' + fixedId).length > 0) {
            console.log('🛡️ [弹窗拦截] 检测到已有自动任务弹窗，跳过重复触发');
            return Promise.resolve({ action: 'cancel' });
        }

        return new Promise((resolve) => {
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
            const inputColor = isDark ? '#e0e0e0' : '#333333';
            const inputBorder = isDark ? 'rgba(255,255,255,0.2)' : '#ddd';
            const labelColor = isDark ? '#aaa' : '#666';
            const btnBg = isDark ? '#252525' : UI.c;
            const btnColor = isDark ? '#e0e0e0' : (UI.tc || '#ffffff');
            const postponeBg = isDark ? 'rgba(255, 193, 7, 0.15)' : 'rgba(255, 193, 7, 0.1)';
            const postponeBorder = isDark ? 'rgba(255, 193, 7, 0.4)' : 'rgba(255, 193, 7, 0.3)';
            const postponeLabelColor = isDark ? '#ffb74d' : '#856404';

            const $overlay = $('<div>', {
                id: fixedId, // ✅ Use fixed ID
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
                id: 'gg_postpone_floors',
                value: '0',
                min: '0',
                max: '100'
            });

            // ✅✅✅ [强制覆盖] 使用 attr('style') 设置样式，才能保留 !important
            $input.attr('style', `
                width: 80px;
                padding: 6px;
                background: ${inputBg} !important;
                color: ${inputColor} !important;
                border: 1px solid ${inputBorder} !important;
                border-radius: 4px;
                text-align: center;
                font-size: 14px;
            `);

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
                const postpone = parseInt($('#gg_postpone_floors').val()) || 0;
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

            $(document).on('keydown.' + fixedId, (e) => {
                if (e.key === 'Escape') {
                    $(document).off('keydown.' + fixedId);
                    $overlay.remove();
                    resolve({ action: 'cancel' });
                }
                else if (e.key === 'Enter') {
                    $(document).off('keydown.' + fixedId);
                    const postpone = parseInt($('#gg_postpone_floors').val()) || 0;
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

            // ✅ 使用 textarea 显示错误信息，支持滚动和代码格式
            const textAreaBg = isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(220, 53, 69, 0.05)';

            const $body = $('<div>', {
                css: { padding: '20px' }
            });

            const $errorBox = $('<textarea>', {
                readonly: true,
                css: {
                    width: '100%', minHeight: '200px', maxHeight: '400px',
                    padding: '12px', borderRadius: '6px',
                    border: `1px solid ${isDark ? '#dc3545' : '#dc3545'}`,
                    fontSize: '12px', fontFamily: 'monospace',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    outline: 'none',
                    overflow: 'auto',
                    boxSizing: 'border-box'
                }
            });

            // 🔥 强制样式修复：使用 attr 直接写入 style 字符串，确保 !important 生效
            const finalBg = textAreaBg;
            const finalColor = 'var(--g-tc)'; // 使用全局 CSS 变量跟随主题

            $errorBox.attr('style', $errorBox.attr('style') + `; background: ${finalBg} !important; color: ${finalColor} !important;`);

            $errorBox.val(message); // 最后赋值

            $body.append($errorBox);

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
                    padding: '12px 20px',
                    borderTop: `1px solid ${borderColor}`,
                    textAlign: 'right',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    flexWrap: 'wrap'
                }
            });

            // 🎨 统一按钮基础样式（适配日夜模式 + 响应式）
            const btnBaseStyle = {
                border: 'none',
                padding: '10px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: '600',
                flex: '1',
                minWidth: '100px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            };

            const $cancelBtn = $('<button>', {
                text: '✖️ 取消',
                css: {
                    ...btnBaseStyle,
                    background: isDark ? 'rgba(108, 117, 125, 0.3)' : '#6c757d',
                    color: '#ffffff',
                    border: isDark ? '1px solid rgba(108, 117, 125, 0.5)' : 'none'
                }
            }).on('click', () => { $overlay.remove(); resolve(null); });

            const $currentBtn = $('<button>', {
                text: `📄 删除当前页`,
                css: {
                    ...btnBaseStyle,
                    background: isDark ? 'rgba(255, 152, 0, 0.3)' : '#ff9800',
                    color: '#ffffff',
                    border: isDark ? '1px solid rgba(255, 152, 0, 0.6)' : 'none'
                }
            }).on('click', () => { $overlay.remove(); resolve('current'); });

            const $allBtn = $('<button>', {
                text: `🗑️ 删除全部`,
                css: {
                    ...btnBaseStyle,
                    background: isDark ? 'rgba(220, 53, 69, 0.3)' : '#dc3545',
                    color: '#ffffff',
                    border: isDark ? '1px solid rgba(220, 53, 69, 0.6)' : 'none'
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
        move(rowIndex, direction) {
            // direction: -1 for Up, 1 for Down
            const newIndex = rowIndex + direction;

            // 边界检查
            if (newIndex < 0 || newIndex >= this.r.length) {
                return false; // 无法移动
            }

            // 交换两行
            [this.r[rowIndex], this.r[newIndex]] = [this.r[newIndex], this.r[rowIndex]];
            return true; // 移动成功
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
            const sumSheet = this.m.get(this.m.s.length - 1); // 动态获取最后一个表格（总结表）

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

                // 确保总结表索引存在且更新列定义
                const summaryIndex = this.m.s.length - 1;
                if (C.customTables[summaryIndex]) {
                    C.customTables[summaryIndex].c = [...sumSheet.c];  // 同步列定义
                    console.log(`✅ [自动扩容] C.customTables[${summaryIndex}] 已更新为:`, C.customTables[summaryIndex].c);
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

            // ⚡ 自动化流：如果开启了"总结后自动向量化"，且未开启"同步到世界书"，则直接触发向量化
            // （如果开启了世界书同步，向量化会在世界书同步完成后触发，避免重复）
            const currentConfig = window.Gaigai?.config_obj;
            if (currentConfig && currentConfig.autoVectorizeSummary && !currentConfig.syncWorldInfo) {
                if (window.Gaigai.VM && typeof window.Gaigai.VM.syncSummaryToBook === 'function') {
                    console.log('⚡ [自动化流] 总结保存完成，正在触发自动向量化（未启用世界书同步）...');
                    // 使用 setTimeout 避免阻塞保存流程
                    setTimeout(async () => {
                        try {
                            await window.Gaigai.VM.syncSummaryToBook(true);
                        } catch (error) {
                            console.error('❌ [自动化流] 自动向量化失败:', error);
                        }
                    }, 100);
                }
            }
        }

        // 读取逻辑也微调一下，让多条总结之间有间隔，方便AI理解
        load() {
            const sumSheet = this.m.get(this.m.s.length - 1); // 动态获取最后一个表格（总结表）
            if (!sumSheet || sumSheet.r.length === 0) return '';

            // 格式示例：
            // 【剧情总结 1】
            // ...内容...
            //
            // 【剧情总结 2】
            // ...内容...
            return sumSheet.r.map((row, i) => {
                // ✨✨✨ 核心修复：检查总结表的第 i 行是否被标记为隐藏
                const summaryIndex = this.m.s.length - 1;
                // summarizedRows 是全局变量，存储了所有表格的隐藏行索引
                if (typeof summarizedRows !== 'undefined' && summarizedRows[summaryIndex] && summarizedRows[summaryIndex].includes(i)) {
                    return null; // 🚫 跳过被隐藏(变绿)的行
                }
                return `【${row[0] || '历史片段'}】\n${row[1] || ''}`;
            }).filter(t => t).join('\n\n');
        }

        // ✅✅✅ 升级版 loadArray：支持动态列 + 过滤隐藏行
        loadArray() {
            const sumSheet = this.m.get(this.m.s.length - 1); // 动态获取最后一个表格（总结表）
            if (!sumSheet || sumSheet.r.length === 0) return [];

            const summaryIndex = this.m.s.length - 1;
            return sumSheet.r.map((row, i) => {
                // 🚫 过滤逻辑：检查是否被标记为隐藏（同 load() 方法）
                if (typeof summarizedRows !== 'undefined' && summarizedRows[summaryIndex] && summarizedRows[summaryIndex].includes(i)) {
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
        clear() { this.m.get(this.m.s.length - 1).clear(); this.m.save(); }
        has() { const s = this.m.get(this.m.s.length - 1); return s.r.length > 0 && s.r[0][1]; }
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
            this.structureBound = false;
            this.wiConfig = { bookName: '' };
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
                } catch (e) {
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
                structure: this.s.map(sh => ({ n: sh.n, c: sh.c })), // ✅ 新增：保存当前表结构（表名和列名）
                structureBound: this.structureBound, // ✅ 保存结构绑定状态
                wiConfig: this.wiConfig, // ✅ 保存世界书自定义配置
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
                    autoSummary: C.autoSummary,
                    // ✅ 核心参数
                    autoBackfillFloor: C.autoBackfillFloor,
                    autoSummaryFloor: C.autoSummaryFloor,
                    summarySource: API_CONFIG.summarySource,
                    // ✅ 自动化细节 (延迟/静默/弹窗) - 之前漏掉的都在这里
                    autoBackfillDelay: C.autoBackfillDelay,
                    autoBackfillDelayCount: C.autoBackfillDelayCount,
                    autoBackfillPrompt: C.autoBackfillPrompt,
                    autoBackfillSilent: C.autoBackfillSilent,
                    autoSummaryDelay: C.autoSummaryDelay,
                    autoSummaryDelayCount: C.autoSummaryDelayCount,
                    autoSummaryPrompt: C.autoSummaryPrompt,
                    autoSummarySilent: C.autoSummarySilent,
                    // ✅ 其他功能
                    contextLimit: C.contextLimit,
                    contextLimitCount: C.contextLimitCount,
                    filterTags: C.filterTags,
                    filterTagsWhite: C.filterTagsWhite,
                    syncWorldInfo: C.syncWorldInfo,
                    autoBindWI: C.autoBindWI,
                    worldInfoVectorized: C.worldInfoVectorized,
                    // ✅ 向量检索配置
                    vectorEnabled: C.vectorEnabled,
                    vectorUrl: C.vectorUrl,
                    vectorKey: C.vectorKey,
                    vectorModel: C.vectorModel,
                    vectorThreshold: C.vectorThreshold,
                    vectorMaxCount: C.vectorMaxCount,
                    // ✅ 视图配置
                    reverseView: C.reverseView
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

        // ✨✨✨ 核心修复：从角色存档恢复进度指针 (含分支继承补丁)
        load() {
            const id = this.gid();
            if (!id) return;

            if (this.id !== id) {
                // 🔄 检测到会话切换
                this.id = id;
                const tableDef = (C.customTables && Array.isArray(C.customTables) && C.customTables.length > 0)
                    ? C.customTables
                    : DEFAULT_TABLES;
                this.initTables(tableDef, false);
                lastInternalSaveTime = 0;
                summarizedRows = {};
                userColWidths = {};
                userRowHeights = {};
                API_CONFIG.lastSummaryIndex = 0;
                API_CONFIG.lastBackfillIndex = 0;
                localStorage.setItem(AK, JSON.stringify(API_CONFIG));

                console.log(`🔄 [会话切换] ID: ${id}，已重置所有状态`);
            }

            let cloudData = null;
            let localData = null;
            if (C.cloudSync) { try { const ctx = this.ctx(); if (ctx && ctx.chatMetadata && ctx.chatMetadata.gaigai) cloudData = ctx.chatMetadata.gaigai; } catch (e) { } }

            // 🛡️ [数据迁移修复] 检查云端数据 (支持重命名、分支迁移)
            if (cloudData) {
                // 只要数据存在于当前 chatMetadata 中，我们就认为是合法的，允许迁移
                if (cloudData.id !== id) {
                    console.log(`🔄 [数据迁移] 检测到 ID 变更 (可能是重命名或分支)，自动迁移数据。 (原ID: ${cloudData.id} -> 新ID: ${id})`);
                    // 强制更新内存对象中的 ID，确保后续保存时使用新 ID
                    cloudData.id = id;
                } else {
                    console.log(`✅ [数据验证] ID 匹配: ${id}`);
                }
            }

            try { const sv = localStorage.getItem(`${SK}_${id}`); if (sv) localData = JSON.parse(sv); } catch (e) { }

            // 🛡️ [防串味修复] 检查本地数据
            if (localData) {
                if (localData.id !== id) {
                    console.warn(`🔴 [数据隔离] 本地数据 ID 不匹配，已忽略。`);
                    localData = null;
                }
            }

            let finalData = null;
            if (cloudData && localData) finalData = (cloudData.ts > localData.ts) ? cloudData : localData;
            else if (cloudData) finalData = cloudData;
            else if (localData) finalData = localData;

            // ✅ 时间戳检查 (提前到重置逻辑之前!)
            if (finalData && finalData.ts <= lastInternalSaveTime) return;

            // ✅ Per-Chat Configuration: STEP 1 - 彻底重置为全局默认
            // (只有确定要加载数据了才重置，避免无效重置导致配置丢失)
            try {
                const globalConfigStr = localStorage.getItem(CK);
                const globalConfig = globalConfigStr ? JSON.parse(globalConfigStr) : {};
                const globalApiStr = localStorage.getItem(AK);
                const globalApiConfig = globalApiStr ? JSON.parse(globalApiStr) : {};

                // --- 1. 开关类 ---
                C.enabled = globalConfig.enabled !== undefined ? globalConfig.enabled : true;
                C.autoBackfill = globalConfig.autoBackfill !== undefined ? globalConfig.autoBackfill : false;
                C.autoSummary = globalConfig.autoSummary !== undefined ? globalConfig.autoSummary : true;
                // --- 2. 数值类 ---
                C.autoBackfillFloor = globalConfig.autoBackfillFloor !== undefined ? globalConfig.autoBackfillFloor : 20;
                C.autoSummaryFloor = globalConfig.autoSummaryFloor !== undefined ? globalConfig.autoSummaryFloor : 50;
                C.autoBackfillDelay = globalConfig.autoBackfillDelay !== undefined ? globalConfig.autoBackfillDelay : true;
                C.autoBackfillDelayCount = globalConfig.autoBackfillDelayCount !== undefined ? globalConfig.autoBackfillDelayCount : 6;
                C.autoSummaryDelay = globalConfig.autoSummaryDelay !== undefined ? globalConfig.autoSummaryDelay : true;
                C.autoSummaryDelayCount = globalConfig.autoSummaryDelayCount !== undefined ? globalConfig.autoSummaryDelayCount : 4;
                // --- 3. 其他 ---
                C.autoBackfillPrompt = globalConfig.autoBackfillPrompt !== undefined ? globalConfig.autoBackfillPrompt : true;
                C.autoBackfillSilent = globalConfig.autoBackfillSilent !== undefined ? globalConfig.autoBackfillSilent : true;
                C.autoSummaryPrompt = globalConfig.autoSummaryPrompt !== undefined ? globalConfig.autoSummaryPrompt : true;
                C.autoSummarySilent = globalConfig.autoSummarySilent !== undefined ? globalConfig.autoSummarySilent : true;
                C.contextLimit = globalConfig.contextLimit !== undefined ? globalConfig.contextLimit : true;
                C.contextLimitCount = globalConfig.contextLimitCount !== undefined ? globalConfig.contextLimitCount : 30;
                C.filterTags = globalConfig.filterTags !== undefined ? globalConfig.filterTags : '';
                C.filterTagsWhite = globalConfig.filterTagsWhite !== undefined ? globalConfig.filterTagsWhite : '';
                C.syncWorldInfo = globalConfig.syncWorldInfo !== undefined ? globalConfig.syncWorldInfo : true;
                C.autoBindWI = globalConfig.autoBindWI !== undefined ? globalConfig.autoBindWI : true;
                C.worldInfoVectorized = globalConfig.worldInfoVectorized !== undefined ? globalConfig.worldInfoVectorized : false;
                // ✅ 向量检索配置
                C.vectorEnabled = globalConfig.vectorEnabled !== undefined ? globalConfig.vectorEnabled : false;
                C.vectorUrl = globalConfig.vectorUrl !== undefined ? globalConfig.vectorUrl : '';
                C.vectorKey = globalConfig.vectorKey !== undefined ? globalConfig.vectorKey : '';
                C.vectorModel = globalConfig.vectorModel !== undefined ? globalConfig.vectorModel : 'BAAI/bge-m3';
                C.vectorThreshold = globalConfig.vectorThreshold !== undefined ? globalConfig.vectorThreshold : 0.6;
                C.vectorMaxCount = globalConfig.vectorMaxCount !== undefined ? globalConfig.vectorMaxCount : 3;
                // ✅ 视图配置
                C.reverseView = globalConfig.reverseView !== undefined ? globalConfig.reverseView : false;

                if (globalApiConfig.summarySource !== undefined) API_CONFIG.summarySource = globalApiConfig.summarySource;
                else API_CONFIG.summarySource = 'table';

                console.log('🧹 [配置清洗] 内存状态已重置为全局/默认值，准备加载会话专属配置...');
            } catch (e) {
                console.warn('⚠️ [配置重置] 失败，可能导致配置串味:', e);
            }

            if (finalData && finalData.v && finalData.d) {
                // 恢复结构
                if (finalData.structureBound && finalData.structure && Array.isArray(finalData.structure) && finalData.structure.length > 0) {
                    console.log(`🏗️ [结构恢复] 检测到专属表结构...`);
                    this.initTables(finalData.structure, false);
                }
                this.structureBound = finalData.structureBound || false;

                // 恢复世界书自定义配置
                if (finalData.wiConfig) {
                    this.wiConfig = finalData.wiConfig;
                    console.log('✅ [世界书配置] 已恢复');
                }

                // 恢复数据
                finalData.d.forEach((sd, i) => { if (this.s[i]) this.s[i].from(sd); });
                if (finalData.summarized) summarizedRows = finalData.summarized;
                if (finalData.colWidths) userColWidths = finalData.colWidths;
                if (finalData.rowHeights) userRowHeights = finalData.rowHeights;

                // 恢复进度
                if (finalData.meta) {
                    if (finalData.meta.lastSum !== undefined) API_CONFIG.lastSummaryIndex = finalData.meta.lastSum;
                    if (finalData.meta.lastBf !== undefined) API_CONFIG.lastBackfillIndex = finalData.meta.lastBf;
                    localStorage.setItem(AK, JSON.stringify(API_CONFIG));
                }

                // 恢复配置
                if (finalData.config) {
                    Object.assign(C, finalData.config);
                    // 恢复特殊配置
                    if (finalData.config.summarySource !== undefined) API_CONFIG.summarySource = finalData.config.summarySource;
                    console.log('✅ [每聊配置] 已恢复');
                }

                lastInternalSaveTime = finalData.ts;
            }
        }

        gid() {
            try {
                const x = this.ctx();
                if (!x) return null;

                // 1. 获取聊天文件 ID (时间线标识)
                // 诊断显示 file_name 为 undefined，但 chatId 有值，所以必须做兼容
                const chatId = x.chatMetadata?.file_name || x.chatId;
                if (!chatId) return null;

                // 2. ✅【群聊模式核心修复】
                // 诊断显示 groupName 为 undefined，但 groupId (如 1767964998110) 存在。
                // 只要存在 groupId，就强制锁定为群聊存档，忽略当前发言角色。
                if (x.groupId) {
                    return `Group_${x.groupId}_${chatId}`;
                }

                // 3. 单人角色模式 (保持原逻辑)
                if (C.pc) {
                    const charId = x.characterId || x.name2;
                    if (!charId) return null;
                    return `${charId}_${chatId}`;
                }

                // 4. 纯聊天文件模式 (兜底)
                return chatId;
            } catch (e) { return null; }
        }

        ctx() { return (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null; }

        getTableText() { return this.s.slice(0, -1).map((s, i) => s.txt(i)).filter(t => t).join('\n'); }

        pmt() {
            let result = '';
            if (this.sm.has()) {
                result += '=== 📚 记忆总结（历史压缩数据，仅供参考） ===\n\n' + this.sm.load() + '\n\n=== 总结结束 ===\n\n';
            }

            const tableStr = this.s.slice(0, -1).map((s, i) => s.txt(i)).filter(t => t).join('\n');
            if (tableStr) {
                // ✅ 修改为：纯粹的状态描述，不带操作暗示，防止 AI 误解
                result += '【系统数据库：剧情记忆档案（仅供剧情参考，请勿在回复中生成此表格）】\n\n' + tableStr + '【记忆档案结束】\n';
            } else if (this.sm.has()) {
                result += '【系统数据库：剧情记忆档案（仅供剧情参考，请勿在回复中生成此表格）】\n\n⚠️ 所有详细数据已归档，当前可视为空。\n\n【记忆档案结束】\n';
            }

            // ✨✨✨ 核心修改：精简状态栏，只告诉 AI 下一个索引 ✨✨✨
            result += '\n[后台索引状态]\n';
            this.s.slice(0, -1).forEach((s, i) => {
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
                data: m.all().slice(0, -1).map(sh => JSON.parse(JSON.stringify(sh.json()))), // ✅ 只保存数据表，不保存总结表
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

    // ✅✅✅ [核心修复] 强力回档函数 (最终逻辑修正版)
    // ✅✅✅ [核心修复] 强力回档函数 (支持强制模式)
    function restoreSnapshot(msgIndex, force = false) {
        try {
            const key = msgIndex.toString();
            const snapshot = snapshotHistory[key];

            // 1. 基础检查：快照是否存在
            if (!snapshot) {
                return false;
            }

            // 🛡️ [过期保护 - 核心逻辑]
            // 只有在非强制模式(force=false)下才检查时间戳
            if (!force) { // <--- 2. 这里加了判断
                const currentManualEditTime = window.lastManualEditTime || lastManualEditTime;
                if (snapshot.timestamp < currentManualEditTime) {
                    console.log(`🛡️ [保护] 检测到手动修改，跳过回滚。`);
                    return false;
                }
            }

            // 2. 先彻底清空当前表格
            // (只要通过了上面的时间戳检查，说明这个空状态是合法的，或者是AI生成的最新状态)
            m.s.slice(0, -1).forEach(sheet => sheet.r = []);

            // 3. ✨✨✨ [关键修复] 强力深拷贝恢复 ✨✨✨
            // 将快照里的数据（哪怕是空的）复印一份给当前表格
            snapshot.data.forEach((sd, i) => {
                if (i < m.s.length - 1 && m.s[i]) {
                    const deepCopyData = JSON.parse(JSON.stringify(sd));
                    m.s[i].from(deepCopyData);
                }
            });

            // 4. 恢复总结状态
            if (snapshot.summarized) {
                summarizedRows = JSON.parse(JSON.stringify(snapshot.summarized));
            } else {
                summarizedRows = {};
            }

            // 5. 强制锁定保存
            // 既然回档成功了，就重置编辑时间，防止死循环
            lastManualEditTime = 0;

            // ✨✨✨ 修复：传入 true，强制绕过熔断保护 ✨✨✨
            // 因为回档是把数据恢复到旧状态（可能是空的），这是有意为之，不是BUG
            m.save(true);

            const totalRecords = m.s.reduce((sum, s) => sum + s.r.length, 0);
            console.log(`✅ [完美回档] 快照${key}已恢复 - 当前行数:${totalRecords}`);

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
        // 1. 预处理：如果是字符串，尝试解析为对象（应对双重序列化）
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return []; }
        }

        if (!data) return [];

        /** @type {any[]} */
        let candidates = [];

        // 2. 搜集所有可能的数组 (广度优先搜索，限制深度防止卡死)
        const queue = [{ node: data, depth: 0 }];
        while (queue.length > 0) {
            const { node, depth } = queue.shift();

            if (depth > 3) continue; // 不扫描太深

            if (Array.isArray(node)) {
                candidates.push(node);
            } else if (node && typeof node === 'object') {
                // 将对象的值加入队列
                for (const key of Object.keys(node)) {
                    // 忽略明显不是数据的字段
                    if (key === 'error' || key === 'usage' || key === 'created') continue;
                    queue.push({ node: node[key], depth: depth + 1 });
                }
            }
        }

        // 3. 评分机制：找出最像模型列表的数组
        let bestArray = [];
        let maxScore = -1;

        for (const arr of candidates) {
            if (arr.length === 0) continue;

            let score = 0;
            let validItemCount = 0;

            // 抽样检查前5个元素
            const sampleSize = Math.min(arr.length, 5);
            for (let i = 0; i < sampleSize; i++) {
                const item = arr[i];
                if (typeof item === 'string') {
                    // 纯字符串数组 ['gpt-4', 'claude-2']
                    validItemCount++;
                } else if (item && typeof item === 'object') {
                    // 对象数组，检查特征键
                    if ('id' in item || 'model' in item || 'name' in item || 'displayName' in item || 'slug' in item) {
                        validItemCount++;
                    }
                }
            }

            // 评分公式：命中率高 > 长度长
            if (validItemCount > 0) {
                // 如果大部分抽样元素都有效，则该数组得分 = 数组长度
                // 这里加权 validItemCount 是为了防止误判纯数字数组等干扰项
                score = (validItemCount / sampleSize) * 1000 + arr.length;
            }

            if (score > maxScore) {
                maxScore = score;
                bestArray = arr;
            }
        }

        // 4. MakerSuite/Gemini 专用过滤
        // 若对象包含 supportedGenerationMethods，则仅保留包含 'generateContent' 的模型
        try {
            bestArray = bestArray.filter(m => {
                const methods = m && typeof m === 'object' ? m.supportedGenerationMethods : undefined;
                return Array.isArray(methods) ? methods.includes('generateContent') : true;
            });
        } catch { }

        // 5. 映射与归一化
        let models = bestArray
            .filter(m => m && (typeof m === 'string' || typeof m === 'object'))
            .map(m => {
                if (typeof m === 'string') {
                    return { id: m, name: m };
                }

                // 兼容多字段 id
                let id = m.id || m.name || m.model || m.slug || '';

                // 去掉常见前缀
                if (typeof id === 'string' && id.startsWith('models/')) {
                    id = id.replace(/^models\//, '');
                }

                // 优先取 displayName，其次取 name/id
                const name = m.displayName || m.name || m.id || id || undefined;

                return id ? { id, name } : null;
            })
            .filter(Boolean);

        // 6. 去重（按 id）
        const seen = new Set();
        models = models.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });

        // 7. 排序（按 id 升序）
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

        // ✅ 新增：如果是总结表（最后一个表），给个特殊的默认宽度
        if (tableIndex === m.s.length - 1 && colName === '表格类型') {
            return 100;
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
            if ($('#gai-main-pop').length > 0) {
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
            id: 'gai-view-overlay',
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
                color: 'var(--g-tc)',
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
        $header.append(`<h3 style="margin:0; font-size:16px; color:var(--g-tc);">📏 视图设置</h3>`);

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
        $sliderContainer.append(`<div style="font-size:12px; font-weight:600; margin-bottom:8px; color:var(--g-tc);">行高调整 (px)</div>`);

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
                color: 'var(--g-tc)'
            }
        });

        $controlRow.append($slider, $numInput);
        $sliderContainer.append($controlRow);
        $box.append($sliderContainer);

        // 🔃 倒序显示开关
        const $reverseContainer = $('<div>', {
            css: {
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa',
                padding: '12px',
                borderRadius: '8px',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }
        });

        const $reverseLabel = $('<div>', {
            html: '<span style="font-size:12px; font-weight:600; color:var(--g-tc);">🔃 倒序显示</span><br><span style="font-size:10px; color:#999;">最新行显示在上方</span>',
            css: { flex: 1 }
        });

        const $reverseToggle = $('<label>', {
            css: {
                position: 'relative',
                display: 'inline-block',
                width: '44px',
                height: '24px',
                cursor: 'pointer'
            }
        });

        const $reverseCheckbox = $('<input>', {
            type: 'checkbox',
            checked: C.reverseView,
            css: { display: 'none' }
        });

        const $reverseSlider = $('<span>', {
            css: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: C.reverseView ? themeColor : (isDark ? '#555' : '#ccc'),
                borderRadius: '24px',
                transition: 'background-color 0.3s',
                cursor: 'pointer'
            }
        });

        const $reverseKnob = $('<span>', {
            css: {
                position: 'absolute',
                height: '18px',
                width: '18px',
                left: C.reverseView ? '23px' : '3px',
                bottom: '3px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: 'left 0.3s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }
        });

        $reverseSlider.append($reverseKnob);
        $reverseToggle.append($reverseCheckbox, $reverseSlider);
        $reverseContainer.append($reverseLabel, $reverseToggle);
        $box.append($reverseContainer);

        // 倒序开关事件
        $reverseCheckbox.on('change', function() {
            const isReversed = $(this).is(':checked');
            C.reverseView = isReversed;

            // 更新开关样式
            $reverseSlider.css('backgroundColor', isReversed ? themeColor : (isDark ? '#555' : '#ccc'));
            $reverseKnob.css('left', isReversed ? '23px' : '3px');

            // 保存并刷新视图
            m.save();
            shw();
        });

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
                color: 'var(--g-tc)'
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
        let statusStr = '\n=== 📋 表格状态 ===\n';
        m.s.slice(0, -1).forEach((s, i) => {
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

【📊 表格状态】
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
     * 核心过滤函数：串行双重过滤（先黑名单去除，再白名单提取）
     * @param {string} content - 原始文本
     * @returns {string} - 处理后的文本
     */
    function filterContentByTags(content) {
        if (!content) return content;
        let result = content;

        // 1️⃣ 黑名单处理 (如果设置了)
        if (C.filterTags) {
            const tags = C.filterTags.split(/[,，]/).map(t => t.trim()).filter(t => t);
            tags.forEach(t => {
                let re;
                if (t.startsWith('!--')) {
                    // 匹配 HTML 注释 <!--...-->
                    re = new RegExp('<' + t + '[\\s\\S]*?-->', 'gi');
                } else {
                    // 匹配成对标签 <tag>...</tag>
                    re = new RegExp(`<${t}(?:\\s+[^>]*)?>[\\s\\S]*?<\\/${t}>`, 'gi');
                }
                result = result.replace(re, '');
            });
        }

        // 2️⃣ 白名单处理 (如果设置了，基于黑名单处理后的结果继续处理)
        if (C.filterTagsWhite) {
            const tags = C.filterTagsWhite.split(/[,，]/).map(t => t.trim()).filter(t => t);
            if (tags.length > 0) {
                let extracted = [];
                let foundAny = false;
                tags.forEach(t => {
                    let re;
                    if (t.startsWith('!--')) {
                        // 白名单模式下注释标签通常不常用，但也做兼容
                        re = new RegExp('<' + t + '[\\s\\S]*?-->', 'gi');
                    } else {
                        // 提取标签内的内容（group 1）
                        re = new RegExp(`<${t}(?:\\s+[^>]*)?>([\\s\\S]*?)(?:<\\/${t}>|$)`, 'gi');
                    }
                    let match;
                    while ((match = re.exec(result)) !== null) { // 注意：是对 result 进行匹配
                        if (match[1] && match[1].trim()) {
                            extracted.push(match[1].trim());
                            foundAny = true;
                        } else if (match[0]) {
                            // 兼容注释或其他无 group 捕获的情况
                            extracted.push(match[0].trim());
                            foundAny = true;
                        }
                    }
                });
                // 只有找到了白名单标签才替换，否则保留(黑名单处理后的)原文本，防止误删
                if (foundAny) result = extracted.join('\n\n');
            }
        }

        return result.trim();
    }

    // ✅✅✅ 智能解析器 v5.0 (终极融合版：脚本 + ToolCall + Gemini数组)
    function prs(tx) {
        if (!tx) return [];

        // 0. 反转义
        tx = unesc(tx);

        // 1. 基础清洗
        const commentStart = new RegExp('\\x3c!--', 'g');
        const commentEnd = new RegExp('--\\x3e', 'g');
        let cleanTx = tx.replace(commentStart, ' ').replace(commentEnd, ' ');
        // 压缩空白，规范化函数名 (针对脚本格式)
        cleanTx = cleanTx.replace(/\s+/g, ' ').replace(/Row\s+\(/g, 'Row(').trim();

        const cs = [];

        // ==========================================
        // 🟢 策略 A: 脚本格式解析 (insertRow(...))
        // ==========================================
        const commands = ['insertRow', 'updateRow', 'deleteRow'];
        commands.forEach(fn => {
            let searchIndex = 0;
            while (true) {
                const startIdx = cleanTx.indexOf(fn + '(', searchIndex);
                if (startIdx === -1) break;

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

                const argsStr = cleanTx.substring(startIdx + fn.length + 1, endIdx);
                const parsed = pag(argsStr, fn); // 假设 pag 函数在你代码里已有
                if (parsed) {
                    cs.push({ t: fn.replace('Row', '').toLowerCase(), ...parsed });
                }
                searchIndex = endIdx + 1;
            }
        });

        // ==========================================
        // 🔵 策略 B: Gemini 数组格式解析 (你刚发的格式)
        // 匹配: [{"op": "updateRow", "table": 2, ...}]
        // ==========================================
        try {
            // 正则提取方括号 [] 包裹的内容
            const arrayMatches = cleanTx.match(/\[\s*\{[\s\S]*?\}\s*\]/g) || [];
            arrayMatches.forEach(jsonStr => {
                try {
                    // 预检：必须包含 op 和 table 关键字
                    if (!jsonStr.includes('op') || !jsonStr.includes('table')) return;

                    const arr = JSON.parse(jsonStr);
                    if (Array.isArray(arr)) {
                        arr.forEach(item => {
                            if (item.op && item.table !== undefined) {
                                // 映射操作类型
                                let type = '';
                                if (item.op.includes('insert')) type = 'insert';
                                else if (item.op.includes('update')) type = 'update';
                                else if (item.op.includes('delete')) type = 'delete';

                                if (type) {
                                    cs.push({
                                        t: type,
                                        ti: parseInt(item.table),
                                        ri: item.index !== undefined ? parseInt(item.index) : null,
                                        d: item.row || null // Gemini 这里的字段叫 row
                                    });
                                }
                            }
                        });
                        console.log(`🔧 [兼容模式] 成功解析 Gemini 数组指令 (${arr.length}条)`);
                    }
                } catch (e) { /* 不是我们要的数组，忽略 */ }
            });
        } catch (e) { console.warn('Array parser error', e); }

        // ==========================================
        // 🔴 策略 C: Tool Call 格式解析 (OpenAI/DeepSeek)
        // 匹配: {"function": "updateRow", "args": [...]}
        // ==========================================
        try {
            if (cleanTx.includes('function') && cleanTx.includes('args')) {
                const objMatches = cleanTx.match(/\{.*?\}/g) || [];
                objMatches.forEach(jsonStr => {
                    try {
                        // 简单的修复单引号 JSON (容错)
                        const validJson = jsonStr.replace(/'/g, '"');
                        const obj = JSON.parse(validJson);

                        if (obj.function && Array.isArray(obj.args)) {
                            const fnName = obj.function.replace('Row', '').toLowerCase();
                            const args = obj.args;
                            let parsed = null;

                            if (obj.function.includes('insert') && args.length >= 2) parsed = { ti: args[0], ri: null, d: args[1] };
                            else if (obj.function.includes('update') && args.length >= 3) parsed = { ti: args[0], ri: args[1], d: args[2] };
                            else if (obj.function.includes('delete') && args.length >= 2) parsed = { ti: args[0], ri: args[1], d: null };

                            if (parsed) {
                                cs.push({ t: fnName, ...parsed });
                                console.log('🔧 [兼容模式] 成功解析 ToolCall 指令:', obj.function);
                            }
                        }
                    } catch (e) { /* 忽略解析失败 */ }
                });
            }
        } catch (e) { console.warn('ToolCall parser error', e); }

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
        // ✅ Strict Sequential Execution: Respects AI's intended order
        // If AI outputs "insertRow → updateRow", it means "insert THEN update the new row"
        // If AI outputs "updateRow → insertRow", it means "update old row THEN insert new row"
        cs.forEach(cm => {
            const sh = m.get(cm.ti);
            if (!sh) return;
            if (cm.t === 'update' && cm.ri !== null) sh.upd(cm.ri, cm.d);
            if (cm.t === 'insert') sh.ins(cm.d);
            if (cm.t === 'delete' && cm.ri !== null) sh.del(cm.ri);
        });
        // AI自动执行的指令,最后统一保存
        m.save();
    }

    function inj(ev) {
        // ✨✨✨ 1. [核心修复] 仅拦截总结/追溯生成的请求 (防止 Prompt 污染) ✨✨✨
        // 注意：批量填表 (autoBackfill) 期间用户在正常聊天，必须允许注入！
        if (window.isSummarizing) {
            // 如果正在执行总结/追溯任务，我们要把 System/Preset 里的变量全部"擦除"
            // 防止酒馆把 {{MEMORY_PROMPT}} 展开成表格发送给 AI，造成双重数据
            const varsToRemove = ['{{MEMORY}}', '{{MEMORY_SUMMARY}}', '{{MEMORY_TABLE}}', '{{MEMORY_PROMPT}}'];

            if (ev.chat && Array.isArray(ev.chat)) {
                ev.chat.forEach(msg => {
                    let c = msg.content || msg.mes || '';
                    if (!c) return;

                    let modified = false;
                    varsToRemove.forEach(v => {
                        if (c.includes(v)) {
                            // 全局替换，防止出现多次
                            c = c.split(v).join('');
                            modified = true;
                        }
                    });

                    if (modified) {
                        if (msg.content) msg.content = c;
                        if (msg.mes) msg.mes = c;
                    }
                });
            }

            console.log('🧹 [总结/追溯模式] 已清洗所有记忆变量，防止双重注入。');
            return; // ⛔️ 仅在此模式下拦截
        }
        // ============================================================
        // 1. 准备数据组件 (拆解为原子部分，无论开关与否都准备，以备变量调用)
        // ============================================================
        let strSummary = '';
        let strTable = '';
        let strPrompt = '';

        // ✅ 准备分区消息数组（用于变量替换时的分区发送）
        // 这里的命名必须保持 summaryMessages 和 tableMessages，以兼容后文的合并逻辑
        let summaryMessages = [];
        let tableMessages = [];

        // A. 准备总结数据 (如果有且未开启世界书同步)
        // 互斥逻辑：开启世界书同步后，由酒馆的世界书系统负责发送总结，插件不再重复注入
        if (m.sm.has() && !C.syncWorldInfo) {
            // 1. 旧逻辑：合并字符串（用于兼容旧的文本变量替换）
            strSummary = '=== 📚 记忆总结（历史存档） ===\n\n' + m.sm.load() + '\n\n';

            // 2. 新逻辑：按行拆分（用于 System 消息注入）
            const summaryArray = m.sm.loadArray();
            summaryArray.forEach((item, i) => {
                summaryMessages.push({
                    role: 'system',
                    // 🔴 核心修改：动态设置名字，格式：sys(总结N)
                    name: `SYSTEM(总结${i + 1})`,
                    content: `【前情提要 - 剧情总结 ${i + 1}】\n${item.content}`,
                    isGaigaiData: true
                });
            });
        }

        // B. 准备表格数据 (实时构建)
        // 1. 旧逻辑：合并字符串（用于兼容旧的文本变量替换）
        const tableContent = m.s.slice(0, -1).map((s, i) => s.txt(i)).filter(t => t).join('\n');

        strTable += '【⚠️ 系统只读数据库：已归档的历史剧情 (Past Events)】\n';
        strTable += '【指令：以下内容为绝对客观的过去事实，仅供你查阅以保持剧情连贯。❌ 严禁复述！❌ 严禁重演！】\n\n';

        if (tableContent) {
            strTable += tableContent;
        } else {
            strTable += '（暂无详细记录，请根据当前剧情建立新记录）\n';
        }
        strTable += '【记忆档案结束】\n';

        // 2. 新逻辑：按表拆分 (SYSTEM 完整单词 + 强力防重演)
        if (C.tableInj) {
            m.s.slice(0, -1).forEach((sheet, i) => {
                if (sheet.r.length > 0) {
                    const sheetName = sheet.n || `表${i}`;
                    const sheetContent = sheet.txt(i);

                    tableMessages.push({
                        role: 'system',
                        // 1. 名字：保持你要求的 SYSTEM (表名)
                        name: `SYSTEM (${sheetName})`,

                        // 2. 内容：标题改为“已归档”，并加上防重演指令
                        content: `【系统只读数据库：已归档历史 - ${sheetName}】\n(⚠️已归档内容，仅供参考，严禁重演)\n${sheetContent}`,

                        isGaigaiData: true
                    });
                }
            });

            // 兜底 (全空时)
            if (tableMessages.length === 0) {
                tableMessages.push({
                    role: 'system',
                    name: 'SYSTEM (系统提示)',
                    content: '【系统只读数据库】\n（暂无详细记录）',
                    isGaigaiData: true
                });
            }
        }

        // C. 准备提示词 (仅当开关开启时，才准备提示词，因为关了就不应该填表)
        // 逻辑：如果开启了批量填表(autoBackfill)，强制屏蔽实时填表提示词，无论 C.enabled 是什么状态！
        if (C.enabled && !C.autoBackfill && window.Gaigai.PromptManager.get('tablePrompt')) {
            strPrompt = window.Gaigai.PromptManager.resolveVariables(window.Gaigai.PromptManager.get('tablePrompt'), m.ctx());
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
        // 3. ✨✨✨ 核心逻辑：变量扫描与锚点置换 ✨✨✨
        // ============================================================

        const varSmart = '{{MEMORY}}';          // 智能组合 (跟随开关)
        const varSum = '{{MEMORY_SUMMARY}}';    // 强制仅总结
        const varTable = '{{MEMORY_TABLE}}';    // 强制仅表格
        const varPrompt = '{{MEMORY_PROMPT}}';  // 填表规则

        let replacedSmart = false;
        let replacedPrompt = false;
        let foundAnchor = false;
        let anchorIndex = -1;

        // ✨ 新增：记录各变量的位置索引
        let idxTableVar = -1;      // {{MEMORY_TABLE}} 的位置
        let idxSummaryVar = -1;    // {{MEMORY_SUMMARY}} 的位置
        let idxSmartVar = -1;      // {{MEMORY}} 的位置

        // ✅ 1. 判定提示词管理 (Prompt Manager) 开关
        // 只有开启了提示词管理，变量作为锚点才有效；否则视为“开关已关”，忽略变量位置
        let isPromptManagerOn = true;
        if (typeof SillyTavern !== 'undefined' && SillyTavern.power_user) {
            if (SillyTavern.power_user.prompt_manager_enabled === false) isPromptManagerOn = false;
        }

        // ✅ 2. 判定是否启用锚点模式
        // 只要 [提示词管理开启]，就允许使用变量作为锚点
        // 即使开启批量填表(autoBackfill)，也可以通过 {{MEMORY}} 变量控制插入位置
        const allowAnchorMode = isPromptManagerOn;

        // 记录被删除的消息数量，用于修正锚点索引
        let deletedCountBeforeAnchor = 0;

        // ✅ 3. 扫描并清洗变量
        for (let i = 0; i < ev.chat.length; i++) {
            let msgContent = ev.chat[i].content || ev.chat[i].mes || '';
            let modified = false;

            // 处理 {{MEMORY}} (智能变量)
            if (msgContent.includes(varSmart)) {
                // 记录第一次出现的位置
                if (idxSmartVar === -1) {
                    idxSmartVar = i;
                    console.log(`🎯 [变量扫描] 发现 ${varSmart} | 位置: #${i}`);
                }
                // 无论是否启用锚点，都要先把这个变量文本洗掉
                msgContent = msgContent.replace(varSmart, '');

                if (allowAnchorMode) {
                    // 只有允许锚点模式时，才记录这个位置用于后续判断
                    if (anchorIndex === -1) anchorIndex = i;
                    foundAnchor = true;
                } else {
                    console.log(`🧹 [变量扫描] 清洗变量 ${varSmart} | 忽略位置 (开关关或批量模式)`);
                }
                modified = true;
            }

            // 处理 {{MEMORY_SUMMARY}} (总结专属变量)
            if (msgContent.includes(varSum)) {
                if (idxSummaryVar === -1) {
                    idxSummaryVar = i;
                    console.log(`🎯 [变量扫描] 发现 ${varSum} | 位置: #${i}`);
                }
                msgContent = msgContent.replace(varSum, '');
                modified = true;
            }

            // 处理 {{MEMORY_TABLE}} (表格专属变量)
            if (msgContent.includes(varTable)) {
                if (idxTableVar === -1) {
                    idxTableVar = i;
                    console.log(`🎯 [变量扫描] 发现 ${varTable} | 位置: #${i}`);
                }
                msgContent = msgContent.replace(varTable, '');
                modified = true;
            }

            // 处理 {{MEMORY_PROMPT}} (特殊逻辑：根据条件决定锚点替换或清洗)
            if (msgContent.includes(varPrompt)) {
                // 检查是否满足锚点替换条件：提示词存在 且 提示词管理开关已开启
                if (strPrompt && isPromptManagerOn) {
                    // ✅ 条件满足：直接在锚点位置替换为实际提示词内容
                    msgContent = msgContent.replace(varPrompt, strPrompt);
                    replacedPrompt = true; // 标记已处理，阻止后续默认注入

                    // 🎨 UI 增强：标记为提示词消息，使其在 Last Request/Probe 中显示为橙色 PROMPT
                    ev.chat[i].isGaigaiPrompt = true;

                    console.log(`🎯 [锚点替换] 提示词已注入至 {{MEMORY_PROMPT}} 位置`);
                } else {
                    // ⚠️ 条件不满足：仅清空变量文本，不标记为已替换
                    // 这样可以让默认注入逻辑（Step 5）在标准位置注入提示词
                    msgContent = msgContent.replace(varPrompt, '');
                    // 关键：不设置 replacedPrompt = true
                    console.log(`🧹 [变量清洗] {{MEMORY_PROMPT}} 已清空 (将使用默认位置注入)`);
                }
                modified = true;
            }

            // 更新消息内容 & 标记幽灵气泡
            if (modified) {
                ev.chat[i].content = msgContent;
                // 👻 幽灵气泡判定：如果替换后内容为空，标记为待删除
                if (msgContent.trim() === '') {
                    ev.chat[i]._toDelete = true;
                }
            }
        }

        // ✅ 4. 删除幽灵气泡并修正索引
        if (ev.chat.some(msg => msg._toDelete)) {
            ev.chat = ev.chat.filter((msg, index) => {
                const keep = !msg._toDelete;
                // 如果删除了变量位置之前的消息，所有索引需要减 1，保证位置准确
                if (!keep) {
                    if (anchorIndex !== -1 && index < anchorIndex) deletedCountBeforeAnchor++;
                    if (idxSmartVar !== -1 && index < idxSmartVar) idxSmartVar--;
                    if (idxSummaryVar !== -1 && index < idxSummaryVar) idxSummaryVar--;
                    if (idxTableVar !== -1 && index < idxTableVar) idxTableVar--;
                }
                return keep;
            });
            console.log('👻 [清理] 已销毁空的 User 消息对象');
        }

        // 修正锚点位置
        if (anchorIndex !== -1) {
            anchorIndex = anchorIndex - deletedCountBeforeAnchor;
        }

        // ============================================================
        // 4. 执行注入 (独立定位：Summary 和 Table 分别处理)
        // ============================================================

        // 🔧 辅助函数：获取默认插入位置 (Start a new Chat 上方)
        const getDefaultPosition = () => {
            let startChatIndex = -1;
            for (let i = 0; i < ev.chat.length; i++) {
                if (ev.chat[i].role === 'system' && ev.chat[i].content && ev.chat[i].content.includes('[Start a new Chat]')) {
                    startChatIndex = i;
                    break;
                }
            }
            return startChatIndex !== -1 ? startChatIndex : 0; // 兜底：插在最顶端
        };

        // 📋 收集所有插入操作 (格式: { index: number, messages: array, type: string })
        const insertionOps = [];

        // ✨ A. 处理总结消息 (summaryMessages)
        if (summaryMessages.length > 0) {
            let summaryPos = -1;
            let summaryStrategy = '';

            // Priority 1: {{MEMORY_SUMMARY}} 专属变量
            if (idxSummaryVar !== -1) {
                summaryPos = idxSummaryVar;
                summaryStrategy = `⚓ 专属变量 {{MEMORY_SUMMARY}} (位置 #${idxSummaryVar})`;
            }
            // Priority 2: {{MEMORY}} 智能变量 (仅当 Prompt Manager 开启且允许锚点模式)
            else if (allowAnchorMode && idxSmartVar !== -1) {
                summaryPos = idxSmartVar;
                summaryStrategy = `⚓ 智能变量 {{MEMORY}} (位置 #${idxSmartVar})`;
            }
            // Priority 3: 默认位置
            else {
                summaryPos = getDefaultPosition();
                summaryStrategy = `📍 默认位置 (Start a new Chat 前，#${summaryPos})`;
            }

            insertionOps.push({
                index: summaryPos,
                messages: summaryMessages,
                type: 'Summary',
                strategy: summaryStrategy
            });
        }

        // ✨ B. 处理表格消息 (tableMessages)
        if (tableMessages.length > 0) {
            let tablePos = -1;
            let tableStrategy = '';

            // Priority 1: {{MEMORY_TABLE}} 专属变量
            if (idxTableVar !== -1) {
                tablePos = idxTableVar;
                tableStrategy = `⚓ 专属变量 {{MEMORY_TABLE}} (位置 #${idxTableVar})`;
            }
            // Priority 2: {{MEMORY}} 智能变量 (仅当 Prompt Manager 开启且允许锚点模式)
            else if (allowAnchorMode && idxSmartVar !== -1) {
                tablePos = idxSmartVar;
                tableStrategy = `⚓ 智能变量 {{MEMORY}} (位置 #${idxSmartVar})`;
            }
            // Priority 3: 默认位置
            else {
                tablePos = getDefaultPosition();
                tableStrategy = `📍 默认位置 (Start a new Chat 前，#${tablePos})`;
            }

            insertionOps.push({
                index: tablePos,
                messages: tableMessages,
                type: 'Table',
                strategy: tableStrategy
            });
        }

        // ✨ C. 处理提示词 (strPrompt) - 整合进插入队列
        // 注意：提示词如果已经通过 {{MEMORY_PROMPT}} 锚点替换，则 replacedPrompt=true，此处不再执行
        if (strPrompt && !replacedPrompt) {
            const pmtPos = getInjectionPosition(
                window.Gaigai.PromptManager.get('tablePromptPos'),
                window.Gaigai.PromptManager.get('tablePromptPosType'),
                window.Gaigai.PromptManager.get('tablePromptDepth'),
                ev.chat
            );
            const role = getRoleByPosition(window.Gaigai.PromptManager.get('tablePromptPos'));

            insertionOps.push({
                index: pmtPos,
                messages: [{
                    role: role,
                    content: strPrompt,
                    isGaigaiPrompt: true
                }],
                type: 'Prompt',
                strategy: `📝 默认位置 (#${pmtPos})`
            });
        }

        // 🚀 D. 排序并执行插入 (关键：从高到低，防止索引错位)
        // 排序规则：索引从大到小 (Descending)，这样先插后面的，再插前面的，不会影响索引
        insertionOps.sort((a, b) => b.index - a.index);

        insertionOps.forEach(op => {
            ev.chat.splice(op.index, 0, ...op.messages);
            console.log(`📥 [数据注入] ${op.type} | ${op.strategy} | 消息数: ${op.messages.length}`);
        });

        // ✅ E. 兜底日志：如果没有任何注入
        if (insertionOps.length === 0) {
            console.log(`⚠️ [数据注入] 无数据需要注入 (Summary/Table/Prompt 均为空或已处理)`);
        }

        // ============================================================
        // 5. 过滤历史 (适配手机插件)
        // ============================================================
        if (C.filterHistory) {
            // 获取 AI 正在生成的消息的索引。通常是 chat 数组的最后一项（如果 AI 正在说话）
            const lastMessageIndex = ev.chat.length - 1;

            ev.chat.forEach((msg, idx) => { // <-- ✨ 增加 idx 参数
                // 跳过插件自己注入的提示词、数据
                if (msg.isGaigaiPrompt || msg.isGaigaiData || msg.isPhoneMessage) return;

                // ✨✨✨ 核心修复：遇到 System (系统) 消息直接跳过，绝对不清洗！✨✨✨
                if (msg.role === 'system') return;

                // 跳过特定的手机消息格式
                if (msg.content && (msg.content.includes('📱 手机') || msg.content.includes('手机微信消息记录'))) return;

                // ✅✅✅ 关键修复点：
                // 仅清洗 AI 的“历史”回复 (即：不是当前 AI 正在生成的那条消息)
                // 这样可以确保 AI 当前正在输出的带有 <Memory> 标签的内容不会被提前清除
                if ((msg.role === 'assistant' || !msg.is_user) && idx !== lastMessageIndex) { // <-- ✨ 修改这一行
                    const fields = ['content', 'mes', 'message', 'text'];
                    fields.forEach(f => {
                        if (msg[f] && typeof msg[f] === 'string') msg[f] = msg[f].replace(MEMORY_TAG_REGEX, '').trim();
                    });
                }
            });
        }

        // ============================================================
        // 6. 最后一道防线：清洗残留的变量名（防止泄漏给 AI）
        // ============================================================
        const varsToClean = ['{{MEMORY}}', '{{MEMORY_SUMMARY}}', '{{MEMORY_TABLE}}', '{{MEMORY_PROMPT}}'];
        if (ev.chat && Array.isArray(ev.chat)) {
            ev.chat.forEach(msg => {
                let c = msg.content || msg.mes || '';
                if (!c) return;

                let modified = false;
                varsToClean.forEach(v => {
                    if (c.includes(v)) {
                        c = c.split(v).join('');
                        modified = true;
                    }
                });

                if (modified) {
                    if (msg.content) msg.content = c;
                    if (msg.mes) msg.mes = c;
                    console.log(`⚠️ [最后防线] 清洗了残留的变量名，防止泄漏给 AI`);
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
        const bg_panel = isDark ? 'rgba(0, 0, 0, 0.25)' : '#fcfcfc';
        const bg_header = UI.c;
        // 输入框：半透明黑，带有磨砂感
        const bg_input = isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.8)';
        const color_text = UI.tc;
        // 边框：稍微亮一点的白色半透明，营造玻璃边缘感
        const color_border = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)';
        const bg_table_wrap = isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)';
        const bg_table_cell = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.5)'; // 单元格极淡
        const bg_edit_focus = isDark ? 'rgba(60, 60, 60, 0.9)' : 'rgba(255, 249, 230, 0.95)';
        const bg_edit_hover = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 251, 240, 0.9)';
        const bg_row_num = isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(200, 200, 200, 0.4)';
        const bg_summarized = isDark ? 'rgba(40, 167, 69, 0.25)' : 'rgba(40, 167, 69, 0.15)';



        const style = `
        /* 1. 字体与重置 */
        #gai-main-pop div, #gai-main-pop p, #gai-main-pop span, #gai-main-pop td, #gai-main-pop th, #gai-main-pop button, #gai-main-pop input, #gai-main-pop select, #gai-main-pop textarea, #gai-main-pop h3, #gai-main-pop h4,
        #gai-edit-pop *, #gai-summary-pop *, #gai-about-pop * {
            font-family: "Segoe UI", Roboto, "Helvetica Neue", "Microsoft YaHei", "微软雅黑", Arial, sans-serif !important;
            line-height: 1.5;
            -webkit-font-smoothing: auto;
            box-sizing: border-box;
            color: ${color_text}; /* 🌙 动态文字颜色 */
            font-size: var(--g-fs, 12px) !important;
        }
        
        #gai-main-pop i, .g-ov i { 
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
        #gai-backfill-pop .g-w,
        #gai-summary-pop .g-w,
        #gai-optimize-pop .g-w,
        #gai-edit-pop .g-w,
        #gai-about-pop .g-w {
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
        .g-row.g-summarized { background-color: ${bg_summarized} !important; }
        .g-row.g-summarized .g-e,
        .g-row.g-summarized .g-n {
            opacity: 0.5 !important;
        }

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

        /* 2. 标题内容盒子：增加 #gai-main-pop 前缀以覆盖全局重置 */
        #gai-main-pop .g-title-box {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            color: ${color_text} !important;
        }

        /* 3. 主标题文字：增加 #gai-main-pop 前缀 */
        #gai-main-pop .g-title-box span:first-child {
            font-size: 18px !important;       /* 增大字号 */
            font-weight: 800 !important;
            letter-spacing: 1px !important;
            color: ${color_text} !important;       /* 强制跟随主题色 */
        }

        /* 4. 版本号标签：增加 #gai-main-pop 前缀 & 强制颜色 */
        #gai-main-pop .g-ver-tag {
            font-size: 12px !important;
            opacity: 0.8 !important;
            font-weight: normal !important;
            background: rgba(0,0,0,0.1) !important;
            padding: 2px 6px !important;
            border-radius: 4px !important;
            color: ${color_text} !important;       /* 强制跟随主题色 */
        }

        /* 修复图标颜色 */
        #gai-about-btn {
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
        
        /* 1. 基础状态：强制背景色和文字颜色 */
        #gai-main-pop input[type="number"], #gai-main-pop input[type="text"], #gai-main-pop input[type="password"], #gai-main-pop select, #gai-main-pop textarea { 
            background: ${bg_input} !important; 
            color: ${color_text} !important; 
            border: 1px solid ${color_border} !important; 
            font-size: var(--g-fs, 12px) !important; 
            border-radius: 4px !important;
            outline: none !important;
            transition: border-color 0.2s, box-shadow 0.2s !important;
        }

        /* 2. 强制锁死 Hover(悬停) 和 Focus(聚焦) 状态 */
        #gai-main-pop input:hover, #gai-main-pop textarea:hover, #gai-main-pop select:hover,
        #gai-main-pop input:focus, #gai-main-pop textarea:focus, #gai-main-pop select:focus {
            background: ${bg_input} !important;
            color: ${color_text} !important;
            border-color: ${UI.c} !important;
            box-shadow: 0 0 0 1px ${UI.c}af !important;
            opacity: 1 !important;
        }

        /* 3. 辅助权重增强 */
        .g-p input[type="number"], .g-p input[type="text"], .g-p select, .g-p textarea { 
            color: ${color_text} !important; 
            background: ${bg_input} !important;
        }
        
        .g-col-num { position: sticky !important; left: 0 !important; z-index: 11 !important; background: ${bg_header} !important; border-right: 1px solid ${color_border} !important; }
        tbody .g-col-num { background: ${bg_row_num} !important; /* 🌙 动态背景 */ z-index: 9 !important; }
        
        .g-tl button, .g-p button { background: ${bg_header} !important; color: ${color_text} !important; border: 1px solid ${color_border} !important; border-radius: 6px !important; padding: 6px 12px !important; font-size: var(--g-fs, 12px) !important; font-weight: 600 !important; cursor: pointer !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; white-space: nowrap !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; }
        
        #gai-main-pop ::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
        #gai-main-pop ::-webkit-scrollbar-thumb { background: ${bg_header} !important; border-radius: 10px !important; }
        #gai-main-pop ::-webkit-scrollbar-thumb:hover { background: ${bg_header} !important; filter: brightness(0.8); }
        
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
            #gai-main-pop textarea, #gai-main-pop input, #gai-main-pop select,
            .g-w textarea, .g-w input, .g-w select,
            #gai-edit-pop textarea, #gai-edit-pop input, #gai-edit-pop select,
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
            #gg_api_config_section,
            #gg_auto_bf_settings,
            #gg_auto_sum_settings {
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
            #gai-backfill-pop .g-w,
            #gai-summary-pop .g-w,
            #gai-optimize-pop .g-w,
            #gai-edit-pop .g-w,
            #gai-about-pop .g-w {
                background: rgba(30, 30, 30, 0.75) !important; /* 与主窗口一致 */
                backdrop-filter: blur(20px) saturate(180%) !important;
            }
            
            /* 配置页面的背景板 */
            #gai-backfill-pop .g-p,
            #gai-summary-pop .g-p,
            #gai-optimize-pop .g-p {
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
        $('#gai-main-pop').remove();
        thm(); // 重新应用样式

        const $o = $('<div>', { id: 'gai-main-pop', class: 'g-ov' });
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
        $('#gai-edit-pop').remove();
        const $o = $('<div>', { id: 'gai-edit-pop', class: 'g-ov', css: { 'z-index': '10000000' } });
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
            // ✅ 修复：始终从数据源读取表格名称，确保结构变化后正确刷新
            const displayName = s.n;
            // ✨ 2. 根据记录的索引设置激活状态
            const isActive = i === activeTabIndex ? ' act' : '';
            return `<button class="g-t${isActive}" data-i="${i}">${displayName} (${count})</button>`;
        }).join('');

        const tls = `
        <div class="g-btn-group">
            <button id="gai-btn-add" title="新增一行">➕ 新增</button>
            <button id="gai-btn-del" title="删除选中行">🗑️ 删除</button>
            <button id="gai-btn-toggle" title="切换选中行的已总结状态">👻 显/隐</button>
            <button id="gai-btn-sum" title="AI智能总结">📝 总结</button>
            <button id="gai-btn-back" title="追溯历史剧情填表">⚡ 追溯</button>
            <button id="gai-btn-export" title="导出JSON备份">📥 导出</button>
            <button id="gai-btn-import" title="从JSON恢复数据">📤 导入</button>
            <button id="gai-btn-view" title="视图设置">📏 视图</button>
            <button id="gai-btn-clean" title="保留总结，清空详情">🧹 清表</button>
            <button id="gai-btn-clear" title="清空所有数据">💥 全清</button>
            <button id="gai-btn-theme" title="设置外观">🎨 主题</button>
            <button id="gai-btn-config" title="插件设置">⚙️ 配置</button>
        </div>
    `;

        const tbls = ss.map((s, i) => gtb(s, i)).join('');

        const cleanVer = V.replace(/^v+/i, '');
        const titleHtml = `
        <div class="g-title-box">
            <span>记忆表格</span>
            <span class="g-ver-tag">v${cleanVer}</span>
            <i id="gai-about-btn" class="fa-solid fa-circle-info"
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
            $('#gai-about-btn').hover(
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
            $('#gai-main-pop .g-row-select, #gai-main-pop .g-select-all').css({
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
     * 渲染笔记本视图（用于最后一个表格，即总结表）
     * @param {Object} sheet - 表格数据对象
     * @param {number} tableIndex - 表格索引
     * @returns {string} - 返回笔记本视图的HTML字符串
     */
    /**
     * 渲染笔记本视图（用于最后一个表格，即总结表）
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
            <div class="g-toc-overlay" id="gai-toc-overlay-${tableIndex}"></div>
            <div class="g-book-toc-panel" id="gai-book-toc-${tableIndex}">
                <div class="g-toc-header">
                    <span>📚 目录导航</span>
                    <button id="gai-toc-close-${tableIndex}" style="background:none;border:none;cursor:pointer;font-size:20px;color:inherit;padding:0;">×</button>
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
        const hiddenStyle = isHidden ? 'opacity: 0.5; position: relative;' : 'position: relative;';
        const watermark = '';

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
                    <input type="number" class="g-book-page-input" id="gai-book-page-jump"
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
        // 判断：如果是最后一个表（总结表），使用笔记本视图
        if (ti === m.s.length - 1) {
            return renderBookUI(s, ti);
        }

        // 其他表格使用原来的表格视图
        const v = ti === 0 ? '' : 'display:none;';
        const hasData = s.r.length > 0; // ✅ Check if table has rows

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

        // ✅ Only show Ops Column Header if there is data
        if (hasData) {
            h += '<th class="g-col-ops"></th>';
        }

        h += '</tr></thead><tbody>'

        // 表格内容
        if (!hasData) {
            // ✅ Fix colspan: RowNum(1) + DataColumns(s.c.length)
            h += `<tr class="g-emp"><td colspan="${s.c.length + 1}">暂无数据</td></tr>`;
        } else {
            // ✅ 倒序显示逻辑：根据 C.reverseView 决定渲染顺序
            const renderRows = () => {
                if (C.reverseView) {
                    // 倒序渲染：从最后一行到第一行
                    for (let ri = s.r.length - 1; ri >= 0; ri--) {
                        renderRow(ri);
                    }
                } else {
                    // 正序渲染：从第一行到最后一行
                    s.r.forEach((rw, ri) => {
                        renderRow(ri);
                    });
                }
            };

            // 渲染单行的函数（保持 data-r 为真实索引）
            const renderRow = (ri) => {
                const rw = s.r[ri];
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

                // ✅ 新增：隐形操作列
                h += `<td class="g-col-ops">
                <div class="g-ops-wrap">
                    <button class="g-btn-op up" data-ti="${ti}" data-r="${ri}">↑</button>
                    <button class="g-btn-op down" data-ti="${ti}" data-r="${ri}">↓</button>
                </div>
            </td>`;

                h += '</tr>';
            };

            // 执行渲染
            renderRows();
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
        $('#gai-main-pop').off('click', '.g-book-prev').on('click', '.g-book-prev', function () {
            const ti = parseInt($(this).data('ti'));
            if (currentBookPage > 0) {
                currentBookPage--;
                refreshBookView(ti);
            }
        });

        // 下一页按钮
        $('#gai-main-pop').off('click', '.g-book-next').on('click', '.g-book-next', function () {
            const ti = parseInt($(this).data('ti'));
            const sheet = m.get(ti);
            if (sheet && currentBookPage < sheet.r.length - 1) {
                currentBookPage++;
                refreshBookView(ti);
            }
        });

        // 笔记本视图内容编辑保存（复用现有的blur保存逻辑）
        $('#gai-main-pop').off('blur', '.g-book-view .g-e[contenteditable="true"]')
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
        $('#gai-main-pop').off('change', '#gai-book-page-jump').on('change', '#gai-book-page-jump', function () {
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
        $('#gai-main-pop').off('keydown', '#gai-book-page-jump').on('keydown', '#gai-book-page-jump', function (e) {
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
        $('#gai-main-pop').off('click', '.g-book-toc-toggle').on('click', '.g-book-toc-toggle', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const ti = parseInt($(this).data('ti'));
            $(`#gai-book-toc-${ti}`).addClass('active');
            $(`#gai-toc-overlay-${ti}`).addClass('active');
        });

        // 2. 关闭目录：点击遮罩层
        $('#gai-main-pop').off('click', '.g-toc-overlay').on('click', '.g-toc-overlay', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const $overlay = $(this);
            const overlayId = $overlay.attr('id');
            const ti = overlayId.replace('gai-toc-overlay-', '');
            $(`#gai-book-toc-${ti}`).removeClass('active');
            $overlay.removeClass('active');
        });

        // 3. 关闭目录：点击关闭按钮
        $('#gai-main-pop').off('click', '[id^="gai-toc-close-"]').on('click', '[id^="gai-toc-close-"]', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const closeId = $(this).attr('id');
            const ti = closeId.replace('gai-toc-close-', '');
            $(`#gai-book-toc-${ti}`).removeClass('active');
            $(`#gai-toc-overlay-${ti}`).removeClass('active');
        });

        // 4. 跳转页面：点击目录项
        $('#gai-main-pop').off('click', '.g-toc-item').on('click', '.g-toc-item', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const targetPage = parseInt($(this).data('page'));
            const ti = parseInt($(this).data('ti'));

            // 更新当前页码
            currentBookPage = targetPage;

            // 刷新笔记本视图
            refreshBookView(ti);

            // 自动关闭目录（移动端体验优化）
            $(`#gai-book-toc-${ti}`).removeClass('active');
            $(`#gai-toc-overlay-${ti}`).removeClass('active');
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
        $('#gai-main-pop').off('click', '.g-select-all').on('click', '.g-select-all', async function (e) {
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

        $('#gai-main-pop').off('change', '.g-row-select').on('change', '.g-row-select', function (e) {
            e.stopPropagation();
            updateSelectedRows();
        });

        function updateSelectedRows() {
            selectedRows = [];
            $('#gai-main-pop .g-tbc:visible .g-row').removeClass('g-selected');
            $('#gai-main-pop .g-tbc:visible .g-row-select:checked').each(function () {
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
        $('#gai-main-pop').off('mousedown touchstart', '.g-col-resizer').on('mousedown touchstart', '.g-col-resizer', function (e) {
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

        $('#gai-main-pop').off('mousedown touchstart', '.g-row-resizer').on('mousedown touchstart', '.g-row-resizer', function (e) {
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
        $('#gai-main-pop').off('dblclick', '.g-e').on('dblclick', '.g-e', function (e) {
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
        $('#gai-main-pop').off('touchstart', '.g-e').on('touchstart', '.g-e', function (e) {
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
        $('#gai-main-pop').off('touchmove touchend touchcancel', '.g-e').on('touchmove touchend touchcancel', '.g-e', function (e) {
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
        $('#gai-main-pop').off('blur', '.g-e').on('blur', '.g-e', function () {
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
        $('#gai-main-pop').off('click', '.g-row').on('click', '.g-row', function (e) {
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
        $('#gai-btn-del').off('click').on('click', async function () {
            if (isDeletingRow) {
                console.log('⚠️ 删除操作进行中，请稍候...');
                return;
            }

            const ti = selectedTableIndex !== null ? selectedTableIndex : parseInt($('.g-t.act').data('i'));
            const sh = m.get(ti);
            if (!sh) return;

            // ✅ 拦截：总结表使用笔记本视图专属删除逻辑
            if (ti === m.s.length - 1) {
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

                        // ✅ 关键：同步更新 summarizedRows（动态索引）
                        if (summarizedRows[ti]) {
                            summarizedRows[ti] = summarizedRows[ti]
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
                        if (summarizedRows[ti]) {
                            summarizedRows[ti] = [];
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
            if (e.key === 'Delete' && (selectedRow !== null || selectedRows.length > 0) && $('#gai-main-pop').length > 0) {
                if ($(e.target).hasClass('g-e') || $(e.target).is('input, textarea')) return;
                $('#gai-btn-del').click();
            }
        });

        // ========== 行移动按钮 (Move Row Up/Down) ==========
        $('#gai-main-pop').off('click', '.g-btn-op').on('click', '.g-btn-op', function (e) {
            e.stopPropagation(); // ✅ 关键：阻止触发行选择

            const $btn = $(this);
            const ti = parseInt($btn.data('ti'));
            const ri = parseInt($btn.data('r'));
            const direction = $btn.hasClass('up') ? -1 : 1;

            const sh = m.get(ti);
            if (!sh) return;

            // 调用 move 方法
            const success = sh.move(ri, direction);
            if (!success) {
                // 无法移动（已在边界）
                if (typeof toastr !== 'undefined') {
                    toastr.warning('无法移动：已在表格边界', '提示', { timeOut: 1000 });
                }
                return;
            }

            // 更新时间戳
            lastManualEditTime = Date.now();

            // 保存数据
            m.save(true);

            // 刷新表格
            refreshTable(ti);

            // ✅ UX增强：刷新后保持选中状态（移动到新位置）
            const newIndex = ri + direction;
            setTimeout(() => {
                const $newRow = $(`.g-tbc[data-i="${ti}"] .g-row[data-r="${newIndex}"]`);
                $newRow.addClass('g-selected');

                // 同步复选框状态
                $newRow.find('.g-row-select').prop('checked', true);

                // 更新 selectedRow 变量
                selectedRow = newIndex;
            }, 50);
        });

        // 新增行
        $('#gai-btn-add').off('click').on('click', async function () {
            const ti = parseInt($('.g-t.act').data('i'));
            const sh = m.get(ti);
            if (!sh) return;

            // ✅ 拦截：总结表使用笔记本视图专属新增逻辑
            if (ti === m.s.length - 1) {
                // 获取当前页码
                const insertAfterPage = currentBookPage;

                // 创建新行
                const nr = {};
                sh.c.forEach((_, i) => nr[i] = '');

                // 在当前页之后插入
                sh.ins(nr, insertAfterPage);

                // ✅ 关键：同步更新 summarizedRows（动态索引）
                // 所有大于 currentBookPage 的索引值加 1（因为插入新页后，后面的行号后移了）
                if (summarizedRows[ti]) {
                    summarizedRows[ti] = summarizedRows[ti].map(ri => {
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

        // ✨✨✨ 新增：导入功能 (使用 IOManager) ✨✨✨
        $('#gai-btn-import').off('click').on('click', async function () {
            if (!window.Gaigai.IOManager || typeof window.Gaigai.IOManager.handleImport !== 'function') {
                console.error('❌ [导入] IOManager 未加载');
                await customAlert('导入模块未加载，请刷新页面重试', '错误');
                return;
            }

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json, .txt, application/json, text/plain';
            input.style.display = 'none';
            document.body.appendChild(input);

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    if (input.parentNode) {
                        document.body.removeChild(input);
                    }
                    return;
                }

                try {
                    // 使用 IOManager 处理导入
                    const data = await window.Gaigai.IOManager.handleImport(file);

                    // 兼容 's' (导出文件) 和 'd' (内部存档) 两种格式
                    const sheetsData = data.s || data.d;

                    if (!sheetsData || !Array.isArray(sheetsData)) {
                        await customAlert('❌ 错误：这不是有效的记忆表格备份文件！\n(找不到数据数组)', '导入失败');
                        return;
                    }

                    // 🔍 智能识别数据结构
                    const sheetCount = sheetsData.length;
                    let importMode = 'full';
                    let confirmMsg = '';
                    const totalTableCount = m.s.length;
                    const dataTableCount = m.s.length - 1;

                    if (sheetCount === totalTableCount) {
                        importMode = 'full';
                        confirmMsg = `📦 检测到完整备份（${totalTableCount} 个表格）\n\n将恢复所有详情表和总结表`;
                    } else if (sheetCount === dataTableCount) {
                        importMode = 'details';
                        confirmMsg = `📊 检测到详情表备份（${dataTableCount} 个表格）\n\n将仅恢复详情表，保留现有总结表`;
                    } else if (sheetCount === 1) {
                        importMode = 'summary';
                        confirmMsg = '📝 检测到总结表备份（1 个表格）\n\n将仅恢复总结表，保留现有详情表';
                    } else {
                        await customAlert(`⚠️ 数据格式异常！\n\n表格数量: ${sheetCount}\n预期: 1、${dataTableCount} 或 ${totalTableCount} 个表格`, '格式错误');
                        return;
                    }

                    const timeStr = data.ts ? new Date(data.ts).toLocaleString() : (data.t ? new Date(data.t).toLocaleString() : '未知时间');
                    const fullConfirmMsg = `⚠️ 确定要导入吗？\n\n${confirmMsg}\n\n📅 备份时间: ${timeStr}\n\n这将覆盖对应的表格内容！`;

                    if (!await customConfirm(fullConfirmMsg, '确认导入')) return;

                    // 开始恢复（根据模式智能恢复）
                    if (importMode === 'full') {
                        // 检查备份文件是否包含表格结构信息
                        const hasStructureInfo = sheetsData.every(sheet =>
                            sheet && typeof sheet === 'object' && sheet.n && Array.isArray(sheet.c)
                        );

                        if (hasStructureInfo) {
                            console.log('📋 [导入] 检测到表格结构信息，开始重塑表格结构...');

                            const newCustomTables = [];
                            for (let i = 0; i < sheetsData.length; i++) {
                                const sheet = sheetsData[i];
                                if (sheet && sheet.n && Array.isArray(sheet.c)) {
                                    newCustomTables.push({
                                        n: sheet.n,
                                        c: sheet.c
                                    });
                                }
                            }

                            if (newCustomTables.length > 0) {
                                C.customTables = newCustomTables;
                                console.log(`✅ [导入] 已更新表格结构配置（${newCustomTables.length} 个数据表）`);

                                try {
                                    localStorage.setItem('gg_config', JSON.stringify(C));
                                    console.log('💾 [导入] 表格结构已保存到 localStorage');
                                } catch (e) {
                                    console.error('❌ [导入] localStorage 保存失败:', e);
                                }

                                try {
                                    m.initTables(sheetsData, false);
                                    console.log('🔧 [导入] 表格对象已根据备份结构重建');
                                } catch (e) {
                                    console.error('❌ [导入] initTables 失败:', e);
                                    await customAlert('重建表格结构失败: ' + e.message, '错误');
                                    return;
                                }

                                if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                                    window.Gaigai.saveAllSettingsToCloud().catch(err => {
                                        console.warn('⚠️ [导入] 云端同步失败:', err);
                                    });
                                    console.log('☁️ [导入] 已触发云端同步');
                                }
                            }
                        } else {
                            console.log('⚠️ [导入] 未检测到表格结构信息，使用传统填充方式');
                        }

                        console.log('🔄 [导入] 正在填充表格数据...');
                        m.s.forEach((sheet, i) => {
                            if (sheetsData[i]) {
                                sheet.from(sheetsData[i]);
                            }
                        });
                        console.log('✅ [导入] 数据填充完毕');

                    } else if (importMode === 'details') {
                        for (let i = 0; i < m.s.length - 1 && i < sheetsData.length; i++) {
                            if (sheetsData[i]) m.s[i].from(sheetsData[i]);
                        }
                    } else if (importMode === 'summary') {
                        const summaryIndex = m.s.length - 1;
                        if (sheetsData[0] && m.s[summaryIndex]) {
                            m.s[summaryIndex].from(sheetsData[0]);
                        }
                    }

                    if (data.summarized) summarizedRows = data.summarized;

                    // 强制保存并刷新
                    lastManualEditTime = Date.now();
                    m.save();
                    shw();

                    let successMsg = '✅ 导入成功！\n\n';
                    if (importMode === 'full') {
                        successMsg += '已恢复：所有详情表 + 总结表';
                    } else if (importMode === 'details') {
                        successMsg += `已恢复：所有数据表 (0-${dataTableCount - 1})\n保留：现有总结表`;
                    } else if (importMode === 'summary') {
                        successMsg += '已恢复：总结表\n保留：现有详情表';
                    }
                    await customAlert(successMsg, '完成');

                    updateCurrentSnapshot();

                } catch (err) {
                    await customAlert('❌ 读取文件失败: ' + err.message, '错误');
                } finally {
                    if (input.parentNode) {
                        document.body.removeChild(input);
                    }
                }
            };

            input.value = '';
            input.click();
        });

        $('#gai-btn-sum').off('click').on('click', () => {
            if (window.Gaigai.SummaryManager && typeof window.Gaigai.SummaryManager.showUI === 'function') {
                window.Gaigai.SummaryManager.showUI();
            } else {
                console.error('❌ [总结控制台] SummaryManager 未加载');
                customAlert('总结控制台未加载，请刷新页面重试', '错误');
            }
        });

        $('#gai-btn-export').off('click').on('click', function () {
            if (window.Gaigai.IOManager && typeof window.Gaigai.IOManager.showExportUI === 'function') {
                window.Gaigai.IOManager.showExportUI();
            } else {
                console.error('❌ [导出] IOManager 未加载');
                customAlert('导出模块未加载，请刷新页面重试', '错误');
            }
        });
        $('#gai-btn-view').off('click').on('click', showViewSettings);
        // ✅✅✅ [升级版] 清空表格（带指针控制选项）
        $('#gai-btn-clean').off('click').on('click', function () {
            const hasSummary = m.sm.has();
            const tableCount = m.all().length - 1; // 排除总结表

            // 1. 准备弹窗样式变量
            const isDark = UI.darkMode;
            const bgColor = isDark ? '#1e1e1e' : '#fff';
            const txtColor = isDark ? '#e0e0e0' : UI.tc;
            const borderColor = isDark ? 'rgba(255,255,255,0.15)' : '#ddd';

            // 2. 创建弹窗 DOM
            const id = 'clear-options-' + Date.now();
            const $overlay = $('<div>', {
                id: id,
                css: {
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.6)', zIndex: 10000020,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }
            });

            const $box = $('<div>', {
                css: {
                    background: bgColor, color: txtColor,
                    borderRadius: '12px', padding: '24px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.4)', width: '400px', maxWidth: '90vw',
                    border: '1px solid ' + borderColor,
                    display: 'flex', flexDirection: 'column', gap: '12px'
                }
            });

            // 3. 提示文案
            let tipText = `⚠️ <strong>确定要清空 ${tableCount} 个详细表格吗？</strong><br><br>`;
            if (hasSummary) {
                tipText += `<span style="color:#28a745">✅ 记忆总结将会保留</span><br>`;
            }
            tipText += `此操作将永久删除详情表内容。<br><br>请选择对<strong>【批量填表进度指针】</strong>的处理方式：`;

            $box.append(`<div style="font-size:16px; font-weight:bold; margin-bottom:4px;">🧹 清空表格选项</div>`);
            $box.append(`<div style="font-size:13px; opacity:0.9; line-height:1.5;">${tipText}</div>`);

            // 4. 定义执行函数
            const executeClear = async (resetPointer) => {
                // A. 清空数据表
                m.all().slice(0, -1).forEach(s => s.clear());
                clearSummarizedMarks();
                lastManualEditTime = Date.now();

                // B. 处理指针
                let msg = '';
                if (resetPointer) {
                    API_CONFIG.lastBackfillIndex = 0;
                    msg = '✅ 表格已清空，进度指针已重置为 0。';
                } else {
                    // 保持原样
                    msg = `✅ 表格已清空，进度指针保留在第 ${API_CONFIG.lastBackfillIndex} 层。`;
                }

                // C. 保存配置和数据
                try { localStorage.setItem(AK, JSON.stringify(API_CONFIG)); } catch (e) { }

                // 同步到云端 (保存配置变更)
                if (typeof saveAllSettingsToCloud === 'function') {
                    await saveAllSettingsToCloud();
                }

                // 强制保存数据到当前会话 (支持会话隔离)
                m.save(true);

                // D. 刷新界面
                $overlay.remove();
                if (typeof shw === 'function') shw();

                if (typeof toastr !== 'undefined') toastr.success(msg);
                else alert(msg);
            };

            // 5. 按钮组
            // 按钮A：保留指针 (推荐用于清理已总结内容)
            const $btnKeep = $('<button>', {
                html: '📉 <strong>保留进度 (仅清数据)</strong><br><span style="font-size:10px; opacity:0.8">适合清理旧数据，AI 将继续往后填表</span>',
                css: {
                    padding: '10px', border: 'none', borderRadius: '6px',
                    background: '#17a2b8', color: '#fff', cursor: 'pointer', textAlign: 'left'
                }
            }).click(() => executeClear(false));

            // 按钮B：重置指针 (完全重开)
            const $btnReset = $('<button>', {
                html: '🔄 <strong>完全重置 (清数据+归零)</strong><br><span style="font-size:10px; opacity:0.8">适合想要彻底重新开始追溯</span>',
                css: {
                    padding: '10px', border: 'none', borderRadius: '6px',
                    background: '#dc3545', color: '#fff', cursor: 'pointer', textAlign: 'left'
                }
            }).click(() => executeClear(true));

            // 按钮C：取消
            const $btnCancel = $('<button>', {
                text: '取消',
                css: {
                    padding: '10px', border: '1px solid ' + borderColor, borderRadius: '6px',
                    background: 'transparent', color: txtColor, cursor: 'pointer'
                }
            }).click(() => $overlay.remove());

            $box.append($btnKeep, $btnReset, $btnCancel);
            $overlay.append($box);
            $('body').append($overlay);
        });

        // ✅✅ 修改：全部清空（含总结）
        $('#gai-btn-clear').off('click').on('click', async function () {
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
                data: m.all().slice(0, -1).map(sh => JSON.parse(JSON.stringify(sh.json()))), // 只保存数据表
                summarized: {},
                timestamp: 0
            };

            console.log('💥 [全清执行] 所有数据已销毁，无法回档。');

            await customAlert('✅ 所有数据已清空（包括总结）', '完成');

            $('#gai-main-pop').remove();
            shw();
        });
        $('#gai-btn-theme').off('click').on('click', () => navTo('主题设置', shtm));
        $('#gai-btn-back').off('click').on('click', () => navTo('⚡ 剧情追溯填表', () => window.Gaigai.BackfillManager.showUI()));
        $('#gai-btn-config').off('click').on('click', () => navTo('配置', shcf));

        // ✨✨✨ 修改：移除显隐操作的成功弹窗，只刷新表格 ✨✨✨
        // ✨✨✨ 新增：显/隐按钮逻辑（含总结表专属弹窗） ✨✨✨
        $('#gai-btn-toggle').off('click').on('click', async function () {
            const ti = selectedTableIndex !== null ? selectedTableIndex : parseInt($('.g-t.act').data('i'));
            const sh = m.get(ti);

            // 0. 空表拦截
            if (!sh || sh.r.length === 0) {
                await customAlert('⚠️ 当前表格没有任何数据，无法执行显/隐操作。', '无数据');
                return;
            }

            // ✅ 分支 A：总结表专属操作面板
            if (ti === m.s.length - 1) {
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

                // 获取当前主题状态，定义动态颜色变量
                const isDark = UI.darkMode;
                const dialogBg = isDark ? '#1e1e1e' : '#fff';
                const borderColor = isDark ? 'rgba(255,255,255,0.2)' : '#ddd';
                const inputBg = isDark ? '#2a2a2a' : '#fff';
                const btnBg = UI.c; // 按钮背景跟随表头颜色
                const btnColor = UI.tc; // 按钮文字跟随全局字体颜色

                const $box = $('<div>', {
                    css: {
                        background: dialogBg, color: UI.tc, borderRadius: '12px', padding: '20px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                        width: '320px', maxWidth: '90vw', // ✨ 手机端自适应宽度
                        display: 'flex', flexDirection: 'column', gap: '10px'
                    }
                });

                const currentPageNum = currentBookPage + 1; // 转为人类可读的页码
                const totalPages = sh.r.length;
                const isCurrentHidden = isSummarized(ti, currentBookPage);

                $box.append(`<div style="font-weight:bold; font-size:15px; text-align:center; color:${UI.tc};">👁️ 总结显/隐控制</div>`);
                $box.append(`<div style="font-size:12px; color:${UI.tc}; opacity:0.6; text-align:center; margin-bottom:5px;">当前：第 ${currentPageNum} / ${totalPages} 篇</div>`);

                // 按钮样式对象：使用 UI.c 和 UI.tc 跟随表头颜色和全局字体色
                const btnCss = {
                    padding: '10px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: btnColor,
                    fontWeight: '600',
                    textAlign: 'left',
                    paddingLeft: '15px',
                    background: btnBg
                };

                // 1. 切换当前页
                const $btnCurrent = $('<button>', {
                    html: isCurrentHidden ? '👁️ 显示当前页 (第' + currentPageNum + '篇)' : '🙈 隐藏当前页 (第' + currentPageNum + '篇)',
                    css: btnCss
                }).on('click', () => {
                    toggleRow(ti, currentBookPage);
                    finish(`第 ${currentPageNum} 篇状态已切换`);
                });

                // 2. 隐藏/显示所有
                const $btnAll = $('<button>', {
                    html: '📚 将所有页面设为【隐藏/已归档】',
                    css: btnCss
                }).on('click', () => {
                    if (!summarizedRows[ti]) summarizedRows[ti] = [];
                    summarizedRows[ti] = Array.from({ length: totalPages }, (_, k) => k);
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
                        border: '1px solid ' + borderColor,
                        borderRadius: '6px',
                        fontSize: '12px',
                        boxSizing: 'border-box',
                        background: inputBg,
                        color: UI.tc
                    }
                });
                const $rangeBtn = $('<button>', {
                    text: '执行',
                    css: {
                        flex: '0 0 auto', // ✨ 按钮不伸缩
                        padding: '6px 12px', // ✨ 减小内边距
                        background: btnBg,
                        color: btnColor,
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
                    css: {
                        padding: '8px',
                        background: 'transparent',
                        border: '1px solid ' + borderColor,
                        borderRadius: '6px',
                        color: UI.tc,
                        opacity: '0.7',
                        marginTop: '5px',
                        cursor: 'pointer'
                    }
                }).on('click', () => $overlay.remove());

                // --- 辅助逻辑 ---
                function toggleRow(ti, ri) {
                    if (!summarizedRows[ti]) summarizedRows[ti] = [];
                    const idx = summarizedRows[ti].indexOf(ri);
                    if (idx > -1) summarizedRows[ti].splice(idx, 1);
                    else summarizedRows[ti].push(ri);
                }

                function processRange(str) {
                    if (!summarizedRows[ti]) summarizedRows[ti] = [];
                    const parts = str.split(/[,，]/);
                    let count = 0;
                    parts.forEach(p => {
                        if (p.includes('-')) {
                            const [s, e] = p.split('-').map(Number);
                            if (!isNaN(s) && !isNaN(e)) {
                                for (let i = s; i <= e; i++) {
                                    if (i > 0 && i <= totalPages) {
                                        if (!summarizedRows[ti].includes(i - 1)) {
                                            summarizedRows[ti].push(i - 1);
                                            count++;
                                        }
                                    }
                                }
                            }
                        } else {
                            const idx = parseInt(p);
                            if (!isNaN(idx) && idx > 0 && idx <= totalPages) {
                                if (!summarizedRows[ti].includes(idx - 1)) {
                                    summarizedRows[ti].push(idx - 1);
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
                    const renderBookUI = window.Gaigai.renderBookUI || (function () { }); // 防止未引用
                    // 重新渲染当前页
                    if ($('.g-t.act').data('i') === ti) {
                        refreshTable(ti); // 使用 refreshTable 刷新
                    }
                    $overlay.remove();
                    if (typeof toastr !== 'undefined') toastr.success(msg);
                }

                $box.append($btnCurrent, $btnAll, $rangeArea, $cancelBtn);
                $overlay.append($box);
                $('body').append($overlay);
                return;
            }

            // ✅ 分支 B: 普通表格（所有非总结表）的原有逻辑
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
                // ✅ 批量显隐操作面板（当没有选中任何行时）
                const id = 'batch-toggle-dialog-' + Date.now();
                const $overlay = $('<div>', {
                    id: id,
                    css: {
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        width: '100vw', height: '100vh',
                        background: 'rgba(0,0,0,0.5)', zIndex: 10000020,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }
                });

                // 获取当前主题状态，定义动态颜色变量
                const isDark = UI.darkMode;
                const dialogBg = isDark ? '#1e1e1e' : '#fff';
                const borderColor = isDark ? 'rgba(255,255,255,0.2)' : '#ddd';
                const btnColor = UI.tc; // 按钮文字跟随全局字体颜色

                const $box = $('<div>', {
                    css: {
                        background: dialogBg, color: UI.tc, borderRadius: '12px', padding: '20px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                        width: '320px', maxWidth: '90vw',
                        display: 'flex', flexDirection: 'column', gap: '12px'
                    }
                });

                const totalRows = sh.r.length;

                $box.append(`<div style="font-weight:bold; font-size:15px; text-align:center; color:${UI.tc};">👻 批量显隐操作</div>`);
                $box.append(`<div style="font-size:12px; color:${UI.tc}; opacity:0.6; text-align:center; margin-bottom:5px;">当前表格共 ${totalRows} 行</div>`);

                // 按钮样式对象
                const btnCss = {
                    padding: '12px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    textAlign: 'center'
                };

                // 1. 全部显示按钮（白色/浅色背景）
                const $btnShowAll = $('<button>', {
                    html: '👻 全部显示 (白色)',
                    css: {
                        ...btnCss,
                        background: isDark ? '#3a3a3a' : '#f5f5f5',
                        color: UI.tc
                    }
                }).on('click', () => {
                    // 清空隐藏列表
                    if (summarizedRows[ti]) {
                        summarizedRows[ti] = [];
                    }
                    finish('所有行已设为显示');
                });

                // 2. 全部隐藏按钮（绿色背景）
                const $btnHideAll = $('<button>', {
                    html: '👻 全部隐藏 (绿色)',
                    css: {
                        ...btnCss,
                        background: '#4caf50',
                        color: '#fff'
                    }
                }).on('click', () => {
                    // 将所有行索引加入隐藏列表
                    if (!summarizedRows[ti]) summarizedRows[ti] = [];
                    summarizedRows[ti] = Array.from({ length: totalRows }, (_, k) => k);
                    finish('所有行已设为隐藏');
                });

                // 3. 取消按钮
                const $cancelBtn = $('<button>', {
                    text: '取消',
                    css: {
                        padding: '10px',
                        background: 'transparent',
                        border: '1px solid ' + borderColor,
                        borderRadius: '6px',
                        color: UI.tc,
                        opacity: '0.7',
                        cursor: 'pointer'
                    }
                }).on('click', () => $overlay.remove());

                // 完成函数
                function finish(msg) {
                    saveSummarizedRows();
                    m.save(true);
                    refreshTable(ti);
                    $overlay.remove();
                    if (typeof toastr !== 'undefined') toastr.success(msg);
                }

                $box.append($btnShowAll, $btnHideAll, $cancelBtn);
                $overlay.append($box);
                $('body').append($overlay);
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
        document.getElementById('gai-main-pop').offsetHeight;

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

        // Data清洗：System -> User (兼容性处理)
        let rawMessages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: String(prompt) }];

        // ✨✨✨ 修复：现代模型（OpenAI/Claude/Gemini/Deepseek）都原生支持 system 角色
        // 强制转为 User 会导致 Gemini 在长上下文中触发安全拦截或空回
        const preserveSystem = provider === 'openai' || provider === 'deepseek' || provider === 'claude' || provider === 'gemini' || provider === 'siliconflow' || provider === 'proxy_only' || provider === 'compatible';

        const cleanMessages = rawMessages.map(m => {
            // 如果允许保留 system 且当前是 system，直接返回原样
            if (preserveSystem && m.role === 'system') {
                return { role: 'system', content: m.content };
            }
            // 否则才转为 User（针对老旧本地模型）
            return {
                role: m.role === 'system' ? 'user' : m.role,
                content: m.role === 'system' ? ('[System]: ' + m.content) : m.content
            };
        });

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
        const useProxy = (provider === 'local' || provider === 'openai' || provider === 'claude' || provider === 'proxy_only' || provider === 'deepseek' || provider === 'siliconflow' || provider === 'compatible' || provider === 'gemini');
        let useDirect = false;
        // ==========================================
        // 🔴 通道 A: 后端代理 (local, openai, claude, proxy_only)
        // ==========================================
        if (useProxy) {
            try {
                console.log('📡 [后端代理模式] 通过酒馆后端发送请求...');

                // 获取 CSRF Token
                let csrfToken = '';
                try { csrfToken = await getCsrfToken(); } catch (e) { console.warn('⚠️ CSRF获取失败', e); }

                // 🟢Gemini 官方专用通道 (Makersuite 协议)
                if (provider === 'gemini') {
                    console.log('🔧 [Gemini] 使用 MakerSuite 协议走酒馆后端...');
                    const proxyPayload = {
                        chat_completion_source: "makersuite", // 核心：告诉酒馆这是谷歌
                        proxy_password: apiKey,
                        model: model,
                        messages: cleanMessages,
                        temperature: temperature,
                        max_tokens: maxTokens,
                        stream: false,
                        // 🛡️ 强力注入安全设置，防止空回
                        safety_settings: [
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
                            // 尝试解析各种可能的返回格式
                            const data = JSON.parse(text);
                            if (typeof data === 'string') return { success: true, summary: data };
                            if (data.choices?.[0]?.message?.content) return { success: true, summary: data.choices[0].message.content };
                            if (data.content) return { success: true, summary: data.content };
                            // 通用解析兜底
                            return parseApiResponse(data);
                        } catch (e) {
                            // 如果不是JSON，可能是纯文本，直接返回
                            if (text && text.length > 0) return { success: true, summary: text };
                        }
                    }
                    const errText = await proxyResponse.text();
                    throw new Error(`酒馆后端报错: ${errText.substring(0, 100)}`);
                }

                // 只有当：提供商是"网页反代" (proxy_only) 且 模型名含"gemini"时，才走 Makersuite 修复路
                // ✨ 修复：排除本地地址 (127.0.0.1/localhost)。
                // 如果用户用 gcli 等本地转接工具，应该走下面的通用 OpenAI/Custom 协议，那里有完善的安全注入。
                const isProxyGemini = (provider === 'proxy_only') &&
                    model.toLowerCase().includes('gemini') &&
                    !apiUrl.includes('127.0.0.1') &&
                    !apiUrl.includes('localhost');

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
                        // ✅ 标准 Gemini 格式
                        safetySettings: [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                        ]
                    };

                    // ✨ [双重保险] 同时注入 OpenAI 格式的安全设置
                    // 防止某些魔改的 Makersuite 反代其实底层是 OpenAI 接口
                    proxyPayload.safety_settings = proxyPayload.safetySettings;
                    proxyPayload.gemini_safety_settings = proxyPayload.safetySettings;

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

                    // === 智能分流修复 (V1.3.9 核心修正) ===

                    // 1. 确定模式 (Source)
                    // 抓包显示：兼容端点(compatible)、反代(proxy_only)、本地(local) 必须走 'custom' 模式
                    // 只有 OpenAI 官方/DeepSeek/SiliconFlow 等才走 'openai' 模式
                    let targetSource = 'openai';
                    if (provider === 'claude') targetSource = 'claude';

                    // ✨ 修复：把 compatible 移出 custom 组。
                    // 只有纯反代(proxy_only)和本地(local)才走 custom。
                    // compatible (兼容端点) 保持默认的 'openai' 模式，这样酒馆才会正确处理 Key。
                    if (provider === 'proxy_only' || provider === 'local') targetSource = 'custom';

                    // 2. URL 清洗
                    // OpenAI 模式会自动加 /chat/completions，如果用户填了要剪掉
                    // Custom 模式则原样保留，不做处理
                    let cleanBaseUrl = apiUrl;
                    if (targetSource === 'openai' && cleanBaseUrl.endsWith('/chat/completions')) {
                        cleanBaseUrl = cleanBaseUrl.replace(/\/chat\/completions\/?$/, '');
                    }

                    // 3. 构建完全复刻酒馆行为的 Payload
                    const proxyPayload = {
                        chat_completion_source: targetSource,

                        // 关键修复：Custom 模式依赖 custom_url，OpenAI 模式依赖 reverse_proxy
                        // 我们两个都填上，酒馆后端会各取所需，确保万无一失
                        reverse_proxy: cleanBaseUrl,
                        custom_url: apiUrl,

                        // OpenAI 模式用这个传 Key
                        proxy_password: apiKey,

                        // Custom 模式用这个传 Key (通过 Header 注入)
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

                        // 1. 先定义好配置对象 (关键！不然下面赋值会报错)
                        const safetyConfig = [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
                        ];

                        // 2. 暴力注入：把所有可能的字段名都填上
                        // 根据你的测试 A，gemini_safety_settings 是最关键的
                        proxyPayload.gemini_safety_settings = safetyConfig;

                        // 兼容其他可能的情况
                        proxyPayload.safety_settings = safetyConfig;
                        proxyPayload.safetySettings = safetyConfig;
                    }

                    // 4. 动态鉴权头处理 (关键修复！)
                    // 源码证实：Custom模式下，酒馆后端不读取 proxy_password，只从 custom_include_headers 合并
                    // 所以我们必须手动把 Key 塞进 Header 里，否则请求会报 401/403
                    if (authHeader) {
                        proxyPayload.custom_include_headers["Authorization"] = authHeader;
                        console.log('🔑 [后端代理] Authorization Header 已注入 (适配 Custom 模式)');
                    } else {
                        console.log('🔓 [后端代理] 跳过 Authorization Header (无密码)');
                    }

                    console.log(`🌐 [后端代理] 目标: ${apiUrl} | 模式: ${targetSource} | 模型: ${model}`);

                    const proxyResponse = await fetch('/api/backends/chat-completions/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(proxyPayload)
                    });

                    // 1. 检查成功状态
                    if (proxyResponse.ok) {
                        const data = await proxyResponse.json();
                        const result = parseApiResponse(data);
                        if (result.success) {
                            // ✨✨✨ Fallback 保护：如果清洗后内容为空，检查原始数据
                            if (result.summary && result.summary.trim()) {
                                const rawSummary = result.summary;
                                let cleaned = result.summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

                                // 针对截断情况的额外清洗（如果思考没闭合）
                                cleaned = cleaned.replace(/<think>[\s\S]*/gi, '').trim();

                                // 如果清洗后为空，但原始内容不为空，则保留原始内容
                                if (!cleaned && rawSummary.trim().length > 0) {
                                    console.warn('⚠️ [后端代理清洗] 清洗后内容为空（AI仅输出了思考内容），触发回退保护，保留原文');
                                    result.summary = rawSummary;
                                } else {
                                    result.summary = cleaned;
                                    if (rawSummary.length !== cleaned.length) {
                                        console.log(`🧹 [后端代理清洗] 已移除 <think> 标签，清洗前: ${rawSummary.length} 字符，清洗后: ${cleaned.length} 字符`);
                                    }
                                }
                            }
                            console.log('✅ [后端代理] 成功');
                            return result;
                        }
                        throw new Error('后端返回数据无法解析');
                    }

                    // 2. 处理错误
                    const errText = await proxyResponse.text();
                    const s = proxyResponse.status;
                    let statusTip = '';

                    // 翻译错误码
                    if (s === 400) statusTip = ' (请求格式错误/参数不对)';
                    else if (s === 401) statusTip = ' (未授权/API Key无效)';
                    else if (s === 403) statusTip = ' (禁止访问/鉴权失败)';
                    else if (s === 404) statusTip = ' (酒馆后端路由不存在)';
                    else if (s === 500) statusTip = ' (酒馆内部报错/Python脚本崩溃)';
                    else if (s === 502) statusTip = ' (网关错误/上游API无响应)';
                    else if (s === 504) statusTip = ' (后端处理超时/卡死)';
                    else statusTip = ' (未知网络错误)';

                    // 注意引号是反引号 ` `
                    console.warn(`⚠️ [后端代理失败] ${s}${statusTip}: ${errText.substring(0, 200)}`);

                    throw new Error(`酒馆后端请求失败 ${s}${statusTip}: ${errText.substring(0, 100)}`);

                }

            } catch (e) {
                console.error(`❌ [后端代理] 失败: ${e.message}`);

                // 自动降级逻辑
                if (provider === 'compatible' || provider === 'openai' || provider === 'gemini') {
                    console.warn('⚠️ [自动降级] 后端代理失败，正在尝试浏览器直连...');
                    useDirect = true;
                } else {
                    return {
                        success: false,
                        error: `后端代理失败: ${e.message}\n\n💡 提示：检查 API 地址和密钥是否正确`
                    };
                }
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
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
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

                    // ✨ 翻译错误码 (直连模式)
                    let statusTip = '';
                    if (directResponse.status === 502) statusTip = ' (服务商网关错误/挂了)';
                    else if (directResponse.status === 504) statusTip = ' (请求超时)';
                    else if (directResponse.status === 401) statusTip = ' (API密钥无效)';
                    else if (directResponse.status === 404) statusTip = ' (接口地址错误)';
                    else if (directResponse.status === 429) statusTip = ' (请求太快被限流)';

                    // 👇 这一行也必须用反引号 ` `，不要改动！
                    throw new Error(`直连请求失败 ${directResponse.status}${statusTip}: ${errText.substring(0, 200)}`);
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
                                            console.log('💠 [DeepSeek] 检测到 reasoning_content，长度:', reasoningContent.length);
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
                        console.log(`💠 [流式模式] 累积思考长度: ${fullReasoning.length} 字符`);

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
                        // 防止 DeepSeek/Gemini 在 content 里混合输出了思考标签
                        if (fullText) {
                            const rawText = fullText; // 备份一份原始数据
                            let cleaned = fullText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

                            // 针对截断情况的额外清洗（如果思考没闭合）
                            cleaned = cleaned.replace(/<think>[\s\S]*/gi, '').trim();

                            // ✨✨✨ 核心修复：如果清洗后变为空（说明全都是思考内容），则回退到原文
                            // 这样虽然格式不对，但至少不会报“空内容”错误，用户能看到思考过程
                            if (!cleaned && rawText.trim().length > 0) {
                                console.warn('⚠️ [流式清洗] 清洗后内容为空（AI仅输出了思考内容），触发回退保护，保留原文');
                                fullText = rawText;
                            } else {
                                fullText = cleaned;

                                const beforeClean = rawText.length;
                                const afterClean = fullText.length;
                                if (beforeClean !== afterClean) {
                                    console.log(`🧹 [清洗完成] 已移除 <think> 标签，清洗前: ${beforeClean} 字符，清洗后: ${afterClean} 字符`);
                                }
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

                // ========================================
                // 3️⃣ 最终校验与返回 (防空回增强版)
                // ========================================
                
                // 1. 优先返回正常的正文
                if (fullText && fullText.trim()) {
                    console.log('✅ [浏览器直连] 成功（流式）！长度:', fullText.length);
                    return {
                        success: true,
                        summary: fullText.trim()
                    };
                }

                // 2. ✨✨✨ 核心修复：如果正文为空，但有思考内容，拿思考内容救急！✨✨✨
                // (针对 DeepSeek R1 或 Gemini 2.0 Flash Thinking 等推理模型)
                if (typeof fullReasoning !== 'undefined' && fullReasoning && fullReasoning.trim()) {
                    console.warn('⚠️ [流式兼容] 正文为空，降级返回思考内容 (Reasoning Content)');
                    return {
                        success: true,
                        summary: fullReasoning.trim()
                    };
                }

                // 3. 💀 真·空回 (抛出原始错误供弹窗显示)
                console.error('❌ [流式失败] 接收到的完整包体:', fullText);
                throw new Error(`Error: Stream response content is empty.\n\nContent Length: ${fullText.length}\nReasoning Length: ${typeof fullReasoning !== 'undefined' ? fullReasoning.length : 0}`);


            } catch (e) {
                console.error('❌ [浏览器直连] 失败:', e);

                // 返回原始错误信息
                return {
                    success: false,
                    error: e.message // 原始错误信息
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
                        skip_save: true,

                        // 🛡️ 纯净模式：关闭所有干扰项
                        include_world_info: false,
                        include_jailbreak: false,
                        include_character_card: false,
                        include_names: false,

                        // ✅ 使用用户配置的 max_tokens，避免挤爆上下文窗口
                        max_tokens: API_CONFIG.maxTokens || 8192,
                        length: API_CONFIG.maxTokens || 8192,

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
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
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

                // 移除思考过程 (带回退保护)
                if (summary && summary.includes('<think>')) {
                    const raw = summary;
                    const cleaned = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                    // 如果清洗后为空，保留原文
                    summary = cleaned || raw;
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
            <input type="checkbox" id="gg_ui_dark_mode" ${UI.darkMode ? 'checked' : ''} style="width:20px; height:20px; cursor:pointer;">
        </div>

        <label>主题色（按钮、表头）：</label>
        <input type="color" id="gg_theme_color" value="${UI.c}" style="width:100%; height:40px; border-radius:4px; border:1px solid #ddd; cursor:pointer;">
        <br><br>

        <label>字体颜色（文字）：</label>
        <input type="color" id="gg_theme_text_color" value="${UI.tc || '#ffffff'}" style="width:100%; height:40px; border-radius:4px; border:1px solid #ddd; cursor:pointer;">
        <br><br>

        <label style="display:flex; justify-content:space-between;">
            <span>字体大小 (全局)：</span>
            <span id="gg_fs_val" style="font-weight:bold; color:${UI.c}">${UI.fs}px</span>
        </label>
        <input type="range" id="gg_theme_fontsize" min="10" max="24" step="1" value="${UI.fs}"
            oninput="document.getElementById('gg_fs_val').innerText = this.value + 'px'; document.documentElement.style.setProperty('--g-fs', this.value + 'px');"
            style="width:100%; cursor:pointer; margin-top:5px;">

        <div style="font-size:10px; color:#333; opacity:0.6; margin-top:4px;">拖动滑块实时调整表格文字大小</div>

        <div style="margin-top: 15px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 10px;">
            <label style="font-weight: 600; display:block; margin-bottom:5px;">📖 总结本背景图 (DIY)</label>

            <!-- 预览区域 -->
            <div id="gg_bg_preview" style="width: 100%; height: 60px; background: #eee; border-radius: 6px; margin-bottom: 8px; background-size: cover; background-position: center; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;">
                ${UI.bookBg ? '' : '暂无背景，使用默认纸张'}
            </div>

            <div style="display: flex; gap: 5px;">
                <input type="text" id="gg_bg_url" placeholder="输入图片 URL..." style="flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
                <button id="gg_btn_clear_bg" style="padding: 5px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">🗑️</button>
            </div>

            <div style="margin-top: 5px; display: flex; align-items: center; gap: 8px;">
                 <label for="gg_bg_file" style="cursor: pointer; background: #17a2b8; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; display: inline-block;">📂 选择本地图片</label>
                 <input type="file" id="gg_bg_file" accept="image/*" style="display: none;">
                 <span style="font-size: 10px; color: #666;">(建议 < 1MB)</span>
            </div>
        </div>
        <br>

        <div style="background:rgba(255,255,255,0.6); padding:10px; border-radius:4px; font-size:10px; margin-bottom:12px; color:#333333; border:1px solid rgba(0,0,0,0.1);">
            <strong>💡 提示：</strong><br>
            • 如果主题色较浅，请将字体颜色设为深色（如黑色）<br>
            • 字体过大可能会导致表格内容显示不全，请酌情调整
        </div>

        <button id="gg_save_theme" style="padding:8px 16px; width:100%; margin-bottom:10px;">💾 保存</button>
        <button id="gg_reset_theme" style="padding:8px 16px; width:100%; background:#6c757d;">🔄 恢复默认</button>
    </div>`;

        pop('🎨 主题设置', h, true);

        // 强制初始化一次变量，防止打开时没有生效
        document.documentElement.style.setProperty('--g-fs', UI.fs + 'px');

        setTimeout(() => {
            // ✅ 🌙 夜间模式切换事件 (带记忆功能)
            $('#gg_ui_dark_mode').off('change').on('change', function () {
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
                $('#gg_theme_color').val(UI.c);
                $('#gg_theme_text_color').val(UI.tc);

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

                if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                    window.Gaigai.saveAllSettingsToCloud().catch(err => { });
                }
            });

            // ✅ 这里的绑定作为双重保险
            // 使用 document 代理事件，确保一定能抓到元素
            $(document).off('input', '#gg_theme_fontsize').on('input', '#gg_theme_fontsize', function () {
                const val = $(this).val();
                $('#gg_fs_val').text(val + 'px');
                // 同时更新 html 和 body，防止某些主题覆盖
                document.documentElement.style.setProperty('--g-fs', val + 'px');
                document.body.style.setProperty('--g-fs', val + 'px');
            });

            // ========================================
            // 📖 背景图设置事件绑定
            // ========================================

            // 初始化预览
            if (UI.bookBg) {
                $('#gg_bg_preview').css('background-image', `url("${UI.bookBg}")`).text('');
            }

            // 1. 本地文件上传 (转 Base64)
            $('#gg_bg_file').on('change', function (e) {
                const file = e.target.files[0];
                if (!file) return;

                if (file.size > 2 * 1024 * 1024) { // 2MB 限制
                    alert('图片太大了！建议使用小于 2MB 的图片，否则可能导致卡顿。');
                    return;
                }

                const reader = new FileReader();
                reader.onload = function (evt) {
                    const base64 = evt.target.result;
                    $('#gg_bg_preview').css('background-image', `url("${base64}")`).text('');
                    UI.bookBg = base64; // 暂存到内存对象
                };
                reader.readAsDataURL(file);
            });

            // 2. URL 输入
            $('#gg_bg_url').on('input', function () {
                const url = $(this).val();
                if (url) {
                    $('#gg_bg_preview').css('background-image', `url("${url}")`).text('');
                    UI.bookBg = url;
                }
            });

            // 3. 清除按钮
            $('#gg_btn_clear_bg').on('click', function () {
                UI.bookBg = '';
                $('#gg_bg_preview').css('background-image', '').text('已清除，使用默认');
                $('#gg_bg_url').val('');
                $('#gg_bg_file').val('');
            });

            // ========================================
            // 保存按钮（同时保存所有主题设置包括背景图）
            // ========================================
            $('#gg_save_theme').off('click').on('click', async function () {
                UI.c = $('#gg_theme_color').val();
                UI.tc = $('#gg_theme_text_color').val();
                UI.fs = parseInt($('#gg_theme_fontsize').val());
                UI.darkMode = $('#gg_ui_dark_mode').is(':checked'); // ✅ 保存夜间模式状态
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
            $('#gg_reset_theme').off('click').on('click', async function () {
                const isCurrentNight = $('#gg_ui_dark_mode').is(':checked');
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
                $('#gg_ui_dark_mode').prop('checked', UI.darkMode);
                $('#gg_theme_color').val(UI.c);
                $('#gg_theme_text_color').val(UI.tc);
                $('#gg_theme_fontsize').val(12);
                $('#gg_fs_val').text('12px');

                $('#gg_bg_preview').css('background-image', '').text('暂无背景，使用默认纸张');
                $('#gg_bg_url').val('');
                $('#gg_bg_file').val('');

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
            <label><input type="radio" name="gg_api_mode" value="tavern" ${!API_CONFIG.useIndependentAPI ? 'checked' : ''}> 使用酒馆API（默认）</label>
            <br>
            <label><input type="radio" name="gg_api_mode" value="independent" ${API_CONFIG.useIndependentAPI ? 'checked' : ''}> 使用独立API</label>
        </fieldset>

        <fieldset id="api-config-section" style="border:1px solid #ddd; padding:10px; border-radius:4px; margin-bottom:12px; ${API_CONFIG.useIndependentAPI ? '' : 'opacity:0.5; pointer-events:none;'}">
            <legend style="font-size:11px; font-weight:600;">独立API配置</legend>

            <label>API提供商：</label>
            <select id="gg_api_provider" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; margin-bottom:10px;">
                <optgroup label="━━━ 后端代理 ━━━">
                    <option value="openai" ${API_CONFIG.provider === 'openai' ? 'selected' : ''}>OpenAI 兼容模式/OpenAI 官方</option>
                    <option value="compatible" ${API_CONFIG.provider === 'compatible' ? 'selected' : ''}>兼容中转/代理</option>
                    <option value="local" ${API_CONFIG.provider === 'local' ? 'selected' : ''}>本地/内网（本地反代）</option>
                    <option value="proxy_only" ${API_CONFIG.provider === 'proxy_only' ? 'selected' : ''}>反代(如build)</option>
                    <option value="claude" ${API_CONFIG.provider === 'claude' ? 'selected' : ''}>Claude 官方</option>
                    <option value="deepseek" ${API_CONFIG.provider === 'deepseek' ? 'selected' : ''}>DeepSeek 官方</option>
                    <option value="siliconflow" ${API_CONFIG.provider === 'siliconflow' ? 'selected' : ''}>硅基流动 (SiliconFlow)</option>
                    <option value="gemini" ${API_CONFIG.provider === 'gemini' ? 'selected' : ''}>Google Gemini 官方</option>
                </optgroup>
                <optgroup label="━━━ 浏览器直连 ━━━">
                    <!-- 之前在这里，现在空了或者留着备用 -->
                </optgroup>
            </select>

            <label>API地址 (Base URL)：</label>
            <input type="text" id="gg_api_url" name="gg_api_url_history" autocomplete="on" value="${API_CONFIG.apiUrl}" placeholder="例如: https://api.openai.com/v1" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:10px;">
            <div style="font-size:10px; color:${UI.tc}; opacity:0.7; margin-top:4px; margin-bottom:10px;">
                不行？在 URL 末尾添加 <code style="background:rgba(0,0,0,0.1); padding:1px 4px; border-radius:3px; font-family:monospace;">/v1</code> 试试！
                <code style="background:rgba(0,0,0,0.1); padding:1px 4px; border-radius:3px; font-family:monospace;">/chat/completions</code> 后缀会自动补全。
            </div>

            <label>API密钥 (Key)：</label>
            <div style="position: relative; margin-bottom: 10px;">
                <input type="password" id="gg_api_key" name="gg_api_key_history" autocomplete="on" value="${API_CONFIG.apiKey}" placeholder="sk-..." style="width:100%; padding:5px 30px 5px 5px; border:1px solid #ddd; border-radius:4px; font-size:10px;">
                <i id="gg_toggle_key_btn" class="fa-solid fa-eye" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--g-tc); opacity: 0.6;" title="显示/隐藏密钥"></i>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label style="margin:0;">模型名称：</label>
                <span id="gg_fetch_models_btn" style="cursor:pointer; font-size:10px; color:${UI.tc}; border:1px solid ${UI.c}; padding:1px 6px; border-radius:3px; background:rgba(127,127,127,0.1);">🔄 拉取模型列表</span>
            </div>

            <input type="text" id="gg_api_model" name="gg_api_model_history" autocomplete="on" value="${API_CONFIG.model}" placeholder="gpt-3.5-turbo" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:10px; margin-bottom:10px;">
            <select id="gg_api_model_select" style="display:none; width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:10px; margin-bottom:10px;"></select>

            <label>最大输出长度 (Max Tokens)：</label>
            <input type="number" id="gg_api_max_tokens" value="${API_CONFIG.maxTokens || 8192}" placeholder="DeepSeek填8192，Gemini填65536" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:10px; margin-bottom:10px;">

        </fieldset>

        <div style="display:flex; gap:10px;">
            <button id="gg_save_api" style="flex:1; padding:6px 12px; background:${UI.c}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;">💾 保存设置</button>
            <button id="gg_test_api" style="flex:1; padding:6px 12px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;" ${API_CONFIG.useIndependentAPI ? '' : 'disabled'}>🧪 测试连接</button>
        </div>
    </div>`;

        pop('🤖 AI总结配置', h, true);
        window.isEditingConfig = true; // 标记开始编辑配置，防止后台同步覆盖用户输入

        setTimeout(() => {

            // === 新增：小眼睛切换功能 ===
            $('#gg_toggle_key_btn').off('click').on('click', function () {
                const $input = $('#gg_api_key');
                const $icon = $(this);
                if ($input.attr('type') === 'password') {
                    $input.attr('type', 'text');
                    $icon.removeClass('fa-eye').addClass('fa-eye-slash');
                } else {
                    $input.attr('type', 'password');
                    $icon.removeClass('fa-eye-slash').addClass('fa-eye');
                }
            });

            $('input[name="gg_api_mode"]').on('change', function () {
                const isIndependent = $(this).val() === 'independent';
                if (isIndependent) {
                    $('#api-config-section').css({ 'opacity': '1', 'pointer-events': 'auto' });
                    $('#gg_test_api').prop('disabled', false);
                } else {
                    $('#api-config-section').css({ 'opacity': '0.5', 'pointer-events': 'none' });
                    $('#gg_test_api').prop('disabled', true);
                }
            });

            $('#gg_api_provider').on('change', function () {
                const provider = $(this).val();

                // ✅ 核心修改：只修改 placeholder (提示文字)，绝不自动填充 val (实际值)
                // 这样用户必须手动填入地址，不会误以为已经填好了。

                // 先清空当前的 placeholder，防止残留
                $('#gg_api_url').attr('placeholder', '请输入 API 地址 (Base URL)...');
                $('#gg_api_model').attr('placeholder', '请输入模型名称...');

                if (provider === 'local') {
                    // local 模式
                    $('#gg_api_url').attr('placeholder', '例如: http://127.0.0.1:7860/v1');
                    $('#gg_api_model').attr('placeholder', '例如: gpt-3.5-turbo');
                } else if (provider === 'proxy_only') {
                    // 独立反代
                    $('#gg_api_url').attr('placeholder', '例如: http://127.0.0.1:8889/v1');
                    $('#gg_api_model').attr('placeholder', '例如: gemini-2.5-pro');
                } else if (provider === 'compatible') {
                    // 兼容端点
                    $('#gg_api_url').attr('placeholder', '例如: https://api.xxx.com/v1');
                    $('#gg_api_model').attr('placeholder', '例如: gpt-4o, deepseek-chat');
                } else if (provider === 'openai') {
                    // OpenAI
                    $('#gg_api_url').attr('placeholder', '例如: https://api.openai.com/v1');
                    $('#gg_api_model').attr('placeholder', '例如: gpt-4o');
                } else if (provider === 'deepseek') {
                    // DeepSeek
                    $('#gg_api_url').attr('placeholder', '例如: https://api.deepseek.com/v1');
                    $('#gg_api_model').attr('placeholder', '例如: deepseek-chat');
                } else if (provider === 'siliconflow') {
                    // 硅基流动
                    $('#gg_api_url').attr('placeholder', '例如: https://api.siliconflow.cn/v1');
                    $('#gg_api_model').attr('placeholder', '例如: deepseek-ai/DeepSeek-V3');
                } else if (provider === 'gemini') {
                    // Gemini
                    $('#gg_api_url').attr('placeholder', '例如: https://generativelanguage.googleapis.com/v1beta');
                    $('#gg_api_model').attr('placeholder', '例如: gemini-1.5-flash');
                } else if (provider === 'claude') {
                    // Claude
                    $('#gg_api_url').attr('placeholder', '例如: https://api.anthropic.com/v1/messages');
                    $('#gg_api_model').attr('placeholder', '例如: claude-3-5-sonnet-20241022');
                }
            });

            // ✨✨✨ 智能拉取模型 (鉴权修复版) ✨✨✨
            $('#gg_fetch_models_btn').off('click').on('click', async function () {
                const btn = $(this);
                const originalText = btn.text();
                btn.text('拉取中...').prop('disabled', true);

                // ========================================
                // 1. 获取参数 - 直接从 DOM 读取当前输入框的值
                // ========================================
                let apiUrl = ($('#gg_api_url').val() || '').trim().replace(/\/+$/, '');
                let apiKey = ($('#gg_api_key').val() || '').trim();

                // ✅ 核心修复：提前构造鉴权头 (Bearer sk-...)
                // 这一点是之前漏掉的，导致部分中转站不认账
                let authHeader = undefined;
                if (apiKey) {
                    authHeader = apiKey.startsWith('Bearer ') ? apiKey : ('Bearer ' + apiKey);
                }

                const provider = $('#gg_api_provider').val();

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
                // 3. 封装后端代理逻辑 (修复 Header 问题 & 独立地址隔离)
                // ========================================
                const runProxyRequest = async () => {
                    console.log('📡 [后端代理] 正在通过酒馆后端转发请求...');
                    const csrfToken = await getCsrfToken();

                    // 1. 先判断目标源
                    let targetSource = 'custom';
                    // 只有官方 OpenAI/DeepSeek/SiliconFlow 才走 openai 模式 (酒馆自动处理鉴权)
                    if (provider === 'openai' || provider === 'deepseek' || provider === 'siliconflow') {
                        targetSource = 'openai';
                    }

                    // 2. 构造 Headers
                    const customHeaders = {
                        "Content-Type": "application/json"
                    };

                    // 3. 【关键修改】鉴权逻辑分离
                    // 只有在 'custom' 模式下，我们才手动把 Key 塞进 Header
                    // 如果是 'openai' 模式，酒馆会自动读取 proxy_password 生成 Header，我们不要插手，防止冲突
                    if (targetSource === 'custom' && authHeader) {
                        customHeaders["Authorization"] = authHeader;
                    }

                    const proxyPayload = {
                        chat_completion_source: targetSource,
                        custom_url: apiUrl,       // custom 模式下生效
                        reverse_proxy: apiUrl,    // openai 模式下生效

                        // openai 模式：酒馆读取这个字段
                        proxy_password: apiKey,

                        // custom 模式：酒馆读取这个字段里面的 Authorization
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
                // 4. 执行逻辑 (双通道自动降级版 - 修复 400/500 错误)
                // ========================================
                let proxyErrorMsg = null;

                // --- 阶段一：尝试后端代理 (优先) ---
                // 对于 强制代理组(DeepSeek/OpenAI等) 或 兼容端点，先试酒馆后端转发
                // 这能解决跨域问题，是你目前能用的方式
                if (forceProxy || provider === 'compatible') {
                    try {
                        await runProxyRequest();
                        return; // ✅ 成功则直接结束，不往下走了
                    } catch (e) {
                        console.warn(`⚠️ [自动降级] 后端代理请求失败: ${e.message}，正在尝试浏览器直连...`);
                        // 记录错误信息，但不弹窗，继续往下走，去试阶段二
                        proxyErrorMsg = e.message;
                    }
                }

                // --- 阶段二：尝试浏览器直连 (备用/救命稻草) ---
                // 场景：如果上面的代理没跑(Gemini)，或者跑了但失败了(DeepSeek 400错误)，走这里
                // 这一步会绕过酒馆后端，直接从浏览器发请求，解决因酒馆版本老旧导致的 400 问题
                try {
                    console.log('🌍 [尝试] 浏览器直连模式...');
                    let directUrl = `${apiUrl}/models`;
                    let headers = { 'Content-Type': 'application/json' };

                    // 针对不同厂商处理 Key 和 URL
                    if (provider === 'gemini') {
                        if (apiUrl.includes('googleapis.com')) {
                            directUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                        } else {
                            if (authHeader) headers['Authorization'] = authHeader;
                        }
                    } else {
                        // 兼容端点/DeepSeek/OpenAI 直连
                        // 关键：确保带上 Bearer Token
                        if (authHeader) headers['Authorization'] = authHeader;
                    }

                    const resp = await fetch(directUrl, { method: 'GET', headers: headers });

                    // 如果直连也失败，抛出错误进入 catch
                    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

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
                    // === 最终判决：两个通道都挂了 ===
                    console.error('❌ 拉取失败 (双通道均失败):', directErr);

                    let errorBody = `无法获取模型列表。`;

                    // 只有在后端代理尝试过且失败时，才显示详细对比
                    if (proxyErrorMsg) {
                        errorBody += `\n\n1. 后端代理: ${proxyErrorMsg}`;
                        errorBody += `\n2. 浏览器直连: ${directErr.message}`;
                    } else {
                        errorBody += `\n错误信息: ${directErr.message}`;
                    }

                    if (directErr.message.includes('Failed to fetch')) {
                        errorBody += '\n(可能是跨域 CORS 问题)';
                    }

                    // ✨ 安抚性文案：告诉用户手写也能用
                    errorBody += `\n\n💡 **别担心！这不影响使用。**\n拉取列表只是辅助功能。您可以直接在“模型名称”框中 **手动填写** (例如 deepseek-chat) 并点击保存即可。`;

                    // 使用自定义弹窗而不是简单的 toastr，确保用户能看到解决方法
                    if (typeof customAlert === 'function') {
                        customAlert(errorBody, '⚠️ 拉取失败 (可手动填写)');
                    } else {
                        alert(errorBody);
                    }

                    btn.text(originalText).prop('disabled', false);
                }

                function finish(list) {
                    displayModelSelect(list);
                    toastrOrAlert(`成功获取 ${list.length} 个模型`, '成功', 'success');
                    btn.text(originalText).prop('disabled', false);
                }

                function displayModelSelect(models) {
                    const $select = $('#gg_api_model_select');
                    const $input = $('#gg_api_model');
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

            $('#gg_save_api').on('click', async function () {
                API_CONFIG.useIndependentAPI = $('input[name="gg_api_mode"]:checked').val() === 'independent';
                API_CONFIG.provider = $('#gg_api_provider').val();

                // ✅ URL 清理：去除首尾空格和末尾斜杠，保存干净的 Base URL
                let apiUrl = ($('#gg_api_url').val() || '').trim().replace(/\/+$/, '');
                API_CONFIG.apiUrl = apiUrl;

                API_CONFIG.apiKey = ($('#gg_api_key').val() || '');
                API_CONFIG.model = ($('#gg_api_model').val() || '');
                API_CONFIG.maxTokens = parseInt($('#gg_api_max_tokens').val()) || 8192;
                API_CONFIG.temperature = 0.1;
                API_CONFIG.enableAI = true;
                try { localStorage.setItem(AK, JSON.stringify(API_CONFIG)); } catch (e) { }
                try { localStorage.setItem('gg_timestamp', Date.now().toString()); } catch (e) { }

                // 🌐 使用统一函数保存全量配置到服务端 (支持跨设备同步)
                await saveAllSettingsToCloud();

                // ✅✅✅ [双重备份] 将 API_CONFIG 同步到角色卡元数据
                m.save();
                console.log('✅ [API配置保存] 已同步到角色卡元数据');

                await customAlert('✅ API配置已保存\n\n输出长度将根据模型自动优化', '成功');
            });

            $('#gg_test_api').on('click', async function () {
                const testAPIWithRetry = async () => {
                    const btn = $(this);
                    const originalText = btn.text();

                    // ========================================
                    // 1. 直接从 DOM 读取当前输入框的值
                    // ========================================
                    let currentUrl = ($('#gg_api_url').val() || '').trim().replace(/\/+$/, '');
                    let currentKey = ($('#gg_api_key').val() || '').trim();
                    const currentModel = ($('#gg_api_model').val() || '').trim();
                    const currentMaxTokens = parseInt($('#gg_api_max_tokens').val()) || 8192;
                    const currentProvider = $('#gg_api_provider').val();
                    const currentMode = $('input[name="gg_api_mode"]:checked').val() === 'independent';

                    // 验证必填项
                    if (!currentModel) {
                        await customAlert('请先填写模型名称！', '提示');
                        return;
                    }

                    // 应用原有的 URL 处理逻辑
                    if (currentUrl.includes('0.0.0.0')) {
                        currentUrl = currentUrl.replace(/0\.0\.0\.0/g, '127.0.0.1');
                    }
                    if (typeof processApiUrl === 'function') {
                        currentUrl = processApiUrl(currentUrl, currentProvider);
                    } else {
                        if (currentProvider !== 'gemini' && !currentUrl.includes('/v1') && !currentUrl.includes('/chat')) {
                            currentUrl += '/v1';
                        }
                    }

                    // ========================================
                    // 2. 备份 API_CONFIG 的当前值
                    // ========================================
                    const backup = {
                        apiUrl: API_CONFIG.apiUrl,
                        apiKey: API_CONFIG.apiKey,
                        model: API_CONFIG.model,
                        maxTokens: API_CONFIG.maxTokens,
                        provider: API_CONFIG.provider,
                        useIndependentAPI: API_CONFIG.useIndependentAPI
                    };

                    console.log('🧪 [API测试] 使用配置:', {
                        provider: currentProvider,
                        url: currentUrl,
                        model: currentModel,
                        maxTokens: currentMaxTokens
                    });

                    btn.text('测试中...').prop('disabled', true);

                    try {
                        // ========================================
                        // 3. 临时覆盖 API_CONFIG（仅用于本次测试）
                        // ========================================
                        API_CONFIG.apiUrl = currentUrl;
                        API_CONFIG.apiKey = currentKey;
                        API_CONFIG.model = currentModel;
                        API_CONFIG.maxTokens = currentMaxTokens;
                        API_CONFIG.provider = currentProvider;
                        API_CONFIG.useIndependentAPI = currentMode;

                        const testPrompt = "请简短回复：API连接测试是否成功？";
                        const result = await callIndependentAPI(testPrompt);

                        if (result.success) {
                            await customAlert('✅ API连接成功！\n\n网络通畅。', '成功');
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
                        // ========================================
                        // 4. 还原 API_CONFIG 到测试前的状态
                        // ========================================
                        API_CONFIG.apiUrl = backup.apiUrl;
                        API_CONFIG.apiKey = backup.apiKey;
                        API_CONFIG.model = backup.model;
                        API_CONFIG.maxTokens = backup.maxTokens;
                        API_CONFIG.provider = backup.provider;
                        API_CONFIG.useIndependentAPI = backup.useIndependentAPI;

                        btn.text(originalText).prop('disabled', false);
                    }
                };

                await testAPIWithRetry.call(this);
            });
        }, 100);
    }

    // 按钮点击时，只需保存配置即可。
    // ✅✅✅ [增强版] 配置加载函数：增加防空盾，防止配置被重置
    async function loadConfig() {
        // 1. 防止冲突：如果正在保存或编辑，跳过加载
        if (window.isSavingConfig || window.isEditingConfig) {
            console.log('⏸️ [配置同步] 正在编辑或保存，跳过加载');
            return;
        }

        console.log('🔄 [配置同步] 开始拉取云端配置...');

        let serverData = null;
        let localTimestamp = 0;

        // 2. 读取本地缓存 (作为兜底)
        try {
            const ts = localStorage.getItem('gg_timestamp');
            if (ts) localTimestamp = parseInt(ts);
        } catch (e) { }

        // 3. 强制从服务器获取 (加时间戳破除缓存)
        try {
            const csrf = await getCsrfToken();
            const res = await fetch('/api/settings/get?t=' + Date.now(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
                body: JSON.stringify({})
            });

            if (res.ok) {
                const raw = await res.json();
                const parsed = typeof parseServerSettings === 'function' ? parseServerSettings(raw) : raw;
                serverData = parsed?.extension_settings?.st_memory_table;
            }
        } catch (e) {
            console.warn('⚠️ [配置同步] 网络请求失败，将使用本地缓存:', e);
        }

        // ================= 🛡️ 核心防御：空数据拦截 🛡️ =================
        // 如果服务器返回 null，或者 config 对象不存在，说明数据损坏或未初始化。
        // 此时绝对不能应用，否则会把本地配置重置为出厂默认！
        if (!serverData || !serverData.config || Object.keys(serverData.config).length === 0) {
            if (localTimestamp > 0) {
                console.warn('🛑 [配置防御] 云端数据为空或无效，拦截重置！保持本地配置。');
                return; // 直接结束，保护现有配置
            } else {
                console.log('✨ [配置同步] 云端无数据且本地无缓存，初始化默认配置');
                // 只有在本地也是全新的情况下，才允许使用默认值
            }
        }
        // ===============================================================

        const serverTimestamp = (serverData && serverData.lastModified) ? serverData.lastModified : 0;
        let useServerData = false;

        // 4. 决策逻辑：只有当云端数据有效 且 (本地无数据 或 云端更新) 时，才应用
        if (serverData && serverData.config) {
            if (localTimestamp === 0) {
                console.log('✨ [配置同步] 新设备/无缓存，应用云端配置');
                useServerData = true;
            } else if (serverTimestamp > localTimestamp) {
                console.log(`📥 [配置同步] 发现新版本 (Cloud:${serverTimestamp} > Local:${localTimestamp})`);
                useServerData = true;
            } else {
                console.log('✅ [配置同步] 本地配置已是最新');
            }
        }

        if (useServerData) {
            // 应用配置
            if (serverData.config) Object.assign(C, serverData.config);

            // 保护 API 进度指针
            if (serverData.api) {
                const currentSumIdx = API_CONFIG.lastSummaryIndex;
                const currentBfIdx = API_CONFIG.lastBackfillIndex;
                const currentSumSrc = API_CONFIG.summarySource; // ✅ 新增备份：保护总结来源（会话独立配置）

                Object.assign(API_CONFIG, serverData.api);

                // 恢复运行时指针（防止云端旧指针覆盖本地新进度）
                if (currentSumIdx !== undefined && currentSumIdx > (serverData.api.lastSummaryIndex || 0)) {
                    API_CONFIG.lastSummaryIndex = currentSumIdx;
                }
                if (currentBfIdx !== undefined && currentBfIdx > (serverData.api.lastBackfillIndex || 0)) {
                    API_CONFIG.lastBackfillIndex = currentBfIdx;
                }

                // ✅ 新增恢复：恢复总结来源（防止全局配置覆盖当前会话的独立设置）
                if (currentSumSrc !== undefined) {
                    API_CONFIG.summarySource = currentSumSrc;
                    console.log(`🔒 [会话隔离] 已保护当前会话的总结来源设置: ${currentSumSrc}`);
                }
            }

            if (serverData.ui) Object.assign(UI, serverData.ui);

            // 同步预设
            if (serverData.profiles && window.Gaigai.PromptManager) {
                window.Gaigai.PromptManager.saveProfilesData(serverData.profiles);
            }

            // 写入本地缓存
            localStorage.setItem('gg_config', JSON.stringify(C));
            localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
            localStorage.setItem('gg_ui', JSON.stringify(UI));
            localStorage.setItem('gg_timestamp', serverTimestamp.toString());

            // 刷新UI状态 (解决多端读取时信息隐藏的问题)
            if (typeof thm === 'function') thm();
            if (typeof hideMemoryTags === 'function') setTimeout(hideMemoryTags, 300);

            console.log('✅ [配置同步] 同步完成');
        }

        // 🔥 [核心修复] 向量库已迁移至世界书存储,不再从 settings.json 加载旧数据
        // 我们只需要确保 VM 解锁即可
        if (window.Gaigai.VM && typeof window.Gaigai.VM.loadLibrary === 'function') {
            // 移除从 serverData 加载的逻辑,防止覆盖最新的 World Info 数据
            if (!window.Gaigai.VM.isDataLoaded) {
                window.Gaigai.VM.loadLibrary(null); // 仅解锁,不覆盖
            }
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
        if (!C || Object.keys(C).length < 5) { // 简单校验 C 对象是否包含足够多的键
            console.error('🛑 [严重拦截] 检测到本地配置异常(为空或不完整)，已阻止上传，防止覆盖云端存档！');
            if (typeof toastr !== 'undefined') toastr.error('本地配置异常，已阻止云端同步以保护存档', '安全拦截');
            return;
        }
        try {
            console.log('💾 [API] 开始保存配置到服务器...');

            // 1. Gather Data
            const cleanedApiConfig = JSON.parse(JSON.stringify(API_CONFIG));
            delete cleanedApiConfig.lastSummaryIndex;
            delete cleanedApiConfig.lastBackfillIndex;

            // 🛡️ [数据保护] 向量库数据已迁移到世界书存储，不再保存到 settings.json
            // 强制设为空对象，防止旧数据污染配置文件
            const currentLibrary = {};

            const allSettings = {
                config: C,
                api: cleanedApiConfig,
                ui: UI,
                profiles: window.Gaigai.PromptManager.getProfilesData(),  // ✅ 保存预设数据
                vectorLibrary: currentLibrary,  // ✅ 强制为空，向量数据已使用世界书存储
                lastModified: Date.now()  // ✅ 添加时间戳用于防止冲突
            };

            console.log('🔒 [进度隔离] 已移除角色专属进度，仅保存通用配置');
            console.log(`⏰ [时间戳] 保存时间: ${new Date(allSettings.lastModified).toLocaleString()}`);
            console.log(`📚 [向量库] 保存书架数据: ${Object.keys(currentLibrary).length} 本书`);

            // ✅✅✅ 乐观保存策略：立即更新本地状态，不等待网络请求
            // 这样用户点击保存瞬间，本地数据即刻更新，防止网络延迟期间切换会话导致读取旧数据
            if (!window.extension_settings) window.extension_settings = {};
            window.extension_settings.st_memory_table = allSettings;
            localStorage.setItem(CK, JSON.stringify(C));
            localStorage.setItem(AK, JSON.stringify(API_CONFIG));
            localStorage.setItem(UK, JSON.stringify(UI));
            // ❌ 已删除：localStorage.setItem(PK, JSON.stringify(PROMPTS));
            // ✅ 预设数据现在由 PromptManager 管理，通过 profiles 保存

            // ✅ 关键修复：更新 serverData.lastModified，防止后续 loadConfig 误判回滚
            if (!window.serverData) window.serverData = {};
            window.serverData.lastModified = allSettings.lastModified;
            console.log(`✅ [乐观保存] 本地状态已立即更新，时间戳: ${new Date(allSettings.lastModified).toLocaleString()}`);

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

            console.log('✅ [API] 配置已强制写入 settings.json (Size:', JSON.stringify(allSettings).length, ')');
            // ✅ UX Improvement: Silent background sync (no toastr popup)
            // User gets feedback from manual button clicks, not from auto-save

        } catch (error) {
            console.error('❌ [API] 保存失败:', error);
            if (typeof toastr !== 'undefined') toastr.error(`保存失败: ${error.message}`, '错误');
        }
    }

    async function shcf() {
        //  🛡️ 设置恢复标志，防止在配置面板打开过程中触发保存
        isRestoringSettings = true;
        console.log('🔒 [配置面板] 已设置 isRestoringSettings = true，阻止自动保存');

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
                <input type="checkbox" id="gg_c_enabled" ${C.enabled ? 'checked' : ''} style="transform: scale(1.2);">
            </div>
            
            <hr style="border: 0; border-top: 1px dashed rgba(0,0,0,0.1); margin: 5px 0 8px 0;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                    <label style="font-weight: 600; display:block;">⚡ 批量填表</label>
                    <span style="font-size:10px; opacity:0.7;">每隔N层填表 (建议配置独立API)</span>
                </div>
                <input type="checkbox" id="gg_c_auto_bf" ${C.autoBackfill ? 'checked' : ''} style="transform: scale(1.2);">
            </div>
            
            <div id="gg_auto_bf_settings" style="font-size: 11px; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px; margin-bottom: 5px; ${C.autoBackfill ? '' : 'display:none;'}">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <span>每</span>
                    <input type="number" id="gg_c_auto_bf_floor" value="${C.autoBackfillFloor || 10}" min="2" style="width:70px; text-align:center; padding:2px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    <span>层触发一次</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; padding-left:8px; border-left:2px solid rgba(255,152,0,0.3);">
                    <input type="checkbox" id="gg_c_auto_bf_delay" ${C.autoBackfillDelay ? 'checked' : ''} style="margin:0;">
                    <label for="gg_c_auto_bf_delay" style="cursor:pointer; display:flex; align-items:center; gap:4px; margin:0;">
                        <span>⏱️ 延迟启动</span>
                    </label>
                    <span style="opacity:0.7;">|</span>
                    <span style="opacity:0.8;">滞后</span>
                    <input type="number" id="gg_c_auto_bf_delay_count" value="${C.autoBackfillDelayCount || 5}" min="1" style="width:70px; text-align:center; padding:2px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    <span style="opacity:0.8;">层再执行</span>
                </div>
                <div style="background: rgba(33, 150, 243, 0.08); border: 1px solid rgba(33, 150, 243, 0.2); border-radius: 4px; padding: 8px; margin-bottom: 6px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #1976d2; font-size: 10px;">🔔 发起模式</div>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 2px;">
                        <input type="checkbox" id="gg_c_auto_bf_prompt" ${C.autoBackfillPrompt ? 'checked' : ''}>
                        <span>🤫 触发前静默发起 (直接执行)</span>
                    </label>
                    <div style="font-size: 9px; color: #666; margin-left: 20px;">未勾选时弹窗确认</div>
                </div>
                <div style="background: rgba(76, 175, 80, 0.08); border: 1px solid rgba(76, 175, 80, 0.2); border-radius: 4px; padding: 8px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #388e3c; font-size: 10px;">✅ 完成模式</div>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 2px;">
                        <input type="checkbox" id="gg_c_auto_bf_silent" ${C.autoBackfillSilent ? 'checked' : ''}>
                        <span>🤫 完成后静默保存 (不弹结果窗)</span>
                    </label>
                    <div style="font-size: 9px; color: ${UI.tc}; opacity:0.7; margin-left: 20px;">未勾选时弹窗显示填表结果</div>
                </div>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <label style="font-weight: 600;">✂️ 隐藏楼层</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px;">留</span>
                    <input type="number" id="gg_c_limit_count" value="${C.contextLimitCount}" min="5" style="width: 70px; text-align: center; border-radius: 4px; border:1px solid rgba(0,0,0,0.2);">
                    <input type="checkbox" id="gg_c_limit_on" ${C.contextLimit ? 'checked' : ''}>
                </div>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.92); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="font-weight: 600;">
                    💉 注入记忆表格
                    <i class="fa-solid fa-circle-info" id="gg_memory_injection_info" style="margin-left: 6px; color: #17a2b8; cursor: pointer; font-size: 14px;"></i>
                </label>
                <input type="checkbox" id="gg_c_table_inj" ${C.tableInj ? 'checked' : ''} style="transform: scale(1.2);">
            </div>

            <div style="font-size: 11px; opacity: 0.8; margin-bottom: 4px;">👇 默认策略 (当未找到 {{MEMORY}} 变量时)：</div>

            <div style="background: rgba(0,0,0,0.03); padding: 10px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.1); font-size: 11px; color: ${UI.tc}; opacity: 0.8; line-height: 1.6;">
                <i class="fa-solid fa-circle-info" style="color: #17a2b8;"></i>
                表格内容将作为 <strong>系统 (System)</strong> 消息，自动插入到 <strong>聊天记录 (Chat History)</strong> 的最上方（紧挨在 [Start a new Chat] 之前）。
                <br><br>
                💡 如需改变位置（例如移动到世界书下方），请在酒馆的【预设/世界书】中手动插入 <code>{{MEMORY}}</code> 变量。
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="font-weight: 600;">🤖 自动总结</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px;">每</span>
                    <input type="number" id="gg_c_auto_floor" value="${C.autoSummaryFloor}" min="10" style="width: 70px; text-align: center; border-radius: 4px; border:1px solid rgba(0,0,0,0.2);">
                    <span style="font-size: 11px;">层</span>
                    <input type="checkbox" id="gg_c_auto_sum" ${C.autoSummary ? 'checked' : ''} style="transform: scale(1.2);">
                </div>
            </div>

            <div id="gg_auto_sum_settings" style="padding: 8px; background: rgba(0,0,0,0.03); border-radius: 4px; ${C.autoSummary ? '' : 'display:none;'}">
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

                <!-- 🆕 表格选择区域（仅在"仅表格"模式下显示） -->
                <div id="gg_auto_sum_table_selector" style="background: rgba(76, 175, 80, 0.08); border: 1px solid rgba(76, 175, 80, 0.2); border-radius: 6px; padding: 10px; margin-bottom: 8px; ${API_CONFIG.summarySource === 'table' ? '' : 'display:none;'}">
                    <div style="font-weight: 600; margin-bottom: 6px; color: #388e3c; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                        <span>🎯 选择要总结的表格：</span>
                        <div style="display: flex; gap: 6px;">
                            <button type="button" id="gg_auto_sum_select_all" style="padding: 2px 8px; background: rgba(76, 175, 80, 0.2); color: #388e3c; border: 1px solid rgba(76, 175, 80, 0.4); border-radius: 3px; cursor: pointer; font-size: 10px;">全选</button>
                            <button type="button" id="gg_auto_sum_deselect_all" style="padding: 2px 8px; background: rgba(0, 0, 0, 0.05); color: #666; border: 1px solid rgba(0, 0, 0, 0.2); border-radius: 3px; cursor: pointer; font-size: 10px;">全不选</button>
                        </div>
                    </div>

                    <!-- ✨ 使用新的 CSS 类名 gg-choice-grid -->
                    <div class="gg-choice-grid">
                        ${(() => {
                            const dataTables = m.s.slice(0, -1);
                            const selectedTables = C.autoSummaryTargetTables || [];
                            return dataTables.map((sheet, i) => {
                                const rowCount = sheet.r ? sheet.r.length : 0;
                                const tableName = sheet.n || `表${i}`;
                                const isChecked = selectedTables.length === 0 || selectedTables.includes(i);

                                // ✨ 使用新的卡片结构
                                return `
                                    <label class="gg-choice-card" title="${tableName}">
                                        <input type="checkbox" class="gg-auto-sum-table-select" value="${i}" ${isChecked ? 'checked' : ''}>
                                        <span class="gg-choice-name">${tableName}</span>
                                        <span class="gg-choice-badge">${rowCount}行</span>
                                    </label>
                                `;
                            }).join('');
                        })()}
                    </div>

                    <div style="font-size: 10px; color: ${UI.tc}; opacity: 0.6; margin-top: 8px; padding-left: 2px;">
                        💡 默认全选，可手动勾选参与自动总结的表格
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; padding-left:8px; border-left:2px solid rgba(255,152,0,0.3); font-size:11px;">
                    <input type="checkbox" id="gg_c_auto_sum_delay" ${C.autoSummaryDelay ? 'checked' : ''} style="margin:0;">
                    <label for="gg_c_auto_sum_delay" style="cursor:pointer; display:flex; align-items:center; gap:4px; margin:0;">
                        <span>⏱️ 延迟启动</span>
                    </label>
                    <span style="opacity:0.7;">|</span>
                    <span style="opacity:0.8;">滞后</span>
                    <input type="number" id="gg_c_auto_sum_delay_count" value="${C.autoSummaryDelayCount || 5}" min="1" style="width:70px; text-align:center; padding:2px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    <span style="opacity:0.8;">层再执行</span>
                </div>

                <div style="background: rgba(33, 150, 243, 0.08); border: 1px solid rgba(33, 150, 243, 0.2); border-radius: 4px; padding: 8px; margin-bottom: 6px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #1976d2; font-size: 10px;">🔔 发起模式</div>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 2px;">
                        <input type="checkbox" id="gg_c_auto_sum_prompt" ${C.autoSummaryPrompt ? 'checked' : ''}>
                        <span>🤫 触发前静默发起 (直接执行)</span>
                    </label>
                    <div style="font-size: 9px; color: #666; margin-left: 20px;">未勾选时弹窗确认</div>
                </div>

                <div style="background: rgba(76, 175, 80, 0.08); border: 1px solid rgba(76, 175, 80, 0.2); border-radius: 4px; padding: 8px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #388e3c; font-size: 10px;">✅ 完成模式</div>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom: 2px;">
                        <input type="checkbox" id="gg_c_auto_sum_silent" ${C.autoSummarySilent ? 'checked' : ''}>
                        <span>🤫 完成后静默保存 (不弹结果窗)</span>
                    </label>
                    <div style="font-size: 9px; color: #666; margin-left: 20px;">未勾选时弹窗显示总结结果</div>
                </div>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="font-weight: 600; color:var(--g-tc); margin-bottom: 8px;">🏷️ 标签过滤（串行双重过滤）</div>
            <div style="font-size:10px; color:var(--g-tc); opacity:0.7; margin-bottom:6px;">过滤逻辑：先去黑后留白，可单选。例: <code style="background:rgba(0,0,0,0.1); padding:2px; color:var(--g-tc);">think, search</code>。若要过滤 <code style="background:rgba(0,0,0,0.1); padding:2px; color:var(--g-tc);">&lt;!--注释--&gt;</code>，请填入 <code style="background:rgba(0,0,0,0.1); padding:2px; color:var(--g-tc);">!--</code></div>

            <div style="margin-bottom: 8px;">
                <label style="font-size:11px; color:var(--g-tc); font-weight: 500; display: block; margin-bottom: 4px;">🚫 黑名单标签 (去除)</label>
                <input type="text" id="gg_c_filter_tags" value="${esc(C.filterTags || '')}" placeholder="例: thinking, system" style="width:100%; padding:5px; border:1px solid rgba(0,0,0,0.1); border-radius:4px; font-size:11px; font-family:monospace; color:var(--g-tc);">
                <div style="font-size:9px; color:#d63031; margin-top:2px;">删除这些标签及其内部的所有文字</div>
            </div>

            <div>
                <label style="font-size:11px; color:var(--g-tc); font-weight: 500; display: block; margin-bottom: 4px;">✅ 白名单标签 (仅留)</label>
                <input type="text" id="gg_c_filter_tags_white" value="${esc(C.filterTagsWhite || '')}" placeholder="例: content, message" style="width:100%; padding:5px; border:1px solid rgba(0,0,0,0.1); border-radius:4px; font-size:11px; font-family:monospace; color:var(--g-tc);">
                <div style="font-size:9px; color:#27ae60; margin-top:2px;">仅提取这些标签内的文字（若未找到则保留黑名单处理后的结果）</div>
            </div>
        </div>

        <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 6px; padding: 10px; margin-top: 10px;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight: 600;">
                <input type="checkbox" id="gg_c_sync_wi" ${C.syncWorldInfo ? 'checked' : ''}>
                <span>🌏 同步到世界书</span>
            </label>
            <div style="font-size: 10px; color: #666; margin-top: 6px; margin-left: 22px; line-height: 1.4;">
                将总结内容自动写入名为 <strong>[Memory_Context_Auto]</strong> 的世界书（常驻条目，触发词：总结/summary/前情提要/memory）
            </div>

            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight: 500; margin-top: 8px;">
                <input type="checkbox" id="gg_c_vector_enabled" ${C.vectorEnabled ? 'checked' : ''}>
                <span>🔍 启用插件独立向量检索</span>
            </label>
            <div style="font-size: 10px; color: #666; margin-top: 4px; margin-left: 22px; line-height: 1.4;">
                使用外部 API 实现语义检索，不依赖酒馆（点击下方"💠 向量化"按钮配置详细参数）
            </div>

            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight: 500; margin-top: 8px;">
                <input type="checkbox" id="gg_c_auto_vectorize" ${C.autoVectorizeSummary ? 'checked' : ''}>
                <span>⚡ 总结后自动向量化</span>
            </label>
            <div style="font-size: 10px; color: #666; margin-top: 4px; margin-left: 22px; line-height: 1.4;">
                总结完成后,自动将内容同步到专属向量书并执行向量化<br>
                (注:勾选后,总结表中已被向量化的内容将自动标记为隐藏/绿色)
            </div>

            ${window.Gaigai.WI.getSettingsUI(m.wiConfig)}

            <!-- ✨✨✨ 新增：手动覆盖按钮区域 ✨✨✨ -->
            <div style="margin-top: 8px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 8px; display: flex; align-items: center; justify-content: flex-end;">
                <button id="gg_btn_force_sync_wi" style="background: #ff9800; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-arrows-rotate"></i> 强制用总结表覆盖世界书
                </button>
            </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button id="gg_open_api" style="flex:1; font-size:11px; padding:8px;">🤖 API配置</button>
            <button id="gg_open_pmt" style="flex:1; font-size:11px; padding:8px;">📝 提示词</button>
            <button id="gg_open_vector" style="flex:1; font-size:11px; padding:8px;">💠 向量化</button>
        </div>
        <button id="gg_save_cfg" style="width: 100%; padding: 8px; margin-top: 4px; font-weight: bold;">💾 保存配置</button>

        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.1); text-align: center;">
            <button id="gg_open_probe" style="width: 100%; padding: 8px; margin-bottom: 10px; background: #17a2b8; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🔍 最后发送内容
            </button>

            <button id="gg_force_cloud_load" title="强制从服务器拉取最新的 chatMetadata，解决手机/电脑数据不一致问题" style="width: 100%; padding: 8px; margin-bottom: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ☁️/🖥️ 强制多端同步
            </button>
            <p style="font-size: 10px; color: #999; margin: -5px 0 10px 0;">解决多端同步问题（PC修改后移动端未更新）</p>

            <button id="gg_rescue_btn" style="background: transparent; color: #dc3545; border: 1px dashed #dc3545; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; width: 100%;">
                🚑 扫描并恢复丢失的旧数据
            </button>
            <p style="font-size: 10px; color: #999; margin: 5px 0 10px 0;">如果更新后表格变空，点此按钮尝试找回。</p>

            <button id="gai-btn-clear-cache" style="background: transparent; color: #ff9800; border: 1px dashed #ff9800; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; width: 100%;">
                🧹 清除本地缓存 (解决卡顿/配置错乱)
            </button>
            <p style="font-size: 10px; color: #999; margin: 5px 0 0 0;">清除所有本地配置和缓存，服务器数据不受影响。</p>
        </div>
    </div>`;

        pop('⚙️ 配置', h, true);
        window.isEditingConfig = true; // 标记开始编辑配置，防止后台同步覆盖用户输入

        setTimeout(() => {
            // ✅✅✅ [修复] 强制同步 UI 状态与内存配置
            // 优先读取 API_CONFIG.summarySource，如果未定义则默认为 'table' (与定义保持一致)
            const currentSummarySource = API_CONFIG.summarySource || 'table';

            // 1. 先重置所有选中状态
            $('input[name="cfg-sum-src"]').prop('checked', false);

            // 2. 根据当前值选中对应的按钮
            const $targetRadio = $(`input[name="cfg-sum-src"][value="${currentSummarySource}"]`);
            if ($targetRadio.length > 0) {
                $targetRadio.prop('checked', true);
            } else {
                // 兜底：如果值不对，默认选中 table
                $('input[name="cfg-sum-src"][value="table"]').prop('checked', true);
            }

            // 3. 触发 change 事件以更新关联 UI (如显示/隐藏子选项)
            $('input[name="cfg-sum-src"]:checked').trigger('change');

            console.log(`✅ [配置面板] 总结模式 UI 已同步为: ${currentSummarySource}`);

            // ✅✅✅ 新增：重置追溯进度

            // ✨✨✨ 自动总结开关的 UI 联动 ✨✨✨
            $('#gg_c_auto_sum').on('change', function () {
                syncUIToConfig();  // ✅✅✅ 确保同步到全局配置对象 C 和 localStorage
                const isChecked = $(this).is(':checked');

                if (isChecked) {
                    $('#gg_auto_sum_settings').slideDown();
                } else {
                    $('#gg_auto_sum_settings').slideUp();
                }

                // ✅ Per-Chat Configuration: Update C and save to current chat immediately
                C.autoSummary = isChecked;
                m.save();
                console.log('💾 [每聊配置] 已保存自动总结设置到当前聊天:', isChecked);
            });

            // 🆕 总结来源单选按钮的 UI 联动（控制表格选择区域的显示/隐藏）
            $('input[name="cfg-sum-src"]').on('change', function () {
                const selectedSource = $(this).val();
                if (selectedSource === 'table') {
                    $('#gg_auto_sum_table_selector').slideDown(200);
                } else {
                    $('#gg_auto_sum_table_selector').slideUp(200);
                }
            });

            // 🆕 表格选择 - 全选按钮
            $('#gg_auto_sum_select_all').on('click', function () {
                $('.gg-auto-sum-table-select').prop('checked', true);
            });

            // 🆕 表格选择 - 全不选按钮
            $('#gg_auto_sum_deselect_all').on('click', function () {
                $('.gg-auto-sum-table-select').prop('checked', false);
            });

            // ✨✨✨ [关键修复] 总结来源单选按钮的 change 事件监听器 ✨✨✨
            $('input[name="cfg-sum-src"]').on('change', function () {
                // 🛡️ 防止配置恢复期间触发保存
                if (isRestoringSettings) {
                    console.log('⏸️ [cfg-sum-src] 配置恢复中，跳过保存');
                    return;
                }

                const selectedSource = $(this).val();
                console.log(`🔄 [总结来源] 用户选择了: ${selectedSource}`);

                // ✅ 更新 API_CONFIG
                API_CONFIG.summarySource = selectedSource;

                // ✅ 保存到 localStorage
                try {
                    localStorage.setItem(AK, JSON.stringify(API_CONFIG));
                } catch (e) {
                    console.error('❌ [cfg-sum-src] localStorage 写入失败:', e);
                }

                // ✅ Per-Chat Configuration: Save to current chat immediately
                m.save();
                console.log('💾 [每聊配置] 已保存总结来源设置到当前聊天:', selectedSource);

                // ✅ 同步到云端
                if (typeof saveAllSettingsToCloud === 'function') {
                    saveAllSettingsToCloud().catch(err => {
                        console.warn('⚠️ [总结来源] 云端同步失败:', err);
                    });
                }
            });

            // 💉 注入记忆表格说明图标点击事件
            $('#gg_memory_injection_info').on('click', function () {
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
                    css: { fontSize: '13px', lineHeight: '1.8', color: 'var(--g-tc)' },
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

            $('#gg_open_probe').on('click', function () {
                if (typeof window.Gaigai.showLastRequest === 'function') {
                    window.Gaigai.showLastRequest();
                } else {
                    customAlert('❌ 探针模块 (probe.js) 尚未加载。\n\n请确保 probe.js 文件存在于同级目录下，并尝试刷新页面。', '错误');
                }
            });

            // ✨✨✨ 新增：强制读取服务端数据（解决多端同步问题）
            // ✨✨✨ [修复版] 直接从服务器 API 获取最新 settings.json
            $('#gg_force_cloud_load').off('click').on('click', async function () {
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

                        $('#gg_c_enabled').prop('checked', C.enabled);
                        $('#gg_c_auto_bf').prop('checked', C.autoBackfill);
                        $('#gg_c_auto_sum').prop('checked', C.autoSummary);
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
            $('#gg_rescue_btn').off('click').on('click', async function () {
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

                const $overlay = $('<div>', { css: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20000002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' } });

                const $box = $('<div>', {
                    css: {
                        background: bgColor,
                        color: txtColor,
                        border: borderColor,
                        width: '500px',
                        maxWidth: '92vw',
                        maxHeight: '85vh',
                        margin: 'auto',
                        padding: '15px',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
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
                    function () { $(this).css('background', isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'); },
                    function () { $(this).css('background', 'transparent'); }
                );

                // ✨ 修复：鼠标移出时，恢复的颜色必须是 btnDefColor，而不是 UI.c
                $box.find('.restore-item-btn').hover(
                    function () {
                        // 鼠标悬停：背景变主题色，字变白
                        $(this).css({ background: UI.c, color: '#fff', border: `1px solid ${UI.c}` });
                    },
                    function () {
                        // 鼠标移出：背景变透明，字变回默认色(夜间为白，白天为主题色)
                        $(this).css({ background: 'transparent', color: btnDefColor, border: `1px solid ${btnBorderColor}` });
                    }
                ).on('click', async function () {
                    const key = $(this).data('key');
                    const target = backups.find(b => b.key === key);
                    if (await customConfirm(`确定回退到 ${target.dateStr} (包含 ${target.count} 行数据) 吗？\n\n⚠️ 当前未保存的内容将会丢失！`, '回档确认')) {
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
                    if (e.target === $overlay[0]) $overlay.remove();
                });

                btn.text(originalText);
            });

            // 🧹 清除本地缓存按钮
            $('#gai-btn-clear-cache').off('click').on('click', async function () {
                if (window.Gaigai && window.Gaigai.DebugManager) {
                    await window.Gaigai.DebugManager.clearCache();
                } else {
                    console.error('❌ [清除缓存] DebugManager 未加载');
                    await customAlert('⚠️ 调试模块未加载，请刷新页面后重试。', '错误');
                }
            });

            // 互斥开关控制
            // ✅✅✅ [关键修复] 从UI同步所有配置到C对象（防止切换开关时丢失未保存的修改）
            function syncUIToConfig() {
                // 🛡️ 防止配置恢复期间触发保存（修复移动端竞态条件）
                if (isRestoringSettings) {
                    console.log('⏸️ [syncUIToConfig] 配置恢复中，跳过保存');
                    return;
                }

                C.enabled = $('#gg_c_enabled').is(':checked');
                C.autoBackfill = $('#gg_c_auto_bf').is(':checked');
                C.autoBackfillFloor = parseInt($('#gg_c_auto_bf_floor').val()) || 10;
                C.autoBackfillPrompt = $('#gg_c_auto_bf_prompt').is(':checked');
                C.autoBackfillSilent = $('#gg_c_auto_bf_silent').is(':checked');
                C.autoBackfillDelay = $('#gg_c_auto_bf_delay').is(':checked');
                C.autoBackfillDelayCount = parseInt($('#gg_c_auto_bf_delay_count').val()) || 5;
                C.contextLimit = $('#gg_c_limit_on').is(':checked');
                C.contextLimitCount = parseInt($('#gg_c_limit_count').val());
                C.tableInj = $('#gg_c_table_inj').is(':checked');
                C.autoSummary = $('#gg_c_auto_sum').is(':checked');
                C.autoSummaryFloor = parseInt($('#gg_c_auto_floor').val());
                C.autoSummaryPrompt = $('#gg_c_auto_sum_prompt').is(':checked');
                C.autoSummarySilent = $('#gg_c_auto_sum_silent').is(':checked');
                C.autoSummaryDelay = $('#gg_c_auto_sum_delay').is(':checked');
                C.autoSummaryDelayCount = parseInt($('#gg_c_auto_sum_delay_count').val()) || 5;
                C.filterTags = $('#gg_c_filter_tags').val();
                C.filterTagsWhite = $('#gg_c_filter_tags_white').val();
                C.syncWorldInfo = $('#gg_c_sync_wi').is(':checked');
                C.autoBindWI = $('#gg_c_auto_bind_wi').is(':checked');
                C.vectorEnabled = $('#gg_c_vector_enabled').is(':checked');
                C.autoVectorizeSummary = $('#gg_c_auto_vectorize').is(':checked');

                // ✅ 保存世界书自定义配置
                m.wiConfig.bookName = $('#gg_wi_book_name').val().trim();

                API_CONFIG.summarySource = $('input[name="cfg-sum-src"]:checked').val();

                // 🆕 收集表格选择
                const selectedTables = [];
                $('.gg-auto-sum-table-select:checked').each(function () {
                    selectedTables.push(parseInt($(this).val()));
                });
                // 如果全选了或者都没选，存为空数组（表示默认全部）；否则存具体索引
                const totalDataTables = m.s.length - 1;
                if (selectedTables.length === totalDataTables || selectedTables.length === 0) {
                    C.autoSummaryTargetTables = [];
                } else {
                    C.autoSummaryTargetTables = selectedTables;
                }
                console.log('📊 [配置保存] 自动总结目标表格:', C.autoSummaryTargetTables.length === 0 ? '全部' : C.autoSummaryTargetTables);

                // 保存到 localStorage
                try {
                    localStorage.setItem(CK, JSON.stringify(C));
                    localStorage.setItem(AK, JSON.stringify(API_CONFIG));
                    localStorage.setItem('gg_timestamp', Date.now().toString());
                } catch (e) {
                    console.error('❌ [syncUIToConfig] localStorage 写入失败:', e);
                }
            }

            // ✅ [修复] 向量化总开关：点击立即同步并保存
            $('#gg_c_vector_enabled').on('change', async function () {
                // 1. 同步到内存配置
                C.vectorEnabled = $(this).is(':checked');

                // 2. 存入 localStorage
                try {
                    localStorage.setItem('gg_config', JSON.stringify(C));
                } catch (e) {}

                // 3. 实时反馈
                console.log(`💠 [设置] 独立向量检索已${C.vectorEnabled ? '开启' : '关闭'}`);

                // 4. 尝试同步到云端
                if (typeof saveAllSettingsToCloud === 'function') {
                    saveAllSettingsToCloud().catch(() => {});
                }
            });

            $('#gg_c_enabled').on('change', async function () {
                // 🛡️ 防止配置恢复期间触发保存（修复移动端竞态条件）
                if (isRestoringSettings) {
                    console.log('⏸️ [gg_c_enabled] 配置恢复中，跳过保存');
                    return;
                }

                // ✅ [防丢失] 先同步所有UI配置
                syncUIToConfig();

                const isChecked = $(this).is(':checked');

                if (isChecked) {
                    if ($('#gg_c_auto_bf').is(':checked')) {
                        await customAlert('⚠️ 冲突提示\n\n【实时记忆填表】和【自动批量填表】不能同时开启。\n\n已自动关闭自动填表。', '模式切换');
                        $('#gg_c_auto_bf').prop('checked', false);
                        $('#gg_auto_bf_settings').slideUp();
                        C.autoBackfill = false; // Update config
                    }
                }

                // ✅ Per-Chat Configuration: Update C and save to current chat immediately
                C.enabled = isChecked;
                m.save();
                console.log('💾 [每聊配置] 已保存实时填表设置到当前聊天:', isChecked);

                // ✅ 同步到云端
                if (typeof saveAllSettingsToCloud === 'function') {
                    saveAllSettingsToCloud().catch(err => {
                        console.warn('⚠️ [实时填表开关] 云端同步失败:', err);
                    });
                }
            });

            $('#gg_c_auto_bf').on('change', async function () {
                // 🛡️ 防止配置恢复期间触发保存（修复移动端竞态条件）
                if (isRestoringSettings) {
                    console.log('⏸️ [gg_c_auto_bf] 配置恢复中，跳过保存');
                    return;
                }

                // ✅ [防丢失] 先同步所有UI配置
                syncUIToConfig();

                const isChecked = $(this).is(':checked');

                if (isChecked) {
                    $('#gg_auto_bf_settings').slideDown();
                    if ($('#gg_c_enabled').is(':checked')) {
                        if (await customConfirm('⚠️ 模式切换\n\n开启【自动批量填表】需要关闭【实时记忆填表】。\n\n确定切换吗？', '确认')) {
                            $('#gg_c_enabled').prop('checked', false);
                            C.enabled = false; // Update config
                        } else {
                            $(this).prop('checked', false);
                            $('#gg_auto_bf_settings').slideUp();
                            return; // Don't save if user cancelled
                        }
                    }
                } else {
                    $('#gg_auto_bf_settings').slideUp();
                }

                // ✅ Per-Chat Configuration: Update C and save to current chat immediately
                C.autoBackfill = isChecked;
                m.save();
                console.log('💾 [每聊配置] 已保存批量填表设置到当前聊天:', isChecked);

                // ✅ 同步到云端
                if (typeof saveAllSettingsToCloud === 'function') {
                    saveAllSettingsToCloud().catch(err => {
                        console.warn('⚠️ [批量填表开关] 云端同步失败:', err);
                    });
                }
            });

            $('#gg_save_cfg').on('click', async function () {
                // ✅ 设置全局保存标记，防止并发冲突
                window.isSavingConfig = true;
                console.log('🔒 [配置保存] 已锁定，暂停其他 loadConfig 调用');

                try {
                    // ✨ 保存旧配置状态，用于检测世界书同步的变化
                    const oldSyncWorldInfo = C.syncWorldInfo;

                    // ✅ 步骤 1：调用统一的同步函数（复用代码，避免重复）
                    syncUIToConfig();
                    console.log('✅ [配置保存] 步骤1：内存对象已更新（通过 syncUIToConfig）');

                    // ✅ 步骤 1.5：【核心修复】立即将 C 写入当前角色的存档！
                    m.save();
                    console.log('✅ [配置保存] 已同步至当前角色存档');

                    // ✨ 检测世界书同步从开启到关闭的状态变化，提示用户手动禁用世界书条目
                    if (oldSyncWorldInfo === true && C.syncWorldInfo === false) {
                        await customAlert('⚠️ 检测到您关闭了世界书同步\n\n请务必手动前往酒馆顶部的【世界书/知识书】面板，禁用或删除 [Memory_Context_Auto] 条目，否则旧的总结内容仍会持续发送给 AI。\n\n💡 互斥机制：\n• 开启同步：由世界书发送总结（插件不重复注入）\n• 关闭同步：由插件注入总结（需手动清理世界书）', '重要提示');
                    }

                    // ✅ 步骤 2：异步保存到云端（不阻塞用户操作）
                    await saveAllSettingsToCloud();
                    console.log('✅ [配置保存] 步骤2：云端同步完成');

                    if (C.autoBackfill && C.enabled) {
                        C.enabled = false;
                        $('#gg_c_enabled').prop('checked', false);
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

            $('#gg_open_api').on('click', () => navTo('AI总结配置', shapi));
            $('#gg_open_pmt').on('click', () => navTo('提示词管理', window.Gaigai.PromptManager.showPromptManager));

            // ✨✨✨ 强制覆盖世界书 (手动绑定版) ✨✨✨
            $('#gg_btn_force_sync_wi').off('click').on('click', async function () {
                // 0. 检查世界书同步是否开启
                if (!C.syncWorldInfo) {
                    await customAlert('⚠️ 世界书同步已关闭\n\n请先在配置中开启【同步到世界书】选项。', '功能未启用');
                    return;
                }

                const summarySheet = m.get(m.s.length - 1);

                // 1. 安全拦截
                if (!summarySheet || summarySheet.r.length === 0) {
                    await customAlert('❌ 总结表格为空！\n\n无法执行覆盖操作。', '安全拦截');
                    return;
                }

                // 2. 确认提示
                const confirmMsg = `⚠️ 确定要强制覆盖吗？\n\n1. 将重新生成当前角色的记忆世界书文件。\n2. 总结表中的 ${summarySheet.r.length} 条记录将被写入。`;
                if (!await customConfirm(confirmMsg, '覆盖确认')) {
                    return;
                }

                const btn = $(this);
                const oldText = btn.html();
                btn.html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...').prop('disabled', true);

                try {
                    // ✅ 保存最新的书名配置到内存
                    m.wiConfig.bookName = $('#gg_wi_book_name').val().trim();
                    m.save();

                    console.log('⚡ [强制覆盖] 调用统一同步接口...');
                    // 调用世界书管理器的统一同步接口（强制覆盖模式）
                    await window.Gaigai.WI.syncToWorldInfo(null, true);

                    // 成功提示
                    const bookName = window.Gaigai.WI._getStableBookName(m.gid());
                    if (typeof toastr !== 'undefined') {
                        toastr.success(`文件 ${bookName} 已生成。\n请在上方"世界/知识书"下拉框中手动选中它。`, '覆盖成功', { timeOut: 5000 });
                    } else {
                        await customAlert(`✅ 文件已生成！\n\n请手动在酒馆上方的"世界/知识书"下拉框中选择：\n${bookName}`, '覆盖成功');
                    }

                } catch (e) {
                    console.error(e);
                    await customAlert(`操作失败: ${e.message}`, '错误');
                } finally {
                    btn.html(oldText).prop('disabled', false);
                }
            });

            // ==================== 向量化设置按钮 ====================
            $('#gg_open_vector').off('click').on('click', () => {
                if (window.Gaigai && window.Gaigai.VM && typeof window.Gaigai.VM.showUI === 'function') {
                    navTo('💠 向量化设置', () => window.Gaigai.VM.showUI());
                } else {
                    customAlert('向量管理器未加载，请刷新页面后重试', '错误');
                }
            });

            // 🔓 释放恢复标志，允许保存操作
            isRestoringSettings = false;
            console.log('🔓 [配置面板] 已设置 isRestoringSettings = false，允许保存');
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

                    // ✨✨✨ [防冲突] 检查是否正在执行总结，避免快照冲突
                    if (window.isSummarizing) {
                        console.log('⏸️ [实时填表] 检测到正在执行总结，延迟处理...');
                        // 延迟 2 秒后重新尝试
                        setTimeout(() => omsg(i), 2000);
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
                    if (C.enabled && !C.autoBackfill) {
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
                            // 🛡️ [防清空补丁] 如果找到的是创世快照(-1)，但当前已经是聊天中途(i > 2)，
                            // 说明中间快照丢失（通常是刷新后）。此时绝对禁止回滚到空状态，必须信任当前加载的数据。
                            if (baseKey === '-1' && i > 2) {
                                console.warn(`🛑 [智能保护] 第 ${i} 楼缺失前序快照，禁止回滚到创世快照(-1)，保留当前内存数据作为基准。`);
                                // 不执行 restoreSnapshot，直接使用当前 m.s 中的数据
                            } else {
                                // ⚡ 强制回档！这一步非常关键
                                // 无论当前表格是什么样，必须先回到上一楼的样子
                                restoreSnapshot(baseKey);
                                console.log(`↺ [同步] 基准重置成功：已回滚至快照 [${baseKey}]`);
                            }
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

                            // ✅ [修复] 实时填表只更新填表指针，不更新总结指针
                            // 原因：实时填表不应该阻止自动总结触发，两者是独立的功能
                            API_CONFIG.lastBackfillIndex = i;
                            localStorage.setItem(AK, JSON.stringify(API_CONFIG));

                            // ✅ 同步到云端，防止 loadConfig 回滚
                            if (typeof saveAllSettingsToCloud === 'function') {
                                saveAllSettingsToCloud().catch(err => {
                                    console.warn('⚠️ [实时填表] 云端同步失败:', err);
                                });
                            }

                            console.log(`✅ [实时填表] 填表指针已更新至第 ${i} 楼`);
                        } else {
                            console.log(`Testing: 第 ${i} 楼无指令，保持基准状态。`);
                        }

                        // ============================================================
                        // 步骤 4: 生成当前楼层的新快照 (Save Snapshot i)
                        // 这样第 i+1 楼就能用这个作为基准了
                        // ============================================================
                        const newSnapshot = {
                            data: m.all().slice(0, -1).map(sh => JSON.parse(JSON.stringify(sh.json()))), // 只保存数据表
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
                        // 🔧 修复1：强制加载最新数据，防止读取到过期的 lastBackfillIndex
                        m.load();

                        const lastBfIndex = API_CONFIG.lastBackfillIndex || 0;
                        const currentCount = x.chat.length;
                        const diff = currentCount - lastBfIndex;

                        // 🔧 修复2：强制类型转换，防止字符串拼接错误
                        const bfInterval = parseInt(C.autoBackfillFloor) || 10;

                        // 🔧 修复3：严格布尔值检查，防止延时设置被忽略
                        const bfDelay = (C.autoBackfillDelay === true) ? (parseInt(C.autoBackfillDelayCount) || 0) : 0;

                        // 计算有效阈值
                        const bfThreshold = bfInterval + bfDelay;

                        // 🔧 修复4：详细的调试日志
                        console.log(`🔍 [Auto Backfill 触发检查] 当前:${currentCount}, 上次:${lastBfIndex}, 差值:${diff}`);
                        console.log(`🔍 [阈值计算] 间隔:${bfInterval}, 延迟:${bfDelay}, 阈值:${bfThreshold}, 延迟开关:${C.autoBackfillDelay}`);

                        if (diff >= bfThreshold) {
                            // 🛡️ UI 冲突检测：检查是否有插件弹窗正在显示
                            if ($('.g-ov').length > 0) {
                                console.log('⏸️ [自动批量填表] 检测到插件弹窗打开，跳过本次触发以防止覆盖用户界面');
                                return;
                            }

                            // 计算目标结束点 (Target End Floor)
                            // 如果开启延迟：结束点 = 上次位置 + 间隔 (只处理这一段，后面的留作缓冲)
                            // 如果关闭延迟：结束点 = 当前位置 (处理所有未记录的内容，保持旧逻辑)
                            const targetEndIndex = (C.autoBackfillDelay === true) ? (lastBfIndex + bfInterval) : currentCount;

                            console.log(`⚡ [Auto Backfill] 触发! 填表范围: ${lastBfIndex}-${targetEndIndex}`);

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
                            // 🛡️ UI 冲突检测：检查是否有插件弹窗正在显示
                            if ($('.g-ov').length > 0) {
                                console.log('⏸️ [自动总结] 检测到插件弹窗打开，跳过本次触发以防止覆盖用户界面');
                                return;
                            }

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
                                                // 立即执行（传入目标结束点、模式、静默参数和表格范围）
                                                window.Gaigai.SummaryManager.callAIForSummary(
                                                    null,
                                                    targetEndIndex,
                                                    null,
                                                    C.autoSummarySilent,
                                                    false,
                                                    false,
                                                    C.autoSummaryTargetTables  // 🆕 传入配置的表格范围
                                                );
                                            }
                                        } else {
                                            console.log(`🚫 [自动总结] 用户取消`);
                                        }
                                    });
                                } else {
                                    // 静默模式（勾选时）：直接执行
                                    window.Gaigai.SummaryManager.callAIForSummary(
                                        null,
                                        targetEndIndex,
                                        null,
                                        C.autoSummarySilent,
                                        false,
                                        false,
                                        C.autoSummaryTargetTables  // 🆕 传入配置的表格范围
                                    );
                                }
                            }
                        }
                    }

                    setTimeout(hideMemoryTags, 100);

                    // ✨✨✨【UI 自动刷新】✨✨✨
                    // 如果表格窗口正开着，就刷新当前选中的那个表，让你立刻看到变化
                    if ($('#gai-main-pop').length > 0) {
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
    // 1. 聊天状态变更监听 (修复删楼、分支切换、多重宇宙逻辑)
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

        // ✨ [防串味] 重置世界书状态
        if (window.Gaigai && window.Gaigai.WI && typeof window.Gaigai.WI.resetState === 'function') {
            window.Gaigai.WI.resetState();
        }

        // 加载全局配置
        try { await loadConfig(); } catch (e) { }

        // 1. 💾 [暂存旧会话] 切换前，把旧会话的快照存入仓库
        if (m.id) {
            window.GaigaiSnapshotStore[m.id] = snapshotHistory;
        }

        // 2. 🔄 [加载新会话]
        m.load(); // 这会更新 m.id 和从硬盘读取最新的 m.s 数据
        thm();

        // 重置运行时状态
        window.Gaigai.foldOffset = 0;
        window.Gaigai.lastRequestData = null;
        lastInternalSaveTime = 0;
        lastProcessedMsgIndex = -1;
        isRegenerating = false;
        deletedMsgIndex = -1;
        processedMessages.clear();

        // 3. 📂 [恢复快照库] 从仓库取出新会话的快照
        if (m.id && window.GaigaiSnapshotStore[m.id]) {
            snapshotHistory = window.GaigaiSnapshotStore[m.id];
            console.log(`📂 [ochat] 已恢复会话 [${m.id}] 的内存快照`);
        } else {
            snapshotHistory = {};
        }

        // 4. 🧹 [内存清理]
        const allKeys = Object.keys(snapshotHistory).map(Number).filter(k => !isNaN(k)).sort((a, b) => a - b);
        if (allKeys.length > 50) {
            const cutoff = allKeys[allKeys.length - 50];
            allKeys.forEach(k => {
                if (k < cutoff && k !== -1) delete snapshotHistory[k.toString()];
            });
        }

        // 5. 🛡️ [创世快照兜底]
        if (!snapshotHistory['-1']) {
            snapshotHistory['-1'] = {
                data: m.all().slice(0, -1).map(sh => {
                    let copy = JSON.parse(JSON.stringify(sh.json()));
                    copy.r = [];
                    return copy;
                }),
                summarized: {},
                timestamp: 0
            };
        }

        // ============================================================
        // ⚡⚡⚡ [核心修复：分支穿越/时光机逻辑] ⚡⚡⚡
        // ============================================================
        const ctx = m.ctx();
        const currentLen = ctx && ctx.chat ? ctx.chat.length : 0;
        console.log(`📂 [ochat] 检测到聊天/分支变更 (当前楼层: ${currentLen})`);

        if (currentLen > 0) {
            // 目标：我们应该处于哪一楼的状态？
            const targetIndex = currentLen - 1;
            const targetKey = targetIndex.toString();

            // 策略 A：如果我们有这一楼的快照（说明是切回了已存在的分支）
            if (snapshotHistory[targetKey]) {
                console.log(`⚡ [ochat] 检测到已知分支，正在回档至 [${targetKey}]...`);
                // 强制回档！让表格回到那一楼的样子
                restoreSnapshot(targetKey, true);
            }
            // 策略 B：如果没有这一楼的快照（说明可能是刚加载，或者快照丢了）
            // 我们尝试找找上一楼的，或者相信 m.load() 从硬盘读出来的数据
            else {
                console.log(`⚠️ [ochat] 未找到分支快照 [${targetKey}]，尝试使用硬盘存档数据并建立新快照`);
                // 立即为当前状态建立一个快照，防止下次切回来又空了
                saveSnapshot(targetKey);
            }
        } else {
            // 如果是新开聊天（0楼）
            // 🛑 【逻辑修正】绝对信任硬盘存档 (m.load)
            // 无论刚才读出来的是有数据还是没数据(用户删空了)，那都是最新的状态。
            // 我们必须强制让内存里的快照(-1)同步成现在的样子。
            // 严禁在这里执行 restoreSnapshot，否则会把用户"特意删空"的状态当作"数据丢失"给回滚掉。

            saveSnapshot('-1');
            console.log(`💾 [ochat] 0楼状态同步：已将内存快照-1强制更新为硬盘存档状态`);
        }

        // 刷新 UI
        setTimeout(hideMemoryTags, 500);
        setTimeout(() => {
            // 强制刷新表格视图
            if ($('#gai-main-pop').length > 0) {
                const activeTab = $('.g-t.act').data('i');
                if (activeTab !== undefined) refreshTable(activeTab);
            }
        }, 650);

        // ============================================================
        // 🚑 [开场白修复补丁]
        // 检查并强制处理未被快照的开场白消息
        // ============================================================
        if (currentLen > 0) {
            const firstMsg = ctx.chat[0];
            // 条件：第一条消息存在，是AI发的（is_user为false），并且没有为它创建过快照
            if (firstMsg && firstMsg.is_user === false && !snapshotHistory['0']) {
                console.log('🚑 [开场白补丁] 检测到未处理的开场白，正在强制生成快照...');
                // 立即调用omsg处理第0条消息，强制生成 snapshotHistory['0']
                omsg(0);
            }
        }

        // 解锁
        setTimeout(() => {
            isChatSwitching = false;
        }, 800);
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
    // 🔥 独立向量检索函数 (用于 Hook 和 Fetch Hijack)
    // ============================================================
    /**
     * 执行向量检索并替换 {{VECTOR_MEMORY}} 变量
     * @param {Object} data - 包含 .chat 数组的对象，或直接是 chat 数组
     * @returns {Promise<string>} - 返回向量检索结果文本（用于 Fetch Hijack 热替换）
     */
    async function executeVectorSearch(data) {
        let vectorContent = ''; // 默认返回空字符串

        try {
            // 兼容处理：如果传入的是数组，包装成对象；如果是对象，直接使用
            const chatData = Array.isArray(data) ? { chat: data } : data;

            if (!chatData || !chatData.chat || chatData.chat.length === 0) {
                console.log('💠 [向量检索] 跳过：chat 数组为空');
                return vectorContent;
            }

            // 1. 状态预检
            const isVectorReady = C.vectorEnabled && window.Gaigai.VM;
            console.log(`💠 [向量检索预检] 开关: ${C.vectorEnabled}, 模块加载: ${!!window.Gaigai.VM}`);

            // 🛡️ 2. 配置预检：开启了但没配好 API
            if (C.vectorEnabled && (!C.vectorUrl || !C.vectorKey)) {
                if (typeof toastr !== 'undefined') {
                    toastr.warning('⚠️ 向量化 API 未配置，已自动跳过检索', '配置提醒', { timeOut: 3000 });
                }
                console.warn('🚫 [向量检索] 配置缺失 (URL/Key为空)，跳过检索');
                return vectorContent; // 返回空字符串
            }

            // 3. 正常执行检索
            if (isVectorReady && chatData.chat && chatData.chat.length > 0) {
                // === 增强版：多轮上下文检索 ===
                let userQuery = '';

                // 获取配置的上下文深度（默认1）
                const depth = C.vectorContextDepth || 1;
                console.log(`💠 [向量检索] 上下文深度: ${depth}`);

                // 倒序收集最近的 depth 条有效消息（User + Assistant）
                const collectedMessages = [];
                for (let i = chatData.chat.length - 1; i >= 0 && collectedMessages.length < depth; i--) {
                    const msg = chatData.chat[i];

                    // 1. 跳过系统指令
                    if (msg.role === 'system') continue;

                    // 2. 判定是否为有效消息 (User 或 Assistant)
                    const isUser = msg.is_user === true ||
                                   msg.role === 'user' ||
                                   (msg.name !== 'System' && msg.role !== 'assistant');

                    const isAssistant = !isUser && (msg.role === 'assistant' || msg.name !== 'System');

                    if (isUser || isAssistant) {
                        // 尝试获取内容
                        let candidateText = msg.mes || msg.content || msg.text || '';

                        // ✅ 新增：执行清洗，去除 Memory 标签和用户黑名单标签(如 think)
                        candidateText = window.Gaigai.cleanMemoryTags(candidateText);
                        if (window.Gaigai.tools && typeof window.Gaigai.tools.filterContentByTags === 'function') {
                            candidateText = window.Gaigai.tools.filterContentByTags(candidateText);
                        }

                        // 只有清洗后内容有效才采纳
                        if (candidateText && candidateText.trim()) {
                            collectedMessages.unshift({  // 使用 unshift 保持时间顺序
                                role: isUser ? 'User' : 'AI',
                                content: candidateText
                            });
                        }
                    }
                }

                // 拼接收集到的消息（按时间顺序）
                if (collectedMessages.length > 0) {
                    userQuery = collectedMessages.map(m => m.content).join('\n');
                    console.log(`✅ [向量检索] 已收集 ${collectedMessages.length} 条消息作为检索上下文`);
                }

                if (userQuery.trim()) {
                    console.log(`🔍 [向量检索] 正在检索: "${userQuery.substring(0, 20)}..."`);

                    // 异步检索
                    const results = await window.Gaigai.VM.search(userQuery);

                    // ==================== 💎 名称匹配加权 (Re-ranking) ====================
                    if (results && results.length > 0) {
                        console.log(`🎯 [向量重排] 开始名称匹配加权，共 ${results.length} 条结果`);

                        results.forEach((item, index) => {
                            // 提取片段内容中的名字（支持多种格式）
                            const nameMatch = item.text.match(/(?:姓名|Name|name|角色)[:：]\s*([^\s\n，,。.]+)/i);

                            if (nameMatch && nameMatch[1]) {
                                const name = nameMatch[1].trim();

                                // 检查用户输入是否包含这个名字
                                if (userQuery.includes(name)) {
                                    const oldScore = item.score;
                                    item.score += 0.1;
                                    console.log(`[向量重排] 命中关键词: "${name}", 分数修正: ${oldScore.toFixed(4)} -> ${item.score.toFixed(4)}`);
                                }
                            }
                        });

                        // 重新排序：按 score 从大到小排序
                        results.sort((a, b) => b.score - a.score);
                        console.log(`✅ [向量重排] 重排完成，当前最高分: ${results[0].score.toFixed(4)}`);
                    }
                    // ==================== 名称匹配加权结束 ====================

                    // 获取配置的阈值
                    const threshold = (window.Gaigai.config_obj?.vectorThreshold !== undefined && window.Gaigai.config_obj?.vectorThreshold !== null)
                        ? window.Gaigai.config_obj.vectorThreshold
                        : 0.6;

                    // vectorContent 已在函数开头声明，这里直接使用

                    if (results && results.length > 0) {
                        // 找到最高相似度
                        const maxScore = Math.max(...results.map(r => r.score));
                        console.log(`✅ [向量检索] 成功检索 ${results.length} 条记忆 (最高相似度: ${maxScore.toFixed(2)})`);

                        // === 格式化检索结果 (纯净版) ===
                        vectorContent = results.map(r => r.text).join('\n\n');

                        // ✅ 执行运行时变量替换，确保 {{user}}/{{char}} 显示为真名
                        if (window.Gaigai.PromptManager && typeof window.Gaigai.PromptManager.resolveVariables === 'function') {
                            const currentCtx = window.Gaigai.m.ctx();
                            vectorContent = window.Gaigai.PromptManager.resolveVariables(vectorContent, currentCtx);
                            console.log('✅ [向量检索] 已解析运行时变量 ({{user}}/{{char}})');
                        }

                        console.log(`📦 [向量检索] 返回内容长度: ${vectorContent.length} 字符`);
                    } else {
                        console.warn(`ℹ️ [向量检索] 检索完成，但未找到匹配内容 (阈值: ${threshold.toFixed(2)})`);
                        console.warn(`💡 建议: 尝试调低相似度阈值，或检查知识库是否已向量化。`);
                    }
                }
            } else if (!C.vectorEnabled) {
                console.log('🚫 [向量检索] 跳过：功能未启用');
            }

            // 返回向量内容（用于 Fetch Hijack 热替换）
            return vectorContent;

        } catch (e) {
            // 🛡️ 优雅降级：如果向量检索失败，只记录错误，不影响正常流程
            console.error('❌ [向量检索] 运行出错 (非阻断):', e);

            // 用户友好提示
            if (typeof toastr !== 'undefined') {
                const errorMsg = e.message || '未知错误';
                toastr.error(`向量检索失败: ${errorMsg}，但这不影响聊天`, '非阻断错误', { timeOut: 4000 });
            }

            // 即使出错也返回空字符串
            return vectorContent;
        }
    }

    // ============================================================
    // 2. 生成前预处理 (修复重Roll时的回档逻辑)
    // ============================================================
    async function opmt(ev) {
        try {
            const data = ev.detail || ev;
            if (!data) return;
            if (data.dryRun || data.isDryRun || data.quiet || data.bg || data.no_update) return;
            if (isSummarizing || window.isSummarizing) return;

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
                    // ✅ [安全补丁] 如果只找到了创世快照(-1)，但当前楼层较高(>5)...
                    if (baseKey === '-1' && targetIndex > 5) {
                        console.warn(`🛑 [安全拦截] 楼层 ${targetIndex} 较高且缺失中间快照，禁止回滚到初始状态，保持当前数据。`);
                    } else {
                        restoreSnapshot(baseKey, true); // <--- 这里加了 true (强制回滚)
                        console.log(`↺ [opmt] 成功回档: 表格已恢复至基准 [${baseKey}]`);
                    }
                } else if (baseIndex === -1 && snapshotHistory['-1']) {
                    // ✅ [安全补丁] 同样检查楼层高度
                    if (targetIndex > 5) {
                        console.warn(`🛑 [安全拦截] 楼层 ${targetIndex} 较高但只有创世快照，禁止回滚，保持当前数据。`);
                    } else {
                        restoreSnapshot('-1', true); // <--- 这里也加了 true
                        console.log(`↺ [opmt] 成功回档: 表格已恢复至创世状态`);
                    }
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

                // ✅ 新增：清洗历史记录中的图片，防止包体过大
                // 遍历所有历史消息，移除图片字段，避免 Base64 数据导致 JSON 超过 20MB
                currentChat.forEach(msg => {
                    if (msg.image) delete msg.image;
                    if (msg.imageUrl) delete msg.imageUrl;
                    if (msg.images) delete msg.images;
                    // 兼容其他可能的图片字段
                    if (msg.extra && msg.extra.image) delete msg.extra.image;
                    if (msg.extra && msg.extra.images) delete msg.extra.images;
                });
                console.log(`🖼️ 已清洗历史消息中的图片数据，防止请求体过大`);
            }

            // 注意：向量检索已移至 Fetch Hijack 中处理，确保在发送请求前完成

            // 6. 注入 (此时表格已是回档后的干净状态)
            inj(data);

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
            console.log('⏳ 等待依赖加载... (jQuery, SillyTavern)');
            setTimeout(ini, 500);
            return;
        }

        // ✨✨✨ 核心修改：精准定位顶部工具栏 ✨✨✨
        // 策略：优先找到扩展设置按钮，把我们的按钮插在它后面
        const $extBtn = $('#extensions-settings-button');

        // --- 加载设置 (异步加载配置以支持服务端同步) ---
        // 1. 先从 localStorage 加载配置，确保用户保存的设置被应用
        try {
            const savedConfig = localStorage.getItem(CK);
            if (savedConfig) {
                Object.assign(C, JSON.parse(savedConfig));
                console.log('✅ [初始化] 已从 localStorage 加载用户配置');
            }
        } catch (e) {
            console.warn('⚠️ [初始化] 加载本地配置失败:', e);
        }

        try {
            const savedApiConfig = localStorage.getItem(AK);
            if (savedApiConfig) {
                Object.assign(API_CONFIG, JSON.parse(savedApiConfig));
                console.log('✅ [初始化] 已从 localStorage 加载 API 配置');
            }
        } catch (e) {
            console.warn('⚠️ [初始化] 加载本地 API 配置失败:', e);
        }

        try {
            const sv = localStorage.getItem(UK);
            if (sv) {
                UI = { ...UI, ...JSON.parse(sv) };
                console.log('✅ [初始化] 已从 localStorage 加载 UI 配置');
            }
        } catch (e) {
            console.warn('⚠️ [初始化] 加载本地 UI 配置失败:', e);
        }

        // 2. 然后从服务器同步配置（如果服务器有更新的配置会覆盖）
        await loadConfig(); // 🌐 异步加载配置，支持服务端同步

        // ⚠️ PROMPTS 的加载和管理已移至 prompt_manager.js
        // prompt_manager.js 会在自己加载时自动调用 initProfiles() 进行数据迁移

        // loadColWidths(); // ❌ 已废弃：不再从全局加载，列宽/行高通过 m.load() 从会话存档加载
        // loadSummarizedRows(); // ❌ 已废弃：不再从全局加载，改为通过 m.load() 从角色专属存档加载
        m.load();
        thm();

        // ✨✨✨ 核心修复：创建"创世快照"(-1号)，代表对话开始前的空状态 ✨✨✨
        snapshotHistory['-1'] = {
            data: m.all().slice(0, -1).map(sh => JSON.parse(JSON.stringify(sh.json()))), // 只保存数据表
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

        // 5. 插入到扩展设置按钮后面，如果找不到则追加到工具栏末尾
        if ($extBtn.length > 0) {
            $extBtn.after($wrapper);
            console.log('✅ 按钮已插入到扩展设置按钮之后');
        } else {
            $('#top-settings-holder').append($wrapper);
            console.log('⚠️ 未找到扩展按钮，追加到工具栏末尾');
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
                // 🔥 [核心修复] 使用 Hook 系统或 Fetch Hijack 解决异步竞态条件
                if (window.hooks && typeof window.hooks.addFilter === 'function') {
                    // Modern SillyTavern: 使用 Hook 系统
                    console.log('✅ [初始化] 使用 Modern Hook 系统注册 chat_completion_prompt_ready (支持异步等待)');
                    window.hooks.addFilter('chat_completion_prompt_ready', async (chat) => {
                        // Hook Filter 接收 chat 数组，需要包装成 opmt 期望的格式
                        await opmt({ chat: chat });
                        // 向量检索在 opmt 之后单独执行
                        await executeVectorSearch(chat);
                        return chat; // Filter 必须返回修改后的数据
                    });
                } else {
                    // Legacy SillyTavern: 使用 Fetch Hijack + 智能注入

                    // 注册传统事件监听器（用于表格注入等功能）
                    x.eventSource.on(x.event_types.CHAT_COMPLETION_PROMPT_READY, function (ev) {
                        opmt(ev); // 处理快照和表格注入
                    });

                    // 🔥 劫持 window.fetch 以在发送请求前强制等待向量检索
                    const originalFetch = window.fetch;
                    window.fetch = async function(...args) {
                        const url = args[0] ? args[0].toString() : '';

                        // 检查是否是生成请求
                        if (url.includes('/api/backends/chat-completions/generate') ||
                            url.includes('/generate') ||
                            url.includes('/v1/chat/completions')) {
                            console.log('🛑 [Fetch Hijack] 生成请求已拦截，暂停以执行向量检索...');

                            try {
                                // 在发送前获取当前 chat 状态
                                const ctx = SillyTavern.getContext();
                                if (ctx && ctx.chat) {
                                    // 🔥 强制等待向量检索完成，并获取向量内容文本
                                    const vectorText = await executeVectorSearch(ctx.chat);
                                    console.log(`✅ [Fetch Hijack] 向量检索完成，内容长度: ${vectorText.length}`);

                                    // 🔥 CRITICAL: 智能注入 - 直接修改请求体
                                    if (args[1] && args[1].body && vectorText) {
                                        // 🛡️ SAFETY: 防止双重注入 - 如果请求体已包含向量内容，跳过
                                        if (args[1].body.includes(vectorText)) {
                                            console.warn('⚠️ [Fetch Hijack] 检测到向量内容已存在，跳过注入防止重复');
                                            console.log('▶️ [Fetch Hijack] 直接放行请求');
                                            return originalFetch.apply(this, args);
                                        }

                                        try {
                                            let bodyObj = JSON.parse(args[1].body);
                                            let injected = false; // 标记是否已注入

                                            // 使用正则表达式匹配 [Start a new Chat]（不区分大小写）
                                            const startChatRegex = /\[Start a new chat\]/i;

                                            // 递归遍历注入函数
                                            const injectContent = (obj) => {
                                                for (let key in obj) {
                                                    if (typeof obj[key] === 'string') {
                                                        // 情况 A (最高优先级): 替换 {{VECTOR_MEMORY}} 标签
                                                        if (obj[key].includes('{{VECTOR_MEMORY}}')) {
                                                            obj[key] = obj[key].replace(/\{\{VECTOR_MEMORY\}\}/g, vectorText);
                                                            console.log(`🎯 [智能注入] 在 ${key} 中找到并替换 {{VECTOR_MEMORY}} 标签`);
                                                            injected = true;
                                                        }
                                                        // 情况 B (兜底策略): 在 [Start a new Chat] 前插入（使用正则保留原始大小写）
                                                        else if (!injected && startChatRegex.test(obj[key])) {
                                                            // 使用正则替换，保留原始标签
                                                            obj[key] = obj[key].replace(startChatRegex, (match) => {
                                                                return vectorText + '\n\n' + match;
                                                            });
                                                            console.log(`🎯 [智能注入] 在 ${key} 的 [Start a new Chat] 前插入向量内容`);
                                                            injected = true;
                                                        }
                                                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                                        injectContent(obj[key]);
                                                    }
                                                }
                                            };

                                            // 执行智能注入
                                            injectContent(bodyObj);

                                            if (injected) {
                                                // 更新请求体
                                                args[1].body = JSON.stringify(bodyObj);
                                                console.log('✅ [Fetch Hijack] 智能注入完成');

                                                // 🔥 CRITICAL: 强制更新探针数据，确保向量内容显示为 SYSTEM
                                                try {
                                                    const finalBody = JSON.parse(args[1].body);
                                                    let debugChat = [];

                                                    // 提取 chat 数组（兼容多种 API 格式）
                                                    if (finalBody.messages) {
                                                        debugChat = finalBody.messages;
                                                    } else if (finalBody.contents) {
                                                        debugChat = finalBody.contents;
                                                    } else if (finalBody.prompt) {
                                                        debugChat = Array.isArray(finalBody.prompt)
                                                            ? finalBody.prompt
                                                            : [{role: 'user', content: finalBody.prompt}];
                                                    }

                                                    // 🔥 强制标记包含向量内容的消息为 SYSTEM
                                                    let markedCount = 0;
                                                    debugChat.forEach((msg, idx) => {
                                                        let content = msg.content ||
                                                                     (msg.parts && msg.parts[0] ? msg.parts[0].text : '') ||
                                                                     (msg.text) ||
                                                                     '';

                                                        // 如果消息包含向量文本，强制设置为 SYSTEM
                                                        if (vectorText && content.includes(vectorText)) {
                                                            // 强制覆盖角色属性
                                                            msg.role = 'system';
                                                            msg.isGaigaiVector = true;
                                                            msg.name = '向量化';

                                                            // 确保没有其他角色标记
                                                            delete msg.is_user;

                                                            markedCount++;
                                                            console.log(`🏷️ [探针] 消息 #${idx} 已强制标记为 SYSTEM (向量化)`);
                                                        }
                                                    });

                                                    // 保存到全局探针（覆盖 opmt 中的设置）
                                                    window.Gaigai.lastRequestData = {
                                                        chat: debugChat,
                                                        timestamp: Date.now(),
                                                        model: API_CONFIG.model || 'Unknown'
                                                    };
                                                    console.log(`✅ [探针] 已更新 lastRequestData (标记了 ${markedCount} 条向量消息)`);

                                                } catch (probeError) {
                                                    console.error('❌ [探针] 更新失败:', probeError);
                                                }

                                            } else if (vectorText) {
                                                console.warn('⚠️ [Fetch Hijack] 未找到注入点，向量内容未被使用');
                                            }

                                        } catch (parseError) {
                                            console.error('❌ [Fetch Hijack] 解析请求体失败:', parseError);
                                            console.error('请求体内容:', args[1].body.substring(0, 500));
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error('❌ [Fetch Hijack] 向量检索过程出错:', e);
                            }

                            console.log('▶️ [Fetch Hijack] 向量检索完成，恢复请求发送');
                        }

                        // 继续执行原始请求（使用原始或修改后的参数）
                        return originalFetch.apply(this, args);
                    };

                    console.log('✅ [Fetch Hijack] window.fetch 已成功劫持');
                }

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
                        // ✅ [安全补丁] 找不到上一楼快照时，检查是否是高楼层刷新后的情况
                        if (id > 5 && snapshotHistory['-1']) {
                            console.warn(`🛑 [安全拦截] 第 ${id} 楼缺失中间快照（可能是刷新后），禁止回滚到初始状态，保持当前数据。`);
                        } else {
                            console.warn(`⚠️ [Swipe] 警告: 找不到上一楼 [${prevKey}] 的快照，跳过回滚以保护数据。`);
                        }
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
    const maxRetries = 50; // 最多重试50次（25秒）- 确保 window.hooks 加载完成

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

    // 🔧 自动获取 index.js 所在的目录路径（终极动态版）
    function getExtensionPath() {
        // 遍历脚本标签定位插件路径
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].getAttribute('src');
            if (!src) continue;

            // 只要路径包含插件文件夹名，就认为是它
            if (src.includes('ST-Memory-Context/index.js')) {
                return src.replace(/\/index\.js$/i, '').replace(/\\index\.js$/i, '');
            }
        }

        console.error('❌ [Gaigai] 无法定位插件路径，依赖加载将失败！请检查文件夹名称是否为 ST-Memory-Context');
        return '';
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

                // 🆕 加载 io_manager.js
                const ioManagerUrl = `${EXTENSION_PATH}/io_manager.js`;
                $.getScript(ioManagerUrl)
                    .done(function () {
                        console.log('✅ [Loader] io_manager.js 加载成功');

                        // 🆕 加载 backfill_manager.js
                        const backfillManagerUrl = `${EXTENSION_PATH}/backfill_manager.js`;
                        $.getScript(backfillManagerUrl)
                            .done(function () {
                                console.log('✅ [Loader] backfill_manager.js 加载成功');

                                // 🆕 加载 world_info.js (必须在 summary_manager 之前加载)
                                const worldInfoUrl = `${EXTENSION_PATH}/world_info.js`;
                                $.getScript(worldInfoUrl)
                                    .done(function () {
                                        console.log('✅ [Loader] world_info.js 加载成功');

                                        // 🆕 加载 summary_manager.js
                                        const summaryManagerUrl = `${EXTENSION_PATH}/summary_manager.js`;
                                        $.getScript(summaryManagerUrl)
                                            .done(function () {
                                                console.log('✅ [Loader] summary_manager.js 加载成功');

                                                // 🆕 加载 debug_manager.js
                                                const debugManagerUrl = `${EXTENSION_PATH}/debug_manager.js`;
                                                $.getScript(debugManagerUrl)
                                                    .done(function () {
                                                        console.log('✅ [Loader] debug_manager.js 加载成功');

                                                        // 🆕 加载 vector_manager.js
                                                        const vectorManagerUrl = `${EXTENSION_PATH}/vector_manager.js`;
                                                        $.getScript(vectorManagerUrl)
                                                            .done(function () {
                                                                console.log('✅ [Loader] vector_manager.js 加载成功');

                                                                // ✨ 验证模块是否成功挂载
                                                                if (!window.Gaigai.IOManager) {
                                                                    console.error('⚠️ [Loader] window.Gaigai.IOManager 未成功挂载！');
                                                                    console.error(`📍 尝试加载的 URL: ${ioManagerUrl}`);
                                                                }
                                                                if (!window.Gaigai.SummaryManager) {
                                                                    console.error('⚠️ [Loader] window.Gaigai.SummaryManager 未成功挂载！');
                                                                    console.error(`📍 尝试加载的 URL: ${summaryManagerUrl}`);
                                                                }
                                                                if (!window.Gaigai.BackfillManager) {
                                                                    console.error('⚠️ [Loader] window.Gaigai.BackfillManager 未成功挂载！');
                                                                    console.error(`📍 尝试加载的 URL: ${backfillManagerUrl}`);
                                                                }
                                                                if (!window.Gaigai.WI) {
                                                                    console.error('⚠️ [Loader] window.Gaigai.WI 未成功挂载！');
                                                                    console.error(`📍 尝试加载的 URL: ${worldInfoUrl}`);
                                                                }
                                                                if (!window.Gaigai.DebugManager) {
                                                                    console.error('⚠️ [Loader] window.Gaigai.DebugManager 未成功挂载！');
                                                                    console.error(`📍 尝试加载的 URL: ${debugManagerUrl}`);
                                                                }
                                                                if (!window.Gaigai.VM) {
                                                                    console.error('⚠️ [Loader] window.Gaigai.VM 未成功挂载！');
                                                                    console.error(`📍 尝试加载的 URL: ${vectorManagerUrl}`);
                                                                }

                                                                // 所有依赖加载完后，再启动主初始化流程
                                                                setTimeout(tryInit, 500);
                                                            })
                                                            .fail(function (jqxhr, settings, exception) {
                                                                console.error('❌ [Loader] vector_manager.js 加载失败！');
                                                                console.error(`📍 尝试加载的 URL: ${vectorManagerUrl}`);
                                                                console.error(`📍 HTTP 状态码: ${jqxhr.status}`);
                                                                console.error(`📍 错误详情:`, exception);
                                                                console.error(`💡 提示：请检查文件是否存在，或控制台 Network 面板查看具体错误`);
                                                                // 即使加载失败，也继续初始化（降级模式）
                                                                setTimeout(tryInit, 500);
                                                            });
                                                    })
                                            .fail(function (jqxhr, settings, exception) {
                                                console.error('❌ [Loader] debug_manager.js 加载失败！');
                                                console.error(`📍 尝试加载的 URL: ${debugManagerUrl}`);
                                                console.error(`📍 HTTP 状态码: ${jqxhr.status}`);
                                                console.error(`📍 错误详情:`, exception);
                                                console.error(`💡 提示：请检查文件是否存在，或控制台 Network 面板查看具体错误`);
                                                // 即使加载失败，也继续初始化（降级模式）
                                                setTimeout(tryInit, 500);
                                            });
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
                                console.error('❌ [Loader] world_info.js 加载失败！');
                                console.error(`📍 尝试加载的 URL: ${worldInfoUrl}`);
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
                console.error('❌ [Loader] io_manager.js 加载失败！');
                console.error(`📍 尝试加载的 URL: ${ioManagerUrl}`);
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

    // ✅✅✅ 直接把核心变量挂到 window.Gaigai 上 (使用 Object.assign 防止覆盖子模块)
    Object.assign(window.Gaigai, {
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
        goBack: goBack,  // ✅ 新增：暴露返回函数
        loadConfig: loadConfig,  // ✨ 供子模块使用
        markAsSummarized: markAsSummarized,  // ✅ 总结模块需要
        updateCurrentSnapshot: updateCurrentSnapshot,  // ✅ 子模块需要
        refreshTable: refreshTable,  // ✅ 子模块需要
        updateTabCount: updateTabCount,  // ✅ 子模块需要
        syncToWorldInfo: (...args) => window.Gaigai.WI.syncToWorldInfo(...args),  // ✅ 总结模块需要同步到世界书（兼容性包装）
        getCsrfToken: getCsrfToken,  // ✅ WI 模块需要
        customRetryAlert: customRetryAlert  // ✅ 重试弹窗
    });

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

    // ✅ 工具函数直接暴露到 window.Gaigai
    window.Gaigai.saveSnapshot = saveSnapshot;
    window.Gaigai.restoreSnapshot = restoreSnapshot;

    // === 🔌 核心工具集（供子模块使用）===
    // 所有工具函数统一挂载到 window.Gaigai.tools 下，避免全局命名空间污染
    window.Gaigai.tools = {
        callIndependentAPI,
        callTavernAPI,
        prs,
        exe,
        filterContentByTags
    };

    console.log('✅ window.Gaigai 已挂载', window.Gaigai);
    console.log('✅ [核心工具] 已公开给子模块使用（命名空间隔离）');

    // 启动加载器（在 window.Gaigai 完全初始化之后）
    loadDependencies();


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
                <div style="font-size:18px; font-weight:bold; margin-bottom:5px; color:var(--g-tc);">
                    📘 记忆表格 (Memory Context)
                </div>
                <div style="font-size:12px; opacity:0.8; margin-bottom:8px; color:var(--g-tc);">当前版本: v${cleanVer}</div>
                <div id="update-status" style="background:rgba(0,0,0,0.05); padding:6px; border-radius:4px; font-size:11px; display:flex; align-items:center; justify-content:center; gap:8px; color:var(--g-tc);">
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
                    <h4 style="margin-top:0; margin-bottom:10px; color:var(--g-tc); display:flex; align-items:center; gap:6px;">
                        📢 本次更新内容 (v${cleanVer})
                    </h4>
                    <ul style="margin:0; padding-left:20px; font-size:12px; color:var(--g-tc); opacity:0.9;">
                        <li><strong>修复bug ：</strong>修复修改提示词后，提示词无法被保存发送的问题</li>
                        <li><strong>优化隐藏楼层 ：</strong>隐藏楼层自动清除上下文图片，避免图片太大导致报错的问题。</li>
                        <li><strong>修复bug ：</strong>修复静默模式下手动填表和批量填表保存设置冲突的问题</li>
                </div>

                <!-- 📘 第二部分：功能指南 -->
                <div>
                    <h4 style="margin-top:0; margin-bottom:10px; color:var(--g-tc); opacity:0.9;">
                        📘 功能介绍 & 新手引导
                    </h4>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                        <div style="background:rgba(255,255,255,0.3); padding:10px; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                            <div style="font-weight:bold; margin-bottom:4px; color:var(--g-tc); font-size:12px;">📊 填表模式 (二选一)</div>
                            <div style="font-size:11px; color:var(--g-tc); opacity:0.8;">
                                • <strong>实时填表：</strong> 每回合都写。优点是实时性强，缺点是费钱/慢。<br>
                                • <strong>批量填表：</strong> 每N楼写一次。优点是省Token、速度快。<br>
                                <span style="opacity:0.6; font-size:10px;">(推荐开启批量填表 + 独立API)</span>
                            </div>
                        </div>
                        <div style="background:rgba(255,255,255,0.3); padding:10px; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                            <div style="font-weight:bold; margin-bottom:4px; color:var(--g-tc); font-size:12px;">📝 总结模式</div>
                            <div style="font-size:11px; color:var(--g-tc); opacity:0.8;">
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
                    <a href="${repoUrl}" target="_blank" style="text-decoration:none; color:var(--g-tc); border-bottom:1px dashed var(--g-tc);">
                       🔗 GitHub 项目主页
                    </a>
                    <span style="margin: 0 10px; opacity: 0.5;">|</span>
                    <a href="https://pcnsnlcapni4.feishu.cn/wiki/AfPuwMlCSieXbckthFUc5bQYnMe" target="_blank" style="text-decoration:none; color:var(--g-tc); border-bottom:1px dashed var(--g-tc);">
                       📖 详细使用说明书
                    </a>
                </div>
            </div>

            <div style="padding-top:5px; border-top:1px solid rgba(255,255,255,0.2); text-align:right; flex-shrink:0;">
                <label style="font-size:12px; cursor:pointer; user-select:none; display:inline-flex; align-items:center; gap:6px; color:var(--g-tc); opacity:0.9;">
                    <input type="checkbox" id="dont-show-again" ${isChecked ? 'checked' : ''}>
                    不再自动弹出 v${cleanVer} 说明
                </label>
            </div>
        </div>`;

        $('#gai-about-pop').remove();
        const $o = $('<div>', { id: 'gai-about-pop', class: 'g-ov', css: { 'z-index': '10000002' } });
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
        }, 100);

        $o.on('click', e => { if (e.target === $o[0]) $o.remove(); });
    }


    async function checkForUpdates(currentVer) {
        // 1. 获取UI元素
        const $status = $('#update-status'); // 说明页里的状态文字
        const $icon = $('#gai-about-btn');     // 标题栏的图标

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
                                ⬆️ 发现新版本: v${latestVer} (请手动更新)
                            </div>
                            <div style="font-size:10px; color:var(--g-tc); opacity:0.8; margin-top:4px;">
                                由于网络环境差异，请前往 GitHub 下载或使用 git pull 更新
                            </div>
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

                        // 表格/总结数据
                        if (msg.isGaigaiData) {
                            // ✅ 修复：优先显示动态名字 (如 sys(总结1))，没有则显示默认
                            roleName = msg.name || 'MEMORY (记忆表格)';
                            roleColor = '#d35400'; icon = '📊';
                        }

                        // 提示词
                        if (msg.isGaigaiPrompt) {
                            roleName = 'PROMPT (提示词)';
                            roleColor = '#e67e22';
                            icon = '📌';
                        }

                        // ✅ 新增：向量化数据识别
                        if (msg.isGaigaiVector) {
                            roleName = 'SYSTEM (向量化)';
                            roleColor = '#e91e63'; // 使用粉色，与向量化主题一致
                            icon = '💠';
                        }
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
                        <input type="text" id="gai-probe-search-input" placeholder="搜索..."
                            style="width:100%; padding:8px 10px; padding-left:30px; border:1px solid rgba(255,255,255,0.3); border-radius:4px; background:rgba(0,0,0,0.2); color:${UI.tc}; font-size:12px; outline:none;">
                        <i class="fa-solid fa-search" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.6); font-size:12px;"></i>
                    </div>
                </div>
                <div id="gai-probe-list" style="flex:1; overflow-y:auto; padding-right:5px;">${listHtml}</div>
            </div>`;

                if (pop) {
                    pop('🔍 最后发送内容 & Toke', h, true);
                    setTimeout(() => {
                        $('#gai-probe-search-input').on('input', function () {
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