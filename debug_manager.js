/**
 * ⚡ Gaigai记忆插件 - 调试管理模块
 *
 * 功能：提供调试和维护工具（清除缓存、重置配置等）
 *
 * @version 2.1.0
 * @author Gaigai Team
 */

(function() {
    'use strict';

    class DebugManager {
        constructor() {
            // 日志存储数组（最大100条，平衡性能和调试需求）
            this.logs = [];
            this.maxLogs = 100;

            // 保存原始 console 方法
            this.originalConsole = {
                log: console.log.bind(console),
                warn: console.warn.bind(console),
                error: console.error.bind(console)
            };

            // 劫持 console.log
            console.log = (...args) => {
                if (this._shouldPrintInfo(args)) {
                    this.originalConsole.log(...args);
                }
                this.addLog('info', args);
            };

            // 劫持 console.warn
            console.warn = (...args) => {
                this.originalConsole.warn(...args);
                this.addLog('warn', args);
            };

            // 劫持 console.error
            console.error = (...args) => {
                this.originalConsole.error(...args);
                this.addLog('error', args);
            };

            // 劫持 window.onerror
            this.originalOnError = window.onerror;
            window.onerror = (message, source, lineno, colno, error) => {
                this.addLog('error', [`${message} at ${source}:${lineno}:${colno}`, error]);
                if (this.originalOnError) {
                    return this.originalOnError(message, source, lineno, colno, error);
                }
                return false;
            };

            // 初始化网络请求拦截
            this._initNetworkCapture();

            console.log('✅ [DebugManager] 初始化完成');
        }

        /**
         * 读取最小日志模式开关（优先运行时配置，兜底本地存储）
         * @returns {boolean}
         */
        _isMinimalLogMode() {
            const runtimeFlag = window.Gaigai?.config_obj?.minimalLogMode;
            if (typeof runtimeFlag === 'boolean') return runtimeFlag;

            try {
                const raw = localStorage.getItem('gg_config');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (typeof parsed?.minimalLogMode === 'boolean') {
                        return parsed.minimalLogMode;
                    }
                }
            } catch (e) {
                // ignore parse errors
            }

            return true; // 默认启用最小日志
        }

        /**
         * 最小日志过滤：仅保留权限命中与拦截结果
         * @param {Array} args
         * @returns {boolean}
         */
        _shouldPrintInfo(args) {
            if (!this._isMinimalLogMode()) return true;

            const msg = args.map(arg => {
                if (typeof arg === 'string') return arg;
                if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
                return '';
            }).join(' ');

            // 1) 权限命中日志
            if (msg.includes('[权限管控]')) return true;

            // 2) 拦截结果日志（仅保留结果，不保留过程噪音）
            if (msg.includes('[Fetch Hijack]')) {
                return (
                    msg.includes('拦截') ||
                    msg.includes('跳过') ||
                    msg.includes('放行') ||
                    msg.includes('完成') ||
                    msg.includes('恢复请求发送') ||
                    msg.includes('失败') ||
                    msg.includes('出错')
                );
            }

            // 3) 向量检索最终结果
            if (msg.includes('[向量检索]')) {
                return msg.includes('跳过') || msg.includes('检索完成') || msg.includes('未找到');
            }

            return false;
        }

        /**
         * 初始化网络请求拦截
         * 劫持 window.fetch，自动捕获网络请求错误（4xx/5xx）
         */
        _initNetworkCapture() {
            // 保存原始 fetch
            const originalFetch = window.fetch;

            // 劫持 fetch
            window.fetch = async (...args) => {
                const [url, options = {}] = args;
                const method = (options.method || 'GET').toUpperCase();

                try {
                    // 调用原始 fetch
                    const response = await originalFetch(...args);

                    // 检查响应状态
                    if (!response.ok) {
                        // 构造错误信息
                        const urlStr = typeof url === 'string' ? url : url.toString();
                        const errorMessage = `[Network Error] ${method} ${urlStr} - ${response.status} ${response.statusText}`;

                        // 记录到日志
                        this.addLog('error', [errorMessage]);
                    }

                    // 返回原始响应（不影响业务逻辑）
                    return response;
                } catch (error) {
                    // 捕获网络异常（如断网、CORS 错误等）
                    const urlStr = typeof url === 'string' ? url : url.toString();
                    const errorMessage = `[Network Failure] ${method} ${urlStr} - ${error.message}`;

                    // 记录到日志
                    this.addLog('error', [errorMessage]);

                    // 重新抛出异常，不吞掉错误
                    throw error;
                }
            };

            console.log('✅ [DebugManager] 网络请求拦截已启用');
        }

        /**
         * 添加日志到存储数组
         * @param {string} type - 日志类型 (info, warn, error)
         * @param {Array} args - 日志参数
         */
        addLog(type, args) {
            const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');

            // 保存完整日志，截断逻辑移到展示层
            this.logs.push({ type, timestamp, message });

            // 限制日志数量
            if (this.logs.length > this.maxLogs) {
                this.logs.shift();
            }
        }

        /**
         * 健壮的夜间模式检测
         * 从多个来源检测，确保准确性
         * @returns {boolean} 是否为夜间模式
         */
        getDarkMode() {
            console.log('[DebugManager] 🔍 开始检测夜间模式...');

            // 1. 最高优先级：直接从 localStorage 读取（最可靠的持久化存储）
            try {
                const savedUI = localStorage.getItem('gg_ui');
                console.log('[DebugManager] 📦 localStorage gg_ui:', savedUI ? '存在' : '不存在');
                if (savedUI) {
                    const parsed = JSON.parse(savedUI);
                    console.log('[DebugManager] 📦 parsed.darkMode =', parsed.darkMode);
                    if (typeof parsed.darkMode === 'boolean') {
                        console.log('[DebugManager] ✅ 方法1: localStorage darkMode =', parsed.darkMode);
                        return parsed.darkMode;
                    }
                }
            } catch (e) {
                console.warn('[DebugManager] ❌ 方法1失败: 读取 localStorage darkMode 失败:', e);
            }

            // 2. 备用：从 window.Gaigai.ui.darkMode 读取
            if (window.Gaigai && window.Gaigai.ui && typeof window.Gaigai.ui.darkMode === 'boolean') {
                console.log('[DebugManager] ✅ 方法2: window.Gaigai.ui.darkMode =', window.Gaigai.ui.darkMode);
                return window.Gaigai.ui.darkMode;
            }
            console.log('[DebugManager] ⚠️ 方法2失败: window.Gaigai.ui.darkMode 不可用');

            // 3. 最后：通过颜色值推断（深色主题色通常是深色）
            if (window.Gaigai && window.Gaigai.ui && window.Gaigai.ui.c) {
                const color = window.Gaigai.ui.c.toLowerCase();
                console.log('[DebugManager] 🎨 主题色:', color);
                // 如果主题色是深色（如 #252525），则判定为夜间模式
                if (color.startsWith('#') && color.length >= 7) {
                    const r = parseInt(color.substr(1, 2), 16);
                    const g = parseInt(color.substr(3, 2), 16);
                    const b = parseInt(color.substr(5, 2), 16);
                    const brightness = (r + g + b) / 3;
                    const isDark = brightness < 128;
                    console.log('[DebugManager] 🎨 亮度:', brightness, '判定为:', isDark ? '夜间' : '白天');
                    return isDark;
                }
            }
            console.log('[DebugManager] ⚠️ 方法3失败: 无法通过颜色推断');

            // 4. 默认：返回 false（白天模式）
            console.log('[DebugManager] ⚠️ 使用默认值: false (白天模式)');
            return false;
        }

        /**
         * 清除本地缓存
         * 用于解决配置错乱、卡顿等问题
         */
        async clearCache() {
            // 1. 显示确认对话框
            const confirmed = await window.Gaigai.customConfirm(
                '⚠️ 即将清除所有本地缓存数据！\n\n' +
                '这将重置：\n' +
                '• 所有本地配置（API密钥、提示词等）\n' +
                '• UI设置（主题、布局等）\n' +
                '• 本地存档数据\n\n' +
                '✅ 服务器端数据（云端存档）不会受影响\n\n' +
                '清除后页面将自动刷新，请确认是否继续？',
                '🧹 清除本地缓存'
            );

            if (!confirmed) {
                console.log('🛑 [清除缓存] 用户取消操作');
                return;
            }

            // 2. 开始清除缓存
            console.log('🧹 [清除缓存] 开始清除本地缓存...');

            let removedCount = 0;
            const keysToRemove = [];

            // 2.1 收集所有需要删除的键
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('gg_') || key.startsWith('gai_'))) {
                    keysToRemove.push(key);
                }
            }

            // 2.2 删除特定的已知键（防止遗漏）
            const specificKeys = [
                'gg_config',
                'gg_api',
                'gg_ui',
                'gg_timestamp',
                'gg_notice_ver',
                'gg_profiles'
            ];

            specificKeys.forEach(key => {
                if (!keysToRemove.includes(key)) {
                    keysToRemove.push(key);
                }
            });

            // 2.3 执行删除
            keysToRemove.forEach(key => {
                try {
                    localStorage.removeItem(key);
                    removedCount++;
                    console.log(`  🗑️ 已删除: ${key}`);
                } catch (e) {
                    console.error(`  ❌ 删除失败: ${key}`, e);
                }
            });

            console.log(`✅ [清除缓存] 完成！共删除 ${removedCount} 个缓存项`);

            // 3. 显示成功通知
            if (typeof toastr !== 'undefined') {
                toastr.success(
                    `已清除 ${removedCount} 个缓存项\n页面即将刷新...`,
                    '🧹 清除成功',
                    { timeOut: 2000 }
                );
            } else {
                await window.Gaigai.customAlert(
                    `✅ 已清除 ${removedCount} 个缓存项\n\n页面即将刷新...`,
                    '清除成功'
                );
            }

            // 4. 延迟1秒后刷新页面
            setTimeout(() => {
                console.log('🔄 [清除缓存] 刷新页面...');
                location.reload();
            }, 1000);
        }

        /**
         * 导出诊断信息（预留接口，未来可扩展）
         */
        exportDiagnostics() {
            const diagnostics = {
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                localStorage: {},
                gaigaiVersion: window.Gaigai?.VERSION || 'unknown'
            };

            // 收集所有 gg_ 和 gai_ 开头的键（但不包含敏感信息）
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('gg_') || key.startsWith('gai_'))) {
                    // 排除敏感键
                    if (key.includes('api') || key.includes('key') || key.includes('token')) {
                        diagnostics.localStorage[key] = '[REDACTED]';
                    } else {
                        try {
                            const value = localStorage.getItem(key);
                            diagnostics.localStorage[key] = value ? value.substring(0, 100) : null;
                        } catch (e) {
                            diagnostics.localStorage[key] = '[ERROR]';
                        }
                    }
                }
            }

            console.log('📊 [诊断信息]', diagnostics);
            return diagnostics;
        }

        /**
         * 显示最后一次请求的详细信息（Probe 探针模块）
         * 用于调试和查看发送给 AI 的完整上下文
         */
        showLastRequest() {
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

            // ⚠️ 使用健壮的夜间模式检测，避免引用过期问题
            const UI = window.Gaigai.ui || { c: '#888888', tc: '#333', darkMode: false };

            const esc = window.Gaigai.esc || ((t) => t);
            const pop = window.Gaigai.pop;
            const chat = lastData.chat;
            let totalTokens = 0;
            let listHtml = '';

            // 🌙 夜间模式适配：使用 getDarkMode() 方法获取准确状态
            const isDark = this.getDarkMode();
            let itemBg, summaryBg, contentBg, borderColor;
            if (isDark) {
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

            // 🎨 头部背景渐变：夜间强制深灰色，白天使用主题色
            const probeHeaderBg = isDark
                ? 'linear-gradient(135deg, #2b2b2b 0%, #1a1a1a 100%)'
                : 'linear-gradient(135deg, ' + UI.c + 'EE, ' + UI.c + '99)';

            // 🎨 标记框背景色：夜间使用深色，白天使用主题色
            const tagBg = isDark ? '#333333' : window.Gaigai.ui.c;
            // 🎨 标记框文字颜色：夜间白色，白天根据主题色亮度自动调整（优先使用 index.js 的文字颜色）
            const tagColor = isDark ? '#fff' : (window.Gaigai.ui.tc || '#000');

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
                        // ✅ 优先使用动态名字 (如 SYSTEM (Merged))，没有则显示默认
                        roleName = msg.name || 'SYSTEM (向量化)';
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
                            <span style="background:${tagBg}; color:${tagColor}; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:normal;">#${idx}</span>
                        </div>
                        <div style="font-size:11px; font-family:monospace; color:${tagColor}; background:${tagBg}; padding:2px 6px; border-radius:4px;">
                            ${tokens} TK
                        </div>
                    </summary>
                    <div class="g-probe-content" style="padding:10px; font-size:12px; line-height:1.6; color:${window.Gaigai.ui.tc}; border-top:1px solid ${borderColor}; white-space:pre-wrap; font-family:'Segoe UI', monospace; word-break:break-word; max-height: 500px; overflow-y: auto; background: ${contentBg};">${esc(content)}</div>
                </details>`;
            });

            const h = `
            <div class="g-p" style="padding:15px; height:100%; display:flex; flex-direction:column;">
                <div style="flex:0 0 auto; background: ${probeHeaderBg}; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.25); color:${window.Gaigai.ui.tc}; padding:15px; border-radius:8px; margin-bottom:15px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
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
                            style="width:100%; padding:8px 10px; padding-left:30px; border:1px solid rgba(255,255,255,0.3); border-radius:4px; background:rgba(0,0,0,0.2); color:${window.Gaigai.ui.tc}; font-size:12px; outline:none;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                        <i class="fa-solid fa-search" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.6); font-size:12px;"></i>
                    </div>
                </div>
                <div id="gai-probe-list" style="flex:1; overflow-y:auto; padding-right:5px;">${listHtml}</div>
            </div>`;

            if (pop) {
                pop('🔍 最后发送内容 & Token', h, true);
                setTimeout(() => {
                    $('#gai-probe-search-input').on('input', function () {
                        const val = $(this).val().trim();
                        const lowerVal = val.toLowerCase();

                        // 高亮样式：暗黄背景+白字 (适配夜间模式)
                        const highlightStyle = 'background:#b8860b; color:#fff; font-weight:bold; border-radius:2px; box-shadow:0 0 2px rgba(0,0,0,0.5);';

                        let firstMatch = null; // 记录第一个匹配项

                        $('.g-probe-item').each(function () {
                            const $details = $(this);
                            const $content = $details.find('.g-probe-content');

                            // 1. 首次搜索时缓存原始纯文本 (避免反复读取DOM导致性能下降)
                            if ($content.data('raw-text') === undefined) {
                                $content.data('raw-text', $content.text());
                            }
                            const rawText = $content.data('raw-text');

                            // 2. 清空搜索时：恢复默认状态
                            if (!val) {
                                $details.show().removeAttr('open').css('border', `1px solid ${borderColor}`);
                                $content.html(window.Gaigai.esc(rawText)); // 恢复无高亮的转义文本
                                return;
                            }

                            // 3. 匹配逻辑
                            if (rawText.toLowerCase().includes(lowerVal)) {
                                $details.show().attr('open', true).css('border', `2px solid ${window.Gaigai.ui.c}`);

                                // 记录第一个匹配项
                                if (!firstMatch) {
                                    firstMatch = $details;
                                }

                                // --- 高亮核心逻辑 ---
                                // 转义正则特殊字符 (防止搜 ? * 等报错)
                                const safeVal = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                // 创建正则 (全局+忽略大小写)
                                const regex = new RegExp(`(${safeVal})`, 'gi');

                                // 拆分并重组 HTML
                                const parts = rawText.split(regex);
                                const highlightedHtml = parts.map(part => {
                                    if (part.toLowerCase() === lowerVal) {
                                        // 命中部分：加高亮
                                        return `<span style="${highlightStyle}">${window.Gaigai.esc(part)}</span>`;
                                    } else {
                                        // 普通部分：仅转义
                                        return window.Gaigai.esc(part);
                                    }
                                }).join('');

                                $content.html(highlightedHtml);
                                // -------------------

                            } else {
                                $details.hide();
                            }
                        });

                        // 🎯 自动滚动到第一个匹配项
                        if (firstMatch && val) {
                            const $container = $('#gai-probe-list');
                            if ($container.length) {
                                const containerTop = $container.scrollTop();
                                const itemTop = firstMatch.position().top;
                                const targetScroll = containerTop + itemTop - 10; // 留10px边距
                                $container.scrollTop(targetScroll);
                            }
                        }
                    });
                }, 100);
            } else {
                alert('UI库未加载');
            }
        }

        /**
         * 显示历史存档恢复界面（Rescue 数据恢复模块）
         * 用于从本地存储中恢复历史数据
         */
        async showRescueUI() {
            // 访问全局变量
            const m = window.Gaigai.m;
            const UI = window.Gaigai.ui;
            const shw = window.Gaigai.shw;
            const customAlert = window.Gaigai.customAlert;
            const customConfirm = window.Gaigai.customConfirm;
            const summarizedRows = window.Gaigai.summarizedRows;

            // === 🌙 变量定义区 ===
            // ⚠️ 使用健壮的 getDarkMode() 方法获取准确状态
            const isDark = this.getDarkMode();

            // 🎨 根据 isDark 动态设置颜色
            const bgColor = isDark ? '#1e1e1e' : '#fff';
            const txtColor = isDark ? '#ffffff' : (UI.tc || '#000000');
            const tableHeaderBg = isDark ? '#252525' : (UI.c || '#dfdcdcff'); // 夜间强制深色，白天使用用户配置
            const borderColor = isDark ? '1px solid rgba(255,255,255,0.15)' : 'none';
            const rowBorder = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee';
            const shadow = isDark ? '0 10px 40px rgba(0,0,0,0.6)' : '0 5px 20px rgba(0,0,0,0.3)';
            const btnDefColor = txtColor;
            const btnBorderColor = isDark ? 'rgba(255,255,255,0.3)' : (UI.c || '#dfdcdcff');
            const closeBtnBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0';
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
                    <table style="width:100%; font-size:11px; border-collapse: collapse; table-layout:fixed;">
                        <thead style="position:sticky; top:0; background:${tableHeaderBg}; color:#fff;">
                            <tr>
                                <th style="padding:8px 6px; width:50%;">时间</th>
                                <th style="padding:8px 4px; width:25%;">数据量</th>
                                <th style="padding:8px 4px; width:25%;">操作</th>
                            </tr>
                        </thead>
                        <tbody>${backups.map(b => {
                const countStyle = b.count > 0 ? 'color:#28a745; font-weight:bold;' : (isDark ? 'color:#777;' : 'color:#999;');
                const subTextStyle = isDark ? 'color:#888;' : 'color:#999;';

                // 📱 优化：缩短时间显示，只保留日期和时间，去掉秒
                const shortDate = b.dateStr.replace(/:\d{2}(?:\s|$)/, '').replace(/\d{4}\//, ''); // 去掉秒和年份

                // ✨ 修改：按钮 style 中的 color 使用 btnDefColor 变量
                return `<tr style="border-bottom:${rowBorder}; transition:background 0.2s;">
                                <td style="padding:8px 6px; overflow:hidden;">
                                    <div style="font-weight:600; margin-bottom:2px; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${shortDate}</div>
                                    <div style="font-size:9px; ${subTextStyle} white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.id}</div>
                                </td>
                                <td style="padding:8px 4px; text-align:center; ${countStyle}">${b.count}</td>
                                <td style="padding:8px 4px; text-align:center;">
                                    <button class="restore-item-btn" data-key="${b.key}" style="padding:4px 8px; cursor:pointer; white-space:nowrap; background:transparent; border:1px solid ${btnBorderColor}; color:${btnDefColor}; border-radius:4px; font-size:10px;">恢复</button>
                                </td>
                            </tr>`;
            }).join('')}</tbody>
                    </table>
                </div>
                <div style="text-align:right; flex-shrink:0;">
                    <button id="close-rescue" style="padding:8px 20px; cursor:pointer; background:${closeBtnBg}; border:none; border-radius:6px; color:${txtColor};">关闭</button>
                </div>
            `);

            $overlay.append($box);
            $('body').append($overlay);

            $box.find('tr').hover(
                function () { $(this).css('background', isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'); },
                function () { $(this).css('background', 'transparent'); }
            );

            // ✨ 修复：鼠标移出时，恢复的颜色必须是 btnDefColor，而不是 window.Gaigai.ui.c
            $box.find('.restore-item-btn').hover(
                function () {
                    // 鼠标悬停：背景变主题色，字变白
                    $(this).css({ background: window.Gaigai.ui.c, color: '#fff', border: `1px solid ${window.Gaigai.ui.c}` });
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
                    if (target.data.summarized) window.Gaigai.summarizedRows = target.data.summarized;
                    m.save(true, true); // 数据恢复立即保存
                    shw();
                    $overlay.remove();
                    if (typeof toastr !== 'undefined') toastr.success('✅ 数据已恢复！');
                }
            });

            $('#close-rescue').on('click', () => $overlay.remove());

            $overlay.on('click', (e) => {
                if (e.target === $overlay[0]) $overlay.remove();
            });
        }

        /**
         * 显示移动端日志查看器（深度优化版）
         * 用于在手机上查看浏览器 Console 日志
         */
        showLogViewer() {
            // ⚠️ 使用健壮的 getDarkMode() 方法获取准确状态
            const isDark = this.getDarkMode();
            const bgColor = isDark ? '#1e1e1e' : '#fff';
            // 🎨 强制使用高对比度颜色，确保日志内容永远清晰可见（不跟随主题设置）
            const txtColor = isDark ? '#e0e0e0' : '#333333';
            const borderColor = isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.1)';

            // 当前筛选类型（默认全部）
            let currentFilter = 'all';

            // 生成日志列表 HTML（带智能截断）
            const renderLogs = (filterType = 'all') => {
                // 筛选日志
                let filteredLogs = this.logs;
                if (filterType !== 'all') {
                    filteredLogs = this.logs.filter(log => log.type === filterType);
                }

                if (filteredLogs.length === 0) {
                    return `<div style="text-align:center; padding:40px; opacity:0.5; color:${txtColor};">暂无${filterType === 'all' ? '' : filterType.toUpperCase() + ' '}日志记录</div>`;
                }

                return filteredLogs.map((log, idx) => {
                    let typeColor, typeIcon, typeBg;
                    if (log.type === 'error') {
                        typeColor = '#dc3545';
                        typeIcon = '❌';
                        typeBg = isDark ? 'rgba(220, 53, 69, 0.1)' : 'rgba(220, 53, 69, 0.05)';
                    } else if (log.type === 'warn') {
                        typeColor = '#ffc107';
                        typeIcon = '⚠️';
                        typeBg = isDark ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 193, 7, 0.05)';
                    } else {
                        typeColor = isDark ? '#aaa' : '#666';
                        typeIcon = 'ℹ️';
                        typeBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                    }

                    // 🎯 智能截断：error 和 warn 显示完整，info 限制 200 字符
                    let displayMessage = log.message;
                    if (log.type === 'info' && log.message.length > 200) {
                        displayMessage = log.message.substring(0, 200) + '...';
                    }

                    return `
                        <div style="padding:8px; margin-bottom:6px; border-radius:6px; background:${typeBg}; border-left:3px solid ${typeColor}; font-size:13px; line-height:1.5;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <span style="font-weight:bold; color:${typeColor}; font-size:12px;">${typeIcon} ${log.type.toUpperCase()}</span>
                                <span style="font-size:11px; opacity:0.6; color:${txtColor};">${log.timestamp}</span>
                            </div>
                            <pre style="margin:0; white-space:pre-wrap; word-break:break-word; font-family:monospace; font-size:13px; color:${txtColor};">${window.Gaigai.esc(displayMessage)}</pre>
                        </div>
                    `;
                }).join('');
            };

            const h = `
                <style>
                    /* 自定义滚动条样式 */
                    #gg_log_container::-webkit-scrollbar {
                        width: 8px;
                    }
                    #gg_log_container::-webkit-scrollbar-track {
                        background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
                        border-radius: 4px;
                    }
                    #gg_log_container::-webkit-scrollbar-thumb {
                        background: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'};
                        border-radius: 4px;
                    }
                    #gg_log_container::-webkit-scrollbar-thumb:hover {
                        background: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'};
                    }

                    /* Tab 按钮样式 */
                    .log-filter-tab {
                        flex: 1;
                        padding: 8px 12px;
                        border: none;
                        background: transparent;
                        color: ${txtColor};
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: normal;
                        border-radius: 6px;
                        transition: all 0.2s;
                        opacity: 0.6;
                    }
                    .log-filter-tab:hover {
                        opacity: 0.8;
                        background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
                    }
                    .log-filter-tab.active {
                        opacity: 1;
                        font-weight: bold;
                        background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
                    }
                    .log-filter-tab.tab-all.active {
                        color: ${isDark ? '#4db8ff' : '#007bff'};
                    }
                    .log-filter-tab.tab-error.active {
                        color: #dc3545;
                    }
                    .log-filter-tab.tab-warn.active {
                        color: #ffc107;
                    }
                    .log-filter-tab.tab-info.active {
                        color: ${isDark ? '#4db8ff' : '#007bff'};
                    }
                </style>
                <div class="g-p" style="display:flex; flex-direction:column; height:100%; background:${bgColor}; color:${txtColor};">
                    <div style="flex-shrink:0; padding:12px; background:${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}; border-bottom:${borderColor};">
                        <h4 style="margin:0 0 8px 0; color:${txtColor};">📜 移动端日志查看器</h4>
                        <div style="font-size:12px; opacity:0.7; color:${txtColor};">共 ${this.logs.length} 条日志（最大 ${this.maxLogs} 条）</div>
                    </div>

                    <!-- 分类筛选 Tab -->
                    <div style="flex-shrink:0; padding:8px 12px; background:${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}; border-bottom:${borderColor}; display:flex; gap:6px;">
                        <button class="log-filter-tab tab-all active" data-filter="all">📋 全部</button>
                        <button class="log-filter-tab tab-error" data-filter="error">❌ 错误</button>
                        <button class="log-filter-tab tab-warn" data-filter="warn">⚠️ 警告</button>
                        <button class="log-filter-tab tab-info" data-filter="info">ℹ️ 信息</button>
                    </div>

                    <div id="gg_log_container" style="flex:1; overflow-y:auto; padding:10px; background:${bgColor};">
                        ${renderLogs('all')}
                    </div>

                    <div style="flex-shrink:0; padding:10px; background:${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}; border-top:${borderColor}; display:flex; gap:8px;">
                        <button id="gg_copy_logs_btn" style="flex:1; padding:10px; background:${window.Gaigai.ui.c}; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold;">📋 复制</button>
                        <button id="gg_clear_logs_btn" style="flex:1; padding:10px; background:#dc3545; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold;">🗑️ 清空</button>
                        <button id="gg_refresh_logs_btn" style="flex:1; padding:10px; background:#17a2b8; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold;">🔄 刷新</button>
                    </div>
                </div>
            `;

            window.Gaigai.pop('📜 日志查看器', h, true);

            // 事件绑定
            setTimeout(() => {
                // 📌 默认滚动到底部，显示最新日志
                const scrollToBottom = () => {
                    const $container = $('#gg_log_container');
                    if ($container.length) {
                        $container.scrollTop($container[0].scrollHeight);
                    }
                };
                scrollToBottom();

                // Tab 筛选切换
                $('.log-filter-tab').on('click', function() {
                    const filterType = $(this).data('filter');
                    currentFilter = filterType;

                    // 更新 Tab 激活状态
                    $('.log-filter-tab').removeClass('active');
                    $(this).addClass('active');

                    // 重新渲染日志列表
                    $('#gg_log_container').html(renderLogs(filterType));
                    scrollToBottom();
                });

                // 复制日志
                $('#gg_copy_logs_btn').on('click', () => {
                    const logText = this.logs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`).join('\n');

                    // 定义兼容旧浏览器的复制函数
                    const fallbackCopyTextToClipboard = (text) => {
                        const textArea = document.createElement("textarea");
                        textArea.value = text;

                        // 避免在手机上拉起键盘
                        textArea.style.top = "0";
                        textArea.style.left = "0";
                        textArea.style.position = "fixed";

                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();

                        try {
                            const successful = document.execCommand('copy');
                            if (successful) {
                                if (typeof toastr !== 'undefined') toastr.success('✅ 日志已复制 (兼容模式)');
                                else window.Gaigai.customAlert('✅ 日志已复制', '成功');
                            } else {
                                throw new Error('Fallback copy failed');
                            }
                        } catch (err) {
                            console.error('无法复制:', err);
                            window.Gaigai.customAlert('❌ 复制失败，请手动长按日志内容复制', '错误');
                        }
                        document.body.removeChild(textArea);
                    };

                    // 优先尝试现代 API
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(logText).then(() => {
                            if (typeof toastr !== 'undefined') toastr.success('✅ 日志已复制到剪贴板');
                            else window.Gaigai.customAlert('✅ 日志已复制到剪贴板', '成功');
                        }).catch(err => {
                            console.warn('标准复制API失败，尝试兼容模式:', err);
                            fallbackCopyTextToClipboard(logText);
                        });
                    } else {
                        // HTTP 环境直接用兼容模式
                        fallbackCopyTextToClipboard(logText);
                    }
                });

                // 清空日志
                $('#gg_clear_logs_btn').on('click', async () => {
                    const confirmed = await window.Gaigai.customConfirm('确定要清空所有日志吗？', '清空确认');
                    if (confirmed) {
                        this.logs = [];
                        $('#gg_log_container').html('<div style="text-align:center; padding:40px; opacity:0.5; color:' + txtColor + ';">暂无日志记录</div>');
                        if (typeof toastr !== 'undefined') {
                            toastr.success('✅ 日志已清空');
                        }
                    }
                });

                // 刷新日志
                $('#gg_refresh_logs_btn').on('click', () => {
                    $('#gg_log_container').html(renderLogs(currentFilter));
                    scrollToBottom();
                    if (typeof toastr !== 'undefined') {
                        toastr.success('✅ 日志已刷新');
                    }
                });
            }, 50);
        }
    }

    // 挂载到 window.Gaigai
    if (!window.Gaigai) {
        window.Gaigai = {};
    }
    window.Gaigai.DebugManager = new DebugManager();
    console.log('✅ [DebugManager] 已挂载到 window.Gaigai.DebugManager');
})();
