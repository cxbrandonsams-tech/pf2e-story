// Orchestrates the book: audio/timer → advance full spread; flip → load new spread's
// audio, Ken Burns, and text reveal.

import { KenBurns } from './KenBurns.js';
import { findIllustrationImg, findTextHost, fitTextToPage } from './buildBook.js';

const MOBILE_ILLUSTRATION_HOLD_MS = 1500;

export class BookController {
  constructor({ story, pageFlip, audio, bookEl }) {
    this.story = story;
    this.pageFlip = pageFlip;
    this.audio = audio;
    this.bookEl = bookEl;
    this._currentLayout = this._isPortraitMobile() ? 'portrait' : 'spread';
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
        // Mobile portrait: pause briefly on the illustration page, then auto-flip to the text page.
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

  _isPortraitMode() {
    return window.matchMedia('(max-width: 720px)').matches;
  }

  _isPortraitMobile() {
    return window.matchMedia('(orientation: portrait) and (max-width: 720px)').matches;
  }

  // A book page is an "illustration page" if its book index is odd AND in content range.
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
