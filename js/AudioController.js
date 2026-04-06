// Wraps a single <audio> element. Loads per-page audio, plays/pauses,
// exposes volume/rate, emits 'ended', and supports brief "ducking" for SFX.

export class AudioController {
  constructor(audioEl) {
    this.el = audioEl;
    this.onEnded = null;
    this.onMissing = null;
    this.currentSrc = null;
    this._baseVolume = 1.0;
    this._duckTimer = null;

    this.el.addEventListener('ended', () => {
      if (this.onEnded) this.onEnded();
    });
  }

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

  pause() { this.el.pause(); }
  get isPaused() { return this.el.paused; }

  setVolume(v) {
    const clamped = Math.max(0, Math.min(1, v));
    this._baseVolume = clamped;
    this.el.volume = clamped;
  }

  setRate(r) { this.el.playbackRate = r; }

  reset() {
    this.el.pause();
    this.el.currentTime = 0;
  }

  // Temporarily drop volume to 50% of base for `ms` ms, then restore.
  duck(ms = 400) {
    if (this._duckTimer != null) clearTimeout(this._duckTimer);
    this.el.volume = this._baseVolume * 0.5;
    this._duckTimer = setTimeout(() => {
      this.el.volume = this._baseVolume;
      this._duckTimer = null;
    }, ms);
  }
}
