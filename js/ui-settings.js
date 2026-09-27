/* =========================================================================
 * 附中·电子斗蛐蛐  设置
 * AI 接口、战斗播放、数据管理、规则速查。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var UI = DQQ.ui;
  var S = DQQ.storage;

  var views = (DQQ.views = DQQ.views || {});

  views.settings = function (host) {
    var s = S.getSettings();

    host.appendChild(U.el('div', {}, [
      U.el('h2', { text: '设置' }),
      U.el('div', { class: 'muted', text: '所有设置和角色数据都只存在你这台电脑的浏览器里，不会上传到任何地方。' })
    ]));

    /* ============================================================ 在线 AI */
    var aiCard = U.el('div', { class: 'card mt-16' });
    aiCard.appendChild(U.el('h3', { class: 'mb-8 row', style: { gap: '.4em' } }, [UI.icon('wand'), U.el('span', { text: '在线 AI（可选）' })]));
    aiCard.appendChild(U.el('p', { class: 'muted', style: { fontSize: '13px' },
      text: '不开也完全能玩——内置的离线生成器会读你写的描述来配属性和技能。'
          + '开了在线 AI，生成会更贴描述，但需要你自己的 API Key，并且要花你自己的额度。' }));

    var enableToggle = U.el('input', {
      type: 'checkbox', checked: s.aiEnabled,
      onchange: function () { s.aiEnabled = enableToggle.checked; save(); }
    });
    aiCard.appendChild(U.el('label', { class: 'row mb-16', style: { cursor: 'pointer' } }, [
      enableToggle, U.el('span', { text: '启用在线 AI 生成', style: { fontWeight: '700' } })
    ]));

    // 服务商预设
    var providerRow = U.el('div', { class: 'chips mb-16' });
    DQQ.llm.PROVIDERS.forEach(function (p) {
      providerRow.appendChild(U.el('button', {
        class: 'chip' + (s.apiBase === p.base && p.base ? ' active' : ''),
        text: p.label,
        onclick: function () {
          if (p.base) { s.apiBase = p.base; s.model = p.model; save(); DQQ.app.render(); }
          else { U.toast('填下面两个输入框就行', 'info'); }
        }
      }));
    });
    aiCard.appendChild(U.el('div', { class: 'field' }, [
      U.el('label', { text: '服务商（点一下自动填地址和模型）' }), providerRow
    ]));

    aiCard.appendChild(U.el('div', { class: 'field' }, [
      U.el('label', { text: '接口地址（OpenAI 兼容，不用带 /chat/completions）' }),
      U.el('input', {
        class: 'input', value: s.apiBase, placeholder: 'https://open.bigmodel.cn/api/paas/v4',
        oninput: function () { s.apiBase = this.value.trim(); save(); }
      })
    ]));

    aiCard.appendChild(U.el('div', { class: 'field' }, [
      U.el('label', { text: '模型名' }),
      U.el('input', {
        class: 'input', value: s.model, placeholder: 'glm-4-flash',
        oninput: function () { s.model = this.value.trim(); save(); }
      })
    ]));

    aiCard.appendChild(U.el('div', { class: 'field' }, [
      U.el('label', { text: 'API Key' }),
      U.el('input', {
        class: 'input', type: 'password', value: s.apiKey, placeholder: '只存在你自己的浏览器里',
        oninput: function () { s.apiKey = this.value.trim(); save(); }
      }),
      U.el('div', { class: 'hint row', style: { gap: '.35em', alignItems: 'flex-start' } },
        [UI.icon('alert'), U.el('span', { text: '这是纯前端网页，Key 会存在浏览器 localStorage 里。公用电脑上别填，用完记得清掉。' })])
    ]));

    /* ---------------------------------------- 高级：输出预算 / JSON 模式 / 温度 */
    var advToggle = U.el('button', { class: 'btn btn-sm btn-ghost' },
      [UI.icon('settings'), U.el('span', { text: '高级选项' })]);
    var advBox = U.el('div', { class: 'mt-8 hidden' });

    advBox.appendChild(U.el('div', { class: 'field' }, [
      U.el('label', { text: '最大输出长度（max_tokens）' }),
      U.el('input', {
        class: 'input', type: 'number', min: 512, max: 32000, step: 512, value: s.maxTokens,
        oninput: function () { s.maxTokens = Number(this.value) || 4096; save(); }
      }),
      U.el('div', { class: 'hint row', style: { gap: '.35em', alignItems: 'flex-start' } }, [
        UI.icon('alert'),
        U.el('span', { text: '如果你的模型是推理型（deepseek-reasoner、v4-pro 这类），' +
          '它的思考过程也会占用这个额度。给小了会出现「接口没有返回内容」——其实是思考没写完就被截断了。' })
      ])
    ]));

    var jsonCb = U.el('input', {
      type: 'checkbox', checked: s.jsonMode !== false,
      onchange: function () { s.jsonMode = jsonCb.checked; save(); }
    });
    advBox.appendChild(U.el('label', { class: 'row mb-16', style: { cursor: 'pointer' } }, [
      jsonCb,
      U.el('div', {}, [
        U.el('div', { text: '使用 JSON 模式（推荐）', style: { fontWeight: '700' } }),
        U.el('div', { class: 'muted', style: { fontSize: '12.5px' },
          text: '让接口层保证返回合法 JSON，比在提示词里要求它可靠得多。少数接口不认这个参数，关掉即可。' })
      ])
    ]));

    var tempLabel = U.el('span', { class: 'se-val', text: String(s.temperature != null ? s.temperature : 0.8) });
    advBox.appendChild(U.el('div', { class: 'field' }, [
      U.el('div', { class: 'se-head' }, [U.el('span', { class: 'se-name', text: '温度（越低越守规矩）' }), tempLabel]),
      U.el('input', {
        type: 'range', min: 0, max: 15, step: 1, value: Math.round((s.temperature != null ? s.temperature : 0.8) * 10),
        oninput: function () { s.temperature = Number(this.value) / 10; tempLabel.textContent = s.temperature.toFixed(1); save(); }
      })
    ]));

    var toLabel = U.el('span', { class: 'se-val', text: Math.round((s.aiTimeout || 90000) / 1000) + ' 秒' });
    advBox.appendChild(U.el('div', { class: 'field' }, [
      U.el('div', { class: 'se-head' }, [U.el('span', { class: 'se-name', text: '请求超时' }), toLabel]),
      U.el('input', {
        type: 'range', min: 15, max: 180, step: 5, value: Math.round((s.aiTimeout || 90000) / 1000),
        oninput: function () { s.aiTimeout = Number(this.value) * 1000; toLabel.textContent = this.value + ' 秒'; save(); }
      })
    ]));

    advToggle.onclick = function () { advBox.classList.toggle('hidden'); };
    aiCard.appendChild(advToggle);
    aiCard.appendChild(advBox);

    /* ------------------------------------------------------ 诊断按钮 */
    var testResult = U.el('div', { class: 'mt-8', style: { fontSize: '13px' } });

    function showResult(kind, text) {
      testResult.innerHTML = '';
      testResult.className = 'mt-8 row ' + (kind === 'err' ? 'weak' : kind === 'warn' ? 'dim' : 'super');
      testResult.style.gap = '.35em';
      testResult.style.alignItems = 'flex-start';
      testResult.appendChild(UI.icon(kind === 'err' ? 'close' : kind === 'warn' ? 'info' : 'check'));
      testResult.appendChild(U.el('span', { text: text }));
    }

    aiCard.appendChild(U.el('div', { class: 'row' }, [
      U.el('button', {
        class: 'btn',
        onclick: function () {
          showResult('warn', '正在测连通性…');
          DQQ.llm.test(s, function (err, msg) {
            showResult(err ? 'err' : 'ok', err ? err.message : msg);
          });
        }
      }, [UI.icon('zap'), U.el('span', { text: '测试连接' })]),
      U.el('button', {
        class: 'btn btn-primary',
        onclick: function () {
          showResult('warn', '正在试生成一只蛐蛐…（推理模型可能要等十几秒）');
          DQQ.llm.selfTest(s, function (err, info) {
            if (err) {
              showResult('err', err.message);
              return;
            }
            showResult('ok', '成功！用了 ' + (info.ms / 1000).toFixed(1) + ' 秒。' +
              '性格「' + info.personality + '」 技能：' + info.skills.join('、') +
              (info.notes && info.notes.length ? '（自动修正：' + info.notes.join('；') + '）' : ''));
          });
        }
      }, [UI.icon('wand'), U.el('span', { text: '试生成一只' })]),
      U.el('button', {
        class: 'btn btn-ghost', text: '清空 Key',
        onclick: function () { s.apiKey = ''; save(); DQQ.app.render(); U.toast('已清空', 'ok'); }
      })
    ]));
    aiCard.appendChild(testResult);

    aiCard.appendChild(U.el('div', { class: 'hint mt-16',
      text: '两个按钮分工不同：「测试连接」只确认接口通不通；'
          + '「试生成一只」会完整跑一遍生成流程，能测出「接口通但拿不到 JSON」这类问题 —— '
          + '这种情况多半是模型把额度花在思考上了，把上面的最大输出长度调大即可。' }));
    host.appendChild(aiCard);

    /* ============================================================ 战斗 */
    var battleCard = U.el('div', { class: 'card mt-16' });
    battleCard.appendChild(U.el('h3', { class: 'mb-8 row', style: { gap: '.4em' } }, [UI.icon('swords'), U.el('span', { text: '战斗' })]));

    var delayLabel = U.el('span', { class: 'se-val', text: s.autoPlayDelay + 'ms' });
    battleCard.appendChild(U.el('div', { class: 'field' }, [
      U.el('div', { class: 'se-head' }, [U.el('span', { class: 'se-name', text: '自动战斗每步间隔' }), delayLabel]),
      U.el('input', {
        type: 'range', min: 200, max: 2000, step: 100, value: s.autoPlayDelay,
        oninput: function () { s.autoPlayDelay = Number(this.value); delayLabel.textContent = s.autoPlayDelay + 'ms'; save(); }
      })
    ]));

    var fairToggle = U.el('input', {
      type: 'checkbox', checked: s.fairMode,
      onchange: function () { s.fairMode = fairToggle.checked; save(); }
    });
    battleCard.appendChild(U.el('label', { class: 'row', style: { cursor: 'pointer' } }, [
      fairToggle,
      U.el('div', {}, [
        U.el('div', { text: '默认开启公平模式', style: { fontWeight: '700' } }),
        U.el('div', { class: 'muted', style: { fontSize: '12.5px' }, text: '开战时把双方数值拉到同一稀有度。' })
      ])
    ]));
    host.appendChild(battleCard);

    /* ============================================================ 数据 */
    var dataCard = U.el('div', { class: 'card mt-16' });
    dataCard.appendChild(U.el('h3', { class: 'mb-8 row', style: { gap: '.4em' } }, [UI.icon('save'), U.el('span', { text: '数据' })]));
    var roster = S.getRoster();
    var bytes = 0;
    try { bytes = new Blob([S.exportAll()]).size; } catch (e) { bytes = 0; }
    dataCard.appendChild(U.el('div', { class: 'muted mb-8', style: { fontSize: '13px' },
      text: '蛐蛐库共 ' + roster.length + ' 只，导出体积约 ' + Math.round(bytes / 1024) + ' KB（CG 图片占大头）。'
          + '换电脑、换浏览器都能靠导出文件搬过去。' }));

    dataCard.appendChild(U.el('div', { class: 'row' }, [
      U.el('button', {
        class: 'btn',
        onclick: function () {
          U.download('dqq-蛐蛐库-' + U.todayStr() + '.json', S.exportAll(), true);
          U.toast('已导出', 'ok');
        }
      }, [UI.icon('download'), U.el('span', { text: '导出全部' })]),
      U.el('button', {
        class: 'btn btn-ghost',
        onclick: function () {
          var have = {};
          S.getRoster().forEach(function (c) { have[c.name] = true; });
          var added = 0;
          DQQ.PRESET_CRICKETS.forEach(function (p) {
            if (have[p.name]) return;
            var copy = U.deepClone(p);
            copy.builtin = true;
            if (S.addCricket(copy)) added++;
          });
          U.toast(added ? '补回 ' + added + ' 个预设角色' : '预设角色都在', added ? 'ok' : 'info');
          DQQ.app.render();
        }
      }, [UI.icon('refresh'), U.el('span', { text: '恢复预设角色' })]),
      U.el('button', {
        class: 'btn btn-danger', text: '清空蛐蛐库',
        onclick: function () {
          U.confirm('清空所有蛐蛐？建议先导出备份。', function () {
            S.clearRoster();
            U.toast('已清空', 'ok');
            DQQ.app.render();
          }, { danger: true, yesText: '清空' });
        }
      })
    ]));
    host.appendChild(dataCard);

    /* ============================================================ 规则速查 */
    var rulesCard = U.el('div', { class: 'card mt-16' });
    rulesCard.appendChild(U.el('h3', { class: 'mb-8 row', style: { gap: '.4em' } }, [UI.icon('book'), U.el('span', { text: '规则速查' })]));

    rulesCard.appendChild(U.el('h4', { text: '伤害怎么算', class: 'mt-8', style: { fontSize: '14px' } }));
    rulesCard.appendChild(U.el('div', { class: 'muted', style: { fontSize: '13px' },
      html: '60 × 技能威力 ÷ 100 × 属性克制 × 类型克制 × 暴击 × 随机浮动 × <b>攻击力 ÷ (攻击力 + 防御力)</b><br>'
          + '随机浮动 0.85~1.00；考试属性技能暴击率 +20%，暴击 1.5 倍；最低 1 点伤害。<br>'
          + '单次伤害不超过目标最大血量的 45%，所以再狠也要三下才倒。<br>'
          + '最后那一项是攻防比：<b>攻击 +30 和 防御 +30 对胜负的影响一样大</b>。' }));

    var tabs = U.el('div', { class: 'row mt-16' });
    var tableHost = U.el('div', { class: 'mt-8' });
    ['属性克制表', '类型克制表', '稀有度上限'].forEach(function (label, i) {
      tabs.appendChild(U.el('button', {
        class: 'btn btn-sm' + (i === 0 ? ' btn-primary' : ''), text: label,
        onclick: function () {
          U.$$('button', tabs).forEach(function (b, j) { b.className = 'btn btn-sm' + (j === i ? ' btn-primary' : ''); });
          drawTable(i);
        }
      }));
    });
    rulesCard.appendChild(tabs);
    rulesCard.appendChild(tableHost);

    function drawTable(which) {
      tableHost.innerHTML = '';
      var t = U.el('table', { class: 'table' });

      if (which === 0) {
        var thead = U.el('tr', {}, [U.el('th', { text: '攻击 ↓ / 防御 →' })].concat(
          DQQ.DEFENSE_TYPES.map(function (d) { return U.el('th', { text: d }); })));
        t.appendChild(U.el('thead', {}, [thead]));
        var tb = U.el('tbody');
        DQQ.ELEMENTS.forEach(function (el) {
          tb.appendChild(U.el('tr', {}, [U.el('td', { html: UI.glyphHtml(el) + '<span>' + el + '</span>' })].concat(
            DQQ.DEFENSE_TYPES.map(function (d) {
              var m = DQQ.engine.elementMult(el, d);
              return U.el('td', { class: 'num ' + (m >= 2 ? 'super' : (m <= 0.5 ? 'weak' : '')), text: m + '×' });
            }))));
        });
        t.appendChild(tb);
      } else if (which === 1) {
        var th2 = U.el('tr', {}, [U.el('th', { text: '攻击 ↓ / 防御 →' })].concat(
          DQQ.CHARACTER_TYPES.map(function (d) { return U.el('th', { text: d }); })));
        t.appendChild(U.el('thead', {}, [th2]));
        var tb2 = U.el('tbody');
        DQQ.CHARACTER_TYPES.forEach(function (at) {
          tb2.appendChild(U.el('tr', {}, [U.el('td', { html: UI.glyphHtml(at) + '<span>' + at + '</span>' })].concat(
            DQQ.CHARACTER_TYPES.map(function (dt) {
              var m = DQQ.engine.typeMult(at, dt);
              return U.el('td', { class: 'num ' + (m > 1 ? 'super' : (m < 1 ? 'weak' : '')), text: m + '×' });
            }))));
        });
        t.appendChild(tb2);
      } else {
        t.appendChild(U.el('thead', {}, [U.el('tr', {}, [
          U.el('th', { text: '稀有度' }), U.el('th', { text: 'HP' }), U.el('th', { text: '攻击' }),
          U.el('th', { text: '防御' }), U.el('th', { text: '速度' }), U.el('th', { text: '总属性' }),
          U.el('th', { text: '单技能威力' }), U.el('th', { text: '总威力' })
        ])]));
        var tb3 = U.el('tbody');
        DQQ.RARITIES.forEach(function (r) {
          var m = DQQ.RARITY_META[r];
          tb3.appendChild(U.el('tr', {}, [
            U.el('td', {}, [UI.rarityTag(r)]),
            U.el('td', { class: 'num', text: m.caps.hp }),
            U.el('td', { class: 'num', text: m.caps.attack }),
            U.el('td', { class: 'num', text: m.caps.defense }),
            U.el('td', { class: 'num', text: m.caps.speed }),
            U.el('td', { class: 'num', text: m.caps.total }),
            U.el('td', { class: 'num', text: m.powerCap }),
            U.el('td', { class: 'num', text: m.totalPowerCap })
          ]));
        });
        t.appendChild(tb3);
      }
      tableHost.appendChild(U.el('div', { class: 'table-scroll' }, [t]));
    }
    drawTable(0);

    host.appendChild(rulesCard);

    function save() { S.saveSettings(s); }
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
