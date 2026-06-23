import pw from '/home/planky/projects/_fleet/tool-units/node_modules/playwright/index.js';
const { chromium } = pw;
const EXEC = '/home/planky/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const browser = await chromium.launch({ headless: true, executablePath: EXEC });

// INVOICE: find what forces width >390
{
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const p = await ctx.newPage();
  await p.goto('https://invoice.mrzk.io/', {waitUntil:'domcontentloaded',timeout:40000});
  await p.waitForTimeout(1500);
  const info = await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('*').forEach(el=>{
      const r=el.getBoundingClientRect();
      const cs=getComputedStyle(el);
      if(r.width>400){
        out.push(`${el.tagName}.${typeof el.className==='string'?el.className.slice(0,25):''} w=${Math.round(r.width)} minW=${cs.minWidth} display=${cs.display}`);
      }
    });
    return out.slice(0,10);
  });
  console.log('INVOICE elements wider than 400px on 390 viewport:');
  info.forEach(x=>console.log(' ',x));
  await ctx.close();
}

// CRON: does it show concrete upcoming timestamps or just a static example list?
{
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true });
  const p = await ctx.newPage();
  await p.goto('https://cron.mrzk.io/', {waitUntil:'domcontentloaded',timeout:40000});
  await p.waitForTimeout(1500);
  const m = await p.$('input[placeholder="* * * * *"]');
  await m.fill('0 9 * * 1-5');
  await p.waitForTimeout(600);
  const hasDates = await p.evaluate(()=>{
    const t=document.body.innerText;
    // look for date-like strings 2026 or day names with times
    return { has2026: /202\d/.test(t), hasNextLabel: /next run|upcoming|next \d+ run/i.test(t.toLowerCase()) };
  });
  console.log('\nCRON concrete next-run timestamps:', JSON.stringify(hasDates));
  await ctx.close();
}

// BARCODE: confirm no way to save the svg (right-click only)
{
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.goto('https://barcode.mrzk.io/', {waitUntil:'domcontentloaded',timeout:40000});
  await p.waitForTimeout(1500);
  const exp = await p.evaluate(()=>{
    const t=document.body.innerText.toLowerCase();
    return { mentionsPngSvg: /png \+ svg|png|svg/.test(t), hasDownloadBtn: /download|save|export|\.png|\.svg/.test(t), anchorDownload: !!document.querySelector('a[download]') };
  });
  console.log('\nBARCODE export capability:', JSON.stringify(exp));
  await p.screenshot({path:'/home/planky/projects/_fleet/shots/ux-barcode-mobile.png'});
  await ctx.close();
}
await browser.close();
