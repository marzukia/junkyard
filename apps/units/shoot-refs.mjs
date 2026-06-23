import { chromium } from 'playwright';
const URL='https://mrzk.io/posts/did-covid19-make-trump-president/';
const OUT='/home/planky/projects/_fleet/shots';
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:900},colorScheme:'dark',deviceScaleFactor:2})).newPage();
await p.goto(URL,{waitUntil:'networkidle',timeout:60000});
await p.evaluate(()=>document.documentElement.classList.add('dark'));
const ref=await p.$('h2:has-text("References"), #references, .footnotes');
if(ref){await ref.scrollIntoViewIfNeeded();await p.waitForTimeout(400);await p.screenshot({path:`${OUT}/region-dark-references.png`});console.log('ref shot ok');}
else{console.log('no ref el; scrolling to footnotes');
  await p.evaluate(()=>{const f=document.querySelector('.footnotes')||document.querySelector('ol');if(f)f.scrollIntoView();});
  await p.waitForTimeout(400);await p.screenshot({path:`${OUT}/region-dark-references.png`});}
await b.close();
