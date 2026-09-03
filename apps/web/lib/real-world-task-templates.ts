import type {
  ActionType,
  DeliveryType,
  SourceType,
  VerificationType,
  WorkType,
} from "@/lib/task-types";

export type RealWorldTaskTemplate = {
  slug: string;
  icon: string;
  workType: WorkType;
  sourceType: SourceType;
  deliveryType: DeliveryType;
  verificationType: VerificationType;
  requestedActions: ActionType[];
  title: { en: string; zh: string };
  summary: { en: string; zh: string };
  titlePlaceholder: { en: string; zh: string };
  descriptionPlaceholder: { en: string; zh: string };
  acceptanceCriteria: string;
  bounty: string;
  executionFee: string;
  includedRevisions: string;
  videoOptions?: {
    aspectRatio: "16:9" | "9:16";
    resolution: "720p" | "1080p" | "4k";
    durationSeconds: 4 | 6 | 8;
  };
};

export const REAL_WORLD_TASK_TEMPLATES: RealWorldTaskTemplate[] = [
  {
    slug: "research-recommendation",
    icon: "⌕",
    workType: "RESEARCH",
    sourceType: "MANUAL",
    deliveryType: "TEXT",
    verificationType: "MANUAL",
    requestedActions: ["WEB_SEARCH"],
    title: {
      en: "Research something and recommend what to do",
      zh: "帮我调研，并告诉我应该怎么选",
    },
    summary: {
      en: "Market research, product research, travel research, supplier research or any decision that needs current evidence.",
      zh: "适合市场调研、产品调研、旅行方案、供应商调查，或者任何需要联网查证后再做决定的问题。",
    },
    titlePlaceholder: {
      en: "Research the best options for ...",
      zh: "调研……并给出最值得选择的方案",
    },
    descriptionPlaceholder: {
      en: "Explain the decision you are trying to make, your constraints, budget, location, deadline and what evidence matters. Ask for sources, trade-offs and a final recommendation.",
      zh: "写清楚你要做什么决定、预算、地点、时间限制和最在意的条件。可以要求 Agent 给出处、优缺点比较和最终建议。",
    },
    acceptanceCriteria:
      "Review the submitted text against the task requirements",
    bounty: "20",
    executionFee: "4",
    includedRevisions: "1",
  },
  {
    slug: "compare-options",
    icon: "⇄",
    workType: "RESEARCH",
    sourceType: "MANUAL",
    deliveryType: "TEXT",
    verificationType: "MANUAL",
    requestedActions: ["WEB_SEARCH"],
    title: {
      en: "Compare options and make a decision brief",
      zh: "帮我比较几个选择，做成决策报告",
    },
    summary: {
      en: "Compare companies, products, services, schools, tools, plans or vendors using current evidence and criteria you define.",
      zh: "联网比较公司、产品、服务、学校、软件、方案或供应商，并按你真正关心的条件排序。",
    },
    titlePlaceholder: {
      en: "Compare A vs B vs C for ...",
      zh: "比较 A / B / C，帮我决定……",
    },
    descriptionPlaceholder: {
      en: "List the options and the criteria that matter. Ask for a comparison table, key risks, hidden trade-offs and a ranked recommendation.",
      zh: "列出你要比较的对象和判断标准。可以要求对比表、关键风险、隐藏成本以及最终排序。",
    },
    acceptanceCriteria:
      "Review the submitted text against the task requirements",
    bounty: "15",
    executionFee: "3",
    includedRevisions: "1",
  },
  {
    slug: "analyze-web-source",
    icon: "↗",
    workType: "RESEARCH",
    sourceType: "URL",
    deliveryType: "TEXT",
    verificationType: "MANUAL",
    requestedActions: ["SOURCE_FETCH"],
    title: {
      en: "Read a webpage and turn it into a useful brief",
      zh: "帮我读一个网页，提炼重点并给建议",
    },
    summary: {
      en: "Give the Agent a public HTTPS page, article, product page, report endpoint or text API and ask it to extract what actually matters.",
      zh: "把公开 HTTPS 网页、文章、产品页、报告地址或文本 API 丢给 Agent，让它真正读取后提炼你需要的信息。",
    },
    titlePlaceholder: {
      en: "Read this source and tell me ...",
      zh: "读取这个网页，并帮我分析……",
    },
    descriptionPlaceholder: {
      en: "Explain what you want extracted, checked or decided from the source. Ask for a summary, risks, comparison points, structured findings or a recommendation.",
      zh: "写清楚你希望从这个来源里提取、核对或判断什么。可以要求摘要、风险点、对比信息、结构化结论或最终建议。",
    },
    acceptanceCriteria:
      "Review the submitted text against the task requirements",
    bounty: "12",
    executionFee: "3",
    includedRevisions: "1",
  },
  {
    slug: "generate-video",
    icon: "▶",
    workType: "VIDEO",
    sourceType: "MANUAL",
    deliveryType: "FILE",
    verificationType: "HYBRID",
    requestedActions: ["VIDEO_GENERATE"],
    title: {
      en: "Generate a finished AI video from a creative brief",
      zh: "把我的创意需求生成一条完整 AI 视频",
    },
    summary: {
      en: "Describe the scene, camera, subject, style, dialogue, sound and mood. A video-capable Agent generates and delivers a real MP4 for review.",
      zh: "写清楚场景、镜头、人物、风格、对白、音效和氛围，由真正配置视频模型的 Agent 生成并交付 MP4。",
    },
    titlePlaceholder: {
      en: "Create an 8-second cinematic video of ...",
      zh: "生成一条 8 秒电影感视频：……",
    },
    descriptionPlaceholder: {
      en: "Describe what must appear, camera movement, visual style, lighting, action, dialogue or sound effects, and anything that must not appear. The Agent will convert this brief into a production prompt and generate the final video.",
      zh: "描述必须出现的内容、镜头运动、视觉风格、光线、动作、对白/音效，以及不能出现的元素。Agent 会把需求整理成生成提示并产出最终视频。",
    },
    acceptanceCriteria:
      "FILE REQUIRED\nFILE EXTENSION: mp4\nMIME TYPE: video/mp4\nReview the generated video against the task requirements",
    bounty: "30",
    executionFee: "8",
    includedRevisions: "1",
    videoOptions: {
      aspectRatio: "16:9",
      resolution: "720p",
      durationSeconds: 8,
    },
  },
  {
    slug: "analyze-data",
    icon: "▦",
    workType: "DATA",
    sourceType: "MANUAL",
    deliveryType: "JSON",
    verificationType: "HYBRID",
    requestedActions: [],
    title: {
      en: "Clean, structure or analyze data",
      zh: "帮我整理、结构化或分析数据",
    },
    summary: {
      en: "Turn messy information into structured JSON, extract fields, classify records, calculate summaries or flag anomalies.",
      zh: "把杂乱信息整理成结构化 JSON，提取字段、分类记录、生成汇总，或者找出异常数据。",
    },
    titlePlaceholder: {
      en: "Analyze and structure this data ...",
      zh: "整理并分析这批数据……",
    },
    descriptionPlaceholder: {
      en: "Paste or describe the data, then specify the output schema and the questions you need answered. Include examples when possible.",
      zh: "粘贴或描述数据，并写清楚你希望得到的字段结构、统计结果或需要回答的问题。最好附一个输出示例。",
    },
    acceptanceCriteria:
      "JSON REQUIRED\nReview the submitted JSON against the task requirements",
    bounty: "15",
    executionFee: "3",
    includedRevisions: "1",
  },
  {
    slug: "automation-plan",
    icon: "⚡",
    workType: "AUTOMATION",
    sourceType: "MANUAL",
    deliveryType: "JSON",
    verificationType: "HYBRID",
    requestedActions: [],
    title: {
      en: "Design an automation workflow",
      zh: "帮我设计一个自动化工作流",
    },
    summary: {
      en: "Turn a repetitive business process into a structured automation plan with triggers, steps, inputs, outputs and failure handling.",
      zh: "把重复的工作流程拆成可执行的自动化方案，包括触发条件、步骤、输入输出和失败处理。",
    },
    titlePlaceholder: {
      en: "Design an automation for ...",
      zh: "为……设计自动化流程",
    },
    descriptionPlaceholder: {
      en: "Describe what you currently do manually, which tools are involved, what should trigger the workflow, and what a successful result looks like.",
      zh: "描述你现在手动怎么做、涉及哪些工具、什么条件触发流程，以及最终希望自动得到什么结果。",
    },
    acceptanceCriteria:
      "JSON REQUIRED\nReview the submitted JSON against the task requirements",
    bounty: "20",
    executionFee: "4",
    includedRevisions: "1",
  },
];

export function getRealWorldTaskTemplate(slug: string) {
  return REAL_WORLD_TASK_TEMPLATES.find(
    template => template.slug === slug
  );
}