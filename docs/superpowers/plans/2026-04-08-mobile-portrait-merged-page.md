# Mobile portrait merged-page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slideshow-style portrait phone experience (illustration page → 1.5s hold → text page) with a single merged page (image fixed at top, text scrolling beneath), and add a one-time top-toast hint suggesting landscape rotation for the full spread.

**Architecture:** `js/buildBook.js` gains a `layout: 'spread' | 'portrait'` parameter and a new `renderMergedPage` helper. `js/BookController.js` chooses the layout from a `(orientation: portrait) and (max-width: 720px)` media query and rebuilds the StPageFlip instance via `pageFlip.destroy()` + `buildBook(...)` on orientation change. A new `js/RotateHint.js` module installs a quiet top toast on the first portrait load. Desktop spread is unchanged.

**Tech Stack:** Vanilla ES modules, StPageFlip 2.0.7 (CDN), Tailwind Play CDN. No build step, no test framework — verification is browser-based via Playwright MCP and manual smoke checks.

**Spec:** `docs/superpowers/specs/2026-04-08-mobile-portrait-merged-page-design.md`

**Verification model:** This codebase has no unit test framework. Each task lists explicit browser-based verification steps using the Playwright MCP server (`mcp__plugin_playwright_playwright__*` tools). The dev server is started once at the top of execution: `python -m http.server 8000`. The site lives at `http://localhost:8000`.

**Convention for the executing engineer:** This plan touches a small number of files in many small steps. To keep diffs reviewable, commit at the end of each task with the message format shown in the Commit step.

---

## Pre-flight

- [ ] **P0: Start the dev server (once, before Task 1)**

```bash
cd /c/Users/Brandon/pf2e-story
python -m http.server 8000 &
```

Run in the background. Leave running for the entire plan execution. Verify with: `curl -sf http://localhost:8000/index.html | head -5` should return the `<!DOCTYPE html>` line.

