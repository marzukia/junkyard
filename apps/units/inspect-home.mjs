import { chromium } from 'playwright';
const URL = 'https://mrzk.io/';
const OUT = '/home/planky/projects/_fleet/shots';

const browser = await chromium.launch();

// Desktop light: crop header + hero
for (const [name, dark, w, h] of [['hdr-light-desk', false, 1440, 900], ['hdr-dark-desk', true, 1440, 900], ['hdr-light-mob', false, 390, 844], ['hdr-dark-mob', true, 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate((d) => { document.documentElement.classList.toggle('dark', d); document.documentElement.classList.toggle('light', !d); }, dark);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, 360) } });

  // measure
  const info = await page.evaluate(() => {
    const out = {};
    const body = getComputedStyle(document.body);
    out.bodyFont = body.fontFamily;
    out.bodyColor = body.color;
    out.bodyBg = body.backgroundColor;
    const h2 = document.querySelector('article h2, .recent h2, main h2');
    // find first post title link
    const links = [...document.querySelectorAll('a')].filter(a => a.offsetHeight > 0);
    const title = [...document.querySelectorAll('h2, h3')].find(e => e.textContent.includes('Charted'));
    if (title) { const ts = getComputedStyle(title); out.titleFont = ts.fontFamily; out.titleSize = ts.fontSize; out.titleWeight = ts.fontWeight; out.titleLH = ts.lineHeight; out.titleColor = ts.color; }
    const name = [...document.querySelectorAll('h1,h2,h3')].find(e => e.textContent.trim() === 'Andryo Marzuki');
    if (name) { const ns = getComputedStyle(name); out.nameSize = ns.fontSize; out.nameFont = ns.fontFamily; out.nameWeight = ns.fontWeight; out.nameColor = ns.color; }
    // body paragraph measure
    const p = [...document.querySelectorAll('p')].find(e => e.textContent.length > 100);
    if (p) { const ps = getComputedStyle(p); out.pSize = ps.fontSize; out.pLH = ps.lineHeight; out.pColor = ps.color; out.pWidth = p.getBoundingClientRect().width; out.pChars = Math.round(p.getBoundingClientRect().width / (parseFloat(ps.fontSize) * 0.5)); }
    // nav links
    const nav = document.querySelector('header nav, nav, header');
    if (nav) { out.navText = nav.innerText.replace(/\n/g,' | ').slice(0,200); }
    // icon colors
    const icons = [...document.querySelectorAll('header svg, nav svg')].slice(0,6).map(s => { const c = getComputedStyle(s); return { fill: c.fill, color: c.color, stroke: c.stroke }; });
    out.icons = icons;
    // brand mark
    const brand = document.querySelector('header a[href="/"], header .logo, header img, .logo');
    out.brandText = brand ? brand.innerText || brand.outerHTML.slice(0,120) : 'none';
    // footer
    const footer = document.querySelector('footer');
    if (footer) { out.footerText = footer.innerText.replace(/\n/g,' | '); out.footerColor = getComputedStyle(footer).color; }
    // tap target sizes mobile
    out.navLinkSizes = [...document.querySelectorAll('header nav a, header a')].map(a=>{const r=a.getBoundingClientRect(); return `${a.textContent.trim().slice(0,10)}:${Math.round(r.width)}x${Math.round(r.height)}`;}).slice(0,12);
    out.scrollW = document.documentElement.scrollWidth;
    out.clientW = document.documentElement.clientWidth;
    return out;
  });
  console.log(`\n=== ${name} (${w}x${h} dark=${dark}) ===`);
  console.log(JSON.stringify(info, null, 1));
  await ctx.close();
}
await browser.close();
