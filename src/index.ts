import 'dotenv/config';
import simpleGit from 'simple-git';
import axios from 'axios';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { JiraIssueSchema, JiraInfoResponseSchema, JiraIssue, JiraInfoResponse } from './types.js';

// Jira API 配置
const JIRA_EMAIL = process.env.JIRA_USER_EMAIL as string;
const JIRA_API_TOKEN = process.env.JIRA_API_KEY as string;
const JIRA_INSTANCE_URL = process.env.JIRA_INSTANCE_URL as string;

if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_INSTANCE_URL) {
  throw new Error('Missing required environment variables');
}

// 从分支名中提取 Jira ID
function extractJiraId(branchName: string): string | null {
    const patterns = process.env.JIRA_BRANCH_PATTERNS?.split(',') || [
        /dev_[a-zA-Z]+-([A-Z]+-\d+)/,
        /feature\/[a-zA-Z]+-([A-Z]+-\d+)/,
        /bugfix\/[a-zA-Z]+-([A-Z]+-\d+)/,
        /dev_[a-zA-Z]+_([A-Z]+-\d+)/
    ];

    for (const pattern of patterns) {
        const match = branchName.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}

// 获取 Jira 需求详情
async function getJiraTicket(jiraId: string): Promise<JiraIssue | null> {
    try {
        const response = await axios.get(
            `${JIRA_INSTANCE_URL}/rest/api/3/issue/${jiraId}`,
            {
                auth: {
                    username: JIRA_EMAIL,
                    password: JIRA_API_TOKEN
                }
            }
        );
        return JiraIssueSchema.parse(response.data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Jira API 响应格式错误:', error.errors);
        } else if (axios.isAxiosError(error) && error.response) {
            console.error('Jira API 请求失败:', error.response.status, error.response.data);
        } else {
            console.error('获取 Jira 需求失败:', error instanceof Error ? error.message : String(error));
        }
        return null;
    }
}

// 创建 MCP 服务器
const server = new Server(
  {
    name: "jira-scp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义工具输入 schema
const GetJiraInfoSchema = z.object({
  random_string: z.string().optional().describe('Dummy parameter for no-parameter tools')
});

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "getJiraInfo",
        description: "获取当前分支对应的 Jira 需求信息",
        longDescription: "根据当前 Git 分支名称，获取对应的 Jira 需求信息，包括Jira Id(超链接到Jira需求详情页面)、标题、描述、状态、优先级等。当用户询问'当前需求是什么'、'这个分支的 Jira 信息'等类似问题时，将会触发此工具。",
        inputSchema: zodToJsonSchema(GetJiraInfoSchema),
        examples: [
          "当前的需求是什么",
          "这个分支对应的 Jira 信息",
          "显示 Jira 需求详情",
          "查看当前任务"
        ]
      }
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    // 初始化 Git
    const git = simpleGit({
      baseDir: process.env.WORKSPACE_FOLDER_PATHS,
      binary: 'git'
    });

    switch (request.params.name) {
      case "getJiraInfo": {
        const args = GetJiraInfoSchema.parse(request.params.arguments);
        
        try {
          // 检查是否是 Git 仓库
          const isRepo = await git.checkIsRepo();
          if (!isRepo) {
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  message: '当前目录不是 Git 仓库'
                }, null, 2)
              }],
            };
          }

          // 获取当前分支
          const { current } = await git.branch();
          console.error('[DEBUG] Current branch:', current);
          
          // 提取 Jira ID
          const jiraId = extractJiraId(current);
          console.error('[DEBUG] Extracted Jira ID:', jiraId);
          
          if (!jiraId) {
            const response: JiraInfoResponse = {
              success: false,
              message: '无法从分支名中提取 Jira ID'
            };
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify(response, null, 2)
              }],
            };
          }

          // 获取需求详情
          const ticket = await getJiraTicket(jiraId);
          if (!ticket) {
            const response: JiraInfoResponse = {
              success: false,
              message: '获取 Jira 需求失败'
            };
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify(response, null, 2)
              }],
            };
          }

          // 返回需求信息
          const jiraUrl = `${JIRA_INSTANCE_URL}/browse/${jiraId}`;
          const markdownLink = `[${jiraId}](${jiraUrl})`;

          const response: JiraInfoResponse = {
            success: true,
            data: {
              branch: current,
              // jiraId: jiraId,
              url: jiraUrl,
              markdownLink: markdownLink,
              summary: ticket.fields.summary,
              description: ticket.fields.description,
              status: ticket.fields.status.name,
              priority: ticket.fields.priority.name,
              assignee: ticket.fields.assignee?.displayName || '未分配',
            }
          };

          // 验证响应格式
          JiraInfoResponseSchema.parse(response);

          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(response, null, 2)
            }],
          };
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(`Invalid input: ${JSON.stringify(error.errors)}`);
          }
          throw error;
        }
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${JSON.stringify(error.errors)}`);
    }
    throw error;
  }
});

// 启动服务器
async function runServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jira SCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 