- [ ] **P1: Smoke test the current site**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_resize` to width 1280, height 800 (desktop)
- `browser_snapshot` — verify the cover renders
- `browser_evaluate` running `document.querySelectorAll('.page').length` — expect at least 3 (front cover + at least one illustration + at least one text page + back cover)

This baseline will be re-run at the end to confirm desktop is unchanged.

---

## Task 1: Add `layout` parameter to `buildBook` (no behavior change)

**Files:**
- Modify: `js/buildBook.js`

This task introduces the parameter without yet using it for anything. Default value preserves current behavior so `js/app.js` doesn't need to change yet.

- [ ] **Step 1: Update the `buildBook` signature**

In `js/buildBook.js`, change line 5 from:

```js
export function buildBook(story, containerEl) {
```

to:

```js
export function buildBook(story, containerEl, options = {}) {
  const layout = options.layout === 'portrait' ? 'portrait' : 'spread';
```

- [ ] **Step 2: Verify the option threads through**

Add a temporary `console.log('buildBook layout:', layout);` line right after the destructure. (You will remove this in Task 3.)

- [ ] **Step 3: Reload and verify desktop still works**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000` (force a fresh load)
- `browser_console_messages` — confirm `buildBook layout: spread` appears
- `browser_snapshot` — confirm cover still renders, no errors

- [ ] **Step 4: Commit**

```bash
git add js/buildBook.js
git commit -m "feat(buildBook): add layout option parameter (default 'spread')"
```

---

## Task 2: Implement `renderMergedPage` helper (not yet wired)

**Files:**
- Modify: `js/buildBook.js`

This task adds the new render function but does not wire it into the build flow. Defining it in isolation lets the next task simply call it.

- [ ] **Step 1: Add `renderMergedPage` near the bottom of `js/buildBook.js`**

Add this new function immediately above `function renderTextPage(...)`. It mirrors the structure of `renderTextPage` but with an image area on top.

```js
function renderMergedPage({
  image,
  text,
  chapter,
  storyTitle,
  pageNumber,
  storyIndex,
  plateLabel,
  illustrationTitle,
}) {
  // The .page element itself is owned by StPageFlip — its `display` is set
  // dynamically (block when visible, none when hidden). We mustn't put a
  // `display: flex` rule on it or override that with !important, or hidden
  // pages stay visible and overlap the cover. The flex layout that constrains
  // the body lives in an inner wrapper instead, positioned absolutely to fill
  // the page. The page is purely the StPageFlip mount.
  const el = document.createElement('div');
  el.className = 'page page-merged parchment-texture relative overflow-hidden';
  el.dataset.storyIndex = String(storyIndex);

  // Inner wrapper: flex column, fills the page minus padding. Owns the
  // image / chapter / body / footer flex layout. Independent of .page's display.
  const inner = document.createElement('div');
  inner.className = 'page-merged-inner absolute inset-0 flex flex-col p-6 md:p-10';
  el.appendChild(inner);

  // ---- Image area (~38% of inner height, fixed) ----
  const imgWrap = document.createElement('div');
  imgWrap.className = 'page-merged-image relative w-full rounded-sm overflow-hidden shadow-inner flex-shrink-0 mb-4';
  imgWrap.style.height = '38%';
  imgWrap.innerHTML = `
    <img class="page-image w-full h-full object-cover grayscale-[0.2] sepia-[0.2]" src="${escapeAttr(image)}" alt=""/>
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
    ${(plateLabel || illustrationTitle) ? `
    <div class="absolute bottom-3 left-4 right-4 pointer-events-none">
      ${plateLabel ? `<span class="font-label text-[9px] tracking-[0.3em] uppercase text-[#ffb782]/80 mb-0.5 block">Plate ${escapeText(plateLabel)}</span>` : ''}
      ${illustrationTitle ? `<h3 class="font-headline text-base text-white italic drop-shadow-md">${escapeText(illustrationTitle)}</h3>` : ''}
    </div>` : ''}
  `;
  const imgEl = imgWrap.querySelector('img.page-image');
  if (imgEl) imgEl.onerror = () => { imgEl.style.display = 'none'; };
  inner.appendChild(imgWrap);

  // ---- Chapter heading (optional) ----
  if (chapter) {
    const header = document.createElement('div');
    header.className = 'mb-3 relative z-10 flex-shrink-0';
    header.innerHTML = `
      <h2 class="font-headline text-2xl text-[#301400] leading-tight mb-1">${escapeText(chapter)}</h2>
      <div class="h-px w-20 bg-[#d87821]/40"></div>
    `;
    inner.appendChild(header);
  }

  // ---- Body (scrollable) ----
  // The class `page-body` is the same selector word-sync uses on the spread
  // text page, so the existing BookController._onAudioTime auto-scroll works
  // unmodified.
  const body = document.createElement('div');
  body.className = 'page-body flex-1 min-h-0 max-w-none text-[#3d2313] text-[16px] font-body leading-relaxed text-justify overflow-y-auto custom-scrollbar pr-2 relative z-10';

  const paragraphs = (text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('');

  let globalWordIndex = 0;
  paragraphs.forEach((chunk, pi) => {
    const trimmed = chunk.trim();
    const isBlockquote = OPENING_QUOTE.test(trimmed) && CLOSING_QUOTE.test(trimmed);
    const p = document.createElement('p');
    p.className = isBlockquote
      ? 'italic opacity-80 border-l-2 border-[#d87821]/30 pl-4 py-2 my-4'
      : 'mb-3 relative';

    let remaining = chunk;
    if (pi === 0 && !isBlockquote && chunk.length > 0) {
      const firstChar = chunk[0];
      const dropCap = document.createElement('span');
      dropCap.className = 'word drop-cap float-left text-5xl font-headline text-[#d87821] mr-2 mt-1 mb-[-0.4rem] leading-[1] drop-shadow-sm select-none';
      dropCap.dataset.wordIndex = String(globalWordIndex++);
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
  inner.appendChild(body);

  // ---- Footer ----
  const footer = document.createElement('div');
  footer.className = 'mt-auto pt-3 flex justify-center border-t border-black/5 relative z-10 flex-shrink-0';
  footer.innerHTML = `<span class="font-label text-[9px] tracking-widest text-[#3d2313]/60 uppercase">Page ${pageNumber} — ${escapeText(storyTitle)}</span>`;
  inner.appendChild(footer);

  // ---- Rune corner decoration (matches text page) ----
  const rune = document.createElement('div');
  rune.className = 'absolute bottom-6 right-6 text-black/10 select-none pointer-events-none';
  rune.innerHTML = `<span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">storm</span>`;
  el.appendChild(rune);

  return el;
}
```

- [ ] **Step 2: Verify it parses**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000` (force a fresh load)
- `browser_console_messages` — confirm no syntax errors

The function isn't called yet, so there's no visual change.

- [ ] **Step 3: Commit**

```bash
git add js/buildBook.js
git commit -m "feat(buildBook): add renderMergedPage helper for portrait layout"
```

---

## Task 3: Wire `renderMergedPage` into the `'portrait'` layout branch

**Files:**
- Modify: `js/buildBook.js`

- [ ] **Step 1: Branch the page-rendering loop on layout**

In `js/buildBook.js`, replace the existing `story.pages.forEach(...)` block (currently lines 16-30 in the pre-Task-1 file, now slightly later because of the `options` destructure) with:

```js
  // Content: render either spread (illustration + text) or portrait (merged) per story page.
  story.pages.forEach((p, i) => {
    if (layout === 'portrait') {
      containerEl.appendChild(renderMergedPage({
        image: p.image,
        text: p.text,
        chapter: p.chapter,
        storyTitle: story.title,
        pageNumber: i + 1,
        storyIndex: i,
        plateLabel: p.plateLabel,
        illustrationTitle: p.illustrationTitle,
      }));
    } else {
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
    }
  });
```

- [ ] **Step 2: Remove the temporary `console.log` from Task 1**

Delete the `console.log('buildBook layout:', layout);` line added earlier.

- [ ] **Step 3: Verify desktop still produces spread pages**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_evaluate` running `document.querySelectorAll('.page-illustration').length` — should be > 0
- `browser_evaluate` running `document.querySelectorAll('.page-merged').length` — should be 0
- `browser_snapshot` — cover still renders

- [ ] **Step 4: Verify portrait mode renders merged pages**

Use Playwright MCP to test by temporarily forcing portrait via the URL hash trick. We won't modify app.js — instead, run a manual eval to rebuild:

- `browser_evaluate` running:

```js
(async () => {
  const mod = await import('/js/buildBook.js');
  const story = await fetch('/story.json').then(r => r.json());
  const book = document.getElementById('book');
  book.innerHTML = '';
  mod.buildBook(story, book, { layout: 'portrait' });
  return {
    merged: document.querySelectorAll('.page-merged').length,
    illustration: document.querySelectorAll('.page-illustration').length,
    text: document.querySelectorAll('.page-text-page').length,
  };
})();
```

- Expected return: `{ merged: <story.pages.length>, illustration: 0, text: 0 }`
- `browser_take_screenshot` — eyeball the merged page rendering

- [ ] **Step 5: Restore the page**

`browser_navigate` to `http://localhost:8000` again (refreshes back to spread mode).

- [ ] **Step 6: Commit**

```bash
git add js/buildBook.js
git commit -m "feat(buildBook): wire renderMergedPage into 'portrait' layout branch"
```

---

## Task 4: Broaden lookup helpers + rename `findTextPage` → `findTextHost`

**Files:**
- Modify: `js/buildBook.js`
- Modify: `js/BookController.js`

This task touches two files because the rename has to happen everywhere at once or the app will break.

- [ ] **Step 1: Update `findIllustrationImg` selector union in `js/buildBook.js`**

Replace the existing `findIllustrationImg` function (currently around lines 62-66) with:

```js
// Helper: find the <img> for a given story index. Works in both spread (where
// the image lives on .page-illustration) and portrait merged (where the image
// lives on .page-merged) layouts via a union selector.
export function findIllustrationImg(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-illustration[data-story-index="${storyIndex}"] img.page-image, ` +
    `.page-merged[data-story-index="${storyIndex}"] img.page-image`
  );
}
```

- [ ] **Step 2: Rename `findTextPage` to `findTextHost` in `js/buildBook.js`**

Replace the existing `findTextPage` function (currently around lines 68-73) with:

```js
// Helper: find the element that hosts the page body + word spans for a given
// story index. In spread layout this is .page-text-page; in portrait merged
// layout it's .page-merged. The element exposes a .page-body child and .word
// spans in both cases, so word-sync logic doesn't need to branch.
export function findTextHost(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-text-page[data-story-index="${storyIndex}"], ` +
    `.page-merged[data-story-index="${storyIndex}"]`
  );
}
```

- [ ] **Step 3: Update the import in `js/BookController.js`**

Change line 5 from:

```js
import { findIllustrationImg, findTextPage, fitTextToPage } from './buildBook.js';
```

to:

```js
import { findIllustrationImg, findTextHost, fitTextToPage } from './buildBook.js';
```

- [ ] **Step 4: Replace all `findTextPage(...)` call sites in `js/BookController.js` with `findTextHost(...)`**

There are 5 call sites (verify with `grep -n findTextPage js/BookController.js` first — should return 5 matches). Update each one. The current call sites are inside:
- `_fitAllTextPages` (the inner forEach callback)
- `_revealTextForCurrent`
- `_fitCurrentTextPage`
- `_resetWordsForCurrent`
- `_onAudioTime`

For each occurrence, change `findTextPage(this.bookEl, ...)` to `findTextHost(this.bookEl, ...)`.

- [ ] **Step 5: Verify nothing else still references `findTextPage`**

Run: `grep -rn "findTextPage" js/`
Expected: no matches. If any remain, update them.

- [ ] **Step 6: Verify desktop still works**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_console_messages` — confirm no errors
- `browser_evaluate` running:

```js
const ic = window.__bookController_DEBUG;
'no debug handle';
```

(Since BookController isn't exported globally, just verify visually.)

- `browser_snapshot` — cover renders, no errors

- [ ] **Step 7: Commit**

```bash
git add js/buildBook.js js/BookController.js
git commit -m "refactor: rename findTextPage to findTextHost; broaden selectors for portrait"
```

---

## Task 5: Add `_isPortraitMobile` + layout state to `BookController`

**Files:**
- Modify: `js/BookController.js`

Introduce the layout state field, the media query helper, and the layout-aware index conversion. The constructor still uses the existing `pageFlip` argument; we'll add the rebuild flow in later tasks.

- [ ] **Step 1: Add the helper method**

Add this method to `BookController` (place it near the existing `_isPortraitMode` method, around line 79):

```js
  _isPortraitMobile() {
    return window.matchMedia('(orientation: portrait) and (max-width: 720px)').matches;
  }
```

- [ ] **Step 2: Initialize `_currentLayout` in the constructor**

In the constructor, immediately after `this.bookEl = bookEl;` (around line 14), add:

```js
    this._currentLayout = this._isPortraitMobile() ? 'portrait' : 'spread';
```

- [ ] **Step 3: Make `currentStoryPageIndex` layout-aware**

Replace the existing `currentStoryPageIndex` method (currently lines 71-77) with:

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

- [ ] **Step 4: Verify desktop still works**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_console_messages` — no errors
- `browser_evaluate` running `document.getElementById('btn-play').click()`, verify pages flip and audio plays

- [ ] **Step 5: Commit**

```bash
git add js/BookController.js
git commit -m "feat(BookController): add layout state field and _isPortraitMobile helper"
```

---

## Task 6: Extract flip event handler into `_wirePageFlipEvents`

**Files:**
- Modify: `js/BookController.js`

Extract the inline `pageFlip.on('flip', () => {...})` block from the constructor into a method so it can be re-attached after rebuild.

- [ ] **Step 1: Extract the method**

Add this new method to `BookController`, placed right after the constructor:

```js
  _wirePageFlipEvents() {
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
        this._revealTextForCurrent();
        this._playCurrentPage();
      }
      if (this.onChange) this.onChange();
    });
  }
```

Note: this version drops the `_isPortraitMode() && _isOnIllustrationPage()` branch (the mobile illustration hold). Task 9 will delete the now-orphan helper. The reason it's safe to drop here: in portrait mode there's no separate illustration page, so the branch was specific to the old layout we're replacing. In spread mode, this branch never fires anyway (the desktop spread advances both pages at once via `_advanceOrStop`'s second flip, never landing on an isolated illustration page).

