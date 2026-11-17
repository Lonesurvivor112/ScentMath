# ScentMath — Web App Build Plan

Nov 16, 2026 · Nick

> Converted from `Essential Oil Blend Calculator — Web App Build Plan.docx`. The working name "Blend Lab" was replaced with **ScentMath**. Changes made while building are listed under [Amendments](#amendments) at the end.

## Overview

ScentMath is a mobile-first web app. It answers one question: what can I make with the oils I already own? You log your oils, then pick a starting oil or a mood. The app suggests oils from your shelf that pair well, shows exact drop counts for your diffuser or roller, and warns you about safety issues.

**What makes it different from existing apps**

- It works with any brand, including mixed collections and brand blends like Plant Therapy's Germ Fighter or Blues Buster.
- It only suggests oils you actually own, and it shows recipes that are missing just one oil.
- Safety checks run on every blend automatically. You don't have to look anything up.
- It works offline, and the first version needs no account.

**Goals for version 1**

- Go from "I want something calming" to a drop-by-drop recipe in under 30 seconds.
- Never show a risky combination without a visible warning.
- Run entirely in the browser, installable on a phone home screen, and free to host.

Not in version 1: accounts, cloud sync, selling oils, or any medical or healing claims.

## MVP features

Version 1 has seven features, and the blend builder is the core of the app.

- **My Shelf (inventory).** Add oils from a searchable library. Set the brand, bottle size, bottle count and the date you opened it. You can add custom oils and brand blends that aren't in the library.
- **Blend Builder.** Add oils one at a time. A ranked "pairs well with" list updates live, using only oils on your shelf. A balance meter shows the top, middle and base notes, and a harmony score runs from 0 to 100.
- **Ideas by goal.** Pick a mood: Energize, Focus, Calm, Sleep, Uplift, Fresh and clean, Cozy, or Breathe easy. You get ranked blends you can make right now.
- **Drop calculator.** Choose a diffuser, a 10 ml roller or a massage oil. Set the dilution and get exact drops per oil.
- **Safety panel.** Warnings appear on every blend, such as phototoxicity, skin irritants, kids, pregnancy and pets.
- **Saved blends.** Name, rate and add notes to a blend. You can also duplicate one to tweak it.
- **What can I make?** A curated recipe library sorted into "you have everything" and "missing one oil."

## Screens and user flow

The app is designed for a phone first, with four tabs at the bottom: Shelf, Build, Ideas and Saved.

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Onboarding | Set up the shelf and household once | Search to add oils, quick-add chips for common oils, household toggles (kids and age, pregnancy, cats, dogs) |
| Shelf | See and manage owned oils | Grid of colored caps grouped by scent family, count badge, "opened" date, filter by family |
| Build | Make a blend | Method picker (diffuser, roller, massage), current oils with +/- drop steppers, "Pairs well" list with a one-line reason each, balance meter, harmony score, safety banner, Save button |
| Ideas | Start from a goal | Mood chips, "You can make" cards, "Missing 1 oil" cards, tap a card to open it in Build |
| Blend detail | Use a saved blend | Drops per oil for the chosen size, notes, rating, duplicate, share as text |
| Settings | Defaults | Drops per ml (default 20), diffuser size, default dilution, household profile |

**Main flow**

1. Open Build and pick a method, such as a 200 ml diffuser.
2. Tap a first oil, for example Sweet Orange.
3. The app suggests oils from your shelf, such as Frankincense ("resin grounds bright citrus") and Peppermint ("mint lifts citrus").
4. Add two or three oils. The balance meter and harmony score update.
5. The app fills in suggested drops. Adjust them with the steppers if you want.
6. Check the safety banner, then save the blend with a name.

## Blending engine

The engine works out each suggestion from four things about every oil: its scent family, its note, how strong it is, and a curated list of good pairings. It's pure TypeScript with no AI and no server, so its results are predictable and testable.

**Oil attributes the engine uses**

- **Families:** one or two from citrus, floral, herbaceous, minty, camphoraceous, woody, resinous, spicy, earthy, sweet.
- **Note:** top, middle or base. This is how fast the scent fades.
- **Intensity:** 1 to 5. This is how much one drop dominates; patchouli, ylang ylang, cassia and peppermint rate high.
- **Moods:** tags such as energize, focus, calm, sleep, uplift, fresh, cozy, breathe.
- **Affinities:** a hand-curated list of oils it's known to pair well with.

**Family compatibility (the scent wheel)**

Neighboring families pair well. Store these pairs in `compatibility.json` and score each one as 1 (classic), 0.5 (works) or 0 (risky):

- Citrus goes with floral, herbaceous, minty, spicy, woody, resinous and earthy.
- Floral goes with citrus, woody, resinous, spicy and earthy.
- Herbaceous goes with citrus, minty, camphoraceous and woody.
- Minty goes with citrus, herbaceous and camphoraceous.
- Resinous goes with citrus, woody, spicy and floral.
- Earthy goes with citrus, floral and woody.

**Scoring a candidate oil against the current blend**

```
score = 0.40·A + 0.25·F + 0.20·N + 0.15·M − P
```

- **A** = how many oils already in the blend list this oil as an affinity, scaled 0 to 1.
- **F** = average family compatibility with the oils already in the blend, 0 to 1.
- **N** = how much it moves the note mix toward the target of about 30% top, 50% middle and 20% base, 0 to 1.
- **M** = how much it matches the chosen mood, 0 to 1. M is 0 when no mood is chosen.
- **P** = penalties. Take 0.3 if a family is already in the blend twice, 0.3 if it would be the second oil with intensity 5, and 1.0 if it breaks a safety rule for the chosen method.

Show the top 5 oils from the shelf, each with a one-line reason built from whichever term scored highest. For example: "Citrus brightens a floral heart" or "Adds the base note this blend is missing."

**Default drop ratios**

Start with parts based on note: top 3, middle 2, base 1. Cap intensity-5 oils at 1 part and intensity-4 oils at 2. Then scale the parts to the total drops from the calculator.

**Harmony score (0 to 100)**

The score is the average family compatibility across all pairs in the blend, times 60, plus note balance times 25, plus intensity balance times 15. It's a guide, not a rule: the nose decides.

**Brand blends**

Blends like Germ Fighter, Balance, Blues Buster, Holiday Season, Pumpkin Spice and Apple Cider are stored with their component oils. You enter the components from the bottle label or the brand's website. The engine works out the blend's families and note from those components.

## Drop and dilution calculator

The calculator turns a blend's parts into whole drops per oil. It assumes 20 drops per ml, and you can change that in Settings because droppers vary.

**Topical blends (roller, massage oil)**

```
total drops = carrier ml × drops per ml × dilution
```

For example, a 10 ml roller at 2% is 10 × 20 × 0.02 = 4 drops in total.

| Dilution preset | Use |
| --- | --- |
| 1% | Face, sensitive skin, older adults |
| 2% | Everyday adult body use (default) |
| 3% | Short-term, small area |

For children, the app defaults to 1% or less and shows the age warnings from the safety rules.

**Diffuser**

Total drops come from the diffuser's water capacity. Start with these defaults and let users edit them:

| Water capacity | Default total drops |
| --- | --- |
| 100 ml | 4 |
| 200 ml | 6 |
| 300 ml or more | 8 |

**Rounding rules**

- Spread the total drops across oils by their parts, using the largest-remainder method so the drops add up exactly.
- Every oil gets at least 1 drop.
- If there are more oils than drops, warn the user: "Too many oils for this size. Increase the volume or remove an oil."
- If any oil goes over its own maximum for skin, lower it and show why.

## Safety rules

Safety checks run on every blend and every suggestion. Each rule depends on the method you chose and the household profile you set. Store safety values as fields on each oil, never hard-coded in the UI.

| Rule | When it triggers | What the app does |
| --- | --- | --- |
| Sun sensitivity (phototoxic) | Cold-pressed bergamot, lemon or grapefruit in a roller or massage oil over that oil's limit | Warns "Avoid sun on this skin for 12 hours" and suggests bergapten-free bergamot or diffusing instead |
| Skin irritant | Cinnamon cassia in any skin blend | Blocks it over its very low limit for skin and labels it "diffuser only" |
| Young children | Peppermint, eucalyptus or rosemary 1,8-cineole when the profile has kids under the set age | Warns against applying them to or near a child's face or diffusing them close to the child |
| Pregnancy | Clary sage and other flagged oils when pregnancy mode is on | Hides them from suggestions and warns if you add one by hand |
| Cats and pets | Tea tree, citrus, mint and other flagged oils when the profile has cats | Recommends short diffusing sessions in a ventilated room the pet can leave |
| Old bottle | Citrus or tea tree opened more than about 12 months ago | A shelf badge says "May be oxidized; avoid on skin" |

**Data source:** fill in every safety value (skin limits, ages, flags) from Tisserand & Young, *Essential Oil Safety* (2nd edition), or a reviewed reference like it. Each value records where it came from. Claude Code must not guess these numbers. Missing values show as "unknown" and are treated as cautious.

**Wording:** the app gives scent and safety guidance only. It makes no claims to treat any condition, and every blend screen links to a short disclaimer.

## Data model and seed data

The app has five data types. The oil library ships as JSON with the app, and everything the user creates is saved on the device.

```ts
type Family = 'citrus'|'floral'|'herbaceous'|'minty'|'camphoraceous'|'woody'|'resinous'|'spicy'|'earthy'|'sweet';
type Note = 'top'|'middle'|'base';

interface Oil {
  id: string; name: string; latinName?: string;
  kind: 'single'|'blend';
  families: Family[]; note: Note; intensity: 1|2|3|4|5;
  moods: string[]; affinities: string[];      // oil ids
  components?: string[];                       // for brand blends
  safety: {
    phototoxicMaxPct?: number; dermalMaxPct?: number; diffuseOnly?: boolean;
    kidsMinAge?: number; pregnancyCaution?: boolean; catCaution?: boolean;
    oxidizesFast?: boolean; source: string;
  };
}

interface ShelfItem { oilId: string; brand?: string; sizeMl: number; count: number; openedOn?: string; notes?: string; }

interface Blend {
  id: string; name: string; method: 'diffuser'|'roller'|'massage';
  items: { oilId: string; parts: number }[]; volumeMl: number; dilutionPct?: number;
  rating?: 1|2|3|4|5; notes?: string; createdAt: string;
}

interface Recipe { id: string; name: string; goal: string; method: Blend['method']; items: Blend['items']; }

interface Profile {
  kidsYoungestAge?: number; pregnant: boolean; cats: boolean; dogs: boolean;
  dropsPerMl: number; diffuserMl: number; defaultDilutionPct: number;
}
```

**Library:** start with about 60 common single oils plus the brand blends below. Families, notes and intensity in the seed are starting values to tune by nose.

**Starting shelf (from your photo).** Most caps look like Plant Therapy, so confirm the brand when you set up.

| Oil | Count | Families | Note | Intensity |
| --- | --- | --- | --- | --- |
| Peppermint (1 organic) | 3 | minty | top | 4 |
| Lavender | 2 | floral, herbaceous | middle | 2 |
| Lemon | 2 | citrus | top | 2 |
| Sweet Orange | 1 | citrus | top | 2 |
| Pink Grapefruit | 1 | citrus | top | 2 |
| Bergamot | 1 | citrus | top | 2 |
| Spearmint | 1 | minty | top | 3 |
| Eucalyptus Globulus | 1 | camphoraceous | top | 4 |
| Rosemary 1,8-Cineole | 1 | herbaceous, camphoraceous | middle | 3 |
| Tea Tree (organic) | 1 | camphoraceous | middle | 4 |
| Clary Sage | 1 | herbaceous, floral | middle | 3 |
| Cinnamon Cassia | 1 | spicy | middle | 5 |
| Ylang Ylang (Cliganic, organic) | 1 | floral | middle | 4 |
| Frankincense Carteri | 1 | resinous | base | 2 |
| Patchouli | 1 | earthy | base | 5 |
| Holiday Season (blend) | 2 | from label | from label | from label |
| Germ Fighter (blend) | 1 | from label | from label | from label |
| Balance (blend) | 1 | from label | from label | from label |
| Blues Buster (blend) | 1 | from label | from label | from label |
| Pumpkin Spice (blend) | 1 | from label | from label | from label |
| Apple Cider (blend) | 1 | from label | from label | from label |

One bottle at the top left of the photo has no readable label. Add it once you know what it is.

**Starter recipes:** seed the Ideas tab with these nine diffuser blends. Each is listed as parts.

| Recipe | Goal | Oils (parts) |
| --- | --- | --- |
| Bright morning | Energize | Sweet Orange 3, Peppermint 2, Rosemary 1 |
| Focus | Focus | Lemon 2, Rosemary 2, Spearmint 1 |
| Wind down | Sleep | Lavender 3, Bergamot 2, Clary Sage 1 |
| Grounding | Calm | Sweet Orange 3, Frankincense 2, Patchouli 1 |
| Spa day | Calm | Bergamot 3, Pink Grapefruit 2, Ylang Ylang 1 |
| Clean house | Fresh | Lemon 3, Tea Tree 2, Eucalyptus 1 |
| Stuffy head | Breathe | Eucalyptus 2, Peppermint 2, Lemon 1 |
| Cozy fall | Cozy | Sweet Orange 3, Frankincense 2, Cinnamon Cassia 1 |
| Mood lift | Uplift | Pink Grapefruit 3, Lavender 2, Blues Buster 1 |

## Tech stack and architecture

Version 1 is a static web app with no backend. The data is small, everything is stored on the device, hosting is free, and it works offline.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Vite + React + TypeScript | Fast, widely used, and Claude Code handles it well |
| Styling | Tailwind CSS | Quick to build mobile-first layouts |
| Install and offline | vite-plugin-pwa | Add to home screen, works with no signal |
| State | Zustand | Small and simple |
| Storage | IndexedDB via Dexie | Shelf, saved blends and profile stay on the device |
| Data validation | Zod | Catches bad entries in oils.json at build time |
| Tests | Vitest | Engine, calculator and safety rules get unit tests |
| Hosting | Vercel, Netlify or GitHub Pages | Free static hosting |

**Project structure**

```
scentmath/
  src/
    data/        oils.json, recipes.json, compatibility.json, schema.ts
    engine/      scoring.ts, calculator.ts, safety.ts, harmony.ts (pure functions + tests)
    store/       shelf.ts, blends.ts, profile.ts (Zustand + Dexie)
    screens/     Shelf, Build, Ideas, Saved, BlendDetail, Settings, Onboarding
    components/  OilCap, PairList, BalanceMeter, DropStepper, SafetyBanner, MoodChips
  public/        icons, manifest
  PLAN.md        this document
  CLAUDE.md      short rules for Claude Code (see kickoff prompt)
```

The engine folder must not import anything from React. That keeps the blending logic testable and reusable if you build a native app later.

## Build phases

The build has six phases. Have Claude Code finish one phase, show you the result, and wait before moving on.

- [ ] **Phase 1: Scaffold and data.** Set up Vite + React + TypeScript, Tailwind and the PWA. Write the Zod schemas and seed oils.json, compatibility.json and recipes.json.
  - Done when: the app runs, the data passes validation, and your starting shelf loads.
- [ ] **Phase 2: Engine with tests.** Build scoring, the calculator, safety and harmony as pure functions.
  - Done when: tests show a 10 ml roller at 2% = 4 drops, cassia flagged in any roller, suggestions only from the shelf, and drops always add up to the total.
- [ ] **Phase 3: Shelf and onboarding.** Add and remove oils, add custom oils and brand-blend components, and set up the household profile.
  - Done when: changes stay after reloading the page.
- [ ] **Phase 4: Blend Builder.** Build the method picker, drop steppers, the "pairs well" list with reasons, the balance meter, the harmony score, the safety banner and saving.
  - Done when: the main flow in this plan works on a phone-sized screen.
- [ ] **Phase 5: Ideas and Saved.** Add mood chips, "you can make" and "missing 1 oil" lists, the saved-blend list, blend detail, duplicating and sharing as text.
  - Done when: every starter recipe opens in Build with the right drops.
- [ ] **Phase 6: Polish and deploy.** Add dark mode, empty states and accessibility (labels, contrast, tap targets of 44 px or more), then deploy.
  - Done when: the app installs from your phone's browser and works in airplane mode.

## Kickoff prompt for Claude Code

To hand this off, export this doc as Markdown and save it as PLAN.md in an empty folder. Open Claude Code in that folder, then paste the prompt below.

```
Read PLAN.md. It is the full spec for ScentMath, a mobile-first essential oil blending web app.

Rules for this project (also save these to CLAUDE.md):
- Follow the tech stack and folder structure in PLAN.md exactly.
- src/engine is pure TypeScript with no React imports, and every function has Vitest tests.
- Never invent safety numbers (dermal limits, phototoxic limits, age limits). If a value isn't
  sourced in oils.json, leave it undefined and treat it as cautious.
- No medical or healing claims anywhere in the UI.
- Mobile-first: design for a 390 px wide screen, tap targets of 44 px or more.

Work one phase at a time from "Build phases". Start with Phase 1 and Phase 2.
At the end of each phase, run the tests, start the dev server, summarize what you built and
what's left, then stop and wait for me before starting the next phase.
If anything in PLAN.md is unclear or contradictory, ask me before building on it.
```

## Later ideas

These come after version 1, roughly in order of value.

- **Scan your caps:** take a photo like the one you used for this plan and add every oil it recognizes in one go.
- **Describe a vibe:** type something like "rainy Sunday reading" and get a blend. This one needs an AI service, so it needs a small backend.
- **Accounts and sync:** keep the same shelf on your phone and laptop.
- **Share a blend as a link:** the recipe opens in the app with a checkmark on each oil the viewer owns.
- **Low-stock reminders:** track drops used per blend and estimate when a bottle runs out.
- **Printable roller labels:** blend name, oils, dilution and date.
- **Ratings and notes:** use your past ratings to rank suggestions higher next time.

## Amendments

Changes made while building, so this document stays the source of truth. Added by Claude Code on 2026-11-16.

1. **Name.** "Blend Lab" is now ScentMath everywhere, and the project root is this folder.
2. **Safety fields.** The plan's `safety` shape can't tell "not flagged" apart from "flagged, but the number isn't sourced yet". Three fields were added:
   - `phototoxic?: boolean` — the oil is flagged for sun sensitivity. `phototoxicMaxPct` stays undefined until sourced, and the engine then treats any skin amount as over the limit.
   - `kidsCaution?: boolean` — the oil is flagged for young children. `kidsMinAge` stays undefined until sourced, and the engine then warns for a child of any age.
   - `review: 'none' | 'partial' | 'full'` — how far the oil's safety values have been checked against a cited source. `none` means nothing is checked and no numeric limit is allowed. `partial` means the values present are sourced but not every rule was checked. `full` means every rule was checked. Any oil that isn't `full` shows a "not fully verified" notice on skin blends.
3. **Brand blends.** A blend's `families`, `note` and `intensity` are optional and derived from `components` when left out. Blends also carry `brand` and `componentsNote` (where the component list came from).
4. **Starter shelf.** The shelf from the photo ships as `src/data/starterShelf.json` and is loaded once on first run.
5. **Family compatibility.** The plan lists pairs for six families. The remaining pairs (camphoraceous, woody, spicy, sweet) were filled in as starting values and are marked `"source": "starting"` in `compatibility.json`.
6. **Total drops round down** for skin blends, so a blend never goes over the dilution you chose.
7. **Safety data sources (changed by Nick, Nov 2026).** The plan named the Tisserand & Young book as the source. Nick approved using reputable published sources instead. The values now come from:
   - Plant Therapy's own product pages: maximum skin dilution, KidSafe and Pregnancy Safe listings, cautions, and blend ingredient lists.
   - Plant Therapy's guides: "What Does KidSafe Really Mean" (non-KidSafe oils are fine from age 10) and "Essential Oils and Cats" (which oils and oil types to keep away from cats).
   - The Tisserand Institute website (run by the author of the book): the phototoxic limits table and the allergenic oils topical maximums table.

   Every sourced value carries its page link in the oil's `source` field. The rule against guessing still stands: a value with no source stays undefined.
8. **How the sources were applied.**
   - Skin maximum (`dermalMaxPct`): the stated maximum where a page gives one, otherwise the top of Plant Therapy's recommended range ("Dilute to 2-5%" becomes 5).
   - Children: an oil or blend not listed KidSafe gets `kidsCaution` with `kidsMinAge: 10`.
   - Pregnancy: an oil or blend not listed Pregnancy Safe, or marked "Do not use if pregnant", gets `pregnancyCaution`.
   - Bergamot uses the standard 0.4% sun limit. Plant Therapy's page says its bergamot is bergapten-free and also says to limit sun exposure, so the cautious value is used. If the bottle says bergapten-free or FCF, the limit can be removed.
   - Cats: the warning now also says to never diffuse in a closed room with the cat inside, following Plant Therapy's guide.
9. **Brand blends use the brand's own safety values.** A brand blend marked `review: 'full'` is judged by the values on the brand's page for that blend, not by its components, because the brand knows how much of each oil is inside. A blend that isn't fully reviewed (for example one the user adds by hand) still inherits every caution from its components.
10. **Library additions.** German Chamomile, Davana and Tonka Bean were added because they are in Apple Cider.
11. **Review status (Nov 2026).** All 21 starter shelf oils are fully reviewed. Nine more library oils have sourced limits only. The remaining library oils are unreviewed and show the "not fully verified" notice.
12. **Shelf editing and barcode scanning (requested by Nick, Nov 2026).** This is the shelf half of Phase 3, plus scanning, which the plan had not listed.
    - **Add oil** opens a full-screen sheet with three ways in: Search (the library, with quick-add chips), Scan (barcode), and Your own (a custom oil or blend).
    - **Scan** uses the phone camera. "One at a time" stops after each scan to confirm. "Quick scan" keeps the camera running and adds each recognized bottle straight away. The barcode can also be typed.
    - **Barcode data.** `src/data/barcodes.json` ships with the app, so scanning works offline. It holds the barcodes Plant Therapy publishes for each bottle size (regular and organic) of the oils in the library. A barcode the app doesn't know is matched to an oil once by the user and remembered on the device. Looking up any barcode online is not possible without a server, because the large barcode databases don't allow calls from a web page; that belongs with the backend in Later ideas.
    - **Edit mode** on the shelf shows two buttons under each oil: "ran out" and "remove". Removing can be undone.
    - **Get more.** An oil marked as run out stays on the shelf, greyed, with an "Empty · Get more" badge, and appears on a Get more list that can be copied as text. Empty oils do not count as owned, so later phases must not suggest them.
    - **Bottle details.** Tapping an oil opens its bottle count, size, brand, opened date and notes.
    - **Data model.** `ShelfItem` gained `empty?: boolean` and `barcode?: string`. A new `BarcodeEntry` type maps a barcode to an oil, brand and size.
    - **New files.** `engine/barcode.ts`, `engine/catalog.ts` and `engine/shelf.ts` (pure, tested); `store/oils.ts` (custom oils and learned barcodes); `screens/AddOil*.tsx` and `screens/ShelfItemSheet.tsx`; components `BarcodeScanner`, `OilSearchList`, `Sheet`, `SizePicker`, `Toast`.
    - **Camera needs https.** Browsers only allow the camera on a secure address (or on localhost). Scanning on a phone therefore needs the app deployed, or served over https.
    - Still to do from Phase 3: the first-run onboarding screen. (The household profile was built with Phase 4, see below.)
13. **Phase 4, Blend Builder (Nov 2026).**
    - **Suggested and hand-set drops.** A blend starts with suggested drops: each oil has parts and the calculator splits the total for the size. The first tap on a drop stepper switches the blend to hand-set drops: the numbers shown become the blend, a tap changes only that oil, and the total follows. "Reset to suggested" goes back. Changing method, size or dilution re-splits in the same ratios.
    - **Limits while stepping.** An oil can't go below 1 drop (remove it instead) or above its own skin maximum. Hand-set drops that go past the chosen dilution are allowed, with a warning that states the real dilution.
    - **Data model.** `Blend` gained `totalDrops?: number` (set for hand-set blends, so they reopen exactly as saved) and `mood?`.
    - **Settings sheet** (opened from Build): household (children and youngest age, pregnancy, cats, dogs), diffuser size, usual dilution and drops per ml. With children at home, new skin blends start at 1% or less.
    - **Draft is kept.** The blend being built is saved on the device, so it survives closing the app.
    - **New files.** `engine/builder.ts`; stores `builder.ts`, `blends.ts`, `profile.ts`, `nav.ts`; screens `Build`, `Settings`; components `BalanceMeter`, `DropStepper`, `MoodChips`, `PairList`, `SafetyBanner`.
14. **Phase 5, Ideas and Saved (Nov 2026).**
    - **Ideas** shows "You can make" and "Missing 1 oil" from the curated recipes, filtered by mood, most harmonious first. With a mood picked it also shows up to three blends **built from the shelf** by the suggestion engine. These are labeled as worked out, not tried recipes. The plan only listed the curated recipes; the generated ones were added so every mood has more than one or two ideas.
    - Cards show drops for the user's diffuser size, and flag blends that have safety notes for the household.
    - Opening an idea or saved blend in Build asks first if a blend is already in progress.
    - **Saved** lists blends. The detail view shows drops, safety notes, rating and notes, with Open in Build, Duplicate, Share as text and Delete (with undo).
    - **New files.** `engine/ideas.ts`; screens `Ideas`, `Saved`, `BlendDetail`, `useOpenInBuild`.
15. **Hosting (Nick, Nov 2026).** The app is hosted on GitHub Pages at https://lonesurvivor112.github.io/ScentMath/. `.github/workflows/deploy.yml` builds and publishes on every upload to the `main` branch, and `README.md` has the steps. `npm run upload-folder` compares the project with GitHub and copies only the new and changed files to a `ScentMath-upload` folder beside the project, ready to drag onto GitHub's upload page.
16. **Additions from Nick's testing (Nov 2026).**
    - **Dice button in Build.** "Roll a random blend" replaces the oils with a random blend from the shelf, keeping the method, size and dilution. The first oil is random; each one after is picked at random from the best few matches for the blend so far, so rolls vary without clashing. With a goal picked, the first oil is one that fits the goal. Oils with a safety problem for the method, oils hidden for the household, and oils that have run out are never used. A roll can be undone.
    - **What a blend is made of.** Brand blends (and the user's own blends) show "Made of ..." with their ingredient list wherever they are listed: the pairs-well list, the blend being built, the oil picker, idea cards, saved blends and the scan result. The shelf detail sheet shows the full list and where it came from.
    - **Scent words explained.** An "i" button opens a plain-language guide to the ten scent families (with examples), top, middle and base notes, and the harmony score. It is in the oil picker, the pairs-well list, the shelf and the custom oil form.
    - **Two more goals.** "Deodorize" and "Sick-day comfort" were added to the eight in the plan. The second names the occasion rather than an effect, in keeping with the no-health-claims rule. Each has one starter recipe ("Fresh air" and "Blanket day"), so there are now eleven.
    - **Long ingredient lists.** Lists of more than five ingredients show the first five and a "+N more" button that opens the whole list in place ("Show less" closes it). Idea cards are one big button, so they always show the whole list.
    - **About this oil.** Tapping any oil or blend on the shelf shows everything the library knows about it: Latin name, ingredients (blends), what each scent family smells like, its note, scent strength (1 to 5), the goals it fits, and what it pairs well with, with the oils on the shelf outlined. The same section appears when a scanned barcode is recognized and after matching a new barcode to an oil. The app has no online barcode lookup (see Amendment 12), so for a barcode it doesn't know, the details appear as soon as it is matched to an oil once.
