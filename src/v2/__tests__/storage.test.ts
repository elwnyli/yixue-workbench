import { afterEach, describe, expect, it } from 'vitest'
import { cloneSeed } from '../data'
import {
  BACKUP_STORE_NAME,
  DB_NAME,
  STATE_KEY,
  STORE_NAME,
  listWorkspaceBackups,
  loadWorkspace,
  parseWorkspaceImport,
  saveWorkspace,
  serializeWorkspace,
} from '../storage'

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(DB_NAME)
  request.onsuccess = () => resolve()
  request.onerror = () => reject(request.error)
  request.onblocked = () => reject(new Error('测试数据库仍被占用'))
})

const createLegacyDatabase = (raw: unknown) => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
  request.onerror = () => reject(request.error)
  request.onsuccess = () => {
    const database = request.result
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(raw, STATE_KEY)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => reject(transaction.error)
  }
})

afterEach(async () => { await deleteDatabase() })

describe('workspace storage', () => {
  it('saves and restores the current workspace', async () => {
    const workspace = cloneSeed()
    workspace.settings.learnerName = '持久化测试'
    await saveWorkspace(workspace)

    const restored = await loadWorkspace()

    expect(restored.settings.learnerName).toBe('持久化测试')
    expect(restored.schemaVersion).toBe(3)
  })

  it('backs up legacy data before migrating it', async () => {
    const legacy = cloneSeed() as unknown as Record<string, unknown>
    delete legacy.schemaVersion
    await createLegacyDatabase(legacy)

    const migrated = await loadWorkspace()
    const backups = await listWorkspaceBackups()

    expect(migrated.schemaVersion).toBe(3)
    expect(backups).toHaveLength(1)
    expect(backups[0].reason).toBe('migration')
  })

  it('never includes secret-like fields in exports', () => {
    const workspace = cloneSeed()
    const term = workspace.terms[0] as typeof workspace.terms[number] & { apiKey?: string; metadata?: { secret?: string; note: string } }
    term.apiKey = 'should-not-export'
    term.metadata = { secret: 'also-hidden', note: 'kept' }

    const exported = serializeWorkspace(workspace)

    expect(exported).not.toContain('should-not-export')
    expect(exported).not.toContain('also-hidden')
    expect(exported).toContain('kept')
  })

  it('imports both wrapped exports and raw workspaces through the migration layer', () => {
    const workspace = cloneSeed()
    const wrapped = serializeWorkspace(workspace)

    expect(parseWorkspaceImport(wrapped).projects[0].id).toBe('project-demo')
    expect(parseWorkspaceImport(JSON.stringify(workspace)).schemaVersion).toBe(3)
  })

  it('creates the migration backup store during database upgrade', async () => {
    await saveWorkspace(cloneSeed())
    const request = indexedDB.open(DB_NAME)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect(database.objectStoreNames.contains(BACKUP_STORE_NAME)).toBe(true)
    database.close()
  })
})
