// Yönetici paneli: …/?admin ile açılır. Tam sayfa; oyunu ve arayüzü gizler.
// Tüm içerik güvenli DOM ile (textContent) yazılır.
import './admin.css';
import { el } from '../ui/dom.js';
import { shareSection } from './share.js';
import { isRemote, admin, EVENTS_LIMIT } from '../data/store.js';
import {
  summarize,
  dailyVisits,
  byRef,
  refDetail,
  topTouched,
  secrets,
  gameScores,
  linkClicks,
  sessionList,
  formatDuration,
  formatPercent,
  niceMax,
} from './aggregate.js';

const RANGES = [7, 30, 90];
const REF_MAX = 50;
const DEV = Boolean(import.meta.env && import.meta.env.DEV);

let started = false;

const dateTime = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

function fmtTime(ms) {
  return ms && Number.isFinite(ms) && Math.abs(ms) < 8.64e15 ? dateTime.format(new Date(ms)) : '—';
}

// '2026-10-03' -> '3 Eki'
function fmtDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayMonth.format(new Date(y, m - 1, d));
}

const DEVICE_TR = { mobile: 'mobil', desktop: 'masaüstü' };
const MODE_TR = { game: 'oyun', classic: 'klasik', 'ikisi de': 'oyun + klasik' };
const NO_DATA = 'kayıt yok';

// ---------- Küçük görünüm parçaları ----------

function section(title, ...children) {
  return el('section', { class: 'adm-card' }, el('h2', { class: 'adm-h2', text: title }), ...children);
}

function empty(text = 'Henüz veri yok.') {
  return el('p', { class: 'adm-empty', text });
}

function table(headers, rows, caption) {
  return el(
    'div',
    { class: 'adm-table-wrap' },
    el(
      'table',
      { class: 'adm-table' },
      caption ? el('caption', { class: 'sr-only', text: caption }) : null,
      el('thead', null, el('tr', null, headers.map((h) => el('th', { scope: 'col', text: h })))),
      el(
        'tbody',
        null,
        rows.map((cells) =>
          el(
            'tr',
            null,
            cells.map((cell, i) => (i === 0 ? el('th', { scope: 'row', text: cell }) : el('td', { text: cell }))),
          ),
        ),
      ),
    ),
  );
}

// Yatay çubuk listesi: [{ id, count }]
function barList(items, max = 12) {
  if (!items.length) return empty();
  const top = items.slice(0, max);
  const peak = Math.max(...top.map((item) => item.count), 1);
  return el(
    'ul',
    { class: 'adm-bars' },
    top.map((item) => {
      const fill = el('span', { class: 'adm-bars__fill' });
      fill.style.width = `${Math.max(2, (item.count / peak) * 100)}%`;
      return el(
        'li',
        { class: 'adm-bars__row' },
        el('span', { class: 'adm-bars__label', text: item.id }),
        el('span', { class: 'adm-bars__track', 'aria-hidden': 'true' }, fill),
        el('span', { class: 'adm-bars__count', text: item.count }),
      );
    }),
  );
}

function summaryCards(s) {
  const cards = [
    ['Toplam ziyaretçi', s.visitors, 'benzersiz cihaz'],
    ['Oturum', s.sessions, 'sekme açılışı'],
    ['Bugünkü ziyaretçi', s.todayVisitors, 'benzersiz cihaz'],
    ['Ort. oturum süresi', formatDuration(s.avgSeconds), 'sekme görünürken'],
    ['CV indirme', s.cvDownloads, 'tıklama'],
    ['Tur başlatma', formatPercent(s.tourRate), 'oturumların oranı'],
    ['Klasik görünüm', formatPercent(s.classicRate), 'oturumların oranı'],
  ];
  return el(
    'dl',
    { class: 'adm-stats' },
    cards.map(([label, value, hint]) =>
      el(
        'div',
        { class: 'adm-stat' },
        el('dt', { class: 'adm-stat__label', text: label }),
        el('dd', { class: 'adm-stat__value', text: value }),
        el('dd', { class: 'adm-stat__hint', text: hint }),
      ),
    ),
  );
}

