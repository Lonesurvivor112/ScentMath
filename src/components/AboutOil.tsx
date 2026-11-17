import { useMemo } from 'react'
import {
  FAMILY_COLORS,
  FAMILY_DESCRIPTIONS,
  FAMILY_LABELS,
  MOOD_LABELS,
  NOTE_DESCRIPTIONS,
  NOTE_LABELS,
} from '../data/labels'
import { ingredientNames } from '../engine/catalog'
import type { ResolvedOil } from '../engine/resolve'
import { ownedOilIds } from '../engine/shelf'
import { useOilIndex } from '../store/oils'
import { useShelf } from '../store/shelf'
import { ScentGuideButton } from './ScentGuide'

const termClass = 'text-xs font-semibold tracking-wide text-stone-600 uppercase'

/**
 * Everything the library knows about an oil, in plain words: what a blend is
 * made of, how it smells, its note and strength, the goals it fits and what
 * it pairs with (oils on the shelf are outlined).
 */
export function AboutOil({ oil }: { oil: ResolvedOil }) {
  const oils = useOilIndex()
  const items = useShelf((state) => state.items)
  const owned = useMemo(() => ownedOilIds(items), [items])
  const ingredients = ingredientNames(oil, oils)
  const pairs = oil.affinities
    .map((id) => oils.get(id))
    .filter((pair): pair is ResolvedOil => pair !== undefined)
    .sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)) || a.name.localeCompare(b.name))

  return (
    <section aria-labelledby={`about-${oil.id}`} className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
      <h3 id={`about-${oil.id}`} className="text-sm font-semibold text-stone-900">
        About this {oil.kind === 'blend' ? 'blend' : 'oil'}
      </h3>
      {oil.latinName && <p className="text-xs text-stone-500 italic">{oil.latinName}</p>}
      <dl className="mt-2 space-y-2.5 text-sm">
        {ingredients.length > 0 && (
          <div>
            <dt className={termClass}>Made of ({ingredients.length})</dt>
            <dd className="mt-1">
              <ul className="flex flex-wrap gap-1.5">
                {ingredients.map((ingredient) => (
                  <li key={ingredient} className="rounded-full bg-stone-100 px-2.5 py-1 text-sm text-stone-800">
                    {ingredient}
                  </li>
                ))}
              </ul>
              {oil.componentsNote && <p className="mt-1 text-xs text-stone-500">{oil.componentsNote}</p>}
            </dd>
          </div>
        )}
        {oil.families.length > 0 && (
          <div>
            <dt className={termClass}>Smells</dt>
            {oil.families.map((family) => (
              <dd key={family} className="mt-1 flex gap-2 text-stone-800">
                <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FAMILY_COLORS[family] }} />
                <span>
                  <span className="font-medium">{FAMILY_LABELS[family]}:</span> {FAMILY_DESCRIPTIONS[family].smellsLike}
                </span>
              </dd>
            ))}
          </div>
        )}
        <div>
          <dt className={termClass}>Note</dt>
          <dd className="mt-1 text-stone-800">
            <span className="font-medium">{NOTE_LABELS[oil.note]}:</span> {NOTE_DESCRIPTIONS[oil.note]}
          </dd>
        </div>
        <div>
          <dt className={termClass}>Scent strength</dt>
          <dd className="mt-1 text-stone-800">
            {oil.intensity} out of 5{oil.intensity >= 4 ? '. A little goes a long way.' : ''}
          </dd>
        </div>
        {oil.moods.length > 0 && (
          <div>
            <dt className={termClass}>Goals it fits</dt>
            <dd className="mt-1 text-stone-800">{oil.moods.map((mood) => MOOD_LABELS[mood]).join(', ')}</dd>
          </div>
        )}
        {pairs.length > 0 && (
          <div>
            <dt className={termClass}>Pairs well with</dt>
            <dd className="mt-1">
              <ul className="flex flex-wrap gap-1.5">
                {pairs.map((pair) => (
                  <li
                    key={pair.id}
                    className={`rounded-full px-2.5 py-1 text-sm ${
                      owned.has(pair.id) ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-600' : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {pair.name}
                    {owned.has(pair.id) && <span className="sr-only"> (on your shelf)</span>}
                  </li>
                ))}
              </ul>
              {pairs.some((pair) => owned.has(pair.id)) && (
                <p className="mt-1 text-xs text-stone-500">Outlined ones are on your shelf.</p>
              )}
            </dd>
          </div>
        )}
      </dl>
      <ScentGuideButton label="What do these words mean?" />
    </section>
  )
}
