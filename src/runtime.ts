import type { Logger } from "pino";

import { loadConfig, type LoadedConfig } from "./infrastructure/config/load.js";
import {
  openDatabase,
  runMigrations,
  type DatabaseContext,
} from "./infrastructure/database/client.js";
import {
  AccountRepository,
  AiProviderProfileRepository,
  AffiliateRepository,
  ContentCreationRepository,
  ContentRepository,
  JobRepository,
  OutreachRepository,
  PublishingRepository,
  ScheduleRepository,
} from "./infrastructure/database/repositories.js";
import { AccountConnectionRepository } from "./infrastructure/database/account-connection-repository.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { ArtifactStore } from "./infrastructure/filesystem/artifact-store.js";

export interface Runtime {
  loadedConfig: LoadedConfig;
  database: DatabaseContext;
  logger: Logger;
  accounts: AccountRepository;
  aiProviders: AiProviderProfileRepository;
  connections: AccountConnectionRepository;
  creations: ContentCreationRepository;
  content: ContentRepository;
  jobs: JobRepository;
  schedules: ScheduleRepository;
  artifactStore: ArtifactStore;
  publishing: PublishingRepository;
  affiliate: AffiliateRepository;
  outreach: OutreachRepository;
  close(): void;
}

export function createRuntime(configPath?: string): Runtime {
  const loadedConfig = loadConfig(configPath);
  const logger = createLogger(loadedConfig.config);
  const database = openDatabase(loadedConfig.config);
  const appliedMigrations = runMigrations(database);
  if (appliedMigrations.length > 0) {
    logger.info(
      { migrations: appliedMigrations },
      "Applied database migrations",
    );
  }

  return {
    loadedConfig,
    database,
    logger,
    accounts: new AccountRepository(database),
    aiProviders: new AiProviderProfileRepository(database),
    connections: new AccountConnectionRepository(database),
    creations: new ContentCreationRepository(database),
    content: new ContentRepository(database),
    jobs: new JobRepository(database),
    schedules: new ScheduleRepository(database),
    artifactStore: new ArtifactStore(loadedConfig.config.dataDirectory),
    publishing: new PublishingRepository(database),
    affiliate: new AffiliateRepository(database),
    outreach: new OutreachRepository(database),
    close(): void {
      database.sqlite.close();
    },
  };
}
