// 記録の保存。すべてこの端末（iPhone）の中だけに置く。名前や記録はプログラムには書かない。
(function (root) {
  'use strict';
  var KEY = 'manabi-bouken-v1';
  var srs = root.MB.srs;

  function fresh() {
    return {
      v: 1,
      pin: null,
      setupDone: false,
      kids: {
        sis: { name: '', nameKana: '', minutes: 10, srs: { hira: {}, kata: {} }, log: {}, day: 0, lastDone: -1, bonus: -1,
          showcase: [], kataOn: false },
        bro: { name: '', minutes: 10, srs: { kanji: {}, en: {} }, log: {}, day: 0, lastDone: -1, bonus: -1,
          enLevel: 2, enHist: '', learnedKanji: null, useVoice: true, treasures: [] }
      }
    };
  }

  var state = null;
  var memoryOnly = false;

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; memoryOnly = true; }
    state = merge(fresh(), s || {});
    return state;
  }
  // 新しい項目が増えても古い記録を壊さないよう、ひな形に上書きする
  function merge(base, saved) {
    Object.keys(saved).forEach(function (k) {
      if (saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        base[k] = merge(base[k], saved[k]);
      } else {
        base[k] = saved[k];
      }
    });
    return base;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { memoryOnly = true; return false; }
  }
  function get() { return state || load(); }
  function kid(id) { return get().kids[id]; }

  function today() { return srs.dayNumber(); }
  function logFor(k, day) {
    var key = srs.dayString(day == null ? today() : day);
    if (!k.log[key]) k.log[key] = { sec: 0, q: 0, ok: 0, ep: 0 };
    return k.log[key];
  }
  function secondsToday(k) { var key = srs.dayString(today()); return k.log[key] ? k.log[key].sec : 0; }
  function addSeconds(k, sec) { logFor(k).sec += sec; }
  function countAnswer(k, ok) { var l = logFor(k); l.q++; if (ok) l.ok++; }

  // 今日あそべるか。 返り値: 'ok' | 'done'（今日の1話は終わった） | 'time'（時間切れ）
  function canPlay(k) {
    var t = today();
    if (k.bonus === t) return 'ok';
    if (k.lastDone === t) return 'done';
    if (secondsToday(k) >= k.minutes * 60) return 'time';
    return 'ok';
  }
  function timeLeft(k) {
    if (k.bonus === today()) return 15 * 60; // おまけの1話は15分まで
    return Math.max(0, k.minutes * 60 - secondsToday(k));
  }
  function finishEpisode(k) {
    var t = today();
    k.day++;
    k.lastDone = t;
    if (k.bonus === t) k.bonus = -1;
    logFor(k).ep++;
    save();
  }

  function exportText() { return JSON.stringify(get()); }
  function importText(text) {
    var s = JSON.parse(text);
    if (!s || !s.kids || !s.kids.sis || !s.kids.bro) throw new Error('形式がちがいます');
    state = merge(fresh(), s);
    save();
  }
  function resetKid(id) { var f = fresh().kids[id]; f.name = state.kids[id].name; f.nameKana = state.kids[id].nameKana || ''; f.minutes = state.kids[id].minutes; state.kids[id] = f; save(); }

  root.MB.store = { load: load, save: save, get: get, kid: kid, today: today, logFor: logFor, secondsToday: secondsToday,
    addSeconds: addSeconds, countAnswer: countAnswer, canPlay: canPlay, timeLeft: timeLeft, finishEpisode: finishEpisode,
    exportText: exportText, importText: importText, resetKid: resetKid, isMemoryOnly: function () { return memoryOnly; } };
})(typeof self !== 'undefined' ? self : globalThis);
