import { useMemo } from 'react'
import { create } from 'zustand'
import { BARCODES, OILS, OIL_INDEX } from '../data'
import { BarcodeEntrySchema, OilSchema, type BarcodeEntry, type Oil } from '../data/schema'
import { buildBarcodeIndex, type BarcodeIndex } from '../engine/barcode'
import { buildOilIndex, type OilIndex } from '../engine/resolve'
import { db } from './db'

/**
 * What the user has added to the library on this device: their own oils and
 * blends, and barcodes they matched to an oil by hand.
 */
interface OilsState {
  customOils: Oil[]
  learnedBarcodes: BarcodeEntry[]
  loaded: boolean
  load: () => Promise<void>
  addCustomOil: (oil: Oil) => Promise<void>
  /** Remembers which oil a barcode belongs to, so the next scan is instant. */
  learnBarcode: (entry: BarcodeEntry) => Promise<void>
}

let loading: Promise<void> | null = null

export const useOils = create<OilsState>((set, get) => ({
  customOils: [],
  learnedBarcodes: [],
  loaded: false,

  load: () => {
    if (!loading) {
      loading = Promise.all([db.customOils.toArray(), db.barcodes.toArray()])
        .then(([oils, barcodes]) => {
          // Skip anything that no longer fits the schema rather than crash.
          set({
            customOils: oils.filter((oil) => OilSchema.safeParse(oil).success),
            learnedBarcodes: barcodes.filter((b) => BarcodeEntrySchema.safeParse(b).success),
            loaded: true,
          })
        })
        .catch(() => {
          loading = null
          set({ loaded: true })
        })
    }
    return loading
  },

  addCustomOil: async (oil) => {
    await db.customOils.put(oil)
    set({ customOils: [...get().customOils.filter((o) => o.id !== oil.id), oil] })
  },

  learnBarcode: async (entry) => {
    await db.barcodes.put(entry)
    set({
      learnedBarcodes: [...get().learnedBarcodes.filter((b) => b.code !== entry.code), entry],
    })
  },
}))

/** The library plus the user's own oils, resolved for the engine. */
export function useOilIndex(): OilIndex {
  const customOils = useOils((state) => state.customOils)
  return useMemo(
    () => (customOils.length === 0 ? OIL_INDEX : buildOilIndex([...OILS, ...customOils])),
    [customOils],
  )
}

/** Shipped barcodes plus the ones learned on this device. */
export function useBarcodeIndex(): BarcodeIndex {
  const learned = useOils((state) => state.learnedBarcodes)
  return useMemo(() => buildBarcodeIndex(BARCODES, learned), [learned])
}
