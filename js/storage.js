/* =========================================================================
 * 附中·电子斗蛐蛐  本地存储
 * 全部存在浏览器 localStorage 里，不上传任何服务器。
 * 想换成后端接口，只要把这一层的几个函数改成 fetch 就行。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;

  var S = (DQQ.storage = {});

  S.KEYS = {
    roster: 'dqq.roster.v1',
    settings: 'dqq.settings.v1',
    history: 'dqq.history.v1'
  };

  function read(key, fallback) {
    try {
      var raw = root.localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val == null ? fallback : val;
    } catch (e) {
      console.warn('[dqq] 读取本地数据失败', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // 多半是 localStorage 存满了（CG 图片很占地方）
      console.warn('[dqq] 保存失败', key, e);
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        U.toast('本地空间满了，先删掉几只带图的蛐蛐再试', 'err');
      } else {
        U.toast('保存失败：' + (e && e.message ? e.message : e), 'err');
      }
      return false;
    }
  }

  S.available = function () {
    try {
      root.localStorage.setItem('dqq.probe', '1');
      root.localStorage.removeItem('dqq.probe');
      return true;
    } catch (e) { return false; }
  };

  /* ------------------------------------------------------------- 蛐蛐库 */
  S.getRoster = function () {
    var list = read(S.KEYS.roster, null);
    if (!Array.isArray(list)) {
      // 第一次打开：把社团预置的角色灌进去，让人一进来就有得玩
      list = DQQ.PRESET_CRICKETS.map(function (c) {
        var copy = U.deepClone(c);
        copy.id = U.uid('c');
        copy.builtin = true;
        return copy;
      });
      write(S.KEYS.roster, list);
    }
    return list;
  };

  S.saveRoster = function (list) {
    return write(S.KEYS.roster, list);
  };

  S.addCricket = function (cricket) {
    var list = S.getRoster();
    var c = U.deepClone(cricket);
    c.id = c.id || U.uid('c');
    c.createdAt = c.createdAt || U.todayStr();
    var existing = list.findIndex(function (x) { return x.id === c.id; });
    if (existing >= 0) list[existing] = c;
    else list.push(c);
    return S.saveRoster(list) ? c : null;
  };

  S.removeCricket = function (id) {
    var list = S.getRoster().filter(function (c) { return c.id !== id; });
    return S.saveRoster(list);
  };

  S.getCricket = function (id) {
    return S.getRoster().find(function (c) { return c.id === id; }) || null;
  };

  S.clearRoster = function () {
    return write(S.KEYS.roster, []);
  };

  S.resetRoster = function () {
    try { root.localStorage.removeItem(S.KEYS.roster); } catch (e) {}
    return S.getRoster();
  };

  /* ------------------------------------------------------------- 设置 */
  S.DEFAULT_SETTINGS = {
    // 在线 AI 生成（可选）。不填也能玩，用内置的离线生成器。
    aiEnabled: false,
    apiBase: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    /* 输出预算给得宽，是因为推理模型（deepseek-reasoner / v4-pro 之类）
     * 会把思维链也算进这个额度。给小了会出现「content 是空字符串」——
     * 看起来像接口坏了，其实是思考没写完就截断了。 */
    maxTokens: 4096,
    jsonMode: true,       // 用接口层的 JSON 模式，比在提示词里求它可靠
    temperature: 0.8,
    aiTimeout: 90000,     // 推理模型慢，超时给宽松点
    // 战斗
    autoPlayDelay: 900,        // 自动战斗每步间隔（毫秒）
    showCommentary: true,
    fairMode: false            // 公平模式：双方拉到同一稀有度
  };

  S.getSettings = function () {
    var s = read(S.KEYS.settings, {});
    var out = U.deepClone(S.DEFAULT_SETTINGS);
    Object.keys(s || {}).forEach(function (k) { if (k in out) out[k] = s[k]; });
    return out;
  };

  S.saveSettings = function (s) {
    return write(S.KEYS.settings, s);
  };

  /* ------------------------------------------------------------- 战报 */
  S.MAX_HISTORY = 30;

  S.getHistory = function () {
    var h = read(S.KEYS.history, []);
    return Array.isArray(h) ? h : [];
  };

  S.addHistory = function (report) {
    var h = S.getHistory();
    h.unshift(report);
    if (h.length > S.MAX_HISTORY) h = h.slice(0, S.MAX_HISTORY);
    return write(S.KEYS.history, h);
  };

  S.clearHistory = function () {
    return write(S.KEYS.history, []);
  };

  /* --------------------------------------------------------- 导入 / 导出 */
  S.exportAll = function () {
    return JSON.stringify({
      format: 'dqq-export',
      version: DQQ.VERSION,
      exportedAt: new Date().toISOString(),
      roster: S.getRoster()
    }, null, 2);
  };

  /* 导入：模式 'merge' 追加，'replace' 覆盖 */
  S.importAll = function (jsonText, mode) {
    var data;
    try { data = JSON.parse(jsonText); }
    catch (e) { return { ok: false, error: '不是合法的 JSON 文件' }; }

    var incoming = null;
    if (Array.isArray(data)) incoming = data;                          // 直接是数组
    else if (data && Array.isArray(data.roster)) incoming = data.roster; // 完整导出文件
    else if (data && data.name && data.stats) incoming = [data];        // 单只蛐蛐
    if (!incoming) return { ok: false, error: '没找到蛐蛐数据（应为导出文件或单只蛐蛐）' };

    var valid = [], rejected = [];
    incoming.forEach(function (c) {
      if (!c || !c.name || !c.stats || !Array.isArray(c.skills)) { rejected.push(c && c.name || '未知'); return; }
      var copy = U.deepClone(c);
      copy.id = U.uid('c');
      copy.builtin = false;
      valid.push(copy);
    });

    if (!valid.length) return { ok: false, error: '文件里没有可用的蛐蛐' };

    var list = (mode === 'replace') ? [] : S.getRoster();
    list = list.concat(valid);
    S.saveRoster(list);
    return { ok: true, added: valid.length, rejected: rejected };
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
