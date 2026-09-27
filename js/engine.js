/* =========================================================================
 * 附中·电子斗蛐蛐  战斗引擎
 *
 * 纯逻辑，不碰 DOM。UI、模拟器、测试都调它。
 *
 * 一个「回合」= 双方各一次行动机会，按速度决定先后。
 * 蛐蛐阵亡 → 强制换人（不消耗行动机会），补位的那只接管本回合剩下的行动机会；
 * 如果这只蛐蛐所在的队伍本回合已经行动过了，补位的就等到下回合。
 * 主动换人 → 消耗自己这次行动机会，对方自由出招。
 *
 * 用法：
 *   var b = DQQ.engine.create({ teams:{A:[...],B:[...]}, controllers:{A:'human',B:'ai'} });
 *   b.start();
 *   var ev = b.advance();               // 推进到下一个需要输入的节点
 *   while (!b.over()) {
 *     var p = b.pending();              // { side, type, options } 或 null
 *     if (p && p.controllable) b.submit(玩家选择);
 *     ev = b.advance();
 *   }
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var E = DQQ.effect;
  var B = DQQ.balance;

  var engine = (DQQ.engine = {});

  engine.CONST = {
    BASE_CRIT: 0.05,     // 基础暴击率
    CRIT_MULT: 1.5,      // 暴击倍率
    RAND_MIN: 0.85,      // 随机浮动下限
    RAND_MAX: 1.00,

    /* 伤害标定常数。伤害按「攻击力 / (攻击力 + 防御力)」这个比例来算，
     * 用这个系数把整体节奏定在「打 6~8 下倒一只」。
     *
     * 为什么不用「减防御点数」或「减伤百分比」：
     *   - 直接减点数：和 0.5×~2× 的克制倍率没法共存。减得少则防御形同虚设
     *     （两下被打死），减得多则弱化攻击直接变成 1 点伤害、高防免疫一切。
     *   - 减伤百分比（防御/(防御+K)）：有效血量随防御线性增长，而伤害随攻击线性增长，
     *     实测无论怎么调 K，攻击流都能把防御流打到 80%+ 胜率 —— 攻击每点永远更值钱。
     *   - 用比例 atk/(atk+def)：攻防完全对称。攻击翻倍和防御翻倍对胜负的影响一样大，
     *     而且天然有递减、永远不会免疫、也不会出现 1 点伤害的废招。 */
    DMG_K: 60,

    /* 单次伤害上限（占目标最大血量的比例）。
     * 克制 2× + 暴击叠起来能打出 3 倍伤害，这一条保证再狠也至少三下才倒。
     * 取 0.45：两下最多打掉 90%，还剩一口气。 */
    MAX_HIT_RATIO: 0.45,

    MIN_DAMAGE: 1,
    POWER_SCALE: 0.01,   // 威力按百分比折算成倍率
    MAX_TURNS: 40,       // 拖太久就按剩余血量判定
    ACC_MIN: 5
  };

  var C = engine.CONST;

  /* ------------------------------------------------------------------ 查表 */
  engine.typeMult = function (atkType, defType) {
    var row = DQQ.TYPE_MULT[atkType];
    return (row && row[defType] != null) ? row[defType] : 1;
  };

  engine.elementMult = function (element, defenseType) {
    var row = DQQ.ELEMENT_MULT[element];
    return (row && row[defenseType] != null) ? row[defenseType] : 1;
  };

  engine.effAccuracy = function (attacker, defender, skill) {
    var et = DQQ.ELEMENT_TRAITS[skill.element] || {};
    var dt = DQQ.DEFENSE_TRAITS[defender.defenseType] || {};
    var acc = (Number(skill.accuracy) || 90) + (et.accuracyBonus || 0) - (dt.dodge || 0);
    return U.clamp(acc, C.ACC_MIN, 100);
  };

  engine.critRate = function (attacker, skill) {
    var et = DQQ.ELEMENT_TRAITS[skill.element] || {};
    return U.clamp(C.BASE_CRIT + (et.critBonus || 0) / 100, 0, 1);
  };

  /* ------------------------------------------------------------ 伤害计算 */
  /* 最终伤害 = DMG_K × 技能威力/100 × 属性克制 × 类型克制 × 暴击 × 随机浮动
   *            × 攻击力 / (攻击力 + 防御力)
   *
   * 最后那一项是攻防比：攻击力等于防御力时是 0.5。它保证了
   * 「攻击 +30」和「防御 +30」对胜负的影响一样大 —— 也就是攻击和防御成正比。
   * 规则属性的技能无视 50% 防御，等于把这一项的分母变小、伤害变高。
   * 再压一道单次伤害上限，避免「克制 2× + 暴击」把对手两下秒掉。 */
  engine.damageRatio = function (attack, defense) {
    return attack / (attack + defense);
  };

  /* 有效防御（算上规则属性的无视防御） */
  function effectiveDefense(defender, skill) {
    var def = engine.stat(defender, 'defense');
    var et = DQQ.ELEMENT_TRAITS[skill.element] || {};
    if (et.defPierce) def *= (1 - et.defPierce);
    return def;
  }

  engine.calcDamage = function (attacker, defender, skill, rng) {
    rng = rng || Math.random;

    var atk = engine.stat(attacker, 'attack');
    var def = effectiveDefense(defender, skill);

    var elemMult = engine.elementMult(skill.element, defender.defenseType);
    var typeMult = engine.typeMult(attacker.type, defender.type);
    var crit = rng() < engine.critRate(attacker, skill);
    var float = C.RAND_MIN + rng() * (C.RAND_MAX - C.RAND_MIN);

    var raw = C.DMG_K * (Number(skill.power) * C.POWER_SCALE) * elemMult * typeMult
            * (crit ? C.CRIT_MULT : 1) * float * engine.damageRatio(atk, def);
    var beforeCap = raw;

    // 单次伤害上限：克制 2× 再叠暴击最多也只有这么多，保证至少三下才倒
    var cap = defender.maxHp * C.MAX_HIT_RATIO;
    var dmg = beforeCap > cap ? cap : beforeCap;

    return {
      damage: Math.max(C.MIN_DAMAGE, Math.round(dmg)),
      crit: crit,
      elemMult: elemMult,
      typeMult: typeMult,
      capped: beforeCap > cap,
      effectiveness: elemMult >= 2 ? 'super' : (elemMult <= 0.5 ? 'weak' : 'normal')
    };
  };

  /* 不掷骰子的期望伤害，给 AI 决策用 */
  engine.expectedDamage = function (attacker, defender, skill) {
    var atk = engine.stat(attacker, 'attack');
    var def = effectiveDefense(defender, skill);
    var elemMult = engine.elementMult(skill.element, defender.defenseType);
    var typeMult = engine.typeMult(attacker.type, defender.type);
    var critRate = engine.critRate(attacker, skill);
    var critFactor = 1 + critRate * (C.CRIT_MULT - 1);
    var raw = C.DMG_K * (Number(skill.power) * C.POWER_SCALE) * elemMult * typeMult
            * critFactor * 0.925 * engine.damageRatio(atk, def);
    return Math.max(C.MIN_DAMAGE, Math.min(raw, defender.maxHp * C.MAX_HIT_RATIO));
  };

  /* 有效属性 = 基础值 × 所有增益/减益 */
  engine.stat = function (member, stat) {
    var v = member.base[stat];
    for (var i = 0; i < member.mods.length; i++) {
      var m = member.mods[i];
      if (m.stat === stat) v *= (1 + m.value);
    }
    return Math.max(1, v);
  };

  /* ------------------------------------------------------------ 成员状态 */
  function makeMember(cricket) {
    var skills = (cricket.skills || []).map(function (s) {
      var c = U.deepClone(s);
      c.effect = E.normalize(s.effect);   // 统一成结构化对象，战斗时不再解析字符串
      return c;
    });
    var maxHp = Math.max(1, Number(cricket.stats.hp) || 1);
    return {
      uid: U.uid('m'),
      name: cricket.name,
      portrait: cricket.portrait || null,
      type: cricket.type,
      defenseType: cricket.defenseType,
      rarity: cricket.rarity,
      personality: cricket.personality || '',
      skills: skills,
      base: {
        attack: Number(cricket.stats.attack) || 1,
        defense: Number(cricket.stats.defense) || 1,
        speed: Number(cricket.stats.speed) || 1
      },
      maxHp: maxHp,
      hp: maxHp,
      mods: [],          // { stat, value, turns }
      dot: [],           // { value, turns }
      shield: 0,
      shieldTurns: 0,
      stunTurns: 0,
      fainted: false,
      damageDealt: 0,
      damageTaken: 0,
      kills: 0
    };
  }

  /* ---------------------------------------------------------------- 战斗 */
  function Battle(opts) {
    opts = opts || {};
    var self = this;

    this.teams = {};
    ['A', 'B'].forEach(function (side) {
      var raw = (opts.teams && opts.teams[side]) || {};
      // 两种写法都收：直接给数组 [蛐蛐, ...]，或给 { name, members:[...] }
      var t = Array.isArray(raw) ? { members: raw } : raw;
      var members = (t.members || []).map(makeMember);
      self.teams[side] = {
        side: side,
        name: t.name || (side === 'A' ? '我方' : '对方'),
        members: members,
        activeIndex: 0,
        faintedCount: 0
      };
    });

    this.controllers = { A: (opts.controllers && opts.controllers.A) || 'ai', B: (opts.controllers && opts.controllers.B) || 'ai' };
    this.mode = opts.mode || 'auto';       // 'auto' 1v1 自动 / 'manual' 3v3 手动
    this.rng = opts.rng || Math.random;

    this.st = {
      turn: 0,
      phase: 'init',
      order: [],
      actionIdx: 0,
      acted: { A: false, B: false },
      switchQueue: [],
      pendingAction: null,
      pendingSwitch: null,
      winner: null,
      reason: '',
      events: [],
      log: []
    };
    this._resetActs();
  }

  Battle.prototype._resetActs = function () {
    this.st.acted = { A: false, B: false };
  };

  Battle.prototype.team = function (side) { return this.teams[side]; };
  Battle.prototype.other = function (side) { return side === 'A' ? 'B' : 'A'; };
  Battle.prototype.active = function (side) {
    var t = this.teams[side];
    return t.members[t.activeIndex] || null;
  };
  Battle.prototype.aliveList = function (side) {
    return this.teams[side].members.filter(function (m) { return !m.fainted; });
  };
  Battle.prototype.controllerOf = function (side) { return this.controllers[side]; };
  Battle.prototype.over = function () { return this.st.phase === 'ended'; };
  Battle.prototype.currentSide = function () {
    return this.st.order[this.st.actionIdx] || null;
  };

  Battle.prototype.start = function () {
    this.st.phase = 'turnStart';
    return this;
  };

  /* ------------------------------------------------------------ 事件记录 */
  /* 会改变场上状态的几种事件，顺手附上一份当时的快照。
   * 因为 advance() 可能一口气把整场战斗都跑完再交给界面播放，
   * 界面如果直接读引擎的实时状态，动画还没播完就会显示成最终结果。
   * 有了快照，界面就能严格按事件重放。 */
  var SNAPSHOT_EVENTS = {
    'damage': 1, 'heal': 1, 'shield': 1, 'shield-absorb': 1, 'dot': 1, 'regen': 1,
    'faint': 1, 'switch-in': 1, 'effect': 1, 'stun-skip': 1, 'use-skill': 1, 'end': 1
  };

  Battle.prototype._ev = function (list, e) {
    if (SNAPSHOT_EVENTS[e.type]) e.snapshot = this.snapshot();
    list.push(e);
    this.st.events.push(e);
    if (e.type !== 'turn-start') this.st.log.push(e);
    return e;
  };

  /* ------------------------------------------------------ 当前需要什么输入 */
  /* 返回 null 表示引擎可以自己往下跑 */
  Battle.prototype.pending = function () {
    var st = this.st;
    if (st.phase === 'choose') {
      var side = this.currentSide();
      if (!side) return null;
      var me = this.active(side);
      if (!me || me.fainted) return null;
      if (me.stunTurns > 0) return null;          // 被控住了，引擎直接跳过
      return {
        side: side,
        type: 'action',
        controllable: this.controllers[side] === 'human',
        member: me,
        options: this._actionOptions(side)
      };
    }
    if (st.phase === 'forcedSwitch') {
      var s = st.switchQueue[0];
      if (!s) return null;
      return {
        side: s,
        type: 'forcedSwitch',
        controllable: this.controllers[s] === 'human',
        options: this._switchOptions(s)
      };
    }
    return null;
  };

  Battle.prototype._actionOptions = function (side) {
    var me = this.active(side);
    var opts = me.skills.map(function (s, i) {
      return { kind: 'skill', index: i, skill: s };
    });
    // 主动换人：替补席还有人才能换
    if (this.aliveList(side).length > 1) {
      var self = this;
      this.teams[side].members.forEach(function (m, i) {
        if (i !== self.teams[side].activeIndex && !m.fainted) {
          opts.push({ kind: 'switch', index: i, member: m });
        }
      });
    }
    return opts;
  };

  Battle.prototype._switchOptions = function (side) {
    var self = this;
    return this.teams[side].members
      .map(function (m, i) { return { index: i, member: m }; })
      .filter(function (o) { return !o.member.fainted && o.index !== self.teams[side].activeIndex; });
  };

  /* ------------------------------------------------------------ 提交选择 */
  Battle.prototype.submit = function (choice) {
    var st = this.st;
    if (st.phase === 'choose') {
      st.pendingAction = choice;
      st.phase = 'resolve';
      return true;
    }
    if (st.phase === 'forcedSwitch') {
      var side = st.switchQueue[0];
      if (!side) return false;
      var idx = choice && choice.index;
      if (typeof idx !== 'number' || !this._switchOptions(side).some(function (o) { return o.index === idx; })) {
        idx = this._switchOptions(side)[0].index;   // 非法选择就退化成替补席第一只
      }
      st.pendingSwitch = { index: idx };
      st.phase = 'resolveSwitch';                   // 真正换人在 advance() 里做，事件才收集得到
      return true;
    }
    return false;
  };

  /* ---------------------------------------------------------------- 推进 */
  /* 一直跑到「需要玩家输入」或「战斗结束」，返回这一段时间产生的所有事件 */
  Battle.prototype.advance = function () {
    var st = this.st;
    var events = [];
    var guard = 0;
    st._pendingEvents = events;

    while (guard++ < 2000) {
      if (st.phase === 'ended') break;

      if (st.phase === 'init' || st.phase === 'turnStart') {
        this._beginTurn(events);
        continue;
      }

      if (st.phase === 'choose') {
        var side = this.currentSide();
        var me = side ? this.active(side) : null;
        if (!side || !me || me.fainted) { st.phase = 'afterAction'; continue; }

        // 被控制：直接跳过这次行动
        if (me.stunTurns > 0) {
          me.stunTurns -= 1;
          this._ev(events, { type: 'stun-skip', side: side, member: me });
          st.acted[side] = true;
          st.phase = 'afterAction';
          continue;
        }

        if (this.controllers[side] === 'ai') {
          st.pendingAction = this._aiChoose(side);
          st.phase = 'resolve';
          continue;
        }

        break;  // 等玩家点技能
      }

      if (st.phase === 'resolve') {
        this._resolveAction(events);
        continue;
      }

      // 强制换人：补位的那只接管本回合剩下的行动机会；
      // 如果这一队本回合已经行动过了，补位的就等到下回合。
      if (st.phase === 'resolveSwitch') {
        var swSide = st.switchQueue.shift();
        var swIdx = st.pendingSwitch ? st.pendingSwitch.index : this._switchOptions(swSide)[0].index;
        st.pendingSwitch = null;
        this._doSwitch(swSide, swIdx, true, events);
        if (st.switchQueue.length) {
          st.phase = 'forcedSwitch';
        } else {
          var cur = this.currentSide();
          st.phase = (cur && st.acted[cur]) ? 'afterAction' : 'choose';
        }
        continue;
      }

      if (st.phase === 'afterAction') {
        this._afterAction(events);
        continue;
      }

      if (st.phase === 'forcedSwitch') {
        var p = this.pending();
        if (!p) {
          st.switchQueue.shift();
          st.phase = st.switchQueue.length ? 'forcedSwitch' : 'choose';
          continue;
        }
        if (p.controllable) break;                  // 等玩家选替补
        this.submit({ index: this._aiPickSwitch(p.side) });
        continue;
      }

      break;
    }

    st._pendingEvents = null;
    return events;
  };

  /* ------------------------------------------------------------ 回合开始 */
  Battle.prototype._beginTurn = function (events) {
    var st = this.st;
    st.turn += 1;
    this._resetActs();
    st.actionIdx = 0;
    st.switchQueue = [];
    this._ev(events, { type: 'turn-start', turn: st.turn });

    // 1) 先排行动顺序。放在 DOT 之前，这样即使有人被 DOT 打死触发强制换人，
    //    st.order 也已经就绪，换完人能正确接管行动机会。
    var a0 = this.active('A'), b0 = this.active('B');
    var order = ['A', 'B'];
    if (a0 && b0) {
      var sa = engine.stat(a0, 'speed'), sb = engine.stat(b0, 'speed');
      if (sb > sa) order = ['B', 'A'];
      else if (sb === sa && this.rng() < 0.5) order = ['B', 'A'];
    }
    st.order = order;
    this._ev(events, {
      type: 'order', order: order,
      speeds: { A: a0 ? Math.round(engine.stat(a0, 'speed')) : 0, B: b0 ? Math.round(engine.stat(b0, 'speed')) : 0 }
    });

    // 2) 持续伤害 / 每回合回复
    var self = this;
    ['A', 'B'].forEach(function (side) {
      var m = self.active(side);
      if (!m || m.fainted) return;

      // 中毒 / 抄写十遍之类的持续伤害
      var dotTotal = 0;
      m.dot.forEach(function (d) { dotTotal += d.value; });
      if (dotTotal > 0) {
        var dealt = self._applyDamage(m, Math.round(dotTotal), events, { side: self.other(side), source: 'dot' });
        self._ev(events, { type: 'dot', side: side, member: m, damage: dealt, hp: m.hp });
      }
      m.dot = m.dot.map(function (d) { return { value: d.value, turns: d.turns - 1 }; })
                   .filter(function (d) { return d.turns > 0; });

      // 食堂被动：每回合回血（先确认没被 DOT 打死）
      var dt = DQQ.DEFENSE_TRAITS[m.defenseType] || {};
      if (dt.regen && m.hp > 0 && m.hp < m.maxHp) {
        var healed = Math.min(dt.regen, m.maxHp - m.hp);
        m.hp += healed;
        self._ev(events, { type: 'regen', side: side, member: m, amount: healed, hp: m.hp });
      }
    });

    // 3) 有人被 DOT 打死了？
    if (this._settleFaints(events)) return;

    st.phase = 'choose';
  };

  /* ------------------------------------------------------------ 处理死亡 */
  /* 返回 true 表示战斗结束或进入了换人流程（调用方应立即 return） */
  Battle.prototype._settleFaints = function (events) {
    var st = this.st;
    var self = this;
    var needSwitch = [];

    ['A', 'B'].forEach(function (side) {
      var m = self.active(side);
      if (m && m.hp <= 0 && !m.fainted) {
        m.hp = 0;
        m.fainted = true;
        self.teams[side].faintedCount += 1;
        self._ev(events, { type: 'faint', side: side, member: m, teamName: self.teams[side].name });
        needSwitch.push(side);
      }
    });

    // 有队伍全灭 → 结束
    var aliveA = this.aliveList('A').length;
    var aliveB = this.aliveList('B').length;
    if (aliveA === 0 || aliveB === 0) {
      if (aliveA === 0 && aliveB === 0) {
        st.winner = null;
        st.reason = '同归于尽';
      } else {
        st.winner = aliveA === 0 ? 'B' : 'A';
        st.reason = '全员阵亡';
      }
      st.phase = 'ended';
      this._ev(events, { type: 'end', winner: st.winner, reason: st.reason, turn: st.turn });
      return true;
    }

    if (needSwitch.length) {
      st.switchQueue = needSwitch;
      st.pendingAction = null;
      st.phase = 'forcedSwitch';
      return true;
    }
    return false;
  };

  /* ------------------------------------------------------------ 换人执行 */
  Battle.prototype._doSwitch = function (side, index, forced, events) {
    var team = this.teams[side];
    var out = team.members[team.activeIndex];
    team.activeIndex = index;
    var inn = team.members[index];

    // 被换下去的那只，身上的增减益和护盾都清掉
    if (out) {
      out.mods = [];
      out.shield = 0;
      out.shieldTurns = 0;
      out.stunTurns = 0;
    }
    inn.mods = [];
    inn.shield = 0;
    inn.shieldTurns = 0;
    inn.stunTurns = 0;

    this._ev(events, {
      type: 'switch-in', side: side, member: inn, out: out,
      forced: !!forced, teamName: team.name
    });
  };

  /* ------------------------------------------------------------ 结算行动 */
  Battle.prototype._resolveAction = function (events) {
    var st = this.st;
    var side = this.currentSide();
    var me = side ? this.active(side) : null;
    var choice = st.pendingAction;
    st.pendingAction = null;

    if (!side || !me || me.fainted || !choice) {
      st.phase = 'afterAction';
      return;
    }

    if (choice.kind === 'switch') {
      var valid = this._switchOptions(side).some(function (o) { return o.index === choice.index; });
      if (!valid) {
        st.phase = 'choose';   // 选择非法，让玩家重选
        return;
      }
      // 主动换人消耗这次行动机会
      this._doSwitch(side, choice.index, false, events);
      st.acted[side] = true;
      st.phase = 'afterAction';
      return;
    }

    var skill = me.skills[choice.index];
    if (!skill) { st.phase = 'afterAction'; return; }

    // 先记「这一队本回合已经行动过」，再结算。
    // 否则打死对手后 _settleFaints 会提前 return，补位的那只就能白赚一次行动。
    st.acted[side] = true;
    this._useSkill(side, me, skill, events);

    // 打完可能有人倒下
    if (this._settleFaints(events)) return;

    st.phase = 'afterAction';
  };

  /* ------------------------------------------------------------ 释放技能 */
  Battle.prototype._useSkill = function (side, me, skill, events) {
    var foeSide = this.other(side);
    var foe = this.active(foeSide);
    var self = this;

    this._ev(events, {
      type: 'use-skill', side: side, member: me, target: foe,
      skill: skill, hasCg: !!skill.cg, cg: skill.cg || null
    });

    if (!foe) return;

    // 命中判定
    var acc = engine.effAccuracy(me, foe, skill);
    if (this.rng() * 100 >= acc) {
      this._ev(events, { type: 'miss', side: side, member: me, target: foe, skill: skill, accuracy: Math.round(acc) });
      return;
    }

    var res = engine.calcDamage(me, foe, skill, this.rng);
    var dealt = this._applyDamage(foe, res.damage, events, { side: side, source: 'skill' });
    me.damageDealt += dealt;
    foe.damageTaken += dealt;
    if (foe.hp <= 0 && !foe.fainted) me.kills += 1;

    this._ev(events, {
      type: 'damage', side: side, member: me, target: foe, skill: skill,
      damage: dealt, hp: foe.hp, maxHp: foe.maxHp,
      crit: res.crit, elemMult: res.elemMult, typeMult: res.typeMult,
      effectiveness: res.effectiveness
    });

    // 技能附带效果
    var eff = E.normalize(skill.effect);
    if (eff) this._applyEffect(side, me, foe, eff, dealt, events, skill);
  };

  /* 返回实际扣掉的血量（护盾吸收的不算） */
  Battle.prototype._applyDamage = function (target, amount, events, meta) {
    amount = Math.max(0, Math.round(amount));
    var absorbed = 0;
    if (target.shield > 0) {
      absorbed = Math.min(target.shield, amount);
      target.shield -= absorbed;
      amount -= absorbed;
      if (absorbed > 0) {
        this._ev(events, { type: 'shield-absorb', side: (meta && meta.side) || null, target: target, absorbed: absorbed, shield: target.shield });
      }
    }
    var before = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    return before - target.hp;
  };

  /* ------------------------------------------------------------ 效果结算 */
  Battle.prototype._applyEffect = function (side, me, foe, eff, dealt, events, skill) {
    var hit = this.rng() < eff.chance;

    if (!hit) {
      // 带上 skill 名字，解说才能说出是哪个技能的效果没触发
      this._ev(events, { type: 'effect-miss', side: side, member: me, target: foe, effect: eff, skill: skill });
      return;
    }

    switch (eff.kind) {
      case 'debuff':
        foe.mods.push({ stat: eff.stat, value: -eff.value, turns: eff.turns });
        this._ev(events, { type: 'effect', side: side, member: me, target: foe, effect: eff, applied: true });
        break;

      case 'buff':
        me.mods.push({ stat: eff.stat, value: eff.value, turns: eff.turns });
        this._ev(events, { type: 'effect', side: side, member: me, target: me, effect: eff, applied: true });
        break;

      case 'heal': {
        var amount = eff.percent ? Math.round(me.maxHp * eff.value) : Math.round(eff.value);
        var before = me.hp;
        me.hp = Math.min(me.maxHp, me.hp + amount);
        this._ev(events, { type: 'heal', side: side, member: me, amount: me.hp - before, hp: me.hp, maxHp: me.maxHp, effect: eff });
        break;
      }

      case 'dot':
        foe.dot.push({ value: Math.round(eff.value), turns: eff.turns });
        this._ev(events, { type: 'effect', side: side, member: me, target: foe, effect: eff, applied: true });
        break;

      case 'stun':
        foe.stunTurns += eff.turns;
        this._ev(events, { type: 'effect', side: side, member: me, target: foe, effect: eff, applied: true });
        break;

      case 'drain': {
        var gain = Math.round(dealt * eff.value);
        if (gain > 0) {
          var b2 = me.hp;
          me.hp = Math.min(me.maxHp, me.hp + gain);
          this._ev(events, { type: 'heal', side: side, member: me, amount: me.hp - b2, hp: me.hp, maxHp: me.maxHp, effect: eff, drain: true });
        }
        break;
      }

      case 'shield':
        me.shield += Math.round(eff.value);
        me.shieldTurns = Math.max(me.shieldTurns, eff.turns);
        this._ev(events, { type: 'shield', side: side, member: me, amount: Math.round(eff.value), shield: me.shield, effect: eff });
        break;
    }
  };

  /* ------------------------------------------------------ 行动之后收尾 */
  Battle.prototype._afterAction = function (events) {
    var st = this.st;
    if (st.phase === 'ended') return;

    st.actionIdx += 1;
    if (st.actionIdx >= st.order.length) {
      this._endTurn(events);
      if (st.phase === 'ended') return;
      st.phase = 'turnStart';
      return;
    }
    st.phase = 'choose';
  };

  Battle.prototype._endTurn = function (events) {
    var st = this.st;
    var self = this;

    ['A', 'B'].forEach(function (side) {
      var m = self.active(side);
      if (!m || m.fainted) return;
      // 增减益 / 护盾倒计时
      m.mods = m.mods.map(function (x) { return { stat: x.stat, value: x.value, turns: x.turns - 1 }; })
                     .filter(function (x) { return x.turns > 0; });
      if (m.shieldTurns > 0) {
        m.shieldTurns -= 1;
        if (m.shieldTurns <= 0) m.shield = 0;
      }
    });

    this._ev(events, {
      type: 'turn-end', turn: st.turn,
      snapshot: this.snapshot()
    });

    // 回合数超上限 → 按剩余血量比例判定
    if (st.turn >= C.MAX_TURNS) {
      var ra = this._hpRatio('A'), rb = this._hpRatio('B');
      st.winner = ra === rb ? null : (ra > rb ? 'A' : 'B');
      st.reason = '回合数达到上限，按剩余血量判定';
      st.phase = 'ended';
      this._ev(events, { type: 'end', winner: st.winner, reason: st.reason, turn: st.turn });
    }
  };

  Battle.prototype._hpRatio = function (side) {
    var total = 0, cur = 0;
    this.teams[side].members.forEach(function (m) { total += m.maxHp; cur += m.hp; });
    return total ? cur / total : 0;
  };

  /* ---------------------------------------------------------------- AI */
  Battle.prototype._aiChoose = function (side) {
    var me = this.active(side);
    var foe = this.active(this.other(side));
    if (!me) return { kind: 'skill', index: 0 };

    var options = this._actionOptions(side);
    var scored = [];
    var self = this;

    options.forEach(function (opt) {
      if (opt.kind === 'switch') {
        var s = self._scoreSwitchIn(opt.member, foe);
        scored.push({ opt: opt, score: s });
        return;
      }
      scored.push({ opt: opt, score: self._scoreSkill(me, foe, opt.skill, side) });
    });

    scored.sort(function (a, b) { return b.score - a.score; });
    return scored[0].opt;
  };

  /* 估算对面每回合大概能打掉我多少血，用来判断「该回血还是该打人」 */
  Battle.prototype._incomingPerTurn = function (me, foe) {
    if (!foe) return 1;
    var worst = 0;
    for (var i = 0; i < foe.skills.length; i++) {
      var sk = foe.skills[i];
      var d = engine.expectedDamage(foe, me, sk) * (engine.effAccuracy(foe, me, sk) / 100);
      if (d > worst) worst = d;
    }
    return Math.max(1, worst);
  };

  Battle.prototype._scoreSkill = function (me, foe, skill, side) {
    if (!foe) return 0;
    var eff = E.normalize(skill.effect);
    var acc = engine.effAccuracy(me, foe, skill) / 100;
    var exp = engine.expectedDamage(me, foe, skill);
    var score = exp * acc;

    if (eff) {
      var land = acc * eff.chance;
      switch (eff.kind) {
        case 'heal': {
          var missing = me.maxHp - me.hp;
          var gain = eff.percent ? me.maxHp * eff.value : eff.value;
          var useful = Math.min(missing, gain);
          /* 回血只是延命，不推进胜利。只有快被打死的时候才值得优先回血；
           * 否则低伤害的蛐蛐会一直站桩回血，慢慢被磨死还打不动对面。 */
          var turnsToDie = me.hp / this._incomingPerTurn(me, foe);
          var urgency = turnsToDie < 3 ? 1 : (turnsToDie < 5 ? 0.55 : 0.15);
          score += useful * 0.9 * eff.chance * urgency;
          break;
        }
        case 'buff':    score += eff.value * 34 * land; break;
        case 'debuff':  score += eff.value * 28 * land; break;
        case 'dot':     score += eff.value * Math.min(eff.turns, 3) * 0.8 * land; break;
        case 'stun':    score += eff.turns * 32 * land; break;
        case 'drain':   score += eff.value * exp * 0.6 * land; break;
        case 'shield':  score += Math.min(eff.value, 30) * 0.7 * land; break;
      }
    }

    // 能一击带走就优先
    if (exp * acc >= foe.hp) score += 70;

    // 对手残血时，命中稳的技能更值钱
    if (foe.hp <= foe.maxHp * 0.25) score += acc * 18;

    score += this.rng() * 5;
    return score;
  };

  Battle.prototype._scoreSwitchIn = function (member, foe) {
    if (!member || member.fainted || !foe) return -1;
    var best = 0;
    for (var i = 0; i < member.skills.length; i++) {
      var m = engine.elementMult(member.skills[i].element, foe.defenseType);
      var t = engine.typeMult(member.type, foe.type);
      var v = m * t * (member.skills[i].power / 40);
      if (v > best) best = v;
    }
    var hpFactor = 0.5 + 0.5 * (member.hp / member.maxHp);
    // 换人有风险（消耗一次行动），所以打个折
    return best * 22 * hpFactor - 18;
  };

  Battle.prototype._aiPickSwitch = function (side) {
    var foe = this.active(this.other(side));
    var opts = this._switchOptions(side);
    if (!opts.length) return 0;
    var self = this;
    var best = opts[0], bestScore = -Infinity;
    opts.forEach(function (o) {
      var s = self._scoreSwitchIn(o.member, foe) + self.rng() * 4;
      if (s > bestScore) { bestScore = s; best = o; }
    });
    return best.index;
  };

  /* ------------------------------------------------------------ 状态快照 */
  Battle.prototype.snapshot = function () {
    var self = this;
    function snapMember(m) {
      return {
        name: m.name, hp: m.hp, maxHp: m.maxHp, fainted: m.fainted,
        // 立绘是同一个字符串的引用，不会因为每个事件都带一份而复制数据
        portrait: m.portrait || null,
        type: m.type, defenseType: m.defenseType, rarity: m.rarity,
        shield: m.shield, stunTurns: m.stunTurns,
        mods: m.mods.map(function (x) { return { stat: x.stat, value: x.value, turns: x.turns }; }),
        dot: m.dot.map(function (x) { return { value: x.value, turns: x.turns }; })
      };
    }
    function snapTeam(side) {
      var t = self.teams[side];
      return {
        name: t.name, activeIndex: t.activeIndex,
        members: t.members.map(function (m, i) {
          var s = snapMember(m);
          s.index = i;
          s.active = (i === t.activeIndex);
          return s;
        })
      };
    }
    return { turn: this.st.turn, A: snapTeam('A'), B: snapTeam('B') };
  };

  Battle.prototype.getState = function () {
    return {
      turn: this.st.turn,
      phase: this.st.phase,
      winner: this.st.winner,
      reason: this.st.reason,
      over: this.st.phase === 'ended',
      currentSide: this.currentSide(),
      snapshot: this.snapshot()
    };
  };

  /* ---------------------------------------------------------------- 入口 */
  engine.create = function (opts) { return new Battle(opts); };

  /* 给模拟器 / 测试用的无 UI 自动对战 */
  engine.runAuto = function (teamA, teamB, opts) {
    opts = opts || {};
    var b = new Battle({
      teams: { A: { name: opts.nameA || 'A', members: teamA }, B: { name: opts.nameB || 'B', members: teamB } },
      controllers: { A: 'ai', B: 'ai' },
      mode: 'auto',
      rng: opts.rng
    });
    b.start();
    var guard = 0;
    var events = [];
    while (!b.over() && guard++ < 500) {
      events = events.concat(b.advance());
      var p = b.pending();
      if (p) {
        if (p.type === 'forcedSwitch') b.submit({ index: b._aiPickSwitch(p.side) });
        else b.submit(b._aiChoose(p.side));
      }
    }
    return {
      winner: b.st.winner, reason: b.st.reason, turns: b.st.turn,
      battle: b, events: events
    };
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
