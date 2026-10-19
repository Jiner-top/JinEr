/**
 * 业务逻辑离线测试：用内存对象模拟 wx.storage，
 * 不打开微信开发者工具也能验证数据层是否正确。
 * 运行：node test-logic.js
 */

/* ---------- 模拟 wx ---------- */
const memory = {};
global.wx = {
  getStorageSync: (k) => (k in memory ? memory[k] : ''),
  setStorageSync: (k, v) => {
    memory[k] = JSON.parse(JSON.stringify(v));
  },
  clearStorageSync: () => {
    Object.keys(memory).forEach((k) => delete memory[k]);
  }
};

const { buildSeats, FLOORS, COLS } = require('./utils/mock');
const store = require('./utils/store');
const { getDays, SLOTS, MAX_SLOTS } = require('./utils/util');

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

console.log('\n[1] 日期工具');
const days = getDays(7);
ok('返回 7 天', days.length === 7);
ok('第一天是今天', days[0].label === '今天');
ok('第二天是明天', days[1].label === '明天');
ok('日期格式正确', /^\d{4}-\d{2}-\d{2}$/.test(days[0].date), days[0].date);
ok('日期连续递增', new Date(days[1].date) - new Date(days[0].date) === 86400000);

console.log('\n[2] 座位生成');
const date = days[0].date;
const seats = buildSeats(2, date);
ok('2F 座位数 = 6x8 = 48', seats.length === FLOORS[0].rows * COLS, String(seats.length));
ok('座位 id 唯一', new Set(seats.map((s) => s.id)).size === seats.length);
ok(
  '状态只含 free/used/fix',
  seats.every((s) => ['free', 'used', 'fix'].includes(s.status))
);
ok('座位编号格式为 2F-N', /^2F-\d+$/.test(seats[0].id), seats[0].id);
ok('座位带上楼层号', seats[0].floor === 2);
ok('座位带上楼层名', seats[0].floorName === FLOORS[0].name, seats[0].floorName);
const again = buildSeats(2, date);
ok(
  '同一日期生成结果稳定（不会每次刷新都变）',
  JSON.stringify(seats) === JSON.stringify(again)
);
const otherDay = buildSeats(2, days[1].date);
ok('换一天状态会变化', JSON.stringify(seats) !== JSON.stringify(otherDay));
const otherFloor = buildSeats(5, date);
ok('换一层座位数不同', otherFloor.length !== seats.length, String(otherFloor.length));
ok('楼层共 7 个（2~8 层）', FLOORS.length === 7, String(FLOORS.length));
ok(
  '楼层号为 2~8 连续',
  FLOORS.map((f) => f.floor).join(',') === '2,3,4,5,6,7,8',
  FLOORS.map((f) => f.floor).join(',')
);
const freeCount = seats.filter((s) => s.status === 'free').length;
ok('空位数量合理（>0 且 < 总数）', freeCount > 0 && freeCount < seats.length, String(freeCount));

console.log('\n[3] 预约存储');
ok('初始没有任何预约记录（不预置演示数据）', store.getAll().length === 0, String(store.getAll().length));

const target = seats.find((s) => s.status === 'free');
const booking = {
  id: 'T1',
  seatId: target.id,
  seatNo: target.no,
  floor: target.floor,
  floorName: target.floorName,
  date: date,
  slots: [1, 2],
  slotLabels: [SLOTS[0].label, SLOTS[1].label],
  status: 'active',
  code: '123456',
  createTime: Date.now()
};
store.add(booking);
ok('新增后记录数 +1', store.getAll().length === 1, String(store.getAll().length));
ok('按 id 能查到', store.getById('T1').seatNo === target.no);

const booked = store.bookedSlotsOf(date, target.id);
ok('已占时段返回 [1,2]', JSON.stringify(booked) === '[1,2]', JSON.stringify(booked));
ok('其他座位不受影响', store.bookedSlotsOf(date, 'A-999').length === 0);

store.update('T1', { status: 'cancel' });
ok('取消后状态变更', store.getById('T1').status === 'cancel');
ok('取消后时段释放', store.bookedSlotsOf(date, target.id).length === 0);

const stats = store.getStats();
ok('统计 total = 1', stats.total === 1, JSON.stringify(stats));
ok('统计 cancel = 1', stats.cancel === 1);
ok('统计 done = 0', stats.done === 0, String(stats.done));

store.remove('T1');
ok('删除后记录数归零', store.getAll().length === 0, String(store.getAll().length));

console.log('\n[4] 规则常量');
ok('时段共 5 个', SLOTS.length === 5);
ok('单次最多 2 个时段', MAX_SLOTS === 2);
ok('时段标签格式正确', /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(SLOTS[0].label));

console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log(fail === 0 ? '✅ 业务逻辑全部通过' : '❌ 有断言失败');
process.exit(fail === 0 ? 0 : 1);