- [ ] **Step 2: Replace the inline `pageFlip.on('flip', ...)` block in the constructor with a call to the new method**

In the constructor, find the existing block (currently lines 26-48):

```js
    this.pageFlip.on('flip', () => {
      this._clearTimer();
      this._stopKenBurnsAll();
      // ... etc
      if (this.onChange) this.onChange();
    });
```

Replace it with:

```js
    this._wirePageFlipEvents();
```

- [ ] **Step 3: Verify desktop still works**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_evaluate` running `document.getElementById('btn-play').click()`
- `browser_evaluate` running `document.getElementById('btn-next').click()` a few times
- Verify pages flip, audio plays, no errors in `browser_console_messages`

- [ ] **Step 4: Commit**

```bash
git add js/BookController.js
git commit -m "refactor(BookController): extract flip handler into _wirePageFlipEvents"
```

---

## Task 7: Implement `_rebuildBook(newLayout)` (not yet wired to event)

**Files:**
- Modify: `js/BookController.js`
- Modify: `js/BookController.js` (import update)

- [ ] **Step 1: Add `buildBook` to the import**

Change the import line in `js/BookController.js` from:

```js
import { findIllustrationImg, findTextHost, fitTextToPage } from './buildBook.js';
```

to:

```js
import { buildBook, findIllustrationImg, findTextHost, fitTextToPage } from './buildBook.js';
```

- [ ] **Step 2: Add the `_rebuildBook` method**

Place it after `_wirePageFlipEvents`:

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
    if (targetBookIdx > 0) {
      this.pageFlip.flip(targetBookIdx);
    }
    this._loadCurrentPage();
    this._applyKenBurnsForCurrent();
    if (this.onChange) this.onChange();
    if (wasPlaying) this.play();
  }
```

