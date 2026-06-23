import { chromium } from 'playwright';
const browser=await chromium.launch();
const log={};
async function run(slug,fn){const p=await browser.newPage({viewport:{width:1280,height:900}});const e=[];p.on('console',m=>{if(m.type()==='error')e.push(m.text().slice(0,120));});p.on('pageerror',x=>e.push('PE:'+String(x).slice(0,120)));const n=[];try{await p.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle',timeout:30000});await p.waitForTimeout(500);await fn(p,n);}catch(x){n.push('THREW:'+String(x).slice(0,140));}log[slug]={notes:n,errs:e};await p.close();}
const bt=async p=>(await p.evaluate(()=>document.body.innerText)).replace(/\s+/g,' ').trim();

// HASH proper fill of verify field
await run('hash',async(p,n)=>{
  await p.locator('textarea').first().fill('hello world');
  await p.waitForTimeout(300);
  // verify field: find input under VERIFY label
  const vf=p.locator('input[placeholder*="checksum" i], input[placeholder*="paste" i], input[type=text]').last();
  await vf.fill('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  await p.waitForTimeout(400);
  n.push('VERIFY: '+(await bt(p)).match(/VERIFY[\s\S]{0,120}/)?.[0]);
  // wrong
  await vf.fill('deadbeef');
  await p.waitForTimeout(300);
  const t=await bt(p);
  n.push('mismatch_shown:'+/mismatch/i.test(t)+' match_shown_after_wrong:'+/\bmatch\b/i.test(t.replace(/mismatch/gi,'')));
});

// REGEX replace: does RESULT reflect test string?
await run('regex',async(p,n)=>{
  await p.evaluate(()=>{const i=document.querySelector('input[type=text]');i.value='o';i.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.locator('textarea').first().fill('foo bar boo');
  await p.locator('button:has-text("Replace")').first().click();
  await p.waitForTimeout(300);
  // fill replacement
  const rep=p.locator('input[type=text]').last();
  await rep.fill('0');
  await p.waitForTimeout(300);
  n.push('REPLACE_result: '+(await bt(p)).match(/RESULT[\s\S]{0,80}/)?.[0]);
});

// JSON huge input stress (5MB)
await run('json',async(p,n)=>{
  const t0=Date.now();
  await p.evaluate(()=>{const big='['+Array.from({length:50000},(_,i)=>`{"id":${i},"name":"item ${i}"}`).join(',')+']'; const ta=document.querySelector('textarea[aria-label="JSON input"]'); const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; setter.call(ta,big); ta.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.locator('button:has-text("Format")').first().click();
  await p.waitForTimeout(1500);
  const out=await p.locator('textarea[aria-label="JSON output"]').inputValue();
  n.push('HUGE_50k_objs: outLen='+out.length+' ms='+(Date.now()-t0)+' frozen:'+(out.length<10?'MAYBE':'no'));
});

// BASE64: decode mode with garbage
await run('base64',async(p,n)=>{
  await p.locator('button:has-text("Decode")').first().click().catch(()=>{});
  await p.waitForTimeout(200);
  await p.locator('textarea').first().fill('not valid base64!!!@@@');
  await p.waitForTimeout(400);
  const t=await bt(p);
  n.push('B64_DECODE_garbage: '+(/invalid|error|not valid|malformed/i.test(t)?'has-err':'NO-err')+' :: '+t.slice(t.indexOf('OUTPUT'),t.indexOf('OUTPUT')+120));
});

// UUID bulk 1000
await run('uuid',async(p,n)=>{
  const cnt=p.locator('input[type=number], input').first();
  await cnt.fill('1000').catch(()=>{});
  await p.locator('button:has-text("Generate")').first().click();
  await p.waitForTimeout(500);
  const t=await bt(p);
  n.push('UUID_1000: bodyLen='+t.length+' hasDownload:'+(await p.locator('button:has-text("Download")').count()));
});

await browser.close();
console.log(JSON.stringify(log,null,1));
