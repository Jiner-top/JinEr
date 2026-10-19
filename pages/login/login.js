const auth = require('../../utils/auth');

const app = getApp();

Page({
  data: {
    studentId: '',
    nickName: '',
    agreed: false,
    loading: false,
    canSubmit: false
  },

  onLoad() {
    // 已经登录了就不用再登，直接退回上一页
    if (auth.isLoggedIn()) {
      this.back();
    }
  },

  /* ---------------- 表单 ---------------- */

  onStudentId(e) {
    this.setData({ studentId: e.detail.value });
    this.validate();
  },

  onNickName(e) {
    this.setData({ nickName: e.detail.value });
    this.validate();
  },

  onAgree() {
    this.setData({ agreed: !this.data.agreed });
    this.validate();
  },

  /** 学号 6~12 位数字，昵称非空，且必须勾选协议 */
  validate() {
    const id = this.data.studentId.trim();
    const name = this.data.nickName.trim();
    const ok = /^\d{6,12}$/.test(id) && name.length > 0 && this.data.agreed;
    this.setData({ canSubmit: ok });
  },

  /* ---------------- 登录 ---------------- */

  onLogin() {
    if (this.data.loading) return;

    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' });
      return;
    }
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请填写正确的学号和昵称', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '登录中', mask: true });

    auth
      .login({
        studentId: this.data.studentId.trim(),
        nickName: this.data.nickName.trim()
      })
      .then((user) => {
        wx.hideLoading();
        if (!auth.saveUser(user)) {
          this.setData({ loading: false });
          wx.showToast({ title: '登录失败，请重试', icon: 'none' });
          return;
        }
        app.setUser(user);
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
          this.back();
        }, 600);
      });
  },

  /** 暂不登录 */
  onSkip() {
    this.back();
  },

  /** 返回来源页；如果是直接打开的登录页，则回到首页 */
  back() {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  }
});