- [ ] **Step 3: Verify the file parses**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_console_messages` — no errors

- [ ] **Step 4: Manually exercise `_rebuildBook` from devtools**

Use Playwright MCP `browser_evaluate`:

```js
(() => {
  // Find the book controller via the closure (no global handle).
  // We can't easily reach it without exporting, so instead test the rebuild
  // via a fresh buildBook call to confirm destroy + reinit works.
  const book = document.getElementById('book');
  // Intentionally probe StPageFlip's destroy presence:
  const pf = window.St && window.St.PageFlip;
  return typeof pf === 'function' ? 'PageFlip class present' : 'missing';
})();
```

The actual `_rebuildBook` test happens end-to-end in Task 8 after the listener is wired.

- [ ] **Step 5: Commit**

```bash
git add js/BookController.js
git commit -m "feat(BookController): add _rebuildBook(newLayout) for orientation switch"
```

---

## Task 8: Wire the orientation media query change listener

**Files:**
- Modify: `js/BookController.js`

- [ ] **Step 1: Add the listener at the end of the constructor**

Append to the constructor (just before the closing `}` of `constructor(...)`), after the existing resize listener:

```js
    // Orientation listener: when the user rotates a phone, rebuild the book
    // with the appropriate layout. Uses matchMedia change events so it only
    // fires on real orientation changes (not generic resize).
    const orientationMQ = window.matchMedia('(orientation: portrait) and (max-width: 720px)');
    const onOrientationChange = (e) => {
      this._rebuildBook(e.matches ? 'portrait' : 'spread');
    };
    if (orientationMQ.addEventListener) {
      orientationMQ.addEventListener('change', onOrientationChange);
    } else if (orientationMQ.addListener) {
      // Safari < 14 fallback
      orientationMQ.addListener(onOrientationChange);
    }
```

- [ ] **Step 2: Verify desktop is still unaffected**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_resize` to 1280x800
- `browser_evaluate` running `document.querySelectorAll('.page-merged').length` → expect `0`
- `browser_evaluate` running `document.querySelectorAll('.page-illustration').length` → expect > 0

- [ ] **Step 3: Verify rebuild happens on resize-into-portrait-mobile**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_resize` to 400x800 (phone portrait)
- Wait 500ms (`browser_wait_for` time:0.5)
- `browser_evaluate` running `document.querySelectorAll('.page-merged').length` → expect equal to story page count
- `browser_evaluate` running `document.querySelectorAll('.page-illustration').length` → expect `0`
- `browser_take_screenshot` — verify the merged page is visible

- [ ] **Step 4: Verify rebuild back to spread on resize-out**

Use Playwright MCP:
- `browser_resize` to 1280x800 (back to desktop)
- Wait 500ms
- `browser_evaluate` running `document.querySelectorAll('.page-merged').length` → expect `0`
- `browser_evaluate` running `document.querySelectorAll('.page-illustration').length` → expect > 0

- [ ] **Step 5: Verify position is preserved across rebuilds**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_evaluate` running `document.getElementById('btn-play').click()`
- `browser_evaluate` running `document.getElementById('btn-next').click()` twice (advance two spreads)
- `browser_evaluate` running `document.querySelector('#book .stf__parent').__pageFlipInstance ? 'has' : 'no handle'` — informational; the actual verification:
- `browser_resize` to 400x800
- Wait 500ms
- `browser_take_screenshot` — should show the same story page in merged form, not the cover
- `browser_resize` to 1280x800
- Wait 500ms
- `browser_take_screenshot` — should show the same story page in spread form

