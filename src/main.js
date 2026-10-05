import './style.css';
import { on, emit } from './bridge.js';
import { initUI } from './ui/index.js';
import { setLock } from './ui/lock.js';
import { initMetrics } from './data/metrics.js';

// Başka bir sitenin çerçevesi içinde açıldıysa çizme (clickjacking)
const framed = window.top !== window.self;
if (framed) {
  try {
    window.top.location = window.location.href;
  } catch {}
  document.documentElement.hidden = true;
}

const params = new URLSearchParams(window.location.search);

// Tembel ek paneller: modül ilk 'overlay:open' olayında yüklenir. init… kendi dinleyicisini kurar ve
// açma fonksiyonunu döndürür; ilk açılış onunla yapılır (olay yeniden yayılmaz: ses/metrik iki kez çalışmasın).
const lazyOverlays = {
  piano: () => import('./ui/piano.js').then((m) => m.initPiano()),
  view: () => import('./ui/view.js').then((m) => m.initView()),
  postcard: () => import('./ui/view.js').then((m) => m.initView('postcard')),
  guestbook: () => import('./ui/guestbook.js').then((m) => m.initGuestbook()),
  minigame: () => import('./ui/minigame.js').then((m) => m.initMinigame()),
};

function initLazyOverlays() {
  on('overlay:open', ({ id } = {}) => {
    const load = lazyOverlays[id];
    if (!load) return; // yüklendiyse modülün kendi dinleyicisi açar
    delete lazyOverlays[id];
    // Parça inerken oyun girdisi dursun (panel de aynı kilidi kullanır)
    setLock('overlay', true);
    load()
      .then((open) => {
        if (typeof open !== 'function') throw new Error(`overlay: ${id}`);
        open();
      })
      .catch((err) => {
        console.error('[overlay] yüklenemedi', err);
        lazyOverlays[id] = load; // bir sonraki denemede yeniden yüklensin
        setLock('overlay', false);
        emit('overlay:closed', { id });
      });
  });
}

// Arayüz (açılış ekranı ya da ?classic) senkron çizilir; oyun parçasını arayüz kendisi ister (game-loader.js).
if (!framed) {
  initUI();
  initLazyOverlays();
  initMetrics();
}

// Yönetici paneli: yalnızca ?admin ile, ayrı parça olarak yüklenir
if (!framed && params.has('admin')) import('./admin/index.js').then((m) => m.initAdmin());
