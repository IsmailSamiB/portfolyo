// Oyun (Phaser) ile arayüz (HTML) arasındaki tek iletişim kanalı.
//
// Oyun -> Arayüz
//   panel:open    { id, tour? }      id: 'about' | 'projects' | 'skills' | 'contact'
//   panel:close   { id }             (tur sırasında oyun paneli kendisi kapatır)
//   dialog:show   { lines: string[], speaker?: string }
//   tour:state    { active: boolean }
//   overlay:open  { id }             id: 'piano' | 'view' | 'postcard' | 'guestbook' | 'minigame'  (tura dahil olmayan ek paneller)
//   interact      { id }             odada bir eşyaya her dokunuşta (metrikler için)
//   secret:found  { id }             SECRETS içinden; aynı id birden çok kez gelebilir
//   project:open  { id }             bir proje ayrıntısı açıldığında (klasik kart/galeri, oyun içi pencere); metrikler oturumda bir kez sayar
//
// Arayüz -> Oyun
//   panel:closed   { id }
//   dialog:closed  {}
//   overlay:closed { id }
//   ui:lock        { locked: boolean }   panel/diyalog/ek panel/açılış ekranı/klasik görünüm açıkken oyun girdisi durur
//   tour:start     {}
//   tour:stop      {}
//   piano:note     { midi }              piyano panelinde çalınan her nota (oyun nota parçacığı çıkarır)
//
// Ortak
//   lang:changed  { lang: 'tr' | 'en' }   (i18n.js yayar)
//   audio:muted   { muted: boolean }      (audio.js yayar)

const bus = new EventTarget();

export function emit(type, detail = {}) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

export function on(type, fn) {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(type, handler);
  return () => bus.removeEventListener(type, handler);
}

export const SECTIONS = ['about', 'projects', 'skills', 'contact'];

// Odadaki isteğe bağlı keşifler (tura dahil değil)
export const SECRETS = ['piano', 'guitar', 'view', 'cat', 'bed', 'sit', 'lamp', 'lights', 'coffee', 'plant', 'door', 'trash', 'guestbook', 'game', 'drone', 'gdansk'];
