// scripts/firfir-sheet.mjs üretir (npm run firfir); elle düzenlemeyin.
// Fırfır atlası: eşit hücreler; taban hücre altından 3 px yukarıda, gövde hücre ortasında.
export const CAT_TEXTURE = 'firfir2';
export const CAT_URL = 'assets/sprites/firfir-v2.webp';
export const CAT_SCALE = 0.0949;
export const CAT_WALK_STEP = 1.9; // yürüme karesi başına dünya px (ayak kaymasın)
export const CAT_CELL = { w: 200, h: 164 };
export const CAT_ORIGIN = { x: 0.5, y: 0.9817 };
// ad -> [x, y] (sol üst köşe)
export const CAT_FRAMES = {"cat-walk0":[0,0],"cat-walk1":[200,0],"cat-walk2":[400,0],"cat-walk3":[600,0],"cat-walk4":[800,0],"cat-stand0":[0,164],"cat-stand1":[200,164],"cat-stand2":[400,164],"cat-stand3":[600,164],"cat-stand4":[800,164],"cat-stand5":[1000,164],"cat-sit0":[0,328],"cat-sit1":[200,328],"cat-sit2":[400,328],"cat-sit3":[600,328],"cat-groom0":[0,492],"cat-groom1":[200,492],"cat-groom2":[400,492],"cat-groom3":[600,492],"cat-groom4":[800,492],"cat-groom5":[1000,492],"cat-sleep0":[0,656],"cat-sleep1":[200,656],"cat-sleep2":[400,656],"cat-sleep3":[600,656],"cat-sleep4":[800,656],"cat-sleep5":[1000,656],"cat-belly0":[0,820],"cat-belly1":[200,820],"cat-belly2":[400,820],"cat-belly3":[600,820]};
// anahtar -> [[kare, ms]]
export const CAT_ANIMS = {"walk":[["cat-walk2",86],["cat-walk3",86],["cat-walk4",86],["cat-walk0",86],["cat-walk1",86]],"idle-stand":[["cat-stand0",760],["cat-stand1",120],["cat-stand2",160],["cat-stand1",120],["cat-stand0",700],["cat-stand3",450],["cat-stand4",600],["cat-stand5",800]],"sit":[["cat-sit0",800],["cat-sit1",160],["cat-sit0",800],["cat-sit2",700],["cat-sit0",800],["cat-sit3",700]],"groom":[["cat-groom0",300],["cat-groom1",260],["cat-groom2",240],["cat-groom3",240],["cat-groom2",240],["cat-groom3",260],["cat-groom4",320],["cat-groom5",400]],"sleep":[["cat-sleep0",420],["cat-sleep1",420],["cat-sleep2",420],["cat-sleep3",420],["cat-sleep4",420],["cat-sleep5",420],["cat-sleep4",420],["cat-sleep3",420],["cat-sleep2",420],["cat-sleep1",420]],"belly":[["cat-belly0",260],["cat-belly1",260],["cat-belly2",260],["cat-belly3",260],["cat-belly2",260],["cat-belly1",260]]};
