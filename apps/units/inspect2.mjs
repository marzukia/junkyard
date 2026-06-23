import { chromium } from 'playwright';
const URL = 'https://mrzk.io/apps/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.documentElement.classList.add('dark'));
await page.waitForTimeout(800);

const r = await page.evaluate(() => {
  const out = {};
  // charted card placement
  const charted = [...document.querySelectorAll('.pf-card')].find(c => /charted/i.test(c.innerText));
  if (charted) {
    out.chartedParentClass = charted.parentElement.className;
    out.chartedRect = (() => { const b = charted.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; })();
    // its containing section
    let sec = charted.closest('section, div');
    out.chartedSectionClass = sec ? sec.className : null;
  }
  const tool = [...document.querySelectorAll('.pf-card')].find(c => /Colours/i.test(c.innerText));
  if (tool) { const b = tool.getBoundingClientRect(); out.toolRect = { w: Math.round(b.width), h: Math.round(b.height) }; }
  // which thumb visible in dark
  const lib = document.querySelector('.pf-thumb-light');
  const dark = document.querySelector('.pf-thumb-dark');
  out.lightDisplay = lib ? getComputedStyle(lib).display : null;
  out.darkDisplay = dark ? getComputedStyle(dark).display : null;
  out.darkSrc = dark && dark.tagName === 'IMG' ? dark.src : null;
  // count distinct thumb-dark sources to see if all tools have a dark banner
  const darks = [...document.querySelectorAll('.pf-thumb-dark')];
  out.darkThumbCount = darks.length;
  out.darkVisibleCount = darks.filter(d => getComputedStyle(d).display !== 'none').length;
  const lights = [...document.querySelectorAll('.pf-thumb-light')];
  out.lightVisibleCount = lights.filter(d => getComputedStyle(d).display !== 'none').length;
  // text color on card title in dark
  const h = document.querySelector('.pf-card h3, .pf-card .pf-card-title, .pf-card strong');
  out.cardTitleColor = h ? getComputedStyle(h).color : null;
  return out;
});
console.log(JSON.stringify(r, null, 2));

// Crop the charted card region (top of grid) for detail
const cb = await page.evaluate(() => { const c = [...document.querySelectorAll('.pf-card')].find(x => /charted/i.test(x.innerText)); const b = c.getBoundingClientRect(); window.scrollTo(0, window.scrollY + b.top - 80); const b2 = c.getBoundingClientRect(); return { x: Math.round(b2.left), y: Math.round(b2.top), w: Math.round(b2.width), h: Math.round(b2.height) }; });
await page.waitForTimeout(300);
await page.screenshot({ path: '/home/planky/projects/_fleet/shots/charted-dark-detail.png', clip: { x: Math.max(0,cb.x-10), y: Math.max(0,cb.y-10), width: cb.w+20, height: Math.min(cb.h+20, 800) } });
await browser.close();
