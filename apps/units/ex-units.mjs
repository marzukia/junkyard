import { chromium } from 'playwright';

const URL = 'https://units.mrzk.io/';
const SHOT = '/home/planky/projects/_fleet/shots/ex-units.png';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForSelector('input', { timeout: 20000 });
await page.waitForTimeout(800);

// Inspect select structure
const info = await page.evaluate(() => {
  const selects = Array.from(document.querySelectorAll('select'));
  return selects.map((s) => ({ tag: s.tagName, opts: Array.from(s.options).map((o) => o.text) }));
});
console.log('selects:', JSON.stringify(info));

// Set FROM = Kilometre (km), TO = Mile (mi) via native selects
async function setSelect(idx, labelContains) {
  await page.evaluate(({ idx, labelContains }) => {
    const sel = document.querySelectorAll('select')[idx];
    const opt = Array.from(sel.options).find((o) => o.text.toLowerCase().includes(labelContains));
    if (opt) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, { idx, labelContains });
}

await setSelect(0, 'kilometre');
await setSelect(1, 'mile');
await page.waitForTimeout(400);

// Enter 100 into the numeric input
const numInput = await page.$('input[type="number"], input[inputmode="decimal"], input[type="text"]:not([readonly])');
await numInput.click();
await numInput.fill('');
await numInput.type('100');
await page.waitForTimeout(900);

const after = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input')).map((el) => el.value);
  const selects = Array.from(document.querySelectorAll('select')).map((s) => s.options[s.selectedIndex]?.text);
  return { inputs, selects, body: document.body.innerText.slice(0, 400) };
});
console.log('after:', JSON.stringify(after, null, 2));

// Screenshot focused on the converter card. Find a bounding region around FROM/TO.
let clip = null;
try {
  const box = await page.evaluate(() => {
    // find the element containing the TO output value
    const all = Array.from(document.querySelectorAll('*'));
    // Use the main converter container — find the largest element near top that holds both selects
    const sel = document.querySelector('select');
    let node = sel;
    for (let i = 0; i < 6 && node.parentElement; i++) node = node.parentElement;
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  console.log('box', JSON.stringify(box));
} catch (e) { console.log('box err', String(e)); }

await page.screenshot({ path: SHOT, fullPage: false });
console.log('saved', SHOT);

await browser.close();
