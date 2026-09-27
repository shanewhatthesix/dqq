/* =========================================================================
 * 附中·电子斗蛐蛐  共用渲染组件
 *
 * 蛐蛐卡片、血条、状态图标、技能按钮——多个页面都用得到，集中放这里。
 *
 * 注意：所有属性 / 防御类型 / 角色类型都走 SVG 字形（UI.glyph），
 * 不再用 emoji —— 这样它们会跟着纸墨配色走，整页才统一。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var E = DQQ.effect;

  var UI = (DQQ.ui = DQQ.ui || {});

  /* ------------------------------------------------------------ 字形助手 */
  /* 立绘尺寸：卡片和竞技场都够用，又不至于把 localStorage 撑爆。
   * 512 的话一张就 80KB 上下，十几只蛐蛐加技能 CG 很容易顶到 5MB 上限。 */
  UI.PORTRAIT_MAX = 320;

  UI.hasPortrait = function (c) {
    return !!(c && c.portrait);
  };

  /* 蛐蛐的"脸"：有立绘就用立绘，没有就退回防御类型的字形。
   * 预设角色和历史存档没有立绘，靠这个兜底。 */
  UI.sprite = function (cricket, cls) {
    var extra = cls || '';
    if (UI.hasPortrait(cricket)) {
      return U.el('img', {
        class: 'portrait-img ' + extra,
        src: cricket.portrait,
        alt: (cricket.name || '') + ' 的立绘',
        loading: 'lazy'
      });
    }
    return UI.glyph((cricket && cricket.defenseType) || '学渣', 'sprite-glyph ' + extra);
  };

  UI.typeIcon = function (type) {
    return UI.glyph(type, 'type-glyph');
  };

  UI.elIcon = function (element) {
    return UI.glyph(element, 'el-glyph');
  };

  /* 把字形画成一张真正的 PNG 立绘。
   * 给「用默认立绘」按钮和预设角色补图用 —— 这样"必须有立绘"就不会变成死路，
   * 手机上不想传图的人一键就有一张能用的。
   * SVG 由 icons.js 的 UI.glyphSvg 提供（字形数据在那个闭包里）。
   * 走 SVG → canvas，如果浏览器把 canvas 污染了（toDataURL 抛异常）就返回 null，
   * 调用方需要自己能兜住。 */
  UI.glyphToDataUrl = function (glyphName, size) {
    return new Promise(function (resolve) {
      var s = size || UI.PORTRAIT_MAX;
      if (typeof UI.glyphSvg !== 'function') {
        console.warn('[dqq] UI.glyphSvg 不可用，无法生成默认立绘');
        resolve(null);
        return;
      }
      var svg = UI.glyphSvg(glyphName, s);
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = c.height = s;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, s, s);
          resolve(c.toDataURL('image/png'));
        } catch (e) {
          console.warn('[dqq] 字形转图片失败', e);
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  };

  UI.rarityClass = function (rarity) {
    return 'rarity-' + (DQQ.RARITIES.indexOf(rarity) >= 0 ? rarity : '普通');
  };

  /* 属性的墨色：粉笔=灰、作业=青花、考试=朱批、拖堂=赭、零食=竹青、规则=墨 */
  UI.elColor = function (element) {
    var map = {
      '粉笔': '#6E7683',
      '作业': '#2E6489',
      '考试': '#C43D2E',
      '拖堂': '#8A5A2B',
      '零食': '#4B7A55',
      '规则': '#16283F'
    };
    return map[element] || 'var(--line)';
  };

  UI.totalStats = function (stats) {
    return (stats.hp | 0) + (stats.attack | 0) + (stats.defense | 0) + (stats.speed | 0);
  };

  /* ------------------------------------------------------------ 稀有度印章 */
  UI.rarityTag = function (rarity) {
    return U.el('span', { class: 'rarity-tag ' + UI.rarityClass(rarity), text: rarity });
  };

  /* -------------------------------------------------------------- 血条 */
  UI.hpBar = function (hp, maxHp, shield) {
    var ratio = maxHp > 0 ? U.clamp(hp / maxHp, 0, 1) : 0;
    var cls = ratio > 0.5 ? '' : (ratio > 0.22 ? 'mid' : 'low');
    var bar = U.el('div', { class: 'hpbar' }, [
      U.el('div', { class: 'hpbar-fill ' + cls, style: { width: (ratio * 100) + '%' } }),
      U.el('div', { class: 'hpbar-text', text: Math.max(0, Math.round(hp)) + ' / ' + maxHp })
    ]);
    var wrap = U.el('div', {}, [bar]);
    if (shield > 0) {
      wrap.appendChild(U.el('div', { class: 'shieldbar' }, [
        U.el('div', { class: 'shieldbar-fill', style: { width: U.clamp(shield / maxHp * 100, 4, 100) + '%' } })
      ]));
    }
    return wrap;
  };

  /* ------------------------------------------------------- 状态图标列表 */
  UI.statusList = function (member) {
    var host = U.el('div', { class: 'statuses' });
    if (!member) return host;
    var labels = { attack: '攻', defense: '防', speed: '速' };

    (member.mods || []).forEach(function (m) {
      var up = m.value > 0;
      host.appendChild(U.el('span', {
        class: 'status ' + (up ? 'buff' : 'debuff'),
        text: labels[m.stat] + (up ? '↑' : '↓') + Math.round(Math.abs(m.value) * 100) + '%·' + m.turns
      }));
    });
    (member.dot || []).forEach(function (d) {
      host.appendChild(U.el('span', { class: 'status dot', text: '损' + d.value + '·' + d.turns }));
    });
    if (member.shield > 0) {
      host.appendChild(U.el('span', { class: 'status buff', text: '盾' + member.shield }));
    }
    if (member.stunTurns > 0) {
      host.appendChild(U.el('span', { class: 'status stun', text: '控' + member.stunTurns }));
    }
    return host;
  };

  /* ---------------------------------------------------------- 技能按钮 */
  UI.skillButton = function (skill, onclick) {
    var eff = E.normalize(skill.effect);
    var btn = U.el('button', {
      class: 'skill-btn' + (skill.cg ? ' has-cg' : ''),
      style: { '--el': UI.elColor(skill.element) },
      onclick: onclick
    }, [
      U.el('div', { class: 'sb-top' }, [
        U.el('span', { class: 'sb-name', text: skill.name }),
        U.el('span', { class: 'sb-el' }, [UI.elIcon(skill.element), U.el('span', { text: skill.element })])
      ]),
      U.el('div', { class: 'sb-stats', text: '威力 ' + skill.power + ' · 命中 ' + skill.accuracy + '%' }),
      eff ? U.el('div', { class: 'sb-eff', text: E.text(eff) }) : null,
      skill.cg ? U.el('div', { class: 'sb-cg' }, [UI.icon('image'), U.el('span', { text: 'CG' })]) : null
    ]);
    return btn;
  };

  /* ------------------------------------------------------------ 蛐蛐卡片 */
  UI.cricketCard = function (c, opts) {
    opts = opts || {};
    var card = U.el('div', {
      class: 'cricket-card ' + UI.rarityClass(c.rarity) + (opts.selected ? ' selected' : ''),
      onclick: opts.onClick || null
    });

    card.appendChild(U.el('div', { class: 'cc-head' }, [
      U.el('div', { class: 'cc-face' }, [UI.sprite(c)]),
      U.el('div', { class: 'grow' }, [
        U.el('div', { class: 'cc-name', text: c.name }),
        U.el('div', { class: 'cc-meta' }, [
          UI.typeIcon(c.type),
          U.el('span', { text: ' ' + c.type + ' / ' }),
          UI.glyph(c.defenseType),
          U.el('span', { text: ' ' + c.defenseType + (c.personality ? ' · ' + c.personality : '') })
        ])
      ]),
      UI.rarityTag(c.rarity)
    ]));

    if (c.description) {
      card.appendChild(U.el('div', { class: 'cc-desc', text: c.description }));
    }

    var s = c.stats || {};
    var caps = DQQ.RARITY_META[c.rarity] ? DQQ.RARITY_META[c.rarity].caps : null;
    var statsBox = U.el('div', { class: 'cc-stats' });
    [['hp', 'HP'], ['attack', '攻击'], ['defense', '防御'], ['speed', '速度']].forEach(function (pair) {
      var k = pair[0];
      var over = caps && Number(s[k]) > caps[k];
      statsBox.appendChild(U.el('div', { class: 'cc-stat' }, [
        U.el('span', { class: 'k', text: pair[1] }),
        U.el('span', { class: 'v' + (over ? ' weak' : ''), text: String(s[k] == null ? '-' : s[k]) })
      ]));
    });
    card.appendChild(statsBox);

    card.appendChild(U.el('div', { class: 'cc-meta' },
      [U.el('span', { text: '总属性 ' + UI.totalStats(s) + ' · 技能总威力 ' + DQQ.balance.totalPower(c.skills) })]));

    if (c.skills && c.skills.length) {
      var row = U.el('div', { class: 'cc-skills' });
      c.skills.slice(0, 4).forEach(function (sk) {
        row.appendChild(U.el('span', {
          class: 'skill-mini',
          style: { '--el': UI.elColor(sk.element), color: UI.elColor(sk.element) },
          text: sk.name + ' ' + sk.power
        }));
      });
      card.appendChild(row);
    }

    if (opts.actions && opts.actions.length) {
      var act = U.el('div', { class: 'cc-actions' });
      opts.actions.forEach(function (a) {
        act.appendChild(U.el('button', {
          class: 'btn btn-sm ' + (a.cls || 'btn-ghost'),
          onclick: function (e) { e.stopPropagation(); a.onClick(); }
        }, [
          a.icon ? UI.icon(a.icon) : null,
          U.el('span', { text: a.label })
        ]));
      });
      card.appendChild(act);
    }

    return card;
  };

  /* -------------------------------------------------- 属性随稀有度变化的条 */
  UI.statEditor = function (key, label, value, cap, onChange) {
    var valLabel = U.el('span', { class: 'se-val', text: value + ' / ' + cap });
    var input = U.el('input', {
      type: 'range', min: 1, max: cap, value: value,
      oninput: function () {
        valLabel.textContent = input.value + ' / ' + cap;
        onChange(Number(input.value));
      }
    });
    var box = U.el('div', { class: 'stat-edit' }, [
      U.el('div', { class: 'se-head' }, [
        U.el('span', { class: 'se-name', text: label }),
        valLabel
      ]),
      input
    ]);
    box._input = input;
    return box;
  };

  /* ------------------------------------------------------ 属性克制小表格 */
  UI.counterTable = function (defenseType) {
    var t = U.el('table', { class: 'table' });
    t.appendChild(U.el('thead', {}, [U.el('tr', {}, [
      U.el('th', { text: '攻击属性' }), U.el('th', { text: '倍率' }), U.el('th', { text: '效果' })
    ])]));
    var tbody = U.el('tbody');
    DQQ.ELEMENTS.forEach(function (el) {
      var m = DQQ.engine.elementMult(el, defenseType);
      var cls = m >= 2 ? 'super' : (m <= 0.5 ? 'weak' : '');
      tbody.appendChild(U.el('tr', {}, [
        U.el('td', {}, [U.el('span', { class: 'glyph-label', style: { color: UI.elColor(el) } },
          [UI.elIcon(el), U.el('span', { text: el })])]),
        U.el('td', { class: 'num ' + cls, text: m + '×' }),
        U.el('td', { class: cls, text: m >= 2 ? '效果绝佳' : (m <= 0.5 ? '效果不佳' : '正常') })
      ]));
    });
    t.appendChild(tbody);
    return U.el('div', { class: 'table-scroll' }, [t]);
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
