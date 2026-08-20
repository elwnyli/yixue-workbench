import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloneSeed } from '../data'
import { mergeContentItems, syncContentSources } from '../services/content'

afterEach(() => vi.unstubAllGlobals())

describe('content source synchronization', () => {
  it('does not pretend static records were refreshed without a proxy', async () => {
    const workspace = cloneSeed()
    const result = await syncContentSources(workspace)
    expect(result.items).toEqual(workspace.news)
    expect(result.added).toBe(0)
    expect(result.error).toContain('未配置')
  })

  it('deduplicates by URL while preserving saved and read state', () => {
    const workspace = cloneSeed()
    workspace.news[0].saved = true
    workspace.news[0].read = true
    const incoming = { ...workspace.news[0], id: 'remote-id', summary: '更新后的摘要', saved: false, read: false }
    const result = mergeContentItems(workspace.news, [incoming])
    const updated = result.items.find((item) => item.url === incoming.url)
    expect(result.deduplicated).toBe(1)
    expect(updated?.id).toBe('news-unesco')
    expect(updated?.summary).toBe('更新后的摘要')
    expect(updated?.saved).toBe(true)
    expect(updated?.read).toBe(true)
  })

  it('drops full paragraphs for ordinary metadata-only news returned by a proxy', async () => {
    const workspace = cloneSeed()
    workspace.settings.contentProxyEndpoint = 'https://proxy.example/content'
    workspace.sources[0].enabled = true
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{ title: '新资讯', url: 'https://example.com/story', sourceId: 'source-unesco', paragraphs: [{ id: 'p1', order: 1, text: '受版权保护的全文', translatable: true }] }] }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const result = await syncContentSources(workspace)
    const added = result.items.find((item) => item.url === 'https://example.com/story')
    expect(added?.copyrightStatus).toBe('metadata-only')
    expect(added?.paragraphs).toEqual([])
  })
})
