import { el, reducedMotion } from './dom.js';

// "Pixel perde": 10 koyu mor sütun adım adım kapanır, görünüm değişir, sütunlar adım adım açılır.
const COLS = 10;
const CLOSE_MS = 180;
const OPEN_MS = 220;
const SAFETY_MS = 900;

export function createCurtain() {
  let curtain = null;
  let busy = false;

  function build() {
    const cols = [];
    for (let i = 0; i < COLS; i++) {
      const col = el('i', { class: 'view-curtain-col' });
      col.style.setProperty('--i', String(i));
      cols.push(col);
    }
    curtain = el('div', { class: 'view-curtain', 'aria-hidden': 'true', hidden: true }, cols);
    document.body.append(curtain);
  }

  function isBusy() {
    return busy;
  }

  // swap: perde tam kapalıyken çağrılır. Perde yoksa/oynatılamıyorsa swap anında çalışır.
  function run(swap) {
    if (busy) return false;
    if (reducedMotion()) {
      swap();
      return true;
    }
    if (!curtain) build();
    busy = true;
    let swapped = false;
    let finished = false;
    const timers = [];

    const doSwap = () => {
      if (swapped) return;
      swapped = true;
      swap();
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      doSwap();
      curtain.hidden = true;
      curtain.classList.remove('is-closing', 'is-opening');
      busy = false;
    };

    curtain.hidden = false;
    curtain.classList.remove('is-opening');
    // Yeniden akış: hidden kalktıktan sonra animasyon baştan başlasın
    void curtain.offsetWidth;
    curtain.classList.add('is-closing');

    timers.push(
      setTimeout(() => {
        if (finished) return;
        doSwap();
        curtain.classList.remove('is-closing');
        curtain.classList.add('is-opening');
      }, CLOSE_MS),
      setTimeout(finish, CLOSE_MS + OPEN_MS),
      // Güvenlik ağı: animasyon/zamanlayıcı aksasa da görünüm değişir, perde kalkar
      setTimeout(finish, SAFETY_MS),
    );
    return true;
  }

  return { run, isBusy };
}
