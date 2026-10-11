import './guestbook.css';
import { emit, on } from '../bridge.js';
import { lang, pick } from '../i18n.js';
import { guestbook, hasLink } from '../data/store.js';
import { sfx } from '../audio.js';
import { el, reducedMotion, blurIfPointer } from './dom.js';
import { setLock } from './lock.js';

const GUARD_MS = 200; // paneli açan E basışı hemen kapatmasın
const PER_PAGE = 3; // defterde sayfa başına mesaj
const CARD_STEP = 6; // klasik görünümde bir seferde gösterilen kart
const NAME_MAX = 40;
const MSG_MAX = 280;

const T = {
  title: { tr: 'Ziyaretçi defteri', en: 'Guestbook' },
  close: { tr: 'Kapat', en: 'Close' },
  prev: { tr: 'Önceki sayfa', en: 'Previous page' },
  next: { tr: 'Sonraki sayfa', en: 'Next page' },
  loading: { tr: 'Defter açılıyor…', en: 'Opening the guestbook…' },
  emptyTitle: { tr: 'İlk yazan sen ol', en: 'Be the first to write' },
  emptyText: {
    tr: 'Bu sayfalar henüz boş. Bir selam bırak, defterin ilk satırı senin olsun.',
    en: 'These pages are still blank. Leave a hello and make the first line yours.',
  },
  formTitle: { tr: 'Bir not bırak', en: 'Leave a note' },
  name: { tr: 'Adın', en: 'Your name' },
  message: { tr: 'Mesajın', en: 'Your message' },
  submit: { tr: 'Notu gönder', en: 'Send note' },
  sending: { tr: 'Gönderiliyor…', en: 'Sending…' },
  toWrite: { tr: 'Not bırak', en: 'Leave a note' },
  toRead: { tr: 'Notları oku', en: 'Read notes' },
  more: { tr: 'Devamını göster', en: 'Show more' },
  note: {
    tr: 'Adın ve notun, onaylandıktan sonra herkese görünür. E-posta ya da bağlantı ekleme.',
    en: 'Your name and note become public once approved. Please leave out emails and links.',
  },
  nameMissing: { tr: 'Adını yaz.', en: 'Enter your name.' },
  messageShort: { tr: 'Mesaj en az 3 karakter olmalı.', en: 'Your message needs at least 3 characters.' },
  loadFailed: { tr: 'Defter şu an açılamadı.', en: 'The guestbook couldn’t be loaded.' },
  retry: { tr: 'Tekrar dene', en: 'Try again' },
  nameHint: { tr: 'En çok 40 karakter', en: 'Up to 40 characters' },
  list: { tr: 'Onaylı mesajlar', en: 'Approved messages' },
  thanks: { tr: 'Teşekkürler! Mesajın onaydan sonra görünecek.', en: 'Thank you! Your message will appear after approval.' },
  link: { tr: 'Bağlantı içeren mesajlar kabul edilmiyor', en: 'Messages containing links are not accepted' },
  rate: { tr: 'Üst üste not gönderemezsin; 2 dakika sonra tekrar dene.', en: 'Notes can be sent once every 2 minutes; try again shortly.' },
  offline: { tr: 'Defter şu an çevrimdışı; daha sonra tekrar dene', en: 'The guestbook is offline right now; try again later' },
};

let uid = 0;

