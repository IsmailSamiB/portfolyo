// Favicon adayları: karakter (koyu mor zemin) ve Fırfır (turuncu zemin).
// Çıktı: assets-src/favicon/<ad>-180.png ve <ad>-32.png
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets-src', 'favicon');
// Eski (v1) sprite sayfaları; oyun artık player-v2/firfir-v2 atlaslarını kullanır
const sprites = path.join(root, 'assets-src');
mkdirSync(out, { recursive: true });

// Ölçümler (alfa > 20, kare içi koordinatlar):
// player-sheet.png (eski player.webp'nin kaynağı) kare 0 (64x96, öne duruş): saç tepesi satır 4; baş en geniş satır 17-20 ve 32-39 (x 11..52);
//   çene/boyun en dar satır 47 (x 22..41, 20 px), 48'den sonra gövde (omuz) genişler.
//   Çene çizgisi gözle satır ~49 (sakal ucu); baş = satır 4..49, sütun 11..52 -> 42x46 px (kulaklar dahil).
// sprites-eski/firfir-walk.png kare 7 (64x56, öne bakan): kuyruk satır 2..15 (x 26..36, dar); kulaklar satır 16'da başlar
//   (genişlik 13 -> 23..40); baş 16..33 (x 22..41); satır 34'te tasma/göğüs, satır 44+ gövde daralır.
//   Tasma satır 34 ve sonrası dışarıda; baş = satır 16..33, sütun 22..41 -> 20x18 px (kuyruk dışarıda kalır).
const CREAM = '#f4e4c1';
const jobs = [
  { name: 'karakter', file: 'player-sheet.png', fw: 64, fh: 96, cols: 6, idx: 0,
    box: { left: 11, top: 4, width: 42, height: 46 }, bg: '#2b2030', scale: 3 },
  { name: 'firfir', file: 'sprites-eski/firfir-walk.png', fw: 64, fh: 56, cols: 6, idx: 7,
    box: { left: 22, top: 16, width: 20, height: 18 }, bg: '#d9622b', scale: 7 },
];

for (const j of jobs) {
  const fx = (j.idx % j.cols) * j.fw, fy = Math.floor(j.idx / j.cols) * j.fh;
  const crop = await sharp(path.join(sprites, j.file)).extract({
    left: fx + j.box.left, top: fy + j.box.top, width: j.box.width, height: j.box.height }).png().toBuffer();

  // 180: tam kat nearest büyütme, ortala, krem iç çerçeve (7 px)
  const big = await sharp(crop).resize(j.box.width * j.scale, j.box.height * j.scale, { kernel: 'nearest' }).png().toBuffer();
  const B = 7, S = 180, I = S - 2 * B;
  const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect x="${B / 2}" y="${B / 2}" width="${S - B}" height="${S - B}" fill="none" stroke="${CREAM}" stroke-width="${B}"/></svg>`);
  await sharp({ create: { width: S, height: S, channels: 4, background: j.bg } })
    .composite([
      { input: big, left: Math.round((S - j.box.width * j.scale) / 2), top: Math.round((S - j.box.height * j.scale) / 2) },
      { input: frame, left: 0, top: 0 }])
    .png().toFile(path.join(out, `${j.name}-180.png`));

  // 32: kaynak kırpımından, çerçevesiz; önce 8x nearest sonra lanczos ile 30 px'e sığdır
  const m = 30, k = Math.min(m / j.box.width, m / j.box.height);
  const w = Math.round(j.box.width * k), h = Math.round(j.box.height * k);
  const big8 = await sharp(crop).resize(j.box.width * 8, j.box.height * 8, { kernel: 'nearest' }).png().toBuffer();
  const small = await sharp(big8).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
  await sharp({ create: { width: 32, height: 32, channels: 4, background: j.bg } })
    .composite([{ input: small, left: Math.round((32 - w) / 2), top: Math.round((32 - h) / 2) }])
    .png().toFile(path.join(out, `${j.name}-32.png`));
}
console.log('tamam');
