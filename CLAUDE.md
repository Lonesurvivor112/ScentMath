# ScentMath

Mobile-first essential oil blending web app. `PLAN.md` is the full spec. Read it before making changes, and record any deviation in its Amendments section.

## Rules

- Follow the tech stack and folder structure in `PLAN.md` exactly.
- `src/engine` is pure TypeScript with no React imports, and every function has Vitest tests.
- Never invent safety numbers (dermal limits, phototoxic limits, age limits). If a value isn't sourced in `oils.json`, leave it undefined and treat it as cautious. A numeric limit may only be added with `review` set to `partial` or `full` and a `source` that links the page it came from.
- Approved safety sources (Nick, Nov 2026): Plant Therapy's own product pages and guides, and the Tisserand Institute website. Read the page itself and quote it; never fill a value from memory or from a search summary. See Amendments 7 to 9 in `PLAN.md` for how the sources map to fields.
- planttherapy.com rate-limits quickly (HTTP 429). Fetch one page at a time with several seconds between requests.
- No medical or healing claims anywhere in the UI.
- Mobile-first: design for a 390 px wide screen, tap targets of 44 px or more.
- Work one phase at a time from "Build phases" in `PLAN.md`. At the end of each phase, run the tests, start the dev server, summarize what was built and what's left, then stop and wait for Nick.
- If anything in `PLAN.md` is unclear or contradictory, ask before building on it.

## Commands

- `npm run dev` — dev server
- `npm test` — run all Vitest tests once
- `npm run typecheck` — TypeScript, no emit
- `npm run build` — typecheck, tests, then production build

## Layout

- `src/data` — seed JSON (oils, recipes, compatibility, starter shelf, barcodes), Zod schemas (`schema.ts`), validated exports (`index.ts`), display labels (`labels.ts`)
- `src/engine` — pure TypeScript, each file with a `.test.ts`: `resolve.ts` (brand blends to families/note), `harmony.ts`, `calculator.ts`, `safety.ts`, `scoring.ts`, `barcode.ts` (normalize and look up barcodes), `catalog.ts` (search, custom oils), `shelf.ts` (owned oils, merging, Get more list)
  Also `builder.ts` (the blend being built: suggested and hand-set drops, saving, reopening) and `ideas.ts` (recipe matching, ideas generated from the shelf, share text)
- `src/store` — Zustand stores backed by Dexie (`db.ts`): `shelf.ts`, `oils.ts` (custom oils and learned barcodes), `profile.ts`, `builder.ts` (the current draft), `blends.ts` (saved blends), `nav.ts` (active tab)
- `src/screens`, `src/components` — React UI

## Notes

- Oils marked `empty` stay on the shelf but are not owned. Use `ownedOilIds()` from `engine/shelf.ts` for suggestions and recipes, never the raw shelf.
- Use `useOilIndex()` from `store/oils.ts` in screens, not `OIL_INDEX`, so the user's own oils are included.
- The camera only works on https or localhost. The barcode reader (`@zxing/browser`) is loaded on demand by `BarcodeScanner`.
- `barcodes.json` is generated from Plant Therapy product data. Don't map a barcode to an oil whose safety profile differs (their lime is steam distilled, the library's is cold-pressed, so it is left out).

## Phase status

- Phase 1 (scaffold and data): built
- Phase 2 (engine with tests): built
- Phase 3 (shelf and onboarding): shelf editing, custom oils, barcode scanning and the household profile built; the first-run onboarding screen not started
- Phase 4 (Blend Builder): built
- Phase 5 (Ideas and Saved): built
- Phase 6 (polish and deploy): GitHub Pages publishing set up (`.github/workflows/deploy.yml`, steps in `README.md`); dark mode and the accessibility pass not started
