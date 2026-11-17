import { useState } from 'react'
import { AboutOil } from '../components/AboutOil'
import { Sheet } from '../components/Sheet'
import { SizePicker } from '../components/SizePicker'
import { GetMoreIcon, MinusIcon, PlusIcon, RestockIcon, TrashIcon } from '../components/icons'
import { FAMILY_LABELS, NOTE_LABELS } from '../data/labels'
import type { ResolvedOil } from '../engine/resolve'
import type { ShelfRow } from '../store/db'
import { useShelf } from '../store/shelf'

interface ShelfItemSheetProps {
  row: ShelfRow
  oil: ResolvedOil | undefined
  onClose: () => void
  /** Removal is handled by the shelf so it can offer Undo. */
  onRemove: (row: ShelfRow) => void
}

const fieldClass =
  'mt-1 h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100'

/** Details for one shelf entry: bottles, size, brand, opened date and notes. */
export function ShelfItemSheet({ row, oil, onClose, onRemove }: ShelfItemSheetProps) {
  const updateItem = useShelf((state) => state.updateItem)
  const setEmpty = useShelf((state) => state.setEmpty)
  const [brand, setBrand] = useState(row.brand ?? '')
  const [notes, setNotes] = useState(row.notes ?? '')

  const name = oil?.name ?? row.oilId
  const subtitle = oil
    ? [
        oil.kind === 'blend' ? 'Blend' : null,
        oil.families.map((f) => FAMILY_LABELS[f]).join(', ') || null,
        `${NOTE_LABELS[oil.note]} note`,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Not in the library'

  const setCount = (count: number) => void updateItem(row.id, { count: Math.max(1, count) })

  return (
    <Sheet title={name} subtitle={subtitle} onClose={onClose}>
      <div className="space-y-5 pt-1">
        {row.empty && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 ring-1 ring-amber-200">
            Empty. On your Get more list.
          </p>
        )}

        {oil && <AboutOil oil={oil} />}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">Bottles</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCount(row.count - 1)}
              disabled={row.count <= 1}
              aria-label="One bottle fewer"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-800 disabled:opacity-40"
            >
              <MinusIcon />
            </button>
            <span aria-live="polite" className="w-8 text-center text-lg font-semibold text-stone-900">
              {row.count}
            </span>
            <button
              type="button"
              onClick={() => setCount(row.count + 1)}
              aria-label="One bottle more"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-800"
            >
              <PlusIcon />
            </button>
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-stone-700">Bottle size</p>
          <SizePicker value={row.sizeMl} onChange={(sizeMl) => void updateItem(row.id, { sizeMl })} />
        </div>

        <label className="block text-sm font-medium text-stone-700">
          Brand
          <input
            type="text"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            onBlur={() => void updateItem(row.id, { brand: brand.trim() || undefined })}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Opened on
          <input
            type="date"
            value={row.openedOn ?? ''}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => void updateItem(row.id, { openedOn: event.target.value || undefined })}
            className={fieldClass}
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">
            Citrus and tea tree get an "old bottle" badge about a year after opening.
          </span>
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Notes
          <textarea
            value={notes}
            rows={2}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => void updateItem(row.id, { notes: notes.trim() || undefined })}
            className={`${fieldClass} h-auto py-2`}
          />
        </label>

        <div className="space-y-2 border-t border-stone-200 pt-4">
          <button
            type="button"
            onClick={() => {
              void setEmpty(row.id, !row.empty)
              onClose()
            }}
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold ${
              row.empty ? 'bg-brand-700 text-white' : 'bg-amber-100 text-amber-950'
            }`}
          >
            {row.empty ? <RestockIcon /> : <GetMoreIcon />}
            {row.empty ? 'Back in stock' : 'Ran out. Add to Get more'}
          </button>
          <button
            type="button"
            onClick={() => {
              onRemove(row)
              onClose()
            }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-red-700 ring-1 ring-red-200"
          >
            <TrashIcon />
            Remove from shelf
          </button>
        </div>
      </div>
    </Sheet>
  )
}
