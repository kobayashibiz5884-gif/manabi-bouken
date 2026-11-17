// 親の画面: はじめの設定、暗証番号、記録、設定、声のテスト、記録の控え。
(function (root) {
  'use strict';
  var MB = root.MB, store = MB.store, audio = MB.audio, ui = MB.ui, srs = MB.srs;
  var $ = ui.$, $all = ui.$all, tap = ui.tap, esc = ui.esc;
  var tab = 'sis';

  function hashPin(p) { var h = 7; for (var i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) % 1000003; return 'h' + h; }
  function onlyHira(s) { return MB.kana.toHira(String(s || '')).replace(/[^ぁ-ゖー]/g, ''); }

  // ---- はじめの設定 ----
  function setup() {
    ui.render(
      '<div class="parent"><h1>はじめの設定（おとなの方へ）</h1>' +
      '<p class="note">ここで入力した内容と、お子さんの記録は、<b>このiPhoneの中だけ</b>に保存されます。インターネットには送られません。</p>' +
      '<label>親の画面の暗証番号（数字4けた）<input id="pin" type="tel" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="例: 2580"></label>' +
      '<h2>👸 妹さん</h2>' +
      '<label>画面に出す呼び名（空欄でも可）<input id="sisName" type="text" maxlength="10" placeholder="例: ひめ"></label>' +
      '<label>なまえ（ひらがな）— 最初に覚える5文字に使います<input id="sisKana" type="text" maxlength="12" placeholder="ひらがなで"></label>' +
      '<p class="note small" id="firstPreview"></p>' +
      '<h2>🗝️ お兄ちゃん</h2>' +
      '<label>画面に出す呼び名（空欄でも可）<input id="broName" type="text" maxlength="10" placeholder="例: たんけんか"></label>' +
      '<p class="err" id="err"></p>' +
      '<button class="btn primary" id="save">保存して はじめる</button>' +
      '</div>', 'bg-parent');
    function preview() {
      var k = onlyHira($('#sisKana').value);
      $('#firstPreview').textContent = '最初の5文字: ' + MB.kana.firstLetters(k, 5).join('・') + '（名前の文字が先。足りない分は「あいうえお」から、形が似ていない字を足します）';
    }
    $('#sisKana').addEventListener('input', preview); preview();
    tap($('#save'), function () {
      var pin = $('#pin').value.trim();
      if (!/^\d{4}$/.test(pin)) { $('#err').textContent = '暗証番号は数字4けたで入れてください。'; return; }
      var s = store.get();
      s.pin = hashPin(pin);
      s.kids.sis.name = $('#sisName').value.trim();
      s.kids.sis.nameKana = onlyHira($('#sisKana').value);
      s.kids.bro.name = $('#broName').value.trim();
      s.setupDone = true;
      store.save();
      MB.app.home();
    });
  }

  // ---- 暗証番号 ----
  function open() {
    audio.stop();
    ui.render('<div class="parent"><button class="link" id="back">← もどる</button><h1>おとなの画面</h1>' +
      '<label>暗証番号（数字4けた）<input id="pin" type="tel" inputmode="numeric" maxlength="4" autocomplete="off"></label>' +
      '<p class="err" id="err"></p><button class="btn primary" id="go">ひらく</button></div>', 'bg-parent');
    tap($('#back'), MB.app.home);
    function go() {
      if (hashPin($('#pin').value.trim()) === store.get().pin) main(); else { $('#err').textContent = '暗証番号がちがいます。'; $('#pin').value = ''; }
    }
    tap($('#go'), go);
    $('#pin').addEventListener('input', function () { if ($('#pin').value.length === 4) go(); });
  }

  // ---- 本体 ----
  function main() {
    var tabs = [['sis', '👸 妹'], ['bro', '🗝️ 兄'], ['set', '⚙️ 設定'], ['voice', '🎤 声のテスト']];
    ui.render('<div class="parent"><button class="link" id="back">← 子どもの画面にもどる</button>' +
      '<div class="tabs">' + tabs.map(function (t) { return '<button class="tab' + (t[0] === tab ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="body"></div></div>', 'bg-parent');
    tap($('#back'), MB.app.home);
    $all('.tab').forEach(function (b) { tap(b, function () { tab = b.getAttribute('data-t'); main(); }); });
    var body = $('#body');
    if (tab === 'sis') body.innerHTML = kidReport('sis');
    else if (tab === 'bro') body.innerHTML = kidReport('bro');
    else if (tab === 'set') settings(body);
    else voiceTest(body);
  }

  function fmtMin(sec) { return sec < 60 ? sec + '秒' : Math.floor(sec / 60) + '分' + (sec % 60 ? (sec % 60) + '秒' : ''); }
  function chips(ids, cls) { return ids.length ? '<div class="chips">' + ids.map(function (i) { return '<span class="chip ' + (cls || '') + '">' + esc(i) + '</span>'; }).join('') + '</div>' : '<p class="note small">まだありません</p>'; }

  function section(title, st, today, orderHint) {
    var sum = srs.summary(st, today);
    function sortIds(a) { return orderHint ? a.sort(function (x, y) { return orderHint.indexOf(x) - orderHint.indexOf(y); }) : a.sort(); }
    var weak = sortIds(sum.weak.slice());
    var learning = sortIds(sum.learning.filter(function (i) { return sum.weak.indexOf(i) < 0; }));
    return '<h2>' + title + '</h2>' +
      '<h3>おぼえた（' + sum.learned.length + '）</h3>' + chips(sortIds(sum.learned.slice()), 'ok') +
      '<h3>れんしゅう中（' + learning.length + '）</h3>' + chips(learning) +
      '<h3>にがて（' + weak.length + '）</h3>' + chips(weak, 'weak') +
      '<p class="note small">「おぼえた」= 日をあけて3回以上つづけて正解。「にがて」= 最近まちがいが多いもの。今日の復習予定: ' + sum.due + '</p>';
  }

  function kidReport(id) {
    var k = store.kid(id), today = store.today();
    var days = Object.keys(k.log).sort().reverse();
    var total = days.reduce(function (a, d) { return a + k.log[d].sec; }, 0);
    var html = '<div class="cards"><div class="card"><b>' + fmtMin(store.secondsToday(k)) + '</b><span>今日（上限 ' + k.minutes + '分）</span></div>' +
      '<div class="card"><b>' + k.day + '</b><span>' + (id === 'sis' ? '作ったお菓子' : '進んだ話数') + '</span></div>' +
      '<div class="card"><b>' + days.length + '日</b><span>遊んだ日数（計 ' + fmtMin(total) + '）</span></div></div>';
    if (id === 'sis') {
      html += section('ひらがな', k.srs.hira, today, MB.kana.makeSet('hira').order);
      if (Object.keys(k.srs.kata).length || k.kataOn) html += section('カタカナ', k.srs.kata, today, MB.kana.makeSet('kata').order);
      else html += '<p class="note">カタカナは、ひらがな46文字をひととおり出し終えて35文字以上おぼえると自動で始まります（設定から今すぐ始めることもできます）。</p>';
    } else {
      html += section('漢字', k.srs.kanji, today, MB.kanji ? MB.kanji.ORDER : null);
      html += section('英単語（いまのレベル ' + k.enLevel + ' / 5）', k.srs.en, today, null);
    }
    html += '<h2>遊んだ日</h2><table class="log"><tr><th>日付</th><th>時間</th><th>問題</th><th>1回目で正解</th></tr>' +
      (days.length ? days.slice(0, 30).map(function (d) { var l = k.log[d]; return '<tr><td>' + d + '</td><td>' + fmtMin(l.sec) + '</td><td>' + l.q + '</td><td>' + (l.q ? Math.round(l.ok / l.q * 100) + '%' : '-') + '</td></tr>'; }).join('')
        : '<tr><td colspan="4">まだ遊んでいません</td></tr>') + '</table>';
    return html;
  }

  function settings(body) {
    var s = store.get(), sis = s.kids.sis, bro = s.kids.bro;
    function minutesRow(id, k) {
      return '<div class="row"><span>1日に遊べる時間</span><span class="stepper"><button data-min="' + id + '" data-d="-5">−</button><b id="min-' + id + '">' + k.minutes + '分</b><button data-min="' + id + '" data-d="5">＋</button></span></div>';
    }
    var kanjiGrid = '';
    if (MB.kanji) {
      var learned = MB.brotherLogic.schoolSet(bro);
      kanjiGrid = '<h3>学校で習った漢字（タップで切り替え）</h3><p class="note small">色がついた字を先に出します。初期値は「小1の11月ごろ」の目安です。教科書によって順番が違うので、実際に合わせて直してください。</p>' +
        '<div class="kgrid">' + MB.kanji.ORDER.map(function (c) { return '<button class="kcell' + (learned.indexOf(c) >= 0 ? ' on' : '') + '" data-k="' + c + '">' + c + '</button>'; }).join('') + '</div>';
    }
    body.innerHTML =
      '<h2>👸 妹</h2>' +
      '<label>呼び名<input id="sisName" type="text" maxlength="10" value="' + esc(sis.name) + '"></label>' +
      '<label>なまえ（ひらがな）<input id="sisKana" type="text" maxlength="12" value="' + esc(sis.nameKana) + '"></label>' +
      '<p class="note small">名前の文字は、まだ1度も遊んでいないときだけ「最初の5文字」に反映されます。</p>' +
      minutesRow('sis', sis) +
      '<div class="row"><span>カタカナを今すぐ始める</span><button class="toggle' + (sis.kataOn ? ' on' : '') + '" id="kata">' + (sis.kataOn ? 'ON' : 'OFF') + '</button></div>' +
      '<div class="row"><span>今日もう1回 遊べるようにする</span><button class="btn small" data-bonus="sis">' + (sis.bonus === store.today() ? '許可ずみ' : '許可する') + '</button></div>' +
      '<h2>🗝️ 兄</h2>' +
      '<label>呼び名<input id="broName" type="text" maxlength="10" value="' + esc(bro.name) + '"></label>' +
      minutesRow('bro', bro) +
      '<div class="row"><span>声で答える（OFFにするとボタンで答える）</span><button class="toggle' + (bro.useVoice ? ' on' : '') + '" id="voice">' + (bro.useVoice ? 'ON' : 'OFF') + '</button></div>' +
      '<div class="row"><span>英単語のレベル（1〜5。ふだんは自動）</span><span class="stepper"><button data-lv="-1">−</button><b id="lv">' + bro.enLevel + '</b><button data-lv="1">＋</button></span></div>' +
      '<div class="row"><span>今日もう1話 遊べるようにする</span><button class="btn small" data-bonus="bro">' + (bro.bonus === store.today() ? '許可ずみ' : '許可する') + '</button></div>' +
      kanjiGrid +
      '<h2>記録の控え</h2><p class="note small">Safariの「履歴とWebサイトデータを消去」をすると記録も消えます。ときどき控えを取っておくと安心です。「控えをコピー」を押して、メモアプリなどに貼り付けて保存してください。</p>' +
      '<div class="row"><button class="btn small" id="exp">控えをコピー</button><button class="btn small" id="imp">控えから戻す</button></div>' +
      '<textarea id="backup" rows="3" placeholder="戻すときは、控えの文字をここに貼り付けてから「控えから戻す」"></textarea><p class="note small" id="bmsg"></p>' +
      '<h2>やり直し</h2>' +
      '<div class="row"><button class="btn small danger" data-reset="sis">妹の記録を消す</button><button class="btn small danger" data-reset="bro">兄の記録を消す</button></div>' +
      '<label>暗証番号を変える（数字4けた）<input id="newPin" type="tel" inputmode="numeric" maxlength="4" placeholder="新しい番号"></label>' +
      '<button class="btn primary" id="saveSet">入力した内容を保存</button><p class="note small" id="smsg"></p>' +
      '<p class="note small">版: ' + (MB.VERSION || '') + '</p>';
    $all('[data-min]').forEach(function (b) {
      tap(b, function () {
        var k = store.kid(b.getAttribute('data-min'));
        k.minutes = Math.max(5, Math.min(60, k.minutes + Number(b.getAttribute('data-d'))));
        store.save(); $('#min-' + b.getAttribute('data-min')).textContent = k.minutes + '分';
      });
    });
    $all('[data-lv]').forEach(function (b) {
      tap(b, function () { bro.enLevel = Math.max(1, Math.min(5, bro.enLevel + Number(b.getAttribute('data-lv')))); bro.enHist = ''; store.save(); $('#lv').textContent = bro.enLevel; });
    });
    tap($('#kata'), function () { sis.kataOn = !sis.kataOn; store.save(); main(); });
    tap($('#voice'), function () { bro.useVoice = !bro.useVoice; store.save(); main(); });
    $all('[data-bonus]').forEach(function (b) {
      tap(b, function () { store.kid(b.getAttribute('data-bonus')).bonus = store.today(); store.save(); b.textContent = '許可ずみ'; });
    });
    $all('[data-k]').forEach(function (b) {
      tap(b, function () {
        var set = MB.brotherLogic.schoolSet(bro).slice(), c = b.getAttribute('data-k'), i = set.indexOf(c);
        if (i >= 0) set.splice(i, 1); else set.push(c);
        bro.learnedKanji = set; store.save(); b.classList.toggle('on');
      });
    });
    tap($('#exp'), function () {
      var t = store.exportText();
      $('#backup').value = t;
      var done = function () { $('#bmsg').textContent = 'コピーしました。メモアプリなどに貼り付けて保存してください。'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { $('#backup').select(); $('#bmsg').textContent = '下の文字を全部選んでコピーしてください。'; });
      else { $('#backup').select(); $('#bmsg').textContent = '下の文字を全部選んでコピーしてください。'; }
    });
    tap($('#imp'), function () {
      if (!confirm('いまの記録を、貼り付けた控えで置きかえます。よろしいですか？')) return;
      try { store.importText($('#backup').value.trim()); $('#bmsg').textContent = '戻しました。'; } catch (e) { $('#bmsg').textContent = '戻せませんでした。控えの文字が途中で切れていないか確認してください。'; }
    });
    $all('[data-reset]').forEach(function (b) {
      tap(b, function () { if (confirm('本当に消しますか？ 元に戻せません。')) { store.resetKid(b.getAttribute('data-reset')); main(); } });
    });
    tap($('#saveSet'), function () {
      sis.name = $('#sisName').value.trim(); sis.nameKana = onlyHira($('#sisKana').value); bro.name = $('#broName').value.trim();
      var np = $('#newPin').value.trim();
      if (np && !/^\d{4}$/.test(np)) { $('#smsg').textContent = '暗証番号は数字4けたで入れてください。'; return; }
      if (np) s.pin = hashPin(np);
      store.save(); $('#smsg').textContent = '保存しました。';
    });
  }

  // ---- 声のテスト（お兄ちゃんの声が、このiPhoneでどのくらい聞き取れるかを確かめる）----
  function voiceTest(body) {
    var sp = MB.speech;
    var tests = [['ja-JP', 'やま', ['やま', '山']], ['ja-JP', 'がっこう', ['がっこう', '学校']], ['ja-JP', 'にちようび', ['にちようび', '日曜日']], ['ja-JP', 'き', ['き', '木', '気', '黄', 'キー']],
      ['en-US', 'apple', null], ['en-US', 'elephant', null]];
    body.innerHTML = '<h2>声のテスト</h2>' +
      '<p class="note">お兄ちゃんに、下のことばを1つずつ言ってもらってください。ボタンを押すと6秒間聞き取ります。「聞こえたことば」と ○× をメモしておくと、あとの調整に役立ちます。</p>' +
      '<p class="note"><b>この端末: </b>聞き取り機能 = ' + (sp.supported() ? 'あり' : '<b>なし（声で答える遊び方は使えません。ボタンで答える形になります）</b>') +
      ' ／ 開き方 = ' + (sp.standalone() ? 'ホーム画面のアイコンから' : 'Safariから') + '</p>' +
      '<p class="note small">最初の1回は「マイクの使用を許可しますか」と出ます。「許可」を押してください。ホーム画面のアイコンから開いたときに聞き取れない場合は、Safariから開いて同じテストをしてみてください。</p>' +
      tests.map(function (t, i) {
        return '<div class="vtest"><button class="btn small" data-v="' + i + '">🎤 「' + t[1] + '」と言う</button><span class="vres" id="vres' + i + '">まだ</span></div>';
      }).join('') +
      '<h3>読み上げの声のテスト</h3><p class="note small">妹モードの声です。「は」「へ」が正しく聞こえるか確かめてください。</p>' +
      '<div class="row"><button class="btn small" id="t1">「ハ」「ヘ」「ヲ」</button><button class="btn small" id="t2">おみせの声</button><button class="btn small" id="t3">英語の声</button></div>';
    $all('[data-v]').forEach(function (b) {
      tap(b, async function () {
        var i = Number(b.getAttribute('data-v')), t = tests[i], out = $('#vres' + i);
        out.textContent = '聞いています…（6秒）'; out.className = 'vres';
        var r = await sp.listen({ lang: t[0], timeout: 6000, onHeard: function (texts) { var o = $('#vres' + i); if (o) o.textContent = '聞こえた: ' + texts.join(' / '); return false; } });
        var o = $('#vres' + i); if (!o) return;
        var ok = t[2] ? MB.judge.judgeJa(r.all, t[2]) : MB.judge.judgeEn(r.all, t[1]);
        if (r.error && !r.all.length) { o.textContent = '× 聞き取れませんでした（' + errText(r.error) + '）'; o.className = 'vres ng'; }
        else if (!r.all.length) { o.textContent = '× 何も聞こえませんでした'; o.className = 'vres ng'; }
        else { o.textContent = (ok ? '○ ' : '× ') + '聞こえた: ' + r.all.join(' / '); o.className = 'vres ' + (ok ? 'ok' : 'ng'); }
      });
    });
    tap($('#t1'), function () { audio.speak('「ハ」。ハナの、ハ。「ヘ」。ヘビの、ヘ。「オ」。くっつきの、オ。'); });
    tap($('#t2'), function () { audio.speak('いらっしゃいませ！今日のお客さんは、うさぎさん。「ア」は、どれかな？', { pitch: 1.25 }); });
    tap($('#t3'), function () { audio.speak('Apple. Elephant. Great job!', { lang: 'en-US' }); });
  }
  function errText(e) {
    return ({ 'not-allowed': 'マイクが許可されていません。設定 → Safari → マイク を確認', 'service-not-allowed': 'この開き方では聞き取りが使えません。Safariから開いて試してください',
      'no-speech': '声が聞こえませんでした', 'audio-capture': 'マイクが使えません', network: 'インターネットにつながっていません', unsupported: 'この端末では使えません', aborted: '中断されました' })[e] || e;
  }

  MB.parent = { setup: setup, open: open, main: main };
})(self);
