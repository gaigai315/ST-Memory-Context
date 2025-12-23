/**
 * ⚡ Gaigai记忆插件 - 世界书同步模块
 *
 * 功能：处理记忆总结与 SillyTavern 世界书的同步和绑定
 * 包含：防抖同步、智能创建/更新、自动绑定角色卡
 *
 * @version 1.4.6
 * @author Gaigai Team
 */

(function() {
    'use strict';

    class WorldInfoManager {
        constructor() {
            // 世界书同步相关变量
            this.syncDebounceTimer = null;
            this.globalLastWorldInfoUid = -1;
            this.globalWorldInfoEntriesCache = {};
            this.worldInfoSyncQueue = Promise.resolve();

            console.log('✅ [WorldInfoManager] 初始化完成');
        }

        /**
         * 🔍 智能同步世界书 (自动判断创建/更新模式)
         * @param {string} worldBookName - 世界书名称
         * @param {Object} importEntries - 要同步的条目数据
         * @param {string} csrfToken - CSRF令牌
         * @returns {Promise<Object>} - 同步结果 {mode: 'create'|'update'|'error', success: boolean}
         */
        async smartSyncWorldInfo(worldBookName, importEntries, csrfToken) {
            try {
                // 步骤1：检查书是否已存在
                let bookExists = false;

                // 方法A：检查内存（最快）
                if (typeof window.world_info !== 'undefined' && window.world_info[worldBookName]) {
                    bookExists = true;
                    console.log(`✅ [智能同步] 内存检测: 书已存在`);
                }

                // 方法B：API检查（更准确）
                if (!bookExists) {
                    try {
                        const getRes = await fetch('/api/worldinfo/get', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                            body: JSON.stringify({})
                        });
                        if (getRes.ok) {
                            const allWorldBooks = await getRes.json();
                            bookExists = Array.isArray(allWorldBooks) && allWorldBooks.includes(worldBookName);
                            console.log(`✅ [智能同步] API检测: 书${bookExists ? '已存在' : '不存在'}`);
                        }
                    } catch (e) {
                        console.warn('⚠️ [智能同步] API检测失败，回退到创建模式');
                    }
                }

                // 步骤2：根据存在状态选择同步策略
                if (bookExists) {
                    // ==================== 更新模式：内存热更新 + API保存 ====================
                    console.log('⚡ [智能同步] 使用【热更新模式】- 不触发UI重复加载');

                    // 2.1 更新内存数据
                    if (typeof window.world_info !== 'undefined' && window.world_info[worldBookName]) {
                        window.world_info[worldBookName].entries = importEntries;
                        console.log('✅ [智能同步] 内存数据已更新');
                    }

                    // 2.2 调用API保存到硬盘
                    const finalJson = { entries: importEntries, name: worldBookName };
                    const saveRes = await fetch('/api/worldinfo/edit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify({ name: worldBookName, data: finalJson })
                    });

                    if (saveRes.ok) {
                        console.log('💾 [智能同步] 硬盘保存成功 (API模式)');
                        return { mode: 'update', success: true };
                    } else {
                        throw new Error(`API保存失败: ${saveRes.status}`);
                    }

                } else {
                    // ==================== 创建模式：模拟文件上传 ====================
                    console.log('📤 [智能同步] 使用【上传模式】- 首次创建，触发UI刷新');

                    const finalJson = { entries: importEntries };
                    const $fileInput = $('#world_import_file');

                    if ($fileInput.length === 0) {
                        throw new Error('未找到上传控件 #world_import_file');
                    }

                    const file = new File([JSON.stringify(finalJson)], `${worldBookName}.json`, { type: "application/json" });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    $fileInput[0].files = dataTransfer.files;
                    $fileInput[0].dispatchEvent(new Event('change', { bubbles: true }));

                    console.log('✅ [智能同步] 上传触发成功，等待ST处理...');
                    return { mode: 'create', success: true };
                }

            } catch (error) {
                console.error('❌ [智能同步] 异常:', error);
                return { mode: 'error', success: false, error: error.message };
            }
        }

        /**
         * 🌐 同步总结到世界书 (V7.0 追加/覆盖双模式版)
         * 特点：防抖(5s) -> 强制等待(3s) -> 智能检测是否已存在 -> 选择同步策略
         * @param {string} content - 总结内容（可选，不传则自动读取表格）
         * @param {boolean} isForce - 是否强制覆盖模式（默认 false 为追加模式）
         * @returns {Promise<void>}
         */
        async syncToWorldInfo(content = null, isForce = false) {
            const m = window.Gaigai.m;
            const C = window.Gaigai.config_obj;

            // 1. 基础检查
            if (!C || !C.syncWorldInfo) return Promise.resolve();
            if (!m) {
                console.warn('⚠️ [世界书同步] m 对象不存在，跳过同步');
                return Promise.resolve();
            }

            // 2. 防抖：重置倒计时
            if (this.syncDebounceTimer) {
                clearTimeout(this.syncDebounceTimer);
                console.log('⏳ [世界书同步] 倒计时重置 (5s)...');
            }

            // 3. 设置 5秒 防抖 (给AI生成留足时间)
            this.syncDebounceTimer = setTimeout(async () => {
                try {
                    // 🛑 步骤 A: 先进行强制等待 (IO缓冲)
                    // 这里的 5000ms 不仅是为了防文件锁，更是为了让数据彻底落稳
                    console.log('⏳ [IO缓冲] 等待 5秒，确保数据完整并释放锁...');
                    await new Promise(r => setTimeout(r, 5000));

                    // ==================== 🔀 模式分支 ====================
                    if (isForce) {
                        // 📋 强制覆盖模式：读取整个总结表，完全覆盖世界书
                        console.log('🔥 [世界书同步] 模式：强制覆盖（镜像全表）');
                        await this._syncFullTable(m, C);
                    } else if (content && content.trim()) {
                        // ➕ 追加模式：仅追加单条内容，不影响现有条目
                        console.log('➕ [世界书同步] 模式：追加新内容');
                        await this._syncAppendContent(content, m, C);
                    } else {
                        // 🔄 默认行为：如果没有 content 且未强制覆盖，读取表格同步
                        console.log('🔄 [世界书同步] 模式：默认（读取表格镜像）');
                        await this._syncFullTable(m, C);
                    }

                } catch (error) {
                    console.error('❌ [世界书同步] 异常:', error);
                }
            }, 5000); // 5秒防抖

            return Promise.resolve();
        }

        /**
         * 🔥 私有方法：强制覆盖模式（读取整个总结表，覆盖世界书）
         * @private
         */
        async _syncFullTable(m, C) {
            try {
                // 🔄 步骤 B: 等待结束后，再获取表格数据！(关键修改)
                // 这样能确保我们读到的是等待结束后的最新、最全的数据
                const summarySheet = m.get(m.s.length - 1); // 动态获取最后一个表格（总结表）
                if (!summarySheet || summarySheet.r.length === 0) {
                    console.log('⚠️ [世界书同步] 表格为空，跳过');
                    return;
                }

                console.log(`⚡ [世界书同步-覆盖] 开始打包 ${summarySheet.r.length} 条数据...`);

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

                // 🔥 关键修复：上传文件只需要 entries，不需要 name 包装（根据V10测试结果）
                const finalJson = { entries: importEntries };

                // 获取 CSRF
                let csrfToken = '';
                try {
                    csrfToken = await window.Gaigai.getCsrfToken();
                } catch (e) {
                    console.warn('⚠️ [世界书同步-覆盖] 获取CSRF Token失败:', e);
                }

                // --- 4. 扫描并删除当前会话的旧版本文件 (严格筛选，不影响其他角色) ---
                console.log('🔍 [世界书同步-覆盖] 扫描并清理旧文件...');
                try {
                    // 4.1 获取服务器上所有的世界书列表
                    const getRes = await fetch('/api/worldinfo/get', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify({})
                    });

                    if (getRes.ok) {
                        const allWorldBooks = await getRes.json();

                        // 4.2 严格筛选：只删除当前会话的旧版本文件
                        const filesToDelete = [];

                        if (Array.isArray(allWorldBooks)) {
                            allWorldBooks.forEach(fileName => {
                                if (typeof fileName === 'string' &&
                                    fileName.startsWith('Memory_Context_') &&  // 必须是记忆书
                                    fileName.includes(safeName) &&              // 必须包含当前会话ID
                                    fileName !== worldBookName) {               // 不能是即将上传的新文件
                                    filesToDelete.push(fileName);
                                }
                            });
                        }

                        console.log(`📋 [世界书同步-覆盖] 找到 ${filesToDelete.length} 个旧文件需要清理:`, filesToDelete);

                        // 4.3 使用 Promise.all 并发删除所有旧文件，等待全部完成
                        if (filesToDelete.length > 0) {
                            const deletePromises = filesToDelete.map(async (oldBookName) => {
                                try {
                                    const delRes = await fetch('/api/worldinfo/delete', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                                        body: JSON.stringify({ name: oldBookName })
                                    });

                                    if (delRes.ok) {
                                        console.log(`✅ [世界书同步-覆盖] 已删除旧文件: ${oldBookName}`);
                                        return { success: true, name: oldBookName };
                                    } else {
                                        console.warn(`⚠️ [世界书同步-覆盖] 删除 ${oldBookName} 失败 (${delRes.status})`);
                                        return { success: false, name: oldBookName, status: delRes.status };
                                    }
                                } catch (delErr) {
                                    console.warn(`⚠️ [世界书同步-覆盖] 删除 ${oldBookName} 异常:`, delErr);
                                    return { success: false, name: oldBookName, error: delErr.message };
                                }
                            });

                            // 等待所有删除操作完成
                            const deleteResults = await Promise.all(deletePromises);
                            const successCount = deleteResults.filter(r => r.success).length;
                            console.log(`🧹 [世界书同步-覆盖] 清理完成: ${successCount}/${filesToDelete.length} 个文件已删除`);
                        } else {
                            console.log('✨ [世界书同步-覆盖] 没有旧文件需要清理');
                        }
                    } else {
                        console.warn(`⚠️ [世界书同步-覆盖] 获取世界书列表失败 (${getRes.status})，跳过清理`);
                    }
                } catch (e) {
                    console.warn('⚠️ [世界书同步-覆盖] 扫描清理过程异常，继续上传:', e);
                }

                // 🛑 核心修复：给文件系统喘息时间，防止 500 错误导致的连带写入失败
                console.log('⏳ [IO缓冲] 等待文件句柄释放 (1.5s)...');
                await new Promise(r => setTimeout(r, 1500));

                // --- 5. 智能同步 (自动判断创建/更新，防止幽灵条目) ---
                console.log('⚡ [世界书同步-覆盖] 准备智能同步，条目数:', Object.keys(importEntries).length);
                const syncResult = await this.smartSyncWorldInfo(worldBookName, importEntries, csrfToken);

                // 更新缓存
                this.globalWorldInfoEntriesCache = importEntries;
                this.globalLastWorldInfoUid = maxUid;

                // 🛑 步骤 C: 等待 ST 处理 (只有首次创建需要等待UI刷新)
                if (syncResult.mode === 'create') {
                    console.log('⏳ [世界书同步-覆盖] 首次创建，等待 SillyTavern 处理导入 (2s)...');
                    await new Promise(r => setTimeout(r, 2000));
                } else if (syncResult.mode === 'update') {
                    console.log('✅ [世界书同步-覆盖] 热更新完成，无需等待UI刷新');
                }

                // ✨ 自动绑定到角色卡 (只有开启了自动绑定才执行)
                if (C.autoBindWI) {
                    console.log('🔗 [世界书同步-覆盖] 准备自动绑定到角色卡...');
                    await this.autoBindWorldInfo(worldBookName);
                } else {
                    console.log('⏭️ [世界书同步-覆盖] 自动绑定已禁用，跳过绑定');
                }

            } catch (error) {
                console.error('❌ [世界书同步-覆盖] 异常:', error);
            }
        }

        /**
         * ➕ 私有方法：追加模式（仅追加新内容，不影响现有条目）
         * @private
         * @param {string} content - 要追加的总结内容
         * @param {Object} m - Memory 对象
         * @param {Object} C - 配置对象
         */
        async _syncAppendContent(content, m, C) {
            try {
                // --- 准备基础数据 ---
                const uniqueId = m.gid() || "Unknown_Chat";
                const safeName = uniqueId.replace(/[\\/:*?"<>|]/g, "_");
                const worldBookName = "Memory_Context_" + safeName;

                // 获取 CSRF
                let csrfToken = '';
                try {
                    csrfToken = await window.Gaigai.getCsrfToken();
                } catch (e) {
                    console.warn('⚠️ [世界书同步-追加] 获取CSRF Token失败:', e);
                }

                // --- 1. 获取现有世界书数据 ---
                console.log(`🔍 [世界书同步-追加] 尝试读取现有世界书: ${worldBookName}`);
                let existingEntries = {};
                let maxExistingUid = -1;

                try {
                    const getRes = await fetch('/api/worldinfo/get', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify({ name: worldBookName })
                    });

                    if (getRes.ok) {
                        const bookData = await getRes.json();

                        // 解析现有条目
                        if (bookData && bookData.entries && typeof bookData.entries === 'object') {
                            existingEntries = bookData.entries;

                            // 计算现有最大 UID
                            Object.keys(existingEntries).forEach(key => {
                                const uid = parseInt(key);
                                if (!isNaN(uid) && uid > maxExistingUid) {
                                    maxExistingUid = uid;
                                }
                            });

                            console.log(`✅ [世界书同步-追加] 找到现有条目 ${Object.keys(existingEntries).length} 条，最大UID: ${maxExistingUid}`);
                        } else {
                            console.log('📝 [世界书同步-追加] 世界书存在但无条目，将创建第一条');
                        }
                    } else if (getRes.status === 404) {
                        console.log('📝 [世界书同步-追加] 世界书不存在，将创建新书');
                    } else {
                        console.warn(`⚠️ [世界书同步-追加] 获取世界书失败 (${getRes.status})，将创建新书`);
                    }
                } catch (e) {
                    console.warn('⚠️ [世界书同步-追加] 读取现有数据异常，将创建新书:', e);
                }

                // --- 2. 构建新条目 ---
                const newUid = maxExistingUid + 1;
                const newEntry = {
                    uid: newUid,
                    key: ["总结", "summary", "前情提要", "memory", "记忆"],
                    keysecondary: [],
                    comment: `[绑定对话: ${safeName}] 追加于 ${new Date().toLocaleString()}`,
                    content: content,
                    constant: true,
                    vectorized: false,
                    enabled: true,
                    position: 1,
                    order: 100,
                    extensions: { position: 1, exclude_recursion: false, display_index: 0, probability: 100, useProbability: true }
                };

                // --- 3. 合并条目 ---
                const mergedEntries = { ...existingEntries, [newUid]: newEntry };
                console.log(`➕ [世界书同步-追加] 新增条目 UID ${newUid}，总条目数: ${Object.keys(mergedEntries).length}`);

                // --- 4. 同步到服务器（始终使用智能同步，避免 UI 重复刷新）---
                console.log('⚡ [世界书同步-追加] 准备同步到服务器...');
                const syncResult = await this.smartSyncWorldInfo(worldBookName, mergedEntries, csrfToken);

                // 更新缓存
                this.globalWorldInfoEntriesCache = mergedEntries;
                this.globalLastWorldInfoUid = newUid;

                // 🛑 等待 ST 处理 (只有首次创建需要等待UI刷新)
                if (syncResult.mode === 'create') {
                    console.log('⏳ [世界书同步-追加] 首次创建，等待 SillyTavern 处理导入 (2s)...');
                    await new Promise(r => setTimeout(r, 2000));
                } else if (syncResult.mode === 'update') {
                    console.log('✅ [世界书同步-追加] 热更新完成，无需等待UI刷新');
                }

                // ✨ 自动绑定到角色卡 (只有开启了自动绑定才执行)
                if (C.autoBindWI) {
                    console.log('🔗 [世界书同步-追加] 准备自动绑定到角色卡...');
                    await this.autoBindWorldInfo(worldBookName);
                } else {
                    console.log('⏭️ [世界书同步-追加] 自动绑定已禁用，跳过绑定');
                }

                console.log('✅ [世界书同步-追加] 追加操作完成');

            } catch (error) {
                console.error('❌ [世界书同步-追加] 异常:', error);
            }
        }

        /**
         * 🔗 自动绑定记忆世界书 (V5.0 逻辑回归+去重修正版)
         * 恢复了原版的库存检查逻辑，同时加入了强力的UI去重
         * @param {string} baseBookName - 指定要绑定的书名（可选）
         * @param {boolean} forceBind - 强制绑定（即使书不存在也添加）
         * @returns {Promise<void>}
         */
        async autoBindWorldInfo(baseBookName = null, forceBind = false) {
            // ✅ 修复：获取全局配置对象
            const C = window.Gaigai.config_obj;

            if (!C || !C.autoBindWI) return;

            const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext)
                ? SillyTavern.getContext()
                : null;

            if (!ctx) return;

            try {
                // ==================== 🕵️‍♂️ 步骤1：恢复库存检查 (找回丢失的逻辑) ====================
                // 我们必须先知道酒馆里到底有哪些书，才能决定绑谁，不能瞎猜
                let allBookNames = [];

                // A. 从下拉框获取
                $('#world_editor_select option').each(function() {
                    const name = $(this).text().trim();
                    if (name && name !== '新建' && !name.includes('---')) {
                        allBookNames.push(name);
                    }
                });

                // B. 从全局变量获取 (双重保险)
                try {
                    if (typeof window.world_names !== 'undefined' && Array.isArray(window.world_names)) {
                        allBookNames = [...new Set([...allBookNames, ...window.world_names])];
                    } else if (typeof window.world_info === 'object') {
                        // 兼容不同版本的酒馆数据结构
                        if (Array.isArray(window.world_info)) allBookNames.push(...window.world_info.map(b => b.name || b));
                        else allBookNames.push(...Object.keys(window.world_info));
                    }
                } catch(e) {}

                allBookNames = [...new Set(allBookNames)]; // 去重

                // ==================== 🎯 步骤2：锁定目标 (精准匹配) ====================
                let targetBookName = null;

                if (baseBookName) {
                    targetBookName = baseBookName;
                } else {
                    // ✅ 修复1：使用统一的 m.gid() 确保 ID 一致性
                    const m = window.Gaigai.m;
                    const uniqueId = m ? m.gid() : null;

                    if (uniqueId) {
                        // 尝试匹配：优先匹配包含 ID 且存在于 allBookNames 里的书
                        const safeName = uniqueId.replace(/[\\/:*?"<>|]/g, "_");

                        // 1. 优先找包含时间戳的精准匹配
                        const timeMatch = uniqueId.match(/\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s/);
                        if (timeMatch) {
                            targetBookName = allBookNames.find(b => b.includes(timeMatch[0]) && b.startsWith('Memory_Context_'));
                        }

                        // 2. 如果没找到，找包含 safeName 的最新一本
                        if (!targetBookName) {
                            const candidates = allBookNames.filter(b => b.includes(safeName) && b.startsWith('Memory_Context_'));
                            if (candidates.length > 0) {
                                candidates.sort(); // 按时间排序
                                targetBookName = candidates[candidates.length - 1]; // 取最新的
                            }
                        }
                    }
                }

                // ==================== 🧹 步骤3-6：数据清洗 (严厉模式) ====================

                const charId = ctx.characterId;
                if (charId === undefined || charId === null) return;
                const character = ctx.characters[charId];
                if (!character || !character.data) return;

                if (!character.data.extensions) character.data.extensions = {};
                if (!Array.isArray(character.data.extensions.world_info)) character.data.extensions.world_info = [];

                let currentList = character.data.extensions.world_info;
                const cleanList = [];

                // 核心逻辑：只保留非记忆书 + 当前目标书
                // 其他所有的 Memory_Context_ (无论是旧的、别的角色的) 统统丢弃
                currentList.forEach(book => {
                    if (typeof book !== 'string' || !book.startsWith('Memory_Context_')) {
                        cleanList.push(book); // 保留用户自己的书
                    } else if (book === targetBookName) {
                        cleanList.push(book); // 保留当前正主
                    }
                    // else: 丢弃！(解决你说的"绑定了其他角色卡世界书"的问题)
                });

                // 如果目标书存在(已生成)且没在列表里，加进去
                // 这里用 allBookNames 校验，防止绑定不存在的书报错
                if (targetBookName && !cleanList.includes(targetBookName)) {
                    if (allBookNames.includes(targetBookName) || forceBind) {
                        cleanList.push(targetBookName);
                        // console.log(`✅ [自动绑定] 挂载新书: ${targetBookName}`);
                    }
                }

                // 保存数据
                const newJson = JSON.stringify(cleanList.slice().sort());
                const oldJson = JSON.stringify(currentList.slice().sort());

                if (newJson !== oldJson) {
                    character.data.extensions.world_info = cleanList;
                    if (ctx.characters && ctx.characters[charId]) {
                        ctx.characters[charId].data.extensions.world_info = cleanList;
                    }
                    try {
                        if (typeof ctx.saveCharacter === 'function') await ctx.saveCharacter();
                        else if (typeof window.saveCharacterDebounced === 'function') window.saveCharacterDebounced();
                    } catch (e) {}
                }

                // ==================== 🛡️ 步骤7：UI 标准刷新 (V6.0 防幽灵绑定版) ====================
                // 只更新选中状态，不暴力删除/添加 DOM 节点（除非是真正的重复项）

                const $characterSelect = $('.character_extra_world_info_selector');
                if ($characterSelect.length > 0) {
                    // 获取当前下拉框中的所有选项值
                    const existingOptions = new Set();
                    const duplicates = [];

                    $characterSelect.find('option').each(function() {
                        const $opt = $(this);
                        const optVal = $opt.val();

                        // 1. 标记真正的重复项 (同名选项出现多次)
                        if (existingOptions.has(optVal)) {
                            duplicates.push($opt);
                            return; // 继续下一次循环
                        }
                        existingOptions.add(optVal);

                        // 2. 🔥 [新增] 强力清洗：物理删除不属于当前会话的记忆书选项
                        // 逻辑：如果它是记忆书(Memory_Context_开头)，但不在我们要保留的 cleanList 里，说明是残留项，直接标记删除！
                        if (optVal && typeof optVal === 'string' && optVal.startsWith('Memory_Context_') && !cleanList.includes(optVal)) {
                            console.log(`🔥 [UI强力清洗] 标记移除过期/无关选项: ${optVal}`);
                            duplicates.push($opt);
                        }
                    });

                    // 删除重复项和过期的记忆书（统一处理）
                    // ✅ 修复2：删除前清除 selected 属性，防止 Select2 幽灵缓存
                    duplicates.forEach($opt => {
                        console.log(`🧹 [自动绑定] 移除选项: ${$opt.val()}`);
                        $opt.removeAttr('selected');  // 先清除选中状态
                        $opt.remove();                 // 再物理删除节点
                    });

                    // 如果目标书不在下拉框里（新创建的书），临时添加一个 Option
                    // 这样 Select2 才能正确选中它
                    if (targetBookName && !existingOptions.has(targetBookName)) {
                        console.log(`➕ [自动绑定] 添加新选项: ${targetBookName}`);
                        const newOption = new Option(targetBookName, targetBookName, true, true);
                        $characterSelect.append(newOption);
                    }

                    // 🔑 关键修复：强制清空并重新设置选中状态
                    // 步骤1：先完全清空所有选中状态（包括 Select2 的内部缓存）
                    $characterSelect.val(null).trigger('change');
                    console.log('🧹 [自动绑定] 已清空所有选中状态');

                    // 步骤2：使用 Select2 标准方法重新设置选中值
                    $characterSelect.val(cleanList).trigger('change');

                    // 步骤3：延时再触发一次 Select2 内部更新，确保视觉同步
                    setTimeout(() => {
                        $characterSelect.trigger('change.select2');
                    }, 100);

                    console.log(`✅ [自动绑定] UI更新完成，当前绑定:`, cleanList);
                }

            } catch (error) {
                console.error('❌ [自动绑定] 异常:', error);
            }
        }

        /**
         * 重置世界书同步状态（在会话切换时调用）
         */
        resetState() {
            this.globalWorldInfoEntriesCache = {};
            this.globalLastWorldInfoUid = -1;
            this.worldInfoSyncQueue = Promise.resolve();

            if (this.syncDebounceTimer) {
                clearTimeout(this.syncDebounceTimer);
                this.syncDebounceTimer = null;
            }

            console.log('🔄 [WorldInfoManager] 状态已重置');
        }
    }

    // 挂载到 window.Gaigai.WI 命名空间
    if (!window.Gaigai) window.Gaigai = {};
    window.Gaigai.WI = new WorldInfoManager();

    console.log('✅ [WorldInfoManager] 已挂载到 window.Gaigai.WI');
})();
