/**
 * Chrome profile directory helpers.
 * Shared by browser-context, session-manager, and scrape-revenue modules.
 */
import fs from 'fs';
import path from 'path';

// Base directory for Chrome profiles - each admin gets their own sub-directory
export const CHROME_DATA_BASE_DIR = path.join(process.cwd(), '.chrome-data');

/**
 * Get system Chrome profile path (macOS/Linux/Windows).
 * Used when CHROME_USE_SYSTEM_PROFILE=true — no login needed, session from real Chrome.
 */
export function getSystemChromeProfileDir(): string | null {
  if (process.env.CHROME_USER_DATA_DIR) return process.env.CHROME_USER_DATA_DIR;
  if (process.platform === 'darwin') {
    return path.join(process.env.HOME || '', 'Library/Application Support/Google/Chrome');
  }
  if (process.platform === 'linux') {
    return path.join(process.env.HOME || '', '.config/google-chrome');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\User Data');
  }
  return null;
}

/** Get per-admin Chrome profile directory */
export function getChromeUserDataDir(adminId?: string): string {
  // If system profile mode is enabled, use the real Chrome profile (already logged in)
  if (process.env.CHROME_USE_SYSTEM_PROFILE === 'true') {
    const sysProfile = getSystemChromeProfileDir();
    if (sysProfile) return sysProfile;
  }
  if (adminId) {
    return path.join(CHROME_DATA_BASE_DIR, adminId);
  }
  return CHROME_DATA_BASE_DIR;
}

/** Get per-admin account info file */
export function getAccountInfoFile(adminId?: string): string {
  return path.join(getChromeUserDataDir(adminId), 'account-info.json');
}

/** Get per-admin session verified sentinel file */
export function getSessionVerifiedFile(adminId?: string): string {
  return path.join(getChromeUserDataDir(adminId), 'session-verified');
}

/**
 * Plaintext cookie cache — written by importCookies (Playwright Chromium),
 * read by getContext() to re-inject into real Chrome via CDP.
 * Needed because Playwright Chromium and real Chrome use different cookie encryption keys.
 */
export function getPendingCookiesFile(adminId?: string): string {
  return path.join(getChromeUserDataDir(adminId), 'yt-cookies.json');
}
