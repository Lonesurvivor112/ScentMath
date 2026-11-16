import { useEffect, useMemo, useState } from 'react'
import { BalanceMeter } from '../components/BalanceMeter'
import { DropStepper } from '../components/DropStepper'
import { MoodChips } from '../components/MoodChips'
import { capBackground } from '../components/OilCap'
import { OilSearchList } from '../components/OilSearchList'
import { PairList } from '../components/PairList'
import { SafetyAbout, SafetyBanner } from '../components/SafetyBanner'
import { Sheet } from '../components/Sheet'
import { Toast } from '../components/Toast'
import { CloseIcon, PlusIcon } from '../components/icons'
import { COMPAT } from '../data'
import { METHOD_LABELS, MOOD_LABELS } from '../data/labels'
import { METHODS, type Method } from '../data/schema'
import {
  DILUTION_PRESETS,
  VOLUME_CHOICES,
  addOil,
  draftToBlend,
  evaluateDraft,
  isManual,
  removeOil,
  resetToSuggested,
  setDilution,
  setMethod,
  setVolume,
  stepDrops,
} from '../engine/builder'
import { isSkinMethod } from '../engine/calculator'
import { describeSize } from '../engine/ideas'
import type { ResolvedOil } from '../engine/resolve'
import { ownedOilIds } from '../engine/shelf'
import { newId, useBlends } from '../store/blends'
import { useBuilder } from '../store/builder'
import { useNav } from '../store/nav'
import { useOilIndex } from '../store/oils'
import { useProfile } from '../store/profile'
import { useShelf } from '../store/shelf'
import { Settings } from './Settings'

const SIZE_LABEL: Record<Method, string> = {
  diffuser: 'Water in your diffuser',
  roller: 'Roller bottle size',
  massage: 'Amount of carrier oil',
}

const chip = (on: boolean) =>
  `min-h-11 min-w-14 rounded-xl border px-3 text-sm font-medium ${
    on ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-white text-stone-800 active:bg-stone-100'
  }`

const trim = (n: number): string => String(Number(n.toFixed(2)))

type Panel = 'settings' | 'about' | 'add' | null

