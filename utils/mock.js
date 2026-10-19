/**
 * 座位数据生成（模拟后端返回）
 *
 * 图书馆共 8 层，1 层是借还书大厅不可预约，2~8 层可以预约自习座位。
 * 每层布局略有差异：楼层越高座位越少（研讨空间、静音自习区座位间距大）。
 *
 * 关键点：同一个「楼层 + 日期」生成的座位状态必须完全一致，
 * 否则用户每次进页面看到的空位都在变，体验会很怪。
 * 这里用「字符串哈希 + 线性同余」做确定性伪随机，不用 Math.random。
 */

const FLOORS = [
  { floor: 2, short: '2F', name: '二楼 · 综合阅览', rows: 6, brokenRate: 5 },
  { floor: 3, short: '3F', name: '三楼 · 社科借阅', rows: 6, brokenRate: 8 },
  { floor: 4, short: '4F', name: '四楼 · 自然科学', rows: 5, brokenRate: 6 },
  { floor: 5, short: '5F', name: '五楼 · 文学阅览', rows: 5, brokenRate: 7 },
  { floor: 6, short: '6F', name: '六楼 · 电子阅览', rows: 5, brokenRate: 9 },
  { floor: 7, short: '7F', name: '七楼 · 研讨空间', rows: 4, brokenRate: 4 },
  { floor: 8, short: '8F', name: '八楼 · 静音自习', rows: 4, brokenRate: 3 }
];

/** 每行座位数，所有楼层统一 8 列，保证座位图对齐 */
const COLS = 8;

/** 字符串哈希（djb2 变体），用于把 "2-2026-10-19" 转成种子 */
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 确定性伪随机：同样的 seed + idx 永远得到同样的 0~1 */
function pseudo(seed, idx) {
  const v = (seed * 9301 + idx * 49297) % 233280;
  return v / 233280;
}

/** 按楼层号取配置 */
function getFloor(floor) {
  return (
    FLOORS.find(function (f) {
      return f.floor === floor;
    }) || FLOORS[0]
  );
}

/**
 * 生成某层某一天的座位列表
 * @param {number} floor 楼层号 2~8
 * @param {string} date  日期 "2026-10-19"
 */
function buildSeats(floor, date) {
  const f = getFloor(floor);
  const total = f.rows * COLS;
  const seed = hash(f.floor + '-' + date);
  const seats = [];

  for (let i = 0; i < total; i++) {
    const r = pseudo(seed, i) * 100;
    let status = 'free';
    if (r < f.brokenRate) {
      status = 'fix';                       // 维修中
    } else if (r < f.brokenRate + 38) {
      status = 'used';                      // 已被他人预约
    }

    const num = i + 1;
    seats.push({
      id: f.floor + 'F-' + num,
      short: num < 10 ? '0' + num : '' + num,
      no: f.short + ' ' + num + '号',
      floor: f.floor,
      floorName: f.name,
      status: status
    });
  }

  return seats;
}

module.exports = {
  FLOORS,
  COLS,
  getFloor,
  buildSeats
};
