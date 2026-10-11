import './panels.css';
import { emit, on } from '../bridge.js';
import { pick, lang } from '../i18n.js';
import content from '../content/content.js';
import { sortedProjects, projectDate } from '../content/projects.js';
import S from './strings.js';
import { el, extLink, safeUrl, toParagraphs, reducedMotion } from './dom.js';

// Panel gövdelerini üreten fonksiyonlar. ctx = { state, refresh, tour }:
// state panel açık kaldığı sürece yaşar, refresh gövdeyi yeniden çizer.

// Bu dosyaya özgü yeni metinler (strings.js'e dokunulmaz).
const T = {
  tabsLabel: { tr: 'Hakkımda bölümleri', en: 'About sections' },
  tabs: {
    story: { tr: 'Hikâyem', en: 'My story' },
    experience: { tr: 'Deneyim', en: 'Experience' },
    activities: { tr: 'Aktiviteler', en: 'Activities' },
    education: { tr: 'Eğitim', en: 'Education' },
  },
  certificates: { tr: 'Sertifikalar', en: 'Certificates' },
  gallery: { tr: 'Proje görselleri', en: 'Project images' },
  prev: { tr: 'Önceki görsel', en: 'Previous image' },
  next: { tr: 'Sonraki görsel', en: 'Next image' },
  legendTitle: { tr: 'Seviye açıklaması', en: 'Level guide' },
  legend: [
    { n: 1, text: { tr: 'temel / öğreniyorum', en: 'basic / learning' } },
    { n: 2, text: { tr: 'gelişiyor', en: 'developing' } },
    { n: 3, text: { tr: 'rahat kullanıyorum', en: 'comfortable' } },
    { n: 4, text: { tr: 'iyi', en: 'good' } },
    { n: 5, text: { tr: 'çok iyi', en: 'very good' } },
  ],
};

// 5'lik pixel seviye göstergesi (klasik görünüm de kullanır).
// opts.animate: bloklar soldan sağa sırayla dolar; opts.delay: başlangıç gecikmesi (ms).
export function levelBlocks(level, opts) {
  const value = Math.max(0, Math.min(5, Math.round(Number(level) || 0)));
  const animate = Boolean(opts && opts.animate);
  const delay = (opts && opts.delay) || 0;
  const blocks = [];
  for (let i = 1; i <= 5; i += 1) {
    blocks.push(
      el('span', {
        class: i <= value ? 'lvl-b is-on' : 'lvl-b',
        style: animate ? `--d:${delay + i * 30}ms` : null,
      }),
    );
  }
  return el(
    'span',
    { class: animate ? 'lvl lvl--anim' : 'lvl', role: 'img', 'aria-label': `${pick(S.skills.level)} ${value}/5` },
    blocks,
  );
}

export function tagList(tags) {
  return el(
    'ul',
    { class: 'tags' },
    (tags || []).map((tag) => el('li', { class: 'tag', text: pick(tag) })),
  );
}

// Demo / kaynak / ek bağlantı düğmeleri: düğmeler kendi genişliğinde yan yana, ek bağlantı notları
// düğme satırının altında tam genişlikte (klasik görünümdeki düzen); link yoksa null döner.
export function projectLinks(project, className) {
  const links = project.links || {};
  const buttons = [];
  const notes = [];
  const add = (url, label, cls, note) => {
    const link = extLink(url, label, cls);
    if (note) {
      const id = `link-note-${project.id || 'p'}-${notes.length}`;
      link.setAttribute('aria-describedby', id);
      notes.push(el('p', { class: 'link-note', id, text: note }));
    }
    buttons.push(link);
  };
  if (links.demo) add(links.demo, pick(S.projects.demo), `${className} px-btn--accent`);
  if (links.source) add(links.source, pick(S.projects.source), className);
  (links.extra || []).forEach((x) => {
    if (x && x.url) add(x.url, pick(x.label), className, x.note ? pick(x.note) : '');
  });
  return buttons.length ? el('div', { class: 'link-block' }, el('div', { class: 'btn-row' }, buttons), notes) : null;
}

