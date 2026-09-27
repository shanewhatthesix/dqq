/* =========================================================================
 * 附中·电子斗蛐蛐  启动 + 路由
 *
 * 用 URL 的 # 做路由，所以直接双击 index.html 就能跑，
 * 也能直接丢到 GitHub Pages 上，不需要任何服务器。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var UI = DQQ.ui;
  var S = DQQ.storage;

  var app = (DQQ.app = {});

  var TABS = [
    { id: 'roster',   label: '蛐蛐库', icon: 'library', hash: '#/roster' },
    { id: 'create',   label: '创建蛐蛐', icon: 'wand', hash: '#/create' },
    { id: 'battle',   label: '斗一场', icon: 'swords', hash: '#/battle' },
    { id: 'history',  label: '名人堂', icon: 'trophy', hash: '#/history' },
    { id: 'settings', label: '设置', icon: 'settings', hash: '#/settings' }
  ];

  app.currentBattle = null;
  app.onLeave = null;   // 离开当前页面时的清理钩子（战斗页用它停掉循环）

  /* ------------------------------------------------------------ 路由解析 */
  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    if (!parts.length) return { view: 'roster', params: {} };
    var view = parts[0];
    var params = {};
    if (view === 'create' && parts[1]) params.id = parts[1];
    return { view: view, params: params };
  }

  function renderTabs(active) {
    var host = document.getElementById('tabs');
    host.innerHTML = '';
    TABS.forEach(function (t) {
      // 竞技场算在「斗一场」这一栏里
      var isActive = t.id === active || (active === 'arena' && t.id === 'battle');
      host.appendChild(U.el('button', {
        class: 'tab' + (isActive ? ' active' : ''),
        onclick: function () { location.hash = t.hash; }
      }, [UI.icon(t.icon), U.el('span', { text: t.label })]));
    });
  }

  function updateCount() {
    var el = document.getElementById('roster-count');
    try {
      el.textContent = S.getRoster().length + ' 只';
    } catch (e) { el.textContent = '—'; }
  }

  /* -------------------------------------------------------------- 渲染 */
  app.render = function () {
    // 先让上一个页面收尾（战斗页要停掉定时器）
    if (typeof app.onLeave === 'function') {
      var fn = app.onLeave;
      app.onLeave = null;
      try { fn(); } catch (e) { console.warn('[dqq] 页面清理出错', e); }
    }

    var route = parseHash();
    var host = document.getElementById('view');
    host.innerHTML = '';

    var viewFn = DQQ.views[route.view];
    if (typeof viewFn !== 'function') {
      // 未知路由 → 回蛐蛐库
      location.replace('#/roster');
      return;
    }

    renderTabs(route.view);
    updateCount();

    try {
      viewFn(host, route.params);
    } catch (err) {
      console.error('[dqq] 页面渲染失败', err);
      host.appendChild(U.el('div', { class: 'empty' }, [
        U.el('span', { class: 'big' }, [UI.icon('alert')]),
        U.el('div', { text: '这个页面出错了' }),
        U.el('pre', {
          class: 'muted mt-8',
          style: { fontSize: '12px', whiteSpace: 'pre-wrap', textAlign: 'left' },
          text: String(err && err.stack || err)
        }),
        U.el('button', { class: 'btn mt-16', text: '回蛐蛐库', onclick: function () { location.hash = '#/roster'; } })
      ]));
    }
    window.scrollTo(0, 0);
  };

  /* ---------------------------------------------------------- 战斗跳转 */
  app.pushBattle = function (setup, teamA, teamB) {
    app.currentBattle = { setup: setup, teamA: teamA, teamB: teamB };
    // 用 pushState 而不是 location.hash：两者都会改地址，
    // 但 pushState 不会触发 hashchange。否则这里渲染一次、hashchange 再渲染一次，
    // 第二次会先跑 arena 注册的 onLeave 清理钩子，把刚建好的战斗清掉，竞技场就空白了。
    try {
      history.pushState(null, '', '#/arena');
    } catch (e) {
      location.hash = '#/arena';   // 极老浏览器兜底
    }
    app.render();
  };

  app.rematch = function () {
    var ctx = app.currentBattle;
    if (!ctx) { location.hash = '#/battle'; return; }
    // 用同一批蛐蛐再打一遍（重新克隆，避免上一局的伤势带过来）
    app.pushBattle(ctx.setup, U.deepClone(ctx.teamA), U.deepClone(ctx.teamB));
  };

  /* -------------------------------------------------------------- 启动 */
  function boot() {
    var versionEl = document.getElementById('version-label');
    if (versionEl) versionEl.textContent = 'v' + DQQ.VERSION;

    /* 左上角放校徽。图在 assets/logo.png（取自学校官网头部图，已按纸墨配色重新上色）。
     * 万一图被删了，退回手绘的蛐蛐标记，保证界面不开天窗。 */
    (function mountBrandIcon() {
      var host = document.getElementById('brand-icon');
      if (!host) return;
      var img = new Image();
      img.alt = '校徽';
      img.className = 'brand-logo';
      img.onload = function () {
        host.innerHTML = '';
        host.appendChild(img);
        host.classList.add('has-logo');
      };
      img.onerror = function () {
        if (!host.querySelector('svg')) host.appendChild(UI.icon('cricket'));
      };
      img.src = 'assets/logo.png';
    })();

    document.getElementById('brand').addEventListener('click', function () {
      location.hash = '#/roster';
    });

    if (!S.available()) {
      U.toast('这个浏览器禁用了本地存储，改的东西关掉页面就没了', 'err');
    }

    window.addEventListener('hashchange', function () { app.render(); });

    // 第一次打开先灌一份预设角色
    try { S.getRoster(); } catch (e) { console.warn(e); }

    if (!location.hash) location.hash = '#/roster';
    app.render();

    console.log('%c附中·电子斗蛐蛐 v' + DQQ.VERSION,
      'color:#ffd447;font-weight:bold;font-size:14px');
    console.log('想加新角色模板？改 js/data.js 里的 PRESET_CRICKETS。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
