/**
 * Browser context management: launching Chrome, CDP connection, getting context,
 * closing browser, per-admin profile management, keep-alive.
 */
import fs from 'fs';
import path from 'path';
import { BrowserContext, chromium, Page } from 'playwright';
import logger from '../../../middlewares/logger.middleware';
import {
  CHROME_DATA_BASE_DIR,
  getChromeUserDataDir,
  getSystemChromeProfileDir,
  getSessionVerifiedFile,
  getPendingCookiesFile,
  getAccountInfoFile,
} from './chrome-profile';
import {
  contexts,
  loginBrowserOpenMap,
  loginBrowserOpen, setLoginBrowserOpen,
  keepAliveTimers,
  scrapingInProgress,
  cdpProcess, setCdpProcess,
  loginProcess, setLoginProcess,
  verifyingSession, setVerifyingSession,
  sessionVerifiedAtMap,
  lastRealVerifyMap,
  loginOpenedAtMap,
} from './shared-state';
import { safeClosePage } from './types';

// ============================================================
// LOCK FILE CLEANUP
// ============================================================

/**
 * Remove stale Chrome lock files that prevent browser launch
 */
export function cleanStaleLockFiles(userDataDir: string): void {
  // SAFETY: Never delete lock files from the system Chrome profile — Chrome may be running
  const sysProfile = getSystemChromeProfileDir();
  if (sysProfile && userDataDir.startsWith(sysProfile)) {
    logger.debug(`[LockClean] Skipping system Chrome profile: ${userDataDir}`);
    return;
  }

  // Check if a Chrome process is actively using this profile by reading SingletonLock
  const lockPath = path.join(userDataDir, 'SingletonLock');
  try {
    const target = fs.readlinkSync(lockPath); // SingletonLock is a symlink to hostname-pid
    const pidMatch = target.match(/-(\d+)$/);
    if (pidMatch) {
      const pid = parseInt(pidMatch[1], 10);
      try {
        process.kill(pid, 0); // signal 0 = just check existence
        logger.warn(`[LockClean] Chrome PID ${pid} is still running with this profile — skipping lock cleanup`);
        return; // Chrome is alive, don't touch its locks
      } catch { /* PID doesn't exist — lock is stale, safe to clean */ }
    }
  } catch { /* lock doesn't exist or isn't a symlink — fine */ }

  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const file of lockFiles) {
    const filePath = path.join(userDataDir, file);
    try {
      fs.lstatSync(filePath);
      fs.unlinkSync(filePath);
      logger.info(`Removed stale lock file: ${file} from ${userDataDir}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Failed to remove lock file ${file}: ${err.message}`);
      }
    }
  }
}

// ============================================================
// CHROME PATH
// ============================================================

/** Get real Chrome executable path based on platform */
export function getRealChromePath(): string | null {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  if (process.platform === 'darwin') {
    const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(p)) return p;
  }
  if (process.platform === 'linux') {
    for (const p of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser']) {
      if (fs.existsSync(p)) return p;
    }
  }
  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Whether CDP mode is active (real Chrome via remote debugging) */
export function isCDPMode(): boolean {
  return !!(process.env.CHROME_CDP_URL);
}

// ============================================================
// KEEP-ALIVE
// ============================================================

/**
 * Keep-alive: only check if context is still alive, NO navigation.
 * Avoids sending regular requests to Google (easy bot detection).
 * Context Playwright persistent auto-refreshes OAuth token internally while in memory.
 * Real navigation only happens when scraping — that's the most natural behavior.
 */
export function startKeepAlive(adminId?: string): void {
  const key = adminId || '__default__';
  const existing = keepAliveTimers.get(key);
  if (existing) clearInterval(existing);

  const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000; // 30 min — check only, no navigate

  const timer = setInterval(async () => {
    try {
      if (scrapingInProgress.get(key)) return;
      const isLoginOpen = adminId ? loginBrowserOpenMap.get(adminId) : loginBrowserOpen;
      if (isLoginOpen) return;

      const sentinelExists = fs.existsSync(getSessionVerifiedFile(adminId));
      if (!sentinelExists) {
        const t = keepAliveTimers.get(key);
        if (t) { clearInterval(t); keepAliveTimers.delete(key); }
        logger.debug(`[KeepAlive] Sentinel gone for ${key} — stopping timer`);
        return;
      }

      const context = contexts.get(key);
      if (!context) {
        logger.info(`[KeepAlive] Context gone for ${key} — relaunching from saved profile...`);
        try {
          await getContext(true, adminId);
          logger.info(`[KeepAlive] Context restored for ${key}`);
        } catch (err: any) {
          logger.warn(`[KeepAlive] Failed to restore context for ${key}: ${err.message}`);
        }
        return;
      }

      logger.debug(`[KeepAlive] Context alive for ${key} — no action needed`);
    } catch (err: any) {
      logger.warn(`[KeepAlive] Error for ${key}: ${err.message}`);
    }
  }, KEEP_ALIVE_INTERVAL);

  keepAliveTimers.set(key, timer);
  logger.info(`[KeepAlive] Timer started for ${key} (check every ${KEEP_ALIVE_INTERVAL / 60000} min, no page visits)`);
}

