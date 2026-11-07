/* Smoke test for shared/core.js: runs the main member, applicant and staff flows
   against a fresh seed, the same way both the server and the local mode do. */
import assert from 'node:assert/strict';
import { handle, seed, entryCode, methodNames, OPENING, DEMO_CODE, DEMO_PIN } from '../shared/core.js';

const db = seed(Date.parse('2026-11-07T10:00:00+08:00'));
let now = Date.parse('2026-11-07T10:00:00+08:00');
const call = (token, method, args = {}) => handle(db, { token, method, args, now }).result;
const fails = (fn, re) => assert.throws(fn, e => re.test(e.message));

// member signs in, sees the lobby
const { token: mt } = call(null, 'auth.login', { phone: '138 0000 0007', code: DEMO_CODE });
const lobby = call(mt, 'lobby');
assert.equal(lobby.me.no, '0007');
assert.equal(lobby.floors[0].state.key, 'soon');
assert.ok(lobby.upcoming.length >= 2, 'persona has upcoming items');

// programme: the closed-door session is full, so a new RSVP lands on the waitlist
const events = call(mt, 'events.list');
const full = events.find(e => e.id === 'e04');
assert.equal(full.left, 0);
assert.equal(call(mt, 'events.rsvp', { eventId: 'e04' }).mine, 'waitlist');
// someone going cancels → the earliest on the waitlist is promoted, the seat count holds
const goer = db.rsvps.find(r => r.eventId === 'e04' && r.status === 'going');
const { token: gt } = call(null, 'auth.login', { phone: db.members.find(m => m.id === goer.memberId).phone, code: DEMO_CODE });
const before = call(mt, 'events.list').find(e => e.id === 'e04');
call(gt, 'events.cancel', { eventId: 'e04' });
const after = call(mt, 'events.list').find(e => e.id === 'e04');
assert.equal(after.taken, before.taken);
assert.equal(after.waitlist, before.waitlist - 1);
assert.equal(after.mine, 'waitlist');

// reservations: window starts at the opening day
const av = call(mt, 'reserve.availability', {});
assert.equal(av.date, OPENING);
const r = call(mt, 'reserve.create', { date: OPENING, session: 'day', zoneId: 'fireside', party: 3 });
assert.equal(r.party, 1, 'day session is members-only, party forced to 1');
fails(() => call(mt, 'reserve.create', { date: OPENING, session: 'day', zoneId: 'long', party: 1 }), /已经有一个预订/);
call(mt, 'reserve.cancel', { id: r.id });

// books: hold limit
const shelf = call(mt, 'books.list').filter(b => b.status === 'shelf');
call(mt, 'books.hold', { id: shelf[0].id });
call(mt, 'books.hold', { id: shelf[1].id });
fails(() => call(mt, 'books.hold', { id: shelf[2].id }), /最多/);

// referral → applicant completes with invite → staff walks the pipeline → member
const nom = call(mt, 'referral.nominate', { name: '测试同学', phone: '13700000001', venture: '测试公司 · 创始人', sector: 'AI' });
assert.match(nom.invite, /^SV-[A-Z0-9]{4}$/);
assert.equal(call(null, 'invite.check', { code: nom.invite }).lead, '林知远');
const applied = call(null, 'apply', { invite: nom.invite, name: '测试同学', venture: '测试公司 · 创始人', sector: 'AI', base: '杭州', phone: '13700000001', thesis: '测试' });
const at = applied.token;
assert.equal(call(at, 'application.status').application.step, 1);
const { token: st } = call(null, 'admin.login', { staffId: 's3', pin: DEMO_PIN });
const id = applied.application.id;
call(st, 'admin.application.move', { id, stage: 'diligence' });
fails(() => call(st, 'admin.application.move', { id, stage: 'initiation' }), /入会仪式的时间/);
call(st, 'admin.application.move', { id, stage: 'initiation', initiationAt: '2026-12-14T16:00:00+08:00' });
call(st, 'admin.application.move', { id, stage: 'welcomed' });
const status = call(at, 'application.status');
assert.equal(status.application.stage, 'welcomed');
assert.equal(status.application.memberNo, '0025');
call(at, 'auth.upgrade');
assert.equal(call(at, 'me').no, '0025');

// door: the six-digit code on the key checks a member in
const m7 = db.members.find(m => m.id === 'm07');
const res = call(st, 'admin.checkin', { code: entryCode(m7.secret, now) });
assert.equal(res.member.no, '0007');
fails(() => call(st, 'admin.checkin', { code: '000000' === entryCode(m7.secret, now) ? '111111' : '000000' }), /无效/);
assert.ok(call(mt, 'visits.mine').length >= 3);

// concierge round trip
const req = call(mt, 'concierge.request', { type: 'guest', text: '周五带一位朋友' });
call(st, 'admin.request.reply', { id: req.id, text: '好的，已登记。' });
assert.equal(call(mt, 'concierge.mine')[0].status, 'replied');
assert.ok(call(mt, 'notices.list').some(n => n.title.includes('回复了你')));

// overview + permissions
const ov = call(st, 'admin.overview');
assert.equal(ov.weekly.length, 12);
assert.equal(ov.sectors.reduce((s, x) => s + x.count, 0), ov.kpis.members);
fails(() => call(mt, 'admin.overview'), /没有权限/);
fails(() => call(null, 'lobby'), /请先登录/);

// every method is reachable by name
assert.ok(methodNames().length > 40);
// floor switch
call(st, 'admin.floor.update', { id: 'library', status: 'open', mode: 'night' });
assert.equal(call(mt, 'lobby').floors[0].state.key, 'night');
call(st, 'admin.reset');
assert.equal(db.members.length, 24);
console.log(`ok · ${methodNames().length} methods · flows: member, waitlist, reserve, books, referral→member, door, concierge, staff`);
