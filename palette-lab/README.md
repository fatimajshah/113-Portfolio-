# Colour Palette Lab

Colour Palette Lab is a browser-based tool for exploring the colour structure of an image. It uses k-means clustering to extract a small representative palette, calculate the approximate share of each colour, and reconstruct the image using only those colours.

The project was created for CMU 15-113: Effective Coding with AI, Project 2.

## What it does

The tool is intended for artists, designers, and anyone interested in understanding the visual colour structure of an image.
A user can upload a JPG or PNG, choose how many representative colours to extract, and compare the original image with a simplified reconstruction made from the extracted palette.

The app processes images locally in the browser. Uploaded images are not sent to a server.

## How to use it

1. Choose a JPG or PNG image, or click Try sample.
2. Select a palette size between 3 and 8 colours.
3. Click Extract palette.
4. Review the extracted swatches, HEX values, and percentages.
5. Compare the original image with the reconstructed image.
6. Click Copy HEX to copy an individual colour value.
7. Click Download palette to save the palette as a PNG.
8. Click Reset to clear the current image and begin again.

The percentages describe the distribution of the sampled working image. They represent colour clusters calculated by the algorithm and may not always match the semantic colours a person would name when looking at the image.

## Features

- JPG and PNG image selection
- Bundled sample image
- Palette-size selection from 3 to 8 colours
- Deterministic k-means colour clustering
- HEX colour values
- Sampled-pixel percentages
- Original-versus-reconstructed image comparison
- Tiny-cluster cleanup for insignificant edge colours
- Copyable HEX values
- Downloadable palette PNG
- Reset and same-file re-selection
- Transparent-image handling
- Invalid-file and oversized-file errors
- Loading, success, and error states
- Responsive mobile layout
- Local browser-only processing

## Public version

The deployed version is available here:

