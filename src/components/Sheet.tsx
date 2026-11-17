import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface SheetProps {
  title: string
  subtitle?: string
  onClose: () => void
  /** Fills the whole screen instead of rising from the bottom. */
  full?: boolean
  children: ReactNode
}

/** Open sheets, newest last, so Escape only closes the one on top. */
const openSheets: string[] = []

/** A modal panel that rises from the bottom of the screen. */
export function Sheet({ title, subtitle, onClose, full, children }: SheetProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    openSheets.push(titleId)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openSheets[openSheets.length - 1] === titleId) onClose()
    }
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      const at = openSheets.lastIndexOf(titleId)
      if (at >= 0) openSheets.splice(at, 1)
    }
  }, [onClose, titleId])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/45"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex w-full max-w-md flex-col bg-paper shadow-xl outline-none ${
          full ? 'h-dvh' : 'max-h-[92dvh] rounded-t-3xl'
        }`}
      >
        <header className="flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold text-brand-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-stone-600">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-600 active:bg-stone-200"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
