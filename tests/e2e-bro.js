// 兄モードの通しテスト。 引数 voice を付けると、にせものの聞き取り機能で「声で答える」流れを試す
const { webkit, devices } = require('playwright');
const VOICE = process.argv[2] === 'voice';
(async () => {
  const b = await webkit.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  if (VOICE) await p.addInitScript(() => {
    // にせものの聞き取り: window.__say に入っていることばを「聞こえた」ことにする
    window.__say = null; window.__starts = 0;
    window.webkitSpeechRecognition = function () {
      const self = this; let timer = null, ended = false;
      const end = () => { if (ended) return; ended = true; clearTimeout(timer); setTimeout(() => self.onend && self.onend(), 10); };
      this.start = () => { window.__starts++; ended = false; timer = setTimeout(() => {
        const w = typeof window.__say === 'function' ? window.__say(self.lang) : window.__say;
        if (w) { const res = [[{ transcript: w }]]; res[0].isFinal = true; self.onresult && self.onresult({ results: res }); }
        end(); }, 150); };
      this.stop = end; this.abort = end;
    };
  });
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { MB.audio.speak = () => new Promise(r => setTimeout(r, 20)); });
  const shot = n => p.screenshot({ path: __dirname + '/' + n + '.png' });
  const click = s => p.click(s, { force: true });
  await p.fill('#pin', '1234'); await p.fill('#sisKana', 'さくら'); await click('#save');
  await click('#goBro'); await shot('b1-home');
  await click('#start');
  const seen = {}; let answered = 0;
  if (VOICE) await p.evaluate(() => {
    // 3問に1問はわざと間違え、それ以外は正しい読み/英語を言う
    let i = 0;
    window.__say = (lang) => {
      const en = document.querySelector('.seal-card.en');
      const word = document.querySelector('.seal-word');
      i++;
      if (document.querySelector('#nomic')) return 'ひらけ';
      if (document.querySelector('#ans') && document.querySelector('#ans').textContent) return null;
      if (i % 4 === 0) return lang === 'en-US' ? 'banana pancake zzz' : 'ぜんぜんちがう';
      if (i % 7 === 0) return null; // だまっている
      if (en) { const em = en.textContent.trim(); const w = MB.english.WORDS.find(x => x[1] === em); return w ? w[0] : 'what'; }
      if (word) { const t = word.textContent; for (const c in MB.kanji.Q) for (const q of MB.kanji.Q[c]) if (q[0] === t) return MB.kanji.readings(q)[0]; }
      return null;
    };
  });
  for (let i = 0; i < 1500; i++) {
    await p.waitForTimeout(100);
    const st = await p.evaluate(() => {
      const q = s => document.querySelector(s);
      if (q('#end')) return 'end';
      if (q('.hide-scene')) return 'hide';
      if (q('#nomic')) return 'spell';
      if (q('#skip')) return 'story';
      if (q('.bro-choice:not([disabled])')) return 'choices';
      if (q('#card')) return q('.seal-card.en') ? 'seal-en' : 'seal';
      if (q('.door')) return 'door';
      return 'other';
    });
    if (!seen[st]) { seen[st] = 1; await shot('b2-' + (VOICE ? 'v-' : '') + st); }
    if (st === 'end') break;
    if (st === 'choices' && !VOICE) {
      // 正しいボタンを8割、まちがいを2割
      await p.evaluate(() => {
        const en = document.querySelector('.seal-card.en'); let right = null;
        if (en) { const w = MB.english.WORDS.find(x => x[1] === en.textContent.trim()); right = w && w[0]; }
        else { const t = document.querySelector('.seal-word').textContent; for (const c in MB.kanji.Q) for (const q of MB.kanji.Q[c]) if (q[0] === t) right = MB.kanji.readings(q)[0]; }
        const btns = [...document.querySelectorAll('.bro-choice:not([disabled])')];
        const wrong = btns.find(b => b.dataset.c !== right), ok = btns.find(b => b.dataset.c === right);
        ((Math.random() < 0.2 && wrong) ? wrong : ok || btns[0]).click();
      });
      answered++;
    }
  }
  await shot('b3-' + (VOICE ? 'v-' : '') + 'end');
  const state = await p.evaluate(() => JSON.parse(localStorage.getItem('manabi-bouken-v1')));
  const bro = state.kids.bro;
  console.log(VOICE ? '[voice]' : '[button]', 'screens:', Object.keys(seen).join(','), '| day', bro.day, '| kanji', Object.keys(bro.srs.kanji).join(''), '| en', Object.keys(bro.srs.en).join(','), '| enLevel', bro.enLevel, '| log', JSON.stringify(bro.log), VOICE ? '| starts ' + await p.evaluate(() => window.__starts) : '');
  console.log('boxes:', JSON.stringify(Object.fromEntries(Object.entries(bro.srs.kanji).map(([k, v]) => [k, v.b]))));
  await click('#end'); await p.waitForTimeout(200); await shot('b4-' + (VOICE ? 'v-' : '') + 'after');
  console.log('errors:', errs);
  await b.close();
})();
