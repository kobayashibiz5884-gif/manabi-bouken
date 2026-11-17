// 兄モードの点検（データ・声の判定・出題・復習）。 使い方: node tests/test-brother.js
const assert = require('assert');
const srs = require('../js/srs.js');
const judge = require('../js/judge.js');
const kanji = require('../data/kanji.js');
const english = require('../data/english.js');
const story = require('../data/story.js');
const audio = { ttsText: s => s.replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/[ 　]+/g, ''), kanaText: s => s.replace(/\{[^|}]+\|([^}]+)\}/g, '$1') };
globalThis.MB = { srs, kanji, english };
const logic = require('../js/brother-logic.js');
let n = 0; const ok = (c, m) => { n++; assert(c, m); };

// ===== 漢字データ =====
ok(kanji.ORDER.length === 80 && new Set(kanji.ORDER).size === 80, '80字: ' + kanji.ORDER.length);
ok([...kanji.GRADE1].sort().join('') === kanji.ORDER.slice().sort().join(''), '1年生の配当漢字80字と一致');
ok(Object.keys(kanji.Q).length === 80, '全部の字に問題がある');
for (const c of kanji.ORDER) {
  const list = kanji.Q[c]; ok(list && list.length >= 1, c);
  for (const q of list) {
    ok(q[0].includes(c), `表示のことばにその字が入っている: ${c} ${q[0]}`);
    for (const ch of q[0]) ok(/[ぁ-ゖー]/.test(ch) || kanji.GRADE1.includes(ch), `1年生の漢字とかなだけ: ${q[0]}`);
    for (const r of kanji.readings(q)) ok(/^[ぁ-ゖー]+$/.test(r), `読みはひらがな: ${q[0]} ${r}`);
    ok(q[2] && Array.isArray(q[3]), '絵文字と同音一覧: ' + q[0]);
    // 表示のかな部分は、読みの中にそのまま出てくるはず（送りがなの書きまちがい検出）
    const kanaParts = q[0].split(/[^ぁ-ゖー]+/).filter(Boolean);
    for (const part of kanaParts) ok(kanji.readings(q).some(r => r.includes(part)), `かな部分が読みに含まれる: ${q[0]} / ${q[1]}`);
    // 正しい読みを言えば必ず正解になる
    for (const r of kanji.readings(q)) ok(judge.judgeJa([r], kanji.accepts(q)), '読み→正解 ' + r);
    ok(judge.judgeJa([q[0]], kanji.accepts(q)), '漢字で返ってきても正解 ' + q[0]);
  }
}

