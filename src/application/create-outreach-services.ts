import { NodemailerEmailSender } from "../adapters/email/nodemailer-email-sender.js";
import { GoogleMapsBusinessSource } from "../adapters/outreach/google-maps-business-source.js";
import type { Runtime } from "../runtime.js";
import {
  DiscoverOutreachLeads,
  RunOutreachCampaign,
} from "./outreach-services.js";

export function createOutreachDiscovery(
  runtime: Runtime,
): DiscoverOutreachLeads {
  const config = runtime.loadedConfig.config;
  return new DiscoverOutreachLeads(
    runtime.outreach,
    new GoogleMapsBusinessSource({
      scraperExecutable: config.outreach.scraperExecutable,
      scraperTimeoutMs: config.outreach.scraperTimeoutMs,
      websiteTimeoutMs: config.outreach.websiteTimeoutMs,
      maximumWebsiteBytes: config.outreach.maximumWebsiteBytes,
      dataDirectory: config.dataDirectory,
    }),
  );
}

export function createOutreachRunner(runtime: Runtime): RunOutreachCampaign {
  const config = runtime.loadedConfig.config;
  const smtp = config.outreach.smtp;
  return new RunOutreachCampaign(
    runtime.outreach,
    new NodemailerEmailSender({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      username: process.env[smtp.usernameEnv] ?? "",
      password: process.env[smtp.passwordEnv] ?? "",
      from: process.env[smtp.fromEnv] ?? "",
    }),
    {
      sendingEnabled: config.safety.outreachSending,
      sendDelayMs: config.outreach.sendDelayMs,
    },
  );
}
