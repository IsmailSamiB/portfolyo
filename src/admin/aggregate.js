// Yönetici paneli için saf toplama fonksiyonları (DOM/ağ yok; Node'da denenebilir).
// Girdi: [{ type, data, session, visitor, ref, lang, device, mode, at(ms) }]

const DAY = 86400000;

// Yerel saat dilimine göre gün anahtarı: '2026-10-03'
export function dayKey(ms) {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function sortedCounts(map) {
  return [...map.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function groupBySession(events) {
  const map = new Map();
  for (const event of events) {
    if (!event || !event.session) continue;
    let list = map.get(event.session);
    if (!list) map.set(event.session, (list = []));
    list.push(event);
  }
  for (const list of map.values()) list.sort((a, b) => a.at - b.at);
  return map;
}

// Oturum süresi: en büyük 'leave.seconds'; yoksa null
function sessionSeconds(list) {
  let best = null;
  for (const event of list) {
    if (event.type !== 'leave') continue;
    const seconds = Number(event.data && event.data.seconds);
    if (Number.isFinite(seconds) && (best == null || seconds > best)) best = seconds;
  }
  return best;
}

// Özet kartları
export function summarize(events, now = Date.now()) {
  const sessions = groupBySession(events);
  const visitors = new Set();
  const todayVisitors = new Set();
  const today = dayKey(now);
  let cvDownloads = 0;
  for (const event of events) {
    if (event.visitor) {
      visitors.add(event.visitor);
      if (dayKey(event.at) === today) todayVisitors.add(event.visitor);
    }
    if (event.type === 'cv') cvDownloads += 1;
  }

  let durationSum = 0;
  let durationCount = 0;
  let tourSessions = 0;
  let classicSessions = 0;
  for (const list of sessions.values()) {
    const seconds = sessionSeconds(list);
    if (seconds != null) {
      durationSum += seconds;
      durationCount += 1;
    }
    if (list.some((e) => e.type === 'tour' && e.data && e.data.active === true)) tourSessions += 1;
    if (list.some((e) => e.mode === 'classic' || (e.type === 'mode' && e.data && e.data.mode === 'classic'))) {
      classicSessions += 1;
    }
  }

  const total = sessions.size;
  return {
    visitors: visitors.size,
    sessions: total,
    todayVisitors: todayVisitors.size,
    avgSeconds: durationCount ? Math.round(durationSum / durationCount) : null,
    cvDownloads,
    tourRate: total ? tourSessions / total : null,
    classicRate: total ? classicSessions / total : null,
  };
}

// Son N günün günlük benzersiz ziyaretçi ve oturum sayıları (eskiden yeniye, boş günler dahil)
export function dailyVisits(events, days = 30, now = Date.now()) {
  const buckets = new Map();
  const end = new Date(now);
  end.setHours(12, 0, 0, 0); // yaz/kış saati geçişinde gün atlamasın
  for (let i = days - 1; i >= 0; i -= 1) {
    const ms = end.getTime() - i * DAY;
    buckets.set(dayKey(ms), { day: dayKey(ms), visitors: new Set(), sessions: new Set() });
  }
  for (const event of events) {
    const bucket = buckets.get(dayKey(event.at));
    if (!bucket) continue;
    if (event.visitor) bucket.visitors.add(event.visitor);
    if (event.session) bucket.sessions.add(event.session);
  }
  return [...buckets.values()].map((b) => ({ day: b.day, visitors: b.visitors.size, sessions: b.sessions.size }));
}

// Şirket etiketine (?ref=) göre: son ziyareti en yeni olan üstte
export function byRef(events) {
  const map = new Map();
  for (const event of events) {
    const ref = event.ref || '';
    let row = map.get(ref);
    if (!row) map.set(ref, (row = { ref, sessions: new Set(), visitors: new Set(), last: 0 }));
    if (event.session) row.sessions.add(event.session);
    if (event.visitor) row.visitors.add(event.visitor);
    if (event.at > row.last) row.last = event.at;
  }
  return [...map.values()]
    .map((row) => ({ ref: row.ref, sessions: row.sessions.size, visitors: row.visitors.size, last: row.last }))
    .sort((a, b) => b.last - a.last);
}

// Belirli türdeki olayların data.id'ye göre sayımı (çoktan aza)
export function countById(events, type) {
  const map = new Map();
  for (const event of events) {
    if (event.type !== type) continue;
    const id = String((event.data && event.data.id) || '');
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + 1);
  }
  return sortedCounts(map);
}

// En çok dokunulanlar: eşyalar (interact) ve açılan bölümler (panel)
export function topTouched(events) {
  return { interact: countById(events, 'interact'), panel: countById(events, 'panel') };
}

// Sırlar: her sırrı kaç oturumun bulduğu
export function secrets(events) {
  const map = new Map();
  for (const event of events) {
    if (event.type !== 'secret') continue;
    const id = String((event.data && event.data.id) || '');
    if (!id) continue;
    let set = map.get(id);
    if (!set) map.set(id, (set = new Set()));
    set.add(event.session);
  }
  const counts = new Map();
  for (const [id, set] of map) counts.set(id, set.size);
  return sortedCounts(counts);
}

// Mini oyun: en iyi skorlar
export function gameScores(events, top = 10) {
  return events
    .filter((e) => e.type === 'game' && Number.isFinite(Number(e.data && e.data.score)))
    .map((e) => ({ score: Number(e.data.score), at: e.at, ref: e.ref || '', device: e.device || '' }))
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, top);
}

// Dış bağlantı tıklamaları: host + path'e göre
export function linkClicks(events) {
  const map = new Map();
  for (const event of events) {
    if (event.type !== 'link') continue;
    const host = String((event.data && event.data.host) || '');
    if (!host) continue;
    const path = String((event.data && event.data.path) || '');
    const id = path && path !== '/' ? host + path : host;
    map.set(id, (map.get(id) || 0) + 1);
  }
  return sortedCounts(map);
}

// Oturum içindeki olayın kısa etiketi; null: sırada gösterilmez
function trailLabel(event) {
  const data = event.data || {};
  switch (event.type) {
    case 'panel':
    case 'interact':
    case 'overlay':
    case 'secret':
      return data.id ? String(data.id) : null;
    case 'cv':
      return 'cv';
    case 'link':
      return data.host ? `↗ ${data.host}` : null;
    case 'tour':
      return data.active ? 'tur başladı' : 'tur bitti';
    case 'game':
      return `oyun (${Number(data.score) || 0})`;
    case 'mode':
      return data.mode === 'classic' ? 'klasik görünüm' : 'oyun görünümü';
    case 'lang':
      return data.lang ? `dil: ${data.lang}` : null;
    default:
      return null; // visit, leave
  }
}

// Son oturumlar (yeniden eskiye). trail: olay sırası, art arda yinelenenler tekilleştirilmiş.
export function sessionList(events, max = 50) {
  const rows = [];
  for (const [session, list] of groupBySession(events)) {
    const first = list[0];
    const last = list[list.length - 1];
    const trail = [];
    for (const event of list) {
      const label = trailLabel(event);
      if (label && trail[trail.length - 1] !== label) trail.push(label);
    }
    rows.push({
      session,
      visitor: first.visitor || '',
      start: first.at,
      end: last.at,
      ref: list.find((e) => e.ref)?.ref || '',
      device: first.device || '',
      mode: list.some((e) => e.mode === 'classic') ? (list.some((e) => e.mode === 'game') ? 'ikisi de' : 'classic') : 'game',
      lang: last.lang || '',
      seconds: sessionSeconds(list),
      count: list.length,
      trail,
    });
  }
  return rows.sort((a, b) => b.start - a.start).slice(0, max);
}

// ---------- Biçimlendirme yardımcıları ----------

export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sn`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk ${s % 60} sn`;
  return `${Math.floor(m / 60)} sa ${m % 60} dk`;
}

export function formatPercent(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return `%${Math.round(ratio * 100)}`;
}

// Eksen için "güzel" üst sınır; yarısı da tam sayı olsun diye çift adımlar: 4, 6, 8, 10, 20, 40...
export function niceMax(value) {
  if (!(value > 0)) return 4;
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 4, 6, 8, 10]) {
    if (value <= step * pow) return step * pow;
  }
  return 10 * pow;
}
