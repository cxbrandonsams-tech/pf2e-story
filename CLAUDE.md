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

- **Spread layout** (desktop, tablets, phone landscape): each entry in `story.pages` produces **two** book pages — an illustration page (odd book index) followed by a text page (even book index). Plus a front cover (book index 0) and a back cover.
- **Portrait layout** (phone in portrait, `(orientation: portrait) and (max-width: 720px)`): each entry in `story.pages` produces **one** merged book page (image fixed at top, text scrolling beneath). Plus front and back covers.

`BookController._currentLayout` tracks which layout is active. `currentStoryPageIndex()` branches on it: in portrait it's `bookIdx - 1`; in spread it's `(bookIdx - 1) >> 1`. Both reject covers.

The lookup helpers `findIllustrationImg(container, storyIndex)` and `findTextHost(container, storyIndex)` in `buildBook.js` use union selectors so the same call works in both layouts. They rely on `data-story-index` attributes set in `renderIllustrationPage` / `renderTextPage` / `renderMergedPage`.

When adding any feature that targets "the current page," resolve through `currentStoryPageIndex()`, never the raw `pageFlip.getCurrentPageIndex()`.

### Module responsibilities

| Module | Responsibility |
|---|---|
| `js/app.js` | Entry point. Wires controllers, populates `#story-title`, handles top-level error/toast UI. |
| `js/loadStory.js` | Fetches `story.json` and validates required shape (including optional `chapter`, `plateLabel`, `illustrationTitle` per page). Throws descriptive errors. |
| `js/buildBook.js` | Builds page DOM with Stitch Tailwind classes (parchment, ornate frame, drop-cap, blockquote detection), instantiates StPageFlip, exports DOM-lookup helpers and `fitTextToPage`. **Sole owner of StPageFlip**. |
| `js/BookController.js` | Orchestrator: play/pause state, audio↔flip coordination, Ken Burns, word-sync, orientation-rebuild. |
| `js/AudioController.js` | Wraps the narration `<audio>` element. Emits `onEnded` and `onTimeUpdate`. |
| `js/KenBurns.js` | Sets inline `animation` from a small whitelist; the actual `@keyframes` (`kb-zoom-in-center`, etc.) live in the inline `<style>` block in `index.html`. Adding a mode requires updating both. |
| `js/UIController.js` | DOM ↔ controller wiring for prev/play/next/volume/speed. Listens for keyboard shortcuts (`←` `→` `Space`). Updates the `#btn-play-icon` Material Symbol to reflect play/pause state. |
| `js/RotateHint.js` | Quiet top-toast hint shown the first time the app loads on a phone in portrait. Suggests rotating for the full spread. Dismissed (and persisted via localStorage) on click or after 6s auto-fade. |

### Auto-advance state machine

`BookController` advances pages in two ways, and the priority matters:

1. If the current page has `audio`, it plays and advances on the audio's `ended` event.
2. Else if `durationMs` is set, it advances after a `setTimeout`.
3. Else it pauses (the user must click Next).

Audio always wins over `durationMs` — see `_playCurrentPage()`. Both paths funnel through `_advanceOrStop()`. In **spread layout** it issues a *second* flip 50 ms after the first so a full spread advances at once. In **portrait layout** it issues a single flip — each story entry is one merged page, so there's no spread to keep in sync.

### Orientation handling

`BookController` listens to `window.matchMedia('(orientation: portrait) and (max-width: 720px)')` and rebuilds the book on `change` events. The rebuild flow in `_rebuildBook(newLayout)`:

1. Save `currentStoryPageIndex()` (and a separate `wasOnBackCover` flag, since `currentStoryPageIndex()` returns -1 for both covers).
2. Pause playback.
3. `pageFlip.destroy()` — note that this also detaches the `#book` mount element from the DOM, so the controller creates a fresh `<div>` with the captured original id/class under the saved parent before re-running `buildBook`.
4. `buildBook(story, bookEl, { layout: newLayout })`.
5. Re-attach the flip event handler via `_wirePageFlipEvents()`.
6. Restore position by flipping to the saved story index in the new layout (or the back cover, or leaving on the front cover).
7. Restore `isPlaying` BEFORE the flip so the wired flip handler picks up narration when the flip lands (avoids a `play()` race against the in-flight animation).

Audio currentTime resets to 0 across the rebuild — rotation is treated as a deliberate user action where re-narration is acceptable.

The initial layout on page load is computed in `js/app.js` from the same media query so the DOM and `_currentLayout` agree from the first paint.

### Word-sync narration

`AudioController.onTimeUpdate` → `BookController._onAudioTime` walks the `.word` spans rendered by `renderTextPage`, marking them `.spoken` based on `currentTime / duration`. On mobile it auto-scrolls `.page-body` to keep the spoken word in view; on desktop it positions the `.quill` cursor element next to the current word using `getBoundingClientRect()`. This is purely a linear time→word mapping — there is no real speech alignment.

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
