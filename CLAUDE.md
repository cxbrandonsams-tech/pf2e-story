# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the site

Pure static site, no build step, no dependencies to install. Because the app uses `fetch('story.json')`, opening `index.html` via `file://` will fail — you must serve over HTTP:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

There are no tests, no linter, and no package manager. All JS is loaded as ES modules from `js/`. StPageFlip and Tailwind CSS are pulled from CDNs at runtime (see `<head>` in `index.html`). There is no separate CSS file — all styling is either inline Tailwind classes or the `<style>` block at the top of `index.html`. Visual design is derived from the Google Stitch "Storybook Reader (Single Tonee Parchment)" mockup.

## Architecture

The design is a controller-orchestrator over StPageFlip. **Only `js/buildBook.js` touches the StPageFlip library** — every other module talks to the `pageFlip` instance through it. Keep that boundary intact when adding features.

### Story → Book page mapping (critical)

The book has TWO layouts and the story → book page mapping depends on which is active:

- **Spread layout** (desktop / large tablet — both viewport dimensions >720px): each entry in `story.pages` produces **two** book pages — an illustration page (odd book index) followed by a text page (even book index). Plus a front cover (book index 0) and a back cover.
- **Portrait merged layout** (any small viewport — `(max-width: 720px), (max-height: 720px)`): each entry in `story.pages` produces **one** merged book page (image fixed at top, scrollable text beneath). Plus front and back covers. Used for phones in BOTH portrait AND landscape orientations: phone landscape (e.g. 844×390) matches via `max-height`, so rotating a phone never flips the layout to spread.

`BookController._currentLayout` tracks which layout is active. `currentStoryPageIndex()` branches on it: in portrait it's `bookIdx - 1`; in spread it's `(bookIdx - 1) >> 1`. Both reject covers.

The lookup helpers `findIllustrationImg(container, storyIndex)` and `findTextHost(container, storyIndex)` in `buildBook.js` use union selectors so the same call works in both layouts. They rely on `data-story-index` attributes set in `renderIllustrationPage` / `renderTextPage` / `renderMergedPage`.

When adding any feature that targets "the current page," resolve through `currentStoryPageIndex()`, never the raw `pageFlip.getCurrentPageIndex()`.

The same compound media query is mirrored in:
- `js/BookController.js` (the rebuild listener and `_isPortraitMobile()` helper)
- `js/app.js` (initial layout calculation on first paint)
- `index.html` style block (`.book-outer-frame { aspect-ratio }` swap)
- `index.html` Tailwind config — a custom `big:` screen alias (`(min-width: 721px) and (min-height: 721px)`) is the inverse, used by header/footer chrome utilities so phone-landscape keeps the compact mobile chrome instead of upgrading on width alone.

Keep these in lock-step. A tablet or desktop window resized across the 720px width threshold triggers a `_rebuildBook` via the matchMedia listener; phone rotations do NOT (since one of width/height stays ≤720px).

### Module responsibilities

| Module | Responsibility |
|---|---|
| `js/app.js` | Entry point. Wires controllers, populates `#story-title`, handles top-level error/toast UI. |
| `js/loadStory.js` | Fetches `story.json` and validates required shape (including optional `chapter`, `plateLabel`, `illustrationTitle` per page). Throws descriptive errors. |
| `js/buildBook.js` | Builds page DOM with Stitch Tailwind classes (parchment, ornate frame, drop-cap, blockquote detection), instantiates StPageFlip, exports DOM-lookup helpers and `fitTextToPage`. **Sole owner of StPageFlip**. |
| `js/BookController.js` | Orchestrator: play/pause state, audio↔flip coordination, Ken Burns, word-sync, orientation-rebuild. |
| `js/AudioController.js` | Wraps the narration `<audio>` element. Emits `onEnded` and `onTimeUpdate`. |
| `js/KenBurns.js` | Sets inline `animation` from a small whitelist; the actual `@keyframes` (`kb-zoom-in-center`, etc.) live in the inline `<style>` block in `index.html`. Adding a mode requires updating both. |
| `js/UIController.js` | DOM ↔ controller wiring for prev/play/next/volume/speed. Listens for keyboard shortcuts (`←` `→` `Space`). Swaps the `#btn-play-icon` Material Symbol between `play_arrow` and `pause`. |

### Auto-advance state machine

`BookController` advances pages in two ways, and the priority matters:

1. If the current page has `audio`, it plays and advances on the audio's `ended` event.
2. Else if `durationMs` is set, it advances after a `setTimeout`.
3. Else it pauses (the user must click Next).

Audio always wins over `durationMs` — see `_playCurrentPage()`. Both paths funnel through `_advanceOrStop()`. In **spread layout** it issues a *second* flip 50 ms after the first so a full spread advances at once. In **portrait layout** it issues a single flip — each story entry is one merged page, so there's no spread to keep in sync.

### Layout switching (resize-driven, NOT phone-rotation-driven)

`BookController` listens to `window.matchMedia('(max-width: 720px), (max-height: 720px)')` and rebuilds the book on `change` events. Because the query matches if either dimension is small, a phone rotating between portrait (390×844) and landscape (844×390) does NOT cross the boundary — the merged layout stays. The rebuild only fires when crossing into/out of the small-viewport bucket (e.g., a desktop window resized below 720px width).

The rebuild flow in `_rebuildBook(newLayout)`:

1. Save `currentStoryPageIndex()` (and a separate `wasOnBackCover` flag, since `currentStoryPageIndex()` returns -1 for both covers).
2. Pause playback.
3. `pageFlip.destroy()` — note that this also detaches the `#book` mount element from the DOM, so the controller creates a fresh `<div>` with the captured original id/class under the saved parent before re-running `buildBook`.
4. `buildBook(story, bookEl, { layout: newLayout })`.
5. Re-attach the flip event handler via `_wirePageFlipEvents()`.
6. Restore position by flipping to the saved story index in the new layout (or the back cover, or leaving on the front cover).
7. Restore `isPlaying` BEFORE the flip so the wired flip handler picks up narration when the flip lands (avoids a `play()` race against the in-flight animation).

