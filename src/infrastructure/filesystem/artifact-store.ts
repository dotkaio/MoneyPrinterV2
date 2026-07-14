import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { AppError } from "../../shared/errors.js";

export interface PersistedArtifact {
  path: string;
  checksum: string;
}

export class ArtifactStore {
  public constructor(private readonly dataDirectory: string) {}

  public async prepareContentDirectory(contentItemId: string): Promise<string> {
    const directory = resolve(this.dataDirectory, "artifacts", contentItemId);
    await mkdir(directory, { recursive: true });
    return directory;
  }

  public async pathFor(contentItemId: string, name: string): Promise<string> {
    if (basename(name) !== name) {
      throw new AppError(
        `Artifact name must not contain a path: ${name}`,
        "ARTIFACT_NAME_INVALID",
      );
    }
    const directory = await this.prepareContentDirectory(contentItemId);
    return resolve(directory, name);
  }

  public async writeBytes(
    contentItemId: string,
    name: string,
    bytes: Uint8Array,
  ): Promise<PersistedArtifact> {
    const path = await this.pathFor(contentItemId, name);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    try {
      await writeFile(path, bytes, { flag: "wx" });
    } catch (error) {
      const code =
        error instanceof Error && "code" in error ? error.code : undefined;
      if (code !== "EEXIST" || (await this.checksum(path)) !== checksum) {
        throw error;
      }
    }
    return { path, checksum };
  }

  public checksum(path: string): Promise<string> {
    return new Promise((resolveChecksum, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(path);
      stream.on("error", reject);
      stream.on("data", (chunk: Buffer) => hash.update(chunk));
      stream.on("end", () => resolveChecksum(hash.digest("hex")));
    });
  }
}
