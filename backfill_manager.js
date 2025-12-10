/**
 * ⚡ Gaigai记忆插件 - 剧情追溯填表模块
 *
 * 功能：将历史对话内容通过AI分析，自动生成记忆表格填充指令
 * 支持：单表追溯、自定义建议、批量执行
 *
 * @version 1.3.3
 * @author Gaigai Team
 */

(function() {
    'use strict';

    class BackfillManager {
        constructor() {
            console.log('✅ [BackfillManager] 初始化完成');
        }

        /**
         * 显示追溯填表UI界面
         */
        showUI() {
            const m = window.Gaigai.m;
            const UI = window.Gaigai.ui;
            const ctx = m.ctx();
            const totalCount = ctx && ctx.chat ? ctx.chat.length : 0;

            // ✅ 读取追溯进度（不是总结进度）
            const API_CONFIG = window.Gaigai.config;
            let savedIndex = API_CONFIG.lastBackfillIndex || 0;
            // ✅ 智能归零逻辑（仅在聊天记录已加载时执行，防止误重置）
            if (totalCount > 0 && savedIndex > totalCount) savedIndex = 0;
            const defaultStart = savedIndex;

            // 🆕 构建表格下拉选项
            let tableOptions = '<option value="-1">全部表格</option>';
            m.s.slice(0, 8).forEach((sheet, i) => {
                const displayName = i === 1 ? '支线追踪' : sheet.n;
                tableOptions += `<option value="${i}">表${i} - ${displayName}</option>`;
            });

            // 1. 渲染界面
            const h = `
        <div class="g-p" style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
            <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 12px; border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h4 style="margin:0; color:${UI.tc};">⚡ 剧情追溯填表</h4>
                    <span style="font-size:11px; opacity:0.8; color:${UI.tc};">当前总楼层: <strong>${totalCount}</strong></span>
                </div>

                <!-- ✨ 进度指针控制区 -->
                <div style="background: rgba(0,0,0,0.03); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid rgba(0,0,0,0.1);">
                    <div style="display:flex; align-items:center; gap:8px; justify-content:center;">
                        <span style="font-size:11px; color:${UI.tc}; opacity:0.8;">追溯进度指针:</span>
                        <input type="number" id="bf-progress-input" value="${savedIndex}" min="0" max="${totalCount}" style="width:70px; text-align:center; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2); font-size:11px;">
                        <span style="font-size:11px; color:${UI.tc}; opacity:0.8;">层</span>
                        <button id="bf-fix-btn" style="padding:6px 12px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold; white-space:nowrap;">修正</button>
                    </div>
                    <div style="font-size:9px; color:${UI.tc}; text-align:center; margin-top:6px; opacity:0.7;">
                        💡 手动修正进度后，下次追溯将从此位置开始
                    </div>
                </div>

                <div style="background:rgba(255, 193, 7, 0.15); padding:8px; border-radius:4px; font-size:11px; color:${UI.tc}; margin-bottom:10px; border:1px solid rgba(255, 193, 7, 0.3);">
                    💡 <strong>功能说明：</strong><br>
                    此功能会让AI阅读指定范围的历史记录，自动生成表格内容。<br>
                    生成完成后，将<strong>弹出独立窗口</strong>供您方便地确认和修改。
                </div>

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <div style="flex:1;">
                        <label style="font-size:11px; display:block; margin-bottom:2px; color:${UI.tc};">起始楼层</label>
                        <input type="number" id="bf-start" value="${defaultStart}" min="0" max="${totalCount}" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    </div>

                    <span style="font-weight:bold; color:${UI.tc}; margin-top:16px;">➜</span>
                    <div style="flex:1;">
                        <label style="font-size:11px; display:block; margin-bottom:2px; color:${UI.tc};">结束楼层</label>
                        <input type="number" id="bf-end" value="${totalCount}" min="0" max="${totalCount}" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);">
                    </div>
                </div>

                <!-- 🆕 目标表格选择 -->
                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px; color:${UI.tc};">🎯 目标表格</label>
                    <select id="bf-target-table" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2); font-size:12px; background:#fff; color:${UI.tc};">
                        ${tableOptions}
                    </select>
                    <div style="font-size:9px; color:${UI.tc}; opacity:0.7; margin-top:4px;">
                        💡 选择"全部表格"或指定单个表格进行追溯
                    </div>
                </div>

                <!-- 🆕 自定义建议输入框 -->
                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px; color:${UI.tc};">💬 重点建议 (可选)</label>
                    <textarea id="bf-custom-prompt" placeholder="例如：重点关注角色情感变化；记录时间和地点；注意特殊道具..." style="width:100%; height:60px; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2); font-size:11px; resize:vertical; font-family:inherit; background:#fff; color:${UI.tc};"></textarea>
                    <div style="font-size:9px; color:${UI.tc}; opacity:0.7; margin-top:4px;">
                        💡 输入您希望AI重点关注的内容，将作为高优先级指令
                    </div>
                </div>

                <!-- ✨ 分批执行选项 -->
                <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.15);">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-bottom: 6px;">
                        <input type="checkbox" id="bf-batch-mode" style="transform: scale(1.2);">
                        <span style="color:${UI.tc}; font-weight: 600;">📦 分批执行（推荐范围 > 50 层）</span>
                    </label>
                    <div id="bf-batch-options" style="display: none; margin-top: 8px; padding-left: 8px;">
                        <label style="font-size: 11px; display: block; margin-bottom: 4px; color:${UI.tc}; opacity: 0.9;">每批处理楼层数：</label>
                        <input type="number" id="bf-step" value="20" min="5" max="100" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); font-size: 12px;">
                        <div style="font-size: 10px; color: ${UI.tc}; opacity: 0.7; margin-top: 4px;">
                            💡 建议值：20-30层。批次间会自动冷却5秒，避免API限流。
                        </div>
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-top: 8px;">
                        <input type="checkbox" id="bf-silent-mode" ${window.Gaigai.config_obj.autoBackfillSilent ? 'checked' : ''} style="transform: scale(1.2);">
                        <span style="color:${UI.tc};">🤫 静默执行 (不弹窗确认，直接写入)</span>
                    </label>
                </div>

                <button id="bf-gen" style="width:100%; padding:10px; background:${UI.c}; color:${UI.tc}; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    🚀 开始分析并生成
                </button>
                <div id="bf-status" style="text-align:center; margin-top:8px; font-size:11px; color:${UI.tc}; opacity:0.8; min-height:16px;"></div>
            </div>
        </div>`;

            // ✅ 使用 pop() 函数显示界面，第三个参数 true 显示返回按钮
            window.Gaigai.pop('⚡ 剧情追溯填表', h, true);

            // ✨✨✨ 关键修复：阻止输入框的按键冒泡，防止触发酒馆快捷键导致关闭 ✨✨✨
            $('#bf-start, #bf-end, #bf-step, #bf-progress-input, #bf-custom-prompt').on('keydown keyup input', function (e) {
                e.stopPropagation();
            });

            // 绑定UI事件
            this._bindUIEvents(totalCount, defaultStart);
        }

        /**
         * 绑定UI事件（私有方法）
         */
        _bindUIEvents(totalCount, defaultStart) {
            const self = this;
            const API_CONFIG = window.Gaigai.config;
            const m = window.Gaigai.m;
            const UI = window.Gaigai.ui;

            setTimeout(() => {
                // ✨✨✨ 【关键修复】检测分批任务是否正在运行，恢复按钮状态 ✨✨✨
                if (window.Gaigai.isBatchBackfillRunning) {
                    const $btn = $('#bf-gen');
                    if ($btn.length > 0) {
                        $btn.text('🛑 停止任务 (后台执行中)')
                            .css('background', '#dc3545')
                            .css('opacity', '1')
                            .prop('disabled', false);
                    }
                    const $status = $('#bf-status');
                    if ($status.length > 0) {
                        $status.text('⚠️ 分批任务正在后台执行，点击按钮可停止')
                               .css('color', '#ff9800');
                    }
                    console.log('🔄 [界面恢复] 检测到分批追溯正在执行，已恢复按钮状态');
                }

                // ✅ 修正按钮 - 手动修正追溯进度
                $('#bf-fix-btn').on('click', async function () {
                    const newValue = parseInt($('#bf-progress-input').val());

                    // 验证输入
                    if (isNaN(newValue)) {
                        await window.Gaigai.customAlert('请输入有效的数字', '错误');
                        return;
                    }

                    if (newValue < 0) {
                        await window.Gaigai.customAlert('进度不能为负数', '错误');
                        return;
                    }

                    const ctx = m.ctx();
                    const totalCount = ctx && ctx.chat ? ctx.chat.length : 0;

                    if (newValue > totalCount) {
                        await window.Gaigai.customAlert(`进度不能超过当前总楼层数 (${totalCount})`, '错误');
                        return;
                    }

                    // 更新进度指针
                    API_CONFIG.lastBackfillIndex = newValue;

                    // 保存到 localStorage
                    try { localStorage.setItem('gg_api', JSON.stringify(API_CONFIG)); } catch (e) { }

                    // ✅ 关键步骤：同步到聊天记录元数据
                    m.save();

                    // ✅ 同步到云端服务器 (确保多设备一致性)
                    if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                        await window.Gaigai.saveAllSettingsToCloud().catch(err => {
                            console.warn('⚠️ [修正进度] 云端同步失败:', err);
                        });
                    }

                    // 更新起始楼层输入框
                    $('#bf-start').val(newValue);

                    // 成功提示
                    if (typeof toastr !== 'undefined') {
                        toastr.success(`追溯进度已修正为第 ${newValue} 层`, '进度修正', { timeOut: 1500, preventDuplicates: true });
                    } else {
                        await window.Gaigai.customAlert(`✅ 追溯进度已修正为第 ${newValue} 层\n\n已同步到本地和云端`, '成功');
                    }

                    console.log(`✅ [手动修正] 追溯进度已更新: ${newValue}`);
                });

                // ✅ 分批模式复选框切换
                $('#bf-batch-mode').on('change', function () {
                    if ($(this).is(':checked')) {
                        $('#bf-batch-options').slideDown(200);
                    } else {
                        $('#bf-batch-options').slideUp(200);
                    }
                });

                // ✅ 范围变化时智能提示
                $('#bf-start, #bf-end').on('change', function () {
                    const start = parseInt($('#bf-start').val()) || 0;
                    const end = parseInt($('#bf-end').val()) || 0;
                    const range = end - start;

                    if (range > 50 && !$('#bf-batch-mode').is(':checked')) {
                        // 自动勾选并展开分批选项
                        $('#bf-batch-mode').prop('checked', true).trigger('change');

                        // 显示建议提示
                        const $status = $('#bf-status');
                        $status.text('💡 检测到范围 > 50层，已自动启用分批模式').css('color', '#ffc107');
                        setTimeout(() => $status.text('').css('color', UI.tc), 3000);
                    }
                });

                // ✅ 主按钮点击事件
                $('#bf-gen').off('click').on('click', async function () {
                    const start = parseInt($('#bf-start').val());
                    const end = parseInt($('#bf-end').val());
                    const isBatchMode = $('#bf-batch-mode').is(':checked');
                    const step = parseInt($('#bf-step').val()) || 20;
                    const targetIndex = parseInt($('#bf-target-table').val()); // 🆕 获取目标表格
                    const customNote = $('#bf-custom-prompt').val().trim(); // 🆕 获取自定义建议

                    if (isNaN(start) || isNaN(end) || start >= end) {
                        await window.Gaigai.customAlert('请输入有效的楼层范围 (起始 < 结束)', '错误');
                        return;
                    }

                    const range = end - start;

                    // 🛑 检测是否正在运行批量任务
                    if (window.Gaigai.isBatchBackfillRunning) {
                        // 停止任务
                        window.Gaigai.stopBatchBackfill = true;
                        console.log('🛑 [用户操作] 请求停止批量追溯');
                        return;
                    }

                    // ✨ 智能决策：超过50层且未勾选分批，弹窗建议
                    if (range > 50 && !isBatchMode) {
                        const confirmed = await window.Gaigai.customConfirm(
                            `检测到范围较大（${range} 层）。\n\n建议使用"分批执行"模式，避免超时或内容丢失。\n\n是否切换为分批模式？`,
                            '⚠️ 建议'
                        );
                        if (confirmed) {
                            $('#bf-batch-mode').prop('checked', true).trigger('change');
                            await window.Gaigai.customAlert('已启用分批模式，请再次点击"开始"按钮执行。', '提示');
                            return;
                        }
                    }

                    const $btn = $(this);
                    const oldText = $btn.text();

                    if (isBatchMode) {
                        // 📦 分批模式
                        // ✅ 立即更新按钮状态，显示正在执行
                        $btn.text('⏳ 正在执行...').prop('disabled', true).css('opacity', 0.7);
                        $('#bf-status').text('初始化分批任务...').css('color', UI.tc);

                        console.log(`📊 [分批追溯] 启动：${start}-${end}，步长 ${step}，目标表格：${targetIndex}, 自定义建议：${customNote ? '有' : '无'}`);
                        await self.runBatchBackfill(start, end, step, true, targetIndex, customNote);

                        // ✅ 执行完毕后，恢复按钮状态
                        $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        $('#bf-status').text('');

                        // ✅ 执行完毕后，刷新进度指针显示
                        if ($('#bf-progress-input').length > 0) {
                            $('#bf-progress-input').val(API_CONFIG.lastBackfillIndex || 0);
                            console.log(`🔄 [界面刷新] 进度指针已更新: ${API_CONFIG.lastBackfillIndex}`);
                        }
                    } else {
                        // 🚀 单次模式
                        $btn.text('⏳ AI正在阅读...').prop('disabled', true).css('opacity', 0.7);
                        $('#bf-status').text('正在请求AI...').css('color', UI.tc);

                        await self.autoRunBackfill(start, end, true, targetIndex, customNote);

                        // 恢复按钮状态
                        $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        $('#bf-status').text('');

                        // ✅ 执行完毕后，刷新进度指针显示
                        if ($('#bf-progress-input').length > 0) {
                            $('#bf-progress-input').val(API_CONFIG.lastBackfillIndex || 0);
                            console.log(`🔄 [界面刷新] 进度指针已更新: ${API_CONFIG.lastBackfillIndex}`);
                        }
                    }
                });
            }, 100);
        }

        /**
         * 批量追溯填表函数 (升级版：支持目标表格和自定义建议)
         * @param {number} start - 起始楼层
         * @param {number} end - 结束楼层
         * @param {number} step - 每批次的楼层数（默认20）
         * @param {boolean} isManual - 是否手动模式
         * @param {number} targetIndex - 目标表格索引（-1表示全部表格）
         * @param {string} customNote - 用户自定义建议
         */
        async runBatchBackfill(start, end, step = 20, isManual = false, targetIndex = -1, customNote = '') {
            const totalRange = end - start;
            const batches = [];
            const API_CONFIG = window.Gaigai.config;

            // 切分任务
            for (let i = start; i < end; i += step) {
                const batchEnd = Math.min(i + step, end);
                batches.push({ start: i, end: batchEnd });
            }

            console.log(`📊 [分批追溯] 开始: ${batches.length} 批，每批 ${step} 层，目标表格：${targetIndex === -1 ? '全部' : '表' + targetIndex}`);

            // ✨ 1. 初始化全局状态
            window.Gaigai.stopBatchBackfill = false;
            window.Gaigai.isBatchBackfillRunning = true; // 标记正在运行

            let successCount = 0;
            let failedBatches = [];
            let isUserCancelled = false; // 标记是否用户主动取消
            let actualProgress = start; // ✅ 记录实际完成的进度位置

            // 辅助函数：更新按钮外观
            const updateBtn = (text, isRunning) => {
                const $btn = $('#bf-gen');
                if ($btn.length > 0) {
                    $btn.text(text)
                        .css('background', isRunning ? '#dc3545' : window.Gaigai.ui.c)
                        .css('opacity', '1')
                        .prop('disabled', false);
                }
            };

            // 辅助函数：更新状态文字
            const updateStatus = (text, color = null) => {
                const $status = $('#bf-status');
                if ($status.length > 0) {
                    $status.text(text);
                    if (color) $status.css('color', color);
                }
            };

            if (typeof toastr !== 'undefined') toastr.info(`开始执行 ${batches.length} 个批次`, '批量追溯启动');

            // 依次执行每一批
            for (let i = 0; i < batches.length; i++) {
                // 🛑 循环内检测刹车
                if (window.Gaigai.stopBatchBackfill) {
                    console.log('🛑 [分批追溯] 用户手动停止');
                    isUserCancelled = true;
                    break;
                }

                // ⏳ 冷却逻辑 (第一批不冷却)
                if (i > 0) {
                    for (let d = 5; d > 0; d--) {
                        if (window.Gaigai.stopBatchBackfill) break;
                        updateBtn(`⏳ 冷却 ${d}s... (点此停止)`, true);
                        updateStatus(`批次间冷却... ${d}秒`, '#ffc107');
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                if (window.Gaigai.stopBatchBackfill) {
                    isUserCancelled = true;
                    break;
                }

                const batch = batches[i];
                const batchNum = i + 1;

                updateBtn(`🛑 停止 (${batchNum}/${batches.length})`, true);
                updateStatus(`正在处理批次 ${batchNum}/${batches.length} (楼层 ${batch.start}-${batch.end})`, '#17a2b8');

                try {
                    console.log(`🔄 [分批追溯 ${batchNum}/${batches.length}] 正在处理楼层 ${batch.start}-${batch.end}...`);

                    // ✨✨✨ 传递 targetIndex 和 customNote ✨✨✨
                    const result = await this.autoRunBackfill(batch.start, batch.end, true, targetIndex, customNote);

                    // 🛑 [熔断检测] 只有用户明确放弃时才终止
                    if (!result || result.success === false) {
                        console.warn(`🛑 [分批追溯] 批次 ${batchNum} 用户选择放弃，任务熔断终止。`);
                        updateStatus(`🛑 批次 ${batchNum} 用户选择放弃，任务已终止`, '#dc3545');
                        // 标记为用户取消，以便后续不弹"全部完成"的提示
                        isUserCancelled = true;
                        break; // <--- 用户放弃：跳出循环
                    }

                    // ✅ 成功（可能是一次成功，也可能是重试后成功）
                    successCount++;
                    actualProgress = batch.end; // ✅ 更新实际完成的进度

                    // 更新进度
                    API_CONFIG.lastBackfillIndex = actualProgress; // ✅ 修复：使用实际进度
                    localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));

                    if (typeof toastr !== 'undefined') {
                        toastr.success(`批次 ${batchNum}/${batches.length} 已完成`, '分批追溯');
                    }

                } catch (error) {
                    console.error(`❌ [分批追溯失败] 批次 ${batchNum}:`, error);
                    failedBatches.push({ batch: batchNum, error: error.message });

                    // 🛑 [异常熔断] 遇到未捕获异常时询问用户
                    updateStatus(`⚠️ 批次 ${batchNum} 发生异常，等待用户选择...`, '#ff9800');
                    const userChoice = await window.Gaigai.customConfirm(
                        `第 ${batchNum} 批执行时发生异常：\n${error.message}\n\n是否继续执行后续批次？`,
                        '异常处理',
                        '继续',
                        '停止'
                    );

                    if (!userChoice) {
                        console.warn(`🛑 [分批追溯] 用户选择停止，任务终止。`);
                        updateStatus(`🛑 用户选择停止，任务已终止`, '#dc3545');
                        isUserCancelled = true;
                        break; // 用户选择停止
                    }
                    // 用户选择继续：不 break，继续下一批次
                    console.log(`⚠️ [分批追溯] 批次 ${batchNum} 失败但用户选择继续`);
                    updateStatus(`⚠️ 批次 ${batchNum} 失败，继续下一批...`, '#ffc107');
                }

                // ⏳ [稳定性等待] 强制等待 5 秒，确保上一批数据已完全写入硬盘且流式解码彻底结束
                console.log(`⏳ [批次缓冲] 等待数据落盘...`);
                await new Promise(r => setTimeout(r, 5000));
            }

            // ✅ 任务结束：重置状态
            window.Gaigai.isBatchBackfillRunning = false;
            window.Gaigai.stopBatchBackfill = false;

            // ❌ 已移除：不在内部恢复按钮，由外层调用者统一处理
            // updateBtn('🚀 开始分析并生成', false);

            if (isUserCancelled) {
                if (!isManual) await window.Gaigai.customAlert('批量任务已手动停止或取消', '已中止');
                setTimeout(() => updateStatus('', null), 3000);
                return;
            }

            // 结果汇报
            if (successCount > 0) {
                API_CONFIG.lastBackfillIndex = actualProgress; // ✅ 修复：使用实际完成的进度而不是目标 end
                localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') window.Gaigai.saveAllSettingsToCloud();
                window.Gaigai.m.save();
                updateStatus('✅ 所有批次已完成！', '#28a745');
            }

            const msg = failedBatches.length > 0
                ? `⚠️ 完成 ${successCount}/${batches.length} 批，有 ${failedBatches.length} 批失败。`
                : `✅ 分批追溯全部完成！共处理 ${batches.length} 批。`;

            if (typeof toastr !== 'undefined') toastr.success(msg, '批量追溯完成');

            // ✨✨✨ 修复：静默模式下不弹窗，只有非静默模式才弹窗 ✨✨✨
            const isSilentMode = $('#bf-silent-mode').length > 0 && $('#bf-silent-mode').is(':checked');

            // 只有当"没勾选静默"或者"有失败批次(可选)"时才弹窗
            if (!isSilentMode) {
                await window.Gaigai.customAlert(msg, '完成');
            }

            setTimeout(() => updateStatus('', null), 3000);
        }

        /**
         * 自动追溯填表核心函数 (升级版：支持单表模式和自定义建议)
         * @param {number} start - 起始楼层
         * @param {number} end - 结束楼层
         * @param {boolean} isManual - 是否手动模式
         * @param {number} targetIndex - 目标表格索引（-1表示全部表格，0-7表示特定表格）
         * @param {string} customNote - 用户自定义建议
         */
        async autoRunBackfill(start, end, isManual = false, targetIndex = -1, customNote = '') {
            const loadConfig = window.loadConfig || (() => Promise.resolve());
            await loadConfig();

            const ctx = window.SillyTavern.getContext();
            if (!ctx || !ctx.chat) return { success: false, reason: 'no_context' };

            console.log(`🔍 [追溯] 正在读取数据源，全量总楼层: ${ctx.chat.length}，目标表格：${targetIndex === -1 ? '全部' : '表' + targetIndex}`);
            const m = window.Gaigai.m;
            m.load();

            let userName = ctx.name1 || 'User';
            let charName = 'Character';
            if (ctx.characterId !== undefined && ctx.characters && ctx.characters[ctx.characterId]) {
                charName = ctx.characters[ctx.characterId].name || ctx.name2 || 'Character';
            } else if (ctx.name2) {
                charName = ctx.name2;
            }

            const messages = [];
            messages.push({
                role: 'system',
                content: window.Gaigai.PromptManager.resolveVariables(window.Gaigai.PromptManager.get('nsfwPrompt'), ctx)
            });

            const chatSlice = ctx.chat.slice(start, end);
            let validCount = 0;

            const cleanMemoryTags = window.Gaigai.cleanMemoryTags;
            const filterContentByTags = window.Gaigai.tools.filterContentByTags; // ✅ 修复：使用正确的引用路径

            chatSlice.forEach(msg => {
                if (msg.isGaigaiData || msg.isGaigaiPrompt) return;
                let content = msg.mes || msg.content || '';
                content = cleanMemoryTags(content);
                content = filterContentByTags(content);
                if (content && content.trim()) {
                    const isUser = msg.is_user || msg.role === 'user';
                    const role = isUser ? 'user' : 'assistant';
                    const name = isUser ? userName : (msg.name || charName);
                    messages.push({ role: role, content: `${name}: ${content}` });
                    validCount++;
                }
            });

            if (validCount === 0) {
                const C = window.Gaigai.config_obj;
                if (!C.autoBackfillSilent) await window.Gaigai.customAlert(`选定范围 (${start}-${end}) 内没有有效的聊天内容`, '提示');
                return { success: true }; // 没内容也算完成，不中断批量
            }

            // 构建上下文和System信息
            let contextBlock = `【背景资料】\n角色: ${charName}\n用户: ${userName}\n`;
            if (ctx.characters && ctx.characterId !== undefined && ctx.characters[ctx.characterId]) {
                const char = ctx.characters[ctx.characterId];
                if (char.description) contextBlock += `\n[人物简介]\n${char.description}\n`;
                if (char.personality) contextBlock += `\n[性格/设定]\n${char.personality}\n`;
                if (char.scenario) contextBlock += `\n[场景/背景]\n${char.scenario}\n`;
            }

            // 世界书
            let scanTextForWorldInfo = '';
            chatSlice.forEach(msg => scanTextForWorldInfo += (msg.mes || msg.content || '') + '\n');

            let worldInfoList = [];
            try {
                if (ctx.worldInfo && Array.isArray(ctx.worldInfo)) {
                    worldInfoList = ctx.worldInfo;
                } else if (window.world_info && Array.isArray(window.world_info)) {
                    worldInfoList = window.world_info;
                }
            } catch (e) { console.error('WorldInfo Error in Backfill:', e); }

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
            if (triggeredLore.length > 0) contextBlock += `\n【相关世界设定】\n${triggeredLore.join('\n')}`;

            messages[0].content = window.Gaigai.PromptManager.resolveVariables(window.Gaigai.PromptManager.get('nsfwPrompt'), ctx) + '\n\n' + contextBlock;

            let insertIndex = 1;
            if (m.sm.has()) {
                const summaryArray = m.sm.loadArray();
                const recentSummaries = summaryArray.slice(-15);
                recentSummaries.forEach((item) => {
                    messages.splice(insertIndex, 0, { role: 'system', content: `【前情提要 - ${item.type || '历史'}】\n${item.content}` });
                    insertIndex++;
                });
            } else {
                messages.splice(insertIndex, 0, { role: 'system', content: '【前情提要】\n（暂无历史总结）' });
                insertIndex++;
            }

            // 🆕 根据 targetIndex 决定插入哪些表格状态
            if (targetIndex === -1) {
                // 全部表格模式
                m.s.slice(0, 8).forEach((sheet, i) => {
                    const sheetName = sheet.n;
                    let sheetContent = sheet.txt(i);

                    // 🆕 空表处理：如果表格为空，手动构造列结构
                    if (!sheetContent || sheetContent.trim() === '') {
                        sheetContent = `(当前暂无数据)\n列结构: ${sheet.c.join(' | ')}`;
                    }

                    const nextIndex = sheet.r.length;
                    const statusInfo = `\n⏭️ 表[${i}] ${sheetName}: 新增请用索引 ${nextIndex}`;
                    messages.splice(insertIndex, 0, { role: 'system', content: `【当前表格状态 - ${sheetName}】\n${sheetContent}${statusInfo}` });
                    insertIndex++;
                });
            } else {
                // 🆕 单表模式：只插入目标表格
                if (targetIndex >= 0 && targetIndex < 8 && m.s[targetIndex]) {
                    const sheet = m.s[targetIndex];
                    const sheetName = targetIndex === 1 ? '支线追踪' : sheet.n;
                    let sheetContent = sheet.txt(targetIndex);

                    // 🆕 空表处理：如果表格为空，手动构造列结构
                    if (!sheetContent || sheetContent.trim() === '') {
                        sheetContent = `(当前暂无数据)\n列结构: ${sheet.c.join(' | ')}`;
                    }

                    const nextIndex = sheet.r.length;
                    const statusInfo = `\n⏭️ 表[${targetIndex}] ${sheetName}: 新增请用索引 ${nextIndex}`;
                    messages.splice(insertIndex, 0, { role: 'system', content: `【当前表格状态 - ${sheetName}】\n${sheetContent}${statusInfo}` });
                    insertIndex++;

                    // 🆕 注入单表模式指令
                    messages.splice(insertIndex, 0, {
                        role: 'system',
                        content: `🎯 【单表追溯模式】\n本次追溯只关注【表${targetIndex} - ${sheetName}】，请仅生成该表的 insertRow/updateRow 指令，忽略其他表格。`
                    });
                    insertIndex++;

                    console.log(`🎯 [单表模式] 只处理表${targetIndex} - ${sheetName}`);
                }
            }

            // 🆕 注入用户自定义建议（高优先级）
            if (customNote && customNote.trim()) {
                messages.splice(insertIndex, 0, {
                    role: 'system',
                    content: `💬 【用户重点建议】\n${customNote.trim()}\n\n请优先遵循以上建议进行分析和记录。`
                });
                insertIndex++;
                console.log(`💬 [自定义建议] 已注入：${customNote.trim()}`);
            }

            let rulesContent = window.Gaigai.PromptManager.get('backfillPrompt');
            const finalInstruction = window.Gaigai.PromptManager.resolveVariables(rulesContent, ctx);

            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                lastMsg.content += '\n\n' + finalInstruction;
            } else {
                messages.push({ role: 'user', content: finalInstruction });
            }

            window.Gaigai.lastRequestData = {
                chat: JSON.parse(JSON.stringify(messages)),
                timestamp: Date.now(),
                model: window.Gaigai.config.useIndependentAPI ? window.Gaigai.config.model : 'Tavern(Direct)'
            };

            let result;
            window.isSummarizing = true;
            try {
                const callIndependentAPI = window.callIndependentAPI;
                const callTavernAPI = window.callTavernAPI;
                if (window.Gaigai.config.useIndependentAPI) {
                    result = await callIndependentAPI(messages);
                } else {
                    result = await callTavernAPI(messages);
                }
            } catch (e) {
                console.error('请求失败', e);
                const customRetryAlert = window.customRetryAlert || window.Gaigai.customAlert;
                const errorMsg = `批量填表失败：${e.message}\n\n是否重新尝试？`;
                const shouldRetry = await customRetryAlert(errorMsg, '⚠️ 生成异常');
                if (shouldRetry) return this.autoRunBackfill(start, end, isManual, targetIndex, customNote);
                return { success: false, reason: 'api_error' };
            } finally {
                window.isSummarizing = false;
            }

            if (result && result.success) {
                const unesc = window.Gaigai.esc ? window.unesc || ((s) => s) : ((s) => s);
                let aiOutput = unesc(result.summary || result.text || '');

                // 1. 尝试匹配完整标签
                const tagMatch = aiOutput.match(/<Memory>([\s\S]*?)<\/Memory>/i);
                let finalOutput = '';

                if (tagMatch) {
                    finalOutput = tagMatch[0];
                } else {
                    // 2. 匹配失败（可能是标签未闭合），进行强力清洗
                    // 🛑 核心修复：先剥离可能存在的残缺标签，防止双重嵌套
                    let cleanContent = aiOutput
                        .replace(/<\/?Memory>/gi, '')  // 去除 <Memory> 和 </Memory>
                        .replace(/<!--/g, '')          // 去除 <!--
                        .replace(/-->/g, '')           // 去除 -->
                        .replace(/```[a-z]*\n?/gi, '') // 去除 Markdown 代码块头
                        .replace(/```/g, '')           // 去除 Markdown 代码块尾
                        .trim();

                    // 去除 AI 的客套话
                    cleanContent = cleanContent
                        .replace(/^(好的|明白|收到|了解|理解|根据|分析|总结|以下是)[^<\n]*\n*/gim, '')
                        .replace(/^.*?(根据|基于|查看|阅读|分析).*?([，,：:]|之后)[^\n]*\n*/gim, '')
                        .trim();

                    // 3. 重新包裹
                    if (cleanContent.includes('insertRow') || cleanContent.includes('updateRow')) {
                        finalOutput = `<Memory><!-- ${cleanContent} --></Memory>`;
                    } else {
                        finalOutput = cleanContent; // 实在没识别到指令，就原样返回方便用户修改
                    }
                }

                if (finalOutput) {
                    const C = window.Gaigai.config_obj;
                    const isSilentMode = isManual ? ($('#bf-silent-mode').length > 0 && $('#bf-silent-mode').is(':checked')) : C.autoBackfillSilent;

                    if (isSilentMode) {
                        const prs = window.prs;
                        const exe = window.exe;

                        // ✨ 先剥离标签和注释，提取纯指令文本（修复静默模式解析问题）
                        let innerText = finalOutput
                            .replace(/<\/?Memory>/gi, '') // 移除 <Memory> 标签
                            .replace(/<!--/g, '')         // 移除 HTML 注释头
                            .replace(/-->/g, '')          // 移除 HTML 注释尾
                            .trim();
                        const cs = prs(innerText);
                        if (cs.length > 0) {
                            exe(cs);
                            window.lastManualEditTime = Date.now();
                            window.Gaigai.config.lastBackfillIndex = end;
                            try { localStorage.setItem('gg_api', JSON.stringify(window.Gaigai.config)); } catch (e) { }
                            if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') window.Gaigai.saveAllSettingsToCloud().catch(e => { });
                            m.save();
                            const updateCurrentSnapshot = window.updateCurrentSnapshot || (() => {});
                            updateCurrentSnapshot();
                            const modeText = isManual ? '手动填表' : '自动填表';
                            if (typeof toastr !== 'undefined') toastr.success(`${modeText}已完成`, '记忆表格', { timeOut: 1000, preventDuplicates: true });
                            if ($('#g-pop').length > 0) {
                                const refreshTable = window.refreshTable || (() => {});
                                const updateTabCount = window.updateTabCount || (() => {});
                                const activeTab = $('.g-t.act').data('i');
                                if (activeTab !== undefined) refreshTable(activeTab);
                                m.s.forEach((_, i) => updateTabCount(i));
                            }
                            return { success: true };
                        } else {
                            console.warn('⚠️ [静默中断] AI输出格式无效，自动降级为手动确认窗口');
                            if (typeof toastr !== 'undefined') toastr.warning('AI未按格式输出，转为手动确认', '静默中断', { timeOut: 3000 });

                            const regenParams = { start, end, isManual, targetIndex, customNote };
                            const userAction = await this.showBackfillEditPopup(finalOutput, end, regenParams);
                            if (!userAction.success) return { success: false, reason: 'fallback_to_manual' };
                            return { success: true };
                        }
                    } else {
                        const regenParams = { start, end, isManual, targetIndex, customNote };
                        const userAction = await this.showBackfillEditPopup(finalOutput, end, regenParams);
                        return userAction;
                    }
                }
                return { success: false, reason: 'no_output' };
            } else if (result) {
                const customRetryAlert = window.customRetryAlert || window.Gaigai.customAlert;
                const errorMsg = `批量填表失败：${result.error || '未知错误'}\n\n是否重新尝试？`;
                const shouldRetry = await customRetryAlert(errorMsg, '⚠️ AI 生成失败');
                if (shouldRetry) return this.autoRunBackfill(start, end, isManual, targetIndex, customNote);
                return { success: false, reason: 'api_failed' };
            }
        }

        /**
         * 独立的追溯结果编辑弹窗
         * @param {string} content - AI生成的内容
         * @param {number} newIndex - 新的进度索引
         * @param {object} regenParams - 重新生成的参数
         * @returns {Promise<{success: boolean}>}
         */
        showBackfillEditPopup(content, newIndex = null, regenParams = null) {
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

            // ✨ 返回 Promise，让外部可以 await 用户点击结果
            return new Promise((resolve) => {
                // 🎯 根据 newIndex 构造标题
                const progressText = newIndex !== null ? ` (进度: ${newIndex}层)` : '';

                const h = `
                <div class="g-p" style="background:#fff !important; color:${UI.tc} !important;">
                    <h4>⚡ 剧情追溯确认${progressText}</h4>
                    <p style="color:${UI.tc}; opacity:0.8; font-size:11px; margin-bottom:10px;">
                        ✅ AI 已生成指令，请检查。<br>
                        💡 点击 <strong>[确认]</strong> 将写入数据并继续，点击 <strong>[放弃]</strong> 将终止后续任务。
                    </p>
                    <textarea id="bf-popup-editor" style="width:100%; height:350px; padding:10px; border:1px solid #ddd; border-radius:4px; font-size:12px; font-family:inherit; resize:vertical; line-height:1.6; background: #ffffff !important; color: #000000 !important;">${esc(content)}</textarea>
                    <div style="margin-top:12px; display: flex; gap: 10px;">
                        <button id="bf-popup-cancel" style="padding:8px 16px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🚫 放弃任务</button>
                        ${regenParams ? '<button id="bf-popup-regen" style="padding:8px 16px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🔄 重新生成</button>' : ''}
                        <button id="bf-popup-confirm" style="padding:8px 16px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 2; font-weight:bold;">🚀 确认并执行</button>
                    </div>
                </div>
                `;

                $('#g-backfill-pop').remove();
                const $o = $('<div>', { id: 'g-backfill-pop', class: 'g-ov', css: { 'z-index': '10000005' } });
                const $p = $('<div>', { class: 'g-w', css: { width: '700px', maxWidth: '92vw', height: 'auto' } });

                const $hd = $('<div>', { class: 'g-hd' });
                $hd.append(`<h3 style="color:${UI.tc}; flex:1;">⚡ 剧情追溯确认</h3>`);

                // ❌ 关闭按钮：视为放弃
                const $x = $('<button>', { class: 'g-x', text: '×', css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' } }).on('click', () => {
                    $o.remove();
                    resolve({ success: false }); // 返回失败
                });
                $hd.append($x);

                const $bd = $('<div>', { class: 'g-bd', html: h });
                $p.append($hd, $bd);
                $o.append($p);
                $('body').append($o);

                setTimeout(() => {
                    // 🚫 放弃按钮
                    $('#bf-popup-cancel').on('click', () => {
                        $o.remove();
                        resolve({ success: false }); // 返回失败
                    });

                    // 🔄 重新生成按钮
                    if (regenParams) {
                        $('#bf-popup-regen').on('click', async function () {
                            const $btn = $(this);
                            const originalText = $btn.text();

                            // 禁用所有按钮
                            $('#bf-popup-cancel, #bf-popup-regen, #bf-popup-confirm').prop('disabled', true);
                            $btn.text('生成中...');

                            try {
                                console.log('🔄 [重新生成] 正在重新调用 API...');
                                window._isRegeneratingBackfill = true;

                                // ✨ 重新调用 autoRunBackfill，但不弹窗（静默模式）
                                // 为了获取纯文本结果，我们需要临时设置为非静默
                                const result = await self.autoRunBackfill(
                                    regenParams.start,
                                    regenParams.end,
                                    regenParams.isManual,
                                    regenParams.targetIndex || -1,
                                    regenParams.customNote || ''
                                );

                                if (result && result.success && result.content) {
                                    // 更新内容框
                                    $('#bf-popup-editor').val(result.content);
                                    if (typeof toastr !== 'undefined') toastr.success('内容已刷新', '重新生成');
                                } else {
                                    // 如果 autoRunBackfill 没有返回 content，说明它已经自动处理了
                                    // 这种情况下需要重新构造 API 调用
                                    await self._regenerateContent(regenParams, $('#bf-popup-editor'));
                                }
                            } catch (error) {
                                console.error('❌ [重新生成失败]', error);
                                await window.Gaigai.customAlert('重新生成失败: ' + error.message, '错误');
                            } finally {
                                window._isRegeneratingBackfill = false;
                                $('#bf-popup-cancel, #bf-popup-regen, #bf-popup-confirm').prop('disabled', false);
                                $btn.text(originalText);
                            }
                        });
                    }

                    // 🚀 确认并执行按钮
                    $('#bf-popup-confirm').on('click', async function () {
                        const finalContent = $('#bf-popup-editor').val().trim();
                        if (!finalContent) {
                            await window.Gaigai.customAlert('⚠️ 内容不能为空！', '提示');
                            return;
                        }

                        // 🔒 安全检查1：验证会话ID是否一致
                        const currentSessionId = m.gid();
                        if (!currentSessionId) {
                            await window.Gaigai.customAlert('🛑 安全拦截：无法获取会话标识', '错误');
                            return;
                        }

                        if (currentSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 执行时: ${currentSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作\n\n请重新打开追溯功能', '错误');
                            return;
                        }

                        // 解析并执行指令
                        const prs = window.prs;
                        const exe = window.exe;
                        const cs = prs(finalContent);
                        if (cs.length === 0) {
                            await window.Gaigai.customAlert('⚠️ 未识别到有效的表格指令！', '解析失败');
                            return;
                        }

                        // 🔒 安全检查2：执行前再次验证会话ID
                        const finalSessionId = m.gid();
                        if (finalSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 执行前: ${finalSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作', '错误');
                            return;
                        }

                        // 🔒 安全检查3：验证指令的表索引范围（防止串表）
                        let hasInvalidIndex = false;
                        for (let i = 0; i < cs.length; i++) {
                            const cmd = cs[i];
                            if (cmd && typeof cmd.ti === 'number') {
                                if (cmd.ti < 0 || cmd.ti > 7) {
                                    console.error(`🛑 [表索引越界] 指令 ${i} 的表索引 ${cmd.ti} 超出范围 [0-7]`);
                                    hasInvalidIndex = true;
                                    break;
                                }
                            }
                        }
                        if (hasInvalidIndex) {
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到非法表索引，已取消操作', '错误');
                            return;
                        }

                        console.log(`🔒 [安全验证通过] 会话ID: ${finalSessionId}, 指令数: ${cs.length}`);

                        // 执行写入
                        exe(cs);
                        window.lastManualEditTime = Date.now();

                        // 更新进度指针
                        if (newIndex !== null) {
                            window.Gaigai.config.lastBackfillIndex = newIndex;
                            try { localStorage.setItem('gg_api', JSON.stringify(window.Gaigai.config)); } catch (e) { }
                        }

                        if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') window.Gaigai.saveAllSettingsToCloud().catch(e => { });

                        // 🔒 安全检查4：保存前第三次验证会话ID（防止执行期间切换会话）
                        const saveSessionId = m.gid();
                        if (saveSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 保存时: ${saveSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，数据未保存\n\n警告：已执行的指令无法回滚，请检查数据完整性！', '严重错误');
                            $o.remove();
                            resolve({ success: false });
                            return;
                        }

                        console.log(`🔒 [最终验证通过] 会话ID: ${saveSessionId}, 准备保存数据`);

                        m.save();
                        const updateCurrentSnapshot = window.updateCurrentSnapshot || (() => {});
                        updateCurrentSnapshot();

                        // 关闭弹窗
                        $o.remove();

                        // 刷新UI
                        const shw = window.Gaigai.shw;
                        if (shw) shw();

                        // ✨ 告诉外部：成功了
                        resolve({ success: true });
                    });
                }, 100);
            });
        }

        /**
         * 重新生成内容（辅助方法）
         * @private
         */
        async _regenerateContent(regenParams, $editor) {
            const ctx = window.SillyTavern.getContext();
            const m = window.Gaigai.m;
            let userName = ctx.name1 || 'User';
            let charName = 'Character';
            if (ctx.characterId !== undefined && ctx.characters && ctx.characters[ctx.characterId]) {
                charName = ctx.characters[ctx.characterId].name || ctx.name2 || 'Character';
            } else if (ctx.name2) {
                charName = ctx.name2;
            }

            const messages = [{
                role: 'system',
                content: window.Gaigai.PromptManager.resolveVariables(window.Gaigai.PromptManager.get('nsfwPrompt'), ctx)
            }];

            // 构建聊天历史
            const chatSlice = ctx.chat.slice(regenParams.start, regenParams.end);
            const cleanMemoryTags = window.Gaigai.cleanMemoryTags;
            const filterContentByTags = window.Gaigai.tools.filterContentByTags; // ✅ 修复：使用正确的引用路径

            chatSlice.forEach(msg => {
                if (msg.isGaigaiData || msg.isGaigaiPrompt) return;
                let content = msg.mes || msg.content || '';
                content = cleanMemoryTags(content);
                content = filterContentByTags(content);
                if (content && content.trim()) {
                    const isUser = msg.is_user || msg.role === 'user';
                    const role = isUser ? 'user' : 'assistant';
                    const name = isUser ? userName : (msg.name || charName);
                    messages.push({ role: role, content: `${name}: ${content}` });
                }
            });

            // 插入上下文
            let contextBlock = `【背景资料】\n角色: ${charName}\n用户: ${userName}\n`;
            if (ctx.characters && ctx.characterId !== undefined && ctx.characters[ctx.characterId]) {
                const char = ctx.characters[ctx.characterId];
                if (char.description) contextBlock += `\n[人物简介]\n${char.description}\n`;
                if (char.personality) contextBlock += `\n[性格/设定]\n${char.personality}\n`;
                if (char.scenario) contextBlock += `\n[场景/背景]\n${char.scenario}\n`;
            }

            // 世界书
            let scanTextForWorldInfo = '';
            chatSlice.forEach(msg => scanTextForWorldInfo += (msg.mes || msg.content || '') + '\n');

            let worldInfoList = [];
            try {
                if (ctx.worldInfo && Array.isArray(ctx.worldInfo)) {
                    worldInfoList = ctx.worldInfo;
                } else if (window.world_info && Array.isArray(window.world_info)) {
                    worldInfoList = window.world_info;
                }
            } catch (e) { console.error('WorldInfo Error in Backfill:', e); }

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
            if (triggeredLore.length > 0) contextBlock += `\n【相关世界设定】\n${triggeredLore.join('\n')}`;

            messages[0].content += '\n\n' + contextBlock;

            // 插入表格状态和前情提要
            let insertIndex = 1;
            if (m.sm.has()) {
                const summaryArray = m.sm.loadArray();
                summaryArray.slice(-15).forEach((item) => {
                    messages.splice(insertIndex, 0, { role: 'system', content: `【前情提要 - ${item.type || '历史'}】\n${item.content}` });
                    insertIndex++;
                });
            } else {
                messages.splice(insertIndex, 0, { role: 'system', content: '【前情提要】\n（暂无历史总结）' });
                insertIndex++;
            }

            const targetIndex = regenParams.targetIndex || -1;
            const customNote = regenParams.customNote || '';

            // 🆕 根据 targetIndex 决定插入哪些表格状态
            if (targetIndex === -1) {
                m.s.slice(0, 8).forEach((sheet, i) => {
                    let sheetContent = sheet.txt(i);

                    // 🆕 空表处理：如果表格为空，手动构造列结构
                    if (!sheetContent || sheetContent.trim() === '') {
                        sheetContent = `(当前暂无数据)\n列结构: ${sheet.c.join(' | ')}`;
                    }

                    const nextIndex = sheet.r.length;
                    messages.splice(insertIndex, 0, { role: 'system', content: `【当前表格状态 - ${sheet.n}】\n${sheetContent}\n⏭️ 新增请用索引 ${nextIndex}` });
                    insertIndex++;
                });
            } else {
                // 单表模式
                if (targetIndex >= 0 && targetIndex < 8 && m.s[targetIndex]) {
                    const sheet = m.s[targetIndex];
                    const sheetName = targetIndex === 1 ? '支线追踪' : sheet.n;
                    let sheetContent = sheet.txt(targetIndex);

                    // 🆕 空表处理：如果表格为空，手动构造列结构
                    if (!sheetContent || sheetContent.trim() === '') {
                        sheetContent = `(当前暂无数据)\n列结构: ${sheet.c.join(' | ')}`;
                    }

                    const nextIndex = sheet.r.length;
                    messages.splice(insertIndex, 0, { role: 'system', content: `【当前表格状态 - ${sheetName}】\n${sheetContent}\n⏭️ 新增请用索引 ${nextIndex}` });
                    insertIndex++;

                    messages.splice(insertIndex, 0, {
                        role: 'system',
                        content: `🎯 【单表追溯模式】\n本次追溯只关注【表${targetIndex} - ${sheetName}】，请仅生成该表的 insertRow/updateRow 指令，忽略其他表格。`
                    });
                    insertIndex++;
                }
            }

            // 🆕 注入用户自定义建议
            if (customNote && customNote.trim()) {
                messages.splice(insertIndex, 0, {
                    role: 'system',
                    content: `💬 【用户重点建议】\n${customNote.trim()}\n\n请优先遵循以上建议进行分析和记录。`
                });
                insertIndex++;
            }

            // User 指令
            let rulesContent = window.Gaigai.PromptManager.get('backfillPrompt');
            const finalInstruction = window.Gaigai.PromptManager.resolveVariables(rulesContent, ctx);

            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                lastMsg.content += '\n\n' + finalInstruction;
            } else {
                messages.push({ role: 'user', content: finalInstruction });
            }

            window.Gaigai.lastRequestData = {
                chat: JSON.parse(JSON.stringify(messages)),
                timestamp: Date.now(),
                model: window.Gaigai.config.useIndependentAPI ? window.Gaigai.config.model : 'Tavern(Direct)'
            };

            // 调用 API
            let result;
            window.isSummarizing = true;
            try {
                const callIndependentAPI = window.callIndependentAPI;
                const callTavernAPI = window.callTavernAPI;
                if (window.Gaigai.config.useIndependentAPI) result = await callIndependentAPI(messages);
                else result = await callTavernAPI(messages);
            } finally {
                window.isSummarizing = false;
            }

            if (result && result.success) {
                const unesc = window.Gaigai.esc ? window.unesc || ((s) => s) : ((s) => s);
                let aiOutput = unesc(result.summary || result.text || '');

                // 1. 尝试匹配完整标签
                const tagMatch = aiOutput.match(/<Memory>([\s\S]*?)<\/Memory>/i);
                let finalOutput = '';

                if (tagMatch) {
                    finalOutput = tagMatch[0];
                } else {
                    // 2. 匹配失败（可能是标签未闭合），进行强力清洗
                    // 🛑 核心修复：先剥离可能存在的残缺标签，防止双重嵌套
                    let cleanContent = aiOutput
                        .replace(/<\/?Memory>/gi, '')  // 去除 <Memory> 和 </Memory>
                        .replace(/<!--/g, '')          // 去除 <!--
                        .replace(/-->/g, '')           // 去除 -->
                        .replace(/```[a-z]*\n?/gi, '') // 去除 Markdown 代码块头
                        .replace(/```/g, '')           // 去除 Markdown 代码块尾
                        .trim();

                    // 去除 AI 的客套话
                    cleanContent = cleanContent
                        .replace(/^(好的|明白|收到|了解|理解|根据|分析|总结|以下是)[^<\n]*\n*/gim, '')
                        .replace(/^.*?(根据|基于|查看|阅读|分析).*?([，,：:]|之后)[^\n]*\n*/gim, '')
                        .trim();

                    // 3. 重新包裹
                    if (cleanContent.includes('insertRow') || cleanContent.includes('updateRow')) {
                        finalOutput = `<Memory><!-- ${cleanContent} --></Memory>`;
                    } else {
                        finalOutput = cleanContent; // 实在没识别到指令，就原样返回方便用户修改
                    }
                }

                // 更新内容框
                $editor.val(finalOutput);
                if (typeof toastr !== 'undefined') toastr.success('内容已刷新', '重新生成');
            } else {
                throw new Error(result.error || 'API失败');
            }
        }
    }

    // 挂载到 window.Gaigai
    window.Gaigai.BackfillManager = new BackfillManager();
    console.log('✅ [BackfillManager] 已挂载到 window.Gaigai.BackfillManager');
})();
