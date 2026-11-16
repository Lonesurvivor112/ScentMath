import { describe, expect, it } from 'vitest'
import { OIL_INDEX, RECIPES, STARTER_SHELF } from '../data'
import { DEFAULT_PROFILE, MOODS, RecipeSchema } from '../data/schema'
import {
  blendText,
  describeSize,
  generateIdeas,
  listOilNames,
  matchRecipes,
  type IdeaContext,
} from './ideas'
import { ownedOilIds } from './shelf'
import { NO_HOUSEHOLD, compat, oil } from './testing'

const owned = ownedOilIds(STARTER_SHELF)
const without = (...ids: string[]) => new Set([...owned].filter((id) => !ids.includes(id)))
const names = (matches: { recipe: { name: string } }[]) => matches.map((m) => m.recipe.name)

describe('matchRecipes', () => {
  it('can make every starter recipe from the starter shelf', () => {
    const { ready, missingOne } = matchRecipes(RECIPES, owned, OIL_INDEX, compat)
    expect(ready).toHaveLength(9)
    expect(missingOne).toEqual([])
    for (const match of ready) expect(match.missing).toEqual([])
  })

  it('puts the most harmonious recipe first', () => {
    const { ready } = matchRecipes(RECIPES, owned, OIL_INDEX, compat)
    const scores = ready.map((m) => m.harmony ?? -1)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(scores[0]).toBeGreaterThan(80)
  })

  it('moves a recipe to "missing one oil" when one oil is gone', () => {
    const { ready, missingOne } = matchRecipes(RECIPES, without('patchouli'), OIL_INDEX, compat)
    expect(names(missingOne)).toEqual(['Grounding'])
    expect(missingOne[0].missing).toEqual(['patchouli'])
    expect(names(ready)).not.toContain('Grounding')
    expect(ready).toHaveLength(8)
  })

  it('drops recipes that are two or more oils short', () => {
    const { ready, missingOne } = matchRecipes(RECIPES, without('sweet-orange', 'frankincense-carteri'), OIL_INDEX, compat)
    // Grounding and Cozy fall both need orange and frankincense.
    expect(names([...ready, ...missingOne])).not.toContain('Grounding')
    expect(names([...ready, ...missingOne])).not.toContain('Cozy fall')
    expect(names(missingOne)).toEqual(['Bright morning'])
  })

  it('treats an oil that has run out as missing', () => {
    const shelf = STARTER_SHELF.map((item) => (item.oilId === 'lemon' ? { ...item, empty: true } : item))
    const { missingOne } = matchRecipes(RECIPES, ownedOilIds(shelf), OIL_INDEX, compat)
    expect(names(missingOne).sort()).toEqual(['Clean house', 'Focus', 'Stuffy head'])
  })

  it('filters by mood', () => {
    expect(names(matchRecipes(RECIPES, owned, OIL_INDEX, compat, 'calm').ready).sort()).toEqual(['Grounding', 'Spa day'])
    expect(names(matchRecipes(RECIPES, owned, OIL_INDEX, compat, 'sleep').ready)).toEqual(['Wind down'])
    for (const mood of MOODS) {
      expect(matchRecipes(RECIPES, owned, OIL_INDEX, compat, mood).ready.length, mood).toBeGreaterThanOrEqual(1)
    }
  })

  it('shows nothing for an empty shelf', () => {
    expect(matchRecipes(RECIPES, new Set(), OIL_INDEX, compat)).toEqual({ ready: [], missingOne: [] })
  })
})

