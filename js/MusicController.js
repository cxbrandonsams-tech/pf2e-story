// Loops ambient background music. Autoplay requires a prior user interaction,
// so `start()` should be called from a click/keydown handler.

export class MusicController {
  constructor({ audioEl, src, defaultVolume = 0.2 }) {
    this.el = audioEl;
    this.src = src;
    this.defaultVolume = defaultVolume;
    this.isMuted = false;
    this._started = false;

    if (src) {
      this.el.src = src;
      this.el.loop = true;
      this.el.volume = defaultVolume;
      this.el.addEventListener('error', () => {
        console.warn(`MusicController: failed to load ${src}`);
      });
    }
  }

  get hasSource() { return !!this.src; }

  async start() {
    if (!this.hasSource || this._started) return;
    try {
      await this.el.play();
      this._started = true;
    } catch (err) {
      console.warn('Music autoplay blocked — will retry on next interaction:', err);
    }
  }

  mute() {
    this.isMuted = true;
    this.el.muted = true;
  }

  unmute() {
    this.isMuted = false;
    this.el.muted = false;
  }

  toggleMute() {
    if (this.isMuted) this.unmute();
    else this.mute();
  }

  setVolume(v) {
    const clamped = Math.max(0, Math.min(1, v));
    this.el.volume = clamped;
  }
}
