/**
 * Debug — open URL có flowName=WebLiteSignIn xem Google redirect đi đâu.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { GemLoginService } from '../modules/gemlogin/gemlogin.service';

async function main() {
  const profileId = process.env.GEMLOGIN_PROFILE_ID || '1';
  let cdpUrl: string;
  try {
    const res = await GemLoginService.startProfile(profileId);
    cdpUrl = res.cdpUrl;
  } catch (err: any) {
    console.error(`[Debug] startProfile lỗi (có thể đã chạy sẵn): ${err.message}`);
    cdpUrl = process.env.CHROME_CDP_URL || 'http://localhost:9222';
  }

  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] || await browser.newContext();

  // Liệt kê các tab đang mở
  const allPages = context.pages();
  console.log(`[Debug] Browser đang có ${allPages.length} tab mở:`);
  for (const p of allPages) {
    console.log(`  - ${p.url()}`);
  }

  // Stealth: inject TRƯỚC mọi script của trang để Google không detect automation
  await context.addInitScript(() => {
    // 1) navigator.webdriver = undefined (Playwright set true mặc định)
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => undefined });

    // 2) Plugins giả (Chrome thật có Chrome PDF Plugin, Native Client, ...)
    const fakePlugins = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ];
    Object.defineProperty(Navigator.prototype, 'plugins', {
      get: () => Object.assign(fakePlugins, { length: fakePlugins.length, item: (i: number) => fakePlugins[i], namedItem: () => null, refresh: () => {} }),
    });

    // 3) Languages giống browser tay tiếng Việt
    Object.defineProperty(Navigator.prototype, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });

    // 4) chrome.runtime tồn tại (Playwright ko set)
    if (!(window as any).chrome) (window as any).chrome = {};
    if (!(window as any).chrome.runtime) (window as any).chrome.runtime = {};

    // 5) Permissions API patch — Notification permission "default" không phải "denied"
    const origQuery = (window as any).navigator.permissions?.query;
    if (origQuery) {
      (window as any).navigator.permissions.query = (params: any) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: 'default' } as any)
          : origQuery.call((window as any).navigator.permissions, params);
    }

    // 6) WebGL vendor/renderer giả Chrome thật trên Mac (M1)
    const getParam = (WebGLRenderingContext.prototype as any).getParameter;
    (WebGLRenderingContext.prototype as any).getParameter = function (this: any, parameter: number) {
      if (parameter === 37445) return 'Apple Inc.'; // UNMASKED_VENDOR_WEBGL
      if (parameter === 37446) return 'Apple M1';   // UNMASKED_RENDERER_WEBGL
      return getParam.call(this, parameter);
    };
  });

  // LUÔN tạo tab mới + bring to front để user nhìn thấy script đang thao tác
  console.log('[Debug] Tạo tab mới và đưa lên trên cùng để bạn nhìn');
  const page = await context.newPage();
  await page.bringToFront();
  console.log('[Debug] Đợi 5s để bạn thấy tab trống mới hiện ra trong GemLogin...');
  await page.waitForTimeout(5000);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'logs', 'weblite-debug', ts);
  fs.mkdirSync(outDir, { recursive: true });

  // Track redirects
  const redirects: { from: string; to: string; status: number }[] = [];
  page.on('response', (res) => {
    if (res.status() >= 300 && res.status() < 400) {
      const loc = res.headers()['location'];
      if (loc) redirects.push({ from: res.url(), to: loc, status: res.status() });
    }
  });

  const url = 'https://mail.google.com/';
  console.log(`[Debug] >>> Goto ${url} — bạn để ý xem GemLogin tab có chuyển không`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
    console.warn(`[Debug] Goto warn: ${e.message}`);
  });
  console.log(`[Debug] >>> Đã navigate, current URL: ${page.url()}`);
  console.log('[Debug] Đợi 8s để bạn nhìn rõ trang nào hiện ra...');
  await page.waitForTimeout(8000);

  const finalUrl = page.url();
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const html = await page.content().catch(() => '');

  console.log(`\n=== FINAL URL ===\n${finalUrl}`);
  console.log(`\n=== TEXT (first 600) ===\n${text.substring(0, 600)}`);
  console.log(`\n=== REDIRECT CHAIN ===`);
  for (const r of redirects) {
    console.log(`  [${r.status}] ${r.from}`);
    console.log(`         → ${r.to}`);
  }

  fs.writeFileSync(path.join(outDir, 'final.url.txt'), finalUrl);
  fs.writeFileSync(path.join(outDir, 'final.text.txt'), text);
  fs.writeFileSync(path.join(outDir, 'final.html'), html);
  fs.writeFileSync(path.join(outDir, 'redirects.json'), JSON.stringify(redirects, null, 2));
  await page.screenshot({ path: path.join(outDir, 'final.png'), fullPage: true }).catch(() => {});
  console.log(`\n[Debug] Saved → ${outDir}`);

  await browser.close();
}

main().catch((err) => {
  console.error('[Debug] Fatal:', err);
  process.exit(1);
});
