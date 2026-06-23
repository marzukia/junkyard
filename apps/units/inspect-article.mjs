import { chromium } from 'playwright';
const URL = 'https://mrzk.io/posts/did-covid19-make-trump-president/';

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1440,height:900}, colorScheme:'light' })).newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

const data = await page.evaluate(() => {
  const out = {};
  const article = document.querySelector('article') || document.querySelector('main');
  // find the prose container - first <p> with substantial text
  const p = [...document.querySelectorAll('p')].find(el => el.innerText.trim().length > 120);
  if (p) {
    const cs = getComputedStyle(p);
    const rect = p.getBoundingClientRect();
    out.bodyP = { font: cs.fontFamily, size: cs.fontSize, lh: cs.lineHeight, color: cs.color, widthPx: Math.round(rect.width) };
    // measure CPL
    const txt = p.innerText.replace(/\s+/g,' ').trim();
    out.bodyP.sampleLen = txt.length;
  }
  // content container width
  const container = p ? p.parentElement : null;
  if (container) {
    const cs = getComputedStyle(container);
    out.container = { maxWidth: cs.maxWidth, widthPx: Math.round(container.getBoundingClientRect().width), cls: container.className };
  }
  // headings
  out.headings = [...document.querySelectorAll('article h1,article h2,article h3, main h1, main h2, main h3, .prose h1,.prose h2,.prose h3')].slice(0,8).map(h => {
    const cs = getComputedStyle(h);
    return { tag: h.tagName, size: cs.fontSize, weight: cs.fontWeight, color: cs.color, mt: cs.marginTop, text: h.innerText.slice(0,40) };
  });
  // links in prose
  const link = document.querySelector('article a, main a, .prose a');
  if (link) { const cs = getComputedStyle(link); out.link = { color: cs.color, decoration: cs.textDecorationLine, weight: cs.fontWeight }; }
  // code blocks
  const pre = document.querySelector('pre');
  if (pre) { const cs = getComputedStyle(pre); out.pre = { bg: cs.backgroundColor, color: cs.color, padding: cs.padding, overflow: cs.overflowX, font: cs.fontFamily, size: cs.fontSize }; }
  const codeInline = [...document.querySelectorAll('p code, li code')][0];
  if (codeInline) { const cs = getComputedStyle(codeInline); out.inlineCode = { bg: cs.backgroundColor, color: cs.color }; }
  // blockquote
  const bq = document.querySelector('blockquote');
  if (bq) { const cs = getComputedStyle(bq); out.blockquote = { borderLeft: cs.borderLeft, color: cs.color, bg: cs.backgroundColor, fontStyle: cs.fontStyle }; }
  // table
  const tbl = document.querySelector('table');
  if (tbl) { const cs = getComputedStyle(tbl); out.table = { widthPx: Math.round(tbl.getBoundingClientRect().width), overflow: getComputedStyle(tbl.parentElement).overflowX }; }
  // images / svg charts
  out.media = [...document.querySelectorAll('article img, main img, .prose img, article svg, main svg')].slice(0,15).map(m => {
    const r = m.getBoundingClientRect();
    return { tag: m.tagName, w: Math.round(r.width), h: Math.round(r.height), src: (m.getAttribute('src')||'').slice(-40), alt: m.getAttribute('alt')||'', bg: getComputedStyle(m).backgroundColor };
  });
  // figcaption
  const cap = document.querySelector('figcaption');
  if (cap) { const cs = getComputedStyle(cap); out.caption = { size: cs.fontSize, color: cs.color, align: cs.textAlign }; }
  // TOC
  out.hasTOC = !!document.querySelector('.toc, #TableOfContents, nav[aria-label*="contents" i]');
  // meta/header
  const h1 = document.querySelector('h1');
  if (h1) { const cs = getComputedStyle(h1); out.title = { size: cs.fontSize, weight: cs.fontWeight, lh: cs.lineHeight, text: h1.innerText.slice(0,60) }; }
  return out;
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
