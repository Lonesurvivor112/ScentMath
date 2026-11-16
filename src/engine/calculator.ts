import type { BlendItem, Intensity, Method, Note } from '../data/schema'
import type { OilIndex } from './resolve'

/** Guards whole-number steps against floating point noise (19.999999 -> 20). */
const EPSILON = 1e-9

export const DEFAULT_DROPS_PER_ML = 20

/** Parts by note before the intensity caps: top 3, middle 2, base 1. */
export const PARTS_BY_NOTE: Readonly<Record<Note, number>> = {
  top: 3,
  middle: 2,
  base: 1,
}

export const TOO_MANY_OILS_MESSAGE =
  'Too many oils for this size. Increase the volume or remove an oil.'

export const isSkinMethod = (method: Method): boolean => method !== 'diffuser'

/**
 * Starting parts for an oil: top 3, middle 2, base 1, with intensity-5 oils
 * capped at 1 part and intensity-4 oils capped at 2.
 */
export function defaultParts(oil: { note: Note; intensity: Intensity }): number {
  const parts = PARTS_BY_NOTE[oil.note]
  if (oil.intensity === 5) return Math.min(parts, 1)
  if (oil.intensity === 4) return Math.min(parts, 2)
  return parts
}

/**
 * Total essential oil drops for a roller or massage oil:
 * carrier ml x drops per ml x dilution. Rounds down, so the blend never goes
 * over the dilution that was asked for. A 10 ml roller at 2% is 4 drops.
 */
export function topicalTotalDrops(
  carrierMl: number,
  dropsPerMl: number,
  dilutionPct: number,
): number {
  if (!(carrierMl > 0) || !(dropsPerMl > 0) || !(dilutionPct > 0)) return 0
  return Math.floor(carrierMl * dropsPerMl * (dilutionPct / 100) + EPSILON)
}

/**
 * Default total drops for a diffuser by water capacity: 4 drops under
 * 200 ml, 6 drops from 200 ml, 8 drops from 300 ml. Users can override it.
 */
export function diffuserDefaultDrops(waterMl: number): number {
  if (waterMl >= 300) return 8
  if (waterMl >= 200) return 6
  return 4
}

/**
 * Splits `total` whole drops across oils in proportion to their parts, using
 * the largest-remainder method so the drops add up exactly. Every oil gets
 * at least 1 drop. Returns null when there are more oils than drops.
 */
export function distributeDrops(
  parts: readonly number[],
  total: number,
): number[] | null {
  const n = parts.length
  if (n === 0) return []
  if (!Number.isInteger(total) || total < n) return null
  if (parts.some((p) => !(p > 0))) return null

  const sum = parts.reduce((a, b) => a + b, 0)
  const quotas = parts.map((p) => (p / sum) * total)
  const drops = quotas.map((q) => Math.floor(q + EPSILON))

  // Hand the leftover drops to the largest remainders. Ties go to the oil
  // with more parts, then to the earlier oil, so results are repeatable.
  const order = quotas
    .map((q, i) => ({ i, remainder: q - drops[i] }))
    .sort(
      (x, y) =>
        (Math.abs(y.remainder - x.remainder) > EPSILON
          ? y.remainder - x.remainder
          : 0) ||
        parts[y.i] - parts[x.i] ||
        x.i - y.i,
    )
  let left = total - drops.reduce((a, b) => a + b, 0)
  for (let k = 0; left > 0; k = (k + 1) % n) {
    drops[order[k].i] += 1
    left -= 1
  }

  // Every oil gets at least 1 drop, taken from whichever oil has the most.
  // When two oils have the most, the one with fewer parts gives up the drop.
  for (let i = 0; i < n; i++) {
    if (drops[i] > 0) continue
    let donor = -1
    for (let j = 0; j < n; j++) {
      if (drops[j] <= 1) continue
      if (
        donor === -1 ||
        drops[j] > drops[donor] ||
        (drops[j] === drops[donor] && parts[j] <= parts[donor])
      ) {
        donor = j
      }
    }
    if (donor === -1) return null
    drops[donor] -= 1
    drops[i] += 1
  }
  return drops
}

export interface CalcInput {
  method: Method
  items: readonly BlendItem[]
  /** Carrier oil volume for a roller or massage oil, water capacity for a diffuser. */
  volumeMl: number
  /** Needed for roller and massage, for example 2 for 2%. */
  dilutionPct?: number
  dropsPerMl: number
  /**
   * A total set by hand, replacing the default for the size and dilution.
   * On a skin blend a total above the chosen dilution is allowed but warned
   * about.
   */
  totalDropsOverride?: number
  oils: OilIndex
}

