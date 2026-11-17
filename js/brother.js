// 兄モード: ことだまの いせき。画面の漢字や絵を見て、声で答えて進む冒険。
// 声の聞き取りが使えない・うまくいかないときは、自動でボタン（3択）に切り替わる。
(function (root) {
  'use strict';
  var MB = root.MB, store = MB.store, audio = MB.audio, ui = MB.ui, speech = MB.speech, judge = MB.judge,
    logic = MB.brotherLogic, kanji = MB.kanji, english = MB.english, story = MB.story;
  var $ = ui.$, $all = ui.$all, tap = ui.tap, wait = ui.wait, esc = ui.esc;
  var session = null;
  var GUARD_MAX = 3;
  var FATAL = ['not-allowed', 'service-not-allowed', 'unsupported', 'audio-capture', 'start-failed'];

  function k() { return store.kid('bro'); }
  function say(t, opts) { return audio.speak(t, opts || { pitch: 1.0, rate: 1.0 }); }
  function sayEn(t) { return audio.speak(t, { lang: 'en-US', rate: 0.85, pitch: 1.0 }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---- 兄のホーム ----
  function home() {
    MB.app.stopTimer(); audio.stop(); speech.stop(); session = null;
    var kid = k(), n = kid.day, status = store.canPlay(kid);
    var total = story.DAYS.length;
    var ch = story.chapterOf(n);
    var cells = '';
    for (var i = 0; i < total; i++) {
      var c = story.CHAPTERS[Math.floor(i / 5)];
      cells += '<span class="' + (i < n ? 'done' : (i === n ? 'now' : '')) + '">' + (i < n ? (story.isBoss(i) ? c.shard : '✓') : (story.isBoss(i) ? '👑' : c.icon)) + '</span>';
    }
    var shards = story.CHAPTERS.map(function (c, i) { return '<span class="' + (kid.treasures.indexOf(i) >= 0 ? '' : 'off') + '">' + c.shard + '</span>'; }).join('');
    ui.render('<div class="bro-home"><button class="corner-btn" id="back">🏠</button>' +
      '<p class="bro-title">ことだまの いせき</p>' +
      '<p class="bro-chapter">' + (n < total ? 'だい' + (Math.floor(n / 5) + 1) + 'しょう ' + ch.name : 'おまけ：ちずに ない しま') + '</p>' +
      '<div class="shards">' + shards + '</div>' +
      '<div class="map">' + cells + '</div>' +
      (status === 'ok' ? '<button class="start-btn" id="start">だい ' + (n + 1) + ' わ ▶</button>'
        : '<p class="tbc">つづきは、また あした</p><div class="big-emoji">🌙</div>') +
      '</div>', 'bg-bro');
    tap($('#back'), MB.app.home);
    if (status === 'ok') tap($('#start'), play);
    else {
      var t = setTimeout(function () { say(status === 'done' ? '今日のぼうけんは、ここまで。続きは、また明日。' : '今日は、もうおしまい。続きは、また明日。'); }, 400);
      ui.onCleanup(function () { clearTimeout(t); });
    }
  }

  function srender(html) {
    var s = session;
    if (s) s.rendering = true;
    ui.render(html, 'bg-bro');
    if (s) {
      s.rendering = false;
      ui.onCleanup(function () { if (!s.rendering) { s.alive = false; MB.app.stopTimer(); speech.stop(); audio.stop(); } });
    }
  }

  // ---- 語り（物語）。読み上げが終わると自動で次へ。スキップもできる ----
  async function narrate(s, title, art, lines) {
    var skipped = false;
    for (var i = 0; i < lines.length && s.alive && !skipped; i++) {
      srender('<div class="bro-play"><button class="corner-btn small" id="quit">🏠</button><div class="story">' +
        '<p class="story-title">' + esc(title) + '</p><div class="story-art">' + art + '</div>' +
        '<p class="story-line">' + audio.rubyHtml(lines[i]) + '</p>' +
        '<button class="skip-btn" id="skip">スキップ ⏭</button></div></div>');
      tap($('#quit'), home);
      var skipP = new Promise(function (r) { tap($('#skip'), function () { skipped = true; audio.stop(); r(); }); });
      await Promise.race([say(audio.ttsText(lines[i])).then(function () { return wait(350); }), skipP]);
    }
  }

  // ---- 1日分のあそび ----
  async function play() {
    var kid = k(), today = store.today(), n = kid.day;
    var day = story.dayData(n), boss = story.isBoss(n);
    var s = session = { alive: true, kid: kid, today: today, n: n, day: day, boss: boss, queue: logic.buildSession(kid, today, boss),
      voice: kid.useVoice && speech.supported(), notes: 0, songs: 0, guard: 0, streak: 0, done: 0, timeUp: false, melody: story.melody(n), saidEn: false, results: [] };
    s.total = s.queue.length;
    MB.app.startTimer(kid, function () { s.timeUp = true; });

    await narrate(s, 'だい' + (n + 1) + 'わ　' + day.t, day.art, day.intro);
    if (!s.alive) return;
    var midDone = false;
    while (s.queue.length && s.alive) {
      if (s.timeUp && s.done >= 3) break;
      var q = s.queue.shift();
      if (q.mode === 'new') await teach(s, q);
      if (!s.alive) return;
      await ask(s, q);
      if (!s.alive) return;
      s.done++;
      store.save();
      if (!midDone && s.done >= Math.ceil(s.total / 2) && s.queue.length) { midDone = true; await narrate(s, day.t, day.art, day.mid); }
    }
    if (!s.alive) return;
    await ending(s);
  }

  // ---- 画面の部品 ----
  function topbar(s) {
    var notes = s.melody.map(function (_, i) { return '<span class="' + (i < s.notes ? '' : 'off') + '">🎵</span>'; }).join('');
    var eyes = s.guard === 0 ? '💤' : new Array(s.guard + 1).join('👁');
    return '<button class="corner-btn small" id="quit">🏠</button><div class="bro-top"><div class="notes">' + notes + '</div>' +
      '<div class="guard"><b>' + s.day.guard + '</b> ' + eyes + '</div></div>';
  }
  function wordHtml(q) {
    var w = q.q[0], cls = w.length >= 5 ? 'len5' : (w.length === 4 ? 'len4' : (w.length === 3 ? 'len3' : ''));
    return '<div class="seal-word ' + cls + '">' + w.split('').map(function (c) { return c === q.id ? '<span class="tk">' + c + '</span>' : c; }).join('') + '</div>';
  }

  // まだ習っていない漢字の紹介
  async function teach(s, q) {
    var item = logic.kanjiQuestion(q.id, null), r = kanji.readings(item)[0];
    q.q = item;
    srender('<div class="bro-play">' + topbar(s) + '<div class="seal"><div class="seal-who">あたらしい ふういん</div>' +
      '<div class="seal-card">' + wordHtml(q) + '</div><div class="seal-hint">' + item[2] + '</div>' +
      '<div class="answer-show">' + r + '</div><div class="mic" id="mic"></div></div></div>');
    tap($('#quit'), home);
    await say('新しいふういんだ。これは、「' + r + '」と読む。いっしょに、となえよう。' + r + '！');
    if (!s.alive) return;
    if (s.voice) {
      var mic = $('#mic'); if (mic) { mic.textContent = '🎤 となえて みよう'; mic.className = 'mic on'; }
      var acc = kanji.accepts(item);
      var r1 = await speech.listen({ lang: 'ja-JP', timeout: 5000, onHeard: function (t) { return judge.judgeJa(t, acc); } });
      if (r1.error && FATAL.indexOf(r1.error) >= 0) s.voice = false;
      if (r1.accepted) audio.sfx.pop();
    } else {
      await wait(600);
    }
  }

  // ---- 1問 ----
  // 返り値なし。結果は記録に書く。
  async function ask(s, q) {
    var isEn = q.kind === 'en';
    var st = isEn ? s.kid.srs.en : s.kid.srs.kanji;
    var item, accepts, answerText, hintHtml, choices;
    if (isEn) {
      item = english.byWord[q.id];
      answerText = item.w;
      hintHtml = '<span style="font-size:26px">' + item.ja + '　' + item.w[0] + new Array(item.w.length).join(' ･') + '</span>';
      choices = logic.englishChoices(q.id);
    } else {
      q.q = q.q || logic.kanjiQuestion(q.id, st[q.id]);
      item = q.q;
      accepts = kanji.accepts(item);
      answerText = kanji.readings(item)[0];
      hintHtml = item[2];
      choices = logic.kanjiChoices(item);
    }
    var lang = isEn ? 'en-US' : 'ja-JP';
    function isRight(texts) { return isEn ? judge.judgeEn(texts, item.w, item.alts) : judge.judgeJa(texts, accepts); }

    srender('<div class="bro-play">' + topbar(s) + '<div class="seal">' +
      '<div class="seal-who">' + (isEn ? '🦜 いこくの ふういん（えいごで こたえよう）' : (s.boss ? '👑 ' + esc(s.day.boss) + 'の ふういん' : 'ふういんを よめ！')) + '</div>' +
      '<div class="seal-card' + (isEn ? ' en' : '') + '" id="card">' + (isEn ? '<div class="seal-emoji">' + item.emoji + '</div>' : wordHtml(q)) + '</div>' +
      '<div class="seal-hint" id="hint"></div><div class="answer-show" id="ans"></div>' +
      '<div class="mic" id="mic"></div><div class="heard" id="heard"></div>' +
      '<div class="bro-choices" id="choices"></div></div>' +
      '<div class="bro-btns"><button class="bro-mini" id="pass">⏭ パス</button>' + (s.voice ? '<button class="bro-mini" id="btnmode">🔘 ボタンで こたえる</button>' : '') + '</div></div>');
    tap($('#quit'), home);

    var outcome = null;          // 'first' | 'assisted' | 'fail'
    var hinted = false, choiceShown = false, settled = false, settle;
    var settledP = new Promise(function (r) { settle = r; });
    function finish(o) { if (settled) return; settled = true; outcome = o; speech.stop(); settle(); }
    function setMic(text, on) { var m = $('#mic'); if (m) { m.textContent = text; m.className = 'mic' + (on ? ' on' : ''); } }
    function showHint() { hinted = true; var h = $('#hint'); if (h) h.innerHTML = hintHtml; }
    function showChoices() {
      if (choiceShown) return; choiceShown = true;
      var box = $('#choices'); if (!box) return;
      box.innerHTML = choices.map(function (c) { return '<button class="bro-choice" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
      $all('.bro-choice').forEach(function (b) {
        tap(b, function () {
          if (settled || b.disabled) return;
          if (b.getAttribute('data-c') === (isEn ? item.w : answerText)) { b.classList.add('right'); finish(hinted || usedVoiceTry ? 'assisted' : 'first'); }
          else { b.disabled = true; b.classList.add('fade'); audio.sfx.soft(); hinted = true; showHint(); }
        });
      });
    }
    var usedVoiceTry = false;
    tap($('#pass'), function () { finish('fail'); });
    if (s.voice) tap($('#btnmode'), function () { s.voice = false; speech.stop(); showChoices(); setMic('ボタンで こたえよう'); });

    // 出題のかけ声（短く）
    if (isEn && !s.saidEn) { s.saidEn = true; await say('いこくのふういんだ。絵を見て、英語で答えよう。'); }
    else if (s.done === 0) await say('ふういんを、読め！');
    else audio.sfx.tap();
    if (!s.alive) return;

    if (!s.voice) {
      showChoices(); setMic('こたえを えらぼう');
      await settledP;
    } else {
      // 声で答える: 最大3回聞く。1回目でだめならヒント、2回目でだめならボタンも出す
      (async function voiceLoop() {
        for (var round = 0; round < 3 && !settled && s.alive; round++) {
          setMic('🎤 きいているよ…', true);
          var cmd = null;
          var r = await speech.listen({ lang: lang, timeout: round === 0 ? 8000 : 7000, onHeard: function (texts) {
            var h = $('#heard'); if (h) h.textContent = '「' + texts[0] + '」';
            if (isRight(texts)) return true;
            cmd = judge.command(texts, isEn ? 'en' : 'ja');
            return !!cmd;
          } });
          if (settled || !s.alive || !s.voice) return;
          setMic('');
          if (r.error && FATAL.indexOf(r.error) >= 0) {
            // 聞き取りが使えない: この回はボタンに切り替える
            s.voice = false; s.voiceError = r.error;
            showChoices(); setMic('こえが つかえないので、ボタンで こたえよう');
            return;
          }
          if (r.accepted && !cmd) { finish(hinted ? 'assisted' : 'first'); return; }
          if (cmd === 'pass') { finish('fail'); return; }
          if (cmd === 'again') { round--; await say(isEn ? 'もういちど。絵を見て、英語で答えよう。' : 'もういちど。ふういんを、読め！'); continue; }
          // だめだった（ちがうことばが聞こえた、または何も聞こえなかった）
          usedVoiceTry = true;
          var c = $('#card'); if (c && r.all.length) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
          if (round === 0) { showHint(); await say(r.all.length ? 'おしい！ヒントを見て、もういちど。' : 'ヒントだよ。大きな声で、もういちど。'); }
          else if (round === 1) { showChoices(); await say('ボタンで選んでもいいよ。'); }
        }
        if (!settled && s.alive) {
          // 3回聞いてもだめ: ボタンが出ているので、少しだけ待ってから答えを見せる
          setMic('ボタンでも こたえられるよ');
          await wait(6000);
          finish('fail');
        }
      })();
      await settledP;
    }
    if (!s.alive) return;
    speech.stop();
    setMic('');
    var info = logic.record(s.kid, q, outcome, s.today);
    store.countAnswer(s.kid, outcome === 'first');
    s.results.push(outcome);
    var ans = $('#ans'); if (ans) ans.textContent = isEn ? item.w + '（' + item.ja + '）' : answerText;
    $all('.bro-choice, .bro-mini').forEach(function (b) { b.disabled = true; });

    if (outcome === 'fail') {
      audio.sfx.soft();
      showHint();
      s.streak = 0; s.guard++;
      if (isEn) { await say('これは、'); await sayEn(item.w); await say(item.ja + '、だよ。'); }
      else await say('これは、「' + answerText + '」と読む。');
      if (!s.alive) return;
      // 声に出して言ってみる（言えても言えなくても先へ進む）
      if (s.voice) {
        setMic('🎤 いっしょに いってみよう', true);
        var rr = await speech.listen({ lang: lang, timeout: 4500, onHeard: function (t) { return isRight(t); } });
        if (!s.alive) return;
        setMic('');
        if (rr.accepted) { audio.sfx.pop(); await say('そう！'); }
      }
      // あとでもう一度出す
      if (q.mode !== 'again') s.queue.splice(Math.min(2, s.queue.length), 0, { kind: q.kind, id: q.id, mode: 'again', q: q.q });
    } else {
      var card = $('#card'); if (card) card.classList.add('broken');
      audio.sfx.seal();
      if (outcome === 'first') {
        s.streak++;
        if (s.guard > 0 && s.streak >= 2) s.guard--;
      } else {
        s.streak = 0; s.guard++;
        if (q.mode !== 'again') s.queue.splice(Math.min(3, s.queue.length), 0, { kind: q.kind, id: q.id, mode: 'again', q: q.q });
      }
      await wait(350);
      // メロディの音がひとつ増える
      s.notes++;
      audio.sfx.note(s.melody[(s.notes - 1) % s.melody.length]);
      if (isEn) await sayEn(item.w + '!'); else await say(answerText + '！');
      if (info.levelChange > 0) await say('すごい！いこくのふういんが、レベル' + s.kid.enLevel + 'になった！');
      if (s.notes >= s.melody.length && s.queue.length) {
        var ms = audio.sfx.melody(s.melody, s.melody.length, 0.22); await wait(ms);
        s.songs++; s.notes = 0;
      }
    }
    if (!s.alive) return;
    if (s.guard >= GUARD_MAX) await hide(s);
  }

  // 番人が目をさました: 物かげに隠れてやりすごす（ゲームオーバーにはしない）
  async function hide(s) {
    var el = document.createElement('div');
    el.className = 'hide-scene';
    el.innerHTML = '<div class="big-emoji">' + s.day.guard + '</div><div>👁👁👁</div><div>かくれろ！</div><div class="big-emoji">🫣</div>';
    document.body.appendChild(el);
    audio.sfx.alert();
    await say(s.boss ? 'あぶない！かくれて、たいせいを立てなおそう。' : 'ばんにんが、目をさました！かくれろ！');
    await wait(1200);
    await say('……だいじょうぶ。また、ねむったよ。つづけよう。');
    el.remove();
    s.guard = 0; s.streak = 0;
  }

  // ---- おしまい: メロディで扉が開き、続きが気になるところで終わる ----
  async function ending(s) {
    var kid = s.kid, n = s.n;
    srender('<div class="bro-play"><div class="story"><div class="notes">' + s.melody.map(function () { return '<span>🎵</span>'; }).join('') + '</div><div class="door">🚪</div></div></div>');
    var ms = audio.sfx.melody(s.melody, s.melody.length, 0.3);
    await wait(ms);
    audio.sfx.door();
    await wait(900);
    if (!s.alive) return;
    if (s.boss && n < story.DAYS.length) {
      var ci = Math.floor(n / 5);
      if (kid.treasures.indexOf(ci) < 0) kid.treasures.push(ci);
      audio.sfx.fanfare();
    }
    store.finishEpisode(kid);
    MB.app.stopTimer();
    await narrate(s, s.day.t, s.boss ? story.chapterOf(n).shard + '✨' : '🚪✨', s.day.end);
    if (!s.alive) return;
    var first = s.results.filter(function (r) { return r === 'first'; }).length;
    srender('<div class="bro-play"><div class="story"><div class="story-art">' + (s.boss ? story.chapterOf(n).shard : '🌙') + '</div>' +
      '<p class="tbc">つづきは、また あした</p>' +
      '<p class="story-line" style="text-align:center;min-height:0">きょう といた ふういん： ' + s.results.length + '<br>いっぱつで といた： ' + first + '</p>' +
      '<button class="skip-btn" id="end">おわる</button></div></div>');
    tap($('#end'), home);
  }

  MB.brother = { home: home, play: play };
})(self);
