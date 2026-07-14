import type { BusinessSource, EmailSender } from "../ports/outreach.js";
import type { OutreachCampaign, OutreachLead } from "../domain/model.js";
import type { OutreachRepository } from "../infrastructure/database/repositories.js";
import { AppError, errorMessage } from "../shared/errors.js";

export class DiscoverOutreachLeads {
  public constructor(
    private readonly outreach: OutreachRepository,
    private readonly source: BusinessSource,
  ) {}

  public async execute(
    campaign: OutreachCampaign,
    limit: number,
  ): Promise<readonly OutreachLead[]> {
    if (campaign.state !== "draft" && campaign.state !== "approved") {
      throw new AppError(
        `Cannot discover leads for a ${campaign.state} campaign`,
        "CAMPAIGN_STATE_INVALID",
      );
    }
    const leads = await this.source.discover(campaign.niche, limit);
    return this.outreach.addLeads(campaign.id, leads);
  }
}

export interface OutreachRunResult {
  sent: number;
  failed: number;
  skipped: number;
}

export interface RunOutreachCampaignOptions {
  sendingEnabled: boolean;
  sendDelayMs: number;
}

export class RunOutreachCampaign {
  public constructor(
    private readonly outreach: OutreachRepository,
    private readonly sender: EmailSender,
    private readonly options: RunOutreachCampaignOptions,
  ) {}

  public async execute(campaign: OutreachCampaign): Promise<OutreachRunResult> {
    if (!this.options.sendingEnabled) {
      throw new AppError(
        "Outreach sending is disabled; use preview until safety.outreachSending is enabled",
        "OUTREACH_SENDING_DISABLED",
      );
    }
    if (campaign.state !== "approved" || campaign.approvedAt === null) {
      throw new AppError(
        "Campaign must be explicitly approved before sending",
        "CAMPAIGN_NOT_APPROVED",
      );
    }

    this.outreach.setCampaignState(campaign.id, "running");
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    let remaining = Math.max(
      0,
      campaign.dailyLimit - this.outreach.sentSince(campaign.id, startOfDay),
    );
    const domainCounts = new Map<string, number>();
    const result: OutreachRunResult = { sent: 0, failed: 0, skipped: 0 };

    for (const lead of this.outreach.eligibleLeads(campaign.id)) {
      const domainCount = domainCounts.get(lead.domain) ?? 0;
      if (remaining === 0 || domainCount >= campaign.perDomainLimit) {
        result.skipped += 1;
        continue;
      }
      const attempt = this.outreach.startAttempt(campaign.id, lead.id);
      try {
        const delivery = await this.sender.send({
          to: lead.email,
          subject: this.render(campaign.subject, lead),
          html: this.render(campaign.bodyTemplate, lead),
          idempotencyKey: `outreach:${campaign.id}:${lead.id}`,
        });
        this.outreach.finishAttempt(
          attempt.id,
          "sent",
          delivery.messageId,
          null,
        );
        result.sent += 1;
        remaining -= 1;
        domainCounts.set(lead.domain, domainCount + 1);
      } catch (error) {
        this.outreach.finishAttempt(
          attempt.id,
          "failed",
          null,
          errorMessage(error),
        );
        result.failed += 1;
      }
      if (this.options.sendDelayMs > 0 && remaining > 0) {
        await new Promise<void>((resolveDelay) =>
          setTimeout(resolveDelay, this.options.sendDelayMs),
        );
      }
    }

    this.outreach.setCampaignState(
      campaign.id,
      result.failed === 0 ? "completed" : "approved",
    );
    return result;
  }

  private render(template: string, lead: OutreachLead): string {
    return template
      .replaceAll("{{businessName}}", this.escapeHtml(lead.businessName))
      .replaceAll("{{websiteUrl}}", this.escapeHtml(lead.websiteUrl));
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
