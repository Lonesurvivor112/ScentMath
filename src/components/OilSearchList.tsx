import { useMemo, useState } from 'react'
import { FAMILY_LABELS } from '../data/labels'
import { POPULAR_OIL_IDS, ingredientsLine, searchOils } from '../engine/catalog'
import type { OilIndex, ResolvedOil } from '../engine/resolve'
import type { ShelfRow } from '../store/db'
import { capBackground } from './OilCap'
import { ScentGuideButton } from './ScentGuide'
import { PlusIcon, SearchIcon } from './icons'

interface OilSearchListProps {
  index: OilIndex
  shelf: readonly ShelfRow[]
  /** The button on each row, for example "Add". */
  actionLabel: string
  onAction: (oil: ResolvedOil) => void
  /** How many times each oil's action has been used, shown on its button. */
  doneCounts?: ReadonlyMap<string, number>
  /** Shows quick-add chips for common oils before anything is typed. */
  showPopular?: boolean
  /** Offers to create a custom oil when the search finds nothing. */
  onCreate?: (name: string) => void
  /** Leaves some oils out, for example brand blends. */
  filter?: (oil: ResolvedOil) => boolean
  limit?: number
  placeholder?: string
}

function shelfStatus(oilId: string, shelf: readonly ShelfRow[]): string | null {
  const entries = shelf.filter((item) => item.oilId === oilId)
  if (entries.length === 0) return null
  const bottles = entries.filter((e) => !e.empty).reduce((sum, e) => sum + e.count, 0)
  return bottles === 0 ? 'On shelf, empty' : `On shelf ×${bottles}`
}

/** A search box over the oil library with one action button per result. */
export function OilSearchList({
  index,
  shelf,
  actionLabel,
  onAction,
  doneCounts,
  showPopular,
  onCreate,
  filter,
  limit = 60,
  placeholder = 'Search oils',
}: OilSearchListProps) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const pool = filter ? [...index.values()].filter(filter) : [...index.values()]
    return searchOils(query, pool, limit)
  }, [index, query, filter, limit])

  const popular = useMemo(
    () =>
      POPULAR_OIL_IDS.map((id) => index.get(id)).filter(
        (oil): oil is ResolvedOil => oil !== undefined,
      ),
    [index],
  )
  const trimmed = query.trim()

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-500">
          <SearchIcon size={20} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-10 text-base text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
      </label>

      <ScentGuideButton label="What do words like herbaceous mean?" />

      {showPopular && trimmed.length === 0 && (
        <div className="mt-1">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-stone-600 uppercase">
            Quick add
          </p>
          <ul className="flex flex-wrap gap-2">
            {popular.map((oil) => {
              const done = doneCounts?.get(oil.id) ?? 0
              return (
                <li key={oil.id}>
                  <button
                    type="button"
                    onClick={() => onAction(oil)}
                    className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
                      done > 0
                        ? 'border-brand-600 bg-brand-50 text-brand-900'
                        : 'border-stone-300 bg-white text-stone-800 active:bg-stone-100'
                    }`}
                  >
                    <PlusIcon size={16} />
                    {oil.name}
                    {done > 0 && <span className="text-brand-700">×{done}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ul className="mt-1 divide-y divide-stone-200" aria-label="Oils">
        {results.map((oil) => {
          const status = shelfStatus(oil.id, shelf)
          const done = doneCounts?.get(oil.id) ?? 0
          const families = oil.families.map((f) => FAMILY_LABELS[f]).join(', ')
          const ingredients = ingredientsLine(oil, index, 5)
          return (
            <li key={oil.id} className="flex items-center gap-3 py-2">
              <span
                aria-hidden="true"
                className="h-8 w-8 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ background: capBackground(oil.families) }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{oil.name}</p>
                <p className="truncate text-xs text-stone-500">
                  {[oil.kind === 'blend' ? 'Blend' : null, families || null, status]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {ingredients && <p className="text-xs text-stone-600">Made of {ingredients}</p>}
              </div>
              <button
                type="button"
                onClick={() => onAction(oil)}
                aria-label={`${actionLabel} ${oil.name}`}
                className={`min-h-11 shrink-0 rounded-xl px-3.5 text-sm font-semibold ${
                  done > 0 ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-600' : 'bg-brand-700 text-white active:bg-brand-900'
                }`}
              >
                {done > 0 ? `Added ×${done}` : actionLabel}
              </button>
            </li>
          )
        })}
      </ul>

      {results.length === 0 && (
        <div className="mt-2 rounded-xl bg-white p-4 text-sm text-stone-700 ring-1 ring-stone-200">
          <p>No oil matches “{trimmed}”.</p>
          {onCreate && (
            <button
              type="button"
              onClick={() => onCreate(trimmed)}
              className="mt-3 min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white"
            >
              Create “{trimmed}” as your own oil
            </button>
          )}
        </div>
      )}
    </div>
  )
}
