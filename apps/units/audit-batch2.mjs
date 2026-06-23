import { chromium } from 'playwright';

const SLUGS = ['json', 'diff', 'markdown', 'base64', 'regex', 'css', 'csv', 'timestamp', 'uuid', 'hash', 'jwt'];
const SHOTDIR = '/home/planky/projects/_fleet/shots';

const browser = await chromium.launch({ headless: true });

function inspectScript() {
  // Runs in page context. Returns a structural snapshot.
  const vw = window.innerWidth;
  const docW = document.documentElement.scrollWidth;
  const bodyW = document.body.scrollWidth;
  const overflow = Math.max(docW, bodyW) - vw;

  // Elements overflowing the viewport horizontally
  const overflowers = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2) {
      overflowers.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.toString) ? el.className.toString().slice(0, 40) : '',
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
  });

  // Interactive elements: tap target sizes + font sizes
  const interactives = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role=button], [tabindex]'));
  const small = [];
  interactives.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    const label = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.title || el.tagName).toString().trim().slice(0, 24);
    if ((r.height < 40 || r.width < 40) && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button')) {
      small.push({ label, w: Math.round(r.width), h: Math.round(r.height) });
    }
  });

  // input font sizes (iOS zoom risk if <16px on text inputs)
  const zoomRisk = [];
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const type = el.type || el.tagName.toLowerCase();
    if (fs < 16 && el.tagName !== 'SELECT' && type !== 'checkbox' && type !== 'radio' && type !== 'range' && type !== 'submit' && type !== 'button') {
      zoomRisk.push({ type, fs });
    }
  });

  // Tiny text generally
  let tinyText = 0;
  document.querySelectorAll('p, span, label, td, th, li, div').forEach((el) => {
    if (el.children.length > 0) return;
    const t = (el.innerText || '').trim();
    if (!t) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) tinyText++;
  });

  // QoL feature presence (heuristic text scan)
  const allText = document.body.innerText.toLowerCase();
  const btns = Array.from(document.querySelectorAll('button, a, [role=button]')).map((b) => (b.innerText || b.getAttribute('aria-label') || b.title || '').toLowerCase().trim());
  const btnText = btns.join(' | ');
  const has = (re) => re.test(btnText) || re.test(allText);

  return {
    vw, overflow: Math.round(overflow),
    overflowers: overflowers.slice(0, 12),
    smallTargets: small.slice(0, 15),
    smallTargetCount: small.length,
    zoomRisk,
    tinyText,
    counts: {
      buttons: document.querySelectorAll('button').length,
      inputs: document.querySelectorAll('input').length,
      textareas: document.querySelectorAll('textarea').length,
      selects: document.querySelectorAll('select').length,
    },
    btns: btns.filter(Boolean).slice(0, 30),
    qol: {
      copy: has(/copy|clipboard/),
      copied: /copied/.test(allText),
      clear: has(/\bclear\b|\breset\b/),
      example: has(/example|sample|try|load.*demo|paste.*example/),
      download: has(/download|save|\.json|\.csv|export/),
      upload: has(/upload|drop|drag|choose file|browse/),
      swap: has(/swap|switch|encode|decode/),
    },
  };
}

const results = {};

for (const slug of SLUGS) {
  const url = `https://${slug}.mrzk.io/`;
  const entry = { slug, url };
  try {
    // ---- DESKTOP ----
    const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const dpage = await dctx.newPage();
    await dpage.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await dpage.waitForTimeout(700);
    entry.title = await dpage.title();
    entry.desktop = await dpage.evaluate(inspectScript);
    // grab placeholders & headings for empty-state read
    entry.meta = await dpage.evaluate(() => {
      const ph = Array.from(document.querySelectorAll('input, textarea')).map((e) => e.placeholder).filter(Boolean).slice(0, 6);
      const h = Array.from(document.querySelectorAll('h1,h2')).map((e) => e.innerText.trim()).filter(Boolean).slice(0, 4);
      const labels = Array.from(document.querySelectorAll('label')).map((e) => e.innerText.trim()).filter(Boolean).slice(0, 10);
      return { placeholders: ph, headings: h, labels };
    });
    await dctx.close();

    // ---- MOBILE ----
    const mctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const mpage = await mctx.newPage();
    await mpage.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await mpage.waitForTimeout(700);
    entry.mobile = await mpage.evaluate(inspectScript);
    await mpage.screenshot({ path: `${SHOTDIR}/ux-${slug}-mobile.png`, fullPage: false });
    await mctx.close();

    console.log(`OK ${slug}`);
  } catch (e) {
    entry.error = e.message;
    console.log(`ERR ${slug}: ${e.message}`);
  }
  results[slug] = entry;
}

await browser.close();
console.log('\n\n===RESULTS_JSON===');
console.log(JSON.stringify(results));
