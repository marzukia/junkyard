import { chromium } from 'playwright';

const URL = 'https://base64.mrzk.io/';
const SHOT = '/home/planky/projects/_fleet/shots/smoke-base64.png';

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

// title
result.title = await page.title();

// root mount check
const rootInfo = await page.evaluate(() => {
  const root = document.querySelector('#root') || document.querySelector('main') || document.body;
  return {
    selector: document.querySelector('#root') ? '#root' : (document.querySelector('main') ? 'main' : 'body'),
    childCount: root ? root.children.length : 0,
    textLen: root ? (root.innerText || '').trim().length : 0,
    htmlSnippet: root ? root.innerHTML.slice(0, 300) : '',
    bodyText: (document.body.innerText || '').slice(0, 400),
  };
});
result.root = rootInfo;

// Core interaction: base64 encode 'hello' -> expect aGVsbG8
let interactionWorked = false;
let interactionNote = '';
try {
  // find a textarea / input to type into
  const inputs = await page.$$('textarea, input[type="text"], [contenteditable="true"]');
  interactionNote += `inputs found: ${inputs.length}. `;
  if (inputs.length > 0) {
    // type into the first textarea-like field
    const first = inputs[0];
    await first.click();
    await first.fill('hello').catch(async () => { await page.keyboard.type('hello'); });
    await page.waitForTimeout(800);
    // check whole page text for the expected base64
    const pageText = await page.evaluate(() => document.body.innerText);
    const inputVals = await page.evaluate(() =>
      Array.from(document.querySelectorAll('textarea, input')).map((el) => el.value)
    );
    const haystack = pageText + '\n' + inputVals.join('\n');
    if (haystack.includes('aGVsbG8')) {
      interactionWorked = true;
      interactionNote += "found 'aGVsbG8' in output. ";
    } else {
      interactionNote += "did NOT find 'aGVsbG8'. ";
      // maybe needs a button click
      const btns = await page.$$('button');
      interactionNote += `buttons: ${btns.length}. `;
      // record input values for debugging
      interactionNote += 'vals=' + JSON.stringify(inputVals).slice(0, 200) + '. ';
    }
  } else {
    interactionNote += 'no input fields found. ';
  }
} catch (e) {
  interactionNote += 'interaction error: ' + String(e).slice(0, 200);
}
result.interactionWorked = interactionWorked;
result.interactionNote = interactionNote;
result.consoleErrors = consoleErrors;
result.pageErrors = pageErrors;

await page.screenshot({ path: SHOT, fullPage: false }).catch((e) => { result.shotError = String(e); });

console.log(JSON.stringify(result, null, 2));

await browser.close();
