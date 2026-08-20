import { createId } from '../data'
import { getDemoReference } from './ai'
import type {
  AIRequestLog,
  BatchTranslationJob,
  Project,
  Segment,
  TargetOrigin,
  TermEntry,
  TranslationUnit,
  Workspace,
} from '../types'

export interface BatchTranslationRequest {
  segmentId: string
  source: string
  previousSource: string
  nextSource: string
  terms: Array<{ source: string; target: string }>
}

export interface BatchTranslationResult {
  segmentId: string
  target: string
  origin: Extract<TargetOrigin, 'tm-exact' | 'tm-fuzzy' | 'deepseek'>
  requestId: string
  error: string
}

export type BatchTranslator = (requests: BatchTranslationRequest[], workspace: Workspace) => Promise<BatchTranslationResult[]>

export interface BatchStepResult {
  project: Project
  job: BatchTranslationJob
  log: AIRequestLog | undefined
}

const sameEditableSnapshot = (current: Segment, baseline: Segment) => current.source === baseline.source
  && current.target === baseline.target
  && current.status === baseline.status
  && current.origin === baseline.origin
  && current.lastModifiedAt === baseline.lastModifiedAt

/**
 * Applies an asynchronous batch response to the latest project state. A user edit
 * made while the request was in flight always wins over the older request snapshot.
 */
export const mergeBatchProject = (current: Project, baseline: Project, translated: Project): Project => {
  const baselineSegments = new Map(baseline.files.flatMap((file) => file.segments).map((segment) => [segment.id, segment]))
  const translatedSegments = new Map(translated.files.flatMap((file) => file.segments).map((segment) => [segment.id, segment]))
  return {
    ...current,
    updatedAt: translated.updatedAt,
    files: current.files.map((file) => ({
      ...file,
      segments: file.segments.map((segment) => {
        const before = baselineSegments.get(segment.id)
        const after = translatedSegments.get(segment.id)
        if (!before || !after || !sameEditableSnapshot(segment, before)) return segment
        return after
      }),
    })),
  }
}

const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
const textFeatures = (value: string) => {
  const normalized = normalize(value)
  const words = normalized.match(/[a-z0-9]+/g) ?? []
  const cjk = [...normalized].filter((character) => /[\u3400-\u9fff]/.test(character))
  const bigrams = cjk.slice(0, -1).map((character, index) => `${character}${cjk[index + 1]}`)
  return new Set([...words, ...bigrams, ...(cjk.length === 1 ? cjk : [])])
}

export const similarityScore = (left: string, right: string) => {
  if (normalize(left) === normalize(right)) return 1
  const one = textFeatures(left)
  const two = textFeatures(right)
  const common = [...one].filter((item) => two.has(item)).length
  return one.size + two.size ? 2 * common / (one.size + two.size) : 0
}

export const isProtectedSegment = (segment: Segment) => {
  if (['confirmed', 'completed'].includes(segment.status)) return true
  if (!segment.target.trim()) return false
  return segment.origin === 'human' || segment.origin === 'ai-edited' || segment.status === 'translating'
}

const findMemory = (segment: Segment, units: TranslationUnit[]) => {
  const exact = units.find((unit) => normalize(unit.source) === normalize(segment.source) && unit.target.trim())
  if (exact) return { unit: exact, origin: 'tm-exact' as const, score: 1 }
  const fuzzy = units.map((unit) => ({ unit, score: similarityScore(segment.source, unit.source) })).filter((item) => item.unit.target.trim() && item.score >= .72).sort((a, b) => b.score - a.score)[0]
  return fuzzy ? { ...fuzzy, origin: 'tm-fuzzy' as const } : undefined
}

const matchingTerms = (source: string, terms: TermEntry[]) => terms.filter((term) => term.status === 'approved' && normalize(source).includes(normalize(term.source))).map((term) => ({ source: term.source, target: term.target }))

