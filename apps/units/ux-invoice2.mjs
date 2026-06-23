import pw from '/home/planky/projects/_fleet/tool-units/node_modules/playwright/index.js';
const { chromium } = pw;
const EXEC = '/home/planky/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const browser = await chromium.launch({ headless: true, executablePath: EXEC });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
const p = await ctx.newPage();
await p.goto('https://invoice.mrzk.io/', {waitUntil:'domcontentloaded',timeout:40000});
await p.waitForTimeout(1500);
const r = await p.evaluate(()=>{
  const de=document.documentElement;
  const horizScroll = de.scrollWidth > window.innerWidth + 1;
  // line items table - does it overflow?
  const tables=[...document.querySelectorAll('table, [class*=item i], [class*=row i]')].map(t=>{
    const r=t.getBoundingClientRect(); return r.width>window.innerWidth+2 ? `${t.tagName}.${(typeof t.className==='string'?t.className:'').slice(0,20)} w=${Math.round(r.width)}`:null;
  }).filter(Boolean);
  return { innerW:window.innerWidth, scrollW:de.scrollWidth, horizScroll, overflowingTables:tables.slice(0,5) };
});
console.log('INVOICE 390 real:', JSON.stringify(r,null,1));
await ctx.close();
await browser.close();
