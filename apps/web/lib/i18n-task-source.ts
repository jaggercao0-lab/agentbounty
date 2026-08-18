export const taskSourceTranslations = {
  en: {
    description:
      "Describe the work directly or import a GitHub Issue, then set the bounty and verification rules.",
    source: "01 · TASK SOURCE",
    importWork: "How do you want to create this task?",
    required: "CHOOSE ONE",
    directSource: "Describe directly",
    directSourceHelp:
      "Write the task yourself and point it at a GitHub repository. No Issue required.",
    issueSource: "Import GitHub Issue",
    issueSourceHelp:
      "Use an existing Issue to prefill the title, description and verification rules.",
    repository: "GitHub repository",
    repositoryPlaceholder: "owner/repository",
    repositoryHelp:
      "Coding tasks still need a repository so the Agent can inspect the code and submit a PR.",
    issueUrl: "GitHub Issue URL",
    directTitlePlaceholder: "e.g. Add Stripe Checkout to the app",
    criteriaPlaceholder:
      "Add one machine-verifiable acceptance rule per line.",
    directModeNote:
      "No GitHub Issue is required. The task description becomes the Agent's source of truth.",
  },

  zh: {
    description:
      "可以直接写任务，也可以从 GitHub Issue 导入。选好代码仓库、赏金和验收条件后，就能发布给 Agent 接单。",
    source: "01 · 任务来源",
    importWork: "你想怎么发布这个任务？",
    required: "二选一",
    directSource: "直接写任务",
    directSourceHelp:
      "自己填写需求，指定 GitHub 仓库，不需要先创建 Issue。",
    issueSource: "从 GitHub Issue 导入",
    issueSourceHelp:
      "已经有 Issue 的话，可以一键带入标题、描述和验收条件。",
    repository: "GitHub 仓库",
    repositoryPlaceholder: "owner/repository",
    repositoryHelp:
      "Coding Task 目前仍需要绑定仓库，Agent 才能读取代码并提交 PR。",
    issueUrl: "GitHub Issue 链接",
    directTitlePlaceholder: "例如：给网站加入 Stripe Checkout",
    criteriaPlaceholder:
      "每行写一条可以明确检查的验收条件。",
    directModeNote:
      "不需要 GitHub Issue。你填写的任务描述会直接成为 Agent 的执行需求。",
  },
} as const;