function hideOnError(img, target) {
  img.addEventListener('error', () => {
    (target || img).hidden = true;
  });
  return img;
}

/* ---------- Hakkımda ---------- */

function timeline(items) {
  return el(
    'ol',
    { class: 'timeline' },
    items.map((item) => {
      const fields = [
        el('span', { class: 'timeline-period', text: pick(item.period) }),
        el('strong', { class: 'timeline-title', text: pick(item.title) }),
        el('span', { class: 'timeline-org', text: pick(item.org) }),
        item.note && el('p', { class: 'timeline-note', text: pick(item.note) }),
        // Aynı kurumda birden çok görev: iç içe rol listesi
        item.roles?.length > 0 &&
          el(
            'ol',
            { class: 'timeline-roles' },
            item.roles.map((role) =>
              el(
                'li',
                { class: `timeline-role${/devam|present/i.test(pick(role.period)) ? ' is-current' : ''}` },
                el('span', { class: 'timeline-role-period', text: pick(role.period) }),
                el('strong', { class: 'timeline-role-title', text: pick(role.title) }),
                role.note && el('p', { class: 'timeline-role-note', text: pick(role.note) }),
              ),
            ),
          ),
      ];
      // Logosu olmayan kayıtlar eskisi gibi çizilir
      const now = /devam|present/i.test(pick(item.period)) ? ' is-current' : '';
      if (!item.logo) return el('li', { class: `timeline-item${now}` }, fields);
      const img = el('img', {
        src: safeUrl(item.logo),
        alt: pick(item.org),
        width: 48,
        height: 48,
        loading: 'lazy',
        decoding: 'async',
      });
      const logo = el('span', { class: 'timeline-logo' }, img);
      hideOnError(img, logo);
      return el('li', { class: `timeline-item timeline-item--logo${now}` }, logo, el('div', { class: 'timeline-text' }, fields));
    }),
  );
}

function about(ctx) {
  const st = ctx.state;
  const p = content.profile || {};

  let portrait = null;
  if (p.portrait) {
    const img = el('img', {
      src: safeUrl(p.portrait),
      alt: `${pick(S.about.portrait)}: ${p.name || ''}`,
      width: 96,
      height: 96,
      loading: 'lazy',
      decoding: 'async',
    });
    portrait = el('div', { class: 'portrait' }, img);
    hideOnError(img, portrait);
  }

  const highlights = p.highlights || [];
  const experience = content.experience || [];
  const activities = content.activities || [];
  const education = content.education || [];
  const certificates = content.certificates || [];

  const tabs = [
    {
      id: 'story',
      render: () => [
        el(
          'div',
          { class: 'prose' },
          toParagraphs(p.bio, pick).map((text) => el('p', { text })),
        ),
        highlights.length > 0 &&
          el(
            'section',
            null,
            el('h3', { class: 'sub', text: pick(S.about.highlights) }),
            el(
              'ul',
              { class: 'badges' },
              highlights.map((item) => el('li', { class: 'badge', text: pick(item) })),
            ),
          ),
      ],
    },
    { id: 'experience', render: () => (experience.length ? timeline(experience) : null) },
    ...(activities.length ? [{ id: 'activities', render: () => timeline(activities) }] : []),
    {
      id: 'education',
      render: () => [
        education.length > 0 && timeline(education),
        certificates.length > 0 &&
          el(
            'section',
            null,
            el('h3', { class: 'sub', text: pick(T.certificates) }),
            el(
              'ul',
              { class: 'star-list' },
              certificates.map((item) => el('li', { text: pick(item) })),
            ),
          ),
      ],
    },
  ];

  if (!(st.tab >= 0 && st.tab < tabs.length)) st.tab = 0;
  const select = (index) => {
    st.tab = index;
    st.focus = 'tab';
    ctx.refresh();
  };

  const tabButtons = tabs.map((tab, i) =>
    el('button', {
      type: 'button',
      class: i === st.tab ? 'tab is-active' : 'tab',
      role: 'tab',
      id: `about-tab-${tab.id}`,
      'aria-selected': i === st.tab ? 'true' : 'false',
      'aria-controls': i === st.tab ? 'about-tabpanel' : null,
      tabindex: i === st.tab ? '0' : '-1',
      'data-focus-me': i === st.tab && st.focus === 'tab' ? true : null,
      text: pick(T.tabs[tab.id]),
      onclick: () => select(i),
    }),
  );
  const tablist = el('div', { class: 'tablist', role: 'tablist', 'aria-label': pick(T.tabsLabel) }, tabButtons);
  // Ok tuşlarıyla sekmeler arasında gezinme
  tablist.addEventListener('keydown', (event) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    let next = null;
    if (event.key in keys) next = (st.tab + keys[event.key] + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next == null) return;
    event.preventDefault();
    select(next);
  });

  return el(
    'div',
    { class: 'about' },
    el(
      'header',
      { class: 'about-head' },
      portrait,
      el(
        'div',
        { class: 'about-id' },
        el('h3', { class: 'about-name', text: p.name }),
        el('p', { class: 'about-title', text: pick(p.title) }),
        el('p', { class: 'about-tagline', text: pick(p.tagline) }),
        p.location && el('p', { class: 'about-location', text: pick(p.location) }),
      ),
    ),
    tablist,
    el(
      'div',
      { class: 'tabpanel', role: 'tabpanel', id: 'about-tabpanel', 'aria-labelledby': `about-tab-${tabs[st.tab].id}` },
      tabs[st.tab].render(),
    ),
  );
}

