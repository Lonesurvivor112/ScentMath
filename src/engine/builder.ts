import type {
  Blend,
  BlendItem,
  Method,
  Mood,
  Note,
  Profile,
  Recipe,
  ShelfItem,
} from '../data/schema'
import {
  calculateDrops,
  defaultParts,
  isSkinMethod,
  type CalcResult,
  type DropLine,
} from './calculator'
import { harmonyScore, noteShares, type CompatFn, type HarmonyResult } from './harmony'
import type { OilIndex, ResolvedOil } from './resolve'
import { checkBlend, type SafetyIssue } from './safety'
import { suggestOils, type Suggestion } from './scoring'

/**
 * The blend being built. This is plain data plus pure functions that return
 * a changed copy, so the Build screen stays thin and every rule is testable.
 *
 * A draft starts out "suggested": each oil has parts, and the calculator
 * turns parts into drops for the chosen size. The first time the user
 * changes a drop count by hand the draft becomes "manual": parts then hold
 * the drop counts themselves and `totalDrops` is their sum.
 */
export interface Draft {
  /** The saved blend this draft came from, if it is an edit. */
  blendId?: string
  name: string
  method: Method
  /** Water capacity for a diffuser, carrier oil for a roller or massage oil. */
  volumeMl: number
  /** Used for roller and massage oil. */
  dilutionPct: number
  items: BlendItem[]
  totalDrops?: number
  /** The parts from before the user took over, so "reset" can restore them. */
  suggested?: BlendItem[]
  mood?: Mood
  notes?: string
  rating?: Blend['rating']
}

export const VOLUME_CHOICES: Readonly<Record<Method, readonly number[]>> = {
  diffuser: [100, 200, 300, 500],
  roller: [5, 10, 15],
  massage: [30, 60, 100],
}

const DEFAULT_SKIN_VOLUME: Readonly<Record<Exclude<Method, 'diffuser'>, number>> = {
  roller: 10,
  massage: 30,
}

export const DILUTION_PRESETS: readonly { pct: number; use: string }[] = [
  { pct: 1, use: 'Face, sensitive skin, older adults' },
  { pct: 2, use: 'Everyday adult body use' },
  { pct: 3, use: 'Short-term, small area' },
]

/** With children in the home, skin blends start at 1% or less. */
export const KIDS_MAX_DEFAULT_DILUTION = 1

type Settings = Pick<
  Profile,
  'dropsPerMl' | 'diffuserMl' | 'defaultDilutionPct' | 'kidsYoungestAge'
>

export function defaultVolume(method: Method, settings: Pick<Profile, 'diffuserMl'>): number {
  return method === 'diffuser' ? settings.diffuserMl : DEFAULT_SKIN_VOLUME[method]
}

export function defaultDilution(
  settings: Pick<Profile, 'defaultDilutionPct' | 'kidsYoungestAge'>,
): number {
  return settings.kidsYoungestAge === undefined
    ? settings.defaultDilutionPct
    : Math.min(settings.defaultDilutionPct, KIDS_MAX_DEFAULT_DILUTION)
}

export function newDraft(settings: Settings, method: Method = 'diffuser'): Draft {
  return {
    name: '',
    method,
    volumeMl: defaultVolume(method, settings),
    dilutionPct: defaultDilution(settings),
    items: [],
  }
}

export const isManual = (draft: Draft): boolean => draft.totalDrops !== undefined

/**
 * Goes back to suggested drops. The ratios the blend had before the user
 * took over are kept; oils added since then get their default parts.
 */
export function resetToSuggested(draft: Draft, oils: OilIndex): Draft {
  if (!isManual(draft)) return draft
  const before = new Map((draft.suggested ?? []).map((item) => [item.oilId, item.parts]))
  const items = draft.items.map((item) => {
    const oil = oils.get(item.oilId)
    return {
      oilId: item.oilId,
      parts: before.get(item.oilId) ?? (oil ? defaultParts(oil) : 1),
    }
  })
  return { ...draft, items, totalDrops: undefined, suggested: undefined }
}

