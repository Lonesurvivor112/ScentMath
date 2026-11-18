import {
  FAMILIES,
  NOTES,
  pairKey,
  type Compatibility,
  type Family,
  type Intensity,
  type Note,
} from '../data/schema'
import type { ResolvedOil } from './resolve'

/** A blend member as the engine sees it: the resolved oil and its parts. */
export interface BlendMember {
  oil: ResolvedOil
  parts: number
}

/** Looks up how well two scent families pair: 1 classic, 0.5 works, 0 risky. */
export type CompatFn = (a: Family, b: Family) => number

/** The note mix a blend aims for: about 30% top, 50% middle, 20% base. */
export const NOTE_TARGET: Readonly<Record<Note, number>> = {
  top: 0.3,
  middle: 0.5,
  base: 0.2,
}

/**
 * The furthest a note mix can be from the target. It happens when every part
 * is in the note with the smallest target share.
 */
export const MAX_NOTE_DISTANCE = 1 - Math.min(...NOTES.map((n) => NOTE_TARGET[n]))

export const HARMONY_WEIGHTS = { family: 60, note: 25, intensity: 15 } as const

/** Builds the family lookup from compatibility.json. Unlisted pairs are risky (0). */
export function makeCompat(data: Compatibility): CompatFn {
  const scores = new Map<string, number>()
  for (const pair of data.pairs) scores.set(pairKey(pair.a, pair.b), pair.score)
  return (a, b) => (a === b ? data.sameFamily : (scores.get(pairKey(a, b)) ?? 0))
}

/**
 * How well two oils pair by family, 0 to 1. An oil with two families is
 * judged by its best-matching side. Returns 0 when either oil has no family.
 */
export function oilPairCompat(
  a: Pick<ResolvedOil, 'families'>,
  b: Pick<ResolvedOil, 'families'>,
  compat: CompatFn,
): number {
  let best = 0
  for (const fa of a.families) {
    for (const fb of b.families) best = Math.max(best, compat(fa, fb))
  }
  return best
}

/** The share of parts in each note. All zeros for an empty blend. */
export function noteShares(
  items: readonly { note: Note; parts: number }[],
): Record<Note, number> {
  const shares: Record<Note, number> = { top: 0, middle: 0, base: 0 }
  let total = 0
  for (const item of items) {
    if (item.parts > 0) {
      shares[item.note] += item.parts
      total += item.parts
    }
  }
  if (total > 0) for (const note of NOTES) shares[note] /= total
  return shares
}

/**
 * How far a note mix is from the target, from 0 (on target) up to
 * MAX_NOTE_DISTANCE. It is half the sum of the gaps, so it reads as the
 * share of the blend that sits in the wrong note.
 */
export function noteDistance(shares: Readonly<Record<Note, number>>): number {
  let gap = 0
  for (const note of NOTES) gap += Math.abs(shares[note] - NOTE_TARGET[note])
  return gap / 2
}

/** Note balance from 0 (as far off as possible) to 1 (on target). */
export function noteBalance(
  items: readonly { note: Note; parts: number }[],
): number {
  if (!items.some((item) => item.parts > 0)) return 0
  const balance = 1 - noteDistance(noteShares(items)) / MAX_NOTE_DISTANCE
  return Math.min(1, Math.max(0, balance))
}

/**
 * Intensity balance from 0 to 1. Each oil's pull is its parts times its
 * intensity. The score drops as the strongest oil's share of the total pull
 * rises above an even split. A blend with fewer than two oils scores 1.
 */
export function intensityBalance(
  items: readonly { intensity: Intensity; parts: number }[],
): number {
  const pulls = items.filter((i) => i.parts > 0).map((i) => i.parts * i.intensity)
  const n = pulls.length
  if (n < 2) return 1
  const total = pulls.reduce((sum, p) => sum + p, 0)
  const even = 1 / n
  const strongest = Math.max(...pulls) / total
  return Math.min(1, Math.max(0, 1 - (strongest - even) / (1 - even)))
}

