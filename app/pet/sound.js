/* =========================================================
   书虫 · sound
   A little piezo buzzer, made with Web Audio: square-wave beeps
   and nothing else. No audio files. Phones only allow sound after
   a touch, so unlock() is called from the first tap.
   ========================================================= */
const KEY = 'sv.pet.mute';
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }

export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* private mode */ }
}
export function unlock() {
  if (muted) return;
  try {
    if (!ctx) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return; ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

/* one beep: freq in Hz, at seconds from now, for dur seconds */
function beep(freq, at = 0, dur = 0.08, vol = 0.05, type = 'square', slideTo = 0) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.setValueAtTime(vol, t + Math.max(0.006, dur - 0.02));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const tune = (notes, step = 0.09, dur = 0.08, vol = 0.05) => notes.forEach((f, i) => { if (f) beep(f, i * step, dur, vol); });

/* a pentatonic scale: any run of these sounds like a tune */
export const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

export const sfx = {
  key: () => beep(1568, 0, 0.03, 0.035),
  ok: () => tune([1046.5, 1318.5], 0.07, 0.06),
  no: () => tune([196, 0, 196], 0.07, 0.07, 0.045),
  knock: () => beep(180, 0, 0.05, 0.06, 'square', 120),
  bite: () => beep(740, 0, 0.04, 0.045, 'square', 520),
  yum: () => tune([783.99, 1046.5, 1318.5], 0.08),
  heart: () => tune([1318.5, 1568], 0.06, 0.05, 0.04),
  page: () => beep(2093, 0, 0.02, 0.03),
  sweep: () => beep(300, 0, 0.06, 0.03, 'sawtooth', 900),
  off: () => tune([880, 659.25, 523.25], 0.1, 0.09, 0.04),
  on: () => tune([523.25, 659.25, 880], 0.08, 0.07, 0.04),
  sip: () => beep(440, 0, 0.07, 0.04, 'square', 660),
  well: () => tune([659.25, 783.99, 1046.5, 1318.5], 0.09),
  hatch: () => tune([523.25, 659.25, 783.99, 1046.5, 0, 1046.5, 1318.5, 1568], 0.1, 0.09),
  grow: () => tune([392, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5, 1318.5, 1568], 0.11, 0.1),
  gift: () => tune([1046.5, 1318.5, 1568, 2093], 0.07),
  fly: () => tune([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], 0.12, 0.11, 0.04),
  drop: () => beep(160, 0, 0.08, 0.06, 'square', 90),
  alert: () => tune([1568, 0, 1568, 0, 1568], 0.09, 0.07, 0.04),
  count: last => beep(last ? 1046.5 : 523.25, 0, last ? 0.2 : 0.09, 0.05),
  note: i => beep(SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length], 0, 0.14, 0.06),
  miss: () => beep(147, 0, 0.12, 0.05, 'square', 110),
  result: n => tune(n >= 15 ? [783.99, 1046.5, 1318.5, 1568, 0, 1568, 2093] : n >= 8 ? [659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 523.25], 0.1, 0.09),
};
