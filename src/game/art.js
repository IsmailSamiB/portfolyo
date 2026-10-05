// Kodla çizilen küçük pixel art dokular: karakter, kedi, ipucu simgeleri ve ışık efektleri.
// (Odanın kendisi public/assets/room/room.webp resmidir.)

const P = {
  cream: '#f6ebcd',
  shade: '#dccfa8',
  orange: '#d2622a',
  ink: '#3a2a2a',
  cat: '#e39a4b',
  catDark: '#c0762c',
};

// Karakter renkleri
const C = {
  hair: '#5a3a28',
  hairDark: '#43291c',
  skin: '#f0c39a',
  skinShade: '#d9a47c',
  shirt: '#3fa39b',
  shirtDark: '#2f7f79',
  pants: '#3b4a6b',
  shoe: '#2c2433',
};

function canvas(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const r = (color, x, y, rw = 1, rh = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, rw, rh);
  };
  draw(r, ctx);
  tex.refresh();
}

function drawIcons(scene) {
  // "E" tuşu
  canvas(scene, 'keyE', 9, 10, (r) => {
    r(P.ink, 0, 0, 9, 10);
    r(P.cream, 1, 1, 7, 7);
    r(P.shade, 1, 8, 7, 1);
    r(P.ink, 3, 2, 3, 1);
    r(P.ink, 3, 2, 1, 5);
    r(P.ink, 3, 4, 2, 1);
    r(P.ink, 3, 6, 3, 1);
  });
  // "!" baloncuğu
  canvas(scene, 'mark', 7, 11, (r) => {
    r(P.ink, 0, 0, 7, 9);
    r(P.cream, 1, 1, 5, 7);
    r(P.ink, 2, 9, 3, 1);
    r(P.ink, 3, 10, 1, 1);
    r(P.cream, 3, 9, 1, 1);
    r(P.orange, 3, 2, 1, 3);
    r(P.orange, 3, 6, 1, 1);
  });
  // kalem baloncuğu (ziyaretçi defteri)
  canvas(scene, 'markPen', 9, 11, (r) => {
    r(P.ink, 0, 0, 9, 9);
    r('#bfe6c8', 1, 1, 7, 7);
    r(P.ink, 3, 9, 3, 1);
    r(P.ink, 4, 10, 1, 1);
    r('#bfe6c8', 4, 9, 1, 1);
    r('#2f7a4a', 6, 2, 1, 1);
    r('#2f7a4a', 5, 3, 1, 1);
    r('#2f7a4a', 4, 4, 1, 1);
    r('#2f7a4a', 3, 5, 1, 1);
    r(P.ink, 2, 6, 1, 1);
  });
  // joystick baloncuğu (arcade)
  canvas(scene, 'markJoy', 9, 11, (r) => {
    r(P.ink, 0, 0, 9, 9);
    r('#ffe2a8', 1, 1, 7, 7);
    r(P.ink, 3, 9, 3, 1);
    r(P.ink, 4, 10, 1, 1);
    r('#ffe2a8', 4, 9, 1, 1);
    r(P.orange, 3, 2, 3, 2);
    r(P.ink, 4, 4, 1, 2);
    r(P.ink, 2, 6, 5, 1);
  });
  // dokunma hedefi
  canvas(scene, 'tap', 9, 5, (r) => {
    r(P.cream, 2, 0, 5, 1);
    r(P.cream, 2, 4, 5, 1);
    r(P.cream, 0, 1, 2, 1);
    r(P.cream, 7, 1, 2, 1);
    r(P.cream, 0, 3, 2, 1);
    r(P.cream, 7, 3, 2, 1);
    r(P.cream, 0, 2, 1, 1);
    r(P.cream, 8, 2, 1, 1);
  });
  canvas(scene, 'shadow', 10, 4, (r) => {
    r('rgba(40,20,15,0.35)', 1, 0, 8, 4);
    r('rgba(40,20,15,0.35)', 0, 1, 10, 2);
  });
  // gece ışıkları için yumuşak parıltı
  canvas(scene, 'glow', 64, 64, (r, ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  // toz ve buhar taneciği
  canvas(scene, 'dot', 1, 1, (r) => r(P.cream, 0, 0));
  // odanın dışındaki arka plan deseni
  canvas(scene, 'bgtile', 16, 16, (r) => {
    r('#2b2030', 0, 0, 16, 16);
    r('#33273a', 7, 3, 2, 1);
    r('#33273a', 6, 4, 4, 1);
    r('#33273a', 7, 5, 2, 1);
    r('#251b2a', 15, 11, 1, 2);
    r('#251b2a', 0, 11, 1, 2);
  });
}

// Fırfır (sprite sayfası yüklenemezse yedek): beyaz gövde, siyah tepe/kulaklar, sırtta siyah yama, siyah kuyruk
function drawCat(scene) {
  const K = '#1d1b22';
  const W = '#f4f1ea';
  const eye = '#8fbf5a';
  const nose = '#f0a0a8';
  for (let i = 0; i < 2; i++) {
    canvas(scene, `cat${i}`, 12, 10, (r) => {
      r(K, 0, 2, 1, 4); // kuyruk
      r(K, 1, 5, 1, 1);
      r(W, 2, 4, 8, 4); // gövde
      r(K, 3, 4, 3, 2); // sırttaki yama
      r(W, 8, 2, 4, 4); // baş
      r(K, 8, 1, 4, 2); // siyah tepe + kulaklar
      r(W, 10, 2, 1, 1); // alındaki beyaz çizgi
      r(eye, 10, 3, 1, 1);
      r(nose, 11, 4, 1, 1);
      r('#e58aa0', 8, 6, 2, 1); // pembe tasma
      const a = i === 0 ? 3 : 4;
      const b = i === 0 ? 8 : 7;
      r(W, a, 8, 1, 2);
      r(W, b, 8, 1, 2);
    });
  }
  // oturuyor (öne bakar)
  canvas(scene, 'catSit', 12, 10, (r) => {
    r(W, 3, 4, 6, 6);
    r(W, 3, 1, 6, 4);
    r(K, 3, 0, 6, 2);
    r(W, 5, 1, 2, 1);
    r(eye, 4, 2, 1, 1);
    r(eye, 7, 2, 1, 1);
    r(nose, 5, 3, 2, 1);
    r('#e58aa0', 4, 5, 4, 1);
    r(K, 9, 8, 2, 1); // kuyruk
  });
  // kıvrılmış uyuyor
  canvas(scene, 'catSleep', 12, 10, (r) => {
    r(W, 2, 5, 9, 5);
    r(W, 3, 4, 7, 1);
    r(K, 3, 4, 4, 3);
    r(K, 1, 6, 1, 3);
    r(K, 8, 3, 3, 2);
    r(nose, 9, 8, 1, 1);
  });
}

// Etkileşim parçacıkları: nota, kalp, damla, "z"
function drawParticles(scene) {
  canvas(scene, 'pNote', 5, 7, (r) => {
    r(P.cream, 3, 0, 1, 6);
    r(P.cream, 4, 0, 1, 2);
    r(P.cream, 1, 4, 3, 3);
    r(P.cream, 0, 5, 1, 1);
  });
  canvas(scene, 'pHeart', 7, 6, (r) => {
    const c = '#e8556a';
    r(c, 1, 0, 2, 1);
    r(c, 4, 0, 2, 1);
    r(c, 0, 1, 7, 2);
    r(c, 1, 3, 5, 1);
    r(c, 2, 4, 3, 1);
    r(c, 3, 5, 1, 1);
    r('#ffc0c8', 1, 1, 1, 1);
  });
  canvas(scene, 'pDrop', 2, 3, (r) => {
    r('#7fc8f0', 0, 0, 2, 3);
    r('#d8f0ff', 0, 0, 1, 1);
  });
  canvas(scene, 'pZ', 5, 5, (r) => {
    r(P.cream, 0, 0, 5, 1);
    r(P.cream, 3, 1, 1, 1);
    r(P.cream, 2, 2, 1, 1);
    r(P.cream, 1, 3, 1, 1);
    r(P.cream, 0, 4, 5, 1);
  });
}

// Karakter: 3 yön (aşağı, yukarı, yan; sağ = yanın aynası) × 3 kare (duruş + 2 adım)
function drawPlayer(scene) {
  for (const dir of ['down', 'up', 'side']) {
    for (let f = 0; f < 3; f++) {
      canvas(scene, `p_${dir}_${f}`, 16, 20, (r) => {
        const side = dir === 'side';
        // bacaklar
        if (side) {
          if (f === 1) {
            r(C.pants, 5, 15, 2, 3);
            r(C.pants, 9, 15, 2, 3);
            r(C.shoe, 4, 18, 3, 1);
            r(C.shoe, 9, 18, 3, 1);
          } else {
            r(C.pants, 7, 15, 3, 3);
            r(C.shoe, 6, 18, 4, 1);
          }
        } else {
          const liftL = f === 1 ? 1 : 0;
          const liftR = f === 2 ? 1 : 0;
          r(C.pants, 5, 15, 2, 3 - liftL);
          r(C.shoe, 4, 18 - liftL, 3, 1);
          r(C.pants, 9, 15, 2, 3 - liftR);
          r(C.shoe, 9, 18 - liftR, 3, 1);
        }
        // gövde + kollar
        if (side) {
          r(C.shirt, 5, 9, 6, 6);
          r(C.shirtDark, 5, 14, 6, 1);
          const swing = f === 1 ? -1 : f === 2 ? 1 : 0;
          r(C.shirtDark, 7 + swing, 10, 2, 3);
          r(C.skin, 7 + swing, 13, 2, 1);
        } else {
          r(C.shirt, 4, 9, 8, 6);
          r(C.shirtDark, 4, 14, 8, 1);
          const a = f === 1 ? 1 : 0;
          const b = f === 2 ? 1 : 0;
          r(C.shirt, 3, 9 + a, 1, 4);
          r(C.skin, 3, 13 + a, 1, 1);
          r(C.shirt, 12, 9 + b, 1, 4);
          r(C.skin, 12, 13 + b, 1, 1);
          if (dir === 'down') r(C.shirtDark, 7, 9, 2, 1);
        }
        // baş
        if (dir === 'up') {
          r(C.hair, 3, 0, 10, 8);
          r(C.hairDark, 3, 7, 10, 1);
          r(C.skin, 5, 8, 6, 1);
        } else {
          r(C.skin, 3, 2, 10, 7);
          r(C.skinShade, 4, 8, 8, 1);
          r(C.hair, 3, 0, 10, 3);
          r(C.hairDark, 3, 3, 10, 1);
          if (side) {
            r(C.hair, 8, 3, 5, 4);
            r(C.skin, 3, 3, 5, 1);
            r(P.ink, 5, 5, 1, 2);
          } else {
            r(C.hair, 3, 3, 1, 3);
            r(C.hair, 12, 3, 1, 3);
            r(C.skin, 5, 3, 6, 1);
            r(P.ink, 5, 5, 1, 2);
            r(P.ink, 10, 5, 1, 2);
          }
        }
      });
    }
  }
}

export function buildTextures(scene) {
  drawIcons(scene);
  drawCat(scene);
  drawParticles(scene);
  drawPlayer(scene);
}
