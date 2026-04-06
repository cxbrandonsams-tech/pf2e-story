# Storybook Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the functional page-flip webpage into a cinematic reading experience matching `design-refs/bookdesign.png` and Gemini-style polish: spread layout (illustration-left/text-right), weighted flip physics, paper-flip SFX, ambient music, Ken Burns on illustrations, text reveal animation, wood backdrop + vignette, idle corner-lift hint.

**Architecture:** Layer new features on the existing module structure. Spread pairing is localized to `buildBook.js`. Three new single-responsibility controllers (`MusicController`, `SfxController`, `KenBurns`) plug into the existing `BookController` orchestrator. Layout overhaul is CSS-heavy.

**Tech Stack:** Vanilla HTML/CSS/ES-module JS, StPageFlip (CDN), Google Fonts (EB Garamond), CC0 audio assets from freesound.org + incompetech.com.

**Testing note:** Static visual UI, no automated tests. Every task ends with a **manual browser smoke check**. Run `python -m http.server 8000` from repo root throughout.

**Reference spec:** `docs/superpowers/specs/2026-04-06-storybook-polish-design.md`

---

## File Structure (after this plan)

```
/
├── index.html                   # MODIFIED — music audio el, music button, Google Font link
├── ATTRIBUTIONS.md              # NEW — CC0 asset sources & licenses
├── story.json                   # MODIFIED — ambient block, kenBurns per page, author field
├── assets/
│   ├── sfx/page-flip.mp3        # NEW — CC0 paper flip
│   ├── music/ambient.mp3        # NEW — CC0 ambient loop
│   └── textures/                # (optional; pure CSS gradient used by default)
├── css/style.css                # MODIFIED — full layout overhaul, keyframes, vignette
├── js/
│   ├── app.js                   # MODIFIED — instantiate new controllers
│   ├── loadStory.js             # MODIFIED — validate new fields (optional ones)
│   ├── buildBook.js             # MODIFIED — spread pairing, new StPageFlip config, page classes
│   ├── BookController.js        # MODIFIED — wire sfx/music/kenBurns/reveal; idle hint
│   ├── UIController.js          # MODIFIED — music toggle + popover
│   ├── AudioController.js       # MODIFIED — duck() method for narration ducking
│   ├── MusicController.js       # NEW
│   ├── SfxController.js         # NEW
│   └── KenBurns.js              # NEW
```

---

### Task 1: Acquire CC0 audio assets and attribution

**Files:**
- Create: `assets/sfx/page-flip.mp3`
- Create: `assets/music/ambient.mp3`
- Create: `ATTRIBUTIONS.md`

**Context:** These are real assets downloaded from public CC0 sources. Do NOT generate placeholder audio. Use `curl` to pull verified CC0 files.

Suggested sources (CC0 / public domain):
- **Page flip SFX**: Freesound user search for "book page turn" filtered to CC0. A known-good CC0 file: `https://cdn.freesound.org/previews/414/414201_7369240-lq.mp3` (as an example — verify CC0 at download time).
- **Ambient music**: incompetech.com tracks by Kevin MacLeod are CC-BY (not CC0). For strict CC0 use Free Music Archive filtered to CC0 or the Wikipedia public-domain-music list. A known CC0 option: `https://archive.org/download/relaxing-fantasy-ambient/ambient-loop.mp3` (verify at download time).

If verifying CC0 at download time is uncertain, fall back to: check the file into the repo anyway, mark it clearly in `ATTRIBUTIONS.md` with source URL and license as reported by the source page, and flag for user to confirm.

- [ ] **Step 1: Create `assets/sfx/` and `assets/music/` directories**

```bash
cd /c/Users/Brandon/pf2e-story
mkdir -p assets/sfx assets/music
```

- [ ] **Step 2: Download a CC0 page-turn SFX**

Try these in order until one works and is verifiably CC0:
```bash
curl -L -o assets/sfx/page-flip.mp3 "https://cdn.freesound.org/previews/414/414201_7369240-lq.mp3"
```
If that URL fails or is not CC0, search freesound.org for a page-turn sample filtered to "Creative Commons 0" license, copy the direct preview URL, and `curl` it.

Verify the file is a valid MP3:
```bash
file assets/sfx/page-flip.mp3
ls -l assets/sfx/page-flip.mp3
```
Expected: `MPEG ADTS`, size > 5 KB.

- [ ] **Step 3: Download a CC0 ambient music loop**

```bash
curl -L -o assets/music/ambient.mp3 "https://archive.org/download/relaxing-fantasy-ambient/ambient-loop.mp3"
```
If that URL fails, search archive.org or freemusicarchive.org for a CC0 fantasy/ambient track, copy the direct MP3 URL, and `curl` it.

Verify:
```bash
file assets/music/ambient.mp3
ls -l assets/music/ambient.mp3
```
Expected: valid MPEG audio, size > 100 KB.

- [ ] **Step 4: Create `ATTRIBUTIONS.md`**

```markdown
# Third-Party Assets

All bundled audio assets are Creative Commons Zero (CC0) / public domain.

## Sound Effects

- `assets/sfx/page-flip.mp3`
  - Source: <URL the file was downloaded from>
  - License: CC0 1.0 Universal
  - Attribution not required; included for transparency.

## Music

- `assets/music/ambient.mp3`
  - Source: <URL the file was downloaded from>
  - License: CC0 1.0 Universal
  - Attribution not required; included for transparency.

## Fonts

- **EB Garamond** — loaded from Google Fonts, licensed under the SIL Open Font License (OFL).
```

Replace `<URL...>` with the actual URLs used in steps 2 and 3.

- [ ] **Step 5: Smoke test**

Open a new browser tab and navigate directly to:
- `http://localhost:8000/assets/sfx/page-flip.mp3`
- `http://localhost:8000/assets/music/ambient.mp3`

