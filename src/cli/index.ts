#!/usr/bin/env node
import { Command } from "commander";
import { execa } from "execa";

import { runPreflight } from "../application/preflight.js";
import { LegacyMigrationService } from "../application/migrate-legacy.js";
import { SchedulerService } from "../application/scheduler-service.js";
import { createYouTubeGenerator } from "../application/create-youtube-generator.js";
import { createYouTubePublisher } from "../application/create-youtube-publisher.js";
import { createAccountAuthenticationService } from "../application/create-account-authentication-service.js";
import { createSocialPublisher } from "../application/social-services.js";
import {
  createTwitterGenerator,
  createTwitterPublisher,
} from "../application/twitter-services.js";
import { createAffiliateCampaign } from "../application/affiliate-services.js";
import {
  createOutreachDiscovery,
  createOutreachRunner,
} from "../application/create-outreach-services.js";
import { platforms, type NewAccount, type Platform } from "../domain/model.js";
import { runDashboard } from "../interface/run-dashboard.js";
import { createRuntime, type Runtime } from "../runtime.js";
import { errorMessage } from "../shared/errors.js";

interface GlobalOptions {
  config?: string;
  json?: boolean;
}

function withRuntime<T>(
  command: Command,
  operation: (runtime: Runtime) => Promise<T> | T,
): Promise<T> {
  const options = command.optsWithGlobals<GlobalOptions>();
  const runtime = createRuntime(options.config);
  return Promise.resolve(operation(runtime)).finally(() => runtime.close());
}

function print(value: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      process.stdout.write(`${JSON.stringify(item)}\n`);
    }
    return;
  }
  process.stdout.write(
    `${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`,
  );
}

function parseObject(value: string): Readonly<Record<string, unknown>> {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }
  return parsed as Readonly<Record<string, unknown>>;
}

function parsePlatform(value: string): Platform {
  const platform = platforms.find((candidate) => candidate === value);
  if (platform === undefined) {
    throw new Error(`--platform must be one of: ${platforms.join(", ")}`);
  }
  return platform;
}

const program = new Command()
  .name("moneyprinter")
  .description("Local-first content generation and publishing automation")
  .version("3.0.0-alpha.1")
  .option("--config <path>", "configuration file path")
  .option("--json", "print machine-readable JSON", false);

program
  .command("preflight")
  .description("validate local configuration and dependencies")
  .action(async (_options: unknown, command: Command) => {
    await withRuntime(command, async (runtime) => {
      const results = await runPreflight(runtime);
      print(results, command.optsWithGlobals<GlobalOptions>().json ?? false);
      if (results.some((result) => result.status === "failure")) {
        process.exitCode = 1;
      }
    });
  });

program
  .command("interface")
  .alias("ui")
  .description("open the local MoneyPrinter control center")
  .option("--port <number>", "local HTTP port", "4317")
  .option("--no-open", "do not open the browser automatically")
  .action(
    async (options: { port: string; open: boolean }, command: Command) => {
      const port = Number.parseInt(options.port, 10);
      if (!Number.isInteger(port) || port < 0 || port > 65_535) {
        throw new Error("--port must be an integer between 0 and 65535");
      }
      await runDashboard({
        port,
        openBrowser: options.open,
        ...(command.optsWithGlobals<GlobalOptions>().config === undefined
          ? {}
          : { configPath: command.optsWithGlobals<GlobalOptions>().config }),
      });
    },
  );

const databaseCommand = program
  .command("db")
  .description("manage the local database");
databaseCommand
  .command("migrate")
  .description("apply pending database migrations")
  .action(async (_options: unknown, command: Command) => {
    await withRuntime(command, (runtime) => {
      print({ database: runtime.database.path, status: "ready" }, true);
    });
  });

