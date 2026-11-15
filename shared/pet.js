/* =========================================================
   书虫 · the virtual pet that lives in a book at library live
   Pure, time-based simulation: no drawing, no storage. The same
   code runs in the browser (the game) and on the server (to check
   and keep a save). Time is always passed in, so a pet goes on
   living while the app is closed: advance(pet, now) plays back
   everything that happened since it was last looked at.

   A life: a closed book → baby bookworm → young bookworm →
   paper cocoon → one of four moths, depending on how it was raised.
   ========================================================= */
const MIN = 60e3;
export const PET_V = 1;

export const STAGES = ['book', 'baby', 'teen', 'cocoon', 'adult'];
export const STAGE_ZH = { book: '一本合着的书', baby: '幼年书虫', teen: '少年书虫', cocoon: '纸茧', adult: '蛾' };
export const FORMS = {
  scholar: { zh: '学者蛾', how: '爱读书的书虫会长成它' },
  musician: { zh: '乐手蛾', how: '爱听歌的书虫会长成它' },
  luna: { zh: '月光蛾', how: '读书、听歌都不落下，又被照顾得很好' },
  dusty: { zh: '灰蛾', how: '常常被忘在书里的书虫' },
};

/* How fast a life runs. Minutes of age, hours for a need to run from full to empty. */
export const TUNING = {
  hatchTaps: 6,
  teenAt: 24 * 60, cocoonAt: 72 * 60, adultAt: 78 * 60,
  hours: { full: 18, mood: 24, energy: 16, sleep: 7, crumb: 3 },      // one visit a day keeps it well
  pace: { baby: 1.25, teen: 1, adult: 0.8 },
  sickAfter: { starve: 10 * 60, dirty: 16 * 60 },
  awayAfter: { misery: 36 * 60, sick: 48 * 60 },
  callTaps: 5,
  maxCrumbs: 4,
  snackWindow: 6 * 60, snackLimit: 3,
  strokeWindow: 10, strokeLimit: 5,
};
const T = TUNING;

export const WHY = {
  na: '现在还不行',
  asleep: '它睡着了，先别吵它',
  away: '它躲进书里了，先把它叫回来',
  full: '它吃不下了',
  snack_limit: '零食吃太多了，过会儿再给',
  tired: '它太困了，让它睡一会儿',
  hungry: '它饿得没心思，先喂点东西',
  sick: '它不舒服，先泡杯热茶',
  not_sleepy: '它还不困，晚点再关灯',
  not_sick: '它好好的，不用喝茶',
  clean: '桌面很干净',
  claimed: '这份礼物已经拿过了',
  unknown: '没有这个动作',
};

const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const hzHour = t => new Date(t + 8 * 3600e3).getUTCHours();

export function newPet(now, keep = {}) {
  return {
    v: PET_V, rev: 0, t: now, created: now, born: 0, name: '', stage: 'book', form: '', warm: 0,
    age: 0, full: 70, mood: 75, energy: 85, crumbs: 0, crumbT: 0,
    asleep: false, lamp: true, sick: false, away: false, calls: 0,
    starve: 0, dirty: 0, sickT: 0, misery: 0,
    know: 0, music: 0, careSum: 0, careN: 0, neglect: 0,
    snacks: [], strokes: [], best: keep.best || 0, gifts: keep.gifts || [], album: keep.album || [],
  };
}

export const careOf = pet => (pet.careN ? pet.careSum / pet.careN : 60);
export const cleanOf = pet => 100 - (100 / T.maxCrumbs) * pet.crumbs;
export const daysOf = pet => Math.floor(pet.age / 1440) + 1;

/* which way a young bookworm is leaning: it shows in what it wears */
export function leanOf(pet) {
  if (pet.know - pet.music >= 4) return 'scholar';
  if (pet.music - pet.know >= 4) return 'musician';
  return '';
}
export function formFor(pet) {
  const care = careOf(pet);
  if (pet.neglect >= 2 || care < 40) return 'dusty';
  const k = pet.know;
  const m = pet.music;
  if (care >= 75 && k >= 10 && m >= 10 && Math.abs(k - m) <= Math.max(6, 0.35 * Math.max(k, m))) return 'luna';
  return k >= m ? 'scholar' : 'musician';
}

