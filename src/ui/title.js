import './extras.css';
import { on } from '../bridge.js';
import { lang, setLang, pick } from '../i18n.js';
import { unlock, ambience, sfx } from '../audio.js';
import content from '../content/content.js';
import { visitorRef } from '../content/game-text.js';
import S from './strings.js';
import { el, reducedMotion } from './dom.js';
import { setLock } from './lock.js';

const FADE_MS = 400;

// Açılış ekranı. Kilit için 'classic' anahtarı kullanılır (lock.js'e yeni anahtar eklenmedi).
// ready: oyun hazır olunca çözülen söz (verilmezse hemen hazır sayılır); onProgress(fn): fn(0..1) ile yükleme oranı.
export function initTitle({ isClassic, openClassic, ready, onProgress, onStart } = {}) {
  const root = document.getElementById('ui');
  if (!root) return;
  let wantsClassic = false;
  try {
    wantsClassic = new URLSearchParams(window.location.search).has('classic');
  } catch {
    wantsClassic = false;
  }
  if (wantsClassic || (isClassic && isClassic())) return;

  const ref = visitorRef();
  const greet = el('p', { class: 'title-greet', hidden: !ref });
  const nameEl = el('h1', { class: 'title-name', id: 'title-name' });
  const jobEl = el('p', { class: 'title-job' });
  const tagEl = el('p', { class: 'title-tag' });
  const startBtn = el('button', { type: 'button', class: 'px-btn px-btn--accent title-start', onclick: () => start() });
  const classicBtn = el('button', { type: 'button', class: 'title-link', onclick: () => goClassic() });
  const langBtn = el(
    'button',
    { type: 'button', class: 'px-btn hud-lang', onclick: () => setLang(lang() === 'tr' ? 'en' : 'tr') },
    'TR / EN',
  );
  const tip = el('p', { class: 'title-tip' });
  const bg = el('div', { class: 'title-bg', 'aria-hidden': 'true' });
  bg.style.backgroundImage = "url('./assets/room/room.webp')";
  const card = el(
    'div',
    { class: 'title-card' },
    el('div', { class: 'title-main' }, greet, nameEl, jobEl, tagEl),
    el('div', { class: 'title-actions' }, startBtn, el('div', { class: 'title-sub' }, classicBtn, langBtn), tip),
  );
  const screen = el(
    'div',
    { class: 'title-screen', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'title-name' },
    bg,
    card,
  );
  root.append(screen);
  setLock('title', true);

  let closed = false;
  let loaded = !ready;
  let queued = false; // oyun hazır olmadan Başla'ya basıldı
  let percent = 0;

  function startLabel() {
    if (loaded) return pick(S.title.start);
    const text = pick(S.title.loading);
    if (percent <= 0) return text;
    return lang() === 'tr' ? `${text} %${percent}` : `${text} ${percent}%`;
  }

  function renderStart() {
    startBtn.textContent = startLabel();
    startBtn.classList.toggle('is-loading', !loaded);
    if (loaded) startBtn.removeAttribute('aria-busy');
    else startBtn.setAttribute('aria-busy', 'true');
  }

  function render() {
    const p = content.profile || {};
    nameEl.textContent = p.name || '';
    jobEl.textContent = pick(p.title);
    tagEl.textContent = pick(p.tagline);
    greet.textContent = ref ? pick(S.title.greet).replace('{ref}', ref) : '';
    renderStart();
    classicBtn.textContent = pick(S.title.classic);
    langBtn.setAttribute('aria-label', pick(S.title.lang));
    langBtn.title = pick(S.title.lang);
    tip.textContent = pick(S.title.tip);
  }

  function dismiss(releaseLock) {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    setLock('title', false);
    screen.classList.add('is-leaving');
    if (reducedMotion()) screen.remove();
    else setTimeout(() => screen.remove(), FADE_MS);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function start() {
    if (closed) return;
    // Ses bağlamı kullanıcı jesti içinde açılır; oyun hazır değilse gerisi hazır olunca sürer
    unlock();
    if (!loaded) {
      queued = true;
      return;
    }
    ambience(true);
    sfx('open');
    dismiss(true);
    if (onStart) onStart();
  }

  function goClassic() {
    if (closed) return;
    unlock();
    // Önce klasik görünüm kilidi alır, sonra açılış kilidi bırakılır (arada oyun açılmasın)
    if (openClassic) openClassic();
    dismiss(false);
  }

  // Odak ekran içinde kalsın; Enter/Space odaktaki düğmeyi zaten çalıştırır.
  function onKey(event) {
    if (event.key !== 'Tab') return;
    const list = [startBtn, classicBtn, langBtn];
    const i = list.indexOf(document.activeElement);
    event.preventDefault();
    const next = event.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i + 1) % list.length;
    list[next].focus();
  }
  window.addEventListener('keydown', onKey, true);

  if (ready) {
    const offProgress = onProgress
      ? onProgress((value) => {
          if (closed || loaded) return;
          percent = Math.round(value * 100);
          renderStart();
        })
      : null;
    Promise.resolve(ready)
      .catch(() => {})
      .then(() => {
        if (offProgress) offProgress();
        loaded = true;
        if (closed) return;
        renderStart();
        if (queued) start();
      });
  }

  on('lang:changed', render);
  render();
  startBtn.focus({ preventScroll: true });
}
