/**
 * 预约冲突规则测试：一个人同一时段只能占一个座位（跨楼层也受限）
 * 运行：node test-conflict.js
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

const page = Object.assign({}, captured, {
  data: JSON.parse(JSON.stringify(captured.data)),
  setData(patch, cb) {
    Object.assign(this.data, patch);
    if (typeof cb === 'function') cb();
  }
});

/* 准备：已登录，固定日期 */
auth.saveUser({
  nickName: '张三',
  studentId: '2023010114',
  college: '计算机学院',
  openid: 'mock_test',
  loginTime: Date.now()
});

// 把"当前时间"固定在早上 7 点，避免「时段已过」规则干扰冲突用例
page.now = () => new Date('2026-10-19T07:00:00');

page.setData({ activeDate: '2026-10-19', activeFloor: 2 });
page.refresh();

const seat2f = page.data.seats.filter((s) => s.status === 'free')[0];
ok('2F 找到空位', !!seat2f, seat2f && seat2f.no);

console.log('\n[1] 首次预约');
page.openPanelFor(seat2f);
ok('未预约时所有时段可选', page.data.slots.every((s) => !s.disabled));
ok('未预约时没有冲突提示', page.data.conflictTip === '', page.data.conflictTip);

page.toggleSlot({ currentTarget: { dataset: { id: 1 } } });
ok('时段 1 被选中', page.data.selectedSlots.join(',') === '1');
page.confirmBooking();

const saved = store.getAll().filter((b) => b.seatId === seat2f.id && b.status === 'active');
ok('预约写入成功', saved.length === 1, String(saved.length));
ok('预约记录带楼层信息', saved[0] && saved[0].floor === 2, saved[0] && String(saved[0].floor));

console.log('\n[2] 同座位再次打开：已约时段置灰');
page.openPanelFor(seat2f);
const sameSlot = page.data.slots.filter((s) => s.id === 1)[0];
ok('同座位已约时段被禁用', sameSlot.disabled === true);
ok('提示文案为「已被预约」', sameSlot.tip === '已被预约', sameSlot.tip);
ok('同座位不算冲突（不提示其他座位）', page.data.conflictTip === '', page.data.conflictTip);

console.log('\n[3] 换楼层：同一时段必须被禁用');
page.setData({ activeFloor: 3 });
page.refresh();
const seat3f = page.data.seats.filter((s) => s.status === 'free')[0];
ok('3F 找到空位', !!seat3f, seat3f && seat3f.no);

page.openPanelFor(seat3f);
const crossSlot = page.data.slots.filter((s) => s.id === 1)[0];
ok('跨楼层同一时段被禁用', crossSlot.disabled === true);
ok('提示指向已约的座位号', crossSlot.tip.indexOf(seat2f.no) > -1, crossSlot.tip);
ok('出现冲突提示条', page.data.conflictTip.length > 0, page.data.conflictTip);
ok('冲突提示里带已约座位号', page.data.conflictTip.indexOf(seat2f.no) > -1, page.data.conflictTip);
ok('其他时段仍可选', page.data.slots.filter((s) => s.id === 2)[0].disabled === false);

console.log('\n[4] 绕过界面强行提交：必须被拦截');
const before = store.getAll().length;
page.setData({
  selectedSlots: [1],
  slots: page.data.slots.map((s) =>
    Object.assign({}, s, { checked: s.id === 1 })
  )
});
calls.toast = 0;
page.confirmBooking();
ok('冲突时段提交被拦截', store.getAll().length === before, String(store.getAll().length));
ok('给出冲突提示', calls.toast > 0, String(calls.toast));
ok('提交后关闭面板', page.data.showPanel === false);

console.log('\n[5] 选其他时段可以正常预约');
page.openPanelFor(seat3f);
page.toggleSlot({ currentTarget: { dataset: { id: 2 } } });
ok('时段 2 可选并选中', page.data.selectedSlots.join(',') === '2');
page.confirmBooking();
ok('3F 新预约成功', store.getAll().filter((b) => b.seatId === seat3f.id && b.status === 'active').length === 1);

console.log('\n[6] 取消后时段释放，可再约其他楼层');
const b2f = store.getAll().filter((b) => b.seatId === seat2f.id && b.status === 'active')[0];
store.update(b2f.id, { status: 'cancel' });
page.setData({ activeFloor: 4 });
page.refresh();
const seat4f = page.data.seats.filter((s) => s.status === 'free')[0];
page.openPanelFor(seat4f);
ok('取消后时段 1 重新可选', page.data.slots.filter((s) => s.id === 1)[0].disabled === false);
ok(
  '冲突提示不再包含已取消的座位',
  page.data.conflictTip.indexOf(seat2f.no) === -1,
  page.data.conflictTip
);

console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log(fail === 0 ? '✅ 预约冲突规则通过' : '❌ 有断言失败');
process.exit(fail === 0 ? 0 : 1);
