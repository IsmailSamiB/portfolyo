import './guestbook.css';
import { emit, on } from '../bridge.js';
import { lang, pick } from '../i18n.js';
import { guestbook } from '../data/store.js';
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
  page: { tr: 'Sayfa', en: 'Page' },
  loading: { tr: 'Defter açılıyor…', en: 'Opening the guestbook…' },
  emptyTitle: { tr: 'İlk yazan sen ol', en: 'Be the first to write' },
  emptyText: {
    tr: 'Bu sayfalar henüz boş. Bir selam bırak, defterin ilk satırı senin olsun.',
    en: 'These pages are still blank. Leave a hello and make the first line yours.',
  },
  formTitle: { tr: 'Bir not bırak', en: 'Leave a note' },
  name: { tr: 'Adın', en: 'Your name' },
  message: { tr: 'Mesajın', en: 'Your message' },
  submit: { tr: 'Deftere yaz', en: 'Sign the guestbook' },
  sending: { tr: 'Yazılıyor…', en: 'Writing…' },
  toWrite: { tr: 'Yaz', en: 'Write' },
  toRead: { tr: 'Oku', en: 'Read' },
  more: { tr: 'Daha fazla göster', en: 'Show more' },
  list: { tr: 'Onaylı mesajlar', en: 'Approved messages' },
  thanks: { tr: 'Teşekkürler! Mesajın onaydan sonra görünecek.', en: 'Thank you! Your message will appear after approval.' },
  invalid: { tr: 'Ad ve en az 3 karakterlik bir mesaj yaz', en: 'Enter a name and a message of at least 3 characters' },
  link: { tr: 'Bağlantı içeren mesajlar kabul edilmiyor', en: 'Messages containing links are not accepted' },
  rate: { tr: 'Biraz bekleyip tekrar dene', en: 'Wait a bit and try again' },
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

// listApproved hatasında boş liste gibi davran
async function loadApproved() {
  try {
    const list = await guestbook.listApproved();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
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
  let statusKind = null; // 'ok' | 'thanks' hata nedeni
  let alive = true;

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
  const counter = el('span', { class: 'gb-count', id: `${id}-count`, 'aria-hidden': 'true' });
  const status = el('p', { class: 'gb-status', role: 'status', 'aria-live': 'polite' });
  const submitBtn = el('button', { type: 'submit', class: 'gb-btn gb-btn--accent' });
  const form = el(
    'form',
    { class: 'gb-form', novalidate: true },
    el('div', { class: 'gb-field' }, nameLabel, nameInput),
    el('div', { class: 'gb-field' }, el('div', { class: 'gb-label-row' }, msgLabel, counter), msgInput),
    submitBtn,
    status,
  );

  // Yazarken oyun tuşları (E, Boşluk, WASD) oyuna gitmesin
  for (const type of ['keydown', 'keyup']) {
    form.addEventListener(type, (event) => {
      if (event.key === 'Escape') return;
      event.stopPropagation();
    });
  }

  function updateCount() {
    counter.textContent = `${msgInput.value.length}/${MSG_MAX}`;
  }
  msgInput.addEventListener('input', updateCount);

  function retext() {
    nameLabel.textContent = pick(T.name);
    msgLabel.textContent = pick(T.message);
    submitBtn.textContent = pick(busy ? T.sending : T.submit);
    if (statusKind) {
      status.textContent = pick(T[statusKind]);
    }
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
    busy = true;
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
    if (result && result.ok) {
      nameInput.value = '';
      msgInput.value = '';
      setStatus('thanks');
      sfx('secret');
    } else {
      const reason = result && T[result.reason] && ['invalid', 'link', 'rate', 'offline'].includes(result.reason) ? result.reason : 'offline';
      setStatus(reason);
    }
    retext();
  });

  // Yazmaya başlayınca eski durum mesajı silinsin
  const clearStatus = () => {
    if (statusKind) setStatus(null);
  };
  nameInput.addEventListener('input', clearStatus);
  msgInput.addEventListener('input', clearStatus);

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
  const listEl = el('div', { class: 'gb-list', 'aria-live': 'polite' });
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
    listEl.setAttribute('aria-busy', entries ? 'false' : 'true');
    if (!entries) {
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
    pager.hidden = Boolean(entries && entries.length === 0);
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
    const mine = (token += 1);
    loadApproved().then((list) => {
      if (mine !== token || !isOpen) return;
      entries = list;
      renderList();
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
  let shown = CARD_STEP;
  let alive = true;

  const form = createForm();
  const formTitle = el('h3', { class: 'gb-sub' });
  const grid = el('div', { class: 'gb-cards', role: 'list', 'aria-label': pick(T.list) });
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
  const formBox = el('div', { class: 'gb-formbox' }, invite, formPane);
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
  renderText();
  loadApproved().then((list) => {
    if (!alive) return;
    entries = list;
    renderCards();
  });

  return () => {
    alive = false;
    off();
    form.dispose();
  };
}