- [ ] **Step 6: Commit**

```bash
git add js/BookController.js
git commit -m "feat(BookController): rebuild on orientation change via matchMedia listener"
```

---

## Task 9: Delete the obsolete illustration-hold path

**Files:**
- Modify: `js/BookController.js`

The mobile portrait branch in `_advanceOrStop` and the `_isOnIllustrationPage` helper are no longer needed because portrait now uses the merged layout (1 page per story entry).

- [ ] **Step 1: Delete `MOBILE_ILLUSTRATION_HOLD_MS`**

At the top of `js/BookController.js`, delete the line:

```js
const MOBILE_ILLUSTRATION_HOLD_MS = 1500;
```

- [ ] **Step 2: Delete `_isOnIllustrationPage`**

Delete the entire method (currently around lines 84-88):

```js
  _isOnIllustrationPage() {
    const bookIdx = this.pageFlip.getCurrentPageIndex();
    const contentPages = this.story.pages.length * 2;
    return bookIdx >= 1 && bookIdx <= contentPages && (bookIdx % 2 === 1);
  }
```

- [ ] **Step 3: Delete `_isPortraitMode`**

This used the old `(max-width: 720px)` query and is now superseded by `_isPortraitMobile`. Delete:

```js
  _isPortraitMode() {
    return window.matchMedia('(max-width: 720px)').matches;
  }
```

- [ ] **Step 4: Update `_advanceOrStop` to branch on layout instead**

Replace the existing `_advanceOrStop` method with:

```js
  _advanceOrStop() {
    const storyIdx = this.currentStoryPageIndex();
    if (storyIdx < 0 || storyIdx >= this.story.pages.length - 1) {
      this.pause();
      return;
    }
    this.pageFlip.flipNext();
    if (this._currentLayout === 'spread') {
      // Desktop spread advances both pages at once — fire a second flip after
      // the first lands so a full spread turns as one unit.
      const targetBookIdx = this.pageFlip.getCurrentPageIndex() + 1;
      setTimeout(() => this.pageFlip.flip(targetBookIdx), 50);
    }
  }
```

- [ ] **Step 5: Verify no references to the deleted symbols remain**

Run: `grep -n "_isPortraitMode\|_isOnIllustrationPage\|MOBILE_ILLUSTRATION_HOLD_MS" js/BookController.js`
Expected: no matches.

- [ ] **Step 6: Verify desktop still flips spreads**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_resize` to 1280x800
- `browser_evaluate` running `document.getElementById('btn-play').click()`
- After ~3 seconds, `browser_take_screenshot` — should show the first spread (illustration + text both visible)

- [ ] **Step 7: Verify portrait advances correctly**

Use Playwright MCP:
- `browser_resize` to 400x800
- Wait 500ms
- `browser_evaluate` running `document.getElementById('btn-play').click()` (note: click target may be the same `#btn-play` button)
- `browser_take_screenshot` — first merged page should be visible
- Wait for audio (or use the next button to manually advance)
- `browser_evaluate` running `document.getElementById('btn-next').click()`; `browser_take_screenshot` — should jump straight to the second story page's merged view (no intermediate "illustration only" page)

- [ ] **Step 8: Commit**

```bash
git add js/BookController.js
git commit -m "refactor(BookController): drop obsolete portrait illustration-hold path"
```

---

## Task 10: Broaden CSS rules for `.page-merged` (reveal animation + word opacity)

**Files:**
- Modify: `index.html`

The reveal animation and word-sync opacity rules currently only target `.page-text-page`. Extend them to cover `.page-merged` so the merged page also fades in and the unspoken words sit faint.

- [ ] **Step 1: Broaden the unspoken-word opacity rules**

In `index.html`, find the existing rules (currently around lines 141-146):

```css
    .page-text-page .word {
      opacity: 0.35;
      transition: opacity 280ms ease-out;
    }
    .page-text-page .word.spoken { opacity: 1; }
    .page-text-page:not(.reveal) .word { opacity: 1; }
```

Replace them with:

```css
    .page-text-page .word,
    .page-merged .word {
      opacity: 0.35;
      transition: opacity 280ms ease-out;
    }
    .page-text-page .word.spoken,
    .page-merged .word.spoken { opacity: 1; }
    .page-text-page:not(.reveal) .word,
    .page-merged:not(.reveal) .word { opacity: 1; }
```

- [ ] **Step 2: Broaden the reveal animation rules**

Find the existing rules (currently around lines 148-155):

```css
    .page-text-page.reveal .page-body {
      animation: text-fade-in 800ms ease-out;
    }
```

Replace with:

```css
    .page-text-page.reveal .page-body,
    .page-merged.reveal .page-body {
      animation: text-fade-in 800ms ease-out;
    }
```

