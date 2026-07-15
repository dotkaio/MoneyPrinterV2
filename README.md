# MoneyPrinter

MoneyPrinter is a standalone, local-first AI content studio for macOS. Open the app, choose a major AI provider from the dropdown, connect one API key, and start creating—no terminal, environment file, local model, or separate worker is required for the core experience.

Drafts, provider settings, jobs, schedules, and publishing metadata stay on this Mac. Raw API keys and connected-account credentials are stored in macOS Keychain, never in SQLite or the browser bundle.

The previous Python application is frozen under [`legacy/python`](legacy/python/README.md). New development happens in the TypeScript application at the repository root.

[![Sponsor](https://readme.cash/i/d3t49gsk71.svg)](https://readme.cash/c/d3t49gsk71)

## Build and open the app

From source, the exact local build flow is:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm desktop:package
open release/mac-arm64/MoneyPrinter.app
```

On first launch:

1. Choose a provider from the dropdown. Built-in options include OpenAI, Anthropic, Gemini, Groq, Mistral, OpenRouter, Cerebras, Cohere, NVIDIA NIM, xAI, DeepSeek, Together AI, and Fireworks AI.
2. Paste an API key and select a model.
3. Create a short-video script, social post, newsletter, or ad draft.

MoneyPrinter verifies the key before saving it to Keychain. Generated work is automatically saved to the local Library with its brief, provider, model, timing, and token metadata.

For a signed distributable artifact, run `pnpm desktop:dist`. It produces macOS DMG and ZIP artifacts under `release/`. Local builds are intentionally unsigned.

## What is built in

- First-run provider onboarding, secure provider switching, and clearly labeled free-tier options such as Groq.
- A guided Content Studio for four common content formats.
- An organized local workflow surface with saved drafts and generation metadata.
- Overview, publishing-account, job, schedule, safety, and system-health views.
- An embedded durable worker and scheduler; no second terminal process is needed.
- A loopback-only application server with same-origin mutation checks and a restrictive content security policy.
- Live publishing and outreach safety gates that remain disabled by default.

Application data defaults to `~/Library/Application Support/MoneyPrinter/data/`. Back up that directory to preserve local drafts and durable workflow state. Provider keys remain in the login Keychain.

## Optional advanced automation

The one-key setup powers the standalone Content Studio. Existing end-to-end video, publishing, affiliate, and outreach workflows remain available as optional advanced capabilities:

- YouTube Shorts: local script generation, Gemini images, Piper narration, whisper.cpp subtitles, FFmpeg rendering, and resumable YouTube uploads.
- Twitter/X: Playwright publishing through a dedicated, pre-authenticated Firefox profile.
- Bluesky and LinkedIn: reusable account authentication and direct text publishing.
- TikTok, Instagram, and Facebook: account linking with guarded credential storage; live media publishing still depends on each platform's developer approval.
- Affiliate marketing: Amazon product extraction, generated pitches, and optional social publishing.
- Outreach: bounded website discovery, preview and explicit approval, and rate-limited SMTP delivery.

These workflows may require Node.js 24 or 26, FFmpeg, Ollama, Piper, whisper.cpp, Firefox, provider developer credentials, or a scraper binary. Their configuration is documented in [`docs/operations.md`](docs/operations.md).

## Development

```bash
pnpm desktop          # build and launch the development desktop app
pnpm interface        # open the same UI in a browser
pnpm check            # formatting, lint, types, and tests
pnpm compile          # production web and TypeScript build
pnpm desktop:package  # unpacked macOS application
pnpm desktop:dist     # local unsigned DMG and ZIP
```

The desktop process owns the loopback interface server and durable worker. The browser-only interface remains useful while developing at `http://127.0.0.1:4317`.

## Advanced CLI

The CLI remains available for automation and workflows that have not yet moved into the graphical setup:

```bash
pnpm mpv2 --help
pnpm mpv2 preflight
pnpm mpv2 account add --platform youtube --nickname demo --niche science
pnpm mpv2 auth connect --account <account-id>
pnpm mpv2 youtube generate --account <account-id> --topic "black holes"
pnpm mpv2 social post --account <account-id> --text "Hello"
pnpm mpv2 job list
```

Publishing and outreach commands require both the command-specific confirmation and the matching global safety switch. YouTube uploads default to private.

## Legacy migration

Run a dry run before importing the old `.mp` JSON cache. The importer is idempotent and never deletes its source files.

```bash
pnpm mpv2 migrate-from-python --source . --dry-run
pnpm mpv2 migrate-from-python --source .
```

See [`docs/migration.md`](docs/migration.md) for mappings and rollback.

## Architecture and responsible use

See [`docs/architecture.md`](docs/architecture.md) for system boundaries and [`docs/operations.md`](docs/operations.md) for provider setup, backup, and recovery.

MoneyPrinter is licensed under AGPL-3.0. Automated publishing and outreach can violate platform policies or applicable law when misused. Review generated content, respect consent and suppression requests, and keep conservative limits.
