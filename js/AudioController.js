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
