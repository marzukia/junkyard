import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });

async function probe(slug, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`https://${slug}.mrzk.io/`, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{});
  await page.waitForTimeout(600);
  try { await fn(page); } catch (e) { console.log(`  ${slug} ERR`, e.message); }
  await ctx.close();
}

// Helper: list all buttons w/ exact text + presence of copy-type controls near outputs
async function dumpControls(page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).map(b => ({
      t: (b.innerText||b.getAttribute('aria-label')||b.title||'').trim().slice(0,30),
      title: b.title||'',
    }));
    return btns;
  });
}

// JSON: does it auto-format? is there copy on output? does pasting + Format work? Enter key?
await probe('json', async (page) => {
  const ta = await page.$$('textarea');
  await ta[0].click();
  await ta[0].fill('{"b":2,"a":1}');
  await page.waitForTimeout(400);
  // try format button
  await page.click('button:has-text("Format")').catch(()=>{});
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => document.querySelectorAll('textarea')[1]?.value || '');
  const btns = await dumpControls(page);
  // Is there any copy control?
  const copyBtn = btns.find(b=>/copy/i.test(b.t)||/copy/i.test(b.title));
  console.log('JSON out:', JSON.stringify(out).slice(0,60), '| copyBtn:', !!copyBtn, '| btns:', btns.map(b=>b.t).join(','));
});

// diff: copy result? line numbers? does swap work? any copy of diff?
await probe('diff', async (page) => {
  const ta = await page.$$('textarea');
  await ta[0].fill('hello world\nfoo'); await ta[1].fill('hello there\nfoo');
  await page.waitForTimeout(500);
  const btns = await dumpControls(page);
  const hasStats = await page.evaluate(()=>/\+\d|\-\d|added|removed|\d+ change/i.test(document.body.innerText));
  console.log('DIFF btns:', btns.map(b=>b.t).join(','), '| hasStats:', hasStats);
});

// base64: copy feedback? does encode auto-run? clear?
await probe('base64', async (page) => {
  const ta = await page.$$('textarea');
  await ta[0].fill('hello');
  await page.waitForTimeout(400);
  const out = await page.evaluate(()=>document.querySelectorAll('textarea')[1]?.value||'');
  // click first Copy, check for "copied"
  await page.click('button:has-text("Copy")').catch(()=>{});
  await page.waitForTimeout(300);
  const copied = await page.evaluate(()=>/copied/i.test(document.body.innerText));
  console.log('BASE64 out:', out, '| copiedFeedback:', copied);
});

// regex: does it match live? explain? copy of matches? library?
await probe('regex', async (page) => {
  const pat = await page.$('input'); await pat.fill('\\d+');
  const ta = await page.$('textarea'); await ta.fill('abc 123 def 456');
  await page.waitForTimeout(500);
  const matches = await page.evaluate(()=>/match|123/i.test(document.body.innerText));
  const btns = await dumpControls(page);
  console.log('REGEX matchShown:', matches, '| btns:', btns.map(b=>b.t).join(','));
});

// css: copy feedback, presets, reset?
await probe('css', async (page) => {
  await page.click('button:has-text("Copy CSS")').catch(()=>{});
  await page.waitForTimeout(300);
  const copied = await page.evaluate(()=>/copied/i.test(document.body.innerText));
  const btns = await dumpControls(page);
  console.log('CSS copiedFeedback:', copied, '| btns:', btns.map(b=>b.t).join(','));
});

// csv: run conversion, copy, download?
await probe('csv', async (page) => {
  const ta = await page.$$('textarea');
  await ta[0].fill('name,age\nAlice,30\nBob,25');
  await page.waitForTimeout(500);
  const out = await page.evaluate(()=>document.querySelectorAll('textarea')[1]?.value||'');
  const btns = await dumpControls(page);
  console.log('CSV out:', JSON.stringify(out).slice(0,60), '| btns:', btns.map(b=>b.t).join(','));
});

// timestamp: copy feedback, live update? rel time?
await probe('timestamp', async (page) => {
  const inp = await page.$('input'); await inp.fill('1700000000');
  await page.waitForTimeout(400);
  const txt = await page.evaluate(()=>document.body.innerText);
  const hasDate = /2023|nov/i.test(txt);
  console.log('TIMESTAMP convertedShown:', hasDate);
});

// uuid: generate, copy-all feedback, per-item copy
await probe('uuid', async (page) => {
  await page.click('button:has-text("Generate")').catch(()=>{});
  await page.waitForTimeout(400);
  const uuids = await page.evaluate(()=>(document.body.innerText.match(/[0-9a-f]{8}-[0-9a-f]{4}/gi)||[]).length);
  await page.click('button:has-text("Copy all")').catch(()=>{});
  await page.waitForTimeout(300);
  const copied = await page.evaluate(()=>/copied/i.test(document.body.innerText));
  console.log('UUID count:', uuids, '| copyAllFeedback:', copied);
});

// hash: live hashes, copy each?
await probe('hash', async (page) => {
  const ta = await page.$('textarea'); await ta.fill('hello');
  await page.waitForTimeout(500);
  const hashes = await page.evaluate(()=>(document.body.innerText.match(/\b[0-9a-f]{32,}\b/gi)||[]).length);
  const btns = await dumpControls(page);
  // any per-row copy?
  const copyBtns = btns.filter(b=>/copy/i.test(b.t)).length;
  console.log('HASH hashesShown:', hashes, '| copyBtns:', copyBtns, '| btns:', btns.map(b=>b.t).join(','));
});

// jwt: decode shown, copy of parts, expiry validation?
await probe('jwt', async (page) => {
  const ta = await page.$('textarea');
  await ta.fill('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  await page.waitForTimeout(500);
  const decoded = await page.evaluate(()=>/John Doe|HS256|1234567890/.test(document.body.innerText));
  const btns = await dumpControls(page);
  console.log('JWT decodedShown:', decoded, '| btns:', btns.map(b=>b.t).join(','));
});

// markdown: clear button? word count? sync scroll?
await probe('markdown', async (page) => {
  const btns = await dumpControls(page);
  const hasClear = btns.some(b=>/clear|reset/i.test(b.t));
  console.log('MARKDOWN hasClear:', hasClear, '| btns:', btns.map(b=>b.t).join(','));
});

await browser.close();
