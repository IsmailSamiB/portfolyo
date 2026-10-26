// Karakter atlası: assets-src/chatgpt/kucuk içindeki Gemini sayfalarından (macenta zemin) kareleri keser,
// zemini temizler, ortak boya ölçekler, ayak çizgisi ve baş merkezine hizalar.
// Çıktı: public/assets/sprites/player-v2.webp + src/game/player-frames.js
// İsteğe bağlı: node scripts/player-sheet.mjs --preview <klasör>  (her animasyonun 2x önizleme şeridi)
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync, statSync, existsSync, readdirSync } from 'fs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets-src', 'chatgpt', 'kucuk');
const outImg = path.join(root, 'public', 'assets', 'sprites', 'player-v2.webp');
const outJs = path.join(root, 'src', 'game', 'player-frames.js');
const previewArg = process.argv.indexOf('--preview');
const previewDir = previewArg > 0 ? process.argv[previewArg + 1] : null;

const STAND_H = 194; // ayakta karakter boyu (doku pikseli; yandan yürüme kaynağı zaten bu boyda)
const SCALE = 0.137; // oyundaki çizim ölçeği -> ~26.5 dünya pikseli
const BG_SPILL = 60; // min(r,b) - g bunun üstündeyse zemin
const DIRTY_SPILL = 14; // bunun üstündeki kenar pikselleri komşu temiz renge çekilir
const MIN_BLOB = 40; // daha küçük kopuk lekeler atılır
const PAD = 3; // hücre kenar payı
const WALK_FPS = 12; // SPEED 55 / adım ~9 dünya px = ~6 adım/sn, adım başına 2 kare
const SIDE_WALK_FPS = 13; // yandan adım (ayaklar arası) ~62 doku px = 8.5 dünya px -> 6.5 adım/sn, ayak kaymaz

// Animasyonlar: kaynak satırı ve kaynak kare sırası (0'dan; atılan kareler kullanılamaz).
// ms: kare başına süre (tek sayı ya da liste) · steps: ayak yere bastığı kareler (adım sesi)
// Yandan (ölçüm: açık ayakkabı = yakın bacak): 0 yakın önde, 1 uzak bacak arkadan kalkıyor (geçiş),
//   2 uzak önde, 3 = 0'ın tekrarı; 4-7 aynı dörtlünün kopyası. Uzak bacağın geçişi olmadığından
//   2'den sonra yine geçiş (5) gelir: yakın önde -> geçiş -> uzak önde -> geçiş.
// Önden: 0/4 iki ayak yerde, 1/2/5/6/7 sağ ayak önde, yalnız 3 sol ayak önde -> 0, 2, 4, 3.
// Arkadan: 0/6 sağ ayak kalkık, 1/2/4 sol kalkık, 3/5/7 geçiş -> 6, 7, 4, 5.
const ANIMS = {
  'walk-side': { row: 'side', seq: [0, 1, 2, 5], ms: 1000 / SIDE_WALK_FPS, steps: [0, 2] },
  'walk-down': { row: 'down', seq: [0, 2, 4, 3], ms: 1000 / WALK_FPS, steps: [1, 3] },
  'walk-up': { row: 'up', seq: [6, 7, 4, 5], ms: 1000 / WALK_FPS, steps: [0, 2] },
  'idle-down': { row: 'idle', seq: [0, 1, 2, 3, 4, 5, 6, 7], ms: [1400, 450, 700, 130, 900, 1100, 500, 1200] },
  // el sallama: 0 nötr, 1 el kalkık, 4 el başta (bozuk 2/3/5 atıldı), 6 nötr, 7 gülümseme
  wave: { row: 'wave', seq: [0, 1, 4, 1, 4, 1, 6, 7], ms: [150, 170, 170, 170, 170, 200, 200, 900], once: true },
  'sit-phone': { row: 'phone', seq: [0, 1, 2, 3, 4, 5, 4, 3, 6, 7], ms: [1000, 500, 600, 1100, 900, 1100, 900, 900, 500, 1300] },
  'type-up': { row: 'type', seq: [0, 1, 2, 3, 4, 5, 6, 7], ms: 170 },
  // arkadan bekleme: kareler yalnız nefes/omuz farkı -> yavaş, eşit olmayan süreler
  'idle-up': { row: 'idleUp', seq: [0, 1, 2, 3, 4, 5, 6, 7], ms: [1300, 700, 900, 650, 1100, 700, 850, 900] },
  // yandan bekleme: 3 göz kırpma, 7 gülümseme (5 öne dönük, atıldı)
  'idle-side': { row: 'idleSide', seq: [0, 1, 2, 3, 4, 6, 2, 1, 7], ms: [1300, 600, 900, 140, 1000, 800, 700, 600, 1100] },
  // İsteğe bağlı şeritler (dosyası yoksa atlanır; RoomScene animasyon yoksa bekleme döngüsüne düşer)
  // gitar (oturarak, döngü; RoomScene ~3.5 sn sonra kaldırır): 3/4 gözler kapalı, 5 başı yana eğik, 7 gülümseme
  strum: { row: 'guitar', seq: [0, 1, 2, 1, 3, 4, 1, 2, 5, 6, 1, 7], ms: [260, 200, 200, 200, 380, 380, 200, 200, 420, 260, 200, 520] },
  // kahve: 0 tutuyor, 1 kaldırıyor, 2 ağızda, 3/4 yudum (gözler kapalı), 5 indiriyor, 6 tutuyor, 7 gülümseme
  sip: { row: 'coffee', seq: [0, 1, 2, 3, 4, 5, 6, 7], ms: [450, 200, 220, 600, 350, 220, 350, 900], once: true },
  'sleep-bed': { row: 'sleep', seq: [0, 1, 2, 3, 4, 5, 6, 7], ms: 600 },
};
// Hareket azaltma açıkken / tek kare gereken yerde durma karesi (her yönün bekleme animasyonunun ilk karesi)
const STILL_ANIMS = { down: 'idle-down', up: 'idle-up', side: 'idle-side' };

