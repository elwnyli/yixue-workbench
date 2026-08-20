import { cloneSeed } from './data'
import { migrateWorkspace, needsWorkspaceMigration } from './migrations'
import type { Workspace } from './types'

export const DB_NAME = 'yixue-workbench-v2'
export const DB_VERSION = 2
export const STORE_NAME = 'workspace'
export const BACKUP_STORE_NAME = 'workspace-backups'
export const STATE_KEY = 'current'

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    if (!request.result.objectStoreNames.contains(BACKUP_STORE_NAME)) request.result.createObjectStore(BACKUP_STORE_NAME)
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const readValue = <T>(database: IDBDatabase, storeName: string, key: IDBValidKey) => new Promise<T | undefined>((resolve, reject) => {
  const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key)
  request.onsuccess = () => resolve(request.result as T | undefined)
  request.onerror = () => reject(request.error)
})

const writeValue = (database: IDBDatabase, storeName: string, key: IDBValidKey, value: unknown) => new Promise<void>((resolve, reject) => {
  const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(value, key)
  request.onsuccess = () => resolve()
  request.onerror = () => reject(request.error)
})

const backupWorkspace = async (database: IDBDatabase, raw: unknown, reason: 'migration' | 'migration-failed') => {
  const createdAt = new Date().toISOString()
  const key = `${reason}-${createdAt}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
  await writeValue(database, BACKUP_STORE_NAME, key, { reason, createdAt, raw })
}

export const loadWorkspace = async (): Promise<Workspace> => {
  const database = await openDatabase()

  try {
    const raw = await readValue<unknown>(database, STORE_NAME, STATE_KEY)
    if (raw === undefined) return cloneSeed()
    if (!needsWorkspaceMigration(raw)) return migrateWorkspace(raw)

    try {
      const migrated = migrateWorkspace(raw)
      await backupWorkspace(database, raw, 'migration')
      await writeValue(database, STORE_NAME, STATE_KEY, migrated)
      return migrated
    } catch (error) {
      await backupWorkspace(database, raw, 'migration-failed')
      throw error
    }
  } finally {
    database.close()
  }
}

export const saveWorkspace = async (workspace: Workspace) => {
  const database = await openDatabase()
  try {
    const normalized = migrateWorkspace({ ...workspace, lastSavedAt: new Date().toISOString() })
    await writeValue(database, STORE_NAME, STATE_KEY, normalized)
  } finally {
    database.close()
  }
}

export const listWorkspaceBackups = async () => {
  const database = await openDatabase()
  try {
    return await new Promise<Array<{ key: IDBValidKey; reason: string; createdAt: string }>>((resolve, reject) => {
      const request = database.transaction(BACKUP_STORE_NAME, 'readonly').objectStore(BACKUP_STORE_NAME).openCursor()
      const backups: Array<{ key: IDBValidKey; reason: string; createdAt: string }> = []
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) { resolve(backups); return }
        const value = cursor.value as { reason?: string; createdAt?: string }
        backups.push({ key: cursor.key, reason: value.reason ?? 'unknown', createdAt: value.createdAt ?? '' })
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
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

const SENSITIVE_EXPORT_KEYS = new Set(['apiKey', 'secret', 'accessToken', 'authorization', 'password'])

export const sanitizeForExport = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeForExport)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_EXPORT_KEYS.has(key)).map(([key, nested]) => [key, sanitizeForExport(nested)]))
}

export const serializeWorkspace = (workspace: Workspace) => JSON.stringify({
  exportedAt: new Date().toISOString(),
  workspace: sanitizeForExport(migrateWorkspace(workspace)),
}, null, 2)

export const parseWorkspaceImport = (content: string): Workspace => {
  const parsed = JSON.parse(content) as unknown
  const raw = typeof parsed === 'object' && parsed !== null && 'workspace' in parsed ? (parsed as { workspace: unknown }).workspace : parsed
  return migrateWorkspace(raw)
}

export const exportWorkspace = (workspace: Workspace) => downloadText(
  `yixue-v2-${new Date().toISOString().slice(0, 10)}.json`,
  serializeWorkspace(workspace),
  'application/json',
)