export function stopKeepAlive(adminId?: string): void {
  const key = adminId || '__default__';
  const timer = keepAliveTimers.get(key);
  if (timer) {
    clearInterval(timer);
    keepAliveTimers.delete(key);
  }
}

// ============================================================
// HEADLESS CHROME CDP
// ============================================================

/**
 * Start Chrome headlessly with --remote-debugging-port for CDP scraping.
 * Called after login is verified — Chrome runs invisibly in background.
 * Session is read from user-data-dir so no re-login needed.
 */
export async function startHeadlessChrome(adminId?: string): Promise<boolean> {
  const realChrome = getRealChromePath();
  if (!realChrome) {
    logger.warn('[CDP] No real Chrome found — cannot start headless Chrome');
    return false;
  }

  const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
  const CDP_PORT = 9222;

  // Kill existing CDP process first
  if (cdpProcess) {
    try { cdpProcess.kill('SIGTERM'); } catch { /* ignore */ }
    setCdpProcess(null);
    await new Promise(r => setTimeout(r, 1500));
  }

  // Also kill any stale Chrome holding the SingletonLock on this profile.
  const lockPath = path.join(CHROME_USER_DATA_DIR, 'SingletonLock');
  try {
    const target = fs.readlinkSync(lockPath);
    const pidMatch = target.match(/-(\d+)$/);
    if (pidMatch) {
      const stalePid = parseInt(pidMatch[1], 10);
      try {
        process.kill(stalePid, 0); // check it's alive
        logger.info(`[CDP] Killing stale Chrome PID ${stalePid} holding SingletonLock...`);
        process.kill(stalePid, 'SIGTERM');
        await new Promise(r => setTimeout(r, 1000));
        try { process.kill(stalePid, 'SIGKILL'); } catch { /* already gone */ }
        await new Promise(r => setTimeout(r, 500));
      } catch { /* PID already dead — safe to proceed */ }
    }
  } catch { /* no lock file — clean start */ }

  // Remove stale lock files after killing the old process
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const lf of lockFiles) {
    try { fs.unlinkSync(path.join(CHROME_USER_DATA_DIR, lf)); } catch { /* ignore ENOENT */ }
  }

  const { spawn } = require('child_process');
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  const args = [
    `--user-data-dir=${CHROME_USER_DATA_DIR}`,
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    // Hide automation signals that Google uses to detect headless bots
    '--disable-blink-features=AutomationControlled',
    '--exclude-switches=enable-automation',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-client-side-phishing-detection',
    '--disable-hang-monitor',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-sync',
    '--metrics-recording-only',
    // On macOS: let Chrome use Keychain so it can decrypt cookies saved by regular Chrome.
    // On Linux/Windows: use basic store (no Keychain available).
    ...(isMac ? [] : ['--password-store=basic', '--use-mock-keychain']),
    ...(!isWin ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ];

  const child = spawn(realChrome, args, { stdio: 'ignore', detached: false });
  setCdpProcess(child);
  process.env.CHROME_CDP_URL = `http://localhost:${CDP_PORT}`;

  child.on('exit', (code: number | null) => {
    logger.info(`[CDP] Headless Chrome exited (code=${code})`);
    setCdpProcess(null);
    process.env.CHROME_CDP_URL = '';
    const key = adminId || '__default__';
    contexts.delete(key);
  });

  // Wait for Chrome to bind the debugging port
  await new Promise(r => setTimeout(r, 2500));
  logger.info(`[CDP] Headless Chrome started (pid=${child.pid}, port=${CDP_PORT}) — no window, full stealth`);
  return true;
}

