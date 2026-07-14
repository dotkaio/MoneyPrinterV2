import { access } from "node:fs/promises";

import { execa } from "execa";
import { firefox } from "playwright";
import { z } from "zod";

import type { Runtime } from "../runtime.js";
import { errorMessage } from "../shared/errors.js";

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
  unavailableStatus: PreflightStatus,
): Promise<PreflightResult> {
  try {
    const result = await execa(executable, args, {
      reject: false,
      timeout: 5000,
    });
    return result.exitCode === 0
      ? {
          name,
          status: "ok",
          detail: result.stdout.split("\n")[0] ?? `${executable} is available`,
        }
      : {
          name,
          status: unavailableStatus,
          detail:
            result.stderr.trim().length > 0
              ? result.stderr
              : (result.shortMessage ??
                `${executable} exited with ${result.exitCode}`),
        };
  } catch (error) {
    return { name, status: unavailableStatus, detail: errorMessage(error) };
  }
}

async function checkFile(
  name: string,
  path: string,
  emptyDetail: string,
): Promise<PreflightResult> {
  if (path.length === 0) {
    return { name, status: "warning", detail: emptyDetail };
  }
  try {
    await access(path);
    return { name, status: "ok", detail: path };
  } catch {
    return { name, status: "failure", detail: `Not found: ${path}` };
  }
}

function checkEnvironment(
  name: string,
  variableNames: readonly string[],
): PreflightResult {
  const missing = variableNames.filter(
    (variableName) => !process.env[variableName]?.trim(),
  );
  return missing.length === 0
    ? { name, status: "ok", detail: `${variableNames.join(", ")} are set` }
    : {
        name,
        status: "warning",
        detail: `Missing ${missing.join(", ")}`,
      };
}

const ollamaTagsSchema = z.object({
  models: z.array(z.object({ name: z.string() })).default([]),
});

async function checkOllama(
  baseUrl: string,
  configuredModel: string,
): Promise<PreflightResult> {
  try {
    const response = await fetch(new URL("/api/tags", baseUrl), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return {
        name: "ollama",
        status: "failure",
        detail: `${response.status} ${response.statusText}`,
      };
    }
    const parsed = ollamaTagsSchema.parse(await response.json());
    const modelNames = parsed.models.map((model) => model.name);
    if (configuredModel.length === 0) {
      return {
        name: "ollama",
        status: "warning",
        detail:
          modelNames.length === 0
            ? "Ollama is reachable but has no models"
            : `Reachable; configure one of: ${modelNames.join(", ")}`,
      };
    }
    const exactOrTagged = modelNames.some(
      (name) =>
        name === configuredModel || name.split(":")[0] === configuredModel,
    );
    return exactOrTagged
      ? {
          name: "ollama",
          status: "ok",
          detail: `${configuredModel} is available`,
        }
      : {
          name: "ollama",
          status: "failure",
          detail: `${configuredModel} is not installed; available: ${modelNames.join(", ") || "none"}`,
        };
  } catch (error) {
    return { name: "ollama", status: "failure", detail: errorMessage(error) };
  }
}

async function checkPlaywrightFirefox(): Promise<PreflightResult> {
  const path = firefox.executablePath();
  try {
    await access(path);
    return { name: "playwright-firefox", status: "ok", detail: path };
  } catch {
    return {
      name: "playwright-firefox",
      status: "warning",
      detail:
        "Run `pnpm exec playwright install firefox` for Twitter and Amazon",
    };
  }
}

export async function runPreflight(
  runtime: Runtime,
): Promise<readonly PreflightResult[]> {
  const config = runtime.loadedConfig.config;
  const results: PreflightResult[] = [
    { name: "node", status: "ok", detail: process.version },
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
    await checkCommand(
      "ffmpeg",
      config.media.ffmpegPath,
      ["-version"],
      "failure",
    ),
    await checkCommand(
      "ffprobe",
      config.media.ffprobePath,
      ["-version"],
      "failure",
    ),
    await checkOllama(config.providers.llm.baseUrl, config.providers.llm.model),
    await checkPlaywrightFirefox(),
    await checkCommand("macos-keychain", "security", ["help"], "failure"),
    await checkCommand(
      "piper",
      config.providers.tts.executable,
      ["--help"],
      "warning",
    ),
    await checkFile(
      "tts-model",
      config.providers.tts.modelPath,
      "No local Piper model configured",
    ),
  );

  results.push(
    await checkCommand(
      "whisper-cpp",
      config.providers.transcription.executable,
      ["--help"],
      "warning",
    ),
    await checkFile(
      "transcription-model",
      config.providers.transcription.modelPath,
      "No local whisper.cpp model configured",
    ),
  );

  results.push(
    checkEnvironment("image-api-key", [config.providers.image.apiKeyEnv]),
    checkEnvironment("youtube-oauth", [
      config.publishers.youtube.clientIdEnv,
      config.publishers.youtube.clientSecretEnv,
    ]),
    checkEnvironment("linkedin-oauth", [
      config.publishers.linkedin.clientIdEnv,
      config.publishers.linkedin.clientSecretEnv,
    ]),
    checkEnvironment("tiktok-oauth", [
      config.publishers.tiktok.clientIdEnv,
      config.publishers.tiktok.clientSecretEnv,
    ]),
    checkEnvironment("meta-oauth", [
      config.publishers.meta.clientIdEnv,
      config.publishers.meta.clientSecretEnv,
    ]),
    await checkCommand(
      "outreach-scraper",
      config.outreach.scraperExecutable,
      ["--help"],
      "warning",
    ),
    checkEnvironment("smtp", [
      config.outreach.smtp.usernameEnv,
      config.outreach.smtp.passwordEnv,
      config.outreach.smtp.fromEnv,
    ]),
    {
      name: "live-publishing-safety",
      status: config.safety.livePublishing ? "ok" : "warning",
      detail: config.safety.livePublishing
        ? "Live publishing is enabled"
        : "Live publishing is disabled",
    },
    {
      name: "outreach-safety",
      status: config.safety.outreachSending ? "ok" : "warning",
      detail: config.safety.outreachSending
        ? "Outreach sending is enabled"
        : "Outreach sending is disabled",
    },
  );

  return results;
}
