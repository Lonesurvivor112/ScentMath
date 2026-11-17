import { useState } from 'react'
import { ingredientNames } from '../engine/catalog'
import type { OilIndex, ResolvedOil } from '../engine/resolve'

interface MadeOfProps {
  oil: ResolvedOil
  oils: OilIndex
  /** How many ingredients to show before "+N more". */
  max?: number
  className?: string
}

/**
 * "Made of Tangerine, Pink Grapefruit, Geranium" for a brand blend. A long
 * list is cut short with a "+N more" button that opens the whole list in
 * place. Renders nothing for a single oil.
 */
export function MadeOf({ oil, oils, max = 5, className = '' }: MadeOfProps) {
  const [open, setOpen] = useState(false)
  const names = ingredientNames(oil, oils)
  if (names.length === 0) return null
  const long = names.length > max
  const shown = long && !open ? names.slice(0, max) : names
  return (
    <p className={`text-xs text-stone-600 ${className}`}>
      Made of {shown.join(', ')}
      {long && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? `Show fewer ingredients of ${oil.name}` : `Show all ${names.length} ingredients of ${oil.name}`}
          className="-my-3.5 ml-1 inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 align-middle font-semibold text-brand-700 underline underline-offset-2 active:text-brand-900"
        >
          {open ? 'Show less' : `+${names.length - max} more`}
        </button>
      )}
    </p>
  )
}