// ============================================================
// GET CONTEXT
// ============================================================

/**
 * Get or create a Playwright persistent browser context.
 *
 * Key difference from Puppeteer:
 * - `launchPersistentContext(userDataDir)` persists EVERYTHING: cookies, localStorage,
 *   IndexedDB, service workers — no manual cookie save/load needed.
 * - Google's refresh tokens are stored in localStorage -> session survives browser restarts.
 *
 * @param headless - false = visible via Xvfb+VNC for login; true would be headless
 * @param adminId - Optional admin ID for per-admin Chrome profile
 */
export async function getContext(_headless: boolean = true, adminId?: string): Promise<BrowserContext> {
  const key = adminId || '__default__';

  // Reuse existing context if still open
  const existing = contexts.get(key);
  if (existing) {
    try {
      void existing.pages(); // just check context is still alive (sync check)
      return existing;
    } catch {
      contexts.delete(key);
    }
  }

  // -- CDP MODE: connect to real Chrome via remote debugging --
  const cdpUrl = process.env.CHROME_CDP_URL;
  if (cdpUrl) {
    logger.info(`[CDP] Connecting to real Chrome at ${cdpUrl}...`);
    try {
      const { chromium: pw } = require('playwright');
      const browser = await pw.connectOverCDP(cdpUrl, { timeout: 15000 });
      const ctxs = browser.contexts();
      const context: BrowserContext = ctxs.length > 0 ? ctxs[0] : await browser.newContext();

      // Minimize browser window
      try {
        const cdpSession = await browser.newBrowserCDPSession();
        const { targetInfos } = await cdpSession.send('Target.getTargets') as any;
        const pageTarget = (targetInfos as any[]).find((t: any) => t.type === 'page');
        if (pageTarget) {
          const { windowId } = await cdpSession.send('Browser.getWindowForTarget', { targetId: pageTarget.targetId }) as any;
          await cdpSession.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
        }
        await cdpSession.detach().catch(() => {});
      } catch { /* ignore */ }

      context.on('close', () => {
        contexts.delete(key);
        stopKeepAlive(adminId);
        logger.warn('[CDP] Chrome context closed — reconnect on next request');
      });

      contexts.set(key, context);
      startKeepAlive(adminId);
      // Patch navigator.webdriver so Google cannot detect automation
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      }).catch(() => {});
      logger.info('[CDP] Connected to real Chrome — session is native, no detection risk');

      // Inject pending cookies (saved by importCookies) — same as auto-CDP path
      const pendingFile = getPendingCookiesFile(adminId);
      if (fs.existsSync(pendingFile)) {
        try {
          const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf-8'));
          await context.addCookies(pending);
          fs.unlinkSync(pendingFile);
          logger.info(`[CDP] Injected ${pending.length} pending cookies into ${cdpUrl}`);
        } catch (cookieErr: any) {
          logger.warn(`[CDP] Failed to inject pending cookies: ${cookieErr.message}`);
        }
      }

      return context;
    } catch (err: any) {
      // GemLogin mode: auto reconnect if browser crashed
      try {
        const { GemLoginService } = await import('../../gemlogin/gemlogin.service');
        if (GemLoginService.getStatus().isRunning) {
          logger.warn(`[CDP] Connection failed at ${cdpUrl} — trying GemLogin reconnect...`);
          const newCdpUrl = await GemLoginService.reconnect();
          if (!newCdpUrl) throw new Error('Reconnect returned empty CDP URL');
          const { chromium: pw2 } = require('playwright');
          // Retry connectOverCDP up to 3 times — browser may need time to expose WebSocket
          let browser2: any;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              browser2 = await pw2.connectOverCDP(newCdpUrl, { timeout: 15000 });
              break;
            } catch (retryErr: any) {
              logger.warn(`[CDP] connectOverCDP attempt ${attempt}/3 failed: ${retryErr.message}`);
              if (attempt === 3) throw retryErr;
              await new Promise(r => setTimeout(r, 2000));
            }
          }
          const contexts2 = browser2.contexts();
          const context2: BrowserContext = contexts2.length > 0 ? contexts2[0] : await browser2.newContext();
          context2.on('close', () => { contexts.delete(key); stopKeepAlive(adminId); });
          contexts.set(key, context2);
          startKeepAlive(adminId);
          await context2.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          }).catch(() => {});
          logger.info(`[GemLogin] Reconnect succeeded at ${newCdpUrl}`);
          return context2;
        }
      } catch (reconnectErr: any) {
        logger.error(`[GemLogin] Reconnect failed: ${reconnectErr.message}`);
      }
      throw new Error(
        `[CDP] Cannot connect to Chrome at ${cdpUrl}. ` +
        `Make sure Chrome is running: use "Mo trinh duyet" to launch it. Error: ${err.message}`
      );
    }
  }

  // -- REAL CHROME via CDP (auto-start headless Chrome, then connect) --
  const realChromePath = getRealChromePath();
  if (realChromePath) {
    logger.info(`[Context] Real Chrome found — auto-starting headless CDP for admin ${adminId || 'default'}...`);
    const started = await startHeadlessChrome(adminId);
    if (started) {
      const autoCdpUrl = process.env.CHROME_CDP_URL;
      if (autoCdpUrl) {
        try {
          const { chromium: pw } = require('playwright');
          const browser = await pw.connectOverCDP(autoCdpUrl, { timeout: 15000 });
          const ctxs = browser.contexts();
          const context: BrowserContext = ctxs.length > 0 ? ctxs[0] : await browser.newContext();
          context.on('close', () => {
            contexts.delete(key);
            stopKeepAlive(adminId);
            logger.warn('[CDP] Chrome context closed — will restart on next request');
          });
          contexts.set(key, context);
          startKeepAlive(adminId);
          await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          }).catch(() => {});
          logger.info('[CDP] Auto-connected to headless real Chrome via CDP');

          // Inject pending cookies
          const pendingFile = getPendingCookiesFile(adminId);
          if (fs.existsSync(pendingFile)) {
            try {
              const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf-8'));
              await context.addCookies(pending);
              fs.unlinkSync(pendingFile);
              logger.info(`[CDP] Injected ${pending.length} pending cookies into real Chrome`);
            } catch (cookieErr: any) {
              logger.warn(`[CDP] Failed to inject pending cookies: ${cookieErr.message}`);
            }
          }

          return context;
        } catch (err: any) {
          logger.warn(`[CDP] Auto-connect failed: ${err.message} — killing CDP Chrome before Playwright fallback`);
          if (cdpProcess) {
            try { cdpProcess.kill('SIGTERM'); } catch { /* ignore */ }
            setCdpProcess(null);
          }
          process.env.CHROME_CDP_URL = '';
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
  }

  // -- PLAYWRIGHT CHROMIUM (fallback when no real Chrome) --
  const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
  cleanStaleLockFiles(CHROME_USER_DATA_DIR);
  fs.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });

  logger.info(`Launching Playwright Chromium for admin ${adminId || 'default'}...`);
  const context = await chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--password-store=basic',
      '--use-mock-keychain',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-translate',
      '--metrics-recording-only',
      '--disable-sync',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-software-rasterizer',
      '--js-flags=--max-old-space-size=512',
    ],
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    timeout: 1800000,
    ignoreHTTPSErrors: true,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    (window as any).chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
    try {
      const originalQuery = window.navigator.permissions.query.bind(navigator.permissions);
      (navigator.permissions as any).query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: (typeof Notification !== 'undefined' ? Notification.permission : 'default') } as PermissionStatus)
          : originalQuery(parameters);
    } catch { /* ignore */ }
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });

  context.on('close', () => {
    contexts.delete(key);
    stopKeepAlive(adminId);
  });

  contexts.set(key, context);
  startKeepAlive(adminId);
  return context;
}

