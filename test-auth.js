/**
 * 登录页 / 登录态 逻辑测试
 * 运行：node test-auth.js
 */

const memory = {};
const calls = { toast: 0, modal: 0, login: 0, navigateTo: 0, navigateBack: 0, switchTab: 0 };
let pageStackDepth = 2; // 模拟"从其他页面跳进登录页"

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
  login: (opt) => {
    calls.login++;
    if (opt && typeof opt.success === 'function') opt.success({ code: 'test-code-123456' });
  },
  showToast: () => {
    calls.toast++;
  },
  showLoading: () => {},
  hideLoading: () => {},
  showModal: (opt) => {
    calls.modal++;
    if (opt && typeof opt.success === 'function') opt.success({ confirm: true });
  },
  navigateTo: () => {
    calls.navigateTo++;
  },
  navigateBack: () => {
    calls.navigateBack++;
  },
  switchTab: () => {
    calls.switchTab++;
  },
  reLaunch: () => {}
};

global.getCurrentPages = () => new Array(pageStackDepth).fill({});

/* 模拟 App 实例 */
const appStub = {
  globalData: { userInfo: null, pendingSeat: null },
  setUser(u) {
    this.globalData.userInfo = u;
  }
};
global.getApp = () => appStub;

let captured = null;
global.Page = (cfg) => {
  captured = cfg;
};

const auth = require('./utils/auth');
const store = require('./utils/store');

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

const tick = () => new Promise((r) => setTimeout(r, 0));

function makePage(cfg) {
  return Object.assign({}, cfg, {
    data: JSON.parse(JSON.stringify(cfg.data)),
    setData(patch, cb) {
      Object.assign(this.data, patch);
      if (typeof cb === 'function') cb();
    }
  });
}

