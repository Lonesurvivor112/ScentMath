import { FAMILY_COLORS, FAMILY_DESCRIPTIONS, FAMILY_LABELS } from '../data/labels'
import { scentLean, type FamilyShare, type ScentLean } from '../engine/harmony'
import { ScentGuideButton } from './ScentGuide'

const word = (family: FamilyShare['family']) => FAMILY_LABELS[family].toLowerCase()
const pct = (share: number) => Math.max(1, Math.round(share * 100))

function headline(lean: ScentLean): string {
  if (lean.kind === 'mostly') return `Mostly ${word(lean.first)}`
  if (lean.kind === 'even') return `An even mix of ${word(lean.first)} and ${word(lean.second)}`
  return lean.second ? `Leans ${word(lean.first)}, with some ${word(lean.second)}` : `Leans ${word(lean.first)}`
}

/** Where the blend's scent leans, family by family, as one coloured bar. */
export function ScentProfileMeter({ profile }: { profile: readonly FamilyShare[] }) {
  const lean = scentLean(profile)
  if (!lean) return null
  const summary = profile.map((s) => `${FAMILY_LABELS[s.family]} ${pct(s.share)}%`).join(', ')
  const first = profile[0].family

  return (
    <section aria-labelledby="scent-profile-heading" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="scent-profile-heading" className="text-sm font-semibold text-stone-900">
          Scent profile
        </h2>
        <p className="text-right text-sm font-medium text-brand-900">{headline(lean)}</p>
      </div>
      <div
        role="img"
        aria-label={`Scent profile: ${summary}.`}
        className="mt-3 flex h-4 gap-px overflow-hidden rounded-full bg-stone-200"
      >
        {profile.map((s) => (
          <div
            key={s.family}
            style={{ width: `${s.share * 100}%`, background: FAMILY_COLORS[s.family] }}
            className="h-full transition-[width] duration-200"
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-hidden="true">
        {profile.map((s) => (
          <li key={s.family} className="flex items-center gap-1 font-medium text-stone-800">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: FAMILY_COLORS[s.family] }} />
            {FAMILY_LABELS[s.family]} {pct(s.share)}%
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-stone-700">
        <span className="font-medium">{FAMILY_LABELS[first]}:</span> {FAMILY_DESCRIPTIONS[first].smellsLike}
      </p>
      <p className="mt-2 text-xs text-stone-500">Worked out from the drops, with stronger-smelling oils counting more.</p>
      <ScentGuideButton label="What do the scent families mean?" />
    </section>
  )
}
