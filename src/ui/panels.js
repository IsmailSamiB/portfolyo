import { emit, on, SECTIONS } from '../bridge.js';
import { pick } from '../i18n.js';
import S from './strings.js';
import { el } from './dom.js';
import { setLock } from './lock.js';
import { renderers } from './sections.js';

const BACKDROP_GUARD_MS = 300; // açılışı tetikleyen dokunuşun "hayalet tıklaması" paneli kapatmasın

export function createPanels(root) {
  const titleEl = el('h2', { class: 'panel-title', id: 'panel-title' });
  const tourBtn = el('button', {
    type: 'button',
    class: 'bar-btn bar-btn--text',
    hidden: true,
    onclick: () => emit('tour:stop', {}),
  });
  const closeBtn = el('button', { type: 'button', class: 'bar-btn', onclick: () => close() }, '✕');
  const body = el('div', { class: 'panel-body', tabindex: '0', role: 'region', 'aria-labelledby': 'panel-title' });
  const win = el(
    'div',
    { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'panel-title' },
    el('header', { class: 'panel-bar' }, titleEl, tourBtn, closeBtn),
    body,
  );
  const layer = el('div', { class: 'panel-layer', hidden: true }, win);
  root.append(layer);

  let current = null; // { id, tour, state }
  let lastFocus = null;
  let openedAt = 0;

  function render(keepScroll) {
    if (!current) return;
    const scroll = keepScroll ? body.scrollTop : 0;
    titleEl.textContent = pick(S.panels[current.id]);
    closeBtn.setAttribute('aria-label', pick(S.panels.close));
    closeBtn.title = pick(S.panels.close);
    tourBtn.textContent = pick(S.panels.stopTour);
    tourBtn.hidden = !current.tour;
    win.classList.toggle('is-tour', current.tour);
    win.dataset.panel = current.id;
    body.className = `panel-body panel-body--${current.id}`;
    const ctx = { state: current.state, tour: current.tour, refresh: () => render(true) };
    body.replaceChildren(renderers[current.id](ctx));
    body.scrollTop = scroll;
    // Bölümün istediği odak (ör. açılan proje penceresi).
    const target = body.querySelector('[data-focus-me]');
    if (target) target.focus({ preventScroll: true });
    current.state.focus = null;
  }

  function open(id, tour) {
    if (!SECTIONS.includes(id) || !renderers[id]) return;
    if (current && current.id === id) {
      current.tour = Boolean(tour);
      if (current.tour) current.state.tab = 0; // turda ilk sekme açık kalır
      render(true);
      return;
    }
    const switching = Boolean(current);
    if (switching) close({ switching: true });
    else lastFocus = document.activeElement;
    current = { id, tour: Boolean(tour), state: {} };
    openedAt = performance.now();
    layer.hidden = false;
    setLock('panel', true);
    render(false);
    body.focus({ preventScroll: true });
  }

  function close(options) {
    if (!current) return;
    const switching = Boolean(options && options.switching);
    const id = current.id;
    // Bölümün zamanlayıcı vb. kaynaklarını temizle
    if (typeof current.state.dispose === 'function') current.state.dispose();
    current = null;
    if (!switching) {
      layer.hidden = true;
      body.replaceChildren();
      if (lastFocus instanceof HTMLElement && lastFocus !== document.body && lastFocus.isConnected) {
        lastFocus.focus({ preventScroll: true });
      }
      lastFocus = null;
    }
    emit('panel:closed', { id });
    // Dinleyici aynı anda başka panel açmış olabilir; güncel duruma göre kilidi ayarla.
    if (!switching) setLock('panel', current !== null);
  }

  function focusables() {
    const nodes = win.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    // tabIndex < 0: sekme çubuğundaki seçili olmayan sekmeler (Tab ile gezilmez); listede kalırsa "son öğe" yanlış
    // hesaplanır ve odak panelin arkasındaki HUD'a kaçar.
    return Array.from(nodes).filter(
      (node) => node.tabIndex >= 0 && !node.closest('[inert]') && !node.closest('[hidden]') && node.getClientRects().length > 0,
    );
  }

  // Odak panelin dışına kaçmasın.
  function trapTab(event) {
    const list = focusables();
    if (!list.length) {
      event.preventDefault();
      body.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (!win.contains(active)) {
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

  function onKey(event) {
    if (!current) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      const handler = current.state.onEscape;
      if (typeof handler === 'function' && handler()) return;
      close();
    } else if (event.key === 'Tab') {
      trapTab(event);
    }
  }

  layer.addEventListener('click', (event) => {
    if (event.target !== layer) return;
    if (performance.now() - openedAt < BACKDROP_GUARD_MS) return;
    close();
  });
  window.addEventListener('keydown', onKey);

  on('panel:open', (detail) => open(detail && detail.id, detail && detail.tour));
  on('panel:close', (detail) => {
    if (!current) return;
    if (detail && detail.id && detail.id !== current.id) return;
    close();
  });
  on('lang:changed', () => render(true));

  return { open, close: () => close(), currentId: () => (current ? current.id : null) };
}
