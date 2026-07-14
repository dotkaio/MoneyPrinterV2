import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SchedulerService } from "../src/application/scheduler-service.js";
import type { Job } from "../src/domain/model.js";
import { createRuntime, type Runtime } from "../src/runtime.js";
import { AppError } from "../src/shared/errors.js";
import { JobWorker, type JobHandler } from "../src/worker/job-worker.js";

const directories: string[] = [];

function testRuntime(): Runtime {
  const directory = join(tmpdir(), `mpv2-jobs-${crypto.randomUUID()}`);
  directories.push(directory);
  process.env.MPV2_DATA_DIRECTORY = directory;
  return createRuntime(join(directory, "missing-config.json"));
}

afterEach(() => {
  vi.useRealTimers();
  delete process.env.MPV2_DATA_DIRECTORY;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("durable jobs", () => {
  it("runs a registered handler and completes the job", async () => {
    const runtime = testRuntime();
    const handler = vi
      .fn<(job: Job, runtime: Runtime) => Promise<void>>()
      .mockResolvedValue();
    const handlers = new Map<string, JobHandler>([["fixture", handler]]);
    const worker = new JobWorker(runtime, "worker-one", handlers);
    const job = runtime.jobs.enqueue({
      type: "fixture",
      payload: { value: 1 },
      idempotencyKey: "fixture:success",
      maximumAttempts: 3,
    });

    await expect(worker.runOnce()).resolves.toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(runtime.jobs.findById(job.id)?.state).toBe("succeeded");
    runtime.close();
  });

  it("retries retryable failures and permanently fails unknown handlers", async () => {
    const runtime = testRuntime();
    const retryingHandler: JobHandler = () =>
      Promise.reject(new AppError("temporary", "TEMPORARY", true));
    const worker = new JobWorker(
      runtime,
      "worker-one",
      new Map([["retrying", retryingHandler]]),
    );
    const retrying = runtime.jobs.enqueue({
      type: "retrying",
      payload: {},
      idempotencyKey: "fixture:retrying",
      maximumAttempts: 3,
    });
    const unknown = runtime.jobs.enqueue({
      type: "unknown",
      payload: {},
      idempotencyKey: "fixture:unknown",
      maximumAttempts: 3,
    });

    await worker.runOnce();
    await worker.runOnce(new Date(Date.now() + 10_000));

    expect(runtime.jobs.findById(retrying.id)?.state).toBe("retrying");
    expect(runtime.jobs.findById(unknown.id)?.state).toBe("failed");
    runtime.close();
  });
});

describe("durable schedules", () => {
  it("enqueues each intended run idempotently", () => {
    const runtime = testRuntime();
    const scheduler = new SchedulerService(runtime.schedules, runtime.jobs, 3);
    const created = scheduler.create(
      {
        name: "Every minute",
        jobType: "fixture",
        payload: { accountId: "account-one" },
        cronExpression: "* * * * *",
        timezone: "UTC",
      },
      new Date("2026-01-01T00:00:30.000Z"),
    );

    expect(created.nextRunAt).toBe("2026-01-01T00:01:00.000Z");
    expect(scheduler.tick(new Date("2026-01-01T00:01:00.000Z"))).toBe(1);
    expect(scheduler.tick(new Date("2026-01-01T00:01:00.000Z"))).toBe(0);
    expect(runtime.jobs.list()).toHaveLength(1);
    expect(runtime.schedules.list()[0]?.nextRunAt).toBe(
      "2026-01-01T00:02:00.000Z",
    );
    runtime.close();
  });
});
