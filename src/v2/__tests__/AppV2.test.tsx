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
})
