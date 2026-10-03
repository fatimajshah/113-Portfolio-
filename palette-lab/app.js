import { kMeans, samplePixels } from './clustering.js';

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

function setStatus(message, state = 'ready') {
  status.textContent = message;
  status.dataset.state = state;
}

async function selectImage(file, name) {
  const version = ++selectionVersion;
  selectedImage = null;
  extractButton.disabled = true;
  palette.replaceChildren();
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
    setStatus('Image ready. Extract a five-colour palette.');
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

extractButton.addEventListener('click', async () => {
  if (!selectedImage) return;
  const version = selectionVersion;
  const image = selectedImage;
  extractButton.disabled = true;
  palette.replaceChildren();
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
    const samples = samplePixels(context.getImageData(0, 0, canvas.width, canvas.height).data);
    const result = kMeans(samples, 5);
    for (const cluster of result.clusters) {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.backgroundColor = cluster.hex;
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('code');
      label.textContent = cluster.hex;
      
      const percentage = (cluster.count / result.sampleCount) * 100;
      const percentageLabel = document.createElement('span');
      percentageLabel.textContent = `${percentage.toFixed(1)}% of sampled pixels`;
      
      item.append(swatch, label, percentageLabel);
      palette.append(item);
    }
    const count = result.clusters.length;
    setStatus(count < 5
      ? `Palette ready: ${count} ${count === 1 ? 'colour' : 'colours'}. Fewer than five distinct representative colours remain after sampling and rounding.`
      : 'Palette ready: five representative colours.', 'success');
  } catch (error) {
    setStatus(error.message || 'Could not analyse this image. Try another JPG or PNG.', 'error');
  } finally {
    if (version === selectionVersion) extractButton.disabled = false;
  }
});
