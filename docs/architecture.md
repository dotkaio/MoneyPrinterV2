# Architecture

MoneyPrinter is primarily a desktop application. Its Electron main process starts a loopback-only HTTP application server, opens the React interface in a sandboxed browser window, and embeds the durable worker and scheduler. The CLI can still operate on the same SQLite database and artifact directory for advanced automation.

## Layers

1. `domain` defines stable records such as accounts, content, jobs, artifacts, publications, products, campaigns, and leads.
2. `ports` describe text, image, speech, transcription, rendering, publishing, product-source, business-source, and email capabilities.
3. `application` coordinates workflows and owns policy such as state transitions, idempotency, privacy defaults, approvals, and limits.
4. `adapters` translate ports into provider-specific APIs or subprocesses.
5. `infrastructure` validates configuration and persists state.
6. `interface` and `desktop` provide the standalone app; `cli` remains an advanced delivery mechanism.

## Desktop boundary

The desktop renderer has no Node.js integration. It can reach only the loopback application origin, which serves static production assets and a small JSON API. Mutations enforce same-origin requests, request bodies are bounded and validated with Zod, and the server applies a restrictive content security policy. External HTTPS links open in the system browser instead of navigating the application window.

The main process chooses an ephemeral loopback port, stores application data under the native macOS application-support directory, and shuts down the worker, server, and database together. A single-instance lock prevents two app windows from accidentally sharing the embedded process lifecycle.

## Provider-backed content studio

Provider profiles contain only provider kind, model, endpoint, status, and timestamps. Raw OpenAI, Anthropic, Gemini, and OpenRouter keys live in macOS Keychain. A provider-specific adapter verifies the key before a profile becomes active. The application layer sends a provider-independent structured-generation request and persists the normalized result in the local creations library.

## Durable workflow model

Every queued operation has an idempotency key. A worker atomically claims the oldest due job, creates an attempt record, and leases it for a bounded period. A crashed worker leaves an expiring lease; another worker can reclaim it. Retryable failures use bounded exponential backoff, while validation or safety failures stop immediately.

Schedules are database records with cron expression, IANA timezone, payload, and next-run timestamp. The scheduler enqueues due work through the same idempotent job repository.

## YouTube pipeline

Generation stores a content record first. Script, metadata, scene plan, images, narration, subtitles, and final video are created as discrete artifacts. Existing valid artifacts are reused after interruption. Scene count is bounded by configuration. FFmpeg produces a 1080x1920 H.264/AAC MP4 by default.

Publishing uses OAuth 2.0 and YouTube's resumable upload protocol. The session URI and byte position are persisted in SQLite. On retry, the adapter queries the remote range before sending more bytes. Uploads default to private and a successful platform item is recorded once.

## Browser and network boundaries

Playwright handles sites without a suitable publishing API in this project. Each account may reference a dedicated, pre-authenticated Firefox profile. Website discovery applies response-size and timeout limits and blocks private-network targets to reduce SSRF exposure.

## Safety invariants

- Live publishing and outreach sending default to disabled.
- Outreach requires a campaign preview followed by explicit approval.
- Delivery enforces daily and per-domain limits and records one attempt per lead.
- Standalone provider keys and connected-account tokens live in macOS Keychain; optional legacy workflow secrets come from named environment variables.
- SQLite uses foreign keys, WAL mode, busy timeouts, transactions, and ordered migrations.
