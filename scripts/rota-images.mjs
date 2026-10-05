#!/usr/bin/env node
// Rota tanıtım görsellerini yayına hazırlar.
// - Kapak: kaynak 16:9 olduğundan kırpmadan, mevcut kapakla aynı boyuta (1120x630) indirir.
//   Eski kapak (üç telefon) ilk çalıştırmada assets-src/yayin-disi/ altına yedeklenir.
// - Galeri: kapak, takip, icgoru görsellerini 1600 px genişlikte WebP yazar (üst veri yok).
// - Her çıktı 200 KB'ın altında kalana dek kaliteyi düşürür.
// Kullanım: node scripts/rota-images.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets-src/originals/projects/rota';
const OUT = 'public/assets/projects/rota';
const COVER = 'public/assets/projects/rota.webp';
const BACKUP = 'assets-src/yayin-disi/rota-kapak-telefonlar.webp';
const FILES = { kapak: 'kapak.webp', takip: 'takip.png', icgoru: 'icgoru.png' };
const GALLERY_W = 1600;
const MAX_BYTES = 200 * 1024;

sharp.cache(false); // Windows'ta çıktı dosyasını kilitlemesin
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(BACKUP), { recursive: true });

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

// Kapak: mevcut kapağın boyutu (yoksa 1120x630); eski kapağı yalnızca bir kez yedekle
let cw = 1120, ch = 630;
if (fs.existsSync(COVER)) {
  if (!fs.existsSync(BACKUP)) fs.copyFileSync(COVER, BACKUP);
  const m = await sharp(fs.readFileSync(COVER)).metadata(); cw = m.width; ch = m.height;
}
await write(path.join(SRC, FILES.kapak), COVER, cw, ch);

for (const [n, f] of Object.entries(FILES)) {
  const input = path.join(SRC, f);
  const m = await sharp(input).metadata();
  await write(input, path.join(OUT, n + '.webp'), GALLERY_W, Math.round((m.height * GALLERY_W) / m.width));
}
