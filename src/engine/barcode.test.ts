import { describe, expect, it } from 'vitest'
import { BARCODES, OIL_INDEX } from '../data'
import {
  buildBarcodeIndex,
  digitsOnly,
  expandUpcE,
  findBarcode,
  gtinCheckDigit,
  isValidGtin,
  normalizeBarcode,
} from './barcode'

// Plant Therapy Peppermint 10 mL, from the brand's product data.
const PEPPERMINT_10 = '610256943725'

describe('check digits', () => {
  it('computes the GTIN check digit', () => {
    expect(gtinCheckDigit('61025694372')).toBe(5)
    expect(gtinCheckDigit('01234500006')).toBe(5)
    expect(gtinCheckDigit('400638133393')).toBe(1) // EAN-13 4006381333931
  })

  it('accepts valid codes of each length', () => {
    expect(isValidGtin(PEPPERMINT_10)).toBe(true)
    expect(isValidGtin('4006381333931')).toBe(true)
    expect(isValidGtin('96385074')).toBe(true) // EAN-8
    expect(isValidGtin('00012345600012')).toBe(true) // GTIN-14
  })

  it('rejects wrong check digits, wrong lengths and non-digits', () => {
    expect(isValidGtin('610256943724')).toBe(false)
    expect(isValidGtin('61025694372')).toBe(false)
    expect(isValidGtin('6102569437251')).toBe(false)
    expect(isValidGtin('1234567')).toBe(false)
    expect(isValidGtin('61025694372a')).toBe(false)
    expect(isValidGtin('')).toBe(false)
  })
})

describe('expandUpcE', () => {
  it('expands each UPC-E pattern to UPC-A', () => {
    expect(expandUpcE('01234565')).toBe('012345000065')
    expect(expandUpcE('04252614')).toBe('042100005264')
    expect(expandUpcE('01234133')).toBe('012300000413')
  })

  it('returns null for codes that are not UPC-E', () => {
    expect(expandUpcE('96385074')).toBeNull()
    expect(expandUpcE('0123456')).toBeNull()
    expect(expandUpcE('01234566')).toBeNull()
  })
})

describe('normalizeBarcode', () => {
  it('keeps a valid UPC-A as it is', () => {
    expect(normalizeBarcode(PEPPERMINT_10)).toBe(PEPPERMINT_10)
  })

  it('ignores spaces and dashes', () => {
    expect(digitsOnly(' 6-10256 94372-5 ')).toBe(PEPPERMINT_10)
    expect(normalizeBarcode('6 10256 94372 5')).toBe(PEPPERMINT_10)
  })

  it('treats an EAN-13 with a leading 0 as the same UPC-A', () => {
    expect(normalizeBarcode(`0${PEPPERMINT_10}`)).toBe(PEPPERMINT_10)
    expect(normalizeBarcode(`00${PEPPERMINT_10}`)).toBe(PEPPERMINT_10)
  })

  it('keeps a true EAN-13', () => {
    expect(normalizeBarcode('4006381333931')).toBe('4006381333931')
  })

  it('expands UPC-E only when the scanner says it is UPC-E', () => {
    expect(normalizeBarcode('01234565', 'upc_e')).toBe('012345000065')
    expect(normalizeBarcode('96385074', 'ean_8')).toBe('96385074')
    expect(normalizeBarcode('96385074')).toBe('96385074')
  })

  it('returns null for anything that is not a product barcode', () => {
    expect(normalizeBarcode('610256943724')).toBeNull()
    expect(normalizeBarcode('12345')).toBeNull()
    expect(normalizeBarcode('hello')).toBeNull()
    expect(normalizeBarcode('')).toBeNull()
  })
})

describe('barcode index', () => {
  it('finds a shipped product however the code is formatted', () => {
    const index = buildBarcodeIndex(BARCODES)
    for (const raw of [PEPPERMINT_10, `0${PEPPERMINT_10}`, '6 10256 94372 5']) {
      const entry = findBarcode(raw, index)
      expect(entry?.oilId, raw).toBe('peppermint')
      expect(entry?.sizeMl).toBe(10)
      expect(entry?.brand).toBe('Plant Therapy')
    }
  })

  it('returns nothing for unknown or invalid codes', () => {
    const index = buildBarcodeIndex(BARCODES)
    expect(findBarcode('4006381333931', index)).toBeUndefined()
    expect(findBarcode('not a code', index)).toBeUndefined()
  })

  it('lets a learned barcode add to and override the shipped table', () => {
    const index = buildBarcodeIndex(BARCODES, [
      { code: '4006381333931', oilId: 'ylang-ylang', brand: 'Cliganic', sizeMl: 10 },
      { code: PEPPERMINT_10, oilId: 'spearmint' },
    ])
    expect(findBarcode('4006381333931', index)?.brand).toBe('Cliganic')
    expect(findBarcode(PEPPERMINT_10, index)?.oilId).toBe('spearmint')
  })
})

describe('shipped barcode table', () => {
  it('holds only valid, normalized codes for oils in the library', () => {
    expect(BARCODES.length).toBeGreaterThan(40)
    for (const entry of BARCODES) {
      expect(normalizeBarcode(entry.code), entry.code).toBe(entry.code)
      expect(OIL_INDEX.has(entry.oilId), entry.code).toBe(true)
    }
  })

  it('covers the starter shelf oils that Plant Therapy sells on their own', () => {
    const covered = new Set(BARCODES.map((entry) => entry.oilId))
    for (const id of ['peppermint', 'lavender', 'lemon', 'tea-tree', 'germ-fighter', 'holiday-season']) {
      expect(covered.has(id), id).toBe(true)
    }
  })
})
