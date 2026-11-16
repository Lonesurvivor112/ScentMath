import { Sheet } from '../components/Sheet'
import { DILUTION_PRESETS, VOLUME_CHOICES } from '../engine/builder'
import { useProfile } from '../store/profile'

interface SettingsProps {
  onClose: () => void
}

interface ToggleProps {
  label: string
  hint?: string
  on: boolean
  onChange: (on: boolean) => void
}

function Toggle({ label, hint, on, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-12 w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span>
        <span className="block text-sm font-medium text-stone-900">{label}</span>
        {hint && <span className="block text-xs text-stone-600">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-brand-700' : 'bg-stone-300'}`}
      >
        <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

const chip = (on: boolean) =>
  `min-h-11 min-w-14 rounded-xl border px-3 text-sm font-medium ${
    on ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-white text-stone-800'
  }`

const numberField =
  'h-11 w-20 rounded-xl border border-stone-300 bg-white px-2 text-center text-base text-stone-900 outline-none focus:border-brand-600'

/** Household and calculator defaults. Safety checks follow the household. */
export function Settings({ onClose }: SettingsProps) {
  const profile = useProfile((state) => state.profile)
  const update = useProfile((state) => state.update)
  const hasKids = profile.kidsYoungestAge !== undefined

  return (
    <Sheet title="Settings" subtitle="Saved on this device only" onClose={onClose}>
      <div className="space-y-6 pt-1">
        <section aria-labelledby="household-heading">
          <h3 id="household-heading" className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
            Your household
          </h3>
          <p className="mt-1 mb-2 text-xs text-stone-600">Safety notes on every blend follow these.</p>
          <div className="divide-y divide-stone-200">
            <div>
              <Toggle
                label="Children at home"
                hint="Warns about oils that aren't rated safe around kids"
                on={hasKids}
                onChange={(on) => void update({ kidsYoungestAge: on ? 5 : undefined })}
              />
              {hasKids && (
                <label className="flex items-center justify-between gap-3 pb-3 text-sm text-stone-800">
                  Age of the youngest child
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={17}
                    value={profile.kidsYoungestAge}
                    onChange={(event) => {
                      const age = Math.round(Number(event.target.value))
                      if (event.target.value !== '' && age >= 0 && age <= 17) void update({ kidsYoungestAge: age })
                    }}
                    className={numberField}
                  />
                </label>
              )}
            </div>
            <Toggle
              label="Pregnancy"
              hint="Hides flagged oils from suggestions"
              on={profile.pregnant}
              onChange={(pregnant) => void update({ pregnant })}
            />
            <Toggle label="Cats" hint="Flags oils to keep away from cats" on={profile.cats} onChange={(cats) => void update({ cats })} />
            <Toggle label="Dogs" on={profile.dogs} onChange={(dogs) => void update({ dogs })} />
          </div>
        </section>

        <section aria-labelledby="calc-heading">
          <h3 id="calc-heading" className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
            Drop calculator
          </h3>

          <div className="mt-3">
            <p className="mb-1 text-sm font-medium text-stone-900">Your diffuser's water size</p>
            <div className="flex flex-wrap gap-2">
              {VOLUME_CHOICES.diffuser.map((ml) => (
                <button key={ml} type="button" aria-pressed={profile.diffuserMl === ml} onClick={() => void update({ diffuserMl: ml })} className={chip(profile.diffuserMl === ml)}>
                  {ml} ml
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1 text-sm font-medium text-stone-900">Usual dilution for skin blends</p>
            <div className="flex flex-wrap gap-2">
              {DILUTION_PRESETS.map(({ pct }) => (
                <button key={pct} type="button" aria-pressed={profile.defaultDilutionPct === pct} onClick={() => void update({ defaultDilutionPct: pct })} className={chip(profile.defaultDilutionPct === pct)}>
                  {pct}%
                </button>
              ))}
            </div>
            {hasKids && <p className="mt-1 text-xs text-stone-600">With children at home, new skin blends start at 1% or less.</p>}
          </div>

          <label className="mt-4 flex items-center justify-between gap-3 text-sm font-medium text-stone-900">
            <span>
              Drops per ml
              <span className="block text-xs font-normal text-stone-600">Droppers vary. 20 is typical.</span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={10}
              max={40}
              value={profile.dropsPerMl}
              onChange={(event) => {
                const value = Math.round(Number(event.target.value))
                if (value >= 10 && value <= 40) void update({ dropsPerMl: value })
              }}
              className={numberField}
            />
          </label>
        </section>

        <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-stone-900 text-base font-semibold text-white">
          Done
        </button>
      </div>
    </Sheet>
  )
}
