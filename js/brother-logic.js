// 兄モードの出題の組み立て（画面に依存しない計算）。
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var srs = root.MB && root.MB.srs ? root.MB.srs : require('./srs.js');
  var kanji = root.MB && root.MB.kanji ? root.MB.kanji : require('../data/kanji.js');
  var english = root.MB && root.MB.english ? root.MB.english : require('../data/english.js');

  var KNOWN_JUMP = 4; // 初めて見た問題にヒントなしで正解したら「もう知っている」とみなし、1週間後の復習に回す

  function shuffle(a, rng) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // 学校で習った字（親の画面で直せる。未設定なら、並び順の先頭35字）
  function schoolSet(kid) { return kid.learnedKanji || kanji.ORDER.slice(0, kanji.DEFAULT_SCHOOL_COUNT); }
  // 出す順番: 学校で習った字が先、そのあと残り
  function kanjiOrder(kid) {
    var school = schoolSet(kid);
    return kanji.ORDER.filter(function (c) { return school.indexOf(c) >= 0; }).concat(kanji.ORDER.filter(function (c) { return school.indexOf(c) < 0; }));
  }
  // その漢字の、今回出す問題。慣れるまでは基本の問題だけ。慣れたら（箱2以上）別のことばも交互に出す
  function kanjiQuestion(id, rec) {
    var list = kanji.Q[id];
    if (!rec || rec.b < 2 || list.length === 1) return list[0];
    return list[rec.s % list.length];
  }

  function planKanji(kid, today, size) {
    var st = kid.srs.kanji, order = kanjiOrder(kid), school = schoolSet(kid);
    var base = srs.plan(st, order, today, { size: size, maxNew: 0 });
    var out = base.due.map(function (id) { return { kind: 'kanji', id: id, mode: 'due' }; });
    var room = size - out.length;
    var unseen = order.filter(function (c) { return !st[c]; });
    // 学校で習った字は「腕だめし」として教えずに出す（知っていれば一気に復習間隔が伸びる）
    var probes = unseen.filter(function (c) { return school.indexOf(c) >= 0; }).slice(0, Math.max(0, room));
    probes.forEach(function (id) { out.push({ kind: 'kanji', id: id, mode: 'probe' }); });
    room -= probes.length;
    // まだ習っていない字は、練習中の字が少ないときだけ、1日2字まで。最初に読み方を教える
    if (room > 0 && base.load < 4) {
      unseen.filter(function (c) { return school.indexOf(c) < 0; }).slice(0, Math.min(2, room)).forEach(function (id) {
        out.push({ kind: 'kanji', id: id, mode: 'new' }); room--;
      });
    }
    base.extra.slice(0, Math.max(0, room)).forEach(function (id) { out.push({ kind: 'kanji', id: id, mode: 'extra' }); });
    return out;
  }

  // 英単語: いまのレベルの単語を先に、次に下のレベルの未出の単語
  function planEnglish(kid, today, size) {
    var st = kid.srs.en;
    var base = srs.plan(st, english.ORDER, today, { size: size, maxNew: 0 });
    var out = base.due.map(function (id) { return { kind: 'en', id: id, mode: 'due' }; });
    var room = size - out.length;
    if (room > 0 && base.load < 5) {
      var lv = kid.enLevel;
      var unseen = english.ORDER.filter(function (w) { return !st[w]; });
      var cur = unseen.filter(function (w) { return english.byWord[w].lv === lv; });
      var lower = unseen.filter(function (w) { return english.byWord[w].lv < lv; }).reverse();
      var higher = unseen.filter(function (w) { return english.byWord[w].lv > lv; });
      var cand = cur.concat(cur.length >= room ? [] : lower).concat(cur.length + lower.length >= room ? [] : higher);
      cand.slice(0, room).forEach(function (id) { out.push({ kind: 'en', id: id, mode: 'probe' }); room--; });
    }
    base.extra.slice(0, Math.max(0, room)).forEach(function (id) { out.push({ kind: 'en', id: id, mode: 'extra' }); });
    return out;
  }

  // 今日の出題。 boss: ボスの日は少し多め
  function buildSession(kid, today, boss) {
    var k = planKanji(kid, today, boss ? 8 : 7);
    var e = planEnglish(kid, today, boss ? 6 : 5);
    // 漢字2問 → 英語1問 のくり返しで混ぜる
    var out = [];
    while (k.length || e.length) {
      if (k.length) out.push(k.shift());
      if (k.length) out.push(k.shift());
      if (e.length) out.push(e.shift());
    }
    return out;
  }

  // 英語レベルの自動調整。初めて見た単語の結果（ヒントなしで言えたか）を記録し、
  // 直近5語のうち4語以上言えたらレベルを上げ、1語以下ならレベルを下げる。
  function adaptEnglish(kid, firstSightCorrect) {
    kid.enHist = ((kid.enHist || '') + (firstSightCorrect ? '1' : '0')).slice(-5);
    var before = kid.enLevel;
    if (kid.enHist.length >= 5) {
      var ok = kid.enHist.split('1').length - 1;
      if (ok >= 4 && kid.enLevel < english.MAX_LEVEL) { kid.enLevel++; kid.enHist = ''; }
      else if (ok <= 1 && kid.enLevel > 1) { kid.enLevel--; kid.enHist = ''; }
    }
    return kid.enLevel - before;
  }

  // 結果を記録する。 outcome: 'first'（ヒントなしで正解） | 'assisted'（ヒントやボタンのあと正解） | 'fail'（答えを見た）
  function record(kid, q, outcome, today) {
    var st = q.kind === 'kanji' ? kid.srs.kanji : kid.srs.en;
    var firstSight = !st[q.id];
    var correct = outcome === 'first';
    // 「もう知っている」扱いにするのは腕だめし（probe）の問題だけ。読み方を教えた直後の字（new）は、ふつうに翌日から復習する
    srs.answer(st, q.id, correct, today, { knownJump: q.mode === 'probe' ? KNOWN_JUMP : 0 });
    var change = 0;
    if (q.kind === 'en' && firstSight) change = adaptEnglish(kid, correct);
    return { firstSight: firstSight, levelChange: change };
  }

  // ボタンで答えるときの選択肢（3つ）
  function kanjiChoices(q, rng) {
    rng = rng || Math.random;
    var right = kanji.readings(q)[0];
    var all = [];
    Object.keys(kanji.Q).forEach(function (c) { kanji.Q[c].forEach(function (x) { kanji.readings(x).forEach(function (r) { if (all.indexOf(r) < 0) all.push(r); }); }); });
    var mine = kanji.readings(q);
    var pool = shuffle(all.filter(function (r) { return mine.indexOf(r) < 0 && Math.abs(r.length - right.length) <= 1; }), rng);
    if (pool.length < 2) pool = shuffle(all.filter(function (r) { return mine.indexOf(r) < 0; }), rng);
    return shuffle([right].concat(pool.slice(0, 2)), rng);
  }
  function englishChoices(word, rng) {
    rng = rng || Math.random;
    var lv = english.byWord[word].lv;
    var pool = shuffle(english.ORDER.filter(function (w) { return w !== word && Math.abs(english.byWord[w].lv - lv) <= 1; }), rng);
    return shuffle([word].concat(pool.slice(0, 2)), rng);
  }

  var api = { KNOWN_JUMP: KNOWN_JUMP, schoolSet: schoolSet, kanjiOrder: kanjiOrder, kanjiQuestion: kanjiQuestion, planKanji: planKanji,
    planEnglish: planEnglish, buildSession: buildSession, adaptEnglish: adaptEnglish, record: record, kanjiChoices: kanjiChoices, englishChoices: englishChoices };
  root.MB = root.MB || {};
  root.MB.brotherLogic = api;
  if (node) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
