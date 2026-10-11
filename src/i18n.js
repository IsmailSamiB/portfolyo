import { emit } from './bridge.js';

const KEY = 'lang';
const LANGS = ['tr', 'en'];

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {}
  return (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

// Belge başlığı ve oyun alanının erişilebilir adı dile göre güncellenir
const DOC_TITLE = { tr: 'İsmail Sami Başaraner · Portfolyo', en: 'İsmail Sami Başaraner · Portfolio' };
const GAME_LABEL = {
  tr: 'Oyun alanı: pixel art oda. Aynı içerik klasik görünümde.',
  en: 'Game area: a pixel art room. The same content is in the classic view.',
};

const DOC_DESC = {
  tr: 'Oyunlaştırılmış pixel art portfolyo: odamı gez, projelerimi keşfet.',
  en: 'A gamified pixel art portfolio: explore my room and discover my projects.',
};

// Yazdırma sırasında belge başlığı (PDF dosya adı olur); classic.js de bunu kullanır.
export const PRINT_TITLE = 'Ismail_Sami_Basaraner_CV';

let current = detect();
document.documentElement.lang = current;

// Geçerli dilin belge başlığı (classic.js yazdırma sonrası geri yüklemek için kullanır)
export function documentTitle() {
  return DOC_TITLE[current];
}

// Yazdırma sürerken classic.js başlığı geçici olarak değiştirir; başlığa dokunulmaz, geri kalanı güncellenir.
function syncDocument() {
  if (document.title !== PRINT_TITLE) document.title = DOC_TITLE[current];
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', DOC_DESC[current]);
  const game = document.getElementById('game');
  if (game) game.setAttribute('aria-label', GAME_LABEL[current]);
}
syncDocument();

export function lang() {
  return current;
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === current) return;
  current = next;
  document.documentElement.lang = current;
  syncDocument();
  try {
    localStorage.setItem(KEY, current);
  } catch {}
  emit('lang:changed', { lang: current });
}

// Tüm metinler { tr: '...', en: '...' } biçiminde tutulur; pick() geçerli dildekini verir.
export function pick(text) {
  if (text == null || typeof text !== 'object') return text ?? '';
  return text[current] ?? text.en ?? text.tr ?? '';
}
