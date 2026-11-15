/* Smoke test for shared/core.js against the acceptance cases of the AI spec v0.3 (section 13),
   adapted to zone booking. Runs the same code the server and the browser's local mode run. */
import assert from 'node:assert/strict';
import { handle, seed, memberCode, checkinCode, methodNames, DEMO_CODE, DEMO_PIN } from '../shared/core.js';
import { newPet, advance, act, statusOf, careOf, seenForms, normalize as normalizePet, TUNING } from '../shared/pet.js';

const at = hhmm => Date.parse(`2026-11-07T${hhmm}:00+08:00`);
let NOW = at('14:00');
const db = seed(NOW);
const call = (token, method, args = {}) => handle(db, { token, method, args, now: NOW }).result;
const fails = (fn, test) => assert.throws(fn, e => (test instanceof RegExp ? test.test(e.message) || test.test(e.rule || '') : e.rule === test));
const login = phone => call(null, 'auth.login', { phone, code: DEMO_CODE }).token;
const staff = call(null, 'admin.login', { staffId: 'st1', pin: DEMO_PIN }).token;
const reception = call(null, 'admin.login', { staffId: 'st2', pin: DEMO_PIN }).token;
const tonight = db.sessions.find(s => s.date === '2026-11-07').id;
const ran = [];
const ok = id => ran.push(id);

// identities (C02, C03) and the first-unlock animation (B10)
const lin = login('13800000007');
assert.equal(call(lin, 'me').identity, 'member_active');
assert.equal(call(lin, 'me').play_unlock, false);
assert.equal(call(login('13900000021'), 'me').identity, 'applicant');
assert.equal(call(login('13800000015'), 'me').identity, 'member_expired');
assert.equal(call(login('13900000011'), 'me').identity, 'invitee');
assert.equal(call(null, 'me').identity, 'guest');
ok('C02'); ok('C03');

// A04: windows differ (7 vs 3 days)
const guest = login('13700000001');
assert.equal(call(lin, 'sessions.window').days, 7);
assert.equal(call(guest, 'sessions.window').days, 3);
ok('A04');

// B09 / A06: the reserved round booths are sealed for non-members until 19:00, open to members
let map = call(guest, 'session.map', { session_id: tonight });
assert.equal(map.states.B05.state, 'reserved_sealed');
assert.equal(call(lin, 'session.map', { session_id: tonight }).states.B05.state, 'reserved_open');
fails(() => call(guest, 'booking.quote', { session_id: tonight, zone: 'round', party_size: 6 }), /只剩|订满/);
ok('B09');

// C04: L0 gets the teaser of L1 content, never the body; L2/L3 don't show at all
const teaser = call(guest, 'content.get', { key: 'memo' });
assert.equal(teaser.locked, true);
assert.equal('body' in teaser, false);
fails(() => call(guest, 'content.get', { key: 'archive' }), /找不到/);
assert.ok(call(lin, 'content.get', { key: 'memo' }).body.visits.length);
ok('C04');

// C06: a non-member in the day sees no check-in; C05: a member checks in and unlocks the shelf
fails(() => call(guest, 'checkin.submit', { code: 'XXXX' }), /会员/);
assert.equal(call(lin, 'content.get', { key: 'shelf' }).locked, true);
fails(() => call(lin, 'checkin.submit', { code: 'ZZZZ', companions: 1 }), 'R-DAY-04');
const ci = call(lin, 'checkin.submit', { code: checkinCode(db, '2026-11-07'), companions: 2 });
assert.ok(ci.unlocked.includes('shelf'));
assert.equal(call(lin, 'checkin.submit', { code: checkinCode(db, '2026-11-07') }).repeat, true);
assert.equal(call(lin, 'content.get', { key: 'shelf' }).locked, false);
call(lin, 'shelf.borrow', { id: 'k1' });
fails(() => call(lin, 'shelf.borrow', { id: 'k2' }), /借过/);
ok('C06'); ok('C05');

// C08 / A18: meetings must end by 19:00
fails(() => call(lin, 'meeting.create', { date: '2026-11-08', start: '17:00', end: '19:30', party_size: 6 }), 'R-DAY-06');
const meet = call(lin, 'meeting.create', { date: '2026-11-08', start: '15:00', end: '17:00', party_size: 9, needs: '九个人' });
call(staff, 'admin.meeting.respond', { id: meet.id, action: 'counter', start: '15:30', end: '17:30', note: '晚半小时' });
assert.equal(call(lin, 'meeting.respond', { id: meet.id, accept: true }).start, '15:30');
ok('C08'); ok('A18');

