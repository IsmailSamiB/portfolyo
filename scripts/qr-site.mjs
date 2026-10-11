// Sitenin QR kodunu sabit SVG olarak üretir (CV'nin baskı sürümünde kullanılır).
// Kullanım: npm run qr  ->  public/assets/ui/qr-site.svg
import qrcode from 'qrcode-generator';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_SITE = 'https://ismailsamib.github.io/portfolyo/';
const OUT = new URL('../public/assets/ui/qr-site.svg', import.meta.url);
const QUIET = 4; // sessiz bölge (modül)
const DARK = '#2b2030';

const qr = qrcode(0, 'M');
qr.addData(URL_SITE);
qr.make();

const n = qr.getModuleCount();
const size = n + QUIET * 2;
// Her satırdaki ardışık koyu modüller tek yatay çizgide birleşir
let d = '';
for (let y = 0; y < n; y++) {
  let x = 0;
  while (x < n) {
    if (!qr.isDark(y, x)) { x++; continue; }
    const start = x;
    while (x < n && qr.isDark(y, x)) x++;
    d += `M${start + QUIET} ${y + QUIET}h${x - start}v1h-${x - start}z`;
  }
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
  `<rect width="${size}" height="${size}" fill="#fff"/><path fill="${DARK}" d="${d}"/></svg>\n`;

mkdirSync(new URL('./', OUT), { recursive: true });
writeFileSync(OUT, svg, 'utf8');
console.log(`qr-site.svg: ${n}x${n} modül, ${svg.length} bayt`);
