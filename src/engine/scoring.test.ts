import { describe, expect, it } from 'vitest'
import { OIL_INDEX, STARTER_SHELF } from '../data'
import {
  DEFAULT_SUGGESTION_COUNT,
  PENALTIES,
  WEIGHTS,
  blendMembers,
  breaksSafetyRule,
  hasAffinity,
  noteTerm,
  scoreCandidate,
  suggestOils,
  type ScoringContext,
} from './scoring'
import { NO_HOUSEHOLD, compat, oil } from './testing'

const STARTER_IDS = STARTER_SHELF.map((item) => item.oilId)

function context(
  blend: [string, number][],
  overrides: Partial<ScoringContext> = {},
): ScoringContext {
  return {
    blend: blend.map(([oilId, parts]) => ({ oilId, parts })),
    method: 'diffuser',
    volumeMl: 200,
    dropsPerMl: 20,
    profile: NO_HOUSEHOLD,
    oils: OIL_INDEX,
    compat,
    ...overrides,
  }
}

const roller = { method: 'roller', volumeMl: 10, dilutionPct: 2 } as const

describe('weights', () => {
  it('match the plan formula', () => {
    expect(WEIGHTS).toEqual({ affinity: 0.4, family: 0.25, note: 0.2, mood: 0.15 })
    expect(WEIGHTS.affinity + WEIGHTS.family + WEIGHTS.note + WEIGHTS.mood).toBeCloseTo(1)
    expect(PENALTIES).toEqual({ familyRepeat: 0.3, secondIntensity5: 0.3, safety: 1 })
  })
})

describe('suggestOils', () => {
  it('only suggests oils from the shelf', () => {
    const shelf = ['lavender', 'lemon', 'frankincense-carteri']
    const suggestions = suggestOils(context([['sweet-orange', 3]]), shelf, 50)
    expect(suggestions.map((s) => s.oilId).sort()).toEqual([...shelf].sort())

    const fromStarter = suggestOils(context([['sweet-orange', 3]]), STARTER_IDS, 100)
    for (const suggestion of fromStarter) {
      expect(STARTER_IDS).toContain(suggestion.oilId)
    }
  })

  it('suggests nothing from an empty shelf', () => {
    expect(suggestOils(context([['sweet-orange', 3]]), [])).toEqual([])
  })

  it('skips oils already in the blend', () => {
    const suggestions = suggestOils(
      context([
        ['sweet-orange', 3],
        ['lavender', 2],
      ]),
      STARTER_IDS,
      100,
    )
    const ids = suggestions.map((s) => s.oilId)
    expect(ids).not.toContain('sweet-orange')
    expect(ids).not.toContain('lavender')
  })

  it('returns the top 5 by default, highest score first', () => {
    const suggestions = suggestOils(context([['sweet-orange', 3]]), STARTER_IDS)
    expect(DEFAULT_SUGGESTION_COUNT).toBe(5)
    expect(suggestions).toHaveLength(5)
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].score).toBeGreaterThanOrEqual(suggestions[i].score)
    }
  })

  it('ignores shelf ids that are not in the library and duplicate bottles', () => {
    const suggestions = suggestOils(
      context([['sweet-orange', 3]]),
      ['lavender', 'lavender', 'mystery-oil'],
      50,
    )
    expect(suggestions.map((s) => s.oilId)).toEqual(['lavender'])
  })

  it('hides pregnancy-flagged oils when pregnancy mode is on', () => {
    const pregnant = { ...NO_HOUSEHOLD, pregnant: true }
    const on = suggestOils(context([['lavender', 2]], { profile: pregnant }), STARTER_IDS, 100)
    expect(on.map((s) => s.oilId)).not.toContain('clary-sage')
    expect(on.map((s) => s.oilId)).not.toContain('balance')
    const off = suggestOils(context([['lavender', 2]]), STARTER_IDS, 100)
    expect(off.map((s) => s.oilId)).toContain('clary-sage')
  })

  it('follows the main flow in the plan: sweet orange in a 200 ml diffuser', () => {
    const ctx = context([['sweet-orange', 3]])
    const ranked = suggestOils(ctx, STARTER_IDS, 100)
    const frankincense = ranked.find((s) => s.oilId === 'frankincense-carteri')!
    const peppermint = ranked.find((s) => s.oilId === 'peppermint')!
    expect(frankincense.reason).toBe('Resin grounds bright citrus')
    expect(peppermint.reason).toBe('Mint lifts citrus')

    // Both are known partners of sweet orange, so they outrank every oil that isn't.
    for (const other of ranked.filter((s) => s.terms.affinity === 0)) {
      expect(frankincense.score).toBeGreaterThan(other.score)
      expect(peppermint.score).toBeGreaterThan(other.score)
    }
    expect(ranked.slice(0, 5).map((s) => s.oilId)).toContain('frankincense-carteri')
  })

  it('ranks by mood when starting from an empty blend', () => {
    const suggestions = suggestOils(context([], { mood: 'sleep' }), STARTER_IDS)
    for (const suggestion of suggestions) {
      expect(oil(suggestion.oilId).moods).toContain('sleep')
      expect(suggestion.reason).toBe('Fits your Sleep goal')
    }
  })
})

