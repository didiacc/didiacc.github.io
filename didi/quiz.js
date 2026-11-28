/* 砥砥 DiDi — 健檢小工具（不收資料，結果直接在網頁上算，需要幫忙就帶入 LINE 訊息） */
(function () {
  var LINE_ADD = 'https://lin.ee/uncbnNn';
  var LINE_MSG = function (t) { return 'https://line.me/R/oaMessage/@352evqff/?' + encodeURIComponent(t); };
  var LOGO = 'https://storage.tally.so/15f08a0e-2e7d-45c5-81b5-8850ad848696/3b6b2e92-3fc7-4435-8cf2-8c1308ee2669.png';
  var QR = 'line-qr.png';
  var KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
  // 接收資料的 Google Apps Script 網址（存進砥砥的 Google 試算表）
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwTcJOLMqhNqIf32fsMb8Dt3feXExqn7UaKcEyhh49HsDIXAIC4aaq-K6p34nLpSdJn/exec';

  function record(data, beacon) {
    if (!ENDPOINT) return;
    var body = JSON.stringify(data);
    try {
      if (beacon && navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=utf-8' }))) return;
      fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: true });
    } catch (e) { /* 記錄失敗不影響使用 */ }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function two(n) { return (n < 10 ? '0' : '') + n; }

  // 手機才能直接打開 LINE 帶入訊息；電腦打開會被 LINE 導到首頁，所以電腦改用 QR Code
  var UA = navigator.userAgent;
  var MOBILE = /Android|iPhone|iPad|iPod|Mobile|Line\//i.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));

  // 在 el 裡畫一個 QR Code：手機掃了會打開砥砥的 LINE 並帶入訊息；畫不出來就改放加好友的 QR Code
  function qrInto(el, url) {
    var fallback = function () { el.innerHTML = '<img class="qr" src="' + QR + '" alt="砥砥 DiDi LINE 官方帳號 QR Code">'; };
    var draw = function () {
      try {
        var q = qrcode(0, 'L'); q.addData(url); q.make();
        el.innerHTML = '<img class="qr" style="width:260px;max-width:80%;image-rendering:pixelated" src="' + q.createDataURL(4, 3) + '" alt="用手機 LINE 掃描，打開砥砥的 LINE">';
      } catch (e) { fallback(); }
    };
    if (window.qrcode) return draw();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    s.onload = draw; s.onerror = fallback;
    document.head.appendChild(s);
  }

  function copyText(text, done) {
    var old = function () {
      var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
      document.body.removeChild(t); done();
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, old); else old();
  }

  window.DIDI = { LINE_ADD: LINE_ADD, LINE_MSG: LINE_MSG, LOGO: LOGO, QR: QR, esc: esc, record: record, MOBILE: MOBILE, qrInto: qrInto, copyText: copyText };

  window.runQuiz = function (cfg) {
    var app = document.getElementById('app');
    var st = { ans: cfg.questions.map(function () { return null; }), help: null };
    var history = [];
    var current = null;
    var rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    function payload(line) {
      var t = tier();
      return {
        type: 'quiz',
        id: rid,
        quiz: cfg.shortName,
        answers: st.ans.map(function (a, i) { return a == null ? '' : KEYS[a] + ' ' + cfg.questions[i].opts[a]; }),
        score: pct(),
        tier: t ? (t.name || t.html.replace(/<[^>]+>/g, '')) : '',
        help: st.help == null ? '' : cfg.helpOpts[st.help],
        picks: [],
        other: '',
        line: !!line
      };
    }

    function score() {
      return st.ans.reduce(function (s, a) { return s + (a === 0 ? 2 : a === 1 ? 1 : 0); }, 0);
    }
    // 顯示用：換算成 100 分（結果分段仍用原始分數判斷）
    function pct() { return Math.round(score() / (cfg.questions.length * 2) * 100); }
    function tier() {
      var s = score();
      for (var i = 0; i < cfg.tiers.length; i++) if (s >= cfg.tiers[i].min && s <= cfg.tiers[i].max) return cfg.tiers[i];
    }
    function logo() { return '<img class="logo" src="' + LOGO + '" alt="砥砥 DiDi">'; }
    function back() { return history.length ? '<button type="button" class="back" data-act="back">← 返回</button>' : ''; }

    function go(name, push) {
      if (push !== false && current) history.push(current);
      current = name;
      app.innerHTML = logo() + (/^end/.test(name) ? '' : back()) + screens[name]();
      window.scrollTo(0, 0);
      bind();
      if (name === 'result' && !MOBILE) qrInto(document.getElementById('qrbox'), LINE_MSG(message()));
    }

    function radioQ(id, title, opts, chosen) {
      var h = '<fieldset class="q" id="' + id + '"><legend>' + esc(title) + '<span class="req">*</span></legend>';
      opts.forEach(function (o, i) {
        h += '<label class="opt' + (chosen === i ? ' on' : '') + '"><input type="radio" name="' + id + '" value="' + i + '"' +
          (chosen === i ? ' checked' : '') + '><span class="key">' + KEYS[i] + '</span><span>' + esc(o) + '</span></label>';
      });
      return h + '<p class="err" hidden>請選一個答案</p></fieldset>';
    }

    var screens = {
      intro: function () {
        return '<h1>' + esc(cfg.title) + '</h1>' + cfg.introHtml +
          '<div class="actions"><button class="btn" data-act="next">下一步 →</button></div>';
      },
      quiz: function () {
        var h = cfg.separateIntro ? '' : '<h1>' + esc(cfg.title) + '</h1>' + cfg.introHtml;
        cfg.questions.forEach(function (q, i) { h += radioQ('q' + i, two(i + 1) + '｜' + q.q, q.opts, st.ans[i]); });
        return h + '<div class="actions"><button class="btn" data-act="next">下一步 →</button></div>' +
          '<p class="note">※ 答案不記名，用來了解老闆們最常遇到的問題。</p>';
      },
      result: function () {
        var t = tier();
        var h = '<p class="score"><strong>' + esc(cfg.scoreLabel) + pct() + ' 分</strong></p>';
        h += '<div class="tier">' + t.html + '</div>';
        var good = [], bad = [];
        st.ans.forEach(function (a, i) { if (a === 0) good.push(i); else bad.push(i); });
        h += '<div class="lines">';
        if (good.length && cfg.goodHeading) h += '<p><strong>' + esc(cfg.goodHeading) + '</strong></p>';
        good.forEach(function (i) { h += cfg.goodHtml(i); });
        if (bad.length && cfg.improveHeading) h += '<p style="margin-top:16px"><strong>' + esc(cfg.improveHeading) + '</strong></p>';
        bad.forEach(function (i) { h += cfg.improveHtml(i); });
        h += '</div><p class="note">' + esc(cfg.disclaimer) + '</p>';
        // 需要幫忙就直接加 LINE；不需要的人看完關掉就好
        if (!MOBILE) {
          h += '<div id="cta"><p style="margin-top:28px"><strong>需要砥砥幫忙？用手機 LINE 掃描下面的 QR Code 👇</strong></p>' +
            '<p class="muted">掃描後會打開砥砥的 LINE，並帶入你的健檢結果，按「傳送」砥砥就收到了。</p>' +
            '<div id="qrbox"></div>' +
            '<div class="actions" style="margin-top:12px"><button type="button" class="btn ghost" data-act="copy">複製我的健檢結果</button></div>' +
            '<p class="muted" style="margin-top:8px">電腦有裝 LINE 的話，也可以複製後貼到砥砥的 LINE 聊天室。</p></div>';
          return h;
        }
        h += '<div id="cta"><div class="actions"><a class="btn wide" href="' + LINE_ADD + '" target="_blank" rel="noopener" data-act="line">需要砥砥幫忙？加 LINE 聊聊 →</a></div>' +
          '<p class="muted" style="margin-top:12px">按下後會打開砥砥的 LINE，並帶入你的健檢結果，按「傳送」砥砥才會收到。</p></div>';
        return h;
      }
    };

    function thanks() {
      return '<div class="actions"><p><strong>謝謝！在 LINE 按「傳送」，砥砥就收到了 ⛰️</strong></p></div>' +
        '<p class="muted" style="margin-top:8px">如果 LINE 沒有自動打開，可以直接加砥砥的 LINE 官方帳號：<a href="' + LINE_ADD + '" target="_blank" rel="noopener">' + LINE_ADD + '</a></p>';
    }

    function message() {
      var t = tier();
      var bad = [];
      st.ans.forEach(function (a, i) { if (a !== 0) bad.push(i); });
      var m = '你好，我剛做完「' + cfg.shortName + '」，想請砥砥幫忙整理。\n總分：' + pct() + ' 分' + (t.name ? '（' + t.name + '）' : '');
      m += '\n要加強的題目：' + (bad.length ? bad.map(function (i) { return '第 ' + (i + 1) + ' 題' + (cfg.topic ? ' ' + cfg.topic[i] : ''); }).join('、') : '沒有');
      return m;
    }

    function check(ids) {
      var first = null;
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        var ok = !!el.querySelector('input:checked');
        el.classList.toggle('bad', !ok);
        el.querySelector('.err').hidden = ok;
        if (!ok && !first) first = el;
      });
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return !first;
    }

    function bind() {
      app.querySelectorAll('.q input[type=radio]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var fs = inp.closest('.q');
          fs.querySelectorAll('.opt').forEach(function (l) { l.classList.remove('on'); });
          inp.closest('.opt').classList.add('on');
          fs.classList.remove('bad');
          fs.querySelector('.err').hidden = true;
          st.ans[+fs.id.slice(1)] = +inp.value;
        });
      });

      app.querySelectorAll('[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.getAttribute('data-act');
          if (act === 'back') { current = null; go(history.pop(), false); return; }
          if (act === 'line') {
            st.help = 0; // 需要
            record(payload(true), true);
            b.href = LINE_MSG(message());
            setTimeout(function () { var c = document.getElementById('cta'); if (c) c.innerHTML = thanks(); }, 300);
            return;
          }
          if (act === 'copy') {
            copyText(message(), function () { b.textContent = '已複製 ✓'; });
            if (st.help !== 0) { st.help = 0; record(payload(false)); } // 電腦版：按複製就當作「需要」
            return;
          }
          if (act === 'next') {
            if (current === 'intro') return go('quiz');
            if (current === 'quiz') {
              if (!check(cfg.questions.map(function (_, i) { return 'q' + i; }))) return;
              record(payload(false));
              return go('result');
            }
          }
        });
      });
    }

    go(cfg.separateIntro ? 'intro' : 'quiz');
  };
})();
