/**
 * Session verification, login detection, markSessionDisconnected, cookie management.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BrowserContext, chromium, Page } from 'playwright';
import logger from '../../middlewares/logger.middleware';
import { EmailService } from '../email.service';
import {
  CHROME_DATA_BASE_DIR,
  getChromeUserDataDir,
  getSessionVerifiedFile,
  getAccountInfoFile,
  getPendingCookiesFile,
} from './chrome-profile';
import {
  contexts,
  loginBrowserOpenMap,
  loginBrowserOpen, setLoginBrowserOpen,
  lastAlertSentAt,
  verifyingSession, setVerifyingSession,
  cdpProcess, setCdpProcess,
  loginProcess, setLoginProcess,
  scrapingInProgress,
} from './shared-state';
import { safeClosePage } from './types';
import {
  getContext,
  closeBrowser,
  cleanStaleLockFiles,
  getRealChromePath,
  startHeadlessChrome,
  hasValidSession,
  markSessionVerified,
  startKeepAlive,
} from './browser-context.service';

// ============================================================
// SESSION DISCONNECT
// ============================================================

/**
 * Record disconnect reason to DB so UI can show detailed error
 */
export async function markSessionDisconnected(reason: string, url?: string, adminId?: string, extra?: Record<string, unknown>): Promise<void> {
  try {
    const sf = getSessionVerifiedFile(adminId);
    if (fs.existsSync(sf)) fs.unlinkSync(sf);
  } catch { /* ignore */ }

  logger.warn(`[Session] Disconnected — reason: "${reason}"${url ? ` url: ${url}` : ''} admin: ${adminId || 'default'}`);

  // Write detailed session disconnect log
  try {
    const logDir = path.join(process.cwd(), 'logs', 'session-errors');
    fs.mkdirSync(logDir, { recursive: true });
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const fileLabel = now.toISOString().substring(0, 10); // YYYY-MM-DD
    const logFile = path.join(logDir, `${fileLabel}.log`);
    const lines: string[] = [
      `\n${'='.repeat(60)}`,
      `[${dateStr}] SESSION DISCONNECTED`,
      `  Admin   : ${adminId || 'default'}`,
      `  Reason  : ${reason}`,
      url ? `  URL     : ${url}` : `  URL     : (not captured)`,
    ];
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        lines.push(`  ${k.padEnd(8)}: ${String(v).substring(0, 500)}`);
      }
    }
    lines.push('');
    fs.appendFileSync(logFile, lines.join('\n') + '\n');
  } catch { /* ignore log write errors */ }

  if (adminId) {
    try {
      const prisma = (await import('../../config/database')).default;
      await prisma.youTubeSession.updateMany({
        where: { admin_id: adminId },
        data: {
          is_logged_in: false,
          disconnected_at: new Date(),
          disconnect_reason: reason,
          disconnect_url: url?.substring(0, 1000) ?? null,
        },
      });
    } catch { /* ignore — DB might not have a row yet */ }
  }

  notifySessionExpired(adminId).catch(() => {});
}

/**
 * Send session-expired email alert to admin — throttled to once per hour
 */
async function notifySessionExpired(adminId?: string): Promise<void> {
  const key = adminId || '__default__';
  const last = lastAlertSentAt.get(key) || 0;
  const ONE_HOUR = 60 * 60 * 1000;
  if (Date.now() - last < ONE_HOUR) {
    logger.info(`[Alert] Throttled — already sent session alert for ${key} within last hour`);
    return;
  }
  lastAlertSentAt.set(key, Date.now());

  try {
    let adminEmail: string | null | undefined;
    if (adminId) {
      const prisma = (await import('../../config/database')).default;
      adminEmail = (await prisma.user.findUnique({ where: { id: adminId }, select: { email: true } }))?.email;
    } else {
      adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
    }

    if (!adminEmail) {
      logger.warn(`[Alert] No admin email found for ${key} — cannot send alert`);
      return;
    }

    logger.info(`[Alert] Sending session expired email to ${adminEmail}...`);
    await EmailService.sendSessionExpiredAlert(adminEmail);
  } catch (err: any) {
    logger.error(`[Alert] Failed to send session expired email: ${err.message}`);
  }
}

// ============================================================
// CREDENTIAL ENCRYPTION
// ============================================================

function getEncryptionKey(): Buffer {
  return crypto.scryptSync(process.env.JWT_SECRET || 'koc-default-key', 'yt-cred-salt-v1', 32);
}

export function encryptPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(encryptedText: string): string {
  const key = getEncryptionKey();
  const [ivHex, encHex] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}

