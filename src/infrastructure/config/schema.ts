import { z } from "zod";

export const appConfigSchema = z.object({
  dataDirectory: z.string().min(1).default("./data"),
  logLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  browser: z
    .object({
      headless: z.boolean().default(false),
    })
    .prefault({}),
  authentication: z
    .object({
      keychainService: z
        .string()
        .min(1)
        .default("com.kaio.moneyprinterv2.auth"),
    })
    .prefault({}),
  providers: z
    .object({
      llm: z
        .object({
          kind: z.literal("ollama").default("ollama"),
          baseUrl: z.url().default("http://127.0.0.1:11434"),
          model: z.string().default(""),
        })
        .prefault({}),
      image: z
        .object({
          kind: z.literal("gemini").default("gemini"),
          baseUrl: z
            .url()
            .default("https://generativelanguage.googleapis.com/v1beta"),
          model: z.string().min(1).default("gemini-3.1-flash-image"),
          apiKeyEnv: z.string().min(1).default("GEMINI_API_KEY"),
          aspectRatio: z.string().min(1).default("9:16"),
        })
        .prefault({}),
      tts: z
        .object({
          kind: z.literal("piper").default("piper"),
          executable: z.string().min(1).default("piper"),
          modelPath: z.string().default(""),
        })
        .prefault({}),
      transcription: z
        .object({
          kind: z.literal("whisper-cpp").default("whisper-cpp"),
          executable: z.string().min(1).default("whisper-cli"),
          modelPath: z.string().default(""),
        })
        .prefault({}),
    })
    .prefault({}),
  media: z
    .object({
      ffmpegPath: z.string().min(1).default("ffmpeg"),
      ffprobePath: z.string().min(1).default("ffprobe"),
      width: z.number().int().positive().default(1080),
      height: z.number().int().positive().default(1920),
      framesPerSecond: z.number().int().min(1).max(60).default(30),
      minimumScenes: z.number().int().min(1).default(4),
      maximumScenes: z.number().int().min(1).max(24).default(12),
      backgroundMusicVolume: z.number().min(0).max(1).default(0.1),
    })
    .refine((value) => value.minimumScenes <= value.maximumScenes, {
      message: "minimumScenes must be less than or equal to maximumScenes",
    })
    .prefault({}),
  publishers: z
    .object({
      youtube: z
        .object({
          clientIdEnv: z.string().min(1).default("YOUTUBE_CLIENT_ID"),
          clientSecretEnv: z.string().min(1).default("YOUTUBE_CLIENT_SECRET"),
          redirectUri: z
            .url()
            .default("http://127.0.0.1:53682/oauth2/callback"),
          uploadBaseUrl: z
            .url()
            .default("https://www.googleapis.com/upload/youtube/v3/videos"),
        })
        .prefault({}),
      twitter: z
        .object({
          baseUrl: z.url().default("https://x.com"),
        })
        .prefault({}),
      bluesky: z
        .object({
          serviceUrl: z.url().default("https://bsky.social"),
        })
        .prefault({}),
      linkedin: z
        .object({
          clientIdEnv: z.string().min(1).default("LINKEDIN_CLIENT_ID"),
          clientSecretEnv: z.string().min(1).default("LINKEDIN_CLIENT_SECRET"),
          redirectUri: z
            .url()
            .default("http://127.0.0.1:53682/oauth2/linkedin"),
          authorizationUrl: z
            .url()
            .default("https://www.linkedin.com/oauth/v2/authorization"),
          tokenUrl: z
            .url()
            .default("https://www.linkedin.com/oauth/v2/accessToken"),
          apiBaseUrl: z.url().default("https://api.linkedin.com"),
          apiVersion: z
            .string()
            .regex(/^\d{6}$/u)
            .default("202605"),
          scopes: z
            .array(z.string().min(1))
            .default(["openid", "profile", "w_member_social"]),
        })
        .prefault({}),
      tiktok: z
        .object({
          clientIdEnv: z.string().min(1).default("TIKTOK_CLIENT_KEY"),
          clientSecretEnv: z.string().min(1).default("TIKTOK_CLIENT_SECRET"),
          redirectUri: z.url().default("https://example.com/oauth2/tiktok"),
          authorizationUrl: z
            .url()
            .default("https://www.tiktok.com/v2/auth/authorize/"),
          tokenUrl: z
            .url()
            .default("https://open.tiktokapis.com/v2/oauth/token/"),
          scopes: z
            .array(z.string().min(1))
            .default(["user.info.basic", "video.publish", "video.upload"]),
        })
        .prefault({}),
      meta: z
        .object({
          clientIdEnv: z.string().min(1).default("META_APP_ID"),
          clientSecretEnv: z.string().min(1).default("META_APP_SECRET"),
          redirectUri: z.url().default("https://example.com/oauth2/meta"),
          authorizationUrl: z
            .url()
            .default("https://www.facebook.com/dialog/oauth"),
          tokenUrl: z
            .url()
            .default("https://graph.facebook.com/oauth/access_token"),
          scopes: z
            .array(z.string().min(1))
            .default([
              "pages_show_list",
              "pages_read_engagement",
              "pages_manage_posts",
              "instagram_basic",
              "instagram_content_publish",
            ]),
        })
        .prefault({}),
    })
    .prefault({}),
  outreach: z
    .object({
      scraperExecutable: z.string().default("google-maps-scraper"),
      scraperTimeoutMs: z.number().int().min(1000).default(300_000),
      websiteTimeoutMs: z.number().int().min(1000).default(15_000),
      maximumWebsiteBytes: z.number().int().min(1024).default(2_000_000),
      sendDelayMs: z.number().int().min(0).default(10_000),
      smtp: z
        .object({
          host: z.string().min(1).default("smtp.gmail.com"),
          port: z.number().int().min(1).max(65535).default(587),
          secure: z.boolean().default(false),
          usernameEnv: z.string().min(1).default("SMTP_USERNAME"),
          passwordEnv: z.string().min(1).default("SMTP_PASSWORD"),
          fromEnv: z.string().min(1).default("SMTP_FROM"),
        })
        .prefault({}),
    })
    .prefault({}),
  worker: z
    .object({
      pollIntervalMs: z.number().int().min(100).default(1000),
      leaseDurationMs: z.number().int().min(1000).default(300_000),
      maximumAttempts: z.number().int().min(1).max(20).default(3),
    })
    .prefault({}),
  safety: z
    .object({
      livePublishing: z.boolean().default(false),
      outreachSending: z.boolean().default(false),
      outreachDailyLimit: z.number().int().min(1).max(500).default(25),
      outreachPerDomainLimit: z.number().int().min(1).max(10).default(1),
    })
    .prefault({}),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
