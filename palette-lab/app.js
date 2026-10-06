import { kMeans, mapPixelsToPalette, mergeTinyClusters, samplePixels } from './clustering.js';
import { BACKEND_BASE_URL } from './config.js';

const fileInput = document.querySelector('#file');
const preview = document.querySelector('#preview');
const empty = document.querySelector('#empty');
const extractButton = document.querySelector('#extract');
const status = document.querySelector('#status');
const palette = document.querySelector('#palette');
const MAX_BYTES = 10 * 1024 * 1024;
const WORKING_EDGE = 240; // At most 57,600 working pixels; sample at most 6,000.
let selectionVersion = 0;
let selectedImage = null;
const paletteSizeInput = document.querySelector('#palette-size');
const paletteSizeLabel = document.querySelector('#palette-size-label');
const reconstruction = document.querySelector('#reconstruction');
const comparisonEmpty = document.querySelector('#comparison-empty');
const originalWorking = document.querySelector('#original-working');
const downloadButton = document.querySelector('#download');
const resetButton = document.querySelector('#reset');
let currentResult = null;
const descriptionInput = document.querySelector('#description');
const generateButton = document.querySelector('#generate');
const generationStatus = document.querySelector('#generation-status');
const generatedImage = document.querySelector('#generated-image');
const generatedAnalysis = document.querySelector('#generated-analysis');
const generatedPalette = document.querySelector('#generated-palette');
let generationVersion = 0;
let generationController = null;
let generatedObjectUrl = null;

paletteSizeInput.addEventListener('change', () => {
  paletteSizeLabel.textContent = `${paletteSizeInput.value} colours`;
  if (selectedImage) setStatus('Palette size updated. Extract again to apply it.');
});
descriptionInput.addEventListener('input', updateGenerateAvailability);

function setStatus(message, state = 'ready') {
  status.textContent = message;
  status.dataset.state = state;
}

function setGenerationStatus(message, state = 'ready') { generationStatus.textContent = message; generationStatus.dataset.state = state; }
function updateGenerateAvailability() { generateButton.disabled = !currentResult || !descriptionInput.value.trim() || Boolean(generationController); }
function clearGeneratedResult(message = 'Extract a palette and add a description to begin.') {
  generationVersion++;
  if (generationController) generationController.abort();
  generationController = null;
  if (generatedObjectUrl) URL.revokeObjectURL(generatedObjectUrl);
  generatedObjectUrl = null;
  generatedImage.hidden = true;
  generatedImage.removeAttribute('src');
  generatedAnalysis.hidden = true;
  generatedPalette.replaceChildren();
  generateButton.disabled = true;
  setGenerationStatus(message);
}

