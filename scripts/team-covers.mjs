#!/usr/bin/env node
// Deptron ve İHA (AITT) kartları için 1120x630 kapak görselleri üretir.
// - Düz zemin + ortada, tam katla (×2) en yakın komşu ile büyütülmüş pixel logo + ince çerçeve.
// - Degrade, bulanıklık, yazı, damalı desen yok. İki kapak aynı düzeni paylaşır, yalnızca renkleri farklı.
// Kullanım: node scripts/team-covers.mjs
import sharp from 'sharp';

const CW = 1120, CH = 630;
const SCALE = 2; // 192 -> 384 px (kapak yüksekliğinin ~%61'i)
const FRAME = { inset: 20, width: 4 };

const CREAM = [0xf4, 0xe4, 0xc1]; // --cream
const CREAM_DARK = [0xe0, 0xc9, 0x96]; // --cream-dark
const BG = [0x2b, 0x20, 0x30]; // --bg
const BG_LIGHT = [0x45, 0x37, 0x4d]; // koyu zeminin biraz açığı (çerçeve)
const ORANGE_DARK = [0xa8, 0x43, 0x1a]; // --orange-dark

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Logoyu ham RGBA olarak oku; kenar artıklarını (yarı saydam gri) önlemek için alfayı eşikle.
async function loadLogo(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), w: info.width, h: info.height };
}

// Deptron: koyu zeminde okunsun diye açıklık tersine çevrilir (siyah -> krem, beyaz çizgiler -> zemin tonu).
// Şekil ve iç detay korunur; alfa sert eşiklenir.
function lightenDeptron({ data, w, h }) {
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    if (a < 128) continue;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const c = mix(BG_LIGHT, CREAM, 1 - lum);
    out.set([c[0], c[1], c[2], 255], i * 4);
  }
  return { data: out, w, h };
}

// AITT: çizgiler ince, bu yüzden 1 px kalınlaştırılır (en yakın opak komşunun rengi alınır);
// soluk uç kısımlar da tam opak olur ve sert kenar kalır.
function thickenAitt({ data, w, h }) {
  const solid = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 40) continue;
    const c = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    // Soluk (açık) pikselleri bakır tona doğru koyulaştır ki krem zeminde kaybolmasınlar.
    const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    const k = lum > 0.6 ? Math.min(1, (lum - 0.6) * 2.2) : 0;
    const d = mix(c, ORANGE_DARK, 0.2 + k * 0.5);
    solid.set([d[0], d[1], d[2], 255], i * 4);
  }
  const out = Buffer.from(solid);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (out[i + 3]) continue;
      // 4 komşudan biri doluysa boyayı yay (1 px kalınlaşma)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = (ny * w + nx) * 4;
        if (solid[j + 3]) { out.set(solid.subarray(j, j + 4), i); break; }
      }
    }
  }
  return { data: out, w, h };
}

async function cover({ logo, bg, frame, corner, file }) {
  const png = await sharp(logo.data, { raw: { width: logo.w, height: logo.h, channels: 4 } })
    .resize(logo.w * SCALE, logo.h * SCALE, { kernel: 'nearest' })
    .png()
    .toBuffer();
  const lw = logo.w * SCALE, lh = logo.h * SCALE;
  const { inset: ins, width: fw } = FRAME;
  // Çerçeve ve köşelerde 8 px'lik kare pikseller (keskin kenar için shape-rendering)
  const sq = (x, y) => `<rect x="${x}" y="${y}" width="8" height="8" fill="${hex(corner)}"/>`;
  const o = ins + fw + 12;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" shape-rendering="crispEdges">` +
      `<rect x="${ins}" y="${ins}" width="${CW - ins * 2}" height="${CH - ins * 2}" fill="none" stroke="${hex(frame)}" stroke-width="${fw}"/>` +
      sq(o, o) + sq(CW - o - 8, o) + sq(o, CH - o - 8) + sq(CW - o - 8, CH - o - 8) +
      `</svg>`,
  );
  await sharp({ create: { width: CW, height: CH, channels: 3, background: hex(bg) } })
    .composite([
      { input: svg, left: 0, top: 0 },
      { input: png, left: Math.round((CW - lw) / 2), top: Math.round((CH - lh) / 2) },
    ])
    .webp({ quality: 85 }) // üst veri yazılmaz (varsayılan)
    .toFile(file);
  console.log('Yazıldı:', file);
}

const deptron = lightenDeptron(await loadLogo('public/assets/logos/deptron.png'));
const aitt = thickenAitt(await loadLogo('public/assets/logos/aitt.png'));

await cover({ logo: deptron, bg: BG, frame: BG_LIGHT, corner: BG_LIGHT, file: 'public/assets/projects/deptron.webp' });
await cover({ logo: aitt, bg: CREAM, frame: CREAM_DARK, corner: CREAM_DARK, file: 'public/assets/projects/iha.webp' });
