import type { Page } from 'playwright';
import logger from '../../middlewares/logger.middleware';
import { SettingsService } from '../settings/settings.service';
import { ProgressService } from './progress.service';

/** Total số step trong login flow — cho FE tính progress percent */
const LOGIN_STEPS = 8;
/** i18n translate function (req.t), optional — fallback tiếng Việt nếu không có */
type TFn = (key: string, opts?: Record<string, unknown>) => string;
/** Helper emit step event nếu có taskId. Step 0-based, message tiếng Việt. */
function emitStep(taskId: string | undefined, step: number, message: string): void {
  if (!taskId) return;
  ProgressService.emit(taskId, {
    step,
    total: LOGIN_STEPS,
    percent: Math.round((step / LOGIN_STEPS) * 100),
    message,
  });
}

/**
 * GoogleAutoLoginService — tự động login lại Google khi browser session hết hạn.
 *
 * Khi scraper navigate vào YouTube Studio và bị redirect sang accounts.google.com,
 * service này nhận page, tự fill email + password + TOTP, đợi redirect ra ngoài,
 * rồi navigate lại URL gốc.
 *
 * Yêu cầu env:
 *   GOOGLE_EMAIL          — email tài khoản Google
 *   GOOGLE_PASSWORD       — password tài khoản Google
 *   GOOGLE_TOTP_SECRET    — base32 secret từ Authenticator (lấy lúc bật 2FA, "Can't scan it?")
 *                          Mã 6 số sẽ được lấy qua API https://2fa.live/tok/{secret}.
 *
 * Lưu ý:
 *   - Google có thể bắt verify thiết bị mới ("verify it's you", recovery email, SMS)
 *     → script không vượt được, sẽ trả về false để caller thông báo cho người vận hành.
 *   - GemLogin giữ fingerprint ổn định + proxy cố định giúp giảm xác suất bị challenge.
 */
export class GoogleAutoLoginService {
  /** Lock toàn cục — chỉ cho 1 tab thực sự login, các tab khác đợi rồi reload. */
  private static loginInProgress = false;
  private static lastLoginAt = 0;
  /** Throttle: nếu vừa login thành công <60s, không cần login lại — chắc bị stale check. */
  private static readonly LOGIN_COOLDOWN_MS = 60_000;

  /**
   * Nếu page đang ở accounts.google.com → auto-login + re-navigate originalUrl.
   * Trả về true nếu page đã thoát khỏi accounts.google.com (login OK hoặc không cần login).
   */
  static async ensureLoggedIn(page: Page, originalUrl?: string, taskId?: string, t?: TFn): Promise<boolean> {
    if (!page.url().includes('accounts.google.com')) return true;

    const creds = await SettingsService.getGoogleLoginCredentials();
    if (!creds.email || !creds.password) {
      emitStep(taskId, LOGIN_STEPS, t ? t('progress.login.notConfigured') : 'Chưa cấu hình email/password — không thể login');
      logger.error('[GoogleAutoLogin] Chưa cấu hình email/password (cả DB và env đều trống) — không thể auto-login');
      return false;
    }

    // Tab khác đang login → đợi xong rồi navigate lại
    if (this.loginInProgress) {
      emitStep(taskId, 1, t ? t('progress.login.waitingOtherTab') : 'Đang đợi tab khác login xong...');
      logger.info('[GoogleAutoLogin] Tab khác đang login — đợi tối đa 90s...');
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline && this.loginInProgress) {
        await new Promise(r => setTimeout(r, 2_000));
      }
      return await this.renavigate(page, originalUrl);
    }

    if (Date.now() - this.lastLoginAt < this.LOGIN_COOLDOWN_MS) {
      emitStep(taskId, LOGIN_STEPS - 1, t ? t('progress.login.recentlyLoggedIn') : 'Vừa login gần đây — chỉ navigate lại');
      logger.info('[GoogleAutoLogin] Vừa login gần đây — thử navigate lại');
      return await this.renavigate(page, originalUrl);
    }

