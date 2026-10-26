import Phaser from 'phaser';
import { buildTextures } from '../game/art.js';
import { dayPhase } from '../phase.js';
import { PLAYER_TEXTURE, PLAYER_URL } from '../game/player-frames.js';
import { CAT_TEXTURE, CAT_URL } from '../game/firfir-frames.js';

// Yüklenecek sprite dosyalarının sabit listesi
const SPRITE_FILES = ['player-v2.webp', 'firfir-v2.webp', 'drone.png'];

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('room', 'assets/room/room.webp');
    // İsteğe bağlı sprite sayfaları: public/assets/sprites içinde dosya varsa yüklenir,
    // yoksa kodla çizilen yedekler kullanılır.
    const has = (name) => SPRITE_FILES.includes(name);
    // Fırfır atlası: kareler ve animasyonlar RoomScene'de cat-anims.js ile eklenir
    if (has('firfir-v2.webp')) this.load.image(CAT_TEXTURE, CAT_URL);
    // Mini İHA (2 kare); arcade ve defter masası oda resminin içinde
    if (has('drone.png')) this.load.spritesheet('drone', 'assets/sprites/drone.png', { frameWidth: 64, frameHeight: 64 });
    // Karakter atlası: kareler RoomScene'de player-frames.js'ten eklenir
    if (has('player-v2.webp')) this.load.image(PLAYER_TEXTURE, PLAYER_URL);

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