Expected: Both files play in the browser's built-in audio player.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Brandon/pf2e-story
git add assets/ ATTRIBUTIONS.md
git commit -m "chore: add CC0 page-flip SFX and ambient music with attribution"
```

---

### Task 2: Update `story.json` with new fields

**Files:**
- Modify: `story.json`

- [ ] **Step 1: Read current `story.json`**

Confirm current structure before modifying.

- [ ] **Step 2: Replace `story.json` with updated structure**

```json
{
  "title": "Sample Story",
  "author": "Brandon Sams",
  "ambient": {
    "music": "assets/music/ambient.mp3",
    "volume": 0.2
  },
  "cover": {
    "image": "https://placehold.co/800x1000/5a2a13/f0e4c9/png?text=Sample+Story"
  },
  "backCover": {
    "image": "https://placehold.co/800x1000/5a2a13/f0e4c9/png?text=The+End"
  },
  "pages": [
    {
      "image": "https://placehold.co/800x1000/fdf6e3/222222/png?text=Page+1",
      "audio": null,
      "durationMs": 8000,
      "text": "In a world where magic exists the way electricity does in ours, some people choose ordinary lives and some choose dangerous ones. The dangerous ones are called adventurers.",
      "kenBurns": "zoom-in-center"
    },
    {
      "image": "https://placehold.co/800x1000/fdf6e3/222222/png?text=Page+2",
      "audio": null,
      "durationMs": 8000,
      "text": "They are not knights in shining armor or legendary heroes. Most are simply skilled people willing to walk into places everyone else avoids.",
      "kenBurns": "pan-left"
    },
    {
      "image": "https://placehold.co/800x1000/fdf6e3/222222/png?text=Page+3",
      "audio": null,
      "durationMs": 8000,
      "text": "They deal with old ruins, strange creatures, and problems too dangerous for towns to handle alone. They are hired help with swords, spells, and very questionable judgment.",
      "kenBurns": "zoom-in-right"
    }
  ]
}
```

- [ ] **Step 3: Smoke test**

Open `http://localhost:8000/story.json` in the browser — verify valid JSON (no parse error).

- [ ] **Step 4: Commit**

```bash
git add story.json
git commit -m "feat(content): add ambient + kenBurns fields to story.json"
```

---

### Task 3: Update `loadStory.js` to tolerate new optional fields

**Files:**
- Modify: `js/loadStory.js`

The existing validator throws on missing required fields. New fields (`author`, `ambient`, `kenBurns`, `audio` being `null`) are all optional — no validation changes needed except making `ambient` a recognized shape when present. Light touch: add a sanity check that `ambient.music` is a string if `ambient` is present.

- [ ] **Step 1: Replace `js/loadStory.js`**

```js
// Fetches and validates story.json.
// Throws a descriptive Error on any failure; caller should show the error screen.

export async function loadStory(url = 'story.json') {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Could not fetch ${url}: ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }
  let story;
  try {
    story = await response.json();
  } catch (err) {
    throw new Error(`Invalid JSON in ${url}: ${err.message}`);
  }
  validate(story);
  return story;
}

function validate(story) {
  if (!story || typeof story !== 'object') {
    throw new Error('story.json must be an object');
  }
  if (!Array.isArray(story.pages) || story.pages.length === 0) {
    throw new Error('story.json must have a non-empty "pages" array');
  }
  if (!story.cover || !story.cover.image) {
    throw new Error('story.json must have cover.image');
  }
  if (!story.backCover || !story.backCover.image) {
    throw new Error('story.json must have backCover.image');
  }
  story.pages.forEach((p, i) => {
    if (!p.image) throw new Error(`Page ${i + 1} missing "image"`);
  });
  if (story.ambient !== undefined && story.ambient !== null) {
    if (typeof story.ambient !== 'object') {
      throw new Error('story.ambient must be an object if present');
    }
    if (story.ambient.music !== undefined && typeof story.ambient.music !== 'string') {
      throw new Error('story.ambient.music must be a string if present');
    }
  }
}
```

- [ ] **Step 2: Smoke test**

