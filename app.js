// app.js — UI wiring and canvas management.

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const W = 800, H = 600;
canvas.width = W;
canvas.height = H;

let baseData = null;   // pristine source ImageData (for reset / mix)
let animTimer = null;

const $ = (id) => document.getElementById(id);

function readOpts() {
  const mode = $('modeSelect').value;
  const tMin = $('thrMin').value / 100;
  const tMax = $('thrMax').value / 100;
  $('thrVal').textContent = `${tMin.toFixed(2)} – ${tMax.toFixed(2)}`;
  const iv = $('interval').value / 100;
  $('intVal').textContent = `${$('interval').value}%`;
  const nz = $('noise').value / 100;
  $('noiseVal').textContent = $('noise').value;
  const mixv = $('mix').value / 100;
  $('mixVal').textContent = `${$('mix').value}%`;
  return {
    metricFn: METRICS[mode],
    tMin: Math.min(tMin, tMax - 0.01),
    tMax: Math.max(tMax, tMin + 0.01),
    intervalPct: iv,
    noise: nz,
    reverse: $('reverse').checked,
    dir: $('dirSelect').value,
    mix: mixv,
  };
}

function renderSorted() {
  if (!baseData) return;
  const opts = readOpts();
  const src = new Uint8ClampedArray(baseData.data);
  // Optional noise: perturb metrics slightly per line to break uniformity.
  const t0 = performance.now();
  const ops = pixelSort(src, W, H, opts.dir, opts);

  // Blend with original.
  if (opts.mix < 1) {
    for (let i = 0; i < src.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        src[i + c] = src[i + c] * opts.mix + baseData.data[i + c] * (1 - opts.mix);
      }
    }
  }
  const img = new ImageData(src, W, H);
  ctx.putImageData(img, 0, 0);
  const dt = (performance.now() - t0).toFixed(1);
  status.textContent = `${ops} intervals sorted in ${dt} ms`;
}

function loadGenerated() {
  const seed = parseInt($('seedInput').value, 10) || 0;
  const px = generateSource(W, H, seed);
  baseData = new ImageData(px, W, H);
  ctx.putImageData(baseData, 0, 0);
  status.textContent = `Generated image (seed ${seed})`;
}

function loadFile(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    // Fit image into W x H canvas (cover-crop).
    const sc = Math.max(W / img.width, H / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    baseData = ctx.getImageData(0, 0, W, H);
    URL.revokeObjectURL(url);
    status.textContent = `Loaded ${file.name}`;
    renderSorted();
  };
  img.src = url;
}

// Events
$('fileInput').addEventListener('change', (e) => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});
$('genBtn').addEventListener('click', () => { loadGenerated(); renderSorted(); });
$('regenBtn').addEventListener('click', () => {
  $('seedInput').value = (Math.random() * 99999) | 0;
  loadGenerated(); renderSorted();
});
$('sortBtn').addEventListener('click', renderSorted);
$('resetBtn').addEventListener('click', () => {
  stopAnim();
  if (baseData) { ctx.putImageData(baseData, 0, 0); status.textContent = 'Reset to source'; }
});
$('saveBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'pixel-sort.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
});

$('animBtn').addEventListener('click', () => {
  if (animTimer) { stopAnim(); return; }
  $('animBtn').textContent = '⏸ Stop evolving';
  // Auto-evolve: perturb seed-ish params each tick and re-sort the
  // CURRENT canvas (feedback loop creates deepening glitch trails).
  animTimer = setInterval(() => {
    if (!baseData) return;
    // Use current canvas as the new source for iterative glitching.
    baseData = ctx.getImageData(0, 0, W, H);
    const opts = readOpts();
    // Drift thresholds for evolving look.
    const drift = (Math.random() - 0.5) * 0.06;
    opts.tMin = Math.max(0, opts.tMin + drift);
    opts.tMax = Math.min(1, opts.tMax + drift * 0.5);
    pixelSort(baseData.data, W, H, opts.dir, opts);
    ctx.putImageData(baseData, 0, 0);
    status.textContent = 'auto-evolving…';
  }, 350);
});

function stopAnim() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
  $('animBtn').textContent = '⟳ Auto-evolve';
}

// Init with procedural image.
loadGenerated();
renderSorted();
