import { useEffect, useState } from 'react'
import { capBackground } from '../components/OilCap'
import { Toast } from '../components/Toast'
import { MOOD_LABELS } from '../data/labels'
import type { Blend } from '../data/schema'
import { describeSize, listOilNames } from '../engine/ideas'
import { useBlends } from '../store/blends'
import { useNav } from '../store/nav'
import { useOilIndex } from '../store/oils'
import { BlendDetail } from './BlendDetail'
import { useOpenInBuild } from './useOpenInBuild'

interface ToastState {
  message: string
  undo?: () => void
}

/** The blends the user has saved. */
export function Saved() {
  const blends = useBlends((state) => state.blends)
  const loaded = useBlends((state) => state.loaded)
  const remove = useBlends((state) => state.remove)
  const save = useBlends((state) => state.save)
  const oils = useOilIndex()
  const go = useNav((state) => state.go)
  const { open, sheet } = useOpenInBuild()
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const nameOf = (id: string) => oils.get(id)?.name ?? id
  const current = openId ? blends.find((b) => b.id === openId) : undefined

  const deleteBlend = async (blend: Blend) => {
    const removed = await remove(blend.id)
    if (!removed) return
    setToast({
      message: `Deleted "${removed.name}"`,
      undo: () => {
        void save(removed)
        setToast(null)
      },
    })
  }

  return (
    <section aria-labelledby="saved-heading" className="px-4 pt-6 pb-8">
      <header className="mb-4">
        <h1 id="saved-heading" className="text-2xl font-semibold text-brand-900">
          Saved
        </h1>
        {loaded && blends.length > 0 && (
          <p className="mt-1 text-sm text-stone-600">
            {blends.length} {blends.length === 1 ? 'blend' : 'blends'}
          </p>
        )}
      </header>

      {!loaded && (
        <p role="status" className="text-sm text-stone-600">
          Opening your blends…
        </p>
      )}

      {loaded && blends.length === 0 && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200">
          <p className="text-base font-semibold text-stone-900">No saved blends yet</p>
          <p className="mt-1 text-sm text-stone-600">Make one in Build, or start from an idea, then save it with a name.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => go('ideas')} className="min-h-12 rounded-xl text-sm font-semibold text-brand-700 ring-1 ring-brand-600">
              See ideas
            </button>
            <button type="button" onClick={() => go('build')} className="min-h-12 rounded-xl bg-brand-700 text-sm font-semibold text-white">
              Build a blend
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {blends.map((blend) => (
          <li key={blend.id}>
            <button
              type="button"
              onClick={() => setOpenId(blend.id)}
              aria-label={`${blend.name}. Open details`}
              className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 active:bg-stone-50"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold text-stone-900">{blend.name}</span>
                  <span className="block text-xs text-stone-600">
                    {[describeSize(blend.method, blend.volumeMl, blend.dilutionPct), blend.mood ? MOOD_LABELS[blend.mood] : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {blend.rating && (
                  <span className="shrink-0 text-sm text-amber-500" aria-label={`Rated ${blend.rating} out of 5`}>
                    {'★'.repeat(blend.rating)}
                    <span className="text-stone-300">{'★'.repeat(5 - blend.rating)}</span>
                  </span>
                )}
              </span>
              <span className="mt-2 flex items-center gap-2">
                <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                  {blend.items.slice(0, 5).map((item) => (
                    <span key={item.oilId} className="h-6 w-6 rounded-full ring-2 ring-white" style={{ background: capBackground(oils.get(item.oilId)?.families ?? []) }} />
                  ))}
                </span>
                <span className="min-w-0 truncate text-sm text-stone-700">{listOilNames(blend.items.map((item) => nameOf(item.oilId)))}</span>
              </span>
              {blend.notes && <span className="mt-2 block truncate text-xs text-stone-500">{blend.notes}</span>}
            </button>
          </li>
        ))}
      </ul>

      {current && (
        <BlendDetail
          key={current.id}
          blend={current}
          onClose={() => setOpenId(null)}
          onEdit={(draft) => {
            setOpenId(null)
            open(draft)
          }}
          onDelete={(blend) => void deleteBlend(blend)}
          onMessage={(message) => setToast({ message })}
        />
      )}

      {sheet}
      {toast && <Toast message={toast.message} actionLabel={toast.undo ? 'Undo' : undefined} onAction={toast.undo} />}
    </section>
  )
}
