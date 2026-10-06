"""Offline checks: never use real credentials or contact OpenAI."""
import base64
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
import httpx
from openai import AuthenticationError, PermissionDeniedError, RateLimitError, APITimeoutError, APIConnectionError
from types import SimpleNamespace
from unittest.mock import patch

import app


class BackendChecks(unittest.TestCase):
    def setUp(self):
        app.recent_requests.clear()
        app.active_requests = 0
        self.client = app.app.test_client()
        self.payload = {'description': 'A vase', 'colours': ['#123456']}

    def test_generate_success_and_cors(self):
        with patch.object(app, 'generate_image', return_value=b'png-test-bytes') as generate:
            response = self.client.post('/generate', json=self.payload, headers={'Origin': 'http://127.0.0.1:8013'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(base64.b64decode(response.json['image_base64']), b'png-test-bytes')
            self.assertEqual(response.json['mime_type'], 'image/png')
            self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:8013')
            generate.assert_called_once_with('A vase', ['#123456'])
        with patch.object(app, 'generate_image') as generate:
            self.assertEqual(self.client.options('/generate', headers={'Origin': 'https://fatimajshah.github.io'}).status_code, 200)
            self.assertEqual(self.client.post('/generate', json=self.payload, headers={'Origin': 'https://untrusted.example'}).status_code, 403)
            generate.assert_not_called()

    def test_endpoint_validation_and_body_limit(self):
        with patch.object(app, 'generate_image') as generate:
            for payload in [None, [], {}, {'description': ' ', 'colours': ['#123456']},
                            {'description': 'x' * 1001, 'colours': ['#123456']},
                            {'description': 12, 'colours': ['#123456']},
                            {'description': 'A vase', 'colours': []},
                            {'description': 'A vase', 'colours': ['#123456'] * 9},
                            {'description': 'A vase', 'colours': ['red']}]:
                response = self.client.post('/generate', json=payload, content_type='application/json')
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.json)
            self.assertEqual(self.client.post('/generate', data='{bad', content_type='application/json').status_code, 400)
            self.assertEqual(self.client.post('/generate', data='x').status_code, 415)
            response = self.client.post('/generate', data='x' * 16385, content_type='application/json')
            self.assertEqual(response.status_code, 413)
            generate.assert_not_called()

    def test_endpoint_provider_errors_and_slot_release(self):
        request = httpx.Request('POST', 'https://api.openai.com/v1/images/generations')
        errors = [
            AuthenticationError('SECRET', response=httpx.Response(401, request=request), body={'code': 'invalid_api_key'}),
            PermissionDeniedError('SECRET', response=httpx.Response(403, request=request), body={'code': 'permission_denied'}),
            RateLimitError('SECRET', response=httpx.Response(429, request=request), body={'code': 'rate_limit_exceeded'}),
            RateLimitError('SECRET', response=httpx.Response(429, request=request), body={'code': 'insufficient_quota'}),
            APITimeoutError(request=request), APIConnectionError(request=request),
        ]
        for error in errors:
            app.recent_requests.clear()
            safe = app.provider_failure(error)
            with patch.object(app, 'generate_image', side_effect=safe):
                response = self.client.post('/generate', json=self.payload)
                self.assertEqual(response.status_code, safe.http_status)
                self.assertEqual(response.json['error']['code'], safe.category)
                self.assertNotIn('SECRET', response.get_data(as_text=True))
                self.assertEqual(app.active_requests, 0)
        for error, code in [(app.GenerationError('Image decoding failed.'), 'image_decoding'), (RuntimeError('SECRET'), 'configuration')]:
            with patch.object(app, 'generate_image', side_effect=error):
                response = self.client.post('/generate', json=self.payload)
                self.assertEqual(response.json['error']['code'], code)
                self.assertNotIn('SECRET', response.get_data(as_text=True))

    def test_usage_limits_reject_before_generation_and_expire(self):
        with patch.object(app.time, 'monotonic', return_value=100), patch.object(app, 'generate_image', return_value=b'png') as generate:
            for _ in range(5):
                self.assertEqual(self.client.post('/generate', json=self.payload).status_code, 200)
            self.assertEqual(self.client.post('/generate', json=self.payload).json['error']['code'], 'local_rate_limit')
            self.assertEqual(generate.call_count, 5)
        with patch.object(app.time, 'monotonic', return_value=161), patch.object(app, 'generate_image', return_value=b'png'):
            self.assertEqual(self.client.post('/generate', json=self.payload).status_code, 200)
        app.recent_requests.clear()
        def while_busy(*args):
            response = app.app.test_client().post('/generate', json=self.payload)
            self.assertEqual(response.json['error']['code'], 'busy')
            return b'png'
        with patch.object(app, 'generate_image', side_effect=while_busy) as generate:
            self.assertEqual(self.client.post('/generate', json=self.payload).status_code, 200)
            generate.assert_called_once()
            self.assertEqual(app.active_requests, 0)
    def test_safe_error_categories(self):
        request = httpx.Request('POST', 'https://api.openai.com/v1/images/generations')
        for error_type, status, code, category in [
            (AuthenticationError, 401, 'invalid_api_key', 'Authentication'),
            (PermissionDeniedError, 403, 'permission_denied', 'Permission/model access'),
            (RateLimitError, 429, 'insufficient_quota', 'Billing/quota'),
            (RateLimitError, 429, 'rate_limit_exceeded', 'Rate limit/quota'),
        ]:
            error = error_type('SECRET response body', response=httpx.Response(status, request=request), body={'code': code})
            text = str(app.provider_failure(error))
            self.assertIn(category, text)
            self.assertIn(f'HTTP={status}', text)
            self.assertIn(error_type.__name__, text)
            self.assertIn(code, text)
            self.assertNotIn('SECRET', text)
        for error, category in [(APITimeoutError(request=request), 'Timeout'), (APIConnectionError(request=request), 'Connection')]:
            self.assertIn(category, str(app.provider_failure(error)))
        error = AuthenticationError('SECRET', response=httpx.Response(401, request=request), body={'code': 'SECRET'})
        self.assertNotIn('SECRET', str(app.provider_failure(error)))

    def test_dotenv_loading_and_inherited_precedence(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('OPENAI_API_KEY=local-test-value\n')
            with patch.dict(os.environ, {}, clear=True):
                facts = app.load_environment(path)
                self.assertEqual(os.environ['OPENAI_API_KEY'], 'local-test-value')
                self.assertTrue(facts['effective_key_present'])
                self.assertFalse(facts['inherited_variable_overrides_local'])
            with patch.dict(os.environ, {'OPENAI_API_KEY': 'inherited-test-value'}, clear=True):
                facts = app.load_environment(path)
                self.assertEqual(os.environ['OPENAI_API_KEY'], 'inherited-test-value')
                self.assertTrue(facts['inherited_and_local_differ'])
                self.assertTrue(all(type(value) is bool for value in facts.values()))

    def test_invalid_image_is_sanitized(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'offline-test-value'}), patch.object(app, 'OpenAI') as sdk:
            client = sdk.return_value.__enter__.return_value
            for payload in ['SECRET:not-base64', base64.b64encode(b'SECRET-not-png').decode()]:
                client.images.generate.return_value = SimpleNamespace(data=[SimpleNamespace(b64_json=payload)])
                with self.assertRaises(app.GenerationError) as caught:
                    app.generate_image('A vase', ['#123456'])
                self.assertIn('Image decoding', str(caught.exception))
                self.assertNotIn('SECRET', str(caught.exception))

    def test_health(self):
        with patch.object(app, 'OpenAI') as sdk:
            client = app.app.test_client()
            response = client.get('/health')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json, {'status': 'ok'})
            self.assertEqual(client.post('/generate').status_code, 415)
            sdk.assert_not_called()

    def test_missing_key_before_client_creation(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(app, 'OpenAI') as sdk:
            with self.assertRaisesRegex(RuntimeError, 'Set OPENAI_API_KEY'):
                app.generate_image('A vase', ['#123456'])
            sdk.assert_not_called()

    def test_invalid_inputs_before_client_creation(self):
        with patch.object(app, 'OpenAI') as sdk:
            for description, colours in [('', ['#123456']), ('A vase', []), ('A vase', ['red'])]:
                with self.assertRaises(ValueError):
                    app.generate_image(description, colours)
            sdk.assert_not_called()

    def test_one_request_parameters_and_decode_with_fake_response(self):
        fake_png = b'\x89PNG\r\n\x1a\nmock-payload'
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'offline-test-value'}), patch.object(app, 'OpenAI') as sdk:
            client = sdk.return_value.__enter__.return_value
            client.images.generate.return_value = SimpleNamespace(data=[
                SimpleNamespace(b64_json=base64.b64encode(fake_png).decode())
            ])
            self.assertEqual(app.generate_image('A vase', ['#123456']), fake_png)
            sdk.assert_called_once_with(api_key='offline-test-value', timeout=120.0, max_retries=0)
            client.images.generate.assert_called_once_with(
                model=app.MODEL, prompt=app.build_prompt('A vase', ['#123456']),
                n=1, size='1024x1024', quality='low', output_format='png',
            )


if __name__ == '__main__':
    unittest.main()
