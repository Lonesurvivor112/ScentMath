import { describe, expect, it } from 'vitest'
import { STARTER_SHELF } from '../data'
import type { ShelfItem } from '../data/schema'
import {
  COMMON_SIZES_ML,
  DEFAULT_SIZE_ML,
  findMatchingItem,
  getMoreItems,
  ownedOilIds,
  shelfSummary,
  shoppingListText,
} from './shelf'

const shelf: ShelfItem[] = [
  { oilId: 'lavender', brand: 'Plant Therapy', sizeMl: 10, count: 2 },
  { oilId: 'lemon', brand: 'Plant Therapy', sizeMl: 10, count: 1, empty: true },
  { oilId: 'peppermint', brand: 'Plant Therapy', sizeMl: 10, count: 3 },
  { oilId: 'peppermint', brand: 'Plant Therapy', sizeMl: 30, count: 1 },
  { oilId: 'ylang-ylang', brand: 'Cliganic', sizeMl: 10, count: 1, empty: true },
]

describe('owned oils', () => {
  it('leaves out oils marked empty', () => {
    expect([...ownedOilIds(shelf)].sort()).toEqual(['lavender', 'peppermint'])
  })

  it('still counts an oil when only one of its entries is empty', () => {
    const mixed: ShelfItem[] = [
      { oilId: 'lemon', sizeMl: 10, count: 1, empty: true },
      { oilId: 'lemon', sizeMl: 30, count: 1 },
    ]
    expect(ownedOilIds(mixed).has('lemon')).toBe(true)
  })

  it('counts the whole starter shelf', () => {
    expect(ownedOilIds(STARTER_SHELF).size).toBe(21)
  })
})

describe('get more list', () => {
  it('holds the entries marked empty', () => {
    expect(getMoreItems(shelf).map((item) => item.oilId)).toEqual(['lemon', 'ylang-ylang'])
    expect(getMoreItems(STARTER_SHELF)).toEqual([])
  })

  it('reads as a plain text shopping list in name order', () => {
    const names: Record<string, string> = { lemon: 'Lemon', 'ylang-ylang': 'Ylang Ylang' }
    expect(shoppingListText(shelf, (id) => names[id] ?? id)).toBe(
      'Essential oils to get:\n- Lemon (Plant Therapy, 10 ml)\n- Ylang Ylang (Cliganic, 10 ml)',
    )
  })

  it('leaves out the brand when there is none, and is empty when nothing is needed', () => {
    const items: ShelfItem[] = [{ oilId: 'lemon', sizeMl: 15, count: 1, empty: true }]
    expect(shoppingListText(items, () => 'Lemon')).toBe('Essential oils to get:\n- Lemon (15 ml)')
    expect(shoppingListText(STARTER_SHELF, (id) => id)).toBe('')
  })
})

describe('findMatchingItem', () => {
  it('joins a bottle with the same oil, brand and size', () => {
    const match = findMatchingItem(shelf, { oilId: 'peppermint', brand: 'plant therapy ', sizeMl: 30 })
    expect(match).toBe(shelf[3])
  })

  it('starts a new entry for a different brand or size', () => {
    expect(findMatchingItem(shelf, { oilId: 'peppermint', brand: 'Plant Therapy', sizeMl: 15 })).toBeUndefined()
    expect(findMatchingItem(shelf, { oilId: 'lavender', brand: 'Cliganic', sizeMl: 10 })).toBeUndefined()
    expect(findMatchingItem(shelf, { oilId: 'geranium', brand: 'Plant Therapy', sizeMl: 10 })).toBeUndefined()
  })

  it('joins the only entry for an oil when no brand is given', () => {
    expect(findMatchingItem(shelf, { oilId: 'lavender', sizeMl: 30 })).toBe(shelf[0])
  })

  it('prefers the same size when an oil has several entries and no brand is given', () => {
    expect(findMatchingItem(shelf, { oilId: 'peppermint', sizeMl: 30 })).toBe(shelf[3])
    expect(findMatchingItem(shelf, { oilId: 'peppermint', sizeMl: 5 })).toBe(shelf[2])
  })

  it('finds nothing on an empty shelf', () => {
    expect(findMatchingItem([], { oilId: 'lavender', sizeMl: 10 })).toBeUndefined()
  })
})

describe('shelfSummary', () => {
  it('counts oils and bottles that are not empty, and the get more list', () => {
    expect(shelfSummary(shelf)).toEqual({ oils: 2, bottles: 6, toGet: 2 })
    expect(shelfSummary(STARTER_SHELF)).toEqual({ oils: 21, bottles: 26, toGet: 0 })
    expect(shelfSummary([])).toEqual({ oils: 0, bottles: 0, toGet: 0 })
  })
})

describe('bottle sizes', () => {
  it('offers the default size as a one-tap choice', () => {
    expect(COMMON_SIZES_ML).toContain(DEFAULT_SIZE_ML)
  })
})
