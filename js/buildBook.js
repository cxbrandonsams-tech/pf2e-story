// Builds the book DOM from a story object and initializes StPageFlip.
// Each story page becomes TWO book pages: an illustration page and a text page.
// This is the ONLY module that touches StPageFlip — isolates the library.

export function buildBook(story, containerEl) {
  containerEl.innerHTML = '';

  // Front cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover',
    image: story.cover.image,
    title: story.title,
  }));

  // Content: for each story page, render an illustration page then a text page.
  story.pages.forEach((p, i) => {
    containerEl.appendChild(renderIllustrationPage({
      image: p.image,
      storyIndex: i,
    }));
    containerEl.appendChild(renderTextPage({
      text: p.text,
      author: story.author,
      pageNumber: i + 1,
      storyIndex: i,
    }));
  });

  // Back cover
  containerEl.appendChild(renderCoverPage({
    className: 'page page-cover page-cover-back',
    image: story.backCover.image,
    title: '',
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

function renderCoverPage({ className, image, title }) {
  const el = document.createElement('div');
  el.className = className;
  const img = document.createElement('img');
  img.className = 'page-image';
  img.src = image;
  img.alt = '';
  img.onerror = () => { img.style.display = 'none'; };
  el.appendChild(img);
  if (title) {
    const h = document.createElement('div');
    h.className = 'cover-title';
    h.textContent = title;
    el.appendChild(h);
  }
  return el;
}

function renderIllustrationPage({ image, storyIndex }) {
  const el = document.createElement('div');
  el.className = 'page page-illustration';
  el.dataset.storyIndex = String(storyIndex);
  const img = document.createElement('img');
  img.className = 'page-image';
  img.src = image;
  img.alt = '';
  img.onerror = () => { img.style.display = 'none'; };
  el.appendChild(img);
  return el;
}

function renderTextPage({ text, author, pageNumber, storyIndex }) {
  const el = document.createElement('div');
  el.className = 'page page-text-page';
  el.dataset.storyIndex = String(storyIndex);

  if (author) {
    const authorEl = document.createElement('div');
    authorEl.className = 'page-author';
    authorEl.textContent = author;
    el.appendChild(authorEl);
  }

  const body = document.createElement('div');
  body.className = 'page-body';
  const paragraphs = (text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('');

  let globalWordIndex = 0;
  paragraphs.forEach((chunk, pi) => {
    const para = document.createElement('p');
    para.className = 'page-paragraph';
    if (pi === 0) para.classList.add('page-paragraph-first');
    const words = chunk.split(/\s+/).filter(Boolean);
    words.forEach((w, wi) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.dataset.wordIndex = String(globalWordIndex++);
      span.textContent = w;
      para.appendChild(span);
      if (wi < words.length - 1) para.appendChild(document.createTextNode(' '));
    });
    body.appendChild(para);
  });
  el.appendChild(body);

  // Quill cursor — follows the current spoken word while audio plays.
  const quill = document.createElement('div');
  quill.className = 'quill';
  quill.textContent = '\u{1F58B}'; // 🖋 fountain pen
  el.appendChild(quill);

  const num = document.createElement('div');
  num.className = 'page-number';
  num.textContent = String(pageNumber);
  el.appendChild(num);

  return el;
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
