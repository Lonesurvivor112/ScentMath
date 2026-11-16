import { useState } from 'react'
import { OilSearchList } from '../components/OilSearchList'
import { SizePicker } from '../components/SizePicker'
import { FAMILY_COLORS, FAMILY_LABELS, NOTE_LABELS } from '../data/labels'
import { FAMILIES, NOTES, type Family, type Intensity, type Note } from '../data/schema'
import { buildCustomOil } from '../engine/catalog'
import { DEFAULT_SIZE_ML } from '../engine/shelf'
import { useOilIndex, useOils } from '../store/oils'
import { useShelf } from '../store/shelf'

interface AddOilCreateProps {
  /** Fills in the name, for example from a search that found nothing. */
  initialName?: string
  /** A scanned barcode to remember for this new oil. */
  barcode?: string
  onCreated: (name: string) => void
}

const INTENSITIES: readonly Intensity[] = [1, 2, 3, 4, 5]
const INTENSITY_HINT: Record<Intensity, string> = {
  1: 'Very light',
  2: 'Light',
  3: 'Medium',
  4: 'Strong',
  5: 'Very strong',
}

const fieldClass =
  'mt-1 h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100'

/** Add an oil or blend that isn't in the library. */
export function AddOilCreate({ initialName = '', barcode, onCreated }: AddOilCreateProps) {
  const oils = useOilIndex()
  const shelf = useShelf((state) => state.items)
  const addBottle = useShelf((state) => state.addBottle)
  const addCustomOil = useOils((state) => state.addCustomOil)
  const learnBarcode = useOils((state) => state.learnBarcode)

  const [name, setName] = useState(initialName)
  const [brand, setBrand] = useState('')
  const [kind, setKind] = useState<'single' | 'blend'>('single')
  const [families, setFamilies] = useState<Family[]>([])
  const [note, setNote] = useState<Note>('middle')
  const [intensity, setIntensity] = useState<Intensity>(3)
  const [components, setComponents] = useState<string[]>([])
  const [sizeMl, setSizeMl] = useState(DEFAULT_SIZE_ML)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggleFamily = (family: Family) =>
    setFamilies((current) =>
      current.includes(family)
        ? current.filter((f) => f !== family)
        : current.length >= 2
          ? [current[1], family]
          : [...current, family],
    )

  const toggleComponent = (id: string) =>
    setComponents((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    )

  const save = async () => {
    const built = buildCustomOil(
      {
        name,
        kind,
        brand,
        families,
        note: kind === 'single' ? note : undefined,
        intensity: kind === 'single' ? intensity : undefined,
        components,
      },
      oils.keys(),
    )
    if (!built.ok) {
      setError(built.error)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addCustomOil(built.oil)
      const cleanBrand = brand.trim() || undefined
      if (barcode) {
        await learnBarcode({ code: barcode, oilId: built.oil.id, brand: cleanBrand, sizeMl })
      }
      await addBottle({ oilId: built.oil.id, brand: cleanBrand, sizeMl, barcode })
      onCreated(built.oil.name)
    } catch {
      setError("That couldn't be saved. Try again.")
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {barcode && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          Barcode {barcode} will be remembered for this oil.
        </p>
      )}

      <label className="block text-sm font-medium text-stone-700">
        Name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example Blue Tansy" className={fieldClass} />
      </label>

      <label className="block text-sm font-medium text-stone-700">
        Brand (optional)
        <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className={fieldClass} />
      </label>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-stone-700">What is it?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1">
          {(
            [
              ['single', 'A single oil'],
              ['blend', 'A blend'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={`min-h-11 rounded-lg text-sm font-semibold ${
                kind === value ? 'bg-white text-brand-900 shadow-sm' : 'text-stone-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {kind === 'blend' && (
        <fieldset>
          <legend className="text-sm font-medium text-stone-700">Oils in the blend</legend>
          <p className="mb-2 text-xs text-stone-600">
            Copy them from the label. The app works out the blend's scent family and cautions from these.
          </p>
          {components.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {components.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggleComponent(id)}
                    aria-label={`Remove ${oils.get(id)?.name ?? id} from the blend`}
                    className="min-h-11 rounded-full border border-brand-600 bg-brand-50 px-3 text-sm font-medium text-brand-900"
                  >
                    {oils.get(id)?.name ?? id} ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <OilSearchList
            index={oils}
            shelf={shelf}
            actionLabel="Add"
            onAction={(oil) => toggleComponent(oil.id)}
            filter={(oil) => oil.kind === 'single' && !components.includes(oil.id)}
            limit={6}
            placeholder="Search for an oil in the blend"
          />
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-stone-700">
          Scent family{kind === 'blend' ? ' (optional if you listed the oils)' : ''}
        </legend>
        <p className="mb-2 text-xs text-stone-600">Pick one or two.</p>
        <div className="flex flex-wrap gap-2">
          {FAMILIES.map((family) => {
            const on = families.includes(family)
            return (
              <button
                key={family}
                type="button"
                aria-pressed={on}
                onClick={() => toggleFamily(family)}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
                  on ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-stone-300 bg-white text-stone-800'
                }`}
              >
                <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: FAMILY_COLORS[family] }} />
                {FAMILY_LABELS[family]}
              </button>
            )
          })}
        </div>
      </fieldset>

      {kind === 'single' && (
        <>
          <fieldset>
            <legend className="text-sm font-medium text-stone-700">Note</legend>
            <p className="mb-2 text-xs text-stone-600">How fast the scent fades. Top fades first, base lasts longest.</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1">
              {NOTES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={note === value}
                  onClick={() => setNote(value)}
                  className={`min-h-11 rounded-lg text-sm font-semibold ${
                    note === value ? 'bg-white text-brand-900 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  {NOTE_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-stone-700">
              Strength: <span className="font-normal text-stone-600">{INTENSITY_HINT[intensity]}</span>
            </legend>
            <div className="mt-2 grid grid-cols-5 gap-1 rounded-xl bg-stone-200 p-1">
              {INTENSITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={intensity === value}
                  aria-label={`Strength ${value} of 5, ${INTENSITY_HINT[value]}`}
                  onClick={() => setIntensity(value)}
                  className={`min-h-11 rounded-lg text-sm font-semibold ${
                    intensity === value ? 'bg-white text-brand-900 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <div>
        <p className="mb-1 text-sm font-medium text-stone-700">Bottle size</p>
        <SizePicker value={sizeMl} onChange={setSizeMl} />
      </div>

      <p className="rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-700">
        The app has no safety data for oils you add yourself, so blends that use this one will show a
        "not fully verified" notice.
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="min-h-12 w-full rounded-xl bg-brand-700 text-base font-semibold text-white disabled:opacity-60"
      >
        Save and add to shelf
      </button>
    </form>
  )
}
