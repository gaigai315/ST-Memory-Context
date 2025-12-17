/**
 * ⚡ Gaigai记忆插件 - 剧情追溯填表模块
 *
 * 功能：将历史对话内容通过AI分析，自动生成记忆表格填充指令
 * 支持：单表追溯、自定义建议、批量执行
 *
 * @version 1.4.2
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
            // ✅ 智能修正逻辑：如果指针超出范围，修正到当前最大值（而不是归零）
            if (totalCount > 0 && savedIndex > totalCount) {
                savedIndex = totalCount;
                console.log(`⚠️ [进度修正] 填表指针超出范围，已修正为 ${totalCount}（原值: ${API_CONFIG.lastBackfillIndex}）`);
            }
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
                    <label style="font-size:11px; display:block; margin-bottom:4px;">🎯 目标表格</label>
                    <select id="bf-target-table" style="width:100%; padding:6px; border-radius:4px; font-size:12px;">
                        ${tableOptions}
                    </select>
                    <div style="font-size:9px; opacity:0.7; margin-top:4px;">
                        💡 选择"全部表格"或指定单个表格进行追溯
                    </div>
                </div>

                <!-- 🆕 功能模式选择 -->
                <div style="margin-bottom:10px; background: rgba(0,0,0,0.05); border-radius: 6px; padding: 10px; border: 1px solid rgba(0,0,0,0.1);">
                    <label style="font-size:11px; display:block; margin-bottom:8px; font-weight:bold; color:${UI.tc};">⚙️ 功能模式</label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-bottom: 6px;">
                        <input type="radio" id="bf-mode-chat" name="bf-mode" value="chat" checked style="transform: scale(1.1);">
                        <span style="color:${UI.tc};">💬 聊天记录填表</span>
                    </label>
                    <div style="font-size:9px; opacity:0.7; margin-left:24px; margin-bottom:8px;">
                        读取历史对话，让AI分析并生成表格内容
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                        <input type="radio" id="bf-mode-table" name="bf-mode" value="table" style="transform: scale(1.1);">
                        <span style="color:${UI.tc};">📊 现有表格优化</span>
                    </label>
                    <div style="font-size:9px; opacity:0.7; margin-left:24px;">
                        读取当前表格内容，让AI进行合并、删减、润色
                    </div>
                </div>

                <!-- ✅ [新增] 重构模式（覆盖）复选框 -->
                <div id="bf-overwrite-section" style="display:none; margin-bottom:10px; background: rgba(220,53,69,0.1); border-radius: 6px; padding: 10px; border: 2px solid rgba(220,53,69,0.3);">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-bottom: 6px;">
                        <input type="checkbox" id="bf-overwrite-mode" style="transform: scale(1.2);">
                        <span style="color: #dc3545; font-weight: 600;">🔥 重构模式 (覆盖原数据)</span>
                    </label>
                    <div style="font-size:10px; color:#dc3545; line-height:1.4; padding-left:24px;">
                        ⚠️ <strong>慎用！</strong>这将清空目标表格的旧数据，完全基于本次选取的聊天记录重新生成。<br>
                        💡 只有在AI成功生成指令且您点击确认后，旧数据才会被清空。
                    </div>
                </div>

                <!-- 🆕 自定义建议输入框 -->
                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px;">💬 重点建议 (可选)</label>
                    <textarea id="bf-custom-prompt" placeholder="例如：重点关注角色情感变化；记录时间和地点；注意特殊道具..." style="width:100%; height:60px; padding:6px; border-radius:4px; font-size:11px; resize:vertical; font-family:inherit;"></textarea>
                    <div style="font-size:9px; opacity:0.7; margin-top:4px;">
                        💡 输入您希望AI重点关注的内容，将作为高优先级指令
                    </div>
                </div>

                <!-- ✨ 分批执行选项 -->
                <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.15);">
                    <!-- 分批执行部分（仅聊天模式显示） -->
                    <div id="bf-batch-section">
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
                    </div>
                    <!-- 静默执行选项（两种模式都显示） -->
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

                 // ✅✅✅ 重构：模式切换时的 UI 联动 (聊天填表 vs 表格优化)
                $('input[name="bf-mode"]').on('change', function () {
                    const mode = $(this).val();
                    const $rangeContainer = $('#bf-start, #bf-end').closest('div').parent(); // 起始/结束范围的容器
                    const $batchSection = $('#bf-batch-section'); // 分批执行区块
                    const $targetSelect = $('#bf-target-table');

                    if (mode === 'table') {
                        // 📊 表格优化模式
                        // 1. 隐藏起始/结束行号输入框（优化是全表处理，不需要范围）
                        $rangeContainer.hide();

                        // 2. 隐藏"分批执行"区块（表格优化按表切分，不需要楼层步长）
                        $batchSection.hide();

                        // 3. 启用"全部表格"选项
                        $targetSelect.find('option[value="-1"]').prop('disabled', false);

                    } else {
                        // 💬 聊天记录填表模式
                        // 1. 显示起始/结束楼层输入框
                        $rangeContainer.show();

                        // 2. 显示"分批执行"区块
                        $batchSection.show();

                        // 3. （可选）禁用"全部表格"选项，如果需要的话
                        // $targetSelect.find('option[value="-1"]').prop('disabled', true);
                    }
                });

                // 🚀 初始化触发一次，确保打开时的状态正确
                $('input[name="bf-mode"]:checked').trigger('change');

                // ✅✅✅ [新增] 控制"重构模式"复选框的显示/隐藏
                const updateOverwriteVisibility = function() {
                    const mode = $('input[name="bf-mode"]:checked').val() || 'chat';
                    const targetIndex = parseInt($('#bf-target-table').val());
                    const $overwriteSection = $('#bf-overwrite-section');
                    const $overwriteCheckbox = $('#bf-overwrite-mode');

                    // 显示条件：聊天模式 且 选择了特定表格（非全部）
                    if (mode === 'chat' && targetIndex !== -1) {
                        $overwriteSection.slideDown(200);
                    } else {
                        // 隐藏并取消勾选
                        $overwriteSection.slideUp(200);
                        $overwriteCheckbox.prop('checked', false);
                    }
                };

                // 监听模式和目标表格的变化
                $('input[name="bf-mode"], #bf-target-table').on('change', updateOverwriteVisibility);

                // 初始化时调用一次
                updateOverwriteVisibility();

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
                    const mode = $('input[name="bf-mode"]:checked').val() || 'chat'; // 🆕 获取功能模式
                    const targetIndex = parseInt($('#bf-target-table').val()); // 🆕 获取目标表格
                    const customNote = $('#bf-custom-prompt').val().trim(); // 🆕 获取自定义建议
                    const isOverwrite = $('#bf-overwrite-mode').is(':checked'); // 🆕 获取重构模式状态

                    let start, end, range, isBatchMode, step;

                    // 根据模式进行不同的验证和参数读取
                    if (mode === 'table') {
                        // 📊 表格优化模式：不需要验证楼层范围
                        // 验证目标表格是否有效
                        if (targetIndex === -1) {
                            // 优化全部表格，检查是否有非空表格
                            const hasNonEmptyTable = m.s.slice(0, 8).some(sheet => sheet && sheet.r && sheet.r.length > 0);
                            if (!hasNonEmptyTable) {
                                await window.Gaigai.customAlert('⚠️ 所有表格都为空，无法进行优化！', '错误');
                                return;
                            }
                        } else {
                            // 优化单个表格，检查表格是否存在且非空
                            const sheet = m.s[targetIndex];
                            if (!sheet || !sheet.r || sheet.r.length === 0) {
                                await window.Gaigai.customAlert(`⚠️ 表${targetIndex}为空，无法进行优化！`, '错误');
                                return;
                            }
                        }
                        // 表格优化模式下，start/end/step等参数不需要
                        start = 0;
                        end = 0;
                        step = 0;
                        isBatchMode = (targetIndex === -1); // 全部表格时自动启用批量模式
                    } else {
                        // 💬 聊天记录填表模式：需要验证楼层范围
                        start = parseInt($('#bf-start').val());
                        end = parseInt($('#bf-end').val());
                        isBatchMode = $('#bf-batch-mode').is(':checked');
                        step = parseInt($('#bf-step').val()) || 20;

                        if (isNaN(start) || isNaN(end) || start >= end) {
                            await window.Gaigai.customAlert('请输入有效的楼层范围 (起始 < 结束)', '错误');
                            return;
                        }

                        range = end - start;

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
                    }

                    // 🛑 检测是否正在运行批量任务
                    if (window.Gaigai.isBatchBackfillRunning) {
                        // 停止任务
                        window.Gaigai.stopBatchBackfill = true;
                        console.log('🛑 [用户操作] 请求停止批量追溯');
                        return;
                    }

                    const $btn = $(this);
                    const oldText = $btn.text();

                    if (isBatchMode) {
                        // 📦 分批模式
                        // ✅ 立即更新按钮状态，显示正在执行
                        $btn.text('⏳ 正在执行...').prop('disabled', true).css('opacity', 0.7);
                        $('#bf-status').text('初始化分批任务...').css('color', UI.tc);

                        console.log(`📊 [分批追溯] 启动：${start}-${end}，步长 ${step}，目标表格：${targetIndex}, 自定义建议：${customNote ? '有' : '无'}, 模式：${mode}, 重构模式：${isOverwrite}`);
                        await self.runBatchBackfill(start, end, step, true, targetIndex, customNote, mode, isOverwrite);

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

                        await self.autoRunBackfill(start, end, true, targetIndex, customNote, mode, isOverwrite);

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
         * 批量追溯填表函数 (完全重构版：按表格对象切分 vs 按楼层切分)
         * @param {number} start - 起始楼层（chat 模式）
         * @param {number} end - 结束楼层（chat 模式）
         * @param {number} step - 每批次的楼层数（chat 模式，默认20）
         * @param {boolean} isManual - 是否手动模式
         * @param {number} targetIndex - 目标表格索引（-1表示全部表格）
         * @param {string} customNote - 用户自定义建议
         * @param {string} mode - 功能模式：'chat'=基于聊天记录追溯, 'table'=基于现有表格优化
         * @param {boolean} isOverwrite - 重构模式（仅chat模式且单表有效）
         */
        /**
         * 批量执行入口 (修复版：即时响应停止 + 指针隔离)
         */
        async runBatchBackfill(start, end, step = 20, isManual = false, targetIndex = -1, customNote = '', mode = 'chat', isOverwrite = false) {
            const API_CONFIG = window.Gaigai.config;
            const m = window.Gaigai.m;
            const batches = [];

            // 1. 任务队列生成
            if (mode === 'table') {
                if (targetIndex === -1) {
                    for (let i = 0; i <= 7; i++) {
                        const sheet = m.s[i];
                        if (sheet && sheet.r && sheet.r.length > 0) {
                            batches.push({ type: 'table', index: i, name: sheet.n });
                        }
                    }
                } else {
                    const sheet = m.s[targetIndex];
                    if (sheet && sheet.r && sheet.r.length > 0) {
                        batches.push({ type: 'table', index: targetIndex, name: sheet.n });
                    }
                }
                console.log(`📊 [表级优化] 任务队列：${batches.length} 个表格`);
            } else {
                for (let i = start; i < end; i += step) {
                    const batchEnd = Math.min(i + step, end);
                    batches.push({ type: 'chat', start: i, end: batchEnd });
                }
                console.log(`💬 [聊天追溯] 任务队列：${batches.length} 批`);
            }

            if (batches.length === 0) {
                if (typeof toastr !== 'undefined') toastr.info('没有需要处理的内容', '提示');
                return;
            }

            // 2. 执行循环
            window.Gaigai.stopBatchBackfill = false;
            window.Gaigai.isBatchBackfillRunning = true;

            let successCount = 0;
            let failedBatches = [];
            let isUserCancelled = false;
            let actualProgress = (mode === 'chat') ? start : 0; 

            // 辅助函数
            const updateBtn = (text, isRunning) => {
                const $btn = $('#bf-gen');
                if ($btn.length > 0) {
                    $btn.text(text)
                        .css('background', isRunning ? '#dc3545' : window.Gaigai.ui.c)
                        .css('opacity', '1')
                        .prop('disabled', false);
                }
            };
            const updateStatus = (text, color = null) => {
                const $status = $('#bf-status');
                if ($status.length > 0) {
                    $status.text(text).css(color ? {color} : {});
                }
            };

            if (typeof toastr !== 'undefined') toastr.info(`开始执行 ${batches.length} 个任务`, mode === 'table' ? '表格优化' : '批量追溯');

            // --- 循环开始 ---
            for (let i = 0; i < batches.length; i++) {
                // 🛑 检查点 1：任务开始前
                if (window.Gaigai.stopBatchBackfill) { isUserCancelled = true; break; }

                // 冷却逻辑
                if (i > 0) {
                    for (let d = 5; d > 0; d--) {
                        if (window.Gaigai.stopBatchBackfill) break; // 🛑 检查点 2：冷却期间
                        updateBtn(`⏳ 冷却 ${d}s... (点此停止)`, true);
                        updateStatus(`批次间冷却... ${d}秒`, '#ffc107');
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
                if (window.Gaigai.stopBatchBackfill) { isUserCancelled = true; break; }

                const batch = batches[i];
                const batchNum = i + 1;
                updateBtn(`🛑 停止 (${batchNum}/${batches.length})`, true);

                try {
                    let result;
                    if (batch.type === 'table') {
                        // 📊 表格优化
                        const sheet = m.s[batch.index];
                        const totalRows = sheet.r.length;
                        updateStatus(`正在优化：表${batch.index} ${batch.name} (${totalRows}行)`, '#17a2b8');
                        
                        result = await this.handleTableOptimization(0, totalRows, true, batch.index, customNote);
                    } else {
                        // 💬 聊天追溯
                        updateStatus(`正在追溯：${batch.start}-${batch.end}层`, '#17a2b8');
                        result = await this.autoRunBackfill(batch.start, batch.end, true, targetIndex, customNote, 'chat', isOverwrite);
                    }

                    // 🛑 检查点 3：API返回后立即检查
                    // 如果在生成过程中点了停止，这里马上生效，不再记录成功状态
                    if (window.Gaigai.stopBatchBackfill) {
                         console.warn(`🛑 [批量任务] 任务 ${batchNum} 执行期间被中止`);
                         isUserCancelled = true;
                         break;
                    }

                    if (!result || result.success === false) {
                        updateStatus(`🛑 任务 ${batchNum} 失败/取消`, '#dc3545');
                        // 失败了通常意味着用户在弹窗里点了取消，视为手动停止
                        isUserCancelled = true; 
                        break;
                    }

                    successCount++;
                    
                    // ✅ 仅聊天模式更新进度条 (修复你的担心)
                    if (batch.type === 'chat') {
                        actualProgress = batch.end;
                        API_CONFIG.lastBackfillIndex = actualProgress;
                        try { localStorage.setItem('gg_api', JSON.stringify(API_CONFIG)); } catch(e){}
                    }

                    if (typeof toastr !== 'undefined') toastr.success(`任务 ${batchNum}/${batches.length} 完成`, '进度');

                } catch (error) {
                    console.error(error);
                    failedBatches.push({ batch: batchNum, error: error.message });
                    const userChoice = await window.Gaigai.customConfirm(
                        `任务 ${batchNum} 发生异常：\n${error.message}\n\n是否继续后续任务？`,
                        '异常处理', '继续', '停止'
                    );
                    if (!userChoice) { isUserCancelled = true; break; }
                }
                
                // 🛑 检查点 4：落盘等待前
                if (window.Gaigai.stopBatchBackfill) { isUserCancelled = true; break; }

                // ⏳ 只有在没按停止的时候，才等待落盘
                // ✅ [修复截断] 增加等待时间从 3 秒到 6 秒，适配 thinking 模型和云同步
                console.log(`⏳ [IO缓冲] 等待数据完全写入 (6秒)...`);
                await new Promise(r => setTimeout(r, 6000));
            }

            // 3. 结束收尾
            window.Gaigai.isBatchBackfillRunning = false;
            window.Gaigai.stopBatchBackfill = false;

            if (isUserCancelled) {
                if (!isManual) await window.Gaigai.customAlert('批量任务已手动停止或取消', '已中止');
                setTimeout(() => updateStatus('', null), 3000);
                return;
            }

            // 保存最终状态
            if (successCount > 0) {
                if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') window.Gaigai.saveAllSettingsToCloud();
                window.Gaigai.m.save();

                // ✅✅✅ 批量任务完成后，强制更新快照，确保与实时填表同步
                const updateCurrentSnapshot = window.updateCurrentSnapshot || (() => {});
                updateCurrentSnapshot();
                console.log('📸 [批量填表完成] 已更新当前楼层快照');
            }

            const msg = failedBatches.length > 0
                ? `⚠️ 完成，但有 ${failedBatches.length} 个任务失败。`
                : `✅ 全部完成！共处理 ${successCount} 个任务。`;

            const isSilentMode = $('#bf-silent-mode').is(':checked');
            if (!isSilentMode) {
                await window.Gaigai.customAlert(msg, '完成');
            } else {
                if (typeof toastr !== 'undefined') toastr.success(msg);
            }

            updateStatus('✅ 就绪', '#28a745');
            setTimeout(() => updateStatus('', null), 3000);
            
            if ($('#g-pop').length > 0) window.Gaigai.shw();
        }

        /**
         * 自动追溯填表核心函数 (升级版：支持单表模式、自定义建议和表格优化模式)
         * @param {number} start - 起始楼层（或起始行索引，取决于模式）
         * @param {number} end - 结束楼层（或结束行索引，取决于模式）
         * @param {boolean} isManual - 是否手动模式
         * @param {number} targetIndex - 目标表格索引（-1表示全部表格，0-7表示特定表格）
         * @param {string} customNote - 用户自定义建议
         * @param {string} mode - 功能模式：'chat'=基于聊天记录追溯, 'table'=基于现有表格优化
         * @param {boolean} isOverwrite - 重构模式（仅chat模式且单表有效）
         */
        async autoRunBackfill(start, end, isManual = false, targetIndex = -1, customNote = '', mode = 'chat', isOverwrite = false) {
            const loadConfig = window.loadConfig || (() => Promise.resolve());
            await loadConfig();

            const ctx = window.SillyTavern.getContext();
            if (!ctx || !ctx.chat) return { success: false, reason: 'no_context' };

            // 🆕 根据模式分支处理
            if (mode === 'table') {
                // 📊 基于现有表格优化模式
                return this.handleTableOptimization(start, end, isManual, targetIndex, customNote);
            } else {
                // 💬 基于聊天记录追溯模式（原逻辑）
                return this.handleChatBackfill(start, end, isManual, targetIndex, customNote, 0, isOverwrite);
            }
        }

        /**
         * 处理聊天记录追溯模式（原 autoRunBackfill 的逻辑）
         * @private
         * @param {number} retryCount - 当前重试次数（防止递归爆炸）
         * @param {boolean} isOverwrite - 重构模式（清空原表数据）
         */
        async handleChatBackfill(start, end, isManual = false, targetIndex = -1, customNote = '', retryCount = 0, isOverwrite = false) {
            const ctx = window.SillyTavern.getContext();
            const m = window.Gaigai.m;

            // 🛑 新增：空卡熔断保护
            if (ctx.chat.length === 0) {
                console.log('🛑 [自动填表] 检测到聊天记录为空（新卡），已跳过执行。');
                return { success: true }; // 返回成功以免触发重试逻辑
            }

            console.log(`🔍 [追溯] 正在读取数据源，全量总楼层: ${ctx.chat.length}，目标表格：${targetIndex === -1 ? '全部' : '表' + targetIndex}`);
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

            // ✅ [性能优化] 分块处理大量消息，防止UI卡死
            const CHUNK_SIZE = 30; // 每 30 条消息让浏览器喘息一次
            console.log(`🔄 [消息处理] 开始处理 ${chatSlice.length} 条消息，分块大小: ${CHUNK_SIZE}`);

            for (let i = 0; i < chatSlice.length; i++) {
                const msg = chatSlice[i];
                if (msg.isGaigaiData || msg.isGaigaiPrompt) continue;

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

                // ✅ [UI喘息] 每处理 30 条消息，让浏览器渲染一次
                if ((i + 1) % CHUNK_SIZE === 0) {
                    await new Promise(r => setTimeout(r, 0));
                    console.log(`⏸️ [进度] 已处理 ${i + 1}/${chatSlice.length} 条消息`);
                }
            }

            console.log(`✅ [消息处理] 完成，有效消息数: ${validCount}`);

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
            // ❌ 追溯模式不需要发送总结内容
            // if (m.sm.has()) {
            //     const summaryArray = m.sm.loadArray();
            //     const recentSummaries = summaryArray.slice(-15);
            //     recentSummaries.forEach((item) => {
            //         messages.splice(insertIndex, 0, { role: 'system', content: `【前情提要 - ${item.type || '历史'}】\n${item.content}` });
            //         insertIndex++;
            //     });
            // } else {
            //     messages.splice(insertIndex, 0, { role: 'system', content: '【前情提要】\n（暂无历史总结）' });
            //     insertIndex++;
            // }

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

            // ✅✅✅ [新增] 重构模式指令（清空原数据）
            if (isOverwrite && targetIndex >= 0 && targetIndex <= 7) {
                const sheet = m.s[targetIndex];
                const sheetName = targetIndex === 1 ? '支线追踪' : sheet.n;
                messages.splice(insertIndex, 0, {
                    role: 'system',
                    content: `🔥 【重构模式启用】\n⚠️ 用户已启用「重构模式」！\n\n📌 核心要求：\n1. **忽略上述表格的所有旧数据**，它们仅供参考，不是你的填写目标。\n2. 本次追溯将完全基于聊天历史（第 ${start}-${end} 层）重新生成【表${targetIndex} - ${sheetName}】。\n3. 所有指令必须使用 **insertRow(${targetIndex}, {...})**，不要使用 updateRow。\n4. 行索引从 0 开始递增（0, 1, 2, 3...），无需考虑旧数据的索引。\n5. 请完整、系统地提取聊天记录中的所有关键信息，生成全新的表格内容。\n\n💡 提示：这是一次「全新建表」，而不是「增量填表」。`
                });
                insertIndex++;
                console.log(`🔥 [重构模式] 已注入特殊指令：目标表${targetIndex}，行范围 ${start}-${end}`);
            }

            let rulesContent = window.Gaigai.PromptManager.get('backfillPrompt');
            let finalInstruction = window.Gaigai.PromptManager.resolveVariables(rulesContent, ctx);

            // 🎯 [关键修复] 单表模式指令直接拼接到 finalInstruction 后面
            if (targetIndex >= 0 && targetIndex < 8 && m.s[targetIndex]) {
                const sheet = m.s[targetIndex];
                const sheetName = targetIndex === 1 ? '支线追踪' : sheet.n;
                finalInstruction += `\n\n🎯 【单表追溯模式 - 最终提醒】\n本次追溯只关注【表${targetIndex} - ${sheetName}】，请仅生成该表的 insertRow/updateRow 指令，严禁生成其他表格内容。`;
                console.log(`🎯 [单表模式] 最终提醒已追加到指令末尾`);
            }

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

                // ✅ [防递归爆炸] 限制最大重试次数为 3 次
                if (retryCount >= 3) {
                    console.warn(`⚠️ [重试限制] 已达到最大重试次数 (3 次)，停止重试`);
                    if (typeof toastr !== 'undefined') toastr.error('已达到最大重试次数，请检查网络或 API 配置', '重试失败');
                    return { success: false, reason: 'max_retry_reached' };
                }

                const customRetryAlert = window.customRetryAlert || window.Gaigai.customAlert;
                const errorMsg = `批量填表失败：${e.message}\n\n是否重新尝试？(剩余 ${3 - retryCount} 次)`;
                const shouldRetry = await customRetryAlert(errorMsg, '⚠️ 生成异常');
                if (shouldRetry) return this.handleChatBackfill(start, end, isManual, targetIndex, customNote, retryCount + 1, isOverwrite);
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
                            // ✅✅✅ [重构模式] 静默模式下的事务性安全清空
                            if (isOverwrite && targetIndex >= 0 && targetIndex <= 7) {
                                const targetSheet = m.s[targetIndex];
                                if (targetSheet) {
                                    const oldRowCount = targetSheet.r.length;
                                    console.log(`🔥 [重构模式-静默] 开始清空表${targetIndex}，原有 ${oldRowCount} 行数据`);
                                    targetSheet.clear();
                                    console.log(`✅ [重构模式-静默] 表${targetIndex} 已清空，准备写入 ${cs.length} 条新指令`);
                                }
                            }

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

                            const regenParams = { start, end, isManual, targetIndex, customNote, isOverwrite };
                            const userAction = await this.showBackfillEditPopup(finalOutput, end, regenParams);
                            if (!userAction.success) return { success: false, reason: 'fallback_to_manual' };
                            return { success: true };
                        }
                    } else {
                        const regenParams = { start, end, isManual, targetIndex, customNote, isOverwrite };
                        const userAction = await this.showBackfillEditPopup(finalOutput, end, regenParams);
                        return userAction;
                    }
                }
                return { success: false, reason: 'no_output' };
            } else if (result) {
                // ✅ [防递归爆炸] 限制最大重试次数为 3 次
                if (retryCount >= 3) {
                    console.warn(`⚠️ [重试限制] 已达到最大重试次数 (3 次)，停止重试`);
                    if (typeof toastr !== 'undefined') toastr.error('已达到最大重试次数，请检查 API 配置或提示词', '重试失败');
                    return { success: false, reason: 'max_retry_reached' };
                }

                const customRetryAlert = window.customRetryAlert || window.Gaigai.customAlert;
                const errorMsg = `批量填表失败：${result.error || '未知错误'}\n\n是否重新尝试？(剩余 ${3 - retryCount} 次)`;
                const shouldRetry = await customRetryAlert(errorMsg, '⚠️ AI 生成失败');
                if (shouldRetry) return this.handleChatBackfill(start, end, isManual, targetIndex, customNote, retryCount + 1, isOverwrite);
                return { success: false, reason: 'api_failed' };
            }
        }

        /**
         * 处理基于现有表格优化模式（使用 <Memory> 标签和脚本指令）
         * @private
         * @param {number} startRow - 起始行索引（0-based）
         * @param {number} endRow - 结束行索引（不包含，类似 slice）
         * @param {boolean} isManual - 是否手动模式
         * @param {number} targetIndex - 目标表格索引（必须指定单个表格，不支持 -1）
         * @param {string} customNote - 用户自定义建议
         * @param {number} retryCount - 当前重试次数（防止递归爆炸）
         */
        async handleTableOptimization(startRow, endRow, isManual = false, targetIndex = -1, customNote = '', retryCount = 0) {
            const ctx = window.SillyTavern.getContext();
            const m = window.Gaigai.m;
            const API_CONFIG = window.Gaigai.config;
            const C = window.Gaigai.config_obj;

            // 🛑 验证：表格优化模式必须指定单个表格
            if (targetIndex === -1 || targetIndex < 0 || targetIndex > 7) {
                await window.Gaigai.customAlert('⚠️ 表格优化模式必须选择单个表格！', '错误');
                return { success: false, reason: 'invalid_target' };
            }

            const sheet = m.s[targetIndex];
            if (!sheet || sheet.r.length === 0) {
                await window.Gaigai.customAlert('⚠️ 目标表格为空，无法优化！', '提示');
                return { success: false, reason: 'empty_table' };
            }

            // ✅ 智能修正行范围 (全表优化模式强制修正)
            if (startRow < 0 || startRow >= sheet.r.length) startRow = 0;
            if (endRow <= startRow || endRow > sheet.r.length) endRow = sheet.r.length;

            // 二次确认：如果修正后还是空的（比如表本来就是空的），拦截
            if (endRow <= startRow) {
                // 通常不会走到这里，因为前面 showUI 已经拦截了空表
                console.warn('⚠️ 表格为空，无需优化');
                return { success: true }; 
            }

            console.log(`📊 [表格优化] 目标: 表${targetIndex}，行范围: ${startRow}-${endRow} (全表优化)`);

            // 构建 Prompt
            const messages = [];

            // 1. System Prompt (NSFW)
            messages.push({
                role: 'system',
                content: window.Gaigai.PromptManager.resolveVariables(
                    window.Gaigai.PromptManager.get('nsfwPrompt'),
                    ctx
                )
            });

            // 2. 背景资料（可选）
            let contextText = '';
            let userName = ctx.name1 || 'User';
            let charName = 'Character';
            if (ctx.characterId !== undefined && ctx.characters && ctx.characters[ctx.characterId]) {
                charName = ctx.characters[ctx.characterId].name || ctx.name2 || 'Character';
                const char = ctx.characters[ctx.characterId];
                if (char.description) contextText += `[人物简介]\n${char.description}\n`;
                if (char.personality) contextText += `[性格/设定]\n${char.personality}\n`;
            }
            if (contextText) {
                messages.push({
                    role: 'system',
                    content: `【背景资料】\n角色: ${charName}\n用户: ${userName}\n\n${contextText}`
                });
            }

            // 3. 表格数据（使用 sheet.txt() 而不是 JSON）
            const sheetName = targetIndex === 1 ? '支线追踪' : sheet.n;
            const tableContent = sheet.txt(targetIndex);
            messages.push({
                role: 'system',
                content: `【当前的表格内容 - ${sheetName}】\n这是当前需要优化的表格内容：\n\n${tableContent}`
            });

            // 4. 用户自定义建议
            if (customNote && customNote.trim()) {
                messages.push({
                    role: 'system',
                    content: `💬 【用户重点建议】\n${customNote.trim()}\n\n请优先遵循以上建议进行优化。`
                });
            }

            // 5. 核心指令（使用 <Memory> 标签和 insertRow 指令）
            let optimizePrompt = window.Gaigai.PromptManager.get('tableOptimizePrompt');
            if (!optimizePrompt || !optimizePrompt.trim()) {
                // 如果提示词不存在，使用默认指令
                optimizePrompt = `你现在需要对上述表格内容进行优化（合并、精简、润色）。
请直接输出优化后的结果，使用标准 <Memory> 标签包裹 insertRow 指令。

**注意**：
1. 你只需要输出**最终应该保留的内容**。
2. 系统在执行时，会先**清空**该表格的旧数据，然后填入你输出的新内容。
3. 因此，请完整输出优化后的所有行，不要遗漏。
4. 使用 insertRow(${targetIndex}, {0:"列0内容", 1:"列1内容", ...}) 的格式。
5. 表格索引为 ${targetIndex}，请确保所有指令都使用这个索引。`;
            }
            optimizePrompt = window.Gaigai.PromptManager.resolveVariables(optimizePrompt, ctx);

            messages.push({ role: 'user', content: optimizePrompt });

            // 调用 API
            window.Gaigai.lastRequestData = {
                chat: JSON.parse(JSON.stringify(messages)),
                timestamp: Date.now(),
                model: API_CONFIG.useIndependentAPI ? API_CONFIG.model : 'Tavern(Direct)'
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
            } catch (e) {
                console.error('❌ [表格优化] API 请求失败', e);

                // ✅ [防递归爆炸] 限制最大重试次数为 3 次
                if (retryCount >= 3) {
                    console.warn(`⚠️ [重试限制] 已达到最大重试次数 (3 次)，停止重试`);
                    if (typeof toastr !== 'undefined') toastr.error('已达到最大重试次数，请检查网络或 API 配置', '重试失败');
                    return { success: false, reason: 'max_retry_reached' };
                }

                const customRetryAlert = window.customRetryAlert || window.Gaigai.customAlert;
                const errorMsg = `表格优化失败：${e.message}\n\n是否重新尝试？(剩余 ${3 - retryCount} 次)`;
                const shouldRetry = await customRetryAlert(errorMsg, '⚠️ 生成异常');
                if (shouldRetry) return this.handleTableOptimization(startRow, endRow, isManual, targetIndex, customNote, retryCount + 1);
                return { success: false, reason: 'api_error' };
            } finally {
                window.isSummarizing = false;
            }

            if (result && result.success) {
                const unesc = window.Gaigai.esc ? window.unesc || ((s) => s) : ((s) => s);
                let aiOutput = unesc(result.summary || result.text || '').trim();

                // 移除思考过程
                if (aiOutput.includes('<think>')) {
                    aiOutput = aiOutput.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                }

                // ✨ 提取 <Memory> 标签内容（复用 autoRunBackfill 的逻辑）
                const tagMatch = aiOutput.match(/<Memory>([\s\S]*?)<\/Memory>/i);
                let finalOutput = '';

                if (tagMatch) {
                    finalOutput = tagMatch[0];
                } else {
                    // 如果没有标签，尝试自动包裹
                    let cleanContent = aiOutput
                        .replace(/<\/?Memory>/gi, '')  // 去除可能存在的残缺标签
                        .replace(/<!--/g, '')          // 去除 HTML 注释头
                        .replace(/-->/g, '')           // 去除 HTML 注释尾
                        .replace(/```[a-z]*\n?/gi, '') // 去除 Markdown 代码块头
                        .replace(/```/g, '')           // 去除 Markdown 代码块尾
                        .trim();

                    // 去除 AI 的客套话
                    cleanContent = cleanContent
                        .replace(/^(好的|明白|收到|了解|理解|根据|分析|总结|以下是)[^<\n]*\n*/gim, '')
                        .replace(/^.*?(根据|基于|查看|阅读|分析).*?([，,：:]|之后)[^\n]*\n*/gim, '')
                        .trim();

                    // 重新包裹
                    if (cleanContent.includes('insertRow') || cleanContent.includes('updateRow')) {
                        finalOutput = `<Memory><!-- ${cleanContent} --></Memory>`;
                    } else {
                        finalOutput = cleanContent; // 实在没识别到指令，原样返回方便用户修改
                    }
                }

                if (!finalOutput) {
                    await window.Gaigai.customAlert('⚠️ AI 返回的内容为空！', '解析失败');
                    return { success: false, reason: 'empty_output' };
                }

                // ✨ 解析指令（使用 prs 解析器）
                const prs = window.prs;
                const exe = window.exe;

                // 先剥离标签和注释，提取纯指令文本
                let innerText = finalOutput
                    .replace(/<\/?Memory>/gi, '') // 移除 <Memory> 标签
                    .replace(/<!--/g, '')         // 移除 HTML 注释头
                    .replace(/-->/g, '')          // 移除 HTML 注释尾
                    .trim();

                const cs = prs(innerText);

                if (cs.length === 0) {
                    await window.Gaigai.customAlert('⚠️ 未识别到有效的表格指令！', '解析失败');
                    return { success: false, reason: 'no_commands' };
                }

                console.log(`✅ [表格优化] 成功解析 ${cs.length} 条指令`);

                // 🔒 安全检查：验证所有指令的表索引是否正确
                let hasInvalidIndex = false;
                for (let i = 0; i < cs.length; i++) {
                    const cmd = cs[i];
                    if (cmd && typeof cmd.ti === 'number') {
                        if (cmd.ti !== targetIndex) {
                            console.error(`🛑 [表索引不匹配] 指令 ${i} 的表索引 ${cmd.ti} 不匹配目标表索引 ${targetIndex}`);
                            hasInvalidIndex = true;
                            break;
                        }
                    }
                }

                if (hasInvalidIndex) {
                    await window.Gaigai.customAlert(`🛑 安全拦截：检测到表索引不匹配，已取消操作\n\n请确保 AI 输出的所有指令都使用表索引 ${targetIndex}`, '错误');
                    return { success: false, reason: 'invalid_table_index' };
                }

                // ✨ 弹出确认框（如果不是静默模式）
                const isSilentMode = isManual ? ($('#bf-silent-mode').length > 0 && $('#bf-silent-mode').is(':checked')) : C.autoBackfillSilent;

                if (isSilentMode) {
                    // 静默模式：直接执行
                    await this._applyTableOptimization(targetIndex, cs, m);
                    return { success: true };
                } else {
                    // 非静默模式：弹窗确认
                    const regenParams = { startRow, endRow, isManual, targetIndex, customNote };
                    const userAction = await this._showTableOptimizationConfirm(finalOutput, targetIndex, cs, regenParams, m);
                    return userAction;
                }

            } else if (result) {
                // ✅ [防递归爆炸] 限制最大重试次数为 3 次
                if (retryCount >= 3) {
                    console.warn(`⚠️ [重试限制] 已达到最大重试次数 (3 次)，停止重试`);
                    if (typeof toastr !== 'undefined') toastr.error('已达到最大重试次数，请检查 API 配置或提示词', '重试失败');
                    return { success: false, reason: 'max_retry_reached' };
                }

                const customRetryAlert = window.customRetryAlert || window.Gaigai.customAlert;
                const errorMsg = `表格优化失败：${result.error || '未知错误'}\n\n是否重新尝试？(剩余 ${3 - retryCount} 次)`;
                const shouldRetry = await customRetryAlert(errorMsg, '⚠️ AI 生成失败');
                if (shouldRetry) return this.handleTableOptimization(startRow, endRow, isManual, targetIndex, customNote, retryCount + 1);
                return { success: false, reason: 'api_failed' };
            }
        }

        /**
         * 应用表格优化（先清空，后插入）
         * @private
         */
        async _applyTableOptimization(targetIndex, commands, m) {
            // 🔒 安全检查1：验证会话ID
            const initialSessionId = m.gid();
            if (!initialSessionId) {
                console.error('🛑 [安全拦截] 无法获取会话标识');
                return;
            }

            // 🔒 安全检查2：验证表索引
            if (targetIndex < 0 || targetIndex > 7 || !m.s[targetIndex]) {
                console.error(`🛑 [安全拦截] 表索引 ${targetIndex} 无效`);
                return;
            }

            const sheet = m.s[targetIndex];

            // 🔒 安全检查3：执行前再次验证会话ID
            const currentSessionId = m.gid();
            if (currentSessionId !== initialSessionId) {
                console.error(`🛑 [安全拦截] 会话ID不一致！初始: ${initialSessionId}, 当前: ${currentSessionId}`);
                return;
            }

            console.log(`🗑️ [表格优化] 清空表${targetIndex} (共 ${sheet.r.length} 行)`);

            // 1. 清空表格
            sheet.clear();

            // 2. 执行指令
            const exe = window.exe;
            exe(commands);

            console.log(`✅ [表格优化] 已写入 ${commands.length} 条指令到表${targetIndex}`);

            // 3. 保存
            window.lastManualEditTime = Date.now();
            m.save();
            const updateCurrentSnapshot = window.updateCurrentSnapshot || (() => {});
            updateCurrentSnapshot();

            if (typeof toastr !== 'undefined') {
                toastr.success(`表格优化完成！已执行 ${commands.length} 条指令`, '表格优化', { timeOut: 2000 });
            }

            // 4. 刷新UI
            if ($('#g-pop').length > 0) {
                const refreshTable = window.refreshTable || (() => {});
                const updateTabCount = window.updateTabCount || (() => {});
                refreshTable(targetIndex);
                m.s.forEach((_, i) => updateTabCount(i));
            }
        }

        /**
         * 显示表格优化确认弹窗
         * @private
         */
        _showTableOptimizationConfirm(content, targetIndex, commands, regenParams, m) {
            const self = this;
            const UI = window.Gaigai.ui;
            const esc = window.Gaigai.esc;

            // 🔒 关键修复：记录弹窗打开时的会话ID
            const initialSessionId = m.gid();
            if (!initialSessionId) {
                window.Gaigai.customAlert('🛑 安全拦截：无法获取会话标识', '错误');
                return Promise.resolve({ success: false });
            }
            console.log(`🔒 [表格优化弹窗打开] 会话ID: ${initialSessionId}`);

            return new Promise((resolve) => {
                const sheetName = targetIndex === 1 ? '支线追踪' : m.s[targetIndex].n;
                const h = `
                <div class="g-p">
                    <h4>📊 表格优化确认</h4>
                    <p style="opacity:0.8; font-size:11px; margin-bottom:10px;">
                        ✅ AI 已生成优化指令，请检查。<br>
                        💡 点击 <strong>[确认]</strong> 将先清空表${targetIndex} (${sheetName})，然后写入优化后的内容。<br>
                        ⚠️ 原始数据将被完全替换，请谨慎操作！
                    </p>
                    <textarea id="opt-popup-editor" style="width:100%; height:350px; padding:10px; border-radius:4px; font-size:12px; font-family:inherit; resize:vertical; line-height:1.6;">${esc(content)}</textarea>
                    <div style="margin-top:12px; display: flex; gap: 10px;">
                        <button id="opt-popup-cancel" style="padding:8px 16px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🚫 放弃</button>
                        ${regenParams ? '<button id="opt-popup-regen" style="padding:8px 16px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🔄 重新生成</button>' : ''}
                        <button id="opt-popup-confirm" style="padding:8px 16px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 2; font-weight:bold;">🚀 确认并执行</button>
                    </div>
                </div>
                `;

                $('#g-table-opt-pop').remove();
                const $o = $('<div>', { id: 'g-table-opt-pop', class: 'g-ov', css: { 'z-index': '10000007' } });
                const $p = $('<div>', { class: 'g-w', css: { width: '700px', maxWidth: '92vw', height: 'auto' } });

                const $hd = $('<div>', { class: 'g-hd' });
                $hd.append(`<h3 style="color:${UI.tc}; flex:1;">📊 表格优化</h3>`);

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
                    // 🚫 放弃按钮
                    $('#opt-popup-cancel').on('click', () => {
                        $o.remove();
                        resolve({ success: false });
                    });

                    // 🔄 重新生成按钮
                    if (regenParams) {
                        $('#opt-popup-regen').on('click', async function () {
                            const $btn = $(this);
                            const originalText = $btn.text();

                            $('#opt-popup-cancel, #opt-popup-regen, #opt-popup-confirm').prop('disabled', true);
                            $btn.text('生成中...');

                            try {
                                console.log('🔄 [重新生成] 正在重新调用 handleTableOptimization...');
                                const result = await self.handleTableOptimization(
                                    regenParams.startRow,
                                    regenParams.endRow,
                                    regenParams.isManual,
                                    regenParams.targetIndex,
                                    regenParams.customNote
                                );

                                // 因为重新调用会打开新弹窗，这里直接关闭当前弹窗
                                $o.remove();
                                resolve(result);
                            } catch (error) {
                                console.error('❌ [重新生成失败]', error);
                                await window.Gaigai.customAlert('重新生成失败: ' + error.message, '错误');
                                $('#opt-popup-cancel, #opt-popup-regen, #opt-popup-confirm').prop('disabled', false);
                                $btn.text(originalText);
                            }
                        });
                    }

                    // 🚀 确认并执行按钮
                    $('#opt-popup-confirm').on('click', async function () {
                        const finalContent = $('#opt-popup-editor').val().trim();
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
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作\n\n请重新打开表格优化功能', '错误');
                            return;
                        }

                        // 重新解析用户可能修改过的内容
                        const prs = window.prs;
                        let innerText = finalContent
                            .replace(/<\/?Memory>/gi, '')
                            .replace(/<!--/g, '')
                            .replace(/-->/g, '')
                            .trim();

                        const newCs = prs(innerText);

                        if (newCs.length === 0) {
                            await window.Gaigai.customAlert('⚠️ 未识别到有效的表格指令！', '解析失败');
                            return;
                        }

                        // 🔒 安全检查2：验证指令的表索引
                        for (let i = 0; i < newCs.length; i++) {
                            const cmd = newCs[i];
                            if (cmd && typeof cmd.ti === 'number' && cmd.ti !== targetIndex) {
                                await window.Gaigai.customAlert(`🛑 安全拦截：指令 ${i} 的表索引 ${cmd.ti} 不匹配目标表索引 ${targetIndex}`, '错误');
                                return;
                            }
                        }

                        console.log(`🔒 [安全验证通过] 会话ID: ${currentSessionId}, 指令数: ${newCs.length}`);

                        // 执行优化
                        await self._applyTableOptimization(targetIndex, newCs, m);

                        // 关闭弹窗
                        $o.remove();

                        resolve({ success: true });
                    });
                }, 100);
            });
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

                // ✨ 修复：显式指定文字颜色，防止被酒馆默认样式覆盖导致看不清
            const h = `
            <div class="g-p" style="display: flex; flex-direction: column; height: 100%;">
                <h4 style="margin: 0 0 8px 0; color: ${UI.tc};">⚡ 剧情追溯确认${progressText}</h4>
                <p style="opacity:0.8; font-size:11px; margin: 0 0 10px 0; color: ${UI.tc};">
                    ✅ AI 已生成指令，请检查。<br>
                    💡 点击 <strong>[确认]</strong> 将写入数据并继续，点击 <strong>[放弃]</strong> 将终止后续任务。
                </p>
                <textarea id="bf-popup-editor" style="width:100%; height:350px; padding:10px; border-radius:4px; font-size:12px; font-family:inherit; resize:vertical; line-height:1.6; color: ${UI.tc}; background: transparent;">${esc(content)}</textarea>
                <div style="margin-top:12px; display: flex; gap: 10px; flex-shrink: 0;">
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
                                    regenParams.customNote || '',
                                    'chat',
                                    regenParams.isOverwrite || false
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

                        // ✅✅✅ [重构模式] 事务性安全清空：只在解析成功、用户确认后才清空
                        if (regenParams && regenParams.isOverwrite && regenParams.targetIndex >= 0 && regenParams.targetIndex <= 7) {
                            const targetSheet = m.s[regenParams.targetIndex];
                            if (targetSheet) {
                                const oldRowCount = targetSheet.r.length;
                                console.log(`🔥 [重构模式] 开始清空表${regenParams.targetIndex}，原有 ${oldRowCount} 行数据`);
                                targetSheet.clear();
                                console.log(`✅ [重构模式] 表${regenParams.targetIndex} 已清空，准备写入 ${cs.length} 条新指令`);
                            }
                        }

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
            // ❌ 追溯模式不需要发送总结内容
            // if (m.sm.has()) {
            //     const summaryArray = m.sm.loadArray();
            //     summaryArray.slice(-15).forEach((item) => {
            //         messages.splice(insertIndex, 0, { role: 'system', content: `【前情提要 - ${item.type || '历史'}】\n${item.content}` });
            //         insertIndex++;
            //     });
            // } else {
            //     messages.splice(insertIndex, 0, { role: 'system', content: '【前情提要】\n（暂无历史总结）' });
            //     insertIndex++;
            // }

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
            let finalInstruction = window.Gaigai.PromptManager.resolveVariables(rulesContent, ctx);

            // 🎯 [关键修复] 单表模式指令直接拼接到 finalInstruction 后面（重新生成时也保持一致）
            if (targetIndex >= 0 && targetIndex < 8 && m.s[targetIndex]) {
                const sheet = m.s[targetIndex];
                const sheetName = targetIndex === 1 ? '支线追踪' : sheet.n;
                finalInstruction += `\n\n🎯 【单表追溯模式 - 最终提醒】\n本次追溯只关注【表${targetIndex} - ${sheetName}】，请仅生成该表的 insertRow/updateRow 指令，严禁生成其他表格内容。`;
            }

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