// Günlük ziyaret grafiği: CSS çubuklar + erişilebilir tablo karşılığı
function dailyChart(days) {
  const peak = Math.max(...days.map((d) => d.visitors), 0);
  const top = niceMax(peak);
  const total = days.reduce((sum, d) => sum + d.visitors, 0);
  const labelEvery = days.length <= 10 ? 1 : days.length <= 16 ? 2 : 5;

  const columns = days.map((d, i) => {
    const bar = el('span', { class: 'adm-chart__bar' });
    bar.style.height = `${(d.visitors / top) * 100}%`;
    if (!d.visitors) bar.classList.add('is-zero');
    // Sondan başlayarak etiketle ki bugünün etiketi hep görünsün
    const labelled = (days.length - 1 - i) % labelEvery === 0;
    return el(
      'div',
      { class: 'adm-chart__col', title: `${fmtDay(d.day)}: ${d.visitors} ziyaretçi, ${d.sessions} oturum` },
      el('div', { class: 'adm-chart__slot' }, bar),
      el('span', { class: 'adm-chart__x', text: labelled ? fmtDay(d.day) : '' }),
    );
  });

  const chart = el(
    'div',
    {
      class: 'adm-chart',
      role: 'img',
      'aria-label': `Son ${days.length} günde günlük benzersiz ziyaretçi. Toplam ${total}, en yüksek gün ${peak}. Ayrıntılar aşağıdaki tabloda.`,
    },
    el(
      'div',
      { class: 'adm-chart__y', 'aria-hidden': 'true' },
      el('span', { text: top }),
      el('span', { text: top / 2 }),
      el('span', { text: 0 }),
    ),
    el('div', { class: 'adm-chart__plot', 'aria-hidden': 'true' }, columns),
  );

  const rows = [...days].reverse().map((d) => [fmtDay(d.day), d.visitors, d.sessions]);
  return el(
    'div',
    null,
    el('p', { class: 'adm-note', text: 'Dikey eksen: günlük benzersiz ziyaretçi sayısı.' }),
    chart,
    el(
      'details',
      { class: 'adm-details' },
      el('summary', { text: 'Tablo olarak göster' }),
      table(['Gün', 'Ziyaretçi', 'Oturum'], rows, 'Günlük ziyaretler'),
    ),
  );
}

function sessionsView(rows) {
  if (!rows.length) return empty();
  return el(
    'div',
    { class: 'adm-sessions' },
    rows.map((row) =>
      el(
        'details',
        { class: 'adm-session' },
        el(
          'summary',
          { class: 'adm-session__head' },
          el('span', { class: 'adm-session__time', text: fmtTime(row.start) }),
          row.ref ? el('span', { class: 'adm-tag adm-tag--ref', text: row.ref }) : null,
          el('span', { class: 'adm-tag', text: DEVICE_TR[row.device] || row.device || '?' }),
          el('span', { class: 'adm-tag', text: MODE_TR[row.mode] || row.mode || '?' }),
          el('span', { class: 'adm-session__dur', text: formatDuration(row.seconds) }),
        ),
        el('p', { class: 'adm-session__trail', text: row.trail.length ? row.trail.join(' → ') : 'Hiçbir şeye dokunmadan ayrıldı.' }),
        el('p', {
          class: 'adm-note',
          text: `${row.count} olay · dil: ${row.lang || '?'} · ziyaretçi: ${row.visitor.slice(0, 6) || '?'}…`,
        }),
      ),
    ),
  );
}

// "ad (sayı), ad (sayı)" biçiminde kısa liste; boşsa "kayıt yok"
function countsText(items, max = 8) {
  if (!items.length) return NO_DATA;
  const text = items.slice(0, max).map((item) => `${item.id} (${item.count})`).join(', ');
  return items.length > max ? `${text} ve ${items.length - max} tane daha` : text;
}

