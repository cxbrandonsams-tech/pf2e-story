# Interactive Storybook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained, unlimited-page interactive storybook webpage with two-page-spread 3D page-flip animation, per-page narration audio with auto-advance, and full reader controls. Deployed via GitHub Pages.

**Architecture:** Static site. Vanilla HTML/CSS/ES-module JS, no build step. StPageFlip (via CDN) renders the 3D book. Content lives in `story.json`; images/audio in sibling folders. Orchestrated by a small set of focused JS modules.

**Tech Stack:** HTML5, CSS3, Vanilla JS (ES modules), StPageFlip (CDN), GitHub Pages.

**Testing note:** This is a static visual UI with no existing test framework. "Tests" in this plan are **manual smoke checks in a browser**, listed explicitly per task. Run a local static server throughout development: `python -m http.server 8000` from the repo root, then open `http://localhost:8000`.

**Revision (2026-04-06):** The user is still actively writing the story and does not yet have real images or narration audio. For initial development:
- **Images:** Use remote `https://placehold.co/...` URLs directly in `story.json`. No local `images/` files needed yet.
- **Audio:** Skipped entirely for initial build. `audio/` folder is empty; `audio` field in `story.json` is `null` for every page.
- **Auto-advance:** Each page in `story.json` may include an optional `durationMs` field (number). When the page is shown and playback is active, a timer of that length triggers `flipNext()`. If `durationMs` is missing/null, the page requires manual Next. When audio is added later, `audio` takes precedence over `durationMs`.
- Task 2 becomes "write `story.json` with placeholder URLs" — no local image/audio files are created.
- Tasks 5 and 6 still build the AudioController and its hook-up, but `BookController` must also support the `durationMs` timer path.

---

## File Structure

```
/
├── index.html               # shell: book container + control bar
├── css/
│   └── style.css            # book, page, cover, control bar styles
├── js/
│   ├── app.js               # entry: wires modules together
│   ├── loadStory.js         # fetches + validates story.json
│   ├── buildBook.js         # builds page DOM, inits StPageFlip (only file touching StPageFlip)
│   ├── AudioController.js   # audio element wrapper (play/pause/volume/rate/ended)
│   ├── BookController.js    # orchestrator: audio ended → flip; flip → play new audio
│   └── UIController.js      # wires DOM controls to BookController/AudioController
├── story.json               # sample 3-page story for development
├── images/                  # cover.png, back.png, 01.png, 02.png, 03.png (placeholders)
├── audio/                   # 01.mp3, 02.mp3, 03.mp3 (placeholders; silent MP3s OK for dev)
├── README.md
└── .gitignore
```

Each JS module is one responsibility. `buildBook.js` is the only file that imports StPageFlip, isolating the library for future swap.

---

### Task 1: Initialize repo and skeleton

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `index.html`

- [ ] **Step 1: Initialize git repo**

Run from `C:\Users\Brandon\pf2e-story`:
```bash
git init
git branch -M main
```

- [ ] **Step 2: Create `.gitignore`**

```
.DS_Store
Thumbs.db
*.log
.vscode/
.idea/
node_modules/
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Interactive Storybook

A self-contained, unlimited-page interactive storybook webpage with realistic 3D page-flip animation and auto-narrated audio.

## Local development

This site uses `fetch()` for `story.json`, so it must be served via HTTP — opening `index.html` directly via `file://` will fail in most browsers.

```bash
python -m http.server 8000
```

Then open http://localhost:8000

## Content

Edit `story.json` to change story text and per-page image/audio references. Drop images into `images/` and narration MP3s into `audio/`.

## Deployment

Enable GitHub Pages on the `main` branch at repository root. The site will be available at `https://<user>.github.io/<repo>/`.
```

- [ ] **Step 4: Create minimal `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Interactive Storybook</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <div id="app">
    <div id="book"></div>
    <div id="controls" hidden></div>
    <audio id="narration" preload="auto"></audio>
  </div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Smoke test**

