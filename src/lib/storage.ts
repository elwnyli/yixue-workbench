import { seedState } from '../data/seed'
import type { WorkspaceState } from '../types'

const STORAGE_KEY = 'yixue-workbench-v1'

export const cloneSeedState = (): WorkspaceState => JSON.parse(JSON.stringify(seedState)) as WorkspaceState

export const loadWorkspace = (): WorkspaceState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneSeedState()
    const saved = JSON.parse(raw) as Partial<WorkspaceState>
    const defaults = cloneSeedState()
    return {
      ...defaults,
      ...saved,
      readings: saved.readings ?? defaults.readings,
      tasks: saved.tasks ?? defaults.tasks,
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

export const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
