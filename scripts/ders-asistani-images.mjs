#!/usr/bin/env node
// Ders Asistanı tanıtım görsellerini yayına hazırlar.
// - Kapak: kaynak 16:9 olduğundan kırpmadan, mevcut kapakla aynı boyuta (1120x630) indirir.
// - Galeri: kapak, akış, tekrar, tema görsellerini 1600 px genişlikte WebP yazar (üst veri yok).
// - Her çıktı 200 KB'ın altında kalana dek kaliteyi düşürür.
// Kullanım: node scripts/ders-asistani-images.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets-src/originals/projects/ders-asistani';
const OUT = 'public/assets/projects/ders-asistani';
const COVER = 'public/assets/projects/ders-asistani.webp';
const NAMES = ['kapak', 'akis', 'tekrar', 'tema'];
const GALLERY_W = 1600;
const MAX_BYTES = 200 * 1024;

sharp.cache(false); // Windows'ta çıktı dosyasını kilitlemesin
fs.mkdirSync(OUT, { recursive: true });

// Boyutlandırıp WebP yazar; limit aşılırsa kaliteyi 4'er puan düşürür
async function write(input, file, width, height, quality = 82) {
  let q = quality, buf;
  for (;;) {
    buf = await sharp(input).resize(width, height, { fit: 'fill' }).webp({ quality: q }).toBuffer();
    if (buf.length <= MAX_BYTES || q <= 40) break;
    q -= 4;
  }
  fs.writeFileSync(file, buf);
  console.log(`${file}: ${width}x${height ?? 'auto'} q${q} ${(buf.length / 1024).toFixed(1)} KB`);
}

// Kapak: mevcut kapağın boyutu (yoksa 1120x630)
let cw = 1120, ch = 630;
if (fs.existsSync(COVER)) { const m = await sharp(fs.readFileSync(COVER)).metadata(); cw = m.width; ch = m.height; }
await write(path.join(SRC, 'kapak.webp'), COVER, cw, ch);

for (const n of NAMES) {
  const input = path.join(SRC, n + '.webp');
  const m = await sharp(input).metadata();
  await write(input, path.join(OUT, n + '.webp'), GALLERY_W, Math.round((m.height * GALLERY_W) / m.width));
}