Run: `python -m http.server 8000` then open `http://localhost:8000`.
Expected: Blank page, no console errors (404 for `css/style.css` and `js/app.js` are expected — next tasks create them).

- [ ] **Step 6: Commit**

```bash
git add .gitignore README.md index.html
git commit -m "chore: initial repo skeleton"
```

---

### Task 2: Sample content (story.json + placeholder assets)

**Files:**
- Create: `story.json`
- Create: `images/` (with placeholder files)
- Create: `audio/` (with placeholder files)

- [ ] **Step 1: Create `story.json` with a 3-page sample**

```json
{
  "title": "Sample Story",
  "author": "Brandon",
  "cover":     { "image": "images/cover.png" },
  "backCover": { "image": "images/back.png" },
  "pages": [
    { "image": "images/01.png", "audio": "audio/01.mp3", "text": "Once upon a time, in a land far away..." },
    { "image": "images/02.png", "audio": "audio/02.mp3", "text": "A brave hero set out on a quest." },
    { "image": "images/03.png", "audio": "audio/03.mp3", "text": "And they all lived happily ever after." }
  ]
}
```

- [ ] **Step 2: Create placeholder images**

Create 5 placeholder PNGs (any solid-color 800x1000 image works — use an online placeholder generator, or any image tool):
- `images/cover.png`
- `images/back.png`
- `images/01.png`
- `images/02.png`
- `images/03.png`

Quick option: download from `https://placehold.co/800x1000/png?text=Cover` etc., or make them in any image editor.

- [ ] **Step 3: Create placeholder audio**

Create 3 short silent (or any) MP3s. Quickest option: generate 2-second silent MP3s via any tool, or download a free short MP3. Any valid MP3 works for development:
- `audio/01.mp3`
- `audio/02.mp3`
- `audio/03.mp3`

- [ ] **Step 4: Smoke test**

Reload `http://localhost:8000`. Still blank, but verify no new 404s by opening `http://localhost:8000/story.json` directly — it should return the JSON.

- [ ] **Step 5: Commit**

```bash
git add story.json images/ audio/
git commit -m "feat: add sample story content and placeholder assets"
```

---

### Task 3: `loadStory.js` — fetch and validate content

**Files:**
- Create: `js/loadStory.js`

- [ ] **Step 1: Create `js/loadStory.js`**

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
}
```

- [ ] **Step 2: Create temporary `js/app.js` to smoke-test the loader**

```js
import { loadStory } from './loadStory.js';

loadStory()
  .then(story => {
    console.log('Loaded story:', story);
  })
  .catch(err => {
    console.error('Failed to load story:', err);
  });
```

- [ ] **Step 3: Smoke test**

Reload `http://localhost:8000`. Open DevTools console.
Expected: `Loaded story: {title: "Sample Story", ...}` logged. No errors.

Then temporarily rename `story.json` to `story.json.bak` and reload.
Expected: `Failed to load story: Error: Failed to load story.json: HTTP 404` logged.
Rename back before proceeding.

- [ ] **Step 4: Commit**

```bash
git add js/loadStory.js js/app.js
git commit -m "feat: add story.json loader with validation"
```

---

### Task 4: `buildBook.js` — render pages with StPageFlip

**Files:**
- Create: `js/buildBook.js`
- Modify: `index.html` (add StPageFlip CDN script)
- Modify: `js/app.js` (call buildBook)

- [ ] **Step 1: Add StPageFlip to `index.html`**

Modify `index.html`, adding the CDN script tag just before `</body>` (before the `<script type="module">` line):

```html
  <script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js"></script>
  <script type="module" src="js/app.js"></script>
```

This exposes `window.St.PageFlip`.

- [ ] **Step 2: Create `js/buildBook.js`**

