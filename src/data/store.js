// Veri katmanı: anonim kullanım olayları, ziyaretçi defteri ve yönetici işlemleri.
// Yapılandırma (src/data/config.js) boşken her şey yerel modda sessizce çalışır; ağ isteği yapılmaz.
// Firebase SDK'sı yalnızca ilk ihtiyaçta import() ile yüklenir. Bu modül yüklenirken yan etki yoktur.
// KİŞİSEL VERİ YOK: IP, user agent, ad, e-posta toplanmaz; kimlikler rastgele üretilir.

import { firebaseConfig, ADMIN_EMAIL } from './config.js';
import { visitorRef } from '../content/game-text.js';
import { lang } from '../i18n.js';

const FLUSH_MS = 10000;
const MAX_EVENTS = 300; // oturum başına üst sınır
const MAX_TRIES = 2;
const RATE_MS = 2 * 60 * 1000;
const RATE_KEY = 'gb:last';

// ---------- Yapılandırma ----------

// Firebase yapılandırılmış mı?
export function isRemote() {
  return Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

let fbPromise = null;
function loadFirebase() {
  if (!fbPromise) {
    fbPromise = import('./firebase.js').catch((err) => {
      fbPromise = null;
      throw err;
    });
  }
  return fbPromise;
}

let authPromise = null;
function loadAuth() {
  if (!authPromise) {
    authPromise = import('./firebase-auth.js').catch((err) => {
      authPromise = null;
      throw err;
    });
  }
  return authPromise;
}

// ---------- Anonim kimlikler ----------

function randomId(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  try {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) out += chars[b % chars.length];
  } catch {
    for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function storedId(getStorage, key) {
  try {
    const storage = getStorage();
    let id = storage.getItem(key);
    if (!id || id.length > 40) {
      id = randomId();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return null;
  }
}

let sessionId = null;
let visitorId = null;

function ids(persist) {
  // Yerel modda (Firebase kapalı) kimlikler yalnızca bellekte tutulur, depolamaya yazılmaz.
  // Depolama kapalıysa (gizli sekme vb.) sayfa ömrü boyunca geçerli rastgele kimlik
  if (!sessionId) sessionId = (persist && storedId(() => window.sessionStorage, 'm:session')) || randomId();
  if (!visitorId) visitorId = (persist && storedId(() => window.localStorage, 'm:visitor')) || randomId();
  return { session: sessionId, visitor: visitorId };
}

function device() {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    return coarse || window.innerWidth < 768 ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

function mode() {
  try {
    return document.body.classList.contains('is-classic') ? 'classic' : 'game';
  } catch {
    return 'game';
  }
}

// Yalnızca küçük, düz değerler: en çok 8 alan; string'ler 80 karaktere kırpılır.
function cleanData(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    if (count >= 8) break;
    const k = String(key).slice(0, 24);
    if (typeof value === 'string') out[k] = value.slice(0, 80);
    else if (typeof value === 'number' && Number.isFinite(value)) out[k] = value;
    else if (typeof value === 'boolean') out[k] = value;
    else continue;
    count += 1;
  }
  return out;
}

// ---------- Olay kuyruğu ----------

const queue = []; // gönderilmeyi bekleyenler: { event, tries }
const local = []; // uzak yokken bellekte tutulanlar (yönetici paneli DEV'de gösterir)
let counted = null;
let wired = false;
let timer = null;
let sending = false;

function isDev() {
  try {
    return Boolean(import.meta.env && import.meta.env.DEV);
  } catch {
    return false;
  }
}

// Oturum başına sayaç; sayfa yenilense de sürsün diye sessionStorage'da tutulur.
function underLimit() {
  if (counted == null) {
    counted = 0;
    try {
      counted = Number(window.sessionStorage.getItem('m:count')) || 0;
    } catch {}
  }
  if (counted >= MAX_EVENTS) return false;
  counted += 1;
  try {
    window.sessionStorage.setItem('m:count', String(counted));
  } catch {}
  return true;
}

function wire() {
  if (wired) return;
  wired = true;
  timer = window.setInterval(() => flush(false), FLUSH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', () => flush(true));
}

// Anonim kullanım olayı. type: kısa ad ('visit', 'panel', 'interact', 'secret', 'tour', 'cv', 'link', 'game', 'leave'...)
// data: küçük düz nesne (string/number/boolean alanlar)
export function track(type, data = {}) {
  try {
    if (typeof type !== 'string' || !type) return;
    if (!underLimit()) return;
    const remote = isRemote();
    const event = {
      type: type.slice(0, 24),
      data: cleanData(data),
      ...ids(remote),
      ref: visitorRef(),
      lang: lang() === 'tr' ? 'tr' : 'en',
      device: device(),
      mode: mode(),
      at: Date.now(),
    };
    if (!remote) {
      local.push(event);
      if (isDev()) window.__metrics = local;
      return;
    }
    queue.push({ event, tries: 0 });
    wire();
  } catch {
    // metrikler siteyi asla bozmaz
  }
}

// Kuyruğu gönderir. closing=true: sekme kapanırken/gizlenirken en iyi çaba (keepalive'lı REST isteği).
// Ek dışa aktarım: metrics.js 'leave' olayından hemen sonra çağırır.
export function flush(closing = false) {
  try {
    if (!isRemote() || !queue.length) return;
    if (closing) {
      sendClosing(queue.splice(0, queue.length).map((item) => item.event));
      return;
    }
    if (sending) return;
    const items = queue.splice(0, queue.length);
    sending = true;
    sendBatch(items.map((item) => item.event))
      .catch(() => {
        // Geçici hata olabilir: bir kez daha dene, sonra bırak
        for (const item of items) {
          item.tries += 1;
          if (item.tries < MAX_TRIES) queue.push(item);
        }
      })
      .finally(() => {
        sending = false;
      });
  } catch {
    sending = false;
  }
}

async function sendBatch(events) {
  const fb = await loadFirebase();
  const batch = fb.writeBatch(fb.db);
  const col = fb.collection(fb.db, 'events');
  for (const event of events) batch.set(fb.doc(col), event);
  await batch.commit();
}

// Firestore REST değer biçimi (yalnızca olaylarda kullanılan türler)
function restValue(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  const fields = {};
  for (const [key, inner] of Object.entries(value || {})) fields[key] = restValue(inner);
  return { mapValue: { fields } };
}

// Sekme kapanırken SDK'nın isteği yarıda kesilebilir; keepalive'lı fetch tarayıcıda sayfadan sonra da tamamlanır.
function sendClosing(events) {
  try {
    const project = encodeURIComponent(firebaseConfig.projectId);
    const base = `projects/${project}/databases/(default)/documents`;
    const writes = events.map((event) => ({
      update: { name: `${base}/events/${randomId()}`, fields: restValue(event).mapValue.fields },
      currentDocument: { exists: false },
    }));
    const url = `https://firestore.googleapis.com/v1/${base}:commit?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // en iyi çaba
  }
}

// ---------- Ziyaretçi defteri ----------

// http://, www. ya da alan adı benzeri (ornek.com) kalıplar
const LINK_RE = /(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|io|co|tr|ru|xyz|info|biz|dev|app|gg|tv|shop|site|online|link)\b)/i;

// Uzaktan gelen metni temizle: kontrol/yön değiştirici karakterler ve aşırı birleşik işaretler (zalgo) atılır.
const tidy = (s) => String(s ?? '')
  .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
  .replace(/\p{M}{3,}/gu, '');
const tidyName = (s) => tidy(s).replace(/\s+/g, ' ').trim();

function millis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  return typeof value === 'number' ? value : 0;
}

export const guestbook = {
  // -> { ok: true } | { ok: false, reason: 'invalid' | 'link' | 'rate' | 'offline' }
  async submit({ name, message } = {}) {
    const cleanName = String(name ?? '').replace(/\s+/g, ' ').trim();
    const cleanMessage = String(message ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (cleanName.length < 1 || cleanName.length > 40) return { ok: false, reason: 'invalid' };
    if (cleanMessage.length < 3 || cleanMessage.length > 280) return { ok: false, reason: 'invalid' };
    if (LINK_RE.test(cleanName) || LINK_RE.test(cleanMessage)) return { ok: false, reason: 'link' };
    try {
      const last = Number(window.localStorage.getItem(RATE_KEY)) || 0;
      if (Date.now() - last < RATE_MS) return { ok: false, reason: 'rate' };
    } catch {}
    if (!isRemote()) return { ok: false, reason: 'offline' };
    try {
      const fb = await loadFirebase();
      await fb.addDoc(fb.collection(fb.db, 'guestbook'), {
        name: cleanName,
        message: cleanMessage,
        status: 'pending',
        createdAt: fb.serverTimestamp(),
      });
      try {
        window.localStorage.setItem(RATE_KEY, String(Date.now()));
      } catch {}
      return { ok: true };
    } catch {
      return { ok: false, reason: 'offline' };
    }
  },

  // -> [{ id, name, message, createdAt: number (ms) }]  (yeniden eskiye, yalnızca onaylılar)
  async listApproved() {
    if (!isRemote()) return [];
    try {
      const fb = await loadFirebase();
      // where('status','==','approved') güvenlik kuralıyla uyum için şart
      const snap = await fb.getDocs(
        fb.query(
          fb.collection(fb.db, 'guestbook'),
          fb.where('status', '==', 'approved'),
          fb.orderBy('createdAt', 'desc'),
          fb.limit(50),
        ),
      );
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: tidyName(data.name),
          message: tidy(data.message),
          createdAt: millis(data.createdAt),
        };
      });
    } catch {
      return [];
    }
  },
};

// ---------- Skor tablosu ----------

const SCORE_KEY = 'minigame:scores';
const SCORE_LOCAL_MAX = 10;
const SCORE_MAX = 5000;

// Skor azalan, eşitlikte eski olan önce
function byScore(a, b) {
  return b.score - a.score || a.at - b.at;
}

function readLocalScores() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SCORE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((r) => r && typeof r.name === 'string' && Number.isInteger(r.score))
      .map((r) => ({ id: String(r.id || randomId(12)), name: tidyName(r.name), score: r.score, at: Number(r.at) || 0 }))
      .sort(byScore);
  } catch {
    return [];
  }
}

function writeLocalScores(list) {
  try {
    window.localStorage.setItem(SCORE_KEY, JSON.stringify(list.slice().sort(byScore).slice(0, SCORE_LOCAL_MAX)));
  } catch {}
}

function addLocalScore(name, score) {
  const list = readLocalScores();
  list.push({ id: randomId(12), name, score, at: Date.now() });
  writeLocalScores(list);
}

function mapScoreDoc(d) {
  const data = d.data();
  return { id: d.id, name: tidyName(data.name), score: Number(data.score) || 0, at: millis(data.at) };
}

export const scores = {
  // -> { ok: true } | { ok: false, reason: 'invalid' | 'offline' }
  async submit({ name, score } = {}) {
    try {
      const cleanName = String(name ?? '').toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(cleanName)) return { ok: false, reason: 'invalid' };
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > SCORE_MAX) {
        return { ok: false, reason: 'invalid' };
      }
      if (!isRemote()) {
        addLocalScore(cleanName, score);
        return { ok: true };
      }
      try {
        const fb = await loadFirebase();
        await fb.addDoc(fb.collection(fb.db, 'scores'), {
          name: cleanName,
          score,
          at: fb.serverTimestamp(),
        });
        return { ok: true };
      } catch {
        return { ok: false, reason: 'offline' };
      }
    } catch {
      return { ok: false, reason: 'offline' };
    }
  },

  // -> [{ id, name, score, at: number (ms) }]  (skor azalan, eşitlikte eski olan önce)
  async top(n = 10) {
    const count = Math.max(1, Math.min(100, Math.floor(Number(n)) || 10));
    try {
      if (isRemote()) {
        try {
          const fb = await loadFirebase();
          const snap = await fb.getDocs(
            fb.query(fb.collection(fb.db, 'scores'), fb.orderBy('score', 'desc'), fb.orderBy('at', 'asc'), fb.limit(count)),
          );
          return snap.docs.map(mapScoreDoc);
        } catch {
          // uzak hata: yerel tabloya düş
        }
      }
      return readLocalScores().slice(0, count);
    } catch {
      return [];
    }
  },
};

// ---------- Yönetici ----------

function toUser(user) {
  if (!user) return null;
  const email = user.email || '';
  return { email, isAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase() };
}

// Firestore isteğinden önce oturum belirteci hazır olmalı
async function adminDb() {
  const [fb, au] = await Promise.all([loadFirebase(), loadAuth()]);
  if (typeof au.auth.authStateReady === 'function') await au.auth.authStateReady();
  return fb;
}

async function guestbookQuery(status, max) {
  if (!isRemote()) return [];
  const fb = await adminDb();
  const snap = await fb.getDocs(
    fb.query(
      fb.collection(fb.db, 'guestbook'),
      fb.where('status', '==', status),
      fb.orderBy('createdAt', 'desc'),
      fb.limit(max),
    ),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: tidyName(data.name),
      message: tidy(data.message),
      createdAt: millis(data.createdAt),
      status,
    };
  });
}

// writeBatch en çok 500 işlem alır; parçalara bölüp siler
async function deleteMany(collectionName, ids) {
  const fb = await adminDb();
  const list = [...ids].map(String);
  for (let i = 0; i < list.length; i += 400) {
    const batch = fb.writeBatch(fb.db);
    for (const id of list.slice(i, i + 400)) batch.delete(fb.doc(fb.db, collectionName, id));
    await batch.commit();
  }
}

export const admin = {
  // -> { email } | null
  async signIn() {
    if (!isRemote()) return null;
    try {
      const au = await loadAuth();
      const provider = new au.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await au.signInWithPopup(au.auth, provider);
      return result.user ? { email: result.user.email || '' } : null;
    } catch {
      return null;
    }
  },

  async signOut() {
    if (!isRemote()) return;
    try {
      const au = await loadAuth();
      await au.signOut(au.auth);
    } catch {}
  },

  // cb({ email, isAdmin } | null); aboneliği kaldıran fonksiyon döner
  onAuth(cb) {
    if (!isRemote()) {
      cb(null);
      return () => {};
    }
    let cancelled = false;
    let unsubscribe = null;
    loadAuth()
      .then((au) => {
        if (cancelled) return;
        unsubscribe = au.onAuthStateChanged(au.auth, (user) => cb(toUser(user)));
      })
      .catch(() => {
        if (!cancelled) cb(null);
      });
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  },

  // -> [{ id, type, data, session, visitor, ref, lang, device, mode, at: number (ms) }]
  // Uzak yokken bu sayfanın bellekteki olaylarını döndürür (deneme için). Hata olursa fırlatır.
  async events({ days = 30 } = {}) {
    const since = Date.now() - Math.max(1, Number(days) || 30) * 86400000;
    if (!isRemote()) {
      return local
        .filter((event) => event.at >= since)
        .map((event, index) => ({ id: `local-${index}`, ...event }))
        .reverse();
    }
    const fb = await adminDb();
    const snap = await fb.getDocs(
      fb.query(fb.collection(fb.db, 'events'), fb.where('at', '>=', since), fb.orderBy('at', 'desc'), fb.limit(5000)),
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: String(data.type ?? ''),
        data: data.data && typeof data.data === 'object' ? data.data : {},
        session: String(data.session ?? ''),
        visitor: String(data.visitor ?? ''),
        ref: String(data.ref ?? ''),
        lang: String(data.lang ?? ''),
        device: String(data.device ?? ''),
        mode: String(data.mode ?? ''),
        at: millis(data.at),
      };
    });
  },

  // -> [{ id, name, message, createdAt, status: 'pending' | 'approved' }]
  // Bekleyenler ve yayındakiler ayrı sorgular. İkisi de mevcut bileşik dizinle (status Asc, createdAt Desc) çalışır.
  // Kural: isAdmin() ile geçer.
  async guestbookPending() {
    return guestbookQuery('pending', 50);
  },

  async guestbookApproved() {
    return guestbookQuery('approved', 100);
  },

  async approve(id) {
    if (!isRemote()) return;
    const fb = await adminDb();
    await fb.updateDoc(fb.doc(fb.db, 'guestbook', id), { status: 'approved' });
  },

  async remove(id) {
    if (!isRemote()) return;
    const fb = await adminDb();
    await fb.deleteDoc(fb.doc(fb.db, 'guestbook', id));
  },

  // Toplu silme (yönetici): kural `allow delete: if isAdmin()`
  async removeMany(ids) {
    if (!isRemote() || !ids.length) return;
    await deleteMany('guestbook', ids);
  },

  async removeScores(ids) {
    if (!ids.length) return;
    if (!isRemote()) {
      const drop = new Set(ids.map(String));
      writeLocalScores(readLocalScores().filter((r) => !drop.has(r.id)));
      return;
    }
    await deleteMany('scores', ids);
  },

  // -> [{ id, name, score, at }]  (en çok 200, skor azalan). Uzak yokken yerel tablo.
  async scoresAll() {
    if (!isRemote()) return readLocalScores();
    const fb = await adminDb();
    const snap = await fb.getDocs(
      fb.query(fb.collection(fb.db, 'scores'), fb.orderBy('score', 'desc'), fb.orderBy('at', 'asc'), fb.limit(200)),
    );
    return snap.docs.map(mapScoreDoc);
  },

  async removeScore(id) {
    if (!isRemote()) {
      writeLocalScores(readLocalScores().filter((r) => r.id !== id));
      return;
    }
    const fb = await adminDb();
    await fb.deleteDoc(fb.doc(fb.db, 'scores', String(id)));
  },
};
