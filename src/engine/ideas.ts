import { METHOD_LABELS } from '../data/labels'
import type { BlendItem, Method, Mood, Profile, Recipe } from '../data/schema'
import { defaultParts, isSkinMethod, topicalTotalDrops, type DropLine } from './calculator'
import { harmonyScore, type CompatFn } from './harmony'
import type { OilIndex } from './resolve'
import { isHiddenForProfile, type HouseholdProfile } from './safety'
import { breaksSafetyRule, suggestOils } from './scoring'

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

export interface RollRequest {
  method: Method
  volumeMl: number
  /** Needed for roller and massage oil. */
  dilutionPct?: number
  /** With a goal, the blend starts from an oil that fits it. */
  mood?: Mood
  /** The oils in the blend being replaced, so a roll never repeats it. */
  avoid?: readonly string[]
}

export interface RollContext {
  owned: ReadonlySet<string>
  oils: OilIndex
  compat: CompatFn
  profile: HouseholdProfile
  dropsPerMl: number
}

/** A roll picks each next oil at random from this many of the best fits. */
const ROLL_CHOICES = 5
const ROLL_MAX_OILS = 4
const ROLL_ATTEMPTS = 6

/**
 * Rolls a random blend from the shelf. The first oil is picked at random
 * (from the oils that fit the goal, if there is one). Each oil after that is
 * picked at random from the best few matches for the blend so far, so every
 * roll is different but none is a clash. Oils that are hidden for the
 * household or break a safety rule for the method are never used.
 *
 * `random` returns a number from 0 up to but not including 1, like
 * Math.random. Returns an empty list when the shelf has nothing to roll.
 */
export function rollBlend(
  request: RollRequest,
  ctx: RollContext,
  random: () => number = Math.random,
): BlendItem[] {
  const skin = isSkinMethod(request.method)
  const scoring = (blend: readonly BlendItem[]) => ({
    blend,
    method: request.method,
    volumeMl: request.volumeMl,
    dilutionPct: skin ? request.dilutionPct : undefined,
    dropsPerMl: ctx.dropsPerMl,
    mood: request.mood,
    profile: ctx.profile,
    oils: ctx.oils,
    compat: ctx.compat,
  })

  const usable = [...ctx.owned]
    .map((id) => ctx.oils.get(id))
    .filter((oil): oil is NonNullable<typeof oil> => oil !== undefined)
    .filter(
      (oil) =>
        !isHiddenForProfile(oil, ctx.profile, ctx.oils) && !breaksSafetyRule(oil, scoring([])),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
  if (usable.length === 0) return []
  const usableIds = usable.map((oil) => oil.id)

  const fitting = request.mood ? usable.filter((oil) => oil.moods.includes(request.mood!)) : []
  const seeds = fitting.length > 0 ? fitting : usable

  // A small skin blend only has room for as many oils as it has drops.
  const room = skin
    ? topicalTotalDrops(request.volumeMl, ctx.dropsPerMl, request.dilutionPct ?? 0)
    : ROLL_MAX_OILS
  const most = Math.max(1, Math.min(ROLL_MAX_OILS, room, usable.length))
  const pick = <T,>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))]
  const avoidKey = request.avoid && request.avoid.length > 0 ? setKey(request.avoid) : null

  let items: BlendItem[] = []
  for (let attempt = 0; attempt < ROLL_ATTEMPTS; attempt++) {
    const sizeRoll = random()
    const size = Math.min(most, sizeRoll < 0.2 ? 2 : sizeRoll < 0.8 ? 3 : 4)
    const seed = pick(seeds)
    items = [{ oilId: seed.id, parts: defaultParts(seed) }]
    while (items.length < size) {
      const choices = suggestOils(scoring(items), usableIds, ROLL_CHOICES).filter(
        (s) => s.penalties.length === 0 && s.score >= MIN_ADD_SCORE,
      )
      if (choices.length === 0) break
      const oil = ctx.oils.get(pick(choices).oilId)
      if (!oil) break
      items.push({ oilId: oil.id, parts: defaultParts(oil) })
    }
    const enough = items.length >= Math.min(2, most)
    if (enough && setKey(items.map((item) => item.oilId)) !== avoidKey) return items
  }
  return items
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
