const {
  getDays,
  formatDate,
  SLOTS,
  MAX_SLOTS,
  isSlotExpired
} = require('../../utils/util');
const { FLOORS, buildSeats, getFloor } = require('../../utils/mock');
const store = require('../../utils/store');
const auth = require('../../utils/auth');

Page({
  data: {
    days: [],
    activeDate: '',
    activeDateLabel: '',

    // 楼层选择：2~8 层，每项带剩余座位数
    floors: [],
    activeFloor: 2,
    activeFloorName: '',

    seats: [],
    freeCount: 0,

    // 时段选择面板
    showPanel: false,
    selectedSeat: null,
    slots: [],
    selectedSlots: [],
    conflictTip: '',
    maxSlots: MAX_SLOTS
  },

  onLoad() {
    const days = getDays(7);
    this.setData({
      days: days,
      activeDate: days[0].date,
      activeDateLabel: days[0].label,
      activeFloor: FLOORS[0].floor,
      activeFloorName: FLOORS[0].name
    });
    this.refresh();
  },

  /** 某天我自己已预约的座位集合，用于把座位标成「我的」并从空闲数里排除 */
  buildMineMap(date) {
    const map = {};
    // 未登录时不存在「我的座位」，避免把历史数据暴露出来
    if (!auth.isLoggedIn()) return map;

    store
      .getAll()
      .filter(function (b) {
        return b.date === date && b.status === 'active';
      })
      .forEach(function (b) {
        map[b.seatId] = true;
      });
    return map;
  },

  /**
   * 根据日期 + 楼层重新生成座位图，并刷新各楼层剩余座位数
   * @param {string} dateOverride  显式传入日期，避免依赖 setData 的时序
   * @param {number} floorOverride 显式传入楼层
   */
  refresh(dateOverride, floorOverride) {
    const date = dateOverride || this.data.activeDate;
    const floor = floorOverride || this.data.activeFloor;
    const mineMap = this.buildMineMap(date);

    // 当前楼层座位
    const seats = buildSeats(floor, date);
    seats.forEach(function (s) {
      if (mineMap[s.id]) s.status = 'mine';
    });

    const freeCount = seats.filter(function (s) {
      return s.status === 'free';
    }).length;

    // 每一层的剩余座位数，供楼层选择器展示
    const floors = FLOORS.map(function (f) {
      const list = buildSeats(f.floor, date);
      let free = 0;
      list.forEach(function (s) {
        if (!mineMap[s.id] && s.status === 'free') free++;
      });
      return {
        floor: f.floor,
        short: f.short,
        free: free,
        freeText: free > 0 ? '剩 ' + free + ' 座' : '已满'
      };
    });

    this.setData({
      seats: seats,
      freeCount: freeCount,
      floors: floors,
      activeFloorName: getFloor(floor).name
    });
  },

  /* ---------------- 日期 / 楼层切换 ---------------- */

  onDateChange(e) {
    const date = e.detail.date;
    const day = this.data.days.find(function (d) {
      return d.date === date;
    });
    this.setData({ activeDate: date, activeDateLabel: day ? day.label : '' });
    this.refresh(date);
  },

  onFloorChange(e) {
    const floor = Number(e.currentTarget.dataset.floor);
    if (floor === this.data.activeFloor) return;
    this.setData({ activeFloor: floor });
    this.refresh(null, floor);
  },

  /* ---------------- 选座 ---------------- */

  onSeatSelect(e) {
    const seat = e.detail.seat;

    if (seat.status === 'fix') {
      wx.showToast({ title: '该座位正在维修', icon: 'none' });
      return;
    }
    if (seat.status === 'used') {
      wx.showToast({ title: '该座位已被预约', icon: 'none' });
      return;
    }
    if (seat.status === 'mine') {
      wx.showToast({ title: '你已预约该座位', icon: 'none' });
      return;
    }

    // 未登录只能浏览座位，不能下单
    if (!auth.isLoggedIn()) {
      this.requireLogin(seat);
      return;
    }

    this.openPanelFor(seat);
  },

  /** 未登录时跳转登录页，并把想选的座位暂存起来 */
  requireLogin(seat) {
    getApp().globalData.pendingSeat = seat;
    wx.navigateTo({ url: '/pages/login/login' });
  },

  /** 从登录页返回后，若已登录就把刚才点的座位接上 */
  onShow() {
    const app = getApp();
    const pending = app.globalData.pendingSeat;
    if (!pending) return;

    app.globalData.pendingSeat = null;
    if (auth.isLoggedIn()) {
      this.openPanelFor(pending);
    }
  },

  /** 当前时间，抽成方法方便测试注入固定时间 */
  now() {
    return new Date();
  },

  /**
   * 打开时段选择面板
   * 置灰规则（优先级从高到低）：
   *   1. 今天已经过了开始时间的时段 → 已过时段
   *   2. 自己已占用的时段（跨楼层） → 已被预约 / 已约 3F 12号
   */
  openPanelFor(seat) {
    const mine = auth.isLoggedIn() ? store.mySlotMap(this.data.activeDate) : {};
    const otherSeats = {};

    // 只有「今天」才需要判断时段是否已过
    const isToday = this.data.activeDate === formatDate(this.now());
    const now = this.now();
    let expiredCount = 0;

    const slots = SLOTS.map(function (s) {
      let disabled = false;
      let tip = '可预约';

      if (isToday && isSlotExpired(s, now)) {
        disabled = true;
        tip = '已过时段';
        expiredCount++;
      } else {
        const owner = mine[s.id];
        if (owner) {
          disabled = true;
          if (owner.seatId === seat.id) {
            tip = '已被预约';
          } else {
            tip = '已约 ' + owner.seatNo;
            otherSeats[owner.seatNo] = true;
          }
        }
      }

      return {
        id: s.id,
        label: s.label,
        disabled: disabled,
        checked: false,
        tip: tip
      };
    });

    const names = Object.keys(otherSeats);
    let hint = '';
    if (expiredCount === SLOTS.length) {
      hint = '今天的可预约时段已结束，请切换到明天或之后的日期';
    } else if (names.length) {
      hint =
        '同一时段只能预约一个座位。你在该时段已约 ' +
        names.join('、') +
        '，请换个时段，或先取消原预约';
    }

    this.setData({
      selectedSeat: seat,
      slots: slots,
      selectedSlots: [],
      showPanel: true,
      conflictTip: hint
    });
  },

  toggleSlot(e) {
    const id = Number(e.currentTarget.dataset.id);

    const slots = this.data.slots.map(function (s) {
      if (s.id !== id || s.disabled) return s;
      return Object.assign({}, s, { checked: !s.checked });
    });

    const selected = slots
      .filter(function (s) {
        return s.checked;
      })
      .map(function (s) {
        return s.id;
      });

    if (selected.length > MAX_SLOTS) {
      wx.showToast({ title: '单次最多选 ' + MAX_SLOTS + ' 个时段', icon: 'none' });
      return;
    }

    this.setData({ slots: slots, selectedSlots: selected });
  },

  closePanel() {
    this.setData({ showPanel: false });
  },

  /** 阻止弹层背景滚动 */
  noop() {},

  /* ---------------- 提交预约 ---------------- */

  confirmBooking() {
    const seat = this.data.selectedSeat;
    const ids = this.data.selectedSlots;
    if (!seat || ids.length === 0) return;

    // 提交前再校验：时段不能已过期，也不能和自己已有预约冲突
    const isToday = this.data.activeDate === formatDate(this.now());
    const now = this.now();

    if (isToday) {
      const expired = ids.filter(function (id) {
        const slot = SLOTS.filter(function (s) {
          return s.id === id;
        })[0];
        return slot && isSlotExpired(slot, now);
      });
      if (expired.length) {
        wx.showToast({ title: '所选时段已过时间', icon: 'none' });
        this.setData({ showPanel: false });
        this.refresh();
        return;
      }
    }

    // 同一时段不能同时占两个座位
    const mine = store.mySlotMap(this.data.activeDate);
    const clash = ids.filter(function (id) {
      return !!mine[id];
    });
    if (clash.length) {
      wx.showToast({ title: '所选时段与已有预约冲突', icon: 'none' });
      this.setData({ showPanel: false });
      return;
    }

    const chosen = this.data.slots.filter(function (s) {
      return s.checked;
    });

    store.add({
      id: 'B' + Date.now(),
      seatId: seat.id,
      seatNo: seat.no,
      floor: seat.floor,
      floorName: seat.floorName,
      date: this.data.activeDate,
      slots: ids,
      slotLabels: chosen.map(function (s) {
        return s.label;
      }),
      status: 'active',
      // 6 位签到码，真实项目里由后端生成
      code: String(Math.floor(100000 + Math.random() * 900000)),
      createTime: Date.now()
    });

    this.setData({ showPanel: false });
    wx.showToast({ title: '预约成功', icon: 'success', duration: 1200 });
    this.refresh();
  },

  /* ---------------- 下拉刷新 / 分享 ---------------- */

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  onShareAppMessage() {
    return {
      title: '图书馆预约系统 · 在线选座',
      path: '/pages/index/index'
    };
  }
});