export const createBatchJob = (project: Project, scope: BatchTranslationJob['scope'], fileId = '', selectedIds: string[] = []): BatchTranslationJob => {
  const scopedSegments = scope === 'project'
    ? project.files.flatMap((file) => file.segments)
    : scope === 'file'
      ? project.files.find((file) => file.id === fileId)?.segments ?? []
      : project.files.flatMap((file) => file.segments).filter((segment) => selectedIds.includes(segment.id))
  return {
    id: createId('batch'),
    projectId: project.id,
    fileId,
    scope,
    segmentIds: scopedSegments.filter((segment) => !isProtectedSegment(segment)).map((segment) => segment.id),
    completedSegmentIds: [],
    failedSegmentIds: [],
    status: 'queued',
    batchSize: Math.max(1, project.batchSize),
    provider: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const requestForSegment = (project: Project, segment: Segment, terms: TermEntry[]): BatchTranslationRequest => {
  const file = project.files.find((candidate) => candidate.segments.some((item) => item.id === segment.id))
  const index = file?.segments.findIndex((item) => item.id === segment.id) ?? -1
  return {
    segmentId: segment.id,
    source: segment.source,
    previousSource: index > 0 ? file?.segments[index - 1]?.source ?? '' : '',
    nextSource: index >= 0 ? file?.segments[index + 1]?.source ?? '' : '',
    terms: matchingTerms(segment.source, terms),
  }
}

export const requestBatchTranslations: BatchTranslator = async (requests, workspace) => {
  if (workspace.settings.provider === 'demo' || !workspace.settings.endpoint) {
    return requests.map((request) => {
      const target = getDemoReference(request.source)
      const unavailable = target.startsWith('演示模式不为任意文本')
      return { segmentId: request.segmentId, target: unavailable ? '' : target, origin: 'deepseek', requestId: createId('request'), error: unavailable ? '演示模式没有该片段的固定译文' : '' }
    })
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= workspace.settings.retryCount; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), workspace.settings.requestTimeoutMs)
    try {
      const response = await fetch(workspace.settings.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'translate-segments', model: workspace.settings.model, temperature: workspace.settings.temperature, segments: requests }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`服务返回 ${response.status}`)
      const payload = await response.json() as { translations?: Array<{ segmentId?: string; target?: string; requestId?: string; error?: string }> }
      const requestedIds = new Set(requests.map((request) => request.segmentId))
      const seen = new Set<string>()
      return (payload.translations ?? []).flatMap((item) => {
        const segmentId = item.segmentId ?? ''
        if (!requestedIds.has(segmentId) || seen.has(segmentId)) return []
        seen.add(segmentId)
        return [{ segmentId, target: item.target ?? '', origin: 'deepseek' as const, requestId: item.requestId ?? createId('request'), error: item.error ?? '' }]
      })
    } catch (error) {
      lastError = error
      if (attempt >= workspace.settings.retryCount) throw error
    } finally { window.clearTimeout(timeout) }
  }
  throw lastError instanceof Error ? lastError : new Error('批量请求失败')
}

const updateProjectSegments = (project: Project, results: BatchTranslationResult[], attemptedIds: string[], now: string, provider: Workspace['settings']['provider']): Project => {
  const byId = new Map(results.map((result) => [result.segmentId, result]))
  return {
    ...project,
    updatedAt: now,
    files: project.files.map((file) => ({
      ...file,
      segments: file.segments.map((segment) => {
        if (!attemptedIds.includes(segment.id) || isProtectedSegment(segment)) return segment
        const result = byId.get(segment.id)
        if (!result || result.error || !result.target.trim()) return { ...segment, aiState: { ...segment.aiState, status: 'failed' as const, error: result?.error || '服务未返回对应片段', retryCount: segment.aiState.retryCount + 1, lastAttemptAt: now } }
        return {
          ...segment,
          target: result.target,
          aiPretranslation: result.origin === 'deepseek' ? result.target : segment.aiPretranslation,
          origin: result.origin,
          status: 'needs-confirmation' as const,
          revisions: [...segment.revisions, { id: createId('revision'), before: segment.target, after: result.target, type: 'ai-applied' as const, reason: result.origin === 'deepseek' ? '批量AI预翻译' : '翻译记忆预填充', createdAt: now, origin: result.origin, requestId: result.requestId }],
          aiState: { ...segment.aiState, status: 'completed' as const, requestId: result.requestId, provider: result.origin === 'deepseek' ? provider : '', error: '', lastAttemptAt: now, completedAt: now },
          lastAIRequestAt: result.origin === 'deepseek' ? now : segment.lastAIRequestAt,
          lastModifiedAt: now,
        }
      }),
    })),
  }
}