    this.loginInProgress = true;
    try {
      const ok = await this.performLogin(page, creds, taskId, t);
      await SettingsService.recordLoginAttempt(ok, ok ? 'Login OK' : 'Login fail').catch(() => {});
      if (!ok) return false;
      this.lastLoginAt = Date.now();
      emitStep(taskId, LOGIN_STEPS - 1, t ? t('progress.login.renavigating') : 'Đang navigate lại trang gốc');
      return await this.renavigate(page, originalUrl);
    } finally {
      this.loginInProgress = false;
    }
  }

  /** Check sync (DB query async) — chỉ dùng cho UI/logging. */
  static async isConfigured(): Promise<boolean> {
    const creds = await SettingsService.getGoogleLoginCredentials();
    return !!(creds.email && creds.password);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private static async renavigate(page: Page, originalUrl?: string): Promise<boolean> {
    try {
      if (originalUrl) {
        await page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      } else {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
      }
    } catch (err: any) {
      logger.warn(`[GoogleAutoLogin] Re-navigate cảnh báo: ${err.message}`);
    }
    const stillLoggedOut = page.url().includes('accounts.google.com');
    if (stillLoggedOut) {
      logger.error(`[GoogleAutoLogin] Vẫn redirect về login sau khi re-navigate: ${page.url()}`);
    }
    return !stillLoggedOut;
  }

  private static async performLogin(page: Page, creds: { email: string | null; password: string | null; totpSecret: string | null }, taskId?: string, t?: TFn): Promise<boolean> {
    const email = creds.email!;
    const password = creds.password!;
    const totpSecret = (creds.totpSecret || '').replace(/\s+/g, '');

    logger.info(`[GoogleAutoLogin] Bắt đầu auto-login cho ${email}...`);

    try {
      emitStep(taskId, 1, t ? t('progress.login.openingChooser') : 'Mở AccountChooser của Google...');
      const chooserUrl = 'https://accounts.google.com/AccountChooser?continue=' +
        encodeURIComponent('https://studio.youtube.com/') +
        '&Email=' + encodeURIComponent(email);
      await page.goto(chooserUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(2_000);

      const accountRow = page.locator(
        `div[data-identifier="${email}"], li[data-identifier="${email}"], ` +
        `div[role="link"]:has-text("${email}"), li:has-text("${email}")`
      );
      const inChooser = await accountRow.count() > 0;
      if (inChooser) {
        emitStep(taskId, 2, t ? t('progress.login.selectingAccount', { email }) : `Click chọn account ${email}`);
        await accountRow.first().click().catch(() => {});
        await page.waitForTimeout(3_000);
      }

      const url = page.url();
      const onConfirmIdentifier = url.includes('confirmidentifier');
      const emailInput = page.locator('input[type="email"]:visible');
      const hasEmailInput = await emailInput.count() > 0;

      if (onConfirmIdentifier) {
        emitStep(taskId, 2, t ? t('progress.login.confirmingAccount') : 'Xác nhận account đã chọn');
        await this.clickNext(page, '#identifierNext');
        await page.waitForTimeout(2_500);
      } else if (hasEmailInput) {
        emitStep(taskId, 2, t ? t('progress.login.enteringEmail', { email }) : `Nhập email ${email}`);
        await emailInput.first().fill(email);
        await this.clickNext(page, '#identifierNext');
        await page.waitForTimeout(2_500);
      }

      // Password
      emitStep(taskId, 3, t ? t('progress.login.waitingPassword') : 'Đợi page password...');
      const passwordInput = page.locator('input[type="password"]');
      try {
        await passwordInput.first().waitFor({ state: 'visible', timeout: 15_000 });
      } catch {
        emitStep(taskId, LOGIN_STEPS, t ? t('progress.login.passwordPageMissing') : 'Page password không xuất hiện — Google challenge');
        await this.dumpChallenge(page, 'password input không xuất hiện');
        return false;
      }
      emitStep(taskId, 4, t ? t('progress.login.enteringPassword') : 'Đang nhập mật khẩu...');
      await passwordInput.first().fill(password);
      await this.clickNext(page, '#passwordNext');
      await page.waitForTimeout(3_000);

      // 2FA
      emitStep(taskId, 5, t ? t('progress.login.switchingAuthenticator') : 'Đang chuyển sang trang Authenticator...');
      const onTotpPage = await this.gotoTotpStep(page);
      if (onTotpPage) {
        if (!totpSecret) {
          emitStep(taskId, LOGIN_STEPS, t ? t('progress.login.twoFANoSecret') : 'Google bắt 2FA nhưng chưa có TOTP secret');
          await this.dumpChallenge(page, 'Google bắt 2FA nhưng GOOGLE_TOTP_SECRET chưa cấu hình');
          return false;
        }
        emitStep(taskId, 6, t ? t('progress.login.fetchingTotp') : 'Đang lấy mã TOTP từ 2fa.live...');
        const code = await this.getTotpCode(totpSecret);
        if (!code) {
          emitStep(taskId, LOGIN_STEPS, t ? t('progress.login.invalidTotp') : '2fa.live trả mã không hợp lệ');
          return false;
        }
        emitStep(taskId, 7, t ? t('progress.login.enteringTotp', { code }) : `Đang nhập mã 6 số: ${code}`);
        const totpInput = page.locator('input#totpPin, input[name="totpPin"], input[type="tel"]').first();
        await totpInput.fill(code);
        await this.clickNext(page, '#totpNext');
        await page.waitForTimeout(3_000);
      }

      // ── Step 4: Đợi redirect ra khỏi accounts.google.com ─────────────────
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const url = page.url();
        if (!url.includes('accounts.google.com')) {
          logger.info(`[GoogleAutoLogin] Login OK, redirected: ${url}`);
          return true;
        }
        // Phát hiện challenge mà script không vượt được
        const body = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '').catch(() => '') as string;
        const challengeKeywords = [
          'verify it\'s you',
          'xác minh đó là bạn',
          'recovery email',
          'email khôi phục',
          'enter the phone number',
          'nhập số điện thoại',
          'this device isn\'t recognized',
          'thiết bị này chưa được nhận diện',
          'something went wrong',
        ];
        const hit = challengeKeywords.find(k => body.includes(k));
        if (hit) {
          await this.dumpChallenge(page, `Google challenge: "${hit}" — script không vượt qua được`);
          return false;
        }
        await new Promise(r => setTimeout(r, 2_000));
      }

      await this.dumpChallenge(page, `Timeout 30s — vẫn ở ${page.url()}`);
      return false;
    } catch (err: any) {
      logger.error(`[GoogleAutoLogin] Lỗi không xác định: ${err.message}`);
      return false;
    }
  }

  /**
   * Đảm bảo page đang ở step nhập TOTP (Authenticator).
   * Nếu Google show passkey/picker, click "Thử cách khác" → chọn option có chữ
   * "Google Authenticator" → vào trang nhập mã 6 số.
   */
  private static async gotoTotpStep(page: Page): Promise<boolean> {
    const totpInputSelector = 'input#totpPin, input[name="totpPin"], input[type="tel"]';

    if (await page.locator(totpInputSelector).count() > 0) return true;

    // Click "Thử cách khác" → "Google Authenticator" tối đa 3 lần (passkey → selection)
    for (let i = 0; i < 3; i++) {
      if (await page.locator(totpInputSelector).count() > 0) return true;

      // Step 1: Click "Thử cách khác" — dùng JS click để tránh overlay (Bluetooth modal)
      // Google hay auto-pop modal "Bật Bluetooth?" che button → mouse click rơi vào modal
      const tryAnother = page.locator(
        'button:has-text("Thử cách khác"), button:has-text("Try another way"), ' +
        'a:has-text("Thử cách khác"), a:has-text("Try another way")'
      );
      const urlBefore = page.url();
      if (await tryAnother.count() > 0) {
        logger.info('[GoogleAutoLogin] Click "Thử cách khác" (JS click)');
        // Direct JS click — gọi handler không qua mouse, bypass mọi overlay
        await tryAnother.first().evaluate((el: HTMLElement) => el.click()).catch((err) => {
          logger.warn(`[GoogleAutoLogin] JS click "Thử cách khác" lỗi: ${err.message}`);
        });
        // Đợi page chuyển — verify URL thay đổi
        try {
          await page.waitForURL(u => u.toString() !== urlBefore, { timeout: 5_000 });
          logger.info(`[GoogleAutoLogin] URL chuyển: ${page.url()}`);
        } catch {
          logger.warn('[GoogleAutoLogin] URL không đổi sau click — page chưa chuyển');
        }
        await page.waitForTimeout(1_500);
      }

      // Step 2: Click option Authenticator (selection page)
      // data-challengetype="6" = Google Authenticator TOTP, là attr duy nhất.
      // Fallback: tìm theo text "Google Authenticator" trên div[role="link"].
      const authOption = page.locator(
        'div[data-challengetype="6"], ' +
        'div[role="link"][data-action="selectchallenge"]:has-text("Google Authenticator")'
      );
      const authCount = await authOption.count();
      if (authCount > 0) {
        logger.info(`[GoogleAutoLogin] Tìm thấy ${authCount} match Authenticator — JS click`);
        await authOption.first().evaluate((el: HTMLElement) => el.click()).catch((err) => {
          logger.warn(`[GoogleAutoLogin] JS click Authenticator lỗi: ${err.message}`);
        });
        await page.waitForTimeout(3_000);
        if (await page.locator(totpInputSelector).count() > 0) return true;
      } else {
        logger.warn('[GoogleAutoLogin] Không tìm thấy option Authenticator trong picker');
      }
    }

    return await page.locator(totpInputSelector).count() > 0;
  }

  /** Lấy mã TOTP qua 2fa.live (API: GET https://2fa.live/tok/{secret} → { token: "123456" }). */
  private static async getTotpCode(secret: string): Promise<string | null> {
    try {
      const res = await fetch(`https://2fa.live/tok/${encodeURIComponent(secret)}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        logger.error(`[GoogleAutoLogin] 2fa.live trả về ${res.status}`);
        return null;
      }
      const data = await res.json() as { token?: string };
      if (!data.token || !/^\d{6}$/.test(data.token)) {
        logger.error(`[GoogleAutoLogin] 2fa.live trả về token không hợp lệ: ${JSON.stringify(data)}`);
        return null;
      }
      return data.token;
    } catch (err: any) {
      logger.error(`[GoogleAutoLogin] 2fa.live lỗi: ${err.message}`);
      return null;
    }
  }

  private static async clickNext(page: Page, idSelector: string): Promise<void> {
    const idBtn = page.locator(idSelector);
    if (await idBtn.count() > 0) {
      await idBtn.first().click().catch(() => page.keyboard.press('Enter'));
      return;
    }
    const textBtn = page.locator('button:has-text("Next"), button:has-text("Tiếp theo")');
    if (await textBtn.count() > 0) {
      await textBtn.first().click().catch(() => page.keyboard.press('Enter'));
      return;
    }
    await page.keyboard.press('Enter');
  }

  private static async dumpChallenge(page: Page, reason: string): Promise<void> {
    const url = page.url();
    const snippet = await page
      .evaluate(() => document.body?.innerText?.substring(0, 300) || '')
      .catch(() => '') as string;
    logger.error(`[GoogleAutoLogin] FAIL: ${reason} | URL: ${url} | Snippet: ${snippet.substring(0, 200)}`);
  }
}
