import { describe, expect, it } from 'vitest'
import { COMPATIBILITY, OILS, OIL_INDEX, RECIPES, STARTER_SHELF } from './index'
import { FAMILY_COLORS, FAMILY_LABELS, MOOD_LABELS } from './labels'
import {
  FAMILIES,
  MOODS,
  OilSchema,
  SafetySchema,
  findDataProblems,
  pairKey,
  type Oil,
} from './schema'

const UNREVIEWED = { review: 'none', source: 'test' } as const

describe('oil library', () => {
  it('passes schema and cross-reference checks', () => {
    expect(findDataProblems(OILS, RECIPES, STARTER_SHELF)).toEqual([])
  })

  it('has about 60 single oils plus the six brand blends', () => {
    const singles = OILS.filter((o) => o.kind === 'single')
    const blends = OILS.filter((o) => o.kind === 'blend')
    expect(singles.length).toBeGreaterThanOrEqual(55)
    expect(singles.length).toBeLessThanOrEqual(70)
    expect(blends.map((b) => b.id).sort()).toEqual([
      'apple-cider',
      'balance',
      'blues-buster',
      'germ-fighter',
      'holiday-season',
      'pumpkin-spice',
    ])
  })

  it('uses every scent family and every mood at least once', () => {
    for (const family of FAMILIES) {
      expect(
        OILS.some((o) => o.kind === 'single' && o.families.includes(family)),
        family,
      ).toBe(true)
    }
    for (const mood of MOODS) {
      expect(OILS.some((o) => o.moods.includes(mood)), mood).toBe(true)
    }
  })

  it('matches the starting values in the plan for the shelf oils', () => {
    const expected: [string, string[], string, number][] = [
      ['peppermint', ['minty'], 'top', 4],
      ['lavender', ['floral', 'herbaceous'], 'middle', 2],
      ['lemon', ['citrus'], 'top', 2],
      ['sweet-orange', ['citrus'], 'top', 2],
      ['pink-grapefruit', ['citrus'], 'top', 2],
      ['bergamot', ['citrus'], 'top', 2],
      ['spearmint', ['minty'], 'top', 3],
      ['eucalyptus-globulus', ['camphoraceous'], 'top', 4],
      ['rosemary-cineole', ['herbaceous', 'camphoraceous'], 'middle', 3],
      ['tea-tree', ['camphoraceous'], 'middle', 4],
      ['clary-sage', ['herbaceous', 'floral'], 'middle', 3],
      ['cinnamon-cassia', ['spicy'], 'middle', 5],
      ['ylang-ylang', ['floral'], 'middle', 4],
      ['frankincense-carteri', ['resinous'], 'base', 2],
      ['patchouli', ['earthy'], 'base', 5],
    ]
    for (const [id, families, note, intensity] of expected) {
      const oil = OIL_INDEX.get(id)!
      expect(oil.families, id).toEqual(families)
      expect(oil.note, id).toBe(note)
      expect(oil.intensity, id).toBe(intensity)
    }
  })

  it('records a source for every safety entry', () => {
    for (const oil of OILS) expect(oil.safety.source.length, oil.id).toBeGreaterThan(0)
  })

  it('ships no numeric safety limit on an unreviewed oil', () => {
    for (const oil of OILS) {
      const { phototoxicMaxPct, dermalMaxPct, kidsMinAge, review, source } = oil.safety
      const hasNumber =
        phototoxicMaxPct !== undefined ||
        dermalMaxPct !== undefined ||
        kidsMinAge !== undefined
      if (hasNumber) {
        expect(review, oil.id).not.toBe('none')
        // A sourced number must point at the page it came from.
        expect(source, oil.id).toMatch(/https?:\/\//)
      }
    }
  })

  it('has every starter shelf oil fully reviewed', () => {
    for (const item of STARTER_SHELF) {
      expect(OIL_INDEX.get(item.oilId)!.safety.review, item.oilId).toBe('full')
    }
  })

  it('carries the limits exactly as the cited sources give them', () => {
    const safety = (id: string) => OIL_INDEX.get(id)!.safety
    // Tisserand Institute phototoxic limits table
    expect(safety('bergamot').phototoxicMaxPct).toBe(0.4)
    expect(safety('lime').phototoxicMaxPct).toBe(0.7)
    expect(safety('lemon').phototoxicMaxPct).toBe(2)
    expect(safety('pink-grapefruit').phototoxicMaxPct).toBe(4)
    expect(safety('mandarin').phototoxicMaxPct).toBe(5)
    // Tisserand Institute allergenic oils topical maximums table
    expect(safety('cinnamon-cassia').dermalMaxPct).toBe(0.05)
    expect(safety('cinnamon-bark').dermalMaxPct).toBe(0.1)
    expect(safety('clove-bud').dermalMaxPct).toBe(0.5)
    expect(safety('cinnamon-leaf').dermalMaxPct).toBe(0.6)
    expect(safety('jasmine-absolute').dermalMaxPct).toBe(0.7)
    expect(safety('lemongrass').dermalMaxPct).toBe(0.7)
    expect(safety('may-chang').dermalMaxPct).toBe(0.8)
    expect(safety('ylang-ylang').dermalMaxPct).toBe(0.8)
    // Plant Therapy product pages
    expect(safety('peppermint').dermalMaxPct).toBe(5)
    expect(safety('spearmint').dermalMaxPct).toBe(1.7)
    expect(safety('rosemary-cineole').dermalMaxPct).toBe(4)
    expect(safety('holiday-season').dermalMaxPct).toBe(2)
    expect(safety('germ-fighter').dermalMaxPct).toBe(2)
    expect(safety('apple-cider').dermalMaxPct).toBe(1)
    for (const id of ['peppermint', 'eucalyptus-globulus', 'rosemary-cineole', 'germ-fighter']) {
      expect(safety(id).kidsMinAge, id).toBe(10)
    }
  })

  it('lists the brand blend ingredients from the brand pages', () => {
    const components = (id: string) => OIL_INDEX.get(id)!.components
    expect(components('germ-fighter')).toHaveLength(5)
    expect(components('blues-buster')).toEqual(['tangerine', 'pink-grapefruit', 'geranium'])
    expect(components('holiday-season')).toHaveLength(7)
    expect(components('balance')).toHaveLength(9)
    expect(components('pumpkin-spice')).toHaveLength(9)
    expect(components('apple-cider')).toHaveLength(10)
  })

  it('carries the flags from the plan safety table', () => {
    const safety = (id: string) => OIL_INDEX.get(id)!.safety
    for (const id of ['bergamot', 'lemon', 'pink-grapefruit']) {
      expect(safety(id).phototoxic, id).toBe(true)
    }
    expect(safety('cinnamon-cassia').diffuseOnly).toBe(true)
    for (const id of ['peppermint', 'eucalyptus-globulus', 'rosemary-cineole']) {
      expect(safety(id).kidsCaution, id).toBe(true)
    }
    expect(safety('clary-sage').pregnancyCaution).toBe(true)
    for (const id of ['tea-tree', 'lemon', 'sweet-orange', 'peppermint', 'spearmint']) {
      expect(safety(id).catCaution, id).toBe(true)
    }
    for (const id of ['tea-tree', 'lemon', 'sweet-orange', 'bergamot']) {
      expect(safety(id).oxidizesFast, id).toBe(true)
    }
  })
})

describe('schema guards', () => {
  it('rejects a numeric safety limit on an oil with review "none"', () => {
    expect(SafetySchema.safeParse({ ...UNREVIEWED, dermalMaxPct: 1 }).success).toBe(false)
    expect(SafetySchema.safeParse({ ...UNREVIEWED, phototoxicMaxPct: 1 }).success).toBe(false)
    expect(SafetySchema.safeParse({ ...UNREVIEWED, kidsMinAge: 6 }).success).toBe(false)
    expect(
      SafetySchema.safeParse({ review: 'partial', source: 'A cited reference', dermalMaxPct: 1 })
        .success,
    ).toBe(true)
    expect(
      SafetySchema.safeParse({ review: 'full', source: 'A cited reference', kidsMinAge: 10 })
        .success,
    ).toBe(true)
    expect(SafetySchema.safeParse({ review: 'checked', source: 'x' }).success).toBe(false)
  })

  it('rejects unknown fields, families and moods', () => {
    const base = {
      id: 'test-oil',
      name: 'Test',
      kind: 'single',
      families: ['citrus'],
      note: 'top',
      intensity: 2,
      moods: ['calm'],
      affinities: [],
      safety: UNREVIEWED,
    }
    expect(OilSchema.safeParse(base).success).toBe(true)
    expect(OilSchema.safeParse({ ...base, families: ['fruity'] }).success).toBe(false)
    expect(OilSchema.safeParse({ ...base, families: [] }).success).toBe(false)
    expect(OilSchema.safeParse({ ...base, moods: ['sleepy'] }).success).toBe(false)
    expect(OilSchema.safeParse({ ...base, intensity: 6 }).success).toBe(false)
    expect(OilSchema.safeParse({ ...base, id: 'Test Oil' }).success).toBe(false)
    expect(OilSchema.safeParse({ ...base, typo: true }).success).toBe(false)
    expect(
      OilSchema.safeParse({ ...base, safety: { ...UNREVIEWED, safeForKids: true } }).success,
    ).toBe(false)
  })

  it('finds broken references', () => {
    const lemon = OILS.find((o) => o.id === 'lemon')!
    const broken: Oil = { ...lemon, id: 'broken', affinities: ['nope', 'broken'] }
    const blend: Oil = {
      id: 'bad-blend',
      name: 'Bad blend',
      kind: 'blend',
      moods: [],
      affinities: [],
      components: ['nope', 'holiday-season'],
      safety: UNREVIEWED,
    }
    const problems = findDataProblems(
      [...OILS, broken, blend, lemon],
      [{ id: 'r', name: 'R', goal: 'calm', method: 'diffuser', items: [{ oilId: 'gone', parts: 1 }] }],
      [{ oilId: 'missing', sizeMl: 10, count: 1 }],
    )
    expect(problems).toEqual(
      expect.arrayContaining([
        'Duplicate oil id "lemon".',
        'broken has unknown affinity "nope".',
        'broken lists itself as an affinity.',
        'bad-blend has unknown component "nope".',
        'bad-blend component "holiday-season" must be a single oil.',
        'Recipe r uses unknown oil "gone".',
        'Starter shelf has unknown oil "missing".',
      ]),
    )
  })
})

describe('compatibility', () => {
  it('scores every pair of different families exactly once', () => {
    const keys = new Set(COMPATIBILITY.pairs.map((p) => pairKey(p.a, p.b)))
    expect(keys.size).toBe(COMPATIBILITY.pairs.length)
    for (const a of FAMILIES) {
      for (const b of FAMILIES) {
        if (a !== b) expect(keys.has(pairKey(a, b)), `${a} + ${b}`).toBe(true)
      }
    }
    expect(COMPATIBILITY.pairs).toHaveLength((FAMILIES.length * (FAMILIES.length - 1)) / 2)
  })

  it('includes every pairing listed in the plan as a classic', () => {
    const plan: Record<string, string[]> = {
      citrus: ['floral', 'herbaceous', 'minty', 'spicy', 'woody', 'resinous', 'earthy'],
      floral: ['citrus', 'woody', 'resinous', 'spicy', 'earthy'],
      herbaceous: ['citrus', 'minty', 'camphoraceous', 'woody'],
      minty: ['citrus', 'herbaceous', 'camphoraceous'],
      resinous: ['citrus', 'woody', 'spicy', 'floral'],
      earthy: ['citrus', 'floral', 'woody'],
    }
    for (const [a, partners] of Object.entries(plan)) {
      for (const b of partners) {
        const pair = COMPATIBILITY.pairs.find(
          (p) => (p.a === a && p.b === b) || (p.a === b && p.b === a),
        )
        expect(pair, `${a} + ${b}`).toBeDefined()
        expect(pair!.score, `${a} + ${b}`).toBe(1)
        expect(pair!.source, `${a} + ${b}`).toBe('plan')
      }
    }
  })
})

describe('starter recipes', () => {
  it('has the nine diffuser blends from the plan', () => {
    expect(RECIPES.map((r) => r.name)).toEqual([
      'Bright morning',
      'Focus',
      'Wind down',
      'Grounding',
      'Spa day',
      'Clean house',
      'Stuffy head',
      'Cozy fall',
      'Mood lift',
    ])
    for (const recipe of RECIPES) expect(recipe.method).toBe('diffuser')
  })

  it('can all be made from the starter shelf', () => {
    const owned = new Set(STARTER_SHELF.map((item) => item.oilId))
    for (const recipe of RECIPES) {
      for (const item of recipe.items) {
        expect(owned.has(item.oilId), `${recipe.name}: ${item.oilId}`).toBe(true)
      }
    }
  })
})

describe('starter shelf', () => {
  it('has the 21 oils and 26 bottles from the photo', () => {
    expect(STARTER_SHELF).toHaveLength(21)
    expect(STARTER_SHELF.reduce((sum, item) => sum + item.count, 0)).toBe(26)
    expect(new Set(STARTER_SHELF.map((item) => item.oilId)).size).toBe(21)
  })

  it('counts match the plan', () => {
    const count = (id: string) => STARTER_SHELF.find((item) => item.oilId === id)?.count
    expect(count('peppermint')).toBe(3)
    expect(count('lavender')).toBe(2)
    expect(count('lemon')).toBe(2)
    expect(count('holiday-season')).toBe(2)
    expect(count('ylang-ylang')).toBe(1)
  })
})

describe('labels', () => {
  it('cover every family and mood', () => {
    for (const family of FAMILIES) {
      expect(FAMILY_LABELS[family]).toBeTruthy()
      expect(FAMILY_COLORS[family]).toMatch(/^#[0-9A-F]{6}$/i)
    }
    for (const mood of MOODS) expect(MOOD_LABELS[mood]).toBeTruthy()
  })
})