function fmtDate(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(lang() === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// Okuma hatasını boş defterden ayırır: hatada null döner, boş defterde [].
async function loadApproved() {
  try {
    const list = await guestbook.listApproved();
    return Array.isArray(list) ? list : [];
  } catch {
    return null;
  }
}

// Yeniden çizimden sonra odak yalnızca kullanıcı "Tekrar dene"ye bastıysa taşınır (ilk yüklemede odak çalınmaz):
// hata sürerse yeni "Tekrar dene" düğmesine, yoksa liste kapsayıcısına (tabindex=-1).
// fallback: liste gizliyse (klasik görünümde boş defter: yalnız davet + form görünür) odağın gideceği kapsayıcı.
function refocusAfterRetry(host, failed, fallback) {
  let target = failed ? host.querySelector('.gb-error-state button') : host;
  if (!(target instanceof HTMLElement) || target.offsetParent === null) target = fallback;
  if (target instanceof HTMLElement && target.offsetParent !== null) target.focus({ preventScroll: true });
}

// Okuma hatası: mesaj + "Tekrar dene"; form açık kalır
function errorNode(onRetry) {
  return el(
    'div',
    { class: 'gb-error-state' },
    el('p', { class: 'gb-error-text', text: pick(T.loadFailed) }),
    el('button', { type: 'button', class: 'px-btn', onclick: () => onRetry(true) }, pick(T.retry)), // odak yeniden çizimden sonra taşınır; blurIfPointer burada kullanılmaz
  );
}

// Tek mesaj: metin her zaman metin düğümü olarak eklenir
function entryNode(entry, cls) {
  return el(
    'article',
    { class: cls },
    el('p', { class: 'gb-msg', text: entry.message }),
    el(
      'footer',
      { class: 'gb-by' },
      el('strong', { class: 'gb-name', text: entry.name }),
      el('span', { class: 'gb-date', text: fmtDate(entry.createdAt) }),
    ),
  );
}

function emptyNode() {
  return el(
    'div',
    { class: 'gb-empty' },
    el('span', { class: 'gb-empty-icon', 'aria-hidden': 'true' }),
    el('strong', { class: 'gb-empty-title', text: pick(T.emptyTitle) }),
    el('p', { class: 'gb-empty-text', text: pick(T.emptyText) }),
  );
}

// Her iki görünümün paylaştığı form; alanlar yeniden çizimde korunur (yalnızca metinler güncellenir)
function createForm() {
  const id = `gb${(uid += 1)}`;
  let busy = false;
  let statusKind = null; // 'thanks' | 'link' | 'rate' | 'offline'
  let alive = true;
  let nearOn = false;
  const errors = { name: null, message: null }; // T anahtarı ya da null

  const nameInput = el('input', {
    type: 'text',
    id: `${id}-name`,
    name: 'name',
    class: 'gb-input',
    maxlength: NAME_MAX,
    autocomplete: 'nickname',
    required: true,
  });
  const msgInput = el('textarea', {
    id: `${id}-msg`,
    name: 'message',
    class: 'gb-input gb-textarea',
    maxlength: MSG_MAX,
    rows: 5,
    required: true,
  });
  const nameLabel = el('label', { class: 'gb-label', for: `${id}-name` });
  const msgLabel = el('label', { class: 'gb-label', for: `${id}-msg` });
  const note = el('p', { class: 'gb-note' });
  const nameHint = el('p', { class: 'gb-count gb-hint', id: `${id}-name-hint` });
  const nameError = el('p', { class: 'gb-field-error', id: `${id}-name-err`, hidden: true });
  const msgError = el('p', { class: 'gb-field-error', id: `${id}-msg-err`, hidden: true });
  const counter = el('span', { class: 'gb-count', id: `${id}-count` });
  // Ekran okuyucu sayacı yalnızca sınırın %90'ında duyurur
  const nearLive = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  const status = el('p', { class: 'gb-status', role: 'status', 'aria-live': 'polite' });
  const submitBtn = el('button', { type: 'submit', class: 'gb-btn gb-btn--accent' });
  const form = el(
    'form',
    { class: 'gb-form', novalidate: true },
    note,
    el('div', { class: 'gb-field' }, nameLabel, nameInput, nameHint, nameError),
    el('div', { class: 'gb-field' }, el('div', { class: 'gb-label-row' }, msgLabel, counter, nearLive), msgInput, msgError),
    submitBtn,
    status,
  );
  nameInput.setAttribute('aria-describedby', nameHint.id);
  const fields = [
    { key: 'name', input: nameInput, node: nameError, hint: nameHint, bad: () => !nameInput.value.trim(), msg: 'nameMissing' },
    { key: 'message', input: msgInput, node: msgError, hint: null, bad: () => msgInput.value.trim().length < 3, msg: 'messageShort' },
  ];

  // Yazarken oyun tuşları (E, Boşluk, WASD) oyuna gitmesin
  for (const type of ['keydown', 'keyup']) {
    form.addEventListener(type, (event) => {
      if (event.key === 'Escape') return;
      event.stopPropagation();
    });
  }

  function updateCount() {
    counter.textContent = `${msgInput.value.length}/${MSG_MAX}`;
    const near = msgInput.value.length >= MSG_MAX * 0.9;
    counter.classList.toggle('is-near', near);
    // Yalnızca eşiği geçerken duyur
    if (near && !nearOn) nearLive.textContent = counter.textContent;
    else if (!near) nearLive.textContent = '';
    nearOn = near;
  }
  msgInput.addEventListener('input', updateCount);

  // Alan hatasını yazar/kaldırır; aria-invalid ve aria-describedby bağlanır
  function showError(field, msgKey) {
    errors[field.key] = msgKey;
    field.node.hidden = !msgKey;
    field.node.textContent = msgKey ? pick(T[msgKey]) : '';
    if (msgKey) field.input.setAttribute('aria-invalid', 'true');
    else field.input.removeAttribute('aria-invalid');
    const ids = [];
    if (field.hint) ids.push(field.hint.id);
    if (msgKey) ids.push(field.node.id);
    if (ids.length) field.input.setAttribute('aria-describedby', ids.join(' '));
    else field.input.removeAttribute('aria-describedby');
  }

  function validateField(field) {
    showError(field, field.bad() ? field.msg : null);
    return !errors[field.key];
  }

  function retext() {
    nameLabel.textContent = pick(T.name);
    msgLabel.textContent = pick(T.message);
    note.textContent = pick(T.note);
    nameHint.textContent = pick(T.nameHint);
    submitBtn.textContent = pick(busy ? T.sending : T.submit);
    if (statusKind) {
      status.textContent = pick(T[statusKind]);
    }
    for (const f of fields) if (errors[f.key]) f.node.textContent = pick(T[errors[f.key]]);
    updateCount();
  }

  function setStatus(kind) {
    statusKind = kind;
    status.textContent = kind ? pick(T[kind]) : '';
    status.classList.toggle('is-ok', kind === 'thanks');
    status.classList.toggle('is-err', Boolean(kind) && kind !== 'thanks');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    // Alan başına doğrulama; düğme devre dışı bırakılmaz, ilk hatalı alana odaklanılır
    const bad = fields.filter((f) => !validateField(f));
    if (bad.length) {
      setStatus(null);
      bad[0].input.focus();
      return;
    }
    busy = true;
    // Devre dışı kalan düğme odağı bırakır; klavyeyle gönderildiyse iş bitince odak düğmeye geri verilir
    const hadFocus = document.activeElement === submitBtn;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    retext();
    let result;
    try {
      result = await guestbook.submit({ name: nameInput.value.trim(), message: msgInput.value.trim() });
    } catch {
      result = { ok: false, reason: 'offline' };
    }
    busy = false;
    submitBtn.disabled = false;
    submitBtn.removeAttribute('aria-busy');
    if (!alive) return;
    if (hadFocus && submitBtn.isConnected && (!document.activeElement || document.activeElement === document.body)) {
      submitBtn.focus({ preventScroll: true });
    }
    if (result && result.ok) {
      nameInput.value = '';
      msgInput.value = '';
      for (const f of fields) showError(f, null);
      setStatus('thanks');
      sfx('secret');
    } else {
      const reason = result && ['link', 'rate', 'offline'].includes(result.reason) ? result.reason : 'offline';
      setStatus(reason);
    }
    retext();
  });

  // Alan terk edilince doğrula; düzelince hata kalkar
  for (const f of fields) {
    f.input.addEventListener('blur', () => {
      if (f.input.value || errors[f.key]) validateField(f);
    });
    f.input.addEventListener('input', () => {
      if (errors[f.key] && !f.bad()) showError(f, null);
    });
  }

  // Yazmaya başlayınca eski durum mesajı silinsin; bağlantı uyarısı yazarken de çıksın
  const onInput = () => {
    if (statusKind && statusKind !== 'link') setStatus(null);
    if (hasLink(nameInput.value) || hasLink(msgInput.value)) {
      if (statusKind !== 'link') setStatus('link'); // her tuşta yeniden duyurulmasın
    }
    else if (statusKind === 'link') setStatus(null);
  };
  nameInput.addEventListener('input', onInput);
  msgInput.addEventListener('input', onInput);

  retext();
  return {
    node: form,
    retext,
    focus: () => nameInput.focus({ preventScroll: true }),
    dispose() {
      alive = false;
    },
  };
}

// ---------- Odadaki defter paneli ----------

let started = false;

export function initGuestbook() {
  if (started) return;
  const root = document.getElementById('ui');
  if (!root) return;
  started = true;

  const titleEl = el('h2', { class: 'gb-title', id: 'gb-title' });
  const closeBtn = el('button', { type: 'button', class: 'gb-x', onclick: () => close() }, '✕');
  const listEl = el('div', { class: 'gb-list', 'aria-live': 'polite', tabindex: '-1' });
  const prevBtn = el('button', { type: 'button', class: 'gb-btn gb-arrow', onclick: (e) => { blurIfPointer(e); turn(-1); } }, '◄');
  const nextBtn = el('button', { type: 'button', class: 'gb-btn gb-arrow', onclick: (e) => { blurIfPointer(e); turn(1); } }, '►');
  const pageNo = el('span', { class: 'gb-pageno' });
  const pager = el('div', { class: 'gb-pager' }, prevBtn, pageNo, nextBtn);
  const flipBtn = el('button', { type: 'button', class: 'gb-btn gb-flip', onclick: (e) => { blurIfPointer(e); setView(book.dataset.view === 'write' ? 'read' : 'write'); } });
  const formTitle = el('h3', { class: 'gb-sub' });
  const form = createForm();

  const leftPage = el('section', { class: 'gb-page gb-page--read' }, titleEl, listEl, pager);
  const rightPage = el('section', { class: 'gb-page gb-page--write' }, formTitle, form.node);
  const book = el('div', { class: 'gb-book', 'data-view': 'read' }, leftPage, rightPage);
  const wrap = el(
    'div',
    { class: 'gb-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gb-title' },
    closeBtn,
    book,
    flipBtn,
  );
  const layer = el('div', { class: 'gb-layer', hidden: true }, wrap);
  root.append(layer);

  // Mesajlar odak yazarken oyuna gitmesin (form kendi dinleyicisini taşır)
  for (const type of ['keydown', 'keyup']) {
    layer.addEventListener(type, (event) => {
      if (event.key !== 'Escape') event.stopPropagation();
    });
  }

  let isOpen = false;
  let openedAt = 0;
  let lastFocus = null;
  let found = false;
  let entries = null; // null: yükleniyor
  let failed = false; // okuma hatası
  let page = 0;
  let token = 0;

  const guarded = () => performance.now() - openedAt < GUARD_MS;
  const pages = () => Math.max(1, Math.ceil((entries ? entries.length : 0) / PER_PAGE));

  function setView(view) {
    book.dataset.view = view;
    flipBtn.textContent = pick(view === 'write' ? T.toRead : T.toWrite);
    if (view === 'write') form.focus();
  }

  function renderList() {
    listEl.replaceChildren();
    listEl.setAttribute('aria-busy', entries || failed ? 'false' : 'true');
    if (failed) {
      listEl.append(errorNode(load));
    } else if (!entries) {
      listEl.append(
        el('p', { class: 'gb-loading', text: pick(T.loading) }),
        el('div', { class: 'gb-skel', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
      );
    } else if (entries.length === 0) {
      listEl.append(emptyNode());
    } else {
      page = Math.min(page, pages() - 1);
      for (const entry of entries.slice(page * PER_PAGE, (page + 1) * PER_PAGE)) listEl.append(entryNode(entry, 'gb-entry'));
    }
    const total = pages();
    pageNo.textContent = `${entries && entries.length ? page + 1 : 1}/${total}`;
    prevBtn.disabled = !entries || page <= 0;
    nextBtn.disabled = !entries || page >= total - 1;
    pager.hidden = failed || Boolean(entries && entries.length === 0);
  }

  function renderText() {
    titleEl.textContent = pick(T.title);
    formTitle.textContent = pick(T.formTitle);
    closeBtn.setAttribute('aria-label', pick(T.close));
    closeBtn.title = pick(T.close);
    prevBtn.setAttribute('aria-label', pick(T.prev));
    nextBtn.setAttribute('aria-label', pick(T.next));
    flipBtn.textContent = pick(book.dataset.view === 'write' ? T.toRead : T.toWrite);
    form.retext();
    renderList();
  }

  // Sayfa çevirme: kısa animasyon (reduced-motion’da yok) + blip
  function turn(dir) {
    const next = page + dir;
    if (!entries || next < 0 || next >= pages()) return;
    page = next;
    sfx('blip');
    renderList();
    if (!reducedMotion()) {
      listEl.classList.remove('is-next', 'is-prev');
      void listEl.offsetWidth; // animasyonu yeniden başlat
      listEl.classList.add(dir > 0 ? 'is-next' : 'is-prev');
    }
  }

  function focusables() {
    return [...layer.querySelectorAll('button, input, textarea, a[href]')].filter((n) => !n.disabled && n.offsetParent !== null);
  }

  function onKey(event) {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!guarded()) close();
    } else if (event.key === 'Tab') {
      // odak tuzağı
      const list = focusables();
      if (!list.length) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (!layer.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  window.addEventListener('keydown', onKey, true);

  layer.addEventListener('click', (event) => {
    if (guarded()) return;
    // “Tekrar dene” tıklanınca liste yeniden çizilir ve düğme DOM’dan çıkar; kopmuş hedef "dışarı" sayılmasın
    if (!(event.target instanceof Node) || !event.target.isConnected) return;
    if (!wrap.contains(event.target)) close();
  });

  // Ekran klavyesi: görünür alan (visualViewport) küçülünce katman ona uyar, odaktaki alan/gönder düğmesi kaydırılır.
  // visualViewport yoksa ya da klavye açık değilse hiçbir şey yazılmaz (eski davranış).
  const vv = window.visualViewport || null;
  let vvTimer = null;
  function syncViewport() {
    if (!isOpen || !vv) return;
    const shrunk = window.innerHeight - vv.height > 80;
    if (shrunk) {
      layer.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      layer.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`);
    } else {
      layer.style.removeProperty('--vvh');
      layer.style.removeProperty('--vvt');
    }
    if (shrunk) revealFocused();
  }
  function revealFocused() {
    clearTimeout(vvTimer);
    vvTimer = setTimeout(() => {
      const active = document.activeElement;
      if (!isOpen || !(active instanceof HTMLElement) || !form.node.contains(active)) return;
      active.scrollIntoView({ block: 'nearest' });
      const submit = form.node.querySelector('button[type="submit"]');
      if (submit && active.tagName === 'TEXTAREA') submit.scrollIntoView({ block: 'nearest' });
    }, 250);
  }
  function watchViewport() {
    if (!vv) return;
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    syncViewport();
  }
  function unwatchViewport() {
    clearTimeout(vvTimer);
    layer.style.removeProperty('--vvh');
    layer.style.removeProperty('--vvt');
    if (!vv) return;
    vv.removeEventListener('resize', syncViewport);
    vv.removeEventListener('scroll', syncViewport);
  }
  layer.addEventListener('focusin', (event) => {
    // Yalnızca dokunmatikte (ekran klavyesi olabilir); masaüstünde odak davranışı değişmez
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse && event.target instanceof HTMLElement && form.node.contains(event.target)) revealFocused();
  });

  function open() {
    if (isOpen) return;
    isOpen = true;
    openedAt = performance.now();
    lastFocus = document.activeElement;
    entries = null;
    page = 0;
    book.dataset.view = 'read';
    renderText();
    layer.hidden = false;
    setLock('overlay', true);
    watchViewport();
    form.focus();
    if (!found) {
      found = true;
      emit('secret:found', { id: 'guestbook' });
    }
    load();
  }

  // Listeyi (yeniden) yükler; hata ile boş defter ayrı gösterilir
  function load(byUser = false) {
    entries = null;
    failed = false;
    renderList();
    const mine = (token += 1);
    loadApproved().then((list) => {
      if (mine !== token || !isOpen) return;
      failed = list === null;
      entries = failed ? null : list;
      renderList();
      if (byUser === true) refocusAfterRetry(listEl, failed);
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    token += 1;
    unwatchViewport();
    layer.hidden = true;
    setLock('overlay', false);
    if (lastFocus instanceof HTMLElement && lastFocus !== document.body && lastFocus.isConnected) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
    emit('overlay:closed', { id: 'guestbook' });
  }

  on('overlay:open', (detail) => {
    if (detail && detail.id === 'guestbook') open();
  });
  on('lang:changed', renderText);
  renderText();
  return open;
}

// ---------- Klasik görünüm bölümü ----------

// Önceki dinleyicileri temizleyen bir dispose döndürür (classic.js yeniden çizerken çağırır).
export function mountGuestbookSection(container) {
  if (!container) return () => {};
  let entries = null;
  let failed = false;
  let shown = CARD_STEP;
  let alive = true;

  const form = createForm();
  const formTitle = el('h3', { class: 'gb-sub' });
  const grid = el('div', { class: 'gb-cards', role: 'list', 'aria-label': pick(T.list), tabindex: '-1' });
  const moreBtn = el('button', {
    type: 'button',
    class: 'gb-btn',
    onclick: () => {
      shown += CARD_STEP;
      renderCards();
    },
  });
  const moreRow = el('div', { class: 'gb-more' }, moreBtn);
  // Boş durum: kısa davet solda, form sağda (formbox.is-split)
  const inviteTitle = el('strong', { class: 'gb-invite-title' });
  const inviteText = el('p', { class: 'gb-invite-text' });
  const invite = el(
    'div',
    { class: 'gb-invite', hidden: true },
    el('span', { class: 'gb-invite-icon', 'aria-hidden': 'true' }),
    inviteTitle,
    inviteText,
  );
  const formPane = el('div', { class: 'gb-formpane' }, formTitle, form.node);
  const formBox = el('div', { class: 'gb-formbox', tabindex: '-1' }, invite, formPane);
  container.replaceChildren(grid, moreRow, formBox);

  function setSplit(on) {
    formBox.classList.toggle('is-split', on);
    invite.hidden = !on;
    formTitle.hidden = on;
    grid.hidden = on;
  }

  function renderCards() {
    grid.replaceChildren();
    grid.setAttribute('aria-label', pick(T.list));
    inviteTitle.textContent = pick(T.emptyTitle);
    inviteText.textContent = pick(T.emptyText);
    if (failed) {
      setSplit(false);
      grid.append(errorNode(load));
      moreRow.hidden = true;
      return;
    }
    if (!entries) {
      setSplit(false);
      grid.append(el('p', { class: 'gb-loading', text: pick(T.loading) }));
      moreRow.hidden = true;
      return;
    }
    if (entries.length === 0) {
      setSplit(true);
      moreRow.hidden = true;
      return;
    }
    setSplit(false);
    for (const entry of entries.slice(0, shown)) {
      const card = entryNode(entry, 'gb-card');
      card.setAttribute('role', 'listitem');
      grid.append(card);
    }
    moreBtn.textContent = pick(T.more);
    moreRow.hidden = entries.length <= shown;
  }

  function renderText() {
    formTitle.textContent = pick(T.formTitle);
    form.retext();
    renderCards();
  }

  const off = on('lang:changed', renderText);
  function load(byUser = false) {
    entries = null;
    failed = false;
    renderCards();
    loadApproved().then((list) => {
      if (!alive) return;
      failed = list === null;
      entries = failed ? null : list;
      renderCards();
      if (byUser === true) refocusAfterRetry(grid, failed, formBox);
    });
  }

  renderText();
  load();

  return () => {
    alive = false;
    off();
    form.dispose();
  };
}

