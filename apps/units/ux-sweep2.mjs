import { chromium } from 'playwright';

const TOOLS = ['json','diff','markdown','base64','regex','css','csv','timestamp','uuid','hash','jwt'];
const browser = await chromium.launch();

function snap(page){
  return page.evaluate(() => {
    const txt = (el)=> (el?.innerText||'').trim().slice(0,120);
    const btns = [...document.querySelectorAll('button')].map(b=>({t:(b.innerText||'').trim().slice(0,40), dis:b.disabled, aria:b.getAttribute('aria-label')}));
    const tas = [...document.querySelectorAll('textarea')].map(t=>({ph:t.placeholder, label:t.getAttribute('aria-label'), val:t.value.slice(0,30)}));
    const inputs = [...document.querySelectorAll('input')].map(i=>({type:i.type, ph:i.placeholder, val:String(i.value).slice(0,30)}));
    const selects = [...document.querySelectorAll('select')].map(s=>({opts:[...s.options].map(o=>o.text)}));
    const segs = [...document.querySelectorAll('[role="radio"],[role="tab"],.mantine-SegmentedControl-label')].map(s=>s.innerText.trim());
    const bodyText = document.body.innerText;
    const hasUpload = !!document.querySelector('input[type=file]');
    const privacy = /browser|local|nothing.*upload|no.*upload|client.?side|stays.*device|never.*sent/i.test(bodyText);
    return {btns, tas, inputs, selects, segs, hasUpload, privacy, h1: txt(document.querySelector('h1')), bodyLen: bodyText.length, scrollH: document.body.scrollHeight, vh: window.innerHeight};
  });
}

const out = {};
for (const slug of TOOLS){
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errs = [];
  page.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
  page.on('pageerror', e=>errs.push('PAGEERR:'+String(e).slice(0,160)));
  try{
    await page.goto(`https://${slug}.mrzk.io`, {waitUntil:'networkidle', timeout:30000});
    await page.waitForTimeout(800);
    const initial = await snap(page);
    out[slug] = {initial, errs};
  }catch(e){ out[slug] = {error:String(e).slice(0,200)}; }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out,null,1));
