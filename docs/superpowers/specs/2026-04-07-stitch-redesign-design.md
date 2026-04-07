# Stitch Redesign: Storybook Reader (Single Tone Parchment)

**Date:** 2026-04-07
**Status:** Approved
**Source design:** Google Stitch — *Storybook Reader (Single Tonee Parchment)*

## Problem

The current storybook UI (dark radial gradient, small hand-crafted CSS, StPageFlip spread with word-sync narration) works well but no longer matches the intended aesthetic. A new visual direction was designed in Google Stitch: a single-tone parchment book seated in a dark wooden frame on a desk, with Material Design 3 tokens, Noto Serif / Newsreader / Work Sans typography, an ornate double-border frame around illustrations, a drop-cap on body text, and a slimmer control surface.

We want to adopt that Stitch design while keeping the existing narration/flip engine.

## Scope of the rewrite

**Keep (engine intact):** StPageFlip-based two-page spread, `story.json` as content source, `AudioController` + `BookController` word-sync narration, Ken Burns image animation, dynamic text-fit (`fitTextToPage`), mobile portrait auto-flip-to-text, keyboard shortcuts.

**Delete (UI + features we're not carrying forward):**
- `index.html` (replaced by Stitch-derived shell)
- `css/style.css` (replaced by Tailwind CDN + small inline `<style>` block)
- `js/MusicController.js` + `assets/music/` + `ambient` block in `story.json`
- `js/SfxController.js` + `assets/sfx/` (page-flip SFX — Stitch is visually quieter, removing SFX keeps that mood)
- `ATTRIBUTIONS.md` entries for the deleted SFX + music
- `design-refs/` (legacy reference imagery for the old design)
- `audio/02.mp3` (orphaned — no page 2 defined in `story.json`)
- Idle corner-lift hint (`hint-corner-lift` class + scheduler in `BookController`)
- Controls that don't exist in Stitch: restart button, music toggle, page-jump dropdown

**Rewritten (keep the module, replace the body):**
- `js/buildBook.js` — renders the new Stitch page DOM. Still the only module that touches StPageFlip.
- `js/BookController.js` — simplified. Drop music + SFX + idle-hint + restart. Keep flip orchestration, word-sync, Ken Burns, mobile auto-flip-to-text, `fitTextToPage`.
- `js/UIController.js` — rewired for the slimmer control set.
- `js/app.js` — drop MusicController + SfxController wiring.

**Touched lightly:**
- `js/loadStory.js` — three new optional fields in the validator.
- `story.json` — schema extension + Otari page 1 content backfill.

## Key architectural decision: how StPageFlip fits inside the Stitch book frame

The Stitch mockup renders a rigid three-column static layout — `parchment-left / book-spine / parchment-right` — all inside a dark-wood container with `ring-8 ring-[#1a0f08]`. StPageFlip takes over its mount container and renders its own DOM, so it cannot cooperate with that three-column flex layout.

**Resolution:** the Stitch outer `<div ... ring-8>` becomes a **decorative shell**. The `id="book"` element mounted to StPageFlip lives inside it. The Stitch explicit `.book-spine` div is deleted — StPageFlip's natural center gutter takes its place. The parchment texture, ornate frame, drop-cap, rune corners, etc. get applied to the `.page` elements StPageFlip renders, not to the static Stitch left/right divs.

Visually the user sees the same thing the Stitch mockup shows: dark wood frame, two parchment pages, spine/gutter in the middle. Functionally, pages flip with the existing StPageFlip 3D animation.

## DOM shell (new `index.html`)

```html
<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Otari</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Work+Sans:wght@300;400;600&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            "surface-container-lowest": "#0b0e13",
            "surface-container": "#1d2025",
            "on-surface": "#e1e2e9",
            "background": "#101418",
            "on-primary-fixed": "#301400",
            "on-secondary-fixed": "#071d31",
            "surface-container-highest": "#32353a",
            "outline-variant": "#554337",
            "surface-container-low": "#191c21",
            "on-tertiary-container": "#3d2313",
            "on-primary-fixed-variant": "#703700",
            "on-primary-container": "#452000",
            "tertiary-fixed-dim": "#eabda5",
            "secondary-fixed": "#d2e4ff",
            "on-secondary": "#1f3247",
            "secondary": "#b5c8e4",
            "on-tertiary-fixed": "#2d1607",
            "error": "#ffb4ab",
            "inverse-primary": "#934b00",
            "secondary-fixed-dim": "#b5c8e4",
            "tertiary-container": "#b08872",
            "tertiary": "#eabda5",
            "on-surface-variant": "#dbc2b1",
            "primary": "#ffb782",
            "outline": "#a38c7e",
            "inverse-on-surface": "#2e3136",
            "primary-fixed-dim": "#ffb782",
            "on-background": "#e1e2e9",
            "on-tertiary": "#452a19",
            "surface-tint": "#ffb782",
            "on-secondary-fixed-variant": "#35485f",
            "on-secondary-container": "#a3b7d2",
            "surface": "#101418",
            "surface-container-high": "#272a2f",
            "error-container": "#93000a",
            "surface-bright": "#36393f",
            "inverse-surface": "#e1e2e9",
            "tertiary-fixed": "#ffdbc9",
            "secondary-container": "#35485f",
            "surface-dim": "#101418",
            "surface-variant": "#32353a",
            "primary-container": "#d87821",
            "on-primary": "#4f2500",
            "on-error": "#690005",
            "primary-fixed": "#ffdcc5",
            "on-error-container": "#ffdad6",
            "on-tertiary-fixed-variant": "#5e402e"
          },
          borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
          fontFamily: {
            headline: ["Noto Serif"],
            body: ["Newsreader"],
            label: ["Work Sans"]
          }
        }
      }
    }
  </script>
  <style>
    /* Only what Tailwind can't express cleanly: */
    .material-symbols-outlined { font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24; }
    .glow-sm { filter: drop-shadow(0 0 5px rgba(255, 183, 130, 0.5)); }
    .parchment-texture { background-color: #f4e4bc; position: relative; }
    .parchment-texture::before {
      content: ""; position: absolute; inset: 0;
      background-image: url(https://lh3.googleusercontent.com/aida-public/AB6AXuDnrW5Rf3TCvMBbyA7wjhMuUFa3pdUXs1Mbtuih842cukGdCY_ikBKDjiLeoPj9gS9Jhhzu54T9CAd4XyJ_S6LlnZJuWWEmqQPoTRHrgC2afEIOo5aCm_SGLSYLApYXiWTKojR92d0Og2wnzylcdfJDSB3c_YxiDrbsxG0qoCiCgwZ4jo2QPCttwSGOc-893SSnnqd57mDVIxMLwY7K2i11q68Qqks7KjaOJwbILZqqesrHYJ5Sx7buronkfteEhrnhu4X3xbfs230);
      opacity: 0.2; pointer-events: none;
    }
    .desk-bg { background: radial-gradient(circle at center, #2d1b0e 0%, #101418 100%); }
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(45, 27, 14, 0.2); border-radius: 10px; }

    /* Ken Burns keyframes — copy the existing @keyframes kb-* blocks from the
       current css/style.css verbatim. KenBurns.js writes `animation: kb-<mode> ...`
       inline, so the keyframe names must match: kb-zoom-in-center, kb-zoom-in-left,
       kb-zoom-in-right, kb-zoom-out, kb-pan-left, kb-pan-right. */

    /* Word-sync */
    .page-text-page .word { transition: color 180ms ease, background-color 180ms ease; }
    .page-text-page .word.spoken { color: #1a0f08; background-color: rgba(216, 120, 33, 0.15); border-radius: 2px; }
    .page-text-page .quill { position: absolute; opacity: 0; transition: opacity 200ms ease; font-size: 20px; pointer-events: none; }
    .page-text-page .quill.active { opacity: 1; }
  </style>
</head>
<body class="bg-background text-on-surface font-body selection:bg-primary/30 min-h-screen flex flex-col overflow-hidden desk-bg">
  <header class="bg-[#101418] flex justify-between items-center w-full px-8 py-4 z-50 shadow-2xl shadow-black/60 sticky top-0">
    <h1 class="font-['Noto_Serif'] font-bold tracking-tight text-3xl text-[#ffb782] drop-shadow-sm" id="story-title"></h1>
  </header>

  <main class="flex-grow flex items-center justify-center p-4 md:p-8 lg:p-12 relative">
    <div class="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
      <div class="absolute top-1/4 left-1/4 w-1 h-1 bg-primary rounded-full blur-[1px]"></div>
      <div class="absolute top-3/4 left-1/3 w-1.5 h-1.5 bg-secondary rounded-full blur-[2px]"></div>
      <div class="absolute top-1/2 right-1/4 w-1 h-1 bg-primary rounded-full blur-[1px]"></div>
    </div>
    <div class="relative w-full max-w-6xl aspect-[16/10] bg-[#2d1b0e] rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] p-2 md:p-4 ring-8 ring-[#1a0f08] overflow-hidden">
      <div id="book" class="w-full h-full"></div>
    </div>
  </main>

  <footer class="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-12 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
    <div class="flex items-center gap-12 bg-[#1b1f23]/90 backdrop-blur-xl px-12 py-4 rounded-full shadow-2xl border border-white/5">
      <!-- Navigation -->
      <div class="flex gap-4">
        <button id="btn-prev" class="flex flex-col items-center justify-center text-[#b5c8e4]/40 p-4 hover:text-[#ffb782] hover:scale-110 transition-transform">
          <span class="material-symbols-outlined text-2xl mb-1">arrow_back_ios</span>
          <span class="font-['Work_Sans'] text-[10px] uppercase tracking-widest">Previous Page</span>
        </button>
        <button id="btn-play" class="flex flex-col items-center justify-center bg-[#d87821]/20 text-[#ffb782] rounded-full px-6 py-4 ring-1 ring-[#ffb782]/30 hover:glow-sm transition-all">
          <span id="btn-play-icon" class="material-symbols-outlined text-3xl mb-1" style="font-variation-settings: 'FILL' 1;">menu_book</span>
          <span class="font-['Work_Sans'] text-[10px] uppercase tracking-widest">Chronicle</span>
        </button>
        <button id="btn-next" class="flex flex-col items-center justify-center text-[#b5c8e4]/40 p-4 hover:text-[#ffb782] hover:scale-110 transition-transform">
          <span class="material-symbols-outlined text-2xl mb-1">arrow_forward_ios</span>
          <span class="font-['Work_Sans'] text-[10px] uppercase tracking-widest">Next Page</span>
        </button>
      </div>
      <!-- Voice slider + speed dropdown (see Controls section) -->
      <div class="flex items-center gap-6 border-l border-white/10 pl-12">
        <div class="flex flex-col gap-2 w-48">
          <div class="flex justify-between items-center mb-1">
            <label class="font-label text-[10px] uppercase tracking-widest text-[#b5c8e4]/60">Voice Resonance</label>
            <span id="volume-label" class="text-primary text-[10px] font-bold">100%</span>
          </div>
          <input id="volume" type="range" min="0" max="100" value="100" class="voice-slider"/>
        </div>
        <div class="relative">
          <select id="speed" class="bg-surface-container-high hover:bg-surface-bright px-4 py-2 rounded-xl border border-white/5 font-label text-xs uppercase tracking-widest text-on-surface">
            <option value="0.8">Slow (0.8x)</option>
            <option value="1" selected>Normal (1.0x)</option>
            <option value="1.2">Swift (1.2x)</option>
          </select>
        </div>
      </div>
    </div>
  </footer>

  <audio id="narration" preload="auto"></audio>
  <script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js"></script>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

Notes:
- `#story-title` is populated from `story.title` in `app.js` on load.
- The top bar `<nav>` with Library/Bookmarks links and decorative icons (`volume_up`, `auto_stories`, `settings`) is deleted — nothing to wire them to under our current feature set.
- The explicit three-column book interior (left page / spine / right page) is deleted — StPageFlip handles that.
- The Voice Resonance slider is a real `<input type="range">` styled to visually match Stitch's gradient track + glowing thumb (pure CSS on `::-webkit-slider-runnable-track` / `::-webkit-slider-thumb`). The `id="volume-label"` span updates on input.
- Speed dropdown uses the Stitch speed set (0.8 / 1.0 / 1.2), not the current 0.75/1/1.25/1.5.
- Voice slider defaults to `100%` (matches current codebase default and the fact that this is narration, not music). Stitch's mockup showed `75%` — this is a deliberate divergence.
- `escapeText(s)` and `escapeAttr(s)` are small HTML-escape helpers local to `buildBook.js`: `s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')`. Used when interpolating `story.json` strings into template literals.

## Page rendering (rewritten `buildBook.js`)

Unchanged rules:
- Each `story.pages[i]` produces **two** book pages: illustration then text.
- Every page carries `data-story-index="{i}"` for DOM lookups.
- `findIllustrationImg()` and `findTextPage()` helpers remain exported.
- `fitTextToPage()` remains exported.
- `buildBook` remains the only module that imports or constructs `St.PageFlip`.

StPageFlip constructor options: same as current (`width: 500, height: 640, size: 'stretch', mobileScrollSupport: false`, etc.).

### Illustration page template

```js
function renderIllustrationPage({ image, storyIndex, plateLabel, illustrationTitle }) {
  const el = document.createElement('div');
  el.className = 'page page-illustration parchment-texture flex-1 rounded-l-lg relative flex items-center justify-center p-8 border-r border-black/10 overflow-visible';
  el.dataset.storyIndex = String(storyIndex);
  el.innerHTML = `
    <div class="absolute inset-6 border-[12px] border-double border-[#d87821]/40 rounded-sm pointer-events-none"></div>
    <div class="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#ffb782] m-4"></div>
    <div class="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#ffb782] m-4"></div>
    <div class="relative w-full h-full rounded-sm overflow-hidden shadow-inner group">
      <img class="page-image w-full h-full object-cover grayscale-[0.2] sepia-[0.2]" src="${escapeAttr(image)}" alt=""/>
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
      ${plateLabel || illustrationTitle ? `
        <div class="absolute bottom-6 left-6 right-6">
          ${plateLabel ? `<span class="font-label text-[10px] tracking-[0.3em] uppercase text-primary/80 mb-1 block">${escapeText(plateLabel)}</span>` : ''}
          ${illustrationTitle ? `<h3 class="font-headline text-xl text-white italic drop-shadow-md">${escapeText(illustrationTitle)}</h3>` : ''}
        </div>
      ` : ''}
    </div>
    <div class="absolute top-8 left-8 text-black/10 select-none">
      <span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
    </div>
  `;
  const img = el.querySelector('img.page-image');
  img.onerror = () => { img.style.display = 'none'; };
  return el;
}
```

Important: the image still has class `page-image`, so `findIllustrationImg` + `KenBurns.start` still work unchanged. The new `grayscale-[0.2] sepia-[0.2]` filter on the image coexists with the inline `animation` Ken Burns sets on it (filter and animation are independent CSS properties).

### Text page template

```js
function renderTextPage({ text, chapter, story, pageNumber, storyIndex }) {
  const el = document.createElement('div');
  el.className = 'page page-text-page parchment-texture flex-1 rounded-r-lg relative p-12 md:p-16 flex flex-col overflow-y-auto custom-scrollbar';
  el.dataset.storyIndex = String(storyIndex);

  // Chapter header
  const header = document.createElement('div');
  header.className = 'mb-8';
  if (chapter) {
    header.innerHTML = `
      <h2 class="font-headline text-4xl text-[#301400] leading-tight mb-2">${escapeText(chapter)}</h2>
      <div class="h-px w-24 bg-[#d87821]/40"></div>
    `;
  }
  el.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'page-body prose prose-stone prose-lg max-w-none text-[#3d2313] font-body leading-relaxed text-justify';
  const paragraphs = (text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('');

  let globalWordIndex = 0;
  const OPENING_QUOTE = /^[\u201C"']/;   // “ " '
  const CLOSING_QUOTE = /[\u201D"']$/;   // ” " '
  paragraphs.forEach((chunk, pi) => {
    const trimmed = chunk.trim();
    const isBlockquote = OPENING_QUOTE.test(trimmed) && CLOSING_QUOTE.test(trimmed);
    const p = document.createElement('p');
    p.className = isBlockquote
      ? 'italic opacity-80 border-l-2 border-[#d87821]/30 pl-4 py-2 my-8'
      : 'mb-6 relative';

    // Drop-cap: only on the very first paragraph of the page, only if not a blockquote.
    let wordsSource = chunk;
    if (pi === 0 && !isBlockquote && chunk.length > 0) {
      const firstChar = chunk[0];
      const dropCap = document.createElement('span');
      dropCap.className = 'drop-cap float-left text-7xl font-headline text-[#d87821] mr-4 mt-2 mb-[-0.5rem] leading-[1] drop-shadow-sm select-none';
      dropCap.textContent = firstChar;
      p.appendChild(dropCap);
      wordsSource = chunk.slice(1);
    }

    const words = wordsSource.split(/\s+/).filter(Boolean);
    words.forEach((w, wi) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.dataset.wordIndex = String(globalWordIndex++);
      span.textContent = w;
      p.appendChild(span);
      if (wi < words.length - 1) p.appendChild(document.createTextNode(' '));
    });

    body.appendChild(p);
  });
  el.appendChild(body);

  // Quill cursor
  const quill = document.createElement('div');
  quill.className = 'quill';
  quill.textContent = '\u{1F58B}';
  el.appendChild(quill);

  // Page footer
  const footer = document.createElement('div');
  footer.className = 'mt-auto pt-8 flex justify-center border-t border-black/5';
  footer.innerHTML = `<span class="font-label text-xs tracking-widest text-[#3d2313]/60 uppercase">Page ${pageNumber} — ${escapeText(story.title)}</span>`;
  el.appendChild(footer);

  // Rune corner
  const rune = document.createElement('div');
  rune.className = 'absolute bottom-8 right-8 text-black/10 select-none';
  rune.innerHTML = `<span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">storm</span>`;
  el.appendChild(rune);

  return el;
}
```

Key properties:
- Drop-cap is a separate `<span class="drop-cap">` *before* the first `.word` span. The word-sync algorithm in `BookController._onAudioTime` only touches `.word` spans, so the drop-cap is never toggled to `.spoken` — it stays visually prominent in `#d87821` throughout playback. Intentional.
- Drop-cap consumes exactly one character (the first character of the first paragraph). The remaining characters of that paragraph become normal `.word` spans split on whitespace. The first `.word` therefore contains the rest of the first word (e.g., for "It was", the drop-cap gets `I`, the first word span gets `t`, the second gets `was`). Word timing is linear over all words, so the highlight still reads naturally.
- Blockquote detection: paragraphs whose trimmed text both starts and ends with `"`, `'`, or curly quotes get the italic-blockquote class instead of the normal paragraph class. No drop-cap on blockquote paragraphs.
- `.page-body` class is preserved so `fitTextToPage` still works. Tailwind's `text-justify` and `leading-relaxed` coexist with the dynamic `font-size` that `fitTextToPage` writes inline.

