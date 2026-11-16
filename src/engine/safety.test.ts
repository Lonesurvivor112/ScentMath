import { describe, expect, it } from 'vitest'
import { OIL_INDEX } from '../data'
import type { Method } from '../data/schema'
import { calculateDrops } from './calculator'
import type { OilIndex } from './resolve'
import {
  OLD_BOTTLE_BADGE,
  checkBlend,
  flagStatus,
  isBottleOld,
  isHiddenForProfile,
  monthsBetween,
  worstSeverity,
  type HouseholdProfile,
} from './safety'
import { NO_HOUSEHOLD, oil, withCustomBlend, withSafety } from './testing'

interface CheckOptions {
  method?: Method
  volumeMl?: number
  dilutionPct?: number
  profile?: HouseholdProfile
  oils?: OilIndex
}

/** Runs the calculator, then the safety check, the way the app will. */
function check(oilIds: string[], options: CheckOptions = {}) {
  const method = options.method ?? 'roller'
  const volumeMl = options.volumeMl ?? (method === 'diffuser' ? 200 : 10)
  const oils = options.oils ?? OIL_INDEX
  const calc = calculateDrops({
    method,
    items: oilIds.map((oilId) => ({ oilId, parts: 1 })),
    volumeMl,
    dilutionPct: method === 'diffuser' ? undefined : (options.dilutionPct ?? 2),
    dropsPerMl: 20,
    oils,
  })
  return checkBlend({
    method,
    lines: calc.lines,
    volumeMl,
    dropsPerMl: 20,
    profile: options.profile ?? NO_HOUSEHOLD,
    oils,
  })
}

describe('skin irritant rule', () => {
  it('blocks cinnamon cassia in any roller', () => {
    for (const volumeMl of [5, 10, 15, 30]) {
      for (const dilutionPct of [0.5, 1, 2, 3, 5]) {
        const issues = check(['cinnamon-cassia', 'sweet-orange'], {
          method: 'roller',
          volumeMl,
          dilutionPct,
        })
        const block = issues.find((i) => i.rule === 'skin-irritant')
        expect(block, `${volumeMl} ml at ${dilutionPct}%`).toBeDefined()
        expect(block!.severity).toBe('block')
        expect(block!.oilIds).toEqual(['cinnamon-cassia'])
        expect(block!.title).toBe('Diffuser only: Cinnamon Cassia')
      }
    }
  })

  it('blocks cinnamon cassia in massage oil too', () => {
    const issues = check(['cinnamon-cassia'], { method: 'massage', volumeMl: 30 })
    expect(issues[0].rule).toBe('skin-irritant')
    expect(worstSeverity(issues)).toBe('block')
  })

  it('still blocks it when there are too many oils to give it a drop', () => {
    const issues = check(
      ['cinnamon-cassia', 'sweet-orange', 'lavender', 'lemon', 'patchouli'],
      { method: 'roller', volumeMl: 10, dilutionPct: 2 },
    )
    expect(issues.some((i) => i.rule === 'skin-irritant')).toBe(true)
  })

  it('allows cinnamon cassia in a diffuser', () => {
    const issues = check(['cinnamon-cassia', 'sweet-orange'], { method: 'diffuser' })
    expect(issues).toEqual([])
  })

  it('warns about an unreviewed blend that contains it', () => {
    const oils = withCustomBlend('my-spice-mix', 'My Spice Mix', ['cinnamon-cassia', 'sweet-orange'])
    const issues = check(['my-spice-mix'], { method: 'roller', oils })
    const issue = issues.find((i) => i.rule === 'skin-irritant')!
    expect(issue.severity).toBe('warn')
    expect(issue.detail).toContain('Cinnamon Cassia')
  })

  it("goes by the brand's own limit for a fully reviewed brand blend", () => {
    // Germ Fighter contains cassia, but Plant Therapy publishes a skin
    // dilution for the blend itself, so that is what applies.
    expect(oil('germ-fighter').safety.dermalMaxPct).toBe(2)
    const issues = check(['germ-fighter'], { method: 'roller', dilutionPct: 2 })
    expect(issues.some((i) => i.rule === 'skin-irritant')).toBe(false)
    expect(issues.some((i) => i.rule === 'unverified')).toBe(false)
  })
})

