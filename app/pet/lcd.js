/* =========================================================
   书虫 · a one-colour dot-matrix screen, drawn in code
   A 48 × 32 matrix like the little handheld pets of the nineties:
   dark dots on grey-green glass, a faint grid where dots are off,
   and dots that fade a moment after they switch off. Above and
   below the matrix sit fixed "segments" (gauges, clock, status),
   which stay faintly visible when unlit, as on real glass.
   Every sprite is a few rows of text below. No image files.
   ========================================================= */
export const MW = 48;
export const MH = 32;
export const GROUND = 30;            // the row feet stand on; the floor line is the row below

/* '#' is a lit dot */
const S = lines => {
  const h = lines.length, w = Math.max(...lines.map(l => l.length));
  const d = new Uint8Array(w * h);
  lines.forEach((l, y) => { for (let x = 0; x < l.length; x++) if (l[x] === '#') d[y * w + x] = 1; });
  return { w, h, d };
};
/* draw the left half and the middle column; the right half is its mirror */
const M = lines => S(lines.map(l => l + [...l.slice(0, -1)].reverse().join('')));

export const SPR = {
  book: S([
    '.##############.',
    '#.#............#',
    '#.#............#',
    '#.#....##......#',
    '#.#...#..#.....#',
    '#.#....##......#',
    '#.#............#',
    '#.#............#',
    '.##############.',
    '..........#.#...',
  ]),
  note_on_book: S(['#####', '#...#', '#.#.#', '#...#', '#####']),
  babyA: S([
    '......#...#.',
    '.......#.#..',
    '......#####.',
    '.....#.....#',
    '.###.#.....#',
    '#...##.....#',
    '#....#.....#',
    '.####.#####.',
    '..#.#..#.#..',
  ]),
  babyB: S([
    '.....#...#..',
    '......#.#...',
    '......#####.',
    '.....#.....#',
    '..##.#.....#',
    '.#..##.....#',
    '.#...#.....#',
    '..###.#####.',
    '...#.#.#.#..',
  ]),
  teenA: S([
    '.............#...#..',
    '..............#.#...',
    '............#######.',
    '...........#.......#',
    '...........#.......#',
    '.###..###..#.......#',
    '#...##...###.......#',
    '#....#....##.......#',
    '#....#....#.#.....#.',
    '.####.####...#####..',
    '..#.#..#.#....#.#...',
  ]),
  teenB: S([
    '............#...#...',
    '.............#.#....',
    '............#######.',
    '...........#.......#',
    '.......###.#.......#',
    '..###.#...##.......#',
    '.#...##....#.......#',
    '.#....#...##.......#',
    '.#....#...#.#.....#.',
    '..####.###...#####..',
    '...#.#.#.#.....#.#..',
  ]),
  cocoonA: S([
    '...###...',
    '..#...#..',
    '.#..#..#.',
    '.#.#...#.',
    '#.#...#.#',
    '##...#..#',
    '#...#..##',
    '#..#..#.#',
    '#.#..#..#',
    '.#..#..#.',
    '.#.#...#.',
    '..#...#..',
    '...###...',
  ]),
  cocoonB: S([
    '....###..',
    '...#...#.',
    '.#..#..#.',
    '.#.#...#.',
    '#.#...#.#',
    '##...#..#',
    '#...#..##',
    '#..#..#.#',
    '#.#..#..#',
    '.#..#..#.',
    '.#.#...#.',
    '..#...#..',
    '...###...',
  ]),
  /* moths, seen from the front: wings open and wings half-closed; faces, hats and wing patterns are added by code */
  mothOpen: M([
    '.........#....',
    '..........#...',
    '..........####',
    '.###.....#....',
    '#...##...#....',
    '#.....#..#....',
    '#......#.#....',
    '#.......##....',
    '.#........#...',
    '..#......#.###',
    '..#.....#..#..',
    '.#......#..###',
    '.#.....#....#.',
    '..#...#.....##',
    '...###.......#',
  ]),
  mothShut: M([
    '.........#....',
    '..........#...',
    '..........####',
    '.....##..#....',
    '....#..#.#....',
    '...#....##....',
    '...#....##....',
    '...#.....#....',
    '....#.....#...',
    '.....#...#.###',
    '.....#..#..#..',
    '....#...#..###',
    '....#..#....#.',
    '.....##.....##',
    '.............#',
  ]),
  lunaOpen: M([
    '.........#....',
    '..........#...',
    '..........####',
    '.###.....#....',
    '#...##...#....',
    '#.....#..#....',
    '#......#.#....',
    '#.......##....',
    '.#........#...',
    '..#......#.###',
    '..#.....#..#..',
    '.#......#..###',
    '.#.....#....#.',
    '.#....#.....##',
    '.#...#.......#',
    '..#..#........',
    '..#.#.........',
    '...#..........',
  ]),
  page: S(['####.', '#..##', '#...#', '#.#.#', '#...#', '#####']),
  cookie: S(['.###.', '#.#.#', '##.##', '#.#.#', '.###.']),
  gift: S(['.##.##.', '..###..', '#######', '#..#..#', '#######', '#..#..#', '#######']),
  giftOpen: S(['#.....#', '.#...#.', '.......', '#######', '#..#..#', '#..#..#', '#######']),
  broom: S(['....#', '...#.', '...#.', '..#..', '..#..', '.###.', '#####', '#.#.#', '#.#.#']),
  cup: S(['.#.#...', '#.#....', '.......', '######.', '#....##', '#....#.', '.####..']),
  cupB: S(['#.#....', '.#.#...', '.......', '######.', '#....##', '#....#.', '.####..']),
  openbook: S(['.###.###.', '#...#...#', '#...#...#', '#...#...#', '#########']),
  openbookFlip: S(['.###..#..', '#...#.#..', '#...##...', '#...#...#', '#########']),
  heart: S(['.#.#.', '#####', '#####', '.###.', '..#..']),
  heartS: S(['#.#', '###', '.#.']),
  star: S(['..#..', '..#..', '##.##', '..#..', '..#..']),
  starS: S(['.#.', '#.#', '.#.']),
  note: S(['..###', '..#.#', '..#..', '..#..', '.##..', '###..', '.#...']),
  noteS: S(['.##', '.#.', '.#.', '##.', '##.']),
  sour: S(['#...#', '.#.#.', '..#..', '.#.#.', '#...#']),
  crumb: S(['.#.', '#.#']),
  Z: S(['#####', '...#.', '..#..', '.#...', '#####']),
  z: S(['###', '.#.', '###']),
  bubble: S(['.#########.', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '.###.#####.', '...#.#.....', '....#......']),
  // 5 × 5, for thought bubbles, keys and segments
  iPage: S(['####.', '#..##', '#...#', '#...#', '#####']),
  iBroom: S(['...#.', '..#..', '.#...', '###..', '###..']),
  iMoon: S(['.##..', '##...', '##...', '##...', '.##..']),
  iNote: S(['..##.', '..#.#', '..#..', '.##..', '.##..']),
  iCup: S(['.#.#.', '.....', '####.', '#..##', '.##..']),
  iHeart: S(['.#.#.', '#####', '#####', '.###.', '..#..']),
  iBolt: S(['..##.', '.##..', '####.', '..##.', '.##..']),
  iSpark: S(['..#..', '.###.', '#####', '.###.', '..#..']),
  iBang: S(['.##..', '.##..', '.##..', '.....', '.##..']),
  iPlus: S(['.##..', '####.', '####.', '.##..', '.....']),
  iGift: S(['.#.#.', '#####', '#.#.#', '#.#.#', '#####']),
  iLamp: S(['.###.', '#...#', '#...#', '.###.', '.###.']),
  iBook: S(['##.##', '#.#.#', '#.#.#', '#.#.#', '#####']),
  iSun: S(['#.#.#', '.###.', '#####', '.###.', '#.#.#']),
  iZz: S(['###..', '.#...', '###.#', '....#', '...##']),
  iMute: S(['..#.#', '.##..', '###.#', '.##..', '..#.#']),
};
const FONT = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'], 6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '..#', '..#'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'], ':': ['.', '#', '.', '#', '.'], ' ': ['.', '.', '.', '.', '.'], '-': ['...', '...', '###', '...', '...'],
};
const GLYPH = Object.fromEntries(Object.entries(FONT).map(([k, v]) => [k, S(v)]));

