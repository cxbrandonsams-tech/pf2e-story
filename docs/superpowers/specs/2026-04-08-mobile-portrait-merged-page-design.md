# Mobile portrait merged-page + landscape spread hint

**Date:** 2026-04-08
**Status:** Approved

## Goal

On a phone in portrait orientation, the current experience flips between an illustration page and a text page with a 1.5s hold in between. This breaks the "two facing pages of a real book" feel and introduces awkward dead time during auto-advance.

Solve it two ways:

1. In portrait, merge each story page's illustration and text into **one** book page (image fixed at the top, text scrolling beneath). Each story entry becomes one book page in this layout, not two.
2. Softly nudge phone users toward landscape, where the existing two-page spread already kicks in via the `min-width: 768px` Tailwind breakpoint, by showing a one-time top toast.

Landscape (phone or desktop) is unchanged. Tablets stay in spread layout in both orientations.

## What changes

### 1. New `renderMergedPage` in `js/buildBook.js`

A single page DOM containing:

- A fixed-height image area (~38% of page height, `flex-shrink-0`) with the existing illustration frame, the `plateLabel` overlay, and the `illustrationTitle` overlay. The wrapper has class `.page-merged-image`. The `<img>` inside carries class `page-image` so the existing `findIllustrationImg` lookup keeps working without selector changes.
- A scrollable text region below it. The scroll container element carries class `.page-body` (same as the existing text page) so the word-sync auto-scroll in `BookController._onAudioTime` continues to work without branching. Tailwind classes: `page-body flex-1 min-h-0 overflow-y-auto custom-scrollbar`. Holds the chapter heading, paragraphs with drop-cap, blockquote handling, the page footer, and the `.word` spans for word-sync.
- Root element class: `page page-merged parchment-texture`, with `data-story-index`. An inner wrapper element with class `.page-merged-inner absolute inset-0 flex flex-col p-6 md:p-10` mirrors the structure of `.page-text-inner` so StPageFlip's dynamic `display: block/none` on the page root is respected (same gotcha as the text page — see `renderTextPage` comment in current `buildBook.js`).
- Quill cursor element is omitted. The current code already disables the quill on mobile (the `isMobile` branch in `BookController._onAudioTime`); the merged page is portrait-mobile-only, so the quill never activates.

### 2. `buildBook` accepts a `layout` option

```js
buildBook(story, container, { layout: 'spread' | 'portrait' })
```

- `'spread'` → existing behavior (illustration page + text page per story page).
- `'portrait'` → one `renderMergedPage` per story page.

Both branches call `new St.PageFlip(...)` and `loadFromHTML(...)` the same way. StPageFlip ownership stays in `buildBook.js` — the CLAUDE.md invariant is preserved.

### 3. Layout-aware lookup helpers in `js/buildBook.js`

- `findIllustrationImg(container, storyIndex)` — selector becomes a union: `.page-illustration[data-story-index="N"] img.page-image, .page-merged[data-story-index="N"] img.page-image`. The same call returns the correct image in both layouts.
- `findTextPage(container, storyIndex)` is renamed to `findTextHost(container, storyIndex)` and uses a union selector: `.page-text-page[data-story-index="N"], .page-merged[data-story-index="N"]`. The element it returns still hosts `.word` spans and a `.page-body` scroll container, so word-sync logic in `BookController._onAudioTime` continues to work without branching. **All call sites in `BookController` are updated** — `_revealTextForCurrent`, `_clearRevealAll`, `_resetWordsForCurrent`, `_fitCurrentTextPage`, `_onAudioTime`, and `_fitAllTextPages` all switch from `findTextPage` to `findTextHost`.
- `_clearRevealAll` is updated to query both selectors: `.page-text-page.reveal, .page-merged.reveal`.
- The CSS rule for the reveal animation in `index.html` (`.page-text-page.reveal .page-body { animation: text-fade-in ... }`) is broadened to include `.page-merged.reveal .page-body` so the merged page also gets the fade-in on first display. The unspoken-word opacity rule (`.page-text-page .word { opacity: 0.35 }`) is similarly broadened to `.page-text-page .word, .page-merged .word`.

