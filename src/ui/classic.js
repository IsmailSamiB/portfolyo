import './classic.css';
import { emit, on } from '../bridge.js';
import { lang, pick, PRINT_TITLE, documentTitle } from '../i18n.js';
import content from '../content/content.js';
import { sortedProjects, projectDate } from '../content/projects.js';
import S from './strings.js';
import { el, extLink, safeUrl, toParagraphs, reducedMotion } from './dom.js';

// Klasik görünüm: content.js'teki içeriğin tek sayfalık, hızlı okunan CV hali.

// Yalnızca bu sayfaya ait metinler.
const T = {
  skip: { tr: 'İçeriğe atla', en: 'Skip to content' },
  nav: { tr: 'Sayfa içi gezinme', en: 'On-page navigation' },
  numbers: { tr: 'Sayılarla', en: 'In numbers' },
  about: { tr: 'Hakkımda', en: 'About me' },
  highlights: { tr: 'Öne çıkanlar', en: 'Highlights' },
  projects: { tr: 'Projeler', en: 'Projects' },
  experience: { tr: 'Deneyim', en: 'Experience' },
  activities: { tr: 'Aktiviteler', en: 'Activities' },
  activitiesTitle: { tr: 'Aktiviteler', en: 'Activities' },
  education: { tr: 'Eğitim', en: 'Education' },
  certificates: { tr: 'Sertifikalar', en: 'Certificates' },
  languages: { tr: 'Diller', en: 'Languages' },
  skills: { tr: 'Yetenekler', en: 'Skills' },
  contact: { tr: 'İletişim', en: 'Contact' },
  guestbook: { tr: 'Defter', en: 'Guestbook' },
  guestbookTitle: { tr: 'Ziyaretçi defteri', en: 'Guestbook' },
  cta: { tr: 'Birlikte çalışalım', en: "Let’s work together" },
  findings: { tr: 'Bulgular', en: 'Findings' },
  latest: { tr: 'En yeni', en: 'Latest' },
  now: { tr: 'şimdi', en: 'now' },
  more: { tr: 'Devamını göster', en: 'Show more' },
  less: { tr: 'Daha az göster', en: 'Show less' },
  demo: { tr: 'Canlı demo', en: 'Live demo' },
  source: { tr: 'Kaynak kod', en: 'Source code' },
  gallery: { tr: 'Görseller', en: 'Images' },
  enlarge: { tr: 'büyüt', en: 'enlarge' },
  photoAlt: { tr: 'fotoğrafı', en: 'photo' },
  level: { tr: 'Seviye', en: 'Level' },
  legend: [
    { tr: 'temel / öğreniyorum', en: 'basic / learning' },
    { tr: 'gelişiyor', en: 'developing' },
    { tr: 'rahat kullanıyorum', en: 'comfortable' },
    { tr: 'iyi', en: 'good' },
    { tr: 'çok iyi', en: 'very good' },
  ],
  copy: { tr: 'Kopyala', en: 'Copy' },
  copied: { tr: 'Kopyalandı!', en: 'Copied!' },
  copyFailed: { tr: 'Kopyalanamadı', en: 'Copy failed' },
  close: { tr: 'Kapat', en: 'Close' },
  prev: { tr: 'Önceki görsel', en: 'Previous image' },
  next: { tr: 'Sonraki görsel', en: 'Next image' },
  foot: {
    tr: 'Bu CV aslında gezilebilir bir pixel oda: sağ üstteki düğmeyle odamı gezebilirsin.',
    en: 'This CV is actually a walkable pixel room: use the button at the top right to explore it.',
  },
  logoCredit: {
    tr: 'Gdańsk Tech logosu: Wikimedia Commons / Asas077, CC BY-SA 3.0 (pixel görünüme uyarlandı). YTÜ logosu Yıldız Teknik Üniversitesi’nin tescilli markasıdır. Deptron ve AITT logoları ilgili takımlara aittir.',
    en: 'Gdańsk Tech logo: Wikimedia Commons / Asas077, CC BY-SA 3.0 (adapted to pixel art). The YTU logo is a registered trademark of Yıldız Technical University. The Deptron and AITT logos belong to their respective teams.',
  },
  privacy: {
    tr: 'Tarayıcında rastgele bir ziyaretçi kimliği saklanır; hangi bölümlerin açıldığı, başvuru bağlantısındaki şirket etiketi ve tıkladığın dış bağlantının adresi gibi anonim kullanım bilgisi Google Firebase’de tutulur. Ad, e-posta ve IP adresi kaydedilmez. Tarayıcın “Takip edilmesin” (Do Not Track) istiyorsa hiçbiri kaydedilmez. Deftere yazdığın ad ve mesaj, onaylanırsa yayınlanır.',
    en: 'A random visitor ID is stored in your browser; anonymous usage info, such as which sections are opened, the company tag in an application link and the address of an external link you click, is kept in Google Firebase. No name, email or IP address is recorded. If your browser sends “Do Not Track”, none of it is recorded. A name and message left in the guestbook are published if approved.',
  },
  // Yalnızca baskıda (CV çıktısının en altında) görünür; adres: CV_SITE.
  cvSite: { tr: 'Etkileşimli sürüm', en: 'Interactive version' },
};

// ---------- CV çıktısı (yalnızca baskı) ----------
// Baskıda klasik görünümün yerine tek A4 sayfalık ayrı bir blok (.cl-cv) çıkar. Metinler content.js'ten
// seçilerek alınır, yeni metin yazılmaz: uzun özetlerin yalnızca baştaki cümleleri basılır.
const CV_SITE = 'https://ismailsamib.github.io/portfolyo';
const CV_SUMMARY_MAX = 170; // proje özeti: yaklaşık iki satır (karakter)
const CV_NOTE_MAX = 90; // aktivite notu: yaklaşık bir satır
const CV_NOTES = false;

// Nokta, cümle sonu sayılmayan kısaltmalar ("vb. Ankara" gibi).
const CV_ABBREV = /(?:^|[\s(“"])(?:vb|vs|vd|bkz|örn|yak|dr|doç|prof|no|etc|approx|e\.g|i\.e|mr|mrs|ms|st)$/i;

// Metni cümlelere böler: sınır, ardından boşluk ve büyük harf gelen . ! ? işaretidir.
// Kısaltma, tek harf ("A. Yılmaz") ve bir-iki basamaklı sıra sayısından ("1. sınıf") sonraki nokta sınır sayılmaz.
function cvSentences(text) {
  const source = String(text || '').trim();
  const parts = [];
  const boundary = /[.!?](?=\s+[“"‘'(]?\p{Lu})/gu;
  let from = 0;
  let match;
  while ((match = boundary.exec(source))) {
    const head = source.slice(from, match.index);
    if (match[0] === '.' && (CV_ABBREV.test(head) || /(?:^|[\s(])(?:\p{L}|\d{1,2})$/u.test(head))) continue;
    parts.push(source.slice(from, match.index + 1).trim());
    from = match.index + 1;
  }
  const rest = source.slice(from).trim();
  if (rest) parts.push(rest);
  return parts;
}

// Kısa metin: ilk cümle, ardından sınırı (max karakter) aşmadığı sürece sonraki tam cümleler.
// İlk cümle tek başına sınırı aşıyorsa ilk noktalı virgül ya da iki noktadan kesilir ve nokta ile kapatılır.
function cvShort(text, max, sentences = 1) {
  const [first = '', ...others] = cvSentences(text);
  if (first.length > max) {
    const cut = first.search(/[;:]\s/);
    return cut > 0 ? `${first.slice(0, cut)}.` : first;
  }
  let out = first;
  for (const sentence of others.slice(0, Math.max(0, sentences - 1))) {
    if (out.length + 1 + sentence.length > max) break;
    out += ` ${sentence}`;
  }
  return out;
}

// Baskıda okunur yazılan kısa adres (şema, "www." ve sondaki "/" atılır; yüzde kodları çözülür).
function shortUrl(href) {
  const text = String(href || '')
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/\/$/, '');
  try {
    return decodeURI(text);
  } catch {
    return text; // çözülemezse kodlu hâli kalır
  }
}

// Yazdırma sırasında belge başlığı (PDF dosya adı olur; ASCII, iki dilde aynı).
const PRINT_TITLE_SAFETY = 120000; // afterprint gelmezse başlık bu süre sonunda geri döner

const NAV =['skills', 'projects', 'experience', 'education', 'activities', 'guestbook', 'contact'];
const ROOM_IMAGE = './assets/room/room.webp';
// Yazı tipleri (Jersey 15 başlık, Jersey 10 gövde) siteden yüklenir (public/assets/fonts, @font-face: src/style.css).

// ---------- Pixel simgeler (12x12 ızgara, emoji yok) ----------

const ICONS = {
  home: [
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '.##########.',
    '############',
    '..########..',
    '..########..',
    '..###..###..',
    '..###..###..',
    '..###..###..',
    '..###..###..',
  ],
  book: [
    '............',
    '.#####.#####',
    '.#....#....#',
    '.#.##.#.##.#',
    '.#....#....#',
    '.#.##.#.##.#',
    '.#....#....#',
    '.#.##.#.##.#',
    '.#....#....#',
    '.#####.#####',
    '......#.....',
    '............',
  ],
  train: [
    '..########..',
    '.##########.',
    '.#........#.',
    '.#........#.',
    '.#........#.',
    '.##########.',
    '.##########.',
    '.#.######.#.',
    '.##########.',
    '..########..',
    '..##....##..',
    '.##......##.',
  ],
  calendar: [
    '..#......#..',
    '.##########.',
    '.##########.',
    '.#........#.',
    '.#.##.##..#.',
    '.#.##.##..#.',
    '.#........#.',
    '.#.##.##..#.',
    '.#.##.##..#.',
    '.#........#.',
    '.##########.',
    '............',
  ],
  trophy: [
    '.##########.',
    '#.########.#',
    '#.########.#',
    '#.########.#',
    '.#.######.#.',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '.....##.....',
    '...######...',
    '..########..',
  ],
  drone: [
    '###......###',
    '.#........#.',
    '.##......##.',
    '..########..',
    '...######...',
    '...#.##.#...',
    '...######...',
    '..########..',
    '.##......##.',
    '.#........#.',
    '###......###',
    '............',
  ],
  // Büyüteç (artı işaretli): galerisi olan kapaklardaki "büyüt" rozeti
  zoom: [
    '...#####....',
    '..#.....#...',
    '.#...#...#..',
    '.#...#...#..',
    '.#.#####.#..',
    '.#...#...#..',
    '.#...#...#..',
    '..#.....##..',
    '...#####.##.',
    '.........###',
    '..........##',
    '...........#',
  ],
  star: [
    '.....##.....',
    '.....##.....',
    '....####....',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '..########..',
    '..###..###..',
    '.###....###.',
    '.##......##.',
    '............',
  ],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function pixelIcon(name, className = 'cl-ico') {
  const rows = ICONS[name] || ICONS.star;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('shape-rendering', 'crispEdges');
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') {
        x += 1;
        continue;
      }
      const start = x;
      while (row[x] === '#') x += 1;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(start));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(x - start));
      rect.setAttribute('height', '1');
      svg.append(rect);
    }
  });
  return svg;
}