function firstFile(re) {
  return readdirSync(src).filter((f) => re.test(f)).sort()[0] ?? null;
}

// Kaynak satırları: dosya, satır sırası, görünüş (side/front/back), duruş (stand/seat), kullanılacak kareler.
// view: ölçekleme ölçütü -> stand: boy, seat: önden/arkadan baş genişliği
const ROWS = [
  { name: 'side', file: 'gemini-yurume-1.png', row: 0, view: 'side', pose: 'stand' },
  { name: 'down', file: 'gemini-yurume-2.png', row: 0, view: 'front', pose: 'stand' },
  { name: 'up', file: 'gemini-yurume-2.png', row: 1, view: 'back', pose: 'stand' },
  { name: 'idle', file: 'gemini-bekleme-3.png', row: 0, view: 'front', pose: 'stand' },
  // el sallama: 3 (iki el), 4 ve 6 (el yüzü örtüyor) bozuk
  { name: 'wave', file: 'gemini-bekleme-3.png', row: 1, view: 'front', pose: 'stand', keep: [0, 1, 4, 6, 7] },
  { name: 'phone', file: 'gemini-oturma-4.png', row: 0, view: 'front', pose: 'seat' },
  { name: 'type', file: 'gemini-oturma-4.png', row: 1, view: 'back', pose: 'seat' },
  // arkadan/yandan bekleme (iki ayak yerde); yandan 5. kare öne dönük -> atıldı
  { name: 'idleUp', file: 'gemini-bekleme-5.png', row: 0, view: 'back', pose: 'stand' },
  // size: bu şeritte baş gövdeye göre küçük; yandan yürümeyle durunca baş küçülmesin diye biraz büyük
  { name: 'idleSide', file: 'gemini-bekleme-5.png', row: 1, view: 'side', pose: 'stand', keep: [0, 1, 2, 3, 4, 6, 7], size: 1.05 },
  // önden: taburede gitar çalma (oturan) ve ayakta kahve yudumlama
  { name: 'guitar', file: 'gemini-gitar-6.png', row: 0, view: 'front', pose: 'seat', optional: true },
  { name: 'coffee', file: 'gemini-gitar-6.png', row: 1, view: 'front', pose: 'stand', optional: true },
  // henüz çizilmemiş olabilir: yatakta uyku (gemini-uyku-*.png ile eşleşen ilk dosya, ilk satır, 8 kare)
  { name: 'sleep', file: firstFile(/^gemini-uyku-.*\.png$/), row: 0, view: 'front', pose: 'seat', optional: true },
];

