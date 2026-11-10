import Afromessage from 'afromessage';

export class AfroSmsService {
  private client: Afromessage | null = null;
  private token: string;
  private identifierId: string;
  private senderName: string;
  private enabled: boolean;

  constructor() {
    this.token = process.env.AFROMESSAGE_TOKEN || '';
    this.identifierId = process.env.AFROMESSAGE_IDENTIFIER_ID || '';
    this.senderName = process.env.AFROMESSAGE_SENDER_NAME || 'OHPEA';
    this.enabled = process.env.FEATURE_SMS === 'true' && Boolean(this.token);

    if (this.token) {
      try {
        this.client = Afromessage.getInstance({
          apiKey: this.token,
          senderName: this.senderName,
          identifierId: this.identifierId,
        });
      } catch (err) {
        console.warn('[AfroSmsService] Could not initialize AfroMessage client:', (err as Error).message);
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  public async sendSms(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.enabled || !this.client) {
      console.log(`[AfroSmsService Simulated] To: ${to} | Message: ${message}`);
      return { success: true, messageId: `sim-${Date.now()}` };
    }

    try {
      const response = await this.client.sendSms({
        to,
        message,
        from: this.senderName,
      });
      return {
        success: true,
        messageId: (response as any)?.response?.id || (response as any)?.id || 'delivered',
      };
    } catch (err: any) {
      console.error('[AfroSmsService] Error sending SMS:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'Failed to dispatch SMS via AfroMessage',
      };
    }
  }

  public async getBalance(): Promise<{ balance: number | string; currency: string }> {
    return {
      balance: this.enabled ? 'Active Account' : 1000,
      currency: 'ETB',
    };
  }
}

export const afroSmsService = new AfroSmsService();
