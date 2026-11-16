import type { Method, Profile, ShelfItem } from '../data/schema'
import { isSkinMethod, skinPct } from './calculator'
import type { OilIndex, ResolvedOil } from './resolve'

/**
 * Safety checks. Every value comes from the `safety` fields on each oil.
 * A flag without its number (a phototoxic oil with no sourced limit, a
 * kids-caution oil with no sourced age) is handled as the most cautious case.
 *
 * Wording here is scent and safety guidance only, with no health claims.
 */

/** Strongest first. `unverified` means the data hasn't been checked yet. */
export type Severity = 'block' | 'warn' | 'caution' | 'unverified'

export type SafetyRule =
  | 'phototoxic'
  | 'skin-irritant'
  | 'dermal-max'
  | 'kids'
  | 'pregnancy'
  | 'cats'
  | 'dogs'
  | 'old-bottle'
  | 'unverified'

export interface SafetyIssue {
  rule: SafetyRule
  severity: Severity
  /** The oils in the blend this issue is about. Empty for household-wide notes. */
  oilIds: string[]
  title: string
  detail: string
}

export type HouseholdProfile = Pick<
  Profile,
  'kidsYoungestAge' | 'pregnant' | 'cats' | 'dogs'
>

/** A bottle counts as old about 12 months after it was opened. */
export const OLD_BOTTLE_MONTHS = 12

export const OLD_BOTTLE_BADGE = 'May be oxidized; avoid on skin'

const SEVERITY_ORDER: readonly Severity[] = ['block', 'warn', 'caution', 'unverified']

type Flag =
  | 'phototoxic'
  | 'diffuseOnly'
  | 'kidsCaution'
  | 'pregnancyCaution'
  | 'catCaution'
  | 'oxidizesFast'

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const trimPct = (pct: number): string => String(Number(pct.toFixed(2)))

/**
 * Whether an oil carries a flag. A brand blend also carries the flags of its
 * components; `via` lists the components responsible. A brand blend whose own
 * safety values are fully reviewed (taken from the brand's page for that
 * blend) is judged by those values alone, since the brand knows how much of
 * each component is inside.
 */
export function flagStatus(
  oil: ResolvedOil,
  flag: Flag,
  oils: OilIndex,
): { flagged: boolean; self: boolean; via: ResolvedOil[] } {
  const self = oil.safety[flag] === true
  const via: ResolvedOil[] = []
  if (oil.safety.review !== 'full') {
    for (const id of oil.components) {
      const component = oils.get(id)
      if (component?.safety[flag] === true) via.push(component)
    }
  }
  return { flagged: self || via.length > 0, self, via }
}

/** How a flagged oil reads in a warning: "Lemon" or "Germ Fighter (contains Lemon)". */
function describe(oil: ResolvedOil, status: { self: boolean; via: ResolvedOil[] }): string {
  if (status.self || status.via.length === 0) return oil.name
  return `${oil.name} (contains ${listNames(status.via.map((c) => c.name))})`
}

/** True when the child in the profile is under the oil's minimum age, or the age isn't sourced. */
function kidsRuleApplies(oil: ResolvedOil, youngest: number): boolean {
  const minAge = oil.safety.kidsMinAge
  return minAge === undefined || youngest < minAge
}

/** Pregnancy mode hides flagged oils from suggestions. */
export function isHiddenForProfile(
  oil: ResolvedOil,
  profile: HouseholdProfile,
  oils: OilIndex,
): boolean {
  return profile.pregnant && flagStatus(oil, 'pregnancyCaution', oils).flagged
}

/** Whole months between two dates, counting only completed months. */
export function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return months
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * True for a fast-oxidizing oil (citrus, tea tree) opened more than about
 * 12 months ago. The shelf shows OLD_BOTTLE_BADGE for these.
 */
export function isBottleOld(
  item: Pick<ShelfItem, 'openedOn'>,
  oil: ResolvedOil,
  oils: OilIndex,
  today: Date,
): boolean {
  if (!item.openedOn) return false
  if (!flagStatus(oil, 'oxidizesFast', oils).flagged) return false
  const opened = parseIsoDate(item.openedOn)
  return opened !== null && monthsBetween(opened, today) >= OLD_BOTTLE_MONTHS
}

