# Interactive Storybook — Design Spec

**Date:** 2026-04-06
**Status:** Approved

## Purpose

Build a self-contained, unlimited-page interactive storybook webpage that replicates the feel of Gemini's "storybook" gem (two-page spread, auto-narrated, auto page-flip) without its 10-page limit. Deployed via GitHub Pages.

## Goals

- Unlimited pages (content driven by JSON, not hardcoded)
- Realistic two-page-spread book with 3D page-flip animation
- Auto-advance pages when per-page narration audio finishes
- Full reader controls: play/pause, prev/next, page indicator, jump-to-page, volume, playback speed, restart
- No build step; static site deployable to GitHub Pages
- Easy to add/edit pages (drop image + audio file, update JSON)

## Non-Goals

- Authoring UI (content is edited by hand in `story.json`)
- Backend / database
- User accounts, bookmarks, progress sync
- Built-in TTS generation (audio files are produced externally)

## Stack

- Vanilla HTML / CSS / JavaScript (no framework, no bundler)
- **StPageFlip** (vanilla-JS page-flip library) loaded via CDN for the 3D book effect
- GitHub Pages for hosting

## Repository Structure

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── story.json
├── images/         # page illustrations (01.png, 02.png, …, cover.png, back.png)
├── audio/          # per-page narration (01.mp3, 02.mp3, …)
└── README.md
```

## Content Format — `story.json`

```json
{
  "title": "Story Title",
  "author": "Brandon",
  "cover":     { "image": "images/cover.png" },
  "backCover": { "image": "images/back.png" },
  "pages": [
    {
      "image": "images/01.png",
      "audio": "audio/01.mp3",
      "text":  "Once upon a time..."
    }
  ]
}
```

- `pages` array has no length limit
- `text` is optional (overlay caption; may be hidden if pure illustrated page)
- `audio` is optional per page — if missing, auto-advance is disabled for that page and the reader must click Next

## Architecture

Three logical layers inside a single static site:

1. **Content layer** — `story.json`, `images/`, `audio/`
2. **Rendering layer** — StPageFlip builds book DOM from JSON
3. **Control layer** — `app.js` modules wire audio, auto-advance, and UI

### Modules in `js/app.js`

- **`loadStory()`** — fetches and validates `story.json`
- **`buildBook(story)`** — generates page DOM (cover → content pages → back cover), initializes StPageFlip, returns the `pageFlip` instance. This is the only module that touches StPageFlip's API — isolates the library so it can be swapped later.
- **`AudioController`** — owns a single `<audio>` element. Responsibilities: load page audio, play/pause, volume, playback speed, emit `ended` event upward. Exposes `playPage(n)`, `pause()`, `resume()`, `setVolume()`, `setRate()`.
- **`BookController`** — orchestrator. Listens for `AudioController` `ended` → calls `pageFlip.flipNext()`. Listens for StPageFlip's `flip` event → tells `AudioController` to load + play new page's audio (only if playback was active). Handles manual nav, jump-to-page, restart.
- **`UIController`** — wires DOM buttons/inputs to `BookController` and `AudioController`. Updates page indicator (`X / Y`), play/pause icon, speed label, volume slider position.

### Data Flow

1. Page load → `loadStory()` → `buildBook()` → UI rendered, first spread visible
2. User clicks Play → `AudioController.playPage(currentPage)`
3. Audio `ended` → `BookController.flipNext()` → StPageFlip animates flip
4. StPageFlip `flip` event fires → `BookController` calls `AudioController.playPage(newPage)` if still in "playing" state
5. Manual page turn (click, arrow key, jump) → pause current audio → on flip complete, resume playback on new page if was playing

## Controls (UI)

Bottom control bar (always visible):

```
⏮ Restart | ⏪ Prev | ▶/⏸ Play | ⏩ Next | Page [ 3 ▼ ] / 24 | 🔊 ──●── | Speed [1x ▼]
```

- Restart → jump to cover, pause audio
- Prev / Next → manual flip
- Play/Pause → toggles audio; icon reflects state
- Page dropdown → jump to any page
- Volume slider → 0–100%
- Speed dropdown → 0.75× / 1× / 1.25× / 1.5×

Keyboard shortcuts: `←` prev, `→` next, `Space` play/pause.

## Visual Style

- Two-page spread (left + right visible)
- 3D page-curl flip animation (StPageFlip default)
- Paper texture background for pages; leather/cloth texture for cover
- Responsive: scales down for smaller viewports; StPageFlip handles responsive sizing
- Text overlay (when present): readable serif font, semi-transparent band at bottom of page

## Error Handling

| Failure | Behavior |
|---|---|
| `story.json` fetch fails | Full-screen error with message + Reload button |
| Missing image file | Placeholder image, page still renders with text |
| Missing audio file | Page renders normally; auto-advance disabled on that page; Play shows toast "No audio for this page — click Next" |
| Browser blocks autoplay | First Play click is the user gesture; subsequent auto-advance uses same audio element and is allowed |
| StPageFlip fails to load (CDN down) | Error screen with Reload button |

## Deployment

- Repo root = site root
- Enable GitHub Pages on `main` branch, `/` folder
- Public URL: `https://<user>.github.io/<repo>/`
- Works identically when opened locally via a simple static server (e.g., `python -m http.server`). Note: opening `index.html` directly via `file://` will break `fetch('story.json')` in some browsers — README will document this.

## Future-Proofing

- **Hybrid TTS:** `AudioController.playPage()` will check for the audio file; on 404 it can fall back to Web Speech API. Single-function change.
- **Swap page-flip engine:** only `buildBook()` touches StPageFlip; replacing the library is isolated to that module.
- **Theming:** CSS custom properties for cover texture, page color, font — easy to re-skin per story.

## Testing Strategy

Manual smoke tests (this is a static UI, no unit test framework):

1. Load site → cover renders, controls visible
2. Click Play → first page audio plays, page flips when audio ends, next page audio plays
3. Manual Prev/Next during playback → audio pauses, flips, resumes on new page
4. Jump-to-page dropdown → navigates correctly, resumes audio on new page
5. Volume + speed controls affect playback live
6. Restart → returns to cover, audio stopped
7. Rename one audio file to simulate missing → verify graceful fallback
8. Deploy to GitHub Pages → verify public URL loads and functions identically

## Open Questions

None at time of approval.
