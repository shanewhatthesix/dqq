/* =========================================================================
 * 附中·电子斗蛐蛐  超模检测
 * 规则来自设计文档 7.3。errors 是硬性拦截，warnings 只是给玩家的建议。
 * 想放宽/收紧平衡，改 DQQ.RARITY_META 里各自的上限即可。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var E = DQQ.effect;
  var U = DQQ.util;

  var B = (DQQ.balance = {});

  B.MIN_SKILLS = 2;
  B.MAX_SKILLS = 4;
  B.MIN_ACCURACY = 50;
  B.MAX_ACCURACY = 100;
  B.MIN_POWER = 5;

  B.caps = function (rarity) {
    var meta = DQQ.RARITY_META[rarity] || DQQ.RARITY_META['普通'];
    return meta.caps;
  };

  B.powerCap = function (rarity) {
    var meta = DQQ.RARITY_META[rarity] || DQQ.RARITY_META['普通'];
    return meta.powerCap;
  };

  B.totalPowerCap = function (rarity) {
    var meta = DQQ.RARITY_META[rarity] || DQQ.RARITY_META['普通'];
    return meta.totalPowerCap;
  };

  B.totalStats = function (stats) {
    return (stats.hp | 0) + (stats.attack | 0) + (stats.defense | 0) + (stats.speed | 0);
  };

  B.totalPower = function (skills) {
    var sum = 0;
    (skills || []).forEach(function (s) { sum += (Number(s.power) || 0); });
    return sum;
  };

  /* ------------------------------------------------------------ 主检测函数 */
  B.check = function (c) {
    var errors = [];
    var warnings = [];
    if (!c) return { ok: false, errors: ['角色数据为空'], warnings: warnings };

    /* --- 基本信息 --- */
    if (!c.name || !String(c.name).trim()) errors.push('还没起名字');
    else if (String(c.name).trim().length > 12) errors.push('名字太长了（最多 12 字）');

    if (!c.type || DQQ.CHARACTER_TYPES.indexOf(c.type) < 0) errors.push('角色类型无效');
    if (!c.defenseType || DQQ.DEFENSE_TYPES.indexOf(c.defenseType) < 0) errors.push('防御类型无效');
    if (!c.rarity || DQQ.RARITIES.indexOf(c.rarity) < 0) errors.push('稀有度无效');

    var rarity = DQQ.RARITY_META[c.rarity] ? c.rarity : '普通';
    var caps = B.caps(rarity);

    /* --- 属性 --- */
    var stats = c.stats || {};
    var keys = ['hp', 'attack', 'defense', 'speed'];
    var labels = { hp: 'HP', attack: '攻击', defense: '防御', speed: '速度' };
    var sum = 0;
    keys.forEach(function (k) {
      var v = Number(stats[k]);
      if (!isFinite(v)) { errors.push(labels[k] + ' 不是有效数字'); return; }
      if (v <= 0) errors.push(labels[k] + ' 必须大于 0');
      else if (v > caps[k]) errors.push(labels[k] + ' ' + v + ' 超过' + rarity + '上限 ' + caps[k]);
      sum += v;
    });
    if (sum > caps.total) {
      errors.push('总属性 ' + sum + ' 超过' + rarity + '上限 ' + caps.total);
    }

    /* --- 技能 --- */
    var skills = c.skills || [];
    if (skills.length < B.MIN_SKILLS) errors.push('至少要 ' + B.MIN_SKILLS + ' 个技能（现在 ' + skills.length + ' 个）');
    if (skills.length > B.MAX_SKILLS) errors.push('最多 ' + B.MAX_SKILLS + ' 个技能（现在 ' + skills.length + ' 个）');

    var powerCap = B.powerCap(rarity);
    var totalPower = 0;
    var seenNames = {};

    skills.forEach(function (s, i) {
      var idx = i + 1;
      var sname = (s.name || '').trim() || ('第' + idx + '个技能');
      if (!s.name || !String(s.name).trim()) errors.push('第' + idx + '个技能还没起名字');
      else if (seenNames[sname]) errors.push('技能名重复了：「' + sname + '」');
      seenNames[sname] = true;

      if (!s.element || DQQ.ELEMENTS.indexOf(s.element) < 0) errors.push('「' + sname + '」的攻击属性无效');

      var power = Number(s.power);
      if (!isFinite(power)) errors.push('「' + sname + '」威力不是有效数字');
      else if (power < B.MIN_POWER) errors.push('「' + sname + '」威力太低（最低 ' + B.MIN_POWER + '）');
      else if (power > powerCap) errors.push('「' + sname + '」威力 ' + power + ' 超过' + rarity + '单技能上限 ' + powerCap);
      else totalPower += power;

      var acc = Number(s.accuracy);
      if (!isFinite(acc)) errors.push('「' + sname + '」命中不是有效数字');
      else if (acc < B.MIN_ACCURACY || acc > B.MAX_ACCURACY) {
        errors.push('「' + sname + '」命中 ' + acc + '% 必须在 ' + B.MIN_ACCURACY + '%-' + B.MAX_ACCURACY + '% 之间');
      }

      if (E.isBanned(s.effect)) errors.push('「' + sname + '」的效果违规（不允许一击必杀/无敌类效果）');

      // 效果写了但解析不出来 → 提醒，不拦截
      if (s.effect && typeof s.effect === 'string' && !E.normalize(s.effect)) {
        warnings.push('「' + sname + '」的效果「' + s.effect + '」系统看不懂，已按无效果处理');
      }
      var ne = E.normalize(s.effect);
      if (ne && ne.kind === 'stun' && ne.chance >= 0.35) {
        warnings.push('「' + sname + '」的控制概率 ' + Math.round(ne.chance * 100) + '% 偏高，容易被针对');
      }
      if (ne && (ne.kind === 'debuff' || ne.kind === 'buff') && ne.value >= 0.35) {
        warnings.push('「' + sname + '」的' + E.STAT_LABEL[ne.stat] + '增减幅度 ' + Math.round(ne.value * 100) + '% 偏大');
      }

      // 又准又痛
      if (isFinite(power) && isFinite(acc) && acc >= 92 && power >= powerCap * 0.9) {
        warnings.push('「' + sname + '」又准又痛（威力 ' + power + ' / 命中 ' + acc + '%），建议二选一削一点');
      }
    });

    var totalPowerCap = B.totalPowerCap(rarity);
    if (totalPower > totalPowerCap) {
      errors.push('技能总威力 ' + totalPower + ' 超过' + rarity + '上限 ' + totalPowerCap);
    }

    /* --- 软性建议 --- */
    if (sum < caps.total * 0.75) {
      warnings.push('总属性只有 ' + sum + '，' + rarity + '还能用到 ' + caps.total + '，有点浪费');
    }
    if (Number(stats.speed) >= caps.speed && Number(stats.attack) >= caps.attack * 0.9) {
      warnings.push('速度拉满 + 攻击接近上限，属于先手爆发流，对战会比较极端');
    }
    if (skills.length && !skills.some(function (s) { return !!s.effect; })) {
      warnings.push('全队都是纯伤害技能，加个效果（回血/减益）会更好玩');
    }

    /* 属性覆盖检查：如果对某个防御类型完全没有能打的招，遇到就会被克死。
     * 典型翻车案例是把主力全押在粉笔上 —— 粉笔打学霸和教师都只有 0.5 倍。 */
    if (skills.length && DQQ.engine) {
      var perType = DQQ.DEFENSE_TYPES.map(function (dt) {
        return skills.reduce(function (m, s) {
          return Math.max(m, (Number(s.power) || 0) * DQQ.engine.elementMult(s.element, dt));
        }, 0);
      });
      var worst = Math.min.apply(null, perType);
      // 只有「最优选择都不到威力上限的一半」才算真的没招，
      // 否则被 0.5 倍克一下就报警，满屏都是警告。
      if (worst < powerCap * 0.5) {
        warnings.push('对「' + DQQ.DEFENSE_TYPES[perType.indexOf(worst)] + '」型对手没有能打的招' +
          '（最优选择等效威力只有 ' + Math.round(worst) + '，上限是 ' + powerCap + '），碰上会被克得很惨');
      }
    }
    // 每回合只能用一招，所以决定输出的是「最强的那一招」打得动不动，
    // 威力平均分摊到 3-4 个技能上，等于每一下都软绵绵。
    if (skills.length >= 2) {
      var powers = skills.map(function (s) { return Number(s.power) || 0; });
      var strongest = Math.max.apply(null, powers);
      var cap = DQQ.RARITY_META[rarity].powerCap;
      if (strongest < cap * 0.6) {
        warnings.push('主力技能威力只有 ' + strongest + '，' + rarity + '最多能到 ' + cap +
          '。每回合只能出一招，建议把威力集中到一个主力技能上');
      }
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings, totalStats: sum, totalPower: totalPower };
  };

  /* 把数值压回上限内（生成器 / 编辑器的自动修正用），返回新 stats */
  B.clampStats = function (stats, rarity) {
    var caps = B.caps(rarity);
    var out = {}, keys = ['hp', 'attack', 'defense', 'speed'], sum = 0;
    keys.forEach(function (k) {
      var v = Math.max(1, Math.round(Number(stats[k]) || 1));
      out[k] = Math.min(v, caps[k]);
      sum += out[k];
    });
    // 总量超了就按比例削，优先削最高的那项
    var guard = 0;
    while (sum > caps.total && guard++ < 500) {
      var tallest = keys[0];
      keys.forEach(function (k) { if (out[k] > out[tallest]) tallest = k; });
      var floor = Math.max(1, Math.round(caps[tallest] * DQQ.STAT_FLOOR_RATIO * 0.6));
      if (out[tallest] <= floor) break;
      out[tallest] -= 1;
      sum -= 1;
    }
    return out;
  };

  /* 稀有度排序，用于公平模式选基准 */
  B.rarityRank = function (rarity) {
    var i = DQQ.RARITIES.indexOf(rarity);
    return i < 0 ? 0 : i;
  };

  /* 把一只蛐蛐整体缩放到目标稀有度的数值水平。
   * 1v1「公平模式」和跨稀有度匹配用它，避免普通被传说无脑碾压。 */
  B.rescale = function (cricket, targetRarity) {
    var out = U.deepClone(cricket);
    var from = DQQ.RARITY_META[out.rarity] || DQQ.RARITY_META['普通'];
    var to = DQQ.RARITY_META[targetRarity] || DQQ.RARITY_META['普通'];

    var scaled = {};
    ['hp', 'attack', 'defense', 'speed'].forEach(function (k) {
      scaled[k] = Math.max(1, Math.round((Number(out.stats[k]) || 1) * to.caps[k] / from.caps[k]));
    });
    out.stats = B.clampStats(scaled, targetRarity);

    var skills = (out.skills || []).map(function (s) {
      var c = U.deepClone(s);
      c.power = Math.max(B.MIN_POWER, Math.round((Number(c.power) || B.MIN_POWER) * to.powerCap / from.powerCap));
      return c;
    });
    out.skills = B.clampSkills(skills, targetRarity);
    out.rarity = targetRarity;
    return out;
  };

  /* 把双方队伍拉到同一稀有度（取高的那边），返回新数组 */
  B.fairTeams = function (teamA, teamB) {
    var all = (teamA || []).concat(teamB || []);
    if (!all.length) return { A: teamA || [], B: teamB || [], rarity: '普通' };
    var target = all.reduce(function (best, c) {
      return B.rarityRank(c.rarity) > B.rarityRank(best) ? c.rarity : best;
    }, '普通');
    return {
      A: (teamA || []).map(function (c) { return B.rescale(c, target); }),
      B: (teamB || []).map(function (c) { return B.rescale(c, target); }),
      rarity: target
    };
  };

  /* 把技能威力压回上限内，返回新数组 */
  B.clampSkills = function (skills, rarity) {
    var powerCap = B.powerCap(rarity);
    var totalCap = B.totalPowerCap(rarity);
    var list = (skills || []).map(function (s) {
      var c = U.deepClone(s);
      c.power = U.clamp(Math.round(Number(c.power) || B.MIN_POWER), B.MIN_POWER, powerCap);
      c.accuracy = U.clamp(Math.round(Number(c.accuracy) || 90), B.MIN_ACCURACY, B.MAX_ACCURACY);
      return c;
    });
    var guard = 0;
    while (B.totalPower(list) > totalCap && guard++ < 500) {
      var tallest = 0;
      for (var i = 1; i < list.length; i++) if (list[i].power > list[tallest].power) tallest = i;
      if (list[tallest].power <= B.MIN_POWER) break;
      list[tallest].power -= 1;
    }
    return list;
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