Reload `http://localhost:8000`. Book should still render (this task doesn't change visible behavior). Open DevTools console — no errors.

- [ ] **Step 3: Commit**

```bash
git add js/loadStory.js
git commit -m "feat(loader): tolerate optional ambient field"
```

---

### Task 4: Add `duck()` to `AudioController`

**Files:**
- Modify: `js/AudioController.js`

`duck(ms)` briefly lowers narration volume by 50% for `ms` milliseconds, then restores. Used by `SfxController` to make the flip SFX cut through narration.

- [ ] **Step 1: Replace `js/AudioController.js`**

```js
// Wraps a single <audio> element. Loads per-page audio, plays/pauses,
// exposes volume/rate, emits 'ended', and supports brief "ducking" for SFX.

export class AudioController {
  constructor(audioEl) {
    this.el = audioEl;
    this.onEnded = null;
    this.onMissing = null;
    this.currentSrc = null;
    this._baseVolume = 1.0;
    this._duckTimer = null;

    this.el.addEventListener('ended', () => {
      if (this.onEnded) this.onEnded();
    });
  }

  load(src) {
    if (!src) {
      this.currentSrc = null;
      this.el.removeAttribute('src');
      return false;
    }
    if (this.currentSrc !== src) {
      this.currentSrc = src;
      this.el.src = src;
    }
    return true;
  }

  async play() {
    if (!this.currentSrc) {
      if (this.onMissing) this.onMissing();
      return;
    }
    try {
      await this.el.play();
    } catch (err) {
      console.warn('Audio play blocked or failed:', err);
    }
  }

  pause() { this.el.pause(); }
  get isPaused() { return this.el.paused; }

  setVolume(v) {
    const clamped = Math.max(0, Math.min(1, v));
    this._baseVolume = clamped;
    this.el.volume = clamped;
  }

  setRate(r) { this.el.playbackRate = r; }

  reset() {
    this.el.pause();
    this.el.currentTime = 0;
  }

  // Temporarily drop volume to 50% of base for `ms` ms, then restore.
  duck(ms = 400) {
    if (this._duckTimer != null) clearTimeout(this._duckTimer);
    this.el.volume = this._baseVolume * 0.5;
    this._duckTimer = setTimeout(() => {
      this.el.volume = this._baseVolume;
      this._duckTimer = null;
    }, ms);
  }
}
```

- [ ] **Step 2: Smoke test**

Reload. Book still works. DevTools console, type:
```
// (nothing to test yet; duck() is wired in a later task)
```
No errors expected.

- [ ] **Step 3: Commit**

```bash
git add js/AudioController.js
git commit -m "feat(audio): add duck() for brief narration volume dip"
```

---

### Task 5: Create `SfxController.js`

**Files:**
- Create: `js/SfxController.js`

- [ ] **Step 1: Create `js/SfxController.js`**

```js
// Plays one-shot sound effects (currently just the page-flip).
// Uses cloned <audio> nodes so rapid overlapping flips all play.

const SFX_VOLUME = 0.5;
const DUCK_MS = 400;

export class SfxController {
  constructor({ flipUrl, narration }) {
    this.flipUrl = flipUrl;
    this.narration = narration; // AudioController (for ducking), may be null
    this._template = new Audio(flipUrl);
    this._template.preload = 'auto';
    this._template.volume = SFX_VOLUME;
    this._template.addEventListener('error', () => {
      console.warn(`SfxController: failed to load ${flipUrl}`);
    });
  }

  playFlip() {
    try {
      const node = this._template.cloneNode();
      node.volume = SFX_VOLUME;
      node.play().catch(err => console.warn('SFX play failed:', err));
      if (this.narration) this.narration.duck(DUCK_MS);
    } catch (err) {
      console.warn('SFX clone/play error:', err);
    }
  }
}
```

- [ ] **Step 2: Smoke test**

Not wired in yet — just verify the file is syntactically valid by loading the page and checking there are no module-parse errors in DevTools console.

- [ ] **Step 3: Commit**

```bash
git add js/SfxController.js
git commit -m "feat(sfx): add SfxController for page-flip sound with narration ducking"
```

---

### Task 6: Create `MusicController.js`

**Files:**
- Modify: `index.html` (add `<audio id="music">`)
- Create: `js/MusicController.js`

- [ ] **Step 1: Add music audio element to `index.html`**

Find this line in `index.html`:
```html
    <audio id="narration" preload="auto"></audio>
```

Add immediately after it:
```html
    <audio id="music" preload="auto" loop></audio>
```

- [ ] **Step 2: Create `js/MusicController.js`**

```js
// Loops ambient background music. Autoplay requires a prior user interaction,
// so `start()` should be called from a click/keydown handler.

export class MusicController {
  constructor({ audioEl, src, defaultVolume = 0.2 }) {
    this.el = audioEl;
    this.src = src;
    this.defaultVolume = defaultVolume;
    this.isMuted = false;
    this._started = false;

    if (src) {
      this.el.src = src;
      this.el.loop = true;
      this.el.volume = defaultVolume;
      this.el.addEventListener('error', () => {
        console.warn(`MusicController: failed to load ${src}`);
      });
    }
  }

  get hasSource() { return !!this.src; }

  async start() {
    if (!this.hasSource || this._started) return;
    try {
      await this.el.play();
      this._started = true;
    } catch (err) {
      console.warn('Music autoplay blocked — will retry on next interaction:', err);
    }
  }

  mute() {
    this.isMuted = true;
    this.el.muted = true;
  }

  unmute() {
    this.isMuted = false;
    this.el.muted = false;
  }

  toggleMute() {
    if (this.isMuted) this.unmute();
    else this.mute();
  }

  setVolume(v) {
    const clamped = Math.max(0, Math.min(1, v));
    this.el.volume = clamped;
  }
}
```

- [ ] **Step 3: Smoke test**

Reload. Book still works. No DevTools errors. The `<audio id="music">` element is present in the DOM (check Elements panel).

- [ ] **Step 4: Commit**

```bash
git add index.html js/MusicController.js
git commit -m "feat(music): add MusicController with mute and volume"
```

---

### Task 7: Create `KenBurns.js`

**Files:**
- Create: `js/KenBurns.js`

- [ ] **Step 1: Create `js/KenBurns.js`**

```js
// Applies a Ken Burns (slow zoom/pan) animation to an image element.
// The CSS @keyframes rules (kb-zoom-in-center, kb-pan-left, etc.) live in css/style.css.

const VALID_MODES = new Set([
  'zoom-in-center',
  'zoom-in-left',
  'zoom-in-right',
  'zoom-out',
  'pan-left',
  'pan-right',
  'none',
]);

const DEFAULT_MODE = 'zoom-in-center';

export const KenBurns = {
  start(imgEl, mode, durationMs) {
    if (!imgEl) return;
    this.stop(imgEl);
    if (mode === 'none') return;

    let resolved = mode;
    if (!VALID_MODES.has(mode)) {
      console.warn(`KenBurns: unknown mode "${mode}", using "${DEFAULT_MODE}"`);
      resolved = DEFAULT_MODE;
    }
    const ms = (typeof durationMs === 'number' && durationMs > 0) ? durationMs : 8000;
    imgEl.style.animation = `kb-${resolved} ${ms}ms ease-out forwards`;
    imgEl.classList.add('kb-active');
  },

  stop(imgEl) {
    if (!imgEl) return;
    imgEl.style.animation = '';
    imgEl.classList.remove('kb-active');
  },
};
```

- [ ] **Step 2: Smoke test**

Reload. No DevTools errors. Module loads cleanly (will be imported in a later task).

- [ ] **Step 3: Commit**

```bash
git add js/KenBurns.js
git commit -m "feat(motion): add KenBurns animation helper"
```

---

### Task 8: Overhaul `buildBook.js` for spread layout

**Files:**
- Modify: `js/buildBook.js`

Changes:
1. One story page → two book pages (illustration page + text page)
2. Illustration page has no overlay text
3. Text page has cream background, drop cap, author name, page number
4. StPageFlip config updated: heavier physics, bigger shadow
5. Expose a helper to look up DOM elements for a given story page index (used by BookController)

- [ ] **Step 1: Replace `js/buildBook.js`**

```js
// Builds the book DOM from a story object and initializes StPageFlip.
// Each story page becomes TWO book pages: an illustration page and a text page.
// This is the ONLY module that touches StPageFlip — isolates the library.

export function buildBook(story, containerEl) {
  containerEl.innerHTML = '';

  // Front cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover',
    image: story.cover.image,
    title: story.title,
  }));

  // Content: for each story page, render an illustration page then a text page.
  story.pages.forEach((p, i) => {
    containerEl.appendChild(renderIllustrationPage({
      image: p.image,
      storyIndex: i,
    }));
    containerEl.appendChild(renderTextPage({
      text: p.text,
      author: story.author,
      pageNumber: i + 1,
      storyIndex: i,
    }));
  });

  // Back cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover page-cover-back',
    image: story.backCover.image,
    title: '',
  }));

  const pageFlip = new window.St.PageFlip(containerEl, {
    width: 550,
    height: 733,
    size: 'stretch',
    minWidth: 315,
    maxWidth: 1000,
    minHeight: 420,
    maxHeight: 1400,
    maxShadowOpacity: 0.7,
    flippingTime: 1400,
    showCover: true,
    usePortrait: false,
    mobileScrollSupport: false,
  });

  pageFlip.loadFromHTML(containerEl.querySelectorAll('.page'));

  return pageFlip;
}

// Helper: find the <img> inside the illustration page for a given story index.
export function findIllustrationImg(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-illustration[data-story-index="${storyIndex}"] img.page-image`
  );
}

