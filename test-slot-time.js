/**
 * 时段过期规则测试：今天已经过了开始时间的时段不可预约
 * 运行：node test-slot-time.js
 */

const memory = {};
const calls = { toast: 0 };

global.wx = {
  getStorageSync: (k) => (k in memory ? memory[k] : ''),
  setStorageSync: (k, v) => {
    memory[k] = JSON.parse(JSON.stringify(v));
  },
  removeStorageSync: (k) => {
    delete memory[k];
  },
  clearStorageSync: () => {
    Object.keys(memory).forEach((k) => delete memory[k]);
  },
  showToast: () => {
    calls.toast++;
  },
  showModal: () => {},
  navigateTo: () => {},
  stopPullDownRefresh: () => {}
};

global.getApp = () => ({
  globalData: { userInfo: null, pendingSeat: null },
  setUser() {}
});

let captured = null;
global.Page = (cfg) => {
  captured = cfg;
};

const { SLOTS, isSlotExpired, SLOT_MIN_REMAIN_MIN } = require('./utils/util');
const store = require('./utils/store');
const auth = require('./utils/auth');
require('./pages/index/index.js');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ✅ ' + name);
  } else {
    fail++;
    console.log('  ❌ ' + name + (extra ? '  → ' + extra : ''));
  }
}

const at = (s) => new Date(s);

console.log('\n[1] isSlotExpired 纯函数');
ok('默认到时段结束才截止', SLOT_MIN_REMAIN_MIN === 0);
ok('时段带 end 字段', !!SLOTS[0].end, SLOTS[0].end);

ok('08:00-10:00，07:00 未过期', isSlotExpired(SLOTS[0], at('2026-10-19T07:00:00')) === false);
ok('08:00-10:00，08:10 未过期（进行中也能约）', isSlotExpired(SLOTS[0], at('2026-10-19T08:10:00')) === false);
ok('08:00-10:00，09:59 未过期', isSlotExpired(SLOTS[0], at('2026-10-19T09:59:00')) === false);
ok('08:00-10:00，10:00 已结束', isSlotExpired(SLOTS[0], at('2026-10-19T10:00:00')) === true);
ok('14:00-16:00，16:00 已结束', isSlotExpired(SLOTS[2], at('2026-10-19T16:00:00')) === true);
ok('16:00-18:00，16:00 可约', isSlotExpired(SLOTS[3], at('2026-10-19T16:00:00')) === false);
ok('16:00-18:00，16:31 可约', isSlotExpired(SLOTS[3], at('2026-10-19T16:31:00')) === false);
ok('16:00-18:00，17:59 仍可约', isSlotExpired(SLOTS[3], at('2026-10-19T17:59:00')) === false);
ok('16:00-18:00，18:00 已结束', isSlotExpired(SLOTS[3], at('2026-10-19T18:00:00')) === true);

console.log('\n[2] 页面：16:00 打开选座面板');
auth.saveUser({
  nickName: '张三',
  studentId: '2023010114',
  college: '计算机学院',
  openid: 'mock_t',
  loginTime: Date.now()
});

const page = Object.assign({}, captured, {
  data: JSON.parse(JSON.stringify(captured.data)),
  setData(patch, cb) {
    Object.assign(this.data, patch);
    if (typeof cb === 'function') cb();
  }
});

const TODAY = '2026-10-19';
const NOW = '2026-10-19T16:00:00';
page.now = () => at(NOW);
page.setData({ activeDate: TODAY, activeFloor: 2 });
page.refresh();

const seat = page.data.seats.filter((s) => s.status === 'free')[0];
page.openPanelFor(seat);

const get = (id) => page.data.slots.filter((s) => s.id === id)[0];

ok('08:00 时段置灰', get(1).disabled === true);
ok('08:00 时段标注「已过时段」', get(1).tip === '已过时段', get(1).tip);
ok('10:00 时段置灰', get(2).disabled === true);
ok('14:00 时段置灰（16 点已结束）', get(3).disabled === true);
ok('16:00 时段可预约', get(4).disabled === false);
ok('19:00 时段可预约', get(5).disabled === false);
ok('没有冲突提示（未预约过）', page.data.conflictTip === '', page.data.conflictTip);

console.log('\n[2b] 16:31 打开面板：16:00-18:00 必须还能约');
page.now = () => at('2026-10-19T16:31:00');
page.openPanelFor(seat);
ok('16:00-18:00 可预约', get(4).disabled === false, get(4).tip);
ok('19:00-21:00 可预约', get(5).disabled === false, get(5).tip);
ok('14:00-16:00 已结束', get(3).disabled === true);
ok('08:00 已结束', get(1).disabled === true);

console.log('\n[3] 页面：早上 07:00 打开，全部可约');
page.now = () => at('2026-10-19T07:00:00');
page.openPanelFor(seat);
ok('07:00 时五个时段都可约', page.data.slots.every((s) => !s.disabled));

console.log('\n[4] 页面：21:30 打开，全部过期');
page.now = () => at('2026-10-19T21:30:00');
page.openPanelFor(seat);
ok('21:30 时五个时段全部置灰', page.data.slots.every((s) => s.disabled));
ok(
  '给出「今日时段已结束」提示',
  page.data.conflictTip.indexOf('已结束') > -1,
  page.data.conflictTip
);

console.log('\n[5] 明天的时段不受当前时间影响');
page.now = () => at(NOW);
page.setData({ activeDate: '2026-10-20' });
page.refresh();
const seatTomorrow = page.data.seats.filter((s) => s.status === 'free')[0];
page.openPanelFor(seatTomorrow);
ok('明天的 08:00 时段可约', page.data.slots.filter((s) => s.id === 1)[0].disabled === false);
ok('明天五个时段都可约', page.data.slots.every((s) => !s.disabled));

console.log('\n[6] 提交时二次校验：过期时段被拦截');
page.setData({ activeDate: TODAY });
page.refresh();
page.now = () => at(NOW);
const seatToday = page.data.seats.filter((s) => s.status === 'free')[0];
page.openPanelFor(seatToday);

const before = store.getAll().length;
// 绕过界面，强行把已过期时段标记为选中
page.setData({
  selectedSlots: [1],
  slots: page.data.slots.map((s) => Object.assign({}, s, { checked: s.id === 1 }))
});
calls.toast = 0;
page.confirmBooking();

ok('过期时段提交被拦截', store.getAll().length === before, String(store.getAll().length));
ok('给出「已过时间」提示', calls.toast > 0, String(calls.toast));
ok('面板已关闭', page.data.showPanel === false);

console.log('\n[7] 正常时段仍可预约');
page.openPanelFor(seatToday);
page.toggleSlot({ currentTarget: { dataset: { id: 4 } } });
ok('16:00 时段可选中', page.data.selectedSlots.join(',') === '4');
page.confirmBooking();
ok(
  '16:00 预约成功',
  store.getAll().filter((b) => b.seatId === seatToday.id && b.status === 'active').length === 1
);

console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log(fail === 0 ? '✅ 时段过期规则通过' : '❌ 有断言失败');
process.exit(fail === 0 ? 0 : 1);
