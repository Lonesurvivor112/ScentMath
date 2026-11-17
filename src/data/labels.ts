import type { Family, Method, Mood, Note } from './schema'

/** Display names and colors. Plain data, so the engine can use it too. */

export const FAMILY_LABELS: Record<Family, string> = {
  citrus: 'Citrus',
  floral: 'Floral',
  herbaceous: 'Herbaceous',
  minty: 'Minty',
  camphoraceous: 'Camphoraceous',
  woody: 'Woody',
  resinous: 'Resinous',
  spicy: 'Spicy',
  earthy: 'Earthy',
  sweet: 'Sweet',
}

/** What each scent family smells like, in everyday words, with examples. */
export const FAMILY_DESCRIPTIONS: Record<Family, { smellsLike: string; examples: string }> = {
  citrus: {
    smellsLike: 'Bright, juicy and zesty, like freshly peeled fruit.',
    examples: 'Lemon, sweet orange, grapefruit, bergamot',
  },
  floral: {
    smellsLike: 'Soft and sweet, like fresh flowers.',
    examples: 'Lavender, ylang ylang, geranium, rose',
  },
  herbaceous: {
    smellsLike: 'Green and leafy, like fresh kitchen herbs.',
    examples: 'Rosemary, clary sage, basil, marjoram',
  },
  minty: {
    smellsLike: 'Cool, crisp and sharp, like chewing gum or toothpaste.',
    examples: 'Peppermint, spearmint',
  },
  camphoraceous: {
    smellsLike: 'Strong, clean and cooling, like a vapor rub or a spa steam room.',
    examples: 'Eucalyptus, tea tree, ravintsara',
  },
  woody: {
    smellsLike: 'Warm and dry, like a forest or freshly cut wood.',
    examples: 'Cedarwood, sandalwood, cypress, fir',
  },
  resinous: {
    smellsLike: 'Deep, warm and a little sweet, like incense or tree sap.',
    examples: 'Frankincense, myrrh, copaiba',
  },
  spicy: {
    smellsLike: 'Warm with a kick, like a spice rack or holiday baking.',
    examples: 'Cinnamon, clove, ginger, cardamom',
  },
  earthy: {
    smellsLike: 'Rich, deep and musky, like damp soil after rain.',
    examples: 'Patchouli, vetiver',
  },
  sweet: {
    smellsLike: 'Soft and sugary, like dessert.',
    examples: 'Vanilla, benzoin, tonka bean',
  },
}

/** What top, middle and base mean, in everyday words. */
export const NOTE_DESCRIPTIONS: Record<Note, string> = {
  top: 'The first thing you smell. Light and bright, and the first to fade.',
  middle: 'The heart of the blend. It comes through after the top notes and lasts longer.',
  base: 'Deep and slow. It lingers the longest and holds the blend together.',
}

/** Cap colors for the shelf grid. */
export const FAMILY_COLORS: Record<Family, string> = {
  citrus: '#F2A93B',
  floral: '#D46A9F',
  herbaceous: '#6E9F45',
  minty: '#2FB59A',
  camphoraceous: '#4B9CC9',
  woody: '#8C6142',
  resinous: '#C28B3C',
  spicy: '#C4472E',
  earthy: '#6C5A4A',
  sweet: '#E5A3B5',
}

export const MOOD_LABELS: Record<Mood, string> = {
  energize: 'Energize',
  focus: 'Focus',
  calm: 'Calm',
  sleep: 'Sleep',
  uplift: 'Uplift',
  fresh: 'Fresh and clean',
  cozy: 'Cozy',
  breathe: 'Breathe easy',
  deodorize: 'Deodorize',
  // Names the occasion, not an effect: the app makes no health claims.
  sickday: 'Sick-day comfort',
}

export const NOTE_LABELS: Record<Note, string> = {
  top: 'Top',
  middle: 'Middle',
  base: 'Base',
}

export const METHOD_LABELS: Record<Method, string> = {
  diffuser: 'Diffuser',
  roller: 'Roller',
  massage: 'Massage oil',
}