### 4. `BookController` orientation handling

- New helper: `_isPortraitMobile()` returns `window.matchMedia('(orientation: portrait) and (max-width: 720px)').matches`.
- Constructor stores the active layout in `this._currentLayout` and registers a `change` listener on the same media query.
- The flip-event handler is moved from inline-in-constructor into a method `_wirePageFlipEvents()` so it can be re-registered after rebuild.
- Story-index ↔ book-index conversion becomes layout-aware:

  ```js
  currentStoryPageIndex() {
    const bookIdx = this.pageFlip.getCurrentPageIndex();
    if (bookIdx < 1) return -1;
    const pagesPerStory = this._currentLayout === 'portrait' ? 1 : 2;
    const contentPages = this.story.pages.length * pagesPerStory;
    if (bookIdx > contentPages) return -1;
    return this._currentLayout === 'portrait'
      ? (bookIdx - 1)
      : ((bookIdx - 1) >> 1);
  }
  ```

- `_isOnIllustrationPage()` and the entire `MOBILE_ILLUSTRATION_HOLD_MS` path are deleted. Portrait no longer has a separate illustration page, so the hold has no purpose.
- `_advanceOrStop()` simplifies in portrait: it issues a single `flipNext()` and skips the "second flip 50ms later" trick that exists for spread mode (which advances both pages of a spread as one unit).
- `_rebuildBook(newLayout)` handles orientation change:

  ```js
  _rebuildBook(newLayout) {
    if (newLayout === this._currentLayout) return;
    const savedStoryIdx = this.currentStoryPageIndex();
    const wasPlaying = this.isPlaying;
    this.pause();
    this.pageFlip.destroy();
    this._currentLayout = newLayout;
    this.pageFlip = buildBook(this.story, this.bookEl, { layout: newLayout });
    this._wirePageFlipEvents();
    const pagesPerStory = newLayout === 'portrait' ? 1 : 2;
    const targetBookIdx = savedStoryIdx >= 0 ? 1 + savedStoryIdx * pagesPerStory : 0;
    this.pageFlip.flip(targetBookIdx);
    if (wasPlaying) this.play();
  }
  ```

  Audio currentTime resets to 0 after rebuild — rotation is a deliberate user action, restart-on-rotation is acceptable.

### 5. Ken Burns on the merged page

The 38% top region is large enough that the slow zoom still reads. `KenBurns.start` is applied to the merged page's `<img class="page-image">` exactly as it is to the spread illustration page. No changes to `KenBurns.js` or the keyframes in `index.html`.

### 6. Rotate hint (quiet top toast)

- New element added to `index.html`, just inside `<body>` but outside `<main>`:

  ```html
  <div id="rotate-hint" hidden role="status" aria-live="polite">
    <span class="material-symbols-outlined">screen_rotation</span>
    <span>Rotate for the full spread</span>
    <button id="rotate-hint-close" aria-label="Dismiss">×</button>
  </div>
  ```

- Styled inline in the existing `<style>` block: fixed-position pill below the header (`top: 64px`), centered, parchment-on-dark accent matching the existing toast styles, fade in/out with a 280ms transition.
- New file `js/RotateHint.js` exports `installRotateHint()`. On install:
  - If `_isPortraitMobile()` returns false, do nothing.
  - If `localStorage.getItem('otari.rotateHintDismissed') === '1'`, do nothing.
  - Otherwise reveal the toast (remove `hidden`, set `opacity: 1`), schedule auto-dismiss after 6000ms, and bind `click` on the toast and the close button to dismiss + persist.
  - Dismissal sets `localStorage.setItem('otari.rotateHintDismissed', '1')` and fades out.
- `js/app.js` calls `installRotateHint()` once after BookController construction.

### 7. CLAUDE.md updates

