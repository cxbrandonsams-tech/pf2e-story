# Stitch Parchment Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark-radial storybook UI with the Google Stitch "Storybook Reader (Single Tonee Parchment)" design, keeping the narration/flip engine intact and dropping music, SFX, restart, and page-jump features.

**Architecture:** The existing StPageFlip + AudioController + BookController engine stays. `index.html` is replaced with a Tailwind-CDN shell derived from Stitch. `css/style.css` is deleted — essential styles (Ken Burns keyframes, word-sync, error/toast, custom slider) move to an inline `<style>` block in the new HTML. `buildBook.js` is rewritten to emit Stitch-styled DOM with a drop-cap, ornate frame, chapter heading, and plate label per page. `story.json` gains three new optional fields: `chapter`, `plateLabel`, `illustrationTitle`.

**Tech Stack:** Vanilla ES modules, StPageFlip 2.0.7 (CDN), Tailwind CSS (CDN, `forms` + `container-queries` plugins), Google Fonts (Noto Serif / Newsreader / Work Sans / Material Symbols Outlined). No build step, no package manager, no test framework.

**Testing approach:** This project has no test infrastructure (no Jest, no Vitest, no Playwright config). Verification is manual: serve with `python -m http.server 8000`, load `http://localhost:8000`, and click through the checklist in Task 11. Each intermediate task notes what the engineer should see/not see if they load the page mid-flight. Do **not** introduce a test framework as part of this plan — YAGNI.

**Spec reference:** `docs/superpowers/specs/2026-04-07-stitch-redesign-design.md`

---

## File structure

**Files that will be modified (full rewrite unless noted):**

| Path | Responsibility after plan | Change |
|---|---|---|
| `index.html` | Tailwind-CDN shell: dark desk background, wood-frame book container holding StPageFlip mount, footer pill bar (prev/play/next/volume/speed), Google Fonts + Material Symbols, inline `<style>` for things Tailwind can't express | Full rewrite |
| `js/buildBook.js` | Render Stitch-styled illustration + text pages, drop-cap handling, blockquote auto-detection, ornate frame corners, rune icons. Still sole owner of StPageFlip. | Full rewrite |
| `js/BookController.js` | Flip orchestration, audio/timer advance, word-sync, Ken Burns, mobile hold — minus music, SFX, idle-hint, restart | Simplified |
| `js/UIController.js` | Wire prev/play/next/volume/speed only; play button swaps material icon and updates volume label | Full rewrite |
| `js/app.js` | Boot + populate `#story-title`; no MusicController/SfxController | Simplified |
| `js/loadStory.js` | Validate three new optional string fields | Two new checks |
| `story.json` | Add `chapter`, `plateLabel`, `illustrationTitle` to Otari page 1; remove `ambient` block | Schema + content |
| `ATTRIBUTIONS.md` | Remove SFX and music entries | Deletion |
| `CLAUDE.md` | Reflect new architecture (no music/SFX, Tailwind CDN, new schema fields) | Rewrite in place |

**Files that will be deleted:**
- `css/style.css`
- `js/MusicController.js`
- `js/SfxController.js`
- `assets/music/ambient.mp3` (and `assets/music/` directory)
- `assets/sfx/page-flip.mp3` (and `assets/sfx/` directory)
- `assets/` directory (will be empty after the two above)
- `audio/02.mp3` (orphaned — no page 2 in `story.json`)
- `design-refs/` (entire directory — legacy reference imagery)

**Files that stay untouched:**
- `js/AudioController.js`
- `js/KenBurns.js`
- `js/loadStory.js` core logic (only two-line addition to the validator)
- `images/cover.png`, `images/01.jpeg`, `images/README.md`
- `audio/01.mp3`
- `.gitignore`
- `README.md`
- `docs/superpowers/specs/*` (including the spec added for this redesign)
- `docs/superpowers/plans/*` (including this plan)
- `docs/plans/`, `docs/specs/` (legacy — out of scope)

---

## Phase A: Controller simplifications (old HTML still loads)

The goal of Phase A is to strip music/SFX/restart/idle-hint from the JS so the subsequent file deletions (Phase B) don't leave dangling imports or dead handlers. After each task in this phase the old HTML still loads; only removed features break.

### Task 1: Simplify `js/BookController.js`

**Files:**
- Modify: `js/BookController.js` (full file rewrite — ~130 lines shorter)

- [ ] **Step 1: Verify the current file is what you expect**

Run: `head -n 10 js/BookController.js`
Expected: first line is `// Orchestrates the book: audio/timer → advance full spread; flip → load new spread's`, imports `KenBurns` and helpers from `./buildBook.js`, declares `IDLE_HINT_DELAY_MS` and `MOBILE_ILLUSTRATION_HOLD_MS`.

- [ ] **Step 2: Replace the entire file contents with the simplified version below**