describe('sun sensitivity rule', () => {
  it('warns when bergamot is over its 0.4% sun-safe limit', () => {
    // One drop in a 10 ml roller is 0.5%.
    const issues = checkBlend({
      method: 'roller',
      lines: [{ oilId: 'bergamot', drops: 1 }],
      volumeMl: 10,
      dropsPerMl: 20,
      profile: NO_HOUSEHOLD,
      oils: OIL_INDEX,
    })
    const issue = issues.find((i) => i.rule === 'phototoxic')!
    expect(issue.severity).toBe('warn')
    expect(issue.detail).toContain('Avoid sun on this skin for 12 hours')
    expect(issue.detail).toContain('0.4%')
  })

  it('stays quiet when bergamot is under its limit', () => {
    // Two drops in 30 ml of massage oil is 0.33%.
    const issues = checkBlend({
      method: 'massage',
      lines: [{ oilId: 'bergamot', drops: 2 }],
      volumeMl: 30,
      dropsPerMl: 20,
      profile: NO_HOUSEHOLD,
      oils: OIL_INDEX,
    })
    expect(issues.some((i) => i.rule === 'phototoxic')).toBe(false)
  })

  it('uses the sourced limits for lemon (2%) and grapefruit (4%)', () => {
    const at = (oilId: string, drops: number) =>
      checkBlend({
        method: 'roller',
        lines: [{ oilId, drops }],
        volumeMl: 10,
        dropsPerMl: 20,
        profile: NO_HOUSEHOLD,
        oils: OIL_INDEX,
      }).some((i) => i.rule === 'phototoxic')
    expect(at('lemon', 4)).toBe(false) // 2%
    expect(at('lemon', 5)).toBe(true) // 2.5%
    expect(at('pink-grapefruit', 8)).toBe(false) // 4%
    expect(at('pink-grapefruit', 9)).toBe(true) // 4.5%
  })

  it('treats a flagged oil with no sourced limit as over the limit', () => {
    const oils = withSafety('lemon', { phototoxicMaxPct: undefined, dermalMaxPct: undefined })
    const issue = check(['lemon'], { oils, dilutionPct: 1 }).find((i) => i.rule === 'phototoxic')!
    expect(issue.detail).toContain("hasn't been sourced yet")
  })

  it('suggests bergapten-free bergamot or diffusing', () => {
    const [issue] = check(['bergamot']).filter((i) => i.rule === 'phototoxic')
    expect(issue.detail).toContain('bergapten-free bergamot')
    expect(issue.detail).toContain('diffuse')
  })

  it('does not warn in a diffuser', () => {
    const issues = check(['bergamot', 'lemon'], { method: 'diffuser' })
    expect(issues.some((i) => i.rule === 'phototoxic')).toBe(false)
  })

  it('does not warn for oils that are not flagged', () => {
    const issues = check(['lavender', 'frankincense-carteri'])
    expect(issues.some((i) => i.rule === 'phototoxic')).toBe(false)
  })

  // Made-up limits to exercise the comparison. Not real values.
  it('compares against the limit once one is sourced', () => {
    const oils = withSafety('bergamot', { phototoxicMaxPct: 1.5, review: 'full' })
    // 10 ml at 2% = 4 drops of bergamot alone = 2%, over 1.5%.
    const over = check(['bergamot'], { oils, dilutionPct: 2 })
    expect(over.some((i) => i.rule === 'phototoxic')).toBe(true)
    // 10 ml at 1% = 2 drops = 1%, under 1.5%.
    const under = check(['bergamot'], { oils, dilutionPct: 1 })
    expect(under.some((i) => i.rule === 'phototoxic')).toBe(false)
  })

  it('warns about an unreviewed blend with a flagged component', () => {
    const oils = withCustomBlend('my-citrus-mix', 'My Citrus Mix', ['pink-grapefruit', 'lavender'])
    const issues = check(['my-citrus-mix'], { oils })
    const issue = issues.find((i) => i.rule === 'phototoxic')!
    expect(issue.oilIds).toEqual(['my-citrus-mix'])
    expect(issue.detail).toContain('Pink Grapefruit')
  })

  it('does not warn for a fully reviewed brand blend with no sun caution', () => {
    // Blues Buster contains grapefruit, but Plant Therapy lists no sun
    // caution at its recommended dilution.
    expect(check(['blues-buster']).some((i) => i.rule === 'phototoxic')).toBe(false)
  })
})

