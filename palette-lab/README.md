# Colour Palette Lab

Colour Palette Lab is a web tool for artists, designers, and anyone interested in working with color. It extracts a palette from an image, uses that palette to guide AI image generation, and lets users compare the colours found in the original and generated images.

Created for CMU 15-113: Effective Coding with AI, Project 2.

## Live project

- [Open Colour Palette Lab](https://fatimajshah.github.io/113-Portfolio-/palette-lab/)
- [GitHub repository](https://github.com/fatimajshah/113-Portfolio-)
- [Backend health check](https://one13-portfolio.onrender.com/health)

The frontend is hosted on GitHub Pages. The Python backend is hosted on Render and handles requests to OpenAI.

## What it does

Users can select a photograph or other image and extract a small set of representative colors. The tool displays each color’s HEX value and approximate share of the sampled image, then reconstructs the image using the cleaned palette. Users can also describe a new image and generate it using the extracted palette as guidance.


## How to use it

1. Choose a JPG or PNG of 10 MB or less, or click **Try sample**.
2. Select a palette size between 3 and 8 colours.
3. Click **Extract palette**.
4. Review the swatches, HEX values, and sampled-pixel percentages.
5. Compare the original working image with its palette reconstruction.
6. Use **Copy HEX** to copy a colour or **Download palette** to save the palette as a PNG.
7. Enter a description of a new image and click **Generate with this palette**.
8. Review the generated image and its separate extracted palette.
9. Click **Reset** to clear the current results and start again.

The final palette can contain fewer colours than requested when the image has fewer distinct colours or when very small clusters are merged.

## Features

- JPG and PNG selection with file-type and size validation
- Bundled sample illustration
- Selectable palette size from 3 to 8 colors
- Deterministic k-means clustering
- HEX labels and sampled-pixel percentages
- Tiny-cluster merging
- Original-versus-reconstructed image comparison
- Copy HEX and palette PNG download
- Palette-guided AI image generation
- Local analysis of the generated image’s palette
- Reset and same-file re-selection
- Loading, success, and error messages
- Responsive desktop and mobile layouts
- Local color analysis with server-side API credentials

## How the project is organized

The repository contains two project folders:

```text
palette-lab/
    index.html
    style.css
    app.js
    config.js
    clustering.js
    checks.mjs
    generation_checks.mjs
    README.md
    prompt_log.md
    assets/
        still-life.svg

palette-lab-backend/
    app.py
    requirements.txt
    start.sh
    smoke_test.py
    test_app.py
    .env.example
    .gitignore
    README.md
    prompt_log.md
```

### Frontend

- **index.html:** Page structure, image selection, palette controls, comparisons, generation input, and status messages.
- **style.css:** Layout, typography, swatches, buttons, focus states, and responsive styling.
- **app.js:** Image loading, Canvas processing, palette rendering, percentages, reconstruction, copying, downloading, reset, and generation requests.
- **config.js:** Backend base URL. The deployed frontend uses `https://one13-portfolio.onrender.com`.
- **clustering.js:** Sampling, RGB distance, centre initialization, k-means, tiny-cluster merging, reconstruction mapping, and HEX conversion.
- **checks.mjs:** Focused checks for colour analysis and related behavior.
- **generation_checks.mjs:** Offline checks for the generation workflow.
- **assets/still-life.svg:** Bundled sample illustration.
- **prompt_log.md:** Development prompts and process documentation.

### Backend

- **app.py:** Flask API, input validation, generation requests, error handling, and request limits.
- **requirements.txt:** Python dependencies.
- **start.sh:** Gunicorn startup command for Render.
- **smoke_test.py:** Configuration checks and an optional real generation test.
- **test_app.py:** Offline backend tests.
- **.env.example:** Environment-variable template containing no real credentials.

See the [backend README](../palette-lab-backend/README.md) for backend setup and configuration.

## How colour extraction works

1. The browser decodes the selected image.
2. Canvas creates a smaller working copy while preserving its aspect ratio. The longest edge is capped at 240 pixels.
3. `samplePixels()` ignores fully transparent pixels, composites partially transparent pixels against white, and selects up to 6,000 visible RGB samples.
4. `initializeCentres()` chooses starting colours deterministically. It begins with the first unique sample and repeatedly chooses the colour farthest from its nearest existing centre.
5. `kMeans()` assigns each sample to its nearest centre using squared RGB distance.
6. Each centre is updated to the average RGB value of its assigned samples.
7. Assignment and averaging repeat until the centres stabilize or 30 iterations have passed.
8. Final centres are rounded, duplicate colours are merged, samples are recounted, and unused clusters are removed.
9. `mergeTinyClusters()` merges clusters representing less than 1.5% of the samples into the nearest larger cluster using a count-weighted colour average. Their counts are preserved.
10. The interface displays the final colours and calculates percentages:

```js
const percentage = (cluster.count / result.sampleCount) * 100;
```

Percentages describe sampled color groups. Rounded percentages may total slightly above or below 100%.

The working Canvas contains at most 57,600 pixels, and clustering uses at most 6,000 samples. These limits keep the analysis manageable.

## How reconstruction works

`mapPixelsToPalette()` assigns each working-image pixel to its nearest final palette colour.

The mapped pixels are drawn into a Canvas with the same dimensions as the working image. This preserves the aspect ratio and shows what the image looks like with its colours reduced to the extracted palette.

The comparison uses the smaller working image rather than a full-resolution reconstruction.

## How image generation works

After extraction, the frontend sends a request to the backend’s `POST /generate` endpoint containing:

- The user’s description
- The final cleaned HEX palette

The reference image itself is not included.

The backend validates the request and calls OpenAI using a server-side API key. The configured generation settings are `gpt-image-1-mini`, low quality, one 1024 × 1024 PNG, a 120-second API timeout, and no automatic retries.

The generated image is returned to the frontend. The browser then applies the existing bounded color-analysis process to that image and displays its extracted palette separately.

Only one generation request can be pending in the interface at a time. Resetting, replacing the source image, or extracting a new palette prevents an outdated response from replacing the current results.

Abandoning a request in the browser does not guarantee that generation stops on the backend or at the provider. The request may still incur a charge.

## Privacy and credentials

Reference-image decoding, sampling, clustering, and reconstruction happen locally in the browser.

Optional generation sends the description and HEX palette through the backend to OpenAI. The reference image stays in the browser.

The app does not implement accounts, a database, analytics, or persistent image storage between visits.

The OpenAI API key belongs only in the backend’s local environment or Render’s secret environment variables. It must not appear in frontend code, documentation, or GitHub.

Local `.env` files, virtual environments, and generated test outputs are excluded from version control.

User-provided filenames are rendered as text. Temporary object URLs are released after use.

## Running locally

You can use the public website without installing anything. These instructions are for development.

### Frontend

From the repository root:

```sh
python3 -m http.server 8013 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8013/palette-lab/
```

JavaScript modules should be served through HTTP rather than opening `index.html` directly.

### Backend

For first-time setup, open another terminal at the repository root:

```sh
cd palette-lab-backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp -n .env.example .env
```

Add your API key to the local `.env` file. Never commit that file.

Configure `ALLOWED_ORIGINS` to include the frontend origin used for local testing:

```text
http://127.0.0.1:8013
```

Start the backend:

```sh
env -u OPENAI_API_KEY .venv/bin/python app.py
```

This command removes an inherited `OPENAI_API_KEY` for that process so the backend can use the key in its local `.env`.

For a fully local setup, change the backend base URL in `palette-lab/config.js` to:

```text
http://127.0.0.1:5001
```

Restore the Render URL before publishing frontend changes.

Local extraction works without an API key. Real image generation requires API access and may incur charges.

## Deployment

The frontend is served by GitHub Pages. The backend is a separate Render web service built from the same repository.

Render configuration:

- Root directory: `palette-lab-backend`
- Build command: `pip install -r requirements.txt`
- Start command: `sh start.sh`
- Health-check path: `/health`
- Secret environment variable: `OPENAI_API_KEY`
- Allowed frontend origin: `https://fatimajshah.github.io`

Render supplies `PORT`. Gunicorn uses one worker, four threads, and a 180-second timeout.

The backend has process-local limits of five requests per minute and one concurrent generation. These limits reset when the process restarts and are not shared across multiple instances.

CORS controls browser access; it is not authentication. Access protection for the paid generation endpoint remains an outstanding deployment limitation.

## Verification

Reported offline checks passed for:

- Solid-colour and two-colour images
- Requested palette sizes greater than the number of distinct colours
- Deterministic results
- Transparency handling
- Sample limits and valid HEX values
- Cluster count totals
- Tiny-cluster merging
- Approximate percentage totals
- Reconstruction dimensions
- Generation request payloads
- Repeated-click suppression
- Reset and stale-response handling
- Backend validation and mocked generation

The backend test suite reported 11 passing offline tests. Offline checks do not make paid generation requests.

Run the frontend checks from the repository root:

```sh
node palette-lab/checks.mjs
node palette-lab/generation_checks.mjs
```

Earlier browser checks covered sample loading, image replacement, palette-size selection, reconstruction, copying, downloading, reset, same-file selection, and a narrow-screen layout.

Local real image generation was also successfully tested during development. These checks do not establish that every feature works in every browser or that the full deployed workflow has been verified.

## My code contributions

I added the percentage calculation in `app.js` using each cluster’s count divided by the total sampled-pixel count. I connected the result to the percentage label beside each HEX value.

I also added defensive validation inside `initializeCentres()` so the function reports an error when it receives no visible colour samples. This handles the case where a fully transparent image produces no usable RGB samples.

I reviewed and tested the small-cluster cleanup logic, including how the 1.5% threshold affects blended edge colours. Tiny clusters are merged into nearby larger colours while their counts remain represented in the final result.

I reviewed the data flow from image selection through Canvas sampling, clustering, reconstruction, and interface rendering so that I could understand the main functions and explain the design decisions.

## How I used AI

I used ChatGPT for brainstorming, planning, code explanations, debugging support, and review. I used Codex to help implement the project in stages, inspect files, write code, and run focused checks.

The project began as a local palette-extraction tool. After feedback on its scope, I extended it with backend-powered image generation and analysis of the generated image’s colours.

I questioned results when blended image edges appeared as additional colours that did not match the visual categories I expected. This led to palette-size controls, clearer percentage wording, and small-cluster cleanup.

I made my own changes to the percentage display and empty-sample validation. AI-assisted implementation and my own changes are documented separately in the development records:

- [Frontend prompt log](prompt_log.md)
- [Backend prompt log](../palette-lab-backend/prompt_log.md)


## Sources and credits

The bundled illustration in `assets/still-life.svg` was created by Codex specifically for this project.

The frontend uses standard browser APIs and no external runtime libraries. Colour analysis is implemented in JavaScript using RGB distance and k-means clustering.

The backend uses Flask, the official OpenAI Python SDK, python-dotenv, and Gunicorn.

- [OpenAI image-generation API documentation](https://developers.openai.com/api/reference/python/resources/images/methods/generate)
- [Flask documentation](https://flask.palletsprojects.com/)
- [Gunicorn documentation](https://docs.gunicorn.org/)

## Limitations

- Downsampling and sampling can miss small details.
- RGB distance does not model human colour perception uniformly.
- Canvas resizing can introduce blended edge colours.
- The 1.5% merging rule can remove meaningful small accents.
- Reconstruction is an approximation rather than a lossless copy.
- Generated images are palette-guided and may introduce different colours or proportions.
- Generation depends on backend availability, provider access, and available API credits.
- Request limits reduce usage but do not authenticate visitors.
- The app does not save palettes or generated images between visits.
- Broader accessibility and cross-browser testing remain future work.

## Future improvements

Possible improvements include using a more perceptually accurate colour space, adding secure access controls for generation, and expanding accessibility testing.