// Helper: find the text page element for a given story index.
export function findTextPage(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-text-page[data-story-index="${storyIndex}"]`
  );
}

function renderCoverPage({ className, image, title }) {
  const el = document.createElement('div');
  el.className = className;
  const img = document.createElement('img');
  img.className = 'page-image';
  img.src = image;
  img.alt = '';
  img.onerror = () => { img.style.display = 'none'; };
  el.appendChild(img);
  if (title) {
    const h = document.createElement('div');
    h.className = 'cover-title';
    h.textContent = title;
    el.appendChild(h);
  }
  return el;
}

function renderIllustrationPage({ image, storyIndex }) {
  const el = document.createElement('div');
  el.className = 'page page-illustration';
  el.dataset.storyIndex = String(storyIndex);
  const img = document.createElement('img');
  img.className = 'page-image';
  img.src = image;
  img.alt = '';
  img.onerror = () => { img.style.display = 'none'; };
  el.appendChild(img);
  return el;
}

function renderTextPage({ text, author, pageNumber, storyIndex }) {
  const el = document.createElement('div');
  el.className = 'page page-text-page';
  el.dataset.storyIndex = String(storyIndex);

  if (author) {
    const authorEl = document.createElement('div');
    authorEl.className = 'page-author';
    authorEl.textContent = author;
    el.appendChild(authorEl);
  }

  const body = document.createElement('div');
  body.className = 'page-body';
  const para = document.createElement('p');
  para.className = 'page-paragraph';
  para.textContent = text || '';
  body.appendChild(para);
  el.appendChild(body);

  const num = document.createElement('div');
  num.className = 'page-number';
  num.textContent = String(pageNumber);
  el.appendChild(num);

  return el;
}
```

- [ ] **Step 2: Smoke test**

Reload `http://localhost:8000`.
Expected: Book now shows illustration on left page and text on right page for each spread. Cover still works. Text is unstyled (CSS overhaul comes in Task 10) — that's OK. Open DevTools and verify: `document.querySelectorAll('.page').length` equals **8** (1 cover + 3 illustrations + 3 text pages + 1 back cover).

- [ ] **Step 3: Commit**

```bash
git add js/buildBook.js
git commit -m "feat(layout): split each story page into illustration + text spread"
```

---

### Task 9: Update `BookController.js` spread-aware navigation

**Files:**
- Modify: `js/BookController.js`

The book now has 2 pages per story entry. We need to:
1. Map StPageFlip's current index → story page index correctly (divide by 2, offset by 1 for cover).
2. On flip, identify which story page we're on and load its audio/Ken Burns/text reveal.
3. On auto-advance, flip **two** pages (entire spread) not one.
4. Fire `sfx.playFlip()` on every flip.
5. Start music on first play.
6. Add idle corner-lift hint (toggle class after 3s of inactivity).
7. Manage text reveal class.

This task only updates the controller to handle spread math and wires in `sfx`, `music`, `kenBurns`, and the reveal class. The CSS for those lives in Task 10.

- [ ] **Step 1: Replace `js/BookController.js`**

```js
// Orchestrates the book: audio/timer → advance full spread; flip → load new spread's
// audio, Ken Burns, text reveal; trigger SFX on every flip; start music on first play.

import { KenBurns } from './KenBurns.js';
import { findIllustrationImg, findTextPage } from './buildBook.js';

const IDLE_HINT_DELAY_MS = 3000;

export class BookController {
  constructor({ story, pageFlip, audio, music, sfx, bookEl }) {
    this.story = story;
    this.pageFlip = pageFlip;
    this.audio = audio;
    this.music = music;
    this.sfx = sfx;
    this.bookEl = bookEl;
    this.isPlaying = false;
    this.onChange = null;
    this._timerId = null;
    this._idleTimer = null;
    this._lastHintedTextPage = null;

    this.audio.onEnded = () => {
      if (!this.isPlaying) return;
      this._advanceOrStop();
    };

    this.pageFlip.on('flip', () => {
      if (this.sfx) this.sfx.playFlip();
      this._clearTimer();
      this._stopKenBurnsAll();
      this._clearRevealAll();
      this.audio.reset();
      this._loadCurrentPage();
      this._applyKenBurnsForCurrent();
      if (this.isPlaying) {
        this._revealTextForCurrent();
        this._playCurrentPage();
      }
      this._resetIdleHint();
      if (this.onChange) this.onChange();
    });

    this._loadCurrentPage();
    this._applyKenBurnsForCurrent();
    this._scheduleIdleHint();
  }

  // --- Spread math ---
  // Book pages: [0]=cover, [1]=illus0, [2]=text0, [3]=illus1, [4]=text1, ..., [last]=back cover.
  // Story page index = (bookIdx - 1) >> 1   (only valid when bookIdx is in content range)

  currentStoryPageIndex() {
    const bookIdx = this.pageFlip.getCurrentPageIndex();
    if (bookIdx < 1) return -1;
    const contentPages = this.story.pages.length * 2;
    if (bookIdx > contentPages) return -1;
    return (bookIdx - 1) >> 1;
  }

  currentPageData() {
    const idx = this.currentStoryPageIndex();
    return idx >= 0 ? this.story.pages[idx] : null;
  }

  _loadCurrentPage() {
    const p = this.currentPageData();
    if (!p) { this.audio.load(null); return; }
    this.audio.load(p.audio || null);
  }

  _currentPageHasAudio() {
    const p = this.currentPageData();
    return !!(p && p.audio);
  }

  _currentPageDurationMs() {
    const p = this.currentPageData();
    if (!p) return null;
    const d = p.durationMs;
    return typeof d === 'number' && d > 0 ? d : null;
  }

  _playCurrentPage() {
    this._clearTimer();
    if (this._currentPageHasAudio()) {
      this.audio.play();
      return;
    }
    const ms = this._currentPageDurationMs();
    if (ms != null) {
      this._timerId = setTimeout(() => {
        this._timerId = null;
        if (this.isPlaying) this._advanceOrStop();
      }, ms);
      return;
    }
    this.pause();
  }

  _advanceOrStop() {
    const storyIdx = this.currentStoryPageIndex();
    if (storyIdx < 0 || storyIdx >= this.story.pages.length - 1) {
      this.pause();
      return;
    }
    // Advance by an entire spread (two book pages).
    this.pageFlip.flipNext();
    // A single flipNext animates one page; scheduling a second flipNext
    // after the first completes would require an event hook. Simpler:
    // call flip() to jump directly to the next spread's left page.
    const targetBookIdx = this.pageFlip.getCurrentPageIndex() + 1;
    // Defer slightly so StPageFlip has committed the first flip before we call flip() again.
    setTimeout(() => this.pageFlip.flip(targetBookIdx), 50);
  }

  _clearTimer() {
    if (this._timerId != null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  // --- Ken Burns ---

  _applyKenBurnsForCurrent() {
    const p = this.currentPageData();
    if (!p) return;
    const idx = this.currentStoryPageIndex();
    const img = findIllustrationImg(this.bookEl, idx);
    if (!img) return;
    const mode = p.kenBurns || 'zoom-in-center';
    const ms = this._currentPageDurationMs() || 8000;
    KenBurns.start(img, mode, ms);
  }

  _stopKenBurnsAll() {
    this.bookEl.querySelectorAll('.page-illustration img.page-image').forEach(img => {
      KenBurns.stop(img);
    });
  }

  // --- Text reveal ---

  _revealTextForCurrent() {
    const idx = this.currentStoryPageIndex();
    const el = findTextPage(this.bookEl, idx);
    if (el) el.classList.add('reveal');
  }

  _clearRevealAll() {
    this.bookEl.querySelectorAll('.page-text-page.reveal').forEach(el => {
      el.classList.remove('reveal');
    });
  }

  // --- Idle hint (corner lift) ---

  _scheduleIdleHint() {
    this._clearIdleHint();
    this._idleTimer = setTimeout(() => {
      const idx = this.currentStoryPageIndex();
      if (idx < 0) return;
      const el = findTextPage(this.bookEl, idx);
      if (el) {
        el.classList.add('hint-corner-lift');
        this._lastHintedTextPage = el;
      }
    }, IDLE_HINT_DELAY_MS);
  }

  _clearIdleHint() {
    if (this._idleTimer != null) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    if (this._lastHintedTextPage) {
      this._lastHintedTextPage.classList.remove('hint-corner-lift');
      this._lastHintedTextPage = null;
    }
  }

  _resetIdleHint() {
    this._clearIdleHint();
    if (!this.isPlaying) this._scheduleIdleHint();
  }

  // --- Public controls ---

  play() {
    this.isPlaying = true;
    if (this.music) this.music.start();
    this._revealTextForCurrent();
    this._playCurrentPage();
    this._resetIdleHint();
    if (this.onChange) this.onChange();
  }

  pause() {
    this.isPlaying = false;
    this._clearTimer();
    this.audio.pause();
    this._resetIdleHint();
    if (this.onChange) this.onChange();
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  next() { this.pageFlip.flipNext(); }
  prev() { this.pageFlip.flipPrev(); }
  jumpTo(bookIndex) { this.pageFlip.flip(bookIndex); }

  restart() {
    this.pause();
    this.audio.reset();
    this._stopKenBurnsAll();
    this._clearRevealAll();
    this.pageFlip.flip(0);
  }

  get currentPageNumber() { return this.pageFlip.getCurrentPageIndex() + 1; }
  get totalPages() { return this.pageFlip.getPageCount(); }
}
```

- [ ] **Step 2: Smoke test**

Reload. Book renders. Click a page corner to flip manually. Expected: console has no errors. (The new features will only come alive once Task 10 wires the CSS and Task 11 wires the controllers into app.js.) The old behavior should still work — if it's totally broken, revert and investigate.

- [ ] **Step 3: Commit**

```bash
git add js/BookController.js
git commit -m "feat(orchestrator): spread-aware navigation + wire sfx/music/kenBurns/reveal"
```

---

### Task 10: CSS overhaul — layout, typography, wood, vignette, keyframes

**Files:**
- Modify: `index.html` (Google Font link)
- Modify: `css/style.css`

- [ ] **Step 1: Add Google Font to `index.html`**

In the `<head>` of `index.html`, add (before the existing `<link rel="stylesheet" href="css/style.css" />`):

```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Replace `css/style.css` entirely**

```css
* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: "EB Garamond", Georgia, serif;
  color: #f0e4c9;
  /* Wood-grain gradient backdrop */
  background:
    radial-gradient(ellipse at center, #3a2414 0%, #1a0e07 80%),
    repeating-linear-gradient(
      90deg,
      rgba(60, 35, 15, 0.25) 0px,
      rgba(40, 22, 8, 0.25) 2px,
      rgba(60, 35, 15, 0.25) 4px
    );
  background-blend-mode: multiply;
}

/* Vignette overlay */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.75) 100%);
  z-index: 5;
}

