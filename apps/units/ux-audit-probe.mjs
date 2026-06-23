import pw from '/home/planky/projects/_fleet/tool-units/node_modules/playwright/index.js';
const { chromium } = pw;

const SHOTS = '/home/planky/projects/_fleet/shots/';
const EXEC = '/home/planky/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

const slugs = process.argv.slice(2);
if (!slugs.length) { console.error('pass slugs'); process.exit(1); }

const browser = await chromium.launch({ headless: true, executablePath: EXEC });

function summarizeDom() {
  const vw = window.innerWidth;
  const docW = document.documentElement.scrollWidth;
  const bodyW = document.body.scrollWidth;
  const overflowH = Math.max(docW, bodyW) > vw + 2;
  const overflowers = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2 && r.left < vw) {
      const tag = el.tagName.toLowerCase();
      const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.split(' ').slice(0,2).join('.') : '';
      overflowers.push(`${tag}${cls} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
    }
  });
  const tappable = [];
  document.querySelectorAll('button, a, input[type=button], input[type=submit], [role=button], select, input[type=checkbox], input[type=radio]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const label = (el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || el.title || el.tagName).trim().slice(0,30);
    tappable.push({ label, w: Math.round(r.width), h: Math.round(r.height), small: Math.min(r.width, r.height) < 40 });
  });
  const inputs = [];
  document.querySelectorAll('input, textarea, select').forEach(el => {
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const r = el.getBoundingClientRect();
    inputs.push({ type: el.type || el.tagName.toLowerCase(), fontSize: fs, zoomRisk: fs < 16, w: Math.round(r.width), ph: (el.placeholder||'').slice(0,40) });
  });
  const text = document.body.innerText.toLowerCase();
  const hasCopy = /copy|copied/.test(text) || !!document.querySelector('[class*=copy i],[aria-label*=copy i],[title*=copy i]');
  const hasClear = /clear|reset/.test(text);
  const hasDownload = /download|save|export/.test(text) || !!document.querySelector('[download]');
  const hasExample = /example|sample|try|load demo|paste/.test(text);
  let tinyText = 0;
  document.querySelectorAll('p, span, div, label, li, td, th').forEach(el => {
    if (el.children.length) return;
    if (!el.innerText || !el.innerText.trim()) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 12) tinyText++;
  });
  return {
    vw, docW: Math.max(docW, bodyW), overflowH,
    overflowers: overflowers.slice(0, 12),
    smallTaps: tappable.filter(t => t.small).map(t => `${t.label}(${t.w}x${t.h})`).slice(0,15),
    tapCount: tappable.length,
    zoomInputs: inputs.filter(i => i.zoomRisk).map(i => `${i.type}@${i.fontSize}px`),
    inputs: inputs.slice(0,8),
    hasCopy, hasClear, hasDownload, hasExample, tinyText,
    bodyTextLen: document.body.innerText.length,
    title: document.title,
  };
}

for (const slug of slugs) {
  const url = `https://${slug}.mrzk.io/`;
  const result = { slug, url };
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  const cerr = [];
  mp.on('console', m => { if (m.type()==='error') cerr.push(m.text().slice(0,120)); });
  mp.on('pageerror', e => cerr.push('PAGEERR:'+String(e.message||e).slice(0,120)));
  try {
    const resp = await mp.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    result.http = resp ? resp.status() : 0;
    await mp.waitForTimeout(2500);
    result.mobile = await mp.evaluate(summarizeDom);
    await mp.screenshot({ path: `${SHOTS}ux-${slug}-mobile.png`, fullPage: false });
    result.consoleErrors = cerr.filter(e => !/favicon|umami|analytics|font|woff/i.test(e)).slice(0,5);
  } catch (e) {
    result.mobileError = String(e).slice(0,200);
  }
  await mctx.close();
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await dctx.newPage();
  try {
    await dp.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await dp.waitForTimeout(2000);
    result.desktop = await dp.evaluate(summarizeDom);
  } catch (e) {
    result.desktopError = String(e).slice(0,200);
  }
  await dctx.close();
  console.log('\n===== ' + slug + ' =====');
  console.log(JSON.stringify(result, null, 1));
}
await browser.close();