program
  .command("migrate-from-python")
  .description("import legacy .mp JSON state without deleting the source files")
  .option("--source <path>", "legacy .mp directory or its parent", ".mp")
  .option("--dry-run", "inspect and validate without importing", false)
  .action(
    async (options: { source: string; dryRun: boolean }, command: Command) => {
      await withRuntime(command, (runtime) => {
        const report = new LegacyMigrationService(runtime).migrate(
          options.source,
          options.dryRun,
        );
        print(report, command.optsWithGlobals<GlobalOptions>().json ?? false);
      });
    },
  );

const accountCommand = program
  .command("account")
  .description("manage publishing accounts");
accountCommand
  .command("list")
  .description("list accounts")
  .action(async (_options: unknown, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(
        runtime.accounts.list(),
        command.optsWithGlobals<GlobalOptions>().json ?? false,
      );
    });
  });

accountCommand
  .command("add")
  .description("add an account")
  .requiredOption("--platform <platform>", platforms.join(", "))
  .requiredOption("--nickname <nickname>")
  .requiredOption("--niche <niche>")
  .option("--language <language>", "content language", "English")
  .option("--browser-profile <path>", "dedicated browser profile")
  .action(
    async (
      options: {
        platform: string;
        nickname: string;
        niche: string;
        language: string;
        browserProfile?: string;
      },
      command: Command,
    ) => {
      const input: NewAccount = {
        platform: parsePlatform(options.platform),
        nickname: options.nickname,
        niche: options.niche,
        language: options.language,
        ...(options.browserProfile === undefined
          ? {}
          : { browserProfilePath: options.browserProfile }),
      };
      await withRuntime(command, (runtime) => {
        print(
          runtime.accounts.create(input),
          command.optsWithGlobals<GlobalOptions>().json ?? false,
        );
      });
    },
  );

const authCommand = program
  .command("auth")
  .description("connect accounts and manage credentials in macOS Keychain");

authCommand
  .command("list")
  .description("list account connection status without exposing credentials")
  .action(async (_options: unknown, command: Command) => {
    await withRuntime(command, async (runtime) => {
      const authentication = createAccountAuthenticationService(runtime);
      const statuses = await Promise.all(
        runtime.accounts
          .list()
          .map((account) => authentication.status(account.id)),
      );
      print(statuses, command.optsWithGlobals<GlobalOptions>().json ?? false);
    });
  });

authCommand
  .command("connect")
  .description("start the platform-specific account connection flow")
  .requiredOption("--account <id>")
  .option("--identifier <identifier>", "Bluesky handle or email")
  .option(
    "--password-env <name>",
    "environment variable holding a Bluesky app password",
    "BLUESKY_APP_PASSWORD",
  )
  .option("--no-open", "do not open the authorization URL")
  .action(
    async (
      options: {
        account: string;
        identifier?: string;
        passwordEnv: string;
        open: boolean;
      },
      command: Command,
    ) => {
      await withRuntime(command, async (runtime) => {
        const account = runtime.accounts.findById(options.account);
        if (account === null) {
          throw new Error(`Account not found: ${options.account}`);
        }
        const authentication = createAccountAuthenticationService(runtime);
        if (account.platform === "bluesky") {
          const password = process.env[options.passwordEnv];
          if (options.identifier === undefined || password === undefined) {
            throw new Error(
              `Bluesky requires --identifier and ${options.passwordEnv}`,
            );
          }
          print(
            await authentication.connectBluesky(
              account.id,
              options.identifier,
              password,
            ),
            command.optsWithGlobals<GlobalOptions>().json ?? false,
          );
          return;
        }
        if (account.platform === "twitter") {
          print(
            await authentication.connectTwitter(account.id),
            command.optsWithGlobals<GlobalOptions>().json ?? false,
          );
          return;
        }
        const start = await authentication.startOAuth(account.id);
        if (options.open && process.platform === "darwin") {
          await execa("open", [start.authorizationUrl], { reject: false });
        }
        print(
          {
            ...start,
            next: `moneyprinter auth complete --account ${account.id} --code <callback-code> --state ${start.state}`,
          },
          true,
        );
      });
    },
  );

