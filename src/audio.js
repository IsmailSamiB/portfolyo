// Ses motoru: her şey WebAudio ile sentezlenir, ses dosyası yok.
// Context yalnızca unlock() içinde (kullanıcı jesti) oluşturulur; import anında yan etki yoktur.
// sfx() adları: step, blip, open, close, click, meow, purr, ring, sip, water, strum, secret, coin, drone, sit

import { emit } from './bridge.js';

const STORE_KEY = 'audio:muted';
const MASTER_LEVEL = 0.7; // toplam seviye mütevazı
const SILENT = 0.0001; // üstel rampalar 0'a inemez

let ctx = null;
let master = null; // ana gain (susturma burada)
let sfxBus = null;
let noteBus = null;
let ambBus = null;
let whiteBuf = null;
let brownBuf = null;

let muted = null; // null: tercih henüz okunmadı
let ambWanted = false;
let amb = null; // çalışan ambiyans: { src, gain, timer }
let droneBase = 148; // drone uğultusunun yavaşça kayan perdesi (Hz)
const stringCache = new Map(); // Karplus-Strong tel tamponları

// ---------- Tercih ----------

function readMuted() {
  if (muted === null) {
    muted = false;
    try {
      muted = localStorage.getItem(STORE_KEY) === '1';
    } catch {
      // depolama kapalıysa varsayılan: sesli
    }
  }
  return muted;
}

export function isMuted() {
  return readMuted();
}

export function setMuted(value) {
  const next = Boolean(value);
  if (next === readMuted()) return;
  muted = next;
  try {
    localStorage.setItem(STORE_KEY, next ? '1' : '0');
  } catch {
    // kaydedilemese de oturum içinde geçerli
  }
  if (ctx) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(next ? 0 : MASTER_LEVEL, t, 0.04);
  }
  syncAmbience();
  emit('audio:muted', { muted: next });
}

// ---------- Kurulum ----------

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
    return false;
  }

  // Zincir: bus'lar -> ana gain -> sınırlayıcı -> çıkış
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.knee.value = 10;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(ctx.destination);

  master = ctx.createGain();
  master.gain.value = readMuted() ? 0 : MASTER_LEVEL;
  master.connect(limiter);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);
  noteBus = ctx.createGain();
  noteBus.gain.value = 0.9;
  noteBus.connect(master);
  ambBus = ctx.createGain();
  ambBus.gain.value = 1;
  ambBus.connect(master);

  // Gürültü tamponları (beyaz: efektler, kahverengi: ambiyans)
  const sr = ctx.sampleRate;
  whiteBuf = ctx.createBuffer(1, sr * 2, sr);
  const w = whiteBuf.getChannelData(0);
  for (let i = 0; i < w.length; i += 1) w[i] = Math.random() * 2 - 1;

  brownBuf = ctx.createBuffer(1, sr * 6, sr);
  const b = brownBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < b.length; i += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    b[i] = last * 3.5;
  }
  // Döngü dikişi tıklamasın: baş ve sonu kısa çapraz geçişle eşitle
  const fade = Math.floor(sr * 0.25);
  for (let i = 0; i < fade; i += 1) {
    const k = i / fade;
    const tail = b.length - fade + i;
    b[tail] = b[tail] * (1 - k) + b[i] * k;
  }

  document.addEventListener('visibilitychange', syncAmbience);
  return true;
}

export function unlock() {
  if (!ctx && !build()) return;
  if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
    try {
      const p = ctx.resume();
      if (p && typeof p.then === 'function') p.then(syncAmbience, () => {});
    } catch {
      // bazı tarayıcılar jest dışında reddeder; bir sonraki tıklamada yeniden denenir
    }
  }
  syncAmbience();
}

// Ses üretmeye hazır mıyız?
function ready() {
  return Boolean(ctx) && !readMuted();
}

// ---------- Yardımcılar ----------

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function midiHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

// Tıklamasız zarf: hızlı doğrusal atak, üstel sönüm.
function envelope(param, t, attack, peak, decay) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(SILENT, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(SILENT, t + attack + decay);
}

// Tek osilatörlü kısa ses. f2 verilirse perde kayar.
function tone({ type = 'square', f, f2, t, attack = 0.004, decay = 0.08, peak = 0.06, dest }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + attack + decay);
  envelope(g.gain, t, attack, peak, decay);
  osc.connect(g);
  g.connect(dest || sfxBus);
  osc.start(t);
  osc.stop(t + attack + decay + 0.03);
  return osc;
}

// Beyaz gürültü kaynağı (rastgele başlangıç noktasından).
function noise(t, dur) {
  const src = ctx.createBufferSource();
  src.buffer = whiteBuf;
  src.loop = true;
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.03);
  return src;
}

