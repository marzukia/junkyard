import pw from '/home/planky/projects/_fleet/tool-units/node_modules/playwright/index.js';
const { chromium } = pw;
const SHOTS = '/home/planky/projects/_fleet/shots/';
const EXEC = '/home/planky/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const browser = await chromium.launch({ headless: true, executablePath: EXEC });

async function mob(slug, w=390){
  const ctx = await browser.newContext({ viewport:{width:w,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.goto(`https://${slug}.mrzk.io/`, {waitUntil:'domcontentloaded', timeout:40000});
  await p.waitForTimeout(2000);
  return {ctx,p};
}

// CRON: type expression, check live human-readable + next runs
{
  const {ctx,p} = await mob('cron');
  const main = await p.$('input[placeholder="* * * * *"]');
  await main.click(); await main.fill('');
  await main.type('*/15 9-17 * * 1-5');
  await p.waitForTimeout(800);
  const txt = await p.evaluate(()=>document.body.innerText);
  // does it show human readable? next runs?
  console.log('CRON after typing */15 9-17 * * 1-5:');
  console.log(' humanReadable:', /every|at|minute|past/i.test(txt));
  console.log(' nextRuns:', /next|UTC|GMT|run/i.test(txt));
  console.log(' snippet:', JSON.stringify(txt.replace(/\s+/g,' ').slice(0,400)));
  // invalid input feedback
  await main.fill(''); await main.type('bogus bad input');
  await p.waitForTimeout(500);
  const txt2 = await p.evaluate(()=>document.body.innerText);
  console.log(' invalidFeedback:', /invalid|error|valid/i.test(txt2));
  await ctx.close();
}

// UNITS: enter value, check output + whether copy exists on result
{
  const {ctx,p} = await mob('units');
  const num = await p.$('input[type=number]');
  await num.click(); await num.fill('100');
  await p.waitForTimeout(600);
  const txt = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  console.log('\nUNITS after entering 100:');
  console.log(' snippet:', JSON.stringify(txt.slice(0,300)));
  // is there a copy on result / clickable result?
  const copyBtns = await p.$$eval('button,[role=button]', els=>els.map(e=>e.innerText||e.getAttribute('aria-label')).filter(Boolean).slice(0,20));
  console.log(' buttons:', JSON.stringify(copyBtns));
  await ctx.close();
}

// BARCODE: check for download/copy of generated barcode (svg/canvas)
{
  const {ctx,p} = await mob('barcode');
  await p.waitForTimeout(500);
  const has = await p.evaluate(()=>({
    svg: !!document.querySelector('svg'),
    canvas: !!document.querySelector('canvas'),
    img: !!document.querySelector('img[src^="data:"]'),
    downloadLink: !!document.querySelector('a[download]'),
    text: document.body.innerText.replace(/\s+/g,' '),
  }));
  console.log('\nBARCODE render:', JSON.stringify({svg:has.svg,canvas:has.canvas,img:has.img,dl:has.downloadLink}));
  console.log(' text:', JSON.stringify(has.text.slice(0,250)));
  const btns = await p.$$eval('button,[role=button],a', els=>els.map(e=>(e.innerText||e.getAttribute('aria-label')||e.getAttribute('download')||'').trim()).filter(Boolean).slice(0,15));
  console.log(' actions:', JSON.stringify(btns));
  await ctx.close();
}

// INVOICE: check mobile stacking of form vs preview, and live preview presence
{
  const {ctx,p} = await mob('invoice');
  await p.waitForTimeout(800);
  const info = await p.evaluate(()=>{
    const vw=innerWidth;
    // find a "preview" pane
    const labels=[...document.querySelectorAll('*')].filter(e=>/preview/i.test(e.className||'')).length;
    return { vw, scrollH: document.body.scrollHeight, hasPreviewClass: labels,
      text: document.body.innerText.replace(/\s+/g,' ').slice(0,200) };
  });
  console.log('\nINVOICE mobile:', JSON.stringify(info));
  await ctx.close();
}

// RESUME: live preview on mobile? clear confirm?
{
  const {ctx,p} = await mob('resume');
  await p.waitForTimeout(600);
  const name = await p.$('input[placeholder="Jane Smith"]');
  await name.fill('Test Person');
  await p.waitForTimeout(400);
  const info = await p.evaluate(()=>{
    return { hasPreviewVisible: /Test Person/.test(document.body.innerText),
      scrollH: document.body.scrollHeight };
  });
  console.log('\nRESUME mobile preview reflects input:', JSON.stringify(info));
  await ctx.close();
}

// SUBS & SIGN & PDF empty state text (file tools)
for (const slug of ['subs','sign','pdf']){
  const {ctx,p} = await mob(slug);
  const txt = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  const dnd = await p.evaluate(()=>/drag|drop/i.test(document.body.innerText) || !!document.querySelector('[class*=drop i],[class*=drag i]'));
  console.log(`\n${slug.toUpperCase()} empty state:`, JSON.stringify(txt.slice(0,280)), 'dnd:', dnd);
  await ctx.close();
}

await browser.close();
