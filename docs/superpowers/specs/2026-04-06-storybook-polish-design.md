# Storybook Animation & Polish — Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Builds on:** `2026-04-06-interactive-storybook-design.md`

## Purpose

Elevate the interactive storybook from a functional page-flip demo into a polished, cinematic reading experience inspired by Gemini's storybook gem and the visual reference at `design-refs/bookdesign.png`. Adds a spread-based layout (illustration-left / text-right), weighted page-turn physics, paper-flip sound effects, ambient background music, Ken Burns animation on illustrations, and text reveal animations.

## Goals

- Each entry in `story.json` is a two-page **spread**: full-bleed illustration on the left, text-only page on the right
- Typography matches the reference: cream paper, serif body, drop cap on first paragraph, author name small-caps top-right, page number bottom-center
- Heavier, cinematic page-turn with flip sound
- Ambient background music (CC0) with a mute toggle
- Ken Burns (slow zoom/pan) on illustrations during narration/timer playback
- Text fade-in + drop-cap scale-in when a spread becomes active
- Dark wooden backdrop + vignette so the book feels placed on a desk
- Idle corner-lift hint to invite clicking

## Non-Goals

- Per-spread ambient layering (fire crackle, tavern chatter, etc.) — future phase
- Chapter-break camera pull-back animation — future phase
- Authoring UI for `story.json` — still hand-edited
- Replacing StPageFlip with a custom engine

## Visual Reference

`design-refs/bookdesign.png` — two-page spread, illustration fills the left page bleed-to-bleed, right page is cream paper with serif text, drop cap, "BRANDON SAMS" in small caps top-right, page number at bottom-center.

## Content Model Changes (`story.json`)

### Top-level additions

```json
{
  "title": "Story Title",
  "author": "Brandon Sams",
  "ambient": {
    "music": "assets/music/ambient.mp3",
    "volume": 0.2
  },
  "cover":     { "image": "images/cover.png" },
  "backCover": { "image": "images/back.png" },
  "pages": [ /* spreads */ ]
}
```

- `ambient.music` (optional): path to a looped background music file. If omitted, no music plays.
- `ambient.volume` (optional, 0.0–1.0): default music volume. Default: `0.2`.

### Per-page (spread) fields

```json
{
  "image": "images/01.png",
  "audio": "audio/01.mp3",
  "durationMs": 8000,
  "text": "In a world where magic exists the way electricity does in ours...",
  "kenBurns": "zoom-in-center"
}
```

- `image`, `audio`, `durationMs`, `text`: unchanged from previous spec.
- `kenBurns` (optional): one of `zoom-in-center`, `zoom-in-left`, `zoom-in-right`, `zoom-out`, `pan-left`, `pan-right`, `none`. Default: `zoom-in-center`.

### Conceptual shift

Each entry in `pages` now represents a **spread** (two book pages — illustration page + text page). StPageFlip still sees them as individual pages under the hood, but `buildBook.js` pairs them so one story entry → two consecutive book pages.

## Layout & Typography

### Spread structure

- **Left page (illustration)**: full-bleed `<img>` filling the entire page. No text overlay. Ken Burns class applied to this element during playback.
- **Right page (text)**:
  - Cream background (`#fdf6e3` or similar parchment tone)
  - Serif body text (Georgia fallback; load "EB Garamond" or similar via Google Fonts for polish)
  - **Drop cap** on first letter of the page: `float: left`, ~4 lines tall, serif, slightly darker color
  - **Author name** in top-right: uppercase tracking, small font, muted color
  - **Page number** at bottom-center: small, muted

Use CSS `::first-letter` for the drop cap on the first paragraph.

### Book framing

- `<body>` background: dark wooden texture (CSS linear-gradient of browns approximating wood grain, or a free CC0 wood texture PNG in `assets/textures/wood.jpg`)
- Book element: soft drop shadow (`box-shadow: 0 30px 80px rgba(0,0,0,0.6)`) so it appears to sit on the wood
- Viewport vignette: large `radial-gradient` overlay darkening the edges of the page

### Idle corner-lift hint

CSS `@keyframes` on the current right-page's bottom-right corner: rotates ~3° around the corner every 4s with a brief lift/drop, paused during active flip or playback. Applied via class `.hint-corner-lift` toggled by BookController when playback is idle for >3s.

## Page-Turn Physics

Update StPageFlip config in `buildBook.js`:

```js
new window.St.PageFlip(containerEl, {
  width: 550,
  height: 733,         // slight ratio bump toward the reference's 3:4
  size: 'stretch',
  minWidth: 315,
  maxWidth: 1000,
  minHeight: 420,
  maxHeight: 1400,
  maxShadowOpacity: 0.7,   // up from 0.5
  flippingTime: 1400,      // up from default 1000
  showCover: true,
  usePortrait: false,
  mobileScrollSupport: false,
});
```

## Audio Layers

Three independent audio channels, each with its own controller:

| Channel | Element | Purpose | Controller |
|---|---|---|---|
| Narration | `<audio id="narration">` | per-page voiceover | `AudioController` (existing) |
| Music | `<audio id="music">` | looped ambient | `MusicController` (new) |
| SFX | Web Audio `AudioBufferSourceNode` or a pooled `<audio>` | one-shot page-flip sound | `SfxController` (new) |

### `MusicController`

- Loads `story.ambient.music` if present
- `play()` called on first user interaction (required by browser autoplay policy)
- Loops forever (`audio.loop = true`)
- `mute()` / `unmute()` toggles
- `setVolume(v)` (0–1)
- Default volume: `story.ambient.volume || 0.2`

