/* =========================================================
   Something Ventured · demo core
   One module, two homes: the Node server (server/server.js)
   and the browser's local demo mode (shared/api.js).
   It holds the data model, the seed data and every business rule,
   so both modes behave exactly the same.
   ========================================================= */

export const OPENING = '2026-12-15';
export const DEMO_CODE = '2026'; // SMS code accepted in the demo
export const DEMO_PIN = '1215';  // staff PIN in the demo
const H = 3600e3;
const D = 24 * H;

/* ---------- vocabulary ---------- */
export const SECTORS = [
  { id: 'AI', en: 'AI', zh: '人工智能' },
  { id: 'VC', en: 'VC', zh: '风险投资' },
  { id: 'Robotics', en: 'Robotics', zh: '机器人' },
  { id: 'Frontier', en: 'Other frontier', zh: '其他前沿' },
];
export const sectorOf = id => SECTORS.find(s => s.id === id) || SECTORS[3];
export const BASES = ['杭州', '上海', '深圳', '北京', '其他'];

/* Internal pipeline. `step` is where the applicant sits on the public path. */
export const STAGES = [
  { id: 'received', en: 'Received', zh: '新申请', step: 1 },
  { id: 'diligence', en: 'In diligence', zh: '尽调中', step: 1 },
  { id: 'initiation', en: 'Initiation', zh: '入会仪式', step: 2 },
  { id: 'welcomed', en: 'Welcomed', zh: '已入会', step: 3 },
  { id: 'declined', en: 'Declined', zh: '婉拒', step: -1 },
];
export const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];
export const PATH = [
  { en: 'Referral', zh: '推荐' },
  { en: 'Screening', zh: '筛选' },
  { en: 'Initiation', zh: '入会仪式' },
  { en: 'Welcome', zh: '欢迎' },
];

export const EVENT_TYPES = {
  'closed-door': { en: 'Closed-door session', zh: '闭门分享' },
  podcast: { en: 'Live taping', zh: '播客录制' },
  reading: { en: 'Reading room', zh: '读书会' },
  unplugged: { en: 'Unplugged', zh: '不插电' },
  supper: { en: 'Members’ supper', zh: '会员晚宴' },
  house: { en: 'House night', zh: '俱乐部之夜' },
};
export const COLORS = ['pink', 'powder', 'mint', 'mustard', 'lav', 'rasp'];

export const SESSIONS = {
  day: { id: 'day', en: 'Day · Members only', zh: '白天 · 会员时段', hours: '10:00 – 18:00', from: '10:00' },
  night: { id: 'night', en: 'Night · Open to all', zh: '夜晚 · 对外开放', hours: '18:00 – 01:00', from: '18:00' },
};

export const REQUEST_TYPES = {
  table: { en: 'A seat', zh: '订位协助' },
  guest: { en: 'Bringing a guest', zh: '携友到访' },
  room: { en: 'Private study', zh: '私人书房' },
  book: { en: 'Find a book', zh: '找一本书' },
  other: { en: 'Something else', zh: '其他' },
};

export const CITIES = [
  { id: 'HZ', en: 'Hangzhou', zh: '杭州', note: '12.15' },
  { id: 'SH', en: 'Shanghai', zh: '上海', note: 'Coming' },
  { id: 'SZ', en: 'Shenzhen', zh: '深圳', note: 'Coming' },
  { id: 'BJ', en: 'Beijing', zh: '北京', note: 'Coming' },
];

/* ---------- time: everything is shown in Hangzhou time (UTC+8) ---------- */
export function hz(t = Date.now()) {
  const d = new Date(+new Date(t) + 8 * H);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay(),
    date: d.toISOString().slice(0, 10),
  };
}
export const hzDate = t => hz(t).date;
export const atHz = (date, hhmm = '00:00') => new Date(`${date}T${hhmm}:00+08:00`).toISOString();
export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * D).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / D);
const iso = t => new Date(t).toISOString();

