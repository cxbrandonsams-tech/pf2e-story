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
    this.pageFlip.flipNext();
    const targetBookIdx = this.pageFlip.getCurrentPageIndex() + 1;
    setTimeout(() => this.pageFlip.flip(targetBookIdx), 50);
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