- Update the "Story → Book page mapping (critical)" section to describe the layout-dependent mapping (1:1 in portrait, 1:2 in spread) and note that `currentStoryPageIndex()` now branches on `_currentLayout`.
- Drop the "Auto-advance state machine" paragraph about `MOBILE_ILLUSTRATION_HOLD_MS` (and the constant itself). Replace with a sentence noting that portrait-mobile uses the merged layout and follows the same single-flip auto-advance as desktop.
- Add a short paragraph about the orientation listener and `_rebuildBook` flow.
- Add `js/RotateHint.js` to the module-responsibilities table.

## What stays the same

- StPageFlip is touched only by `buildBook.js`.
- Word-sync DOM (`.word` spans, `data-word-index`, dual-class drop-cap trick) is unchanged.
- Audio/timer state machine, `KenBurns.js`, the `@keyframes` in `index.html`, and `story.json` schema are untouched.
- Desktop spread behavior is pixel-identical to today.
- Phone landscape uses the spread layout (already does today via the `min-width: 768px` Tailwind breakpoint).

## Files touched

| File | Change | Approx LOC |
|---|---|---|
| `js/buildBook.js` | Add `renderMergedPage`, `layout` option, expand selector unions, rename `findTextPage` → `findTextHost` | +90 / -5 |
| `js/BookController.js` | Orientation listener, `_rebuildBook`, layout-aware index conversion, delete illustration-hold path, `_wirePageFlipEvents` extraction | +60 / -20 |
| `js/RotateHint.js` | New file | +45 |
| `js/app.js` | Call `installRotateHint()` | +3 |
| `index.html` | `#rotate-hint` element + styles | +30 |
| `CLAUDE.md` | Update mapping, auto-advance, module table | +15 / -10 |

## Edge cases

- **Rotation while audio is playing.** Pause, rebuild, restart on the same story page after rebuild. Audio `currentTime` resets to 0. Acceptable — rotation is a deliberate action.
- **Rotation on the cover or back cover.** `currentStoryPageIndex()` returns -1, restored target becomes book index 0, which is the cover in both layouts. Works in both directions.
- **iOS Safari address-bar collapse fires `resize`.** The `matchMedia` `change` event won't fire for that, only for actual orientation changes. Use the media query as the source of truth and ignore generic `resize` events for layout switching. (Generic resize still triggers the existing `_fitAllTextPages` debounced callback.)
- **Desktop window resized narrower than 720px.** The `(orientation: portrait)` half of the media query prevents desktop windows from triggering the merged layout. Desktop stays in spread layout regardless of window size.
- **Tablets (768px–1024px).** `(max-width: 720px)` excludes them. They stay in spread layout in both orientations. Desired — tablets have room for the spread.
- **localStorage unavailable (private mode).** `installRotateHint` wraps `getItem`/`setItem` in try/catch. On failure, the hint behaves as if dismissed (no-op) to avoid nagging.
- **Rebuild during a page flip animation.** The `change` listener calls `pause()` first, which clears the timer. `pageFlip.destroy()` cancels any in-flight animation. Safe.
- **`pageFlip.destroy()` availability.** StPageFlip 2.0.7 exposes `destroy()` according to its public API. Implementation should verify this against the actual library at the start of the rebuild work; if `destroy()` is missing or buggy, fall back to clearing `containerEl.innerHTML` and creating a fresh `St.PageFlip` instance (functionally equivalent — the existing instance just gets garbage-collected once nothing references it).
- **The aspect ratio of the book frame** is controlled by the wrapper's Tailwind classes (`aspect-[5/7] md:aspect-[7/5]`). Phone in portrait → tall frame → fits the merged single-page layout. Phone in landscape → wide frame → fits the spread layout. No JS changes needed for the wrapper sizing.

## Out of scope

- Deep-linking to a specific story page.
- Persisting reading position across sessions.
- A "force landscape" mode using the Screen Orientation Lock API.
- Restructuring `story.json` to make illustration optional or to allow multiple images per story page.

## Open questions

None — all design questions resolved during brainstorming.