```js
// Orchestrates the book: audio/timer → advance full spread; flip → load new spread's
// audio, Ken Burns, and text reveal.

import { KenBurns } from './KenBurns.js';
import { findIllustrationImg, findTextPage, fitTextToPage } from './buildBook.js';

const MOBILE_ILLUSTRATION_HOLD_MS = 1500;

export class BookController {
  constructor({ story, pageFlip, audio, bookEl }) {
    this.story = story;
    this.pageFlip = pageFlip;
    this.audio = audio;
    this.bookEl = bookEl;
    this.isPlaying = false;
    this.onChange = null;
    this._timerId = null;

    this.audio.onEnded = () => {
      if (!this.isPlaying) return;
      this._advanceOrStop();
    };

    this.audio.onTimeUpdate = (t, d) => this._onAudioTime(t, d);

    this.pageFlip.on('flip', () => {
      this._clearTimer();
      this._stopKenBurnsAll();
      this._clearRevealAll();
      this._resetWordsForCurrent();
      this.audio.reset();
      this._loadCurrentPage();
      this._fitCurrentTextPage();
      this._applyKenBurnsForCurrent();
      if (this.isPlaying) {
        if (this._isPortraitMode() && this._isOnIllustrationPage()) {
          this._timerId = setTimeout(() => {
            this._timerId = null;
            if (this.isPlaying) this.pageFlip.flipNext();
          }, MOBILE_ILLUSTRATION_HOLD_MS);
        } else {
          this._revealTextForCurrent();
          this._playCurrentPage();
        }
      }
      if (this.onChange) this.onChange();
    });

    this._loadCurrentPage();
    this._applyKenBurnsForCurrent();

    this._fitAllTextPages = () => {
      this.story.pages.forEach((_, i) => {
        const el = findTextPage(this.bookEl, i);
        if (el) fitTextToPage(el);
      });
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(this._fitAllTextPages);
    } else {
      setTimeout(this._fitAllTextPages, 100);
    }
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this._fitAllTextPages(), 150);
    });
  }

  currentStoryPageIndex() {
    const bookIdx = this.pageFlip.getCurrentPageIndex();
    if (bookIdx < 1) return -1;
    const contentPages = this.story.pages.length * 2;
    if (bookIdx > contentPages) return -1;
    return (bookIdx - 1) >> 1;
  }

  _isPortraitMode() {
    return window.matchMedia('(max-width: 720px)').matches;
  }

  _isOnIllustrationPage() {
    const bookIdx = this.pageFlip.getCurrentPageIndex();
    const contentPages = this.story.pages.length * 2;
    return bookIdx >= 1 && bookIdx <= contentPages && (bookIdx % 2 === 1);
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
    this.pageFlip.flipNext();
    if (!this._isPortraitMode()) {
      const targetBookIdx = this.pageFlip.getCurrentPageIndex() + 1;
      setTimeout(() => this.pageFlip.flip(targetBookIdx), 50);
    }
  }

  _clearTimer() {
    if (this._timerId != null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

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

  _fitCurrentTextPage() {
    const idx = this.currentStoryPageIndex();
    const el = findTextPage(this.bookEl, idx);
    if (el) fitTextToPage(el);
  }

  _resetWordsForCurrent() {
    const idx = this.currentStoryPageIndex();
    const el = findTextPage(this.bookEl, idx);
    if (!el) return;
    el.querySelectorAll('.word.spoken').forEach(w => w.classList.remove('spoken'));
    const quill = el.querySelector('.quill');
    if (quill) quill.classList.remove('active');
    const bodyEl = el.querySelector('.page-body');
    if (bodyEl) bodyEl.scrollTop = 0;
  }

  _onAudioTime(currentTime, duration) {
    if (!duration || duration <= 0) return;
    const idx = this.currentStoryPageIndex();
    const el = findTextPage(this.bookEl, idx);
    if (!el) return;
    const words = el.querySelectorAll('.word');
    if (words.length === 0) return;
    const frac = Math.max(0, Math.min(1, currentTime / duration));
    const target = currentTime > 0.05 ? Math.min(words.length, Math.floor(frac * words.length) + 1) : 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (i < target) {
        if (!w.classList.contains('spoken')) w.classList.add('spoken');
      } else {
        if (w.classList.contains('spoken')) w.classList.remove('spoken');
      }
    }

    const bodyEl = el.querySelector('.page-body');
    const quill = el.querySelector('.quill');
    if (target === 0) {
      if (quill) quill.classList.remove('active');
      if (bodyEl) bodyEl.scrollTop = 0;
      return;
    }
    const lastSpoken = words[target - 1];
    if (!lastSpoken || !bodyEl) return;

    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    if (isMobile) {
      const wordTop = lastSpoken.offsetTop;
      const targetScroll = Math.max(0, wordTop - bodyEl.clientHeight * 0.35);
      if (Math.abs(bodyEl.scrollTop - targetScroll) > 4) {
        bodyEl.scrollTop = targetScroll;
      }
    }

    if (!quill) return;
    if (isMobile) { quill.classList.remove('active'); return; }
    quill.classList.add('active');
    const wordRect = lastSpoken.getBoundingClientRect();
    const bodyRect = bodyEl.getBoundingClientRect();
    const x = (wordRect.right - bodyRect.left) + bodyEl.offsetLeft;
    const y = (wordRect.top  - bodyRect.top)  + bodyEl.offsetTop;
    quill.style.left = `${x}px`;
    quill.style.top  = `${y}px`;
  }

  play() {
    this.isPlaying = true;
    // If on the cover, flip open to the first spread — the flip handler will
    // then auto-start the page's narration because isPlaying is true.
    if (this.pageFlip.getCurrentPageIndex() === 0) {
      this.pageFlip.flipNext();
      if (this.onChange) this.onChange();
      return;
    }
    this._revealTextForCurrent();
    this._playCurrentPage();
    if (this.onChange) this.onChange();
  }

  pause() {
    this.isPlaying = false;
    this._clearTimer();
    this.audio.pause();
    if (this.onChange) this.onChange();
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  next() { this.pageFlip.flipNext(); }
  prev() { this.pageFlip.flipPrev(); }

  get currentPageNumber() { return this.pageFlip.getCurrentPageIndex() + 1; }
  get totalPages() { return this.pageFlip.getPageCount(); }
}
```

Changes from the current file:
- Removed `music`, `sfx` constructor params.
- Removed `IDLE_HINT_DELAY_MS` constant, `_idleTimer`, `_lastHintedTextPage`, `_scheduleIdleHint()`, `_clearIdleHint()`, `_resetIdleHint()`.
- Removed `this.sfx.playFlip()` from the flip handler.
- Removed `this.music.start()` from `play()`.
- Removed `restart()` method (no UI button for it).
- Removed `jumpTo()` method (no page-jump dropdown).
- Renamed inner `target` → `targetScroll` in `_onAudioTime` to avoid shadowing the outer `target` variable.

- [ ] **Step 3: Manual sanity check — does the old site still load?**

In one terminal: `cd C:/Users/Brandon/pf2e-story && python -m http.server 8000`
In a browser: open `http://localhost:8000`

Expected:
- Book loads with the **old** parchment style (css/style.css still exists, index.html still old).
- Open DevTools Console. **Must not** see any errors from `BookController.js` (no `undefined is not a function`).
- Click ▶ — the book opens and narration plays. Words fade in. Ken Burns pans the image.
- Click the ⏮ restart button in the old footer — it **will** throw `this.book.restart is not a function` in the console. That's expected: we removed the method. Ignore for now; UIController gets rewritten in Task 2 which removes the restart wiring.
- Click 🎵 music button — harmless no-op (music still plays from old CSS shell — until Phase B).

Stop the server (Ctrl+C) when done.

- [ ] **Step 4: Commit**

```bash
git add js/BookController.js
git commit -m "$(cat <<'EOF'
refactor(BookController): drop music, SFX, idle-hint, restart, jumpTo

Simplify the orchestrator ahead of the Stitch frontend swap. Removed
features have no UI in the new design; cleaner to strip here before
deleting their source files in Phase B.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Rewrite `js/UIController.js`

**Files:**
- Modify: `js/UIController.js` (full file rewrite)

- [ ] **Step 1: Replace the entire file contents with the rewritten version below**

```js
// Wires DOM controls to BookController and AudioController.
// Uses defensive `if (el)` checks so the same controller works against both
// the legacy HTML (during the transition) and the new Stitch shell.

export class UIController {
  constructor({ book, audio }) {
    this.book = book;
    this.audio = audio;

    this.btnPrev     = document.getElementById('btn-prev');
    this.btnPlay     = document.getElementById('btn-play');
    this.btnPlayIcon = document.getElementById('btn-play-icon'); // new shell only
    this.btnNext     = document.getElementById('btn-next');
    this.volume      = document.getElementById('volume');
    this.volumeLabel = document.getElementById('volume-label');  // new shell only
    this.speed       = document.getElementById('speed');

    this._bindEvents();
    this._sync();

    this.book.onChange = () => this._sync();
  }

  _bindEvents() {
    if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.book.prev());
    if (this.btnNext) this.btnNext.addEventListener('click', () => this.book.next());
    if (this.btnPlay) this.btnPlay.addEventListener('click', () => this.book.toggle());

