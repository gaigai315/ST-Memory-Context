/**
 * ⚡ Gaigai记忆插件 - 独立向量检索模块 (图书馆架构)
 *
 * 功能：使用外部 Embedding API 实现语义检索，不依赖酒馆后端
 * 支持：OpenAI、SiliconFlow、Ollama 等兼容 OpenAI API 的服务
 * 新架构：多书架 + 会话绑定系统
 *
 * @version 1.6.2
 * @author Gaigai Team
 */

(function () {
    'use strict';

    // 🗄️ 世界书伪装存储文件名
    const STORAGE_BOOK_NAME = "Memory_Vector_Database";

    class VectorManager {
        constructor() {
            // 📚 图书馆结构（替代旧版 customKnowledge）
            // 格式: { "book_uuid": { name, chunks, vectors, createTime } }
            this.library = {};

            // 文本向量缓存（避免重复计算）
            this.vectorCache = new Map();

            // 正在进行的 API 请求（避免并发重复）
            this.pendingRequests = new Map();

            // UI 状态：当前选中的书籍 ID
            this.selectedBookId = null;

            // 🔒 安全锁：防止数据未加载时误保存
            this.isDataLoaded = false;

            console.log('✅ [VectorManager] 初始化完成 (图书馆架构 + 世界书存储)');

            // 加载图书馆数据（内含数据迁移逻辑）
            this.loadLibrary();

            // 隐藏向量数据库文件的 UI 选项
            this._hideStorageBookFromUI();
        }

        /**
         * 🔄 数据迁移：将旧版 customKnowledge 迁移为"默认知识库"
         * @private
         */
        _migrateOldData() {
            try {
                // 检查 extension_settings 中是否存在旧版数据
                const settings = window.extension_settings || {};
                const gaigaiSettings = settings.st_memory_table || {};

                if (gaigaiSettings.customKnowledge && Array.isArray(gaigaiSettings.customKnowledge) && gaigaiSettings.customKnowledge.length > 0) {
                    console.log('🔄 [数据迁移] 检测到旧版 customKnowledge，开始迁移...');

                    const oldData = gaigaiSettings.customKnowledge;
                    const defaultBookId = this._generateUUID();

                    // 创建默认知识库
                    this.library[defaultBookId] = {
                        name: '默认知识库 (迁移)',
                        chunks: oldData.map(item => item.content || ''),
                        vectors: oldData.map(item => item.vector || null),
                        createTime: Date.now(),
                        vectorized: oldData.map(item => item.vectorized || false)
                    };

                    console.log(`✅ [数据迁移] 已将 ${oldData.length} 条旧数据迁移到"默认知识库"`);

                    // 删除旧数据
                    delete gaigaiSettings.customKnowledge;

                    // 保存迁移后的数据
                    this.saveLibrary();
                }
            } catch (error) {
                console.error('❌ [数据迁移] 迁移失败:', error);
            }
        }

        /**
         * 🆔 生成 UUID
         * @private
         * @returns {string} - UUID 字符串
         */
        _generateUUID() {
            return 'book_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        }

        /**
         * 🕵️‍♂️ UI隐藏：将向量数据库文件从下拉列表中隐藏
         * 防止用户误操作，但不影响 API 调用
         * @private
         */
        _hideStorageBookFromUI() {
            const styleId = 'gg-hide-vector-db';
            if (document.getElementById(styleId)) return;

            const css = `
                /* 隐藏原生下拉框中的选项 */
                option[value="${STORAGE_BOOK_NAME}"],
                /* 隐藏可能存在的自定义列表项 */
                li[data-value="${STORAGE_BOOK_NAME}"],
                /* 隐藏世界书管理界面的特定条目 (如果能匹配到) */
                .world_info_entry[data-uid="${STORAGE_BOOK_NAME}"]
                { display: none !important; }
            `;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);

            console.log('🕵️‍♂️ [VectorManager] 已注入 CSS 隐藏规则');

            // ✅ 启动 DOM 监听，动态隐藏（应对动态渲染场景）
            const observer = new MutationObserver((mutations) => {
                // 扩大查找范围（宽进）：包括 option, li, label 和 .world_info_entry
                const selector = `option, li, .world_info_entry, label`;
                const elements = document.querySelectorAll(selector);

                elements.forEach(el => {
                    let shouldHide = false;

                    // A. 精准属性匹配（最高优先级，最安全）
                    if (el.value === STORAGE_BOOK_NAME ||
                        el.getAttribute('data-uid') === STORAGE_BOOK_NAME ||
                        el.getAttribute('data-name') === STORAGE_BOOK_NAME ||
                        el.getAttribute('data-value') === STORAGE_BOOK_NAME ||
                        el.title === STORAGE_BOOK_NAME) {
                        shouldHide = true;
                    }
                    // B. 文本内容匹配（解决没有ID属性的列表项）
                    else if (el.textContent.includes(STORAGE_BOOK_NAME)) {
                        // 🛡️ 防御机制：防止误伤父级分组（严出）🛡️

                        // 1. 如果它是分组标题，跳过
                        if (el.classList.contains('inline-drawer-header') ||
                            el.classList.contains('binder-header')) {
                            return;
                        }

                        // 2. 如果它里面包含子列表(ul/ol)，说明它是父容器，跳过！
                        // (这是解决"分组消失"问题的关键)
                        if (el.querySelector('ul, ol')) {
                            return;
                        }

                        // 通过了防御检查，说明它是最底层的条目，可以隐藏
                        shouldHide = true;
                    }

                    // 强制隐藏
                    if (shouldHide && el.style.display !== 'none') {
                        el.style.display = 'none';
                        el.style.setProperty('display', 'none', 'important');
                    }
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });

            console.log('🕵️‍♂️ [VectorManager] 已启动 DOM 监听器，实时隐藏数据库 UI 选项');
        }

        /**
         * 💾 保存图书馆数据到世界书存储
         */
        async saveLibrary() {
            // 🛑 安全拦截：数据未加载时禁止保存
            if (!this.isDataLoaded) {
                console.warn('🛑 [安全拦截] 向量数据尚未加载，禁止保存！防止覆盖存档。');
                return;
            }

            try {
                // 获取 CSRF Token
                let csrfToken = '';
                try {
                    if (typeof window.Gaigai?.getCsrfToken === 'function') {
                        csrfToken = await window.Gaigai.getCsrfToken();
                    }
                } catch (e) {
                    console.warn('⚠️ [VectorManager] 获取CSRF Token失败:', e);
                }

                // 将图书馆数据序列化为 JSON 字符串
                const libraryJson = JSON.stringify(this.library);

                // 构造世界书数据结构
                const payload = {
                    name: STORAGE_BOOK_NAME,
                    data: {
                        name: STORAGE_BOOK_NAME,
                        entries: {
                            "0": {
                                uid: 0,
                                key: ["DO_NOT_USE"],
                                keysecondary: [],
                                comment: "Memory 向量数据库 (请勿编辑/启用)",
                                content: libraryJson,
                                constant: false,
                                vectorized: false,
                                enabled: false,  // 前端状态：默认禁用，防止被AI检索到
                                disable: true,   // 后端文件存储状态：强制禁用
                                position: 0,
                                order: 0,
                                extensions: {
                                    position: 0,
                                    exclude_recursion: true,
                                    display_index: 0,
                                    probability: 0,
                                    useProbability: false
                                }
                            }
                        }
                    }
                };

                // 保存到世界书
                const response = await fetch('/api/worldinfo/edit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`世界书API保存失败: ${response.status}`);
                }

                console.log(`💾 [VectorManager] 图书馆数据已保存到世界书: ${STORAGE_BOOK_NAME}`);

                // ✅ 清理旧配置中的数据（防止污染）
                if (window.extension_settings?.st_memory_table?.vectorLibrary) {
                    delete window.extension_settings.st_memory_table.vectorLibrary;
                    console.log('🧹 [VectorManager] 已清理旧配置中的向量数据');
                }

            } catch (error) {
                console.error('❌ [VectorManager] 保存图书馆失败:', error);
            }
        }

        /**
         * 📂 从世界书存储加载图书馆数据
         * @param {Object|null} explicitData - 显式传入的数据（优先使用）
         */
        async loadLibrary(explicitData = null) {
            try {
                // 1. 优先使用传入的显式数据 (改为合并模式)
                if (explicitData && typeof explicitData === 'object') {
                    console.log('🔄 [VectorManager] 合并外部传入的数据...');
                    Object.assign(this.library, explicitData); // 温和合并,不覆盖
                    this.isDataLoaded = true; // ✅ 解锁
                    return;
                }

                // 2. 尝试从世界书 API 加载
                let loadedFromWorldInfo = false;
                try {
                    // 获取 CSRF Token
                    let csrfToken = '';
                    try {
                        if (typeof window.Gaigai?.getCsrfToken === 'function') {
                            csrfToken = await window.Gaigai.getCsrfToken();
                        }
                    } catch (e) {
                        console.warn('⚠️ [VectorManager] 获取CSRF Token失败:', e);
                    }

                    // 请求世界书数据
                    const response = await fetch('/api/worldinfo/get', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({ name: STORAGE_BOOK_NAME })
                    });

                    if (response.ok) {
                        const bookData = await response.json();

                        // 解析世界书中的数据
                        if (bookData && bookData.entries && bookData.entries["0"] && bookData.entries["0"].content) {
                            try {
                                this.library = JSON.parse(bookData.entries["0"].content);
                                console.log(`📂 [VectorManager] 已从世界书加载: ${Object.keys(this.library).length} 本书`);
                                loadedFromWorldInfo = true;
                            } catch (parseError) {
                                console.error('❌ [VectorManager] 解析世界书数据失败:', parseError);
                            }
                        }
                    } else if (response.status === 404) {
                        console.log('📝 [VectorManager] 世界书文件不存在（可能是首次使用）');
                    } else {
                        console.warn(`⚠️ [VectorManager] 获取世界书失败 (${response.status})`);
                    }
                } catch (apiError) {
                    console.warn('⚠️ [VectorManager] 世界书API调用失败:', apiError);
                }

                // 3. 数据迁移：如果世界书没数据，但旧配置有数据，则迁移
                if (!loadedFromWorldInfo) {
                    const settings = window.extension_settings?.st_memory_table || {};
                    if (settings.vectorLibrary && typeof settings.vectorLibrary === 'object' && Object.keys(settings.vectorLibrary).length > 0) {
                        console.log('🔄 [数据迁移] 检测到旧配置中的数据，开始迁移到世界书...');
                        this.library = settings.vectorLibrary;
                        console.log(`📂 [VectorManager] 已加载旧配置数据: ${Object.keys(this.library).length} 本书`);

                        // 标记为已加载，允许保存
                        this.isDataLoaded = true;

                        // 迁移到世界书存储
                        await this.saveLibrary();

                        // 清理旧配置
                        delete settings.vectorLibrary;
                        console.log('✅ [数据迁移] 迁移完成，已清理旧配置');
                    } else {
                        // 完全没有数据，初始化为空
                        this.library = {};
                        console.log('📂 [VectorManager] 图书馆为空 (无数据)');
                    }
                }

                // 无论有没有数据，只要尝试加载过，就视为加载完成
                this.isDataLoaded = true;
                console.log('📂 [VectorManager] 数据加载完毕，允许保存');
            } catch (error) {
                console.error('❌ [VectorManager] 加载图书馆失败:', error);
                this.library = {};
                this.isDataLoaded = true; // 出错也解锁，避免死锁
            }
        }

        /**
         * 📖 获取当前会话绑定的书籍 ID 列表
         * @returns {string[]} - 书籍 ID 数组
         */
        getActiveBooks() {
            try {
                const m = window.Gaigai?.m;
                if (!m) return [];

                const ctx = m.ctx();
                if (!ctx || !ctx.chat) return [];

                // 从 chatMetadata 读取 activeBooks
                const activeBooks = ctx.chatMetadata?.gaigai_activeBooks || [];

                // ✅ 修复：使用 Set 强制去重，防止同一本书被处理多次
                return [...new Set(Array.isArray(activeBooks) ? activeBooks : [])];
            } catch (error) {
                console.error('❌ [VectorManager] 获取 activeBooks 失败:', error);
                return [];
            }
        }

        /**
         * 🔗 设置当前会话绑定的书籍 ID 列表
         * @param {string[]} bookIds - 书籍 ID 数组
         */
        setActiveBooks(bookIds) {
            try {
                const m = window.Gaigai?.m;
                if (!m) {
                    console.error('❌ [VectorManager] Memory Manager 不可用');
                    return;
                }

                const ctx = m.ctx();
                if (!ctx || !ctx.chat) {
                    console.error('❌ [VectorManager] 当前聊天不可用');
                    return;
                }

                // 初始化 chatMetadata
                if (!ctx.chatMetadata) {
                    ctx.chatMetadata = {};
                }

                // 保存到 chatMetadata
                ctx.chatMetadata.gaigai_activeBooks = bookIds;

                // 保存聊天数据
                m.save();

                console.log(`🔗 [VectorManager] 已绑定 ${bookIds.length} 本书到当前会话`);
            } catch (error) {
                console.error('❌ [VectorManager] 设置 activeBooks 失败:', error);
            }
        }

        /**
         * 🔑 获取配置
         * @private
         */
        _getConfig() {
            const C = window.Gaigai?.config_obj || {};
            return {
                provider: C.vectorProvider || 'openai',
                url: C.vectorUrl || '',
                key: C.vectorKey || '',
                model: C.vectorModel || 'BAAI/bge-m3',
                threshold: (C.vectorThreshold !== undefined && C.vectorThreshold !== null && C.vectorThreshold !== '') ? parseFloat(C.vectorThreshold) : 0.3,
                maxCount: parseInt(C.vectorMaxCount) || 10,
                contextDepth: parseInt(C.vectorContextDepth) || 2,
                separator: C.vectorSeparator || '===',
                rerankEnabled: C.rerankEnabled || false,
                rerankUrl: C.rerankUrl || 'https://api.siliconflow.cn/v1/rerank',
                rerankKey: C.rerankKey || '',
                rerankModel: C.rerankModel || 'BAAI/bge-reranker-v2-m3'
            };
        }

        /**
         * 🧮 计算文本的简单 hash（用于缓存）
         * @private
         */
        _hashText(text) {
            let hash = 0;
            for (let i = 0; i < text.length; i++) {
                const char = text.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString(36);
        }

        /**
         * 🔄 替换文本中的占位符变量
         * @param {string} text - 要处理的文本
         * @returns {string} - 替换后的文本
         * @private
         */
        _resolvePlaceholders(text) {
            if (!text) return text;

            try {
                // 获取上下文
                const ctx = window.Gaigai?.m?.ctx();
                if (!ctx) {
                    console.warn('⚠️ [VectorManager] 无法获取上下文，跳过变量替换');
                    return text;
                }

                // 获取名字
                const userName = ctx.name1 || 'User';
                const charName = ctx.name2 || 'Char';

                // 执行替换（支持多种变体）
                let result = text;

                // 替换 {{user}} 和 {{User}}
                result = result.replace(/\{\{user\}\}/gi, userName);

                // 替换 {{char}} 和 {{Char}}
                result = result.replace(/\{\{char\}\}/gi, charName);

                return result;
            } catch (error) {
                console.error('❌ [VectorManager] 变量替换失败:', error);
                return text; // 出错时返回原文本
            }
        }

        /**
         * 🌐 调用 Embedding API 获取向量
         * @param {string} text - 要编码的文本
         * @returns {Promise<number[]>} - 向量数组
         */
        async getEmbedding(text) {
            if (!text || !text.trim()) {
                throw new Error('文本不能为空');
            }

            const config = this._getConfig();

            // 验证配置
            if (!config.url || !config.key) {
                throw new Error('未配置向量 API URL 或 Key');
            }

            // 检查缓存
            const hash = this._hashText(text);
            if (this.vectorCache.has(hash)) {
                console.log('✅ [VectorManager] 使用缓存向量');
                return this.vectorCache.get(hash);
            }

            // 检查是否有相同文本的请求正在进行
            if (this.pendingRequests.has(hash)) {
                console.log('⏳ [VectorManager] 等待进行中的请求...');
                return await this.pendingRequests.get(hash);
            }

            // 创建新的请求
            const requestPromise = this._fetchEmbedding(text, config);
            this.pendingRequests.set(hash, requestPromise);

            try {
                const vector = await requestPromise;

                // 缓存结果
                this.vectorCache.set(hash, vector);

                return vector;
            } finally {
                this.pendingRequests.delete(hash);
            }
        }

        /**
         * 🌐 实际的 API 请求
         * @private
         * @param {string|string[]} text - 单个文本或文本数组（批量）
         * @param {Object} config - 配置对象
         * @returns {Promise<number[]|number[][]>} - 单个向量或向量数组
         */
        async _fetchEmbedding(text, config) {
            // ✅ 优化 URL 拼接逻辑，避免重复 /v1
            let baseUrl = config.url.replace(/\/$/, ''); // 去除末尾斜杠
            if (baseUrl.endsWith('/v1')) {
                baseUrl = baseUrl.slice(0, -3); // 去除已存在的 /v1
            }
            const url = baseUrl + '/v1/embeddings';

            const isBatch = Array.isArray(text);
            const payload = {
                model: config.model,
                input: text  // OpenAI API 支持 string 或 string[]
            };

            console.log(`🔄 [VectorManager] 调用 Embedding API: ${url} ${isBatch ? `(批量: ${text.length} 条)` : '(单条)'}`);

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.key}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
                }

                const data = await response.json();

                // ✅ 标准 OpenAI 格式: { data: [{ embedding: [...] }, ...] }
                if (data.data && Array.isArray(data.data)) {
                    if (isBatch) {
                        // 批量模式：返回向量数组
                        const vectors = data.data.map(item => item.embedding);
                        console.log(`✅ [VectorManager] 获取批量向量成功，数量: ${vectors.length}, 维度: ${vectors[0]?.length || 0}`);
                        return vectors;
                    } else {
                        // 单条模式：返回单个向量
                        if (data.data[0] && data.data[0].embedding) {
                            console.log('✅ [VectorManager] 获取向量成功，维度:', data.data[0].embedding.length);
                            return data.data[0].embedding;
                        }
                    }
                }

                throw new Error('API 返回格式不正确');
            } catch (error) {
                console.error('❌ [VectorManager] Embedding API 错误:', error);
                throw error;
            }
        }

        /**
         * 🎯 调用 Rerank API 对候选文档进行重排序
         * @private
         * @param {string} query - 查询文本
         * @param {string[]} documents - 候选文档数组
         * @param {Object} config - 配置对象
         * @returns {Promise<number[]>} - 返回每个文档的新分数数组
         */
        async _fetchRerank(query, documents, config) {
            if (!documents || documents.length === 0) {
                return [];
            }

            const url = config.rerankUrl;

            // 修正 top_n 参数：防止超过 API 允许的上限
            const topN = Math.min(documents.length, config.maxCount || 10);

            const payload = {
                model: config.rerankModel,
                query: query,
                documents: documents,
                top_n: topN,
                return_documents: false
            };

            console.log(`🎯 [VectorManager] 调用 Rerank API: ${url} (文档数: ${documents.length}, top_n: ${topN})`);

            // 创建 AbortController 用于超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 3000); // 3秒超时

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.rerankKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal // 绑定超时信号
                });

                // 清除超时定时器
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ [VectorManager] Rerank API 请求失败 (${response.status}): ${errorText}`);
                    return []; // 返回空数组，触发降级
                }

                const data = await response.json();

                // 解析 Rerank API 返回的结果
                // 标准格式: { results: [{ index: 0, relevance_score: 0.95 }, ...] }
                if (data.results && Array.isArray(data.results)) {
                    // 创建一个数组来存储每个文档的分数（按原始索引）
                    const scores = new Array(documents.length).fill(0);

                    for (const result of data.results) {
                        const index = result.index;
                        const score = result.relevance_score || 0;
                        scores[index] = score;
                    }

                    console.log(`✅ [VectorManager] Rerank 完成，返回 ${data.results.length} 个分数`);
                    return scores;
                }

                console.error('❌ [VectorManager] Rerank API 返回格式不正确');
                return []; // 返回空数组，触发降级
            } catch (error) {
                // 清除超时定时器
                clearTimeout(timeoutId);

                // 判断是否为超时错误
                if (error.name === 'AbortError') {
                    console.warn('⚠️ [VectorManager] Rerank API 请求超时 (3秒)，已自动中止');
                } else {
                    console.error('❌ [VectorManager] Rerank API 错误:', error);
                }

                // 无论何种错误，都返回空数组，让调用方使用原始分数
                return [];
            }
        }

        /**
         * 📐 计算余弦相似度
         * @param {number[]} vecA - 向量 A
         * @param {number[]} vecB - 向量 B
         * @returns {number} - 相似度 (0-1)
         */
        cosineSimilarity(vecA, vecB) {
            if (!vecA || !vecB || vecA.length !== vecB.length) {
                console.warn('⚠️ [VectorManager] 向量维度不匹配或为空');
                return 0;
            }

            let dotProduct = 0;
            let normA = 0;
            let normB = 0;

            for (let i = 0; i < vecA.length; i++) {
                dotProduct += vecA[i] * vecB[i];
                normA += vecA[i] * vecA[i];
                normB += vecB[i] * vecB[i];
            }

            normA = Math.sqrt(normA);
            normB = Math.sqrt(normB);

            if (normA === 0 || normB === 0) {
                return 0;
            }

            return dotProduct / (normA * normB);
        }

        /**
         * 📖 导入新书（替代旧版 handleImportCustomFile）
         * @param {File} file - 用户选择的 TXT 文件
         * @param {string} customName - 自定义书名（可选）
         * @returns {Promise<Object>} - { success: boolean, bookId: string, count: number }
         */
        async importBook(file, customName = null) {
            try {
                // 读取文件内容
                let content = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsText(file, 'UTF-8');
                });

                // ✅ 变量替换：将 {{user}} 和 {{char}} 替换为实际名字
                content = this._resolvePlaceholders(content);

                const config = this._getConfig();
                const separator = config.separator || '===';

                // 切分文本
                let chunks = [];
                if (separator === '\\n' || separator === '\n') {
                    chunks = content.split('\n').filter(line => line.trim());
                } else {
                    chunks = content.split(separator).filter(chunk => chunk.trim());
                }

                console.log(`📂 [VectorManager] 文件已切分为 ${chunks.length} 个片段`);

                // 生成书籍 ID
                const bookId = this._generateUUID();

                // 创建书籍对象
                this.library[bookId] = {
                    name: customName || file.name,
                    chunks: chunks.map(chunk => chunk.trim()),
                    vectors: new Array(chunks.length).fill(null),
                    vectorized: new Array(chunks.length).fill(false),
                    createTime: Date.now()
                };

                // 保存到全局
                this.saveLibrary();

                return { success: true, bookId: bookId, count: chunks.length };

            } catch (error) {
                console.error('❌ [VectorManager] 导入书籍失败:', error);
                return { success: false, bookId: null, count: 0, error: error.message };
            }
        }

        /**
         * ⚡ 向量化指定书籍（批量优化版）
         * @param {string} bookId - 书籍 ID
         * @param {Function} progressCallback - 进度回调 (current, total)
         * @returns {Promise<Object>} - { success: boolean, count: number, errors: number }
         */
        async vectorizeBook(bookId, progressCallback) {
            console.log(`⚡ [VectorManager] 开始向量化书籍: ${bookId}...`);

            const book = this.library[bookId];
            if (!book) {
                throw new Error('书籍不存在');
            }

            // 找出未向量化的片段
            const unvectorizedIndices = [];
            for (let i = 0; i < book.chunks.length; i++) {
                if (!book.vectorized[i]) {
                    unvectorizedIndices.push(i);
                }
            }

            if (unvectorizedIndices.length === 0) {
                console.log('✅ [VectorManager] 所有片段已向量化');
                return { success: true, count: 0, errors: 0, lastError: null };
            }

            let successCount = 0;
            let errorCount = 0;
            let currentBatchSize = 10; // 动态批量大小，遇到 429 时会降级
            let lastErrorMessage = null; // ✅ 记录最后一次错误信息

            const config = this._getConfig();

            // 🚀 批量处理：每次发送 currentBatchSize 个片段
            for (let i = 0; i < unvectorizedIndices.length; i += currentBatchSize) {
                const batchIndices = unvectorizedIndices.slice(i, i + currentBatchSize);
                const batchTexts = batchIndices.map(idx => book.chunks[idx]);

                try {
                    // 调用进度回调
                    if (progressCallback) {
                        progressCallback(Math.min(i + currentBatchSize, unvectorizedIndices.length), unvectorizedIndices.length);
                    }

                    console.log(`📦 [VectorManager] 批量处理: ${i + 1}-${Math.min(i + currentBatchSize, unvectorizedIndices.length)}/${unvectorizedIndices.length}`);

                    // 🔥 批量获取向量
                    const vectors = await this._fetchEmbedding(batchTexts, config);

                    // 批量更新书籍数据
                    for (let j = 0; j < batchIndices.length; j++) {
                        const idx = batchIndices[j];
                        book.vectors[idx] = vectors[j];
                        book.vectorized[idx] = true;
                        successCount++;
                    }

                    console.log(`✅ [VectorManager] 批量完成: ${batchIndices.length} 个片段向量化`);

                    // 批量处理后延迟 1 秒，避免过快触发速率限制
                    await new Promise(r => setTimeout(r, 1000));

                    // 🔄 定期自动存档（每处理 50 个片段）
                    if (successCount % 50 === 0) {
                        this.saveLibrary();
                        console.log(`💾 [VectorManager] 自动存档 (已完成 ${successCount} 个)`);
                    }

                } catch (error) {
                    console.error(`❌ [VectorManager] 批量向量化失败: 片段 ${batchIndices[0]}-${batchIndices[batchIndices.length - 1]}`, error);

                    // ✅ 记录错误信息
                    lastErrorMessage = error.message || error.toString();

                    // 🛡️ 检测到 429 错误：降级策略
                    if (error.message && error.message.includes('429')) {
                        console.warn('⚠️ [429] 触发速率限制，执行降级策略...');

                        // 降低批量大小
                        if (currentBatchSize > 1) {
                            currentBatchSize = Math.max(1, Math.floor(currentBatchSize / 2));
                            console.log(`🔽 [降级] Batch Size 降低至: ${currentBatchSize}`);
                        }

                        // 冷却等待
                        console.log('❄️ [冷却] 等待 10 秒...');
                        await new Promise(r => setTimeout(r, 10000));

                        // 🔄 重试当前批次（使用更小的批量）
                        i -= currentBatchSize; // 回退索引，重新处理这一批
                        continue;
                    }

                    // 其他错误：跳过当前批次，继续下一批
                    errorCount += batchIndices.length;
                    console.error(`❌ [VectorManager] 错误详情: ${error.message || error.toString()}`);
                    console.warn(`⚠️ [跳过] 跳过当前批次 ${batchIndices.length} 个片段`);
                }
            }

            // 最终保存
            this.saveLibrary();

            console.log(`✅ [VectorManager] 书籍向量化完成: ${successCount} 成功, ${errorCount} 失败`);

            return { success: true, count: successCount, errors: errorCount, lastError: lastErrorMessage };
        }

        /**
         * 🔍 混合检索（表格 + 当前会话绑定的书籍）
         * @param {string} query - 查询文本
         * @param {string[]} allowedBookIds - 允许检索的书籍 ID 列表（可选，默认使用当前会话绑定）
         * @returns {Promise<Array>} - 相关记忆数组 [{ text, score, source, type }]
         */
        async search(query, allowedBookIds = null) {
            if (!query || !query.trim()) {
                return [];
            }

            const config = this._getConfig();

            // 🎯 2倍召回 + 漏斗筛选机制
            const targetCount = config.maxCount; // 最终需要的条数 (例如 10)
            const multiplier = 2; // 设定为 2 倍召回
            // 如果开启 Rerank，向量阶段召回 2 倍数据；否则只召回 1 倍
            const recallCount = config.rerankEnabled ? (targetCount * multiplier) : targetCount;
            // 如果开启 Rerank，强制降低向量检索的门槛到 0.05，确保能捞出足够多的候选集；否则保持用户设置的阈值
            const initialThreshold = config.rerankEnabled ? 0.05 : config.threshold;

            // 如果未提供 allowedBookIds，从当前会话获取
            if (!allowedBookIds) {
                allowedBookIds = this.getActiveBooks();
            }

            // 检查是否有可用的索引
            let knowledgeCount = 0;
            for (const bookId of allowedBookIds) {
                const book = this.library[bookId];
                if (book) {
                    knowledgeCount += book.vectorized.filter(v => v).length;
                }
            }

            if (knowledgeCount === 0) {
                console.warn('⚠️ [VectorManager] 向量索引为空，请先导入知识库并向量化');
                return [];
            }

            try {
                // 获取查询向量
                const queryVector = await this.getEmbedding(query);

                const results = [];
                const seenContent = new Set(); // ✅ 修复：内容去重集合

                // 检索绑定的知识库
                for (const bookId of allowedBookIds) {
                    const book = this.library[bookId];
                    if (!book) continue;

                    for (let i = 0; i < book.chunks.length; i++) {
                        if (book.vectorized[i] && book.vectors[i]) {
                            // 计算基础向量相似度
                            const score = this.cosineSimilarity(queryVector, book.vectors[i]);

                            let finalScore = score;
                            let isKeywordHit = false;
                            let hitReason = '';

                            // 🔍 增强版实体提取正则：支持 姓名/地点/物品/组织/设定
                            // 匹配格式如： "姓名：张三"、"地点: 洛阳"、"Item: Excalibur"
                            const entityRegex = /(?:姓名|名字|角色|Name|地点|位置|场景|Location|Place|物品|道具|装备|Item|Object|组织|势力|帮派|Organization|Group|设定|概念|Concept)[:：]\s*([^\s\n，,。.;；]+)/ig;

                            // 遍历所有可能的匹配项 (因为一个片段可能包含多个定义)
                            let match;
                            while ((match = entityRegex.exec(book.chunks[i])) !== null) {
                                if (match[1]) {
                                    const entityName = match[1].trim();
                                    // 只有当实体名长度大于1时才匹配（避免匹配到 "我"、"他" 这种单字）
                                    if (entityName.length > 1 && query.includes(entityName)) {
                                        isKeywordHit = true;
                                        hitReason = entityName;
                                        break; // 只要命中一个关键词，就足够召回了
                                    }
                                }
                            }

                            // 策略 2: 短查询词兜底 (如果查询很短且片段包含查询词，也强制召回)
                            if (!isKeywordHit && query.length < 15 && book.chunks[i].includes(query)) {
                                isKeywordHit = true;
                                hitReason = '短语精确匹配';
                            }

                            // ✅ 优化加分：降低权重（0.15），避免挤占语义相关片段
                            if (isKeywordHit) {
                                const originalScore = score;
                                finalScore += 0.15;
                                console.log(`🎯 [关键词加权] 命中关键词: "${hitReason}" -> 加分: ${originalScore.toFixed(4)} -> ${finalScore.toFixed(4)}`);
                            }

                            // ✅ 修复：内容去重
                            // 只有当这个文本片段没出现过时，才加入结果
                            if (!seenContent.has(book.chunks[i])) {
                                seenContent.add(book.chunks[i]); // 记录已添加的内容

                                results.push({
                                    text: book.chunks[i],
                                    source: `${book.name} 片段${i}`,
                                    score: finalScore,
                                    type: isKeywordHit ? '关键词⭐' : '知识库'
                                });
                            }
                        }
                    }
                }

                // Step 1: 粗排 - 使用初始阈值筛选并排序
                let candidates = results
                    .filter(r => r.score >= initialThreshold)
                    .sort((a, b) => b.score - a.score);

                // Step 2: 扩展候选集 - 根据是否启用 Rerank 决定召回数量
                candidates = candidates.slice(0, recallCount);

                console.log(`📊 [VectorManager] 粗排完成: ${candidates.length} 条候选结果 (阈值: ${initialThreshold}, 召回目标: ${recallCount})`);

                // Step 3: Rerank - 如果启用且有候选项
                if (config.rerankEnabled && candidates.length > 0 && config.rerankKey) {
                    try {
                        console.log(`🎯 [漏斗模式] 目标: ${targetCount} | 向量召回: ${candidates.length} | 准备 Rerank...`);
                        console.log(`🔧 [Rerank 配置] 模型: ${config.rerankModel}, URL: ${config.rerankUrl}`);
                        console.log('📋 [Before Rerank] 分数:', candidates.map((c, i) => `[${i}] ${c.score.toFixed(3)}`).join(', '));

                        // 提取候选文档的文本
                        const documents = candidates.map(c => c.text);

                        // 调用 Rerank API
                        const rerankScores = await this._fetchRerank(query, documents, config);

                        // 如果 Rerank 成功返回了分数
                        if (rerankScores && rerankScores.length === candidates.length) {
                            const maxRerankScore = Math.max(...rerankScores);
                            console.log(`📊 [Rerank 分数范围] 最高: ${maxRerankScore.toFixed(4)}, 最低: ${Math.min(...rerankScores).toFixed(4)}`);

                            // 完全信任 Rerank 的排序结果，直接使用 Rerank 分数
                            for (let i = 0; i < candidates.length; i++) {
                                candidates[i].originalScore = candidates[i].score; // 保存原始分数
                                candidates[i].rerankScore = rerankScores[i]; // 保存 Rerank 分数
                                candidates[i].score = rerankScores[i]; // 直接使用 Rerank 分数
                            }

                            // 重新排序
                            candidates.sort((a, b) => b.score - a.score);

                            console.log('📋 [After Rerank] 分数:', candidates.map((c, i) =>
                                `[${i}] ${c.score.toFixed(4)} (原向量:${c.originalScore.toFixed(3)})`
                            ).join(', '));
                            console.log('✅ [VectorManager] Rerank 完成，完全使用 Rerank 分数排序');
                        } else {
                            // 降级逻辑：Rerank 失败或超时，使用原始向量排序
                            console.warn('⚠️ [VectorManager] Rerank 失败或超时，已降级为原始向量排序');
                            // candidates 保持原有的 score（向量相似度），无需额外操作
                        }
                    } catch (error) {
                        // 降级逻辑：捕获任何异常，使用原始向量排序
                        console.warn('⚠️ [VectorManager] Rerank 失败或超时，已降级为原始向量排序:', error.message || error);
                        // candidates 保持原有的 score（向量相似度），无需额外操作
                    }
                }

                // Step 4: 最终过滤 + 截断
                // 如果启用了 Rerank，强制使用极低阈值(0.001)以保留低分但有效的结果；否则使用用户设置的阈值。
                const finalThreshold = config.rerankEnabled ? 0.001 : config.threshold;

                if (config.rerankEnabled) {
                    console.log(`🔧 [自适应阈值] Rerank 模式已接管，将阈值从 ${config.threshold} 临时降低至 ${finalThreshold} 以保留结果`);
                }

                let filtered = candidates.filter(r => r.score >= finalThreshold);
                const finalResults = filtered.slice(0, targetCount);

                console.log(`✅ [最终结果] Rerank 精选后保留: ${finalResults.length} 条`);
                console.log(`🔍 [VectorManager] 检索到 ${finalResults.length} 条相关记忆 (知识库:${knowledgeCount})`);

                return finalResults;

            } catch (error) {
                console.error('❌ [VectorManager] 检索失败:', error);
                return [];
            }
        }

        /**
         * 📚 同步总结表到书架
         * @returns {Promise<Object>} - { success: boolean, count: number, error?: string }
         */
        async syncSummaryToBook(autoVectorize = false) {
            console.log('📚 [VectorManager] 开始同步总结表到书架...');

            try {
                // 获取 Memory Manager
                const m = window.Gaigai?.m;
                if (!m || !m.s || m.s.length === 0) {
                    throw new Error('Memory Manager 不可用或没有表格数据');
                }

                // 获取最后一个表格（总结表）
                const summarySheet = m.s[m.s.length - 1];
                if (!summarySheet || !summarySheet.r || summarySheet.r.length === 0) {
                    throw new Error('总结表为空或不存在');
                }

                // 构建 chunks 数组
                const chunks = [];
                for (const row of summarySheet.r) {
                    // 兼容 Object 和 Array 格式
                    const rowData = Array.isArray(row) ? row : Object.values(row);

                    // 假设格式：[标题, 内容, 备注, ...]
                    // 根据实际表格结构调整索引
                    const title = rowData[0] || '';
                    const content = rowData[1] || '';
                    const remark = rowData[2] || '';

                    // 构建片段文本：标题 (备注)\n内容
                    let chunkText = '';
                    if (title) {
                        chunkText += title;
                        if (remark) {
                            chunkText += ` (${remark})`;
                        }
                        chunkText += '\n';
                    }
                    if (content) {
                        chunkText += content;
                    }

                    // ✅ 变量替换：将 {{user}} 和 {{char}} 替换为实际名字
                    chunkText = this._resolvePlaceholders(chunkText);

                    if (chunkText.trim()) {
                        chunks.push(chunkText.trim());
                    }
                }

                if (chunks.length === 0) {
                    throw new Error('总结表中没有有效内容');
                }

                // 🔒 会话隔离：使用会话 ID 生成唯一的书籍 ID
                const sessionId = m.gid() || 'default';
                const bookId = 'summary_book_' + sessionId;
                const defaultBookName = '《剧情总结归档》';

                // 创建或更新书籍
                if (this.library[bookId]) {
                    // 书籍已存在：保留用户自定义的书名，仅更新内容和重置向量化状态
                    const existingName = this.library[bookId].name;
                    this.library[bookId] = {
                        name: existingName, // 保留原书名
                        chunks: chunks,
                        vectors: new Array(chunks.length).fill(null),
                        vectorized: new Array(chunks.length).fill(false),
                        createTime: this.library[bookId].createTime
                    };
                    console.log(`📝 [VectorManager] 更新现有书籍 "${existingName}" (ID: ${bookId})`);
                } else {
                    // 书籍不存在：创建新书
                    this.library[bookId] = {
                        name: defaultBookName,
                        chunks: chunks,
                        vectors: new Array(chunks.length).fill(null),
                        vectorized: new Array(chunks.length).fill(false),
                        createTime: Date.now()
                    };
                    console.log(`✨ [VectorManager] 创建新书籍 "${defaultBookName}" (ID: ${bookId})`);
                }

                // 保存到全局
                this.saveLibrary();

                // 🔗 自动绑定：将书籍添加到当前会话的 activeBooks
                const ctx = m.ctx();
                if (ctx && ctx.chatMetadata) {
                    const currentActiveBooks = ctx.chatMetadata.gaigai_activeBooks || [];
                    if (!currentActiveBooks.includes(bookId)) {
                        const newActiveBooks = [...currentActiveBooks, bookId];
                        this.setActiveBooks(newActiveBooks);
                        console.log(`🔗 [VectorManager] 已自动绑定书籍到当前会话`);
                    }
                }

                console.log(`✅ [VectorManager] 已同步 ${chunks.length} 条总结到书架`);

                // ⚡ 自动执行向量化
                if (autoVectorize) {
                    console.log('⚡ [VectorManager] 开始自动向量化...');
                    const vectorizeResult = await this.vectorizeBook(bookId);
                    console.log(`⚡ [VectorManager] 向量化完成: 成功 ${vectorizeResult.count || 0} 条, 失败 ${vectorizeResult.errors || 0} 条`);
                    return {
                        success: true,
                        count: chunks.length,
                        bookId: bookId,
                        vectorized: true,
                        vectorizeResult: vectorizeResult
                    };
                }

                return { success: true, count: chunks.length, bookId: bookId, vectorized: false };

            } catch (error) {
                console.error('❌ [VectorManager] 同步总结到书架失败:', error);
                return { success: false, count: 0, error: error.message };
            }
        }

        /**
         * 🗑️ 删除书籍
         * @param {string} bookId - 书籍 ID
         */
        deleteBook(bookId) {
            if (this.library[bookId]) {
                delete this.library[bookId];

                // 从所有会话的绑定中移除
                // (注意：这里只处理当前会话，其他会话需要在打开时自动清理不存在的书籍)
                const activeBooks = this.getActiveBooks();
                const newActiveBooks = activeBooks.filter(id => id !== bookId);
                if (newActiveBooks.length !== activeBooks.length) {
                    this.setActiveBooks(newActiveBooks);
                }

                this.saveLibrary();
                console.log(`🗑️ [VectorManager] 已删除书籍: ${bookId}`);
                return true;
            }
            return false;
        }

        /**
         * 🧹 清空所有书籍
         */
        clearAllBooks() {
            this.library = {};
            this.saveLibrary();

            // 清空当前会话的绑定
            this.setActiveBooks([]);

            console.log('🧹 [VectorManager] 已清空所有书籍');
        }

        /**
         * 🧹 清空所有数据（书籍和缓存）
         */
        clearAll() {
            this.library = {};
            this.vectorCache.clear();
            this.pendingRequests.clear();
            this.saveLibrary();
            this.setActiveBooks([]);
            console.log('🧹 [VectorManager] 已清空所有向量数据');
        }

        /**
         * 📤 导出向量缓存（图书馆）
         * @param {string[]|null} specificBookIds - 指定要导出的书籍ID数组，null或空数组则导出全部
         * @returns {string} - 文件内容
         */
        exportVectors(specificBookIds = null) {
            const lines = [];

            // 确定要导出的书籍
            let booksToExport = Object.entries(this.library);
            if (specificBookIds && Array.isArray(specificBookIds) && specificBookIds.length > 0) {
                booksToExport = booksToExport.filter(([bookId]) => specificBookIds.includes(bookId));
            }

            lines.push('=== Gaigai 向量缓存文件 (图书馆版) ===');
            lines.push(`导出时间: ${new Date().toLocaleString()}`);
            lines.push(`书籍数量: ${booksToExport.length}`);
            lines.push('');

            // 导出图书馆（仅导出指定的书籍）
            lines.push('>>> 图书馆 <<<');
            for (const [bookId, book] of booksToExport) {
                lines.push('=== 书籍信息 ===');
                lines.push(`ID: ${bookId}`);
                lines.push(`书名: ${book.name}`);
                lines.push(`创建时间: ${book.createTime}`);
                lines.push(`片段数量: ${book.chunks.length}`);
                lines.push('');

                // 导出每个片段
                for (let i = 0; i < book.chunks.length; i++) {
                    lines.push(`--- 片段 ${i} ---`);
                    lines.push(book.chunks[i]);
                    if (book.vectorized[i] && book.vectors[i]) {
                        lines.push('--- 向量 (Base64) ---');
                        const vectorJson = JSON.stringify(book.vectors[i]);
                        const vectorBase64 = btoa(unescape(encodeURIComponent(vectorJson)));
                        lines.push(vectorBase64);
                    } else {
                        lines.push('--- 向量: 未向量化 ---');
                    }
                    lines.push('');
                }
            }

            const content = lines.join('\n');
            console.log(`📤 [VectorManager] 导出完成: ${booksToExport.length} 本书籍`);

            return content;
        }

        /**
         * 📥 从 TXT 文件导入向量缓存（图书馆）
         * @param {File|string} fileOrContent - 文件对象或文本内容
         * @returns {Promise<Object>} - { success: boolean, bookCount: number }
         */
        async importVectors(fileOrContent) {
            try {
                let content;

                if (typeof fileOrContent === 'string') {
                    content = fileOrContent;
                } else {
                    content = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsText(fileOrContent);
                    });
                }

                const lines = content.split('\n');
                const newLibrary = {};

                let currentSection = null;
                let currentEntry = null;
                let currentBookId = null;
                let currentChunkIndex = -1;
                let mode = 'header';

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();

                    // 检测区段
                    if (line === '>>> 图书馆 <<<') {
                        currentSection = 'library';
                        continue;
                    }

                    // 解析图书馆
                    if (currentSection === 'library') {
                        if (line === '=== 书籍信息 ===') {
                            mode = 'book_meta';
                            currentEntry = { chunks: [], vectors: [], vectorized: [] };
                            currentChunkIndex = -1;
                            continue;
                        }

                        if (line.startsWith('--- 片段 ')) {
                            currentChunkIndex = parseInt(line.match(/\d+/)[0]);
                            mode = 'chunk_text';
                            currentEntry.chunks[currentChunkIndex] = '';
                            continue;
                        }

                        if (line === '--- 向量 (Base64) ---') {
                            mode = 'chunk_vector';
                            continue;
                        }

                        if (line === '--- 向量: 未向量化 ---') {
                            currentEntry.vectors[currentChunkIndex] = null;
                            currentEntry.vectorized[currentChunkIndex] = false;
                            continue;
                        }

                        if (mode === 'book_meta') {
                            if (line.startsWith('ID: ')) {
                                currentBookId = line.substring(4);
                            } else if (line.startsWith('书名: ')) {
                                currentEntry.name = line.substring(4);
                            } else if (line.startsWith('创建时间: ')) {
                                currentEntry.createTime = parseInt(line.substring(7));
                            } else if (line.startsWith('片段数量: ')) {
                                // 忽略，从实际数据获取
                            }
                        } else if (mode === 'chunk_text') {
                            if (line && !line.startsWith('---')) {
                                currentEntry.chunks[currentChunkIndex] += (currentEntry.chunks[currentChunkIndex] ? '\n' : '') + line;
                            }
                        } else if (mode === 'chunk_vector') {
                            if (line && !line.startsWith('---') && !line.startsWith('===')) {
                                try {
                                    const vectorJson = decodeURIComponent(escape(atob(line)));
                                    currentEntry.vectors[currentChunkIndex] = JSON.parse(vectorJson);
                                    currentEntry.vectorized[currentChunkIndex] = true;
                                } catch (e) {
                                    console.error('❌ [VectorManager] 向量解码失败:', e);
                                    currentEntry.vectors[currentChunkIndex] = null;
                                    currentEntry.vectorized[currentChunkIndex] = false;
                                }
                            }
                        }

                        // 当遇到下一本书或文件结束时，保存当前书
                        if ((line === '=== 书籍信息 ===' && currentBookId) || i === lines.length - 1) {
                            if (currentBookId && currentEntry.name) {
                                newLibrary[currentBookId] = currentEntry;
                            }
                        }
                    }
                }

                // 更新数据（合并模式）
                // 保留旧书架 (this.library)，将导入的新书 (newLibrary) 合并进去
                // 如果ID相同，新导入的会覆盖旧的
                Object.assign(this.library, newLibrary);

                this.saveLibrary();

                console.log(`📥 [VectorManager] 导入合并完成: 新增/更新了 ${Object.keys(newLibrary).length} 本书籍，当前总数: ${Object.keys(this.library).length}`);

                return {
                    success: true,
                    bookCount: Object.keys(newLibrary).length
                };

            } catch (error) {
                console.error('❌ [VectorManager] 导入失败:', error);
                return { success: false, bookCount: 0, error: error.message };
            }
        }

        /**
         * 🎨 显示向量化配置 UI（左侧书架 + 右侧详情）
         */
        showUI() {
            const config = this._getConfig();
            const UI = window.Gaigai?.ui || { c: '#dfdcdcff', bc: '#ffffff', tc: '#000000ff', darkMode: false };
            const pop = window.Gaigai?.pop;

            if (!pop) {
                alert('UI 库未加载');
                return;
            }

            // 获取当前会话绑定的书籍
            const activeBooks = this.getActiveBooks();

            const html = `
                <style>
                    /* 强制指定主窗口大小，防止被全局样式或小弹窗样式影响 */
                    #gai-main-pop .g-w {
                        width: 900px !important;        /* 宽度改小 */
                        height: 700px !important;       /* 高度改小 */
                        max-width: 95vw !important;     /* 防止溢出屏幕 */
                        max-height: 90vh !important;
                    }

                    /* 内部容器自适应 */
                    .gg-vm-container {
                        padding: 20px;
                        display: flex;
                        gap: 20px;
                        height: 100%; /* 填满父容器 */
                        box-sizing: border-box;
                        overflow: hidden; /* 防止双重滚动条 */
                    }

                    .gg-vm-left {
                        flex: 1;
                        min-width: 300px;
                        max-width: 400px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        min-height: 0;
                        overflow-y: auto;
                        overflow-x: hidden;
                    }

                    .gg-vm-right {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        border-left: 1px solid rgba(255,255,255,0.1);
                        padding-left: 20px;
                        min-width: 0;
                    }

                    .gg-vm-config-section,
                    .gg-vm-global-section {
                        flex-shrink: 0;
                    }

                    .gg-vm-book-list-wrapper {
                        flex-shrink: 0;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .gg-vm-book-list {
                        max-height: 300px;
                        overflow-y: auto;
                        border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 4px;
                        padding: 10px;
                        background: rgba(0,0,0,0.1);
                        min-height: 100px;
                    }

                    /* 响应式：手机端 */
                    @media (max-width: 768px) {
                        /* 强制主弹窗在手机上全屏且允许滚动 */
                        #gai-main-pop .g-w {
                            width: 100vw !important;
                            height: 90vh !important;
                            max-height: 90vh !important;
                            display: flex !important;
                            flex-direction: column !important;
                        }

                        /* 内部容器允许滚动 */
                        .gg-vm-container {
                            flex-direction: column;
                            height: 100%;
                            padding: 10px;
                            overflow-y: auto; /* 关键：允许垂直滚动 */
                            gap: 15px;
                            display: flex;
                        }

                        /* 左侧栏（API配置等） */
                        .gg-vm-left {
                            flex: none; /* 取消伸缩 */
                            width: 100%;
                            min-width: 0;
                            max-width: none;
                            overflow: visible; /* 让内容撑开高度 */
                        }

                        /* 右侧栏（详情区） */
                        .gg-vm-right {
                            flex: none;
                            width: 100%;
                            height: 500px; /* 给详情区一个固定高度 */
                            border-left: none;
                            border-top: 1px solid rgba(255,255,255,0.1);
                            padding-left: 0;
                            padding-top: 15px;
                            margin-top: 10px;
                        }

                        /* 优化书架列表高度，不要太长 */
                        .gg-vm-book-list {
                            max-height: 180px;
                        }
                    }
                </style>

                <div class="g-p gg-vm-container">
                    <!-- 左侧栏：API配置 + 书架列表 -->
                    <div class="gg-vm-left">
                        <!-- ✅ 总开关区域 -->
                        <div style="background: rgba(76, 175, 80, 0.1); border-radius: 8px; padding: 12px; border: 2px solid rgba(76, 175, 80, 0.3); margin-bottom: 12px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="gg_vm_global_enabled" ${window.Gaigai?.config_obj?.vectorEnabled ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" />
                                <span style="font-size: 13px; font-weight: bold; color: ${UI.tc};">
                                    💠 启用插件独立向量检索
                                </span>
                            </label>
                            <div style="font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-top: 6px; margin-left: 30px;">
                                ℹ️ 此开关与主配置页同步，关闭后将不会在对话中插入向量记忆
                            </div>
                        </div>

                        <!-- API 配置 -->
                        <div class="gg-vm-config-section" style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 13px; font-weight: bold; color: ${UI.tc}; margin-bottom: 10px;">
                                <i class="fa-solid fa-cog"></i> API 配置
                            </div>

                            <div style="margin-bottom: 6px;">
                                <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">API 地址</label>
                                <input type="text" id="gg_vm_url" value="${config.url || ''}" placeholder="https://api.siliconflow.cn" style="width: 100%; padding: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                            </div>

                            <div style="margin-bottom: 6px;">
                                <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">API 密钥</label>
                                <div style="position: relative;">
                                    <input type="password" id="gg_vm_key" value="${config.key || ''}" placeholder="sk-xxx" style="width: 100%; padding: 5px 30px 5px 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                                    <i class="gg-vm-toggle-key fa-solid fa-eye" data-target="gg_vm_key" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; opacity: 0.6; color: ${UI.tc}; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"></i>
                                </div>
                            </div>

                            <div style="margin-bottom: 6px;">
                                <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">模型名称</label>
                                <input type="text" id="gg_vm_model" value="${config.model || 'BAAI/bge-m3'}" style="width: 100%; padding: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                            </div>

                            <!-- 分隔线 -->
                            <div style="border-top: 1px dashed rgba(255,255,255,0.15); margin: 10px 0;"></div>

                            <!-- 相似度阈值 (滑块 + 数字) -->
                            <div style="margin-bottom: 6px;">
                                <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 4px;">
                                    相似度阈值: <span id="gg_vm_threshold_val" style="font-weight: 600; color: #4CAF50;">${config.threshold}</span>
                                </label>
                                <input type="range" id="gg_vm_threshold" min="0" max="1" step="0.01" value="${config.threshold}" style="width: 100%;" />
                                <div style="font-size: 9px; opacity: 0.5; margin-top: 2px; color: ${UI.tc};">低于此分数的结果将被过滤</div>
                            </div>

                            <!-- 最大召回条数 -->
                            <div style="margin-bottom: 6px;">
                                <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">最大召回条数</label>
                                <input type="number" id="gg_vm_max_count" value="${config.maxCount || 3}" min="1" max="20" style="width: 100%; padding: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                                <div style="font-size: 9px; opacity: 0.5; margin-top: 2px; color: ${UI.tc};">每次检索返回的最大结果数</div>
                            </div>

                            <!-- 检索上下文深度 -->
                            <div style="margin-bottom: 6px;">
                                <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">检索上下文深度</label>
                                <input type="number" id="gg_vm_context_depth" value="${config.contextDepth || 1}" min="1" max="5" style="width: 100%; padding: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                                <div style="font-size: 9px; opacity: 0.5; margin-top: 2px; color: ${UI.tc};">检索时向前回溯的消息数量 (User+AI)，解决短回复无法检索的问题</div>
                            </div>

                            <!-- 文本切分符 -->
                            <div style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">文本切分符</label>
                                <input type="text" id="gg_vm_separator" value="${config.separator || '==='}" placeholder="===" style="width: 100%; padding: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                                <div style="font-size: 9px; opacity: 0.5; margin-top: 2px; color: ${UI.tc};">导入 TXT 时按此分隔符切分文本</div>
                            </div>

                            <!-- 分隔线 -->
                            <div style="border-top: 1px dashed rgba(255,255,255,0.15); margin: 10px 0;"></div>

                            <!-- Rerank 配置 -->
                            <div style="margin-bottom: 8px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
                                    <input type="checkbox" id="gg_vm_rerank_enabled" ${config.rerankEnabled ? 'checked' : ''} style="transform: scale(1.2); cursor: pointer;" />
                                    <span style="font-size: 11px; font-weight: bold; color: ${UI.tc};">🎯 启用 Rerank (重排序)</span>
                                </label>
                                <div style="font-size: 9px; opacity: 0.5; margin-bottom: 8px; color: ${UI.tc};">使用 Rerank API 对初步检索结果进行精确重排序，提高召回准确度</div>

                                <div style="margin-bottom: 6px;">
                                    <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">Rerank API URL</label>
                                    <input type="text" id="gg_vm_rerank_url" value="${config.rerankUrl || 'https://api.siliconflow.cn/v1/rerank'}" placeholder="https://api.siliconflow.cn/v1/rerank" style="width: 100%; padding: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                                </div>

                                <div style="margin-bottom: 6px;">
                                    <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">Rerank API Key</label>
                                    <div style="position: relative;">
                                        <input type="password" id="gg_vm_rerank_key" value="${config.rerankKey || ''}" placeholder="sk-..." style="width: 100%; padding: 5px 30px 5px 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                                        <i class="gg-vm-toggle-key fa-solid fa-eye" data-target="gg_vm_rerank_key" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; opacity: 0.6; color: ${UI.tc}; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"></i>
                                    </div>
                                </div>

                                <div style="margin-bottom: 6px;">
                                    <label style="display: block; font-size: 10px; opacity: 0.7; color: ${UI.tc}; margin-bottom: 2px;">Rerank Model</label>
                                    <input type="text" id="gg_vm_rerank_model" value="${config.rerankModel || 'BAAI/bge-reranker-v2-m3'}" placeholder="BAAI/bge-reranker-v2-m3" style="width: 100%; padding: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box;" />
                                </div>
                            </div>

                            <!-- 插入变量提示 -->
                            <div style="font-size: 10px; opacity: 0.9; color: ${UI.tc}; margin-top: 4px; margin-bottom: 8px; margin-left: 30px;">
                                📌 插入变量: <code style="background:rgba(0,0,0,0.1); padding:2px 4px; border-radius:3px; font-weight:bold; font-family:monospace; user-select:all; cursor:text;" title="点击复制">{{VECTOR_MEMORY}}</code> (若不填则默认插入chat history上方)
                            </div>

                            <button id="gg_vm_save" style="width: 100%; padding: 6px; background: #9C27B0; color: white; border: none; border-radius: 3px; font-size: 10px; cursor: pointer; font-weight: 500;">
                                💾 保存配置
                            </button>
                        </div>

                        <!-- 全局操作 -->
                        <div class="gg-vm-global-section" style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 11px; font-weight: bold; color: ${UI.tc}; margin-bottom: 8px;">
                                🛠️ 全局操作
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <button id="gg_vm_create_book" style="width: 100%; padding: 7px; background: #9C27B0; color: white; border: none; border-radius: 3px; font-size: 10px; cursor: pointer; font-weight: 500;">
                                    📝 新建空白书
                                </button>
                                <button id="gg_vm_import_book" style="width: 100%; padding: 7px; background: #4CAF50; color: white; border: none; border-radius: 3px; font-size: 10px; cursor: pointer; font-weight: 500;">
                                    📂 导入新书 (TXT)
                                </button>
                                <button id="gg_vm_rebuild_table" style="width: 100%; padding: 7px; background: #2196F3; color: white; border: none; border-radius: 3px; font-size: 10px; cursor: pointer; font-weight: 500;">
                                    📚 同步总结到书架
                                </button>
                                <div style="font-size: 9px; opacity: 0.5; margin-top: 2px; color: ${UI.tc};">
                                    💡 将最新的记忆总结表转换为书籍，以便进行向量化检索
                                </div>
                                <button id="gg_vm_import_all" style="width: 100%; padding: 7px; background: #009688; color: white; border: none; border-radius: 3px; font-size: 10px; cursor: pointer; font-weight: 500;">
                                    📥 导入图书馆备份
                                </button>
                                <button id="gg_vm_export_all" style="width: 100%; padding: 7px; background: #607D8B; color: white; border: none; border-radius: 3px; font-size: 10px; cursor: pointer; font-weight: 500;">
                                    📤 导出图书馆备份
                                </button>
                            </div>
                        </div>

                        <!-- 书架区域（自适应高度） -->
                        <div class="gg-vm-book-list-wrapper">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="font-size: 14px; font-weight: bold; color: ${UI.tc};">
                                    <i class="fa-solid fa-book"></i> 我的书架
                                </div>
                                <div style="font-size: 10px; color: ${UI.tc}; opacity: 0.7;">
                                    ${Object.keys(this.library).length} 本书
                                </div>
                            </div>

                            <div id="gg_vm_book_list" class="gg-vm-book-list">
                                ${this._renderBookList(UI, activeBooks)}
                            </div>
                        </div>

                        <!-- 隐藏的文件输入 -->
                        <input type="file" id="gg_vm_book_file" accept=".txt" style="display: none;" />
                        <input type="file" id="gg_vm_backup_file" accept=".txt" style="display: none;" />
                    </div>

                    <!-- 右侧栏：详情区 -->
                    <div class="gg-vm-right">
                        <div id="gg_vm_detail_area" style="height: 100%; overflow-y: auto;">
                            ${this._renderDetailArea(UI)}
                        </div>
                    </div>
                </div>
            `;

            const $mainWindow = pop('💠 向量化设置', html, true);
            // 注释掉强制宽度设置，让 CSS 的 @media 适配自动生效，避免手机端左右有空隙
            // if ($mainWindow) {
            //     $mainWindow.attr('style', 'width: 90vw !important; height: 80vh !important; max-width: 1200px !important; max-height: 90vh !important; display: flex !important; flex-direction: column !important; pointer-events: auto !important;');
            // }

            // 绑定事件
            setTimeout(() => {
                this._bindUIEvents();
            }, 100);
        }

        /**
         * 📝 渲染书籍列表
         * @private
         */
        _renderBookList(UI, activeBooks) {
            if (Object.keys(this.library).length === 0) {
                return `
                    <div style="text-align: center; padding: 40px; color: ${UI.tc}; opacity: 0.5;">
                        <i class="fa-solid fa-inbox" style="font-size: 48px; margin-bottom: 10px;"></i>
                        <div>书架为空</div>
                        <div style="font-size: 11px; margin-top: 5px;">点击"📂 导入新书"开始</div>
                    </div>
                `;
            }

            return Object.entries(this.library).map(([bookId, book]) => {
                const isActive = activeBooks.includes(bookId);
                const isSelected = (bookId === this.selectedBookId); // ✅ 检查是否选中
                const vectorizedCount = book.vectorized.filter(v => v).length;
                const totalChunks = book.chunks.length;
                const progress = totalChunks > 0 ? Math.round((vectorizedCount / totalChunks) * 100) : 0;
                const borderColor = isSelected ? '#4CAF50' : 'rgba(255,255,255,0.1)'; // ✅ 选中时高亮

                return `
                    <div class="gg-book-item" data-id="${bookId}" style="border: 2px solid ${borderColor}; border-radius: 4px; padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.02); cursor: pointer; position: relative;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" class="gg-book-checkbox" data-id="${bookId}" ${isActive ? 'checked' : ''} style="transform: scale(1.2); cursor: pointer;" />
                            <div style="flex: 1; min-width: 0;">
                                <div class="gg-book-name" style="font-size: 12px; font-weight: 600; color: ${UI.tc}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this._escapeHtml(book.name)}">
                                    ${this._escapeHtml(book.name)}
                                </div>
                                <div style="font-size: 10px; color: ${UI.tc}; opacity: 0.6; margin-top: 2px;">
                                    ${totalChunks} 片段 • ${progress}% 向量化
                                </div>
                            </div>
                            <button class="gg-book-delete" data-id="${bookId}" style="padding: 3px 8px; background: #f44336; color: white; border: none; border-radius: 3px; font-size: 10px; cursor: pointer;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        /**
         * 📝 渲染详情区域
         * @private
         */
        _renderDetailArea(UI) {
            if (!this.selectedBookId || !this.library[this.selectedBookId]) {
                return `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: ${UI.tc}; opacity: 0.5; flex-direction: column; gap: 10px;">
                        <i class="fa-solid fa-arrow-left" style="font-size: 48px;"></i>
                        <div style="font-size: 14px;">请从左侧选择一本书查看详情</div>
                    </div>
                `;
            }

            const book = this.library[this.selectedBookId];
            const vectorizedCount = book.vectorized.filter(v => v).length;
            const totalChunks = book.chunks.length;
            const progress = totalChunks > 0 ? Math.round((vectorizedCount / totalChunks) * 100) : 0;

            return `
                <div style="display: flex; flex-direction: column; height: 100%;">
                    <!-- 书籍标题 -->
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 18px; font-weight: bold; color: ${UI.tc}; margin-bottom: 5px; display: flex; align-items: center; gap: 8px;">
                            <span>${this._escapeHtml(book.name)}</span>
                            <i class="fa-solid fa-pen-to-square" id="gg_vm_rename_book" style="font-size: 14px; cursor: pointer; opacity: 0.6; transition: opacity 0.2s;" title="重命名" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"></i>
                        </div>
                        <div style="font-size: 11px; color: ${UI.tc}; opacity: 0.7;">
                            创建于: ${new Date(book.createTime).toLocaleString()} • ${totalChunks} 个片段
                        </div>

                        <!-- 进度条 -->
                        <div style="margin-top: 10px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span style="font-size: 10px; color: ${UI.tc}; opacity: 0.7;">向量化进度</span>
                                <span style="font-size: 10px; color: ${UI.tc}; opacity: 0.7;">${vectorizedCount}/${totalChunks} (${progress}%)</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width 0.3s;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div style="margin-bottom: 15px; display: flex; gap: 8px;">
                        <button id="gg_vm_edit_source" style="flex: 1; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 500;">
                            ✏️ 编辑/追加源文本
                        </button>
                        <button id="gg_vm_vectorize_book" style="flex: 1; padding: 8px; background: #FF9800; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 500;">
                            ⚡ 向量化此书
                        </button>
                    </div>

                    <!-- 片段列表 -->
                    <div style="flex: 1; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 10px; background: rgba(0,0,0,0.1);">
                        ${this._renderChunkList(book, UI)}
                    </div>
                </div>
            `;
        }

        /**
         * 📝 渲染片段列表
         * @private
         */
        _renderChunkList(book, UI) {
            return book.chunks.map((chunk, index) => {
                const isVectorized = book.vectorized[index];
                const statusIcon = isVectorized ? '✅' : '⏳';
                const statusText = isVectorized ? '已向量化' : '待处理';
                const statusColor = isVectorized ? '#4CAF50' : '#FF9800';
                const preview = chunk.substring(0, 100) + (chunk.length > 100 ? '...' : '');

                return `
                    <div class="gg-chunk-item" data-index="${index}" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 8px; margin-bottom: 6px; background: rgba(255,255,255,0.02); cursor: pointer;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <div style="font-size: 10px; color: ${UI.tc}; opacity: 0.7; font-weight: 600;">
                                片段 ${index}
                            </div>
                            <span style="font-size: 10px; color: ${statusColor};">
                                ${statusIcon} ${statusText}
                            </span>
                        </div>
                        <div style="font-size: 11px; color: ${UI.tc}; line-height: 1.4; opacity: 0.9;">
                            ${this._escapeHtml(preview)}
                        </div>
                    </div>
                `;
            }).join('');
        }

        /**
         * HTML 转义
         * @private
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

        /**
         * 🎨 自定义输入弹窗（适配主题色）
         * @param {string} message - 提示信息
         * @param {string} title - 弹窗标题
         * @param {string} defaultValue - 默认输入值
         * @returns {Promise<string|null>} - 用户输入的内容，取消时返回 null
         * @private
         */
        _customPrompt(message, title = '输入', defaultValue = '') {
            const UI = window.Gaigai?.ui || { c: '#dfdcdcff', bc: '#ffffff', tc: '#000000ff', darkMode: false };

            return new Promise((resolve) => {
                const html = `
                    <div class="g-p" style="padding: 8px;">
                        <p style="font-size: 10px; color: var(--g-tc) !important; margin-bottom: 6px; line-height: 1.3;">
                        ${this._escapeHtml(message)}
                        </p>
                        <input
                            type="text"
                            id="gg_vm_prompt_input"
                            value="${this._escapeHtml(defaultValue)}"
                            placeholder="请输入..."
                            style="width: 100%; padding: 5px; border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; background: rgba(0,0,0,0.2); color: ${UI.tc}; font-size: 10px; box-sizing: border-box; margin-bottom: 6px;"
                        />
                        <div style="display: flex; gap: 5px;">
                            <button id="gg_vm_prompt_cancel" style="flex: 1; padding: 5px; background: #6c757d; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">
                                取消
                            </button>
                            <button id="gg_vm_prompt_confirm" style="flex: 1; padding: 5px; background: ${UI.c}; color: ${UI.tc}; border: none; border-radius: 3px; cursor: pointer; font-size: 10px; font-weight: 600;">
                                确认
                            </button>
                        </div>
                    </div>
                `;

                // 移除旧弹窗
                $('#gg-vm-prompt-pop').remove();

                // 创建弹窗 - ✅ 去掉遮罩，改用透明背景
                const $o = $('<div>', {
                    id: 'gg-vm-prompt-pop',
                    class: 'g-ov',
                    css: {
                        'z-index': '10000006',
                        'background': 'transparent',  // ✅ 关键：透明背景，不挡住后面内容
                        'pointer-events': 'none'      // ✅ 关键：鼠标事件穿透，可以点击背景
                    }
                });
                // ✅ 修复：使用 attr('style') 并加上 !important 来覆盖 style.css 的全局强制样式
                const $p = $('<div>', {
                    class: 'g-w'
                }).attr('style', 'width: 300px !important; height: auto !important; max-width: 90vw !important; min-height: 150px !important; pointer-events: auto; display: flex; flex-direction: column; margin: auto !important; position: relative !important; bottom: auto !important; left: auto !important; transform: none !important; border-radius: 12px !important;');

                // 标题栏
                const $hd = $('<div>', { class: 'g-hd' });
                $hd.append(`<h3 style="color:${UI.tc}; flex:1;">${this._escapeHtml(title)}</h3>`);

                // 关闭按钮
                const $x = $('<button>', {
                    class: 'g-x',
                    text: '×',
                    css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' }
                }).on('click', () => {
                    $o.remove();
                    resolve(null);
                });
                $hd.append($x);

                // 内容区
                const $bd = $('<div>', { class: 'g-bd', html: html });
                $p.append($hd, $bd);
                $o.append($p);
                $('body').append($o);

                // 绑定事件
                setTimeout(() => {
                    const $input = $('#gg_vm_prompt_input');

                    // 聚焦并选中文本
                    $input.focus().select();

                    // 回车确认
                    $input.on('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            $('#gg_vm_prompt_confirm').click();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            $('#gg_vm_prompt_cancel').click();
                        }
                    });

                    // 取消按钮
                    $('#gg_vm_prompt_cancel').on('click', () => {
                        $o.remove();
                        resolve(null);
                    });

                    // 确认按钮
                    $('#gg_vm_prompt_confirm').on('click', () => {
                        const value = $input.val().trim();
                        $o.remove();
                        resolve(value || defaultValue);
                    });
                }, 100);
            });
        }

        /**
         * ⚠️ 自定义确认对话框
         * @param {string} message - 确认消息
         * @param {string} title - 弹窗标题
         * @returns {Promise<boolean>} - 用户确认返回 true，取消返回 false
         * @private
         */
        _customConfirm(message, title = '⚠️ 确认操作') {
            const UI = window.Gaigai?.ui || { c: '#dfdcdcff', bc: '#ffffff', tc: '#000000ff', darkMode: false };

            return new Promise((resolve) => {
                const html = `
                    <div class="g-p" style="padding: 15px;">
                        <div style="font-size: 13px; color: ${UI.tc}; line-height: 1.6; margin-bottom: 15px; white-space: pre-wrap;">${this._escapeHtml(message)}</div>
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button id="gg_vm_confirm_cancel" style="padding: 8px 16px; background: #6c757d; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                取消
                            </button>
                            <button id="gg_vm_confirm_ok" style="padding: 8px 16px; background: #f44336; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                确认删除
                            </button>
                        </div>
                    </div>
                `;

                // 移除旧弹窗
                $('#gg-vm-confirm-pop').remove();

                // 创建弹窗 - ✅ 去掉遮罩，改用透明背景
                const $o = $('<div>', {
                    id: 'gg-vm-confirm-pop',
                    class: 'g-ov',
                    css: {
                        'z-index': '10000006',
                        'background': 'transparent',  // ✅ 关键：透明背景，不挡住后面内容
                        'pointer-events': 'none'      // ✅ 关键：鼠标事件穿透，可以点击背景
                    }
                });

                const $p = $('<div>', {
                    class: 'g-w'
                }).attr('style', 'width: 350px !important; height: auto !important; max-width: 90vw !important; min-height: 150px !important; pointer-events: auto; display: flex; flex-direction: column; margin: auto !important; position: relative !important; bottom: auto !important; left: auto !important; transform: none !important; border-radius: 12px !important;');

                // 标题栏
                const $hd = $('<div>', { class: 'g-hd' });
                $hd.append(`<h3 style="color:${UI.tc}; flex:1;">${this._escapeHtml(title)}</h3>`);

                // 关闭按钮
                const $x = $('<button>', {
                    class: 'g-x',
                    text: '×',
                    css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' }
                }).on('click', () => {
                    $o.remove();
                    resolve(false);
                });
                $hd.append($x);

                // 内容区
                const $bd = $('<div>', { class: 'g-bd', html: html });
                $p.append($hd, $bd);
                $o.append($p);
                $('body').append($o);

                // 绑定事件
                setTimeout(() => {
                    // 取消按钮
                    $('#gg_vm_confirm_cancel').on('click', () => {
                        $o.remove();
                        resolve(false);
                    });

                    // 确认按钮
                    $('#gg_vm_confirm_ok').on('click', () => {
                        $o.remove();
                        resolve(true);
                    });

                    // ESC 键取消
                    $(document).on('keydown.gg_vm_confirm', (e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            $o.remove();
                            resolve(false);
                            $(document).off('keydown.gg_vm_confirm');
                        }
                    });

                    // 聚焦确认按钮
                    $('#gg_vm_confirm_ok').focus();
                }, 100);
            });
        }

        /**
         * 🎨 大型文本编辑器弹窗
         * @param {string} title - 弹窗标题
         * @param {string} content - 初始文本内容
         * @returns {Promise<string|null>} - 用户编辑后的内容，取消时返回 null
         * @private
         */
        _customBigEditor(title, content) {
            const UI = window.Gaigai?.ui || { c: '#dfdcdcff', bc: '#ffffff', tc: '#000000ff', darkMode: false };

            return new Promise((resolve) => {
                const html = `
                    <div class="g-p" style="padding: 12px; display: flex; flex-direction: column; height: 100%;">
                        <div style="font-size: 10px; color: ${UI.tc}; opacity: 0.7; margin-bottom: 8px;">
                            💡 提示：修改后会自动重置向量状态，需重新向量化
                        </div>
                        <textarea
                            id="gg_vm_big_editor"
                            style="flex: 1; width: 100%; padding: 10px; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; background: rgba(0,0,0,0.3); color: ${UI.tc}; font-size: 12px; font-family: monospace; resize: none; box-sizing: border-box;"
                        >${this._escapeHtml(content)}</textarea>
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button id="gg_vm_editor_cancel" style="flex: 1; padding: 8px; background: #6c757d; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                                取消
                            </button>
                            <button id="gg_vm_editor_save" style="flex: 1; padding: 8px; background: ${UI.c}; color: ${UI.tc}; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                                💾 保存
                            </button>
                        </div>
                    </div>
                `;

                // 移除旧弹窗
                $('#gg-vm-editor-pop').remove();

                // 创建弹窗
                const $o = $('<div>', {
                    id: 'gg-vm-editor-pop',
                    class: 'g-ov',
                    css: {
                        'z-index': '10000007',
                        'background': 'rgba(0,0,0,0.5)'
                    }
                });

                const $p = $('<div>', {
                    class: 'g-w'
                }).attr('style', 'width: 800px !important; height: 600px !important; max-width: 95vw !important; max-height: 90vh !important; display: flex !important; flex-direction: column !important; margin: auto !important; position: relative !important; bottom: auto !important; left: auto !important; transform: none !important; border-radius: 12px !important;');

                // 标题栏
                const $hd = $('<div>', { class: 'g-hd' });
                $hd.append(`<h3 style="color:${UI.tc}; flex:1;">${this._escapeHtml(title)}</h3>`);

                // 关闭按钮
                const $x = $('<button>', {
                    class: 'g-x',
                    text: '×',
                    css: { background: 'none', border: 'none', color: UI.tc, cursor: 'pointer', fontSize: '22px' }
                }).on('click', () => {
                    $o.remove();
                    resolve(null);
                });
                $hd.append($x);

                // 内容区
                const $bd = $('<div>', { class: 'g-bd', html: html, css: { flex: '1', display: 'flex', flexDirection: 'column' } });
                $p.append($hd, $bd);
                $o.append($p);
                $('body').append($o);

                // 绑定事件
                setTimeout(() => {
                    const $textarea = $('#gg_vm_big_editor');

                    // 聚焦
                    $textarea.focus();

                    // 取消按钮
                    $('#gg_vm_editor_cancel').on('click', () => {
                        $o.remove();
                        resolve(null);
                    });

                    // 保存按钮
                    $('#gg_vm_editor_save').on('click', () => {
                        const value = $textarea.val();
                        $o.remove();
                        resolve(value);
                    });
                }, 100);
            });
        }

        /**
         * 🔗 绑定 UI 事件
         * @private
         */
        _bindUIEvents() {
            const self = this;
            const customAlert = window.Gaigai?.customAlert || alert;
            const m = window.Gaigai?.m;

            // ✅ 总开关：点击立即同步并保存
            $('#gg_vm_global_enabled').off('change').on('change', async function () {
                const C = window.Gaigai.config_obj;
                const isEnabled = $(this).is(':checked');

                // 1. 同步到内存配置
                C.vectorEnabled = isEnabled;

                // 2. 存入 localStorage
                try {
                    localStorage.setItem('gg_config', JSON.stringify(C));
                } catch (e) {
                    console.warn('⚠️ [VectorManager] localStorage 保存失败:', e);
                }

                // 3. 实时反馈
                console.log(`💠 [设置] 独立向量检索已${isEnabled ? '开启' : '关闭'}`);

                // 4. 同步到云端
                if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                    await window.Gaigai.saveAllSettingsToCloud().catch(() => { });
                }

                // 5. 用户提示
                if (typeof toastr !== 'undefined') {
                    toastr.success(`向量检索已${isEnabled ? '开启' : '关闭'}`, '设置更新', { timeOut: 1500 });
                }
            });

            // 阈值滑块实时更新
            $('#gg_vm_threshold').off('input').on('input', function () {
                const val = parseFloat($(this).val());
                $('#gg_vm_threshold_val').text(val.toFixed(2));
            });

            // 密码显示/隐藏切换
            $('.gg-vm-toggle-key').off('click').on('click', function () {
                const targetId = $(this).data('target');
                const $input = $(`#${targetId}`);
                const currentType = $input.attr('type');

                if (currentType === 'password') {
                    $input.attr('type', 'text');
                    $(this).removeClass('fa-eye').addClass('fa-eye-slash');
                } else {
                    $input.attr('type', 'password');
                    $(this).removeClass('fa-eye-slash').addClass('fa-eye');
                }
            });

            // 保存配置
            $('#gg_vm_save').off('click').on('click', async () => {
                try {
                    const C = window.Gaigai.config_obj;

                    // API 配置
                    C.vectorUrl = $('#gg_vm_url').val().trim();
                    C.vectorKey = $('#gg_vm_key').val().trim();
                    C.vectorModel = $('#gg_vm_model').val().trim();

                    // 检索参数
                    const rawThreshold = parseFloat($('#gg_vm_threshold').val());
                    C.vectorThreshold = isNaN(rawThreshold) ? 0.6 : rawThreshold;
                    C.vectorMaxCount = parseInt($('#gg_vm_max_count').val()) || 3;
                    C.vectorContextDepth = parseInt($('#gg_vm_context_depth').val()) || 1;
                    C.vectorSeparator = $('#gg_vm_separator').val().trim() || '===';

                    // Rerank 配置
                    C.rerankEnabled = $('#gg_vm_rerank_enabled').is(':checked');
                    C.rerankUrl = $('#gg_vm_rerank_url').val().trim() || 'https://api.siliconflow.cn/v1/rerank';
                    C.rerankKey = $('#gg_vm_rerank_key').val().trim();
                    C.rerankModel = $('#gg_vm_rerank_model').val().trim() || 'BAAI/bge-reranker-v2-m3';

                    // 保存到 localStorage
                    try {
                        localStorage.setItem('gg_config', JSON.stringify(C));
                    } catch (e) {
                        console.warn('⚠️ [VectorManager] localStorage 保存失败:', e);
                    }

                    if (m) m.save();
                    if (typeof window.Gaigai.saveAllSettingsToCloud === 'function') {
                        await window.Gaigai.saveAllSettingsToCloud();
                    }

                    if (typeof toastr !== 'undefined') {
                        toastr.success('配置已保存', '保存成功');
                    } else {
                        await customAlert('✅ 配置已保存', '保存成功');
                    }
                } catch (e) {
                    console.error('❌ [VectorManager] 保存失败:', e);
                    await customAlert(`❌ 保存失败\n\n${e.message}`, '错误');
                }
            });

            // 同步总结到书架
            $('#gg_vm_rebuild_table').off('click').on('click', async () => {
                const btn = $('#gg_vm_rebuild_table');
                const oldText = btn.html();

                try {
                    if (!m) {
                        await customAlert('⚠️ Memory Manager 不可用', '错误');
                        return;
                    }

                    btn.html('<i class="fa-solid fa-spinner fa-spin"></i> 同步中...').prop('disabled', true);

                    const result = await self.syncSummaryToBook();

                    if (result.success) {
                        if (typeof toastr !== 'undefined') {
                            toastr.success(`已同步 ${result.count} 条总结到《剧情总结归档》`, '同步成功');
                        } else {
                            await customAlert(`✅ 同步成功\n\n已同步 ${result.count} 条总结`, '成功');
                        }

                        // 自动选中新创建/更新的书籍
                        self.selectedBookId = result.bookId;
                        self.showUI();
                    } else {
                        throw new Error(result.error || '同步失败');
                    }
                } catch (e) {
                    console.error('❌ [VectorManager] 同步失败:', e);
                    await customAlert(`❌ 同步失败\n\n${e.message}`, '错误');
                } finally {
                    btn.html(oldText).prop('disabled', false);
                }
            });

            // 新建空白书
            $('#gg_vm_create_book').off('click').on('click', async () => {
                try {
                    // 使用自定义弹窗询问书名
                    const bookName = await self._customPrompt(
                        '请输入新书名称：',
                        '📝 新建空白书',
                        '未命名知识库'
                    );
                    if (bookName === null || !bookName.trim()) return; // 用户取消或空白

                    // 生成书籍 ID
                    const bookId = self._generateUUID();

                    // 创建空白书籍对象
                    self.library[bookId] = {
                        name: bookName.trim(),
                        chunks: [],
                        vectors: [],
                        vectorized: [],
                        createTime: Date.now()
                    };

                    // 保存到全局
                    self.saveLibrary();

                    if (typeof toastr !== 'undefined') {
                        toastr.success(`已创建空白书《${bookName.trim()}》`, '创建成功');
                    } else {
                        await customAlert(`✅ 创建成功\\n\\n书名: ${bookName.trim()}`, '成功');
                    }

                    // 自动选中新创建的书籍
                    self.selectedBookId = bookId;
                    self.showUI();
                } catch (e) {
                    console.error('❌ [VectorManager] 创建空白书失败:', e);
                    await customAlert(`❌ 创建失败\\n\\n${e.message}`, '错误');
                }
            });

            // 导入新书
            $('#gg_vm_import_book').off('click').on('click', () => {
                $('#gg_vm_book_file').click();
            });

            $('#gg_vm_book_file').off('change').on('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    // ✅ 使用自定义弹窗询问书名
                    const bookName = await self._customPrompt(
                        '请输入书名（留空则使用文件名）：',
                        '📚 导入新书',
                        file.name
                    );
                    if (bookName === null) return; // 用户取消

                    const result = await self.importBook(file, bookName || null);

                    if (result.success) {
                        if (typeof toastr !== 'undefined') {
                            toastr.success(`已导入《${self.library[result.bookId].name}》，共 ${result.count} 个片段`, '导入成功');
                        } else {
                            await customAlert(`✅ 导入成功\n\n已切分为 ${result.count} 个片段`, '成功');
                        }
                        // ✅ 自动选中新导入的书籍
                        self.selectedBookId = result.bookId;
                        self.showUI();
                    } else {
                        throw new Error(result.error || '导入失败');
                    }
                } catch (e) {
                    console.error('❌ [VectorManager] 导入失败:', e);
                    await customAlert(`❌ 导入失败\n\n${e.message}`, '错误');
                } finally {
                    $('#gg_vm_book_file').val('');
                }
            });

            // 导入图书馆备份
            $('#gg_vm_import_all').off('click').on('click', () => {
                $('#gg_vm_backup_file').click();
            });

            $('#gg_vm_backup_file').off('change').on('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const result = await self.importVectors(file);

                    if (result.success) {
                        const message = `成功恢复 ${result.bookCount} 本书`;
                        if (typeof toastr !== 'undefined') {
                            toastr.success(message, '导入成功');
                        } else {
                            await customAlert(`✅ ${message}`, '导入成功');
                        }

                        // 刷新界面以显示恢复的书籍
                        self.showUI();
                    } else {
                        throw new Error(result.error || '导入失败');
                    }
                } catch (e) {
                    console.error('❌ [VectorManager] 导入备份失败:', e);
                    await customAlert(`❌ 导入备份失败\n\n${e.message}`, '错误');
                } finally {
                    $('#gg_vm_backup_file').val('');
                }
            });

            // 导出图书馆（支持仅导出勾选书籍）
            $('#gg_vm_export_all').off('click').on('click', async () => {
                try {
                    if (Object.keys(self.library).length === 0) {
                        await customAlert('⚠️ 没有可导出的数据', '提示');
                        return;
                    }

                    // 获取所有勾选的书籍ID
                    const checkedBookIds = [];
                    $('.gg-book-checkbox:checked').each(function() {
                        const bookId = $(this).data('id');
                        if (bookId) {
                            checkedBookIds.push(bookId);
                        }
                    });

                    // 根据是否有勾选书籍决定导出内容
                    let content;
                    let successMessage;
                    if (checkedBookIds.length > 0) {
                        content = self.exportVectors(checkedBookIds);
                        successMessage = `已导出选中的 ${checkedBookIds.length} 本书`;
                    } else {
                        content = self.exportVectors(null);
                        successMessage = '图书馆已导出';
                    }

                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `gaigai_vectors_library_${new Date().getTime()}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);

                    if (typeof toastr !== 'undefined') {
                        toastr.success(successMessage, '成功');
                    }
                } catch (e) {
                    console.error('❌ [VectorManager] 导出失败:', e);
                    await customAlert(`❌ 导出失败\n\n${e.message}`, '错误');
                }
            });

            // 书籍复选框
            $(document).off('change', '.gg-book-checkbox').on('change', '.gg-book-checkbox', function (e) {
                e.stopPropagation();
                const bookId = $(this).data('id');
                const isChecked = $(this).is(':checked');

                let activeBooks = self.getActiveBooks();

                if (isChecked) {
                    if (!activeBooks.includes(bookId)) {
                        activeBooks.push(bookId);
                    }
                } else {
                    activeBooks = activeBooks.filter(id => id !== bookId);
                }

                self.setActiveBooks(activeBooks);

                if (typeof toastr !== 'undefined') {
                    toastr.info(isChecked ? '已绑定到当前会话' : '已取消绑定', '书籍绑定', { timeOut: 1000 });
                }
            });

            // 点击书籍项（选择书籍查看详情）
            $(document).off('click', '.gg-book-item').on('click', '.gg-book-item', function (e) {
                const bookId = $(this).data('id');
                self.selectedBookId = bookId;

                // 更新 UI
                $('.gg-book-item').css('border-color', 'rgba(255,255,255,0.1)');
                $(this).css('border-color', '#4CAF50');

                // 刷新详情区
                $('#gg_vm_detail_area').html(self._renderDetailArea(window.Gaigai.ui));

                // 重新绑定详情区的事件
                self._bindDetailEvents();
            });

            // 删除书籍
            $(document).off('click', '.gg-book-delete').on('click', '.gg-book-delete', async function (e) {
                e.stopPropagation();
                const bookId = $(this).data('id');
                const book = self.library[bookId];

                // 使用自定义确认对话框
                const confirmed = await self._customConfirm(
                    `确定要删除《${book.name}》吗？\n这将删除所有片段和向量数据（不可恢复）`,
                    '⚠️ 删除书籍'
                );

                if (confirmed) {
                    self.deleteBook(bookId);

                    // 如果删除的是当前选中的书，清空选中状态
                    if (self.selectedBookId === bookId) {
                        self.selectedBookId = null;
                    }

                    self.showUI();
                    if (typeof toastr !== 'undefined') {
                        toastr.success('书籍已删除', '完成');
                    }
                }
            });

            // 绑定详情区事件
            this._bindDetailEvents();
        }

        /**
         * 🔗 绑定详情区事件
         * @private
         */
        _bindDetailEvents() {
            const self = this;
            const customAlert = window.Gaigai?.customAlert || alert;

            // 重命名书籍
            $('#gg_vm_rename_book').off('click').on('click', async () => {
                try {
                    if (!self.selectedBookId) {
                        await customAlert('⚠️ 未选择书籍', '提示');
                        return;
                    }

                    const book = self.library[self.selectedBookId];
                    if (!book) {
                        await customAlert('⚠️ 书籍不存在', '错误');
                        return;
                    }

                    // 使用自定义弹窗询问新书名
                    const newName = await self._customPrompt(
                        '请输入新的书名：',
                        '📝 重命名书籍',
                        book.name
                    );

                    if (newName === null || !newName.trim()) return; // 用户取消或输入为空

                    // 检查是否有变化
                    if (newName.trim() === book.name) {
                        if (typeof toastr !== 'undefined') {
                            toastr.info('书名未改变', '提示');
                        }
                        return;
                    }

                    // 更新书名
                    book.name = newName.trim();

                    // 保存到全局
                    self.saveLibrary();

                    if (typeof toastr !== 'undefined') {
                        toastr.success(`已重命名为《${newName.trim()}》`, '重命名成功');
                    } else {
                        await customAlert(`✅ 重命名成功\n\n新书名: ${newName.trim()}`, '成功');
                    }

                    // 刷新整个界面（左侧书架列表和右侧详情都会更新）
                    self.showUI();
                } catch (e) {
                    console.error('❌ [VectorManager] 重命名书籍失败:', e);
                    await customAlert(`❌ 重命名失败\n\n${e.message}`, '错误');
                }
            });

            // 编辑/追加源文本
            $('#gg_vm_edit_source').off('click').on('click', async () => {
                try {
                    if (!self.selectedBookId) {
                        await customAlert('⚠️ 未选择书籍', '提示');
                        return;
                    }

                    const book = self.library[self.selectedBookId];
                    if (!book) {
                        await customAlert('⚠️ 书籍不存在', '错误');
                        return;
                    }

                    // 获取当前配置的分隔符
                    const config = self._getConfig();
                    const separator = config.separator || '===';

                    // 将 chunks 拼接回整段文本
                    const currentText = book.chunks.join('\n' + separator + '\n');

                    // 调用大型编辑器
                    const newText = await self._customBigEditor(
                        `✏️ 编辑《${book.name}》源文本`,
                        currentText
                    );

                    if (newText === null) return; // 用户取消

                    // ✅ 变量替换：将 {{user}} 和 {{char}} 替换为实际名字
                    const processedText = self._resolvePlaceholders(newText);

                    // 重新切分文本
                    let newChunks = [];
                    if (separator === '\\n' || separator === '\n') {
                        newChunks = processedText.split('\n').filter(line => line.trim());
                    } else {
                        newChunks = processedText.split(separator).filter(chunk => chunk.trim());
                    }

                    // 更新书籍数据
                    book.chunks = newChunks.map(chunk => chunk.trim());
                    book.vectors = new Array(newChunks.length).fill(null);
                    book.vectorized = new Array(newChunks.length).fill(false);

                    // 保存到全局
                    self.saveLibrary();

                    if (typeof toastr !== 'undefined') {
                        toastr.success(`已更新《${book.name}》，共 ${newChunks.length} 个片段（向量已重置）`, '保存成功');
                    } else {
                        await customAlert(`✅ 保存成功\\n\\n片段数: ${newChunks.length}\\n向量状态已重置，请重新向量化`, '成功');
                    }

                    // 刷新详情区
                    $('#gg_vm_detail_area').html(self._renderDetailArea(window.Gaigai.ui));
                    self._bindDetailEvents();

                    // 刷新书架列表（更新进度）
                    const activeBooks = self.getActiveBooks();
                    $('#gg_vm_book_list').html(self._renderBookList(window.Gaigai.ui, activeBooks));
                } catch (e) {
                    console.error('❌ [VectorManager] 编辑源文本失败:', e);
                    await customAlert(`❌ 编辑失败\\n\\n${e.message}`, '错误');
                }
            });

            // 向量化当前书籍
            $('#gg_vm_vectorize_book').off('click').on('click', async () => {
                const btn = $('#gg_vm_vectorize_book');
                const oldText = btn.html();

                try {
                    if (!self.selectedBookId) {
                        await customAlert('⚠️ 未选择书籍', '提示');
                        return;
                    }

                    const url = $('#gg_vm_url').val().trim();
                    const key = $('#gg_vm_key').val().trim();

                    if (!url || !key) {
                        await customAlert('⚠️ 未配置 API\n\n请先填写 API 地址和密钥。', '配置不完整');
                        return;
                    }

                    btn.prop('disabled', true);

                    const result = await self.vectorizeBook(self.selectedBookId, (current, total) => {
                        btn.html(`<i class="fa-solid fa-spinner fa-spin"></i> 向量化中... ${current}/${total}`);
                    });

                    if (result.success) {
                        // ✅ 检查是否所有片段都失败了
                        if (result.count === 0 && result.errors > 0) {
                            // 所有片段处理失败，显示详细错误信息
                            await customAlert(
                                `❌ 所有片段处理失败！\n\n原因: ${result.lastError || '未知错误'}\n\n请检查 API 地址、密钥和模型名称是否正确。`,
                                '⚠️ 向量化失败'
                            );
                        } else {
                            // 至少有部分成功
                            if (typeof toastr !== 'undefined') {
                                toastr.success(`成功向量化 ${result.count} 个片段`, '完成');
                            } else {
                                await customAlert(`✅ 向量化完成\n\n成功: ${result.count} 条`, '成功');
                            }
                        }

                        // 刷新详情区
                        $('#gg_vm_detail_area').html(self._renderDetailArea(window.Gaigai.ui));
                        self._bindDetailEvents();

                        // 刷新书架列表（更新进度）
                        const activeBooks = self.getActiveBooks();
                        $('#gg_vm_book_list').html(self._renderBookList(window.Gaigai.ui, activeBooks));
                    } else {
                        throw new Error('向量化失败');
                    }
                } catch (e) {
                    console.error('❌ [VectorManager] 向量化失败:', e);
                    await customAlert(`❌ 向量化失败\n\n${e.message}`, '错误');
                } finally {
                    btn.html(oldText).prop('disabled', false);
                }
            });

            // 点击片段查看完整内容
            $(document).off('click', '.gg-chunk-item').on('click', '.gg-chunk-item', async function () {
                const index = parseInt($(this).data('index'));
                const book = self.library[self.selectedBookId];

                if (book && book.chunks[index]) {
                    await customAlert(book.chunks[index], `片段 ${index} (共 ${book.chunks.length} 个)`);
                }
            });
        }
    }

    // 挂载到 window.Gaigai.VM 命名空间
    if (!window.Gaigai) window.Gaigai = {};
    window.Gaigai.VM = new VectorManager();

    console.log('✅ [VectorManager] 已挂载到 window.Gaigai.VM (图书馆架构)');
})();
