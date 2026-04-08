// Builds the book DOM from a story object and initializes StPageFlip.
// Each story page becomes TWO book pages: an illustration page and a text page.
// This is the ONLY module that touches StPageFlip — isolates the library.

export function buildBook(story, containerEl, options = {}) {
  const layout = options.layout === 'portrait' ? 'portrait' : 'spread';
  containerEl.innerHTML = '';

  // Front cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover page-cover-front parchment-texture relative',
    image: story.cover.image,
    title: story.title,
  }));

  // Content: render either spread (illustration + text) or portrait (merged) per story page.
  story.pages.forEach((p, i) => {
    if (layout === 'portrait') {
      containerEl.appendChild(renderMergedPage({
        image: p.image,
        text: p.text,
        chapter: p.chapter,
        storyTitle: story.title,
        pageNumber: i + 1,
        storyIndex: i,
        plateLabel: p.plateLabel,
        illustrationTitle: p.illustrationTitle,
        paragraphImages: p.paragraphImages,
      }));
    } else {
      containerEl.appendChild(renderIllustrationPage({
        image: p.image,
        storyIndex: i,
        plateLabel: p.plateLabel,
        illustrationTitle: p.illustrationTitle,
        paragraphImages: p.paragraphImages,
      }));
      containerEl.appendChild(renderTextPage({
        text: p.text,
        chapter: p.chapter,
        storyTitle: story.title,
        pageNumber: i + 1,
        storyIndex: i,
      }));
    }
  });

  // Back cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover page-cover-back parchment-texture relative',
    image: story.backCover.image,
    title: 'The End',
  }));

  // StPageFlip notes:
  //
  // 1. Orientation auto-detect (in `size: 'stretch'` mode) uses the rule
  //    `containerWidth < 2 * minWidth` to decide portrait vs landscape.
  //    For the spread/desktop layout we want landscape, so minWidth must
  //    be smaller than half the desktop container width — 280 keeps the
  //    threshold (560) safely below typical desktop widths (≥800).
  //
  // 2. For the portrait layout we use a DYNAMIC config built from the
  //    actual book container dimensions:
  //
  //      - `width`/`height` are set to the container's clientWidth /
  //        clientHeight so the StPageFlip wrapper aspect matches the brown
  //        book frame exactly. With the static 500/640 default, the
  //        wrapper aspect (~0.78) didn't match the much taller mobile book
  //        frame (~0.51), and the wrapper got clamped to ~half the frame
  //        height — leaving big empty top/bottom gaps inside the frame.
  //      - `minWidth` is set to floor(containerWidth/2)+1 so the
  //        auto-detect's `containerWidth < 2*minWidth` always evaluates
  //        true for THIS container, regardless of phone width (Pixel-class
  //        phones have wider book frames than the 380-threshold static
  //        floor handled). The wrapper's CSS min-width (which equals
  //        config.minWidth in portrait mode) tracks the same value, so it
  //        never overflows the visible frame.
  //
  //    The dynamic config is recomputed on every `_rebuildBook` (which now
  //    fires on phone rotation too — see BookController's orientation
  //    listener), so rotating doesn't strand StPageFlip in a stale config.
  const isPortraitLayout = layout === 'portrait';
  const pageFlipOpts = {
    width: 500,
    height: 640,
    size: 'stretch',
    minWidth: 280,
    maxWidth: 900,
    minHeight: 220,
    maxHeight: 1152,
    // Disable page-flip shadow gradients so the parchment surface stays one solid
    // color. CSS in index.html also hides any leftover .stf__*Shadow nodes.
    maxShadowOpacity: 0,
    flippingTime: 1200,
    showCover: true,
    // Keep StPageFlip's default mobileScrollSupport (true). With this on:
    //   - touchstart inside a page does NOT call preventDefault, so the
    //     browser's native vertical scroll on .page-body works,
    //   - touchmove only triggers a page-flip drag when horizontal movement
    //     exceeds ~10px, so vertical swipes scroll the body without
    //     accidentally flipping the page.
    // Setting it to false (as the previous config did) blocked all touch
    // scrolling on phones — the body silently refused to scroll.
  };
  if (isPortraitLayout) {
    const cw = containerEl.clientWidth;
    const ch = containerEl.clientHeight;
    if (cw > 0 && ch > 0) {
      pageFlipOpts.width = cw;
      pageFlipOpts.height = ch;
      pageFlipOpts.minWidth = Math.max(60, Math.floor(cw / 2) + 1);
      pageFlipOpts.minHeight = Math.max(80, Math.floor(ch / 2) + 1);
    }
  }
  const pageFlip = new window.St.PageFlip(containerEl, pageFlipOpts);

  pageFlip.loadFromHTML(containerEl.querySelectorAll('.page'));

  return pageFlip;
}

