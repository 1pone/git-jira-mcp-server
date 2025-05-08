import axios from 'axios';
import { JiraIssueSchema, JiraIssue } from './types.js';
import { z } from 'zod';

// 从分支名中提取 Jira ID
export function extractJiraId(branchName: string): string | null {
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
export async function getJiraTicket(jiraId: string): Promise<JiraIssue | null> {
    const JIRA_EMAIL = process.env.JIRA_USER_EMAIL as string;
    const JIRA_API_TOKEN = process.env.JIRA_API_KEY as string;
    const JIRA_INSTANCE_URL = process.env.JIRA_INSTANCE_URL as string;

    if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_INSTANCE_URL) {
      throw new Error('Missing required environment variables');
    }

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