// Bir etiketin ayrıntı özeti: yalnızca eldeki olaylardan; etiket-değer çiftleri düz metin
function refDetailView(events, ref) {
  const d = refDetail(events, ref);
  if (!d.has) return empty(NO_DATA);
  const modeParts = [
    ['oyun', d.modes.game],
    ['klasik', d.modes.classic],
    ['oyun + klasik', d.modes.both],
  ].filter(([, n]) => n > 0);
  const rows = [
    ['İlk ziyaret', fmtTime(d.first)],
    ['Son ziyaret', fmtTime(d.last)],
    ['Oturum / ziyaretçi', `${d.sessions} oturum, ${d.visitors} ziyaretçi`],
    ['Cihaz', countsText(d.devices.map((x) => ({ id: DEVICE_TR[x.id] || x.id, count: x.count })))],
    ['Kip', modeParts.length ? modeParts.map(([name, n]) => `${name} (${n})`).join(', ') : NO_DATA],
    ['Açılan bölümler', countsText([...d.panels, ...d.overlays].sort((a, b) => b.count - a.count))],
    ['Açılan projeler', countsText(d.projects)],
    ['CV', d.cvDownloads ? `indirildi (${d.cvDownloads} tıklama)` : 'indirilmedi'],
    ['Dış bağlantılar', countsText(d.links)],
    ['Toplam süre', formatDuration(d.totalSeconds)],
    ['Ortalama süre', formatDuration(d.avgSeconds)],
    ['Tur', d.tourSessions ? `${d.tourSessions} oturumda kullanıldı` : 'kullanılmadı'],
  ];
  return el(
    'dl',
    { class: 'adm-ref' },
    rows.map(([label, value]) => el('div', { class: 'adm-ref__row' }, el('dt', { text: label }), el('dd', { text: value }))),
  );
}

// Etiket tablosu: etiket bir düğme; basınca altında o etiketin özeti açılır (aynı anda bir tane)
function refTable(events, refs) {
  let openRow = null;
  const body = el('tbody');
  refs.forEach((r, i) => {
    const name = r.ref || '(etiketsiz)';
    const panelId = `adm-ref-${i}`;
    const btn = el('button', { class: 'adm-reftoggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': panelId, text: name });
    const detail = el('tr', { class: 'adm-refrow', id: panelId, hidden: true }, el('td', { colspan: 4 }));
    btn.addEventListener('click', () => {
      const willOpen = detail.hidden;
      if (openRow && openRow.detail !== detail) {
        openRow.detail.hidden = true;
        openRow.btn.setAttribute('aria-expanded', 'false');
      }
      detail.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        if (!detail.firstChild.firstChild) detail.firstChild.append(refDetailView(events, r.ref));
        openRow = { detail, btn };
      } else openRow = null;
    });
    body.append(
      el('tr', null, el('th', { scope: 'row' }, btn), el('td', { text: r.sessions }), el('td', { text: r.visitors }), el('td', { text: fmtTime(r.last) })),
      detail,
    );
  });
  return el(
    'div',
    { class: 'adm-table-wrap' },
    el(
      'table',
      { class: 'adm-table' },
      el('caption', { class: 'sr-only', text: 'Şirket etiketine göre ziyaretler; etikete basınca ayrıntı açılır' }),
      el('thead', null, el('tr', null, ['Etiket', 'Oturum', 'Ziyaretçi', 'Son ziyaret'].map((h) => el('th', { scope: 'col', text: h })))),
      body,
    ),
  );
}

