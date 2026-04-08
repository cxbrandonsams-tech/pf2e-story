# Interactive Storybook

A self-contained, unlimited-page interactive storybook webpage. Two-page book spread with realistic 3D page-flip animation, per-page narration audio with word-sync highlighting and auto-advance, and a parchment-on-a-desk visual design. Built as a pure static site — no build step, no backend. Visual design adapted from the Google Stitch *Storybook Reader (Single Tonee Parchment)* mockup.

## Local development

This site uses `fetch()` to load `story.json`, so it must be served via HTTP. Opening `index.html` directly via `file://` will fail in most browsers.

```bash
python -m http.server 8000
```

Then open http://localhost:8000

## Editing the story

All content lives in `story.json`. There is no page limit — add as many pages as you want.

```json
{
  "title": "Story Title",
  "author": "Your Name",
  "cover":     { "image": "images/cover.png" },
  "backCover": { "image": "images/back.png" },
  "pages": [
    {
      "image": "images/01.png",
      "audio": "audio/01.mp3",
      "chapter": "Chapter I: The Beginning",
      "plateLabel": "I",
      "illustrationTitle": "The Harbor at Dawn",
      "kenBurns": "zoom-in-center",
      "text": "Page 1 body text..."
    }
  ]
}
```

**Per-page fields:**

| Field               | Required | Description |
|---------------------|----------|-------------|
| `image`             | yes      | Image path or URL for the illustration page. Remote URLs like `https://placehold.co/...` work fine during development. |
| `text`              | no       | Body text for the facing page. Paragraphs split on blank lines. The first character of the first non-blockquote paragraph becomes a decorative drop-cap. Paragraphs that both start and end with `"` are auto-styled as italic blockquotes. |
| `audio`             | no       | Path or URL to a narration MP3 for this page. When present, the page auto-advances when audio ends and the text highlights word-by-word as the narration plays. |
| `durationMs`        | no       | Fallback timer (milliseconds). If `audio` is missing but `durationMs` is set, the page auto-advances after this delay. Ignored when `audio` is present. |
| `kenBurns`          | no       | Image pan/zoom mode: `zoom-in-center`, `zoom-in-left`, `zoom-in-right`, `zoom-out`, `pan-left`, `pan-right`, or `none`. Default `zoom-in-center`. |
| `chapter`           | no       | Chapter heading rendered above the body text (e.g., `"Chapter I: The Silent Shore"`). |
| `plateLabel`        | no       | Illustration-page eyebrow, rendered as `Plate {plateLabel}` (supply just the label — e.g., `"I"`, `"IV"`). |
| `illustrationTitle` | no       | Heading displayed at the bottom of the illustration page. |

If a page has **neither** `audio` nor `durationMs`, auto-advance is disabled for that page and the reader must click Next.

## Adding audio later

You're not locked in. Start with placeholder images and `durationMs` timers, finish writing the story, then generate narration MP3s (ElevenLabs, OpenAI TTS, Google Cloud TTS, etc.), drop them into an `audio/` folder, and update the `audio` field in each page. The `audio` path automatically takes precedence over `durationMs`.

## Controls

| Control | Shortcut |
|---------|----------|
| Play / Pause | `Space` or the central Chronicle button |
| Previous page | `←` or the ◀ button |
| Next page | `→` or the ▶ button |
| Voice volume | Voice Resonance slider |
| Speed | 0.8× / 1× / 1.2× dropdown |

## Deployment (GitHub Pages)

1. Create a new GitHub repository and push this directory:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. In the repository's GitHub settings → Pages → Source: **Deploy from branch** → `main` → `/ (root)` → Save.
3. After ~1 minute, the site is live at `https://<user>.github.io/<repo>/`.

## Architecture

Single static site, no build step. All JavaScript is ES modules. Styling is Tailwind CSS via CDN plus an inline `<style>` block in `index.html` for things Tailwind can't express (Ken Burns keyframes, word-sync highlighting, custom slider, parchment texture).

| File | Responsibility |
|------|---------------|
| `index.html` | Shell: Tailwind config, inline styles, top bar, book frame, footer control bar, `<audio>` element |
| `story.json` | Content source of truth |
| `js/app.js` | Entry point; wires modules together |
| `js/loadStory.js` | Fetches + validates `story.json` |
| `js/buildBook.js` | Builds page DOM (parchment, ornate frame, drop-cap, blockquote detection), initializes StPageFlip (only file touching the library) |
| `js/AudioController.js` | `<audio>` element wrapper |
| `js/BookController.js` | Orchestrator: audio ended / timer → flip next; flip → load new page; word-sync highlight sweep |
| `js/UIController.js` | Wires DOM controls to the controllers |
| `js/KenBurns.js` | Applies a named Ken Burns animation to an illustration image |

Page-flip animation is provided by [StPageFlip](https://nodlik.github.io/StPageFlip/) loaded via CDN. Tailwind CSS is loaded from the Tailwind Play CDN at runtime. Fonts (Noto Serif / Newsreader / Work Sans / Material Symbols Outlined) come from Google Fonts.
