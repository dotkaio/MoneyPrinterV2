import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import BetterSqlite3 from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";

import type { AppConfig } from "../config/schema.js";
import * as schema from "./schema.js";

export interface DatabaseContext {
  sqlite: BetterSqlite3.Database;
  orm: BetterSQLite3Database<typeof schema>;
  path: string;
}

interface AppliedMigrationRow {
  name: string;
}

export function openDatabase(config: AppConfig): DatabaseContext {
  mkdirSync(config.dataDirectory, { recursive: true });
  const path = resolve(config.dataDirectory, "moneyprinter.sqlite");
  const sqlite = new BetterSqlite3(path, { timeout: 5000 });
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");

  return { sqlite, orm: drizzle(sqlite, { schema }), path };
}

export function runMigrations(database: DatabaseContext): readonly string[] {
  database.sqlite.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );

  const migrationDirectory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../migrations",
  );
  const files = readdirSync(migrationDirectory)
    .filter((name) => /^\d+.*\.sql$/u.test(name))
    .sort();
  const applied: string[] = [];
  const hasMigration = database.sqlite.prepare(
    "SELECT name FROM schema_migrations WHERE name = ?",
  );
  const recordMigration = database.sqlite.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
  );

  for (const file of files) {
    const existing = hasMigration.get(file) as AppliedMigrationRow | undefined;
    if (existing !== undefined) {
      continue;
    }

    const sql = readFileSync(resolve(migrationDirectory, file), "utf8");
    if (sql.startsWith("-- migrate-with-foreign-keys-off")) {
      database.sqlite.pragma("foreign_keys = OFF");
      try {
        database.sqlite.transaction(() => {
          database.sqlite.exec(sql);
          recordMigration.run(file, new Date().toISOString());
        })();
      } finally {
        database.sqlite.pragma("foreign_keys = ON");
      }
      const foreignKeyErrors = database.sqlite.pragma(
        "foreign_key_check",
      ) as readonly unknown[];
      if (foreignKeyErrors.length > 0) {
        throw new Error(`Migration ${file} introduced foreign key errors`);
      }
    } else {
      database.sqlite.transaction(() => {
        database.sqlite.exec(sql);
        recordMigration.run(file, new Date().toISOString());
      })();
    }
    applied.push(file);
  }

  return applied;
}
