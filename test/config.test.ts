import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../src/infrastructure/config/load.js";

const originalDataDirectory = process.env.MPV2_DATA_DIRECTORY;

afterEach(() => {
  if (originalDataDirectory === undefined) {
    delete process.env.MPV2_DATA_DIRECTORY;
  } else {
    process.env.MPV2_DATA_DIRECTORY = originalDataDirectory;
  }
});

describe("loadConfig", () => {
  it("loads safe defaults when the file is absent", () => {
    const loaded = loadConfig(
      join(tmpdir(), `missing-${crypto.randomUUID()}.json`),
    );

    expect(loaded.config.media.maximumScenes).toBe(12);
    expect(loaded.config.safety.livePublishing).toBe(false);
    expect(loaded.configPath).toBeNull();
  });

  it("rejects an invalid scene range", () => {
    const directory = join(tmpdir(), `mpv2-config-${crypto.randomUUID()}`);
    mkdirSync(directory);
    const path = join(directory, "config.json");
    writeFileSync(
      path,
      JSON.stringify({ media: { minimumScenes: 10, maximumScenes: 4 } }),
    );

    expect(() => loadConfig(path)).toThrow(/minimumScenes/u);
  });
});