/* ---------- small utilities ---------- */
export function hash53(str, seed = 0) { // cyrb53: fast, well-mixed, not cryptographic
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/* The door code on a member's key: six digits that turn over every 30 s.
   Demo-grade (a production build would use TOTP with a server-held secret). */
export const CODE_STEP = 30e3;
export function entryCode(secret, t = Date.now(), offset = 0) {
  const n = Math.floor(t / CODE_STEP) + offset;
  return String(hash53(`${secret}:${n}`) % 1e6).padStart(6, '0');
}

const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';
export function rid(n = 10) {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, b => ALPHA[b % 36]).join('');
}
function inviteCode() {
  const set = 'ACDEFHJKMNPRTUVWXY34679';
  const a = new Uint8Array(4);
  globalThis.crypto.getRandomValues(a);
  return 'SV-' + Array.from(a, b => set[b % set.length]).join('');
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clean = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanText = (v, max = 600) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
export const normPhone = v => String(v ?? '').replace(/[\s-]/g, '').replace(/^\+?86/, '');
const byId = (list, id) => list.find(x => x.id === id);

export class ApiError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const fail = (message, code = 'bad_request', status = 400) => { throw new ApiError(code, message, status); };

/* ---------- floors ---------- */
const LIBRARY_ZONES = [
  { id: 'long', zh: '长桌阅览', en: 'The Long Table', capacity: 16, unit: 'seat', note: '中央长桌，十六盏绿罩台灯。' },
  { id: 'fireside', zh: '壁炉沙发', en: 'Fireside', capacity: 8, unit: 'seat', note: '壁炉两侧的对称沙发，适合两三人小叙。' },
  { id: 'listening', zh: '唱片角', en: 'Listening Corner', capacity: 6, unit: 'seat', note: '黑胶与耳机，靠近不插电小舞台。' },
  { id: 'study', zh: '小书房', en: 'Private Study', capacity: 2, unit: 'room', note: '两间可关门的小书房，最多四人。' },
];

/* What a floor is doing right now: planned / opening soon / day / night / closed. */
export function floorState(f, t = Date.now()) {
  const now = hz(t);
  if (f.status === 'planned') return { key: 'planned', en: 'Planned', zh: '规划中' };
  if (f.status === 'closed') return { key: 'closed', en: 'Closed today', zh: '今日休息' };
  if (f.status === 'preopening') {
    const days = Math.max(0, daysBetween(now.date, f.openingDate || OPENING));
    return { key: 'soon', en: 'Opening soon', zh: days ? `距开业 ${days} 天` : '今日开业', days };
  }
  let mode = f.mode && f.mode !== 'auto' ? f.mode : null;
  if (!mode) mode = now.h >= 10 && now.h < 18 ? 'day' : (now.h >= 18 || now.h < 1) ? 'night' : 'closed';
  if (mode === 'day') return { key: 'day', en: 'Day · Members only', zh: '白天 · 仅限会员' };
  if (mode === 'night') return { key: 'night', en: 'Night · Open to all', zh: '夜晚 · 对外开放' };
  return { key: 'closed', en: 'Closed until 10:00', zh: '休息中 · 10:00 开门' };
}

function bookingWindow(db, t) {
  const lib = byId(db.floors, 'library');
  const today = hzDate(t);
  const start = lib.openingDate && lib.openingDate > today ? lib.openingDate : today;
  return Array.from({ length: 14 }, (_, i) => addDays(start, i));
}

/* =========================================================
   Seed
   ========================================================= */
const STAFF = [
  { id: 's1', name: '沈岚', en: 'Shen Lan', role: '会员服务', roleEn: 'Host', host: true },
  { id: 's2', name: '何夕', en: 'He Xi', role: '会员服务', roleEn: 'Host', host: true },
  { id: 's3', name: '周行', en: 'Zhou Xing', role: '店长', roleEn: 'House Manager', host: false },
  { id: 's4', name: '陆一苇', en: 'Lu Yiwei', role: '图书管理员', roleEn: 'Librarian', host: false },
];

// name, english, venture, sector, base, days since joining
const MEMBERS = [
  ['周以宁', 'Zhou Yining', '格物资本 · 管理合伙人', 'VC', '杭州', 72],
  ['陈牧之', 'Chen Muzhi', '灵枢智能 · 创始人', 'AI', '杭州', 70],
  ['许嘉禾', 'Xu Jiahe', '北辰创投 · 合伙人', 'VC', '上海', 68],
  ['苏砚', 'Su Yan', '零度具身 · 联合创始人', 'Robotics', '杭州', 66],
  ['顾言', 'Gu Yan', '微光模型 · 首席科学家', 'AI', '北京', 63],
  ['叶闻舟', 'Ye Wenzhou', '千帆机器人 · CTO', 'Robotics', '深圳', 61],
  ['林知远', 'Lin Zhiyuan', '远望机器人 · 创始人', 'Robotics', '杭州', 60],
  ['江念', 'Jiang Nian', '镶嵌资本 · 投资总监', 'VC', '上海', 55],
  ['宋清和', 'Song Qinghe', '栖木智能 · 产品负责人', 'AI', '杭州', 52],
  ['陆星河', 'Lu Xinghe', '星河动力 · 创始人', 'Frontier', '杭州', 49],
  ['韩一诺', 'Han Yinuo', '一诺资本 · 合伙人', 'VC', '北京', 46],
  ['程溪', 'Cheng Xi', '溪流模型 · 研究员', 'AI', '杭州', 44],
  ['方既白', 'Fang Jibai', '既白生物 · 创始人', 'Frontier', '上海', 41],
  ['季长风', 'Ji Changfeng', '长风机器人 · 工程副总裁', 'Robotics', '杭州', 38],
  ['唐晚', 'Tang Wan', '晚照创投 · 投资副总裁', 'VC', '杭州', 35],
  ['温屿', 'Wen Yu', '屿光智能 · 创始人', 'AI', '深圳', 31],
  ['傅辰', 'Fu Chen', '辰星具身 · CEO', 'Robotics', '杭州', 27],
  ['夏知秋', 'Xia Zhiqiu', '知秋资本 · 合伙人', 'VC', '上海', 24],
  ['孟川', 'Meng Chuan', '川流智能 · 联合创始人', 'AI', '杭州', 20],
  ['蒋南星', 'Jiang Nanxing', '南星传感 · 创始人', 'Robotics', '深圳', 16],
  ['邵允', 'Shao Yun', '弧光种子基金 · 投资人', 'VC', '杭州', 12],
  ['白露', 'Bai Lu', '白露智能 · 算法负责人', 'AI', '杭州', 8],
  ['秦朗', 'Qin Lang', '朗月机器人 · 联合创始人', 'Robotics', '北京', 4],
  ['何以安', 'He Yian', '安然智能 · 创始人', 'AI', '杭州', 2],
];

const THESES = [
  '具身智能的数据飞轮：谁先拿到真实世界的数据，谁就先跑出来。',
  '小模型 + 垂直数据，会在企业里替代掉一半的 SaaS。',
  '机器人会先在没人愿意干的岗位上落地，而不是在家里。',
  '下一代基金会更小、更专注，像工作室一样运作。',
  'AI 原生的公司，组织结构会更像一支乐队。',
  '传感器是被低估的那一层：触觉会是下一个视觉。',
];

// name, english, venture, sector, base, lead, phone, stage, days ago, extra
const APPLICANTS = [
  ['向南', 'Xiang Nan', '具身未来 · 创始人', 'Robotics', '杭州', 7, '13900000011', 'received', 1, { source: 'nomination', invite: 'SV-7K2Q', completed: false }],
  ['罗思齐', 'Luo Siqi', '思齐量化 · 合伙人', 'VC', '上海', 8, '13900000012', 'received', 2],
  ['金雨桐', 'Jin Yutong', '桐语智能 · CEO', 'AI', '杭州', null, '13900000013', 'received', 3],
  ['杜若', 'Du Ruo', '若木实验室 · 研究员', 'Frontier', '北京', 5, '13900000014', 'received', 5],
  ['宋予安', 'Song Yuan', '予安智能 · 创始人', 'AI', '杭州', 2, '13900000021', 'diligence', 9],
  ['邱白', 'Qiu Bai', '白杨资本 · 投资经理', 'VC', '深圳', 6, '13900000022', 'diligence', 12],
  ['冯远山', 'Feng Yuanshan', '远山动力 · CTO', 'Robotics', '杭州', 4, '13900000023', 'diligence', 14],
  ['黎昕', 'Li Xin', '昕辰模型 · 研究员', 'AI', '上海', 3, '13900000024', 'diligence', 16],
  ['钟灵', 'Zhong Ling', '灵犀机器人 · 创始人', 'Robotics', '杭州', 7, '13900000031', 'initiation', 19, { initiationAt: atHz('2026-12-14', '16:00') }],
  ['庄晓', 'Zhuang Xiao', '晓峰资本 · 合伙人', 'VC', '杭州', 1, '13900000032', 'initiation', 22, { initiationAt: atHz('2026-12-14', '16:30') }],
  ['马骁', 'Ma Xiao', '骁腾科技 · 销售总监', 'Frontier', '其他', null, '13900000041', 'declined', 20],
  ['吴迪', 'Wu Di', '迪恩咨询 · 顾问', 'Frontier', '上海', null, '13900000042', 'declined', 26],
];

const EVENTS = [
  ['e01', '筹备处开放日', 'Preview Room Open House', 'house', '2026-10-24', '15:00', '18:00', '筹备处 · 杭州', 40, 'mustard',
    '在 Library 开门之前，先在筹备处见一面：看看图纸、摸摸书脊、认一认彼此。', '周行', []],
  ['e02', '闭门分享：机器人的手', 'Closed-door: The Robot’s Hand', 'closed-door', '2026-11-05', '19:30', '21:30', '筹备处 · 杭州', 20, 'powder',
    '灵巧手为什么这么难？三位一线工程师，讲他们拆坏过的东西。不录音，不外传。', '沈岚', ['季长风', '叶闻舟']],
  ['e03', '创始会员之夜', 'Founders’ Evening', 'supper', '2026-11-21', '19:00', '22:00', '筹备处 · 杭州', 30, 'pink',
    '第一批会员的晚餐。没有致辞，没有 PPT，只有一张长桌和一份手写菜单。', '周以宁', []],
  ['e04', '闭门分享：具身智能的下一个十年', 'Embodied AI, the Next Decade', 'closed-door', '2026-11-28', '19:30', '21:30', '筹备处 · 杭州', 20, 'mint',
    '数据、硬件、商业化，哪一个会先成为瓶颈？两位创始人与一位投资人的闭门对谈。', '沈岚', ['苏砚', '傅辰', '周以宁']],
  ['e05', '视频播客现场录制 · 第 01 期', 'Live Taping, Episode 01', 'podcast', '2026-12-05', '15:00', '17:00', '筹备处 · 杭州', 36, 'lav',
    '《Something Ventured》第一期：谁在给机器人下注？现场观众可以提问，问题会被剪进正片。', '何夕', ['许嘉禾', '陈牧之']],
  ['e06', '开业前夜 · 会员预览', 'Opening Eve, a Members’ Preview', 'house', '2026-12-14', '19:00', '22:00', '3F Library · 杭州', 60, 'rasp',
    '开门前一晚，Library 只为会员亮灯。第一张借书卡，在这一晚盖章。', '周行', []],
  ['e07', '开业之夜 · 不插电', 'Opening Night, Unplugged', 'unplugged', '2026-12-15', '20:00', '23:00', '3F Library · 杭州', 48, 'mustard',
    '开业当晚向公众开放。前排四十八个座位为会员保留，弦乐四重奏 + 一把木吉他。', '何夕', []],
  ['e08', '读书会：《The Power Law》', 'Reading Room: The Power Law', 'reading', '2026-12-19', '15:00', '17:00', '3F Library · 长桌', 16, 'powder',
    '一本关于风险投资如何改变世界的书。读完前三章即可参加，书可在 Library 现场借阅。', '陆一苇', []],
  ['e09', '闭门分享：AI 原生公司的组织', 'Closed-door: The AI-native Firm', 'closed-door', '2026-12-26', '19:30', '21:30', '3F Library · 小书房', 24, 'mint',
    '当一半的工作由模型完成，一家公司还需要几个人？两位 CEO 分享他们的组织实验。', '沈岚', ['孟川', '温屿']],
  ['e10', '跨城市 · 上海会员晚餐', 'Cross-city: A Shanghai Supper', 'supper', '2027-01-09', '19:00', '22:00', '上海 · 地点待定', 20, 'pink',
    '上海的会员们的第一次聚会。地点确定后通知。', '何夕', [], 'draft'],
];

const BOOKS = [
  ['The Power Law', 'Sebastian Mallaby', 'en', 'A-01', 'rasp'],
  ['从 0 到 1', '彼得·蒂尔', 'zh', 'A-02', 'mustard'],
  ['创新者', '沃尔特·艾萨克森', 'zh', 'A-03', 'powder'],
  ['芯片战争', '克里斯·米勒', 'zh', 'A-04', 'ink'],
  ['The Soul of a New Machine', 'Tracy Kidder', 'en', 'A-05', 'mint'],
  ['只有偏执狂才能生存', '安迪·格鲁夫', 'zh', 'A-06', 'pink'],
  ['创业维艰', '本·霍洛维茨', 'zh', 'A-07', 'lav'],
  ['哥德尔、艾舍尔、巴赫', '侯世达', 'zh', 'B-01', 'mustard'],
  ['The Dream Machine', 'M. Mitchell Waldrop', 'en', 'B-02', 'powder'],
  ['生命 3.0', '迈克斯·泰格马克', 'zh', 'B-03', 'rasp'],
  ['The Alignment Problem', 'Brian Christian', 'en', 'B-04', 'cream'],
  ['我，机器人', '艾萨克·阿西莫夫', 'zh', 'B-05', 'mint'],
  ['仿生人会梦见电子羊吗？', '菲利普·迪克', 'zh', 'B-06', 'lav'],
  ['控制论', '诺伯特·维纳', 'zh', 'B-07', 'ink'],
  ['浪潮之巅', '吴军', 'zh', 'C-01', 'powder'],
  ['三体', '刘慈欣', 'zh', 'C-02', 'ink'],
  ['The Code', 'Margaret O’Mara', 'en', 'C-03', 'pink'],
  ['Troublemakers', 'Leslie Berlin', 'en', 'C-04', 'mustard'],
  ['Genentech', 'Sally Smith Hughes', 'en', 'C-05', 'mint'],
  ['The Idea Factory', 'Jon Gertner', 'en', 'C-06', 'rasp'],
  ['人月神话', '弗雷德里克·布鲁克斯', 'zh', 'D-01', 'cream'],
  ['鞋狗', '菲尔·奈特', 'zh', 'D-02', 'powder'],
  ['The Man Who Solved the Market', 'Gregory Zuckerman', 'en', 'D-03', 'lav'],
  ['人工智能：一种现代的方法', '罗素 & 诺维格', 'zh', 'D-04', 'pink'],
];

export function seed(t = Date.now()) {
  const rnd = mulberry32(1215);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const ago = (days, hours = 0) => iso(t - days * D - hours * H);
  const db = {
    version: 1,
    seededAt: iso(t),
    floors: [
      { id: 'library', floor: '3F', name: 'Library', zh: '图书馆', note: '真实藏书 + 现场不插电音乐', status: 'preopening', mode: 'auto', openingDate: OPENING, zones: LIBRARY_ZONES },
      { id: 'night', floor: '2F', name: 'Nightclub', zh: '夜店', note: '规划中', status: 'planned', mode: 'auto', zones: [] },
      { id: 'dining', floor: '1F', name: 'Dining & Bar', zh: '餐饮 + 酒吧', note: '规划中', status: 'planned', mode: 'auto', zones: [] },
    ],
    staff: STAFF.map(s => ({ ...s })),
    members: [], applications: [], events: [], rsvps: [], reservations: [], books: [],
    visits: [], requests: [], bulletins: [], notices: [], activity: [], sessions: {},
  };

  MEMBERS.forEach(([name, en, venture, sector, base, days], i) => {
    const no = String(i + 1).padStart(4, '0');
    const id = 'm' + no.slice(2);
    db.members.push({
      id, no, name, en, venture, sector, base,
      phone: '138000' + no.padStart(5, '0'),
      hostId: i % 2 ? 's2' : 's1',
      since: hzDate(t - days * D),
      status: 'active',
      secret: 'sv-demo-' + no,
      bulletinSeenAt: ago(Math.max(0, days - 1)),
    });
    const created = t - (days + 9 + Math.floor(rnd() * 10)) * D;
    db.applications.push({
      id: 'a' + no, name, en, venture, sector, base, phone: '138000' + no.padStart(5, '0'), wechat: '',
      thesis: pick(THESES), lead: i < 3 ? '创始团队' : MEMBERS[Math.floor(rnd() * i)][0],
      leadMemberId: null, source: 'application', invite: null, completed: true,
      stage: 'welcomed', createdAt: iso(created), stageAt: iso(t - days * D), memberId: id,
      history: [
        { stage: 'received', at: iso(created) },
        { stage: 'diligence', at: iso(created + 2 * D) },
        { stage: 'initiation', at: iso(created + 6 * D) },
        { stage: 'welcomed', at: iso(t - days * D) },
      ],
      notes: [],
    });
  });

  APPLICANTS.forEach(([name, en, venture, sector, base, lead, phone, stage, days, extra = {}], i) => {
    const created = t - days * D - (i % 5) * H;
    const leadMember = lead ? db.members[lead - 1] : null;
    const history = [{ stage: 'received', at: iso(created) }];
    if (['diligence', 'initiation'].includes(stage)) history.push({ stage: 'diligence', at: iso(created + 3 * D) });
    if (stage === 'initiation') history.push({ stage: 'initiation', at: iso(created + 8 * D) });
    if (stage === 'declined') history.push({ stage: 'declined', at: iso(created + 5 * D) });
    db.applications.push({
      id: 'b' + String(i + 1).padStart(2, '0'), name, en, venture, sector, base, phone, wechat: '',
      thesis: extra.completed === false ? '' : THESES[i % THESES.length],
      lead: leadMember ? leadMember.name : '', leadMemberId: leadMember ? leadMember.id : null,
      source: 'application', invite: null, completed: true, initiationAt: null,
      stage, createdAt: iso(created), stageAt: history[history.length - 1].at, memberId: null,
      history, notes: stage === 'diligence' ? [{ at: iso(created + 4 * D), by: '周行', text: '背景已核实，约了下周线下聊。' }] : [],
      ...extra,
    });
  });

  EVENTS.forEach(([id, title, en, type, date, from, to, venue, capacity, color, description, host, speakers, status = 'published']) => {
    db.events.push({
      id, title, en, type, startsAt: atHz(date, from), endsAt: atHz(to < from ? addDays(date, 1) : date, to),
      venue, capacity, color, description, host, speakers, membersOnly: type !== 'unplugged', status,
      createdAt: ago(30),
    });
  });

  // RSVPs: how many members are going to each event (the persona m07 is set by hand below)
  const going = { e01: 18, e02: 14, e03: 21, e04: 20, e05: 14, e06: 30, e07: 25, e08: 9, e09: 6 };
  const waitlisted = { e04: 3 };
  db.events.forEach(e => {
    const n = going[e.id] || 0;
    const pool = db.members.filter(m => m.id !== 'm07').sort(() => rnd() - 0.5);
    const past = Date.parse(e.endsAt) < t;
    pool.slice(0, n).forEach((m, k) => db.rsvps.push({
      id: `r-${e.id}-${m.id}`, eventId: e.id, memberId: m.id, status: past ? 'attended' : 'going', createdAt: ago(20 - (k % 9)),
    }));
    pool.slice(n, n + (waitlisted[e.id] || 0)).forEach((m, k) => db.rsvps.push({
      id: `r-${e.id}-${m.id}`, eventId: e.id, memberId: m.id, status: 'waitlist', createdAt: ago(3, k),
    }));
  });
  for (const [eventId, status] of [['e01', 'attended'], ['e02', 'attended'], ['e03', 'going'], ['e06', 'going']]) {
    db.rsvps.push({ id: `r-${eventId}-m07`, eventId, memberId: 'm07', status, createdAt: ago(18) });
  }
  // visits come from the two preview evenings that already happened
  db.rsvps.filter(r => r.status === 'attended').forEach(r => {
    const e = byId(db.events, r.eventId);
    db.visits.push({ id: 'v-' + r.id.slice(2), memberId: r.memberId, at: iso(Date.parse(e.startsAt) + (10 + Math.floor(rnd() * 50)) * 60e3), place: e.venue, eventId: e.id, by: 's3' });
  });

  // opening fortnight reservations in the Library
  const opening = OPENING;
  const plan = [[0, 'night', 26], [0, 'day', 14], [1, 'day', 11], [1, 'night', 15], [2, 'day', 9], [2, 'night', 12], [3, 'day', 8],
    [3, 'night', 17], [4, 'day', 12], [4, 'night', 22], [5, 'day', 16], [5, 'night', 20], [6, 'day', 10], [6, 'night', 9]];
  let seq = 0;
  for (const [offset, session, seats] of plan) {
    const date = addDays(opening, offset);
    let left = seats;
    const pool = db.members.filter(m => m.id !== 'm07').sort(() => rnd() - 0.5);
    for (const m of pool) {
      if (left <= 0) break;
      const zone = pick(['long', 'long', 'long', 'fireside', 'fireside', 'listening']);
      const z = LIBRARY_ZONES.find(x => x.id === zone);
      const used = db.reservations.filter(r => r.date === date && r.session === session && r.zoneId === zone).reduce((s, r) => s + r.party, 0);
      const party = session === 'day' ? 1 : Math.min(left, 1 + Math.floor(rnd() * 3));
      if (used + party > z.capacity) continue;
      left -= party;
      seq += 1;
      db.reservations.push({
        id: 'q' + String(seq).padStart(3, '0'), code: resCode(date, seq), memberId: m.id, floorId: 'library', date, session, zoneId: zone, party,
        note: '', status: 'confirmed', createdAt: ago(1 + Math.floor(rnd() * 10), Math.floor(rnd() * 20)),
      });
    }
  }
  seq += 1;
  db.reservations.push({ id: 'q' + String(seq).padStart(3, '0'), code: resCode(addDays(opening, 1), seq), memberId: 'm07', floorId: 'library', date: addDays(opening, 1), session: 'day', zoneId: 'long', party: 1, note: '靠窗的位置，谢谢。', status: 'confirmed', createdAt: ago(2) });

  BOOKS.forEach(([title, author, lang, shelf, color], i) => {
    db.books.push({ id: 'k' + String(i + 1).padStart(2, '0'), title, author, lang, shelf, color, status: 'shelf', holderId: null, heldAt: null, dueAt: null });
  });
  Object.assign(db.books[0], { status: 'held', holderId: 'm07', heldAt: ago(1) });
  Object.assign(db.books[3], { status: 'held', holderId: 'm03', heldAt: ago(2) });
  Object.assign(db.books[15], { status: 'held', holderId: 'm12', heldAt: ago(4) });

  db.requests.push(
    { id: 'c01', memberId: 'm03', type: 'guest', text: '12.15 开业之夜想带两位 LP 朋友过来，是否可以？', status: 'open', createdAt: ago(0, 5), reply: null, repliedAt: null, repliedBy: null },
    { id: 'c02', memberId: 'm07', type: 'room', text: '12.16 下午想订一间小书房，开一个四个人的会，需要投影。', status: 'replied', createdAt: ago(2, 3), reply: '已为你预留 12.16 14:00–17:00 的小书房 B，投影和白板都会备好。', repliedAt: ago(2), repliedBy: 's1' },
    { id: 'c03', memberId: 'm12', type: 'book', text: '能否帮忙找一本《The Soul of a New Machine》的初版？', status: 'open', createdAt: ago(1, 2), reply: null, repliedAt: null, repliedBy: null },
    { id: 'c04', memberId: 'm17', type: 'other', text: '想推荐一位做灵巧手的朋友来做一次闭门分享，该找谁聊？', status: 'open', createdAt: ago(3, 6), reply: null, repliedAt: null, repliedBy: null },
  );

  db.bulletins.push(
    { id: 'n03', title: '开业周预订已开放', body: '3F Library 将于 12 月 15 日开业。白天（10:00–18:00）仅对会员开放，入夜后向公众开放。开业两周的座位现在可以在「预订」里选好。', at: ago(1, 2), by: 's3' },
    { id: 'n02', title: '创始会员之夜 · 11.21', body: '第一批会员的晚餐，在筹备处。座位有限，请在「节目」里确认出席。', at: ago(6), by: 's1' },
    { id: 'n01', title: '关于携友到访', body: '夜间时段，每位会员可携两位来宾；白天为会员时段，暂不接待来宾。如有特殊安排，按铃找你的专属服务人员。', at: ago(14), by: 's3' },
  );

  db.notices.push(
    { id: 'o03', to: 'm07', kind: 'request', title: '沈岚 回复了你', body: '已为你预留 12.16 14:00–17:00 的小书房 B，投影和白板都会备好。', at: ago(2), read: false },
    { id: 'o02', to: 'm07', kind: 'referral', title: '你推荐的 钟灵 进入了入会仪式', body: '仪式定在 12.14 16:00。谢谢你的推荐。', at: ago(3), read: true },
    { id: 'o01', to: 'm07', kind: 'rsvp', title: '座位已确认 · 创始会员之夜', body: '11.21 19:00 · 筹备处 · 杭州', at: ago(9), read: true },
  );

  db.activity = [
    { at: ago(0, 2), kind: 'application', text: '向南 经 林知远 推荐，提交了入会申请' },
    { at: ago(0, 5), kind: 'request', text: '许嘉禾 按铃：携友到访' },
    { at: ago(1, 1), kind: 'reservation', text: '傅辰 预订了 12.20 夜晚 · 长桌阅览' },
    { at: ago(1, 2), kind: 'bulletin', text: '周行 发布了公告「开业周预订已开放」' },
    { at: ago(1, 6), kind: 'application', text: '罗思齐 提交了入会申请' },
    { at: ago(2, 0), kind: 'member', text: '何以安 完成入会仪式，成为 No.0024' },
    { at: ago(2, 3), kind: 'request', text: '沈岚 回复了 林知远 的礼宾请求' },
    { at: ago(3, 1), kind: 'rsvp', text: '苏砚 报名了「闭门分享：具身智能的下一个十年」' },
  ];
  return db;
}

function resCode(date, n) {
  return `3F-${date.slice(5, 7)}${date.slice(8, 10)}-${String(n % 1000).padStart(3, '0')}`;
}

/* =========================================================
   Views (what each side is allowed to see)
   ========================================================= */
const staffView = s => s && ({ id: s.id, name: s.name, en: s.en, role: s.role, roleEn: s.roleEn });
export const brief = m => m && ({ id: m.id, no: m.no, name: m.name, en: m.en, sector: m.sector, base: m.base, venture: m.venture });

function eventView(db, e, memberId, t) {
  const rs = db.rsvps.filter(r => r.eventId === e.id);
  const taken = rs.filter(r => r.status === 'going' || r.status === 'attended').length;
  const mine = memberId ? rs.find(r => r.memberId === memberId && r.status !== 'cancelled') : null;
  return {
    id: e.id, title: e.title, en: e.en, type: e.type, startsAt: e.startsAt, endsAt: e.endsAt, venue: e.venue,
    capacity: e.capacity, color: e.color, description: e.description, host: e.host, speakers: e.speakers,
    membersOnly: e.membersOnly, status: e.status,
    taken, left: Math.max(0, e.capacity - taken), waitlist: rs.filter(r => r.status === 'waitlist').length,
    mine: mine ? mine.status : null, past: Date.parse(e.endsAt) < t,
  };
}

function appView(db, a, admin = false) {
  const lead = a.leadMemberId ? byId(db.members, a.leadMemberId) : null;
  const member = a.memberId ? byId(db.members, a.memberId) : null;
  const v = {
    id: a.id, name: a.name, en: a.en, venture: a.venture, sector: a.sector, base: a.base,
    lead: lead ? lead.name : a.lead, stage: a.stage, step: stageOf(a.stage).step,
    createdAt: a.createdAt, stageAt: a.stageAt, initiationAt: a.initiationAt || null,
    history: a.history.map(h => ({ stage: h.stage, at: h.at })), thesis: a.thesis, completed: a.completed !== false,
    memberNo: member ? member.no : null, source: a.source,
  };
  if (admin) Object.assign(v, { phone: a.phone, wechat: a.wechat, leadMemberId: a.leadMemberId, leadNo: lead ? lead.no : null, notes: a.notes, invite: a.invite, memberId: a.memberId });
  return v;
}

function resView(db, r) {
  const f = byId(db.floors, r.floorId);
  const z = f.zones.find(x => x.id === r.zoneId) || {};
  return { ...r, zone: { id: z.id, zh: z.zh, en: z.en, unit: z.unit }, floor: { id: f.id, floor: f.floor, name: f.name }, sessionInfo: SESSIONS[r.session] };
}

function bookView(db, b, memberId) {
  return { id: b.id, title: b.title, author: b.author, lang: b.lang, shelf: b.shelf, color: b.color, status: b.status, mine: !!memberId && b.holderId === memberId, dueAt: b.holderId === memberId ? b.dueAt : null };
}

/* =========================================================
   Methods
   ========================================================= */
const METHODS = {};
const def = (name, role, fn) => { METHODS[name] = { role, fn }; };

function log(ctx, kind, text) {
  ctx.db.activity.unshift({ at: iso(ctx.now), kind, text });
  ctx.db.activity.length = Math.min(ctx.db.activity.length, 150);
}
function notify(ctx, to, kind, title, body = '') {
  ctx.db.notices.unshift({ id: 'o' + rid(8), to, kind, title, body, at: iso(ctx.now), read: false });
  ctx.db.notices.length = Math.min(ctx.db.notices.length, 500);
  ctx.touch('notices');
}
function issue(ctx, role, id) {
  const token = rid(32);
  ctx.db.sessions[token] = { role, id, at: iso(ctx.now) };
  const keys = Object.keys(ctx.db.sessions);
  if (keys.length > 400) keys.sort((a, b) => ctx.db.sessions[a].at.localeCompare(ctx.db.sessions[b].at)).slice(0, keys.length - 400).forEach(k => delete ctx.db.sessions[k]);
  ctx.touch('session');
  return { token, role };
}
const me = ctx => {
  const m = byId(ctx.db.members, ctx.session.id);
  if (!m || m.status !== 'active') fail('会员身份不可用，请联系礼宾台', 'auth', 401);
  return m;
};
const staffMe = ctx => byId(ctx.db.staff, ctx.session.id) || ctx.db.staff[2];
const nextNo = db => String(db.members.reduce((n, m) => Math.max(n, +m.no), 0) + 1).padStart(4, '0');
const activeApp = (db, phone) => db.applications.filter(a => a.phone === phone && a.stage !== 'declined').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

/* ---------- public ---------- */
def('ping', 'public', ctx => ({ ok: true, opening: OPENING, now: ctx.now }));

def('club.info', 'public', ctx => ({
  opening: OPENING,
  floors: ctx.db.floors.map(f => ({ id: f.id, floor: f.floor, name: f.name, zh: f.zh, note: f.note, status: f.status, state: floorState(f, ctx.now) })),
  cities: CITIES,
}));

def('staff.list', 'public', ctx => ctx.db.staff.map(staffView));

def('auth.login', 'public', (ctx, { phone, code }) => {
  phone = normPhone(phone);
  if (!/^1\d{10}$/.test(phone)) fail('请输入 11 位手机号');
  if (String(code ?? '').trim() !== DEMO_CODE) fail(`验证码不正确（演示验证码：${DEMO_CODE}）`);
  const m = ctx.db.members.find(x => x.phone === phone);
  if (m) {
    if (m.status !== 'active') fail('该会员身份已暂停，请联系礼宾台');
    return issue(ctx, 'member', m.id);
  }
  const a = activeApp(ctx.db, phone);
  if (a) return issue(ctx, 'applicant', a.id);
  fail('没有找到这个手机号。Something Ventured 仅限推荐入会，可以先提交申请。', 'not_found', 404);
});

def('auth.demo', 'public', (ctx, { as }) => as === 'applicant'
  ? issue(ctx, 'applicant', (ctx.db.applications.find(a => a.phone === '13900000021') || ctx.db.applications.find(a => a.stage === 'diligence')).id)
  : issue(ctx, 'member', 'm07'));

def('auth.logout', 'any', ctx => { delete ctx.db.sessions[ctx.token]; ctx.touch('session'); return { ok: true }; });

def('invite.check', 'public', (ctx, { code }) => {
  const a = ctx.db.applications.find(x => x.invite && x.invite === clean(code, 12).toUpperCase());
  if (!a || a.stage === 'declined') fail('邀请码无效，请向推荐你的会员确认。', 'not_found', 404);
  const lead = byId(ctx.db.members, a.leadMemberId);
  return { name: a.name, venture: a.venture, sector: a.sector, base: a.base, lead: lead ? lead.name : a.lead, completed: a.completed !== false };
});

def('apply', 'public', (ctx, args) => {
  const db = ctx.db;
  const v = {
    name: clean(args.name, 30), venture: clean(args.venture, 60), sector: clean(args.sector, 20), base: clean(args.base, 10),
    lead: clean(args.lead, 30), phone: normPhone(args.phone), wechat: clean(args.wechat, 40), thesis: cleanText(args.thesis, 300),
  };
  if (!v.name) fail('请填写姓名');
  if (!v.venture) fail('请填写公司与职位');
  if (!SECTORS.some(s => s.id === v.sector)) fail('请选择领域');
  if (!BASES.includes(v.base)) fail('请选择常驻城市');
  if (!/^1\d{10}$/.test(v.phone)) fail('请填写 11 位手机号');
  if (db.members.some(m => m.phone === v.phone)) fail('这个手机号已经是会员，请直接登录。', 'conflict', 409);
  const code = clean(args.invite, 12).toUpperCase();
  let a = code ? db.applications.find(x => x.invite === code && x.stage !== 'declined') : null;
  if (code && !a) fail('邀请码无效，请向推荐你的会员确认。');
  const existing = activeApp(db, v.phone);
  if (existing && existing !== a) fail('这个手机号已经有一份申请在进行中，可以直接登录查看进度。', 'conflict', 409);
  if (a) {
    Object.assign(a, { ...v, lead: a.lead, completed: true });
    log(ctx, 'application', `${a.name} 补全了 ${a.lead} 的推荐信息`);
  } else {
    const lead = v.lead ? db.members.find(m => m.name === v.lead) : null;
    a = {
      id: 'b' + rid(8), ...v, en: '', leadMemberId: lead ? lead.id : null, source: 'application', invite: null, completed: true,
      stage: 'received', createdAt: iso(ctx.now), stageAt: iso(ctx.now), initiationAt: null, memberId: null,
      history: [{ stage: 'received', at: iso(ctx.now) }], notes: [],
    };
    db.applications.push(a);
    log(ctx, 'application', v.lead ? `${a.name} 经 ${v.lead} 推荐，提交了入会申请` : `${a.name} 提交了入会申请`);
    if (lead) notify(ctx, lead.id, 'referral', `${a.name} 写下了你的名字`, '他的申请已经送到礼宾台，筛选结果会同步给你。');
  }
  ctx.touch('applications');
  return { ...issue(ctx, 'applicant', a.id), application: appView(db, a) };
});

/* ---------- applicant ---------- */
def('application.status', 'applicant', ctx => {
  const a = byId(ctx.db.applications, ctx.session.id);
  if (!a) fail('申请不存在', 'auth', 401);
  const notices = ctx.db.notices.filter(n => n.to === 'a:' + a.id).slice(0, 10);
  // a nominee who has not filled in the form yet needs their own invite code to do so
  return { application: { ...appView(ctx.db, a), invite: a.completed === false ? a.invite : null }, notices };
});

def('auth.upgrade', 'applicant', ctx => {
  const a = byId(ctx.db.applications, ctx.session.id);
  if (!a || a.stage !== 'welcomed' || !a.memberId) fail('入会手续还没有完成');
  ctx.session.role = 'member';
  ctx.session.id = a.memberId;
  ctx.touch('session');
  return { role: 'member' };
});

/* ---------- member ---------- */
function meView(db, m) {
  const host = byId(db.staff, m.hostId);
  return {
    ...brief(m), phone: m.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1 **** $2'), since: m.since, secret: m.secret,
    host: staffView(host), cities: CITIES,
    stats: {
      visits: db.visits.filter(v => v.memberId === m.id).length,
      events: db.rsvps.filter(r => r.memberId === m.id && (r.status === 'attended' || r.status === 'going')).length,
      referrals: db.applications.filter(a => a.leadMemberId === m.id).length,
    },
  };
}

def('me', 'member', ctx => meView(ctx.db, me(ctx)));

def('lobby', 'member', ctx => {
  const { db, now } = ctx;
  const m = me(ctx);
  const upcoming = [];
  db.reservations.filter(r => r.memberId === m.id && r.status === 'confirmed' && r.date >= hzDate(now)).forEach(r => {
    upcoming.push({ kind: 'reservation', at: atHz(r.date, SESSIONS[r.session].from), item: resView(db, r) });
  });
  db.rsvps.filter(r => r.memberId === m.id && r.status === 'going').forEach(r => {
    const e = byId(db.events, r.eventId);
    if (e && Date.parse(e.endsAt) > now) upcoming.push({ kind: 'event', at: e.startsAt, item: eventView(db, e, m.id, now) });
  });
  upcoming.sort((a, b) => a.at.localeCompare(b.at));
  const spotlight = db.events.filter(e => e.status === 'published' && Date.parse(e.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 3).map(e => eventView(db, e, m.id, now));
  const unread = db.notices.filter(n => n.to === m.id && !n.read).length + db.bulletins.filter(b => b.at > (m.bulletinSeenAt || '')).length;
  return {
    me: meView(db, m),
    floors: db.floors.map(f => ({ id: f.id, floor: f.floor, name: f.name, zh: f.zh, note: f.note, status: f.status, openingDate: f.openingDate, state: floorState(f, now) })),
    upcoming: upcoming.slice(0, 3), spotlight, bulletins: db.bulletins.slice(0, 2), unread, opening: OPENING,
  };
});

def('events.list', 'member', ctx => {
  const m = me(ctx);
  return ctx.db.events.filter(e => e.status === 'published')
    .map(e => eventView(ctx.db, e, m.id, ctx.now))
    .sort((a, b) => a.past - b.past || (a.past ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
});

def('events.rsvp', 'member', (ctx, { eventId }) => {
  const { db } = ctx;
  const m = me(ctx);
  const e = byId(db.events, eventId);
  if (!e || e.status !== 'published') fail('找不到这场活动', 'not_found', 404);
  if (Date.parse(e.startsAt) < ctx.now) fail('这场活动已经开始了');
  let r = db.rsvps.find(x => x.eventId === e.id && x.memberId === m.id);
  if (r && (r.status === 'going' || r.status === 'waitlist')) return eventView(db, e, m.id, ctx.now);
  const taken = db.rsvps.filter(x => x.eventId === e.id && x.status === 'going').length;
  const status = taken >= e.capacity ? 'waitlist' : 'going';
  if (r) Object.assign(r, { status, createdAt: iso(ctx.now) });
  else db.rsvps.push(r = { id: 'r' + rid(8), eventId: e.id, memberId: m.id, status, createdAt: iso(ctx.now) });
  notify(ctx, m.id, 'rsvp', status === 'going' ? `座位已确认 · ${e.title}` : `已加入候补 · ${e.title}`, `${fmtShort(e.startsAt)} · ${e.venue}`);
  log(ctx, 'rsvp', status === 'going' ? `${m.name} 报名了「${e.title}」` : `${m.name} 加入了「${e.title}」的候补`);
  ctx.touch('events');
  return eventView(db, e, m.id, ctx.now);
});

def('events.cancel', 'member', (ctx, { eventId }) => {
  const { db } = ctx;
  const m = me(ctx);
  const e = byId(db.events, eventId);
  const r = db.rsvps.find(x => x.eventId === eventId && x.memberId === m.id && (x.status === 'going' || x.status === 'waitlist'));
  if (!e || !r) fail('没有找到你的报名');
  const was = r.status;
  r.status = 'cancelled';
  if (was === 'going') {
    const next = db.rsvps.filter(x => x.eventId === e.id && x.status === 'waitlist').sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (next) {
      next.status = 'going';
      notify(ctx, next.memberId, 'rsvp', `候补转正 · ${e.title}`, `有位置空出来了。${fmtShort(e.startsAt)} 见。`);
    }
  }
  log(ctx, 'rsvp', `${m.name} 取消了「${e.title}」的${was === 'going' ? '报名' : '候补'}`);
  ctx.touch('events');
  return eventView(db, e, m.id, ctx.now);
});

function zoneLoad(db, date, session, zoneId) {
  return db.reservations.filter(r => r.date === date && r.session === session && r.zoneId === zoneId && (r.status === 'confirmed' || r.status === 'seated'))
    .reduce((s, r) => s + (r.zoneId === 'study' ? 1 : r.party), 0);
}

def('reserve.availability', 'member', (ctx, { date }) => {
  const { db } = ctx;
  const m = me(ctx);
  const lib = byId(db.floors, 'library');
  const range = bookingWindow(db, ctx.now);
  if (!range.includes(date)) date = range[0];
  const sessions = Object.values(SESSIONS).map(s => ({
    ...s,
    zones: lib.zones.map(z => { const booked = zoneLoad(db, date, s.id, z.id); return { ...z, booked, left: Math.max(0, z.capacity - booked) }; }),
    mine: db.reservations.filter(r => r.memberId === m.id && r.date === date && r.session === s.id && r.status === 'confirmed').map(r => resView(db, r))[0] || null,
  }));
  const busy = range.map(d => {
    const total = Object.keys(SESSIONS).reduce((s, sid) => s + lib.zones.filter(z => z.unit === 'seat').reduce((t, z) => t + zoneLoad(db, d, sid, z.id), 0), 0);
    return { date: d, load: total / (2 * lib.zones.filter(z => z.unit === 'seat').reduce((t, z) => t + z.capacity, 0)), mine: db.reservations.some(r => r.memberId === m.id && r.date === d && r.status === 'confirmed') };
  });
  return { date, range: busy, floor: { id: lib.id, floor: lib.floor, name: lib.name, status: lib.status, openingDate: lib.openingDate }, sessions };
});

def('reserve.create', 'member', (ctx, { date, session, zoneId, party, note }) => {
  const { db } = ctx;
  const m = me(ctx);
  const lib = byId(db.floors, 'library');
  if (!['preopening', 'open'].includes(lib.status)) fail('Library 暂停预订');
  if (!bookingWindow(db, ctx.now).includes(date)) fail('只能预订未来两周内的座位');
  if (!SESSIONS[session]) fail('请选择时段');
  const zone = lib.zones.find(z => z.id === zoneId);
  if (!zone) fail('请选择区域');
  party = Math.max(1, Math.min(4, parseInt(party, 10) || 1));
  if (session === 'day' && zone.unit === 'seat') party = 1;
  const units = zone.unit === 'room' ? 1 : party;
  if (zoneLoad(db, date, session, zone.id) + units > zone.capacity) fail(`${zone.zh}在这个时段已经订满了`, 'full', 409);
  if (db.reservations.some(r => r.memberId === m.id && r.date === date && r.session === session && r.status === 'confirmed')) fail('这个时段你已经有一个预订了');
  const n = db.reservations.length + 1;
  const r = { id: 'q' + rid(8), code: resCode(date, n), memberId: m.id, floorId: 'library', date, session, zoneId: zone.id, party, note: cleanText(note, 120), status: 'confirmed', createdAt: iso(ctx.now) };
  db.reservations.push(r);
  notify(ctx, m.id, 'reservation', `预订成功 · ${zone.zh}`, `${date.slice(5).replace('-', '.')} ${SESSIONS[session].zh} · ${r.code}`);
  log(ctx, 'reservation', `${m.name} 预订了 ${date.slice(5).replace('-', '.')} ${session === 'day' ? '白天' : '夜晚'} · ${zone.zh}`);
  ctx.touch('reservations');
  return resView(db, r);
});

def('reserve.cancel', 'member', (ctx, { id }) => {
  const m = me(ctx);
  const r = ctx.db.reservations.find(x => x.id === id && x.memberId === m.id);
  if (!r || r.status !== 'confirmed') fail('没有找到这个预订');
  r.status = 'cancelled';
  log(ctx, 'reservation', `${m.name} 取消了 ${r.date.slice(5).replace('-', '.')} 的预订`);
  ctx.touch('reservations');
  return resView(ctx.db, r);
});

def('reserve.mine', 'member', ctx => {
  const m = me(ctx);
  const today = hzDate(ctx.now);
  return ctx.db.reservations.filter(r => r.memberId === m.id && r.status !== 'cancelled')
    .map(r => ({ ...resView(ctx.db, r), past: r.date < today }))
    .sort((a, b) => a.past - b.past || a.date.localeCompare(b.date));
});

def('books.list', 'member', ctx => {
  const m = me(ctx);
  return ctx.db.books.map(b => bookView(ctx.db, b, m.id));
});

def('books.hold', 'member', (ctx, { id }) => {
  const m = me(ctx);
  const b = byId(ctx.db.books, id);
  if (!b) fail('找不到这本书', 'not_found', 404);
  if (b.holderId === m.id) return bookView(ctx.db, b, m.id);
  if (b.status !== 'shelf') fail('这本书已经被预留或借出');
  if (ctx.db.books.filter(x => x.holderId === m.id).length >= 3) fail('每位会员最多同时预留或借阅 3 本');
  Object.assign(b, { status: 'held', holderId: m.id, heldAt: iso(ctx.now) });
  log(ctx, 'book', `${m.name} 预留了《${b.title}》`);
  ctx.touch('books');
  return bookView(ctx.db, b, m.id);
});

def('books.release', 'member', (ctx, { id }) => {
  const m = me(ctx);
  const b = byId(ctx.db.books, id);
  if (!b || b.holderId !== m.id || b.status !== 'held') fail('只能取消自己的预留');
  Object.assign(b, { status: 'shelf', holderId: null, heldAt: null });
  ctx.touch('books');
  return bookView(ctx.db, b, m.id);
});

def('referral.nominate', 'member', (ctx, args) => {
  const { db } = ctx;
  const m = me(ctx);
  const name = clean(args.name, 30), phone = normPhone(args.phone), venture = clean(args.venture, 60), note = cleanText(args.note, 300);
  const sector = SECTORS.some(s => s.id === args.sector) ? args.sector : 'Frontier';
  if (!name) fail('请填写被推荐人的姓名');
  if (!/^1\d{10}$/.test(phone)) fail('请填写 11 位手机号');
  if (db.members.some(x => x.phone === phone)) fail('这位已经是会员了');
  if (activeApp(db, phone)) fail('这位已经有一份申请在进行中');
  const open = db.applications.filter(a => a.leadMemberId === m.id && ['received', 'diligence'].includes(a.stage)).length;
  if (open >= 5) fail('你同时在途的推荐最多 5 位');
  let invite;
  do { invite = inviteCode(); } while (db.applications.some(a => a.invite === invite));
  const a = {
    id: 'b' + rid(8), name, en: '', venture: venture || '待补充', sector, base: m.base, phone, wechat: '', thesis: '', lead: m.name, leadMemberId: m.id,
    source: 'nomination', invite, completed: false, stage: 'received', createdAt: iso(ctx.now), stageAt: iso(ctx.now), initiationAt: null, memberId: null,
    history: [{ stage: 'received', at: iso(ctx.now) }], notes: note ? [{ at: iso(ctx.now), by: m.name + '（推荐人）', text: note }] : [],
  };
  db.applications.push(a);
  log(ctx, 'application', `${m.name} 推荐了 ${name}`);
  ctx.touch('applications');
  return { invite, application: appView(db, a) };
});

def('referral.mine', 'member', ctx => {
  const m = me(ctx);
  return ctx.db.applications.filter(a => a.leadMemberId === m.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(a => ({ ...appView(ctx.db, a), invite: a.invite }));
});

def('concierge.request', 'member', (ctx, { type, text }) => {
  const m = me(ctx);
  if (!REQUEST_TYPES[type]) fail('请选择需要什么帮助');
  text = cleanText(text, 300);
  if (!text) fail('写一句话告诉我们需要什么');
  const r = { id: 'c' + rid(8), memberId: m.id, type, text, status: 'open', createdAt: iso(ctx.now), reply: null, repliedAt: null, repliedBy: null };
  ctx.db.requests.unshift(r);
  log(ctx, 'request', `${m.name} 按铃：${REQUEST_TYPES[type].zh}`);
  ctx.touch('requests');
  return r;
});

def('concierge.mine', 'member', ctx => {
  const m = me(ctx);
  return ctx.db.requests.filter(r => r.memberId === m.id).map(r => ({ ...r, by: staffView(byId(ctx.db.staff, r.repliedBy)) }));
});

def('notices.list', 'member', ctx => {
  const m = me(ctx);
  const seen = m.bulletinSeenAt || '';
  const items = [
    ...ctx.db.bulletins.map(b => ({ id: b.id, kind: 'bulletin', title: b.title, body: b.body, at: b.at, read: b.at <= seen, by: staffView(byId(ctx.db.staff, b.by)) })),
    ...ctx.db.notices.filter(n => n.to === m.id),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
});

def('notices.read', 'member', ctx => {
  const m = me(ctx);
  m.bulletinSeenAt = iso(ctx.now);
  ctx.db.notices.forEach(n => { if (n.to === m.id) n.read = true; });
  ctx.touch('session');
  return { ok: true };
});

def('visits.mine', 'member', ctx => {
  const m = me(ctx);
  return ctx.db.visits.filter(v => v.memberId === m.id).sort((a, b) => b.at.localeCompare(a.at))
    .map(v => ({ ...v, event: v.eventId ? (e => e && { id: e.id, title: e.title, color: e.color })(byId(ctx.db.events, v.eventId)) : null }));
});

/* ---------- staff (admin) ---------- */
def('admin.login', 'public', (ctx, { staffId, pin }) => {
  const s = byId(ctx.db.staff, staffId);
  if (!s) fail('请选择你的名字');
  if (String(pin ?? '').trim() !== DEMO_PIN) fail(`PIN 不正确（演示 PIN：${DEMO_PIN}）`);
  return { ...issue(ctx, 'admin', s.id), staff: staffView(s) };
});

def('admin.me', 'admin', ctx => staffView(staffMe(ctx)));

def('admin.badges', 'admin', ctx => ({
  received: ctx.db.applications.filter(a => a.stage === 'received').length,
  openRequests: ctx.db.requests.filter(r => r.status === 'open').length,
  holds: ctx.db.books.filter(b => b.status === 'held').length,
}));

/* Demo helper for the front desk: the door code a demo member's phone is showing right now,
   so the check-in can be tried on one laptop. A production build would not expose this. */
def('admin.democode', 'admin', ctx => {
  const m = byId(ctx.db.members, 'm07') || ctx.db.members[0];
  return { member: brief(m), code: entryCode(m.secret, ctx.now), ttl: Math.ceil((CODE_STEP - (ctx.now % CODE_STEP)) / 1000) };
});

def('admin.overview', 'admin', ctx => {
  const { db, now } = ctx;
  const today = hzDate(now);
  const active = db.members.filter(m => m.status === 'active');
  const lib = byId(db.floors, 'library');
  const seatZones = lib.zones.filter(z => z.unit === 'seat');
  const seatCap = seatZones.reduce((s, z) => s + z.capacity, 0);
  const week = Array.from({ length: 7 }, (_, i) => addDays(lib.openingDate && lib.openingDate > today ? lib.openingDate : today, i));
  const heat = Object.values(SESSIONS).map(s => ({
    session: s.id, zh: s.zh, en: s.en,
    cells: week.map(d => ({ date: d, booked: seatZones.reduce((t, z) => t + zoneLoad(db, d, s.id, z.id), 0), capacity: seatCap })),
  }));
  // applications received per week, last 12 weeks (weeks start on Monday, Hangzhou time)
  const dow = (hz(now).dow + 6) % 7;
  const thisMonday = addDays(today, -dow);
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const start = addDays(thisMonday, (i - 11) * 7), end = addDays(start, 7);
    return { start, count: db.applications.filter(a => { const d = hzDate(a.createdAt); return d >= start && d < end; }).length };
  });
  const pipeline = Object.fromEntries(STAGES.map(s => [s.id, db.applications.filter(a => a.stage === s.id).length]));
  const upcoming = db.events.filter(e => e.status === 'published' && Date.parse(e.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5).map(e => eventView(db, e, null, now));
  const monthStart = addDays(today, -30);
  return {
    kpis: {
      members: active.length,
      newMembers: active.filter(m => m.since > monthStart).length,
      pipeline: pipeline.received + pipeline.diligence + pipeline.initiation,
      received: pipeline.received,
      openRequests: db.requests.filter(r => r.status === 'open').length,
      holds: db.books.filter(b => b.status === 'held').length,
      weekSeats: heat.reduce((s, r) => s + r.cells.reduce((t, c) => t + c.booked, 0), 0),
      weekCapacity: seatCap * 14,
      daysToOpening: Math.max(0, daysBetween(today, lib.openingDate || OPENING)),
      visitsToday: db.visits.filter(v => hzDate(v.at) === today).length,
    },
    pipeline, weekly,
    sectors: SECTORS.map(s => ({ id: s.id, en: s.en, zh: s.zh, count: active.filter(m => m.sector === s.id).length })),
    heat, upcoming,
    floors: db.floors.map(f => ({ ...f, zones: undefined, state: floorState(f, now) })),
    activity: db.activity.slice(0, 12),
  };
});

def('admin.applications', 'admin', ctx => ctx.db.applications.map(a => appView(ctx.db, a, true)).sort((a, b) => b.stageAt.localeCompare(a.stageAt)));

def('admin.application.move', 'admin', (ctx, { id, stage, initiationAt, note }) => {
  const { db } = ctx;
  const a = byId(db.applications, id);
  const s = staffMe(ctx);
  if (!a) fail('找不到这份申请', 'not_found', 404);
  if (!STAGES.some(x => x.id === stage)) fail('未知的阶段');
  if (a.stage === 'welcomed') fail('已入会的申请不能再移动');
  if (a.stage === stage) return appView(db, a, true);
  if (stage === 'initiation') {
    const t = Date.parse(initiationAt || a.initiationAt || '');
    if (!t) fail('请先定好入会仪式的时间');
    a.initiationAt = iso(t);
  }
  a.stage = stage;
  a.stageAt = iso(ctx.now);
  a.history.push({ stage, at: iso(ctx.now), by: s.name });
  if (note) a.notes.push({ at: iso(ctx.now), by: s.name, text: cleanText(note, 300) });
  const lead = byId(db.members, a.leadMemberId);
  if (stage === 'diligence') {
    notify(ctx, 'a:' + a.id, 'stage', '你的申请进入了尽调', '我们会通过你留下的联系方式与你联系。');
  } else if (stage === 'initiation') {
    notify(ctx, 'a:' + a.id, 'stage', '你被邀请参加入会仪式', `${fmtShort(a.initiationAt)}。形式，入会时揭晓。`);
    if (lead) notify(ctx, lead.id, 'referral', `你推荐的 ${a.name} 进入了入会仪式`, `仪式定在 ${fmtShort(a.initiationAt)}。谢谢你的推荐。`);
  } else if (stage === 'welcomed') {
    const no = nextNo(db);
    const hosts = db.staff.filter(x => x.host);
    const host = hosts.sort((x, y) => db.members.filter(m => m.hostId === x.id).length - db.members.filter(m => m.hostId === y.id).length)[0];
    const mid = 'm' + rid(6);
    db.members.push({
      id: mid, no, name: a.name, en: a.en || '', venture: a.venture, sector: a.sector, base: a.base, phone: a.phone,
      hostId: host.id, since: hzDate(ctx.now), status: 'active', secret: 'sv-' + rid(16), bulletinSeenAt: '',
    });
    a.memberId = mid;
    notify(ctx, 'a:' + a.id, 'stage', '欢迎入会', `你的会员编号是 No.${no}，专属服务人员是 ${host.name}。`);
    notify(ctx, mid, 'welcome', `欢迎，No.${no}`, `我是 ${host.name}，你的专属服务人员。有任何需要，按铃即可。`);
    if (lead) notify(ctx, lead.id, 'referral', `你推荐的 ${a.name} 正式入会`, `会员编号 No.${no}。`);
    log(ctx, 'member', `${a.name} 正式入会，成为 No.${no}`);
    ctx.touch('members');
  } else if (stage === 'declined') {
    notify(ctx, 'a:' + a.id, 'stage', '感谢你的申请', '这一次没能成行。俱乐部会在合适的时候再与你联系。');
  }
  if (stage !== 'welcomed') log(ctx, 'application', `${s.name} 将 ${a.name} 移至「${stageOf(stage).zh}」`);
  ctx.touch('applications');
  return appView(db, a, true);
});

def('admin.application.note', 'admin', (ctx, { id, text }) => {
  const a = byId(ctx.db.applications, id);
  if (!a) fail('找不到这份申请', 'not_found', 404);
  text = cleanText(text, 300);
  if (!text) fail('写点什么再保存');
  a.notes.push({ at: iso(ctx.now), by: staffMe(ctx).name, text });
  ctx.touch('applications');
  return appView(ctx.db, a, true);
});

function memberStats(db, m) {
  const visits = db.visits.filter(v => v.memberId === m.id).sort((a, b) => b.at.localeCompare(a.at));
  return {
    visits: visits.length, lastVisit: visits[0] ? visits[0].at : null,
    events: db.rsvps.filter(r => r.memberId === m.id && (r.status === 'going' || r.status === 'attended')).length,
    reservations: db.reservations.filter(r => r.memberId === m.id && r.status !== 'cancelled').length,
    referrals: db.applications.filter(a => a.leadMemberId === m.id).length,
  };
}

def('admin.members', 'admin', ctx => ctx.db.members.map(m => ({
  ...brief(m), phone: m.phone, since: m.since, status: m.status, host: staffView(byId(ctx.db.staff, m.hostId)), stats: memberStats(ctx.db, m),
})).sort((a, b) => a.no.localeCompare(b.no)));

def('admin.member', 'admin', (ctx, { id }) => {
  const { db, now } = ctx;
  const m = byId(db.members, id);
  if (!m) fail('找不到这位会员', 'not_found', 404);
  const app = db.applications.find(a => a.memberId === m.id);
  return {
    ...brief(m), phone: m.phone, since: m.since, status: m.status, hostId: m.hostId, host: staffView(byId(db.staff, m.hostId)), stats: memberStats(db, m),
    application: app ? appView(db, app, true) : null,
    reservations: db.reservations.filter(r => r.memberId === m.id).map(r => resView(db, r)).sort((a, b) => b.date.localeCompare(a.date)),
    events: db.rsvps.filter(r => r.memberId === m.id && r.status !== 'cancelled').map(r => ({ status: r.status, event: eventView(db, byId(db.events, r.eventId), null, now) })).sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt)),
    books: db.books.filter(b => b.holderId === m.id).map(b => ({ ...bookView(db, b, m.id) })),
    referrals: db.applications.filter(a => a.leadMemberId === m.id).map(a => appView(db, a)),
    requests: db.requests.filter(r => r.memberId === m.id),
    visits: db.visits.filter(v => v.memberId === m.id).sort((a, b) => b.at.localeCompare(a.at)),
  };
});

def('admin.member.update', 'admin', (ctx, { id, hostId, status }) => {
  const m = byId(ctx.db.members, id);
  if (!m) fail('找不到这位会员', 'not_found', 404);
  if (hostId) {
    const h = byId(ctx.db.staff, hostId);
    if (!h) fail('找不到这位服务人员');
    if (m.hostId !== h.id) notify(ctx, m.id, 'host', `${h.name} 将成为你的专属服务人员`, '有任何需要，按铃即可。');
    m.hostId = h.id;
  }
  if (status && ['active', 'paused'].includes(status)) m.status = status;
  log(ctx, 'member', `${staffMe(ctx).name} 更新了 ${m.name} 的会员信息`);
  ctx.touch('members');
  return { ok: true };
});

def('admin.events', 'admin', ctx => ctx.db.events.map(e => ({ ...eventView(ctx.db, e, null, ctx.now), createdAt: e.createdAt }))
  .sort((a, b) => b.startsAt.localeCompare(a.startsAt)));

def('admin.event.save', 'admin', (ctx, args) => {
  const { db } = ctx;
  const title = clean(args.title, 40);
  if (!title) fail('请填写标题');
  const date = clean(args.date, 10), from = clean(args.from, 5), to = clean(args.to, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) fail('请填写日期与时间');
  const capacity = parseInt(args.capacity, 10);
  if (!(capacity > 0 && capacity <= 500)) fail('名额需要在 1 到 500 之间');
  if (!EVENT_TYPES[args.type]) fail('请选择类型');
  const data = {
    title, en: clean(args.en, 60), type: args.type, startsAt: atHz(date, from), endsAt: atHz(to <= from ? addDays(date, 1) : date, to),
    venue: clean(args.venue, 40) || '3F Library · 杭州', capacity, color: COLORS.includes(args.color) ? args.color : 'pink',
    description: cleanText(args.description, 400), host: clean(args.host, 20), speakers: String(args.speakers || '').split(/[,，、\s]+/).map(s => clean(s, 20)).filter(Boolean).slice(0, 6),
    membersOnly: args.membersOnly !== false && args.membersOnly !== 'false', status: ['draft', 'published', 'cancelled'].includes(args.status) ? args.status : 'draft',
  };
  let e = args.id ? byId(db.events, args.id) : null;
  const wasPublished = e && e.status === 'published';
  if (e) Object.assign(e, data);
  else db.events.push(e = { id: 'e' + rid(6), ...data, createdAt: iso(ctx.now) });
  if (data.status === 'published' && !wasPublished) log(ctx, 'event', `${staffMe(ctx).name} 发布了「${e.title}」`);
  else log(ctx, 'event', `${staffMe(ctx).name} 编辑了「${e.title}」`);
  if (data.status === 'cancelled') {
    db.rsvps.filter(r => r.eventId === e.id && (r.status === 'going' || r.status === 'waitlist')).forEach(r => notify(ctx, r.memberId, 'rsvp', `活动取消 · ${e.title}`, '抱歉，这场活动取消了。'));
  }
  ctx.touch('events');
  return eventView(db, e, null, ctx.now);
});

def('admin.event.delete', 'admin', (ctx, { id }) => {
  const e = byId(ctx.db.events, id);
  if (!e) fail('找不到这场活动', 'not_found', 404);
  if (e.status !== 'draft') fail('只能删除草稿；已发布的活动请改为「取消」');
  ctx.db.events = ctx.db.events.filter(x => x !== e);
  ctx.touch('events');
  return { ok: true };
});

def('admin.event.attendees', 'admin', (ctx, { id }) => {
  const e = byId(ctx.db.events, id);
  if (!e) fail('找不到这场活动', 'not_found', 404);
  return ctx.db.rsvps.filter(r => r.eventId === id && r.status !== 'cancelled')
    .map(r => ({ id: r.id, status: r.status, createdAt: r.createdAt, member: brief(byId(ctx.db.members, r.memberId)) }))
    .sort((a, b) => (a.status === 'waitlist') - (b.status === 'waitlist') || a.createdAt.localeCompare(b.createdAt));
});

def('admin.reservations', 'admin', (ctx, { date }) => {
  const { db } = ctx;
  const lib = byId(db.floors, 'library');
  date = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : bookingWindow(db, ctx.now)[0];
  const list = db.reservations.filter(r => r.date === date && r.status !== 'cancelled')
    .map(r => ({ ...resView(db, r), member: brief(byId(db.members, r.memberId)) }))
    .sort((a, b) => a.session.localeCompare(b.session) || a.zoneId.localeCompare(b.zoneId));
  const loads = Object.values(SESSIONS).map(s => ({ session: s.id, zh: s.zh, zones: lib.zones.map(z => ({ id: z.id, zh: z.zh, en: z.en, unit: z.unit, capacity: z.capacity, booked: zoneLoad(db, date, s.id, z.id) })) }));
  const days = Array.from({ length: 14 }, (_, i) => addDays(bookingWindow(db, ctx.now)[0], i)).map(d => ({ date: d, count: db.reservations.filter(r => r.date === d && r.status !== 'cancelled').length }));
  return { date, list, loads, days };
});

def('admin.reservation.mark', 'admin', (ctx, { id, status }) => {
  const r = byId(ctx.db.reservations, id);
  if (!r) fail('找不到这个预订', 'not_found', 404);
  if (!['confirmed', 'seated', 'no-show', 'cancelled'].includes(status)) fail('未知状态');
  r.status = status;
  if (status === 'cancelled') notify(ctx, r.memberId, 'reservation', '你的预订已取消', `${r.code}。如有疑问，按铃找礼宾台。`);
  ctx.touch('reservations');
  return resView(ctx.db, r);
});

def('admin.checkin', 'admin', (ctx, { code }) => {
  const { db, now } = ctx;
  code = String(code ?? '').replace(/\D/g, '');
  if (code.length !== 6) fail('入场码是 6 位数字');
  const m = db.members.find(x => x.status === 'active' && [-1, 0, 1].some(k => entryCode(x.secret, now, k) === code));
  if (!m) fail('入场码无效或已过期，请会员刷新钥匙页', 'not_found', 404);
  const today = hzDate(now);
  const lib = byId(db.floors, 'library');
  const recent = db.visits.find(v => v.memberId === m.id && now - Date.parse(v.at) < 30 * 60e3);
  const res = db.reservations.find(r => r.memberId === m.id && r.date === today && r.status === 'confirmed');
  if (res) res.status = 'seated';
  const ev = db.events.find(e => e.status === 'published' && hzDate(e.startsAt) === today && db.rsvps.some(r => r.eventId === e.id && r.memberId === m.id && r.status === 'going'));
  if (ev) db.rsvps.filter(r => r.eventId === ev.id && r.memberId === m.id).forEach(r => { r.status = 'attended'; });
  const place = lib.status === 'open' ? '3F Library · 杭州' : '筹备处 · 杭州';
  if (!recent) {
    db.visits.push({ id: 'v' + rid(8), memberId: m.id, at: iso(now), place, eventId: ev ? ev.id : null, by: staffMe(ctx).id });
    notify(ctx, m.id, 'visit', '欢迎光临', `${place} · ${fmtTime(iso(now))} 已入场。`);
    log(ctx, 'visit', `${m.name}（No.${m.no}）入场`);
  }
  ctx.touch('visits', 'reservations');
  return {
    member: { ...brief(m), since: m.since, host: staffView(byId(db.staff, m.hostId)), stats: memberStats(db, m) },
    reservation: res ? resView(db, res) : null, event: ev ? eventView(db, ev, m.id, now) : null, repeat: !!recent, place,
  };
});

def('admin.visits', 'admin', ctx => ctx.db.visits.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20)
  .map(v => ({ ...v, member: brief(byId(ctx.db.members, v.memberId)) })));

def('admin.books', 'admin', ctx => ctx.db.books.map(b => ({ ...b, holder: brief(byId(ctx.db.members, b.holderId)) })));

def('admin.book.mark', 'admin', (ctx, { id, action }) => {
  const b = byId(ctx.db.books, id);
  if (!b) fail('找不到这本书', 'not_found', 404);
  const holder = byId(ctx.db.members, b.holderId);
  if (action === 'lend') {
    if (b.status !== 'held') fail('只有已预留的书可以借出');
    b.status = 'loan';
    b.dueAt = atHz(addDays(hzDate(ctx.now), 21), '23:59');
    notify(ctx, holder.id, 'book', `《${b.title}》已借出`, `请在 ${b.dueAt ? fmtShort(b.dueAt).split(' ')[0] : ''} 前归还。`);
  } else if (action === 'return') {
    if (b.status !== 'loan') fail('这本书不在借出状态');
    Object.assign(b, { status: 'shelf', holderId: null, heldAt: null, dueAt: null });
    if (holder) notify(ctx, holder.id, 'book', `《${b.title}》已归还`, '谢谢，书已回到书架。');
  } else if (action === 'release') {
    if (b.status !== 'held') fail('这本书没有被预留');
    Object.assign(b, { status: 'shelf', holderId: null, heldAt: null, dueAt: null });
    if (holder) notify(ctx, holder.id, 'book', `《${b.title}》的预留已释放`, '');
  } else fail('未知操作');
  log(ctx, 'book', `${staffMe(ctx).name}：《${b.title}》${{ lend: '借出', return: '归还', release: '释放预留' }[action]}`);
  ctx.touch('books');
  return { ok: true };
});

def('admin.requests', 'admin', ctx => ctx.db.requests.map(r => ({ ...r, member: brief(byId(ctx.db.members, r.memberId)), by: staffView(byId(ctx.db.staff, r.repliedBy)) })));

def('admin.request.reply', 'admin', (ctx, { id, text, close }) => {
  const r = byId(ctx.db.requests, id);
  if (!r) fail('找不到这条请求', 'not_found', 404);
  const s = staffMe(ctx);
  if (close) {
    r.status = 'closed';
  } else {
    text = cleanText(text, 300);
    if (!text) fail('写一句回复');
    Object.assign(r, { reply: text, status: 'replied', repliedAt: iso(ctx.now), repliedBy: s.id });
    notify(ctx, r.memberId, 'request', `${s.name} 回复了你`, text);
    log(ctx, 'request', `${s.name} 回复了 ${(byId(ctx.db.members, r.memberId) || {}).name} 的礼宾请求`);
  }
  ctx.touch('requests');
  return r;
});

def('admin.bulletins', 'admin', ctx => ctx.db.bulletins.map(b => ({ ...b, by: staffView(byId(ctx.db.staff, b.by)) })));

def('admin.bulletin.send', 'admin', (ctx, { title, body }) => {
  title = clean(title, 40);
  body = cleanText(body, 500);
  if (!title || !body) fail('标题和正文都要写');
  const s = staffMe(ctx);
  ctx.db.bulletins.unshift({ id: 'n' + rid(6), title, body, at: iso(ctx.now), by: s.id });
  log(ctx, 'bulletin', `${s.name} 发布了公告「${title}」`);
  ctx.touch('bulletins');
  return { ok: true };
});

def('admin.floor.update', 'admin', (ctx, { id, status, mode }) => {
  const f = byId(ctx.db.floors, id);
  if (!f) fail('找不到这个楼层', 'not_found', 404);
  if (status) {
    if (!['planned', 'preopening', 'open', 'closed'].includes(status)) fail('未知状态');
    if (f.id !== 'library' && status !== 'planned') fail('这一层还在规划中');
    f.status = status;
  }
  if (mode) {
    if (!['auto', 'day', 'night', 'closed'].includes(mode)) fail('未知模式');
    f.mode = mode;
  }
  const st = floorState(f, ctx.now);
  log(ctx, 'floor', `${staffMe(ctx).name} 将 ${f.floor} ${f.name} 设为「${st.zh}」`);
  ctx.touch('floors');
  return { ...f, zones: undefined, state: st };
});

def('admin.reset', 'admin', ctx => {
  const sessions = ctx.db.sessions;
  const fresh = seed(ctx.now);
  Object.keys(ctx.db).forEach(k => delete ctx.db[k]);
  Object.assign(ctx.db, fresh, { sessions });
  ctx.touch('all');
  return { ok: true };
});

/* =========================================================
   Dispatch: the single entry point both modes call.
   ========================================================= */
export function handle(db, { token, method, args, now = Date.now() }) {
  const m = METHODS[method];
  if (!m) fail('未知接口：' + method, 'not_found', 404);
  const session = token ? db.sessions[token] : null;
  if (m.role !== 'public') {
    if (!session) fail('请先登录', 'auth', 401);
    if (m.role !== 'any' && session.role !== m.role) fail('没有权限', 'forbidden', 403);
  }
  const changed = new Set();
  const ctx = { db, now, token, session, touch: (...topics) => topics.forEach(t => changed.add(t)) };
  const result = m.fn(ctx, args && typeof args === 'object' ? args : {});
  return { result: result === undefined ? null : result, changed: [...changed] };
}
export const methodNames = () => Object.keys(METHODS);

/* ---------- formatting used inside notices ---------- */
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function fmtShort(t) {
  const x = hz(t);
  return `${x.m}.${String(x.d).padStart(2, '0')} ${WEEK[x.dow]} ${String(x.h).padStart(2, '0')}:${String(x.mi).padStart(2, '0')}`;
}
export function fmtTime(t) {
  const x = hz(t);
  return `${String(x.h).padStart(2, '0')}:${String(x.mi).padStart(2, '0')}`;
}
