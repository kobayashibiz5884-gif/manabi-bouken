// 音: 読み上げ（iPhoneの機械の声）と効果音（その場で作る電子音）。音声ファイルは使わない。
(function (root) {
  'use strict';
  var synth = root.speechSynthesis || null;
  var voices = { ja: null, en: null };
  var ctx = null;
  var speakToken = 0;

  function pickVoices() {
    if (!synth) return;
    var list = synth.getVoices() || [];
    function best(prefix, names) {
      var c = list.filter(function (v) { return (v.lang || '').replace('_', '-').toLowerCase().indexOf(prefix) === 0; });
      if (!c.length) return null;
      for (var i = 0; i < names.length; i++) {
        for (var j = 0; j < c.length; j++) if (c[j].name.indexOf(names[i]) >= 0) return c[j];
      }
      var local = c.filter(function (v) { return v.localService; });
      return local[0] || c[0];
    }
    voices.ja = best('ja', ['Kyoko', 'O-ren', 'Otoya', 'Hattori']);
    voices.en = best('en-us', ['Samantha', 'Ava', 'Allison', 'Nicky']) || best('en', ['Samantha', 'Daniel']);
  }
  if (synth) {
    pickVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoices);
  }

  // 読み上げ。終わったら解決する Promise を返す。途中で次の speak/stop が呼ばれたら、前のものはすぐ終わる。
  function speak(text, opts) {
    opts = opts || {};
    var token = ++speakToken;
    return new Promise(function (resolve) {
      if (!synth || !text) { setTimeout(resolve, text ? Math.min(2500, 300 + text.length * 80) : 0); return; }
      var lang = opts.lang || 'ja-JP';
      var done = false;
      function finish() { if (done) return; done = true; clearTimeout(timer); resolve(); }
      var wasBusy = synth.speaking || synth.pending;
      try { synth.cancel(); } catch (e) {}
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      var v = lang.indexOf('en') === 0 ? voices.en : voices.ja;
      if (!v) { pickVoices(); v = lang.indexOf('en') === 0 ? voices.en : voices.ja; }
      if (v) u.voice = v;
      u.rate = opts.rate || (lang.indexOf('en') === 0 ? 0.85 : 0.95);
      u.pitch = opts.pitch || 1.1;
      u.volume = 1;
      u.onend = finish;
      u.onerror = finish;
      // iPhoneでは onend が来ないことがあるので、長さから見積もった時間で必ず先へ進む
      var per = lang.indexOf('en') === 0 ? 110 : 260;
      var timer = setTimeout(finish, 2500 + text.length * per / (u.rate || 1));
      root.__mbUtter = u; // 途中で消されないよう参照を残す
      setTimeout(function () {
        if (token !== speakToken) { finish(); return; }
        try { synth.speak(u); } catch (e) { finish(); }
      }, wasBusy ? 80 : 0);
    });
  }
  function stop() { speakToken++; if (synth) { try { synth.cancel(); } catch (e) {} } }

  // {漢字|かんじ} の書き方から、読み上げ用（漢字）と表示用（ふりがな付き）を作る
  // 空白は残す（かなの多い文は、区切りがあるほうが機械の声が読みまちがえにくい）
  function ttsText(s) { return s.replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/[ 　]+/g, ' '); }
  function rubyHtml(s) {
    return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; })
      .replace(/\{([^|}]+)\|([^}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
  }
  function kanaText(s) { return s.replace(/\{[^|}]+\|([^}]+)\}/g, '$1'); }

  // ---- 効果音 ----
  function unlock() {
    try {
      if (!ctx) { var AC = root.AudioContext || root.webkitAudioContext; if (AC) ctx = new AC(); }
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
    // 読み上げも最初のタップで起こしておく（iPhoneはタップ無しでは声が出ない）
    if (synth && !unlock.done) {
      unlock.done = true;
      try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch (e) {}
    }
  }
  function tone(freq, start, dur, type, vol) {
    if (!ctx) return;
    try {
      var t = ctx.currentTime + start;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  var N = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880, C6: 1046.5 };
  var sfx = {
    ok: function () { tone(N.E5, 0, 0.18, 'triangle'); tone(N.G5, 0.1, 0.18, 'triangle'); tone(N.C6, 0.2, 0.35, 'triangle'); },
    soft: function () { tone(N.E4, 0, 0.25, 'sine', 0.15); tone(N.C4, 0.12, 0.3, 'sine', 0.12); },
    tap: function () { tone(N.A5, 0, 0.08, 'sine', 0.12); },
    pop: function () { tone(N.C5, 0, 0.1, 'triangle', 0.2); tone(N.G5, 0.06, 0.12, 'triangle', 0.2); },
    fanfare: function () { [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6].forEach(function (f, i) { tone(f, i * 0.14, i === 5 ? 0.7 : 0.2, 'triangle', 0.28); }); },
    seal: function () { tone(180, 0, 0.5, 'sawtooth', 0.12); tone(N.C5, 0.1, 0.4, 'triangle', 0.2); tone(N.G5, 0.25, 0.5, 'triangle', 0.2); },
    alert: function () { tone(150, 0, 0.3, 'square', 0.08); tone(120, 0.25, 0.4, 'square', 0.08); },
    door: function () { tone(90, 0, 1.0, 'sawtooth', 0.12); tone(70, 0.4, 1.0, 'sawtooth', 0.1); },
    // 扉のメロディ。 notes: 音名の配列。 count: いくつ目まで鳴らすか
    melody: function (notes, count, gap) {
      gap = gap || 0.28;
      for (var i = 0; i < Math.min(count, notes.length); i++) tone(N[notes[i]] || 440, i * gap, 0.4, 'triangle', 0.25);
      return Math.min(count, notes.length) * gap * 1000 + 300;
    },
    note: function (name) { tone(N[name] || 440, 0, 0.45, 'triangle', 0.25); }
  };

  root.MB.audio = { speak: speak, stop: stop, unlock: unlock, sfx: sfx, ttsText: ttsText, rubyHtml: rubyHtml, kanaText: kanaText,
    hasTTS: function () { return !!synth; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MB.audio;
})(typeof self !== 'undefined' ? self : globalThis);