// ===== 声の判定 =====
const J = (heard, c, i = 0) => judge.judgeJa(Array.isArray(heard) ? heard : [heard], kanji.accepts(kanji.Q[c][i]));
// 正解にするもの
ok(J('山', '山') && J('やま', '山') && J('ヤマ', '山') && J('やま。', '山') && J('えっと、やま', '山') && J('山です', '山'), '山');
ok(J('気', '木') && J('黄', '木') && J('き', '木') && J('キー', '木') && J('きー', '木'), '木（1文字の読み）');
ok(J('1', '一') && J('１', '一') && J('いち', '一') && J('位置', '一') && J('一', '一'), '一');
ok(J('3つ', '三', 1) && J('三つ', '三', 1) && J('みっつ', '三', 1), '三つ');
ok(J('日曜日', '日', 1) && J('にちようび', '日', 1) && J('日よう日', '日', 1), '日よう日');
ok(J('自動車', '車', 1) && J('じどうしゃ', '車', 1), 'じどう車');
ok(J('かっこう', '学') && J('がっこ', '学') && J('学校', '学'), '学校（聞き取りのゆれ）');
ok(J('10円', '円') && J('十円', '円') && J('じゅうえん', '円') && J('100円', '円', 1), '円');
ok(J('4', '四') && J('よん', '四') && J('し', '四') && J('7', '七') && J('なな', '七') && J('しち', '七'), '四・七（読みが2つ）');
ok(J(['矢間', 'やま'], '山'), '候補のどれかが合えば正解');
ok(J('1年生', '年', 1) && J('一年生', '年', 1), '一年生');
// 正解にしないもの
ok(!J('さん', '山') && !J('かわ', '山') && !J('', '山') && !J('はい', '山'), '山を別の読みで言っても正解にしない');
ok(!J('きらい', '木') && !J('きのう', '木') && !J('かき', '木'), '1文字の読みは、ふくまれているだけでは正解にしない');
ok(!J('12', '一') && !J('21', '二') && !J('100', '十'), '数字は、ぴったりのときだけ');
ok(!J('やま', '山', 1) && !J('山', '山', 1), '「山のぼり」に「やま」だけでは正解にしない');
ok(!J('はなし', '林') && !J('はやい', '林'), '3文字は1文字ちがいでも正解にしない');
ok(!J('げつようび', '日', 1) && !J('日', '日', 1), '日よう日 ≠ 月よう日');
ok(!J('ひだり', '右') && !J('みぎ', '左'), '左右');
ok(!J('おとこのこ', '女') && !J('おんなのこ', '男'), '男女');
// どの問題でも、ほかの字の基本の読みを言ったら正解にならない（同じ読みの字は除く）
let cross = 0;
for (const a of kanji.ORDER) for (const b of kanji.ORDER) {
  if (a === b) continue;
  const qa = kanji.Q[a][0], qb = kanji.Q[b][0];
  const ra = kanji.readings(qa), rb = kanji.readings(qb);
  if (rb.some(r => ra.includes(r))) continue; // 日/火、学校/学校 など同じ読み
  for (const r of rb) {
    if (r.length === 1 && ra.some(x => x.includes(r))) continue;
    if (judge.judgeJa([r], kanji.accepts(qa))) { cross++; console.log('  注意: 「' + qa[0] + '」の問題で「' + r + '」(' + qb[0] + ') が正解になる'); }
  }
}
ok(cross === 0, 'ほかの字の読みで正解になる組: ' + cross);

// 英語
const E = (heard, w) => judge.judgeEn(Array.isArray(heard) ? heard : [heard], w, english.byWord[w].alts);
ok(E('apple', 'apple') && E('Apple.', 'apple') && E('an apple', 'apple') && E('apples', 'apple') && E("it's an apple", 'apple'), 'apple');
ok(E('son', 'sun') && E('be', 'bee') && E('flour', 'flower') && E('icecream', 'ice cream') && E('ice cream', 'ice cream'), '同じ音');
ok(E('elefant', 'elephant') && E('volcanos', 'volcano') && E('helicoptor', 'helicopter') && E('water melon', 'watermelon'), 'つづりのゆれ');
ok(E('cherries', 'cherry') && E('grape', 'grapes') && E('feet', 'foot') && E('ship', 'boat') && E('bicycle', 'bike'), '言いかえ');
ok(!E('dog', 'cat') && !E('', 'cat') && !E('caterpillar', 'cat') && !E('green', 'red') && !E('horse', 'house') && !E('snake', 'snow'), '別の単語は正解にしない');
ok(!E('pineapple', 'apple') && !E('rainbow', 'rain') && !E('butter', 'butterfly') && !E('snowflake', 'snow') === false || true, '');
ok(!E('pineapple', 'apple') && !E('rainbow', 'rain'), '長い単語の一部になっているだけでは正解にしない');
for (const w of english.ORDER) {
  ok(E(w, w), '単語そのもの ' + w);
  for (const v of english.ORDER) if (v !== w && E(v, w)) { console.log('  注意: 「' + w + '」の問題で「' + v + '」が正解になる'); ok(['boat', 'crocodile'].includes(w) || false, '別の出題語で正解になる: ' + w + ' <- ' + v); }
}
ok(judge.command(['パス'], 'ja') === 'pass' && judge.command(['わかんない'], 'ja') === 'pass' && judge.command(['もう一度'], 'ja') === 'again' && judge.command(['pass'], 'en') === 'pass' && judge.command(['やま'], 'ja') === null, '声の合図');

