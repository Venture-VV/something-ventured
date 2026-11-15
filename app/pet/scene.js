/* =========================================================
   书虫 · what happens on the glass
   The scene "thinks" eight times a second, like the old toys did,
   and the glass repaints every frame so that dots can fade.
   It knows nothing about the rules: it is told what the pet is
   like (setSim) and asked to act things out (feed, read, sweep…).
   Each of those returns a promise that resolves when the little
   show is over.
   ========================================================= */
import { Lcd, SPR, MW, GROUND, drawPet, sizeOf } from './lcd.js';
import { sfx } from './sound.js';

const STEP = 0.125;
const FLOOR = GROUND + 1;
const CRUMB_X = [4, 13, 24, 33];
const GIFT_X = 40;
const NEED_ICON = { hungry: 'iPage', dirty: 'iBroom', sleepy: 'iMoon', lamp: 'iMoon', bored: 'iNote', sick: 'iCup' };
const rnd = n => Math.floor(Math.random() * n);
const DEAD = Symbol('scene closed');

export class Scene {
  constructor(canvas, { onTap } = {}) {
    this.canvas = canvas;
    this.lcd = new Lcd(canvas);
    this.onTap = onTap || (() => {});
    this.sim = { stage: 'book', gauges: [0, 0, 0, 0], low: [false, false, false, false], crumbs: 0 };
    this.x = 16; this.flip = false; this.frame = 0; this.n = 0;
    this.walk = 0; this.pause = 6; this.blink = 0;
    this.hop = 0; this.lift = 0; this.tilt = 0;
    this.face = null; this.as = null; this.hide = false; this.flash = false;
    this.items = []; this.parts = []; this.fx = {}; this.waits = [];
    this.busy = false; this.game = null; this.dead = false;
    this.acc = 0; this.last = 0;
    this.loop = this.loop.bind(this);
    this.down = this.down.bind(this);
    this.fit = () => this.lcd.resize();
    canvas.addEventListener('pointerdown', this.down);
    addEventListener('resize', this.fit);
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.down);
    removeEventListener('resize', this.fit);
    this.waits.splice(0).forEach(w => w.rej(DEAD));
    if (this.game) this.game.finish(null);
  }

  /* ---------- what the pet is like right now ---------- */
  setSim(sim) {
    const moved = sim.stage !== this.sim.stage || sim.form !== this.sim.form || !!sim.away !== !!this.sim.away;
    this.sim = sim;
    const l = this.lcd;
    l.gauges = sim.gauges; l.blink = sim.low; l.clock = sim.clock || '';
    l.sun = sim.day !== false;
    l.flags = { iBang: sim.alert ? 'blink' : false, iZz: !!sim.asleep, iPlus: sim.sick ? 'blink' : false, iGift: sim.gift ? 'blink' : false, iLamp: sim.lamp !== false, iMute: !!sim.mute };
    const [w] = sizeOf(this.specNow());
    if (moved || sim.asleep || sim.stage === 'book' || sim.stage === 'cocoon' || sim.away) this.x = Math.floor((MW - w) / 2) - (sim.gift ? 3 : 0);
    this.x = Math.max(1, Math.min(MW - w - 1, this.x));
  }
  specNow() { const s = this.sim; return this.as || { stage: s.stage, form: s.form, lean: s.lean, away: s.away, warm: s.warm }; }
  petY() {
    const s = this.specNow();
    let y = GROUND - this.hop - this.lift;
    if (s.stage === 'adult' && !s.away && !this.sim.asleep) y -= this.frame ? 1 : 2;       // a moth hovers, and bobs as it flaps
    return y;
  }
  head() {
    const s = this.specNow();
    const [w, h] = sizeOf(s);
    const top = this.petY() - h + 1;
    if (s.stage === 'baby') return [this.flip ? this.x + 3 : this.x + w - 4, top];
    if (s.stage === 'teen') return [this.flip ? this.x + 4 : this.x + w - 5, top];
    return [this.x + Math.floor(w / 2), top];
  }
  faceNow() {
    if (this.face) return this.face;
    const s = this.sim;
    if (s.asleep) return { eyes: 'closed', mouth: 'flat' };
    if (s.sick) return { eyes: 'dizzy', mouth: 'wavy' };
    if (s.need === 'sleepy') return { eyes: 'sleepy', mouth: 'flat' };
    if (s.need === 'hungry' || s.need === 'bored' || s.need === 'dirty') return { eyes: 'sad', mouth: 'sad' };
    if (this.blink > 0) return { eyes: 'closed', mouth: 'smile' };
    return { eyes: 'open', mouth: 'smile' };
  }

  /* ---------- time ---------- */
  loop(ts) {
    if (this.dead) return;
    const dt = Math.min(0.1, this.last ? (ts - this.last) / 1000 : 0.016);
    this.last = ts;
    this.acc += dt;
    while (this.acc >= STEP) { this.step(); this.acc -= STEP; }
    if (this.game) this.game.update(dt);
    this.draw();
    this.lcd.render(dt);
    this.raf = requestAnimationFrame(this.loop);
  }
  step() {
    this.n += 1;
    this.parts = this.parts.filter(p => { p.y += p.vy; p.x += p.vx || 0; p.life -= 1; return p.life > 0; });
    const due = [];
    this.waits = this.waits.filter(w => { w.n -= 1; if (w.n <= 0) due.push(w); return w.n > 0; });
    due.forEach(w => w.res());
    if (this.wobble && this.wobble.length && !this.busy) this.tilt = this.wobble.shift();
    if (this.game) return;
    const s = this.sim;
    const spec = this.specNow();
    if (spec.stage === 'book' || spec.away) { this.frame = 0; return; }
    if (spec.stage === 'cocoon') { this.frame = this.n % 44 < 3 ? 1 : 0; return; }
    if (this.n % (s.asleep ? 8 : 4) === 0 && !this.fx.still) this.frame ^= 1;
    if (this.busy) return;
    if (this.blink > 0) this.blink -= 1; else if (Math.random() < 0.025) this.blink = 2;
    if (s.asleep || s.sick) return;
    if (this.pause > 0) { this.pause -= 1; return; }
    if (this.walk <= 0) {
      if (Math.random() < (s.need ? 0.75 : 0.4)) { this.pause = 6 + rnd(14); return; }
      this.walk = 3 + rnd(10);
      if (Math.random() < 0.4) this.flip = !this.flip;
    }
    if (this.n % 2) return;
    const [w] = sizeOf(spec);
    const nx = this.x + (this.flip ? -1 : 1);
    if (nx < 1 || nx > MW - w - 1 - (s.gift ? 7 : 0)) { this.flip = !this.flip; this.walk = 0; this.pause = 3; return; }
    this.x = nx; this.walk -= 1;
  }
  wait(n) { return new Promise((res, rej) => { if (this.dead) rej(DEAD); else this.waits.push({ n, res, rej }); }); }
  /* one little show at a time; whatever it changed is put back afterwards */
  async show(fn) {
    if (this.busy || this.dead || this.game) return false;
    this.busy = true;
    try { await fn(); return true; } catch (e) { if (e !== DEAD) throw e; return false; } finally {
      this.busy = false; this.face = null; this.as = null; this.hide = false; this.flash = false;
      this.items = []; this.fx = {}; this.hop = 0; this.lift = 0; this.tilt = 0; this.wobble = null; this.pause = 8;
    }
  }
  pop(name, dx = 0, life = 9) {
    const [hx, top] = this.head();
    const spr = SPR[name];
    this.parts.push({ spr, x: Math.max(0, Math.min(MW - spr.w, hx - Math.floor(spr.w / 2) + dx)), y: Math.max(1, top - spr.h - 1), vy: -0.5, life });
  }
  async hops(times = 2) { for (let i = 0; i < times; i++) { this.hop = 2; await this.wait(1); this.hop = 0; await this.wait(1); } }
  /* make room on the right of the pet for something w dots wide, and face it */
  front(w) {
    const [pw] = sizeOf(this.specNow());
    this.flip = false;
    this.x = Math.max(1, Math.min(this.x, MW - pw - w - 3 - (this.sim.gift ? 8 : 0)));      // not on top of a waiting gift
    return this.x + pw + 1;
  }

  /* ---------- the little shows ---------- */
  feed(food) {
    return this.show(async () => {
      const spr = SPR[food === 'cookie' ? 'cookie' : 'page'];
      const item = { spr, x: this.front(spr.w), y: GROUND - spr.h + 1, from: 0 };
      this.items.push(item);
      this.face = { eyes: 'open', mouth: 'open' };
      await this.wait(4);
      for (let i = 1; i <= 3; i++) {
        this.face = { eyes: 'happy', mouth: 'open' };
        sfx.bite();
        item.from = Math.ceil((spr.h * i) / 3);
        await this.wait(2);
        this.face = { eyes: 'happy', mouth: 'flat' };
        await this.wait(2);
      }
      this.items = [];
      this.face = { eyes: 'happy', mouth: 'smile' };
      this.pop(food === 'cookie' ? 'heart' : 'heartS');
      sfx.yum();
      await this.hops(2);
      await this.wait(3);
    });
  }
  read() {
    return this.show(async () => {
      const item = { spr: SPR.openbook, x: this.front(9), y: GROUND - 4 };
      this.items.push(item);
      this.face = { eyes: 'open', mouth: 'flat' };
      await this.wait(4);
      for (let i = 0; i < 4; i++) {
        item.spr = SPR.openbookFlip; sfx.page();
        await this.wait(2);
        item.spr = SPR.openbook;
        if (i % 2) this.pop('starS', i - 2, 7);
        await this.wait(3);
      }
      this.face = { eyes: 'happy', mouth: 'smile' };
      this.pop('star');
      sfx.ok();
      await this.hops(1);
      await this.wait(4);
    });
  }
  sweep(n) {
    return this.show(async () => {
      const item = { spr: SPR.broom, x: MW, y: GROUND - 8 };
      this.items.push(item);
      this.fx.crumbs = { n, cut: MW };
      while (item.x > -6) {
        item.x -= 3;
        this.fx.crumbs.cut = item.x + 1;
        if (item.x % 2 === 0) sfx.sweep();
        if (Math.abs(item.x - this.x) < 3) this.hop = 2; else this.hop = 0;
        await this.wait(1);
      }
      this.items = [];
      this.face = { eyes: 'happy', mouth: 'smile' };
      this.pop('starS');
      sfx.ok();
      await this.wait(5);
    });
  }
  lampOff() {
    return this.show(async () => {
      this.face = { eyes: 'sleepy', mouth: 'flat' };
      sfx.off();
      await this.wait(4);
      this.face = { eyes: 'closed', mouth: 'flat' };
      this.flash = true;
      await this.wait(2);
    });
  }
  lampOn(grumpy) {
    return this.show(async () => {
      sfx.on();
      this.face = grumpy ? { eyes: 'sad', mouth: 'wavy' } : { eyes: 'open', mouth: 'open' };
      if (grumpy) { await this.wait(8); } else { await this.hops(2); await this.wait(3); }
    });
  }
  tea() {
    return this.show(async () => {
      const item = { spr: SPR.cup, x: this.front(7), y: GROUND - 6 };
      this.items.push(item);
      this.face = { eyes: 'dizzy', mouth: 'wavy' };
      await this.wait(5);
      for (let i = 0; i < 3; i++) {
        item.spr = i % 2 ? SPR.cup : SPR.cupB;
        this.face = { eyes: 'closed', mouth: 'open' }; sfx.sip();
        await this.wait(3);
        this.face = { eyes: 'closed', mouth: 'flat' };
        await this.wait(2);
      }
      this.items = [];
      this.face = { eyes: 'happy', mouth: 'smile' };
      this.pop('heart');
      sfx.well();
      await this.hops(2);
      await this.wait(3);
    });
  }
  stroke(liked) {
    return this.show(async () => {
      this.face = { eyes: 'happy', mouth: 'smile' };
      if (liked) { this.pop('heartS'); sfx.heart(); } else sfx.key();
      await this.hops(1);
      await this.wait(2);
    });
  }
  /* a knock is not a show: every tap counts, however fast they come */
  knock() {
    if (this.busy || this.game || this.dead) return;
    sfx.knock();
    this.wobble = [1, -1, 1, 0];
    this.pop('starS', rnd(7) - 3, 5);
  }
  refuse() {
    return this.show(async () => {
      sfx.no();
      this.face = { eyes: 'closed', mouth: 'flat' };
      const [hx, top] = this.head();
      this.items.push({ spr: SPR.sour, x: Math.max(0, Math.min(MW - 5, hx - 2)), y: Math.max(0, top - 7) });
      for (let i = 0; i < 4; i++) { this.x += i % 2 ? -1 : 1; await this.wait(1); }
      await this.wait(3);
    });
  }
  /* from: what it looked like a moment ago. The sim already holds what it is now. */
  hatch(from) {
    return this.show(async () => {
      this.as = from;
      sfx.hatch();
      for (let i = 0; i < 8; i++) { this.tilt = i % 2 ? 1 : -1; this.flash = i > 3 && i % 2 === 0; await this.wait(1); }
      this.tilt = 0; this.flash = true;
      await this.wait(1);
      this.flash = false; this.as = null;
      this.face = { eyes: 'happy', mouth: 'open' };
      this.pop('star', -5); this.pop('starS', 5); this.pop('heartS', 0, 12);
      await this.hops(3);
      await this.wait(4);
    });
  }
  grow(from) {
    return this.show(async () => {
      sfx.grow();
      this.fx.still = true;
      for (const hold of [4, 4, 3, 3, 2, 2, 1, 1, 1, 1]) {
        this.as = this.as ? null : from;
        this.center();
        await this.wait(hold);
      }
      this.as = null; this.center();
      this.flash = true; await this.wait(1); this.flash = false;
      this.fx.still = false;
      this.face = { eyes: 'happy', mouth: 'open' };
      this.pop('star', -6); this.pop('star', 6); this.pop('heart', 0, 12);
      await this.hops(2);
      await this.wait(6);
    });
  }
  center() { const [w] = sizeOf(this.specNow()); this.x = Math.floor((MW - w) / 2); }
  /* the moth flies up to the stage lights; then a new book lands */
  release(from) {
    return this.show(async () => {
      this.as = from; this.center();
      this.face = { eyes: 'happy', mouth: 'smile' };
      sfx.fly();
      await this.hops(2);
      for (let i = 0; i < 20; i++) {
        this.lift += i < 6 ? 1 : 2;
        this.frame = i % 2;
        if (i % 3 === 0) this.parts.push({ spr: SPR.starS, x: this.x + 4 + rnd(18), y: Math.max(0, GROUND - this.lift), vy: 0.5, life: 6 });
        await this.wait(1);
      }
      this.hide = true;
      await this.wait(8);
      this.as = null; this.hide = false; this.center();
      for (this.lift = 28; this.lift > 0; this.lift = Math.max(0, this.lift - 5)) await this.wait(1);
      sfx.drop();
      for (const t of [1, -1, 0]) { this.tilt = t; await this.wait(1); }
      await this.wait(3);
    });
  }
  gift(kind) {
    return this.show(async () => {
      this.fx.gift = 'shut';
      this.flip = false;
      for (const h of [2, 0, 2, 0]) { this.fx.giftHop = h; await this.wait(1); }
      this.fx.gift = 'open';
      sfx.gift();
      this.parts.push({ spr: SPR[kind === 'note' ? 'iBook' : 'iNote'], x: GIFT_X + 1, y: GROUND - 12, vy: -0.5, life: 12 });
      this.face = { eyes: 'happy', mouth: 'open' };
      await this.hops(2);
      this.pop('heart');
      await this.wait(8);
    });
  }
  cheer(score) {
    return this.show(async () => {
      this.face = { eyes: 'happy', mouth: score >= 8 ? 'open' : 'smile' };
      this.pop(score >= 8 ? 'heart' : 'heartS'); this.pop('noteS', -6); if (score >= 15) this.pop('star', 6);
      await this.hops(score >= 8 ? 3 : 1);
      await this.wait(4);
    });
  }

  /* ---------- the game ---------- */
  play() {
    if (this.busy || this.game || this.dead) return Promise.resolve(null);
    const g = this.game = new Rhythm(this);
    this.lcd.ghost = 0.03;                  // moving notes must stay sharp
    return g.done.then(score => { this.game = null; this.lcd.ghost = 0.085; this.pause = 6; return score; });
  }
  tap() { if (this.game) this.game.tap(); }
  down(e) {
    e.preventDefault();
    if (this.game) { this.game.tap(); return; }
    if (this.busy) return;
    const [dx, dy] = this.lcd.dotAt(e.clientX, e.clientY);
    this.onTap(this.sim.gift && dx >= GIFT_X - 4 && dy >= GROUND - 12 ? 'gift' : 'pet');
  }

  /* ---------- drawing ---------- */
  draw() {
    const m = this.lcd;
    m.clear();
    if (this.game) { this.game.draw(m); return; }
    const s = this.sim;
    const spec = this.specNow();
    m.hline(0, MW - 1, FLOOR);
    const crumbs = this.fx.crumbs ? this.fx.crumbs.n : s.crumbs || 0;
    for (let i = 0; i < crumbs; i++) if (!this.fx.crumbs || CRUMB_X[i] < this.fx.crumbs.cut) m.blit(SPR.crumb, CRUMB_X[i], GROUND - 1);
    if (this.fx.gift) m.blit(this.fx.gift === 'open' ? SPR.giftOpen : SPR.gift, GIFT_X, GROUND - 6 - (this.fx.giftHop || 0));
    else if (s.gift && !this.as) m.blit(SPR.gift, GIFT_X, GROUND - 6 - (this.n % 16 < 2 ? 1 : 0));
    if (!this.hide) {
      const asleep = s.asleep && !this.as;
      drawPet(m, spec, { x: this.x + (spec.stage === 'cocoon' ? this.tilt : 0), y: this.petY(), flip: this.flip, frame: asleep && spec.stage === 'adult' ? 1 : this.frame, tilt: this.tilt, beat: Math.floor(this.n / 3), ...this.faceNow() });
    }
    for (const it of this.items) m.blit(it.spr, it.x, it.y, { from: it.from || 0 });
    for (const p of this.parts) m.blit(p.spr, Math.round(p.x), Math.round(p.y));
    if (!this.busy && !this.hide) {
      const [hx, top] = this.head();
      const [w] = sizeOf(spec);
      if (s.asleep) {
        const zx = Math.min(MW - 12, hx + 4), zy = Math.max(7, top - 2);
        m.blit(SPR.z, zx, zy - 3);
        if (this.n % 16 >= 8) m.blit(SPR.Z, zx + 5, zy - 9);
      }
      const icon = NEED_ICON[s.need];
      if (icon) {
        const right = this.x + w / 2 < MW / 2;
        const bx = right ? MW - 12 : 1;
        m.blit(SPR.bubble, bx, 0, { flip: !right, erase: true });
        if (this.n % 12 < 9) m.blit(SPR[icon], bx + 3, 2);
      }
    }
    const dark = s.asleep && s.lamp === false && !this.as;
    if (dark !== !!this.flash) m.invert(FLOOR);
  }
}

