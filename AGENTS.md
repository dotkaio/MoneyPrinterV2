# Repository Guidelines

## Project structure

- `src/cli/` is the Commander CLI entrypoint.
- `src/application/` contains use cases and orchestration.
- `src/domain/` contains provider-independent models.
- `src/ports/` defines provider boundaries.
- `src/adapters/` contains Ollama, Gemini, Piper, whisper.cpp, FFmpeg, Playwright, YouTube, scraper, and SMTP implementations.
- `src/infrastructure/` owns configuration, SQLite repositories, files, and logging.
- `src/worker/` runs durable jobs and schedules.
- `migrations/` contains ordered SQLite migrations.
- `test/` contains Vitest tests.
- `legacy/python/` is the frozen pre-TypeScript implementation; do not add new features there.

## Commands

- `pnpm install --frozen-lockfile`: install dependencies.
- `pnpm mpv2 --help`: run the development CLI.
- `pnpm worker`: run the scheduler and durable job worker.
- `pnpm check`: run formatting verification, lint, type checking, and tests.
- `pnpm compile`: build ESM JavaScript into `dist/`.
- `pnpm mpv2 preflight`: inspect local providers and credentials without publishing.

## TypeScript conventions

- Target Node.js 24-26, strict ESM, and TypeScript's strictest practical checks.
- Use 2-space indentation, `camelCase` for functions and values, `PascalCase` for classes and types, and descriptive file names.
- Keep application policy out of adapters. Add a port when a use case needs an external capability.
- Validate untrusted configuration, CLI payloads, provider responses, and legacy input with Zod.
- Preserve durable job idempotency and SQLite transaction boundaries.
- Never log tokens, passwords, OAuth codes, SMTP credentials, or full browser-profile contents.

## Testing

- Tests belong in `test/*.test.ts`.
- Use fakes for paid or externally mutating providers.
- Verify retryability, idempotency, and safety gates for publishing or outreach changes.
- Run `pnpm check && pnpm compile` before handoff.

## Git and security

- Do not commit `config.json`, `data/`, `.mp/`, browser profiles, tokens, or generated media.
- Do not broadly stage unrelated files or use destructive cleanup commands.
- Keep live publishing and outreach sending disabled by default.
- PRs target `main`, should cover one feature or fix, and should link an issue.
