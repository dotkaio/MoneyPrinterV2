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
  const runtime = createRuntime(options.configPath);
  try {
    const dashboard = await startDashboard(runtime, { port: options.port });
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
