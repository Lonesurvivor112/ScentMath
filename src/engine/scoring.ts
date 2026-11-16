import { FAMILY_LABELS, MOOD_LABELS } from '../data/labels'
import type { BlendItem, Family, Method, Mood } from '../data/schema'
import { calculateDrops, defaultParts, isSkinMethod } from './calculator'
import {
  MAX_NOTE_DISTANCE,
  noteDistance,
  noteShares,
  oilPairCompat,
  type BlendMember,
  type CompatFn,
} from './harmony'
import type { OilIndex, ResolvedOil } from './resolve'
import {
  checkBlend,
  isHiddenForProfile,
  type HouseholdProfile,
  type SafetyRule,
} from './safety'

/** score = 0.40 A + 0.25 F + 0.20 N + 0.15 M - P */
export const WEIGHTS = {
  affinity: 0.4,
  family: 0.25,
  note: 0.2,
  mood: 0.15,
} as const

export const PENALTIES = {
  /** One of the candidate's families is already in the blend twice. */
  familyRepeat: 0.3,
  /** The candidate would be the second oil with intensity 5. */
  secondIntensity5: 0.3,
  /** The candidate breaks a safety rule for the chosen method. */
  safety: 1.0,
} as const

export const DEFAULT_SUGGESTION_COUNT = 5

/** The safety rules that depend on the method and so count as "breaking a rule". */
const METHOD_SAFETY_RULES: ReadonlySet<SafetyRule> = new Set<SafetyRule>([
  'phototoxic',
  'skin-irritant',
  'dermal-max',
])

export type PenaltyKind = keyof typeof PENALTIES

export interface ScoringContext {
  /** The oils already in the blend. */
  blend: readonly BlendItem[]
  method: Method
  volumeMl: number
  dilutionPct?: number
  dropsPerMl: number
  totalDropsOverride?: number
  mood?: Mood
  profile: HouseholdProfile
  oils: OilIndex
  compat: CompatFn
}

export interface ScoreTerms {
  affinity: number
  family: number
  note: number
  mood: number
  penalty: number
}

export interface Suggestion {
  oilId: string
  score: number
  /** A, F, N and M on a 0 to 1 scale, and the total penalty. */
  terms: ScoreTerms
  penalties: PenaltyKind[]
  /** One line on why this oil fits, built from the strongest term. */
  reason: string
}

