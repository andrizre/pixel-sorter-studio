// test.js — verify the sorting engine headlessly in Node.
const { METRICS, generateSource, pixelSort } =
  require('./sorter-node.cjs');

const W = 200, H = 100;
const px = generateSource(W, H, 1337);

// Sanity: source is not uniform
let sum = 0;
for (let i = 0; i < px.length; i += 4) sum += px[i];
console.log('generated avg R:', (sum / (W * H)).toFixed(2), '(expect non-trivial)');

for (const mode of Object.keys(METRICS)) {
  const data = new Uint8ClampedArray(px);
  const t0 = Date.now();
  const ops = pixelSort(data, W, H, 'h', {
    metricFn: METRICS[mode], tMin: 0.1, tMax: 0.85, intervalPct: 1, reverse: true,
  });
  console.log(`mode=${mode.padEnd(11)} ops=${String(ops).padStart(3)} ms=${Date.now() - t0}`);
}

// Verify sorting actually happened: brightness of row 50 should be monotonic within intervals
const data = new Uint8ClampedArray(px);
pixelSort(data, W, H, 'h', { metricFn: METRICS.brightness, tMin: 0.05, tMax: 0.95, intervalPct: 1, reverse: false });
let sortedRuns = 0, total = 0;
for (let y = 0; y < H; y++) {
  let mono = true, hasBand = false;
  for (let x = 1; x < W; x++) {
    const o1 = (y * W + x - 1) * 4, o2 = (y * W + x) * 4;
    const b1 = METRICS.brightness(data[o1], data[o1+1], data[o1+2]);
    const b2 = METRICS.brightness(data[o2], data[o2+1], data[o2+2]);
    if (b1 > 0.05 && b1 < 0.95) { hasBand = true; if (b2 < b1 - 0.02 && b2 > 0.05 && b2 < 0.95) mono = false; }
  }
  if (hasBand) { total++; if (mono) sortedRuns++; }
}
console.log(`monotonic rows: ${sortedRuns}/${total}`);
if (sortedRuns / total < 0.9) { console.error('SORT VERIFICATION FAILED'); process.exit(1); }
console.log('ALL CHECKS PASSED');
