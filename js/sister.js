// 妹モード: ポムひめの おかしやさん。字が読めなくても遊べるよう、説明はすべて声と絵で行う。
(function (root) {
  'use strict';
  var MB = root.MB, store = MB.store, audio = MB.audio, ui = MB.ui, srs = MB.srs, logic = MB.sisterLogic, kana = MB.kana;
  var $ = ui.$, $all = ui.$all, tap = ui.tap, wait = ui.wait;

  // お客さん: [絵文字, 読み上げる名前]
  var CUSTOMERS = [['🐰', 'うさぎさん'], ['🐻', 'くまさん'], ['🐱', 'ねこさん'], ['🦊', 'きつねさん'], ['🐼', 'パンダさん'], ['🐿️', 'りすさん'],
    ['🐧', 'ペンギンさん'], ['🐥', 'ひよこさん'], ['🐨', 'コアラさん'], ['🐘', 'ぞうさん'], ['🦁', 'ライオンさん'], ['🐸', 'かえるさん'],
    ['🐷', 'ぶたさん'], ['🐑', 'ひつじさん'], ['🐯', 'とらさん'], ['🐶', 'いぬさん'], ['🦄', 'ユニコーンさん']];
  // お菓子: [絵文字, 読み上げる名前]
  var SWEETS = [['🍰', 'いちごのケーキ'], ['🧁', 'カップケーキ'], ['🍩', 'ドーナツ'], ['🍪', 'クッキー'], ['🍮', 'プリン'], ['🍫', 'チョコレート'],
    ['🍭', 'ぺろぺろキャンディ'], ['🍡', 'おだんご'], ['🍦', 'ソフトクリーム'], ['🥞', 'ホットケーキ'], ['🧇', 'ワッフル'], ['🥧', 'パイ'],
    ['🍧', 'かきごおり'], ['🎂', 'おたんじょうびケーキ'], ['🍨', 'アイスクリーム'], ['🍬', 'キャンディ']];
  var INGREDIENTS = ['🥚', '🥛', '🧈', '🍓', '🍯', '🍫', '🍒', '🍋', '🌾', '🍎', '🍌', '🫐', '🥜', '🍑', '🍊', '🧂'];
  var TOPPINGS = ['🍓', '⭐', '💖', '🌸', '🍒', '🎀', '🍫', '✨'];
  var PRAISE = ['せいかい！', 'すごい！', 'やったね！', 'ぴんぽーん！', 'じょうず！', 'そのとおり！'];
  var session = null;

  function k() { return store.kid('sis'); }
  function say(t) { return audio.speak(t, { pitch: 1.25 }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---- 妹のホーム ----
  function home() {
    MB.app.stopTimer(); audio.stop(); session = null;
    var kid = k();
    var status = store.canPlay(kid);
    ui.render(
      '<div class="sis-home">' +
      '<button class="corner-btn" id="back" aria-label="もどる">🏠</button>' +
      '<div class="shop"><div class="shop-roof">🏰</div><div class="princess">👸</div><div class="shop-sign">🍰🧁🍩</div></div>' +
      (status === 'ok'
        ? '<button class="play-btn" id="play"><span>▶️</span></button>'
        : '<div class="tomorrow"><div class="big-emoji">🌙</div><div class="tomorrow-emoji">👋</div></div>') +
      '<button class="case-btn" id="case">🧁<span class="badge">' + kid.showcase.length + '</span></button>' +
      '</div>', 'bg-sis');
    tap($('#back'), MB.app.home);
    tap($('#case'), showcase);
    if (status === 'ok') {
      tap($('#play'), play);
    } else {
      var t = setTimeout(function () {
        say(status === 'done' ? '今日のお菓子は、もうできたよ。また明日、遊ぼうね！' : '今日は、もうおしまい。また明日、遊ぼうね！');
      }, 400);
      ui.onCleanup(function () { clearTimeout(t); });
      tap($('.tomorrow'), function () { say('また明日、遊ぼうね！'); });
    }
  }

  // ---- ショーケース（これまでに作ったお菓子）----
  function sweetHtml(s, cls) {
    return '<div class="sweet ' + (cls || '') + '"><span class="sweet-base">' + s.sweet + '</span>' +
      (s.tops || []).map(function (t) { return '<span class="top" style="left:' + t[1] + '%;top:' + t[2] + '%">' + t[0] + '</span>'; }).join('') + '</div>';
  }
  function showcase() {
    var kid = k();
    var list = kid.showcase.slice().reverse();
    ui.render(
      '<div class="case-screen"><button class="corner-btn" id="back">⬅️</button><div class="case-title">🧁✨🍰</div>' +
      '<div class="case-grid">' + (list.length ? list.map(function (s) { return '<div class="case-cell">' + sweetHtml(s, 'mini') + '<span class="case-cust">' + s.cust + '</span></div>'; }).join('')
        : '<div class="big-emoji">🫙</div>') + '</div></div>', 'bg-sis');
    tap($('#back'), home);
    if (!list.length) say('ここに、作ったお菓子が並ぶよ。');
  }

  // あそびの途中の画面切り替え。途中の切り替えでは「中断」とみなさない（ホームに戻ったときだけ中断）
  function srender(html, cls) {
    var s = session;
    if (s) s.rendering = true;
    ui.render(html, cls);
    if (s) {
      s.rendering = false;
      ui.onCleanup(function () { if (!s.rendering) { s.alive = false; MB.app.stopTimer(); } });
    }
  }

  // ---- 1日分のあそび ----
  async function play() {
    var kid = k();
    var today = store.today();
    var plan = logic.buildSession(kid, today);
    var s = session = { alive: true, kid: kid, today: today, queue: plan.qs.slice(), got: [], timeUp: false,
      cust: CUSTOMERS[kid.day % CUSTOMERS.length], sweet: SWEETS[kid.day % SWEETS.length], asked: 0, sets: {} };
    s.sets.hira = kana.makeSet('hira'); s.sets.kata = kana.makeSet('kata');
    MB.app.startTimer(kid, function () { s.timeUp = true; });

    // あいさつ
    srender('<div class="scene"><div class="scene-row"><span class="princess big">👸</span><span class="cust big pop-in">' + s.cust[0] + '</span></div>' +
      '<div class="bubble">' + s.sweet[0] + '</div></div>', 'bg-sis');
    await say((kid.day === 0 ? 'ポム姫のお菓子屋さんへ、ようこそ！' : 'いらっしゃいませ！') + '今日のお客さんは、' + s.cust[1] + '。');
    if (!s.alive) return;
    await say(s.sweet[1] + 'を、作ってほしいんだって。文字を当てて、材料を集めよう！');
    if (!s.alive) return;

    // 問題
    while (s.queue.length && s.alive) {
      if (s.timeUp && s.got.length >= 1) break;
      var q = s.queue.shift();
      if (q.type === 'teach') await teach(s, q);
      else if (q.type === 'word') await askWord(s, q);
      else await ask(s, q);
      store.save();
    }
    if (!s.alive) return;
    await decorate(s);
    if (!s.alive) return;
    await finish(s);
  }

  function frame(inner) {
    var s = session;
    return '<div class="play">' +
      '<div class="topbar"><button class="corner-btn small" id="quit">🏠</button>' +
      '<div class="bowl">🥣<span class="got">' + s.got.join('') + '</span></div>' +
      '<button class="corner-btn" id="again">🔊</button></div>' + inner + '</div>';
  }
  function bindFrame(replay) {
    tap($('#quit'), home);
    tap($('#again'), function () { if (replay) replay(); });
  }

  // 新しい文字の紹介
  function teach(s, q) {
    return new Promise(function (resolve) {
      var item = s.sets[q.script].items[q.id];
      var hintSay = item.hintSay || (item.wordSay + 'の、' + item.sound);
      var em = item.hintEmoji || item.emoji;
      srender(frame('<div class="teach"><div class="new-tag">🆕✨</div>' +
        '<button class="letter-card pulse" id="letter">' + item.ch + '</button>' +
        '<div class="hint-emoji">' + em + '</div>' +
        '<button class="next-btn hidden" id="next">➡️</button></div>'), 'bg-sis');
      var line = 'これは、「' + item.sound + '」。' + hintSay + '！';
      bindFrame(function () { say(line); });
      var taps = 0;
      tap($('#letter'), function () { taps++; audio.sfx.tap(); say(item.sound + '！'); $('#next').classList.remove('hidden'); });
      tap($('#next'), function () { audio.sfx.pop(); resolve(); });
      say('新しい文字だよ。' + line + '文字を押してみてね。').then(function () {
        // 押さなくても、しばらくしたら次へ進めるボタンを出す
        setTimeout(function () { var n = $('#next'); if (n) n.classList.remove('hidden'); }, 2500);
      });
    });
  }

  // 文字の問題（音→文字 / 文字→絵 / 見くらべ）
  function ask(s, q) {
    return new Promise(function (resolve) {
      var set = s.sets[q.script], st = s.kid.srs[q.script], item = set.items[q.id];
      var rec = st[q.id];
      var known = Object.keys(st);
      if (known.indexOf(q.id) < 0) known.push(q.id);
      var type = q.type;
      if (type === 'pic' && !item.word) type = 'pick';
      var n = logic.choiceCount(s.kid, rec);
      if (q.first) n = 2;
      var choices, prompt, body;
      var hintSay = item.hintSay || (item.wordSay + 'の、' + item.sound);
      if (type === 'pic') {
        choices = logic.picChoices(set, q.id, Math.min(n, 3), known);
        prompt = 'この文字で始まるのは、どれかな？' + choices.map(function (c) { return set.items[c].wordSay; }).join('、 ') + '。';
        body = '<div class="q-letter">' + item.ch + '</div><div class="choices pics n' + choices.length + '">' +
          choices.map(function (c) { return '<button class="choice pic" data-c="' + c + '">' + set.items[c].emoji + '</button>'; }).join('') + '</div>';
      } else {
        choices = logic.makeChoices(set, q.id, n, type === 'compare' ? 'compare' : 'easy', known);
        prompt = (type === 'compare' ? 'よーく見てね。' : '') + '「' + item.sound + '」は、どれかな？' + ((!rec || rec.b <= 1) ? hintSay + '、だよ。' : '');
        body = '<div class="q-ear">👂' + ((!rec || rec.b <= 1) && (item.hintEmoji || item.emoji) ? '<span class="q-hint">' + (item.hintEmoji || item.emoji) + '</span>' : '') + '</div>' +
          '<div class="choices n' + choices.length + '">' +
          choices.map(function (c) { return '<button class="choice letter" data-c="' + c + '">' + c + '</button>'; }).join('') + '</div>';
      }
      srender(frame(body), 'bg-sis');
      bindFrame(function () { say(prompt); });
      var firstTry = true, locked = false;
      say(prompt);
      $all('.choice').forEach(function (btn) {
        tap(btn, async function () {
          if (locked || btn.disabled) return;
          var c = btn.getAttribute('data-c');
          if (c === q.id) {
            locked = true;
            btn.classList.add('right');
            audio.sfx.ok();
            { srs.answer(st, q.id, firstTry, s.today); store.countAnswer(s.kid, firstTry); }
            var ing = INGREDIENTS[s.got.length % INGREDIENTS.length];
            s.got.push(ing);
            flyIngredient(ing);
            await say((firstTry ? pick(PRAISE) + ' ' : 'できたね！ ') + (type === 'pic' ? item.wordSay + 'の、' + item.sound + '！' : hintSay + '！'));
            resolve();
          } else {
            // まちがい: 責めない。押したボタンがふわっと消えて、もう一度えらべる
            btn.disabled = true; btn.classList.add('fade');
            audio.sfx.soft();
            if (firstTry && q.kind !== 'again') {
              // あとでもう一度出す（2問あけて）。出し直しは1回だけ
              s.queue.splice(Math.min(2, s.queue.length), 0, { script: q.script, id: q.id, type: 'pick', kind: 'again' });
            }
            firstTry = false;
            var left = $all('.choice').filter(function (b) { return !b.disabled; });
            if (left.length === 1) left[0].classList.add('glow');
            if (type === 'pic') await say('それは、' + set.items[c].wordSay + '。' + item.wordSay + 'は、どれかな？');
            else await say('それは、「' + set.items[c].sound + '」だよ。「' + item.sound + '」は、どれかな？');
          }
        });
      });
    });
  }

  // ことばを読む問題
  function askWord(s, q) {
    return new Promise(function (resolve) {
      var set = s.sets[q.script];
      var choices = logic.wordChoices(set, q, 3);
      var prompt = '言葉を読んでみよう。どの絵かな？';
      srender(frame('<div class="q-word">' + q.w + '</div><div class="choices pics n3">' +
        choices.map(function (c) { return '<button class="choice pic" data-w="' + c.w + '">' + c.emoji + '</button>'; }).join('') + '</div>'), 'bg-sis');
      bindFrame(function () { say(prompt); });
      say(prompt);
      var firstTry = true, locked = false;
      $all('.choice').forEach(function (btn) {
        tap(btn, async function () {
          if (locked || btn.disabled) return;
          if (btn.getAttribute('data-w') === q.w) {
            locked = true; btn.classList.add('right'); audio.sfx.ok();
            store.countAnswer(s.kid, firstTry);
            var ing = INGREDIENTS[s.got.length % INGREDIENTS.length]; s.got.push(ing); flyIngredient(ing);
            await say((firstTry ? 'すごい、読めたね！' : 'できたね！ ') + q.say + '！');
            resolve();
          } else {
            firstTry = false; btn.disabled = true; btn.classList.add('fade'); audio.sfx.soft();
            var left = $all('.choice').filter(function (b) { return !b.disabled; });
            if (left.length === 1) left[0].classList.add('glow');
            // 1文字ずつ読んでヒントにする
            await say('一緒に読もう。' + q.say.split('').join('、') + '。');
          }
        });
      });
    });
  }

  function flyIngredient(ing) {
    var el = document.createElement('div');
    el.className = 'fly'; el.textContent = ing;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); var g = $('.got'); if (g) g.textContent = session ? session.got.join('') : ''; }, 900);
  }

  // かざりつけ（ごほうびの時間）
  function decorate(s) {
    return new Promise(function (resolve) {
      var tops = [], sel = TOPPINGS[0];
      srender('<div class="deco"><div class="deco-stage" id="stage"><span class="sweet-base huge">' + s.sweet[0] + '</span></div>' +
        '<div class="palette">' + TOPPINGS.map(function (t, i) { return '<button class="top-btn' + (i === 0 ? ' on' : '') + '" data-t="' + t + '">' + t + '</button>'; }).join('') + '</div>' +
        '<button class="done-btn" id="done">🎁✨</button></div>', 'bg-sis');
      audio.sfx.fanfare();
      say('材料がそろって、' + s.sweet[1] + 'が焼けたよ！好きな飾りを選んで、お菓子をタッチしてね。できたら、プレゼントのボタンを押してね。');
      $all('.top-btn').forEach(function (b) {
        tap(b, function () { sel = b.getAttribute('data-t'); $all('.top-btn').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); audio.sfx.tap(); });
      });
      var stage = $('#stage');
      tap(stage, function (ev) {
        if (tops.length >= 14) tops.shift();
        var r = stage.getBoundingClientRect();
        var x = Math.round((ev.clientX - r.left) / r.width * 100), y = Math.round((ev.clientY - r.top) / r.height * 100);
        tops.push([sel, x, y]);
        stage.innerHTML = '<span class="sweet-base huge">' + s.sweet[0] + '</span>' + tops.map(function (t) { return '<span class="top big" style="left:' + t[1] + '%;top:' + t[2] + '%">' + t[0] + '</span>'; }).join('');
        audio.sfx.pop();
      });
      tap($('#done'), function () { s.tops = tops; resolve(); });
    });
  }

  // おしまい: お客さんが喜び、ショーケースに並び、明日のお客さんの影が見える
  async function finish(s) {
    var kid = s.kid;
    var entry = { day: kid.day, sweet: s.sweet[0], tops: s.tops || [], cust: s.cust[0] };
    kid.showcase.push(entry);
    if (kid.showcase.length > 400) kid.showcase.shift();
    store.finishEpisode(kid);
    MB.app.stopTimer();
    var next = CUSTOMERS[kid.day % CUSTOMERS.length];
    srender('<div class="scene"><div class="scene-row"><span class="cust big bounce">' + s.cust[0] + '</span><span class="heart">💖</span></div>' +
      sweetHtml(entry, 'gift') + '<div class="next-row hidden" id="nextRow"><span class="silhouette">' + next[0] + '</span><span class="q-mark">❓</span></div>' +
      '<button class="next-btn hidden" id="bye">👋</button></div>', 'bg-sis');
    audio.sfx.fanfare();
    await say('わあ、おいしそう！' + s.cust[1] + 'は、大喜び。ありがとう！');
    await say('作ったお菓子は、お店の棚に飾っておくね。');
    var row = $('#nextRow'); if (!row) return;
    row.classList.remove('hidden');
    await say('あれ？誰かが、お店をのぞいているよ。明日のお客さんは、誰かな？また明日、来てね！');
    var bye = $('#bye'); if (!bye) return;
    bye.classList.remove('hidden');
    tap(bye, home);
  }

  MB.sister = { home: home, play: play, CUSTOMERS: CUSTOMERS, SWEETS: SWEETS };
})(self);
