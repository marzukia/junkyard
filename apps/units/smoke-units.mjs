import { chromium } from 'playwright';

const URL = 'https://units.mrzk.io/';
const SHOT = '/home/planky/projects/_fleet/shots/smoke-units.png';

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => {
  pageErrors.push(err.message);
});

const result = {};

try {
  const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  result.httpStatus = resp ? resp.status() : null;
} catch (e) {
  result.gotoError = String(e);
  result.httpStatus = null;
}

result.title = await page.title();

const rootInfo = await page.evaluate(() => {
  const root = document.querySelector('#root') || document.querySelector('main') || document.body;
  return {
    selector: document.querySelector('#root') ? '#root' : (document.querySelector('main') ? 'main' : 'body'),
    childCount: root ? root.children.length : 0,
    textLen: root ? (root.innerText || '').trim().length : 0,
    htmlSnippet: root ? root.innerHTML.slice(0, 400) : '',
    bodyText: (document.body.innerText || '').slice(0, 600),
  };
});
result.root = rootInfo;

// Core interaction: enter a value (e.g. 1 km) and assert a converted number renders.
let interactionWorked = false;
let interactionNote = '';
try {
  // snapshot all input/select fields
  const fieldInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const selects = Array.from(document.querySelectorAll('select'));
    return {
      numInputs: inputs.length,
      numSelects: selects.length,
      inputs: inputs.slice(0, 8).map((el) => ({ type: el.type, ph: el.placeholder, val: el.value })),
      selects: selects.slice(0, 8).map((el) => ({ opts: Array.from(el.options).slice(0, 6).map((o) => o.text) })),
    };
  });
  interactionNote += `inputs=${fieldInfo.numInputs} selects=${fieldInfo.numSelects}. `;

  // Find a numeric/text input to type a value into.
  const numInput = await page.$('input[type="number"], input[type="text"]:not([readonly])');
  if (numInput) {
    await numInput.click();
    await numInput.fill('');
    await numInput.type('1');
    await page.waitForTimeout(900);

    // Read all input values after typing 1 — expect at least one other field with a converted number.
    const afterVals = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input')).map((el) => el.value)
    );
    interactionNote += 'inputVals=' + JSON.stringify(afterVals).slice(0, 250) + '. ';

    // A successful conversion: some input other than '1' holds a numeric value.
    const numericOthers = afterVals.filter((v) => v && v.trim() !== '' && v.trim() !== '1' && /[0-9]/.test(v) && !isNaN(parseFloat(v.replace(/,/g, ''))));
    // Also scan body text for a converted figure
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (numericOthers.length > 0) {
      interactionWorked = true;
      interactionNote += `converted value(s) present: ${JSON.stringify(numericOthers).slice(0, 150)}. `;
    } else {
      interactionNote += 'no second numeric field found. ';
      interactionNote += 'bodyHasNumbers=' + /[0-9]/.test(bodyText) + '. ';
    }
  } else {
    interactionNote += 'no typeable numeric/text input found. ';
  }
} catch (e) {
  interactionNote += 'interaction error: ' + String(e).slice(0, 250);
}
result.interactionWorked = interactionWorked;
result.interactionNote = interactionNote;
result.consoleErrors = consoleErrors;
result.pageErrors = pageErrors;

await page.screenshot({ path: SHOT, fullPage: false }).catch((e) => { result.shotError = String(e); });

console.log(JSON.stringify(result, null, 2));

await browser.close();
