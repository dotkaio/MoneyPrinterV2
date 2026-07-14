import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  delete process.env.MPV2_DATA_DIRECTORY;
});

describe("database runtime", () => {
  it("migrates and stores accounts", () => {
    const directory = join(tmpdir(), `mpv2-db-${crypto.randomUUID()}`);
    directories.push(directory);
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));

    const account = runtime.accounts.create({
      platform: "youtube",
      nickname: "Fixture Channel",
      niche: "astronomy",
      language: "English",
    });

    expect(runtime.accounts.findById(account.id)).toEqual(account);
    expect(runtime.accounts.list()).toHaveLength(1);
    runtime.close();
  });

  it("enqueues idempotently and claims once", () => {
    const directory = join(tmpdir(), `mpv2-db-${crypto.randomUUID()}`);
    directories.push(directory);
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));

    const first = runtime.jobs.enqueue({
      type: "fixture",
      payload: { value: 1 },
      idempotencyKey: "fixture:1",
      maximumAttempts: 3,
    });
    const second = runtime.jobs.enqueue({
      type: "fixture",
      payload: { value: 2 },
      idempotencyKey: "fixture:1",
      maximumAttempts: 3,
    });

    expect(second.id).toBe(first.id);
    expect(runtime.jobs.claim("worker-one", 60_000)?.id).toBe(first.id);
    expect(runtime.jobs.claim("worker-two", 60_000)).toBeNull();
    runtime.close();
  });
});
