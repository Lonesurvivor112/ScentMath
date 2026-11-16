import { create } from 'zustand'
import { STARTER_SHELF } from '../data'
import type { ShelfItem } from '../data/schema'
import { findMatchingItem } from '../engine/shelf'
import { db, type ShelfRow } from './db'

const SEEDED_KEY = 'starterShelfSeeded'

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** A bottle being added: which oil, and what is known about the bottle. */
export type NewBottle = Pick<ShelfItem, 'oilId' | 'sizeMl'> &
  Partial<Pick<ShelfItem, 'brand' | 'count' | 'notes' | 'barcode'>>

/** What an add did, with a way to take it back. */
export interface AddResult {
  row: ShelfRow
  /** True when the bottle joined an entry that was already on the shelf. */
  merged: boolean
  undo: () => Promise<void>
}

interface ShelfState {
  items: ShelfRow[]
  status: Status
  error: string | null
  /** Reads the shelf from the device, adding the starter shelf on first run. */
  load: () => Promise<void>
  /** Adds a bottle, joining a matching entry instead of duplicating it. */
  addBottle: (bottle: NewBottle) => Promise<AddResult>
  updateItem: (id: number, patch: Partial<ShelfItem>) => Promise<void>
  /** Removes an entry and returns it, so the removal can be undone. */
  removeItem: (id: number) => Promise<ShelfRow | undefined>
  /** Puts back an entry that was removed. */
  restoreItem: (row: ShelfRow) => Promise<void>
  /** Marks an entry as run out (stays on the shelf as "Get more") or back in stock. */
  setEmpty: (id: number, empty: boolean) => Promise<void>
}

/** One shared load, so React StrictMode's double effect can't seed twice. */
let loading: Promise<void> | null = null

async function readShelf(): Promise<ShelfRow[]> {
  await db.transaction('rw', db.shelf, db.meta, async () => {
    const seeded = await db.meta.get(SEEDED_KEY)
    if (!seeded) {
      await db.shelf.bulkAdd(STARTER_SHELF)
      await db.meta.put({ key: SEEDED_KEY, value: true })
    }
  })
  return db.shelf.toArray()
}

/** Drops keys whose value is undefined, so they are removed from the stored row. */
function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T
}

export const useShelf = create<ShelfState>((set, get) => {
  const replaceRow = (row: ShelfRow) =>
    set({ items: get().items.map((item) => (item.id === row.id ? row : item)) })

  const putRow = async (row: ShelfRow) => {
    const clean = withoutUndefined(row)
    await db.shelf.put(clean)
    replaceRow(clean)
  }

  return {
    items: [],
    status: 'idle',
    error: null,

    load: () => {
      if (!loading) {
        set({ status: 'loading', error: null })
        loading = readShelf()
          .then((items) => set({ items, status: 'ready' }))
          .catch((cause: unknown) => {
            loading = null
            set({
              status: 'error',
              error: cause instanceof Error ? cause.message : 'Could not open the shelf.',
            })
          })
      }
      return loading
    },

    addBottle: async (bottle) => {
      const count = Math.max(1, Math.floor(bottle.count ?? 1))
      const existing = findMatchingItem(get().items, bottle)

      if (existing) {
        const before = existing
        const after: ShelfRow = {
          ...existing,
          // A new bottle of an oil that had run out restocks it.
          count: existing.empty ? count : existing.count + count,
          empty: undefined,
          barcode: existing.barcode ?? bottle.barcode,
        }
        await putRow(after)
        return { row: after, merged: true, undo: () => putRow(before) }
      }

      const fresh = withoutUndefined({
        oilId: bottle.oilId,
        brand: bottle.brand?.trim() || undefined,
        sizeMl: bottle.sizeMl,
        count,
        notes: bottle.notes,
        barcode: bottle.barcode,
      })
      const id = await db.shelf.add(fresh)
      const row: ShelfRow = { ...fresh, id }
      set({ items: [...get().items, row] })
      return {
        row,
        merged: false,
        undo: async () => {
          await get().removeItem(id)
        },
      }
    },

    updateItem: async (id, patch) => {
      const current = get().items.find((item) => item.id === id)
      if (!current) return
      await putRow({ ...current, ...patch, id })
    },

    removeItem: async (id) => {
      const row = get().items.find((item) => item.id === id)
      if (!row) return undefined
      await db.shelf.delete(id)
      set({ items: get().items.filter((item) => item.id !== id) })
      return row
    },

    restoreItem: async (row) => {
      await db.shelf.put(row)
      const others = get().items.filter((item) => item.id !== row.id)
      set({ items: [...others, row].sort((a, b) => a.id - b.id) })
    },

    setEmpty: async (id, empty) => {
      const current = get().items.find((item) => item.id === id)
      if (!current) return
      await putRow({ ...current, empty: empty ? true : undefined })
    },
  }
})
