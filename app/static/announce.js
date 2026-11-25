/* 全站公告 —— 雾蓝 · 克制版（由 nginx 注入到所有 HTML 页面） */
(function () {
  if (window.__announceLoaded) return;
  window.__announceLoaded = true;
  window.__ANNOUNCE_VER__ = '8-quiet';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(s) {
    var m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? (+m[2]) + ' 月 ' + (+m[3]) + ' 日' : '';
  }

  var E = 'cubic-bezier(.32,.72,0,1)';
  var CSS =
    '#__an_ov{--bg:rgba(238,242,246,.45);--card:rgba(250,252,254,.78);--ink:#16212c;--ink2:#4a5a6a;--ink3:#8a98a7;--line:rgba(22,33,44,.1);--tint:#2f4a63;' +
      '--hi:rgba(255,255,255,.9);--sh:0 1px 2px rgba(22,33,44,.06),0 30px 70px -28px rgba(30,50,72,.4);' +
      'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;' +
      'background:var(--bg);-webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%);' +
      'opacity:0;transition:opacity .45s ' + E + ';' +
      'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}' +
    '@media (prefers-color-scheme:dark){#__an_ov{--bg:rgba(8,12,17,.5);--card:rgba(24,32,42,.82);--ink:#e6edf3;--ink2:#a8b6c4;--ink3:#64748a;' +
      '--line:rgba(230,237,243,.1);--tint:#b4cbe0;--hi:rgba(210,226,240,.14);--sh:0 30px 70px -28px rgba(0,0,0,.85)}}' +
    '#__an_ov.in{opacity:1}' +
    '#__an_box{width:100%;max-width:380px;max-height:76vh;display:flex;flex-direction:column;border-radius:26px;overflow:hidden;color:var(--ink);' +
      'background:var(--card);-webkit-backdrop-filter:blur(30px) saturate(170%);backdrop-filter:blur(30px) saturate(170%);' +
      'box-shadow:inset 0 1px 0 var(--hi),inset 0 0 0 .5px var(--line),var(--sh);' +
      'transform:translateY(10px) scale(.97);opacity:0;transition:transform .55s ' + E + ',opacity .4s ' + E + '}' +
    '#__an_ov.in #__an_box{transform:none;opacity:1}' +
    '#__an_ov.out{opacity:0;transition-duration:.3s}#__an_ov.out #__an_box{transform:scale(.98);opacity:0;transition-duration:.25s}' +
    '#__an_hd{display:flex;justify-content:space-between;align-items:baseline;padding:24px 26px 0;font-size:12.5px;letter-spacing:.02em}' +
    '#__an_ey{color:var(--tint);font-weight:600}#__an_dt{color:var(--ink3);font-variant-numeric:tabular-nums}' +
    '#__an_tt{padding:10px 26px 0;font-size:21px;font-weight:650;letter-spacing:-.025em;line-height:1.3}' +
    '#__an_bd{margin:12px 0 0;padding:0 26px 22px;overflow:auto;font-size:15px;line-height:1.75;color:var(--ink2);white-space:pre-wrap;word-break:break-word}' +
    '#__an_ok{display:block;width:100%;height:52px;border:0;border-top:.5px solid var(--line);background:transparent;cursor:pointer;' +
      'font:inherit;font-size:16px;font-weight:600;color:var(--tint);transition:background .2s}' +
    '#__an_ok:hover{background:rgba(127,140,155,.08)}#__an_ok:active{background:rgba(127,140,155,.16)}' +
    '#__an_hd,#__an_tt,#__an_bd{opacity:0;transform:translateY(6px);transition:opacity .5s ' + E + ',transform .5s ' + E + '}' +
    '#__an_ov.in #__an_hd{opacity:1;transform:none;transition-delay:.08s}' +
    '#__an_ov.in #__an_tt{opacity:1;transform:none;transition-delay:.13s}' +
    '#__an_ov.in #__an_bd{opacity:1;transform:none;transition-delay:.18s}' +
    '@media (max-width:520px){#__an_ov{align-items:flex-end;padding:0 10px calc(10px + env(safe-area-inset-bottom))}#__an_box{max-width:none;border-radius:28px}' +
      '#__an_box{transform:translateY(40px)}}' +
    '@media (prefers-reduced-motion:reduce){#__an_ov,#__an_ov *{transition-duration:.01ms!important}}';

  function show(d) {
    if (document.getElementById('__an_ov')) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var ov = document.createElement('div');
    ov.id = '__an_ov';
    var dt = fmtDate(d.updated);
    ov.innerHTML =
      '<div id="__an_box" role="dialog" aria-modal="true" aria-labelledby="__an_tt">' +
        '<div id="__an_hd"><span id="__an_ey">公告</span>' + (dt ? '<span id="__an_dt">' + esc(dt) + '</span>' : '') + '</div>' +
        '<div id="__an_tt">' + esc(d.title || '公告') + '</div>' +
        '<div id="__an_bd">' + esc(d.content || '') + '</div>' +
        '<button id="__an_ok" type="button">知道了</button>' +
      '</div>';
    (document.body || document.documentElement).appendChild(ov);
    requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('in'); }); });
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      try { localStorage.setItem('__announce_seen', String(d.id || '')); } catch (e) {}
      ov.classList.add('out'); ov.classList.remove('in');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { ov.remove(); st.remove(); }, 400);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.getElementById('__an_ok').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);
  }

  function gatePending() {
    if (window.__HUMAN_GATE_PENDING__) return true;
    var g = document.getElementById('gate');
    return !!(g && g.classList.contains('show'));
  }
  function afterGate(cb, tries) {
    tries = tries || 0;
    if (gatePending() && tries < 240) { setTimeout(function () { afterGate(cb, tries + 1); }, 500); return; }
    if (document.getElementById('intro') && tries < 260) { setTimeout(function () { afterGate(cb, tries + 1); }, 300); return; }
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
          afterGate(function () { show(d); });
        })
        .catch(function () {});
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
