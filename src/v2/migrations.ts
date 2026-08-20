import { cloneSeed } from './data'
import type {
  ContentItem,
  Project,
  ProjectFile,
  Segment,
  SegmentAIState,
  Workspace,
  WorkspaceSettings,
} from './types'

export const CURRENT_SCHEMA_VERSION = 3 as const

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const asNumber = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const asBoolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
const asArray = <T>(value: unknown, fallback: T[] = []): T[] => Array.isArray(value) ? value as T[] : fallback

const emptyAIState = (): SegmentAIState => ({
  status: 'idle',
  jobId: '',
  requestId: '',
  provider: '',
  retryCount: 0,
  error: '',
  lastAttemptAt: '',
  completedAt: '',
})

const migrateSegment = (value: unknown, order: number): Segment => {
  if (!isRecord(value)) throw new Error(`第 ${order} 个片段格式无效`)
  const now = new Date().toISOString()
  const origin = asString(value.origin, 'human') as Segment['origin']
  const target = asString(value.target)
  const initialTarget = asString(value.initialTarget, target)
  const aiPretranslation = asString(value.aiPretranslation, ['deepseek', 'ai-edited'].includes(origin) ? initialTarget || target : '')
  const studentDraft = asString(value.studentDraft, ['deepseek', 'ai-edited'].includes(origin) ? '' : initialTarget)
  const aiStateRecord = isRecord(value.aiState) ? value.aiState : {}

  return {
    id: asString(value.id, `segment-migrated-${order}`),
    order: asNumber(value.order, order),
    source: asString(value.source),
    target,
    initialTarget,
    studentDraft,
    aiPretranslation,
    aiFeedback: asArray(value.aiFeedback),
    termLookups: asArray(value.termLookups),
    culturalNotes: asArray(value.culturalNotes),
    aiState: { ...emptyAIState(), ...aiStateRecord } as SegmentAIState,
    status: asString(value.status, target ? 'needs-confirmation' : 'untranslated') as Segment['status'],
    origin,
    note: asString(value.note),
    revisions: asArray(value.revisions),
    lastModifiedAt: asString(value.lastModifiedAt, now),
    lastAIRequestAt: asString(value.lastAIRequestAt),
  }
}

const migrateFile = (value: unknown, index: number): ProjectFile => {
  if (!isRecord(value)) throw new Error(`第 ${index + 1} 个文件格式无效`)
  return {
    id: asString(value.id, `file-migrated-${index + 1}`),
    name: asString(value.name, `迁移文件-${index + 1}`),
    type: asString(value.type, 'pasted') as ProjectFile['type'],
    structure: asString(value.structure, 'plain') as ProjectFile['structure'],
    segments: asArray(value.segments).map((segment, segmentIndex) => migrateSegment(segment, segmentIndex + 1)),
    createdAt: asString(value.createdAt, new Date().toISOString()),
  }
}

const migrateProject = (value: unknown, index: number, defaultBatchSize: number): Project => {
  if (!isRecord(value)) throw new Error(`第 ${index + 1} 个项目格式无效`)
  const aiPretranslate = asBoolean(value.aiPretranslate, false)
  return {
    id: asString(value.id, `project-migrated-${index + 1}`),
    name: asString(value.name, `迁移项目-${index + 1}`),
    description: asString(value.description),
    sourceLanguage: asString(value.sourceLanguage, '英语（en）'),
    targetLanguage: asString(value.targetLanguage, '简体中文（zh-CN）'),
    domain: asString(value.domain, '通用'),
    textType: asString(value.textType, '长文本'),
    audience: asString(value.audience, '普通读者'),
    style: asString(value.style, '自然'),
    deadline: asString(value.deadline),
    status: asString(value.status, 'active') as Project['status'],
    mode: asString(value.mode, aiPretranslate ? 'ai-pretranslate' : 'student-first') as Project['mode'],
    memoryId: asString(value.memoryId, 'tm-personal'),
    termbaseId: asString(value.termbaseId, 'tb-personal'),
    styleGuideId: asString(value.styleGuideId),
    enabledSkills: asArray<string>(value.enabledSkills),
    aiPretranslate,
    termLookup: asBoolean(value.termLookup, true),
    culturalRecognition: asBoolean(value.culturalRecognition, true),
    mtToneCheck: asBoolean(value.mtToneCheck, true),
    strictTerminology: asBoolean(value.strictTerminology, true),
    batchSize: asNumber(value.batchSize, defaultBatchSize),
    activeBatchJobId: asString(value.activeBatchJobId),
    files: asArray(value.files).map(migrateFile),
    createdAt: asString(value.createdAt, new Date().toISOString()),
    updatedAt: asString(value.updatedAt, new Date().toISOString()),
  }
}