#app {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 40px 20px;
  z-index: 10;
}

#book {
  width: 100%;
  max-width: 1100px;
  filter: drop-shadow(0 30px 80px rgba(0, 0, 0, 0.75));
}

/* --- Pages --- */

.page {
  background: #fdf6e3;
  color: #222;
  position: relative;
  overflow: hidden;
}

.page-cover {
  background: #5a2a13;
  color: #f0e4c9;
}
.page-cover .page-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-title {
  position: absolute;
  left: 0; right: 0; bottom: 20%;
  text-align: center;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #f0e4c9;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

/* Illustration page — full bleed */
.page-illustration {
  background: #1a0e07;
  overflow: hidden;
}
.page-illustration .page-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: center center;
}

/* Text page */
.page-text-page {
  background: #faf3e0;
  padding: 56px 52px 40px 52px;
  color: #2a1d10;
}

.page-text-page .page-author {
  position: absolute;
  top: 24px;
  right: 36px;
  font-size: 11px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #8a6a3d;
}

.page-text-page .page-body {
  /* Reserve top space for author, bottom for page number */
  position: absolute;
  top: 70px;
  bottom: 60px;
  left: 52px;
  right: 52px;
  display: flex;
  align-items: center;
}

.page-text-page .page-paragraph {
  font-size: 17px;
  line-height: 1.55;
  margin: 0;
  text-align: left;
  font-family: "EB Garamond", Georgia, serif;
}