/* ---------- a grid of dots you can draw on ---------- */
export class Matrix {
  constructor(w = MW, h = MH) { this.w = w; this.h = h; this.fb = new Uint8Array(w * h); }
  clear() { this.fb.fill(0); }
  px(x, y, v = 1) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.fb[y * this.w + x] = v; }
  get(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.fb[y * this.w + x] : 0; }
  hline(x0, x1, y, v = 1) { for (let x = x0; x <= x1; x++) this.px(x, y, v); }
  fill(x0, y0, x1, y1, v = 1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, v); }
  /* flip: mirror left-right · from/rows: draw only some rows · erase: clear the sprite's box first */
  blit(s, x, y, { flip = false, from = 0, rows = s.h, erase = false } = {}) {
    if (erase) this.fill(x - 1, y - 1, x + s.w, y + s.h, 0);
    for (let j = from; j < Math.min(s.h, from + rows); j++) for (let i = 0; i < s.w; i++) if (s.d[j * s.w + (flip ? s.w - 1 - i : i)]) this.px(x + i, y + j);
  }
  /* digits and a colon; k makes each dot k × k */
  text(str, x, y, k = 1) {
    for (const ch of String(str)) {
      const g = GLYPH[ch] || GLYPH[' '];
      for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.d[j * g.w + i]) this.fill(x + i * k, y + j * k, x + i * k + k - 1, y + j * k + k - 1);
      x += (g.w + 1) * k;
    }
    return x;
  }
  invert(rows = this.h) { const n = Math.min(this.h, rows) * this.w; for (let i = 0; i < n; i++) this.fb[i] ^= 1; }
}