### Cover pages

Front cover: keep the existing image-only cover, but wrap in the same dark-wood/parchment aesthetic. The Stitch mockup doesn't show a cover — we use a single-panel parchment page with the story title in Noto Serif 5xl and the image below, stamped with the same ornate frame corners. Back cover: a blank parchment page with "The End" in small caps.

This is a minor departure from Stitch (which has no cover at all) but necessary because StPageFlip requires a cover and back cover to animate the book opening.

## story.json schema extension

New optional per-page fields:

| Field | Type | Used in |
|---|---|---|
| `chapter` | string | text page header |
| `plateLabel` | string | illustration page bottom-left eyebrow, rendered as "Plate {plateLabel}" — i.e. do NOT include "Plate " in the field value |
| `illustrationTitle` | string | illustration page bottom-left heading |

`loadStory.js` adds type checks: if present, each must be a string.

### Otari content backfill (page 1)

```json
{
  "title": "Otari",
  "author": "Brandon Sams",
  "cover": { "image": "images/cover.png" },
  "backCover": { "image": "https://placehold.co/800x1000/5a2a13/f0e4c9/png?text=The+End" },
  "pages": [
    {
      "image": "images/01.jpeg",
      "audio": "audio/01.mp3",
      "chapter": "Chapter I: A Working Town",
      "plateLabel": "I",
      "illustrationTitle": "The Town of Otari",
      "kenBurns": "zoom-in-center",
      "text": "<full existing Otari page 1 body, copied verbatim from the current story.json — ~20 paragraphs starting with 'In a world where magic exists...' and ending with '...tomorrow to look a lot like today.'>"
    }
  ]
}
```

