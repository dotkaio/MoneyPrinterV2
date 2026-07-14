#!/usr/bin/env node
import { hostname } from "node:os";

import { createRuntime } from "../runtime.js";
import { createId } from "../shared/ids.js";
import { SchedulerService } from "../application/scheduler-service.js";
import { JobWorker } from "./job-worker.js";
import { createDefaultJobHandlers } from "./default-handlers.js";

const runtime = createRuntime();
const workerId = `${hostname()}:${process.pid}:${createId()}`;

const handlers = createDefaultJobHandlers();
const worker = new JobWorker(runtime, workerId, handlers);
const scheduler = new SchedulerService(
  runtime.schedules,
  runtime.jobs,
  runtime.loadedConfig.config.worker.maximumAttempts,
);
let stopped = false;

runtime.logger.info({ workerId }, "Worker started");

async function run(): Promise<void> {
  while (!stopped) {
    const scheduled = scheduler.tick();
    const handled = await worker.runOnce();
    if (!handled && scheduled === 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, runtime.loadedConfig.config.worker.pollIntervalMs);
      });
    }
  }
}

function shutdown(signal: string): void {
  stopped = true;
  runtime.logger.info({ signal }, "Worker stopping");
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

run()
  .catch((error: unknown) => {
    runtime.logger.fatal({ error }, "Worker crashed");
    process.exitCode = 1;
  })
  .finally(() => runtime.close());
