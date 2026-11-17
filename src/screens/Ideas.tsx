import { useMemo, useState } from 'react'
import { MoodChips } from '../components/MoodChips'
import { capBackground } from '../components/OilCap'
import { COMPAT, RECIPES } from '../data'
import { MOOD_LABELS } from '../data/labels'
import type { Mood } from '../data/schema'
import { evaluateDraft, recipeToDraft } from '../engine/builder'
import { ingredientsLine } from '../engine/catalog'
import { generateIdeas, matchRecipes, type RecipeMatch } from '../engine/ideas'
import type { OilIndex } from '../engine/resolve'
import { worstSeverity } from '../engine/safety'
import { ownedOilIds } from '../engine/shelf'
import { useNav } from '../store/nav'
import { useOilIndex } from '../store/oils'
import { useProfile } from '../store/profile'
import { useShelf } from '../store/shelf'
import { useOpenInBuild } from './useOpenInBuild'

interface IdeaCardProps {
  match: RecipeMatch
  oils: OilIndex
  /** Drops per oil at the user's usual diffuser size. */
  drops: ReadonlyMap<string, number>
  /** True when the blend has a warning for this household. */
  caution: boolean
  onOpen: () => void
}

function IdeaCard({ match, oils, drops, caution, onOpen }: IdeaCardProps) {
  const { recipe, missing, harmony } = match
  const nameOf = (id: string) => oils.get(id)?.name ?? id
  const madeOf = (id: string) => {
    const oil = oils.get(id)
    return oil ? ingredientsLine(oil, oils, 5) : null
  }
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${recipe.name}. Open in Build`}
        className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 active:bg-stone-50"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-base font-semibold text-stone-900">{recipe.name}</span>
            <span className="block text-xs font-medium text-brand-700">{MOOD_LABELS[recipe.goal]}</span>
          </span>
          {harmony !== null && (
            <span className="shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-center text-xs text-brand-900">
              <span className="block text-base leading-none font-semibold">{harmony}</span>
              harmony
            </span>
          )}
        </span>
        <span className="mt-3 block space-y-1.5">
          {recipe.items.map((item) => {
            const isMissing = missing.includes(item.oilId)
            return (
              <span key={item.oilId} className="flex items-center gap-2 text-sm text-stone-800">
                <span
                  aria-hidden="true"
                  className={`h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10 ${isMissing ? 'opacity-35 grayscale' : ''}`}
                  style={{ background: capBackground(oils.get(item.oilId)?.families ?? []) }}
                />
                <span className="w-5 shrink-0 text-right font-semibold tabular-nums">{drops.get(item.oilId) ?? item.parts}</span>
                <span className={`min-w-0 ${isMissing ? 'text-stone-500' : ''}`}>
                  {nameOf(item.oilId)}
                  {madeOf(item.oilId) && <span className="block text-xs text-stone-500">Made of {madeOf(item.oilId)}</span>}
                </span>
                {isMissing && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">Need this</span>
                )}
              </span>
            )
          })}
        </span>
        {caution && (
          <span className="mt-3 block rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-950 ring-1 ring-amber-200">
            Has safety notes for your household. Open it to read them.
          </span>
        )}
      </button>
    </li>
  )
}

/** Start from a goal: recipes the shelf can make, and ideas built from it. */
export function Ideas() {
  const shelf = useShelf((state) => state.items)
  const shelfReady = useShelf((state) => state.status === 'ready')
  const profile = useProfile((state) => state.profile)
  const oils = useOilIndex()
  const go = useNav((state) => state.go)
  const { open, sheet } = useOpenInBuild()
  const [mood, setMood] = useState<Mood | undefined>(undefined)

  const owned = useMemo(() => ownedOilIds(shelf), [shelf])
  const matches = useMemo(() => matchRecipes(RECIPES, owned, oils, COMPAT, mood), [owned, oils, mood])
  const ideas = useMemo(
    () =>
      mood
        ? generateIdeas(mood, { owned, oils, compat: COMPAT, profile, settings: profile, recipes: RECIPES })
        : [],
    [mood, owned, oils, profile],
  )

  /** Drops and safety for a card, worked out the same way Build will. */
  const preview = useMemo(() => {
    const cache = new Map<string, { drops: Map<string, number>; caution: boolean }>()
    return (match: RecipeMatch) => {
      const hit = cache.get(match.recipe.id)
      if (hit) return hit
      const view = evaluateDraft(recipeToDraft(match.recipe, profile), { profile, oils, compat: COMPAT, owned })
      const worst = worstSeverity(view.issues)
      const entry = {
        drops: new Map(view.calc.lines.map((line) => [line.oilId, line.drops])),
        caution: worst === 'block' || worst === 'warn',
      }
      cache.set(match.recipe.id, entry)
      return entry
    }
  }, [profile, oils, owned])

  const card = (match: RecipeMatch) => {
    const { drops, caution } = preview(match)
    return (
      <IdeaCard
        key={match.recipe.id}
        match={match}
        oils={oils}
        drops={drops}
        caution={caution}
        onOpen={() => open(recipeToDraft(match.recipe, profile))}
      />
    )
  }

  const nothing = matches.ready.length === 0 && matches.missingOne.length === 0 && ideas.length === 0

  return (
    <section aria-labelledby="ideas-heading" className="space-y-5 px-4 pt-6 pb-8">
      <header>
        <h1 id="ideas-heading" className="text-2xl font-semibold text-brand-900">
          Ideas
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          What you can make with your shelf. Drops are for a {profile.diffuserMl} ml diffuser.
        </p>
      </header>

      <div>
        <p className="mb-2 text-sm font-medium text-stone-800">What are you in the mood for?</p>
        <MoodChips label="Mood" value={mood} onChange={setMood} />
      </div>

      {!shelfReady && (
        <p role="status" className="text-sm text-stone-600">
          Opening your shelf…
        </p>
      )}

      {shelfReady && owned.size === 0 && (
        <div className="rounded-2xl bg-white p-5 text-sm text-stone-700 shadow-sm ring-1 ring-stone-200">
          <p className="font-semibold text-stone-900">Your shelf has no oils yet</p>
          <p className="mt-1">Add the oils you own and ideas will appear here.</p>
          <button type="button" onClick={() => go('shelf')} className="mt-3 min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">
            Go to your shelf
          </button>
        </div>
      )}

      {shelfReady && owned.size > 0 && nothing && (
        <p className="rounded-2xl bg-white p-5 text-sm text-stone-700 shadow-sm ring-1 ring-stone-200">
          Nothing on your shelf fits {mood ? MOOD_LABELS[mood] : 'that'} yet. Try another mood, or add a few more oils.
        </p>
      )}

      {matches.ready.length > 0 && (
        <section aria-labelledby="ready-heading">
          <h2 id="ready-heading" className="mb-2 text-sm font-semibold tracking-wide text-stone-700 uppercase">
            You can make <span className="font-normal text-stone-500">{matches.ready.length}</span>
          </h2>
          <ul className="space-y-3">{matches.ready.map(card)}</ul>
        </section>
      )}

      {ideas.length > 0 && (
        <section aria-labelledby="generated-heading">
          <h2 id="generated-heading" className="text-sm font-semibold tracking-wide text-stone-700 uppercase">
            Built from your shelf <span className="font-normal text-stone-500">{ideas.length}</span>
          </h2>
          <p className="mb-2 text-xs text-stone-500">Worked out from how your oils pair. Not tried recipes, so trust your nose.</p>
          <ul className="space-y-3">{ideas.map(card)}</ul>
        </section>
      )}

      {!mood && shelfReady && owned.size > 1 && (
        <p className="text-sm text-stone-600">Pick a mood above for more ideas built from your own oils.</p>
      )}

      {matches.missingOne.length > 0 && (
        <section aria-labelledby="missing-heading">
          <h2 id="missing-heading" className="mb-2 text-sm font-semibold tracking-wide text-stone-700 uppercase">
            Missing 1 oil <span className="font-normal text-stone-500">{matches.missingOne.length}</span>
          </h2>
          <ul className="space-y-3">{matches.missingOne.map(card)}</ul>
        </section>
      )}

      {sheet}
    </section>
  )
}
