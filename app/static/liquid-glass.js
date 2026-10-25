/*!
 * Liquid Glass —— 参考 shuding/liquid-glass 与 childrentime/liquid-glass 的实现
 * 用 SDF 计算每像素位移 → canvas 编码成 R/G 位移贴图 → feDisplacementMap 交给 backdrop-filter
 * 位移方向朝内（放大），不会采样到元素外部，因此不会产生黑边
 */
(function (global) {
  var NS = 'http://www.w3.org/2000/svg';
  var seq = 0;

  function smoothStep(a, b, t) {
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  function roundedRectSDF(x, y, w, h, r) {
    var qx = Math.abs(x) - w + r;
    var qy = Math.abs(y) - h + r;
    return Math.min(Math.max(qx, qy), 0) + len(Math.max(qx, 0), Math.max(qy, 0)) - r;
  }

  /* 默认扭曲：边缘向内收，中心不动 */
  function makeFragment(o) {
    return function (uv) {
      var ix = uv.x - 0.5;
      var iy = uv.y - 0.5;
      var d = roundedRectSDF(ix, iy, 0.5, 0.5, o.radius);   // 归一化后的圆角矩形距离场
      var rim = smoothStep(o.rim, 0, d + o.rim * 0.35);     // 越靠边越强
      var amt = 1 - rim * o.amount;                          // <1 → 向中心放大
      return { x: ix * amt + 0.5, y: iy * amt + 0.5, rim: rim };
    };
  }

  function attach(el, opts) {
    opts = opts || {};
    if (!el) return null;
    if (el.__lg) { el.__lg.render(); return el.__lg; }

    var o = {
      rim: opts.rim == null ? 0.16 : opts.rim,            // 折射带厚度（相对短边）
      amount: opts.amount == null ? 0.22 : opts.amount,    // 边缘最大压缩量
      radius: opts.radius == null ? 0.34 : opts.radius,    // 圆角（归一化）
      blur: opts.blur == null ? 0.4 : opts.blur,
      saturate: opts.saturate == null ? 1.7 : opts.saturate,
      contrast: opts.contrast == null ? 1.05 : opts.contrast,
      brightness: opts.brightness == null ? 1.02 : opts.brightness,
      onMouse: !!opts.onMouse
    };

    var id = 'lg' + (++seq);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:-1';
    var defs = document.createElementNS(NS, 'defs');
    var filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', id + '_filter');
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    var feImage = document.createElementNS(NS, 'feImage');
    feImage.setAttribute('result', 'MAP');
    var disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'MAP');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    filter.appendChild(feImage);
    filter.appendChild(disp);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);

    var canvas = document.createElement('canvas');
    var st = { w: 0, h: 0, mouse: { x: 0.5, y: 0.5 } };
    var frag = makeFragment(o);

    function render() {
      var r = el.getBoundingClientRect();
      var w = Math.round(r.width), h = Math.round(r.height);
      if (w < 12 || h < 12) return;
      if (st.w === w && st.h === h && st.rendered) return;
      st.w = w; st.h = h;
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      var img = ctx.createImageData(w, h);
      var data = img.data;
      var N = w * h;
      var dxs = new Float32Array(N), dys = new Float32Array(N);
      var maxScale = 0, i, x, y;

      for (i = 0; i < N; i++) {
        x = i % w; y = (i / w) | 0;
        var pos = frag({ x: x / w, y: y / h });
        var dx = pos.x * w - x;
        var dy = pos.y * h - y;
        dxs[i] = dx; dys[i] = dy;
        if (Math.abs(dx) > maxScale) maxScale = Math.abs(dx);
        if (Math.abs(dy) > maxScale) maxScale = Math.abs(dy);
      }
      if (maxScale < 1) maxScale = 1;
      var half = maxScale * 0.5;
      for (i = 0; i < N; i++) {
        var p = i * 4;
        data[p] = Math.max(0, Math.min(255, (dxs[i] / half + 0.5) * 255));
        data[p + 1] = Math.max(0, Math.min(255, (dys[i] / half + 0.5) * 255));
        data[p + 2] = 0;
        data[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);

      var url = canvas.toDataURL();
      feImage.setAttribute('x', '0');
      feImage.setAttribute('y', '0');
      feImage.setAttribute('width', w);
      feImage.setAttribute('height', h);
      feImage.setAttribute('preserveAspectRatio', 'none');
      feImage.setAttribute('href', url);
      feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
      filter.setAttribute('x', '0');
      filter.setAttribute('y', '0');
      filter.setAttribute('width', w);
      filter.setAttribute('height', h);
      disp.setAttribute('scale', half);

      var bd = 'url(#' + id + '_filter) blur(' + o.blur + 'px) contrast(' + o.contrast +
        ') brightness(' + o.brightness + ') saturate(' + o.saturate + ')';
      el.style.webkitBackdropFilter = bd;
      el.style.backdropFilter = bd;
      st.rendered = true;
    }

    render();
    window.addEventListener('load', render);
    var t = null;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(render, 180); });
    if (global.ResizeObserver) {
      try { new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { st.rendered = false; render(); }, 80); }).observe(el); } catch (e) {}
    }

    el.__lg = { opt: o, render: render, state: st, id: id };
    return el.__lg;
  }

  global.LiquidGlass = {
    attach: attach,
    attachAll: function (sel, opts) {
      var list = document.querySelectorAll(sel || '.glass');
      for (var i = 0; i < list.length; i++) attach(list[i], opts);
    }
  };
})(window);
