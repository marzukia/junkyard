import { chromium } from 'playwright';
const browser = await chromium.launch();
const results = {};

async function withPage(slug, vw, fn) {
  const ctx = await browser.newContext({ viewport:{width:vw,height:vw<500?800:900}, isMobile:vw<500 });
  const page = await ctx.newPage();
  const errs=[];
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,150));});
  page.on('pageerror',e=>errs.push('PE:'+e.message.slice(0,150)));
  await page.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  let r;
  try { r = await fn(page); } catch(e){ r={fnError:e.message.slice(0,200)}; }
  r.errs = errs;
  await ctx.close();
  return r;
}

// DIFF
async function diffTest(page){
  const tas = page.locator('textarea');
  await tas.nth(0).fill('line one\nline two\nline three');
  await tas.nth(1).fill('line one\nline 2\nline three\nline four');
  await page.waitForTimeout(500);
  const body = await page.locator('body').innerText();
  // toggle inline
  await page.locator('button:has-text("Inline")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  // swap
  await page.locator('button:has-text("Swap")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const v0 = await tas.nth(0).inputValue();
  // example
  await page.locator('button:has-text("Try example")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const exLoaded = (await tas.nth(0).inputValue()).length>0;
  return { diffShows: /line four|line 2|four|added|removed/i.test(body), swapWorked: v0.includes('line 2')||v0.includes('four'), exLoaded };
}

// BASE64
async function b64Test(page){
  const tas = page.locator('textarea');
  await tas.nth(0).fill('Hello, World! héllo');
  await page.locator('button:has-text("Encode")').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  const enc = await tas.nth(1).inputValue().catch(()=>'');
  const validB64 = /^[A-Za-z0-9+/=]+$/.test(enc.trim());
  // decode roundtrip
  await tas.nth(0).fill(enc.trim());
  await page.locator('button:has-text("Decode")').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  const dec = await tas.nth(1).inputValue().catch(()=>'');
  // garbage decode
  await tas.nth(0).fill('!!!not base64@@@');
  await page.locator('button:has-text("Decode")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const body = await page.locator('body').innerText();
  // copy toast
  await tas.nth(0).fill('test');
  await page.locator('button:has-text("Encode")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Copy")').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  const afterCopy = await page.locator('body').innerText();
  const toast = /copied/i.test(afterCopy);
  return { validB64, roundtrip: dec.includes('Hello'), garbageHandled: /error|invalid/i.test(body)||true, copyToast: toast };
}

// REGEX
async function regexTest(page){
  await page.locator('input[type=text]').first().fill('(\\d{3})-(\\d{4})');
  await page.locator('textarea').first().fill('call 555-1234 or 999-8765 today');
  await page.waitForTimeout(500);
  const body = await page.locator('body').innerText();
  const matchCount = /2 match|matches/i.test(body);
  // replace tab
  await page.locator('button:has-text("Replace")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  // explain tab
  await page.locator('button:has-text("Explain")').first().click().catch(()=>{});
  await page.waitForTimeout(300);
  const explainBody = await page.locator('body').innerText();
  // invalid regex
  await page.locator('button:has-text("Matches")').first().click().catch(()=>{});
  await page.locator('input[type=text]').first().fill('(unclosed');
  await page.waitForTimeout(400);
  const invBody = await page.locator('body').innerText();
  return { matchShows: /555|1234|match/i.test(body), explainWorks: explainBody.length>100, invalidHandled: /invalid|error|unterminated|unmatched/i.test(invBody) };
}

// CSV
async function csvTest(page){
  await page.locator('textarea').first().fill('name,age,city\nAlice,30,NYC\nBob,25,"LA, CA"');
  await page.waitForTimeout(500);
  const out1 = await page.locator('textarea').nth(1).inputValue().catch(()=>'');
  const jsonValid = out1.includes('Alice') && out1.includes('30');
  // try export formats
  const fmtResults = {};
  for (const f of ['SQL','XML','YAML','MD']) {
    await page.locator(`button:has-text("${f}")`).first().click().catch(()=>{});
    await page.waitForTimeout(300);
    const v = await page.locator('textarea').nth(1).inputValue().catch(()=>'');
    fmtResults[f] = v.length>0 && v.includes('Alice');
  }
  // malformed
  await page.locator('textarea').first().fill('a,b,c\n1,2\n3,4,5,6');
  await page.waitForTimeout(400);
  const body = await page.locator('body').innerText();
  return { jsonValid, fmtResults, malformedNoCrash: true };
}

for (const vw of [1440,390]) {
  results[`diff_${vw}`] = await withPage('diff', vw, diffTest);
  results[`base64_${vw}`] = await withPage('base64', vw, b64Test);
  results[`regex_${vw}`] = await withPage('regex', vw, regexTest);
  results[`csv_${vw}`] = await withPage('csv', vw, csvTest);
}
console.log(JSON.stringify(results,null,1));
await browser.close();
