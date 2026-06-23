// Exercise the ML-tool UI scaffolding WITHOUT downloading models where possible:
// sample buttons, file import, options, copy feedback consistency, translate file-load, summarize import/URL/sample.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const DT={viewport:{width:1440,height:900}};

async function probe(slug, fn){
  const ctx=await browser.newContext(DT); const p=await ctx.newPage();
  const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));}); p.on('pageerror',e=>errs.push('PE:'+e.message.slice(0,120)));
  await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});
  try{ await p.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle',timeout:30000}); await p.waitForTimeout(1000); await fn(p,ctx);}catch(e){console.log(`  ${slug} ERR:`,e.message.slice(0,160));}
  if(errs.length)console.log(`  ${slug} CONSOLE:`,JSON.stringify([...new Set(errs)].slice(0,4)));
  await ctx.close();
}
const tinyPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHElEQVR42mNkYPhfz0AEYBxVSF+Fo2EwGgajCgC0lQ/RkM3DwwAAAABJRU5ErkJggg==','base64');

// SUMMARIZE: IMPORT / URL / SAMPLE buttons + length slider
console.log('\n== SUMMARIZE ==');
await probe('summarize', async p=>{
  // SAMPLE
  await p.locator('button').filter({hasText:/^SAMPLE$/i}).first().click().catch(()=>{});
  await p.waitForTimeout(800);
  const inLen = await p.locator('textarea').first().inputValue();
  console.log('  SAMPLE filled input chars:', inLen.length);
  // length slider move
  const slider=p.locator('[role=slider]').first();
  if(await slider.count()){ const box=await slider.boundingBox(); await p.mouse.click(box.x+box.width*0.9, box.y+box.height/2); await p.waitForTimeout(300); const t=await p.evaluate(()=>document.body.innerText.match(/~\d+ WORDS|MEDIUM|SHORT|LONG/gi)); console.log('  length label after slider:', JSON.stringify(t)); }
  // URL btn opens input?
  await p.locator('button').filter({hasText:/^URL$/i}).first().click().catch(()=>{});
  await p.waitForTimeout(400);
  const urlInput = await p.locator('input[type=url],input[placeholder*="http" i],input[placeholder*="URL" i]').count();
  console.log('  URL btn -> url input appeared:', urlInput);
});

// TRANSLATE: LOAD FILE, lang selectors, swap, copy feedback
console.log('\n== TRANSLATE ==');
await probe('translate', async p=>{
  await p.locator('textarea').first().fill('Bonjour le monde');
  await p.waitForTimeout(300);
  // FROM/TO language pickers
  const fromBtn=p.locator('button').filter({hasText:/Detect language/}).first();
  await fromBtn.click().catch(()=>{}); await p.waitForTimeout(400);
  const opts = await p.evaluate(()=>[...document.querySelectorAll('[role=option],.mantine-Select-item,li')].map(e=>e.innerText?.trim()).filter(Boolean).slice(0,6));
  console.log('  lang dropdown opts sample:', JSON.stringify(opts));
  await p.keyboard.press('Escape');
  // LOAD FILE wiring
  const fileInputs = await p.locator('input[type=file]').count();
  console.log('  file inputs (LOAD FILE):', fileInputs);
  await p.locator('input[type=file]').first().setInputFiles([{name:'t.txt',mimeType:'text/plain',buffer:Buffer.from('This loaded from a file.')}]).catch(e=>console.log('  loadfile err',e.message.slice(0,60)));
  await p.waitForTimeout(500);
  const src=await p.locator('textarea').first().inputValue();
  console.log('  after LOAD FILE source:', JSON.stringify(src.slice(0,50)));
});

// CAPTION: sample, Load from URL, Batch, variations
console.log('\n== CAPTION ==');
await probe('caption', async p=>{
  // Load from URL tab
  await p.locator('button,[role=tab]').filter({hasText:/Load from URL/}).first().click().catch(()=>{});
  await p.waitForTimeout(400);
  const urlInput=await p.locator('input[type=url],input[placeholder*="http" i],input[placeholder*="URL" i]').count();
  console.log('  URL tab input present:', urlInput);
  // Batch tab
  await p.locator('button,[role=tab]').filter({hasText:/^Batch$/}).first().click().catch(()=>{});
  await p.waitForTimeout(400);
  const batchTxt=await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,140));
  console.log('  Batch tab txt:', batchTxt.slice(0,120));
  // variations 1/2/3 selectable
  await p.locator('button,[role=tab]').filter({hasText:/Upload file/}).first().click().catch(()=>{});
  await p.waitForTimeout(200);
  await p.locator('button').filter({hasText:/^3$/}).first().click().catch(()=>{});
  await p.waitForTimeout(200);
  const active=await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>['1','2','3'].includes(b.innerText.trim())&&(b.getAttribute('data-active')==='true'||b.getAttribute('aria-pressed')==='true'||/active/i.test(b.className)));return b?.innerText;});
  console.log('  variations active after click 3:', active);
});

// UPSCALE: sample image, scale/format options, paste
console.log('\n== UPSCALE ==');
await probe('upscale', async p=>{
  // toggle 4x and WebP — do they reflect active state?
  await p.locator('button').filter({hasText:/^4x$/}).first().click().catch(()=>{});
  await p.locator('button').filter({hasText:/^WebP$/}).first().click().catch(()=>{});
  await p.waitForTimeout(300);
  const state=await p.evaluate(()=>{
    const act=[...document.querySelectorAll('button')].filter(b=>b.getAttribute('data-active')==='true'||b.getAttribute('aria-pressed')==='true'||/(_active|--active)/.test(b.className)).map(b=>b.innerText.trim());
    return act;
  });
  console.log('  active option buttons:', JSON.stringify(state));
  // sample image present
  const sample=p.locator('button').filter({hasText:/sample/i}).first();
  console.log('  sample button:', await sample.count());
});

// DEPTH: colourmap selection reflects, invert
console.log('\n== DEPTH ==');
await probe('depth', async p=>{
  await p.locator('button').filter({hasText:/^Magma$/}).first().click().catch(()=>{});
  await p.waitForTimeout(200);
  const act=await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.getAttribute('data-active')==='true'||b.getAttribute('aria-pressed')==='true'||/(_active|--active|active)/.test(b.className)).map(b=>b.innerText.trim()));
  console.log('  active after Magma:', JSON.stringify(act));
});

// TRANSCRIBE: language select, record button, output-format presence
console.log('\n== TRANSCRIBE ==');
await probe('transcribe', async p=>{
  const sel=await p.locator('.mantine-Select-input,select,[role=combobox]').count();
  console.log('  selects (language):', sel);
  const rec=await p.locator('button').filter({hasText:/Record/}).count();
  console.log('  record button:', rec);
  const prev=await p.locator('button').filter({hasText:/Preview output/}).count();
  console.log('  preview-output button:', prev);
});

await browser.close();