// ============================================================
// ACCOUNT INFO & LOGIN STATUS
// ============================================================

/**
 * Extract account info from YouTube Studio page and cache to file.
 */
export async function extractAndCacheAccountInfo(
  adminId?: string
): Promise<{ channelName?: string; email?: string }> {
  const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
  const isLoginOpen = adminId
    ? loginBrowserOpenMap.get(adminId)
    : loginBrowserOpen;

  if (isLoginOpen) {
    logger.info('Skipping extractAndCacheAccountInfo — login browser is open.');
    return {};
  }
  let page: Page | null = null;
  try {
    const context = await getContext(true, adminId);
    page = await context.newPage();

    await page.goto('https://studio.youtube.com', {
      waitUntil: 'domcontentloaded',
      timeout: 1800000,
    });

    // If redirected to Google login, session is invalid
    if (page.url().includes('accounts.google.com')) {
      logger.warn('Not logged in (redirected to Google login)');
      const redirectUrl = page.url();
      const pageTitle = await page.title().catch(() => '');
      const bodySnippet = await page.evaluate(() => document.body?.innerText?.substring(0, 300)).catch(() => '') as string;
      await safeClosePage(page);
      await closeBrowser(adminId);
      markSessionDisconnected('account_info_redirect', redirectUrl, adminId, {
        pageTitle,
        bodySnippet,
        trigger: 'extractAndCacheAccountInfo',
      }).catch(() => {});
      return {};
    }

    await page.waitForTimeout(3000);

    const title = await page.title();
    const channelName =
      title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

    let email: string | undefined;
    try {
      email =
        ((await page.evaluate(() => {
          const selectors = [
            '[aria-label*="@"]',
            '[title*="@"]',
            'yt-img-shadow[aria-label]',
            '#avatar-btn',
            'button[aria-label*="Google"]',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const label =
                el.getAttribute('aria-label') || el.getAttribute('title') || '';
              const match = label.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
              if (match) return match[0];
            }
          }
          return null;
        })) as string | null) ?? undefined;
    } catch { /* ignore */ }

    logger.info(
      `Account info extracted: channel="${channelName}" email="${email || 'unknown'}"`
    );

    markSessionVerified(adminId);

    const info = {
      channelName,
      email,
      extractedAt: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify(info, null, 2));
    } catch { /* ignore */ }

    await safeClosePage(page);
    return info;
  } catch (err: any) {
    logger.warn('Could not extract account info:', err.message);
    if (page) await safeClosePage(page);
    return {};
  }
}

/**
 * Check if user is logged in to YouTube Studio
 */
export async function checkLoginStatus(
  adminId?: string
): Promise<{ loggedIn: boolean; channelName?: string; email?: string; loginBrowserOpen?: boolean }> {
  const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
  const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
  const isLoginOpen = adminId
    ? loginBrowserOpenMap.get(adminId)
    : loginBrowserOpen;

  if (isLoginOpen) {
    if (fs.existsSync(SESSION_VERIFIED_FILE)) {
      if (adminId) {
        loginBrowserOpenMap.delete(adminId);
      } else {
        setLoginBrowserOpen(false);
      }
    } else {
      return { loggedIn: false, loginBrowserOpen: true };
    }
  }

  const hasSession = hasValidSession(adminId);
  if (!hasSession) {
    try { if (fs.existsSync(ACCOUNT_INFO_FILE)) fs.unlinkSync(ACCOUNT_INFO_FILE); } catch { /* ignore */ }
    return { loggedIn: false };
  }

  if (fs.existsSync(ACCOUNT_INFO_FILE)) {
    try {
      const raw = fs.readFileSync(ACCOUNT_INFO_FILE, 'utf-8');
      const info = JSON.parse(raw);

      return {
        loggedIn: true,
        channelName: info.channelName,
        email: info.email,
      };
    } catch { /* ignore */ }
  }

  return { loggedIn: true };
}

// ============================================================
// LOGIN VERIFICATION
// ============================================================

/**
 * Verify session by navigating to studio.youtube.com and checking the URL.
 */
