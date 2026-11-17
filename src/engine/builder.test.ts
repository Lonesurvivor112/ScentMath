import { describe, expect, it } from 'vitest'
import { OIL_INDEX, RECIPES, STARTER_SHELF } from '../data'
import { BlendSchema, DEFAULT_PROFILE, type Profile } from '../data/schema'
import {
  DILUTION_PRESETS,
  VOLUME_CHOICES,
  addOil,
  blendDrops,
  blendToDraft,
  defaultDilution,
  defaultVolume,
  draftToBlend,
  evaluateDraft,
  isManual,
  newDraft,
  recipeToDraft,
  removeOil,
  resetToSuggested,
  rollDraft,
  setDilution,
  setMethod,
  setVolume,
  stepDrops,
  type Draft,
  type DraftContext,
} from './builder'
import { ownedOilIds } from './shelf'
import { compat, oil, seededRandom } from './testing'

const ctx = (profile: Profile = DEFAULT_PROFILE): DraftContext => ({
  profile,
  oils: OIL_INDEX,
  compat,
  owned: ownedOilIds(STARTER_SHELF),
})

const drops = (draft: Draft, profile: Profile = DEFAULT_PROFILE) =>
  evaluateDraft(draft, ctx(profile)).calc.lines.map((l) => l.drops)

/** Sweet orange, frankincense and peppermint in a 200 ml diffuser. */
const mainFlow = () =>
  ['sweet-orange', 'frankincense-carteri', 'peppermint'].reduce(
    (draft, id) => addOil(draft, oil(id)),
    newDraft(DEFAULT_PROFILE),
  )

describe('starting a draft', () => {
  it('uses the profile defaults', () => {
    const draft = newDraft(DEFAULT_PROFILE)
    expect(draft.method).toBe('diffuser')
    expect(draft.volumeMl).toBe(200)
    expect(draft.dilutionPct).toBe(2)
    expect(draft.items).toEqual([])
    expect(isManual(draft)).toBe(false)
  })

  it('picks a sensible size for each method', () => {
    expect(defaultVolume('diffuser', { diffuserMl: 300 })).toBe(300)
    expect(defaultVolume('roller', DEFAULT_PROFILE)).toBe(10)
    expect(defaultVolume('massage', DEFAULT_PROFILE)).toBe(30)
    for (const method of ['diffuser', 'roller', 'massage'] as const) {
      expect(VOLUME_CHOICES[method]).toContain(defaultVolume(method, DEFAULT_PROFILE))
    }
  })

  it('defaults to 1% or less when the home has children', () => {
    expect(defaultDilution(DEFAULT_PROFILE)).toBe(2)
    expect(defaultDilution({ ...DEFAULT_PROFILE, kidsYoungestAge: 5 })).toBe(1)
    expect(defaultDilution({ defaultDilutionPct: 0.5, kidsYoungestAge: 5 })).toBe(0.5)
    expect(newDraft({ ...DEFAULT_PROFILE, kidsYoungestAge: 3 }, 'roller').dilutionPct).toBe(1)
  })

  it('offers the plan dilution presets', () => {
    expect(DILUTION_PRESETS.map((p) => p.pct)).toEqual([1, 2, 3])
  })
})

describe('the main flow from the plan', () => {
  it('fills in suggested drops as oils are added', () => {
    let draft = newDraft(DEFAULT_PROFILE)
    draft = addOil(draft, oil('sweet-orange'))
    expect(drops(draft)).toEqual([6])
    draft = addOil(draft, oil('frankincense-carteri'))
    expect(drops(draft)).toEqual([5, 1]) // parts 3 and 1
    draft = addOil(draft, oil('peppermint'))
    expect(drops(draft)).toEqual([3, 1, 2]) // parts 3, 1 and 2
    expect(drops(draft).reduce((a, b) => a + b, 0)).toBe(6)
  })

  it('does not add the same oil twice', () => {
    const draft = addOil(mainFlow(), oil('peppermint'))
    expect(draft.items).toHaveLength(3)
  })

  it('shows balance, harmony, suggestions and safety together', () => {
    const view = evaluateDraft(mainFlow(), ctx())
    expect(view.harmony!.score).toBeGreaterThan(50)
    expect(view.notes.top).toBeCloseTo(5 / 6)
    expect(view.notes.base).toBeCloseTo(1 / 6)
    expect(view.suggestions).toHaveLength(5)
    for (const s of view.suggestions) {
      expect(ownedOilIds(STARTER_SHELF).has(s.oilId)).toBe(true)
      expect(mainFlow().items.map((i) => i.oilId)).not.toContain(s.oilId)
    }
    expect(view.issues).toEqual([])
  })

  it('has no harmony score until there are two oils', () => {
    const one = addOil(newDraft(DEFAULT_PROFILE), oil('lavender'))
    expect(evaluateDraft(one, ctx()).harmony).toBeNull()
    expect(evaluateDraft(newDraft(DEFAULT_PROFILE), ctx()).harmony).toBeNull()
  })

  it('never suggests an oil that has run out', () => {
    const shelf = STARTER_SHELF.map((item) =>
      item.oilId === 'frankincense-carteri' ? { ...item, empty: true } : item,
    )
    const draft = addOil(newDraft(DEFAULT_PROFILE), oil('sweet-orange'))
    const view = evaluateDraft(draft, { ...ctx(), owned: ownedOilIds(shelf) })
    expect(view.suggestions.map((s) => s.oilId)).not.toContain('frankincense-carteri')
  })

  it('warns about the household while building', () => {
    const profile: Profile = { ...DEFAULT_PROFILE, kidsYoungestAge: 4, cats: true }
    const view = evaluateDraft(mainFlow(), ctx(profile))
    expect(view.issues.map((i) => i.rule)).toEqual(['kids', 'cats'])
  })
})

