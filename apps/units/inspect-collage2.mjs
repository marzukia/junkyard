import { chromium } from 'playwright';
const URL = 'https://collage.mrzk.io/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  // spacing slider: find label "Spacing8px" then its associated input
  const out = { ranges: [], spacingArea: null, canvasEls: [] };
  // any element with role slider
  out.sliders = [...document.querySelectorAll('[role="slider"]')].map(s => ({ aria: s.getAttribute('aria-label'), now: s.getAttribute('aria-valuenow'), min: s.getAttribute('aria-valuemin'), max: s.getAttribute('aria-valuemax'), cls: s.className }));
  // the label nodes
  const labs = [...document.querySelectorAll('label')];
  out.labelHtml = labs.map(l => l.outerHTML.slice(0, 300));
  // find element whose class contains 'canvas'
  const cv = [...document.querySelectorAll('[class*="canvas" i], [class*="stage" i], [class*="grid" i]')];
  out.canvasEls = cv.slice(0, 8).map(e => ({ tag: e.tagName, cls: e.className, r: e.getBoundingClientRect() }));
  // the actual cell button parent grid
  const cell = document.querySelector('button[aria-label^="Cell"]');
  if (cell) {
    let p = cell.parentElement, chain = [];
    for (let i=0;i<5&&p;i++){ chain.push({tag:p.tagName, cls:p.className, r:p.getBoundingClientRect()}); p=p.parentElement; }
    out.cellChain = chain;
  }
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
