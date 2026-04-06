// Fetches and validates story.json.
// Throws a descriptive Error on any failure; caller should show the error screen.

export async function loadStory(url = 'story.json') {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Could not fetch ${url}: ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }
  let story;
  try {
    story = await response.json();
  } catch (err) {
    throw new Error(`Invalid JSON in ${url}: ${err.message}`);
  }
  validate(story);
  return story;
}

function validate(story) {
  if (!story || typeof story !== 'object') {
    throw new Error('story.json must be an object');
  }
  if (!Array.isArray(story.pages) || story.pages.length === 0) {
    throw new Error('story.json must have a non-empty "pages" array');
  }
  if (!story.cover || !story.cover.image) {
    throw new Error('story.json must have cover.image');
  }
  if (!story.backCover || !story.backCover.image) {
    throw new Error('story.json must have backCover.image');
  }
  story.pages.forEach((p, i) => {
    if (!p.image) throw new Error(`Page ${i + 1} missing "image"`);
  });
}
