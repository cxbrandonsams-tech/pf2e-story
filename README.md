# Interactive Storybook

A self-contained, unlimited-page interactive storybook webpage. Two-page book spread with realistic 3D page-flip animation, per-page narration audio with auto-advance, and full reader controls. Built as a pure static site — no build step, no backend.

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
      "durationMs": 5000,
      "text": "Page 1 text..."
    }
  ]
}
```

**Per-page fields:**

| Field        | Required | Description |
|--------------|----------|-------------|
| `image`      | yes      | Image path or URL. Remote URLs like `https://placehold.co/...` work fine during development. |
| `text`       | no       | Caption text overlaid at the bottom of the page. Omit for pure illustration. |
| `audio`      | no       | Path or URL to a narration MP3 for this page. When present, the page auto-advances when audio ends. |
| `durationMs` | no       | Fallback timer (milliseconds). If `audio` is missing but `durationMs` is set, the page auto-advances after this delay. Ignored when `audio` is present. |

If a page has **neither** `audio` nor `durationMs`, auto-advance is disabled for that page and the reader must click Next.

## Adding audio later

You're not locked in. Start with placeholder images and `durationMs` timers, finish writing the story, then generate narration MP3s (ElevenLabs, OpenAI TTS, Google Cloud TTS, etc.), drop them into an `audio/` folder, and update the `audio` field in each page. The `audio` path automatically takes precedence over `durationMs`.

## Controls

| Control | Shortcut |
|---------|----------|
| Play / Pause | `Space` or ▶ button |
| Previous page | `←` or ⏪ button |
| Next page | `→` or ⏩ button |
| Jump to page | Page dropdown |
| Volume | Slider |
| Speed | 0.75× / 1× / 1.25× / 1.5× |
| Restart | ⏮ button |

## Deployment (GitHub Pages)

1. Create a new GitHub repository and push this directory:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. In the repository's GitHub settings → Pages → Source: **Deploy from branch** → `main` → `/ (root)` → Save.
3. After ~1 minute, the site is live at `https://<user>.github.io/<repo>/`.

## Architecture

Single static site, no build step. All JavaScript is ES modules.

| File | Responsibility |
|------|---------------|
| `index.html` | Shell: book container, control bar, audio element |
| `css/style.css` | Book, page, cover, control bar, error/toast styles |
| `story.json` | Content source of truth |
| `js/app.js` | Entry point; wires modules together |
| `js/loadStory.js` | Fetches + validates `story.json` |
| `js/buildBook.js` | Builds page DOM, initializes StPageFlip (only file touching the library) |
| `js/AudioController.js` | `<audio>` element wrapper |
| `js/BookController.js` | Orchestrator: audio ended / timer → flip next; flip → load new page |
| `js/UIController.js` | Wires DOM controls to the controllers |

Page-flip animation is provided by [StPageFlip](https://nodlik.github.io/StPageFlip/) loaded via CDN.