    if (this.volume) {
      this.volume.addEventListener('input', e => {
        const v = Number(e.target.value);
        this.audio.setVolume(v / 100);
        this._updateVolumeLabel(v);
        this._updateVolumeFill(v);
      });
    }

    if (this.speed) {
      this.speed.addEventListener('change', e => {
        this.audio.setRate(Number(e.target.value));
      });
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { this.book.prev(); }
      if (e.key === 'ArrowRight') { this.book.next(); }
      if (e.key === ' ')          { e.preventDefault(); this.book.toggle(); }
    });

    // Seed initial state from the DOM values
    if (this.volume) {
      const v = Number(this.volume.value);
      this.audio.setVolume(v / 100);
      this._updateVolumeLabel(v);
      this._updateVolumeFill(v);
    }
    if (this.speed) {
      this.audio.setRate(Number(this.speed.value));
    }
  }

  _updateVolumeLabel(v) {
    if (this.volumeLabel) this.volumeLabel.textContent = `${v}%`;
  }

  _updateVolumeFill(v) {
    // Drives the CSS gradient fill in the new Stitch slider styling.
    if (this.volume) this.volume.style.setProperty('--vol', `${v}%`);
  }

  _sync() {
    if (this.btnPlayIcon) {
      // New Stitch shell: swap the Material icon name.
      this.btnPlayIcon.textContent = this.book.isPlaying ? 'pause' : 'menu_book';
    } else if (this.btnPlay) {
      // Legacy shell fallback: the button itself has text content directly.
      this.btnPlay.textContent = this.book.isPlaying ? '\u23F8' : '\u25B6';
    }
  }
}
```

Changes from the current file:
- Removed `music` constructor param and all references.
- Removed `btnRestart`, `pageJump`, `pageTotal`, `btnMusic`, `musicWrap`, `musicVolume`.
- Removed `_populatePageJump()`.
- Added `btnPlayIcon` and `volumeLabel` lookups (null-safe — they don't exist in legacy HTML).
- Added `_updateVolumeLabel`, `_updateVolumeFill` helpers (fill drives a CSS var for the new slider styling).
- `_sync()` now swaps the material symbol inside `#btn-play-icon` when present, falling back to the legacy play/pause Unicode glyphs.

- [ ] **Step 2: Manual sanity check**

Start the server again: `python -m http.server 8000`
Open `http://localhost:8000`

Expected:
- Old HTML shell loads.
- No console errors on load.
- Click ▶ — narration plays; button flips to ⏸ and back. Word-sync and Ken Burns still work.
- Click ← → — page navigation works.
- Volume slider moves narration volume.
- Speed dropdown changes playback speed.
- Click ⏮ restart, 🎵 music, or the page-jump dropdown — these are **no longer wired**. Clicking them does nothing. That's expected.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add js/UIController.js
git commit -m "$(cat <<'EOF'
refactor(UIController): drop music/restart/page-jump, prep for Stitch shell

Slim UIController to the controls that will survive the Stitch
redesign: prev, play, next, volume, speed. Adds null-safe lookups for
#btn-play-icon and #volume-label so the same file works against both
the legacy HTML (during the transition) and the new Stitch shell.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Simplify `js/app.js`

**Files:**
- Modify: `js/app.js` (full file rewrite)

