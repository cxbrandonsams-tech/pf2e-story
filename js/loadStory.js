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
    if (p.chapter !== undefined && typeof p.chapter !== 'string') {
      throw new Error(`Page ${i + 1} "chapter" must be a string if present`);
    }
    if (p.plateLabel !== undefined && typeof p.plateLabel !== 'string') {
      throw new Error(`Page ${i + 1} "plateLabel" must be a string if present`);
    }
    if (p.illustrationTitle !== undefined && typeof p.illustrationTitle !== 'string') {
      throw new Error(`Page ${i + 1} "illustrationTitle" must be a string if present`);
    }
    if (p.cropY !== undefined) {
      const err = validateCropYFormat(p.cropY);
      if (err) throw new Error(`Page ${i + 1} "cropY" ${err}`);
    }
    if (p.imageMobile !== undefined) {
      if (typeof p.imageMobile !== 'string' || !p.imageMobile) {
        throw new Error(`Page ${i + 1} "imageMobile" must be a non-empty string if present`);
      }
    }
    if (p.paragraphImages !== undefined) {
      if (!Array.isArray(p.paragraphImages) || p.paragraphImages.length === 0) {
        throw new Error(`Page ${i + 1} "paragraphImages" must be a non-empty array of image paths if present`);
      }
      p.paragraphImages.forEach((entry, j) => {
        if (typeof entry === 'string') {
          if (!entry) {
            throw new Error(`Page ${i + 1} "paragraphImages[${j}]" must be a non-empty string`);
          }
          return;
        }
        if (entry && typeof entry === 'object') {
          if (typeof entry.src !== 'string' || !entry.src) {
            throw new Error(`Page ${i + 1} "paragraphImages[${j}].src" must be a non-empty string`);
          }
          if (entry.cropY !== undefined) {
            const err = validateCropYFormat(entry.cropY);
            if (err) throw new Error(`Page ${i + 1} "paragraphImages[${j}].cropY" ${err}`);
          }
          return;
        }
        throw new Error(`Page ${i + 1} "paragraphImages[${j}]" must be a non-empty string or an object with a "src" string`);
      });
    }
  });
}

function validateCropYFormat(value) {
  if (typeof value !== 'string') return 'must be a string of the form "N%" with N in [0,100]';
  if (!/^\d+(\.\d+)?%$/.test(value)) return 'must be a string of the form "N%" with N in [0,100]';
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 'must be in the range 0% to 100%';
  return null;
}
