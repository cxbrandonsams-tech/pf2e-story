// Builds the book DOM from a story object and initializes StPageFlip.
// This is the ONLY module that touches StPageFlip — isolates the library.

export function buildBook(story, containerEl) {
  containerEl.innerHTML = '';

  // Cover
  containerEl.appendChild(renderPage({
    className: 'page page-cover',
    image: story.cover.image,
    text: story.title,
  }));

  // Content pages
  story.pages.forEach((p, i) => {
    containerEl.appendChild(renderPage({
      className: 'page',
      image: p.image,
      text: p.text,
      index: i,
    }));
  });

  // Back cover
  containerEl.appendChild(renderPage({
    className: 'page page-cover page-cover-back',
    image: story.backCover.image,
    text: '',
  }));

  const pageFlip = new window.St.PageFlip(containerEl, {
    width: 550,
    height: 700,
    size: 'stretch',
    minWidth: 315,
    maxWidth: 1000,
    minHeight: 400,
    maxHeight: 1350,
    maxShadowOpacity: 0.5,
    showCover: true,
    mobileScrollSupport: false,
  });

  pageFlip.loadFromHTML(containerEl.querySelectorAll('.page'));

  return pageFlip;
}

function renderPage({ className, image, text, index }) {
  const el = document.createElement('div');
  el.className = className;
  if (index !== undefined) el.dataset.pageIndex = String(index);

  const img = document.createElement('img');
  img.className = 'page-image';
  img.src = image;
  img.alt = '';
  img.onerror = () => { img.style.display = 'none'; };
  el.appendChild(img);

  if (text) {
    const caption = document.createElement('div');
    caption.className = 'page-text';
    caption.textContent = text;
    el.appendChild(caption);
  }

  return el;
}