/**
 * A change of method, size or dilution changes the total, so hand-set drops
 * turn back into ratios and the calculator re-splits them.
 */
function reflow(draft: Draft): Draft {
  return { ...draft, totalDrops: undefined, suggested: undefined }
}

export function setMethod(draft: Draft, method: Method, settings: Settings): Draft {
  if (method === draft.method) return draft
  return reflow({ ...draft, method, volumeMl: defaultVolume(method, settings) })
}

export function setVolume(draft: Draft, volumeMl: number): Draft {
  return volumeMl > 0 && volumeMl !== draft.volumeMl ? reflow({ ...draft, volumeMl }) : draft
}

export function setDilution(draft: Draft, dilutionPct: number): Draft {
  return dilutionPct > 0 && dilutionPct !== draft.dilutionPct
    ? reflow({ ...draft, dilutionPct })
    : draft
}

/** Adds an oil. In manual mode it comes in at 1 drop and nothing else moves. */
export function addOil(draft: Draft, oil: ResolvedOil): Draft {
  if (draft.items.some((item) => item.oilId === oil.id)) return draft
  if (isManual(draft)) {
    return {
      ...draft,
      items: [...draft.items, { oilId: oil.id, parts: 1 }],
      totalDrops: (draft.totalDrops ?? 0) + 1,
    }
  }
  return { ...draft, items: [...draft.items, { oilId: oil.id, parts: defaultParts(oil) }] }
}

export function removeOil(draft: Draft, oilId: string): Draft {
  const removed = draft.items.find((item) => item.oilId === oilId)
  if (!removed) return draft
  const items = draft.items.filter((item) => item.oilId !== oilId)
  if (!isManual(draft)) return { ...draft, items }
  if (items.length === 0) return { ...draft, items, totalDrops: undefined, suggested: undefined }
  return { ...draft, items, totalDrops: items.reduce((sum, item) => sum + item.parts, 0) }
}

/**
 * One tap on a drop stepper. The first tap freezes the suggested drops as
 * the starting point. An oil can't go below 1 drop (remove it instead) or
 * above its own skin maximum.
 */
export function stepDrops(
  draft: Draft,
  oilId: string,
  delta: number,
  lines: readonly DropLine[],
): Draft {
  if (!draft.items.some((item) => item.oilId === oilId)) return draft
  const shown = new Map(lines.map((line) => [line.oilId, line]))

  const base: BlendItem[] = isManual(draft)
    ? draft.items
    : draft.items.map((item) => ({
        oilId: item.oilId,
        parts: Math.max(1, shown.get(item.oilId)?.drops ?? 1),
      }))

  const items = base.map((item) => {
    if (item.oilId !== oilId) return item
    const max = shown.get(oilId)?.maxDrops
    const ceiling = max === undefined ? Number.POSITIVE_INFINITY : Math.max(1, max)
    return { oilId, parts: Math.min(ceiling, Math.max(1, Math.round(item.parts + delta))) }
  })

  return {
    ...draft,
    items,
    totalDrops: items.reduce((sum, item) => sum + item.parts, 0),
    suggested: isManual(draft) ? draft.suggested : draft.items,
  }
}

export interface DraftView {
  calc: CalcResult
  issues: SafetyIssue[]
  /** Null with fewer than two oils. */
  harmony: HarmonyResult | null
  /** Share of the blend in each note, by drops. */
  notes: Record<Note, number>
  /** The best oils to add next, from the oils the user owns. */
  suggestions: Suggestion[]
}

export interface DraftContext {
  profile: Profile
  oils: OilIndex
  compat: CompatFn
  /** Oils that can be suggested: on the shelf and not empty. */
  owned: ReadonlySet<string>
  /** Pass the shelf and today's date to check for old bottles. */
  shelf?: readonly ShelfItem[]
  today?: Date
}