export async function openVerifyTab(adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
  const cdpUrl = process.env.CHROME_CDP_URL;
  if (cdpUrl) {
    logger.info('[VerifyTab] CDP already running — verifying via existing context');
    return _verifyViaContext(adminId);
  }

  const realChrome = getRealChromePath();
  if (!realChrome) {
    logger.info('[VerifyTab] No real Chrome — falling back to Playwright verify');
    return closeLoginAndVerify(adminId);
  }

  const CHROME_USER_DATA_DIR = adminId
    ? path.join(CHROME_DATA_BASE_DIR, adminId)
    : CHROME_DATA_BASE_DIR;
  const VERIFY_PORT = 9223;

  const { spawn } = require('child_process');
  const args = [
    '--headless=new',
    `--user-data-dir=${CHROME_USER_DATA_DIR}`,
    `--remote-debugging-port=${VERIFY_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-infobars',
  ];

  logger.info('[VerifyTab] Spawning headless Chrome on port 9223 for verification...');
  const child = spawn(realChrome, args, { stdio: 'ignore', detached: false });
  const killChild = () => { try { child.kill('SIGTERM'); } catch { /* ignore */ } };

  try {
    await new Promise(r => setTimeout(r, 3000));
    const { chromium: pw } = require('playwright');
    const browser = await pw.connectOverCDP(`http://localhost:${VERIFY_PORT}`, { timeout: 10000 });
    const ctx = browser.contexts()[0] ?? await browser.newContext();
    const page: Page = ctx.pages()[0] ?? await ctx.newPage();

    await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 1800000 });
    await page.waitForTimeout(2000);

    const result = await _extractVerifyResult(page, adminId);
    await browser.close().catch(() => {});
    killChild();
    return result;
  } catch (err: any) {
    logger.warn(`[VerifyTab] Spawn verify failed: ${err.message} — falling back to Playwright verify`);
    killChild();
    return closeLoginAndVerify(adminId);
  }
}

/** Verify session by reusing the existing Playwright browser context. */
async function _verifyViaContext(adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
  let page: Page | null = null;
  try {
    const context = await getContext(true, adminId);
    page = await context.newPage();
    await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 1800000 });
    await page.waitForTimeout(2000);
    const result = await _extractVerifyResult(page, adminId);
    await safeClosePage(page);
    return result;
  } catch (err: any) {
    logger.warn(`[VerifyTab] Context verify failed: ${err.message}`);
    if (page) await safeClosePage(page).catch(() => {});
    return { loggedIn: false };
  }
}

