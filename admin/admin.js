/* =========================================================
   Something Ventured · back office
   Same data and rules as the member app (shared/core.js),
   seen from the front desk. Live: changes made on a member's
   phone show up here within a second, and the other way round.
   ========================================================= */
import { connect, call, auth, onChange, getMode, store } from '../shared/api.js';
import { html, raw, fmt, toast, debounce, initialOf } from '../shared/ui.js';
import { SECTORS, STAGES, EVENT_TYPES, SESSIONS, REQUEST_TYPES, COLORS, sectorOf, stageOf, hz, hzDate, DEMO_PIN } from '../shared/core.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const shellEl = $('#shell');
const drawerEl = $('#drawer');
const tipEl = $('#tip');
const icon = id => raw(`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`);

/* chart colours, validated with the dataviz checker (see admin.css) */
const SC = { AI: '#A8385A', VC: '#2F7EBF', Robotics: '#C4861C', Frontier: '#7B5CB8' };
const RAMP = ['#86BFA0', '#5EA27F', '#3F8565', '#28694B', '#164E36'];
const STAGE_NO = { received: '01', diligence: '02', initiation: '03', welcomed: '04', declined: '—' };

const PAGES = {
  overview: { zh: '总览', en: 'Overview', k: 'The house today', icon: 'overview', load: () => call('admin.overview'), view: viewOverview },
  desk: { zh: '前台', en: 'Front desk', k: 'Check-in · 入场核验', icon: 'desk', load: loadDesk, view: viewDesk, after: afterDesk },
  applications: { zh: '入会申请', en: 'Applications', k: 'By referral only · 仅限推荐', icon: 'letter', load: () => call('admin.applications'), view: viewApplications, badge: 'received' },
  members: { zh: '会员', en: 'Members', k: 'The register · 会员名册', icon: 'members', load: () => call('admin.members'), view: viewMembers },
  programme: { zh: '节目', en: 'Programme', k: 'Coming attractions', icon: 'ticket', load: () => call('admin.events'), view: viewProgramme },
  reservations: { zh: '预订', en: 'Reservations', k: '3F Library · 座位', icon: 'lamp', load: () => call('admin.reservations', { date: S.resDate }), view: viewReservations },
  stacks: { zh: '藏书', en: 'The Stacks', k: 'Library · 借阅', icon: 'book', load: () => call('admin.books'), view: viewStacks, badge: 'holds' },
  concierge: { zh: '礼宾', en: 'Concierge', k: 'Ring for service · 按铃', icon: 'bell', load: () => call('admin.requests'), view: viewConcierge, badge: 'openRequests' },
  bulletins: { zh: '公告', en: 'Bulletins', k: 'From the desk · 来信', icon: 'seal', load: () => call('admin.bulletins'), view: viewBulletins },
};

const S = {
  staff: null, page: null, data: {}, badges: {}, drawer: null, seq: 0, resDate: null, seenActivity: null,
  ui: { appQ: '', memQ: '', memSector: 'all', bookFilter: 'all', reqFilter: 'open', evFilter: 'all', tables: {}, allWelcomed: false, loginStaff: 's3', bTitle: '', bBody: '' },
};

/* ---------- boot & routing ---------- */
async function boot() {
  await connect({ tokenKey: 'sv.admin.token' });
  if (auth.token) {
    try { S.staff = await call('admin.me'); } catch { auth.clear(); }
  }
  onChange(() => refresh());
  addEventListener('hashchange', route);
  if (!S.staff) return entrance();
  renderShell();
  route();
}

async function entrance() {
  shellEl.classList.add('is-gate');
  closeDrawer();
  let staff = [];
  try { staff = await call('staff.list'); } catch { /* shown empty */ }
  shellEl.innerHTML = html`<div class="entrance"><form class="entrance__card" data-form="login">
    <svg class="crest"><use href="#i-crest"/></svg>
    <p class="entrance__k">Staff only · 员工通道</p>
    <h1 class="entrance__h">后台</h1>
    <p class="entrance__p">The Back Office of Something Ventured.</p>
    <div class="staffpick" role="radiogroup" aria-label="你是谁">${staff.map(s => html`<button type="button" aria-pressed="${String(S.ui.loginStaff === s.id)}" data-act="pick-staff" data-id="${s.id}"><span class="cameo">${initialOf(s.name)}</span><span><b>${s.name}</b><span>${s.role} · ${s.roleEn}</span></span></button>`)}</div>
    <div class="pin"><input name="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="PIN" aria-label="PIN" required></div>
    <p class="err" data-err></p>
    <button class="btn btn--rasp btn--lg">Enter <span>进入后台</span></button>
    <p class="entrance__demo">演示 PIN：${DEMO_PIN} · <a href="../app/">打开会员端 →</a></p>
  </form></div>`.s;
  $('.pin input')?.focus();
}

function renderShell() {
  shellEl.classList.remove('is-gate');
  const mode = getMode();
  shellEl.innerHTML = html`<aside class="side" id="side">
      <div class="brand"><svg><use href="#i-crest"/></svg><b>Something Ventured</b><span>The Back Office · 后台</span></div>
      <nav class="nav" id="nav" aria-label="后台导航"></nav>
      <div class="side__foot">
        <div class="who"><span class="cameo">${initialOf(S.staff.name)}</span><div><b>${S.staff.name}</b><span>${S.staff.role} · ${S.staff.roleEn}</span></div></div>
        <span class="live ${mode === 'server' ? '' : 'live--local'}"><i></i>${mode === 'server' ? 'LIVE · 实时同步' : mode === 'offline' ? 'OFFLINE · 离线' : 'LOCAL · 本机演示数据'}</span>
        <div class="side__btns">
          <a class="sbtn" href="../app/" target="_blank" rel="noopener">${icon('ext')}会员端</a>
          <button class="sbtn" data-act="reset">${icon('reset')}重置演示</button>
          <button class="sbtn" data-act="logout">${icon('out')}退出</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <button class="icon-btn top__menu" data-act="menu" aria-label="菜单">${icon('menu')}</button>
        <div class="top__t" id="toptitle"></div>
        <div class="clock" aria-label="杭州时间"><span class="clock__d" id="clockd"></span><span class="flaps" id="clock"></span></div>
      </header>
      <div class="page" id="page"></div>
    </div>`.s;
  tickClock(true);
}

function renderNav() {
  const nav = $('#nav');
  if (!nav) return;
  nav.innerHTML = Object.entries(PAGES).map(([id, p]) => {
    const n = p.badge ? S.badges[p.badge] : 0;
    return html`<a href="#/${id}" class="${S.page === id ? 'is-on' : ''}" ${raw(S.page === id ? 'aria-current="page"' : '')}>${icon(p.icon)}<span><b>${p.zh}</b><small>${p.en}</small></span>${n ? html`<span class="badge" aria-label="${n} 项待处理">${n}</span>` : html`<span></span>`}</a>`.s;
  }).join('');
}