/* Play back the minutes between pet.t and now. Returns what happened, for a "while you were away" note. */
export function advance(pet, now) {
  const out = { minutes: 0, slept: false, woke: false, crumbs: 0, sick: false, away: false, stages: [] };
  let steps = Math.floor((now - pet.t) / MIN);
  if (steps <= 0) { if (now < pet.t) pet.t = now; return out; } // a clock that went backwards changes nothing
  steps = Math.min(steps, 60 * 24 * 60);
  pet.t += steps * MIN;
  out.minutes = steps;
  if (pet.stage === 'book' || pet.away) return out; // a closed book waits
  const h = T.hours;
  for (let i = 0; i < steps; i++) {
    pet.age += 1;
    if (pet.stage === 'cocoon') {
      if (pet.age >= T.adultAt) {
        pet.stage = 'adult'; pet.form = formFor(pet); pet.adultAt = pet.age;
        pet.full = 60; pet.mood = 80; pet.energy = 80; pet.asleep = false; pet.lamp = true;
        out.stages.push('adult');
      }
      continue;
    }
    const k = T.pace[pet.stage] || 1;
    if (pet.asleep) {
      pet.energy += (100 / (h.sleep * 60)) * (pet.lamp ? 0.5 : 1);
      pet.full -= k * (100 / (h.full * 60)) * 0.35;
      if (pet.energy >= 100) { pet.asleep = false; pet.lamp = true; out.woke = true; }
    } else {
      pet.full -= k * (100 / (h.full * 60));
      pet.energy -= k * (100 / (h.energy * 60));
      pet.mood -= k * (100 / (h.mood * 60)) * (pet.full < 25 ? 2 : 1) * (pet.crumbs >= 3 ? 1.5 : 1) * (pet.sick ? 2 : 1);
      pet.crumbT += k;
      if (pet.crumbT >= h.crumb * 60 && pet.crumbs < T.maxCrumbs) { pet.crumbs += 1; pet.crumbT = 0; out.crumbs += 1; }
      if (pet.energy <= 0) { pet.asleep = true; out.slept = true; }
      // care: how well its needs are met, minute by minute (a need that is comfortably covered counts in full)
      pet.careSum += 25 * (Math.min(1, clamp(pet.full) / 60) + Math.min(1, clamp(pet.mood) / 60) + Math.min(1, clamp(pet.energy) / 40) + cleanOf(pet) / 100);
      pet.careN += 1;
    }
    pet.full = clamp(pet.full); pet.mood = clamp(pet.mood); pet.energy = clamp(pet.energy);
    pet.starve = pet.full <= 0 ? pet.starve + 1 : 0;
    pet.dirty = pet.crumbs >= T.maxCrumbs ? pet.dirty + 1 : 0;
    if (!pet.sick && (pet.starve >= T.sickAfter.starve || pet.dirty >= T.sickAfter.dirty)) { pet.sick = true; pet.sickT = 0; pet.neglect += 1; out.sick = true; }
    if (pet.sick) pet.sickT += 1;
    pet.misery = pet.mood <= 0 && pet.full <= 0 ? pet.misery + 1 : 0;
    if (pet.misery >= T.awayAfter.misery || pet.sickT >= T.awayAfter.sick) {
      pet.away = true; pet.asleep = false; pet.calls = 0; pet.neglect += 1; out.away = true;
      break; // it hid in the book: time stops for it until it is called back
    }
    if (pet.stage === 'baby' && pet.age >= T.teenAt) { pet.stage = 'teen'; out.stages.push('teen'); }
    if (pet.stage === 'teen' && pet.age >= T.cocoonAt) {
      pet.stage = 'cocoon'; pet.asleep = false; pet.sick = false; pet.sickT = 0; pet.lamp = true;
      pet.crumbs = 0; pet.crumbT = 0; pet.dirty = 0; pet.starve = 0; pet.misery = 0; // it starts its long sleep with a clean slate
      out.stages.push('cocoon');
    }
  }
  return out;
}

