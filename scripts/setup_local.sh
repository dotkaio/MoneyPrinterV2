#!/usr/bin/env bash
set -euo pipefail

corepack enable
pnpm install --frozen-lockfile

if [[ ! -f config.json ]]; then
  cp config.example.json config.json
  echo "Created config.json from the safe example"
fi

pnpm exec playwright install firefox
pnpm compile
pnpm mpv2 preflight
