export type ViewKey = 'home' | 'quick' | 'projects' | 'news' | 'review' | 'assets' | 'skills' | 'settings'
export type TranslationMode = 'student-first' | 'reference' | 'analysis-only'
export type SegmentStatus = 'untranslated' | 'pretranslated' | 'translating' | 'translated' | 'needs-confirmation' | 'confirmed' | 'issue' | 'completed'
export type TargetOrigin = 'human' | 'tm-exact' | 'tm-fuzzy' | 'deepseek' | 'ai-edited' | 'imported'
export type Severity = 'info' | 'warning' | 'error'

export interface Revision {
  id: string
  before: string
  after: string
  type: 'manual' | 'ai-applied' | 'confirmed' | 'restored'
  reason: string
  createdAt: string
}

export interface Segment {
  id: string
  order: number
  source: string
  target: string
  initialTarget: string
  status: SegmentStatus
  origin: TargetOrigin
  note: string
  revisions: Revision[]
}

export interface ProjectFile {
  id: string
  name: string
  type: 'txt' | 'markdown' | 'docx' | 'pasted'
  structure: 'plain' | 'headings' | 'document'
  segments: Segment[]
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description: string
  sourceLanguage: string
  targetLanguage: string
  domain: string
  textType: string
  audience: string
  style: string
  deadline: string
  status: 'draft' | 'active' | 'paused' | 'review' | 'completed' | 'archived'
  memoryId: string
  termbaseId: string
  styleGuideId: string
  enabledSkills: string[]
  aiPretranslate: boolean
  mtToneCheck: boolean
  strictTerminology: boolean
  files: ProjectFile[]
  createdAt: string
  updatedAt: string
}

export interface Feedback {
  id: string
  dimension: '准确性' | '完整性' | '术语' | '逻辑衔接' | '自然度' | '文体' | '读者适配' | '机器翻译腔' | '文化处理' | '格式规范'
  severity: Severity
  observation: string
  suggestion: string
  reason: string
  alternative: string
  decision: 'pending' | 'accepted' | 'rejected' | 'adapted'
}

export interface QuickSession {
  id: string
  source: string
  detectedLanguage: string
  sourceLanguage: string
  targetLanguage: string
  domain: string
  textType: string
  audience: string
  style: string
  mode: TranslationMode
  studentDraft: string
  aiReference: string
  finalTranslation: string
  feedback: Feedback[]
  createdAt: string
  updatedAt: string
}

export interface QualityIssue {
  id: string
  segmentId: string
  type: string
  severity: Severity
  message: string
  suggestion: string
  evidence: string
  resolved: boolean
}

export interface TranslationUnit {
  id: string
  source: string
  target: string
  sourceLanguage: string
  targetLanguage: string
  domain: string
  projectId?: string
  quality: 'draft' | 'reviewed' | 'approved'
  useCount: number
  createdAt: string
  updatedAt: string
}

export interface TermEntry {
  id: string
  source: string
  target: string
  definition: string
  domain: string
  partOfSpeech: string
  allowed: string[]
  forbidden: string[]
  example: string
  sourceRef: string
  status: 'candidate' | 'approved' | 'rejected'
}

export interface StyleGuide {
  id: string
  name: string
  audience: string
  formality: string
  punctuation: string
  dates: string
  names: string
  preferred: string[]
  forbidden: string[]
}

export interface PhraseCard {
  id: string
  type: 'term' | 'phrase' | 'error' | 'retranslation'
  source: string
  target: string
  context: string
  usage: string
  domain: string
  sourceRef: string
  errorRecord: string
  explanation: string
  tags: string[]
  mastery: 0 | 1 | 2 | 3 | 4 | 5
  nextReviewAt: string
  createdAt: string
}

export interface ReviewRecord {
  id: string
  cardId: string
  mode: 'source-target' | 'target-source' | 'cloze' | 'contrast' | 'retranslate'
  result: 'forgot' | 'fuzzy' | 'mastered'
  reviewedAt: string
  nextReviewAt: string
}

export interface NewsItem {
  id: string
  title: string
  source: string
  publishedAt: string
  url: string
  summary: string
  level: string
  tags: string[]
  trainingDirection: string
  sourceNote: string
  saved: boolean
}

export interface SkillManifest {
  id: string
  name: string
  version: string
  description: string
  category: 'quality' | 'style' | 'terminology' | 'learning'
  permissions: string[]
  acceptedInput: string[]
  producedOutput: string[]
  entryType: 'builtin'
  configurationSchema: Record<string, unknown>
  enabled: boolean
  updatedAt: string
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark' | 'system'
  learnerName: string
  provider: 'demo' | 'deepseek-proxy'
  model: string
  endpoint: string
  temperature: number
  requestLimit: number
  batchSize: number
  autoSave: boolean
}

export interface Workspace {
  version: 2
  projects: Project[]
  quickSessions: QuickSession[]
  translationMemory: TranslationUnit[]
  terms: TermEntry[]
  styleGuides: StyleGuide[]
  phraseCards: PhraseCard[]
  reviewRecords: ReviewRecord[]
  news: NewsItem[]
  skills: SkillManifest[]
  qualityIssues: QualityIssue[]
  settings: WorkspaceSettings
  lastSavedAt: string
}
