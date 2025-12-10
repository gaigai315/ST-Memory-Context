/**
 * ⚡ Gaigai记忆插件 - 总结控制台模块
 *
 * 功能：AI总结相关的所有逻辑（表格总结、聊天总结、自动总结触发器、总结优化）
 * 支持：快照总结、分批总结、总结优化/润色
 *
 * @version 1.3.3
 * @author Gaigai Team
 */

(function() {
    'use strict';

    class SummaryManager {
        constructor() {
            console.log('✅ [SummaryManager] 初始化完成');
        }

        /**
         * 显示总结控制台UI界面
         */
        showUI() {
            const m = window.Gaigai.m;
            const UI = window.Gaigai.ui;
            const ctx = m.ctx();
            const totalCount = ctx && ctx.chat ? ctx.chat.length : 0;
            const API_CONFIG = window.Gaigai.config;
            const C = window.Gaigai.config_obj;

            // 读取进度
            let lastSumIndex = API_CONFIG.lastSummaryIndex || 0;
            if (lastSumIndex > totalCount) lastSumIndex = 0;

            // ✨ 读取自动总结配置
            const summarySource = API_CONFIG.summarySource || 'chat';
            const sourceText = summarySource === 'table' ? '📊 仅表格' : '💬 聊天历史';

            // 构建UI界面（三个功能区）
            const h = `
        <div class="g-p" style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
            <!-- 📌 当前配置状态显示 -->
            <div style="background: rgba(255,193,7,0.1); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; border: 1px solid rgba(255,193,7,0.3); flex-shrink: 0;">
                <div style="font-size: 11px; color: ${UI.tc}; opacity: 0.9; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                    <span><strong>⚙️ 自动总结模式：</strong>${sourceText}</span>
                    <span style="opacity: 0.7;">|</span>
                    <span><strong>📍 进度指针：</strong></span>
                    <input type="number" id="edit-sum-pointer" value="${lastSumIndex}" min="0" max="${totalCount}" style="width:60px; text-align:center; padding:3px; border-radius:4px; border:1px solid rgba(0,0,0,0.2); font-size:11px;">
                    <span>/ ${totalCount} 层</span>
                    <button id="save-sum-pointer-btn" style="padding:3px 10px; background:#ff9800; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:10px; white-space:nowrap;">修正</button>
                    <span style="opacity: 0.7;">|</span>
                    <a href="javascript:void(0)" id="open-config-link" style="color: #ff9800; text-decoration: underline; cursor: pointer; font-size: 10px;">修改配置</a>
                </div>
                <div style="font-size: 9px; color: ${UI.tc}; opacity: 0.6;">
                    💡 提示：进度指针会自动保存到角色存档中，切换角色时自动恢复
                </div>
            </div>

            <!-- 📊 功能区 1: 表格快照总结 -->
            <div style="background: transparent; border-radius: 8px; padding: 12px; border: 1px solid rgba(76, 175, 80, 0.7); margin-bottom: 12px; flex-shrink: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:${UI.tc};">📊 表格总结</h4>
                </div>
                <div style="font-size:11px; color:${UI.tc}; opacity:0.8; margin-bottom:10px;">
                    💡 对当前<strong>未总结</strong>的表格内容（白色行）进行AI总结
                </div>
                <button id="sum-table-snap" style="width:100%; padding:10px; background:#4caf50; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    🚀 开始表格总结
                </button>
            </div>

            <!-- 💬 功能区 2: 聊天记录总结 -->
            <div style="background: transparent; border-radius: 8px; padding: 12px; border: 1px solid rgba(33, 150, 243, 0.7); margin-bottom: 12px; flex-shrink: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:${UI.tc};">💬 聊天总结</h4>
                    <span style="font-size:11px; opacity:0.8; color:${UI.tc};">当前总楼层: <strong>${totalCount}</strong></span>
                </div>

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <div style="flex:1;">
                        <label style="font-size:11px; display:block; margin-bottom:2px; color:${UI.tc};">起始楼层</label>
                        <input type="number" id="sum-chat-start" value="${lastSumIndex}" min="0" max="${totalCount}" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    </div>
                    <span style="font-weight:bold; color:${UI.tc}; margin-top:16px;">➜</span>
                    <div style="flex:1;">
                        <label style="font-size:11px; display:block; margin-bottom:2px; color:${UI.tc};">结束楼层</label>
                        <input type="number" id="sum-chat-end" value="${totalCount}" min="0" max="${totalCount}" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    </div>
                </div>

                <!-- 分批执行选项 -->
                <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.15);">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-bottom: 6px;">
                        <input type="checkbox" id="sum-batch-mode" style="transform: scale(1.2);">
                        <span style="color:${UI.tc}; font-weight: 600;">📦 分批执行（推荐范围 > 50 层）</span>
                    </label>
                    <div id="sum-batch-options" style="display: none; margin-top: 8px; padding-left: 8px;">
                        <label style="font-size: 11px; display: block; margin-bottom: 4px; color:${UI.tc}; opacity: 0.9;">每批处理楼层数：</label>
                        <input type="number" id="sum-step" value="${C.autoSummaryFloor || 50}" min="10" max="200" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); font-size: 12px;">
                        <div style="font-size: 10px; color: ${UI.tc}; opacity: 0.7; margin-top: 4px;">
                            💡 建议值：30-50层。批次间会自动冷却5秒。
                        </div>
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-top: 8px;">
                        <input type="checkbox" id="sum-silent-mode" ${C.autoSummarySilent ? 'checked' : ''} style="transform: scale(1.2);">
                        <span style="color:${UI.tc};">🤫 静默执行 (不弹窗确认，直接写入)</span>
                    </label>
                </div>

                <button id="sum-chat-run" style="width:100%; padding:10px; background:#2196f3; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    🚀 开始聊天总结
                </button>
                <div id="sum-chat-status" style="text-align:center; margin-top:8px; font-size:11px; color:${UI.tc}; opacity:0.8; min-height:16px;"></div>
            </div>

            <!-- ✨ 功能区 3: 总结优化/润色 -->
            <div style="background: transparent; border-radius: 8px; padding: 12px; border: 1px solid rgba(255, 152, 0, 0.7); flex-shrink: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:${UI.tc};">✨ 总结优化/润色</h4>
                </div>

                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px; color:${UI.tc};">🎯 目标选择</label>
                    <select id="opt-target" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2); font-size:12px; background:#fff; color:${UI.tc};">
                        <option value="all">全部已有总结</option>
                        <option value="range">指定范围 (如 1-3)</option>
                        <option value="last">最后一条总结</option>
                        <option value="specific">指定某一页</option>
                    </select>
                </div>

                <div id="opt-specific-row" style="display: none; margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px; color:${UI.tc};">页码范围（支持 "5" 或 "2-6"）：</label>
                    <input type="text" id="opt-range-input" value="1" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                </div>

                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px; color:${UI.tc};">💬 优化建议（可选）</label>
                    <textarea id="opt-prompt" placeholder="例如：把流水账改写成史诗感、精简字数到200字以内、增加情感描写、用古文风格重写..." style="width:100%; height:80px; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2); font-size:11px; resize:vertical; font-family:inherit; background:#fff; color:${UI.tc};"></textarea>
                    <div style="font-size:9px; color:${UI.tc}; opacity:0.7; margin-top:4px;">
                        💡 输入您希望AI如何优化总结的具体要求（留空则使用默认优化策略）
                    </div>
                </div>

                <button id="opt-run" style="width:100%; padding:10px; background:#ff9800; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    ✨ 开始优化
                </button>
                <div id="opt-status" style="text-align:center; margin-top:8px; font-size:11px; color:${UI.tc}; opacity:0.8; min-height:16px;"></div>
            </div>
        </div>`;

            // 显示界面
            window.Gaigai.pop('🤖 总结控制台', h, true);

            // 阻止输入框的按键冒泡
            $('#sum-chat-start, #sum-chat-end, #sum-step, #opt-range-input, #opt-prompt, #edit-sum-pointer').on('keydown keyup input', function (e) {
                e.stopPropagation();
            });

            // 绑定UI事件
            this._bindUIEvents(totalCount, lastSumIndex);
        }

        /**
         * 绑定UI事件（私有方法）
         */
        _bindUIEvents(totalCount, lastSumIndex) {
            const self = this;
            const m = window.Gaigai.m;
            const API_CONFIG = window.Gaigai.config;
            const C = window.Gaigai.config_obj;

            setTimeout(() => {
                // ✨✨✨ 【关键修复】检测分批任务是否正在运行，恢复按钮状态 ✨✨✨
                if (window.Gaigai.isBatchRunning) {
                    const $btn = $('#sum-chat-run');
                    if ($btn.length > 0) {
                        $btn.text('🛑 停止任务 (后台执行中)')
                            .css('background', '#dc3545')
                            .css('opacity', '1')
                            .prop('disabled', false);
                    }
                    const $status = $('#sum-chat-status');
                    if ($status.length > 0) {
                        $status.text('⚠️ 分批任务正在后台执行，点击按钮可停止')
                               .css('color', '#ff9800');
                    }
                    console.log('🔄 [界面恢复] 检测到分批总结正在执行，已恢复按钮状态');
                }

                // ✨ 修正进度按钮点击事件
                $('#save-sum-pointer-btn').on('click', async function() {
                    const API_CONFIG = window.Gaigai.config;
                    const ctx = m.ctx();
                    const totalCount = ctx && ctx.chat ? ctx.chat.length : 0;

                    // 从输入框读取新值
                    const newPointer = parseInt($('#edit-sum-pointer').val());

                    if (isNaN(newPointer) || newPointer < 0 || newPointer > totalCount) {
                        await window.Gaigai.customAlert(`⚠️ 输入无效！\n\n请输入 0 到 ${totalCount} 之间的数字`, '错误');
                        return;
                    }

                    // 更新指针
                    API_CONFIG.lastSummaryIndex = newPointer;

                    // 1. 保存到 localStorage
                    try {
                        localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                        console.log(`✅ [进度修正] 总结指针已更新至: ${newPointer}`);
                    } catch (e) {
                        console.error('❌ [进度修正] localStorage 保存失败:', e);
                    }

                    // 2. 同步到云端
                    if (typeof window.saveAllSettingsToCloud === 'function') {
                        window.saveAllSettingsToCloud().catch(err => {
                            console.warn('⚠️ [进度修正] 云端同步失败:', err);
                        });
                    }

                    // 3. 保存到角色存档（通过 m.save()）
                    m.save();

                    // 4. 刷新显示
                    if (typeof toastr !== 'undefined') {
                        toastr.success(`进度已修正为 ${newPointer}`, '更新成功', { timeOut: 2000 });
                    }

                    // 5. 刷新控制台界面
                    setTimeout(() => self.showUI(), 300);
                });

                // ✨ 修改配置链接点击事件
                $('#open-config-link').on('click', function(e) {
                    e.preventDefault();
                    // 跳转到配置页面
                    if (typeof window.Gaigai.navTo === 'function' && typeof window.Gaigai.shcf === 'function') {
                        window.Gaigai.navTo('配置', window.Gaigai.shcf);
                    }
                });

                // 表格快照总结
                $('#sum-table-snap').on('click', async function() {
                    const $btn = $(this);
                    const oldText = $btn.text();
                    $btn.text('⏳ AI正在阅读...').prop('disabled', true).css('opacity', 0.7);
                    await self.callAIForSummary(null, null, 'table', false);
                    $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                });

                // 聊天记录总结 - 分批模式复选框切换
                $('#sum-batch-mode').on('change', function () {
                    if ($(this).is(':checked')) {
                        $('#sum-batch-options').slideDown(200);
                    } else {
                        $('#sum-batch-options').slideUp(200);
                    }
                });

                // 范围变化时智能提示
                $('#sum-chat-start, #sum-chat-end').on('change', function () {
                    const start = parseInt($('#sum-chat-start').val()) || 0;
                    const end = parseInt($('#sum-chat-end').val()) || 0;
                    const range = end - start;

                    if (range > 50 && !$('#sum-batch-mode').is(':checked')) {
                        $('#sum-batch-mode').prop('checked', true).trigger('change');
                        const $status = $('#sum-chat-status');
                        $status.text('💡 检测到范围 > 50层，已自动启用分批模式').css('color', '#ffc107');
                        setTimeout(() => $status.text('').css('color', window.Gaigai.ui.tc), 3000);
                    }
                });

                // 聊天总结 - 主按钮点击事件
                $('#sum-chat-run').off('click').on('click', async function () {
                    const start = parseInt($('#sum-chat-start').val());
                    const end = parseInt($('#sum-chat-end').val());
                    const isBatchMode = $('#sum-batch-mode').is(':checked');
                    const step = parseInt($('#sum-step').val()) || 50;
                    const isSilent = $('#sum-silent-mode').is(':checked');

                    if (isNaN(start) || isNaN(end) || start >= end) {
                        await window.Gaigai.customAlert('请输入有效的楼层范围 (起始 < 结束)', '错误');
                        return;
                    }

                    // 检测是否正在运行
                    if (window.Gaigai.isBatchRunning) {
                        window.Gaigai.stopBatch = true;
                        console.log('🛑 [用户操作] 请求停止批量总结');
                        return;
                    }

                    const $btn = $(this);
                    const oldText = $btn.text();

                    if (isBatchMode) {
                        // 📦 分批模式
                        // ✅ 立即更新按钮状态，显示正在执行
                        $btn.text('⏳ 正在执行...').prop('disabled', true).css('opacity', 0.7);
                        $('#sum-chat-status').text('初始化分批任务...').css('color', window.Gaigai.ui.tc);

                        console.log(`📊 [分批总结] 启动：${start}-${end}，步长 ${step}`);
                        await self.runBatchSummary(start, end, step, 'chat', isSilent);

                        // ✅ 执行完毕后，恢复按钮状态
                        $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        $('#sum-chat-status').text('');
                    } else {
                        // 🚀 单次模式
                        $btn.text('⏳ AI正在阅读...').prop('disabled', true).css('opacity', 0.7);
                        $('#sum-chat-status').text('正在请求AI...').css('color', window.Gaigai.ui.tc);
                        await self.callAIForSummary(start, end, 'chat', isSilent);
                        $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        $('#sum-chat-status').text('');
                    }
                });

                // 总结优化 - 目标选择变化
                $('#opt-target').on('change', function() {
                    const val = $(this).val();
                    if (val === 'specific' || val === 'range') {
                        $('#opt-specific-row').slideDown(200);
                    } else {
                        $('#opt-specific-row').slideUp(200);
                    }
                });

                // 总结优化 - 按钮点击事件
                $('#opt-run').on('click', async function() {
                    const target = $('#opt-target').val();
                    let prompt = $('#opt-prompt').val().trim();
                    const rangeInput = $('#opt-range-input').val().trim() || "1"; // ✅ 改为字符串类型

                    // ✅ prompt 现在可以为空，将由 optimizeSummary 函数从提示词管理获取

                    const $btn = $(this);
                    const oldText = $btn.text();
                    $btn.text('⏳ AI正在优化...').prop('disabled', true).css('opacity', 0.7);
                    $('#opt-status').text('正在生成优化版本...').css('color', window.Gaigai.ui.tc);

                    try {
                        await self.optimizeSummary(target, prompt, rangeInput);
                    } finally {
                        $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        $('#opt-status').text('');
                    }
                });

            }, 100);
        }

        /**
         * AI总结核心函数（已修复逻辑穿透，已补全）
         */
        async callAIForSummary(forceStart = null, forceEnd = null, forcedMode = null, isSilent = false, isBatch = false, skipSave = false) {
            // 使用 window.loadConfig 确保配置最新
            const loadConfig = window.loadConfig || (() => Promise.resolve());
            await loadConfig();

            const API_CONFIG = window.Gaigai.config;
            const C = window.Gaigai.config_obj;
            const m = window.Gaigai.m;

            const currentMode = forcedMode || API_CONFIG.summarySource;
            const isTableMode = currentMode !== 'chat';

            // ✨ 强制刷新数据
            m.load();

            // === 🛡️ 强力拦截：表格模式下的空数据检查 ===
            if (isTableMode) {
                const tableContentRaw = m.getTableText().trim();
                if (!tableContentRaw) {
                    if (!isSilent) {
                        if (await window.Gaigai.customConfirm('⚠️ 当前表格没有【未总结】的新内容。\n（所有行可能都已标记为绿色/已归档）\n\n是否转为"总结聊天历史"？', '无新内容')) {
                            return this.callAIForSummary(forceStart, forceEnd, 'chat', isSilent);
                        }
                    } else {
                        console.log('🛑 [自动总结] 表格内容为空（或全已归档），跳过。');
                    }
                    return { success: false, error: '表格内容为空或全部已归档' };
                }
            }

            const tables = m.all().slice(0, 8).filter(s => s.r.length > 0);
            const ctx = window.SillyTavern.getContext();

            // 获取角色名
            let userName = ctx.name1 || 'User';
            let charName = 'Character';
            if (ctx.characterId !== undefined && ctx.characters && ctx.characters[ctx.characterId]) {
                charName = ctx.characters[ctx.characterId].name || ctx.name2 || 'Character';
            } else if (ctx.name2) {
                charName = ctx.name2;
            }

            // 准备 System Prompt
            let rawPrompt = isTableMode ? window.Gaigai.PromptManager.get('summaryPromptTable') : window.Gaigai.PromptManager.get('summaryPromptChat');
            if (!rawPrompt || !rawPrompt.trim()) rawPrompt = "请总结以下内容：";
            let targetPrompt = window.Gaigai.PromptManager.resolveVariables(rawPrompt, ctx);

            // UI 交互逻辑（表格模式下的确认）
            if (isTableMode && !isSilent) {
                if (!await window.Gaigai.customConfirm(`即将总结 ${tables.length} 个表格`, '确认')) {
                    return { success: false, error: '用户取消操作' };
                }
            }

            const messages = [];
            let logMsg = '';
            let startIndex = 0;
            let endIndex = 0;

            // === 场景 A: 总结聊天历史 ===
            if (!isTableMode) {
                if (!ctx || !ctx.chat || ctx.chat.length === 0) {
                    if (!isSilent) await window.Gaigai.customAlert('聊天记录为空', '错误');
                    return { success: false, error: '聊天记录为空' };
                }

                endIndex = (forceEnd !== null) ? parseInt(forceEnd) : ctx.chat.length;
                startIndex = (forceStart !== null) ? parseInt(forceStart) : (API_CONFIG.lastSummaryIndex || 0);
                if (startIndex < 0) startIndex = 0;
                if (startIndex >= endIndex) {
                    if (!isSilent) await window.Gaigai.customAlert(`范围无效`, '提示');
                    return { success: false, error: '范围无效' };
                }

                // 1. System Prompt (NSFW)
                messages.push({
                    role: 'system',
                    content: window.Gaigai.PromptManager.resolveVariables(window.Gaigai.PromptManager.get('nsfwPrompt'), ctx)
                });

                // 2. 背景资料
                let contextText = '';
                let charInfo = '';
                if (ctx.characters && ctx.characterId !== undefined && ctx.characters[ctx.characterId]) {
                    const char = ctx.characters[ctx.characterId];
                    if (char.description) charInfo += `[人物简介]\n${char.description}\n`;
                    if (char.personality) charInfo += `[性格/设定]\n${char.personality}\n`;
                }
                if (charInfo) contextText += `\n【背景资料】\n角色: ${charName}\n用户: ${userName}\n\n${charInfo}\n`;

                // 3. 世界书
                let scanTextForWorldInfo = '';
                const targetSlice = ctx.chat.slice(startIndex, endIndex);
                targetSlice.forEach(msg => scanTextForWorldInfo += (msg.mes || msg.content || '') + '\n');

                let worldInfoList = [];
                try {
                    if (ctx.worldInfo && Array.isArray(ctx.worldInfo)) worldInfoList = ctx.worldInfo;
                    else if (window.world_info && Array.isArray(window.world_info)) worldInfoList = window.world_info;
                } catch (e) { }

                let triggeredLore = [];
                if (Array.isArray(worldInfoList) && worldInfoList.length > 0 && scanTextForWorldInfo) {
                    const lowerText = scanTextForWorldInfo.toLowerCase();
                    worldInfoList.forEach(entry => {
                        if (!entry || typeof entry !== 'object') return;
                        const keysStr = entry.keys || entry.key || '';
                        if (!keysStr) return;
                        const keys = String(keysStr).split(',').map(k => k.trim().toLowerCase()).filter(k => k);
                        if (keys.some(k => lowerText.includes(k))) {
                            const content = entry.content || entry.entry || '';
                            if (content) triggeredLore.push(`[相关设定: ${keys[0]}] ${content}`);
                        }
                    });
                }
                if (triggeredLore.length > 0) contextText += `\n【相关世界设定】\n${triggeredLore.join('\n')}\n`;
                if (contextText) messages.push({ role: 'system', content: contextText });

                // 4. 前情提要
                if (m.sm.has()) {
                    const summaryArray = m.sm.loadArray();
                    const recentSummaries = summaryArray.slice(-15);
                    recentSummaries.forEach((item) => {
                        messages.push({
                            role: 'system',
                            content: `【前情提要 - ${item.type || '历史'}】\n${item.content}`
                        });
                    });
                } else {
                    messages.push({ role: 'system', content: '【前情提要】\n（暂无历史总结）' });
                }

                // 5. 当前表格状态
                let hasTableContext = false;
                m.s.slice(0, 8).forEach((sheet, i) => {
                    if (sheet.r.length > 0) {
                        hasTableContext = true;
                        messages.push({
                            role: 'system',
                            content: `【当前表格状态 - ${sheet.n}】\n${sheet.txt(i)}`
                        });
                    }
                });
                if (!hasTableContext) messages.push({ role: 'system', content: `【当前表格状态】\n（表格为空）` });

                // 6. 聊天记录
                const cleanMemoryTags = window.Gaigai.cleanMemoryTags;
                const filterContentByTags = window.Gaigai.tools.filterContentByTags; // ✅ 修复：使用正确的引用路径
                let validMsgCount = 0;
                targetSlice.forEach((msg) => {
                    if (msg.isGaigaiPrompt || msg.isGaigaiData || msg.isPhoneMessage) return;
                    let content = msg.mes || msg.content || '';
                    content = cleanMemoryTags(content);
                    content = filterContentByTags(content);

                    if (content && content.trim()) {
                        const isUser = msg.is_user || msg.role === 'user';
                        const name = msg.name || (isUser ? userName : charName);
                        messages.push({ role: isUser ? 'user' : 'assistant', content: `${name}: ${content}` });
                        validMsgCount++;
                    }
                });

                if (validMsgCount === 0) {
                    if (!isSilent) await window.Gaigai.customAlert('范围内无有效内容', '提示');
                    return { success: false, error: '范围内无有效内容' };
                }

                // 7. 指令
                const lastMsg = messages[messages.length - 1];
                if (lastMsg && lastMsg.role === 'user') {
                    lastMsg.content += '\n\n' + targetPrompt;
                } else {
                    messages.push({ role: 'user', content: targetPrompt });
                }

                logMsg = `📝 聊天总结: ${startIndex}-${endIndex} (消息数:${messages.length})`;

            } else {
                // === 场景 B: 总结表格模式 (这里加上了 ELSE，修复了逻辑穿透问题) ===
                // 1. 写入 NSFW 破限提示词
                messages.push({
                    role: 'system',
                    content: window.Gaigai.PromptManager.resolveVariables(
                        window.Gaigai.PromptManager.get('nsfwPrompt'),
                        ctx
                    )
                });

                // 2. 写入历史总结
                if (m.sm.has()) {
                    const summaryArray = m.sm.loadArray();
                    const recentSummaries = summaryArray.slice(-15);
                    recentSummaries.forEach((item) => {
                        messages.push({
                            role: 'system',
                            content: `【前情提要 - ${item.type || '历史'}】\n${item.content}`
                        });
                    });
                } else {
                    messages.push({ role: 'system', content: '【前情提要】\n（暂无历史总结）' });
                }

                // 3. 写入详情表格
                let hasTableData = false;
                m.s.slice(0, 8).forEach((sheet, i) => {
                    if (sheet.r.length > 0) {
                        hasTableData = true;
                        messages.push({
                            role: 'system',
                            content: `【待总结的表格 - ${sheet.n}】\n${sheet.txt(i)}`
                        });
                    }
                });

                if (!hasTableData) {
                    messages.push({ role: 'system', content: '【待总结的表格数据】\n（表格为空）' });
                }

                // 4. 写入 User 指令
                messages.push({ role: 'user', content: targetPrompt });

                logMsg = '📝 表格总结';
            }

            console.log(logMsg);
            const currentRangeStr = (!isTableMode && startIndex !== undefined && endIndex !== undefined) ? `${startIndex}-${endIndex}` : "";

            // 终极清洗
            for (let i = messages.length - 1; i >= 0; i--) {
                if (!messages[i].content || !messages[i].content.trim()) {
                    messages.splice(i, 1);
                }
            }
            const finalMsg = messages[messages.length - 1];
            if (!finalMsg || finalMsg.role !== 'user') {
                messages.push({ role: 'user', content: '请继续执行上述总结任务。' });
            }

            window.Gaigai.lastRequestData = {
                chat: JSON.parse(JSON.stringify(messages)),
                timestamp: Date.now(),
                model: API_CONFIG.model || 'Unknown'
            };

            let result;
            window.isSummarizing = true;

            try {
                const callIndependentAPI = window.callIndependentAPI;
                const callTavernAPI = window.callTavernAPI;
                if (API_CONFIG.useIndependentAPI) {
                    result = await callIndependentAPI(messages);
                } else {
                    result = await callTavernAPI(messages);
                }
            } finally {
                window.isSummarizing = false;
            }

            if (result.success) {
                if (!result.summary || !result.summary.trim()) {
                    if (!isSilent) await window.Gaigai.customAlert('AI返回空', '警告');
                    return { success: false, error: 'AI 返回空内容' };
                }

                let cleanSummary = result.summary;
                if (cleanSummary.includes('<think>')) {
                    cleanSummary = cleanSummary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                }

                // 智能分级清洗
                cleanSummary = cleanSummary
                    .replace(/^(好的|收到|明白|了解|OK|Ok|ok)[，,。!！]*\s*(\n|$)/, '')
                    .replace(/^(好的|收到|明白|了解).*?(总结|分析|如下|内容|查看)[^：:\n]*[：:\n]/i, '')
                    .replace(/^(注意|提示|说明|备注)[：:][^\n]*\n*/gim, '')
                    .trim();

                if (!cleanSummary || cleanSummary.length < 10) {
                    if (!isSilent) await window.Gaigai.customAlert('总结内容过短或无效', '警告');
                    return { success: false, error: '总结内容过短或无效' };
                }

                if (!isTableMode && isSilent) {
                    const currentLast = API_CONFIG.lastSummaryIndex || 0;
                    if (endIndex > currentLast) {
                        API_CONFIG.lastSummaryIndex = endIndex;
                        localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                    }
                }

                if (isSilent && !skipSave) {
                    m.sm.save(cleanSummary, currentRangeStr);
                    await window.syncToWorldInfo(cleanSummary);

                    if (isTableMode && currentMode === 'table') {
                        tables.forEach(table => {
                            const ti = m.all().indexOf(table);
                            if (ti !== -1) {
                                for (let ri = 0; ri < table.r.length; ri++) window.markAsSummarized(ti, ri);
                            }
                        });
                    }

                    if (typeof window.saveAllSettingsToCloud === 'function') {
                        window.saveAllSettingsToCloud().catch(err => {
                            console.warn('⚠️ [自动总结] 云端同步失败:', err);
                        });
                    }

                    m.save();
                    window.updateCurrentSnapshot();

                    if ($('#g-pop').length > 0) window.Gaigai.shw();

                    if (typeof toastr !== 'undefined') {
                        if (!isBatch) toastr.success('自动总结已在后台完成并保存', '记忆表格', { timeOut: 1000, preventDuplicates: true });
                    }
                    return { success: true };
                } else if (isSilent && skipSave) {
                    return { success: true, summary: cleanSummary };
                } else {
                    const regenParams = { forceStart, forceEnd, forcedMode, isSilent };
                    const res = await this.showSummaryPreview(cleanSummary, tables, isTableMode, endIndex, regenParams, currentRangeStr, isBatch);
                    return res;
                }

            } else {
                // 失败重试
                const customRetryAlert = window.customRetryAlert || window.Gaigai.customAlert;
                const errorMsg = `生成失败：${result.error}\n\n是否重新尝试？`;
                const shouldRetry = await customRetryAlert(errorMsg, '⚠️ AI 生成失败');

                if (shouldRetry) {
                    return this.callAIForSummary(forceStart, forceEnd, forcedMode, isSilent);
                } else {
                    return { success: false, error: result.error || 'API 生成失败，用户取消重试' };
                }
            }
        }

        /**
         * 显示总结预览弹窗（迁移自 index.js）
         */
        showSummaryPreview(summaryText, sourceTables, isTableMode, newIndex = null, regenParams = null, rangeStr = "", isBatch = false) {
            const self = this;
            const m = window.Gaigai.m;
            const esc = window.Gaigai.esc;
            const API_CONFIG = window.Gaigai.config;
            const UI = window.Gaigai.ui;

            // 🔒 关键修复：记录弹窗打开时的会话ID
            const initialSessionId = m.gid();
            if (!initialSessionId) {
                window.Gaigai.customAlert('🛑 安全拦截：无法获取会话标识', '错误');
                return Promise.resolve({ success: false });
            }
            console.log(`🔒 [总结弹窗打开] 会话ID: ${initialSessionId}`);

            return new Promise((resolve) => {
                const h = `
            <div class="g-p" style="display: flex; flex-direction: column; height: 100%;">
                <h4 style="margin: 0 0 8px 0;">📝 记忆总结预览</h4>
                <p style="color:${UI.tc}; opacity:0.8; font-size:11px; margin: 0 0 10px 0;">
                    ✅ 已生成总结建议<br>
                    💡 您可以直接编辑润色内容，满意后点击保存
                </p>
                <textarea id="summary-editor" style="flex: 1; width:100%; min-height: 0; padding:10px; border:1px solid #ddd; border-radius:4px; font-size:12px; font-family:inherit; resize: none; line-height:1.8; background-color: #ffffff !important; color: ${UI.tc} !important; margin-bottom: 10px;">${esc(summaryText)}</textarea>

                <div style="margin-bottom:12px; flex-shrink: 0;">
                    <label for="summary-note" style="display:block; font-size:12px; color:${UI.tc}; opacity:0.8; margin-bottom:4px;">📌 备注/范围：</label>
                    <input type="text"
                           id="summary-note"
                           value="${esc(rangeStr)}"
                           placeholder="例如：0-50、第1章、主线任务等"
                           style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:12px; background-color: #ffffff !important; color: ${UI.tc} !important;">
                    <div style="font-size:10px; color:${UI.tc}; opacity:0.6; margin-top:4px;">💡 提示：此备注会自动保存到总结表第3列（如果该列存在）</div>
                </div>

                <div style="display: flex; gap: 10px; flex-shrink: 0;">
                    <button id="cancel-summary" style="padding:8px 16px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🚫 放弃</button>
                    ${regenParams ? '<button id="regen-summary" style="padding:8px 16px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🔄 重新生成</button>' : ''}
                    <button id="save-summary" style="padding:8px 16px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 2; font-weight:bold;">✅ 保存总结</button>
                </div>
            </div>
        `;

                $('#g-summary-pop').remove();
                const $o = $('<div>', { id: 'g-summary-pop', class: 'g-ov', css: { 'z-index': '10000010' } });
                const $p = $('<div>', { class: 'g-w', css: { width: '700px', maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' } });
                const $hd = $('<div>', { class: 'g-hd', css: { flexShrink: '0' } });
                $hd.append(`<h3 style="color:${UI.tc}; flex:1;">📝 记忆总结</h3>`);

                const $x = $('<button>', { class: 'g-x', text: '×', css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' } }).on('click', () => {
                    $o.remove();
                    resolve({ success: false });
                });
                $hd.append($x);

                const $bd = $('<div>', { class: 'g-bd', html: h, css: { flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px' } });
                $p.append($hd, $bd);
                $o.append($p);
                $('body').append($o);

                setTimeout(() => {
                    $('#summary-editor').focus();

                    $('#cancel-summary').on('click', () => {
                        $o.remove();
                        resolve({ success: false });
                    });

                    if (regenParams) {
                        $('#regen-summary').on('click', async function () {
                            const $btn = $(this);
                            const originalText = $btn.text();

                            $('#cancel-summary, #regen-summary, #save-summary').prop('disabled', true);
                            $btn.text('生成中...');

                            try {
                                console.log('🔄 [重新生成] 正在重新调用 callAIForSummary...');
                                window._isRegeneratingInPopup = true;

                                const res = await self.callAIForSummary(
                                    regenParams.forceStart,
                                    regenParams.forceEnd,
                                    regenParams.forcedMode,
                                    true,  // isSilent
                                    false, // isBatch
                                    true   // skipSave
                                );

                                if (res && res.success && res.summary && res.summary.trim()) {
                                    $('#summary-editor').val(res.summary);
                                    if (typeof toastr !== 'undefined') {
                                        toastr.success('内容已刷新', '重新生成', { timeOut: 1000, preventDuplicates: true });
                                    }
                                } else {
                                    throw new Error('重新生成返回空内容');
                                }

                            } catch (error) {
                                console.error('❌ [重新生成失败]', error);

                                const errorMsg = `重新生成失败：${error.message}\n\n是否重新尝试？`;
                                const shouldRetry = await window.Gaigai.customRetryAlert(errorMsg, '⚠️ 生成失败');

                                if (shouldRetry) {
                                    console.log('🔄 [用户重试] 关闭弹窗并重新调用总结...');
                                    $o.remove();
                                    resolve({ success: false });
                                    await self.callAIForSummary(
                                        regenParams.forceStart,
                                        regenParams.forceEnd,
                                        regenParams.forcedMode,
                                        false
                                    );
                                    return;
                                }
                            } finally {
                                window._isRegeneratingInPopup = false;
                                $('#cancel-summary, #regen-summary, #save-summary').prop('disabled', false);
                                $btn.text(originalText);
                            }
                        });
                    }

                    $('#save-summary').on('click', async function () {
                        const editedSummary = $('#summary-editor').val();
                        const noteValue = $('#summary-note').val().trim();

                        if (!editedSummary.trim()) {
                            await window.Gaigai.customAlert('总结内容不能为空', '提示');
                            return;
                        }

                        // 🔒 安全检查1：验证会话ID是否一致
                        const currentSessionId = m.gid();
                        if (!currentSessionId) {
                            await window.Gaigai.customAlert('🛑 安全拦截：无法获取会话标识', '错误');
                            return;
                        }

                        if (currentSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 保存时: ${currentSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作\n\n请重新打开总结功能', '错误');
                            return;
                        }

                        console.log(`🔒 [安全验证通过] 会话ID: ${currentSessionId}, 准备保存总结`);

                        m.sm.save(editedSummary, noteValue);
                        await window.syncToWorldInfo(editedSummary);

                        if (!isTableMode && newIndex !== null) {
                            const currentLast = API_CONFIG.lastSummaryIndex || 0;
                            if (newIndex > currentLast) {
                                API_CONFIG.lastSummaryIndex = newIndex;
                                try { localStorage.setItem('gg_api', JSON.stringify(API_CONFIG)); } catch (e) { }
                                console.log(`✅ [进度更新] 总结进度已更新至: ${newIndex}`);
                            }
                        }

                        if (typeof window.saveAllSettingsToCloud === 'function') {
                            window.saveAllSettingsToCloud().catch(err => {
                                console.warn('⚠️ [总结保存] 云端同步失败:', err);
                            });
                        }

                        // 🔒 安全检查2：保存前再次验证会话ID（防止同步期间切换会话）
                        const saveSessionId = m.gid();
                        if (saveSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 最终保存时: ${saveSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，数据未保存\n\n警告：总结可能已同步到世界书，请检查数据完整性！', '严重错误');
                            $o.remove();
                            resolve({ success: false });
                            return;
                        }

                        console.log(`🔒 [最终验证通过] 会话ID: ${saveSessionId}, 保存总结数据`);

                        m.save();
                        window.updateCurrentSnapshot();

                        $o.remove();

                        if (!isTableMode) {
                            if (!isBatch) {
                                await window.Gaigai.customAlert('✅ 剧情总结已保存！\n(进度指针已自动更新)', '保存成功');
                            } else {
                                if (typeof toastr !== 'undefined') {
                                    toastr.success('本批次已保存', '进度更新', { timeOut: 1500 });
                                }
                            }

                            if ($('#g-pop').length > 0) window.Gaigai.shw();
                            resolve({ success: true });
                        } else {
                            // 表格模式：弹出三选一操作框
                            const dialogId = 'summary-action-' + Date.now();
                            const $dOverlay = $('<div>', {
                                id: dialogId,
                                css: {
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    width: '100vw', height: '100vh',
                                    background: 'rgba(0,0,0,0.6)', zIndex: 10000020,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }
                            });

                            const $dBox = $('<div>', {
                                css: {
                                    background: '#fff', borderRadius: '12px', padding: '24px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.4)', width: '360px',
                                    display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center'
                                }
                            });

                            $dBox.append('<div style="font-size:18px; margin-bottom:8px;">🎉 总结已保存！</div>');
                            $dBox.append(`<div style="font-size:13px; color:${UI.tc}; opacity:0.8; margin-bottom:12px;">请选择如何处理<strong>原始表格数据</strong>：</div>`);

                            const btnCss = "padding:12px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; color:#fff; transition:0.2s;";

                            const $btnDel = $('<button>', {
                                html: '🗑️ 删除已总结内容<br><span style="font-size:10px; font-weight:normal; opacity:0.8;">(清空表格，防止重复)</span>',
                                css: btnCss + "background:#dc3545;"
                            }).on('click', () => {
                                sourceTables.forEach(t => t.clear());
                                finish('✅ 原始数据已清空，总结已归档。');
                            });

                            const $btnHide = $('<button>', {
                                html: '🙈 仅隐藏 (变绿)<br><span style="font-size:10px; font-weight:normal; opacity:0.8;">(保留内容但标记为已处理)</span>',
                                css: btnCss + "background:#28a745;"
                            }).on('click', () => {
                                sourceTables.forEach(table => {
                                    const ti = m.all().indexOf(table);
                                    if (ti !== -1) {
                                        for (let ri = 0; ri < table.r.length; ri++) window.markAsSummarized(ti, ri);
                                    }
                                });
                                finish('✅ 原始数据已标记为已总结（绿色）。');
                            });

                            const $btnKeep = $('<button>', {
                                html: '👁️ 保留 (不变)<br><span style="font-size:10px; font-weight:normal; opacity:0.8;">(不做任何修改，保持白色)</span>',
                                css: btnCss + "background:#17a2b8;"
                            }).on('click', () => {
                                finish('✅ 原始数据已保留（未做标记）。');
                            });

                            function finish(msg) {
                                m.save();
                                $dOverlay.remove();
                                if ($('#g-pop').length > 0) window.Gaigai.shw();
                                $('.g-t[data-i="8"]').click();
                                if (typeof toastr !== 'undefined') toastr.success(msg);
                                resolve({ success: true });
                            }

                            $dBox.append($btnDel, $btnHide, $btnKeep);
                            $dOverlay.append($dBox);
                            $('body').append($dOverlay);
                        }
                    });

                    $o.on('keydown', async e => {
                        if (e.key === 'Escape') {
                            if (await window.Gaigai.customConfirm('确定取消？当前总结内容将丢失。', '确认')) {
                                $o.remove();
                                resolve({ success: false });
                            }
                        }
                    });
                }, 100);
            });
        }

        /**
         * 分批总结函数（迁移自 index.js）
         */
        async runBatchSummary(start, end, step, mode = 'chat', silent = false) {
            const self = this;
            const API_CONFIG = window.Gaigai.config;
            const totalRange = end - start;
            const batches = [];

            // 切分任务
            for (let i = start; i < end; i += step) {
                const batchEnd = Math.min(i + step, end);
                batches.push({ start: i, end: batchEnd });
            }

            console.log(`📊 [分批总结] 开始: ${batches.length} 批`);

            // ✨ 1. 初始化全局状态
            window.Gaigai.stopBatch = false;
            window.Gaigai.isBatchRunning = true; // 标记正在运行

            let successCount = 0;
            let failedBatches = [];
            let actualProgress = start; // ✅ 记录实际完成的进度位置

            // 辅助函数：更新按钮外观
            const updateBtn = (text, isRunning) => {
                const $btn = $('#sum-chat-run');
                if ($btn.length > 0) {
                    $btn.text(text)
                        .css('background', isRunning ? '#dc3545' : '#2196f3')
                        .css('opacity', '1')
                        .prop('disabled', false);
                }
            };

            if (!silent) {
                if (typeof toastr !== 'undefined') toastr.info(`开始执行 ${batches.length} 个批次`, '任务启动');
            }

            // 依次执行每一批
            for (let i = 0; i < batches.length; i++) {
                // 🛑 循环内检测刹车
                if (window.Gaigai.stopBatch) {
                    console.log('🛑 [分批总结] 用户手动停止');
                    if (!silent) await window.Gaigai.customAlert('✅ 任务已手动停止', '已中止');
                    break;
                }

                // ⏳ 冷却逻辑
                if (i > 0) {
                    for (let d = 5; d > 0; d--) {
                        if (window.Gaigai.stopBatch) break;
                        updateBtn(`⏳ 冷却 ${d}s... (点此停止)`, true);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                if (window.Gaigai.stopBatch) break;

                const batch = batches[i];
                const batchNum = i + 1;

                updateBtn(`🛑 停止 (${batchNum}/${batches.length})`, true);

                try {
                    console.log(`🔄 [分批 ${batchNum}/${batches.length}] 执行中...`);

                    // 调用核心函数
                    const result = await self.callAIForSummary(batch.start, batch.end, mode, silent, true);

                    // 🛑 [熔断检测] 只有用户明确放弃时才终止
                    if (!result || result.success === false) {
                        console.warn(`🛑 [分批总结] 批次 ${batchNum} 用户选择放弃，任务熔断终止。`);
                        if (!silent) await window.Gaigai.customAlert(`第 ${batchNum} 批用户选择放弃。\n\n为防止数据中断，后续任务已自动停止。`, '任务终止');
                        break;
                    }

                    successCount++;
                    actualProgress = batch.end; // ✅ 更新实际完成的进度
                    if (silent && typeof toastr !== 'undefined') {
                        toastr.success(`进度: ${batchNum}/${batches.length} 已保存`, '分批总结');
                    }

                } catch (error) {
                    console.error(`❌ [分批失败]`, error);
                    failedBatches.push({ batch: batchNum, error: error.message });

                    const userChoice = await window.Gaigai.customConfirm(
                        `第 ${batchNum} 批执行时发生异常：\n${error.message}\n\n是否继续执行后续批次？`,
                        '异常处理',
                        '继续',
                        '停止'
                    );

                    if (!userChoice) {
                        console.warn(`🛑 [分批总结] 用户选择停止，任务终止。`);
                        break;
                    }
                    console.log(`⚠️ [分批总结] 批次 ${batchNum} 失败但用户选择继续`);
                }

                // ⏳ [稳定性等待] 强制等待 5 秒
                console.log(`⏳ [批次缓冲] 等待数据落盘...`);
                await new Promise(r => setTimeout(r, 5000));
            }

            // ✅ 任务结束：重置状态
            window.Gaigai.isBatchRunning = false;
            window.Gaigai.stopBatch = false;

            // ❌ 已移除：不在内部恢复按钮，由外层调用者统一处理
            // updateBtn('🚀 开始聊天总结', false);

            // 结果汇报
            if (successCount > 0) {
                API_CONFIG.lastSummaryIndex = actualProgress; // ✅ 修复：使用实际完成的进度而不是目标 end
                localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));

                if (typeof window.saveAllSettingsToCloud === 'function') window.saveAllSettingsToCloud();

                window.Gaigai.m.save();

                if ($('#edit-last-sum').length) $('#edit-last-sum').val(API_CONFIG.lastSummaryIndex);
                if ($('#man-start').length) $('#man-start').val(API_CONFIG.lastSummaryIndex);
                if ($('#sum-chat-start').length) $('#sum-chat-start').val(API_CONFIG.lastSummaryIndex);
            }

            if (!silent && !window.Gaigai.stopBatch) {
                const msg = failedBatches.length > 0
                    ? `⚠️ 完成，但有 ${failedBatches.length} 批失败。`
                    : `✅ 分批总结全部完成！`;
                await window.Gaigai.customAlert(msg, '完成');
            }

            // 刷新主界面
            if ($('#g-pop').length > 0) window.Gaigai.shw();
        }

        /**
         * 🆕 总结优化/润色功能 (重构版)
         * @param {string} target - 目标类型：'all' | 'last' | 'specific' | 'range'
         * @param {string} userPrompt - 用户的优化建议
         * @param {string} rangeInput - 范围输入（如 "1" 或 "2-5"）
         */
        async optimizeSummary(target, userPrompt, rangeInput = "1") {
            const m = window.Gaigai.m;
            const ctx = m.ctx();

            // 读取第9号表格（总结表）
            const summaryTable = m.s[8];
            if (!summaryTable || summaryTable.r.length === 0) {
                await window.Gaigai.customAlert('⚠️ 总结表为空，无内容可优化！', '提示');
                return;
            }

            // 1. 解析目标索引
            let targetIndices = [];
            const totalRows = summaryTable.r.length;

            if (target === 'all') {
                targetIndices = Array.from({ length: totalRows }, (_, i) => i);
            } else if (target === 'last') {
                targetIndices = [totalRows - 1];
            } else if (target === 'specific' || target === 'range') {
                // 解析 "2" 或 "2-5"
                const parts = rangeInput.split(/[-–,]/); // 支持 - 或 , 分隔
                let start = parseInt(parts[0]);
                let end = parts.length > 1 ? parseInt(parts[1]) : start;

                if (isNaN(start)) start = 1;
                if (isNaN(end)) end = start;

                // 修正大小关系和边界
                if (start > end) [start, end] = [end, start];
                start = Math.max(1, start);
                end = Math.min(totalRows, end);

                for (let i = start; i <= end; i++) {
                    targetIndices.push(i - 1); // 转为 0-based 索引
                }
            }

            if (targetIndices.length === 0) {
                await window.Gaigai.customAlert('⚠️ 有效范围为空！', '错误');
                return;
            }

            console.log(`✨ [优化] 目标索引: ${targetIndices.join(', ')}`);

            // 2. 构建消息上下文 (分段发送)
            const messages = [];

            // System: NSFW 破限
            messages.push({
                role: 'system',
                content: window.Gaigai.PromptManager.resolveVariables(
                    window.Gaigai.PromptManager.get('nsfwPrompt'),
                    ctx
                )
            });

            // System: 注入原始内容 (独立消息块)
            // 用于回显对比的原始文本
            let originalContentForDisplay = [];

            targetIndices.forEach(idx => {
                const row = summaryTable.r[idx];
                const title = row[0] || '';
                const content = row[1] || '';
                const fullContent = title + (content ? '\n\n' + content : '');

                originalContentForDisplay.push(`【第 ${idx + 1} 页】\n${fullContent}`);

                // ✨ 核心修改：每一页作为独立的 system message 发送
                messages.push({
                    role: 'system',
                    content: `【待优化内容 - 第 ${idx + 1} 页】\n${fullContent}`
                });
            });

            // 3. 构建 Prompt 指令
            let baseInstruction = window.Gaigai.PromptManager.get('summaryPromptChat');
            if (!baseInstruction || !baseInstruction.trim()) {
                baseInstruction = '请对上述内容进行润色和优化。';
            }
            baseInstruction = window.Gaigai.PromptManager.resolveVariables(baseInstruction, ctx);

            // ✨ 核心修改：如果是多段优化，强制注入分隔符指令
            let formatInstruction = "";
            if (targetIndices.length > 1) {
                formatInstruction = `\n\n⚠️⚠️⚠️ 【重要格式要求】 ⚠️⚠️⚠️\n你正在同时优化 ${targetIndices.length} 个独立的页面。请务必保持它们的独立性！\n在输出时，不同页面的优化结果之间**必须**使用 \`---分隔线---\` 进行分割。\n严禁将它们合并成一段！请严格按照原文顺序输出。`;
            }

            // 用户自定义要求
            let customReq = "";
            if (userPrompt && userPrompt.trim()) {
                customReq = `\n\n💬 【用户特殊要求】\n${userPrompt}\n请优先遵循此要求。`;
            }

            messages.push({
                role: 'user',
                content: baseInstruction + customReq + formatInstruction
            });

            // 4. 调用 API
            window.Gaigai.lastRequestData = {
                chat: JSON.parse(JSON.stringify(messages)),
                timestamp: Date.now(),
                model: window.Gaigai.config.useIndependentAPI ? window.Gaigai.config.model : 'Tavern'
            };

            let result;
            window.isSummarizing = true;
            try {
                const apiFunc = window.Gaigai.config.useIndependentAPI ? window.callIndependentAPI : window.callTavernAPI;
                result = await apiFunc(messages);
            } catch (e) {
                await window.Gaigai.customAlert(`API错误: ${e.message}`, '错误');
                return;
            } finally {
                window.isSummarizing = false;
            }

            // 5. 处理结果
            if (result && result.success) {
                const unesc = window.Gaigai.unesc || ((s) => s);
                let rawText = unesc(result.summary || result.text || '').trim();

                // 移除思考过程
                if (rawText.includes('<think>')) rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

                // 尝试拆分
                let segments = [];
                if (targetIndices.length > 1) {
                    segments = rawText.split(/\n*---+分隔线---+\n*/).filter(s => s.trim());

                    // 容错：如果分割失败，尝试用 --- 分割
                    if (segments.length < targetIndices.length) {
                         segments = rawText.split(/\n*---+\n*/).filter(s => s.trim());
                    }
                } else {
                    segments = [rawText];
                }

                // 校验数量
                if (segments.length !== targetIndices.length) {
                    console.warn(`段落不匹配: 预期 ${targetIndices.length}, 实际 ${segments.length}`);
                    // 弹窗警告，但允许用户手动处理
                    if (await window.Gaigai.customConfirm(
                        `⚠️ AI返回的段落数 (${segments.length}) 与目标页数 (${targetIndices.length}) 不一致！\n\n这可能导致内容错位。\n是否仍要打开预览窗口进行人工修正？`,
                        '格式警告'
                    )) {
                        // 继续执行，将整个文本作为第一个元素，用户自己去复制粘贴
                        if(segments.length === 0) segments = [rawText];
                    } else {
                        return;
                    }
                }

                // 重新组合用于预览的文本 (用分隔线连起来方便显示)
                const finalPreview = segments.join('\n\n---分隔线---\n\n');
                const originalPreview = originalContentForDisplay.join('\n\n---分隔线---\n\n');

                // 显示确认窗口
                await this._showOptimizeConfirm(finalPreview, targetIndices, originalPreview);

            } else {
                await window.Gaigai.customAlert(`生成失败: ${result?.error}`, '错误');
            }
        }

        /**
         * 显示优化结果确认弹窗
         * @private
         */
        _showOptimizeConfirm(optimizedContent, targetIndices, originalContent) {
            const self = this;
            const UI = window.Gaigai.ui;
            const esc = window.Gaigai.esc;
            const m = window.Gaigai.m;

            // 🔒 关键修复：记录弹窗打开时的会话ID
            const initialSessionId = m.gid();
            if (!initialSessionId) {
                window.Gaigai.customAlert('🛑 安全拦截：无法获取会话标识', '错误');
                return Promise.resolve({ success: false });
            }
            console.log(`🔒 [弹窗打开] 会话ID: ${initialSessionId}`);

            return new Promise((resolve) => {
                const h = `
                <div class="g-p" style="background:#fff !important; color:${UI.tc} !important;">
                    <h4>✨ 优化结果确认</h4>
                    <p style="color:${UI.tc}; opacity:0.8; font-size:11px; margin-bottom:10px;">
                        AI已完成总结优化，请确认无误后选择保存方式。<br>
                        支持手动修改内容。
                    </p>

                    <div style="margin-bottom: 10px;">
                        <label style="font-size:11px; font-weight:bold; display:block; margin-bottom:4px; color:${UI.tc};">📝 原始内容：</label>
                        <textarea readonly style="width:100%; height:120px; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:11px; resize:vertical; background-color: #f5f5f5 !important; color: ${UI.tc} !important; opacity:0.7;">${esc(originalContent)}</textarea>
                    </div>

                    <div style="margin-bottom: 10px;">
                        <label style="font-size:11px; font-weight:bold; display:block; margin-bottom:4px; color:${UI.tc};">✨ 优化后内容：</label>
                        <textarea id="opt-result-editor" style="width:100%; height:250px; padding:10px; border:1px solid #ddd; border-radius:4px; font-size:12px; font-family:inherit; resize:vertical; line-height:1.6; background-color: #ffffff !important; color: ${UI.tc} !important;">${esc(optimizedContent)}</textarea>
                    </div>

                    <div style="margin-top:12px; display: flex; gap: 10px;">
                        <button id="opt-cancel" style="padding:8px 16px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🚫 放弃</button>
                        <button id="opt-append" style="padding:8px 16px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">➕ 追加新行</button>
                        <button id="opt-replace" style="padding:8px 16px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 2; font-weight:bold;">🔄 覆盖原内容</button>
                    </div>
                </div>
                `;

                $('#g-optimize-pop').remove();
                const $o = $('<div>', { id: 'g-optimize-pop', class: 'g-ov', css: { 'z-index': '10000006' } });
                const $p = $('<div>', { class: 'g-w', css: { width: '800px', maxWidth: '92vw', height: 'auto' } });

                const $hd = $('<div>', { class: 'g-hd' });
                $hd.append(`<h3 style="color:${UI.tc}; flex:1;">✨ 总结优化</h3>`);

                const $x = $('<button>', { class: 'g-x', text: '×', css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' } }).on('click', () => {
                    $o.remove();
                    resolve({ success: false });
                });
                $hd.append($x);

                const $bd = $('<div>', { class: 'g-bd', html: h });
                $p.append($hd, $bd);
                $o.append($p);
                $('body').append($o);

                setTimeout(() => {
                    // 放弃按钮
                    $('#opt-cancel').on('click', () => {
                        $o.remove();
                        resolve({ success: false });
                    });

                    // 追加新行按钮
                    $('#opt-append').on('click', async function() {
                        const finalContent = $('#opt-result-editor').val().trim();
                        if (!finalContent) return;

                        // 🔒 安全检查1：验证会话ID是否一致
                        const currentSessionId = m.gid();
                        if (!currentSessionId) {
                            await window.Gaigai.customAlert('🛑 安全拦截：无法获取会话标识', '错误');
                            return;
                        }

                        if (currentSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 执行时: ${currentSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作\n\n请重新打开总结优化功能', '错误');
                            return;
                        }

                        // 🔒 安全检查2：验证总结表存在
                        if (!m.s[8]) {
                            await window.Gaigai.customAlert('🛑 安全拦截：总结表不存在', '错误');
                            return;
                        }

                        // 添加到总结表末尾
                        m.sm.save(finalContent, '优化版');

                        // 🔒 安全检查3：保存前再次验证会话ID
                        const finalSessionId = m.gid();
                        if (finalSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 保存前: ${finalSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作', '错误');
                            return;
                        }

                        console.log(`🔒 [安全验证通过] 会话ID: ${finalSessionId}, 追加新页到总结表`);

                        m.save();
                        const updateCurrentSnapshot = window.updateCurrentSnapshot || (() => {});
                        updateCurrentSnapshot();

                        await window.Gaigai.customAlert('✅ 优化内容已作为新页追加！', '成功');
                        $o.remove();

                        // 刷新UI
                        const shw = window.Gaigai.shw;
                        if (shw) shw();

                        resolve({ success: true });
                    });

                    // 覆盖按钮
                    $('#opt-replace').on('click', async function() {
                        const finalContent = $('#opt-result-editor').val().trim();
                        if (!finalContent) return;

                        // 🔒 安全检查1：验证会话ID是否一致
                        const currentSessionId = m.gid();
                        if (!currentSessionId) {
                            await window.Gaigai.customAlert('🛑 安全拦截：无法获取会话标识', '错误');
                            return;
                        }

                        if (currentSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 执行时: ${currentSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作\n\n请重新打开总结优化功能', '错误');
                            return;
                        }

                        // 🔒 安全检查2：验证总结表和目标索引
                        if (!m.s[8]) {
                            await window.Gaigai.customAlert('🛑 安全拦截：总结表不存在', '错误');
                            return;
                        }

                        // 🔒 安全检查3：验证目标索引在有效范围内
                        for (let idx of targetIndices) {
                            if (idx < 0 || idx >= m.s[8].r.length) {
                                await window.Gaigai.customAlert(`🛑 安全拦截：页码索引 ${idx} 超出范围`, '错误');
                                return;
                            }
                        }

                        // ✅ 智能拆分：根据优化的总结数量决定拆分策略
                        let segments = [];

                        if (targetIndices.length > 1) {
                            // 多个总结：按分隔线拆分
                            segments = finalContent.split(/\n*---+分隔线---+\n*/);

                            // 如果拆分后的段落数量与目标索引不匹配，尝试其他分隔符
                            if (segments.length !== targetIndices.length) {
                                // 尝试按 \n\n\n（三个换行）拆分
                                segments = finalContent.split(/\n\n\n+/);
                            }

                            // 如果还是不匹配，说明AI没按格式返回，将所有内容写入第一个索引
                            if (segments.length !== targetIndices.length) {
                                console.warn(`⚠️ AI返回段落数(${segments.length})与目标数(${targetIndices.length})不匹配，将全部内容写入第一个总结`);
                                segments = [finalContent];
                                // 只覆盖第一个索引
                                targetIndices = [targetIndices[0]];
                            }
                        } else {
                            // 单个总结：整体处理
                            segments = [finalContent];
                        }

                        // 覆盖该行逻辑 - 修正版
                        targetIndices.forEach((idx, i) => {
                            const segment = (segments[i] || '').trim();
                            if (!segment) return;

                            // ✨✨✨ 核心修复：不再尝试拆分标题和正文 ✨✨✨
                            // 1. 获取原标题 (保留原标题，防止元数据丢失)
                            let originalTitle = '';
                            if (m.s[8] && m.s[8].r[idx]) {
                                originalTitle = m.s[8].r[idx][0];
                            }

                            // 2. 如果原标题为空，给个默认值
                            const newTitle = originalTitle || '剧情总结 (优化版)';

                            // 3. 将 AI 返回的全部内容放入正文 (Content)，不进行切割
                            const newContent = segment;

                            // 4. 执行写入
                            if (m.s[8].r[idx]) {
                                m.s[8].r[idx][0] = newTitle;   // 第0列：标题
                                m.s[8].r[idx][1] = newContent; // 第1列：正文
                            }
                        });

                        // 🔒 安全检查4：保存前再次验证会话ID
                        const finalSessionId = m.gid();
                        if (finalSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 保存前: ${finalSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作', '错误');
                            return;
                        }

                        console.log(`🔒 [安全验证通过] 会话ID: ${finalSessionId}, 覆盖 ${targetIndices.length} 页内容`);

                        m.save();
                        const updateCurrentSnapshot = window.updateCurrentSnapshot || (() => {});
                        updateCurrentSnapshot();

                        await window.Gaigai.customAlert(`✅ 已覆盖 ${targetIndices.length} 页内容！`, '成功');
                        $o.remove();

                        // 刷新UI
                        const shw = window.Gaigai.shw;
                        if (shw) shw();

                        resolve({ success: true });
                    });
                }, 100);
            });
        }
    }

    // 挂载到 window.Gaigai
    window.Gaigai.SummaryManager = new SummaryManager();
    console.log('✅ [SummaryManager] 已挂载到 window.Gaigai.SummaryManager');
})();
