/**
 * 预约记录的本地持久化层
 *
 * 前端实训没有后端，用 wx.storage 模拟数据库。
 * 把读写都收在这里，页面里不直接碰 storage，
 * 将来接真实接口时只需要改这一个文件。
 */

const { formatDate } = require('./util');

const KEY = 'sr_bookings_v1';

function read() {
  try {
    return wx.getStorageSync(KEY) || [];
  } catch (e) {
    return [];
  }
}

function write(list) {
  try {
    wx.setStorageSync(KEY, list);
  } catch (e) {
    // 存储失败（比如超出 10MB）时静默处理，避免页面崩溃
    console.error('[store] 写入失败', e);
  }
}

/** 全部记录，按创建时间倒序 */
function getAll() {
  return read().slice().sort(function (a, b) {
    return b.createTime - a.createTime;
  });
}

function getById(id) {
  return read().find(function (b) {
    return b.id === id;
  });
}

function add(booking) {
  const list = read();
  list.push(booking);
  write(list);
}

function update(id, patch) {
  const list = read().map(function (b) {
    return b.id === id ? Object.assign({}, b, patch) : b;
  });
  write(list);
}

function remove(id) {
  write(
    read().filter(function (b) {
      return b.id !== id;
    })
  );
}

/** 某天、某座位已被占用的时段 id 列表（用于时段选择时置灰） */
function bookedSlotsOf(date, seatId) {
  return read()
    .filter(function (b) {
      return b.date === date && b.seatId === seatId && b.status === 'active';
    })
    .reduce(function (acc, b) {
      return acc.concat(b.slots);
    }, []);
}

/**
 * 某天我在所有座位上的已占时段（跨楼层）
 * 一个人同一时段只能占一个座位，所以这里不区分座位
 * @returns {Object} { [slotId]: { seatId, seatNo } }
 */
function mySlotMap(date) {
  const map = {};
  read().forEach(function (b) {
    if (b.date !== date || b.status !== 'active') return;
    (b.slots || []).forEach(function (sid) {
      map[sid] = { seatId: b.seatId, seatNo: b.seatNo };
    });
  });
  return map;
}

/** 统计信息，供个人中心使用 */
function getStats() {
  const list = read();
  const active = list.filter(function (b) {
    return b.status === 'active';
  });
  const done = list.filter(function (b) {
    return b.status === 'done';
  });
  const cancel = list.filter(function (b) {
    return b.status === 'cancel';
  });
  return {
    total: list.length,
    active: active.length,
    done: done.length,
    cancel: cancel.length
  };
}

module.exports = {
  getAll,
  getById,
  add,
  update,
  remove,
  bookedSlotsOf,
  mySlotMap,
  getStats
};
