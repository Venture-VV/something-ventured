/* =========================================================
   Something Ventured · member app
   Hash routes, one state object, views as html`` templates.
   Works against the bundled server or fully in the browser
   (see shared/api.js), and keeps the key usable offline.
   ========================================================= */
import { connect, call, auth, onChange, getMode, store } from '../shared/api.js';
import { html, raw, fmt, toast, debounce, initialOf, reduceMotion } from '../shared/ui.js';
import { SECTORS, BASES, PATH, EVENT_TYPES, SESSIONS, REQUEST_TYPES, CITIES, entryCode, CODE_STEP, hz, sectorOf, DEMO_CODE } from '../shared/core.js';

const $ = (s, el = document) => el.querySelector(s);
const screenEl = $('#screen');
const tabbarEl = $('#tabbar');
const sheetEl = $('#sheet');
const icon = (id, cls = '') => raw(`<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`);

const S = {
  role: null,
  route: null,
  params: {},
  data: {},
  sheet: null,
  seq: 0,
  ui: { filter: 'all', date: null, session: 'day', zone: null, party: 1, note: '', floor: 'library', q: '', invite: null, inviteInfo: null, reqType: 'table', lastVisits: null, firstKey: false },
};

/* ---------- data with an offline cache ---------- */
const CACHE_KEY = 'sv.app.cache';
let cache = store.json(CACHE_KEY, {});
const persistCache = debounce(() => store.set(CACHE_KEY, JSON.stringify(cache)), 600);
async function get(method, args = {}) {
  const key = method + JSON.stringify(args);
  try {
    const v = await call(method, args);
    if (S.role === 'member') { cache[key] = v; persistCache(); }
    return v;
  } catch (e) {
    if (e.code === 'offline' && key in cache) { S.offline = true; return cache[key]; }
    throw e;
  }
}

/* ---------- routes ---------- */
const ROUTES = {
  welcome: { auth: 'none', view: viewWelcome },
  login: { auth: 'none', view: viewLogin },
  apply: { auth: 'none', view: viewApply },
  status: { auth: 'applicant', load: () => call('application.status'), view: viewStatus },
  lobby: { auth: 'member', tab: 'lobby', load: () => get('lobby'), view: viewLobby },
  programme: { auth: 'member', tab: 'programme', load: () => get('events.list'), view: viewProgramme },
  key: { auth: 'member', tab: 'key', load: () => get('me'), view: viewKey, after: afterKey },
  reserve: { auth: 'member', tab: 'reserve', load: loadReserve, view: viewReserve },
  me: { auth: 'member', tab: 'me', load: loadMe, view: viewMe },
  stacks: { auth: 'member', tab: 'me', load: () => get('books.list'), view: viewStacks },
};
const TABS = [
  ['lobby', 'lobby', '大堂'],
  ['programme', 'ticket', '节目'],
  ['key', 'key', '钥匙'],
  ['reserve', 'lamp', '预订'],
  ['me', 'cameo', '我的'],
];

function go(name, params = '') { location.hash = '#/' + name + (params ? '?' + params : ''); }

