import { z } from "zod";

import { networkApiRequest } from "@/lib/network-api";
import { aiProviderCatalog } from "../../../application/ai-provider-catalog.js";
import { aiProviderKinds } from "../../../domain/model.js";
import type {
  AiProviderConnectionDto,
  ContentCreationDto,
  DashboardOverview,
  PreflightResult,
} from "../../dashboard-contract";

const providerKinds = aiProviderKinds;

const storedProviderSchema = z.object({
  apiKey: z.string().min(8).max(1000),
  model: z.string().min(1).max(200),
  updatedAt: z.iso.datetime(),
});

const providerStoreSchema = z.object({
  activeKind: z.enum(providerKinds).nullable(),
  providers: z.partialRecord(z.enum(providerKinds), storedProviderSchema),
});

const connectProviderSchema = z.object({
  kind: z.enum(providerKinds),
  apiKey: z.string().trim().min(8).max(1000).optional(),
  model: z.string().trim().min(1).max(200),
});

const createContentSchema = z.object({
  format: z.enum(["short-video", "social-post", "newsletter", "ad-copy"]),
  topic: z.string().trim().min(3).max(500),
  audience: z.string().trim().min(2).max(300),
  tone: z.string().trim().min(2).max(100),
  language: z.string().trim().min(2).max(100),
});

