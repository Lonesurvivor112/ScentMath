import { z } from 'zod'

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const FAMILIES = [
  'citrus',
  'floral',
  'herbaceous',
  'minty',
  'camphoraceous',
  'woody',
  'resinous',
  'spicy',
  'earthy',
  'sweet',
] as const

export const NOTES = ['top', 'middle', 'base'] as const

export const MOODS = [
  'energize',
  'focus',
  'calm',
  'sleep',
  'uplift',
  'fresh',
  'cozy',
  'breathe',
] as const

export const METHODS = ['diffuser', 'roller', 'massage'] as const

export const FamilySchema = z.enum(FAMILIES)
export const NoteSchema = z.enum(NOTES)
export const MoodSchema = z.enum(MOODS)
export const MethodSchema = z.enum(METHODS)
export const IntensitySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

export type Family = z.infer<typeof FamilySchema>
export type Note = z.infer<typeof NoteSchema>
export type Mood = z.infer<typeof MoodSchema>
export type Method = z.infer<typeof MethodSchema>
export type Intensity = z.infer<typeof IntensitySchema>

const IdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids are lowercase-kebab-case')

const PctSchema = z.number().positive().max(100)

// ---------------------------------------------------------------------------
// Oils
// ---------------------------------------------------------------------------

/**
 * How far an oil's safety values have been checked against a cited source:
 * - none: nothing checked yet. Numeric limits are not allowed.
 * - partial: the values present are sourced, but not every rule was checked.
 * - full: every rule (sun, skin maximum, children, pregnancy, cats,
 *   oxidation) was checked against the sources named in `source`.
 */
export const REVIEW_LEVELS = ['none', 'partial', 'full'] as const
export const ReviewSchema = z.enum(REVIEW_LEVELS)
export type Review = z.infer<typeof ReviewSchema>

/**
 * Safety values live on each oil, never in the UI.
 *
 * A boolean flag says the oil is flagged for a rule. The matching number
 * (phototoxicMaxPct, dermalMaxPct, kidsMinAge) stays undefined until it has
 * been sourced from a reference, and the engine treats an undefined number
 * as the most cautious case. Numbers are only accepted with a review level
 * of partial or full, and `source` must say where they came from.
 */
export const SafetySchema = z
  .object({
    phototoxic: z.boolean().optional(),
    phototoxicMaxPct: PctSchema.optional(),
    dermalMaxPct: PctSchema.optional(),
    diffuseOnly: z.boolean().optional(),
    kidsCaution: z.boolean().optional(),
    kidsMinAge: z.number().int().min(0).max(18).optional(),
    pregnancyCaution: z.boolean().optional(),
    catCaution: z.boolean().optional(),
    oxidizesFast: z.boolean().optional(),
    review: ReviewSchema,
    source: z.string().min(1),
  })
  .strict()
  .refine(
    (s) =>
      s.review !== 'none' ||
      (s.phototoxicMaxPct === undefined &&
        s.dermalMaxPct === undefined &&
        s.kidsMinAge === undefined),
    {
      message:
        'Numeric safety limits need review "partial" or "full" and a source that cites the reference. Never guess these numbers.',
    },
  )

const oilBase = {
  id: IdSchema,
  name: z.string().min(1),
  latinName: z.string().min(1).optional(),
  moods: z.array(MoodSchema),
  affinities: z.array(IdSchema),
  safety: SafetySchema,
}

export const SingleOilSchema = z
  .object({
    ...oilBase,
    kind: z.literal('single'),
    families: z.array(FamilySchema).min(1).max(2),
    note: NoteSchema,
    intensity: IntensitySchema,
  })
  .strict()

/**
 * A brand blend (Germ Fighter, Balance, ...). Families, note and intensity
 * are derived from the components unless they are set here.
 */
export const BrandBlendSchema = z
  .object({
    ...oilBase,
    kind: z.literal('blend'),
    brand: z.string().min(1).optional(),
    components: z.array(IdSchema),
    componentsNote: z.string().min(1).optional(),
    families: z.array(FamilySchema).min(1).max(2).optional(),
    note: NoteSchema.optional(),
    intensity: IntensitySchema.optional(),
  })
  .strict()

export const OilSchema = z.discriminatedUnion('kind', [
  SingleOilSchema,
  BrandBlendSchema,
])
export const OilLibrarySchema = z.array(OilSchema)

export type Safety = z.infer<typeof SafetySchema>
export type SingleOil = z.infer<typeof SingleOilSchema>
export type BrandBlend = z.infer<typeof BrandBlendSchema>
export type Oil = z.infer<typeof OilSchema>

// ---------------------------------------------------------------------------
// Shelf, blends, recipes, profile
// ---------------------------------------------------------------------------

export const ShelfItemSchema = z
  .object({
    oilId: IdSchema,
    brand: z.string().min(1).optional(),
    sizeMl: z.number().positive(),
    count: z.number().int().min(1),
    /** ISO date, YYYY-MM-DD */
    openedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD')
      .optional(),
    notes: z.string().optional(),
    /**
     * True when the bottle has run out but should stay on the shelf as a
     * reminder to get more. Empty oils are not used for suggestions.
     */
    empty: z.boolean().optional(),
    /** The barcode this bottle was added with, digits only. */
    barcode: z.string().regex(/^\d{8,14}$/).optional(),
  })
  .strict()

/** A known product barcode: which oil it is, and the bottle it identifies. */
export const BarcodeEntrySchema = z
  .object({
    /** Normalized digits, see engine/barcode.ts */
    code: z.string().regex(/^\d{8,14}$/),
    oilId: IdSchema,
    brand: z.string().min(1).optional(),
    sizeMl: z.number().positive().optional(),
    organic: z.boolean().optional(),
    /** The product name as the brand lists it, for display. */
    product: z.string().min(1).optional(),
  })
  .strict()