async function route() {
  const [rawName, query] = location.hash.replace(/^#\/?/, '').split('?');
  S.params = Object.fromEntries(new URLSearchParams(query || ''));
  let name = ROUTES[rawName] ? rawName : null;
  if (!S.role) { if (!name || ROUTES[name].auth !== 'none') name = 'welcome'; }
  else if (S.role === 'applicant') { if (name !== 'status' && name !== 'apply') name = 'status'; }
  else if (!name || ROUTES[name].auth !== 'member') name = 'lobby';
  if (name !== rawName) history.replaceState(null, '', '#/' + name + (query && name === rawName ? '?' + query : ''));
  const entering = S.route !== name;
  if (entering) { stopKey(); if (S.sheet) closeSheet(); }
  S.route = name;
  if (name === 'apply' && S.params.invite && S.ui.invite !== S.params.invite) {
    S.ui.invite = S.params.invite;
    checkInvite(S.params.invite, true);
  }
  const r = ROUTES[name];
  const seq = ++S.seq;
  if (r.load) {
    if (!S.data[name]) render({ loading: true });
    try {
      const data = await r.load();
      if (seq !== S.seq) return;
      S.data[name] = data;
    } catch (e) {
      if (seq !== S.seq) return;
      if (handleError(e)) return;
    }
  }
  render({ enter: entering });
}

function render({ enter = false, loading = false } = {}) {
  const r = ROUTES[S.route];
  const prev = $('.main', screenEl);
  const keep = !enter && prev ? prev.scrollTop : 0;
  screenEl.classList.toggle('velvet', S.route === 'key');
  if (loading) {
    screenEl.innerHTML = html`${bar({ title: '' })}<div class="boot" style="background:transparent"><svg class="boot__crest" style="color:var(--accent-fg)"><use href="#i-crest"/></svg></div>`.s;
  } else {
    screenEl.innerHTML = r.view(S.data[S.route]).s;
  }
  const main = $('.main', screenEl);
  if (main) {
    main.scrollTop = keep;
    if (enter && !loading) main.classList.add('enter');
  }
  renderTabbar();
  themeColor();
  if (!loading && r.after) r.after();
}

function renderTabbar() {
  const r = ROUTES[S.route];
  const show = S.role === 'member' && r && r.tab;
  tabbarEl.hidden = !show;
  if (!show) return;
  tabbarEl.innerHTML = TABS.map(([id, ic, label]) => id === 'key'
    ? html`<a class="tab tab--key ${r.tab === id ? 'is-on' : ''}" href="#/key" aria-label="钥匙 · 出示入场" ${raw(r.tab === id ? 'aria-current="page"' : '')}><span class="keybtn">${icon('key')}</span><span>${label}</span></a>`.s
    : html`<a class="tab ${r.tab === id ? 'is-on' : ''}" href="#/${id}" ${raw(r.tab === id ? 'aria-current="page"' : '')}>${icon(ic)}<span>${label}</span></a>`.s).join('');
}

/* ---------- shared bits ---------- */
function bar({ title = '', sub = '', back = null, right = null, word = false, clear = false } = {}) {
  return html`<header class="bar ${clear ? 'bar--clear' : ''}">
    <div>${back ? html`<a class="iconbtn" href="#/${back}" aria-label="返回">${icon('back')}</a>` : ''}</div>
    <div class="bar__mid">${word ? html`<span class="bar__word">Something Ventured</span>` : html`<span class="bar__title">${title}</span>${sub ? html`<span class="bar__sub">${sub}</span>` : ''}`}</div>
    <div>${right || ''}</div>
  </header>`;
}
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const greeting = () => {
  const h = hz().h;
  return h >= 5 && h < 11 ? ['Good morning', '早上好'] : h >= 11 && h < 18 ? ['Good afternoon', '下午好'] : ['Good evening', '晚上好'];
};
const typeOf = t => EVENT_TYPES[t] || { en: 'Evening', zh: '活动' };
const maskPhone = p => String(p || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1 **** $2');

function ticket(e, { compact = false } = {}) {
  const p = fmt.parts(e.startsAt);
  const t = typeOf(e.type);
  const seats = e.past ? (e.mine === 'attended' ? '你到场了' : '已结束')
    : e.left > 0 ? `余 ${e.left} / ${e.capacity} 席` : `已满 · 候补 ${e.waitlist}`;
  const stamp = e.mine === 'going' ? html`<span class="tstamp">Admitted<small>已报名</small></span>`
    : e.mine === 'waitlist' ? html`<span class="tstamp tstamp--wait">Waitlist<small>候补中</small></span>`
    : e.mine === 'attended' ? html`<span class="tstamp">Attended<small>已到场</small></span>` : '';
  return html`<button class="ticket c-${e.color} ${e.past ? 'is-past' : ''} ${stamp ? 'has-stamp' : ''}" data-act="event" data-id="${e.id}">
    <span class="ticket__stub"><span>${p.mon}</span><b>${p.d}</b><small>${p.dowZh}</small></span>
    <span class="ticket__main">
      <span class="ticket__k">${t.en} · ${t.zh}</span>
      <span class="ticket__t">${e.title}</span>
      ${compact ? '' : html`<span class="ticket__en">${e.en}</span>`}
      <span class="ticket__m"><span>${icon('clock')}${fmt.time(e.startsAt)} – ${fmt.time(e.endsAt)}</span><span>${icon('pin')}${e.venue}</span></span>
      <span class="ticket__seats">${seats}</span>
      ${stamp}
    </span>
  </button>`;
}

function keytag(r) {
  return html`<div class="keytag">
    <span class="keytag__fob"><b>${r.floor.floor}</b></span>
    <span class="keytag__main">
      <span class="keytag__k">${r.floor.name} · 座位预订</span>
      <span class="keytag__t">${r.zone.zh} · ${r.sessionInfo.zh}</span>
      <span class="keytag__m">${fmt.mdOf(r.date)} ${fmt.dowOf(r.date)} · ${r.sessionInfo.hours} · ${r.party} 位 · ${r.code}</span>
    </span>
  </div>`;
}

function memberCard(me, { stamp = null, flipped = false } = {}) {
  const sector = sectorOf(me.sector);
  return html`<div class="mcard ${flipped ? 'is-flipped' : ''}" data-act="flip" role="button" tabindex="0" aria-label="会员卡，点按翻面">
    <div class="mcard__flip">
      <div class="mcard__face mcard__front">
        <div class="mcard__guil"></div><div class="mcard__border"></div>
        <svg class="mcard__crest"><use href="#i-crest"/></svg>
        <p class="mcard__brand">Something Ventured</p>
        <p class="mcard__role">Member · 会员</p>
        ${me.en ? html`<p class="mcard__name">${me.en}</p>` : html`<p class="mcard__name mcard__name--zh">${me.name}</p>`}
        <p class="mcard__meta">${sector.en} · ${me.base}</p>
        <div class="mcard__foot"><span>No. ${me.no || '————'}</span><span>HZ · SH · SZ · BJ</span></div>
        <span class="mcard__foil"></span><span class="mcard__glare"></span>
        ${stamp ? html`<span class="mcard__stamp">${stamp[0]}<small>${stamp[1]}</small></span>` : ''}
      </div>
      <div class="mcard__face mcard__back">
        <div class="mcard__stripe"></div>
        <p class="mcard__bk">Valid at every house of</p>
        <p class="mcard__bb">Something Ventured</p>
        <ul class="mcard__cities">${CITIES.map((c, i) => html`<li class="${i === 0 ? 'is-on' : ''}">${c.en}</li>`)}</ul>
        <div class="mcard__sig"><span>${me.host ? 'Host · 专属服务' : 'Lead · 推荐人'}</span><b>${me.host ? me.host.en : (me.lead || '—')}</b></div>
      </div>
    </div>
  </div>`;
}

/* The house in Hangzhou: a symmetric facade, three floors, a sign full of bulbs. */
function houseSVG(floors = []) {
  const status = id => (floors.find(f => f.id === id) || {}).status || (id === 'library' ? 'preopening' : 'planned');
  const libOn = status('library') !== 'planned' && status('library') !== 'closed';
  const bulbs = [];
  for (let x = 84; x <= 236; x += 8) bulbs.push(`<circle class="bulb" cx="${x}" cy="14" r="1.5"/><circle class="bulb" cx="${x}" cy="36" r="1.5"/>`);
  for (let y = 20; y <= 30; y += 5) bulbs.push(`<circle class="bulb" cx="82" cy="${y}" r="1.5"/><circle class="bulb" cx="238" cy="${y}" r="1.5"/>`);
  const arch = cx => `M${cx - 14} 128V97a14 14 0 0 1 28 0v31z`;
  const third = [112, 160, 208].map((cx, i) => `
    <path d="${arch(cx)}" class="${libOn ? 'h-win win-on' : 'h-winoff'}"/>
    ${libOn ? `<rect x="${cx - 12}" y="113" width="24" height="2" class="h-shelf"/><rect x="${cx - 12}" y="121" width="24" height="2" class="h-shelf"/>
      ${[0, 1, 2, 3, 4, 5].map(k => `<rect x="${cx - 11 + k * 4}" y="${105 + (k % 3)}" width="2.4" height="${8 - (k % 3)}" class="h-book"/><rect x="${cx - 10 + k * 4}" y="${115 + ((k + 1) % 3)}" width="2.4" height="${6 - ((k + 1) % 3)}" class="h-book"/>`).join('')}
      ${i === 1 ? `<path d="M153 104h14l-3-5h-8z" class="h-lamp"/><rect x="159.3" y="104" width="1.4" height="9" class="h-brass"/><ellipse cx="160" cy="106" rx="9" ry="3" class="h-glow"/>` : ''}` : ''}
    <path d="${arch(cx)}" class="h-frame"/><path d="M${cx} 85v43M${cx - 14} 110h28" class="h-mullion"/>`).join('');
  const second = [112, 160, 208].map(cx => `
    <rect x="${cx - 14}" y="148" width="28" height="42" class="h-winoff"/>
    <path d="M${cx - 14} 148h13c-5 14-5 28 0 42h-13z" class="h-curtain"/><path d="M${cx + 14} 148h-13c5 14 5 28 0 42h13z" class="h-curtain"/>
    <rect x="${cx - 16}" y="145" width="32" height="5" class="h-rasp"/><rect x="${cx - 14}" y="148" width="28" height="42" class="h-frame"/>`).join('');
  const awning = (x, w, y) => `<rect x="${x}" y="${y}" width="${w}" height="8" fill="url(#awn)"/>${Array.from({ length: Math.round(w / 8) }, (_, k) => `<circle cx="${x + 4 + k * 8}" cy="${y + 8}" r="4" class="${k % 2 ? 'h-cream' : 'h-rasp'}"/>`).join('')}`;
  return raw(`<svg viewBox="0 0 320 290" role="img" aria-label="杭州的那栋楼：3F Library，2F Nightclub，1F Dining &amp; Bar">
    <defs><pattern id="awn" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="8" class="h-rasp"/><rect x="4" width="4" height="8" class="h-cream"/></pattern></defs>
    <rect x="0" y="268" width="320" height="22" class="h-ground"/>
    <rect x="97" y="38" width="3" height="22" class="h-ink"/><rect x="220" y="38" width="3" height="22" class="h-ink"/>
    <rect x="78" y="9" width="164" height="32" rx="2" class="h-rasp"/>
    <g class="h-bulb">${bulbs.join('')}</g>
    <text x="160" y="29" text-anchor="middle" class="h-sign">SOMETHING VENTURED</text>
    <rect x="66" y="57" width="188" height="12" class="h-facade2"/><rect x="60" y="67" width="200" height="5" class="h-rasp"/>
    <rect x="68" y="72" width="184" height="196" class="h-facade"/>
    <rect x="68" y="72" width="9" height="196" class="h-facade2"/><rect x="243" y="72" width="9" height="196" class="h-facade2"/>
    <rect x="64" y="134" width="192" height="5" class="h-facade2"/><rect x="64" y="138.5" width="192" height="1.5" class="h-rasp"/>
    <rect x="64" y="199" width="192" height="5" class="h-facade2"/><rect x="64" y="203.5" width="192" height="1.5" class="h-rasp"/>
    ${third}${second}
    ${awning(84, 48, 212)}${awning(188, 48, 212)}
    <rect x="90" y="226" width="36" height="28" class="h-winoff"/><rect x="194" y="226" width="36" height="28" class="h-winoff"/>
    <path d="M90 240h36M108 226v28M194 240h36M212 226v28" class="h-mullion"/>
    <rect x="90" y="226" width="36" height="28" class="h-frame"/><rect x="194" y="226" width="36" height="28" class="h-frame"/>
    ${awning(140, 40, 214)}
    <path d="M146 268v-32a14 14 0 0 1 28 0v32z" class="h-door"/><path d="M160 222v46" class="h-mullion"/>
    <circle cx="156.5" cy="250" r="1.6" class="h-brass"/><circle cx="163.5" cy="250" r="1.6" class="h-brass"/>
    <circle cx="137" cy="238" r="6" class="h-glow"/><rect x="134.5" y="234" width="5" height="8" rx="1" class="h-brass"/>
    <circle cx="183" cy="238" r="6" class="h-glow"/><rect x="180.5" y="234" width="5" height="8" rx="1" class="h-brass"/>
    <rect x="122" y="258" width="10" height="10" class="h-rasp"/><circle cx="127" cy="251" r="8" class="h-green"/>
    <rect x="188" y="258" width="10" height="10" class="h-rasp"/><circle cx="193" cy="251" r="8" class="h-green"/>
    <rect x="140" y="268" width="40" height="4" class="h-facade2"/>
    <text x="56" y="112" text-anchor="end" class="h-label">3F</text><text x="56" y="174" text-anchor="end" class="h-label">2F</text><text x="56" y="244" text-anchor="end" class="h-label">1F</text>
    <text x="264" y="112" class="h-label h-label--sm">LIBRARY</text><text x="264" y="174" class="h-label h-label--sm">NIGHT</text><text x="264" y="244" class="h-label h-label--sm">DINING</text>
  </svg>`);
}

/* The 3F Library seen from above: fireside, long table, listening corner, two studies, a small stage. */
function planSVG(zones, selected) {
  const z = id => zones.find(x => x.id === id) || { left: 0, capacity: 0 };
  const full = id => z(id).left <= 0;
  const tag = (id, x, y) => {
    const info = z(id);
    const label = `${info.zh} · ${full(id) ? '已满' : '余 ' + info.left}`;
    const w = 14 + [...label].reduce((s, c) => s + (c.charCodeAt(0) > 255 ? 9 : 5.4), 0);
    return `<g class="z-tag"><rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="15" rx="7.5"/><text x="${x}" y="${y + 2.8}" text-anchor="middle">${label}</text></g>`;
  };
  const zone = (id, hit, body, tx, ty) => `<g class="zone ${selected === id ? 'is-on' : ''} ${full(id) ? 'is-full' : ''}" data-act="zone" data-zone="${id}" role="button" tabindex="0" aria-pressed="${String(selected === id)}" aria-label="${z(id).zh}，${full(id) ? '已满' : '剩余 ' + z(id).left}">
    <rect class="z-hit" ${hit} rx="6"/>${body}${tag(id, tx, ty)}</g>`;
  const SP = ['#9B2D4A', '#DDA640', '#8FB3C9', '#3A2A26', '#8CC1A6', '#E7A9A6', '#B59FCC', '#EADBC2'];
  let top = '';
  for (let x = 14, i = 0; x < 306; x += 6, i++) {
    if (x > 128 && x < 190) continue;
    top += `<rect x="${x}" y="12" width="5" height="${14 + ((i * 7) % 6)}" fill="${SP[i % SP.length]}"/>`;
  }
  let sides = '';
  for (let y = 44, i = 0; y < 126; y += 6, i++) {
    sides += `<rect x="12" y="${y}" width="${13 + ((i * 5) % 6)}" height="5" fill="${SP[(i + 3) % SP.length]}"/><rect x="${308 - (13 + ((i * 3) % 6))}" y="${y}" width="${13 + ((i * 3) % 6)}" height="5" fill="${SP[(i + 5) % SP.length]}"/>`;
  }
  const chairs = [];
  for (let i = 0; i < 8; i++) chairs.push(`<rect x="122" y="${151 + i * 18.4}" width="11" height="11" rx="3" class="p-chair"/><rect x="187" y="${151 + i * 18.4}" width="11" height="11" rx="3" class="p-chair"/>`);
  const lamps = [0, 1, 2, 3].map(i => `<circle cx="160" cy="${166 + i * 38}" r="7" class="p-glow"/><circle cx="160" cy="${166 + i * 38}" r="4" class="p-lamp"/>`).join('');
  const study = y => `<rect x="238" y="${y}" width="66" height="76" class="p-room"/><path d="M238 ${y + 50}v20" class="p-gap"/><path d="M238 ${y + 50}a20 20 0 0 1 20 20" class="p-swing"/>
    <rect x="262" y="${y + 22}" width="26" height="30" rx="2" class="p-wood"/>
    <rect x="252" y="${y + 26}" width="8" height="8" rx="2" class="p-chair"/><rect x="252" y="${y + 40}" width="8" height="8" rx="2" class="p-chair"/>
    <rect x="290" y="${y + 26}" width="8" height="8" rx="2" class="p-chair"/><rect x="290" y="${y + 40}" width="8" height="8" rx="2" class="p-chair"/>`;
  return raw(`<svg viewBox="0 0 320 420" role="group" aria-label="3F Library 平面图，点选区域">
    <defs>
      <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(138,122,112,.10)"/><rect width="1.6" height="6" fill="rgba(138,122,112,.45)"/></pattern>
      <pattern id="parq" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" class="p-floor"/><path d="M0 8h8V0M8 16V8h8" class="p-parq"/></pattern>
    </defs>
    <rect x="8" y="8" width="304" height="404" fill="url(#parq)"/>
    ${top}${sides}
    <rect x="132" y="10" width="56" height="26" class="p-brick"/><path d="M144 36v-12a16 12 0 0 1 32 0v12z" class="p-hearth"/><path d="M160 34c-6-4-4-9 0-13 1 4 5 5 4 9 2-1 2-3 2-4 2 3 1 7-6 8z" class="p-flame"/>
    ${zone('fireside', 'x="58" y="40" width="204" height="86"', `
      <ellipse cx="160" cy="82" rx="64" ry="30" class="p-rug"/>
      <rect x="84" y="56" width="22" height="52" rx="6" class="p-sofa"/><rect x="214" y="56" width="22" height="52" rx="6" class="p-sofa"/>
      <rect x="80" y="56" width="8" height="52" rx="4" class="p-sofa2"/><rect x="232" y="56" width="8" height="52" rx="4" class="p-sofa2"/>
      <ellipse cx="160" cy="82" rx="18" ry="11" class="p-wood"/><circle cx="154" cy="80" r="2.5" class="p-cup"/>
      <rect x="122" y="96" width="14" height="14" rx="4" class="p-sofa2"/><rect x="184" y="96" width="14" height="14" rx="4" class="p-sofa2"/>`, 160, 121)}
    ${zone('long', 'x="98" y="136" width="124" height="172"', `
      <rect x="138" y="146" width="44" height="152" rx="3" class="p-wood"/>${chairs.join('')}${lamps}`, 160, 300)}
    ${zone('listening', 'x="14" y="136" width="76" height="172"', `
      <rect x="30" y="152" width="52" height="138" rx="10" class="p-rug2"/>
      <rect x="16" y="150" width="14" height="66" class="p-wood"/><circle cx="23" cy="164" r="5" class="p-record"/><circle cx="23" cy="182" r="5" class="p-record"/><circle cx="23" cy="200" r="5" class="p-record"/>
      <rect x="40" y="170" width="14" height="14" rx="4" class="p-sofa"/><rect x="62" y="170" width="14" height="14" rx="4" class="p-sofa"/>
      <rect x="40" y="208" width="14" height="14" rx="4" class="p-sofa"/><rect x="62" y="208" width="14" height="14" rx="4" class="p-sofa"/>
      <rect x="40" y="246" width="14" height="14" rx="4" class="p-sofa"/><rect x="62" y="246" width="14" height="14" rx="4" class="p-sofa"/>`, 52, 300)}
    ${zone('study', 'x="232" y="136" width="78" height="172"', `${study(140)}${study(222)}
      <text x="296" y="152" text-anchor="end" class="p-label">A</text><text x="296" y="234" text-anchor="end" class="p-label">B</text>`, 271, 300)}
    <path d="M108 380a52 34 0 0 1 104 0z" class="p-stage"/><path d="M160 356v14M156 356h8" class="p-mic"/><circle cx="160" cy="354" r="2.2" class="p-micc"/>
    <text x="160" y="377" text-anchor="middle" class="p-label">STAGE · 不插电</text>
    <rect x="8" y="8" width="304" height="404" class="p-wall"/>
    <rect x="138" y="406" width="44" height="10" fill="url(#parq)"/><path d="M138 410a14 14 0 0 1 14-14M182 410a14 14 0 0 0-14-14" class="p-swing"/>
    <text x="160" y="396" text-anchor="middle" class="p-label p-label--muted">ENTRANCE · 入口</text>
  </svg>`);
}

/* ---------- welcome / login / apply / status ---------- */
function viewWelcome() {
  return html`<main class="main main--bare"><div class="welcome">
    <div class="welcome__frame">
      <div>
        <p class="welcome__k">A members’ club · 会员制线下俱乐部</p>
        <h1 class="welcome__word">Something<br>Ventured</h1>
        <p class="welcome__tag">Nothing ventured, nothing gained.</p>
      </div>
      <div class="welcome__house">${houseSVG()}</div>
      <p class="welcome__note"><b>By referral only · 仅限推荐</b>3F Library · 杭州 · 12.15 开业<br>一个身份，打开每一扇门。</p>
      <div class="btns">
        <a class="btn btn--accent" href="#/login">I have a key<span>我是会员 · 登录</span></a>
        <a class="btn btn--ghost" href="#/apply">I was referred<span>申请推荐入会</span></a>
        <a class="link" style="justify-self:center" href="#/login">已提交申请？登录查看进度 ${icon('arrow')}</a>
      </div>
    </div>
  </div></main>`;
}

function viewLogin() {
  return html`${bar({ title: '前台', sub: 'The Front Desk', back: 'welcome' })}
  <main class="main main--plain">
    <div class="titlecard"><p class="kicker">The Front Desk</p><h1 class="h1">前台登记</h1><p class="lede">Welcome back. Your key, please.</p></div>
    <form class="regcard" data-form="login" novalidate>
      <div class="regcard__head"><b>Sign in · 登录</b><span>SV · HZ · 301</span></div>
      <label class="field"><span class="field__l"><b>Mobile</b><span>手机号</span></span>
        <input class="input input--mono" name="phone" inputmode="numeric" autocomplete="tel" placeholder="138 0000 0007" maxlength="13" required></label>
      <label class="field"><span class="field__l"><b>Code</b><span>验证码</span></span>
        <span class="inline"><input class="input input--mono" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="4" placeholder="····" required>
        <button type="button" class="codebtn" data-act="send-code">获取验证码</button></span></label>
      <p class="form-err" data-err></p>
      <button class="btn btn--accent btn--block">Enter<span>进入</span></button>
      <p class="regcard__foot">会员与申请人都用手机号登录。</p>
    </form>
    <div class="demo">
      <p class="demo__k">Demo · 演示入口</p>
      <div class="btns">
        <button class="btn btn--ghost" data-act="demo" data-as="member">演示会员<span>林知远 · No.0007</span></button>
        <button class="btn btn--ghost" data-act="demo" data-as="applicant">演示申请人<span>宋予安 · 尽调中</span></button>
      </div>
      <p class="muted" style="font-size:12px">演示验证码 ${DEMO_CODE}</p>
    </div>
  </main>`;
}

function choiceGroup(name, options, value) {
  return html`<div class="choice" role="radiogroup">${options.map(([v, label]) => html`<label class="chip ${value === v ? 'is-on' : ''}"><input class="sr" type="radio" name="${name}" value="${v}" ${raw(value === v ? 'checked' : '')}>${label}</label>`)}</div>`;
}

function viewApply() {
  const inv = S.ui.inviteInfo;
  return html`${bar({ title: '申请推荐入会', sub: 'Request an introduction', back: S.role === 'applicant' ? 'status' : 'welcome' })}
  <main class="main main--plain">
    <div class="titlecard"><p class="kicker">Chapter Six · 第六章</p><h1 class="h1">按响前台的铃</h1><p class="lede">In which you ring the bell.</p></div>
    ${inv ? html`<div class="envelope" style="margin:0 18px 22px">
        <svg class="envelope__seal"><use href="#i-seal"/></svg>
        <p class="envelope__k">An invitation · 推荐函</p>
        <p class="envelope__p"><b>${inv.lead}</b> 推荐了你。<br>补全下面的登记卡，礼宾台会开始筛选。</p>
      </div>` : ''}
    <form class="regcard" data-form="apply" novalidate>
      <div class="regcard__head"><b>Registration · 登记卡</b><span>Non-binding</span></div>
      <label class="field"><span class="field__l"><b>Invitation</b><span>邀请码 <i>有则填写</i></span></span>
        <span class="inline"><input class="input input--mono" name="invite" placeholder="SV-XXXX" maxlength="8" autocapitalize="characters" value="${S.ui.invite || ''}">
        <button type="button" class="codebtn" data-act="check-invite">核对</button></span></label>
      <label class="field"><span class="field__l"><b>Name</b><span>姓名 <i>*</i></span></span><input class="input" name="name" autocomplete="name" maxlength="30" value="${inv ? inv.name : ''}"></label>
      <label class="field"><span class="field__l"><b>Venture & role</b><span>公司 / 职位 <i>*</i></span></span><input class="input" name="venture" maxlength="60" placeholder="例：远望机器人 · 创始人" value="${inv && inv.venture !== '待补充' ? inv.venture : ''}"></label>
      <div class="field"><span class="field__l"><b>Sector</b><span>领域 <i>*</i></span></span>${choiceGroup('sector', SECTORS.map(s => [s.id, s.id === 'Robotics' ? 'Robotics 机器人' : s.id === 'Frontier' ? '其他前沿' : s.en]), inv ? inv.sector : '')}</div>
      <div class="field"><span class="field__l"><b>Base</b><span>常驻城市 <i>*</i></span></span>${choiceGroup('base', BASES.map(b => [b, b]), inv ? inv.base : '')}</div>
      <label class="field"><span class="field__l"><b>Lead</b><span>推荐人 <i>选填</i></span></span><input class="input" name="lead" maxlength="30" value="${inv ? inv.lead : ''}" ${raw(inv ? 'readonly' : '')} placeholder="推荐你的会员"></label>
      <label class="field"><span class="field__l"><b>Mobile</b><span>手机号 <i>*</i></span></span><input class="input input--mono" name="phone" inputmode="numeric" autocomplete="tel" maxlength="13" placeholder="用来登录查看进度"></label>
      <label class="field"><span class="field__l"><b>WeChat</b><span>微信号 <i>选填</i></span></span><input class="input" name="wechat" maxlength="40"></label>
      <label class="field"><span class="field__l"><b>Thesis</b><span>最近在押注什么？ <i>选填</i></span></span><textarea class="textarea" name="thesis" maxlength="300" rows="3"></textarea></label>
      <p class="form-err" data-err></p>
      <button class="btn btn--accent btn--block btn--row">${icon('bell')}Ring for service<span>提交申请</span></button>
      <p class="regcard__foot">本申请不具约束力，以俱乐部筛选结果为准。</p>
    </form>
  </main>`;
}

function viewStatus(d) {
  const a = d.application;
  const step = a.step;
  const heads = {
    received: ['Received · 已收到', '尽调进行中', 'Due diligence in progress.'],
    diligence: ['In diligence · 尽调中', '尽调进行中', 'Due diligence in progress.'],
    initiation: ['You are invited · 已邀请', '入会仪式', 'In which one is welcomed.'],
    welcomed: ['Welcome · 欢迎', '欢迎入会', 'One key. Every door.'],
    declined: ['Thank you · 感谢', '感谢你的申请', 'Not this time.'],
  };
  const [k, h, lede] = heads[a.stage] || heads.received;
  const stamp = a.stage === 'initiation' ? ['Invited', '已邀请'] : a.stage === 'welcomed' ? ['Welcome', '欢迎'] : a.stage === 'declined' ? null : ['In diligence', '尽调中'];
  const desc = [
    a.lead ? `由 ${a.lead} 推荐` : '已收到你的申请',
    `我们会通过 ${maskPhone(store.get('sv.app.phone') || '') || '你留下的联系方式'} 与你联系。`,
    a.initiationAt ? `${fmt.full(a.initiationAt)} · 形式，入会时揭晓。` : '一场专门的入会仪式。形式，入会时揭晓。',
    a.memberNo ? `会员编号 No.${a.memberNo}` : '入会礼包、虚拟会员身份，以及专门的服务人员。',
  ];
  return html`${bar({ word: true, right: html`<button class="iconbtn" data-act="logout" aria-label="退出登录">${icon('close')}</button>` })}
  <main class="main main--plain">
    <div class="titlecard"><p class="kicker">${k}</p><h1 class="h1">${h}</h1><p class="lede">${lede}</p></div>
    <div style="padding:4px 26px 10px">${memberCard({ name: a.name, en: a.en, sector: a.sector, base: a.base, no: a.memberNo, lead: a.lead }, { stamp })}</div>
    ${a.stage === 'welcomed' ? html`<div style="padding:16px 22px 0"><button class="btn btn--brass btn--block btn--row" data-act="upgrade">${icon('key')}Receive your key<span>领取你的钥匙</span></button></div>` : ''}
    ${!a.completed && a.invite ? html`<div style="padding:16px 22px 0"><a class="btn btn--accent btn--block" href="#/apply?invite=${a.invite}">Complete your card<span>补全登记卡</span></a></div>` : ''}
    ${a.stage === 'initiation' && a.initiationAt ? html`<div class="invite">
      <svg class="invite__seal"><use href="#i-seal"/></svg>
      <p class="invite__k">Initiation · 入会仪式</p>
      <p class="invite__t">${fmt.md(a.initiationAt)} ${fmt.dow(a.initiationAt)} · ${fmt.time(a.initiationAt)}</p>
      <p class="invite__d">3F LIBRARY · HANGZHOU</p>
      <p class="invite__p">形式，入会时揭晓。请准时到达。</p>
    </div>` : ''}
    ${a.stage === 'declined' ? html`<p class="lede" style="text-align:center;padding:18px 30px 0;font-size:15px">这一次没能成行。俱乐部会在合适的时候，再与你联系。</p>` : html`
    <ol class="path" style="margin-top:22px">${PATH.map((p, i) => html`<li class="${i < step || a.stage === 'welcomed' ? 'is-done' : i === step ? 'is-now' : ''}">
      <span class="path__n">${i < step || a.stage === 'welcomed' ? icon('check') : '0' + (i + 1)}</span>
      <span class="path__t"><b>${p.zh}</b><span>${p.en}</span><p>${desc[i]}</p></span></li>`)}</ol>`}
    ${d.notices.length ? html`<section class="section" style="margin-top:18px"><div class="sechead"><div class="sechead__t"><b>来信</b><span>Letters</span></div></div>
      ${d.notices.map(n => html`<div class="notice"><span class="notice__i">${icon('bell')}</span><div><div class="notice__t"><b>${n.title}</b><small>${fmt.rel(n.at)}</small></div><p>${n.body}</p></div></div>`)}</section>` : ''}
    <p class="motto">Nothing ventured, nothing gained.</p>
  </main>`;
}

/* ---------- lobby ---------- */
function viewLobby(d) {
  const me = d.me;
  const [gEn, gZh] = greeting();
  const lib = d.floors.find(f => f.id === 'library');
  const unread = d.unread;
  const boardSt = f => {
    const s = f.state.key;
    if (s === 'planned') return html`<span class="board__st is-off">Planned</span>`;
    if (s === 'soon') return html`<span class="board__st is-soon">Opens ${fmt.mdOf(f.openingDate)}</span>`;
    if (s === 'day' || s === 'night') return html`<span class="board__st is-live">Open · ${s}</span>`;
    return html`<span class="board__st is-off">Closed</span>`;
  };
  const showInstall = !isStandalone() && !store.get('sv.install.dismissed');
  return html`${bar({ word: true, right: html`<button class="iconbtn" data-act="notices" aria-label="来信与通知${unread ? '，有未读' : ''}">${icon('bell')}${unread ? html`<span class="iconbtn__dot"></span>` : ''}</button>` })}
  <main class="main">
    <div class="greet">
      <p class="kicker">${gEn} · ${gZh}</p>
      ${me.en ? html`<p class="greet__name">${me.en}</p><p class="greet__zh">${me.name}</p>` : html`<p class="greet__name" style="font:600 26px/1.3 var(--sans);letter-spacing:.2em">${me.name}</p>`}
      <p class="greet__meta">NO. ${me.no} · ${sectorOf(me.sector).en.toUpperCase()} · ${me.base}</p>
    </div>
    <div class="house">${houseSVG(d.floors)}<span class="house__snow"></span></div>
    <div class="board" role="list" aria-label="楼层指南">
      <div class="board__k"><span>Directory · 楼层指南</span><span>HZ · 杭州</span></div>
      ${d.floors.map(f => html`<div class="board__row" role="listitem"><span class="board__fl">${f.floor}</span><span class="board__nm">${f.name}<small>${f.zh}</small></span><span class="board__dots"></span>${boardSt(f)}</div>`)}
    </div>
    ${lib && lib.state.key === 'soon' ? html`<div class="countdown"><div class="countdown__l"><b>Opening in</b><span>距 3F Library 开业</span></div>${flaps(String(lib.state.days).padStart(2, '0'))}<div class="countdown__l" style="text-align:left"><b>Days</b><span>天</span></div></div>` : ''}
    ${showInstall ? html`<div class="install">${icon('addbox')}<div><b>把钥匙放进手机桌面</b><span>添加到主屏幕，像 App 一样打开</span></div><span style="display:flex;gap:2px"><button class="btn btn--sm" data-act="install">添加</button><button class="iconbtn install__x" data-act="install-dismiss" aria-label="不再提示">${icon('close')}</button></span></div>` : ''}

    <section class="section" style="margin-top:26px">
      <div class="sechead"><div class="sechead__t"><b>接下来</b><span>Up next</span></div><a class="link" href="#/programme">节目单 ${icon('arrow')}</a></div>
      <div class="stack">${d.upcoming.length ? d.upcoming.map(u => u.kind === 'event' ? ticket(u.item, { compact: true }) : keytag(u.item))
        : html`<div class="empty"><b>Nothing booked yet.</b>还没有安排。去「节目」或「预订」看看？</div>`}</div>
    </section>

    ${d.bulletins.length ? html`<section class="section" style="margin-top:28px">
      <div class="sechead"><div class="sechead__t"><b>礼宾台来信</b><span>From the desk</span></div></div>
      <button class="letter" data-act="notices"><svg class="letter__seal"><use href="#i-seal"/></svg>
        <span class="letter__k">${fmt.rel(d.bulletins[0].at)} · Bulletin</span>
        <p class="letter__t">${d.bulletins[0].title}</p><p class="letter__b">${d.bulletins[0].body}</p>
        <p class="letter__f">— The Front Desk · 礼宾台</p></button>
    </section>` : ''}

    ${me.host ? html`<section class="section" style="margin-top:22px">
      <div class="host"><span class="cameo">${initialOf(me.host.name)}</span>
        <div><p class="host__k">Your host · 专属服务</p><p class="host__n">${me.host.name}<i>${me.host.en}</i></p><p class="host__r">${me.host.role} · 有需要，按铃即可</p></div>
        <button class="ring" data-act="concierge">${icon('bell')}RING</button></div>
    </section>` : ''}

    ${d.spotlight.length ? html`<section class="section" style="margin-top:26px">
      <div class="sechead"><div class="sechead__t"><b>近期节目</b><span>Coming attractions</span></div></div>
      <div class="posters">${d.spotlight.map(e => { const p = fmt.parts(e.startsAt); return html`<button class="poster c-${e.color}" data-act="event" data-id="${e.id}"><span class="poster__k">${typeOf(e.type).en}</span><span class="poster__d">${p.d}<small>${p.mon} · ${p.dowEn}</small></span><span class="poster__t">${e.title}</span></button>`; })}</div>
    </section>` : ''}
    <p class="motto">No moments in this club were generated.<small>本俱乐部内的一切时刻，均未经生成</small></p>
  </main>`;
}

function flaps(text) {
  return html`<span class="flaps" aria-label="${text}">${[...String(text)].map(c => html`<span class="fc">${c}</span>`)}</span>`;
}

/* ---------- programme ---------- */
function viewProgramme(list) {
  const f = S.ui.filter;
  const types = [...new Set(list.map(e => e.type))];
  const pass = e => f === 'all' || (f === 'mine' ? !!e.mine : e.type === f);
  const upcoming = list.filter(e => !e.past && pass(e));
  const past = list.filter(e => e.past && pass(e));
  return html`${bar({ title: '节目单', sub: 'The Programme' })}
  <main class="main">
    <div class="marquee"><p class="marquee__k">Now showing · 正在上映</p><p class="marquee__t">Programme</p><p class="marquee__z">会员专享节目</p></div>
    <div class="filters"><div class="chips chips--scroll">
      <button class="chip" aria-pressed="${String(f === 'all')}" data-act="filter" data-v="all">全部</button>
      <button class="chip" aria-pressed="${String(f === 'mine')}" data-act="filter" data-v="mine">我的票</button>
      ${types.map(t => html`<button class="chip" aria-pressed="${String(f === t)}" data-act="filter" data-v="${t}">${typeOf(t).zh}</button>`)}
    </div></div>
    <section class="section"><div class="stack">${upcoming.length ? upcoming.map(e => ticket(e)) : html`<div class="empty"><b>Intermission.</b>这里暂时没有节目。</div>`}</div></section>
    ${past.length ? html`<section class="section" style="margin-top:28px"><div class="sechead"><div class="sechead__t"><b>往期</b><span>Previously</span></div></div><div class="stack">${past.map(e => ticket(e, { compact: true }))}</div></section>` : ''}
    <p class="motto">The following picture has been approved for those who venture.</p>
  </main>`;
}

function sheetEvent({ id, admitted }) {
  const list = S.data.programme || [];
  const lob = S.data.lobby;
  const e = list.find(x => x.id === id) || (lob && [...lob.spotlight, ...lob.upcoming.filter(u => u.kind === 'event').map(u => u.item)].find(x => x.id === id));
  if (!e) return { body: html`<p class="empty">找不到这场活动。</p>` };
  const p = fmt.parts(e.startsAt);
  const t = typeOf(e.type);
  const pct = Math.min(100, Math.round((e.taken / e.capacity) * 100));
  let cta;
  if (e.past) cta = html`<button class="btn btn--ghost btn--block" disabled>Ended<span>已结束</span></button>`;
  else if (e.mine === 'going') cta = html`<button class="btn btn--ghost btn--block" data-act="unrsvp" data-id="${e.id}">Cancel my seat<span>取消报名</span></button>`;
  else if (e.mine === 'waitlist') cta = html`<button class="btn btn--ghost btn--block" data-act="unrsvp" data-id="${e.id}">Leave the waitlist<span>退出候补 · 前面还有人</span></button>`;
  else if (e.left > 0) cta = html`<button class="btn btn--accent btn--block" data-act="rsvp" data-id="${e.id}">Reserve a seat<span>报名 · 余 ${e.left} 席</span></button>`;
  else cta = html`<button class="btn btn--block" data-act="rsvp" data-id="${e.id}">Join the waitlist<span>已满 · 加入候补</span></button>`;
  return {
    tall: true,
    label: e.title,
    body: html`<div class="evhead c-${e.color}">
        <p class="evhead__k">${t.en} · ${t.zh}</p>
        <h2 class="evhead__t">${e.title}</h2>
        <p class="evhead__en">${e.en}</p>
        <p class="evhead__d">${p.mon} ${p.d} · ${p.dowEn} · ${fmt.time(e.startsAt)}</p>
      </div>
      ${admitted === 'going' ? html`<div class="admit c-${e.color}"><b>ADMIT ONE</b><span>座位已确认 · SEAT CONFIRMED</span></div>`
        : admitted === 'waitlist' ? html`<div class="admit admit--wait c-${e.color}"><b>WAITLIST</b><span>已加入候补 · 有空位会通知你</span></div>` : ''}
      <div class="facts">
        <div class="fact">${icon('clock')}<div>${fmt.range(e.startsAt, e.endsAt)}<small>${e.membersOnly ? '仅限会员' : '对公众开放 · 会员保留席位'}</small></div></div>
        <div class="fact">${icon('pin')}<div>${e.venue}<small>Something Ventured · Hangzhou</small></div></div>
        <div class="fact">${icon('cameo')}<div>主持 · ${e.host || '礼宾台'}${e.speakers && e.speakers.length ? html`<small>嘉宾：${e.speakers.join('、')}</small>` : ''}</div></div>
      </div>
      <p class="prose">${e.description}</p>
      <div class="meter"><div class="meter__l"><span>${e.taken} / ${e.capacity} SEATS</span><span>${e.waitlist ? `WAITLIST ${e.waitlist}` : e.left ? `${e.left} LEFT` : 'FULL'}</span></div>
        <div class="meter__track"><span class="meter__fill" style="width:${pct}%"></span></div></div>`,
    foot: cta,
  };
}

/* ---------- key ---------- */
function viewKey(me) {
  S.ui.me = me;
  const code = entryCode(me.secret);
  return html`${bar({ title: '钥匙', sub: 'Your key' })}
  <main class="main"><div class="keyscreen">
    <p class="keyscreen__k">Present at the door · 出示入场</p>
    ${memberCard(me)}
    <div class="plate" aria-live="polite">
      <p class="plate__k">Door code · 入场码</p>
      <span id="code">${flaps(code)}</span>
      <p class="plate__foot"><svg class="timer" viewBox="0 0 24 24"><circle class="t-bg" cx="12" cy="12" r="9"/><circle class="t-fg" id="ring" cx="12" cy="12" r="9" stroke-dasharray="56.55" stroke-dashoffset="0"/></svg><span id="ttl">30 秒后更新</span></p>
    </div>
    <div class="keyctl">
      <button type="button" data-act="flip">Flip<span>翻面</span></button>
      ${typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' ? html`<button type="button" data-act="tilt">Tilt<span>倾斜看光泽</span></button>` : ''}
    </div>
    <div class="keyfacts">
      <div><span>No.</span><b>${me.no}</b></div>
      <div><span>Member since</span><b>${me.since.replaceAll('-', '.')}</b></div>
      <div><span>Host · 专属服务</span><b>${me.host ? `${me.host.name} ${me.host.en}` : '—'}</b></div>
      <div><span>Valid at · 通用</span><b class="cityrow">${CITIES.map((c, i) => html`<i class="${i === 0 ? 'is-on' : ''}">${c.id}</i>`)}</b></div>
    </div>
    <p class="keynote">调高屏幕亮度，把入场码出示给前台。<br>入场码每 30 秒更新一次，离线也能使用。</p>
    ${S.offline ? html`<span class="offline">OFFLINE · 离线模式</span>` : ''}
    ${S.ui.firstKey ? html`<span class="welcome-in" data-stamp>Welcome<small>欢迎入会</small></span>` : ''}
  </div></main>`;
}

let keyTimer = null;
function stopKey() { clearInterval(keyTimer); keyTimer = null; detachTilt(); }
function afterKey() {
  stopKey();
  const me = S.ui.me;
  if (!me) return;
  if (S.ui.firstKey) { setTimeout(() => { S.ui.firstKey = false; $('[data-stamp]')?.remove(); }, 3200); }
  if (S.ui.lastVisits != null && me.stats.visits > S.ui.lastVisits) welcomeIn();
  S.ui.lastVisits = me.stats.visits;
  let last = entryCode(me.secret);
  const tick = () => {
    const now = Date.now();
    const left = (CODE_STEP - (now % CODE_STEP)) / 1000;
    const ring = $('#ring');
    if (!ring) return stopKey();
    ring.style.strokeDashoffset = String(56.55 * (1 - left / 30));
    $('#ttl').textContent = `${Math.ceil(left)} 秒后更新`;
    const code = entryCode(me.secret, now);
    if (code !== last) {
      const cells = document.querySelectorAll('#code .fc');
      [...code].forEach((c, i) => { if (cells[i] && cells[i].textContent !== c) { cells[i].textContent = c; cells[i].classList.remove('is-flip'); void cells[i].offsetWidth; cells[i].classList.add('is-flip'); } });
      last = code;
    }
  };
  tick();
  keyTimer = setInterval(tick, 1000);
  attachTilt();
}
function welcomeIn() {
  const host = $('.keyscreen');
  if (!host) return;
  const el = document.createElement('span');
  el.className = 'welcome-in';
  el.innerHTML = 'Welcome in<small>欢迎光临</small>';
  host.appendChild(el);
  navigator.vibrate?.(40);
  setTimeout(() => el.remove(), 3600);
}

/* card tilt: pointer on desktop, gyroscope on phones */
let tiltOff = null;
function attachTilt() {
  const card = $('.keyscreen .mcard');
  if (!card || reduceMotion()) return;
  const set = (x, y) => {
    card.classList.add('is-tilting');
    card.style.setProperty('--ry', `${x * 14}deg`);
    card.style.setProperty('--rx', `${-y * 12}deg`);
    card.style.setProperty('--mx', `${50 + x * 45}%`);
    card.style.setProperty('--my', `${50 + y * 45}%`);
  };
  const move = e => { const r = card.getBoundingClientRect(); set((e.clientX - r.left) / r.width - .5, (e.clientY - r.top) / r.height - .5); };
  const leave = () => { card.classList.remove('is-tilting'); ['--rx', '--ry'].forEach(p => card.style.setProperty(p, '0deg')); };
  const orient = e => { if (e.gamma == null) return; set(Math.max(-1, Math.min(1, e.gamma / 35)) / 2, Math.max(-1, Math.min(1, (e.beta - 45) / 35)) / 2); };
  card.addEventListener('pointermove', move);
  card.addEventListener('pointerleave', leave);
  addEventListener('deviceorientation', orient);
  tiltOff = () => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', leave); removeEventListener('deviceorientation', orient); };
}
function detachTilt() { if (tiltOff) tiltOff(); tiltOff = null; }

/* ---------- reserve ---------- */
async function loadReserve() {
  const [av, mine] = await Promise.all([get('reserve.availability', { date: S.ui.date }), get('reserve.mine')]);
  S.ui.date = av.date;
  return { av, mine };
}

function viewReserve(d) {
  const { av, mine } = d;
  const floorBtn = (id, fl, name, note) => html`<button class="floorbtn" aria-pressed="${String(S.ui.floor === id)}" data-act="floor" data-floor="${id}"><b>${fl}</b><span>${name}</span><small>${note}</small></button>`;
  const head = html`${bar({ title: '预订', sub: 'Reserve a seat' })}`;
  const floors = html`<div class="floors">${floorBtn('library', '3F', 'Library', av.floor.status === 'open' ? '营业中' : '开业周可订')}${floorBtn('night', '2F', 'Nightclub', '规划中')}${floorBtn('dining', '1F', 'Dining & Bar', '规划中')}</div>`;
  if (S.ui.floor !== 'library') {
    return html`${head}<main class="main">${floors}
      <div class="planned"><div class="planned__sign"><b>Coming soon</b><span>规划中</span></div>
      <p>${S.ui.floor === 'night' ? '2F 将是一间夜店。' : '1F 将是餐厅与酒吧。'}<br>同一把钥匙，开业后在这里预订。<br>想第一时间知道？按铃告诉你的专属服务人员。</p>
      <button class="btn btn--light btn--sm" style="margin-top:18px" data-act="concierge">Ring the desk<span>按铃登记意向</span></button></div>
      ${myReservations(mine)}</main>`;
  }
  const sess = av.sessions.find(s => s.id === S.ui.session) || av.sessions[0];
  const zone = sess.zones.find(z => z.id === S.ui.zone);
  const party = S.ui.session === 'day' && zone && zone.unit === 'seat' ? 1 : S.ui.party;
  const units = zone && zone.unit === 'room' ? 1 : party;
  return html`${head}<main class="main">${floors}
    <div class="dates" role="listbox" aria-label="选择日期">${av.range.map(r => html`<button class="date ${r.date === av.date ? 'is-on' : ''}" role="option" aria-selected="${String(r.date === av.date)}" data-act="date" data-date="${r.date}" style="--load:${Math.round(r.load * 100)}%">
      ${r.date === av.floor.openingDate ? html`<span class="date__tag">开业</span>` : ''}${r.mine ? html`<span class="date__mine"></span>` : ''}
      <span>${fmt.dowEnOf(r.date)}</span><b>${fmt.dayOf(r.date)}</b><small>${fmt.monthEnOf(r.date)}</small><i></i></button>`)}</div>
    <div class="switchrow">
      <button class="switch" type="button" role="switch" aria-checked="${String(S.ui.session === 'night')}" data-act="session" aria-label="切换白天 / 夜晚时段">
        <span class="switch__lbl switch__lbl--day">Day<em>白天</em></span>
        <span class="switch__plate" aria-hidden="true"><i class="switch__screw"></i><span class="switch__slot"><span class="switch__lever"></span></span><i class="switch__screw"></i></span>
        <span class="switch__lbl switch__lbl--night">Night<em>夜晚</em></span>
      </button>
      <p class="switchrow__note">${S.ui.session === 'day' ? '白天 10:00–18:00 · 会员时段，仅限本人' : '夜晚 18:00–01:00 · 对外开放，可携友'}</p>
    </div>
    <div class="plan">${planSVG(sess.zones, S.ui.zone)}
      <div class="plan__legend"><span><i class="lg-free"></i>可订</span><span><i class="lg-on"></i>已选</span><span><i class="lg-full"></i>已满</span></div></div>
    ${sess.mine ? html`<div style="margin:14px 16px 0">${keytag(sess.mine)}<button class="btn btn--ghost btn--block" style="margin-top:10px" data-act="cancel-res" data-id="${sess.mine.id}">Cancel<span>取消这个预订</span></button></div>`
      : zone ? html`<div class="zonecard">
        <div class="zonecard__h"><div><b>${zone.zh}</b><i>${zone.en}</i></div><span class="zonecard__left">${zone.left > 0 ? `余 ${zone.left} / ${zone.capacity} ${zone.unit === 'room' ? '间' : '席'}` : '已满'}</span></div>
        <p class="zonecard__p">${zone.note}</p>
        <div class="zonecard__row"><div><b>Party · 人数</b>${S.ui.session === 'day' && zone.unit === 'seat' ? html`<p>白天为会员时段，仅限本人</p>` : zone.unit === 'room' ? html`<p>按间预订，最多 4 人</p>` : ''}</div>
          <span class="stepper"><button type="button" data-act="party" data-d="-1" aria-label="减少" ${raw(party <= 1 || (S.ui.session === 'day' && zone.unit === 'seat') ? 'disabled' : '')}>${icon('minus')}</button><output>${party}</output><button type="button" data-act="party" data-d="1" aria-label="增加" ${raw(party >= 4 || (S.ui.session === 'day' && zone.unit === 'seat') || (zone.unit === 'seat' && party >= zone.left) ? 'disabled' : '')}>${icon('plus')}</button></span></div>
        <label class="field" style="border-bottom:1px solid var(--rule)"><span class="field__l"><b>Note</b><span>备注 <i>选填</i></span></span><input class="input" data-bind="note" maxlength="120" placeholder="例：靠窗的位置" value="${S.ui.note}"></label>
        <button class="btn btn--accent btn--block" data-act="book" ${raw(zone.left < units ? 'disabled' : '')}>Hold my seat<span>${fmt.mdOf(av.date)} ${fmt.dowOf(av.date)} · ${S.ui.session === 'day' ? '白天' : '夜晚'} · 确认预订</span></button>
      </div>` : html`<p class="empty" style="margin:14px 16px 0"><b>Pick a spot.</b>点选平面图上的区域。</p>`}
    ${myReservations(mine)}
  </main>`;
}
function myReservations(mine) {
  const up = mine.filter(r => !r.past);
  return html`<section class="section" style="margin-top:28px"><div class="sechead"><div class="sechead__t"><b>我的预订</b><span>My reservations</span></div></div>
    <div class="stack">${up.length ? up.map(r => keytag(r)) : html`<div class="empty">还没有预订。</div>`}</div></section>`;
}

/* ---------- me ---------- */
async function loadMe() {
  const [me, visits, books, referrals, requests] = await Promise.all([get('me'), get('visits.mine'), get('books.list'), get('referral.mine'), get('concierge.mine')]);
  return { me, visits, books: books.filter(b => b.mine), referrals, requests };
}

function viewMe(d) {
  const { me } = d;
  const theme = store.get('sv.theme') || 'auto';
  const stamps = d.visits.slice(0, 6);
  return html`${bar({ title: '我的', sub: 'Dossier' })}
  <main class="main">
    <div class="profile">
      <span class="cameo cameo--lg cameo--pink">${initialOf(me.name)}</span>
      ${me.en ? html`<p class="profile__name">${me.en}</p><p class="profile__zh">${me.name}</p>` : html`<p class="profile__name" style="font:600 24px/1.3 var(--sans);letter-spacing:.2em">${me.name}</p>`}
      <p class="profile__meta">NO. ${me.no} · ${sectorOf(me.sector).en.toUpperCase()} · ${me.base} · SINCE ${me.since.slice(0, 7).replace('-', '.')}</p>
      <p class="profile__v">${me.venture}</p>
    </div>
    <div class="tiles">
      <div class="tile"><b>${me.stats.visits}</b><span>到访</span><small>Visits</small></div>
      <div class="tile"><b>${me.stats.events}</b><span>节目</span><small>Evenings</small></div>
      <div class="tile"><b>${me.stats.referrals}</b><span>推荐</span><small>Referrals</small></div>
    </div>

    <section class="section" style="margin-top:26px">
      <div class="sechead"><div class="sechead__t"><b>到访护照</b><span>Passport</span></div></div>
      <div class="passport">${stamps.map((v, i) => html`<div class="pstamp" style="--r:${[-6, 5, -3, 7, -8, 3][i % 6]}deg"><span>${v.place.split(' · ')[0]}</span><b>${fmt.md(v.at)}</b><small>${v.event ? v.event.title : fmt.dow(v.at)}</small></div>`)}
        ${Array.from({ length: Math.max(0, 6 - stamps.length) }, () => html`<div class="pstamp pstamp--empty"><span>Hangzhou</span><b>· ·</b><small>下一次</small></div>`)}</div>
    </section>

    <section class="section" style="margin-top:26px">
      <div class="sechead"><div class="sechead__t"><b>借书卡</b><span>Library card</span></div><a class="link" href="#/stacks">藏书目录 ${icon('arrow')}</a></div>
      <div class="libcard"><div class="libcard__h"><span>SV · 3F Library</span><span>NO. ${me.no}</span></div>
        ${d.books.length ? d.books.map(b => html`<div class="libcard__row"><b>${b.title}</b><em class="${b.status === 'loan' ? 'is-loan' : ''}">${b.status === 'loan' ? `DUE ${fmt.md(b.dueAt)}` : 'ON HOLD'}</em></div>`)
          : html`<div class="libcard__empty">No books yet. 还没有借书。</div>`}</div>
    </section>

    <section class="section" style="margin-top:26px">
      <div class="sechead"><div class="sechead__t"><b>我的推荐</b><span>Referrals</span></div><button class="link" data-act="nominate">推荐一位 ${icon('plus')}</button></div>
      <div class="list">${d.referrals.length ? d.referrals.map(a => html`<div class="row"><span class="cameo" style="width:34px;height:42px;font-size:15px;box-shadow:none">${initialOf(a.name)}</span><span class="row__t"><b>${a.name}</b><span>${a.venture} · ${fmt.rel(a.createdAt)}</span></span><span class="pill pill--${a.stage}">${stageLabel(a.stage)}</span></div>`)
        : html`<div class="empty" style="border-top:0">Something Ventured 仅限推荐。<br>你可以推荐一位「懂的都懂」的同类。</div>`}</div>
    </section>

    <section class="section" style="margin-top:26px">
      <div class="sechead"><div class="sechead__t"><b>礼宾记录</b><span>The desk</span></div><button class="link" data-act="concierge">按铃 ${icon('bell')}</button></div>
      <div>${d.requests.length ? d.requests.slice(0, 3).map(r => reqRow(r)) : html`<div class="empty">有任何需要，按铃找 ${me.host ? me.host.name : '礼宾台'}。</div>`}</div>
    </section>

    <section class="section" style="margin-top:26px">
      <div class="sechead"><div class="sechead__t"><b>设置</b><span>Settings</span></div></div>
      <div class="seg" role="group" aria-label="外观">
        <button aria-pressed="${String(theme === 'auto')}" data-act="theme" data-v="auto">${icon('auto')}跟随系统</button>
        <button aria-pressed="${String(theme === 'light')}" data-act="theme" data-v="light">${icon('sun')}白天</button>
        <button aria-pressed="${String(theme === 'dark')}" data-act="theme" data-v="dark">${icon('moon')}夜晚</button>
      </div>
      <div class="list" style="margin-top:14px">
        <button class="row" data-act="install"><span class="row__i">${icon('addbox')}</span><span class="row__t"><b>添加到主屏幕</b><span>${isStandalone() ? '已在主屏幕上' : '像 App 一样打开，离线也能出示钥匙'}</span></span><span class="row__r">${icon('arrow')}</span></button>
        <button class="row" data-act="about"><span class="row__i">${icon('crest')}</span><span class="row__t"><b>关于这个演示</b><span>${getMode() === 'server' ? '已连接演示服务器 · 数据实时同步' : '本地演示模式 · 数据保存在本机'}</span></span><span class="row__r">${icon('arrow')}</span></button>
        <button class="row" data-act="logout"><span class="row__i">${icon('close')}</span><span class="row__t"><b>退出登录</b><span>${me.phone}</span></span><span class="row__r"></span></button>
      </div>
    </section>
    <p class="motto">Nothing ventured, nothing gained.</p>
  </main>`;
}
const stageLabel = s => ({ received: '已收到', diligence: '尽调中', initiation: '入会仪式', welcomed: '已入会', declined: '未通过' }[s] || s);
function reqRow(r) {
  const t = REQUEST_TYPES[r.type] || REQUEST_TYPES.other;
  return html`<div class="reqrow"><div class="reqrow__h"><b>${t.zh}</b><span class="pill pill--${r.status}">${r.status === 'open' ? '处理中' : r.status === 'replied' ? '已回复' : '已完成'}</span></div>
    <p>${r.text}</p><small>${fmt.rel(r.createdAt)}</small>
    ${r.reply ? html`<div class="reply"><b>${r.by ? r.by.name : '礼宾台'} · Reply</b>${r.reply}</div>` : ''}</div>`;
}

/* ---------- stacks ---------- */
function viewStacks(books) {
  const q = S.ui.q.trim().toLowerCase();
  const shown = books.filter(b => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
  const shelves = [...new Set(shown.map(b => b.shelf[0]))].sort();
  const names = { A: '风险与创业', B: '机器与心智', C: '硅谷往事', D: '方法与人' };
  const short = b => {
    const chars = [...b.title];
    const max = b.lang === 'en' ? 18 : 9;
    return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : b.title;
  };
  return html`${bar({ title: '藏书', sub: 'The Stacks', back: 'me' })}
  <main class="main">
    <div class="titlecard" style="padding-bottom:4px"><p class="kicker">3F Library · Hangzhou</p><h1 class="h1">真实的藏书</h1><p class="lede">Not a decorative wall. 开业前可预留，开业后到 3F 取书。</p></div>
    <label class="search">${icon('book')}<input type="search" placeholder="书名或作者" data-bind="q" data-live="stacks" value="${S.ui.q}" aria-label="搜索藏书"></label>
    ${shelves.length ? shelves.map(letter => {
      const row = shown.filter(b => b.shelf[0] === letter);
      return html`<div class="shelf"><p class="shelf__k"><span>Shelf ${letter} · ${names[letter] || ''}</span><span>${row.length} 册</span></p>
        <div class="shelf__row">${row.map(b => {
          const h = 118 + (hashN(b.id) % 44);
          const w = b.lang === 'en' ? 30 + (hashN(b.title) % 8) : 32 + (hashN(b.title) % 10);
          return html`<button class="spine sp-${b.color} ${b.lang === 'en' ? 'spine--en' : ''} ${b.status !== 'shelf' && !b.mine ? 'is-out' : ''} ${b.mine ? 'is-mine' : ''}" style="--h:${h}px;--w:${w}px" data-act="spine" data-id="${b.id}" aria-label="${b.title}，${b.author}${b.mine ? '，已为你预留' : b.status !== 'shelf' ? '，已被借出或预留' : ''}">${b.mine ? html`<span class="spine__flag"></span>` : ''}${short(b)}</button>`;
        })}</div><div class="shelf__board"></div></div>`;
    }) : html`<p class="empty" style="margin:20px">没有找到。</p>`}
    <p class="motto">每位会员最多同时预留或借阅 3 本。</p>
  </main>`;
}
const hashN = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function sheetBook({ id }) {
  const b = (S.data.stacks || []).find(x => x.id === id);
  if (!b) return { body: html`<p class="empty">找不到这本书。</p>` };
  const st = b.mine ? (b.status === 'loan' ? ['On loan', '借阅中'] : ['On hold', '已预留']) : b.status === 'shelf' ? null : ['Out', '已借出'];
  return {
    label: b.title,
    body: html`<div class="sheet__head"><p class="kicker">Catalogue card · 索书卡</p></div>
      <div class="catcard">
        <div class="catcard__h"><span>SV-3F · ${b.shelf}</span><span>${b.lang === 'en' ? 'EN' : '中文'}</span></div>
        <p class="catcard__t">${b.title}</p><p class="catcard__a">${b.author}</p>
        <div class="catcard__lines"><div><span>Shelf · 书架</span><b>${b.shelf}</b></div><div><span>Status · 状态</span><b>${b.status === 'shelf' ? '在架' : b.mine ? (b.status === 'loan' ? '你借阅中' : '为你预留') : '暂不可借'}</b></div><div><span>Pick up · 取书</span><b>3F 前台</b></div></div>
        ${st ? html`<span class="catcard__stamp">${st[0]}<small>${st[1]}</small></span>` : ''}
      </div>
      <div style="margin-top:22px">${b.mine && b.status === 'held' ? html`<button class="btn btn--ghost btn--block" data-act="release" data-id="${b.id}">Release<span>取消预留</span></button>`
        : b.status === 'shelf' ? html`<button class="btn btn--accent btn--block" data-act="hold" data-id="${b.id}">Hold this book<span>预留 · 到店取书</span></button>`
        : b.mine ? html`<p class="muted" style="text-align:center">借阅中，请按时归还。</p>` : html`<p class="muted" style="text-align:center">这本书暂时不在架上。</p>`}</div>`,
  };
}

/* ---------- other sheets ---------- */
function sheetNotices({ items }) {
  const kindIcon = { bulletin: 'crest', rsvp: 'ticket', reservation: 'lamp', request: 'bell', referral: 'cameo', visit: 'key', book: 'book', welcome: 'crest', host: 'cameo', stage: 'crest' };
  return {
    tall: true,
    label: '来信与通知',
    body: html`<div class="sheet__head"><p class="kicker">Letters · 来信</p><h2 class="h2">礼宾台与你</h2></div>
      ${items ? (items.length ? items.map(n => html`<div class="notice notice--${n.kind} ${n.read ? '' : 'is-unread'}"><span class="notice__i">${icon(kindIcon[n.kind] || 'bell')}</span><div><div class="notice__t"><b>${n.title}</b><small>${fmt.rel(n.at)}</small></div>${n.body ? html`<p>${n.body}</p>` : ''}</div></div>`) : html`<p class="empty">暂时没有来信。</p>`)
        : html`<p class="empty">…</p>`}`,
  };
}

function sheetConcierge({ sent, requests }) {
  const me = S.data.lobby?.me || S.data.me?.me || S.ui.me;
  return {
    tall: true,
    label: '按铃',
    body: html`<div class="sheet__head">
        <svg class="deskbell ${sent ? 'is-ring' : ''}" viewBox="0 0 92 70" aria-hidden="true"><circle cx="46" cy="9" r="5" fill="currentColor"/><rect x="43" y="12" width="6" height="8" fill="currentColor"/><path d="M12 54a34 34 0 0 1 68 0z" fill="currentColor"/><path d="M24 46a24 26 0 0 1 16-22" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="4" y="56" width="84" height="8" rx="4" fill="#5A3F38"/></svg>
        <p class="kicker">Ring for service · 按铃</p><h2 class="h2">你的专属服务人员会回复你</h2>${me && me.host ? html`<p class="muted" style="font-size:13px">${me.host.name} ${me.host.en} · ${me.host.role}</p>` : ''}</div>
      <form data-form="concierge">
        <div class="chips" style="justify-content:center">${Object.entries(REQUEST_TYPES).map(([k, t]) => html`<button type="button" class="chip" aria-pressed="${String(S.ui.reqType === k)}" data-act="reqtype" data-v="${k}">${t.zh}</button>`)}</div>
        <label class="field" style="margin-top:8px"><span class="field__l"><b>Message</b><span>想要什么帮助？</span></span><textarea class="textarea" name="text" maxlength="300" placeholder="例：周五晚上想带一位朋友来听不插电。" data-bind="reqText">${S.ui.reqText || ''}</textarea></label>
        <p class="form-err" data-err></p>
        <button class="btn btn--accent btn--block btn--row">${icon('bell')}Ring<span>按铃</span></button>
      </form>
      ${requests && requests.length ? html`<div style="margin-top:24px"><p class="kicker kicker--muted" style="text-align:center;margin-bottom:6px">Earlier · 之前的请求</p>${requests.slice(0, 5).map(reqRow)}</div>` : ''}`,
  };
}

function sheetNominate({ result }) {
  if (result) {
    const link = new URL(`./#/apply?invite=${result.invite}`, location.href).href;
    return {
      label: '推荐函',
      body: html`<div class="sheet__head"><p class="kicker">Sealed · 推荐函已封缄</p><h2 class="h2">把邀请码交给对方</h2><p class="muted" style="font-size:13px">致 ${result.application.name}</p></div>
        <div class="envelope"><svg class="envelope__seal"><use href="#i-seal"/></svg>
          <p class="envelope__k">Invitation code · 邀请码</p><p class="envelope__code">${result.invite}</p>
          <p class="envelope__p">对方打开会员端，选择「申请推荐入会」并填入邀请码，<br>筛选进展会同步给你。</p></div>
        <div class="btns" style="margin-top:20px">
          <button class="btn btn--accent btn--row" data-act="copy-invite" data-text="${S.data.me?.me?.name || ''} 邀请你申请加入 Something Ventured。打开 ${link} ，邀请码 ${result.invite}">${icon('copy')}Copy<span>复制邀请</span></button>
          <button class="btn btn--ghost" data-act="sheet-close">Done<span>完成</span></button>
        </div>`,
    };
  }
  return {
    tall: true,
    label: '推荐一位同类',
    body: html`<div class="sheet__head"><p class="kicker">By referral only · 仅限推荐</p><h2 class="h2">推荐一位同类</h2><p class="lede" style="font-size:14px">If you know, you know.</p></div>
      <form data-form="nominate" novalidate>
        <label class="field"><span class="field__l"><b>Name</b><span>姓名 <i>*</i></span></span><input class="input" name="name" maxlength="30"></label>
        <label class="field"><span class="field__l"><b>Mobile</b><span>手机号 <i>*</i></span></span><input class="input input--mono" name="phone" inputmode="numeric" maxlength="13"></label>
        <label class="field"><span class="field__l"><b>Venture & role</b><span>公司 / 职位</span></span><input class="input" name="venture" maxlength="60"></label>
        <div class="field"><span class="field__l"><b>Sector</b><span>领域</span></span>${choiceGroup('sector', SECTORS.map(s => [s.id, s.zh]), 'AI')}</div>
        <label class="field"><span class="field__l"><b>Why</b><span>一句话推荐理由 <i>选填</i></span></span><textarea class="textarea" name="note" maxlength="300"></textarea></label>
        <p class="form-err" data-err></p>
        <button class="btn btn--accent btn--block">Seal the letter<span>生成推荐函</span></button>
      </form>`,
  };
}

let deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function sheetInstall() {
  const ua = navigator.userAgent;
  const wechat = /MicroMessenger/i.test(ua);
  const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  let steps;
  if (isStandalone()) steps = html`<p class="empty"><b>Already home.</b>钥匙已经在你的主屏幕上了。</p>`;
  else if (wechat) steps = html`<svg class="wechat-arrow" viewBox="0 0 70 70" aria-hidden="true"><path d="M8 62C22 40 34 26 58 12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="2 7"/><path d="M46 10l13 1-4 12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="steps"><div class="step"><div><b>点右上角 ${icon('dots')}</b><span>微信里不能直接添加到桌面</span></div></div>
      <div class="step"><div><b>选择「在浏览器打开」</b><span>iPhone 会用 Safari 打开</span></div></div>
      <div class="step"><div><b>再点一次「添加到主屏幕」</b><span>在浏览器里打开这一页，按提示操作</span></div></div></div>`;
  else if (ios) steps = html`<div class="steps"><div class="step"><div><b>点 Safari 底部的 ${icon('share')} 分享</b><span>如果看不到工具栏，先轻点屏幕底部</span></div></div>
      <div class="step"><div><b>选择「添加到主屏幕」${icon('addbox')}</b><span>可能需要往下滑一点</span></div></div>
      <div class="step"><div><b>点右上角「添加」</b><span>桌面会出现 Ventured 的图标</span></div></div></div>`;
  else if (deferredInstall) steps = html`<button class="btn btn--accent btn--block btn--row" data-act="install-prompt">${icon('addbox')}Install<span>安装到桌面</span></button>`;
  else if (android) steps = html`<div class="steps"><div class="step"><div><b>点浏览器的菜单 ${icon('dots')}</b><span>通常在右上角或右下角</span></div></div>
      <div class="step"><div><b>选择「添加到桌面」或「添加至主屏幕」</b><span>华为、小米等浏览器名称略有不同</span></div></div></div>`;
  else steps = html`<div class="steps"><div class="step"><div><b>用手机打开这个地址</b><span class="mono" style="word-break:break-all">${location.href.split('#')[0]}</span></div></div>
      <div class="step"><div><b>再从浏览器菜单「添加到主屏幕」</b><span>iPhone 用 Safari，安卓用系统浏览器或 Chrome</span></div></div></div>`;
  return {
    label: '添加到主屏幕',
    body: html`<div class="sheet__head"><p class="kicker">Add to Home Screen · 添加到主屏幕</p><h2 class="h2">一枚放在口袋里的钥匙</h2><p class="lede" style="font-size:14px">No app store. No review queue.</p></div>${steps}
      <p class="muted" style="font-size:12px;text-align:center;margin-top:18px">添加后从桌面打开：全屏显示，入场码离线可用。</p>`,
  };
}

function sheetAbout() {
  const mode = getMode();
  return {
    label: '关于这个演示',
    body: html`<div class="sheet__head"><svg style="width:46px;height:46px;color:var(--accent-fg)"><use href="#i-crest"/></svg><p class="kicker">About this demo · 演示说明</p><h2 class="h2">Something Ventured 会员端</h2></div>
      <div class="facts">
        <div class="fact">${icon('crest')}<div>${mode === 'server' ? '已连接演示服务器' : mode === 'offline' ? '离线：显示的是缓存内容' : '本地演示模式'}<small>${mode === 'server' ? '会员端与管理后台的数据实时同步。' : '没有服务器时，数据保存在这台设备的浏览器里；同一浏览器打开管理后台，也能看到同一份数据。'}</small></div></div>
        <div class="fact">${icon('key')}<div>演示会员 林知远 · 138 0000 0007<small>演示申请人 宋予安 · 139 0000 0021 · 验证码 ${DEMO_CODE}</small></div></div>
        <div class="fact">${icon('lobby')}<div><a href="../admin/" style="color:var(--accent-fg)">打开管理后台 →</a><small>后台 PIN 1215，可以审核申请、核验入场码、发布节目与公告。</small></div></div>
      </div>
      ${mode === 'local' ? html`<button class="btn btn--ghost btn--block" style="margin-top:20px" data-act="reset-local">Reset demo data<span>重置本机演示数据</span></button>` : ''}`,
  };
}

function sheetBooked({ r }) {
  return {
    label: '预订成功',
    body: html`<div class="sheet__head"><p class="kicker">Your seat is held · 预订成功</p><h2 class="h2">座位已为你保留</h2><p class="muted" style="font-size:13px">${r.zone.zh} · ${r.sessionInfo.zh}</p></div>
      <div class="admit c-mint" style="width:260px"><b>${r.floor.floor} · ${fmt.mdOf(r.date)}</b><span>${r.code}</span></div>
      <div class="facts" style="margin-top:22px">
        <div class="fact">${icon('clock')}<div>${fmt.mdOf(r.date)} ${fmt.dowOf(r.date)} · ${r.sessionInfo.hours}<small>${r.sessionInfo.en}</small></div></div>
        <div class="fact">${icon('seat')}<div>${r.zone.zh} ${r.zone.en} · ${r.party} 位<small>到店出示钥匙页的入场码即可</small></div></div>
      </div>
      <button class="btn btn--accent btn--block" style="margin-top:22px" data-act="sheet-close">Splendid<span>好的</span></button>`,
  };
}

const SHEETS = { event: sheetEvent, book: sheetBook, notices: sheetNotices, concierge: sheetConcierge, nominate: sheetNominate, install: sheetInstall, about: sheetAbout, booked: sheetBooked };

function openSheet(type, props = {}) {
  S.sheet = { type, ...props };
  renderSheet();
  requestAnimationFrame(() => requestAnimationFrame(() => sheetEl.classList.add('is-open')));
}
function renderSheet() {
  if (!S.sheet) return;
  const prev = $('.sheet__body', sheetEl);
  const keep = prev ? prev.scrollTop : 0;
  const v = SHEETS[S.sheet.type](S.sheet);
  sheetEl.innerHTML = html`<div class="scrim" data-act="sheet-close"></div>
    <section class="sheet ${v.tall ? 'sheet--tall' : ''}" role="dialog" aria-modal="true" aria-label="${v.label || ''}">
      <div class="sheet__grab"></div>
      <button class="iconbtn sheet__close" data-act="sheet-close" aria-label="关闭">${icon('close')}</button>
      <div class="sheet__body">${v.body}</div>
      ${v.foot ? html`<div class="sheet__foot">${v.foot}</div>` : ''}
    </section>`.s;
  const body = $('.sheet__body', sheetEl);
  if (body) body.scrollTop = keep;
}
function closeSheet() {
  sheetEl.classList.remove('is-open');
  const closing = S.sheet;
  S.sheet = null;
  setTimeout(() => { if (!S.sheet && closing) sheetEl.innerHTML = ''; }, 450);
}

/* ---------- actions ---------- */
async function busy(el, fn) {
  if (el) el.classList.add('is-busy');
  try { return await fn(); } finally { if (el) el.classList.remove('is-busy'); }
}
function handleError(e, errEl) {
  if (e && (e.code === 'auth' || (e.code === 'forbidden' && S.role === 'member'))) {
    signOut(true);
    toast('请重新登录', 'error');
    return true;
  }
  if (e && e.code === 'forbidden' && S.role !== 'applicant') { S.role = 'applicant'; go('status'); return true; }
  if (errEl) errEl.textContent = e.message || '出了点问题';
  else toast((e && e.message) || '出了点问题', 'error');
  return false;
}
function signOut(local = false) {
  if (!local) call('auth.logout').catch(() => {});
  auth.clear();
  store.set('sv.app.role', null);
  cache = {};
  store.set(CACHE_KEY, null);
  S.role = null;
  S.data = {};
  S.ui.lastVisits = null;
  go('welcome');
}
function signedIn(role, phone) {
  S.role = role;
  store.set('sv.app.role', role);
  if (phone) store.set('sv.app.phone', phone);
  S.data = {};
  go(role === 'member' ? 'lobby' : 'status');
}
async function refreshLobbyBadge() {
  if (S.data.lobby) { try { S.data.lobby = await get('lobby'); if (S.route === 'lobby') render(); } catch { /* ignore */ } }
}
async function checkInvite(code, quiet = false) {
  code = String(code || '').trim().toUpperCase();
  if (!code) { S.ui.inviteInfo = null; if (S.route === 'apply') render(); return; }
  try {
    S.ui.inviteInfo = await call('invite.check', { code });
    S.ui.invite = code;
    if (!quiet) toast(`${S.ui.inviteInfo.lead} 推荐了你`);
  } catch (e) {
    S.ui.inviteInfo = null;
    if (!quiet) toast(e.message, 'error');
  }
  if (S.route === 'apply') render();
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* ignore */ }
  ta.remove();
  return ok;
}

const ACTIONS = {
  'sheet-close': () => closeSheet(),
  demo: async (d, el) => busy(el, async () => {
    try {
      const r = await call('auth.demo', { as: d.as });
      auth.set(r.token);
      signedIn(r.role, d.as === 'member' ? '13800000007' : '13900000021');
    } catch (e) { handleError(e); }
  }),
  'send-code': (d, el) => {
    const form = el.closest('form');
    form.code.value = DEMO_CODE;
    toast(`演示环境：验证码是 ${DEMO_CODE}，已为你填好`);
    let n = 60;
    el.disabled = true;
    const t = setInterval(() => { n -= 1; el.textContent = n > 0 ? `${n} 秒` : '重新获取'; if (n <= 0) { clearInterval(t); el.disabled = false; } }, 1000);
  },
  'check-invite': (d, el) => checkInvite(el.closest('form').invite.value),
  logout: () => { if (confirm('退出登录？')) signOut(); },
  upgrade: async (d, el) => busy(el, async () => {
    try {
      await call('auth.upgrade');
      S.role = 'member';
      store.set('sv.app.role', 'member');
      S.data = {};
      S.ui.firstKey = true;
      go('key');
    } catch (e) { handleError(e); }
  }),
  notices: async () => {
    openSheet('notices', { items: null });
    try {
      const items = await get('notices.list');
      if (S.sheet && S.sheet.type === 'notices') { S.sheet.items = items; renderSheet(); }
      if (items.some(n => !n.read)) { await call('notices.read'); refreshLobbyBadge(); }
    } catch (e) { handleError(e); }
  },
  concierge: async () => {
    openSheet('concierge', { requests: null });
    try {
      const requests = await get('concierge.mine');
      if (S.sheet && S.sheet.type === 'concierge') { S.sheet.requests = requests; renderSheet(); }
    } catch (e) { handleError(e); }
  },
  reqtype: d => { S.ui.reqType = d.v; renderSheet(); },
  event: d => openSheet('event', { id: d.id }),
  rsvp: (d, el) => busy(el, async () => {
    try {
      const e = await call('events.rsvp', { eventId: d.id });
      patchEvent(e);
      if (S.sheet) { S.sheet.admitted = e.mine; renderSheet(); }
      navigator.vibrate?.(20);
      refreshAfterChange();
    } catch (e) { handleError(e); }
  }),
  unrsvp: (d, el) => busy(el, async () => {
    if (!confirm('确定取消吗？')) return;
    try {
      const e = await call('events.cancel', { eventId: d.id });
      patchEvent(e);
      if (S.sheet) { S.sheet.admitted = null; renderSheet(); }
      toast('已取消');
      refreshAfterChange();
    } catch (e) { handleError(e); }
  }),
  filter: d => { S.ui.filter = d.v; render(); },
  flip: () => { const c = $('.mcard'); if (c) c.classList.toggle('is-flipped'); },
  tilt: async () => {
    try { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') toast('没有获得陀螺仪权限'); } catch { toast('这台设备不支持'); }
  },
  floor: d => { S.ui.floor = d.floor; render(); },
  date: async d => {
    S.ui.date = d.date;
    try { S.data.reserve = await loadReserve(); render(); } catch (e) { handleError(e); }
  },
  session: () => { S.ui.session = S.ui.session === 'day' ? 'night' : 'day'; render(); },
  zone: (d, el) => {
    if (el.classList.contains('is-full')) { toast('这个区域在该时段已经订满了'); return; }
    S.ui.zone = d.zone;
    render();
    requestAnimationFrame(() => $('.zonecard')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }));
  },
  party: d => { S.ui.party = Math.max(1, Math.min(4, S.ui.party + Number(d.d))); render(); },
  book: (d, el) => reserveBook(d, el),
  spine: d => openSheet('book', { id: d.id }),
  hold: (d, el) => busy(el, async () => {
    try { const b = await call('books.hold', { id: d.id }); patchBook(b); toast(`《${b.title}》已为你预留`); } catch (e) { handleError(e); }
  }),
  release: (d, el) => busy(el, async () => {
    try { const b = await call('books.release', { id: d.id }); patchBook(b); toast('已取消预留'); } catch (e) { handleError(e); }
  }),
  nominate: () => openSheet('nominate', {}),
  'copy-invite': async d => { toast(await copyText(d.text) ? '邀请已复制，发给对方吧' : '复制失败，请手动抄下邀请码', 'info'); },
  theme: d => { store.set('sv.theme', d.v === 'auto' ? null : d.v); applyTheme(); render(); },
  install: () => openSheet('install'),
  'install-dismiss': () => { store.set('sv.install.dismissed', '1'); render(); },
  'install-prompt': async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const choice = await deferredInstall.userChoice.catch(() => null);
    deferredInstall = null;
    if (choice && choice.outcome === 'accepted') { toast('已添加到桌面'); closeSheet(); }
  },
  about: () => openSheet('about'),
  'reset-local': () => { if (confirm('重置这台设备上的演示数据？')) { localStorage.removeItem('sv.demo.db.v1'); localStorage.removeItem(CACHE_KEY); auth.clear(); location.hash = ''; location.reload(); } },
};
async function reserveBook(d, el) {
  return busy(el, async () => {
    const av = S.data.reserve.av;
    const zone = av.sessions.find(s => s.id === S.ui.session).zones.find(z => z.id === S.ui.zone);
    try {
      const r = await call('reserve.create', { date: av.date, session: S.ui.session, zoneId: S.ui.zone, party: S.ui.session === 'day' && zone.unit === 'seat' ? 1 : S.ui.party, note: S.ui.note });
      S.ui.note = '';
      S.data.reserve = await loadReserve();
      render();
      openSheet('booked', { r });
      navigator.vibrate?.(20);
    } catch (e) { handleError(e); }
  });
}