/* ---------- Projeler ---------- */

// 12x12 pixel simgeler; harf -> renk (PAL).
const PAL = {
  K: '#2b2030',
  O: '#d9622b',
  o: '#a8431a',
  C: '#f4e4c1',
  c: '#e0c996',
  G: '#4fa66a',
  g: '#2f6f48',
  W: '#8b5a3c',
  B: '#4f86c6',
  b: '#2f5a8c',
  Y: '#ffd23f',
  y: '#c9a020',
  S: '#c9c2b0',
  s: '#8a8498',
};

const ICONS = {
  home: [
    '.....KK.....',
    '....KOOK....',
    '...KOOOOK...',
    '..KOOOOOOK..',
    '.KOOOOOOOOK.',
    'KKCCCCCCCCKK',
    '.KCYYCCCCCK.',
    '.KCYYCKKKCK.',
    '.KCCCCKKKCK.',
    '.KCCCCKKWCK.',
    '.KCCCCKKKCK.',
    '.KKKKKKKKKK.',
  ],
  book: [
    '.KKKKKKKKKK.',
    'KBBBBBBBBBBK',
    'KBYYYYYYYBBK',
    'KBBBBBBBBBBK',
    'KBYYYYBBBBBK',
    'KBBBBBBBBBBK',
    'KBBBBBBBBBBK',
    'KBBBBBBBBBBK',
    'KbbbbbbbbbbK',
    'KKCCCCCCCCKK',
    '.KCCCCCCCCK.',
    '..KKKKKKKK..',
  ],
  train: [
    '..KKKKKKKK..',
    '.KSSSSSSSSK.',
    '.KSBBSSBBSK.',
    '.KSBBSSBBSK.',
    '.KSSSSSSSSK.',
    '.KOOOOOOOOK.',
    '.KSSYSSYSSK.',
    '.KSSSSSSSSK.',
    '.KKKKKKKKKK.',
    '..KsK..KsK..',
    '.KKKK..KKKK.',
    'KKKKKKKKKKKK',
  ],
  calendar: [
    '..K......K..',
    '.KKKKKKKKKK.',
    '.KOOOOOOOOK.',
    '.KOOOOOOOOK.',
    '.KCCCCCCCCK.',
    '.KCGGCCGGCK.',
    '.KCGGCCGGCK.',
    '.KCCCCCCCCK.',
    '.KCGGCCCCCK.',
    '.KCGGCCCCCK.',
    '.KCCCCCCCCK.',
    '.KKKKKKKKKK.',
  ],
  trophy: [
    '.KKKKKKKKKK.',
    'KKYYYYYYYYKK',
    'KYKYYYYYyKYK',
    'KYKYYYYYyKYK',
    'KKKYYYYYyKKK',
    '..KYYYYYyK..',
    '...KYYYyK...',
    '.....KyK....',
    '.....KYK....',
    '..KKKKKKKK..',
    '..KWWWWWWK..',
    '..KKKKKKKK..',
  ],
  drone: [
    'KKKKK..KKKKK',
    'ssssK..Kssss',
    '..KKKKKKKK..',
    '...KOOOOK...',
    '...KOYYOK...',
    '...KOOOOK...',
    '..KKKKKKKK..',
    '..K..KK..K..',
    '..K..KK..K..',
    '.KKK.KK.KKK.',
    '............',
    '............',
  ],
};

