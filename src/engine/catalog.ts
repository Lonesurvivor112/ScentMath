import type { Family, Intensity, Mood, Note, Oil } from '../data/schema'
import type { ResolvedOil } from './resolve'

/**
 * Finding oils in the library and making new ones. Used by the "Add oil"
 * flow: search, quick-add chips and the custom oil form.
 */

/** Shown as quick-add chips before the user types anything. */
export const POPULAR_OIL_IDS: readonly string[] = [
  'lavender',
  'peppermint',
  'lemon',
  'tea-tree',
  'sweet-orange',
  'eucalyptus-globulus',
  'frankincense-carteri',
  'rosemary-cineole',
  'cedarwood-atlas',
  'bergamot',
]

/** Lowercase, accents and punctuation removed, single spaces. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Oils matching a search, best match first. Every word typed must appear in
 * the oil's name, Latin name or brand. Names that start with the search come
 * first, then names with a word that starts with it, then the rest. An empty
 * search returns every oil in name order.
 */
export function searchOils(
  query: string,
  oils: Iterable<ResolvedOil>,
  limit = 50,
): ResolvedOil[] {
  const needle = normalizeText(query)
  const words = needle.length > 0 ? needle.split(' ') : []
  const ranked: { oil: ResolvedOil; rank: number }[] = []

  for (const oil of oils) {
    const name = normalizeText(oil.name)
    if (words.length === 0) {
      ranked.push({ oil, rank: 0 })
      continue
    }
    const haystack = `${name} ${normalizeText(oil.latinName ?? '')} ${normalizeText(oil.brand ?? '')}`
    if (!words.every((word) => haystack.includes(word))) continue
    let rank = 3
    if (name.startsWith(needle)) rank = 0
    else if (name.split(' ').some((part) => part.startsWith(words[0]))) rank = 1
    else if (name.includes(words[0])) rank = 2
    ranked.push({ oil, rank })
  }

  ranked.sort((a, b) => a.rank - b.rank || a.oil.name.localeCompare(b.oil.name))
  return ranked.slice(0, Math.max(0, limit)).map((entry) => entry.oil)
}

/** A lowercase-kebab-case slug, or "oil" if nothing usable is left. */
export function slugify(name: string): string {
  return normalizeText(name).replace(/ /g, '-') || 'oil'
}

/** An id for a user-made oil that doesn't clash with any existing id. */
export function makeCustomOilId(name: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds)
  const base = `custom-${slugify(name)}`
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export interface CustomOilInput {
  name: string
  kind: 'single' | 'blend'
  brand?: string
  /** One or two families. Needed for a single oil, optional for a blend. */
  families?: Family[]
  note?: Note
  intensity?: Intensity
  moods?: Mood[]
  /** Library oil ids inside a blend. */
  components?: string[]
}

export type CustomOilResult = { ok: true; oil: Oil } | { ok: false; error: string }

/**
 * Builds an oil from the custom oil form. A custom oil is never marked as
 * reviewed, so the app treats its safety as unknown and stays cautious.
 */
export function buildCustomOil(
  input: CustomOilInput,
  existingIds: Iterable<string>,
): CustomOilResult {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length === 0) return { ok: false, error: 'Give the oil a name.' }
  const families = [...new Set(input.families ?? [])]
  if (families.length > 2) return { ok: false, error: 'Pick one or two scent families.' }

  const base = {
    id: makeCustomOilId(name, existingIds),
    name,
    moods: [...new Set(input.moods ?? [])],
    affinities: [],
    safety: {
      review: 'none' as const,
      source: 'Added by you. Safety values have not been checked.',
    },
  }

  if (input.kind === 'single') {
    if (families.length === 0) return { ok: false, error: 'Pick one or two scent families.' }
    return {
      ok: true,
      oil: {
        ...base,
        kind: 'single',
        families,
        note: input.note ?? 'middle',
        intensity: input.intensity ?? 3,
      },
    }
  }

  const components = [...new Set(input.components ?? [])]
  if (components.length === 0 && families.length === 0) {
    return {
      ok: false,
      error: 'Add the oils in this blend from its label, or pick a scent family.',
    }
  }
  const brand = input.brand?.trim()
  return {
    ok: true,
    oil: {
      ...base,
      kind: 'blend',
      ...(brand ? { brand } : {}),
      components,
      ...(families.length > 0 ? { families } : {}),
      ...(input.note ? { note: input.note } : {}),
      ...(input.intensity ? { intensity: input.intensity } : {}),
    },
  }
}
