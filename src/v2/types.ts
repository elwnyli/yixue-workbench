export type ViewKey = 'home' | 'quick' | 'projects' | 'news' | 'review' | 'assets' | 'skills' | 'settings'
export type TranslationMode = 'student-first' | 'reference' | 'analysis-only'
export type ProjectMode = 'ai-pretranslate' | 'student-first'
export type SegmentStatus = 'untranslated' | 'pretranslated' | 'translating' | 'translated' | 'needs-confirmation' | 'confirmed' | 'issue' | 'completed'
export type TargetOrigin = 'human' | 'tm-exact' | 'tm-fuzzy' | 'deepseek' | 'ai-edited' | 'imported'
export type Severity = 'info' | 'warning' | 'error'
export type AIProvider = 'demo' | 'deepseek-proxy'
export type AIJobStatus = 'idle' | 'queued' | 'matching' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface SegmentAIState {
  status: AIJobStatus
  jobId: string
  requestId: string
  provider: AIProvider | ''
  retryCount: number
  error: string
  lastAttemptAt: string
  completedAt: string
}

export interface Revision {
  id: string
  before: string
  after: string
  type: 'manual' | 'ai-applied' | 'confirmed' | 'restored'
  reason: string
  createdAt: string
  origin?: TargetOrigin
  requestId?: string
  feedbackId?: string
}

export interface TermLookupSource {
  title: string
  url: string
  snippet: string
  sourceType: 'official' | 'academic' | 'dictionary' | 'project' | 'user' | 'ai'
}

export interface TermLookupResult {
  id: string
  term: string
  partOfSpeech: string
  meaning: string
  contextMeaning: string
  recommendedTranslations: string[]
  forbiddenTranslations: string[]
  examples: string[]
  sources: TermLookupSource[]
  provider: AIProvider | 'local'
  createdAt: string
}

export interface CulturalNote {
  id: string
  expression: string
  category: 'proper-name' | 'institution' | 'abbreviation' | 'idiom' | 'metaphor' | 'cultural-concept' | 'ambiguity'
  explanation: string
  translationAdvice: string
  sources: TermLookupSource[]
  provider: AIProvider | 'local'
  createdAt: string
}

export interface Segment {
  id: string
  order: number
  source: string
  target: string
  initialTarget: string
  studentDraft: string
  aiPretranslation: string
  aiFeedback: Feedback[]
  termLookups: TermLookupResult[]
  culturalNotes: CulturalNote[]
  aiState: SegmentAIState
  status: SegmentStatus
  origin: TargetOrigin
  note: string
  revisions: Revision[]
  lastModifiedAt: string
  lastAIRequestAt: string
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
  mode: ProjectMode
  memoryId: string
  termbaseId: string
  styleGuideId: string
  enabledSkills: string[]
  aiPretranslate: boolean
  termLookup: boolean
  culturalRecognition: boolean
  mtToneCheck: boolean
  strictTerminology: boolean
  batchSize: number
  activeBatchJobId: string
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
  resolvedAt?: string
  resolutionNote?: string
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

export interface ContentParagraph {
  id: string
  order: number
  text: string
  translatable: boolean
}

export interface ContentItem {
  id: string
  title: string
  category: string
  contentType: 'news' | 'industry' | 'academic' | 'learning' | 'essay' | 'public-domain' | 'open-license' | 'user-import'
  source: string
  sourceId: string
  publishedAt: string
  url: string
  summary: string
  level: string
  language: string
  readingMinutes: number
  keywords: string[]
  tags: string[]
  trainingDirection: string
  sourceNote: string
  copyrightStatus: 'metadata-only' | 'short-excerpt' | 'public-domain' | 'open-license' | 'user-owned'
  paragraphs: ContentParagraph[]
  saved: boolean
  read: boolean
  readingProgress: number
  createdAt: string
  updatedAt: string
}

export type NewsItem = ContentItem

export interface SourceRegistry {
  id: string
  name: string
  homepageUrl: string
  feedUrl: string
  category: string
  defaultLanguage: string
  updateFrequencyMinutes: number
  enabled: boolean
  lastSyncedAt: string
  lastError: string
  createdAt: string
  updatedAt: string
}

export interface PracticeExercise {
  id: string
  contentId: string
  sourceUrl: string
  sourceText: string
  selectedExcerpt: string
  sourceParagraphId: string
  sourceLanguage: string
  targetLanguage: string
  domain: string
  style: string
  audience: string
  mode: TranslationMode
  studentDraft: string
  aiPretranslation: string
  aiReference: string
  finalTranslation: string
  feedback: Feedback[]
  createdAt: string
  updatedAt: string
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

export interface AIRequestLog {
  id: string
  action: 'translate-and-review' | 'review' | 'translate-segments' | 'review-segment' | 'lookup-term' | 'lookup-cultural-concept' | 'test'
  provider: AIProvider
  model: string
  projectId: string
  segmentIds: string[]
  requestCharacters: number
  status: 'pending' | 'success' | 'failed' | 'cancelled'
  error: string
  startedAt: string
  completedAt: string
}

export interface SkillExecutionLog {
  id: string
  skillId: string
  skillName: string
  inputType: string
  inputIds: string[]
  outputSummary: string
  success: boolean
  error: string
  executedAt: string
}

export interface BatchTranslationJob {
  id: string
  projectId: string
  fileId: string
  scope: 'project' | 'file' | 'selection'
  segmentIds: string[]
  completedSegmentIds: string[]
  failedSegmentIds: string[]
  status: Exclude<AIJobStatus, 'idle' | 'matching'>
  batchSize: number
  provider: AIProvider
  createdAt: string
  updatedAt: string
}

export interface PersonalReference {
  id: string
  title: string
  source: string
  url: string
  summary: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark' | 'system'
  learnerName: string
  provider: AIProvider
  model: string
  endpoint: string
  temperature: number
  requestLimit: number
  batchSize: number
  requestTimeoutMs: number
  retryCount: number
  contentProxyEndpoint: string
  autoSave: boolean
}

export interface Workspace {
  version: 2
  schemaVersion: 3
  projects: Project[]
  quickSessions: QuickSession[]
  translationMemory: TranslationUnit[]
  terms: TermEntry[]
  styleGuides: StyleGuide[]
  phraseCards: PhraseCard[]
  reviewRecords: ReviewRecord[]
  news: NewsItem[]
  sources: SourceRegistry[]
  practices: PracticeExercise[]
  personalReferences: PersonalReference[]
  skills: SkillManifest[]
  skillExecutionLogs: SkillExecutionLog[]
  aiRequestLogs: AIRequestLog[]
  batchJobs: BatchTranslationJob[]
  qualityIssues: QualityIssue[]
  settings: WorkspaceSettings
  lastSavedAt: string
}
