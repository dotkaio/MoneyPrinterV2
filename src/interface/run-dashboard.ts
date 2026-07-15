import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";

import { createRuntime } from "../runtime.js";
import { startDashboard } from "./dashboard-server.js";

export interface RunDashboardOptions {
  configPath?: string;
  port: number;
  openBrowser: boolean;
}

export async function runDashboard(
  options: RunDashboardOptions,
): Promise<void> {
  const assetDirectory = resolve(
    fileURLToPath(new URL("../..", import.meta.url)),
    "dist/interface-web",
  );
  await requireDashboardAssets(assetDirectory);
  const runtime = createRuntime(options.configPath);
  try {
    const dashboard = await startDashboard(runtime, {
      port: options.port,
      assetDirectory,
    });
    process.stdout.write(`MoneyPrinter interface: ${dashboard.url}\n`);
    if (options.openBrowser && process.platform === "darwin") {
      await execa("open", [dashboard.url], { reject: false });
    }
    await waitForShutdown();
    await dashboard.close();
  } finally {
    runtime.close();
  }
}

async function requireDashboardAssets(assetDirectory: string): Promise<void> {
  try {
    await access(resolve(assetDirectory, "index.html"));
  } catch {
    throw new Error(
      "Dashboard assets are missing. Run `pnpm interface:build` and try again.",
    );
  }
}

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const stop = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