/** Extract channel/email from a Studio page and mark session accordingly. */
async function _extractVerifyResult(
  page: Page,
  adminId?: string
): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
  const url = page.url();
  logger.info(`[VerifyTab] URL: ${url}`);

  if (url.includes('accounts.google.com') || url.includes('signin')) {
    logger.warn('[VerifyTab] Not logged in — redirected to Google login');
    return { loggedIn: false };
  }

  const title = await page.title().catch(() => '');
  const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

  let email: string | undefined;
  try {
    email = ((await page.evaluate(() => {
      for (const sel of ['[aria-label*="@"]', '[title*="@"]', 'button[aria-label*="Google"]']) {
        const el = document.querySelector(sel);
        if (el) {
          const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
          const match = label.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
          if (match) return match[0];
        }
      }
      return null;
    })) as string | null) ?? undefined;
  } catch { /* ignore */ }

  markSessionVerified(adminId);
  try {
    fs.writeFileSync(getAccountInfoFile(adminId), JSON.stringify({
      channelName, email, extractedAt: new Date().toISOString(),
    }, null, 2));
  } catch { /* ignore */ }

  logger.info(`[VerifyTab] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
  return { loggedIn: true, channelName, email };
}

/**
 * Close the raw login Chromium and verify the session with headless Playwright.
 */
export async function closeLoginAndVerify(
  adminId?: string
): Promise<{ loggedIn: boolean; channelName?: string; email?: string; loginBrowserOpen?: boolean }> {
  setVerifyingSession(true);
  const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);

  try {
    // -- CDP MODE: only when CHROME_CDP_URL is explicitly set --
    const cdpUrl = process.env.CHROME_CDP_URL;

    if (cdpUrl) {
      if (adminId) loginBrowserOpenMap.delete(adminId);
      else setLoginBrowserOpen(false);

      logger.info('[closeLoginAndVerify] CDP mode — verifying via existing Chrome...');
      let page: Page | null = null;
      try {
        process.env.CHROME_CDP_URL = cdpUrl;
        const context = await getContext(true, adminId);
        page = await context.newPage();
        await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 1800000 });
        await page.waitForTimeout(2000);

        const url = page.url();
        if (url.includes('accounts.google.com') || url.includes('signin')) {
          logger.warn('[closeLoginAndVerify] CDP: Not logged in');
          process.env.CHROME_CDP_URL = '';
          return { loggedIn: false };
        }

        const title = await page.title();
        const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;
        markSessionVerified(adminId);
        const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
        try { fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({ channelName, extractedAt: new Date().toISOString() }, null, 2)); } catch { /* ignore */ }
        logger.info(`[closeLoginAndVerify] CDP: Session verified! Channel: ${channelName}`);

        // Kill the headed login Chrome and restart headlessly
        if (page) { await safeClosePage(page); page = null; }
        const key = adminId || '__default__';
        contexts.delete(key);
        if (loginProcess) {
          try { loginProcess.kill('SIGTERM'); } catch { /* ignore */ }
          setLoginProcess(null);
        }
        await new Promise(r => setTimeout(r, 1500));
        await startHeadlessChrome(adminId);
        logger.info('[CDP] Switched to headless Chrome — browser window closed, scraping runs invisibly');
        return { loggedIn: true, channelName };
      } catch (err: any) {
        logger.warn(`[closeLoginAndVerify] CDP verify failed: ${err.message}`);
        process.env.CHROME_CDP_URL = '';
      } finally {
        if (page) await safeClosePage(page);
      }
    }

    // -- PLAYWRIGHT MODE: kill Chrome, verify with headless Playwright --
    if (loginProcess) {
      try { loginProcess.kill('SIGTERM'); } catch { /* ignore */ }
      setLoginProcess(null);
    }
    if (adminId) loginBrowserOpenMap.delete(adminId);
    else setLoginBrowserOpen(false);

    await new Promise((r) => setTimeout(r, 3000));
    cleanStaleLockFiles(CHROME_USER_DATA_DIR);

    let tempContext: BrowserContext | null = null;
    let page: Page | null = null;
    try {
      tempContext = await chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
        timeout: 1800000,
        ignoreHTTPSErrors: true,
      });

      page = await tempContext.newPage();
      await page.goto('https://studio.youtube.com', {
        waitUntil: 'domcontentloaded',
        timeout: 1800000,
      });
      await page.waitForTimeout(3000);

      const url = page.url();
      if (url.includes('accounts.google.com') || url.includes('signin')) {
        logger.warn('[closeLoginAndVerify] Session not established — redirected to Google login');
        try {
          const sf = getSessionVerifiedFile(adminId);
          if (fs.existsSync(sf)) fs.unlinkSync(sf);
        } catch { /* ignore */ }
        return { loggedIn: false };
      }

      // Session is valid!
      const title = await page.title();
      const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

      let email: string | undefined;
      try {
        email = ((await page.evaluate(() => {
          const selectors = [
            '[aria-label*="@"]', '[title*="@"]',
            'yt-img-shadow[aria-label]', '#avatar-btn',
            'button[aria-label*="Google"]',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
              const match = label.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
              if (match) return match[0];
            }
          }
          return null;
        })) as string | null) ?? undefined;
      } catch { /* ignore */ }

      markSessionVerified(adminId);

      // Cache account info
      const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
      try {
        fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({
          channelName, email, extractedAt: new Date().toISOString(),
        }, null, 2));
      } catch { /* ignore */ }

      logger.info(`[closeLoginAndVerify] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
      return { loggedIn: true, channelName, email };
    } finally {
      if (page) await safeClosePage(page);
      if (tempContext) {
        try { await tempContext.close(); } catch { /* ignore */ }
      }
    }
  } catch (err: any) {
    logger.warn(`[closeLoginAndVerify] Error: ${err.message}`);
    return { loggedIn: false };
  } finally {
    setVerifyingSession(false);
  }
}

// ============================================================
// COOKIE IMPORT
// ============================================================

/**
 * Auto-sync cookies from a running Chrome instance (via CDP).
 */