```js
// Builds the book DOM from a story object and initializes StPageFlip.
// This is the ONLY module that touches StPageFlip — isolates the library.

export function buildBook(story, containerEl) {
  containerEl.innerHTML = '';

  // Cover
  containerEl.appendChild(renderPage({
    className: 'page page-cover',
    image: story.cover.image,
    text: story.title,
  }));

  // Content pages
  story.pages.forEach((p, i) => {
    containerEl.appendChild(renderPage({
      className: 'page',
      image: p.image,
      text: p.text,
      index: i,
    }));
  });

  // Back cover
  containerEl.appendChild(renderPage({
    className: 'page page-cover page-cover-back',
    image: story.backCover.image,
    text: '',
  }));

  const pageFlip = new window.St.PageFlip(containerEl, {
    width: 550,
    height: 700,
    size: 'stretch',
    minWidth: 315,
    maxWidth: 1000,
    minHeight: 400,
    maxHeight: 1350,
    maxShadowOpacity: 0.5,
    showCover: true,
    mobileScrollSupport: false,
  });

  pageFlip.loadFromHTML(containerEl.querySelectorAll('.page'));

  return pageFlip;
}

function renderPage({ className, image, text, index }) {
  const el = document.createElement('div');
  el.className = className;
  if (index !== undefined) el.dataset.pageIndex = String(index);

  const img = document.createElement('img');
  img.className = 'page-image';
  img.src = image;
  img.alt = '';
  img.onerror = () => { img.style.display = 'none'; };
  el.appendChild(img);

  if (text) {
    const caption = document.createElement('div');
    caption.className = 'page-text';
    caption.textContent = text;
    el.appendChild(caption);
  }

  return el;
}
```

- [ ] **Step 3: Update `js/app.js` to build the book**

Replace contents of `js/app.js`:

```js
import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';

const bookEl = document.getElementById('book');

loadStory()
  .then(story => {
    const pageFlip = buildBook(story, bookEl);
    console.log('Book built, total pages:', pageFlip.getPageCount());
  })
  .catch(err => {
    console.error(err);
    bookEl.textContent = `Error: ${err.message}`;
  });
```

- [ ] **Step 4: Add minimal CSS so the book is visible**

Create `css/style.css`:

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: #2b2118; font-family: Georgia, serif; }
#app { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
#book { width: 100%; max-width: 1100px; }

