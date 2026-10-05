import content from './content.js';

// Projeler her yerde aynı sırayla görünsün: tarihe göre, yeniden eskiye.
export function sortedProjects() {
  return [...(content.projects || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

const MONTHS = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

// '2026-09-26' -> 'Eyl 2026' / 'Sep 2026'
export function projectDate(date, lang = 'tr') {
  const [year, month] = String(date || '').split('-');
  const name = (MONTHS[lang] || MONTHS.en)[Number(month) - 1];
  return name ? `${name} ${year}` : year || '';
}
