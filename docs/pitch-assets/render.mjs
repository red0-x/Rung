import { chromium } from '/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/Users/jadonli/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await p.goto('file://' + process.cwd() + '/call.html');
for (let i = 0; i < 19; i++) {
  await p.evaluate((s) => window.setT(s), 134 + i);
  await p.screenshot({ path: `f${String(i).padStart(2, '0')}.png` });
}
await b.close();
