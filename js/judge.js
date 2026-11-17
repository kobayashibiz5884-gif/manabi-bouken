// 声の答えの判定（画面に依存しない計算）。
// 方針: 子どもの声は聞き取りが外れやすいので「正しく言えたのに不正解」をできるだけ減らす。
//       ただし、別の読み（山を「さん」など、出題と違うことば）は正解にしない。
(function (root) {
  'use strict';

  function toHira(s) { return s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); }); }
  var DIGIT = { '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九' };

  // 日本語の聞き取り結果をそろえる: 全角→半角、カタカナ→ひらがな、空白と記号を取る
  function normJa(s) {
    s = String(s || '');
    if (s.normalize) s = s.normalize('NFKC');
    s = toHira(s).toLowerCase();
    return s.replace(/[\s、。，．,.!！?？「」『』（）()・…〜~\-]/g, '');
  }
  // 数字を漢数字に直した形（「3つ」→「三つ」、「10円」→「十円」、「100円」→「百円」、「1000」→「千」）
  function digitsToKanji(s) {
    return s.replace(/1000/g, '千').replace(/100/g, '百').replace(/10/g, '十').replace(/[0-9]/g, function (d) { return DIGIT[d]; });
  }
  function stripLong(s) { return s.replace(/ー/g, ''); }
  function isKana(s) { return /^[ぁ-ゖー]+$/.test(s); }
  function hasKanji(s) { return /[一-鿿々]/.test(s); }
  function isAscii(s) { return /^[\x00-\x7f]+$/.test(s); }

  function editDistance(a, b) {
    var m = a.length, n = b.length, i, j;
    if (Math.abs(m - n) > 2) return 3;
    var prev = [], cur = [];
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  // 1つの聞き取り結果 t と、1つの正解候補 a を比べる
  function matchJa(t, a) {
    if (!t || !a) return false;
    if (t === a) return true;
    var t2 = stripLong(t), a2 = stripLong(a);
    if (t2 && t2 === a2) return true; // 「にー」と「に」
    // 「ふくまれていれば正解」にしてよい候補か:
    //   漢字を含む候補（山 → 「山です」）、または かな2文字以上（やま → 「えっと、やま」）。
    //   かな1文字（き、め、て）や数字・英字（1, 10）は、ぴったり一致のときだけ。
    var containOk = !isAscii(a) && (hasKanji(a) || a.length >= 2);
    if (containOk && t.indexOf(a) >= 0) return true;
    // かな4文字以上は、1文字ちがいまで正解（聞き取りのゆれ。例: がっこう/かっこう）
    if (isKana(t2) && isKana(a2) && a2.length >= 4 && Math.abs(t2.length - a2.length) <= 1 && editDistance(t2, a2) <= 1) return true;
    return false;
  }

  // texts: 聞き取り結果の候補（複数）。 accepts: 正解にする文字列（読み、表示のことば、同音の漢字など）
  function judgeJa(texts, accepts) {
    var acc = accepts.map(normJa);
    for (var i = 0; i < texts.length; i++) {
      var t = normJa(texts[i]);
      if (!t) continue;
      var forms = [t, digitsToKanji(t)];
      for (var f = 0; f < forms.length; f++) {
        for (var j = 0; j < acc.length; j++) {
          if (matchJa(forms[f], acc[j]) || matchJa(forms[f], digitsToKanji(acc[j]))) return true;
        }
      }
    }
    return false;
  }

  // ---- 英語 ----
  function normEn(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // 聞き取りで入れ替わりやすい同じ音のことば
  var HOMOPHONES = {
    sun: ['son'], bee: ['be', 'b'], sea: ['see', 'c'], eye: ['i', 'aye'], bear: ['bare'], deer: ['dear'], flower: ['flour'],
    red: ['read'], blue: ['blew'], meat: ['meet'], pear: ['pair'], hair: ['hare'], ant: ['aunt'], knight: ['night'], bat: ['bad'],
    owl: ['all', 'our'], corn: ['con'], key: ['ki'], whale: ['wale', 'well'], boat: ['bolt', 'both'],
    ear: ['year', 'here'], hat: ['had', 'hut'], bus: ['boss', 'but'], egg: ['ag', 'eggs'], pig: ['pic', 'big'], cow: ['cal', 'how'],
    car: ['core', 'ka'], ball: ['bowl', 'bol'], sheep: ['ship', 'sheet'], rice: ['lice', 'rise'], rain: ['lane', 'rein', 'reign'],
    bread: ['bred', 'brad'], frog: ['flog'], bell: ['belle', 'bel'], map: ['mop'], fire: ['fyre', 'fier'], cloud: ['crowd', 'clout'],
    clock: ['clark', 'crock'], sword: ['soared', 'sord'], drum: ['dram'], medal: ['metal', 'meddle'], moon: ['mun'], star: ['stir'],
    tree: ['three', 'tri'], book: ['buck'], milk: ['mill'], fish: ['fisch'], bird: ['bard', 'birdie'], dog: ['doug', 'dock'], cat: ['cut', 'kat'],
    foot: ['food', 'put'], hand: ['and'], nose: ['knows', 'nos'], horse: ['hoarse'], cake: ['kate'], snow: ['no', 'know'], bike: ['bicycle', 'bake'],
    plane: ['plain'], airplane: ['plane', 'aeroplane', 'air plane'], ship: ['sheep'], crocodile: ['alligator'], lightning: ['thunder', 'lightening'],
    'ice cream': ['icecream', 'i scream'], grapes: ['grape'], cherry: ['cherries'], scissors: ['scissor'], train: ['trained'], house: ['home'],
    mouth: ['lips'], rabbit: ['bunny'], chicken: ['hen', 'rooster'], turtle: ['tortoise'], pink: ['ping'], white: ['wight', 'why'],
    black: ['block'], green: ['grin'], purple: ['people'], yellow: ['hello'], orange: ['oranges'], water: ['what are'], rocket: ['rock it'],
    castle: ['cassel'], island: ['iland'], ghost: ['goes'], robot: ['row but'], candle: ['kendall'], crown: ['clown'], peach: ['pitch', 'beach'],
    lemon: ['lemmon'], onion: ['union'], shark: ['shock'], snake: ['snack'], spider: ['spyder'], shield: ['sealed'], anchor: ['anger', 'anker'],
    dinosaur: ['dino'], cookie: ['cookies', 'cooky'], pencil: ['pencils'], mountain: ['mountains'], penguin: ['penguins']
  };
  function enForms(word, alts) {
    var out = [word].concat(alts || []).concat(HOMOPHONES[word] || []);
    var more = [];
    out.forEach(function (w) {
      if (/[^s]$/.test(w)) more.push(w + 's');
      if (/(s|x|ch|sh)$/.test(w)) more.push(w + 'es');
      if (/y$/.test(w)) more.push(w.slice(0, -1) + 'ies');
      if (/s$/.test(w) && w.length > 3) more.push(w.slice(0, -1));
    });
    return out.concat(more);
  }
  function judgeEn(texts, word, alts) {
    var forms = enForms(word, alts);
    for (var i = 0; i < texts.length; i++) {
      var t = normEn(texts[i]);
      if (!t) continue;
      var padded = ' ' + t + ' ', joined = t.replace(/ /g, '');
      var tokens = t.split(' ');
      for (var j = 0; j < forms.length; j++) {
        var f = forms[j];
        if (padded.indexOf(' ' + f + ' ') >= 0) return true;
        if (joined === f.replace(/ /g, '')) return true; // 「water melon」と「watermelon」
        // 長いことばは、つづり1〜2文字ぶんのゆれまで正解
        var fj = f.replace(/ /g, '');
        if (fj.length >= 6) {
          var lim = fj.length >= 9 ? 2 : 1;
          for (var k = 0; k < tokens.length; k++) if (editDistance(tokens[k], fj) <= lim) return true;
          if (editDistance(joined, fj) <= lim) return true;
        }
      }
    }
    return false;
  }

  // ---- 声の合図（パス／もういちど）----
  function command(texts, lang) {
    for (var i = 0; i < texts.length; i++) {
      if (lang === 'en') {
        var e = normEn(texts[i]);
        if (/\b(pass|skip|i don't know|i dont know)\b/.test(e)) return 'pass';
        if (/\b(again|one more time|repeat)\b/.test(e)) return 'again';
      }
      var t = normJa(texts[i]);
      if (/ぱす|わからない|わかんない|わかりません|とばして/.test(t)) return 'pass';
      if (/もういちど|もういっかい|もう1回|もう一回|もう一度|もう1度/.test(t)) return 'again';
    }
    return null;
  }

  var api = { normJa: normJa, judgeJa: judgeJa, matchJa: matchJa, normEn: normEn, judgeEn: judgeEn, enForms: enForms,
    command: command, editDistance: editDistance, digitsToKanji: digitsToKanji };
  root.MB = root.MB || {};
  root.MB.judge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
