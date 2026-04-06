// Orchestrates the book: audio/timer → advance full spread; flip → load new spread's
// audio, Ken Burns, text reveal; trigger SFX on every flip; start music on first play.

import { KenBurns } from './KenBurns.js';
import { findIllustrationImg, findTextPage, fitTextToPage } from './buildBook.js';

const IDLE_HINT_DELAY_MS = 3000;
const MOBILE_ILLUSTRATION_HOLD_MS = 1500;

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

    this.audio.onTimeUpdate = (t, d) => this._onAudioTime(t, d);

    this.pageFlip.on('flip', () => {
      if (this.sfx) this.sfx.playFlip();
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
      this._resetIdleHint();
      if (this.onChange) this.onChange();
    });

    this._loadCurrentPage();
    this._applyKenBurnsForCurrent();
    // Fit text on all pages once fonts are ready, and re-fit on resize/orientation.
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
    this._scheduleIdleHint();
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
      // Desktop spread mode: second flip to land on the next spread's left page.
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

    // Auto-scroll mobile body so the currently-spoken word stays in view.
    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    if (isMobile) {
      const wordTop = lastSpoken.offsetTop;
      const target = Math.max(0, wordTop - bodyEl.clientHeight * 0.35);
      if (Math.abs(bodyEl.scrollTop - target) > 4) {
        bodyEl.scrollTop = target;
      }
    }

    // Quill cursor (desktop mostly — on mobile the scroll does the job)
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

  play() {
    this.isPlaying = true;
    if (this.music) this.music.start();
    // If on the cover, flip open to the first spread — the flip handler
    // will then auto-start the page's narration because isPlaying is true.
    if (this.pageFlip.getCurrentPageIndex() === 0) {
      this.pageFlip.flipNext();
      if (this.onChange) this.onChange();
      return;
    }
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
