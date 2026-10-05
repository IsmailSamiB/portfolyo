import './minigame.css';
import { emit, on } from '../bridge.js';
import { pick } from '../i18n.js';
import content from '../content/content.js';
import { el, extLink, reducedMotion, blurIfPointer } from './dom.js';
import { setLock } from './lock.js';
import { sfx } from '../audio.js';
import { trackGame } from '../data/metrics.js';
import * as store from '../data/store.js';

// ---------- Sabitler ----------
const GUARD_MS = 200; // paneli açan tıklama/tuş oyunu başlatmasın
const DURATION = 30; // saniye
const SLOTS = 8; // ekrandaki satır sayısı
const ROW_H = 40; // px (dokunma alanı >= 40)
const BEST_KEY = 'minigame:best';
const SCORES_KEY = 'minigame:scores'; // yerel yedek tablo
const NAME_KEY = 'minigame:name'; // son kullanılan rumuz
const COLS = 4;
const TOP_N = 10;
const NICK_LEN = 3;
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const T = {
  title: { tr: 'VERİ TEMİZLE', en: 'DATA CLEANER' },
  close: { tr: 'Kapat', en: 'Close' },
  insert: { tr: 'JETON AT', en: 'INSERT COIN' },
  intro: {
    tr: '30 saniyede hatalı hücrelere tıkla: boş değer, yazım hatası, saçma sayı, yanlış hat kodu. Yinelenen satırda herhangi bir hücre yeter. Temiz hücreye tıklarsan puan kaybedersin!',
    en: 'Click the bad cells in 30 seconds: empty values, typos, absurd numbers, wrong line codes. For a duplicate row, any cell works. Click a clean cell and you lose points!',
  },
  keys: { tr: 'Klavye: ok tuşları + Enter/Boşluk · Esc: kapat', en: 'Keyboard: arrows + Enter/Space · Esc: close' },
  start: { tr: 'BAŞLA', en: 'START' },
  best: { tr: 'En iyi skor', en: 'Best score' },
  score: { tr: 'Skor', en: 'Score' },
  accuracy: { tr: 'Doğruluk', en: 'Accuracy' },
  newBest: { tr: 'Yeni rekor!', en: 'New record!' },
  again: { tr: 'Tekrar oyna', en: 'Play again' },
  source: { tr: 'Gerçek veride de böyle yaptım → Raylı sistemler projesi', en: 'I did this on real data too → Rail systems project' },
  contact: { tr: 'Benimle iletişime geç', en: 'Get in touch' },
  hint: { tr: 'Hatalı hücreyi bul ve tıkla.', en: 'Find the bad cell and click it.' },
  board: { tr: 'Yolcu verisi tablosu', en: 'Passenger data table' },
  cols: {
    tr: ['hat', 'istasyon', 'yaş', 'yolcu'],
    en: ['line', 'station', 'age', 'riders'],
  },
  low: { tr: 'Veri hâlâ kirli ama iyi başlangıç.', en: 'The data is still dirty, but a good start.' },
  mid: { tr: 'Temiz iş.', en: 'Clean work.' },
  high: { tr: 'Veri tertemiz!', en: 'Squeaky-clean data!' },
  top: { tr: 'EN İYİ 10', en: 'TOP 10' },
  loading: { tr: '…', en: '…' },
  localNote: { tr: 'Çevrimdışı: yerel tablo', en: 'Offline: local table' },
  enterName: { tr: 'Rumuzunu gir (3 karakter)', en: 'Enter your tag (3 chars)' },
  save: { tr: 'KAYDET', en: 'SAVE' },
  saving: { tr: 'Kaydediliyor…', en: 'Saving…' },
  saved: { tr: 'Skor kaydedildi!', en: 'Score saved!' },
  savedLocal: { tr: 'Çevrimdışısın: skor yalnızca bu cihazda tutuldu.', en: 'You are offline: score kept on this device only.' },
  letterUp: { tr: 'Sonraki karakter', en: 'Next character' },
  letterDown: { tr: 'Önceki karakter', en: 'Previous character' },
  letter: { tr: 'Karakter', en: 'Character' },
};