/* ---------- the creature ---------- */
const FACE = {
  baby: { eyes: [7, 9], row: 4, mouth: [8, 6] },
  teen: { eyes: [14, 17], row: 4, mouth: [15, 7] },
  moth: { eyes: [11, 15], row: 4, mouth: [13, 7] },
};
function drawFace(m, kind, ox, oy, w, flip, p) {
  const f = FACE[kind];
  const dot = (x, y) => m.px(flip ? ox + w - 1 - x : ox + x, oy + y);
  const eyes = p.eyes || 'open', mouth = p.mouth || 'smile';
  const [mx, my] = f.mouth;
  if (kind === 'baby') {                                             // a face five dots wide: position says it all
    const low = eyes === 'closed' || eyes === 'sleepy' || eyes === 'sad';
    f.eyes.forEach(ex => { dot(ex, f.row + (low ? 1 : 0)); if (eyes === 'dizzy') dot(ex, f.row + 1); });
    if (mouth === 'open') { dot(mx - 1, my); dot(mx, my); dot(mx + 1, my); }
    else if (mouth === 'wavy') { dot(mx - 1, my); dot(mx + 1, my); }
    else if (mouth !== 'flat') dot(mx, my);
    return;
  }
  f.eyes.forEach((ex, i) => {
    const y = f.row;
    if (eyes === 'closed') { dot(ex - 1, y + 1); dot(ex, y + 1); if (kind === 'moth' || i) dot(ex + 1, y + 1); }
    else if (eyes === 'happy') { dot(ex - 1, y + 1); dot(ex, y); dot(ex + 1, y + 1); }
    else if (eyes === 'dizzy') { const k = i ? 1 : -1; dot(ex + k, y); dot(ex, y + 1); dot(ex + k, y + 2); }      // > <
    else if (eyes === 'sleepy') { dot(ex - 1, y); dot(ex, y); dot(ex + 1, y); dot(ex, y + 1); }
    else if (eyes === 'sad') { dot(ex, y + 1); dot(ex, y + 2); dot(ex + (i ? 1 : -1), y); }
    else { dot(ex, y); dot(ex, y + 1); }
  });
  if (mouth === 'open') { dot(mx - 1, my - 1); dot(mx, my - 1); dot(mx + 1, my - 1); dot(mx - 1, my); dot(mx + 1, my); dot(mx, my + 1); }
  else if (mouth === 'flat') { dot(mx - 1, my); dot(mx, my); dot(mx + 1, my); }
  else if (mouth === 'sad') { dot(mx - 1, my + 1); dot(mx, my); dot(mx + 1, my + 1); }
  else if (mouth === 'wavy') { dot(mx - 2, my); dot(mx - 1, my + 1); dot(mx, my); dot(mx + 1, my + 1); dot(mx + 2, my); }
  else { dot(mx - 1, my); dot(mx, my + 1); dot(mx + 1, my); }
}
/* what it has been up to shows on its head: a reader wears a cap, a listener wears headphones */
function cap(m, X, top, c) {
  for (let x = c - 4; x <= c + 4; x++) { m.px(X(x), top, 1); m.px(X(x), top + 1, 0); }
  for (let x = c - 2; x <= c + 2; x++) m.px(X(x), top + 1, 1);
  m.px(X(c + 5), top + 1); m.px(X(c + 5), top + 2);
}
function phones(m, X, top, c, both) {
  for (let x = c - 4; x <= c + 4; x++) { m.px(X(x), top, 0); m.px(X(x), top + 1, 0); }
  for (let x = c - 3; x <= c + 3; x++) m.px(X(x), top + 1, 1);
  for (let y = 4; y <= 6; y++) { m.px(X(c - 5), top + y); m.px(X(c - 4), top + y); if (both) { m.px(X(c + 5), top + y); m.px(X(c + 4), top + y); } }
  m.px(X(c - 4), top + 2); m.px(X(c - 4), top + 3); if (both) { m.px(X(c + 4), top + 2); m.px(X(c + 4), top + 3); }
}
function wingArt(m, form, ox, oy, open, beat) {
  // drawn on the left wing and mirrored onto the right (the sprite is 27 dots wide)
  const both = (x, y) => { m.px(ox + x, oy + y); m.px(ox + 26 - x, oy + y); };
  if (!open) { both(6, 6); if (form === 'dusty') { both(5, 5); both(6, 11); } else if (form === 'scholar') both(5, 6); return; }
  if (form === 'scholar') { for (const x of [2, 3, 4]) both(x, 5); for (const x of [2, 3, 4, 5, 6]) both(x, 7); for (const x of [4, 5, 6]) both(x, 11); }
  else if (form === 'musician') { [2, 4, 6].forEach((x, i) => { const h = 1 + ((beat + i * 2) % 3) + (i === 2 ? 0 : 1); for (let k = 0; k < Math.min(h, i === 2 ? 3 : 4); k++) both(x, 8 - k); }); both(4, 11); both(5, 11); }
  else if (form === 'luna') { both(3, 5); both(2, 6); both(4, 6); both(3, 7); both(5, 11); }
  else { for (let y = 5; y <= 8; y++) for (let x = 1; x <= 7; x++) if ((x + y) % 2 === 0 && x <= y + 1 && x + y > 5) both(x, y); both(4, 11); both(5, 12); }
}
export const sizeOf = spec => {
  if (spec.stage === 'book' || spec.away) return [16, 10];
  if (spec.stage === 'cocoon') return [9, 13];
  if (spec.stage === 'adult') return [27, spec.form === 'luna' ? 18 : 15];
  return spec.stage === 'baby' ? [12, 9] : [20, 11];
};
/* pose: x = left edge, y = the row its feet (or shadow) rest on */
export function drawPet(m, spec, pose) {
  const p = { x: 0, y: GROUND, flip: false, frame: 0, ...pose };
  const [w, h] = sizeOf(spec);
  const top = p.y - h + 1;
  if (spec.stage === 'book' || spec.away) {
    const bx = p.x + (p.tilt || 0);
    m.blit(SPR.book, bx, top);
    const crack = Math.round((spec.warm || 0) * 5);                  // a crack runs down the cover as it warms up
    for (let i = 0; i < crack; i++) m.px(bx + 10 + (i % 2), top + 1 + i);
    if (crack >= 3) { m.px(bx + 12, top + 3); m.px(bx + 8, top + 5); }
    if (spec.away) m.blit(SPR.note_on_book, bx + 6, top + 2, { erase: true });
    return;
  }
  if (spec.stage === 'cocoon') { m.blit(p.frame ? SPR.cocoonB : SPR.cocoonA, p.x, top); return; }
  if (spec.stage === 'adult') {
    const open = !p.frame;
    const luna = spec.form === 'luna';
    const spr = luna && open ? SPR.lunaOpen : open ? SPR.mothOpen : SPR.mothShut;
    const oy = top;
    m.blit(spr, p.x, oy);
    wingArt(m, spec.form, p.x, oy, open, p.beat || 0);
    const X = x => p.x + x;
    if (spec.form === 'scholar') cap(m, X, oy, 13);
    else if (spec.form === 'musician') phones(m, X, oy, 13, true);
    else if (luna) { m.px(p.x + 8, oy + 1); m.px(p.x + 18, oy + 1); }
    drawFace(m, 'moth', p.x, oy, 27, false, { ...p, eyes: spec.form === 'dusty' && (!p.eyes || p.eyes === 'open') ? 'sleepy' : p.eyes });
    return;
  }
  const baby = spec.stage === 'baby';
  const spr = baby ? (p.frame ? SPR.babyB : SPR.babyA) : (p.frame ? SPR.teenB : SPR.teenA);
  m.blit(spr, p.x, top, { flip: p.flip });
  const X = x => (p.flip ? p.x + w - 1 - x : p.x + x);
  if (!baby && spec.lean === 'scholar') cap(m, X, top, 15);
  else if (!baby && spec.lean === 'musician') phones(m, X, top, 15, false);
  drawFace(m, baby ? 'baby' : 'teen', p.x, top, w, p.flip, p);
}

