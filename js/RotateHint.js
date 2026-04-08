// Quiet top-toast hint shown when the app is on a phone in portrait.
// Suggests rotating for the full-spread experience.
//
// Behaviors:
//   - Shows on initial portrait load AND when the user rotates *into* portrait
//     while the app is running (the BookController rebuilds the book on the
//     same matchMedia event).
//   - Auto-fade after 6s, taps on the toast body, and rotating away mid-show
//     are all "soft" dismissals: they don't write to localStorage, so the next
//     rotation back into portrait re-shows the hint. This nudges users who
//     missed it the first time without nagging users who actively rejected it.
//   - Only the explicit × close button persists dismissal across sessions.
//   - Re-entrant safe: a redundant matchMedia change while the toast is up is
//     a no-op. Click handlers are wired exactly once for the lifetime of the
//     module so rotations don't leak listeners onto the toast element.

const STORAGE_KEY = 'otari.rotateHintDismissed';
const AUTO_FADE_MS = 6000;
const FADE_OUT_MS = 280;

// `visible` is the only re-entry guard. It's true while a toast is currently
// shown OR fading out, and prevents a redundant matchMedia change event from
// stacking a second toast on top.
let visible = false;
let fadeTimer = null;
let hideTimer = null;
let listenersAttached = false;

function isPortraitMobile() {
  return window.matchMedia('(orientation: portrait) and (max-width: 720px)').matches;
}

function permanentlyDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {
    // localStorage unavailable (private mode, etc.) — treat as dismissed so
    // we don't nag in environments where we can't remember the dismissal.
    return true;
  }
}

function persistDismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch (_) { /* ignore */ }
}

// Soft hide: clears any pending fade timer, plays the fade-out animation,
// then marks visible=false so a future portrait rotation can re-show it.
// Does NOT touch localStorage.
function hideForNow(el) {
  if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  el.style.opacity = '0';
  hideTimer = setTimeout(() => {
    el.hidden = true;
    visible = false;
    hideTimer = null;
  }, FADE_OUT_MS);
}

function ensureListenersAttached(el) {
  if (listenersAttached) return;
  listenersAttached = true;

  // Tapping the toast body acknowledges it for now (soft dismiss).
  el.addEventListener('click', () => {
    if (!visible) return;
    hideForNow(el);
  });

  // Only the × close button persists dismissal across sessions.
  const closeBtn = el.querySelector('#rotate-hint-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!visible) return;
      persistDismiss();
      hideForNow(el);
    });
  }
}

function showHintIfApplicable() {
  if (visible) return;
  if (!isPortraitMobile()) return;
  if (permanentlyDismissed()) return;

  const el = document.getElementById('rotate-hint');
  if (!el) return;

  ensureListenersAttached(el);

  visible = true;

  // Reveal
  el.hidden = false;
  // Force a layout flush so the opacity transition fires from 0 to 1.
  void el.offsetWidth;
  el.style.opacity = '1';

  // Auto-fade after 6s — soft dismiss, not persisted, not blocking future
  // portrait rotations.
  if (fadeTimer) clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => hideForNow(el), AUTO_FADE_MS);
}

export function installRotateHint() {
  // Initial check on load.
  showHintIfApplicable();

  // Re-check on every transition into portrait. The BookController listens
  // to the same media query to rebuild the book, so the hint reappears in
  // sync with the layout swap. We don't tear this listener down — the
  // installer is called exactly once during app bootstrap.
  const mq = window.matchMedia('(orientation: portrait) and (max-width: 720px)');
  const onChange = (e) => {
    if (e.matches) showHintIfApplicable();
  };
  if (mq.addEventListener) {
    mq.addEventListener('change', onChange);
  } else if (mq.addListener) {
    // Safari < 14 fallback
    mq.addListener(onChange);
  }
}
