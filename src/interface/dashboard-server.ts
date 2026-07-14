import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { runPreflight } from "../application/preflight.js";
import type { Runtime } from "../runtime.js";
import { errorMessage } from "../shared/errors.js";
import { dashboardPage } from "./dashboard-page.js";

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
    activeJobs: number;
    schedules: number;
  };
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

export interface DashboardServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export interface StartDashboardOptions {
  port?: number;
}

export function createDashboardOverview(runtime: Runtime): DashboardOverview {
  const accounts = runtime.accounts.list();
  const connectionByAccountId = new Map(
    runtime.connections
      .list()
      .map((connection) => [connection.accountId, connection] as const),
  );
  const jobs = runtime.jobs.list(100);
  const schedules = runtime.schedules.list();
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
      activeJobs: jobs.filter(
        (job) => job.state === "queued" || job.state === "running",
      ).length,
      schedules: schedules.filter((schedule) => schedule.enabled).length,
    },
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
  const server = createServer((request, response) => {
    void handleRequest(runtime, request, response);
  });
  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error): void => reject(error);
    server.once("error", handleError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", handleError);
      resolve();
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
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
  };
}

async function handleRequest(
  runtime: Runtime,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  setSecurityHeaders(response);
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/") {
      send(response, 200, "text/html; charset=utf-8", dashboardPage);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/overview") {
      sendJson(response, 200, createDashboardOverview(runtime));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/preflight") {
      sendJson(response, 200, await runPreflight(runtime));
      return;
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: "Dashboard request failed",
      detail: errorMessage(error),
    });
  }
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
  body: string,
): void {
  response.statusCode = status;
  response.setHeader("content-type", contentType);
  response.end(body);
}
