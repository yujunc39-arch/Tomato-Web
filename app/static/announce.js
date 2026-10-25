/* 全站公告弹窗 —— 由 nginx 注入到所有 HTML 页面(主站/用户空间/后台) */
(function () {
  if (window.__announceLoaded) return;
  window.__announceLoaded = true;
  window.__ANNOUNCE_VER__ = '5-adaptive';   // 版本标记，便于确认浏览器加载的是新脚本

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 估算页面背景亮度：优先看 body/html 的底色与渐变，其次看视口中心元素的底色 */
  function pageIsLight() {
    var cols = [];
    function parse(str) {
      if (!str) return;
      var m = str.match(/rgba?\([^)]+\)/g) || [];
      for (var i = 0; i < m.length; i++) {
        var p = m[i].match(/[\d.]+/g);
        if (!p || p.length < 3) continue;
        var a = p.length > 3 ? parseFloat(p[3]) : 1;
        if (a < 0.05) continue;
        cols.push([+p[0], +p[1], +p[2]]);
      }
    }
    [document.documentElement, document.body].forEach(function (el) {
      if (!el) return;
      var cs = getComputedStyle(el);
      parse(cs.backgroundColor);
      parse(cs.backgroundImage);
    });
    if (!cols.length) {
      try {
        var e = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
        while (e && e !== document.documentElement) {
          var cs2 = getComputedStyle(e);
          var bc = cs2.backgroundColor;
          if (bc && bc !== 'rgba(0, 0, 0, 0)' && bc !== 'transparent') { parse(bc); break; }
          if (cs2.backgroundImage && cs2.backgroundImage !== 'none') { parse(cs2.backgroundImage); break; }
          e = e.parentElement;
        }
      } catch (err) {}
    }
    if (!cols.length) return false;              // 判断不了就当暗色（照片背景站点的默认）
    var sum = 0;
    cols.forEach(function (c) {
      sum += (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    });
    return (sum / cols.length) > 0.62;
  }

  function show(d) {
    if (document.getElementById('__announce_ov')) return;
    var light = pageIsLight();
    var theme = light ? {
      boxBg: 'rgba(255,255,255,.72)',
      boxBlur: 'blur(18px) saturate(1.1)',
      boxShadow: '0 28px 60px -30px rgba(90,70,50,.55)',
      title: '#2b2830',
      text: 'rgba(43,40,48,.86)',
      btnBg: 'rgba(255,255,255,.55)',
      btnColor: '#2b2830',
      btnShadow: '0 10px 24px -18px rgba(90,70,50,.5)'
    } : {
      boxBg: 'transparent',
      boxBlur: 'blur(0.4px) saturate(1.38)',
      boxShadow: '0 28px 60px -30px rgba(0,0,0,.6)',
      title: '#ffffff',
      text: 'rgba(255,255,255,.88)',
      btnBg: 'rgba(255,255,255,.10)',
      btnColor: '#ffffff',
      btnShadow: '0 10px 24px -18px rgba(0,0,0,.55)'
    };

    var ov = document.createElement('div');
    ov.id = '__announce_ov';
    ov.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;' +
      'background:transparent;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
    ov.innerHTML =
      '<div id="__announce_box" style="position:relative;max-width:430px;width:100%;max-height:80vh;' +
      'overflow:auto;border-radius:26px;padding:22px;background:' + theme.boxBg + ';' +
      '-webkit-backdrop-filter:' + theme.boxBlur + ';backdrop-filter:' + theme.boxBlur + ';' +
      'box-shadow:' + theme.boxShadow + '">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
      '<span style="font-size:19px">📢</span>' +
      '<span style="font-size:17px;font-weight:700;color:' + theme.title + '">' + esc(d.title || '公告') + '</span></div>' +
      '<div style="font-size:14px;color:' + theme.text + ';line-height:1.8;white-space:pre-wrap;word-break:break-word">' +
      esc(d.content || '') + '</div>' +
      '<div style="margin-top:16px;text-align:right">' +
      '<button id="__announce_ok" style="border:0;border-radius:14px;padding:10px 20px;font-size:14px;' +
      'font-weight:600;cursor:pointer;color:' + theme.btnColor + ';font-family:inherit;background:' + theme.btnBg + ';' +
      'backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);box-shadow:' + theme.btnShadow + '">我知道了</button></div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(ov);
    // 暗色页面（照片背景）额外挂液态玻璃折射；浅色页面用磨砂白底保证可读
    try {
      var box = document.getElementById('__announce_box');
      if (!light && box && window.LiquidGlass && window.LiquidGlass.attach) {
        window.LiquidGlass.attach(box, { band: 0.12, amount: 0.30, radius: 0.34, blur: 0.4, saturate: 1.38, contrast: 1.03, brightness: 1.0 });
      }
    } catch (e) {}
    var btn = document.getElementById('__announce_ok');
    if (btn) btn.onclick = function () {
      try { localStorage.setItem('__announce_seen', String(d.id || '')); } catch (e) {}
      ov.remove();
    };
  }

  // 页面若有真人校验门，先等它通关再弹公告
  // （公告的 z-index 是 2147483647，会盖住验证门，所以必须让路）
  function gatePending() {
    if (window.__HUMAN_GATE_PENDING__) return true;
    var g = document.getElementById('gate');
    return !!(g && g.classList.contains('show'));
  }
  function afterGate(cb, tries) {
    tries = tries || 0;
    if (gatePending() && tries < 240) {          // 最多等 120 秒
      setTimeout(function () { afterGate(cb, tries + 1); }, 500);
      return;
    }
    cb();
  }

  function run() {
    try {
      fetch('/__announce__', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !d.enabled || !d.content) return;
          var seen = null;
          try { seen = localStorage.getItem('__announce_seen'); } catch (e) {}
          if (seen === String(d.id)) return;
          if (document.body) afterGate(function () { show(d); });
          else document.addEventListener('DOMContentLoaded', function () {
            afterGate(function () { show(d); });
          });
        })
        .catch(function () {});
    } catch (e) {}
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', run);
  else
    run();
})();