function filter(type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// ---------- Efektler ----------

const SFX = {
  // Ahşap zeminde kısık tıkırtı
  step(t) {
    const pitch = rand(0.85, 1.2);
    const src = noise(t, 0.07);
    const bp = filter('bandpass', 330 * pitch, 1.6);
    const g = ctx.createGain();
    envelope(g.gain, t, 0.003, 0.09, 0.05);
    src.connect(bp);
    bp.connect(g);
    g.connect(sfxBus);
    tone({ type: 'sine', f: 120 * pitch, f2: 70 * pitch, t, attack: 0.003, decay: 0.05, peak: 0.035 });
  },

  blip(t) {
    tone({ type: 'square', f: 880, t, decay: 0.06, peak: 0.04 });
  },

  open(t) {
    tone({ type: 'square', f: 523.25, t, decay: 0.07, peak: 0.04 });
    tone({ type: 'square', f: 783.99, t: t + 0.07, decay: 0.1, peak: 0.04 });
  },

  close(t) {
    tone({ type: 'square', f: 783.99, t, decay: 0.07, peak: 0.04 });
    tone({ type: 'square', f: 523.25, t: t + 0.07, decay: 0.1, peak: 0.04 });
  },

  click(t) {
    tone({ type: 'triangle', f: 1400, f2: 900, t, attack: 0.002, decay: 0.03, peak: 0.07 });
  },

  // Perdesi kayan testere + iki formant süzgeci
  meow(t) {
    const base = rand(0.92, 1.1);
    const dur = 0.5;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(470 * base, t);
    osc.frequency.linearRampToValueAtTime(760 * base, t + 0.13);
    osc.frequency.linearRampToValueAtTime(640 * base, t + 0.3);
    osc.frequency.exponentialRampToValueAtTime(390 * base, t + dur);

    const f1 = filter('bandpass', 900, 5);
    f1.frequency.setValueAtTime(800, t);
    f1.frequency.linearRampToValueAtTime(1700, t + 0.16); // "mi-" -> "-ya-"
    f1.frequency.linearRampToValueAtTime(950, t + dur); // "-v"
    const f2 = filter('bandpass', 2700, 7);
    const f2g = ctx.createGain();
    f2g.gain.value = 0.45;

    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.06);
    g.gain.setValueAtTime(0.16, t + 0.28);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(g);
    f2.connect(f2g);
    f2g.connect(g);
    g.connect(sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  },

  // Alçak mırlama: ~24 Hz genlik modülasyonu
  purr(t) {
    const dur = 1.2;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    const src = noise(t, dur);
    const lp = filter('lowpass', 260, 0.8);
    const nlp = filter('lowpass', 420, 0.7);
    const ng = ctx.createGain();
    ng.gain.value = 0.5;

    // Tremolo: kazanç 0.5 ± 0.5 arasında salınır
    const trem = ctx.createGain();
    trem.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(25, t);
    lfo.frequency.linearRampToValueAtTime(21, t + dur);
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(trem.gain);

    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.18);
    g.gain.setValueAtTime(0.16, t + dur - 0.35);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);

    osc.connect(lp);
    lp.connect(trem);
    src.connect(nlp);
    nlp.connect(ng);
    ng.connect(trem);
    trem.connect(g);
    g.connect(sfxBus);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.03);
    lfo.stop(t + dur + 0.03);
  },

  // Eski telefon: iki kısa tril
  ring(t) {
    for (const start of [t, t + 0.5]) {
      const dur = 0.36;
      const a = ctx.createOscillator();
      a.type = 'triangle';
      a.frequency.value = 1320;
      const b = ctx.createOscillator();
      b.type = 'sine';
      b.frequency.value = 1760;
      const bg = ctx.createGain();
      bg.gain.value = 0.5;

      // Çan tokmağı: ~22 Hz kare tremolo
      const trem = ctx.createGain();
      trem.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 22;
      const depth = ctx.createGain();
      depth.gain.value = 0.45;
      lfo.connect(depth);
      depth.connect(trem.gain);
      const smooth = filter('lowpass', 5000, 0.5); // kare tremolonun tıklamasını yumuşat

      const g = ctx.createGain();
      g.gain.setValueAtTime(SILENT, start);
      g.gain.linearRampToValueAtTime(0.045, start + 0.01);
      g.gain.setValueAtTime(0.045, start + dur - 0.08);
      g.gain.exponentialRampToValueAtTime(SILENT, start + dur);

      a.connect(trem);
      b.connect(bg);
      bg.connect(trem);
      trem.connect(smooth);
      smooth.connect(g);
      g.connect(sfxBus);
      for (const node of [a, b, lfo]) {
        node.start(start);
        node.stop(start + dur + 0.03);
      }
    }
  },

  // Yudum: yukarı süpürülen dar bant gürültü
  sip(t) {
    const dur = 0.24;
    const src = noise(t, dur);
    const bp = filter('bandpass', 700, 5);
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + dur);
    const g = ctx.createGain();
    envelope(g.gain, t, 0.05, 0.12, dur - 0.05);
    src.connect(bp);
    bp.connect(g);
    g.connect(sfxBus);
  },

  // Su: birkaç damla + hafif hışırtı
  water(t) {
    const dur = 0.6;
    const src = noise(t, dur);
    const bp = filter('bandpass', 1800, 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.08);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(sfxBus);
    for (let i = 0; i < 6; i += 1) {
      const at = t + i * 0.085 + rand(0, 0.03);
      const f = rand(480, 900);
      tone({ type: 'sine', f, f2: f * rand(1.7, 2.3), t: at, attack: 0.004, decay: 0.06, peak: 0.045 });
    }
  },

  // Am akoru, teller 28 ms arayla (Karplus-Strong)
  strum(t) {
    const strings = [110, 164.81, 220, 261.63, 329.63];
    const lp = filter('lowpass', 3600, 0.5);
    const g = ctx.createGain();
    g.gain.value = 0.2;
    lp.connect(g);
    g.connect(sfxBus);
    strings.forEach((hz, i) => {
      const src = ctx.createBufferSource();
      src.buffer = pluckBuffer(hz);
      src.connect(lp);
      src.start(t + i * 0.028);
    });
  },

  // Neşeli başarım arpeji
  secret(t) {
    const notes = [72, 76, 79, 84];
    notes.forEach((midi, i) => {
      const at = t + i * 0.085;
      const lastOne = i === notes.length - 1;
      const decay = lastOne ? 0.4 : 0.11;
      tone({ type: 'square', f: midiHz(midi), t: at, decay, peak: 0.035 });
      tone({ type: 'triangle', f: midiHz(midi + 12), t: at, decay, peak: 0.03 });
    });
  },

  // Arcade jetonu: iki hızlı yükselen kare dalga notası (~0,25 sn)
  coin(t) {
    tone({ type: 'square', f: 987.77, t, attack: 0.004, decay: 0.06, peak: 0.04 }); // B5
    tone({ type: 'square', f: 1318.51, t: t + 0.07, attack: 0.004, decay: 0.17, peak: 0.04 }); // E6
  },

  // Dört pervaneli küçük drone uğultusu (~0,6 sn); 0,5 sn arayla art arda çağrılınca kesintisiz duyulur.
  // Yumuşak üçgen dalga, alçak geçiren süzgeç ve düşük seviye; perde çağrılar arasında yavaşça kayar
  // (her çağrıda yeni rastgele perde ardışık sesler arasında rahatsız edici vuru yapıyordu).
  drone(t) {
    const dur = 0.6;
    droneBase += (rand(140, 156) - droneBase) * 0.15;
    const base = droneBase;
    const lp = filter('lowpass', 900, 0.5);
    const g = ctx.createGain();
    // Uçlar doğrusal ve 0,1 sn: ardışık çağrılar çapraz geçişle toplamda sabit seviyede kalır
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022, t + 0.1);
    g.gain.setValueAtTime(0.022, t + dur - 0.1);
    g.gain.linearRampToValueAtTime(0, t + dur);
    lp.connect(g);
    g.connect(sfxBus);

    // Hafif perde dalgalanması: ~6 Hz LFO, ±6 sent
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.value = 6;
    lfo.connect(depth);

    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = base;
      osc.detune.value = detune;
      depth.connect(osc.detune);
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.03);
  },

  // Yumuşak "pof"
  sit(t) {
    const dur = 0.2;
    const src = noise(t, dur);
    const lp = filter('lowpass', 520, 0.7);
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g = ctx.createGain();
    envelope(g.gain, t, 0.012, 0.16, dur - 0.012);
    src.connect(lp);
    lp.connect(g);
    g.connect(sfxBus);
    tone({ type: 'sine', f: 130, f2: 62, t, attack: 0.01, decay: 0.14, peak: 0.07 });
  },
};