/* ---------- 听歌：notes slide in from the right; tap when one is inside the frame ---------- */
const TARGET = 9;        // the middle of the frame
const LEAD = 1.3;        // seconds before the first beat arrives
const REACH = 3.6;       // how many dots off still counts
class Rhythm {
  constructor(scene, total = 20) {
    this.s = scene; this.total = total; this.v = 26;
    this.notes = [];
    let t = 0, p = 2;
    for (let i = 0; i < total; i++) {
      const beat = 0.64 - 0.14 * (i / (total - 1));                 // the tune picks up speed
      const quick = i > 2 && i % 4 !== 0 && Math.random() < 0.4;
      t += (quick ? 0.5 : 1) * beat;
      p = Math.max(0, Math.min(7, p + [-2, -1, -1, 1, 1, 2][rnd(6)]));
      this.notes.push({ t, p, st: 0 });                             // 0 on its way · 1 caught · 2 missed
    }
    this.end = LEAD + t + 0.7;
    this.phase = 'count'; this.tau = -1.5; this.digit = 0; this.score = 0;
    this.lock = 0; this.mark = ''; this.markT = 0; this.mood = 0; this.moodT = 0; this.out = 0;
    this.done = new Promise(res => { this.resolve = res; });
    this.closed = false;
  }
  finish(score) { if (this.closed) return; this.closed = true; this.resolve(score); }
  feel(mood, mark) { this.mood = mood; this.moodT = 0.4; this.mark = mark; this.markT = 0.28; }
  update(dt) {
    this.tau += dt;
    this.lock = Math.max(0, this.lock - dt); this.markT = Math.max(0, this.markT - dt); this.moodT = Math.max(0, this.moodT - dt);
    if (this.phase === 'count') {
      const d = Math.ceil(-this.tau / 0.5);
      if (d !== this.digit && d >= 1) { this.digit = d; sfx.count(false); }
      if (this.tau >= 0) { this.phase = 'run'; sfx.count(true); }
      return;
    }
    if (this.phase === 'run') {
      for (const n of this.notes) if (n.st === 0 && (LEAD + n.t - this.tau) * this.v < -REACH) { n.st = 2; this.feel(-1, ''); sfx.miss(); }
      if (this.tau >= this.end) { this.phase = 'result'; this.out = 0; sfx.result(this.score); }
      return;
    }
    this.out += dt;
    if (this.out > 2.4) this.finish(this.score);
  }
  tap() {
    if (this.phase === 'result') { if (this.out > 0.6) this.finish(this.score); return; }
    if (this.phase !== 'run' || this.lock > 0) return;
    let best = null, bd = 1e9;
    for (const n of this.notes) { if (n.st) continue; const d = Math.abs((LEAD + n.t - this.tau) * this.v); if (d < bd) { bd = d; best = n; } }
    if (best && bd <= REACH) { best.st = 1; this.score += 1; sfx.note(best.p); this.feel(1, 'star'); }
    else { sfx.miss(); this.lock = 0.3; this.feel(-1, 'sour'); }
  }
  draw(m) {
    const spec = this.s.specNow();
    const [w] = sizeOf(spec);
    if (this.phase === 'result') {
      const str = String(this.score);
      m.text(str, Math.floor((MW - (str.length * 12 - 3)) / 2), 3, 3);
      const stars = this.score >= 15 ? 3 : this.score >= 8 ? 2 : 1;
      for (let i = 0; i < stars; i++) if (this.out > 0.3 + i * 0.3) m.blit(SPR.star, Math.floor(MW / 2 - (stars * 7 - 2) / 2) + i * 7, 22);
      m.hline(0, MW - 1, FLOOR);
      return;
    }
    // the frame
    const hot = this.markT > 0 && this.mark === 'star';
    for (let y = 1; y <= 11; y++) { m.px(TARGET - 4, y); m.px(TARGET + 4, y); if (hot) { m.px(TARGET - 5, y); m.px(TARGET + 5, y); } }
    for (const y of [1, 11]) { m.px(TARGET - 3, y); m.px(TARGET + 3, y); }
    for (let x = TARGET + 7; x < MW; x += 3) m.px(x, 12);
    if (this.phase === 'count') m.text(String(Math.max(1, this.digit)), 24, 1, 2);
    else {
      for (const n of this.notes) {
        if (n.st === 1) continue;
        const x = Math.round(TARGET + (LEAD + n.t - this.tau) * this.v) - 2;
        if (x > -6 && x < MW) m.blit(SPR.note, x, 3);
      }
      if (this.markT > 0 && this.mark) m.blit(SPR[this.mark], TARGET - 2, 4, { erase: this.mark === 'sour' });
    }
    // the listener
    const glad = this.moodT > 0 && this.mood > 0, sorry = this.moodT > 0 && this.mood < 0;
    const y = GROUND - (glad && this.moodT > 0.25 ? 2 : 0);
    drawPet(m, spec, { x: Math.floor((MW - w) / 2), y, frame: Math.floor(Math.max(0, this.tau) / 0.32) % 2, beat: Math.floor(Math.max(0, this.tau) / 0.16),
      eyes: glad ? 'happy' : sorry ? 'sad' : 'open', mouth: glad ? 'open' : sorry ? 'wavy' : 'smile' });
    const str = String(this.score);
    m.text(str, MW - str.length * 4, 14);
    const prog = Math.max(0, Math.min(1, this.tau / this.end));
    m.hline(0, Math.round((MW - 1) * prog), FLOOR);
    for (let x = Math.round((MW - 1) * prog) + 2; x < MW; x += 2) m.px(x, FLOOR);
  }
}