const SVGNS = 'http://www.w3.org/2000/svg';

function pixelIcon(name) {
  const rows = ICONS[name] || ICONS.book;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('width', '48');
  svg.setAttribute('height', '48');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'os-ico');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = PAL[ch];
      if (!fill) return;
      const rect = document.createElementNS(SVGNS, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', '1');
      rect.setAttribute('height', '1');
      rect.setAttribute('fill', fill);
      svg.append(rect);
    });
  });
  return svg;
}

// Görsel gezgini: büyük görsel + altyazı + ◄ ► + sayaç. Dizin st.gIdx'te saklanır.
function gallery(project, st) {
  const items = (project.gallery || []).filter((g) => g && g.src);
  if (!items.length) return null;
  const total = items.length;
  let idx = Math.min(Math.max(Number(st.gIdx) || 0, 0), total - 1);

  const img = el('img', { class: 'gal-img', loading: 'lazy', decoding: 'async', alt: '' });
  const cap = el('figcaption', { class: 'gal-cap' });
  const count = el('span', { class: 'gal-count', 'aria-live': 'polite' });
  img.addEventListener('error', () => {
    img.hidden = true;
  });

  const show = () => {
    const item = items[idx];
    const caption = pick(item.caption);
    img.hidden = false;
    // Dikey telefon ekranı: yüksekliğe sığan, pikselleştirilmeyen görünüm (panels.css .is-portrait).
    node.classList.toggle('is-portrait', Boolean(item.portrait));
    img.src = safeUrl(item.src);
    img.alt = caption || pick(project.title);
    cap.textContent = caption;
    count.textContent = `${idx + 1}/${total}`;
    st.gIdx = idx;
  };
  const go = (step) => {
    if (total < 2) return;
    idx = (idx + step + total) % total;
    show();
  };

  const nav = (label, glyph, step) =>
    el('button', { type: 'button', class: 'gal-btn', 'aria-label': pick(label), title: pick(label), text: glyph, onclick: () => go(step) });

  const node = el(
    'figure',
    { class: 'gal', role: 'group', 'aria-label': pick(T.gallery) },
    el('div', { class: 'gal-frame' }, img),
    cap,
    el(
      'div',
      { class: 'gal-ctrl', hidden: total < 2 },
      nav(T.prev, '◄', -1),
      count,
      nav(T.next, '►', 1),
    ),
  );
  show();
  if (total < 2) count.textContent = '';
  return { node, go };
}

