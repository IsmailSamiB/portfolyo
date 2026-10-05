import './extras.css';
import { emit, on } from '../bridge.js';
import { pick } from '../i18n.js';
import { dayPhase } from '../phase.js';
import content from '../content/content.js';
import S from './strings.js';
import { el, reducedMotion } from './dom.js';
import { setLock } from './lock.js';

const GUARD_MS = 200;

// Modül düzeyi durum: iki kimlik ('view', 'postcard') aynı örneği paylaşır.
let api = null; // { open(id) }
// main.js tablosundan en az bir kez yüklenmiş (silinmiş) kimlikler. Bu kimliklerin olaylarını
// yalnızca modülün kendi dinleyicisi açar; henüz talep edilmemiş kimliği main.js açar (çift açılma olmasın).
const claimed = new Set();

// Bursa penceresi + Gdańsk kartpostalı. Kilit için 'overlay' anahtarı kullanılır.
// Dönen fonksiyon verilen kimliği açar; dinleyiciler yalnızca ilk çağrıda kurulur.
export function initView(id = 'view') {
  const kind = id === 'postcard' ? 'postcard' : 'view';
  claimed.add(kind);
  if (!api) api = build();
  if (!api) return undefined;
  return () => api.open(kind);
}

function build() {
  const root = document.getElementById('ui');
  if (!root) return null;

  // ---------- Bursa penceresi ----------
  const img = el('img', { class: 'view-img', alt: '', draggable: 'false', decoding: 'async' });
  const glass = el(
    'div',
    { class: 'view-glass' },
    img,
    el('span', { class: 'view-curtain view-curtain--l', 'aria-hidden': 'true' }),
    el('span', { class: 'view-curtain view-curtain--r', 'aria-hidden': 'true' }),
  );
  const win = el('div', { class: 'view-window' }, glass);
  const titleEl = el('h2', { class: 'view-title', id: 'view-title' });
  const textEl = el('p', { class: 'view-text' });
  const closeBtn = el('button', { type: 'button', class: 'bar-btn view-close', onclick: () => close() }, '✕');
  const wrap = el(
    'div',
    { class: 'view-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'view-title' },
    closeBtn,
    win,
    el('div', { class: 'view-caption' }, titleEl, textEl),
  );
  const layer = el('div', { class: 'view-layer', hidden: true }, wrap);

  // ---------- Gdańsk kartpostalı ----------
  const pcImg = el('img', { class: 'pc-img', alt: '', draggable: 'false', decoding: 'async' });
  const pcPic = el('div', { class: 'pc-pic' }, pcImg);
  const pcTitle = el('h2', { class: 'pc-title', id: 'postcard-title' });
  const pcText = el('p', { class: 'pc-text' });
  const pcClose = el('button', { type: 'button', class: 'bar-btn view-close', onclick: () => close() }, '✕');
  const stamp = el('div', { class: 'pc-stamp', 'aria-hidden': 'true' }, el('span', { class: 'pc-stamp-art' }));
  const postmark = el('div', { class: 'pc-postmark', 'aria-hidden': 'true' }, el('span', {}, 'GDAŃSK · 2026'));
  const lines = el('div', { class: 'pc-lines', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'));
  const paper = el('div', { class: 'pc-paper' }, stamp, postmark, pcTitle, pcText, lines);
  const card = el('div', { class: 'pc-card' }, pcPic, paper);
  const pcWrap = el(
    'div',
    { class: 'view-wrap pc-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'postcard-title' },
    pcClose,
    card,
  );
  const pcLayer = el('div', { class: 'view-layer pc-layer', hidden: true }, pcWrap);

  root.append(layer, pcLayer);

  let current = null; // açık kimlik
  let openedAt = 0;
  let lastFocus = null;
  let seenSecret = false;

  // Yüklenemezse degrade yedeği görünür kalsın.
  img.addEventListener('error', () => {
    img.hidden = true;
  });
  pcImg.addEventListener('error', () => {
    pcImg.hidden = true;
  });
  card.addEventListener('animationend', () => card.classList.remove('is-flip'));

  function render() {
    const h = content.hometown || {};
    titleEl.textContent = pick(h.title);
    textEl.textContent = pick(h.text);
    const e = content.erasmus || {};
    pcTitle.textContent = pick(e.title);
    pcText.textContent = pick(e.text);
    for (const b of [closeBtn, pcClose]) {
      b.setAttribute('aria-label', pick(S.view.close));
      b.title = pick(S.view.close);
    }
  }

  function guarded() {
    return performance.now() - openedAt < GUARD_MS;
  }

  function setParallax(x) {
    if (reducedMotion()) return;
    wrap.style.setProperty('--px', String(Math.max(-1, Math.min(1, x))));
  }

  // Fare/dokunma konumu -1..1; resim ters yöne kayar.
  glass.addEventListener('pointermove', (event) => {
    const r = glass.getBoundingClientRect();
    if (!r.width) return;
    setParallax(-(((event.clientX - r.left) / r.width) * 2 - 1));
  });
  glass.addEventListener('pointerleave', () => setParallax(0));

  layer.addEventListener('click', (event) => {
    if (guarded()) return;
    if (!wrap.contains(event.target)) close();
  });
  pcLayer.addEventListener('click', (event) => {
    if (guarded()) return;
    if (!pcWrap.contains(event.target)) close();
  });

  function onKey(event) {
    if (!current) return;
    const btn = current === 'postcard' ? pcClose : closeBtn;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!guarded()) close();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      btn.focus();
    } else if (event.key === ' ' || event.key === 'Enter') {
      // Oyuna sızmasın; kapat düğmesinde doğal tıklama çalışır.
      if (document.activeElement !== btn) event.preventDefault();
      else if (guarded()) event.preventDefault();
    }
  }
  window.addEventListener('keydown', onKey, true);

  // 'open' sesini HUD zaten overlay:open olayında çalıyor; burada çalınmaz.
  function open(id) {
    if (current) return;
    current = id;
    openedAt = performance.now();
    lastFocus = document.activeElement;
    render();
    if (id === 'postcard') {
      pcImg.hidden = false;
      pcImg.src = './assets/view/gdansk.webp';
      card.classList.remove('is-flip');
      if (!reducedMotion()) {
        void card.offsetWidth; // animasyonu yeniden başlat
        card.classList.add('is-flip');
      }
      pcLayer.hidden = false;
      setLock('overlay', true);
      pcClose.focus({ preventScroll: true });
      if (!seenSecret) {
        seenSecret = true;
        emit('secret:found', { id: 'gdansk' });
      }
    } else {
      const night = dayPhase() === 'night';
      img.hidden = false;
      img.src = night ? './assets/view/bursa-night.webp' : './assets/view/bursa-day.webp';
      win.classList.toggle('is-night', night);
      setParallax(0);
      layer.hidden = false;
      setLock('overlay', true);
      closeBtn.focus({ preventScroll: true });
      emit('secret:found', { id: 'view' });
    }
  }

  function close() {
    if (!current) return;
    const id = current;
    current = null;
    layer.hidden = true;
    pcLayer.hidden = true;
    setLock('overlay', false);
    if (lastFocus instanceof HTMLElement && lastFocus !== document.body && lastFocus.isConnected) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
    emit('overlay:closed', { id });
  }

  // Yalnızca main.js tablosundan çıkmış kimlikleri aç; diğerini main.js kendisi yükleyip açar.
  on('overlay:open', (detail) => {
    const id = detail && detail.id;
    if ((id === 'view' || id === 'postcard') && claimed.has(id)) open(id);
  });
  on('lang:changed', render);
  render();
  return { open };
}
