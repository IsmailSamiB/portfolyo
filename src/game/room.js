// Odanın yerleşimi: arka plan tek parça bir resimdir (public/assets/room/room.webp);
// buradaki ızgara, engeller ve etkileşim noktaları o resme göre ölçülmüştür.
// Koordinatlar oyun pikselidir (resim 312×144'e sığdırılır, 1 karo = 8 px).

export const TILE = 8;
export const COLS = 39;
export const ROWS = 18;
export const ROOM_W = COLS * TILE;
export const ROOM_H = ROWS * TILE;

// Yürünebilir alan: duvarların içi (sütun 1..37, satır 5..16)
const MIN_C = 1;
const MAX_C = 37;
const MIN_R = 5;
const MAX_R = 16;

export const SPAWN = { c: 14, r: 8 };

const solid = new Set();
const key = (c, r) => r * COLS + c;
function block(c, r, w = 1, h = 1) {
  for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) solid.add(key(x, y));
}

block(1, 5, 10, 2); // çöp kovası, masa, bilgisayar kasası
block(21, 5, 4, 2); // kitaplık
block(25, 5, 3, 1); // ayaklı lamba + saksı
block(33, 5, 2, 2); // komodin
block(35, 5, 3, 4); // yatak
block(16, 9, 7, 1); // bank
block(18, 11, 4, 2); // sehpa
block(11, 12, 2, 3); // armut koltuk
block(1, 11, 4, 4); // piyano
block(36, 12, 2, 2); // telefon sehpası
block(1, 15, 2, 2); // saksı (sol alt)
block(1, 7, 2, 4); // arcade makinesi (sol duvara yaslı)
block(36, 9, 2, 2); // ziyaretçi defteri masası
block(36, 15, 2, 2); // saksı (sağ alt)

export function isFree(c, r) {
  return c >= MIN_C && c <= MAX_C && r >= MIN_R && r <= MAX_R && !solid.has(key(c, r));
}

// Karakterin ayak kutusu (x±4, y-5..y-1) tamamen boş karolarda mı?
export function canStand(x, y) {
  const pts = [
    [x - 4, y - 5],
    [x + 3, y - 5],
    [x - 4, y - 1],
    [x + 3, y - 1],
  ];
  return pts.every(([px, py]) => isFree(Math.floor(px / TILE), Math.floor(py / TILE)));
}

export function tileAt(x, y) {
  return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
}

export function tileCenter(c, r) {
  return { x: c * TILE + 4, y: r * TILE + 6 };
}

// 8 yönlü A*: en kısa yolu bulur (çaprazda köşe kesmez). Başlangıç karosu hariç yol döner; ulaşılamıyorsa null.
export function findPath(from, to) {
  if (!isFree(to.c, to.r)) return null;
  if (from.c === to.c && from.r === to.r) return [];
  const h = (c, r) => {
    const dx = Math.abs(c - to.c);
    const dy = Math.abs(r - to.r);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const start = key(from.c, from.r);
  const cost = new Map([[start, 0]]);
  const prev = new Map();
  const open = [{ c: from.c, r: from.r, f: h(from.c, from.r) }];
  const done = new Set();
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cur = open.splice(best, 1)[0];
    const ck = key(cur.c, cur.r);
    if (done.has(ck)) continue;
    done.add(ck);
    if (cur.c === to.c && cur.r === to.r) {
      const path = [];
      for (let k = ck; k !== start; k = prev.get(k)) path.unshift({ c: k % COLS, r: Math.floor(k / COLS) });
      return path;
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const c = cur.c + dc;
        const r = cur.r + dr;
        if (!isFree(c, r)) continue;
        if (dc && dr && (!isFree(cur.c + dc, cur.r) || !isFree(cur.c, cur.r + dr))) continue;
        const nk = key(c, r);
        const g = cost.get(ck) + (dc && dr ? Math.SQRT2 : 1);
        if (g >= (cost.get(nk) ?? Infinity)) continue;
        cost.set(nk, g);
        prev.set(nk, ck);
        open.push({ c, r, f: g + h(c, r) });
      }
    }
  }
  return null;
}

