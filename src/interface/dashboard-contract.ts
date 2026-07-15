import type { AiProviderKind } from "../domain/model.js";

export interface DashboardOverview {
  generatedAt: string;
  databasePath: string;
  configurationPath: string | null;
  safety: {
    livePublishing: boolean;
    outreachSending: boolean;
  };
  counts: {
    accounts: number;
    connectedAccounts: number;
    contentItems: number;
    creations: number;
    activeJobs: number;
    schedules: number;
  };
  activeProvider: {
    kind: string;
    model: string;
  } | null;
  accounts: readonly {
    id: string;
    platform: string;
    nickname: string;
    niche: string;
    language: string;
    connectionState: string;
    displayName: string | null;
    expiresAt: string | null;
  }[];
  jobs: readonly {
    id: string;
    type: string;
    state: string;
    attemptCount: number;
    maximumAttempts: number;
    runAt: string;
    updatedAt: string;
    lastError: string | null;
  }[];
  schedules: readonly {
    id: string;
    name: string;
    jobType: string;
    cronExpression: string;
    timezone: string;
    enabled: boolean;
    nextRunAt: string;
  }[];
}

export interface AiProviderConnectionDto {
  kind: AiProviderKind;
  name: string;
  description: string;
  access: "free-tier" | "paid";
  accessNote: string;
  baseUrl: string;
  defaultModel: string;
  models: readonly string[];
  keyPlaceholder: string;
  keyUrl: string;
  connected: boolean;
  active: boolean;
  model: string;
  updatedAt: string | null;
}

export interface ContentCreationDto {
  id: string;
  format: "short-video" | "social-post" | "newsletter" | "ad-copy";
  topic: string;
  audience: string;
  tone: string;
  language: string;
  title: string;
  hook: string;
  script: string;
  caption: string;
  hashtags: readonly string[];
  providerKind: AiProviderConnectionDto["kind"];
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface PreflightResult {
  name: string;
  status: "ok" | "warning" | "failure";
  detail: string;
}
