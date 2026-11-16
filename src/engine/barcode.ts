import type { BarcodeEntry } from '../data/schema'

/**
 * Barcode handling for adding bottles by scanning. Retail bottles carry a
 * UPC-A (12 digits) or EAN-13 (13 digits) code; small labels sometimes use
 * the compressed UPC-E (8 digits). Everything here is plain digits in,
 * plain digits out, so it can be tested without a camera.
 */

export type BarcodeFormat = 'upc_a' | 'upc_e' | 'ean_13' | 'ean_8' | 'other'

export type BarcodeIndex = ReadonlyMap<string, BarcodeEntry>

const GTIN_LENGTHS = new Set([8, 12, 13, 14])

/** Strips spaces, dashes and anything else that isn't a digit. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * The check digit for a run of digits that doesn't include one yet, using
 * the standard GTIN rule: weights of 3 and 1 alternating from the right.
 */
export function gtinCheckDigit(body: string): number {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48
    sum += digit * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10
}

/** True for 8, 12, 13 or 14 digits whose last digit is the right check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || !GTIN_LENGTHS.has(code.length)) return false
  return gtinCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1])
}

/**
 * Expands an 8-digit UPC-E code to the 12-digit UPC-A code it stands for.
 * Returns null if it isn't a UPC-E code (those start with 0 or 1).
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const system = code[0]
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7)
  const check = code[7]
  let body: string
  if (d6 === '0' || d6 === '1' || d6 === '2') body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`
  const expanded = `${system}${body}${check}`
  return isValidGtin(expanded) ? expanded : null
}

/**
 * Turns whatever the scanner or the user gave us into one standard form, so
 * the same bottle always produces the same code:
 * - a UPC-E code is expanded to UPC-A
 * - an EAN-13 that is just a UPC-A with a leading 0 loses the 0
 * Returns null for anything that isn't a valid product barcode.
 */
export function normalizeBarcode(raw: string, format?: BarcodeFormat): string | null {
  let code = digitsOnly(raw)
  if (code.length === 8 && format === 'upc_e') {
    const expanded = expandUpcE(code)
    if (!expanded) return null
    code = expanded
  }
  if (!isValidGtin(code)) return null
  if (code.length === 14 && code.startsWith('0')) code = code.slice(1)
  if (code.length === 13 && code.startsWith('0')) code = code.slice(1)
  return code
}

/**
 * One lookup table from the barcodes that ship with the app plus the ones
 * learned on this device. A learned barcode wins, so a user can correct a
 * shipped entry by matching it again.
 */
export function buildBarcodeIndex(
  shipped: readonly BarcodeEntry[],
  learned: readonly BarcodeEntry[] = [],
): Map<string, BarcodeEntry> {
  const index = new Map<string, BarcodeEntry>()
  for (const entry of shipped) index.set(entry.code, entry)
  for (const entry of learned) index.set(entry.code, entry)
  return index
}

/** Finds the product for a scanned or typed code, however it was formatted. */
export function findBarcode(
  raw: string,
  index: BarcodeIndex,
  format?: BarcodeFormat,
): BarcodeEntry | undefined {
  const code = normalizeBarcode(raw, format)
  return code ? index.get(code) : undefined
}
