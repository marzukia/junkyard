import { chromium } from 'playwright';

const URL = 'https://mrzk.io/apps/';
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
  // settle: wait for lazy images
  await page.waitForTimeout(1500);
  // scroll through to trigger lazy-loading
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 600);
        y += 600;
        if (y > document.body.scrollHeight) { clearInterval(t); res(); }
      }, 60);
    });
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // verify dark actually rendered
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log(`${name}: bodyBg=${bg} darkClass=${hasDark}`);

  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
  await browser.close();
}

await shoot('portfolio-light-desktop', { width: 1440, height: 900, dark: false });
await shoot('portfolio-dark-desktop', { width: 1440, height: 900, dark: true });
await shoot('portfolio-light-mobile', { width: 390, height: 844, dark: false });
await shoot('portfolio-dark-mobile', { width: 390, height: 844, dark: true });
console.log('done');