function dashboard(events, days) {
  const touched = topTouched(events);
  const scores = gameScores(events, 10);
  const refs = byRef(events);
  const chartDays = Math.min(days, 30);
  return [
    section('Özet', summaryCards(summarize(events))),
    section(`Günlük ziyaret (son ${chartDays} gün)`, dailyChart(dailyVisits(events, chartDays))),
    section(
      'Şirket etiketine göre',
      el('p', { class: 'adm-note', text: 'Başvuru bağlantısındaki ?ref=… değeri. Etiketsiz ziyaretler "(etiketsiz)" satırında.' }),
      refs.length ? refTable(events, refs.slice(0, REF_MAX)) : empty(),
      refs.length ? el('p', { class: 'adm-note', text: 'Etikete basınca ayrıntı açılır. Özet yalnızca yüklenen olaylardan hesaplanır (en çok ' + EVENTS_LIMIT + ' olay).' }) : null,
      refs.length > REF_MAX ? el('p', { class: 'adm-note', text: `ve ${refs.length - REF_MAX} tane daha` }) : null,
    ),
    el(
      'div',
      { class: 'adm-grid' },
      section('En çok dokunulan eşyalar', barList(touched.interact)),
      section('En çok açılan bölümler', barList(touched.panel)),
      section('En çok açılan projeler', barList(touched.project)),
      section('Bulunan sırlar', el('p', { class: 'adm-note', text: 'Her sırrı bulan oturum sayısı.' }), barList(secrets(events), 20)),
      section('Dış bağlantı tıklamaları', barList(linkClicks(events))),
    ),
    section(
      'Mini oyun: en iyi 10 skor',
      scores.length
        ? table(
            ['Skor', 'Zaman', 'Etiket', 'Cihaz'],
            scores.map((s) => [s.score, fmtTime(s.at), s.ref || '—', DEVICE_TR[s.device] || s.device || '—']),
            'Mini oyun skorları',
          )
        : empty(),
    ),
    section('Son 50 oturum', el('p', { class: 'adm-note', text: 'Satıra tıklayınca ziyaretçinin izlediği sıra açılır.' }), sessionsView(sessionList(events, 50))),
  ];
}

// ---------- Panel ----------

