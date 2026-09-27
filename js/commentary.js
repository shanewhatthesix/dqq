/* =========================================================================
 * 附中·电子斗蛐蛐  AI 解说
 *
 * 把引擎吐出来的事件翻译成人话。每种事件准备了几句随机模板，避免复读。
 * 想换解说风格（比如更毒舌、更正式），改这里的模板就行。
 *
 * 配置了在线大模型的话，可以在战斗结束后用 llm 再润色一份长战报，
 * 但战斗中即时解说走这里 —— 不联网、不卡顿、零成本。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var E = DQQ.effect;

  var C = (DQQ.commentary = {});

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* 事件 → 解说。返回 { text, kind }，kind 用来上不同的颜色 */
  C.turn = function (ev, ctx) {
    var teamOf = function (side) { return (ctx && ctx.names && ctx.names[side]) || (side === 'A' ? '我方' : '对方'); };
    var M = ev.member ? ev.member.name : '';
    var T = ev.target ? ev.target.name : '';

    switch (ev.type) {

      case 'turn-start':
        if (ev.turn === 1) return { text: '比赛开始！双方蛐蛐已就位——', kind: 'info' };
        return null;

      case 'order': {
        var first = ev.order[0];
        var faster = first === 'A' ? 'A' : 'B';
        var m = ctx && ctx.actives ? ctx.actives[first] : null;
        if (ev.speeds.A === ev.speeds.B) {
          return { text: '双方速度不相上下，掷硬币决定谁先动手——' + (m ? m.name : '') + ' 抢到了先手！', kind: 'info' };
        }
        return { text: (m ? m.name : '') + ' 速度更快（' + ev.speeds[first] + '），先出手！', kind: 'info' };
      }

      case 'use-skill':
        return { text: M + ' 发动了「' + ev.skill.name + '」！', kind: 'skill', skill: ev.skill, member: ev.member };

      case 'stun-skip':
        return { text: M + ' 还没缓过来，动弹不得……', kind: 'weak' };

      case 'miss':
        return {
          text: pick([
            '但是落空了！' + T + ' 一个侧身躲了过去。',
            '打偏了！' + T + ' 从容避开。',
            M + ' 这一下没打中，' + T + ' 毫发无伤。'
          ]), kind: 'miss'
        };

      case 'damage': {
        var dmg = ev.damage;
        var parts = [];
        var kind = 'damage';

        if (ev.crit) { parts.push(pick(['暴击！这一击太致命了！', '会心一击！全场都安静了！'])); kind = 'crit'; }

        if (ev.effectiveness === 'super') {
          parts.push(pick([
            '效果绝佳！' + T + ' 受到了重创！',
            '正中要害！' + T + ' 被打得连退三步！',
            '这一下太克制了，' + T + ' 表情都变了！'
          ]));
          kind = 'super';
        } else if (ev.effectiveness === 'weak') {
          parts.push(pick([
            '效果不佳……「' + ev.skill.name + '」对 ' + T + ' 收效甚微。',
            T + ' 根本不吃这一套，只掉了点血皮。',
            '被克住了，「' + ev.skill.name + '」打不出威力。'
          ]));
          kind = 'weak';
        }

        parts.push(T + ' 受到 ' + dmg + ' 点伤害，还剩 ' + Math.max(0, ev.hp) + ' 点HP。');
        return { text: parts.join(' '), kind: kind, damage: dmg };
      }

      case 'heal':
        return {
          text: ev.drain
            ? M + ' 吸取了生命力，回复 ' + ev.amount + ' 点HP（当前 ' + ev.hp + '）。'
            : M + ' 回复了 ' + ev.amount + ' 点HP（当前 ' + ev.hp + '）。',
          kind: 'heal'
        };

      case 'regen':
        return { text: M + ' 靠食堂的底子慢慢回血，回复 ' + ev.amount + ' 点。', kind: 'heal' };

      case 'shield':
        return { text: M + ' 撑起 ' + ev.amount + ' 点护盾（共 ' + ev.shield + ' 点）。', kind: 'buff' };

      case 'shield-absorb':
        return { text: '护盾挡下了 ' + ev.absorbed + ' 点伤害，还剩 ' + ev.shield + ' 点。', kind: 'buff' };

      case 'dot':
        return { text: M + ' 被持续伤害磨掉 ' + ev.damage + ' 点HP（还剩 ' + Math.max(0, ev.hp) + '）。', kind: 'damage' };

      case 'effect': {
        // 效果要站在「被影响的那只」的角度说，不然「对方防御-20%」扣在对手身上会读反
        var isSelf = (ev.target === ev.member);
        var who = isSelf ? M : T;
        var ne = E.normalize(ev.effect) || {};
        var detail = E.shortText(ev.effect);
        var verb;
        switch (ne.kind) {
          case 'stun':   verb = ' 被控住了！'; break;
          case 'dot':    verb = ' 中了持续伤害：'; break;
          case 'debuff': verb = ' 的属性被削弱：'; break;
          case 'buff':   verb = ' 状态提升：'; break;
          case 'shield': verb = ' 撑起了护盾：'; break;
          default:       verb = ' 受到了影响：'; break;
        }
        return { text: who + verb + detail + '！', kind: isSelf ? 'buff' : 'debuff' };
      }

      case 'effect-miss':
        return { text: '可惜「' + ((ev.skill && ev.skill.name) || '这一击') + '」的附加效果没有触发。', kind: 'miss' };

      case 'faint':
        return {
          text: pick([
            M + ' 倒下了！',
            M + ' 撑不住了，退出了战场！',
            '不行了！' + M + ' 被打趴下了！'
          ]), kind: 'faint'
        };

      case 'switch-in':
        return {
          text: ev.forced
            ? M + ' 顶了上来，' + teamOf(ev.side) + '还没打算认输！'
            : teamOf(ev.side) + ' 换上 ' + M + '！',
          kind: 'info'
        };

      case 'turn-end': {
        var s = ev.snapshot;
        // aliveSummary 里已经带了场上那只的名字，这里就不要再加队名了，
        // 否则 1v1（队名 = 蛐蛐名）会变成「后排睡觉的 后排睡觉的 46/78」。
        var line = '第 ' + ev.turn + ' 回合结束 —— '
          + aliveSummary(s.A) + ' ｜ ' + aliveSummary(s.B);
        return { text: line, kind: 'info' };
      }

      case 'end': {
        if (ev.winner === null) return { text: '双方同归于尽，本场平局！(' + ev.reason + ')', kind: 'info' };
        var w = teamOf(ev.winner);
        var l = teamOf(ev.winner === 'A' ? 'B' : 'A');
        return {
          text: pick([
            w + ' 获胜！' + l + ' 全员阵亡。',
            w + ' 笑到了最后，' + l + ' 这边已经没人能站起来了。',
            '比赛结束——' + w + ' 拿下了这一局！'
          ]) + '（共 ' + ev.turn + ' 回合）',
          kind: 'end'
        };
      }

      default:
        return null;
    }
  };

  /* 场上还剩谁，用于回合结束播报 */
  function aliveSummary(team) {
    var alive = team.members.filter(function (m) { return !m.fainted; });
    if (!alive.length) return '全员阵亡';
    var active = team.members[team.activeIndex];
    var text = (active && !active.fainted) ? active.name + ' ' + active.hp + '/' + active.maxHp : '—';
    // 1v1 就一只，不用再报「还剩几只」
    if (team.members.length > 1) text += '（剩 ' + alive.length + ' 只）';
    return text;
  }

  /* -------------------------------------------------------- 开场白 */
  C.intro = function (teamA, teamB) {
    return pick([
      '欢迎来到附中电子斗蛐蛐竞技场！',
      '各位同学请注意，比赛即将开始！',
      '全场安静——斗蛐蛐，现在开始！'
    ]) + ' 左边是「' + teamA + '」，右边是「' + teamB + '」。';
  };

  /* ---------------------------------------------------- 战报文字稿 */
  /* 把整场事件流压成一份可以复制分享的文字战报 */
  C.report = function (battle, opts) {
    opts = opts || {};
    var st = battle.st;
    var names = {
      A: battle.teams.A.name,
      B: battle.teams.B.name
    };
    var lines = [];

    lines.push('【附中·电子斗蛐蛐】战报');
    lines.push(names.A + '  VS  ' + names.B);
    lines.push('结果：' + (st.winner === null ? '平局' : names[st.winner] + ' 获胜') + '（' + st.reason + '，共 ' + st.turn + ' 回合）');
    lines.push('');

    lines.push('─ 出场阵容 ─');
    ['A', 'B'].forEach(function (side) {
      var t = battle.teams[side];
      lines.push(names[side] + '：');
      t.members.forEach(function (m) {
        var status = m.fainted ? '阵亡' : (m.hp + '/' + m.maxHp);
        lines.push('  · ' + m.name + '（' + m.rarity + ' ' + m.type + '/' + m.defenseType + '）'
          + ' ' + status + '  造成伤害 ' + Math.round(m.damageDealt)
          + (m.kills ? '，击倒 ' + m.kills + ' 只' : ''));
      });
    });
    lines.push('');

    lines.push('─ 激战实录 ─');
    var ctx = { names: names };
    st.log.forEach(function (ev) {
      var c = C.turn(ev, ctx);
      if (c && c.text) lines.push('  ' + c.text);
    });

    lines.push('');
    lines.push('— 由「附中·电子斗蛐蛐」生成 —');
    return lines.join('\n');
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
