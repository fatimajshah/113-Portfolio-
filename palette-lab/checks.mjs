// Run with node palette-lab/checks.mjs. No installation needed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./clustering.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const { kMeans, mapPixelsToPalette, mergeTinyClusters, samplePixels } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const red = [255, 0, 0], blue = [0, 0, 255];
assert.deepEqual(kMeans([red, red], 5).clusters, [{ rgb: red, hex: '#FF0000', count: 2 }]);
const two = kMeans([red, red, blue], 2);
assert.deepEqual(two.clusters.map(c => c.hex), ['#FF0000', '#0000FF']);
assert.deepEqual(two.clusters.map(c => c.count), [2, 1]);
assert.equal(kMeans([red, blue], 8).clusters.length, 2);
assert.deepEqual(kMeans([red, red, blue], 2), two);
assert.deepEqual(samplePixels([0, 0, 0, 0, 255, 0, 0, 128]), [[255, 127, 127]]);
assert.throws(() => kMeans(samplePixels([0, 0, 0, 0])), /No visible pixels/);
const varied = Array.from({ length: 7000 }, (_, i) => [i % 256, (i * 7) % 256, (i * 13) % 256]);
const rgba = varied.flatMap(rgb => [...rgb, 255]);
assert.equal(samplePixels(rgba).length, 6000);
const result = kMeans(samplePixels(rgba));
assert.equal(result.clusters.reduce((n, c) => n + c.count, 0), 6000);
assert.ok(result.clusters.every(c => /^#[0-9A-F]{6}$/.test(c.hex)));
assert.deepEqual(result, kMeans(samplePixels(rgba)));
const ghanaLike = { sampleCount: 10000, clusters: [
  { rgb: [206, 17, 38], hex: '#CE1126', count: 4500 }, { rgb: [252, 209, 22], hex: '#FCD116', count: 3000 },
  { rgb: [0, 122, 61], hex: '#007A3D', count: 1500 }, { rgb: [20, 20, 20], hex: '#141414', count: 900 },
  { rgb: [120, 115, 70], hex: '#787346', count: 100 }
] };
const mergedGhana = mergeTinyClusters(ghanaLike);
assert.equal(mergedGhana.clusters.length, 4);
assert.equal(mergedGhana.clusters.reduce((sum, cluster) => sum + cluster.count, 0), 10000);
const majorTwo = mergeTinyClusters({ sampleCount: 10000, clusters: [
  { rgb: red, hex: '#FF0000', count: 5000 }, { rgb: blue, hex: '#0000FF', count: 5000 }
] });
assert.deepEqual(majorTwo.clusters.map(cluster => cluster.hex).sort(), ['#FF0000', '#0000FF'].sort());
const accent = mergeTinyClusters({ sampleCount: 10000, clusters: [
  { rgb: red, hex: '#FF0000', count: 8000 }, { rgb: blue, hex: '#0000FF', count: 1850 },
  { rgb: [255, 200, 0], hex: '#FFC800', count: 150 }
] });
assert.equal(accent.clusters.length, 3);
assert.ok(Math.abs(accent.clusters.reduce((sum, cluster) => sum + cluster.count, 0) / accent.sampleCount * 100 - 100) < 0.001);
const mapped = mapPixelsToPalette(Uint8ClampedArray.from([255, 0, 0, 255, 0, 0, 255, 255]), 2, 1, majorTwo.clusters);
assert.equal(mapped.width, 2);
assert.equal(mapped.height, 1);
assert.equal(mapped.data.length, 2 * 1 * 4);
assert.deepEqual(Array.from(mapped.data), [255, 0, 0, 255, 0, 0, 255, 255]);
assert.throws(() => mapPixelsToPalette(new Uint8ClampedArray(4), 2, 1, majorTwo.clusters), /dimensions/);
assert.match(htmlSource, /id="download"[^>]+disabled/);
assert.match(htmlSource, /id="reset"/);
assert.match(appSource, /textContent = 'Copied'/);
assert.match(appSource, /downloadButton\.disabled = false/);
assert.match(appSource, /selectionVersion\+\+/);
assert.match(appSource, /fileInput\.value = ''/);
console.log('PASS: k-means basics; alpha and bounds; tiny-cluster cases; percentages total ~100%; copy success state; download initial/enabled states; reset and same-file reset hooks.');