`ambient` block is removed. Text body preserved verbatim.

## Controls (rewritten `UIController.js`)

| Control | Wiring |
|---|---|
| `#btn-prev` | `book.prev()` |
| `#btn-play` | `book.toggle()`. On each `book.onChange`, swap `#btn-play-icon` text: `menu_book` when paused, `pause` when playing. Label "Chronicle" stays put. |
| `#btn-next` | `book.next()` |
| `#volume` | `audio.setVolume(v/100)`; also update `#volume-label` text to `${v}%` |
| `#speed` | `audio.setRate(Number(v))` |

Keyboard shortcuts: `←` prev, `→` next, `Space` toggle.

Initial state on load: volume slider at 100%, speed dropdown at 1.0x, play icon showing `menu_book`.

## BookController simplifications

Delete:
- All references to `music`, `sfx` (constructor drops those params).
- `_idleTimer`, `_scheduleIdleHint`, `_clearIdleHint`, `_resetIdleHint`, `IDLE_HINT_DELAY_MS`, `_lastHintedTextPage`, `hint-corner-lift` class additions.
- `restart()` method (no UI button; keyboard `Home` not currently bound either).
- Any `this.sfx.playFlip()` call on the flip handler.

Keep:
- Flip orchestration and auto-advance state machine (audio ended → advance; fallback to `durationMs`; mobile illustration-hold timer; desktop spread double-flip).
- Word-sync `_onAudioTime` (unchanged — the `.word` span structure is preserved in the new `renderTextPage`).
- Ken Burns `_applyKenBurnsForCurrent`.
- `fitTextToPage` calls on flip, resize, and `document.fonts.ready`.
- Click-on-cover behavior: pressing play on the cover flips open to page 1.

