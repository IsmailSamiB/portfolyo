import Phaser from 'phaser';
import { emit, on, SECTIONS } from '../bridge.js';
import { pick } from '../i18n.js';
import { sfx } from '../audio.js';
import { isUILocked } from '../ui/index.js';
import content from '../content/content.js';
import { FLAVOR, LABELS, TOUR_END, introLines, visitorRef } from '../content/game-text.js';
import {
  ROOM_W,
  ROOM_H,
  SPAWN,
  INTERACTABLES,
  PROPS,
  ARCADE_GLOW,
  canStand,
  findPath,
  smoothPath,
  isFree,
  randomFreeTile,
  tileAt,
  tileCenter,
} from '../game/room.js';
import { PLAYER_TEXTURE, PLAYER_SCALE, PLAYER_ORIGIN, PLAYER_CELL, PLAYER_FRAMES, PLAYER_ANIMS, PLAYER_STILL } from '../game/player-frames.js';
import { registerCatAnims, createCatSprite, setCatPose, catHasAnim, CAT_SCALE, CAT_WALK_STEP } from '../game/cat-anims.js';

const SPEED = 55;
const CAT_SPEED = 22;
const REACH = 14;
const UI_DEPTH = 9500;
const CANCELLED = Symbol('cancelled');

// Yatakta: idle-down'ın gözü kapalı karesi, baş ve omuzlar görünür; hücre altından bu kadarı
// (bacaklar, bel) kırpılır — ayak hücre altına hizalı, hücre boyu atlasla değişse de aynı yer
const BED_FRAME = 'idle3';
const BED_HIDE = 91;

export default class RoomScene extends Phaser.Scene {
  constructor() {
    super('Room');
  }

  create({ phase }) {
    this.phase = phase;
    this.locked = false; // panel/diyalog açıkken
    this.cutscene = true; // açılış sineması
    this.tour = null;
    this.path = null;
    this.onArrive = null;
    this.pose = null; // oturma/uzanma durumu
    this.cooldownUntil = 0;
    this.hop = 0;
    this.nextStep = 0;
    this.visited = new Set();
    this.seen = new Set(); // ilk kez gösterilen notlar

    // arka plan deseni + odanın altına düşen gölge
    this.add.tileSprite(ROOM_W / 2, ROOM_H / 2, 2400, 2400, 'bgtile').setDepth(-2);
    this.add.rectangle(4, 5, ROOM_W, ROOM_H, 0x150d18, 0.55).setOrigin(0).setDepth(-1);
    // Oda tek parça bir resim; küçültülerek çizildiği için yumuşak filtre kullanılır
    this.textures.get('room').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0, 0, 'room').setOrigin(0).setDisplaySize(ROOM_W, ROOM_H).setDepth(0);

    this.createProps();
    this.createAtmosphere();
    this.createLights();
    this.createLighting();
    this.createPlayer();
    this.createCat();
    this.createMarkers();
    this.createInput();
    this.createBridge();

