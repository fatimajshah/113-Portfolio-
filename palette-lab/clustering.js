// Pure colour analysis: no DOM, canvas, or randomness.
export function squaredDistance(a, b) {
  return a.reduce((sum, channel, i) => sum + (channel - b[i]) ** 2, 0);
}
// Checking closest pallette color
export function nearestIndex(colour, centres) {
  let best = 0;
  for (let i = 1; i < centres.length; i++) {
    if (squaredDistance(colour, centres[i]) < squaredDistance(colour, centres[best])) best = i;
  }
  return best;
}

// Reconstructing the image
export function mapPixelsToPalette(rgba, width, height, clusters) {
  if (rgba.length !== width * height * 4) throw new Error('Pixel data does not match canvas dimensions.');
  const output = new Uint8ClampedArray(rgba.length);
  const colours = clusters.map(cluster => cluster.rgb);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const colour = [rgba[offset], rgba[offset + 1], rgba[offset + 2]];
    const mapped = colours[nearestIndex(colour, colours)];
    output[offset] = mapped[0]; output[offset + 1] = mapped[1]; output[offset + 2] = mapped[2]; output[offset + 3] = 255;
  }
  return { data: output, width, height };
}

// Converting RGB to HEX
export function toHex(rgb) {
  return '#' + rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Edited myself: merge RGB clusters below 1.5% into the nearest larger cluster so tiny edge colours do not dominate the final palette.
export const MIN_CLUSTER_SHARE = 0.015;
export function mergeTinyClusters(result, threshold = MIN_CLUSTER_SHARE) {
  const minimumCount = result.sampleCount * threshold;
  const clusters = result.clusters.map(cluster => ({ ...cluster, rgb: cluster.rgb.slice() }));
  if (clusters.length <= 1) return { ...result, clusters };
  let tiny = clusters.filter(cluster => cluster.count < minimumCount).sort((a, b) => a.count - b.count);
  const larger = clusters.filter(cluster => cluster.count >= minimumCount);
  if (!larger.length) {
    const largest = clusters.reduce((current, cluster) => cluster.count > current.count ? cluster : current);
    larger.push(largest);
    tiny = tiny.filter(cluster => cluster !== largest);
  }
  for (const small of tiny) {
    if (larger.length === 1 && larger[0] === small) continue;
    const target = larger.reduce((nearest, candidate) => squaredDistance(small.rgb, candidate.rgb) < squaredDistance(small.rgb, nearest.rgb) ? candidate : nearest);
    const total = target.count + small.count;
    target.rgb = target.rgb.map((channel, index) => (channel * target.count + small.rgb[index] * small.count) / total);
    target.count = total;
  }
  const merged = larger.map(cluster => ({ ...cluster, hex: toHex(cluster.rgb), rgb: cluster.rgb.map(Math.round) }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
  return { ...result, clusters: merged };
}

// Keep transparent pixels out
export function samplePixels(rgba, limit = 6000) {
  const visible = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    if (alpha === 0) continue;
    visible.push([0, 1, 2].map(c => Math.round(rgba[i + c] * alpha + 255 * (1 - alpha))));
  }
  const count = Math.min(limit, visible.length);
  return Array.from({ length: count }, (_, i) => visible[Math.floor(i * visible.length / count)]);
}

// my own contribution, added to handle fully transparent images with no visible colour samples.

export function initializeCentres(samples, k) {
  if (!samples.length) {
    throw new Error('Cannot initialize centres without samples.');
  }

  const unique = [
    ...new Map(samples.map(rgb => [rgb.join(','), rgb])).values()
  ];
  const centres = [unique[0].slice()]; //Choosing the first centre
  while (centres.length < Math.min(k, unique.length)) { //The loop continues until it has either the requested number of centres, or one centre for every unique colour available.
    let farthest = unique[0];
    let largestDistance = -1;
    for (const rgb of unique) {
      const distance = squaredDistance(rgb, centres[nearestIndex(rgb, centres)]);
      if (distance > largestDistance) {
        largestDistance = distance;
        farthest = rgb;
      }
    }
    centres.push(farthest.slice());
  }
  return centres;
}
// main clustering algorithm.
export function kMeans(samples, k = 5, maxIterations = 30) {
  if (!samples.length) throw new Error('No visible pixels found. Choose an image with visible content.');
  if (!Number.isInteger(k) || k < 1) throw new Error('Palette size must be a positive integer.'); //If there are no visible pixels, the function stops with an error.
  let centres = initializeCentres(samples, k);
  let iterations = 0;
  for (; iterations < maxIterations; iterations++) { //The algorithm repeats at most 30 times.
    const sums = centres.map(() => [0, 0, 0]);//Phase 1: assign pixels to centres
    const counts = centres.map(() => 0); //Phase 2: update the centres
    for (const rgb of samples) {
      const index = nearestIndex(rgb, centres);
      counts[index]++;
      rgb.forEach((channel, c) => { sums[index][c] += channel; });
    }
    // Retain an empty centre instead of dividing by zero.
    const next = centres.map((centre, i) => counts[i] ? sums[i].map(sum => sum / counts[i]) : centre);
    const converged = centres.every((centre, i) => squaredDistance(centre, next[i]) < 0.25);
    centres = next;
    if (converged) { iterations++; break; }
  }
  // Round and merge identical final colours, then recount using the displayed centres.
  const rounded = [...new Map(centres.map(rgb => [toHex(rgb), rgb.map(Math.round)])).values()]; 
  const counts = rounded.map(() => 0);
  samples.forEach(rgb => { counts[nearestIndex(rgb, rounded)]++; });
  const clusters = rounded.map((rgb, i) => ({ rgb, hex: toHex(rgb), count: counts[i] }))
    .filter(cluster => cluster.count > 0)
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
  return { clusters, sampleCount: samples.length, iterations };
}
