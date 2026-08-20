import assert from 'node:assert/strict'
import test from 'node:test'
import { handleAction, parseJsonOutput } from './core.mjs'

test('parses plain and fenced JSON output', () => {
  assert.deepEqual(parseJsonOutput('{"ok":true}'), { ok: true })
  assert.deepEqual(parseJsonOutput('```json\n{"ok":true}\n```'), { ok: true })
})

test('connection test never exposes the API key', async () => {
  const result = await handleAction({ action: 'test', model: 'deepseek-v4-flash' }, { apiKey: 'secret-test-key', invoke: async () => ({ id: 'request-1', model: 'deepseek-v4-flash', data: { ok: true } }) })
  assert.equal(result.ok, true)
  assert.equal(JSON.stringify(result).includes('secret-test-key'), false)
})

test('batch translation maps only requested unique segment IDs', async () => {
  let capturedRequest
  const result = await handleAction({ action: 'translate-segments', model: 'deepseek-v4-flash', sourceLanguage: '英语（en）', targetLanguage: '简体中文（zh-CN）', domain: '翻译教育', segments: [{ segmentId: 's1', source: 'One' }, { segmentId: 's2', source: 'Two' }] }, { apiKey: 'test', invoke: async (request) => { capturedRequest = request; return { id: 'request-2', model: 'deepseek-v4-flash', data: { translations: [{ segmentId: 's2', target: '二' }, { segmentId: 'unknown', target: '错误' }, { segmentId: 's2', target: '重复' }, { segmentId: 's1', target: '一' }] } } } })
  assert.deepEqual(result.translations.map((item) => item.segmentId), ['s2', 's1'])
  assert.deepEqual(result.translations.map((item) => item.target), ['二', '一'])
  assert.match(capturedRequest.messages[1].content, /简体中文（zh-CN）/)
  assert.match(capturedRequest.messages[1].content, /翻译教育/)
})

test('batch translation rejects a request without a target language', async () => {
  await assert.rejects(() => handleAction({ action: 'translate-segments', segments: [{ segmentId: 's1', source: 'One' }] }, { apiKey: 'test', invoke: async () => { throw new Error('should not call') } }), /目标语言为空/)
})

test('term lookup forces sources to stay empty without retrieval', async () => {
  const result = await handleAction({ action: 'lookup-term', term: 'agency', sourceText: 'human agency' }, { apiKey: 'test', invoke: async () => ({ id: 'request-3', model: 'deepseek-v4-flash', data: { term: 'agency', meaning: '能力', sources: [{ title: '伪造来源', url: 'https://invalid.example' }] } }) })
  assert.deepEqual(result.sources, [])
})

test('rejects unsupported actions before sending any model request', async () => {
  await assert.rejects(() => handleAction({ action: 'delete-all' }, { apiKey: 'test', invoke: async () => { throw new Error('should not call') } }), /不支持/)
})
