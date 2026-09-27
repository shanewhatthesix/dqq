/* =========================================================================
 * 附中·电子斗蛐蛐  技能效果层
 *
 * 效果支持两种写法，引擎一视同仁：
 *   1. 结构化（推荐，创建器 / AI 生成都用这个）
 *      { kind:'debuff', stat:'defense', value:0.2, turns:2, chance:0.8 }
 *   2. 中文短句（设计文档里的写法，手写数据更省事）
 *      "对方防御-10%"  /  "回复20点HP"  /  "30%概率使对方速度-20%持续2回合"
 *
 * 引擎只认两个作用方向：buff = 加在自己身上，debuff = 加在对方身上。
 *
 * 想加新效果类型：在 KINDS 里加一项 + 在 parseText 里加一条正则 + 在 text() 里加一句文案。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;

  var E = (DQQ.effect = {});

  E.STATS = ['attack', 'defense', 'speed'];
  E.STAT_LABEL = { attack: '攻击', defense: '防御', speed: '速度' };
  E.KINDS = ['debuff', 'buff', 'heal', 'dot', 'stun', 'drain', 'shield'];

  /* 数值区间取中点（不打乱），保证同一个效果每次渲染文案一致 */
  function mid(spec) {
    if (spec == null) return 0;
    if (Array.isArray(spec)) return (Number(spec[0]) + Number(spec[1])) / 2;
    return Number(spec);
  }

  function roll(spec) {
    if (spec == null) return 0;
    if (Array.isArray(spec)) return U.randFloat(Number(spec[0]), Number(spec[1]));
    return Number(spec);
  }

  /* ------------------------------------------------- 把各种写法归一成对象
   * opts.rollRanges = true 时把 [a,b] 区间掷成具体数字（生成角色时用）。
   * 默认取中点，保证 E.text() 这类展示调用是幂等的。
   */
  E.normalize = function (effect, opts) {
    if (!effect) return null;
    if (typeof effect === 'string') return E.parseText(effect);
    if (typeof effect !== 'object') return null;

    var picker = (opts && opts.rollRanges) ? roll : mid;

    var kind = effect.kind;
    if (!kind) {
      if (effect.stat) kind = 'debuff';   // 只写了 stat，按削弱对方理解
      else return null;
    }
    if (E.KINDS.indexOf(kind) < 0) return null;

    var value = picker(effect.value);
    var turns = Math.round(picker(effect.turns));
    var chance = effect.chance == null ? 1 : Number(mid(effect.chance));

    // 容错：chance / value 写成百分数
    if (chance > 1) chance = chance / 100;
    // drain / heal 百分比型效果，value 写成 30 也认
    if ((kind === 'drain' || (kind === 'heal' && effect.percent)) && value > 1) value = value / 100;

    var out = {
      kind: kind,
      stat: effect.stat || null,
      value: value,
      turns: U.clamp(turns || 1, 1, 5),
      chance: U.clamp(chance, 0, 1),
      percent: !!effect.percent,
      raw: effect.raw || null
    };
    if (kind === 'debuff' || kind === 'buff') {
      if (E.STATS.indexOf(out.stat) < 0) out.stat = 'attack';
      out.value = U.clamp(Math.abs(out.value), 0.05, 0.6);
    }
    if (kind === 'drain') out.value = U.clamp(Math.abs(out.value), 0.1, 0.6);
    return out;
  };

  var STAT_RE = '(攻击力|攻击|防御力|防御|速度)';
  var STAT_MAP = { '攻击': 'attack', '攻击力': 'attack', '防御': 'defense', '防御力': 'defense', '速度': 'speed' };

  /* --------------------------------------------------- 中文短句 → 结构化对象 */
  E.parseText = function (text) {
    if (!text || typeof text !== 'string') return null;
    var s = text.trim();
    if (!s) return null;

    var chance = 1, turns = null, m;

    // "30%概率" / "有50%的概率"
    m = s.match(/(\d+(?:\.\d+)?)\s*%\s*(?:的)?\s*概率/);
    if (m) { chance = parseFloat(m[1]) / 100; s = s.replace(m[0], ''); }

    // "持续2回合"
    m = s.match(/持续\s*(\d+)\s*回合/);
    if (m) { turns = parseInt(m[1], 10); s = s.replace(m[0], ''); }

    // "回复20点HP"
    m = s.match(/回复\s*(\d+(?:\.\d+)?)\s*点\s*(?:HP|hp|血量|生命)/);
    if (m) return E.finish({ kind: 'heal', value: parseFloat(m[1]), turns: 1, chance: 1 });

    // "回复20%最大生命"
    m = s.match(/回复\s*(\d+(?:\.\d+)?)\s*%\s*(?:的)?\s*(?:最大)?\s*(?:HP|hp|血量|生命)/);
    if (m) return E.finish({ kind: 'heal', value: parseFloat(m[1]) / 100, percent: true, turns: 1, chance: 1 });

    // "每回合损失8点HP"
    m = s.match(/每回合\s*(?:损失|受到|扣除|掉)\s*(\d+(?:\.\d+)?)\s*点/);
    if (m) return E.finish({ kind: 'dot', value: parseFloat(m[1]), turns: turns || 3, chance: chance });

    // 控制类
    if (/眩晕|无法行动|定身|僵直|麻痹/.test(s)) {
      return E.finish({ kind: 'stun', value: 1, turns: turns || 1, chance: chance });
    }

    // "吸取30%伤害"
    m = s.match(/吸取\s*(\d+(?:\.\d+)?)\s*%/);
    if (m) return E.finish({ kind: 'drain', value: parseFloat(m[1]) / 100, turns: 1, chance: 1 });

    // "获得25点护盾"
    m = s.match(/(\d+(?:\.\d+)?)\s*点\s*护盾/);
    if (m) return E.finish({ kind: 'shield', value: parseFloat(m[1]), turns: turns || 3, chance: 1 });

    // 属性增减： "对方防御-10%" / "自身攻击+20%"
    var re = new RegExp('(对方|敌方|对手|自身|自己)?\\s*' + STAT_RE + '\\s*([+\\-＋－])\\s*(\\d+(?:\\.\\d+)?)\\s*%');
    m = s.match(re);
    if (m) {
      var target = m[1] || '';
      var stat = STAT_MAP[m[2]];
      var positive = (m[3] === '+' || m[3] === '＋');
      var magnitude = parseFloat(m[4]) / 100;
      var isSelf = /自身|自己/.test(target);

      // 引擎只有“强化自身(buff)”和“削弱对方(debuff)”两个方向，
      // 表达不了的方向（削弱自己 / 强化对手）直接判为无效。
      var kind;
      if (isSelf) kind = positive ? 'buff' : null;
      else kind = positive ? null : 'debuff';

      if (!kind) return null;
      return E.finish({ kind: kind, stat: stat, value: magnitude, turns: turns || 2, chance: chance });
    }

    return null;
  };

  E.finish = function (o) {
    var c = o.chance == null ? 1 : Number(o.chance);
    if (c > 1) c = c / 100;
    return {
      kind: o.kind,
      stat: o.stat || null,
      value: o.value,
      turns: U.clamp(o.turns || 1, 1, 5),
      chance: U.clamp(c, 0, 1),
      percent: !!o.percent,
      raw: o.raw || null
    };
  };

  /* --------------------------------------------------- 结构化对象 → 中文文案 */
  E.text = function (effect) {
    var e = E.normalize(effect);
    if (!e) return '';
    var s;
    switch (e.kind) {
      case 'debuff': s = '对方' + E.STAT_LABEL[e.stat] + '-' + Math.round(e.value * 100) + '%'; break;
      case 'buff':   s = '自身' + E.STAT_LABEL[e.stat] + '+' + Math.round(e.value * 100) + '%'; break;
      case 'heal':   s = e.percent ? '回复' + Math.round(e.value * 100) + '%生命' : '回复' + Math.round(e.value) + '点HP'; break;
      case 'dot':    s = '对方每回合损失' + Math.round(e.value) + '点HP'; break;
      case 'stun':   s = '使对方无法行动'; break;
      case 'drain':  s = '吸取' + Math.round(e.value * 100) + '%伤害回复自身'; break;
      case 'shield': s = '获得' + Math.round(e.value) + '点护盾'; break;
      default: return '';
    }
    if (e.chance < 1) s = Math.round(e.chance * 100) + '%概率 ' + s;
    if (e.turns > 1) s += '（' + e.turns + '回合）';
    return s;
  };

  /* 站在「被影响的那个人」的角度描述效果，战斗解说用这个。
   * 例如 E.text({kind:'debuff',stat:'defense',value:0.2}) 是「对方防御-20%」，
   * 而 E.shortText 会给「防御 -20%」，直接接在受害者名字后面读起来才通顺。 */
  E.shortText = function (effect) {
    var e = E.normalize(effect);
    if (!e) return '';
    var s;
    switch (e.kind) {
      case 'debuff': s = E.STAT_LABEL[e.stat] + ' -' + Math.round(e.value * 100) + '%'; break;
      case 'buff':   s = E.STAT_LABEL[e.stat] + ' +' + Math.round(e.value * 100) + '%'; break;
      case 'heal':   s = e.percent ? '回复 ' + Math.round(e.value * 100) + '% 生命' : '回复 ' + Math.round(e.value) + ' 点HP'; break;
      case 'dot':    s = '每回合损失 ' + Math.round(e.value) + ' 点HP'; break;
      case 'stun':   s = '无法行动'; break;
      case 'drain':  s = '吸取 ' + Math.round(e.value * 100) + '% 伤害'; break;
      case 'shield': s = '获得 ' + Math.round(e.value) + ' 点护盾'; break;
      default: return '';
    }
    if (e.chance < 1) s = Math.round(e.chance * 100) + '% 概率' + s;
    if (e.turns > 1) s += '（' + e.turns + ' 回合）';
    return s;
  };

  /* 概率判定 */
  E.roll = function (effect, rng) {
    var e = E.normalize(effect);
    if (!e) return false;
    return (rng ? rng() : Math.random()) < e.chance;
  };

  /* 是否属于被禁的离谱效果 */
  E.isBanned = function (effect) {
    var raw = typeof effect === 'string' ? effect : (effect && effect.raw) || E.text(effect);
    if (!raw) return false;
    for (var i = 0; i < DQQ.BANNED_EFFECT_WORDS.length; i++) {
      if (raw.indexOf(DQQ.BANNED_EFFECT_WORDS[i]) >= 0) return true;
    }
    return false;
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
