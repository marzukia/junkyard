import { chromium } from 'playwright';
const CHROME = '/home/planky/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const SHOTS = '/home/planky/projects/_fleet/shots';
const IMG = '/tmp/sample.jpg';
const browser = await chromium.launch({ executablePath: CHROME });

async function overflowProbe(page) {
  return await page.evaluate(() => {
    const vw = window.innerWidth;
    const overflowX = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
    const wide = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 && r.width < 5000 && r.width > 30) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className && typeof el.className==='string') ? '.'+el.className.split(' ').slice(0,2).join('.') : '';
        wide.push(`${tag}${cls} w=${Math.round(r.width)} right=${Math.round(r.right)}`);
      }
    });
    const canvases = [...document.querySelectorAll('canvas')].map(c=>{const r=c.getBoundingClientRect();return `canvas css=${Math.round(r.width)}x${Math.round(r.height)} attr=${c.width}x${c.height} left=${Math.round(r.left)} right=${Math.round(r.right)}`;});
    return { vw, overflowX, wide: wide.slice(0,10), canvases };
  });
}

// each entry: how to get the tool into "active/editor" state on mobile
const cases = {
  collage: async (p) => { await p.setInputFiles('input[type=file]', [IMG,IMG]).catch(()=>{}); },
  qr:      async (p) => { const t=await p.$('textarea,input[type=text]'); if(t) await t.fill('https://example.com/hello-world-test'); },
  og:      async (p) => { /* renders preview by default */ },
  meme:    async (p) => { await p.setInputFiles('input[type=file]', IMG).catch(()=>{}); },
  crop:    async (p) => { await p.setInputFiles('input[type=file]', IMG).catch(()=>{}); },
  screenshot: async (p) => { await p.setInputFiles('input[type=file]', IMG).catch(()=>{}); },
  convert: async (p) => { await p.setInputFiles('input[type=file]', IMG).catch(()=>{}); },
  exif:    async (p) => { await p.setInputFiles('input[type=file]', IMG).catch(()=>{}); },
  favicon: async (p) => { await p.setInputFiles('input[type=file]', IMG).catch(()=>{}); },
  ocr:     async (p) => { await p.setInputFiles('input[type=file]', IMG).catch(()=>{}); },
};

for (const [slug, act] of Object.entries(cases)) {
  const url = `https://${slug}.mrzk.io`;
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2, userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil:'networkidle', timeout:45000 }).catch(()=>{});
    await p.waitForTimeout(800);
    await act(p);
    await p.waitForTimeout(2500);
    const after = await overflowProbe(p);
    // post-action buttons (e.g. download appears after upload)
    const btns = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0,30));
    await p.screenshot({ path:`${SHOTS}/ux-${slug}-mobile-active.png`, fullPage:true }).catch(()=>{});
    console.log(`\n== ${slug} (ACTIVE/mobile) ==`);
    console.log('overflowX:', after.overflowX);
    console.log('wide:', JSON.stringify(after.wide));
    console.log('canvases:', JSON.stringify(after.canvases));
    console.log('buttons:', JSON.stringify(btns));
  } catch(e){ console.log(`== ${slug} == ERR ${e.message}`); }
  await ctx.close();
}
await browser.close();
console.log('\nDONE deep');
