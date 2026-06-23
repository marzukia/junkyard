// Playwright dogfood test for SVG Optimizer
// Serves the built dist locally and exercises the core feature.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const pw_pkg = await import(
  "/home/planky/projects/_fleet/tool-units/node_modules/playwright/index.js"
);
const { chromium } = pw_pkg.default ?? pw_pkg;

const DIST = fileURLToPath(new URL("./dist", import.meta.url));
const SHOT = "/home/planky/projects/_fleet/shots/mt-svg.png";

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".json": "application/json",
};

// Minimal static file server for the dist
const server = createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  let filePath = join(DIST, urlPath);
  if (!existsSync(filePath)) filePath = join(DIST, "index.html"); // SPA fallback

  try {
    const data = readFileSync(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

await new Promise((resolve) => server.listen(7891, "127.0.0.1", resolve));
console.log("Server running at http://127.0.0.1:7891/");

const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Adobe Illustrator -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  version="1.1" x="0px" y="0px" viewBox="0 0 100 100">
  <title>Sample icon</title>
  <desc>A test SVG for dogfooding</desc>
  <g id="Layer_1" data-name="Layer 1">
    <g><g>
      <circle cx="50.0000" cy="50.0000" r="40.0000" fill="#2f9d8d"/>
      <rect x="20.00" y="20.00" width="60.000" height="60.000" fill="none" stroke="#e8b04b" stroke-width="2.5000"/>
    </g></g>
  </g>
</svg>`;

const result = {
  url: "http://127.0.0.1:7891/",
  title: "",
  mounted: false,
  h1Found: false,
  interactionWorked: false,
  optimizedOutput: "",
  savingText: "",
  consoleErrors: [],
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

page.on("console", (msg) => {
  // Ignore the Umami 400 (placeholder __UMAMI_ID__ not yet injected)
  if (msg.type() === "error" && !msg.text().includes("400")) {
    result.consoleErrors.push(msg.text());
  }
});
page.on("pageerror", (err) => {
  result.consoleErrors.push(String(err?.message ?? err));
});

try {
  await page.goto(result.url, { waitUntil: "networkidle", timeout: 30000 });
  result.title = await page.title();
  result.mounted = result.title.includes("SVG Optimizer");

  // Check h1
  const h1 = await page.locator("h1").first().textContent();
  result.h1Found = (h1 ?? "").includes("SVG Optimizer");

  // Paste SVG into the textarea
  const textarea = await page.locator('textarea[aria-label="SVG input"]');
  await textarea.fill(SAMPLE_SVG);

  // Wait for output to appear
  await page.waitForSelector('.svg-saving-badge', { timeout: 5000 });

  // Read the saving badge
  result.savingText = await page.locator('.svg-saving-badge').first().textContent() ?? "";

  // Check optimized output textarea has content
  const outputTA = await page.locator('textarea[aria-label="Optimized SVG output"]');
  result.optimizedOutput = await outputTA.inputValue();
  result.interactionWorked =
    result.optimizedOutput.length > 0 &&
    result.optimizedOutput.includes("<svg") &&
    result.optimizedOutput.length < SAMPLE_SVG.length;

  await page.screenshot({ path: SHOT, fullPage: true });
  console.log("Screenshot saved to", SHOT);
} catch (err) {
  result.consoleErrors.push("Test error: " + String(err?.message ?? err));
} finally {
  await browser.close();
  server.close();
}

console.log("\n=== Dogfood result ===");
console.log(JSON.stringify(result, null, 2));

const passed =
  result.mounted &&
  result.h1Found &&
  result.interactionWorked &&
  result.consoleErrors.length === 0;

console.log("\n" + (passed ? "PASS" : "FAIL"));
process.exit(passed ? 0 : 1);
