import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('https://diff.mrzk.io/', { waitUntil: 'domcontentloaded', timeout: 40000 });
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const tas = [...document.querySelectorAll('textarea')].map((t,i)=>({i,ph:t.placeholder,cls:t.className,id:t.id}));
  const editors = [...document.querySelectorAll('[contenteditable], .cm-editor, .monaco-editor, .CodeMirror')].map(e=>({tag:e.tagName,cls:e.className.slice(0,60)}));
  const btns = [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean);
  return { tas, editors, btns, title: document.title, bodyText: document.body.innerText.slice(0,400) };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
