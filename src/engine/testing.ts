import { COMPATIBILITY, OILS, OIL_INDEX } from '../data'
import type { Oil, Safety } from '../data/schema'
import { makeCompat } from './harmony'
import { buildOilIndex, type OilIndex, type ResolvedOil } from './resolve'
import type { HouseholdProfile } from './safety'

/** Shared fixtures for the engine tests. Not used by the app. */

export const compat = makeCompat(COMPATIBILITY)

export const NO_HOUSEHOLD: HouseholdProfile = {
  pregnant: false,
  cats: false,
  dogs: false,
}

/** A repeatable stand-in for Math.random, so tests of random features are stable. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Looks up a library oil and fails loudly on a typo. */
export function oil(id: string, index: OilIndex = OIL_INDEX): ResolvedOil {
  const found = index.get(id)
  if (!found) throw new Error(`No oil "${id}" in the index.`)
  return found
}

/**
 * The library plus a blend the user typed in themselves: nothing reviewed,
 * so its cautions come from its components.
 */
export function withCustomBlend(id: string, name: string, components: string[]): OilIndex {
  const blend: Oil = {
    id,
    name,
    kind: 'blend',
    moods: [],
    affinities: [],
    components,
    safety: { review: 'none', source: 'test' },
  }
  return buildOilIndex([...OILS, blend])
}

/**
 * A copy of the library with one oil's safety fields replaced. The numbers
 * tests pass in here are made up to exercise the rules. They are not real
 * limits and never ship in oils.json.
 */
export function withSafety(id: string, safety: Partial<Safety>): OilIndex {
  const index = new Map(OIL_INDEX)
  const original = oil(id)
  index.set(id, {
    ...original,
    safety: { ...original.safety, ...safety },
  })
  return index
}
