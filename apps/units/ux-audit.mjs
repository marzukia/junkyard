import { chromium } from 'playwright';

const CHROME = '/home/planky/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const SHOTS = '/home/planky/projects/_fleet/shots';
const slugs = process.argv.slice(2);

const browser = await chromium.launch({ executablePath: CHROME });

// Generic page probe: structural + QoL signal extraction.
async function probe(page) {
  return await page.evaluate(() => {
    const vw = window.innerWidth;
    const docW = document.documentElement.scrollWidth;
    const bodyW = document.body.scrollWidth;
    const overflowX = Math.max(docW, bodyW) - vw;

    // find elements wider than viewport (overflow culprits)
    const wide = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 2 && r.width < 5000) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.split(' ').slice(0,2).join('.') : '';
        wide.push(`${tag}${cls} w=${Math.round(r.width)} left=${Math.round(r.left)}`);
      }
    });

    // tap targets: buttons / a / inputs smaller than 40px
    const smallTargets = [];
    document.querySelectorAll('button, a, [role=button], input[type=checkbox], input[type=radio], select').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.height < 36 || r.width < 36) {
        const t = (el.innerText || el.value || el.getAttribute('aria-label') || el.tagName).trim().slice(0,20);
        smallTargets.push(`${t}=${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });

    // inputs that would zoom on iOS (font-size < 16px)
    const smallFontInputs = [];
    document.querySelectorAll('input[type=text], input[type=url], input[type=number], input:not([type]), textarea, input[type=search]').forEach(el => {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) smallFontInputs.push(`${el.tagName.toLowerCase()}[${el.type||''}] fs=${fs}`);
    });

    // count controls
    const buttons = [...document.querySelectorAll('button')].map(b => (b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean);
    const inputs = document.querySelectorAll('input, textarea, select').length;
    const fileInputs = document.querySelectorAll('input[type=file]').length;

    // text content signals for QoL detection
    const bodyText = document.body.innerText.toLowerCase();
    const html = document.body.innerHTML.toLowerCase();

    return {
      vw, overflowX, docW, bodyW,
      wide: wide.slice(0, 8),
      smallTargets: smallTargets.slice(0, 12),
      smallTargetCount: smallTargets.length,
      smallFontInputs: [...new Set(smallFontInputs)].slice(0,5),
      buttons: buttons.slice(0, 25),
      inputCount: inputs,
      fileInputs,
      hasCopy: /copy|клипборд/.test(bodyText) || html.includes('clipboard'),
      hasDownload: bodyText.includes('download') || html.includes('download'),
      hasDragDrop: html.includes('drop') || bodyText.includes('drag') || bodyText.includes('drop'),
      hasPasteHint: bodyText.includes('paste'),
      hasClear: bodyText.includes('clear') || bodyText.includes('reset'),
      mainText: document.body.innerText.slice(0, 600),
    };
  });
}

const results = {};

for (const slug of slugs) {
  const url = `https://${slug}.mrzk.io`;
  const r = { slug, url };
  try {
    // DESKTOP
    const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pD = await ctxD.newPage();
    const errs = [];
    pD.on('pageerror', e => errs.push(e.message));
    pD.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,120)); });
    await pD.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e=>r.gotoErr=e.message);
    await pD.waitForTimeout(1200);
    r.desktop = await probe(pD);
    r.desktopErrors = errs.slice(0,6);
    // detect localStorage usage
    r.localStorage = await pD.evaluate(() => { try { return Object.keys(localStorage); } catch { return []; } });
    await ctxD.close();

    // MOBILE
    const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
    const pM = await ctxM.newPage();
    await pM.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{});
    await pM.waitForTimeout(1200);
    r.mobile = await probe(pM);
    await pM.screenshot({ path: `${SHOTS}/ux-${slug}-mobile.png`, fullPage: true }).catch(e=>r.shotErr=e.message);
    await ctxM.close();

    console.log(`\n===== ${slug} =====`);
    console.log('DESKTOP buttons:', JSON.stringify(r.desktop.buttons));
    console.log('DESKTOP inputs:', r.desktop.inputCount, 'file:', r.desktop.fileInputs, 'errors:', JSON.stringify(r.desktopErrors));
    console.log('QoL signals:', JSON.stringify({copy:r.desktop.hasCopy, dl:r.desktop.hasDownload, dragdrop:r.desktop.hasDragDrop, paste:r.desktop.hasPasteHint, clear:r.desktop.hasClear, localStorage:r.localStorage}));
    console.log('MOBILE overflowX:', r.mobile.overflowX, 'docW:', r.mobile.docW);
    console.log('MOBILE wide elems:', JSON.stringify(r.mobile.wide));
    console.log('MOBILE small targets ('+r.mobile.smallTargetCount+'):', JSON.stringify(r.mobile.smallTargets));
    console.log('MOBILE small-font inputs (iOS zoom):', JSON.stringify(r.mobile.smallFontInputs));
    console.log('MOBILE text head:', JSON.stringify(r.mobile.mainText.slice(0,300)));
  } catch (e) {
    r.fatal = e.message;
    console.log(`\n===== ${slug} ===== FATAL: ${e.message}`);
  }
  results[slug] = r;
}

await browser.close();
import { writeFileSync } from 'fs';
writeFileSync(`${SHOTS}/ux-audit-raw.json`, JSON.stringify(results, null, 2));
console.log('\n\nDONE. Raw written to ux-audit-raw.json');
