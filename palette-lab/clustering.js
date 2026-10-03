// Pure colour analysis: no DOM, canvas, or randomness.
export function squaredDistance(a, b) {
  return a.reduce((sum, channel, i) => sum + (channel - b[i]) ** 2, 0);
}

export function nearestIndex(colour, centres) {
  let best = 0;
  for (let i = 1; i < centres.length; i++) {
    if (squaredDistance(colour, centres[i]) < squaredDistance(colour, centres[best])) best = i;
  }
  return best;
}

export function toHex(rgb) {
  return '#' + rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Keep transparent pixels out; composite partial alpha on white before clustering.
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

// Farthest-first initialization is deterministic. Ties use input order.
export function initializeCentres(samples, k) {
  const unique = [...new Map(samples.map(rgb => [rgb.join(','), rgb])).values()];
  const centres = [unique[0].slice()];
  while (centres.length < Math.min(k, unique.length)) {
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

export function kMeans(samples, k = 5, maxIterations = 30) {
  if (!samples.length) throw new Error('No visible pixels found. Choose an image with visible content.');
  if (!Number.isInteger(k) || k < 1) throw new Error('Palette size must be a positive integer.');
  let centres = initializeCentres(samples, k);
  let iterations = 0;
  for (; iterations < maxIterations; iterations++) {
    const sums = centres.map(() => [0, 0, 0]);
    const counts = centres.map(() => 0);
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