    this.scale.on('resize', this.fitCamera, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fitCamera, this);
      this.unsubscribe.forEach((off) => off());
    });
    this.fitCamera();

    // Açılış ekranı ya da klasik görünüm açıkken karşılama, oyuna ilk dönüşte oynar
    if (isUILocked()) {
      this.locked = true;
      this.cutscene = false;
      this.introPending = true;
    } else {
      this.playIntro();
    }
  }

  // ---------- kurulum ----------

  // Oda resminde olmayan eşyalar (mini İHA): ayrı sprite, taban y'sine göre derinlik
  createProps() {
    this.props = {};
    this.flight = null;
    // Arcade ekranı hafifçe yanıp söner
    const screen = this.add
      .image(ARCADE_GLOW.x, ARCADE_GLOW.y, 'glow')
      .setTint(ARCADE_GLOW.tint)
      .setScale(ARCADE_GLOW.scale)
      .setAlpha(0.25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);
    this.ambient({ targets: screen, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    for (const def of PROPS) {
      if (!this.textures.exists(def.key)) continue;
      this.textures.get(def.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const frames = def.frames ?? [0];
      const sprite = this.add.sprite(def.x, def.base, def.key, frames[0]).setOrigin(0.5, 1).setScale(def.scale).setDepth(def.base);
      const prop = { def, sprite, frames, index: 0 };
      this.props[def.id] = prop;
      if (frames.length > 1) {
        this.time.addEvent({
          delay: def.every,
          loop: true,
          callback: () => {
            // İHA'nın pervaneleri yalnızca uçarken döner
            if (def.id === 'drone' && !this.flight) return;
            prop.index = (prop.index + 1) % frames.length;
            sprite.setFrame(frames[prop.index]);
          },
        });
      }
      if (def.glow) {
        const glow = this.add
          .image(def.glow.x, def.glow.y, 'glow')
          .setTint(def.glow.tint)
          .setScale(def.glow.scale)
          .setAlpha(0.35)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(def.base + 0.1);
        this.ambient({ targets: glow, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    }
    const drone = this.props.drone;
    if (drone) {
      drone.shadow = this.add.image(drone.def.x, drone.def.base, 'shadow').setOrigin(0.5, 0.6).setDepth(drone.def.base - 0.1);
      drone.barBack = this.add.rectangle(0, 0, 18, 3, 0x2b2030).setDepth(UI_DEPTH + 3).setVisible(false);
      drone.bar = this.add.rectangle(0, 0, 16, 1, 0x4fa66a).setOrigin(0, 0.5).setDepth(UI_DEPTH + 4).setVisible(false);
    }
  }

  // Bir etkileşim noktası, eşyası yüklenemediyse yok sayılır
  available(it) {
    const prop = { drone: 'drone' }[it.id];
    return !prop || !!this.props[prop];
  }

  createAtmosphere() {
    // pencereden gelen ışıkta uçuşan toz
    this.add
      .particles(0, 0, 'dot', {
        x: { min: 135, max: 225 },
        y: { min: 45, max: 130 },
        lifespan: 5000,
        speedX: { min: -2, max: 2 },
        speedY: { min: -4, max: -1 },
        alpha: { start: 0.7, end: 0 },
        frequency: 350,
      })
      .setDepth(8990);
    // masadaki kupadan yükselen buhar
    this.steam = this.add
      .particles(0, 0, 'dot', {
        lifespan: 1400,
        speedX: { min: -2, max: 2 },
        speedY: { min: -7, max: -4 },
        alpha: { start: 0.6, end: 0 },
        emitting: false,
      })
      .setDepth(8991);
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.steam.emitParticleAt(62, 39, 1) });

    // etkileşimlerde kullanılan parçacıklar
    const burst = (tex, cfg) =>
      this.add
        .particles(0, 0, tex, { lifespan: 1100, alpha: { start: 1, end: 0 }, emitting: false, ...cfg })
        .setDepth(UI_DEPTH - 1);
    this.fx = {
      note: burst('pNote', { speedY: { min: -22, max: -12 }, speedX: { min: -10, max: 10 } }),
      heart: burst('pHeart', { speedY: { min: -18, max: -10 }, speedX: { min: -6, max: 6 } }),
      drop: burst('pDrop', { speedY: { min: 14, max: 22 }, speedX: { min: -4, max: 4 }, lifespan: 500 }),
      z: burst('pZ', { speedY: { min: -9, max: -6 }, speedX: { min: 2, max: 5 }, lifespan: 1800 }),
    };

    // uzanınca kararan ekran
    this.sleepShade = this.add.rectangle(0, 0, ROOM_W, ROOM_H, 0x101028, 1).setOrigin(0).setAlpha(0).setDepth(8996);
  }

  // Lambalar ve süs ışıkları: parıltı katmanları açılıp kapanır
  createLights() {
    const lit = this.phase !== 'day';
    const glow = (x, y, tint, scale, alpha) =>
      this.add
        .image(x, y, 'glow')
        .setTint(tint)
        .setScale(scale)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(9001);
    this.lamps = {
      deskLamp: glow(29, 31, 0xffb060, 0.55, 0.6).setVisible(lit),
      floorLamp: glow(206, 27, 0xffd880, 0.95, 0.6).setVisible(lit),
      nightLamp: glow(276, 30, 0xffd880, 0.85, 0.6).setVisible(lit),
    };

    const tints = [0xff5544, 0x55dd66, 0x55aaff, 0xffcc44, 0xff8844];
    this.bulbs = [];
    for (let i = 0, x = 12; x < 302; i++, x += 9.6) {
      const y = 6.5 + 2 * Math.sin((x / 26) * Math.PI) ** 2;
      this.bulbs.push(glow(x, y, tints[i % tints.length], 0.16, 0.9));
    }
    this.lightMode = 0; // 0: yanıp söner · 1: sabit · 2: kapalı
    this.lightTick = 0;
    this.time.addEvent({ delay: 550, loop: true, callback: () => this.updateBulbs(++this.lightTick) });
    this.updateBulbs(0);
  }

  updateBulbs(tick) {
    this.bulbs.forEach((bulb, i) => {
      if (this.lightMode === 2) bulb.setVisible(false);
      else bulb.setVisible(true).setAlpha(this.lightMode === 1 || (i + tick) % 2 ? 0.9 : 0.25);
    });
  }

  createLighting() {
    if (this.phase !== 'night') return;
    this.add
      .rectangle(0, 0, ROOM_W, ROOM_H, 0x4a4f9a, 0.6)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(9000);
    const glow = (x, y, tint, scale) =>
      this.add.image(x, y, 'glow').setTint(tint).setScale(scale).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(9001);
    glow(51, 27, 0x7fe0e0, 0.9); // monitörler
    glow(143, 20, 0x9fb4ff, 0.9); // pencere
  }

  createPlayer() {
    const start = tileCenter(SPAWN.c, SPAWN.r);
    this.px = start.x;
    this.py = start.y;
    this.moving = false;
    this.facing = 'down';
    this.flip = false;
    this.useSheet = this.textures.exists(PLAYER_TEXTURE);
    if (this.useSheet) this.createPlayerAnims();
    // Yedek çizim (sayfa yoksa): duruş + 2 adım
    this.walkCycle = [1, 0, 2, 0];
    this.walkPhase = 0;
    this.speed = 0;
    this.action = null; // tek seferlik animasyon (el sallama)
    this.shadow = this.add.image(this.px, this.py, 'shadow').setOrigin(0.5, 0.6);
    // Doku kaynak çözünürlüğünde, NEAREST (oyun varsayılanı) ile küçültülerek çizilir
    this.player = this.useSheet
      ? this.add.sprite(this.px, this.py, PLAYER_TEXTURE, 'idle0').setOrigin(PLAYER_ORIGIN.x, PLAYER_ORIGIN.y).setScale(PLAYER_SCALE)
      : this.add.image(this.px, this.py, 'p_down_0').setOrigin(0.5, 1);
    this.tap = this.add.image(0, 0, 'tap').setVisible(false).setDepth(2);
  }

  get reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Atlas kareleri ve animasyonlar (oyun genelinde bir kez)
  createPlayerAnims() {
    const tex = this.textures.get(PLAYER_TEXTURE);
    if (!tex.has('idle0')) {
      for (const [name, [x, y]] of Object.entries(PLAYER_FRAMES)) tex.add(name, 0, x, y, PLAYER_CELL.w, PLAYER_CELL.h);
    }
    this.stepFrames = {};
    for (const [key, def] of Object.entries(PLAYER_ANIMS)) {
      if (def.steps) this.stepFrames[key] = new Set(def.steps.map((i) => def.frames[i][0]));
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: def.frames.map(([frame, duration]) => ({ key: PLAYER_TEXTURE, frame, duration })),
        repeat: def.once ? 0 : -1,
      });
    }
  }

  // Sayfa animasyonu: aynısı zaten oynuyorsa baştan başlatmaz
  playAnim(key) {
    const p = this.player;
    if (p.anims.currentAnim?.key !== key || !p.anims.isPlaying) p.play(key);
    p.anims.timeScale = 1;
  }

  // Sabit kare (animasyon durur)
  holdFrame(frame) {
    const p = this.player;
    if (p.anims.isPlaying) p.anims.stop();
    if (p.frame.name !== frame) p.setFrame(frame);
  }

  // Sayfayla durma/yürüme çizimi. moved: bu karede kat edilen yol (dünya px)
  drawSheet(moved, dt) {
    const p = this.player;
    p.setFlipX(this.facing === 'side' && !this.flip); // kaynak sağa bakar
    // Duvara dayanıp yerinde sayarken yürüme karesinde donmasın: duruş çizilir
    if (this.moving && moved > 0.02) {
      this.action = null;
      const key = `walk-${this.facing}`;
      this.playAnim(key);
      // Kare hızı gerçek hıza bağlı: kalkışta yavaş başlar (ayak kaymaz)
      p.anims.timeScale = Phaser.Math.Clamp(moved / (SPEED * dt || 1), 0, 1.5);
      // Kare, sahne güncellemesinden önce ilerler: değişim bir önceki çağrıya göre izlenir
      if (p.frame.name !== this.lastSheetFrame && this.stepFrames[key]?.has(p.frame.name)) sfx('step');
      this.lastSheetFrame = p.frame.name;
      return;
    }
    this.lastSheetFrame = null;
    // Tek seferlik animasyon (el sallama, gitar...) bitene kadar bekleme döngüsü başlamaz
    if (this.action && p.anims.isPlaying && p.anims.currentAnim?.key === this.action) return;
    this.action = null;
    // Durunca baktığı yönün bekleme döngüsü (iki ayak yerde); yan için yürüme gibi aynalanır
    if (this.reducedMotion) this.holdFrame(PLAYER_STILL[this.facing] ?? PLAYER_STILL.down);
    else this.playAnim(`idle-${this.facing}`);
  }

  // Bir kez el sallar (önden). Hareket azaltma açıkken ya da otururken yok.
  wave() {
    if (!this.moving) this.playOnce('wave');
  }

  // Tek seferlik animasyon (önden). Atlasta yoksa (gitar/kahve şeritleri henüz çizilmedi) yalnız öne döner:
  // bekleme döngüsü oynar. 'strum' · 'sip' · 'water' adlı animasyonlar eklenince kendiliğinden kullanılır.
  playOnce(key) {
    if (!this.useSheet || this.pose) return;
    this.facing = 'down';
    if (this.reducedMotion || !this.anims.exists(key)) return;
    this.action = key;
    this.player.setFlipX(false).play(key);
  }

  // Oturma/uzanma pozu: masa ve piyano (arkadan) -> type-up, bank/minder (önden) -> sit-phone,
  // yatak -> gözü kapalı bekleme karesinin üst kısmı (yorgan altı)
  drawPose(dir, type) {
    const p = this.player;
    this.action = null;
    p.setFlipX(false);
    if (type === 'lie') {
      // Uyku şeridi (sleep-bed) eklenirse o oynar; yoksa kırpılmış gözü kapalı kare
      if (this.anims.exists('sleep-bed') && !this.reducedMotion) {
        p.setCrop();
        this.playAnim('sleep-bed');
        return;
      }
      this.holdFrame(BED_FRAME);
      p.setCrop(0, 0, PLAYER_CELL.w, PLAYER_CELL.h - BED_HIDE);
      return;
    }
    p.setCrop();
    const key = dir === 'up' ? 'type-up' : 'sit-phone';
    if (this.reducedMotion) this.holdFrame(key === 'type-up' ? 'type0' : 'phone3');
    else this.playAnim(key);
  }

  // Yedek çizim. dir: 'down' | 'up' | 'side' (flip = sağa bakıyor) · frame: 0 duruş, 1-2 adım, 'sit', 'lie'
  drawPlayer(dir, frame) {
    const p = this.player;
    p.setTexture(`p_${dir}_${typeof frame === 'number' ? Math.min(frame, 2) : 0}`).setFlipX(dir === 'side' && this.flip);
    // Yedek çizimde oturma/uzanma: bacaklar (ve uzanırken gövde) kırpılır
    if (frame === 'sit') p.setCrop(0, 0, 16, 15);
    else if (frame === 'lie') p.setCrop(0, 0, 16, 11);
    else p.setCrop();
  }

  createCat() {
    const start = tileCenter(28, 13);
    // Atlas yoksa kodla çizilen yedek kedi kullanılır
    const sheet = registerCatAnims(this);
    this.cat = {
      x: start.x,
      y: start.y,
      path: null,
      mode: 'idle', // idle | walk | sit | groom | sleep | stretch | belly | jump
      dir: 'side',
      phase: 0,
      speed: 0,
      scale: 1,
      hop: 0, // zıplarken yerden yükseklik (negatif = yukarı)
      tween: null, // gerinme/zıplama tween'i
      onArrive: null, // 'player': varınca oyuncuya dönüp oturur
      thinkAt: 3000,
      blinkAt: 0,
      blinkUntil: 0,
      sheet,
      faceLeft: false,
      shadow: this.add.image(start.x, start.y, 'shadow').setOrigin(0.5, 0.6).setScale(0.85, 0.7),
      sprite: sheet ? createCatSprite(this, start.x, start.y) : this.add.image(start.x, start.y, 'cat0').setOrigin(0.5, 1),
    };
    this.drawCat('stand');
  }

  // pose: 'side' | 'down' | 'up' (yürüme; index = adım) · 'air' (zıplama) · 'stand' · 'sit' · 'blink' · 'groom' · 'sleep' · 'stretch' · 'belly'
  // Önden/arkadan yürüme şeridi yoksa down/up da yandan yürür; diğer pozlar animasyon (cat-anims.js).
  // Her pozda baktığı yön korunur (oturunca, uyurken, sevilirken de).
  drawCat(pose, index = 0) {
    const cat = this.cat;
    cat.sprite.setFlipX(cat.faceLeft);
    if (!cat.sheet) {
      const step = index % 2 ? 'cat1' : 'cat0';
      const key = { side: step, down: step, up: step, air: 'cat1', stand: 'cat0', sit: 'catSit', blink: 'catSit', groom: 'catSit', sleep: 'catSleep', stretch: 'cat0', belly: 'catSit' }[pose];
      cat.sprite.setTexture(key);
      return;
    }
    setCatPose(cat.sprite, pose, index);
  }

  // Gerinme/zıplama tween'ini keser; ölçek ve yükseklik sıfırlanır
  stopCatTween() {
    const cat = this.cat;
    cat.tween?.stop();
    cat.tween = null;
    cat.hop = 0;
    cat.sprite.setScale(cat.sheet ? CAT_SCALE : cat.scale);
  }

  catSit(time, min, max) {
    const cat = this.cat;
    const calm = this.reducedMotion ? 1.5 : 1; // hareket azaltılmışsa daha uzun oturur
    cat.mode = 'sit';
    cat.thinkAt = time + Phaser.Math.Between(min, max) * calm;
    this.drawCat('sit');
  }

  // Uyanınca gerinir: gerinme şeridi yoksa ayakta duruş öne-arkaya esnetilir (hareket azaltılmışsa esnetme yok)
  catStretch(time) {
    const cat = this.cat;
    cat.mode = 'stretch';
    cat.thinkAt = time + 1400;
    this.drawCat('stretch');
    if (!cat.sheet || catHasAnim('stretch') || this.reducedMotion) return;
    const s = { k: 0 };
    cat.tween = this.tweens.add({
      targets: s,
      k: 1,
      duration: 420,
      hold: 380,
      yoyo: true,
      ease: 'Sine.inOut',
      onUpdate: () => cat.sprite.setScale(CAT_SCALE * (1 + 0.14 * s.k), CAT_SCALE * (1 - 0.13 * s.k)),
      onComplete: () => this.stopCatTween(),
    });
  }

  // Ender oyun: çömelir, 2-3 kare ileri sıçrar, konar. Önü kapalıysa arkasına döner; ikisi de kapalıysa false.
  catPounce() {
    const cat = this.cat;
    if (!cat.sheet || this.reducedMotion) return false;
    const here = tileAt(cat.x, cat.y - 3);
    for (const sx of cat.faceLeft ? [-1, 1] : [1, -1]) {
      const n = Phaser.Math.Between(2, 3);
      let clear = true;
      for (let k = 1; k <= n; k++) clear &&= isFree(here.c + sx * k, here.r);
      if (!clear) continue;
      const fromX = cat.x;
      const toX = tileCenter(here.c + sx * n, here.r).x;
      cat.faceLeft = sx < 0;
      cat.mode = 'jump';
      cat.thinkAt = Infinity;
      const s = { t: 0 };
      // 0-0.35 çömelme (popo kıpırdar) · 0.35-0.75 havada · 0.75-1 iniş
      cat.tween = this.tweens.add({
        targets: s,
        t: 1,
        duration: 1150,
        onUpdate: () => {
          const t = s.t;
          let sx2 = 1;
          let sy = 1;
          if (t < 0.35) {
            const c = Math.min(1, t / 0.15);
            sx2 = 1 + 0.08 * c;
            sy = 1 - 0.14 * c;
            cat.x = fromX - (cat.faceLeft ? -1 : 1) * 0.4 * Math.sin(t * 60) * c;
            this.drawCat('side', 0);
          } else if (t < 0.75) {
            const u = (t - 0.35) / 0.4;
            cat.x = fromX + (toX - fromX) * u;
            cat.hop = -7 * Math.sin(Math.PI * u);
            sx2 = 1.06;
            sy = 0.97;
            this.drawCat('air', u);
          } else {
            const u = (t - 0.75) / 0.25;
            cat.x = toX;
            cat.hop = 0;
            sx2 = 1 + 0.06 * (1 - u);
            sy = 1 - 0.12 * (1 - u);
            this.drawCat('side', 2);
          }
          cat.sprite.setScale(CAT_SCALE * sx2, CAT_SCALE * sy);
        },
        onComplete: () => {
          this.stopCatTween();
          cat.mode = 'idle';
          cat.thinkAt = this.time.now + Phaser.Math.Between(900, 1800);
          this.drawCat('stand');
        },
      });
      return true;
    }
    return false;
  }

  // Sürekli (süs) hareketler: prefers-reduced-motion açıkken başlatılmaz, öğe sabit ve görünür kalır.
  ambient(config) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    return this.tweens.add(config);
  }

  createMarkers() {
    // Henüz açılmamış bölümlerin üstünde zıplayan "!" ; yaklaşınca "E" tuşu
    this.marks = new Map();
    for (const it of INTERACTABLES.filter((i) => i.kind === 'panel')) {
      const mark = this.add.image(it.mark.x, it.mark.y, 'mark').setOrigin(0.5, 1).setDepth(UI_DEPTH);
      this.ambient({ targets: mark, y: it.mark.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.marks.set(it.id, mark);
    }
    // Defter ve arcade: her zaman görünen, kendi simgeli ipuçları
    this.icons = new Map();
    for (const it of INTERACTABLES.filter((i) => i.icon && this.available(i))) {
      const icon = this.add.image(it.mark.x, it.mark.y, it.icon).setOrigin(0.5, 1).setDepth(UI_DEPTH);
      this.ambient({ targets: icon, y: it.mark.y - 3, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.icons.set(it.id, icon);
    }
    this.prompt = this.add.image(0, 0, 'keyE').setOrigin(0.5, 1).setDepth(UI_DEPTH + 1).setVisible(false);
  }

  createInput() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    // enableCapture=false: HTML arayüzündeki tuş davranışlarını bozma
    const key = (code) => this.input.keyboard.addKey(code, false);
    this.keys = {
      left: [key(K.LEFT), key(K.A)],
      right: [key(K.RIGHT), key(K.D)],
      up: [key(K.UP), key(K.W)],
      down: [key(K.DOWN), key(K.S)],
      act: key(K.E),
      space: key(K.SPACE),
    };
    this.input.on('pointerdown', (pointer) => this.handleTap(pointer.worldX, pointer.worldY, pointer.wasTouch));
  }

  createBridge() {
    this.unsubscribe = [
      on('ui:lock', ({ locked }) => {
        this.locked = !!locked;
        if (this.locked) return;
        this.cooldownUntil = this.time.now + 250;
        if (this.introPending) {
          this.introPending = false;
          this.cutscene = true;
          this.playIntro();
        }
      }),
      on('panel:open', ({ id }) => {
        this.visited.add(id);
        this.marks.get(id)?.setVisible(false);
      }),
      // Dört bölüm de gezilince (başarım) bir kez el sallar
      on('panel:closed', () => {
        if (this.wavedAll || !SECTIONS.every((id) => this.visited.has(id))) return;
        this.wavedAll = true;
        this.time.delayedCall(350, () => this.wave());
      }),
      on('overlay:closed', ({ id }) => {
        if (id === 'piano' && this.pose) this.standUp();
      }),
      on('piano:note', () => this.fx.note.emitParticleAt(22 + Phaser.Math.Between(-8, 8), 92, 1)),
      on('lang:changed', () => this.fitCamera()), // HUD satır sayısı dile göre değişebilir
      on('tour:start', () => this.runTour()),
      on('tour:stop', () => this.stopTour()),
    ];
  }

  // ---------- kamera ----------

  fitCamera() {
    const { width, height } = this.scale;
    const fit = Math.floor(Math.min(width / (ROOM_W + 16), height / (ROOM_H + 16)));
    // Dar (dikey) ekranda oda sığmaz; yüksekliğe göre büyüt, kamera karakteri izlesin
    // Ayrılan pay gerçek HUD yüksekliğine göre ölçülür (üst çubuk + keşif kutusu)
    const portrait = width < 600 && height > width;
    let hudBottom = 0;
    if (portrait) {
      const hud = document.querySelector('.hud-top');
      const measured = hud ? hud.getBoundingClientRect().bottom : 0;
      hudBottom = Math.max(measured, 90);
    }
    const tall = width < 600 ? Math.min(4, Math.floor((height - hudBottom - 6) / ROOM_H)) : 0;
    const zoom = Phaser.Math.Clamp(Math.max(fit, tall), 2, 8);
    // Oda ortalandığında HUD'ın altına taşıyorsa odayı aşağı kaydır (ekran pikseli)
    let offY = 0;
    if (portrait) {
      const centeredTop = (height - ROOM_H * zoom) / 2;
      const maxShift = Math.max(0, height - 4 - (centeredTop + ROOM_H * zoom));
      offY = Phaser.Math.Clamp(hudBottom + 6 - centeredTop, 0, maxShift);
    }
    if (zoom !== this.baseZoom || offY !== this.roomOffsetY) this.snapCamera = true;
    this.baseZoom = zoom;
    this.roomOffsetY = offY;
  }

  // Oda ekrana sığıyorsa ortala, sığmıyorsa karakteri izle
  restingCamera(zoom = this.baseZoom) {
    const cam = this.cameras.main;
    const vw = cam.width / zoom;
    const vh = cam.height / zoom;
    const pad = 12;
    // Uçuş modunda kamera İHA'yı izler
    const at = this.flight ? this.flight : { x: this.px, y: this.py };
    return {
      x: vw >= ROOM_W + pad * 2 ? ROOM_W / 2 : Phaser.Math.Clamp(at.x, vw / 2 - pad, ROOM_W + pad - vw / 2),
      y: vh >= ROOM_H + pad * 2 ? ROOM_H / 2 - (this.roomOffsetY || 0) / zoom :Phaser.Math.Clamp(at.y, vh / 2 - pad, ROOM_H + pad - vh / 2),
    };
  }

  updateCamera() {
    const cam = this.cameras.main;
    const zoom = this.baseZoom * (this.focus?.zoom ?? 1);
    cam.setZoom(zoom);
    const target = this.focus ?? this.restingCamera(zoom);
    if (this.snapCamera || this.focus || !this.cam) {
      this.cam = { x: target.x, y: target.y };
      this.snapCamera = false;
    } else {
      this.cam.x += (target.x - this.cam.x) * 0.12;
      this.cam.y += (target.y - this.cam.y) * 0.12;
    }
    cam.centerOn(this.cam.x, this.cam.y);
  }

  playIntro() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const greet = () => {
      this.focus = null;
      this.cutscene = false;
      const { name, title } = content.profile;
      emit('dialog:show', { lines: pick(introLines(name, pick(title), visitorRef())), speaker: name });
      this.wave();
    };
    if (reduced) {
      this.time.delayedCall(300, greet);
      return;
    }
    // Pencereden odaya süzülen kamera, ardından karakter selam verir
    const end = this.restingCamera();
    this.focus = { x: 143, y: 26, zoom: 1.7 };
    this.cameras.main.fadeIn(600, 43, 32, 48);
    this.tweens.add({
      targets: this.focus,
      x: end.x,
      y: end.y,
      zoom: 1,
      delay: 500,
      duration: 1700,
      ease: 'Sine.inOut',
      onComplete: () => {
        this.tweens.add({
          targets: this,
          hop: { from: 0, to: -5 },
          duration: 140,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            this.hop = 0;
            greet();
          },
        });
      },
    });
  }

  // ---------- döngü ----------

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.updateFlight(dt, time);
    this.updatePlayer(dt, time);
    this.updateCat(dt, time);
    this.updatePrompt();
    this.updateCamera();
  }

  get inputBlocked() {
    return this.locked || this.cutscene || !!this.tour || !!this.flight;
  }

  // Odak bir HTML düğmesindeyken boşluk tuşu o düğmeye aittir
  get uiFocused() {
    const el = document.activeElement;
    return !!el && el !== document.body && el.tagName !== 'CANVAS';
  }

  updatePlayer(dt, time) {
    const down = (list) => list.some((k) => k.isDown);
    let vx = 0;
    let vy = 0;
    let act = false;

    if (!this.inputBlocked) {
      vx = (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0);
      vy = (down(this.keys.down) ? 1 : 0) - (down(this.keys.up) ? 1 : 0);
      const pressedE = Phaser.Input.Keyboard.JustDown(this.keys.act);
      const pressedSpace = Phaser.Input.Keyboard.JustDown(this.keys.space) && !this.uiFocused;
      act = (pressedE || pressedSpace) && time > this.cooldownUntil;
    }

    // Otururken/uzanırken: herhangi bir tuş kaldırır
    if (this.pose) {
      if (vx || vy || act) {
        this.standUp();
      } else {
        if (this.pose.type === 'lie' && time > (this.pose.nextZ ?? 0)) {
          this.pose.nextZ = time + 900;
          this.fx.z.emitParticleAt(this.pose.x + 4, this.pose.y - 18, 1);
        }
        // Gitar çalarken arada nota; not kutusu açıkken süre işlemez (kapanınca ~2.5 sn daha çalar)
        if (this.pose.type === 'strum') {
          if (this.locked) this.pose.until = Math.max(this.pose.until, time + 2500);
          if (time > this.pose.until) this.standUp();
          else if (time > this.pose.nextZ) {
            this.pose.nextZ = time + 800;
            this.fx.note.emitParticleAt(this.pose.x + 6, this.pose.y - 20, 1);
          }
        }
        return;
      }
      vx = 0;
      vy = 0;
      act = false;
    }

    if (vx || vy) this.clearPath();
    if (act) {
      const target = this.nearest();
      if (target) this.trigger(target);
      if (this.pose) return;
    }

    const fromX = this.px;
    const fromY = this.py;
    // Kalkışta kısa hızlanma (duruş anında sıfırlanır)
    this.speed = vx || vy || (this.path && !this.locked) ? Math.min(SPEED, this.speed + SPEED * 6 * dt) : 0;
    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      const sx = (vx / len) * this.speed * dt;
      const sy = (vy / len) * this.speed * dt;
      if (canStand(this.px + sx, this.py)) this.px += sx;
      if (canStand(this.px, this.py + sy)) this.py += sy;
    } else if (this.path && !this.locked) {
      // Dokunma ya da tur ile verilen yolu izle
      const next = this.path[0];
      if (!next) {
        const done = this.onArrive;
        this.clearPath();
        done?.();
        if (this.pose) return;
      } else {
        const dx = next.x - this.px;
        const dy = next.y - this.py;
        const dist = Math.hypot(dx, dy);
        const step = this.speed * dt;
        if (dist <= step) {
          this.px = next.x;
          this.py = next.y;
          this.path.shift();
        } else {
          this.px += (dx / dist) * step;
          this.py += (dy / dist) * step;
        }
        vx = dx;
        vy = dy;
      }
    }

    this.moving = !!(vx || vy);
    let frame = 0;
    if (this.moving) {
      // Yön: baskın eksen değişmeden dönme (çaprazda yan/ön arasında titremesin)
      const ax = Math.abs(vx);
      const ay = Math.abs(vy);
      const sideways = this.facing === 'side' ? ax * 1.35 >= ay : ax > ay * 1.35;
      this.facing = sideways ? 'side' : vy < 0 ? 'up' : 'down';
      if (this.facing === 'side' && ax > 0.01) this.flip = vx > 0;
    }
    const moved = Math.hypot(this.px - fromX, this.py - fromY);
    if (this.useSheet) {
      this.drawSheet(moved, dt);
    } else {
      // Yedek çizim: kare, kat edilen mesafeye bağlı (adımlar zeminde kaymaz)
      if (this.moving) {
        this.walkPhase += moved / 5.5;
        const index = Math.floor(this.walkPhase) % this.walkCycle.length;
        frame = this.walkCycle[index];
        if (index !== this.lastStepIndex && frame !== 0 && this.lastFrame === 0) sfx('step');
        this.lastFrame = frame;
        this.lastStepIndex = index;
      } else {
        this.walkPhase = 0;
        this.lastStepIndex = -1;
        this.lastFrame = 0;
      }
      this.drawPlayer(this.facing, frame);
    }
    const x = Math.round(this.px);
    const y = Math.round(this.py);
    this.player.setPosition(x, y + (this.hop || 0)).setDepth(this.py);
    this.shadow.setPosition(x, y).setDepth(this.py - 0.1).setVisible(true);
  }

  updateCat(dt, time) {
    const cat = this.cat;
    if (cat.path?.length) {
      // Kalkışta yumuşak hızlanma
      cat.speed = Math.min(CAT_SPEED, cat.speed + CAT_SPEED * 3 * dt);
      const next = cat.path[0];
      const dx = next.x - cat.x;
      const dy = next.y - cat.y;
      const dist = Math.hypot(dx, dy);
      const step = cat.speed * dt;
      if (dist <= step) {
        cat.x = next.x;
        cat.y = next.y;
        cat.path.shift();
      } else {
        cat.x += (dx / dist) * step;
        cat.y += (dy / dist) * step;
      }
      // Yön: baskın eksen değişmeden dönme (çaprazda titremesin)
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const sideways = cat.dir === 'side' ? ax * 1.5 >= ay : ax > ay * 1.5;
      cat.dir = sideways ? 'side' : dy < 0 ? 'up' : 'down';
      // Hep yandan yürür: yatay bileşene göre döner, tam dikeyde son yatay yönünü korur
      if (ax > 0.01) cat.faceLeft = dx < 0;
      // Kare, kat edilen mesafeye bağlı: patiler zeminde kaymaz
      cat.phase += Math.min(step, dist) / CAT_WALK_STEP;
      this.drawCat(cat.dir, Math.floor(cat.phase));
      if (!cat.path.length) {
        cat.speed = 0;
        cat.dir = 'side';
        if (cat.onArrive === 'player') {
          // Oyuncunun yanına geldi: ona dönüp oturur
          if (Math.abs(this.px - cat.x) > 1) cat.faceLeft = this.px < cat.x;
          this.catSit(time, 4000, 8000);
        } else {
          // Vardı: önce bir süre ayakta durur, sonra ne yapacağına karar verir
          cat.mode = 'idle';
          cat.thinkAt = time + Phaser.Math.Between(700, 1800);
          this.drawCat('stand');
        }
        cat.onArrive = null;
      }
    } else if (time > cat.thinkAt) {
      this.catThink(time);
    } else if (cat.mode === 'sit') {
      if (time > cat.blinkAt) {
        cat.blinkAt = time + Phaser.Math.Between(2200, 4500);
        cat.blinkUntil = time + 170;
      }
      this.drawCat(time < cat.blinkUntil ? 'blink' : 'sit');
    } else if (cat.mode === 'groom') {
      this.drawCat('groom', Math.floor(time / 320));
    } else if (cat.mode === 'belly') {
      this.drawCat('belly', Math.floor(time / 380));
    } else if (cat.mode === 'sleep') {
      // Uyurken nefes animasyonu; yedek çizimde hafif ölçek değişimi
      this.drawCat('sleep');
      if (!cat.sheet) cat.sprite.setScale(cat.scale, cat.scale * (1 + 0.035 * Math.sin(time / 700)));
      if (time > (cat.nextZ ?? 0)) {
        cat.nextZ = time + 1400;
        // z'ler başın üstünden (baş baktığı tarafta)
        this.fx.z.emitParticleAt(cat.x + (cat.faceLeft ? -4 : 4), cat.y - 8, 1);
      }
    }
    const x = Math.round(cat.x);
    const y = Math.round(cat.y);
    // Zıplarken gölge yerde kalır ve küçülür
    const shade = 1 + cat.hop / 18;
    cat.sprite.setPosition(x, y + Math.round(cat.hop)).setDepth(cat.y - 2);
    cat.shadow.setPosition(x, y).setDepth(cat.y - 2.1).setScale(0.85 * shade, 0.7 * shade);
  }

  // Fırfır'ın sıradaki işi. Geçişler sıralı: oturma → uyku → gerinme → ayakta; otururken arada patisini yalar,
  // ayaktayken ender olarak sıçrar. Hareket azaltılmışsa daha az dolaşır, sıçramaz, gerinmede esnemez.
  catThink(time) {
    const cat = this.cat;
    const roll = Math.random();
    const calm = this.reducedMotion;
    const walkTo = (tile) => {
      const tiles = findPath(tileAt(cat.x, cat.y - 3), tile);
      if (!tiles?.length) return false;
      cat.path = smoothPath(cat, tiles.map((t) => tileCenter(t.c, t.r)));
      cat.mode = 'walk';
      cat.phase = 0;
      return true;
    };
    const sitDown = (min, max) => this.catSit(time, min, max);
    this.stopCatTween();
    cat.onArrive = null;
    cat.thinkAt = time + 2000;
    if (cat.mode === 'sleep') {
      // Uyanınca önce gerinir
      this.catStretch(time);
    } else if (cat.mode === 'belly' || cat.mode === 'groom') {
      sitDown(1500, 3000);
    } else if (cat.mode === 'sit' && roll < 0.25) {
      cat.mode = 'sleep';
      cat.thinkAt = time + Phaser.Math.Between(8000, 14000);
      this.drawCat('sleep');
    } else if (cat.mode === 'sit' && roll < 0.5) {
      cat.mode = 'groom';
      cat.thinkAt = time + Phaser.Math.Between(2200, 3600);
      this.drawCat('groom');
    } else if ((cat.mode === 'idle' || cat.mode === 'stretch') && !calm && roll < 0.14 && time > (cat.pounceAt ?? 0) && this.catPounce()) {
      // ender sıçrama (catPounce kurar; önü arkası kapalıysa aşağıdaki seçeneklere düşer); arka arkaya olmaz
      cat.pounceAt = time + 25000;
    } else if (cat.mode === 'sit' ? roll < (calm ? 0.65 : 0.8) : roll < (calm ? 0.3 : 0.5)) {
      // dolaş (otururken de kalkıp gidebilir)
      // En az 3 karelik bir hedef ara (kısa kımıldanmalar takılma gibi görünüyordu); bulamazsa otur
      const here = tileAt(cat.x, cat.y - 3);
      let moved = false;
      for (let i = 0; i < 6 && !moved; i++) {
        const t = randomFreeTile();
        if (Math.abs(t.c - here.c) + Math.abs(t.r - here.r) >= 3) moved = walkTo(t);
      }
      if (!moved) sitDown(3000, 6000);
    } else if (roll < (cat.mode === 'sit' ? 0.9 : 0.72)) {
      // karakterin yanına gel; zaten yanındaysa ona dönüp oturur
      if (Math.hypot(this.px - cat.x, this.py - cat.y) < 24) {
        if (Math.abs(this.px - cat.x) > 1) cat.faceLeft = this.px < cat.x;
        sitDown(4000, 8000);
        return;
      }
      const mine = tileAt(this.px, this.py - 3);
      const spots = [
        [2, 0],
        [-2, 0],
        [0, 2],
        [2, 1],
        [-2, 1],
      ]
        .map(([dc, dr]) => ({ c: mine.c + dc, r: mine.r + dr }))
        .filter((t) => isFree(t.c, t.r));
      if (spots.length && walkTo(Phaser.Utils.Array.GetRandom(spots))) cat.onArrive = 'player';
      else sitDown(3000, 6000);
    } else {
      sitDown(4000, 8000);
    }
  }

  // ---------- mini İHA ----------

  startFlight() {
    const drone = this.props.drone;
    if (!drone || this.flight) return;
    this.clearPath();
    const { x, base } = drone.def;
    this.flight = { x, y: base, alt: 0, target: null, startedAt: this.time.now, until: this.time.now + 20000, nextBuzz: 0, landing: false };
    drone.barBack.setVisible(true);
    drone.bar.setVisible(true);
    this.floatLabel({ x, y: base - 16 }, pick(LABELS.droneStart));
  }

  updateFlight(dt, time) {
    const flight = this.flight;
    if (!flight || flight.landing) return;
    const drone = this.props.drone;
    const down = (list) => list.some((k) => k.isDown);
    let vx = 0;
    let vy = 0;
    if (!this.locked) {
      vx = (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0);
      vy = (down(this.keys.down) ? 1 : 0) - (down(this.keys.up) ? 1 : 0);
      const land = Phaser.Input.Keyboard.JustDown(this.keys.act) || (Phaser.Input.Keyboard.JustDown(this.keys.space) && !this.uiFocused);
      if (land && time > flight.startedAt + 400) {
        this.endFlight();
        return;
      }
    }
    if (vx || vy) {
      flight.target = null;
    } else if (flight.target) {
      const dx = flight.target.x - flight.x;
      const dy = flight.target.y - flight.y;
      if (Math.hypot(dx, dy) < 2) flight.target = null;
      else {
        vx = dx;
        vy = dy;
      }
    }
    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      flight.x = Phaser.Math.Clamp(flight.x + (vx / len) * 80 * dt, 12, ROOM_W - 12);
      flight.y = Phaser.Math.Clamp(flight.y + (vy / len) * 80 * dt, 26, ROOM_H - 8);
    }
    // Eşyaların üstünden geçer: havada çizilir, gölgesi zeminde kalır
    flight.alt = Math.min(13, flight.alt + 30 * dt);
    const bob = Math.sin(time / 160) * 1.2;
    const x = Math.round(flight.x);
    const y = Math.round(flight.y - flight.alt + bob);
    drone.sprite.setPosition(x, y).setDepth(UI_DEPTH - 5);
    drone.shadow.setPosition(x, Math.round(flight.y)).setDepth(UI_DEPTH - 6).setScale(0.9 - flight.alt / 40);
    const left = Phaser.Math.Clamp((flight.until - time) / 20000, 0, 1);
    drone.barBack.setPosition(x, y - 16);
    drone.bar.setPosition(x - 8, y - 16).setSize(16 * left, 1).setFillStyle(left > 0.25 ? 0x4fa66a : 0xd9622b);
    if (time > flight.nextBuzz) {
      flight.nextBuzz = time + 500;
      sfx('drone');
    }
    if (time > flight.until) this.endFlight();
  }

  // İHA yerine döner ve iner; kamera karaktere geri gelir
  endFlight(instant = false) {
    const flight = this.flight;
    const drone = this.props.drone;
    if (!flight || flight.landing) return;
    flight.landing = true;
    drone.barBack.setVisible(false);
    drone.bar.setVisible(false);
    const { x, base } = drone.def;
    const finish = () => {
      drone.sprite.setPosition(x, base).setDepth(base).setFrame(drone.frames[0]);
      drone.shadow.setPosition(x, base).setDepth(base - 0.1).setScale(1);
      this.flight = null;
      this.cooldownUntil = this.time.now + 250;
      if (!instant) {
        this.floatLabel({ x, y: base - 12 }, pick(LABELS.droneEnd));
        this.sayOnce('drone');
      }
    };
    if (instant) {
      finish();
      return;
    }
    this.tweens.add({ targets: flight, x, y: base, alt: 0, duration: 800, ease: 'Sine.inOut' });
    this.tweens.add({ targets: [drone.sprite, drone.shadow], x, y: base, duration: 800, ease: 'Sine.inOut', onComplete: finish });
  }

  updatePrompt() {
    const target = this.inputBlocked || this.pose ? null : this.nearest();
    for (const [id, mark] of this.marks) mark.setVisible(!this.visited.has(id) && target?.id !== id);
    for (const [id, icon] of this.icons) icon.setVisible(!this.flight && target?.id !== id);
    if (!target) {
      this.prompt.setVisible(false);
      return;
    }
    const at = target.id === 'cat' ? { x: this.cat.x, y: this.cat.y - 11 } : target.mark;
    this.prompt.setPosition(Math.round(at.x), Math.round(at.y)).setVisible(true);
  }

  // ---------- etkileşim ----------

  nearest() {
    let best = null;
    let bestDist = REACH;
    for (const it of INTERACTABLES) {
      if (!it.anchor || !this.available(it)) continue;
      const d = Math.hypot(it.anchor.x - this.px, it.anchor.y - this.py);
      if (d < bestDist) {
        best = it;
        bestDist = d;
      }
    }
    const catDist = Math.hypot(this.cat.x - this.px, this.cat.y - this.py);
    // 18: yanına gelip oturduğu yer (2 kare) de erişimde
    if (catDist < Math.min(bestDist, 18)) return { id: 'cat', kind: 'cat', secret: 'cat' };
    return best;
  }

  // Not yalnızca ilk seferde gösterilir; sonraki denemelerde sadece efekt oynar
  sayOnce(id, speaker) {
    if (this.seen.has(id) || !FLAVOR[id]) return;
    this.seen.add(id);
    emit('dialog:show', { lines: [pick(FLAVOR[id])], speaker });
  }

  trigger(target) {
    this.clearPath();
    emit('interact', { id: target.id });
    if (target.secret) emit('secret:found', { id: target.secret });
    const mark = target.mark ?? { x: this.px, y: this.py - 22 };

    switch (target.kind) {
      case 'panel':
        if (target.id === 'contact') sfx('ring');
        emit('panel:open', { id: target.id });
        break;
      case 'overlay':
        if (target.seat) this.sit(target, 'sit');
        emit('overlay:open', { id: target.id });
        break;
      case 'sit':
        sfx('sit');
        this.sit(target, 'sit');
        break;
      case 'lie':
        sfx('sit');
        this.sit(target, 'lie');
        this.sayOnce(target.id);
        break;
      case 'drone':
        this.startFlight();
        break;
      case 'lamp': {
        const lamp = this.lamps[target.id];
        lamp.setVisible(!lamp.visible);
        sfx('click');
        this.floatLabel(mark, pick(lamp.visible ? LABELS.lampOn : LABELS.lampOff));
        break;
      }
      case 'lights':
        this.lightMode = (this.lightMode + 1) % 3;
        this.updateBulbs(this.lightTick);
        sfx('click');
        this.floatLabel(mark, pick(LABELS.lights[this.lightMode]));
        this.sayOnce(target.id);
        break;
      case 'strum':
        this.strum();
        sfx('strum');
        this.fx.note.emitParticleAt(mark.x, mark.y + 6, 4);
        this.sayOnce(target.id);
        break;
      case 'sip':
        this.playOnce('sip');
        sfx('sip');
        this.steam.emitParticleAt(153, 97, 6);
        this.floatLabel(mark, pick(LABELS.sip));
        this.sayOnce(target.id);
        break;
      case 'water':
        if (this.anims.exists('water')) this.playOnce('water'); // çizimi yok: yöne dokunmaz
        sfx('water');
        this.fx.drop.emitParticleAt(mark.x, mark.y + 2, 7);
        this.floatLabel(mark, pick(LABELS.water));
        this.sayOnce(target.id);
        break;
      case 'cat':
        sfx(this.seen.has('cat') ? 'purr' : 'meow');
        this.fx.heart.emitParticleAt(this.cat.x, this.cat.y - 10, 3);
        this.stopCatTween();
        this.cat.path = null;
        this.cat.onArrive = null;
        this.cat.mode = 'belly';
        this.cat.speed = 0;
        // başı sevenin tarafında
        if (Math.abs(this.px - this.cat.x) > 1) this.cat.faceLeft = this.px < this.cat.x;
        this.cat.thinkAt = this.time.now + 3500;
        // Sevilince sırtüstü yatar
        this.drawCat('belly');
        this.sayOnce('cat', 'Fırfır');
        break;
      default:
        emit('dialog:show', { lines: [pick(FLAVOR[target.id])] });
    }
  }

  // Sessiz çalışan etkileşimlerde eşyanın üstünde kısa süre görünen yazı
  floatLabel(at, text) {
    const label = this.add
      .text(Math.round(at.x), Math.round(at.y) - 10, text, {
        fontFamily: '"Jersey 10", monospace',
        fontSize: '40px',
        color: '#f6ebcd',
        stroke: '#2b2030',
        strokeThickness: 10,
      })
      .setOrigin(0.5, 1)
      .setScale(0.2)
      .setDepth(UI_DEPTH + 2);
    label.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    // Oda kenarından taşmasın
    label.x = Phaser.Math.Clamp(label.x, label.displayWidth / 2 + 2, ROOM_W - label.displayWidth / 2 - 2);
    this.tweens.add({ targets: label, y: label.y - 8, alpha: { from: 1, to: 0 }, delay: 900, duration: 700, onComplete: () => label.destroy() });
  }

  sit(target, type) {
    const seat = target.seat;
    // Bankta, yaklaşılan noktaya en yakın yere otur
    const x = target.id === 'bench' ? Phaser.Math.Clamp(this.px, 137, 174) : seat.x;
    this.pose = { type, x, y: seat.y, back: tileCenter(target.stand.c, target.stand.r) };
    this.facing = seat.dir;
    if (this.useSheet) this.drawPose(seat.dir, type);
    else this.drawPlayer(seat.dir, type);
    this.player.setPosition(Math.round(x), seat.y).setDepth(seat.y + 20);
    this.shadow.setVisible(false);
    if (type === 'lie') this.tweens.add({ targets: this.sleepShade, alpha: 0.3, duration: 900 });
  }

  // Gitar: duvardaki gitarın önünde, kendi taburesinde (çizimde) oturup kısa süre çalar; tuş/dokunma
  // ya da süre dolunca kalkar. Şerit yoksa yalnız öne döner.
  strum() {
    if (!this.useSheet || !this.anims.exists('strum')) {
      this.playOnce('strum');
      return;
    }
    const now = this.time.now;
    const pose = { type: 'strum', x: Math.round(this.px), y: Math.round(this.py), back: { x: this.px, y: this.py }, nextZ: now + 700, until: now + 3600 };
    this.pose = pose;
    this.facing = 'down';
    this.action = null;
    const p = this.player.setFlipX(false).setCrop();
    if (this.reducedMotion) this.holdFrame('guitar0');
    else p.play('strum');
    p.setPosition(pose.x, pose.y).setDepth(pose.y);
  }

  standUp() {
    if (!this.pose) return;
    if (this.pose.type === 'lie') {
      this.tweens.killTweensOf(this.sleepShade);
      this.tweens.add({ targets: this.sleepShade, alpha: 0, duration: 400 });
    }
    this.px = this.pose.back.x;
    this.py = this.pose.back.y;
    this.pose = null;
    if (this.useSheet) this.player.setCrop();
    this.cooldownUntil = this.time.now + 250;
  }

  handleTap(x, y, touch = false) {
    if (this.flight) {
      if (!this.locked && !this.flight.landing) this.flight.target = { x, y: y + 13 };
      return;
    }
    if (this.inputBlocked) return;
    if (this.pose) this.standUp();
    if (Math.hypot(this.cat.x - x, this.cat.y - 5 - y) < 8) {
      // Fırfır'a dokunuldu: yanına yürü, sonra sev (yürüyor ya da sıçrıyorsa durup oturarak bekler)
      if (this.cat.path || this.cat.mode === 'jump') {
        this.stopCatTween();
        this.cat.path = null;
        this.cat.onArrive = null;
        this.cat.speed = 0;
        this.catSit(this.time.now, 5000, 6000);
      }
      // Önce kedinin oyuncu tarafındaki 2 kare yanı (1 kare yanında üst üste biniyorlardı)
      const near = tileAt(this.cat.x, this.cat.y - 3);
      const side = this.px < this.cat.x ? -1 : 1;
      const spot = [
        [2 * side, 0],
        [-2 * side, 0],
        [side, 0],
        [-side, 0],
        [0, 1],
        [0, -1],
        [0, 0],
      ]
        .map(([dc, dr]) => ({ c: near.c + dc, r: near.r + dr }))
        .find((t) => isFree(t.c, t.r));
      if (spot) this.walkTo(spot, () => this.trigger({ id: 'cat', kind: 'cat', secret: 'cat' }));
      return;
    }
    const hit = this.pickInteractable(x, y, touch);
    const tile = hit ? hit.stand : tileAt(x, y);
    if (!isFree(tile.c, tile.r)) return;
    if (!this.walkTo(tile, hit ? () => this.trigger(hit) : null)) return;
    const mark = tileCenter(tile.c, tile.r);
    this.tap.setPosition(mark.x, mark.y - 2).setVisible(!hit).setAlpha(1);
    this.tweens.killTweensOf(this.tap);
    this.tweens.add({ targets: this.tap, alpha: 0, duration: 700 });
  }

  // Dokunmada küçük eşyaların alanı en az ~32 ekran pikseline genişler (yalnızca zoom küçükken).
  // Tam isabet her zaman önceliklidir; yalnızca genişletilmiş alanlara düşüldüğünde en yakın merkez seçilir.
  pickInteractable(x, y, touch) {
    const list = INTERACTABLES.filter((it) => this.available(it) && it.hit.w > 0);
    const inside = (h, px, py) => x >= h.x - px && x < h.x + h.w + px && y >= h.y - py && y < h.y + h.h + py;
    const exact = list.find((it) => inside(it.hit, 0, 0));
    if (exact || !touch) return exact;
    const minWorld = 32 / this.cameras.main.zoom;
    let best;
    let bestDist = Infinity;
    for (const it of list) {
      const h = it.hit;
      const px = Math.max(0, (minWorld - h.w) / 2);
      const py = Math.max(0, (minWorld - h.h) / 2);
      if (!px && !py) continue;
      if (!inside(h, px, py)) continue;
      const d = Math.hypot(x - (h.x + h.w / 2), y - (h.y + h.h / 2));
      if (d < bestDist) {
        bestDist = d;
        best = it;
      }
    }
    return best;
  }

  walkTo(tile, onArrive) {
    const tiles = findPath(tileAt(this.px, this.py - 3), tile);
    if (!tiles) return false;
    const points = tiles.map((t) => tileCenter(t.c, t.r));
    // Aynı karodaysak da tam ortasına yerleş
    if (!points.length) points.push(tileCenter(tile.c, tile.r));
    this.path = smoothPath({ x: this.px, y: this.py }, points);
    this.onArrive = onArrive;
    return true;
  }

  clearPath() {
    this.path = null;
    this.onArrive = null;
  }

  // ---------- 30 saniyelik tur ----------

  async runTour() {
    if (this.tour || this.cutscene) return;
    const tour = { cancel: null, panel: null };
    this.tour = tour;
    this.endFlight(true);
    this.standUp();
    this.clearPath();
    emit('tour:state', { active: true });

    const guarded = (start) =>
      new Promise((resolve, reject) => {
        if (tour.stopped) return reject(CANCELLED);
        tour.cancel = () => reject(CANCELLED);
        start(resolve);
      });
    const wait = (ms) => guarded((done) => this.time.delayedCall(ms, done));
    const walk = (tile) =>
      guarded((done) => {
        if (!this.walkTo(tile, done)) done();
      });
    const showPanel = (id, ms) =>
      guarded((done) => {
        tour.panel = id;
        const off = on('panel:closed', (d) => {
          if (d.id !== id) return;
          off();
          tour.panel = null;
          done();
        });
        emit('panel:open', { id, tour: true });
        this.time.delayedCall(ms, () => tour.panel === id && emit('panel:close', { id }));
        // Arayüz yanıt vermezse tur takılmasın
        this.time.delayedCall(ms + 800, () => {
          off();
          done();
        });
      });

    try {
      for (const id of SECTIONS) {
        const target = INTERACTABLES.find((it) => it.id === id);
        await walk(target.stand);
        await wait(250);
        await showPanel(id, 5500);
        await wait(300);
      }
      emit('dialog:show', { lines: [pick(TOUR_END)], speaker: content.profile.name });
    } catch (err) {
      if (err !== CANCELLED) throw err;
    } finally {
      this.tour = null;
      this.clearPath();
      emit('tour:state', { active: false });
    }
  }

  stopTour() {
    const tour = this.tour;
    if (!tour) return;
    tour.stopped = true;
    if (tour.panel) emit('panel:close', { id: tour.panel });
    tour.cancel?.();
  }
}
