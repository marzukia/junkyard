import { chromium } from 'playwright';

const URL = 'https://mrzk.io/tags/';
const OUT = '/home/planky/projects/_fleet/shots';

async function shoot(name, { width, height, dark }) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: dark ? 'dark' : 'light',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

  if (dark) {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    });
  } else {
    await page.evaluate(() => {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    });
  }
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 600);
        y += 600;
        if (y > document.body.scrollHeight) { clearInterval(t); res(); }
      }, 50);
    });
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const htmlBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log(`${name}: bodyBg=${bg} htmlBg=${htmlBg} darkClass=${hasDark}`);

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await browser.close();
}

// DOM + computed-style dump for analysis (light desktop)
async function inspect() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);

  const data = await page.evaluate(() => {
    const out = {};
    // page title / heading
    const h1 = document.querySelector('h1, h2');
    out.heading = h1 ? { tag: h1.tagName, text: h1.textContent.trim(), fontSize: getComputedStyle(h1).fontSize } : null;
    // find tag links — Congo taxonomy terms
    const main = document.querySelector('main') || document.body;
    out.mainHTML = main.innerHTML.slice(0, 4000);
    // collect anchors that point to /tags/
    const links = [...document.querySelectorAll('a[href*="/tags/"]')].filter(a => a.getAttribute('href') !== '/tags/');
    out.tagCount = links.length;
    out.tagSamples = links.slice(0, 8).map(a => {
      const cs = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      return {
        text: a.textContent.trim().replace(/\s+/g, ' '),
        href: a.getAttribute('href'),
        fontSize: cs.fontSize,
        color: cs.color,
        bg: cs.backgroundColor,
        padding: cs.padding,
        border: cs.border,
        borderRadius: cs.borderRadius,
        display: cs.display,
        w: Math.round(r.width), h: Math.round(r.height),
        classes: a.className,
      };
    });
    // container of the tags
    const firstTag = links[0];
    if (firstTag) {
      const parent = firstTag.parentElement;
      const pcs = getComputedStyle(parent);
      out.container = { tag: parent.tagName, classes: parent.className, display: pcs.display, gap: pcs.gap, flexWrap: pcs.flexWrap };
    }
    out.bodyFont = getComputedStyle(document.body).fontFamily;
    return out;
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

await shoot('blog-topics-light-desktop', { width: 1440, height: 900, dark: false });
await shoot('blog-topics-dark-desktop', { width: 1440, height: 900, dark: true });
await shoot('blog-topics-light-mobile', { width: 390, height: 844, dark: false });
await shoot('blog-topics-dark-mobile', { width: 390, height: 844, dark: true });
await inspect();
console.log('done');
