import { chromium } from 'playwright';

const URL = 'https://mrzk.io/posts/';
const OUT = '/home/planky/projects/_fleet/shots';

async function run(name, { width, height, dark, action }) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: dark ? 'dark' : 'light',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  if (dark) {
    await page.evaluate(() => { document.documentElement.classList.add('dark'); document.documentElement.classList.remove('light'); });
  }
  await page.waitForTimeout(1000);
  await action(page);
  await browser.close();
}

// 1. Top-of-list crop, light desktop — clip first 2 rows
await run('posts-detail-top-light', { width: 1440, height: 900, dark: false, action: async (page) => {
  await page.screenshot({ path: `${OUT}/posts-detail-top-light.png`, clip: { x: 0, y: 90, width: 1440, height: 560 } });
}});

// 2. Top-of-list crop, dark desktop
await run('posts-detail-top-dark', { width: 1440, height: 900, dark: true, action: async (page) => {
  await page.screenshot({ path: `${OUT}/posts-detail-top-dark.png`, clip: { x: 0, y: 90, width: 1440, height: 560 } });
}});

// 3. Hover over a post link (title), light
await run('posts-detail-hover-light', { width: 1440, height: 900, dark: false, action: async (page) => {
  const link = page.locator('article a, .post a, h2 a, h3 a').first();
  await link.hover();
  await page.waitForTimeout(400);
  // figure out colour of hovered link
  const c = await page.evaluate(() => {
    const els = document.querySelectorAll('a:hover');
    const last = els[els.length-1];
    return last ? getComputedStyle(last).color : 'none';
  });
  console.log('hover link color:', c);
  await page.screenshot({ path: `${OUT}/posts-detail-hover-light.png`, clip: { x: 0, y: 90, width: 1440, height: 320 } });
}});

// 4. Pagination / bottom region. Scroll to bottom.
await run('posts-detail-pagination-light', { width: 1440, height: 900, dark: false, action: async (page) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/posts-detail-pagination-light.png` });
  // dump pagination DOM if present
  const pag = await page.evaluate(() => {
    const p = document.querySelector('nav.pagination, .pagination, [class*=paginat]');
    return p ? p.outerHTML.slice(0,800) : 'NO PAGINATION ELEMENT';
  });
  console.log('PAGINATION:', pag);
}});

// 5. Mobile header crop to inspect nav cramping
await run('posts-detail-header-mobile', { width: 390, height: 844, dark: false, action: async (page) => {
  await page.screenshot({ path: `${OUT}/posts-detail-header-mobile.png`, clip: { x: 0, y: 0, width: 390, height: 200 } });
}});

// 6. Inspect computed styles & structure of one post row
await run('posts-inspect', { width: 1440, height: 900, dark: false, action: async (page) => {
  const data = await page.evaluate(() => {
    const out = {};
    const article = document.querySelector('article') || document.querySelector('[class*=post]');
    out.articleClass = article ? article.className : 'none';
    const title = document.querySelector('article h2, article h3, h2 a, h3 a');
    if (title) {
      const cs = getComputedStyle(title);
      out.title = { tag: title.tagName, fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, lineHeight: cs.lineHeight, fontFamily: cs.fontFamily.slice(0,40) };
    }
    // find a date element
    const time = document.querySelector('time, [class*=date], .meta');
    if (time) { const cs = getComputedStyle(time); out.date = { text: time.textContent.trim().slice(0,40), fontSize: cs.fontSize, color: cs.color, textTransform: cs.textTransform, letterSpacing: cs.letterSpacing }; }
    // summary
    const sum = document.querySelector('article p, .summary, [class*=summary]');
    if (sum) { const cs = getComputedStyle(sum); out.summary = { fontSize: cs.fontSize, color: cs.color, lineHeight: cs.lineHeight, maxWidth: cs.maxWidth }; }
    // main content width
    const main = document.querySelector('main') || document.querySelector('[class*=content]');
    if (main) { const cs = getComputedStyle(main); out.main = { width: main.getBoundingClientRect().width, maxWidth: cs.maxWidth }; }
    // year heading
    const h = [...document.querySelectorAll('h1,h2,h3')].find(e => /^\d{4}$/.test(e.textContent.trim()));
    if (h) { const cs = getComputedStyle(h); out.yearHeading = { tag: h.tagName, fontSize: cs.fontSize, color: cs.color, fontWeight: cs.fontWeight }; }
    return out;
  });
  console.log('INSPECT:', JSON.stringify(data, null, 2));
}});

console.log('done');