function analyzeImage(image, paletteSize) {
  const scale = Math.min(1, WORKING_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return { result: mergeTinyClusters(kMeans(samplePixels(pixels), paletteSize)), width: canvas.width, height: canvas.height };
}

function renderComparisonPalette(list, result) {
  list.replaceChildren();
  for (const cluster of result.clusters) {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'swatch'; swatch.style.backgroundColor = cluster.hex; swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('code'); label.textContent = cluster.hex;
    const percentage = document.createElement('span');
    percentage.className = 'percentage-label';
    percentage.textContent = `— ${((cluster.count / result.sampleCount) * 100).toFixed(1)}% of sampled pixels`;
    item.append(swatch, label, percentage);
    list.append(item);
  }
}

function clearResults() {
  currentResult = null;
  clearGeneratedResult();
  palette.replaceChildren();
  downloadButton.disabled = true;
  reconstruction.hidden = true;
  reconstruction.width = 0;
  reconstruction.height = 0;
  originalWorking.width = 0;
  originalWorking.height = 0;
  comparisonEmpty.hidden = false;
}

async function copyHex(button, hex) {
  try {
    await navigator.clipboard.writeText(hex);
    const original = button.textContent;
    button.textContent = 'Copied';
    button.disabled = true;
    setTimeout(() => { button.textContent = original; button.disabled = false; }, 1200);
  } catch {
    button.textContent = 'Copy failed';
    setTimeout(() => { button.textContent = 'Copy HEX'; }, 1600);
  }
}

function downloadPalette() {
  if (!currentResult) return;
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = Math.max(180, currentResult.clusters.length * 112 + 36);
  const context = canvas.getContext('2d');
  context.fillStyle = '#FCFAF7';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = '600 30px sans-serif';
  context.fillStyle = '#282625';
  context.fillText('Colour Palette Lab', 36, 48);
  currentResult.clusters.forEach((cluster, index) => {
    const y = 72 + index * 112;
    context.fillStyle = cluster.hex;
    context.fillRect(36, y, 160, 80);
    context.fillStyle = '#282625';
    context.font = '24px monospace';
    context.fillText(cluster.hex, 224, y + 48);
  });
  canvas.toBlob(blob => {
    if (!blob) { setStatus('Could not create the palette download.', 'error'); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'colour-palette.png';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Palette PNG downloaded.', 'success');
  }, 'image/png');
}

async function selectImage(file, name) {
  const version = ++selectionVersion;
  selectedImage = null;
  extractButton.disabled = true;
  clearResults();
  reconstruction.hidden = true;
  reconstruction.width = 0;
  reconstruction.height = 0;
  comparisonEmpty.hidden = false;
  preview.hidden = true;
  preview.removeAttribute('src');
  empty.hidden = false;
  document.querySelector('#filename').textContent = 'Your inspiration goes here.';
  document.querySelector('#image-info').textContent = 'Nothing selected';
  setStatus('Loading image…', 'loading');
  let objectUrl;
  try {
    if (file) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPG or PNG file.');
      if (file.size > MAX_BYTES) throw new Error('This file is too large. Choose a JPG or PNG of 10 MB or less.');
      objectUrl = URL.createObjectURL(file);
    }
    const image = new Image();
    image.src = objectUrl || 'assets/still-life.svg';
    try { await image.decode(); }
    catch { throw new Error('This image could not be read. Try another JPG or PNG.'); }
    if (version !== selectionVersion) return;
    // Give the visible element its own decoded resource before releasing the URL.
    preview.src = image.src;
    await preview.decode();
    if (version !== selectionVersion) return;
    selectedImage = image;
    preview.hidden = false;
    empty.hidden = true;
    document.querySelector('#filename').textContent = name;
    document.querySelector('#image-info').textContent = `${image.naturalWidth} × ${image.naturalHeight}`;
    extractButton.disabled = false;
    setStatus('Image ready. Extract a representative palette.');
  } catch (error) {
    if (version === selectionVersion) setStatus(error.message, 'error');
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) selectImage(file, file.name);
  fileInput.value = ''; // Allow retrying the same file after an error.
});
document.querySelector('#sample').addEventListener('click', () => selectImage(null, 'Studio still life · original bundled sample'));
downloadButton.addEventListener('click', downloadPalette);
generateButton.addEventListener('click', async () => {
  if (!currentResult || !descriptionInput.value.trim() || generationController) return;
  clearGeneratedResult('Generating image…');
  const version = generationVersion;
  generationController = new AbortController();
  const controller = generationController;
  updateGenerateAvailability();
  setGenerationStatus('Generating image…', 'loading');
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ description: descriptionInput.value.trim(), colours: currentResult.clusters.map(cluster => cluster.hex) }) });
    const payload = await response.json().catch(() => ({}));
    if (version !== generationVersion) return;
    if (!response.ok) throw new Error(payload.error?.message || `Backend request failed (${response.status}).`);
    if (typeof payload.image_base64 !== 'string' || typeof payload.mime_type !== 'string') throw new Error('Backend returned an invalid image response.');
    const binary = Uint8Array.from(atob(payload.image_base64), char => char.charCodeAt(0));
    if (generatedObjectUrl) URL.revokeObjectURL(generatedObjectUrl);
    generatedObjectUrl = URL.createObjectURL(new Blob([binary], { type: payload.mime_type }));
    generatedImage.src = generatedObjectUrl;
    generatedImage.hidden = false;
    await generatedImage.decode();
    if (version !== generationVersion) return;
    const generatedAnalysisResult = analyzeImage(generatedImage, Number(paletteSizeInput.value));
    if (generatedAnalysisResult.width < 1 || generatedAnalysisResult.height < 1) throw new Error('Generated image has no usable dimensions.');
    renderComparisonPalette(generatedPalette, generatedAnalysisResult.result);
    generatedAnalysis.hidden = false;
    setGenerationStatus('Generated image ready. Its colours were guided by your palette.', 'success');
  } catch (error) {
    if (version !== generationVersion) return;
    if (error.name === 'AbortError') setGenerationStatus('Generation was abandoned. The backend may still finish processing it.');
    else setGenerationStatus(error.message || 'Could not reach the generation backend.', 'error');
  } finally {
    if (version === generationVersion) { generationController = null; updateGenerateAvailability(); }
  }
});
resetButton.addEventListener('click', () => {
  selectionVersion++;
  selectedImage = null;
  clearResults();
  preview.hidden = true;
  preview.removeAttribute('src');
  empty.hidden = false;
  extractButton.disabled = true;
  fileInput.value = '';
  descriptionInput.value = '';
  document.querySelector('#filename').textContent = 'Your inspiration goes here.';
  document.querySelector('#image-info').textContent = 'Nothing selected';
  setStatus('Choose an image to begin.');
  clearGeneratedResult();
});