export type BarcodeEntry = z.infer<typeof BarcodeEntrySchema>

export const BlendItemSchema = z
  .object({
    oilId: IdSchema,
    parts: z.number().positive(),
  })
  .strict()

export const BlendSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    method: MethodSchema,
    items: z.array(BlendItemSchema),
    volumeMl: z.number().positive(),
    dilutionPct: PctSchema.optional(),
    /**
     * Set when the drops were adjusted by hand: `parts` then hold the drop
     * counts and this is their sum, so the blend reopens exactly as saved.
     */
    totalDrops: z.number().int().positive().optional(),
    /** The goal picked while building, if any. */
    mood: MoodSchema.optional(),
    rating: IntensitySchema.optional(),
    notes: z.string().optional(),
    createdAt: z.string().min(1),
  })
  .strict()

export const RecipeSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    goal: MoodSchema,
    method: MethodSchema,
    items: z.array(BlendItemSchema).min(1),
  })
  .strict()

export const ProfileSchema = z
  .object({
    kidsYoungestAge: z.number().int().min(0).max(17).optional(),
    pregnant: z.boolean(),
    cats: z.boolean(),
    dogs: z.boolean(),
    dropsPerMl: z.number().positive(),
    diffuserMl: z.number().positive(),
    defaultDilutionPct: PctSchema,
  })
  .strict()

export type ShelfItem = z.infer<typeof ShelfItemSchema>
export type BlendItem = z.infer<typeof BlendItemSchema>
export type Blend = z.infer<typeof BlendSchema>
export type Recipe = z.infer<typeof RecipeSchema>
export type Profile = z.infer<typeof ProfileSchema>

export const DEFAULT_PROFILE: Profile = {
  pregnant: false,
  cats: false,
  dogs: false,
  dropsPerMl: 20,
  diffuserMl: 200,
  defaultDilutionPct: 2,
}

// ---------------------------------------------------------------------------
// Family compatibility (the scent wheel)
// ---------------------------------------------------------------------------

/** 1 = classic, 0.5 = works, 0 = risky */
export const CompatScoreSchema = z.union([
  z.literal(0),
  z.literal(0.5),
  z.literal(1),
])

export const CompatPairSchema = z
  .object({
    a: FamilySchema,
    b: FamilySchema,
    score: CompatScoreSchema,
    /** "plan" = listed in PLAN.md, "starting" = starting value to tune by nose */
    source: z.enum(['plan', 'starting']),
  })
  .strict()
  .refine((p) => p.a !== p.b, {
    message: 'a pair needs two different families; same-family uses sameFamily',
  })

export const pairKey = (a: Family, b: Family): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`

export const CompatibilitySchema = z
  .object({
    description: z.string().optional(),
    sameFamily: CompatScoreSchema,
    pairs: z.array(CompatPairSchema),
  })
  .strict()
  .refine(
    (c) => new Set(c.pairs.map((p) => pairKey(p.a, p.b))).size === c.pairs.length,
    { message: 'each family pair may only be listed once' },
  )

export type Compatibility = z.infer<typeof CompatibilitySchema>

// ---------------------------------------------------------------------------
// Cross-file checks that a schema alone can't express
// ---------------------------------------------------------------------------

/**
 * Checks ids across the library, recipes and starter shelf. Returns a list of
 * problems; an empty list means the data is consistent.
 */
export function findDataProblems(
  oils: readonly Oil[],
  recipes: readonly Recipe[],
  starterShelf: readonly ShelfItem[],
  barcodes: readonly BarcodeEntry[] = [],
): string[] {
  const problems: string[] = []
  const byId = new Map<string, Oil>()

  for (const oil of oils) {
    if (byId.has(oil.id)) problems.push(`Duplicate oil id "${oil.id}".`)
    byId.set(oil.id, oil)
  }

  for (const oil of oils) {
    for (const id of oil.affinities) {
      if (id === oil.id) problems.push(`${oil.id} lists itself as an affinity.`)
      else if (!byId.has(id))
        problems.push(`${oil.id} has unknown affinity "${id}".`)
    }
    if (new Set(oil.affinities).size !== oil.affinities.length)
      problems.push(`${oil.id} lists an affinity twice.`)

    if (oil.kind === 'blend') {
      for (const id of oil.components) {
        const component = byId.get(id)
        if (!component)
          problems.push(`${oil.id} has unknown component "${id}".`)
        else if (component.kind !== 'single')
          problems.push(`${oil.id} component "${id}" must be a single oil.`)
      }
      if (new Set(oil.components).size !== oil.components.length)
        problems.push(`${oil.id} lists a component twice.`)
    }
  }

  const recipeIds = new Set<string>()
  for (const recipe of recipes) {
    if (recipeIds.has(recipe.id))
      problems.push(`Duplicate recipe id "${recipe.id}".`)
    recipeIds.add(recipe.id)
    for (const item of recipe.items) {
      if (!byId.has(item.oilId))
        problems.push(`Recipe ${recipe.id} uses unknown oil "${item.oilId}".`)
    }
  }

  for (const item of starterShelf) {
    if (!byId.has(item.oilId))
      problems.push(`Starter shelf has unknown oil "${item.oilId}".`)
  }

  const codes = new Set<string>()
  for (const entry of barcodes) {
    if (codes.has(entry.code)) problems.push(`Duplicate barcode "${entry.code}".`)
    codes.add(entry.code)
    if (!byId.has(entry.oilId))
      problems.push(`Barcode ${entry.code} points at unknown oil "${entry.oilId}".`)
  }

  return problems
}
