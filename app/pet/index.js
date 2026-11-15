/* =========================================================
   书虫 · the pet page
   A little handheld toy inside the app: a dot-matrix screen, six
   keys under it, one line of plain words saying what it needs.
   The rules live in shared/pet.js, the pictures in lcd.js and
   scene.js. This file is the glue: keys → rules → a small show on
   the glass → save.
   ========================================================= */
import { html, raw } from '../../shared/ui.js';
import { call } from '../../shared/api.js';
import { hz } from '../../shared/core.js';
import { newPet, advance, act, statusOf, titleOf, daysOf, leanOf, seenForms, normalize, FORMS, STAGE_ZH, TUNING, WHY } from '../../shared/pet.js';
import { Scene } from './scene.js';
import { SPR, drawPet, paintTile } from './lcd.js';
import { sfx, unlock, isMuted, setMuted } from './sound.js';

const pad = n => String(n).padStart(2, '0');
const LIVE = ['baby', 'teen', 'adult'];
const NEED_KEY = { hungry: 'feed', dirty: 'clean', sleepy: 'lamp', lamp: 'lamp', bored: 'play', sick: 'tea' };
const span = m => (m >= 1440 ? `${Math.floor(m / 1440)} 天` : m >= 60 ? `${Math.floor(m / 60)} 小时` : `${m} 分钟`);
const key = (act_, icon, label, cls = '') => html`<button class="pkey ${cls}" data-pet="${act_}"><canvas data-ico="${icon}"></canvas><span>${label}</span></button>`;

let current = null;
export function mount(host, opts) { unmount(); current = new PetScreen(host, opts); return current; }
export function unmount() { if (current) { current.destroy(); current = null; } }
export const peek = () => current;            // for tests

/* a pet as a small picture on glass: the entry card, the album */
export function paintPet(canvas, spec, { pitch = 3, w = 29, h = 20, faint = false } = {}) {
  paintTile(canvas, w, h, m => {
    const size = spec.stage === 'adult' ? 27 : spec.stage === 'teen' ? 20 : spec.stage === 'baby' ? 12 : spec.stage === 'cocoon' ? 9 : 16;
    drawPet(m, spec, { x: Math.floor((w - size) / 2), y: h - 2, frame: faint ? 1 : 0, eyes: faint ? 'closed' : 'open' });
  }, { pitch, ink: faint ? 'rgba(30,42,28,.28)' : '#1E2A1C' });
}
export const specOf = p => ({ stage: p.stage, form: p.form, lean: p.stage === 'teen' ? leanOf(p) : '', away: p.away, warm: p.warm / TUNING.hatchTaps });

class PetScreen {
  /* o: { saved, gifts, now(), uid, openSheet(title, body), closeSheet(), demo } */
  constructor(host, o) {
    this.host = host; this.o = o;
    this.cacheKey = `sv.pet.${o.uid}`;
    const now = o.now();
    let cached = null;
    try { cached = normalize(JSON.parse(localStorage.getItem(this.cacheKey) || 'null'), now); } catch { /* no cache */ }
    const saved = o.saved ? normalize(o.saved, now) : null;
    this.pet = saved && cached ? (cached.rev > saved.rev ? cached : saved) : saved || cached || newPet(now);
    const ahead = cached && (!saved || cached.rev > saved.rev);
    const passed = advance(this.pet, now);
    this.gifts = (o.gifts || []).filter(g => !this.pet.gifts.includes(g.id));
    this.mode = 'main'; this.need = ''; this.dead = false; this.saveT = 0; this.dirty = false; this.note = ''; this.noteT = 0; this.shown = {};

    host.innerHTML = html`<div class="pet">
      <div class="pet__dev">
        <div class="pet__head"><b data-p="name"></b><span data-p="sub"></span></div>
        <div class="pet__glass"><canvas class="pet__lcd" role="img" aria-label="书虫的点阵屏"></canvas></div>
        <p class="pet__say" data-p="say" aria-live="polite"></p>
        <div class="pet__keys" data-p="keys"></div>
      </div>
      <div class="pet__under" data-p="under"></div>
    </div>`.s;
    this.el = n => host.querySelector(`[data-p="${n}"]`);
    this.scene = new Scene(host.querySelector('.pet__lcd'), { onTap: what => this.tapGlass(what) });
    this.sync();

    this.click = e => {
      const el = e.target.closest('[data-pet]');
      if (!el || el.disabled) return;
      e.preventDefault();
      unlock();
      try { navigator.vibrate && navigator.vibrate(8); } catch { /* no buzzer on this phone */ }
      this.press(el.dataset.pet, el.dataset);
    };
    this.submit = e => {
      const form = e.target.closest('form[data-pet-form]');
      if (!form) return;
      e.preventDefault();
      this.rename(new FormData(form).get('name'));
    };
    this.keydown = e => { if (this.mode === 'game' && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); this.scene.tap(); } };
    this.visible = () => { if (document.visibilityState === 'visible') this.tick(); else this.flush(); };
    document.addEventListener('click', this.click);
    document.addEventListener('pointerup', unlock);       // phones only let sound start from a finished tap
    document.addEventListener('submit', this.submit);
    document.addEventListener('keydown', this.keydown);
    document.addEventListener('visibilitychange', this.visible);
    this.timer = setInterval(() => this.tick(), 5000);