// ---------- temizlik ----------

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
  // küçük kopuk lekeler (JPEG kırıntısı)
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
    if (blob.length < MIN_BLOB) for (const q of blob) data[q * 4 + 3] = 0;
  }
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 0;
  // Dar macenta yarıkları (boyun çizgisi, kol-gövde arası): saf zemin olmayan, iki yanı ve altı/üstü dolu pikseller
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
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const q = y * W + x;
        const d = dx * dx + dy * dy;
        if (d < bestD && src2[q * 4 + 3] && !dirty[q]) {
          bestD = d;
          best = q;
        }
      }
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
  // Saydam piksellerin rengi sıfır: küçültmede kenara macenta sızmasın
  for (let i = 0; i < data.length; i += 4) if (!data[i + 3]) data[i] = data[i + 1] = data[i + 2] = 0;
  return { data, W, H };
}

// Satır bantları ve her banttaki kare sütunları (macenta olmayan sütun boşluklarına göre)
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
    const segs = [];
    let l = -1;
    for (let x = 0; x <= W; x++) {
      let c = 0;
      if (x < W) for (let y = a; y <= b; y++) c += on(x, y);
      if (c > 0 && l < 0) l = x;
      if (c === 0 && l >= 0) {
        if (x - l > 20) segs.push({ l, r: x - 1, a, b });
        l = -1;
      }
    }
    return segs;
  });
}

// Kare kutusundaki ölçüler: sıkı kutu, baş genişliği/merkezi (üst %25'te en geniş satır)
function measure(buf, w, h) {
  let top = h, bot = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (buf[(y * w + x) * 4 + 3]) {
    top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x);
  }
  let headW = 0, headC = 0;
  const lim = top + Math.round((bot - top) * 0.25);
  for (let y = top; y <= lim; y++) {
    let mn = w, mx = -1;
    for (let x = 0; x < w; x++) if (buf[(y * w + x) * 4 + 3]) { mn = Math.min(mn, x); mx = Math.max(mx, x); }
    if (mx - mn > headW) { headW = mx - mn; headC = (mn + mx) / 2; }
  }
  return { top, bot, left, right, height: bot - top + 1, headW, headC };
}

async function cropFrame(img, seg) {
  const w = seg.r - seg.l + 1 + 8;
  const h = seg.b - seg.a + 1 + 8;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = seg.l - 4 + x, sy = seg.a - 4 + y;
    if (sx < 0 || sy < 0 || sx >= img.W || sy >= img.H) continue;
    img.data.copy(buf, (y * w + x) * 4, (sy * img.W + sx) * 4, (sy * img.W + sx) * 4 + 4);
  }
  return { buf, w, h };
}

async function scaleFrame(f, k) {
  if (Math.abs(k - 1) < 0.01) return f;
  const w = Math.round(f.w * k), h = Math.round(f.h * k);
  const buf = await sharp(f.buf, { raw: { width: f.w, height: f.h, channels: 4 } })
    .resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer();
  // alfa ikili; yarı saydam kenar rengi önceden çarpılmış küçültmeden gelir, macenta içermez
  for (let i = 3; i < buf.length; i += 4) buf[i] = buf[i] >= 128 ? 255 : 0;
  return { buf, w, h };
}

// ---------- ana akış ----------

const imgs = {};
const rows = [];
for (const def of ROWS) {
  if (def.optional && (!def.file || !existsSync(path.join(src, def.file)))) continue;
  if (!imgs[def.file]) {
    imgs[def.file] = await loadClean(def.file);
    imgs[def.file].segs = segment(imgs[def.file]);
  }
  const img = imgs[def.file];
  const segs = img.segs[def.row];
  if (!segs || segs.length !== 8) {
    if (def.optional) { console.warn(`ATLANDI ${def.file} satır ${def.row}: ${segs?.length} kare`); continue; }
    throw new Error(`${def.file} satır ${def.row}: ${segs?.length} kare`);
  }
  const frames = [];
  for (const [i, seg] of segs.entries()) {
    if (def.keep && !def.keep.includes(i)) continue;
    const f = await cropFrame(img, seg);
    frames.push({ ...f, src: i, m: measure(f.buf, f.w, f.h) });
  }
  rows.push({ ...def, frames });
}