authCommand
  .command("complete")
  .description("complete an OAuth callback and store the resulting credentials")
  .requiredOption("--account <id>")
  .requiredOption("--code <code>")
  .requiredOption("--state <state>")
  .action(
    async (
      options: { account: string; code: string; state: string },
      command: Command,
    ) => {
      await withRuntime(command, async (runtime) => {
        const authentication = createAccountAuthenticationService(runtime);
        print(
          await authentication.completeOAuth(
            options.account,
            options.code,
            options.state,
          ),
          command.optsWithGlobals<GlobalOptions>().json ?? false,
        );
      });
    },
  );

authCommand
  .command("import-token")
  .description("import an existing token from an environment variable")
  .requiredOption("--account <id>")
  .option(
    "--token-env <name>",
    "environment variable holding the access token",
    "MPV2_AUTH_TOKEN",
  )
  .option("--external-id <id>", "platform user, page, or organization ID")
  .option("--display-name <name>")
  .action(
    async (
      options: {
        account: string;
        tokenEnv: string;
        externalId?: string;
        displayName?: string;
      },
      command: Command,
    ) => {
      const token = process.env[options.tokenEnv];
      if (token === undefined) {
        throw new Error(`Missing ${options.tokenEnv}`);
      }
      await withRuntime(command, async (runtime) => {
        const authentication = createAccountAuthenticationService(runtime);
        print(
          await authentication.importAccessToken(
            options.account,
            token,
            options.externalId,
            options.displayName,
          ),
          command.optsWithGlobals<GlobalOptions>().json ?? false,
        );
      });
    },
  );

authCommand
  .command("status")
  .requiredOption("--account <id>")
  .action(async (options: { account: string }, command: Command) => {
    await withRuntime(command, async (runtime) => {
      print(
        await createAccountAuthenticationService(runtime).status(
          options.account,
        ),
        true,
      );
    });
  });

authCommand
  .command("revoke")
  .description("remove stored credentials for an account")
  .requiredOption("--account <id>")
  .action(async (options: { account: string }, command: Command) => {
    await withRuntime(command, async (runtime) => {
      print(
        await createAccountAuthenticationService(runtime).revoke(
          options.account,
        ),
        true,
      );
    });
  });

const youtubeCommand = program
  .command("youtube")
  .description("generate and publish YouTube Shorts");
youtubeCommand
  .command("generate")
  .description("generate a YouTube Short immediately")
  .requiredOption("--account <id>", "YouTube account ID")
  .option("--content <id>", "resume an existing content item")
  .option("--music <path>", "background music file")
  .option("--enqueue", "enqueue the generation for a worker", false)
  .action(
    async (
      options: {
        account: string;
        content?: string;
        music?: string;
        enqueue: boolean;
      },
      command: Command,
    ) => {
      await withRuntime(command, async (runtime) => {
        const account = runtime.accounts.findById(options.account);
        if (account === null) {
          throw new Error(`Account not found: ${options.account}`);
        }
        if (options.enqueue) {
          const content =
            options.content === undefined
              ? runtime.content.create(account.id, "youtube-short")
              : runtime.content.findById(options.content);
          if (content === null) {
            throw new Error(`Content item not found: ${options.content}`);
          }
          const job = runtime.jobs.enqueue({
            type: "youtube.generate",
            payload: {
              accountId: account.id,
              contentItemId: content.id,
              ...(options.music === undefined
                ? {}
                : { backgroundMusicPath: options.music }),
            },
            idempotencyKey: `youtube.generate:${content.id}`,
            maximumAttempts: runtime.loadedConfig.config.worker.maximumAttempts,
          });
          print(job, command.optsWithGlobals<GlobalOptions>().json ?? false);
          return;
        }

        const generated = await createYouTubeGenerator(runtime).execute({
          account,
          ...(options.content === undefined
            ? {}
            : { contentItemId: options.content }),
          ...(options.music === undefined
            ? {}
            : { backgroundMusicPath: options.music }),
        });
        print(
          generated,
          command.optsWithGlobals<GlobalOptions>().json ?? false,
        );
      });
    },
  );

