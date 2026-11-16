import { z } from 'zod'
import { makeCompat } from '../engine/harmony'
import { buildOilIndex } from '../engine/resolve'
import barcodesJson from './barcodes.json'
import compatibilityJson from './compatibility.json'
import oilsJson from './oils.json'
import recipesJson from './recipes.json'
import {
  BarcodeEntrySchema,
  CompatibilitySchema,
  OilLibrarySchema,
  RecipeSchema,
  ShelfItemSchema,
  findDataProblems,
} from './schema'
import starterShelfJson from './starterShelf.json'

/**
 * The seed data, validated as it loads. A bad entry in any JSON file throws
 * here, which fails the tests and the build instead of reaching the UI.
 */

export const OILS = OilLibrarySchema.parse(oilsJson)
export const COMPATIBILITY = CompatibilitySchema.parse(compatibilityJson)
export const RECIPES = z.array(RecipeSchema).parse(recipesJson)
export const STARTER_SHELF = z.array(ShelfItemSchema).parse(starterShelfJson)
/** Product barcodes that ship with the app, so scanning works offline. */
export const BARCODES = z.array(BarcodeEntrySchema).parse(barcodesJson)

const problems = findDataProblems(OILS, RECIPES, STARTER_SHELF, BARCODES)
if (problems.length > 0) {
  throw new Error(`Seed data is inconsistent:\n- ${problems.join('\n- ')}`)
}

/** Every library oil with brand blends resolved to families, note and intensity. */
export const OIL_INDEX = buildOilIndex(OILS)

/** Looks up how well two scent families pair. */
export const COMPAT = makeCompat(COMPATIBILITY)