describe('drop steppers', () => {
  it('switches to hand-set drops on the first tap and changes only that oil', () => {
    const before = mainFlow()
    const lines = evaluateDraft(before, ctx()).calc.lines
    const after = stepDrops(before, 'peppermint', 1, lines)
    expect(isManual(after)).toBe(true)
    expect(drops(after)).toEqual([3, 1, 3])
    expect(after.totalDrops).toBe(7)
    expect(after.suggested).toEqual(before.items)
  })

  it('keeps stepping from the hand-set values', () => {
    let draft = mainFlow()
    const step = (id: string, delta: number) => {
      draft = stepDrops(draft, id, delta, evaluateDraft(draft, ctx()).calc.lines)
    }
    step('peppermint', 1)
    step('peppermint', 1)
    step('sweet-orange', -1)
    expect(drops(draft)).toEqual([2, 1, 4])
    expect(draft.totalDrops).toBe(7)
  })

  it('never takes an oil below 1 drop', () => {
    let draft = mainFlow()
    for (let i = 0; i < 4; i++) {
      draft = stepDrops(draft, 'frankincense-carteri', -1, evaluateDraft(draft, ctx()).calc.lines)
    }
    expect(drops(draft)).toEqual([3, 1, 2])
  })

  it('ignores an oil that is not in the blend', () => {
    const draft = mainFlow()
    expect(stepDrops(draft, 'lavender', 1, [])).toBe(draft)
  })

  it('stops at an oil\'s own skin maximum', () => {
    // Ylang ylang: 0.8% of a 10 ml roller is 1 drop.
    let draft = addOil(addOil(newDraft(DEFAULT_PROFILE, 'roller'), oil('lavender')), oil('ylang-ylang'))
    draft = setDilution(draft, 3)
    for (let i = 0; i < 3; i++) {
      draft = stepDrops(draft, 'ylang-ylang', 1, evaluateDraft(draft, ctx()).calc.lines)
    }
    const view = evaluateDraft(draft, ctx())
    const ylang = view.calc.lines.find((l) => l.oilId === 'ylang-ylang')!
    expect(ylang.drops).toBe(1)
    expect(ylang.maxDrops).toBe(1)
  })

  it('warns when hand-set drops go over the dilution picked', () => {
    let draft = addOil(newDraft(DEFAULT_PROFILE, 'roller'), oil('lavender'))
    expect(drops(draft)).toEqual([4])
    draft = stepDrops(draft, 'lavender', 1, evaluateDraft(draft, ctx()).calc.lines)
    const view = evaluateDraft(draft, ctx())
    expect(view.calc.totalDrops).toBe(5)
    expect(view.calc.actualDilutionPct).toBeCloseTo(2.5)
    expect(view.calc.warnings.map((w) => w.code)).toEqual(['over-dilution'])
    expect(view.calc.warnings[0].message).toBe('5 drops in 10 ml is 2.5%, over the 2% you picked.')
  })

  it('adds a new oil at 1 drop without moving the others', () => {
    let draft = mainFlow()
    draft = stepDrops(draft, 'peppermint', 1, evaluateDraft(draft, ctx()).calc.lines)
    draft = addOil(draft, oil('lavender'))
    expect(drops(draft)).toEqual([3, 1, 3, 1])
    expect(draft.totalDrops).toBe(8)
  })

  it('keeps the other drops when an oil is removed', () => {
    let draft = mainFlow()
    draft = stepDrops(draft, 'peppermint', 1, evaluateDraft(draft, ctx()).calc.lines)
    draft = removeOil(draft, 'frankincense-carteri')
    expect(drops(draft)).toEqual([3, 3])
    expect(draft.totalDrops).toBe(6)
    draft = removeOil(removeOil(draft, 'sweet-orange'), 'peppermint')
    expect(draft.items).toEqual([])
    expect(isManual(draft)).toBe(false)
  })

  it('re-splits suggested drops when an oil is removed before any stepping', () => {
    const draft = removeOil(mainFlow(), 'peppermint')
    expect(drops(draft)).toEqual([5, 1])
    expect(removeOil(draft, 'not-in-blend')).toBe(draft)
  })

  it('resets to the suggested ratios', () => {
    const before = mainFlow()
    let draft = stepDrops(before, 'peppermint', 2, evaluateDraft(before, ctx()).calc.lines)
    draft = addOil(draft, oil('lavender'))
    draft = resetToSuggested(draft, OIL_INDEX)
    expect(isManual(draft)).toBe(false)
    expect(draft.items).toEqual([...before.items, { oilId: 'lavender', parts: 2 }])
    expect(resetToSuggested(before, OIL_INDEX)).toBe(before)
  })
})

