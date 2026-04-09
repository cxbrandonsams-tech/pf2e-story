# Mobile image cropping — design

## Problem

On mobile (the portrait merged layout), each story page renders its illustration in a fixed strip at the top of the page: 100% of the page width by 38% of the page height — landscape-shaped, roughly 1.5:1. Most source illustrations in `images/` are portrait-shaped (e.g. `01.jpeg` 4096×3072 ≈ 1.33:1, `04.png` 1024×1536 ≈ 0.67:1, character portraits even taller). The strip uses `object-cover` with the default center crop, so portrait images get their top and bottom cut off. Important subjects — character heads, the top of the Gauntlight tower, etc. — frequently fall outside the visible band.

The desktop spread layout has its own full illustration page that displays portrait images at near-native aspect, so the center crop rarely cuts heads off there.

## Goal

Give content authors per-page control over the vertical focal point of the mobile crop strip, with an optional escape hatch for hand-cropped mobile variants when the focal-point shift isn't enough. Leave the desktop spread layout untouched.

## Non-goals

- Horizontal focal point control (`object-position` x). Every problem image in the current `story.json` is portrait — vertical bias alone is sufficient. Can be added later without breaking existing entries.
- Per-page mobile variants for slideshow paragraph images. Slideshow characters are already tightly framed; `cropY` alone covers them.
- Changes to cover pages. Covers have their own layout and are not affected by the merged-strip crop problem.
- Changes to the spread layout's illustration page.
- Changing the 38% strip height, the parchment frame, or the `object-cover` rule itself.
- Fixing the pre-existing `_stopKenBurnsAll` bug noted under Risks.

## Schema additions

Two optional page-level fields and one optional per-paragraph-image field:

```jsonc
{
  "image": "images/01.jpeg",          // existing — used by spread always; used by mobile if no imageMobile
  "imageMobile": "images/01-m.jpeg",  // NEW, optional — hand-cropped mobile variant. Replaces `image` in merged layout only.
  "cropY": "25%",                     // NEW, optional — vertical focal point for the merged-layout crop strip. Default "50%".
  "paragraphImages": [
    "images/brann.png",                       // existing string form still valid
    { "src": "images/Alaric_Voss.png",
      "cropY": "10%" }                        // NEW object form, opt-in only when override needed
  ]
}
```

### Resolution rules (merged layout only)

- **Image source:** `imageMobile ?? image`. Per-paragraph-image entries do not get a mobile variant.
- **Per-image cropY (single image):** page-level `cropY ?? "50%"`.
- **Per-image cropY (slideshow entry):** entry's own `cropY ?? page-level cropY ?? "50%"`. Entry-level wins.
- `cropY` accepts a string of the form `"<n>%"` where `n ∈ [0, 100]` (decimals allowed). Other values are rejected at load time.
- **Spread layout ignores both new fields entirely.** Desktop behavior is unchanged.

### Validation (loadStory.js)

Add to the existing schema validator. Errors thrown follow the existing descriptive-error pattern in `loadStory.js`:

- `cropY`: optional; if present, must be a string of the form `"<n>%"` where `n` parses as a number in `[0, 100]` (decimals allowed). Validator both pattern-checks and range-checks; rejects e.g. `"top"`, `"25"`, `"25 %"`, `"-5%"`, `"125%"`.
- `imageMobile`: optional; if present, must be a string.
- `paragraphImages`: each entry is either a string (existing behavior) or an object `{ src: string, cropY?: string }`. Any other shape is rejected.

## Render changes

All changes live in `js/buildBook.js`. The blast radius is small: one helper signature change, one resolver, two call sites, plus the loadStory validation.

### 1. `renderImageMarkup` gains a context arg

Current signature: `(image, paragraphImages)`.

New signature: `(image, paragraphImages, { layout, imageMobile, cropY })`.

Behavior:

- If `layout === 'portrait'` and `imageMobile` is set, use `imageMobile` as the single-image src instead of `image`.
- For each `<img class="page-image">` it emits in portrait layout, write `style="object-position: 50% <resolvedCropY>"` inline.
- The resolver:
  - Single image: `cropY ?? '50%'`.
  - Slideshow entry: `entry.cropY ?? cropY ?? '50%'` (entry-level wins).
- In spread layout (`layout === 'spread'`), the helper skips the inline `object-position` and the `imageMobile` swap entirely. Desktop output is byte-identical to today.

### 2. Slideshow string-or-object normalization

Inside `renderImageMarkup`, when `paragraphImages` is present, walk it once and produce a normalized array of `{ src, cropY }`. String entries become `{ src, cropY: undefined }`. The rest of the renderer (and the slideshow swap logic in `BookController`) only reads `src`, so no downstream changes are needed.

### 3. Call sites

- `renderMergedPage` calls `renderImageMarkup(image, paragraphImages, { layout: 'portrait', imageMobile, cropY })`.
- `renderIllustrationPage` calls `renderImageMarkup(image, paragraphImages, { layout: 'spread' })`.

Each call site receives the new fields from the page object and forwards them through. Two-line edits.

## What this does NOT touch

- StPageFlip — `buildBook.js` remains the sole owner of the library, and its config is unchanged.
- `BookController` — it queries images by `data-story-index` and does not care about crop. No changes.
- `KenBurns` — it writes `transform`. `object-position` lives on the same element but is a separate property; they compose.
- The 38% image strip height, the parchment frame, the `object-cover` rule, or any other CSS in `index.html`.
- `story.json` content — the new fields are optional. Existing pages render exactly as before.

## Ken Burns interaction

`KenBurns.start` writes `transform: scale(...) translate(...)` to the merged-page image via inline `style.animation`. `object-position` is a separate CSS property on the same element. The visible effect: the image is cropped to the focal-point band first, then KB scales/pans within that crop. This is the desired behavior — KB on a head-biased crop keeps the head in view as it zooms.

## Risks and edge cases

- **Cover pages** are unaffected — `renderCoverPage` does not call `renderImageMarkup` and is out of scope.
- **`cropY: "0%"`** (top edge) and **`"100%"`** (bottom edge) are both valid; the regex allows them.
- **Invalid `cropY`** (e.g. `"top"`, `"25"`, `"25 %"`) is rejected by `loadStory.js` at load time with a descriptive error. Caught before render.
- **Missing `imageMobile`** falls back to `image` — existing behavior, no surprises.
- **Pre-existing bug, NOT fixed here:** `_stopKenBurnsAll` in `js/BookController.js:287` only walks `.page-illustration img.page-image`, missing `.page-merged` images. Stale animations can linger across layout rebuilds. Out of scope for this work — flagged for separate follow-up.

## Testing

The repo has no automated tests. Manual verification:

1. Add `"cropY": "20%"` to page 1 (`01.jpeg` is the wide town shot — bias up).
2. Add `"cropY": "15%"` to the Chapter III slideshow page (characters are portrait; show heads).
3. Add a per-image override on one slideshow entry (e.g. `{ "src": "images/bug.png", "cropY": "30%" }`).
4. Optionally add `"imageMobile": "images/01-m.jpeg"` to page 1 to verify the override path (requires creating the file).
5. Load on a phone-sized viewport (DevTools 390×844). Walk through all pages. Verify:
   - `cropY` visibly shifts the image.
   - Ken Burns still animates the merged-page image.
   - The desktop spread layout is unchanged (resize the window above 720×720 to confirm).
   - `imageMobile` swap takes effect on phone, not on desktop.
   - Invalid `cropY` in `story.json` produces a descriptive error at load time, not a silent miss.
