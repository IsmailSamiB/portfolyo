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

let current = detect();
document.documentElement.lang = current;

export function lang() {
  return current;
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === current) return;
  current = next;
  document.documentElement.lang = current;
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