function patchEvent(e) {
  if (S.data.programme) S.data.programme = S.data.programme.map(x => (x.id === e.id ? e : x));
  else S.data.programme = [e];
  if (S.route === 'programme') render();
}
function patchBook(b) {
  if (S.data.stacks) S.data.stacks = S.data.stacks.map(x => (x.id === b.id ? b : x));
  if (S.route === 'stacks') render();
  renderSheet();
}
const refreshAfterChange = debounce(() => { S.data.lobby = null; S.data.me = null; }, 50);

const FORMS = {
  login: async (form, fd) => {
    const err = $('[data-err]', form);
    err.textContent = '';
    const btn = form.querySelector('button:not([type])');
    await busy(btn, async () => {
      try {
        const r = await call('auth.login', { phone: fd.get('phone'), code: fd.get('code') });
        auth.set(r.token);
        signedIn(r.role, String(fd.get('phone')).replace(/\D/g, ''));
      } catch (e) { handleError(e, err); }
    });
  },
  apply: async (form, fd) => {
    const err = $('[data-err]', form);
    err.textContent = '';
    const btn = form.querySelector('button:not([type])');
    await busy(btn, async () => {
      try {
        const r = await call('apply', Object.fromEntries(fd));
        auth.set(r.token);
        toast('Received · 已收到。尽调进行中。');
        S.ui.inviteInfo = null;
        S.ui.invite = null;
        signedIn('applicant', String(fd.get('phone')).replace(/\D/g, ''));
      } catch (e) { handleError(e, err); }
    });
  },
  concierge: async (form, fd) => {
    const err = $('[data-err]', form);
    const btn = form.querySelector('button:not([type])');
    await busy(btn, async () => {
      try {
        await call('concierge.request', { type: S.ui.reqType, text: fd.get('text') });
        S.ui.reqText = '';
        const requests = await get('concierge.mine');
        S.sheet = { type: 'concierge', sent: true, requests };
        renderSheet();
        toast('铃响了。我们很快回复你。');
        S.data.me = null;
      } catch (e) { handleError(e, err); }
    });
  },
  nominate: async (form, fd) => {
    const err = $('[data-err]', form);
    const btn = form.querySelector('button:not([type])');
    await busy(btn, async () => {
      try {
        const result = await call('referral.nominate', Object.fromEntries(fd));
        S.sheet = { type: 'nominate', result };
        renderSheet();
        S.data.me = null;
        if (S.route === 'me') route();
      } catch (e) { handleError(e, err); }
    });
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('[disabled]')) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.sheet) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][role="button"]:not(button)')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  FORMS[form.dataset.form]?.(form, new FormData(form));
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.bind) {
    S.ui[el.dataset.bind] = el.value;
    if (el.dataset.live === 'stacks') renderStacksLive();
  }
});
document.addEventListener('change', e => {
  const radio = e.target.closest('.choice input[type="radio"]');
  if (radio) radio.closest('.choice').querySelectorAll('.chip').forEach(c => c.classList.toggle('is-on', c.contains(radio)));
});
const renderStacksLive = debounce(() => {
  const input = $('.search input');
  const pos = input ? input.selectionStart : null;
  render();
  const again = $('.search input');
  if (again) { again.focus(); if (pos != null) again.setSelectionRange(pos, pos); }
}, 180);