.page { background: #fdf6e3; color: #222; padding: 0; overflow: hidden; }
.page-cover { background: #5a2a13; color: #f0e4c9; }
.page-image { display: block; width: 100%; height: 100%; object-fit: cover; }
.page-text {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 16px 24px;
  background: rgba(255, 250, 240, 0.85);
  font-size: 16px;
  line-height: 1.4;
}
.page { position: relative; }
```

- [ ] **Step 5: Smoke test**

Reload `http://localhost:8000`.
Expected: Two-page book spread is visible. Cover shows first. Clicking/dragging a page corner flips to the next spread. No console errors. DevTools console logs `Book built, total pages: 5`.

- [ ] **Step 6: Commit**

```bash
git add index.html js/buildBook.js js/app.js css/style.css
git commit -m "feat: render story as 3D page-flip book"
```

---

### Task 5: `AudioController.js` — audio playback wrapper

**Files:**
- Create: `js/AudioController.js`

- [ ] **Step 1: Create `js/AudioController.js`**

```js
// Wraps a single <audio> element. Loads per-page audio, plays/pauses,
// exposes volume/rate, and emits 'ended' to a listener.

export class AudioController {
  constructor(audioEl) {
    this.el = audioEl;
    this.onEnded = null;
    this.onMissing = null; // called when current page has no audio
    this.currentSrc = null;

    this.el.addEventListener('ended', () => {
      if (this.onEnded) this.onEnded();
    });
  }

  // Load (but do not play) a page's audio. Returns true if audio available.
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

  pause() {
    this.el.pause();
  }

  get isPaused() {
    return this.el.paused;
  }

  setVolume(v) { // 0..1
    this.el.volume = Math.max(0, Math.min(1, v));
  }

  setRate(r) {
    this.el.playbackRate = r;
  }

  reset() {
    this.el.pause();
    this.el.currentTime = 0;
  }
}
```

- [ ] **Step 2: Smoke-test stub in `js/app.js`**

Append temporarily at the bottom of `js/app.js`:

```js
import { AudioController } from './AudioController.js';
const audio = new AudioController(document.getElementById('narration'));
audio.onEnded = () => console.log('audio ended');
audio.load('audio/01.mp3');
window.__audioTest = audio; // for manual testing
```

- [ ] **Step 3: Smoke test**

Reload. In DevTools console:
```
__audioTest.play()
```
Expected: MP3 plays. When it ends, `audio ended` is logged. `__audioTest.pause()` stops it.

- [ ] **Step 4: Remove the temporary test code from `app.js`**

Delete the stub lines added in Step 2 — they'll be replaced in Task 6.

- [ ] **Step 5: Commit**

```bash
git add js/AudioController.js js/app.js
git commit -m "feat: add AudioController wrapper"
```

---

### Task 6: `BookController.js` — orchestrate audio + flip

**Files:**
- Create: `js/BookController.js`
- Modify: `js/app.js`

- [ ] **Step 1: Create `js/BookController.js`**

```js
// Orchestrates the book: audio 'ended' → flip next; flip → play new page audio.
// Tracks "playing" intent so manual flips during playback resume audio on the new page.

export class BookController {
  constructor({ story, pageFlip, audio }) {
    this.story = story;
    this.pageFlip = pageFlip;
    this.audio = audio;
    this.isPlaying = false;
    this.onChange = null; // called on any state change (page or play/pause)

    // Audio finished → flip next (if playing)
    this.audio.onEnded = () => {
      if (!this.isPlaying) return;
      if (this.pageFlip.getCurrentPageIndex() >= this.pageFlip.getPageCount() - 1) {
        this.pause();
        return;
      }
      this.pageFlip.flipNext();
    };

    // Missing audio on current page → stop auto-advance
    this.audio.onMissing = () => {
      this.pause();
    };

    // Flip complete → load new page audio and continue if playing
    this.pageFlip.on('flip', () => {
      this.loadCurrentPageAudio();
      if (this.isPlaying) {
        this.audio.play();
      }
      if (this.onChange) this.onChange();
    });

    this.loadCurrentPageAudio();
  }

  // Maps StPageFlip page index → story page index.
  // Book pages: [0]=cover, [1..N]=content pages, [N+1]=back cover.
  currentStoryPageIndex() {
    const bookIdx = this.pageFlip.getCurrentPageIndex();
    const storyIdx = bookIdx - 1;
    if (storyIdx < 0 || storyIdx >= this.story.pages.length) return -1;
    return storyIdx;
  }

  loadCurrentPageAudio() {
    const idx = this.currentStoryPageIndex();
    if (idx < 0) {
      this.audio.load(null);
      return;
    }
    this.audio.load(this.story.pages[idx].audio || null);
  }

  play() {
    this.isPlaying = true;
    this.audio.play();
    if (this.onChange) this.onChange();
  }

  pause() {
    this.isPlaying = false;
    this.audio.pause();
    if (this.onChange) this.onChange();
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  next() {
    this.pageFlip.flipNext();
  }

  prev() {
    this.pageFlip.flipPrev();
  }

  jumpTo(bookIndex) {
    this.pageFlip.flip(bookIndex);
  }

  restart() {
    this.pause();
    this.audio.reset();
    this.pageFlip.flip(0);
  }

  get currentPageNumber() {
    return this.pageFlip.getCurrentPageIndex() + 1;
  }

  get totalPages() {
    return this.pageFlip.getPageCount();
  }
}
```

- [ ] **Step 2: Wire it into `js/app.js`**

Replace contents of `js/app.js`:

```js
import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';
import { AudioController } from './AudioController.js';
import { BookController } from './BookController.js';

const bookEl = document.getElementById('book');
const audioEl = document.getElementById('narration');

loadStory()
  .then(story => {
    const pageFlip = buildBook(story, bookEl);
    const audio = new AudioController(audioEl);
    const book = new BookController({ story, pageFlip, audio });
    window.__book = book; // for manual testing this task
  })
  .catch(err => {
    console.error(err);
    bookEl.textContent = `Error: ${err.message}`;
  });
```

- [ ] **Step 3: Smoke test**

Reload. In DevTools console:
```
__book.next()        // flips to first content page (story index 0)
__book.play()        // plays audio/01.mp3
```
Expected: Audio plays. When it ends, page auto-flips to next spread and audio/02.mp3 plays. Continues until last page, then stops.

Also test: while audio is playing, run `__book.next()`. Expected: page flips manually, current audio stops, new page audio starts.

- [ ] **Step 4: Commit**

```bash
git add js/BookController.js js/app.js
git commit -m "feat: orchestrate audio and page-flip auto-advance"
```

---

### Task 7: Control bar markup and `UIController.js`

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Create: `js/UIController.js`
- Modify: `js/app.js`

- [ ] **Step 1: Replace `#controls` in `index.html` with the full control bar**

In `index.html`, replace `<div id="controls" hidden></div>` with:

```html
    <div id="controls">
      <button id="btn-restart" title="Restart">⏮</button>
      <button id="btn-prev" title="Previous page">⏪</button>
      <button id="btn-play" title="Play/Pause">▶</button>
      <button id="btn-next" title="Next page">⏩</button>
      <span class="page-indicator">
        Page
        <select id="page-jump"></select>
        / <span id="page-total">0</span>
      </span>
      <label class="ctl">
        🔊
        <input id="volume" type="range" min="0" max="100" value="100" />
      </label>
      <label class="ctl">
        Speed
        <select id="speed">
          <option value="0.75">0.75x</option>
          <option value="1" selected>1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
        </select>
      </label>
    </div>
```

- [ ] **Step 2: Append control-bar styles to `css/style.css`**

```css
#controls {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 16px;
  background: #1a1310;
  border: 1px solid #5a2a13;
  border-radius: 8px;
  color: #f0e4c9;
  font-family: Georgia, serif;
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
#controls .ctl { display: flex; align-items: center; gap: 6px; }
#controls select, #controls input[type="range"] {
  background: #2b2118;
  color: #f0e4c9;
  border: 1px solid #5a2a13;
  border-radius: 4px;
  padding: 4px;
}
.page-indicator { display: flex; align-items: center; gap: 6px; }
```

- [ ] **Step 3: Create `js/UIController.js`**

```js
// Wires DOM controls to BookController and AudioController.
// Also reflects state back into the UI (play icon, page indicator).

export class UIController {
  constructor({ book, audio }) {
    this.book = book;
    this.audio = audio;

    this.btnRestart = document.getElementById('btn-restart');
    this.btnPrev    = document.getElementById('btn-prev');
    this.btnPlay    = document.getElementById('btn-play');
    this.btnNext    = document.getElementById('btn-next');
    this.pageJump   = document.getElementById('page-jump');
    this.pageTotal  = document.getElementById('page-total');
    this.volume     = document.getElementById('volume');
    this.speed      = document.getElementById('speed');

    this.#populatePageJump();
    this.#bindEvents();
    this.#sync();

    this.book.onChange = () => this.#sync();
  }

  #populatePageJump() {
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

  #bindEvents() {
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

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { this.book.prev(); }
      if (e.key === 'ArrowRight') { this.book.next(); }
      if (e.key === ' ')          { e.preventDefault(); this.book.toggle(); }
    });

    // Initialize audio state from default control values
    this.audio.setVolume(Number(this.volume.value) / 100);
    this.audio.setRate(Number(this.speed.value));
  }

  #sync() {
    this.btnPlay.textContent = this.book.isPlaying ? '⏸' : '▶';
    this.pageJump.value = String(this.book.currentPageNumber - 1);
  }
}
```

- [ ] **Step 4: Wire `UIController` into `js/app.js`**

Replace contents of `js/app.js`:

```js
import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';
import { AudioController } from './AudioController.js';
import { BookController } from './BookController.js';
import { UIController } from './UIController.js';

const bookEl = document.getElementById('book');
const audioEl = document.getElementById('narration');

loadStory()
  .then(story => {
    const pageFlip = buildBook(story, bookEl);
    const audio = new AudioController(audioEl);
    const book = new BookController({ story, pageFlip, audio });
    new UIController({ book, audio });
  })
  .catch(err => {
    console.error(err);
    bookEl.textContent = `Error: ${err.message}`;
  });
```

- [ ] **Step 5: Smoke test — every control**

Reload. Verify each:
1. Control bar visible below book.
2. **Play** button → first page audio starts; icon switches to ⏸; auto-advances through pages.
3. **Pause** button → audio pauses; icon switches to ▶.
4. **Next / Prev** buttons → manual flip; if playing, new page audio starts automatically.
5. **Page dropdown** → select page N; book flips to page N.
6. **Page indicator** → updates after each flip.
7. **Volume slider** → changes audio volume live.
8. **Speed dropdown** → 1.5× speeds up playback live.
9. **Restart button** → returns to cover, audio stops, play icon shows ▶.
10. **Keyboard**: ← / → flip pages; Space toggles play/pause.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/UIController.js js/app.js
git commit -m "feat: add full control bar and UI controller"
```

---

### Task 8: Error handling polish and missing-audio fallback

**Files:**
- Modify: `css/style.css`
- Modify: `js/app.js`

- [ ] **Step 1: Add error screen styles**

Append to `css/style.css`:

```css
.error-screen {
  color: #f0e4c9;
  background: #3a1a10;
  border: 1px solid #7a3a1f;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  text-align: center;
  font-family: Georgia, serif;
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
  background: rgba(26, 19, 16, 0.95);
  color: #f0e4c9;
  padding: 10px 18px;
  border-radius: 6px;
  font-family: Georgia, serif;
  z-index: 1000;
}
```

- [ ] **Step 2: Improve error handling in `js/app.js`**

Replace contents of `js/app.js`:

```js
import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';
import { AudioController } from './AudioController.js';
import { BookController } from './BookController.js';
import { UIController } from './UIController.js';

const bookEl = document.getElementById('book');
const audioEl = document.getElementById('narration');

function showError(message) {
  bookEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'error-screen';
  div.innerHTML = `<p>${message}</p><button>Reload</button>`;
  div.querySelector('button').addEventListener('click', () => location.reload());
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
      audio.onMissing = () => showToast('No audio for this page — click Next to continue');
      const book = new BookController({ story, pageFlip, audio });
      // Preserve BookController's onMissing (which calls pause) AND still toast
      const originalOnMissing = audio.onMissing;
      audio.onMissing = () => {
        originalOnMissing();
        book.pause();
      };
      new UIController({ book, audio });
    })
    .catch(err => {
      console.error(err);
      showError(`Failed to load story: ${err.message}`);
    });
}
```

Wait — the above introduces a bug (BookController overwrites onMissing in its constructor). Use this corrected version instead:

```js
import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';
import { AudioController } from './AudioController.js';
import { BookController } from './BookController.js';
import { UIController } from './UIController.js';

