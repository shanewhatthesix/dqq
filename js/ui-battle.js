/* =========================================================================
 * 附中·电子斗蛐蛐  战斗页面
 *
 * 三种玩法：
 *   1v1 随机斗蛐蛐   —— 两只蛐蛐自动开打，配 AI 解说，看完就能截图分享
 *   3v3 真人对战     —— 同一台设备上轮流选招、自由换人
 *   3v3 挑战电脑     —— 你手动，电脑自动
 *
 * 技能 CG：绑了图就全屏放 1.5 秒再结算，没绑就屏幕震动 + 闪光 + 技能名放大。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var E = DQQ.effect;
  var UI = DQQ.ui;
  var S = DQQ.storage;
  var C = DQQ.commentary;

  var views = (DQQ.views = DQQ.views || {});

  var CG_HOLD_MS = 1500;   // 设计文档 6.1：CG 展示 1.5 秒

  /* 上一次的配置，方便「再来一局」 */
  var lastConfig = null;

  /* ==================================================================== */
  /*  对战设置页                                                            */
  /* ==================================================================== */
  views.battle = function (host) {
    var roster = S.getRoster();
    if (!roster.length) {
      host.appendChild(U.el('div', { class: 'empty' }, [
        U.el('span', { class: 'big' }, [UI.icon('cricket')]),
        U.el('div', { text: '蛐蛐库是空的，先造两只再开打' }),
        U.el('button', { class: 'btn btn-primary mt-16', text: '去创建蛐蛐', onclick: function () { location.hash = '#/create'; } })
      ]));
      return;
    }

    var cfg = lastConfig ? U.deepClone(lastConfig) : {
      mode: '1v1',
      teamA: [], teamB: [],
      controllerA: 'human', controllerB: 'ai',
      fairMode: S.getSettings().fairMode
    };
    // 蛐蛐可能已经被删了，过滤掉失效的 id
    function prune(list) {
      return (list || []).filter(function (id) { return !!S.getCricket(id); });
    }
    cfg.teamA = prune(cfg.teamA);
    cfg.teamB = prune(cfg.teamB);

    host.appendChild(U.el('div', {}, [
      U.el('h2', { text: '斗一场' }),
      U.el('div', { class: 'muted', text: '选好阵容就可以开打。1v1 自动打完配解说，3v3 自己选招。' })
    ]));

    /* ---------------------------------------------------------- 模式选择 */
    var MODES = [
      { id: '1v1', icon: 'zap', title: '1v1 随机斗蛐蛐', desc: '两只单挑，自动战斗，AI 实时解说。最快最爽，适合录屏分享。', size: 1, ca: 'ai', cb: 'ai' },
      { id: '3v3', icon: 'swords', title: '3v3 真人对战', desc: '两台人同一部设备轮流选招，自由换人。一个人也能左手打右手。', size: 3, ca: 'human', cb: 'human' },
      { id: 'pve', icon: 'user', title: '3v3 挑战电脑', desc: '你手动选招，电脑自动应对。练阵容用这个。', size: 3, ca: 'human', cb: 'ai' }
    ];
    /* 注意：这里必须是个函数。
     * 之前写成 var mode = ... 只算了一次，点模式卡片换了 cfg.mode 之后
     * mode 还停在 1v1，于是「3v3 真人对战」会静悄悄按 1v1 自动对战跑起来。 */
    function currentMode() {
      return MODES.filter(function (m) { return m.id === cfg.mode; })[0] || MODES[0];
    }

    var modesRow = U.el('div', { class: 'mode-cards mt-16' });
    MODES.forEach(function (m) {
      modesRow.appendChild(U.el('div', {
        class: 'mode-card' + (cfg.mode === m.id ? ' active' : ''),
        onclick: function () {
          cfg.mode = m.id;
          cfg.controllerA = m.ca;
          cfg.controllerB = m.cb;
          cfg.teamA = cfg.teamA.slice(0, m.size);
          cfg.teamB = cfg.teamB.slice(0, m.size);
          rerender();
        }
      }, [
        U.el('div', { class: 'mc-icon' }, [UI.icon(m.icon)]),
        U.el('div', { class: 'mc-title', text: m.title }),
        U.el('div', { class: 'mc-desc', text: m.desc })
      ]));
    });
    host.appendChild(modesRow);

    /* ---------------------------------------------------------- 阵容选择 */
    var teamsRow = U.el('div', { class: 'mt-24' });
    host.appendChild(teamsRow);

    /* ---------------------------------------------------------- 选项 */
    var optsCard = U.el('div', { class: 'card mt-16' });
    var fairToggle = U.el('input', {
      type: 'checkbox', checked: !!cfg.fairMode,
      onchange: function () { cfg.fairMode = fairToggle.checked; renderTeams(); }
    });
    optsCard.appendChild(U.el('label', { class: 'row', style: { cursor: 'pointer' } }, [
      fairToggle,
      U.el('div', {}, [
        U.el('div', { text: '公平模式', style: { fontWeight: '700' } }),
        U.el('div', { class: 'muted', style: { fontSize: '12.5px' },
          text: '把双方蛐蛐的数值拉到同一稀有度再打。免得传说一只碾三个普通。' })
      ])
    ]));
    host.appendChild(optsCard);

    /* ---------------------------------------------------------- 开打 */
    var startRow = U.el('div', { class: 'row mt-24' });
    host.appendChild(startRow);

    function teamReady() {
      return cfg.teamA.length === currentMode().size && cfg.teamB.length === currentMode().size;
    }

    function renderStart() {
      startRow.innerHTML = '';
      var ready = teamReady();
      startRow.appendChild(U.el('button', {
        class: 'btn btn-primary btn-lg', disabled: !ready,
        onclick: function () { if (ready) startBattle(cfg, currentMode()); }
      }, [UI.icon('flame'), U.el('span', { text: '开打！' })]));
      startRow.appendChild(U.el('button', {
        class: 'btn', onclick: function () {
          var pool = U.shuffle(S.getRoster());
          cfg.teamA = pool.slice(0, currentMode().size).map(function (c) { return c.id; });
          cfg.teamB = pool.slice(currentMode().size, currentMode().size * 2).map(function (c) { return c.id; });
          if (cfg.teamB.length < currentMode().size) cfg.teamB = pool.slice(0, currentMode().size).map(function (c) { return c.id; });
          rerender();
        }
      }, [UI.icon('shuffle'), U.el('span', { text: '两边随机' })]));
      if (!ready) {
        startRow.appendChild(U.el('span', { class: 'muted', text: '两边都选满 ' + currentMode().size + ' 只才能开打' }));
      }
    }

    function renderTeams() {
      teamsRow.innerHTML = '';
      var row = U.el('div', { class: 'arena' });
      row.appendChild(teamPanel('A', '我方'));
      row.appendChild(U.el('div', { class: 'vs-badge', text: 'VS' }));
      row.appendChild(teamPanel('B', '对方'));
      teamsRow.appendChild(row);
      renderStart();
    }

    function teamPanel(side, label) {
      var isA = side === 'A';
      var ids = isA ? cfg.teamA : cfg.teamB;
      var panel = U.el('div', { class: 'side-panel ' + (isA ? 'is-you' : 'is-foe') });
      panel.appendChild(U.el('div', { class: 'side-head' }, [
        U.el('span', { class: 'side-name', text: label + '（' + ids.length + '/' + currentMode().size + '）' })
      ]));

      var slots = U.el('div', { class: 'order-slots' });
      for (var i = 0; i < currentMode().size; i++) {
        (function (idx) {
          var cricket = ids[idx] ? S.getCricket(ids[idx]) : null;
          var slot = U.el('div', { class: 'order-slot' + (cricket ? ' filled ' + UI.rarityClass(cricket.rarity) : '') });
          slot.appendChild(U.el('div', { class: 'os-idx', text: '第 ' + (idx + 1) + ' 位' }));
          if (cricket) {
            slot.appendChild(U.el('div', { class: 'os-name' }, [UI.sprite(cricket), U.el('span', { text: cricket.name })]));
            slot.appendChild(U.el('div', { class: 'os-idx', text: cricket.rarity + ' · ' + cricket.defenseType }));
            slot.appendChild(U.el('button', {
              class: 'btn btn-sm btn-ghost mt-8', text: '换',
              onclick: function (e) { e.stopPropagation(); pickCricket(side, idx); }
            }));
          } else {
            slot.appendChild(U.el('div', { class: 'os-name', text: '＋ 选一只' }));
            slot.onclick = function () { pickCricket(side, idx); };
            slot.style.cursor = 'pointer';
          }
          slots.appendChild(slot);
        })(i);
      }
      panel.appendChild(slots);

      // 公平模式提示
      if (cfg.fairMode) {
        var all = cfg.teamA.concat(cfg.teamB).map(function (id) { return S.getCricket(id); }).filter(Boolean);
        if (all.length) {
          var target = all.reduce(function (best, c) {
            return DQQ.balance.rarityRank(c.rarity) > DQQ.balance.rarityRank(best) ? c.rarity : best;
          }, '普通');
          panel.appendChild(U.el('div', { class: 'muted', style: { fontSize: '12px' },
            text: '公平模式：双方都会按「' + target + '」重新配数值' }));
        }
      }
      return panel;
    }

    function pickCricket(side, index) {
      var isA = side === 'A';
      var ids = isA ? cfg.teamA : cfg.teamB;
      var rosterNow = S.getRoster();

      U.modal({
        title: '选一只蛐蛐',
        wide: true,
        render: function (m) {
          m.body.appendChild(U.el('div', { class: 'muted mb-8', style: { fontSize: '12.5px' },
            text: '已经在场上的蛐蛐不能重复选。' }));
          var grid = U.el('div', { class: 'pick-grid' });

          if (isA && ids[index]) {
            grid.appendChild(U.el('div', {
              class: 'pick-item', style: { borderColor: 'var(--red)' },
              onclick: function () { ids.splice(index, 1); m.close(); rerender(); }
            }, [
              U.el('div', { class: 'pi-name weak' }, [UI.icon('close'), U.el('span', { text: '清空这个位置' })]),
              U.el('div', { class: 'pi-meta', text: '腾出来给别人' })
            ]));
          }

          rosterNow.forEach(function (c) {
            var used = cfg.teamA.indexOf(c.id) >= 0 || cfg.teamB.indexOf(c.id) >= 0;
            var taken = used && ids[index] !== c.id;
            var item = U.el('div', {
              class: 'pick-item ' + UI.rarityClass(c.rarity) + (taken ? ' disabled' : ''),
              onclick: function () {
                if (taken) { U.toast('这只已经在场上了', 'err'); return; }
                // 从别的位置拿过来的话先摘掉
                var ai = cfg.teamA.indexOf(c.id);
                if (ai >= 0 && !(isA && ai === index)) cfg.teamA.splice(ai, 1);
                var bi = cfg.teamB.indexOf(c.id);
                if (bi >= 0 && !(!isA && bi === index)) cfg.teamB.splice(bi, 1);
                if (index < ids.length) ids[index] = c.id;
                else ids.splice(index, 0, c.id);
                m.close();
                rerender();
              }
            }, [
              U.el('div', { class: 'pi-name' }, [UI.sprite(c), U.el('span', { text: c.name })]),
              U.el('div', { class: 'pi-meta', text: c.rarity + ' · ' + c.type + '/' + c.defenseType }),
              U.el('div', { class: 'pi-meta', text: 'HP' + c.stats.hp + ' 攻' + c.stats.attack + ' 防' + c.stats.defense + ' 速' + c.stats.speed })
            ]);
            grid.appendChild(item);
          });
          m.body.appendChild(grid);
          m.footer.appendChild(U.el('button', { class: 'btn btn-primary', text: '＋ 新建一只', onclick: function () { m.close(); location.hash = '#/create'; } }));
          m.footer.appendChild(U.el('button', { class: 'btn btn-ghost', text: '关闭', onclick: m.close }));
        }
      });
    }

    function rerender() {
      // 模式卡片的选中态
      U.$$('.mode-card', modesRow).forEach(function (node, i) {
        node.classList.toggle('active', MODES[i].id === cfg.mode);
      });
      renderTeams();
    }

    renderTeams();

    /* 开局 */
    function startBattle(config, modeDef) {
      var teamA = config.teamA.map(function (id) { return S.getCricket(id); }).filter(Boolean);
      var teamB = config.teamB.map(function (id) { return S.getCricket(id); }).filter(Boolean);

      if (config.fairMode) {
        var fair = DQQ.balance.fairTeams(teamA, teamB);
        teamA = fair.A; teamB = fair.B;
      }

      lastConfig = U.deepClone(config);

      var setup = {
        mode: config.mode,
        size: modeDef.size,
        nameA: modeDef.size === 1 ? teamA[0].name : '我方队伍',
        nameB: modeDef.size === 1 ? teamB[0].name : '对方队伍',
        controllerA: modeDef.ca,
        controllerB: modeDef.cb,
        fairMode: config.fairMode
      };

      DQQ.app.pushBattle(setup, teamA, teamB);
    }
  };

  /* ==================================================================== */
  /*  竞技场                                                                */
  /* ==================================================================== */
  views.arena = function (host, params) {
    var ctx = DQQ.app.currentBattle;
    if (!ctx) {
      host.appendChild(U.el('div', { class: 'empty' }, [U.el('div', { text: '没有正在进行的战斗' })]));
      return;
    }

    var settings = S.getSettings();
    var battle = DQQ.engine.create({
      teams: {
        A: { name: ctx.setup.nameA, members: ctx.teamA },
        B: { name: ctx.setup.nameB, members: ctx.teamB }
      },
      controllers: { A: ctx.setup.controllerA, B: ctx.setup.controllerB },
      mode: ctx.setup.size === 1 ? 'auto' : 'manual'
    });

    var speed = 1;
    var skipping = false;
    var destroyed = false;
    var pendingResolve = null;   // 等待玩家选招的 resolve

    /* ------------------------------------------------------------ 结构 */
    var arenaNode = U.el('div', { class: 'arena' });
    var panelA = U.el('div', { class: 'side-panel is-you' });
    var panelB = U.el('div', { class: 'side-panel is-foe' });
    arenaNode.appendChild(panelA);
    arenaNode.appendChild(U.el('div', { class: 'vs-badge', text: 'VS' }));
    arenaNode.appendChild(panelB);
    host.appendChild(arenaNode);

    var logNode = U.el('div', { class: 'battle-log' });
    host.appendChild(logNode);

    var actionHost = U.el('div', { class: 'mt-16' });
    host.appendChild(actionHost);

    var controlRow = U.el('div', { class: 'battle-controls' });
    host.appendChild(controlRow);

    var resultHost = U.el('div', { class: 'mt-16' });
    host.appendChild(resultHost);

    /* 速度控制 */
    function buildControls() {
      controlRow.innerHTML = '';
      controlRow.appendChild(U.el('span', { class: 'muted row', style: { gap: '.35em' } },
        [UI.icon('gauge'), U.el('span', { text: '播放速度' })]));
      [1, 2, 4].forEach(function (s) {
        controlRow.appendChild(U.el('button', {
          class: 'btn btn-sm' + (speed === s ? ' btn-primary' : ''), text: s + '×',
          onclick: function () { speed = s; buildControls(); }
        }));
      });
      controlRow.appendChild(U.el('button', {
        class: 'btn btn-sm', onclick: function () { skipping = true; }
      }, [UI.icon('forward'), U.el('span', { text: '直接看结果' })]));
      controlRow.appendChild(U.el('button', {
        class: 'btn btn-sm btn-ghost', onclick: function () { leave(); }
      }, [UI.icon('exit'), U.el('span', { text: '离开战斗' })]));
    }
    buildControls();

    /* 只负责停掉战斗循环，不碰路由。
     * 注册成 app.onLeave，这样从地址栏或标签栏离开时也会被调用；
     * 如果它里面再去改 hash，就会和 app.render() 互相递归。 */
    function cleanup() {
      destroyed = true;
      skipping = true;
      if (pendingResolve) { pendingResolve(null); pendingResolve = null; }
      DQQ.app.currentBattle = null;
      hideCG();
    }

    function leave() {
      cleanup();
      if (location.hash === '#/battle') DQQ.app.render();
      else location.hash = '#/battle';
    }

    /* ------------------------------------------------------------ 渲染 */
    var renderedActive = { A: null, B: null };

    function sideLabel(side) {
      return side === 'A' ? ctx.setup.nameA : ctx.setup.nameB;
    }

    /* 面板一律按「快照」渲染，不读引擎实时状态。
     * 因为 AI 对战时 advance() 会把整场打完再交给这里播放，
     * 读实时状态的话，动画还在第 1 回合，血条就已经显示成最后的结果了。 */
    var lastSnap = null;

    function buildSide(side, panel, team) {
      panel.innerHTML = '';
      var m = team.members[team.activeIndex] || null;
      var isHuman = battle.controllerOf(side) === 'human';

      panel.appendChild(U.el('div', { class: 'side-head' }, [
        U.el('span', { class: 'side-name', text: team.name || sideLabel(side) }),
        U.el('span', { class: 'pill', text: isHuman ? '手动' : '自动' })
      ]));

      var fighter = U.el('div', { class: 'fighter ' + UI.rarityClass(m ? m.rarity : '普通') + (m && m.fainted ? ' fainted' : '') });
      if (m) {
        fighter.appendChild(U.el('div', { class: 'fighter-sprite' }, [UI.sprite(m)]));        fighter.appendChild(U.el('div', { class: 'fighter-info' }, [
          U.el('div', { class: 'fighter-name', text: m.name }),
          U.el('div', { class: 'fighter-sub', text: m.rarity + ' · ' + m.type + ' / ' + m.defenseType }),
          UI.hpBar(m.hp, m.maxHp, m.shield),
          UI.statusList(m)
        ]));
      }
      panel.appendChild(fighter);
      panel._fighter = fighter;

      // 替补席
      if (team.members.length > 1) {
        var bench = U.el('div', { class: 'bench' });
        team.members.forEach(function (bm, i) {
          bench.appendChild(U.el('div', {
            class: 'bench-slot' + (i === team.activeIndex ? ' active' : '') + (bm.fainted ? ' fainted' : ''),
            onclick: function () { onBenchClick(side, i); }
          }, [
            U.el('div', { class: 'bs-name', text: bm.name }),
            U.el('div', { class: 'bs-hp', text: bm.fainted ? '阵亡' : bm.hp + '/' + bm.maxHp })
          ]));
        });
        panel.appendChild(bench);
      }

      panel.classList.toggle('is-active', battle.currentSide() === side && !battle.over());
      // 这个 key 必须和 syncSide 里用的完全一致，否则每个事件都会整块重建面板，
      // 血条就失去了平滑收缩的动画。
      renderedActive[side] = m ? (m.name + '|' + m.fainted) : null;
    }

    /* 只更新血条和状态，保留 CSS 过渡动画 */
    function syncSide(side, panel, team) {
      var m = team.members[team.activeIndex] || null;
      var key = m ? (m.name + '|' + m.fainted) : null;
      if (!m || !panel._fighter || renderedActive[side] !== key) {
        buildSide(side, panel, team);
        return;
      }

      var fill = panel._fighter.querySelector('.hpbar-fill');
      var text = panel._fighter.querySelector('.hpbar-text');
      if (fill) {
        var ratio = U.clamp(m.hp / m.maxHp, 0, 1);
        fill.style.width = (ratio * 100) + '%';
        fill.className = 'hpbar-fill ' + (ratio > 0.5 ? '' : (ratio > 0.22 ? 'mid' : 'low'));
      }
      if (text) text.textContent = Math.max(0, Math.round(m.hp)) + ' / ' + m.maxHp;

      // 护盾条 + 状态图标
      var wrap = panel._fighter.querySelector('.fighter-info');
      if (wrap) {
        var old = wrap.querySelector('.shieldbar');
        if (old) old.remove();
        if (m.shield > 0) {
          var bar = U.el('div', { class: 'shieldbar' }, [
            U.el('div', { class: 'shieldbar-fill', style: { width: U.clamp(m.shield / m.maxHp * 100, 4, 100) + '%' } })
          ]);
          var hpNode = wrap.querySelector('.hpbar');
          if (hpNode && hpNode.nextSibling) wrap.insertBefore(bar, hpNode.nextSibling);
          else wrap.appendChild(bar);
        }
        var st = wrap.querySelector('.statuses');
        if (st) st.replaceWith(UI.statusList(m));
      }

      panel._fighter.classList.toggle('fainted', m.fainted);
      panel.classList.toggle('is-active', battle.currentSide() === side && !battle.over());

      // 替补席
      var bench = panel.querySelector('.bench');
      if (bench) {
        U.$$('.bench-slot', bench).forEach(function (node, i) {
          var bm = team.members[i];
          if (!bm) return;
          node.classList.toggle('active', i === team.activeIndex);
          node.classList.toggle('fainted', bm.fainted);
          var hp = node.querySelector('.bs-hp');
          if (hp) hp.textContent = bm.fainted ? '阵亡' : bm.hp + '/' + bm.maxHp;
        });
      }
    }

    /* 用一份快照刷新两边面板；snap 为空则用引擎当前状态 */
    function applySnapshot(snap) {
      var s = snap || battle.snapshot();
      lastSnap = s;
      syncSide('A', panelA, s.A);
      syncSide('B', panelB, s.B);
    }

    function syncAll() { applySnapshot(null); }

    /* ------------------------------------------------------------ 日志 */
    function logLine(text, kind, isTurnHeader) {
      if (isTurnHeader) {
        logNode.appendChild(U.el('div', { class: 'log-turn', text: text }));
      } else {
        logNode.appendChild(U.el('div', { class: 'log-line ' + (kind || 'info'), text: text }));
      }
      // 只保留最近 200 条，避免长战斗把 DOM 撑爆
      while (logNode.childNodes.length > 200) logNode.removeChild(logNode.firstChild);
      logNode.scrollTop = logNode.scrollHeight;
    }

    /* ------------------------------------------------------- 特效 */
    function shake(hard) {
      document.body.classList.remove('shake', 'shake-hard');
      void document.body.offsetWidth;
      document.body.classList.add(hard ? 'shake-hard' : 'shake');
      setTimeout(function () { document.body.classList.remove('shake', 'shake-hard'); }, 600);
    }

    function flash() {
      var layer = document.getElementById('fx-layer');
      var f = U.el('div', { class: 'flash-overlay' });
      layer.appendChild(f);
      setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 380);
    }

    function skillBanner(name) {
      var layer = document.getElementById('fx-layer');
      var b = U.el('div', { class: 'skill-banner', text: name });
      layer.appendChild(b);
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1100);
    }

    function showCG(src, caption) {
      var layer = document.getElementById('cg-layer');
      var img = document.getElementById('cg-image');
      var cap = document.getElementById('cg-caption');
      img.src = src;
      cap.textContent = caption || '';
      layer.classList.add('show');
      layer.setAttribute('aria-hidden', 'false');
    }

    function hideCG() {
      var layer = document.getElementById('cg-layer');
      layer.classList.remove('show');
      layer.setAttribute('aria-hidden', 'true');
    }

    function floatDamage(side, text, cls) {
      var panel = side === 'A' ? panelA : panelB;
      var sprite = panel.querySelector('.fighter-sprite');
      if (!sprite) return;
      var rect = sprite.getBoundingClientRect();
      var node = U.el('div', {
        class: 'float-dmg ' + (cls || ''),
        text: text,
        style: { left: (rect.left + rect.width / 2) + 'px', top: (rect.top - 6) + 'px' }
      });
      document.getElementById('fx-layer').appendChild(node);
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1200);
    }

    function lunge(side) {
      var panel = side === 'A' ? panelA : panelB;
      var f = panel._fighter;
      if (!f) return;
      var cls = side === 'A' ? 'lunge-right' : 'lunge-left';
      f.classList.remove('lunge-left', 'lunge-right');
      void f.offsetWidth;
      f.classList.add(cls);
      setTimeout(function () { f.classList.remove(cls); }, 360);
    }

    function hitFlash(side) {
      var panel = side === 'A' ? panelA : panelB;
      var sprite = panel.querySelector('.fighter-sprite');
      if (!sprite) return;
      sprite.classList.remove('hit-flash');
      void sprite.offsetWidth;
      sprite.classList.add('hit-flash');
      setTimeout(function () { sprite.classList.remove('hit-flash'); }, 320);
    }

    /* ------------------------------------------------------------ 播放 */
    function sleep(ms) {
      if (skipping || destroyed) return Promise.resolve();
      return new Promise(function (res) { setTimeout(res, ms); });
    }

    function baseDelay() {
      return Math.max(80, (S.getSettings().autoPlayDelay || 900) / speed);
    }

    var ctxForLog = {};

    async function playEvents(events) {
      for (var i = 0; i < events.length; i++) {
        if (destroyed) return;
        await playEvent(events[i]);
      }
      syncAll();
    }

    async function playEvent(ev) {
      // 解说文案要用到队名和场上是谁，每个事件都刷新一次
      ctxForLog.names = { A: battle.teams.A.name, B: battle.teams.B.name };
      ctxForLog.actives = { A: battle.active('A'), B: battle.active('B') };

      // 事件自带的快照就是「这一刻」的场上状态，面板统一按它刷新
      if (ev.snapshot) applySnapshot(ev.snapshot);

      switch (ev.type) {
        case 'turn-start':
          logLine('第 ' + ev.turn + ' 回合', 'info', true);
          await sleep(baseDelay() * 0.4);
          return;

        case 'order': {
          var lo = C.turn(ev, ctxForLog);
          if (lo) logLine(lo.text, lo.kind);
          await sleep(baseDelay() * 0.35);
          return;
        }

        case 'use-skill': {
          var line = C.turn(ev, ctxForLog);
          if (line) logLine(line.text, 'skill');
          if (ev.hasCg && ev.cg) {
            // 设计文档 6.1：绑了 CG 就全屏展示 1.5 秒，然后才结算伤害
            showCG(ev.cg, ev.member.name + ' · ' + ev.skill.name);
            shake(true);
            await sleep(CG_HOLD_MS);
            hideCG();
          } else {
            shake(false);
            flash();
            skillBanner(ev.skill.name);
            lunge(ev.side);
            await sleep(baseDelay() * 0.75);
          }
          break;
        }

        case 'damage': {
          var l = C.turn(ev, ctxForLog);
          if (l) logLine(l.text, l.kind);
          hitFlash(ev.side === 'A' ? 'B' : 'A');
          if (ev.crit || ev.effectiveness === 'super') shake(true);
          var cls = ev.crit ? 'crit' : (ev.effectiveness === 'super' ? 'super' : (ev.effectiveness === 'weak' ? 'weak' : ''));
          floatDamage(ev.side === 'A' ? 'B' : 'A', '-' + ev.damage, cls);
          await sleep(baseDelay() * (ev.crit || ev.effectiveness === 'super' ? 1 : 0.7));
          return;
        }

        case 'heal':
          var lh = C.turn(ev, ctxForLog);
          if (lh) logLine(lh.text, lh.kind);
          floatDamage(ev.side, '+' + ev.amount, 'heal');
          await sleep(baseDelay() * 0.5);
          return;

        case 'faint': {
          var lf = C.turn(ev, ctxForLog);
          if (lf) logLine(lf.text, lf.kind);
          shake(true);
          await sleep(baseDelay() * 0.9);
          return;
        }

        case 'switch-in': {
          var ls = C.turn(ev, ctxForLog);
          if (ls) logLine(ls.text, ls.kind);
          await sleep(baseDelay() * 0.7);
          return;
        }

        case 'shield':
        case 'shield-absorb':
        case 'regen':
        case 'dot':
        case 'effect':
        case 'effect-miss':
        case 'stun-skip':
        case 'miss': {
          var le = C.turn(ev, ctxForLog);
          if (le) logLine(le.text, le.kind);
          if (ev.type === 'miss') {
            floatDamage(ev.side === 'A' ? 'B' : 'A', 'MISS', 'miss');
          }
          await sleep(baseDelay() * 0.45);
          return;
        }

        case 'turn-end':
          syncAll();
          logLine(C.turn(ev, ctxForLog).text, 'info');
          await sleep(baseDelay() * 0.6);
          return;

        case 'end':
          syncAll();
          logLine(C.turn(ev, ctxForLog).text, 'end');
          await sleep(200);
          return;

        default:
          return;
      }
    }

    /* ---------------------------------------------------- 玩家操作区 */
    function buildActions() {
      actionHost.innerHTML = '';
      var p = battle.pending();
      if (!p) return;

      if (!p.controllable) return;   // AI 自己会走，界面不用管

      var m = battle.active(p.side);

      if (p.type === 'forcedSwitch') {
        var box = U.el('div', { class: 'card' });
        box.appendChild(U.el('h3', { class: 'row', style: { gap: '.4em' } },
          [UI.icon('alert'), U.el('span', { text: sideLabel(p.side) + ' 的蛐蛐倒下了，必须换人' })]));
        box.appendChild(U.el('div', { class: 'muted mb-8', text: '强制换人不消耗行动机会。' }));
        var row = U.el('div', { class: 'pick-grid' });
        p.options.forEach(function (o) {
          row.appendChild(U.el('div', {
            class: 'pick-item ' + UI.rarityClass(o.member.rarity),
            onclick: function () { submitChoice({ index: o.index }); }
          }, [
            U.el('div', { class: 'pi-name' }, [UI.sprite(o.member), U.el('span', { text: o.member.name })]),
            U.el('div', { class: 'pi-meta', text: 'HP ' + o.member.hp + '/' + o.member.maxHp }),
            U.el('div', { class: 'pi-meta', text: '攻' + Math.round(DQQ.engine.stat(o.member, 'attack')) + ' 防' + Math.round(DQQ.engine.stat(o.member, 'defense')) + ' 速' + Math.round(DQQ.engine.stat(o.member, 'speed')) })
          ]));
        });
        box.appendChild(row);
        actionHost.appendChild(box);
        return;
      }

      // 普通出招
      var head = U.el('div', { class: 'row-between mb-8' }, [
        U.el('h3', { class: 'row', style: { gap: '.4em' } }, [UI.icon('zap'), U.el('span', { text: '轮到「' + m.name + '」出招' })]),
        U.el('span', { class: 'muted', text: '速度 ' + Math.round(DQQ.engine.stat(m, 'speed')) + ' · 当前 HP ' + m.hp + '/' + m.maxHp })
      ]);
      actionHost.appendChild(head);

      var bar = U.el('div', { class: 'skill-bar' });
      m.skills.forEach(function (sk, i) {
        bar.appendChild(UI.skillButton(sk, function () { submitChoice({ kind: 'skill', index: i }); }));
      });
      actionHost.appendChild(bar);

      // 主动换人
      var switches = p.options.filter(function (o) { return o.kind === 'switch'; });
      if (switches.length) {
        var swBox = U.el('div', { class: 'mt-16' });
        swBox.appendChild(U.el('div', { class: 'muted mb-8', style: { fontSize: '12.5px' },
          text: '主动换人会消耗这一次行动机会，对方可以自由出招——想清楚再换。' }));
        var swRow = U.el('div', { class: 'pick-grid' });
        switches.forEach(function (o) {
          swRow.appendChild(U.el('div', {
            class: 'pick-item ' + UI.rarityClass(o.member.rarity),
            onclick: function () { submitChoice({ kind: 'switch', index: o.index }); }
          }, [
            U.el('div', { class: 'pi-name' }, [UI.icon('refresh'), UI.sprite(o.member), U.el('span', { text: o.member.name })]),
            U.el('div', { class: 'pi-meta', text: 'HP ' + o.member.hp + '/' + o.member.maxHp + ' · ' + o.member.defenseType })
          ]));
        });
        swBox.appendChild(swRow);
        actionHost.appendChild(swBox);
      }
    }

    /* 点击替补席：强制换人时直接换，普通情况下提示 */
    function onBenchClick(side, index) {
      var p = battle.pending();
      if (!p) return;
      if (p.side !== side) { U.toast('现在不是这一方在操作', 'err'); return; }
      var opt = (p.options || []).filter(function (o) { return o.kind === 'switch' && o.index === index; })[0];
      if (p.type === 'forcedSwitch') {
        opt = (p.options || []).filter(function (o) { return o.index === index; })[0];
      }
      if (!opt) {
        var m = battle.active(side);
        if (m && index === battle.team(side).activeIndex) U.toast('这只已经在场上了', 'info');
        else U.toast('现在不能换这只', 'err');
        return;
      }
      submitChoice({ kind: 'switch', index: index });
    }

    function submitChoice(choice) {
      var resolve = pendingResolve;
      pendingResolve = null;
      actionHost.innerHTML = '';
      if (resolve) resolve(choice);
    }

    /* --------------------------------------------------------- 主循环 */
    async function main() {
      battle.start();
      await playEvents(battle.advance());

      var guard = 0;
      while (!battle.over() && !destroyed && guard++ < 500) {
        var p = battle.pending();
        if (!p || !p.controllable) {
          // 正常情况下 advance() 会把 AI 的行动一路跑完，只有需要玩家输入才停下。
          // 万一真停在这里，再推一次；如果连事件都没产生，说明推不动了，直接跳出防止死循环。
          var ev = battle.advance();
          await playEvents(ev);
          if (!ev.length) {
            console.warn('[dqq] 战斗推进停滞，已中断避免死循环');
            break;
          }
          continue;
        }

        buildActions();
        var choice = await new Promise(function (res) { pendingResolve = res; });
        if (destroyed) return;
        if (!choice) continue;
        battle.submit(choice);
        await playEvents(battle.advance());
      }

      if (destroyed) return;
      syncAll();
      showResult();
    }

    /* --------------------------------------------------------- 结果 */
    function showResult() {
      actionHost.innerHTML = '';
      var st = battle.st;
      var winner = st.winner;
      var cls = winner === null ? 'draw' : (winner === 'A' ? 'win' : 'lose');
      var title = winner === null
        ? '平  局'
        : (winner === 'A' ? sideLabel('A') + ' 获胜！' : sideLabel('B') + ' 获胜！');

      var banner = U.el('div', { class: 'result-banner ' + cls }, [
        U.el('div', { class: 'rb-title', text: title }),
        U.el('div', { class: 'rb-sub', text: st.reason + ' · 共 ' + st.turn + ' 回合' })
      ]);
      resultHost.appendChild(banner);

      var row = U.el('div', { class: 'row' }, [
        U.el('button', { class: 'btn btn-primary', onclick: function () { DQQ.app.rematch(); } },
          [UI.icon('refresh'), U.el('span', { text: '再来一局' })]),
        U.el('button', { class: 'btn', onclick: function () {
          U.copyText(C.report(battle), '战报已复制，去群里发吧');
        } }, [UI.icon('clipboard'), U.el('span', { text: '复制战报' })]),
        U.el('button', { class: 'btn', onclick: function () {
          DQQ.share.render(battle, function (err, canvas) {
            if (err) { U.toast(err.message, 'err'); return; }
            U.modal({
              title: '战报图（右键或长按保存）',
              wide: true,
              render: function (m) {
                canvas.style.maxWidth = '100%';
                canvas.style.borderRadius = '12px';
                m.body.appendChild(canvas);
                m.footer.appendChild(U.el('button', {
                  class: 'btn btn-primary',
                  onclick: function () {
                    U.download('战报-' + sideLabel('A') + '-vs-' + sideLabel('B') + '.png', canvas.toDataURL('image/png'));
                  }
                }, [UI.icon('download'), U.el('span', { text: '下载图片' })]));
                m.footer.appendChild(U.el('button', { class: 'btn btn-ghost', onclick: m.close },
                  [UI.icon('close'), U.el('span', { text: '关闭' })]));
              }
            });
          });
        } }, [UI.icon('image'), U.el('span', { text: '生成战报图' })]),
        U.el('button', { class: 'btn btn-ghost', onclick: leave },
          [UI.icon('exit'), U.el('span', { text: '离开' })])
      ]);
      resultHost.appendChild(row);

      // 存进战报历史
      S.addHistory({
        at: new Date().toISOString(),
        nameA: sideLabel('A'), nameB: sideLabel('B'),
        winner: winner === null ? null : sideLabel(winner),
        reason: st.reason,
        turns: st.turn,
        mode: ctx.setup.mode,
        report: C.report(battle)
      });
    }

    /* ------------------------------------------------------------ 启动 */
    // 离开这个页面时要把战斗循环停掉，否则定时器会一直在后台跑
    DQQ.app.onLeave = cleanup;
    // 挂一份到 app 上：万一战斗卡住，可以在控制台看它停在哪一步
    DQQ.app.debugBattle = battle;

    applySnapshot(null);
    logLine(C.intro(sideLabel('A'), sideLabel('B')), 'info');
    main();
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
