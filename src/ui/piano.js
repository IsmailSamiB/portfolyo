import './piano.css';
import { emit, on } from '../bridge.js';
import { pick } from '../i18n.js';
import { el, blurIfPointer } from './dom.js';
import { setLock, isLocked } from './lock.js';
import { unlock, isMuted, setMuted, note } from '../audio.js';

const GUARD_MS = 200; // paneli açan E basışı nota çalmasın
const STEP_MS = 280; // otomatik melodide bir vuruş
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const FIRST = 60; // C4
const LAST = 79; // G5

const T = {
  title: { tr: 'Piyano', en: 'Piano' },
  close: { tr: 'Kapat', en: 'Close' },
  play: { tr: '♪ Benim yerime çal', en: '♪ Play for me' },
  stop: { tr: '■ Durdur', en: '■ Stop' },
  hint: { tr: 'Tuşlara dokun ya da klavyeyi kullan · Esc: kapat', en: 'Tap the keys or use your keyboard · Esc: close' },
  muted: { tr: 'Ses kapalı.', en: 'Sound is off.' },
  unmute: { tr: 'Sesi aç', en: 'Turn sound on' },
  keyboard: { tr: 'Piyano klavyesi', en: 'Piano keyboard' },
};

// Fiziksel tuş konumu (event.code) -> midi. Türkçe Q klavyede de aynı yerdedir.
const WHITE_CODES = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyZ', 'KeyX', 'KeyC'];
const BLACK_CODES = ['KeyW', 'KeyE', 'KeyT', 'KeyY', 'KeyU', 'KeyO', 'KeyP', 'KeyV'];

// Özgün, kısa melodi (Do majör, ~9 sn): [midi | midi[], vuruş]
const MELODY = [
  [64, 1], [67, 1], [72, 1], [67, 1],
  [69, 1], [72, 1], [76, 2],
  [74, 1], [72, 1], [69, 1], [67, 1],
  [64, 2], [67, 2],
  [65, 1], [69, 1], [74, 1], [72, 1],
  [71, 1], [67, 1], [74, 2],
  [72, 1], [76, 1], [79, 1], [76, 1],
  [[60, 64, 72], 4],
];

let started = false;

