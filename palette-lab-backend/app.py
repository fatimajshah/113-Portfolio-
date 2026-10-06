"""Local palette-guided generation service."""
import base64
import binascii
import os
import re
import threading
import time
from collections import deque
from pathlib import Path

from dotenv import dotenv_values, load_dotenv
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException
from openai import OpenAI, OpenAIError, APITimeoutError, APIConnectionError

BASE_DIR = Path(__file__).resolve().parent
def load_environment(path):
    """Return presence/precedence facts only, never credential values."""
    inherited = os.environ.get('OPENAI_API_KEY')
    local = dotenv_values(path).get('OPENAI_API_KEY') if path.is_file() else None
    load_dotenv(path, override=False)
    return {
        'local_env_exists': path.is_file(),
        'local_key_present': bool(local and local.strip()),
        'inherited_key_present': bool(inherited and inherited.strip()),
        'inherited_variable_overrides_local': inherited is not None and local is not None,
        'inherited_and_local_differ': inherited is not None and local is not None and inherited != local,
        'effective_key_present': bool(os.environ.get('OPENAI_API_KEY', '').strip()),
    }


ENV_DIAGNOSTICS = load_environment(BASE_DIR / '.env')
MODEL = 'gpt-image-1-mini'
SIZE = '1024x1024'
QUALITY = 'low'
TIMEOUT_SECONDS = 120.0

app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024
ALLOWED_ORIGINS = {origin.strip() for origin in os.getenv(
    'ALLOWED_ORIGINS', 'http://127.0.0.1:8013,https://fatimajshah.github.io'
).split(',') if origin.strip()}
# Global across clients in this process: at most five admitted calls per minute,
# with one generation in flight. No proxy headers or client-supplied IDs are trusted.
REQUESTS_PER_MINUTE = 5
MAX_CONCURRENT = 1
usage_lock = threading.Lock()
recent_requests = deque()
active_requests = 0


def json_error(code, message, status):
    return jsonify(error={'code': code, 'message': message}), status


@app.before_request
def check_origin():
    origin = request.headers.get('Origin')
    if origin and origin not in ALLOWED_ORIGINS:
        return json_error('origin_denied', 'This browser origin is not allowed.', 403)


@app.after_request
def cors(response):
    response.vary.add('Origin')
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.errorhandler(HTTPException)
def http_error(error):
    messages = {400: 'Malformed JSON request.', 413: 'Request body exceeds 16 KB.',
                415: 'Send application/json.', 404: 'Endpoint not found.', 405: 'Method not allowed.'}
    return json_error('http_error', messages.get(error.code, 'Request rejected.'), error.code)


@app.post('/generate')
def generate():
    global active_requests
    payload = request.get_json()
    if not isinstance(payload, dict):
        return json_error('invalid_input', 'Send a JSON object with description and colours.', 400)
    description, colours = payload.get('description'), payload.get('colours')
    try:
        build_prompt(description, colours)
    except ValueError as error:
        return json_error('invalid_input', str(error), 400)
    with usage_lock:
        now = time.monotonic()
        while recent_requests and now - recent_requests[0] >= 60:
            recent_requests.popleft()
        if len(recent_requests) >= REQUESTS_PER_MINUTE:
            return json_error('local_rate_limit', 'Generation limit reached. Wait a minute before trying again.', 429)
        if active_requests >= MAX_CONCURRENT:
            return json_error('busy', 'Another image is being generated. Try again after it finishes.', 429)
        recent_requests.append(now)
        active_requests += 1
    try:
        image = generate_image(description, colours)
        return jsonify(image_base64=base64.b64encode(image).decode('ascii'), mime_type='image/png')
    except GenerationError as error:
        return json_error(error.category, str(error), error.http_status)
    except RuntimeError:
        return json_error('configuration', 'Server API key is missing. Contact the server operator.', 503)
    except Exception:
        # Do not let a traceback log SDK response data or image payloads.
        return json_error('internal_error', 'Generation failed unexpectedly.', 500)
    finally:
        with usage_lock:
            active_requests -= 1


class GenerationError(RuntimeError):
    """Safe diagnostic text constructed locally, not from provider messages."""
    def __init__(self, message, category='image_decoding', http_status=502):
        super().__init__(message)
        self.category = category
        self.http_status = http_status