const bookEl = document.getElementById('book');
const audioEl = document.getElementById('narration');

function showError(message) {
  bookEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'error-screen';
  div.innerHTML = `<p>${message}</p><button>Reload</button>`;
  div.querySelector('button').addEventListener('click', () => location.reload());
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
      const book = new BookController({ story, pageFlip, audio });

      // Wrap BookController's onMissing to also show a toast
      const bookOnMissing = audio.onMissing;
      audio.onMissing = () => {
        if (bookOnMissing) bookOnMissing();
        showToast('No audio for this page — click Next to continue');
      };

      new UIController({ book, audio });
    })
    .catch(err => {
      console.error(err);
      showError(`Failed to load story: ${err.message}`);
    });
}
```

- [ ] **Step 3: Smoke test — error paths**

1. Rename `story.json` → `story.json.bak`, reload. Expected: error screen with "Failed to load story: …" and a Reload button. Rename back.
2. Edit `story.json` and remove the `audio` field from page 2. Reload, click Play. Expected: page 1 audio plays → flips to page 2 → toast "No audio for this page…" appears → playback pauses. Restore `story.json`.
3. In DevTools, block `cdn.jsdelivr.net` (Network tab → right-click request → Block request domain), reload. Expected: "Page-flip library failed to load" error screen. Unblock.
4. Edit `story.json` to reference `images/missing.png` on page 1. Reload and navigate to page 1. Expected: page text still shows; no broken image icon (the `img.onerror` hides it). Restore.

- [ ] **Step 4: Commit**

```bash
git add css/style.css js/app.js
git commit -m "feat: error screen, missing-audio toast, and image fallback"
```

---

### Task 9: README finalization and GitHub Pages deployment

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Expand `README.md`**

Replace `README.md` contents:

```markdown
# Interactive Storybook

