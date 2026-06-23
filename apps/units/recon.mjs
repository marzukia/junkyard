import { chromium } from 'playwright';

const slugs = ['transcribe','upscale','depth','caption','translate','summarize','chat','lorem','svg','gif'];

const browser = await chromium.launch();
for (const slug of slugs) {
  const ctx = await browser.newContext({ viewport:{width:1440,height:900}});
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,140)); });
  p.on('pageerror', e => errs.push('PAGEERR:'+e.message.slice(0,140)));
  try {
    const resp = await p.goto(`https://${slug}.mrzk.io`, {waitUntil:'networkidle', timeout:30000});
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => {
      const txt = document.body.innerText.replace(/\s+/g,' ').slice(0,600);
      const buttons = [...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).slice(0,30);
      const tabs = [...document.querySelectorAll('[role=tab],.mantine-Tabs-tab')].map(t=>t.innerText.trim()).filter(Boolean);
      const inputs = {
        textareas: document.querySelectorAll('textarea').length,
        text: document.querySelectorAll('input[type=text],input:not([type])').length,
        file: document.querySelectorAll('input[type=file]').length,
        selects: document.querySelectorAll('select,[role=combobox],.mantine-Select-input').length,
        range: document.querySelectorAll('input[type=range],[role=slider]').length,
      };
      const h1 = document.querySelector('h1,h2')?.innerText||'';
      return {txt, buttons, tabs, inputs, h1};
    });
    console.log(`\n### ${slug} [http ${resp?.status()}]`);
    console.log('  H:', info.h1);
    console.log('  inputs:', JSON.stringify(info.inputs));
    console.log('  tabs:', JSON.stringify(info.tabs));
    console.log('  buttons:', JSON.stringify(info.buttons));
    console.log('  txt:', info.txt.slice(0,350));
    if (errs.length) console.log('  CONSOLE-ERR:', JSON.stringify(errs.slice(0,5)));
  } catch(e){ console.log(`\n### ${slug} LOAD-FAIL: ${e.message.slice(0,120)}`); }
  await ctx.close();
}
await browser.close();
