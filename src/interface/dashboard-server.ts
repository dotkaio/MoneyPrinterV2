import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, resolve, sep } from "node:path";

import { z } from "zod";

import { MacOsKeychainSecretVault } from "../adapters/auth/macos-keychain-secret-vault.js";
import { AiProviderConnectionService } from "../application/ai-provider-connection-service.js";
import {
  createProviderTextGenerator,
  type ProviderTextGeneratorFactory,
} from "../application/create-provider-text-generator.js";
import { GenerateContentCreation } from "../application/generate-content-creation.js";
import { runPreflight } from "../application/preflight.js";
import { aiProviderKinds } from "../domain/model.js";
import type { SecretVault } from "../ports/secrets.js";
import type { Runtime } from "../runtime.js";
import { AppError, errorMessage } from "../shared/errors.js";
import type { DashboardOverview } from "./dashboard-contract.js";

export type { DashboardOverview } from "./dashboard-contract.js";

export interface DashboardServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export interface StartDashboardOptions {
  port?: number;
  assetDirectory?: string;
  secretVault?: SecretVault;
  providerTextGeneratorFactory?: ProviderTextGeneratorFactory;
}

interface DashboardServices {
  providers: AiProviderConnectionService;
  creation: GenerateContentCreation;
}

class DashboardRequestError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DashboardRequestError";
  }
}

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function createDashboardOverview(runtime: Runtime): DashboardOverview {
  const accounts = runtime.accounts.list();
  const connectionByAccountId = new Map(
    runtime.connections
      .list()
      .map((connection) => [connection.accountId, connection] as const),
  );
  const jobs = runtime.jobs.list(100);
  const schedules = runtime.schedules.list();
  const activeProvider = runtime.aiProviders.findActive();
  return {
    generatedAt: new Date().toISOString(),
    databasePath: runtime.database.path,
    configurationPath: runtime.loadedConfig.configPath,
    safety: {
      livePublishing: runtime.loadedConfig.config.safety.livePublishing,
      outreachSending: runtime.loadedConfig.config.safety.outreachSending,
    },
    counts: {
      accounts: accounts.length,
      connectedAccounts: accounts.filter(
        (account) =>
          connectionByAccountId.get(account.id)?.state === "connected",
      ).length,
      contentItems: runtime.content.list().length,
      creations: runtime.creations.count(),
      activeJobs: jobs.filter(
        (job) => job.state === "queued" || job.state === "running",
      ).length,
      schedules: schedules.filter((schedule) => schedule.enabled).length,
    },
    activeProvider:
      activeProvider === null
        ? null
        : { kind: activeProvider.kind, model: activeProvider.model },
    accounts: accounts.map((account) => {
      const connection = connectionByAccountId.get(account.id);
      return {
        id: account.id,
        platform: account.platform,
        nickname: account.nickname,
        niche: account.niche,
        language: account.language,
        connectionState: connection?.state ?? "not-connected",
        displayName: connection?.displayName ?? null,
        expiresAt: connection?.expiresAt ?? null,
      };
    }),
    jobs: jobs
      .slice(-12)
      .reverse()
      .map((job) => ({
        id: job.id,
        type: job.type,
        state: job.state,
        attemptCount: job.attemptCount,
        maximumAttempts: job.maximumAttempts,
        runAt: job.runAt,
        updatedAt: job.updatedAt,
        lastError: job.lastError,
      })),
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      jobType: schedule.jobType,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      enabled: schedule.enabled,
      nextRunAt: schedule.nextRunAt,
    })),
  };
}

export async function startDashboard(
  runtime: Runtime,
  options: StartDashboardOptions = {},
): Promise<DashboardServer> {
  const port = options.port ?? 4317;
  const assetDirectory = resolve(
    options.assetDirectory ?? resolve(process.cwd(), "dist/interface-web"),
  );
  const providers = new AiProviderConnectionService(
    runtime.aiProviders,
    options.secretVault ??
      new MacOsKeychainSecretVault(
        `${runtime.loadedConfig.config.authentication.keychainService}.providers`,
      ),
    options.providerTextGeneratorFactory ?? createProviderTextGenerator,
  );
  const services: DashboardServices = {
    providers,
    creation: new GenerateContentCreation(runtime.creations, providers),
  };
  const server = createServer((request, response) => {
    void handleRequest(runtime, services, assetDirectory, request, response);
  });
  await new Promise<void>((resolveListen, reject) => {
    const handleError = (error: Error): void => reject(error);
    server.once("error", handleError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", handleError);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Dashboard server did not expose a TCP address");
  }
  const url = `http://127.0.0.1:${address.port}`;
  return {
    server,
    url,
    close: () =>
      new Promise<void>((resolveClose, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolveClose();
          } else {
            reject(error);
          }
        });
      }),
  };
}