const migrateContentItem = (value: unknown, index: number): ContentItem => {
  if (!isRecord(value)) throw new Error(`第 ${index + 1} 条内容格式无效`)
  const now = new Date().toISOString()
  const tags = asArray<string>(value.tags)
  return {
    id: asString(value.id, `content-migrated-${index + 1}`),
    title: asString(value.title, '未命名内容'),
    category: asString(value.category, tags[0] ?? '用户自定义素材'),
    contentType: asString(value.contentType, 'learning') as ContentItem['contentType'],
    source: asString(value.source, '未知来源'),
    sourceId: asString(value.sourceId),
    publishedAt: asString(value.publishedAt),
    url: asString(value.url),
    summary: asString(value.summary),
    level: asString(value.level, '待评估'),
    language: asString(value.language, '待识别'),
    readingMinutes: asNumber(value.readingMinutes, 0),
    keywords: asArray<string>(value.keywords),
    tags,
    trainingDirection: asString(value.trainingDirection),
    sourceNote: asString(value.sourceNote),
    copyrightStatus: asString(value.copyrightStatus, 'metadata-only') as ContentItem['copyrightStatus'],
    paragraphs: asArray(value.paragraphs),
    saved: asBoolean(value.saved, false),
    read: asBoolean(value.read, false),
    readingProgress: asNumber(value.readingProgress, 0),
    createdAt: asString(value.createdAt, now),
    updatedAt: asString(value.updatedAt, now),
  }
}

const migrateSettings = (value: unknown, seed: WorkspaceSettings): WorkspaceSettings => {
  const settings = isRecord(value) ? value : {}
  const storedModel = asString(settings.model, seed.model)
  const model = storedModel === 'deepseek-chat' ? 'deepseek-v4-flash' : storedModel === 'deepseek-reasoner' ? 'deepseek-v4-pro' : storedModel
  return {
    theme: asString(settings.theme, seed.theme) as WorkspaceSettings['theme'],
    learnerName: asString(settings.learnerName, seed.learnerName),
    provider: asString(settings.provider, seed.provider) as WorkspaceSettings['provider'],
    model,
    endpoint: asString(settings.endpoint),
    temperature: asNumber(settings.temperature, seed.temperature),
    requestLimit: asNumber(settings.requestLimit, seed.requestLimit),
    batchSize: asNumber(settings.batchSize, seed.batchSize),
    requestTimeoutMs: asNumber(settings.requestTimeoutMs, seed.requestTimeoutMs),
    retryCount: asNumber(settings.retryCount, seed.retryCount),
    contentProxyEndpoint: asString(settings.contentProxyEndpoint),
    autoSave: asBoolean(settings.autoSave, seed.autoSave),
  }
}

export const needsWorkspaceMigration = (value: unknown) => !isRecord(value) || value.schemaVersion !== CURRENT_SCHEMA_VERSION

export const migrateWorkspace = (value: unknown): Workspace => {
  if (!isRecord(value) || value.version !== 2) throw new Error('不是可识别的译学工作台 V2 数据')
  const seed = cloneSeed()
  const settings = migrateSettings(value.settings, seed.settings)
  const existingSkills = asArray(value.skills, seed.skills)
  const skills = [...existingSkills, ...seed.skills.filter((builtin) => !existingSkills.some((item) => isRecord(item) && item.id === builtin.id))] as Workspace['skills']
  return {
    version: 2,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: asArray(value.projects).map((project, index) => migrateProject(project, index, settings.batchSize)),
    quickSessions: asArray(value.quickSessions),
    translationMemory: asArray(value.translationMemory),
    terms: asArray(value.terms),
    styleGuides: asArray(value.styleGuides),
    phraseCards: asArray(value.phraseCards),
    reviewRecords: asArray(value.reviewRecords),
    news: asArray(value.news).map(migrateContentItem),
    sources: asArray(value.sources, seed.sources),
    practices: asArray(value.practices),
    personalReferences: asArray(value.personalReferences),
    skills,
    skillExecutionLogs: asArray(value.skillExecutionLogs),
    aiRequestLogs: asArray(value.aiRequestLogs),
    batchJobs: asArray(value.batchJobs),
    qualityIssues: asArray(value.qualityIssues),
    settings,
    lastSavedAt: asString(value.lastSavedAt, new Date().toISOString()),
  }
}
