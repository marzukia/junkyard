import { chromium } from 'playwright';
const browser = await chromium.launch();
const log = {};
async function run(slug, fn){
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140));});
  page.on('pageerror',e=>errs.push('PAGEERR:'+String(e).slice(0,140)));
  const notes=[];
  try{
    await page.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle',timeout:30000});
    await page.waitForTimeout(500);
    await fn(page, notes);
  }catch(e){ notes.push('THREW:'+String(e).slice(0,160)); }
  log[slug]={notes, errs};
  await page.close();
}
const txt = (s)=>s.replace(/\s+/g,' ').trim().slice(0,200);
async function bodyText(page){ return txt(await page.evaluate(()=>document.body.innerText)); }

// JSON: paste broken json, see error quality; paste valid, format; huge input
await run('json', async (page,n)=>{
  const ta = page.locator('textarea[aria-label="JSON input"]');
  await ta.fill('{"a":1, "b": [1,2,}');
  await page.waitForTimeout(400);
  n.push('BROKEN_JSON_out: '+ await bodyText(page).then(t=>t.slice(0,260)));
  // valid
  await ta.fill('{"z":1,"a":2,"m":[3,1,2]}');
  await page.locator('button:has-text("Format")').first().click();
  await page.waitForTimeout(300);
  const out = await page.locator('textarea[aria-label="JSON output"]').inputValue();
  n.push('FORMAT_out_firstkey: '+ out.split('\n').slice(0,3).join(' / '));
  // is there sort keys? jsonpath? copy?
  const hasSort = await page.locator('button:has-text("Sort")').count();
  n.push('hasSortKeys:'+hasSort);
});

// DIFF: identical inputs (does it say "identical"?), then real diff
await run('diff', async (page,n)=>{
  const o=page.locator('textarea[aria-label="Original text"]'), m=page.locator('textarea[aria-label="Modified text"]');
  await o.fill('hello world\nline two\nline three');
  await m.fill('hello world\nline 2\nline three');
  await page.waitForTimeout(400);
  n.push('DIFF_out: '+ await bodyText(page).then(t=>t.slice(120,360)));
  // identical case
  await m.fill('hello world\nline two\nline three');
  await page.waitForTimeout(400);
  const bt = await bodyText(page);
  n.push('IDENTICAL_msg: '+ (/identical|no diff|no change|same/i.test(bt)?'YES-has-msg':'NO-msg('+bt.slice(120,240)+')'));
});

// MARKDOWN: scroll sync? does preview scroll with editor? table support?
await run('markdown', async (page,n)=>{
  const ta=page.locator('textarea[aria-label="Markdown source editor"]');
  await ta.fill('# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [ ] todo\n- [x] done\n\n```js\nconst x=1\n```\n\n> quote');
  await page.waitForTimeout(500);
  const prev = await page.evaluate(()=>{const p=document.querySelector('.markdown-preview,[class*=preview]'); return p?p.innerHTML.slice(0,400):'NO-PREVIEW-CLASS';});
  n.push('TABLE_rendered:'+/<table/i.test(prev)+' CHECKBOX:'+/checkbox|type="checkbox"/i.test(prev)+' CODEHL:'+/hljs|language-|<code/i.test(prev));
  // sync scroll check: scroll editor, does preview move?
});

// BASE64: decode a data-uri image? encode unicode/emoji
await run('base64', async (page,n)=>{
  const ta=page.locator('textarea').first();
  await ta.fill('Hello 👋 café');
  await page.waitForTimeout(300);
  n.push('ENCODE_unicode: '+ await bodyText(page).then(t=>t.slice(0,200)));
});

// REGEX: type a pattern + test string, see matches; bad regex
await run('regex', async (page,n)=>{
  const tas = await page.locator('textarea, input[type=text]').all();
  // find pattern input
  await page.evaluate(()=>{
    const pat=document.querySelector('input[placeholder*="pattern" i],input[aria-label*="pattern" i],input[type=text]');
    if(pat){pat.value='\\d{3}-\\d{4}';pat.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  const test = page.locator('textarea').first();
  await test.fill('call 555-1234 or 999-8765');
  await page.waitForTimeout(400);
  n.push('REGEX_matches: '+ await bodyText(page).then(t=>t.slice(0,260)));
  // bad regex
  await page.evaluate(()=>{
    const pat=document.querySelector('input[type=text]');
    if(pat){pat.value='(unclosed[';pat.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  await page.waitForTimeout(400);
  const bt=await bodyText(page);
  n.push('BAD_REGEX: '+(/invalid|error|unterminated|unmatched/i.test(bt)?'has-error-msg':'NO-error('+bt.slice(0,160)+')'));
});

// CSV: paste csv, see table; export
await run('csv', async (page,n)=>{
  const ta=page.locator('textarea').first();
  await ta.fill('name,age,city\nAlice,30,NYC\nBob,25,LA\n"Quote, here",40,SF');
  await page.waitForTimeout(500);
  const hasTable=await page.locator('table').count();
  n.push('CSV_table:'+hasTable+' '+await bodyText(page).then(t=>t.slice(0,180)));
  const btns=await page.locator('button').allInnerTexts();
  n.push('CSV_btns: '+btns.map(b=>b.trim()).filter(Boolean).join('|').slice(0,200));
});

// TIMESTAMP: live now ticking? convert
await run('timestamp', async (page,n)=>{
  const bt1=await bodyText(page);
  await page.waitForTimeout(1600);
  const bt2=await bodyText(page);
  n.push('LIVE_NOW_ticks:'+(bt1!==bt2?'YES':'NO'));
  const inp=page.locator('input[type=text],input[type=number]').first();
  await inp.fill('1700000000');
  await page.waitForTimeout(400);
  n.push('TS_convert: '+await bodyText(page).then(t=>t.slice(0,260)));
});

// UUID: generate, bulk, copy
await run('uuid', async (page,n)=>{
  const bt=await bodyText(page);
  n.push('UUID_initial: '+bt.slice(0,200));
  const btns=await page.locator('button').allInnerTexts();
  n.push('UUID_btns: '+btns.map(b=>b.trim()).filter(Boolean).join('|').slice(0,180));
});

// HASH: hash text, compare mode?
await run('hash', async (page,n)=>{
  const ta=page.locator('textarea').first();
  await ta.fill('hello world');
  await page.waitForTimeout(500);
  n.push('HASH_out: '+await bodyText(page).then(t=>t.slice(0,300)));
  const hasCompare=await page.locator('text=/compare|verify|match/i').count();
  n.push('hasCompare:'+hasCompare);
});

// JWT: paste a token, see decode; expired?
await run('jwt', async (page,n)=>{
  const tok='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDAwMDB9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';
  const ta=page.locator('textarea').first();
  await ta.fill(tok);
  await page.waitForTimeout(500);
  n.push('JWT_out: '+await bodyText(page).then(t=>t.slice(0,340)));
  const hasExp=await page.locator('text=/expired|exp/i').count();
  n.push('exp_handling:'+hasExp);
});

await browser.close();
console.log(JSON.stringify(log,null,1));
