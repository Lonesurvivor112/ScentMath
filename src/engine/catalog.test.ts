import { describe, expect, it } from 'vitest'
import { OILS, OIL_INDEX } from '../data'
import { OilSchema } from '../data/schema'
import {
  POPULAR_OIL_IDS,
  buildCustomOil,
  ingredientNames,
  ingredientsLine,
  makeCustomOilId,
  normalizeText,
  searchOils,
  slugify,
} from './catalog'
import { buildOilIndex } from './resolve'

const all = [...OIL_INDEX.values()]
const ids = (query: string, limit?: number) =>
  searchOils(query, all, limit).map((oil) => oil.id)

describe('normalizeText', () => {
  it('lowercases and strips punctuation and accents', () => {
    expect(normalizeText('  Rosemary 1,8-Cineole ')).toBe('rosemary 1 8 cineole')
    expect(normalizeText('Café Crème')).toBe('cafe creme')
  })
})

describe('searchOils', () => {
  it('puts names that start with the search first', () => {
    expect(ids('lav').slice(0, 2)).toEqual(['lavandin', 'lavender'])
    expect(ids('lemon').slice(0, 2)).toEqual(['lemon', 'lemongrass'])
  })

  it('matches a word inside the name', () => {
    expect(ids('orange')).toEqual(['blood-orange', 'sweet-orange'])
    expect(ids('cineole')).toContain('rosemary-cineole')
  })

  it('needs every word typed to match, in any order', () => {
    expect(ids('orange sweet')).toEqual(['sweet-orange'])
    expect(ids('eucalyptus glob')).toEqual(['eucalyptus-globulus'])
    expect(ids('lavender banana')).toEqual([])
  })

  it('searches Latin names and brands too', () => {
    expect(ids('mentha')).toEqual(['peppermint', 'spearmint'])
    expect(ids('plant therapy')).toContain('germ-fighter')
  })

  it('ignores case and punctuation', () => {
    expect(ids('TEA-TREE')).toEqual(['tea-tree'])
    expect(ids('  ylang  ')).toEqual(['ylang-ylang'])
  })

  it('returns every oil in name order for an empty search', () => {
    const everything = searchOils('', all, 1000)
    expect(everything).toHaveLength(all.length)
    const names = everything.map((oil) => oil.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('respects the limit', () => {
    expect(searchOils('', all, 5)).toHaveLength(5)
    expect(searchOils('a', all, 0)).toEqual([])
  })
})

describe('blend ingredients', () => {
  const get = (id: string) => OIL_INDEX.get(id)!

  it('lists what a brand blend is made of, in label order', () => {
    expect(ingredientNames(get('blues-buster'), OIL_INDEX)).toEqual(['Tangerine', 'Pink Grapefruit', 'Geranium'])
    expect(ingredientsLine(get('blues-buster'), OIL_INDEX)).toBe('Tangerine, Pink Grapefruit, Geranium')
    expect(ingredientsLine(get('germ-fighter'), OIL_INDEX)).toBe(
      'Cinnamon Cassia, Lemon, Eucalyptus Globulus, Clove Bud, Rosemary 1,8-Cineole',
    )
  })

  it('cuts a long list short when asked', () => {
    expect(ingredientsLine(get('balance'), OIL_INDEX, 4)).toBe('Palmarosa, Lavender, Petitgrain, Clary Sage +5 more')
    expect(ingredientsLine(get('blues-buster'), OIL_INDEX, 4)).toBe('Tangerine, Pink Grapefruit, Geranium')
    expect(ingredientNames(get('balance'), OIL_INDEX)).toHaveLength(9)
  })

  it('has nothing to list for a single oil', () => {
    expect(ingredientNames(get('lavender'), OIL_INDEX)).toEqual([])
    expect(ingredientsLine(get('lavender'), OIL_INDEX)).toBeNull()
  })

  it('has ingredients for every brand blend in the library', () => {
    for (const oil of OIL_INDEX.values()) {
      if (oil.kind === 'blend') expect(ingredientsLine(oil, OIL_INDEX), oil.id).not.toBeNull()
    }
  })
})

describe('popular oils', () => {
  it('are all in the library', () => {
    for (const id of POPULAR_OIL_IDS) expect(OIL_INDEX.has(id), id).toBe(true)
  })
})

describe('custom oil ids', () => {
  it('slugifies names', () => {
    expect(slugify("Nick's Night Blend!")).toBe('nick-s-night-blend')
    expect(slugify('***')).toBe('oil')
  })

  it('never clashes with an existing id', () => {
    expect(makeCustomOilId('Lavender', [])).toBe('custom-lavender')
    expect(makeCustomOilId('Lavender', ['custom-lavender'])).toBe('custom-lavender-2')
    expect(makeCustomOilId('Lavender', ['custom-lavender', 'custom-lavender-2'])).toBe(
      'custom-lavender-3',
    )
  })
})

describe('buildCustomOil', () => {
  const existing = OILS.map((oil) => oil.id)

  it('builds a single oil that passes the schema', () => {
    const result = buildCustomOil(
      { name: '  Blue  Tansy ', kind: 'single', families: ['sweet', 'herbaceous'], note: 'middle', intensity: 4, moods: ['calm'] },
      existing,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.oil.name).toBe('Blue Tansy')
    expect(result.oil.id).toBe('custom-blue-tansy')
    expect(OilSchema.safeParse(result.oil).success).toBe(true)
  })

  it('never marks a custom oil as reviewed', () => {
    const result = buildCustomOil({ name: 'Test', kind: 'single', families: ['woody'] }, existing)
    expect(result.ok && result.oil.safety.review).toBe('none')
  })

  it('fills in a middle note and medium strength when left blank', () => {
    const result = buildCustomOil({ name: 'Test', kind: 'single', families: ['woody'] }, existing)
    expect(result.ok && result.oil.kind === 'single' && result.oil.note).toBe('middle')
    expect(result.ok && result.oil.kind === 'single' && result.oil.intensity).toBe(3)
  })

  it('builds a blend whose families come from its components', () => {
    const result = buildCustomOil(
      { name: 'Sleepy Time', kind: 'blend', brand: ' Acme ', components: ['lavender', 'roman-chamomile', 'lavender'] },
      existing,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(OilSchema.safeParse(result.oil).success).toBe(true)
    expect(result.oil.kind === 'blend' && result.oil.components).toEqual(['lavender', 'roman-chamomile'])
    expect(result.oil.kind === 'blend' && result.oil.brand).toBe('Acme')
    const resolved = buildOilIndex([...OILS, result.oil]).get(result.oil.id)!
    expect(resolved.families).toEqual(['floral', 'herbaceous'])
    expect(resolved.incomplete).toBe(false)
  })

  it('accepts a blend with a family but no components', () => {
    const result = buildCustomOil({ name: 'Mystery', kind: 'blend', families: ['spicy'] }, existing)
    expect(result.ok).toBe(true)
    if (result.ok) expect(OilSchema.safeParse(result.oil).success).toBe(true)
  })

  it('explains what is missing', () => {
    expect(buildCustomOil({ name: '  ', kind: 'single', families: ['woody'] }, existing)).toEqual({
      ok: false,
      error: 'Give the oil a name.',
    })
    expect(buildCustomOil({ name: 'X', kind: 'single' }, existing).ok).toBe(false)
    expect(buildCustomOil({ name: 'X', kind: 'blend' }, existing).ok).toBe(false)
    expect(
      buildCustomOil({ name: 'X', kind: 'single', families: ['woody', 'sweet', 'spicy'] }, existing).ok,
    ).toBe(false)
  })
})
