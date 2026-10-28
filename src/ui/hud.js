import './extras.css';
import { emit, on, SECTIONS, SECRETS } from '../bridge.js';
import { lang, setLang, pick } from '../i18n.js';
import content from '../content/content.js';
import { unlock, isMuted, setMuted, sfx, ambience } from '../audio.js';
import S from './strings.js';
import { el, safeUrl, blurIfPointer } from './dom.js';
import { track } from '../data/store.js';

const KEY_SEEN = 'portfolio:explored';
const KEY_SECRETS = 'portfolio:secrets';
const SECRET_TOAST_MS = 6000;
const KEY_DONE = 'portfolio:explored-done';
const KEY_CV_HINT = 'portfolio:cv-hint';
const CV_HINT_DELAY = 900; // ipucu okunabilsin diye yazdırma penceresi bu kadar geç açılır (yalnızca ilk kullanım)
const CV_HINT_MS = 6000;
const HINT_MAX_MS = 20000; // ipucu oyuncu hiçbir şey yapmasa da bu kadar sonra kapanır
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

// "CV indir" ipucu (yazdırma penceresinde "PDF olarak kaydet") yalnızca ilk kullanımda gösterilir.
function loadCvHint() {
  try {
    return localStorage.getItem(KEY_CV_HINT) === '1';
  } catch {
    return false;
  }
}

function saveCvHint() {
  try {
    localStorage.setItem(KEY_CV_HINT, '1');
  } catch {
    // önemsiz: ipucu bu oturumda her tıklamada görünür
  }
}

function saveDone() {
  try {
    localStorage.setItem(KEY_DONE, '1');
  } catch {
    // önemsiz
  }
}

// Bu sayfa yüklemesinde oyun görünümü en az bir kez gösterildi mi? (?classic ile gelen ziyaretçi oyunu hiç görmemiştir)
let gameShown = false;

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