youtubeCommand
  .command("list")
  .option("--account <id>", "filter by account")
  .action(async (options: { account?: string }, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(
        runtime.content.list(options.account),
        command.optsWithGlobals<GlobalOptions>().json ?? false,
      );
    });
  });

youtubeCommand
  .command("publish")
  .description("upload a rendered Short through the YouTube Data API")
  .requiredOption("--account <id>")
  .requiredOption("--content <id>")
  .option("--privacy <status>", "private, unlisted, or public", "private")
  .option("--enqueue", "enqueue publishing for a worker", false)
  .action(
    async (
      options: {
        account: string;
        content: string;
        privacy: string;
        enqueue: boolean;
      },
      command: Command,
    ) => {
      if (
        !(["private", "unlisted", "public"] as const).some(
          (value) => value === options.privacy,
        )
      ) {
        throw new Error("--privacy must be private, unlisted, or public");
      }
      const privacyStatus = options.privacy as
        "private" | "unlisted" | "public";
      await withRuntime(command, async (runtime) => {
        const account = runtime.accounts.findById(options.account);
        const content = runtime.content.findById(options.content);
        if (account === null || content === null) {
          throw new Error("Account or content item was not found");
        }
        if (options.enqueue) {
          const job = runtime.jobs.enqueue({
            type: "youtube.publish",
            payload: {
              accountId: account.id,
              contentItemId: content.id,
              privacyStatus,
            },
            idempotencyKey: `youtube.publish:${content.id}:${account.id}`,
            maximumAttempts: runtime.loadedConfig.config.worker.maximumAttempts,
          });
          print(job, command.optsWithGlobals<GlobalOptions>().json ?? false);
          return;
        }
        const published = await createYouTubePublisher(runtime).execute(
          account,
          content,
          privacyStatus,
        );
        print(
          published,
          command.optsWithGlobals<GlobalOptions>().json ?? false,
        );
      });
    },
  );

const socialCommand = program
  .command("social")
  .description("publish text to connected social accounts");

socialCommand
  .command("post")
  .requiredOption("--account <id>")
  .requiredOption("--text <text>")
  .action(
    async (options: { account: string; text: string }, command: Command) => {
      await withRuntime(command, async (runtime) => {
        const account = runtime.accounts.findById(options.account);
        if (account === null) {
          throw new Error(`Account not found: ${options.account}`);
        }
        if (account.platform !== "bluesky" && account.platform !== "linkedin") {
          throw new Error(
            "social post currently supports Bluesky and LinkedIn accounts",
          );
        }
        const created = runtime.content.create(account.id, "social-post");
        const content = runtime.content.update(created.id, {
          state: "ready",
          script: options.text,
          metadata: { postText: options.text },
        });
        print(
          await createSocialPublisher(runtime, account.platform).execute(
            account,
            content,
          ),
          command.optsWithGlobals<GlobalOptions>().json ?? false,
        );
      });
    },
  );

const twitterCommand = program
  .command("twitter")
  .description("generate and publish Twitter posts");
twitterCommand
  .command("generate")
  .requiredOption("--account <id>")
  .option("--subject <subject>")
  .option("--enqueue", "enqueue generation for a worker", false)
  .action(
    async (
      options: { account: string; subject?: string; enqueue: boolean },
      command: Command,
    ) => {
      await withRuntime(command, async (runtime) => {
        const account = runtime.accounts.findById(options.account);
        if (account === null) {
          throw new Error(`Account not found: ${options.account}`);
        }
        if (options.enqueue) {
          const job = runtime.jobs.enqueue({
            type: "twitter.generate",
            payload: {
              accountId: account.id,
              ...(options.subject === undefined
                ? {}
                : { subject: options.subject }),
            },
            idempotencyKey: `twitter.generate:${account.id}:${crypto.randomUUID()}`,
            maximumAttempts: runtime.loadedConfig.config.worker.maximumAttempts,
          });
          print(job, command.optsWithGlobals<GlobalOptions>().json ?? false);
          return;
        }
        const content = await createTwitterGenerator(runtime).execute(
          account,
          options.subject,
        );
        print(content, command.optsWithGlobals<GlobalOptions>().json ?? false);
      });
    },
  );

