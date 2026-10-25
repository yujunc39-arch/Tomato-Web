/* 全站公告弹窗 —— 由 nginx 注入到所有 HTML 页面(主站/用户空间/后台) */
(function () {
  if (window.__announceLoaded) return;
  window.__announceLoaded = true;
  window.__ANNOUNCE_VER__ = '4-glass';   // 版本标记，便于确认浏览器加载的是新脚本

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function show(d) {
    if (document.getElementById('__announce_ov')) return;
    var ov = document.createElement('div');
    ov.id = '__announce_ov';
    ov.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;' +
      'background:rgba(238,238,242,.2);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
    ov.innerHTML =
      '<div id="__announce_box" style="position:relative;max-width:430px;width:100%;max-height:80vh;' +
      'overflow:auto;border-radius:26px;padding:22px;background:transparent;' +
      '-webkit-backdrop-filter:blur(1.6px) saturate(1.38);backdrop-filter:blur(1.6px) saturate(1.38);' +
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.55),inset 0 1px 0 rgba(255,255,255,.85),' +
      'inset 0 -1px 0 rgba(255,255,255,.5),inset 0 -14px 26px -20px rgba(105,100,120,.28),' +
      '0 0 0 1px rgba(255,255,255,.35),0 22px 48px -26px rgba(105,100,120,.35)">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
      '<span style="font-size:19px">📢</span>' +
      '<span style="font-size:17px;font-weight:700;color:#3c3b44">' + esc(d.title || '公告') + '</span></div>' +
      '<div style="font-size:14px;color:rgba(53,52,58,.82);line-height:1.8;white-space:pre-wrap;word-break:break-word">' +
      esc(d.content || '') + '</div>' +
      '<div style="margin-top:16px;text-align:right">' +
      '<button id="__announce_ok" style="border:0;border-radius:14px;padding:10px 20px;font-size:14px;' +
      'font-weight:600;cursor:pointer;color:#3a3942;font-family:inherit;background:rgba(255,255,255,.18);' +
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.7),inset 0 1px 0 rgba(255,255,255,.95),' +
      '0 8px 18px -14px rgba(105,100,120,.6)">我知道了</button></div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(ov);
    // 若站点已加载液态玻璃实现，则让公告卡也走折射
    try {
      var box = document.getElementById('__announce_box');
      if (box && window.LiquidGlass && window.LiquidGlass.attach) {
        window.LiquidGlass.attach(box, { rim: 0.22, amount: 0.52, radius: 0.34, blur: 1.6, saturate: 1.38, contrast: 1.03, brightness: 1.0 });
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