- [ ] **Step 1: Replace the entire file contents with the simplified version below**

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
      const titleEl = document.getElementById('story-title');
      if (titleEl) titleEl.textContent = story.title;
      document.title = story.title;

      const pageFlip = buildBook(story, bookEl);
      const audio = new AudioController(audioEl);
      const book = new BookController({ story, pageFlip, audio, bookEl });

      const prevOnMissing = audio.onMissing;
      audio.onMissing = () => {
        if (prevOnMissing) prevOnMissing();
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

Changes from the current file:
- Removed `import { MusicController } from './MusicController.js';`
- Removed `import { SfxController } from './SfxController.js';`
- Removed `const musicEl = document.getElementById('music');`
- Removed the `music = new MusicController({...})` and `sfx = new SfxController({...})` construction.
- Removed `music`, `sfx` from `new BookController({...})`.
- Removed `music` from `new UIController({...})`.
- Added `#story-title` population and `document.title = story.title` (null-safe — the legacy HTML has no `#story-title`).

- [ ] **Step 2: Manual sanity check**

`python -m http.server 8000` → open `http://localhost:8000`

Expected:
- Old HTML loads. No console errors.
- No music plays anywhere (even though `assets/music/ambient.mp3` still exists on disk — we just don't wire it).
- Page-flip sound effect no longer plays when flipping.
- Everything else (narration, word-sync, Ken Burns, nav, volume, speed) still works.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "$(cat <<'EOF'
refactor(app): drop MusicController and SfxController wiring

Removes the music + SFX subsystems from the boot sequence and adds
safe #story-title population for the upcoming Stitch shell. No
visible difference on the legacy HTML beyond losing page-flip SFX
and ambient music.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B: Delete orphaned files

Now that nothing imports the music/SFX modules or references their assets, delete the dead code and files.

### Task 4: Delete removed subsystem files and update `ATTRIBUTIONS.md`

**Files:**
- Delete: `js/MusicController.js`
- Delete: `js/SfxController.js`
- Delete: `css/style.css` — **NOT YET**, this happens in Task 5 alongside the new index.html
- Delete: `assets/music/ambient.mp3`
- Delete: `assets/music/` (directory)
- Delete: `assets/sfx/page-flip.mp3`
- Delete: `assets/sfx/` (directory)
- Delete: `assets/` (directory, will be empty)
- Delete: `audio/02.mp3`
- Delete: `design-refs/` (entire directory)
- Modify: `ATTRIBUTIONS.md`
- Modify: `story.json` (remove `ambient` block)

- [ ] **Step 1: Delete the orphaned files and directories**

```bash
cd C:/Users/Brandon/pf2e-story
rm js/MusicController.js
rm js/SfxController.js
rm assets/music/ambient.mp3
rm assets/sfx/page-flip.mp3
rmdir assets/music
rmdir assets/sfx
rmdir assets
rm audio/02.mp3
rm -rf design-refs
```

- [ ] **Step 2: Verify deletions**

```bash
ls js/ audio/ | cat
ls design-refs 2>/dev/null; ls assets 2>/dev/null || echo "assets gone"
```

Expected:
- `js/` contains `AudioController.js`, `BookController.js`, `KenBurns.js`, `UIController.js`, `app.js`, `buildBook.js`, `loadStory.js` — **and nothing else**.
- `audio/` contains only `01.mp3`.
- `design-refs` and `assets` are gone.

- [ ] **Step 3: Update `ATTRIBUTIONS.md`**

Replace the entire file contents with:

```markdown
# Third-Party Assets

## Fonts

- **Noto Serif**, **Newsreader**, **Work Sans** — loaded from Google Fonts, licensed under the SIL Open Font License (OFL).
- **Material Symbols Outlined** — loaded from Google Fonts, licensed under the Apache License 2.0.
```

Rationale: the SFX and music entries described files we just deleted. The old EB Garamond entry is gone because the new design uses Noto Serif / Newsreader / Work Sans instead.

- [ ] **Step 4: Remove the `ambient` block from `story.json`**

Current `story.json` contents (for reference — verify with `cat story.json` first):

```json
{
  "title": "Otari",
  "author": "Brandon Sams",
  "ambient": {
    "music": "assets/music/ambient.mp3",
    "volume": 0.2
  },
  "cover": {
    "image": "images/cover.png"
  },
  ...
}
```

Delete the `"ambient": { ... },` block. After the edit the top of the file should read:

```json
{
  "title": "Otari",
  "author": "Brandon Sams",
  "cover": {
    "image": "images/cover.png"
  },
  ...
}
```

Leave the rest of `story.json` untouched — we'll add new fields in Task 9.

- [ ] **Step 5: Manual sanity check**

`python -m http.server 8000` → open `http://localhost:8000`

Expected:
- Old HTML still loads (`css/style.css` is still present!).
- No console errors about missing modules or 404s for `ambient.mp3` / `page-flip.mp3`.
- Narration, flip, word-sync, Ken Burns all still work.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git status   # Verify only the expected files are staged
git commit -m "$(cat <<'EOF'
chore: delete MusicController, SfxController, and orphaned assets

Removes js/MusicController.js, js/SfxController.js, assets/music/,
assets/sfx/, assets/, audio/02.mp3 (orphaned), design-refs/, plus
story.json's ambient block and ATTRIBUTIONS.md entries for the
deleted audio files.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Note: `git add -A` is acceptable here because you have already verified via `git status` that only intended files are staged. If unexpected files appear, stage selectively instead.

---

## Phase C: Frontend swap (atomic UI rewrite)

This phase replaces `index.html`, deletes `css/style.css`, and rewrites `js/buildBook.js` in a single commit so the site never exists in a half-styled intermediate state.

### Task 5: Replace `index.html`, delete `css/style.css`, rewrite `js/buildBook.js`

**Files:**
- Overwrite: `index.html`
- Delete: `css/style.css`
- Delete: `css/` (directory, will be empty)
- Overwrite: `js/buildBook.js`

This is a large task because the UI changes are intrinsically atomic. Break it into sub-steps but commit once at the end.

- [ ] **Step 1: Overwrite `index.html` with the new Stitch-derived shell**

Full contents:

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
          borderRadius: {
            DEFAULT: "0.25rem",
            lg: "0.5rem",
            xl: "0.75rem",
            full: "9999px"
          },
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
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }

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

    /* Ken Burns keyframes — must match the names that KenBurns.js writes as inline animation */
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

    /* Word-sync highlighting — unspoken words sit faint, spoken words brighten */
    .page-text-page .word {
      opacity: 0.35;
      transition: opacity 280ms ease-out;
    }
    .page-text-page .word.spoken { opacity: 1; }
    .page-text-page:not(.reveal) .word { opacity: 1; }

    /* Reveal animation when the text page first appears */
    .page-text-page.reveal .page-body {
      animation: text-fade-in 800ms ease-out;
    }
    @keyframes text-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Quill cursor — tracks the last-spoken word on desktop */
    .page-text-page .quill {
      position: absolute;
      font-size: 24px;
      pointer-events: none;
      opacity: 0;
      transform: translate(-2px, -18px) rotate(-15deg);
      transition: left 220ms ease-out, top 220ms ease-out, opacity 220ms;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25));
    }
    .page-text-page .quill.active {
      opacity: 1;
      animation: quill-bob 700ms ease-in-out infinite;
    }
    @keyframes quill-bob {
      0%, 100% { transform: translate(-2px, -18px) rotate(-15deg); }
      50%      { transform: translate(-2px, -22px) rotate(-18deg); }
    }

    /* Voice slider — styled to match Stitch's gradient track + glowing thumb */
    input[type="range"]#volume {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      background: linear-gradient(to right, #ffb782 var(--vol, 100%), #32353a var(--vol, 100%));
      border-radius: 9999px;
      outline: none;
      cursor: pointer;
      margin: 0;
    }
    input[type="range"]#volume::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 9999px;
      background: #ffb782;
      border: 2px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 15px rgba(255, 183, 130, 0.8);
      cursor: pointer;
    }
    input[type="range"]#volume::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 9999px;
      background: #ffb782;
      border: 2px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 15px rgba(255, 183, 130, 0.8);
      cursor: pointer;
    }

    /* Error screen + toast (carried over from the old stylesheet) */
    .error-screen {
      color: #f0e4c9;
      background: #3a1a10;
      border: 1px solid #7a3a1f;
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      text-align: center;
      margin: auto;
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

    /* Mobile adjustments */
    @media (max-width: 720px) {
      .book-outer-frame { --tw-ring-offset-width: 0; }
      /* Make the text body scrollable on mobile so word-sync auto-scroll can track
         the currently-spoken word; override the JS-set font size with a readable default. */
      .page-text-page .page-body {
        overflow-y: auto !important;
        font-size: 16px !important;
        scroll-behavior: smooth;
        scrollbar-width: none;
      }
      .page-text-page .page-body::-webkit-scrollbar { display: none; }
    }
  </style>
</head>
<body class="bg-background text-on-surface font-body selection:bg-primary/30 min-h-screen flex flex-col overflow-hidden desk-bg">

  <!-- Top app bar -->
  <header class="bg-[#101418] flex justify-between items-center w-full px-8 py-4 z-50 shadow-2xl shadow-black/60 sticky top-0">
    <h1 id="story-title" class="font-['Noto_Serif'] font-bold tracking-tight text-2xl md:text-3xl text-[#ffb782] drop-shadow-sm"></h1>
  </header>

  <!-- Main book area -->
  <main class="flex-grow flex items-center justify-center p-4 md:p-8 lg:p-12 relative">
    <!-- Floating dust/motes decoration -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
      <div class="absolute top-1/4 left-1/4 w-1 h-1 bg-primary rounded-full blur-[1px]"></div>
      <div class="absolute top-3/4 left-1/3 w-1.5 h-1.5 bg-secondary rounded-full blur-[2px]"></div>
      <div class="absolute top-1/2 right-1/4 w-1 h-1 bg-primary rounded-full blur-[1px]"></div>
    </div>
    <!-- Dark wood book frame (decorative; StPageFlip mounts inside) -->
    <div class="book-outer-frame relative w-full max-w-6xl aspect-[16/10] bg-[#2d1b0e] rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] p-2 md:p-4 ring-2 md:ring-8 ring-[#1a0f08] overflow-hidden">
      <div id="book" class="w-full h-full"></div>
    </div>
  </main>

  <!-- Footer control bar -->
  <footer class="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 md:px-12 pb-6 md:pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
    <div class="flex flex-wrap justify-center items-center gap-6 md:gap-12 bg-[#1b1f23]/90 backdrop-blur-xl px-6 md:px-12 py-3 md:py-4 rounded-3xl md:rounded-full shadow-2xl border border-white/5">
      <!-- Navigation -->
      <div class="flex gap-4 items-center">
        <button id="btn-prev" class="flex flex-col items-center justify-center text-[#b5c8e4]/40 p-3 md:p-4 hover:text-[#ffb782] hover:scale-110 transition-transform active:brightness-125">
          <span class="material-symbols-outlined text-2xl mb-1">arrow_back_ios</span>
          <span class="font-['Work_Sans'] text-[10px] uppercase tracking-widest">Previous</span>
        </button>
        <button id="btn-play" class="flex flex-col items-center justify-center bg-[#d87821]/20 text-[#ffb782] rounded-full px-5 md:px-6 py-3 md:py-4 ring-1 ring-[#ffb782]/30 hover:glow-sm transition-all active:brightness-125">
          <span id="btn-play-icon" class="material-symbols-outlined text-3xl mb-1" style="font-variation-settings: 'FILL' 1;">menu_book</span>
          <span class="font-['Work_Sans'] text-[10px] uppercase tracking-widest">Chronicle</span>
        </button>
        <button id="btn-next" class="flex flex-col items-center justify-center text-[#b5c8e4]/40 p-3 md:p-4 hover:text-[#ffb782] hover:scale-110 transition-transform active:brightness-125">
          <span class="material-symbols-outlined text-2xl mb-1">arrow_forward_ios</span>
          <span class="font-['Work_Sans'] text-[10px] uppercase tracking-widest">Next</span>
        </button>
      </div>

      <!-- Voice slider + speed dropdown -->
      <div class="flex items-center gap-4 md:gap-6 md:border-l md:border-white/10 md:pl-12">
        <div class="flex flex-col gap-2 w-40 md:w-48">
          <div class="flex justify-between items-center mb-1">
            <label for="volume" class="font-label text-[10px] uppercase tracking-widest text-[#b5c8e4]/60">Voice Resonance</label>
            <span id="volume-label" class="text-primary text-[10px] font-bold">100%</span>
          </div>
          <input id="volume" type="range" min="0" max="100" value="100"/>
        </div>
        <div class="relative">
          <select id="speed" class="bg-surface-container-high hover:bg-surface-bright px-3 md:px-4 py-2 rounded-xl border border-white/5 font-label text-xs uppercase tracking-widest text-on-surface appearance-none cursor-pointer">
            <option value="0.8">Slow</option>
            <option value="1" selected>Normal</option>
            <option value="1.2">Swift</option>
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

- [ ] **Step 2: Delete `css/style.css` and the now-empty `css/` directory**

```bash
rm css/style.css
rmdir css
```

- [ ] **Step 3: Overwrite `js/buildBook.js` with the Stitch-styled page renderer**

Full contents:

```js
// Builds the book DOM from a story object and initializes StPageFlip.
// Each story page becomes TWO book pages: an illustration page and a text page.
// This is the ONLY module that touches StPageFlip — isolates the library.

export function buildBook(story, containerEl) {
  containerEl.innerHTML = '';

  // Front cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover page-cover-front parchment-texture relative',
    image: story.cover.image,
    title: story.title,
  }));

  // Content: for each story page, render an illustration page then a text page.
  story.pages.forEach((p, i) => {
    containerEl.appendChild(renderIllustrationPage({
      image: p.image,
      storyIndex: i,
      plateLabel: p.plateLabel,
      illustrationTitle: p.illustrationTitle,
    }));
    containerEl.appendChild(renderTextPage({
      text: p.text,
      chapter: p.chapter,
      storyTitle: story.title,
      pageNumber: i + 1,
      storyIndex: i,
    }));
  });

  // Back cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover page-cover-back parchment-texture relative',
    image: story.backCover.image,
    title: 'The End',
  }));

  const pageFlip = new window.St.PageFlip(containerEl, {
    width: 500,
    height: 640,
    size: 'stretch',
    minWidth: 280,
    maxWidth: 900,
    minHeight: 360,
    maxHeight: 1152,
    maxShadowOpacity: 0.75,
    flippingTime: 1200,
    showCover: true,
    // omit usePortrait so StPageFlip auto-switches to single-page on narrow viewports
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

// Fits body text to the available page height by binary-searching font size.
// Call after the page is in the DOM and fonts are loaded.
export function fitTextToPage(textPageEl, maxPx = 22, minPx = 10) {
  if (!textPageEl) return;
  const body = textPageEl.querySelector('.page-body');
  if (!body) return;
  let lo = minPx, hi = maxPx, best = minPx;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    body.style.fontSize = mid + 'px';
    if (body.scrollHeight <= body.clientHeight + 1) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  body.style.fontSize = best + 'px';
}

// ---------- internal helpers ----------

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeText(s).replace(/"/g, '&quot;');
}

function renderCoverPage({ className, image, title }) {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = `
    <div class="absolute inset-6 border-[12px] border-double border-[#d87821]/40 rounded-sm pointer-events-none"></div>
    <div class="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="relative w-full h-full flex flex-col items-center justify-center p-12">
      <img class="page-image w-full max-h-[70%] object-cover grayscale-[0.2] sepia-[0.2] rounded-sm shadow-inner" src="${escapeAttr(image)}" alt=""/>
      ${title ? `<h1 class="font-headline text-5xl text-[#301400] italic mt-8 text-center drop-shadow-sm">${escapeText(title)}</h1>` : ''}
    </div>
  `;
  const img = el.querySelector('img.page-image');
  if (img) img.onerror = () => { img.style.display = 'none'; };
  return el;
}

function renderIllustrationPage({ image, storyIndex, plateLabel, illustrationTitle }) {
  const el = document.createElement('div');
  el.className = 'page page-illustration parchment-texture relative flex items-center justify-center p-8 overflow-visible';
  el.dataset.storyIndex = String(storyIndex);
  el.innerHTML = `
    <div class="absolute inset-6 border-[12px] border-double border-[#d87821]/40 rounded-sm pointer-events-none"></div>
    <div class="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="relative w-full h-full rounded-sm overflow-hidden shadow-inner">
      <img class="page-image w-full h-full object-cover grayscale-[0.2] sepia-[0.2]" src="${escapeAttr(image)}" alt=""/>
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
      ${(plateLabel || illustrationTitle) ? `
      <div class="absolute bottom-6 left-6 right-6 pointer-events-none">
        ${plateLabel ? `<span class="font-label text-[10px] tracking-[0.3em] uppercase text-[#ffb782]/80 mb-1 block">Plate ${escapeText(plateLabel)}</span>` : ''}
        ${illustrationTitle ? `<h3 class="font-headline text-xl text-white italic drop-shadow-md">${escapeText(illustrationTitle)}</h3>` : ''}
      </div>` : ''}
    </div>
    <div class="absolute top-8 left-8 text-black/10 select-none pointer-events-none">
      <span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
    </div>
  `;
  const img = el.querySelector('img.page-image');
  if (img) img.onerror = () => { img.style.display = 'none'; };
  return el;
}

const OPENING_QUOTE = /^[\u201C"']/;
const CLOSING_QUOTE = /[\u201D"']$/;

function renderTextPage({ text, chapter, storyTitle, pageNumber, storyIndex }) {
  const el = document.createElement('div');
  el.className = 'page page-text-page parchment-texture relative p-10 md:p-16 flex flex-col overflow-hidden custom-scrollbar';
  el.dataset.storyIndex = String(storyIndex);

  // Chapter header
  if (chapter) {
    const header = document.createElement('div');
    header.className = 'mb-6 relative z-10';
    header.innerHTML = `
      <h2 class="font-headline text-3xl md:text-4xl text-[#301400] leading-tight mb-2">${escapeText(chapter)}</h2>
      <div class="h-px w-24 bg-[#d87821]/40"></div>
    `;
    el.appendChild(header);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'page-body flex-1 max-w-none text-[#3d2313] font-body leading-relaxed text-justify overflow-hidden relative z-10';

  const paragraphs = (text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('');

  let globalWordIndex = 0;
  paragraphs.forEach((chunk, pi) => {
    const trimmed = chunk.trim();
    const isBlockquote = OPENING_QUOTE.test(trimmed) && CLOSING_QUOTE.test(trimmed);
    const p = document.createElement('p');
    p.className = isBlockquote
      ? 'italic opacity-80 border-l-2 border-[#d87821]/30 pl-4 py-2 my-6'
      : 'mb-4 relative';

    // Drop-cap: first character of the first non-blockquote paragraph of the page.
    let remaining = chunk;
    if (pi === 0 && !isBlockquote && chunk.length > 0) {
      const firstChar = chunk[0];
      const dropCap = document.createElement('span');
      dropCap.className = 'drop-cap float-left text-7xl font-headline text-[#d87821] mr-3 mt-2 mb-[-0.5rem] leading-[1] drop-shadow-sm select-none';
      dropCap.textContent = firstChar;
      p.appendChild(dropCap);
      remaining = chunk.slice(1);
    }

    const words = remaining.split(/\s+/).filter(Boolean);
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

  // Quill cursor — follows the current spoken word while audio plays.
  const quill = document.createElement('div');
  quill.className = 'quill';
  quill.textContent = '\u{1F58B}'; // fountain pen
  el.appendChild(quill);

  // Page footer
  const footer = document.createElement('div');
  footer.className = 'mt-auto pt-6 flex justify-center border-t border-black/5 relative z-10';
  footer.innerHTML = `<span class="font-label text-[10px] tracking-widest text-[#3d2313]/60 uppercase">Page ${pageNumber} — ${escapeText(storyTitle)}</span>`;
  el.appendChild(footer);

  // Rune corner decoration
  const rune = document.createElement('div');
  rune.className = 'absolute bottom-8 right-8 text-black/10 select-none pointer-events-none';
  rune.innerHTML = `<span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">storm</span>`;
  el.appendChild(rune);

  return el;
}
```

Key properties of the new `buildBook.js`:
- `findIllustrationImg`, `findTextPage`, `fitTextToPage` signatures are unchanged — `BookController` still works.
- `.page-illustration`, `.page-text-page`, `.page-image`, `.page-body`, `.word`, `.quill`, `data-story-index` contracts are preserved.
- Parchment background via the `.parchment-texture` class defined in the inline `<style>` block.
- Ornate frame corners and double-border are positioned absolutely inside each page.
- The drop-cap is a separate `<span class="drop-cap">` rendered before any `.word` span. The word-sync algorithm only operates on `.word` spans, so the drop-cap never gets `.spoken` — it stays visually prominent throughout playback.
- Blockquote detection: paragraphs whose trimmed text both starts and ends with `"`, `'`, `\u201C`, or `\u201D` get an italic blockquote style instead of the normal paragraph style. They also skip the drop-cap.
- `renderTextPage` receives `storyTitle` rather than the whole `story` object — cleaner parameter boundary.
- `escapeText` / `escapeAttr` helpers defined at the bottom of the file.

