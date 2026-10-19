/**
 * 通用工具：日期、时段常量
 */

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 补零：8 -> "08" */
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** Date -> "2026-10-19" */
function formatDate(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * 生成从今天开始的连续 N 天
 * 返回 [{ date, day, label }]
 */
function getDays(count) {
  const list = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    let label;
    if (i === 0) label = '今天';
    else if (i === 1) label = '明天';
    else label = WEEK[d.getDay()];
    list.push({
      date: formatDate(d),
      day: pad(d.getDate()),
      label: label
    });
  }
  return list;
}

/** 可预约时段（固定 5 个，每个 2 小时） */
const SLOTS = [
  { id: 1, label: '08:00-10:00', start: '08:00', end: '10:00' },
  { id: 2, label: '10:00-12:00', start: '10:00', end: '12:00' },
  { id: 3, label: '14:00-16:00', start: '14:00', end: '16:00' },
  { id: 4, label: '16:00-18:00', start: '16:00', end: '18:00' },
  { id: 5, label: '19:00-21:00', start: '19:00', end: '21:00' }
];

/**
 * 距时段结束不足该分钟数时不再允许预约
 * 0 表示「到结束时间才截止」——即整个时段进行期间都还能约
 * 如果想让快结束的时段不可约，把它调成 30 之类即可
 */
const SLOT_MIN_REMAIN_MIN = 0;

/**
 * 判断某个时段是否已经结束（只用于「今天」）
 * 规则：时段结束时间之前都可以预约
 * 例如 16:00-18:00，在 17:59 仍可预约，18:00 起不可预约
 * @param {Object} slot 时段对象，需有 end 字段 "HH:mm"
 * @param {Date} now 当前时间，默认取系统时间
 */
function isSlotExpired(slot, now) {
  const d = now || new Date();
  const parts = String(slot.end).split(':');
  const end = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    Number(parts[0]),
    Number(parts[1]),
    0,
    0
  );
  const deadline = end.getTime() - SLOT_MIN_REMAIN_MIN * 60 * 1000;
  return d.getTime() >= deadline;
}

/** 单个时段时长（小时），用于统计累计自习时长 */
const SLOT_HOURS = 2;

/** 单次预约最多可选时段数 */
const MAX_SLOTS = 2;

module.exports = {
  WEEK,
  pad,
  formatDate,
  getDays,
  SLOTS,
  SLOT_MIN_REMAIN_MIN,
  isSlotExpired,
  SLOT_HOURS,
  MAX_SLOTS
};
