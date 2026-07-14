import pino, { type Logger } from "pino";

import type { AppConfig } from "../config/schema.js";

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: [
        "*.apiKey",
        "*.accessToken",
        "*.refreshToken",
        "*.password",
        "config.providers.image.apiKey",
      ],
      censor: "[REDACTED]",
    },
  });
}