async function route() {
  if (!S.staff) return;
  const name = location.hash.replace(/^#\/?/, '').split('?')[0];
  const page = PAGES[name] ? name : 'overview';
  if (page !== name) history.replaceState(null, '', '#/' + page);
  const entering = S.page !== page;
  S.page = page;
  shellEl.classList.remove('is-menu');
  stopDesk();
  renderNav();
  const p = PAGES[page];
  $('#toptitle').innerHTML = html`<span class="top__k">${p.k}</span><div class="top__h"><h1>${p.zh}</h1><span>${p.en}</span></div>`.s;
  document.title = `${p.zh} · Something Ventured 后台`;
  if (entering && S.drawer) closeDrawer();
  await load(true);
  loadBadges();
}

async function load(entering = false) {
  const seq = ++S.seq;
  const page = S.page;
  const pageEl = $('#page');
  if (entering && pageEl) pageEl.innerHTML = '';
  else if (pageEl) pageEl.classList.add('is-stale');
  try {
    const data = await PAGES[page].load();
    if (seq !== S.seq) return;
    S.data[page] = data;
    renderPage(entering);
  } catch (e) {
    if (seq === S.seq) handleError(e);
  }
}

function renderPage(entering = false) {
  hideTip();
  const pageEl = $('#page');
  if (!pageEl) return;
  const keep = window.scrollY;
  pageEl.classList.remove('is-stale');
  pageEl.innerHTML = PAGES[S.page].view(S.data[S.page]).s;
  if (entering) {
    window.scrollTo(0, 0);
    pageEl.style.animation = 'none';
    void pageEl.offsetWidth;
    pageEl.style.animation = '';
  } else window.scrollTo(0, keep);
  PAGES[S.page].after?.();
}

async function loadBadges() {
  try { S.badges = await call('admin.badges'); renderNav(); } catch { /* not fatal */ }
}

const refresh = debounce(async () => {
  if (!S.staff || !S.page) return;
  loadBadges();
  const a = document.activeElement;
  const typing = a && a.matches('input, textarea, select') && ($('#page')?.contains(a) || drawerEl.contains(a));
  if (!typing) await load(false);
  if (S.drawer && !typing) refreshDrawer();
}, 250);

/* ---------- clock: Hangzhou time on a split-flap board ---------- */
let lastClock = '';
function tickClock(force = false) {
  const t = hz();
  const s = `${String(t.h).padStart(2, '0')}${String(t.mi).padStart(2, '0')}`;
  const el = $('#clock');
  if (!el) return;
  const p = fmt.parts(Date.now());
  $('#clockd').textContent = `${p.dowEn} · ${p.d} ${p.mon} ${p.y} · HANGZHOU`;
  if (force || !el.children.length) {
    el.innerHTML = html`<span class="fc">${s[0]}</span><span class="fc">${s[1]}</span><span class="fc fc--sep">:</span><span class="fc">${s[2]}</span><span class="fc">${s[3]}</span>`.s;
  } else if (s !== lastClock) {
    const cells = $$('.fc:not(.fc--sep)', el);
    [...s].forEach((c, i) => { if (cells[i].textContent !== c) { cells[i].textContent = c; cells[i].classList.remove('is-flip'); void cells[i].offsetWidth; cells[i].classList.add('is-flip'); } });
  }
  lastClock = s;
}
setInterval(tickClock, 1000);

/* ---------- shared bits ---------- */
function card(title, en, body, { id = null, sub = '', table = null, tools = '' } = {}) {
  const showTable = id && S.ui.tables[id];
  return html`<section class="card">
    <div class="card__h"><div class="card__t"><b>${title}</b><span>${en}</span>${sub ? html`<p>${sub}</p>` : ''}</div>
      <div class="card__tools">${tools}${id && table ? html`<button class="icon-btn" aria-pressed="${String(!showTable)}" data-act="view" data-id="${id}" data-v="chart" aria-label="图表">${icon('chart')}</button><button class="icon-btn" aria-pressed="${String(!!showTable)}" data-act="view" data-id="${id}" data-v="table" aria-label="表格">${icon('table')}</button>` : ''}</div></div>
    <div class="card__b">${showTable ? html`<div class="tblview">${table}</div>` : body}</div>
  </section>`;
}
const stamp = (cls, en, zh) => html`<span class="stamp st-${cls}">${en}<small>${zh}</small></span>`;
const stageStamp = id => { const s = stageOf(id); return stamp(id, s.en, s.zh); };
const sectorTag = id => { const s = sectorOf(id); return html`<span class="tag"><i style="background:${SC[s.id]}"></i>${s.zh}</span>`; };
const daysIn = t => { const d = Math.floor((Date.now() - Date.parse(t)) / 864e5); return d <= 0 ? '今天' : `${d} 天`; };
function datebox(t) {
  const p = fmt.parts(t);
  return html`<span class="datebox"><span>${p.mon}</span><b>${p.d}</b><span>${p.dowZh}</span></span>`;
}
function meter(taken, cap, waitlist = 0) {
  const pct = cap ? Math.min(100, Math.round((taken / cap) * 100)) : 0;
  return html`<div class="meter"><div class="meter__l"><span>${taken}/${cap}</span><span>${waitlist ? `候补 ${waitlist}` : pct >= 100 ? '已满' : `${pct}%`}</span></div><div class="meter__t"><span class="meter__f ${pct >= 100 ? 'is-full' : ''}" style="width:${pct}%"></span></div></div>`;
}
function niceScale(max) {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : 20;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

/* ---------- overview ---------- */
function viewOverview(d) {
  const k = d.kpis;
  const lib = d.floors.find(f => f.id === 'library');
  const pct = k.weekCapacity ? Math.round((k.weekSeats / k.weekCapacity) * 100) : 0;
  const kpi = (l, en, v, sub, accent = false) => html`<div class="kpi ${accent ? 'kpi--accent' : ''}"><p class="kpi__l">${l}<span>${en}</span></p><p class="kpi__v">${v}</p><p class="kpi__d">${sub}</p></div>`;
  const seen = S.seenActivity;
  S.seenActivity = d.activity[0] ? d.activity[0].at : null;
  return html`
    <div class="kpis">
      ${kpi('会员', 'Members', k.members, html`<b>+${k.newMembers}</b> 近 30 天入会`)}
      ${kpi('在途申请', 'In the pipeline', k.pipeline, `${k.received} 份待初筛`)}
      ${lib.status === 'preopening' ? kpi('距开业', 'Days to opening', html`${k.daysToOpening}<small>天</small>`, '3F Library · 12.15', true) : kpi('今日到访', 'Visits today', k.visitsToday, lib.state.zh, true)}
      ${kpi('开业周座位', 'Opening week seats', html`${pct}<small>%</small>`, `${k.weekSeats} / ${k.weekCapacity} 席已订`)}
      ${kpi('待回复', 'Open requests', k.openRequests, `${k.holds} 本书已预留待取`)}
    </div>
    <div class="grid g-21">
      ${card('新申请', 'Applications per week', weeklyChart(d.weekly), { id: 'weekly', sub: '近 12 周，按提交日期（周一开始）', table: weeklyTable(d.weekly) })}
      ${card('会员构成', 'Members by sector', sectorBar(d.sectors), { id: 'sectors', sub: `${k.members} 位在册会员`, table: sectorTable(d.sectors) })}
    </div>
    <div class="grid g-21 is-top" style="margin-top:18px">
      ${card('开业周 · 3F Library', 'Seats booked', heatmap(d.heat), { id: 'heat', sub: '每格是一个时段已订座位占比（不含小书房）', table: heatTable(d.heat) })}
      ${card('楼层', 'Floors', floorControls(d.floors), { sub: '切换后，会员端的楼层指南会立刻更新' })}
    </div>
    <div class="grid g-2" style="margin-top:18px">
      ${card('即将上映', 'Upcoming', d.upcoming.length ? html`<div>${d.upcoming.map(e => html`<div class="evrow">${datebox(e.startsAt)}<div class="evrow__t"><b>${e.title}</b><span>${fmt.time(e.startsAt)} · ${e.venue}</span></div>${meter(e.taken, e.capacity, e.waitlist)}</div>`)}</div>` : html`<p class="empty">暂无节目</p>`, { tools: html`<a class="btn btn--ghost btn--sm" href="#/programme">全部节目</a>` })}
      ${card('动态', 'Activity', html`<div class="feed">${d.activity.map(a => html`<div class="${seen && a.at > seen ? 'is-new' : ''}"><time>${fmt.rel(a.at)}</time><span>${a.text}</span></div>`)}</div>`)}
    </div>`;
}

function weeklyChart(weekly) {
  const W = 640, H = 230, L = 34, R = 8, T = 18, B = 28;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(...weekly.map(w => w.count), 1);
  const { top, ticks } = niceScale(max);
  const band = pw / weekly.length;
  const bw = Math.min(24, band * 0.56);
  const y = v => T + ph - (v / top) * ph;
  const peak = weekly.reduce((m, w, i) => (w.count > weekly[m].count ? i : m), 0);
  const last = weekly.length - 1;
  const bars = weekly.map((w, i) => {
    const x = L + i * band + (band - bw) / 2;
    const h = (w.count / top) * ph;
    const yy = T + ph - h;
    const r = Math.min(4, h);
    const path = h > 0 ? `M${x} ${T + ph}V${yy + r}Q${x} ${yy} ${x + r} ${yy}H${x + bw - r}Q${x + bw} ${yy} ${x + bw} ${yy + r}V${T + ph}Z` : '';
    const end = fmt.mdOf(new Date(Date.parse(w.start + 'T00:00:00+08:00') + 6 * 864e5).toISOString().slice(0, 10));
    return `${path ? `<path class="bar" data-bar="${i}" d="${path}" fill="${SC.AI}"/>` : ''}
      ${(i === peak || i === last) && w.count > 0 ? `<text class="lbl" x="${x + bw / 2}" y="${yy - 6}" text-anchor="middle">${w.count}</text>` : ''}
      <rect class="hit" x="${L + i * band}" y="${T}" width="${band}" height="${ph}" tabindex="0" data-tip="${w.count} 份" data-tip-l="${fmt.mdOf(w.start)} – ${end}${i === last ? ' · 本周' : ''}" data-for="${i}"/>
      <text x="${L + i * band + band / 2}" y="${H - 8}" text-anchor="middle">${fmt.mdOf(w.start)}</text>`;
  }).join('');
  return raw(`<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="近 12 周每周新申请数量">
    <g class="grid">${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
    ${ticks.map(t => `<text x="${L - 8}" y="${y(t) + 3.5}" text-anchor="end">${t}</text>`).join('')}
    <g class="axis"><line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}"/></g>
    ${bars}</svg></div>`);
}
function weeklyTable(weekly) {
  return html`<table class="table"><thead><tr><th>周（起）</th><th class="num">新申请</th></tr></thead><tbody>${weekly.map(w => html`<tr><td>${w.start.replaceAll('-', '.')}</td><td class="num">${w.count}</td></tr>`)}</tbody></table>`;
}

function sectorBar(sectors) {
  const total = sectors.reduce((s, x) => s + x.count, 0) || 1;
  const parts = sectors.filter(s => s.count > 0);
  // a thin segmented bar: the rows beneath carry the names and figures, each with its swatch
  return html`<div class="segbar" role="img" aria-label="${parts.map(s => `${s.zh} ${s.count} 位，${Math.round((s.count / total) * 100)}%`).join('；')}">
      ${parts.map(s => { const share = Math.round((s.count / total) * 100); return html`<div class="segbar__p" style="flex:${s.count} 1 0;background:${SC[s.id]}" tabindex="0" data-tip="${s.count} 位 · ${share}%" data-tip-l="${s.zh} · ${s.en}"></div>`; })}
    </div>
    <div class="sectors">${sectors.map(s => html`<div><i style="background:${SC[s.id]}"></i><span>${s.zh} <span class="muted ital">${s.en}</span></span><b>${s.count}</b><span class="muted">${Math.round((s.count / total) * 100)}%</span></div>`)}</div>`;
}
function sectorTable(sectors) {
  const total = sectors.reduce((s, x) => s + x.count, 0) || 1;
  return html`<table class="table"><thead><tr><th>领域</th><th class="num">会员</th><th class="num">占比</th></tr></thead><tbody>${sectors.map(s => html`<tr><td>${s.zh} · ${s.en}</td><td class="num">${s.count}</td><td class="num">${Math.round((s.count / total) * 100)}%</td></tr>`)}</tbody></table>`;
}

function heatmap(heat) {
  const dates = heat[0].cells.map(c => c.date);
  const W = 640, L = 92, T = 34, ch = 46, gap = 2;
  const cw = (W - L) / dates.length;
  const H = T + heat.length * ch + 4;
  let peak = null;
  heat.forEach((row, r) => row.cells.forEach((c, i) => { const v = c.capacity ? c.booked / c.capacity : 0; if (!peak || v > peak.v) peak = { r, i, v }; }));
  const cells = heat.map((row, r) => row.cells.map((c, i) => {
    const v = c.capacity ? c.booked / c.capacity : 0;
    const step = Math.min(4, Math.floor(v * 5));
    const x = L + i * cw, yy = T + r * ch;
    const isPeak = peak && peak.r === r && peak.i === i && v > 0;
    return `<rect class="cell" x="${x + gap / 2}" y="${yy + gap / 2}" width="${cw - gap}" height="${ch - gap}" rx="4" fill="${RAMP[step]}" tabindex="0" data-tip="${Math.round(v * 100)}%" data-tip-l="${fmt.mdOf(c.date)} ${fmt.dowOf(c.date)} · ${row.zh} · ${c.booked}/${c.capacity} 席"/>
      ${isPeak ? `<text class="lbl" x="${x + cw / 2}" y="${yy + ch / 2 + 4}" text-anchor="middle" style="fill:${step >= 2 ? '#fff' : '#13261C'}">${Math.round(v * 100)}%</text>` : ''}`;
  }).join('')).join('');
  return raw(`<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="开业周每个时段的座位预订占比">
    ${dates.map((d, i) => `<text x="${L + i * cw + cw / 2}" y="14" text-anchor="middle" class="lbl" style="font-size:11px">${fmt.mdOf(d)}</text><text x="${L + i * cw + cw / 2}" y="27" text-anchor="middle">${fmt.dowOf(d)}</text>`).join('')}
    ${heat.map((row, r) => `<text x="0" y="${T + r * ch + ch / 2 - 2}" class="lbl">${row.session === 'day' ? 'DAY' : 'NIGHT'}</text><text x="0" y="${T + r * ch + ch / 2 + 12}">${row.session === 'day' ? '白天 · 会员' : '夜晚 · 开放'}</text>`).join('')}
    ${cells}</svg></div>
    <div class="ramp"><span>${RAMP.map(c => `<i style="background:${c}"></i>`).join('')}</span>0% → 100% · 每档 20%</div>`);
}
function heatTable(heat) {
  return html`<table class="table"><thead><tr><th>日期</th>${heat.map(r => html`<th class="num">${r.zh}</th>`)}</tr></thead><tbody>${heat[0].cells.map((c, i) => html`<tr><td>${fmt.mdOf(c.date)} ${fmt.dowOf(c.date)}</td>${heat.map(r => html`<td class="num">${r.cells[i].booked}/${r.cells[i].capacity}</td>`)}</tr>`)}</tbody></table>`;
}

function floorControls(floors) {
  return html`<div class="floors">${floors.map(f => {
    const live = f.state.key === 'day' || f.state.key === 'night';
    const planned = f.status === 'planned';
    return html`<div class="floor"><span class="floor__n">${f.floor}</span><div class="floor__b">
      <b>${f.name}<i>${f.zh}</i></b>
      <p><span class="dot ${live ? 'dot--live' : f.state.key === 'soon' ? 'dot--soon' : ''}"></span>${f.state.zh}${planned ? ' · 开业后可在这里切换' : ''}</p>
      <span class="seg" role="group" aria-label="${f.name} 营业状态">${[['preopening', '筹备中'], ['open', '营业中'], ['closed', '今日休息']].map(([v, l]) => html`<button aria-pressed="${String(f.status === v)}" ${raw(planned ? 'disabled' : '')} data-act="floor" data-id="${f.id}" data-status="${v}">${l}</button>`)}</span>
      ${f.id === 'library' && f.status === 'open' ? html`<span class="seg" role="group" aria-label="昼夜模式">${[['auto', '自动'], ['day', '白天'], ['night', '夜晚']].map(([v, l]) => html`<button aria-pressed="${String(f.mode === v)}" data-act="floor" data-id="${f.id}" data-mode="${v}">${l}</button>`)}</span>` : ''}
    </div></div>`;
  })}</div>`;
}

/* ---------- front desk ---------- */
async function loadDesk() {
  const [today, visits, demo] = await Promise.all([call('admin.reservations', { date: hzDate() }), call('admin.visits'), call('admin.democode')]);
  return { today, visits, demo };
}
function viewDesk(d) {
  const r = S.ui.lastCheckin;
  const todayList = d.today.date === hzDate() ? d.today.list : [];
  return html`<div class="desk">
    <div>
      <form class="door" data-form="checkin" autocomplete="off">
        <p class="door__k">The front door · 入场核验</p>
        <h2 class="door__h">请出示入场码</h2>
        <p class="door__p">会员打开「钥匙」页，入场码每 30 秒更新一次。</p>
        <div class="digits" id="digits">${[0, 1, 2, 3, 4, 5].map(i => html`<input inputmode="numeric" maxlength="1" aria-label="第 ${i + 1} 位" data-digit="${i}">`)}</div>
        <div><button class="btn btn--brass btn--lg">${icon('key')}Verify<span>核验入场</span></button></div>
        <p class="door__err" data-err role="alert"></p>
        <div class="democode">演示：${d.demo.member.name} 手机上现在显示 <b id="democode">${d.demo.code}</b><button type="button" data-act="fill-demo">填入</button></div>
      </form>
      ${r ? html`<div class="admitted">
        <span class="admitted__stamp ${r.repeat ? 'is-repeat' : ''}">${r.repeat ? 'Already in' : 'Admitted'}<small>${r.repeat ? '已入场' : '欢迎光临'}</small></span>
        <span class="cameo cameo--lg">${initialOf(r.member.name)}</span>
        <div><h3>${r.member.name}${r.member.en ? html`<i>${r.member.en}</i>` : ''}</h3>
          <p class="mono">NO. ${r.member.no} · ${sectorOf(r.member.sector).en.toUpperCase()} · ${r.member.base}</p>
          <ul>
            <li>专属服务：${r.member.host ? r.member.host.name : '—'} · 第 ${r.member.stats.visits} 次到访</li>
            ${r.reservation ? html`<li>今日预订：${r.reservation.zone.zh} · ${r.reservation.sessionInfo.zh} · ${r.reservation.party} 位（已入座）</li>` : html`<li class="muted">今天没有座位预订</li>`}
            ${r.event ? html`<li>今晚节目：${r.event.title}（已签到）</li>` : ''}
          </ul></div>
      </div>` : ''}
    </div>
    <div class="grid">
      ${card('今日预订', 'Today', todayList.length ? html`<div class="minilist">${todayList.map(x => html`<div><span><b>${x.member.name}</b> <span class="muted">No.${x.member.no}</span><br><span class="muted">${x.zone.zh} · ${x.sessionInfo.zh} · ${x.party} 位</span></span>${stamp(x.status, x.status, ({ confirmed: '待到店', seated: '已入座', 'no-show': '未到' })[x.status] || x.status)}</div>`)}</div>`
        : html`<p class="empty"><b>No bookings today.</b>今天没有座位预订${d.today.date !== hzDate() ? `，最近的预订在 ${fmt.mdOf(d.today.date)}` : ''}。</p>`)}
      ${card('最近入场', 'Recent arrivals', d.visits.length ? html`<div class="minilist">${d.visits.slice(0, 10).map(v => html`<div><span><b>${v.member ? v.member.name : '—'}</b> <span class="muted">No.${v.member ? v.member.no : ''}</span><br><span class="muted">${v.place}</span></span><span class="num muted">${fmt.rel(v.at)}</span></div>`)}</div>` : html`<p class="empty">还没有人入场</p>`)}
    </div>
  </div>`;
}
let deskTimer = null;
function stopDesk() { clearInterval(deskTimer); deskTimer = null; }
function afterDesk() {
  const inputs = $$('#digits input');
  inputs[0]?.focus();
  stopDesk();
  deskTimer = setInterval(async () => {
    if (S.page !== 'desk') return stopDesk();
    try { const d = await call('admin.democode'); const el = $('#democode'); if (el) el.textContent = d.code; if (S.data.desk) S.data.desk.demo = d; } catch { /* ignore */ }
  }, 5000);
}
function digitsValue() { return $$('#digits input').map(i => i.value).join(''); }
function fillDigits(code) {
  const inputs = $$('#digits input');
  [...String(code).replace(/\D/g, '').slice(0, 6)].forEach((c, i) => { if (inputs[i]) inputs[i].value = c; });
  const next = inputs.find(i => !i.value) || inputs[inputs.length - 1];
  next?.focus();
}

/* ---------- applications ---------- */
function viewApplications(list) {
  const q = S.ui.appQ.trim().toLowerCase();
  const match = a => !q || [a.name, a.en, a.venture, a.lead, a.phone].some(v => String(v || '').toLowerCase().includes(q));
  const counts = Object.fromEntries(STAGES.map(s => [s.id, list.filter(a => a.stage === s.id).length]));
  return html`<div class="toolbar">
      <label class="search">${icon('search')}<input type="search" placeholder="搜索姓名、公司、推荐人" value="${S.ui.appQ}" data-bind="appQ" data-live="1" aria-label="搜索申请"></label>
      <span class="muted">在途 ${counts.received + counts.diligence + counts.initiation} 份 · 已入会 ${counts.welcomed} · 婉拒 ${counts.declined}</span>
      <span class="toolbar__sp"></span>
      <span class="legend" style="margin:0">${SECTORS.map(s => html`<span><i style="background:${SC[s.id]}"></i>${s.zh}</span>`)}</span>
    </div>
    <div class="board">${STAGES.map(st => {
      let items = list.filter(a => a.stage === st.id && match(a));
      const total = items.length;
      if (st.id === 'welcomed' && !S.ui.allWelcomed) items = items.slice(0, 6);
      return html`<section class="col" aria-label="${st.zh}">
        <header class="col__h"><b>${STAGE_NO[st.id]} · ${st.en}</b><span>${st.zh}</span><em>${total}</em></header>
        ${items.map(a => html`<button class="appcard" style="--c:${SC[a.sector] || '#C9A15A'}" data-act="app" data-id="${a.id}">
          <span class="appcard__h"><b>${a.name}${a.en ? html`<i>${a.en}</i>` : ''}</b><time>${daysIn(a.stageAt)}</time></span>
          <p>${a.venture}</p>
          <span class="appcard__tags">${sectorTag(a.sector)}<span class="tag">${a.base}</span>
            ${a.lead ? html`<span class="tag tag--lead">荐 · ${a.lead}</span>` : html`<span class="tag">无推荐人</span>`}
            ${!a.completed ? html`<span class="tag tag--warn">待补全</span>` : ''}
            ${a.stage === 'initiation' && a.initiationAt ? html`<span class="tag">仪式 ${fmt.md(a.initiationAt)} ${fmt.time(a.initiationAt)}</span>` : ''}
            ${a.stage === 'welcomed' && a.memberNo ? html`<span class="tag">No.${a.memberNo}</span>` : ''}</span>
        </button>`)}
        ${st.id === 'welcomed' && total > 6 ? html`<button class="col__more" data-act="all-welcomed">${S.ui.allWelcomed ? '收起' : `显示全部 ${total} 位`}</button>` : ''}
        ${!total ? html`<p class="muted" style="text-align:center;font-size:12px;padding:16px 0">空</p>` : ''}
      </section>`;
    })}</div>`;
}

function drawerApp({ id }) {
  const a = (S.data.applications || []).find(x => x.id === id);
  if (!a) return { label: '申请', head: html`<p class="k">Application</p><h2>找不到这份申请</h2>`, body: '' };
  const s = sectorOf(a.sector);
  const defaultAt = a.initiationAt ? new Date(Date.parse(a.initiationAt) + 8 * 36e5).toISOString().slice(0, 16) : '2026-12-14T16:00';
  const acts = [];
  if (a.stage === 'received') acts.push(html`<button class="btn btn--rasp" data-act="move" data-stage="diligence">开始尽调 <span>Diligence</span></button>`);
  if (a.stage === 'diligence') acts.push(html`<button class="btn btn--rasp" data-act="move" data-stage="initiation">安排入会仪式 <span>Initiation</span></button>`);
  if (a.stage === 'initiation') acts.push(html`<button class="btn btn--brass" data-act="move" data-stage="welcomed">欢迎入会 <span>Welcome</span></button>`);
  if (a.stage === 'declined') acts.push(html`<button class="btn" data-act="move" data-stage="received">重新打开 <span>Reopen</span></button>`);
  if (a.stage === 'welcomed' && a.memberId) acts.push(html`<button class="btn" data-act="member" data-id="${a.memberId}">查看会员档案 <span>No.${a.memberNo}</span></button>`);
  if (!['welcomed', 'declined'].includes(a.stage)) acts.push(html`<button class="btn btn--ghost" data-act="move" data-stage="declined">婉拒 <span>Decline</span></button>`);
  return {
    label: `${a.name} 的申请`,
    head: html`<p class="k">Application · 入会申请</p><h2>${a.name}${a.en ? html`<i>${a.en}</i>` : ''}</h2><p>${fmt.full(a.createdAt)} 提交 · ${a.source === 'nomination' ? '会员推荐函' : '会员端申请'}</p>`,
    body: html`<div class="regcard"><div class="regcard__h">Registration · 登记卡<span>${a.id}</span></div>
        ${stageStamp(a.stage)}
        <dl class="kv">
          <dt>Venture</dt><dd>${a.venture}</dd>
          <dt>Sector</dt><dd><span class="tag"><i style="background:${SC[s.id]}"></i>${s.zh} · ${s.en}</span></dd>
          <dt>Base</dt><dd>${a.base}</dd>
          <dt>Lead</dt><dd>${a.lead ? html`${a.lead}${a.leadNo ? html` <span class="muted mono">No.${a.leadNo}</span>` : ''}` : html`<span class="muted">无推荐人</span>`}</dd>
          <dt>Mobile</dt><dd class="mono">${a.phone}</dd>
          <dt>WeChat</dt><dd>${a.wechat || html`<span class="muted">—</span>`}</dd>
          ${a.invite ? html`<dt>Invite</dt><dd class="mono">${a.invite}${a.completed ? '' : html` <span class="tag tag--warn">被推荐人尚未补全登记卡</span>`}</dd>` : ''}
        </dl></div>
      <div class="dsec"><div class="dsec__h"><b>最近在押注什么</b><span>Thesis</span></div>${a.thesis ? html`<p class="thesis is-zh">${a.thesis}</p>` : html`<p class="muted">未填写</p>`}</div>
      ${a.stage === 'diligence' ? html`<div class="dsec"><div class="dsec__h"><b>入会仪式</b><span>Initiation</span></div>
        <div class="f"><label for="initAt">时间 <i>杭州时间</i></label><input class="inp" type="datetime-local" id="initAt" value="${defaultAt}"></div></div>` : ''}
      <div class="dsec"><div class="dsec__h"><b>进度</b><span>Timeline</span></div>
        <ol class="timeline">${a.history.map(h => html`<li>${stageOf(h.stage).zh}<time>${fmt.full(h.at)}</time></li>`)}
        ${a.initiationAt ? html`<li>入会仪式定在 ${fmt.full(a.initiationAt)}</li>` : ''}</ol></div>
      <div class="dsec"><div class="dsec__h"><b>内部备注</b><span>Notes · 仅员工可见</span></div>
        ${a.notes.map(n => html`<div class="note"><small>${n.by} · ${fmt.rel(n.at)}</small>${n.text}</div>`)}
        <form data-form="note" style="margin-top:10px;display:flex;gap:8px"><input class="inp" name="text" placeholder="写一条备注…" maxlength="300"><button class="btn btn--sm">保存</button></form></div>`,
    foot: acts,
  };
}

/* ---------- members ---------- */
function viewMembers(list) {
  const q = S.ui.memQ.trim().toLowerCase();
  const rows = list.filter(m => (S.ui.memSector === 'all' || m.sector === S.ui.memSector) && (!q || [m.name, m.en, m.venture, m.no, m.phone].some(v => String(v || '').toLowerCase().includes(q))));
  return html`<div class="toolbar">
      <label class="search">${icon('search')}<input type="search" placeholder="姓名、编号、公司、手机" value="${S.ui.memQ}" data-bind="memQ" data-live="1" aria-label="搜索会员"></label>
      <span class="chips">${[['all', '全部'], ...SECTORS.map(s => [s.id, s.zh])].map(([v, l]) => html`<button class="chip" aria-pressed="${String(S.ui.memSector === v)}" data-act="mem-sector" data-v="${v}">${l}</button>`)}</span>
      <span class="toolbar__sp"></span><span class="muted">${rows.length} / ${list.length} 位</span>
    </div>
    <section class="card"><div class="tablewrap"><table class="table">
      <thead><tr><th>No.</th><th>会员</th><th>领域</th><th>城市</th><th>专属服务</th><th>入会</th><th class="num">到访</th><th class="num">节目</th><th class="num">推荐</th><th>状态</th></tr></thead>
      <tbody>${rows.map(m => html`<tr data-act="member" data-id="${m.id}" tabindex="0">
        <td class="num" style="text-align:left">${m.no}</td>
        <td><span class="who2"><span class="cameo">${initialOf(m.name)}</span><span><b>${m.name}${m.en ? html` <span class="ital muted">${m.en}</span>` : ''}</b><span>${m.venture}</span></span></span></td>
        <td>${sectorTag(m.sector)}</td><td>${m.base}</td><td>${m.host ? m.host.name : '—'}</td>
        <td class="num" style="text-align:left">${m.since.replaceAll('-', '.')}</td>
        <td class="num">${m.stats.visits}</td><td class="num">${m.stats.events}</td><td class="num">${m.stats.referrals}</td>
        <td>${m.status === 'active' ? stamp('active', 'Active', '在册') : stamp('paused', 'Paused', '暂停')}</td></tr>`)}</tbody>
    </table></div>${rows.length ? '' : html`<p class="empty" style="margin:16px">没有符合条件的会员</p>`}</section>`;
}

function drawerMember({ data }) {
  if (!data) return { label: '会员', head: html`<p class="k">Member</p><h2>…</h2>`, body: html`<p class="muted">加载中…</p>` };
  const m = data;
  const staff = S.staffList || [];
  return {
    label: `${m.name} 的档案`,
    head: html`<div style="display:flex;gap:16px;align-items:center"><span class="cameo cameo--lg">${initialOf(m.name)}</span><div><p class="k">Member · No.${m.no}</p><h2>${m.name}${m.en ? html`<i>${m.en}</i>` : ''}</h2><p>${m.venture}</p></div></div>`,
    body: html`<dl class="kv">
        <dt>Sector</dt><dd>${sectorTag(m.sector)}</dd><dt>Base</dt><dd>${m.base}</dd><dt>Mobile</dt><dd class="mono">${m.phone}</dd>
        <dt>Since</dt><dd class="mono">${m.since.replaceAll('-', '.')}</dd>
        <dt>Host</dt><dd><select class="sel" style="max-width:220px" data-change="host" data-id="${m.id}">${staff.filter(s => s.role === '会员服务' || s.id === m.hostId).map(s => html`<option value="${s.id}" ${raw(s.id === m.hostId ? 'selected' : '')}>${s.name} · ${s.role}</option>`)}</select></dd>
        <dt>Status</dt><dd><span class="seg"><button aria-pressed="${String(m.status === 'active')}" data-act="mem-status" data-id="${m.id}" data-v="active">在册</button><button aria-pressed="${String(m.status === 'paused')}" data-act="mem-status" data-id="${m.id}" data-v="paused">暂停</button></span></dd>
        ${m.application && m.application.lead ? html`<dt>Lead</dt><dd>${m.application.lead}</dd>` : ''}
      </dl>
      <div class="dsec"><div class="dsec__h"><b>预订</b><span>Reservations · ${m.reservations.length}</span></div>${m.reservations.length ? html`<div class="minilist">${m.reservations.slice(0, 6).map(r => html`<div><span>${fmt.mdOf(r.date)} ${r.sessionInfo.zh} · ${r.zone.zh} · ${r.party} 位</span>${stamp(r.status, r.status, ({ confirmed: '已确认', seated: '已入座', cancelled: '已取消', 'no-show': '未到' })[r.status])}</div>`)}</div>` : html`<p class="muted">暂无</p>`}</div>
      <div class="dsec"><div class="dsec__h"><b>节目</b><span>Programme · ${m.events.length}</span></div>${m.events.length ? html`<div class="minilist">${m.events.slice(0, 6).map(x => html`<div><span>${fmt.md(x.event.startsAt)} · ${x.event.title}</span>${stamp(x.status, x.status, ({ going: '已报名', waitlist: '候补', attended: '已到场' })[x.status] || x.status)}</div>`)}</div>` : html`<p class="muted">暂无</p>`}</div>
      <div class="dsec"><div class="dsec__h"><b>借书卡</b><span>Library</span></div>${m.books.length ? html`<div class="minilist">${m.books.map(b => html`<div><span>《${b.title}》</span>${stamp(b.status, b.status === 'loan' ? 'On loan' : 'On hold', b.status === 'loan' ? '借阅中' : '已预留')}</div>`)}</div>` : html`<p class="muted">暂无</p>`}</div>
      <div class="dsec"><div class="dsec__h"><b>推荐</b><span>Referrals · ${m.referrals.length}</span></div>${m.referrals.length ? html`<div class="minilist">${m.referrals.map(a => html`<div><span>${a.name} · ${a.venture}</span>${stageStamp(a.stage)}</div>`)}</div>` : html`<p class="muted">暂无</p>`}</div>
      <div class="dsec"><div class="dsec__h"><b>到访</b><span>Visits · ${m.visits.length}</span></div>${m.visits.length ? html`<div class="minilist">${m.visits.slice(0, 8).map(v => html`<div><span>${v.place}</span><span class="num muted">${fmt.full(v.at)}</span></div>`)}</div>` : html`<p class="muted">暂无</p>`}</div>`,
  };
}

/* ---------- programme ---------- */
function evcard(e, act = true) {
  const t = EVENT_TYPES[e.type] || { en: '', zh: '' };
  const p = fmt.parts(e.startsAt);
  const st = e.status === 'published' ? (e.past ? stamp('closed', 'Ended', '已结束') : stamp('published', 'Live', '已发布')) : e.status === 'draft' ? stamp('draft', 'Draft', '草稿') : stamp('cancelled', 'Cancelled', '已取消');
  return html`<${raw(act ? 'button' : 'div')} class="evcard c-${e.color}" ${raw(act ? `data-act="event" data-id="${e.id}"` : '')}>
    <span class="evcard__d"><span>${p.mon}</span><b>${p.d}</b><small>${p.dowZh}</small></span>
    <span class="evcard__t"><span>${t.en} · ${t.zh}</span><b>${e.title || '未命名节目'}</b><i>${e.en}</i><p>${fmt.time(e.startsAt)} – ${fmt.time(e.endsAt)} · ${e.venue}</p></span>
    ${meter(e.taken || 0, e.capacity || 0, e.waitlist || 0)}
    <span style="justify-self:end">${st}</span>
  </${raw(act ? 'button' : 'div')}>`;
}
function viewProgramme(list) {
  const f = S.ui.evFilter;
  const rows = list.filter(e => f === 'all' || (f === 'past' ? e.past && e.status === 'published' : f === 'published' ? e.status === 'published' && !e.past : e.status === f))
    .sort((a, b) => a.past - b.past || (a.past ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
  return html`<div class="toolbar">
      <span class="chips">${[['all', '全部'], ['published', '上映中'], ['draft', '草稿'], ['past', '已结束'], ['cancelled', '已取消']].map(([v, l]) => html`<button class="chip" aria-pressed="${String(f === v)}" data-act="ev-filter" data-v="${v}">${l}</button>`)}</span>
      <span class="toolbar__sp"></span>
      <button class="btn btn--rasp" data-act="event-new">${icon('plus')}New <span>新建节目</span></button>
    </div>
    <div class="evlist">${rows.length ? rows.map(e => evcard(e)) : html`<p class="empty">这里还没有节目</p>`}</div>`;
}

function drawerEvent({ id, attendees }) {
  const list = S.data.programme || [];
  const e = id ? list.find(x => x.id === id) : null;
  const v = e ? {
    ...e, date: hzDate(e.startsAt), from: fmt.time(e.startsAt), to: fmt.time(e.endsAt), speakers: (e.speakers || []).join('、'),
  } : { title: '', en: '', type: 'closed-door', date: '2026-12-26', from: '19:30', to: '21:30', venue: '3F Library · 杭州', capacity: 24, color: 'pink', host: S.staff.name, speakers: '', description: '', membersOnly: true, status: 'draft' };
  return {
    label: e ? `编辑 ${e.title}` : '新建节目',
    head: html`<p class="k">${e ? 'Edit · 编辑节目' : 'New · 新建节目'}</p><h2>${e ? e.title : '一场新的节目'}</h2><p>保存并发布后，会员端「节目」立刻上映。</p>`,
    body: html`<form data-form="event" id="evform">
        <input type="hidden" name="id" value="${e ? e.id : ''}">
        <div class="f"><label>标题 <i>中文</i></label><input class="inp" name="title" maxlength="40" value="${v.title}" required></div>
        <div class="f"><label>English title <i>英文副标题</i></label><input class="inp" name="en" maxlength="60" value="${v.en}"></div>
        <div class="f-row">
          <div class="f"><label>类型</label><select class="sel" name="type">${Object.entries(EVENT_TYPES).map(([k, t]) => html`<option value="${k}" ${raw(v.type === k ? 'selected' : '')}>${t.zh} · ${t.en}</option>`)}</select></div>
          <div class="f"><label>名额</label><input class="inp" name="capacity" type="number" min="1" max="500" value="${v.capacity}"></div>
        </div>
        <div class="f-row f-row--3">
          <div class="f"><label>日期</label><input class="inp" type="date" name="date" value="${v.date}"></div>
          <div class="f"><label>开始</label><input class="inp" type="time" name="from" value="${v.from}"></div>
          <div class="f"><label>结束</label><input class="inp" type="time" name="to" value="${v.to}"></div>
        </div>
        <div class="f-row">
          <div class="f"><label>地点</label><input class="inp" name="venue" maxlength="40" value="${v.venue}"></div>
          <div class="f"><label>主持</label><input class="inp" name="host" maxlength="20" value="${v.host}"></div>
        </div>
        <div class="f"><label>嘉宾 <i>用顿号分隔</i></label><input class="inp" name="speakers" value="${v.speakers}"></div>
        <div class="f"><label>介绍</label><textarea class="ta" name="description" maxlength="400">${v.description}</textarea></div>
        <div class="f-row">
          <div class="f"><span>海报颜色</span><input type="hidden" name="color" value="${v.color}"><div class="swatches">${COLORS.map(c => html`<button type="button" class="swatch c-${c}" style="background:var(--t)" aria-pressed="${String(v.color === c)}" aria-label="${c}" data-act="swatch" data-v="${c}"></button>`)}</div></div>
          <div class="f"><span>状态</span><input type="hidden" name="status" value="${v.status}"><span class="seg">${[['draft', '草稿'], ['published', '发布'], ['cancelled', '取消']].map(([k, l]) => html`<button type="button" aria-pressed="${String(v.status === k)}" data-act="ev-status" data-v="${k}">${l}</button>`)}</span></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:14px;font-size:13px"><input type="checkbox" name="membersOnly" ${raw(v.membersOnly ? 'checked' : '')}> 仅限会员（不勾选＝对公众开放，会员保留席位）</label>
        <p class="err" data-err></p>
        <div class="preview"><p class="preview__k">Preview · 在节目单里的样子</p><div id="evpreview">${evcard({ ...v, startsAt: e ? e.startsAt : new Date(`${v.date}T${v.from}:00+08:00`).toISOString(), endsAt: e ? e.endsAt : new Date(`${v.date}T${v.to}:00+08:00`).toISOString(), taken: e ? e.taken : 0, waitlist: e ? e.waitlist : 0 }, false)}</div></div>
      </form>
      ${e ? html`<div class="dsec" style="margin-top:22px"><div class="dsec__h"><b>报名名单</b><span>Guest list · ${e.taken}/${e.capacity}${e.waitlist ? ` · 候补 ${e.waitlist}` : ''}</span></div>
        ${attendees ? (attendees.length ? html`<div class="minilist">${attendees.map(a => html`<div><span><b>${a.member ? a.member.name : '—'}</b> <span class="muted mono">No.${a.member ? a.member.no : ''}</span></span>${stamp(a.status, a.status, ({ going: '已报名', waitlist: '候补', attended: '已到场' })[a.status] || a.status)}</div>`)}</div>` : html`<p class="muted">还没有人报名</p>`) : html`<p class="muted">加载中…</p>`}</div>` : ''}`,
    foot: [html`<button class="btn btn--rasp" data-act="event-save">保存 <span>Save</span></button>`, e && e.status === 'draft' ? html`<button class="btn btn--ghost" data-act="event-delete" data-id="${e.id}">删除草稿</button>` : ''],
  };
}
function updatePreview() {
  const form = $('#evform');
  const box = $('#evpreview');
  if (!form || !box) return;
  const v = Object.fromEntries(new FormData(form));
  const startsAt = Date.parse(`${v.date}T${v.from || '00:00'}:00+08:00`);
  const endsAt = Date.parse(`${v.date}T${v.to || '00:00'}:00+08:00`);
  if (!startsAt) return;
  const old = (S.data.programme || []).find(x => x.id === v.id);
  box.innerHTML = evcard({ ...v, capacity: +v.capacity || 0, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt || startsAt).toISOString(), taken: old ? old.taken : 0, waitlist: old ? old.waitlist : 0 }, false).s;
}

/* ---------- reservations ---------- */
function viewReservations(d) {
  S.resDate = d.date;
  const statusZh = { confirmed: '待到店', seated: '已入座', 'no-show': '未到', cancelled: '已取消' };
  return html`<div class="days" role="listbox" aria-label="日期">${d.days.map(x => html`<button class="day" aria-pressed="${String(x.date === d.date)}" data-act="res-date" data-date="${x.date}">
      ${x.date === '2026-12-15' ? html`<span class="day__tag">开业</span>` : ''}<span>${fmt.dowEnOf(x.date)}</span><b>${fmt.dayOf(x.date)}</b><small>${x.count} 单</small></button>`)}</div>
    <div class="loads">${d.loads.map(s => card(s.session === 'day' ? '白天 · 会员时段' : '夜晚 · 对外开放', SESSIONS[s.session].hours, html`${s.zones.map(z => html`<div class="load"><span>${z.zh}</span>${raw(`<div class="meter__t"><span class="meter__f" style="width:${Math.min(100, Math.round((z.booked / z.capacity) * 100))}%"></span></div>`)}<span class="num">${z.booked}/${z.capacity} ${z.unit === 'room' ? '间' : '席'}</span></div>`)}`))}</div>
    <section class="card"><div class="card__h"><div class="card__t"><b>${fmt.mdOf(d.date)} ${fmt.dowOf(d.date)} 的预订</b><span>${d.list.length} reservations</span></div></div>
      <div class="card__b">${d.list.length ? html`<div class="tablewrap"><table class="table"><thead><tr><th>编号</th><th>会员</th><th>时段</th><th>区域</th><th class="num">人数</th><th>备注</th><th>状态</th><th></th></tr></thead>
        <tbody>${d.list.map(r => html`<tr><td class="mono">${r.code}</td><td><b>${r.member ? r.member.name : '—'}</b> <span class="muted mono">No.${r.member ? r.member.no : ''}</span></td>
          <td>${r.session === 'day' ? '白天' : '夜晚'}</td><td>${r.zone.zh}</td><td class="num">${r.party}</td><td class="muted">${r.note || '—'}</td>
          <td>${stamp(r.status, r.status, statusZh[r.status])}</td>
          <td class="r"><span class="acts">${r.status === 'confirmed' ? html`<button class="btn btn--sm" data-act="res-mark" data-id="${r.id}" data-v="seated">入座</button><button class="btn btn--ghost btn--sm" data-act="res-mark" data-id="${r.id}" data-v="no-show">未到</button><button class="btn btn--ghost btn--sm" data-act="res-mark" data-id="${r.id}" data-v="cancelled">取消</button>` : html`<button class="btn btn--ghost btn--sm" data-act="res-mark" data-id="${r.id}" data-v="confirmed">撤销</button>`}</span></td></tr>`)}</tbody></table></div>`
        : html`<p class="empty"><b>Quiet day.</b>这一天还没有预订。</p>`}</div></section>`;
}

/* ---------- stacks ---------- */
function viewStacks(books) {
  const f = S.ui.bookFilter;
  const rows = books.filter(b => f === 'all' || b.status === f);
  const swatch = { rasp: '#9B2D4A', mustard: '#DDA640', powder: '#8FB3C9', ink: '#3A2A26', mint: '#8CC1A6', pink: '#E7A9A6', lav: '#B59FCC', cream: '#EADBC2' };
  return html`<div class="toolbar"><span class="chips">${[['all', '全部'], ['shelf', '在架'], ['held', '已预留'], ['loan', '借出']].map(([v, l]) => html`<button class="chip" aria-pressed="${String(f === v)}" data-act="book-filter" data-v="${v}">${l} ${v === 'all' ? books.length : books.filter(b => b.status === v).length}</button>`)}</span></div>
    <section class="card"><div class="tablewrap"><table class="table"><thead><tr><th>书架</th><th>书名</th><th>作者</th><th>状态</th><th>会员</th><th>到期</th><th></th></tr></thead>
    <tbody>${rows.map(b => html`<tr><td class="mono">${b.shelf}</td><td><span style="display:inline-block;width:8px;height:22px;margin-right:10px;vertical-align:middle;border-radius:1px;background:${swatch[b.color] || '#ccc'}"></span><b>${b.title}</b></td><td class="muted">${b.author}</td>
      <td>${b.status === 'shelf' ? stamp('shelf', 'On shelf', '在架') : b.status === 'held' ? stamp('held', 'Held', '已预留') : stamp('loan', 'On loan', '借出')}</td>
      <td>${b.holder ? html`${b.holder.name} <span class="muted mono">No.${b.holder.no}</span>` : html`<span class="muted">—</span>`}</td>
      <td class="mono">${b.dueAt ? fmt.date(b.dueAt) : ''}</td>
      <td class="r"><span class="acts">${b.status === 'held' ? html`<button class="btn btn--sm" data-act="book-mark" data-id="${b.id}" data-v="lend">借出</button><button class="btn btn--ghost btn--sm" data-act="book-mark" data-id="${b.id}" data-v="release">释放</button>` : b.status === 'loan' ? html`<button class="btn btn--sm" data-act="book-mark" data-id="${b.id}" data-v="return">归还</button>` : ''}</span></td></tr>`)}</tbody></table></div></section>`;
}

/* ---------- concierge ---------- */
function viewConcierge(list) {
  const f = S.ui.reqFilter;
  const rows = list.filter(r => f === 'all' || r.status === f).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return html`<div class="toolbar"><span class="chips">${[['open', '待处理'], ['replied', '已回复'], ['closed', '已完成'], ['all', '全部']].map(([v, l]) => html`<button class="chip" aria-pressed="${String(f === v)}" data-act="req-filter" data-v="${v}">${l} ${v === 'all' ? list.length : list.filter(r => r.status === v).length}</button>`)}</span></div>
    <div class="inbox">${rows.length ? rows.map(r => {
      const t = REQUEST_TYPES[r.type] || REQUEST_TYPES.other;
      return html`<article class="req ${r.status === 'open' ? 'is-open' : ''}"><span class="cameo">${initialOf(r.member ? r.member.name : '?')}</span><div>
        <div class="req__h"><b>${r.member ? r.member.name : '—'}<i>No.${r.member ? r.member.no : ''} · ${t.zh}</i></b><span class="muted mono" style="font-size:11.5px">${fmt.rel(r.createdAt)}</span></div>
        <p class="req__text">${r.text}</p>
        ${r.reply ? html`<div class="req__reply"><small>${r.by ? r.by.name : '礼宾台'} · ${fmt.rel(r.repliedAt)}</small>${r.reply}</div>` : ''}
        ${r.status === 'open' ? html`<form data-form="reply" data-id="${r.id}"><input class="inp" name="text" placeholder="回复 ${r.member ? r.member.name : ''}，会推送到 TA 的会员端" maxlength="300"><button class="btn btn--rasp btn--sm">回复</button><button type="button" class="btn btn--ghost btn--sm" data-act="req-close" data-id="${r.id}">完成</button></form>`
          : r.status === 'replied' ? html`<div style="margin-top:10px"><button class="btn btn--ghost btn--sm" data-act="req-close" data-id="${r.id}">标记完成</button></div>` : ''}
      </div></article>`;
    }) : html`<p class="empty"><b>All quiet.</b>没有待处理的请求。</p>`}</div>`;
}

/* ---------- bulletins ---------- */
function letter(b, by) {
  return html`<div class="letter"><svg><use href="#i-sealbig"/></svg><p class="letter__k">${b.at ? fmt.rel(b.at) : 'Preview'} · Bulletin</p><p class="letter__t">${b.title || '标题'}</p><p class="letter__b">${b.body || '正文会以一封来信的样子，出现在每位会员的大堂。'}</p><p class="letter__f">— ${by || 'The Front Desk'} · 礼宾台</p></div>`;
}
function viewBulletins(list) {
  return html`<div class="grid g-12">
    ${card('写一封来信', 'Compose', html`<form data-form="bulletin">
        <div class="f"><label>标题</label><input class="inp" name="title" maxlength="40" data-bind="bTitle" data-preview="1" value="${S.ui.bTitle}" required></div>
        <div class="f"><label>正文</label><textarea class="ta" name="body" maxlength="500" rows="6" data-bind="bBody" data-preview="1" required>${S.ui.bBody}</textarea></div>
        <p class="err" data-err></p>
        <button class="btn btn--rasp">${icon('seal')}Send <span>发给全部会员</span></button>
        <div class="preview"><p class="preview__k">Preview · 会员大堂里的样子</p><div id="bpreview">${letter({ title: S.ui.bTitle, body: S.ui.bBody }, S.staff.name)}</div></div>
      </form>`)}
    <div class="grid">${list.map(b => letter(b, b.by ? b.by.name : ''))}</div>
  </div>`;
}

/* ---------- drawer ---------- */
const DRAWERS = { app: drawerApp, member: drawerMember, event: drawerEvent };
function openDrawer(type, props = {}) {
  hideTip();
  S.drawer = { type, ...props };
  renderDrawer();
  requestAnimationFrame(() => requestAnimationFrame(() => drawerEl.classList.add('is-open')));
}
function renderDrawer() {
  if (!S.drawer) return;
  const prev = $('.drawer__b', drawerEl);
  const keep = prev ? prev.scrollTop : 0;
  const v = DRAWERS[S.drawer.type](S.drawer);
  drawerEl.innerHTML = html`<div class="scrim" data-act="drawer-close"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="${v.label}">
      <header class="drawer__h"><div>${v.head}</div><button class="icon-btn" data-act="drawer-close" aria-label="关闭">${icon('close')}</button></header>
      <div class="drawer__b">${v.body}</div>
      ${v.foot && [].concat(v.foot).filter(Boolean).length ? html`<footer class="drawer__f">${v.foot}</footer>` : ''}
    </aside>`.s;
  const b = $('.drawer__b', drawerEl);
  if (b) b.scrollTop = keep;
}
function closeDrawer() {
  drawerEl.classList.remove('is-open');
  S.drawer = null;
  setTimeout(() => { if (!S.drawer) drawerEl.innerHTML = ''; }, 420);
}
async function refreshDrawer() {
  const d = S.drawer;
  if (!d) return;
  try {
    if (d.type === 'member') d.data = await call('admin.member', { id: d.id });
    if (d.type === 'app' && S.page !== 'applications') S.data.applications = await call('admin.applications');
    if (d.type === 'event' && d.id) d.attendees = await call('admin.event.attendees', { id: d.id });
    renderDrawer();
  } catch (e) { handleError(e); }
}

/* ---------- actions ---------- */
async function busy(el, fn) {
  el?.classList.add('is-busy');
  try { return await fn(); } finally { el?.classList.remove('is-busy'); }
}
function handleError(e, errEl) {
  if (e && (e.code === 'auth' || e.code === 'forbidden')) {
    auth.clear();
    S.staff = null;
    toast('请重新登录', 'error');
    entrance();
    return;
  }
  if (errEl) errEl.textContent = e.message;
  else toast((e && e.message) || '出了点问题', 'error');
}
async function act(method, args, okMsg) {
  try {
    const r = await call(method, args);
    if (okMsg) toast(okMsg);
    await load(false);
    loadBadges();
    return r;
  } catch (e) { handleError(e); return null; }
}

const ACTIONS = {
  'pick-staff': d => { S.ui.loginStaff = d.id; $$('.staffpick button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === d.id))); $('.pin input')?.focus(); },
  menu: () => shellEl.classList.toggle('is-menu'),
  logout: () => { if (!confirm('退出后台？')) return; call('auth.logout').catch(() => {}); auth.clear(); S.staff = null; S.page = null; entrance(); },
  reset: async () => {
    if (!confirm('把所有演示数据恢复到初始状态？会员端也会一起重置。')) return;
    await act('admin.reset', {}, '演示数据已重置');
  },
  view: d => { S.ui.tables[d.id] = d.v === 'table'; renderPage(); },
  floor: (d, el) => busy(el, () => act('admin.floor.update', { id: d.id, ...(d.status ? { status: d.status } : {}), ...(d.mode ? { mode: d.mode } : {}) }, '楼层状态已更新，会员端同步')),
  'fill-demo': () => fillDigits($('#democode')?.textContent || ''),
  'all-welcomed': () => { S.ui.allWelcomed = !S.ui.allWelcomed; renderPage(); },
  app: d => openDrawer('app', { id: d.id }),
  move: (d, el) => busy(el, async () => {
    const a = (S.data.applications || []).find(x => x.id === S.drawer.id);
    const labels = { diligence: '开始尽调', initiation: '安排入会仪式', welcomed: '欢迎入会', declined: '婉拒这份申请', received: '重新打开' };
    if (d.stage === 'declined' && !confirm(`确定${labels.declined}？申请人会收到一封感谢信。`)) return;
    const args = { id: S.drawer.id, stage: d.stage };
    if (d.stage === 'initiation') {
      const v = $('#initAt')?.value;
      if (!v) { toast('请先选择仪式时间', 'error'); return; }
      args.initiationAt = new Date(`${v}:00+08:00`).toISOString();
    }
    const r = await act('admin.application.move', args, d.stage === 'welcomed' ? `${a ? a.name : ''} 正式入会，会员端已发出钥匙` : `已${labels[d.stage]}，申请人会收到通知`);
    if (r) { S.data.applications = await call('admin.applications'); renderDrawer(); }
  }),
  member: async d => {
    if (!S.staffList) S.staffList = await call('staff.list').catch(() => []);
    openDrawer('member', { id: d.id, data: null });
    try { S.drawer.data = await call('admin.member', { id: d.id }); renderDrawer(); } catch (e) { handleError(e); }
  },
  'mem-sector': d => { S.ui.memSector = d.v; renderPage(); },
  'mem-status': async d => { await act('admin.member.update', { id: d.id, status: d.v }, d.v === 'paused' ? '会员身份已暂停' : '会员身份已恢复'); refreshDrawer(); },
  'ev-filter': d => { S.ui.evFilter = d.v; renderPage(); },
  'event-new': () => openDrawer('event', { id: null }),
  event: async d => {
    openDrawer('event', { id: d.id, attendees: null });
    try { S.drawer.attendees = await call('admin.event.attendees', { id: d.id }); renderDrawer(); } catch (e) { handleError(e); }
  },
  swatch: (d, el) => { const f = $('#evform'); f.color.value = d.v; $$('.swatch', f).forEach(s => s.setAttribute('aria-pressed', String(s === el))); updatePreview(); },
  'ev-status': (d, el) => { const f = $('#evform'); f.status.value = d.v; el.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === el))); },
  'event-save': (d, el) => busy(el, async () => {
    const form = $('#evform');
    const v = Object.fromEntries(new FormData(form));
    v.membersOnly = form.membersOnly.checked;
    try {
      const e = await call('admin.event.save', v);
      toast(v.status === 'published' ? `「${e.title}」已上映，会员端同步` : '已保存');
      await load(false);
      S.drawer = { type: 'event', id: e.id, attendees: await call('admin.event.attendees', { id: e.id }) };
      renderDrawer();
    } catch (e) { handleError(e, $('[data-err]', form)); }
  }),
  'event-delete': async d => { if (!confirm('删除这份草稿？')) return; const r = await act('admin.event.delete', { id: d.id }, '草稿已删除'); if (r) closeDrawer(); },
  'res-date': d => { S.resDate = d.date; load(false); },
  'res-mark': (d, el) => busy(el, () => act('admin.reservation.mark', { id: d.id, status: d.v }, ({ seated: '已入座', 'no-show': '已标记未到', cancelled: '预订已取消，会员会收到通知', confirmed: '已撤销' })[d.v])),
  'book-filter': d => { S.ui.bookFilter = d.v; renderPage(); },
  'book-mark': (d, el) => busy(el, () => act('admin.book.mark', { id: d.id, action: d.v }, ({ lend: '已借出，21 天后到期', return: '已归还', release: '预留已释放' })[d.v])),
  'req-filter': d => { S.ui.reqFilter = d.v; renderPage(); },
  'req-close': (d, el) => busy(el, () => act('admin.request.reply', { id: d.id, close: true }, '已标记完成')),
  'drawer-close': () => closeDrawer(),
};

const FORMS = {
  login: async (form, fd) => {
    const err = $('[data-err]', form);
    err.textContent = '';
    await busy(form.querySelector('button:not([type])'), async () => {
      try {
        const r = await call('admin.login', { staffId: S.ui.loginStaff, pin: fd.get('pin') });
        auth.set(r.token);
        S.staff = r.staff;
        renderShell();
        S.page = null;
        route();
      } catch (e) { err.textContent = e.message; }
    });
  },
  checkin: async form => {
    const err = $('[data-err]', form);
    err.textContent = '';
    const code = digitsValue();
    if (code.length !== 6) { err.textContent = '入场码是 6 位数字'; $('#digits').classList.add('is-bad'); setTimeout(() => $('#digits')?.classList.remove('is-bad'), 450); return; }
    await busy(form.querySelector('button:not([type])'), async () => {
      try {
        S.ui.lastCheckin = await call('admin.checkin', { code });
        S.data.desk = await loadDesk();
        renderPage();
        toast(S.ui.lastCheckin.repeat ? `${S.ui.lastCheckin.member.name} 已经在里面了` : `欢迎，${S.ui.lastCheckin.member.name}`);
      } catch (e) {
        err.textContent = e.message;
        $('#digits').classList.add('is-bad');
        setTimeout(() => $('#digits')?.classList.remove('is-bad'), 450);
      }
    });
  },
  note: async (form, fd) => {
    const r = await act('admin.application.note', { id: S.drawer.id, text: fd.get('text') }, '备注已保存');
    if (r) { S.data.applications = await call('admin.applications'); renderDrawer(); }
  },
  reply: async (form, fd) => busy(form.querySelector('button:not([type])'), () => act('admin.request.reply', { id: form.dataset.id, text: fd.get('text') }, '已回复，会员端会收到通知')),
  bulletin: async (form, fd) => {
    const err = $('[data-err]', form);
    await busy(form.querySelector('button:not([type])'), async () => {
      try {
        await call('admin.bulletin.send', { title: fd.get('title'), body: fd.get('body') });
        S.ui.bTitle = '';
        S.ui.bBody = '';
        toast('来信已寄出，每位会员的大堂都会出现');
        await load(false);
      } catch (e) { err.textContent = e.message; }
    });
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('[disabled]')) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A' && !el.getAttribute('href')?.startsWith('#')) return;
  e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.drawer) closeDrawer();
  if (e.key === 'Enter' && e.target.matches('tr[data-act]')) e.target.click();
  const dig = e.target.closest('#digits input');
  if (dig && e.key === 'Backspace' && !dig.value) { const prev = dig.previousElementSibling; if (prev) { prev.value = ''; prev.focus(); e.preventDefault(); } }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  FORMS[form.dataset.form]?.(form, new FormData(form));
});
const liveSearch = debounce(() => {
  const a = document.activeElement;
  const key = a && a.dataset.bind;
  const pos = a ? a.selectionStart : null;
  renderPage();
  if (key) { const again = $(`[data-bind="${key}"]`); if (again) { again.focus(); if (pos != null) again.setSelectionRange(pos, pos); } }
}, 160);
document.addEventListener('input', e => {
  const el = e.target;
  const dig = el.closest('#digits input');
  if (dig) {
    const v = dig.value.replace(/\D/g, '');
    if (v.length > 1) { fillDigits(v); } else { dig.value = v; if (v && dig.nextElementSibling) dig.nextElementSibling.focus(); }
    if (digitsValue().length === 6) $('form[data-form="checkin"]').requestSubmit();
    return;
  }
  if (el.dataset.bind) {
    S.ui[el.dataset.bind] = el.value;
    if (el.dataset.live) liveSearch();
    if (el.dataset.preview) { const box = $('#bpreview'); if (box) box.innerHTML = letter({ title: S.ui.bTitle, body: S.ui.bBody }, S.staff.name).s; }
  }
  if (el.closest('#evform')) updatePreview();
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.change === 'host') { await act('admin.member.update', { id: el.dataset.id, hostId: el.value }, '专属服务人员已更换，会员会收到通知'); refreshDrawer(); }
  if (el.closest('#evform')) updatePreview();
});
document.addEventListener('paste', e => {
  const dig = e.target.closest('#digits input');
  if (!dig) return;
  e.preventDefault();
  fillDigits((e.clipboardData || window.clipboardData).getData('text'));
  if (digitsValue().length === 6) $('form[data-form="checkin"]').requestSubmit();
});

