import { chromium } from 'playwright';
const browser = await chromium.launch();
const DT = {viewport:{width:1440,height:900}};

async function probe(slug, viewport, fn){
  const ctx = await browser.newContext(viewport);
  const p = await ctx.newPage();
  const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));}); p.on('pageerror',e=>errs.push('PE:'+e.message.slice(0,120)));
  await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});
  try{ await p.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle',timeout:30000}); await p.waitForTimeout(900); await fn(p);}catch(e){console.log(`  ${slug} ERR:`,e.message.slice(0,140));}
  if(errs.length)console.log(`  ${slug} ERR:`,JSON.stringify([...new Set(errs)].slice(0,4)));
  await ctx.close();
}

console.log('\n===== LOREM =====');
await probe('lorem', DT, async p=>{
  const out0 = await p.locator('textarea').first().inputValue();
  console.log('  prefill len', out0.length, 'sample:', JSON.stringify(out0.slice(0,60)));
  // copy
  const copy = p.getByRole('button',{name:/^Copy$/,exact:false}).filter({hasText:/^Copy$/});
  const cb = p.locator('button').filter({hasText:/^Copy$/}).first();
  const b = await cb.innerText().catch(()=>'?');
  await cb.click().catch(()=>{}); await p.waitForTimeout(500);
  const a = await cb.innerText().catch(()=>'?');
  const clip = await p.evaluate(()=>navigator.clipboard.readText().catch(()=>'')).catch(()=>'');
  console.log('  copy toast:', b,'->',a, '| clipLen', clip.length);
  // change count and persistence
  await p.getByRole('button',{name:/^Sentences$/}).click().catch(()=>{});
  await p.waitForTimeout(300);
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(800);
  const persisted = await p.evaluate(()=>{
    const active=[...document.querySelectorAll('button')].find(b=>b.getAttribute('data-active')==='true'||b.getAttribute('aria-pressed')==='true');
    return {ls:Object.keys(localStorage), activeBtn: active?.innerText};
  });
  console.log('  reload persistence:', JSON.stringify(persisted));
  // placeholder tab
  await p.locator('button,[role=tab]').filter({hasText:/Placeholder Images/}).first().click().catch(()=>{});
  await p.waitForTimeout(700);
  const ph = await p.evaluate(()=>({imgs:document.querySelectorAll('img').length, txt:document.body.innerText.replace(/\s+/g,' ').slice(0,160)}));
  console.log('  placeholder:', JSON.stringify(ph));
});

console.log('\n===== GIF render =====');
await probe('gif', DT, async p=>{
  const png1=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEUlEQVR42mNk+M9QzzCKRxYAA40CAYBh+3UAAAAASUVORK5CYII=','base64');
  const png2=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEElEQVR42mP8z/C/noEKgBEAFvkD/T7tQ7sAAAAASUVORK5CYII=','base64');
  await p.locator('input[type=file]').first().setInputFiles([{name:'a.png',mimeType:'image/png',buffer:png1},{name:'b.png',mimeType:'image/png',buffer:png2}]);
  await p.waitForTimeout(2000);
  const build = p.locator('button').filter({hasText:/Build GIF/}).first();
  console.log('  build btn present:', await build.count());
  // check frames shown
  const frames = await p.locator('img').count();
  console.log('  imgs (frame thumbs):', frames);
  await build.click().catch(()=>{});
  await p.waitForTimeout(6000);
  const after = await p.evaluate(()=>({
    txt: document.body.innerText.replace(/\s+/g,' '),
    gifImg: document.querySelectorAll('img[src^="blob:"],img[src*="gif"]').length,
    dlLinks: [...document.querySelectorAll('a[download],button')].map(e=>e.innerText.trim()).filter(t=>/download/i.test(t)),
  }));
  console.log('  after build: gifImgs=',after.gifImg,'| dl=',JSON.stringify(after.dlLinks),'| hasErr=',/error|fail|could ?n.t/i.test(after.txt));
  // reorder / delay controls
  const ranges = await p.locator('input[type=range],[role=slider]').count();
  console.log('  range controls:', ranges);
});
await browser.close();