twitterCommand
  .command("post")
  .requiredOption("--account <id>")
  .option("--content <id>", "publish an existing generated post")
  .option("--text <text>", "publish supplied text")
  .option("--enqueue", "enqueue publishing for a worker", false)
  .action(
    async (
      options: {
        account: string;
        content?: string;
        text?: string;
        enqueue: boolean;
      },
      command: Command,
    ) => {
      await withRuntime(command, async (runtime) => {
        const account = runtime.accounts.findById(options.account);
        if (account === null) {
          throw new Error(`Account not found: ${options.account}`);
        }
        let content =
          options.content === undefined
            ? null
            : runtime.content.findById(options.content);
        if (content === null && options.text !== undefined) {
          const created = runtime.content.create(account.id, "twitter-post");
          content = runtime.content.update(created.id, {
            state: "ready",
            script: options.text,
            metadata: { postText: options.text },
          });
        }
        if (content === null) {
          throw new Error("Provide --content or --text");
        }
        if (options.enqueue) {
          const job = runtime.jobs.enqueue({
            type: "twitter.publish",
            payload: { accountId: account.id, contentItemId: content.id },
            idempotencyKey: `twitter.publish:${content.id}:${account.id}`,
            maximumAttempts: runtime.loadedConfig.config.worker.maximumAttempts,
          });
          print(job, command.optsWithGlobals<GlobalOptions>().json ?? false);
          return;
        }
        const published = await createTwitterPublisher(runtime).execute(
          account,
          content,
        );
        print(
          published,
          command.optsWithGlobals<GlobalOptions>().json ?? false,
        );
      });
    },
  );

twitterCommand
  .command("list")
  .option("--account <id>")
  .action(async (options: { account?: string }, command: Command) => {
    await withRuntime(command, (runtime) => {
      const content = runtime.content
        .list(options.account)
        .filter(
          (item) =>
            item.kind === "twitter-post" || item.kind === "affiliate-pitch",
        );
      print(content, command.optsWithGlobals<GlobalOptions>().json ?? false);
    });
  });

const affiliateCommand = program
  .command("affiliate")
  .description("manage affiliate products and pitches");
affiliateCommand
  .command("add")
  .requiredOption("--source-url <url>")
  .requiredOption("--affiliate-url <url>")
  .requiredOption("--account <id>", "Twitter account ID")
  .action(
    async (
      options: { sourceUrl: string; affiliateUrl: string; account: string },
      command: Command,
    ) => {
      await withRuntime(command, (runtime) => {
        const account = runtime.accounts.findById(options.account);
        if (account?.platform !== "twitter") {
          throw new Error(`Twitter account not found: ${options.account}`);
        }
        const product = runtime.affiliate.create(
          new URL(options.sourceUrl).href,
          new URL(options.affiliateUrl).href,
          account.id,
        );
        print(product, command.optsWithGlobals<GlobalOptions>().json ?? false);
      });
    },
  );

affiliateCommand
  .command("list")
  .action(async (_options: unknown, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(
        runtime.affiliate.list(),
        command.optsWithGlobals<GlobalOptions>().json ?? false,
      );
    });
  });