/* ---------- the glass ---------- */
const INK = '#1E2A1C';
const GAUGES = ['iPage', 'iHeart', 'iBolt', 'iSpark'];
const FLAGS = ['iBang', 'iZz', 'iPlus', 'iGift', 'iLamp', 'iMute'];
export class Lcd extends Matrix {
  constructor(canvas) {
    super(MW, MH);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lum = new Float32Array(MW * MH);
    this.gauges = [4, 4, 4, 4]; this.blink = [false, false, false, false];
    this.flags = {}; this.clock = '12:00'; this.sun = true; this.t = 0;
    this.ghost = 0.085;                  // seconds a dot takes to fade once it is switched off
    this.resize();
  }
  resize() {
    const host = this.canvas.parentElement;
    const cssW = Math.max(220, Math.min(380, host ? host.clientWidth : 320));
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    const pad = cssW * 0.05;
    const pitch = (cssW - pad * 2) / MW;
    const strip = pitch * 4.4;
    this.g = { cssW, cssH: pad * 2 + strip * 2 + MH * pitch, dpr, pad, pitch, strip, mx: pad, my: pad + strip };
    this.canvas.style.width = `${cssW}px`; this.canvas.style.height = `${this.g.cssH}px`;
    this.canvas.width = Math.round(cssW * dpr); this.canvas.height = Math.round(this.g.cssH * dpr);
    // the unlit glass is painted once: tint, and the faint grid of dots that are off
    const bg = this.bg = document.createElement('canvas');
    bg.width = this.canvas.width; bg.height = this.canvas.height;
    const b = bg.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = b.createLinearGradient(0, 0, cssW, this.g.cssH);
    grad.addColorStop(0, '#C6D1B0'); grad.addColorStop(1, '#AEBB97');
    b.fillStyle = grad; b.fillRect(0, 0, cssW, this.g.cssH);
    b.fillStyle = 'rgba(30,42,28,.055)';
    const d = pitch * 0.86;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) b.fillRect(this.g.mx + x * pitch, this.g.my + y * pitch, d, d);
  }
  /* point on the canvas → dot on the matrix */
  dotAt(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect(), g = this.g;
    const x = (clientX - r.left) / r.width * g.cssW, y = (clientY - r.top) / r.height * g.cssH;
    return [Math.floor((x - g.mx) / g.pitch), Math.floor((y - g.my) / g.pitch)];
  }
  seg(ctx, s, x, y, cell, on) {
    ctx.fillStyle = on ? 'rgba(30,42,28,.9)' : 'rgba(30,42,28,.07)';
    const d = cell * 0.9;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) if (s.d[j * s.w + i]) ctx.fillRect(x + i * cell, y + j * cell, d, d);
  }
  render(dt) {
    const { ctx, g } = this;
    this.t += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    // matrix: dots switch on fast and fade out slowly, like real liquid crystal
    const rise = 1 - Math.exp(-dt / 0.025), fall = 1 - Math.exp(-dt / this.ghost);
    const d = g.pitch * 0.86, sh = g.pitch * 0.14;
    for (let i = 0; i < this.fb.length; i++) {
      const target = this.fb[i]; let l = this.lum[i];
      l += (target - l) * (target > l ? rise : fall); this.lum[i] = l;
      if (l < 0.03) continue;
      const x = g.mx + (i % MW) * g.pitch, y = g.my + Math.floor(i / MW) * g.pitch;
      ctx.fillStyle = `rgba(30,42,28,${0.16 * l})`; ctx.fillRect(x + sh, y + sh, d, d);
      ctx.fillStyle = `rgba(30,42,28,${0.93 * l})`; ctx.fillRect(x, y, d, d);
    }
    // top strip: four gauges, an icon and four pips each
    const cell = g.pitch * 0.5, slot = (g.cssW - g.pad * 2) / 4, blinkOn = Math.floor(this.t * 2.5) % 2 === 0;
    GAUGES.forEach((name, i) => {
      const x = g.pad + i * slot + slot * 0.08, y = g.pad + (g.strip - cell * 5) / 2 - g.pitch * 0.3;
      this.seg(ctx, SPR[name], x, y, cell, !this.blink[i] || blinkOn);
      const pw = g.pitch * 0.92, px0 = x + cell * 5 + g.pitch * 0.7;
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k < this.gauges[i] ? 'rgba(30,42,28,.9)' : 'rgba(30,42,28,.07)'; ctx.fillRect(px0 + k * (pw + g.pitch * 0.28), y + cell * 0.6, pw, cell * 3.8); }
    });
    // bottom strip: the clock (over a ghost 88:88), sun or moon, status flags
    const by = g.my + MH * g.pitch + (g.strip - cell * 5) / 2 + g.pitch * 0.3;
    let x = g.pad + g.pitch * 0.4;
    const colon = Math.floor(this.t * 2) % 2 === 0;
    [...'88:88'].forEach((ghost, i) => {
      const ch = this.clock[i] || ' ';
      this.seg(ctx, GLYPH[ghost], x, by, cell, false);
      if (ch !== ' ' && (ch !== ':' || colon)) this.seg(ctx, GLYPH[ch] || GLYPH[' '], x, by, cell, true);
      x += (GLYPH[ghost].w + 1) * cell;
    });
    x += g.pitch * 1.2;
    this.seg(ctx, SPR.iSun, x, by, cell, this.sun); x += cell * 6.4;
    this.seg(ctx, SPR.iMoon, x, by, cell, !this.sun);
    let fx = g.cssW - g.pad - g.pitch * 0.4 - FLAGS.length * cell * 6.6 + cell * 1.6;
    FLAGS.forEach(name => { const v = this.flags[name]; this.seg(ctx, SPR[name], fx, by, cell, v === 'blink' ? blinkOn : !!v); fx += cell * 6.6; });
  }
}

/* a sprite or a small scene on its own little piece of glass: album tiles, key caps, the entry card */
export function paintTile(canvas, w, h, draw, { pitch = 3, ink = INK, glass = true, ghost = true } = {}) {
  const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
  const m = new Matrix(w, h);
  draw(m);
  canvas.width = Math.round(w * pitch * dpr); canvas.height = Math.round(h * pitch * dpr);
  canvas.style.width = `${w * pitch}px`; canvas.style.height = `${h * pitch}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w * pitch, h * pitch);
  if (glass) { ctx.fillStyle = '#BCC8A5'; ctx.fillRect(0, 0, w * pitch, h * pitch); }
  const d = pitch * 0.86;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const on = m.fb[y * w + x];
    if (!on && !(glass && ghost)) continue;
    ctx.fillStyle = on ? ink : 'rgba(30,42,28,.055)';
    ctx.fillRect(x * pitch, y * pitch, d, d);
  }
}
