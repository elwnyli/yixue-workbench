import { seedState } from '../data/seed'
import type { ReadingItem, TranslationTask, WorkspaceState } from '../types'

const STORAGE_KEY = 'yixue-workbench-v1'

const safeFileName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80) || '未命名任务'

const taskMarkdown = (task: TranslationTask) => `---
type: translation-project
title: "${task.title.replace(/"/g, '\\"')}"
stage: ${task.stage}
source_language: ${task.sourceLanguage}
target_language: ${task.targetLanguage}
updated: ${task.updatedAt}
---

# ${task.title}

## 项目要求

- 目标读者：${task.audience}
- 任务说明：${task.brief}
- 来源：${task.sourceName}

## 原文

${task.sourceText}

## 项目术语

${task.terms.length ? task.terms.map((term) => `- **${term.source}** → ${term.target || '待定'}${term.note ? `（${term.note}）` : ''}`).join('\n') : '- 暂无术语记录'}

## 初译

${task.initialTranslation || '尚未填写'}

## 修订稿

${task.revisedTranslation || '尚未填写'}

## LQA 质检

${task.qualityChecks.length ? task.qualityChecks.map((item) => `- [${item.status === 'pass' ? 'x' : ' '}] ${item.label}：${item.detail}`).join('\n') : '- 尚未运行'}

## 一致性记录

${task.consistencyNotes || '尚未填写'}

## 学习反思

${task.reflection || '尚未填写'}

## 反馈与决策

${task.feedback.length ? task.feedback.map((item) => `### ${item.role}｜${item.title}\n\n${item.observation}\n\n- 建议：${item.suggestion}\n- 决定：${item.status}\n- 理由：${item.reason || '未记录'}\n- 依据：${item.evidence}`).join('\n\n') : '尚无反馈记录'}
`

export const cloneSeedState = (): WorkspaceState => JSON.parse(JSON.stringify(seedState)) as WorkspaceState

export const loadWorkspace = (): WorkspaceState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneSeedState()
    const saved = JSON.parse(raw) as Partial<WorkspaceState>
    const defaults = cloneSeedState()
    const legacyStage = (stage?: string) => {
      if (stage === 'revision') return 'reflection'
      return stage ?? 'setup'
    }
    return {
      ...defaults,
      ...saved,
      templates: saved.templates ?? defaults.templates,
      readings: saved.readings ?? defaults.readings,
      tasks: (saved.tasks ?? defaults.tasks).map((task) => ({
        ...task,
        sourceLanguage: task.sourceLanguage ?? '英语（en）',
        targetLanguage: task.targetLanguage ?? '简体中文（zh-CN）',
        terms: task.terms ?? [],
        qualityChecks: task.qualityChecks ?? [],
        consistencyNotes: task.consistencyNotes ?? '',
        stage: legacyStage(task.stage) as TranslationTask['stage'],
      })),
      expressions: saved.expressions ?? defaults.expressions,
      knowledgeSources: saved.knowledgeSources ?? defaults.knowledgeSources,
      logs: saved.logs ?? defaults.logs,
      settings: { ...defaults.settings, ...(saved.settings ?? {}) },
    }
  } catch {
    return cloneSeedState()
  }
}

export const saveWorkspace = (state: WorkspaceState) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const downloadWorkspace = (state: WorkspaceState) => {
  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: '1.1',
      workspace: state,
    },
    null,
    2,
  )
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `yixue-workbench-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export const syncObsidianVault = async (state: WorkspaceState) => {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<any> }).showDirectoryPicker
  if (!picker) {
    const content = state.tasks.map(taskMarkdown).join('\n\n---\n\n')
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${safeFileName(state.settings.obsidianFolderName)}-${new Date().toISOString().slice(0, 10)}.md`
    anchor.click()
    URL.revokeObjectURL(url)
    return 'downloaded' as const
  }

  const vault = await picker()
  const folder = await vault.getDirectoryHandle(state.settings.obsidianFolderName || '译学工作台', { create: true })
  const indexHandle = await folder.getFileHandle('工作台索引.md', { create: true })
  const indexWritable = await indexHandle.createWritable()
  await indexWritable.write(`# 译学工作台\n\n最后同步：${new Date().toLocaleString('zh-CN')}\n\n${state.tasks.map((task) => `- [[${safeFileName(task.title)}]] · ${task.stage}`).join('\n')}\n`)
  await indexWritable.close()

  for (const task of state.tasks) {
    const handle = await folder.getFileHandle(`${safeFileName(task.title)}.md`, { create: true })
    const writable = await handle.createWritable()
    await writable.write(taskMarkdown(task))
    await writable.close()
  }
  return 'synced' as const
}

export const importMarkdownReadings = async (files: FileList): Promise<ReadingItem[]> => {
  const result: ReadingItem[] = []
  for (const file of Array.from(files)) {
    const raw = await file.text()
    const text = raw.replace(/^---[\s\S]*?---\s*/m, '').trim()
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.name.replace(/\.md$/i, '')
    result.push({
      id: createId('reading'),
      title,
      eyebrow: 'Obsidian 导入 · Markdown',
      summary: `从 ${file.name} 导入的本地材料，请在使用前核验来源与版权边界。`,
      sourceText: text,
      sourceName: file.name,
      sourceNote: '由用户从本地 Markdown 文件主动导入；平台未自动读取其他 Vault 内容。',
      publishedAt: new Date().toISOString().slice(0, 10),
      readingMinutes: Math.max(3, Math.ceil(text.length / 500)),
      tags: ['Obsidian', '本地材料'],
      prompt: '根据当前项目模板分析并翻译这份材料。',
    })
  }
  return result
}

export const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
