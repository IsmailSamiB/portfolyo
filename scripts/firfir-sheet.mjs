// Fırfır atlası: assets-src/chatgpt/kucuk içindeki Gemini kedi sayfalarından (macenta zemin) kareleri keser,
// zemini temizler, ortak tabana ve gövde merkezine hizalar.
// Çıktı: public/assets/sprites/firfir-v2.webp + src/game/firfir-frames.js
// İsteğe bağlı: node scripts/firfir-sheet.mjs --preview <klasör>  (her satırın 2x önizleme şeridi)
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync, statSync, existsSync } from 'fs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets-src', 'chatgpt', 'kucuk');
const outImg = path.join(root, 'public', 'assets', 'sprites', 'firfir-v2.webp');
const outJs = path.join(root, 'src', 'game', 'firfir-frames.js');
const previewArg = process.argv.indexOf('--preview');
const previewDir = previewArg > 0 ? process.argv[previewArg + 1] : null;

const SIDE_W = 15; // yandan yürüyen kedinin oyundaki genişliği (dünya px; eski sayfa 43 px x 0.35)
const BG_SPILL = 60; // min(r,b) - g bunun üstündeyse zemin
const DIRTY_SPILL = 14; // bunun üstündeki kenar pikselleri komşu temiz renge çekilir
const MIN_BLOB = 150; // daha küçük kopuk lekeler (kırıntı, kulak oynatma çizgileri) atılır
const PAD = 3; // hücre kenar payı
const COLS = 6;

// Kaynak satırları. keep: kullanılacak kareler · align: yatay hiza bandı (boyun oranı olarak, üstten)
// scale: kaynak sayfa kediyi farklı boyda çizdiyse kare bu oranla büyütülür
const ROWS = [
  { name: 'walk', file: 'gemini-kedi-1.png', row: 0, keep: [1, 2, 3, 4, 5], align: [0.45, 0.72] },
  { name: 'stand', file: 'gemini-kedi-1.png', row: 2, align: [0.45, 0.72] },
  // önden oturma: 1 ve 4'te kuyruk ters tarafta
  { name: 'sit', file: 'gemini-kedi-2.png', row: 0, keep: [0, 2, 3, 5], align: [0.6, 1] },
  { name: 'groom', file: 'gemini-kedi-2.png', row: 1, align: [0.75, 1] },
  { name: 'sleep', file: 'gemini-kedi-2.png', row: 2, align: [0, 1] },
  { name: 'belly', file: 'gemini-kedi-2.png', row: 3, keep: [0, 1, 2, 3], align: [0.5, 1] },
  // İsteğe bağlı şeritler (dosya yoksa atlanır); cat-anims.js 'stretch', 'jump', 'walk-down', 'walk-up' anahtarlarını bulursa kullanır.
  // gemini-kedi-3: yan şeritler yürüme ile aynı boyda; önden/arkadan şeritlerde kedi küçük çizilmiş
  //   (baş genişliği ~56 px, önden oturmada ~63 px) -> 1.12 büyütülür.
  { name: 'stretch', file: 'gemini-kedi-3.png', row: 0, align: [0.45, 0.72], optional: true },
  { name: 'jump', file: 'gemini-kedi-3.png', row: 1, align: [0.45, 0.72], optional: true },
  // önden yürüme: sol pati kalkık 0, 3 · sağ pati kalkık 1, 2, 4, 5 -> 0, 2, 3, 5 sırayla adım
  { name: 'front', file: 'gemini-kedi-3.png', row: 2, keep: [0, 2, 3, 5], align: [0.55, 1], scale: 1.12, optional: true },
  // arkadan yürüme: 0 ve 5'te gövde dümdüz, kuyruk ucu sağa kıvrık (1-4'te sola): atıldı; 4, 1'in eşi
  { name: 'back', file: 'gemini-kedi-3.png', row: 3, keep: [1, 2, 3], align: [0.6, 1], scale: 1.12, optional: true },
].filter((r) => !r.optional || existsSync(path.join(src, r.file)));

