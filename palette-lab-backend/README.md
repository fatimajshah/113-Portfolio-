# Colour Palette Lab backend foundation

## AI-generated technical notes

This Flask service exposes `GET /health` and `POST /generate`. The frontend now integrates with it locally, including generated-image palette analysis. No database or public backend deployment is configured.

### Setup (Python 3.9+)

From the portfolio repository root:

```sh
cd palette-lab-backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp -n .env.example .env
```

Edit `.env` locally to replace the placeholder. Alternatively set `OPENAI_API_KEY` in your environment. Environment values take precedence over `.env`. Never put the key in chat, source files, the frontend, or a commit. `.env`, `.venv/`, and `outputs/` are ignored by this folder's `.gitignore`.

### Health and offline checks (no paid calls)

```sh
python -m unittest -v test_app
env -u OPENAI_API_KEY .venv/bin/python app.py
```

In another terminal:

```sh
curl http://127.0.0.1:5001/health
```

The local server binds to loopback with debug disabled. Stop it with Ctrl+C. Health does not require a key and says only that the service responds, not that OpenAI credentials or billing work.

### One manual paid generation

After setting your key locally, from this directory with the virtual environment active:

```sh
env -u OPENAI_API_KEY .venv/bin/python smoke_test.py --description "A simple ceramic vase beside a sunlit window" --colours '#E9DFCD' '#7F9C9C' '#B76546'
```

Each invocation makes one generation request and saves a uniquely named PNG in the ignored `outputs/` folder. The command does not run automatically on server startup, import, or during unit tests. A timeout can occur after the service has processed a paid request; check your account before manually repeating it.

### Implementation and official references

`generate_image(description, colours)` validates a nonempty description of at most 1,000 characters and 1–8 six-digit HEX colours, builds a palette-guided composition prompt, and returns decoded PNG bytes. The palette may contain fewer than three colours after frontend cleanup. Only text description and HEX guidance are sent with fixed model settings; no reference image is accepted or uploaded. Colour matching is approximate, not exact HEX compliance.

### HTTP generation and usage limits

Send `Content-Type: application/json` to `POST /generate` with `{"description":"A vase","colours":["#E9DFCD"]}`. It returns `{"image_base64":"...","mime_type":"image/png"}`. Request bodies are limited to 16 KB (413 on excess). Errors are JSON: `{"error":{"code":"...","message":"..."}}`. Invalid input returns 400, wrong content type 415, local/provider rate limits 429, timeouts 504, provider authentication/access/connection/decoding failures 502, and missing server configuration or billing failures 503. Provider errors include only sanitized diagnostics, never raw response bodies or image data.

`ALLOWED_ORIGINS` is a comma-separated exact-origin list, defaulting to `http://127.0.0.1:8013,https://fatimajshah.github.io`. Allowed origins receive CORS headers on preflight and normal/error responses; other declared origins are rejected. CORS is not authentication: non-browser callers can omit or spoof Origin. Keep the service local until a public-access policy is implemented.

Limits are global across clients within one Python process: five admitted generation calls per rolling 60 seconds, with one call in flight. Excess requests are rejected before OpenAI is called. Failed admitted calls count; invalid input, preflights, and rejected requests do not. A lock protects the counters. Limits reset on restart and are not shared across workers or hosts; they are not a billing cap. No queue or automatic retries are used.

The `env -u OPENAI_API_KEY` local startup command removes an inherited key for this process so the backend `.env` is used. Production startup preserves environment-variable support and precedence.

### Render configuration (prepared, not deployed)

- Root directory: `palette-lab-backend`
- Build command: `pip install -r requirements.txt`
- Start command: `sh start.sh`
- Health-check path: `/health`
- Set `OPENAI_API_KEY` as a secret environment variable in Render.
- Set `ALLOWED_ORIGINS=https://fatimajshah.github.io` (append `,http://127.0.0.1:8013` if local frontend access is needed).
- Render supplies `PORT`; the start script requires it and binds to `0.0.0.0:$PORT`.

The script runs Gunicorn with one worker, four threads, and 180-second worker and graceful-shutdown timeouts, longer than the SDK's 120-second network timeout. A threaded worker can continue sending heartbeats during a request, so its timeout is not a request deadline. Model settings, zero retries, validation, and usage limits are unchanged. Keep exactly one service instance and one worker: counters are process-local, reset on restart, and are not shared across instances. Threads allow health checks and excess-request rejection while generation is pending.

The paid `/generate` endpoint needs access protection before public use. CORS and process-local limits do not authenticate callers or enforce a billing cap. A secret embedded in frontend JavaScript would not protect access. No authentication or deployment was added here. The frontend still points to localhost; a deployed backend URL and appropriate access protection must be configured separately.

References: [Render Flask deployment](https://render.com/docs/deploy-flask), [Render port binding](https://render.com/docs/web-services#port-binding), and [Gunicorn threaded workers](https://docs.gunicorn.org/en/stable/design.html#how-many-threads).

Server-side settings: `gpt-image-1-mini`, `quality="low"`, `size="1024x1024"`, `n=1`, `output_format="png"`. This is an economical draft configuration. The official Python SDK receives a 120-second request timeout and `max_retries=0`. The SDK timeout limits network operations; it is not a guaranteed total wall-clock deadline. GPT Image responses contain `data[0].b64_json`; no deprecated `response_format` parameter is sent.

- [Official model documentation](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
- [Official Python image generation reference](https://developers.openai.com/api/reference/python/resources/images/methods/generate)

Dependencies use bounded compatible versions in `requirements.txt`, not a fully pinned lockfile. API failures are reported without printing SDK response bodies, prompts, or keys. Real account access, billing, PNG rendering, and palette adherence require the manual paid test; offline mocks do not verify those.

### Checks performed

Stage 2 endpoint: 11 offline tests passed, covering mocked valid requests, input/body validation, CORS, provider errors, decoding, rate-window expiry, concurrent rejection, slot release, and health. No paid requests were made by the assistant. The user reported a successful real CLI smoke test using the local key.

On 2026-10-06, four offline unittest cases passed with Python 3.9.6, Flask 3.1.3, openai 2.48.0, and python-dotenv 1.2.1. Health was verified using Flask's test client, missing keys and invalid inputs were rejected before SDK construction, and a mocked response verified single-request settings and base64 decoding. `pip check` passed and Git ignore rules were verified. No paid generation was run.
