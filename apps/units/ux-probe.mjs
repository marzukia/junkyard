import { chromium, devices } from 'playwright';

const SLUGS = process.argv.slice(2);
const SHOTS = '/home/planky/projects/_fleet/shots';

const probeFn = () => {
  const vw = window.innerWidth;
  const docW = document.documentElement.scrollWidth;
  const bodyW = document.body.scrollWidth;
  const overflowX = Math.max(docW, bodyW) - vw;
  // find elements wider than viewport (right edge past vw)
  const offenders = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2) {
      offenders.push({ tag: el.tagName.toLowerCase(), cls: (el.className||'').toString().slice(0,40), right: Math.round(r.right), w: Math.round(r.width) });
    }
  });
  // tap targets: buttons, a, input, [role=button], select
  const small = [];
  document.querySelectorAll('button, a, input, select, textarea, [role=button], label').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.height < 40 || r.width < 40) {
      const txt = (el.innerText||el.value||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').toString().trim().slice(0,24);
      small.push({ tag: el.tagName.toLowerCase(), h: Math.round(r.height), w: Math.round(r.width), txt });
    }
  });
  // tiny fonts
  const tinyFonts = new Set();
  document.querySelectorAll('button, a, input, p, span, label, li, td, small').forEach(el => {
    if (!el.innerText || !el.innerText.trim()) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 13) tinyFonts.add(fs);
  });
  // inputs that may zoom on iOS (font-size <16)
  const zoomInputs = [];
  document.querySelectorAll('input, textarea, select').forEach(el => {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 16) zoomInputs.push({ tag: el.tagName.toLowerCase(), type: el.type||'', fs });
  });
  // controls inventory
  const buttons = [...document.querySelectorAll('button')].map(b => (b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0,30);
  const inputs = [...document.querySelectorAll('input, textarea, select')].map(i => `${i.tagName.toLowerCase()}[${i.type||''}]${i.placeholder?' ph="'+i.placeholder.slice(0,30)+'"':''}`).slice(0,20);
  return {
    vw, overflowX: Math.round(overflowX),
    offenders: offenders.slice(0,12),
    smallTargets: small.slice(0,25),
    smallTargetCount: small.length,
    tinyFonts: [...tinyFonts].sort((a,b)=>a-b),
    zoomInputs,
    buttons, inputs,
    bodyText: document.body.innerText.slice(0, 600)
  };
};

const iphone = devices['iPhone 13'];

for (const slug of SLUGS) {
  const url = `https://${slug}.mrzk.io`;
  const out = { slug, url };
  const browser = await chromium.launch();
  try {
    // Desktop
    const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pD = await ctxD.newPage();
    await pD.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e=>out.descError=e.message);
    await pD.waitForTimeout(1200);
    out.desktop = await pD.evaluate(probeFn).catch(e=>({err:e.message}));
    await ctxD.close();

    // Mobile
    const ctxM = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 } });
    const pM = await ctxM.newPage();
    await pM.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e=>out.mobError=e.message);
    await pM.waitForTimeout(1200);
    out.mobile = await pM.evaluate(probeFn).catch(e=>({err:e.message}));
    await pM.screenshot({ path: `${SHOTS}/ux-${slug}-mobile.png`, fullPage: true }).catch(e=>out.shotErr=e.message);
    await ctxM.close();
  } catch (e) {
    out.fatal = e.message;
  }
  await browser.close();
  console.log('\n========== ' + slug + ' ==========');
  console.log(JSON.stringify(out, null, 1));
}
