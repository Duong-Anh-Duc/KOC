/**
 * YouTubeScraperService — facade that delegates to yt-scraper/ submodules.
 *
 * All public static methods remain accessible from this file so that
 * existing imports throughout the codebase continue to work unchanged.
 */
import { BrowserContext, Page } from 'playwright';

// Re-export Page type so socialblade.service.ts can import from here if needed
export type { Page } from 'playwright';

// Re-export interfaces so consumers can import them from this path
export type { YouTubeAnalyticsData, RevenueByCountry } from './yt-scraper/types';

import {
  // Browser context
  getContext,
  closeBrowser,
  resetSession,
  openLoginBrowser,
  startHeadlessChrome,
  getRealChromePath,
  isCDPMode,
  initializePersistentSessions,
  hasValidSession,
  markSessionVerified,
  minimizeWindow,
  // Session management
  markSessionDisconnected,
  encryptPassword,
  decryptPassword,
  extractAndCacheAccountInfo,
  checkLoginStatus,
  openVerifyTab,
  closeLoginAndVerify,
  syncFromChrome,
  importCookies,
  // Revenue scraping
  scrapeAnalytics,
  scrapeMultipleChannels,
  scrapeMultipleChannelsParallel,
  cleanChannelId,
  // Shared state
  scrapingInProgress,
} from './yt-scraper';

export class YouTubeScraperService {
  /** Used by other services (e.g. exchange rate) to avoid launching concurrent Chromium instances */
  static isAnyScrapingActive(): boolean {
    return Array.from(scrapingInProgress.values()).some(Boolean);
  }

  // ============================================================
  // SESSION CHECKS
  // ============================================================

  static hasValidSession(adminId?: string): boolean {
    return hasValidSession(adminId);
  }

  static async markSessionDisconnected(reason: string, url?: string, adminId?: string, extra?: Record<string, unknown>): Promise<void> {
    return markSessionDisconnected(reason, url, adminId, extra);
  }

  // ============================================================
  // CREDENTIAL ENCRYPTION
  // ============================================================

  static encryptPassword(plaintext: string): string {
    return encryptPassword(plaintext);
  }

  static decryptPassword(encryptedText: string): string {
    return decryptPassword(encryptedText);
  }

  // ============================================================
  // BROWSER CONTEXT MANAGEMENT
  // ============================================================

  static getRealChromePath(): string | null {
    return getRealChromePath();
  }

  static isCDPMode(): boolean {
    return isCDPMode();
  }

  static async startHeadlessChrome(adminId?: string): Promise<boolean> {
    return startHeadlessChrome(adminId);
  }

  static async openVerifyTab(adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    return openVerifyTab(adminId);
  }

  static async getContext(_headless: boolean = true, adminId?: string): Promise<BrowserContext> {
    return getContext(_headless, adminId);
  }

  static async closeBrowser(adminId?: string): Promise<void> {
    return closeBrowser(adminId);
  }

  static async resetSession(adminId?: string): Promise<void> {
    return resetSession(adminId);
  }

  static async openLoginBrowser(adminId?: string): Promise<{ message: string; vncUrl?: string }> {
    return openLoginBrowser(adminId);
  }

  static async initializePersistentSessions(): Promise<void> {
    return initializePersistentSessions();
  }

  static async minimizeWindow(adminId?: string): Promise<void> {
    return minimizeWindow(adminId);
  }

  // ============================================================
  // ACCOUNT INFO & LOGIN STATUS
  // ============================================================

  static async extractAndCacheAccountInfo(adminId?: string): Promise<{ channelName?: string; email?: string }> {
    return extractAndCacheAccountInfo(adminId);
  }

  static async checkLoginStatus(adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string; loginBrowserOpen?: boolean }> {
    return checkLoginStatus(adminId);
  }

  // ============================================================
  // LOGIN VERIFICATION
  // ============================================================

  static async closeLoginAndVerify(adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string; loginBrowserOpen?: boolean }> {
    return closeLoginAndVerify(adminId);
  }

  // ============================================================
  // COOKIE IMPORT
  // ============================================================

  static async syncFromChrome(cdpUrl?: string, adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    return syncFromChrome(cdpUrl, adminId);
  }

  static async importCookies(
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
    return importCookies(cookies, adminId);
  }

  // ============================================================
  // URL / CHANNEL HELPERS
  // ============================================================

  static cleanChannelId(raw: string): string {
    return cleanChannelId(raw);
  }

  // ============================================================
  // SCRAPING
  // ============================================================

  static async scrapeAnalytics(channelId: string, month?: string, adminId?: string): Promise<import('./yt-scraper/types').YouTubeAnalyticsData> {
    return scrapeAnalytics(channelId, month, adminId);
  }

  static async scrapeMultipleChannels(
    channelIds: string[],
    month?: string,
    onProgress?: (channelId: string, index: number, total: number) => void,
    adminId?: string,
    channelLabels?: Map<string, string>
  ): Promise<{
    results: import('./yt-scraper/types').YouTubeAnalyticsData[];
    errors: Array<{ channelId: string; error: string }>;
  }> {
    return scrapeMultipleChannels(channelIds, month, onProgress, adminId, channelLabels);
  }

  static async scrapeMultipleChannelsParallel(
    channelIds: string[],
    month?: string,
    onProgress?: (channelId: string, index: number, total: number) => void,
    adminId?: string,
    batchSize?: number,
    waitMs?: number,
  ): Promise<{
    results: import('./yt-scraper/types').YouTubeAnalyticsData[];
    errors: Array<{ channelId: string; error: string }>;
  }> {
    return scrapeMultipleChannelsParallel(channelIds, month, onProgress, adminId, batchSize, waitMs);
  }
}
