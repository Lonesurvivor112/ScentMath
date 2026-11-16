import { MinusIcon, PlusIcon } from './icons'

interface DropStepperProps {
  /** The oil's name, for the button labels. */
  name: string
  drops: number
  onStep: (delta: number) => void
  /** False when the oil is at its own skin maximum. */
  canAdd?: boolean
  canRemove?: boolean
}

/** Minus and plus buttons around a drop count. */
export function DropStepper({ name, drops, onStep, canAdd = true, canRemove = true }: DropStepperProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={!canRemove}
        aria-label={`One drop less ${name}`}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-800 active:bg-stone-100 disabled:opacity-35"
      >
        <MinusIcon size={20} />
      </button>
      <span className="w-12 text-center" aria-live="polite">
        <span className="block text-lg leading-tight font-semibold text-stone-900">{drops}</span>
        <span className="block text-[11px] leading-tight text-stone-500">{drops === 1 ? 'drop' : 'drops'}</span>
      </span>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={!canAdd}
        aria-label={`One drop more ${name}`}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-800 active:bg-stone-100 disabled:opacity-35"
      >
        <PlusIcon size={20} />
      </button>
    </div>
  )
}
