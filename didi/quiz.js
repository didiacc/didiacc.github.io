/* 砥砥 DiDi — 健檢小工具（不收資料，結果直接在網頁上算，需要幫忙就帶入 LINE 訊息） */
(function () {
  var LINE_ADD = 'https://lin.ee/uncbnNn';
  var LINE_MSG = function (t) { return 'https://line.me/R/oaMessage/@352evqff/?' + encodeURIComponent(t); };
  var LOGO = 'https://storage.tally.so/15f08a0e-2e7d-45c5-81b5-8850ad848696/3b6b2e92-3fc7-4435-8cf2-8c1308ee2669.png';
  var QR = 'line-qr.png';
  var KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
  // 所有健檢（順序跟首頁一樣）；結束頁會列出「其他」健檢
  var CHECKS = [
    ['帳務健檢', 'books-check.html'],
    ['庫存健檢', 'inventory-check.html'],
    ['薪資健檢', 'salary-check.html'],
    ['出納健檢', 'cashier-check.html'],
    ['財產健檢', 'property-check.html']
  ];
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

  window.DIDI = { LINE_ADD: LINE_ADD, LINE_MSG: LINE_MSG, LOGO: LOGO, QR: QR, esc: esc, record: record };

  window.runQuiz = function (cfg) {
    var app = document.getElementById('app');
    var st = { ans: cfg.questions.map(function () { return null; }), help: null, picks: [], other: '' };
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
        score: score(),
        tier: t ? (t.name || t.html.replace(/<[^>]+>/g, '')) : '',
        help: st.help == null ? '' : cfg.helpOpts[st.help],
        picks: cfg.pick ? st.picks.map(function (i) { return i === cfg.pick.opts.length ? '其他' : cfg.pick.opts[i]; }) : [],
        other: st.other.trim(),
        line: !!line
      };
    }

    function score() {
      return st.ans.reduce(function (s, a) { return s + (a === 0 ? 2 : a === 1 ? 1 : 0); }, 0);
    }
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
        var h = '<p class="score"><strong>' + esc(cfg.scoreLabel) + score() + ' 分</strong></p>';
        h += '<div class="tier">' + t.html + '</div>';
        var good = [], bad = [];
        st.ans.forEach(function (a, i) { if (a === 0) good.push(i); else bad.push(i); });
        h += '<div class="lines">';
        if (good.length && cfg.goodHeading) h += '<p><strong>' + esc(cfg.goodHeading) + '</strong></p>';
        good.forEach(function (i) { h += cfg.goodHtml(i); });
        if (bad.length && cfg.improveHeading) h += '<p style="margin-top:16px"><strong>' + esc(cfg.improveHeading) + '</strong></p>';
        bad.forEach(function (i) { h += cfg.improveHtml(i); });
        h += '</div><p class="note">' + esc(cfg.disclaimer) + '</p>';
        if (cfg.separateHelp) {
          h += '<div class="actions"><button class="btn" data-act="next">下一步 →</button></div>';
        } else {
          h += radioQ('help', cfg.helpQ, cfg.helpOpts, st.help);
          h += '<div class="actions"><button class="btn" data-act="next">下一步 →</button></div>';
        }
        return h + more();
      },
      help: function () {
        return radioQ('help', cfg.helpQ, cfg.helpOpts, st.help) +
          '<div class="actions"><button class="btn" data-act="next">下一步 →</button></div>';
      },
      contact: function () {
        var h = cfg.contactTopHtml || '';
        if (cfg.pick) {
          h += '<fieldset class="q" id="pick"><legend>' + esc(cfg.pick.q) + '<span class="req">*</span></legend>';
          cfg.pick.opts.forEach(function (o, i) {
            var on = st.picks.indexOf(i) >= 0;
            h += '<label class="opt' + (on ? ' on' : '') + '"><input type="checkbox" value="' + i + '"' + (on ? ' checked' : '') +
              '><span class="box"></span><span>' + esc(o) + '</span></label>';
          });
          var otherOn = st.picks.indexOf(cfg.pick.opts.length) >= 0;
          h += '<label class="opt' + (otherOn ? ' on' : '') + '"><input type="checkbox" value="' + cfg.pick.opts.length + '"' +
            (otherOn ? ' checked' : '') + '><span class="box"></span><span>其他</span></label>';
          h += '<input type="text" class="other-input" id="other" placeholder="輸入你的答案" value="' + esc(st.other) + '"' +
            (otherOn ? '' : ' hidden') + '>';
          h += '<p class="err" hidden>請至少選一項</p></fieldset>';
        }
        h += cfg.contactLineHtml;
        h += '<div class="actions"><a class="btn wide" href="' + LINE_ADD + '" target="_blank" rel="noopener" data-act="line">用 LINE 傳給砥砥</a></div>';
        h += '<p class="muted" style="margin-top:20px">用電腦看的話，可以用手機掃這個 QR Code 加入砥砥的 LINE 官方帳號：</p>';
        h += '<a href="' + LINE_ADD + '" target="_blank" rel="noopener"><img class="qr" src="' + QR + '" alt="砥砥 DiDi LINE 官方帳號 QR Code"></a>';
        h += '<p class="note">' + esc(cfg.privacy) + '</p>';
        return h;
      },
      endYes: function () { return cfg.endYesHtml + more(); },
      endNo: function () { return cfg.endNoHtml + more(); }
    };

    function more() {
      var h = '<div class="more" style="margin-top:36px;padding-top:24px;border-top:1px solid var(--line)">' +
        '<p><strong>再花 1 分鐘，看看其他地方？</strong></p><div>';
      CHECKS.forEach(function (c) {
        if (c[0] === cfg.shortName) return;
        h += '<a class="btn ghost" href="' + c[1] + '" style="min-height:40px;padding:8px 16px;font-size:15px;margin:0 8px 10px 0">' + c[0] + ' →</a>';
      });
      return h + '</div><p class="muted" style="margin-top:6px"><a href="./">看全部健檢（首頁）→</a></p></div>';
    }

    function message() {
      var t = tier();
      var bad = [];
      st.ans.forEach(function (a, i) { if (a !== 0) bad.push(i); });
      var m = '你好，我剛做完「' + cfg.shortName + '」，想請砥砥幫忙整理。\n總分：' + score() + ' 分' + (t.name ? '（' + t.name + '）' : '');
      if (cfg.pick) {
        var p = st.picks.map(function (i) {
          return i === cfg.pick.opts.length ? '其他' + (st.other.trim() ? '（' + st.other.trim() + '）' : '') : cfg.pick.opts[i];
        });
        m += '\n最想先處理：' + p.join('、');
      }
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
          var v = +inp.value;
          if (fs.id === 'help') st.help = v; else st.ans[+fs.id.slice(1)] = v;
        });
      });
      app.querySelectorAll('#pick input[type=checkbox]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          inp.closest('.opt').classList.toggle('on', inp.checked);
          var v = +inp.value;
          st.picks = st.picks.filter(function (x) { return x !== v; });
          if (inp.checked) st.picks.push(v);
          st.picks.sort(function (a, b) { return a - b; });
          if (v === cfg.pick.opts.length) {
            var o = document.getElementById('other');
            o.hidden = !inp.checked;
            if (inp.checked) o.focus();
          }
          if (st.picks.length) {
            var fs = document.getElementById('pick');
            fs.classList.remove('bad');
            fs.querySelector('.err').hidden = true;
          }
        });
      });
      var other = document.getElementById('other');
      if (other) other.addEventListener('input', function () { st.other = other.value; });

      app.querySelectorAll('[data-act]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          var act = b.getAttribute('data-act');
          if (act === 'back') { current = null; go(history.pop(), false); return; }
          if (act === 'line') {
            if (cfg.pick && !check(['pick'])) { e.preventDefault(); return; }
            record(payload(true), true);
            b.href = LINE_MSG(message());
            setTimeout(function () { go('endYes'); }, 300);
            return;
          }
          if (act === 'next') {
            if (current === 'intro') return go('quiz');
            if (current === 'quiz') {
              if (!check(cfg.questions.map(function (_, i) { return 'q' + i; }))) return;
              record(payload(false));
              return go('result');
            }
            if (current === 'result' && cfg.separateHelp) return go('help');
            if (current === 'result' || current === 'help') {
              if (!check(['help'])) return;
              record(payload(false));
              return go(st.help === 0 ? 'contact' : 'endNo');
            }
          }
        });
      });
    }

    go(cfg.separateIntro ? 'intro' : 'quiz');
  };
})();