- [ ] **Step 3: Broaden the mobile body-scroll rules**

Find the existing mobile rules (currently around lines 246-252):

```css
      .page-text-page .page-body {
        overflow-y: auto !important;
        font-size: 16px !important;
        scroll-behavior: smooth;
        scrollbar-width: none;
      }
      .page-text-page .page-body::-webkit-scrollbar { display: none; }
```

Replace with:

```css
      .page-text-page .page-body,
      .page-merged .page-body {
        overflow-y: auto !important;
        font-size: 16px !important;
        scroll-behavior: smooth;
        scrollbar-width: none;
      }
      .page-text-page .page-body::-webkit-scrollbar,
      .page-merged .page-body::-webkit-scrollbar { display: none; }
```

- [ ] **Step 4: Verify portrait merged page has the fade-in**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_resize` to 400x800
- Wait 500ms
- `browser_evaluate` running `document.getElementById('btn-play').click()`, wait for the first merged page
- `browser_evaluate` running:

```js
const m = document.querySelector('.page-merged.reveal');
m ? getComputedStyle(m.querySelector('.page-body')).animationName : 'no reveal class';
```

- Expected: `text-fade-in`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "style: broaden reveal/word-sync CSS to cover .page-merged"
```

---

## Task 11: Create `js/RotateHint.js`

**Files:**
- Create: `js/RotateHint.js`

- [ ] **Step 1: Write the new module**

Create `js/RotateHint.js` with:

```js
// Quiet top-toast hint shown the first time the app loads on a phone in
// portrait. Suggests the user rotate for the full-spread experience.
// Dismissed permanently (per device) on the first interaction or after the
// auto-fade timer.

const STORAGE_KEY = 'otari.rotateHintDismissed';
const AUTO_FADE_MS = 6000;
const FADE_OUT_MS = 280;

function isPortraitMobile() {
  return window.matchMedia('(orientation: portrait) and (max-width: 720px)').matches;
}

function alreadyDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {
    // localStorage unavailable (private mode, etc.) — treat as dismissed so
    // we don't nag in environments where we can't remember the dismissal.
    return true;
  }
}

function persistDismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch (_) { /* ignore */ }
}

export function installRotateHint() {
  if (!isPortraitMobile()) return;
  if (alreadyDismissed()) return;

  const el = document.getElementById('rotate-hint');
  if (!el) return;

  let fadeTimer = null;
  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    el.style.opacity = '0';
    setTimeout(() => { el.hidden = true; }, FADE_OUT_MS);
    persistDismiss();
  }

  // Reveal
  el.hidden = false;
  // Force a layout flush so the opacity transition fires from 0 to 1.
  void el.offsetWidth;
  el.style.opacity = '1';

  // Auto-fade after 6s.
  fadeTimer = setTimeout(dismiss, AUTO_FADE_MS);

  // Dismiss on tap of the toast or its close button.
  el.addEventListener('click', dismiss);
  const closeBtn = el.querySelector('#rotate-hint-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });
  }
}
```

- [ ] **Step 2: Verify the file parses**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_evaluate` running `import('/js/RotateHint.js').then(m => typeof m.installRotateHint).catch(e => 'ERR: ' + e.message)` — should return `'function'`

- [ ] **Step 3: Commit**

```bash
git add js/RotateHint.js
git commit -m "feat(RotateHint): add quiet top-toast hint module for portrait mobile"
```

---

## Task 12: Add `#rotate-hint` element + styles to `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the element to the body**

In `index.html`, just inside `<body>` (immediately after the `<body class="...">` tag, before the safelist `<div>`), add:

```html
  <!-- Rotate hint toast — shown only on first portrait-mobile load by js/RotateHint.js -->
  <div id="rotate-hint" hidden role="status" aria-live="polite">
    <span class="material-symbols-outlined" aria-hidden="true">screen_rotation</span>
    <span class="rotate-hint-label">Rotate for the full spread</span>
    <button id="rotate-hint-close" type="button" aria-label="Dismiss">×</button>
  </div>
```

- [ ] **Step 2: Add the styles**

In the `<style>` block in `index.html`, append the following CSS just before the closing `</style>` tag (after the mobile media-query block):

```css
    /* Rotate hint toast — shown only on first portrait-mobile load by RotateHint.js. */
    #rotate-hint {
      position: fixed;
      top: 64px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px 8px 12px;
      background: rgba(26, 14, 7, 0.92);
      color: #ffb782;
      border: 1px solid rgba(255, 183, 130, 0.3);
      border-radius: 999px;
      font-family: 'Work Sans', sans-serif;
      font-size: 12px;
      letter-spacing: 0.05em;
      backdrop-filter: blur(6px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      opacity: 0;
      transition: opacity 280ms ease-out;
      z-index: 1100;
      pointer-events: auto;
    }
    #rotate-hint[hidden] { display: none; }
    #rotate-hint .material-symbols-outlined { font-size: 18px; }
    #rotate-hint .rotate-hint-label { line-height: 1; }
    #rotate-hint #rotate-hint-close {
      background: transparent;
      border: 0;
      color: rgba(255, 183, 130, 0.7);
      font-size: 18px;
      line-height: 1;
      padding: 0 4px;
      cursor: pointer;
    }
    #rotate-hint #rotate-hint-close:hover { color: #ffb782; }
```

