import { describe, expect, it } from 'vitest'
import { parseFile, parsePastedText } from '../services/parser'

describe('document parsing', () => {
  it('splits pasted paragraphs and sentences into stable ordered segments', () => {
    const file = parsePastedText('测试材料', 'First sentence. Second sentence.\n\n第三段。')

    expect(file.type).toBe('pasted')
    expect(file.segments.map((segment) => segment.order)).toEqual([1, 2, 3])
    expect(new Set(file.segments.map((segment) => segment.id)).size).toBe(3)
    expect(file.segments.every((segment) => segment.aiState.status === 'idle')).toBe(true)
  })

  it('imports TXT and Markdown without sending the file anywhere', async () => {
    const txt = new File(['One paragraph. Another sentence.'], 'sample.txt', { type: 'text/plain' })
    const markdown = new File(['# Heading\n\nA paragraph.'], 'sample.md', { type: 'text/markdown' })

    const [txtResult, markdownResult] = await Promise.all([parseFile(txt), parseFile(markdown)])

    expect(txtResult.type).toBe('txt')
    expect(markdownResult.type).toBe('markdown')
    expect(markdownResult.structure).toBe('headings')
    expect(txtResult.segments.length).toBeGreaterThan(0)
  })
})