describe('changing method, size and dilution', () => {
  it('re-splits for the new total', () => {
    let draft = mainFlow()
    draft = setVolume(draft, 300)
    expect(drops(draft).reduce((a, b) => a + b, 0)).toBe(8)
    draft = setMethod(draft, 'roller', DEFAULT_PROFILE)
    expect(draft.volumeMl).toBe(10)
    expect(drops(draft).reduce((a, b) => a + b, 0)).toBe(4)
    draft = setDilution(draft, 3)
    expect(drops(draft).reduce((a, b) => a + b, 0)).toBe(6)
  })

  it('turns hand-set drops back into ratios', () => {
    let draft = mainFlow()
    draft = stepDrops(draft, 'peppermint', 3, evaluateDraft(draft, ctx()).calc.lines)
    expect(drops(draft)).toEqual([3, 1, 5])
    draft = setVolume(draft, 100)
    expect(isManual(draft)).toBe(false)
    expect(drops(draft).reduce((a, b) => a + b, 0)).toBe(4)
    expect(drops(draft)[2]).toBeGreaterThanOrEqual(drops(draft)[0])
  })

  it('does nothing when the value is unchanged or invalid', () => {
    const draft = mainFlow()
    expect(setMethod(draft, 'diffuser', DEFAULT_PROFILE)).toBe(draft)
    expect(setVolume(draft, 200)).toBe(draft)
    expect(setVolume(draft, 0)).toBe(draft)
    expect(setDilution(draft, 2)).toBe(draft)
  })
})

describe('the dice button', () => {
  it('replaces the oils and keeps the method, size, dilution and goal', () => {
    let draft = addOil(newDraft(DEFAULT_PROFILE, 'massage'), oil('lavender'))
    draft = { ...setDilution(draft, 3), mood: 'calm', name: 'Old name', blendId: 'b9', notes: 'x', rating: 5 }
    const rolled = rollDraft(draft, ctx(), seededRandom(5))
    expect(rolled.method).toBe('massage')
    expect(rolled.volumeMl).toBe(30)
    expect(rolled.dilutionPct).toBe(3)
    expect(rolled.mood).toBe('calm')
    expect(rolled.items.length).toBeGreaterThanOrEqual(2)
    expect(oil(rolled.items[0].oilId).moods).toContain('calm')
    // It is a new blend, not an edit of the saved one.
    expect(rolled.blendId).toBeUndefined()
    expect(rolled.name).toBe('')
    expect(rolled.notes).toBeUndefined()
    expect(rolled.rating).toBeUndefined()
    expect(isManual(rolled)).toBe(false)
  })

  it('goes back to suggested drops after hand-set ones', () => {
    let draft = mainFlow()
    draft = stepDrops(draft, 'peppermint', 3, evaluateDraft(draft, ctx()).calc.lines)
    const rolled = rollDraft(draft, ctx(), seededRandom(2))
    expect(isManual(rolled)).toBe(false)
    expect(drops(rolled).reduce((a, b) => a + b, 0)).toBe(6)
  })

  it('rolls something different from the blend it replaces', () => {
    let draft = newDraft(DEFAULT_PROFILE)
    for (let i = 0; i < 12; i++) {
      const next = rollDraft(draft, ctx(), seededRandom(i + 1))
      const key = (d: Draft) => d.items.map((item) => item.oilId).sort().join('+')
      expect(key(next)).not.toBe(key(draft))
      draft = next
    }
  })

  it('leaves the draft alone when the shelf is empty', () => {
    const draft = mainFlow()
    expect(rollDraft(draft, { ...ctx(), owned: new Set() }, seededRandom(1))).toBe(draft)
  })
})

