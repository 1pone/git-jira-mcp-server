import { z } from 'zod';

// Jira API 响应类型
export const JiraIssueSchema = z.object({
  fields: z.object({
    summary: z.string(),
    description: z.any(),
    status: z.object({
      name: z.string(),
    }),
    priority: z.object({
      name: z.string(),
    }),
    assignee: z.object({
      displayName: z.string(),
    }).nullable(),
  }),
});

// 工具响应类型
export const JiraInfoResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    branch: z.string(),
    // jiraId: z.string(),
    url: z.string(),
    markdownLink: z.string(),
    summary: z.string(),
    description: z.any(),
    status: z.string(),
    priority: z.string(),
    assignee: z.string(),
  }).optional(),
  message: z.string().optional(),
});


// 类型导出
export type JiraIssue = z.infer<typeof JiraIssueSchema>;
export type JiraInfoResponse = z.infer<typeof JiraInfoResponseSchema>; 