// B08: member seats are instant with no payment; a booth goes to the 30-minute manual queue after payment
const seats = call(lin, 'booking.create', { session_id: tonight, zone: 'bar', party_size: 2 });
assert.equal(seats.status, 'confirmed');
assert.equal(seats.price.total_due, 0);
const tix = call(guest, 'booking.create', { session_id: tonight, zone: 'tables', party_size: 2 });
assert.equal(tix.status, 'pending_payment');
assert.equal(tix.price.total_due, 2 * db.config.ticketPrice);
assert.equal(call(guest, 'booking.pay', { id: tix.id }).status, 'confirmed');
ok('B08');

// C12 / A13: one pending payment at a time; four tickets per person per show
const guest2 = login('13700000088');
const b1 = call(guest2, 'booking.create', { session_id: tonight, zone: 'wall', party_size: 4 });
fails(() => call(guest2, 'booking.create', { session_id: tonight, zone: 'pairs', party_size: 2 }), 'R-BK-07');
call(guest2, 'booking.abandon', { id: b1.id });
fails(() => call(guest, 'booking.create', { session_id: tonight, zone: 'pairs', party_size: 3 }), 'R-TK-02');
ok('C12'); ok('A13');

// A08 / A10: a paid booth waits for the store ("尽调中"), a rejection refunds in full
const booth = call(guest2, 'booking.create', { session_id: tonight, zone: 'wall', party_size: 5 });
const paid = call(guest2, 'booking.pay', { id: booth.id });
assert.equal(paid.status, 'pending_confirm');
assert.equal(paid.label.deal, '尽调中');
const rejected = call(staff, 'admin.booking.reject', { id: booth.id, reason: '包场', suggestion: '改订沙龙', suggestion_zone: 'lounge' });
assert.equal(rejected.refund.status, 'processing');
NOW += 30e3;
assert.equal(call(guest2, 'booking.get', { id: booth.id }).refund.status, 'succeeded');
ok('A08'); ok('A10');

// A05 / B03 / B04: a member for 10 people gets two wall booths (manual); an extra booth needs a note
const zhou = login('13800000001');
const q10 = call(zhou, 'booking.quote', { session_id: tonight, zone: 'wall', party_size: 10 });
assert.equal(q10.units, 2);
assert.equal(q10.confirm_mode, 'manual');
fails(() => call(zhou, 'booking.quote', { session_id: tonight, zone: 'wall', party_size: 4, extra: 1 }), 'R-BK-08');
assert.ok(call(zhou, 'booking.quote', { session_id: tonight, zone: 'wall', party_size: 4, extra: 1, explanation: '晚点还有人来' }).manual_reasons.includes('over_required'));
fails(() => call(zhou, 'booking.quote', { session_id: tonight, zone: 'round', party_size: 12 }), 'R-BK-10');
ok('A05'); ok('B03'); ok('B04');

// B01 / A12: two people go for the last round booth; only one gets to pay
call(lin, 'booking.create', { session_id: tonight, zone: 'round', party_size: 6 });
const yu = login('13800000002');
const last = call(yu, 'booking.create', { session_id: tonight, zone: 'round', party_size: 6 });
assert.equal(last.status, 'pending_payment');
fails(() => call(login('13800000003'), 'booking.create', { session_id: tonight, zone: 'round', party_size: 4 }), /订满|只剩/);
ok('B01'); ok('A12');

// B05 / A07: the lock lapses after ten minutes and the booth comes back; B06: a late payment after someone else took it is refunded
NOW += 11 * 60e3;
assert.equal(call(yu, 'booking.get', { id: last.id }).status, 'payment_expired');
const grab = call(login('13800000004'), 'booking.create', { session_id: tonight, zone: 'round', party_size: 5 });
assert.equal(grab.status, 'pending_payment');
call(login('13800000005'), 'booking.create', { session_id: tonight, zone: 'round', party_size: 5 }); // both round booths are now held by others
const late = call(yu, 'booking.pay', { id: last.id });
assert.equal(late.status, 'cancelled');
assert.equal(late.refund.status, 'processing');
ok('B05'); ok('A07'); ok('B06');