// Animasyonlar: satır, kaynak kare sırası, kare süresi (ms; tek sayı ya da liste; hepsi ≤ 800: hiçbir kare 1 sn donuk kalmaz)
// Yürüme (açık renk = yakın bacaklar): 3 yakın ön pati önde -> 4 -> 5 -> 1 geri iterken uzak ön pati öne uzanır,
//   2 yakın ön pati havada öne gelir. 0, 4'ün kopyası ve 0->1 geçişinde pati geri kayıyordu: atıldı.
//   Basan pati kare başına ~20 doku px (~1.9 dünya px) geri gider -> WALK_STEP.
const WALK_STEP = 1.9;
// Önden/arkadan: adım boyu yandan yürüme ile aynı (döngü 5 x 1.9 ~ 9.5 px, iki adım); döngü 4 kare -> kare başına ~2.4
const WALK_STEP_V = 2.4;
const ANIMS = {
  walk: { row: 'walk', seq: [3, 4, 5, 1, 2], ms: 1000 / (22 / WALK_STEP) },
  'idle-stand': { row: 'stand', seq: [0, 1, 2, 1, 0, 3, 4, 5], ms: [760, 120, 160, 120, 700, 450, 600, 800] },
  sit: { row: 'sit', seq: [0, 2, 0, 3, 0, 5], ms: [800, 160, 800, 700, 800, 700] },
  groom: { row: 'groom', seq: [0, 1, 2, 3, 2, 3, 4, 5], ms: [300, 260, 240, 240, 240, 260, 320, 400] },
  sleep: { row: 'sleep', seq: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1], ms: 420 },
  belly: { row: 'belly', seq: [0, 1, 2, 3, 2, 1], ms: 260 },
  // isteğe bağlı satırlar (yukarıdaki ROWS ile birlikte açılır)
  // gerinme: 2 (göğüs yerde) en uzun; toplam ~1.5 sn, catStretch'in 1.4 sn'lik süresine sığar
  stretch: { row: 'stretch', seq: [0, 1, 2, 3, 4, 5], ms: [100, 220, 540, 260, 180, 200] },
  // sıçrama: 0-1 çömelme, 2 kalkış, 3 havada/inişe uzanma, 4 konma, 5 ayakta. Oynatılmaz: RoomScene.catPounce
  //   tween ilerlemesine göre kare seçer (cat-anims.js 'crouch' / 'air' / 'land'); süreler yalnızca liste için
  jump: { row: 'jump', seq: [0, 1, 2, 3, 4, 5], ms: 140 },
  // önden/arkadan yürüme: döngüde her pati bir kez adım atar (4 kare); kare süresi WALK_STEP_V ile
  'walk-down': { row: 'front', seq: [0, 2, 3, 5], ms: 1000 / (22 / WALK_STEP_V) },
  'walk-up': { row: 'back', seq: [1, 2, 3, 2], ms: 1000 / (22 / WALK_STEP_V) },
};

// ---------- temizlik (player-sheet.mjs ile aynı yöntem) ----------

