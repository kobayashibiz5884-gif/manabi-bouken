// 声の聞き取り（iPhoneのSafariの機能を使う）。うまく動かない端末・開き方があるので、失敗を前提に作る。
(function (root) {
  'use strict';
  var SR = root.SpeechRecognition || root.webkitSpeechRecognition || null;
  var active = null;

  function supported() { return !!SR; }
  function standalone() {
    return (root.navigator && root.navigator.standalone === true) || (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches);
  }

  // 1回聞き取る。
  // opts: { lang:'ja-JP'|'en-US', timeout:ミリ秒, onHeard:(texts, isFinal)=>true を返すとそこで終了 }
  // 返り値 Promise<{ texts:[...最後に聞こえた候補], all:[...途中経過も含む全部], error:null|文字列, accepted:bool }>
  function listen(opts) {
    opts = opts || {};
    stop();
    return new Promise(function (resolve) {
      if (!SR) { resolve({ texts: [], all: [], error: 'unsupported', accepted: false }); return; }
      var rec, done = false, texts = [], all = [], error = null, accepted = false, timer = null, guard = null;
      function finish() {
        if (done) return; done = true;
        clearTimeout(timer); clearTimeout(guard);
        if (active && active.rec === rec) active = null;
        resolve({ texts: texts, all: all, error: error, accepted: accepted });
      }
      function halt() {
        try { rec.stop(); } catch (e) {}
        // stop しても onend が来ない端末があるので、少し待って必ず終わらせる
        clearTimeout(guard);
        guard = setTimeout(function () { try { rec.abort(); } catch (e) {} finish(); }, 1200);
      }
      try {
        rec = new SR();
        rec.lang = opts.lang || 'ja-JP';
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 5;
      } catch (e) { resolve({ texts: [], all: [], error: 'unsupported', accepted: false }); return; }
      rec.onresult = function (ev) {
        var cur = [], fin = false;
        // 端末によって、結果が1つにまとまる場合と、こま切れに分かれる場合がある。両方を候補にする
        var joined = '';
        for (var i = 0; i < ev.results.length; i++) {
          var r = ev.results[i];
          if (r.isFinal) fin = true;
          for (var j = 0; j < r.length; j++) { var t = (r[j].transcript || '').trim(); if (t && cur.indexOf(t) < 0) cur.push(t); }
          if (r[0]) joined += r[0].transcript || '';
        }
        joined = joined.trim();
        if (joined && cur.indexOf(joined) < 0) cur.push(joined);
        if (!cur.length) return;
        texts = cur;
        cur.forEach(function (t) { if (all.indexOf(t) < 0) all.push(t); });
        if (opts.onHeard && opts.onHeard(cur, fin)) { accepted = true; halt(); }
      };
      rec.onerror = function (ev) { error = ev.error || 'error'; if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'audio-capture') finish(); };
      rec.onend = finish;
      active = { rec: rec, finish: finish, halt: halt };
      // 直前の聞き取りが完全に終わっていないと start に失敗することがあるので、少し待って3回までやり直す
      var tries = 0;
      (function begin() {
        if (done) return;
        try { rec.start(); timer = setTimeout(halt, opts.timeout || 8000); }
        catch (e) {
          if (++tries >= 3) { error = 'start-failed'; finish(); return; }
          setTimeout(begin, 350);
        }
      })();
    });
  }
  function stop() {
    if (active) { var a = active; active = null; try { a.rec.abort(); } catch (e) {} a.finish(); }
  }

  root.MB = root.MB || {};
  root.MB.speech = { supported: supported, standalone: standalone, listen: listen, stop: stop };
})(typeof self !== 'undefined' ? self : globalThis);