- [ ] **Step 4: Manual sanity check — site should now fully match the Stitch design**

`python -m http.server 8000` → open `http://localhost:8000`

Expected:
- Dark wooden desk background visible. Book container has the ring-8 dark wood frame.
- Top bar shows "Otari" in Noto Serif orange.
- Footer pill bar shows prev / Chronicle (menu_book icon) / next, Voice Resonance slider at 100%, speed dropdown at Normal.
- Cover page shows with parchment background, image, and "Otari" title in serif.
- Click the Chronicle button — book flips open to the first spread. Page 1 illustration appears with ornate frame. Narration starts. Word-sync highlights words on the text page.
- Click next → flips to back cover.
- Click prev → flips back.
- Volume slider — drag it; label updates to percentage; slider fill tracks drag position.
- Speed dropdown — Slow/Normal/Swift changes narration rate.
- **No console errors.**

If the drop-cap looks wrong (e.g., the first word is missing its starting letter), verify that `renderTextPage` is splitting correctly — the first `.word` span should contain the rest of the first word (e.g. `n` from "In"), and the drop-cap span contains only the first character (`I`).

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git status   # Verify: index.html modified, css/ gone, js/buildBook.js modified
git commit -m "$(cat <<'EOF'
feat(ui): Stitch parchment redesign — replace shell, delete css, rewrite buildBook