export interface DropLine {
  oilId: string
  parts: number
  drops: number
  /** This oil's share of a skin blend, in percent. Undefined for a diffuser. */
  pct?: number
  /** The most drops this oil may have at this size, when it has a skin maximum. */
  maxDrops?: number
}

export type CalcWarningCode =
  | 'too-many-oils'
  | 'missing-dilution'
  | 'over-dilution'
  | 'lowered-to-skin-max'
  | 'removed-over-skin-max'

export interface CalcWarning {
  code: CalcWarningCode
  oilId?: string
  message: string
}

export interface CalcResult {
  method: Method
  /** The total the size and dilution call for. */
  targetDrops: number
  /** What the lines actually add up to. Lower than the target after a skin cap. */
  totalDrops: number
  /** The blend's real dilution on skin, in percent. Undefined for a diffuser. */
  actualDilutionPct?: number
  lines: DropLine[]
  warnings: CalcWarning[]
}

/** An oil's concentration in a skin blend, in percent of the carrier. */
export function skinPct(drops: number, volumeMl: number, dropsPerMl: number): number {
  const carrierDrops = volumeMl * dropsPerMl
  return carrierDrops > 0 ? (drops / carrierDrops) * 100 : 0
}

const trimPct = (pct: number): string => String(Number(pct.toFixed(2)))

/** Turns a blend's parts into whole drops per oil for a method and size. */
export function calculateDrops(input: CalcInput): CalcResult {
  const { method, volumeMl, dropsPerMl, oils } = input
  const items = input.items.filter((item) => item.parts > 0)
  const warnings: CalcWarning[] = []
  const skin = isSkinMethod(method)

  let targetDrops: number
  let missingDilution = false
  if (input.totalDropsOverride !== undefined) {
    targetDrops = input.totalDropsOverride
  } else if (!skin) {
    targetDrops = diffuserDefaultDrops(volumeMl)
  } else if (input.dilutionPct === undefined) {
    targetDrops = 0
    missingDilution = true
    warnings.push({
      code: 'missing-dilution',
      message: 'Pick a dilution to get drop counts.',
    })
  } else {
    targetDrops = topicalTotalDrops(volumeMl, dropsPerMl, input.dilutionPct)
  }
  targetDrops = Math.max(0, Math.floor(targetDrops + EPSILON))

  const split = missingDilution
    ? null
    : distributeDrops(
        items.map((item) => item.parts),
        targetDrops,
      )
  if (split === null && !missingDilution && items.length > 0) {
    warnings.push({ code: 'too-many-oils', message: TOO_MANY_OILS_MESSAGE })
  }

  const lines: DropLine[] = items.map((item, i) => ({
    oilId: item.oilId,
    parts: item.parts,
    drops: split ? split[i] : 0,
  }))

  if (skin) {
    const carrierDrops = volumeMl * dropsPerMl
    for (const line of lines) {
      const oil = oils.get(line.oilId)
      const max = oil?.safety.dermalMaxPct
      const allowed =
        max === undefined ? undefined : Math.max(0, Math.floor((max / 100) * carrierDrops + EPSILON))
      if (allowed !== undefined) line.maxDrops = allowed
      if (oil && max !== undefined && allowed !== undefined && line.drops > allowed) {
        if (allowed === 0) {
          warnings.push({
            code: 'removed-over-skin-max',
            oilId: line.oilId,
            message: `${oil.name} can't go in this size: even 1 drop is over its ${trimPct(max)}% skin limit.`,
          })
        } else {
          warnings.push({
            code: 'lowered-to-skin-max',
            oilId: line.oilId,
            message: `${oil.name} lowered from ${line.drops} to ${allowed} ${allowed === 1 ? 'drop' : 'drops'} to stay within its ${trimPct(max)}% skin limit.`,
          })
        }
        line.drops = allowed
      }
      line.pct = skinPct(line.drops, volumeMl, dropsPerMl)
    }
  }

  const totalDrops = lines.reduce((sum, line) => sum + line.drops, 0)
  const actualDilutionPct = skin ? skinPct(totalDrops, volumeMl, dropsPerMl) : undefined

  // A hand-set total can go past the dilution that was picked.
  if (
    skin &&
    input.dilutionPct !== undefined &&
    actualDilutionPct !== undefined &&
    actualDilutionPct > input.dilutionPct + 1e-6
  ) {
    warnings.push({
      code: 'over-dilution',
      message: `${totalDrops} drops in ${trimPct(volumeMl)} ml is ${trimPct(actualDilutionPct)}%, over the ${trimPct(input.dilutionPct)}% you picked.`,
    })
  }

  return { method, targetDrops, totalDrops, actualDilutionPct, lines, warnings }
}
