import type { Segment, Workspace } from './types'

const now = new Date().toISOString()
const daysFromNow = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString() }

export const createId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`

export const createSegment = (id: string, order: number, source: string, target = '', initialTarget = ''): Segment => ({
  id,
  order,
  source,
  target,
  initialTarget,
  studentDraft: initialTarget,
  aiPretranslation: '',
  aiFeedback: [],
  termLookups: [],
  culturalNotes: [],
  aiState: { status: 'idle', jobId: '', requestId: '', provider: '', retryCount: 0, error: '', lastAttemptAt: '', completedAt: '' },
  status: target ? 'confirmed' : 'untranslated',
  origin: 'human',
  note: '',
  revisions: [],
  lastModifiedAt: now,
  lastAIRequestAt: '',
})

export const seedWorkspace: Workspace = {
  version: 2,
  schemaVersion: 3,
  projects: [{
    id: 'project-demo', name: 'AI教育政策微项目', description: '用于演示项目级片段翻译、质量检查和过程留痕。',
    sourceLanguage: '英语（en）', targetLanguage: '简体中文（zh-CN）', domain: '教育', textType: '政策文本',
    audience: '高校教师与教育管理者', style: '正式、简洁、审慎', deadline: '', status: 'active', mode: 'student-first', memoryId: 'tm-personal',
    termbaseId: 'tb-personal', styleGuideId: 'style-academic', enabledSkills: ['builtin.terminology-consistency', 'builtin.mt-tone-check'],
    aiPretranslate: false, termLookup: true, culturalRecognition: true, mtToneCheck: true, strictTerminology: true, batchSize: 12, activeBatchJobId: '',
    files: [{ id: 'file-demo', name: 'human-agency.md', type: 'markdown', structure: 'headings', createdAt: now, segments: [
      { ...createSegment('seg-demo-1', 1, 'Human oversight remains essential when automated systems influence decisions that affect people.', '当自动化系统影响关系到人的决策时，人工监督仍然不可或缺。', '当自动化系统影响人们的决定时，人的监督仍然重要。'), note: '保留责任主体。' },
      createSegment('seg-demo-2', 2, 'Educational uses of AI should strengthen human agency, transparency, and accountability.'),
      createSegment('seg-demo-3', 3, 'Technology should support judgement rather than replace it.'),
    ] }], createdAt: now, updatedAt: now,
  }],
  quickSessions: [],
  translationMemory: [{ id: 'tu-demo', source: 'Human oversight remains essential.', target: '人工监督仍然不可或缺。', sourceLanguage: '英语（en）', targetLanguage: '简体中文（zh-CN）', domain: '教育', projectId: 'project-demo', quality: 'approved', useCount: 1, createdAt: now, updatedAt: now }],
  terms: [
    { id: 'term-agency', source: 'human agency', target: '人的能动性', definition: '人在理解情境后作出判断并采取行动的能力。', domain: '教育', partOfSpeech: 'n.', allowed: ['人的能动性', '人的主体作用'], forbidden: ['人类代理'], example: 'strengthen human agency', sourceRef: 'UNESCO主题材料，正式使用前需回到原文核验', status: 'approved' },
    { id: 'term-accountability', source: 'accountability', target: '问责', definition: '对决定与结果承担说明和责任的机制。', domain: '教育', partOfSpeech: 'n.', allowed: ['问责', '问责机制'], forbidden: [], example: 'transparency and accountability', sourceRef: '平台教学示例', status: 'candidate' },
  ],
  styleGuides: [{ id: 'style-academic', name: '教育政策简明指南', audience: '高校教师与教育管理者', formality: '正式、审慎', punctuation: '使用中文全角标点', dates: '年月日完整书写', names: '机构名称优先采用官方译名', preferred: ['责任主体明确', '动词优先'], forbidden: ['过度口语化', '无来源强化语气'] }],
  phraseCards: [
    { id: 'card-agency', type: 'term', source: 'strengthen human agency', target: '增强人的能动性', context: 'Educational uses of AI should strengthen human agency.', usage: '强调技术支持人的判断与行动能力。', domain: '教育', sourceRef: 'AI教育政策微项目', errorRecord: '', explanation: 'agency 在此不宜机械译为“代理”。', tags: ['AI伦理', '主体性'], mastery: 1, nextReviewAt: daysFromNow(0), createdAt: now },
    { id: 'card-oversight', type: 'phrase', source: 'human oversight remains essential', target: '人工监督仍然不可或缺', context: '自动化决策与问责语境。', usage: '政策文本中的必要性表达。', domain: '教育', sourceRef: 'AI教育政策微项目', errorRecord: '曾把 human oversight 直译为“人的监督”。', explanation: '人工监督更符合制度和治理语境。', tags: ['政策语篇'], mastery: 2, nextReviewAt: daysFromNow(1), createdAt: now },
  ],
  reviewRecords: [],
  news: [
    { id: 'news-unesco', title: '人工智能伦理建议书：教育与人的能动性', category: '机器翻译与AI语言技术', contentType: 'learning', source: 'UNESCO', sourceId: 'source-unesco', publishedAt: '持续更新资源', url: 'https://www.unesco.org/en/artificial-intelligence/recommendation-ethics', summary: '用于了解人工监督、透明度、问责和人的能动性等概念。此处为平台编写的资源摘要，不是网页原文。', level: 'B2—C1', language: '英语', readingMinutes: 5, keywords: ['human agency', 'accountability'], tags: ['AI伦理', '教育'], trainingDirection: '练习政策语篇中的抽象概念与责任主体表达。', sourceNote: '真实来源入口；训练文本需由用户从可使用内容中选择。', copyrightStatus: 'metadata-only', paragraphs: [], saved: false, read: false, readingProgress: 0, createdAt: now, updatedAt: now },
    { id: 'news-ec', title: '翻译与清晰写作资源入口', category: '语言服务与翻译工具', contentType: 'industry', source: 'European Commission', sourceId: 'source-ec', publishedAt: '持续更新资源', url: 'https://commission.europa.eu/resources-partners/translation-and-drafting-resources_en', summary: '欧盟委员会提供的翻译、起草和多语资源入口，可用于机构语篇与清晰语言训练。', level: 'B2—C1', language: '英语', readingMinutes: 4, keywords: ['clear writing', 'translation'], tags: ['清晰语言', '机构翻译'], trainingDirection: '比较名词化表达与以读者行动为中心的中文改写。', sourceNote: '真实来源入口；平台不保存整篇网页内容。', copyrightStatus: 'metadata-only', paragraphs: [], saved: true, read: false, readingProgress: 0, createdAt: now, updatedAt: now },
  ],
  sources: [
    { id: 'source-unesco', name: 'UNESCO', homepageUrl: 'https://www.unesco.org/', feedUrl: '', category: '机器翻译与AI语言技术', defaultLanguage: '英语', updateFrequencyMinutes: 1440, enabled: false, lastSyncedAt: '', lastError: '尚未配置内容同步代理', createdAt: now, updatedAt: now },
    { id: 'source-ec', name: 'European Commission', homepageUrl: 'https://commission.europa.eu/', feedUrl: '', category: '语言服务与翻译工具', defaultLanguage: '英语', updateFrequencyMinutes: 1440, enabled: false, lastSyncedAt: '', lastError: '尚未配置内容同步代理', createdAt: now, updatedAt: now },
  ],
  practices: [],
  personalReferences: [],
  skills: [
    { id: 'builtin.terminology-consistency', name: '术语一致性检查', version: '1.0.0', description: '比较已批准术语与当前译文，报告缺失和冲突。', category: 'terminology', permissions: ['read:current-segment', 'read:project-termbase'], acceptedInput: ['segment', 'project-termbase'], producedOutput: ['quality-issue'], entryType: 'builtin', configurationSchema: { strict: { type: 'boolean', default: true } }, enabled: true, updatedAt: now },
    { id: 'builtin.mt-tone-check', name: '机器翻译腔检测', version: '1.0.0', description: '标记冗余被动、机械连接和不自然搭配，结果需人工复核。', category: 'quality', permissions: ['read:current-segment', 'use:model'], acceptedInput: ['segment'], producedOutput: ['style-suggestion'], entryType: 'builtin', configurationSchema: { sensitivity: { type: 'number', default: 0.6 } }, enabled: true, updatedAt: now },
    { id: 'builtin.phrase-extractor', name: '好词好句提取', version: '1.0.0', description: '从已确认译文中生成候选表达卡，不自动加入复习。', category: 'learning', permissions: ['read:confirmed-segment', 'write:phrase-candidate'], acceptedInput: ['segment'], producedOutput: ['phrase-card-candidate'], entryType: 'builtin', configurationSchema: {}, enabled: true, updatedAt: now },
  ],
  skillExecutionLogs: [],
  aiRequestLogs: [],
  batchJobs: [],
  qualityIssues: [],
  settings: { theme: 'light', learnerName: '译学者', provider: 'demo', model: 'deepseek-chat', endpoint: '', temperature: 0.3, requestLimit: 6000, batchSize: 12, requestTimeoutMs: 30000, retryCount: 2, contentProxyEndpoint: '', autoSave: true },
  lastSavedAt: now,
}

export const cloneSeed = () => JSON.parse(JSON.stringify(seedWorkspace)) as Workspace
