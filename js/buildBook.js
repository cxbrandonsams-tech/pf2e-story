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
    width: 550,
    height: 733,
    size: 'stretch',
    minWidth: 315,
    maxWidth: 1000,
    minHeight: 420,
    maxHeight: 1400,
    maxShadowOpacity: 0.7,
    flippingTime: 1400,
    showCover: true,
    usePortrait: false,
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
  const para = document.createElement('p');
  para.className = 'page-paragraph';
  para.textContent = text || '';
  body.appendChild(para);
  el.appendChild(body);

  const num = document.createElement('div');
  num.className = 'page-number';
  num.textContent = String(pageNumber);
  el.appendChild(num);

  return el;
}
