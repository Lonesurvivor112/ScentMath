import Dexie, { type EntityTable } from 'dexie'
import type { BarcodeEntry, Blend, Oil, ShelfItem } from '../data/schema'

/** A shelf entry as stored on the device. `id` is assigned by IndexedDB. */
export interface ShelfRow extends ShelfItem {
  id: number
}

/** Small key/value records: the household profile and one-time setup flags. */
export interface MetaRow {
  key: string
  value: unknown
}

/**
 * Everything the user creates stays on the device in IndexedDB. All tables
 * are declared up front so later phases don't need a schema migration.
 */
export const db = new Dexie('scentmath') as Dexie & {
  shelf: EntityTable<ShelfRow, 'id'>
  blends: EntityTable<Blend, 'id'>
  customOils: EntityTable<Oil, 'id'>
  meta: EntityTable<MetaRow, 'key'>
  /** Barcodes the user matched to an oil by hand, remembered for next time. */
  barcodes: EntityTable<BarcodeEntry, 'code'>
}

db.version(1).stores({
  shelf: '++id, oilId',
  blends: 'id, createdAt',
  customOils: 'id',
  meta: 'key',
})

db.version(2).stores({
  barcodes: 'code',
})