async function loadClean(file) {
  const { data, info } = await sharp(path.join(src, file)).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const spill = new Int16Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    spill[p] = Math.min(data[i], data[i + 2]) - data[i + 1];
    data[i + 3] = spill[p] > BG_SPILL ? 0 : 255;
  }
  dropBlobs(data, W, H, 40);
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 0;
  // Dar macenta yarıkları: iki yanı ve altı/üstü dolu, saf zemin olmayan pikseller
  const dirty = new Uint8Array(W * H);
  const fill = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (data[p * 4 + 3] || spill[p] > 170) continue;
    const near = (dx, dy, n) => { for (let k = 1; k <= n; k++) if (op(x + dx * k, y + dy * k)) return true; return false; };
    if (near(-1, 0, 3) && near(1, 0, 3) && near(0, -1, 2) && near(0, 1, 2)) fill.push(p);
  }
  for (const p of fill) { data[p * 4 + 3] = 255; dirty[p] = 1; }
  // Macentaya karışmış piksel: rengi, daha temiz bir komşu ile macenta arasındaki doğru üzerinde
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    const i = p * 4;
    if (!data[i + 3] || dirty[p]) continue;
    if (spill[p] > DIRTY_SPILL) { dirty[p] = 1; continue; }
    search: for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (!op(x + dx, y + dy)) continue;
      const q = p + dy * W + dx;
      if (spill[q] > spill[p] - 20) continue;
      const j = q * 4;
      const mr = 255 - data[j], mg = -data[j + 1], mb = 255 - data[j + 2];
      const cr = data[i] - data[j], cg = data[i + 1] - data[j + 1], cb = data[i + 2] - data[j + 2];
      const a = (cr * mr + cg * mg + cb * mb) / (mr * mr + mg * mg + mb * mb || 1);
      if (a < 0.08) continue;
      const res = Math.hypot(cr - a * mr, cg - a * mg, cb - a * mb);
      if (res < 30) { dirty[p] = 1; break search; }
    }
  }
  // Kirli pikseller en yakın temiz pikselin rengini alır (yoksa macenta çıkarılır)
  const src2 = Buffer.from(data);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (!data[i + 3] || !dirty[p]) continue;
    const x0 = p % W;
    const y0 = (p - x0) / W;
    let best = -1;
    let bestD = 1e9;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const q = y * W + x;
      const d = dx * dx + dy * dy;
      if (d < bestD && src2[q * 4 + 3] && !dirty[q]) { bestD = d; best = q; }
    }
    if (best >= 0) {
      data[i] = src2[best * 4];
      data[i + 1] = src2[best * 4 + 1];
      data[i + 2] = src2[best * 4 + 2];
    } else {
      const s = spill[p];
      data[i] = Math.max(0, data[i] - s);
      data[i + 2] = Math.max(0, data[i + 2] - s);
    }
  }
  for (let i = 0; i < data.length; i += 4) if (!data[i + 3]) data[i] = data[i + 1] = data[i + 2] = 0;
  return { data, W, H };
}

// min alanından küçük kopuk lekeleri siler (4-komşuluk)
function dropBlobs(data, W, H, min) {
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let p = 0; p < W * H; p++) {
    if (seen[p] || !data[p * 4 + 3]) continue;
    const blob = [];
    stack.push(p);
    seen[p] = 1;
    while (stack.length) {
      const q = stack.pop();
      blob.push(q);
      const x = q % W;
      for (const n of [q - W, q + W, x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1]) {
        if (n < 0 || n >= W * H || seen[n] || !data[n * 4 + 3]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (blob.length < min) for (const q of blob) { const i = q * 4; data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; }
  }
}

// Satır bantları; her bantta 6 sütun: sınır, ızgara çizgisi (k*W/6) yakınındaki en boş sütun
function segment({ data, W, H }) {
  const on = (x, y) => data[(y * W + x) * 4 + 3] > 0;
  const bands = [];
  let s = -1;
  for (let y = 0; y <= H; y++) {
    let c = 0;
    if (y < H) for (let x = 0; x < W; x++) c += on(x, y);
    if (c > 2 && s < 0) s = y;
    if (c <= 2 && s >= 0) {
      if (y - s > 40) bands.push([s, y - 1]);
      s = -1;
    }
  }
  return bands.map(([a, b]) => {
    const col = (x) => { let c = 0; for (let y = a; y <= b; y++) c += on(x, y); return c; };
    const cuts = [0];
    for (let k = 1; k < COLS; k++) {
      const g = Math.round((k * W) / COLS);
      let best = g, bc = 1e9;
      for (let x = g - 45; x <= g + 45; x++) { const c = col(x); if (c < bc) { bc = c; best = x; } }
      cuts.push(best);
    }
    cuts.push(W);
    return cuts.slice(0, -1).map((l, k) => ({ l, r: cuts[k + 1] - 1, a, b }));
  });
}

function measure(buf, w, h, band) {
  let top = h, bot = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (buf[(y * w + x) * 4 + 3]) {
    top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x);
  }
  // Yatay hiza: banttaki opak piksellerin ağırlık merkezi
  let sx = 0, n = 0;
  const y0 = top + Math.round((bot - top) * band[0]);
  const y1 = top + Math.round((bot - top) * band[1]);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) if (buf[(y * w + x) * 4 + 3]) { sx += x; n++; }
  return { top, bot, left, right, width: right - left + 1, height: bot - top + 1, cx: sx / n };
}