/* ---------- live updates ---------- */
const refresh = debounce(async () => {
  if (!S.role || !S.route) return;
  const active = document.activeElement;
  if (active && active.matches('input, textarea') && screenEl.contains(active)) { S.pending = true; return; }
  const r = ROUTES[S.route];
  const before = S.data[S.route];
  try {
    if (r.load) {
      const data = await r.load();
      if (S.route === 'status' && before && data.application.stage !== before.application.stage) {
        toast('你的申请有新进展');
        navigator.vibrate?.([20, 60, 20]);
      }
      S.data[S.route] = data;
      render();
    }
    if (S.sheet && S.sheet.type === 'event') { if (!S.data.programme || S.route !== 'programme') S.data.programme = await get('events.list'); renderSheet(); }
    if (S.sheet && S.sheet.type === 'notices') { S.sheet.items = await get('notices.list'); renderSheet(); }
    if (S.sheet && S.sheet.type === 'concierge') { S.sheet.requests = await get('concierge.mine'); renderSheet(); }
  } catch (e) {
    if (e.code === 'auth') handleError(e);
  }
}, 300);
document.addEventListener('focusout', () => { if (S.pending) { S.pending = false; setTimeout(refresh, 50); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });

/* ---------- theme & chrome ---------- */
function applyTheme() {
  const t = store.get('sv.theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  themeColor();
}
function themeColor() {
  const t = store.get('sv.theme');
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const color = S.route === 'key' ? '#7B1E3A' : S.route === 'welcome' ? (dark ? '#3A2127' : '#F7DCD8') : dark ? '#171110' : '#FBF4EA';
  $('meta[name="theme-color"]').setAttribute('content', color);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', themeColor);

function playIntro() {
  const el = $('#intro');
  let seen = false;
  try { seen = sessionStorage.getItem('sv.intro') === '1'; sessionStorage.setItem('sv.intro', '1'); } catch { /* ignore */ }
  if (seen || reduceMotion()) return;
  el.hidden = false;
  const done = () => { el.classList.add('is-out'); setTimeout(() => { el.hidden = true; }, 520); };
  el.addEventListener('click', done, { once: true });
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-go')));
  setTimeout(done, 2300);
}

/* ---------- boot ---------- */
async function boot() {
  applyTheme();
  playIntro();
  await connect({ tokenKey: 'sv.app.token' });
  if (auth.token) {
    try {
      S.data.key = await get('me');
      S.role = 'member';
    } catch (e) {
      if (e.code === 'forbidden') S.role = 'applicant';
      else if (e.code === 'offline') S.role = store.get('sv.app.role') || ('me{}' in cache ? 'member' : null);
      else auth.clear();
    }
  }
  store.set('sv.app.role', S.role);
  onChange(() => refresh());
  addEventListener('hashchange', route);
  await route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* not fatal */ });
  }
}
boot();
