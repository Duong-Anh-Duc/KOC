/**
 * Debug script — chạy live với GemLogin đang bật để khảo sát Google login flow.
 *
 * Cách dùng:
 *   1) Bật GemLogin desktop, start profile (đảm bảo tài khoản Google ĐÃ BỊ LOGOUT
 *      hoặc dùng profile chưa từng login).
 *   2) Đảm bảo GEMLOGIN_API_URL trong .env trỏ đúng GemLogin REST API.
 *   3) Set GOOGLE_EMAIL / GOOGLE_PASSWORD / GOOGLE_TOTP_SECRET trong .env (nếu muốn
 *      test full flow). Có thể chạy chỉ tới step nhập email mà thôi nếu chưa có pass.
 *   4) Chạy:  npm run debug:google-login
 *
 * Script sẽ:
 *   - Discover CDP port của GemLogin (giống GemLoginService.startProfile)
 *   - Kết nối Playwright qua CDP
 *   - Mở https://studio.youtube.com → đợi redirect login
 *   - Dump URL, HTML snippet, screenshot ở MỖI step:
 *       a) Trang nhập email
 *       b) Trang nhập password
 *       c) Trang chọn 2FA method (nếu có "Try another way")
 *       d) Trang nhập TOTP
 *       e) Trang sau khi login OK
 *   - Dump vào ./logs/google-login-debug/<timestamp>/step-*.{html,png,txt}
 *
 * Mục đích: tôi đọc dump → tune selector trong google-login.service.ts cho khớp UI thật.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { chromium, type Page } from 'playwright';
import { GemLoginService } from '../modules/gemlogin/gemlogin.service';

async function fetchTotpFrom2faLive(secret: string): Promise<string | null> {
  try {
    const res = await fetch(`https://2fa.live/tok/${encodeURIComponent(secret)}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { token?: string };
    return data.token && /^\d{6}$/.test(data.token) ? data.token : null;
  } catch { return null; }
}

const STUDIO_URL = 'https://studio.youtube.com';

async function dumpStep(page: Page, outDir: string, stepName: string): Promise<void> {
  const safe = stepName.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
  const url = page.url();
  const html = await page.content().catch(() => '');
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');

  fs.writeFileSync(path.join(outDir, `${safe}.url.txt`), url);
  fs.writeFileSync(path.join(outDir, `${safe}.html`), html);
  fs.writeFileSync(path.join(outDir, `${safe}.text.txt`), text);
  await page.screenshot({ path: path.join(outDir, `${safe}.png`), fullPage: true }).catch(() => {});

  console.log(`\n── [${stepName}] ──`);
  console.log(`URL: ${url}`);
  console.log(`Text snippet (300 chars): ${text.substring(0, 300).replace(/\n+/g, ' | ')}`);
  console.log(`Saved → ${outDir}/${safe}.{url.txt,html,text.txt,png}`);
}

async function listLocators(page: Page, label: string, sels: string[]): Promise<void> {
  console.log(`\n[Locators ${label}]`);
  for (const sel of sels) {
    const count = await page.locator(sel).count().catch(() => 0);
    console.log(`  ${count > 0 ? '✓' : '✗'}  count=${count}  ${sel}`);
  }
}

async function main() {
  // 1. Start GemLogin profile (hoặc reuse nếu đã chạy)
  const profileId = process.env.GEMLOGIN_PROFILE_ID || '1';
  console.log(`[Debug] Start GemLogin profile ${profileId}...`);
  let cdpUrl: string;
  try {
    const res = await GemLoginService.startProfile(profileId);
    cdpUrl = res.cdpUrl;
  } catch (err: any) {
    console.error(`[Debug] startProfile lỗi (có thể đã chạy sẵn): ${err.message}`);
    cdpUrl = process.env.CHROME_CDP_URL || 'http://localhost:9222';
    console.log(`[Debug] Thử dùng CDP cũ: ${cdpUrl}`);
  }

  // 2. Connect Playwright
  console.log(`[Debug] Connect Playwright qua CDP: ${cdpUrl}`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();

  // 3. Output dir
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'logs', 'google-login-debug', ts);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`[Debug] Output: ${outDir}`);

  const email = process.env.GOOGLE_EMAIL;
  if (!email) {
    console.log('\n[Debug] GOOGLE_EMAIL chưa set → dừng.');
    await browser.close();
    return;
  }

  // 4. Navigate AccountChooser trực tiếp (tránh WebLiteSignIn flow bị Google chặn)
  const chooserUrl = `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(STUDIO_URL + '/')}&Email=${encodeURIComponent(email)}`;
  console.log(`[Debug] Goto AccountChooser: ${chooserUrl}`);
  await page.goto(chooserUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
    console.warn(`[Debug] Goto warn: ${e.message}`);
  });
  await page.waitForTimeout(3000);

  await dumpStep(page, outDir, '01-after-goto-chooser');

  if (!page.url().includes('accounts.google.com')) {
    console.log('\n[Debug] Đã redirect khỏi accounts.google.com — có khi session còn dùng được.');
    console.log(`[Debug] Final URL: ${page.url()}`);
    await browser.close();
    return;
  }

  // ── Step a: AccountChooser hoặc Email input ─────────────────────────────
  await listLocators(page, 'after chooser nav', [
    `div[data-identifier="${email}"]`,
    `li[data-identifier="${email}"]`,
    `div[role="link"]:has-text("${email}")`,
    `li:has-text("${email}")`,
    'input[type="email"]',
    'input#identifierId',
    '#identifierNext',
  ]);

  // 3 case: account chooser / confirmidentifier / identifier (email input)
  const accountRow = page.locator(
    `div[data-identifier="${email}"], ` +
    `li[data-identifier="${email}"], ` +
    `div[role="link"]:has-text("${email}"), ` +
    `li:has-text("${email}")`
  );
  const onConfirm = page.url().includes('confirmidentifier');
  if (await accountRow.count() > 0) {
    console.log('[Debug] Tìm thấy account chooser — click row');
    await accountRow.first().click().catch(() => {});
  } else if (onConfirm) {
    console.log('[Debug] Page confirmidentifier — click Next để xác nhận account đã chọn');
    await page.locator('#identifierNext').click().catch(() => page.keyboard.press('Enter'));
  } else if (await page.locator('input[type="email"]:visible').count() > 0) {
    console.log(`[Debug] Identifier page — fill email`);
    await page.locator('input[type="email"]:visible').first().fill(email);
    await page.locator('#identifierNext').click().catch(() => page.keyboard.press('Enter'));
  } else {
    console.log('[Debug] Không thấy chooser/confirm/email input — xem dump');
  }
  await page.waitForTimeout(3500);
  await dumpStep(page, outDir, '02-after-step1');

  // ── Step b: Password page ───────────────────────────────────────────────
  await listLocators(page, 'password page', [
    'input[type="password"]',
    'input[name="Passwd"]',
    '#passwordNext',
  ]);

  const password = process.env.GOOGLE_PASSWORD;
  if (!password) {
    console.log('\n[Debug] GOOGLE_PASSWORD chưa set → dừng tại password page.');
    await browser.close();
    return;
  }
  console.log('[Debug] Fill password');
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('#passwordNext').click().catch(() => page.keyboard.press('Enter'));
  await page.waitForTimeout(4000);

  await dumpStep(page, outDir, '03-after-password-next');

  // ── Step c: 2FA picker / direct ─────────────────────────────────────────
  await listLocators(page, '2FA detection', [
    'input#totpPin',
    'input[name="totpPin"]',
    'input[type="tel"]',
    'button:has-text("Try another way")',
    'button:has-text("Thử cách khác")',
    'a:has-text("Try another way")',
    'div[role="link"]:has-text("Google Authenticator")',
    'div[role="link"]:has-text("Authenticator app")',
    'div[role="link"]:has-text("Trình xác thực")',
    'li:has-text("Google Authenticator")',
  ]);

  // Nếu chưa ở thẳng TOTP step → click "Thử cách khác" → "Google Authenticator"
  // Dùng JS click để tránh Google's Bluetooth modal đè lên button
  const totpInputSel = 'input#totpPin, input[name="totpPin"], input[type="tel"]';
  for (let i = 0; i < 3 && await page.locator(totpInputSel).count() === 0; i++) {
    const tryAnother = page.locator(
      'button:has-text("Thử cách khác"), button:has-text("Try another way"), ' +
      'a:has-text("Thử cách khác"), a:has-text("Try another way")'
    );
    if (await tryAnother.count() > 0) {
      console.log('[Debug] Click "Thử cách khác" (JS click)');
      const urlBefore = page.url();
      await tryAnother.first().evaluate((el: HTMLElement) => el.click()).catch((err) => {
        console.warn(`[Debug] JS click lỗi: ${err.message}`);
      });
      try {
        await page.waitForURL(u => u.toString() !== urlBefore, { timeout: 5000 });
        console.log(`[Debug] URL chuyển: ${page.url()}`);
      } catch {
        console.warn('[Debug] URL không đổi');
      }
      await page.waitForTimeout(1500);
      await dumpStep(page, outDir, `04-after-try-another-${i}`);
    }

    // data-challengetype="6" = Google Authenticator (chính xác, không trùng wrapper)
    const authOption = page.locator(
      'div[data-challengetype="6"], ' +
      'div[role="link"][data-action="selectchallenge"]:has-text("Google Authenticator")'
    );
    const authCount = await authOption.count();
    if (authCount > 0) {
      console.log(`[Debug] Found ${authCount} Authenticator — JS click`);
      await authOption.first().evaluate((el: HTMLElement) => el.click()).catch((err) => {
        console.warn(`[Debug] JS click Authenticator lỗi: ${err.message}`);
      });
      await page.waitForTimeout(3000);
      await dumpStep(page, outDir, '05-after-pick-authenticator');
    } else {
      console.log('[Debug] KHÔNG tìm thấy option Authenticator — xem dump');
      break;
    }
  }

  // ── Step d: Fill TOTP ──────────────────────────────────────────────────
  if (await page.locator(totpInputSel).count() > 0) {
    const secret = (process.env.GOOGLE_TOTP_SECRET || '').replace(/\s+/g, '');
    if (!secret) {
      console.log('[Debug] GOOGLE_TOTP_SECRET chưa set → dừng tại TOTP page.');
    } else {
      const code = await fetchTotpFrom2faLive(secret);
      if (!code) {
        console.log('[Debug] 2fa.live không trả về mã hợp lệ → dừng.');
        await browser.close();
        return;
      }
      const secs = Math.floor(Date.now() / 1000) % 30;
      console.log(`[Debug] Fill TOTP code: ${code} (secret len=${secret.length}, ${secs}s vào period 30s — mã hợp lệ trong ${30 - secs}s nữa)`);
      console.log(`[Debug] >>> So sánh ${code} với mã trong Authenticator app trên điện thoại bạn <<<`);
      await page.locator(totpInputSel).first().fill(code);
      await page.locator('#totpNext').click().catch(() => page.keyboard.press('Enter'));
      await page.waitForTimeout(5000);
      await dumpStep(page, outDir, '06-after-totp-submit');
    }
  } else {
    console.log('[Debug] Không thấy ô TOTP — có thể Google đang bắt verify khác. Xem dump.');
  }

  // ── Step e: Final state ─────────────────────────────────────────────────
  await page.waitForTimeout(3000);
  await dumpStep(page, outDir, '07-final');

  if (page.url().includes('accounts.google.com')) {
    console.log('\n[Debug] ❌ Vẫn còn ở accounts.google.com → login chưa thành công. Xem dump để biết Google đang đòi gì.');
  } else {
    console.log(`\n[Debug] ✅ Login OK — current URL: ${page.url()}`);
  }

  await browser.close();
  console.log(`\n[Debug] Hoàn tất. Dump tại: ${outDir}`);
  console.log(`[Debug] Share thư mục đó (hoặc các file *.text.txt + *.png) để tune selector.`);
}

main().catch((err) => {
  console.error('[Debug] Fatal:', err);
  process.exit(1);
});