// A09 / A11: nobody confirms within 30 minutes → closed and refunded; a late confirm is refused
const mBooth = call(guest, 'booking.create', { session_id: tonight, zone: 'lounge', party_size: 4 });
call(guest, 'booking.pay', { id: mBooth.id });
NOW += 31 * 60e3;
assert.equal(call(guest, 'booking.get', { id: mBooth.id }).status, 'confirm_timeout_closed');
fails(() => call(staff, 'admin.booking.confirm', { id: mBooth.id }), 'INV-05');
ok('A09'); ok('A11');

// A06 / C07: at 19:00 the free reserved booth opens to non-members; one held by a pending member order stays held
NOW = at('18:50');
const ye = login('13800000006');
const held = call(ye, 'booking.create', { session_id: tonight, zone: 'round', party_size: 6 });
call(ye, 'booking.pay', { id: held.id });
map = call(guest, 'session.map', { session_id: tonight });
assert.deepEqual([map.states.B05.state, map.states.B06.state].sort(), ['booked', 'reserved_sealed']);
assert.equal(call(guest, 'me').mode, 'day');
NOW = at('19:05');
map = call(guest, 'session.map', { session_id: tonight });
assert.deepEqual([map.states.B05.state, map.states.B06.state].sort(), ['available', 'booked']);
assert.equal(call(guest, 'me').mode, 'night');
ok('A06'); ok('C07'); ok('B11');

// store confirms a pending booth and assigns a table; verify at the door; A14 repeat; A15 late release; A16 deposit; A17 drink
const fresh = call(guest2, 'booking.create', { session_id: tonight, zone: 'wall', party_size: 4 });
call(guest2, 'booking.pay', { id: fresh.id });
const pend = db.bookings.find(b => b.id === fresh.id);
const own = pend.lines[0].code;
const free = ['B02', 'B03', 'B04'].find(c => c !== own && !db.occupancies.some(o => !o.released_at && o.session_id === tonight && o.resource === c)) || own;
const conf = call(staff, 'admin.booking.confirm', { id: pend.id, codes: [free] });
assert.equal(conf.status, 'confirmed');
assert.equal(conf.lines[0].code, free);
const v1 = call(reception, 'admin.verify', { code: conf.code });
assert.equal(v1.booking.status, 'fulfilled');
assert.equal(call(reception, 'admin.verify', { code: conf.code }).repeat, true);
ok('A14');
const depo = db.bookings.find(b => b.status === 'confirmed' && b.zone === 'wall' && b.date === '2026-11-07' && b.user_id !== pend.user_id);
fails(() => call(staff, 'admin.booking.release', { id: depo.id }), 'R-BK-31');
NOW = at('21:40');
const rel = call(staff, 'admin.booking.release', { id: depo.id });
assert.equal(rel.table_released, true);
assert.equal(rel.deposit.state, 'valid_tonight_table_released');
call(staff, 'admin.deposit.redeem', { booking_id: depo.id, amount: rel.deposit.paid / 100, note: '整单' });
fails(() => call(staff, 'admin.deposit.redeem', { booking_id: depo.id, amount: 1 }), 'R-VER-03');
ok('A15'); ok('A16');
const tixV = call(reception, 'admin.verify', { code: tix.code });
call(reception, 'admin.ticket.drink', { booking_id: tixV.booking.id });
fails(() => call(reception, 'admin.ticket.drink', { booking_id: tixV.booking.id }), 'R-TK-05');
ok('A17');

// R-BK-05: after 21:30 tonight is walk-in only
fails(() => call(lin, 'booking.quote', { session_id: tonight, zone: 'pairs', party_size: 2 }), 'R-BK-05');

// the member's rotating card code identifies them at the door (R-MEM-05)
const u7 = db.users.find(u => u.phone === '13800000007');
assert.equal(call(reception, 'admin.verify', { code: memberCode(u7.secret, NOW + db.clock.offsetMs) }).member.member_no, '0007');

