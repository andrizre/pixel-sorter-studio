// sorter.js — pure pixel-sorting engine, no DOM dependencies.

/**
 * Key function: extract a sortable metric from an [r,g,b,a] tuple.
 */
const METRICS = {
  brightness: (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
  lightness:  (r, g, b) => (Math.max(r, g, b) + Math.min(r, g, b)) / (2 * 255),
  hue: (r, g, b) => rgbToHue(r, g, b),
  saturation: (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  },
  red:   (r) => r / 255,
  green: (_r, g) => g / 255,
  blue:  (_r, _g, b) => b / 255,
};

function rgbToHue(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return -1; // grays sort first, consistently
  let h;
  if (mx === r) h = ((g - b) / d + 6) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h / 6;
}

/**
 * Find sorted intervals inside a single row/column of pixels.
 * An interval starts where the metric rises above thresholdMin and
 * ends when it falls below thresholdMax — the classic Kim Asendorf
 * pixel-sorting definition, generalized to arbitrary metrics.
 *
 * px: Uint8ClampedArray (RGBA), lineStart: first pixel index of the line,
 * step: pixels to advance (1 for row, width for column),
 * count: number of pixels in the line.
 */
function sortLine(px, lineStart, step, count, opts) {
  const { metricFn, tMin, tMax, intervalPct, reverse } = opts;

  // Build the metric array for this line.
  const vals = new Float32Array(count);
  const idx = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const o = (lineStart + i * step) * 4;
    idx[i] = o;
    vals[i] = metricFn(px[o], px[o + 1], px[o + 2]);
  }

  // Detect intervals where value is between tMin and tMax.
  const intervals = [];
  let start = -1;
  for (let i = 0; i < count; i++) {
    const inBand = vals[i] >= tMin && vals[i] <= tMax;
    if (inBand && start === -1) start = i;
    if ((!inBand || i === count - 1) && start !== -1) {
      const end = (!inBand) ? i - 1 : i;
      if (end - start + 1 >= 2) intervals.push([start, end]);
      start = -1;
    }
  }

  // Keep only the longest contiguous runs, limited by intervalPct.
  if (intervals.length === 0) return 0;
  const totalLen = intervals.reduce((s, [a, b]) => s + (b - a + 1), 0);
  let budget = Math.max(2, Math.floor(totalLen * intervalPct));
  // Sort intervals by length desc, drop until within budget (greedy).
  intervals.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  const kept = [];
  for (const iv of intervals) {
    const len = iv[1] - iv[0] + 1;
    if (budget >= len) { kept.push(iv); budget -= len; }
  }

  let ops = 0;
  for (const [a, b] of kept) {
    const slice = [];
    for (let i = a; i <= b; i++) {
      const o = idx[i];
      slice.push(px[o], px[o + 1], px[o + 2], px[o + 3]);
    }
    const metricIdx = (j) => {
      const o = idx[a + j];
      return vals[a + j];
    };
    const order = Array.from({ length: b - a + 1 }, (_, j) => j);
    order.sort((x, y) => metricIdx(x) - metricIdx(y));
    if (reverse) order.reverse();
    for (let j = 0; j < order.length; j++) {
      const src = order[j] * 4;
      const o = idx[a + j];
      px[o] = slice[src]; px[o + 1] = slice[src + 1];
      px[o + 2] = slice[src + 2]; px[o + 3] = slice[src + 3];
    }
    ops++;
  }
  return ops;
}

/**
 * Sort the whole image. data: Uint8ClampedArray RGBA; w,h dimensions.
 * dir: 'h' | 'v'. Returns number of intervals sorted.
 */
function pixelSort(data, w, h, dir, opts) {
  let ops = 0;
  if (dir === 'h') {
    for (let y = 0; y < h; y++) {
      ops += sortLine(data, y * w, 1, w, opts);
    }
  } else {
    for (let x = 0; x < w; x++) {
      ops += sortLine(data, x, w, h, opts);
    }
  }
  return ops;
}

/** Mulberry32 seeded PRNG for procedural source images. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a procedural source image: layered flow-field color bands +
 * radial gradients, seeded. Produces rich gradients that sort beautifully.
 */
function generateSource(w, h, seed) {
  const rnd = mulberry32(seed);
  const px = new Uint8ClampedArray(w * h * 4);

  // Random color anchors.
  const anchors = Array.from({ length: 5 }, () => [
    rnd() * 360, 40 + rnd() * 50, 30 + rnd() * 50, // h,s,l
  ]);
  const palette = anchors.map(([hh, ss, ll]) => hslToRgb(hh / 360, ss / 100, ll / 100));

  // Flow field params.
  const fx = rnd() * 0.02 + 0.005, fy = rnd() * 0.02 + 0.005;
  const fx2 = rnd() * 0.05 + 0.01, fy2 = rnd() * 0.05 + 0.01;
  const phase = rnd() * Math.PI * 2;
  const blobs = Array.from({ length: 4 }, () => ({
    x: rnd() * w, y: rnd() * h, r: (0.15 + rnd() * 0.35) * Math.min(w, h),
    c: palette[(rnd() * palette.length) | 0],
  }));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = Math.sin(x * fx + y * fy + phase) * 0.5 + 0.5;
      const u = Math.cos(x * fx2 - y * fy2) * 0.5 + 0.5;
      const m = (t + u) / 2;
      const i = m * (palette.length - 1);
      const a0 = palette[i | 0], a1 = palette[Math.min((i | 0) + 1, palette.length - 1)];
      const f = i - (i | 0);
      let r = a0[0] + (a1[0] - a0[0]) * f;
      let g = a0[1] + (a1[1] - a0[1]) * f;
      let b = a0[2] + (a1[2] - a0[2]) * f;
      // Radial blobs add hard-ish edges for threshold work.
      for (const bl of blobs) {
        const d = Math.hypot(x - bl.x, y - bl.y) / bl.r;
        if (d < 1) {
          const k = (1 - d) * 0.55;
          r = r + (bl.c[0] - r) * k;
          g = g + (bl.c[1] - g) * k;
          b = b + (bl.c[2] - b) * k;
        }
      }
      const o = (y * w + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  return px;
}

function hslToRgb(h, s, l) {
  const hue2 = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2(p, q, h + 1 / 3);
    g = hue2(p, q, h);
    b = hue2(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}
