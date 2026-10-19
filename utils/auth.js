/**
 * 登录态管理
 *
 * 前端实训没有后端，登录态用本地存储模拟。
 * 真实项目的流程是：
 *   1. wx.login() 拿到临时 code
 *   2. code 发给后端，后端调微信接口换 openid / session_key
 *   3. 后端签发自己的 token 返回，前端存 storage
 *   4. 之后每个请求带 token，后端校验
 *
 * 这里只做到第 1 步 + 本地伪造用户信息，接口形态保持一致，
 * 将来接后端只需要改 login() 里的 resolve 内容。
 */

const KEY = 'sr_user_v1';

/** 读取当前登录用户，未登录返回 null */
function getUser() {
  try {
    return wx.getStorageSync(KEY) || null;
  } catch (e) {
    return null;
  }
}

/** 是否已登录 */
function isLoggedIn() {
  return !!getUser();
}

/** 保存登录用户 */
function saveUser(user) {
  try {
    wx.setStorageSync(KEY, user);
    return true;
  } catch (e) {
    console.error('[auth] 保存登录态失败', e);
    return false;
  }
}

/**
 * 登录（模拟）
 * 调用 wx.login 拿 code，开发者工具用测试号时可能失败，失败就降级为本地模拟
 * @param {Object} profile 登录页填写的资料 { studentId, nickName }
 * @returns {Promise<Object>} 用户信息
 */
function login(profile) {
  return new Promise(function (resolve) {
    function build(code) {
      const p = profile || {};
      // code 里可能带 - 之类的字符，先清洗再截取，生成一个像样的 openid
      const raw = String(code || Date.now()).replace(/[^a-zA-Z0-9]/g, '');
      return {
        nickName: p.nickName || '林同学',
        studentId: p.studentId || '2023010114',
        college: p.college || '计算机学院',
        // 真实项目里这里是后端返回的 openid
        openid: 'mock_' + (raw.slice(-6) || 'local'),
        loginTime: Date.now()
      };
    }

    wx.login({
      success(res) {
        resolve(build(res.code));
      },
      fail() {
        resolve(build('local'));
      }
    });
  });
}

/** 退出登录 */
function logout() {
  try {
    wx.removeStorageSync(KEY);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  getUser,
  isLoggedIn,
  saveUser,
  login,
  logout
};
