import type { SafetyIssue, Severity } from '../engine/safety'
import { worstSeverity } from '../engine/safety'

interface SafetyBannerProps {
  issues: readonly SafetyIssue[]
  /** Opens the short "about this safety info" note. */
  onAbout: () => void
  /** Opens the household settings the checks depend on. */
  onHousehold?: () => void
}

const TONE: Record<Severity, { box: string; tag: string; label: string }> = {
  block: { box: 'bg-red-50 ring-red-300', tag: 'bg-red-700 text-white', label: "Don't use" },
  warn: { box: 'bg-amber-50 ring-amber-300', tag: 'bg-amber-700 text-white', label: 'Warning' },
  caution: { box: 'bg-sky-50 ring-sky-200', tag: 'bg-sky-700 text-white', label: 'Take care' },
  unverified: { box: 'bg-stone-100 ring-stone-300', tag: 'bg-stone-600 text-white', label: 'Not verified' },
}

const HEADINGS: Record<Severity, string> = {
  block: 'This blend has an oil that should not be used this way',
  warn: 'Check these before using this blend',
  caution: 'A few things to keep in mind',
  unverified: 'Some safety data is missing',
}

/** Every safety note for the blend, most serious first. Always visible. */
export function SafetyBanner({ issues, onAbout, onHousehold }: SafetyBannerProps) {
  const worst = worstSeverity(issues)

  return (
    <section
      aria-labelledby="safety-heading"
      className={`rounded-2xl p-4 ring-1 ${worst ? TONE[worst].box : 'bg-emerald-50 ring-emerald-200'}`}
    >
      <h2 id="safety-heading" className="text-sm font-semibold text-stone-900">
        {worst ? HEADINGS[worst] : 'No cautions found for this blend'}
      </h2>
      {!worst && (
        <p className="mt-1 text-sm text-stone-700">
          Nothing in the app's safety data flags this blend for the method and household you set.
        </p>
      )}

      {issues.length > 0 && (
        <ul className="mt-3 space-y-3">
          {issues.map((issue) => (
            <li key={`${issue.rule}-${issue.oilIds.join('-')}`}>
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${TONE[issue.severity].tag}`}>
                  {TONE[issue.severity].label}
                </span>
                {issue.title}
              </p>
              <p className="mt-1 text-sm text-stone-800">{issue.detail}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4">
        <button type="button" onClick={onAbout} className="min-h-11 text-sm font-semibold text-brand-700 underline underline-offset-2">
          About this safety info
        </button>
        {onHousehold && (
          <button type="button" onClick={onHousehold} className="min-h-11 text-sm font-semibold text-brand-700 underline underline-offset-2">
            Household settings
          </button>
        )}
      </div>
    </section>
  )
}

/** The short disclaimer every blend screen links to. */
export function SafetyAbout() {
  return (
    <div className="space-y-3 pt-1 text-sm text-stone-800">
      <p>
        ScentMath gives scent and safety guidance only. It is not medical advice, and it makes no
        claim that any oil or blend treats, cures or prevents any condition.
      </p>
      <p>
        The safety notes come from Plant Therapy's published product guidance and the Tisserand
        Institute. They cover sun sensitivity, skin limits, young children, pregnancy, cats and old
        bottles. Oils marked "not verified" have not been checked yet, so treat them with extra care.
      </p>
      <p>
        Always dilute before putting oils on skin, try a small patch first, and stop if your skin
        reacts. Keep oils away from eyes and out of reach of children and pets. If you are pregnant,
        nursing, taking medication or have a health condition, check with a doctor first.
      </p>
    </div>
  )
}
