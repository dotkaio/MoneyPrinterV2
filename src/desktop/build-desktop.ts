#!/usr/bin/env node
import { execa } from "execa";

const buildResult = await execa("electron-builder", process.argv.slice(2), {
  stdio: "inherit",
  reject: false,
});

process.stdout.write(
  "Restoring better-sqlite3 for the Node.js development runtime…\n",
);
const restoreResult = await execa(
  "pnpm",
  ["rebuild", "better-sqlite3", "--reporter=append-only"],
  {
    stdio: "inherit",
    reject: false,
  },
);

process.exitCode =
  buildResult.exitCode === 0 ? restoreResult.exitCode : buildResult.exitCode;
