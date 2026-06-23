import { chromium } from 'playwright';

const URL = 'https://mrzk.io/posts/did-covid19-make-trump-president/';
const OUT = '/home/planky/projects/_fleet/shots';

async function settle(page) {
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 800);
        y += 800;
        if (y > document.body.scrollHeight + 2000) { clearInterval(t); res(); }
      }, 50);
    });
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

async function applyMode(page, dark) {
  await page.evaluate((isDark) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, dark);
  await page.waitForTimeout(500);
}

async function bgColor(page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function shoot(name, { width, height, dark }) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: dark ? 'dark' : 'light',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await applyMode(page, dark);
  await settle(page);
  await applyMode(page, dark); // re-assert after scroll
  const bg = await bgColor(page);
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
  console.log(`${name}  bg=${bg}  scrollH=${await page.evaluate(()=>document.body.scrollHeight)}`);

  // capture chart/image regions (non-fullpage) for desktop runs
  if (width >= 1000) {
    const imgs = await page.$$('article img, article svg, .prose img, .prose svg, main img, main svg, figure');
    let idx = 0;
    for (const el of imgs.slice(0, 12)) {
      try {
        const box = await el.boundingBox();
        if (!box || box.width < 120 || box.height < 60) continue;
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const tag = await el.evaluate(n => (n.tagName + (n.getAttribute('alt')||n.getAttribute('aria-label')||'')).slice(0,20).replace(/[^a-z0-9]/gi,'_'));
        await el.screenshot({ path: `${OUT}/chart-${dark?'dark':'light'}-${idx}-${tag}.png` });
        idx++;
      } catch (e) { /* skip */ }
    }
    console.log(`  captured ${idx} chart/image regions`);
  }
  await browser.close();
}

await shoot('blog-article-light-desktop.png', { width: 1440, height: 900, dark: false });
await shoot('blog-article-dark-desktop.png',  { width: 1440, height: 900, dark: true });
await shoot('blog-article-light-mobile.png',  { width: 390,  height: 844, dark: false });
await shoot('blog-article-dark-mobile.png',   { width: 390,  height: 844, dark: true });
console.log('DONE');
