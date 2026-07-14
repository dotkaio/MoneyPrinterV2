# Architecture

MoneyPrinterV2 is a CLI and worker process sharing one SQLite database and artifact directory. The CLI creates accounts, content, jobs, schedules, and approvals. The worker claims jobs using leases, invokes application use cases, and records attempts so interrupted work can resume safely.

## Layers

1. `domain` defines stable records such as accounts, content, jobs, artifacts, publications, products, campaigns, and leads.
2. `ports` describe text, image, speech, transcription, rendering, publishing, product-source, business-source, and email capabilities.
3. `application` coordinates workflows and owns policy such as state transitions, idempotency, privacy defaults, approvals, and limits.
4. `adapters` translate ports into provider-specific APIs or subprocesses.
5. `infrastructure` validates configuration and persists state.
6. `cli` and `worker` are delivery mechanisms over the same application layer.

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
- Provider secrets come from named environment variables.
- SQLite uses foreign keys, WAL mode, busy timeouts, transactions, and ordered migrations.
