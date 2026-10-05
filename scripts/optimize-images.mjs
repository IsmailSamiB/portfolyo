// public/assets altındaki jpg/png görsellerini WebP'ye çevirir (npm run images).
// Özgün dosyalar silinmez; assets-src/originals/ altına aynı klasör yapısıyla taşınır.
// Sprite sayfaları (sprites/*.png) şeffaf PNG olarak kalır. Yeniden çalıştırmak güvenlidir.
import { readdir, mkdir, rename, stat, copyFile, unlink } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public', 'assets');
const BACKUP = join(ROOT, 'assets-src', 'originals');

const SKIP_DIRS = new Set(['sprites']);
const EXTS = new Set(['.jpg', '.jpeg', '.png']);

// Dosyaya göre ayar: fotoğraf/illüstrasyon kayıplı, grafikler kayıpsıza yakın.
function settingsFor(rel) {
  const key = rel.split(sep).join('/');
  if (key === 'ui/portrait.png') {
    return { resize: { width: 384, height: 384, fit: 'cover', withoutEnlargement: true }, webp: { quality: 85, alphaQuality: 100, effort: 6 } };
  }
  if (key.endsWith('.png')) return { webp: { nearLossless: true, quality: 85, effort: 6 } };
  return { webp: { quality: 80, effort: 6 } };
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...(await walk(join(dir, entry.name))));
    } else if (EXTS.has(extname(entry.name).toLowerCase())) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

// Farklı sürücüde rename çalışmazsa kopyala + sil.
async function move(from, to) {
  await mkdir(dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch {
    await copyFile(from, to);
    await unlink(from);
  }
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

const files = await walk(SRC);
if (!files.length) {
  console.log('Çevrilecek jpg/png yok (hepsi zaten WebP).');
  process.exit(0);
}

let before = 0;
let after = 0;
const rows = [];
for (const file of files) {
  const rel = relative(SRC, file);
  const target = file.slice(0, -extname(file).length) + '.webp';
  const { resize, webp } = settingsFor(rel);
  let image = sharp(file);
  if (resize) image = image.resize(resize);
  await image.webp(webp).toFile(target);
  const a = (await stat(file)).size;
  const b = (await stat(target)).size;
  await move(file, join(BACKUP, rel));
  before += a;
  after += b;
  rows.push({ dosya: rel.split(sep).join('/'), önce: kb(a), sonra: kb(b), kazanç: `${Math.round((1 - b / a) * 100)}%` });
}

console.table(rows);
console.log(`Toplam: ${kb(before)} -> ${kb(after)} (${Math.round((1 - after / before) * 100)}% küçüldü)`);
console.log(`Özgün dosyalar: ${relative(ROOT, BACKUP)}`);
