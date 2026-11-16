import { describe, expect, it } from 'vitest'
import { OIL_INDEX } from '../data'
import {
  TOO_MANY_OILS_MESSAGE,
  calculateDrops,
  defaultParts,
  diffuserDefaultDrops,
  distributeDrops,
  isSkinMethod,
  skinPct,
  topicalTotalDrops,
} from './calculator'
import { oil, withSafety } from './testing'

describe('topicalTotalDrops', () => {
  it('gives 4 drops for a 10 ml roller at 2%', () => {
    expect(topicalTotalDrops(10, 20, 2)).toBe(4)
  })

  it('follows carrier ml x drops per ml x dilution', () => {
    expect(topicalTotalDrops(10, 20, 1)).toBe(2)
    expect(topicalTotalDrops(10, 20, 3)).toBe(6)
    expect(topicalTotalDrops(30, 20, 2)).toBe(12)
    expect(topicalTotalDrops(10, 25, 2)).toBe(5)
  })

  it('rounds down so the blend never goes over the chosen dilution', () => {
    expect(topicalTotalDrops(5, 20, 2.5)).toBe(2)
    for (const ml of [5, 10, 15, 30, 60, 100]) {
      for (const dropsPerMl of [18, 20, 25, 30]) {
        for (const pct of [0.5, 1, 1.5, 2, 2.5, 3]) {
          const drops = topicalTotalDrops(ml, dropsPerMl, pct)
          expect(Number.isInteger(drops)).toBe(true)
          expect(drops).toBeLessThanOrEqual((ml * dropsPerMl * pct) / 100 + 1e-6)
        }
      }
    }
  })

  it('gives 0 for missing or invalid inputs', () => {
    expect(topicalTotalDrops(0, 20, 2)).toBe(0)
    expect(topicalTotalDrops(10, 0, 2)).toBe(0)
    expect(topicalTotalDrops(10, 20, 0)).toBe(0)
    expect(topicalTotalDrops(Number.NaN, 20, 2)).toBe(0)
  })
})

describe('diffuserDefaultDrops', () => {
  it('matches the plan table', () => {
    expect(diffuserDefaultDrops(100)).toBe(4)
    expect(diffuserDefaultDrops(200)).toBe(6)
    expect(diffuserDefaultDrops(300)).toBe(8)
    expect(diffuserDefaultDrops(500)).toBe(8)
  })

  it('uses the smaller default between table rows', () => {
    expect(diffuserDefaultDrops(150)).toBe(4)
    expect(diffuserDefaultDrops(250)).toBe(6)
  })
})

describe('defaultParts', () => {
  it('starts from top 3, middle 2, base 1', () => {
    expect(defaultParts(oil('lemon'))).toBe(3)
    expect(defaultParts(oil('lavender'))).toBe(2)
    expect(defaultParts(oil('frankincense-carteri'))).toBe(1)
  })

  it('caps intensity-4 oils at 2 parts', () => {
    expect(oil('peppermint').intensity).toBe(4)
    expect(defaultParts(oil('peppermint'))).toBe(2)
    expect(defaultParts(oil('ylang-ylang'))).toBe(2)
  })

  it('caps intensity-5 oils at 1 part', () => {
    expect(defaultParts(oil('cinnamon-cassia'))).toBe(1)
    expect(defaultParts(oil('patchouli'))).toBe(1)
    expect(defaultParts({ note: 'top', intensity: 5 })).toBe(1)
  })
})

