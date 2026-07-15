# Operations

## Standalone desktop app

Build and launch the local macOS application with:

```bash
pnpm desktop:package
open release/mac-arm64/MoneyPrinter.app
```

The app starts its own interface server and durable worker. It stores SQLite and generated artifacts beneath `~/Library/Application Support/MoneyPrinter/data/`; it does not require `config.json` for provider-backed Content Studio generation.

First-run onboarding verifies an OpenAI, Anthropic, Gemini, or OpenRouter key and writes it to macOS Keychain. SQLite stores only the provider profile and model. Switching an already connected provider does not require pasting its key again.

`pnpm desktop:dist` produces unsigned DMG and ZIP artifacts for local testing. Public distribution requires an Apple Developer ID signature and notarization, which are intentionally not configured in the repository.

## Optional advanced configuration

Copy `config.example.json` to the ignored `config.json` only when using the advanced CLI or optional media/publishing workflows. Relative paths are resolved from the package root. CLI state defaults to `data/moneyprinter.sqlite`; the packaged app uses its native application-support directory instead.

The preflight command reports core failures separately from optional workflow warnings:

```bash
pnpm mpv2 preflight --json
```

FFmpeg, ffprobe, the configured Ollama model, and configured local model paths are validated. It also checks the Playwright Firefox installation, macOS Keychain access, provider executables, credential environment-variable presence, and the two global safety switches.

## Optional media and publishing providers

For Ollama, start the local service, pull a model, and set `providers.llm.model`. Configure the Piper executable and voice `.onnx` path, plus the whisper.cpp executable and model path. Install Firefox with `pnpm exec playwright install firefox`.

Gemini reads the key from the variable named by `providers.image.apiKeyEnv`. OAuth developer-app IDs and secrets use the environment-variable names under `publishers.youtube`, `publishers.linkedin`, `publishers.tiktok`, and `publishers.meta`.

Use the shared authentication commands for every platform:

```bash
pnpm mpv2 auth connect --account <account-id>
pnpm mpv2 auth complete --account <account-id> --code <code> --state <state>
pnpm mpv2 auth status --account <account-id>
pnpm mpv2 auth revoke --account <account-id>
```

`auth connect` opens the OAuth consent page on macOS. TikTok and Meta require a registered HTTPS redirect URI, so replace the example redirect URLs in `config.json` before connecting them. LinkedIn and YouTube may use the configured loopback redirect. Platform app review still controls which scopes actually work.

For Bluesky, create an app password in the Bluesky account settings and keep it out of shell history:

```bash
BLUESKY_APP_PASSWORD='<app-password>' pnpm mpv2 auth connect \
  --account <account-id> --identifier <handle>
```

For a pre-issued token, place it in an environment variable and use `auth import-token`. Add `--external-id` for a Facebook Page, Instagram professional account, or LinkedIn organization/member identifier when the token does not expose one through its profile endpoint.

Connected tokens, refresh tokens, and Bluesky app passwords live in the login Keychain under the configured `authentication.keychainService`. SQLite contains only status, scopes, expiry, display name, and external account ID. Neither CLI output nor logs include credentials.

Twitter uses the `browserProfilePath` stored on the target account. Use a dedicated Firefox profile that is already authenticated; do not point multiple concurrent workers at the same profile. Amazon product extraction uses a short-lived, isolated Firefox context and does not reuse account credentials.

Bluesky and LinkedIn text posts are available through `social post`. TikTok, Instagram, and Facebook account linking is implemented, but their media publishing flows require platform-specific upload, review, and account-selection work and are not exposed as live publish commands yet.

Outreach discovery invokes `outreach.scraperExecutable` and then visits public business websites. SMTP credentials use the configured environment variable names.

## Running a separate worker

The desktop app embeds a worker. Run a separate worker only for CLI-operated data directories or intentionally headless deployments. Use exactly one worker per SQLite data directory unless you intentionally want concurrent processing. Lease claiming is safe across processes, but browser profiles and local model capacity may not be.

```bash
pnpm worker
```

For a production-like run, compile first and execute `node dist/worker/index.js`. Keep the process supervised by launchd, systemd, or another process manager and preserve the data directory across restarts.

## Publishing and outreach gates

Set `safety.livePublishing` only after testing generation and account authentication. The publish command must still explicitly request a live action. YouTube privacy is private unless overridden.

Set `safety.outreachSending` only after inspecting the campaign preview. Approve each campaign separately. Global, campaign, and per-domain limits remain enforced after approval.

## Recovery and backup

Quit the desktop app, or stop the headless worker, before copying the SQLite database. With WAL enabled, either use SQLite's backup command or copy `moneyprinter.sqlite`, `moneyprinter.sqlite-wal`, and `moneyprinter.sqlite-shm` together. Back up the artifact directory with it.

Failed jobs remain inspectable through `job list`. Use `job retry <id>` only after correcting the cause; retries retain the original idempotency key. Use `job cancel <id>` to stop queued or running work. Generated artifacts and completed upload sessions are reused rather than recreated.

No command deletes the legacy `.mp` source during migration. Rollback consists of stopping the TypeScript worker, restoring the cache backup at `legacy/python/.mp`, and running the preserved Python application from that directory.