// Kapağı olmayan projeler için projeye özgü renk çifti.
const PALETTES = [
  ['#d9622b', '#a8431a'],
  ['#4fa66a', '#2f6f48'],
  ['#4f86c6', '#2f5a8f'],
  ['#c94f7c', '#8f2f55'],
  ['#8b5a3c', '#5c3a28'],
  ['#7a5cc0', '#4d3690'],
];

function paletteFor(id) {
  let hash = 0;
  for (const ch of String(id || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[hash % PALETTES.length];
}

function placeholder(project) {
  const [a, b] = paletteFor(project.id);
  return el('div', { class: 'cl-ph', style: `--ph-a:${a};--ph-b:${b}`, 'aria-hidden': 'true' }, pixelIcon(project.icon));
}

// ---------- Kaydırınca belirme: zamanlama (CSS'teki --cl-step ile aynı tutulur) ----------

const SEQ_STEP = 35; // küçük öğeler arası (ms)
const SEQ_MAX = 5; // en çok 6 kademe (0..5); sonrakiler son kademeyle gelir
const SEQ_MINI = 60; // proje kartındaki sayı kutularının başlangıç gecikmesi
const RV_STEP = 35; // aynı anda görünen kardeş kartlar arası
const RV_MAX = 4;
const TL_STEP = 40; // aynı anda görünen zaman çizgisi kayıtları arası: önceki çizgi parçası inerken sıradaki nokta belirir
const TL_MAX = 3;
const RV_SETTLE = 1500; // bu süre sonunda animasyon kuralları kalkar (is-done); en uzun dizi ~0,9 sn
const RV_SWEEP = 400; // güvenlik ağı turu: iki ardışık turda (0,4-0,8 sn) ekranda olup açılmamış öğe doğrudan gösterilir
const RV_RATIO = 0.01; // gözlemci eşiği
const RV_BOTTOM = 0; // görünüm alanının alttan sayılmayan payı

// ---------- Açılış (hero) ve "Devamını göster" ----------

const INTRO_TYPE = 860; // unvan yazımının toplam süresi (CSS'teki --hi-type-dur ile aynı)
const INTRO_SAFETY = 2400; // bu süre sonunda açılış sınıfları kalkar, unvan düz metne döner
let introPlayed = false; // bu sayfa yüklemesinde bir kez oynar (oyundan dönüşte, dil değişiminde oynamaz)

const MORE_MS = 220; // CSS'teki --cl-t-med ile aynı
const MORE_SAFETY = 200;
const MORE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const FILTER_MAX = 8; // etiket süzgecindeki en çok çip ("Hepsi" hariç)
const TARGET_MS = 2600; // bağlantıyla gelinen kartın vurgusu: kaydırma payı + 2 sn (CSS: cl-target 650 ms x 4)
const TARGET_STILL = 2000; // hareket azaltmada: sabit çerçeve
const TARGET_WAIT = 800; // yazı tipi bu sürede gelmezse beklenmeden kaydırılır

// Harfleri (grafem) böler: Türkçe karakterler ve birleşik işaretler tek parça kalır.
function graphemes(text) {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment);
    }
  } catch {
    /* Segmenter yoksa ya da hata verirse Array.from */
  }
  return Array.from(text);
}

// ---------- Sayaçlar ----------

// "1,06 milyar" -> rakam kısmı sayılır, biçim (ondalık/binlik ayırıcı) ve kalan metin korunur.
function parseCount(text) {
  const match = /^(\d+(?:[.,]\d+)*)(.*)$/s.exec(String(text));
  if (!match) return null;
  const dec = lang() === 'tr' ? ',' : '.';
  const grp = dec === ',' ? '.' : ',';
  const parts = match[1].split(dec);
  if (parts.length > 2) return null;
  const intRaw = parts[0];
  const frac = parts[1] || '';
  if (frac.includes(grp)) return null;
  const grouped = intRaw.includes(grp);
  if (grouped && !/^\d{1,3}(?:[.,]\d{3})+$/.test(intRaw)) return null;
  const target = Number(intRaw.split(grp).join('') + frac);
  if (!Number.isSafeInteger(target) || target <= 0) return null;
  return { target, fracLen: frac.length, grouped, dec, grp, rest: match[2], final: String(text) };
}

function formatCount(value, c) {
  const digits = String(value).padStart(c.fracLen + 1, '0');
  let int = c.fracLen ? digits.slice(0, -c.fracLen) : digits;
  const frac = c.fracLen ? digits.slice(-c.fracLen) : '';
  if (c.grouped) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, c.grp);
  return (frac ? int + c.dec + frac : int) + c.rest;
}

const COUNT_MS = 400; // kısa: ara değer uzun süre görünmesin