function clearLine(a, b) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!canStand(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

// Karo karo zikzak yerine, arası açık olan noktaları düz çizgiyle birleştirir.
export function smoothPath(start, points) {
  const out = [];
  let from = start;
  let i = 0;
  while (i < points.length) {
    let j = points.length - 1;
    while (j > i && !clearLine(from, points[j])) j--;
    out.push(points[j]);
    from = points[j];
    i = j + 1;
  }
  return out;
}

export function randomFreeTile() {
  for (let i = 0; i < 50; i++) {
    const c = MIN_C + Math.floor(Math.random() * (MAX_C - MIN_C + 1));
    const r = MIN_R + Math.floor(Math.random() * (MAX_R - MIN_R + 1));
    if (isFree(c, r)) return { c, r };
  }
  return SPAWN;
}

// Etkileşim noktaları.
//  kind: panel (ana bölüm) · overlay (piyano/manzara) · sit · lie · lamp · lights · strum · sip · water · flavor
//  anchor: yakınlık ölçülen nokta (yoksa yalnızca tıklamayla) · stand: yürünecek karo · hit: dokunma alanı
//  mark: ipucu simgesinin yeri · seat: oturma/uzanma konumu ve yönü · secret: bulununca sayılan sır
export const INTERACTABLES = [
  // yalnızca tıklanarak bakılan duvar süsleri (alttaki geniş alanlardan önce eşleşsin diye başta)
  { id: 'poster', kind: 'flavor', stand: { c: 4, r: 7 }, hit: { x: 24, y: 10, w: 16, h: 17 } },
  { id: 'camera', kind: 'flavor', stand: { c: 24, r: 7 }, hit: { x: 188, y: 14, w: 9, h: 7 } },

  { id: 'projects', kind: 'panel', anchor: { x: 60, y: 54 }, stand: { c: 7, r: 7 }, hit: { x: 34, y: 22, w: 34, h: 18 }, mark: { x: 51, y: 22 } },
  { id: 'about', kind: 'panel', anchor: { x: 98, y: 42 }, stand: { c: 12, r: 5 }, hit: { x: 84, y: 13, w: 27, h: 18 }, mark: { x: 98, y: 11 } },
  { id: 'skills', kind: 'panel', anchor: { x: 185, y: 54 }, stand: { c: 23, r: 7 }, hit: { x: 172, y: 21, w: 26, h: 31 }, mark: { x: 185, y: 15 } },
  { id: 'contact', kind: 'panel', anchor: { x: 291, y: 108 }, stand: { c: 35, r: 13 }, hit: { x: 289, y: 94, w: 17, h: 20 }, mark: { x: 298, y: 93 } },

  { id: 'piano', kind: 'overlay', secret: 'piano', anchor: { x: 36, y: 108 }, stand: { c: 5, r: 13 }, hit: { x: 8, y: 90, w: 28, h: 25 }, mark: { x: 22, y: 88 }, seat: { x: 22, y: 116, dir: 'up' } },
  // duvardaki fotoğraflar: Gdańsk kartpostalı
  { id: 'postcard', kind: 'overlay', anchor: { x: 262, y: 42 }, stand: { c: 32, r: 5 }, hit: { x: 261, y: 11, w: 20, h: 16 }, mark: { x: 270, y: 10 } },
  { id: 'view', kind: 'overlay', anchor: { x: 143, y: 42 }, stand: { c: 17, r: 5 }, hit: { x: 122, y: 5, w: 42, h: 27 }, mark: { x: 143, y: 8 } },

  { id: 'stool', kind: 'sit', secret: 'sit', anchor: { x: 48, y: 56 }, stand: { c: 5, r: 7 }, hit: { x: 43, y: 46, w: 10, h: 11 }, mark: { x: 48, y: 44 }, seat: { x: 48, y: 59, dir: 'up' } },
  { id: 'bench', kind: 'sit', secret: 'sit', anchor: { x: 155, y: 88 }, stand: { c: 19, r: 10 }, hit: { x: 129, y: 71, w: 52, h: 11 }, mark: { x: 155, y: 68 }, seat: { x: 155, y: 84, dir: 'down' } },
  { id: 'bench', kind: 'sit', secret: 'sit', anchor: { x: 155, y: 70 }, stand: { c: 19, r: 8 }, hit: { x: 0, y: 0, w: 0, h: 0 }, mark: { x: 155, y: 68 }, seat: { x: 155, y: 84, dir: 'down' } },
  { id: 'beanbag', kind: 'sit', secret: 'sit', anchor: { x: 95, y: 122 }, stand: { c: 11, r: 15 }, hit: { x: 86, y: 101, w: 18, h: 15 }, mark: { x: 95, y: 98 }, seat: { x: 95, y: 115, dir: 'down' } },
  { id: 'bed', kind: 'lie', secret: 'bed', anchor: { x: 288, y: 72 }, stand: { c: 35, r: 9 }, hit: { x: 282, y: 28, w: 24, h: 43 }, mark: { x: 294, y: 30 }, seat: { x: 294, y: 54, dir: 'down' } },

  { id: 'deskLamp', kind: 'lamp', secret: 'lamp', anchor: { x: 29, y: 56 }, stand: { c: 3, r: 7 }, hit: { x: 25, y: 28, w: 8, h: 9 }, mark: { x: 29, y: 26 } },
  { id: 'floorLamp', kind: 'lamp', secret: 'lamp', anchor: { x: 206, y: 49 }, stand: { c: 25, r: 6 }, hit: { x: 201, y: 23, w: 10, h: 26 }, mark: { x: 206, y: 21 } },
  { id: 'nightLamp', kind: 'lamp', secret: 'lamp', anchor: { x: 274, y: 56 }, stand: { c: 33, r: 7 }, hit: { x: 265, y: 26, w: 15, h: 26 }, mark: { x: 276, y: 24 } },
  { id: 'lights', kind: 'lights', secret: 'lights', anchor: { x: 89, y: 43 }, stand: { c: 11, r: 5 }, hit: { x: 86, y: 34, w: 6, h: 6 }, mark: { x: 89, y: 32 } },

  { id: 'guitar', kind: 'strum', secret: 'guitar', anchor: { x: 117, y: 42 }, stand: { c: 14, r: 5 }, hit: { x: 113, y: 21, w: 9, h: 24 }, mark: { x: 117, y: 20 } },
  { id: 'table', kind: 'sip', secret: 'coffee', anchor: { x: 156, y: 105 }, stand: { c: 19, r: 13 }, hit: { x: 141, y: 92, w: 31, h: 14 }, mark: { x: 156, y: 90 } },
  // defter masası ve arcade makinesi oda resminin içinde; mini İHA ayrı sprite (PROPS)
  { id: 'guestbook', kind: 'overlay', icon: 'markPen', anchor: { x: 290, y: 86 }, stand: { c: 35, r: 10 }, hit: { x: 288, y: 72, w: 18, h: 19 }, mark: { x: 297, y: 73 } },
  { id: 'minigame', kind: 'overlay', icon: 'markJoy', anchor: { x: 26, y: 78 }, stand: { c: 3, r: 9 }, hit: { x: 7, y: 52, w: 19, h: 36 }, mark: { x: 25, y: 56 } }, // işaret makinenin sağ üst köşesinde; çöp kovasını (x 12-19, y 41-51) örtmez
  { id: 'drone', kind: 'drone', secret: 'drone', anchor: { x: 250, y: 128 }, stand: { c: 30, r: 15 }, hit: { x: 243, y: 120, w: 14, h: 12 }, mark: { x: 250, y: 118 } },
  { id: 'plant', kind: 'water', secret: 'plant', anchor: { x: 219, y: 49 }, stand: { c: 27, r: 6 }, hit: { x: 213, y: 28, w: 11, h: 21 }, mark: { x: 219, y: 27 } },
  { id: 'plant', kind: 'water', secret: 'plant', anchor: { x: 24, y: 128 }, stand: { c: 3, r: 15 }, hit: { x: 9, y: 122, w: 14, h: 16 }, mark: { x: 16, y: 120 } },
  { id: 'plant', kind: 'water', secret: 'plant', anchor: { x: 290, y: 128 }, stand: { c: 35, r: 15 }, hit: { x: 291, y: 122, w: 13, h: 16 }, mark: { x: 297, y: 120 } },

  { id: 'door', kind: 'flavor', secret: 'door', anchor: { x: 247, y: 42 }, stand: { c: 30, r: 5 }, hit: { x: 238, y: 6, w: 18, h: 35 }, mark: { x: 247, y: 8 } },
  { id: 'trash', kind: 'flavor', secret: 'trash', anchor: { x: 22, y: 70 }, stand: { c: 3, r: 8 }, hit: { x: 11, y: 40, w: 9, h: 11 }, mark: { x: 15, y: 38 } },
  { id: 'tower', kind: 'flavor', anchor: { x: 79, y: 56 }, stand: { c: 9, r: 7 }, hit: { x: 76, y: 37, w: 8, h: 14 }, mark: { x: 79, y: 35 } },
];
// Arcade ekranının üstündeki hafif ışık: resimdeki makine "açık" görünsün.
export const ARCADE_GLOW = { x: 18, y: 67, tint: 0x8fe6ff, scale: 0.3 };

// Oda resminde olmayan, üstüne ayrı sprite olarak konan eşyalar (yalnızca hareket edenler).
//  key: doku (public/assets/sprites/<key>.png varsa) · x/base: alt-orta noktası (base aynı zamanda derinlik)
//  scale: çizim ölçeği · frames + every: kareler arasında geçiş süresi (ms)
export const PROPS = [
  { id: 'drone', key: 'drone', x: 250, base: 130, scale: 0.2, frames: [0, 1], every: 70 },
];
