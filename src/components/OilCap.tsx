import { FAMILY_COLORS } from '../data/labels'
import type { Family } from '../data/schema'
import { GetMoreIcon, RestockIcon, TrashIcon } from './icons'

interface OilCapProps {
  name: string
  families: readonly Family[]
  count: number
  brand?: string
  isBlend?: boolean
  /** The bottle has run out and is on the "Get more" list. */
  empty?: boolean
  /** A short warning under the name, such as the old-bottle badge. */
  badge?: string
  /** Opens the bottle's details. */
  onOpen?: () => void
  /** Shows the quick remove and "ran out" buttons. */
  editing?: boolean
  onToggleEmpty?: () => void
  onRemove?: () => void
}

const UNKNOWN_COLOR = '#A8A29E'

export function capBackground(families: readonly Family[]): string {
  const primary = families[0] ? FAMILY_COLORS[families[0]] : UNKNOWN_COLOR
  const secondary = families[1] ? FAMILY_COLORS[families[1]] : primary
  return `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50% 100%)`
}

/** One oil on the shelf, drawn as a bottle cap in its scent-family color. */
export function OilCap({
  name,
  families,
  count,
  brand,
  isBlend,
  empty,
  badge,
  onOpen,
  editing,
  onToggleEmpty,
  onRemove,
}: OilCapProps) {
  const status = empty ? 'empty, on your Get more list' : `${count} ${count === 1 ? 'bottle' : 'bottles'}`
  const label = `${name}${brand ? `, ${brand}` : ''}, ${status}`

  return (
    <li className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label}. Open details`}
        className="flex min-h-11 w-full flex-1 flex-col items-center gap-1.5 rounded-2xl p-2.5 pt-3 text-center active:bg-stone-50"
      >
        <span className="relative">
          <span
            aria-hidden="true"
            className={`block h-14 w-14 rounded-full ring-2 ring-white ${empty ? 'opacity-35 grayscale' : ''}`}
            style={{
              background: capBackground(families),
              boxShadow: 'inset 0 -6px 10px rgb(0 0 0 / 0.18), 0 1px 3px rgb(0 0 0 / 0.2)',
            }}
          />
          {!empty && count > 1 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-2 min-w-6 rounded-full bg-brand-900 px-1.5 py-0.5 text-xs font-semibold text-white"
            >
              ×{count}
            </span>
          )}
        </span>
        <span className={`text-sm leading-tight font-medium ${empty ? 'text-stone-500' : 'text-stone-900'}`}>
          {name}
        </span>
        {(isBlend || brand) && (
          <span className="text-xs leading-tight text-stone-500">
            {isBlend ? 'Blend' : null}
            {isBlend && brand ? ' · ' : null}
            {brand}
          </span>
        )}
        {empty && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] leading-tight font-semibold text-amber-900">
            Empty · Get more
          </span>
        )}
        {badge && !empty && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] leading-tight font-medium text-amber-900">
            {badge}
          </span>
        )}
      </button>

      {editing && (
        <div className="grid grid-cols-2 gap-1 border-t border-stone-200 p-1">
          <button
            type="button"
            onClick={onToggleEmpty}
            aria-label={empty ? `${name} is back in stock` : `${name} ran out. Add to Get more`}
            className={`flex h-11 items-center justify-center rounded-xl ${
              empty ? 'bg-brand-50 text-brand-700' : 'text-amber-800 active:bg-amber-50'
            }`}
          >
            {empty ? <RestockIcon /> : <GetMoreIcon />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${name} from your shelf`}
            className="flex h-11 items-center justify-center rounded-xl text-red-700 active:bg-red-50"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </li>
  )
}
