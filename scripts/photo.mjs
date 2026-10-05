// Klasik görünüm girişindeki fotoğrafı üretir: assets-src/photo.jpg (1477x2000) -> public/assets/ui/photo.webp (480x480).
// Vesikalık kadrajı: kaynağın tam genişliği, kare kesit; göz hizası üstten ~%43, baş üstünde boşluk, omuzlar görünür.
// Kaynak bundan daha geniş değil; kenarlar doldurulmaz/uydurulmaz. Üst veri (EXIF) yazılmaz. Kullanım: node scripts/photo.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets-src', 'photo.jpg');
const OUT = join(ROOT, 'public', 'assets', 'ui', 'photo.webp');

const { width } = await sharp(SRC).metadata();
const TOP = 40; // kesit üst kenarı (px, kaynak koordinatı)
await sharp(SRC)
  .extract({ left: 0, top: TOP, width, height: width })
  .resize(480, 480, { fit: 'cover' })
  .webp({ quality: 85, effort: 6 })
  .toFile(OUT);
console.log(`photo.webp yazıldı (${width}x${width} kesit, top=${TOP}).`);