A self-contained, unlimited-page interactive storybook webpage. Two-page book spread with realistic 3D page-flip animation, per-page narration audio with auto-advance, and full reader controls.

## Local development

This site uses `fetch()` for `story.json`, so it must be served via HTTP — opening `index.html` directly via `file://` will fail in most browsers.

```bash
python -m http.server 8000
```

Then open http://localhost:8000

## Editing the story

All content lives in `story.json`:

```json
{
  "title": "Story Title",
  "author": "Your Name",
  "cover":     { "image": "images/cover.png" },
  "backCover": { "image": "images/back.png" },
  "pages": [
    { "image": "images/01.png", "audio": "audio/01.mp3", "text": "Page 1 text..." }
  ]
}
```

To add a page: append an entry to `pages`, drop the image into `images/` and the narration MP3 into `audio/`. There is no page limit.

`text` and `audio` are both optional per page. Pages without audio will not auto-advance.

## Generating narration audio

Any TTS service works — produce an MP3 per page and name it to match `story.json`. Suggested: ElevenLabs, OpenAI TTS, or Google Cloud TTS.

## Controls

- **Play / Pause**: spacebar or ▶ button
- **Next / Previous**: → / ← arrow keys or ⏩ / ⏪ buttons
- **Jump to page**: page dropdown
- **Volume**: slider
- **Speed**: 0.75× / 1× / 1.25× / 1.5×
- **Restart**: ⏮ button