export function createHud(root, { onToggleClassic, onPrintCv }) {
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
  // CV düğmesi: profile.cvUrl tanımlıysa o dosyayı indirir (bağlantı); değilse klasik görünümü yazdırır
  // (tarayıcının yazdırma penceresi açılır, kullanıcı "PDF olarak kaydet"i seçer).
  const hasCv = Boolean(content.profile && content.profile.cvUrl);
  let cvLabel;
  let cvBtn;
  if (hasCv) {
    cvLabel = el('span', { class: 'hud-btn-label' });
    cvBtn = el(
      'a',
      {
        class: 'px-btn hud-btn hud-cv',
        href: safeUrl(pick(content.profile.cvUrl)),
        download: true,
      },
      el('span', { class: 'hud-btn-icon', 'aria-hidden': 'true', text: '↓' }),
      cvLabel,
    );
  } else {
    const printBtn = hudButton(
      '↓',
      () => {
        // İlk kullanımda kısa ipucu gösterilir; yazdırma, okunabilmesi için biraz gecikir.
        const first = !loadCvHint();
        if (typeof onPrintCv !== 'function' || !onPrintCv({ delay: first ? CV_HINT_DELAY : 0 })) return;
        track('cv', {});
        if (!first) return;
        saveCvHint();
        showSecretToast(pick(S.hud.cvHint), false, CV_HINT_MS);
      },
      'hud-cv',
    );
    cvBtn = printBtn.node;
    cvLabel = cvBtn.querySelector('.hud-btn-label');
  }
  const actions = el('nav', { class: 'hud-actions' }, soundBtn.node, langBtn, tourBtn.node, classicBtn.node, cvBtn);
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

  // --- İHA uçarken iniş düğmesi (dokunmatikte E tuşu yok) ---
  // Basınca hemen iner (oyun içi düğme gibi); click yalnız klavye (Enter/Space) için, ikinci çağrıyı oyun yok sayar
  const droneBtn = el('button', {
    type: 'button',
    class: 'px-btn px-btn--accent hud-drone',
    hidden: true,
    onpointerdown: (event) => {
      event.preventDefault();
      emit('drone:land');
    },
    onclick: () => emit('drone:land'),
  });

  root.append(top, hint, toast, secretToast, droneBtn);

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
    // Etkin dil ekran okuyucuya da bildirilir
    for (const [node, code] of [[langTr, 'tr'], [langEn, 'en']]) {
      if (current === code) node.setAttribute('aria-current', 'true');
      else node.removeAttribute('aria-current');
    }
    langBtn.setAttribute('aria-label', pick(S.hud.lang));
    langBtn.title = pick(S.hud.lang);
    actions.setAttribute('aria-label', pick(S.hud.actionsLabel));
    quest.setAttribute('aria-label', pick(S.hud.questLabel));

    tourBtn.set(pick(tourActive ? S.hud.tourStop : S.hud.tourStart), tourActive ? '■' : '▶');
    tourBtn.node.classList.toggle('is-active', tourActive);
    const classicText = pick(classic ? (gameShown ? S.hud.backToGame : S.hud.exploreRoom) : S.hud.classic);
    classicBtn.set(classicText, classic ? '◄' : '≡');
    classicBtn.node.setAttribute('aria-label', classicText);
    classicBtn.node.title = classicText;
    cvLabel.textContent = pick(S.hud.cv);
    if (!hasCv) cvBtn.title = pick(S.hud.cvHint);

    const muted = isMuted();
    const soundText = pick(muted ? S.hud.soundOff : S.hud.soundOn);
    soundBtn.set(soundText, muted ? '×' : '♪');
    // Erişilebilir ad = görünür durum metni (dar ekranda etiket gizlense de ad değişmez)
    soundBtn.node.setAttribute('aria-label', soundText);
    soundBtn.node.title = soundText;
    soundBtn.node.removeAttribute('aria-pressed');
    secretsLine.textContent = `${pick(S.hud.secrets)} ${secrets.size}/${SECRETS.length}`;

    hint.textContent = pick(isTouch() ? S.hud.hintTouch : S.hud.hintKeys);
    droneBtn.textContent = pick(S.hud.droneLand);

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

  function showSecretToast(text, special, ms = SECRET_TOAST_MS) {
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
    }, ms);
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

  // İpucu: oyun gerçekten göründüğünde başlar; oyuncunun ilk hareketi ya da ilk etkileşimiyle kapanır
  // (yedek: HINT_MAX_MS sonra).
  let hintTimer = null;
  let hintStarted = false;
  let offInteract = [];
  hint.hidden = true;
  function dismissHint() {
    clearTimeout(hintTimer);
    hint.hidden = true;
    window.removeEventListener('keydown', onMoveKey);
    window.removeEventListener('pointerdown', onGamePointer);
    offInteract.forEach((off) => off());
    offInteract = [];
  }
  function onMoveKey(event) {
    const key = String(event.key).toLowerCase();
    if (MOVE_KEYS.includes(key)) dismissHint(); // E giriş diyaloğunu da ilerletir; inceleme "interact" olayıyla yakalanır
  }
  function onGamePointer(event) {
    if (event.target instanceof Element && event.target.closest('#game')) dismissHint();
  }
  function startHint() {
    if (hintStarted) return;
    hintStarted = true;
    hint.hidden = false;
    window.addEventListener('keydown', onMoveKey);
    window.addEventListener('pointerdown', onGamePointer);
    offInteract = [on('interact', dismissHint), on('panel:open', dismissHint)];
    hintTimer = setTimeout(dismissHint, HINT_MAX_MS);
  }

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
  on('overlay:open', () => {
    sfx('open');
    hideToast(); // başarım bildirimi ek panelin (piyano, defter…) başlığını ve kapat düğmesini örtmesin
  });
  on('overlay:closed', () => sfx('close'));
  // Diyalog satırı ilerlemesi köprüde yok; yalnızca diyalog açılışında blip çalar.
  on('dialog:show', () => sfx('blip'));
  on('secret:found', (detail) => foundSecret(detail && detail.id));
  on('drone:state', (detail) => {
    droneBtn.hidden = !(detail && detail.flying);
  });
  on('audio:muted', render);
  on('lang:changed', render);

  render();

  return {
    isTourActive: () => tourActive,
    // Kısa bildirim (sır bildirimiyle aynı kutu)
    notify: (text) => showSecretToast(text, false),
    markGameShown() {
      gameShown = true;
      startHint();
      render();
    },
    // Odaya dönüşte ipucu ve "Odaya dön" etiketi burada başlamaz: oda gerçekten göründüğünde index.js markGameShown() çağırır.
    setClassic(active) {
      classic = Boolean(active);
      if (classic) hideToast();
      render();
    },
  };
}
