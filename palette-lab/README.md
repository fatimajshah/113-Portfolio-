# Colour Palette Lab — Stage 1

## My README checklist (write these in your own words)

- [ ] **What it does:** [Describe the intended audience and purpose.]
- [ ] **How to use it:** [Describe selecting an image, extracting, and reading a palette.]
- [ ] **Features I am proud of:** [Choose features and explain why.]
- [ ] **How to run it locally:** [Try the commands below and write your own explanation.]
- [ ] **Images and secrets:** [Explain local processing and why no credentials are needed.]
- [ ] **How I used AI:** [Describe what you accepted, questioned, changed, and learned; link prompt_log.md.]
- [ ] **Sources and credits:** [Review the original sample credit below; add any sources you actually use.]
- [ ] **Limitations:** [Explain sampling, RGB distance, and Stage 1 scope in your own words.]
- [ ] **My own code contributions:** [Describe actual changes after you make them.]

## AI-generated technical notes

### Run locally

From the portfolio repository root:

```sh
python3 -m http.server 8013 --bind 127.0.0.1
```

Open http://127.0.0.1:8013/palette-lab/ . Stop the server with Ctrl+C.
Use HTTP because JavaScript modules can be blocked when opening index.html directly.
No package installation, build process, backend, database, or API key is required.
The local server serves files; it does not receive selected image data.

Optional focused checks, if Node.js is installed:

```sh
node palette-lab/checks.mjs
```

### Files and data flow

- `index.html`: labelled file input, sample and extraction buttons, image preview, live status, and palette list.
- `style.css`: neutral responsive presentation, visible focus, mobile stacking, and uncropped image display.
- `app.js`: validates file type and size; decodes an image; displays it; downsizes it using Canvas; calls sampling and clustering; renders swatches with textContent.
- `clustering.js`: pure sampling, RGB distance, deterministic initialization, k-means, and HEX conversion.
- `assets/still-life.svg`: original geometric illustration made by the Codex assistant for this project, with no external asset or remote-image dependency. SVG is used only for this trusted bundled illustration; user selection accepts PNG/JPEG.
- `checks.mjs`: small dependency-free algorithm checks.
- `test-fixtures/`: generated PNGs for solid red, partial transparency, full transparency, and a deliberately corrupt PNG for input checks.
- `prompt_log.md`: exact initial request and honest development record.

### How the algorithm works

1. `selectImage()` decodes the image and updates preview state.
2. The extraction handler in `app.js` draws an aspect-ratio-preserving working copy with a maximum edge of 240 pixels (at most 57,600 working pixels).
3. `samplePixels()` ignores zero-alpha pixels and composites partial alpha against white. It picks up to 6,000 evenly spaced visible pixels. This bounds clustering cost and preserves repeatability without random sampling.
4. `initializeCentres()` starts with the first sample and repeatedly chooses the colour farthest from its nearest existing centre. If fewer distinct sampled colours exist, it initializes fewer centres.
5. `kMeans()` uses `nearestIndex()` and `squaredDistance()` to assign samples, averages each cluster's RGB channels, and repeats. It stops when every squared centre movement is below 0.25 or after 30 iterations. Empty clusters retain their prior centre to avoid division by zero.
6. Final centres are rounded, identical HEX colours merged, samples recounted, and unused centres removed. Clusters are sorted by sample count, then HEX. `toHex()` formats readable labels.
7. The result includes `clusters` with `{rgb, hex, count}`, `sampleCount`, and `iterations`. Percentages are intentionally not implemented yet.

The limits keep computation modest (at most roughly 900,000 sample-to-centre comparisons in the main five-centre iteration loop). Image decoding still depends on the original dimensions and the browser; 10 MB is a compressed-file limit, not a decoded-memory guarantee. No worker is included because none was needed during these focused checks.

RGB distance does not match human perception uniformly. Downsampling and deterministic sampling may miss tiny areas, and Canvas resizing introduces blended edge colours. Results repeat for the same decoded pixels and settings, but different browsers' image decoding/colour management may differ slightly. Percentages in the next stage will estimate sampled working-image coverage, not exact original-image area.

### State and privacy

Image selection increments a version number; outdated decode/extraction work cannot replace newer selection state. Changing selection clears the palette and disables extraction until ready. Blob URLs are revoked after decoding, including on errors. Selected filenames are rendered as text, never HTML. No image upload, analytics, third-party runtime request, or persistent image storage is implemented.

### Verification performed on 2026-10-03

- Node v20.12.2: all assertions in checks.mjs passed, covering one colour, two known colours/counts, requested k greater than distinct colours, repeatability, partial alpha on white, invisible-image error, sample limit, valid HEX, and count totals.
- Codex in-app browser: initial empty state and disabled extraction observed; sample loaded and produced five swatches.
- Valid red PNG replaced the sample, cleared prior results, and produced one #FF0000 swatch with the fewer-colours explanation.
- Partial-alpha red PNG produced #FF7F7F; fully transparent PNG produced the helpful no-visible-pixels error.
- Corrupt PNG produced a decode error and disabled extraction; selecting the sample recovered successfully.
- 375 × 812 viewport: stacked panels visually inspected; document width and viewport width both measured 375 px, so no horizontal overflow.
- Reviewed selection-version guards and URL cleanup in source. Did not simulate a slow concurrent decode race.

### Remaining manual checks

- [ ] Try a personal JPG, a large PNG below 10 MB, and a file over 10 MB.
- [ ] Try an unsupported file and rapidly replace images while loading/extracting.
- [ ] Use only the keyboard; check focus and status announcements with a screen reader.
- [ ] Try another browser and a physical phone. Large decoded images and long filenames merit checking.

### Your next contribution (Stage 2, not implemented)

Use each cluster's `count` and the result's `sampleCount` to calculate a percentage. Work in the extraction result rendering in `app.js`, add a proportional distribution display in `index.html`/`style.css`, and explain how rounding affects totals. Keep the analysis counts as data rather than deriving them from displayed labels.

### Later delivery checklist

- [ ] Stage 2: selectable 3–8 colours, percentages/distribution, reconstruction/comparison.
- [ ] Stage 3: copy HEX, palette PNG export, complete reset, more samples, polish.
- [ ] Stage 4: deployed-browser verification and portfolio card.
- [ ] Personally review/modify code and complete README and prompt log.
- [ ] Record actual work sessions and make meaningful commits as work progresses.
- [ ] Midpoint check-in, narrated demo, final presentation, submission form.
- [ ] Confirm public source and deployed link before the assignment deadline: Wednesday October 7, 11:59 p.m.

Suggested Stage 1 commit message after your review: `Add Colour Palette Lab stage one with local k-means extraction`