export async function syncFromChrome(
  cdpUrl?: string,
  adminId?: string
): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
  const url = cdpUrl || process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';
  logger.info(`[SyncFromChrome] Connecting to Chrome at ${url}...`);

  const { chromium: pw } = require('playwright');
  let browser: any = null;

  try {
    browser = await pw.connectOverCDP(url, { timeout: 10000 });
    const ctxs = browser.contexts();
    const context = ctxs.length > 0 ? ctxs[0] : await browser.newContext();

    const allCookies = await context.cookies();
    const ytCookies = allCookies.filter((c: any) =>
      c.domain.includes('google.com') ||
      c.domain.includes('youtube.com') ||
      c.domain.includes('googleapis.com')
    );

    logger.info(`[SyncFromChrome] Got ${allCookies.length} total cookies, ${ytCookies.length} Google/YouTube cookies`);

    if (ytCookies.length === 0) {
      logger.warn('[SyncFromChrome] No Google/YouTube cookies found — make sure Chrome is logged in to YouTube Studio');
      return { loggedIn: false };
    }

    const keyNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID', 'LOGIN_INFO'];
    const foundKeys = ytCookies.filter((c: any) => keyNames.includes(c.name)).map((c: any) => `${c.name}(exp:${c.expires > 0 ? new Date(c.expires * 1000).toISOString().slice(0, 10) : 'session'})`);
    logger.info(`[SyncFromChrome] Key auth cookies: ${foundKeys.join(', ') || 'none'}`);

    await browser.close().catch(() => {});
    browser = null;

    const result = await importCookies(ytCookies, adminId);

    if (result.loggedIn) {
      startKeepAlive(adminId);
      getContext(true, adminId).catch((err: any) =>
        logger.warn(`[SyncFromChrome] Context pre-warm failed: ${err.message}`)
      );
    }

    return result;
  } catch (err: any) {
    logger.error(`[SyncFromChrome] Failed: ${err.message}`);
    throw new Error(`Cannot connect to Chrome at ${url}. Make sure Chrome is running with --remote-debugging-port=9222. Error: ${err.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Import cookies from user's local browser to establish YouTube session.
 */
export async function importCookies(
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
    expirationDate?: number;
  }>,
  adminId?: string
): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
  const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
  const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);

  await closeBrowser(adminId);

  cleanStaleLockFiles(CHROME_USER_DATA_DIR);
  fs.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });

  let tempContext: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    tempContext = await chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
      timeout: 1800000,
      ignoreHTTPSErrors: true,
    });

    const playwrightCookies = cookies.map((c) => {
      const rawExpires = c.expirationDate ?? (c as any).expires;
      const expires = rawExpires && rawExpires > 0 ? Math.floor(rawExpires) : undefined;

      const ss = c.sameSite;
      const sameSite: 'None' | 'Lax' | 'Strict' =
        ss === 'no_restriction' || ss === 'None' ? 'None'
        : ss === 'lax' || ss === 'Lax' ? 'Lax'
        : ss === 'strict' || ss === 'Strict' ? 'Strict'
        : 'Lax';

      return {
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        httpOnly: c.httpOnly ?? false,
        secure: c.secure ?? true,
        sameSite,
        ...(expires !== undefined ? { expires } : {}),
      };
    });

    const persistentCount = playwrightCookies.filter((c) => (c as any).expires !== undefined).length;
    logger.info(`[importCookies] Adding ${playwrightCookies.length} cookies (${persistentCount} persistent, ${playwrightCookies.length - persistentCount} session) for admin ${adminId || 'default'}...`);

    await tempContext.addCookies(playwrightCookies);

    page = await tempContext.newPage();
    await page.goto('https://studio.youtube.com', {
      waitUntil: 'domcontentloaded',
      timeout: 1800000,
    });
    await page.waitForTimeout(5000);

    const url = page.url();
    if (url.includes('accounts.google.com') || url.includes('signin')) {
      logger.warn('[importCookies] Session not valid — redirected to Google login');
      try { if (fs.existsSync(SESSION_VERIFIED_FILE)) fs.unlinkSync(SESSION_VERIFIED_FILE); } catch { /* ignore */ }
      return { loggedIn: false };
    }

    // Success — extract account info
    const title = await page.title();
    const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

    let email: string | undefined;
    try {
      email = ((await page.evaluate(() => {
        const selectors = [
          '[aria-label*="@"]', '[title*="@"]',
          'yt-img-shadow[aria-label]', '#avatar-btn',
          'button[aria-label*="Google"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
            const match = label.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
            if (match) return match[0];
          }
        }
        return null;
      })) as string | null) ?? undefined;
    } catch { /* ignore */ }

    markSessionVerified(adminId);

    const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
    try {
      fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({
        channelName, email, extractedAt: new Date().toISOString(),
      }, null, 2));
    } catch { /* ignore */ }

    try {
      fs.writeFileSync(getPendingCookiesFile(adminId), JSON.stringify(playwrightCookies, null, 2));
      logger.info(`[importCookies] Saved ${playwrightCookies.length} cookies for CDP Chrome to pick up`);
    } catch { /* ignore */ }

    logger.info(`[importCookies] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
    return { loggedIn: true, channelName, email };
  } catch (err: any) {
    logger.error(`[importCookies] Error: ${err.message}`);
    return { loggedIn: false };
  } finally {
    if (page) await safeClosePage(page);
    if (tempContext) {
      try { await tempContext.close(); } catch { /* ignore */ }
    }
  }
}
