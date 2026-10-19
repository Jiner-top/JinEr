const auth = require('./utils/auth');

App({
  globalData: {
    // 当前登录用户，未登录为 null
    userInfo: null,
    // 未登录时点了座位，登录成功后要接着打开这个座位的时段面板
    pendingSeat: null
  },

  onLaunch() {
    // 恢复上次的登录态（不预置任何演示预约数据，列表从空开始）
    this.globalData.userInfo = auth.getUser();
  },

  /** 登录成功后同步到全局 */
  setUser(user) {
    this.globalData.userInfo = user;
  }
});