describe('skin maximum rule', () => {
  // Made-up limit to exercise the rule. Not a real value.
  it('warns when an oil is over its own skin maximum', () => {
    const oils = withSafety('lavender', { dermalMaxPct: 0.5, review: 'full' })
    const issues = checkBlend({
      method: 'roller',
      lines: [{ oilId: 'lavender', drops: 4 }],
      volumeMl: 10,
      dropsPerMl: 20,
      profile: NO_HOUSEHOLD,
      oils,
    })
    const issue = issues.find((i) => i.rule === 'dermal-max')!
    expect(issue.severity).toBe('warn')
    expect(issue.detail).toContain('2%')
    expect(issue.detail).toContain('0.5%')
  })
})

describe('young children rule', () => {
  const kids: HouseholdProfile = { ...NO_HOUSEHOLD, kidsYoungestAge: 4 }

  it('warns for peppermint, eucalyptus and rosemary when the home has kids', () => {
    for (const method of ['diffuser', 'roller'] as const) {
      const issues = check(['peppermint', 'eucalyptus-globulus', 'rosemary-cineole'], {
        method,
        profile: kids,
      })
      const issue = issues.find((i) => i.rule === 'kids')!
      expect(issue.severity).toBe('warn')
      expect(issue.oilIds).toEqual([
        'peppermint',
        'eucalyptus-globulus',
        'rosemary-cineole',
      ])
      expect(issue.detail).toContain("child's face")
    }
  })

  it('stays quiet when the profile has no kids', () => {
    const issues = check(['peppermint'], { method: 'diffuser' })
    expect(issues.some((i) => i.rule === 'kids')).toBe(false)
  })

  it('stays quiet for oils that are not flagged', () => {
    const issues = check(['lavender'], { method: 'diffuser', profile: kids })
    expect(issues.some((i) => i.rule === 'kids')).toBe(false)
  })

  // Made-up age to exercise the comparison. Not a real value.
  it('uses the minimum age once one is sourced', () => {
    const oils = withSafety('peppermint', { kidsMinAge: 6, review: 'full' })
    const younger = check(['peppermint'], { method: 'diffuser', profile: kids, oils })
    expect(younger.some((i) => i.rule === 'kids')).toBe(true)
    const older = check(['peppermint'], {
      method: 'diffuser',
      profile: { ...NO_HOUSEHOLD, kidsYoungestAge: 8 },
      oils,
    })
    expect(older.some((i) => i.rule === 'kids')).toBe(false)
  })

  it('uses the sourced age of 10 for oils that are not KidSafe', () => {
    const withChild = (age: number) =>
      check(['peppermint'], {
        method: 'diffuser',
        profile: { ...NO_HOUSEHOLD, kidsYoungestAge: age },
      }).some((i) => i.rule === 'kids')
    expect(oil('peppermint').safety.kidsMinAge).toBe(10)
    expect(withChild(2)).toBe(true)
    expect(withChild(9)).toBe(true)
    expect(withChild(10)).toBe(false)
    expect(withChild(14)).toBe(false)
  })

  it('covers unreviewed blends through their components', () => {
    const oils = withCustomBlend('my-breathe-mix', 'My Breathe Mix', ['eucalyptus-globulus', 'lavender'])
    const issues = check(['my-breathe-mix'], { method: 'diffuser', profile: kids, oils })
    const issue = issues.find((i) => i.rule === 'kids')!
    expect(issue.detail).toContain('My Breathe Mix (contains Eucalyptus Globulus)')
  })

  it('covers brand blends that are not KidSafe', () => {
    const issues = check(['germ-fighter', 'blues-buster'], { method: 'diffuser', profile: kids })
    const issue = issues.find((i) => i.rule === 'kids')!
    expect(issue.oilIds).toEqual(['germ-fighter'])
  })
})

