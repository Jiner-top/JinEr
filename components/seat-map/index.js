Component({
  properties: {
    // [{ id, short, no, status: 'free' | 'used' | 'mine' | 'fix' }]
    seats: {
      type: Array,
      value: []
    }
  },

  methods: {
    onTap(e) {
      const index = e.currentTarget.dataset.index;
      const seat = this.data.seats[index];
      if (!seat) return;
      // 组件不判断业务规则，只把点击事件抛给页面，保持组件无状态
      this.triggerEvent('select', { seat: seat });
    }
  }
});
