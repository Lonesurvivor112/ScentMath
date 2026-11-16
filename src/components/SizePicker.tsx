import { COMMON_SIZES_ML } from '../engine/shelf'

interface SizePickerProps {
  value: number
  onChange: (sizeMl: number) => void
}

/** Bottle size as one-tap chips, with a box for any other size. */
export function SizePicker({ value, onChange }: SizePickerProps) {
  const isCommon = COMMON_SIZES_ML.includes(value)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COMMON_SIZES_ML.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          aria-pressed={value === size}
          className={`min-h-11 min-w-14 rounded-xl border px-3 text-sm font-medium ${
            value === size
              ? 'border-brand-700 bg-brand-700 text-white'
              : 'border-stone-300 bg-white text-stone-800'
          }`}
        >
          {size} ml
        </button>
      ))}
      <label className="flex items-center gap-1.5 text-sm text-stone-600">
        <span className="sr-only">Other size in ml</span>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={1000}
          step="any"
          placeholder="Other"
          value={isCommon ? '' : value}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next) && next > 0) onChange(next)
          }}
          className={`h-11 w-20 rounded-xl border bg-white px-2 text-base text-stone-900 outline-none focus:border-brand-600 ${
            isCommon ? 'border-stone-300' : 'border-brand-700'
          }`}
        />
        ml
      </label>
    </div>
  )
}