/** The Blend Builder: pick a method, add oils, and see drops, balance and safety. */
export function Build() {
  const draft = useBuilder((state) => state.draft)
  const ready = useBuilder((state) => state.loaded)
  const change = useBuilder((state) => state.change)
  const startOver = useBuilder((state) => state.startOver)
  const profile = useProfile((state) => state.profile)
  const shelf = useShelf((state) => state.items)
  const shelfReady = useShelf((state) => state.status === 'ready')
  const blends = useBlends((state) => state.blends)
  const saveBlend = useBlends((state) => state.save)
  const go = useNav((state) => state.go)
  const oils = useOilIndex()

  const [panel, setPanel] = useState<Panel>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const owned = useMemo(() => ownedOilIds(shelf), [shelf])
  const today = useMemo(() => new Date(), [])
  const view = useMemo(
    () => evaluateDraft(draft, { profile, oils, compat: COMPAT, owned, shelf, today }),
    [draft, profile, oils, owned, shelf, today],
  )

  const skin = isSkinMethod(draft.method)
  const manual = isManual(draft)
  const empty = draft.items.length === 0
  const saved = draft.blendId ? blends.find((b) => b.id === draft.blendId) : undefined

  /** Owned oils for the first pick, with ones that fit the goal first. */
  const starters = useMemo(() => {
    const list = [...owned]
      .map((id) => oils.get(id))
      .filter((oil): oil is ResolvedOil => oil !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name))
    if (!draft.mood) return list
    const mood = draft.mood
    return [...list.filter((o) => o.moods.includes(mood)), ...list.filter((o) => !o.moods.includes(mood))]
  }, [owned, oils, draft.mood])

  const add = (oilId: string) => {
    const oil = oils.get(oilId)
    if (oil) change((d) => addOil(d, oil))
  }

  const save = async (asNew: boolean) => {
    const id = asNew || !draft.blendId ? newId() : draft.blendId
    const createdAt = !asNew && saved ? saved.createdAt : new Date().toISOString()
    const blend = draftToBlend(draft, id, createdAt)
    await saveBlend(blend)
    change({ ...draft, blendId: id, name: blend.name })
    setToast(asNew || !saved ? `Saved "${blend.name}"` : `Updated "${blend.name}"`)
  }

  if (!ready || !shelfReady) {
    return (
      <section className="px-4 pt-6">
        <h1 className="text-2xl font-semibold text-brand-900">Build</h1>
        <p role="status" className="mt-2 text-sm text-stone-600">
          Getting things ready…
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="build-heading" className="space-y-5 px-4 pt-6 pb-8">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 id="build-heading" className="text-2xl font-semibold text-brand-900">
            Build
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {saved ? `Editing "${saved.name}"` : 'Make a blend from the oils on your shelf'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPanel('settings')}
          className="min-h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-stone-800 ring-1 ring-stone-300"
        >
          Settings
        </button>
      </header>

      {/* Method, size and dilution */}
      <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div role="radiogroup" aria-label="How you'll use the blend" className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1">
          {METHODS.map((method) => (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={draft.method === method}
              onClick={() => change((d) => setMethod(d, method, profile))}
              className={`min-h-11 rounded-lg text-sm font-semibold ${
                draft.method === method ? 'bg-white text-brand-900 shadow-sm' : 'text-stone-600'
              }`}
            >
              {METHOD_LABELS[method]}
            </button>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-800">{SIZE_LABEL[draft.method]}</p>
          <div role="radiogroup" aria-label={SIZE_LABEL[draft.method]} className="flex flex-wrap gap-2">
            {VOLUME_CHOICES[draft.method].map((ml) => (
              <button
                key={ml}
                type="button"
                role="radio"
                aria-checked={draft.volumeMl === ml}
                onClick={() => change((d) => setVolume(d, ml))}
                className={chip(draft.volumeMl === ml)}
              >
                {ml} ml
              </button>
            ))}
          </div>
        </div>

        {skin && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-800">Dilution</p>
            <div role="radiogroup" aria-label="Dilution" className="flex flex-wrap gap-2">
              {DILUTION_PRESETS.map(({ pct }) => (
                <button
                  key={pct}
                  type="button"
                  role="radio"
                  aria-checked={draft.dilutionPct === pct}
                  onClick={() => change((d) => setDilution(d, pct))}
                  className={chip(draft.dilutionPct === pct)}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-stone-600">
              {DILUTION_PRESETS.find((p) => p.pct === draft.dilutionPct)?.use ?? `${trim(draft.dilutionPct)}% dilution`}
              {profile.kidsYoungestAge !== undefined && '. For children, stay at 1% or less.'}
            </p>
          </div>
        )}
      </div>

      {/* Goal */}
      <div>
        <p className="mb-2 text-sm font-medium text-stone-800">
          Goal <span className="font-normal text-stone-500">(optional, steers the suggestions)</span>
        </p>
        <MoodChips label="Goal" value={draft.mood} onChange={(mood) => change({ ...draft, mood })} />
      </div>

      {/* The blend */}
      <section aria-labelledby="blend-heading" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="flex items-center justify-between gap-2">
          <h2 id="blend-heading" className="text-sm font-semibold text-stone-900">
            Your blend
          </h2>
          {!empty && (
            <p className="text-sm text-stone-700" aria-live="polite">
              <span className="font-semibold text-stone-900">{view.calc.totalDrops}</span>{' '}
              {view.calc.totalDrops === 1 ? 'drop' : 'drops'}
              {skin && view.calc.actualDilutionPct !== undefined && ` · ${trim(view.calc.actualDilutionPct)}%`}
            </p>
          )}
        </div>

        {empty && owned.size === 0 && (
          <div className="mt-3 text-sm text-stone-700">
            <p>Your shelf has no oils to blend yet.</p>
            <button type="button" onClick={() => go('shelf')} className="mt-3 min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">
              Go to your shelf
            </button>
          </div>
        )}

        {empty && owned.size > 0 && (
          <div className="mt-2">
            <p className="text-sm text-stone-600">
              {draft.mood ? `Tap a first oil. The ones that fit ${MOOD_LABELS[draft.mood]} are listed first.` : 'Tap a first oil to start.'}
            </p>
            <ul aria-label="Oils on your shelf" className="mt-3 flex flex-wrap gap-2">
              {starters.map((oil) => (
                <li key={oil.id}>
                  <button
                    type="button"
                    onClick={() => add(oil.id)}
                    aria-label={`Start with ${oil.name}`}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white pr-3.5 pl-2 text-sm font-medium text-stone-800 active:bg-stone-100"
                  >
                    <span aria-hidden="true" className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: capBackground(oil.families) }} />
                    {oil.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!empty && (
          <>
            <ul className="mt-2 divide-y divide-stone-200">
              {view.calc.lines.map((line) => {
                const oil = oils.get(line.oilId)
                const name = oil?.name ?? line.oilId
                const atMax = line.maxDrops !== undefined && line.drops >= line.maxDrops
                const info = [
                  !owned.has(line.oilId) ? 'Not on your shelf' : null,
                  skin && line.pct !== undefined && line.drops > 0 ? `${trim(line.pct)}% of the blend` : null,
                  skin && atMax && line.maxDrops !== undefined && line.maxDrops > 0 ? 'At its skin limit' : null,
                  skin && line.maxDrops === 0 ? 'Not for this size on skin' : null,
                ].filter(Boolean)
                return (
                  <li key={line.oilId} className="py-2">
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: capBackground(oil?.families ?? []) }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-tight font-medium text-stone-900">{name}</p>
                        {info.length > 0 && <p className="text-xs leading-tight text-stone-500">{info.join(' · ')}</p>}
                      </div>
                      <DropStepper
                        name={name}
                        drops={line.drops}
                        onStep={(delta) => change((d) => stepDrops(d, line.oilId, delta, view.calc.lines))}
                        canRemove={line.drops > 1}
                        canAdd={!(skin && atMax)}
                      />
                      <button
                        type="button"
                        onClick={() => change((d) => removeOil(d, line.oilId))}
                        aria-label={`Take ${name} out of the blend`}
                        className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-stone-500 active:text-stone-900"
                      >
                        <CloseIcon size={18} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            {view.calc.warnings.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {view.calc.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.oilId ?? ''}`} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
                    {warning.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3">
              <p className="text-xs text-stone-500">
                {manual ? 'Drops set by hand.' : `Suggested for ${describeSize(draft.method, draft.volumeMl, skin ? draft.dilutionPct : undefined).toLowerCase()}.`}
              </p>
              {manual && (
                <button type="button" onClick={() => change((d) => resetToSuggested(d, oils))} className="min-h-11 text-sm font-semibold text-brand-700 underline underline-offset-2">
                  Reset to suggested
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {!empty && <BalanceMeter notes={view.notes} harmony={view.harmony} />}

      {!empty && (
        <SafetyBanner issues={view.issues} onAbout={() => setPanel('about')} onHousehold={() => setPanel('settings')} />
      )}

      {!empty && (
        <section aria-labelledby="pairs-heading" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <h2 id="pairs-heading" className="text-sm font-semibold text-stone-900">
            Pairs well
          </h2>
          <p className="mb-1 text-xs text-stone-500">From your shelf, best match first</p>
          <PairList suggestions={view.suggestions} oils={oils} onAdd={add} />
          <button
            type="button"
            onClick={() => setPanel('add')}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-brand-700 ring-1 ring-brand-600"
          >
            <PlusIcon size={18} />
            Pick any oil from your shelf
          </button>
        </section>
      )}

      {!empty && (
        <section aria-labelledby="save-heading" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <h2 id="save-heading" className="text-sm font-semibold text-stone-900">
            Save this blend
          </h2>
          <label className="mt-2 block text-sm font-medium text-stone-700">
            Name
            <input
              type="text"
              value={draft.name}
              onChange={(event) => change({ ...draft, name: event.target.value })}
              placeholder="For example Sunday morning"
              maxLength={60}
              className="mt-1 h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <div className="mt-3 grid gap-2">
            <button type="button" onClick={() => void save(false)} className="min-h-12 rounded-xl bg-brand-700 text-base font-semibold text-white active:bg-brand-900">
              {saved ? 'Save changes' : 'Save blend'}
            </button>
            {saved && (
              <button type="button" onClick={() => void save(true)} className="min-h-11 rounded-xl text-sm font-semibold text-brand-700 ring-1 ring-brand-600">
                Save as a new blend
              </button>
            )}
            <button type="button" onClick={startOver} className="min-h-11 rounded-xl text-sm font-semibold text-stone-700 ring-1 ring-stone-300">
              Start over
            </button>
          </div>
        </section>
      )}

      {panel === 'settings' && <Settings onClose={() => setPanel(null)} />}
      {panel === 'about' && (
        <Sheet title="About this safety info" onClose={() => setPanel(null)}>
          <SafetyAbout />
        </Sheet>
      )}
      {panel === 'add' && (
        <Sheet title="Add an oil" subtitle="Oils on your shelf" onClose={() => setPanel(null)}>
          <OilSearchList
            index={oils}
            shelf={shelf}
            actionLabel="Add"
            onAction={(oil) => {
              add(oil.id)
              setPanel(null)
            }}
            filter={(oil) => owned.has(oil.id) && !draft.items.some((item) => item.oilId === oil.id)}
            placeholder="Search your shelf"
          />
        </Sheet>
      )}
      {toast && <Toast message={toast} actionLabel="View saved" onAction={() => go('saved')} />}
    </section>
  )
}
