/**
 * Shared mutable state for YouTube scraper subsystem.
 * All modules (browser-context, session-manager, scrape-revenue) read/write from here.
 */
import { BrowserContext } from 'playwright';

/** Per-admin persistent browser contexts */
export const contexts: Map<string, BrowserContext> = new Map();

/** Per-admin login browser open flags */
export const loginBrowserOpenMap: Map<string, boolean> = new Map();

/** Legacy flag */
export let loginBrowserOpen: boolean = false;
export function setLoginBrowserOpen(v: boolean) { loginBrowserOpen = v; }

/** Throttle session-expired email alerts — track last sent time per adminId */
export const lastAlertSentAt: Map<string, number> = new Map();

/** Per-admin session verified timestamps */
export const sessionVerifiedAtMap: Map<string, number> = new Map();

/** Per-admin keep-alive interval timers */
export const keepAliveTimers: Map<string, NodeJS.Timeout> = new Map();

/** Per-admin last real session verification timestamp */
export const lastRealVerifyMap: Map<string, number> = new Map();

/** Track when login browser was opened (per admin) */
export const loginOpenedAtMap: Map<string, number> = new Map();

/** Flag to prevent concurrent session verifications */
export let verifyingSession: boolean = false;
export function setVerifyingSession(v: boolean) { verifyingSession = v; }

/** Track the headless Chrome CDP process */
export let cdpProcess: import('child_process').ChildProcess | null = null;
export function setCdpProcess(v: import('child_process').ChildProcess | null) { cdpProcess = v; }

/** Flag to pause KeepAlive during batch scraping */
export const scrapingInProgress: Map<string, boolean> = new Map();

/** Track the raw Chromium child process used for login */
export let loginProcess: import('child_process').ChildProcess | null = null;
export function setLoginProcess(v: import('child_process').ChildProcess | null) { loginProcess = v; }