/** The average family compatibility across every pair of oils, 0 to 1. */
export function averagePairCompat(
  oils: readonly Pick<ResolvedOil, 'families'>[],
  compat: CompatFn,
): number {
  let sum = 0
  let pairs = 0
  for (let i = 0; i < oils.length; i++) {
    for (let j = i + 1; j < oils.length; j++) {
      sum += oilPairCompat(oils[i], oils[j], compat)
      pairs += 1
    }
  }
  return pairs === 0 ? 0 : sum / pairs
}

export interface HarmonyResult {
  /** 0 to 100 */
  score: number
  /** Each part on a 0 to 1 scale, before weighting. */
  familyCompat: number
  noteBalance: number
  intensityBalance: number
}

/**
 * Harmony score, 0 to 100: family compatibility x 60, note balance x 25 and
 * intensity balance x 15. Returns null for fewer than two oils, because one
 * oil has nothing to harmonize with. It's a guide, not a rule.
 */
export function harmonyScore(
  members: readonly BlendMember[],
  compat: CompatFn,
): HarmonyResult | null {
  const active = members.filter((m) => m.parts > 0)
  if (active.length < 2) return null

  const familyCompat = averagePairCompat(
    active.map((m) => m.oil),
    compat,
  )
  const notes = noteBalance(active.map((m) => ({ note: m.oil.note, parts: m.parts })))
  const intensity = intensityBalance(
    active.map((m) => ({ intensity: m.oil.intensity, parts: m.parts })),
  )
  const score = Math.round(
    familyCompat * HARMONY_WEIGHTS.family +
      notes * HARMONY_WEIGHTS.note +
      intensity * HARMONY_WEIGHTS.intensity,
  )
  return {
    score: Math.min(100, Math.max(0, score)),
    familyCompat,
    noteBalance: notes,
    intensityBalance: intensity,
  }
}

/** How much of a blend's scent comes from one family, 0 to 1. */
export interface FamilyShare {
  family: Family
  share: number
}

/**
 * Where a blend's scent leans, family by family, strongest first. Each oil
 * counts by its parts times its intensity, so one drop of a strong oil
 * outweighs one drop of a soft one. An oil with several families gives its
 * first (main) family a double share: Lavender (floral, herbaceous) counts
 * two thirds floral and one third herbaceous. Empty for an empty blend.
 */
export function scentProfile(
  items: readonly { oil: Pick<ResolvedOil, 'families' | 'intensity'>; parts: number }[],
): FamilyShare[] {
  const weights = new Map<Family, number>()
  let total = 0
  for (const { oil, parts } of items) {
    if (parts <= 0 || oil.families.length === 0) continue
    const weight = parts * oil.intensity
    const slices = oil.families.length + 1 // the main family takes two slices
    oil.families.forEach((family, i) => {
      const add = (weight * (i === 0 ? 2 : 1)) / slices
      weights.set(family, (weights.get(family) ?? 0) + add)
    })
    total += weight
  }
  if (total === 0) return []
  const order = (family: Family) => FAMILIES.indexOf(family)
  return [...weights]
    .map(([family, weight]) => ({ family, share: weight / total }))
    .sort((a, b) => b.share - a.share || order(a.family) - order(b.family))
}

/** A one-line reading of a scent profile, for "Leans citrus, with herbaceous". */
export type ScentLean =
  | { kind: 'mostly'; first: Family }
  | { kind: 'even'; first: Family; second: Family }
  | { kind: 'leans'; first: Family; second?: Family }

/** A family must hold this share to be named as the blend's second side. */
export const SECOND_FAMILY_MIN = 0.15

/**
 * Sums up where a profile leans. "Mostly" when one family has 60% or more,
 * "even" when the top two are within 10 points and both have 25% or more,
 * otherwise "leans" toward the first, naming a second family that has at
 * least 15%. Null for an empty profile.
 */
export function scentLean(profile: readonly FamilyShare[]): ScentLean | null {
  const [first, second] = profile
  if (!first) return null
  if (first.share >= 0.6) return { kind: 'mostly', first: first.family }
  if (second && second.share >= 0.25 && first.share - second.share < 0.1) {
    return { kind: 'even', first: first.family, second: second.family }
  }
  return second && second.share >= SECOND_FAMILY_MIN
    ? { kind: 'leans', first: first.family, second: second.family }
    : { kind: 'leans', first: first.family }
}