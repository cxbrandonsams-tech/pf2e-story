// Orchestrates the book: audio/timer → advance full spread; flip → load new spread's
// audio, Ken Burns, and text reveal.

import { KenBurns } from './KenBurns.js';
import { buildBook, findIllustrationImg, findTextHost, fitTextToPage } from './buildBook.js';

export class BookController {
  constructor({ story, pageFlip, audio, bookEl }) {
    this.story = story;
    this.pageFlip = pageFlip;
    this.audio = audio;
    this.bookEl = bookEl;
    // StPageFlip's destroy() detaches the mount element from the DOM, so to
    // rebuild we re-attach a fresh mount under the same parent. Capture both
    // the parent and the original mount attributes (id, className) once.
    this._bookParent = bookEl.parentElement;
    this._bookId = bookEl.id;
    // Scrub StPageFlip's runtime classes (e.g., stf__parent) from the captured
    // original — buildBook has already mounted on bookEl by the time this
    // constructor runs, so bookEl.className includes them. Storing the cleaned
    // string keeps _rebuildBook's fresh mount in a "before StPageFlip" state.
    this._bookOriginalClass = bookEl.className
      .replace(/\bstf__\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    this._currentLayout = this._isPortraitMobile() ? 'portrait' : 'spread';
    this.isPlaying = false;
    this.onChange = null;
    this._timerId = null;
    // When the user manually scrolls the page-body (wheel or touch), we
    // suspend the leading-edge auto-scroll until this timestamp passes, so
    // they can read backwards/forwards without being yanked back to the
    // currently-spoken word every audio tick. Cleared on play() so resuming
    // narration immediately re-engages auto-scroll.
    this._suppressAutoScrollUntil = 0;

    // Wire user-activity detection. Capture phase + window-level so it
    // works regardless of which page-body is active and survives every
    // BookController._rebuildBook (which detaches the old book element
    // entirely). The handler only fires when the activity originates inside
    // a .page-body — clicks on the controls or the cover image are ignored.
    const onUserActivity = (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('.page-body')) {
        this._suppressAutoScrollUntil = Date.now() + 5000;
      }
    };
    window.addEventListener('wheel', onUserActivity, { passive: true, capture: true });
    window.addEventListener('touchstart', onUserActivity, { passive: true, capture: true });

    this.audio.onEnded = () => {
      if (!this.isPlaying) return;
      this._advanceOrStop();
    };

    this.audio.onTimeUpdate = (t, d) => this._onAudioTime(t, d);

    this._wirePageFlipEvents();

    this._loadCurrentPage();
    this._applyKenBurnsForCurrent();
    // Fit text on all pages once fonts are ready, and re-fit on resize/orientation.
    this._fitAllTextPages = () => {
      this.story.pages.forEach((_, i) => {
        const el = findTextHost(this.bookEl, i);
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
  }

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

  _rebuildBook(newLayout) {
    if (newLayout === this._currentLayout) return;
    const bookIdxBefore = this.pageFlip.getCurrentPageIndex();
    const savedStoryIdx = this.currentStoryPageIndex();
    const oldContentPages = this.story.pages.length * (this._currentLayout === 'portrait' ? 1 : 2);
    const wasOnBackCover = bookIdxBefore > oldContentPages;
    const wasPlaying = this.isPlaying;
    this.pause();
    // Wrap destroy() defensively: if a flip animation was in flight at the
    // moment the user rotated, StPageFlip's internal animator can throw after
    // its canvas is detached. We still want to proceed with rebuild so the
    // controller reaches a consistent state.
    try {
      this.pageFlip.destroy();
    } catch (err) {
      console.warn('StPageFlip.destroy() threw during rebuild:', err);
    }
    // StPageFlip.destroy() removes the mount element from the DOM. Create a
    // fresh mount with the same id/class under the saved parent so subsequent
    // rebuilds keep working.
    const fresh = document.createElement('div');
    fresh.id = this._bookId;
    fresh.className = this._bookOriginalClass;
    this._bookParent.appendChild(fresh);
    this.bookEl = fresh;
    // Update _currentLayout BEFORE buildBook runs. The synchronous resize that
    // StPageFlip fires during construction can re-trigger our matchMedia listener
    // mid-rebuild on some engines; the early-return guard at the top of this
    // method relies on _currentLayout already matching newLayout to suppress
    // that reentrant call.
    this._currentLayout = newLayout;
    this.pageFlip = buildBook(this.story, this.bookEl, { layout: newLayout });
    this._wirePageFlipEvents();
    const pagesPerStory = newLayout === 'portrait' ? 1 : 2;
    const newContentPages = this.story.pages.length * pagesPerStory;
    let targetBookIdx;
    if (savedStoryIdx >= 0) {
      targetBookIdx = 1 + savedStoryIdx * pagesPerStory;
    } else if (wasOnBackCover) {
      targetBookIdx = newContentPages + 1;
    } else {
      targetBookIdx = 0;
    }
    // Restore isPlaying BEFORE flipping so the flip handler (which checks
    // this.isPlaying when the flip lands) re-starts narration on the target
    // page. Calling play() here would race with the in-flight flip and could
    // emit an extra flipNext() (the new pageFlip starts at idx 0).
    this.isPlaying = wasPlaying;
    if (targetBookIdx > 0) {
      this.pageFlip.flip(targetBookIdx);
      // Flip handler (wired via _wirePageFlipEvents) will load audio,
      // restart Ken Burns, and notify onChange when the flip lands.
    } else {
      // No flip — wire up the cover state manually since no flip event fires.
      this._loadCurrentPage();
      this._applyKenBurnsForCurrent();
      if (this.onChange) this.onChange();
    }
  }

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

  _isPortraitMobile() {
    return window.matchMedia('(orientation: portrait) and (max-width: 720px)').matches;
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
    if (this._currentLayout === 'spread') {
      // Desktop spread advances both pages at once — fire a second flip after
      // the first lands so a full spread turns as one unit.
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
    const el = findTextHost(this.bookEl, idx);
    if (el) el.classList.add('reveal');
  }

  _clearRevealAll() {
    this.bookEl.querySelectorAll('.page-text-page.reveal').forEach(el => {
      el.classList.remove('reveal');
    });
  }

  _fitCurrentTextPage() {
    const idx = this.currentStoryPageIndex();
    const el = findTextHost(this.bookEl, idx);
    if (el) fitTextToPage(el);
  }

  _resetWordsForCurrent() {
    const idx = this.currentStoryPageIndex();
    const el = findTextHost(this.bookEl, idx);
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
    const el = findTextHost(this.bookEl, idx);
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
      // Audio at the very start of the page (currentTime ≤ 0.05). Defensive:
      // re-anchor the body scroll to the top so a re-played page always
      // shows the spoken word's neighborhood. The flip handler also resets
      // bodyEl.scrollTop to 0 on every page change, but this branch covers
      // any future code path that calls audio.reset() without flipping.
      if (quill) quill.classList.remove('active');
      if (bodyEl) bodyEl.scrollTop = 0;
      return;
    }
    const lastSpoken = words[target - 1];
    if (!lastSpoken || !bodyEl) return;

    // Auto-scroll the body so the currently-spoken word stays in view.
    // Design notes:
    //
    // We can't use lastSpoken.offsetTop here. Each <p> has class 'relative'
    // (so blockquote borders / drop-caps anchor correctly), which makes the
    // paragraph the offsetParent of every word span. offsetTop is therefore
    // the word's offset INSIDE its paragraph, not inside the body — small
    // values that would pin scroll near 0 forever. Use the rect difference
    // (which is layout-flush-aware and scroll-aware) instead.
    //
    // Trigger model: do NOT continuously chase the spoken word. That fights
    // the reader if they manually scroll ahead to peek at upcoming text — the
    // next timeupdate yanks them back. Instead, only auto-scroll when the
    // spoken word has crossed into the lower 35% of the body. At that point
    // we jump scroll so the word sits ~35% from the top, leaving most of the
    // visible body for the upcoming text. Between triggers the user is free
    // to scroll up or down without being yanked.
    //
    // Pair with `scroll-behavior: smooth` on .page-body so each trigger
    // animates instead of snapping.
    const wordRectForScroll = lastSpoken.getBoundingClientRect();
    const bodyRectForScroll = bodyEl.getBoundingClientRect();
    const wordVisibleTop = wordRectForScroll.top - bodyRectForScroll.top;
    const triggerLine   = bodyEl.clientHeight * 0.65;
    const restLine      = bodyEl.clientHeight * 0.35;
    const userActive    = Date.now() < this._suppressAutoScrollUntil;
    if (wordVisibleTop > triggerLine && !userActive) {
      const wordTopInBody = wordVisibleTop + bodyEl.scrollTop;
      const maxScroll = Math.max(0, bodyEl.scrollHeight - bodyEl.clientHeight);
      const targetScroll = Math.max(0, Math.min(maxScroll, wordTopInBody - restLine));
      if (Math.abs(bodyEl.scrollTop - targetScroll) > 4) {
        bodyEl.scrollTop = targetScroll;
      }
    }

    // Quill cursor — desktop only. On mobile the auto-scroll is the visual
    // pointer; on desktop the quill floats next to the spoken word.
    // Quill is parented to .page-text-page (which has `position: relative`),
    // so its left/top must be expressed in that element's coordinate space.
    // Re-read both rects AFTER the scroll above so we use the post-scroll
    // visible position of the word.
    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    if (!quill) return;
    if (isMobile) { quill.classList.remove('active'); return; }
    const pageEl = quill.offsetParent || el;
    const pageRect = pageEl.getBoundingClientRect();
    const wordRect = lastSpoken.getBoundingClientRect();
    const bodyRect = bodyEl.getBoundingClientRect();
    // Hide the quill when the word has scrolled outside the visible body
    // (e.g., we're at the bottom of the body and the word fell off the
    // top, or the user has scrolled past the spoken word).
    const wordVisible =
      wordRect.bottom > bodyRect.top &&
      wordRect.top    < bodyRect.bottom;
    if (!wordVisible) { quill.classList.remove('active'); return; }
    quill.classList.add('active');
    quill.style.left = `${wordRect.right - pageRect.left}px`;
    quill.style.top  = `${wordRect.top   - pageRect.top}px`;
  }

  play() {
    this.isPlaying = true;
    // Resuming play should re-engage auto-scroll, even if the user was
    // manually scrolling moments ago.
    this._suppressAutoScrollUntil = 0;
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
