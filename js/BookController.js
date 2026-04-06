// Orchestrates the book: audio 'ended' OR durationMs timer → flip next.
// Flip → load new page's audio/timer and continue if still playing.
// Tracks "isPlaying" intent so manual flips during playback resume on the new page.

export class BookController {
  constructor({ story, pageFlip, audio }) {
    this.story = story;
    this.pageFlip = pageFlip;
    this.audio = audio;
    this.isPlaying = false;
    this.onChange = null;      // fired on any state change
    this._timerId = null;

    // Audio finished → advance (if still playing)
    this.audio.onEnded = () => {
      if (!this.isPlaying) return;
      this._advanceOrStop();
    };

    // Flip complete → load new page, continue playback if playing
    this.pageFlip.on('flip', () => {
      this._clearTimer();
      this.audio.reset();
      this._loadCurrentPage();
      if (this.isPlaying) {
        this._playCurrentPage();
      }
      if (this.onChange) this.onChange();
    });

    this._loadCurrentPage();
  }

  // Maps StPageFlip index → story.pages index. Returns -1 for cover/back cover.
  currentStoryPageIndex() {
    const bookIdx = this.pageFlip.getCurrentPageIndex();
    const storyIdx = bookIdx - 1;
    if (storyIdx < 0 || storyIdx >= this.story.pages.length) return -1;
    return storyIdx;
  }

  _loadCurrentPage() {
    const idx = this.currentStoryPageIndex();
    if (idx < 0) {
      this.audio.load(null);
      return;
    }
    this.audio.load(this.story.pages[idx].audio || null);
  }

  _currentPageDurationMs() {
    const idx = this.currentStoryPageIndex();
    if (idx < 0) return null;
    const d = this.story.pages[idx].durationMs;
    return typeof d === 'number' && d > 0 ? d : null;
  }

  _currentPageHasAudio() {
    const idx = this.currentStoryPageIndex();
    if (idx < 0) return false;
    return !!this.story.pages[idx].audio;
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
    // No audio and no durationMs — cannot auto-advance. Pause.
    this.pause();
  }

  _advanceOrStop() {
    const bookIdx = this.pageFlip.getCurrentPageIndex();
    const lastContentIdx = this.story.pages.length; // last content page's book index
    if (bookIdx >= lastContentIdx) {
      this.pause();
      return;
    }
    this.pageFlip.flipNext();
  }

  _clearTimer() {
    if (this._timerId != null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  play() {
    this.isPlaying = true;
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
  jumpTo(bookIndex) { this.pageFlip.flip(bookIndex); }

  restart() {
    this.pause();
    this.audio.reset();
    this.pageFlip.flip(0);
  }

  get currentPageNumber() { return this.pageFlip.getCurrentPageIndex() + 1; }
  get totalPages() { return this.pageFlip.getPageCount(); }
}
