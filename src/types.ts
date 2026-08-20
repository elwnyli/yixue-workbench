export type ViewKey = 'overview' | 'reading' | 'studio' | 'library' | 'notebook' | 'logs' | 'settings'

export type TaskStage = 'draft' | 'feedback' | 'revision' | 'complete'

export type DecisionStatus = 'pending' | 'accepted' | 'rejected'

export interface ReadingItem {
  id: string
  title: string
  eyebrow: string
  summary: string
  sourceText: string
  sourceName: string
  sourceUrl?: string
  sourceNote: string
  publishedAt: string
  readingMinutes: number
  tags: string[]
  prompt: string
}

export interface FeedbackItem {
  id: string
  role: '任务分析' | '术语核验' | '译文审校' | '学习反思'
  title: string
  observation: string
  suggestion: string
  evidence: string
  status: DecisionStatus
  reason: string
  expression?: string
  meaning?: string
}

export interface TranslationTask {
  id: string
  readingId: string
  title: string
  sourceText: string
  sourceName: string
  sourceUrl?: string
  brief: string
  audience: string
  initialTranslation: string
  revisedTranslation: string
  reflection: string
  stage: TaskStage
  feedback: FeedbackItem[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ExpressionCard {
  id: string
  expression: string
  meaning: string
  context: string
  sourceTaskId?: string
  sourceLabel: string
  level: number
  nextReviewAt: string
  createdAt: string
}

export interface KnowledgeSource {
  id: string
  title: string
  kind: '规范' | '术语库' | '平行文本' | '课程材料'
  organization: string
  description: string
  url?: string
  language: string
  verifiedAt: string
  tags: string[]
  usageNote: string
}

export interface ActivityLog {
  id: string
  type: 'task' | 'feedback' | 'decision' | 'revision' | 'expression' | 'review' | 'system'
  title: string
  detail: string
  taskId?: string
  createdAt: string
}

export interface WorkspaceSettings {
  learnerName: string
  primaryAudience: '翻译专业本科生' | 'MTI学生'
  feedbackMode: 'demo' | 'endpoint'
  aiEndpoint: string
}

export interface WorkspaceState {
  readings: ReadingItem[]
  tasks: TranslationTask[]
  expressions: ExpressionCard[]
  knowledgeSources: KnowledgeSource[]
  logs: ActivityLog[]
  settings: WorkspaceSettings
}