// membership: A01 invite claim is idempotent; application → approve → pay; renew; B10 unlock animation once
const xn = login('13900000011');
const claim = call(xn, 'invite.claim', { token: 'SV-7K2QXA' });
assert.equal(call(xn, 'invite.claim', { token: 'SV-7K2QXA' }).repeat, true);
assert.equal(db.memberships.filter(m => m.user_id === db.users.find(u => u.phone === '13900000011').id).length, 1);
assert.equal(call(xn, 'me').play_unlock, true);
call(xn, 'unlock.seen');
assert.equal(call(xn, 'me').play_unlock, false);
assert.ok(claim.member_no);
ok('A01'); ok('B10');
const app = db.applications.find(a => a.profile.phone === '13900000021');
fails(() => call(reception, 'admin.application.review', { id: app.id, action: 'approve' }), /店长/);
fails(() => call(login('13900000021'), 'application.pay'), /审核/);
call(staff, 'admin.application.review', { id: app.id, action: 'approve' });
assert.equal(call(login('13900000021'), 'application.pay').ok, true);
assert.equal(call(login('13900000021'), 'me').identity, 'member_active');
ok('A02'); ok('A03');
const exp = login('13800000015');
call(exp, 'membership.renew');
assert.equal(call(exp, 'me').identity, 'member_active');

// C10: L3 grant and revoke, with an audit trail
call(staff, 'admin.unlock.grant', { user_id: u7.id, key: 'archive' });
assert.equal(call(lin, 'content.get', { key: 'archive' }).locked, false);
const ul = db.unlocks.find(x => x.user_id === u7.id && x.key === 'archive');
call(staff, 'admin.unlock.revoke', { id: ul.id });
fails(() => call(lin, 'content.get', { key: 'archive' }), /找不到/);
assert.ok(db.audit.some(a => a.action === 'unlock.grant') && db.audit.some(a => a.action === 'unlock.revoke'));
ok('C10');

// easter eggs: the invisible ink only shows after 23:00
fails(() => call(lin, 'egg.trigger', { key: 'ink' }), /23:00/);
NOW = at('23:10');
assert.equal(call(lin, 'egg.trigger', { key: 'ink' }).fresh, true);
assert.equal(call(lin, 'egg.trigger', { key: 'hidden-room' }).fresh, true);

// A19: events don't overbook (no waitlist)
const ev = db.events.find(e => e.id === 'ev-read');
ev.capacity = 3;
call(lin, 'event.register', { id: 'ev-read' });
fails(() => call(zhou, 'event.register', { id: 'ev-read' }) && call(login('13800000005'), 'event.register', { id: 'ev-read' }), 'R-EV-04');
fails(() => call(guest, 'event.register', { id: 'ev-agent' }), /会员/);
ok('A19');

// C13: with ticket sales off, non-members can still book booths, not seats
NOW = at('14:00') + 86400e3;
const tomorrow = db.sessions.find(s => s.date === '2026-11-08').id;
db.config.ticketSalesEnabled = false;
fails(() => call(guest, 'booking.quote', { session_id: tomorrow, zone: 'pairs', party_size: 2 }), 'R-TK-07');
assert.ok(call(guest, 'booking.quote', { session_id: tomorrow, zone: 'wall', party_size: 4 }).price.total_due > 0);
ok('C13');

// rules the owner hasn't decided stay switched off
fails(() => call(guest, 'booking.withdraw', { id: 'x' }), 'R-PAY-08');
fails(() => call(staff, 'admin.config.set', { key: 'userWithdrawEnabled', value: true }), /拍板/);

// demo clock
assert.equal(call(null, 'demo.clock', { action: 'set', hhmm: '19:01' }).mode, 'night');
call(null, 'demo.clock', { action: 'real' });


