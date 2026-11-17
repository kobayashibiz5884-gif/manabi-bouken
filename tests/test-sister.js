// 妹モードの点検。 使い方: node tests/test-sister.js
const assert = require('assert');
const srs = require('../js/srs.js');
globalThis.MB = { srs };
const kana = require('../data/kana.js'); globalThis.MB.kana = kana;
const logic = require('../js/sister-logic.js');
let n = 0; const ok = (c, m) => { n++; assert(c, m); };

// --- データの点検 ---
const H = kana.makeSet('hira'), K = kana.makeSet('kata');
ok(H.order.length === 46 + 23, 'ひらがなの数 ' + H.order.length);
ok(new Set(H.order).size === H.order.length, '重複なし');
const basic = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
ok(H.order.slice(0, 46).join('') === basic, '基本46文字の並び');
for (const l of kana.LETTERS) {
  if (!l[1]) { ok(l[0] === 'を' || l[0] === 'ん', '例のことばなしは を/ん だけ'); continue; }
  ok(l[1][0] === l[0], `例のことばが その文字で始まる: ${l[0]} ${l[1]}`);
  ok(/^[ぁ-ゖー]+$/.test(l[1]), 'ひらがなのみ ' + l[1]);
  ok(l[2], '絵文字あり ' + l[0]);
}
const emojis = kana.LETTERS.filter(l => l[2]).map(l => l[2]);
ok(new Set(emojis).size === emojis.length, '例の絵文字が重複しない');
for (const w of H.words) { ok(/^[ぁ-ゖ]+$/.test(w.w) && !/[ゃゅょっぁぃぅぇぉ]/.test(w.w), 'ことば ' + w.w); ok(w.w.split('').every(c => H.items[c]), 'ことばの字がすべて出題対象: ' + w.w); }
ok(new Set(H.words.map(w => w.emoji)).size === H.words.length, 'ことばの絵文字が重複しない: ' + H.words.map(w=>w.emoji).filter((e,i,a)=>a.indexOf(e)!==i));
for (const set of [H, K]) for (const a in set.similar) for (const b of set.similar[a]) { ok(set.items[a] && set.items[b], '似た字の組が実在: ' + a + b); ok(set.similar[b].includes(a), '対称'); }
ok(K.items['ア'] && K.items['ン'] && K.items['ア'].sound === 'ア', 'カタカナ');
ok(H.items['は'].sound === 'ハ' && H.items['へ'].sound === 'ヘ' && H.items['を'].sound === 'オ', '読み上げはカタカナ');

// --- 最初の5文字 ---
ok(kana.firstLetters('さくら', 5).join('') === 'さくらあい', '名前の字が先: ' + kana.firstLetters('さくら', 5).join(''));
ok(kana.firstLetters('', 5).join('') === 'あいうえか', '名前なし: ' + kana.firstLetters('', 5).join(''));
ok(kana.firstLetters('ゆうな', 5).length === 5 && kana.firstLetters('じゅり', 5).slice(0, 2).join('') === 'じり', '小さい字は飛ばす');
ok(kana.firstLetters('ぬめ', 5).slice(0,2).join('') === 'ぬめ', '名前に似た字があってもそのまま');
// --- 選択肢: 似た字を並べない ---
let seed = 1; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let t = 0; t < 3000; t++) {
  const target = H.order[Math.floor(rng() * H.order.length)];
  const known = H.order.filter(() => rng() < 0.5);
  const n4 = 2 + Math.floor(rng() * 3);
  const ch = logic.makeChoices(H, target, n4, 'easy', known, rng);
  ok(ch.length === n4 && ch.includes(target) && new Set(ch).size === n4, '選択肢の数');
  for (const a of ch) for (const b of ch) if (a !== b) { ok(!(H.similar[a] || []).includes(b), `似た字が同じ問題に出た: ${a} ${b}`); ok(H.same[a] !== b, '同じ音'); }
}
// 見くらべ問題では似た字が入る
{ const ch = logic.makeChoices(H, 'ぬ', 4, 'compare', ['ぬ', 'め', 'の', 'あ', 'か', 'さ'], rng); ok(ch.includes('め') || ch.includes('の'), '見くらべ ' + ch); ok(!(ch.includes('お') && ch.includes('を')), ''); }