// ============================================================
// CLOSE BROWSER
// ============================================================

/**
 * Close the browser context (and raw login Chromium if running)
 */
export async function closeBrowser(adminId?: string): Promise<void> {
  // Kill raw login Chromium process if running
  if (loginProcess) {
    try {
      loginProcess.kill('SIGTERM');
      logger.info('Raw login Chromium process killed');
    } catch { /* ignore */ }
    setLoginProcess(null);
  }

  // Kill VNC/noVNC processes if running
  try {
    const { execSync } = require('child_process');
    execSync('pkill -f x11vnc; pkill -f websockify', { stdio: 'ignore' });
    logger.info('VNC/noVNC processes stopped');
  } catch { /* ignore */ }

  const key = adminId || '__default__';
  if (adminId) {
    loginBrowserOpenMap.delete(adminId);
  } else {
    setLoginBrowserOpen(false);
  }
  stopKeepAlive(adminId);

  const context = contexts.get(key);
  if (context) {
    try {
      await context.close();
    } catch { /* ignore */ }
    contexts.delete(key);
  }
}

// ============================================================
// RESET SESSION
// ============================================================

/**
 * Reset session: close browser and delete the saved Chrome profile/session data
 */
export async function resetSession(adminId?: string): Promise<void> {
  await closeBrowser(adminId);
  const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);

  if (!fs.existsSync(CHROME_USER_DATA_DIR)) return;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await sleep(attempt * 500);
      fs.rmSync(CHROME_USER_DATA_DIR, { recursive: true, force: true });
      logger.info('Chrome session data deleted.');
      return;
    } catch (err) {
      lastError = err;
      logger.warn(`Attempt ${attempt} to delete chrome-data failed, retrying...`);
    }
  }
  throw lastError;
}