- [ ] **Step 3: Verify the markup parses and is hidden by default**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_evaluate` running `document.getElementById('rotate-hint').hidden` — expect `true`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(index): add #rotate-hint element + styles"
```

---

## Task 13: Wire `installRotateHint()` in `js/app.js`

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Add the import**

In `js/app.js`, add to the import block at the top:

```js
import { installRotateHint } from './RotateHint.js';
```

- [ ] **Step 2: Call it after BookController construction**

In the `loadStory().then(...)` block, after `new UIController({ book, audio });`, add:

```js
      installRotateHint();
```

- [ ] **Step 3: Clear localStorage and verify the hint shows on portrait mobile**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_resize` to 400x800
- `browser_evaluate` running `localStorage.removeItem('otari.rotateHintDismissed')`
- `browser_navigate` to `http://localhost:8000` (reload so the install runs fresh on portrait)
- Wait 500ms
- `browser_evaluate` running `document.getElementById('rotate-hint').hidden` — expect `false`
- `browser_evaluate` running `getComputedStyle(document.getElementById('rotate-hint')).opacity` — expect `'1'`
- `browser_take_screenshot` — verify the toast is visible at the top

- [ ] **Step 4: Verify clicking the close button dismisses + persists**

Use Playwright MCP:
- `browser_evaluate` running `document.getElementById('rotate-hint-close').click()`
- Wait 500ms
- `browser_evaluate` running `document.getElementById('rotate-hint').hidden` — expect `true`
- `browser_evaluate` running `localStorage.getItem('otari.rotateHintDismissed')` — expect `'1'`
- `browser_navigate` to `http://localhost:8000` (reload)
- Wait 500ms
- `browser_evaluate` running `document.getElementById('rotate-hint').hidden` — expect `true` (stays dismissed)

- [ ] **Step 5: Verify the hint never shows on desktop**

Use Playwright MCP:
- `browser_evaluate` running `localStorage.removeItem('otari.rotateHintDismissed')`
- `browser_resize` to 1280x800
- `browser_navigate` to `http://localhost:8000`
- Wait 500ms
- `browser_evaluate` running `document.getElementById('rotate-hint').hidden` — expect `true`

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat(app): wire installRotateHint() after BookController construction"
```

---

## Task 14: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "Story → Book page mapping (critical)" section**

Find the existing section (currently starts around line 19) and replace the content under the heading with:

```markdown
The book has TWO layouts and the story → book page mapping depends on which is active:

- **Spread layout** (desktop, tablets, phone landscape): each entry in `story.pages` produces **two** book pages — an illustration page (odd book index) followed by a text page (even book index). Plus a front cover (book index 0) and a back cover.
- **Portrait layout** (phone in portrait, `(orientation: portrait) and (max-width: 720px)`): each entry in `story.pages` produces **one** merged book page (image fixed at top, text scrolling beneath). Plus front and back covers.

`BookController._currentLayout` tracks which layout is active. `currentStoryPageIndex()` branches on it: in portrait it's `bookIdx - 1`; in spread it's `(bookIdx - 1) >> 1`. Both reject covers.

The lookup helpers `findIllustrationImg(container, storyIndex)` and `findTextHost(container, storyIndex)` in `buildBook.js` use union selectors so the same call works in both layouts. They rely on `data-story-index` attributes set in `renderIllustrationPage` / `renderTextPage` / `renderMergedPage`.

When adding any feature that targets "the current page," resolve through `currentStoryPageIndex()`, never the raw `pageFlip.getCurrentPageIndex()`.
```

- [ ] **Step 2: Update the "Auto-advance state machine" section**

Find the existing section and replace its content with:

```markdown
`BookController` advances pages in two ways, and the priority matters:

1. If the current page has `audio`, it plays and advances on the audio's `ended` event.
2. Else if `durationMs` is set, it advances after a `setTimeout`.
3. Else it pauses (the user must click Next).

Audio always wins over `durationMs` — see `_playCurrentPage()`. Both paths funnel through `_advanceOrStop()`. In **spread layout** it issues a *second* flip 50 ms after the first so a full spread advances at once. In **portrait layout** it issues a single flip — each story entry is one merged page, so there's no spread to keep in sync.
```

- [ ] **Step 3: Add a section about orientation handling**

Insert this new subsection right after the "Auto-advance state machine" section:

```markdown
### Orientation handling

`BookController` listens to `window.matchMedia('(orientation: portrait) and (max-width: 720px)')` and rebuilds the book on `change` events. The rebuild flow in `_rebuildBook(newLayout)`:

1. Save `currentStoryPageIndex()`.
2. Pause playback.
3. `pageFlip.destroy()`.
4. `buildBook(story, bookEl, { layout: newLayout })`.
5. Re-attach the flip event handler via `_wirePageFlipEvents()`.
6. `pageFlip.flip(savedStoryIndex × pagesPerStory + 1)` to restore position.
7. Resume playback if it was playing.

