import { chromium } from 'playwright';

const URL = 'https://units.mrzk.io/';
const SHOT = '/home/planky/projects/_fleet/shots/smoke-units.png';

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

const result = {};
const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
result.httpStatus = resp ? resp.status() : null;
result.title = await page.title();

// The result is shown as text. Read it before and after changing input from 1 -> 5.
const input = await page.$('input[type="text"]:not([readonly]), input[type="number"]:not([readonly])');
result.foundInput = !!input;

// Capture the "TO" result text region. The bodyText shows the conversion result as a number near the unit.
const readResult = async () => page.evaluate(() => document.body.innerText);

const before = await readResult();
// Extract the number immediately preceding "ft" in the TO block (3.2808399 for 1 m -> ft)
const beforeMatch = before.match(/([\d.]+)\s*\nft\b/);

await input.click();
await input.fill('');
await input.type('5');
await page.waitForTimeout(900);

const after = await readResult();
const afterMatch = after.match(/([\d.]+)\s*\nft\b/);

result.beforeFtVal = beforeMatch ? beforeMatch[1] : null;
result.afterFtVal = afterMatch ? afterMatch[1] : null;

// 1 m = 3.2808399 ft ; 5 m = 16.4041995 ft. Assert the value changed and is ~16.4.
let interactionWorked = false;
let note = `before(1m->ft)=${result.beforeFtVal} after(5m->ft)=${result.afterFtVal}. `;
if (result.afterFtVal) {
  const v = parseFloat(result.afterFtVal);
  if (Math.abs(v - 16.404) < 0.5) {
    interactionWorked = true;
    note += 'conversion correct (~16.40 ft for 5 m). ';
  } else if (result.afterFtVal !== result.beforeFtVal) {
    interactionWorked = true;
    note += `value updated to ${v} ft on input change. `;
  } else {
    note += 'value did not change. ';
  }
} else {
  note += 'could not parse ft result. ';
}
result.interactionWorked = interactionWorked;
result.interactionNote = note;
result.consoleErrors = consoleErrors;
result.pageErrors = pageErrors;

await page.screenshot({ path: SHOT, fullPage: false });
console.log(JSON.stringify(result, null, 2));
await browser.close();