`play()` no longer calls `this.music.start()`.

## app.js wiring

```js
import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';
import { AudioController } from './AudioController.js';
import { BookController } from './BookController.js';
import { UIController } from './UIController.js';

// ...
loadStory().then(story => {
  document.getElementById('story-title').textContent = story.title;
  document.title = story.title;
  const pageFlip = buildBook(story, document.getElementById('book'));
  const audio = new AudioController(document.getElementById('narration'));
  const book = new BookController({ story, pageFlip, audio, bookEl: document.getElementById('book') });
  new UIController({ book, audio });
});
```

Error/toast UI stays the same, minus music references.

## Mobile story (≤720px)

Preserve current engine behavior:
- StPageFlip auto-switches to single-page mode (no `usePortrait` override).
- `BookController._isPortraitMode()` still uses `matchMedia('(max-width: 720px)')`.
- Mobile illustration-hold auto-flip to text page (1500 ms) — unchanged.
- Mobile body auto-scroll tracks word-sync — unchanged.

Responsive CSS adjustments:
- `ring-8` → `ring-2` on the book frame.
- Book container padding `p-2 md:p-4` (Tailwind responsive).
- Main padding `p-4 md:p-8 lg:p-12` (Tailwind responsive — already in shell).
- Footer pill bar wraps on mobile: `flex-wrap` on the inner container so nav buttons, voice slider, and speed dropdown stack into 2–3 rows rather than overflow horizontally. No hiding.
- Header stays single-line; `{story.title}` shrinks from `text-3xl` to `text-2xl` on small screens.

