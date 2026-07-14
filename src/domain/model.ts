export const platforms = [
  "youtube",
  "twitter",
  "bluesky",
  "linkedin",
  "tiktok",
  "instagram",
  "facebook",
] as const;

export type Platform = (typeof platforms)[number];

export type ContentKind =
  "youtube-short" | "twitter-post" | "social-post" | "affiliate-pitch";

export type ContentState =
  "draft" | "generating" | "ready" | "publishing" | "published" | "failed";

export type JobState =
  "queued" | "running" | "succeeded" | "failed" | "retrying" | "canceled";

export interface Account {
  id: string;
  platform: Platform;
  nickname: string;
  niche: string;
  language: string;
  browserProfilePath: string | null;
  configuration: Readonly<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

export interface NewAccount {
  id?: string;
  platform: Platform;
  nickname: string;
  niche: string;
  language: string;
  browserProfilePath?: string | null;
  configuration?: Readonly<Record<string, unknown>>;
}

export type AccountConnectionState =
  "connected" | "expired" | "revoked" | "error";

export interface AccountConnection {
  accountId: string;
  platform: Platform;
  state: AccountConnectionState;
  externalAccountId: string | null;
  displayName: string | null;
  scopes: readonly string[];
  expiresAt: string | null;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentItem {
  id: string;
  accountId: string;
  kind: ContentKind;
  state: ContentState;
  topic: string | null;
  script: string | null;
  metadata: Readonly<Record<string, unknown>>;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  contentItemId: string;
  type: string;
  path: string;
  checksum: string;
  provider: string;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}

export interface PublishedItem {
  id: string;
  contentItemId: string;
  accountId: string;
  platform: Platform;
  platformItemId: string;
  publicUrl: string | null;
  privacyStatus: string | null;
  publishedAt: string;
}

export interface UploadSession {
  idempotencyKey: string;
  accountId: string;
  sessionUri: string;
  filePath: string;
  fileSize: number;
  uploadedBytes: number;
  state: "initiated" | "uploading" | "completed" | "expired";
  platformItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateProduct {
  id: string;
  sourceUrl: string;
  affiliateUrl: string;
  title: string | null;
  features: readonly string[];
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  niche: string;
  subject: string;
  bodyTemplate: string;
  state: "draft" | "approved" | "running" | "completed" | "canceled";
  approvedAt: string | null;
  dailyLimit: number;
  perDomainLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachLead {
  id: string;
  campaignId: string;
  businessName: string;
  domain: string;
  websiteUrl: string;
  email: string;
  source: string;
  suppressedAt: string | null;
  suppressionReason: string | null;
  createdAt: string;
}

export interface OutreachAttempt {
  id: string;
  campaignId: string;
  leadId: string;
  state: "sending" | "sent" | "failed";
  messageId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Job<
  TPayload extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, unknown>
  >,
> {
  id: string;
  type: string;
  state: JobState;
  payload: TPayload;
  idempotencyKey: string;
  attemptCount: number;
  maximumAttempts: number;
  runAt: string;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  name: string;
  jobType: string;
  payload: Readonly<Record<string, unknown>>;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}
