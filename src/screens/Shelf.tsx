import { useCallback, useEffect, useMemo, useState } from 'react'
import { OilCap, capBackground } from '../components/OilCap'
import { Toast } from '../components/Toast'
import { PlusIcon, RestockIcon, TrashIcon } from '../components/icons'
import { FAMILY_COLORS, FAMILY_LABELS } from '../data/labels'
import { FAMILIES, type Family } from '../data/schema'
import type { OilIndex, ResolvedOil } from '../engine/resolve'
import { OLD_BOTTLE_BADGE, isBottleOld } from '../engine/safety'
import { getMoreItems, shelfSummary, shoppingListText } from '../engine/shelf'
import type { ShelfRow } from '../store/db'
import { useOilIndex } from '../store/oils'
import { useShelf } from '../store/shelf'
import { AddOil } from './AddOil'
import { ShelfItemSheet } from './ShelfItemSheet'

interface ShelfEntry {
  row: ShelfRow
  oil: ResolvedOil | undefined
}

type GroupKey = Family | 'unknown'
type Filter = 'all' | 'get-more' | GroupKey

interface ToastState {
  message: string
  undo?: () => void
}

const TOAST_MS = 6000

function groupByFamily(items: readonly ShelfRow[], oils: OilIndex): Map<GroupKey, ShelfEntry[]> {
  const groups = new Map<GroupKey, ShelfEntry[]>()
  for (const row of items) {
    const oil = oils.get(row.oilId)
    const key: GroupKey = oil?.families[0] ?? 'unknown'
    const group = groups.get(key) ?? []
    group.push({ row, oil })
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    group.sort((a, b) =>
      (a.oil?.name ?? a.row.oilId).localeCompare(b.oil?.name ?? b.row.oilId),
    )
  }
  return groups
}

const groupTitle = (key: GroupKey): string =>
  key === 'unknown' ? 'Other' : FAMILY_LABELS[key]
const groupColor = (key: GroupKey): string =>
  key === 'unknown' ? '#A8A29E' : FAMILY_COLORS[key]

