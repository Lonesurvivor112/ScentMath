import type { ShelfItem } from '../data/schema'

/**
 * Rules for the shelf itself: which bottles count as owned, when a new
 * bottle joins an existing entry, and the "Get more" list.
 */

/** Bottle sizes offered as one-tap choices, in ml. */
export const COMMON_SIZES_ML: readonly number[] = [5, 10, 15, 30]

export const DEFAULT_SIZE_ML = 10

const sameBrand = (a?: string, b?: string): boolean =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/**
 * The oils available to blend with right now. An oil marked empty stays on
 * the shelf as a reminder, but doesn't count as owned.
 */
export function ownedOilIds(items: readonly ShelfItem[]): Set<string> {
  const owned = new Set<string>()
  for (const item of items) if (!item.empty) owned.add(item.oilId)
  return owned
}

/** The entries marked empty: the "Get more" list. */
export function getMoreItems<T extends ShelfItem>(items: readonly T[]): T[] {
  return items.filter((item) => item.empty === true)
}

/**
 * The shelf entry a new bottle should be added to, if any. A bottle with a
 * known brand joins an entry for the same oil, brand and size. A bottle
 * added without a brand (from search) joins the oil's only entry, or the one
 * with the same size, so a quick add doesn't create a duplicate.
 */
export function findMatchingItem<T extends ShelfItem>(
  items: readonly T[],
  candidate: Pick<ShelfItem, 'oilId' | 'brand' | 'sizeMl'>,
): T | undefined {
  const sameOil = items.filter((item) => item.oilId === candidate.oilId)
  if (sameOil.length === 0) return undefined
  if (candidate.brand) {
    return sameOil.find(
      (item) => sameBrand(item.brand, candidate.brand) && item.sizeMl === candidate.sizeMl,
    )
  }
  if (sameOil.length === 1) return sameOil[0]
  return sameOil.find((item) => item.sizeMl === candidate.sizeMl) ?? sameOil[0]
}

export interface ShelfSummary {
  /** Different oils with at least one bottle that isn't empty. */
  oils: number
  /** Bottles that aren't empty. */
  bottles: number
  /** Entries on the "Get more" list. */
  toGet: number
}

export function shelfSummary(items: readonly ShelfItem[]): ShelfSummary {
  let bottles = 0
  let toGet = 0
  for (const item of items) {
    if (item.empty) toGet += 1
    else bottles += item.count
  }
  return { oils: ownedOilIds(items).size, bottles, toGet }
}

/** The "Get more" list as plain text, ready to copy or share. */
export function shoppingListText(
  items: readonly ShelfItem[],
  nameOf: (oilId: string) => string,
): string {
  const lines = getMoreItems(items)
    .map((item) => {
      const details = [item.brand, `${item.sizeMl} ml`].filter(Boolean).join(', ')
      return `- ${nameOf(item.oilId)} (${details})`
    })
    .sort((a, b) => a.localeCompare(b))
  return lines.length === 0 ? '' : `Essential oils to get:\n${lines.join('\n')}`
}
