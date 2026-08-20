import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppV2 from '../AppV2'
import { DB_NAME, loadWorkspace } from '../storage'

afterEach(async () => {
  cleanup()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
})

describe('V2 application shell', () => {
  it('loads the dashboard from IndexedDB or the seed workspace', async () => {
    render(<AppV2 />)

    expect(await screen.findByRole('heading', { name: /今天的译稿/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始快速翻译' })).toBeInTheDocument()
    expect(screen.getByText('只展示当前浏览器的真实记录；数据不足时不推断学习效果。')).toBeInTheDocument()
  })

  it('autosaves a non-empty quick translation session', async () => {
    const user = userEvent.setup()
    render(<AppV2 />)
    await screen.findByRole('heading', { name: /今天的译稿/ })
    await user.click(screen.getAllByRole('button', { name: /快速翻译/ })[0])
    await user.type(screen.getByPlaceholderText('输入或粘贴句子、段落、摘要或短篇文本……'), 'Autosave this source.')

    await waitFor(async () => {
      const restored = await loadWorkspace()
      expect(restored.quickSessions[0]?.source).toBe('Autosave this source.')
    }, { timeout: 3000 })
  })

  it('filters projects by a real search input and shows a useful empty state', async () => {
    const user = userEvent.setup()
    render(<AppV2 />)
    await screen.findByRole('heading', { name: /今天的译稿/ })
    await user.click(screen.getByRole('button', { name: '翻译项目⌥3' }))
    await user.type(screen.getByPlaceholderText('搜索项目名称、领域或文件……'), '不存在的项目')
    expect(screen.getByText('没有符合条件的项目')).toBeInTheDocument()
  })

  it('creates a terminology entry through the asset form and persists it', async () => {
    const user = userEvent.setup()
    render(<AppV2 />)
    await screen.findByRole('heading', { name: /今天的译稿/ })
    await user.click(screen.getByRole('button', { name: '语言资产⌥6' }))
    await user.click(screen.getByRole('button', { name: '术语库2' }))
    await user.click(screen.getByRole('button', { name: '新增' }))
    await user.type(screen.getByLabelText('源文／来源'), 'human-centred learning')
    await user.type(screen.getByLabelText('译文'), '以人为本的学习')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByText('human-centred learning')).toBeInTheDocument()
    await waitFor(async () => expect((await loadWorkspace()).terms.some((term) => term.source === 'human-centred learning')).toBe(true), { timeout: 3000 })
  })

  it('shows a truthful content-sync failure when no proxy is configured', async () => {
    const user = userEvent.setup()
    render(<AppV2 />)
    await screen.findByRole('heading', { name: /今天的译稿/ })
    await user.click(screen.getByRole('button', { name: '每日译闻⌥4' }))
    await user.click(screen.getByRole('button', { name: '刷新来源' }))
    expect(await screen.findByText('尚未配置内容同步代理，未抓取或伪造任何新闻')).toBeInTheDocument()
  })
})
