import { describe, expect, it } from 'vitest'
import { OILS, OIL_INDEX } from '../data'
import type { BrandBlend, Oil, SingleOil } from '../data/schema'
import {
  buildOilIndex,
  deriveFamilies,
  deriveIntensity,
  deriveNote,
  resolveOil,
} from './resolve'
import { oil } from './testing'

const rawById = new Map(OILS.map((o) => [o.id, o] as const))

function single(id: string): SingleOil {
  const found = rawById.get(id)
  if (found?.kind !== 'single') throw new Error(`${id} is not a single oil`)
  return found
}

describe('single oils', () => {
  it('pass straight through', () => {
    const lavender = oil('lavender')
    expect(lavender.kind).toBe('single')
    expect(lavender.families).toEqual(['floral', 'herbaceous'])
    expect(lavender.note).toBe('middle')
    expect(lavender.intensity).toBe(2)
    expect(lavender.components).toEqual([])
    expect(lavender.incomplete).toBe(false)
  })
})

describe('deriveFamilies', () => {
  it('picks the families with the most votes', () => {
    // Germ Fighter: spicy 2 (clove, cassia), camphoraceous 1.5, citrus 1, herbaceous 0.5
    const components = [
      'lemon',
      'clove-bud',
      'eucalyptus-globulus',
      'cinnamon-cassia',
      'rosemary-cineole',
    ].map(single)
    expect(deriveFamilies(components)).toEqual(['spicy', 'camphoraceous'])
  })

  it('drops a second family with less than half the votes of the first', () => {
    // Balance is overwhelmingly floral.
    const balance = rawById.get('balance') as BrandBlend
    expect(deriveFamilies(balance.components.map(single))).toEqual(['floral'])
  })

  it('returns nothing for no components', () => {
    expect(deriveFamilies([])).toEqual([])
  })
})

describe('deriveNote and deriveIntensity', () => {
  it('uses the most common note', () => {
    expect(deriveNote(['tangerine', 'geranium', 'pink-grapefruit'].map(single))).toBe('top')
    expect(deriveNote(['lavender', 'geranium', 'lemon'].map(single))).toBe('middle')
  })

  it('breaks note ties toward middle', () => {
    expect(deriveNote(['lemon', 'lavender'].map(single))).toBe('middle')
    expect(deriveNote(['lemon', 'patchouli'].map(single))).toBe('top')
    expect(deriveNote([])).toBe('middle')
  })

  it('rounds the average intensity', () => {
    // Lemon 2, clove 5, eucalyptus 4, cassia 5, rosemary 3 -> 3.8 -> 4
    const components = [
      'lemon',
      'clove-bud',
      'eucalyptus-globulus',
      'cinnamon-cassia',
      'rosemary-cineole',
    ].map(single)
    expect(deriveIntensity(components)).toBe(4)
    expect(deriveIntensity([])).toBe(3)
  })
})

describe('brand blends', () => {
  it('get families, note and intensity from their components', () => {
    const germFighter = oil('germ-fighter')
    expect(germFighter.kind).toBe('blend')
    expect(germFighter.families).toEqual(['spicy', 'camphoraceous'])
    expect(germFighter.note).toBe('middle')
    expect(germFighter.intensity).toBe(4)
    expect(germFighter.components).toHaveLength(5)

    expect(oil('blues-buster').families).toEqual(['citrus', 'floral'])
    expect(oil('blues-buster').note).toBe('top')
  })

  it('all resolve to at least one family in the shipped library', () => {
    for (const resolved of OIL_INDEX.values()) {
      expect(resolved.families.length, resolved.id).toBeGreaterThanOrEqual(1)
      expect(resolved.incomplete, resolved.id).toBe(false)
    }
  })

  it('keep values that are set on the blend itself', () => {
    const custom: Oil = {
      id: 'custom-blend',
      name: 'Custom',
      kind: 'blend',
      moods: [],
      affinities: [],
      components: ['lemon', 'lavender'],
      families: ['woody'],
      note: 'base',
      intensity: 1,
      safety: { review: 'none', source: 'test' },
    }
    const resolved = resolveOil(custom, rawById)
    expect(resolved.families).toEqual(['woody'])
    expect(resolved.note).toBe('base')
    expect(resolved.intensity).toBe(1)
  })

  it('are marked incomplete when there is nothing to derive from', () => {
    const empty: Oil = {
      id: 'mystery-blend',
      name: 'Mystery',
      kind: 'blend',
      moods: [],
      affinities: [],
      components: [],
      safety: { review: 'none', source: 'test' },
    }
    const index = buildOilIndex([...OILS, empty])
    const resolved = index.get('mystery-blend')!
    expect(resolved.incomplete).toBe(true)
    expect(resolved.families).toEqual([])
    expect(resolved.note).toBe('middle')
    expect(resolved.intensity).toBe(3)
  })

  it('ignore component ids that are missing from the library', () => {
    const partial: Oil = {
      id: 'partial-blend',
      name: 'Partial',
      kind: 'blend',
      moods: [],
      affinities: [],
      components: ['lemon', 'not-in-library'],
      safety: { review: 'none', source: 'test' },
    }
    const resolved = resolveOil(partial, rawById)
    expect(resolved.components).toEqual(['lemon'])
    expect(resolved.families).toEqual(['citrus'])
  })
})
