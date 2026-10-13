# Pixel Sorter Studio

Interactive pixel-sorting glitch art in the browser. Load any image (or generate a seeded procedural gradient) and sort its pixels along rows or columns by brightness, lightness, hue, saturation, or a single RGB channel — the classic Kim Asendorf "pixel sorting" aesthetic, generalized to arbitrary color metrics.

## Features

- 7 sort metrics (brightness, HSL lightness, hue, saturation, R/G/B channels)
- Horizontal or vertical sorting direction
- Dual-threshold band control (which pixels participate in sorting)
- Interval-span limiter and gap noise
- Original/sorted blend slider
- **Auto-evolve mode**: re-sorts the live canvas on a feedback loop for deepening glitch trails
- Seeded procedural source-image generator (flow fields + radial blobs) — no image file needed
- Save result as PNG

## Run

No build step, no dependencies. Either:

```sh
# open directly
xdg-open index.html        # Linux
open index.html            # macOS
```

or serve locally:

```sh
python3 -m http.server 8000
# visit http://localhost:8000
```

## Headless engine test

```sh
node test.js
```

Verifies all sort metrics produce monotonic sorted intervals on a generated source image.

## Files

- `index.html` — layout & controls
- `style.css` — dark studio theme
- `sorter.js` — pure sorting engine (no DOM), metrics, seeded image generator
- `app.js` — canvas management, UI wiring, auto-evolve loop
- `test.js` — headless verification of the engine

Note: file-loading uses `URL.createObjectURL`, which works fine from `file://`; no CORS issues since no external resources are fetched.
