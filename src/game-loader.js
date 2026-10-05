// Oyun parçasını (Phaser + sahneler) ilk yükten ayırır: import() ile arkadan yüklenir.
// Bu modül yüklenirken yan etki yoktur; her şey ilk loadGame() çağrısında başlar.

let promise = null;
let ready = false;
let progress = 0; // 0..1
const listeners = new Set();

function setProgress(value) {
  const next = Math.max(progress, Math.min(1, value));
  if (next === progress) return;
  progress = next;
  listeners.forEach((fn) => fn(progress));
}

// Tuval kabı 0x0 iken (sekme arka planda açıldığında) WebGL çerçeve arabelleği kurulamıyor:
// belge görünür ve #game ölçülü olana kadar bekle.
function stageReady() {
  const node = document.getElementById('game');
  const ok = () => document.visibilityState === 'visible' && Boolean(node) && node.clientWidth > 0 && node.clientHeight > 0;
  return new Promise((resolve) => {
    if (!node || ok()) {
      resolve();
      return;
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => check()) : null;
    function check() {
      if (!ok()) return;
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('resize', check);
      if (observer) observer.disconnect();
      resolve();
    }
    document.addEventListener('visibilitychange', check);
    window.addEventListener('resize', check);
    if (observer) observer.observe(node);
  });
}

// Oda sahnesi hazır olduğunda çözülen söz. Tekrar çağrılınca aynı sözü verir.
// Yükleme başarısız olursa da çözülür (arayüz kilitli kalmasın); hata konsola yazılır.
export function loadGame() {
  if (promise) return promise;
  const chunk = import('./game.js');
  chunk.then(() => setProgress(0.3)).catch(() => {});
  promise = Promise.all([chunk, stageReady()])
    .then(([m]) => {
      // Parça %30, görseller kalan %70
      const { game, ready: roomReady } = m.startGame({ onProgress: (p) => setProgress(0.3 + p * 0.7) });
      // Geliştirme sırasında konsoldan erişim için
      if (import.meta.env.DEV) window.__game = game;
      return roomReady;
    })
    .catch((err) => {
      console.error('[game] yüklenemedi', err);
    })
    .then(() => {
      ready = true;
      setProgress(1);
    });
  return promise;
}

export function isGameReady() {
  return ready;
}

// fn(0..1); aboneliği kaldıran fonksiyonu döndürür.
export function onGameProgress(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// İlk boyamayı geciktirmemek için yüklemeyi tarayıcı boşa çıkınca başlatır; loadGame() ile aynı sözü verir.
export function loadGameWhenIdle() {
  if (promise) return promise;
  return new Promise((resolve) => {
    const run = () => resolve(loadGame());
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 600 });
    else setTimeout(run, 1);
  });
}
