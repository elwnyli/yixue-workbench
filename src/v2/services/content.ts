import { createId } from '../data'
import type { ContentItem, SourceRegistry, Workspace } from '../types'

export interface ContentSyncReport {
  items: ContentItem[]
  sources: SourceRegistry[]
  added: number
  updated: number
  deduplicated: number
  failed: number
  error: string
}

const contentKey = (item: Pick<ContentItem, 'url' | 'title' | 'source'>) => item.url.trim().toLowerCase() || `${item.source}|${item.title}`.trim().toLowerCase()

export const mergeContentItems = (current: ContentItem[], incoming: ContentItem[]) => {
  const known = new Map(current.map((item) => [contentKey(item), item]))
  let added = 0; let updated = 0; let deduplicated = 0
  for (const item of incoming) {
    const key = contentKey(item)
    const previous = known.get(key)
    if (previous) {
      deduplicated += 1
      known.set(key, { ...previous, ...item, id: previous.id, saved: previous.saved, read: previous.read, readingProgress: previous.readingProgress, updatedAt: new Date().toISOString() })
      updated += JSON.stringify(previous) === JSON.stringify(known.get(key)) ? 0 : 1
    } else { known.set(key, item); added += 1 }
  }
  return { items: Array.from(known.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), added, updated, deduplicated }
}

const normalizeIncoming = (value: Partial<ContentItem>, source: SourceRegistry): ContentItem | undefined => {
  if (!value.title?.trim() || !value.url?.trim()) return undefined
  const now = new Date().toISOString()
  const copyrightStatus = value.copyrightStatus ?? 'metadata-only'
  return {
    id: value.id || createId('content'), title: value.title.trim(), category: value.category || source.category,
    contentType: value.contentType ?? 'news', source: value.source || source.name, sourceId: source.id,
    publishedAt: value.publishedAt || now, url: value.url, summary: value.summary || '', level: value.level || '待评估',
    language: value.language || source.defaultLanguage, readingMinutes: Math.max(1, Number(value.readingMinutes) || 3), keywords: value.keywords ?? [], tags: value.tags ?? [],
    trainingDirection: value.trainingDirection || '', sourceNote: value.sourceNote || '来自已配置来源；版权状态需以原始页面为准。',
    copyrightStatus, paragraphs: ['public-domain', 'open-license', 'user-owned'].includes(copyrightStatus) ? value.paragraphs ?? [] : [],
    saved: false, read: false, readingProgress: 0, createdAt: value.createdAt || now, updatedAt: now,
  }
}

export const syncContentSources = async (workspace: Workspace): Promise<ContentSyncReport> => {
  const enabled = workspace.sources.filter((source) => source.enabled)
  if (!workspace.settings.contentProxyEndpoint) return { items: workspace.news, sources: workspace.sources, added: 0, updated: 0, deduplicated: 0, failed: enabled.length || workspace.sources.length, error: '尚未配置内容同步代理，未抓取或伪造任何新闻' }
  if (!enabled.length) return { items: workspace.news, sources: workspace.sources, added: 0, updated: 0, deduplicated: 0, failed: 0, error: '没有启用的内容来源' }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), workspace.settings.requestTimeoutMs)
  const now = new Date().toISOString()
  try {
    const response = await fetch(workspace.settings.contentProxyEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'sync-sources', sources: enabled.map(({ id, name, feedUrl, category, defaultLanguage }) => ({ id, name, feedUrl, category, defaultLanguage })) }), signal: controller.signal })
    if (!response.ok) throw new Error(`内容代理返回 ${response.status}`)
    const payload = await response.json() as { items?: Partial<ContentItem>[]; errors?: Array<{ sourceId?: string; message?: string }> }
    const incoming = (payload.items ?? []).flatMap((item) => { const source = enabled.find((candidate) => candidate.id === item.sourceId) ?? enabled[0]; const normalized = normalizeIncoming(item, source); return normalized ? [normalized] : [] })
    const merged = mergeContentItems(workspace.news, incoming)
    const errors = new Map((payload.errors ?? []).map((item) => [item.sourceId ?? '', item.message ?? '同步失败']))
    return { ...merged, sources: workspace.sources.map((source) => !source.enabled ? source : { ...source, lastSyncedAt: now, lastError: errors.get(source.id) ?? '', updatedAt: now }), failed: errors.size, error: errors.size ? `${errors.size}个来源同步失败` : '' }
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError' ? '内容同步超时' : error instanceof Error ? error.message : '内容同步失败'
    return { items: workspace.news, sources: workspace.sources.map((source) => source.enabled ? { ...source, lastError: message, updatedAt: now } : source), added: 0, updated: 0, deduplicated: 0, failed: enabled.length, error: message }
  } finally { window.clearTimeout(timeout) }
}
