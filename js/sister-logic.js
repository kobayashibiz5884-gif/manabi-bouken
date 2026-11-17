// 妹モードの出題の組み立て（画面に依存しない計算）。
(function (root) {
  'use strict';
  var srs = root.MB ? root.MB.srs : require('./srs.js');
  var kana = root.MB && root.MB.kana ? root.MB.kana : require('../data/kana.js');

  function shuffle(a, rng) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function isSimilar(set, a, b) { return (set.similar[a] || []).indexOf(b) >= 0; }
  function sameSound(set, a, b) { return set.same[a] === b; }

  // 選択肢を作る。
  // mode 'easy': 形の似た文字を一緒に出さない（正解と似た字も、選択肢どうしで似た字も出さない）
  // mode 'compare': 正解と形の似た字を、あえて1〜2個まぜる（見くらべ問題）
  // known: すでに習った文字の配列（正解を含んでよい）。足りなければ未習の字で補う。
  function makeChoices(set, target, n, mode, known, rng) {
    rng = rng || Math.random;
    var chosen = [];
    function okToAdd(c) {
      if (c === target || chosen.indexOf(c) >= 0) return false;
      if (sameSound(set, c, target)) return false;
      if (chosen.some(function (x) { return sameSound(set, c, x); })) return false;
      if (mode !== 'compare') {
        if (isSimilar(set, c, target)) return false;
        if (chosen.some(function (x) { return isSimilar(set, c, x); })) return false;
      }
      return true;
    }
    if (mode === 'compare') {
      var partners = shuffle((set.similar[target] || []).filter(function (c) { return known.indexOf(c) >= 0; }), rng);
      partners.slice(0, Math.min(2, n - 1)).forEach(function (c) { if (okToAdd(c)) chosen.push(c); });
    }
    // まだ習っていない字で補うときは、基本の46文字を先に（濁点の字は後回し）
    var unknown = set.order.filter(function (c) { return known.indexOf(c) < 0; });
    var pool = shuffle(known, rng).concat(shuffle(unknown.filter(function (c) { return set.order.indexOf(c) < 46; }), rng), shuffle(unknown.filter(function (c) { return set.order.indexOf(c) >= 46; }), rng));
    for (var i = 0; i < pool.length && chosen.length < n - 1; i++) if (okToAdd(pool[i])) chosen.push(pool[i]);
    return shuffle(chosen.concat([target]), rng);
  }

  // 見くらべ問題にしてよいか: 正解も、似ている相手も、十分に慣れている（箱3以上）
  function canCompare(set, st, target) {
    var rec = st[target];
    if (!rec || rec.b < srs.LEARNED_BOX) return false;
    return (set.similar[target] || []).some(function (c) { return st[c] && st[c].b >= srs.LEARNED_BOX; });
  }

  function choiceCount(kid, rec) {
    if (!rec || rec.b === 0) return 2;
    if (kid.day < 3) return 2;
    if (kid.day < 8 || rec.b < 2) return 3;
    return 4;
  }

  function yesterdayAccuracy(kid, today) {
    var l = kid.log[srs.dayString(today - 1)];
    if (!l || !l.q) return null;
    return l.ok / l.q;
  }

  // カタカナを始めてよいか（ひらがな46文字をひととおり出し終え、35文字以上おぼえた。または親が切り替えた）
  function kataActive(kid) {
    if (kid.kataOn) return true;
    var st = kid.srs.hira, set = kana.makeSet('hira');
    var basic = set.order.slice(0, 46);
    var seen = basic.filter(function (c) { return st[c]; }).length;
    var learned = basic.filter(function (c) { return srs.isLearned(st[c]); }).length;
    return seen >= 46 && learned >= 35;
  }

  // 1つの文字セットについて今日の出題を作る
  function planScript(kid, script, today, size, rng) {
    var set = kana.makeSet(script), st = kid.srs[script];
    var seenIds = Object.keys(st);
    var fresh, reviews;
    if (!seenIds.length) {
      fresh = script === 'hira' ? kana.firstLetters(kid.nameKana, 5) : kana.firstLetters('', 5).map(kana.toKata);
      reviews = [];
    } else {
      var acc = yesterdayAccuracy(kid, today);
      var order = set.order.slice();
      if (script === 'hira' && kid.nameKana) {
        // 名前の文字を先頭に
        var first = kana.firstLetters(kid.nameKana, 5);
        order = first.concat(order.filter(function (c) { return first.indexOf(c) < 0; }));
      }
      var p0 = srs.plan(st, order, today, { size: size, maxNew: 0 });
      var maxNew = (acc != null && acc >= 0.85 && p0.load <= 1) ? 2 : 1;
      var p = srs.plan(st, order, today, { size: size, maxNew: maxNew, loadCap: 4, alwaysOneNew: true });
      fresh = p.fresh;
      reviews = p.list.filter(function (x) { return x.kind !== 'new'; });
    }
    var qs = [];
    var known = seenIds.slice();
    function typeFor(id, i) {
      var rec = st[id], item = set.items[id];
      if (!rec || rec.b <= 1) return 'pick';
      if (canCompare(set, st, id) && rng() < 0.5) return 'compare';
      if (item.word && (i % 2 === 1)) return 'pic';
      return 'pick';
    }
    // 復習を先に2問（最初は成功しやすいものから）、そのあと新しい文字をはさむ
    var rv = reviews.map(function (x, i) { return { script: script, id: x.id, type: typeFor(x.id, i), kind: x.kind }; });
    var warm = rv.splice(0, 2);
    qs = qs.concat(warm);
    var pendingRepeat = [];
    fresh.forEach(function (id, i) {
      qs.push({ script: script, id: id, type: 'teach', kind: 'new' });
      qs.push({ script: script, id: id, type: 'pick', kind: 'new', first: true });
      if (pendingRepeat.length) qs.push(pendingRepeat.shift());
      if (rv.length) qs.push(rv.shift());
      pendingRepeat.push({ script: script, id: id, type: 'pick', kind: 'repeat' });
    });
    qs = qs.concat(rv);
    // 新しい文字の2回目は、間に別の問題をはさんでから
    pendingRepeat.forEach(function (q) { qs.push(q); });
    return { set: set, qs: qs, fresh: fresh };
  }

  // 今日の出題（妹）。返り値: { qs:[{script,id,type,kind}], words:[{script,w,say,emoji}] }
  function buildSession(kid, today, rng) {
    rng = rng || Math.random;
    var out = [];
    var useKata = kataActive(kid);
    var h = planScript(kid, 'hira', today, useKata ? 4 : 8, rng);
    out = out.concat(h.qs);
    if (useKata) out = out.concat(planScript(kid, 'kata', today, 5, rng).qs);
    // ことばを読む問題: 習った文字が8つ以上で、すべて習った文字（箱1以上）でできたことばがあれば、最後に2問
    var st = kid.srs.hira;
    var known = Object.keys(st).filter(function (c) { return st[c].b >= 1; });
    var words = [];
    if (known.length >= 8) {
      var ok = h.set.words.filter(function (w) { return w.w.split('').every(function (c) { return known.indexOf(c) >= 0; }); });
      words = shuffle(ok, rng).slice(0, 2).map(function (w) { return { script: 'hira', type: 'word', w: w.w, say: w.say, emoji: w.emoji, kind: 'word' }; });
    }
    return { qs: out.concat(words) };
  }

  // ことば問題の選択肢（絵）。正解と最初の文字が違うことばから選ぶ
  function wordChoices(set, word, n, rng) {
    rng = rng || Math.random;
    var others = shuffle(set.words.filter(function (w) { return w.emoji !== word.emoji && w.w[0] !== word.w[0]; }), rng).slice(0, n - 1);
    return shuffle(others.concat([word]), rng);
  }
  // 「この文字で始まるのはどっち」の選択肢（絵）
  function picChoices(set, target, n, known, rng) {
    rng = rng || Math.random;
    var pool = shuffle(set.order.filter(function (c) { return c !== target && set.items[c].word && set.items[c].emoji !== set.items[target].emoji; }), rng);
    // 習った文字の絵を優先
    pool.sort(function (a, b) { return (known.indexOf(b) >= 0) - (known.indexOf(a) >= 0); });
    return shuffle(pool.slice(0, n - 1).concat([target]), rng);
  }

  var api = { makeChoices: makeChoices, canCompare: canCompare, choiceCount: choiceCount, buildSession: buildSession,
    kataActive: kataActive, wordChoices: wordChoices, picChoices: picChoices, shuffle: shuffle };
  root.MB = root.MB || {};
  root.MB.sisterLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
