# AI Agent 开发知识总结

> 本文档根据项目代码自动整理，涵盖各子项目的核心知识点、关键 API、面试题及学习思路。

---

## 目录

1. [项目总览](#项目总览)
2. [tool — LangChain 工具调用 & MCP](#tool--langchain-工具调用--mcp)
3. [rag-test — RAG 基础 & 文本分割](#rag-test--rag-基础--文本分割)
4. [milvus-test — 向量数据库 Milvus](#milvus-test--向量数据库-milvus)
5. [memory-test — 对话记忆管理](#memory-test--对话记忆管理)
6. [output-parser-test — 结构化输出解析](#output-parser-test--结构化输出解析)
7. [prompt-template-test — Prompt 模板工程](#prompt-template-test--prompt-模板工程)
8. [runnable-test — LangChain Runnable / LCEL](#runnable-test--langchain-runnable--lcel)
9. [threejs-test — Three.js WebGL 可视化](#threejs-test--threejs-webgl-可视化)
10. [通用 AI 知识点](#通用-ai-知识点)
11. [高频面试题](#高频面试题)

---

## 项目总览

| 子项目 | 核心主题 | 关键技术 |
|--------|----------|----------|
| `tool` | 工具调用 / Agent 循环 / MCP 协议 | LangChain Tools, MCP SDK, Zod |
| `rag-test` | RAG 流程 / 文本分割 / Embedding | LangChain Splitters, MemoryVectorStore, Tiktoken |
| `milvus-test` | 向量数据库 CRUD / 电子书 RAG | Milvus, EPubLoader, IVF_FLAT 索引 |
| `memory-test` | 对话历史 / 截断 / 摘要 / 检索记忆 | InMemoryChatMessageHistory, trimMessages, Milvus |
| `output-parser-test` | 结构化输出 / 流式解析 / XML 解析 | JsonOutputParser, StructuredOutputParser, withStructuredOutput, XMLOutputParser |
| `prompt-template-test` | Prompt 模板化 / Few-shot / ExampleSelector / Pipeline | PromptTemplate, ChatPromptTemplate, FewShotPromptTemplate, PipelinePromptTemplate, Milvus |
| `runnable-test` | Runnable 链式编排 / 分支 / 路由 / 消息历史 | LCEL, RunnableSequence, RunnableLambda, RunnableMap, RunnableBranch, RunnableWithMessageHistory |
| `threejs-test` | WebGL 物理模拟 / 滚动序列帧动画 | Three.js, Verlet 积分, Canvas API, IntersectionObserver |

### 运行与环境约定

- 项目使用 pnpm，`package.json` 中只登记了少量快捷脚本，更多示例需要直接用 `node 子路径/文件名.mjs` 运行。
- 项目是 ESM：`package.json` 中配置了 `"type": "module"`。
- 多数 AI 示例通过 `load-env.mjs` 从项目根目录 `.env` 读取环境变量。
- 代码中同时出现 DMX、OpenAI、NVIDIA、ModelScope 等不同模型提供方配置，运行某个脚本前要先看该文件实际读取的环境变量。
- `pnpm-workspace.yaml` 当前只保存 pnpm 构建脚本审批状态：`allowBuilds.protobufjs: true`，不是 monorepo 包扫描配置。

---

## tool — LangChain 工具调用 & MCP

### 核心概念

**Tool（工具）** 是 Agent 与外部世界交互的接口。LLM 本身只能生成文本，工具让它能读文件、执行命令、查数据库等。

**Agent 循环（ReAct Loop）**：
```
用户输入 → LLM 思考 → 决定调用工具 → 执行工具 → 结果返回给 LLM → 继续思考 → ... → 最终回复
```

**MCP（Model Context Protocol）** 是 Anthropic 提出的标准协议，让 AI 模型通过统一接口调用外部工具和资源，类似工具调用的"USB 标准"。

### 关键 API

```js
// 1. 定义工具（用 Zod 做参数校验）
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const readFileTool = tool(
    async ({ filePath }) => { /* 实现 */ },
    {
        name: 'read_file',
        description: '读取文件内容',          // LLM 靠这个决定何时调用
        schema: z.object({
            filePath: z.string().describe('文件路径'),
        }),
    }
);

// 2. 绑定工具到模型
const modelWithTools = model.bindTools([readFileTool, writeFileTool]);

// 3. Agent 循环核心逻辑
const response = await modelWithTools.invoke(messages);
if (response.tool_calls?.length > 0) {
    for (const toolCall of response.tool_calls) {
        const result = await foundTool.invoke(toolCall.args);
        messages.push(new ToolMessage({
            content: result,
            tool_call_id: toolCall.id,   // 必须对应，LLM 靠此匹配结果
        }));
    }
}
```

```js
// 4. 自定义 MCP Server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({ name: 'my-mcp-server', version: '1.0.0' }, {
    capabilities: { tools: {}, resources: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...] }));
server.setRequestHandler(CallToolRequestSchema, async (request) => { /* 处理调用 */ });

const transport = new StdioServerTransport();
await server.connect(transport);

// 5. 客户端连接 MCP Server
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        'amap': { url: 'https://mcp.amap.com/mcp?key=YOUR_KEY' },           // HTTP 方式
        'local': { command: 'node', args: ['src/my-mcp-server.mjs'] },      // Stdio 方式
    }
});
const tools = await mcpClient.getTools();
```

### 项目文件说明

| 文件 | 内容 |
|------|------|
| `hello-langchain.mjs` | 最基础的 LangChain 调用，验证模型连通性 |
| `tool-file-read.mjs` | 单工具调用演示，手动实现工具循环 |
| `all-tools.mjs` | 封装并导出 4 个工具：读文件、写文件、执行命令、列目录 |
| `mini-cursor.mjs` | 完整 Agent：让 AI 自主创建 React 项目，类 Cursor |
| `my-mcp-server.mjs` | 自定义 MCP Server，暴露工具 + 资源 |
| `mcp-test.mjs` | 连接高德地图 MCP，查询天气（HTTP 方式） |
| `node-exec.mjs` | 单独验证 `spawn + shell` 执行命令的行为 |

### 学习思路

1. 先理解 `tool_calls` 的数据结构（name / args / id）
2. 理解为什么需要 `ToolMessage` 以及 `tool_call_id` 的作用
3. 手写一个完整的 while 循环，不依赖框架封装
4. 再看 `all-tools.mjs`：理解工具如何被复用到多个 Agent 示例
5. 最后看 MCP：理解 Stdio vs HTTP 两种传输方式的区别

---

## rag-test — RAG 基础 & 文本分割

### 核心概念

**RAG（Retrieval-Augmented Generation，检索增强生成）** 的核心思路：
```
文档 → Embedding（向量化）→ 存入向量库
用户提问 → Embedding → 向量相似度搜索 → 取出相关文档 → 拼入 Prompt → LLM 回答
```

**为什么需要文本分割？**
- LLM 有 context window 限制
- 整篇文档向量化后语义太模糊，分块后检索更精准
- 分块大小（chunk size）影响检索质量和成本

**Token vs 字符**：
- 1 个英文单词 ≈ 1 token；1 个中文字 ≈ 2-3 tokens
- 模型计费和 context 限制都按 token 算，不是字符数

### 文本分割器对比

| 分割器 | 特点 | 适用场景 |
|--------|------|----------|
| `CharacterTextSplitter` | 严格按指定分隔符切，超出 chunkSize 也不强制拆 | 日志、CSV 等结构固定的文本 |
| `RecursiveCharacterTextSplitter` | 递归尝试多个分隔符，**优先保持语义完整** | **通用首选**，绝大多数场景 |
| `TokenTextSplitter` | 按 token 数量精确切割 | 需要严格控制 token 预算时 |
| `MarkdownTextSplitter` | 按 Markdown 标题层级切 | README、文档站 |
| `RecursiveCharacterTextSplitter.fromLanguage('js')` | 按代码语法结构切 | 代码文件 |

### 关键 API

```js
// 文本分割
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 400,       // 每块最大字符数
    chunkOverlap: 50,     // 块间重叠字符数（保持上下文连贯）
    separators: ["。", "！", "？"],  // 自定义分隔符优先级
});
const chunks = await splitter.splitDocuments(documents);

// Token 计数（js-tiktoken）
import { getEncoding } from "js-tiktoken";
const enc = getEncoding("cl100k_base");   // GPT-3.5/4 使用的编码
const tokenCount = enc.encode(text).length;

// 向量化 + 存储 + 检索（内存版）
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
const retriever = vectorStore.asRetriever({ k: 3 });
const docs = await retriever.invoke("用户问题");

// 带相似度分数的搜索
const results = await vectorStore.similaritySearchWithScore("问题", 3);
// results: [[Document, score], ...]  score 越小越相似（余弦距离）

// 网页加载器
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
const loader = new CheerioWebBaseLoader(url, { selector: '.main-area p' });
const docs = await loader.load();
```

### RAG Prompt 模板思路

```js
const prompt = `你是XXX助手。基于以下内容回答问题，如果内容中没有提到，就说"不知道"。

参考内容:
${context}   // 检索到的文档拼接

问题: ${question}

回答:`;
```

### 学习思路

1. 先跑通 `hello-rag.mjs`，理解 Document → Embedding → VectorStore → Retriever 的完整链路
2. 用 `tiktoken-test.mjs` 感受中英文 token 差异
3. 对比三种分割器的输出，理解 chunkOverlap 的作用
4. 思考：为什么相似度高的文档不一定是最好的答案？（语义相关 ≠ 答案正确）

### 项目文件说明

| 文件 | 内容 |
|------|------|
| `hello-rag.mjs` | 完整 RAG 链路演示：网页加载 → 分割 → 向量化 → 检索 → 回答 |
| `tiktoken-test.mjs` | 用 js-tiktoken 统计中英文 token 数，感受计费单位 |
| `CharacterTextSplitter-test.mjs` | 严格按分隔符切割，演示与 Recursive 的差异 |
| `RecursiveCharacterTextSplitter-test.mjs` | 递归分割器，通用首选，演示 chunkOverlap 效果 |
| `TokenTextSplitter-test.mjs` | 按 token 数精确切割，适合严格控制 token 预算 |
| `loader-and-splitter.mjs` | CheerioWebBaseLoader 加载网页 + RecursiveCharacterTextSplitter 分割 |
| `loader-and-splitter2.mjs` | 完整 RAG 流程：网页加载 → 分割 → MemoryVectorStore → 带相似度评分的检索 → LLM 回答 |
| `recursive-splitter-markdown.mjs` | MarkdownTextSplitter 按标题层级切割 Markdown 文档 |
| `recursive-splitter-latex.mjs` | RecursiveCharacterTextSplitter 处理 LaTeX 格式文档 |
| `recursive-splitter-code.mjs` | `fromLanguage('js')` 按代码语法结构切割 JS 代码 |
| `test/test-api.mjs` | 直接请求 ModelScope Chat Completions，验证模型接口连通性 |
| `test/test-embedding.mjs` | 直接请求 ModelScope Embeddings + Chat，验证嵌入和对话接口 |
| `test/test-models.mjs` | 逐个探测 MiniMax / Qwen 系列模型是否可用 |
| `test/test-qwen.mjs` | 单独探测 `Qwen/Qwen3-8B` 调用 |
| `test/test-minimax-params.mjs` | 验证 MiniMax 请求参数组合（`max_tokens` / `temperature` 等） |

---

## milvus-test — 向量数据库 Milvus

### 核心概念

**Milvus** 是专为向量搜索设计的开源数据库，支持十亿级向量的毫秒级检索。

**为什么不用普通数据库存向量？**
- 向量相似度搜索（ANN）需要专门的索引算法（IVF、HNSW 等）
- 普通数据库做全量向量比较，性能极差

**核心概念对照**：
```
Milvus Collection  ≈  关系型数据库的 Table
Field              ≈  Column
FloatVector Field  =  存储向量的特殊列
Index              =  加速向量搜索的索引结构
```

**相似度度量方式**：
- `COSINE`：余弦相似度，关注方向，不关注大小，**文本语义搜索首选**
- `L2`：欧氏距离，关注绝对距离
- `IP`：内积，向量已归一化时等价于余弦

### 关键 API

```js
import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';

const client = new MilvusClient({ address: 'localhost:19530' });
await client.connectPromise;

// 1. 创建集合（定义 Schema）
await client.createCollection({
    collection_name: 'my_collection',
    fields: [
        { name: 'id',      data_type: DataType.VarChar,     max_length: 100, is_primary_key: true },
        { name: 'vector',  data_type: DataType.FloatVector, dim: 1024 },
        { name: 'content', data_type: DataType.VarChar,     max_length: 5000 },
        { name: 'tags',    data_type: DataType.Array, element_type: DataType.VarChar, max_capacity: 10, max_length: 50 },
    ]
});

// 2. 创建索引（必须在 load 之前）
await client.createIndex({
    collection_name: 'my_collection',
    field_name: 'vector',
    index_type: IndexType.IVF_FLAT,   // 适合中小规模，精度高
    metric_type: MetricType.COSINE,
    params: { nlist: 1024 }           // 聚类中心数，越大越精确但越慢
});

// 3. 加载集合到内存（查询前必须执行）
await client.loadCollection({ collection_name: 'my_collection' });

// 4. 插入数据
await client.insert({
    collection_name: 'my_collection',
    data: [{ id: '001', vector: [...], content: '...' }]
});

// 5. 向量搜索
const result = await client.search({
    collection_name: 'my_collection',
    vector: queryVector,              // 查询向量
    limit: 5,                         // 返回 Top-K
    metric_type: MetricType.COSINE,
    output_fields: ['id', 'content'], // 返回哪些字段
});
// result.results[i].score  相似度分数

// 6. 更新 / 删除
await client.upsert({ collection_name: '...', data: [...] });
await client.delete({ collection_name: '...', ids: ['001'] });
```

### 电子书 RAG 完整流程

```
EPUB 文件
  ↓ EPubLoader（按章节加载）
  ↓ RecursiveCharacterTextSplitter（chunkSize=500）
  ↓ OpenAIEmbeddings（每块生成 1024 维向量）
  ↓ Milvus.insert（存储向量 + 原文）
  
用户提问
  ↓ embedQuery（问题向量化）
  ↓ Milvus.search（Top-K 相似片段）
  ↓ 拼接 Prompt
  ↓ ChatOpenAI（生成回答）
```

### 项目文件说明

| 文件 | 内容 |
|------|------|
| `insert.mjs` | 创建集合、索引，插入日记数据（含 Array 类型字段） |
| `query.mjs` | 向量相似度搜索 |
| `update.mjs` | upsert 更新数据 |
| `delete.mjs` | 按 ID 删除数据 |
| `rag.mjs` | 基于日记的 RAG 问答 |
| `ebook-writer.mjs` | 流式处理 EPUB，逐章节向量化写入 Milvus |
| `ebook-query.mjs` | 只做电子书向量检索，打印 Top-K 原文片段和分数 |
| `ebook-reader-rag.mjs` | 基于电子书内容的 RAG 问答 |

### 学习思路

1. 先用 Docker Compose 启动 Milvus（`milvus-standalone-docker-compose.yml`）
2. 跑通 insert → query 的基本 CRUD
3. 理解 `createCollection → createIndex → loadCollection` 的顺序不能乱
4. 再看 `rag.mjs`，理解向量数据库如何替代 MemoryVectorStore
5. 电子书链路先看 `ebook-writer.mjs` 写入，再看 `ebook-query.mjs` 检索，最后看 `ebook-reader-rag.mjs` 生成回答

---

## memory-test — 对话记忆管理

### 核心概念

LLM 本身是无状态的，每次调用都是独立的。"记忆"需要开发者手动管理，本质是**把历史消息拼入 Prompt**。

**三大记忆策略**：

```
策略1：截断（Truncation）
  保留最近 N 条消息 或 最近 M 个 Token
  优点：简单、可控  缺点：丢失早期信息

策略2：摘要（Summarization）
  旧消息 → LLM 总结成一段话 → 替换原始消息
  优点：保留语义  缺点：需要额外 LLM 调用，有信息损失

策略3：检索（Retrieval）
  所有历史 → 向量化存入 Milvus
  当前问题 → 语义搜索相关历史 → 注入 Prompt
  优点：无限历史、按需检索  缺点：架构复杂
```

### 关键 API

```js
// 内存历史（进程内，重启丢失）
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
const history = new InMemoryChatMessageHistory();
await history.addMessage(new HumanMessage("你好"));
await history.addMessage(aiResponse);
const messages = await history.getMessages();
await history.clear();

// 文件系统历史（持久化到 JSON 文件）
import { FileSystemChatMessageHistory } from "@langchain/community/stores/message/file_system";
const history = new FileSystemChatMessageHistory({
    filePath: './chat_history.json',
    sessionId: 'user_001',   // 支持多用户隔离
});

// 消息截断（按 token 数）
import { trimMessages } from "@langchain/core/messages";
const trimmed = await trimMessages(allMessages, {
    maxTokens: 200,
    tokenCounter: async (msgs) => countTokens(msgs, enc),
    strategy: "last",   // 保留最近的消息
});

// 对话转文本（用于摘要）
import { getBufferString } from "@langchain/core/messages";
const text = getBufferString(messages, { humanPrefix: "用户", aiPrefix: "助手" });
```

### 消息类型

```js
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

// msg.type:  'human' | 'ai' | 'system' | 'tool'
// msg.content: string
// AIMessage 还有 tool_calls 字段
```

### 项目文件说明

| 文件 | 内容 |
|------|------|
| `history-test.mjs` | InMemoryChatMessageHistory 基础用法 |
| `history-test2.mjs` | FileSystemChatMessageHistory，持久化到 JSON |
| `history-test3.mjs` | 从文件恢复历史，继续多轮对话 |
| `truncation-memory.mjs` | 按消息数截断 + 按 token 数截断（trimMessages） |
| `summarization-memory.mjs` | 按消息数触发摘要，用 LLM 压缩旧消息 |
| `summarization-memory2.mjs` | 按 token 数触发摘要，更精确的阈值控制 |
| `insert-conversations.mjs` | 预置对话数据到 Milvus（为检索记忆做准备） |
| `retrieval-memory.mjs` | 检索记忆：用 Milvus 语义搜索相关历史对话 |

### 学习思路

1. 先跑 `history-test.mjs`，理解最基础的多轮对话
2. 跑 `history-test2/3.mjs`，感受持久化的价值（重启后记忆还在）
3. 对比截断 vs 摘要：截断快但丢信息，摘要慢但保语义
4. 最后看检索记忆：理解这其实是 RAG 思想在记忆管理上的应用

---

## output-parser-test — 结构化输出解析

### 核心概念

LLM 默认返回自由文本，但实际开发中往往需要结构化数据（JSON、XML 等）。LangChain 提供多种解析器，从"提示词约束 + 手动解析"到"模型原生结构化输出"，复杂度和可靠性依次递增。

**五种方案对比**：

```
方案1：手动 JSON.parse（最简单，最脆弱）
  Prompt 里要求返回 JSON → 直接 JSON.parse(response.content)
  缺点：模型可能加 markdown 代码块，parse 会失败

方案2：JsonOutputParser / StructuredOutputParser（Prompt 工程）
  parser.getFormatInstructions() 自动生成格式说明注入 Prompt
  parser.parse() 自动处理 markdown 代码块、提取 JSON
  缺点：仍依赖模型遵守指令，复杂结构偶尔出错

方案3：withStructuredOutput（最推荐，底层用 Function Calling）
  model.withStructuredOutput(zodSchema) 直接返回已解析的对象
  优点：模型层面保证结构，不走文本解析，最可靠
  缺点：需要模型支持 Function Calling（主流模型都支持）

方案4：XMLOutputParser（特殊格式）
  适合需要 XML 格式输出的场景，用法与 JsonOutputParser 类似

方案5：原生 JSON Schema / response_format（提供方原生能力）
  Zod → JSON Schema → response_format.json_schema
  优点：不依赖 LangChain 解析器，直接约束模型返回纯 JSON
  缺点：依赖模型提供方是否支持该参数
```

### 关键 API

```js
// 1. JsonOutputParser —— 自动处理 markdown 代码块
import { JsonOutputParser } from '@langchain/core/output_parsers';
const parser = new JsonOutputParser();
const prompt = `请返回 JSON。\n\n${parser.getFormatInstructions()}`;
const response = await model.invoke(prompt);
const result = await parser.parse(response.content);  // 自动去掉 ```json ... ```

// 2. StructuredOutputParser.fromNamesAndDescriptions —— 简单字段定义
import { StructuredOutputParser } from '@langchain/core/output_parsers';
const parser = StructuredOutputParser.fromNamesAndDescriptions({
    name: "姓名",
    birth_year: "出生年份",
});

// 3. StructuredOutputParser.fromZodSchema —— 复杂嵌套结构 + 类型验证
import { z } from 'zod';
const schema = z.object({
    name: z.string().describe("科学家的全名"),
    awards: z.array(z.object({
        name: z.string(),
        year: z.number(),
    })).describe("获奖列表"),
});
const parser = StructuredOutputParser.fromZodSchema(schema);
const result = await parser.parse(response.content);  // 解析 + Zod 类型验证

// 4. withStructuredOutput —— 最可靠，直接返回对象（推荐）
const structuredModel = model.withStructuredOutput(schema);
const result = await structuredModel.invoke("介绍爱因斯坦");
// result 直接就是符合 schema 的对象，无需 parse

// 5. XMLOutputParser
import { XMLOutputParser } from '@langchain/core/output_parsers';
const parser = new XMLOutputParser();
const result = await parser.parse(response.content);

// 6. 流式结构化输出（先流式接收，完成后再解析）
const stream = await model.stream(prompt);
let fullContent = '';
for await (const chunk of stream) {
    fullContent += chunk.content;
    process.stdout.write(chunk.content);  // 实时显示
}
const result = await parser.parse(fullContent);  // 流结束后解析

// 7. 流式 Tool Calls（JsonOutputToolsParser）
import { JsonOutputToolsParser } from '@langchain/core/output_parsers/openai_tools';
const modelWithTool = model.bindTools([{ name: 'extract_info', schema }]);
const chain = modelWithTool.pipe(new JsonOutputToolsParser());
const stream = await chain.stream("介绍牛顿");
for await (const chunk of stream) {
    // chunk 是逐步累积的部分解析结果（partial JSON）
    console.log(chunk[0]?.args);
}

// 8. 原生 JSON Schema（Zod 转 JSON Schema，再传给模型提供方）
import { zodToJsonSchema } from "zod-to-json-schema";

const nativeJsonSchema = zodToJsonSchema(scientistSchema);
const model = new ChatOpenAI({
    modelName: process.env.NVIDIA_CHAT_MODEL,
    modelKwargs: {
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "scientist_info",
                strict: true,
                schema: nativeJsonSchema,
            },
        },
    },
});
```

### 解析器选型指南

| 场景 | 推荐方案 |
|------|----------|
| 简单 JSON，字段固定 | `withStructuredOutput` |
| 需要流式显示文本，最后再解析 | `StructuredOutputParser` + 流式接收 |
| 模型不支持 Function Calling | `StructuredOutputParser.fromZodSchema` |
| 需要 XML 格式 | `XMLOutputParser` |
| 流式 + 实时部分解析 | `bindTools` + `JsonOutputToolsParser` |
| 提供方支持原生 JSON Schema | `zod-to-json-schema` + `response_format.json_schema` |

### 项目文件说明

| 文件 | 内容 |
|------|------|
| `normal.mjs` | 最原始方式：Prompt 要求 JSON，手动 JSON.parse |
| `json-output-parser.mjs` | JsonOutputParser，自动处理 markdown 代码块 |
| `structured-output-parser.mjs` | StructuredOutputParser.fromNamesAndDescriptions，简单字段定义 |
| `structured-output-parser2.mjs` | StructuredOutputParser.fromZodSchema，复杂嵌套结构 + Zod 验证 |
| `with-structured-output.mjs` | model.withStructuredOutput，最推荐方式，底层用 Function Calling |
| `stream-normal.mjs` | 普通流式输出，实时打印文本 |
| `stream-structured-partial.mjs` | 流式接收完整文本，结束后用 StructuredOutputParser 解析 |
| `stream-tool-calls-raw.mjs` | bindTools + 流式，直接打印原始 tool_call_chunks.args |
| `stream-tool-calls-parser.mjs` | bindTools + JsonOutputToolsParser，流式逐步累积解析结果 |
| `structured-json-schema.mjs` | Zod 转 JSON Schema，并通过模型原生 `response_format.json_schema` 返回纯 JSON |
| `xml-output-parser.mjs` | XMLOutputParser，解析 XML 格式输出 |
| `test/create-table.mjs` | MySQL 建库建表，为结构化抽取落库准备 `friends` 表 |
| `test/smart-import.mjs` | `withStructuredOutput` 抽取好友数组，并批量写入 MySQL |
| `test/mini-cursor.mjs` | 结合共享工具、流式 `tool_call_chunks` 和 `JsonOutputToolsParser` 的 Agent 示例 |

### 学习思路

1. 先跑 `normal.mjs`，感受手动解析的脆弱性（模型可能加 ```json 代码块）
2. 跑 `json-output-parser.mjs`，看 `getFormatInstructions()` 生成了什么 Prompt
3. 跑 `with-structured-output.mjs`，对比可靠性差异，理解为什么这是首选
4. 再看 `structured-json-schema.mjs`，理解模型提供方原生结构化输出和 LangChain 解析器的区别
5. 最后看流式系列：理解"流式显示 + 最后解析"和"流式实时解析"的区别

---

## prompt-template-test — Prompt 模板工程

### 核心概念

Prompt 模板工程的目标是把一次性手写提示词拆成可复用、可组合、可动态选择的结构。

**四个层次**：

```
PromptTemplate
  单段字符串模板，适合普通 completion 或简单 chat 内容

ChatPromptTemplate
  多消息模板，显式区分 system / human / ai 等角色

FewShotPromptTemplate
  在正式任务前注入示例，让模型学习输出风格和结构

PipelinePromptTemplate
  把人设、背景、任务、格式等模块组合成最终 Prompt
```

**ExampleSelector** 的作用是自动选择示例：
- `LengthBasedExampleSelector`：根据长度预算选择示例，避免 few-shot 把上下文撑爆。
- `SemanticSimilarityExampleSelector`：根据当前输入语义，从向量库里选择最相关示例。

**MessagesPlaceholder** 用于把已有多轮对话历史插入到 `ChatPromptTemplate` 中，本质是把外部维护的消息数组接入模板。

### 关键 API

```js
// 1. 普通字符串模板
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate("请用 {tone} 的语气写一份 {topic} 周报");
const text = await prompt.format({ tone: "专业清晰", topic: "技术团队" });

// 2. ChatPromptTemplate：按消息角色组装
import { ChatPromptTemplate } from "@langchain/core/prompts";

const chatPrompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一名资深工程团队负责人，写作风格：{tone}。"],
    ["human", "本周信息如下：{dev_activities}"],
]);
const messages = await chatPrompt.formatMessages({
    tone: "专业、清晰",
    dev_activities: "- 完成 AI 助手灰度上线",
});

// 3. Few-shot 示例
import { FewShotPromptTemplate } from "@langchain/core/prompts";

const fewShotPrompt = new FewShotPromptTemplate({
    examples,
    examplePrompt,
    prefix: "下面是几条周报示例：",
    suffix: "请参考示例，为 {current_requirement} 写一份新周报。",
    inputVariables: ["current_requirement"],
});

// 4. 长度选择器
import { LengthBasedExampleSelector } from "@langchain/core/example_selectors";

const exampleSelector = await LengthBasedExampleSelector.fromExamples(examples, {
    examplePrompt,
    maxLength: 700,
    getTextLength: (text) => text.length,
});

// 5. 语义选择器：从 Milvus 向量库里挑示例
import { SemanticSimilarityExampleSelector } from "@langchain/core/example_selectors";

const exampleSelector = new SemanticSimilarityExampleSelector({
    vectorStore,
    k: 2,
});

// 6. PipelinePromptTemplate：模块化组合
import { PipelinePromptTemplate } from "@langchain/core/prompts";

const pipelinePrompt = new PipelinePromptTemplate({
    pipelinePrompts: [
        { name: "persona_block", prompt: personaPrompt },
        { name: "context_block", prompt: contextPrompt },
        { name: "task_block", prompt: taskPrompt },
        { name: "format_block", prompt: formatPrompt },
    ],
    finalPrompt,
    inputVariables: ["tone", "team_name", "dev_activities"],
});

// 7. partial：预填固定变量，得到可复用的新模板
const pipelineWithPartial = await pipelinePrompt.partial({
    company_name: "星航科技",
    tone: "偏正式但不僵硬",
});
```

### 项目文件说明

| 文件 | 内容 |
|------|------|
| `prompt.template1.mjs` | `PromptTemplate.fromTemplate` 基础用法，生成技术周报 Prompt 并流式调用模型 |
| `chat-prompt-template.mjs` | `ChatPromptTemplate.fromMessages` 组合 system/human 消息并调用模型 |
| `chat-prompt-template2.mjs` | `SystemMessagePromptTemplate` + `HumanMessagePromptTemplate` 的显式模板写法 |
| `fewshot-prompt-template.mjs` | 静态 few-shot 示例块，演示模型如何学习周报风格 |
| `fewshot-chat-prompt-template.mjs` | `FewShotChatMessagePromptTemplate`，用 human/ai 示例片段构造 chat few-shot |
| `example-selector1.mjs` | `LengthBasedExampleSelector`，根据长度预算自动选择示例 |
| `example-selector2.mjs` | `SemanticSimilarityExampleSelector`，从 Milvus 中按语义选择最相关周报示例 |
| `weekly-report-examples-writer-milvus.mjs` | 创建 `weekly_report_examples` 集合，并写入周报示例向量 |
| `pipeline-prompt-template.mjs` | 将人设、背景、任务、格式拆成模块，再组合成技术周报 Prompt |
| `pipeline-prompt-template2.mjs` | 复用人设和背景模块，替换任务和格式，生成季度 OKR 回顾邮件 Prompt |
| `pipeline-prompt-template3.mjs` | `PipelinePromptTemplate` 的 `finalPrompt` 使用 `ChatPromptTemplate`，输出消息数组 |
| `partial.mjs` | 用 `partial()` 固定公司、价值观、语气等公共变量，复用模板生成多份周报 |
| `messages-placeholder.mjs` | 用 `MessagesPlaceholder` 把历史对话注入 Chat Prompt |

### 学习思路

1. 先看 `prompt.template1.mjs` 和 `chat-prompt-template.mjs`，区分字符串 Prompt 和消息 Prompt。
2. 再看 few-shot 系列，理解"示例本身也是 Prompt 的一部分"。
3. 接着看 ExampleSelector：静态示例适合固定场景，长度选择器管 token 预算，语义选择器适合示例库变大后的动态检索。
4. 最后看 Pipeline 系列：把可复用的 Prompt 模块沉淀出来，避免每个业务场景复制一整段大 Prompt。

---

## runnable-test — LangChain Runnable / LCEL

### 核心概念

**Runnable** 是 LangChain 新版链式编排的统一抽象。Prompt、Model、Parser、普通函数包装后的节点，都可以被看成 Runnable，然后用 `.pipe()` 或 `RunnableSequence` 串起来。

**LCEL（LangChain Expression Language）** 的核心思想：

```
输入
  ↓
PromptTemplate / ChatPromptTemplate
  ↓
ChatOpenAI
  ↓
OutputParser
  ↓
结构化结果
```

Runnable 解决的是"如何把多个处理步骤稳定组合起来"的问题：
- 顺序执行：`RunnableSequence` 或 `.pipe()`。
- 普通函数接入链：`RunnableLambda.from(fn)`。
- 同一输入分发到多个分支：`RunnableMap`。
- 保留原始输入继续往后传：`RunnablePassthrough`。
- 从对象结果里挑字段：`RunnablePick`。
- 对数组每个元素执行同一条链：`RunnableEach`。
- 按条件选择分支：`RunnableBranch`。
- 按 key 路由到指定 runnable：`RouterRunnable`。
- 给链补上对话历史：`RunnableWithMessageHistory`。

### 关键 API

```js
// 1. RunnableSequence / pipe：把 Prompt → Model → Parser 串起来
const chain = promptTemplate.pipe(model).pipe(outputParser);
const result = await chain.invoke({
    text: "LangChain 是一个强大的 AI 应用开发框架",
    format_instructions: outputParser.getFormatInstructions(),
});

// 等价写法
const chain2 = RunnableSequence.from([promptTemplate, model, outputParser]);

// 2. RunnableLambda：把普通函数包装成链节点
const addOne = RunnableLambda.from((input) => input + 1);
const multiplyTwo = RunnableLambda.from((input) => input * 2);
const mathChain = RunnableSequence.from([addOne, multiplyTwo, addOne]);

// 3. RunnableMap：同一份输入并行交给多个 runnable
const runnableMap = RunnableMap.from({
    add: RunnableLambda.from((input) => input.num + 1),
    multiply: RunnableLambda.from((input) => input.num * 2),
    greeting: PromptTemplate.fromTemplate("你好，{name}！"),
});

// 4. RunnablePick：从对象结果中只保留指定字段
const pickChain = RunnableSequence.from([
    (input) => ({
        ...input,
        fullInfo: `${input.name}，${input.age}岁，来自${input.city}`,
    }),
    new RunnablePick(["name", "fullInfo"]),
]);

// 5. RunnableBranch：按顺序匹配条件，命中第一个分支
const branch = RunnableBranch.from([
    [isPositive, handlePositive],
    [isNegative, handleNegative],
    [isEven, handleEven],
    handleDefault,
]);

// 6. RouterRunnable：由输入 key 决定走哪个 runnable
const router = new RouterRunnable({
    runnables: {
        toUpperCase,
        reverseText,
    },
});

const result = await router.invoke({
    key: "reverseText",
    input: "Hello World",
});

// 7. RunnableWithMessageHistory：用 sessionId 管理多轮历史
const chain = new RunnableWithMessageHistory({
    runnable: simpleChain,
    getMessageHistory: (sessionId) => getMessageHistory(sessionId),
    inputMessagesKey: "question",
    historyMessagesKey: "history",
});

await chain.invoke(
    { question: "我刚才说我来自哪里？" },
    { configurable: { sessionId: "user-123" } },
);
```

### 项目文件说明

| 文件 | 内容 |
|------|------|
| `runnable.mjs` | Prompt → ChatOpenAI → StructuredOutputParser 的完整链，演示 `.pipe()` 和 `RunnableSequence.from` 两种写法 |
| `runnableLambda.mjs` | 用 `RunnableLambda` 把普通数学函数包装为链节点，再串成顺序链 |
| `runnableMap.mjs` | 用 `RunnableMap` 将同一份输入分发给多个计算节点和 PromptTemplate |
| `RunnablePassthrough.mjs` | 演示保留原始输入并追加加工结果的模式；当前文件更适合作为概念参考，运行前需要检查内部变量引用 |
| `RunablePick.mjs` | 用 `RunnablePick` 从对象里只保留 `name` 和 `fullInfo` 字段 |
| `RunnableEach.mjs` | 用 `RunnableEach` 对数组中每个元素执行同一条处理链 |
| `runnableBranch.mjs` | 用 `RunnableBranch` 做条件分支，注意分支按顺序匹配，先命中的条件会截断后续判断 |
| `RouterRunnable.mjs` | 用 `RouterRunnable` 根据输入 `key` 路由到 `toUpperCase` 或 `reverseText` |
| `RunnableWithMessageHistory.mjs` | 将 ChatPromptTemplate、模型、StringOutputParser 包成带 session 历史的多轮对话链；当前文件运行前需要检查 `Map` 初始化拼写 |

### 学习思路

1. 先看 `runnable.mjs`，理解 LCEL 的主路径：Prompt → Model → Parser。
2. 再看 `runnableLambda.mjs` 和 `runnableMap.mjs`，理解普通函数如何接入链，以及同一输入如何分发到多个节点。
3. 然后看 `RunnablePick.mjs`、`RunnableEach.mjs`、`runnableBranch.mjs`、`RouterRunnable.mjs`，理解对象字段选择、数组批处理、条件分支和显式路由。
4. 最后看 `RunnableWithMessageHistory.mjs`，把 Runnable 和记忆管理章节串起来：历史不是模型自动拥有的，而是通过 sessionId 找到消息历史后注入 Prompt。

---

## threejs-test — Three.js WebGL 可视化

### 核心概念

**Three.js** 是基于 WebGL 的 3D 渲染库，封装了底层 GPU 操作，让开发者用 JavaScript 构建 3D 场景。

**Verlet 积分（Verlet Integration）** 是一种物理模拟算法，用于模拟布料、绳索等柔性物体：
```
新位置 = 当前位置 + (当前位置 - 上一帧位置) × 阻尼 + 加速度
```
不需要显式存储速度，速度隐含在"当前位置 - 上一帧位置"中，数值稳定性好。

**约束满足（Constraint Satisfaction）** 是布料模拟的核心：
- 粒子之间有"静止长度"约束
- 每帧迭代多次，把超出约束的粒子拉回来
- 迭代次数越多，布料越硬、越稳定

**滚动序列帧动画** 的核心思路：
```
滚动进度（0~1）→ 映射到帧索引 → drawImage 到 Canvas
DOM 层叠加文案，用 opacity + transform 做联动动效
```

### 关键技术点

```js
// Verlet 积分核心
function integrate(particle) {
    const velocity = particle.position.clone().sub(particle.previous).multiplyScalar(damping);
    particle.previous.copy(particle.position);
    particle.position.add(velocity).add(gravity);
}

// 约束满足（拉伸约束）
function satisfy(p1, p2, restLength) {
    const delta = p2.position.clone().sub(p1.position);
    const distance = delta.length();
    const correction = delta.multiplyScalar((distance - restLength) / distance);
    // invMass = 0 表示固定点（顶边钉住）
    if (p1.invMass > 0) p1.position.addScaledVector(correction, p1.invMass / invMassSum);
    if (p2.invMass > 0) p2.position.addScaledVector(correction, -p2.invMass / invMassSum);
}

// Raycasting 鼠标拾取
raycaster.setFromCamera(pointer, camera);
const hits = raycaster.intersectObject(mesh);
// hits[0].uv → 命中点的 UV 坐标 → 映射到粒子索引

// 滚动序列帧核心
const progress = clamp((scrollY - sectionTop) / sectionHeight, 0, 1);
const frameIndex = Math.round(progress * (frames.length - 1));
ctx.drawImage(frames[frameIndex], dx, dy, drawWidth, drawHeight);

// Canvas 纹理（用 2D Canvas 绘制收据纹理）
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// ... 绘制文字、图形 ...
const texture = new THREE.CanvasTexture(canvas);
```

### 项目文件说明

| 文件 | 内容 |
|------|------|
| `receipt-webgl-demo.html` | Three.js 布料物理模拟：收据小票顶边固定，下半部分可拖拽，Verlet 积分实现纸张形变和回弹 |
| `receipt-physics.html` | 收据物理效果变体版本 |
| `scroll-sequence-demo.html` | 滚动驱动序列帧动画：sticky 布局 + Canvas 渲染 + DOM 文案联动，支持远程 WebP 序列帧加载 |
| `receipt.html` | 收据基础版本 |

### 学习思路

1. 先看 `receipt-webgl-demo.html`，理解 Three.js 场景搭建（Scene / Camera / Renderer / Light）
2. 重点看粒子系统：`invMass = 0` 的粒子是固定点，这是布料模拟的关键
3. 理解约束迭代次数（`iterations = 6`）对布料硬度的影响
4. 再看 `scroll-sequence-demo.html`，理解滚动进度如何映射到帧索引
5. 注意 Canvas 的 DPR（设备像素比）处理，避免模糊

---

## 通用 AI 知识点

### Embedding（向量嵌入）

- 将文本转换为高维浮点数向量（如 1024 维）
- 语义相近的文本，向量在空间中距离更近
- 同一段文字，不同 Embedding 模型生成的向量**不能混用**
- `embedQuery`：单条文本向量化（用于查询）
- `embedDocuments`：批量向量化（用于建库）

### Token

- LLM 的基本处理单位，不等于字符
- 英文：约 1 token/词；中文：约 2-3 tokens/字
- `cl100k_base`：GPT-3.5 / GPT-4 / text-embedding-ada-002 使用的编码
- 影响：API 费用、context window 限制、分块策略

### 相似度计算

- **余弦相似度（Cosine Similarity）**：值域 [-1, 1]，越接近 1 越相似
- **余弦距离（Cosine Distance）**：= 1 - 余弦相似度，越小越相似
- LangChain `MemoryVectorStore` 返回的 score 是**距离**（越小越好）
- Milvus COSINE 返回的 score 是**相似度**（越大越好）

### LangChain 消息流

```
SystemMessage   → 系统提示词，定义角色和规则
HumanMessage    → 用户输入
AIMessage       → 模型回复（可能包含 tool_calls）
ToolMessage     → 工具执行结果（需要 tool_call_id 对应）
```

### Prompt 模板化

- `PromptTemplate` 解决字符串插值问题，适合单段 Prompt。
- `ChatPromptTemplate` 解决消息角色组织问题，适合 Chat Model。
- `FewShotPromptTemplate` 通过示例约束输出风格，比单纯描述格式更稳定。
- `ExampleSelector` 解决"示例太多，不能全部塞进上下文"的问题。
- `PipelinePromptTemplate` 解决 Prompt 变长后难以维护的问题，把人设、上下文、任务、格式拆成可组合模块。
- `partial()` 适合预填公司、团队、语气等固定变量，降低重复传参。

### Runnable / LCEL

- Runnable 是 LangChain 的统一执行单元，Prompt、Model、Parser、函数包装节点都可以放进同一条链。
- `.pipe()` 是最常用的链式写法，适合从左到右表达数据流。
- `RunnableSequence.from([...])` 更适合动态构造链，或把多个节点作为数组统一管理。
- `RunnableMap` 的输出是对象，每个 key 对应一个 runnable 的结果，适合并行准备上下文。
- `RunnableBranch` 是条件分支，按数组顺序检查条件，先命中的分支会执行。
- `RouterRunnable` 是显式路由，输入里要有 `key` 和 `input`，`key` 决定调用哪个 runnable。
- `RunnableWithMessageHistory` 不会凭空产生记忆，它依赖 `getMessageHistory(sessionId)` 找到历史，并通过 `inputMessagesKey` / `historyMessagesKey` 接到 Prompt。

### 向量索引类型（Milvus）

| 索引 | 特点 | 适用场景 |
|------|------|----------|
| `IVF_FLAT` | 精确度高，速度中等 | 中小规模（< 100 万） |
| `IVF_SQ8` | 压缩存储，速度快 | 内存受限场景 |
| `HNSW` | 速度最快，内存占用大 | 大规模高并发 |
| `DISKANN` | 磁盘存储，超大规模 | 十亿级向量 |

---

## 高频面试题

### Prompt 模板相关

**Q: PromptTemplate 和 ChatPromptTemplate 的区别？**
> `PromptTemplate` 输出一段普通字符串，适合单轮文本 Prompt；`ChatPromptTemplate` 输出消息数组，能明确区分 system / human / ai 等角色，更适合 Chat Model，也更方便插入历史消息和 few-shot chat 示例。

**Q: Few-shot 示例应该固定写死还是动态选择？**
> 示例少、场景稳定时可以写死；示例多或输入类型差异大时应该用 ExampleSelector。长度选择器解决 token 预算问题，语义选择器解决"当前输入最适合看哪些示例"的问题。

**Q: PipelinePromptTemplate 解决什么问题？**
> 它把长 Prompt 拆成可复用模块，例如人设、业务背景、任务要求、输出格式。这样同一套人设和背景可以复用到周报、OKR 回顾、邮件等不同任务里，避免复制粘贴导致规则漂移。

### Runnable / LCEL 相关

**Q: Runnable 和传统 Chain 有什么区别？**
> Runnable 是更底层、更统一的组合抽象。Prompt、模型、解析器、普通函数都可以作为 Runnable 串起来，链路的输入输出更清晰，也更容易组合、分支、并行和复用。

**Q: `.pipe()` 和 `RunnableSequence.from()` 怎么选？**
> 固定链路用 `.pipe()` 更直观，从左到右就是数据流；需要动态拼装、按数组管理节点、或在代码里条件式构造链时，用 `RunnableSequence.from()` 更方便。

**Q: RunnableMap 和 RunnableBranch 的区别？**
> `RunnableMap` 是同一输入同时分发给多个 runnable，最后合并为对象；`RunnableBranch` 是条件选择，只会执行第一个命中的分支。前者解决"同时要多个结果"，后者解决"根据条件走哪条路"。

**Q: RunnableWithMessageHistory 的关键配置是什么？**
> 关键是 `getMessageHistory`、`inputMessagesKey`、`historyMessagesKey` 和调用时的 `configurable.sessionId`。`sessionId` 决定使用哪份历史，`historyMessagesKey` 决定历史插入 Prompt 的哪个变量。

### RAG 相关

**Q: RAG 和 Fine-tuning 的区别？什么时候用哪个？**
> RAG 是在推理时动态检索外部知识，适合知识频繁更新、需要溯源的场景（如企业知识库）。Fine-tuning 是修改模型权重，适合固定领域的风格/格式调整，但更新成本高。两者可以结合使用。

**Q: RAG 效果差怎么排查？**
> 分两个阶段排查：① 检索阶段：相似度分数是否合理？chunk 大小是否合适？Embedding 模型是否匹配业务语言？② 生成阶段：Prompt 是否清晰？检索到的内容是否真的相关？可以先打印检索结果，确认检索质量再看生成质量。

**Q: chunkSize 和 chunkOverlap 怎么设置？**
> chunkSize 通常 300-1000 字符，取决于文档类型和 Embedding 模型的最优输入长度。chunkOverlap 一般是 chunkSize 的 10%-20%，防止关键信息被切断在两个 chunk 的边界。

**Q: 为什么要用向量数据库而不是关键词搜索？**
> 关键词搜索（BM25）依赖词汇匹配，无法处理同义词、语义相关但用词不同的情况。向量搜索基于语义相似度，能理解"苹果手机"和"iPhone"是同一个意思。实际生产中常用混合检索（Hybrid Search）结合两者优势。

### 记忆管理相关

**Q: 如何处理超长对话历史？**
> 三种策略：① 截断：保留最近 N 条或 M 个 token，简单但丢失早期信息；② 摘要：用 LLM 压缩旧消息，保留语义但有信息损失；③ 检索记忆：向量化存储所有历史，按当前问题语义检索相关历史，适合长期记忆场景。

**Q: 多用户场景下如何隔离对话历史？**
> 使用 `sessionId` 区分不同用户的历史记录。`FileSystemChatMessageHistory` 支持 sessionId 参数，Milvus 可以用 `user_id` 字段过滤。

**Q: InMemory 和 FileSystem 历史存储的区别？**
> InMemory 存在进程内存中，重启后丢失，适合开发测试。FileSystem 持久化到 JSON 文件，重启后可恢复，适合单机部署。生产环境通常用 Redis 或数据库存储。

### 工具调用相关

**Q: tool_call_id 的作用是什么？**
> 当 LLM 同时发起多个工具调用时，`tool_call_id` 用于将每个 `ToolMessage` 与对应的工具调用匹配。如果 id 对不上，模型无法正确理解哪个结果对应哪个调用。

**Q: MCP 和普通 Tool 调用的区别？**
> 普通 Tool 是在代码里硬编码的函数，只能在当前应用内使用。MCP 是标准化协议，工具以独立服务形式运行，任何支持 MCP 的客户端都可以接入，实现工具的跨应用复用（类似 API 的概念）。

**Q: Agent 无限循环怎么防止？**
> 设置 `maxIterations` 上限（代码中用 30），超过后强制返回最后一条消息。生产中还需要设置超时时间和 token 预算限制。

### 向量数据库相关

**Q: Milvus 中 createIndex 和 loadCollection 的顺序为什么重要？**
> 必须先 `createIndex` 再 `loadCollection`。loadCollection 会将数据和索引加载到内存，如果索引还没建好就 load，搜索时会走全量扫描，性能极差。

**Q: IVF_FLAT 的 nlist 参数怎么设置？**
> nlist 是聚类中心数，一般设置为 `sqrt(数据量)` 到 `数据量/10` 之间。数据量小时（< 10 万）用 128-1024，数据量大时适当增大。nlist 越大，搜索越精确但越慢。

**Q: 向量维度（dim）必须和 Embedding 模型一致吗？**
> 是的，必须完全一致。如果 Embedding 模型输出 1024 维，集合的 FloatVector 字段 dim 就必须是 1024。维度不匹配会直接报错。

### 结构化输出相关

**Q: StructuredOutputParser 和 withStructuredOutput 有什么区别？**
> `StructuredOutputParser` 是 Prompt 工程方案：通过 `getFormatInstructions()` 在 Prompt 里告诉模型输出格式，然后用 `parse()` 解析文本。`withStructuredOutput` 是模型原生方案：底层使用 Function Calling，模型直接输出结构化数据，不走文本解析，更可靠。能用 `withStructuredOutput` 就用它。

**Q: 为什么流式输出和结构化解析难以同时做到？**
> 结构化解析（如 JSON）需要完整的文本才能解析，而流式是逐 token 输出的。解决方案有两种：① 流式接收完整文本，结束后再解析（`stream-structured-partial.mjs` 的做法）；② 用 `JsonOutputToolsParser` 配合 Tool Calls，它能处理流式的部分 JSON（partial JSON），实现边流边解析。

**Q: getFormatInstructions() 生成了什么？**
> 它生成一段英文说明，告诉模型输出格式要求，例如"Return a markdown code snippet with a JSON object formatted to look like: `{"name": "string", ...}`"。这段说明会被拼入 Prompt，引导模型按格式输出。

**Q: 原生 JSON Schema 和 withStructuredOutput 有什么区别？**
> `withStructuredOutput` 是 LangChain 封装，通常走模型工具调用或结构化输出能力，调用体验统一；原生 JSON Schema 是直接把 `response_format.json_schema` 等提供方参数传给模型，控制更贴近底层接口，但可移植性取决于模型提供方是否兼容。

---

## 文档维护说明

本文档应在以下情况下更新：
- 新增子项目时，补充对应章节
- 学习新的 AI 知识点时，添加到"通用 AI 知识点"
- 遇到新的面试题时，补充到"高频面试题"
- 关键 API 有变化时，同步更新代码示例

更新时先以当前代码目录、`package.json`、各示例文件实际 import 和环境变量为准，不要只按旧目录结构补充。