def provider_failure(error):
    # Only recognized codes are printable: an arbitrary provider field might echo a secret.
    allowed_codes = {
        'invalid_api_key', 'insufficient_quota', 'billing_hard_limit_reached',
        'billing_not_active', 'rate_limit_exceeded', 'model_not_found',
        'permission_denied', 'organization_not_verified', 'content_policy_violation',
        'invalid_request_error', 'server_error',
    }
    raw_code = getattr(error, 'code', None)
    code = raw_code if isinstance(raw_code, str) and raw_code in allowed_codes else 'unavailable-or-redacted'
    status = getattr(error, 'status_code', None)
    status = status if type(status) is int and 100 <= status <= 599 else 'unavailable'
    if isinstance(error, APITimeoutError):
        category, http_status = 'timeout', 504
        message = 'Timeout: the request timed out; processing or billing may already have occurred.'
    elif isinstance(error, APIConnectionError):
        category, http_status = 'connection', 502
        message = 'Connection: could not reach OpenAI; check connectivity, proxy, and TLS configuration.'
    elif status == 401:
        category, http_status = 'authentication', 502
        message = 'Authentication: the selected API key was rejected.'
    elif status in (403, 404) or code in {'model_not_found', 'permission_denied', 'organization_not_verified'}:
        category, http_status = 'access', 502
        message = 'Permission/model access: check project access, model availability, and organization verification.'
    elif code in {'insufficient_quota', 'billing_hard_limit_reached', 'billing_not_active'}:
        category, http_status = 'billing', 503
        message = 'Billing/quota: check API billing, credits, and project spending limits.'
    elif status == 429:
        category, http_status = 'provider_rate_limit', 429
        message = 'Rate limit/quota: request capacity or quota was exceeded; check limits and billing.'
    else:
        category, http_status = 'provider_error', 502
        message = 'Provider request failed; inspect account configuration and request settings.'
    # SDK class names are fixed; do not stringify the exception or its response body.
    exception_type = type(error).__name__ if type(error).__module__.startswith('openai') else 'OpenAIError'
    return GenerationError(f'{message} Type={exception_type}; HTTP={status}; code={code}. No automatic retry was attempted.', category, http_status)


@app.get('/health')
def health():
    return jsonify(status='ok')


def build_prompt(description: str, colours: list[str]) -> str:
    if not isinstance(description, str) or not description.strip() or len(description) > 1000:
        raise ValueError('Description must be nonempty and at most 1,000 characters.')
    # Cleaned frontend palettes can contain fewer than three colours.
    if not isinstance(colours, list) or not 1 <= len(colours) <= 8:
        raise ValueError('Provide a list of 1–8 HEX colours.')
    if any(not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in colours):
        raise ValueError('Each colour must use six-digit HEX notation, such as #336699.')
    palette = ', '.join(c.upper() for c in colours)
    return (
        'Create one composition based on this description:\n'
        f'{description.strip()}\n\n'
        f'Guide the dominant colours and overall mood using this palette: {palette}. '
        'Treat these colours as artistic guidance, not an exact HEX compliance requirement. '
        'Allow natural shading and blending. Do not add palette swatches or HEX labels.'
    )


def generate_image(description: str, colours: list[str]) -> bytes:
    """Make one paid request and return decoded PNG bytes; never upload a reference image."""
    prompt = build_prompt(description, colours)
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not key or key == 'replace-with-your-local-key':
        raise RuntimeError('Set OPENAI_API_KEY in your environment or local backend .env file.')
    try:
        with OpenAI(api_key=key, timeout=TIMEOUT_SECONDS, max_retries=0) as client:
            response = client.images.generate(
                model=MODEL, prompt=prompt, n=1, size=SIZE,
                quality=QUALITY, output_format='png',
            )
    except OpenAIError as error:
        raise provider_failure(error) from None
    if not response.data or len(response.data) != 1 or not response.data[0].b64_json:
        raise GenerationError('Image decoding: expected one base64 image. Type=ImageResponseError; HTTP=unavailable; code=unavailable.')
    try:
        image = base64.b64decode(response.data[0].b64_json, validate=True)
    except (ValueError, binascii.Error):
        raise GenerationError('Image decoding: invalid base64 data. Type=ImageDecodingError; HTTP=unavailable; code=unavailable.') from None
    if not image.startswith(b'\x89PNG\r\n\x1a\n'):
        raise GenerationError('Image decoding: missing PNG signature. Type=ImageFormatError; HTTP=unavailable; code=unavailable.')
    return image


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=False)
