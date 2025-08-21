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
import { extractJiraId, getJiraTicket } from './jira.js';

// Jira API 配置
const JIRA_EMAIL = process.env.JIRA_USER_EMAIL as string;
const JIRA_API_TOKEN = process.env.JIRA_API_KEY as string;
const JIRA_INSTANCE_URL = process.env.JIRA_INSTANCE_URL as string;

if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_INSTANCE_URL) {
  throw new Error('Missing required environment variables');
}

// 创建 MCP 服务器
const server = new Server(
  {
    name: "jira-scp",
    version: "1.0.15",
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

// 新增：定义获取分支名工具的 schema
const GetCurrentBranchSchema = z.object({
  random_string: z.string().optional().describe('Dummy parameter for no-parameter tools')
});

// 新增：定义通过 Jira ID 查询需求的工具 schema
const GetJiraByIdSchema = z.object({
  jiraId: z.string().describe('Jira 需求的 ID，如 ABC-123')
});

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "getJiraInfo",
        description: "获取当前分支对应的 Jira 需求信息（每次都必须实时调用此工具，不能直接复用历史结果）",
        longDescription: "根据当前 Git 分支名称，获取对应的 Jira 需求信息，包括Jira Id(超链接到Jira需求详情页面)、标题、描述、状态、优先级等。当用户询问'当前需求是什么'、'这个分支的 Jira 信息'等类似问题时，将会触发此工具。",
        inputSchema: zodToJsonSchema(GetJiraInfoSchema),
        examples: [
          "当前的需求是什么",
          "这个分支对应的 Jira 信息",
          "显示 Jira 需求详情",
          "查看当前任务"
        ]
      },
      // 新增分支名工具
      {
        name: "getCurrentBranchName",
        description: "获取当前 git 分支名称（每次都必须实时调用此工具，不能直接复用历史结果）",
        longDescription: "获取当前 git 仓库的分支名称。当用户询问'当前分支是什么'、'现在在哪个分支'等类似问题时，将会触发此工具。",
        inputSchema: zodToJsonSchema(GetCurrentBranchSchema),
        examples: [
          "当前分支是什么",
          "现在在哪个分支",
          "显示当前分支名"
        ]
      },
      // 新增：通过 Jira ID 查询需求信息
      {
        name: "getJiraById",
        description: "通过 Jira ID 查询需求信息（每次都必须实时调用此工具，不能直接复用历史结果）",
        longDescription: "根据用户输入的 Jira ID，获取对应的 Jira 需求信息，包括Jira Id(超链接到Jira需求详情页面)、标题、描述、状态、优先级等。当用户询问'查一下 ABC-123 的需求'等类似问题时，将会触发此工具。",
        inputSchema: zodToJsonSchema(GetJiraByIdSchema),
        examples: [
          "查一下 ABC-123 的需求",
          "Jira 任务 DEF-456 的详情",
          "显示 Jira 需求 GHI-789 的信息"
        ]
      }
    ],
  };
});

// 获取工作目录的辅助函数
function getWorkingDirectory(): string {
  // 优先级：WORKSPACE_FOLDER_PATHS (VSCode) > PWD (当前目录) > process.cwd()
  const workspaceDir = process.env.WORKSPACE_FOLDER_PATHS;
  const currentDir = process.env.PWD;
  const processDir = process.cwd();
  
  console.error('[DEBUG] Environment check:');
  console.error('  WORKSPACE_FOLDER_PATHS:', workspaceDir || 'undefined');
  console.error('  PWD:', currentDir || 'undefined');
  console.error('  process.cwd():', processDir);
  
  return workspaceDir || currentDir || processDir;
}

// 初始化Git实例的辅助函数
function createGitInstance(): any {
  const baseDir = getWorkingDirectory();
  console.error('[DEBUG] Using baseDir:', baseDir);
  
  return simpleGit({
    baseDir: baseDir,
    binary: 'git'
  });
}

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "getJiraInfo": {
        const args = GetJiraInfoSchema.parse(request.params.arguments);
        
        try {
          // 初始化Git实例
          const git = createGitInstance();
          
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
              message: `无法从分支名 ${current} 中提取 Jira ID`
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

      // 获取分支名工具处理
      case "getCurrentBranchName": {
        const args = GetCurrentBranchSchema.parse(request.params.arguments);
        
        try {
          // 初始化Git实例
          const git = createGitInstance();
          
          // 检查是否是 Git 仓库
          const isRepo = await git.checkIsRepo();
          if (!isRepo) {
            const baseDir = getWorkingDirectory();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: `目录 ${baseDir} 不是 Git 仓库`
                }, null, 2)
              }],
            };
          }
          
          // 获取当前分支
          const { current } = await git.branch();
          console.error('[DEBUG] getCurrentBranchName - Current branch:', current);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                branch: current
              }, null, 2)
            }],
          };
        } catch (error) {
          console.error('[ERROR] getCurrentBranchName failed:', error);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                message: `获取分支信息失败: ${error instanceof Error ? error.message : String(error)}`
              }, null, 2)
            }],
          };
        }
      }

      // 新增：通过 Jira ID 查询需求信息
      case "getJiraById": {
        const args = GetJiraByIdSchema.parse(request.params.arguments);
        const jiraId = args.jiraId;
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
            branch: '', // 通过ID查询时无分支
            url: jiraUrl,
            markdownLink: markdownLink,
            summary: ticket.fields.summary,
            description: ticket.fields.description,
            status: ticket.fields.status.name,
            priority: ticket.fields.priority.name,
            assignee: ticket.fields.assignee?.displayName || '未分配',
          }
        };
        JiraInfoResponseSchema.parse(response);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }],
        };
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