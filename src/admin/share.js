// Başvuru linki aracı: şirket adından ?ref’li canlı adres + QR kodu üretir; istenirse bir projeye doğrudan açılır (&proje=<id>).
// Yalnızca yönetici parçasına girer (QR kütüphanesi ana pakete sızmaz).
import qrcode from 'qrcode-generator';
import { el } from '../ui/dom.js';
import { cleanRef, cleanProjectId } from '../content/game-text.js';
import { sortedProjects } from '../content/projects.js';

const BASE_URL = 'https://ismailsamib.github.io/portfolyo/';
const QUIET = 4; // standart sessiz bölge (modül)
const SHOW_SCALE = 8; // ekranda modül başına piksel
const PNG_MIN = 1024;

// project: içerikteki bir proje kimliği (isteğe bağlı); süzgeçten geçmeyen ya da içerikte olmayan değer eklenmez.
export function buildLink(name, classic, project) {
  const ref = cleanRef(name);
  const id = cleanProjectId(project);
  const parts = [];
  if (classic) parts.push('classic');
  if (ref) parts.push(`ref=${encodeURIComponent(ref)}`);
  if (id && sortedProjects().some((item) => item.id === id)) parts.push(`proje=${id}`);
  return { ref, url: parts.length ? `${BASE_URL}?${parts.join('&')}` : BASE_URL };
}

function makeQr(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr;
}

// Matrisi tam katlı ölçekle canvas’a çizer: beyaz zemin, koyu modüller, keskin kenar.
function paint(canvas, qr, scale) {
  const n = qr.getModuleCount();
  const size = (n + QUIET * 2) * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1b1208';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + QUIET) * scale, (r + QUIET) * scale, scale, scale);
    }
  }
  return size;
}

export function shareSection(section) {
  const input = el('input', {
    class: 'adm-input',
    id: 'adm-share-name',
    type: 'text',
    maxlength: 40,
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'ör. Türk Telekom',
  });
  const classicBox = el('input', { type: 'checkbox', id: 'adm-share-classic' });
  // Proje seçilirse link o projeye açılır: klasik görünümde karta gider, oyunda karşılamadan sonra penceresi açılır.
  const projectSelect = el(
    'select',
    { class: 'adm-input', id: 'adm-share-project' },
    el('option', { value: '', text: 'Proje yok' }),
    sortedProjects().map((item) => el('option', { value: item.id, text: (item.title && item.title.tr) || item.title || item.id })),
  );
  const preview = el('p', { class: 'adm-note', 'aria-live': 'polite' });
  const hint = el('p', { class: 'adm-note', hidden: true });
  const linkField = el('input', {
    class: 'adm-input',
    id: 'adm-share-link',
    type: 'text',
    readonly: true,
    spellcheck: 'false',
  });
  const copyState = el('span', { class: 'adm-share__state', role: 'status', 'aria-live': 'polite' });
  const canvas = el('canvas', { class: 'adm-share__qr', role: 'img' });
  let current = BASE_URL;
  let currentRef = '';
  let timer = 0;

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(current);
      ok = true;
    } catch {
      linkField.focus();
      linkField.select();
    }
    copyState.textContent = ok ? 'Kopyalandı' : 'Seçildi: Ctrl+C ile kopyala';
    clearTimeout(timer);
    timer = setTimeout(() => {
      copyState.textContent = '';
    }, 2000);
  }

  function download() {
    const qr = makeQr(current);
    const scale = Math.ceil(PNG_MIN / (qr.getModuleCount() + QUIET * 2));
    const big = document.createElement('canvas');
    paint(big, qr, scale);
    const slug = (currentRef || 'genel')
      .toLowerCase()
      .replace(/ı/g, 'i')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const a = document.createElement('a');
    a.download = `qr-${slug || 'genel'}.png`;
    a.href = big.toDataURL('image/png');
    document.body.append(a);
    a.click();
    a.remove();
  }

  function update() {
    const typed = input.value.trim().replace(/\s+/g, ' ');
    const { ref, url } = buildLink(input.value, classicBox.checked, projectSelect.value);
    current = url;
    currentRef = ref;
    linkField.value = url;
    if (ref) preview.textContent = `Sitede şöyle görünecek: Merhaba ${ref} ekibi!`;
    else preview.textContent = typed ? 'Ad sitede görünmeyecek; genel karşılama gösterilir.' : 'Ad yazılmazsa genel karşılama gösterilir.';
    const changed = Boolean(typed) && ref !== typed;
    hint.hidden = !changed;
    hint.textContent = changed ? 'En çok üç sözcük, 24 karakter; nokta ve özel işaretler çıkarılır.' : '';
    const qr = makeQr(url);
    paint(canvas, qr, SHOW_SCALE);
    canvas.style.width = `${canvas.width}px`;
    canvas.dataset.modules = String(qr.getModuleCount());
    canvas.setAttribute('aria-label', `${url} için QR kodu`);
  }

  input.addEventListener('input', update);
  classicBox.addEventListener('change', update);
  projectSelect.addEventListener('change', update);
  update();

  return section(
    'Başvuru linki',
    el('p', { class: 'adm-note', text: 'Şirket adına özel karşılama ve QR kodu üretir. Adres her zaman canlı siteyi gösterir.' }),
    el('div', { class: 'adm-share__row' }, el('label', { class: 'adm-label', for: 'adm-share-name', text: 'Şirket adı' }), input),
    preview,
    hint,
    el('label', { class: 'adm-share__check' }, classicBox, ' Doğrudan klasik görünümü aç'),
    el('div', { class: 'adm-share__row' }, el('label', { class: 'adm-label', for: 'adm-share-project', text: 'Proje' }), projectSelect),
    el('div', { class: 'adm-share__row' }, el('label', { class: 'adm-label', for: 'adm-share-link', text: 'Link' }), linkField),
    el(
      'div',
      { class: 'adm-share__actions' },
      el('button', { class: 'adm-btn adm-btn--accent', type: 'button', text: 'Kopyala', onClick: copy }),
      el('button', { class: 'adm-btn', type: 'button', text: 'PNG indir', onClick: download }),
      copyState,
    ),
    el('div', { class: 'adm-share__qrbox' }, canvas),
  );
}
