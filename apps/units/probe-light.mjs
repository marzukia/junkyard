// Deep probe for the model-free tools: lorem, svg, gif — full exercise.
import { chromium, devices } from 'playwright';
const iphone = devices['iPhone 13'];

const sampleSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><!--c--><metadata>x</metadata><g><rect x="10" y="10" width="100" height="100" fill="#3366cc"/><circle cx="60" cy="60" r="30" fill="#ffffff"/></g></svg>';

const browser = await chromium.launch();

async function probe(slug, viewport, fn) {
  const ctx = await browser.newContext(viewport);
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,120)); });
  p.on('pageerror', e => errs.push('PAGEERR:'+e.message.slice(0,120)));
  await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});
  try {
    await p.goto(`https://${slug}.mrzk.io`, {waitUntil:'networkidle', timeout:30000});
    await p.waitForTimeout(900);
    await fn(p);
  } catch(e){ console.log(`  ${slug} ERR: ${e.message.slice(0,140)}`); }
  if (errs.length) console.log(`  ${slug} CONSOLE-ERR:`, JSON.stringify([...new Set(errs)].slice(0,4)));
  await ctx.close();
}

const DT = {viewport:{width:1440,height:900}};

// ---------- LOREM ----------
console.log('\n========== LOREM (desktop) ==========');
await probe('lorem', DT, async p => {
  const out0 = await p.locator('textarea').first().inputValue();
  console.log('  prefilled out len:', out0.length, 'startsLorem:', /lorem ipsum/i.test(out0));
  // switch type to Words
  await p.getByRole('button',{name:/^Words$/}).click().catch(()=>{});
  await p.waitForTimeout(300);
  // style Hipster
  await p.getByRole('button',{name:/^Hipster$/}).click().catch(()=>{});
  await p.waitForTimeout(300);
  const out1 = await p.locator('textarea').first().inputValue();
  console.log('  after Words+Hipster len:', out1.length, 'changed:', out1!==out0);
  // copy toast
  const copyBtn = p.getByRole('button',{name:/^Copy$/}).first();
  const before = await copyBtn.innerText();
  await copyBtn.click().catch(()=>{});
  await p.waitForTimeout(500);
  const after = await copyBtn.innerText();
  const clip = await p.evaluate(()=>navigator.clipboard.readText().catch(()=>'')).catch(()=>'');
  console.log('  copy: btnChanged=', before!==after, `("${after.slice(0,20)}")`, 'clipLen=', clip.length);
  // copy HTML
  const ch = p.getByRole('button',{name:/Copy HTML/i});
  if (await ch.count()) { await ch.click().catch(()=>{}); await p.waitForTimeout(300); const clip2 = await p.evaluate(()=>navigator.clipboard.readText().catch(()=>'')).catch(()=>''); console.log('  copyHTML clip hasTag:', /<p>/.test(clip2)); }
  // Cmd+Enter regenerate
  await p.locator('body').click();
  await p.keyboard.press('Control+Enter');
  await p.waitForTimeout(400);
  const out2 = await p.locator('textarea').first().inputValue();
  console.log('  CmdEnter regenerated:', out2!==out1);
  // settings persistence: reload, check type still Words
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(800);
  const txt = await p.evaluate(()=>document.body.innerText);
  const ls = await p.evaluate(()=>Object.keys(localStorage));
  console.log('  after reload ls keys:', JSON.stringify(ls));
  // Placeholder images tab
  await p.getByRole('tab',{name:/Placeholder/i}).click().catch(async()=>{ await p.getByText('Placeholder Images').click().catch(()=>{}); });
  await p.waitForTimeout(600);
  const imgs = await p.locator('img').count();
  const phTxt = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,200));
  console.log('  placeholder tab imgs:', imgs, '| txt:', phTxt.slice(0,120));
});

// ---------- SVG ----------
console.log('\n========== SVG (desktop) ==========');
await probe('svg', DT, async p => {
  await p.locator('textarea').first().fill(sampleSVG);
  await p.waitForTimeout(1500);
  const txt = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  const savings = (txt.match(/-?\d+(\.\d+)?\s*%|saved|smaller|[\d.]+\s*(kb|bytes)/i)||['none'])[0];
  const buttons = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean));
  console.log('  savings indicator:', savings);
  console.log('  buttons after input:', JSON.stringify(buttons));
  // toggle a setting (Remove comments) and check re-optimize
  const copyBtn = p.getByRole('button',{name:/^copy/i}).first();
  if (await copyBtn.count()){ const b=await copyBtn.innerText(); await copyBtn.click().catch(()=>{}); await p.waitForTimeout(400); const a=await copyBtn.innerText(); const clip=await p.evaluate(()=>navigator.clipboard.readText().catch(()=>'')).catch(()=>''); console.log('  copy changed:', b!==a, '| clip is svg:', /<svg/.test(clip), 'len', clip.length); }
  // download button present?
  console.log('  hasDownload:', /download/i.test(txt));
  // GARBAGE input
  await p.locator('textarea').first().fill('this is not <svg at all { ]] garbage');
  await p.waitForTimeout(1000);
  const errTxt = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  console.log('  garbage handling:', (errTxt.match(/error|invalid|not valid|could ?n.t|fail/i)||['NO-ERROR-MSG'])[0]);
  // precision slider
  const prec = await p.locator('input[type=range],[role=slider]').count();
  console.log('  precision control count:', prec);
});

// ---------- GIF ----------
console.log('\n========== GIF (desktop) ==========');
await probe('gif', DT, async p => {
  const txt = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,400));
  console.log('  initial:', txt.slice(0,260));
  // make two tiny PNGs and upload
  const mk = (color)=>`data:image/png`;
  const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
  const png2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC','base64');
  const fi = p.locator('input[type=file]').first();
  await fi.setInputFiles([
    {name:'a.png', mimeType:'image/png', buffer:png1},
    {name:'b.png', mimeType:'image/png', buffer:png2},
  ]);
  await p.waitForTimeout(2500);
  const txt2 = await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  const buttons = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).slice(0,30));
  console.log('  after upload buttons:', JSON.stringify(buttons));
  console.log('  has frames/render UI:', /frame|render|generate|create gif|download/i.test(txt2));
  // try render
  const renderBtn = p.getByRole('button',{name:/render|create|generate|make gif|export/i}).first();
  if (await renderBtn.count()){ await renderBtn.click().catch(()=>{}); await p.waitForTimeout(4000); const t3=await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ')); const hasImg = await p.locator('img[src^="blob:"],img[src^="data:image/gif"]').count(); console.log('  after render hasGifImg:', hasImg, '| download avail:', /download/i.test(t3)); }
  else console.log('  NO render button found');
});

await browser.close();
