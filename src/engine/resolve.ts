import {
  FAMILIES,
  type BrandBlend,
  type Family,
  type Intensity,
  type Mood,
  type Note,
  type Oil,
  type Safety,
  type SingleOil,
} from '../data/schema'

/**
 * An oil in the shape the engine works with. Single oils pass straight
 * through. Brand blends get their families, note and intensity worked out
 * from their components.
 */
export interface ResolvedOil {
  id: string
  name: string
  latinName?: string
  /** The maker of a brand blend. */
  brand?: string
  kind: 'single' | 'blend'
  families: Family[]
  note: Note
  intensity: Intensity
  moods: Mood[]
  affinities: string[]
  safety: Safety
  /** Single-oil ids inside a brand blend. Empty for single oils. */
  components: string[]
  /** True for a brand blend with no families set and no usable components. */
  incomplete: boolean
}

export type OilIndex = ReadonlyMap<string, ResolvedOil>

/** Used when a brand blend has nothing to derive from. */
const FALLBACK_NOTE: Note = 'middle'
const FALLBACK_INTENSITY: Intensity = 3

/** Tie-break order when two notes are equally common in a blend. */
const NOTE_TIE_ORDER: readonly Note[] = ['middle', 'top', 'base']

function resolveSingle(oil: SingleOil): ResolvedOil {
  return {
    id: oil.id,
    name: oil.name,
    latinName: oil.latinName,
    kind: 'single',
    families: [...oil.families],
    note: oil.note,
    intensity: oil.intensity,
    moods: [...oil.moods],
    affinities: [...oil.affinities],
    safety: oil.safety,
    components: [],
    incomplete: false,
  }
}

/**
 * The one or two families that best describe a set of component oils. Each
 * component has one vote, split evenly across its own families. The second
 * family is only kept when it has at least half the votes of the first.
 */
export function deriveFamilies(components: readonly SingleOil[]): Family[] {
  const votes = new Map<Family, number>()
  for (const component of components) {
    const share = 1 / component.families.length
    for (const family of component.families) {
      votes.set(family, (votes.get(family) ?? 0) + share)
    }
  }
  const ranked = FAMILIES.filter((f) => votes.has(f)).sort(
    (a, b) =>
      (votes.get(b) ?? 0) - (votes.get(a) ?? 0) ||
      FAMILIES.indexOf(a) - FAMILIES.indexOf(b),
  )
  if (ranked.length <= 1) return ranked
  const [first, second] = ranked
  const keepSecond = (votes.get(second) ?? 0) >= (votes.get(first) ?? 0) / 2
  return keepSecond ? [first, second] : [first]
}

/** The most common note among the components. Ties go to middle, then top. */
export function deriveNote(components: readonly SingleOil[]): Note {
  if (components.length === 0) return FALLBACK_NOTE
  const counts: Record<Note, number> = { top: 0, middle: 0, base: 0 }
  for (const component of components) counts[component.note] += 1
  let best: Note = NOTE_TIE_ORDER[0]
  for (const note of NOTE_TIE_ORDER) {
    if (counts[note] > counts[best]) best = note
  }
  return best
}

/** The average component intensity, rounded to a whole step from 1 to 5. */
export function deriveIntensity(components: readonly SingleOil[]): Intensity {
  if (components.length === 0) return FALLBACK_INTENSITY
  const mean =
    components.reduce((sum, c) => sum + c.intensity, 0) / components.length
  return Math.min(5, Math.max(1, Math.round(mean))) as Intensity
}

function resolveBlend(
  oil: BrandBlend,
  rawById: ReadonlyMap<string, Oil>,
): ResolvedOil {
  const components: SingleOil[] = []
  for (const id of oil.components) {
    const component = rawById.get(id)
    if (component?.kind === 'single') components.push(component)
  }
  const families = oil.families ?? deriveFamilies(components)
  return {
    id: oil.id,
    name: oil.name,
    latinName: oil.latinName,
    brand: oil.brand,
    kind: 'blend',
    families: [...families],
    note: oil.note ?? deriveNote(components),
    intensity: oil.intensity ?? deriveIntensity(components),
    moods: [...oil.moods],
    affinities: [...oil.affinities],
    safety: oil.safety,
    components: components.map((c) => c.id),
    incomplete: families.length === 0,
  }
}

/** Resolves one oil. `rawById` is needed to look up a brand blend's components. */
export function resolveOil(
  oil: Oil,
  rawById: ReadonlyMap<string, Oil>,
): ResolvedOil {
  return oil.kind === 'single' ? resolveSingle(oil) : resolveBlend(oil, rawById)
}

/** Resolves a whole library into a lookup by oil id. */
export function buildOilIndex(oils: readonly Oil[]): Map<string, ResolvedOil> {
  const rawById = new Map(oils.map((oil) => [oil.id, oil] as const))
  const index = new Map<string, ResolvedOil>()
  for (const oil of oils) index.set(oil.id, resolveOil(oil, rawById))
  return index
}
