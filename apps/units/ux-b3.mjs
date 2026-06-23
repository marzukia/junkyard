import { chromium, devices } from 'playwright';
const iphone = devices['iPhone 13'];
const sampleSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><!-- a comment --><g><rect x="10" y="10" width="80" height="80" fill="#3366cc"/></g></svg>';

async function run() {
  const browser = await chromium.launch();

  // LOREM
  try {
    const ctx = await browser.newContext({ viewport:{width:1440,height:900}});
    const p = await ctx.newPage();
    await p.goto('https://lorem.mrzk.io', {waitUntil:'networkidle'});
    await p.waitForTimeout(800);
    const out0 = await p.evaluate(()=>document.querySelector('textarea')?.value?.length||0);
    let copyFeedback = 'none';
    const copyBtn = p.getByRole('button',{name:/^copy/i}).first();
    if (await copyBtn.count()) {
      const before = await copyBtn.innerText();
      await copyBtn.click().catch(()=>{});
      await p.waitForTimeout(400);
      const after = await copyBtn.innerText();
      copyFeedback = before===after ? 'NO-FEEDBACK('+after+')' : 'changed:'+after;
    }
    const ls = await p.evaluate(()=>Object.keys(localStorage));
    console.log('LOREM prefilledOutLen=',out0,'copyFeedback=',copyFeedback,'ls=',JSON.stringify(ls));
    await ctx.close();
  } catch(e){ console.log('LOREM err', e.message); }

  // SVG
  try {
    const ctx = await browser.newContext({ viewport:{width:1440,height:900}});
    const p = await ctx.newPage();
    await p.goto('https://svg.mrzk.io', {waitUntil:'networkidle'});
    await p.waitForTimeout(800);
    await p.locator('textarea').first().fill(sampleSVG);
    await p.waitForTimeout(1500);
    const txt = await p.evaluate(()=>document.body.innerText);
    const btns = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean));
    const savings = (txt.match(/\d+(\.\d+)?\s*%|[\d.]+\s*(kb|bytes|b)\b|saved|smaller/i)||['none'])[0];
    console.log('SVG buttons=',JSON.stringify(btns),'hasCopy=',/copy/i.test(txt),'hasDownload=',/download/i.test(txt),'savings=',savings);
    await ctx.close();
  } catch(e){ console.log('SVG err', e.message); }

  // TRANSLATE
  try {
    const ctx = await browser.newContext({ viewport:{width:1440,height:900}});
    const p = await ctx.newPage();
    await p.goto('https://translate.mrzk.io', {waitUntil:'networkidle'});
    await p.waitForTimeout(800);
    await p.locator('textarea').first().fill('Hello world, how are you today?');
    const btns = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean));
    const txt = await p.evaluate(()=>document.body.innerText);
    console.log('TRANSLATE buttons=',JSON.stringify(btns),'hasClear=',/clear|reset/i.test(txt)||btns.some(b=>/clear|reset/i.test(b)),'hasCopy=',/copy/i.test(txt)||btns.some(b=>/copy/i.test(b)),'charCount=',/\d+\s*(chars|characters|\/)/i.test(txt));
    await ctx.close();
  } catch(e){ console.log('TRANSLATE err', e.message); }

  // SUMMARIZE
  try {
    const ctx = await browser.newContext({ viewport:{width:1440,height:900}});
    const p = await ctx.newPage();
    await p.goto('https://summarize.mrzk.io', {waitUntil:'networkidle'});
    await p.waitForTimeout(800);
    const btns = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean));
    const txt = await p.evaluate(()=>document.body.innerText);
    console.log('SUMMARIZE buttons=',JSON.stringify(btns),'hasClear=',/clear|reset/i.test(txt),'hasCopy=',/copy/i.test(txt),'inputCounter=',/\d+\s*(words|chars|characters)/i.test(txt));
    await ctx.close();
  } catch(e){ console.log('SUMMARIZE err', e.message); }

  // LOREM mobile toggles wrap
  try {
    const ctx = await browser.newContext({ ...iphone, viewport:{width:390,height:844}});
    const p = await ctx.newPage();
    await p.goto('https://lorem.mrzk.io', {waitUntil:'networkidle'});
    await p.waitForTimeout(600);
    const rows = await p.evaluate(()=>{
      const btns=[...document.querySelectorAll('button')].filter(b=>/^(paragraphs|sentences|words|list)$/i.test(b.innerText.trim()));
      return btns.map(b=>{const r=b.getBoundingClientRect();return {t:b.innerText.trim(),top:Math.round(r.top),h:Math.round(r.height)};});
    });
    console.log('LOREM-mobile type-toggles=',JSON.stringify(rows));
    await ctx.close();
  } catch(e){ console.log('LOREM-m err', e.message); }

  // GIF: does drop-only (no click) work, any keyboard? just check controls present pre-upload
  try {
    const ctx = await browser.newContext({ viewport:{width:1440,height:900}});
    const p = await ctx.newPage();
    await p.goto('https://gif.mrzk.io', {waitUntil:'networkidle'});
    await p.waitForTimeout(600);
    const inputsDisabled = await p.evaluate(()=>{
      return [...document.querySelectorAll('input[type=range],input[type=number],select')].map(i=>({t:i.type,disabled:i.disabled}));
    });
    console.log('GIF controls-before-upload=',JSON.stringify(inputsDisabled));
    await ctx.close();
  } catch(e){ console.log('GIF err', e.message); }

  await browser.close();
}
run();