.page-text-page .page-paragraph::first-letter {
  float: left;
  font-size: 62px;
  line-height: 0.85;
  padding: 4px 8px 0 0;
  font-weight: 600;
  color: #4a2b10;
  font-family: "EB Garamond", Georgia, serif;
}

.page-text-page .page-number {
  position: absolute;
  bottom: 24px;
  left: 0; right: 0;
  text-align: center;
  font-size: 12px;
  color: #8a6a3d;
  font-style: italic;
}

/* --- Text reveal animation --- */
.page-text-page .page-body,
.page-text-page .page-author,
.page-text-page .page-number {
  opacity: 1;
  transition: opacity 800ms ease-out;
}
.page-text-page.reveal .page-body {
  animation: text-fade-in 800ms ease-out;
}
.page-text-page.reveal .page-paragraph::first-letter {
  display: inline-block;
  animation: dropcap-in 1000ms ease-out 150ms backwards;
}
@keyframes text-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes dropcap-in {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

/* --- Ken Burns keyframes --- */
@keyframes kb-zoom-in-center {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.10) translate(0, 0); }
}
@keyframes kb-zoom-in-left {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.12) translate(-3%, 0); }
}
@keyframes kb-zoom-in-right {
  from { transform: scale(1.0) translate(0, 0); }
  to   { transform: scale(1.12) translate(3%, 0); }
}
@keyframes kb-zoom-out {
  from { transform: scale(1.12); }
  to   { transform: scale(1.0); }
}
@keyframes kb-pan-left {
  from { transform: scale(1.08) translate(3%, 0); }
  to   { transform: scale(1.08) translate(-3%, 0); }
}
@keyframes kb-pan-right {
  from { transform: scale(1.08) translate(-3%, 0); }
  to   { transform: scale(1.08) translate(3%, 0); }
}
.kb-active { animation-fill-mode: forwards; }

/* --- Idle corner-lift hint --- */
.page-text-page.hint-corner-lift::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, transparent 50%, rgba(138, 106, 61, 0.3) 50%);
  transform-origin: bottom right;
  animation: corner-hint 3s ease-in-out infinite;
  pointer-events: none;
}
@keyframes corner-hint {
  0%, 100% { transform: rotate(0deg); }
  40%      { transform: rotate(-4deg) translate(-2px, -2px); }
  60%      { transform: rotate(-4deg) translate(-2px, -2px); }
}

