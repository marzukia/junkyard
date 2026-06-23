import { chromium } from 'playwright';

// Check paste support + result UI affordances by inspecting JS event listeners / DOM after a fake result.
// We can't easily run the 600MB models, so: detect (a) paste handlers on document/dropzone,
// (b) whether there's a copy/download button anywhere in the bundle text for output stage.
async function inspect(slug) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1440,height:900}});
  const p = await ctx.newPage();
  const out = { slug };
  try {
    await p.goto(`https://${slug}.mrzk.io`, {waitUntil:'networkidle', timeout:45000});
    await p.waitForTimeout(800);
    // grab all script bundle text to grep for output affordances + paste
    const bundle = await p.evaluate(async () => {
      const srcs = [...document.querySelectorAll('script[src]')].map(s=>s.src);
      let all = '';
      for (const s of srcs) {
        try { all += await (await fetch(s)).text(); } catch(e){}
      }
      return all;
    });
    const has = (re) => re.test(bundle);
    out.pasteHandler = has(/['"]paste['"]|onpaste|addEventListener\(\s*['"]paste/i);
    out.clipboardWrite = has(/clipboard\.write|writeText|execCommand\(\s*['"]copy/i);
    out.downloadAnchor = has(/download\s*=|\.download|createObjectURL/i);
    out.copyWord = has(/['"]Copy['"]|Copied/i);
    out.clearWord = has(/['"]Clear['"]|['"]Reset['"]|['"]New ?(image|file|chat)['"]/i);
    out.progressWord = has(/progress|loading|downloading|%/i);
    out.dragDrop = has(/['"]drop['"]|ondrop|dragover/i);
    out.bundleLen = bundle.length;
  } catch(e){ out.err = e.message; }
  await browser.close();
  console.log(JSON.stringify(out));
}

for (const s of process.argv.slice(2)) await inspect(s);
