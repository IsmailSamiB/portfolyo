// Fırfır: atlas kareleri, animasyonlar ve poz -> animasyon eşlemesi (RoomScene kullanır)
import { CAT_TEXTURE, CAT_SCALE, CAT_CELL, CAT_ORIGIN, CAT_FRAMES, CAT_ANIMS } from './firfir-frames.js';

export { CAT_TEXTURE, CAT_URL, CAT_SCALE, CAT_WALK_STEP } from './firfir-frames.js';

// Durum pozu -> animasyon (ilk bulunan); side/down/up yürümedir (kare, kat edilen mesafeye bağlı).
// 'stretch', 'jump', 'walk-down', 'walk-up' yeni şeritler (gemini-kedi-3…) atlasa eklenince kendiliğinden kullanılır;
// yokken gerinme ayakta duruşa + RoomScene'deki ölçek esnetmesine, zıplama yürüme karesine + sıçrama tween'ine düşer.
const POSE_ANIM = {
  stand: ['idle-stand'],
  stretch: ['stretch', 'idle-stand'],
  sit: ['sit'],
  blink: ['sit'],
  groom: ['groom'],
  sleep: ['sleep'],
  belly: ['belly'],
};
const frames = (key) => CAT_ANIMS[key]?.map(([frame]) => frame);
const WALK = frames('walk');
const WALK_DIR = { side: WALK, down: frames('walk-down') ?? WALK, up: frames('walk-up') ?? WALK };
// Havadaki kare: arka bacak geride, ön pati uzanmış (yürüme döngüsünün en açık adımı)
const AIR = frames('jump') ?? [WALK[1]];

// Atlasta bu animasyon var mı (gerinme/zıplama gibi isteğe bağlı şeritler için)
export const catHasAnim = (key) => Boolean(CAT_ANIMS[key]);

// Kareleri ve 'cat-*' animasyonlarını bir kez ekler; doku yüklenmediyse false
export function registerCatAnims(scene) {
  if (!scene.textures.exists(CAT_TEXTURE)) return false;
  const tex = scene.textures.get(CAT_TEXTURE);
  if (!tex.has(WALK[0])) {
    for (const [name, [x, y]] of Object.entries(CAT_FRAMES)) tex.add(name, 0, x, y, CAT_CELL.w, CAT_CELL.h);
  }
  for (const [key, frames] of Object.entries(CAT_ANIMS)) {
    if (scene.anims.exists(`cat-${key}`)) continue;
    scene.anims.create({
      key: `cat-${key}`,
      frames: frames.map(([frame, duration]) => ({ key: CAT_TEXTURE, frame, duration })),
      repeat: key === 'stretch' || key === 'jump' ? 0 : -1,
    });
  }
  return true;
}

export function createCatSprite(scene, x, y) {
  return scene.add.sprite(x, y, CAT_TEXTURE, WALK[0]).setOrigin(CAT_ORIGIN.x, CAT_ORIGIN.y).setScale(CAT_SCALE);
}

// Pozu uygular: animasyonlu pozlar zaten oynuyorsa baştan başlamaz; yürümede index = adım sayısı;
// 'air' zıplamanın havadaki karesidir (index = zıplama ilerlemesi 0..1)
export function setCatPose(sprite, pose, index = 0) {
  const anim = POSE_ANIM[pose]?.find((key) => CAT_ANIMS[key]);
  if (anim) {
    sprite.play(`cat-${anim}`, true);
    return;
  }
  sprite.anims.stop();
  if (pose === 'air') sprite.setFrame(AIR[Math.min(AIR.length - 1, Math.floor(index * AIR.length))]);
  else {
    const walk = WALK_DIR[pose] ?? WALK;
    sprite.setFrame(walk[index % walk.length]);
  }
}
