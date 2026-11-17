// 復習のしくみ（忘れかけた頃にもう一度出す）。画面に依存しない純粋な計算だけ。
// 記録1件の形: { b:箱(0-7), d:次に出す日(日番号), s:出題回数, c:正解数, w:不正解数,
//                l:最後に出た日, f:初めて出た日, lp:最後に箱が上がった日, wd:最後に間違えた日, r:直近の結果("1011"など最大6件) }
(function (root) {
  'use strict';
  // 箱 b に入った直後、何日後に復習するか。 箱1=翌日, 2=2日後, 3=4日後, 4=1週間後, 5=2週間後, 6=1か月後, 7=2か月後
  var INTERVALS = [0, 1, 2, 4, 7, 14, 30, 60];
  var MAX_BOX = 7;
  var LEARNED_BOX = 3; // 箱3以上を「おぼえた」とみなす

  // ローカル日付の日番号（1970-01-01からの日数）。朝4時までは前日扱い（夜ふかしの日またぎ対策は不要なので0時区切り）
  function dayNumber(date) {
    var d = date || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }
  function dayString(n) {
    var d = new Date(n * 86400000);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }

  function newRecord(today) {
    return { b: 0, d: today, s: 0, c: 0, w: 0, l: today, f: today, lp: -1, wd: -1, r: '' };
  }

  // 答えを記録する。 opts.knownJump: 初めて見た問題に一発正解したとき、いきなり入れる箱（「もう知っている」扱い）
  // 返り値: 更新後の記録
  function answer(state, id, correct, today, opts) {
    opts = opts || {};
    var rec = state[id];
    var first = !rec;
    if (!rec) rec = state[id] = newRecord(today);
    rec.s++;
    rec.l = today;
    rec.r = (rec.r + (correct ? '1' : '0')).slice(-6);
    if (correct) {
      rec.c++;
      if (first && opts.knownJump) {
        rec.b = Math.min(MAX_BOX, opts.knownJump);
        rec.d = today + INTERVALS[rec.b];
        rec.lp = today;
      } else if (rec.wd === today) {
        // 今日すでに間違えた文字は、今日のうちは箱1まで（明日もう一度確かめる）
        rec.b = Math.max(rec.b, 1);
        if (rec.b > 1) rec.b = 1;
        rec.d = today + 1;
        rec.lp = today;
      } else if (rec.d > today && !first) {
        // まだ復習日が来ていない「おまけ練習」。箱は上げない（予定も変えない）
      } else if (rec.lp !== today) {
        rec.b = Math.min(MAX_BOX, rec.b + 1);
        rec.d = today + INTERVALS[rec.b];
        rec.lp = today;
      }
    } else {
      rec.w++;
      rec.wd = today;
      rec.b = Math.max(0, rec.b - 2);
      rec.d = today; // 今日のうちにもう一度。そのあと明日
    }
    return rec;
  }

  function isLearned(rec) { return !!rec && rec.b >= LEARNED_BOX; }
  // 苦手: 3回以上出て直近の正答が半分以下、または最近3日以内に間違えて箱が低い
  function isWeak(rec, today) {
    if (!rec || rec.s < 2) return false;
    var recent = rec.r.slice(-4);
    var ok = recent.split('1').length - 1;
    if (rec.s >= 3 && ok * 2 <= recent.length && rec.b < LEARNED_BOX) return true;
    if (rec.wd >= 0 && today - rec.wd <= 3 && rec.b <= 1) return true;
    return false;
  }

  // 今日の出題リストを作る。
  // order: 出す順に並んだ全IDの配列（新しい問題はこの順に導入）
  // opts: { size:全体の数, maxNew:新しく入れる数の上限, loadCap:「練習中(箱0-1)」がこの数以上なら新しいものを入れない,
  //         filter:(id)=>bool 出してよいIDか }
  // 返り値: { due:[id], fresh:[id], extra:[id], list:[{id, kind:'due'|'new'|'extra'}] }
  function plan(state, order, today, opts) {
    opts = opts || {};
    var size = opts.size || 8;
    var maxNew = opts.maxNew == null ? 1 : opts.maxNew;
    var loadCap = opts.loadCap == null ? 4 : opts.loadCap;
    var filter = opts.filter || function () { return true; };
    var due = [], notDue = [], unseen = [], load = 0;
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (!filter(id)) continue;
      var rec = state[id];
      if (!rec) { unseen.push(id); continue; }
      if (rec.b <= 1) load++;
      if (rec.d <= today) due.push(id); else notDue.push(id);
    }
    // 期限が古いもの、箱が低いものを先に
    due.sort(function (a, b) {
      var x = state[a], y = state[b];
      return (x.d - y.d) || (x.b - y.b) || (x.l - y.l);
    });
    var dueCap = opts.dueCap || size;
    var dueUsed = due.slice(0, dueCap);
    var room = size - dueUsed.length;
    var fresh = [];
    if (load < loadCap && room > 0) fresh = unseen.slice(0, Math.min(maxNew, room));
    // 復習が多すぎる日でも、新しいものが全く無い日が続かないよう、復習が上限に達していても loadが小さければ1つは入れる
    if (!fresh.length && load < loadCap && maxNew > 0 && unseen.length && dueUsed.length >= size && opts.alwaysOneNew) {
      dueUsed = dueUsed.slice(0, size - 1);
      fresh = unseen.slice(0, 1);
    }
    room = size - dueUsed.length - fresh.length;
    // あまった枠は、箱が低く、しばらく出ていないものの「おまけ練習」
    notDue.sort(function (a, b) {
      var x = state[a], y = state[b];
      return (x.b - y.b) || (x.l - y.l) || (x.d - y.d);
    });
    var extra = notDue.slice(0, Math.max(0, room));
    var list = [];
    fresh.forEach(function (id) { list.push({ id: id, kind: 'new' }); });
    dueUsed.forEach(function (id) { list.push({ id: id, kind: 'due' }); });
    extra.forEach(function (id) { list.push({ id: id, kind: 'extra' }); });
    return { due: dueUsed, fresh: fresh, extra: extra, list: list, load: load, unseenCount: unseen.length, dueTotal: due.length };
  }

  function summary(state, today) {
    var out = { seen: 0, learned: [], learning: [], weak: [], due: 0 };
    Object.keys(state).forEach(function (id) {
      var rec = state[id];
      out.seen++;
      if (isLearned(rec)) out.learned.push(id); else out.learning.push(id);
      if (isWeak(rec, today)) out.weak.push(id);
      if (rec.d <= today) out.due++;
    });
    return out;
  }

  var api = { INTERVALS: INTERVALS, MAX_BOX: MAX_BOX, LEARNED_BOX: LEARNED_BOX, dayNumber: dayNumber, dayString: dayString,
    answer: answer, plan: plan, isLearned: isLearned, isWeak: isWeak, summary: summary };
  root.MB = root.MB || {};
  root.MB.srs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
