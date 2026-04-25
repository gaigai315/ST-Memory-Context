/**
 * ⚡ Gaigai记忆插件 - 总结控制台模块
 *
 * 功能：AI总结相关的所有逻辑（表格总结、聊天总结、自动总结触发器、总结优化）
 * 支持：快照总结、分批总结、总结优化/润色
 *
 * @version 2.2.2
 * @author Gaigai Team
 */

(function() {
    'use strict';

    // 【全局单例】总结控制台表格选择按钮监听器（防止重复绑定）
    (function() {
        if (window._gg_sum_table_selector_bound) return;
        window._gg_sum_table_selector_bound = true;

        let isOpening = false; // 防抖标志
        let lastClickTime = 0; // 记录上次点击时间

        // 暴露到全局，供内联事件调用
        window._gg_openSumTableSelector = function(event) {
            // ✅ 修复1: 阻止事件冒泡和默认行为
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            // ✅ 修复2: 时间防抖(300ms内的重复点击直接忽略)
            const now = Date.now();
            if (now - lastClickTime < 300) {
                console.log('⚠️ [总结控制台-表格选择] 时间防抖拦截: 300ms内重复点击');
                return;
            }
            lastClickTime = now;

            // 防抖：如果正在打开，直接返回
            if (isOpening) {
                console.log('⚠️ [总结控制台-表格选择] 防抖拦截：弹窗正在打开中');
                return;
            }
            isOpening = true;

            try {
                const m = window.Gaigai.m;
                const C = window.Gaigai.config_obj;

                console.log('✅ [总结控制台-表格选择] 按钮被点击');

                const dataTables = m.s.slice(0, -1);

                // 🔥 关键修复：强制挂载到 body，避免被父容器的 transform/filter 影响
                const overlay = $('<div>').attr('id', 'gg-sum-table-selector-overlay');

                // ✅ 使用原生 DOM API 直接挂载到 body（不走 jQuery），确保最高层级
                document.body.appendChild(overlay[0]);

                // 🔥 使用 setAttribute 添加内联样式，!important 强制覆盖所有样式
                overlay[0].setAttribute('style', `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: rgba(0,0,0,0.5) !important;
                    z-index: 2147483647 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    overflow-y: auto !important;
                    padding: 10px !important;
                    margin: 0 !important;
                    border: none !important;
                    transform: none !important;
                `.replace(/\s+/g, ' ').trim());

                const modal = $('<div>').addClass('gg-custom-modal');
                let checkboxesHtml = '';
                const savedSelection = C.manualSummaryTargetTables;

                dataTables.forEach((sheet, i) => {
                    const rowCount = sheet.r ? sheet.r.length : 0;
                    const tableName = sheet.n || `表${i}`;
                    const isChecked = (savedSelection === null || savedSelection === undefined) ? true : savedSelection.includes(i);
                    const checkedAttr = isChecked ? 'checked' : '';

                    checkboxesHtml += `
                        <div class="gg-choice-card" title="${tableName}">
                            <input type="checkbox" class="gg_sum_table_checkbox_modal" data-table-index="${i}" ${checkedAttr}>
                            <span class="gg-choice-name">${tableName}</span>
                            <span class="gg-choice-badge" style="opacity: 0.7;">${rowCount}行</span>
                        </div>
                    `;
                });

                const modalContent = `
                    <span id="gg_sum_modal_close_btn" style="position: absolute; right: 20px; top: 20px; cursor: pointer; font-size: 24px; line-height: 1; opacity: 0.7;">&times;</span>
                    <h3 style="margin: 0 0 15px 0;">🎯 选择表格</h3>
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                            <button type="button" id="gg_sum_modal_select_all" style="flex: 1; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">全选</button>
                            <button type="button" id="gg_sum_modal_deselect_all" style="flex: 1; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">全不选</button>
                        </div>
                        <div class="gg-choice-grid" style="max-height: min(400px, 50vh); overflow-y: auto;">
                            ${checkboxesHtml}
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="gg_sum_modal_cancel" style="flex: 1; padding: 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">取消</button>
                        <button type="button" id="gg_sum_modal_save" style="flex: 1; padding: 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">确定保存</button>
                    </div>
                `;

                modal.html(modalContent);
                overlay.append(modal);

                setTimeout(() => {
                    $('#gg_sum_modal_close_btn').on('click', function () {
                        overlay.remove();
                        $(document).off('keydown.gg_sum_modal');
                        $(document).off('click.gg_sum_card');
                        isOpening = false;
                    });

                    $('#gg_sum_modal_select_all').on('click', function () {
                        $('.gg_sum_table_checkbox_modal').prop('checked', true);
                    });

                    $('#gg_sum_modal_deselect_all').on('click', function () {
                        $('.gg_sum_table_checkbox_modal').prop('checked', false);
                    });

                    $('#gg_sum_modal_cancel').on('click', function () {
                        overlay.remove();
                        $(document).off('keydown.gg_sum_modal');
                        $(document).off('click.gg_sum_card');
                        isOpening = false;
                    });

                    overlay.on('click', function (e) {
                        if (e.target === overlay[0]) {
                            overlay.remove();
                            $(document).off('keydown.gg_sum_modal');
                            $(document).off('click.gg_sum_card');
                            isOpening = false;
                        }
                    });

                    $(document).on('keydown.gg_sum_modal', function (e) {
                        if (e.key === 'Escape') {
                            overlay.remove();
                            $(document).off('keydown.gg_sum_modal');
                            $(document).off('click.gg_sum_card');
                            isOpening = false;
                        }
                    });

                    $(document).off('click.gg_sum_card').on('click.gg_sum_card', '.gg-choice-card', function(e) {
                        // ✅ Fix: If the input itself is clicked, let the browser handle it natively
                        if ($(e.target).is('input')) return;

                        e.preventDefault();
                        e.stopPropagation();
                        const $cb = $(this).find('input');
                        $cb.prop('checked', !$cb.prop('checked'));
                    });

                    $('#gg_sum_modal_save').on('click', function () {
                        const selectedIndices = [];
                        $('.gg_sum_table_checkbox_modal').each(function() {
                            const tableIndex = $(this).data('table-index');
                            const isChecked = $(this).is(':checked');
                            $(`.gg_table_checkbox[data-table-index="${tableIndex}"]`).prop('checked', isChecked);
                            if (isChecked) {
                                selectedIndices.push(tableIndex);
                            }
                        });

                        C.manualSummaryTargetTables = selectedIndices;
                        console.log(`💾 [手动总结-表格选择] 已保存选择: ${selectedIndices.join(', ')}`);

                        window.Gaigai.m.save(false, true); // 配置更改立即保存
                        console.log(`💾 [手动总结-表格选择] 已持久化到聊天存档`);

                        const selectedCount = selectedIndices.length;
                        $('#gg_sum_table_selector_text').text(`🎯 已选择 ${selectedCount} 个表格 (点击修改)`);

                        if (typeof toastr !== 'undefined') {
                            toastr.success(`已选择 ${selectedCount} 个表格`, '保存成功', { timeOut: 2000 });
                        }

                        overlay.remove();
                        $(document).off('keydown.gg_sum_modal');
                        $(document).off('click.gg_sum_card');
                        isOpening = false;
                    });
                }, 100);
            } catch (error) {
                alert("执行报错: " + error.message);
                console.error("❌ [总结控制台-表格选择按钮] 错误详情:", error);
            }
        };
    })();

    // ✅ 辅助函数：检测哪些楼层已经被隐藏（基于数据检测，而非 DOM）
    function getHiddenMessageIndices() {
        const hiddenIndices = new Set();

        // 🔥 修复：使用数据检测而非 DOM 检测
        // SillyTavern 隐藏消息后会设置 is_system = true
        const m = window.Gaigai.m;
        const ctx = m.ctx();

        if (!ctx || !ctx.chat) {
            console.log(`🔍 [数据检测] 无法获取聊天数据`);
            return hiddenIndices;
        }

        // 遍历聊天记录，检查 is_system 标记
        for (let i = 0; i < ctx.chat.length; i++) {
            const msg = ctx.chat[i];
            // is_system === true 表示该消息已被隐藏
            if (msg && msg.is_system === true) {
                hiddenIndices.add(i);
            }
        }

        console.log(`🔍 [数据检测] 发现 ${hiddenIndices.size} 个已隐藏的消息 (is_system=true)`);
        if (hiddenIndices.size > 0 && hiddenIndices.size <= 20) {
            console.log(`   已隐藏索引: ${Array.from(hiddenIndices).join(', ')}`);
        }

        return hiddenIndices;
    }

    // ✅ 辅助函数：将需要隐藏的索引列表转换为 /hide 命令
    function buildHideCommands(indicesToHide) {
        if (indicesToHide.length === 0) return [];

        // 排序索引
        indicesToHide.sort((a, b) => a - b);

        // 合并连续的索引为范围
        const ranges = [];
        let rangeStart = indicesToHide[0];
        let rangeEnd = indicesToHide[0];

        for (let i = 1; i < indicesToHide.length; i++) {
            if (indicesToHide[i] === rangeEnd + 1) {
                // 连续，扩展范围
                rangeEnd = indicesToHide[i];
            } else {
                // 不连续，保存当前范围，开始新范围
                ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
                rangeStart = indicesToHide[i];
                rangeEnd = indicesToHide[i];
            }
        }

        // 保存最后一个范围
        ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

        // 构建命令列表
        return ranges.map(range => `/hide ${range}`);
    }

    // ✅ 新版本：无感隐藏函数（直接修改数据+DOM，无界面跳动）
    async function silentHideMessages(messageIndices, logPrefix = '隐藏') {
        if (messageIndices.length === 0) return;

        console.log(`📝 [${logPrefix}] 准备无感隐藏 ${messageIndices.length} 条消息`);

        const ctx = window.SillyTavern.getContext();
        if (!ctx || !ctx.chat) {
            console.warn(`❌ [${logPrefix}] 无法获取聊天上下文`);
            return;
        }

        let successCount = 0;

        for (const index of messageIndices) {
            // 1. 修改数据
            if (ctx.chat[index]) {
                ctx.chat[index].is_system = true;

                // 2. 更新DOM（如果消息在界面上）
                const $mesDiv = $(`#chat .mes[mesid="${index}"]`);
                if ($mesDiv.length > 0) {
                    // 关键：修改DOM的is_system属性，CSS会自动显示幽灵图标
                    $mesDiv.attr('is_system', 'true');

                    console.log(`  ✓ [${logPrefix}] 已隐藏索引 ${index}`);
                    successCount++;
                } else {
                    console.log(`  ⚠️ [${logPrefix}] 索引 ${index} 的DOM未找到（可能在屏幕外）`);
                    successCount++; // 数据已修改，算成功
                }
            }
        }

        // 3. 保存到硬盘
        try {
            await ctx.saveChat();
            console.log(`💾 [${logPrefix}] 已保存 ${successCount}/${messageIndices.length} 条隐藏记录`);
        } catch (e) {
            console.error(`❌ [${logPrefix}] 保存失败:`, e);
        }

        console.log(`✅ [${logPrefix}] 无感隐藏完成（无界面跳动）`);
    }

    // ✅ Native Hiding: 已总结隐藏（智能触发版）
    async function applyNativeHiding() {
        // 1. Check Config
        const C = window.Gaigai.config_obj;
        // 🔴 全局主开关守卫
        if (!C.masterSwitch) return;
        if (!C.autoSummaryHideContext) return;

        const m = window.Gaigai.m;
        const ctx = m.ctx();
        if (!ctx || !ctx.chat || ctx.chat.length === 0) return;

        const summaryPointer = window.Gaigai.config.lastSummaryIndex || 0;
        if (summaryPointer <= 0) return;

        // 2. 读取延迟配置（跟随自动总结的延迟设置）
        const delayFloors = C.autoSummaryDelay ? (parseInt(C.autoSummaryDelayCount) || 0) : 0;

        // 3. 计算当前楼层数（只计算对话消息）
        let currentFloor = 0;
        for (let i = 0; i < ctx.chat.length; i++) {
            const msg = ctx.chat[i];
            if (msg.role === 'system' || msg.isGaigaiPrompt || msg.isGaigaiData) continue;
            currentFloor++;
        }

        console.log(`🔍 [已总结隐藏] 总结指针: ${summaryPointer}, 当前楼层: ${currentFloor}, 延迟: ${delayFloors}层`);

        // 4. 检查是否需要触发隐藏（当前楼层必须 >= 总结指针 + 延迟楼层）
        if (currentFloor < summaryPointer + delayFloors) {
            console.log(`⏸️ [已总结隐藏] 当前楼层 ${currentFloor} < 总结指针+延迟 (${summaryPointer + delayFloors})，暂不触发`);
            return;
        }

        // 5. 应该隐藏的范围：0 到 summaryPointer-1
        const rangeEnd = summaryPointer - 1;
        if (rangeEnd < 0) return; // 无需隐藏

        // 6. 获取已隐藏的楼层
        const alreadyHidden = getHiddenMessageIndices();

        // 7. 找到"上次隐藏边界"（在目标范围内，从后往前找到索引最大的已隐藏楼层）
        let lastHiddenBoundary = -1;
        for (let i = rangeEnd; i >= 0; i--) {
            if (alreadyHidden.has(i)) {
                lastHiddenBoundary = i;
                break;
            }
        }

        console.log(`🔍 [已总结隐藏] 应该隐藏到: ${rangeEnd}, 上次连续隐藏边界: ${lastHiddenBoundary}`);

        // 8. 分离旧区间和新区间
        const shouldHide = [];

        if (lastHiddenBoundary >= 0) {
            // 有旧区间，检查旧区间是否已经50%隐藏
            const oldRangeEnd = lastHiddenBoundary;
            const oldRangeSize = oldRangeEnd + 1;
            let oldRangeHiddenCount = 0;

            for (let i = 0; i <= oldRangeEnd; i++) {
                if (alreadyHidden.has(i)) {
                    oldRangeHiddenCount++;
                }
            }

            const oldRangeRatio = oldRangeHiddenCount / oldRangeSize;
            const oldThreshold = 0.5; // 50% 阈值

            console.log(`📊 [已总结隐藏-旧区间] 0-${oldRangeEnd} (共${oldRangeSize}条): 已隐藏 ${oldRangeHiddenCount} 条 (${(oldRangeRatio * 100).toFixed(1)}%)`);

            if (oldRangeRatio < oldThreshold) {
                // 旧区间未达标，需要补隐藏
                console.log(`⚠️ [已总结隐藏-旧区间] 未达到50%，需要补充隐藏`);
                for (let i = 0; i <= oldRangeEnd; i++) {
                    if (!alreadyHidden.has(i)) {
                        shouldHide.push(i);
                    }
                }
            } else {
                console.log(`✅ [已总结隐藏-旧区间] 已达到50%，跳过旧区间`);
            }

            // 新区间：上次边界+1 到 rangeEnd
            const newRangeStart = lastHiddenBoundary + 1;
            if (newRangeStart <= rangeEnd) {
                const newRangeSize = rangeEnd - newRangeStart + 1;
                console.log(`🆕 [已总结隐藏-新区间] ${newRangeStart}-${rangeEnd} (共${newRangeSize}条) 需要隐藏`);
                for (let i = newRangeStart; i <= rangeEnd; i++) {
                    if (!alreadyHidden.has(i)) {
                        shouldHide.push(i);
                    }
                }
            }
        } else {
            // 没有连续隐藏边界（可能是首次隐藏，或用户手动显示了开头的楼层）
            // 检查整个范围的隐藏情况
            const totalSize = rangeEnd + 1;
            let totalHiddenCount = 0;

            for (let i = 0; i <= rangeEnd; i++) {
                if (alreadyHidden.has(i)) {
                    totalHiddenCount++;
                }
            }

            const totalRatio = totalHiddenCount / totalSize;
            const threshold = 0.5; // 50% 阈值

            console.log(`📊 [已总结隐藏-全范围] 0-${rangeEnd} (共${totalSize}条): 已隐藏 ${totalHiddenCount} 条 (${(totalRatio * 100).toFixed(1)}%)`);

            if (totalRatio >= threshold) {
                // 已经隐藏了一半以上，跳过（尊重用户手动操作）
                console.log(`✅ [已总结隐藏] 已达到50%，跳过隐藏（尊重用户手动操作）`);
                return;
            } else {
                // 未达到50%，需要隐藏
                console.log(`🆕 [已总结隐藏] 未达到50%，执行隐藏 0-${rangeEnd}`);
                for (let i = 0; i <= rangeEnd; i++) {
                    if (!alreadyHidden.has(i)) {
                        shouldHide.push(i);
                    }
                }
            }
        }

        if (shouldHide.length === 0) {
            console.log(`✅ [已总结隐藏] 范围内所有楼层都已隐藏，无需操作`);
            return;
        }

        console.log(`🎯 [已总结隐藏] 需要隐藏 ${shouldHide.length} 个楼层`);

        // 8. 执行无感隐藏
        await silentHideMessages(shouldHide, '已总结隐藏');
    }

    // ✅ 暴露为全局函数，供监控系统调用
    window.Gaigai.applyNativeHiding = applyNativeHiding;

    // ✅ Context Limit Hiding: 留N层隐藏（修复索引映射版）
    async function applyContextLimitHiding() {
        // ⚠️ 已移除配置同步 - 发送前不需要同步，直接读取内存中的配置
        const C = window.Gaigai.config_obj;
        // 🔴 全局主开关守卫
        if (!C.masterSwitch) return;
        const m = window.Gaigai.m;

        // 1. 检查是否启用上下文限制
        if (!C.contextLimit) return;

        const keepFloors = parseInt(C.contextLimitCount) || 30;

        console.log(`🔧 [配置读取] 留${keepFloors}层`);

        // 2. 获取当前聊天记录
        const ctx = m.ctx();
        if (!ctx || !ctx.chat || ctx.chat.length === 0) return;

        // 3. 🔥 修复：建立对话楼层到原始索引的映射
        const dialogueIndexMap = []; // 存储每条对话消息对应的原始索引
        let dialogueCount = 0;

        for (let i = 0; i < ctx.chat.length; i++) {
            const msg = ctx.chat[i];
            // 跳过 system 消息
            if (msg.role === 'system' || msg.isGaigaiPrompt || msg.isGaigaiData) continue;

            dialogueIndexMap.push(i); // 记录第N条对话消息对应的原始索引
            dialogueCount++;
        }

        console.log(`🔍 [留N层隐藏] 当前对话楼层: ${dialogueCount}, 保留: ${keepFloors}`);

        // 4. 如果当前楼层数不足保留数量，不执行
        if (dialogueCount <= keepFloors) {
            console.log(`⏸️ [留N层隐藏] 当前楼层 ${dialogueCount} <= 保留楼层 ${keepFloors}，无需隐藏`);
            return;
        }

        // 5. 🔥 修复：计算需要隐藏到第几条对话消息
        // 保留最后 keepFloors 条对话，所以要隐藏前 (dialogueCount - keepFloors) 条
        const hideDialogueCount = dialogueCount - keepFloors;

        if (hideDialogueCount <= 0) {
            console.log(`⏸️ [留N层隐藏] 需要隐藏的对话数 <= 0，无需隐藏`);
            return;
        }

        // 6. 🔥 修复：找到第 hideDialogueCount 条对话消息对应的原始索引
        const hideRangeEnd = dialogueIndexMap[hideDialogueCount - 1];

        console.log(`📊 [留N层隐藏] 需隐藏前 ${hideDialogueCount} 条对话 → 原始索引 0-${hideRangeEnd} (保留对话 ${hideDialogueCount + 1}-${dialogueCount})`);

        // 7. 获取已隐藏的楼层
        const alreadyHidden = getHiddenMessageIndices();

        // 8. 找到"上次隐藏边界"（在目标范围内，从后往前找到索引最大的已隐藏楼层）
        let lastHiddenBoundary = -1;
        for (let i = hideRangeEnd; i >= 0; i--) {
            if (alreadyHidden.has(i)) {
                lastHiddenBoundary = i;
                break;
            }
        }

        console.log(`🔍 [留N层隐藏] 应该隐藏到: ${hideRangeEnd}, 上次连续隐藏边界: ${lastHiddenBoundary}`);

        // 9. 分离旧区间和新区间
        const shouldHide = [];

        if (lastHiddenBoundary >= 0) {
            // 有旧区间，检查旧区间是否已经90%隐藏
            const oldRangeEnd = lastHiddenBoundary;
            const oldRangeSize = oldRangeEnd + 1;
            let oldRangeHiddenCount = 0;

            for (let i = 0; i <= oldRangeEnd; i++) {
                if (alreadyHidden.has(i)) {
                    oldRangeHiddenCount++;
                }
            }

            const oldRangeRatio = oldRangeHiddenCount / oldRangeSize;
            const oldThreshold = 0.5; // 50% 阈值

            console.log(`📊 [留N层隐藏-旧区间] 0-${oldRangeEnd} (共${oldRangeSize}条): 已隐藏 ${oldRangeHiddenCount} 条 (${(oldRangeRatio * 100).toFixed(1)}%)`);

            if (oldRangeRatio < oldThreshold) {
                // 旧区间未达标，需要补隐藏
                console.log(`⚠️ [留N层隐藏-旧区间] 未达到50%，需要补充隐藏`);
                for (let i = 0; i <= oldRangeEnd; i++) {
                    if (!alreadyHidden.has(i)) {
                        shouldHide.push(i);
                    }
                }
            } else {
                console.log(`✅ [留N层隐藏-旧区间] 已达到50%，跳过旧区间`);
            }

            // 新区间：上次边界+1 到 hideRangeEnd
            const newRangeStart = lastHiddenBoundary + 1;
            if (newRangeStart <= hideRangeEnd) {
                const newRangeSize = hideRangeEnd - newRangeStart + 1;
                console.log(`🆕 [留N层隐藏-新区间] ${newRangeStart}-${hideRangeEnd} (共${newRangeSize}条) 需要隐藏`);
                for (let i = newRangeStart; i <= hideRangeEnd; i++) {
                    if (!alreadyHidden.has(i)) {
                        shouldHide.push(i);
                    }
                }
            }
        } else {
            // 没有连续隐藏边界（可能是首次隐藏，或用户手动显示了开头的楼层）
            // 检查整个范围的隐藏情况
            const totalSize = hideRangeEnd + 1;
            let totalHiddenCount = 0;

            for (let i = 0; i <= hideRangeEnd; i++) {
                if (alreadyHidden.has(i)) {
                    totalHiddenCount++;
                }
            }

            const totalRatio = totalHiddenCount / totalSize;
            const threshold = 0.5; // 50% 阈值

            console.log(`📊 [留N层隐藏-全范围] 0-${hideRangeEnd} (共${totalSize}条): 已隐藏 ${totalHiddenCount} 条 (${(totalRatio * 100).toFixed(1)}%)`);

            if (totalRatio >= threshold) {
                // 已经隐藏了一半以上，跳过（尊重用户手动操作）
                console.log(`✅ [留N层隐藏] 已达到50%，跳过隐藏（尊重用户手动操作）`);
                return;
            } else {
                // 未达到50%，需要隐藏
                console.log(`🆕 [留N层隐藏] 未达到50%，执行隐藏 0-${hideRangeEnd}`);
                for (let i = 0; i <= hideRangeEnd; i++) {
                    if (!alreadyHidden.has(i)) {
                        shouldHide.push(i);
                    }
                }
            }
        }

        if (shouldHide.length === 0) {
            console.log(`✅ [留N层隐藏] 所有需要隐藏的楼层都已隐藏，无需操作`);
            return;
        }

        console.log(`🎯 [留N层隐藏] 本次需要隐藏 ${shouldHide.length} 条消息`);

        // 10. 执行无感隐藏
        await silentHideMessages(shouldHide, '留N层隐藏');
    }

    // ✅ 暴露为全局函数
    window.Gaigai.applyContextLimitHiding = applyContextLimitHiding;

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
            let lastBigSumIndex = API_CONFIG.lastBigSummaryIndex || 0;
            // ✅ 智能修正逻辑：如果指针超出范围，修正到当前最大值（而不是归零）
            if (totalCount > 0 && lastSumIndex > totalCount) {
                lastSumIndex = totalCount;
                console.log(`⚠️ [进度修正] 总结指针超出范围，已修正为 ${totalCount}（原值: ${API_CONFIG.lastSummaryIndex}）`);
            }
            if (totalCount > 0 && lastBigSumIndex > totalCount) {
                lastBigSumIndex = totalCount;
                console.log(`⚠️ [进度修正] 大总结指针超出范围，已修正为 ${totalCount}（原值: ${API_CONFIG.lastBigSummaryIndex}）`);
            }

            // ✅ 读取保存的批次步长
            const savedStep = window.Gaigai.config_obj.batchSummaryStep || 40;

            // ✨ 读取自动总结配置
            const summarySource = API_CONFIG.summarySource || 'chat';
            const sourceText = summarySource === 'table' ? '📊 仅表格' : '💬 聊天历史';

            // 🆕 构建表格选择区域 (卡片样式)
            let tableCheckboxes = '';
            const dataTables = m.s.slice(0, -1); // 排除最后一个总结表
            dataTables.forEach((sheet, i) => {
                const rowCount = sheet.r ? sheet.r.length : 0;
                const tableName = sheet.n || `表${i}`;

                // ✨ 使用新的卡片结构
                tableCheckboxes += `
                    <div class="gg-choice-card" title="${tableName}">
                        <input type="checkbox" class="gg_table_checkbox" data-table-index="${i}" checked>
                        <span class="gg-choice-name">${tableName}</span>
                        <span class="gg-choice-badge">${rowCount}行</span>
                    </div>
                `;
            });

            // 构建UI界面（三个功能区）
            const h = `
        <div class="g-p" style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
            <!-- 📌 当前配置状态显示 -->
            <div style="background: rgba(255,193,7,0.1); border-radius: 6px; padding: 12px; margin-bottom: 12px; border: 1px solid rgba(255,193,7,0.3); flex-shrink: 0; color: ${UI.tc};">
                
                <!-- 模式显示 -->
                <div style="font-size: 12px; font-weight: 600; margin-bottom: 10px; border-bottom: 1px dashed rgba(0,0,0,0.1); padding-bottom: 8px;">
                    ⚙️ 自动总结模式：<span style="font-weight: normal; color: #ff9800;">${sourceText}</span>
                </div>

                <!-- 小总结指针 -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-size: 11px;">
                    <span style="font-weight: bold; white-space: nowrap;">📍 小总结指针:</span>
                    <div style="display: flex; align-items: center; gap: 5px; flex: 1;">
                        <input type="number" id="gg_edit_sum_pointer" value="${lastSumIndex}" min="0" max="${totalCount}" style="width: 100%; min-width: 50px; text-align: center; padding: 4px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); font-size: 11px;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                        <span style="white-space: nowrap;">/ ${totalCount} 层</span>
                    </div>
                    <button id="gg_save_sum_pointer_btn" style="padding: 4px 12px; background: #ff9800; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap; flex-shrink: 0;">修正</button>
                </div>

                <!-- 大总结指针 -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-size: 11px;">
                    <span style="font-weight: bold; white-space: nowrap;">📚 大总结指针:</span>
                    <div style="display: flex; align-items: center; gap: 5px; flex: 1;">
                        <input type="number" id="gg_edit_big_sum_pointer" value="${lastBigSumIndex}" min="0" max="${totalCount}" style="width: 100%; min-width: 50px; text-align: center; padding: 4px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); font-size: 11px;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                        <span style="white-space: nowrap;">/ ${totalCount} 层</span>
                    </div>
                    <button id="gg_save_big_sum_pointer_btn" style="padding: 4px 12px; background: #ff9800; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap; flex-shrink: 0;">修正</button>
                </div>

                <!-- 底部提示与链接 -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <span style="font-size: 9px; opacity: 0.6;">💡 指针会自动保存，切换角色时恢复</span>
                    <a href="javascript:void(0)" id="gg_open_config_link" style="color: #ff9800; text-decoration: underline; cursor: pointer; font-size: 11px; white-space: nowrap;">修改配置</a>
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

                <!-- 🆕 表格选择区域 -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-size: 11px; font-weight: 600; color: ${UI.tc};">🎯 选择要总结的表格：</label>
                    </div>

                    <!-- 🆕 表格选择按钮 -->
                    <button type="button" id="gg_sum_open_table_selector" onclick="window._gg_openSumTableSelector(event)" style="width: 100%; padding: 12px; background: ${UI.c}; color: ${UI.tc}; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; text-align: center; transition: all 0.2s; touch-action: manipulation;">
                        <span style="pointer-events: none;" id="gg_sum_table_selector_text">${(() => {
                            const savedSelection = C.manualSummaryTargetTables;

                            // ✅ 修正显示逻辑：undefined/null=默认全选, []=未选择, [1,2]=已选择X个
                            if (savedSelection === undefined || savedSelection === null) {
                                return `🎯 默认全选 ${dataTables.length} 个表格 (点击修改)`;
                            } else if (Array.isArray(savedSelection) && savedSelection.length === 0) {
                                return `⚠️ 未选择表格 (点击修改)`;
                            } else {
                                return `🎯 已选择 ${savedSelection.length} 个表格 (点击修改)`;
                            }
                        })()}</span>
                    </button>

                    <div style="font-size: 9px; color: ${UI.tc}; opacity: 0.6; margin-top: 6px;">
                        💡 默认全选所有表格，可手动勾选需要参与总结的表格
                    </div>

                    <!-- 🆕 隐藏的主UI复选框（用于状态跟踪） -->
                    <div style="display:none;">${tableCheckboxes}</div>
                </div>

                <button id="gg_sum_table-snap" style="width:100%; padding:10px; background:${window.Gaigai.isTableSummaryRunning ? '#999' : '#4caf50'}; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow: 0 2px 5px rgba(0,0,0,0.15); opacity:${window.Gaigai.isTableSummaryRunning ? '0.7' : '1'};" ${window.Gaigai.isTableSummaryRunning ? 'disabled' : ''}>
                    ${window.Gaigai.isTableSummaryRunning ? '⏳ 正在执行... (后台运行中)' : '🚀 开始表格总结'}
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
                        <input type="number" id="gg_sum_chat-start" value="${lastSumIndex}" min="0" max="${totalCount}" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                    </div>
                    <span style="font-weight:bold; color:${UI.tc}; margin-top:16px;">➜</span>
                    <div style="flex:1;">
                        <label style="font-size:11px; display:block; margin-bottom:2px; color:${UI.tc};">结束楼层</label>
                        <input type="number" id="gg_sum_chat-end" value="${totalCount}" min="0" max="${totalCount}" style="width:100%; padding:6px; border-radius:4px; border:1px solid rgba(0,0,0,0.2);" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                    </div>
                </div>

                <!-- 分批执行选项 -->
                <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.15);">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-bottom: 6px;">
                        <input type="checkbox" id="gg_sum_batch-mode" checked style="transform: scale(1.2);">
                        <span style="color:${UI.tc}; font-weight: 600;">📦 分批执行（推荐范围 > 50 层）</span>
                    </label>
                    <div id="gg_sum_batch-options" style="display: block; margin-top: 8px; padding-left: 8px;">
                        <label style="font-size: 11px; display: block; margin-bottom: 4px; color:${UI.tc}; opacity: 0.9;">每批处理楼层数：</label>
                        <input type="number" id="gg_sum_step" value="${savedStep}" min="10" max="200" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); font-size: 12px;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                        <div style="font-size: 10px; color: ${UI.tc}; opacity: 0.7; margin-top: 4px;">
                            💡 建议值：30-50层。批次间会自动冷却5秒，避免API限流。
                        </div>
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-top: 8px;">
                        <input type="checkbox" id="gg_sum_silent-mode" ${C.autoSummarySilent ? 'checked' : ''} style="transform: scale(1.2);">
                        <span style="color:${UI.tc};">🤫 静默执行 (不弹窗确认，直接写入)</span>
                    </label>
                </div>

                <button id="gg_sum_chat-run" style="width:100%; padding:10px; background:#2196f3; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    🚀 开始聊天总结
                </button>
                <div id="gg_sum_chat-status" style="text-align:center; margin-top:8px; font-size:11px; color:${UI.tc}; opacity:0.8; min-height:16px;"></div>
            </div>

            <!-- ✨ 功能区 3: 总结优化/润色 -->
            <div style="background: transparent; border-radius: 8px; padding: 12px; border: 1px solid rgba(255, 152, 0, 0.7); flex-shrink: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:${UI.tc};">✨ 总结优化/润色</h4>
                </div>

                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px;">🎯 目标选择</label>
                    <select id="gg_opt_target" style="width:100%; padding:6px; border-radius:4px; font-size:12px;">
                        <option value="all">全部已有总结</option>
                        <option value="range">指定范围 (如 1-3)</option>
                        <option value="last">最后一条总结</option>
                        <option value="specific">指定某一页</option>
                    </select>
                </div>

                <div id="gg_opt_specific-row" style="display: none; margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px;">页码范围（支持 "5" 或 "2-6"）：</label>
                    <input type="text" id="gg_opt_range-input" value="1" style="width:100%; padding:6px; border-radius:4px;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                </div>

                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; display:block; margin-bottom:4px;">💬 优化建议</label>
                    <textarea id="gg_opt_prompt" placeholder="例如：把流水账改写成史诗感、精简字数到200字以内、增加情感描写、用古文风格重写..." style="width:100%; height:80px; padding:6px; border-radius:4px; font-size:11px; resize:vertical; font-family:inherit;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
                    <div style="font-size:9px; color:${UI.tc}; opacity:0.7; margin-top:4px;">
                        💡 输入您希望AI如何优化总结的具体要求（留空则使用默认优化策略）
                    </div>
                </div>

                <!-- 🆕 分批执行选项 -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 11px; color: ${UI.tc};">
                        <input type="checkbox" id="gg_opt_batch_mode" ${C.optimizeBatchMode ? 'checked' : ''} style="margin-right: 6px; cursor: pointer;">
                        <span style="font-weight: 600;">📦 分批执行</span>
                    </label>
                    <div id="gg_opt_batch_settings" style="${C.optimizeBatchMode ? '' : 'display: none;'} margin-top: 8px; padding-left: 20px;">
                        <label style="font-size: 11px; display: block; margin-bottom: 4px; color: ${UI.tc};">每批页数：</label>
                        <input type="number" id="gg_opt_batch_step" value="${C.optimizeBatchStep || 5}" min="1" max="50" style="width: 80px; padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); font-size: 11px;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                        <span style="font-size: 10px; color: ${UI.tc}; opacity: 0.7; margin-left: 6px;">页/批</span>
                        <div style="font-size: 9px; color: ${UI.tc}; opacity: 0.6; margin-top: 4px;">
                            💡 建议值：5页/批，避免超出Token限制
                        </div>
                    </div>
                </div>

                <button id="gg_opt_run" style="width:100%; padding:10px; background:#ff9800; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    ✨ 开始优化
                </button>
                <div id="gg_opt_status" style="text-align:center; margin-top:8px; font-size:11px; color:${UI.tc}; opacity:0.8; min-height:16px;"></div>
            </div>
        </div>`;

            // 显示界面
            window.Gaigai.pop('🤖 总结控制台', h, true);

            // 阻止输入框的按键冒泡
            $('#gg_sum_chat-start, #gg_sum_chat-end, #gg_sum_step, #gg_opt_range-input, #gg_opt_prompt, #gg_edit_sum_pointer, #gg_edit_big_sum_pointer').on('keydown keyup input', function (e) {
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
                    const $btn = $('#gg_sum_chat-run');
                    if ($btn.length > 0) {
                        $btn.text('🛑 停止任务 (后台执行中)')
                            .css('background', '#dc3545')
                            .css('opacity', '1')
                            .prop('disabled', false);
                    }
                    const $status = $('#gg_sum_chat-status');
                    if ($status.length > 0) {
                        // ✅ 检查是否有进度信息，如果有则显示具体进度
                        if (window.Gaigai.summaryBatchProgress) {
                            const { current, total } = window.Gaigai.summaryBatchProgress;
                            $status.text(`🔄 正在执行第 ${current}/${total} 批...`)
                                   .css('color', '#17a2b8');
                        } else {
                            $status.text('⚠️ 分批任务正在后台执行，点击按钮可停止')
                                   .css('color', '#ff9800');
                        }
                    }
                    console.log('🔄 [界面恢复] 检测到分批总结正在执行，已恢复按钮状态');
                }

                // ✅ [UI恢复] 检查表格总结是否正在运行
                if (window.Gaigai.isTableSummaryRunning) {
                    const $btn = $('#gg_sum_table-snap');
                    if ($btn.length > 0) {
                        $btn.text('⏳ 正在执行... (后台运行中)')
                            .prop('disabled', true)
                            .css('opacity', 0.7);
                    }
                    console.log('🔄 [界面恢复] 检测到表格总结正在执行');
                }

                // ✅✅✅ [新增] 检测优化任务状态，恢复按钮
                if (window.Gaigai.isOptimizationRunning) {
                    const $btn = $('#gg_opt_run');
                    if ($btn.length > 0) {
                        // 检查是否有进度信息
                        if (window.Gaigai.optimizeBatchProgress) {
                            const { current, total } = window.Gaigai.optimizeBatchProgress;
                            $btn.text(`⏳ 正在优化第 ${current}/${total} 批...`)
                                .prop('disabled', true)
                                .css('opacity', 0.7);
                        } else {
                            $btn.text('⏳ 正在后台优化...')
                                .prop('disabled', true)
                                .css('opacity', 0.7);
                        }
                    }
                    const $status = $('#gg_opt_status');
                    if ($status.length > 0) {
                        if (window.Gaigai.optimizeBatchProgress) {
                            const { current, total } = window.Gaigai.optimizeBatchProgress;
                            $status.text(`🔄 正在执行第 ${current}/${total} 批...`).css('color', '#17a2b8');
                        } else {
                            $status.text('任务正在后台运行，请稍候...').css('color', '#17a2b8');
                        }
                    }
                    console.log('🔄 [界面恢复] 检测到总结优化正在执行');
                }

                // ✨ 修正进度按钮点击事件
                $('#gg_save_sum_pointer_btn').on('click', async function() {
                    const API_CONFIG = window.Gaigai.config;
                    const ctx = m.ctx();
                    const totalCount = ctx && ctx.chat ? ctx.chat.length : 0;

                    // 从输入框读取新值
                    const newPointer = parseInt($('#gg_edit_sum_pointer').val());

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
                    if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                        window.Gaigai.saveAllSettingsToCloud().catch(err => {
                            console.warn('⚠️ [进度修正] 云端同步失败:', err);
                        });
                    }

                    // 3. 保存到角色存档（通过 m.save()）
                    m.save(false, true); // 进度指针修正立即保存

                    // 4. 刷新显示
                    if (typeof toastr !== 'undefined') {
                        toastr.success(`进度已修正为 ${newPointer}`, '更新成功', { timeOut: 2000 });
                    }

                    // 5. 刷新控制台界面
                    setTimeout(() => self.showUI(), 300);
                });

                // ✨ 大总结指针修正按钮点击事件
                $('#gg_save_big_sum_pointer_btn').on('click', async function() {
                    const API_CONFIG = window.Gaigai.config;
                    const ctx = m.ctx();
                    const totalCount = ctx && ctx.chat ? ctx.chat.length : 0;

                    const newPointer = parseInt($('#gg_edit_big_sum_pointer').val());

                    if (isNaN(newPointer) || newPointer < 0 || newPointer > totalCount) {
                        await window.Gaigai.customAlert(`⚠️ 输入无效！\n\n请输入 0 到 ${totalCount} 之间的数字`, '错误');
                        return;
                    }

                    API_CONFIG.lastBigSummaryIndex = newPointer;

                    try {
                        localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                        console.log(`✅ [进度修正] 大总结指针已更新至: ${newPointer}`);
                    } catch (e) {
                        console.error('❌ [进度修正] localStorage 保存失败:', e);
                    }

                    if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                        window.Gaigai.saveAllSettingsToCloud().catch(err => {
                            console.warn('⚠️ [进度修正] 云端同步失败:', err);
                        });
                    }

                    m.save(false, true);

                    if (typeof toastr !== 'undefined') {
                        toastr.success(`大总结进度已修正为 ${newPointer}`, '更新成功', { timeOut: 2000 });
                    }

                    setTimeout(() => self.showUI(), 300);
                });

                // ✨ 修改配置链接点击事件
                $('#gg_open_config_link').on('click', function(e) {
                    e.preventDefault();
                    // 跳转到配置页面
                    if (typeof window.Gaigai.navTo === 'function' && typeof window.Gaigai.shcf === 'function') {
                        window.Gaigai.navTo('配置', window.Gaigai.shcf);
                    }
                });

                // 表格快照总结
                $('#gg_sum_table-snap').on('click', async function() {
                    const $btn = $(this);
                    const oldText = $btn.text();

                    // 🆕 获取用户选中的表格索引
                    const selectedTableIndices = [];
                    $('.gg_table_checkbox:checked').each(function() {
                        const index = parseInt($(this).data('table-index'));
                        if (!isNaN(index)) {
                            selectedTableIndices.push(index);
                        }
                    });

                    // 验证是否至少选择了一个表格
                    if (selectedTableIndices.length === 0) {
                        await window.Gaigai.customAlert('⚠️ 请至少选择一个表格进行总结！', '提示');
                        return;
                    }

                    console.log(`📊 [表格总结] 用户选择了 ${selectedTableIndices.length} 个表格: ${selectedTableIndices.join(', ')}`);

                    // ✅ 修复：读取静默执行状态（从聊天区域的复选框读取，或使用全局配置）
                    const isSilent = $('#gg_sum_silent-mode').length > 0
                        ? $('#gg_sum_silent-mode').is(':checked')
                        : C.autoSummarySilent;

                    // 设置全局锁
                    window.Gaigai.isTableSummaryRunning = true;
                    $btn.text('⏳ AI正在阅读...').prop('disabled', true).css('opacity', 0.7);

                    try {
                        await self.callAIForSummary(null, null, 'table', isSilent, false, false, selectedTableIndices);
                    } finally {
                        // 释放全局锁
                        window.Gaigai.isTableSummaryRunning = false;
                        // 恢复按钮 (如果界面还开着)
                        if ($('#gg_sum_table-snap').length > 0) {
                            $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        }
                    }
                });

                // 聊天记录总结 - 分批模式复选框切换
                $('#gg_sum_batch-mode').on('change', function () {
                    if ($(this).is(':checked')) {
                        $('#gg_sum_batch-options').slideDown(200);
                    } else {
                        $('#gg_sum_batch-options').slideUp(200);
                    }
                });

                // ✅ 静默执行复选框 - 保存状态到配置
                $('#gg_sum_silent-mode').on('change', function () {
                    const isChecked = $(this).is(':checked');
                    window.Gaigai.config_obj.autoSummarySilent = isChecked;
                    localStorage.setItem('gg_config', JSON.stringify(window.Gaigai.config_obj));

                    // 同步到云端
                    if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                        window.Gaigai.saveAllSettingsToCloud().catch(err => {
                            console.warn('⚠️ [静默执行配置] 云端同步失败:', err);
                        });
                    }

                    console.log(`💾 [静默执行配置] 已保存: ${isChecked}`);
                });

                // 范围变化时智能提示
                $('#gg_sum_chat-start, #gg_sum_chat-end').on('change', function () {
                    const start = parseInt($('#gg_sum_chat-start').val()) || 0;
                    const end = parseInt($('#gg_sum_chat-end').val()) || 0;
                    const range = end - start;

                    if (range > 50 && !$('#gg_sum_batch-mode').is(':checked')) {
                        $('#gg_sum_batch-mode').prop('checked', true).trigger('change');
                        const $status = $('#gg_sum_chat-status');
                        $status.text('💡 检测到范围 > 50层，已自动启用分批模式').css('color', '#ffc107');
                        setTimeout(() => $status.text('').css('color', window.Gaigai.ui.tc), 3000);
                    }
                });

                // 聊天总结 - 主按钮点击事件
                $('#gg_sum_chat-run').off('click').on('click', async function () {
                    const start = parseInt($('#gg_sum_chat-start').val());
                    const end = parseInt($('#gg_sum_chat-end').val());
                    const isBatchMode = $('#gg_sum_batch-mode').is(':checked');
                    const step = parseInt($('#gg_sum_step').val()) || 40;
                    const isSilent = $('#gg_sum_silent-mode').is(':checked');

                    // ✅ 保存批次步长到配置，下次打开时记住
                    const currentStep = step;
                    window.Gaigai.config_obj.batchSummaryStep = currentStep;
                    localStorage.setItem('gg_config', JSON.stringify(window.Gaigai.config_obj));

                    if (isNaN(start) || isNaN(end) || start >= end) {
                        await window.Gaigai.customAlert('请输入有效的楼层范围 (起始 < 结束)', '错误');
                        return;
                    }

                    // 检测是否正在运行
                    if (window.Gaigai.isBatchRunning) {
                        window.Gaigai.stopBatch = true;
                        console.log('🛑 [用户操作] 请求停止批量总结');

                        // ✅ 立即恢复UI为正常状态
                        const $btn = $(this);
                        $btn.text('🚀 开始聊天总结')
                            .css('background', '#2196f3')
                            .css('opacity', '1')
                            .prop('disabled', false);
                        $('#gg_sum_chat-status').text('');

                        if (typeof toastr !== 'undefined') {
                            toastr.info('正在停止批量任务...', '停止中', { timeOut: 2000 });
                        }

                        return;
                    }

                    const $btn = $(this);
                    const oldText = $btn.text();

                    if (isBatchMode) {
                        // 📦 分批模式
                        // ✅ 立即更新按钮状态，显示正在执行
                        $btn.text('⏳ 正在执行...').prop('disabled', true).css('opacity', 0.7);
                        $('#gg_sum_chat-status').text('初始化分批任务...').css('color', window.Gaigai.ui.tc);

                        console.log(`📊 [分批总结] 启动：${start}-${end}，步长 ${step}`);
                        await self.runBatchSummary(start, end, step, 'chat', isSilent);

                        // ✅ 执行完毕后，恢复按钮状态
                        $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        $('#gg_sum_chat-status').text('');
                    } else {
                        // 🚀 单次模式
                        $btn.text('⏳ AI正在阅读...').prop('disabled', true).css('opacity', 0.7);
                        $('#gg_sum_chat-status').text('正在请求AI...').css('color', window.Gaigai.ui.tc);
                        await self.callAIForSummary(start, end, 'chat', isSilent);
                        $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        $('#gg_sum_chat-status').text('');
                    }
                });

                // 总结优化 - 目标选择变化
                $('#gg_opt_target').on('change', function() {
                    const val = $(this).val();
                    if (val === 'specific' || val === 'range') {
                        $('#gg_opt_specific-row').slideDown(200);
                    } else {
                        $('#gg_opt_specific-row').slideUp(200);
                    }
                });

                // 🆕 总结优化 - 分批模式切换
                $('#gg_opt_batch_mode').on('change', function() {
                    const isChecked = $(this).is(':checked');

                    if (isChecked) {
                        $('#gg_opt_batch_settings').slideDown(200);
                    } else {
                        $('#gg_opt_batch_settings').slideUp(200);
                    }

                    // 保存到配置
                    C.optimizeBatchMode = isChecked;
                    localStorage.setItem('gg_config', JSON.stringify(C));
                    m.save(false, true);
                    console.log(`💾 [分批优化配置] 已保存分批模式: ${isChecked}`);
                });

                // 🆕 总结优化 - 步长变化时保存
                $('#gg_opt_batch_step').on('change', function() {
                    const step = parseInt($(this).val()) || 5;
                    C.optimizeBatchStep = step;
                    localStorage.setItem('gg_config', JSON.stringify(C));
                    m.save(false, true);
                    console.log(`💾 [分批优化配置] 已保存步长: ${step}`);
                });

                // 总结优化 - 按钮点击事件（重构版：支持停止功能）
                $('#gg_opt_run').on('click', async function() {
                    const $btn = $(this);

                    // 🛑 检测是否正在运行优化任务
                    if (window.Gaigai.isOptimizationRunning) {
                        // 用户点击停止
                        window.Gaigai.stopOptimizationBatch = true;
                        console.log('🛑 [用户操作] 请求停止批量优化');

                        // ✅ 立即更新按钮状态，给用户视觉反馈
                        $btn.text('🛑 正在停止...')
                            .prop('disabled', true)
                            .css({
                                'background': '#666',
                                'opacity': '0.8'
                            });

                        if (typeof toastr !== 'undefined') {
                            toastr.info('正在停止优化任务...', '停止中', { timeOut: 2000 });
                        }

                        return;
                    }

                    const target = $('#gg_opt_target').val();
                    let prompt = $('#gg_opt_prompt').val().trim();
                    const rangeInput = $('#gg_opt_range-input').val().trim() || "1"; // ✅ 改为字符串类型

                    // ✅ prompt 现在可以为空，将由 optimizeSummary 函数从提示词管理获取

                    const oldText = $btn.text();
                    $btn.text('⏳ AI正在优化...').prop('disabled', true).css('opacity', 0.7);
                    $('#gg_opt_status').text('正在生成优化版本...').css('color', window.Gaigai.ui.tc);

                    try {
                        await self.optimizeSummary(target, prompt, rangeInput);
                    } finally {
                        // ✅ optimizeSummary 的 finally 块已经统一处理了按钮恢复和锁释放
                        // 这里只是兜底：如果 isOptimizationRunning 意外未被清理，强制恢复
                        if (window.Gaigai.isOptimizationRunning) {
                            window.Gaigai.isOptimizationRunning = false;
                            $btn.text(oldText).prop('disabled', false).css('opacity', 1);
                        }
                    }
                });

            }, 100);
        }

        /**
         * AI总结核心函数（已修复逻辑穿透，已补全）
         * @param {number|null} forceStart - 强制起始楼层
         * @param {number|null} forceEnd - 强制结束楼层
         * @param {string|null} forcedMode - 强制模式 ('table' 或 'chat')
         * @param {boolean} isSilent - 是否静默模式
         * @param {boolean} isBatch - 是否批量模式
         * @param {boolean} skipSave - 是否跳过保存
         * @param {Array<number>} targetTableIndices - 🆕 指定要总结的表格索引数组（仅表格模式有效，为空则默认所有表）
         */
        async callAIForSummary(forceStart = null, forceEnd = null, forcedMode = null, isSilent = false, isBatch = false, skipSave = false, targetTableIndices = null, skipWorldInfoSync = false) {
            // 使用 window.Gaigai.loadConfig 确保配置最新
            const loadConfig = window.Gaigai.loadConfig || (() => Promise.resolve());
            await loadConfig();

            const API_CONFIG = window.Gaigai.config;
            const C = window.Gaigai.config_obj;
            const m = window.Gaigai.m;

            // 🛡️ [Safe Guard] Capture session ID at start to prevent data bleeding
            const initialSessionId = m.gid();

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

            // 动态获取所有数据表（不包含总结表）
            const tables = m.all().slice(0, -1).filter(s => s.r.length > 0);
            const ctx = window.SillyTavern.getContext();

            // 🛑 新增：空卡熔断保护
            if (!ctx || !ctx.chat || ctx.chat.length === 0) {
                if (!isSilent) {
                    // 如果是手动点击，才提示错误
                    await window.Gaigai.customAlert('⚠️ 聊天记录为空，无法进行总结。', '提示');
                } else {
                    console.log('🛑 [自动总结] 检测到聊天记录为空，已跳过。');
                }
                return { success: false, error: 'empty_chat' };
            }

            // 获取角色名
            let userName = ctx.name1 || 'User';
            let charName = 'Character';
            if (ctx.characterId !== undefined && ctx.characters && ctx.characters[ctx.characterId]) {
                charName = ctx.characters[ctx.characterId].name || ctx.name2 || 'Character';
            } else if (ctx.name2) {
                charName = ctx.name2;
            }

            // 🆕 处理表格索引过滤
            // 如果指定了 targetTableIndices，则只使用这些表格；否则使用所有非空表格
            let filteredTables = tables;
            if (isTableMode && targetTableIndices && Array.isArray(targetTableIndices) && targetTableIndices.length > 0) {
                filteredTables = tables.filter((table, idx) => {
                    // 找到该表格在 m.s 中的实际索引
                    const actualIndex = m.s.indexOf(table);
                    return targetTableIndices.includes(actualIndex);
                });
                console.log(`📊 [表格过滤] 用户选择了 ${targetTableIndices.length} 个表格，过滤后实际有数据的表格: ${filteredTables.length} 个`);
            }

            // 准备 System Prompt
            let rawPrompt = isTableMode ? window.Gaigai.PromptManager.get('summaryPromptTable') : window.Gaigai.PromptManager.get('summaryPromptChat');
            if (!rawPrompt || !rawPrompt.trim()) rawPrompt = "请总结以下内容：";
            let targetPrompt = window.Gaigai.PromptManager.resolveVariables(rawPrompt, ctx);

            // UI 交互逻辑（表格模式下的确认）
            if (isTableMode && !isSilent) {
                if (!await window.Gaigai.customConfirm(`即将总结 ${filteredTables.length} 个表格`, '确认')) {
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

                // ✅ 修复：手动输入的楼层数应该只计算对话消息（不含 System）
                if (forceEnd !== null) {
                    const targetDialogueCount = parseInt(forceEnd);
                    let dialogueCount = 0;
                    endIndex = ctx.chat.length; // 默认到末尾

                    // 遍历找到第 N 条对话消息的实际索引
                    for (let i = 0; i < ctx.chat.length; i++) {
                        const msg = ctx.chat[i];
                        // 跳过 System 消息
                        if (msg.role === 'system' || msg.isGaigaiPrompt || msg.isGaigaiData) continue;

                        dialogueCount++;
                        if (dialogueCount === targetDialogueCount) {
                            endIndex = i + 1; // +1 因为 slice 是右开区间
                            break;
                        }
                    }
                    console.log(`📍 [楼层映射] 用户输入第 ${targetDialogueCount} 楼 → 实际索引 ${endIndex - 1}（slice 到 ${endIndex}）`);
                } else {
                    endIndex = ctx.chat.length;
                }

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

                // 2. System Prompt (总结提示词主体 - 规则、格式等)
                messages.push({
                    role: 'system',
                    content: targetPrompt
                });

                // 3. 背景资料（仅包含角色名和用户名）
                const contextText = `【背景资料】\n角色: ${charName}\n用户: ${userName}`;
                messages.push({ role: 'system', content: contextText });

                // 3. 世界书 - 已禁用
                // ✅ [优化] 停止在总结时读取世界书，防止设定被错误写入总结导致双重上下文
                /*
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
                */

                console.log('📊 [优化] 总结时不读取世界书，防止设定污染');

                // 4. 前情提要 - 已删除
                // ✅ [优化] 彻底不发送前情提要，避免内容重复和 Token 浪费
                console.log('📊 [优化] 不发送前情提要，避免重复内容');

                // 5. 当前表格状态 - 已删除
                // ✅ [优化] 聊天总结时不发送表格状态，只专注于聊天记录本身
                console.log('📊 [优化] 聊天总结不发送表格状态，专注聊天记录');

                // 6. 聊天记录
                const targetSlice = ctx.chat.slice(startIndex, endIndex);
                const cleanMemoryTags = window.Gaigai.cleanMemoryTags;
                let validMsgCount = 0;
                targetSlice.forEach((msg) => {
                    let content = msg.mes || msg.content || '';
                    if (msg.isGaigaiPrompt || msg.isGaigaiData || msg.isPhoneMessage === true) return;

                    // ✅ [图片清洗] 移除 Base64 图片，防止请求体过大
                    const base64ImageRegex = /<img[^>]*src=["']data:image[^"']*["'][^>]*>/gi;
                    const base64MarkdownRegex = /!\[[^\]]*\]\(data:image[^)]*\)/gi;
                    content = content.replace(base64ImageRegex, '[图片]');
                    content = content.replace(base64MarkdownRegex, '[图片]');

                    content = cleanMemoryTags(content);
                    content = window.Gaigai.tools.filterContentByTags(content);

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

                // 4. 执行指令（对话历史结束标记）
                const endMarker = window.Gaigai.PromptManager.CHAT_HISTORY_END_MARKER;
                const lastMsg = messages[messages.length - 1];
                if (lastMsg && lastMsg.role === 'user') {
                    // 如果最后一条是 user，直接追加
                    lastMsg.content += '\n\n' + endMarker;
                } else {
                    // 如果最后一条是 assistant，单独发一条 user 消息
                    messages.push({ role: 'user', content: endMarker });
                }

                logMsg = `📝 聊天总结: ${startIndex}-${endIndex} (消息数:${messages.length})`;

            } else {
                // === 场景 B: 总结表格模式 (这里加上了 ELSE，修复了逻辑穿透问题) ===

                // ✅✅✅ [修复] 表格模式下也需要设置 endIndex，用于进度指针更新
                endIndex = (forceEnd !== null) ? parseInt(forceEnd) : (ctx && ctx.chat ? ctx.chat.length : 0);

                // 1. 写入 NSFW 破限提示词
                messages.push({
                    role: 'system',
                    content: window.Gaigai.PromptManager.resolveVariables(
                        window.Gaigai.PromptManager.get('nsfwPrompt'),
                        ctx
                    )
                });

                // 2. 写入历史总结 - 已删除
                // ✅ [优化] 彻底不发送前情提要，避免内容重复和 Token 浪费
                console.log('📊 [优化] 表格总结不发送前情提要，避免重复内容');

                // 3. 写入详情表格（🆕 使用过滤后的表格列表）
                let hasTableData = false;
                filteredTables.forEach((sheet) => {
                    if (sheet.r.length > 0) {
                        hasTableData = true;
                        // 找到该表格在 m.s 中的实际索引
                        const actualIndex = m.s.indexOf(sheet);
                        
                        // ✨✨✨ 修复：加上 name 和 isGaigaiData，让探针显示表名
                        messages.push({
                            role: 'system',
                            name: `SYSTEM (${sheet.n})`, // ✅ 显示具体表名
                            content: `【待总结的表格 - ${sheet.n}】\n${sheet.txt(actualIndex)}`,
                            isGaigaiData: true // ✅ 激活探针显示
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

            // 🔍 更新探针数据（记录最后一次API请求，包括自动总结）
            window.Gaigai.lastRequestData = {
                chat: JSON.parse(JSON.stringify(messages)),
                timestamp: Date.now(),
                model: API_CONFIG.model || 'Unknown'
            };

            let result;
            window.isSummarizing = true;

            try {
                if (API_CONFIG.useIndependentAPI) {
                    result = await window.Gaigai.tools.callIndependentAPI(messages);
                } else {
                    result = await window.Gaigai.tools.callTavernAPI(messages);
                }
            } catch (e) {
                window.isSummarizing = false; // ✅ API请求失败,解锁
                console.error('❌ [总结请求失败]', e);

                // 使用 customRetryAlert 提供"重试"和"放弃"选项
                const customRetryAlert = window.Gaigai.customRetryAlert;
                if (!customRetryAlert) {
                    await window.Gaigai.customAlert(`API请求失败：${e.message}`, '⚠️ 请求错误');
                    return { success: false, error: e.message };
                }

                const shouldRetry = await customRetryAlert(e.message, '⚠️ 请求错误');
                if (shouldRetry) {
                    return this.callAIForSummary(forceStart, forceEnd, forcedMode, isSilent, isBatch, skipSave, targetTableIndices);
                } else {
                    return { success: false, error: e.message };
                }
            }

            // 🛡️ [Safe Guard] Check if session changed during API call
            if (m.gid() !== initialSessionId) {
                window.isSummarizing = false; // ✅ Session变化,解锁
                console.warn(`🛑 [Safe Guard] Session changed during summary. Aborting.`);
                return { success: false, error: 'session_changed' };
            }

            if (result.success) {
                if (!result.summary || !result.summary.trim()) {
                    window.isSummarizing = false; // ✅ AI返回空,解锁
                    if (!isSilent) await window.Gaigai.customAlert('AI返回空', '警告');
                    return { success: false, error: 'AI 返回空内容' };
                }

                let cleanSummary = result.summary;
                // 移除思考过程 (带回退保护)
                // 移除思维链 (标准成对 + 残缺开头)
                if (cleanSummary.includes('</think>')) {
                    const raw = cleanSummary;
                    let cleaned = cleanSummary
                        .replace(/<think>[\s\S]*?<\/think>/gi, '') // 移除标准成对
                        .replace(/^[\s\S]*?<\/think>/i, '')        // 移除残缺开头
                        .trim();
                    // 如果清洗后为空，保留原文(防止报错)，否则使用清洗结果
                    cleanSummary = cleaned || raw;
                }

                if (!cleanSummary || cleanSummary.length < 10) {
                    if (!isSilent) {
                        window.isSummarizing = false; // ✅ 弹窗前先解锁,避免阻塞
                        const shouldRetry = await window.Gaigai.customRetryAlert("总结内容过短或为空，AI 可能没看懂指令。", "⚠️ 内容无效");
                        if (shouldRetry) {
                            return this.callAIForSummary(forceStart, forceEnd, forcedMode, isSilent, isBatch, skipSave, targetTableIndices);
                        }
                    } else {
                        window.isSummarizing = false; // ✅ 静默模式也要解锁
                    }
                    return { success: false, error: '总结内容过短或无效' };
                }

                // ✅✅✅ [核心修复] 无论是表格模式还是聊天模式，只要是自动(静默)执行，就必须推进指针，防止重复触发
                if (isSilent && endIndex !== null && endIndex !== undefined) {
                    const currentLast = API_CONFIG.lastSummaryIndex || 0;
                    // 只有当新位置比旧位置靠后时才更新
                    // ✅ 使用原始索引，而不是对话数量，避免 System 消息导致的索引错位
                    if (endIndex > currentLast) {
                        API_CONFIG.lastSummaryIndex = endIndex;
                        localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                        console.log(`✅ [自动进度更新] 指针已推进至: 原始索引 ${endIndex} (模式: ${isTableMode ? '表格' : '聊天'})`);

                        // ✅ 同步到云端，防止被全局配置覆盖
                        if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                            window.Gaigai.saveAllSettingsToCloud().catch(err => {
                                console.warn('⚠️ [指针同步] 云端同步失败:', err);
                            });
                        }

                        // ✅ 触发原生隐藏命令（总结后自动隐藏已总结楼层）
                        await applyNativeHiding();
                    }
                }

                if (isSilent && !skipSave) {
                    // 总是先保存总结内容
                    m.sm.save(cleanSummary, currentRangeStr);

                    // ✅ 只有当 !skipWorldInfoSync 为真时，才执行世界书同步
                    if (!skipWorldInfoSync) {
                        await window.Gaigai.syncToWorldInfo(cleanSummary);
                    }

                    // ✅✅✅ [新增] 自动向量化开启时,自动隐藏总结表所有行
                    if (window.Gaigai.config_obj.autoVectorizeSummary) {
                        const sumIdx = m.s.length - 1; // 总结表索引
                        const sumSheet = m.get(sumIdx);
                        if (sumSheet && sumSheet.r.length > 0) {
                            // 遍历所有行进行隐藏标记(覆盖旧数据)
                            for (let ri = 0; ri < sumSheet.r.length; ri++) {
                                window.Gaigai.markAsSummarized(sumIdx, ri);
                            }
                            console.log('⚡ [自动向量化] 已自动隐藏总结表所有行');
                        }
                    }

                    // ✨✨✨ 修复：只要 isSilent 为 true，就直接执行静默保存，不再检查全局配置
                    if (isTableMode && currentMode === 'table') {
                        // 用户勾选了静默保存，自动标记为绿色并结束
                        // 🔧 修复：只标记参与总结的表格（filteredTables），而不是所有表格（tables）
                        filteredTables.forEach(table => {
                            const ti = m.all().indexOf(table);
                            if (ti !== -1) {
                                for (let ri = 0; ri < table.r.length; ri++) window.Gaigai.markAsSummarized(ti, ri);
                            }
                        });

                        if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                            window.Gaigai.saveAllSettingsToCloud().catch(err => {
                                console.warn('⚠️ [自动总结] 云端同步失败:', err);
                            });
                        }

                        m.save(false, true); // 批量总结完成后立即保存
                        if (typeof window.Gaigai.updateCurrentSnapshot === 'function') {
                            window.Gaigai.updateCurrentSnapshot();
                        }

                        if ($('#gai-main-pop').length > 0) window.Gaigai.shw();

                        if (typeof toastr !== 'undefined') {
                            if (!isBatch) toastr.success('自动总结已在后台完成并保存', '记忆表格', { timeOut: 1000, preventDuplicates: true });
                        }
                        window.isSummarizing = false; // ✅ 静默模式保存完成,解锁
                        return { success: true, summary: cleanSummary };
                    } else {
                        // 非表格模式(聊天总结),正常静默执行
                        if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                            window.Gaigai.saveAllSettingsToCloud().catch(err => {
                                console.warn('⚠️ [自动总结] 云端同步失败:', err);
                            });
                        }

                        m.save(false, true); // 自动总结完成后立即保存
                        window.Gaigai.updateCurrentSnapshot();

                        if ($('#gai-main-pop').length > 0) window.Gaigai.shw();

                        if (typeof toastr !== 'undefined') {
                            if (!isBatch) toastr.success('自动总结已在后台完成并保存', '记忆表格', { timeOut: 1000, preventDuplicates: true });
                        }
                        window.isSummarizing = false; // ✅ 静默模式保存完成,解锁
                        return { success: true, summary: cleanSummary };
                    }
                } else if (isSilent && skipSave) {
                    window.isSummarizing = false; // ✅ 静默且跳过保存,解锁
                    return { success: true, summary: cleanSummary };
                }

                // ✨ 如果是表格模式且用户未勾选静默，会执行到这里，弹出预览窗口
                const regenParams = { forceStart, forceEnd, forcedMode, isSilent, targetTableIndices };
                const res = await this.showSummaryPreview(cleanSummary, filteredTables, isTableMode, endIndex, regenParams, currentRangeStr, isBatch);
                return res;

            } else {
                // 失败处理
                const errorText = result.error || 'Unknown error';

                // 🛑 【重要】如果是 Key 错误（401/Unauthorized），直接报错并停止，防止死循环
                if (errorText.includes('Unauthorized') || errorText.includes('401')) {
                    window.isSummarizing = false; // ✅ Key错误,解锁
                    await window.Gaigai.customAlert(
                        `🛑 API Key 错误或已失效！\n\n错误信息：${errorText}\n\n请前往配置页面检查您的 API Key 设置。`,
                        '⚠️ 认证失败'
                    );
                    return { success: false, error: errorText };
                }

                // 其他错误：使用 customRetryAlert 提供"重试"和"放弃"选项
                const customRetryAlert = window.Gaigai.customRetryAlert;
                if (!customRetryAlert) {
                    window.isSummarizing = false; // ✅ 错误,解锁
                    // 如果 customRetryAlert 不存在，降级为普通弹窗
                    await window.Gaigai.customAlert(`生成失败：${errorText}`, '⚠️ AI 生成失败');
                    return { success: false, error: errorText };
                }

                // ✅ 弹窗前先解锁,避免阻塞
                window.isSummarizing = false;

                // ✅ 使用 customRetryAlert 提供"重试"和"放弃"选项（传递原始错误）
                const shouldRetry = await customRetryAlert(errorText, '⚠️ AI 生成失败');

                if (shouldRetry) {
                    // 用户点击"重试"，递归调用
                    return this.callAIForSummary(forceStart, forceEnd, forcedMode, isSilent, isBatch, skipSave, targetTableIndices);
                } else {
                    // 用户点击"放弃"，停止递归
                    return { success: false, error: errorText };
                }
            }
        }

        /**
         * 显示总结预览弹窗（迁移自 index.js）
         */
        showSummaryPreview(summaryText, sourceTables, isTableMode, newIndex = null, regenParams = null, rangeStr = "", isBatch = false) {
            const self = this;
            const m = window.Gaigai.m;
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
                <p style="opacity:0.8; font-size:11px; margin: 0 0 10px 0;">
                    ✅ 已生成总结建议<br>
                    💡 您可以直接编辑润色内容，满意后点击保存
                </p>
                <textarea id="gg_summary_editor" style="flex: 1; width:100%; min-height: 0; padding:10px; border-radius:4px; font-size:12px; font-family:inherit; resize: none; line-height:1.8; margin-bottom: 10px;">${window.Gaigai.esc(summaryText)}</textarea>

                <div style="margin-bottom:12px; flex-shrink: 0;">
                    <label for="gg_summary_note" style="display:block; font-size:12px; opacity:0.8; margin-bottom:4px;">📌 备注/范围：</label>
                    <input type="text"
                           id="gg_summary_note"
                           value="${window.Gaigai.esc(rangeStr)}"
                           placeholder="例如：0-50、第1章、主线任务等"
                           style="width:100%; padding:8px; border-radius:4px; font-size:12px;">
                    <div style="font-size:10px; opacity:0.6; margin-top:4px;">💡 提示：此备注会自动保存到总结表第3列（如果该列存在）</div>
                </div>

                <div style="display: flex; gap: 10px; flex-shrink: 0;">
                    <button id="gg_cancel_summary" style="padding:8px 16px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🚫 放弃</button>
                    ${regenParams ? '<button id="gg_regen_summary" style="padding:8px 16px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🔄 重新生成</button>' : ''}
                    <button id="gg_save_summary" style="padding:8px 16px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 2; font-weight:bold;">✅ 保存总结</button>
                </div>
            </div>
        `;

                $('#gai-summary-pop').remove();
                const $o = $('<div>', { id: 'gai-summary-pop', class: 'g-ov', css: { 'z-index': '10000010' } });
                const $p = $('<div>', { class: 'g-w', css: { width: '700px', maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' } });
                const $hd = $('<div>', { class: 'g-hd', css: { flexShrink: '0' } });
                $hd.append(`<h3 style="color:${UI.tc}; flex:1;">📝 记忆总结</h3>`);

                const $x = $('<button>', { class: 'g-x', text: '×', css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' } }).on('click', () => {
                    $o.remove();
                    window.isSummarizing = false; // ✅ 关闭弹窗，解锁
                    console.log('🔓 [总结弹窗-X] 已释放 isSummarizing 锁');
                    resolve({ success: false });
                });
                $hd.append($x);

                const $bd = $('<div>', { class: 'g-bd', html: h, css: { flex: '1', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px' } });
                $p.append($hd, $bd);
                $o.append($p);
                $('body').append($o);

                setTimeout(() => {
                    $('#gg_summary_editor').focus();

                    // ✅ 统一的清理函数：关闭弹窗 + 释放锁
                    const cleanup = (removePopup = true) => {
                        if (removePopup) $o.remove();
                        window.isSummarizing = false; // ✅ 用户操作完了，解锁！
                        console.log('🔓 [总结弹窗] 已释放 isSummarizing 锁');
                    };

                    $('#gg_cancel_summary').on('click', () => {
                        cleanup();
                        resolve({ success: false });
                    });

                    if (regenParams) {
                        $('#gg_regen_summary').on('click', async function () {
                            const $btn = $(this);
                            const originalText = $btn.text();

                            $('#gg_cancel_summary, #gg_regen_summary, #gg_save_summary').prop('disabled', true);
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
                                    true,  // skipSave
                                    regenParams.targetTableIndices  // 🆕 传递表格索引
                                );

                                if (res && res.success && res.summary && res.summary.trim()) {
                                    $('#gg_summary_editor').val(res.summary);
                                    if (typeof toastr !== 'undefined') {
                                        toastr.success('内容已刷新', '重新生成', { timeOut: 1000, preventDuplicates: true });
                                    }
                                } else {
                                    throw new Error('重新生成返回空内容');
                                }

                            } catch (error) {
                                console.error('❌ [重新生成失败]', error);

                                // ✅ 使用 customRetryAlert（传递原始错误）
                                const shouldRetry = await window.Gaigai.customRetryAlert(error.message, '⚠️ 生成失败');

                                if (shouldRetry) {
                                    console.log('🔄 [用户重试] 关闭弹窗并重新调用总结...');
                                    cleanup(); // ✅ 释放锁后再重新调用
                                    resolve({ success: false });
                                    await self.callAIForSummary(
                                        regenParams.forceStart,
                                        regenParams.forceEnd,
                                        regenParams.forcedMode,
                                        false,
                                        false,
                                        false,
                                        regenParams.targetTableIndices  // 🆕 传递表格索引
                                    );
                                    return;
                                }
                            } finally {
                                window._isRegeneratingInPopup = false;
                                $('#gg_cancel_summary, #gg_regen_summary, #gg_save_summary').prop('disabled', false);
                                $btn.text(originalText);
                            }
                        });
                    }

                    $('#gg_save_summary').on('click', async function () {
                        const editedSummary = $('#gg_summary_editor').val();
                        const noteValue = $('#gg_summary_note').val().trim();

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
                        await window.Gaigai.syncToWorldInfo(editedSummary);

                        // ✅✅✅ [新增] 自动向量化开启时,自动隐藏总结表所有行
                        if (window.Gaigai.config_obj.autoVectorizeSummary) {
                            const sumIdx = m.s.length - 1; // 总结表索引
                            const sumSheet = m.get(sumIdx);
                            if (sumSheet && sumSheet.r.length > 0) {
                                // 遍历所有行进行隐藏标记(覆盖旧数据)
                                for (let ri = 0; ri < sumSheet.r.length; ri++) {
                                    window.Gaigai.markAsSummarized(sumIdx, ri);
                                }
                                console.log('⚡ [自动向量化] 已自动隐藏总结表所有行');
                            }
                        }

                        // ✅✅✅ [修复] 删除 !isTableMode 限制，无论什么模式都应更新进度指针
                        if (newIndex !== null && newIndex !== undefined) {
                            const currentLast = API_CONFIG.lastSummaryIndex || 0;
                            // ✅ 使用原始索引，而不是对话数量，避免 System 消息导致的索引错位
                            if (newIndex > currentLast) {
                                API_CONFIG.lastSummaryIndex = newIndex;
                                try { localStorage.setItem('gg_api', JSON.stringify(API_CONFIG)); } catch (e) { }
                                console.log(`✅ [进度更新] 总结进度已更新至: 原始索引 ${newIndex} (模式: ${isTableMode ? '表格' : '聊天'})`);

                                // ✨✨✨ [修复] 手动保存后，立即触发隐藏逻辑
                                await applyNativeHiding();
                            }
                        }

                        if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                            window.Gaigai.saveAllSettingsToCloud().catch(err => {
                                console.warn('⚠️ [总结保存] 云端同步失败:', err);
                            });
                        }

                        // 🔒 安全检查2：保存前再次验证会话ID（防止同步期间切换会话）
                        const saveSessionId = m.gid();
                        if (saveSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 最终保存时: ${saveSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，数据未保存\n\n警告：总结可能已同步到世界书，请检查数据完整性！', '严重错误');
                            cleanup();
                            resolve({ success: false });
                            return;
                        }

                        console.log(`🔒 [最终验证通过] 会话ID: ${saveSessionId}, 保存总结数据`);

                        m.save(false, true); // 总结保存后立即同步
                        if (typeof window.Gaigai.updateCurrentSnapshot === 'function') {
                            window.Gaigai.updateCurrentSnapshot();
                        }

                        cleanup(); // ✅ 关闭弹窗并释放锁

                        if (!isTableMode) {
                            if (!isBatch) {
                                await window.Gaigai.customAlert('✅ 剧情总结已保存！\n(进度指针已自动更新)', '保存成功');
                            } else {
                                if (typeof toastr !== 'undefined') {
                                    toastr.success('本批次已保存', '进度更新', { timeOut: 1500 });
                                }
                            }

                            if ($('#gai-main-pop').length > 0) window.Gaigai.shw();
                            resolve({ success: true });
                        } else {
                            // 表格模式：弹出三选一操作框
                            // 🌙 获取主题配置
                            const isDark = window.Gaigai.ui.darkMode;
                            const themeColor = window.Gaigai.ui.c;
                            const textColor = window.Gaigai.ui.tc;

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
                                class: 'summary-action-box',
                                css: {
                                    background: isDark ? '#1e1e1e' : '#fff',
                                    color: 'var(--g-tc)',
                                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                    borderRadius: '12px',
                                    padding: '24px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                                    width: '90%',
                                    maxWidth: '420px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    textAlign: 'center'
                                }
                            });

                            $dBox.append(`<div style="font-size:18px; margin-bottom:8px; color:var(--g-tc);">🎉 总结已保存！</div>`);
                            $dBox.append(`<div style="font-size:13px; opacity:0.8; margin-bottom:12px; color:var(--g-tc);">请选择如何处理<strong>原始表格数据</strong>：</div>`);

                            // 🎨 创建按钮容器（确保按钮在手机上也能正常排列）
                            const $btnContainer = $('<div>', {
                                css: {
                                    display: 'flex',
                                    gap: '10px',
                                    width: '100%',
                                    flexWrap: 'wrap'
                                }
                            });

                            // 🎨 统一按钮样式（适配日夜模式 + 响应式）
                            const btnBaseStyle = {
                                flex: '1',
                                minWidth: '0',
                                padding: '12px 8px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s',
                                textAlign: 'center',
                                lineHeight: '1.4',
                                border: 'none',
                                outline: 'none'
                            };

                            const $btnDel = $('<button>', {
                                class: 'summary-action-btn summary-action-delete',
                                html: '🗑️ 删除表格<br><span style="font-size:10px; font-weight:normal; opacity:0.8; color:inherit;">(清空已总结数据)</span>',
                                css: {
                                    ...btnBaseStyle,
                                    background: isDark ? 'rgba(220, 53, 69, 0.2)' : 'rgba(220, 53, 69, 0.1)',
                                    color: textColor,
                                    border: `1px solid ${isDark ? '#ff6b6b' : '#dc3545'}`
                                }
                            }).on('click', () => {
                                // 🔧 修复：只清空参与总结的表格（sourceTables），而不是所有数据表
                                console.log(`🗑️ [批量清空] 正在清空 ${sourceTables.length} 个参与总结的数据表...`);

                                // 🛡️ [安全备份] 在清空表格前，强制保存当前状态
                                console.log('🛡️ [安全备份] 在清空表格前，强制保存当前状态...');
                                window.Gaigai.m.save(true); // 强制保存一份当前状态到 localStorage 历史记录
                                // 为当前状态创建一个内存快照，方便回滚
                                if (typeof window.Gaigai.saveSnapshot === 'function') {
                                    window.Gaigai.saveSnapshot('backup_pre_summary_clear_' + Date.now());
                                }

                                sourceTables.forEach(table => {
                                    if (table) {
                                        table.clear();
                                    }
                                });

                                finish('✅ 已总结的数据表已清空，总结已归档（操作前已自动备份，可在"恢复数据"中找回）。');
                            });

                            const $btnHide = $('<button>', {
                                class: 'summary-action-btn summary-action-hide',
                                html: '🙈 仅隐藏<br><span style="font-size:10px; font-weight:normal; opacity:0.8; color:inherit;">(标记已处理)</span>',
                                css: {
                                    ...btnBaseStyle,
                                    background: isDark ? 'rgba(40, 167, 69, 0.2)' : 'rgba(40, 167, 69, 0.1)',
                                    color: textColor,
                                    border: `1px solid ${isDark ? '#51cf66' : '#28a745'}`
                                }
                            }).on('click', () => {
                                // 🔧 修复：只标记参与总结的表格（sourceTables），而不是所有数据表
                                console.log(`🙈 [批量隐藏] 正在处理 ${sourceTables.length} 个参与总结的数据表...`);

                                sourceTables.forEach(table => {
                                    if (table && table.r && table.r.length > 0) {
                                        // 获取该表在 m.s 中的真实索引
                                        const tableIndex = m.s.indexOf(table);
                                        if (tableIndex !== -1) {
                                            // 将该表所有行标记为已总结
                                            for (let ri = 0; ri < table.r.length; ri++) {
                                                window.Gaigai.markAsSummarized(tableIndex, ri);
                                            }
                                        }
                                    }
                                });

                                finish('✅ 已总结的数据表已标记为已总结（绿色）。');
                            });

                            const $btnKeep = $('<button>', {
                                class: 'summary-action-btn summary-action-keep',
                                html: '👁️ 保留<br><span style="font-size:10px; font-weight:normal; opacity:0.8; color:inherit;">(不做修改)</span>',
                                css: {
                                    ...btnBaseStyle,
                                    background: isDark ? 'rgba(108, 117, 125, 0.2)' : 'rgba(108, 117, 125, 0.1)',
                                    color: textColor,
                                    border: `1px solid ${isDark ? 'rgba(108, 117, 125, 0.5)' : '#6c757d'}`
                                }
                            }).on('click', () => {
                                finish('✅ 原始数据已保留（未做标记）。');
                            });

                            function finish(msg) {
                                m.save(false, true); // 总结去重操作立即保存
                                $dOverlay.remove();
                                if ($('#gai-main-pop').length > 0) window.Gaigai.shw();
                                $('.g-t[data-i="8"]').click();
                                if (typeof toastr !== 'undefined') toastr.success(msg);
                                resolve({ success: true });
                            }

                            // 将按钮添加到容器，再将容器添加到弹窗
                            $btnContainer.append($btnDel, $btnHide, $btnKeep);
                            $dBox.append($btnContainer);
                            $dOverlay.append($dBox);
                            $('body').append($dOverlay);
                        }
                    });

                    $o.on('keydown', async e => {
                        if (e.key === 'Escape') {
                            if (await window.Gaigai.customConfirm('确定取消？当前总结内容将丢失。', '确认')) {
                                cleanup();
                                resolve({ success: false });
                            }
                        }
                    });
                }, 100);
            });
        }

        /**
         * 🆕 大总结功能：对指定区间进行总结，并清理零散小总结
         * @param {number} start - 起始楼层
         * @param {number} end - 结束楼层
         */
        async runBigSummary(start, end) {
            const m = window.Gaigai.m;
            const API_CONFIG = window.Gaigai.config;
            const C = window.Gaigai.config_obj;

            console.log(`📚 [大总结] 开始执行: ${start}-${end}`);

            try {
                // === 🌟 新增：执行大总结前，检查记忆总结中是否已存在该区间的总结 ===
                const checkSumSheet = m.get(m.s.length - 1);
                if (checkSumSheet && checkSumSheet.r && checkSumSheet.r.length > 0) {
                    const targetRangeStr = `${start}-${end}`;
                    let alreadyExists = false;

                    // 遍历总结表，检查备注（通常在第3列索引2）是否包含这个区间
                    for (let i = 0; i < checkSumSheet.r.length; i++) {
                        const note = checkSumSheet.r[i][2] || '';
                        if (note.trim() === targetRangeStr) {
                            alreadyExists = true;
                            break;
                        }
                    }

                    if (alreadyExists) {
                        const msg = `⚠️ 拦截提示：检测到总结表格中已存在 [ ${start}-${end} ] 楼层的记录！\n\n大总结已自动取消。请手动前往总结控制台修正【大总结指针】，或自行检查已有内容。`;
                        console.warn(`🛑 [大总结] ${msg}`);

                        // ✅ 防重复触发：既然该区间总结已存在，直接推进大总结指针到区间末尾
                        const currentBigIndex = API_CONFIG.lastBigSummaryIndex || 0;
                        if (end > currentBigIndex) {
                            API_CONFIG.lastBigSummaryIndex = end;
                            localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                            m.save(false, true);
                            if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                                window.Gaigai.saveAllSettingsToCloud().catch(err => {
                                    console.warn('⚠️ [大总结指针同步] 云端同步失败:', err);
                                });
                            }
                            console.log(`✅ [大总结] 检测到区间已存在，指针已自动推进到 ${end}`);
                        }
                        
                        // 弹出提示 (兼容不同环境)
                        if (typeof toastr !== 'undefined') {
                            toastr.warning(`已存在 ${start}-${end} 楼层总结，大总结已取消，请手动修正指针。`, '⚠️ 大总结拦截', { timeOut: 8000 });
                        } else {
                            await window.Gaigai.customAlert(msg, '⚠️ 大总结拦截');
                        }
                        
                        return; // 存在相同区间，直接终止大总结流程
                    }
                }

                // 🛡️ 防撞车锁：如果常规小总结正在执行，大总结必须排队等待其落盘
                while (window.isSummarizing) {
                    console.log('⏳ [大总结] 检测到小总结正在生成，大总结排队等待 2 秒...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                // 锁定状态，防止新的小总结在此期间乱入
                window.isSummarizing = true;

                // 1. 触发 AI 总结
                const result = await this.callAIForSummary(start, end, null, true, false, true, null, true);

                if (!result || !result.success || !result.summary) {
                    console.warn('❌ [大总结] AI 总结失败');
                    return;
                }

                // 2. 获取总结表
                const sumSheet = m.get(m.s.length - 1);
                if (!sumSheet) {
                    console.error('❌ [大总结] 总结表不存在');
                    return;
                }

                // 3. 先清理碎片总结（只删除当前区间内的零散小总结）
                const indicesToDelete = [];
                const crossBoundarySummaries = []; // 记录跨区域总结
                for (let i = 0; i < sumSheet.r.length; i++) {
                    const row = sumSheet.r[i];
                    const note = row[2] || '';
                    const match = note.match(/^(\d+)\s*-\s*(\d+)$/);

                    if (match) {
                        const s = parseInt(match[1]);
                        const e = parseInt(match[2]);

                        // 完全在区间内：删除
                        if (s >= start && e <= end) {
                            indicesToDelete.push(i);
                        }
                        // 跨区域：起点在区间外，终点在区间内（如 98-120 对于 100-200）
                        else if (s < start && e > start && e <= end) {
                            crossBoundarySummaries.push(note);
                        }
                        // 跨区域：起点在区间内，终点在区间外（如 180-220 对于 100-200）
                        else if (s >= start && s < end && e > end) {
                            crossBoundarySummaries.push(note);
                        }
                    }
                }

                if (indicesToDelete.length > 0) {
                    sumSheet.delMultiple(indicesToDelete);
                    console.log(`🗑️ [大总结] 已清理 ${indicesToDelete.length} 个零散总结`);
                }

                // 提醒用户跨区域总结
                if (crossBoundarySummaries.length > 0) {
                    const message = `⚠️ 检测到 ${crossBoundarySummaries.length} 个跨区域总结：\n${crossBoundarySummaries.join(', ')}\n\n大总结已完成，跨区域总结内容已保留，请手动核实后删除。`;
                    console.warn(`⚠️ [大总结] ${message}`);
                    if (typeof toastr !== 'undefined') {
                        toastr.warning(message, '大总结完成', { timeOut: 10000 });
                    }
                }

                // 4. 写入大总结（删除后保存，标题会自动按顺序命名）
                m.sm.save(result.summary, `${start}-${end}`);
                console.log(`✅ [大总结] 已保存: ${start}-${end}`);

                // 4. 更新进度指针
                API_CONFIG.lastBigSummaryIndex = end;
                localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                m.save(true, true);

                // 5. 同步到世界书
                await window.Gaigai.WI.syncToWorldInfo(null, true);

                // 6. 触发自动向量化
                if (C.autoVectorizeSummary && window.Gaigai.VM) {
                    await window.Gaigai.VM.syncSummaryToBook(true);
                }

                // 7. 刷新界面
                if ($('#gai-main-pop').length > 0) window.Gaigai.shw();

                console.log(`✅ [大总结] 完成: ${start}-${end}`);
            } catch (error) {
                console.error('❌ [大总结] 执行失败:', error);
            } finally {
                window.isSummarizing = false;
            }
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

            // ✅ 初始化全局进度状态（用于UI恢复）
            window.Gaigai.summaryBatchProgress = { current: 0, total: batches.length };

            let successCount = 0;
            let failedBatches = [];
            let actualProgress = start; // ✅ 记录实际完成的进度位置

            // 辅助函数：更新按钮外观
            const updateBtn = (text, isRunning) => {
                const $btn = $('#gg_sum_chat-run');
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

                // ✅ 更新全局进度状态
                window.Gaigai.summaryBatchProgress.current = batchNum;

                updateBtn(`🛑 停止 (${batchNum}/${batches.length})`, true);

                try {
                    console.log(`🔄 [分批 ${batchNum}/${batches.length}] 执行中...`);

                    // 调用核心函数，跳过世界书同步
                    const result = await self.callAIForSummary(batch.start, batch.end, mode, silent, true, false, null, true);

                    // 🛑 [熔断检测] 只有用户明确放弃时才终止
                    if (!result || result.success === false) {
                        console.warn(`🛑 [分批总结] 批次 ${batchNum} 用户选择放弃，任务熔断终止。`);
                        if (!silent) await window.Gaigai.customAlert(`第 ${batchNum} 批用户选择放弃。\n\n为防止数据中断，后续任务已自动停止。`, '任务终止');
                        break;
                    }

                    successCount++;
                    actualProgress = batch.end; // ✅ 更新实际完成的进度

                    // ⚡ 优化：只有多批次任务才弹中间进度提示
                    if (silent && typeof toastr !== 'undefined' && batches.length > 1) {
                        toastr.success(`进度: ${batchNum}/${batches.length} 已保存`, '分批总结');
                    }

                } catch (error) {
                    // ✨✨✨ 修复：如果用户已经点了停止，直接退出，不要弹窗问废话
                    if (window.Gaigai.stopBatch) {
                        console.warn(`🛑 [分批总结] 检测到用户停止，跳过异常弹窗`);
                        break; 
                    }

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

                // ⏳ [稳定性等待] 强制等待 6 秒（与追溯保持一致，适配 thinking 模型）
                console.log(`⏳ [批次缓冲] 等待数据完全落盘 (6秒)...`);
                // 🛑 分秒检查停止标志，确保及时响应
                for (let delay = 6; delay > 0; delay--) {
                    if (window.Gaigai.stopBatch) break;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // ✅ [分批缓存优化] 循环结束后，一次性同步完整表格到世界书
            if (successCount > 0 && !window.Gaigai.stopBatch) {
                console.log("🚀 [分批总结] 批量任务完成，正在将完整表格镜像同步到世界书...");
                try {
                    await window.Gaigai.syncToWorldInfo(null, true);
                    console.log("✅ [分批总结] 世界书镜像同步完成");
                } catch (error) {
                    console.error("❌ [分批总结] 世界书同步失败:", error);
                }
            }

            // 等待最后一批数据的世界书同步防抖结束
            if (successCount > 0 && !window.Gaigai.stopBatch) {
                console.log('⏳ [分批结束] 正在等待最后一次世界书同步完成 (11s = 5s防抖 + 5s缓冲 + 1s余量)...');
                await new Promise(r => setTimeout(r, 11000));
            }

            // ✅ 任务结束：重置状态
            window.Gaigai.isBatchRunning = false;
            window.Gaigai.stopBatch = false;

            // ✅ 清除全局进度状态
            delete window.Gaigai.summaryBatchProgress;

            // ❌ 已移除：不在内部恢复按钮，由外层调用者统一处理
            // updateBtn('🚀 开始聊天总结', false);

            // 结果汇报
            if (successCount > 0) {
                // ✅ 使用原始索引，而不是对话数量，避免 System 消息导致的索引错位
                API_CONFIG.lastSummaryIndex = actualProgress;
                localStorage.setItem('gg_api', JSON.stringify(API_CONFIG));
                console.log(`✅ [分批总结完成] 指针已更新至: 原始索引 ${actualProgress}`);

                if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') window.Gaigai.saveAllSettingsToCloud();

                window.Gaigai.m.save(false, true); // 批量聊天总结完成后立即保存

                if ($('#edit-last-sum').length) $('#edit-last-sum').val(API_CONFIG.lastSummaryIndex);
                if ($('#man-start').length) $('#man-start').val(API_CONFIG.lastSummaryIndex);
                if ($('#gg_sum_chat-start').length) $('#gg_sum_chat-start').val(API_CONFIG.lastSummaryIndex);
            }

            // ⏳ 【最终缓冲】等待数据完全落盘（防止 UI 刷新时读取到旧数据）
            console.log('⏳ [最终缓冲] 等待数据完全写入硬盘...');
            await new Promise(r => setTimeout(r, 2000));

             if (!window.Gaigai.stopBatch) {
                const msg = failedBatches.length > 0
                    ? `⚠️ 完成，但有 ${failedBatches.length} 批失败`
                    : `✅ 分批总结全部完成`;
                
                if (typeof toastr !== 'undefined') {
                    // 如果有失败，用 warning 颜色；全成功用 success 颜色
                    failedBatches.length > 0 ? toastr.warning(msg) : toastr.success(msg);
                }
            }

            // 刷新主界面
            if ($('#gai-main-pop').length > 0) window.Gaigai.shw();
        }

        /**
         * 🆕 总结优化/润色功能 (重构版 - 支持分批执行)
         * @param {string} target - 目标类型：'all' | 'last' | 'specific' | 'range'
         * @param {string} userPrompt - 用户的优化建议
         * @param {string} rangeInput - 范围输入（如 "1" 或 "2-5"）
         */
        async optimizeSummary(target, userPrompt, rangeInput = "1") {
            // 1. 确保配置最新
            const loadConfig = window.Gaigai.loadConfig || (() => Promise.resolve());
            await loadConfig();

            // ✅ 2. 上锁（防止重复点击）
            if (window.Gaigai.isOptimizationRunning) {
                console.log('⚠️ [总结优化] 任务正在执行中，忽略重复点击');
                return;
            }
            window.Gaigai.isOptimizationRunning = true;

            try {
                const m = window.Gaigai.m;
                const ctx = m.ctx();

                // 🛡️ [Safe Guard] Capture session ID at start to prevent data bleeding
                const initialSessionId = m.gid();

                // 读取总结表（动态获取最后一个表格）
                const summaryTable = m.s[m.s.length - 1];
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

            // 🆕 2. 检查是否启用分批模式
            const batchMode = $('#gg_opt_batch_mode').is(':checked');
            const batchStep = parseInt($('#gg_opt_batch_step').val()) || 5;

            if (batchMode && targetIndices.length > batchStep) {
                // 🔄 分批执行模式
                console.log(`📦 [分批优化] 启用分批模式，每批 ${batchStep} 页，共 ${targetIndices.length} 页`);
                await this._optimizeSummaryBatch(targetIndices, userPrompt, batchStep, initialSessionId);
            } else {
                // 🚀 单次执行模式（原有逻辑）
                console.log(`🚀 [单次优化] 一次性处理 ${targetIndices.length} 页`);
                await this._optimizeSummarySingle(targetIndices, userPrompt, initialSessionId);
            }

            } finally {
                // ✅ 无论成功还是失败，最后都要解锁
                window.Gaigai.isOptimizationRunning = false;

                // 如果界面还开着，恢复按钮状态
                const $btn = $('#gg_opt_run');
                if ($btn.length > 0) {
                    $btn.text('✨ 开始优化').prop('disabled', false).css('opacity', 1);
                    $('#gg_opt_status').text('');
                }
                console.log('🔓 [总结优化] 任务结束，已解锁');
            }
        }

        /**
         * 🆕 单次优化执行（原有逻辑）
         * @private
         */
        async _optimizeSummarySingle(targetIndices, userPrompt, initialSessionId) {
            const m = window.Gaigai.m;
            const ctx = m.ctx();
            const summaryTable = m.s[m.s.length - 1];

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
                // ✨✨✨ 修复：加上 name 和 isGaigaiData
                messages.push({
                    role: 'system',
                    name: `SYSTEM (第${idx + 1}页)`, // ✅ 显示页码
                    content: `【待优化内容 - 第 ${idx + 1} 页】\n${fullContent}`,
                    isGaigaiData: true // ✅ 激活探针显示
                });
            });

            // 3. 构建 Prompt 指令
            let coreInstruction = "";
            if (userPrompt && userPrompt.trim()) {
                // 如果用户在弹窗中提供了临时优化建议，优先使用用户的建议
                coreInstruction = userPrompt.trim();
            } else {
                // 如果用户没有提供临时建议，自动调用提示词管理器中的配置
                coreInstruction = window.Gaigai.PromptManager.get('summaryPromptOptimize');
                // 兜底防空保护
                if (!coreInstruction || !coreInstruction.trim()) {
                    coreInstruction = window.Gaigai.PromptManager.DEFAULT_SUM_OPTIMIZE || "请对上述内容进行整合且精简优化，目标是生成类似小说梗概的连贯叙事。";
                }
            }

            // 应用变量替换（支持 {{char}} 等变量）
            coreInstruction = window.Gaigai.PromptManager.resolveVariables(coreInstruction, ctx);

            // ✨ 核心修改：如果是多段优化，强制注入分隔符指令
            let formatInstruction = "";
            if (targetIndices.length > 1) {
                formatInstruction = `\n\n你正在同时优化 ${targetIndices.length} 个页面。请严格按照总结优化提示词进行优化输出。`;
            }

            messages.push({
                role: 'user',
                content: coreInstruction + formatInstruction
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
                const apiFunc = window.Gaigai.config.useIndependentAPI ? window.Gaigai.tools.callIndependentAPI : window.Gaigai.tools.callTavernAPI;
                result = await apiFunc(messages);
            } catch (e) {
                await window.Gaigai.customAlert(`API错误: ${e.message}`, '错误');
                return;
            } finally {
                window.isSummarizing = false;
            }

            // 🛡️ [Safe Guard] Check if session changed during API call
            if (m.gid() !== initialSessionId) {
                console.warn(`🛑 [Safe Guard] Session changed during summary optimization. Aborting.`);
                return { success: false, error: 'session_changed' };
            }

            // 5. 处理结果
            if (result && result.success) {
                const unesc = window.Gaigai.unesc || ((s) => s);
                let rawText = unesc(result.summary || result.text || '').trim();

                // 移除思考过程 (标准成对 + 残缺开头)
                if (rawText.includes('</think>')) {
                    rawText = rawText
                        .replace(/<think>[\s\S]*?<\/think>/gi, '')  // 移除标准成对
                        .replace(/^[\s\S]*?<\/think>/i, '')         // 移除残缺开头
                        .trim();
                }

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
         * 🆕 分批优化执行（重构版：增强的错误处理和停止逻辑）
         * @private
         */
        async _optimizeSummaryBatch(targetIndices, userPrompt, batchStep, initialSessionId) {
            const m = window.Gaigai.m;
            const summaryTable = m.s[m.s.length - 1];

            // 🔒 锁定用户提示词，防止在批次间丢失
            const fixedUserPrompt = userPrompt ? String(userPrompt).trim() : "";
            console.log(`🔒 [分批优化] 已锁定用户提示词，长度: ${fixedUserPrompt.length}`);

            // 将 targetIndices 按步长切分为多个 batch
            const batches = [];
            for (let i = 0; i < targetIndices.length; i += batchStep) {
                batches.push(targetIndices.slice(i, i + batchStep));
            }

            console.log(`📦 [分批优化] 共分为 ${batches.length} 批次`);

            // 辅助函数：更新按钮状态
            const updateBtn = (text, isRunning) => {
                const $btn = $('#gg_opt_run');
                if ($btn.length > 0) {
                    $btn.text(text)
                        .css('background', isRunning ? '#dc3545' : '#ff9800')
                        .css('opacity', '1')
                        .prop('disabled', false);
                }
            };

            const updateStatus = (text, color = null) => {
                const $status = $('#gg_opt_status');
                if ($status.length > 0) {
                    $status.text(text).css(color ? {color} : {});
                }
            };

            let successCount = 0;
            let failedBatches = [];
            let isUserCancelled = false;

            try {
                // 🆕 初始化停止标志
                window.Gaigai.stopOptimizationBatch = false;

                if (typeof toastr !== 'undefined') {
                    toastr.info(`开始执行 ${batches.length} 个批次`, '分批优化');
                }

                // 依次处理每个批次
                for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    // 🛑 检查点 1：任务开始前
                    if (window.Gaigai.stopOptimizationBatch) {
                        isUserCancelled = true;
                        break;
                    }

                    // 冷却逻辑（除了第一批）
                    if (batchIndex > 0) {
                        for (let d = 5; d > 0; d--) {
                            if (window.Gaigai.stopOptimizationBatch) break; // 🛑 检查点 2：冷却期间
                            updateBtn(`⏳ 冷却 ${d}s... (点此停止)`, true);
                            updateStatus(`批次间冷却... ${d}秒`, '#ffc107');
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }

                    if (window.Gaigai.stopOptimizationBatch) {
                        isUserCancelled = true;
                        break;
                    }

                    const currentBatch = batches[batchIndex];
                    const batchNum = batchIndex + 1;
                    const totalBatches = batches.length;

                    // 🆕 更新全局进度变量（用于UI恢复）
                    window.Gaigai.optimizeBatchProgress = {
                        current: batchNum,
                        total: totalBatches
                    };

                    updateBtn(`🛑 停止 (${batchNum}/${totalBatches})`, true);
                    updateStatus(`处理中: 第 ${currentBatch[0] + 1}-${currentBatch[currentBatch.length - 1] + 1} 页`, '#17a2b8');

                    console.log(`📦 [批次 ${batchNum}/${totalBatches}] 处理页码: ${currentBatch.map(i => i + 1).join(', ')}`);

                    // 🔄 重试机制：最多重试1次
                    let retryCount = 0;
                    let lastError = null;
                    let result = null;

                    while (retryCount <= 1) {
                        try {
                            // 调用单次优化逻辑处理当前批次
                            if (fixedUserPrompt) console.log(`📝 [批次 ${batchNum}] 正在应用用户自定义指令...`);
                            await this._optimizeSummarySingle(currentBatch, fixedUserPrompt, initialSessionId);

                            // 🛑 检查点 3：API返回后立即检查
                            if (window.Gaigai.stopOptimizationBatch) {
                                console.warn(`🛑 [分批优化] 任务 ${batchNum} 执行期间被中止`);
                                isUserCancelled = true;
                                break;
                            }

                            // ✅ 成功！跳出重试循环
                            lastError = null;
                            break;

                        } catch (error) {
                            lastError = error;

                            // ✨✨✨ 修复：如果用户已经点了停止，直接退出，不要弹窗
                            if (window.Gaigai.stopOptimizationBatch) {
                                console.warn(`🛑 [分批优化] 检测到用户停止，跳过异常弹窗`);
                                isUserCancelled = true;
                                break;
                            }

                            // 🔄 判断是否需要重试
                            if (retryCount < 1) {
                                retryCount++;
                                console.warn(`⚠️ [重试机制] 批次 ${batchNum} 失败，准备第 ${retryCount} 次重试...`);
                                console.error(`[重试原因] ${error.message}`);

                                updateStatus(`⚠️ 连接不稳定，等待 5秒 后重试...`, '#ffc107');

                                // 等待5秒后重试
                                for (let retrySec = 5; retrySec > 0; retrySec--) {
                                    if (window.Gaigai.stopOptimizationBatch) {
                                        console.warn(`🛑 [重试等待] 检测到用户停止`);
                                        isUserCancelled = true;
                                        break;
                                    }
                                    updateStatus(`⚠️ 连接不稳定，等待 ${retrySec}秒 后重试...`, '#ffc107');
                                    await new Promise(r => setTimeout(r, 1000));
                                }

                                if (window.Gaigai.stopOptimizationBatch) {
                                    isUserCancelled = true;
                                    break;
                                }

                                // 继续下一次循环（重试）
                                continue;
                            } else {
                                // 🚨 重试次数已用完，抛出错误让外层处理
                                console.error(`❌ [重试机制] 批次 ${batchNum} 重试失败，进入异常处理流程`);
                                throw error;
                            }
                        }
                    }

                    // 🛑 如果用户取消，跳出主循环
                    if (isUserCancelled) break;

                    // 🚨 如果重试后仍有错误，弹窗询问用户
                    if (lastError) {
                        console.error(lastError);
                        failedBatches.push({ batch: batchNum, error: lastError.message });

                        const userChoice = await window.Gaigai.customConfirm(
                            `批次 ${batchNum} 发生异常：\n${lastError.message}\n\n是否继续后续批次？`,
                            '异常处理',
                            '继续',
                            '停止'
                        );

                        if (!userChoice) {
                            isUserCancelled = true;
                            break;
                        }
                        continue; // 用户选择继续，跳到下一个批次
                    }

                    // ✅ 批次成功
                    successCount++;

                    // 每批次成功后立即保存
                    m.save();
                    console.log(`✅ [批次 ${batchNum}/${totalBatches}] 完成并已保存`);

                    if (typeof toastr !== 'undefined') {
                        toastr.success(`批次 ${batchNum}/${totalBatches} 完成`, '进度');
                    }

                    // 🛑 检查点 4：冷却前再次检查
                    if (window.Gaigai.stopOptimizationBatch) {
                        isUserCancelled = true;
                        break;
                    }

                    // ⏳ 批次间冷却（除了最后一批）
                    if (batchIndex < batches.length - 1) {
                        console.log(`⏱️ [冷却] 等待 4 秒后继续下一批...`);
                        for (let delay = 4; delay > 0; delay--) {
                            if (window.Gaigai.stopOptimizationBatch) break;
                            updateStatus(`⏱️ 冷却中，${delay}秒后继续...`, '#ff9800');
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }

                    // 🛑 检查点 5：冷却后
                    if (window.Gaigai.stopOptimizationBatch) {
                        isUserCancelled = true;
                        break;
                    }
                }

            } finally {
                // 🛡️ 绝对确保状态重置
                try {
                    window.Gaigai.stopOptimizationBatch = false;
                    delete window.Gaigai.optimizeBatchProgress;

                    // 🛡️ 强制重置按钮状态
                    const $btn = $('#gg_opt_run');
                    if ($btn.length > 0) {
                        $btn.text('✨ 开始优化')
                            .css('background', '#ff9800')
                            .css('opacity', '1')
                            .prop('disabled', false);
                    }

                    console.log('🔓 [状态重置] 分批优化锁已释放');
                } catch (resetError) {
                    console.error('❌ [严重错误] 状态重置失败:', resetError);
                    window.Gaigai.stopOptimizationBatch = false;
                }

                // 结果汇报
                if (isUserCancelled) {
                    updateStatus('', null);
                    if (typeof toastr !== 'undefined') {
                        toastr.info('批量优化已手动停止或取消', '已中止');
                    }
                    return;
                }

                // 保存最终状态
                if (successCount > 0) {
                    m.save(false, true);
                    if (typeof window.Gaigai.updateCurrentSnapshot === 'function') {
                        window.Gaigai.updateCurrentSnapshot();
                    }
                }

                const msg = failedBatches.length > 0
                    ? `⚠️ 完成，但有 ${failedBatches.length} 个批次失败。`
                    : `✅ 全部完成！共处理 ${successCount} 个批次。`;

                if (typeof toastr !== 'undefined') {
                    const isWarning = failedBatches.length > 0;
                    if (isWarning) toastr.warning(msg, '分批优化');
                    else toastr.success(msg, '分批优化');
                }

                updateStatus('✅ 就绪', '#28a745');
                setTimeout(() => updateStatus('', null), 3000);

                if ($('#gai-main-pop').length > 0) window.Gaigai.shw();
            }
        }

        /**
         * 显示优化结果确认弹窗
         * @private
         */
        _showOptimizeConfirm(optimizedContent, targetIndices, originalContent) {
            const self = this;
            const UI = window.Gaigai.ui;
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
                <div class="g-p">
                    <h4>✨ 优化结果确认</h4>
                    <p style="opacity:0.8; font-size:11px; margin-bottom:10px;">
                        AI已完成总结优化，请确认无误后选择保存方式。<br>
                        支持手动修改内容。
                    </p>

                    <div style="margin-bottom: 10px;">
                        <label style="font-size:11px; font-weight:bold; display:block; margin-bottom:4px;">📝 原始内容：</label>
                        <textarea readonly style="width:100%; height:120px; padding:8px; border-radius:4px; font-size:11px; resize:vertical; opacity:0.7;">${window.Gaigai.esc(originalContent)}</textarea>
                    </div>

                    <div style="margin-bottom: 10px;">
                        <label style="font-size:11px; font-weight:bold; display:block; margin-bottom:4px;">✨ 优化后内容：</label>
                        <textarea id="gg_opt_result_editor" style="width:100%; height:250px; padding:10px; border-radius:4px; font-size:12px; font-family:inherit; resize:vertical; line-height:1.6;">${window.Gaigai.esc(optimizedContent)}</textarea>
                    </div>

                    <div style="margin-top:12px; display: flex; gap: 10px;">
                        <button id="gg_opt_cancel" style="padding:8px 16px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">🚫 放弃</button>
                        <button id="gg_opt_append" style="padding:8px 16px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 1;">➕ 追加新行</button>
                        <button id="gg_opt_replace" style="padding:8px 16px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; flex: 2; font-weight:bold;">🔄 覆盖原内容</button>
                    </div>
                </div>
                `;

                $('#gai-optimize-pop').remove();
                const $o = $('<div>', { id: 'gai-optimize-pop', class: 'g-ov', css: { 'z-index': '10000006' } });
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
                    $('#gg_opt_cancel').on('click', () => {
                        $o.remove();
                        resolve({ success: false });
                    });

                    // 追加新行按钮
                    $('#gg_opt_append').on('click', async function() {
                        let finalContent = $('#gg_opt_result_editor').val().trim();
                        if (!finalContent) return;

                        // ✅ 清理优化提示词残留
                        finalContent = finalContent
                            .replace(/^【待优化内容.*?】\s*/gm, '')
                            .replace(/^剧情总结 \d+\s*/gm, '')
                            .replace(/^---+分隔线---+\s*/gm, '')
                            .trim();

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

                        // 🔒 安全检查2：验证总结表存在（动态获取最后一个表格）
                        if (!m.s[m.s.length - 1]) {
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

                        m.save(false, true); // 追加总结后立即保存

                        // ✅✅✅ [新增] 总结优化保存后，触发自动向量化并隐藏总结表所有行
                        if (window.Gaigai.config_obj.autoVectorizeSummary && window.Gaigai.VM && typeof window.Gaigai.VM.syncSummaryToBook === 'function') {
                            try {
                                console.log('⚡ [总结优化] 触发自动向量化同步...');
                                // 强制将当前总结表覆盖同步到知识书，并执行向量化
                                await window.Gaigai.VM.syncSummaryToBook(true);

                                const sumIdx = m.s.length - 1; // 总结表索引
                                const sumSheet = m.get(sumIdx);
                                if (sumSheet && sumSheet.r.length > 0) {
                                    // 遍历所有行进行隐藏标记
                                    for (let ri = 0; ri < sumSheet.r.length; ri++) {
                                        window.Gaigai.markAsSummarized(sumIdx, ri);
                                    }
                                    console.log('⚡ [总结优化] 已自动隐藏总结表所有行');
                                }
                            } catch (vecErr) {
                                console.error('❌ [总结优化] 自动向量化失败:', vecErr);
                            }
                        }

                        if (typeof window.Gaigai.updateCurrentSnapshot === 'function') {
                            window.Gaigai.updateCurrentSnapshot();
                        }

                        await window.Gaigai.customAlert('✅ 优化内容已作为新页追加！', '成功');
                        $o.remove();

                        // 刷新UI
                        if (window.Gaigai.shw) window.Gaigai.shw();

                        resolve({ success: true });
                    });

                    // 覆盖按钮
                    $('#gg_opt_replace').on('click', async function() {
                        let finalContent = $('#gg_opt_result_editor').val().trim();
                        if (!finalContent) return;

                        // ✅ 1. 文本标准化：统一换行符（防止 Windows/Linux 差异）
                        finalContent = finalContent.replace(/\r\n/g, '\n');

                        // ✅ 新增：移除 AI 自动生成的页码标题行，防止干扰分隔符识别
                        // 匹配类似 "【优化后内容 - 第 2 页】" 或 "【第 X 页】" 的行
                        finalContent = finalContent.replace(/^\s*【.*?第\s*\d+\s*页.*?】\s*$/gm, '');

                        // ✅ 清理优化提示词残留（但保留分隔线！）
                        finalContent = finalContent
                            .replace(/^【待优化内容.*?】\s*/gm, '')
                            .replace(/^剧情总结 \d+\s*/gm, '')
                            .trim();

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

                        // 🔒 安全检查2：验证总结表和目标索引（动态获取最后一个表格）
                        const summaryTableIndex = m.s.length - 1;
                        if (!m.s[summaryTableIndex]) {
                            await window.Gaigai.customAlert('🛑 安全拦截：总结表不存在', '错误');
                            return;
                        }

                        // 🔒 安全检查3：验证目标索引在有效范围内
                        for (let idx of targetIndices) {
                            if (idx < 0 || idx >= m.s[summaryTableIndex].r.length) {
                                await window.Gaigai.customAlert(`🛑 安全拦截：页码索引 ${idx} 超出范围`, '错误');
                                return;
                            }
                        }

                        // ✅ 2. 增强分隔符正则：智能拆分（终极版）
                        let segments = [];

                        if (targetIndices.length > 1) {
                            // 多个总结：使用增强正则拆分（兼容各种 AI 输出格式）
                            // 匹配：换行 + (可选空格) + 至少3个符号 + (可选空格) + 分隔线 + (可选空格) + 至少3个符号 + 换行
                            segments = finalContent.split(/\n+\s*[-*=_]{3,}\s*分隔线\s*[-*=_]{3,}\s*\n+/);

                            // 过滤空串
                            segments = segments.map(s => s.trim()).filter(s => s.length > 0);

                            // 兜底策略增强：纯符号分隔符 (如 --- 或 ***)
                            if (segments.length < targetIndices.length) {
                                console.log('⚠️ [智能拆分] 标准分隔线未匹配，尝试纯符号分隔...');
                                // 正则解释：必须是独占一行的至少3个符号，前后有换行
                                const backupSegments = finalContent.split(/\n+\s*[-*=_]{3,}\s*\n+/)
                                    .map(s => s.trim())
                                    .filter(s => s.length > 0);

                                // 只有在备用方案更好时才使用
                                if (backupSegments.length > segments.length) {
                                    console.log(`✅ [智能拆分] 纯符号分隔成功，识别到 ${backupSegments.length} 段`);
                                    segments = backupSegments;
                                }
                            }
                        } else {
                            // 单个总结：整体处理
                            segments = [finalContent];
                        }

                        // ✅ 3. 修复交互逻辑：使用 customConfirm（确保有取消按钮）
                        if (segments.length !== targetIndices.length) {
                            const segCount = segments.length;
                            const targetCount = targetIndices.length;

                            const userConfirmed = await window.Gaigai.customConfirm(
                                `⚠️ 识别到 ${segCount} 段，目标 ${targetCount} 页。\n\n点击确定将按顺序覆盖前 ${Math.min(segCount, targetCount)} 页，多余/不足的将忽略。`,
                                '段落数量不匹配',
                                '确定',
                                '取消'
                            );

                            if (!userConfirmed) {
                                console.log('用户取消了覆盖操作');
                                return;
                            }
                        }

                        // ✅ 4. 修正写入与统计
                        let realUpdateCount = 0;

                        targetIndices.forEach((idx, i) => {
                            // 没内容就不覆盖
                            if (i >= segments.length) return;

                            let segment = segments[i].trim();
                            if (!segment) return;

                            // ✅ 清理优化提示词残留（针对每个段落）
                            segment = segment
                                .replace(/^【待优化内容.*?】\s*/gm, '')
                                .replace(/^剧情总结 \d+\s*/gm, '')
                                .replace(/^---+分隔线---+\s*/gm, '')
                                .trim();

                            if (!segment) return;

                            // 获取原标题 (保留原标题，防止元数据丢失)
                            let originalTitle = '';
                            if (m.s[summaryTableIndex] && m.s[summaryTableIndex].r[idx]) {
                                originalTitle = m.s[summaryTableIndex].r[idx][0];
                            }

                            // 如果原标题为空，给个默认值
                            const newTitle = originalTitle || '剧情总结 (优化版)';

                            // 将 AI 返回的全部内容放入正文
                            const newContent = segment;

                            // 执行写入
                            if (m.s[summaryTableIndex].r[idx]) {
                                m.s[summaryTableIndex].r[idx][0] = newTitle;   // 第0列：标题
                                m.s[summaryTableIndex].r[idx][1] = newContent; // 第1列：正文
                                realUpdateCount++; // 统计实际更新数量
                            }
                        });

                        // 🔒 安全检查4：保存前再次验证会话ID
                        const finalSessionId = m.gid();
                        if (finalSessionId !== initialSessionId) {
                            console.error(`🛑 [安全拦截] 会话ID不一致！弹窗打开: ${initialSessionId}, 保存前: ${finalSessionId}`);
                            await window.Gaigai.customAlert('🛑 安全拦截：检测到会话切换，已取消操作', '错误');
                            return;
                        }

                        console.log(`🔒 [安全验证通过] 会话ID: ${finalSessionId}, 实际覆盖 ${realUpdateCount} 页内容`);

                        m.save(false, true); // 总结优化后立即保存

                        // ✅✅✅ [新增] 总结优化保存后，触发自动向量化并隐藏总结表所有行
                        if (window.Gaigai.config_obj.autoVectorizeSummary && window.Gaigai.VM && typeof window.Gaigai.VM.syncSummaryToBook === 'function') {
                            try {
                                console.log('⚡ [总结优化] 触发自动向量化同步...');
                                // 强制将当前总结表覆盖同步到知识书，并执行向量化
                                await window.Gaigai.VM.syncSummaryToBook(true);

                                const sumIdx = m.s.length - 1; // 总结表索引
                                const sumSheet = m.get(sumIdx);
                                if (sumSheet && sumSheet.r.length > 0) {
                                    // 遍历所有行进行隐藏标记
                                    for (let ri = 0; ri < sumSheet.r.length; ri++) {
                                        window.Gaigai.markAsSummarized(sumIdx, ri);
                                    }
                                    console.log('⚡ [总结优化] 已自动隐藏总结表所有行');
                                }
                            } catch (vecErr) {
                                console.error('❌ [总结优化] 自动向量化失败:', vecErr);
                            }
                        }

                        if (typeof window.Gaigai.updateCurrentSnapshot === 'function') {
                            window.Gaigai.updateCurrentSnapshot();
                        }

                        await window.Gaigai.customAlert(`✅ 已成功覆盖 ${realUpdateCount} 页内容！`, '成功');
                        $o.remove();

                        // 刷新UI
                        if (window.Gaigai.shw) window.Gaigai.shw();

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