describe('pregnancy rule', () => {
  const pregnant: HouseholdProfile = { ...NO_HOUSEHOLD, pregnant: true }

  it('warns when clary sage is added by hand', () => {
    const issues = check(['clary-sage', 'lavender'], {
      method: 'diffuser',
      profile: pregnant,
    })
    const issue = issues.find((i) => i.rule === 'pregnancy')!
    expect(issue.severity).toBe('warn')
    expect(issue.oilIds).toEqual(['clary-sage'])
  })

  it('hides flagged oils and blends that contain them from suggestions', () => {
    expect(isHiddenForProfile(oil('clary-sage'), pregnant, OIL_INDEX)).toBe(true)
    expect(isHiddenForProfile(oil('balance'), pregnant, OIL_INDEX)).toBe(true)
    expect(isHiddenForProfile(oil('lavender'), pregnant, OIL_INDEX)).toBe(false)
    expect(isHiddenForProfile(oil('clary-sage'), NO_HOUSEHOLD, OIL_INDEX)).toBe(false)
  })

  it('stays quiet when pregnancy mode is off', () => {
    const issues = check(['clary-sage'], { method: 'diffuser' })
    expect(issues.some((i) => i.rule === 'pregnancy')).toBe(false)
  })
})

describe('cats and dogs', () => {
  it('recommends short, ventilated sessions for tea tree, citrus and mint with cats', () => {
    const issues = check(['tea-tree', 'lemon', 'peppermint', 'lavender'], {
      method: 'diffuser',
      profile: { ...NO_HOUSEHOLD, cats: true },
    })
    const issue = issues.find((i) => i.rule === 'cats')!
    expect(issue.severity).toBe('caution')
    expect(issue.oilIds).toEqual(['tea-tree', 'lemon', 'peppermint'])
    expect(issue.detail).toContain('ventilated room your cat can leave')
  })

  it('stays quiet without cats', () => {
    const issues = check(['tea-tree'], { method: 'diffuser' })
    expect(issues).toEqual([])
  })

  it('adds a general diffusing note for dogs', () => {
    const issues = check(['lavender'], {
      method: 'diffuser',
      profile: { ...NO_HOUSEHOLD, dogs: true },
    })
    expect(issues.map((i) => i.rule)).toEqual(['dogs'])
  })
})

describe('old bottles', () => {
  const today = new Date(2026, 10, 16)

  it('counts whole months', () => {
    expect(monthsBetween(new Date(2025, 10, 16), today)).toBe(12)
    expect(monthsBetween(new Date(2025, 10, 17), today)).toBe(11)
    expect(monthsBetween(new Date(2026, 9, 16), today)).toBe(1)
  })

  it('flags citrus and tea tree opened 12 or more months ago', () => {
    expect(isBottleOld({ openedOn: '2025-11-16' }, oil('lemon'), OIL_INDEX, today)).toBe(true)
    expect(isBottleOld({ openedOn: '2024-06-01' }, oil('tea-tree'), OIL_INDEX, today)).toBe(true)
    expect(isBottleOld({ openedOn: '2025-11-17' }, oil('lemon'), OIL_INDEX, today)).toBe(false)
  })

  it('ignores slow-oxidizing oils and bottles with no opened date', () => {
    expect(isBottleOld({ openedOn: '2020-01-01' }, oil('patchouli'), OIL_INDEX, today)).toBe(false)
    expect(isBottleOld({}, oil('lemon'), OIL_INDEX, today)).toBe(false)
  })

  it('covers brand blends that contain citrus', () => {
    expect(
      isBottleOld({ openedOn: '2025-01-01' }, oil('holiday-season'), OIL_INDEX, today),
    ).toBe(true)
  })

  it('warns on skin blends when every bottle of an oil is old', () => {
    const base = {
      method: 'roller' as const,
      lines: [{ oilId: 'sweet-orange', drops: 2 }],
      volumeMl: 10,
      dropsPerMl: 20,
      profile: NO_HOUSEHOLD,
      oils: OIL_INDEX,
      today,
    }
    const old = checkBlend({
      ...base,
      shelf: [{ oilId: 'sweet-orange', sizeMl: 10, count: 1, openedOn: '2025-01-01' }],
    })
    const issue = old.find((i) => i.rule === 'old-bottle')!
    expect(issue.detail).toContain(OLD_BOTTLE_BADGE)

    const oneFresh = checkBlend({
      ...base,
      shelf: [
        { oilId: 'sweet-orange', sizeMl: 10, count: 1, openedOn: '2025-01-01' },
        { oilId: 'sweet-orange', sizeMl: 10, count: 1, openedOn: '2026-09-01' },
      ],
    })
    expect(oneFresh.some((i) => i.rule === 'old-bottle')).toBe(false)
  })
})

