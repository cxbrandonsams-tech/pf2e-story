import { loadStory } from './loadStory.js';

loadStory()
  .then(story => {
    console.log('Loaded story:', story);
  })
  .catch(err => {
    console.error('Failed to load story:', err);
  });
