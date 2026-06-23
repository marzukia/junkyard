import { chromium } from 'playwright';
const browser=await chromium.launch();
const DT={viewport:{width:1440,height:900}};
async function probe(slug,fn){const ctx=await browser.newContext(DT);const p=await ctx.newPage();await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});try{await p.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle',timeout:30000});await p.waitForTimeout(1000);await fn(p);}catch(e){console.log(`  ${slug} ERR:`,e.message.slice(0,160));}await ctx.close();}

console.log('== LOREM copied indicator ==');
await probe('lorem', async p=>{
  const cb=p.locator('button').filter({hasText:/^Copy$/}).first();
  await cb.click(); await p.waitForTimeout(300);
  const where=await p.evaluate(()=>{
    const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&/copied/i.test(e.innerText||''));
    return els.map(e=>({tag:e.tagName,cls:e.className?.toString().slice(0,30),txt:e.innerText.trim().slice(0,30)}));
  });
  console.log('  copied shown in:', JSON.stringify(where));
});

console.log('== TRANSLATE dropdown screenshot+probe ==');
await probe('translate', async p=>{
  const btn=p.locator('button').filter({hasText:/Detect language/}).first();
  await btn.click(); await p.waitForTimeout(700);
  // count ALL visible text nodes that look like languages
  const vis=await p.evaluate(()=>{
    const r=[]; document.querySelectorAll('div,li,button,span,[role=option]').forEach(e=>{const cs=getComputedStyle(e);const b=e.getBoundingClientRect();if(b.width>0&&b.height>0&&cs.visibility!=='hidden'&&e.children.length===0){const t=e.innerText?.trim();if(t&&t.length<25&&/^[A-Z]/.test(t))r.push(t);}});return [...new Set(r)].slice(0,15);
  });
  console.log('  visible single-text items after open:', JSON.stringify(vis));
  await p.screenshot({path:'/tmp/translate-dd.png'}).catch(()=>{});
});
await browser.close();
console.log('done');
