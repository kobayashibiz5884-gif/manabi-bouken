// アプリの入口: 画面の切り替え、あそんだ時間の計測、最初の画面。
(function (root) {
  'use strict';
  var MB = root.MB, store = MB.store, audio = MB.audio;
  var appEl = null;
  var current = { cleanup: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function render(html, cls) {
    if (current.cleanup) { try { current.cleanup(); } catch (e) {} current.cleanup = null; }
    appEl.className = 'screen ' + (cls || '');
    appEl.innerHTML = html;
    appEl.scrollTop = 0;
    return appEl;
  }
  function $(sel, base) { return (base || appEl).querySelector(sel); }
  function $all(sel, base) { return Array.prototype.slice.call((base || appEl).querySelectorAll(sel)); }
  function tap(el, fn) {
    if (!el) return;
    el.addEventListener('click', function (ev) { audio.unlock(); fn(ev); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function onCleanup(fn) { var prev = current.cleanup; current.cleanup = function () { if (prev) prev(); fn(); }; }

  // ---- あそんだ時間の計測（画面が見えている間だけ数える）----
  var timer = { id: null, kid: null, onTimeUp: null, fired: false };
  function startTimer(kid, onTimeUp) {
    stopTimer();
    timer.kid = kid; timer.onTimeUp = onTimeUp; timer.fired = false;
    keepAwake();
    timer.id = setInterval(function () {
      if (document.hidden) return;
      store.addSeconds(kid, 1);
      if (store.secondsToday(kid) % 10 === 0) store.save();
      if (!timer.fired && store.timeLeft(kid) <= 0) { timer.fired = true; if (timer.onTimeUp) timer.onTimeUp(); }
    }, 1000);
  }
  function stopTimer() { if (timer.id) { clearInterval(timer.id); timer.id = null; store.save(); } releaseWake(); }

  // あそんでいる間は、画面が自動で暗くならないようにする（声で遊ぶと画面に触らないため）
  var wake = null, wakeWanted = false;
  function keepAwake() {
    wakeWanted = true;
    try {
      if (navigator.wakeLock && navigator.wakeLock.request && !document.hidden) {
        navigator.wakeLock.request('screen').then(function (w) { wake = w; if (!wakeWanted) releaseWake(); }, function () {});
      }
    } catch (e) {}
  }
  function releaseWake() { wakeWanted = false; try { if (wake) wake.release(); } catch (e) {} wake = null; }

  // ---- 最初の画面: だれが あそぶ？ ----
  function home() {
    stopTimer(); audio.stop();
    var s = store.get();
    if (!s.setupDone) { MB.parent.setup(); return; }
    var sis = s.kids.sis, bro = s.kids.bro;
    render(
      '<div class="home">' +
      '<h1 class="home-title">だれが あそぶ？</h1>' +
      '<button class="who who-sis" id="goSis"><span class="who-face">👸</span><span class="who-name">' + esc(sis.name || 'いもうと') + '</span><span class="who-sub">🍰 おかしやさん</span></button>' +
      '<button class="who who-bro" id="goBro"><span class="who-face">🗝️</span><span class="who-name">' + esc(bro.name || 'おにいちゃん') + '</span><span class="who-sub">🏛️ ことだまの いせき</span></button>' +
      '<button class="parent-btn" id="goParent" aria-label="おとなのがめん">⚙️ おとな</button>' +
      (store.isMemoryOnly() ? '<p class="warn">この開き方では記録が保存されません（プライベートブラウズなど）。</p>' : '') +
      '</div>', 'bg-home');
    tap($('#goSis'), function () { MB.sister.home(); });
    tap($('#goBro'), function () { if (MB.brother) MB.brother.home(); else comingSoon(); });
    tap($('#goParent'), function () { MB.parent.open(); });
  }
  function comingSoon() {
    render('<div class="center-col"><div class="big-emoji">🚧</div><p class="msg">ぼうけんは いま つくっているよ。<br>もうすこし まってね！</p><button class="btn" id="back">もどる</button></div>', 'bg-bro');
    tap($('#back'), home);
  }

  function boot() {
    appEl = document.getElementById('app');
    store.load();
    document.addEventListener('visibilitychange', function () { if (document.hidden) { store.save(); audio.stop(); } else if (wakeWanted) keepAwake(); });
    window.addEventListener('pagehide', function () { store.save(); });
    // ダブルタップでの拡大を止める
    document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    home();
  }

  MB.ui = { render: render, $: $, $all: $all, tap: tap, wait: wait, esc: esc, onCleanup: onCleanup };
  MB.app = { home: home, startTimer: startTimer, stopTimer: stopTimer, boot: boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(self);