// delay: kartın belirme gecikmesi (ms); sayı o kadar bekleyip saymaya başlar.
// rAF durursa (gizli sekme) zamanlayıcı, görünürlük değişimi ya da settle() son değeri yazar:
// bitişte metin her zaman özgün metindir (c.final).
function runCounter(node, c, ctx, delay) {
  const start = performance.now() + delay;
  let done = false;
  let timer = 0;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    ctx.running.delete(node);
    node.style.removeProperty('min-width');
    node.textContent = c.final;
  };
  if (document.hidden) return; // metin zaten son hâlinde
  ctx.running.set(node, finish);
  timer = setTimeout(finish, delay + COUNT_MS + 400);
  // Sayarken kutu genişliği değişmesin (satır kayması olmasın).
  const width = node.getBoundingClientRect().width;
  if (width > 0) node.style.minWidth = `${Math.ceil(width)}px`;
  node.textContent = formatCount(0, c);
  function step(now) {
    if (done) return;
    if (!ctx.alive) {
      finish();
      return;
    }
    const t = Math.min(1, (now - start) / COUNT_MS);
    if (t >= 1) {
      finish();
      return;
    }
    if (t > 0) node.textContent = formatCount(Math.round(c.target * (1 - (1 - t) ** 3)), c);
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- Lightbox ----------

// Geçiş süreleri (ms). Her geçiş ayrıca bir zaman aşımıyla da biter (animasyon olayı gelmezse takılmasın).
const LB_FADE = 160;
const LB_OPEN = 240;
const LB_CLOSE = 180;
const LB_SLIDE = 90;
const LB_SAFETY = 150;
const LB_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const LB_FRAME_EXTRA = 8; // çerçevenin 4px'lik iki kenarlığı (yatay ve dikey)
const LB_MAX_W = 1400; // görselin doğal genişliğini aşmaz (fit)
const LB_SWIPE = 40;

const lbWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// node.animate ile oynatır; bitince, iptalde, hata olursa ya da süre + güvenlik payı dolunca çözülür.
function lbRun(node, frames, ms) {
  return new Promise((resolve) => {
    let timer = 0;
    const end = () => {
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(end, ms + LB_SAFETY);
    try {
      const anim = node.animate(frames, { duration: ms, easing: LB_EASE, fill: 'both' });
      anim.onfinish = end;
      anim.oncancel = end;
    } catch {
      end();
    }
  });
}

function lbClear(...nodes) {
  nodes.forEach((node) => {
    if (node.getAnimations) node.getAnimations().forEach((anim) => anim.cancel());
  });
}

// Görseli önceden yükler; boyutlarını verir (hata ya da zaman aşımında 0).
function lbPreload(src) {
  return new Promise((resolve) => {
    const probe = new Image();
    let timer = 0;
    const done = () => {
      clearTimeout(timer);
      probe.onload = null;
      probe.onerror = null;
      resolve({ w: probe.naturalWidth, h: probe.naturalHeight });
    };
    timer = setTimeout(done, 4000);
    probe.onload = done;
    probe.onerror = done;
    probe.src = src;
  });
}

function createLightbox() {
  let items = [];
  let index = 0;
  let target = 0; // art arda basışlarda varılmak istenen görsel
  let dir = 1;
  let opener = null;
  let title = '';
  let state = 'closed'; // closed | opening | open | closing
  let revealed = false;
  let navigating = false;
  let token = 0; // her açma/kapamada artar; eski asenkron akışları geçersiz kılar
  let dims = { w: 0, h: 0 };
  let resizeRaf = 0;

  const img = el('img', { class: 'cl-lb-img', alt: '' });
  const caption = el('figcaption', { class: 'cl-lb-cap' });
  const count = el('span', { class: 'cl-lb-count', 'aria-hidden': 'true' });
  const closeBtn = el('button', { type: 'button', class: 'cl-lb-btn cl-lb-close', onclick: () => close() }, '×');
  const prevBtn = el('button', { type: 'button', class: 'cl-lb-btn', onclick: () => step(-1) }, '◄');
  const nextBtn = el('button', { type: 'button', class: 'cl-lb-btn', onclick: () => step(1) }, '►');
  const frame = el('figure', { class: 'cl-lb-frame' }, img, caption);
  const stage = el('div', { class: 'cl-lb-stage' }, frame);
  let swallowClick = 0;
  const overlay = el(
    'div',
    {
      class: 'cl-lb',
      role: 'dialog',
      'aria-modal': 'true',
      hidden: true,
      // Çerçeve ve düğmeler dışındaki her tıklama kapatır.
      onclick: (event) => {
        if (Date.now() < swallowClick) return;
        if (!(event.target instanceof Element) || !event.target.closest('.cl-lb-frame, button')) close();
      },
    },
    el('div', { class: 'cl-lb-top' }, closeBtn),
    stage,
    el('div', { class: 'cl-lb-nav' }, prevBtn, count, nextBtn),
  );
  document.body.append(overlay);

  // Çerçeve, görsel alanı (üst) ile altyazı (alt) ayrı satır olacak biçimde boyutlanır:
  // genişlik, görselin oranı ve doğal genişliği ile sahnenin kalan yüksekliğinden hesaplanır.
  function fit() {
    if (overlay.hidden || !dims.w || !dims.h) return;
    const ar = dims.w / dims.h;
    const availW = Math.max(60, stage.clientWidth - 16);
    const availH = Math.max(60, stage.clientHeight - 16);
    let w = Math.floor(Math.min(dims.w + LB_FRAME_EXTRA, LB_MAX_W, availW));
    for (let i = 0; i < 6; i += 1) {
      frame.style.width = `${w}px`;
      const capH = caption.offsetHeight;
      const total = (w - LB_FRAME_EXTRA) / ar + capH + LB_FRAME_EXTRA;
      if (total <= availH + 0.5) break;
      w = Math.floor(Math.max(60, (availH - LB_FRAME_EXTRA - capH) * ar) + LB_FRAME_EXTRA);
    }
  }

  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (state === 'open' || state === 'opening') fit();
    });
  }

  function swap(to, size) {
    index = to;
    target = to;
    dims = size;
    const item = items[to];
    const text = pick(item.caption) || title;
    frame.classList.toggle('is-portrait', Boolean(item.portrait));
    img.src = safeUrl(item.src);
    img.alt = text;
    caption.textContent = text;
    count.textContent = `${to + 1} / ${items.length}`;
    fit();
  }

  async function settleImage() {
    try {
      await Promise.race([img.decode(), lbWait(400)]);
    } catch {
      /* decode başarısızsa görsel yine de çizilir */
    }
  }

  // Açan öğenin ekrandaki konumundan çerçeveye FLIP dönüşümü; ölçülemezse null.
  function flipTransform(node) {
    if (reducedMotion() || !node || !node.isConnected) return null;
    const r = node.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || !f.width || !f.height) return null;
    if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return null;
    const scale = Math.min(1.5, Math.max(0.05, r.width / f.width));
    const dx = r.left + r.width / 2 - (f.left + f.width / 2);
    const dy = r.top + r.height / 2 - (f.top + f.height / 2);
    return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`;
  }

  // Ön yükleme 150 ms'yi aşarsa çerçeveye is-loading eklenir (hızlı geçişlerde hiç görünmez)
  let loadTimer = 0;
  function setBusy(on) {
    clearTimeout(loadTimer);
    loadTimer = 0;
    if (on) loadTimer = setTimeout(() => frame.classList.add('is-loading'), 150);
    else frame.classList.remove('is-loading');
  }

  async function step(d) {
    if (state !== 'open' || items.length < 2) return;
    dir = d < 0 ? -1 : 1;
    target = (target + d + items.length) % items.length;
    count.textContent = `${target + 1} / ${items.length}`;
    if (navigating) return;
    navigating = true;
    const t = token;
    while (target !== index) {
      const to = target;
      setBusy(true);
      const size = await lbPreload(safeUrl(items[to].src));
      setBusy(false);
      if (t !== token || state !== 'open') return;
      const slide = !reducedMotion();
      if (slide) {
        await lbRun(
          frame,
          [
            { transform: 'none', opacity: 1 },
            { transform: `translateX(${-dir * 40}px)`, opacity: 0 },
          ],
          LB_SLIDE,
        );
        if (t !== token || state !== 'open') return;
      }
      swap(to, size);
      await settleImage();
      if (t !== token || state !== 'open') return;
      if (slide) {
        await lbRun(
          frame,
          [
            { transform: `translateX(${dir * 40}px)`, opacity: 0 },
            { transform: 'none', opacity: 1 },
          ],
          LB_SLIDE,
        );
        if (t !== token || state !== 'open') return;
        lbClear(frame);
      }
    }
    navigating = false;
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (state === 'closing') {
      // Kapanırken etkileşim kesilir.
      if (event.key === 'Tab' || event.key.startsWith('Arrow')) event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'Tab') {
      // Odak lightbox içinde döner.
      const focusables = [closeBtn, prevBtn, nextBtn].filter((node) => !node.hidden);
      const at = focusables.indexOf(document.activeElement);
      const move = event.shiftKey ? -1 : 1;
      event.preventDefault();
      focusables[(at + move + focusables.length) % focusables.length].focus();
    }
  }

  // Dokunmatik kaydırma: yatay swipe önceki/sonraki. Dikey kaydırma ve yakınlaştırma tarayıcıda kalır (touch-action: pan-y pinch-zoom).
  const touches = new Map();
  let swipe = null;
  overlay.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    touches.set(event.pointerId, true);
    swipe = touches.size === 1 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  overlay.addEventListener('pointerup', (event) => {
    const was = swipe && swipe.id === event.pointerId ? swipe : null;
    touches.delete(event.pointerId);
    swipe = null;
    if (!was || state !== 'open' || items.length < 2) return;
    const dx = event.clientX - was.x;
    const dy = event.clientY - was.y;
    if (Math.abs(dx) >= LB_SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swallowClick = Date.now() + 400;
      step(dx < 0 ? 1 : -1);
    }
  });
  overlay.addEventListener('pointercancel', (event) => {
    touches.delete(event.pointerId);
    swipe = null;
  });

  async function open(list, start, label, from) {
    items = (list || []).filter((item) => item && item.src);
    if (!items.length) return;
    if (state === 'closing') finishClose();
    title = label || '';
    opener = from || null;
    const single = items.length < 2;
    prevBtn.hidden = single;
    nextBtn.hidden = single;
    count.hidden = single;
    overlay.setAttribute('aria-label', `${title} · ${pick(T.gallery)}`);
    closeBtn.setAttribute('aria-label', pick(T.close));
    prevBtn.setAttribute('aria-label', pick(T.prev));
    nextBtn.setAttribute('aria-label', pick(T.next));
    const idx = (((start || 0) % items.length) + items.length) % items.length;
    const t = (token += 1);
    navigating = false;
    setBusy(false);
    if (state === 'open') {
      // Zaten açık: animasyonsuz değiştir.
      const size = await lbPreload(safeUrl(items[idx].src));
      if (t !== token || state !== 'open') return;
      lbClear(frame);
      swap(idx, size);
      return;
    }
    // Kapalı ya da açılıyor: açılış akışı (yeni öğelerle) baştan yürür; dinleyiciler aynı işlevle olduğundan ikilenmez.
    lbClear(overlay, frame);
    state = 'opening';
    revealed = false;
    index = idx;
    target = idx;
    // Güvenlik ağı: açılış makul sürede görünür olmazsa temiz kapat.
    setTimeout(() => {
      if (t === token && state === 'opening' && !revealed) finishClose();
    }, 4000 + 400 + LB_SAFETY + 600);
    overlay.style.visibility = 'hidden';
    overlay.hidden = false;
    document.body.classList.add('cl-lb-open');
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    const size = await lbPreload(safeUrl(items[idx].src));
    if (t !== token || state !== 'opening') return;
    swap(idx, size);
    await settleImage();
    if (t !== token || state !== 'opening') return;
    fit();
    const from0 = flipTransform(opener);
    overlay.style.visibility = '';
    revealed = true;
    closeBtn.focus();
    if (reducedMotion()) {
      state = 'open';
      return;
    }
    await Promise.all([
      lbRun(overlay, [{ opacity: 0 }, { opacity: 1 }], LB_FADE),
      lbRun(
        frame,
        from0
          ? [{ transform: from0 }, { transform: 'none' }]
          : [
              { transform: 'scale(0.96)', opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
        LB_OPEN,
      ),
    ]);
    if (t !== token || state !== 'opening') return;
    lbClear(overlay, frame);
    state = 'open';
  }

  function finishClose() {
    if (state === 'closed') return;
    token += 1;
    state = 'closed';
    navigating = false;
    setBusy(false);
    revealed = false;
    lbClear(overlay, frame);
    overlay.hidden = true;
    overlay.style.visibility = '';
    document.body.classList.remove('cl-lb-open');
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    img.removeAttribute('src');
    frame.style.removeProperty('width');
    items = [];
    dims = { w: 0, h: 0 };
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }

  async function close() {
    if (overlay.hidden || state === 'closed' || state === 'closing') return;
    token += 1;
    const t = token;
    navigating = false;
    setBusy(false);
    lbClear(overlay, frame);
    if (!revealed || reducedMotion()) {
      finishClose();
      return;
    }
    state = 'closing';
    const to = flipTransform(opener);
    await Promise.all([
      lbRun(overlay, [{ opacity: 1 }, { opacity: 0 }], LB_CLOSE),
      lbRun(
        frame,
        to
          ? [{ transform: 'none' }, { transform: to }]
          : [
              { transform: 'none', opacity: 1 },
              { transform: 'scale(0.96)', opacity: 0 },
            ],
        LB_CLOSE,
      ),
    ]);
    if (t === token && state === 'closing') finishClose();
  }

  return { open, close };
}

// ---------- Küçük yardımcılar ----------

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text),
    );
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text) {
  try {
    const area = el('textarea', { readonly: true, 'aria-hidden': 'true', style: 'position:fixed;top:0;left:0;opacity:0' });
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function clampLevel(level) {
  return Math.max(0, Math.min(5, Math.round(Number(level) || 0)));
}

function levelBar(level, row) {
  const value = clampLevel(level);
  return el(
    'span',
    { class: 'cl-lvl', role: 'img', 'aria-label': `${pick(T.level)} ${value}/5` },
    [0, 1, 2, 3, 4].map((i) => el('span', { class: `cl-lvl-b${i < value ? ' is-on' : ''}`, style: `--i:${row * 2 + i}` })),
  );
}

function legendItem(count, text) {
  return el(
    'span',
    { class: 'cl-legend-item' },
    el(
      'span',
      { class: 'cl-legend-blocks', 'aria-hidden': 'true' },
      Array.from({ length: count }, (_, i) => el('span', { class: 'cl-lvl-b is-on', style: `--i:${count - 1 + i}` })),
    ),
    text,
  );
}

function linkButtons(links, firstAccent) {
  return (links || [])
    .filter((link) => link && link.url)
    .map((link, i) => el('li', null, extLink(link.url, pick(link.label), `cl-btn${firstAccent && i === 0 ? ' cl-btn--accent' : ''}`)));
}

// "Devamını göster": özet (3 satır kırpma) ve bulgular listesi kısa bir yükseklik + opaklık geçişiyle açılır/kapanır.
// Sınıflar (is-clamped / is-collapsed) her zaman nihai durumu söyler; geçiş yalnızca üstüne binen bir WAAPI animasyonudur.
// Kapanırken kırpma sınıfı geçiş BİTİNCE uygulanır (metin son ana kadar tam görünür); açılırken hemen kalkar.
// Art arda tıklama: eski geçiş iptal edilir, yeni geçiş o anki ölçüden başlar. Süre + pay dolunca geçiş zorla bitirilir.
function createExpander(ctx, summary, finds, more) {
  let open = false;
  let current = null; // { cancel, finish }

  const setClasses = (isOpen) => {
    summary.classList.toggle('is-clamped', !isOpen);
    if (finds) finds.classList.toggle('is-collapsed', !isOpen);
  };

  const cancelMove = () => {
    if (current) current.cancel();
  };

  function toggle() {
    open = !open;
    more.setAttribute('aria-expanded', String(open));
    more.textContent = pick(open ? T.less : T.more);

    const canAnimate = ctx.animate && !reducedMotion() && !document.hidden && typeof summary.animate === 'function';
    if (!canAnimate) {
      cancelMove();
      setClasses(open);
      return;
    }

    // 1) Başlangıç ölçüleri (süren bir geçiş varsa o anki değerler)
    const gap = parseFloat(getComputedStyle(summary.parentElement).rowGap) || 0;
    const fromS = summary.getBoundingClientRect().height;
    let fromF = { h: 0, m: -gap, o: 0 };
    if (finds && !finds.classList.contains('is-collapsed')) {
      const style = getComputedStyle(finds);
      fromF = { h: finds.getBoundingClientRect().height, m: parseFloat(style.marginTop) || 0, o: parseFloat(style.opacity) };
      if (!Number.isFinite(fromF.o)) fromF.o = 1;
    }

    // 2) Eski geçişi bırak, hedef ölçüleri al
    cancelMove();
    setClasses(true);
    let toS = summary.getBoundingClientRect().height;
    let toF = finds ? finds.getBoundingClientRect().height : 0;
    if (!open) {
      summary.classList.add('is-clamped');
      toS = summary.getBoundingClientRect().height;
      summary.classList.remove('is-clamped');
      toF = 0;
    }
    const goal = open;

    // 3) Geçiş
    let done = false;
    let timer = 0;
    let anims = [];
    const stop = () => {
      clearTimeout(timer);
      ctx.moves.delete(end);
      if (current && current.finish === end) current = null;
      for (const anim of anims) anim.cancel();
      summary.classList.remove('is-moving');
      if (finds) finds.classList.remove('is-moving');
    };
    function end() {
      if (done) return;
      done = true;
      setClasses(goal); // animasyon hâlâ tuttuğu için sıçrama olmaz; sonra iptal edilir
      stop();
    }
    summary.classList.add('is-moving');
    if (finds) finds.classList.add('is-moving');
    const options = { duration: MORE_MS, easing: MORE_EASE, fill: 'forwards' };
    try {
      anims.push(summary.animate([{ height: `${fromS}px` }, { height: `${toS}px` }], options));
      if (finds) {
        anims.push(
          finds.animate(
            [
              { height: `${fromF.h}px`, marginTop: `${fromF.m}px`, opacity: fromF.o },
              { height: `${toF}px`, marginTop: goal ? '0px' : `${-gap}px`, opacity: goal ? 1 : 0 },
            ],
            options,
          ),
        );
      }
      anims[0].onfinish = end;
    } catch {
      end();
      return;
    }
    timer = setTimeout(end, MORE_MS + MORE_SAFETY);
    ctx.moves.add(end);
    current = {
      finish: end,
      cancel: () => {
        done = true;
        stop();
      },
    };
  }

  return toggle;
}

// ---------- Sayfa ----------

function build(ctx) {
  const p = content.profile || {};
  const c = content.contact || {};
  const language = lang();

  // Animasyon açıksa gizleme sınıfını JS ekler; kapalıysa içerik doğrudan görünür.
  // Kademe gecikmesini (--cl-d) gözlemci verir: aynı anda görünen kardeşler sırayla açılır.
  function rv(node) {
    if (!node || !ctx.animate) return node;
    node.classList.add('cl-reveal');
    ctx.reveals.push(node);
    return node;
  }

  // Kapsayıcının çocukları, kapsayıcı (ya da üstündeki .cl-reveal) görününce tek tek gelir.
  // base: grubun başlangıç gecikmesi (ms). En çok SEQ_MAX + 1 kademe.
  function seq(node, base = 60) {
    if (!node || !ctx.animate) return node;
    node.classList.add('cl-seq');
    node.style.setProperty('--cl-seq-d', `${base}ms`);
    Array.from(node.children).forEach((child, i) => child.style.setProperty('--cl-i', String(Math.min(i, SEQ_MAX))));
    return node;
  }

  // extra: sayının, kartın kendi gecikmesine eklenen beklemesi (ms).
  function counter(text, className, extra = 0) {
    const value = String(pick(text));
    const node = el('strong', { class: className, text: value });
    if (ctx.animate) {
      const parsed = parseCount(value);
      // Küçük sayılar ("2", "1 dönem") saydırılmaz: ara değerleri anlamsız görünür.
      if (parsed && parsed.target >= 10) ctx.counters.set(node, { ...parsed, extra });
    }
    return node;
  }

  function section(id, title, children, options = {}) {
    const headingId = `cl-${id}-h`;
    return el(
      'section',
      { id: `cl-${id}`, class: `cl-section cl-section--${id}`, 'aria-labelledby': headingId, tabindex: '-1' },
      options.srOnly ? el('h2', { id: headingId, class: 'sr-only', text: title }) : rv(el('h2', { id: headingId, class: 'cl-h2', text: title })),
      children,
    );
  }

  // Kulüp / takım / gönüllülük kayıtları; dizi yoksa ya da boşsa bölüm ve bağlantısı çizilmez.
  const activities = Array.isArray(content.activities) ? content.activities.filter(Boolean) : [];

  // --- Gezinme ---
  const navLinks = new Map();
  const navList = el(
    'ul',
    { class: 'cl-nav' },
    NAV.filter((id) => id !== 'activities' || activities.length > 0).map((id) => {
      const link = el('a', { href: `#cl-${id}`, text: pick(T[id]), onclick: (event) => ctx.goTo(event, id) });
      navLinks.set(id, link);
      return el('li', null, link);
    }),
  );
  ctx.navLinks = navLinks;
  ctx.navList = navList;
  const bar = el('nav', { class: 'cl-bar', 'aria-label': pick(T.nav) }, el('div', { class: 'cl-bar-in' }, navList));
  // Dar ekranda menü yatay kayar: kaydırılabilecek kenarda kısa bir solma gösterilir.
  const fadeNav = () => {
    const room = navList.scrollWidth - navList.clientWidth;
    navList.style.setProperty('--fade-l', room > 2 && navList.scrollLeft > 2 ? '28px' : '0px');
    navList.style.setProperty('--fade-r', room > 2 && room - navList.scrollLeft > 2 ? '28px' : '0px');
  };
  navList.addEventListener('scroll', fadeNav, { passive: true });
  ctx.fadeNav = fadeNav;

  // --- Kahraman ---
  const contactLinks = c.links || [];
  let photo = null;
  if (p.photo) {
    const img = el('img', {
      src: safeUrl(p.photo),
      alt: `${p.name || ''} ${pick(T.photoAlt)}`.trim(),
      width: 240,
      height: 240,
      loading: 'eager',
      fetchpriority: 'high',
      decoding: 'async',
    });
    photo = el('figure', { class: 'cl-photo' }, img);
    // Fotoğraf yüklenemezse çerçeve de gizlenir.
    img.addEventListener('error', () => photo.remove(), { once: true });
  }
  const hero = el(
    'header',
    { class: 'cl-hero' },
    el('div', { class: 'cl-hero-bg', 'aria-hidden': 'true', style: `background-image:url('${ROOM_IMAGE}')` }),
    el(
      'div',
      { class: 'cl-wrap cl-hero-in' },
      photo,
      el(
        'div',
        { class: 'cl-hero-text' },
        el('h1', { class: 'cl-name', text: p.name }),
        el('p', { class: 'cl-title', text: pick(p.title) }),
        el('p', { class: 'cl-tagline', text: pick(p.tagline) }),
        p.location && el('p', { class: 'cl-loc' }, el('span', { class: 'cl-pin', 'aria-hidden': 'true' }), pick(p.location)),
        el(
          'ul',
          { class: 'cl-actions' },
          c.email && el('li', null, el('a', { class: 'cl-btn cl-btn--accent', href: safeUrl(`mailto:${c.email}`), text: c.email })),
          linkButtons(contactLinks, false),
        ),
      ),
    ),
  );

  // --- Sayılarla ---
  const stats = p.stats || [];
  const statsSection =
    stats.length > 0 &&
    section(
      'numbers',
      pick(T.numbers),
      el(
        'ul',
        { class: 'cl-wrap cl-stats' },
        stats.map((stat) =>
          rv(el('li', { class: 'cl-stat' }, counter(stat.value, 'cl-stat-v'), el('span', { class: 'cl-stat-l', text: pick(stat.label) }))),
        ),
      ),
      { srOnly: true },
    );

  // --- Hakkımda ---
  const highlights = p.highlights || [];
  const aboutSection = section(
    'about',
    pick(T.about),
    el(
      'div',
      { class: 'cl-about' },
      rv(el('div', { class: 'cl-prose' }, toParagraphs(p.bio, pick).map((text) => el('p', { text })))),
      highlights.length > 0 &&
        rv(
          el(
            'div',
            { class: 'cl-high' },
            el('h3', { class: 'cl-h3', text: pick(T.highlights) }),
            seq(el('ul', { class: 'cl-badges' }, highlights.map((item) => el('li', { text: pick(item) })))),
          ),
        ),
    ),
  );

  // --- Projeler ---
  // Küçük resim: tembel yükleme yatay şeritte boş kutu bırakıyordu; kaynak, görünüm açılınca atanır.
  function thumbImage(src) {
    // decoding: sync -> yüklenir yüklenmez boyanır (async'te kutu boş kalabiliyordu).
    const img = el('img', { alt: '', width: 120, height: 90, decoding: 'sync' });
    // Küçük resim thumb-<ad>.webp (scripts/thumbs.mjs); yoksa tam boyutlu dosyaya düşer (tek seferlik).
    const full = safeUrl(src);
    const thumb = full && full.replace(/([^/?#]+?)(\.[^./?#]+)?([?#].*)?$/, 'thumb-$1.webp$3');
    img.addEventListener(
      'error',
      () => {
        // Yüklenemeyen küçük resim kırık simge yerine boş kutu olarak kalır (CSS: img:not([src])).
        if (thumb && full && img.getAttribute('src') === thumb && thumb !== full) {
          img.addEventListener('error', () => img.removeAttribute('src'), { once: true });
          img.src = full;
        } else img.removeAttribute('src');
      },
      { once: true },
    );
    ctx.thumbs.push({ img, src: thumb || full });
    return img;
  }

  function projectCard(project, i) {
    const title = pick(project.title);
    const gallery = (project.gallery || []).filter((item) => item && item.src);
    // project:open: proje açılışı ölçümü (kapak/galeri, "Devamını göster", doğrudan bağlantı)
    const openAt = (start, from) => {
      emit('project:open', { id: project.id });
      ctx.lightbox.open(gallery, start, title, from);
    };

    let media = placeholder(project);
    if (project.cover) {
      // coverCenter: logo kapakları üstten değil ortadan kırpılır
      const img = el('img', {
        src: safeUrl(project.cover),
        alt: title,
        class: project.coverCenter ? 'is-centered' : null,
        loading: 'lazy',
        decoding: 'async',
      });
      media = img;
      // Kareye yakın kapak (grafik) kırpılmaz: yüklenince oranı 16:9'dan belirgin dar ise tamamı gösterilir.
      const markContain = () => {
        if (!project.coverCenter && img.naturalWidth && img.naturalHeight && img.naturalWidth / img.naturalHeight < 1.4) img.classList.add('is-contain');
      };
      img.addEventListener('load', markContain, { once: true });
      if (img.complete) markContain();
      // Kapak yüklenemezse yer tutucuya düş.
      img.addEventListener('error', () => img.replaceWith(placeholder(project)), { once: true });
    }
    if (gallery.length > 0) {
      const start = Math.max(0, gallery.findIndex((item) => item.src === project.cover));
      media = el(
        'button',
        {
          type: 'button',
          class: 'cl-cover-btn',
          'aria-label': `${title}: ${pick(T.gallery)} (${pick(T.enlarge)})`,
          onclick: (event) => openAt(start, event.currentTarget),
        },
        media,
      );
    }

    const links = project.links || {};
    const linkItems = [];
    if (links.demo) linkItems.push({ label: pick(T.demo), url: pick(links.demo) });
    if (links.source) linkItems.push({ label: pick(T.source), url: pick(links.source) });
    for (const extra of links.extra || []) {
      if (extra && extra.url) linkItems.push({ label: pick(extra.label), url: pick(extra.url), note: extra.note && pick(extra.note), extra: true });
    }
    // Vurgulu düğme: demo varsa o, yoksa ilk ek bağlantı.
    const accent = linkItems.find((item) => item.label === pick(T.demo) && !item.extra) || linkItems.find((item) => item.extra);
    const tags = project.tags || [];
    const projectStats = project.stats || [];

    // Öne çıkan kart dışındakilerde özet 3 satırda kesilir, bulgular listesi (varsa) kapalı gelir; düğme ikisini de açar.
    // Açılacak bir şey yoksa (özet kırpılmamış, bulgu yok) düğme fitClamps'te gizlenir.
    const sumId = `cl-sum-${project.id}`;
    const findId = `cl-find-${project.id}`;
    const summary = el('p', { id: sumId, class: 'cl-card-sum', text: pick(project.summary) });
    const findingList = Array.isArray(project.findings) ? project.findings : [];
    const finds =
      findingList.length > 0 &&
      el(
        'div',
        { id: findId, class: 'cl-find' },
        el('h4', { class: 'cl-find-h', text: pick(T.findings) }),
        seq(el('ul', null, findingList.map((item) => el('li', { text: pick(item) })))),
      );
    let more = null;
    if (i > 0) {
      summary.classList.add('is-clamped');
      if (finds) finds.classList.add('is-collapsed');
      more = el('button', {
        type: 'button',
        class: 'cl-more',
        'aria-expanded': 'false',
        'aria-controls': finds ? `${sumId} ${findId}` : sumId,
        text: pick(T.more),
      });
      more.addEventListener('click', createExpander(ctx, summary, finds || null, more));
      // Yalnızca açılırken (üstteki dinleyici aria-expanded'ı önce günceller)
      more.addEventListener('click', () => {
        if (more.getAttribute('aria-expanded') === 'true') emit('project:open', { id: project.id });
      });
      ctx.clamps.push({ summary, more, hasFinds: Boolean(finds) });
    }
    const noteId = (at) => `cl-note-${project.id}-${at}`;

    // "Bağlantıyı kopyala": bu karta doğrudan açılan adres (?classic&proje=<id>). Durum metni e-posta kopyalamadaki gibi.
    const linkStatus = el('span', { class: 'cl-link-status', role: 'status', 'aria-live': 'polite' });
    let linkTimer = 0;
    const copyLinkBtn = el('button', {
      type: 'button',
      class: 'cl-btn cl-btn--quiet',
      'aria-label': `${pick(S.projects.copyLink)}: ${title}`,
      text: pick(S.projects.copyLink),
      onclick: () => {
        const url = `${window.location.origin}${window.location.pathname}?classic&proje=${encodeURIComponent(project.id)}`;
        copyText(url).then((ok) => {
          linkStatus.textContent = pick(ok ? S.contact.copied : T.copyFailed);
          linkStatus.classList.toggle('is-error', !ok);
          clearTimeout(linkTimer);
          linkTimer = setTimeout(() => {
            linkStatus.textContent = '';
          }, 2200);
        });
      },
    });

    const card = rv(
      el(
        'article',
        { id: `cl-p-${project.id}`, class: `cl-card${i === 0 ? ' cl-card--feat' : ''}` },
        el(
          'figure',
          { class: 'cl-cover' },
          media,
          // Galeri varsa kapağın tıklanabildiğini gösteren küçük "büyüt" rozeti (tıklamayı düğmeye bırakır)
          gallery.length > 0 && el('span', { class: 'cl-zoom', 'aria-hidden': 'true' }, pixelIcon('zoom', 'cl-zoom-ico')),
          el(
            'p',
            { class: 'cl-date' },
            i === 0 && el('span', { class: 'cl-date-new', text: pick(T.latest) }),
            el('time', { datetime: String(project.date || ''), text: projectDate(project.date, language) }),
          ),
        ),
        el(
          'div',
          { class: 'cl-card-body' },
          el('h3', { class: 'cl-card-title', tabindex: '-1', text: title }),
          summary,
          more,
          finds,
          projectStats.length > 0 &&
            seq(
              el(
                'ul',
                { class: 'cl-mini' },
                projectStats.map((stat) =>
                  el('li', null, el('strong', { class: 'cl-mini-v', text: pick(stat.value) }), el('span', { class: 'cl-mini-l', text: pick(stat.label) })),
                ),
              ),
              SEQ_MINI,
            ),
          gallery.length > 0 &&
            el(
              'ul',
              // Tümü dikey telefon ekranıysa: yan yana dikey kutular (sütun sayısı --cl-n).
              gallery.every((item) => item.portrait)
                ? { class: 'cl-gallery cl-gallery--portrait', style: `--cl-n:${gallery.length}`, 'aria-label': pick(T.gallery) }
                : { class: 'cl-gallery', 'aria-label': pick(T.gallery) },
              gallery.map((item, at) => {
                const text = pick(item.caption) || title;
                return el(
                  'li',
                  null,
                  el(
                    'button',
                    {
                      type: 'button',
                      class: 'cl-thumb',
                      'aria-label': `${text} (${pick(T.enlarge)})`,
                      onclick: (event) => openAt(at, event.currentTarget),
                    },
                    thumbImage(item.src),
                  ),
                );
              }),
            ),
          tags.length > 0 && seq(el('ul', { class: 'cl-tags' }, tags.map(tagItem)), 120),
          el(
            'div',
            { class: 'cl-linkbox' },
            seq(
              el(
                'ul',
                { class: 'cl-links' },
                linkItems.map((item, at) => {
                  const link = extLink(item.url, item.label, `cl-btn${item === accent ? ' cl-btn--accent' : ''}`);
                  if (item.note) link.setAttribute('aria-describedby', noteId(at));
                  return el('li', null, link);
                }),
                el('li', { class: 'cl-links-copy' }, copyLinkBtn, linkStatus),
              ),
              180,
            ),
            // Notlar düğme satırının altında, tam genişlikte.
            linkItems.map((item, at) => item.note && el('p', { id: noteId(at), class: 'cl-link-note', text: item.note })),
          ),
        ),
      ),
    );
    cards.push({ node: card, keys: new Set(tags.map(tagKey)) });
    return card;
  }

  const projects = sortedProjects();

  // --- Etiket süzgeci (yalnızca klasik görünüm) ---
  // Çipler içerikten çıkar: en az iki projede geçen etiketler; ikiden az çıkarsa her projenin ilk etiketi de eklenir
  // (en çok FILTER_MAX). Etiket { tr, en } ya da düz dizgi olabilir; eşleştirme dilden bağımsız anahtarla yapılır.
  function tagKey(tag) {
    return String((tag && typeof tag === 'object' ? (tag.tr ?? tag.en) : tag) ?? '');
  }

  function collectFilterTags(list) {
    const count = new Map();
    const first = new Map(); // anahtar -> etiket (ilk görülen)
    for (const project of list) {
      const own = new Set();
      for (const tag of project.tags || []) {
        const key = tagKey(tag);
        if (!key || own.has(key)) continue;
        own.add(key);
        count.set(key, (count.get(key) || 0) + 1);
        if (!first.has(key)) first.set(key, tag);
      }
    }
    const picked = new Map();
    for (const [key, n] of count) {
      if (n >= 2 && picked.size < FILTER_MAX) picked.set(key, first.get(key));
    }
    if (picked.size < 2) {
      for (const project of list) {
        const key = tagKey((project.tags || [])[0]);
        if (key && !picked.has(key) && picked.size < FILTER_MAX) picked.set(key, first.get(key));
      }
    }
    return picked;
  }

  const filterTags = collectFilterTags(projects); // anahtar -> etiket
  const cards = []; // { node, keys }
  const filterButtons = []; // { button, key }: süzgeç satırındaki ve kartlardaki çipler
  const rowChips = new Map(); // anahtar ('' = Hepsi) -> süzgeç satırındaki düğme
  const filterCount = el('p', { class: 'cl-filter-count', role: 'status', 'aria-live': 'polite' });

  // Tek seçim; seçili çipe yeniden basmak "Hepsi"ne döner. Seçim ctx.filter'da tutulur (dil değişince korunur).
  // keep: basılan düğme. Üstündeki kartlar gizlenip sayfa kayarsa düğme ekranda aynı yerde kalır.
  function applyFilter(key, keep) {
    const next = filterTags.has(key) ? key : '';
    const before = keep ? keep.getBoundingClientRect().top : 0;
    ctx.filter.key = next;
    let shown = 0;
    for (const { node, keys } of cards) {
      const hide = Boolean(next) && !keys.has(next);
      node.hidden = hide;
      if (hide) continue;
      shown += 1;
      // Yeniden görünen kart belirme sırasını beklemez; yarım kalmış belirme animasyonu baştan oynamaz.
      if (ctx.revealIn) ctx.revealIn(node);
      if (node.classList.contains('is-in')) node.classList.add('is-done');
    }
    for (const { button, key: own } of filterButtons) button.setAttribute('aria-pressed', String(own === next));
    filterCount.textContent = shown === 1 ? pick(S.projects.showingOne) : pick(S.projects.showing).replace('{n}', String(shown));
    if (ctx.fitClamps) ctx.fitClamps(); // gizliyken ölçülemeyen özetler
    const focused = document.activeElement;
    const chip = rowChips.get(next);
    if (chip && focused instanceof Element && focused.closest('.cl-card[hidden]')) {
      // Odak gizlenen bir kartta kaldı: süzgeç satırındaki seçili çipe taşınır.
      chip.focus({ preventScroll: true });
    } else if (keep && keep.isConnected) {
      const shift = keep.getBoundingClientRect().top - before;
      if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: 'instant' });
    }
  }
  ctx.applyFilter = applyFilter;

  const toggleFilter = (key) => (event) => applyFilter(ctx.filter.key === key ? '' : key, event.currentTarget);

  function filterChip(key, label) {
    const button = el('button', { type: 'button', class: 'cl-chip', 'aria-pressed': 'false', text: label, onclick: toggleFilter(key) });
    filterButtons.push({ button, key });
    rowChips.set(key, button);
    return button;
  }

  // Kart içindeki etiket: süzgeçte karşılığı varsa aynı süzgeci seçen düğme, yoksa düz metin.
  function tagItem(tag) {
    const key = tagKey(tag);
    const text = pick(tag);
    if (!filterTags.has(key)) return el('li', { text });
    const button = el('button', {
      type: 'button',
      class: 'cl-tag-btn',
      'aria-pressed': 'false',
      'aria-label': `${pick(S.projects.filterLabel)}: ${text}`,
      text,
      onclick: toggleFilter(key),
    });
    filterButtons.push({ button, key });
    return el('li', { class: 'cl-tags-btn' }, button);
  }

  const filterRow =
    filterTags.size > 0 &&
    rv(
      el(
        'div',
        { class: 'cl-filter' },
        el(
          'div',
          { class: 'cl-filter-chips', role: 'group', 'aria-label': pick(S.projects.filterLabel) },
          filterChip('', pick(S.projects.filterAll)),
          [...filterTags].map(([key, tag]) => filterChip(key, pick(tag))),
        ),
        filterCount,
      ),
    );
  const projectsSection =
    projects.length > 0 && section('projects', pick(T.projects), [filterRow, el('div', { class: 'cl-projects' }, projects.map(projectCard))]);
  applyFilter(ctx.filter.key);

  // --- Deneyim / Eğitim ---
  // Pixel logo; yoksa ya da yüklenemezse kutu hiç yer kaplamaz.
  function schoolLogo(item) {
    if (!item.logo || typeof item.logo !== 'string') return null;
    const img = el('img', {
      src: safeUrl(item.logo),
      alt: String(pick(item.org) || pick(item.title) || ''),
      width: 64,
      height: 64,
      loading: 'lazy',
      decoding: 'async',
    });
    const box = el('span', { class: 'cl-logo' }, img);
    img.addEventListener('error', () => box.remove(), { once: true });
    return box;
  }

  // Aynı kurumdaki görevler (yeniden eskiye): kurum kaydının altında iç içe liste.
  // roles yoksa null döner; el() null çocuğu atladığı için kayıt eskisi gibi çizilir.
  function roleList(roles) {
    if (!Array.isArray(roles) || roles.length === 0) return null;
    return el(
      'ol',
      { class: 'cl-roles' },
      roles.map((role, at) => {
        const period = pick(role.period);
        const isCurrent = /devam|present/i.test(period || '');
        return el(
          'li',
          { class: isCurrent ? 'cl-roles-item is-current' : 'cl-roles-item', style: `--cl-i:${Math.min(at, SEQ_MAX)}` },
          el(
            'div',
            { class: 'cl-roles-head' },
            el('h4', { class: 'cl-roles-title', text: pick(role.title) }),
            isCurrent && el('span', { class: 'cl-roles-now', text: pick(T.now) }),
            period && el('p', { class: 'cl-roles-period', text: period }),
          ),
          role.note && el('p', { class: 'cl-roles-note', text: pick(role.note) }),
        );
      }),
    );
  }

  function timeline(items) {
    return el(
      'ol',
      { class: 'cl-tl' },
      items.map((item) =>
        rv(
          el(
            'li',
            { class: /devam|present/i.test(pick(item.period)) ? 'cl-tl-item is-current' : 'cl-tl-item' },
            schoolLogo(item),
            el(
              'div',
              { class: 'cl-tl-text' },
              el('p', { class: 'cl-tl-period', text: pick(item.period) }),
              el('h3', { class: 'cl-tl-title', text: pick(item.title) }),
              item.org && el('p', { class: 'cl-tl-org', text: pick(item.org) }),
              item.note && el('p', { class: 'cl-tl-note', text: pick(item.note) }),
              roleList(item.roles),
            ),
          ),
        ),
      ),
    );
  }

  function skillCard(group, className, fallbackTitle) {
    return el(
      'div',
      { class: className },
      el('h3', { class: 'cl-h3', text: pick(group.group) || fallbackTitle || '' }),
      seq(
        el(
          'ul',
          { class: 'cl-skill-list' },
          (group.items || []).map((item, row) =>
            el('li', { class: 'cl-skill' }, el('span', { class: 'cl-skill-name', text: pick(item.name) }), levelBar(item.level, row)),
          ),
        ),
      ),
    );
  }

  // Diller grubu (kind: 'languages') sağ sütunda kart olur; kalanlar Yetenekler'de.
  const allSkills = (content.skills || []).filter(Boolean);
  const languageGroups = allSkills.filter((group) => group.kind === 'languages');
  const skills = allSkills.filter((group) => group.kind !== 'languages');

  const experience = content.experience || [];
  const education = content.education || [];
  const certificates = content.certificates || [];
  const hasEducation = education.length > 0 || languageGroups.length > 0;
  // Sol sütun: Deneyim + Sertifikalar (Sertifikalar'ın ayrı menü öğesi yok; Deneyim yoksa Eğitim'e düşer).
  // Sağ sütun: Eğitim + Diller. Tek sütunda sıra: Deneyim, Sertifikalar, Eğitim, Diller.
  const certsBox =
    certificates.length > 0 &&
    rv(
      el(
        'div',
        { class: 'cl-certs' },
        el('h3', { class: 'cl-h3', text: pick(T.certificates) }),
        seq(el('ul', { class: 'cl-cert-list' }, certificates.map((item) => el('li', { text: pick(item) })))),
      ),
    );
  const certsInExperience = experience.length > 0;
  const pathBlock =
    (experience.length > 0 || hasEducation || certsBox) &&
    el(
      'div',
      { class: 'cl-wrap cl-two' },
      experience.length > 0 && section('experience', pick(T.experience), [timeline(experience), certsBox]),
      (hasEducation || (certsBox && !certsInExperience)) &&
        section('education', pick(T.education), [
          education.length > 0 && timeline(education),
          !certsInExperience && certsBox,
          languageGroups.map((group) => rv(skillCard(group, 'cl-langs', pick(T.languages)))),
        ]),
    );

  // --- Aktiviteler ve Projeler: iki sütunun altında, tam genişlikte ---
  // Kayıtlar sırası bozulmadan iki zaman çizgisine bölünür. Kayıt ağırlığı gerçek yüksekliğe yakındır
  // (birim ~100px; 488px'lik sütunda ölçüldü): 1,4 (başlık bloğu + kayıt arası boşluk) + görev başına 0,6
  // (görevin notu dahil) + kayıt notunun uzunluğu başına 0,005 (aktif dilde). İki yanın ağırlığını en çok dengeleyen
  // ilk kesim seçilir. Tek kayıt tek sütun olarak kalır.
  function splitActivities(items) {
    if (items.length < 2) return [items];
    const textLen = (value) => (value ? String(pick(value) || '').length : 0);
    const weights = items.map((item) => {
      const roles = Array.isArray(item.roles) ? item.roles : [];
      return 1.4 + 0.005 * textLen(item.note) + 0.6 * roles.length;
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    let cut = 1;
    let best = Infinity;
    let left = 0;
    for (let i = 1; i < items.length; i += 1) {
      left += weights[i - 1];
      const diff = Math.abs(total - 2 * left);
      if (diff < best - 1e-9) {
        best = diff;
        cut = i;
      }
    }
    return [items.slice(0, cut), items.slice(cut)];
  }

  const activityColumns = splitActivities(activities);
  const activitiesSection =
    activities.length > 0 &&
    section(
      'activities',
      pick(T.activitiesTitle),
      activityColumns.length > 1 ? el('div', { class: 'cl-act' }, activityColumns.map(timeline)) : timeline(activities),
    );

  // --- Yetenekler ---
  const skillsSection =
    skills.length > 0 &&
    section('skills', pick(T.skills), [
      el(
        'div',
        { class: 'cl-skills' },
        skills.map((group) => rv(skillCard(group, 'cl-skillcard'))),
      ),
      rv(
        seq(
          el(
            'p',
            { class: 'cl-legend' },
            T.legend.map((text, i) => legendItem(i + 1, pick(text))),
          ),
          0,
        ),
      ),
    ]);

  // --- İletişim ---
  const copyStatus = el('span', { class: 'cl-copy-status', role: 'status', 'aria-live': 'polite' });
  const copyBtn = el('button', {
    type: 'button',
    class: 'cl-btn cl-copy',
    text: pick(T.copy),
    onclick: () => {
      copyText(c.email).then((ok) => {
        copyStatus.textContent = pick(ok ? T.copied : T.copyFailed);
        // Kısa "pat": sınıf yeniden eklenerek animasyon her tıklamada baştan oynar (CSS hareket azaltmada uygulamaz)
        if (!reducedMotion()) {
          copyBtn.classList.remove('is-pop');
          copyStatus.classList.remove('is-pop');
          void copyBtn.offsetWidth;
          copyBtn.classList.add('is-pop');
          copyStatus.classList.add('is-pop');
        }
        clearTimeout(ctx.copyTimer);
        ctx.copyTimer = setTimeout(() => {
          copyStatus.textContent = '';
        }, 2200);
      });
    },
  });
  const guestbookBody = el('div', { class: 'cl-gb' });
  // Defter bölümü (ve veri isteği) klasik görünüm ilk açıldığında ayrı parçadan yüklenir.
  ctx.mountGuestbook = () => {
    ctx.mountGuestbook = null;
    import('./guestbook.js')
      .then((m) => {
        if (ctx.alive) ctx.disposeGuestbook = m.mountGuestbookSection(guestbookBody);
      })
      .catch(() => {});
  };
  const guestbookSection = section('guestbook', pick(T.guestbookTitle), rv(guestbookBody));

  const contactSection = el(
    'section',
    { id: 'cl-contact', class: 'cl-section cl-section--contact', 'aria-labelledby': 'cl-contact-h', tabindex: '-1' },
    rv(
      el(
        'div',
        { class: 'cl-wrap cl-contact' },
        el('p', { class: 'cl-contact-kicker', text: pick(T.contact) }),
        el('h2', { id: 'cl-contact-h', class: 'cl-cta', text: pick(T.cta) }),
        c.note && el('p', { class: 'cl-contact-note', text: pick(c.note) }),
        c.email &&
          el('p', { class: 'cl-mail-row' }, el('a', { class: 'cl-mail', href: safeUrl(`mailto:${c.email}`), text: c.email }), copyBtn, copyStatus),
        contactLinks.length > 0 && seq(el('ul', { class: 'cl-actions' }, linkButtons(contactLinks, true)), 120),
      ),
    ),
  );

  ctx.fitClamps = () => {
    for (const { summary, more, hasFinds } of ctx.clamps) {
      // Bulgular listesi varsa düğme hep gerekli.
      if (hasFinds || !summary.classList.contains('is-clamped') || summary.clientHeight === 0) continue;
      more.hidden = summary.scrollHeight <= summary.clientHeight + 1;
    }
  };

  // Logo atıfı yalnızca logo kullanılıyorsa gösterilir.
  const hasLogos = [...education, ...activities].some((item) => item && item.logo);
  const footer = el(
    'footer',
    { class: 'cl-foot' },
    el('p', { class: 'cl-wrap', text: pick(T.foot) }),
    el('p', { class: 'cl-wrap cl-foot-note', text: pick(T.privacy) }),
    hasLogos && el('p', { class: 'cl-wrap cl-foot-note', text: pick(T.logoCredit) }),
  );

  // --- CV çıktısı: tek A4 sayfa ---
  // Yalnızca baskıda görünür (classic.css: .cl-cv); ekranda display: none olduğu için erişilebilirlik ağacında da yoktur.
  // DOM sırası okuma sırasıdır (başvuru sistemleri metni düz okur): kimlik, ana sütun, yan sütun, site adresi.
  // İçerik seçilerek kısaltılır: Hakkımda'nın ilk paragrafı, proje özetlerinin baştaki cümleleri (cvShort),
  // proje başına tek bağlantı (kaynak kod, yoksa demo). Bulgular, sayı kutuları, galeri ve lejant basılmaz.
  function cvSection(title, body) {
    return el('section', { class: 'cl-cv-sec' }, el('h2', { class: 'cl-cv-h', text: title }), body);
  }

  // Kayıt: başlık (+ kurum) solda, tarih sağda; altında isteğe bağlı satırlar.
  function cvItem(title, org, period, ...rest) {
    return el(
      'li',
      { class: 'cl-cv-item' },
      el(
        'div',
        { class: 'cl-cv-row' },
        el('div', { class: 'cl-cv-what' }, el('h3', { class: 'cl-cv-t', text: title }), org && el('p', { class: 'cl-cv-org', text: org })),
        period && el('p', { class: 'cl-cv-when', text: period }),
      ),
      rest,
    );
  }

  // Adres dar sütunda ilk ‘/’ işaretinden sonra bölünebilsin (alan adının ortasından değil)
  function cvSiteParts() {
    const [host, ...rest] = shortUrl(CV_SITE).split('/');
    return [`${host}/`, document.createElement('wbr'), rest.join('/')];
  }

  function cvLink(url, text) {
    return el('a', { href: safeUrl(url), text: text || shortUrl(url) });
  }

  // Seviye: beş kare; dolu ve boş kare kenarlık kalınlığıyla ayrışır (renk gerekmez), metin karşılığı aria-label'da.
  function cvLevel(level) {
    const value = clampLevel(level);
    return el(
      'span',
      { class: 'cl-cv-lvl', role: 'img', 'aria-label': `${pick(T.level)} ${value}/5` },
      [0, 1, 2, 3, 4].map((i) => el('span', { class: i < value ? 'is-on' : null })),
    );
  }

  function buildCv() {
    const bio = toParagraphs(p.bio, pick);
    const cvProjects = projects.map((project) => {
      const links = project.links || {};
      const url = links.source ? pick(links.source) : links.demo ? pick(links.demo) : '';
      const tags = (project.tags || []).map((tag) => pick(tag)).filter(Boolean);
      return cvItem(
        pick(project.title),
        null,
        projectDate(project.date, language),
        el('p', { class: 'cl-cv-note', text: cvShort(pick(project.summary), CV_SUMMARY_MAX) }),
        tags.length > 0 && el('p', { class: 'cl-cv-meta', text: tags.join(' · ') }),
        url && el('p', { class: 'cl-cv-meta' }, `${pick(links.source ? T.source : T.demo)}: `, cvLink(url)),
      );
    });
    const cvActivities = activities.map((item) => {
      const roles = Array.isArray(item.roles) ? item.roles.filter(Boolean) : [];
      return cvItem(
        pick(item.title),
        item.org && pick(item.org),
        pick(item.period),
        CV_NOTES && item.note && el('p', { class: 'cl-cv-note', text: cvShort(pick(item.note), CV_NOTE_MAX) }),
        roles.length > 0 &&
          el(
            'ul',
            { class: 'cl-cv-roles' },
            roles.map((role) => el('li', null, el('span', { text: pick(role.title) }), el('span', { class: 'cl-cv-when', text: pick(role.period) }))),
          ),
      );
    });
    const full = (item) => cvItem(pick(item.title), item.org && pick(item.org), pick(item.period), item.note && el('p', { class: 'cl-cv-note', text: pick(item.note) }));

    return el(
      'div',
      { class: 'cl-cv' },
      el(
        'header',
        { class: 'cl-cv-head' },
        el(
          'div',
          { class: 'cl-cv-id' },
          el('p', { class: 'cl-cv-name', role: 'heading', 'aria-level': '1', text: p.name }),
          el('p', { class: 'cl-cv-title', text: pick(p.title) }),
          el(
            'ul',
            { class: 'cl-cv-contact' },
            c.email && el('li', null, cvLink(`mailto:${c.email}`, c.email)),
            contactLinks.filter((link) => link && link.url).map((link) => el('li', null, cvLink(link.url))),
            p.location && el('li', { text: pick(p.location) }),
          ),
        ),
        p.photo && el('img', { class: 'cl-cv-photo', src: safeUrl(p.photo), alt: `${p.name || ''} ${pick(T.photoAlt)}`.trim(), width: 240, height: 240 }),
      ),
      el(
        'div',
        { class: 'cl-cv-cols' },
        // Hakkımda DOM'da ilk sırada (okuma sırası); ızgarada dar sütunun başına yerleşir.
        bio.length > 0 && el('div', { class: 'cl-cv-about' }, cvSection(pick(T.about), el('p', { class: 'cl-cv-note', text: bio[0] }))),
        el(
          'div',
          { class: 'cl-cv-main' },
          experience.length > 0 && cvSection(pick(T.experience), el('ul', { class: 'cl-cv-list' }, experience.map(full))),
          cvProjects.length > 0 && cvSection(pick(T.projects), el('ul', { class: 'cl-cv-list' }, cvProjects)),
          cvActivities.length > 0 && cvSection(pick(T.activitiesTitle), el('ul', { class: 'cl-cv-list' }, cvActivities)),
        ),
        el(
          'div',
          { class: 'cl-cv-side' },
          education.length > 0 && cvSection(pick(T.education), el('ul', { class: 'cl-cv-list' }, education.map(full))),
          skills.length > 0 &&
            cvSection(
              pick(T.skills),
              skills.map((group) => [
                el('h3', { class: 'cl-cv-group', text: pick(group.group) }),
                el(
                  'ul',
                  { class: 'cl-cv-skills' },
                  (group.items || []).map((item) => el('li', null, el('span', { text: pick(item.name) }), cvLevel(item.level))),
                ),
              ]),
            ),
          languageGroups.map((group) =>
            cvSection(pick(group.group) || pick(T.languages), el('ul', { class: 'cl-cv-plain' }, (group.items || []).map((item) => el('li', { text: pick(item.name) })))),
          ),
          certificates.length > 0 && cvSection(pick(T.certificates), el('ul', { class: 'cl-cv-plain' }, certificates.map((item) => el('li', { text: pick(item) })))),
          // Site adresi + QR: dar sütunun altında (dikey yer kaplamaz); görsel yalnızca baskıda yüklenir
          el(
            'div',
            { class: 'cl-cv-foot' },
            el('img', { class: 'cl-cv-qr', src: './assets/ui/qr-site.svg', alt: '', width: 68, height: 68, loading: 'lazy' }),
            // Adres dar sütunda ‘/’ işaretinden bölünsün (alan adı ortasından değil)
            el('p', null, `${pick(T.cvSite)}: `, el('a', { href: safeUrl(CV_SITE) }, ...cvSiteParts())),
          ),
        ),
      ),
    );
  }

  return el(
    'div',
    { class: 'cl' },
    bar,
    hero,
    statsSection,
    aboutSection,
    skillsSection,
    projectsSection,
    pathBlock,
    activitiesSection,
    guestbookSection,
    contactSection,
    footer,
    buildCv(),
  );
}

export function createClassic(root) {
  root.classList.add('cl-root');

  const lightbox = createLightbox();
  let ctx = null;
  // "İçeriğe atla": body'nin ilk çocuğu (HUD düğmelerinden önce, ilk Tab durağı); yalnızca klasik görünümde ve odakta görünür.
  const skipLink = el('a', {
    class: 'cl-skip',
    href: '#cl-about',
    hidden: true,
    onclick: (event) => {
      if (ctx) ctx.goTo(event, 'about');
    },
  });
  document.body.prepend(skipLink);
  let active = false;
  const filterState = { key: '' }; // seçili etiket süzgeci: yeniden çizimde (dil değişimi) korunur
  let currentNav = null;
  let preferredNav = null; // son tıklanan bağlantı: aynı hizadaki bölümlerde o vurgulanır
  let sizeObserver = null;
  let watchedHud = null;

  // HUD (sağ üstte sabit) ve yapışkan çubuğun ölçüleri CSS değişkenlerine yazılır.
  function measure() {
    const hud = document.querySelector('#ui .hud-actions');
    if (hud) {
      const rect = hud.getBoundingClientRect();
      if (rect.width > 0) {
        root.style.setProperty('--hud-w', `${Math.ceil(rect.width)}px`);
        root.style.setProperty('--hud-bottom', `${Math.ceil(rect.bottom)}px`);
      }
    }
    const bar = root.querySelector('.cl-bar');
    if (bar && bar.offsetHeight > 0) root.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
    if (ctx && ctx.fitClamps) ctx.fitClamps();
    if (ctx && ctx.fadeNav) ctx.fadeNav();
  }

  function watchSizes() {
    measure();
    if (typeof ResizeObserver !== 'function') return;
    if (!sizeObserver) sizeObserver = new ResizeObserver(measure);
    const hud = document.querySelector('#ui .hud-actions');
    if (hud && hud !== watchedHud) {
      sizeObserver.observe(hud);
      watchedHud = hud;
    }
    const bar = root.querySelector('.cl-bar');
    if (bar) sizeObserver.observe(bar);
  }

  function barHeight() {
    const bar = root.querySelector('.cl-bar');
    // Alçak ekranda çubuk yapışkan değildir (içerikle kayar): başlıkları örtmez, referans çizgisine katılmaz.
    return bar && getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0;
  }

  // Kaydırma konumuna göre gezinmede etkin bölümü vurgula.
  function updateNav() {
    if (!active || !ctx) return;
    const line = barHeight() + 90;
    let current = null;
    let currentTop = -Infinity;
    for (const id of NAV) {
      const node = document.getElementById(`cl-${id}`);
      if (!node) continue;
      const top = node.getBoundingClientRect().top;
      // Yan yana duran bölümlerde (aynı hizada) ilki, tıklanmışsa tıklanan seçilir.
      if (top <= line && (top > currentTop + 4 || (id === preferredNav && Math.abs(top - currentTop) <= 4))) {
        current = id;
        currentTop = top;
      }
    }
    const doc = document.documentElement;
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4 && window.scrollY > 0) current = NAV[NAV.length - 1];
    if (current === currentNav) return;
    currentNav = current;
    for (const [id, link] of ctx.navLinks) {
      const isCurrent = id === current;
      link.classList.toggle('is-active', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      // Dar ekranda etkin bağlantı şeridin içinde görünür kalsın.
      if (isCurrent) ctx.navList.scrollLeft = link.offsetLeft - (ctx.navList.clientWidth - link.offsetWidth) / 2;
    }
  }

  let scrollQueued = false;
  function onScroll() {
    if (!active || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      updateNav();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  function goTo(event, id) {
    const target = document.getElementById(`cl-${id}`);
    if (!target) return;
    event.preventDefault();
    preferredNav = id;
    // Gidilen bölüm beklemeden açılır (odak görünmeyen içerikte kalmasın).
    if (ctx && ctx.revealIn) ctx.revealIn(target);
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
    onScroll();
  }

  // Galeri küçük resimleri oyun modunda indirilmez; klasik görünüm açılınca hepsi yüklenir.
  // Küçük resimler, galerisi ekrana yaklaşınca istenir (açılışta 12 istek birden gitmesin). Şerit yatay
  // kaydığı için tek tek değil galeri bazında gözlenir: şerit görününce içindeki bütün küçük resimler yüklenir.
  let thumbObserver = null;
  function fillGallery(gallery) {
    for (const img of gallery.querySelectorAll('img[data-thumb]')) {
      const src = img.dataset.thumb;
      delete img.dataset.thumb;
      img.src = src;
    }
  }
  function loadThumbs() {
    if (!ctx) return;
    const list = ctx.thumbs.splice(0);
    if (typeof IntersectionObserver !== 'function') {
      for (const { img, src } of list) img.src = src;
      return;
    }
    if (!thumbObserver) {
      thumbObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            thumbObserver.unobserve(entry.target);
            fillGallery(entry.target);
          }
        },
        { rootMargin: '600px 0px' },
      );
    }
    for (const { img, src } of list) {
      const gallery = img.closest('.cl-gallery');
      if (!gallery) {
        img.src = src;
        continue;
      }
      img.dataset.thumb = src;
      thumbObserver.observe(gallery);
    }
  }

  // ---------- Açılış animasyonu (hero) ----------
  // Yalnızca sayfa yüklemesinden sonra görünüm İLK kez açıldığında oynar. Tüm zamanlama CSS gecikmeleridir
  // (.cl-hero.is-intro); JS yalnızca unvanı harflere böler ve güvenlik zamanlayıcısını kurar.
  // Bitince (ya da gizlenince, yeniden çizilince, en geç INTRO_SAFETY ms sonra) sınıf kalkar, unvan düz metne döner.
  let intro = null;

  function finishIntro() {
    if (!intro) return;
    const { hero, title, text, timer } = intro;
    intro = null;
    clearTimeout(timer);
    hero.classList.remove('is-intro');
    if (title.isConnected) {
      title.textContent = text;
      title.style.removeProperty('--ty-step');
    }
  }

  function startIntro() {
    if (introPlayed) return;
    introPlayed = true;
    // Animasyon kapalıysa (hareket azaltma, dil değişimi) ya da sekme gizliyse hiçbir şey gizlenmez.
    if (!ctx || !ctx.animate || reducedMotion() || document.hidden) return;
    const hero = root.querySelector('.cl-hero');
    const title = hero && hero.querySelector('.cl-title');
    if (!hero || !title) return;
    const text = title.textContent || '';
    const chars = graphemes(text);
    if (chars.length) {
      // Tam metin tek parça kalır: sarmalayıcı bir "img" gibi okunur, harfler ona dahildir.
      const step = Math.max(12, Math.min(70, INTRO_TYPE / chars.length));
      const wrap = el('span', { class: 'cl-ty', role: 'img', 'aria-label': text });
      chars.forEach((ch, i) => {
        wrap.append(el('span', { class: i === chars.length - 1 ? 'cl-ch is-last' : 'cl-ch', 'aria-hidden': 'true', style: `--ty-i:${i}` }, ch));
      });
      title.replaceChildren(wrap);
      title.style.setProperty('--ty-step', `${step.toFixed(2)}ms`);
    }
    hero.classList.add('is-intro');
    intro = { hero, title, text, timer: setTimeout(finishIntro, INTRO_SAFETY) };
  }

  // Güvenlik ağı zamanlayıcısı: yalnızca görünüm açık, belge görünür ve açılmamış öğe varken çalışır.
  let sweepTimer = 0;
  function stopSweep() {
    clearInterval(sweepTimer);
    sweepTimer = 0;
    if (ctx) ctx.seen.clear();
  }
  function startSweep() {
    stopSweep();
    if (!ctx || !ctx.sweep || !active || document.hidden || ctx.pending.size === 0) return;
    const context = ctx;
    sweepTimer = setInterval(() => {
      if (context !== ctx || !active || document.hidden) {
        stopSweep();
        return;
      }
      context.sweep();
      if (context.pending.size === 0) stopSweep();
    }, RV_SWEEP);
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      // rAF duracak: sayan sayaçlar son değerine yazılır.
      for (const finish of [...ctx.running.values()]) finish();
      // Animasyonlar ilerlemeyebilir: açılış ve açılıp kapanan bölümler tamamlanmış duruma geçer.
      finishIntro();
      for (const finish of [...ctx.moves]) finish();
      stopSweep();
    } else {
      startSweep();
    }
  });
  // Klavye odağı görünmeyen öğede kalmasın: odaklanan öğenin kapsayıcısı hemen açılır.
  root.addEventListener('focusin', (event) => {
    if (!ctx || !ctx.revealIn || !(event.target instanceof Element)) return;
    const holder = event.target.closest('.cl-reveal');
    if (holder) ctx.revealIn(holder);
  });

  function teardown() {
    if (!ctx) return;
    ctx.alive = false;
    stopSweep();
    finishIntro();
    for (const finish of [...ctx.moves]) finish();
    for (const finish of [...ctx.running.values()]) finish();
    clearTimeout(ctx.copyTimer);
    if (ctx.disposeGuestbook) ctx.disposeGuestbook();
    if (ctx.io) ctx.io.disconnect();
    const bar = root.querySelector('.cl-bar');
    if (bar && sizeObserver) sizeObserver.unobserve(bar);
  }

  function render(animate) {
    teardown();
    lightbox.close();
    ctx = {
      alive: true,
      animate: Boolean(animate) && !reducedMotion() && 'IntersectionObserver' in window,
      reveals: [],
      pending: new Set(), // henüz açılmamış .cl-reveal düğümleri
      seen: new Set(), // güvenlik ağı: önceki turda ekranda görülenler
      counters: new Map(),
      running: new Map(), // sayan sayaçlar: düğüm -> bitirici
      moves: new Set(), // süren "Devamını göster" geçişleri: bitirici işlevler
      revealIn: null,
      sweep: null,
      clamps: [],
      thumbs: [],
      navLinks: new Map(),
      navList: null,
      copyTimer: null,
      io: null,
      lightbox,
      goTo,
      filter: filterState,
      applyFilter: null,
    };
    const context = ctx;
    root.replaceChildren(build(context));
    skipLink.textContent = pick(T.skip);
    currentNav = null;

    if (context.animate) {
      // Animasyon kurallarını kaldırır (is-done): öğe son hâlinde kalır, yarım sayaç tamamlanır.
      const settle = (node) => {
        node.classList.add('is-done');
        for (const [counterNode, finish] of [...context.running]) {
          if (node.contains(counterNode)) finish();
        }
      };
      // delay: kademe gecikmesi (ms). instant: animasyonsuz, doğrudan son hâl (güvenlik ağı, gezinme, odak).
      const reveal = (node, delay, instant) => {
        if (!context.pending.delete(node)) return;
        context.seen.delete(node);
        context.io.unobserve(node);
        if (delay) node.style.setProperty('--cl-d', `${delay}ms`);
        node.classList.add('is-in');
        for (const [counterNode, parsed] of [...context.counters]) {
          if (!node.contains(counterNode)) continue;
          context.counters.delete(counterNode);
          if (!instant) runCounter(counterNode, parsed, context, delay + parsed.extra);
        }
        if (instant) settle(node);
        else setTimeout(settle, RV_SETTLE + delay, node);
      };
      context.revealIn = (scope) => {
        for (const node of [...context.pending]) {
          if (scope.contains(node)) reveal(node, 0, true);
        }
      };
      // Güvenlik ağı: gözlemci tetiklenmediyse ekrandaki öğeler doğrudan gösterilir (ölçüt gözlemciyle aynı).
      context.sweep = () => {
        const limit = window.innerHeight * (1 - RV_BOTTOM);
        for (const node of [...context.pending]) {
          const rect = node.getBoundingClientRect();
          const shown = Math.min(rect.bottom, limit) - Math.max(rect.top, 0);
          const visible = (rect.width > 0 || rect.height > 0) && shown >= rect.height * RV_RATIO && (shown > 0 || rect.height === 0);
          if (!visible) context.seen.delete(node);
          else if (context.seen.has(node)) reveal(node, 0, true);
          else context.seen.add(node);
        }
      };
      // Sayfa gizliyken (hidden) tetiklenmez; görünüm açılınca ekrandaki parçalar belirir.
      // Aynı anda görünen kardeşler (aynı üst öğe) sırayla açılır.
      context.io = new IntersectionObserver(
        (entries) => {
          const groups = new Map();
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const node = entry.target;
            const at = groups.get(node.parentElement) || 0;
            groups.set(node.parentElement, at + 1);
            const inTimeline = node.classList.contains('cl-tl-item');
            reveal(node, Math.min(at, inTimeline ? TL_MAX : RV_MAX) * (inTimeline ? TL_STEP : RV_STEP), false);
          }
        },
        { threshold: RV_RATIO, rootMargin: `0px 0px -${RV_BOTTOM * 100}% 0px` },
      );
      for (const node of context.reveals) {
        context.pending.add(node);
        context.io.observe(node);
      }
    }

    if (active) {
      loadThumbs();
      if (context.mountGuestbook) context.mountGuestbook();
      watchSizes();
      updateNav();
      startSweep();
    }
  }

  // ---------- Projeye doğrudan bağlantı (?proje=<id>) ----------
  // Kart görünür yapılır (süzgeç gizliyorsa süzgeç sıfırlanır, belirme beklenmez), karta kaydırılır, kısa süre vurgulanır
  // ve odak kart başlığına verilir. Ölçüler otursun diye iki kare ve yazı tipleri (en çok TARGET_WAIT) beklenir.
  let targetTimer = 0;
  function showProject(id) {
    const frames = new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    Promise.all([frames, Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, TARGET_WAIT))])]).then(() => {
      const card = document.getElementById(`cl-p-${id}`);
      if (!active || !ctx || !card || !root.contains(card)) return;
      if (card.hidden && ctx.applyFilter) ctx.applyFilter('');
      if (ctx.revealIn) ctx.revealIn(card);
      measure();
      const still = reducedMotion();
      card.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      const title = card.querySelector('.cl-card-title');
      if (title) title.focus({ preventScroll: true });
      emit('project:open', { id });
      card.classList.add('is-target');
      clearTimeout(targetTimer);
      targetTimer = setTimeout(() => card.classList.remove('is-target'), still ? TARGET_STILL : TARGET_MS);
    });
  }

  // ---------- Yazdırma ----------
  // Baskıdan önce yarım kalan her şey son hâline getirilir: açılış daktilosu, sayan sayaçlar, açılıp kapanan özetler.
  // (Baskıda yalnızca .cl-cv bloğu görünür; ekran, yazdırma penceresi kapanınca yarım bir geçişte kalmasın.)
  function preparePrint() {
    finishIntro();
    if (!ctx) return;
    for (const finish of [...ctx.moves]) finish();
    for (const finish of [...ctx.running.values()]) finish();
  }

  let savedTitle = null;
  let titleTimer = 0;
  function restoreTitle() {
    clearTimeout(titleTimer);
    if (savedTitle === null) return;
    if (document.title === PRINT_TITLE) document.title = documentTitle(); // yazdırırken dil değişmiş olabilir
    savedTitle = null;
  }
  // Düğmeyle de Ctrl+P ile de: PDF dosya adı düzgün çıksın diye başlık geçici olarak değişir.
  window.addEventListener('beforeprint', () => {
    if (document.body.classList.contains('is-admin')) return; // yönetici paneli CV basmaz
    preparePrint();
    if (savedTitle === null) savedTitle = document.title;
    document.title = PRINT_TITLE;
    clearTimeout(titleTimer);
    titleTimer = setTimeout(restoreTitle, PRINT_TITLE_SAFETY);
  });
  window.addEventListener('afterprint', restoreTitle);

  // Gizliyken de içerik DOM'da dursun (arama motorları için).
  render(true);
  // Yazı tipi gelince satır sayıları değişir; ölçümler yenilenir.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (active) measure();
    });
  }
  // Dil değişince görünüm açıksa animasyonsuz yeniden çiz (içerik bir an bile kaybolmasın).
  on('lang:changed', () => render(!active));

  return {
    preparePrint,
    showProject,
    setActive(next) {
      active = Boolean(next);
      root.hidden = !active;
      skipLink.hidden = !active;
      document.body.classList.toggle('is-classic', active);
      if (active) {
        startIntro();
        loadThumbs();
        if (ctx && ctx.mountGuestbook) ctx.mountGuestbook();
        window.scrollTo(0, 0);
        // HUD kendi düğmelerini bu çağrıdan sonra günceller; ölçüm bir kare sonra.
        requestAnimationFrame(() => {
          watchSizes();
          updateNav();
        });
        startSweep();
      } else {
        lightbox.close();
        finishIntro();
        stopSweep();
      }
    },
  };
}
