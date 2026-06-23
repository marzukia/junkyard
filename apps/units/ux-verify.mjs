import pw from '/home/planky/projects/_fleet/tool-units/node_modules/playwright/index.js';
const { chromium } = pw;
const EXEC = '/home/planky/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const browser = await chromium.launch({ headless: true, executablePath: EXEC });

// INVOICE: why vw=450? check viewport meta + min-width
{
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.goto('https://invoice.mrzk.io/', {waitUntil:'domcontentloaded',timeout:40000});
  await p.waitForTimeout(1500);
  const info = await p.evaluate(()=>{
    const meta = document.querySelector('meta[name=viewport]');
    // find widest element forcing layout
    let widest=null, maxw=0;
    document.querySelectorAll('*').forEach(el=>{
      const cs=getComputedStyle(el);
      const mw=cs.minWidth;
      if(mw && mw.endsWith('px') && parseFloat(mw)>maxw){maxw=parseFloat(mw);widest=el.tagName+'.'+(typeof el.className==='string'?el.className.slice(0,30):'');}
    });
    return { vw:innerWidth, viewportMeta: meta?meta.content:'NONE', docScrollW: document.documentElement.scrollWidth, widestMinW: maxw, widestEl: widest };
  });
  console.log('INVOICE viewport investigation:', JSON.stringify(info,null,1));
  await p.screenshot({path:'/home/planky/projects/_fleet/shots/ux-invoice-mobile.png'});
  await ctx.close();
}

// CRON next runs check
{
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const p = await ctx.newPage();
  await p.goto('https://cron.mrzk.io/', {waitUntil:'domcontentloaded',timeout:40000});
  await p.waitForTimeout(1500);
  const txt = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  console.log('\nCRON full text has "next":', /next run|upcoming|next \d/i.test(txt));
  console.log('CRON tail:', JSON.stringify(txt.slice(-400)));
  await ctx.close();
}

// UNITS: is the result clickable to copy?
{
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.goto('https://units.mrzk.io/', {waitUntil:'domcontentloaded',timeout:40000});
  await p.waitForTimeout(1500);
  const num = await p.$('input[type=number]');
  await num.fill('100');
  await p.waitForTimeout(500);
  // is there a RESULT field showing converted value, and can you copy it?
  const info = await p.evaluate(()=>{
    const t=document.body.innerText.replace(/\s+/g,' ');
    return { resultVisible: /TO|=|result/i.test(t), hasCopyOnResult: !!document.querySelector('[aria-label*=copy i],[title*=copy i]'), snippet: t.slice(150,400) };
  });
  console.log('\nUNITS result:', JSON.stringify(info));
  await p.screenshot({path:'/home/planky/projects/_fleet/shots/ux-units-mobile.png'});
  await ctx.close();
}
await browser.close();
