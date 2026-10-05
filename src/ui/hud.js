import './extras.css';
import { emit, on, SECTIONS, SECRETS } from '../bridge.js';
import { lang, setLang, pick } from '../i18n.js';
import content from '../content/content.js';
import { unlock, isMuted, setMuted, sfx, ambience } from '../audio.js';
import S from './strings.js';
import { el, safeUrl, blurIfPointer } from './dom.js';

const KEY_SEEN = 'portfolio:explored';
const KEY_SECRETS = 'portfolio:secrets';
const SECRET_TOAST_MS = 2500;
const KEY_DONE = 'portfolio:explored-done';
const HINT_MS = 8000;
const TOAST_MS = 10000;
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

function loadSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_SEEN) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((id) => SECTIONS.includes(id)) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen) {
  try {
    localStorage.setItem(KEY_SEEN, JSON.stringify([...seen]));
  } catch {
    // depolama kapalıysa ilerleme yalnızca bu oturumda tutulur
  }
}

function loadSecrets() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_SECRETS) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((id) => SECRETS.includes(id)) : []);
  } catch {
    return new Set();
  }
}

function saveSecrets(found) {
  try {
    localStorage.setItem(KEY_SECRETS, JSON.stringify([...found]));
  } catch {
    // önemsiz
  }
}

function loadDone() {
  try {
    return localStorage.getItem(KEY_DONE) === '1';
  } catch {
    return false;
  }
}

function saveDone() {
  try {
    localStorage.setItem(KEY_DONE, '1');
  } catch {
    // önemsiz
  }
}

function isTouch() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

// İkon + etiketli HUD düğmesi.
function hudButton(icon, onClick, extraClass) {
  const label = el('span', { class: 'hud-btn-label' });
  const node = el(
    'button',
    {
      type: 'button',
      class: `px-btn hud-btn ${extraClass || ''}`.trim(),
      onclick: (event) => {
        blurIfPointer(event);
        sfx('click');
        onClick();
      },
    },
    el('span', { class: 'hud-btn-icon', 'aria-hidden': 'true', text: icon }),
    label,
  );
  const iconEl = node.firstChild;
  return {
    node,
    set(text, nextIcon) {
      label.textContent = text;
      if (nextIcon) iconEl.textContent = nextIcon;
    },
  };
}

