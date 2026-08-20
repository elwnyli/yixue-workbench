import { describe, expect, it } from 'vitest'
import { cloneSeed } from '../data'
import { lookupTerm } from '../services/lookup'

describe('term lookup', () => {
  it('uses an approved personal term before any network request', async () => {
    const workspace = cloneSeed()
    const project = workspace.projects[0]
    const segment = project.files[0].segments[1]
    const result = await lookupTerm('human agency', segment, project, workspace.terms, workspace.settings)
    expect(result.provider).toBe('local')
    expect(result.recommendedTranslations).toContain('人的能动性')
    expect(result.sources[0].title).toContain('UNESCO')
  })

  it('refuses to invent an explanation when neither a local term nor proxy exists', async () => {
    const workspace = cloneSeed()
    const project = workspace.projects[0]
    await expect(lookupTerm('unverified concept', project.files[0].segments[0], project, workspace.terms, workspace.settings)).rejects.toThrow('安全代理')
  })
})
