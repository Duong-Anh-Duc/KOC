import nodemailer from 'nodemailer';
interface RevenueEmailData {
    kocName: string;
    channelName: string;
    month: string;
    originalRevenue: number;
    usTaxDeduction: number;
    bankFee: number;
    netRevenue: number;
    companyShare: number;
    kocReceiveUsd: number;
    kocReceiveVnd: number;
    exchangeRate: number;
    baseRate: number;
    status: string;
}
interface EmailConfig {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
    fromName: string;
    fromEmail: string;
    /** Auto-send email after cron completes */
    autoSendAfterCron: boolean;
}
export declare class EmailService {
    /**
     * Get email configuration from DB or defaults
     */
    static getConfig(): Promise<EmailConfig>;
    /**
     * Update email configuration
     */
    static updateConfig(newConfig: Partial<EmailConfig>): Promise<EmailConfig>;
    /**
     * Create a nodemailer transporter from the current config
     */
    static createTransporter(): Promise<nodemailer.Transporter<import("nodemailer/lib/smtp-transport").SentMessageInfo, import("nodemailer/lib/smtp-transport").Options>>;
    /**
     * Send a test email
     */
    static sendTestEmail(toEmail: string): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * Alert admin when YouTube Studio session expires
     */
    static sendSessionExpiredAlert(adminEmail: string, retries?: number): Promise<void>;
    /**
     * Send revenue report email to a single KOC
     */
    static sendRevenueEmail(toEmail: string, data: RevenueEmailData): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * Send revenue emails to all KOCs for a specific cycle month
     * Returns summary of sent/failed
     */
    static sendAllRevenueEmails(month: string, adminId?: string, onProgress?: (step: number, total: number, kocName: string) => void): Promise<{
        sent: Array<{
            kocId: string;
            kocName: string;
            email: string;
        }>;
        failed: Array<{
            kocId: string;
            kocName: string;
            email: string;
            error: string;
        }>;
        skipped: Array<{
            kocId: string;
            kocName: string;
            reason: string;
        }>;
    }>;
}
export {};
//# sourceMappingURL=email.service.d.ts.map