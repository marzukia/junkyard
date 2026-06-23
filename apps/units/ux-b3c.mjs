import { chromium } from 'playwright';

// Force output textareas to have content via direct value set + input event, see if copy button appears.
async function check(slug) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1440,height:900}});
  const p = await ctx.newPage();
  const out = { slug };
  try {
    await p.goto(`https://${slug}.mrzk.io`, {waitUntil:'networkidle'});
    await p.waitForTimeout(800);
    out.before = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean));
    // try to set the 2nd textarea (output) to text and fire react-style input
    await p.evaluate(()=>{
      const tas=document.querySelectorAll('textarea');
      const target = tas[tas.length-1];
      if(target){
        const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
        setter.call(target,'This is a forced output result for testing copy buttons.');
        target.dispatchEvent(new Event('input',{bubbles:true}));
      }
    });
    await p.waitForTimeout(500);
    out.after = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean));
  } catch(e){ out.err=e.message; }
  await browser.close();
  console.log(JSON.stringify(out));
}
for (const s of process.argv.slice(2)) await check(s);