affiliateCommand
  .command("run")
  .requiredOption("--product <id>")
  .option("--publish", "publish the generated pitch to Twitter", false)
  .option("--enqueue", "enqueue for a worker", false)
  .action(
    async (
      options: { product: string; publish: boolean; enqueue: boolean },
      command: Command,
    ) => {
      await withRuntime(command, async (runtime) => {
        const product = runtime.affiliate.findById(options.product);
        const account =
          product?.accountId === null || product?.accountId === undefined
            ? null
            : runtime.accounts.findById(product.accountId);
        if (product === null || account === null) {
          throw new Error("Affiliate product or linked account was not found");
        }
        if (options.enqueue) {
          const job = runtime.jobs.enqueue({
            type: "affiliate.run",
            payload: { productId: product.id, publish: options.publish },
            idempotencyKey: `affiliate.run:${product.id}:${crypto.randomUUID()}`,
            maximumAttempts: runtime.loadedConfig.config.worker.maximumAttempts,
          });
          print(job, command.optsWithGlobals<GlobalOptions>().json ?? false);
          return;
        }
        const result = await createAffiliateCampaign(runtime).execute(
          product,
          account,
        );
        if (options.publish) {
          await createTwitterPublisher(runtime).execute(
            account,
            result.content,
          );
        }
        print(result, command.optsWithGlobals<GlobalOptions>().json ?? false);
      });
    },
  );

const outreachCommand = program
  .command("outreach")
  .description("manage controlled outreach campaigns");
outreachCommand
  .command("create")
  .requiredOption("--name <name>")
  .requiredOption("--niche <niche>")
  .requiredOption("--subject <subject>")
  .requiredOption("--body <html>")
  .action(
    async (
      options: { name: string; niche: string; subject: string; body: string },
      command: Command,
    ) => {
      await withRuntime(command, (runtime) => {
        const config = runtime.loadedConfig.config;
        const campaign = runtime.outreach.createCampaign({
          name: options.name,
          niche: options.niche,
          subject: options.subject,
          bodyTemplate: options.body,
          dailyLimit: config.safety.outreachDailyLimit,
          perDomainLimit: config.safety.outreachPerDomainLimit,
        });
        print(campaign, command.optsWithGlobals<GlobalOptions>().json ?? false);
      });
    },
  );

outreachCommand
  .command("list")
  .action(async (_options: unknown, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(
        runtime.outreach.listCampaigns(),
        command.optsWithGlobals<GlobalOptions>().json ?? false,
      );
    });
  });

outreachCommand
  .command("discover")
  .requiredOption("--campaign <id>")
  .option("--limit <number>", "maximum leads", "25")
  .option("--enqueue", "enqueue for a worker", false)
  .action(
    async (
      options: { campaign: string; limit: string; enqueue: boolean },
      command: Command,
    ) => {
      await withRuntime(command, async (runtime) => {
        const campaign = runtime.outreach.findCampaign(options.campaign);
        if (campaign === null) {
          throw new Error(`Campaign not found: ${options.campaign}`);
        }
        const limit = Number.parseInt(options.limit, 10);
        if (options.enqueue) {
          const job = runtime.jobs.enqueue({
            type: "outreach.discover",
            payload: { campaignId: campaign.id, limit },
            idempotencyKey: `outreach.discover:${campaign.id}:${crypto.randomUUID()}`,
            maximumAttempts: runtime.loadedConfig.config.worker.maximumAttempts,
          });
          print(job, command.optsWithGlobals<GlobalOptions>().json ?? false);
          return;
        }
        const leads = await createOutreachDiscovery(runtime).execute(
          campaign,
          limit,
        );
        print(leads, command.optsWithGlobals<GlobalOptions>().json ?? false);
      });
    },
  );

outreachCommand
  .command("preview")
  .requiredOption("--campaign <id>")
  .action(async (options: { campaign: string }, command: Command) => {
    await withRuntime(command, (runtime) => {
      const campaign = runtime.outreach.findCampaign(options.campaign);
      if (campaign === null) {
        throw new Error(`Campaign not found: ${options.campaign}`);
      }
      print(
        {
          campaign,
          leads: runtime.outreach.listLeads(campaign.id),
          attempts: runtime.outreach.listAttempts(campaign.id),
        },
        true,
      );
    });
  });

