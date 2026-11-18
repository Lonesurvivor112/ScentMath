import { describe, expect, it } from 'vitest'
import { COMPATIBILITY, OIL_INDEX, RECIPES } from '../data'
import { FAMILIES } from '../data/schema'
import {
  MAX_NOTE_DISTANCE,
  NOTE_TARGET,
  averagePairCompat,
  harmonyScore,
  intensityBalance,
  makeCompat,
  noteBalance,
  noteDistance,
  noteShares,
  oilPairCompat,
  scentLean,
  scentProfile,
  type BlendMember,
} from './harmony'
import { compat, oil } from './testing'

const members = (items: [string, number][]): BlendMember[] =>
  items.map(([id, parts]) => ({ oil: oil(id), parts }))

describe('makeCompat', () => {
  it('scores the pairs from the plan as classic', () => {
    expect(compat('citrus', 'floral')).toBe(1)
    expect(compat('resinous', 'citrus')).toBe(1)
    expect(compat('minty', 'camphoraceous')).toBe(1)
    expect(compat('earthy', 'woody')).toBe(1)
  })

  it('is symmetric', () => {
    for (const a of FAMILIES) {
      for (const b of FAMILIES) expect(compat(a, b)).toBe(compat(b, a))
    }
  })

  it('uses sameFamily for an oil paired with its own family', () => {
    expect(compat('citrus', 'citrus')).toBe(COMPATIBILITY.sameFamily)
  })

  it('treats unlisted pairs as risky', () => {
    const sparse = makeCompat({
      sameFamily: 1,
      pairs: [{ a: 'citrus', b: 'floral', score: 1, source: 'plan' }],
    })
    expect(sparse('citrus', 'floral')).toBe(1)
    expect(sparse('minty', 'earthy')).toBe(0)
  })
})

describe('oilPairCompat', () => {
  it('judges a two-family oil by its best-matching side', () => {
    // Lavender is floral + herbaceous. Peppermint is minty.
    expect(compat('floral', 'minty')).toBe(0)
    expect(compat('herbaceous', 'minty')).toBe(1)
    expect(oilPairCompat(oil('lavender'), oil('peppermint'), compat)).toBe(1)
  })

  it('returns 0 when an oil has no families', () => {
    expect(oilPairCompat({ families: [] }, oil('lemon'), compat)).toBe(0)
  })
})

describe('note mix', () => {
  it('targets about 30% top, 50% middle and 20% base', () => {
    expect(NOTE_TARGET).toEqual({ top: 0.3, middle: 0.5, base: 0.2 })
    expect(NOTE_TARGET.top + NOTE_TARGET.middle + NOTE_TARGET.base).toBeCloseTo(1)
  })

  it('works out the share of parts in each note', () => {
    const shares = noteShares([
      { note: 'top', parts: 3 },
      { note: 'middle', parts: 5 },
      { note: 'base', parts: 2 },
    ])
    expect(shares).toEqual({ top: 0.3, middle: 0.5, base: 0.2 })
    expect(noteDistance(shares)).toBeCloseTo(0)
  })

  it('gives all zeros for an empty blend', () => {
    expect(noteShares([])).toEqual({ top: 0, middle: 0, base: 0 })
  })

  it('is furthest from the target when everything is a base note', () => {
    const allBase = noteShares([{ note: 'base', parts: 4 }])
    expect(noteDistance(allBase)).toBeCloseTo(MAX_NOTE_DISTANCE)
    expect(MAX_NOTE_DISTANCE).toBeCloseTo(0.8)
  })

  it('scores balance from 0 to 1', () => {
    expect(
      noteBalance([
        { note: 'top', parts: 3 },
        { note: 'middle', parts: 5 },
        { note: 'base', parts: 2 },
      ]),
    ).toBeCloseTo(1)
    expect(noteBalance([{ note: 'base', parts: 1 }])).toBeCloseTo(0)
    expect(noteBalance([])).toBe(0)
    const allTop = noteBalance([{ note: 'top', parts: 1 }])
    const topAndMiddle = noteBalance([
      { note: 'top', parts: 1 },
      { note: 'middle', parts: 1 },
    ])
    expect(topAndMiddle).toBeGreaterThan(allTop)
  })
})

describe('intensityBalance', () => {
  it('is 1 when every oil pulls equally', () => {
    expect(
      intensityBalance([
        { intensity: 2, parts: 2 },
        { intensity: 4, parts: 1 },
      ]),
    ).toBeCloseTo(1)
  })

  it('drops as one oil dominates', () => {
    const even = intensityBalance([
      { intensity: 2, parts: 1 },
      { intensity: 2, parts: 1 },
    ])
    const lopsided = intensityBalance([
      { intensity: 5, parts: 3 },
      { intensity: 1, parts: 1 },
    ])
    expect(lopsided).toBeLessThan(even)
    expect(lopsided).toBeGreaterThanOrEqual(0)
  })

  it('is 1 for fewer than two oils', () => {
    expect(intensityBalance([])).toBe(1)
    expect(intensityBalance([{ intensity: 5, parts: 3 }])).toBe(1)
  })
})

