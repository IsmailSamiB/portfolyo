import { emit, on } from '../bridge.js';
import { pick } from '../i18n.js';
import S from './strings.js';
import { el, reducedMotion } from './dom.js';
import { setLock } from './lock.js';

const CHAR_MS = 24; // daktilo hızı
const GUARD_MS = 200; // açılıştan hemen sonraki girdiyi yoksay

export function createDialog(root) {
  // Kutunun dışına tıklamayı da yakalayan saydam katman (HUD'ın altında kalır).
  const catcher = el('div', { class: 'dialog-catcher', hidden: true });
  const speakerEl = el('div', { class: 'dialog-speaker', hidden: true });
  const shownEl = el('span');
  const restEl = el('span', { class: 'dialog-rest' }); // satır kaymasın diye görünmez kalan kısım
  const textEl = el('p', { class: 'dialog-text', 'aria-hidden': 'true' }, shownEl, restEl);
  const liveEl = el('p', { class: 'sr-only', 'aria-live': 'polite' });
  const moreEl = el('span', { class: 'dialog-more', 'aria-hidden': 'true', text: '▼' });
  const box = el('div', { class: 'dialog-box', hidden: true, role: 'group' }, speakerEl, textEl, liveEl, moreEl);
  root.append(catcher, box);

  let open = false;
  let lines = [];
  let index = 0;
  let chars = [];
  let pos = 0;
  let timer = null;
  let openedAt = 0;

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function paint() {
    shownEl.textContent = chars.slice(0, pos).join('');
    restEl.textContent = chars.slice(pos).join('');
    box.classList.toggle('is-typing', pos < chars.length);
  }

  function startLine() {
    stopTimer();
    const line = lines[index];
    chars = Array.from(line);
    liveEl.textContent = line;
    pos = reducedMotion() ? chars.length : 0;
    paint();
    if (pos >= chars.length) return;
    timer = setInterval(() => {
      pos += 1;
      paint();
      if (pos >= chars.length) stopTimer();
    }, CHAR_MS);
  }

  function show(detail) {
    const raw = detail && detail.lines;
    const next = (Array.isArray(raw) ? raw : [raw])
      .filter((line) => line != null && String(line).trim() !== '')
      .map(String);
    if (!next.length) {
      // Boş diyalog: oyun beklemede kalmasın.
      if (open) close();
      else emit('dialog:closed', {});
      return;
    }
    lines = next;
    index = 0;
    const speaker = detail.speaker ? String(detail.speaker) : '';
    speakerEl.textContent = speaker;
    speakerEl.hidden = !speaker;
    box.title = pick(S.dialog.next);
    box.setAttribute('aria-label', pick(S.dialog.next));
    open = true;
    openedAt = performance.now();
    catcher.hidden = false;
    box.hidden = false;
    setLock('dialog', true);
    startLine();
  }

  function close() {
    if (!open) return;
    open = false;
    stopTimer();
    box.hidden = true;
    catcher.hidden = true;
    emit('dialog:closed', {});
    // Dinleyici aynı anda yeni diyalog açmış olabilir; güncel duruma göre kilidi ayarla.
    setLock('dialog', open);
  }

  function advance() {
    if (!open) return;
    if (performance.now() - openedAt < GUARD_MS) return;
    if (pos < chars.length) {
      stopTimer();
      pos = chars.length;
      paint();
    } else if (index < lines.length - 1) {
      index += 1;
      startLine();
    } else {
      close();
    }
  }

  function onKey(event) {
    if (!open) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const isE = event.code === 'KeyE' || event.key === 'e' || event.key === 'E';
    const isAdvance = isE || event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter';
    if (!isAdvance) return;
    // Odaktaki düğme/bağlantının kendi Enter/Boşluk davranışını bozma.
    const target = event.target;
    const interactive = target instanceof Element && target.closest('a, button, input, textarea, select');
    if (interactive && !isE) return;
    event.preventDefault();
    if (event.repeat) return;
    advance();
  }

  box.addEventListener('click', advance);
  catcher.addEventListener('click', advance);
  window.addEventListener('keydown', onKey);

  on('dialog:show', show);
  on('lang:changed', () => {
    box.title = pick(S.dialog.next);
    box.setAttribute('aria-label', pick(S.dialog.next));
  });

  return { close, isOpen: () => open };
}