export const runBatchStep = async (project: Project, job: BatchTranslationJob, workspace: Workspace, translator: BatchTranslator = requestBatchTranslations): Promise<BatchStepResult> => {
  if (job.status === 'paused' || job.status === 'cancelled') return { project, job, log: undefined }
  const processed = new Set([...job.completedSegmentIds, ...job.failedSegmentIds])
  const pendingIds = job.segmentIds.filter((id) => !processed.has(id)).slice(0, job.batchSize)
  if (!pendingIds.length) return { project, job: { ...job, status: job.failedSegmentIds.length ? 'failed' as const : 'completed' as const, updatedAt: new Date().toISOString() }, log: undefined }

  const segments = project.files.flatMap((file) => file.segments).filter((segment) => pendingIds.includes(segment.id) && !isProtectedSegment(segment))
  const localResults: BatchTranslationResult[] = []
  const aiSegments: Segment[] = []
  for (const segment of segments) {
    const match = findMemory(segment, workspace.translationMemory)
    if (match) localResults.push({ segmentId: segment.id, target: match.unit.target, origin: match.origin, requestId: createId('tm'), error: '' })
    else aiSegments.push(segment)
  }

  const startedAt = new Date().toISOString()
  let aiResults: BatchTranslationResult[] = []
  let requestError = ''
  try { aiResults = aiSegments.length ? await translator(aiSegments.map((segment) => requestForSegment(project, segment, workspace.terms)), workspace) : [] } catch (error) { requestError = error instanceof Error ? error.message : '批量请求失败' }
  const returnedIds = new Set(aiResults.map((result) => result.segmentId))
  const completedIds = [...localResults, ...aiResults].filter((result) => result.target.trim() && !result.error).map((result) => result.segmentId)
  const failedIds = pendingIds.filter((id) => !completedIds.includes(id) && (aiSegments.some((segment) => segment.id === id) || !segments.some((segment) => segment.id === id)))
  const missingResults = aiSegments.filter((segment) => !returnedIds.has(segment.id)).map((segment) => ({ segmentId: segment.id, target: '', origin: 'deepseek' as const, requestId: '', error: requestError || '服务未返回对应片段' }))
  const allResults = [...localResults, ...aiResults, ...missingResults]
  const now = new Date().toISOString()
  const nextProject = updateProjectSegments(project, allResults, pendingIds, now, workspace.settings.provider)
  const nextCompleted = Array.from(new Set([...job.completedSegmentIds, ...completedIds]))
  const nextFailed = Array.from(new Set([...job.failedSegmentIds, ...failedIds]))
  const finished = nextCompleted.length + nextFailed.length >= job.segmentIds.length
  const nextJob: BatchTranslationJob = { ...job, provider: workspace.settings.provider, completedSegmentIds: nextCompleted, failedSegmentIds: nextFailed, status: finished ? (nextFailed.length ? 'failed' : 'completed') : 'running', updatedAt: now }
  const failedAIIds = aiSegments.map((segment) => segment.id).filter((id) => !completedIds.includes(id))
  const logError = requestError || (failedAIIds.length ? `${failedAIIds.length}个片段未返回有效译文` : '')
  const log: AIRequestLog | undefined = aiSegments.length ? { id: createId('ai-log'), action: 'translate-segments', provider: workspace.settings.provider, model: workspace.settings.model, projectId: project.id, segmentIds: aiSegments.map((segment) => segment.id), requestCharacters: aiSegments.reduce((sum, segment) => sum + segment.source.length, 0), status: logError ? 'failed' : 'success', error: logError, startedAt, completedAt: now } : undefined
  return { project: nextProject, job: nextJob, log }
}

export const retryFailedJob = (job: BatchTranslationJob): BatchTranslationJob => ({ ...job, failedSegmentIds: [], status: 'queued', updatedAt: new Date().toISOString() })