describe('averagePairCompat', () => {
  it('averages every pair in the blend', () => {
    // citrus-minty 1, citrus-earthy 1, minty-earthy 0
    const oils = [oil('lemon'), oil('peppermint'), oil('patchouli')]
    expect(averagePairCompat(oils, compat)).toBeCloseTo(2 / 3)
  })

  it('is 0 with fewer than two oils', () => {
    expect(averagePairCompat([oil('lemon')], compat)).toBe(0)
  })
})

describe('harmonyScore', () => {
  it('returns null for fewer than two oils', () => {
    expect(harmonyScore([], compat)).toBeNull()
    expect(harmonyScore(members([['lavender', 2]]), compat)).toBeNull()
    expect(
      harmonyScore(
        members([
          ['lavender', 2],
          ['lemon', 0],
        ]),
        compat,
      ),
    ).toBeNull()
  })

  it('weights family x 60, note balance x 25 and intensity balance x 15', () => {
    const blend = members([
      ['lavender', 3],
      ['bergamot', 2],
      ['clary-sage', 1],
    ])
    const result = harmonyScore(blend, compat)!
    expect(result.score).toBe(
      Math.round(
        result.familyCompat * 60 + result.noteBalance * 25 + result.intensityBalance * 15,
      ),
    )
    expect(result.familyCompat).toBe(1)
  })

  it('stays between 0 and 100 for every starter recipe', () => {
    for (const recipe of RECIPES) {
      const blend = recipe.items.map((item) => ({
        oil: OIL_INDEX.get(item.oilId)!,
        parts: item.parts,
      }))
      const result = harmonyScore(blend, compat)!
      expect(result.score, recipe.name).toBeGreaterThanOrEqual(0)
      expect(result.score, recipe.name).toBeLessThanOrEqual(100)
      expect(Number.isInteger(result.score)).toBe(true)
    }
  })

  it('scores a classic blend above a clashing one', () => {
    const classic = harmonyScore(
      members([
        ['sweet-orange', 3],
        ['frankincense-carteri', 2],
        ['patchouli', 1],
      ]),
      compat,
    )!
    const clashing = harmonyScore(
      members([
        ['peppermint', 3],
        ['patchouli', 3],
        ['ylang-ylang', 3],
      ]),
      compat,
    )!
    expect(classic.score).toBeGreaterThan(clashing.score)
    expect(classic.score).toBeGreaterThanOrEqual(65)
  })
})

describe('scentProfile', () => {
  const shares = (items: [string, number][]) =>
    Object.fromEntries(scentProfile(members(items)).map((s) => [s.family, Number(s.share.toFixed(4))]))

  it('is empty for an empty blend or one with no drops', () => {
    expect(scentProfile([])).toEqual([])
    expect(scentProfile(members([['lavender', 0]]))).toEqual([])
  })

  it('gives a single-family oil the whole blend', () => {
    expect(scentProfile(members([['sweet-orange', 3]]))).toEqual([{ family: 'citrus', share: 1 }])
  })

  it("gives an oil's main family a double share", () => {
    // Lavender is floral then herbaceous: two thirds and one third.
    expect(shares([['lavender', 2]])).toEqual({ floral: 0.6667, herbaceous: 0.3333 })
  })

  it('weights drops by intensity, so strong oils count more', () => {
    // 1 drop of Peppermint (intensity 4) matches 2 drops of Sweet Orange (intensity 2).
    expect(shares([['peppermint', 1], ['sweet-orange', 2]])).toEqual({ citrus: 0.5, minty: 0.5 })
  })

  it('sorts strongest first, ties in family order, and sums to 1', () => {
    const profile = scentProfile(members([['sweet-orange', 3], ['lavender', 2]]))
    expect(profile.map((s) => s.family)).toEqual(['citrus', 'floral', 'herbaceous'])
    expect(profile[0].share).toBeCloseTo(0.6)
    expect(profile.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1)
    expect(scentProfile(members([['peppermint', 1], ['sweet-orange', 2]]))[0].family).toBe('citrus')
  })
})

describe('scentLean', () => {
  it('is null for an empty profile', () => {
    expect(scentLean([])).toBeNull()
  })

  it('says "mostly" when one family has 60% or more', () => {
    expect(scentLean(scentProfile(members([['sweet-orange', 3], ['lavender', 2]])))).toEqual({ kind: 'mostly', first: 'citrus' })
    expect(scentLean([{ family: 'woody', share: 1 }])).toEqual({ kind: 'mostly', first: 'woody' })
  })

  it('says "even" when the top two are close and both sizeable', () => {
    expect(scentLean(scentProfile(members([['peppermint', 1], ['sweet-orange', 2]])))).toEqual({
      kind: 'even',
      first: 'citrus',
      second: 'minty',
    })
  })

  it('otherwise leans toward the first, naming a second side when it is big enough', () => {
    // Cedarwood Atlas 6, Sweet Orange 4, Lavender 2 (floral 4/3, herbaceous 2/3) of 12.
    expect(scentLean(scentProfile(members([['sweet-orange', 2], ['lavender', 1], ['cedarwood-atlas', 2]])))).toEqual({
      kind: 'leans',
      first: 'woody',
      second: 'citrus',
    })
    expect(
      scentLean([
        { family: 'spicy', share: 0.55 },
        { family: 'citrus', share: 0.14 },
        { family: 'woody', share: 0.11 },
        { family: 'sweet', share: 0.1 },
        { family: 'resinous', share: 0.1 },
      ]),
    ).toEqual({ kind: 'leans', first: 'spicy' })
  })
})