// Çekilmiş tel: gürültüyle doldurulan gecikme hattı + ortalama süzgeci. Sonuç önbelleğe alınır.
function pluckBuffer(hz) {
  const cached = stringCache.get(hz);
  if (cached) return cached;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 1.5);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / hz));
  let prev = 0;
  for (let i = 0; i < period; i += 1) {
    // Başlangıç gürültüsünü biraz yumuşat (daha sıcak tını)
    prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55;
    data[i] = prev;
  }
  for (let i = period; i < len; i += 1) {
    data[i] = 0.4975 * (data[i - period] + data[i - period + 1]);
  }
  // Tampon sonu tıklamasın
  const fade = Math.floor(sr * 0.15);
  for (let i = 0; i < fade; i += 1) data[len - 1 - i] *= i / fade;
  stringCache.set(hz, buf);
  return buf;
}

export function sfx(name) {
  if (!ready()) return;
  if (!Object.prototype.hasOwnProperty.call(SFX, name)) return;
  try {
    SFX[name](ctx.currentTime + 0.005);
  } catch {
    // ses hatası oyunu durdurmasın
  }
}

// ---------- Piyano notası ----------

// Sıcak elektrik piyano: üçgen + sinüs harmonikleri, kısa "tine" parıltısı.
export function note(midi, duration = 0.9) {
  if (!ready()) return;
  const m = Number(midi);
  if (!Number.isFinite(m)) return;
  const dur = Math.min(6, Math.max(0.12, Number(duration) || 0.9));
  try {
    const t = ctx.currentTime + 0.005;
    const hz = midiHz(Math.min(108, Math.max(21, m)));
    // Tiz notalar kulağa daha yüksek gelir; biraz kıs
    const peak = 0.17 * Math.min(1, Math.max(0.45, 1 - (m - 60) * 0.012));
    const end = t + 0.006 + dur;

    const voice = ctx.createGain();
    envelope(voice.gain, t, 0.006, peak, dur);
    const lp = filter('lowpass', Math.min(7000, hz * 6), 0.4);
    lp.connect(voice);
    voice.connect(noteBus);

    const partials = [
      { type: 'triangle', mult: 1, gain: 0.55, detune: 0 },
      { type: 'sine', mult: 1, gain: 0.4, detune: 5 }, // hafif koro
      { type: 'sine', mult: 2, gain: 0.14, detune: 0 },
      { type: 'sine', mult: 3, gain: 0.04, detune: 0 },
    ];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = p.type;
      osc.frequency.value = hz * p.mult;
      osc.detune.value = p.detune;
      g.gain.value = p.gain;
      osc.connect(g);
      g.connect(lp);
      osc.start(t);
      osc.stop(end + 0.03);
    }

    // Tine: hızla sönen üst harmonik
    const tine = ctx.createOscillator();
    const tg = ctx.createGain();
    tine.type = 'sine';
    tine.frequency.value = hz * 4;
    envelope(tg.gain, t, 0.003, 0.16, Math.min(0.16, dur));
    tine.connect(tg);
    tg.connect(lp);
    tine.start(t);
    tine.stop(t + 0.22);
  } catch {
    // sessizce geç
  }
}