// ---------- Veri sözlüğü ----------
const LINES = ['M1', 'M2', 'M4', 'M5', 'M7', 'T1', 'T4', 'F1', 'TF1', 'Marmaray'];
const STATIONS = ['Yenikapı', 'Taksim', 'Kadıköy', 'Üsküdar', 'Mecidiyeköy', 'Levent', 'Kozyatağı', 'Eminönü', 'Maçka', 'Sirkeci', 'Kabataş', 'Ayrılık Ç.', 'Bakırköy', 'Hacıosman'];
const AGES = ['<20', '20-30', '30-60', '60+'];

const BAD_LINES = ['M22', 'M0', 'T9', 'TCDD', '', 'NaN', 'X1'];
const BAD_STATIONS = ['', 'NaN', 'NaN', ''];
const BAD_AGES = ['Unkown', 'Uknown', '', 'NaN', 'Unkown'];

function randInt(rng, a, b) {
  return a + Math.floor(rng() * (b - a + 1));
}
function choice(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Doğru değerler: [hat, istasyon, yaş, yolcu]
export function makeTruth(rng = Math.random) {
  return [choice(rng, LINES), choice(rng, STATIONS), choice(rng, AGES), String(randInt(rng, 50, 9000))];
}

// Bir sütun için hatalı değer (doğrudan farklı olduğu garanti)
export function makeBadValue(col, truth, rng = Math.random) {
  let v;
  do {
    if (col === 0) v = choice(rng, BAD_LINES);
    else if (col === 1) v = choice(rng, BAD_STATIONS);
    else if (col === 2) v = choice(rng, BAD_AGES);
    else {
      const k = rng();
      if (k < 0.3) v = String(-randInt(rng, 10, 500));
      else if (k < 0.55) v = choice(rng, ['9999999', '8888888', '1000000000']);
      else if (k < 0.8) v = 'NaN';
      else v = '';
    }
  } while (v === truth);
  return v;
}

// Yeni satır: badChance olasılıkla 1 (ya da %15 ile 2) hatalı hücre
export function makeRow(rng, id, badChance) {
  const truth = makeTruth(rng);
  const cells = truth.map((t) => ({ value: t, bad: false, fixed: false }));
  if (rng() < badChance) {
    const count = rng() < 0.15 ? 2 : 1;
    const picked = new Set();
    while (picked.size < count) picked.add(randInt(rng, 0, COLS - 1));
    for (const c of picked) {
      cells[c].value = makeBadValue(c, truth[c], rng);
      cells[c].bad = true;
    }
  }
  return { id, truth, cells, dup: false, dupFixed: false };
}

// Temiz bir satırın birebir kopyası: tüm satır hatalı sayılır
export function makeDuplicate(row, id) {
  return {
    id,
    truth: row.truth.slice(),
    cells: row.truth.map((t) => ({ value: t, bad: false, fixed: false })),
    dup: true,
    dupFixed: false,
  };
}

export function rowHasBad(row) {
  return row.cells.some((c) => c.bad);
}

// Temizlenmemiş hata kaldı mı?
export function rowIsBad(row) {
  if (row.dup) return !row.dupFixed;
  return row.cells.some((c) => c.bad && !c.fixed);
}

// ---------- Puanlama (saf) ----------
export function newScore() {
  return { score: 0, streak: 0, hits: 0, wrong: 0, missed: 0 };
}

export function multiplier(streak) {
  return streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
}

// Tıklamayı uygular; sonucu ve değişen satır/hücre durumunu döndürür.
export function applyClick(st, row, col) {
  if (row.dup) {
    if (row.dupFixed) return 'noop';
    row.dupFixed = true;
    return hit(st);
  }
  const cell = row.cells[col];
  if (!cell || cell.fixed) return 'noop';
  if (cell.bad) {
    cell.fixed = true;
    cell.value = row.truth[col];
    return hit(st);
  }
  st.streak = 0;
  st.wrong += 1;
  st.score = Math.max(0, st.score - 5);
  return 'wrong';
}

function hit(st) {
  st.streak += 1;
  st.hits += 1;
  st.score += 10 * multiplier(st.streak);
  return 'good';
}

// Hatalı satır temizlenmeden çıktı
export function applyMiss(st) {
  st.missed += 1;
  st.score = Math.max(0, st.score - 3);
}

export function accuracy(st) {
  const total = st.hits + st.wrong + st.missed;
  return total ? Math.round((st.hits / total) * 100) : 0;
}

export function verdict(score) {
  return score >= 100 ? T.high : score >= 40 ? T.mid : T.low;
}

export function spawnInterval(elapsed) {
  return Math.max(0.5, 0.9 - 0.4 * (elapsed / DURATION));
}

// ---------- Rumuz / skor tablosu (saf) ----------
export function cleanNick(value) {
  const s = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, NICK_LEN);
  return s.padEnd(NICK_LEN, 'A');
}

