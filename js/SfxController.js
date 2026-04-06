// Plays one-shot sound effects (currently just the page-flip).
// Uses cloned <audio> nodes so rapid overlapping flips all play.

const SFX_VOLUME = 0.5;
const DUCK_MS = 400;

export class SfxController {
  constructor({ flipUrl, narration }) {
    this.flipUrl = flipUrl;
    this.narration = narration; // AudioController (for ducking), may be null
    this._template = new Audio(flipUrl);
    this._template.preload = 'auto';
    this._template.volume = SFX_VOLUME;
    this._template.addEventListener('error', () => {
      console.warn(`SfxController: failed to load ${flipUrl}`);
    });
  }

  playFlip() {
    try {
      const node = this._template.cloneNode();
      node.volume = SFX_VOLUME;
      node.play().catch(err => console.warn('SFX play failed:', err));
      if (this.narration) this.narration.duck(DUCK_MS);
    } catch (err) {
      console.warn('SFX clone/play error:', err);
    }
  }
}
