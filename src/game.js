import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import RoomScene from './scenes/RoomScene.js';

// Oyunu kurar. ready: oda sahnesi çizilmeye hazır olduğunda çözülür; onProgress: görsel yükleme oranı (0..1).
export function startGame({ onProgress } = {}) {
  let done;
  const ready = new Promise((resolve) => {
    done = resolve;
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#2b2030',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    // <img> ile yükle: index.html'deki preload ve açılış ekranının arka planı ile aynı istek paylaşılır
    loader: { imageLoadType: 'HTMLImageElement' },
    scene: [BootScene, RoomScene],
    callbacks: {
      // Sahneler kurulduktan sonra çağrılır (Boot yüklemeye başlamıştır)
      postBoot: (g) => {
        const boot = g.scene.getScene('Boot');
        const room = g.scene.getScene('Room');
        if (boot && onProgress) boot.load.on('progress', (p) => onProgress(p));
        if (!room || g.scene.isActive('Room')) done();
        else room.sys.events.once(Phaser.Scenes.Events.CREATE, () => done());
      },
    },
  });
  // Kap 0×0 olursa (sekme/pano gizlenince) WebGL çerçeve arabelleği kurulamıyor ve oyun döngüsü
  // hatayla duruyor; boyut geri gelene kadar yeniden boyutlandırmayı atla.
  const refresh = game.scale.refresh.bind(game.scale);
  game.scale.refresh = (...args) => {
    const parent = game.scale.parent;
    if (parent && (parent.clientWidth === 0 || parent.clientHeight === 0)) return game.scale;
    return refresh(...args);
  };
  return { game, ready };
}
