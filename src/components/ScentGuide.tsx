import { useState } from 'react'
import {
  FAMILY_COLORS,
  FAMILY_DESCRIPTIONS,
  FAMILY_LABELS,
  NOTE_DESCRIPTIONS,
  NOTE_LABELS,
} from '../data/labels'
import { FAMILIES, NOTES } from '../data/schema'
import { Sheet } from './Sheet'
import { InfoIcon } from './icons'

interface ScentGuideButtonProps {
  /** Words beside the "i". Leave out for the icon on its own. */
  label?: string
}

/** Plain-language meanings of the scent family and note words. */
export function ScentGuide({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Scent words explained" subtitle="What each word smells like" onClose={onClose}>
      <div className="space-y-6 pt-1">
        <section aria-labelledby="guide-families">
          <h3 id="guide-families" className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
            Scent families
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            Every oil belongs to one or two families. Oils from families that sit well together make a
            smoother blend.
          </p>
          <dl className="mt-3 space-y-3">
            {FAMILIES.map((family) => (
              <div key={family} className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: FAMILY_COLORS[family] }} />
                <div>
                  <dt className="text-sm font-semibold text-stone-900">{FAMILY_LABELS[family]}</dt>
                  <dd className="text-sm text-stone-700">
                    {FAMILY_DESCRIPTIONS[family].smellsLike}
                    <span className="block text-xs text-stone-500">{FAMILY_DESCRIPTIONS[family].examples}</span>
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="guide-notes">
          <h3 id="guide-notes" className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
            Top, middle and base notes
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            A note says how quickly an oil's scent fades. A blend with some of each smells good for longer.
          </p>
          <dl className="mt-3 space-y-3">
            {NOTES.map((note) => (
              <div key={note}>
                <dt className="text-sm font-semibold text-stone-900">{NOTE_LABELS[note]}</dt>
                <dd className="text-sm text-stone-700">{NOTE_DESCRIPTIONS[note]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="guide-harmony">
          <h3 id="guide-harmony" className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
            Harmony score
          </h3>
          <p className="mt-1 text-sm text-stone-700">
            A number from 0 to 100 for how well a blend's families, notes and strengths fit together.
            It's a guide, not a rule: your nose decides.
          </p>
        </section>

        <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-stone-900 text-base font-semibold text-white">
          Got it
        </button>
      </div>
    </Sheet>
  )
}

/** An "i" button that opens the scent word guide. */
export function ScentGuideButton({ label }: ScentGuideButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ? undefined : 'What do the scent words mean?'}
        className={`flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-700 ${
          label ? 'underline underline-offset-2' : 'w-11 justify-center rounded-full active:bg-brand-50'
        }`}
      >
        <InfoIcon size={label ? 18 : 22} />
        {label}
      </button>
      {open && <ScentGuide onClose={() => setOpen(false)} />}
    </>
  )
}