Audio currentTime resets to 0 across the rebuild — rotation is treated as a deliberate user action where re-narration is acceptable.
```

- [ ] **Step 4: Add `js/RotateHint.js` to the module-responsibilities table**

In the module table, add a new row after the `UIController.js` row:

```markdown
| `js/RotateHint.js` | Quiet top-toast hint shown the first time the app loads on a phone in portrait. Suggests rotating for the full spread. Dismissed (and persisted via localStorage) on click or after 6s auto-fade. |
```

- [ ] **Step 5: Verify the changes are coherent**

`grep -n "MOBILE_ILLUSTRATION_HOLD_MS\|illustration-hold" CLAUDE.md` — should return no matches.
`grep -n "findTextPage" CLAUDE.md` — should return no matches.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE): document portrait merged layout, orientation rebuild, RotateHint"
```

---

## Task 15: End-to-end verification

**Files:** none modified — verification only.

This task exercises the full feature set on both layouts and on rotation.

- [ ] **Step 1: Desktop spread baseline**

Use Playwright MCP:
- `browser_navigate` to `http://localhost:8000`
- `browser_resize` to 1280x800
- `browser_evaluate` running `localStorage.removeItem('otari.rotateHintDismissed')`
- `browser_navigate` to `http://localhost:8000` (reload)
- `browser_evaluate` running:

```js
({
  pages: document.querySelectorAll('.page').length,
  illustration: document.querySelectorAll('.page-illustration').length,
  text: document.querySelectorAll('.page-text-page').length,
  merged: document.querySelectorAll('.page-merged').length,
  hintHidden: document.getElementById('rotate-hint').hidden,
})
```

Expected: `merged: 0`, `illustration: <story.pages.length>`, `text: <story.pages.length>`, `hintHidden: true`.

- `browser_take_screenshot` — verify the cover renders.
- `browser_evaluate` running `document.getElementById('btn-play').click()`.
- Wait until the first spread is visible.
- `browser_take_screenshot` — verify both pages of the first spread are visible.

- [ ] **Step 2: Phone portrait merged**

- `browser_resize` to 400x800.
- Wait 500ms (rebuild fires).
- `browser_evaluate` running:

```js
({
  illustration: document.querySelectorAll('.page-illustration').length,
  text: document.querySelectorAll('.page-text-page').length,
  merged: document.querySelectorAll('.page-merged').length,
  hintHidden: document.getElementById('rotate-hint').hidden,
})
```

Expected: `illustration: 0`, `text: 0`, `merged: <story.pages.length>`, `hintHidden: false` (the rotate hint should reveal because we cleared the localStorage flag in Step 1).

- `browser_take_screenshot` — verify the merged page is visible with the toast at the top.
- `browser_evaluate` running `document.getElementById('rotate-hint-close').click()` to dismiss.
- `browser_evaluate` running `document.getElementById('rotate-hint').hidden` — expect `true`.

- [ ] **Step 3: Portrait auto-advance smoke**

- Reload `http://localhost:8000`.
- `browser_resize` to 400x800.
- Wait 500ms.
- `browser_evaluate` running `document.getElementById('btn-play').click()`.
- `browser_take_screenshot` — first merged page visible.
- `browser_evaluate` running `document.getElementById('btn-next').click()`.
- `browser_take_screenshot` — second merged page visible (no intermediate illustration-only flash).

- [ ] **Step 4: Phone landscape spread**

- `browser_resize` to 800x400 (phone landscape).
- Wait 500ms.
- `browser_evaluate` running:

```js
({
  illustration: document.querySelectorAll('.page-illustration').length,
  merged: document.querySelectorAll('.page-merged').length,
})
```

Expected: `illustration: <story.pages.length>` (rebuild back into spread), `merged: 0`.

- `browser_take_screenshot` — verify both pages of the spread are visible.

- [ ] **Step 5: Rotation while playing preserves position**

- Reload `http://localhost:8000`.
- `browser_resize` to 1280x800.
- `browser_evaluate` running `document.getElementById('btn-play').click()`.
- `browser_evaluate` running `document.getElementById('btn-next').click(); document.getElementById('btn-next').click();` (advance two spreads).
- Note the visible page (`browser_take_screenshot`).
- `browser_resize` to 400x800.
- Wait 500ms.
- `browser_take_screenshot` — should show the same story page, not the cover, in merged form.
- `browser_resize` to 1280x800.
- Wait 500ms.
- `browser_take_screenshot` — should show the same story page in spread form.

- [ ] **Step 6: Word-sync still works in merged page**

- `browser_resize` to 400x800.
- Reload.
- `browser_evaluate` running `document.getElementById('btn-play').click()`.
- Wait ~3 seconds for audio to start narrating.
- `browser_evaluate` running:

```js
({
  spoken: document.querySelectorAll('.page-merged .word.spoken').length,
  total: document.querySelectorAll('.page-merged .word').length,
})
```

Expected: `spoken > 0` and `total > 0`. (If the first page has no audio, `spoken: 0` is OK — note the result.)

- [ ] **Step 7: Console error sweep**

`browser_console_messages` — verify no errors logged across the entire test run. If errors appear, capture the message and either fix or escalate.

- [ ] **Step 8: Stop the dev server**

```bash
# Find and kill the python http.server started in P0
pkill -f "http.server 8000" || true
```

- [ ] **Step 9: Final commit (only if any verification fixes were needed)**

If Step 7 surfaced issues that required code changes, commit those fixes here. Otherwise, no commit is needed for this task.

---

## Done

When all tasks are checked off, the feature is complete. The branch should contain ~14 commits (one per task plus one for the spec). Hand off to the user for acceptance.
