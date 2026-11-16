import type { OilIndex } from '../engine/resolve'
import type { Suggestion } from '../engine/scoring'
import { capBackground } from './OilCap'
import { PlusIcon } from './icons'

interface PairListProps {
  suggestions: readonly Suggestion[]
  oils: OilIndex
  onAdd: (oilId: string) => void
}

/** The oils from the shelf that pair best with the blend, each with a reason. */
export function PairList({ suggestions, oils, onAdd }: PairListProps) {
  if (suggestions.length === 0) {
    return <p className="text-sm text-stone-600">Nothing else on your shelf to suggest.</p>
  }
  return (
    <ul className="divide-y divide-stone-200">
      {suggestions.map((suggestion) => {
        const oil = oils.get(suggestion.oilId)
        if (!oil) return null
        const caution = suggestion.penalties.includes('safety')
        return (
          <li key={suggestion.oilId} className="flex items-center gap-3 py-2">
            <span
              aria-hidden="true"
              className="h-9 w-9 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ background: capBackground(oil.families) }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-900">{oil.name}</p>
              <p className="text-xs text-stone-600">
                {caution ? 'Has a safety caution for this method' : suggestion.reason}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAdd(oil.id)}
              aria-label={`Add ${oil.name} to the blend`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white active:bg-brand-900"
            >
              <PlusIcon size={20} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
