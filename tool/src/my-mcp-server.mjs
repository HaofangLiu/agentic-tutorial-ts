import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const database = {
  users: {
    '001': { id: '001', name: '张三', email: 'zhangsan@example.com', role: 'admin' },
    '002': { id: '002', name: '李四', email: 'lisi@example.com', role: 'user' },
    '003': { id: '003', name: '王五', email: 'wangwu@example.com', role: 'user' },
  }
};

const server = new Server(
  {
    name: 'my-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// 设置工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'query_user',
        description: '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: '用户 ID，例如: 001, 002, 003',
            },
          },
          required: ['userId'],
        },
      },
    ],
  };
});

// 设置工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'query_user') {
    const userId = request.params.arguments?.userId;
    const user = database.users[userId];

    if (!user) {
      return {
        content: [
          {
            type: 'text',
            text: `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// 设置资源列表处理器
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'docs://guide',
        name: '使用指南',
        description: 'MCP Server 使用文档',
        mimeType: 'text/plain',
      },
    ],
  };
});

// 设置资源读取处理器
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'docs://guide') {
    return {
      contents: [
        {
          uri: 'docs://guide',
          mimeType: 'text/plain',
          text: `# MCP Server 使用指南
这是一个示例 MCP Server，用于演示如何实现 MCP 协议。
## 可用工具
- \`query_user\`: 查询用户信息
## 可用资源
- \`docs://guide\`: 使用指南
`,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${request.params.uri}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