function cropFrame(img, seg) {
  const w = seg.r - seg.l + 1 + 8;
  const h = seg.b - seg.a + 1 + 8;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = seg.l - 4 + x, sy = seg.a - 4 + y;
    if (sx < seg.l || sx > seg.r || sy < 0 || sy >= img.H) continue;
    img.data.copy(buf, (y * w + x) * 4, (sy * img.W + sx) * 4, (sy * img.W + sx) * 4 + 4);
  }
  dropBlobs(buf, w, h, MIN_BLOB);
  return { buf, w, h };
}

// Kareyi büyütür; kenar alfası yeniden ikili yapılır (diğer karelerle aynı keskin kenar)
async function scaleFrame(f, k) {
  const w = Math.round(f.w * k), h = Math.round(f.h * k);
  const buf = await sharp(f.buf, { raw: { width: f.w, height: f.h, channels: 4 } }).resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer();
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i + 3] < 128) buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
    else buf[i + 3] = 255;
  }
  return { buf, w, h };
}

// ---------- ana akış ----------

const imgs = {};
const rows = [];
for (const def of ROWS) {
  if (!imgs[def.file]) {
    imgs[def.file] = await loadClean(def.file);
    imgs[def.file].segs = segment(imgs[def.file]);
  }
  const img = imgs[def.file];
  const segs = img.segs[def.row];
  if (!segs) throw new Error(`${def.file} satır ${def.row} yok (${img.segs.length} bant)`);
  const frames = [];
  for (const [i, seg] of segs.entries()) {
    if (def.keep && !def.keep.includes(i)) continue;
    const f = def.scale ? await scaleFrame(cropFrame(img, seg), def.scale) : cropFrame(img, seg);
    frames.push({ ...f, src: i, m: measure(f.buf, f.w, f.h, def.align) });
  }
  rows.push({ ...def, frames });
}

const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const SCALE = +(SIDE_W / median(rows[0].frames.map((f) => f.m.width))).toFixed(4);

// Hücre: hiza merkezi hücre ortasında, taban hücre altından PAD yukarıda
let half = 0, up = 0;
for (const r of rows) for (const f of r.frames) {
  half = Math.max(half, f.m.cx - f.m.left + 1, f.m.right - f.m.cx + 1);
  up = Math.max(up, f.m.height);
}
const CW = Math.ceil(half) * 2 + PAD * 2;
const CH = up + PAD * 2;
const AW = CW * COLS, AH = CH * rows.length;
const atlas = Buffer.alloc(AW * AH * 4);
const frameRects = {};
rows.forEach((r, ry) => {
  r.names = [];
  r.frames.forEach((f, cx) => {
    const ox = cx * CW + Math.round(CW / 2 - f.m.cx);
    const oy = ry * CH + (CH - PAD - 1 - f.m.bot);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const i = (y * f.w + x) * 4;
      if (!f.buf[i + 3]) continue;
      const ax = ox + x, ay = oy + y;
      if (ax < cx * CW || ax >= (cx + 1) * CW || ay < ry * CH || ay >= (ry + 1) * CH) throw new Error(`${r.name}${cx}: hücre dışı`);
      f.buf.copy(atlas, (ay * AW + ax) * 4, i, i + 4);
    }
    const name = `cat-${r.name}${cx}`;
    r.names.push(name);
    frameRects[name] = [cx * CW, ry * CH];
  });
});