### `SfxController`

- Preloads `assets/sfx/page-flip.mp3` once
- `playFlip()` creates a cloned audio node and plays (so rapid flips overlap cleanly)
- Volume fixed at ~0.5, tweakable constant
- No user-facing volume control in v1

### Narration ducking

When `SfxController.playFlip()` is called, `AudioController` briefly reduces narration volume by 50% for 400ms, then restores. Prevents the flip sound from being buried under the voice.

## Ken Burns Animation

New module: `js/KenBurns.js`.

### API

```js
export const KenBurns = {
  start(imgEl, mode, durationMs),  // applies keyframe animation
  stop(imgEl),                     // removes class, resets transform
};
```

### CSS keyframes

One keyframe per mode, defined in `css/style.css`:

```css
@keyframes kb-zoom-in-center {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.10) translate(0, 0); }
}
@keyframes kb-zoom-in-left {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.12) translate(-3%, 0); }
}
/* etc: zoom-in-right, zoom-out, pan-left, pan-right */
.kb-active { animation-timing-function: ease-out; animation-fill-mode: forwards; }
```

`KenBurns.start()` sets `imgEl.style.animation = 'kb-<mode> <durationMs>ms ease-out forwards'`, plus class `kb-active`. `stop()` removes inline animation and resets transform.

### Duration resolution

`BookController` calls `KenBurns.start(imgEl, mode, durationMs)` on page entry. The duration is derived:

1. If page has `audio` and audio metadata has loaded, use `audio.duration * 1000`.
2. Else if `durationMs` set, use that.
3. Else 8000ms (fallback for pages with no playback).

If audio metadata hasn't loaded yet, start with the fallback/durationMs and swap once `loadedmetadata` fires. Acceptable simplification: just use fallback — Ken Burns is forgiving.

## Text Reveal Animation

When a spread becomes active **and** playback is running:

1. Text page container: `opacity: 0 → 1` over 800ms (CSS transition)
2. Drop cap: `transform: scale(0.6) → 1` over 1000ms, ease-out, 150ms delay

When the user manually flips while **paused**, text appears instantly (no transition). Implementation: BookController adds/removes a class `.reveal` on the text page element; the class enables the transition.

## Control Bar Changes

Existing control bar gains:

- **Music toggle button** (🎵/🔇) before the existing narration volume slider
- Music volume behind a hover/click popover on the music button (to avoid clutter). Slider 0–100, default 20.
- Narration volume slider label clarified as "Voice" or similar so user knows there are two volumes

Existing buttons unchanged: Restart, Prev, Play, Next, Page jump, Speed.

## File Additions

```
assets/
├── sfx/
│   └── page-flip.mp3        # CC0 from freesound.org
├── music/
│   └── ambient.mp3          # CC0 from incompetech.com (e.g., Kevin MacLeod "Fireside Tales")
└── textures/
    └── wood.jpg             # optional, CC0 — else pure CSS gradient
js/
├── MusicController.js       # new
├── SfxController.js         # new
└── KenBurns.js              # new
```

Modified files: `index.html` (add `<audio id="music">`, new control buttons, load Google Font), `css/style.css` (layout overhaul, keyframes, vignette, wood), `js/buildBook.js` (spread pairing, new StPageFlip config, call KenBurns on flip), `js/BookController.js` (wire SfxController, MusicController, KenBurns, text reveal), `js/UIController.js` (music toggle + popover), `js/app.js` (instantiate new controllers), `story.json` (ambient block).

## Architecture Notes

- `MusicController`, `SfxController`, `KenBurns` are each single-responsibility and independent — can be unit-tested or swapped without touching others
- `buildBook.js` still owns all StPageFlip interaction; pairing logic for spreads lives here
- `BookController` becomes the orchestrator for all three new systems (music on first play, SFX on flip, Ken Burns on page entry) — acceptable since it's already the central orchestrator

## Error Handling

| Failure | Behavior |
|---|---|
| `assets/music/ambient.mp3` missing | Music button shows disabled; no error screen |
| `assets/sfx/page-flip.mp3` missing | Console warning; flips still work silently |
| Google Font CDN blocked | Fallback to Georgia serif (`font-family: "EB Garamond", Georgia, serif`) |
| `kenBurns` value unknown | Fall back to `zoom-in-center`, log warning |
| `story.json` missing `author` | Render without author name, no error |

## Licensing

Third-party assets MUST be CC0 / public domain and documented in a new `ATTRIBUTIONS.md` file at repo root listing source URLs and license. This is a hard requirement before the new asset commits are pushed.

## Testing Strategy

Manual smoke checks (same as prior spec):

1. Fresh load: book visible on wood background, vignette present, cover readable
2. Click Play on cover → flip to first spread → flip SFX plays, music starts, narration or timer runs, Ken Burns zooms on illustration, text fades in with drop cap
3. Manual next → flip SFX plays, narration ducks briefly
4. Music mute toggle → music silences, narration unaffected
5. Music popover → volume slider adjusts music live
6. Restart → returns to cover, music keeps playing (no re-trigger), narration stops
7. Idle for >3s → corner-lift hint animates on current right page; stops on interaction
8. Mobile viewport — layout still readable, controls wrap cleanly
9. Block music/sfx files via DevTools → verify graceful degradation
10. Override `kenBurns: "pan-left"` on one page → verify distinct motion

## Future Considerations

- Per-spread ambient layers (`"ambient": "fire-crackle"` per page)
- Chapter break animation (fade + camera pull-back)
- "Auto-scroll text" reading highlight synced to narration
- Save reading progress to `localStorage`
