# Git Jira MCP Server

这是一个用于获取 Jira 需求信息的 MCP 服务器，基于当前 Git 分支名自动获取对应的 Jira 需求详情。

## 功能特性

- **自动分支识别**：自动从当前 Git 分支名中提取 Jira ID
- **需求信息获取**：获取 Jira 需求的详细信息，包括：
  - 需求标题
  - 需求描述
  - 需求状态
  - 优先级
  - 负责人
- **错误处理**：提供清晰的错误信息，包括：
  - 分支名格式错误
  - API 请求失败
  - 环境变量缺失

## 使用方法

> [获取 Jira API Token](https://id.atlassian.com/manage-profile/security/api-tokens)

```json
{
  "git-jira": {
      "command": "npx",
      "args": [
        "-y",
        "git-jira-mcp-server"
      ],
      "env": {
        "JIRA_INSTANCE_URL": "https://your-domain.atlassian.net",
        "JIRA_USER_EMAIL": "your.email@example.com",
        "JIRA_API_KEY": "your_api_token",
        "JIRA_BRANCH_PATTERNS": "dev_[a-zA-Z]+-([A-Z]+-\\d+),feature/[a-zA-Z]+-([A-Z]+-\\d+),bugfix/[a-zA-Z]+-([A-Z]+-\\d+),dev_[a-zA-Z]+_([A-Z]+-\\d+)"
      }
    } 
}
```

## 分支命名规范

支持以下分支命名格式：

- `dev_[name]-[JIRA-ID]`
- `feature/[name]-[JIRA-ID]`
- `bugfix/[name]-[JIRA-ID]`

例如：

- `dev_feature-ABC-123`
- `feature/new-ui-ABC-123`
- `bugfix/login-ABC-123`

## 许可证

MIT License
