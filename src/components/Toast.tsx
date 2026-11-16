interface ToastProps {
  message: string
  actionLabel?: string
  onAction?: () => void
}

/** A short message above the tab bar, with an optional action such as Undo. */
export function Toast({ message, actionLabel, onAction }: ToastProps) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-xl bg-stone-900 py-1 pr-1 pl-4 text-sm text-white shadow-lg">
        <span className="py-2">{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="min-h-11 shrink-0 rounded-lg px-3 font-semibold text-amber-300 active:bg-white/10"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