## Execution sequencing

Single implementation plan, stepped in order so every intermediate commit is at least loadable:

1. **Prep** — Create a backup branch `pre-stitch-redesign` pointing at the current `main` tip (safety net; no push required). The spec is already written at `docs/superpowers/specs/2026-04-07-stitch-redesign-design.md`.
2. **Remove dead weight** — Delete `MusicController.js`, `SfxController.js`, `assets/music/`, `assets/sfx/`, `audio/02.mp3`, `design-refs/`, stale `ATTRIBUTIONS.md` entries. Update `js/app.js` to stop importing them. Remove the `ambient` block from `story.json`. Site still runs with old CSS/HTML — narration + flip still work, music + SFX silently gone.
3. **New shell** — Replace `index.html` with the Stitch-derived Tailwind shell. Delete `css/style.css`. Add the inline `<style>` block. Site shows the new frame/desk/footer, but pages still render in the old StPageFlip-pumped DOM from the untouched `buildBook.js` — so it looks half-migrated but still functional.
4. **New page rendering** — Rewrite `buildBook.js` to emit the new Tailwind-classed illustration/text pages. Add drop-cap handling. Keep `.page-image`, `.word`, `.page-body`, `data-story-index` contracts intact. Page content now looks Stitch-correct.
5. **story.json extension** — Add `chapter`, `plateLabel`, `illustrationTitle` fields to page 1 of Otari. Add validator checks in `loadStory.js`.
6. **Controller cleanup** — Rewrite `UIController.js` for the new control IDs. Strip music/SFX/idle-hint/restart from `BookController.js`. Update `app.js` accordingly.
7. **Mobile pass** — Manual test at 720px and 400px widths. Tighten responsive classes as needed.
8. **Verify** — Serve with `python -m http.server 8000`, click through cover → page 1 → back cover, confirm narration + word-sync + Ken Burns all still work, confirm play button icon swaps, confirm volume slider and speed dropdown take effect.

## Non-goals (explicit YAGNI)

- **No build step.** Tailwind stays on CDN. No Vite/Parcel/Webpack.
- **No Tailwind `@apply` / PostCSS processing.** All styling lives in inline class strings or the `<style>` block.
- **No new story pages.** Content work is backfilling page 1 fields only.
- **No SFX re-addition.** If you want page-flip sound back, that's a future request.
- **No settings sheet / modal.** All controls live on-surface in the footer.
- **No click-on-book play toggle.** Play is via the Chronicle button or Space.
- **No bookmarks / library / "auto_stories" features.** Those Stitch top-bar icons were decorative; we removed them.
- **No touch gestures beyond what StPageFlip provides** (drag to flip is native to StPageFlip on touch devices).

## Open questions

None blocking. The following items were flagged during brainstorming and defaulted to "remove" — shout if any should be kept:

- `js/SfxController.js`, `assets/sfx/page-flip.mp3`, page-flip SFX generally
- `audio/02.mp3` (orphaned file)
- `design-refs/` directory
