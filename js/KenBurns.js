// Applies a Ken Burns (slow zoom/pan) animation to an image element.
// The CSS @keyframes rules (kb-zoom-in-center, kb-pan-left, etc.) live in css/style.css.

const VALID_MODES = new Set([
  'zoom-in-center',
  'zoom-in-left',
  'zoom-in-right',
  'zoom-out',
  'pan-left',
  'pan-right',
  'none',
]);

const DEFAULT_MODE = 'zoom-in-center';

export const KenBurns = {
  start(imgEl, mode, durationMs) {
    if (!imgEl) return;
    this.stop(imgEl);
    if (mode === 'none') return;

    let resolved = mode;
    if (!VALID_MODES.has(mode)) {
      console.warn(`KenBurns: unknown mode "${mode}", using "${DEFAULT_MODE}"`);
      resolved = DEFAULT_MODE;
    }
    const ms = (typeof durationMs === 'number' && durationMs > 0) ? durationMs : 8000;
    imgEl.style.animation = `kb-${resolved} ${ms}ms ease-out forwards`;
    imgEl.classList.add('kb-active');
  },

  stop(imgEl) {
    if (!imgEl) return;
    imgEl.style.animation = '';
    imgEl.classList.remove('kb-active');
  },
};
