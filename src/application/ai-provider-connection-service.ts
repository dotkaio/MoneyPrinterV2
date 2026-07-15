import { z } from "zod";

import {
  aiProviderKinds,
  type AiProviderKind,
  type AiProviderProfile,
} from "../domain/model.js";
import type { AiProviderProfileRepository } from "../infrastructure/database/repositories.js";
import type { TextGenerator } from "../ports/generation.js";
import type { SecretVault } from "../ports/secrets.js";
import { AppError } from "../shared/errors.js";
import {
  aiProviderCatalog,
  requireAiProviderDefinition,
  type AiProviderDefinition,
} from "./ai-provider-catalog.js";
import type { ProviderTextGeneratorFactory } from "./create-provider-text-generator.js";

const connectProviderSchema = z.object({
  kind: z.enum(aiProviderKinds),
  apiKey: z
    .string()
    .trim()
    .min(8)
    .max(1000)
    .regex(/^[^\r\n]+$/u)
    .optional(),
  model: z.string().trim().min(1).max(200).optional(),
});

export type ConnectAiProviderInput = z.input<typeof connectProviderSchema>;

export interface AiProviderConnection extends AiProviderDefinition {
  connected: boolean;
  active: boolean;
  model: string;
  updatedAt: string | null;
}

export interface ActiveTextGenerator {
  profile: AiProviderProfile;
  generator: TextGenerator;
}

export class AiProviderConnectionService {
  public constructor(
    private readonly profiles: AiProviderProfileRepository,
    private readonly vault: SecretVault,
    private readonly generatorFactory: ProviderTextGeneratorFactory,
  ) {}

  public async list(): Promise<readonly AiProviderConnection[]> {
    const profiles = new Map(
      this.profiles.list().map((profile) => [profile.kind, profile] as const),
    );
    return Promise.all(
      aiProviderCatalog.map(async (definition) => {
        const profile = profiles.get(definition.kind);
        const connected =
          profile !== undefined &&
          (await this.vault.get(this.vaultKey(definition.kind))) !== null;
        return {
          ...definition,
          connected,
          active: connected && profile.active,
          model: profile?.model ?? definition.defaultModel,
          updatedAt: profile?.updatedAt ?? null,
        };
      }),
    );
  }

  public async connect(input: unknown): Promise<AiProviderConnection> {
    const parsed = connectProviderSchema.parse(input);
    const definition = requireAiProviderDefinition(parsed.kind);
    const model = parsed.model ?? definition.defaultModel;
    const key = this.vaultKey(parsed.kind);
    const previousSecret = await this.vault.get(key);
    const apiKey = parsed.apiKey ?? previousSecret;
    if (apiKey === null) {
      throw new AppError(
        `Enter a ${definition.name} API key to connect`,
        "AI_PROVIDER_KEY_MISSING",
      );
    }
    const generator = this.generatorFactory({
      kind: parsed.kind,
      apiKey,
      model,
      baseUrl: definition.baseUrl,
    });
    await generator.healthCheck();

    if (parsed.apiKey !== undefined) {
      await this.vault.set(key, parsed.apiKey);
    }
    try {
      this.profiles.saveActive({
        kind: parsed.kind,
        model,
        baseUrl: definition.baseUrl,
      });
    } catch (error) {
      if (parsed.apiKey !== undefined) {
        if (previousSecret === null) {
          await this.vault.delete(key);
        } else {
          await this.vault.set(key, previousSecret);
        }
      }
      throw error;
    }

    const connection = (await this.list()).find(
      (candidate) => candidate.kind === parsed.kind,
    );
    if (connection === undefined) {
      throw new Error(`Connected provider disappeared: ${parsed.kind}`);
    }
    return connection;
  }

  public async disconnect(kind: AiProviderKind): Promise<void> {
    await this.vault.delete(this.vaultKey(kind));
    this.profiles.delete(kind);
  }

  public async activeTextGenerator(): Promise<ActiveTextGenerator> {
    const profile = this.profiles.findActive();
    if (profile === null) {
      throw new AppError(
        "Connect an AI provider before creating content",
        "AI_PROVIDER_NOT_CONNECTED",
      );
    }
    const apiKey = await this.vault.get(this.vaultKey(profile.kind));
    if (apiKey === null) {
      throw new AppError(
        `Reconnect ${requireAiProviderDefinition(profile.kind).name}; its key is missing`,
        "AI_PROVIDER_KEY_MISSING",
      );
    }
    return {
      profile,
      generator: this.generatorFactory({
        kind: profile.kind,
        apiKey,
        model: profile.model,
        baseUrl: profile.baseUrl,
      }),
    };
  }

  private vaultKey(kind: AiProviderKind): string {
    return `ai-provider:${kind}`;
  }
}
