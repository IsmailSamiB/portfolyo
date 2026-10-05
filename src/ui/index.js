import { emit } from '../bridge.js';
import { setLock, isLocked } from './lock.js';
import { createPanels } from './panels.js';
import { createDialog } from './dialog.js';
import { createClassic } from './classic.js';
import { createHud } from './hud.js';
import { initTitle } from './title.js';
import { el, reducedMotion } from './dom.js';
import { createCurtain } from './transition.js';
import { pick } from '../i18n.js';
import S from './strings.js';
import { loadGame, loadGameWhenIdle, isGameReady, onGameProgress } from '../game-loader.js';

let started = false;

// Oyun sahnesi geç başlarsa güncel kilit durumunu buradan sorabilir (ör. ?classic ile açılışta).
export function isUILocked() {
  return isLocked();
}

function syncUrl(active) {
  try {
    const url = new URL(window.location.href);
    if (active) url.searchParams.set('classic', '1');
    else url.searchParams.delete('classic');
    window.history.replaceState(null, '', url);
  } catch {
    // adres güncellenemese de görünüm çalışır
  }
}

export function initUI() {
  if (started) return;
  const root = document.getElementById('ui');
  const classicRoot = document.getElementById('classic');
  if (!root || !classicRoot) return;
  started = true;

  let classicActive = false;

  const panels = createPanels(root);
  const dialog = createDialog(root);
  const classic = createClassic(classicRoot);
  const hud = createHud(root, { onToggleClassic: () => setClassic(!classicActive, { animate: true }) });
  const curtain = createCurtain();

  // animate: yalnızca kullanıcı düğmesiyle (HUD) perde oynar; ilk/programatik/açılış ekranı çağrıları anlık.
  function setClassic(active, { animate = false, updateUrl = true } = {}) {
    if (curtain.isBusy()) return; // geçiş sürerken yeniden giriş yok sayılır
    if (active === classicActive) return;
    if (animate && !reducedMotion()) {
      if (active) setLock('classic', true); // perde kapanırken oyun girdisi açık kalmasın
      curtain.run(() => applyClassic(active, updateUrl));
      return;
    }
    applyClassic(active, updateUrl);
  }

  function applyClassic(active, updateUrl) {
    if (active === classicActive) return;
    classicActive = active;
    // Önce kilitle ki panel/diyalog kapanırken kilit bir an bile açılmasın.
    if (active) {
      setLock('classic', true);
      if (hud.isTourActive()) emit('tour:stop', {});
      panels.close();
      dialog.close();
    }
    classic.setActive(active);
    hud.setClassic(active);
    if (!active) setLock('classic', false);
    if (updateUrl) syncUrl(active);
    // ?classic ile gelindiyse oyun parçası ilk kez burada istenir
    if (!active) waitForGame();
  }

  // Oyun hazır olana kadar HUD'ı da örten kısa bir "Yükleniyor…" katmanı.
  function waitForGame() {
    if (isGameReady()) return;
    const layer = el('div', { class: 'game-loading', role: 'status', text: pick(S.title.loading) });
    root.append(layer);
    loadGame().then(() => layer.remove());
  }

  let wantsClassic = false;
  try {
    wantsClassic = new URLSearchParams(window.location.search).has('classic');
  } catch {
    wantsClassic = false;
  }
  if (wantsClassic) {
    // Klasik görünümde Phaser hiç indirilmez; "Oyuna dön" ile istenir (setClassic).
    setClassic(true, { updateUrl: false });
    return;
  }

  // Açılış ekranı senkron çizilir; oyun parçası arkadan yüklenir.
  initTitle({
    isClassic: () => classicActive,
    openClassic: () => setClassic(true),
    ready: loadGameWhenIdle(),
    onProgress: onGameProgress,
  });
}
