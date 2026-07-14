import { z } from "zod";

import { createYouTubeGenerator } from "../application/create-youtube-generator.js";
import { createYouTubePublisher } from "../application/create-youtube-publisher.js";
import {
  createTwitterGenerator,
  createTwitterPublisher,
} from "../application/twitter-services.js";
import { createAffiliateCampaign } from "../application/affiliate-services.js";
import {
  createOutreachDiscovery,
  createOutreachRunner,
} from "../application/create-outreach-services.js";
import { AppError } from "../shared/errors.js";
import type { JobHandler } from "./job-worker.js";

const idSchema = z.string().min(1).max(200);

const youtubeGeneratePayloadSchema = z.object({
  accountId: idSchema,
  contentItemId: idSchema.optional(),
  backgroundMusicPath: z.string().min(1).optional(),
});

const youtubePublishPayloadSchema = z.object({
  accountId: idSchema,
  contentItemId: idSchema,
  privacyStatus: z.enum(["private", "unlisted", "public"]).default("private"),
});

const twitterGeneratePayloadSchema = z.object({
  accountId: idSchema,
  subject: z.string().min(1).optional(),
});

const twitterPublishPayloadSchema = z.object({
  accountId: idSchema,
  contentItemId: idSchema,
});

const affiliateRunPayloadSchema = z.object({
  productId: idSchema,
  publish: z.boolean().default(false),
});

const outreachDiscoverPayloadSchema = z.object({
  campaignId: idSchema,
  limit: z.number().int().min(1).max(500),
});

const outreachRunPayloadSchema = z.object({ campaignId: idSchema });

export function createDefaultJobHandlers(): ReadonlyMap<string, JobHandler> {
  const youtubeGenerate: JobHandler = async (job, runtime) => {
    const payload = youtubeGeneratePayloadSchema.parse(job.payload);
    const account = runtime.accounts.findById(payload.accountId);
    if (account === null) {
      throw new AppError(
        `Account not found: ${payload.accountId}`,
        "ACCOUNT_NOT_FOUND",
      );
    }
    await createYouTubeGenerator(runtime).execute({
      account,
      ...(payload.contentItemId === undefined
        ? {}
        : { contentItemId: payload.contentItemId }),
      ...(payload.backgroundMusicPath === undefined
        ? {}
        : { backgroundMusicPath: payload.backgroundMusicPath }),
    });
  };

  const youtubePublish: JobHandler = async (job, runtime) => {
    const payload = youtubePublishPayloadSchema.parse(job.payload);
    const account = runtime.accounts.findById(payload.accountId);
    const content = runtime.content.findById(payload.contentItemId);
    if (account === null || content === null) {
      throw new AppError(
        "Account or content item was not found",
        "PUBLISH_INPUT_NOT_FOUND",
      );
    }
    await createYouTubePublisher(runtime).execute(
      account,
      content,
      payload.privacyStatus,
    );
  };

  const twitterGenerate: JobHandler = async (job, runtime) => {
    const payload = twitterGeneratePayloadSchema.parse(job.payload);
    const account = runtime.accounts.findById(payload.accountId);
    if (account === null) {
      throw new AppError(
        `Account not found: ${payload.accountId}`,
        "ACCOUNT_NOT_FOUND",
      );
    }
    await createTwitterGenerator(runtime).execute(account, payload.subject);
  };

  const twitterPublish: JobHandler = async (job, runtime) => {
    const payload = twitterPublishPayloadSchema.parse(job.payload);
    const account = runtime.accounts.findById(payload.accountId);
    const content = runtime.content.findById(payload.contentItemId);
    if (account === null || content === null) {
      throw new AppError(
        "Account or content item was not found",
        "PUBLISH_INPUT_NOT_FOUND",
      );
    }
    await createTwitterPublisher(runtime).execute(account, content);
  };

  const affiliateRun: JobHandler = async (job, runtime) => {
    const payload = affiliateRunPayloadSchema.parse(job.payload);
    const product = runtime.affiliate.findById(payload.productId);
    const account =
      product?.accountId === null || product?.accountId === undefined
        ? null
        : runtime.accounts.findById(product.accountId);
    if (product === null || account === null) {
      throw new AppError(
        "Affiliate product or account was not found",
        "AFFILIATE_INPUT_NOT_FOUND",
      );
    }
    const result = await createAffiliateCampaign(runtime).execute(
      product,
      account,
    );
    if (payload.publish) {
      await createTwitterPublisher(runtime).execute(account, result.content);
    }
  };

  const outreachDiscover: JobHandler = async (job, runtime) => {
    const payload = outreachDiscoverPayloadSchema.parse(job.payload);
    const campaign = runtime.outreach.findCampaign(payload.campaignId);
    if (campaign === null) {
      throw new AppError(
        `Campaign not found: ${payload.campaignId}`,
        "CAMPAIGN_NOT_FOUND",
      );
    }
    await createOutreachDiscovery(runtime).execute(campaign, payload.limit);
  };

  const outreachRun: JobHandler = async (job, runtime) => {
    const payload = outreachRunPayloadSchema.parse(job.payload);
    const campaign = runtime.outreach.findCampaign(payload.campaignId);
    if (campaign === null) {
      throw new AppError(
        `Campaign not found: ${payload.campaignId}`,
        "CAMPAIGN_NOT_FOUND",
      );
    }
    await createOutreachRunner(runtime).execute(campaign);
  };

  return new Map([
    ["youtube.generate", youtubeGenerate],
    ["youtube.publish", youtubePublish],
    ["twitter.generate", twitterGenerate],
    ["twitter.publish", twitterPublish],
    ["affiliate.run", affiliateRun],
    ["outreach.discover", outreachDiscover],
    ["outreach.run", outreachRun],
  ]);
}
