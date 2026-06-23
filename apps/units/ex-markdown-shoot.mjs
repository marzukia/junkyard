import pw from '/home/planky/.bun/install/global/node_modules/playwright/index.js';
const { chromium } = pw;

const URL = 'https://markdown.mrzk.io/';
const SHOT = '/home/planky/projects/_fleet/shots/ex-markdown.png';
const MD = '# mrzk.io\n\n**18 free tools**, all in your browser.\n\n- no upload\n- no account\n\n`uv add charted`';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/planky/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell',
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const notes = [];

try {
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForSelector('textarea', { timeout: 20000 });
  await p.waitForTimeout(800);

  const ta = p.locator('textarea').first();
  await ta.click();
  await ta.fill('');
  await ta.fill(MD);
  notes.push('typed markdown');
  await p.waitForTimeout(1500);

  // verify preview rendered
  const preview = await p.evaluate(() => {
    const h1 = Array.from(document.querySelectorAll('h1')).find(h => /mrzk\.io/i.test(h.textContent || ''));
    const code = Array.from(document.querySelectorAll('code')).find(c => /uv add charted/i.test(c.textContent || ''));
    const lis = Array.from(document.querySelectorAll('li')).map(l => l.textContent.trim());
    return { h1: h1 ? h1.textContent.trim() : null, codeFound: !!code, lis };
  });
  notes.push('preview=' + JSON.stringify(preview));

  // Find the preview pane element to crop to it.
  const handle = await p.evaluateHandle(() => {
    const h1 = Array.from(document.querySelectorAll('h1')).find(h => /mrzk\.io/i.test(h.textContent || ''));
    if (!h1) return null;
    // climb to a reasonable container (the rendered preview pane)
    let el = h1;
    for (let i = 0; i < 6 && el.parentElement; i++) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.height > 200 && r.width > 250) { el = el.parentElement; }
      else el = el.parentElement;
    }
    return el;
  });

  let element = handle.asElement ? handle.asElement() : null;
  if (element) {
    await element.screenshot({ path: SHOT });
    notes.push('cropped element screenshot');
  } else {
    await p.screenshot({ path: SHOT, fullPage: false });
    notes.push('full viewport fallback');
  }

  console.log('OK ' + notes.join(' | '));
} catch (e) {
  notes.push('EXCEPTION: ' + (e.message || String(e)));
  try { await p.screenshot({ path: SHOT, fullPage: false }); } catch {}
  console.log('ERR ' + notes.join(' | '));
}

await browser.close();
