/**
 * ⚡ Gaigai记忆插件 - 世界书同步模块
 *
 * 功能：处理记忆总结与 SillyTavern 世界书的同步和绑定
 * 包含：防抖同步、智能创建/更新、自动绑定角色卡
 *
 * @version 1.8.3
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
         * 🧼 [辅助方法] 获取稳定的世界书名称 (去除 Branch 后缀)
         * 目的：让主线和所有分支共用同一个世界书文件，防止文件爆炸
         */
        _getStableBookName(gid) {
            // ✅ 检查是否有自定义书名
            if (window.Gaigai && window.Gaigai.m && window.Gaigai.m.wiConfig && window.Gaigai.m.wiConfig.bookName) {
                const customName = window.Gaigai.m.wiConfig.bookName.trim();
                if (customName) {
                    console.log(`📚 [世界书] 使用自定义名称: ${customName}`);
                    return customName;
                }
            }

            // ⚙️ 使用默认自动生成的名称
            if (!gid) return "Memory_Context_Unknown";
            // 移除 _Branch 及其后面的所有内容
            const stableId = gid.split('_Branch')[0];
            const safeName = stableId.replace(/[\\/:*?"<>|]/g, "_");
            return "Memory_Context_" + safeName;
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

                // 🚫 [已移除] API 存在性检测已移除。原因：酒馆后端 API 不支持查询列表 (400 Error)。策略调整为：不再探测，直接执行文件上传（Create Mode），利用酒馆的同名覆盖机制。

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
                        body: JSON.stringify({ name: worldBookName, data: finalJson }),
                        credentials: 'include'
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
                const worldBookName = this._getStableBookName(m.gid());
                const uniqueId = m.gid() || "Unknown_Chat";
                const safeName = uniqueId.replace(/[\\/:*?"<>|]/g, "_");
                const importEntries = {};
                let maxUid = -1;

                // 构建全量数据
                summarySheet.r.forEach((row, index) => {
                    const uid = index;
                    maxUid = uid;
                    const title = row[0] || '无标题';
                    const rowContent = row[1] || '';
                    const note = (row[2] && row[2].trim()) ? row[2].trim() : '';

                    // ✅ 智能引用表格备注作为前缀
                    let displayTitle = title;
                    if (note) {
                        displayTitle = `【${note}】 ${title}`;
                    }

                    importEntries[uid] = {
                        uid: uid,
                        key: ["总结", "summary", "前情提要", "memory", "记忆"],
                        keysecondary: [],
                        comment: displayTitle,
                        content: `【${title}${note ? ' [' + note + ']' : ''}】\n${rowContent}`,
                        constant: false,
                        vectorized: window.Gaigai.config_obj.worldInfoVectorized ?? true,
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

                // 🚫 [已禁用] 自动清理旧文件功能已停用。原因：酒馆后端 API (/api/worldinfo/get) 不支持空参数查询，会导致 400 报错。直接跳过清理步骤，依赖文件名覆盖机制。
                /*
                // --- 4. 扫描并删除当前会话的旧版本文件 (严格筛选，不影响其他角色) ---
                console.log('🔍 [世界书同步-覆盖] 扫描并清理旧文件...');
                try {
                    // 4.1 获取服务器上所有的世界书列表
                    const getRes = await fetch('/api/worldinfo/get', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify({}),
                        credentials: 'include'
                    });

                    if (getRes.ok) {
                        // ✅ [Bug Fix] 先获取原始文本，避免 JSON 解析崩溃
                        const text = await getRes.text();

                        let allWorldBooks;
                        try {
                            allWorldBooks = JSON.parse(text);
                        } catch (e) {
                            console.error('❌ [世界书列表-覆盖] JSON 解析失败:', e.message);
                            console.error('   原始响应 (前200字符):', text.substring(0, 200));
                            throw new Error(`服务器返回非JSON格式\n\n原始响应: ${text.substring(0, 100)}`);
                        }

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
                                        body: JSON.stringify({ name: oldBookName }),
                                        credentials: 'include'
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
                */

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

                    // 📢 提示用户手动绑定世界书
                    if (typeof toastr !== 'undefined') {
                        toastr.info(`世界书 "${worldBookName}" 已创建，请手动在角色卡中绑定`, '世界书同步', { timeOut: 5000 });
                    }
                } else if (syncResult.mode === 'update') {
                    console.log('✅ [世界书同步-覆盖] 热更新完成，无需等待UI刷新');
                }

                // ⚡ 自动化流：触发自动向量化
                if (window.Gaigai.config_obj.autoVectorizeSummary) {
                    if (window.Gaigai.VM && typeof window.Gaigai.VM.syncSummaryToBook === 'function') {
                        console.log('⚡ [自动化流] 世界书同步完成，正在触发自动向量化...');
                        try {
                            await window.Gaigai.VM.syncSummaryToBook(true);
                        } catch (error) {
                            console.error('❌ [自动化流] 自动向量化失败:', error);
                        }
                    }
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
                const worldBookName = this._getStableBookName(m.gid());
                const uniqueId = m.gid() || "Unknown_Chat";
                const safeName = uniqueId.replace(/[\\/:*?"<>|]/g, "_");

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
                        body: JSON.stringify({ name: worldBookName }),
                        credentials: 'include'
                    });

                    if (getRes.ok) {
                        // ✅ [Bug Fix] 先获取原始文本，避免 JSON 解析崩溃
                        const text = await getRes.text();

                        let bookData;
                        try {
                            bookData = JSON.parse(text);
                        } catch (e) {
                            console.error('❌ [世界书数据-追加] JSON 解析失败:', e.message);
                            console.error('   原始响应 (前200字符):', text.substring(0, 200));
                            throw new Error(`服务器返回非JSON格式\n\n原始响应: ${text.substring(0, 100)}`);
                        }

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
                        // ✅ [Critical Fix] 只有 404 才初始化空书
                        console.log('📝 [世界书同步-追加] 世界书不存在 (404)，将创建新书');
                    } else {
                        // 🛑 [Critical Fix] 任何其他错误状态都应该中止操作，防止数据丢失
                        const errorMsg = `服务器错误 (${getRes.status})，中止操作以防止数据丢失`;
                        console.error(`❌ [世界书同步-追加] ${errorMsg}`);
                        throw new Error(errorMsg);
                    }
                } catch (e) {
                    // 🛑 [Critical Fix] 网络异常或其他错误必须抛出，不能静默创建新书
                    console.error('❌ [世界书同步-追加] 读取现有数据失败，中止操作:', e);
                    throw e;
                }

                // --- 2. 构建新条目 ---
                const newUid = maxExistingUid + 1;

                // ✅ 从总结表获取最新的标题和备注
                let displayTitle = `[追加于 ${new Date().toLocaleString()}]`; // Default fallback
                const summarySheet = m.get(m.s.length - 1);

                if (summarySheet && summarySheet.r.length > 0) {
                    // 我们同步的内容对应刚刚保存的最后一行
                    const lastRow = summarySheet.r[summarySheet.r.length - 1];
                    const rowTitle = lastRow[0] || '剧情总结';
                    const rowNote = (lastRow[2] && lastRow[2].trim()) ? lastRow[2].trim() : '';

                    if (rowNote) {
                        displayTitle = `【${rowNote}】 ${rowTitle}`;
                    } else {
                        displayTitle = rowTitle;
                    }
                }

                const newEntry = {
                    uid: newUid,
                    key: ["总结", "summary", "前情提要", "memory", "记忆"],
                    keysecondary: [],
                    comment: displayTitle, // ✅ Use the correct title from table
                    content: content,
                    constant: false,
                    vectorized: window.Gaigai.config_obj.worldInfoVectorized ?? true,
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

                    // 📢 提示用户手动绑定世界书
                    if (typeof toastr !== 'undefined') {
                        toastr.info(`世界书 "${worldBookName}" 已创建，请手动在角色卡中绑定`, '世界书同步', { timeOut: 5000 });
                    }
                } else if (syncResult.mode === 'update') {
                    console.log('✅ [世界书同步-追加] 热更新完成，无需等待UI刷新');
                }

                console.log('✅ [世界书同步-追加] 追加操作完成');

                // ⚡ 自动化流：触发自动向量化
                if (window.Gaigai.config_obj.autoVectorizeSummary) {
                    if (window.Gaigai.VM && typeof window.Gaigai.VM.syncSummaryToBook === 'function') {
                        console.log('⚡ [自动化流] 世界书同步完成，正在触发自动向量化...');
                        try {
                            await window.Gaigai.VM.syncSummaryToBook(true);
                        } catch (error) {
                            console.error('❌ [自动化流] 自动向量化失败:', error);
                        }
                    }
                }

            } catch (error) {
                console.error('❌ [世界书同步-追加] 异常:', error);
            }
        }

        /**
         * 🔗 自动绑定记忆世界书 (已禁用)
         * 此功能已移除，保留空函数体防止外部调用报错
         * @param {string} baseBookName - 指定要绑定的书名（可选）
         * @param {boolean} forceBind - 强制绑定（即使书不存在也添加）
         * @returns {Promise<void>}
         */
        async autoBindWorldInfo(baseBookName = null, forceBind = false) {
            console.log('ℹ️ [自动绑定] 此功能已禁用，请手动在角色卡中绑定世界书');
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

        /**
         * 生成世界书自定义配置 UI
         * @param {Object} config - 配置对象 (即 m.wiConfig)
         * @returns {string} - HTML 字符串
         */
        getSettingsUI(config) {
            const bookName = config?.bookName || '';

            return `
                <div class="gg-wi-settings">
                    <div class="gg-wi-settings-title">
                        📚 世界书自定义设置
                    </div>

                    <div class="gg-wi-field">
                        <label class="gg-wi-label">
                            世界书名称
                        </label>
                        <input
                            type="text"
                            id="gg_wi_book_name"
                            class="gg-wi-input"
                            value="${this._escapeHtml(bookName)}"
                            placeholder="例: 我的冒险传记 (留空则自动生成)"
                        />
                    </div>

                    <div class="gg-wi-tip">
                        💡 提示：世界书条目的标题将自动引用总结表中的【备注】内容作为前缀，方便查找。
                    </div>
                </div>
            `;
        }

        /**
         * HTML 转义辅助函数
         * @param {string} str - 需要转义的字符串
         * @returns {string} - 转义后的字符串
         */
        _escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    }

    // 挂载到 window.Gaigai.WI 命名空间
    if (!window.Gaigai) window.Gaigai = {};
    window.Gaigai.WI = new WorldInfoManager();

    console.log('✅ [WorldInfoManager] 已挂载到 window.Gaigai.WI');
})();
