import { asc, eq } from "drizzle-orm";

import type {
  AccountConnection,
  AccountConnectionState,
  Platform,
} from "../../domain/model.js";
import { nowIso } from "../../shared/ids.js";
import type { DatabaseContext } from "./client.js";
import { accountConnections } from "./schema.js";

export interface SaveAccountConnectionInput {
  accountId: string;
  platform: Platform;
  state: AccountConnectionState;
  externalAccountId?: string | null;
  displayName?: string | null;
  scopes?: readonly string[];
  expiresAt?: string | null;
  connectedAt?: string | null;
  lastCheckedAt?: string | null;
  lastError?: string | null;
}

export class AccountConnectionRepository {
  public constructor(private readonly database: DatabaseContext) {}

  public findByAccountId(accountId: string): AccountConnection | null {
    return (
      this.database.orm
        .select()
        .from(accountConnections)
        .where(eq(accountConnections.accountId, accountId))
        .get() ?? null
    );
  }

  public list(): readonly AccountConnection[] {
    return this.database.orm
      .select()
      .from(accountConnections)
      .orderBy(asc(accountConnections.createdAt))
      .all();
  }

  public save(input: SaveAccountConnectionInput): AccountConnection {
    const existing = this.findByAccountId(input.accountId);
    const timestamp = nowIso();
    const connection: AccountConnection = {
      accountId: input.accountId,
      platform: input.platform,
      state: input.state,
      externalAccountId:
        "externalAccountId" in input
          ? (input.externalAccountId ?? null)
          : (existing?.externalAccountId ?? null),
      displayName:
        "displayName" in input
          ? (input.displayName ?? null)
          : (existing?.displayName ?? null),
      scopes: input.scopes ?? existing?.scopes ?? [],
      expiresAt:
        "expiresAt" in input
          ? (input.expiresAt ?? null)
          : (existing?.expiresAt ?? null),
      connectedAt:
        "connectedAt" in input
          ? (input.connectedAt ?? null)
          : (existing?.connectedAt ?? null),
      lastCheckedAt:
        "lastCheckedAt" in input
          ? (input.lastCheckedAt ?? null)
          : (existing?.lastCheckedAt ?? null),
      lastError:
        "lastError" in input
          ? (input.lastError ?? null)
          : (existing?.lastError ?? null),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.database.orm
      .insert(accountConnections)
      .values(connection)
      .onConflictDoUpdate({
        target: accountConnections.accountId,
        set: {
          platform: connection.platform,
          state: connection.state,
          externalAccountId: connection.externalAccountId,
          displayName: connection.displayName,
          scopes: connection.scopes,
          expiresAt: connection.expiresAt,
          connectedAt: connection.connectedAt,
          lastCheckedAt: connection.lastCheckedAt,
          lastError: connection.lastError,
          updatedAt: connection.updatedAt,
        },
      })
      .run();
    return this.findByAccountId(input.accountId) ?? connection;
  }

  public delete(accountId: string): void {
    this.database.orm
      .delete(accountConnections)
      .where(eq(accountConnections.accountId, accountId))
      .run();
  }
}
