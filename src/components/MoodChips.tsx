import { MOOD_LABELS } from '../data/labels'
import { MOODS, type Mood } from '../data/schema'

interface MoodChipsProps {
  value: Mood | undefined
  /** Tapping the selected mood again clears it. */
  onChange: (mood: Mood | undefined) => void
  label: string
}

/** The eight goals as chips. One can be selected, or none. */
export function MoodChips({ value, onChange, label }: MoodChipsProps) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {MOODS.map((mood) => {
        const on = value === mood
        return (
          <li key={mood}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? undefined : mood)}
              className={`min-h-11 rounded-full border px-3.5 text-sm font-medium ${
                on
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-stone-300 bg-white text-stone-800 active:bg-stone-100'
              }`}
            >
              {MOOD_LABELS[mood]}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
