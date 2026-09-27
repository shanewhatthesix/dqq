/* =========================================================================
 * 附中·电子斗蛐蛐  战报生成 + 名人堂
 *
 * 战报图用 canvas 现场画，不依赖任何外部图片和字体文件，
 * 所以离线、GitHub Pages、别人电脑上打开，效果都一模一样。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var UI = DQQ.ui;
  var C = DQQ.commentary;
  var S = DQQ.storage;

  var SH = (DQQ.share = {});
  var views = (DQQ.views = DQQ.views || {});

  var W = 900;
  var H = 1180;

  var FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Source Han Sans SC",system-ui,sans-serif';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* 把长文本按宽度切行 */
  function wrap(ctx, text, maxWidth) {
    var out = [];
    var line = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { out.push(line); line = ''; continue; }
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        out.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) out.push(line);
    return out;
  }

  /* 从战斗记录里挑几个精彩瞬间。
   * 按「打得最疼」排序来挑，而不是抓到第一个暴击就写上去——
   * 否则像「暴击，0 点伤害」这种废话也会被印在战报图上。 */
  function highlights(battle) {
    var hits = [];
    var faints = [];
    battle.st.log.forEach(function (ev) {
      if (ev.type === 'damage' && ev.damage >= 8) hits.push(ev);
      else if (ev.type === 'faint') faints.push(ev);
    });

    hits.sort(function (a, b) { return b.damage - a.damage; });

    var picks = [];
    hits.slice(0, 3).forEach(function (ev) {
      var tag = [];
      if (ev.crit) tag.push('暴击');
      if (ev.effectiveness === 'super') tag.push('效果绝佳');
      picks.push(ev.member.name + ' 的「' + ev.skill.name + '」重创 ' + ev.target.name
        + '，' + ev.damage + ' 点伤害' + (tag.length ? '（' + tag.join('·') + '）' : ''));
    });
    faints.forEach(function (ev) {
      if (picks.length < 5) picks.push(ev.member.name + ' 倒下了');
    });
    return picks;
  }

  /* ------------------------------------------------------------ 画战报图 */
  /* 配色跟界面保持一致（纸/墨/朱批/青花/藤黄/竹青），不再是早期那套深紫底。
   * 立绘要先全部加载完再画 —— 否则画到那一格时图片还没 onload。 */
  var C = {
    paper:   '#F3EEE2',
    paper2:  '#EAE3D2',
    ink:     '#1E3A5F',
    inkDeep: '#16283F',
    inkSoft: '#45607F',
    inkFaint:'#8A93A0',
    line:    'rgba(30,58,95,.22)',
    redpen:  '#C43D2E',
    porcelain:'#2E6489',
    gamboge: '#D9A020',
    bamboo:  '#4B7A55'
  };

  /* 把每个出场角色的"脸"都准备好：有立绘用立绘，
   * 没有的（预设角色、老存档）就把防御类型的字形现渲染成一张图。
   * 这样战报里的圆形头像不会是个空圈。 */
  function loadFaces(members, done) {
    var jobs = members.map(function (m) {
      if (m.portrait) return Promise.resolve({ uid: m.uid, url: m.portrait });
      return UI.glyphToDataUrl(m.defenseType, 128).then(function (url) {
        return { uid: m.uid, url: url };
      });
    });

    Promise.all(jobs).then(function (items) {
      var map = {};
      var valid = items.filter(function (it) { return !!it.url; });
      if (!valid.length) { done(map); return; }

      var left = valid.length, finished = false;
      function tick() {
        if (--left <= 0 && !finished) { finished = true; done(map); }
      }
      valid.forEach(function (it) {
        var img = new Image();
        img.onload = function () { map[it.uid] = img; tick(); };
        img.onerror = tick;
        img.src = it.url;
      });
      // 保险：万一某张图既不 load 也不 error，别把回调挂死
      setTimeout(function () { if (!finished) { finished = true; done(map); } }, 3000);
    }).catch(function () { done({}); });
  }

  SH.render = function (battle, cb) {
    try {
      var all = battle.teams.A.members.concat(battle.teams.B.members);
      loadFaces(all, function (imgs) {
        try {
          /* 先在足够高的临时画布上画，再按实际用掉的高度裁切。
           * 固定 1180 的话，1v1 下面会空掉一大半，分享出去很难看。 */
          var tmp = document.createElement('canvas');
          tmp.width = W;
          tmp.height = H;
          var used = paint(tmp, battle, imgs);

          var out = document.createElement('canvas');
          out.width = W;
          out.height = Math.max(520, Math.round(used));
          out.getContext('2d').drawImage(tmp, 0, 0);
          cb(null, out);
        } catch (e) { cb(e); }
      });
    } catch (err) {
      cb(err);
    }
  };

  function paint(canvas, battle, imgs) {
    var ctx = canvas.getContext('2d');

    /* 纸底 + 方格纹 */
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(30,58,95,.055)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 22) {
      ctx.beginPath(); ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, H); ctx.stroke();
    }
    for (var gy = 0; gy < H; gy += 22) {
      ctx.beginPath(); ctx.moveTo(0, gy + .5); ctx.lineTo(W, gy + .5); ctx.stroke();
    }

    var y = 0;

    /* 标题 */
    ctx.textAlign = 'center';
    ctx.fillStyle = C.inkDeep;
    ctx.font = '700 40px ' + FONT;
    ctx.fillText('附中·电子斗蛐蛐', W / 2, 76);
    ctx.font = '500 18px ' + FONT;
    ctx.fillStyle = C.inkFaint;
    ctx.fillText('战　　报', W / 2, 108);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(50, 126); ctx.lineTo(W - 50, 126); ctx.stroke();
    y = 178;

    var nameA = battle.teams.A.name;
    var nameB = battle.teams.B.name;
    var winner = battle.st.winner;

    /* 双方名字 */
    ctx.font = '700 30px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillStyle = winner === 'A' ? C.bamboo : C.inkDeep;
    ctx.fillText(truncate(ctx, nameA, 330), 50, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = winner === 'B' ? C.bamboo : C.inkDeep;
    ctx.fillText(truncate(ctx, nameB, 330), W - 50, y);
    ctx.textAlign = 'center';
    ctx.font = '700 24px ' + FONT;
    ctx.fillStyle = C.inkFaint;
    ctx.fillText('VS', W / 2, y);

    /* 结果条：像一枚盖上去的章 */
    y += 22;
    var resText = winner === null ? '平　局' : (winner === 'A' ? nameA : nameB) + '　获　胜';
    roundRect(ctx, 50, y, W - 100, 74, 6);
    ctx.fillStyle = winner === null ? C.paper2 : 'rgba(75,122,85,.13)';
    ctx.fill();
    ctx.strokeStyle = winner === null ? C.inkFaint : C.bamboo;
    ctx.lineWidth = 3;
    ctx.stroke();
    roundRect(ctx, 56, y + 6, W - 112, 62, 4);
    ctx.strokeStyle = winner === null ? 'rgba(138,147,160,.5)' : 'rgba(75,122,85,.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = winner === null ? C.inkSoft : C.bamboo;
    ctx.font = '700 34px ' + FONT;
    ctx.fillText(truncate(ctx, resText, W - 170), W / 2, y + 50);

    y += 100;
    ctx.font = '500 17px ' + FONT;
    ctx.fillStyle = C.inkFaint;
    ctx.fillText(battle.st.reason + ' · 共 ' + battle.st.turn + ' 回合', W / 2, y);

    y += 42;

    /* 双方阵容 */
    var colW = (W - 120) / 2;
    var maxRows = Math.max(battle.teams.A.members.length, battle.teams.B.members.length);
    var rowH = 86;
    var startY = y;

    ctx.textAlign = 'left';
    ctx.font = '700 17px ' + FONT;
    ctx.fillStyle = C.inkFaint;
    ctx.fillText('阵容', 50, y - 12);

    ['A', 'B'].forEach(function (side, si) {
      var team = battle.teams[side];
      var x = si === 0 ? 50 : 50 + colW + 20;
      team.members.forEach(function (m, i) {
        var ry = startY + 14 + i * rowH;
        var cardH = rowH - 14;
        var face = 48;
        var textX = x + 14 + face + 12;

        // 纸卡
        roundRect(ctx, x, ry, colW, cardH, 6);
        ctx.fillStyle = m.fainted ? 'rgba(255,255,255,.35)' : '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 立绘：圆形裁切，没图就画个空心圆当占位
        var cx = x + 14 + face / 2, cy = ry + cardH / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, face / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        var img = imgs[m.uid];
        if (img) {
          ctx.globalAlpha = m.fainted ? 0.4 : 1;
          ctx.drawImage(img, cx - face / 2, cy - face / 2, face, face);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = C.paper2;
          ctx.fill();
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, face / 2, 0, Math.PI * 2);
        ctx.strokeStyle = m.fainted ? C.inkFaint : C.porcelain;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 名字
        ctx.textAlign = 'left';
        ctx.font = '700 20px ' + FONT;
        ctx.fillStyle = m.fainted ? C.inkFaint : C.inkDeep;
        ctx.fillText(truncate(ctx, m.name, colW - (textX - x) - 100), textX, ry + 26);

        // HP 文字
        ctx.textAlign = 'right';
        ctx.font = '700 15px ' + FONT;
        ctx.fillStyle = m.fainted ? C.redpen : C.inkSoft;
        ctx.fillText(m.fainted ? '阵亡' : m.hp + '/' + m.maxHp, x + colW - 12, ry + 26);

        // 血条
        var barX = textX, barY = ry + 36, barW = colW - (textX - x) - 12, barH = 9;
        roundRect(ctx, barX, barY, barW, barH, 4);
        ctx.fillStyle = C.paper2;
        ctx.fill();
        var ratio = U.clamp(m.hp / m.maxHp, 0, 1);
        if (ratio > 0) {
          roundRect(ctx, barX, barY, Math.max(4, barW * ratio), barH, 4);
          ctx.fillStyle = ratio > 0.5 ? C.bamboo : (ratio > 0.22 ? C.gamboge : C.redpen);
          ctx.fill();
        }

        // 小字
        ctx.textAlign = 'left';
        ctx.font = '500 13px ' + FONT;
        ctx.fillStyle = C.inkFaint;
        ctx.fillText(m.rarity + ' · ' + m.type + '/' + m.defenseType
          + (m.damageDealt > 0 ? ' · 输出 ' + Math.round(m.damageDealt) : ''), textX, ry + cardH - 8);
      });
    });

    y = startY + 14 + maxRows * rowH + 16;

    /* 精彩瞬间 */
    var picks = highlights(battle);
    if (picks.length) {
      ctx.textAlign = 'left';
      ctx.font = '700 17px ' + FONT;
      ctx.fillStyle = C.inkFaint;
      ctx.fillText('精彩瞬间', 50, y);
      y += 28;

      ctx.font = '500 17px ' + FONT;
      picks.forEach(function (p) {
        wrap(ctx, '· ' + p, W - 120).forEach(function (ln) {
          ctx.fillStyle = C.inkSoft;
          ctx.fillText(ln, 50, y);
          y += 26;
        });
      });
      y += 10;
    }

    /* 页脚：跟在内容后面，不留一大片空白 */
    y += 16;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 50, y); ctx.stroke();
    y += 26;
    ctx.textAlign = 'center';
    ctx.font = '500 15px ' + FONT;
    ctx.fillStyle = C.inkFaint;
    ctx.fillText('江西师大附中 · 电子科创社团 · 电子斗蛐蛐', W / 2, y);

    return y + 30;   // 交给调用方裁画布
  }

  function truncate(ctx, text, maxWidth) {
    text = String(text == null ? '' : text);
    if (ctx.measureText(text).width <= maxWidth) return text;
    var out = text;
    while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + '…';
  }

  /* ==================================================================== */
  /*  名人堂 / 战报历史                                                     */
  /* ==================================================================== */
  views.history = function (host) {
    var list = S.getHistory();

    host.appendChild(U.el('div', { class: 'row-between' }, [
      U.el('div', {}, [
        U.el('h2', { text: '名人堂' }),
        U.el('div', { class: 'muted', text: '最近 ' + S.MAX_HISTORY + ' 场的战报。挑最精彩的投到班牌上。' })
      ]),
      list.length ? U.el('button', {
        class: 'btn btn-danger', text: '清空记录',
        onclick: function () {
          U.confirm('清空所有战报记录？', function () { S.clearHistory(); DQQ.app.render(); }, { danger: true, yesText: '清空' });
        }
      }) : null
    ]));

    if (!list.length) {
      host.appendChild(U.el('div', { class: 'empty mt-16' }, [
        U.el('span', { class: 'big' }, [UI.icon('trophy')]),
        U.el('div', { text: '还没有战报' }),
        U.el('button', { class: 'btn btn-primary mt-16', text: '去斗一场', onclick: function () { location.hash = '#/battle'; } })
      ]));
      return;
    }

    var grid = U.el('div', { class: 'cricket-grid mt-16' });
    list.forEach(function (h) {
      var when = '';
      try { when = new Date(h.at).toLocaleString('zh-CN', { hour12: false }); } catch (e) { when = h.at; }

      var card = U.el('div', { class: 'cricket-card' });
      card.appendChild(U.el('div', { class: 'cc-head' }, [
        U.el('div', { class: 'grow' }, [
          U.el('div', { class: 'cc-name', style: { fontSize: '14.5px' }, text: h.nameA + '  vs  ' + h.nameB }),
          U.el('div', { class: 'cc-meta', text: when })
        ])
      ]));
      card.appendChild(U.el('div', {
        class: h.winner ? 'super' : 'dim',
        style: { fontWeight: '800' },
        html: (h.winner ? UI.iconHtml('trophy') + ' ' + U.escapeHtml(h.winner) + ' 获胜' : '平局')
      }));
      card.appendChild(U.el('div', { class: 'cc-meta', text: h.reason + ' · ' + h.turns + ' 回合' }));
      card.appendChild(U.el('div', { class: 'cc-actions' }, [
        U.el('button', {
          class: 'btn btn-sm', text: '看战报',
          onclick: function () {
            U.modal({
              title: '战报', wide: true,
              render: function (m) {
                var pre = U.el('pre', {
                  style: { whiteSpace: 'pre-wrap', fontSize: '12.5px', lineHeight: '1.7', margin: '0', fontFamily: 'inherit' },
                  text: h.report || '（没有存正文）'
                });
                m.body.appendChild(pre);
                m.footer.appendChild(U.el('button', {
                  class: 'btn btn-primary',
                  onclick: function () { U.copyText(h.report, '战报已复制'); }
                }, [UI.icon('clipboard'), U.el('span', { text: '复制' })]));
                m.footer.appendChild(U.el('button', { class: 'btn btn-ghost', text: '关闭', onclick: m.close }));
              }
            });
          }
        }),
        U.el('button', {
          class: 'btn btn-sm btn-ghost', text: '复制',
          onclick: function () { U.copyText(h.report, '战报已复制'); }
        })
      ]));
      grid.appendChild(card);
    });
    host.appendChild(grid);
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
