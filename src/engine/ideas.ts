import { METHOD_LABELS } from '../data/labels'
import type { BlendItem, Method, Mood, Profile, Recipe } from '../data/schema'
import { defaultParts, isSkinMethod, type DropLine } from './calculator'
import { harmonyScore, type CompatFn } from './harmony'
import type { OilIndex } from './resolve'
import { isHiddenForProfile, type HouseholdProfile } from './safety'
import { suggestOils } from './scoring'

/**
 * "What can I make?": which recipes the shelf can make now, which are one
 * oil short, and fresh ideas built from the shelf itself.
 */

export interface RecipeMatch {
  recipe: Recipe
  /** Oils the recipe needs that aren't owned. */
  missing: string[]
  /** 0 to 100, or null when it can't be scored. */
  harmony: number | null
}

export interface RecipeMatches {
  /** Every oil is on the shelf. */
  ready: RecipeMatch[]
  /** Exactly one oil short. */
  missingOne: RecipeMatch[]
}

function harmonyOf(items: readonly BlendItem[], oils: OilIndex, compat: CompatFn): number | null {
  const members = items.flatMap((item) => {
    const oil = oils.get(item.oilId)
    return oil ? [{ oil, parts: item.parts }] : []
  })
  return harmonyScore(members, compat)?.score ?? null
}

/**
 * Sorts recipes into "you have everything" and "missing one oil", each with
 * the most harmonious first. A mood keeps only recipes with that goal.
 * Recipes two or more oils short are left out.
 */
export function matchRecipes(
  recipes: readonly Recipe[],
  owned: ReadonlySet<string>,
  oils: OilIndex,
  compat: CompatFn,
  mood?: Mood,
): RecipeMatches {
  const ready: RecipeMatch[] = []
  const missingOne: RecipeMatch[] = []
  for (const recipe of recipes) {
    if (mood && recipe.goal !== mood) continue
    const missing = recipe.items.map((item) => item.oilId).filter((id) => !owned.has(id))
    const match = { recipe, missing, harmony: harmonyOf(recipe.items, oils, compat) }
    if (missing.length === 0) ready.push(match)
    else if (missing.length === 1) missingOne.push(match)
  }
  const byHarmony = (a: RecipeMatch, b: RecipeMatch) =>
    (b.harmony ?? -1) - (a.harmony ?? -1) || a.recipe.name.localeCompare(b.recipe.name)
  return { ready: ready.sort(byHarmony), missingOne: missingOne.sort(byHarmony) }
}

/** "Lavender, Bergamot & Frankincense" */
export function listOilNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

const setKey = (ids: readonly string[]): string => [...ids].sort().join('+')

export interface IdeaContext {
  owned: ReadonlySet<string>
  oils: OilIndex
  compat: CompatFn
  profile: HouseholdProfile
  settings: Pick<Profile, 'dropsPerMl' | 'diffuserMl'>
  /** Recipes already shown, so an idea doesn't repeat one. */
  recipes?: readonly Recipe[]
}

/** The lowest suggestion score worth adding to an idea. */
const MIN_ADD_SCORE = 0.3
const IDEA_SIZE = 3

/**
 * Builds diffuser blends for a mood out of the shelf. Each owned oil tagged
 * with the mood becomes a starting point, and the suggestion engine adds the
 * two oils that fit best. The most harmonious, distinct blends come back.
 */
export function generateIdeas(mood: Mood, ctx: IdeaContext, limit = 3): RecipeMatch[] {
  const seen = new Set((ctx.recipes ?? []).map((r) => setKey(r.items.map((i) => i.oilId))))
  const ideas: RecipeMatch[] = []

  const seeds = [...ctx.owned]
    .map((id) => ctx.oils.get(id))
    .filter((oil): oil is NonNullable<typeof oil> => oil !== undefined)
    .filter((oil) => oil.moods.includes(mood) && !isHiddenForProfile(oil, ctx.profile, ctx.oils))
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const seed of seeds) {
    const items: BlendItem[] = [{ oilId: seed.id, parts: defaultParts(seed) }]
    while (items.length < IDEA_SIZE) {
      const [best] = suggestOils(
        {
          blend: items,
          method: 'diffuser',
          volumeMl: ctx.settings.diffuserMl,
          dropsPerMl: ctx.settings.dropsPerMl,
          mood,
          profile: ctx.profile,
          oils: ctx.oils,
          compat: ctx.compat,
        },
        ctx.owned,
        1,
      )
      const oil = best ? ctx.oils.get(best.oilId) : undefined
      if (!best || !oil || best.score < MIN_ADD_SCORE || best.penalties.length > 0) break
      items.push({ oilId: oil.id, parts: defaultParts(oil) })
    }
    if (items.length < 2) continue
    const ids = items.map((item) => item.oilId)
    const key = setKey(ids)
    if (seen.has(key)) continue
    seen.add(key)
    ideas.push({
      recipe: {
        id: `idea-${key}`.replace(/\+/g, '-'),
        name: listOilNames(ids.map((id) => ctx.oils.get(id)?.name ?? id)),
        goal: mood,
        method: 'diffuser',
        items,
      },
      missing: [],
      harmony: harmonyOf(items, ctx.oils, ctx.compat),
    })
  }

  return ideas
    .sort((a, b) => (b.harmony ?? -1) - (a.harmony ?? -1) || a.recipe.name.localeCompare(b.recipe.name))
    .slice(0, Math.max(0, limit))
}

const trim = (n: number): string => String(Number(n.toFixed(2)))

/** "Diffuser, 200 ml" or "Roller, 10 ml at 2%" */
export function describeSize(method: Method, volumeMl: number, dilutionPct?: number): string {
  const size = `${METHOD_LABELS[method]}, ${trim(volumeMl)} ml`
  return isSkinMethod(method) && dilutionPct !== undefined ? `${size} at ${trim(dilutionPct)}%` : size
}

export interface ShareableBlend {
  name: string
  method: Method
  volumeMl: number
  dilutionPct?: number
  notes?: string
}

/** A blend as plain text, for sharing or copying. */
export function blendText(
  blend: ShareableBlend,
  lines: readonly Pick<DropLine, 'oilId' | 'drops'>[],
  nameOf: (oilId: string) => string,
): string {
  const rows = lines
    .filter((line) => line.drops > 0)
    .map((line) => `${line.drops} ${line.drops === 1 ? 'drop' : 'drops'} ${nameOf(line.oilId)}`)
  const out = [blend.name, describeSize(blend.method, blend.volumeMl, blend.dilutionPct), '', ...rows]
  const notes = blend.notes?.trim()
  if (notes) out.push('', notes)
  out.push('', 'Made with ScentMath')
  return out.join('\n')
}