const blocked = pet => (pet.away ? 'away' : pet.stage === 'book' || pet.stage === 'cocoon' ? 'na' : '');
const no = reason => ({ ok: false, reason });
const recent = (list, now, windowMin) => list.filter(t => now - t < windowMin * MIN && t <= now);

const ACTIONS = {
  /* a closed book: warm it up with a few taps and it opens */
  warm(pet, a, now) {
    if (pet.stage !== 'book') return no('na');
    pet.warm += 1;
    if (pet.warm < T.hatchTaps) return { hatched: false, warm: pet.warm };
    Object.assign(pet, { stage: 'baby', born: now, age: 0, warm: 0, full: 60, mood: 80, energy: 90, crumbs: 0, crumbT: 0 });
    return { hatched: true };
  },
  name(pet, { name }) {
    const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 8);
    if (!n) return no('na');
    pet.name = n;
    return {};
  },
  feed(pet, { food }, now) {
    const b = blocked(pet);
    if (b) return no(b);
    if (pet.asleep) return no('asleep');
    if (food === 'cookie') {
      pet.snacks = recent(pet.snacks, now, T.snackWindow);
      if (pet.snacks.length >= T.snackLimit) return no('snack_limit');
      if (pet.full > 97) return no('full');
      pet.snacks.push(now);
      pet.full = clamp(pet.full + 10); pet.mood = clamp(pet.mood + 12);
      return { food: 'cookie' };
    }
    if (pet.full > 90) return no('full');
    pet.full = clamp(pet.full + 35);
    return { food: 'page' };
  },
  read(pet) {
    const b = blocked(pet);
    if (b) return no(b);
    if (pet.asleep) return no('asleep');
    if (pet.sick) return no('sick');
    if (pet.energy < 15) return no('tired');
    if (pet.full < 10) return no('hungry');
    pet.know += 2; pet.mood = clamp(pet.mood + 6); pet.energy = clamp(pet.energy - 8); pet.full = clamp(pet.full - 4);
    return {};
  },
  /* asked before the mini-game starts */
  playcheck(pet) {
    const b = blocked(pet);
    if (b) return no(b);
    if (pet.asleep) return no('asleep');
    if (pet.sick) return no('sick');
    if (pet.energy < 15) return no('tired');
    if (pet.full < 10) return no('hungry');
    return {};
  },
  play(pet, { score }) {
    const b = blocked(pet);
    if (b) return no(b);
    const s = clamp(Math.floor(Number(score) || 0), 0, 999);
    const mood = Math.min(35, 8 + s);
    const music = 1 + Math.floor(s / 5);
    pet.mood = clamp(pet.mood + mood); pet.music += music;
    pet.energy = clamp(pet.energy - 10); pet.full = clamp(pet.full - 6);
    const record = s > pet.best;
    if (record) pet.best = s;
    return { score: s, mood, music, record };
  },
  clean(pet) {
    const b = blocked(pet);
    if (b && b !== 'na') return no(b);
    if (pet.stage === 'book') return no('na');
    if (!pet.crumbs) return no('clean');
    const n = pet.crumbs;
    pet.crumbs = 0; pet.crumbT = 0; pet.dirty = 0; pet.mood = clamp(pet.mood + 3);
    return { swept: n };
  },
  lamp(pet, a, now) {
    const b = blocked(pet);
    if (b) return no(b);
    if (pet.asleep) {
      if (pet.lamp) { pet.lamp = false; return { lamp: false, asleep: true }; } // it nodded off with the light on: now it rests properly
      pet.lamp = true; pet.asleep = false; // woken up
      const grumpy = pet.energy < 50;
      if (grumpy) pet.mood = clamp(pet.mood - 10);
      return { lamp: true, asleep: false, grumpy };
    }
    const hour = hzHour(now);
    if (pet.energy >= 70 && !(hour >= 22 || hour < 7)) return no('not_sleepy');
    pet.lamp = false; pet.asleep = true;
    return { lamp: false, asleep: true };
  },
  tea(pet) {
    const b = blocked(pet);
    if (b) return no(b);
    if (!pet.sick) return no('not_sick');
    pet.sick = false; pet.sickT = 0; pet.starve = 0; pet.dirty = 0; pet.mood = clamp(pet.mood + 5);
    return {};
  },
  stroke(pet, a, now) {
    const b = blocked(pet);
    if (b) return no(b);
    if (pet.asleep) return no('asleep');
    pet.strokes = recent(pet.strokes, now, T.strokeWindow);
    if (pet.strokes.length >= T.strokeLimit) return { mood: 0 };
    pet.strokes.push(now);
    pet.mood = clamp(pet.mood + 2);
    return { mood: 2 };
  },
  /* it hid in the book: knock a few times and it comes back */
  call(pet) {
    if (!pet.away) return no('na');
    pet.calls += 1;
    if (pet.calls < T.callTaps) return { back: false, calls: pet.calls };
    Object.assign(pet, { away: false, calls: 0, full: 50, mood: 40, energy: 60, crumbs: 0, crumbT: 0, sick: false, sickT: 0, starve: 0, dirty: 0, misery: 0, asleep: false, lamp: true });
    return { back: true };
  },
  /* things that happen in the real club reach the pet: a booked night, a roundtable */
  gift(pet, { id, kind }) {
    const b = blocked(pet);
    if (b) return no(b);
    const key = String(id || '').slice(0, 40);
    if (!key || pet.gifts.includes(key)) return no('claimed');
    pet.gifts.push(key);
    if (pet.gifts.length > 300) pet.gifts.shift();
    if (kind === 'note') { pet.know += 5; pet.mood = clamp(pet.mood + 10); return { kind: 'note' }; }
    pet.music += 5; pet.mood = clamp(pet.mood + 15);
    return { kind: 'ticket' };
  },
  /* a grown moth flies off to the stage lights; its page stays in the album and a new book arrives */
  release(pet, a, now) {
    if (pet.stage !== 'adult' || pet.away) return no('na');
    const entry = { form: pet.form, name: pet.name || '小书虫', days: daysOf(pet), at: now };
    const album = [...pet.album, entry].slice(-50);
    const fresh = newPet(now, { best: pet.best, gifts: pet.gifts, album });
    fresh.rev = pet.rev;
    for (const k of Object.keys(pet)) delete pet[k];
    Object.assign(pet, fresh);
    return { released: entry };
  },
  /* demo only: let time pass */
  skip(pet, { minutes }) {
    const m = clamp(Math.floor(Number(minutes) || 0), 0, 60 * 24 * 7);
    pet.t -= m * MIN;
    pet.snacks = pet.snacks.map(t => t - m * MIN);
    pet.strokes = pet.strokes.map(t => t - m * MIN);
    return { skipped: m };
  },
};

