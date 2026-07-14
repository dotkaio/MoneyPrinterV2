# Operations

## Configuration

Copy `config.example.json` to the ignored `config.json`. Relative paths are resolved from the current working directory, so run commands from the repository root. Persistent state defaults to `data/moneyprinter.sqlite`; generated artifacts live beneath the same data directory.

The preflight command reports core failures separately from optional workflow warnings:

```bash
pnpm mpv2 preflight --json
```

FFmpeg, ffprobe, the configured Ollama model, and configured local model paths are validated. It also checks the Playwright Firefox installation, macOS Keychain access, provider executables, credential environment-variable presence, and the two global safety switches.

## Provider setup

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

## Running the worker

Run exactly one worker per SQLite data directory unless you intentionally want concurrent processing. Lease claiming is safe across processes, but browser profiles and local model capacity may not be.

```bash
pnpm worker
```

For a production-like run, compile first and execute `node dist/worker/index.js`. Keep the process supervised by launchd, systemd, or another process manager and preserve the data directory across restarts.

## Publishing and outreach gates

Set `safety.livePublishing` only after testing generation and account authentication. The publish command must still explicitly request a live action. YouTube privacy is private unless overridden.

Set `safety.outreachSending` only after inspecting the campaign preview. Approve each campaign separately. Global, campaign, and per-domain limits remain enforced after approval.

## Recovery and backup

Stop the worker before copying the SQLite database. With WAL enabled, either use SQLite's backup command or copy `moneyprinter.sqlite`, `moneyprinter.sqlite-wal`, and `moneyprinter.sqlite-shm` together. Back up the artifact directory with it.

Failed jobs remain inspectable through `job list`. Use `job retry <id>` only after correcting the cause; retries retain the original idempotency key. Use `job cancel <id>` to stop queued or running work. Generated artifacts and completed upload sessions are reused rather than recreated.

No command deletes the legacy `.mp` source during migration. Rollback consists of stopping the TypeScript worker, restoring the cache backup at `legacy/python/.mp`, and running the preserved Python application from that directory.
