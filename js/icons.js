/* =========================================================================
 * 附中·电子斗蛐蛐  图标库
 *
 * 全部是手写的内联 SVG，不依赖任何图标 CDN —— 因为整个项目要能双击
 * index.html 离线运行。统一 24×24 视图框、线性描边、currentColor 取色，
 * 所以图标会自动跟着纸/墨/朱批的配色走。
 *
 * 两类：
 *   UI.icon('swords')        界面装饰（导航、按钮、表头）
 *   UI.glyph('考试')          游戏数据字形（属性 / 防御类型 / 角色类型）
 *
 * 想换某个图标：改下面 ICONS / GLYPHS 里对应的 path 就行。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});
  var U = DQQ.util;

  var UI = (DQQ.ui = DQQ.ui || {});

  /* ------------------------------------------------------------ 界面图标 */
  /* 描边风格：24×24，stroke=currentColor，fill=none */
  var ICONS = {
    library:  '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.6l3.4 15.1"/>',
    create:   '<path d="M12 5v14M5 12h14"/>',
    swords:   '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
    trophy:   '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.6H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.4 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z"/>',
    pencil:   '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    copy:     '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash:    '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    image:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    wand:     '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4M3 21l9-9"/>',
    flame:    '<path d="M12 22a7 7 0 0 0 7-7c0-5-4-6-4-11 0 0-3 1.5-3 5 0 2-1 3-2 3s-2-1-2-3c-2 2-3 4-3 6a7 7 0 0 0 7 7z"/>',
    refresh:  '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    gauge:    '<path d="M12 14l4-4M3.5 18a9 9 0 1 1 17 0"/>',
    forward:  '<path d="M13 19l9-7-9-7zM2 19l9-7-9-7z"/>',
    exit:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    close:    '<path d="M18 6 6 18M6 6l12 12"/>',
    save:     '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    filter:   '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    shuffle:  '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    check:    '<path d="M20 6 9 17l-5-5"/>',
    alert:    '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    info:     '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    user:     '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    gavel:    '<path d="M14 13l-7 7-3-3 7-7M14 13l3-3M14 13l-3-3M17 10l3-3-3-3-3 3M11 7l3-3M9 9l3 3"/>',
    book:     '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    search:   '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    shield:   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    zap:      '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    chart:    '<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>',
    clock:    '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    ruler:    '<path d="M3 15 15 3l6 6L9 21z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>',
    star:     '<path d="m12 2 3 6.5 7 .9-5 4.8 1.2 7L12 18l-6.2 3.2L7 14.2 2 9.4l7-.9z"/>',
    /* 校徽用的蛐蛐标记：触须 + 分节的身体 */
    cricket:  '<circle cx="12" cy="14" r="6"/><path d="M9.2 9.6 6 4.5M14.8 9.6 18 4.5M8 16h8M10 13h4"/>'
  };

  /* -------------------------------------------------- 游戏数据字形（单色） */
  /* 这些原本是 emoji；换成自绘笔触图形之后，界面才和纸/墨的配色统一。 */
  var GLYPHS = {
    /* 六种攻击属性 */
    '粉笔': '<path d="M5.5 14.5 14 6a3.5 3.5 0 0 1 5 5l-8.5 8.5H5.5z"/><path d="M12.5 7.5 16.5 11.5"/>',
    '作业': '<path d="M5 3.5h8.5L18 8v12.5H5z"/><path d="M13 3.5V8h5M8 12h7M8 15.5h7"/>',
    '考试': '<rect x="4.5" y="3" width="15" height="18" rx="1.5"/><path d="M8 9.5l2 2 4.5-4.5M8 16h7"/>',
    '拖堂': '<circle cx="12" cy="12.5" r="8"/><path d="M12 8.5v4l2.5 2M9 2h6"/>',
    '零食': '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8.5 3.5c0 1.5 1.5 1.5 1.5 3M12 2.5c0 1.5 1.5 1.5 1.5 3"/>',
    '规则': '<path d="M5.5 3.5h9L18.5 8v12.5h-13z"/><path d="M8 9h6M8 12h6M8 15h3"/><circle cx="15.5" cy="16.5" r="2.5"/>',

    /* 六种防御类型 */
    '学霸': '<path d="M12 4 2.5 9 12 14l9.5-5z"/><path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/>',
    '学渣': '<path d="M20 14.5A7.5 7.5 0 1 0 9.5 21 6 6 0 0 1 20 14.5z"/><path d="M17.5 4.5 19 6M19 3l1.5 1.5"/>',
    '教师': '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M7 8h6M7 11h4M12 16v4M8 20h8"/>',
    '体育生': '<circle cx="15.5" cy="5" r="2"/><path d="M13 9.5 9.5 12l1.5 4-3 5M13 9.5l4 1.5 2.5 4M13 9.5 8 8"/>',
    '艺术生': '<path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2s-.6-2-.6-3 .7-1.5 2-1.5H18a3 3 0 0 0 3-3c0-4.7-4-8.5-9-8.5z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
    '食堂': '<path d="M3.5 10.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M2 20h20M5 6.5 3.5 3M12 6V2.5M19 6.5 20.5 3"/>',

    /* 五种角色类型 */
    '虚构': '<path d="M3.5 7.5c3-2 5-2 8.5 0 3.5-2 5.5-2 8.5 0v6c-3 2-5 2-8.5 0-3.5 2-5.5 2-8.5 0z"/><path d="M8 11h.01M16 11h.01"/>',
    '导师': '<circle cx="12" cy="6" r="3"/><path d="M5.5 21v-1.5a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5V21"/>',
    '校领导': '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M8 21v-6M12 21v-6M16 21v-6M4 9h16"/>',
    '同学': '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18v14H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h7A1.5 1.5 0 0 1 18 4.5V6M8 11h6M8 15h4"/>',
    '网络梗': '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L4 20.5l1.4-4.6A8.5 8.5 0 1 1 21 11.5z"/><path d="M9 11h.01M12.5 11h.01M16 11h.01"/>'
  };

  function build(box, body) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  }

  /* 返回一个 <svg> DOM 节点，尺寸由 CSS 控制 */
  UI.icon = function (name, cls) {
    var body = ICONS[name];
    if (!body) { console.warn('[dqq] 没有这个图标:', name); return U.el('span'); }
    var span = U.el('span', { class: 'ico ' + (cls || ''), html: build('icon', body) });
    return span;
  };

  /* 返回图标的内联 HTML 字符串。只在拼接静态标签时用，
   * 千万不要拿它去拼用户输入的内容。 */
  UI.iconHtml = function (name, cls) {
    var body = ICONS[name];
    if (!body) return '';
    return '<span class="ico ' + (cls || '') + '">' + build('icon', body) + '</span>';
  };

  UI.glyphHtml = function (name, cls) {
    var body = GLYPHS[name];
    if (!body) return '';
    return '<span class="ico glyph ' + (cls || '') + '">' + build('glyph', body) + '</span>';
  };

  /* 把字形拼成一张独立完整的 SVG（带纸底和圆环），供需要把它渲染成图片的场景用。
   * 字形数据 GLYPHS 是这个闭包私有的，外面（比如 ui-common 的 glyphToDataUrl）
   * 拿不到，所以必须由这里提供出口。 */
  UI.glyphSvg = function (name, size, opts) {
    opts = opts || {};
    var body = GLYPHS[name] || GLYPHS['学渣'];
    var s = size || 320;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24">' +
      '<rect width="24" height="24" fill="' + (opts.bg || '#F3EEE2') + '"/>' +
      '<circle cx="12" cy="12" r="11" fill="' + (opts.disc || '#FFFFFF') + '"' +
      ' stroke="' + (opts.ring || '#2E6489') + '" stroke-width="0.5"/>' +
      '<g fill="none" stroke="' + (opts.fg || '#1E3A5F') + '" stroke-width="1.25"' +
      ' stroke-linecap="round" stroke-linejoin="round"' +
      ' transform="translate(4.2,4.2) scale(0.65)">' + body + '</g></svg>';
  };

  UI.HAS_GLYPH_SVG = true;

  /* 游戏数据字形（属性 / 防御类型 / 角色类型） */
  UI.glyph = function (name, cls) {
    var body = GLYPHS[name];
    if (!body) return U.el('span', { class: 'ico ico-empty ' + (cls || '') });
    return U.el('span', { class: 'ico glyph ' + (cls || ''), html: build('glyph', body) });
  };

  /* 图标 + 文字 的常用组合（按钮、标签） */
  UI.iconLabel = function (name, text, cls) {
    return U.el('span', { class: 'ico-label ' + (cls || '') }, [
      UI.icon(name),
      U.el('span', { text: text })
    ]);
  };

  /* 属性/类型的中文名 + 字形，用于徽章 */
  UI.glyphLabel = function (name, cls) {
    return U.el('span', { class: 'glyph-label ' + (cls || '') }, [
      UI.glyph(name),
      U.el('span', { class: 'glyph-text', text: name })
    ]);
  };

  UI.HAS_ICON = function (name) { return !!ICONS[name]; };
  UI.HAS_GLYPH = function (name) { return !!GLYPHS[name]; };

})(typeof globalThis !== 'undefined' ? globalThis : this);
