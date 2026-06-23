import { chromium } from 'playwright';

const out = { typed: false, hashesFound: [], shot: false, notes: '' };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

await page.goto('https://hash.mrzk.io/', { waitUntil: 'domcontentloaded', timeout: 40000 });
// wait for app mount
await page.waitForSelector('input[type="text"], textarea, input:not([type])', { timeout: 20000 });
await page.waitForTimeout(1000);

// type mrzk.io into first visible text input
const inputs = await page.$$('input[type="text"], textarea, input:not([type])');
for (const inp of inputs) {
  if (await inp.isVisible().catch(() => false)) {
    await inp.click().catch(() => {});
    await inp.fill('mrzk.io').catch(async () => { await inp.type('mrzk.io'); });
    out.typed = true;
    break;
  }
}
await page.waitForTimeout(1800);

// collect hashes shown
const body = await page.evaluate(() => document.body.innerText);
out.hashesFound = (body.match(/\b[0-9a-fA-F]{32,64}\b/g) || []).slice(0, 6);
out.notes = body.slice(0, 400);

// MD5("mrzk.io") expected for sanity print
out.bodyHasMD5label = /md5/i.test(body);
out.bodyHasSHA = /sha-?1|sha-?256/i.test(body);

// Find the results region to crop. Look for an element containing a 64-hex string.
const handle = await page.evaluateHandle(() => {
  const re = /\b[0-9a-fA-F]{64}\b/;
  // find smallest reasonable container that holds md5 + sha labels
  const all = Array.from(document.querySelectorAll('div,section,main,form'));
  let best = null;
  for (const el of all) {
    const t = el.innerText || '';
    if (/md5/i.test(t) && /sha-?256/i.test(t) && re.test(t)) {
      if (!best || (el.innerText.length < best.innerText.length)) best = el;
    }
  }
  return best;
});

let cropEl = handle.asElement();
if (cropEl) {
  await cropEl.screenshot({ path: '/home/planky/projects/_fleet/shots/ex-hash.png' });
  out.shot = 'element';
} else {
  await page.screenshot({ path: '/home/planky/projects/_fleet/shots/ex-hash.png', fullPage: false });
  out.shot = 'fullpage';
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
