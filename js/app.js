import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';
import { AudioController } from './AudioController.js';
import { BookController } from './BookController.js';
import { UIController } from './UIController.js';

const bookEl = document.getElementById('book');
const audioEl = document.getElementById('narration');

loadStory()
  .then(story => {
    const pageFlip = buildBook(story, bookEl);
    const audio = new AudioController(audioEl);
    const book = new BookController({ story, pageFlip, audio });
    new UIController({ book, audio });
  })
  .catch(err => {
    console.error(err);
    bookEl.textContent = `Error: ${err.message}`;
  });
