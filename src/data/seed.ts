import type { WorkspaceState } from '../types'

const isoDaysFromNow = (days: number) => {
  const date = new Date()
  date.setHours(9, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

const now = new Date().toISOString()

export const seedState: WorkspaceState = {
  readings: [
    {
      id: 'reading-human-agency',
      title: '译者在生成式 AI 时代仍然需要做什么？',
      eyebrow: '今日晨读 · 人机协同',
      summary: '从“人工监督、人的能动性与问责”三个关键词出发，练习教育政策语篇中的抽象概念翻译。',
      sourceText:
        'Human oversight remains essential when automated systems influence decisions that affect people. Educational uses of AI should strengthen human agency, transparency, and accountability.',
      sourceName: 'UNESCO AI 伦理建议书主题材料',
      sourceUrl: 'https://www.unesco.org/en/artificial-intelligence/recommendation-ethics',
      sourceNote: '平台根据公开主题编写的教学改写材料，非网页原文摘录。',
      publishedAt: '2026-08-20',
      readingMinutes: 6,
      tags: ['人机协同', '政策语篇', '主体性'],
      prompt: '面向高校教师，将这段文字译成简洁、审慎的中文政策表述。',
    },
    {
      id: 'reading-clear-language',
      title: '清晰语言如何降低翻译风险',
      eyebrow: '资源观察 · 翻译规范',
      summary: '识别冗余名词化结构，把“准确”落实为读者能够采取行动的表达。',
      sourceText:
        'Clear drafting is not a cosmetic step. It reduces ambiguity, makes responsibilities visible, and helps multilingual readers act on the same information.',
      sourceName: 'European Commission 翻译与写作资源主题材料',
      sourceUrl: 'https://commission.europa.eu/resources-partners/translation-and-drafting-resources_en',
      sourceNote: '平台根据公开资源主题编写的教学改写材料，非网页原文摘录。',
      publishedAt: '2026-08-19',
      readingMinutes: 5,
      tags: ['清晰语言', '读者意识', '质量控制'],
      prompt: '面向跨国项目团队翻译，优先保证信息清晰和责任关系明确。',
    },
    {
      id: 'reading-terminology',
      title: '术语核验不只是挑一个“顺眼”的译法',
      eyebrow: '教师材料 · 术语管理',
      summary: '同一术语的译法取决于来源、版本、领域和使用目的，记录选择理由比单次选对更重要。',
      sourceText:
        'A terminology decision is defensible only when the translator records the source, version, domain, and intended audience behind the selected equivalent.',
      sourceName: '教师自编演示材料',
      sourceNote: '用于展示平台的术语核验与决策日志功能。',
      publishedAt: '2026-08-18',
      readingMinutes: 4,
      tags: ['术语管理', '来源核验', '决策日志'],
      prompt: '译成适合翻译技术课程讲义的中文，并保留“可辩护性”的含义。',
    },
  ],
  tasks: [
    {
      id: 'task-welcome',
      readingId: 'reading-human-agency',
      title: '人机协同政策语篇微翻译',
      sourceText:
        'Human oversight remains essential when automated systems influence decisions that affect people. Educational uses of AI should strengthen human agency, transparency, and accountability.',
      sourceName: 'UNESCO AI 伦理建议书主题材料',
      sourceUrl: 'https://www.unesco.org/en/artificial-intelligence/recommendation-ethics',
      brief: '面向高校教师，将材料译成简洁、审慎的中文政策表述。',
      audience: '高校教师与教育管理者',
      initialTranslation: '',
      revisedTranslation: '',
      reflection: '',
      stage: 'draft',
      feedback: [],
      createdAt: now,
      updatedAt: now,
    },
  ],
  expressions: [
    {
      id: 'expression-human-agency',
      expression: 'strengthen human agency',
      meaning: '增强人的能动性／主体作用',
      context: '用于强调技术应支持而不是削弱人的判断和行动能力。',
      sourceLabel: '平台演示材料',
      level: 0,
      nextReviewAt: isoDaysFromNow(0),
      createdAt: now,
    },
    {
      id: 'expression-act-on-information',
      expression: 'act on the same information',
      meaning: '依据同一信息采取行动',
      context: '适用于政策、说明书和跨国项目沟通场景。',
      sourceLabel: '平台演示材料',
      level: 1,
      nextReviewAt: isoDaysFromNow(1),
      createdAt: now,
    },
  ],
  logs: [
    {
      id: 'log-welcome',
      type: 'system',
      title: '工作台已就绪',
      detail: '已载入一项演示翻译任务和两张表达卡。所有学习数据默认只保存在当前浏览器。',
      createdAt: now,
    },
  ],
  settings: {
    learnerName: '译学者',
    primaryAudience: '翻译专业本科生',
    feedbackMode: 'demo',
    aiEndpoint: '',
  },
}