/** Everything the Build screen shows for a draft, worked out in one place. */
export function evaluateDraft(draft: Draft, ctx: DraftContext): DraftView {
  const skin = isSkinMethod(draft.method)
  const calc = calculateDrops({
    method: draft.method,
    items: draft.items,
    volumeMl: draft.volumeMl,
    dilutionPct: skin ? draft.dilutionPct : undefined,
    dropsPerMl: ctx.profile.dropsPerMl,
    totalDropsOverride: draft.totalDrops,
    oils: ctx.oils,
  })

  const issues = checkBlend({
    method: draft.method,
    lines: calc.lines,
    volumeMl: draft.volumeMl,
    dropsPerMl: ctx.profile.dropsPerMl,
    profile: ctx.profile,
    oils: ctx.oils,
    shelf: ctx.shelf,
    today: ctx.today,
  })

  // Balance and harmony follow what will actually go in the bottle. Before
  // any drops exist (too many oils for the size) they fall back to parts.
  const anyDrops = calc.totalDrops > 0
  const members = calc.lines.flatMap((line) => {
    const oil = ctx.oils.get(line.oilId)
    const weight = anyDrops ? line.drops : line.parts
    return oil && weight > 0 ? [{ oil, parts: weight }] : []
  })

  const suggestions = suggestOils(
    {
      blend: draft.items,
      method: draft.method,
      volumeMl: draft.volumeMl,
      dilutionPct: skin ? draft.dilutionPct : undefined,
      dropsPerMl: ctx.profile.dropsPerMl,
      totalDropsOverride: draft.totalDrops === undefined ? undefined : draft.totalDrops + 1,
      mood: draft.mood,
      profile: ctx.profile,
      oils: ctx.oils,
      compat: ctx.compat,
    },
    ctx.owned,
  )

  return {
    calc,
    issues,
    harmony: harmonyScore(members, ctx.compat),
    notes: noteShares(members.map((m) => ({ note: m.oil.note, parts: m.parts }))),
    suggestions,
  }
}

/** The draft as a blend ready to save. */
export function draftToBlend(draft: Draft, id: string, createdAt: string): Blend {
  const name = draft.name.trim()
  const notes = draft.notes?.trim()
  return {
    id,
    name: name.length > 0 ? name : 'Untitled blend',
    method: draft.method,
    items: draft.items.map((item) => ({ ...item })),
    volumeMl: draft.volumeMl,
    ...(isSkinMethod(draft.method) ? { dilutionPct: draft.dilutionPct } : {}),
    ...(draft.totalDrops !== undefined ? { totalDrops: draft.totalDrops } : {}),
    ...(draft.mood ? { mood: draft.mood } : {}),
    ...(draft.rating ? { rating: draft.rating } : {}),
    ...(notes ? { notes } : {}),
    createdAt,
  }
}

/** Opens a saved blend for editing. It reopens with exactly the drops it was saved with. */
export function blendToDraft(blend: Blend, settings: Settings): Draft {
  return {
    blendId: blend.id,
    name: blend.name,
    method: blend.method,
    volumeMl: blend.volumeMl,
    dilutionPct: blend.dilutionPct ?? defaultDilution(settings),
    items: blend.items.map((item) => ({ ...item })),
    totalDrops: blend.totalDrops,
    mood: blend.mood,
    notes: blend.notes,
    rating: blend.rating,
  }
}

/** Opens a recipe or idea in the builder at the user's usual size for its method. */
export function recipeToDraft(
  recipe: Pick<Recipe, 'name' | 'goal' | 'method' | 'items'>,
  settings: Settings,
): Draft {
  return {
    ...newDraft(settings, recipe.method),
    name: recipe.name,
    mood: recipe.goal,
    items: recipe.items.map((item) => ({ ...item })),
  }
}

/** The drop lines for a saved blend, for showing it without opening the builder. */
export function blendDrops(
  blend: Pick<Blend, 'method' | 'items' | 'volumeMl' | 'dilutionPct' | 'totalDrops'>,
  dropsPerMl: number,
  oils: OilIndex,
): CalcResult {
  return calculateDrops({
    method: blend.method,
    items: blend.items,
    volumeMl: blend.volumeMl,
    dilutionPct: blend.dilutionPct,
    dropsPerMl,
    totalDropsOverride: blend.totalDrops,
    oils,
  })
}
