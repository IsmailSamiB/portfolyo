// Anonim kullanım metrikleri: köprü olaylarını dinler ve store.track ile kuyruğa yazar.
import { on } from '../bridge.js';
import { track, flush, isRemote } from './store.js';

let started = false;

function currentMode() {
  return document.body.classList.contains('is-classic') ? 'classic' : 'game';
}

export function initMetrics() {
  if (started) return;
  started = true;

  try {
    // Yönetici panelindeki gezinme gerçek veriyi kirletmesin (yerel denemede serbest)
    if (isRemote() && new URLSearchParams(window.location.search).has('admin')) return;
  } catch {}

  // ---- Oturum süresi: yalnızca sekmenin görünür olduğu saniyeler ----
  let visibleSince = document.visibilityState === 'hidden' ? null : Date.now();
  let visibleMs = 0;
  let lastLeave = -1;

  function leave() {
    if (visibleSince != null) {
      visibleMs += Date.now() - visibleSince;
      visibleSince = null;
    }
    const seconds = Math.min(1000000, Math.max(0, Math.round(visibleMs / 1000)));
    // Aynı kapanışta hem visibilitychange hem pagehide gelir; aynı değeri iki kez yazma
    if (seconds !== lastLeave) {
      lastLeave = seconds;
      track('leave', { seconds });
    }
    flush(true);
  }

  // Bu dinleyiciler ilk track çağrısından ÖNCE eklenir: 'leave' kuyruğa girmeden gönderim başlamasın.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave();
    else if (visibleSince == null) visibleSince = Date.now();
  });
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', () => {
    if (visibleSince == null && document.visibilityState !== 'hidden') visibleSince = Date.now();
  });

  track('visit', {});

  // ---- Köprü olayları ----
  on('panel:open', ({ id, tour } = {}) => track('panel', { id: String(id ?? ''), tour: Boolean(tour) }));
  on('interact', ({ id } = {}) => track('interact', { id: String(id ?? '') }));
  on('overlay:open', ({ id } = {}) => track('overlay', { id: String(id ?? '') }));
  on('tour:state', ({ active } = {}) => track('tour', { active: Boolean(active) }));
  on('lang:changed', ({ lang } = {}) => track('lang', { lang: String(lang ?? '') }));

  const secrets = new Set();
  on('secret:found', ({ id } = {}) => {
    const key = String(id ?? '');
    if (!key || secrets.has(key)) return;
    secrets.add(key);
    track('secret', { id: key });
  });

  // ---- Klasik görünüme geçiş / dönüş ----
  let mode = currentMode();
  try {
    new MutationObserver(() => {
      const next = currentMode();
      if (next === mode) return;
      mode = next;
      track('mode', { mode });
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } catch {}

  // ---- CV indirme ve dış bağlantılar ----
  document.addEventListener(
    'click',
    (event) => {
      try {
        const target = event.target instanceof Element ? event.target.closest('a') : null;
        if (!target) return;
        if (target.hasAttribute('download')) {
          track('cv', {});
          return;
        }
        if (target.getAttribute('target') === '_blank') {
          const url = new URL(target.href, window.location.href);
          // Sorgu dizgisi bilerek alınmaz; mailto/tel için yalnızca şema yazılır
          if (/^https?:$/.test(url.protocol)) track('link', { host: url.host, path: url.pathname.slice(0, 60) });
          else track('link', { host: url.protocol.replace(':', ''), path: '' });
        }
      } catch {}
    },
    true,
  );
}

// Mini oyun bittiğinde çağrılır.
export function trackGame(score) {
  const value = Number(score);
  track('game', { score: Number.isFinite(value) ? Math.round(value) : 0 });
}