Replaces index.html with the Tailwind-CDN shell derived from the
Google Stitch "Storybook Reader (Single Tonee Parchment)" mockup:
dark wood book frame on a desk background, parchment pages with
ornate frame and drop-cap, pill-shaped footer control bar, Noto Serif
headline / Newsreader body / Work Sans label typography.

Rewrites buildBook.js to emit the new page DOM while preserving the
contracts BookController and KenBurns depend on (.page-illustration,
.page-text-page, .page-image, .page-body, .word, .quill, and the
data-story-index attribute).

Deletes css/style.css — all still-needed rules (Ken Burns keyframes,
word-sync, error/toast, custom slider) moved into an inline <style>
block in the new index.html.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase D: Schema + content + docs

### Task 6: Extend `js/loadStory.js` validator

**Files:**
- Modify: `js/loadStory.js` (add three type checks)

- [ ] **Step 1: Add the new field validations**

Current validator loops over `story.pages` and checks `image`. Add a block after that loop that validates the three new optional fields. Insert the new checks inside the existing `story.pages.forEach` callback, right after the `if (!p.image) throw ...` line.

Open `js/loadStory.js` and replace the current `validate` function with:

```js
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
    if (p.chapter !== undefined && typeof p.chapter !== 'string') {
      throw new Error(`Page ${i + 1} "chapter" must be a string if present`);
    }
    if (p.plateLabel !== undefined && typeof p.plateLabel !== 'string') {
      throw new Error(`Page ${i + 1} "plateLabel" must be a string if present`);
    }
    if (p.illustrationTitle !== undefined && typeof p.illustrationTitle !== 'string') {
      throw new Error(`Page ${i + 1} "illustrationTitle" must be a string if present`);
    }
  });
}
```

Also remove the `ambient` validation block from this function (the `ambient` key no longer exists after Task 4):