export interface SafetyInput {
  method: Method
  /** Drops per oil, straight from the calculator. */
  lines: readonly { oilId: string; drops: number }[]
  volumeMl: number
  dropsPerMl: number
  profile: HouseholdProfile
  oils: OilIndex
  /** Pass the shelf and today's date to check for old bottles. */
  shelf?: readonly ShelfItem[]
  today?: Date
}

/**
 * Checks a blend against every safety rule for the chosen method and
 * household. Returns issues sorted with the most serious first.
 */
export function checkBlend(input: SafetyInput): SafetyIssue[] {
  const { method, volumeMl, dropsPerMl, profile, oils } = input
  const skin = isSkinMethod(method)
  const issues: SafetyIssue[] = []

  const members: { oil: ResolvedOil; drops: number }[] = []
  const seen = new Set<string>()
  for (const line of input.lines) {
    const oil = oils.get(line.oilId)
    if (!oil || seen.has(oil.id)) continue
    seen.add(oil.id)
    members.push({ oil, drops: line.drops })
  }

  if (skin) {
    for (const { oil, drops } of members) {
      // Skin irritant: diffuser-only oils never go in a skin blend.
      const irritant = flagStatus(oil, 'diffuseOnly', oils)
      if (irritant.self) {
        issues.push({
          rule: 'skin-irritant',
          severity: 'block',
          oilIds: [oil.id],
          title: `Diffuser only: ${oil.name}`,
          detail: `${oil.name} is a strong skin irritant. Leave it out of rollers and massage oils and use it in a diffuser instead.`,
        })
      } else if (irritant.via.length > 0) {
        issues.push({
          rule: 'skin-irritant',
          severity: 'warn',
          oilIds: [oil.id],
          title: `Skin irritant in ${oil.name}`,
          detail: `${oil.name} contains ${listNames(irritant.via.map((c) => c.name))}, a strong skin irritant. Check the brand's label for its maximum skin dilution, or diffuse it instead.`,
        })
      }

      // Over the oil's own skin maximum.
      const pct = skinPct(drops, volumeMl, dropsPerMl)
      const dermalMax = oil.safety.dermalMaxPct
      if (dermalMax !== undefined && pct > dermalMax + 1e-9) {
        issues.push({
          rule: 'dermal-max',
          severity: 'warn',
          oilIds: [oil.id],
          title: `Over the skin limit: ${oil.name}`,
          detail: `${oil.name} is at ${trimPct(pct)}%, over its ${trimPct(dermalMax)}% skin limit. Lower it or use a bigger bottle.`,
        })
      }

      // Sun sensitivity.
      const photo = flagStatus(oil, 'phototoxic', oils)
      if (photo.self) {
        const max = oil.safety.phototoxicMaxPct
        const alternative =
          oil.id === 'bergamot'
            ? ' Try bergapten-free bergamot, or diffuse it instead.'
            : ' Or diffuse it instead.'
        if (max === undefined) {
          issues.push({
            rule: 'phototoxic',
            severity: 'warn',
            oilIds: [oil.id],
            title: `Sun sensitivity: ${oil.name}`,
            detail: `Avoid sun on this skin for 12 hours. ${oil.name}'s sun-safe skin limit hasn't been sourced yet, so any amount is treated as over the limit.${alternative}`,
          })
        } else if (pct > max + 1e-9) {
          issues.push({
            rule: 'phototoxic',
            severity: 'warn',
            oilIds: [oil.id],
            title: `Sun sensitivity: ${oil.name}`,
            detail: `Avoid sun on this skin for 12 hours. ${oil.name} is at ${trimPct(pct)}%, over its ${trimPct(max)}% sun-safe limit.${alternative}`,
          })
        }
      } else if (photo.via.length > 0) {
        issues.push({
          rule: 'phototoxic',
          severity: 'warn',
          oilIds: [oil.id],
          title: `Sun sensitivity: ${oil.name}`,
          detail: `Avoid sun on this skin for 12 hours. ${oil.name} contains ${listNames(photo.via.map((c) => c.name))}, which can make skin sun-sensitive, and the amount inside isn't known. Or diffuse it instead.`,
        })
      }
    }
  }

  // Young children.
  if (profile.kidsYoungestAge !== undefined) {
    const youngest = profile.kidsYoungestAge
    const hits = members.flatMap(({ oil }) => {
      const status = flagStatus(oil, 'kidsCaution', oils)
      const self = status.self && kidsRuleApplies(oil, youngest)
      const via = status.via.filter((c) => kidsRuleApplies(c, youngest))
      return self || via.length > 0 ? [{ oil, status: { self, via } }] : []
    })
    if (hits.length > 0) {
      issues.push({
        rule: 'kids',
        severity: 'warn',
        oilIds: hits.map((h) => h.oil.id),
        title: 'Young children',
        detail: `${listNames(hits.map((h) => describe(h.oil, h.status)))}: don't apply to or near a child's face, and don't diffuse close to the child.`,
      })
    }
  }

  // Pregnancy.
  if (profile.pregnant) {
    const hits = members
      .map(({ oil }) => ({ oil, status: flagStatus(oil, 'pregnancyCaution', oils) }))
      .filter((h) => h.status.flagged)
    if (hits.length > 0) {
      issues.push({
        rule: 'pregnancy',
        severity: 'warn',
        oilIds: hits.map((h) => h.oil.id),
        title: 'Pregnancy',
        detail: `${listNames(hits.map((h) => describe(h.oil, h.status)))}: flagged for caution during pregnancy. Best to leave ${hits.length === 1 ? 'it' : 'them'} out.`,
      })
    }
  }

  // Cats.
  if (profile.cats) {
    const hits = members
      .map(({ oil }) => ({ oil, status: flagStatus(oil, 'catCaution', oils) }))
      .filter((h) => h.status.flagged)
    if (hits.length > 0) {
      issues.push({
        rule: 'cats',
        severity: 'caution',
        oilIds: hits.map((h) => h.oil.id),
        title: 'Cats',
        detail: `${listNames(hits.map((h) => describe(h.oil, h.status)))}: keep diffusing sessions short, in a well-ventilated room your cat can leave or is kept out of. Never diffuse in a closed room with your cat inside.`,
      })
    }
  }

  // Dogs. No per-oil dog data exists yet, so this is a general diffusing note.
  if (profile.dogs && !skin && members.length > 0) {
    issues.push({
      rule: 'dogs',
      severity: 'caution',
      oilIds: [],
      title: 'Dogs',
      detail: 'Keep diffusing sessions short, in a ventilated room your dog can leave.',
    })
  }

  // Old bottles of fast-oxidizing oils shouldn't go on skin.
  if (skin && input.shelf && input.today) {
    const today = input.today
    const old = members.filter(({ oil }) => {
      const bottles = input.shelf!.filter((item) => item.oilId === oil.id)
      return (
        bottles.length > 0 &&
        bottles.every((item) => isBottleOld(item, oil, oils, today))
      )
    })
    if (old.length > 0) {
      issues.push({
        rule: 'old-bottle',
        severity: 'caution',
        oilIds: old.map((m) => m.oil.id),
        title: 'Old bottle',
        detail: `${listNames(old.map((m) => m.oil.name))}: opened more than ${OLD_BOTTLE_MONTHS} months ago. ${OLD_BOTTLE_BADGE}.`,
      })
    }
  }

  // Oils whose safety data hasn't been fully checked against a reference.
  // Shown on skin blends, and on diffuser blends when the household has
  // someone the unchecked flags could matter to.
  const householdAtRisk =
    profile.kidsYoungestAge !== undefined || profile.pregnant || profile.cats
  if (skin || householdAtRisk) {
    const unverified = members.filter(({ oil }) => oil.safety.review !== 'full')
    if (unverified.length > 0) {
      issues.push({
        rule: 'unverified',
        severity: 'unverified',
        oilIds: unverified.map((m) => m.oil.id),
        title: 'Safety data not fully verified',
        detail: skin
          ? `Skin limits haven't been fully checked for ${listNames(unverified.map((m) => m.oil.name))}. Check a trusted reference before using this blend on skin.`
          : `Household cautions haven't been fully checked for ${listNames(unverified.map((m) => m.oil.name))}. Check a trusted reference before diffusing around children, during pregnancy or near cats.`,
      })
    }
  }

  return issues.sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
}

/** The most serious severity in a list of issues, or null when there are none. */
export function worstSeverity(issues: readonly SafetyIssue[]): Severity | null {
  let worst: Severity | null = null
  for (const issue of issues) {
    if (
      worst === null ||
      SEVERITY_ORDER.indexOf(issue.severity) < SEVERITY_ORDER.indexOf(worst)
    ) {
      worst = issue.severity
    }
  }
  return worst
}
