Component({
  properties: {
    // 日期列表 [{ date, day, label }]
    days: {
      type: Array,
      value: []
    },
    // 当前选中日期
    active: {
      type: String,
      value: ''
    }
  },

  methods: {
    onTap(e) {
      const date = e.currentTarget.dataset.date;
      if (date === this.data.active) return;
      this.triggerEvent('change', { date: date });
    }
  }
});