## Deployment (GitHub Pages)

1. Create a GitHub repository and push this directory:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. In the repo's GitHub settings → Pages → Source: Deploy from branch → `main` / `/ (root)`.
3. After a minute, the site is live at `https://<user>.github.io/<repo>/`.

## Architecture

- `index.html` — shell (book container, control bar, audio element)
- `story.json` — content source of truth
- `js/loadStory.js` — fetches + validates content
- `js/buildBook.js` — builds page DOM, initializes StPageFlip (only file touching the library)
- `js/AudioController.js` — audio element wrapper
- `js/BookController.js` — orchestrator: audio `ended` → flip; flip → play new page audio
- `js/UIController.js` — wires DOM controls to the controllers
- `js/app.js` — entry point
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: full README with usage and deployment"
```

- [ ] **Step 3: Deploy to GitHub Pages (manual)**

1. Create a new repository on GitHub (e.g., `interactive-storybook`).
2. Run:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
3. In GitHub → Settings → Pages → Source: `main` branch, `/` root → Save.
4. Wait ~1 minute, then visit `https://<user>.github.io/<repo>/`.

- [ ] **Step 4: Final smoke test on deployed URL**

On the live GitHub Pages URL, repeat the Task 7 smoke test checklist. All controls should work identically to local.

---

## Done

After all tasks complete, you'll have a fully working unlimited-page interactive storybook deployed publicly. To use it for Brandon's actual story: replace `story.json`, drop real images into `images/`, drop real narration MP3s into `audio/`, commit, push.