export function Shelf() {
  const items = useShelf((state) => state.items)
  const status = useShelf((state) => state.status)
  const error = useShelf((state) => state.error)
  const load = useShelf((state) => state.load)
  const removeItem = useShelf((state) => state.removeItem)
  const restoreItem = useShelf((state) => state.restoreItem)
  const setEmpty = useShelf((state) => state.setEmpty)
  const oils = useOilIndex()

  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const groups = useMemo(() => groupByFamily(items, oils), [items, oils])
  const summary = useMemo(() => shelfSummary(items), [items])
  const toGet = useMemo(() => getMoreItems(items), [items])
  const today = useMemo(() => new Date(), [])
  const order: GroupKey[] = [...FAMILIES, 'unknown']
  const present = order.filter((key) => groups.has(key))

  // A filter can point at something that no longer exists after a removal.
  const active: Filter =
    filter === 'all' ||
    (filter === 'get-more' ? toGet.length > 0 : groups.has(filter))
      ? filter
      : 'all'

  const nameOf = useCallback((oilId: string) => oils.get(oilId)?.name ?? oilId, [oils])

  const remove = useCallback(
    async (row: ShelfRow) => {
      const removed = await removeItem(row.id)
      if (!removed) return
      setToast({
        message: `Removed ${nameOf(row.oilId)}`,
        undo: () => {
          void restoreItem(removed)
          setToast(null)
        },
      })
    },
    [removeItem, restoreItem, nameOf],
  )

  const toggleEmpty = useCallback(
    async (row: ShelfRow) => {
      const nowEmpty = !row.empty
      await setEmpty(row.id, nowEmpty)
      setToast({
        message: nowEmpty
          ? `${nameOf(row.oilId)} moved to Get more`
          : `${nameOf(row.oilId)} is back in stock`,
        undo: () => {
          void setEmpty(row.id, !nowEmpty)
          setToast(null)
        },
      })
    },
    [setEmpty, nameOf],
  )

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingListText(items, nameOf))
      setToast({ message: 'Get more list copied' })
    } catch {
      setToast({ message: "The list couldn't be copied" })
    }
  }

  const openRow = openId === null ? undefined : items.find((item) => item.id === openId)
  const chips: { key: Filter; label: string; color?: string }[] = [
    { key: 'all', label: 'All' },
    ...(toGet.length > 0 ? [{ key: 'get-more' as const, label: `Get more (${toGet.length})` }] : []),
    ...present.map((key) => ({ key, label: groupTitle(key), color: groupColor(key) })),
  ]

  return (
    <section aria-labelledby="shelf-heading" className="px-4 pt-6 pb-6">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 id="shelf-heading" className="text-2xl font-semibold text-brand-900">
            My Shelf
          </h1>
          {status === 'ready' && (
            <p className="mt-1 text-sm text-stone-600">
              {summary.oils} {summary.oils === 1 ? 'oil' : 'oils'} · {summary.bottles}{' '}
              {summary.bottles === 1 ? 'bottle' : 'bottles'}
              {summary.toGet > 0 && ` · ${summary.toGet} to get`}
            </p>
          )}
        </div>
        {status === 'ready' && (
          <div className="flex shrink-0 gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setEditing((on) => !on)}
                aria-pressed={editing}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                  editing ? 'bg-stone-900 text-white' : 'bg-white text-stone-800 ring-1 ring-stone-300'
                }`}
              >
                {editing ? 'Done' : 'Edit'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex min-h-11 items-center gap-1 rounded-xl bg-brand-700 pr-4 pl-3 text-sm font-semibold text-white"
            >
              <PlusIcon size={18} />
              Add oil
            </button>
          </div>
        )}
      </header>

      {(status === 'idle' || status === 'loading') && (
        <p role="status" className="text-sm text-stone-600">
          Opening your shelf…
        </p>
      )}

      {status === 'error' && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Your shelf couldn't be opened.</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 min-h-11 rounded-lg bg-red-900 px-4 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200">
          <p className="text-base font-semibold text-stone-900">Your shelf is empty</p>
          <p className="mt-1 text-sm text-stone-600">
            Add the oils you own by searching, scanning their barcodes, or typing in your own.
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 min-h-12 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white"
          >
            Add your first oil
          </button>
        </div>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <ul aria-label="Filter the shelf" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {chips.map((chip) => (
              <li key={chip.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setFilter(chip.key)}
                  aria-pressed={active === chip.key}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
                    active === chip.key
                      ? 'border-brand-700 bg-brand-700 text-white'
                      : chip.key === 'get-more'
                        ? 'border-amber-300 bg-amber-50 text-amber-950'
                        : 'border-stone-300 bg-white text-stone-800'
                  }`}
                >
                  {chip.color && (
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full ring-1 ring-white/60" style={{ background: chip.color }} />
                  )}
                  {chip.label}
                </button>
              </li>
            ))}
          </ul>

          {editing && active !== 'get-more' && (
            <p className="mb-3 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-700">
              Under each oil: the basket marks it as run out and keeps it on your Get more list. The
              bin removes it from your shelf.
            </p>
          )}

          {active === 'get-more' ? (
            <section aria-labelledby="get-more-heading">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="get-more-heading" className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
                  Get more
                </h2>
                <button
                  type="button"
                  onClick={() => void copyList()}
                  className="min-h-11 rounded-xl px-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-600"
                >
                  Copy list
                </button>
              </div>
              <ul className="space-y-2">
                {toGet
                  .map((row) => ({ row, oil: oils.get(row.oilId) }))
                  .sort((a, b) => nameOf(a.row.oilId).localeCompare(nameOf(b.row.oilId)))
                  .map(({ row, oil }) => (
                    <li key={row.id} className="flex items-center gap-3 rounded-2xl bg-white p-2 pl-3 shadow-sm ring-1 ring-stone-200">
                      <span
                        aria-hidden="true"
                        className="h-9 w-9 shrink-0 rounded-full opacity-40 grayscale"
                        style={{ background: capBackground(oil?.families ?? []) }}
                      />
                      <button type="button" onClick={() => setOpenId(row.id)} className="min-h-11 min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium text-stone-900">{nameOf(row.oilId)}</span>
                        <span className="block truncate text-xs text-stone-500">
                          {[row.brand, `${row.sizeMl} ml`].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleEmpty(row)}
                        aria-label={`${nameOf(row.oilId)} is back in stock`}
                        className="flex min-h-11 items-center gap-1 rounded-xl bg-brand-700 px-3 text-sm font-semibold text-white"
                      >
                        <RestockIcon size={18} />
                        Got it
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(row)}
                        aria-label={`Remove ${nameOf(row.oilId)} from your shelf`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700"
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ) : (
            present
              .filter((key) => active === 'all' || active === key)
              .map((key) => {
                const group = groups.get(key) ?? []
                return (
                  <section key={key} aria-labelledby={`family-${key}`} className="mb-6">
                    <h2
                      id={`family-${key}`}
                      className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-stone-700 uppercase"
                    >
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: groupColor(key) }} />
                      {groupTitle(key)}
                      <span className="font-normal text-stone-500">{group.length}</span>
                    </h2>
                    <ul className="grid grid-cols-3 gap-2.5">
                      {group.map(({ row, oil }) => (
                        <OilCap
                          key={row.id}
                          name={oil?.name ?? row.oilId}
                          families={oil?.families ?? []}
                          count={row.count}
                          brand={row.brand}
                          isBlend={oil?.kind === 'blend'}
                          empty={row.empty}
                          badge={oil && isBottleOld(row, oil, oils, today) ? OLD_BOTTLE_BADGE : undefined}
                          onOpen={() => setOpenId(row.id)}
                          editing={editing}
                          onToggleEmpty={() => void toggleEmpty(row)}
                          onRemove={() => void remove(row)}
                        />
                      ))}
                    </ul>
                  </section>
                )
              })
          )}
        </>
      )}

      {openRow && (
        <ShelfItemSheet
          key={openRow.id}
          row={openRow}
          oil={oils.get(openRow.oilId)}
          onClose={() => setOpenId(null)}
          onRemove={(row) => void remove(row)}
        />
      )}

      {adding && <AddOil onClose={() => setAdding(false)} />}

      {toast && (
        <Toast message={toast.message} actionLabel={toast.undo ? 'Undo' : undefined} onAction={toast.undo} />
      )}
    </section>
  )
}
