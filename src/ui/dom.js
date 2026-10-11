// Güvenli DOM yardımcıları: içerik her zaman metin düğümü olarak eklenir, innerHTML kullanılmaz.

const LAST_ATTRS = new Set(['src', 'srcset']);

export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  // src/srcset en sona yazılır: loading="lazy" gibi öznitelikler kaynaktan önce gelmezse görsel hemen indirilir.
  const entries = Object.entries(attrs || {}).sort(([a], [b]) => LAST_ATTRS.has(a) - LAST_ATTRS.has(b));
  for (const [key, value] of entries) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'style') node.style.cssText = String(value); // CSSOM: style özniteliği CSP'sine takılmaz
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (/^on/i.test(key)) continue; // dizgi değerli olay öznitelikleri yazılmaz
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

// Yalnızca zararsız şemalara izin ver (javascript: vb. engellenir). URL ayrıştırıcısı kullanılır:
// sekme/satır sonu ile gizlenmiş şemalar ve //alan.adi biçimleri de doğru çözülür. Göreli yollar
// document.baseURI'ye göre mutlak adrese çevrilir; sayfa içi '#...' bağlantıları olduğu gibi kalır.
export function safeUrl(url) {
  if (typeof url !== 'string') return '#';
  const value = url.trim();
  if (!value) return '#';
  if (value.startsWith('#')) return value;
  if (/^[\\/]{2}/.test(value)) return '#'; // //alan.adi (protokolsüz dış adres) kabul edilmez
  try {
    const u = new URL(value, document.baseURI);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.href : '#';
  } catch {
    return '#';
  }
}

// Yeni sekmede açılan dış bağlantı.
export function extLink(url, label, className) {
  return el('a', { class: className, href: safeUrl(url), target: '_blank', rel: 'noopener noreferrer', text: label });
}

// { tr, en } içinde dizi, dizi içinde { tr, en } ya da düz metin: hepsini paragraf listesine çevirir.
export function toParagraphs(value, pick) {
  if (Array.isArray(value)) return value.map((item) => String(pick(item))).filter(Boolean);
  const picked = pick(value);
  if (Array.isArray(picked)) return picked.map(String).filter(Boolean);
  return String(picked || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Fareyle tıklanan düğmede odak kalmasın; yoksa oyundaki Boşluk/Enter tuşu düğmeyi yeniden tetikler.
export function blurIfPointer(event) {
  if (event && event.detail > 0 && event.currentTarget instanceof HTMLElement) {
    event.currentTarget.blur();
  }
}
