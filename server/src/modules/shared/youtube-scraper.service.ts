/**
 * YouTubeScraperService — facade that delegates to yt-scraper/ submodules.
 * Session/cookie management removed — using GemLogin profiles.
 */
import { BrowserContext } from 'playwright';

export type { Page } from 'playwright';
export type { YouTubeAnalyticsData, RevenueByCountry } from './yt-scraper/types';

import {
  getContext,
  closeBrowser,
  resetSession,
  isCDPMode,
  hasValidSession,
  scrapeAnalytics,
  scrapeMultipleChannels,
  scrapeMultipleChannelsParallel,
  cleanChannelId,
  scrapingInProgress,
} from './yt-scraper';

export class YouTubeScraperService {
  static isAnyScrapingActive(): boolean {
    return Array.from(scrapingInProgress.values()).some(Boolean);
  }

  static hasValidSession(adminId?: string): boolean {
    return hasValidSession(adminId);
  }

  static isCDPMode(): boolean {
    return isCDPMode();
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

  // Stubs for removed session methods (callers still reference these)
  static async markSessionDisconnected(..._args: any[]): Promise<void> {}
  static async openLoginBrowser(_adminId?: string) { return { message: 'Use GemLogin' }; }
  static async initializePersistentSessions(): Promise<void> {}
  static async minimizeWindow(_adminId?: string): Promise<void> {}
  static encryptPassword(p: string) { return p; }
  static decryptPassword(p: string) { return p; }

  static cleanChannelId(raw: string): string {
    return cleanChannelId(raw);
  }

  static async scrapeAnalytics(channelId: string, month?: string, adminId?: string) {
    return scrapeAnalytics(channelId, month, adminId);
  }

  static async scrapeMultipleChannels(
    channelIds: string[],
    month?: string,
    onProgress?: (channelId: string, index: number, total: number) => void,
    adminId?: string,
    channelLabels?: Map<string, string>
  ) {
    return scrapeMultipleChannels(channelIds, month, onProgress, adminId, channelLabels);
  }

  static async scrapeMultipleChannelsParallel(
    channelIds: string[],
    month?: string,
    onProgress?: (channelId: string, index: number, total: number) => void,
    adminId?: string,
    batchSize?: number,
    waitMs?: number,
  ) {
    return scrapeMultipleChannelsParallel(channelIds, month, onProgress, adminId, batchSize, waitMs);
  }
}
