import { chromium } from 'playwright';
const URL = 'https://mrzk.io/apps/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

// DOM structure
const info = await page.evaluate(() => {
  const out = {};
  const grid = document.querySelector('.pf-grid');
  out.gridStyle = grid ? (() => { const s = getComputedStyle(grid); return { display: s.display, gap: s.gap, gridTemplateColumns: s.gridTemplateColumns }; })() : 'NO .pf-grid';
  const cards = [...document.querySelectorAll('.pf-card')];
  out.cardCount = cards.length;
  const card = cards[0];
  if (card) {
    const cs = getComputedStyle(card);
    out.cardStyle = { border: cs.border, borderRadius: cs.borderRadius, background: cs.backgroundColor, padding: cs.padding, transition: cs.transition };
  }
  const thumbL = document.querySelector('.pf-thumb-light');
  const thumbD = document.querySelector('.pf-thumb-dark');
  if (thumbL) { const s = getComputedStyle(thumbL); out.thumbLight = { aspectRatio: s.aspectRatio, objectFit: s.objectFit, width: s.width, height: s.height, display: s.display }; out.thumbLightSrc = thumbL.tagName === 'IMG' ? thumbL.src : (thumbL.style.backgroundImage || 'div'); }
  if (thumbD) { const s = getComputedStyle(thumbD); out.thumbDark = { aspectRatio: s.aspectRatio, objectFit: s.objectFit, width: s.width, height: s.height, display: s.display }; }
  // intro
  const intro = document.querySelector('.pf-intro');
  if (intro) { const s = getComputedStyle(intro); out.intro = { maxWidth: s.maxWidth, fontSize: s.fontSize, lineHeight: s.lineHeight, width: s.width }; out.introText = intro.innerText; }
  // headings
  const hs = [...document.querySelectorAll('.pf-h')].map(h => ({ text: h.innerText, fontSize: getComputedStyle(h).fontSize, marginTop: getComputedStyle(h).marginTop }));
  out.headings = hs;
  // is charted card featured? compare its width vs a tool card
  const libCard = document.querySelector('.pf-lib .pf-card, .pf-libraries .pf-card') || cards[0];
  return out;
});
console.log(JSON.stringify(info, null, 2));

// hover test on a tool card (skip charted)
const cards = await page.$$('.pf-card');
const target = cards[3] || cards[0];
const before = await target.evaluate(el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { transform: s.transform, bg: s.backgroundColor, boxShadow: s.boxShadow, borderColor: s.borderColor, top: r.top }; });
await target.hover();
await page.waitForTimeout(400);
const after = await target.evaluate(el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { transform: s.transform, bg: s.backgroundColor, boxShadow: s.boxShadow, borderColor: s.borderColor, top: r.top }; });
console.log('HOVER before:', JSON.stringify(before));
console.log('HOVER after :', JSON.stringify(after));
await page.screenshot({ path: '/home/planky/projects/_fleet/shots/portfolio-hover.png', clip: { x: 0, y: Math.max(0, before.top - 20), width: 1440, height: 400 } });

await browser.close();
