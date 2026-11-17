// 何日も続けて遊ぶ通しテスト（日付を1日ずつ進める）。 使い方: node e2e-days.js sis 14 | node e2e-days.js bro 7
const { webkit, devices } = require('playwright');
const WHO = process.argv[2] || 'sis', DAYS = Number(process.argv[3] || 10);
(async () => {
  const b = await webkit.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => {
    const off = Number(localStorage.getItem('__off') || 0) * 86400000;
    const RealDate = Date;
    class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } }
    window.Date = FakeDate;
  });
  const click = s => p.click(s, { force: true });
  const shot = n => p.screenshot({ path: __dirname + '/' + n + '.png' });
  const seen = {}; const perDay = [];
  for (let d = 0; d < DAYS; d++) {
    await p.goto('http://localhost:8765/index.html');
    await p.evaluate(() => { MB.audio.speak = () => new Promise(r => setTimeout(r, 5)); });
    if (d === 0) { await p.fill('#pin', '1234'); await p.fill('#sisKana', 'さくら'); await click('#save'); }
    await click(WHO === 'sis' ? '#goSis' : '#goBro');
    await click(WHO === 'sis' ? '#play' : '#start');
    const types = {};
    for (let i = 0; i < 3000; i++) {
      await p.waitForTimeout(40);
      const st = await p.evaluate((who) => {
        const q = s => document.querySelector(s);
        const rnd = Math.random();
        if (who === 'sis') {
          if (q('#bye') && !q('#bye').classList.contains('hidden')) return 'bye';
          if (q('#done')) { q('#stage').click(); q('#done').click(); return 'deco'; }
          if (q('#letter')) { q('#letter').click(); q('#next').click(); return 'teach'; }
          const cs = [...document.querySelectorAll('.choice:not([disabled]):not(.right)')];
          if (!cs.length) return 'wait';
          const type = q('.q-word') ? 'word' : q('.q-letter') ? 'pic' : 'pick' + document.querySelectorAll('.choice').length;
          // 正解を知る方法がないので、光っているボタンがあればそれ、なければ適当に押す
          (q('.choice.glow') || cs[Math.floor(rnd * cs.length)]).click();
          return type;
        }
        if (q('#end')) return 'end';
        if (q('#skip')) { q('#skip').click(); return 'story'; }
        const bs = [...document.querySelectorAll('.bro-choice:not([disabled])')];
        if (bs.length) {
          const en = q('.seal-card.en'); let right = null;
          if (en) { const w = MB.english.WORDS.find(x => x[1] === en.textContent.trim()); right = w && w[0]; }
          else { const t = q('.seal-word').textContent; for (const c in MB.kanji.Q) for (const x of MB.kanji.Q[c]) if (x[0] === t) right = MB.kanji.readings(x)[0]; }
          const ok = bs.find(b => b.dataset.c === right), wrong = bs.find(b => b.dataset.c !== right);
          ((rnd < 0.15 && wrong) ? wrong : ok || bs[0]).click();
          return en ? 'en' : (q('.seal-who').textContent.includes('👑') ? 'boss' : 'kanji');
        }
        if (q('.seal-who') && q('.seal-who').textContent.includes('あたらしい')) return 'teach';
        return 'wait';
      }, WHO);
      types[st] = (types[st] || 0) + 1;
      if (!seen[st] && st !== 'wait') { seen[st] = 1; await shot('d-' + WHO + '-' + st); }
      if (st === 'bye' || st === 'end') break;
    }
    await click(WHO === 'sis' ? '#bye' : '#end');
    const info = await p.evaluate((who) => { const k = JSON.parse(localStorage.getItem('manabi-bouken-v1')).kids[who]; const st = who === 'sis' ? k.srs.hira : k.srs.kanji;
      return { day: k.day, n: Object.keys(st).length, boxes: Object.values(st).map(r => r.b).join(''), en: k.srs.en ? Object.keys(k.srs.en).length : 0, lv: k.enLevel, tr: k.treasures, sc: k.showcase ? k.showcase.length : 0 }; }, WHO);
    delete types.wait; perDay.push(`day${d + 1}: ${JSON.stringify(types)} -> ${JSON.stringify(info)}`);
    // 同じ日にもう一度は遊べないことを確かめる
    if (d === 0) { const again = await p.evaluate((who) => !!document.querySelector(who === 'sis' ? '#play' : '#start'), WHO); perDay.push('  同じ日にもう一度あそべる？ ' + again); await shot('d-' + WHO + '-tomorrow'); }
    await p.evaluate(() => localStorage.setItem('__off', String(Number(localStorage.getItem('__off') || 0) + 1)));
  }
  console.log(perDay.join('\n')); console.log('errors:', errs);
  await b.close();
})();
