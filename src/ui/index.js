import { emit, on } from '../bridge.js';
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
import content from '../content/content.js';
import { cleanProjectId } from '../content/game-text.js';

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

// ?proje=<id>: projeye doğrudan bağlantı. Süzülür; içerikte olmayan kimlik yok sayılır.
function readProject() {
  try {
    const id = cleanProjectId(new URLSearchParams(window.location.search).get('proje'));
    return id && (content.projects || []).some((project) => project.id === id) ? id : '';
  } catch {
    return '';
  }
}

// Parametre adres çubuğundan kalkar (yenileyince yeniden zıplamasın); ref ve classic kalır.
function dropProjectParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('proje')) return;
    url.searchParams.delete('proje');
    if (url.searchParams.has('classic')) url.searchParams.set('classic', '1');
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
  // Bağlantıyla istenen proje: bir kez kullanılır (klasik görünümde karta gidilir ya da oyunda penceresi açılır).
  let linkedProject = readProject();
  if (!linkedProject) dropProjectParam(); // geçersiz değer adreste kalmasın

  function takeProject() {
    const id = linkedProject;
    linkedProject = '';
    dropProjectParam();
    return id;
  }

  const panels = createPanels(root);
  const dialog = createDialog(root);
  const classic = createClassic(classicRoot);
  const hud = createHud(root, { onToggleClassic: () => setClassic(!classicActive, { animate: true }), onPrintCv: printCv });
  const curtain = createCurtain();

  // "CV indir" (profile.cvUrl yokken): klasik görünüm perdesiz açılır, içerik hazırlanır, yazdırma penceresi açılır.
  // delay: ilk kullanımdaki ipucunun okunabilmesi için kısa bekleme (ms). Yazdırma başlatıldıysa true döner.
  // Çerçeve içinde ya da yazdırma desteklenmiyorsa sessizce hiçbir şey yapmaz.
  let printQueued = false;
  function printCv({ delay = 0 } = {}) {
    if (printQueued || typeof window.print !== 'function') return false;
    try {
      if (window.self !== window.top) return false;
    } catch {
      return false;
    }
    if (curtain.isBusy()) return false;
    if (root.querySelector('.title-screen')) return false; // açılış ekranı açıkken HUD'a ulaşılmaz; yine de korunur
    if (!classicActive) setClassic(true);
    if (!classicActive) return false;
    printQueued = true;
    const run = () => {
      printQueued = false;
      classic.preparePrint();
      try {
        window.print();
      } catch {
        // yazdırma engellendiyse yapacak bir şey yok
      }
    };
    // İki kare: klasik görünüm yerleşsin ve boyansın.
    setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(run)), delay);
    return true;
  }

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
    if (active && linkedProject) classic.showProject(takeProject());
    // ?classic ile gelindiyse oyun parçası ilk kez burada istenir
    if (!active) waitForGame();
  }

  // Oyun hazır olana kadar HUD'ı da örten kısa bir "Yükleniyor…" katmanı.
  function waitForGame() {
    if (isGameReady()) {
      hud.markGameShown(); // oda zaten hazır: ipucu hemen başlar
      return;
    }
    const layer = el('div', { class: 'game-loading', role: 'status', text: pick(S.title.loading) });
    root.append(layer);
    loadGame().then(
      () => {
        layer.remove();
        // İpucu ve "Odaya dön" etiketi, oda gerçekten göründüğünde (yükleme bitince) başlar; arada klasiğe dönüldüyse başlamaz.
        if (!classicActive) hud.markGameShown();
      },
      () => {
        // Oda yüklenemedi: klasik görünümde kal ve nedenini bildir
        layer.remove();
        if (!classicActive) applyClassic(true, true);
        hud.notify(pick(S.title.loadError));
      },
    );
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

  // Oyunda: karşılama diyaloğu kapanınca Projeler paneli o projenin penceresiyle açılır. Bir kez denenir;
  // o sırada başka bir şey açıksa (panel, ek panel, tur) vazgeçilir. Klasik görünüme geçildiyse orada kullanılır.
  function openProjectAfterIntro() {
    if (!linkedProject) return;
    const off = on('dialog:closed', () => {
      off();
      // Diyalog kilidi bu olaydan hemen sonra kalkar; durum ondan sonra okunur.
      setTimeout(() => {
        if (!linkedProject || classicActive) return;
        const id = takeProject();
        if (isLocked() || hud.isTourActive()) return;
        emit('panel:open', { id: 'projects', project: id });
        // Panel açılırken odağı gövdesine alır; odak açılan proje penceresine verilir.
        const win = root.querySelector('.os-win');
        if (win) win.focus({ preventScroll: true });
      }, 0);
    });
  }

  // Açılış ekranı senkron çizilir; oyun parçası arkadan yüklenir.
  initTitle({
    isClassic: () => classicActive,
    openClassic: () => setClassic(true),
    onStart: () => {
      hud.markGameShown();
      openProjectAfterIntro();
    },
    ready: loadGameWhenIdle(),
    retry: () => loadGame(),
    onProgress: onGameProgress,
  });
}