[Open Colour Palette Lab](https://fatimajshah.github.io/113-Portfolio-/palette-lab/)

This is the existing GitHub Pages frontend URL. Public availability of the latest changes has not been verified in this finalization pass. `config.js` still targets `http://127.0.0.1:5001`, so generation is configured for local development, not a deployed backend. GitHub Pages cannot run the Flask backend.

## Project structure

```text
palette-lab/
├── index.html
├── style.css
├── app.js
├── clustering.js
├── checks.mjs
├── README.md
├── prompt_log.md
├── assets/
│   └── still-life.svg
└── test-fixtures/
```

### `index.html`

Contains the page structure, labelled image input, sample button, palette-size selector, extraction button, image comparison, palette list, download button, reset button, and live status message.

### `style.css`

Controls the visual presentation, responsive layout, visible focus states, colour swatches, buttons, image comparison, and mobile stacking.

### `app.js`

Manages the interface and image workflow. It validates files, decodes images, creates a smaller working Canvas, calls the clustering functions, calculates percentages, renders the palette, creates the reconstructed image, copies HEX values, downloads a palette PNG, and resets the application state.

### `clustering.js`

Contains the pure colour-analysis functions:

- RGB distance calculation
- Nearest-colour lookup
- Pixel sampling
- Transparency handling
- Deterministic centre initialization
- K-means clustering
- Tiny-cluster merging
- Pixel-to-palette mapping
- RGB-to-HEX conversion

### `checks.mjs`

Contains small dependency-free checks for the clustering algorithm and important edge cases.

### `assets/still-life.svg`

A local geometric sample illustration created specifically for this project. It does not depend on an external image URL.

### `test-fixtures/`

Contains small generated PNG fixtures for testing solid colours, transparency, and corrupt-image handling.

## How the algorithm works

1. `selectImage()` decodes the selected image and updates the preview.
2. The extraction process creates a smaller working image while preserving the original aspect ratio. The longest edge is limited to 240 pixels.
3. `samplePixels()` ignores fully transparent pixels, composites partially transparent pixels against white, and selects at most 6,000 visible RGB samples.
4. `initializeCentres()` chooses deterministic starting colours. It begins with the first unique sample and repeatedly selects the colour farthest from its nearest existing centre.
5. `kMeans()` assigns each sample to its nearest centre, averages the RGB values in each cluster, and repeats until the centres stabilize or 30 iterations have passed.
6. Final centres are rounded to whole RGB values. Identical HEX colours are merged, samples are recounted, and unused clusters are removed.
7. Each final cluster contains:

```js
{
  rgb: [red, green, blue],
  hex: "#RRGGBB",
  count: number
}
```

The result also includes `sampleCount` and the number of iterations used.

8. The interface calculates each percentage using:

```js
cluster.count / result.sampleCount
```

9. Clusters below the 1.5% threshold are merged into the nearest larger cluster. Their pixels are still represented in the final counts rather than discarded.
10. `mapPixelsToPalette()` assigns every working-image pixel to its nearest cleaned palette colour and creates the reconstructed image.

The computation is bounded so that large images do not create an unnecessarily expensive clustering operation. The working Canvas contains at most approximately 57,600 pixels, and the clustering step uses at most 6,000 samples.

## Transparency and privacy

Fully transparent pixels are excluded from colour analysis.

Partially transparent pixels are composited against white before clustering so that they become visible RGB colours.

Uploaded reference images and palette analysis stay in the browser. Optional generation sends the description and HEX palette through the backend to OpenAI; it does not upload the reference image. The frontend does not use analytics or persist images between visits.

Local extraction needs no backend or key. Optional generation requires the Flask backend and a server-side OpenAI API key. No API key belongs in frontend files, and no database is used.

Temporary object URLs created for selected files are revoked after image decoding. User-provided filenames are rendered as text rather than inserted as raw HTML.

## My code contributions

I added the percentage calculation in `app.js` using each cluster’s count divided by the total sampled-pixel count. I connected the result to the visible percentage label beside each HEX value.

I also added defensive validation inside `initializeCentres()` so the function reports an error when it receives no visible colour samples. This covers the case where a fully transparent image produces no usable RGB samples.

I reviewed and tested the small-cluster cleanup logic, including how the 1.5% threshold affects anti-aliased edge colours. Tiny clusters are merged into nearby larger clusters while their pixel counts remain represented in the final result.

I also reviewed the data flow from image selection through Canvas sampling, clustering, reconstruction, and interface rendering so that I can explain the main functions and design decisions.

## How I used AI

I used ChatGPT for brainstorming, assignment planning, code explanations, debugging support, and review. I used Codex to help implement the project in stages, inspect the repository, write code, and run focused checks.

I questioned the initial output when blended image edges appeared as an additional colour that did not match the visual categories I expected. This led to palette-size controls, clearer percentage wording, and a small-cluster cleanup rule instead of assuming that the first result was perceptually perfect.

I also reviewed the generated code and made my own changes, including the percentage calculation and empty-sample validation. I tested the application with simple colour images, transparent images, invalid files, and real photographs.

The development record, including prompts and tool choices, is in [prompt_log.md](prompt_log.md).

## Sources and credits

The bundled still-life illustration is stored locally in `assets/still-life.svg` and was created specifically for this project.

The frontend uses no external runtime libraries. The colour analysis is implemented in JavaScript using standard RGB distance calculations and k-means clustering. The optional Python backend uses Flask, the official OpenAI SDK, and python-dotenv.

## Limitations

The app analyzes a smaller working image rather than every pixel of the original file. This keeps the interface responsive, but very small visual details may not affect the extracted palette.

The algorithm uses RGB distance. RGB distance is simple and easy to explain, but it does not model human colour perception perfectly. Colours that are mathematically close in RGB may not look equally close to a person.

Canvas resizing can produce blended edge colours. These may appear as small additional clusters. The 1.5% cleanup rule merges very small clusters into nearby larger colours, but a meaningful accent occupying a very small area could also be merged.

The reconstructed image is an approximation, not a lossless copy. Percentages describe the sampled working image rather than the exact area of the original full-resolution image.

The app currently analyzes one image at a time and does not save palettes between visits.

## Palette-guided generation

After extracting a palette, enter a description and use Generate with this palette. The frontend sends only the description and final cleaned HEX palette to the local backend at `http://127.0.0.1:5001`. The uploaded reference image remains local in the browser. Generated images preserve their natural aspect ratio; exact HEX matching is not guaranteed.

The frontend allows one pending generation request. Resetting, selecting another image, or extracting a new palette invalidates the pending response and clears the generated image. The browser may abandon its wait while the backend or provider continues processing, so an abandoned request may still consume provider time or quota. No automatic retry is performed.

After the generated image decodes, the frontend runs the same bounded Canvas sampling, k-means, tiny-cluster cleanup, HEX conversion, and percentage calculation used for the source image. It displays the generated-image palette separately. This comparison is approximate because generation is guided by the palette rather than constrained to exact HEX values; it does not produce a single accuracy score.

Run the frontend from the repository root in terminal 1:

```sh
python3 -m http.server 8013 --bind 127.0.0.1
```

Open http://127.0.0.1:8013/palette-lab/ . In terminal 2, starting from the repository root:

```sh
cd palette-lab-backend
env -u OPENAI_API_KEY .venv/bin/python app.py
```

The backend owns its API key and model settings. See `../palette-lab-backend/README.md` for backend setup and usage limits.

## Verification

### AI-generated finalization notes

The existing Node algorithm checks and frontend static generation checks passed. Added behavioral offline checks executing the actual generation handlers with mocked DOM/fetch for repeated-click suppression, request payload, reset cancellation, stale errors, and stale successes; these passed. All 11 backend offline tests passed. These do not constitute full browser or deployed end-to-end verification. The user previously reported successful local real generation. No paid calls were made during finalization.

Historical browser checks below are from earlier stages; repeat them after deployment. Source and generated palettes report sampled-pixel percentages, not an accuracy score. There is no proportional distribution chart currently.

The focused Node checks cover:

- One solid colour
- Two known colours and their counts
- Requesting more centres than distinct colours
- Repeatability
- Partial transparency
- Fully transparent images
- Bounded sample counts
- Valid HEX formatting
- Total cluster counts
- Tiny-cluster merging
- Percentage totals
- Reconstruction dimensions

The browser was also used to verify:

- Loading the bundled sample
- Replacing the sample with a user image
- Displaying the original and reconstructed images
- Selecting different palette sizes
- Copying HEX values
- Enabling and using palette download
- Resetting the interface
- Selecting the same file again after reset
- Stacked comparison layout on a narrow viewport
- Generated-image decoding and separate palette analysis contract

## Where AI got it wrong
In the early stages of development, the tool was detecting colors that weren't obviously present in the photograph, but were present in small amounts. As a result, the palette would not match the photogrpahy visually. In that sense, AI was able to help me write code for a theoretically correct version of the project, but not one that made sense visually. I had to use my own judgement to add a 1.5% threshold that merges very small clusters into nearby larger clusters, making the results more visually consistent with the image.

## Future improvements

Possible future improvements include using a more perceptually accurate colour space and performing more extensive accessibility testing.
