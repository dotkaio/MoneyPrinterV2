#!/usr/bin/env node
import { createRuntime } from "../runtime.js";
import { WorkerService } from "./worker-service.js";

const runtime = createRuntime();
const worker = new WorkerService(runtime);

function shutdown(signal: string): void {
  void worker.stop(signal);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

worker
  .start()
  .catch((error: unknown) => {
    runtime.logger.fatal({ error }, "Worker crashed");
    process.exitCode = 1;
  })
  .finally(() => runtime.close());