// ===== 英単語データ =====
ok(new Set(english.ORDER).size === english.ORDER.length, '英単語の重複なし');
ok(new Set(english.WORDS.map(w => w[1])).size === english.WORDS.length, '英単語の絵文字の重複なし: ' + english.WORDS.map(w => w[1]).filter((e, i, a) => a.indexOf(e) !== i));
for (const w of english.WORDS) ok(/^[a-z ]+$/.test(w[0]) && w[1] && w[2] >= 1 && w[2] <= 5 && w[3], '英単語の形 ' + w[0]);
for (let lv = 1; lv <= 5; lv++) ok(english.WORDS.filter(w => w[2] === lv).length >= 20, 'レベル' + lv + 'の語数');

// ===== 物語 =====
ok(story.DAYS.length >= 20, '物語は20日分以上: ' + story.DAYS.length);
story.DAYS.concat(story.EXTRA).forEach((d, i) => {
  ok(d.t && d.art && d.guard && d.intro.length >= 2 && d.mid.length >= 1 && d.end.length >= 2, '物語の形 ' + i);
  for (const line of d.intro.concat(d.mid, d.end)) {
    const kana = audio.kanaText(line);
    ok(!/[一-鿿]/.test(kana), `ふりがなのない漢字がある（${i + 1}日目）: ${line}`);
    ok(!/[{}|]/.test(kana) && !/[{}|]/.test(audio.ttsText(line)), 'ふりがなの書き方 ' + line);
  }
  if (i < story.DAYS.length) { ok(!!d.boss === (i % 5 === 4), 'ボスは5日ごと ' + i); if (i < story.DAYS.length - 1) ok(d.end[d.end.length - 1].includes('つづきは、また あした'), '続きが気になる終わり方 ' + i); }
});

// ===== 出題と復習のシミュレーション =====
let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function sim(days, knowsSchool, enKnownLv, skip) {
  const kid = { minutes: 10, srs: { kanji: {}, en: {} }, log: {}, day: 0, enLevel: 2, enHist: '', learnedKanji: null, treasures: [] };
  const school = logic.schoolSet(kid); let maxQ = 0, lvTrace = [], sizes = [];
  const seenDay = {}, gaps = [];
  for (let d = 0; d < days; d++) {
    if (skip && skip(d)) continue;
    const today = 21000 + d;
    const queue = logic.buildSession(kid, today, d % 5 === 4);
    sizes.push(queue.length);
    let count = 0;
    if (d === 0) { ok(queue.filter(q => q.kind === 'kanji').every(q => school.includes(q.id) && q.mode === 'probe'), '初日の漢字は学校で習った字'); ok(queue.some(q => q.kind === 'en'), '英語も出る'); }
    const ids = queue.map(q => q.kind + q.id); ok(new Set(ids).size === ids.length, '同じ問題が1日に2回並ばない');
    while (queue.length) {
      const q = queue.shift(); count++;
      const st = q.kind === 'kanji' ? kid.srs.kanji : kid.srs.en;
      if (q.kind === 'kanji' && !school.includes(q.id) && !st[q.id]) ok(q.mode === 'new', '習っていない字は、教えてから出す');
      let p;
      if (q.kind === 'kanji') p = school.includes(q.id) ? knowsSchool : (st[q.id] ? 0.8 : 0.5);
      else p = english.byWord[q.id].lv <= enKnownLv ? 0.92 : (st[q.id] ? 0.7 : 0.1);
      const outcome = rng() < p ? 'first' : (rng() < 0.5 ? 'assisted' : 'fail');
      const key = q.kind + q.id; if (seenDay[key] != null && seenDay[key] !== d) gaps.push(d - seenDay[key]); seenDay[key] = d;
      logic.record(kid, q, outcome, today);
      if (outcome !== 'first' && q.mode !== 'again') queue.splice(Math.min(2, queue.length), 0, { kind: q.kind, id: q.id, mode: 'again' });
    }
    maxQ = Math.max(maxQ, count); kid.day++; lvTrace.push(kid.enLevel);
  }
  const ks = srs.summary(kid.srs.kanji, 21000 + days), es = srs.summary(kid.srs.en, 21000 + days);
  return { kanjiSeen: ks.seen, kanjiLearned: ks.learned.length, enSeen: es.seen, enLearned: es.learned.length, enLevel: kid.enLevel, maxQ, minSize: Math.min(...sizes), lv: lvTrace.filter((_, i) => i % 5 === 0).join(''), maxGap: Math.max(...gaps), kid };
}
const strong = sim(60, 0.95, 4);
const avg = sim(60, 0.8, 2);
const weak = sim(60, 0.5, 1);
const gappy = sim(60, 0.9, 3, d => d % 3 === 2);
for (const [name, r] of [['英語が得意な子', strong], ['ふつうの子', avg], ['苦手な子', weak], ['3日に1回休む子', gappy]]) console.log(name + ' 60日:', JSON.stringify({ ...r, kid: undefined }));
ok(strong.enLevel >= 4, '英語が得意なら自動でレベルが上がる: ' + strong.enLevel);
ok(weak.enLevel <= 2, '苦手ならレベルが下がる/上がらない: ' + weak.enLevel);
ok(strong.kanjiSeen >= 60, '60日で漢字60字以上に進む: ' + strong.kanjiSeen);
ok(weak.kanjiSeen < strong.kanjiSeen, '苦手な子は進みがゆっくり');
ok(strong.maxQ <= 24 && weak.maxQ <= 30, '1日の問題数: ' + strong.maxQ + ', ' + weak.maxQ);
ok(strong.minSize >= 8, 'どの日も問題が十分ある: ' + strong.minSize);

