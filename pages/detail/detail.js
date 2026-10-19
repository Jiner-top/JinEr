const store = require('../../utils/store');
const auth = require('../../utils/auth');
const { SLOT_HOURS } = require('../../utils/util');

const STATUS_TEXT = {
  active: '进行中',
  done: '已完成',
  cancel: '已取消'
};

Page({
  data: {
    booking: null,
    statusText: '',
    hours: 0
  },

  onLoad(options) {
    this.id = options.id;
  },

  onShow() {
    // 未登录不允许查看预约详情
    if (!auth.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 600);
      return;
    }
    this.load();
  },

  load() {
    const b = store.getById(this.id);
    if (!b) {
      wx.showToast({ title: '预约记录不存在', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 800);
      return;
    }

    wx.setNavigationBarTitle({ title: b.seatNo });

    this.setData({
      booking: Object.assign({}, b, {
        slotText: (b.slotLabels || []).join('  /  '),
        // 兼容早期存成 areaName 的旧记录
        areaText: b.floorName || b.areaName || '未知楼层'
      }),
      statusText: STATUS_TEXT[b.status] || '',
      hours: (b.slots || []).length * SLOT_HOURS
    });
  },

  /** 长按/点击签到码可复制，方便去自助机输入 */
  onCopyCode() {
    wx.setClipboardData({
      data: this.data.booking.code,
      success() {
        wx.showToast({ title: '签到码已复制', icon: 'none' });
      }
    });
  },

  onCancel() {
    const that = this;
    wx.showModal({
      title: '取消预约',
      content: '取消后座位将立即释放，确定要取消吗？',
      confirmColor: '#E5484D',
      success(res) {
        if (!res.confirm) return;
        store.update(that.id, { status: 'cancel' });
        wx.showToast({ title: '已取消', icon: 'none' });
        that.load();
      }
    });
  }
});
