// Offline integration contract checks; no browser and no backend/API request.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const config = await readFile(new URL('./config.js', import.meta.url), 'utf8');
assert.match(config, /http:\/\/127\.0\.0\.1:5001/);
assert.match(html, /id="description"[^>]+maxlength="1000"/);
assert.match(html, /id="generate"[^>]+disabled/);
assert.match(source, /BACKEND_BASE_URL\}\/generate/);
assert.match(source, /image_base64/);
assert.match(source, /mime_type/);
assert.match(source, /new AbortController/);
assert.match(source, /generationVersion/);
assert.match(source, /Generation was abandoned/);
assert.match(source, /currentResult\.clusters\.map\(cluster => cluster\.hex\)/);
assert.match(source, /analyzeImage\(generatedImage/);
assert.match(source, /renderComparisonPalette\(generatedPalette/);
assert.match(source, /generatedAnalysis\.hidden = false/);
assert.match(html, /id="generated-palette"/);
assert.match(html, /approximate/i);
// Execute the actual app handlers with a tiny DOM stub and deferred fetch promises.
// This tests cancellation behavior without networking or a paid request.
const elements = new Map();
function element() {
  return { value: '', dataset: {}, handlers: {}, hidden: true, disabled: true,
    addEventListener(name, handler) { this.handlers[name] = handler; },
    replaceChildren() {}, removeAttribute(name) { delete this[name]; } };
}
const pending = [];
const context = vm.createContext({
  document: { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  } },
  BACKEND_BASE_URL: 'http://offline.invalid', AbortController,
  URL: { revokeObjectURL() {} },
  fetch(url, options) { return new Promise((resolve, reject) => pending.push({ resolve, reject, options })); },
});
vm.runInContext(source.replace(/^import .*;\n/gm, ''), context);
vm.runInContext("currentResult = { clusters: [{hex: '#123456'}] }; descriptionInput.value = 'A vase'; updateGenerateAvailability();", context);
const button = elements.get('#generate');
assert.equal(button.disabled, false);
const first = button.handlers.click();
await button.handlers.click();
assert.equal(pending.length, 1, 'Repeated clicks must not issue another request');
assert.deepEqual(JSON.parse(pending[0].options.body), {description: 'A vase', colours: ['#123456']});
elements.get('#reset').handlers.click();
assert.equal(pending[0].options.signal.aborted, true);
const resetMessage = elements.get('#generation-status').textContent;
pending[0].reject(new TypeError('Late network failure'));
await first;
assert.equal(elements.get('#generation-status').textContent, resetMessage, 'An outdated error must not overwrite reset state');
vm.runInContext("currentResult = { clusters: [{hex: '#123456'}] }; descriptionInput.value = 'A vase';", context);
const second = button.handlers.click();
vm.runInContext('clearResults()', context);
pending[1].resolve({ok: true, json: async () => ({image_base64: 'ignored', mime_type: 'image/png'})});
await second;
assert.equal(elements.get('#generated-image').hidden, true, 'A stale success must not display an image');
console.log('PASS: static contract checks plus mocked repeated clicks, exact payload, reset cancellation, stale failure, and stale success. No network calls.');
