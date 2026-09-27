/* =========================================================================
 * 附中·电子斗蛐蛐  工具层
 * 随机数、DOM 小助手、提示条、弹窗。
 * ========================================================================= */
(function (root) {
  'use strict';
  var DQQ = (root.DQQ = root.DQQ || {});

  var U = (DQQ.util = {});

  /* ------------------------------------------------------------------ 随机 */
  U.randInt = function (min, max) {
    if (max < min) { var t = min; min = max; max = t; }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  U.randFloat = function (min, max) {
    return Math.random() * (max - min) + min;
  };

  /* 支持传区间数组 [a,b] 或单个数字 */
  U.rangePick = function (spec) {
    if (spec == null) return 0;
    if (Array.isArray(spec)) return U.randInt(Math.round(spec[0]), Math.round(spec[1]));
    return Math.round(spec);
  };

  U.pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };

  U.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  };

  /* items: [{ weight: n, ... }] */
  U.weightedPick = function (items) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += (items[i].weight || 0);
    if (total <= 0) return items[0];
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= (items[i].weight || 0);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  /* ------------------------------------------------------------------ 数值 */
  U.clamp = function (v, min, max) {
    return v < min ? min : (v > max ? max : v);
  };

  U.round1 = function (v) {
    return Math.round(v * 10) / 10;
  };

  U.deepClone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  /* ------------------------------------------------------------------ 杂项 */
  var uidCounter = 0;
  U.uid = function (prefix) {
    uidCounter += 1;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + uidCounter.toString(36);
  };

  U.escapeHtml = function (str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  U.todayStr = function () {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  };

  U.percent = function (v) {
    return Math.round(v * 100) + '%';
  };

  /* -------------------------------------------------------------------- DOM */
  U.$ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  U.$$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  U.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  };

  /* ------------------------------------------------------------------ 提示 */
  var toastHost = null;
  U.toast = function (msg, kind) {
    if (!toastHost) {
      toastHost = U.el('div', { class: 'toast-host' });
      document.body.appendChild(toastHost);
    }
    var node = U.el('div', { class: 'toast toast-' + (kind || 'info'), text: msg });
    toastHost.appendChild(node);
    setTimeout(function () { node.classList.add('toast-out'); }, 2200);
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 2600);
  };

  /* ---------------------------------------------------------------- 模态框 */
  /* 返回一个 { close } 句柄，点击遮罩或按 Esc 关闭 */
  U.modal = function (opts) {
    var overlay = U.el('div', { class: 'modal-overlay' });
    var box = U.el('div', { class: 'modal-box' + (opts.wide ? ' modal-wide' : '') });

    var header = U.el('div', { class: 'modal-head' }, [
      U.el('h3', { text: opts.title || '' }),
      U.el('button', { class: 'modal-close', text: '✕', title: '关闭', onclick: close })
    ]);
    var body = U.el('div', { class: 'modal-body' });
    var footer = U.el('div', { class: 'modal-foot' });

    box.appendChild(header);
    box.appendChild(body);
    box.appendChild(footer);
    overlay.appendChild(box);

    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (opts.onClose) opts.onClose();
    }
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);

    var handle = { overlay: overlay, body: body, footer: footer, close: close, box: box };
    if (opts.render) opts.render(handle);
    return handle;
  };

  U.confirm = function (message, onYes, opts) {
    opts = opts || {};
    U.modal({
      title: opts.title || '确认一下',
      render: function (m) {
        m.body.appendChild(U.el('p', { class: 'confirm-text', text: message }));
        m.footer.appendChild(U.el('button', {
          class: 'btn btn-ghost', text: opts.cancelText || '取消', onclick: m.close
        }));
        m.footer.appendChild(U.el('button', {
          class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'),
          text: opts.yesText || '确定',
          onclick: function () { m.close(); onYes(); }
        }));
      }
    });
  };

  /* -------------------------------------------------------------- 文件读取 */
  U.readImageFile = function (file, maxSize, cb) {
    if (!file || !/^image\//.test(file.type)) {
      cb(new Error('请选择图片文件'));
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        // 统一压缩，避免 localStorage 被撑爆（上限默认 512px / 约 200KB）
        var limit = maxSize || 512;
        var scale = Math.min(1, limit / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var isPng = /png/i.test(file.type);
        cb(null, canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.82));
      };
      img.onerror = function () { cb(new Error('图片解析失败')); };
      img.src = e.target.result;
    };
    reader.onerror = function () { cb(new Error('文件读取失败')); };
    reader.readAsDataURL(file);
  };

  U.download = function (filename, dataUrlOrText, isText) {
    var a = document.createElement('a');
    if (isText) {
      a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(dataUrlOrText);
    } else {
      a.href = dataUrlOrText;
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  U.copyText = function (text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); U.toast(okMsg || '已复制到剪贴板', 'ok'); }
      catch (e) { U.toast('复制失败，请手动选中复制', 'err'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        U.toast(okMsg || '已复制到剪贴板', 'ok');
      }, fallback);
    } else {
      fallback();
    }
  };

  /* 按速度排序行动顺序，速度相同随机先后 */
  U.orderBySpeed = function (a, b) {
    if (b.speed !== a.speed) return b.speed - a.speed;
    return Math.random() < 0.5 ? -1 : 1;
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
