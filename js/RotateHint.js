// Quiet top-toast hint shown the first time the app loads on a phone in
// portrait. Suggests the user rotate for the full-spread experience.
// Dismissed permanently (per device) on the first interaction or after the
// auto-fade timer.

const STORAGE_KEY = 'otari.rotateHintDismissed';
const AUTO_FADE_MS = 6000;
const FADE_OUT_MS = 280;

function isPortraitMobile() {
  return window.matchMedia('(orientation: portrait) and (max-width: 720px)').matches;
}

function alreadyDismissed() {
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

export function installRotateHint() {
  if (!isPortraitMobile()) return;
  if (alreadyDismissed()) return;

  const el = document.getElementById('rotate-hint');
  if (!el) return;

  let fadeTimer = null;
  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    el.style.opacity = '0';
    setTimeout(() => { el.hidden = true; }, FADE_OUT_MS);
    persistDismiss();
  }

  // Reveal
  el.hidden = false;
  // Force a layout flush so the opacity transition fires from 0 to 1.
  void el.offsetWidth;
  el.style.opacity = '1';

  // Auto-fade after 6s.
  fadeTimer = setTimeout(dismiss, AUTO_FADE_MS);

  // Dismiss on tap of the toast or its close button.
  el.addEventListener('click', dismiss);
  const closeBtn = el.querySelector('#rotate-hint-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });
  }
}
