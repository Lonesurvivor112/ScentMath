import { useCallback, useRef, useState } from 'react'
import { AboutOil } from '../components/AboutOil'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { OilSearchList } from '../components/OilSearchList'
import { SizePicker } from '../components/SizePicker'
import type { BarcodeEntry } from '../data/schema'
import { normalizeBarcode } from '../engine/barcode'
import type { OilIndex, ResolvedOil } from '../engine/resolve'
import { DEFAULT_SIZE_ML } from '../engine/shelf'
import type { ShelfRow } from '../store/db'
import { useBarcodeIndex, useOilIndex, useOils } from '../store/oils'
import { useShelf, type AddResult } from '../store/shelf'

interface AddOilScanProps {
  /** Hands an unknown barcode to the "create your own" form. */
  onCreateForBarcode: (code: string) => void
}

type Mode = 'single' | 'quick'

/** A bottle added during this scanning session. */
interface SessionAdd {
  key: number
  label: string
  detail: string
  result: AddResult
}

/**
 * Add bottles by barcode. "One at a time" stops after each scan to confirm.
 * "Quick scan" keeps the camera going and adds every bottle it recognizes.
 */
export function AddOilScan({ onCreateForBarcode }: AddOilScanProps) {
  const oils = useOilIndex()
  const barcodes = useBarcodeIndex()
  const shelf = useShelf((state) => state.items)
  const addBottle = useShelf((state) => state.addBottle)
  const learnBarcode = useOils((state) => state.learnBarcode)

  const [mode, setMode] = useState<Mode>('single')
  /** A recognized bottle waiting for a tap on "Add" (one-at-a-time mode). */
  const [pending, setPending] = useState<{ code: string; entry: BarcodeEntry } | null>(null)
  /** Barcodes the app doesn't know yet. */
  const [unknown, setUnknown] = useState<string[]>([])
  /** The unknown barcode being matched to an oil right now. */
  const [matching, setMatching] = useState<string | null>(null)
  const [session, setSession] = useState<SessionAdd[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const nextKey = useRef(1)
  /** The last few codes the camera reported, so a restart doesn't repeat them. */
  const [recentCodes, setRecentCodes] = useState<string[]>([])

  const handleScan = (code: string) => {
    setRecentCodes((list) => [code, ...list.filter((c) => c !== code)].slice(0, 3))
    handleCode(code)
  }

  const describe = useCallback(
    (entry: Pick<BarcodeEntry, 'oilId' | 'brand' | 'sizeMl' | 'organic'>) => {
      const name = oils.get(entry.oilId)?.name ?? entry.oilId
      const detail = [entry.brand, entry.sizeMl ? `${entry.sizeMl} ml` : null, entry.organic ? 'Organic' : null]
        .filter(Boolean)
        .join(' · ')
      return { name, detail }
    },
    [oils],
  )

  const addEntry = useCallback(
    async (code: string, entry: BarcodeEntry) => {
      const result = await addBottle({
        oilId: entry.oilId,
        brand: entry.brand,
        sizeMl: entry.sizeMl ?? DEFAULT_SIZE_ML,
        barcode: code,
        notes: entry.organic ? 'Organic' : undefined,
      })
      const { name, detail } = describe(entry)
      setSession((list) => [{ key: nextKey.current++, label: name, detail, result }, ...list])
      setNotice(`Added ${name}`)
    },
    [addBottle, describe],
  )

  const handleCode = useCallback(
    (code: string) => {
      const entry = barcodes.get(code)
      if (entry && oils.has(entry.oilId)) {
        if (mode === 'quick') void addEntry(code, entry)
        else setPending({ code, entry })
        return
      }
      setUnknown((list) => (list.includes(code) ? list : [...list, code]))
      if (mode === 'quick') setNotice(`Barcode ${code} is new. Saved below to match.`)
      else setMatching(code)
    },
    [barcodes, oils, mode, addEntry],
  )

  const submitTyped = () => {
    const code = normalizeBarcode(typed)
    if (!code) {
      setNotice("That isn't a valid barcode. Type the 12 or 13 digits printed under the bars.")
      return
    }
    setTyped('')
    handleCode(code)
  }

  const undo = async (item: SessionAdd) => {
    await item.result.undo()
    setSession((list) => list.filter((entry) => entry.key !== item.key))
    setNotice(`Took back ${item.label}`)
  }

  const finishMatch = async (code: string, oil: ResolvedOil, brand: string, sizeMl: number) => {
    const entry: BarcodeEntry = {
      code,
      oilId: oil.id,
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      sizeMl,
    }
    await learnBarcode(entry)
    await addEntry(code, entry)
    setUnknown((list) => list.filter((c) => c !== code))
    setMatching(null)
  }

  const skip = (code: string) => {
    setUnknown((list) => list.filter((c) => c !== code))
    setMatching(null)
  }

  if (matching) {
    return (
      <MatchBarcode
        code={matching}
        onCancel={() => setMatching(null)}
        onSkip={() => skip(matching)}
        onCreate={() => onCreateForBarcode(matching)}
        onMatch={(oil, brand, sizeMl) => void finishMatch(matching, oil, brand, sizeMl)}
        oils={oils}
        shelf={shelf}
      />
    )
  }

  const scannerPaused = pending !== null
  const pendingOil = pending ? oils.get(pending.entry.oilId) : undefined

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Scan mode" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1">
        {(
          [
            ['single', 'One at a time'],
            ['quick', 'Quick scan'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => {
              setMode(value)
              setPending(null)
            }}
            className={`min-h-11 rounded-lg text-sm font-semibold ${
              mode === value ? 'bg-white text-brand-900 shadow-sm' : 'text-stone-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-sm text-stone-600">
        {mode === 'quick'
          ? 'Scan one bottle after another. Each one is added as soon as it is recognized.'
          : 'Scan a bottle, check it, then add it.'}
      </p>

      <BarcodeScanner onScan={handleScan} paused={scannerPaused} recentCodes={recentCodes} />

      {notice && (
        <p role="status" aria-live="polite" className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">
          {notice}
        </p>
      )}

      {pending && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Found</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{describe(pending.entry).name}</p>
          <p className="text-sm text-stone-600">{describe(pending.entry).detail}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="min-h-11 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800"
            >
              Not this
            </button>
            <button
              type="button"
              onClick={() => {
                void addEntry(pending.code, pending.entry)
                setPending(null)
              }}
              className="min-h-11 rounded-xl bg-brand-700 text-sm font-semibold text-white"
            >
              Add to shelf
            </button>
          </div>
          {pendingOil && (
            <div className="mt-3">
              <AboutOil oil={pendingOil} />
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitTyped()
        }}
        className="flex items-end gap-2"
      >
        <label className="flex-1 text-sm font-medium text-stone-700">
          Or type the barcode
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]*"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="12 or 13 digits"
            className="mt-1 h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <button type="submit" className="h-12 rounded-xl bg-stone-800 px-4 text-sm font-semibold text-white">
          Look up
        </button>
      </form>

      {unknown.length > 0 && (
        <section aria-labelledby="unknown-heading">
          <h3 id="unknown-heading" className="mb-1 text-sm font-semibold text-stone-800">
            New barcodes ({unknown.length})
          </h3>
          <p className="mb-2 text-xs text-stone-600">
            Match each one to an oil once. The app remembers it for next time.
          </p>
          <ul className="space-y-2">
            {unknown.map((code) => (
              <li key={code} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 pl-3 ring-1 ring-stone-200">
                <span className="font-mono text-sm text-stone-800">{code}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => skip(code)} className="min-h-11 rounded-lg px-3 text-sm font-medium text-stone-600">
                    Skip
                  </button>
                  <button type="button" onClick={() => setMatching(code)} className="min-h-11 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white">
                    Match
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {session.length > 0 && (
        <section aria-labelledby="session-heading">
          <h3 id="session-heading" className="mb-2 text-sm font-semibold text-stone-800">
            Added this session ({session.length})
          </h3>
          <ul className="space-y-2">
            {session.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 pl-3 ring-1 ring-stone-200">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-stone-900">{item.label}</span>
                  <span className="block truncate text-xs text-stone-500">{item.detail}</span>
                </span>
                <button type="button" onClick={() => void undo(item)} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-brand-700">
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

interface MatchBarcodeProps {
  code: string
  oils: OilIndex
  shelf: readonly ShelfRow[]
  onMatch: (oil: ResolvedOil, brand: string, sizeMl: number) => void
  onCreate: () => void
  onSkip: () => void
  onCancel: () => void
}

/** Ties a barcode the app doesn't know to an oil, once. */
function MatchBarcode({ code, oils, shelf, onMatch, onCreate, onSkip, onCancel }: MatchBarcodeProps) {
  const [picked, setPicked] = useState<ResolvedOil | null>(null)
  const [brand, setBrand] = useState('')
  const [sizeMl, setSizeMl] = useState(DEFAULT_SIZE_ML)

  if (picked) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Barcode {code}</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{picked.name}</p>
        </div>
        <AboutOil oil={picked} />
        <label className="block text-sm font-medium text-stone-700">
          Brand (optional)
          <input
            type="text"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder={picked.brand ?? 'For example Cliganic'}
            className="mt-1 h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-brand-600"
          />
        </label>
        <div>
          <p className="mb-1 text-sm font-medium text-stone-700">Bottle size</p>
          <SizePicker value={sizeMl} onChange={setSizeMl} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPicked(null)} className="min-h-12 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800">
            Back
          </button>
          <button
            type="button"
            onClick={() => onMatch(picked, brand || (picked.brand ?? ''), sizeMl)}
            className="min-h-12 rounded-xl bg-brand-700 text-sm font-semibold text-white"
          >
            Save and add
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
        <p className="font-semibold">Barcode {code} is new to the app</p>
        <p className="mt-0.5">Pick the oil it belongs to. You only need to do this once.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800">
          Back
        </button>
        <button type="button" onClick={onSkip} className="min-h-11 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800">
          Skip it
        </button>
        <button type="button" onClick={onCreate} className="min-h-11 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800">
          Create new
        </button>
      </div>
      <OilSearchList index={oils} shelf={shelf} actionLabel="This one" onAction={setPicked} onCreate={onCreate} />
    </div>
  )
}