// ---------- Ambiyans ----------

const PAD_CHORDS = [
  [48, 55, 64], // C
  [45, 52, 60], // Am
  [41, 48, 57], // F
  [43, 50, 59], // G
];

function playPad() {
  if (!amb || !ctx) return;
  const t = ctx.currentTime + 0.05;
  const chord = PAD_CHORDS[Math.floor(Math.random() * PAD_CHORDS.length)];
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.linearRampToValueAtTime(0.011, t + 2.5);
  g.gain.setValueAtTime(0.011, t + 4);
  g.gain.exponentialRampToValueAtTime(SILENT, t + 8);
  g.connect(amb.gain);
  for (const midi of chord) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiHz(midi);
    osc.detune.value = rand(-6, 6);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 8.1);
  }
}

function schedulePad(delay) {
  if (!amb) return;
  amb.timer = setTimeout(() => {
    if (!amb) return;
    playPad();
    schedulePad(rand(18000, 32000));
  }, delay);
}

function startAmbience() {
  if (amb || !ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = brownBuf;
  src.loop = true;
  const lp = filter('lowpass', 380, 0.5);
  const hum = ctx.createGain();
  hum.gain.value = 0.05;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.setTargetAtTime(1, t, 0.8); // yumuşak giriş
  src.connect(lp);
  lp.connect(hum);
  hum.connect(gain);
  gain.connect(ambBus);
  src.start(t, Math.random() * 4);
  amb = { src, gain, timer: null };
  schedulePad(rand(6000, 12000));
}

function stopAmbience() {
  if (!amb) return;
  const old = amb;
  amb = null;
  clearTimeout(old.timer);
  try {
    const t = ctx.currentTime;
    old.gain.gain.cancelScheduledValues(t);
    old.gain.gain.setTargetAtTime(0, t, 0.3); // yumuşak sönüş
    old.src.stop(t + 2);
    setTimeout(() => {
      try {
        old.gain.disconnect();
      } catch {
        // zaten kopmuş
      }
    }, 2300);
  } catch {
    // kaynak zaten durmuş olabilir
  }
}

// İstek, susturma ve sekme görünürlüğüne göre ambiyansı başlat/durdur.
function syncAmbience() {
  if (!ctx) return;
  const should = ambWanted && !readMuted() && !document.hidden;
  if (should) startAmbience();
  else stopAmbience();
}

export function ambience(on) {
  ambWanted = Boolean(on);
  syncAmbience(); // kilit açılmadıysa unlock() sonrası başlar
}