// Ölçek: ayakta -> boy STAND_H; oturan -> aynı görünüşün ayaktaki (ölçeklenmiş) baş genişliği
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const headAt = {};
for (const r of rows) {
  if (r.pose !== 'stand') continue;
  r.k = (STAND_H * (r.size ?? 1)) / median(r.frames.map((f) => f.m.height));
  if (r.view !== 'side') (headAt[r.view] ??= []).push(median(r.frames.map((f) => f.m.headW)) * r.k);
}
for (const r of rows) {
  if (r.pose === 'seat') r.k = median(headAt[r.view]) / median(r.frames.map((f) => f.m.headW));
  for (const [i, f] of r.frames.entries()) {
    const s = await scaleFrame(f, r.k);
    r.frames[i] = { ...s, src: f.src, m: measure(s.buf, s.w, s.h) };
  }
}

// Hücre: baş merkezi hücre ortasında, ayak tabanı hücre altından PAD yukarıda
let half = 0, up = 0;
for (const r of rows) for (const f of r.frames) {
  half = Math.max(half, f.m.headC - f.m.left + 1, f.m.right - f.m.headC + 1);
  up = Math.max(up, f.m.bot - f.m.top + 1);
}
const CW = Math.ceil(half) * 2 + PAD * 2;
const CH = up + PAD * 2;
const COLS = 8;
const AW = CW * COLS, AH = CH * rows.length;
const atlas = Buffer.alloc(AW * AH * 4);
const frameRects = {};
let stray = 0;
rows.forEach((r, ry) => {
  r.names = [];
  r.frames.forEach((f, cx) => {
    const ox = cx * CW + Math.round(CW / 2 - f.m.headC);
    const oy = ry * CH + (CH - PAD - 1 - f.m.bot);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const i = (y * f.w + x) * 4;
      if (!f.buf[i + 3]) continue;
      const ax = ox + x, ay = oy + y;
      if (ax < cx * CW || ax >= (cx + 1) * CW || ay < ry * CH || ay >= (ry + 1) * CH) { stray++; continue; }
      f.buf.copy(atlas, (ay * AW + ax) * 4, i, i + 4);
    }
    const name = `${r.name}${cx}`;
    r.names.push(name);
    frameRects[name] = [cx * CW, ry * CH];
  });
});
if (stray) throw new Error(`${stray} piksel hücre dışına taştı`);

// Kalan macenta izi denetimi
let pink = 0;
for (let i = 0; i < atlas.length; i += 4) if (atlas[i + 3] && Math.min(atlas[i], atlas[i + 2]) - atlas[i + 1] > DIRTY_SPILL + 6) pink++;

await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } }).webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 6 }).toFile(outImg);

// ---------- yürüme ölçümleri (ayak sırası, yere basma) ----------
// Ayakkabı pikselleri (alt 45 satır, açık ve az doygun) x'teki en büyük boşlukla iki ayağa ayrılır.
// Her ayak: ortalama x (baş merkezine göre), taban y'si, parlaklık (açık = yakın bacak)
function feet(f) {
  const px = [];
  for (let y = f.m.bot - 45; y <= f.m.bot; y++) for (let x = 0; x < f.w; x++) {
    const i = (y * f.w + x) * 4;
    if (!f.buf[i + 3]) continue;
    const r = f.buf[i], g = f.buf[i + 1], b = f.buf[i + 2];
    if ((r + g + b) / 3 > 140 && Math.max(r, g, b) - Math.min(r, g, b) < 60) px.push([x, y, (r + g + b) / 3]);
  }
  const xs = [...new Set(px.map((p) => p[0]))].sort((a, b) => a - b);
  let gap = 0, cut = f.m.headC;
  for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > gap) { gap = xs[k] - xs[k - 1]; cut = (xs[k] + xs[k - 1]) / 2; }
  return [px.filter((p) => p[0] < cut), px.filter((p) => p[0] >= cut)].map((s) => ({
    x: Math.round(s.reduce((a, p) => a + p[0], 0) / (s.length || 1) - f.m.headC),
    bot: s.length ? Math.max(...s.map((p) => p[1])) : -1,
    lum: Math.round(s.reduce((a, p) => a + p[2], 0) / (s.length || 1)),
  }));
}
const report = {};
for (const r of rows) report[r.name] = { k: +r.k.toFixed(3), src: r.frames.map((f) => f.src) };
console.log(JSON.stringify(report));
// Yürüme şeritlerinin ayak ölçümü (adım sesi/adım boyu ayarı için bilgi)
for (const row of ['side', 'up']) {
  const r = rows.find((x) => x.name === row);
  r.frames.forEach((f, i) => {
    const [l, rr] = feet(f);
    const grounded = Math.abs(l.bot - rr.bot) <= 1 && Math.max(l.bot, rr.bot) >= f.m.bot - 4;
    console.log(`  ${row}${i} (kaynak ${f.src}): ayak x ${l.x}/${rr.x} taban ${l.bot}/${rr.bot} parlaklık ${l.lum}/${rr.lum}${grounded ? ' YERDE' : ''}`);
  });
}
console.log(`hücre ${CW}x${CH}, atlas ${AW}x${AH}, ${(statSync(outImg).size / 1024).toFixed(1)} KB, macenta izi ${pink} px`);

