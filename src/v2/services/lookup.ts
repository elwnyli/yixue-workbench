import { createId } from '../data'
import type { Project, Segment, TermEntry, TermLookupResult, WorkspaceSettings } from '../types'

export const lookupTerm = async (term: string, segment: Segment, project: Project, terms: TermEntry[], settings: WorkspaceSettings): Promise<TermLookupResult> => {
  const normalized = term.trim().toLowerCase()
  const local = terms.find((item) => item.status === 'approved' && item.source.trim().toLowerCase() === normalized)
  if (local) return { id: createId('lookup'), term: local.source, partOfSpeech: local.partOfSpeech, meaning: local.definition, contextMeaning: local.definition, recommendedTranslations: [local.target, ...local.allowed].filter(Boolean), forbiddenTranslations: local.forbidden, examples: local.example ? [local.example] : [], sources: [{ title: local.sourceRef || '个人术语库', url: '', snippet: local.definition, sourceType: local.sourceRef ? 'user' : 'project' }], provider: 'local', createdAt: new Date().toISOString() }
  if (settings.provider !== 'deepseek-proxy' || !settings.endpoint) throw new Error('个人术语库没有匹配项；请配置安全代理后查询外部来源')
  const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), settings.requestTimeoutMs)
  try {
    const response = await fetch(settings.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'lookup-term', term: term.trim(), sourceText: segment.source, domain: project.domain, targetLanguage: project.targetLanguage, context: segment.source }), signal: controller.signal })
    if (!response.ok) throw new Error(`术语代理返回 ${response.status}`)
    const payload = await response.json() as Partial<TermLookupResult>
    if (!payload.meaning && !payload.contextMeaning) throw new Error('术语代理没有返回可用解释')
    return { id: createId('lookup'), term: payload.term || term.trim(), partOfSpeech: payload.partOfSpeech || '', meaning: payload.meaning || '', contextMeaning: payload.contextMeaning || '', recommendedTranslations: payload.recommendedTranslations ?? [], forbiddenTranslations: payload.forbiddenTranslations ?? [], examples: payload.examples ?? [], sources: (payload.sources ?? []).filter((source) => source.title || source.url), provider: 'deepseek-proxy', createdAt: new Date().toISOString() }
  } finally { window.clearTimeout(timeout) }
}
