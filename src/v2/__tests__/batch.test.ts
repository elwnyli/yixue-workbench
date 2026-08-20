import { describe, expect, it, vi } from 'vitest'
import { cloneSeed } from '../data'
import { createBatchJob, isProtectedSegment, mergeBatchProject, retryFailedJob, runBatchStep, similarityScore } from '../services/batch'
import type { BatchTranslationRequest, BatchTranslationResult, BatchTranslator } from '../services/batch'

const demoProject = () => cloneSeed().projects[0]

describe('batch pretranslation', () => {
  it('protects confirmed and manually edited targets from batch jobs', () => {
    const project = demoProject()
    const second = project.files[0].segments[1]
    second.target = '用户已经写好的译文'
    second.status = 'translating'
    second.origin = 'human'

    const job = createBatchJob(project, 'project')

    expect(isProtectedSegment(project.files[0].segments[0])).toBe(true)
    expect(isProtectedSegment(second)).toBe(true)
    expect(job.segmentIds).toEqual(['seg-demo-3'])
  })

  it('maps reversed service responses by segmentId instead of response order', async () => {
    const workspace = cloneSeed()
    const project = workspace.projects[0]
    const job = createBatchJob(project, 'project')
    const translatorMock = vi.fn(async (requests: BatchTranslationRequest[]): Promise<BatchTranslationResult[]> => [
      { segmentId: requests[1].segmentId, target: '第三段译文', origin: 'deepseek', requestId: 'request-3', error: '' },
      { segmentId: requests[0].segmentId, target: '第二段译文', origin: 'deepseek', requestId: 'request-2', error: '' },
    ])
    const translator: BatchTranslator = translatorMock

    const result = await runBatchStep(project, job, workspace, translator)
    const segments = result.project.files[0].segments

    expect(segments.find((segment) => segment.id === 'seg-demo-2')?.target).toBe('第二段译文')
    expect(segments.find((segment) => segment.id === 'seg-demo-3')?.target).toBe('第三段译文')
    expect(result.job.status).toBe('completed')
    expect(result.job.completedSegmentIds).toEqual(expect.arrayContaining(['seg-demo-2', 'seg-demo-3']))
    expect(translatorMock.mock.calls[0][0][0]).toMatchObject({
      sourceLanguage: project.sourceLanguage,
      targetLanguage: project.targetLanguage,
      domain: project.domain,
    })
  })

  it('uses exact translation memory before calling the model', async () => {
    const workspace = cloneSeed()
    const project = workspace.projects[0]
    workspace.translationMemory.unshift({
      id: 'tm-exact-test', source: project.files[0].segments[1].source, target: '来自翻译记忆的译文', sourceLanguage: project.sourceLanguage,
      targetLanguage: project.targetLanguage, domain: project.domain, quality: 'approved', useCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    const translatorMock = vi.fn(async (requests: BatchTranslationRequest[]): Promise<BatchTranslationResult[]> => requests.map((request) => ({ segmentId: request.segmentId, target: '模型译文', origin: 'deepseek', requestId: 'ai-request', error: '' })))
    const translator: BatchTranslator = translatorMock

    const result = await runBatchStep(project, createBatchJob(project, 'project'), workspace, translator)
    const second = result.project.files[0].segments[1]

    expect(second.target).toBe('来自翻译记忆的译文')
    expect(second.origin).toBe('tm-exact')
    expect(translatorMock).toHaveBeenCalledOnce()
    expect(translatorMock.mock.calls[0][0]).toHaveLength(1)
  })

  it('records a missing result as one failed segment without interrupting successful segments', async () => {
    const workspace = cloneSeed()
    const project = workspace.projects[0]
    const translator: BatchTranslator = async (requests) => [{ segmentId: requests[0].segmentId, target: '成功译文', origin: 'deepseek', requestId: 'ok', error: '' }]

    const result = await runBatchStep(project, createBatchJob(project, 'project'), workspace, translator)

    expect(result.job.completedSegmentIds).toEqual(['seg-demo-2'])
    expect(result.job.failedSegmentIds).toEqual(['seg-demo-3'])
    expect(result.project.files[0].segments[1].target).toBe('成功译文')
    expect(result.project.files[0].segments[2].target).toBe('')
    expect(result.project.files[0].segments[2].aiState.status).toBe('failed')
    expect(result.log?.status).toBe('failed')
  })

  it('processes only one configured batch at a time so progress can be persisted and resumed', async () => {
    const workspace = cloneSeed()
    const project = workspace.projects[0]
    project.batchSize = 1
    const translator: BatchTranslator = async (requests) => requests.map((request) => ({ segmentId: request.segmentId, target: `译文-${request.segmentId}`, origin: 'deepseek', requestId: request.segmentId, error: '' }))
    const first = await runBatchStep(project, createBatchJob(project, 'project'), workspace, translator)

    expect(first.job.status).toBe('running')
    expect(first.job.completedSegmentIds).toHaveLength(1)

    const second = await runBatchStep(first.project, first.job, workspace, translator)
    expect(second.job.status).toBe('completed')
    expect(second.job.completedSegmentIds).toHaveLength(2)
  })

  it('does not overwrite a segment edited after the job was created', async () => {
    const workspace = cloneSeed()
    const project = workspace.projects[0]
    const job = createBatchJob(project, 'project')
    const second = project.files[0].segments[1]
    second.target = '任务创建后用户输入的译文'
    second.origin = 'human'
    second.status = 'translating'
    const translator: BatchTranslator = async (requests) => requests.map((request) => ({ segmentId: request.segmentId, target: '模型结果', origin: 'deepseek', requestId: 'request', error: '' }))

    const result = await runBatchStep(project, job, workspace, translator)

    expect(result.project.files[0].segments[1].target).toBe('任务创建后用户输入的译文')
    expect(result.project.files[0].segments[1].origin).toBe('human')
  })

  it('keeps edits made while an asynchronous request is in flight', async () => {
    const workspace = cloneSeed()
    const baseline = workspace.projects[0]
    const translator: BatchTranslator = async (requests) => requests.map((request) => ({ segmentId: request.segmentId, target: '稍后返回的模型译文', origin: 'deepseek', requestId: 'late', error: '' }))
    const result = await runBatchStep(baseline, createBatchJob(baseline, 'project'), workspace, translator)
    const current = structuredClone(baseline)
    current.files[0].segments[1].target = '请求期间用户写下的译文'
    current.files[0].segments[1].origin = 'human'
    current.files[0].segments[1].status = 'translating'
    current.files[0].segments[1].lastModifiedAt = new Date(Date.now() + 1000).toISOString()

    const merged = mergeBatchProject(current, baseline, result.project)

    expect(merged.files[0].segments[1].target).toBe('请求期间用户写下的译文')
    expect(merged.files[0].segments[2].target).toBe('稍后返回的模型译文')
  })

  it('can requeue only failed work and supports Chinese fuzzy similarity', () => {
    const project = demoProject()
    const job = createBatchJob(project, 'project')
    job.status = 'failed'
    job.failedSegmentIds = ['seg-demo-3']

    expect(retryFailedJob(job).failedSegmentIds).toEqual([])
    expect(retryFailedJob(job).status).toBe('queued')
    expect(similarityScore('人工智能支持人的判断', '人工智能应当支持人的判断')).toBeGreaterThan(.7)
  })
})
