/* =========================================================================
 * 附中·电子斗蛐蛐  创建 / 编辑蛐蛐
 *
 * 两条路都能走：
 *   手动填写 —— 自己定属性和技能
 *   AI 辅助 —— 写一句描述，剩下交给 AI（在线大模型 / 内置离线生成器）
 * 不管走哪条，生成完都能随便改。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var E = DQQ.effect;
  var B = DQQ.balance;
  var UI = DQQ.ui;
  var S = DQQ.storage;

  var views = (DQQ.views = DQQ.views || {});

  var EFFECT_OPTIONS = [
    { v: '', label: '无效果' },
    { v: 'debuff', label: '削弱对方' },
    { v: 'buff', label: '强化自身' },
    { v: 'heal', label: '回复生命' },
    { v: 'dot', label: '持续伤害' },
    { v: 'stun', label: '使对方无法行动' },
    { v: 'drain', label: '吸取生命' },
    { v: 'shield', label: '获得护盾' }
  ];

  function blankCricket() {
    return {
      name: '',
      description: '',
      type: '同学',
      defenseType: '学霸',
      rarity: '稀有',
      personality: '',
      stats: { hp: 70, attack: 45, defense: 45, speed: 50 },
      skills: [
        { name: '', element: '粉笔', power: 40, accuracy: 90, effect: null, cg: null },
        { name: '', element: '规则', power: 40, accuracy: 85, effect: null, cg: null }
      ],
      createdBy: '',
      createdAt: U.todayStr()
    };
  }

  views.create = function (host, params) {
    var editingId = params && params.id;
    var draft = editingId
      ? U.deepClone(S.getCricket(editingId) || blankCricket())
      : blankCricket();
    var isEditing = !!editingId;

    var settings = S.getSettings();

    host.appendChild(U.el('div', { class: 'row-between' }, [
      U.el('div', {}, [
        U.el('h2', { text: isEditing ? '编辑蛐蛐' : '创建蛐蛐' }),
        U.el('div', { class: 'muted', text: '先写一句描述，点 AI 生成；也可以完全手动填。生成后什么都能改。' })
      ]),
      U.el('button', { class: 'btn btn-ghost', text: '← 回蛐蛐库', onclick: function () { location.hash = '#/roster'; } })
    ]));

    var layout = U.el('div', { class: 'creator-layout mt-16' });
    var left = U.el('div', {});
    var right = U.el('div', {});
    var previewHost = U.el('div', {});
    layout.appendChild(left);
    layout.appendChild(right);
    host.appendChild(layout);

    /* 局部重绘：只重建这个页面里的几块 DOM。
     * 千万别在这里调 DQQ.app.render()——那会重跑 views.create，
     * 把用户正在编辑的内容全部丢掉。
     * 注意：下面这几块不含「① 这是个什么蛐蛐」那三排选项按钮，
     * 它们的高亮由 chipPainters 单独刷新（见 chipGroup）。 */
    var chipPainters = [];

    function localRerender() {
      chipPainters.forEach(function (paint) { paint(); });
      drawPortrait();     // 换防御类型时，没传立绘的那只字形兜底要跟着变
      buildStats();
      buildSkills();
      renderPreview();
      renderCheck();
      renderRef();
    }

    /* ================================================================ 基本信息 */
    var infoCard = U.el('div', { class: 'card mb-16' });
    infoCard.appendChild(U.el('h3', { text: '① 这是个什么蛐蛐', class: 'mb-8' }));

    var nameInput = U.el('input', {
      class: 'input', maxlength: 12, placeholder: '比如：数学课代表', value: draft.name,
      oninput: function () { draft.name = nameInput.value; refresh(); }
    });
    infoCard.appendChild(U.el('div', { class: 'field' }, [
      U.el('label', { text: '名字（最多 12 字）' }), nameInput
    ]));

    var descInput = U.el('textarea', {
      class: 'textarea', maxlength: 120,
      placeholder: '一句话描述它是个什么样的角色。写得越具体，AI 生成的技能越贴。\n比如：拖堂能力极强，粉笔头百发百中，收作业六亲不认。',
      value: draft.description,
      oninput: function () { draft.description = descInput.value; refresh(); }
    });
    infoCard.appendChild(U.el('div', { class: 'field' }, [
      U.el('label', { text: '一句话描述' }), descInput
    ]));

    /* ------------------------------------------------------------ 角色立绘 */
    /* 每只蛐蛐都必须有自己的立绘 —— 这是硬性要求，没传存不进去。
     * 不想自己画/拍照的话，右边有一键生成默认立绘。 */
    var portraitBox = U.el('div', { class: 'field' });
    portraitBox.appendChild(U.el('label', {}, [
      U.el('span', { text: '角色立绘' }),
      U.el('span', { class: 'req', text: '必填' })
    ]));

    var portraitRow = U.el('div', { class: 'portrait-row' });
    var portraitPreview = U.el('div', { class: 'portrait-slot' });
    var portraitSide = U.el('div', { class: 'portrait-side' });

    var fileInput = U.el('input', {
      type: 'file', accept: 'image/*', style: { display: 'none' },
      onchange: function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        U.readImageFile(f, UI.PORTRAIT_MAX, function (err, dataUrl) {
          if (err) { U.toast(err.message, 'err'); return; }
          draft.portrait = dataUrl;
          drawPortrait();
          localRerender();
          U.toast('立绘已加上（自动压缩到 ' + UI.PORTRAIT_MAX + 'px）', 'ok');
        });
        fileInput.value = '';
      }
    });

    function drawPortrait() {
      portraitPreview.innerHTML = '';
      portraitSide.innerHTML = '';

      if (draft.portrait) {
        portraitPreview.classList.add('filled');
        portraitPreview.appendChild(UI.sprite(draft));
        portraitSide.appendChild(U.el('button', {
          class: 'btn btn-sm', onclick: function () { fileInput.click(); }
        }, [UI.icon('image'), U.el('span', { text: '换一张' })]));
        portraitSide.appendChild(U.el('button', {
          class: 'btn btn-sm btn-danger', onclick: function () {
            draft.portrait = null; drawPortrait(); localRerender();
          }
        }, [UI.icon('trash'), U.el('span', { text: '移除' })]));
      } else {
        portraitPreview.classList.remove('filled');
        portraitPreview.appendChild(UI.glyph(draft.defenseType, 'sprite-glyph'));
        portraitPreview.appendChild(U.el('span', { class: 'ps-hint', text: '还没传' }));
        portraitSide.appendChild(U.el('button', {
          class: 'btn btn-sm btn-primary', onclick: function () { fileInput.click(); }
        }, [UI.icon('upload'), U.el('span', { text: '上传图片' })]));
        portraitSide.appendChild(U.el('button', {
          class: 'btn btn-sm', onclick: useDefaultPortrait
        }, [UI.icon('wand'), U.el('span', { text: '用默认立绘' })]));
      }
    }

    /* 一键把当前防御类型的字形渲染成 PNG 立绘。
     * 有了它"必须传图"就不会把人卡死 —— 手机上一键就有图。 */
    function useDefaultPortrait(ev) {
      var btn = ev && ev.currentTarget;
      if (btn) { btn.disabled = true; }
      UI.glyphToDataUrl(draft.defenseType).then(function (url) {
        if (btn) { btn.disabled = false; }
        if (!url) { U.toast('生成失败，直接传一张图片吧', 'err'); return; }
        draft.portrait = url;
        drawPortrait();
        localRerender();
        U.toast('已生成默认立绘，随时可以换掉', 'ok');
      });
    }

    portraitRow.appendChild(portraitPreview);
    portraitRow.appendChild(portraitSide);
    portraitBox.appendChild(portraitRow);
    portraitBox.appendChild(U.el('div', { class: 'hint' },
      [U.el('span', { text: '手绘、表情包、AI 生成图都行，会自动压缩。' }),
       U.el('b', { text: '请不要上传真人照片或指名道姓的真人形象。' })]));
    portraitBox.appendChild(fileInput);
    infoCard.appendChild(portraitBox);

    function chipGroup(label, list, key, onChange) {
      var box = U.el('div', { class: 'field' });
      box.appendChild(U.el('label', { text: label }));
      var row = U.el('div', { class: 'chips' });
      var nodes = [];

      /* 这三排按钮不在 localRerender 的重建范围里，所以高亮必须就地刷。
       * 之前就是漏了这一步：点「导师」数据确实改了，但「同学」还亮着，
       * 界面上一点反馈都没有，看起来就像点了没反应。 */
      function paint() {
        nodes.forEach(function (node) {
          node.classList.toggle('active', draft[key] === node._value);
        });
      }

      list.forEach(function (item) {
        var value = typeof item === 'string' ? item : item.v;
        var text = typeof item === 'string' ? item : item.label;
        // 带 glyph 的选项用 SVG 字形，没有的话就是纯文字（稀有度那种）
        var btn = U.el('button', {
          class: 'chip',
          onclick: function () {
            draft[key] = value;
            if (onChange) onChange(value);
            localRerender();
          }
        }, [
          (item && item.glyph) ? UI.glyph(item.glyph) : null,
          U.el('span', { text: text })
        ]);
        btn._value = value;
        nodes.push(btn);
        row.appendChild(btn);
      });

      paint();
      chipPainters.push(paint);
      box.appendChild(row);
      return box;
    }

    infoCard.appendChild(chipGroup('角色类型', DQQ.CHARACTER_TYPES.map(function (t) {
      return { v: t, glyph: t, label: t };
    }), 'type'));

    infoCard.appendChild(chipGroup('防御类型（决定被什么属性克制）', DQQ.DEFENSE_TYPES.map(function (t) {
      return { v: t, glyph: t, label: t };
    }), 'defenseType'));

    infoCard.appendChild(chipGroup('稀有度（决定数值上限）', DQQ.RARITIES, 'rarity', function () {
      draft.stats = B.clampStats(draft.stats, draft.rarity);
      draft.skills = B.clampSkills(draft.skills, draft.rarity);
    }));

    left.appendChild(infoCard);

    /* ================================================================ AI 生成 */
    var aiCard = U.el('div', { class: 'card mb-16' });
    aiCard.appendChild(U.el('h3', { text: '② 让 AI 帮你配数值（可选）', class: 'mb-8' }));

    var aiStatus = U.el('div', { class: 'muted', style: { fontSize: '12.5px' } });
    var aiBtn = U.el('button', { class: 'btn btn-primary btn-block', onclick: runAI },
      [UI.icon('wand'), U.el('span', { text: 'AI 生成属性和技能' })]);

    /* 按钮里是「图标 + 文字」两个节点，改文案要连图标一起重建 */
    function setAiBtnLabel(text) {
      aiBtn.innerHTML = '';
      aiBtn.appendChild(UI.icon('wand'));
      aiBtn.appendChild(U.el('span', { text: text }));
    }

    aiCard.appendChild(U.el('p', { class: 'muted', text: '不点也行，下面的属性和技能都可以自己拖。' }));
    aiCard.appendChild(aiBtn);
    aiCard.appendChild(U.el('div', { class: 'mt-8' }, [aiStatus]));

    function setAiStatus() {
      var s = S.getSettings();
      if (s.aiEnabled && s.apiKey) {
        aiStatus.innerHTML = '';
        aiStatus.appendChild(U.el('span', { class: 'super', text: '● 已开启在线 AI（' + (s.model || '') + '）' }));
        aiStatus.appendChild(document.createTextNode(' 生成更贴描述，失败会自动退回离线生成器。'));
      } else {
        aiStatus.textContent = '当前用的是内置离线生成器：读描述里的关键词来配属性和技能，不联网、不花钱。想用在线大模型去「设置」里填 API Key。';
      }
    }
    setAiStatus();

    function runAI() {
      if (!draft.name.trim()) { U.toast('先给蛐蛐起个名字吧', 'err'); nameInput.focus(); return; }

      var payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        type: draft.type,
        defenseType: draft.defenseType,
        rarity: draft.rarity,
        createdBy: draft.createdBy
      };

      var s = S.getSettings();
      var useOnline = s.aiEnabled && s.apiKey;

      aiBtn.disabled = true;
      setAiBtnLabel(useOnline ? 'AI 正在想…' : '生成中…');

      function finish(cricket, source, notes) {
        // 保留玩家已经填好的名字和描述，其余用生成的
        var keepName = draft.name;
        var keepDesc = draft.description;
        Object.keys(cricket).forEach(function (k) { draft[k] = cricket[k]; });
        draft.name = keepName;
        draft.description = keepDesc;
        draft.stats = B.clampStats(draft.stats, draft.rarity);
        draft.skills = B.clampSkills(draft.skills, draft.rarity);
        // 重新挂到界面上
        syncInputs();
        refresh();
        aiBtn.disabled = false;
        setAiBtnLabel('AI 生成属性和技能');
        if (source === 'llm') {
          U.toast('在线 AI 生成完成' + (notes && notes.length ? '（' + notes.length + ' 处被自动修正）' : ''), 'ok');
        } else {
          U.toast('已用离线生成器生成', 'ok');
        }
        notes && notes.forEach(function (n) { console.warn('[dqq ai]', n); });
      }

      if (useOnline) {
        DQQ.llm.generate(payload, s, function (err, cricket) {
          if (err) {
            console.warn('[dqq] 在线生成失败，退回离线', err);
            U.toast('在线 AI 失败（' + err.message + '），已用离线生成器', 'err');
            finish(DQQ.generator.generate(payload), 'offline');
          } else {
            finish(cricket, 'llm', cricket._notes);
          }
        });
      } else {
        setTimeout(function () {
          finish(DQQ.generator.generate(payload), 'offline');
        }, 120);
      }
    }

    left.appendChild(aiCard);

    /* ================================================================ 属性 */
    var statsCard = U.el('div', { class: 'card mb-16' });
    statsCard.appendChild(U.el('h3', { text: '③ 属性', class: 'mb-8' }));
    var statsHost = U.el('div', {});
    statsCard.appendChild(statsHost);
    left.appendChild(statsCard);

    /* ================================================================ 技能 */
    var skillsCard = U.el('div', { class: 'card mb-16' });
    var skillsHost = U.el('div', {});
    skillsCard.appendChild(skillsHost);
    left.appendChild(skillsCard);

    /* ================================================================ 保存 */
    var saveRow = U.el('div', { class: 'row' });
    saveRow.appendChild(U.el('button', {
      class: 'btn btn-primary btn-lg', onclick: save
    }, [UI.icon('save'), U.el('span', { text: isEditing ? '保存修改' : '收进蛐蛐库' })]));
    saveRow.appendChild(U.el('button', {
      class: 'btn btn-lg', text: '取消', onclick: function () { location.hash = '#/roster'; }
    }));
    left.appendChild(saveRow);

    /* ================================================================ 右侧预览 */
    right.appendChild(U.el('div', { class: 'card mb-16' }, [
      U.el('h3', { text: '实时预览', class: 'mb-8' }),
      previewHost
    ]));

    var checkCard = U.el('div', { class: 'card mb-16' });
    checkCard.appendChild(U.el('h3', { text: '超模检测', class: 'mb-8' }));
    var checkHost = U.el('div', {});
    checkCard.appendChild(checkHost);
    right.appendChild(checkCard);

    var refCard = U.el('div', { class: 'card' });
    refCard.appendChild(U.el('h3', { text: '这个防御类型怕什么', class: 'mb-8' }));
    var refHost = U.el('div', {});
    refCard.appendChild(refHost);
    right.appendChild(refCard);

    /* ================================================================ 渲染 */
    function syncInputs() {
      nameInput.value = draft.name || '';
      descInput.value = draft.description || '';
    }

    function buildStats() {
      statsHost.innerHTML = '';
      var caps = B.caps(draft.rarity);
      statsHost.appendChild(U.el('div', { class: 'muted mb-8', style: { fontSize: '12.5px' },
        text: draft.rarity + ' 的上限：HP ' + caps.hp + ' / 攻击 ' + caps.attack + ' / 防御 ' + caps.defense +
              ' / 速度 ' + caps.speed + '，总和 ≤ ' + caps.total }));

      [['hp', 'HP'], ['attack', '攻击'], ['defense', '防御'], ['speed', '速度']].forEach(function (pair) {
        var k = pair[0];
        statsHost.appendChild(UI.statEditor(k, pair[1], draft.stats[k], caps[k], function (v) {
          draft.stats[k] = v;
          refreshStatsOnly();
        }));
      });

      var total = B.totalStats(draft.stats);
      var over = total > caps.total;
      statsHost.appendChild(U.el('div', {
        class: over ? 'weak' : 'dim', style: { fontWeight: '700' },
        text: '总属性 ' + total + ' / ' + caps.total + (over ? '　超了 ' + (total - caps.total) + ' 点！' : '')
      }));

      if (over) {
        statsHost.appendChild(U.el('button', {
          class: 'btn btn-sm mt-8', text: '自动压回上限',
          onclick: function () { draft.stats = B.clampStats(draft.stats, draft.rarity); localRerender(); }
        }));
      }
    }

    function buildSkills() {
      skillsHost.innerHTML = '';
      var powerCap = B.powerCap(draft.rarity);
      var totalCap = B.totalPowerCap(draft.rarity);
      var totalPower = B.totalPower(draft.skills);

      skillsHost.appendChild(U.el('div', { class: 'row-between mb-8' }, [
        U.el('h3', { text: '④ 技能（2-4 个）' }),
        U.el('span', { class: totalPower > totalCap ? 'weak' : 'muted', style: { fontSize: '12.5px' },
          text: '总威力 ' + totalPower + ' / ' + totalCap + '　单技能上限 ' + powerCap })
      ]));

      draft.skills.forEach(function (sk, i) {
        skillsHost.appendChild(skillEditor(sk, i));
      });

      var row = U.el('div', { class: 'row mt-8' });
      if (draft.skills.length < B.MAX_SKILLS) {
        row.appendChild(U.el('button', {
          class: 'btn btn-sm', text: '＋ 加一个技能',
          onclick: function () {
            draft.skills.push({ name: '', element: '粉笔', power: Math.round(powerCap * 0.6), accuracy: 90, effect: null, cg: null });
            localRerender();
          }
        }));
      }
      if (totalPower > totalCap) {
        row.appendChild(U.el('button', {
          class: 'btn btn-sm', text: '自动压缩总威力',
          onclick: function () { draft.skills = B.clampSkills(draft.skills, draft.rarity); localRerender(); }
        }));
      }
      skillsHost.appendChild(row);
    }

    function skillEditor(sk, index) {
      var box = U.el('div', { class: 'skill-editor card', style: { background: 'var(--bg-2)', marginBottom: '12px' } });

      var head = U.el('div', { class: 'row-between mb-8' }, [
        U.el('strong', { text: '技能 ' + (index + 1) }),
        U.el('div', { class: 'row' }, [
          U.el('button', {
            class: 'btn btn-sm btn-ghost', text: '↑', title: '上移',
            onclick: function () { if (index > 0) { swap(draft.skills, index, index - 1); localRerender(); } }
          }),
          U.el('button', {
            class: 'btn btn-sm btn-ghost', text: '↓', title: '下移',
            onclick: function () { if (index < draft.skills.length - 1) { swap(draft.skills, index, index + 1); localRerender(); } }
          }),
          U.el('button', {
            class: 'btn btn-sm btn-danger', text: '删除', disabled: draft.skills.length <= B.MIN_SKILLS,
            onclick: function () { draft.skills.splice(index, 1); localRerender(); }
          })
        ])
      ]);
      box.appendChild(head);

      var powerCap = B.powerCap(draft.rarity);

      box.appendChild(U.el('div', { class: 'grid-2' }, [
        U.el('div', { class: 'field' }, [
          U.el('label', { text: '技能名' }),
          U.el('input', {
            class: 'input', maxlength: 10, value: sk.name, placeholder: '比如：粉笔头',
            oninput: function () { sk.name = this.value; refreshCheck(); refreshPreview(); }
          })
        ]),
        U.el('div', { class: 'field' }, [
          U.el('label', { text: '攻击属性' }),
          elChips(sk)
        ])
      ]));

      box.appendChild(U.el('div', { class: 'grid-2' }, [
        numField('威力 (5-' + powerCap + ')', sk.power, 5, powerCap, function (v) {
          sk.power = v; refreshCheck(); refreshPreview(); buildSkillsPowerLabel();
        }),
        numField('命中率 (50-100%)', sk.accuracy, 50, 100, function (v) {
          sk.accuracy = v; refreshCheck(); refreshPreview();
        })
      ]));

      box.appendChild(effectEditor(sk));

      // CG 上传
      var cgRow = U.el('div', { class: 'field' });
      cgRow.appendChild(U.el('label', { text: '技能 CG（可选，出招时全屏放一张图）' }));
      var cgPreview = U.el('div', { class: 'row' });

      function drawCg() {
        cgPreview.innerHTML = '';
        if (sk.cg) {
          cgPreview.appendChild(U.el('img', {
            src: sk.cg, style: { width: '74px', height: '74px', objectFit: 'cover', borderRadius: '9px', border: '1px solid var(--line)' }
          }));
          cgPreview.appendChild(U.el('button', {
            class: 'btn btn-sm btn-danger', text: '移除',
            onclick: function () { sk.cg = null; drawCg(); refreshPreview(); }
          }));
        } else {
          cgPreview.appendChild(U.el('span', { class: 'muted', style: { fontSize: '12px' }, text: '没传的话，出招时会用屏幕震动 + 闪光代替。' }));
        }
      }
      drawCg();

      var cgInput = U.el('input', {
        type: 'file', accept: 'image/*', style: { display: 'none' },
        onchange: function () {
          var f = cgInput.files && cgInput.files[0];
          if (!f) return;
          U.readImageFile(f, 640, function (err, dataUrl) {
            if (err) { U.toast(err.message, 'err'); return; }
            sk.cg = dataUrl;
            drawCg(); refreshPreview();
            U.toast('CG 已加上（已自动压缩）', 'ok');
          });
          cgInput.value = '';
        }
      });
      cgRow.appendChild(cgPreview);
      cgRow.appendChild(U.el('div', { class: 'row mt-8' }, [
        U.el('button', { class: 'btn btn-sm', onclick: function () { cgInput.click(); } }, [UI.icon('image'), U.el('span', { text: '上传图片' })]),
        cgInput
      ]));
      box.appendChild(cgRow);

      return box;
    }

    function elChips(sk) {
      var row = U.el('div', { class: 'chips' });
      DQQ.ELEMENTS.forEach(function (el) {
        row.appendChild(U.el('button', {
          class: 'chip' + (sk.element === el ? ' active' : ''),
          style: sk.element === el ? { borderColor: UI.elColor(el), color: UI.elColor(el) } : {},
          html: UI.glyphHtml(el) + '<span>' + el + '</span>',
          onclick: function () { sk.element = el; localRerender(); }
        }));
      });
      return row;
    }

    function numField(label, value, min, max, onChange) {
      var valLabel = U.el('span', { class: 'se-val', text: value });
      var input = U.el('input', {
        type: 'range', min: min, max: max, value: value,
        oninput: function () { valLabel.textContent = input.value; onChange(Number(input.value)); }
      });
      return U.el('div', { class: 'field' }, [
        U.el('div', { class: 'se-head' }, [U.el('span', { class: 'se-name', text: label }), valLabel]),
        input
      ]);
    }

    function effectEditor(sk) {
      var eff = E.normalize(sk.effect) || { kind: '', stat: 'defense', value: 0.2, turns: 2, chance: 1 };
      var box = U.el('div', { class: 'field' });

      var kindSel = U.el('select', {
        class: 'select',
        onchange: function () {
          var k = kindSel.value;
          if (!k) { sk.effect = null; }
          else { sk.effect = { kind: k, stat: eff.stat || 'defense', value: eff.value || 0.2, turns: eff.turns || 2, chance: eff.chance == null ? 1 : eff.chance }; }
          localRerender();
        }
      });
      EFFECT_OPTIONS.forEach(function (o) {
        kindSel.appendChild(U.el('option', { value: o.v, text: o.label, selected: (eff.kind || '') === o.v }));
      });

      box.appendChild(U.el('label', { text: '技能效果' }));
      box.appendChild(kindSel);

      if (!eff.kind) return box;

      var detail = U.el('div', { class: 'mt-8' });

      if (eff.kind === 'debuff' || eff.kind === 'buff') {
        var statSel = U.el('select', {
          class: 'select',
          onchange: function () { sk.effect.stat = statSel.value; refreshCheck(); refreshPreview(); }
        });
        [['attack', '攻击'], ['defense', '防御'], ['speed', '速度']].forEach(function (p) {
          statSel.appendChild(U.el('option', { value: p[0], text: p[1], selected: eff.stat === p[0] }));
        });
        detail.appendChild(U.el('div', { class: 'grid-2' }, [
          U.el('div', {}, [U.el('label', { class: 'muted', style: { fontSize: '12px' }, text: '影响哪一项' }), statSel]),
          numField('幅度 ' + Math.round(eff.value * 100) + '%', Math.round(eff.value * 100), 5, 60, function (v) {
            sk.effect.value = v / 100; refreshCheck(); refreshPreview();
          })
        ]));
      }

      if (eff.kind === 'heal') {
        var isPct = !!eff.percent;
        detail.appendChild(numField(isPct ? '回复 ' + Math.round(eff.value * 100) + '% 最大生命' : '回复 ' + Math.round(eff.value) + ' 点HP',
          isPct ? Math.round(eff.value * 100) : Math.round(eff.value), 5, isPct ? 50 : 60, function (v) {
            sk.effect.value = isPct ? v / 100 : v; refreshCheck(); refreshPreview();
          }));
        detail.appendChild(U.el('label', { class: 'row', style: { fontSize: '12px' } }, [
          U.el('input', {
            type: 'checkbox', checked: isPct,
            onchange: function () { sk.effect.percent = this.checked; sk.effect.value = this.checked ? 0.2 : 25; localRerender(); }
          }),
          U.el('span', { text: '按最大生命的百分比回复' })
        ]));
      }

      if (eff.kind === 'dot') {
        detail.appendChild(numField('每回合损失 ' + Math.round(eff.value) + ' 点HP', Math.round(eff.value), 2, 25, function (v) {
          sk.effect.value = v; refreshCheck(); refreshPreview();
        }));
      }

      if (eff.kind === 'drain') {
        detail.appendChild(numField('吸取 ' + Math.round(eff.value * 100) + '% 伤害', Math.round(eff.value * 100), 10, 60, function (v) {
          sk.effect.value = v / 100; refreshCheck(); refreshPreview();
        }));
      }

      if (eff.kind === 'shield') {
        detail.appendChild(numField('护盾值 ' + Math.round(eff.value), Math.round(eff.value), 5, 60, function (v) {
          sk.effect.value = v; refreshCheck(); refreshPreview();
        }));
      }

      if (eff.kind !== 'heal' && eff.kind !== 'drain') {
        detail.appendChild(numField('持续 ' + eff.turns + ' 回合', eff.turns, 1, 5, function (v) {
          sk.effect.turns = v; refreshCheck(); refreshPreview();
        }));
      }

      if (eff.kind === 'stun' || eff.kind === 'dot' || eff.kind === 'debuff') {
        detail.appendChild(numField('触发概率 ' + Math.round(eff.chance * 100) + '%', Math.round(eff.chance * 100), 10, 100, function (v) {
          sk.effect.chance = v / 100; refreshCheck(); refreshPreview();
        }));
      }

      box.appendChild(detail);
      return box;
    }

    function swap(arr, i, j) { var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }

    function buildSkillsPowerLabel() {
      // 威力变了要刷新总威力提示，整块重建最省事
      buildSkills();
    }

    /* ------------------------------------------------------------ 刷新 */
    function refreshStatsOnly() {
      // 拖动滑条时只更新预览和校验，避免重建 DOM 把焦点弄丢
      refreshPreview();
      refreshCheck();
    }

    function refreshPreview() { renderPreview(); }
    function refreshCheck() { renderCheck(); }

    function refresh() {
      renderPreview();
      renderCheck();
    }

    function renderPreview() {
      previewHost.innerHTML = '';
      var probe = U.deepClone(draft);
      if (!probe.name) probe.name = '（还没起名字）';
      if (!probe.skills.length) probe.skills = [];
      previewHost.appendChild(UI.cricketCard(probe, {}));
    }

    function renderCheck() {
      checkHost.innerHTML = '';
      var res = B.check(draft);

      /* 立绘是硬性要求，但它是「创建表单」的要求，不属于数值平衡，
       * 所以放在这里而不是塞进 B.check() —— 否则预设角色和导入的老数据
       * 全都会被判成不合法。 */
      var needPortrait = !UI.hasPortrait(draft);

      var ul = U.el('ul', { class: 'check-list' });
      if (res.ok && !res.warnings.length && !needPortrait) {
        ul.appendChild(U.el('li', { class: 'ok', text: '完全合规，可以收进蛐蛐库了' }));
      }
      res.errors.forEach(function (e) { ul.appendChild(U.el('li', { class: 'err', text: e })); });
      if (needPortrait) ul.appendChild(U.el('li', { class: 'err', text: '还没传角色立绘（点右边的「用默认立绘」可以一键生成）' }));
      res.warnings.forEach(function (w) { ul.appendChild(U.el('li', { class: 'warn', text: w })); });
      checkHost.appendChild(ul);

      var caps = B.caps(draft.rarity);
      checkHost.appendChild(U.el('div', { class: 'muted mt-8', style: { fontSize: '12px' },
        text: '总属性 ' + res.totalStats + '/' + caps.total + '　总威力 ' + res.totalPower + '/' + B.totalPowerCap(draft.rarity) }));

      var blocked = !res.ok || needPortrait;
      saveBtn.disabled = blocked;
      saveBtn.title = blocked ? '还有问题没解决，先看上面的红色提示' : '';
    }

    function renderRef() {
      refHost.innerHTML = '';
      refHost.appendChild(U.el('div', { class: 'muted mb-8', style: { fontSize: '12.5px' },
        text: '下面是各种攻击属性打在「' + draft.defenseType + '」身上的倍率。' }));
      refHost.appendChild(UI.counterTable(draft.defenseType));
    }

    /* ------------------------------------------------------------ 保存 */
    var saveBtn = saveRow.firstChild;

    function save() {
      var res = B.check(draft);
      if (!res.ok) { U.toast('还有 ' + res.errors.length + ' 个问题要改', 'err'); return; }

      var payload = U.deepClone(draft);
      payload.skills = payload.skills.map(function (s) {
        var out = U.deepClone(s);
        out.effect = E.normalize(s.effect);   // 存结构化对象，字符串写法也一起兼容
        return out;
      });

      if (isEditing) {
        payload.id = editingId;
        var existing = S.getCricket(editingId);
        if (existing) {
          payload.builtin = existing.builtin;
          payload.createdAt = existing.createdAt;
        }
      }

      var saved = S.addCricket(payload);
      if (saved) {
        U.toast(isEditing ? '已保存修改' : '「' + saved.name + '」已经进蛐蛐库了', 'ok');
        location.hash = '#/roster';
      }
    }

    /* ------------------------------------------------------------ 起步 */
    drawPortrait();
    buildStats();
    buildSkills();
    renderPreview();
    renderCheck();
    renderRef();
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