describe('distributeDrops', () => {
  it('splits by parts', () => {
    expect(distributeDrops([3, 2, 1], 6)).toEqual([3, 2, 1])
    expect(distributeDrops([3, 2, 1], 12)).toEqual([6, 4, 2])
    expect(distributeDrops([1, 1], 4)).toEqual([2, 2])
  })

  it('uses the largest remainder for leftover drops', () => {
    expect(distributeDrops([3, 2, 1], 4)).toEqual([2, 1, 1])
    expect(distributeDrops([3, 2, 1], 8)).toEqual([4, 3, 1])
  })

  it('always adds up to the total and gives every oil at least 1 drop', () => {
    const partSets = [
      [1],
      [3, 2],
      [3, 2, 1],
      [5, 1, 1],
      [1, 1, 1, 1],
      [3, 3, 2, 2, 1],
      [10, 1, 1, 1],
      [2.5, 1.5, 1],
      [7, 3, 2, 1, 1, 1],
    ]
    for (const parts of partSets) {
      for (let total = parts.length; total <= 40; total++) {
        const drops = distributeDrops(parts, total)
        expect(drops, `parts ${parts} total ${total}`).not.toBeNull()
        expect(drops!.reduce((a, b) => a + b, 0)).toBe(total)
        expect(Math.min(...drops!)).toBeGreaterThanOrEqual(1)
        expect(drops!.every(Number.isInteger)).toBe(true)
      }
    }
  })

  it('never gives an oil with more parts fewer drops', () => {
    for (let total = 3; total <= 30; total++) {
      const drops = distributeDrops([3, 2, 1], total)!
      expect(drops[0]).toBeGreaterThanOrEqual(drops[1])
      expect(drops[1]).toBeGreaterThanOrEqual(drops[2])
    }
  })

  it('returns null when there are more oils than drops', () => {
    expect(distributeDrops([3, 2, 1], 2)).toBeNull()
    expect(distributeDrops([1, 1], 0)).toBeNull()
  })

  it('returns an empty list for an empty blend', () => {
    expect(distributeDrops([], 6)).toEqual([])
  })

  it('rejects parts that are zero or negative', () => {
    expect(distributeDrops([2, 0], 4)).toBeNull()
    expect(distributeDrops([2, -1], 4)).toBeNull()
  })
})