// Helper: find the <img> for a given story index. Works in both spread (where
// the image lives on .page-illustration) and portrait merged (where the image
// lives on .page-merged) layouts via a union selector. On a paragraphImages
// slideshow page this returns the FIRST img — Ken Burns would normally start
// here but BookController skips it on slideshow pages, so the first-img match
// is just a sentinel for the "is there any image" check.
export function findIllustrationImg(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-illustration[data-story-index="${storyIndex}"] img.page-image, ` +
    `.page-merged[data-story-index="${storyIndex}"] img.page-image`
  );
}

// Helper: find the slideshow image stack for a given story index, or null if
// the page isn't a slideshow page. Returns the .page-image-stack container
// element which holds one .page-image per paragraph.
export function findImageStack(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-illustration[data-story-index="${storyIndex}"] .page-image-stack, ` +
    `.page-merged[data-story-index="${storyIndex}"] .page-image-stack`
  );
}

// Helper: find the element that hosts the page body + word spans for a given
// story index. In spread layout this is .page-text-page; in portrait merged
// layout it's .page-merged. The element exposes a .page-body child and .word
// spans in both cases, so word-sync logic doesn't need to branch.
export function findTextHost(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-text-page[data-story-index="${storyIndex}"], ` +
    `.page-merged[data-story-index="${storyIndex}"]`
  );
}

// No-op kept for API compatibility with BookController call sites.
// Earlier versions binary-searched font size to fit content into a fixed page
// height. The new design uses a fixed 18px desktop / 16px mobile font and lets
// the body scroll inside its flex slot when the text is longer than the page.
export function fitTextToPage(_textPageEl) {
  /* intentionally empty */
}

// ---------- internal helpers ----------

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeText(s).replace(/"/g, '&quot;');
}

// Render the inner image markup for an illustration / merged page.
//
// - For a normal page (single image), emits one <img class="page-image">.
// - For a slideshow page (paragraphImages), emits a .page-image-stack
//   wrapper containing one <img class="page-image"> per entry. The first
//   image is marked .visible (opacity 1) and the rest sit at opacity 0
//   with a CSS transition for the crossfade. BookController toggles which
//   one carries the .visible class as the spoken word advances.
//
// All images keep the same .page-image class so existing CSS rules
// (object-cover, grayscale/sepia tint, error fallback) apply uniformly.
function renderImageMarkup(image, paragraphImages) {
  if (Array.isArray(paragraphImages) && paragraphImages.length > 0) {
    const items = paragraphImages.map((src, i) => `
      <img class="page-image absolute inset-0 w-full h-full object-cover grayscale-[0.2] sepia-[0.2]${i === 0 ? ' visible' : ''}" src="${escapeAttr(src)}" data-paragraph-index="${i}" alt=""/>
    `).join('');
    return `<div class="page-image-stack absolute inset-0">${items}</div>`;
  }
  return `<img class="page-image w-full h-full object-cover grayscale-[0.2] sepia-[0.2]" src="${escapeAttr(image)}" alt=""/>`;
}

// Render the body of words for a text/merged page. Tags each .word span
// with `data-word-index` (used by word-sync highlighting) and
// `data-paragraph-index` (used by the slideshow image swap to find the
// current paragraph from the spoken word).
//
// `dropCapClass` is the per-layout class string for the drop-cap (the
// spread text page uses text-7xl, the merged page uses text-5xl).
// `paragraphClass` is the per-layout class for the regular <p> spacing
// (spread = mb-4, merged = mb-3) and `blockquoteClass` similarly.
function appendBody(body, text, dropCapClass, paragraphClass, blockquoteClass) {
  const paragraphs = (text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('');

  let globalWordIndex = 0;
  paragraphs.forEach((chunk, pi) => {
    const trimmed = chunk.trim();
    const isBlockquote = OPENING_QUOTE.test(trimmed) && CLOSING_QUOTE.test(trimmed);
    const p = document.createElement('p');
    p.className = isBlockquote ? blockquoteClass : paragraphClass;

    let remaining = chunk;
    if (pi === 0 && !isBlockquote && chunk.length > 0) {
      const firstChar = chunk[0];
      const dropCap = document.createElement('span');
      dropCap.className = `word drop-cap ${dropCapClass}`;
      dropCap.dataset.wordIndex = String(globalWordIndex++);
      dropCap.dataset.paragraphIndex = String(pi);
      dropCap.textContent = firstChar;
      p.appendChild(dropCap);
      remaining = chunk.slice(1);
    }

    const words = remaining.split(/\s+/).filter(Boolean);
    words.forEach((w, wi) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.dataset.wordIndex = String(globalWordIndex++);
      span.dataset.paragraphIndex = String(pi);
      span.textContent = w;
      p.appendChild(span);
      if (wi < words.length - 1) p.appendChild(document.createTextNode(' '));
    });

    body.appendChild(p);
  });
}

function renderCoverPage({ className, image, title }) {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = `
    <div class="absolute inset-6 border-[12px] border-double border-[#d87821]/40 rounded-sm pointer-events-none"></div>
    <div class="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="relative w-full h-full flex flex-col items-center justify-center p-12">
      <img class="page-image w-full max-h-[70%] object-cover grayscale-[0.2] sepia-[0.2] rounded-sm shadow-inner" src="${escapeAttr(image)}" alt=""/>
      ${title ? `<h1 class="font-headline text-5xl text-[#301400] italic mt-8 text-center drop-shadow-sm">${escapeText(title)}</h1>` : ''}
    </div>
  `;
  const img = el.querySelector('img.page-image');
  if (img) img.onerror = () => { img.style.display = 'none'; };
  return el;
}

function renderIllustrationPage({ image, storyIndex, plateLabel, illustrationTitle, paragraphImages }) {
  const el = document.createElement('div');
  el.className = 'page page-illustration parchment-texture relative flex items-center justify-center p-8 overflow-visible';
  el.dataset.storyIndex = String(storyIndex);
  el.innerHTML = `
    <div class="absolute inset-6 border-[12px] border-double border-[#d87821]/40 rounded-sm pointer-events-none"></div>
    <div class="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="relative w-full h-full rounded-sm overflow-hidden shadow-inner">
      ${renderImageMarkup(image, paragraphImages)}
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
      ${(plateLabel || illustrationTitle) ? `
      <div class="absolute bottom-6 left-6 right-6 pointer-events-none">
        ${plateLabel ? `<span class="font-label text-[10px] tracking-[0.3em] uppercase text-[#ffb782]/80 mb-1 block">Plate ${escapeText(plateLabel)}</span>` : ''}
        ${illustrationTitle ? `<h3 class="font-headline text-xl text-white italic drop-shadow-md">${escapeText(illustrationTitle)}</h3>` : ''}
      </div>` : ''}
    </div>
    <div class="absolute top-8 left-8 text-black/10 select-none pointer-events-none">
      <span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
    </div>
  `;
  el.querySelectorAll('img.page-image').forEach(img => {
    img.onerror = () => { img.style.display = 'none'; };
  });
  return el;
}

const OPENING_QUOTE = /^[\u201C"']/;
const CLOSING_QUOTE = /[\u201D"']$/;

function renderMergedPage({
  image,
  text,
  chapter,
  storyTitle,
  pageNumber,
  storyIndex,
  plateLabel,
  illustrationTitle,
  paragraphImages,
}) {
  // The .page element itself is owned by StPageFlip — its `display` is set
  // dynamically (block when visible, none when hidden). We mustn't put a
  // `display: flex` rule on it or override that with !important, or hidden
  // pages stay visible and overlap the cover. The flex layout that constrains
  // the body lives in an inner wrapper instead, positioned absolutely to fill
  // the page. The page is purely the StPageFlip mount.
  const el = document.createElement('div');
  el.className = 'page page-merged parchment-texture relative overflow-hidden';
  el.dataset.storyIndex = String(storyIndex);

  // Inner wrapper: flex column, fills the page minus padding. Owns the
  // image / chapter / body / footer flex layout. Independent of .page's display.
  const inner = document.createElement('div');
  inner.className = 'page-merged-inner absolute inset-0 flex flex-col p-6 md:p-10';
  el.appendChild(inner);

  // ---- Image area (~38% of inner height, fixed) ----
  const imgWrap = document.createElement('div');
  imgWrap.className = 'page-merged-image relative w-full rounded-sm overflow-hidden shadow-inner flex-shrink-0 mb-4';
  imgWrap.style.height = '38%';
  imgWrap.innerHTML = `
    ${renderImageMarkup(image, paragraphImages)}
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
    ${(plateLabel || illustrationTitle) ? `
    <div class="absolute bottom-3 left-4 right-4 pointer-events-none">
      ${plateLabel ? `<span class="font-label text-[9px] tracking-[0.3em] uppercase text-[#ffb782]/80 mb-0.5 block">Plate ${escapeText(plateLabel)}</span>` : ''}
      ${illustrationTitle ? `<h3 class="font-headline text-base text-white italic drop-shadow-md">${escapeText(illustrationTitle)}</h3>` : ''}
    </div>` : ''}
  `;
  imgWrap.querySelectorAll('img.page-image').forEach(img => {
    img.onerror = () => { img.style.display = 'none'; };
  });
  inner.appendChild(imgWrap);

  // ---- Chapter heading (optional) ----
  if (chapter) {
    const header = document.createElement('div');
    header.className = 'mb-3 relative z-10 flex-shrink-0';
    header.innerHTML = `
      <h2 class="font-headline text-2xl text-[#301400] leading-tight mb-1">${escapeText(chapter)}</h2>
      <div class="h-px w-20 bg-[#d87821]/40"></div>
    `;
    inner.appendChild(header);
  }

  // ---- Body (scrollable) ----
  // The class `page-body` is the same selector word-sync uses on the spread
  // text page, so the existing BookController._onAudioTime auto-scroll works
  // unmodified.
  const body = document.createElement('div');
  body.className = 'page-body flex-1 min-h-0 max-w-none text-[#3d2313] text-[16px] font-body leading-relaxed text-justify overflow-y-auto custom-scrollbar pr-2 relative z-10';
  appendBody(
    body,
    text,
    'float-left text-5xl font-headline text-[#d87821] mr-2 mt-1 mb-[-0.4rem] leading-[1] drop-shadow-sm select-none',
    'mb-3 relative',
    'italic opacity-80 border-l-2 border-[#d87821]/30 pl-4 py-2 my-4'
  );
  inner.appendChild(body);

  // ---- Footer ----
  const footer = document.createElement('div');
  footer.className = 'mt-auto pt-3 flex justify-center border-t border-black/5 relative z-10 flex-shrink-0';
  footer.innerHTML = `<span class="font-label text-[9px] tracking-widest text-[#3d2313]/60 uppercase">Page ${pageNumber} — ${escapeText(storyTitle)}</span>`;
  inner.appendChild(footer);

  return el;
}

function renderTextPage({ text, chapter, storyTitle, pageNumber, storyIndex }) {
  // The .page element itself is owned by StPageFlip — its `display` is set
  // dynamically (block when visible, none when hidden). We mustn't put a
  // `display: flex` rule on it or override that with !important, or hidden
  // text pages stay visible and overlap the cover. The flex layout that
  // constrains the body lives in an inner wrapper instead, positioned
  // absolutely to fill the page. The page is purely the StPageFlip mount.
  const el = document.createElement('div');
  el.className = 'page page-text-page parchment-texture relative overflow-hidden';
  el.dataset.storyIndex = String(storyIndex);

  // Inner wrapper: flex column, fills the page minus padding. Owns the
  // header / body / footer flex layout. Independent of the .page's display.
  const inner = document.createElement('div');
  inner.className = 'page-text-inner absolute inset-0 flex flex-col p-10 md:p-16';
  el.appendChild(inner);

  // Chapter header
  if (chapter) {
    const header = document.createElement('div');
    header.className = 'mb-6 relative z-10';
    header.innerHTML = `
      <h2 class="font-headline text-3xl md:text-4xl text-[#301400] leading-tight mb-2">${escapeText(chapter)}</h2>
      <div class="h-px w-24 bg-[#d87821]/40"></div>
    `;
    inner.appendChild(header);
  }

  // Body — flex-1 with min-h-0 so it actually shrinks to fit the available
  // inner height, then scrolls if the text is longer than the page can hold.
  // Without min-h-0 the flex item grows to its content size and overflows.
  // The drop-cap class also carries the `word` class via appendBody — that
  // dual-class trick lets the drop-cap participate in word-sync highlighting
  // and stay in lockstep with the rest of the first word during reveal.
  const body = document.createElement('div');
  body.className = 'page-body flex-1 min-h-0 max-w-none text-[#3d2313] text-[18px] font-body leading-relaxed text-justify overflow-y-auto custom-scrollbar pr-3 relative z-10';
  appendBody(
    body,
    text,
    'float-left text-7xl font-headline text-[#d87821] mr-3 mt-2 mb-[-0.5rem] leading-[1] drop-shadow-sm select-none',
    'mb-4 relative',
    'italic opacity-80 border-l-2 border-[#d87821]/30 pl-4 py-2 my-6'
  );
  inner.appendChild(body);

  // Page footer (lives inside the inner flex column)
  const footer = document.createElement('div');
  footer.className = 'mt-auto pt-6 flex justify-center border-t border-black/5 relative z-10';
  footer.innerHTML = `<span class="font-label text-[10px] tracking-widest text-[#3d2313]/60 uppercase">Page ${pageNumber} — ${escapeText(storyTitle)}</span>`;
  inner.appendChild(footer);

  // Quill cursor — positioned absolutely against .page-text-page (NOT inner)
  // because BookController._onAudioTime computes its coordinates from the
  // page-text-page element. Rendered as a Material Symbol so CSS `color` is
  // honored — the previous fountain-pen emoji rendered as colored emoji on
  // every platform we tested and ignored the dark color we wanted.
  const quill = document.createElement('span');
  quill.className = 'quill material-symbols-outlined';
  quill.style.fontVariationSettings = "'FILL' 1";
  quill.textContent = 'draw';
  el.appendChild(quill);

  return el;
}
