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
  knowledgeSources: [
    {
      id: 'source-unesco-ai-ethics',
      title: 'Recommendation on the Ethics of Artificial Intelligence',
      kind: '规范',
      organization: 'UNESCO',
      description: '用于核验人工监督、人的能动性、透明度与问责等教育政策语篇概念。',
      url: 'https://www.unesco.org/en/artificial-intelligence/recommendation-ethics',
      language: 'English / 中文资源可另行核验',
      verifiedAt: '2026-08-20',
      tags: ['AI伦理', '教育政策', '人机协同'],
      usageNote: '优先定位原始文件中的术语语境；平台演示材料不能替代正式原文引用。',
    },
    {
      id: 'source-ec-translation',
      title: 'Translation and drafting resources',
      kind: '平行文本',
      organization: 'European Commission',
      description: '欧盟委员会提供的翻译、清晰写作和多语资源入口，可用于政策与机构语篇对照。',
      url: 'https://commission.europa.eu/resources-partners/translation-and-drafting-resources_en',
      language: 'Multilingual',
      verifiedAt: '2026-08-20',
      tags: ['清晰语言', '机构语篇', '翻译资源'],
      usageNote: '记录具体页面、版本和访问日期后再作为翻译依据。',
    },
    {
      id: 'source-course-terminology',
      title: '术语核验与翻译决策记录卡',
      kind: '课程材料',
      organization: '教师自编',
      description: '用于训练学生记录来源、版本、领域、目标读者和最终译名选择理由。',
      language: '中文 / English',
      verifiedAt: '2026-08-20',
      tags: ['术语管理', '决策日志', '课堂任务'],
      usageNote: '教学模板，不作为权威术语来源。',
    },
    {
      id: 'source-who-terminology-placeholder',
      title: '专业领域术语资源接口（待接入）',
      kind: '术语库',
      organization: '后续研究模块',
      description: '为第二篇专业翻译实验预留的版本化术语库入口，可接入 WHO、PMPH、WFCMS 等来源。',
      language: '中文 / English',
      verifiedAt: '待核验',
      tags: ['专业翻译', '版本管理', '后续研究'],
      usageNote: '目前仅为接口说明，不表示三类来源已经完成数据接入或一致性核验。',
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
