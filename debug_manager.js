/**
 * ⚡ Gaigai记忆插件 - 调试管理模块
 *
 * 功能：提供调试和维护工具（清除缓存、重置配置等）
 *
 * @version 1.5.6
 * @author Gaigai Team
 */

(function() {
    'use strict';

    class DebugManager {
        constructor() {
            console.log('✅ [DebugManager] 初始化完成');
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
    }

    // 挂载到 window.Gaigai
    if (!window.Gaigai) {
        window.Gaigai = {};
    }
    window.Gaigai.DebugManager = new DebugManager();
    console.log('✅ [DebugManager] 已挂载到 window.Gaigai.DebugManager');
})();
