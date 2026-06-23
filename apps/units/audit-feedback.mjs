import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });

async function probe(slug, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read','clipboard-write'] });
  const page = await ctx.newPage();
  await page.goto(`https://${slug}.mrzk.io/`, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{});
  await page.waitForTimeout(600);
  try { await fn(page); } catch (e) { console.log(`  ${slug} ERR`, e.message); }
  await ctx.close();
}

// Capture DOM mutation right after a copy click to detect transient feedback (label swap / toast)
async function clickAndWatch(page, selector, label) {
  await page.evaluate(() => { window.__seen = []; const o=new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData'||m.addedNodes.length){window.__seen.push((document.body.innerText.match(/copied|copy!|✓|✔|done/i)||[''])[0]);}}}); o.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true}); });
  const btn = await page.$(selector);
  if (!btn) { console.log(`  ${label}: selector not found`); return; }
  await btn.click().catch(()=>{});
  await page.waitForTimeout(150);
  const midText = await page.evaluate(()=>document.body.innerText);
  const feedback150 = /copied|copy!|✓|✔|\bdone\b/i.test(midText);
  await page.waitForTimeout(600);
  const seen = await page.evaluate(()=>[...new Set(window.__seen.filter(Boolean))]);
  console.log(`  ${label}: feedback@150ms=${feedback150} mutations=${JSON.stringify(seen)}`);
}

console.log('BASE64:');
await probe('base64', async (page) => {
  await (await page.$('textarea')).fill('hello');
  await page.waitForTimeout(400);
  await clickAndWatch(page, 'button:has-text("Copy")', 'copy');
  const hasClear = await page.evaluate(()=>Array.from(document.querySelectorAll('button')).some(b=>/clear|reset/i.test(b.innerText)));
  console.log('  hasClear:', hasClear);
});

console.log('CSS:');
await probe('css', async (page) => {
  await clickAndWatch(page, 'button:has-text("Copy CSS")', 'copyCSS');
});

console.log('UUID:');
await probe('uuid', async (page) => {
  await page.click('button:has-text("Generate")').catch(()=>{});
  await page.waitForTimeout(300);
  await clickAndWatch(page, 'button:has-text("Copy all")', 'copyAll');
});

console.log('JSON:');
await probe('json', async (page) => {
  await (await page.$$('textarea'))[0].fill('{"a":1}');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Format")').catch(()=>{});
  await page.waitForTimeout(300);
  await clickAndWatch(page, 'button:has-text("Copy")', 'copy');
});

console.log('TIMESTAMP:');
await probe('timestamp', async (page) => {
  await (await page.$('input')).fill('1700000000');
  await page.waitForTimeout(300);
  await clickAndWatch(page, 'button:has-text("copy")', 'copy');
});

console.log('HASH:');
await probe('hash', async (page) => {
  await (await page.$('textarea')).fill('hello');
  await page.waitForTimeout(400);
  await clickAndWatch(page, 'button:has-text("Copy SHA-256")', 'copySHA256');
});

console.log('JSON Enter-key / error feedback:');
await probe('json', async (page) => {
  await (await page.$$('textarea'))[0].fill('{bad json');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Format")').catch(()=>{});
  await page.waitForTimeout(300);
  const err = await page.evaluate(()=>/error|invalid|unexpected|expected/i.test(document.body.innerText));
  console.log('  invalid-json error shown:', err);
});

await browser.close();
