/* =========================================================================
 * 附中·电子斗蛐蛐  蛐蛐库页面
 * 浏览、筛选、编辑、导入导出你所有的蛐蛐。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;
  var UI = DQQ.ui;
  var S = DQQ.storage;

  var views = (DQQ.views = DQQ.views || {});

  var filters = { q: '', type: '', rarity: '', defenseType: '' };

  views.roster = function (host) {
    var roster = S.getRoster();

    host.appendChild(U.el('div', { class: 'row-between' }, [
      U.el('div', {}, [
        U.el('h2', { text: '蛐蛐库' }),
        U.el('div', { class: 'muted', text: '共 ' + roster.length + ' 只。点卡片可以编辑，也可以直接拖去斗一场。' })
      ]),
      U.el('div', { class: 'row' }, [
        U.el('button', { class: 'btn', onclick: importDialog }, [UI.icon('upload'), U.el('span', { text: '导入' })]),
        U.el('button', { class: 'btn', onclick: exportAll }, [UI.icon('download'), U.el('span', { text: '导出' })]),
        U.el('button', { class: 'btn btn-primary', onclick: function () { location.hash = '#/create'; } },
          [UI.icon('plus'), U.el('span', { text: '新建蛐蛐' })])
      ])
    ]));

    /* ---------------------------------------------------------- 筛选栏 */
    var box = U.el('div', { class: 'card mt-16' });

    var searchInput = U.el('input', {
      class: 'input', type: 'search', placeholder: '搜名字 / 描述 / 技能名…', value: filters.q,
      oninput: function () { filters.q = searchInput.value.trim(); draw(); }
    });
    box.appendChild(U.el('div', { class: 'field' }, [searchInput]));

    function chipRow(label, key, options, extraClass) {
      var row = U.el('div', { class: 'chips mb-8' });
      row.appendChild(U.el('span', { class: 'muted', style: { fontSize: '12px', alignSelf: 'center', marginRight: '4px' }, text: label }));
      row.appendChild(U.el('button', {
        class: 'chip' + (filters[key] === '' ? ' active' : ''), text: '全部',
        onclick: function () { filters[key] = ''; redraw(); }
      }));
      options.forEach(function (o) {
        row.appendChild(U.el('button', {
          class: 'chip' + (filters[key] === o ? ' active' : ''), text: o,
          onclick: function () { filters[key] = (filters[key] === o ? '' : o); redraw(); }
        }));
      });
      return row;
    }

    function redraw() { DQQ.app.render(); }

    box.appendChild(chipRow('类型', 'type', DQQ.CHARACTER_TYPES));
    box.appendChild(chipRow('稀有度', 'rarity', DQQ.RARITIES));
    box.appendChild(chipRow('防御类型', 'defenseType', DQQ.DEFENSE_TYPES));

    var quick = U.el('div', { class: 'row mt-8' }, [
      U.el('button', { class: 'btn btn-sm', onclick: quickRandom }, [UI.icon('shuffle'), U.el('span', { text: '随机来一只' })]),
      U.el('button', { class: 'btn btn-sm', onclick: restorePresets }, [UI.icon('refresh'), U.el('span', { text: '补满预设角色' })]),
      U.el('button', { class: 'btn btn-sm btn-danger', text: '清空蛐蛐库', onclick: clearAll })
    ]);
    box.appendChild(quick);
    host.appendChild(box);

    var gridHost = U.el('div', { class: 'mt-16' });
    host.appendChild(gridHost);

    /* ------------------------------------------------------------ 渲染 */
    function matches(c) {
      if (filters.type && c.type !== filters.type) return false;
      if (filters.rarity && c.rarity !== filters.rarity) return false;
      if (filters.defenseType && c.defenseType !== filters.defenseType) return false;
      if (filters.q) {
        var hay = [c.name, c.description, c.personality, c.createdBy]
          .concat((c.skills || []).map(function (s) { return s.name; }))
          .join(' ').toLowerCase();
        if (hay.indexOf(filters.q.toLowerCase()) < 0) return false;
      }
      return true;
    }

    function draw() {
      gridHost.innerHTML = '';
      var list = S.getRoster().filter(matches);

      if (!list.length) {
        var isFiltered = filters.q || filters.type || filters.rarity || filters.defenseType;
        gridHost.appendChild(U.el('div', { class: 'empty' }, [
          U.el('span', { class: 'big' }, [UI.icon(isFiltered ? 'search' : 'cricket')]),
          U.el('div', { text: isFiltered ? '没有符合条件的蛐蛐' : '蛐蛐库还是空的' }),
          U.el('div', { class: 'muted mt-8', text: isFiltered ? '换个条件试试' : '先去「创建蛐蛐」捏一只，或者点上面的随机来一只' }),
          isFiltered ? U.el('button', {
            class: 'btn mt-16', text: '清除筛选',
            onclick: function () {
              filters = { q: '', type: '', rarity: '', defenseType: '' };
              DQQ.app.render();
            }
          }) : null
        ]));
        return;
      }

      var grid = U.el('div', { class: 'cricket-grid' });
      list.forEach(function (c) {
        grid.appendChild(UI.cricketCard(c, {
          actions: [
            { label: '编辑', icon: 'pencil', onClick: function () { location.hash = '#/create/' + c.id; } },
            { label: '复制', icon: 'copy', onClick: function () { duplicate(c); } },
            { label: '导出', icon: 'download', onClick: function () { exportOne(c); } },
            { label: '删除', icon: 'trash', cls: 'btn-danger', onClick: function () { removeOne(c); } }
          ]
        }));
      });
      gridHost.appendChild(grid);
    }

    draw();
  };

  /* ------------------------------------------------------------ 操作 */
  function duplicate(c) {
    var copy = U.deepClone(c);
    copy.id = null;
    copy.name = c.name + ' 二号机';
    copy.builtin = false;
    var saved = S.addCricket(copy);
    if (saved) { U.toast('已复制：' + saved.name, 'ok'); DQQ.app.render(); }
  }

  function removeOne(c) {
    U.confirm('确定删掉「' + c.name + '」吗？删了就找不回来了。', function () {
      S.removeCricket(c.id);
      U.toast('已删除', 'ok');
      DQQ.app.render();
    }, { danger: true, yesText: '删除' });
  }

  function exportOne(c) {
    var copy = U.deepClone(c);
    delete copy.id;
    delete copy.builtin;
    U.download(safeName(c.name) + '.json', JSON.stringify(copy, null, 2), true);
    U.toast('已导出 ' + c.name, 'ok');
  }

  function exportAll() {
    if (!S.getRoster().length) { U.toast('蛐蛐库是空的', 'err'); return; }
    U.download('dqq-蛐蛐库-' + U.todayStr() + '.json', S.exportAll(), true);
    U.toast('已导出整个蛐蛐库', 'ok');
  }

  function safeName(s) {
    return String(s || 'cricket').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  }

  function importDialog() {
    var textarea = U.el('textarea', { class: 'textarea', placeholder: '把导出的 JSON 粘在这里，或者点下面的按钮选文件…' });

    var fileInput = U.el('input', {
      type: 'file', accept: '.json,application/json', style: { display: 'none' },
      onchange: function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function (e) { textarea.value = e.target.result; };
        reader.readAsText(f, 'utf-8');
      }
    });

    U.modal({
      title: '导入蛐蛐',
      render: function (m) {
        m.body.appendChild(U.el('p', { class: 'muted', text: '支持：整个蛐蛐库的导出文件、单只蛐蛐的 JSON、或者一个蛐蛐数组。' }));
        m.body.appendChild(U.el('div', { class: 'field' }, [textarea]));
        m.body.appendChild(U.el('div', { class: 'row' }, [
          U.el('button', { class: 'btn btn-sm', onclick: function () { fileInput.click(); } }, [UI.icon('upload'), U.el('span', { text: '选择文件…' })]),
          fileInput
        ]));
        m.footer.appendChild(U.el('button', { class: 'btn btn-ghost', text: '取消', onclick: m.close }));
        m.footer.appendChild(U.el('button', {
          class: 'btn', text: '追加导入',
          onclick: function () { doImport(m, textarea.value, 'merge'); }
        }));
        m.footer.appendChild(U.el('button', {
          class: 'btn btn-danger', text: '覆盖导入',
          onclick: function () {
            U.confirm('覆盖导入会先清空现有蛐蛐库，确定吗？', function () {
              doImport(m, textarea.value, 'replace');
            }, { danger: true, yesText: '覆盖' });
          }
        }));
      }
    });
  }

  function doImport(m, text, mode) {
    if (!text || !text.trim()) { U.toast('还没贴内容', 'err'); return; }
    var res = S.importAll(text, mode);
    if (!res.ok) { U.toast(res.error, 'err'); return; }
    m.close();
    U.toast('导入了 ' + res.added + ' 只蛐蛐' + (res.rejected.length ? '，跳过 ' + res.rejected.length + ' 条无效数据' : ''), 'ok');
    DQQ.app.render();
  }

  function quickRandom() {
    var brief = DQQ.generator.randomBrief();
    var c = DQQ.generator.generate({
      name: brief.name,
      description: brief.description,
      createdBy: '随机生成'
    });
    var saved = S.addCricket(c);
    if (saved) {
      U.toast('生成了一只「' + saved.name + '」（' + saved.rarity + '）', 'ok');
      DQQ.app.render();
    }
  }

  function restorePresets() {
    var roster = S.getRoster();
    var have = {};
    roster.forEach(function (c) { have[c.name] = true; });
    var added = 0;
    DQQ.PRESET_CRICKETS.forEach(function (p) {
      if (have[p.name]) return;
      var copy = U.deepClone(p);
      copy.builtin = true;
      if (S.addCricket(copy)) added++;
    });
    U.toast(added ? '补回了 ' + added + ' 个预设角色' : '预设角色都在，没缺', added ? 'ok' : 'info');
    DQQ.app.render();
  }

  function clearAll() {
    U.confirm('清空整个蛐蛐库？包括预设角色，全部删掉。\n建议先导出备份。', function () {
      S.clearRoster();
      U.toast('已清空', 'ok');
      DQQ.app.render();
    }, { danger: true, yesText: '全部删除' });
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