function projectWindow(project, ctx, closeWindow) {
  const st = ctx.state;
  const titleId = 'os-win-title';
  const gal = gallery(project, st);

  let cover = null;
  if (!gal && project.cover) {
    cover = hideOnError(
      el('img', { class: 'os-win-image', src: safeUrl(project.cover), alt: pick(project.title), loading: 'lazy', decoding: 'async' }),
    );
  }

  const stats = project.stats || [];
  const win = el(
    'article',
    { class: 'os-win', role: 'group', 'aria-labelledby': titleId, tabindex: '-1' },
    el(
      'header',
      { class: 'os-win-bar' },
      el('h3', { class: 'os-win-title', id: titleId, text: pick(project.title) }),
      el('button', { type: 'button', class: 'bar-btn', 'aria-label': pick(S.projects.closeWindow), onclick: closeWindow }, '✕'),
    ),
    el(
      'div',
      { class: 'os-win-body' },
      cover,
      gal && gal.node,
      el('p', { class: 'os-win-year', text: projectDate(project.date, lang()) }),
      el('p', { class: 'os-win-summary', text: pick(project.summary) }),
      stats.length > 0 &&
        el(
          'ul',
          { class: 'stat-grid' },
          stats.map((s) =>
            el('li', { class: 'stat' }, el('strong', { class: 'stat-value', text: pick(s.value) }), el('span', { class: 'stat-label', text: pick(s.label) })),
          ),
        ),
      project.findings &&
        project.findings.length > 0 &&
        el(
          'div',
          { class: 'findings' },
          el('h4', { class: 'findings-title', text: pick(S.projects.findings) }),
          el('ul', { class: 'findings-list' }, project.findings.map((item) => el('li', { text: pick(item) }))),
        ),
      project.tags && project.tags.length > 0 && tagList(project.tags),
      projectLinks(project, 'px-btn'),
    ),
  );
  // Sol/sağ ok tuşları galeriyi gezer
  if (gal) {
    win.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      gal.go(event.key === 'ArrowLeft' ? -1 : 1);
    });
  }
  if (st.focus === 'window') win.setAttribute('data-focus-me', '');
  return win;
}

function stopClock(st) {
  clearTimeout(st.clockTimer);
  st.clockTimer = null;
}

// Görev çubuğu saati: gerçek saat, dakika başında güncellenir.
function clock(st) {
  const node = el('span', { class: 'os-clock' });
  const fmt = () => {
    node.textContent = new Date().toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit' });
  };
  const schedule = () => {
    st.clockTimer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
  };
  const tick = () => {
    if (!node.isConnected) {
      stopClock(st);
      return;
    }
    fmt();
    schedule();
  };
  stopClock(st);
  fmt();
  schedule();
  // Panel kapanırken zamanlayıcı temizlenir (panels.js dispose çağırır).
  st.dispose = () => stopClock(st);
  return node;
}

// panel:open { id: 'projects', project } ile istenen proje (projeye doğrudan bağlantı): panel çizilirken
// penceresi açılır. Bu dinleyici panels.js'tekinden önce kaydolur, yani istek ilk çizimden önce hazırdır.
let requestedProject = '';
on('panel:open', (detail) => {
  requestedProject = detail && detail.id === 'projects' && typeof detail.project === 'string' ? detail.project : '';
});

// Proje penceresini açmanın tek yolu (ikon tıklaması ve doğrudan bağlantı): durumu kurar, project:open yayar.
function openWindow(st, id) {
  st.openId = id;
  st.gIdx = 0;
  st.focus = 'window';
  emit('project:open', { id });
}

// Retro masaüstü: ikonlar + açılan proje penceresi.
function projects(ctx) {
  const st = ctx.state;
  const list = sortedProjects();
  if (requestedProject) {
    // İçerikte olmayan kimlik yok sayılır (masaüstü normal açılır).
    if (list.some((p) => p.id === requestedProject)) openWindow(st, requestedProject);
    requestedProject = '';
  }
  const current = list.find((p) => p.id === st.openId) || null;

  const closeWindow = () => {
    st.lastId = st.openId;
    st.openId = null;
    st.focus = 'icon';
    ctx.refresh();
  };
  // Esc önce açık pencereyi kapatır, sonra paneli.
  st.onEscape = current
    ? () => {
        closeWindow();
        return true;
      }
    : null;

  const icons = el(
    'div',
    { class: 'os-icons' },
    list.map((p) => {
      const button = el(
        'button',
        {
          type: 'button',
          class: 'os-icon',
          onclick: () => {
            openWindow(st, p.id);
            ctx.refresh();
          },
        },
        el('span', { class: 'os-ico-wrap', 'aria-hidden': 'true' }, pixelIcon(p.icon)),
        el('span', { class: 'os-icon-label', text: pick(p.title) }),
        el('span', { class: 'os-icon-date', text: projectDate(p.date, lang()) }),
      );
      if (!current && st.focus === 'icon' && st.lastId === p.id) button.setAttribute('data-focus-me', '');
      return button;
    })
  );
  if (current) icons.setAttribute('inert', '');

  return el(
    'div',
    { class: 'os' },
    el(
      'div',
      { class: 'os-desk' },
      icons,
      !current && el('p', { class: 'os-hint', text: pick(S.projects.hint) }),
      current && projectWindow(current, ctx, closeWindow),
    ),
    el(
      'div',
      { class: 'os-taskbar' },
      el('span', { class: 'os-start', text: pick(S.projects.os) }),
      el('span', {
        class: 'os-task',
        text: current ? pick(current.title) : `${list.length} ${pick(S.projects.count)}`,
      }),
      clock(st),
    ),
  );
}

