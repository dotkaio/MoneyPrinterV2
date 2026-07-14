import { readFile, stat } from "node:fs/promises";

import { z } from "zod";

import type { PublishingRepository } from "../../infrastructure/database/repositories.js";
import type {
  PublishedVideo,
  VideoPublisher,
  VideoPublishRequest,
} from "../../ports/publishing.js";
import { AppError } from "../../shared/errors.js";
import type { YouTubeAccessTokenProvider } from "./youtube-oauth-manager.js";

const uploadedVideoSchema = z.object({ id: z.string().min(1) });

type SessionStatus =
  | { kind: "pending"; uploadedBytes: number }
  | { kind: "completed"; videoId: string }
  | { kind: "expired" };

export interface YouTubeApiPublisherOptions {
  uploadBaseUrl: string;
  livePublishing: boolean;
  maximumUploadAttempts?: number;
}

export class YouTubeApiPublisher implements VideoPublisher {
  public constructor(
    private readonly tokens: YouTubeAccessTokenProvider,
    private readonly publishing: PublishingRepository,
    private readonly options: YouTubeApiPublisherOptions,
  ) {}

  public async publish(request: VideoPublishRequest): Promise<PublishedVideo> {
    if (!this.options.livePublishing && request.privacyStatus !== "private") {
      throw new AppError(
        "Live publishing is disabled; YouTube uploads must use private privacy status",
        "LIVE_PUBLISHING_DISABLED",
      );
    }

    const file = await stat(request.videoPath);
    if (!file.isFile() || file.size === 0) {
      throw new AppError(
        `Video file is empty or missing: ${request.videoPath}`,
        "VIDEO_FILE_INVALID",
      );
    }

    const stored = this.publishing.findUploadSession(request.idempotencyKey);
    if (stored?.state === "completed" && stored.platformItemId !== null) {
      return this.result(stored.platformItemId, request.privacyStatus);
    }

    let accessToken = await this.tokens.accessToken(request.accountId);
    let session =
      stored !== null &&
      stored.filePath === request.videoPath &&
      stored.fileSize === file.size
        ? stored
        : await this.initiate(request, file.size, accessToken);
    let offset = session.uploadedBytes;

    if (stored !== null && session.sessionUri === stored.sessionUri) {
      const status = await this.querySession(
        session.sessionUri,
        file.size,
        accessToken,
      );
      if (status.kind === "completed") {
        this.completeSession(
          request,
          session.sessionUri,
          file.size,
          status.videoId,
        );
        return this.result(status.videoId, request.privacyStatus);
      }
      if (status.kind === "expired") {
        session = await this.initiate(request, file.size, accessToken);
        offset = 0;
      } else {
        offset = status.uploadedBytes;
      }
    }

    const maximumAttempts = this.options.maximumUploadAttempts ?? 5;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      accessToken = await this.tokens.accessToken(request.accountId);
      const response = await this.uploadChunk(
        session.sessionUri,
        request.videoPath,
        file.size,
        offset,
        accessToken,
      );
      if (response.ok) {
        const videoId = uploadedVideoSchema.parse(await response.json()).id;
        this.completeSession(request, session.sessionUri, file.size, videoId);
        return this.result(videoId, request.privacyStatus);
      }
      if (response.status === 308) {
        offset = this.uploadedBytes(response.headers.get("range"));
        this.publishing.saveUploadSession({
          idempotencyKey: request.idempotencyKey,
          accountId: request.accountId,
          sessionUri: session.sessionUri,
          filePath: request.videoPath,
          fileSize: file.size,
          uploadedBytes: offset,
          state: "uploading",
        });
        continue;
      }
      const retryable = response.status === 429 || response.status >= 500;
      const message = await response.text();
      if (!retryable || attempt === maximumAttempts) {
        throw new AppError(
          message || `YouTube upload failed with HTTP ${response.status}`,
          "YOUTUBE_UPLOAD_FAILED",
          retryable,
        );
      }
      await new Promise<void>((resolveDelay) =>
        setTimeout(resolveDelay, 2 ** attempt * 250),
      );
    }

    throw new AppError(
      "YouTube upload exhausted all attempts",
      "YOUTUBE_UPLOAD_EXHAUSTED",
      true,
    );
  }

  private async initiate(
    request: VideoPublishRequest,
    fileSize: number,
    accessToken: string,
  ) {
    const url = new URL(this.options.uploadBaseUrl);
    url.searchParams.set("uploadType", "resumable");
    url.searchParams.set("part", "snippet,status");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-length": String(fileSize),
        "x-upload-content-type": "video/mp4",
      },
      body: JSON.stringify({
        snippet: { title: request.title, description: request.description },
        status: { privacyStatus: request.privacyStatus },
      }),
    });
    const sessionUri = response.headers.get("location");
    if (!response.ok || sessionUri === null) {
      throw new AppError(
        (await response.text()) ||
          `Could not initiate YouTube upload: HTTP ${response.status}`,
        "YOUTUBE_UPLOAD_INIT_FAILED",
        response.status === 429 || response.status >= 500,
      );
    }
    return this.publishing.saveUploadSession({
      idempotencyKey: request.idempotencyKey,
      accountId: request.accountId,
      sessionUri,
      filePath: request.videoPath,
      fileSize,
      uploadedBytes: 0,
      state: "initiated",
    });
  }

  private async querySession(
    sessionUri: string,
    fileSize: number,
    accessToken: string,
  ): Promise<SessionStatus> {
    const response = await fetch(sessionUri, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-length": "0",
        "content-range": `bytes */${fileSize}`,
      },
    });
    if (response.status === 308) {
      return {
        kind: "pending",
        uploadedBytes: this.uploadedBytes(response.headers.get("range")),
      };
    }
    if (response.ok) {
      return {
        kind: "completed",
        videoId: uploadedVideoSchema.parse(await response.json()).id,
      };
    }
    if (response.status === 404 || response.status === 410) {
      return { kind: "expired" };
    }
    throw new AppError(
      (await response.text()) ||
        `YouTube session query failed: HTTP ${response.status}`,
      "YOUTUBE_SESSION_QUERY_FAILED",
      response.status === 429 || response.status >= 500,
    );
  }

  private async uploadChunk(
    sessionUri: string,
    filePath: string,
    fileSize: number,
    offset: number,
    accessToken: string,
  ): Promise<Response> {
    const bytes = await readFile(filePath);
    const body = new Blob([new Uint8Array(bytes.subarray(offset))], {
      type: "video/mp4",
    });
    const options: RequestInit = {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-length": String(fileSize - offset),
        "content-range": `bytes ${offset}-${fileSize - 1}/${fileSize}`,
        "content-type": "video/mp4",
      },
      body,
    };
    return fetch(sessionUri, options);
  }

  private uploadedBytes(range: string | null): number {
    if (range === null) {
      return 0;
    }
    const match = /bytes=0-(\d+)/u.exec(range);
    return match?.[1] === undefined ? 0 : Number.parseInt(match[1], 10) + 1;
  }

  private completeSession(
    request: VideoPublishRequest,
    sessionUri: string,
    fileSize: number,
    videoId: string,
  ): void {
    this.publishing.saveUploadSession({
      idempotencyKey: request.idempotencyKey,
      accountId: request.accountId,
      sessionUri,
      filePath: request.videoPath,
      fileSize,
      uploadedBytes: fileSize,
      state: "completed",
      platformItemId: videoId,
    });
  }

  private result(videoId: string, privacyStatus: string): PublishedVideo {
    return {
      platformItemId: videoId,
      publicUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      privacyStatus,
      provider: "youtube-data-api",
    };
  }
}