// ============================================================
// LOGIN BROWSER (headful via VNC) — RAW Chromium (no Playwright automation flags)
// ============================================================

/**
 * Open a RAW Chromium browser (NOT through Playwright) for manual Google login.
 */
export async function openLoginBrowser(
  adminId?: string
): Promise<{ message: string; vncUrl?: string }> {
  try {
    // Close any existing Playwright/CDP context AND any lingering Chrome processes
    await closeBrowser(adminId);
    if (cdpProcess) {
      try { cdpProcess.kill('SIGTERM'); } catch { /* ignore */ }
      setCdpProcess(null);
      process.env.CHROME_CDP_URL = '';
      await new Promise(r => setTimeout(r, 1000));
    }

    if (adminId) {
      loginBrowserOpenMap.set(adminId, true);
    } else {
      setLoginBrowserOpen(true);
    }

    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
    cleanStaleLockFiles(CHROME_USER_DATA_DIR);
    fs.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });

    // Prefer real Chrome (macOS/Linux), fall back to bundled Chromium
    const realChrome = getRealChromePath();
    const chromiumPath = realChrome || process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium';
    const isRealChrome = !!realChrome;

    logger.info(`[Login] Using browser: ${chromiumPath} (real Chrome: ${isRealChrome})`);

    // Base args — NO automation flags, NO remote debugging
    const args = [
      `--user-data-dir=${CHROME_USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
      '--window-size=1400,900',
      ...(isRealChrome ? [] : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--password-store=basic',
        '--use-mock-keychain',
      ]),
      'https://studio.youtube.com',
    ];

    const { spawn, exec } = require('child_process');

    // Launch raw Chromium
    const child = spawn(chromiumPath, args, {
      stdio: 'ignore',
      detached: false,
      env: { ...process.env },
    });

    setLoginProcess(child);

    child.on('exit', (code: number | null) => {
      logger.info(`Login Chromium exited (code=${code}) for admin ${adminId || 'default'}`);
      setLoginProcess(null);
      if (adminId) {
        loginBrowserOpenMap.delete(adminId);
      } else {
        setLoginBrowserOpen(false);
      }
      // Only auto-mark verified if NOT currently being verified by closeLoginAndVerify
      if (!verifyingSession) {
        if (fs.existsSync(path.join(CHROME_USER_DATA_DIR, 'Default', 'Cookies')) ||
            fs.existsSync(path.join(CHROME_USER_DATA_DIR, 'Default', 'Local State'))) {
          markSessionVerified(adminId);
          logger.info(`Session marked as verified for admin ${adminId || 'default'} after browser closed.`);
        }
      }
    });

    child.on('error', (err: any) => {
      logger.error(`Login Chromium spawn error: ${err.message}`);
      setLoginProcess(null);
      if (adminId) {
        loginBrowserOpenMap.delete(adminId);
      } else {
        setLoginBrowserOpen(false);
      }
    });

    loginOpenedAtMap.set(adminId || '__default__', Date.now());

    logger.info(
      `Opened RAW Chromium (no automation flags) for login (admin: ${adminId || 'default'}, pid: ${child.pid}).`
    );

    // Start x11vnc + noVNC so user can see and control Chrome via web browser
    try {
      const xDisplay = process.env.DISPLAY || ':99';
      logger.info(`Starting VNC on display ${xDisplay}`);
      exec('pkill -f x11vnc; pkill -f websockify', () => {
        exec(
          `x11vnc -display ${xDisplay} -nopw -listen 0.0.0.0 -xkb -ncache 10 -forever -shared &`,
          (err: any) => {
            if (err) {
              logger.warn(`Failed to start x11vnc: ${err.message}`);
            } else {
              logger.info(`x11vnc started on :5900 (sharing Xvfb display ${xDisplay})`);
            }
          }
        );
        setTimeout(() => {
          exec(
            'websockify --web /usr/share/novnc 6080 localhost:5900 &',
            (err: any) => {
              if (err) {
                logger.warn(`Failed to start noVNC: ${err.message}`);
              } else {
                logger.info('noVNC started on port 6080');
              }
            }
          );
        }, 1000);
      });
    } catch (err: any) {
      logger.warn(`noVNC not available: ${err.message}`);
    }

    return {
      message:
        'Browser da mo (khong co automation flags). Truy cap VNC de dang nhap YouTube Studio.',
      vncUrl: 'http://46.62.170.132:6080/vnc.html',
    };
  } catch (error) {
    if (adminId) {
      loginBrowserOpenMap.delete(adminId);
    } else {
      setLoginBrowserOpen(false);
    }
    logger.error('Failed to open login browser:', error);
    throw error;
  }
}

// ============================================================
// SESSION INIT
// ============================================================

/**
 * On server startup: scan chrome-data for existing sessions and log them.
 */
export async function initializePersistentSessions(): Promise<void> {
  logger.info('[Session Init] Scanning for existing YouTube sessions...');
  const found: Array<string | undefined> = [];

  if (hasValidSession(undefined)) {
    found.push(undefined);
  }

  if (fs.existsSync(CHROME_DATA_BASE_DIR)) {
    try {
      const entries = fs.readdirSync(CHROME_DATA_BASE_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const aid = entry.name;
        if (hasValidSession(aid)) {
          found.push(aid);
        }
      }
    } catch (err: any) {
      logger.warn(`[Session Init] Error scanning sessions: ${err.message}`);
    }
  }

  if (found.length === 0) {
    logger.info('[Session Init] No existing sessions found.');
    return;
  }

  logger.info(`[Session Init] Found ${found.length} saved session(s): ${found.map((a) => a || 'default').join(', ')}.`);

  for (const aid of found) {
    startKeepAlive(aid);
    logger.info(`[Session Init] Keep-alive started for ${aid || 'default'}`);
  }
}

// ============================================================
// WINDOW HELPERS
// ============================================================

/**
 * Minimize the GemLogin Chrome window so it stays in the background.
 */
export async function minimizeWindow(adminId?: string): Promise<void> {
  try {
    const key = adminId || '__default__';
    const context = contexts.get(key);
    if (!context) return;
    const browser = (context as any).browser?.();
    if (!browser) return;
    const cdpSession = await browser.newBrowserCDPSession();
    const { targetInfos } = await cdpSession.send('Target.getTargets') as any;
    const pageTarget = (targetInfos as any[]).find((t: any) => t.type === 'page');
    if (pageTarget) {
      const { windowId } = await cdpSession.send('Browser.getWindowForTarget', { targetId: pageTarget.targetId }) as any;
      await cdpSession.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
    }
    await cdpSession.detach().catch(() => {});
  } catch { /* ignore — CDP not available or not supported */ }
}

// ============================================================
// SHARED SESSION HELPERS (used by both browser-context and session-manager)
// ============================================================

/**
 * Check if session exists without opening browser
 */
export function hasValidSession(adminId?: string): boolean {
  const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
  if (fs.existsSync(SESSION_VERIFIED_FILE)) {
    logger.info(`Valid session for admin ${adminId || 'default'} (sentinel present)`);
    return true;
  }
  logger.info(`No valid session for admin ${adminId || 'default'} (sentinel missing)`);
  return false;
}

/**
 * Write the session-verified sentinel file to mark a confirmed login
 */
export function markSessionVerified(adminId?: string): void {
  try {
    const dir = getChromeUserDataDir(adminId);
    const file = getSessionVerifiedFile(adminId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, new Date().toISOString());
    if (adminId) {
      sessionVerifiedAtMap.set(adminId, Date.now());
      lastRealVerifyMap.set(adminId, Date.now());
    }
    logger.info(`Session marked as verified for admin ${adminId || 'default'}.`);
  } catch { /* ignore */ }
}
