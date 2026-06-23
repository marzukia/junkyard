import { chromium, devices } from 'playwright';
const iphone = devices['iPhone 13'];
const browser = await chromium.launch();

async function probe(slug, viewport, fn){
  const ctx = await browser.newContext(viewport);
  const p = await ctx.newPage();
  const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));}); p.on('pageerror',e=>errs.push('PE:'+e.message.slice(0,120)));
  await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});
  try{ await p.goto(`https://${slug}.mrzk.io`,{waitUntil:'networkidle',timeout:30000}); await p.waitForTimeout(900); await fn(p,ctx);}catch(e){console.log(`  ${slug} ERR:`,e.message.slice(0,140));}
  if(errs.length)console.log(`  ${slug} CONSOLE:`,JSON.stringify([...new Set(errs)].slice(0,3)));
  await ctx.close();
}

// Lorem copy: look for ANY toast/notification element
console.log('\n== LOREM copy-toast detection (desktop) ==');
await probe('lorem',{viewport:{width:1440,height:900}}, async p=>{
  const cb = p.locator('button').filter({hasText:/^Copy$/}).first();
  await cb.click();
  await p.waitForTimeout(250);
  const toast = await p.evaluate(()=>{
    const sels=['.mantine-Notification-root','[role=alert]','[role=status]','.mantine-Notifications-root *'];
    const found=[]; for(const s of sels){document.querySelectorAll(s).forEach(e=>{if(e.innerText?.trim())found.push(e.innerText.trim().slice(0,40));});}
    return found;
  });
  const btnAfter = await cb.innerText();
  console.log('  toast elements:', JSON.stringify(toast), '| btn now:', btnAfter);
});

// Mobile checks: layout overflow, tap targets
for (const slug of ['lorem','svg','gif','transcribe','upscale','depth','caption','translate','summarize','chat']) {
  await probe(slug, {...iphone}, async (p)=>{
    const m = await p.evaluate(()=>{
      const de=document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      // find smallest interactive tap targets
      const small=[];
      document.querySelectorAll('button,a,input,select,[role=button],[role=tab]').forEach(e=>{
        const r=e.getBoundingClientRect(); if(r.width>0&&r.height>0&&(r.height<40||r.width<40)){small.push(`${(e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,14)}:${Math.round(r.width)}x${Math.round(r.height)}`);}
      });
      // any element wider than viewport
      let widest=0,widestEl='';
      document.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>widest){widest=r.right;widestEl=e.tagName+'.'+(e.className?.toString().slice(0,20)||'');}});
      // font-size on text inputs (iOS zoom check)
      const inputFonts=[...document.querySelectorAll('input[type=text],input:not([type]),textarea')].map(e=>getComputedStyle(e).fontSize);
      return {overflow, small: small.slice(0,8), vw:de.clientWidth, widest:Math.round(widest), widestEl, inputFonts};
    });
    const flag = m.overflow>2 ? 'OVERFLOW '+m.overflow+'px' : 'ok';
    const zoom = m.inputFonts.some(f=>parseFloat(f)<16) ? 'IOS-ZOOM-RISK '+JSON.stringify(m.inputFonts) : 'fonts-ok';
    console.log(`  [${slug}] vw${m.vw} ${flag} widest=${m.widest}(${m.widestEl}) | ${zoom} | smallTargets=${JSON.stringify(m.small)}`);
  });
}
await browser.close();