Delete these lines if they are still present in the file:
```js
  if (story.ambient !== undefined && story.ambient !== null) {
    if (typeof story.ambient !== 'object') {
      throw new Error('story.ambient must be an object if present');
    }
    if (story.ambient.music !== undefined && typeof story.ambient.music !== 'string') {
      throw new Error('story.ambient.music must be a string if present');
    }
  }
```

- [ ] **Step 2: Manual sanity check**

`python -m http.server 8000` → open `http://localhost:8000`

Expected:
- Site loads; Otari page 1 renders with no chapter heading yet (the field is still absent from `story.json` — that's fine, they're optional).
- No console errors.

- [ ] **Step 3: Commit**

```bash
git add js/loadStory.js
git commit -m "$(cat <<'EOF'
feat(loadStory): validate chapter/plateLabel/illustrationTitle; drop ambient

Adds optional type checks for the three new per-page fields that the
Stitch redesign renders. Drops the ambient.music validation block
because the ambient feature has been removed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Backfill Otari content with new fields

**Files:**
- Modify: `story.json`

- [ ] **Step 1: Insert the three new fields with an exact Edit**

Do NOT rewrite the whole file — the `text` field contains a large multi-paragraph body that must remain untouched. Use a single `Edit` tool call that targets the `"audio"` line and appends the three new fields right after it.

Edit `story.json`:

`old_string`:
```
      "audio": "audio/01.mp3",
```

`new_string`:
```
      "audio": "audio/01.mp3",
      "chapter": "Chapter I: A Working Town",
      "plateLabel": "I",
      "illustrationTitle": "The Town of Otari",
```

After the edit, `story.json` page 1 should have this field order: `image`, `audio`, `chapter`, `plateLabel`, `illustrationTitle`, `text`, `kenBurns`. The `text` body and all other fields remain unchanged. Validate by running `python -c "import json; json.load(open('story.json'))"` — it should print nothing (no error) if the JSON is still valid.

- [ ] **Step 2: Manual sanity check**

`python -m http.server 8000` → open `http://localhost:8000`

Expected:
- Cover loads. Click Chronicle.
- Page 1 illustration shows **"Plate I"** in the bottom-left eyebrow and **"The Town of Otari"** as the illustration title overlay.
- Page 1 text page shows **"Chapter I: A Working Town"** as the heading above the body text.
- The body text first letter ("I" from "In a world...") renders as a large orange drop-cap.
- Subsequent paragraphs render without drop-caps.
- The page footer shows "Page 1 — Otari".
- Narration still plays; word-sync still highlights.

- [ ] **Step 3: Commit**

```bash
git add story.json
git commit -m "$(cat <<'EOF'
content(otari): add chapter, plateLabel, illustrationTitle to page 1

Populates the three new Stitch-only fields so page 1 shows the
chapter heading, plate eyebrow, and illustration title overlay.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Update `CLAUDE.md` to reflect the new architecture

**Files:**
- Modify: `CLAUDE.md` (in place edits)

- [ ] **Step 1: Update the module responsibilities table**

The current `CLAUDE.md` has a module table listing `MusicController.js` and `SfxController.js`. Use the Edit tool to remove those two rows. Also update the `buildBook.js` description to mention Tailwind classes and drop-cap, and update `BookController.js` to note music/sfx/idle-hint/restart are gone.

Replace the existing table with:

```markdown
| Module | Responsibility |
|---|---|
| `js/app.js` | Entry point. Wires controllers, populates `#story-title`, handles top-level error/toast UI. |
| `js/loadStory.js` | Fetches `story.json` and validates required shape (including optional `chapter`, `plateLabel`, `illustrationTitle` per page). Throws descriptive errors. |
| `js/buildBook.js` | Builds page DOM with Stitch Tailwind classes (parchment, ornate frame, drop-cap, blockquote detection), instantiates StPageFlip, exports DOM-lookup helpers and `fitTextToPage`. **Sole owner of StPageFlip**. |
| `js/BookController.js` | Orchestrator: play/pause state, audio↔flip coordination, Ken Burns, word-sync, mobile illustration-hold auto-flip. |
| `js/AudioController.js` | Wraps the narration `<audio>` element. Emits `onEnded` and `onTimeUpdate`. |
| `js/KenBurns.js` | Sets inline `animation` from a small whitelist; the actual `@keyframes` (`kb-zoom-in-center`, etc.) live in the inline `<style>` block in `index.html`. Adding a mode requires updating both. |
| `js/UIController.js` | DOM ↔ controller wiring for prev/play/next/volume/speed. Listens for keyboard shortcuts (`←` `→` `Space`). Updates the `#btn-play-icon` Material Symbol to reflect play/pause state. |
```

- [ ] **Step 2: Update the "Running the site" section**

Find the "Running the site" section. It currently mentions `css/style.css` and StPageFlip CDN. Update to mention Tailwind CDN and the inline `<style>` block.

Replace the existing "Running the site" paragraph with:

```markdown
## Running the site

Pure static site, no build step, no dependencies to install. Because the app uses `fetch('story.json')`, opening `index.html` via `file://` will fail — you must serve over HTTP:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

There are no tests, no linter, and no package manager. All JS is loaded as ES modules from `js/`. StPageFlip and Tailwind CSS are pulled from CDNs at runtime (see `<head>` in `index.html`). There is no separate CSS file — all styling is either inline Tailwind classes or the `<style>` block at the top of `index.html`.
```

- [ ] **Step 3: Update the "Editing content" section**

The current section documents the old `story.json` schema. Find that section and update it to include the three new optional fields. Replace the existing "Editing content" section with:

```markdown
## Editing content

All content lives in `story.json` at the repo root. The schema is enforced by `loadStory.js` — required fields are `title`, `cover.image`, `backCover.image`, and a non-empty `pages` array where each page has at least `image`. Optional per-page fields:

- `text` — body copy. Paragraphs split on blank lines. The first character of the first non-blockquote paragraph becomes a decorative drop-cap.
- `audio` — narration MP3 path. When present, the page auto-advances on the audio's `ended` event.
- `durationMs` — fallback timer (milliseconds) used only if `audio` is missing.
- `kenBurns` — one of `zoom-in-center`, `zoom-in-left`, `zoom-in-right`, `zoom-out`, `pan-left`, `pan-right`, `none`.
- `chapter` — chapter heading rendered above the body text (e.g., `"Chapter I: A Working Town"`).
- `plateLabel` — illustration page eyebrow, rendered as `Plate {plateLabel}` (supply just the label — e.g., `"I"`, `"IV"`).
- `illustrationTitle` — heading displayed at the bottom of the illustration page.

Paragraphs whose trimmed text both starts and ends with a straight or smart double-quote (`"..."` or `"..."`) are auto-styled as italic blockquotes and skip the drop-cap.

Asset folders: `images/` (page illustrations + covers), `audio/` (narration MP3s). Third-party asset attributions are tracked in `ATTRIBUTIONS.md` — update it when adding any new external asset.
```

- [ ] **Step 4: Update the "Auto-advance state machine" section**

Find the "Auto-advance state machine" subheading. The current text references SFX ducking and music. Update to remove those. Replace the entire "Auto-advance state machine" section with:

```markdown
### Auto-advance state machine

