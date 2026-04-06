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

    // 手机消息的识别关键词（新版格式使用【】）
    const PHONE_KEYWORDS = [
        '【手机系统】',
        '【微信消息格式】',
        '【📱 手机微信消息记录】',
        '【📖 相关对话历史（手机引用',
        '【回复指南】',
        '【蜜语 APP 核心生成规则】',
        '请根据蜜语APP提示词生成剧情',
        '---热门推荐---',
        '---激情直播---',
        '<Honey>',
        '</Honey>',
        // 兼容旧版
        '📱 手机',
        '手机微信消息记录',
        'SYSTEM (手机',
        '<wechat to=',
        'wechat status="offline"'
    ];

    /**
     * 检测消息是否包含手机插件内容
     * @param {string} content - 消息内容
     * @returns {boolean}
     */
    function containsPhoneContent(content) {
        if (!content || typeof content !== 'string') return false;
        return PHONE_KEYWORDS.some(keyword => content.includes(keyword));
    }

    /**
     * 标记探针数据中的手机消息
     * 由于 SillyTavern 会压缩消息，手机内容可能被合并到其他消息中
     * @param {Array} chat - 消息数组
     * @returns {number} - 标记的消息数量
     */
    function markPhoneMessages(chat) {
        if (!Array.isArray(chat)) return 0;

        let markedCount = 0;
        chat.forEach((msg, idx) => {
            // 获取消息内容（兼容多种 API 格式）
            const content = msg.content ||
                (msg.parts && msg.parts[0] ? msg.parts[0].text : '') ||
                (msg.text) ||
                '';

            if (containsPhoneContent(content)) {
                // 检查是否已经有其他标记
                const hasOtherMark = msg.isGaigaiVector || msg.isGaigaiData || msg.isGaigaiPrompt;

                // 标记为手机消息
                msg.isPhoneMessage = true;

                // 只有当没有其他标记时才设置 name
                // 如果已经有标记（如 Merged），说明是合并消息，追加手机标识
                if (hasOtherMark) {
                    // 合并消息，在名字后追加
                    if (msg.name && !msg.name.includes('📱')) {
                        msg.name = msg.name.replace(')', ' + 📱手机)');
                    }
                    console.log(`📱 [手机适配] 消息 #${idx} 是合并消息，已追加手机标记: ${msg.name}`);
                } else {
                    // 纯手机消息：仅添加标识，不覆盖原始 role（避免把 USER 误显示成 SYSTEM）
                    const originalRole = String(msg.role || '').toLowerCase();
                    if (originalRole === 'assistant' || originalRole === 'model') {
                        msg.name = 'ASSISTANT (📱手机)';
                    } else if (originalRole === 'user') {
                        msg.name = 'USER (📱手机)';
                    } else if (originalRole === 'system') {
                        msg.name = 'SYSTEM (📱手机)';
                    } else {
                        msg.name = msg.name || '📱手机消息';
                    }
                    console.log(`📱 [手机适配] 消息 #${idx} 已标记为手机消息 (保留原角色: ${msg.role || 'unknown'})`);
                }

                markedCount++;
            }
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