/* tooltips: values lead, labels follow; same on hover and keyboard focus */
function showTip(t, x, y) {
  tipEl.textContent = '';
  const b = document.createElement('b');
  b.textContent = t.dataset.tip;
  const s = document.createElement('span');
  s.textContent = t.dataset.tipL || '';
  tipEl.append(b, s);
  tipEl.hidden = false;
  placeTip(x, y);
  if (t.dataset.for != null) t.closest('svg')?.querySelector(`[data-bar="${t.dataset.for}"]`)?.classList.add('is-hot');
  if (t.classList.contains('cell')) t.classList.add('is-hot');
}
function placeTip(x, y) {
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = `${Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2))}px`;
  tipEl.style.top = `${Math.max(8, y - r.height - 14)}px`;
}
function hideTip() {
  tipEl.hidden = true;
  $$('.is-hot').forEach(n => n.classList.remove('is-hot'));
}
document.addEventListener('pointerover', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(t, e.clientX, e.clientY); });
document.addEventListener('pointermove', e => { if (!tipEl.hidden && e.target.closest('[data-tip]')) placeTip(e.clientX, e.clientY); });
document.addEventListener('pointerout', e => { const t = e.target.closest('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); });
document.addEventListener('focusin', e => { const t = e.target.closest('[data-tip]'); if (t) { const r = t.getBoundingClientRect(); showTip(t, r.left + r.width / 2, r.top); } });
document.addEventListener('focusout', e => { if (e.target.closest('[data-tip]')) hideTip(); });
addEventListener('scroll', () => { if (!tipEl.hidden) hideTip(); }, { passive: true });
addEventListener('pointerdown', () => { if (!tipEl.hidden) hideTip(); });
addEventListener('hashchange', hideTip);

boot();