outreachCommand
  .command("approve")
  .requiredOption("--campaign <id>")
  .action(async (options: { campaign: string }, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(runtime.outreach.approveCampaign(options.campaign), true);
    });
  });

outreachCommand
  .command("run")
  .requiredOption("--campaign <id>")
  .option("--enqueue", "enqueue for a worker", false)
  .action(
    async (
      options: { campaign: string; enqueue: boolean },
      command: Command,
    ) => {
      await withRuntime(command, async (runtime) => {
        const campaign = runtime.outreach.findCampaign(options.campaign);
        if (campaign === null) {
          throw new Error(`Campaign not found: ${options.campaign}`);
        }
        if (options.enqueue) {
          const job = runtime.jobs.enqueue({
            type: "outreach.run",
            payload: { campaignId: campaign.id },
            idempotencyKey: `outreach.run:${campaign.id}:${campaign.approvedAt ?? "unapproved"}`,
            maximumAttempts: runtime.loadedConfig.config.worker.maximumAttempts,
          });
          print(job, command.optsWithGlobals<GlobalOptions>().json ?? false);
          return;
        }
        const result = await createOutreachRunner(runtime).execute(campaign);
        print(result, command.optsWithGlobals<GlobalOptions>().json ?? false);
      });
    },
  );

const jobCommand = program.command("job").description("manage durable jobs");
jobCommand
  .command("list")
  .option("--limit <number>", "maximum rows", "100")
  .action(async (options: { limit: string }, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(
        runtime.jobs.list(Number.parseInt(options.limit, 10)),
        command.optsWithGlobals<GlobalOptions>().json ?? false,
      );
    });
  });

jobCommand
  .command("retry <job-id>")
  .description("retry a failed job")
  .action(async (jobId: string, _options: unknown, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(
        runtime.jobs.retry(jobId),
        command.optsWithGlobals<GlobalOptions>().json ?? false,
      );
    });
  });

jobCommand
  .command("cancel <job-id>")
  .description("cancel a queued or running job")
  .action(async (jobId: string, _options: unknown, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(
        runtime.jobs.cancel(jobId),
        command.optsWithGlobals<GlobalOptions>().json ?? false,
      );
    });
  });

const scheduleCommand = program
  .command("schedule")
  .description("manage durable schedules");
scheduleCommand
  .command("list")
  .description("list schedules")
  .action(async (_options: unknown, command: Command) => {
    await withRuntime(command, (runtime) => {
      print(
        runtime.schedules.list(),
        command.optsWithGlobals<GlobalOptions>().json ?? false,
      );
    });
  });

scheduleCommand
  .command("add")
  .description("create a schedule")
  .requiredOption("--name <name>")
  .requiredOption("--job-type <type>")
  .requiredOption("--cron <expression>")
  .option("--timezone <timezone>", "IANA timezone", "UTC")
  .option("--payload <json>", "job payload JSON", "{}")
  .action(
    async (
      options: {
        name: string;
        jobType: string;
        cron: string;
        timezone: string;
        payload: string;
      },
      command: Command,
    ) => {
      await withRuntime(command, (runtime) => {
        const scheduler = new SchedulerService(
          runtime.schedules,
          runtime.jobs,
          runtime.loadedConfig.config.worker.maximumAttempts,
        );
        const schedule = scheduler.create({
          name: options.name,
          jobType: options.jobType,
          payload: parseObject(options.payload),
          cronExpression: options.cron,
          timezone: options.timezone,
        });
        print(schedule, command.optsWithGlobals<GlobalOptions>().json ?? false);
      });
    },
  );

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(`moneyprinter: ${errorMessage(error)}\n`);
  process.exitCode = 1;
});