extractButton.addEventListener('click', async () => {
  if (!selectedImage) return;
  const version = selectionVersion;
  const image = selectedImage;
  extractButton.disabled = true;
  clearResults();
  setStatus('Extracting colours…', 'loading');
  // Allow the loading message to paint before bounded synchronous computation.
  await new Promise(resolve => setTimeout(resolve, 30));
  if (version !== selectionVersion) return;
  try {
    const scale = Math.min(1, WORKING_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    originalWorking.width = canvas.width;
    originalWorking.height = canvas.height;
    originalWorking.getContext('2d').drawImage(canvas, 0, 0);
    const samples = samplePixels(context.getImageData(0, 0, canvas.width, canvas.height).data);
    const paletteSize = Number(document.querySelector('#palette-size').value);
    const result = mergeTinyClusters(kMeans(samples, paletteSize));
    currentResult = result;
    clearGeneratedResult('Extracted palette ready. Add a description to generate an image.');
    // Map each working pixel to the nearest cleaned cluster colour for comparison.
    const reconstructedPixels = mapPixelsToPalette(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, result.clusters);
    reconstruction.width = reconstructedPixels.width;
    reconstruction.height = reconstructedPixels.height;
    reconstruction.getContext('2d').putImageData(new ImageData(reconstructedPixels.data, reconstructedPixels.width, reconstructedPixels.height), 0, 0);
    reconstruction.hidden = false;
    comparisonEmpty.hidden = true;
    for (const cluster of result.clusters) {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.backgroundColor = cluster.hex;
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('code');
      label.textContent = cluster.hex;
      
      //my own conribution: add percentage of sampled pixels to the label
      const percentage = (cluster.count / result.sampleCount) * 100;
      const percentageLabel = document.createElement('span');
      percentageLabel.textContent = `${percentage.toFixed(1)}% of sampled pixels`;

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'copy-button';
      copyButton.textContent = 'Copy HEX';
      copyButton.addEventListener('click', () => copyHex(copyButton, cluster.hex));
      item.append(swatch, label, percentageLabel, copyButton);
      palette.append(item);
    }
    downloadButton.disabled = false;
    updateGenerateAvailability();
    const count = result.clusters.length;
    setStatus(count < paletteSize
      ? `Palette ready: ${count} representative ${count === 1 ? 'colour' : 'colours'}; reconstructed comparison created. Very small blended edge clusters may be merged.`
      : 'Palette ready: representative colours and reconstructed comparison created. Very small blended edge clusters may be merged.', 'success');
  } catch (error) {
    setStatus(error.message || 'Could not analyse this image. Try another JPG or PNG.', 'error');
  } finally {
    if (version === selectionVersion) extractButton.disabled = false;
  }
});
