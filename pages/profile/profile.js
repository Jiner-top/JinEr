const store = require('../../utils/store');
const auth = require('../../utils/auth');
const { SLOT_HOURS } = require('../../utils/util');

const app = getApp();

Page({
  data: {
    user: null,
    avatarText: '',
    isLoggedIn: false,
    stats: { total: 0, active: 0, done: 0, cancel: 0 },
    hours: 0,
    menus: [
      { key: 'notice', name: '预约规则' },
      { key: 'feedback', name: '意见反馈' },
      { key: 'about', name: '关于本程序' }
    ]
  },

  onShow() {
    this.refresh();
  },

  /** 刷新用户信息与统计（未登录时统计一律为 0，不泄露预约数据） */
  refresh() {
    const user = auth.getUser();
    const logged = !!user;
    const list = logged ? store.getAll() : [];
    const hours = list.reduce(function (sum, b) {
      return sum + (b.status === 'done' ? (b.slots || []).length * SLOT_HOURS : 0);
    }, 0);

    this.setData({
      user: user,
      avatarText: logged ? (user.nickName || '同').charAt(0) : '',
      isLoggedIn: logged,
      stats: logged
        ? store.getStats()
        : { total: 0, active: 0, done: 0, cancel: 0 },
      hours: hours
    });
  },

  /* ---------------- 登录 / 退出 ---------------- */

  onLogin() {
    if (this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onLogout() {
    if (!this.data.isLoggedIn) return;

    const that = this;
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能预约座位，确定吗？',
      confirmColor: '#E5484D',
      success(res) {
        if (!res.confirm) return;
        auth.logout();
        app.setUser(null);
        wx.showToast({ title: '已退出登录', icon: 'none' });
        that.refresh();
      }
    });
  },

  /* ---------------- 其他 ---------------- */

  onMenu() {
    wx.showToast({ title: '演示项目，暂未接入', icon: 'none' });
  },

  /** 清空本地数据，方便反复演示 */
  onReset() {
    wx.showModal({
      title: '重置演示数据',
      content: '将清除本机所有预约记录，列表会恢复为空（不会退出登录）。',
      confirmColor: '#E5484D',
      success(res) {
        if (!res.confirm) return;
        const user = auth.getUser();
        wx.clearStorageSync();
        // 只保留登录态，预约记录全部清空，不再补演示数据
        if (user) auth.saveUser(user);
        wx.showToast({ title: '已重置', icon: 'success' });
        setTimeout(function () {
          wx.reLaunch({ url: '/pages/index/index' });
        }, 700);
      }
    });
  }
});