/* Do one thing. The pet is brought up to date first; `passed` says what happened meanwhile. */
export function act(pet, action, args, now) {
  const passed = advance(pet, now);
  const fn = ACTIONS[action];
  const r = fn ? fn(pet, args || {}, now) : no('unknown');
  const after = action === 'skip' ? advance(pet, now) : null;
  return { ok: r.ok !== false, ...r, passed: after || passed };
}

/* What it needs most right now, in words. */
export function statusOf(pet) {
  const s = (need, text, alert = false) => ({ need, text, alert });
  if (pet.stage === 'book') return s('book', '一本合着的书。轻轻敲敲它', true);
  if (pet.away) return s('away', '它躲进书里了。敲敲书，把它叫回来', true);
  if (pet.stage === 'cocoon') return s('cocoon', '它在纸茧里睡着，过几个小时再来看');
  if (pet.asleep) return pet.lamp ? s('lamp', '它开着灯睡着了，帮它把台灯关上', true) : s('asleep', '它睡着了');
  if (pet.sick) return s('sick', '它不太舒服，泡杯热茶给它', true);
  if (pet.full < 25) return s('hungry', '它饿了', true);
  if (pet.crumbs >= 3) return s('dirty', '桌上都是书渣，该打扫了', true);
  if (pet.energy < 25) return s('sleepy', '它困了，关灯让它睡吧', true);
  if (pet.mood < 30) return s('bored', '它有点闷，陪它玩一会儿', true);
  if (pet.mood >= 70 && pet.full >= 50) return s('', '它很开心');
  return s('', '它挺好的');
}
export function titleOf(pet) {
  if (pet.stage === 'adult') return (FORMS[pet.form] || FORMS.scholar).zh;
  return STAGE_ZH[pet.stage];
}
/* every form this player has met: the ones in the album and the one on the desk */
export function seenForms(pet) {
  const seen = new Set(pet.album.map(a => a.form));
  if (pet.stage === 'adult') seen.add(pet.form);
  return [...seen];
}

