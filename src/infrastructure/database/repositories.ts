import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import type {
  Account,
  AffiliateProduct,
  Artifact,
  ContentItem,
  ContentKind,
  ContentState,
  Job,
  NewAccount,
  OutreachAttempt,
  OutreachCampaign,
  OutreachLead,
  Platform,
  PublishedItem,
  Schedule,
  UploadSession,
} from "../../domain/model.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { DatabaseContext } from "./client.js";
import {
  accounts,
  affiliateProducts,
  artifacts,
  contentItems,
  jobAttempts,
  jobs,
  outreachAttempts,
  outreachCampaigns,
  outreachLeads,
  publishedItems,
  schedules,
  uploadSessions,
} from "./schema.js";

const accountFields = {
  id: accounts.id,
  platform: accounts.platform,
  nickname: accounts.nickname,
  niche: accounts.niche,
  language: accounts.language,
  browserProfilePath: accounts.browserProfilePath,
  configuration: accounts.configuration,
  createdAt: accounts.createdAt,
  updatedAt: accounts.updatedAt,
};

export class AccountRepository {
  public constructor(private readonly database: DatabaseContext) {}

  public create(input: NewAccount): Account {
    const timestamp = nowIso();
    const account: Account = {
      id: input.id ?? createId(),
      platform: input.platform,
      nickname: input.nickname,
      niche: input.niche,
      language: input.language,
      browserProfilePath: input.browserProfilePath ?? null,
      configuration: input.configuration ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.orm.insert(accounts).values(account).run();
    return account;
  }

  public list(): readonly Account[] {
    return this.database.orm
      .select(accountFields)
      .from(accounts)
      .orderBy(asc(accounts.createdAt))
      .all();
  }

  public findById(id: string): Account | null {
    return (
      this.database.orm
        .select(accountFields)
        .from(accounts)
        .where(eq(accounts.id, id))
        .get() ?? null
    );
  }
}

export interface ContentUpdate {
  state?: ContentState;
  topic?: string | null;
  script?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface ImportLegacyContentInput {
  id: string;
  accountId: string;
  kind: ContentKind;
  topic?: string | null;
  script?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
  createdAt: string;
}

export interface AddArtifactInput {
  contentItemId: string;
  type: string;
  path: string;
  checksum: string;
  provider: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export class ContentRepository {
  public constructor(private readonly database: DatabaseContext) {}

  public create(accountId: string, kind: ContentKind): ContentItem {
    const timestamp = nowIso();
    const item: ContentItem = {
      id: createId(),
      accountId,
      kind,
      state: "draft",
      topic: null,
      script: null,
      metadata: {},
      errorCode: null,
      errorMessage: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.orm.insert(contentItems).values(item).run();
    return item;
  }

  public importLegacy(input: ImportLegacyContentInput): ContentItem {
    const existing = this.findById(input.id);
    if (existing !== null) {
      return existing;
    }
    const item: ContentItem = {
      id: input.id,
      accountId: input.accountId,
      kind: input.kind,
      state: "published",
      topic: input.topic ?? null,
      script: input.script ?? null,
      metadata: input.metadata ?? {},
      errorCode: null,
      errorMessage: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
    this.database.orm.insert(contentItems).values(item).run();
    return item;
  }

  public findById(id: string): ContentItem | null {
    return (
      this.database.orm
        .select()
        .from(contentItems)
        .where(eq(contentItems.id, id))
        .get() ?? null
    );
  }

  public list(accountId?: string): readonly ContentItem[] {
    const query = this.database.orm.select().from(contentItems);
    return accountId === undefined
      ? query.orderBy(asc(contentItems.createdAt)).all()
      : query
          .where(eq(contentItems.accountId, accountId))
          .orderBy(asc(contentItems.createdAt))
          .all();
  }

  public update(id: string, update: ContentUpdate): ContentItem {
    const existing = this.findById(id);
    if (existing === null) {
      throw new Error(`Content item not found: ${id}`);
    }
    this.database.orm
      .update(contentItems)
      .set({ ...update, updatedAt: nowIso() })
      .where(eq(contentItems.id, id))
      .run();
    const updated = this.findById(id);
    if (updated === null) {
      throw new Error(`Content item disappeared after update: ${id}`);
    }
    return updated;
  }

  public addArtifact(input: AddArtifactInput): Artifact {
    const artifact: Artifact = {
      id: createId(),
      contentItemId: input.contentItemId,
      type: input.type,
      path: input.path,
      checksum: input.checksum,
      provider: input.provider,
      metadata: input.metadata ?? {},
      createdAt: nowIso(),
    };
    this.database.orm
      .insert(artifacts)
      .values(artifact)
      .onConflictDoNothing({
        target: [artifacts.contentItemId, artifacts.path],
      })
      .run();
    return (
      this.database.orm
        .select()
        .from(artifacts)
        .where(
          and(
            eq(artifacts.contentItemId, input.contentItemId),
            eq(artifacts.path, input.path),
          ),
        )
        .get() ?? artifact
    );
  }

  public listArtifacts(contentItemId: string): readonly Artifact[] {
    return this.database.orm
      .select()
      .from(artifacts)
      .where(eq(artifacts.contentItemId, contentItemId))
      .orderBy(asc(artifacts.createdAt))
      .all();
  }
}

export interface EnqueueJobInput {
  type: string;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  runAt?: string;
  maximumAttempts: number;
}

export class JobRepository {
  public constructor(private readonly database: DatabaseContext) {}

  public enqueue(input: EnqueueJobInput): Job {
    const timestamp = nowIso();
    const job: Job = {
      id: createId(),
      type: input.type,
      state: "queued",
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      attemptCount: 0,
      maximumAttempts: input.maximumAttempts,
      runAt: input.runAt ?? timestamp,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.database.orm
      .insert(jobs)
      .values(job)
      .onConflictDoNothing({ target: jobs.idempotencyKey })
      .run();
    return (
      this.database.orm
        .select()
        .from(jobs)
        .where(eq(jobs.idempotencyKey, input.idempotencyKey))
        .get() ?? job
    );
  }

  public list(limit = 100): readonly Job[] {
    return this.database.orm
      .select()
      .from(jobs)
      .orderBy(asc(jobs.createdAt))
      .limit(limit)
      .all();
  }

  public findById(id: string): Job | null {
    return (
      this.database.orm.select().from(jobs).where(eq(jobs.id, id)).get() ?? null
    );
  }

  public claim(
    workerId: string,
    leaseDurationMs: number,
    now = new Date(),
  ): Job | null {
    const nowString = now.toISOString();
    const leaseExpiresAt = new Date(
      now.getTime() + leaseDurationMs,
    ).toISOString();

    return this.database.sqlite
      .transaction(() => {
        const candidate = this.database.orm
          .select()
          .from(jobs)
          .where(
            and(
              inArray(jobs.state, ["queued", "retrying", "running"]),
              lte(jobs.runAt, nowString),
              or(
                eq(jobs.state, "queued"),
                eq(jobs.state, "retrying"),
                lte(jobs.leaseExpiresAt, nowString),
              ),
            ),
          )
          .orderBy(asc(jobs.runAt), asc(jobs.createdAt))
          .limit(1)
          .get();

        if (candidate === undefined) {
          return null;
        }

        const attemptNumber = candidate.attemptCount + 1;
        this.database.orm
          .update(jobs)
          .set({
            state: "running",
            attemptCount: attemptNumber,
            leaseOwner: workerId,
            leaseExpiresAt,
            updatedAt: nowString,
          })
          .where(eq(jobs.id, candidate.id))
          .run();
        this.database.orm
          .insert(jobAttempts)
          .values({
            id: createId(),
            jobId: candidate.id,
            attemptNumber,
            workerId,
            startedAt: nowString,
            state: "running",
          })
          .run();

        return (
          this.database.orm
            .select()
            .from(jobs)
            .where(eq(jobs.id, candidate.id))
            .get() ?? null
        );
      })
      .immediate();
  }

  public complete(jobId: string, workerId: string, now = new Date()): Job {
    const timestamp = now.toISOString();
    return this.database.sqlite
      .transaction(() => {
        const job = this.requireOwnedRunningJob(jobId, workerId);
        this.database.orm
          .update(jobs)
          .set({
            state: "succeeded",
            leaseOwner: null,
            leaseExpiresAt: null,
            lastError: null,
            updatedAt: timestamp,
          })
          .where(eq(jobs.id, jobId))
          .run();
        this.finishAttempt(job, "succeeded", timestamp);
        return this.requireJob(jobId);
      })
      .immediate();
  }

  public fail(
    jobId: string,
    workerId: string,
    message: string,
    retryable: boolean,
    now = new Date(),
  ): Job {
    const timestamp = now.toISOString();
    return this.database.sqlite
      .transaction(() => {
        const job = this.requireOwnedRunningJob(jobId, workerId);
        const shouldRetry = retryable && job.attemptCount < job.maximumAttempts;
        const delayMs = Math.min(
          300_000,
          1000 * 2 ** Math.max(0, job.attemptCount - 1),
        );
        this.database.orm
          .update(jobs)
          .set({
            state: shouldRetry ? "retrying" : "failed",
            runAt: shouldRetry
              ? new Date(now.getTime() + delayMs).toISOString()
              : job.runAt,
            leaseOwner: null,
            leaseExpiresAt: null,
            lastError: message,
            updatedAt: timestamp,
          })
          .where(eq(jobs.id, jobId))
          .run();
        this.finishAttempt(job, "failed", timestamp, message);
        return this.requireJob(jobId);
      })
      .immediate();
  }

  public retry(jobId: string, now = new Date()): Job {
    const timestamp = now.toISOString();
    const job = this.requireJob(jobId);
    if (job.state !== "failed") {
      throw new Error(
        `Only failed jobs can be retried; ${jobId} is ${job.state}`,
      );
    }
    this.database.orm
      .update(jobs)
      .set({
        state: "queued",
        runAt: timestamp,
        lastError: null,
        updatedAt: timestamp,
      })
      .where(eq(jobs.id, jobId))
      .run();
    return this.requireJob(jobId);
  }

  public cancel(jobId: string, now = new Date()): Job {
    const timestamp = now.toISOString();
    const job = this.requireJob(jobId);
    if (job.state === "succeeded" || job.state === "canceled") {
      return job;
    }
    this.database.orm
      .update(jobs)
      .set({
        state: "canceled",
        leaseOwner: null,
        leaseExpiresAt: null,
        updatedAt: timestamp,
      })
      .where(eq(jobs.id, jobId))
      .run();
    return this.requireJob(jobId);
  }

  private requireJob(jobId: string): Job {
    const job = this.findById(jobId);
    if (job === null) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return job;
  }

  private requireOwnedRunningJob(jobId: string, workerId: string): Job {
    const job = this.requireJob(jobId);
    if (job.state !== "running" || job.leaseOwner !== workerId) {
      throw new Error(`Worker ${workerId} does not own running job ${jobId}`);
    }
    return job;
  }

  private finishAttempt(
    job: Job,
    state: "succeeded" | "failed",
    completedAt: string,
    errorMessage?: string,
  ): void {
    this.database.orm
      .update(jobAttempts)
      .set({
        state,
        completedAt,
        ...(errorMessage === undefined ? {} : { errorMessage }),
      })
      .where(
        and(
          eq(jobAttempts.jobId, job.id),
          eq(jobAttempts.attemptNumber, job.attemptCount),
        ),
      )
      .run();
  }
}

export interface CreateScheduleInput {
  name: string;
  jobType: string;
  payload: Readonly<Record<string, unknown>>;
  cronExpression: string;
  timezone: string;
  nextRunAt: string;
  enabled?: boolean;
}

export class ScheduleRepository {
  public constructor(private readonly database: DatabaseContext) {}

  public create(input: CreateScheduleInput): Schedule {
    const timestamp = nowIso();
    const schedule: Schedule = {
      id: createId(),
      name: input.name,
      jobType: input.jobType,
      payload: input.payload,
      cronExpression: input.cronExpression,
      timezone: input.timezone,
      enabled: input.enabled ?? true,
      nextRunAt: input.nextRunAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.orm.insert(schedules).values(schedule).run();
    return schedule;
  }

  public list(): readonly Schedule[] {
    return this.database.orm
      .select()
      .from(schedules)
      .orderBy(asc(schedules.createdAt))
      .all();
  }

  public listDue(now = new Date()): readonly Schedule[] {
    return this.database.orm
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.enabled, true),
          lte(schedules.nextRunAt, now.toISOString()),
        ),
      )
      .orderBy(asc(schedules.nextRunAt))
      .all();
  }

  public updateNextRun(id: string, nextRunAt: string, now = new Date()): void {
    this.database.orm
      .update(schedules)
      .set({ nextRunAt, updatedAt: now.toISOString() })
      .where(eq(schedules.id, id))
      .run();
  }
}

export interface RecordPublishedItemInput {
  contentItemId: string;
  accountId: string;
  platform: Platform;
  platformItemId: string;
  publicUrl: string | null;
  privacyStatus: string | null;
  publishedAt?: string;
}

export interface SaveUploadSessionInput {
  idempotencyKey: string;
  accountId: string;
  sessionUri: string;
  filePath: string;
  fileSize: number;
  uploadedBytes: number;
  state: UploadSession["state"];
  platformItemId?: string | null;
}

export class PublishingRepository {
  public constructor(private readonly database: DatabaseContext) {}

  public findPublished(
    contentItemId: string,
    accountId: string,
  ): PublishedItem | null {
    return (
      this.database.orm
        .select()
        .from(publishedItems)
        .where(
          and(
            eq(publishedItems.contentItemId, contentItemId),
            eq(publishedItems.accountId, accountId),
          ),
        )
        .get() ?? null
    );
  }

  public recordPublished(input: RecordPublishedItemInput): PublishedItem {
    const existing = this.findPublished(input.contentItemId, input.accountId);
    if (existing !== null) {
      return existing;
    }
    const item: PublishedItem = {
      id: createId(),
      ...input,
      publishedAt: input.publishedAt ?? nowIso(),
    };
    this.database.orm.insert(publishedItems).values(item).run();
    return item;
  }

  public findUploadSession(idempotencyKey: string): UploadSession | null {
    return (
      this.database.orm
        .select()
        .from(uploadSessions)
        .where(eq(uploadSessions.idempotencyKey, idempotencyKey))
        .get() ?? null
    );
  }

  public saveUploadSession(input: SaveUploadSessionInput): UploadSession {
    const existing = this.findUploadSession(input.idempotencyKey);
    const timestamp = nowIso();
    const session: UploadSession = {
      ...input,
      platformItemId: input.platformItemId ?? null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.database.orm
      .insert(uploadSessions)
      .values(session)
      .onConflictDoUpdate({
        target: uploadSessions.idempotencyKey,
        set: {
          sessionUri: session.sessionUri,
          filePath: session.filePath,
          fileSize: session.fileSize,
          uploadedBytes: session.uploadedBytes,
          state: session.state,
          platformItemId: session.platformItemId,
          updatedAt: session.updatedAt,
        },
      })
      .run();
    return this.findUploadSession(input.idempotencyKey) ?? session;
  }
}

const affiliateProductFields = {
  id: affiliateProducts.id,
  sourceUrl: affiliateProducts.sourceUrl,
  affiliateUrl: affiliateProducts.affiliateUrl,
  title: affiliateProducts.title,
  features: affiliateProducts.features,
  accountId: affiliateProducts.accountId,
  createdAt: affiliateProducts.createdAt,
  updatedAt: affiliateProducts.updatedAt,
};

export class AffiliateRepository {
  public constructor(private readonly database: DatabaseContext) {}

  public create(
    sourceUrl: string,
    affiliateUrl: string,
    accountId: string | null,
  ): AffiliateProduct {
    const timestamp = nowIso();
    const product: AffiliateProduct = {
      id: createId(),
      sourceUrl,
      affiliateUrl,
      title: null,
      features: [],
      accountId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.orm.insert(affiliateProducts).values(product).run();
    return product;
  }

  public findByLegacyId(legacyId: string): AffiliateProduct | null {
    return (
      this.database.orm
        .select(affiliateProductFields)
        .from(affiliateProducts)
        .where(eq(affiliateProducts.legacyId, legacyId))
        .get() ?? null
    );
  }

  public importLegacy(
    legacyId: string,
    sourceUrl: string,
    affiliateUrl: string,
    accountId: string | null,
  ): AffiliateProduct {
    const existing = this.findByLegacyId(legacyId);
    if (existing !== null) {
      return existing;
    }
    const timestamp = nowIso();
    const product: AffiliateProduct = {
      id: createId(),
      sourceUrl,
      affiliateUrl,
      title: null,
      features: [],
      accountId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.orm
      .insert(affiliateProducts)
      .values({ ...product, legacyId })
      .run();
    return product;
  }

  public findById(id: string): AffiliateProduct | null {
    return (
      this.database.orm
        .select(affiliateProductFields)
        .from(affiliateProducts)
        .where(eq(affiliateProducts.id, id))
        .get() ?? null
    );
  }

  public list(): readonly AffiliateProduct[] {
    return this.database.orm
      .select(affiliateProductFields)
      .from(affiliateProducts)
      .orderBy(asc(affiliateProducts.createdAt))
      .all();
  }

  public updateDetails(
    id: string,
    title: string,
    features: readonly string[],
  ): AffiliateProduct {
    this.database.orm
      .update(affiliateProducts)
      .set({ title, features, updatedAt: nowIso() })
      .where(eq(affiliateProducts.id, id))
      .run();
    const product = this.findById(id);
    if (product === null) {
      throw new Error(`Affiliate product not found: ${id}`);
    }
    return product;
  }
}

export interface CreateOutreachCampaignInput {
  name: string;
  niche: string;
  subject: string;
  bodyTemplate: string;
  dailyLimit: number;
  perDomainLimit: number;
}

export interface AddOutreachLeadInput {
  businessName: string;
  domain: string;
  websiteUrl: string;
  email: string;
  source: string;
}

export class OutreachRepository {
  public constructor(private readonly database: DatabaseContext) {}

  public createCampaign(input: CreateOutreachCampaignInput): OutreachCampaign {
    const timestamp = nowIso();
    const campaign: OutreachCampaign = {
      id: createId(),
      ...input,
      state: "draft",
      approvedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.orm.insert(outreachCampaigns).values(campaign).run();
    return campaign;
  }

  public findCampaign(id: string): OutreachCampaign | null {
    return (
      this.database.orm
        .select()
        .from(outreachCampaigns)
        .where(eq(outreachCampaigns.id, id))
        .get() ?? null
    );
  }

  public listCampaigns(): readonly OutreachCampaign[] {
    return this.database.orm
      .select()
      .from(outreachCampaigns)
      .orderBy(asc(outreachCampaigns.createdAt))
      .all();
  }

  public approveCampaign(id: string): OutreachCampaign {
    const timestamp = nowIso();
    this.database.orm
      .update(outreachCampaigns)
      .set({ state: "approved", approvedAt: timestamp, updatedAt: timestamp })
      .where(eq(outreachCampaigns.id, id))
      .run();
    const campaign = this.findCampaign(id);
    if (campaign === null) {
      throw new Error(`Outreach campaign not found: ${id}`);
    }
    return campaign;
  }

  public setCampaignState(
    id: string,
    state: OutreachCampaign["state"],
  ): OutreachCampaign {
    this.database.orm
      .update(outreachCampaigns)
      .set({ state, updatedAt: nowIso() })
      .where(eq(outreachCampaigns.id, id))
      .run();
    const campaign = this.findCampaign(id);
    if (campaign === null) {
      throw new Error(`Outreach campaign not found: ${id}`);
    }
    return campaign;
  }

  public addLeads(
    campaignId: string,
    inputs: readonly AddOutreachLeadInput[],
  ): readonly OutreachLead[] {
    for (const input of inputs) {
      this.database.orm
        .insert(outreachLeads)
        .values({
          id: createId(),
          campaignId,
          ...input,
          suppressedAt: null,
          suppressionReason: null,
          createdAt: nowIso(),
        })
        .onConflictDoNothing({
          target: [outreachLeads.campaignId, outreachLeads.email],
        })
        .run();
    }
    return this.listLeads(campaignId);
  }

  public listLeads(campaignId: string): readonly OutreachLead[] {
    return this.database.orm
      .select()
      .from(outreachLeads)
      .where(eq(outreachLeads.campaignId, campaignId))
      .orderBy(asc(outreachLeads.createdAt))
      .all();
  }

  public eligibleLeads(campaignId: string): readonly OutreachLead[] {
    const attempted = new Set(
      this.listAttempts(campaignId)
        .filter((attempt) => attempt.state === "sent")
        .map((attempt) => attempt.leadId),
    );
    return this.database.orm
      .select()
      .from(outreachLeads)
      .where(
        and(
          eq(outreachLeads.campaignId, campaignId),
          isNull(outreachLeads.suppressedAt),
        ),
      )
      .orderBy(asc(outreachLeads.createdAt))
      .all()
      .filter((lead) => !attempted.has(lead.id));
  }

  public listAttempts(campaignId: string): readonly OutreachAttempt[] {
    return this.database.orm
      .select()
      .from(outreachAttempts)
      .where(eq(outreachAttempts.campaignId, campaignId))
      .orderBy(asc(outreachAttempts.createdAt))
      .all();
  }

  public sentSince(campaignId: string, since: Date): number {
    return this.database.orm
      .select()
      .from(outreachAttempts)
      .where(
        and(
          eq(outreachAttempts.campaignId, campaignId),
          eq(outreachAttempts.state, "sent"),
          gte(outreachAttempts.createdAt, since.toISOString()),
        ),
      )
      .all().length;
  }

  public startAttempt(campaignId: string, leadId: string): OutreachAttempt {
    const existing = this.listAttempts(campaignId).find(
      (attempt) => attempt.leadId === leadId,
    );
    if (existing?.state === "sent") {
      return existing;
    }
    if (existing !== undefined) {
      this.database.orm
        .update(outreachAttempts)
        .set({ state: "sending", errorMessage: null, completedAt: null })
        .where(eq(outreachAttempts.id, existing.id))
        .run();
      return {
        ...existing,
        state: "sending",
        errorMessage: null,
        completedAt: null,
      };
    }
    const attempt: OutreachAttempt = {
      id: createId(),
      campaignId,
      leadId,
      state: "sending",
      messageId: null,
      errorMessage: null,
      createdAt: nowIso(),
      completedAt: null,
    };
    this.database.orm.insert(outreachAttempts).values(attempt).run();
    return attempt;
  }

  public finishAttempt(
    attemptId: string,
    state: "sent" | "failed",
    messageId: string | null,
    errorMessage: string | null,
  ): void {
    this.database.orm
      .update(outreachAttempts)
      .set({ state, messageId, errorMessage, completedAt: nowIso() })
      .where(eq(outreachAttempts.id, attemptId))
      .run();
  }
}
