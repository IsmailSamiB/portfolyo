#!/usr/bin/env node
// Logoyu pixel art görünüme çevirir.
// Kullanım: node scripts/pixelate-logo.mjs <girdi> <çıktı.png> [--grid 32] [--colors 12] [--out 128] [--key-white] [--margin 0.04] [--crop x,y,w,h]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

function fail(msg) { console.error('Hata: ' + msg); process.exit(1); }

// --- Argüman ayrıştırma ---
const argv = process.argv.slice(2);
const pos = [];
const opt = { grid: 32, colors: 12, out: 128, margin: 0.04, keyWhite: false, crop: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--key-white') opt.keyWhite = true;
  else if (['--grid', '--colors', '--out', '--margin', '--crop'].includes(a)) {
    if (a === '--crop') { const c = (argv[++i] || '').split(',').map(Number); if (c.length !== 4 || c.some((n) => !Number.isFinite(n))) fail('--crop x,y,w,h biçiminde (0-1 oran) olmalı.'); opt.crop = c; continue; }
    const v = Number(argv[++i]);
    if (!Number.isFinite(v)) fail(`${a} için sayısal değer gerekli.`);
    opt[a.slice(2)] = v;
  } else if (a.startsWith('--')) fail(`Bilinmeyen bayrak: ${a}`);
  else pos.push(a);
}
if (pos.length < 2) fail('Kullanım: node scripts/pixelate-logo.mjs <girdi> <çıktı.png> [--grid 32] [--colors 12] [--out 128] [--key-white]');
const [inFile, outFile] = pos;
if (!fs.existsSync(inFile)) fail(`Girdi dosyası bulunamadı: ${inFile}`);
if (opt.grid < 4 || opt.colors < 2 || opt.out < opt.grid) fail('Geçersiz değer: grid>=4, colors>=2, out>=grid olmalı.');
const { grid, colors, out } = opt;

// --- Girdiyi RGBA olarak oku (SVG için yüksek yoğunluk) ---
let src;
try {
  const isSvg = /\.svg$/i.test(inFile);
  src = sharp(inFile, isSvg ? { density: 600 } : {}).ensureAlpha();
  var { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
} catch (e) { fail(`Girdi okunamadı (${e.message})`); }
let { width: W, height: H } = info;
// Çok büyük girdileri makul boyuta indir
if (Math.max(W, H) > 2048) {
  const r = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .resize(2048, 2048, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  data = r.data; W = r.info.width; H = r.info.height;
}

// --- İsteğe bağlı kırpma: görüntünün oranı olarak x,y,w,h (yalnız simgeyi almak için) ---
if (opt.crop) {
  const [cx, cy, cwf, chf] = opt.crop;
  const ax = Math.round(cx * W), ay = Math.round(cy * H), bx = Math.round((cx + cwf) * W), by = Math.round((cy + chf) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < ax || x >= bx || y < ay || y >= by) data[(y * W + x) * 4 + 3] = 0;
}

// --- Beyaz zemini kenardan taşkın doldurma ile sil ---
if (opt.keyWhite) {
  const isBg = (p) => data[p + 3] < 16 || (data[p] > 235 && data[p + 1] > 235 && data[p + 2] > 235);
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (seen[i] || !isBg(i * 4)) return;
    seen[i] = 1; stack.push(i);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const i = stack.pop(); const x = i % W, y = (i - x) / W;
    data[i * 4 + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // Silinen bölgenin kenarındaki açık renkli (beyaza yakın) halka pikselleri de temizle
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4 + 3] === 0) continue;
    const x = i % W, y = (i - x) / W;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < W && ny < H && seen[ny * W + nx];
    });
    const p = i * 4;
    if (nb && data[p] > 200 && data[p + 1] > 200 && data[p + 2] > 200) data[p + 3] = 0;
  }
}

// --- Şeffaf olmayan alanın sınırlayıcı kutusu ---
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (data[(y * W + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}
if (x1 < 0) fail('Görüntüde opak piksel yok (hepsi şeffaf). Zemin beyazsa --key-white kullanmayın/kullanın kontrol edin.');
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

// --- Kırp, kare tuvale ortala, grid x grid'e küçült ---
const inner = Math.max(2, Math.round(grid * (1 - 2 * opt.margin)));
const small = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: x0, top: y0, width: cw, height: ch })
  .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
  .extend({
    top: Math.floor((grid - inner) / 2), bottom: Math.ceil((grid - inner) / 2),
    left: Math.floor((grid - inner) / 2), right: Math.ceil((grid - inner) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .raw().toBuffer({ resolveWithObject: true });
const px = small.data; // grid*grid*4

// --- Alfa eşiği: ya tam opak ya tam şeffaf ---
const opaque = [];
for (let i = 0; i < grid * grid; i++) {
  const p = i * 4;
  if (px[p + 3] >= 128) { px[p + 3] = 255; opaque.push(i); }
  else { px[p] = px[p + 1] = px[p + 2] = 0; px[p + 3] = 0; }
}
if (!opaque.length) fail('Küçültmeden sonra opak piksel kalmadı.');

// --- Medyan-kesim ile renk niceleme (dither yok) ---
let boxes = [opaque.slice()];
const rangeOf = (box, c) => { let lo = 255, hi = 0; for (const i of box) { const v = px[i * 4 + c]; if (v < lo) lo = v; if (v > hi) hi = v; } return hi - lo; };
while (boxes.length < colors) {
  let bi = -1, bs = 0, bc = 0;
  boxes.forEach((b, k) => {
    if (b.length < 2) return;
    for (let c = 0; c < 3; c++) { const s = rangeOf(b, c) * Math.sqrt(b.length); if (s > bs) { bs = s; bi = k; bc = c; } }
  });
  if (bi < 0 || bs === 0) break;
  const b = boxes[bi].sort((a, z) => px[a * 4 + bc] - px[z * 4 + bc]);
  const mid = b.length >> 1;
  boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
}
for (const b of boxes) {
  let r = 0, g = 0, bl = 0;
  for (const i of b) { r += px[i * 4]; g += px[i * 4 + 1]; bl += px[i * 4 + 2]; }
  const n = b.length;
  for (const i of b) { px[i * 4] = Math.round(r / n); px[i * 4 + 1] = Math.round(g / n); px[i * 4 + 2] = Math.round(bl / n); }
}

// --- En yakın komşu ile büyüt ve yaz ---
try {
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  await sharp(px, { raw: { width: grid, height: grid, channels: 4 } })
    .resize(out, out, { kernel: 'nearest' })
    .png().toFile(outFile);
} catch (e) { fail(`Çıktı yazılamadı (${e.message})`); }
console.log(`Tamam: ${outFile} (${grid}x${grid} -> ${out}x${out}, ${boxes.length} renk)`);