export function initPiano() {
  if (started) return;
  const root = document.getElementById('ui');
  if (!root) return;
  started = true;

  // ---------- Tuş tablosu ----------
  const keys = []; // { midi, black, code, node }
  const byMidi = new Map();
  const byCode = new Map();
  let wi = 0;
  let bi = 0;
  for (let midi = FIRST; midi <= LAST; midi += 1) {
    const black = BLACK.has(midi % 12);
    const code = black ? BLACK_CODES[bi] : WHITE_CODES[wi];
    const key = { midi, black, code, whitesBefore: wi, node: null };
    if (black) bi += 1;
    else wi += 1;
    keys.push(key);
    byMidi.set(midi, key);
    if (code) byCode.set(code, key);
  }
  const whiteCount = wi;

  // ---------- DOM ----------
  const titleEl = el('h2', { class: 'panel-title', id: 'piano-title' });
  const closeBtn = el('button', { type: 'button', class: 'bar-btn', onclick: () => close() }, '✕');
  const playBtn = el('button', {
    type: 'button',
    class: 'px-btn piano-play',
    onclick: (event) => {
      blurIfPointer(event);
      if (autoTimers.length) stopAuto();
      else startAuto();
    },
  });
  const hintEl = el('p', { class: 'piano-hint' });
  const mutedText = el('span');
  const unmuteBtn = el('button', {
    type: 'button',
    class: 'px-btn px-btn--accent piano-unmute',
    onclick: (event) => {
      blurIfPointer(event);
      unlock();
      setMuted(false);
    },
  });
  const mutedEl = el('div', { class: 'piano-muted', role: 'status', hidden: true }, mutedText, unmuteBtn);

  const board = el('div', { class: 'piano-keys', role: 'group' });
  for (const key of keys) {
    const name = `${NOTE_NAMES[key.midi % 12]}${Math.floor(key.midi / 12) - 1}`;
    key.node = el(
      'button',
      {
        type: 'button',
        tabindex: '-1',
        class: `pk ${key.black ? 'pk--black' : 'pk--white'}`,
        'data-midi': key.midi,
        'aria-label': name,
      },
      key.code ? el('span', { class: 'pk-label', 'aria-hidden': 'true', text: key.code.slice(3) }) : null,
    );
    if (key.black) key.node.style.left = `${(key.whitesBefore / whiteCount) * 100}%`;
    board.append(key.node);
  }

  const panel = el(
    'section',
    { class: 'piano', role: 'dialog', 'aria-labelledby': 'piano-title', tabindex: '-1', hidden: true },
    el('header', { class: 'panel-bar' }, titleEl, closeBtn),
    el('div', { class: 'piano-body' }, mutedEl, board, el('div', { class: 'piano-foot' }, playBtn, hintEl)),
  );
  root.append(panel);

  // ---------- Durum ----------
  let isOpen = false;
  let openedAt = 0;
  let lastFocus = null;
  let secretSent = false;
  let forcedLock = false;
  let classicWatch = null;
  let autoTimers = [];
  const holders = new Map(); // midi -> Set(tutan kaynak: 'k:KeyA' | 'p:3' | 'auto')
  const pointers = new Map(); // pointerId -> midi | null

  function render() {
    titleEl.textContent = pick(T.title);
    closeBtn.setAttribute('aria-label', pick(T.close));
    closeBtn.title = pick(T.close);
    playBtn.textContent = pick(autoTimers.length ? T.stop : T.play);
    playBtn.classList.toggle('is-active', autoTimers.length > 0);
    hintEl.textContent = pick(T.hint);
    mutedText.textContent = pick(T.muted);
    unmuteBtn.textContent = pick(T.unmute);
    mutedEl.hidden = !isMuted();
    board.setAttribute('aria-label', pick(T.keyboard));
  }

  // ---------- Oyun kilidi ----------
  // lock.js 'overlay' anahtarını tanıyorsa o kullanılır; tanımıyorsa ui:lock doğrudan yayılır.
  function lockGame(value) {
    setLock('overlay', value);
    if (value) {
      if (!isLocked()) {
        forcedLock = true;
        emit('ui:lock', { locked: true });
      }
    } else if (forcedLock) {
      forcedLock = false;
      emit('ui:lock', { locked: isLocked() });
    }
  }

  // ---------- Nota çalma ----------
  function play(midi) {
    note(midi);
    emit('piano:note', { midi });
    if (!secretSent) {
      secretSent = true;
      emit('secret:found', { id: 'piano' });
    }
  }

  function press(midi, holder) {
    const key = byMidi.get(midi);
    if (!key) return;
    let set = holders.get(midi);
    if (!set) {
      set = new Set();
      holders.set(midi, set);
    }
    if (set.has(holder)) return;
    set.add(holder);
    key.node.classList.add('is-down');
    play(midi);
  }

  function release(midi, holder) {
    const set = holders.get(midi);
    if (!set || !set.delete(holder)) return;
    if (set.size === 0) {
      holders.delete(midi);
      const key = byMidi.get(midi);
      if (key) key.node.classList.remove('is-down');
    }
  }

  function releaseAll() {
    for (const midi of [...holders.keys()]) {
      const key = byMidi.get(midi);
      if (key) key.node.classList.remove('is-down');
    }
    holders.clear();
    pointers.clear();
  }

  // ---------- Fare / dokunma (glissando + çoklu dokunma) ----------
  function midiAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const node = hit instanceof Element ? hit.closest('.pk') : null;
    if (!node || !board.contains(node)) return null;
    return Number(node.getAttribute('data-midi'));
  }

  function movePointer(event) {
    const id = event.pointerId;
    if (!pointers.has(id)) return;
    const prev = pointers.get(id);
    const next = midiAt(event.clientX, event.clientY);
    if (next === prev) return;
    if (prev != null) release(prev, `p:${id}`);
    pointers.set(id, next);
    if (next != null) press(next, `p:${id}`);
  }

  function endPointer(event) {
    const id = event.pointerId;
    if (!pointers.has(id)) return;
    const prev = pointers.get(id);
    if (prev != null) release(prev, `p:${id}`);
    pointers.delete(id);
  }

  board.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); // odak ve metin seçimi olmasın
    unlock();
    try {
      board.setPointerCapture(event.pointerId); // tuşların dışına taşınca da izle
    } catch {
      // yakalama desteklenmiyorsa da çalışır
    }
    pointers.set(event.pointerId, null);
    movePointer(event);
  });
  board.addEventListener('pointermove', movePointer);
  board.addEventListener('pointerup', endPointer);
  board.addEventListener('pointercancel', endPointer);
  board.addEventListener('lostpointercapture', endPointer);
  board.addEventListener('contextmenu', (event) => event.preventDefault());

  // ---------- Klavye ----------
  function onKeyDown(event) {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]')) return;
    const key = byCode.get(event.code);
    if (!key) return;
    event.preventDefault();
    if (event.repeat) return;
    if (performance.now() - openedAt < GUARD_MS) return;
    press(key.midi, `k:${event.code}`);
  }

  function onKeyUp(event) {
    const key = byCode.get(event.code);
    if (key) release(key.midi, `k:${event.code}`);
  }

  // ---------- Otomatik melodi ----------
  function stopAuto() {
    for (const id of autoTimers) clearTimeout(id);
    autoTimers = [];
    for (const midi of [...holders.keys()]) release(midi, 'auto');
    render();
  }

  function startAuto() {
    stopAuto();
    unlock();
    let at = 0;
    MELODY.forEach(([what, beats]) => {
      const midis = Array.isArray(what) ? what : [what];
      const length = beats * STEP_MS;
      autoTimers.push(
        setTimeout(() => {
          for (const midi of midis) press(midi, 'auto');
        }, at),
        setTimeout(() => {
          for (const midi of midis) release(midi, 'auto');
        }, at + length - 60),
      );
      at += length;
    });
    autoTimers.push(setTimeout(stopAuto, at + 20));
    render();
  }

  // ---------- Aç / kapat ----------
  function open() {
    if (isOpen) return;
    isOpen = true;
    openedAt = performance.now();
    lastFocus = document.activeElement;
    unlock(); // kullanıcı jesti zincirindeyiz
    render();
    panel.hidden = false;
    lockGame(true);
    panel.focus({ preventScroll: true });
    // Klasik görünüme geçilirse piyano kapansın
    if (typeof MutationObserver === 'function') {
      classicWatch = new MutationObserver(() => {
        if (document.body.classList.contains('is-classic')) close();
      });
      classicWatch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    stopAuto();
    releaseAll();
    if (classicWatch) {
      classicWatch.disconnect();
      classicWatch = null;
    }
    panel.hidden = true;
    if (panel.contains(document.activeElement) || document.activeElement === document.body) {
      if (lastFocus instanceof HTMLElement && lastFocus !== document.body && lastFocus.isConnected) {
        lastFocus.focus({ preventScroll: true });
      } else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    lastFocus = null;
    lockGame(false);
    emit('overlay:closed', { id: 'piano' });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    if (isOpen) releaseAll();
  });

  on('overlay:open', (detail) => {
    if (detail && detail.id === 'piano') open();
  });
  // Başka bir panel ya da tur başlarsa yol ver
  on('panel:open', () => close());
  on('tour:state', (detail) => {
    if (detail && detail.active) close();
  });
  // Piyano açıkken başka bir parça kilidi çözerse yeniden kilitle (yedek yol)
  on('ui:lock', (detail) => {
    if (!isOpen || !detail || detail.locked) return;
    queueMicrotask(() => {
      if (!isOpen || isLocked()) return;
      forcedLock = true;
      emit('ui:lock', { locked: true });
    });
  });
  on('audio:muted', render);
  on('lang:changed', render);

  render();
  return open;
}