describe('scoreCandidate terms', () => {
  it('A is the share of blend oils that list the candidate as an affinity', () => {
    // Frankincense pairs with sweet orange and lavender, but not peppermint.
    const ctx = context([
      ['sweet-orange', 3],
      ['lavender', 2],
      ['peppermint', 1],
    ])
    expect(scoreCandidate(oil('frankincense-carteri'), ctx).terms.affinity).toBeCloseTo(2 / 3)
  })

  it('counts an affinity listed on either oil', () => {
    expect(oil('cinnamon-cassia').affinities).toContain('sweet-orange')
    expect(hasAffinity(oil('sweet-orange'), oil('cinnamon-cassia'))).toBe(true)
    expect(hasAffinity(oil('cinnamon-cassia'), oil('sweet-orange'))).toBe(true)
    expect(hasAffinity(oil('peppermint'), oil('patchouli'))).toBe(false)
  })

  it('F is the average family compatibility with the blend', () => {
    // Patchouli is earthy: citrus-earthy 1, minty-earthy 0.
    const ctx = context([
      ['lemon', 3],
      ['peppermint', 2],
    ])
    expect(scoreCandidate(oil('patchouli'), ctx).terms.family).toBeCloseTo(0.5)
  })

  it('N rewards the note the blend is missing', () => {
    const blend = blendMembers(
      [
        { oilId: 'lemon', parts: 3 },
        { oilId: 'peppermint', parts: 2 },
      ],
      OIL_INDEX,
    )
    const anotherTop = noteTerm(oil('spearmint'), blend)
    const middle = noteTerm(oil('lavender'), blend)
    const base = noteTerm(oil('frankincense-carteri'), blend)
    expect(anotherTop).toBe(0)
    expect(middle).toBeGreaterThan(0)
    expect(base).toBeGreaterThan(0)
    expect(middle).toBeLessThanOrEqual(1)
  })

  it('M is 1 for a mood match, and 0 when no mood is chosen', () => {
    const blend: [string, number][] = [['sweet-orange', 3]]
    const calm = scoreCandidate(oil('lavender'), context(blend, { mood: 'calm' }))
    const energize = scoreCandidate(oil('lavender'), context(blend, { mood: 'energize' }))
    const none = scoreCandidate(oil('lavender'), context(blend))
    expect(calm.terms.mood).toBe(1)
    expect(energize.terms.mood).toBe(0)
    expect(none.terms.mood).toBe(0)
    expect(calm.score - none.score).toBeCloseTo(WEIGHTS.mood)
  })

  it('adds the terms up with the plan weights', () => {
    const ctx = context(
      [
        ['sweet-orange', 3],
        ['lavender', 2],
      ],
      { mood: 'calm' },
    )
    const s = scoreCandidate(oil('frankincense-carteri'), ctx)
    const expected =
      0.4 * s.terms.affinity +
      0.25 * s.terms.family +
      0.2 * s.terms.note +
      0.15 * s.terms.mood -
      s.terms.penalty
    expect(s.score).toBeCloseTo(expected, 4)
  })
})