if (previewDir) {
  mkdirSync(previewDir, { recursive: true });
  for (const [ry, r] of rows.entries()) {
    // 4'lü satırlara sarılır (geniş şerit görüntüleyicide küçülmesin)
    const n = r.frames.length;
    const cols = Math.min(4, n), lines = Math.ceil(n / 4);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const cell = await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } })
        .extract({ left: i * CW, top: ry * CH, width: CW, height: CH }).png().toBuffer();
      parts.push({ input: cell, left: (i % 4) * CW, top: Math.floor(i / 4) * CH });
    }
    const flat = await sharp({ create: { width: CW * cols, height: CH * lines, channels: 4, background: '#4a6a5a' } })
      .composite(parts).png().toBuffer();
    await sharp(flat).resize(CW * cols * 2, CH * lines * 2, { kernel: 'nearest' }).png().toFile(path.join(previewDir, `${r.name}.png`));
  }
}

// ---------- kare tanımı ----------
const byRow = Object.fromEntries(rows.map((r) => [r.name, r]));
const nameOf = (row, srcIdx) => {
  const r = byRow[row];
  const i = r.frames.findIndex((f) => f.src === srcIdx);
  if (i < 0) throw new Error(`${row}: kaynak kare ${srcIdx} yok (atılmış)`);
  return r.names[i];
};
const anims = {};
for (const [key, a] of Object.entries(ANIMS)) {
  if (!byRow[a.row]) continue; // isteğe bağlı şerit yok
  anims[key] = {
    frames: a.seq.map((s, i) => [nameOf(a.row, s), Math.round(Array.isArray(a.ms) ? a.ms[i] : a.ms)]),
    ...(a.once ? { once: true } : {}),
    ...(a.steps ? { steps: a.steps } : {}),
  };
}
const still = Object.fromEntries(Object.entries(STILL_ANIMS).map(([dir, key]) => [dir, anims[key].frames[0][0]]));
const js = `// scripts/player-sheet.mjs üretir (npm run player); elle düzenlemeyin.
// Karakter atlası: eşit hücreler; ayak tabanı hücre altından ${PAD} px yukarıda, baş hücre ortasında.
export const PLAYER_TEXTURE = 'player2';
export const PLAYER_URL = 'assets/sprites/player-v2.webp';
export const PLAYER_SCALE = ${SCALE};
export const PLAYER_CELL = { w: ${CW}, h: ${CH} };
export const PLAYER_ORIGIN = { x: 0.5, y: ${((CH - PAD) / CH).toFixed(4)} };
// ad -> [x, y] (sol üst köşe)
export const PLAYER_FRAMES = ${JSON.stringify(frameRects)};
// ad -> { frames: [[kare, ms]], once?, steps? (adım sesi çalan sıra numaraları) }
export const PLAYER_ANIMS = ${JSON.stringify(anims)};
// Yön -> tek durma karesi (hareket azaltma açıkken; normalde idle-<yön> oynar)
export const PLAYER_STILL = ${JSON.stringify(still)};
`;
writeFileSync(outJs, js);
