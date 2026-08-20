import { describe, expect, it } from 'vitest'
import { cloneSeed } from '../data'
import { CURRENT_SCHEMA_VERSION, migrateWorkspace, needsWorkspaceMigration } from '../migrations'

const legacyWorkspace = () => {
  const current = cloneSeed() as unknown as Record<string, unknown>
  delete current.schemaVersion
  delete current.sources
  delete current.practices
  delete current.personalReferences
  delete current.skillExecutionLogs
  delete current.aiRequestLogs
  delete current.batchJobs

  const settings = current.settings as Record<string, unknown>
  delete settings.requestTimeoutMs
  delete settings.retryCount
  delete settings.contentProxyEndpoint

  const project = (current.projects as Array<Record<string, unknown>>)[0]
  delete project.mode
  delete project.termLookup
  delete project.culturalRecognition
  delete project.batchSize
  delete project.activeBatchJobId

  const file = (project.files as Array<Record<string, unknown>>)[0]
  const segment = (file.segments as Array<Record<string, unknown>>)[0]
  delete segment.studentDraft
  delete segment.aiPretranslation
  delete segment.aiFeedback
  delete segment.termLookups
  delete segment.culturalNotes
  delete segment.aiState
  delete segment.lastModifiedAt
  delete segment.lastAIRequestAt
  return current
}

describe('workspace migrations', () => {
  it('migrates the original V2 workspace without losing project or segment ids', () => {
    const legacy = legacyWorkspace()
    expect(needsWorkspaceMigration(legacy)).toBe(true)

    const migrated = migrateWorkspace(legacy)

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(migrated.projects[0].id).toBe('project-demo')
    expect(migrated.projects[0].files[0].segments[0].id).toBe('seg-demo-1')
    expect(migrated.projects[0].files[0].segments[0].studentDraft).toContain('人的监督')
    expect(migrated.projects[0].files[0].segments[0].aiState.status).toBe('idle')
    expect(migrated.projects[0].mode).toBe('student-first')
    expect(migrated.sources.length).toBeGreaterThan(0)
  })

  it('adds content fields to legacy news metadata without inventing article text', () => {
    const migrated = migrateWorkspace(legacyWorkspace())
    const item = migrated.news[0]

    expect(item.title).toContain('人工智能伦理')
    expect(item.copyrightStatus).toBe('metadata-only')
    expect(item.paragraphs).toEqual([])
    expect(item.read).toBe(false)
  })

  it('rejects data that is not a V2 workspace', () => {
    expect(() => migrateWorkspace({ version: 1 })).toThrow('不是可识别的译学工作台 V2 数据')
  })
})
