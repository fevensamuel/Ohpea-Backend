/**
 * Nodemailer Email Service
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { t } from '../translations.js';
import { SupportedLanguage } from '../types.js';

export class EmailService {
  private transporter: Transporter | null = null;
  private from: string;
  private enabled: boolean;

  constructor() {
    this.from = process.env.SMTP_FROM || 'OHPEA <no-reply@ohpea.org>';
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;

    this.enabled = Boolean(host && user);

    if (this.enabled && host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
    }
  }

  private async sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      console.log(`[EmailService Simulated] To: ${to} | Subject: ${subject}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html: html || `<p>${text.replace(/\n/g, '<br/>')}</p>`,
      });
      return true;
    } catch (err: any) {
      console.error('[EmailService] Failed to send email:', err?.message || err);
      return false;
    }
  }

  public async sendOtpEmail(to: string, code: string, minutes: number, lang: SupportedLanguage = 'en'): Promise<boolean> {
    const subject = t('otp.subject', lang);
    const body = t('otp.emailBody', lang, { code, minutes });
    return this.sendMail(to, subject, body);
  }

  public async sendRegistrationReceived(
    to: string,
    fullName: string,
    memberNo: string,
    lang: SupportedLanguage = 'en'
  ): Promise<boolean> {
    const subject = t('registration.receivedSubject', lang);
    const body = t('registration.receivedBody', lang, { fullName, memberNo });
    return this.sendMail(to, subject, body);
  }

  public async sendApprovalEmail(
    to: string,
    fullName: string,
    memberNo: string,
    lang: SupportedLanguage = 'en'
  ): Promise<boolean> {
    const subject = t('registration.approvedSubject', lang);
    const body = t('registration.approvedBody', lang, { fullName, memberNo });
    return this.sendMail(to, subject, body);
  }

  public async sendRejectionEmail(
    to: string,
    fullName: string,
    reason: string,
    lang: SupportedLanguage = 'en'
  ): Promise<boolean> {
    const subject = t('registration.rejectedSubject', lang);
    const body = t('registration.rejectedBody', lang, { fullName, reason });
    return this.sendMail(to, subject, body);
  }

  public async sendReceiptEmail(
    to: string,
    fullName: string,
    receiptNo: string,
    amount: number,
    period: string,
    lang: SupportedLanguage = 'en'
  ): Promise<boolean> {
    const subject = t('payment.receiptSubject', lang, { receiptNo });
    const body = t('payment.receiptBody', lang, { fullName, receiptNo, amount, period });
    return this.sendMail(to, subject, body);
  }
}

export const emailService = new EmailService();