    const note = this.awayNote(passed);
    if (note) this.tell(note, 6000);
    if (ahead || passed.minutes > 0) this.save();
  }
  destroy() {
    this.dead = true;
    clearInterval(this.timer);
    clearTimeout(this.noteT);
    document.removeEventListener('click', this.click);
    document.removeEventListener('pointerup', unlock);
    document.removeEventListener('submit', this.submit);
    document.removeEventListener('keydown', this.keydown);
    document.removeEventListener('visibilitychange', this.visible);
    this.scene.destroy();
    this.flush();
  }

  /* ---------- words ---------- */
  get name() { return this.pet.name || '小书虫'; }
  /* say something on the line under the glass for a moment; then it goes back to how the pet is doing */
  tell(msg, hold = 3200) {
    if (this.dead) return;
    this.note = msg;
    clearTimeout(this.noteT);
    this.noteT = setTimeout(() => { this.note = ''; this.say(); }, hold);
    this.say();
  }
  say() {
    if (this.dead) return;
    const st = statusOf(this.pet);
    this.el('say').textContent = this.mode === 'game' ? '音符走进左边的方框时，点一下屏幕。' : this.note || (this.pet.name ? st.text.replace('它', this.pet.name) : st.text);
  }
  awayNote(passed) {
    if (passed.minutes < 30) return '';
    const bits = [];
    const grew = passed.stages[passed.stages.length - 1];
    if (grew === 'adult') bits.push(`长成了${FORMS[this.pet.form].zh}`);
    else if (grew === 'cocoon') bits.push('结了纸茧');
    else if (grew === 'teen') bits.push(`长成了${STAGE_ZH.teen}`);
    if (passed.away) bits.push('躲进了书里');
    else {
      if (passed.sick && this.pet.sick) bits.push('有点不舒服');
      if (passed.woke) bits.push('睡了一觉'); else if (passed.slept) bits.push('睡着了');
      if (passed.crumbs) bits.push(`掉了 ${passed.crumbs} 处书渣`);
    }
    return bits.length ? `你离开了 ${span(passed.minutes)}，${this.name}${bits.join('，')}` : '';
  }

  /* only touch the page when something changed: a re-render under a finger would swallow the press */
  put(name, markup) {
    if (this.shown[name] === markup) return false;
    this.shown[name] = markup;
    this.el(name).innerHTML = markup;
    return true;
  }

  /* ---------- what the screen should show ---------- */
  simOf() {
    const p = this.pet;
    const st = statusOf(p);
    const t = hz(this.o.now());
    const live = LIVE.includes(p.stage) && !p.away;
    const pip = v => Math.max(0, Math.min(4, Math.ceil(v / 25)));
    return {
      ...specOf(p), asleep: live && p.asleep, lamp: p.lamp, sick: live && p.sick, crumbs: live ? p.crumbs : 0,
      need: NEED_KEY[st.need] ? st.need : '', alert: st.alert,
      gauges: live ? [pip(p.full), pip(p.mood), pip(p.energy), TUNING.maxCrumbs - p.crumbs] : [0, 0, 0, 0],
      low: live ? [p.full < 25, p.mood < 30, p.energy < 25, p.crumbs >= 3] : [false, false, false, false],
      clock: `${pad(t.h)}:${pad(t.mi)}`, day: t.h >= 6 && t.h < 19,
      gift: live && !p.asleep && this.gifts.length > 0, mute: isMuted(),
    };
  }
  sync() {
    if (this.dead) return;
    const p = this.pet;
    const st = statusOf(p);
    const sim = this.simOf();
    this.scene.setSim(sim);
    const live = LIVE.includes(p.stage) && !p.away;
    this.el('name').textContent = p.stage === 'book' ? '一本合着的书' : this.name;
    this.el('sub').textContent = p.stage === 'book' ? '' : `${titleOf(p)} · 第 ${daysOf(p)} 天`;
    this.say();
    // the keys
    const want = NEED_KEY[st.need] || '';
    const k = (a, icon, label) => key(a, icon, label, want === a ? 'is-need' : '');
    let keys;
    if (this.mode === 'game') keys = html`${key('tap', 'iNote', '拍', 'pkey--wide')}${key('quit', 'iBang', '结束')}`;
    else if (!live && p.stage !== 'cocoon') keys = key('knock', 'iBook', p.away ? '敲敲书，叫它回来' : '敲一敲', 'pkey--wide is-need');
    else if (p.stage === 'cocoon') keys = html`<p class="pet__wait">纸茧要睡 ${span(Math.max(1, Math.ceil((TUNING.adultAt - p.age) / 60) * 60))}左右。到时候再来看它。</p>`;
    else if (this.mode === 'food') keys = html`${key('food', 'iPage', '书页 · 正餐')}${key('food-cookie', 'iHeart', '曲奇 · 零食')}${key('menu', 'iBang', '返回')}`;
    else keys = html`${k('feed', 'iPage', '喂食')}${k('read', 'iBook', '读书')}${k('play', 'iNote', '听歌')}${k('clean', 'iBroom', '打扫')}${k('lamp', 'iLamp', p.asleep && !p.lamp ? '开灯' : '关灯')}${k('tea', 'iCup', '热茶')}`;
    if (this.put('keys', keys.s)) this.el('keys').querySelectorAll('canvas[data-ico]').forEach(c => paintTile(c, 5, 5, m => m.blit(SPR[c.dataset.ico], 0, 0), { pitch: 4, glass: false }));
    // under the toy
    const g = sim.gift ? this.gifts[0] : null;
    this.put('under', html`
      ${g ? html`<button class="pet__gift" data-pet="gift"><b>有一份礼物</b><small>${g.label} · 点这里拆开</small></button>` : ''}
      ${p.stage === 'adult' && !p.away ? html`<button class="btn btn--secondary btn--block" data-pet="release-ask">放它飞向舞台</button><p class="pet__hint">它已经长大了。放飞以后，图鉴里会留下它的一页，你会收到一本新书。</p>` : ''}
      <button class="pet__more" data-pet="more">图鉴 · 玩法 · 设置</button>`.s);
    // call for attention once when a new need shows up
    if (st.alert && st.need !== this.need && live && this.need !== null && document.visibilityState === 'visible') sfx.alert();
    this.need = st.need;
  }

  /* ---------- rules ---------- */
  act(action, args) {
    const r = act(this.pet, action, args, this.o.now());
    if (r.ok) this.dirty = true;
    return r;
  }
  async refuse(reason) {
    this.tell(WHY[reason] || WHY.na);
    if (LIVE.includes(this.pet.stage) && !this.pet.away && !this.pet.asleep) await this.scene.refuse(); else sfx.no();
  }
  get idle() { return !this.dead && !this.scene.busy && !this.scene.game; }
  /* do a thing, play its little show, then bring the page up to date and save */
  async run(action, args, show) {
    if (!this.idle) return null;
    const before = specOf(this.pet);
    const r = this.act(action, args);
    if (!r.ok) { await this.refuse(r.reason); this.sync(); return null; }
    await show(r, before);
    if (this.dead) return r;
    this.sync();
    this.save();
    return r;
  }
  async press(what, d) {
    const s = this.scene;
    switch (what) {
      case 'feed': if (this.idle) { sfx.key(); this.mode = 'food'; this.sync(); } break;
      case 'menu': sfx.key(); this.mode = 'main'; this.sync(); break;
      case 'food': case 'food-cookie': {
        const food = what === 'food' ? 'page' : 'cookie';
        this.mode = 'main';
        this.sync();
        await this.run('feed', { food }, () => s.feed(food));
        break;
      }
      case 'read': await this.run('read', {}, () => s.read()); break;
      case 'clean': await this.run('clean', {}, r => s.sweep(r.swept)); break;
      case 'tea': await this.run('tea', {}, () => s.tea()); break;
      case 'lamp': await this.run('lamp', {}, r => (r.asleep ? s.lampOff() : s.lampOn(r.grumpy))); break;
      case 'play': await this.game(); break;
      case 'tap': s.tap(); break;
      case 'quit': if (s.game) s.game.finish(s.game.score); break;
      case 'knock': await this.tapGlass('pet'); break;
      case 'gift': await this.openGift(); break;
      case 'more': this.openMore(); break;
      case 'sound': setMuted(!isMuted()); unlock(); sfx.ok(); this.sync(); this.openMore(); break;
      case 'rename-ask': this.askName(false); break;
      case 'release-ask':
        this.o.openSheet('放它飞向舞台', html`<p>${this.name}已经长成了${titleOf(this.pet)}。放飞以后它不会再回来，图鉴里会留下它的一页，你会收到一本新的书。</p>
          <button class="btn btn--block" style="margin-top:16px" data-pet="release">放飞</button><button class="btn btn--plain btn--block" style="margin-top:8px" data-act="sheet-close">再陪它一会儿</button>`);
        break;
      case 'release': {
        this.o.closeSheet();
        const name = this.name;
        const r = await this.run('release', {}, (x, before) => { this.sync(); return s.release(before); });
        if (r) this.tell(`${name}飞向舞台的灯光了。图鉴里多了一页`);
        break;
      }
      case 'skip': this.o.closeSheet(); await this.skip(Number(d.min)); break;
      default:
    }
  }
  async tapGlass(what) {
    const p = this.pet;
    const s = this.scene;
    unlock();
    if (what === 'gift') { await this.openGift(); return; }
    if (p.stage === 'book' || p.away) {
      if (!this.idle) return;
      const before = specOf(p);
      const r = this.act(p.away ? 'call' : 'warm', {});
      if (!r.ok) return;
      this.sync();
      this.save();
      if (!r.hatched && !r.back) { s.knock(); return; }
      await s.hatch(r.hatched ? { ...before, warm: 1 } : before);
      if (this.dead) return;
      this.sync();
      if (r.hatched) this.askName(true); else this.tell(`${this.name}回来了。这次别让它饿着`);
    } else if (p.stage === 'cocoon') s.knock();
    else if (p.asleep) this.tell(WHY.asleep);
    else await this.run('stroke', {}, r => s.stroke(r.mood > 0));
  }
  async game() {
    if (!this.idle) return;
    const ok = this.act('playcheck', {});
    if (!ok.ok) { await this.refuse(ok.reason); this.sync(); return; }
    this.mode = 'game';
    this.sync();
    const score = await this.scene.play();
    this.mode = 'main';
    if (this.dead || score == null) return;
    const r = this.act('play', { score });
    this.sync();
    await this.scene.cheer(score);
    this.tell(`接住 ${score} 个音符，心情 +${r.mood}${r.record && score > 0 ? '，新纪录' : ''}`);
    this.sync();
    this.save();
  }
  async openGift() {
    const g = this.gifts[0];
    if (!g || !this.idle) return;
    const r = this.act('gift', { id: g.id, kind: g.kind });
    this.gifts.shift();
    if (!r.ok) { this.sync(); return; }
    this.gifts.unshift(g);                       // keep the box on the glass until it has been opened
    await this.scene.gift(g.kind);
    this.gifts.shift();
    if (this.dead) return;
    this.tell(g.kind === 'note' ? `${g.label}：带回一页笔记，学识 +5` : `${g.label}：带回一张票根，乐感 +5`);
    this.sync();
    this.save();
  }
  /* a need can appear, a night can pass, it can grow up: all while the page is open */
  async tick() {
    if (!this.idle) return;
    const before = specOf(this.pet);
    const passed = advance(this.pet, this.o.now());
    if (!passed.minutes) { this.sync(); return; }
    await this.settle(before, passed);
    if (passed.stages.length || passed.sick || passed.away || passed.slept || passed.woke || passed.crumbs) this.save();
  }
  async settle(before, passed) {
    this.sync();
    const grew = passed.stages[passed.stages.length - 1];
    if (!grew || this.pet.away) return;
    await this.scene.grow(before);
    if (this.dead) return;
    this.tell(grew === 'adult' ? `${this.name}破茧了：${FORMS[this.pet.form].zh}` : grew === 'cocoon' ? `${this.name}结了纸茧` : `${this.name}长大了：${STAGE_ZH.teen}`);
    this.sync();
  }
  async skip(minutes) {
    if (!this.idle || !(minutes > 0)) return;
    const before = specOf(this.pet);
    const r = this.act('skip', { minutes });
    const note = this.awayNote(r.passed);
    await this.settle(before, r.passed);
    this.tell(r.passed.stages.length ? this.el('say').textContent : note ? note.replace('你离开了', '过了') : `过了 ${span(minutes)}`, 4500);
    this.save();
  }

  /* ---------- sheets ---------- */
  askName(first) {
    this.o.openSheet(first ? '给它起个名字' : '改名', html`<form data-pet-form="name">
      <label class="field"><span class="field__l">名字<small>最多 8 个字</small></span><input class="input" name="name" maxlength="8" value="${this.pet.name}" placeholder="例如：墨墨" autocomplete="off" required></label>
      <button class="btn btn--block" style="margin-top:8px">${first ? '就叫这个' : '保存'}</button></form>`);
  }
  rename(name) {
    const r = this.act('name', { name });
    if (!r.ok) return;
    this.o.closeSheet();
    this.sync();
    this.save();
    this.tell(`它叫${this.pet.name}了`);
  }
  openMore() {
    const p = this.pet;
    const seen = seenForms(p);
    const live = p.stage !== 'book';
    this.o.openSheet('书虫', html`
      <h3 class="pet__h">图鉴 <small>${seen.length} / 4</small></h3>
      <div class="pet__album">${Object.entries(FORMS).map(([k, f]) => html`<div class="pet__tile"><canvas data-form="${k}" ${raw(seen.includes(k) ? '' : 'data-faint="1"')}></canvas><b>${seen.includes(k) ? f.zh : '还没见过'}</b><small>${f.how}</small></div>`)}</div>
      ${p.album.length ? html`<p class="small" style="margin-top:10px">放飞过：${p.album.slice(-6).reverse().map(a => `${a.name}（${FORMS[a.form].zh}，${a.days} 天）`).join('、')}</p>` : ''}
      <h3 class="pet__h">怎么玩</h3>
      <ul class="pet__rules">
        <li>屏幕上方四格：饱腹、心情、精力、干净。哪一格在闪，就是它缺什么。</li>
        <li>书页是正餐，曲奇是零食（会开心，但不能多吃）。</li>
        <li>读书长学识，听歌长乐感。它长成哪一种蛾，看你平时怎么带它。</li>
        <li>困了帮它关灯。它不在的时候时间照常走，记得回来看看。</li>
        <li>订了座、报名了座谈，它会收到一份礼物。</li>
      </ul>
      <h3 class="pet__h">设置</h3>
      <div class="chips"><button class="chip" data-pet="sound" aria-pressed="${!isMuted()}">声音：${isMuted() ? '关' : '开'}</button>${live ? html`<button class="chip" data-pet="rename-ask">改名</button>` : ''}</div>
      ${this.o.demo && live ? html`<h3 class="pet__h">演示：让时间快进 <small>正式版没有</small></h3>
      <div class="chips">${[[60, '1 小时'], [480, '8 小时'], [1440, '1 天'], [4320, '3 天']].map(([m, l]) => html`<button class="chip" data-pet="skip" data-min="${m}">${l}</button>`)}</div>` : ''}`);
    document.querySelectorAll('#sheet canvas[data-form]').forEach(c => paintPet(c, { stage: 'adult', form: c.dataset.form }, { faint: !!c.dataset.faint, pitch: 3, w: 29, h: 21 }));
  }

  /* ---------- keeping it ---------- */
  save() {
    if (this.dead) return;
    this.pet.rev += 1;
    this.dirty = true;
    try { localStorage.setItem(this.cacheKey, JSON.stringify(this.pet)); } catch { /* storage full or private mode */ }
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => this.push(), 600);
  }
  flush() { if (this.dirty) { clearTimeout(this.saveT); this.push(); } }
  async push() {
    this.dirty = false;
    try {
      const r = await call('pet.save', { pet: this.pet });
      if (r && r.ok === false && r.pet && !this.dead && this.idle) {      // another phone is ahead: follow it
        const p = normalize(r.pet, this.o.now());
        if (p) { this.pet = p; advance(p, this.o.now()); this.sync(); try { localStorage.setItem(this.cacheKey, JSON.stringify(p)); } catch { /* ignore */ } }
      }
    } catch { /* offline: the copy on this phone is kept and sent next time */ }
  }
}
