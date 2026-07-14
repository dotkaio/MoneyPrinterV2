import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AppError } from "../../shared/errors.js";
import { appConfigSchema, type AppConfig } from "./schema.js";

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export interface LoadedConfig {
  config: AppConfig;
  configPath: string | null;
  packageRoot: string;
}

export function loadConfig(explicitPath?: string): LoadedConfig {
  const candidate = resolve(
    explicitPath ??
      process.env.MPV2_CONFIG ??
      resolve(packageRoot, "config.json"),
  );
  let input: unknown = {};
  let configPath: string | null = null;

  if (existsSync(candidate)) {
    try {
      input = JSON.parse(readFileSync(candidate, "utf8")) as unknown;
      configPath = candidate;
    } catch (error) {
      throw new AppError(
        `Could not read configuration at ${candidate}`,
        "CONFIG_READ_FAILED",
        false,
        {
          cause: error,
        },
      );
    }
  }

  const parsed = appConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      `Invalid configuration: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      "CONFIG_INVALID",
    );
  }

  const configuredDataDirectory =
    process.env.MPV2_DATA_DIRECTORY ?? parsed.data.dataDirectory;
  const dataDirectory = resolve(packageRoot, configuredDataDirectory);

  return {
    config: { ...parsed.data, dataDirectory },
    configPath,
    packageRoot,
  };
}