// --- 90日間のシミュレーション ---
function simulate(name, pCorrect, days, skipDays) {
  const kid = { name: '', nameKana: name, minutes: 10, srs: { hira: {}, kata: {} }, log: {}, day: 0, lastDone: -1, kataOn: false, showcase: [] };
  let comparesBeforeLearned = 0, compares = 0, maxQ = 0, firstCompareDay = null;
  for (let d = 0; d < days; d++) {
    const today = 20000 + d;
    if (skipDays && skipDays(d)) continue;
    const plan = logic.buildSession(kid, today, rng);
    const key = srs.dayString(today); kid.log[key] = { sec: 0, q: 0, ok: 0, ep: 0 };
    const queue = plan.qs.slice(); let count = 0;
    if (d === 0) { ok(plan.qs.filter(q => q.type === 'teach').length === 5, '初日は5文字'); ok(plan.qs.filter(q => q.type === 'teach').map(q=>q.id).join('') === kana.firstLetters(name,5).join(''), '初日は名前の字'); }
    else ok(plan.qs.filter(q => q.type === 'teach' && q.script === 'hira').length <= 2, '2日目以降は新しい字は2つまで');
    while (queue.length) {
      const q = queue.shift(); if (q.type === 'teach' || q.type === 'word') continue;
      count++;
      const st = kid.srs[q.script];
      if (q.type === 'compare') { compares++; if (firstCompareDay == null) firstCompareDay = d; if (!(st[q.id] && st[q.id].b >= 3)) comparesBeforeLearned++; }
      const correct = rng() < pCorrect(q, st[q.id]);
      srs.answer(st, q.id, correct, today); kid.log[key].q++; if (correct) kid.log[key].ok++;
      if (!correct && q.kind !== 'again') queue.splice(Math.min(2, queue.length), 0, { script: q.script, id: q.id, type: 'pick', kind: 'again' });
    }
    maxQ = Math.max(maxQ, count);
    kid.day++;
  }
  const seen = Object.keys(kid.srs.hira).length, learned = Object.values(kid.srs.hira).filter(r => r.b >= 3).length;
  return { seen, learned, compares, comparesBeforeLearned, maxQ, firstCompareDay, kataSeen: Object.keys(kid.srs.kata).length, kid };
}
const good = simulate('さくら', () => 0.9, 90);
const slow = simulate('さくら', (q, r) => (!r || r.b < 2) ? 0.5 : 0.75, 90);
const gaps = simulate('さくら', () => 0.85, 90, d => d % 7 >= 5 || (d > 30 && d < 45));
console.log('よくできる子 90日:', JSON.stringify({ ...good, kid: undefined }));
console.log('ゆっくりの子 90日:', JSON.stringify({ ...slow, kid: undefined }));
console.log('休みが多い子 90日:', JSON.stringify({ ...gaps, kid: undefined }));
ok(good.seen >= 46, 'よくできる子は90日で46文字に届く: ' + good.seen);
ok(slow.seen >= 12 && slow.seen < good.seen, 'ゆっくりの子は文字を増やしすぎない: ' + slow.seen);
ok(good.comparesBeforeLearned === 0 && slow.comparesBeforeLearned === 0, '見くらべは慣れてから');
ok(good.compares > 0, '慣れたら見くらべが出る');
ok(good.maxQ <= 16 && slow.maxQ <= 18, '1日の問題数が多すぎない: ' + good.maxQ + ',' + slow.maxQ);
console.log('test-sister: ' + n + ' 件の点検すべてOK');
