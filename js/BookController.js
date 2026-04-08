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
    this._bookOriginalClass = bookEl.className;
    this._currentLayout = this._isPortraitMobile() ? 'portrait' : 'spread';
    this.isPlaying = false;
    this.onChange = null;
    this._timerId = null;

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
    this.pageFlip.destroy();
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
      if (quill) quill.classList.remove('active');
      if (bodyEl) bodyEl.scrollTop = 0;
      return;
    }
    const lastSpoken = words[target - 1];
    if (!lastSpoken || !bodyEl) return;

    // Auto-scroll the body so the currently-spoken word stays in view.
    // Applies on both desktop and mobile now that the desktop body is also a
    // scrollable flex slot. The 0.35 factor keeps the spoken word about a third
    // of the way down the visible area so the reader sees upcoming text below.
    const wordTop = lastSpoken.offsetTop;
    const targetScroll = Math.max(0, wordTop - bodyEl.clientHeight * 0.35);
    if (Math.abs(bodyEl.scrollTop - targetScroll) > 4) {
      bodyEl.scrollTop = targetScroll;
    }

    // Quill cursor — desktop only. On mobile the auto-scroll is the visual
    // pointer; on desktop the quill floats next to the spoken word.
    const isMobile = window.matchMedia('(max-width: 720px)').matches;
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
