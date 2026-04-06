# Story Images

Drop per-page illustrations here. Suggested naming:

- `cover.png` — front cover
- `back.png` — back cover
- `01.png`, `02.png`, `03.png`, … — content pages in order

Reference them from `story.json` like:

```json
"image": "images/01.png"
```

Any image format the browser supports works (PNG, JPG, WebP, etc.). Recommended aspect ratio: tall, around 800×1000, to match the book page dimensions defined in `js/buildBook.js`.