/** One-line reasons for a candidate family joining a family already in the blend. */
const FAMILY_PHRASES: Readonly<Record<string, string>> = {
  'resinous>citrus': 'Resin grounds bright citrus',
  'minty>citrus': 'Mint lifts citrus',
  'floral>citrus': 'Florals soften bright citrus',
  'herbaceous>citrus': 'Green herbs sharpen citrus',
  'spicy>citrus': 'Spice warms up citrus',
  'woody>citrus': 'Wood anchors bright citrus',
  'earthy>citrus': 'Earthy depth under bright citrus',
  'sweet>citrus': 'Sweetness rounds out citrus',
  'citrus>floral': 'Citrus brightens a floral heart',
  'citrus>herbaceous': 'Citrus freshens green herbs',
  'citrus>minty': 'Citrus sweetens cool mint',
  'citrus>spicy': 'Citrus lifts warm spice',
  'citrus>woody': 'Citrus brightens the woods',
  'citrus>resinous': 'Citrus brightens warm resin',
  'citrus>earthy': 'Citrus lightens an earthy base',
  'citrus>sweet': 'Citrus cuts through the sweetness',
  'woody>floral': 'Wood steadies a floral heart',
  'resinous>floral': 'Resin deepens the florals',
  'spicy>floral': 'Spice warms the florals',
  'earthy>floral': 'Earthy depth under the florals',
  'sweet>floral': 'Sweetness rounds out the florals',
  'floral>woody': 'Florals soften the woods',
  'floral>resinous': 'Florals lift warm resin',
  'floral>spicy': 'Florals soften warm spice',
  'floral>earthy': 'Florals lift an earthy base',
  'floral>sweet': 'Florals bloom over a sweet base',
  'minty>herbaceous': 'Mint cools green herbs',
  'camphoraceous>herbaceous': 'Camphor sharpens green herbs',
  'woody>herbaceous': 'Wood grounds green herbs',
  'herbaceous>minty': 'Green herbs round out mint',
  'herbaceous>camphoraceous': 'Green herbs soften sharp camphor',
  'herbaceous>woody': 'Green herbs freshen the woods',
  'camphoraceous>minty': 'Camphor deepens cool mint',
  'minty>camphoraceous': 'Mint brightens sharp camphor',
  'woody>resinous': 'Wood and resin make a warm base',
  'resinous>woody': 'Resin warms the woods',
  'spicy>resinous': 'Spice warms the resin',
  'resinous>spicy': 'Resin smooths warm spice',
  'woody>spicy': 'Wood grounds warm spice',
  'spicy>woody': 'Spice warms the woods',
  'woody>earthy': 'Wood lifts an earthy base',
  'earthy>woody': 'Earthy depth under the woods',
  'sweet>spicy': 'Sweetness rounds out warm spice',
  'spicy>sweet': 'Spice warms a sweet base',
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The blend's items as resolved oils. Unknown ids and zero parts are skipped. */
export function blendMembers(
  blend: readonly BlendItem[],
  oils: OilIndex,
): BlendMember[] {
  const members: BlendMember[] = []
  for (const item of blend) {
    const oil = oils.get(item.oilId)
    if (oil && item.parts > 0) members.push({ oil, parts: item.parts })
  }
  return members
}

/** True when either oil lists the other as a good pairing. */
export function hasAffinity(a: ResolvedOil, b: ResolvedOil): boolean {
  return a.affinities.includes(b.id) || b.affinities.includes(a.id)
}

/**
 * N: how much adding the candidate moves the note mix toward the target,
 * as the share of the current gap it closes (0 to 1). For an empty blend it
 * is how close the candidate alone sits to the target.
 */
export function noteTerm(
  candidate: ResolvedOil,
  members: readonly BlendMember[],
): number {
  const before = members.map((m) => ({ note: m.oil.note, parts: m.parts }))
  const after = [...before, { note: candidate.note, parts: defaultParts(candidate) }]
  const distanceAfter = noteDistance(noteShares(after))
  if (before.length === 0) return clamp01(1 - distanceAfter / MAX_NOTE_DISTANCE)
  const distanceBefore = noteDistance(noteShares(before))
  if (distanceBefore <= 0) return 0
  return clamp01((distanceBefore - distanceAfter) / distanceBefore)
}

/** True when adding the candidate would break a method-based safety rule. */
export function breaksSafetyRule(
  candidate: ResolvedOil,
  ctx: ScoringContext,
): boolean {
  if (!isSkinMethod(ctx.method)) return false
  const items = [
    ...ctx.blend.filter((item) => item.oilId !== candidate.id),
    { oilId: candidate.id, parts: defaultParts(candidate) },
  ]
  const calc = calculateDrops({
    method: ctx.method,
    items,
    volumeMl: ctx.volumeMl,
    dilutionPct: ctx.dilutionPct,
    dropsPerMl: ctx.dropsPerMl,
    totalDropsOverride: ctx.totalDropsOverride,
    oils: ctx.oils,
  })
  const capped = calc.warnings.some(
    (w) =>
      w.oilId === candidate.id &&
      (w.code === 'lowered-to-skin-max' || w.code === 'removed-over-skin-max'),
  )
  if (capped) return true
  const issues = checkBlend({
    method: ctx.method,
    lines: calc.lines,
    volumeMl: ctx.volumeMl,
    dropsPerMl: ctx.dropsPerMl,
    profile: ctx.profile,
    oils: ctx.oils,
  })
  return issues.some(
    (issue) =>
      METHOD_SAFETY_RULES.has(issue.rule) && issue.oilIds.includes(candidate.id),
  )
}

/** The best specific phrase for the candidate joining this member, if one exists. */
function familyPhrase(
  candidate: ResolvedOil,
  member: ResolvedOil,
  compat: CompatFn,
): string | undefined {
  let best: { phrase: string; score: number } | undefined
  for (const from of candidate.families) {
    for (const to of member.families) {
      const phrase = FAMILY_PHRASES[`${from}>${to}`]
      const score = compat(from, to)
      if (phrase && score > 0 && (!best || score > best.score)) {
        best = { phrase, score }
      }
    }
  }
  return best?.phrase
}

/** A generic family reason when no specific phrase exists. */
function genericFamilyReason(
  candidate: ResolvedOil,
  member: ResolvedOil,
  compat: CompatFn,
): string {
  let best: { from: Family; to: Family; score: number } | undefined
  for (const from of candidate.families) {
    for (const to of member.families) {
      const score = compat(from, to)
      if (!best || score > best.score) best = { from, to, score }
    }
  }
  if (!best) return `Pairs with ${member.name}`
  if (best.from === best.to) {
    return `More ${FAMILY_LABELS[best.from].toLowerCase()} to build on ${member.name}`
  }
  const verb = best.score >= 1 ? 'pairs well with' : 'works with'
  return `${FAMILY_LABELS[best.from]} ${verb} ${FAMILY_LABELS[best.to].toLowerCase()}`
}

function buildReason(
  candidate: ResolvedOil,
  members: readonly BlendMember[],
  partners: readonly ResolvedOil[],
  terms: ScoreTerms,
  ctx: ScoringContext,
): string {
  const contributions: [keyof typeof WEIGHTS, number][] = [
    ['affinity', WEIGHTS.affinity * terms.affinity],
    ['family', WEIGHTS.family * terms.family],
    ['note', WEIGHTS.note * terms.note],
    ['mood', WEIGHTS.mood * terms.mood],
  ]
  let top = contributions[0]
  for (const entry of contributions) if (entry[1] > top[1]) top = entry
  if (top[1] <= 0) return 'A different direction to try'

  switch (top[0]) {
    case 'affinity': {
      for (const partner of partners) {
        const phrase = familyPhrase(candidate, partner, ctx.compat)
        if (phrase) return phrase
      }
      return `Classic partner for ${listNames(partners.map((p) => p.name))}`
    }
    case 'family': {
      let bestMember = members[0].oil
      let bestScore = -1
      for (const member of members) {
        const score = oilPairCompat(candidate, member.oil, ctx.compat)
        if (score > bestScore) {
          bestScore = score
          bestMember = member.oil
        }
      }
      return (
        familyPhrase(candidate, bestMember, ctx.compat) ??
        genericFamilyReason(candidate, bestMember, ctx.compat)
      )
    }
    case 'note': {
      const has = members.some((m) => m.oil.note === candidate.note)
      return has
        ? `Brings the ${candidate.note} notes closer to balance`
        : `Adds the ${candidate.note} note this blend is missing`
    }
    case 'mood':
      return ctx.mood
        ? `Fits your ${MOOD_LABELS[ctx.mood]} goal`
        : 'A different direction to try'
  }
}

/** Scores one candidate oil against the current blend. */
export function scoreCandidate(
  candidate: ResolvedOil,
  ctx: ScoringContext,
): Suggestion {
  const members = blendMembers(ctx.blend, ctx.oils).filter(
    (m) => m.oil.id !== candidate.id,
  )
  const partners = members.map((m) => m.oil).filter((oil) => hasAffinity(candidate, oil))

  const affinity = members.length > 0 ? partners.length / members.length : 0
  const family =
    members.length > 0
      ? members.reduce(
          (sum, m) => sum + oilPairCompat(candidate, m.oil, ctx.compat),
          0,
        ) / members.length
      : 0
  const note = noteTerm(candidate, members)
  const mood = ctx.mood !== undefined && candidate.moods.includes(ctx.mood) ? 1 : 0

  const penalties: PenaltyKind[] = []
  const familyAlreadyTwice = candidate.families.some(
    (f) => members.filter((m) => m.oil.families.includes(f)).length >= 2,
  )
  if (familyAlreadyTwice) penalties.push('familyRepeat')
  if (candidate.intensity === 5 && members.some((m) => m.oil.intensity === 5)) {
    penalties.push('secondIntensity5')
  }
  if (breaksSafetyRule(candidate, ctx)) penalties.push('safety')
  const penalty = penalties.reduce((sum, kind) => sum + PENALTIES[kind], 0)

  const terms: ScoreTerms = { affinity, family, note, mood, penalty }
  const score =
    WEIGHTS.affinity * affinity +
    WEIGHTS.family * family +
    WEIGHTS.note * note +
    WEIGHTS.mood * mood -
    penalty

  return {
    oilId: candidate.id,
    score: Math.round(score * 1e4) / 1e4,
    terms,
    penalties,
    reason: buildReason(candidate, members, partners, terms, ctx),
  }
}

/**
 * The best oils to add next, highest score first. Only oils on the shelf are
 * considered. Oils already in the blend are skipped, and oils hidden by the
 * household profile (pregnancy mode) never appear.
 */
export function suggestOils(
  ctx: ScoringContext,
  shelfOilIds: Iterable<string>,
  limit: number = DEFAULT_SUGGESTION_COUNT,
): Suggestion[] {
  const inBlend = new Set(ctx.blend.map((item) => item.oilId))
  const suggestions: Suggestion[] = []
  for (const id of new Set(shelfOilIds)) {
    if (inBlend.has(id)) continue
    const candidate = ctx.oils.get(id)
    if (!candidate) continue
    if (isHiddenForProfile(candidate, ctx.profile, ctx.oils)) continue
    suggestions.push(scoreCandidate(candidate, ctx))
  }
  const nameOf = (id: string): string => ctx.oils.get(id)?.name ?? id
  suggestions.sort(
    (a, b) => b.score - a.score || nameOf(a.oilId).localeCompare(nameOf(b.oilId)),
  )
  return suggestions.slice(0, Math.max(0, limit))
}
