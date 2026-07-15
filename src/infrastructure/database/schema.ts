import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type {
  AccountConnectionState,
  AiProviderKind,
  ContentCreation,
  ContentKind,
  ContentState,
  JobState,
  OutreachAttempt,
  OutreachCampaign,
  Platform,
  UploadSession,
} from "../../domain/model.js";

export const aiProviderProfiles = sqliteTable("ai_provider_profiles", {
  kind: text("kind").$type<AiProviderKind>().primaryKey(),
  model: text("model").notNull(),
  baseUrl: text("base_url").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const creations = sqliteTable(
  "creations",
  {
    id: text("id").primaryKey(),
    format: text("format").$type<ContentCreation["format"]>().notNull(),
    topic: text("topic").notNull(),
    audience: text("audience").notNull(),
    tone: text("tone").notNull(),
    language: text("language").notNull(),
    title: text("title").notNull(),
    hook: text("hook").notNull(),
    script: text("script").notNull(),
    caption: text("caption").notNull(),
    hashtags: text("hashtags", { mode: "json" })
      .$type<readonly string[]>()
      .notNull(),
    providerKind: text("provider_kind").$type<AiProviderKind>().notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    durationMs: real("duration_ms").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("creations_created_at_idx").on(table.createdAt)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    platform: text("platform").$type<Platform>().notNull(),
    nickname: text("nickname").notNull(),
    niche: text("niche").notNull(),
    language: text("language").notNull(),
    browserProfilePath: text("browser_profile_path"),
    configuration: text("configuration", { mode: "json" })
      .$type<Readonly<Record<string, unknown>>>()
      .notNull(),
    legacyId: text("legacy_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("accounts_platform_idx").on(table.platform),
    uniqueIndex("accounts_legacy_id_uq").on(table.platform, table.legacyId),
  ],
);

export const accountConnections = sqliteTable(
  "account_connections",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => accounts.id, { onDelete: "cascade" }),
    platform: text("platform").$type<Platform>().notNull(),
    state: text("state").$type<AccountConnectionState>().notNull(),
    externalAccountId: text("external_account_id"),
    displayName: text("display_name"),
    scopes: text("scopes", { mode: "json" })
      .$type<readonly string[]>()
      .notNull(),
    expiresAt: text("expires_at"),
    connectedAt: text("connected_at"),
    lastCheckedAt: text("last_checked_at"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("account_connections_state_idx").on(table.state)],
);

export const contentItems = sqliteTable(
  "content_items",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ContentKind>().notNull(),
    state: text("state").$type<ContentState>().notNull(),
    topic: text("topic"),
    script: text("script"),
    metadata: text("metadata", { mode: "json" })
      .$type<Readonly<Record<string, unknown>>>()
      .notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("content_items_account_idx").on(table.accountId),
    index("content_items_state_idx").on(table.state),
  ],
);

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    path: text("path").notNull(),
    checksum: text("checksum").notNull(),
    provider: text("provider").notNull(),
    metadata: text("metadata", { mode: "json" })
      .$type<Readonly<Record<string, unknown>>>()
      .notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("artifacts_content_idx").on(table.contentItemId),
    uniqueIndex("artifacts_content_path_uq").on(
      table.contentItemId,
      table.path,
    ),
  ],
);

export const publishedItems = sqliteTable(
  "published_items",
  {
    id: text("id").primaryKey(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    platform: text("platform").$type<Platform>().notNull(),
    platformItemId: text("platform_item_id").notNull(),
    publicUrl: text("public_url"),
    privacyStatus: text("privacy_status"),
    publishedAt: text("published_at").notNull(),
  },
  (table) => [
    uniqueIndex("published_content_account_uq").on(
      table.contentItemId,
      table.accountId,
    ),
  ],
);

export const uploadSessions = sqliteTable("upload_sessions", {
  idempotencyKey: text("idempotency_key").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  sessionUri: text("session_uri").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedBytes: integer("uploaded_bytes").notNull(),
  state: text("state").$type<UploadSession["state"]>().notNull(),
  platformItemId: text("platform_item_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const affiliateProducts = sqliteTable("affiliate_products", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  affiliateUrl: text("affiliate_url").notNull(),
  title: text("title"),
  features: text("features", { mode: "json" })
    .$type<readonly string[]>()
    .notNull(),
  accountId: text("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  legacyId: text("legacy_id").unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const outreachCampaigns = sqliteTable("outreach_campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  niche: text("niche").notNull(),
  subject: text("subject").notNull(),
  bodyTemplate: text("body_template").notNull(),
  state: text("state").$type<OutreachCampaign["state"]>().notNull(),
  approvedAt: text("approved_at"),
  dailyLimit: integer("daily_limit").notNull(),
  perDomainLimit: integer("per_domain_limit").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const outreachLeads = sqliteTable(
  "outreach_leads",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    businessName: text("business_name").notNull(),
    domain: text("domain").notNull(),
    websiteUrl: text("website_url").notNull(),
    email: text("email").notNull(),
    source: text("source").notNull(),
    suppressedAt: text("suppressed_at"),
    suppressionReason: text("suppression_reason"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("outreach_lead_campaign_email_uq").on(
      table.campaignId,
      table.email,
    ),
  ],
);

export const outreachAttempts = sqliteTable(
  "outreach_attempts",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => outreachLeads.id, { onDelete: "cascade" }),
    state: text("state").$type<OutreachAttempt["state"]>().notNull(),
    messageId: text("message_id"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("outreach_attempt_campaign_lead_uq").on(
      table.campaignId,
      table.leadId,
    ),
  ],
);

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  jobType: text("job_type").notNull(),
  payload: text("payload", { mode: "json" })
    .$type<Readonly<Record<string, unknown>>>()
    .notNull(),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  nextRunAt: text("next_run_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    state: text("state").$type<JobState>().notNull(),
    payload: text("payload", { mode: "json" })
      .$type<Readonly<Record<string, unknown>>>()
      .notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptCount: integer("attempt_count").notNull(),
    maximumAttempts: integer("maximum_attempts").notNull(),
    runAt: text("run_at").notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: text("lease_expires_at"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("jobs_idempotency_key_uq").on(table.idempotencyKey),
    index("jobs_claim_idx").on(table.state, table.runAt),
  ],
);

export const jobAttempts = sqliteTable("job_attempts", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  workerId: text("worker_id").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  state: text("state").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
});