describe('unverified data', () => {
  // Geranium and sandalwood are library oils nobody has reviewed yet.
  it('says so on every skin blend that uses an oil that is not fully reviewed', () => {
    expect(oil('geranium').safety.review).toBe('none')
    expect(oil('clove-bud').safety.review).toBe('partial')
    const issues = check(['geranium', 'sandalwood', 'clove-bud', 'lavender'], {
      method: 'massage',
      volumeMl: 100,
      dilutionPct: 1,
    })
    expect(issues).toHaveLength(1)
    expect(issues[0].rule).toBe('unverified')
    expect(issues[0].severity).toBe('unverified')
    expect(issues[0].oilIds).toEqual(['geranium', 'sandalwood', 'clove-bud'])
  })

  it('stays quiet for fully reviewed oils', () => {
    expect(check(['lavender', 'frankincense-carteri'], { method: 'roller' })).toEqual([])
  })

  it('goes away once the oils are reviewed', () => {
    const oils = withSafety('geranium', { review: 'full' })
    const issues = check(['geranium'], { method: 'roller', oils })
    expect(issues).toEqual([])
  })

  it('shows on diffuser blends only when the household has someone at risk', () => {
    expect(check(['geranium'], { method: 'diffuser' })).toEqual([])
    const issues = check(['geranium'], {
      method: 'diffuser',
      profile: { ...NO_HOUSEHOLD, cats: true },
    })
    expect(issues.map((i) => i.rule)).toEqual(['unverified'])
  })
})

describe('checkBlend ordering and helpers', () => {
  it('sorts the most serious issues first', () => {
    const issues = check(['bergamot', 'cinnamon-cassia', 'tea-tree', 'geranium'], {
      method: 'roller',
      volumeMl: 30,
      profile: { ...NO_HOUSEHOLD, cats: true },
    })
    expect(issues.map((i) => i.severity)).toEqual([
      'block',
      'warn',
      'caution',
      'unverified',
    ])
  })

  it('reports the worst severity', () => {
    expect(worstSeverity([])).toBeNull()
    expect(worstSeverity(check(['lavender'], { method: 'roller' }))).toBeNull()
    expect(worstSeverity(check(['geranium'], { method: 'roller' }))).toBe('unverified')
    expect(worstSeverity(check(['bergamot'], { method: 'roller' }))).toBe('warn')
  })

  it('reports which components carry a flag on an unreviewed blend', () => {
    const oils = withCustomBlend('my-mix', 'My Mix', [
      'lemon',
      'eucalyptus-globulus',
      'rosemary-cineole',
    ])
    const status = flagStatus(oil('my-mix', oils), 'kidsCaution', oils)
    expect(status.self).toBe(false)
    expect(status.flagged).toBe(true)
    expect(status.via.map((c) => c.id)).toEqual(['eucalyptus-globulus', 'rosemary-cineole'])
    expect(flagStatus(oil('lavender'), 'kidsCaution', OIL_INDEX).flagged).toBe(false)
  })

  it('judges a fully reviewed brand blend by its own flags only', () => {
    // Blues Buster contains pink grapefruit, which is flagged phototoxic.
    const sun = flagStatus(oil('blues-buster'), 'phototoxic', OIL_INDEX)
    expect(sun).toEqual({ flagged: false, self: false, via: [] })
    const kids = flagStatus(oil('germ-fighter'), 'kidsCaution', OIL_INDEX)
    expect(kids).toEqual({ flagged: true, self: true, via: [] })
  })

  it('skips unknown oil ids', () => {
    const issues = checkBlend({
      method: 'diffuser',
      lines: [{ oilId: 'not-an-oil', drops: 3 }],
      volumeMl: 200,
      dropsPerMl: 20,
      profile: { ...NO_HOUSEHOLD, cats: true, dogs: true },
      oils: OIL_INDEX,
    })
    expect(issues).toEqual([])
  })
})

describe('wording', () => {
  it('makes no health claims', () => {
    const profile: HouseholdProfile = {
      kidsYoungestAge: 2,
      pregnant: true,
      cats: true,
      dogs: true,
    }
    const banned = /\b(cure|cures|heal|heals|healing|treat|treats|treatment|remedy|therapeutic)\b/i
    for (const method of ['diffuser', 'roller', 'massage'] as const) {
      const issues = check([...OIL_INDEX.keys()], { method, volumeMl: 500, profile })
      for (const issue of issues) {
        expect(`${issue.title} ${issue.detail}`).not.toMatch(banned)
      }
    }
  })
})
