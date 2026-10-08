// Oyun içi konuşmalar: karşılama, eşyalara bakınca çıkan kısa notlar, tur sonu.
// Her metin { tr, en } biçimindedir.

// Başvuru linkine eklenen ?ref=SirketAdi değeri. Sahte cümle yazdırılmasın diye sıkı süzülür:
// NFKC normalleştirme; yalnızca Latin harfleri (Türkçe dahil), rakam, boşluk, & ' -; nokta yok;
// en çok 3 sözcük (fazlası boş döner); en çok 24 karakter. Değer bir kez hesaplanır.
function computeRef() {
  try {
    const raw = new URLSearchParams(window.location.search).get('ref') || '';
    const clean = raw
      .normalize('NFKC')
      .replace(/[^\p{Script=Latin}\p{N} &'-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean || clean.split(' ').length > 3) return '';
    return Array.from(clean).slice(0, 24).join('').trim();
  } catch {
    return '';
  }
}

const REF = computeRef();

export function visitorRef() {
  return REF;
}

export function introLines(name, title, ref) {
  return {
    tr: [
      ref ? `Merhaba ${ref} ekibi, hoş geldiniz! Ben ${name}.` : `Merhaba, hoş geldin! Ben ${name}.`,
      `${title}. Burası benim odam: bilgisayarda projelerim, kitaplıkta yeteneklerim, panoda hikâyem, telefonda iletişim bilgilerim var.`,
      'Vaktin azsa “Beni gezdir” düğmesi dört bölümü 30 saniyede gösterir. Çıkmadan ziyaretçi defterine bir not bırakabilirsin.',
    ],
    en: [
      ref ? `Hello ${ref} team, welcome! I’m ${name}.` : `Hi, welcome! I’m ${name}.`,
      `${title}. This is my room: projects on the computer, skills on the bookshelf, my story on the corkboard and contact details on the phone.`,
      'Short on time? The “Take the tour” button shows the four sections in 30 seconds. Feel free to sign the guestbook before you leave.',
    ],
  };
}

export const TOUR_END = {
  tr: 'Tur bitti! İstersen odada dolaşmaya devam et, telefondan bana ulaş ya da ziyaretçi defterine bir not bırak.',
  en: "That’s the tour! Feel free to keep exploring, reach me through the phone, or sign the guestbook.",
};

// Sessiz etkileşimlerde eşyanın üstünde beliren kısa etiketler
export const LABELS = {
  lampOn: { tr: 'Lamba açık', en: 'Lamp on' },
  lampOff: { tr: 'Lamba kapalı', en: 'Lamp off' },
  // süs ışığı modları: 0 yanıp söner, 1 sabit, 2 kapalı
  lights: [
    { tr: 'Süs ışıkları: yanıp sönüyor', en: 'String lights: twinkling' },
    { tr: 'Süs ışıkları: sabit', en: 'String lights: steady' },
    { tr: 'Süs ışıkları: kapalı', en: 'String lights: off' },
  ],
  sip: { tr: 'Bir yudum kahve', en: 'A sip of coffee' },
  water: { tr: 'Çiçek sulandı', en: 'Plant watered' },
  droneStart: { tr: 'Uçuş modu · yön tuşlarıyla uç, E ile in', en: 'Flight mode · arrows to fly, E to land' },
  droneEnd: { tr: 'İniş tamam', en: 'Landed' },
};

export const FLAVOR = {
  drone: {
    tr: 'Mini İHA. Lisede takımımızla TEKNOFEST’e katılmış, İHA pilotu sertifikası almıştım. El alışkanlığı hâlâ duruyor.',
    en: 'The mini drone. In high school our team competed at TEKNOFEST and I earned a UAV pilot certificate. The muscle memory is still there.',
  },
  lights: {
    tr: 'Süs ışıklarının fişi. Her basışta mod değişiyor: yanıp sönen, sabit, kapalı.',
    en: 'The plug for the string lights. Each press changes the mode: twinkling, steady, off.',
  },
  bed: {
    tr: 'Yatak. En iyi fikirler nedense tam uykuya dalarken geliyor.',
    en: 'The bed. For some reason the best ideas show up right before falling asleep.',
  },
  piano: {
    tr: 'Piyano. Derleme beklerken iki nota çalmak iyi geliyor.',
    en: 'The piano. A couple of notes while the build runs never hurts.',
  },
  door: {
    tr: 'Kapı kilitli. Üzerinde bir not var: “Yakında: metro istasyonu.”',
    en: 'The door is locked. A note on it reads: “Coming soon: metro station.”',
  },
  window: {
    tr: 'Pencere. Ekrana bakmaktan yorulunca göz dinlendirmek için birebir.',
    en: 'The window. Perfect for resting your eyes after a long stare at the screen.',
  },
  plant: {
    tr: 'Saksı bitkisi. Hâlâ hayatta; demek ki sorumluluk alabiliyorum.',
    en: 'A potted plant. Still alive, so apparently I can handle responsibility.',
  },
  table: {
    tr: 'Sehpa. Üzerinde yarım kalmış bir kahve ve bir sürü yapışkan not.',
    en: 'The coffee table. A half-finished coffee and far too many sticky notes.',
  },
  guitar: {
    tr: 'Gitar. Üç akor biliyorum ama onları çok iyi biliyorum.',
    en: 'The guitar. I know three chords, but I know them really well.',
  },
  cat: {
    tr: 'Miyav. (Bu Fırfır. Smokini hep üstünde; kod incelemelerini o yapar.)',
    en: 'Meow. (This is Fırfır. Always in a tuxedo; he does the code reviews around here.)',
  },
  trash: {
    tr: 'Çöp kovası. İçinde “kesin tutacak” dediğim üç proje fikri var.',
    en: 'The bin. Three “this one will definitely work” project ideas live in there.',
  },
  tower: {
    tr: 'Bilgisayar kasası. Fanı kalkışa hazırlanan uçak gibi ama işini yapıyor.',
    en: 'The PC tower. The fan sounds like a plane taking off, but it gets the job done.',
  },
  poster: {
    tr: 'Uzay posteri. Büyük resme bakmayı hatırlatıyor.',
    en: 'A space poster. A reminder to keep the big picture in mind.',
  },
  camera: {
    tr: 'Eski bir fotoğraf makinesi. Hafta sonları şehirde fotoğraf çekmeyi severim.',
    en: 'An old camera. I like taking photos around the city on weekends.',
  },
  photos: {
    tr: 'Duvardaki fotoğraflar: aile, arkadaşlar ve birkaç güzel gün batımı.',
    en: 'Photos on the wall: family, friends and a few good sunsets.',
  },
};

