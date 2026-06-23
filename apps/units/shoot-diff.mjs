import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await p.goto('https://diff.mrzk.io/', { waitUntil: 'domcontentloaded', timeout: 40000 });
await p.waitForSelector('#diff-left', { timeout: 20000 });
await p.waitForTimeout(800);
try { await p.click('button:has-text("Light")', { timeout: 3000 }); } catch {}
await p.waitForTimeout(300);

await p.fill('#diff-left', 'the quick brown fox\njumps over\nthe lazy dog\nline four');
await p.fill('#diff-right', 'the quick red fox\njumps over\nthe sleepy dog\nline four');
await p.dispatchEvent('#diff-left', 'input');
await p.dispatchEvent('#diff-right', 'input');
await p.waitForTimeout(1500);

const card = await p.$('.diff-output-card');
await card.screenshot({ path: '/home/planky/projects/_fleet/shots/ex-diff.png' });
console.log('saved');
await b.close();