export function createHud(root, { onToggleClassic }) {
  let tourActive = false;
  let classic = false;
  let done = loadDone();
  let pendingToast = false;
  let toastTimer = null;
  const seen = loadSeen();
  const secrets = loadSecrets();
  let secretTimer = null;

  // --- Görev defteri ---
  const questTitle = el('span', { class: 'quest-title' });
  const questCount = el('span', { class: 'quest-count' });
  const segments = SECTIONS.map(() => el('span', { class: 'quest-seg' }));
  const questCta = el('button', {
    type: 'button',
    class: 'px-btn px-btn--accent quest-cta',
    hidden: true,
    onclick: (event) => {
      blurIfPointer(event);
      emit('panel:open', { id: 'contact' });
    },
  });
  const secretsLine = el('p', { class: 'quest-secrets' });
  const quest = el(
    'section',
    { class: 'hud-quest' },
    el('div', { class: 'quest-head' }, questTitle, questCount),
    el('div', { class: 'quest-bar', 'aria-hidden': 'true' }, segments),
    questCta,
    secretsLine,
  );

  // --- Düğmeler ---
  const langTr = el('span', { class: 'lang-opt', text: 'TR' });
  const langEn = el('span', { class: 'lang-opt', text: 'EN' });
  const langBtn = el(
    'button',
    {
      type: 'button',
      class: 'px-btn hud-btn hud-lang',
      onclick: (event) => {
        blurIfPointer(event);
        sfx('click');
        setLang(lang() === 'tr' ? 'en' : 'tr');
      },
    },
    langTr,
    el('span', { 'aria-hidden': 'true', text: '/' }),
    langEn,
  );
  const tourBtn = hudButton('▶', () => emit(tourActive ? 'tour:stop' : 'tour:start', {}), 'hud-tour');
  const soundBtn = hudButton(
    '♪',
    () => {
      unlock();
      const next = !isMuted();
      setMuted(next);
      ambience(!next);
    },
    'hud-sound',
  );
  // Dar ekranda yalnız simge
  const narrowMq = window.matchMedia ? window.matchMedia('(max-width: 480px)') : null;
  const classicBtn = hudButton('≡', () => onToggleClassic(), 'hud-classic');
  const cvLabel = el('span', { class: 'hud-btn-label' });
  const cvBtn = el(
    'a',
    {
      class: 'px-btn hud-btn hud-cv',
      href: safeUrl(pick(content.profile && content.profile.cvUrl)),
      download: true,
    },
    el('span', { class: 'hud-btn-icon', 'aria-hidden': 'true', text: '↓' }),
    cvLabel,
  );
  // CV düğmesi yalnızca profile.cvUrl tanımlıysa çizilir (yoksa DOM'a hiç eklenmez)
  const hasCv = Boolean(content.profile && content.profile.cvUrl);
  const actions = el('nav', { class: 'hud-actions' }, soundBtn.node, langBtn, tourBtn.node, classicBtn.node);
  if (hasCv) actions.append(cvBtn);
  const top = el('div', { class: 'hud-top' }, quest, actions);

  // --- Kontrol ipucu ---
  const hint = el('p', { class: 'hud-hint' });

  // --- Başarım bildirimi ---
  const toastTitle = el('strong', { class: 'toast-title' });
  const toastText = el('span', { class: 'toast-text' });
  const toastCta = el('button', {
    type: 'button',
    class: 'px-btn px-btn--accent',
    onclick: () => {
      hideToast();
      emit('panel:open', { id: 'contact' });
    },
  });
  const toastClose = el('button', { type: 'button', class: 'bar-btn toast-close', onclick: () => hideToast() }, '✕');
  const toast = el(
    'div',
    { class: 'toast', role: 'status', hidden: true },
    toastClose,
    el('span', { class: 'toast-star', 'aria-hidden': 'true', text: '★' }),
    toastTitle,
    toastText,
    toastCta,
  );

  const secretToast = el('div', { class: 'secret-toast', role: 'status', hidden: true });

  root.append(top, hint, toast, secretToast);

  function render() {
    const count = seen.size;
    const complete = count >= SECTIONS.length;
    if (hasCv) cvBtn.href = safeUrl(pick(content.profile.cvUrl));
    questTitle.textContent = pick(complete ? S.hud.questDone : S.hud.quest);
    questCount.textContent = `${count}/${SECTIONS.length}`;
    SECTIONS.forEach((id, i) => {
      segments[i].classList.toggle('is-on', seen.has(id));
    });
    quest.classList.toggle('is-done', complete);
    questCta.textContent = pick(S.hud.contactCta);
    questCta.hidden = !complete;

    const current = lang();
    langTr.classList.toggle('is-active', current === 'tr');
    langEn.classList.toggle('is-active', current === 'en');
    langBtn.setAttribute('aria-label', pick(S.hud.lang));
    langBtn.title = pick(S.hud.lang);

    tourBtn.set(pick(tourActive ? S.hud.tourStop : S.hud.tourStart), tourActive ? '■' : '▶');
    tourBtn.node.classList.toggle('is-active', tourActive);
    classicBtn.set(pick(classic ? S.hud.backToGame : S.hud.classic), classic ? '◄' : '≡');
    cvLabel.textContent = pick(S.hud.cv);

    const muted = isMuted();
    soundBtn.set(pick(muted ? S.hud.soundOff : S.hud.soundOn), muted ? '×' : '♪');
    soundBtn.node.setAttribute('aria-label', pick(S.hud.soundLabel));
    soundBtn.node.title = pick(S.hud.soundLabel);
    soundBtn.node.setAttribute('aria-pressed', String(!muted));
    secretsLine.textContent = `${pick(S.hud.secrets)} ${secrets.size}/${SECRETS.length}`;

    hint.textContent = pick(isTouch() ? S.hud.hintTouch : S.hud.hintKeys);

    toastTitle.textContent = pick(S.hud.achievementTitle);
    toastText.textContent = pick(S.hud.achievementText);
    toastCta.textContent = pick(S.hud.contactCta);
    toastClose.setAttribute('aria-label', pick(S.hud.dismiss));
  }

  function showToast() {
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toast.hidden = true;
  }

  function showSecretToast(text, special) {
    secretToast.textContent = text;
    secretToast.classList.toggle('is-special', Boolean(special));
    secretToast.hidden = false;
    // Animasyon yeniden başlasın
    secretToast.style.animation = 'none';
    void secretToast.offsetWidth;
    secretToast.style.animation = '';
    clearTimeout(secretTimer);
    secretTimer = setTimeout(() => {
      secretToast.hidden = true;
    }, SECRET_TOAST_MS);
  }

  function foundSecret(id) {
    if (!SECRETS.includes(id) || secrets.has(id)) return;
    secrets.add(id);
    saveSecrets(secrets);
    render();
    sfx('secret');
    if (secrets.size >= SECRETS.length) {
      showSecretToast(pick(S.hud.allSecrets), true);
    } else {
      showSecretToast(`${pick(S.hud.secretFound)}: ${pick(S.secrets[id])}`, false);
    }
  }

  function markSeen(id) {
    if (!SECTIONS.includes(id) || seen.has(id)) return;
    seen.add(id);
    saveSeen(seen);
    if (seen.size >= SECTIONS.length && !done) {
      done = true;
      saveDone();
      pendingToast = true; // panel kapanınca gösterilir
    }
    render();
  }

  // İpucu: ilk hareket ya da süre dolunca kaybolur.
  let hintTimer = null;
  function dismissHint() {
    clearTimeout(hintTimer);
    hint.hidden = true;
    window.removeEventListener('keydown', onMoveKey);
    window.removeEventListener('pointerdown', onGamePointer);
  }
  function onMoveKey(event) {
    if (MOVE_KEYS.includes(String(event.key).toLowerCase())) dismissHint();
  }
  function onGamePointer(event) {
    if (event.target instanceof Element && event.target.closest('#game')) dismissHint();
  }
  window.addEventListener('keydown', onMoveKey);
  window.addEventListener('pointerdown', onGamePointer);
  hintTimer = setTimeout(dismissHint, HINT_MS);

  on('panel:open', (detail) => {
    sfx('open');
    hideToast();
    markSeen(detail && detail.id);
  });
  on('panel:closed', () => {
    sfx('close');
    if (!pendingToast) return;
    pendingToast = false;
    if (!classic) showToast();
  });
  on('tour:state', (detail) => {
    tourActive = Boolean(detail && detail.active);
    render();
  });
  on('overlay:open', () => sfx('open'));
  on('overlay:closed', () => sfx('close'));
  // Diyalog satırı ilerlemesi köprüde yok; yalnızca diyalog açılışında blip çalar.
  on('dialog:show', () => sfx('blip'));
  on('secret:found', (detail) => foundSecret(detail && detail.id));
  on('audio:muted', render);
  on('lang:changed', render);

  render();

  return {
    isTourActive: () => tourActive,
    setClassic(active) {
      classic = Boolean(active);
      if (classic) hideToast();
      render();
    },
  };
}