/* Accept a save from outside only in this exact shape. */
export function normalize(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || raw.v !== PET_V || !STAGES.includes(raw.stage)) return null;
  const n = (v, lo, hi, d = lo) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  const times = list => (Array.isArray(list) ? list.map(Number).filter(Number.isFinite).slice(-8) : []);
  const pet = newPet(now);
  Object.assign(pet, {
    rev: Math.floor(n(raw.rev, 0, 1e9)), t: n(raw.t, 0, now + 5 * MIN, now), created: n(raw.created, 0, now + 5 * MIN, now), born: n(raw.born, 0, now + 5 * MIN, 0),
    name: String(raw.name || '').replace(/[<>&"']/g, '').slice(0, 8), stage: raw.stage, form: raw.stage === 'adult' ? (FORMS[raw.form] ? raw.form : 'scholar') : '',
    warm: Math.floor(n(raw.warm, 0, T.hatchTaps)), age: n(raw.age, 0, 1e7), full: n(raw.full, 0, 100), mood: n(raw.mood, 0, 100), energy: n(raw.energy, 0, 100),
    crumbs: Math.floor(n(raw.crumbs, 0, T.maxCrumbs)), crumbT: n(raw.crumbT, 0, 1e4),
    asleep: !!raw.asleep, lamp: raw.lamp !== false, sick: !!raw.sick, away: !!raw.away, calls: Math.floor(n(raw.calls, 0, T.callTaps)),
    starve: n(raw.starve, 0, 1e6), dirty: n(raw.dirty, 0, 1e6), sickT: n(raw.sickT, 0, 1e6), misery: n(raw.misery, 0, 1e6),
    know: n(raw.know, 0, 1e5), music: n(raw.music, 0, 1e5), careSum: n(raw.careSum, 0, 1e10), careN: n(raw.careN, 0, 1e8), neglect: Math.floor(n(raw.neglect, 0, 1e4)),
    snacks: times(raw.snacks), strokes: times(raw.strokes), best: Math.floor(n(raw.best, 0, 999)),
    gifts: Array.isArray(raw.gifts) ? raw.gifts.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(-300) : [],
    album: Array.isArray(raw.album) ? raw.album.filter(a => a && FORMS[a.form]).map(a => ({ form: a.form, name: String(a.name || '').replace(/[<>&"']/g, '').slice(0, 8), days: Math.floor(n(a.days, 1, 9999, 1)), at: n(a.at, 0, now + 5 * MIN, now) })).slice(-50) : [],
  });
  if (raw.adultAt != null) pet.adultAt = n(raw.adultAt, 0, 1e7);
  return pet;
}