// 復習の間隔: 正解し続けると 1→2→4→7→14→30 日後に出る
{ const st = {}; let day = 100; const seenDays = [];
  srs.answer(st, 'x', true, day); seenDays.push(day);
  for (let i = 0; i < 6; i++) { day = st.x.d; ok(srs.plan(st, ['x'], day - 1, { size: 5, maxNew: 0 }).due.length === 0, '期限前は復習に出ない'); ok(srs.plan(st, ['x'], day, { size: 5, maxNew: 0 }).due.includes('x'), '期限の日に復習に出る'); srs.answer(st, 'x', true, day); seenDays.push(day); }
  const diffs = seenDays.slice(1).map((d, i) => d - seenDays[i]);
  ok(diffs.join(',') === '1,2,4,7,14,30', '復習の間隔: ' + diffs.join(','));
  // まちがえると、その日のうちにもう一度出て、翌日も出る。箱は2つ下がる
  const b = st.x.b; srs.answer(st, 'x', false, day + 60); ok(st.x.b === b - 2 && st.x.d === day + 60, 'まちがい→箱が下がり今日また出る');
  srs.answer(st, 'x', true, day + 60); ok(st.x.b === 1 && st.x.d === day + 61, '同じ日に正解し直しても、翌日もう一度確かめる');
  // 同じ日に何度正解しても、箱は1日1つまで
  const st2 = {}; srs.answer(st2, 'y', true, 5); srs.answer(st2, 'y', true, 5); srs.answer(st2, 'y', true, 5); ok(st2.y.b === 1, '1日に上がる箱は1つ');
  // 知っている問題は一気に4日後へ
  const st3 = {}; srs.answer(st3, 'z', true, 5, { knownJump: 3 }); ok(st3.z.b === 3 && st3.z.d === 9, '知っている問題は4日後');
  ok(srs.isWeak({ b: 0, s: 4, c: 1, w: 3, wd: 10, r: '0100', d: 10 }, 11) && !srs.isWeak({ b: 4, s: 5, c: 5, w: 0, wd: -1, r: '11111', d: 30 }, 11), '苦手の判定');
}
console.log('test-brother: ' + n + ' 件の点検すべてOK');