describe('saving and reopening', () => {
  it('saves a draft as a valid blend', () => {
    const blend = draftToBlend({ ...mainFlow(), name: '  Bright start ', mood: 'energize' }, 'b1', '2026-11-16T10:00:00.000Z')
    expect(BlendSchema.safeParse(blend).success).toBe(true)
    expect(blend.name).toBe('Bright start')
    expect(blend.dilutionPct).toBeUndefined()
    expect(blend.totalDrops).toBeUndefined()
    expect(blend.mood).toBe('energize')
  })

  it('names an unnamed blend and keeps the dilution for skin blends', () => {
    const draft = addOil(newDraft(DEFAULT_PROFILE, 'roller'), oil('lavender'))
    const blend = draftToBlend(draft, 'b2', '2026-11-16T10:00:00.000Z')
    expect(blend.name).toBe('Untitled blend')
    expect(blend.dilutionPct).toBe(2)
    expect(BlendSchema.safeParse(blend).success).toBe(true)
  })

  it('reopens with exactly the drops it was saved with', () => {
    let draft = mainFlow()
    draft = stepDrops(draft, 'peppermint', 1, evaluateDraft(draft, ctx()).calc.lines)
    draft = stepDrops(draft, 'sweet-orange', 2, evaluateDraft(draft, ctx()).calc.lines)
    const saved = draftToBlend({ ...draft, name: 'Mine', notes: ' Nice ', rating: 4 }, 'b3', '2026-11-16T10:00:00.000Z')
    expect(BlendSchema.safeParse(saved).success).toBe(true)
    expect(saved.totalDrops).toBe(9)

    const reopened = blendToDraft(saved, DEFAULT_PROFILE)
    expect(reopened.blendId).toBe('b3')
    expect(reopened.notes).toBe('Nice')
    expect(reopened.rating).toBe(4)
    expect(drops(reopened)).toEqual([5, 1, 3])
    expect(blendDrops(saved, 20, OIL_INDEX).lines.map((l) => l.drops)).toEqual([5, 1, 3])
  })
})

describe('opening recipes', () => {
  it('opens every starter recipe in a 200 ml diffuser with the right drops', () => {
    // Focus and Stuffy head are 2:2:1, which is 5 parts over 6 drops. The
    // spare drop goes to the first oil listed.
    const expected: Record<string, number[]> = {
      'bright-morning': [3, 2, 1],
      focus: [3, 2, 1],
      'wind-down': [3, 2, 1],
      grounding: [3, 2, 1],
      'spa-day': [3, 2, 1],
      'clean-house': [3, 2, 1],
      'stuffy-head': [3, 2, 1],
      'cozy-fall': [3, 2, 1],
      'mood-lift': [3, 2, 1],
      'fresh-air': [3, 2, 1],
      'blanket-day': [3, 2, 1],
    }
    expect(RECIPES).toHaveLength(Object.keys(expected).length)
    for (const recipe of RECIPES) {
      const draft = recipeToDraft(recipe, DEFAULT_PROFILE)
      expect(draft.name).toBe(recipe.name)
      expect(draft.mood).toBe(recipe.goal)
      expect(draft.volumeMl).toBe(200)
      const view = evaluateDraft(draft, ctx())
      expect(view.calc.lines.map((l) => l.oilId), recipe.id).toEqual(recipe.items.map((i) => i.oilId))
      expect(view.calc.lines.map((l) => l.drops), recipe.id).toEqual(expected[recipe.id])
      expect(view.calc.totalDrops, recipe.id).toBe(6)
      expect(view.calc.warnings, recipe.id).toEqual([])
    }
  })

  it('uses the user\'s own diffuser size', () => {
    const draft = recipeToDraft(RECIPES[0], { ...DEFAULT_PROFILE, diffuserMl: 300 })
    expect(draft.volumeMl).toBe(300)
    expect(drops(draft)).toEqual([4, 3, 1])
  })
})