(async function () {
  console.log('\n[1] auth 模块');
  ok('初始未登录', auth.isLoggedIn() === false);

  const u1 = await auth.login({ studentId: '2023010114', nickName: '张三' });
  ok('login 调用了 wx.login', calls.login === 1, String(calls.login));
  ok('昵称使用传入值', u1.nickName === '张三', u1.nickName);
  ok('学号使用传入值', u1.studentId === '2023010114', u1.studentId);
  ok('openid 由 code 派生', u1.openid === 'mock_123456', u1.openid);

  const u2 = await auth.login();
  ok('不传参数时使用默认昵称', u2.nickName === '林同学', u2.nickName);

  auth.saveUser(u1);
  ok('保存后 isLoggedIn 为 true', auth.isLoggedIn() === true);
  auth.logout();
  ok('退出后 isLoggedIn 为 false', auth.isLoggedIn() === false);

  console.log('\n[2] 登录页 · 表单校验');
  require('./pages/login/login.js');
  const loginPage = makePage(captured);

  ok('初始不可提交', loginPage.data.canSubmit === false);

  loginPage.onStudentId({ detail: { value: '123' } });
  ok('学号太短不可提交', loginPage.data.canSubmit === false);

  loginPage.onStudentId({ detail: { value: 'abc12345' } });
  ok('学号含字母不可提交', loginPage.data.canSubmit === false);

  loginPage.onStudentId({ detail: { value: '2023010114' } });
  loginPage.onNickName({ detail: { value: '  ' } });
  ok('昵称为空不可提交', loginPage.data.canSubmit === false);

  loginPage.onNickName({ detail: { value: '张三' } });
  ok('未勾协议仍不可提交', loginPage.data.canSubmit === false);

  loginPage.onAgree();
  ok('勾选协议后变为可提交', loginPage.data.canSubmit === true);
  ok('勾选状态记录正确', loginPage.data.agreed === true);

  console.log('\n[3] 登录页 · 提交登录');
  calls.toast = 0;
  loginPage.setData({ agreed: false, canSubmit: false });
  loginPage.onLogin();
  ok('未勾协议时拦截提交', auth.isLoggedIn() === false);
  ok('未勾协议时给出提示', calls.toast > 0, String(calls.toast));

  loginPage.setData({ agreed: true, canSubmit: true });
  loginPage.onLogin();
  await tick();
  ok('登录成功写入 storage', auth.isLoggedIn() === true);
  ok('登录信息使用表单填写值', auth.getUser().studentId === '2023010114', auth.getUser().studentId);
  ok('登录昵称使用表单填写值', auth.getUser().nickName === '张三', auth.getUser().nickName);
  ok('登录态同步到全局 App', appStub.globalData.userInfo.nickName === '张三');

  console.log('\n[4] 登录页 · 返回逻辑');
  calls.navigateBack = 0;
  calls.switchTab = 0;
  pageStackDepth = 2;
  loginPage.back();
  ok('有来源页时用 navigateBack 返回', calls.navigateBack === 1 && calls.switchTab === 0);

  calls.navigateBack = 0;
  calls.switchTab = 0;
  pageStackDepth = 1;
  loginPage.back();
  ok('直接打开时回到首页', calls.switchTab === 1 && calls.navigateBack === 0);

  console.log('\n[5] 我的页面 · 未登录跳登录页');
  require('./pages/profile/profile.js');
  const profile = makePage(captured);

  auth.logout();
  appStub.globalData.userInfo = null;
  profile.onShow();
  ok('未登录状态正确', profile.data.isLoggedIn === false);

  calls.navigateTo = 0;
  profile.onLogin();
  ok('点登录会跳转登录页', calls.navigateTo === 1, String(calls.navigateTo));

  auth.saveUser({ nickName: '李四', studentId: '2023019999', college: '计算机学院' });
  appStub.setUser(auth.getUser());
  profile.onShow();
  ok('登录后我的页面显示昵称', profile.data.user.nickName === '李四');
  ok('登录后头像取首字', profile.data.avatarText === '李');

  calls.modal = 0;
  profile.onLogout();
  await tick();
  ok('退出登录会弹确认框', calls.modal === 1);
  ok('退出后状态复位', profile.data.isLoggedIn === false && auth.getUser() === null);

  console.log('\n[6] 首页 · 未登录点座位跳登录页并续接');
  require('./pages/index/index.js');
  const index = makePage(captured);
  index.data.activeDate = '2026-10-19';
  index.data.activeArea = 'A';

  const seat = { id: 'A-1', no: 'A区 1号', status: 'free', areaName: 'A区 · 靠窗' };

  calls.navigateTo = 0;
  index.onSeatSelect({ detail: { seat } });
  ok('未登录点座位跳登录页', calls.navigateTo === 1, String(calls.navigateTo));
  ok('座位被暂存到全局', appStub.globalData.pendingSeat && appStub.globalData.pendingSeat.id === 'A-1');
  ok('未登录时不打开面板', index.data.showPanel === false);

  // 模拟用户在登录页登录成功，返回首页
  auth.saveUser({
    nickName: '王五',
    studentId: '2023010001',
    college: '计算机学院',
    openid: 'mock_wangwu',
    loginTime: Date.now()
  });
  appStub.setUser(auth.getUser());
  index.onShow();
  ok('返回后自动打开时段面板', index.data.showPanel === true);
  ok('面板里是刚才点的座位', index.data.selectedSeat.id === 'A-1');
  ok('暂存座位已清空', appStub.globalData.pendingSeat === null);

  // 已登录再点座位，直接开面板，不跳登录
  index.setData({ showPanel: false });
  calls.navigateTo = 0;
  index.onSeatSelect({ detail: { seat: { id: 'A-2', no: 'A区 2号', status: 'free' } } });
  ok('已登录点座位不跳登录页', calls.navigateTo === 0);
  ok('已登录直接打开面板', index.data.showPanel === true);

  console.log('\n[7] 登录态持久化');
  ok('storage 中有用户', !!auth.getUser());
  ok('用户含 openid', !!auth.getUser().openid);
  ok('用户含登录时间', typeof auth.getUser().loginTime === 'number');

  console.log('\n[8] 重置数据后预约列表应为空');
  auth.saveUser({
    nickName: '王五',
    studentId: '2023010001',
    college: '计算机学院',
    openid: 'mock_wangwu',
    loginTime: Date.now()
  });
  store.add({
    id: 'R1',
    seatId: '2F-1',
    seatNo: '2F 1号',
    floor: 2,
    floorName: '二楼 · 综合阅览',
    date: '2026-10-19',
    slots: [1],
    slotLabels: ['08:00-10:00'],
    status: 'active',
    code: '111111',
    createTime: Date.now()
  });
  ok('重置前有预约记录', store.getAll().length === 1, String(store.getAll().length));

  profile.onReset();
  await tick();
  ok('重置后预约记录清空', store.getAll().length === 0, String(store.getAll().length));
  ok('重置后不再自动补演示数据', store.getAll().length === 0);
  ok('重置后仍保持登录', auth.isLoggedIn() === true);

  console.log('\n----------------------------------------');
  console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  console.log(fail === 0 ? '✅ 登录页 / 登录态逻辑通过' : '❌ 有断言失败');
  process.exit(fail === 0 ? 0 : 1);
})();
