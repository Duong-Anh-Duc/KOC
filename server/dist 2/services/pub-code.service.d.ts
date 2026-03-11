export interface PubCodeVerificationResult {
    kocId: string;
    channelId: string;
    kocName: string;
    storedPubCode: string | null;
    scrapedPubCode: string | null;
    matched: boolean | null;
    error?: string;
}
export declare class PubCodeService {
    /**
     * Build the monetization overview URL for a channel
     */
    static buildMonetizationUrl(channelId: string): string;
    /**
     * Scrape the pub code from YouTube Studio monetization page
     * Looks for pattern: "pub-XXXXXXXXXXXXX"
     */
    static scrapePubCode(channelId: string, adminId?: string): Promise<string | null>;
    /**
     * Verify pub code for a single KOC
     */
    static verifyKOCPubCode(kocId: string, adminId?: string): Promise<PubCodeVerificationResult>;
    /**
     * Verify pub codes for all active KOCs
     */
    static verifyAllPubCodes(adminId?: string): Promise<{
        results: PubCodeVerificationResult[];
        summary: {
            total: number;
            matched: number;
            mismatched: number;
            noData: number;
            errors: number;
        };
    }>;
}
//# sourceMappingURL=pub-code.service.d.ts.map