const contentCreationSchema = createContentSchema.extend({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  hook: z.string().min(1).max(500),
  script: z.string().min(1).max(15_000),
  caption: z.string().min(1).max(3000),
  hashtags: z.array(z.string().min(1).max(100)).max(20),
  providerKind: z.enum(providerKinds),
  model: z.string().min(1).max(200),
  promptTokens: z.number().int().nonnegative().nullable(),
  completionTokens: z.number().int().nonnegative().nullable(),
  durationMs: z.number().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const providerStorageKey = "moneyprinter.web.providers.v1";
const creationsStorageKey = "moneyprinter.web.creations.v1";

type ProviderStore = z.output<typeof providerStoreSchema>;

export async function browserApiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";

  if (path === "/api/providers" && method === "GET") {
    return listProviders() as T;
  }
  if (path === "/api/providers" && method === "POST") {
    return connectProvider(parseBody(init)) as Promise<T>;
  }
  if (path.startsWith("/api/providers/") && method === "DELETE") {
    disconnectProvider(path.slice("/api/providers/".length));
    return undefined as T;
  }
  if (path === "/api/creations" && method === "GET") {
    return readCreations() as T;
  }
  if (path === "/api/creations" && method === "POST") {
    return createContent(parseBody(init)) as Promise<T>;
  }
  if (path === "/api/overview" && method === "GET") {
    return createOverview() as T;
  }
  if (path === "/api/preflight" && method === "GET") {
    return createPreflight() as T;
  }

  return networkApiRequest<T>(path, init);
}

function listProviders(): readonly AiProviderConnectionDto[] {
  const store = readProviderStore();
  return aiProviderCatalog.map((definition) => {
    const profile = store.providers[definition.kind];
    const connected = profile !== undefined;
    return {
      ...definition,
      connected,
      active: connected && store.activeKind === definition.kind,
      model: profile?.model ?? definition.defaultModel,
      updatedAt: profile?.updatedAt ?? null,
    };
  });
}

async function connectProvider(
  input: unknown,
): Promise<AiProviderConnectionDto> {
  const parsed = connectProviderSchema.parse(input);
  const store = readProviderStore();
  const previous = store.providers[parsed.kind];
  const apiKey = parsed.apiKey ?? previous?.apiKey;
  if (apiKey === undefined) {
    throw new Error("Enter an API key to connect this provider");
  }

  await networkApiRequest<{ verified: true; detail: string }>("/api/provider", {
    method: "POST",
    body: JSON.stringify({
      action: "verify",
      kind: parsed.kind,
      apiKey,
      model: parsed.model,
    }),
  });

  const updatedAt = new Date().toISOString();
  writeProviderStore({
    activeKind: parsed.kind,
    providers: {
      ...store.providers,
      [parsed.kind]: { apiKey, model: parsed.model, updatedAt },
    },
  });
  const connection = listProviders().find(
    (provider) => provider.kind === parsed.kind,
  );
  if (connection === undefined) {
    throw new Error("Connected provider is unavailable");
  }
  return connection;
}

function disconnectProvider(kind: string): void {
  const parsedKind = z.enum(providerKinds).parse(kind);
  const store = readProviderStore();
  const providers = Object.fromEntries(
    Object.entries(store.providers).filter(
      ([providerKind]) => providerKind !== parsedKind,
    ),
  );
  writeProviderStore({
    activeKind: store.activeKind === parsedKind ? null : store.activeKind,
    providers,
  });
}

async function createContent(input: unknown): Promise<ContentCreationDto> {
  const parsed = createContentSchema.parse(input);
  const store = readProviderStore();
  if (store.activeKind === null) {
    throw new Error("Connect an AI provider before creating content");
  }
  const profile = store.providers[store.activeKind];
  if (profile === undefined) {
    throw new Error("Reconnect your AI provider before creating content");
  }

  const creation = contentCreationSchema.parse(
    await networkApiRequest<unknown>("/api/provider", {
      method: "POST",
      body: JSON.stringify({
        action: "generate",
        kind: store.activeKind,
        apiKey: profile.apiKey,
        model: profile.model,
        input: parsed,
      }),
    }),
  );
  writeCreations([creation, ...readCreations()].slice(0, 100));
  return creation;
}

function createOverview(): DashboardOverview {
  const providers = listProviders();
  const activeProvider = providers.find((provider) => provider.active) ?? null;
  const creations = readCreations();
  return {
    generatedAt: new Date().toISOString(),
    databasePath: "Browser localStorage · this device",
    configurationPath: "Browser-local provider profile",
    safety: { livePublishing: false, outreachSending: false },
    counts: {
      accounts: 0,
      connectedAccounts: 0,
      contentItems: creations.length,
      creations: creations.length,
      activeJobs: 0,
      schedules: 0,
    },
    activeProvider:
      activeProvider === null
        ? null
        : { kind: activeProvider.kind, model: activeProvider.model },
    accounts: [],
    jobs: [],
    schedules: [],
  };
}

function createPreflight(): readonly PreflightResult[] {
  const activeProvider = listProviders().find((provider) => provider.active);
  const secureTransport = window.location.protocol === "https:";
  return [
    {
      name: "Browser storage",
      status: "ok",
      detail: "Drafts and provider settings stay in this browser.",
    },
    {
      name: "Secure transport",
      status: secureTransport ? "ok" : "warning",
      detail: secureTransport
        ? "Requests use an encrypted HTTPS connection."
        : "Use the production HTTPS URL before entering a real key.",
    },
    {
      name: "AI provider",
      status: activeProvider === undefined ? "warning" : "ok",
      detail:
        activeProvider === undefined
          ? "Connect an API key to start generating."
          : `${activeProvider.name} · ${activeProvider.model}`,
    },
    {
      name: "External actions",
      status: "warning",
      detail: "Publishing and outreach remain disabled in the web app.",
    },
  ];
}

function readProviderStore(): ProviderStore {
  return readStorage(providerStorageKey, providerStoreSchema, {
    activeKind: null,
    providers: {},
  });
}

function writeProviderStore(store: ProviderStore): void {
  writeStorage(providerStorageKey, providerStoreSchema.parse(store));
}

function readCreations(): readonly ContentCreationDto[] {
  return readStorage(
    creationsStorageKey,
    z.array(contentCreationSchema).max(100),
    [],
  );
}

function writeCreations(creations: readonly ContentCreationDto[]): void {
  writeStorage(creationsStorageKey, creations);
}

function readStorage<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : schema.parse(JSON.parse(value));
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    throw new Error("Browser storage is unavailable or full", { cause: error });
  }
}

function parseBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") {
    throw new Error("Request body is missing");
  }
  return JSON.parse(init.body) as unknown;
}
