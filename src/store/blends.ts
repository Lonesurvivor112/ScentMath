import { create } from 'zustand'
import { BlendSchema, type Blend } from '../data/schema'
import { db } from './db'

interface BlendsState {
  blends: Blend[]
  loaded: boolean
  load: () => Promise<void>
  /** Adds a blend, or replaces the one with the same id. */
  save: (blend: Blend) => Promise<void>
  update: (id: string, patch: Partial<Blend>) => Promise<void>
  /** Removes a blend and returns it, so the removal can be undone. */
  remove: (id: string) => Promise<Blend | undefined>
  /** Saves a copy under a new id and name, and returns it. */
  duplicate: (id: string) => Promise<Blend | undefined>
}

let loading: Promise<void> | null = null

/** A new id. `randomUUID` needs a secure page, so there is a fallback. */
export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const newestFirst = (a: Blend, b: Blend) => b.createdAt.localeCompare(a.createdAt)

/** Drops keys whose value is undefined, so an optional field can be cleared. */
function clean(blend: Blend): Blend {
  return Object.fromEntries(
    Object.entries(blend).filter(([, value]) => value !== undefined),
  ) as Blend
}

/** Saved blends, kept on the device. */
export const useBlends = create<BlendsState>((set, get) => ({
  blends: [],
  loaded: false,

  load: () => {
    if (!loading) {
      loading = db.blends
        .toArray()
        .then((rows) =>
          set({
            blends: rows.filter((row) => BlendSchema.safeParse(row).success).sort(newestFirst),
            loaded: true,
          }),
        )
        .catch(() => {
          loading = null
          set({ loaded: true })
        })
    }
    return loading
  },

  save: async (blend) => {
    const row = clean(blend)
    await db.blends.put(row)
    set({ blends: [...get().blends.filter((b) => b.id !== row.id), row].sort(newestFirst) })
  },

  update: async (id, patch) => {
    const current = get().blends.find((b) => b.id === id)
    if (current) await get().save({ ...current, ...patch, id })
  },

  remove: async (id) => {
    const blend = get().blends.find((b) => b.id === id)
    if (!blend) return undefined
    await db.blends.delete(id)
    set({ blends: get().blends.filter((b) => b.id !== id) })
    return blend
  },

  duplicate: async (id) => {
    const original = get().blends.find((b) => b.id === id)
    if (!original) return undefined
    const copy: Blend = {
      ...original,
      id: newId(),
      name: `${original.name} (copy)`,
      createdAt: new Date().toISOString(),
    }
    await get().save(copy)
    return copy
  },
}))
