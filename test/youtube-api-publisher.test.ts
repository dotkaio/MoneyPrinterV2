import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { YouTubeApiPublisher } from "../src/adapters/youtube/youtube-api-publisher.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MPV2_DATA_DIRECTORY;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("YouTubeApiPublisher", () => {
  it("persists and resumes a resumable upload session", async () => {
    const directory = join(tmpdir(), `mpv2-youtube-${crypto.randomUUID()}`);
    directories.push(directory);
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));
    const account = runtime.accounts.create({
      platform: "youtube",
      nickname: "Fixture",
      niche: "testing",
      language: "English",
    });
    const videoPath = join(directory, "video.mp4");
    writeFileSync(videoPath, Buffer.from("01234567890123456789"));

    const contentRanges: string[] = [];
    let uploadRequests = 0;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation((input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (
          init?.method === "POST" &&
          url.startsWith("https://upload.test/upload")
        ) {
          return Promise.resolve(
            new Response(null, {
              status: 200,
              headers: { location: "https://upload.test/session/one" },
            }),
          );
        }
        if (
          init?.method === "PUT" &&
          url === "https://upload.test/session/one"
        ) {
          uploadRequests += 1;
          contentRanges.push(
            new Headers(init.headers).get("content-range") ?? "",
          );
          return Promise.resolve(
            uploadRequests === 1
              ? new Response(null, {
                  status: 308,
                  headers: { range: "bytes=0-9" },
                })
              : Response.json({ id: "video-fixture" }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new YouTubeApiPublisher(
      { accessToken: () => Promise.resolve("fixture-token") },
      runtime.publishing,
      { uploadBaseUrl: "https://upload.test/upload", livePublishing: false },
    );
    const request = {
      accountId: account.id,
      videoPath,
      title: "Fixture video",
      description: "Fixture description",
      privacyStatus: "private" as const,
      idempotencyKey: "youtube:fixture",
    };

    const first = await publisher.publish(request);
    const repeated = await publisher.publish(request);

    expect(first.platformItemId).toBe("video-fixture");
    expect(repeated).toEqual(first);
    expect(contentRanges).toEqual(["bytes 0-19/20", "bytes 10-19/20"]);
    expect(uploadRequests).toBe(2);
    expect(
      runtime.publishing.findUploadSession(request.idempotencyKey)?.state,
    ).toBe("completed");
    runtime.close();
  });

  it("rejects non-private uploads while live publishing is disabled", async () => {
    const directory = join(tmpdir(), `mpv2-youtube-${crypto.randomUUID()}`);
    directories.push(directory);
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));
    const publisher = new YouTubeApiPublisher(
      { accessToken: () => Promise.resolve("fixture-token") },
      runtime.publishing,
      {
        uploadBaseUrl: "https://example.invalid/upload",
        livePublishing: false,
      },
    );

    await expect(
      publisher.publish({
        accountId: crypto.randomUUID(),
        videoPath: "/missing.mp4",
        title: "Fixture",
        description: "Fixture",
        privacyStatus: "public",
        idempotencyKey: "youtube:public",
      }),
    ).rejects.toThrow(/Live publishing is disabled/u);
    runtime.close();
  });
});
