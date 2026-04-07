import { loadStory } from './loadStory.js';
import { buildBook } from './buildBook.js';
import { AudioController } from './AudioController.js';
import { BookController } from './BookController.js';
import { UIController } from './UIController.js';

const bookEl = document.getElementById('book');
const audioEl = document.getElementById('narration');

function showError(message) {
  bookEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'error-screen';
  const p = document.createElement('p');
  p.textContent = message;
  const btn = document.createElement('button');
  btn.textContent = 'Reload';
  btn.addEventListener('click', () => location.reload());
  div.appendChild(p);
  div.appendChild(btn);
  bookEl.appendChild(div);
}

function showToast(message, ms = 2500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

if (!window.St || !window.St.PageFlip) {
  showError('Page-flip library failed to load. Check your internet connection.');
} else {
  loadStory()
    .then(story => {
      const titleEl = document.getElementById('story-title');
      if (titleEl) titleEl.textContent = story.title;
      document.title = story.title;

      const pageFlip = buildBook(story, bookEl);
      const audio = new AudioController(audioEl);
      const book = new BookController({ story, pageFlip, audio, bookEl });

      const prevOnMissing = audio.onMissing;
      audio.onMissing = () => {
        if (prevOnMissing) prevOnMissing();
        showToast('No audio for this page — click Next to continue');
      };

      new UIController({ book, audio });
    })
    .catch(err => {
      console.error(err);
      showError(`Failed to load story: ${err.message}`);
    });
}
