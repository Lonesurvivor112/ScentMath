import { useState, type ReactNode } from 'react'
import { Sheet } from '../components/Sheet'
import type { Draft } from '../engine/builder'
import { useBuilder } from '../store/builder'
import { useNav } from '../store/nav'

/**
 * Opens a blend in the Build tab. If a blend is already being built, it asks
 * before replacing it. Render `sheet` somewhere in the screen that uses this.
 */
export function useOpenInBuild(): { open: (draft: Draft) => void; sheet: ReactNode } {
  const change = useBuilder((state) => state.change)
  const go = useNav((state) => state.go)
  const [pending, setPending] = useState<Draft | null>(null)

  const replace = (draft: Draft) => {
    change(draft)
    setPending(null)
    go('build')
  }

  const open = (draft: Draft) => {
    const current = useBuilder.getState().draft
    if (current.items.length > 0) setPending(draft)
    else replace(draft)
  }

  const sheet = pending ? (
    <Sheet
      title="Replace the blend in Build?"
      subtitle="You have a blend in progress. Opening this one will replace it."
      onClose={() => setPending(null)}
    >
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          type="button"
          onClick={() => setPending(null)}
          className="min-h-12 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800"
        >
          Keep mine
        </button>
        <button
          type="button"
          onClick={() => replace(pending)}
          className="min-h-12 rounded-xl bg-brand-700 text-sm font-semibold text-white"
        >
          Replace it
        </button>
      </div>
    </Sheet>
  ) : null

  return { open, sheet }
}