`BookController` advances pages in two ways, and the priority matters:

1. If the current page has `audio`, it plays and advances on the audio's `ended` event.
2. Else if `durationMs` is set, it advances after a `setTimeout`.
3. Else it pauses (the user must click Next).

Audio always wins over `durationMs` — see `_playCurrentPage()`. Both paths funnel through `_advanceOrStop()`, which on **desktop spread mode** issues a *second* flip 50 ms later so a full spread advances at once. On **mobile portrait mode** (`max-width: 720px`), `_advanceOrStop` only flips once, and the flip handler then waits `MOBILE_ILLUSTRATION_HOLD_MS` (1500ms) on the illustration page before auto-flipping to the text page. Don't break this asymmetry without testing both layouts.
```

- [ ] **Step 5: Remove any lingering references to music, SFX, or `ATTRIBUTIONS.md` update instructions that mention SFX**

Search for "music", "SFX", "Sfx", "MusicController", "SfxController", "idle hint", "idle-hint", "corner-lift" in `CLAUDE.md`. Remove any remaining references. The `ATTRIBUTIONS.md` reference in the "Editing content" section should stay, but make sure it doesn't enumerate specific SFX/music attributions.

- [ ] **Step 6: Manual check — confirm the doc still makes sense end-to-end**

Read `CLAUDE.md` top to bottom. It should describe the project as it exists after Tasks 1-7: Stitch Tailwind shell, no music/SFX, new schema fields.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(CLAUDE): refresh for Stitch redesign — drop music/SFX, add new fields

Updates CLAUDE.md to reflect the Stitch Tailwind shell: new module
table, running-the-site instructions, story.json schema extensions,
and a cleaned-up auto-advance section with no music/SFX references.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase E: Final verification

### Task 9: End-to-end manual verification checklist

**Files:** None modified.

- [ ] **Step 1: Start a clean server**

```bash
cd C:/Users/Brandon/pf2e-story
python -m http.server 8000
```

- [ ] **Step 2: Open `http://localhost:8000` and walk the checklist**

**Visual fidelity (desktop, 1280+ wide):**

- [ ] Dark radial "desk" background fills the viewport (warm brown in the center fading to near-black at edges).
- [ ] Three tiny floating dust/mote dots are visible in the main area.
- [ ] Book container is centered with a dark-wood `bg-[#2d1b0e]` frame and an 8-ring outer border in `#1a0f08`.
- [ ] Top bar shows "Otari" on the left in orange Noto Serif, on a `#101418` background.
- [ ] Footer pill bar sits at the bottom with dark semi-transparent background, containing: Previous / Chronicle (filled menu_book icon) / Next / Voice Resonance slider (showing 100%) / speed dropdown (showing Normal).
- [ ] No "Restart" button, no music icon, no page-jump dropdown, no Library/Bookmarks nav links, no decorative volume_up/auto_stories/settings icons in the top bar.

**Cover page:**

- [ ] Front cover shows the parchment texture with the ornate double-border frame and gold corner accents.
- [ ] `images/cover.png` is rendered inside the frame.
- [ ] "Otari" title appears in italic Noto Serif beneath the image.

**Play from cover:**

- [ ] Click the Chronicle button. Book flips open to the first spread (page 1 illustration on the left, text page on the right).
- [ ] On flip, the material icon inside Chronicle swaps from `menu_book` to `pause`.
- [ ] Narration (`audio/01.mp3`) starts playing.
- [ ] The page 1 illustration image is visible inside the ornate frame. Top-left corner shows the `auto_awesome` rune at low opacity.
- [ ] Bottom-left of the illustration shows "PLATE I" eyebrow and "The Town of Otari" heading in italic.
- [ ] The text page shows "Chapter I: A Working Town" as a large Noto Serif heading above a thin gold rule.
- [ ] Body text uses Newsreader. The first character "I" is a huge orange drop-cap floated left.
- [ ] As narration plays, word-sync highlighting fades words in sequence. The quill cursor (🖋) appears and tracks the last-spoken word on desktop.
- [ ] Ken Burns slowly zooms the illustration image (`zoom-in-center`).
- [ ] Bottom-right of the text page shows the `storm` rune at low opacity.
- [ ] Footer of the text page shows "Page 1 — Otari" in Work Sans small caps.

**Navigation:**

- [ ] Click Next — book flips to the back cover (since only 1 story page exists). Pause icon reverts to menu_book because narration ended.
- [ ] Click Previous — book flips back to page 1.
- [ ] Press `←` / `→` — keyboard navigation also works.
- [ ] Press `Space` — play/pause toggles.

**Controls:**

- [ ] Drag the Voice Resonance slider — label updates from "100%" to new value; narration volume changes; the orange fill portion of the slider track tracks the thumb.
- [ ] Change the speed dropdown to Slow — narration playback slows down.
- [ ] Change to Swift — narration plays faster.
- [ ] Reset to Normal.

**Console:**

- [ ] Open DevTools Console. No red errors. Warnings about font-display or third-party cookies are fine.

**Mobile (resize DevTools device emulation to 400px wide):**

- [ ] Book container shrinks; ring-8 becomes ring-2; overall layout stays intact.
- [ ] Footer pill bar wraps: nav buttons + voice slider + speed dropdown stack into 2 rows.
- [ ] Click Chronicle from the cover. The book flips to the illustration page first.
- [ ] After ~1.5 seconds, the book auto-flips to the text page (mobile illustration-hold behavior).
- [ ] Text page auto-scrolls to keep the currently-spoken word in view.
- [ ] No quill cursor on mobile (it's hidden by the mobile scroll behavior).

**Top-level story title:**

- [ ] Browser tab title is "Otari".
- [ ] Page title in the top bar is "Otari".

- [ ] **Step 3: If anything in the checklist fails, stop and fix before proceeding**

Any failure is a blocker. Diagnose (check console, re-read the relevant Task's code, compare against the spec at `docs/superpowers/specs/2026-04-07-stitch-redesign-design.md`) and commit a fix.

- [ ] **Step 4: Stop the server (Ctrl+C)**

- [ ] **Step 5: Final commit only if any fixes were needed above**

If the checklist passed without any fixes, there is nothing to commit — skip this step. Do not create an empty commit.

If fixes were needed, stage them and commit:

```bash
git status
git add <fixed files>
git commit -m "fix(stitch): <specific issue and fix> ..."
```

- [ ] **Step 6: Summarize the final state**

At the end of Task 9, the repo should have:
- 9 new commits on `main` since the spec commit (Tasks 1 through 8, plus any fixes from Task 9).
- `css/`, `assets/`, `design-refs/`, `js/MusicController.js`, `js/SfxController.js`, `audio/02.mp3` all gone.
- `index.html`, `js/buildBook.js`, `js/BookController.js`, `js/UIController.js`, `js/app.js`, `js/loadStory.js`, `story.json`, `ATTRIBUTIONS.md`, `CLAUDE.md` all updated.
- The site visually matches the Stitch "Storybook Reader (Single Tonee Parchment)" mockup while preserving the narration engine.
