/**
 * 「我的预约」页面逻辑测试
 * 用假的 Page / wx 把页面配置跑起来，验证 tab 切换、取消预约等行为。
 * 运行：node test-my-page.js
 */

const memory = {};
const calls = { modal: 0, navigate: 0, toast: 0 };

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
  showModal: (opt) => {
    calls.modal++;
    // 模拟用户点「确定」
    if (opt && typeof opt.success === 'function') opt.success({ confirm: true });
  },
  navigateTo: () => {
    calls.navigate++;
  },
  switchTab: () => {}
};

let captured = null;
global.Page = function (cfg) {
  captured = cfg;
};

const store = require('./utils/store');
const auth = require('./utils/auth');
require('./pages/my/my.js');

if (!captured) {
  console.log('❌ 未能捕获 Page 配置');
  process.exit(1);
}

/* 模拟小程序页面实例 */
const page = Object.assign({}, captured, {
  data: JSON.parse(JSON.stringify(captured.data)),
  setData(patch, cb) {
    Object.assign(this.data, patch);
    if (typeof cb === 'function') cb();
  }
});

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

const base = {
  seatId: '2F-1',
  seatNo: '2F 1号',
  floor: 2,
  floorName: '二楼 · 综合阅览',
  date: '2026-10-19',
  slots: [1],
  slotLabels: ['08:00-10:00'],
  code: '000000',
  createTime: Date.now()
};

/* 准备数据：1 条已完成 + 1 条进行中 */
auth.saveUser({
  nickName: '张三',
  studentId: '2023010114',
  college: '计算机学院',
  openid: 'mock_my',
  loginTime: Date.now()
});

store.add(
  Object.assign({}, base, {
    id: 'T-DONE',
    seatId: '3F-3',
    seatNo: '3F 3号',
    floor: 3,
    floorName: '三楼 · 社科借阅',
    status: 'done'
  })
);
store.add(
  Object.assign({}, base, {
    id: 'T-ACTIVE',
    seatId: '5F-5',
    seatNo: '5F 5号',
    floor: 5,
    floorName: '五楼 · 文学阅览',
    slots: [3],
    slotLabels: ['14:00-16:00'],
    status: 'active'
  })
);

console.log('\n[1] tab 筛选');
page.load('all');
ok('全部 = 2 条', page.data.list.length === 2, String(page.data.list.length));
ok('全部角标 = 2', page.data.tabs.find((t) => t.key === 'all').count === 2);

page.load('active');
ok('进行中 = 1 条', page.data.list.length === 1, String(page.data.list.length));
ok('进行中里只有 active 状态', page.data.list.every((b) => b.status === 'active'));
ok('进行中角标 = 1', page.data.tabs.find((t) => t.key === 'active').count === 1);
ok('进行中空状态文案正确', page.data.emptyText === '暂无进行中的预约', page.data.emptyText);

page.load('done');
ok('已完成 = 1 条', page.data.list.length === 1, String(page.data.list.length));
ok('已完成里只有 done 状态', page.data.list.every((b) => b.status === 'done'));
ok('已完成空状态文案正确', page.data.emptyText === '暂无已完成的预约', page.data.emptyText);

console.log('\n[2] 点击 tab 切换');
page.data.activeTab = 'all';
page.load();
page.onTab({ currentTarget: { dataset: { key: 'done' } } });
ok('点击后 activeTab 更新', page.data.activeTab === 'done', page.data.activeTab);
ok('点击后列表被筛选', page.data.list.length === 1 && page.data.list[0].status === 'done');

page.onTab({ currentTarget: { dataset: { key: 'active' } } });
ok('切到进行中列表正确', page.data.list.length === 1 && page.data.list[0].id === 'T-ACTIVE');

page.onTab({ currentTarget: { dataset: { key: 'active' } } });
ok('重复点同一个 tab 不报错', page.data.activeTab === 'active');

console.log('\n[3] 取消预约的按钮行为');
page.data.activeTab = 'all';
page.load();

calls.navigate = 0;
calls.modal = 0;
page.onCancel({ currentTarget: { dataset: { id: 'T-ACTIVE', status: 'active' } } });
ok('点击「取消预约」不会跳转到详情页', calls.navigate === 0, '跳转次数=' + calls.navigate);
ok('点击「取消预约」弹出确认框', calls.modal === 1, '弹窗次数=' + calls.modal);
ok('确认后状态变为已取消', store.getById('T-ACTIVE').status === 'cancel', store.getById('T-ACTIVE').status);