describe('penalties', () => {
  it('takes 0.3 when a family is already in the blend twice', () => {
    const twice = context([
      ['lemon', 3],
      ['sweet-orange', 3],
    ])
    const hit = scoreCandidate(oil('pink-grapefruit'), twice)
    expect(hit.penalties).toEqual(['familyRepeat'])
    expect(hit.terms.penalty).toBeCloseTo(0.3)

    const once = context([['lemon', 3]])
    expect(scoreCandidate(oil('pink-grapefruit'), once).penalties).toEqual([])
    expect(scoreCandidate(oil('lavender'), twice).penalties).toEqual([])
  })

  it('takes 0.3 for a second intensity-5 oil', () => {
    const ctx = context([
      ['sweet-orange', 3],
      ['patchouli', 1],
    ])
    const cassia = scoreCandidate(oil('cinnamon-cassia'), ctx)
    expect(cassia.penalties).toEqual(['secondIntensity5'])
    expect(cassia.terms.penalty).toBeCloseTo(0.3)
    expect(scoreCandidate(oil('frankincense-carteri'), ctx).penalties).toEqual([])
  })

  it('takes 1.0 when the oil breaks a safety rule for the method', () => {
    const blend: [string, number][] = [['lavender', 2]]
    const inRoller = scoreCandidate(oil('cinnamon-cassia'), context(blend, roller))
    expect(inRoller.penalties).toContain('safety')
    expect(inRoller.score).toBeLessThan(0)

    const inDiffuser = scoreCandidate(oil('cinnamon-cassia'), context(blend))
    expect(inDiffuser.penalties).not.toContain('safety')
    expect(inDiffuser.score).toBeGreaterThan(0)
  })

  it('treats a phototoxic oil with no sourced limit as breaking the rule on skin', () => {
    const blend: [string, number][] = [['lavender', 2]]
    expect(breaksSafetyRule(oil('bergamot'), context(blend, roller))).toBe(true)
    expect(breaksSafetyRule(oil('bergamot'), context(blend))).toBe(false)
    expect(breaksSafetyRule(oil('frankincense-carteri'), context(blend, roller))).toBe(false)
  })

  it('keeps safety-penalized oils out of the top suggestions for a roller', () => {
    const top = suggestOils(context([['lavender', 2]], roller), STARTER_IDS)
    const ids = top.map((s) => s.oilId)
    expect(ids).not.toContain('cinnamon-cassia')
    expect(ids).not.toContain('bergamot')
    for (const suggestion of top) expect(suggestion.penalties).not.toContain('safety')
  })
})

describe('reasons', () => {
  it('uses the family phrase from the plan', () => {
    const ctx = context([['ylang-ylang', 2]])
    expect(scoreCandidate(oil('sweet-orange'), ctx).reason).toBe(
      'Citrus brightens a floral heart',
    )
  })

  it('names the missing note when that is the strongest term', () => {
    // Patchouli has no affinity or family match with the mints, so N leads.
    const ctx = context([
      ['peppermint', 2],
      ['spearmint', 3],
    ])
    const patchouli = scoreCandidate(oil('patchouli'), ctx)
    expect(patchouli.terms.affinity).toBe(0)
    expect(patchouli.terms.family).toBe(0)
    expect(patchouli.reason).toBe('Adds the base note this blend is missing')
  })

  it('falls back to naming the partner oil', () => {
    // Vanilla lists peppermint, and there is no specific phrase for mint
    // joining a sweet base.
    const ctx = context([['vanilla', 1]])
    const peppermint = scoreCandidate(oil('peppermint'), ctx)
    expect(peppermint.terms.affinity).toBe(1)
    expect(peppermint.reason).toBe('Classic partner for Vanilla')
  })

  it('always gives a one-line reason', () => {
    const ctx = context([
      ['sweet-orange', 3],
      ['frankincense-carteri', 1],
    ])
    for (const suggestion of suggestOils(ctx, [...OIL_INDEX.keys()], 100)) {
      expect(suggestion.reason.length).toBeGreaterThan(0)
      expect(suggestion.reason).not.toContain('\n')
      expect(suggestion.reason).not.toContain('undefined')
    }
  })
})
