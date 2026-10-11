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

// Oyun görselleri motor inip çalışmaya başlayınca istenir; aynı dosyaları şimdiden önbelleğe almak
// (motorla aynı anda indirmek) bekleme süresini kısaltır. Liste BootScene.preload ile aynıdır.
const GAME_ASSETS = ['assets/sprites/player.webp', 'assets/sprites/firfir.png', 'assets/sprites/firfir-walk.png', 'assets/sprites/drone.png'];
let warmed = false;
function warmAssets() {
  if (warmed || typeof fetch !== 'function') return;
  warmed = true;
  for (const url of GAME_ASSETS) fetch(url).catch(() => {});
}

// Chromium, inemeyen import()'u modül haritasında "başarısız" olarak tutar: aynı sayfada yeniden çağırmak ağa
// hiç gitmez ve hep aynı hatayı verir. Bu yüzden başarısız bir denemeden sonra "Tekrar dene" sayfayı yeniler
// (oyun adresiyle: ?classic kalkar, açılış ekranı gelir). Önce sunucuya ulaşılıp ulaşılmadığına bakılır:
// ağ hâlâ yoksa sayfa yenilenmez (tarayıcının hata sayfasına düşülmesin), söz reddedilir ve hata iletisi kalır.
let importFailed = false;
function retryByReload() {
  return fetch(window.location.href, { method: 'HEAD', cache: 'no-store' }).then((res) => {
    if (!res.ok) throw new Error('offline');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('classic');
      window.location.replace(url);
    } catch {
      window.location.reload();
    }
    return new Promise(() => {}); // sayfa yenilenene kadar "Yükleniyor…" kalır
  });
}

// Oda sahnesi hazır olduğunda çözülen söz. Tekrar çağrılınca aynı sözü verir.
// Yükleme başarısız olursa söz reddedilir (çağıran hata durumunu gösterir) ve bir sonraki
// loadGame() çağrısı yüklemeyi yeniden dener; hata konsola da yazılır.
export function loadGame() {
  if (promise) return promise;
  if (importFailed) return retryByReload();
  const chunk = import('./game.js');
  warmAssets();
  chunk.then(() => setProgress(0.3)).catch(() => {});
  const attempt = Promise.all([chunk, stageReady()])
    .then(([m]) => {
      // Parça %30, görseller kalan %70
      const { game, ready: roomReady } = m.startGame({ onProgress: (p) => setProgress(0.3 + p * 0.7) });
      // Geliştirme sırasında konsoldan erişim için
      if (import.meta.env.DEV) window.__game = game;
      return roomReady;
    })
    .then(() => {
      ready = true;
      setProgress(1);
    });
  promise = attempt;
  // Yalnızca parçanın kendisi inemediyse (ağ hatası) sonraki deneme sayfayı yeniler; bkz. retryByReload
  chunk.catch(() => {
    importFailed = true;
  });
  attempt.catch((err) => {
    console.error('[game] yüklenemedi', err);
    if (promise === attempt) promise = null; // yeniden denenebilsin
  });
  return attempt;
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