export function initAdmin() {
  // Çerçeve içinde (clickjacking) panel hiç başlamasın
  try {
    if (window.top !== window.self) return;
  } catch {
    return;
  }
  if (started) return;
  started = true;

  for (const id of ['game', 'ui', 'classic']) {
    const node = document.getElementById(id);
    if (node) node.style.display = 'none';
  }
  document.body.classList.add('is-admin');
  document.title = 'Yönetici Paneli';

  let days = 30;
  let user = null;
  let loadToken = 0;

  const status = el('p', { class: 'adm-status', role: 'status', 'aria-live': 'polite' });
  const content = el('div', { class: 'adm-content' });
  const shareHost = el('div', { class: 'adm-content', hidden: true });
  const guestbookHost = el('div', { class: 'adm-content' });
  const scoresHost = el('div', { class: 'adm-content' });
  const who = el('span', { class: 'adm-who' });

  const rangeSelect = el(
    'select',
    { class: 'adm-select', id: 'adm-range', onChange: () => {
      days = Number(rangeSelect.value) || 30;
      load();
    } },
    RANGES.map((n) => el('option', { value: n, selected: n === days, text: `Son ${n} gün` })),
  );
  const refreshBtn = el('button', { class: 'adm-btn', type: 'button', text: 'Yenile', onClick: () => load() });
  const signOutBtn = el('button', { class: 'adm-btn adm-btn--ghost', type: 'button', text: 'Çıkış yap', onClick: () => admin.signOut() });
  const controls = el(
    'div',
    { class: 'adm-controls', hidden: true },
    el('label', { class: 'adm-label', for: 'adm-range', text: 'Aralık' }),
    rangeSelect,
    refreshBtn,
  );
  const account = el('div', { class: 'adm-account', hidden: true }, who, signOutBtn);

  const root = el(
    'div',
    { id: 'admin', class: 'adm' },
    el(
      'header',
      { class: 'adm-header' },
      el(
        'div',
        { class: 'adm-header__title' },
        el('h1', { class: 'adm-h1', text: 'Yönetici Paneli' }),
        el('a', { class: 'adm-link', href: './', text: '← Siteye dön' }),
      ),
      controls,
      account,
    ),
    el(
      'main',
      { class: 'adm-main' },
      el('p', { class: 'adm-note', text: 'Not: ziyaret verisi doğrulanmamıştır (herkes olay yazabilir); sayılar yalnızca fikir verir.' }),
      status,
      shareHost,
      content,
      scoresHost,
      guestbookHost,
    ),
  );
  document.body.append(root);

  function setStatus(text, isError = false) {
    status.textContent = text || '';
    status.classList.toggle('is-error', Boolean(isError));
    status.hidden = !text;
  }

  function errorText(err) {
    const code = String((err && (err.code || err.message)) || '');
    if (code.includes('permission-denied')) {
      return 'Erişim reddedildi. Güvenlik kuralları yayınlanmış mı ve doğru hesapla mı giriş yaptın? (docs/firebase-kurulum.md, 5. adım)';
    }
    if (code.includes('failed-precondition')) {
      return 'Sorgu için dizin eksik. docs/firebase-kurulum.md içindeki "Bileşik dizin" adımına bak.';
    }
    return `Veri alınamadı: ${code.slice(0, 120) || 'bilinmeyen hata'}`;
  }

  // ---- Ziyaretçi defteri moderasyonu ----
  // Liste bellekte tutulur; Onayla/Sil sonrası ağdan yeniden okunmaz, görünüm bellekten çizilir.
  let gbPending = [];
  let gbApproved = [];
  let scoreList = [];

  const shortName = (name) => String(name ?? '').slice(0, 40);

  // Dikkat çekmeyen ama yanlışlıkla basılmayacak toplu silme düğmesi (tek onay penceresi)
  function bulkButton(text, count, onConfirm, message) {
    const btn = el('button', { class: 'adm-btn adm-btn--quiet', type: 'button', text });
    btn.addEventListener('click', async () => {
      if (!count) return;
      if (!window.confirm(message || `${count} kayıt kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
      btn.disabled = true;
      try {
        await onConfirm();
      } catch (err) {
        setStatus(errorText(err), true);
        btn.disabled = false;
      }
    });
    return btn;
  }

  function entryView(entry) {
    const actions = el('div', { class: 'adm-entry__actions' });
    const run = async (fn) => {
      for (const btn of actions.querySelectorAll('button')) btn.disabled = true;
      try {
        await fn();
        renderGuestbook();
      } catch (err) {
        setStatus(errorText(err), true);
        for (const btn of actions.querySelectorAll('button')) btn.disabled = false;
      }
    };
    if (entry.status === 'pending') {
      actions.append(
        el('button', {
          class: 'adm-btn adm-btn--ok',
          type: 'button',
          text: 'Onayla',
          onClick: () =>
            run(async () => {
              await admin.approve(entry.id);
              gbPending = gbPending.filter((e) => e.id !== entry.id);
              gbApproved = [{ ...entry, status: 'approved' }, ...gbApproved];
            }),
        }),
      );
    }
    actions.append(
      el('button', {
        class: 'adm-btn adm-btn--danger',
        type: 'button',
        text: 'Sil',
        onClick: () => {
          if (!window.confirm(`"${shortName(entry.name)}" adlı kişinin mesajı kalıcı olarak silinsin mi?`)) return;
          run(async () => {
            await admin.remove(entry.id);
            gbPending = gbPending.filter((e) => e.id !== entry.id);
            gbApproved = gbApproved.filter((e) => e.id !== entry.id);
          });
        },
      }),
    );
    return el(
      'li',
      { class: 'adm-entry' },
      el(
        'div',
        { class: 'adm-entry__body' },
        el('p', { class: 'adm-entry__meta' }, el('strong', { text: entry.name }), ` · ${fmtTime(entry.createdAt)}`),
        el('p', { class: 'adm-entry__msg', text: entry.message }),
      ),
      actions,
    );
  }

  function renderGuestbook() {
    guestbookHost.replaceChildren(
      section(
        'Ziyaretçi defteri',
        el('h3', { class: 'adm-h3', text: `Onay bekleyenler (${gbPending.length})` }),
        gbPending.length ? el('ul', { class: 'adm-entries' }, gbPending.map((e) => entryView(e))) : empty('Bekleyen mesaj yok.'),
        gbPending.length
          ? bulkButton('Bekleyenlerin tümünü sil', gbPending.length, async () => {
              await admin.removeMany(gbPending.map((e) => e.id));
              await loadGuestbook();
            })
          : null,
        el('h3', { class: 'adm-h3', text: `Yayındakiler (${gbApproved.length})` }),
        gbApproved.length ? el('ul', { class: 'adm-entries' }, gbApproved.map((e) => entryView(e))) : empty('Henüz onaylanmış mesaj yok.'),
      ),
    );
  }

  async function loadGuestbook() {
    const [pending, approved] = await Promise.all([admin.guestbookPending(), admin.guestbookApproved()]);
    gbPending = pending;
    gbApproved = approved;
    renderGuestbook();
  }

  // ---- Skor tablosu ----
  function scoreRow(entry) {
    const btn = el('button', {
      class: 'adm-btn adm-btn--danger',
      type: 'button',
      text: 'Sil',
      onClick: async () => {
        if (!window.confirm(`"${shortName(entry.name)}" rumuzlu ${entry.score} puanlık skor kalıcı olarak silinsin mi?`)) return;
        btn.disabled = true;
        try {
          await admin.removeScore(entry.id);
          scoreList = scoreList.filter((e) => e.id !== entry.id);
          renderScores();
        } catch (err) {
          setStatus(errorText(err), true);
          btn.disabled = false;
        }
      },
    });
    return el(
      'li',
      { class: 'adm-entry' },
      el(
        'div',
        { class: 'adm-entry__body' },
        el('p', { class: 'adm-entry__meta' }, el('strong', { text: entry.name }), ` · ${entry.score} puan · ${fmtTime(entry.at)}`),
      ),
      el('div', { class: 'adm-entry__actions' }, btn),
    );
  }

  function renderScores() {
    scoresHost.replaceChildren(
      section(
        'Skor tablosu',
        isRemote() ? null : el('p', { class: 'adm-note', text: 'Yerel mod: bu tarayıcıdaki skor tablosu gösteriliyor.' }),
        scoreList.length ? el('ul', { class: 'adm-entries' }, scoreList.map((e) => scoreRow(e))) : empty('Henüz skor yok.'),
        scoreList.length
          ? bulkButton('Listelenen skorların tümünü sil', scoreList.length, async () => {
              await admin.removeScores(scoreList.map((e) => e.id));
              await loadScores();
            })
          : null,
      ),
    );
  }

  async function loadScores() {
    scoreList = await admin.scoresAll();
    renderScores();
  }

  // ---- Veri yükleme ----
  async function load() {
    const token = ++loadToken;
    setStatus('Yükleniyor…');
    refreshBtn.disabled = true;
    try {
      const events = await admin.events({ days });
      if (token !== loadToken) return;
      content.replaceChildren(...dashboard(events, days));
      if (isRemote()) {
        content.append(
          section(
            'Veri bakımı',
            bulkButton(
              '30 günden eski olayları sil',
              1,
              async () => {
                const n = await admin.purgeOldEvents();
                await load();
                setStatus(n ? `${n} eski olay silindi.${n >= 400 ? ' Daha fazlası olabilir; düğmeye yeniden bas.' : ''}` : 'Silinecek eski olay yok.');
              },
              '30 günden eski olaylardan en çok 400 kayıt kalıcı olarak silinsin mi? Bu işlem geri alınamaz.',
            ),
          ),
        );
      }
      setStatus(
        events.length >= EVENTS_LIMIT
          ? `Not: son ${EVENTS_LIMIT} olay gösteriliyor; daha eski olaylar bu aralığa dahil edilmedi.`
          : events.length
            ? ''
            : 'Bu aralıkta kayıtlı olay yok.',
      );
    } catch (err) {
      if (token !== loadToken) return;
      content.replaceChildren();
      setStatus(errorText(err), true);
    }
    try {
      await loadScores();
    } catch (err) {
      if (token === loadToken) scoresHost.replaceChildren(section('Skor tablosu', el('p', { class: 'adm-empty', text: errorText(err) })));
    }
    if (isRemote()) {
      try {
        await loadGuestbook();
      } catch (err) {
        if (token === loadToken) guestbookHost.replaceChildren(section('Ziyaretçi defteri', el('p', { class: 'adm-empty', text: errorText(err) })));
      }
    }
    if (token === loadToken) refreshBtn.disabled = false;
  }

  function showShare() {
    if (!shareHost.firstChild) shareHost.append(shareSection(section));
    shareHost.hidden = false;
  }

  function clear() {
    loadToken += 1;
    content.replaceChildren();
    guestbookHost.replaceChildren();
    scoresHost.replaceChildren();
    controls.hidden = true;
    account.hidden = true;
    shareHost.hidden = true;
    setStatus('');
  }

  // ---- Durumlar ----
  function showSetup() {
    clear();
    content.append(
      el(
        'section',
        { class: 'adm-card adm-card--notice' },
        el('h2', { class: 'adm-h2', text: 'Firebase henüz bağlanmadı' }),
        el('p', { text: 'Site şu an yerel modda çalışıyor: ziyaret verisi hiçbir yere kaydedilmiyor ve ziyaretçi defteri kapalı.' }),
        el(
          'p',
          null,
          'Kurmak için proje klasöründeki ',
          el('code', { text: 'docs/firebase-kurulum.md' }),
          ' belgesindeki adımları izle ve Firebase konsolundan aldığın değerleri ',
          el('code', { text: 'src/data/config.js' }),
          ' dosyasına yapıştır.',
        ),
      ),
    );
    loadScores().catch(() => {}); // yerel skor tablosu
    showShare(); // Firebase'siz yerel modda da çalışır
    if (DEV) {
      // Geliştirme: bu sekmenin bellekteki olaylarıyla paneli dene
      const host = el('div', { class: 'adm-content' });
      content.append(
        el('p', { class: 'adm-status', text: 'Geliştirme modu: aşağıda yalnızca bu sekmede biriken yerel olaylar gösteriliyor (window.__metrics).' }),
        host,
      );
      admin
        .events({ days })
        .then((events) => host.replaceChildren(...dashboard(events, days)))
        .catch(() => {});
    }
  }

  function showLogin(message) {
    clear();
    const btn = el('button', {
      class: 'adm-btn adm-btn--accent adm-btn--big',
      type: 'button',
      text: 'Google ile giriş yap',
      onClick: async () => {
        deniedShown = false;
        btn.disabled = true;
        setStatus('Giriş penceresi açılıyor…');
        const result = await admin.signIn();
        btn.disabled = false;
        if (!result) {
          setStatus('Giriş tamamlanmadı. Açılır pencere engellenmiş olabilir ya da bu alan adı Firebase\'de yetkili değil (kurulum belgesi, 7. adım).', true);
        }
      },
    });
    content.append(
      el(
        'section',
        { class: 'adm-card adm-card--center' },
        el('h2', { class: 'adm-h2', text: 'Giriş' }),
        el('p', { text: message || 'Bu sayfa yalnızca site sahibine açıktır.' }),
        btn,
      ),
    );
  }

  // Yetkisiz hesap: ileti gösterilir, oturum hemen kapatılır (yönetici adresi gösterilmez)
  let deniedShown = false;
  function showDenied() {
    clear();
    deniedShown = true;
    content.append(
      el(
        'section',
        { class: 'adm-card adm-card--center' },
        el('h2', { class: 'adm-h2', text: 'Bu hesabın yetkisi yok' }),
        el('p', { text: 'Bu hesabın yetkisi yok; oturum kapatıldı. Panel yalnızca site sahibine açıktır.' }),
        el('button', {
          class: 'adm-btn',
          type: 'button',
          text: 'Başka hesapla dene',
          onClick: () => {
            deniedShown = false;
            showLogin();
          },
        }),
      ),
    );
    admin.signOut();
  }

  function showDashboard() {
    clear();
    controls.hidden = false;
    account.hidden = false;
    who.textContent = user.email;
    showShare();
    load();
  }

  if (!isRemote()) {
    showSetup();
    return;
  }

  setStatus('Oturum denetleniyor…');
  admin.onAuth((next) => {
    const same = user && next && user.uid === next.uid;
    user = next;
    if (!next) {
      if (!deniedShown) showLogin(); // yetkisiz çıkış sonrası ileti silinmesin
    } else if (!next.isAdmin) showDenied();
    else if (!same) showDashboard();
  });
}