Audio currentTime resets to 0 across the rebuild.

The initial layout on page load is computed in `js/app.js` from the same media query so the DOM and `_currentLayout` agree from the first paint.

`buildBook` passes `usePortrait: true` to StPageFlip when `layout === 'portrait'`. Without this, a wide-viewport-but-small-height (phone in landscape) tells StPageFlip's auto-detection to use spread mode, which then pairs the merged pages with the back cover instead of letting each merged page fill the whole book. Also, StPageFlip's `minWidth: 160 / minHeight: 220` accommodate the small book frame on landscape phones (the previous floor of 280×360 made StPageFlip overflow the visible book frame).

### Word-sync narration

`AudioController.onTimeUpdate` → `BookController._onAudioTime` walks the `.word` spans rendered by `renderTextPage`/`renderMergedPage`, marking them `.spoken` based on `currentTime / duration`. This is purely a linear time→word mapping — there is no real speech alignment.

Position math notes:
- The `<p>` elements carry the `relative` Tailwind class (so blockquote borders / drop-caps anchor correctly), which makes each paragraph the offsetParent of its descendant word spans. Therefore `lastSpoken.offsetTop` is paragraph-local and useless for body-scroll math — `_onAudioTime` uses the difference of `getBoundingClientRect()` results (plus current `scrollTop`) to compute the word's position inside the body.
- The desktop `.quill` cursor is parented directly to `.page-text-page` (which has `position: relative`) so `quill.offsetParent === .page-text-page` and the controller can place it in that element's coordinate space directly. The quill renders a Material Symbol (`draw`, dark color) — the previous fountain-pen emoji ignored CSS color and rendered as colored emoji on every platform. The controller hides the quill when the spoken word has scrolled outside the visible body window.

#### Auto-scroll: leading-edge, not chase

`_onAudioTime` does NOT continuously target a fixed % of the body (that fights the user the moment they manually scroll). Instead:
1. Compute `wordVisibleTop = wordRect.top − bodyRect.top` (the spoken word's visible y inside the body, or negative if it has scrolled above the visible area).
2. Only mutate `bodyEl.scrollTop` when `wordVisibleTop > 65% of clientHeight` — i.e. the word has crossed into the lower 35% of the visible body. At that point, scroll so the word lands at 35% from the top.
3. Each trigger fires a chunky ~30%-of-body-height jump. Between triggers, the user is free to scroll without being yanked.

A second guard handles user re-scrolling: a window-level capture-phase `wheel`/`touchstart` listener checks `e.target.closest('.page-body')` and bumps `_suppressAutoScrollUntil = Date.now() + 5000`. While that timestamp is in the future, `_onAudioTime` skips the scroll mutation entirely. `play()` clears the suppression so resuming narration immediately re-engages auto-scroll.

CSS: `scroll-behavior: smooth` is intentionally NOT applied to `.page-body`. Reason: smooth scroll makes `scrollTop` reads return the in-flight animation value, which would break the user-activity differential check, AND it produces visible races against the next audio timeupdate. Instant assignments paired with the chunky leading-edge trigger give a predictable, visible scroll cadence.

The drop-cap (the big decorative first character of the first non-blockquote paragraph) is rendered as a `<span>` that carries BOTH the `drop-cap` and `word` classes, plus a `data-word-index`. That dual-class trick is deliberate: it lets the drop-cap participate in the word-sync highlight sweep so it brightens together with the first word. Removing the `word` class from the drop-cap re-introduces a visible dim/bright seam between the drop-cap letter and the rest of the first word during reveal — don't do that.

Blockquote paragraphs (whose trimmed text both starts and ends with `"`, `'`, `\u201C`, or `\u201D`) are auto-styled as italic indented blocks and skip the drop-cap.

### Dynamic text fitting

`fitTextToPage` in `js/buildBook.js` is now a no-op kept for API compatibility — earlier versions binary-searched font size to fit body copy into a fixed page height. The current design uses a fixed 18px desktop / 16px mobile font and lets the body scroll inside its flex slot when the text is longer than the page can hold. The function is still called from `BookController._fitCurrentTextPage` and `_fitAllTextPages` so a future re-introduction of dynamic fitting wouldn't need new wiring.

## Editing content

All content lives in `story.json` at the repo root. The schema is enforced by `loadStory.js` — required fields are `title`, `cover.image`, `backCover.image`, and a non-empty `pages` array where each page has at least `image`. Optional per-page fields:

- `text` — body copy. Paragraphs split on blank lines.
- `audio` — narration MP3 path. When present, the page auto-advances on the audio's `ended` event.
- `durationMs` — fallback timer (milliseconds) used only if `audio` is missing.
- `kenBurns` — one of `zoom-in-center`, `zoom-in-left`, `zoom-in-right`, `zoom-out`, `pan-left`, `pan-right`, `none`.
- `chapter` — chapter heading rendered above the body text (e.g., `"Chapter I: A Working Town"`).
- `plateLabel` — illustration-page eyebrow, rendered as `Plate {plateLabel}` (supply just the label — e.g., `"I"`, `"IV"`).
- `illustrationTitle` — heading displayed at the bottom of the illustration page.

Asset folders: `images/` (page illustrations + covers), `audio/` (narration MP3s). Third-party asset attributions are tracked in `ATTRIBUTIONS.md` — update it when adding any new external asset.

## Deployment

Push to `main` and enable GitHub Pages from the repo root. There is no build artifact.
