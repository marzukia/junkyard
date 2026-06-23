import { chromium } from 'playwright';
const browser=await chromium.launch();
const DT={viewport:{width:1440,height:900}};
async function probe(slug,fn){const ctx=await browser.newContext(DT);const p=await ctx.newPage();const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));});p.on('pageerror',e=>errs.push('PE:'+e.message.slice(0,120)));await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});try{await p.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle',timeout:30000});await p.waitForTimeout(1000);await fn(p);}catch(e){console.log(`  ${slug} ERR:`,e.message.slice(0,160));}if(errs.length)console.log(`  ${slug} CONSOLE:`,JSON.stringify([...new Set(errs)].slice(0,4)));await ctx.close();}

// SUMMARIZE URL: click URL, dump what appears
console.log('\n== SUMMARIZE URL btn behaviour ==');
await probe('summarize', async p=>{
  const before=await p.evaluate(()=>document.querySelectorAll('input').length);
  await p.locator('button').filter({hasText:/^URL$/i}).first().click();
  await p.waitForTimeout(600);
  const after=await p.evaluate(()=>({
    inputs:[...document.querySelectorAll('input')].map(i=>({type:i.type,ph:i.placeholder})),
    modalTxt:document.querySelector('.mantine-Modal-body,[role=dialog]')?.innerText?.slice(0,120),
    bodyDelta:document.body.innerText.replace(/\s+/g,' ').slice(0,200)
  }));
  console.log('  inputs before',before,'inputs after:',JSON.stringify(after.inputs),'| modal:',after.modalTxt);
});

// SUMMARIZE empty submit (garbage/edge)
console.log('\n== SUMMARIZE empty submit ==');
await probe('summarize', async p=>{
  await p.locator('textarea').first().fill('');
  const btn=p.locator('button').filter({hasText:/^Summarize$/}).first();
  const disabled=await btn.isDisabled().catch(()=>null);
  console.log('  Summarize disabled when empty:', disabled);
  // tiny input
  await p.locator('textarea').first().fill('Hi.');
  const dis2=await btn.isDisabled().catch(()=>null);
  console.log('  Summarize disabled with "Hi.":', dis2);
});

// TRANSLATE lang dropdown — open and read portal
console.log('\n== TRANSLATE lang dropdown ==');
await probe('translate', async p=>{
  await p.locator('button').filter({hasText:/Detect language/}).first().click().catch(()=>{});
  await p.waitForTimeout(600);
  const opts=await p.evaluate(()=>{
    const sels=['[role=option]','.mantine-Select-option','.mantine-Combobox-option','[data-combobox-option]','li','[role=menuitem]'];
    const all=new Set(); for(const s of sels)document.querySelectorAll(s).forEach(e=>{if(e.innerText?.trim())all.add(e.innerText.trim().slice(0,20));});
    return [...all].slice(0,8);
  });
  console.log('  dropdown opts:', JSON.stringify(opts));
  // type to filter
  await p.keyboard.type('span');
  await p.waitForTimeout(400);
  const filtered=await p.evaluate(()=>[...document.querySelectorAll('[role=option],.mantine-Select-option,[data-combobox-option]')].map(e=>e.innerText.trim()).slice(0,5));
  console.log('  after typing "span":', JSON.stringify(filtered));
});

// COPY FEEDBACK consistency: do tools that HAVE output copy buttons show feedback?
// Test SVG (we know works) vs check translate/summarize after we can't run model...
// Instead, test the GENERIC copy components: lorem(no feedback found), svg(feedback yes).
// Check gif download & lorem 'Copy HTML' more carefully + look for aria-live region globally
console.log('\n== LOREM deeper copy feedback ==');
await probe('lorem', async p=>{
  const cb=p.locator('button').filter({hasText:/^Copy$/}).first();
  const html=await p.evaluate(()=>document.querySelectorAll('[aria-live]').length);
  await cb.click();
  await p.waitForTimeout(300);
  const post=await p.evaluate(()=>{
    return {
      ariaLive:[...document.querySelectorAll('[aria-live]')].map(e=>e.innerText.trim()).filter(Boolean),
      anyCopied:/copied/i.test(document.body.innerText),
      mantineNotif:document.querySelectorAll('.mantine-Notifications-root .mantine-Notification-root').length,
    };
  });
  console.log('  aria-live regions:',html,'| post-click ariaLive text:',JSON.stringify(post.ariaLive),'| "copied" in body:',post.anyCopied,'| mantine notif count:',post.mantineNotif);
});

await browser.close();
