import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';

const bookEl = document.getElementById('book');

loadStory()
  .then(story => {
    const pageFlip = buildBook(story, bookEl);
    console.log('Book built, total pages:', pageFlip.getPageCount());
  })
  .catch(err => {
    console.error(err);
    bookEl.textContent = `Error: ${err.message}`;
  });
