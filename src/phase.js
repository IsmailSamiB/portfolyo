// Ziyaretçinin yerel saatine göre gün dilimi; ?time=day|evening|night ile denenebilir.
export function dayPhase() {
  const forced = new URLSearchParams(window.location.search).get('time');
  if (['day', 'evening', 'night'].includes(forced)) return forced;
  const h = new Date().getHours();
  if (h >= 20 || h < 6) return 'night';
  if (h >= 17) return 'evening';
  return 'day';
}
