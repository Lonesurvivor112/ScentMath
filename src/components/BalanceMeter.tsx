import { NOTE_LABELS } from '../data/labels'
import { NOTES, type Note } from '../data/schema'
import { NOTE_TARGET, type HarmonyResult } from '../engine/harmony'

interface BalanceMeterProps {
  /** Share of the blend in each note, 0 to 1. */
  notes: Record<Note, number>
  /** Null until the blend has two oils. */
  harmony: HarmonyResult | null
}

const NOTE_COLORS: Record<Note, string> = {
  top: '#E9B949',
  middle: '#2F6B5C',
  base: '#6C5A4A',
}

const NOTE_HINTS: Record<Note, string> = {
  top: 'first to fade',
  middle: 'the heart',
  base: 'lasts longest',
}

function harmonyWord(score: number): string {
  if (score >= 80) return 'In harmony'
  if (score >= 60) return 'Works well'
  if (score >= 40) return 'A bold mix'
  return 'Likely to clash'
}

const pct = (share: number): number => Math.round(share * 100)

/** The top, middle and base mix against its target, with the harmony score. */
export function BalanceMeter({ notes, harmony }: BalanceMeterProps) {
  const summary = NOTES.map((note) => `${NOTE_LABELS[note]} ${pct(notes[note])}%`).join(', ')

  return (
    <section aria-labelledby="balance-heading" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div>
        <div className="flex items-end justify-between gap-4">
          <h2 id="balance-heading" className="text-sm font-semibold text-stone-900">
            Balance
          </h2>
          {harmony ? (
            <p className="text-right text-sm text-stone-700" aria-label={`Harmony score ${harmony.score} out of 100. ${harmonyWord(harmony.score)}.`}>
              Harmony <span className="mx-1 text-3xl leading-none font-semibold text-brand-900">{harmony.score}</span>
              <span className="font-medium">{harmonyWord(harmony.score)}</span>
            </p>
          ) : (
            <p className="text-right text-xs text-stone-500">Add a second oil for a harmony score</p>
          )}
        </div>
        <div>
          <div
            role="img"
            aria-label={`Note balance: ${summary}. The aim is about 30% top, 50% middle and 20% base.`}
            className="relative mt-3"
          >
            <div className="flex h-4 overflow-hidden rounded-full bg-stone-200">
              {NOTES.map((note) => (
                <div
                  key={note}
                  style={{ width: `${notes[note] * 100}%`, background: NOTE_COLORS[note] }}
                  className="h-full transition-[width] duration-200"
                />
              ))}
            </div>
            {/* Where the top|middle and middle|base boundaries sit on target. */}
            {[NOTE_TARGET.top, NOTE_TARGET.top + NOTE_TARGET.middle].map((at) => (
              <span
                key={at}
                aria-hidden="true"
                className="absolute -top-1 h-6 w-0.5 rounded bg-stone-900/70"
                style={{ left: `${at * 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-1 text-xs" aria-hidden="true">
            {NOTES.map((note) => (
              <li key={note}>
                <span className="flex items-center gap-1 font-medium text-stone-800">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: NOTE_COLORS[note] }} />
                  {NOTE_LABELS[note]} {pct(notes[note])}%
                </span>
                <span className="block text-stone-500">
                  aim {pct(NOTE_TARGET[note])}%, {NOTE_HINTS[note]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs text-stone-500">The marks show the target mix. It's a guide, not a rule: your nose decides.</p>
    </section>
  )
}
