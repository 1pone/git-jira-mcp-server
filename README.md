# Git Jira MCP Server

这是一个用于获取 Jira 需求信息的 MCP 服务器，基于当前 Git 分支名自动获取对应的 Jira 需求详情。

## 功能特性

- **自动分支识别**：自动从当前 Git 分支名中提取 Jira ID
- **多环境兼容**：支持 VSCode、Warp 等各种开发环境（v1.0.15+）
- **智能工作目录检测**：多层级工作目录检测策略，确保在各种环境下都能正确识别 Git 仓库
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
  - Git 仓库识别错误

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

## 更新日志

### v1.0.15 (2025-08-21)

**🎉 重大改进：修复了非VSCode环境下的Git仓库识别问题**

- ✨ **新增多层级工作目录检测策略**：`WORKSPACE_FOLDER_PATHS` (VSCode) → `PWD` → `process.cwd()`
- 🔧 **修复在Warp终端等环境下的 `fatal: not a git repository` 错误**
- 🏗️ **重构Git实例初始化，统一使用 `createGitInstance()` 辅助函数**
- 🐛 **增强错误处理，提供更详细的调试信息**
- 📦 **提升跨环境兼容性，现在支持VSCode、Warp、iTerm等各种终端环境**

**影响范围**：这个版本主要解决了MCP服务器在不同开发环境下的兼容性问题，特别是修复了在Warp等独立终端中无法正确识别Git仓库的问题。

### v1.0.14 及更早版本

- 基本的Jira需求信息获取功能
- 支持VSCode环境下的Git分支识别
- 支持通过Jira ID查询需求信息