// Skor ilk 10'a giriyor mu? (rows azalan sıralı)
export function qualifies(rows, score) {
  if (!(score > 0)) return false;
  return rows.length < TOP_N || score > rows[rows.length - 1].score;
}

export function normalizeRows(list) {
  return (Array.isArray(list) ? list : [])
    .map((r, i) => ({
      id: r && r.id != null ? r.id : `r${i}`,
      name: String((r && r.name) ?? '').slice(0, 8),
      score: Number(r && r.score) || 0,
      at: Number(r && r.at) || 0,
    }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, TOP_N);
}

function readLocalScores() {
  try {
    return normalizeRows(JSON.parse(localStorage.getItem(SCORES_KEY) || '[]'));
  } catch {
    return [];
  }
}

function addLocalScore(name, score) {
  const rows = readLocalScores();
  rows.push({ id: `l${Date.now()}`, name, score, at: Date.now() });
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(normalizeRows(rows)));
  } catch {
    // saklanamasa da oyun çalışır
  }
}

function readNick() {
  try {
    return cleanNick(localStorage.getItem(NAME_KEY));
  } catch {
    return cleanNick('');
  }
}

function writeNick(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // önemsiz
  }
}

// ---------- Arayüz ----------
let started = false;

export function initMinigame() {
  if (started) return;
  const root = document.getElementById('ui');
  if (!root) return;
  started = true;

  const titleEl = el('span', { class: 'mg-title', id: 'mg-title' });
  const closeBtn = el('button', { type: 'button', class: 'bar-btn mg-close', onclick: () => close() }, '✕');
  const body = el('div', { class: 'mg-body', tabindex: '-1' });
  const win = el(
    'div',
    { class: 'mg-win', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mg-title' },
    el('header', { class: 'mg-marquee' }, titleEl),
    closeBtn,
    el('div', { class: 'mg-crt' }, body),
    // Dekoratif joystick + düğmeler
    el(
      'div',
      { class: 'mg-panel', 'aria-hidden': 'true' },
      el('span', { class: 'mg-stick' }, el('i', { class: 'mg-ball' })),
      el('span', { class: 'mg-knob mg-knob--a' }),
      el('span', { class: 'mg-knob mg-knob--b' }),
    ),
  );
  const layer = el('div', { class: 'mg-layer', hidden: true }, win);
  root.append(layer);

  let isOpen = false;
  let openedAt = 0;
  let lastFocus = null;
  let screen = 'start'; // start | play | end
  let raf = 0;
  let lastResult = null;

  // Oyun durumu (yalnızca screen === 'play' iken anlamlı)
  let g = null;
  let ui = null; // oyun ekranı düğümleri

  // Skor tablosu durumu
  let lb = { status: 'loading', rows: [], local: false, hl: null };
  let lbToken = 0;
  let lbBox = null;
  // Bitişteki rumuz girişi: none | wait | input | saving | saved
  let entry = { phase: 'none', chars: [], idx: 0, note: '' };
  let entryBox = null;
  let slotEls = [];

  function readBest() {
    try {
      const n = Number(localStorage.getItem(BEST_KEY));
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }
  function writeBest(n) {
    try {
      localStorage.setItem(BEST_KEY, String(n));
    } catch {
      // saklanamasa da oyun çalışır
    }
  }

  function btn(label, onclick, accent) {
    return el('button', {
      type: 'button',
      class: `px-btn mg-btn${accent ? ' px-btn--accent' : ''}`,
      text: pick(label),
      onclick: (e) => {
        blurIfPointer(e);
        if (performance.now() - openedAt < GUARD_MS) return;
        onclick();
      },
    });
  }

  // ---------- Skor tablosu ----------
  function paintBoard() {
    if (!lbBox || !lbBox.isConnected) return;
    const list = el('ol', { class: 'mg-lb-list' });
    for (let i = 0; i < TOP_N; i += 1) {
      const r = lb.status === 'ready' ? lb.rows[i] : null;
      list.append(
        el(
          'li',
          { class: `mg-lb-row${r && lb.hl != null && r.id === lb.hl ? ' is-hl' : ''}` },
          el('span', { class: 'mg-lb-rank', text: String(i + 1) }),
          el('span', { class: 'mg-lb-name', text: r ? r.name : '---' }),
          el('span', { class: 'mg-lb-score', text: r ? String(r.score) : lb.status === 'loading' && i === 0 ? pick(T.loading) : '-' }),
        ),
      );
    }
    // replaceChildren false/null değerleri yazıya çevirir; önce ayıkla
    lbBox.replaceChildren(
      ...[
        el('h3', { class: 'mg-lb-title', text: pick(T.top) }),
        list,
        lb.status === 'ready' && lb.local && el('p', { class: 'mg-lb-note', text: pick(T.localNote) }),
      ].filter(Boolean),
    );
  }

  function boardBox() {
    lbBox = el('section', { class: 'mg-lb', 'aria-label': pick(T.top) });
    paintBoard();
    return lbBox;
  }

  // Tabloyu yükler; hl verilirse eşleşen satır vurgulanır. forceLocal: sunucuyu atla.
  async function loadBoard(hl, forceLocal) {
    const token = ++lbToken;
    lb = { status: 'loading', rows: [], local: false, hl: null };
    paintBoard();
    let rows;
    let local = false;
    try {
      if (forceLocal || !store.scores || typeof store.scores.top !== 'function') throw new Error('local');
      rows = normalizeRows(await store.scores.top(TOP_N));
    } catch {
      rows = readLocalScores();
      local = true;
    }
    if (token !== lbToken || !isOpen) return;
    let hlId = null;
    if (hl) {
      const m = rows.find((r) => r.name === hl.name && r.score === hl.score);
      if (m) hlId = m.id;
    }
    lb = { status: 'ready', rows, local, hl: hlId };
    paintBoard();
    if (screen === 'end' && entry.phase === 'wait') {
      entry.phase = qualifies(rows, lastResult ? lastResult.score : 0) ? 'input' : 'none';
      paintEntry();
    }
  }

  // ---------- Rumuz girişi ----------
  function updateSlots() {
    slotEls.forEach((s, i) => {
      s.textContent = entry.chars[i];
      s.classList.toggle('is-active', i === entry.idx);
      s.setAttribute('aria-label', `${pick(T.letter)} ${i + 1}: ${entry.chars[i]}`);
    });
  }

  function stepChar(i, dir) {
    const at = CHARS.indexOf(entry.chars[i]);
    entry.chars[i] = CHARS[(at + dir + CHARS.length) % CHARS.length];
    entry.idx = i;
    sfx('blip');
    updateSlots();
  }

  function paintEntry() {
    if (!entryBox || !entryBox.isConnected) return;
    slotEls = [];
    if (entry.phase === 'input') {
      const cols = [];
      for (let i = 0; i < NICK_LEN; i += 1) {
        const slot = el('span', {
          class: 'mg-slot',
          role: 'img',
          onpointerdown: () => {
            entry.idx = i;
            updateSlots();
          },
        });
        slotEls.push(slot);
        const step = (dir, label, glyph) =>
          el(
            'button',
            {
              type: 'button',
              class: 'mg-step',
              'aria-label': pick(label),
              onclick: (e) => {
                blurIfPointer(e);
                stepChar(i, dir);
              },
            },
            glyph,
          );
        cols.push(el('div', { class: 'mg-nick-col' }, step(1, T.letterUp, '▲'), slot, step(-1, T.letterDown, '▼')));
      }
      entryBox.replaceChildren(
        el('p', { class: 'mg-entry-label', text: pick(T.enterName) }),
        el('div', { class: 'mg-nick' }, cols),
        el('button', {
          type: 'button',
          class: 'px-btn px-btn--accent mg-btn',
          text: pick(T.save),
          onclick: (e) => {
            blurIfPointer(e);
            saveScore();
          },
        }),
      );
      updateSlots();
    } else if (entry.phase === 'saving') {
      entryBox.replaceChildren(el('p', { class: 'mg-entry-label', text: pick(T.saving) }));
    } else if (entry.phase === 'saved') {
      entryBox.replaceChildren(
        ...[
          el('p', { class: 'mg-entry-label is-ok', text: pick(T.saved) }),
          entry.note && el('p', { class: 'mg-lb-note', text: entry.note }),
        ].filter(Boolean),
      );
    } else {
      entryBox.replaceChildren();
    }
  }

  async function saveScore() {
    if (entry.phase !== 'input' || !lastResult) return;
    const name = cleanNick(entry.chars.join(''));
    const mine = lastResult;
    const score = mine.score;
    writeNick(name);
    entry.phase = 'saving';
    paintEntry();
    let res = { ok: false, reason: 'offline' };
    try {
      if (store.scores && typeof store.scores.submit === 'function') res = await store.scores.submit({ name, score });
    } catch {
      res = { ok: false, reason: 'offline' };
    }
    if (!isOpen || screen !== 'end' || lastResult !== mine) return;
    addLocalScore(name, score); // yerel yedek her durumda güncel
    const ok = Boolean(res && res.ok);
    entry.note = ok ? '' : pick(T.savedLocal);
    entry.phase = 'saved';
    paintEntry();
    loadBoard({ name, score }, !ok);
  }

  // ---------- Ekranlar ----------
  function renderStart() {
    screen = 'start';
    body.replaceChildren(
      el(
        'div',
        { class: 'mg-split' },
        el(
          'div',
          { class: 'mg-screen mg-main' },
          el('p', { class: 'mg-insert', text: pick(T.insert) }),
          el(
            'div',
            { class: 'mg-actions' },
            btn(
              T.start,
              () => {
                sfx('coin');
                startGame();
              },
              true,
            ),
          ),
          el('p', { class: 'mg-intro', text: pick(T.intro) }),
          el('p', { class: 'mg-best', text: `${pick(T.best)}: ${readBest()}` }),
          el('p', { class: 'mg-keys', text: pick(T.keys) }),
        ),
        boardBox(),
      ),
    );
    focusFirst();
    loadBoard(null, false);
  }

  // fresh: oyun yeni bitti (tabloyu yeniden çek); dil değişiminde false
  function renderEnd(fresh) {
    screen = 'end';
    const r = lastResult;
    const proj = (content.projects || []).find((p) => p && p.id === 'rayli-sistemler');
    const url = proj && proj.links && proj.links.source;
    entryBox = el('div', { class: 'mg-entry' });
    body.replaceChildren(
      el(
        'div',
        { class: 'mg-split' },
        el(
          'div',
          { class: 'mg-screen mg-main mg-end', role: 'status' },
          el('p', { class: 'mg-big', text: String(r.score) }),
          el('p', { class: 'mg-label', text: pick(T.score) }),
          el(
            'div',
            { class: 'mg-stats' },
            el('span', { text: `${pick(T.accuracy)}: %${r.accuracy}` }),
            el('span', { text: `${pick(T.best)}: ${r.best}` }),
          ),
          r.isNew && el('p', { class: 'mg-new', text: pick(T.newBest) }),
          el('p', { class: 'mg-verdict', text: pick(verdict(r.score)) }),
          entryBox,
          el(
            'div',
            { class: 'mg-actions' },
            btn(
              T.again,
              () => {
                sfx('coin');
                startGame();
              },
              true,
            ),
            btn(T.contact, () => {
              close();
              emit('panel:open', { id: 'contact' });
            }),
          ),
          url && extLink(url, pick(T.source), 'mg-source'),
        ),
        boardBox(),
      ),
    );
    paintEntry();
    focusFirst();
    if (fresh) loadBoard(null, false);
  }

  function focusFirst() {
    const first = body.querySelector('.mg-actions button');
    if (first instanceof HTMLElement) first.focus({ preventScroll: true });
  }

  // ---------- Oyun ----------
  function startGame() {
    stopLoop();
    lbToken += 1; // bekleyen tablo yüklemesi oyun ekranını bozmasın
    screen = 'play';
    g = {
      st: newScore(),
      rng: Math.random,
      timeLeft: DURATION,
      clock: 0,
      spawnAcc: 0,
      nextId: 1,
      rows: [], // en yeni başta
      byId: new Map(),
      leaving: [],
      lastRow: null,
      pendingDup: false,
      cursor: { id: null, col: 0, shown: false },
      flashUntil: 0,
      lastScore: -1,
      lastMult: 0,
      lastBar: -1,
      lastSec: -1,
      paused: false,
      done: false,
      last: 0,
    };

    const scoreEl = el('span', { class: 'mg-score', 'aria-hidden': 'true' });
    const multEl = el('span', { class: 'mg-mult', 'aria-hidden': 'true' });
    const secEl = el('span', { class: 'mg-sec', 'aria-hidden': 'true' });
    const fill = el('div', { class: 'mg-fill' });
    const flash = el('div', { class: 'mg-flash', 'aria-hidden': 'true' });
    const grid = el('div', { class: 'mg-grid' });
    grid.style.height = `${SLOTS * ROW_H}px`;
    const head = el(
      'div',
      { class: 'mg-row mg-head', 'aria-hidden': 'true' },
      pick(T.cols).map((c) => el('div', { class: 'mg-cell', text: c })),
    );
    const board = el('div', { class: 'mg-board', role: 'table', 'aria-label': pick(T.board), tabindex: '-1' }, head, grid, flash);
    ui = { scoreEl, multEl, secEl, fill, flash, grid, board };

    body.replaceChildren(
      el(
        'div',
        { class: 'mg-play' },
        el('div', { class: 'mg-hud' }, el('span', { class: 'mg-hud-l' }, scoreEl, multEl), secEl),
        el('div', { class: 'mg-track' }, fill),
        board,
        el('p', { class: 'mg-hint', text: pick(T.hint) }),
      ),
    );

    board.addEventListener('pointerdown', onPointer);
    board.addEventListener('contextmenu', (e) => e.preventDefault());

    for (let i = 0; i < 5; i += 1) spawn(true);
    layout();
    hud(true);
    board.focus({ preventScroll: true });
    g.last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function badChance() {
    return 0.35 + 0.2 * Math.min(1, (DURATION - g.timeLeft) / DURATION);
  }

  function buildNode(row) {
    const node = el('div', { class: 'mg-row mg-data', 'data-id': row.id });
    for (let c = 0; c < COLS; c += 1) node.append(el('div', { class: 'mg-cell', 'data-c': c }));
    row.node = node;
    paintRow(row);
    return node;
  }

  function paintRow(row) {
    row.node.classList.toggle('is-dupfix', row.dup && row.dupFixed);
    row.cells.forEach((cell, c) => {
      const n = row.node.children[c];
      n.textContent = cell.value;
      n.classList.toggle('is-fixed', cell.fixed || (row.dup && row.dupFixed));
    });
  }

  function spawn(silent) {
    let row;
    const id = g.nextId++;
    if (g.pendingDup && g.lastRow) {
      row = makeDuplicate(g.lastRow, id);
    } else {
      row = makeRow(g.rng, id, badChance());
      g.pendingDup = !rowHasBad(row) && g.rng() < 0.15;
    }
    if (row.dup) g.pendingDup = false;
    g.lastRow = row;
    g.rows.unshift(row);
    g.byId.set(id, row);
    const node = buildNode(row);
    row.node.style.transform = `translateY(${(SLOTS - 1) * ROW_H}px)`;
    if (!silent) node.classList.add('is-new');
    ui.grid.append(node);
    layout();
    while (g.rows.length > SLOTS) leave(g.rows.pop());
  }

  function layout() {
    g.rows.forEach((row, i) => {
      row.node.style.transform = `translateY(${(SLOTS - 1 - i) * ROW_H}px)`;
    });
  }

  function leave(row) {
    if (rowIsBad(row)) {
      applyMiss(g.st);
      g.flashUntil = g.clock + 0.35;
      ui.flash.classList.add('is-on');
    }
    g.byId.delete(row.id);
    if (g.cursor.id === row.id) g.cursor.id = null;
    if (reducedMotion()) {
      row.node.remove();
      return;
    }
    row.node.classList.add('is-leaving');
    row.node.style.transform = `translateY(${-ROW_H}px)`;
    g.leaving.push({ node: row.node, at: g.clock + 0.3 });
  }

  function hud(force) {
    const { st } = g;
    if (force || st.score !== g.lastScore) {
      if (!force && st.score > g.lastScore) {
        ui.scoreEl.classList.remove('is-pop');
        void ui.scoreEl.offsetWidth; // animasyonu yeniden başlat
        ui.scoreEl.classList.add('is-pop');
      }
      g.lastScore = st.score;
      ui.scoreEl.textContent = `${pick(T.score)} ${st.score}`;
    }
    const m = multiplier(st.streak);
    if (force || m !== g.lastMult) {
      g.lastMult = m;
      ui.multEl.textContent = m > 1 ? `×${m}` : '';
    }
    const sec = Math.max(0, Math.ceil(g.timeLeft));
    if (force || sec !== g.lastSec) {
      g.lastSec = sec;
      ui.secEl.textContent = `${sec}s`;
      ui.fill.classList.toggle('is-low', sec <= 5);
    }
    const bar = Math.round((g.timeLeft / DURATION) * 1000) / 10;
    if (force || bar !== g.lastBar) {
      g.lastBar = bar;
      ui.fill.style.width = `${bar}%`;
    }
  }

  function frame(now) {
    if (!isOpen || screen !== 'play' || !g || g.done) return;
    raf = requestAnimationFrame(frame);
    if (g.paused) {
      g.last = now;
      return;
    }
    const dt = Math.min(Math.max(now - g.last, 0), 250) / 1000;
    g.last = now;
    g.clock += dt;
    g.timeLeft = Math.max(0, g.timeLeft - dt);

    g.spawnAcc += dt;
    const interval = spawnInterval(DURATION - g.timeLeft);
    let guard = 0;
    while (g.spawnAcc >= interval && guard < 3) {
      g.spawnAcc -= interval;
      spawn(false);
      guard += 1;
    }
    if (guard === 3) g.spawnAcc = 0;

    if (g.flashUntil && g.clock >= g.flashUntil) {
      g.flashUntil = 0;
      ui.flash.classList.remove('is-on');
    }
    if (g.leaving.length) {
      g.leaving = g.leaving.filter((l) => {
        if (g.clock < l.at) return true;
        l.node.remove();
        return false;
      });
    }
    hud(false);
    if (g.timeLeft <= 0) finish();
  }

  function finish() {
    g.done = true;
    stopLoop();
    const { st } = g;
    const best = readBest();
    const isNew = st.score > best;
    if (isNew) writeBest(st.score);
    lastResult = { score: st.score, accuracy: accuracy(st), best: Math.max(best, st.score), isNew };
    sfx('secret');
    emit('secret:found', { id: 'game' });
    try {
      trackGame(st.score);
    } catch {
      // metrik yazılamasa da oyun sonu ekranı gösterilir
    }
    g = null;
    ui = null;
    // Rumuz girişi: tablo yüklenince ilk 10'a girip girmediğine karar verilir
    entry = { phase: st.score > 0 ? 'wait' : 'none', chars: readNick().split(''), idx: 0, note: '' };
    renderEnd(true);
  }

  // ---------- Tıklama / klavye ----------
  function clickCell(row, col, cellEl) {
    if (!g || g.done || !row) return;
    const res = applyClick(g.st, row, col);
    if (res === 'noop') return;
    if (res === 'good') {
      paintRow(row);
      sfx('blip');
    } else {
      sfx('close');
      if (cellEl) {
        cellEl.classList.remove('is-shake');
        void cellEl.offsetWidth;
        cellEl.classList.add('is-shake');
      }
    }
    hud(false);
  }

  function onPointer(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!g || g.done || g.paused) return;
    const cellEl = event.target instanceof Element ? event.target.closest('.mg-data .mg-cell') : null;
    if (!cellEl) return;
    event.preventDefault();
    const rowEl = cellEl.parentElement;
    const row = g.byId.get(Number(rowEl.getAttribute('data-id')));
    if (!row) return;
    g.cursor.shown = false;
    clickCell(row, Number(cellEl.getAttribute('data-c')), cellEl);
    refreshCursor();
  }

  function cursorRow() {
    if (g.cursor.id != null && g.byId.has(g.cursor.id)) return g.byId.get(g.cursor.id);
    const row = g.rows[0] || null; // kayıp: en yeni (alttaki) satır
    g.cursor.id = row ? row.id : null;
    return row;
  }

  function refreshCursor() {
    if (!ui) return;
    ui.grid.querySelectorAll('.is-cursor').forEach((n) => n.classList.remove('is-cursor'));
    if (!g || !g.cursor.shown) return;
    const row = cursorRow();
    if (row) row.node.children[g.cursor.col].classList.add('is-cursor');
  }

  // Bitiş ekranında rumuz yazımı; true dönerse tuş işlendi
  function nickKey(event) {
    if (entry.phase !== 'input' || event.ctrlKey || event.metaKey || event.altKey) return false;
    const k = event.key;
    if (k.length === 1 && /[a-z0-9]/i.test(k)) {
      event.preventDefault();
      entry.chars[entry.idx] = k.toUpperCase();
      entry.idx = Math.min(NICK_LEN - 1, entry.idx + 1);
      updateSlots();
      return true;
    }
    if (k === 'Backspace') {
      event.preventDefault();
      entry.idx = Math.max(0, entry.idx - 1);
      updateSlots();
      return true;
    }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      event.preventDefault();
      entry.idx = Math.max(0, Math.min(NICK_LEN - 1, entry.idx + (k === 'ArrowLeft' ? -1 : 1)));
      updateSlots();
      return true;
    }
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      event.preventDefault();
      stepChar(entry.idx, k === 'ArrowUp' ? 1 : -1);
      return true;
    }
    if (k === 'Enter') {
      // Odaktaki düğme varsa kendi tıklamasını yapsın
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.tagName === 'BUTTON' && body.contains(a)) return false;
      event.preventDefault();
      if (!event.repeat) saveScore();
      return true;
    }
    return false;
  }

  function onKeyDown(event) {
    if (!isOpen) return;
    // Oyun tuşları oyuna / alttaki panele gitmesin
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (screen === 'end') {
      nickKey(event);
      return;
    }
    if (screen !== 'play' || !g || g.done) return;
    const k = event.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      event.preventDefault();
      const cur = g.cursor;
      const row = cursorRow();
      if (!row) return;
      if (!cur.shown) {
        cur.shown = true;
      } else if (k === 'ArrowLeft') cur.col = Math.max(0, cur.col - 1);
      else if (k === 'ArrowRight') cur.col = Math.min(COLS - 1, cur.col + 1);
      else {
        // rows: en yeni başta, ekranda altta. Yukarı = daha eski.
        const i = g.rows.indexOf(row);
        const j = k === 'ArrowUp' ? Math.min(g.rows.length - 1, i + 1) : Math.max(0, i - 1);
        cur.id = g.rows[j].id;
      }
      refreshCursor();
    } else if (k === 'Enter' || k === ' ') {
      event.preventDefault();
      if (event.repeat || performance.now() - openedAt < GUARD_MS || g.paused) return;
      if (!g.cursor.shown) {
        g.cursor.shown = true;
        refreshCursor();
        return;
      }
      const row = cursorRow();
      if (!row) return;
      clickCell(row, g.cursor.col, row.node.children[g.cursor.col]);
      refreshCursor();
    }
  }

  function onKeyUp(event) {
    if (isOpen) event.stopPropagation();
  }

  function onVisibility() {
    if (!g || screen !== 'play') return;
    g.paused = document.hidden;
    if (!g.paused) g.last = performance.now();
  }

  // ---------- Aç / kapat ----------
  function render() {
    titleEl.textContent = pick(T.title);
    closeBtn.setAttribute('aria-label', pick(T.close));
    closeBtn.title = pick(T.close);
    win.setAttribute('aria-label', pick(T.title));
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    openedAt = performance.now();
    lastFocus = document.activeElement;
    render();
    layer.hidden = false;
    setLock('overlay', true);
    renderStart();
    // Yakalama aşamasında dinle: alttaki panelin Esc işleyicisine gitmesin
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('visibilitychange', onVisibility);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    stopLoop();
    lbToken += 1;
    g = null;
    ui = null;
    lbBox = null;
    entryBox = null;
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    document.removeEventListener('visibilitychange', onVisibility);
    layer.hidden = true;
    body.replaceChildren();
    if (lastFocus instanceof HTMLElement && lastFocus !== document.body && lastFocus.isConnected) {
      lastFocus.focus({ preventScroll: true });
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    lastFocus = null;
    setLock('overlay', false);
    emit('overlay:closed', { id: 'minigame' });
  }

  on('overlay:open', (detail) => {
    if (detail && detail.id === 'minigame') open();
  });
  on('tour:state', (detail) => {
    if (detail && detail.active) close();
  });
  on('lang:changed', () => {
    render();
    if (!isOpen || screen === 'play') return;
    if (screen === 'end' && lastResult) renderEnd(false);
    else renderStart();
  });

  render();
  return open;
}