describe('generateIdeas', () => {
  const ctx: IdeaContext = {
    owned,
    oils: OIL_INDEX,
    compat,
    profile: NO_HOUSEHOLD,
    settings: DEFAULT_PROFILE,
    recipes: RECIPES,
  }

  it('builds blends for each mood from the shelf only', () => {
    for (const mood of MOODS) {
      const ideas = generateIdeas(mood, ctx)
      expect(ideas.length, mood).toBeGreaterThanOrEqual(1)
      expect(ideas.length, mood).toBeLessThanOrEqual(3)
      for (const idea of ideas) {
        expect(RecipeSchema.safeParse(idea.recipe).success, idea.recipe.id).toBe(true)
        expect(idea.recipe.goal).toBe(mood)
        expect(idea.recipe.items.length).toBeGreaterThanOrEqual(2)
        expect(idea.recipe.items.length).toBeLessThanOrEqual(3)
        expect(oil(idea.recipe.items[0].oilId).moods).toContain(mood)
        for (const item of idea.recipe.items) expect(owned.has(item.oilId), item.oilId).toBe(true)
        expect(new Set(idea.recipe.items.map((i) => i.oilId)).size).toBe(idea.recipe.items.length)
      }
    }
  })

  it('returns distinct blends, most harmonious first, without repeating a recipe', () => {
    const ideas = generateIdeas('calm', ctx, 10)
    const keys = ideas.map((i) => [...i.recipe.items.map((x) => x.oilId)].sort().join('+'))
    expect(new Set(keys).size).toBe(keys.length)
    const recipeKeys = RECIPES.map((r) => [...r.items.map((x) => x.oilId)].sort().join('+'))
    for (const key of keys) expect(recipeKeys).not.toContain(key)
    const scores = ideas.map((i) => i.harmony ?? -1)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('is the same every time', () => {
    expect(generateIdeas('cozy', ctx)).toEqual(generateIdeas('cozy', ctx))
  })

  it('respects pregnancy mode', () => {
    const ideas = generateIdeas('calm', { ...ctx, profile: { ...NO_HOUSEHOLD, pregnant: true } }, 10)
    for (const idea of ideas) {
      const ids = idea.recipe.items.map((i) => i.oilId)
      expect(ids).not.toContain('clary-sage')
      expect(ids).not.toContain('balance')
    }
  })

  it('has nothing to offer from an empty or one-oil shelf', () => {
    expect(generateIdeas('calm', { ...ctx, owned: new Set() })).toEqual([])
    expect(generateIdeas('calm', { ...ctx, owned: new Set(['lavender']) })).toEqual([])
  })

  it('respects the limit', () => {
    expect(generateIdeas('calm', ctx, 1)).toHaveLength(1)
    expect(generateIdeas('calm', ctx, 0)).toEqual([])
  })
})

describe('text helpers', () => {
  it('lists oil names', () => {
    expect(listOilNames([])).toBe('')
    expect(listOilNames(['Lavender'])).toBe('Lavender')
    expect(listOilNames(['Lavender', 'Lemon'])).toBe('Lavender & Lemon')
    expect(listOilNames(['Lavender', 'Lemon', 'Patchouli'])).toBe('Lavender, Lemon & Patchouli')
  })

  it('describes the size', () => {
    expect(describeSize('diffuser', 200)).toBe('Diffuser, 200 ml')
    expect(describeSize('diffuser', 200, 2)).toBe('Diffuser, 200 ml')
    expect(describeSize('roller', 10, 2)).toBe('Roller, 10 ml at 2%')
    expect(describeSize('massage', 30, 2.5)).toBe('Massage oil, 30 ml at 2.5%')
  })

  it('writes a blend as shareable text', () => {
    const text = blendText(
      { name: 'Wind down', method: 'diffuser', volumeMl: 200, notes: ' Lovely before bed. ' },
      [
        { oilId: 'lavender', drops: 3 },
        { oilId: 'bergamot', drops: 2 },
        { oilId: 'clary-sage', drops: 1 },
        { oilId: 'cinnamon-cassia', drops: 0 },
      ],
      (id) => oil(id).name,
    )
    expect(text).toBe(
      [
        'Wind down',
        'Diffuser, 200 ml',
        '',
        '3 drops Lavender',
        '2 drops Bergamot',
        '1 drop Clary Sage',
        '',
        'Lovely before bed.',
        '',
        'Made with ScentMath',
      ].join('\n'),
    )
  })
})