/* --- Controls --- */
#controls {
  margin-top: 24px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  padding: 12px 18px;
  background: rgba(26, 14, 7, 0.9);
  border: 1px solid #5a2a13;
  border-radius: 8px;
  color: #f0e4c9;
  font-family: "EB Garamond", Georgia, serif;
  position: relative;
  z-index: 20;
}
#controls button {
  background: #5a2a13;
  color: #f0e4c9;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 16px;
  cursor: pointer;
}
#controls button:hover { background: #7a3a1f; }
#controls button.active { background: #8a4a2f; }
#controls .ctl { display: flex; align-items: center; gap: 6px; }
#controls select,
#controls input[type="range"] {
  background: #2b2118;
  color: #f0e4c9;
  border: 1px solid #5a2a13;
  border-radius: 4px;
  padding: 4px;
}
.page-indicator { display: flex; align-items: center; gap: 6px; }

/* --- Music volume popover --- */
.music-wrapper { position: relative; }
.music-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1a0e07;
  border: 1px solid #5a2a13;
  border-radius: 6px;
  padding: 10px 14px;
  display: none;
  white-space: nowrap;
  z-index: 30;
}
.music-wrapper.open .music-popover { display: block; }

/* --- Error screen --- */
.error-screen {
  color: #f0e4c9;
  background: #3a1a10;
  border: 1px solid #7a3a1f;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  text-align: center;
}
.error-screen button {
  margin-top: 12px;
  padding: 8px 16px;
  background: #5a2a13;
  color: #f0e4c9;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(26, 14, 7, 0.95);
  color: #f0e4c9;
  padding: 10px 18px;
  border-radius: 6px;
  z-index: 1000;
}
```

- [ ] **Step 3: Smoke test**

Reload.
Expected:
- Dark wood-grain background with vignette darkening the edges
- Book has a large drop shadow, feels "placed on a desk"
- Cover renders with title centered
- Flipping forward shows illustration on the left page (full bleed), text on the right page with drop cap, author top-right, page number bottom-center
- Typography is EB Garamond (or Georgia fallback if Google Fonts blocked)
- Manual next/prev works; Ken Burns/music/SFX still not wired (Task 11)

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat(style): full layout overhaul — wood backdrop, spread typography, Ken Burns keyframes"
```

---

### Task 11: Wire new controllers into `app.js` and add music button to control bar

**Files:**
- Modify: `index.html` (add music button + popover to control bar)
- Modify: `js/UIController.js` (wire music toggle/volume)
- Modify: `js/app.js` (instantiate MusicController, SfxController, pass bookEl to BookController)

- [ ] **Step 1: Add music controls to `index.html`**

In `index.html`, find the control bar. Before the `<label class="ctl">` that wraps the volume slider (the 🔊 one), add:

```html
      <span class="music-wrapper" id="music-wrapper">
        <button id="btn-music" title="Music">&#127925;</button>
        <div class="music-popover">
          <label class="ctl">
            Music
            <input id="music-volume" type="range" min="0" max="100" value="20" />
          </label>
        </div>
      </span>
```

Also, update the existing volume slider label from `&#128266;` to `Voice &#128266;` for clarity. Change:
```html
      <label class="ctl">
        &#128266;
        <input id="volume" type="range" min="0" max="100" value="100" />
      </label>
```
to:
```html
      <label class="ctl">
        Voice &#128266;
        <input id="volume" type="range" min="0" max="100" value="100" />
      </label>
```

- [ ] **Step 2: Replace `js/UIController.js`**

```js
// Wires DOM controls to BookController, AudioController, and MusicController.

export class UIController {
  constructor({ book, audio, music }) {
    this.book = book;
    this.audio = audio;
    this.music = music;

    this.btnRestart  = document.getElementById('btn-restart');
    this.btnPrev     = document.getElementById('btn-prev');
    this.btnPlay     = document.getElementById('btn-play');
    this.btnNext     = document.getElementById('btn-next');
    this.pageJump    = document.getElementById('page-jump');
    this.pageTotal   = document.getElementById('page-total');
    this.volume      = document.getElementById('volume');
    this.speed       = document.getElementById('speed');
    this.btnMusic    = document.getElementById('btn-music');
    this.musicWrap   = document.getElementById('music-wrapper');
    this.musicVolume = document.getElementById('music-volume');

    this._populatePageJump();
    this._bindEvents();
    this._sync();

    this.book.onChange = () => this._sync();
  }

  _populatePageJump() {
    const total = this.book.totalPages;
    this.pageTotal.textContent = String(total);
    this.pageJump.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i + 1);
      this.pageJump.appendChild(opt);
    }
  }

  _bindEvents() {
    this.btnRestart.addEventListener('click', () => this.book.restart());
    this.btnPrev.addEventListener('click',    () => this.book.prev());
    this.btnNext.addEventListener('click',    () => this.book.next());
    this.btnPlay.addEventListener('click',    () => this.book.toggle());

    this.pageJump.addEventListener('change', e => {
      this.book.jumpTo(Number(e.target.value));
    });

    this.volume.addEventListener('input', e => {
      this.audio.setVolume(Number(e.target.value) / 100);
    });

    this.speed.addEventListener('change', e => {
      this.audio.setRate(Number(e.target.value));
    });

    // Music toggle: short click toggles mute, right-click or long-click opens popover.
    // Simpler: click toggles mute; mouseenter on wrapper opens popover.
    this.btnMusic.addEventListener('click', () => {
      if (this.music && this.music.hasSource) {
        this.music.start(); // lazy-start on first interaction
        this.music.toggleMute();
        this.btnMusic.classList.toggle('active', !this.music.isMuted);
      }
    });
    this.musicWrap.addEventListener('mouseenter', () => this.musicWrap.classList.add('open'));
    this.musicWrap.addEventListener('mouseleave', () => this.musicWrap.classList.remove('open'));

    this.musicVolume.addEventListener('input', e => {
      if (this.music) this.music.setVolume(Number(e.target.value) / 100);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { this.book.prev(); }
      if (e.key === 'ArrowRight') { this.book.next(); }
      if (e.key === ' ')          { e.preventDefault(); this.book.toggle(); }
    });

    this.audio.setVolume(Number(this.volume.value) / 100);
    this.audio.setRate(Number(this.speed.value));
    if (this.music) this.music.setVolume(Number(this.musicVolume.value) / 100);

    // Reflect initial music state
    if (this.music && this.music.hasSource && !this.music.isMuted) {
      this.btnMusic.classList.add('active');
    }
  }

  _sync() {
    this.btnPlay.textContent = this.book.isPlaying ? '\u23F8' : '\u25B6';
    this.pageJump.value = String(this.book.currentPageNumber - 1);
  }
}
```

