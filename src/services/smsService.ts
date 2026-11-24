/**
 * Provider-independent SMS boundary for OPHEA.
 * No provider is selected or contacted until OPHEA purchases/configures one.
 * Provider adapters can implement SmsProvider without changing application flows.
 */
export type SmsDeliveryStatus = 'sent' | 'failed' | 'not_configured';

export interface SmsSendResult {
  success: boolean;
  status: SmsDeliveryStatus;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, message: string): Promise<{ messageId?: string }>;
}

const SMS_TEMPLATES = [
  { key: 'registration_received', label: 'Registration received', message: 'Dear {{fullName}}, your OPHEA membership application {{memberNo}} has been received and is pending review.' },
  { key: 'registration_approved', label: 'Registration approved', message: 'Congratulations {{fullName}}! Your OPHEA membership application {{memberNo}} has been approved.' },
  { key: 'payment_received', label: 'Payment received', message: 'Dear {{fullName}}, OPHEA received your contribution of {{amount}} ETB. Receipt: {{receiptNo}}.' },
  { key: 'payment_reminder', label: 'Payment reminder', message: 'Dear {{fullName}}, your OPHEA contribution is due. Please contact the office for payment details.' },
  { key: 'otp', label: 'Phone verification code', message: 'Your OPHEA verification code is {{code}}. It expires in {{minutes}} minutes.' },
];

class SmsService {
  // Deliberately unconfigured. A purchased provider adapter will be injected here later.
  private provider: SmsProvider | null = null;

  public configureProvider(provider: SmsProvider | null) {
    this.provider = provider;
  }

  public getStatus() {
    return {
      configured: Boolean(this.provider),
      enabled: Boolean(this.provider) && process.env.FEATURE_SMS === 'true',
      provider: this.provider?.name || 'Not configured',
      featureEnabled: process.env.FEATURE_SMS === 'true',
      message: this.provider
        ? 'An SMS provider is configured.'
        : 'No SMS provider has been purchased or configured. Messages are not sent.',
    };
  }

  public isEnabled(): boolean {
    return Boolean(this.provider) && process.env.FEATURE_SMS === 'true';
  }

  public getTemplates() {
    return SMS_TEMPLATES;
  }

  public async sendSms(_to: string, _message: string): Promise<SmsSendResult> {
    if (!this.isEnabled() || !this.provider) {
      return {
        success: false,
        status: 'not_configured',
        error: 'SMS is not available yet. Configure a purchased SMS provider before sending messages.',
      };
    }

    try {
      const result = await this.provider.send(_to, _message);
      return { success: true, status: 'sent', messageId: result.messageId };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'SMS provider delivery failed',
      };
    }
  }
}

export const smsService = new SmsService();
