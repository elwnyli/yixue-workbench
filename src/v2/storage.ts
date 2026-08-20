import { cloneSeed } from './data'
import type { Workspace } from './types'

const DB_NAME = 'yixue-workbench-v2'
const STORE_NAME = 'workspace'
const STATE_KEY = 'current'

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

export const loadWorkspace = async (): Promise<Workspace> => {
  try {
    const database = await openDatabase()
    const state = await new Promise<Workspace | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STATE_KEY)
      request.onsuccess = () => resolve(request.result as Workspace | undefined)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return state?.version === 2 ? state : cloneSeed()
  } catch {
    return cloneSeed()
  }
}

export const saveWorkspace = async (workspace: Workspace) => {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ ...workspace, lastSavedAt: new Date().toISOString() }, STATE_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  database.close()
}

export const downloadText = (name: string, content: string, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportWorkspace = (workspace: Workspace) => downloadText(
  `yixue-v2-${new Date().toISOString().slice(0, 10)}.json`,
  JSON.stringify({ exportedAt: new Date().toISOString(), workspace }, null, 2),
  'application/json',
)