- [ ] **Step 3: Replace `js/app.js`**

```js
import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';
import { AudioController } from './AudioController.js';
import { MusicController } from './MusicController.js';
import { SfxController } from './SfxController.js';
import { BookController } from './BookController.js';
import { UIController } from './UIController.js';

const bookEl = document.getElementById('book');
const audioEl = document.getElementById('narration');
const musicEl = document.getElementById('music');

function showError(message) {
  bookEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'error-screen';
  const p = document.createElement('p');
  p.textContent = message;
  const btn = document.createElement('button');
  btn.textContent = 'Reload';
  btn.addEventListener('click', () => location.reload());
  div.appendChild(p);
  div.appendChild(btn);
  bookEl.appendChild(div);
}

function showToast(message, ms = 2500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

if (!window.St || !window.St.PageFlip) {
  showError('Page-flip library failed to load. Check your internet connection.');
} else {
  loadStory()
    .then(story => {
      const pageFlip = buildBook(story, bookEl);

      const audio = new AudioController(audioEl);

      const music = new MusicController({
        audioEl: musicEl,
        src: story.ambient && story.ambient.music ? story.ambient.music : null,
        defaultVolume: story.ambient && typeof story.ambient.volume === 'number'
          ? story.ambient.volume
          : 0.2,
      });

      const sfx = new SfxController({
        flipUrl: 'assets/sfx/page-flip.mp3',
        narration: audio,
      });

      const book = new BookController({
        story, pageFlip, audio, music, sfx, bookEl,
      });

      // Preserve BookController's onMissing (if set) and add toast.
      const prevOnMissing = audio.onMissing;
      audio.onMissing = () => {
        if (prevOnMissing) prevOnMissing();
        showToast('No audio for this page — click Next to continue');
      };

      new UIController({ book, audio, music });
    })
    .catch(err => {
      console.error(err);
      showError(`Failed to load story: ${err.message}`);
    });
}
```

- [ ] **Step 4: Smoke test — full feature check**

Reload. Run through this checklist:

1. **Visual baseline**: wood backdrop, vignette, book with drop shadow, cover readable.
2. **Cover → first spread**: click Play. Music starts (you'll hear ambient loop). Page flips with a **page-flip sound**. Narration volume ducks briefly during the flip. First story spread shows: illustration on left, cream text page on right with drop cap, author name top-right, page number "1" bottom-center. Text fades in, drop cap scales in. Illustration zooms slowly (Ken Burns).
3. **Auto-advance**: after 8s, entire spread advances (flipping through illustration AND text) to the next spread. Flip sound plays.
4. **Manual Next/Prev**: flip sound plays, new page's Ken Burns restarts.
5. **Music mute button**: click 🎵. Music silences. Click again, music resumes. Button has `.active` class when unmuted.
6. **Music volume popover**: hover over the music button. Popover appears with music volume slider. Drag it. Music volume changes live.
7. **Voice volume**: separate slider adjusts narration (inaudible with `audio: null`, but no error).
8. **Speed dropdown**: changes narration rate (if audio). No error without audio.
9. **Restart**: returns to cover, music keeps playing, narration stops, animations cleared.
10. **Idle hint**: pause on a text page, wait 3s. Corner-lift hint animates on bottom-right of right page. Interact (click, flip) → hint stops.
11. **Keyboard**: ←/→ flip, Space toggles play.
12. **Errors**: temporarily rename `assets/music/ambient.mp3` → reload. Music button still visible, music silent, no crash. Rename back.

If any check fails, fix the specific issue. Common failures and fixes:
- Ken Burns not animating → ensure `findIllustrationImg` finds the `<img>` (check DOM attribute `data-story-index` exists).
- Text reveal not firing → ensure BookController calls `_revealTextForCurrent()` on play AND on flip.
- Auto-advance only flipping one page (not full spread) → verify the `setTimeout(..., 50)` secondary `flip()` call is present in `_advanceOrStop`.
- Music not starting → must be triggered by a user gesture; ensure Play button click calls `music.start()`.

- [ ] **Step 5: Commit**

```bash
git add index.html js/UIController.js js/app.js
git commit -m "feat(ui): wire music toggle/popover and instantiate all new controllers"
```

---

### Task 12: Push to GitHub

- [ ] **Step 1: Push**

```bash
cd /c/Users/Brandon/pf2e-story
git push
```

- [ ] **Step 2: Verify on GitHub Pages**

Wait ~1 minute, then visit `https://cxbrandonsams-tech.github.io/pf2e-story/`. Re-run the full smoke-test checklist from Task 11 on the deployed version. Report any differences from local.

---

## Done

After Task 12, the storybook has the full cinematic polish: spread layout matching the reference, weighted flips with paper-flip SFX, ambient music with mute/volume, Ken Burns on illustrations, text fade-in with drop cap, wood-grain backdrop, vignette, idle corner-lift hint.