calls.navigate = 0;
page.onOpen({ currentTarget: { dataset: { id: 'T-ACTIVE' } } });
ok('点击卡片才跳转详情页', calls.navigate === 1, '跳转次数=' + calls.navigate);

calls.navigate = 0;
page.onOpen({ currentTarget: { dataset: { id: '' } } });
ok('空 id 不触发跳转', calls.navigate === 0);

console.log('\n[4] 取消后记录应从列表消失');
page.load('all');
ok('全部里不再出现已取消的记录', !page.data.list.some((b) => b.id === 'T-ACTIVE'));
ok('全部只剩 1 条', page.data.list.length === 1, String(page.data.list.length));
ok('全部角标同步为 1', page.data.tabs.find((t) => t.key === 'all').count === 1);

page.load('active');
ok('进行中列表为空', page.data.list.length === 0);
ok('进行中显示空状态', page.data.emptyText === '暂无进行中的预约');

console.log('\n[5] 已完成记录也能取消');
store.add(
  Object.assign({}, base, {
    id: 'T-DONE2',
    seatId: 'A-9',
    seatNo: 'A区 09号',
    slots: [4],
    slotLabels: ['16:00-18:00'],
    status: 'done'
  })
);

page.load('done');
ok('已完成列表包含该记录', page.data.list.some((b) => b.id === 'T-DONE2'));

calls.modal = 0;
calls.navigate = 0;
page.onCancel({ currentTarget: { dataset: { id: 'T-DONE2', status: 'done' } } });
ok('已完成记录可取消', store.getById('T-DONE2').status === 'cancel', store.getById('T-DONE2').status);
ok('取消已完成记录会弹确认框', calls.modal === 1, String(calls.modal));
ok('取消已完成记录不跳转详情', calls.navigate === 0, String(calls.navigate));

page.load('done');
ok('取消后从已完成列表消失', !page.data.list.some((b) => b.id === 'T-DONE2'));
page.load('all');
ok('取消后也不再出现在全部列表', !page.data.list.some((b) => b.id === 'T-DONE2'));

console.log('\n[6] 操作按钮显示标记');
store.add(Object.assign({}, base, { id: 'F-A', seatId: 'C-1', status: 'active' }));
store.add(Object.assign({}, base, { id: 'F-D', seatId: 'C-2', status: 'done' }));
store.add(Object.assign({}, base, { id: 'F-C', seatId: 'C-3', status: 'cancel' }));

page.load('all');
const find = (id) => page.data.list.filter((x) => x.id === id)[0];

ok('全部里能拿到进行中记录', !!find('F-A'));
ok('进行中 canCancel = true', find('F-A').canCancel === true);
ok('进行中 canShowCode = true', find('F-A').canShowCode === true);
ok('已完成 canCancel = true', find('F-D').canCancel === true);
ok('已完成 canShowCode = false', find('F-D').canShowCode === false);
ok('已取消的记录不出现在列表里', find('F-C') === undefined);

console.log('\n[7] 全部 tab 里取消，记录应消失');
calls.modal = 0;
calls.navigate = 0;
page.onCancel({ currentTarget: { dataset: { id: 'F-A', status: 'active' } } });
ok('取消生效', store.getById('F-A').status === 'cancel', store.getById('F-A').status);
page.load('all');
ok('取消后从全部列表消失', !page.data.list.some((b) => b.id === 'F-A'));
ok('全部列表仍有其他记录', page.data.list.length > 0, String(page.data.list.length));

console.log('\n[8] 未登录不展示预约信息');
auth.logout();
page.data.activeTab = 'all';
page.load();
ok('未登录时列表为空', page.data.list.length === 0, String(page.data.list.length));
ok('未登录时 isLoggedIn 为 false', page.data.isLoggedIn === false);
ok('未登录时提示去登录', page.data.emptyText === '登录后查看预约记录', page.data.emptyText);
ok(
  '未登录时角标全部为 0',
  page.data.tabs.every((t) => t.count === 0),
  JSON.stringify(page.data.tabs.map((t) => t.count))
);
ok('数据仍保存在本地（只是不展示）', store.getAll().length > 0, String(store.getAll().length));

calls.navigate = 0;
page.onEmptyTap();
ok('点空状态会跳登录页', calls.navigate === 1, String(calls.navigate));

auth.saveUser({
  nickName: '张三',
  studentId: '2023010114',
  college: '计算机学院',
  openid: 'mock_my',
  loginTime: Date.now()
});
page.load();
ok('重新登录后数据恢复', page.data.list.length > 0, String(page.data.list.length));

console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log(fail === 0 ? '✅ 我的预约页面逻辑通过' : '❌ 有断言失败');
process.exit(fail === 0 ? 0 : 1);
