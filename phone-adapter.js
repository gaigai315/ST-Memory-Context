/**
 * 📱 手机插件适配模块
 *
 * 功能：让记忆插件能够识别和正确显示手机插件的消息
 *
 * 工作原理：
 * 1. 记忆插件的 Fetch Hijack 会在最后覆盖 lastRequestData
 * 2. 此时数据已经被 SillyTavern 压缩（相邻同 role 合并）
 * 3. 本模块劫持 lastRequestData 的 setter，在每次更新时标记手机消息
 *
 * 注意：SillyTavern 可能在 iframe 中运行，需要访问 window.top.Gaigai
 *
 * @version 1.4.0
 */

(function() {
    'use strict';

    // 获取正确的 window 对象（可能在 iframe 中）
    const getTopWindow = () => {
        try {
            return window.top || window;
        } catch (e) {
            return window;
        }
    };

    /**
     * 标记探针数据中的手机消息
     * 由于 SillyTavern 会压缩消息，手机内容可能被合并到其他消息中
     * @param {Array} chat - 消息数组
     * @returns {number} - 标记的消息数量
     */
    function markPhoneMessages(chat) {
        if (!Array.isArray(chat)) return 0;

        let markedCount = 0;
        chat.forEach((msg) => {
            if (!msg || !msg.gaigaiPhoneSignal) return;

            // 标记为手机消息
            msg.isPhoneMessage = true;

            // 只有当没有其他合并标记时才设置 name
            const hasOtherMark = msg.isGaigaiVector || msg.isGaigaiData || msg.isGaigaiPrompt;
            if (!hasOtherMark) {
                const appName = msg.gaigaiPhoneSignal.appName || '手机';
                msg.name = `SYSTEM (${appName})`;
            }

            markedCount++;
        });

        return markedCount;
    }

    /**
     * 注入到记忆插件的探针更新流程
     * 在 lastRequestData 更新时自动处理手机消息
     */
    function hookProbeUpdate() {
        const topWin = getTopWindow();

        // 等待 Gaigai 对象初始化
        const checkGaigai = setInterval(() => {
            if (topWin.Gaigai) {
                clearInterval(checkGaigai);

                // 保存原始值
                let _lastRequestData = topWin.Gaigai.lastRequestData;

                // 劫持 lastRequestData 的 setter
                Object.defineProperty(topWin.Gaigai, 'lastRequestData', {
                    get: function() {
                        return _lastRequestData;
                    },
                    set: function(value) {
                        // 在设置之前，处理手机消息
                        if (value && value.chat) {
                            // 标记手机消息
                            const count = markPhoneMessages(value.chat);
                            if (count > 0) {
                                console.log(`📱 [手机适配] 共标记 ${count} 条包含手机内容的消息`);
                            }
                        }
                        _lastRequestData = value;
                    },
                    configurable: true,
                    enumerable: true
                });

                console.log('✅ [手机适配] 探针钩子已安装 (v1.4.0) - 使用 window.top');
            }
        }, 100);

        // 10秒后停止检查，避免无限循环
        setTimeout(() => clearInterval(checkGaigai), 10000);
    }

    // 初始化
    hookProbeUpdate();
    console.log('📱 [手机适配] 模块已加载 v1.4.0');

})();
