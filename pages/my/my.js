const store = require('../../utils/store');
const auth = require('../../utils/auth');
const { SLOT_HOURS } = require('../../utils/util');

const TABS = [
  { key: 'all', name: '全部' },
  { key: 'active', name: '进行中' },
  { key: 'done', name: '已完成' }
];

const STATUS_TEXT = {
  active: '进行中',
  done: '已完成',
  cancel: '已取消'
};

// 每个 tab 对应的空状态文案，避免"切了但看起来没反应"
const EMPTY = {
  all: { text: '还没有预约记录', sub: '去首页挑一个心仪的座位吧' },
  active: { text: '暂无进行中的预约', sub: '去首页约一个座位吧' },
  done: { text: '暂无已完成的预约', sub: '签到完成后记录会出现在这里' }
};

// 未登录时的空状态
const GUEST_EMPTY = {
  text: '登录后查看预约记录',
  sub: '点击这里去登录'
};

Page({
  data: {
    tabs: TABS,
    activeTab: 'all',
    list: [],
    isLoggedIn: false,
    emptyText: EMPTY.all.text,
    emptySub: EMPTY.all.sub
  },

  onShow() {
    // 用 onShow 而不是 onLoad，保证从详情页返回时列表是最新的
    this.load();
  },

  /**
   * 加载列表
   * @param {string} tabOverride 显式传入要筛选的状态，不依赖 setData 的时序
   */
  load(tabOverride) {
    const tab = tabOverride || this.data.activeTab;

    // 未登录不展示任何预约信息
    if (!auth.isLoggedIn()) {
      this.setData({
        isLoggedIn: false,
        list: [],
        tabs: TABS.map(function (t) {
          return Object.assign({}, t, { count: 0 });
        }),
        emptyText: GUEST_EMPTY.text,
        emptySub: GUEST_EMPTY.sub
      });
      return;
    }

    const all = store.getAll();

    const list = all
      .filter(function (b) {
        // 已取消的记录从所有列表里移除（数据仍保留在本地，便于追溯）
        if (b.status === 'cancel') return false;
        return tab === 'all' ? true : b.status === tab;
      })
      .map(function (b) {
        return Object.assign({}, b, {
          statusText: STATUS_TEXT[b.status] || '未知',
          slotText: (b.slotLabels || []).join('  /  '),
          hours: (b.slots || []).length * SLOT_HOURS,
          // 兼容早期存成 areaName 的旧记录
          floorName: b.floorName || b.areaName || '未知楼层',
          // 把显示逻辑算成布尔值，避免 WXML 里写复杂表达式
          canCancel: b.status === 'active' || b.status === 'done',
          canShowCode: b.status === 'active'
        });
      });

    // 顺便刷新每个 tab 的数量角标（已取消的不计入）
    const counts = { all: 0, active: 0, done: 0 };
    all.forEach(function (b) {
      if (b.status === 'cancel') return;
      counts.all++;
      if (counts[b.status] !== undefined) counts[b.status]++;
    });
    const tabs = TABS.map(function (t) {
      return Object.assign({}, t, { count: counts[t.key] || 0 });
    });

    const empty = EMPTY[tab] || EMPTY.all;

    this.setData({
      isLoggedIn: true,
      list: list,
      tabs: tabs,
      emptyText: empty.text,
      emptySub: empty.sub
    });
  },

  /** 未登录时点空状态去登录 */
  onEmptyTap() {
    if (this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeTab) return;

    // 先更新高亮，再把 tab 显式传给 load，避免依赖 setData 回调的 this 绑定
    this.setData({ activeTab: key });
    this.load(key);
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  onCancel(e) {
    const ds = e.currentTarget.dataset;
    const id = ds.id;
    if (!id) return;

    const isDone = ds.status === 'done';
    const that = this;

    wx.showModal({
      title: '取消预约',
      content: isDone
        ? '该预约已完成，取消后记录将标记为「已取消」，确定吗？'
        : '取消后座位将立即释放，确定要取消吗？',
      confirmColor: '#E5484D',
      success(res) {
        if (!res.confirm) return;
        store.update(id, { status: 'cancel' });
        wx.showToast({ title: '已取消', icon: 'none' });
        that.load();
      }
    });
  },

  goBooking() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
