#!/usr/bin/env node
// Klasik görünümün galeri küçük resimlerini üretir (ilk açılış ağırlığını azaltmak için).
// - src/content/content.js içindeki tüm gallery[].src yollarını okur.
// - Her biri için aynı klasörde thumb-<ad>.webp yazar: 240 px genişlik, en-boy oranı korunur,
//   WebP kalite ~70, üst veri yok. `thumb-` ile başlayan dosyalar girdi sayılmaz.
// - Yeniden çalıştırılabilir: çıktılar her seferinde baştan yazılır.
// Kullanım: node scripts/thumbs.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const CONTENT = 'src/content/content.js';
const PUBLIC = 'public';
const WIDTH = 240;
const QUALITY = 70;

sharp.cache(false); // Windows'ta çıktı dosyasını kilitlemesin

// "src: './assets/projects/x/y.webp'" biçimindeki galeri yollarını toplar (kapak kökteki dosyalar hariç tutulur)
const text = fs.readFileSync(CONTENT, 'utf8');
const srcs = [...new Set([...text.matchAll(/src:\s*['"](\.\/assets\/projects\/[^'"]+)['"]/g)].map((m) => m[1]))];

let total = 0, count = 0;
for (const src of srcs) {
  const input = path.join(PUBLIC, src.replace(/^\.\//, ''));
  const base = path.basename(input);
  if (base.startsWith('thumb-')) continue;
  if (!fs.existsSync(input)) { console.warn('Yok, atlandı:', input); continue; }
  const out = path.join(path.dirname(input), 'thumb-' + base.replace(/\.[^.]+$/, '') + '.webp');
  const buf = await sharp(input).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer();
  fs.writeFileSync(out, buf);
  total += buf.length; count++;
  console.log(`${out}: ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log(`${count} küçük resim, toplam ${(total / 1024).toFixed(1)} KB`);