/* ---------- the pet game: shared/pet.js ---------- */
{
  const HOUR = 3600e3;
  const t0 = at('14:00') + 20 * 86400e3;
  const born = () => { const p = newPet(t0); for (let i = 0; i < TUNING.hatchTaps; i++) act(p, 'warm', {}, t0); return p; };
  /* look after a pet for some hours: feed, sweep, lights out when it is tired */
  const tend = (p, from, hours, { read = 0, play = 0 } = {}) => {
    for (let h = 1; h <= hours; h++) {
      const now = from + h * HOUR;
      advance(p, now);
      if (p.stage === 'cocoon' || p.stage === 'adult' && hours > 200) continue;
      if (p.asleep) { if (p.lamp) act(p, 'lamp', {}, now); continue; }
      if (p.full < 60) act(p, 'feed', { food: 'page' }, now);
      if (p.crumbs) act(p, 'clean', {}, now);
      if (p.mood < 60) { for (let i = 0; i < 3; i++) act(p, 'stroke', {}, now); act(p, 'feed', { food: 'cookie' }, now); }
      if (p.energy < 30) { act(p, 'lamp', {}, now); continue; }
      if (read && h % read === 0) act(p, 'read', {}, now);
      if (play && h % play === 0) act(p, 'play', { score: 12 }, now);
    }
    return from + hours * HOUR;
  };

  // P01: a closed book opens after a few taps; nothing else works before that
  let p = newPet(t0);
  assert.equal(act(p, 'feed', { food: 'page' }, t0).reason, 'na');
  for (let i = 0; i < TUNING.hatchTaps - 1; i++) assert.equal(act(p, 'warm', {}, t0).hatched, false);
  assert.equal(act(p, 'warm', {}, t0).hatched, true);
  assert.equal(p.stage, 'baby');
  act(p, 'name', { name: '  小 夜 <b>  ' }, t0);
  assert.equal(p.name, '小 夜 <b>'.slice(0, 8));
  ok('P01');

  // P02: needs run down with time, even while the app is closed; crumbs pile up
  p = born();
  const before = { ...p };
  const gone = advance(p, t0 + 6 * HOUR);
  assert.equal(gone.minutes, 360);
  assert.ok(p.full < before.full - 40 && p.mood < before.mood && p.energy < before.energy);
  assert.equal(p.crumbs, 2);
  assert.equal(statusOf(p).need, 'hungry');
  assert.equal(advance(p, t0).minutes, 0); // a clock that goes back changes nothing
  ok('P02');

  // P03: meals and snacks
  assert.equal(act(p, 'feed', { food: 'page' }, p.t).ok, true);
  assert.equal(act(p, 'feed', { food: 'page' }, p.t).ok, true);
  assert.equal(act(p, 'feed', { food: 'page' }, p.t).ok, true);
  assert.equal(act(p, 'feed', { food: 'page' }, p.t).reason, 'full');
  p.full = 40;
  for (let i = 0; i < TUNING.snackLimit; i++) assert.equal(act(p, 'feed', { food: 'cookie' }, p.t).ok, true);
  assert.equal(act(p, 'feed', { food: 'cookie' }, p.t).reason, 'snack_limit');
  assert.equal(act(p, 'clean', {}, p.t).swept, 2);
  assert.equal(act(p, 'clean', {}, p.t).reason, 'clean');
  ok('P03');

  // P04: lights out when it is tired; it wakes by itself and the lamp comes back on
  p = born();
  assert.equal(act(p, 'lamp', {}, t0).reason, 'not_sleepy');
  p.energy = 20;
  assert.equal(act(p, 'lamp', {}, t0).asleep, true);
  assert.equal(act(p, 'feed', { food: 'page' }, t0).reason, 'asleep');
  const night = advance(p, t0 + 7 * HOUR);
  assert.ok(night.woke && !p.asleep && p.lamp && p.energy > 80);
  p.energy = 1; p.full = 100;
  advance(p, p.t + 30 * 60e3); // left alone, it nods off with the light on
  assert.ok(p.asleep && p.lamp);
  assert.equal(statusOf(p).need, 'lamp');
  ok('P04');

  // P05: left hungry for hours it falls ill; hot tea cures it
  p = born();
  const ill = advance(p, t0 + 20 * HOUR);
  assert.ok(ill.sick && p.sick && p.neglect === 1);
  assert.equal(act(p, 'read', {}, p.t).reason, p.asleep ? 'asleep' : 'sick');
  assert.equal(act(p, 'tea', {}, p.t).ok, true);
  assert.equal(act(p, 'tea', {}, p.t).reason, 'not_sick');
  ok('P05');

  // P06: neglected for days it hides in its book, and comes back when called
  p = born();
  const hid = advance(p, t0 + 4 * 86400e3);
  assert.ok(hid.away && p.away);
  const ageAway = p.age;
  advance(p, t0 + 9 * 86400e3);
  assert.equal(p.age, ageAway); // time stops for it
  assert.equal(act(p, 'feed', { food: 'page' }, p.t).reason, 'away');
  for (let i = 0; i < TUNING.callTaps - 1; i++) assert.equal(act(p, 'call', {}, p.t).back, false);
  assert.equal(act(p, 'call', {}, p.t).back, true);
  assert.ok(!p.away && p.full === 50);
  ok('P06');

  // P07: it grows — baby, young, cocoon, moth — and how it was raised decides which moth
  const raise = opts => { const q = born(); let now = t0; now = tend(q, now, 23, opts); assert.equal(q.stage, 'baby'); now = tend(q, now, 2, opts); assert.equal(q.stage, 'teen'); now = tend(q, now, 48, opts); assert.equal(q.stage, 'cocoon'); tend(q, now, 6, opts); assert.equal(q.stage, 'adult'); return q; };
  assert.equal(raise({ read: 4 }).form, 'scholar');
  assert.equal(raise({ play: 4 }).form, 'musician');
  const both = raise({ read: 5, play: 7 });
  assert.equal(both.form, 'luna', `care ${careOf(both).toFixed(1)} know ${both.know} music ${both.music}`);
  const left = born();
  advance(left, t0 + 30 * HOUR); act(left, 'tea', {}, left.t); act(left, 'feed', { food: 'page' }, left.t);
  advance(left, left.t + 30 * HOUR); act(left, 'tea', {}, left.t); act(left, 'feed', { food: 'page' }, left.t); act(left, 'feed', { food: 'page' }, left.t);
  for (let i = 0; i < 40 && left.stage !== 'adult'; i++) { advance(left, left.t + HOUR); if (left.away) { for (let k = 0; k < TUNING.callTaps; k++) act(left, 'call', {}, left.t); } if (!left.asleep && left.full < 30) act(left, 'feed', { food: 'page' }, left.t); }
  assert.equal(left.stage, 'adult');
  assert.equal(left.form, 'dusty');
  ok('P07');

  // P08: gifts from the club, the mini-game, and letting a grown moth go
  assert.equal(act(both, 'gift', { id: 'bk1', kind: 'ticket' }, both.t).kind, 'ticket');
  assert.equal(act(both, 'gift', { id: 'bk1', kind: 'ticket' }, both.t).reason, 'claimed');
  const played = act(both, 'play', { score: 23 }, both.t);
  assert.ok(played.record && played.music === 5 && both.best === 23);
  assert.deepEqual(seenForms(both), ['luna']);
  both.name = '月月';
  const gone2 = act(both, 'release', {}, both.t);
  assert.equal(gone2.released.form, 'luna');
  assert.ok(both.stage === 'book' && both.album.length === 1 && both.best === 23 && both.gifts.includes('bk1'));
  assert.equal(act(born(), 'release', {}, t0).reason, 'na');
  ok('P08');

  // P09: only a well-formed save is accepted
  assert.equal(normalizePet(null), null);
  assert.equal(normalizePet({ v: 1, stage: 'dragon' }), null);
  const odd = normalizePet({ ...born(), full: 9999, mood: 'x', name: '<script>alert(1)</script>', gifts: [1, 'ok', {}], album: [{ form: 'nope' }, { form: 'luna', name: 'A', days: 3, at: t0 }], extra: 'dropped' }, t0);
  assert.ok(odd.full === 100 && odd.mood === 0 && !/[<>]/.test(odd.name) && odd.name.length <= 8 && odd.gifts.length === 1 && odd.album.length === 1 && !('extra' in odd));
  ok('P09');

  // P10: the save lives with the account; a stale copy does not overwrite a newer one
  NOW = at('15:00') + 86400e3;
  const seeded = call(lin, 'pet.load');
  assert.ok(seeded && seeded.name === '墨墨' && seeded.stage === 'teen');
  assert.equal(call(guest, 'pet.load'), null);
  fails(() => call(guest, 'pet.save', { pet: { v: 9 } }), /存档/);
  const mine = newPet(NOW); mine.rev = 3;
  assert.equal(call(guest, 'pet.save', { pet: mine }).ok, true);
  assert.equal(call(guest, 'pet.load').rev, 3);
  const stale = call(guest, 'pet.save', { pet: { ...mine, rev: 2, name: '旧的' } });
  assert.ok(stale.ok === false && stale.pet.rev === 3);
  fails(() => call(null, 'pet.load'), /登录/);
  ok('P10');
}

console.log(`ok · ${methodNames().length} methods · ${ran.length} acceptance cases: ${ran.join(' ')}`);
