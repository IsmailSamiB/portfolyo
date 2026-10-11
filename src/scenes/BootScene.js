import Phaser from 'phaser';
import { buildTextures } from '../game/art.js';
import { dayPhase } from '../phase.js';

// Yüklenecek sprite dosyalarının sabit listesi (firfir-pose.png bilerek yok)
const SPRITE_FILES = ['player.webp', 'firfir.png', 'firfir-walk.png', 'drone.png'];

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('room', 'assets/room/room.webp');
    // İsteğe bağlı sprite sayfaları: public/assets/sprites içinde dosya varsa yüklenir,
    // yoksa kodla çizilen yedekler kullanılır.
    const has = (name) => SPRITE_FILES.includes(name);
    if (has('firfir.png')) this.load.spritesheet('firfir', 'assets/sprites/firfir.png', { frameWidth: 64, frameHeight: 48 });
    if (has('firfir-walk.png')) this.load.spritesheet('firfirWalk', 'assets/sprites/firfir-walk.png', { frameWidth: 64, frameHeight: 56 });
    if (has('firfir-pose.png')) this.load.spritesheet('firfirPose', 'assets/sprites/firfir-pose.png', { frameWidth: 64, frameHeight: 56 });
    // Mini İHA (2 kare); arcade ve defter masası oda resminin içinde
    if (has('drone.png')) this.load.spritesheet('drone', 'assets/sprites/drone.png', { frameWidth: 64, frameHeight: 64 });
    if (has('player.webp')) this.load.spritesheet('playerSheet', 'assets/sprites/player.webp', { frameWidth: 64, frameHeight: 96 });

    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 60, height / 2, 0, 8, 0xd2622a).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2, 124, 12).setStrokeStyle(2, 0xf6ebcd);
    this.load.on('progress', (p) => (bar.width = 120 * p));
  }

  create() {
    buildTextures(this);
    this.scene.start('Room', { phase: dayPhase() });
  }
}
