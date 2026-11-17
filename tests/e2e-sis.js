const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { MB.audio.speak = () => new Promise(r => setTimeout(r, 30)); });
  const shot = n => p.screenshot({ path: __dirname + '/' + n + '.png' });
  await shot('s0-setup');
  await p.fill('#pin', '1234'); await p.fill('#sisName', 'ひめ'); await p.fill('#sisKana', 'さくら'); await p.fill('#broName', 'たんけんか');
  await p.click('#save', { force: true }); await shot('s1-home');
  await p.click('#goSis', { force: true }); await shot('s2-sishome');
  await p.click('#play', { force: true });
  let shots = {};
  for (let i = 0; i < 400; i++) {
    await p.waitForTimeout(120);
    const st = await p.evaluate(() => {
      const q = s => document.querySelector(s);
      if (q('#bye') && !q('#bye').classList.contains('hidden')) return 'bye';
      if (q('#done')) return 'deco';
      if (q('#letter')) return 'teach';
      if (q('.q-word')) return 'word';
      if (q('.q-letter')) return 'pic';
      if (q('.choice')) return 'pick' + document.querySelectorAll('.choice').length;
      return 'other';
    });
    if (!shots[st]) { shots[st] = 1; await shot('s3-' + st); }
    if (st === 'bye') { await p.click('#bye', { force: true }); break; }
    if (st === 'deco') { const box = await (await p.$('#stage')).boundingBox(); for (const [x, y] of [[.3,.3],[.7,.4],[.5,.7]]) await p.mouse.click(box.x + box.width*x, box.y + box.height*y); await shot('s4-deco'); await p.click('#done', { force: true }); continue; }
    if (st === 'teach') { await p.click('#letter', { force: true }); await p.click('#next', { force: true }); continue; }
    if (st.startsWith('pick') || st === 'pic' || st === 'word') { const c = await p.$('.choice:not([disabled]):not(.right)'); if (c) await c.click({ force: true }).catch(() => {}); }
  }
  await p.waitForTimeout(300); await shot('s5-after');
  const state = await p.evaluate(() => JSON.parse(localStorage.getItem('manabi-bouken-v1')));
  console.log('sis day', state.kids.sis.day, 'showcase', state.kids.sis.showcase.length, 'srs', JSON.stringify(state.kids.sis.srs.hira), 'log', JSON.stringify(state.kids.sis.log));
  await p.click('#case', { force: true }); await shot('s6-case'); await p.click('#back', { force: true }); await p.click('#back', { force: true });
  await p.click('#goParent', { force: true }); await p.fill('#pin', '1234'); await p.waitForTimeout(200); await shot('s7-parent');
  await p.click('[data-t=set]', { force: true }); await shot('s8-set'); await p.click('[data-t=voice]', { force: true }); await shot('s9-voice');
  console.log('errors:', errs);
  await b.close();
})();
