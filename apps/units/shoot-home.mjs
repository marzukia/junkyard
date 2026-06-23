import { chromium } from 'playwright';

const URL = 'https://mrzk.io/';
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
  await page.waitForTimeout(1200);
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
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const htmlBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log(`${name}: bodyBg=${bg} htmlBg=${htmlBg} darkClass=${hasDark}`);

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await browser.close();
}

await shoot('blog-home-light-desktop', { width: 1440, height: 900, dark: false });
await shoot('blog-home-dark-desktop', { width: 1440, height: 900, dark: true });
await shoot('blog-home-light-mobile', { width: 390, height: 844, dark: false });
await shoot('blog-home-dark-mobile', { width: 390, height: 844, dark: true });
console.log('done');
