# Migrating from the Python application

The importer reads `youtube.json`, `twitter.json`, and `afm.json` from a legacy `.mp` directory. You can pass the `.mp` directory itself or its parent.

## Procedure

1. Stop the Python scheduler and make a backup of `.mp`.
2. Configure a separate TypeScript `dataDirectory`.
3. Validate the input with `pnpm mpv2 migrate-from-python --source <path> --dry-run`.
4. Run the same command without `--dry-run`.
5. Compare `account list`, `youtube list`, `twitter list`, and `affiliate list` with the old cache.
6. Complete provider preflight and authentication before enabling live actions.

Legacy IDs are preserved for accounts. Historical YouTube videos and Twitter posts receive deterministic content IDs and published records. Affiliate products retain their legacy identity and Twitter-account association where the account exists. Legacy dates, titles, descriptions, topics, languages, and Firefox profile paths are retained.

The importer is transactional and idempotent. Re-running it skips records already imported. Missing cache files are treated as empty, malformed records fail validation, and the source files are never modified or deleted.

## Rollback

Stop the TypeScript worker, keep `safety.livePublishing` and `safety.outreachSending` disabled, and restore the original cache backup at `legacy/python/.mp` before starting the preserved application there. The migration does not write back to that cache, so rollback does not require a reverse converter.
