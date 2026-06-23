import { chromium } from 'playwright';
const browser = await chromium.launch();
const log={};
async function run(slug,fn){
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140));});
  page.on('pageerror',e=>errs.push('PAGEERR:'+String(e).slice(0,140)));
  const n=[];
  try{ await page.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle',timeout:30000}); await page.waitForTimeout(500); await fn(page,n);}catch(e){n.push('THREW:'+String(e).slice(0,160));}
  log[slug]={notes:n,errs}; await page.close();
}
const bt=async p=>(await p.evaluate(()=>document.body.innerText)).replace(/\s+/g,' ').trim();

// JWT: does it show exp as human date + expired badge?
await run('jwt', async(p,n)=>{
  const tok='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDAwMDB9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';
  await p.locator('textarea').first().fill(tok);
  await p.waitForTimeout(500);
  const t=await bt(p);
  n.push('shows_exp_human: '+(/2018|jan|expired|ago/i.test(t)?'YES':'NO'));
  n.push('full: '+t.slice(t.indexOf('PAYLOAD')>0?t.indexOf('PAYLOAD'):300, (t.indexOf('PAYLOAD')>0?t.indexOf('PAYLOAD'):300)+400));
  // signature verify?
  n.push('sig_verify_ui: '+(/verify signature|secret|signature valid|hs256 secret/i.test(t)?'YES':'NO'));
});

// REGEX: click Explain tab with pattern set
await run('regex', async(p,n)=>{
  await p.evaluate(()=>{const i=document.querySelector('input[type=text]'); i.value='(\\d{4})-(\\d{2})';i.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForTimeout(300);
  await p.locator('button:has-text("Explain")').first().click().catch(()=>{});
  await p.waitForTimeout(300);
  n.push('EXPLAIN: '+(await bt(p)).slice(0,400));
  // replace tab
  await p.locator('button:has-text("Replace")').first().click().catch(()=>{});
  await p.waitForTimeout(200);
  n.push('REPLACE_tab: '+(await bt(p)).slice(0,300));
});

// MARKDOWN: GFM task list rendering check raw html
await run('markdown', async(p,n)=>{
  await p.locator('textarea').first().fill('- [ ] todo\n- [x] done');
  await p.waitForTimeout(400);
  const html=await p.evaluate(()=>{const el=[...document.querySelectorAll('*')].find(e=>/preview/i.test(e.className||'')); return el?el.innerHTML:'NONE';});
  n.push('TASKLIST_html: '+html.slice(0,300));
});

// DIFF: empty one side
await run('diff', async(p,n)=>{
  await p.locator('textarea[aria-label="Original text"]').fill('only left has content');
  await p.waitForTimeout(400);
  n.push('ONE_SIDE: '+(await bt(p)).slice(80,260));
});

// CSV: malformed (ragged rows)
await run('csv', async(p,n)=>{
  await p.locator('textarea').first().fill('a,b,c\n1,2\n4,5,6,7');
  await p.waitForTimeout(400);
  const t=await bt(p);
  n.push('RAGGED: '+(/error|mismatch|warn|inconsistent/i.test(t)?'has-warn':'NO-warn')+' :: '+t.slice(80,240));
});

// HASH: verify checksum match flow - fill text + matching checksum
await run('hash', async(p,n)=>{
  await p.locator('textarea').first().fill('hello world');
  await p.waitForTimeout(400);
  // sha256 of hello world = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
  const verify=p.locator('input').filter({hasNot:p.locator('[type=radio]')}).first();
  await p.evaluate(()=>{const ins=[...document.querySelectorAll('input[type=text],input:not([type])')]; const v=ins[ins.length-1]; if(v){v.value='b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';v.dispatchEvent(new Event('input',{bubbles:true}));}});
  await p.waitForTimeout(400);
  const t=await bt(p);
  n.push('VERIFY_MATCH: '+(/match|✓|valid|correct/i.test(t)?'shows-match':'NO-feedback')+' :: '+t.slice(t.indexOf('VERIFY'),t.indexOf('VERIFY')+200));
});

// TIMESTAMP: relative time? "in 5 years / ago"?
await run('timestamp', async(p,n)=>{
  await p.locator('input').first().fill('1700000000');
  await p.waitForTimeout(400);
  const t=await bt(p);
  n.push('REL_TIME: '+(/ago|relative|years|months|in \d/i.test(t)?'YES':'NO')+' :: '+t.slice(t.indexOf('EPOCH'),t.indexOf('EPOCH')+300));
});

await browser.close();
console.log(JSON.stringify(log,null,1));
