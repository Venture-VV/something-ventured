/* Smoke test for shared/core.js against the acceptance cases of the AI spec v0.3 (section 13),
   adapted to zone booking. Runs the same code the server and the browser's local mode run. */
import assert from 'node:assert/strict';
import { handle, seed, memberCode, checkinCode, methodNames, DEMO_CODE, DEMO_PIN } from '../shared/core.js';

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

console.log(`ok · ${methodNames().length} methods · ${ran.length} acceptance cases: ${ran.join(' ')}`);
