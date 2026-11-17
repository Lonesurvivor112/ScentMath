import { useMemo, useState } from 'react'
import { capBackground } from '../components/OilCap'
import { SafetyAbout, SafetyBanner } from '../components/SafetyBanner'
import { Sheet } from '../components/Sheet'
import { MOOD_LABELS } from '../data/labels'
import type { Blend } from '../data/schema'
import { blendDrops, blendToDraft } from '../engine/builder'
import { ingredientsLine } from '../engine/catalog'
import { blendText, describeSize } from '../engine/ideas'
import { checkBlend } from '../engine/safety'
import { useBlends } from '../store/blends'
import { useOilIndex } from '../store/oils'
import { useProfile } from '../store/profile'
import { useShelf } from '../store/shelf'
import type { Draft } from '../engine/builder'

interface BlendDetailProps {
  blend: Blend
  onClose: () => void
  /** Opens the blend in the Build tab. */
  onEdit: (draft: Draft) => void
  /** Removal is handled by the list so it can offer Undo. */
  onDelete: (blend: Blend) => void
  onMessage: (message: string) => void
}

const RATINGS = [1, 2, 3, 4, 5] as const

/** One saved blend: drops, safety notes, rating, notes, and what to do with it. */
export function BlendDetail({ blend, onClose, onEdit, onDelete, onMessage }: BlendDetailProps) {
  const update = useBlends((state) => state.update)
  const duplicate = useBlends((state) => state.duplicate)
  const profile = useProfile((state) => state.profile)
  const shelf = useShelf((state) => state.items)
  const oils = useOilIndex()
  const [notes, setNotes] = useState(blend.notes ?? '')
  const [about, setAbout] = useState(false)

  const nameOf = (id: string) => oils.get(id)?.name ?? id
  const madeOf = (id: string) => {
    const oil = oils.get(id)
    return oil ? ingredientsLine(oil, oils) : null
  }
  const calc = useMemo(() => blendDrops(blend, profile.dropsPerMl, oils), [blend, profile.dropsPerMl, oils])
  const issues = useMemo(
    () =>
      checkBlend({
        method: blend.method,
        lines: calc.lines,
        volumeMl: blend.volumeMl,
        dropsPerMl: profile.dropsPerMl,
        profile,
        oils,
        shelf,
        today: new Date(),
      }),
    [blend, calc, profile, oils, shelf],
  )

  const share = async () => {
    const text = blendText(blend, calc.lines, nameOf)
    try {
      if (navigator.share) {
        await navigator.share({ title: blend.name, text })
        return
      }
      await navigator.clipboard.writeText(text)
      onMessage('Blend copied as text')
    } catch (cause) {
      // Closing the share sheet is not an error worth reporting.
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        onMessage("The blend couldn't be shared")
      }
    }
  }

  if (about) {
    return (
      <Sheet title="About this safety info" onClose={() => setAbout(false)}>
        <SafetyAbout />
      </Sheet>
    )
  }

  return (
    <Sheet
      title={blend.name}
      subtitle={[describeSize(blend.method, blend.volumeMl, blend.dilutionPct), blend.mood ? MOOD_LABELS[blend.mood] : null]
        .filter(Boolean)
        .join(' · ')}
      onClose={onClose}
    >
      <div className="space-y-5 pt-1">
        <section aria-label="Drops per oil" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <ul className="space-y-2">
            {calc.lines.map((line) => (
              <li key={line.oilId} className="flex items-center gap-3 text-sm text-stone-900">
                <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: capBackground(oils.get(line.oilId)?.families ?? []) }} />
                <span className="min-w-0 flex-1 font-medium">
                  {nameOf(line.oilId)}
                  {madeOf(line.oilId) && <span className="block text-xs font-normal text-stone-500">Made of {madeOf(line.oilId)}</span>}
                </span>
                <span className="tabular-nums">
                  <span className="text-base font-semibold">{line.drops}</span> {line.drops === 1 ? 'drop' : 'drops'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-stone-200 pt-2 text-sm text-stone-700">
            {calc.totalDrops} {calc.totalDrops === 1 ? 'drop' : 'drops'} in total
          </p>
          {calc.warnings.map((warning) => (
            <p key={`${warning.code}-${warning.oilId ?? ''}`} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
              {warning.message}
            </p>
          ))}
        </section>

        <SafetyBanner issues={issues} onAbout={() => setAbout(true)} />

        <div>
          <p className="mb-1 text-sm font-medium text-stone-700">Your rating</p>
          <div role="radiogroup" aria-label="Rating" className="flex gap-1">
            {RATINGS.map((value) => {
              const on = (blend.rating ?? 0) >= value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={blend.rating === value}
                  aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                  onClick={() => void update(blend.id, { rating: blend.rating === value ? undefined : value })}
                  className={`flex h-11 w-11 items-center justify-center text-3xl leading-none ${on ? 'text-amber-500' : 'text-stone-300'}`}
                >
                  ★
                </button>
              )
            })}
          </div>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          Notes
          <textarea
            value={notes}
            rows={3}
            placeholder="How did it smell? What would you change?"
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => void update(blend.id, { notes: notes.trim() || undefined })}
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEdit(blendToDraft({ ...blend, notes: notes.trim() || undefined }, profile))}
            className="col-span-2 min-h-12 rounded-xl bg-brand-700 text-base font-semibold text-white"
          >
            Open in Build
          </button>
          <button
            type="button"
            onClick={() =>
              void duplicate(blend.id).then((copy) => {
                if (copy) onMessage(`Made "${copy.name}"`)
                onClose()
              })
            }
            className="min-h-11 rounded-xl text-sm font-semibold text-brand-700 ring-1 ring-brand-600"
          >
            Duplicate
          </button>
          <button type="button" onClick={() => void share()} className="min-h-11 rounded-xl text-sm font-semibold text-brand-700 ring-1 ring-brand-600">
            Share as text
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(blend)
              onClose()
            }}
            className="col-span-2 min-h-11 rounded-xl text-sm font-semibold text-red-700 ring-1 ring-red-200"
          >
            Delete blend
          </button>
        </div>
      </div>
    </Sheet>
  )
}