/* ---------- Yetenekler ---------- */

function skills(ctx) {
  const st = ctx.state;
  // Doldurma animasyonu yalnızca panel ilk açıldığında; dil değişince tekrar oynamaz.
  const animate = !st.skillsPlayed && !reducedMotion();
  st.skillsPlayed = true;

  let row = 0;
  const cards = (content.skills || []).map((group) =>
    el(
      'section',
      { class: 'skill-card' },
      el('h3', { class: 'sub', text: pick(group.group) }),
      el(
        'ul',
        { class: 'skill-list' },
        (group.items || []).map((item) => {
          const delay = Math.min(row * 35, 550); // tüm panel ≤ ~1 sn içinde dolar
          row += 1;
          return el(
            'li',
            { class: 'skill' },
            el('span', { class: 'skill-name', text: pick(item.name) }),
            levelBlocks(item.level, { animate, delay }),
          );
        }),
      ),
    ),
  );

  const legend = el(
    'div',
    { class: 'lvl-legend' },
    el('h3', { class: 'lvl-legend-title', text: pick(T.legendTitle) }),
    el(
      'ul',
      { class: 'lvl-legend-list' },
      T.legend.map((entry) => {
        const blocks = [];
        for (let i = 1; i <= entry.n; i += 1) blocks.push(el('span', { class: 'lvl-b is-on' }));
        return el('li', null, el('span', { class: 'lvl', 'aria-hidden': 'true' }, blocks), el('span', { text: pick(entry.text) }));
      }),
    ),
  );

  return el('div', { class: 'skills-wrap' }, el('div', { class: 'skills' }, cards), legend);
}

/* ---------- İletişim ---------- */

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // aşağıdaki eski yönteme düş
  }
  try {
    const area = el('textarea', { class: 'sr-only', readonly: true, 'aria-hidden': 'true' });
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function contact() {
  const c = content.contact || {};
  const email = c.email || '';
  const status = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  // Birincil eylem (e-posta) vurgulu; diğer bağlantılar krem (klasik görünümle aynı ayrım)
  const copyBtn = el('button', { type: 'button', class: 'px-btn px-btn--big px-btn--accent', text: pick(S.contact.copy) });
  let resetTimer = null;
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(email);
    const message = pick(ok ? S.contact.copied : S.contact.copyFailed);
    copyBtn.textContent = message;
    copyBtn.classList.toggle('is-done', ok);
    status.textContent = message;
    copyBtn.focus();
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copyBtn.textContent = pick(S.contact.copy);
      copyBtn.classList.remove('is-done');
    }, 2000);
  });

  const links = c.links || [];
  return el(
    'div',
    { class: 'contact' },
    email &&
      el(
        'section',
        null,
        el('h3', { class: 'sub', text: pick(S.contact.email) }),
        el(
          'div',
          { class: 'contact-email' },
          el('a', { class: 'contact-mail', href: safeUrl(`mailto:${email}`), text: email }),
          copyBtn,
          status,
        ),
      ),
    links.length > 0 &&
      el(
        'section',
        null,
        el('h3', { class: 'sub', text: pick(S.contact.links) }),
        el(
          'ul',
          { class: 'btn-row contact-links' },
          links.map((link) => el('li', null, extLink(link.url, link.label, 'px-btn px-btn--big'))),
        ),
      ),
    c.note && el('p', { class: 'contact-note', text: pick(c.note) }),
  );
}

export const renderers = { about, projects, skills, contact };