describe('calculateDrops', () => {
  const windDown = [
    { oilId: 'lavender', parts: 3 },
    { oilId: 'bergamot', parts: 2 },
    { oilId: 'clary-sage', parts: 1 },
  ]

  it('fills a 10 ml roller at 2% with exactly 4 drops', () => {
    const result = calculateDrops({
      method: 'roller',
      items: windDown,
      volumeMl: 10,
      dilutionPct: 2,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    expect(result.targetDrops).toBe(4)
    expect(result.totalDrops).toBe(4)
    expect(result.lines.map((l) => l.drops)).toEqual([2, 1, 1])
    expect(result.warnings).toEqual([])
  })

  it('reports each oil as a percent of a skin blend', () => {
    const result = calculateDrops({
      method: 'roller',
      items: windDown,
      volumeMl: 10,
      dilutionPct: 2,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    expect(result.lines[0].pct).toBeCloseTo(1)
    expect(result.lines[1].pct).toBeCloseTo(0.5)
    expect(skinPct(4, 10, 20)).toBeCloseTo(2)
  })

  it('uses the diffuser default for the water capacity', () => {
    const result = calculateDrops({
      method: 'diffuser',
      items: windDown,
      volumeMl: 200,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    expect(result.targetDrops).toBe(6)
    expect(result.lines.map((l) => l.drops)).toEqual([3, 2, 1])
    expect(result.lines[0].pct).toBeUndefined()
  })

  it('lets the user override the diffuser total', () => {
    const result = calculateDrops({
      method: 'diffuser',
      items: windDown,
      volumeMl: 200,
      dropsPerMl: 20,
      totalDropsOverride: 12,
      oils: OIL_INDEX,
    })
    expect(result.totalDrops).toBe(12)
    expect(result.lines.map((l) => l.drops)).toEqual([6, 4, 2])
  })

  it('respects a custom drops-per-ml setting', () => {
    const result = calculateDrops({
      method: 'massage',
      items: windDown,
      volumeMl: 30,
      dilutionPct: 2,
      dropsPerMl: 25,
      oils: OIL_INDEX,
    })
    expect(result.targetDrops).toBe(15)
    expect(result.totalDrops).toBe(15)
  })

  it('warns when there are more oils than drops', () => {
    const result = calculateDrops({
      method: 'roller',
      items: [
        ...windDown,
        { oilId: 'frankincense-carteri', parts: 1 },
        { oilId: 'ylang-ylang', parts: 1 },
      ],
      volumeMl: 10,
      dilutionPct: 2,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    expect(result.warnings).toEqual([
      { code: 'too-many-oils', message: TOO_MANY_OILS_MESSAGE },
    ])
    expect(result.totalDrops).toBe(0)
    expect(TOO_MANY_OILS_MESSAGE).toBe(
      'Too many oils for this size. Increase the volume or remove an oil.',
    )
  })

  it('asks for a dilution on skin blends that have none', () => {
    const result = calculateDrops({
      method: 'roller',
      items: windDown,
      volumeMl: 10,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    expect(result.warnings.map((w) => w.code)).toEqual(['missing-dilution'])
    expect(result.totalDrops).toBe(0)
  })

  it('ignores items with no parts and handles an empty blend', () => {
    const empty = calculateDrops({
      method: 'diffuser',
      items: [],
      volumeMl: 200,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    expect(empty.lines).toEqual([])
    expect(empty.warnings).toEqual([])

    const result = calculateDrops({
      method: 'diffuser',
      items: [
        { oilId: 'lavender', parts: 2 },
        { oilId: 'lemon', parts: 0 },
      ],
      volumeMl: 200,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    expect(result.lines.map((l) => l.oilId)).toEqual(['lavender'])
    expect(result.totalDrops).toBe(6)
  })

  it('holds ylang ylang to its sourced 0.8% skin maximum', () => {
    const result = calculateDrops({
      method: 'roller',
      items: [{ oilId: 'ylang-ylang', parts: 1 }],
      volumeMl: 10,
      dilutionPct: 2,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    // 0.8% of 200 carrier drops is 1.6, so 1 whole drop.
    expect(result.lines[0].drops).toBe(1)
    expect(result.warnings[0].code).toBe('lowered-to-skin-max')
    expect(result.warnings[0].message).toContain('0.8% skin limit')
  })

  it('gives cinnamon cassia no drops in a roller (0.05% skin maximum)', () => {
    const result = calculateDrops({
      method: 'roller',
      items: [
        { oilId: 'sweet-orange', parts: 3 },
        { oilId: 'cinnamon-cassia', parts: 1 },
      ],
      volumeMl: 10,
      dilutionPct: 2,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    const cassia = result.lines.find((l) => l.oilId === 'cinnamon-cassia')!
    expect(cassia.drops).toBe(0)
    expect(result.warnings.map((w) => w.code)).toEqual(['removed-over-skin-max'])
  })

  it("holds a brand blend to the brand's own maximum", () => {
    // Apple Cider: Plant Therapy says dilute to a maximum of 1%.
    const result = calculateDrops({
      method: 'roller',
      items: [{ oilId: 'apple-cider', parts: 1 }],
      volumeMl: 10,
      dilutionPct: 3,
      dropsPerMl: 20,
      oils: OIL_INDEX,
    })
    expect(result.lines[0].drops).toBe(2)
    expect(result.lines[0].pct).toBeCloseTo(1)
  })

  // The limits below are made up to exercise the cap. They are not real values.
  it('lowers an oil that goes over its own skin maximum and says why', () => {
    const oils = withSafety('lavender', { dermalMaxPct: 0.5, review: 'full' })
    const result = calculateDrops({
      method: 'roller',
      items: [
        { oilId: 'lavender', parts: 3 },
        { oilId: 'frankincense-carteri', parts: 1 },
      ],
      volumeMl: 10,
      dilutionPct: 3,
      dropsPerMl: 20,
      oils,
    })
    expect(result.targetDrops).toBe(6)
    const lavender = result.lines.find((l) => l.oilId === 'lavender')!
    expect(lavender.drops).toBe(1)
    expect(lavender.pct).toBeCloseTo(0.5)
    expect(result.totalDrops).toBe(2)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe('lowered-to-skin-max')
    expect(result.warnings[0].message).toContain('Lavender lowered from 5 to 1 drop')
  })

  it('takes an oil to 0 drops when even 1 drop is over its skin maximum', () => {
    const oils = withSafety('lavender', { dermalMaxPct: 0.1, review: 'full' })
    const result = calculateDrops({
      method: 'roller',
      items: [{ oilId: 'lavender', parts: 1 }],
      volumeMl: 10,
      dilutionPct: 2,
      dropsPerMl: 20,
      oils,
    })
    expect(result.lines[0].drops).toBe(0)
    expect(result.warnings[0].code).toBe('removed-over-skin-max')
  })

  it('does not apply skin maximums in a diffuser', () => {
    const oils = withSafety('lavender', { dermalMaxPct: 0.1, review: 'full' })
    const result = calculateDrops({
      method: 'diffuser',
      items: [{ oilId: 'lavender', parts: 1 }],
      volumeMl: 200,
      dropsPerMl: 20,
      oils,
    })
    expect(result.lines[0].drops).toBe(6)
    expect(result.warnings).toEqual([])
  })
})

describe('isSkinMethod', () => {
  it('treats roller and massage as skin methods', () => {
    expect(isSkinMethod('roller')).toBe(true)
    expect(isSkinMethod('massage')).toBe(true)
    expect(isSkinMethod('diffuser')).toBe(false)
  })
})
