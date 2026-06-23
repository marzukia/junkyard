import { chromium } from 'playwright';

const slugs = process.argv.slice(2);
const browser = await chromium.launch();
for (const slug of slugs) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0,200)); });
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0,200)));
  try {
    await page.goto(`https://${slug}.mrzk.io`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const txt = (el) => (el?.textContent || '').trim().slice(0, 40);
      const buttons = [...document.querySelectorAll('button')].map(b => txt(b)).filter(Boolean);
      const tabs = [...document.querySelectorAll('[role=tab],[role=tablist] *')].map(t => txt(t)).filter(Boolean);
      const inputs = [...document.querySelectorAll('input,textarea,select')].map(i => `${i.tagName}[${i.type||''}]${i.placeholder?':'+i.placeholder.slice(0,30):''}`);
      const headings = [...document.querySelectorAll('h1,h2,h3')].map(h => txt(h)).filter(Boolean);
      const labels = [...document.querySelectorAll('label')].map(l=>txt(l)).filter(Boolean);
      return { title: document.title, headings, buttons: [...new Set(buttons)], tabs: [...new Set(tabs)], inputs, labels: [...new Set(labels)] };
    });
    console.log(`\n===== ${slug} =====`);
    console.log(JSON.stringify(info, null, 1));
    if (errors.length) console.log('CONSOLE ERRORS:', errors);
  } catch (e) {
    console.log(`\n===== ${slug} ERROR: ${e.message} =====`);
  }
  await ctx.close();
}
await browser.close();
