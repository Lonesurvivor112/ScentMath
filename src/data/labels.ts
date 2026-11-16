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
