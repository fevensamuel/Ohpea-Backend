/**
 * SMS Campaign Service with Audience Targeting and Template Variable Replacement
 */

import { smsService } from './smsService.js';
import { dbOperations } from '../backend/database.js';

interface CampaignInput {
  name: string;
  message: string;
  audienceFilter: {
    regionId?: string;
    sectorId?: string;
    membershipStatus?: string;
    gender?: string;
  };
  scheduledAt?: string;
  createdBy: string;
}

export class SmsCampaignService {
  private isProcessing = false;

  public async createCampaign(input: CampaignInput): Promise<{ id: string; targetCount: number }> {
    const members = await dbOperations.getMembersForCampaign(input.audienceFilter);
    const campaignId = await dbOperations.createSmsCampaign({
      name: input.name,
      message: input.message,
      audienceFilter: input.audienceFilter,
      scheduledAt: input.scheduledAt,
      createdBy: input.createdBy,
      totals: {
        targetCount: members.length,
        sentCount: 0,
        failedCount: 0,
      },
    });

    // Keep campaigns safely staged until a real provider is configured.
    if (smsService.isEnabled() && (!input.scheduledAt || new Date(input.scheduledAt) <= new Date())) {
      setTimeout(() => this.processCampaign(campaignId), 100);
    } else if (!smsService.isEnabled()) {
      await dbOperations.updateSmsCampaignStatus(campaignId, 'waiting_for_provider');
    }

    return { id: campaignId, targetCount: members.length };
  }

  public async processCampaign(campaignId: string): Promise<void> {
    const campaign = await dbOperations.getSmsCampaignById(campaignId);
    if (!campaign || campaign.status === 'sent' || campaign.status === 'sending' || !smsService.isEnabled()) {
      return;
    }

    await dbOperations.updateSmsCampaignStatus(campaignId, 'sending');
    const members = await dbOperations.getMembersForCampaign(campaign.audienceFilter || {});

    let sent = 0;
    let failed = 0;

    for (const member of members) {
      if (!member.phone) continue;

      let personalizedMessage = campaign.message
        .replace(/{{fullName}}/g, member.fullName || 'Member')
        .replace(/{{memberNo}}/g, member.memberNo || '')
        .replace(/{{amountDue}}/g, '');

      const result = await smsService.sendSms(member.phone, personalizedMessage);
      if (result.success) {
        sent += 1;
        await dbOperations.createSmsLog({
          campaignId,
          memberId: member.id,
          phone: member.phone,
          message: personalizedMessage,
          status: result.status,
          providerMessageId: result.messageId,
          sentAt: new Date().toISOString(),
        });
      } else {
        failed += 1;
        await dbOperations.createSmsLog({
          campaignId,
          memberId: member.id,
          phone: member.phone,
          message: personalizedMessage,
          status: result.status,
          error: result.error,
          sentAt: new Date().toISOString(),
        });
      }
    }

    await dbOperations.updateSmsCampaignStatus(campaignId, failed > 0 && sent === 0 ? 'failed' : 'sent', {
      targetCount: members.length,
      sentCount: sent,
      failedCount: failed,
    });
  }

  public startSmsScheduler(): void {
    setInterval(async () => {
      if (this.isProcessing) return;
      try {
        this.isProcessing = true;
        const dueCampaigns = await dbOperations.getDueScheduledSmsCampaigns();
        for (const c of dueCampaigns) {
          await this.processCampaign(c.id);
        }
      } catch (err) {
        // Scheduler loop
      } finally {
        this.isProcessing = false;
      }
    }, 60 * 1000);
  }
}

export const smsCampaignService = new SmsCampaignService();