async function handleRequest(
  runtime: Runtime,
  services: DashboardServices,
  assetDirectory: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  setSecurityHeaders(response);
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(runtime, services, url, request, response);
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    await serveApplication(assetDirectory, url.pathname, response);
  } catch (error) {
    const status = requestErrorStatus(error);
    sendJson(response, status, {
      error: errorMessage(error),
      ...(error instanceof AppError ? { code: error.code } : {}),
    });
  }
}

async function handleApiRequest(
  runtime: Runtime,
  services: DashboardServices,
  url: URL,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const method = request.method ?? "GET";
  if (method === "GET" && url.pathname === "/api/overview") {
    sendJson(response, 200, createDashboardOverview(runtime));
    return;
  }
  if (method === "GET" && url.pathname === "/api/preflight") {
    sendJson(response, 200, await runPreflight(runtime));
    return;
  }
  if (method === "GET" && url.pathname === "/api/providers") {
    sendJson(response, 200, await services.providers.list());
    return;
  }
  if (method === "GET" && url.pathname === "/api/creations") {
    sendJson(response, 200, runtime.creations.list());
    return;
  }
  if (method === "POST" && url.pathname === "/api/providers") {
    assertTrustedOrigin(request);
    sendJson(
      response,
      200,
      await services.providers.connect(await readJsonBody(request)),
    );
    return;
  }
  if (method === "POST" && url.pathname === "/api/creations") {
    assertTrustedOrigin(request);
    sendJson(
      response,
      201,
      await services.creation.execute(await readJsonBody(request)),
    );
    return;
  }

  const providerMatch = /^\/api\/providers\/([^/]+)$/u.exec(url.pathname);
  if (method === "DELETE" && providerMatch !== null) {
    assertTrustedOrigin(request);
    const kind = z.enum(aiProviderKinds).parse(providerMatch[1]);
    await services.providers.disconnect(kind);
    response.statusCode = 204;
    response.end();
    return;
  }

  const knownPath =
    url.pathname === "/api/overview" ||
    url.pathname === "/api/preflight" ||
    url.pathname === "/api/providers" ||
    url.pathname === "/api/creations" ||
    providerMatch !== null;
  sendJson(response, knownPath ? 405 : 404, {
    error: knownPath ? "Method not allowed" : "Not found",
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new DashboardRequestError(
      "API requests must use application/json",
      415,
    );
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Uint8Array>) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) {
      throw new DashboardRequestError("API request is too large", 413);
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    throw new DashboardRequestError(
      `API request contains invalid JSON: ${errorMessage(error)}`,
      400,
    );
  }
}

function assertTrustedOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (
    origin !== undefined &&
    (host === undefined || origin !== `http://${host}`)
  ) {
    throw new DashboardRequestError("Request origin is not allowed", 403);
  }
}

function requestErrorStatus(error: unknown): number {
  if (error instanceof DashboardRequestError) {
    return error.status;
  }
  if (error instanceof z.ZodError) {
    return 400;
  }
  if (error instanceof AppError) {
    if (error.code === "AI_PROVIDER_NOT_CONNECTED") {
      return 409;
    }
    if (
      error.code === "AI_PROVIDER_REQUEST_FAILED" ||
      error.code === "AI_PROVIDER_KEY_MISSING"
    ) {
      return 400;
    }
  }
  return 500;
}

async function serveApplication(
  assetDirectory: string,
  pathname: string,
  response: ServerResponse,
): Promise<void> {
  const decodedPath = decodeURIComponent(pathname);
  const candidate = resolve(assetDirectory, `.${decodedPath}`);
  const safeCandidate = candidate.startsWith(`${assetDirectory}${sep}`);
  const asset = safeCandidate ? await readOptionalFile(candidate) : null;
  if (asset !== null) {
    response.setHeader(
      "cache-control",
      decodedPath.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    send(
      response,
      200,
      contentTypes[extname(candidate).toLowerCase()] ??
        "application/octet-stream",
      asset,
    );
    return;
  }

  const index = await readFile(resolve(assetDirectory, "index.html"));
  response.setHeader("cache-control", "no-store");
  send(response, 200, "text/html; charset=utf-8", index);
}

async function readOptionalFile(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "EISDIR")
    ) {
      return null;
    }
    throw error;
  }
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; connect-src 'self'; font-src 'self' data:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.setHeader("cache-control", "no-store");
  send(
    response,
    status,
    "application/json; charset=utf-8",
    `${JSON.stringify(value)}\n`,
  );
}

function send(
  response: ServerResponse,
  status: number,
  contentType: string,
  body: string | Uint8Array,
): void {
  response.statusCode = status;
  response.setHeader("content-type", contentType);
  response.end(body);
}
