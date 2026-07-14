import { access } from "node:fs/promises";

import { execa } from "execa";

import type { Runtime } from "../runtime.js";

export type PreflightStatus = "ok" | "warning" | "failure";

export interface PreflightResult {
  name: string;
  status: PreflightStatus;
  detail: string;
}

async function checkCommand(
  name: string,
  executable: string,
  args: readonly string[],
): Promise<PreflightResult> {
  const result = await execa(executable, args, { reject: false });
  return result.exitCode === 0
    ? {
        name,
        status: "ok",
        detail: result.stdout.split("\n")[0] ?? `${executable} is available`,
      }
    : {
        name,
        status: "failure",
        detail: result.stderr || `${executable} exited with ${result.exitCode}`,
      };
}

export async function runPreflight(
  runtime: Runtime,
): Promise<readonly PreflightResult[]> {
  const config = runtime.loadedConfig.config;
  const results: PreflightResult[] = [
    { name: "database", status: "ok", detail: runtime.database.path },
    {
      name: "configuration",
      status: runtime.loadedConfig.configPath === null ? "warning" : "ok",
      detail:
        runtime.loadedConfig.configPath ??
        "Using safe defaults; config.json was not found",
    },
  ];

  results.push(
    await checkCommand("ffmpeg", config.media.ffmpegPath, ["-version"]),
  );
  results.push(
    await checkCommand("ffprobe", config.media.ffprobePath, ["-version"]),
  );

  if (config.providers.tts.modelPath.length > 0) {
    try {
      await access(config.providers.tts.modelPath);
      results.push({
        name: "tts-model",
        status: "ok",
        detail: config.providers.tts.modelPath,
      });
    } catch {
      results.push({
        name: "tts-model",
        status: "failure",
        detail: config.providers.tts.modelPath,
      });
    }
  } else {
    results.push({
      name: "tts-model",
      status: "warning",
      detail: "No local TTS model configured",
    });
  }

  const imageKey = process.env[config.providers.image.apiKeyEnv];
  results.push({
    name: "image-api-key",
    status: imageKey === undefined || imageKey.length === 0 ? "warning" : "ok",
    detail:
      imageKey === undefined || imageKey.length === 0
        ? `${config.providers.image.apiKeyEnv} is not set`
        : `${config.providers.image.apiKeyEnv} is set`,
  });

  return results;
}