let pink = 0;
for (let i = 0; i < atlas.length; i += 4) if (atlas[i + 3] && Math.min(atlas[i], atlas[i + 2]) - atlas[i + 1] > DIRTY_SPILL + 6) pink++;

await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } }).webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 6 }).toFile(outImg);

const report = {};
for (const r of rows) report[r.name] = r.frames.map((f) => `${f.src}:${f.m.width}x${f.m.height}`).join(' ');
console.log(JSON.stringify(report, null, 1));
console.log(`ölçek ${SCALE}, hücre ${CW}x${CH}, atlas ${AW}x${AH}, ${(statSync(outImg).size / 1024).toFixed(1)} KB, macenta izi ${pink} px`);

if (previewDir) {
  mkdirSync(previewDir, { recursive: true });
  for (const [ry, r] of rows.entries()) {
    const n = r.frames.length;
    const cols = Math.min(3, n), lines = Math.ceil(n / 3);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const cell = await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } })
        .extract({ left: i * CW, top: ry * CH, width: CW, height: CH }).png().toBuffer();
      parts.push({ input: cell, left: (i % 3) * CW, top: Math.floor(i / 3) * CH });
    }
    // hiza çizgileri: hücre ortası (dikey) ve taban
    const guides = Buffer.from(`<svg width="${CW * cols}" height="${CH * lines}">${Array.from({ length: cols }, (_, c) => `<line x1="${c * CW + CW / 2}" y1="0" x2="${c * CW + CW / 2}" y2="${CH * lines}" stroke="#ff0" stroke-width="1"/>`).join('')}${Array.from({ length: lines }, (_, l) => `<line x1="0" y1="${l * CH + CH - PAD}" x2="${CW * cols}" y2="${l * CH + CH - PAD}" stroke="#0ff" stroke-width="1"/>`).join('')}</svg>`);
    await sharp({ create: { width: CW * cols, height: CH * lines, channels: 4, background: '#4a6a5a' } })
      .composite([...parts, { input: guides }]).png().toFile(path.join(previewDir, `${r.name}.png`));
  }
}

// ---------- kare tanımı ----------
const byRow = Object.fromEntries(rows.map((r) => [r.name, r]));
const nameOf = (row, s) => {
  const r = byRow[row];
  const i = r.frames.findIndex((f) => f.src === s);
  if (i < 0) throw new Error(`${row}: kaynak kare ${s} yok (atılmış)`);
  return r.names[i];
};
const anims = {};
for (const [key, a] of Object.entries(ANIMS)) {
  if (!byRow[a.row]) continue;
  anims[key] = a.seq.map((s, i) => [nameOf(a.row, s), Math.round(Array.isArray(a.ms) ? a.ms[i] : a.ms)]);
}
const js = `// scripts/firfir-sheet.mjs üretir (npm run firfir); elle düzenlemeyin.
// Fırfır atlası: eşit hücreler; taban hücre altından ${PAD} px yukarıda, gövde hücre ortasında.
export const CAT_TEXTURE = 'firfir2';
export const CAT_URL = 'assets/sprites/firfir-v2.webp';
export const CAT_SCALE = ${SCALE};
export const CAT_WALK_STEP = ${WALK_STEP}; // yürüme karesi başına dünya px (ayak kaymasın)
export const CAT_WALK_STEP_V = ${WALK_STEP_V}; // önden/arkadan yürümede kare başına dünya px
export const CAT_CELL = { w: ${CW}, h: ${CH} };
export const CAT_ORIGIN = { x: 0.5, y: ${((CH - PAD) / CH).toFixed(4)} };
// ad -> [x, y] (sol üst köşe)
export const CAT_FRAMES = ${JSON.stringify(frameRects)};
// anahtar -> [[kare, ms]]
export const CAT_ANIMS = ${JSON.stringify(anims)};
`;
writeFileSync(outJs, js);
