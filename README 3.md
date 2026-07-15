# MoneyPrinterV2

MoneyPrinterV2 is a local-first TypeScript CLI for generating and publishing short-form content, running affiliate campaigns, and operating guarded local-business outreach. The application uses durable SQLite jobs, explicit provider boundaries, and safety switches that keep live publishing and email sending off by default.

The previous Python application is preserved under [`legacy/python`](legacy/python/README.md). New development happens in the TypeScript application at the repository root.

[![Sponsor](https://readme.cash/i/d3t49gsk71.svg)](https://readme.cash/c/d3t49gsk71)

## Workflows

- YouTube Shorts: Ollama script and metadata, Gemini images, Piper narration, whisper.cpp subtitles, FFmpeg rendering, and resumable YouTube Data API uploads.
- Twitter/X: Ollama post generation and Playwright publishing through a dedicated, pre-authenticated Firefox profile.
- Bluesky and LinkedIn: reusable account authentication plus direct text publishing.
- TikTok, Instagram, and Facebook: built-in account linking and credential storage, ready for media publishing adapters once each developer app has the required product approval.
- Affiliate marketing: Amazon product extraction, an Ollama-generated pitch, and optional Twitter publishing.
- Outreach: Google Maps scraper ingestion, bounded website email discovery, preview and explicit campaign approval, rate-limited SMTP delivery.

## Requirements

- Node.js 24 or 26
- pnpm 11 through Corepack
- FFmpeg and ffprobe
- Ollama with a local model
- Piper and a voice model for YouTube generation
- whisper.cpp and a model for subtitles
- Firefox for Playwright-backed Twitter and Amazon operations
- A compatible Google Maps scraper binary for outreach discovery

Developer-app credentials are supplied through environment variables. Connected-account tokens and Bluesky app passwords are stored in macOS Keychain; SQLite stores only non-secret account identity and connection status.

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp config.example.json config.json
pnpm exec playwright install firefox
pnpm mpv2 preflight
```

Edit `config.json`, then set the environment variables named there. At minimum, YouTube generation needs `GEMINI_API_KEY`; YouTube publishing needs `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`; outreach delivery needs `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM`.

## CLI

```bash
pnpm mpv2 --help
pnpm interface
pnpm mpv2 account add --platform youtube --nickname demo --niche science
pnpm mpv2 auth connect --account <account-id>
pnpm mpv2 auth list
pnpm mpv2 youtube generate --account <account-id> --topic "black holes"
pnpm mpv2 social post --account <bluesky-or-linkedin-account-id> --text "Hello"
pnpm mpv2 job list
pnpm worker
```

Commands that can publish or send externally require both the appropriate command option and the matching global safety switch in `config.json`. YouTube uploads default to `private` unless a different privacy status is supplied.

`auth connect` opens the provider authorization page for OAuth accounts and prints the exact `auth complete` command for the callback code. Bluesky uses an app password supplied through `BLUESKY_APP_PASSWORD`; Twitter records the dedicated browser-profile session. `auth import-token` reads tokens from an environment variable so secrets never appear in shell history.

`pnpm interface` builds and starts the local control center at `http://127.0.0.1:4317`, then opens it in the default browser. Dedicated pages surface account connection state, durable jobs, schedules, safety gates, and live preflight results without exposing stored credentials.

## Legacy migration

Run a dry run first, then import the old `.mp` JSON cache. The importer is idempotent and never deletes the source files.

```bash
pnpm mpv2 migrate-from-python --source . --dry-run
pnpm mpv2 migrate-from-python --source .
```

See [`docs/migration.md`](docs/migration.md) for the mapping and rollback procedure.

## Development

```bash
pnpm check
pnpm compile
node dist/cli/index.js --help
```

The core architecture is documented in [`docs/architecture.md`](docs/architecture.md), and provider setup plus recovery procedures are in [`docs/operations.md`](docs/operations.md).

## License and responsible use

MoneyPrinterV2 is licensed under AGPL-3.0. Automated publishing and outreach can violate platform policies or applicable law when misused. Review generated content, respect consent and suppression requests, and keep conservative limits.
