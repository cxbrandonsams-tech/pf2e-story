// Builds the book DOM from a story object and initializes StPageFlip.
// Each story page becomes TWO book pages: an illustration page and a text page.
// This is the ONLY module that touches StPageFlip — isolates the library.

export function buildBook(story, containerEl) {
  containerEl.innerHTML = '';

  // Front cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover page-cover-front parchment-texture relative',
    image: story.cover.image,
    title: story.title,
  }));

  // Content: for each story page, render an illustration page then a text page.
  story.pages.forEach((p, i) => {
    containerEl.appendChild(renderIllustrationPage({
      image: p.image,
      storyIndex: i,
      plateLabel: p.plateLabel,
      illustrationTitle: p.illustrationTitle,
    }));
    containerEl.appendChild(renderTextPage({
      text: p.text,
      chapter: p.chapter,
      storyTitle: story.title,
      pageNumber: i + 1,
      storyIndex: i,
    }));
  });

  // Back cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover page-cover-back parchment-texture relative',
    image: story.backCover.image,
    title: 'The End',
  }));

  const pageFlip = new window.St.PageFlip(containerEl, {
    width: 500,
    height: 640,
    size: 'stretch',
    minWidth: 280,
    maxWidth: 900,
    minHeight: 360,
    maxHeight: 1152,
    maxShadowOpacity: 0.75,
    flippingTime: 1200,
    showCover: true,
    // omit usePortrait so StPageFlip auto-switches to single-page on narrow viewports
    mobileScrollSupport: false,
  });

  pageFlip.loadFromHTML(containerEl.querySelectorAll('.page'));

  return pageFlip;
}

// Helper: find the <img> inside the illustration page for a given story index.
export function findIllustrationImg(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-illustration[data-story-index="${storyIndex}"] img.page-image`
  );
}

// Helper: find the text page element for a given story index.
export function findTextPage(containerEl, storyIndex) {
  return containerEl.querySelector(
    `.page-text-page[data-story-index="${storyIndex}"]`
  );
}

// Fits body text to the available page height by binary-searching font size.
// Call after the page is in the DOM and fonts are loaded.
export function fitTextToPage(textPageEl, maxPx = 22, minPx = 10) {
  if (!textPageEl) return;
  const body = textPageEl.querySelector('.page-body');
  if (!body) return;
  let lo = minPx, hi = maxPx, best = minPx;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    body.style.fontSize = mid + 'px';
    if (body.scrollHeight <= body.clientHeight + 1) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  body.style.fontSize = best + 'px';
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

function renderIllustrationPage({ image, storyIndex, plateLabel, illustrationTitle }) {
  const el = document.createElement('div');
  el.className = 'page page-illustration parchment-texture relative flex items-center justify-center p-8 overflow-visible';
  el.dataset.storyIndex = String(storyIndex);
  el.innerHTML = `
    <div class="absolute inset-6 border-[12px] border-double border-[#d87821]/40 rounded-sm pointer-events-none"></div>
    <div class="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#ffb782] m-4 pointer-events-none"></div>
    <div class="relative w-full h-full rounded-sm overflow-hidden shadow-inner">
      <img class="page-image w-full h-full object-cover grayscale-[0.2] sepia-[0.2]" src="${escapeAttr(image)}" alt=""/>
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
  const img = el.querySelector('img.page-image');
  if (img) img.onerror = () => { img.style.display = 'none'; };
  return el;
}

const OPENING_QUOTE = /^[\u201C"']/;
const CLOSING_QUOTE = /[\u201D"']$/;

function renderTextPage({ text, chapter, storyTitle, pageNumber, storyIndex }) {
  const el = document.createElement('div');
  el.className = 'page page-text-page parchment-texture relative p-10 md:p-16 flex flex-col overflow-hidden custom-scrollbar';
  el.dataset.storyIndex = String(storyIndex);

  // Chapter header
  if (chapter) {
    const header = document.createElement('div');
    header.className = 'mb-6 relative z-10';
    header.innerHTML = `
      <h2 class="font-headline text-3xl md:text-4xl text-[#301400] leading-tight mb-2">${escapeText(chapter)}</h2>
      <div class="h-px w-24 bg-[#d87821]/40"></div>
    `;
    el.appendChild(header);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'page-body flex-1 max-w-none text-[#3d2313] font-body leading-relaxed text-justify overflow-hidden relative z-10';

  const paragraphs = (text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('');

  let globalWordIndex = 0;
  paragraphs.forEach((chunk, pi) => {
    const trimmed = chunk.trim();
    const isBlockquote = OPENING_QUOTE.test(trimmed) && CLOSING_QUOTE.test(trimmed);
    const p = document.createElement('p');
    p.className = isBlockquote
      ? 'italic opacity-80 border-l-2 border-[#d87821]/30 pl-4 py-2 my-6'
      : 'mb-4 relative';

    // Drop-cap: first character of the first non-blockquote paragraph of the page.
    // The drop-cap span carries the `word` class so it participates in word-sync
    // highlighting — otherwise it would stay bright while adjacent words sit dim,
    // producing a visible "I" / "n" seam in the first rendered word.
    let remaining = chunk;
    if (pi === 0 && !isBlockquote && chunk.length > 0) {
      const firstChar = chunk[0];
      const dropCap = document.createElement('span');
      dropCap.className = 'word drop-cap float-left text-7xl font-headline text-[#d87821] mr-3 mt-2 mb-[-0.5rem] leading-[1] drop-shadow-sm select-none';
      dropCap.dataset.wordIndex = String(globalWordIndex++);
      dropCap.textContent = firstChar;
      p.appendChild(dropCap);
      remaining = chunk.slice(1);
    }

    const words = remaining.split(/\s+/).filter(Boolean);
    words.forEach((w, wi) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.dataset.wordIndex = String(globalWordIndex++);
      span.textContent = w;
      p.appendChild(span);
      if (wi < words.length - 1) p.appendChild(document.createTextNode(' '));
    });

    body.appendChild(p);
  });
  el.appendChild(body);

  // Quill cursor — follows the current spoken word while audio plays.
  const quill = document.createElement('div');
  quill.className = 'quill';
  quill.textContent = '\u{1F58B}'; // fountain pen
  el.appendChild(quill);

  // Page footer
  const footer = document.createElement('div');
  footer.className = 'mt-auto pt-6 flex justify-center border-t border-black/5 relative z-10';
  footer.innerHTML = `<span class="font-label text-[10px] tracking-widest text-[#3d2313]/60 uppercase">Page ${pageNumber} — ${escapeText(storyTitle)}</span>`;
  el.appendChild(footer);

  // Rune corner decoration
  const rune = document.createElement('div');
  rune.className = 'absolute bottom-8 right-8 text-black/10 select-none pointer-events-none';
  rune.innerHTML = `<span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1;">storm</span>`;
  el.appendChild(rune);

  return el;
}
