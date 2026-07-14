import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { execa } from "execa";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { FfmpegVideoRenderer } from "../src/adapters/ffmpeg/ffmpeg-video-renderer.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("FfmpegVideoRenderer", () => {
  it("renders a vertical H.264/AAC video from still images and narration", async () => {
    const directory = join(tmpdir(), `mpv2-render-${crypto.randomUUID()}`);
    directories.push(directory);
    mkdirSync(directory, { recursive: true });
    const firstImage = join(directory, "first.png");
    const secondImage = join(directory, "second.png");
    const narration = join(directory, "narration.wav");
    const output = join(directory, "short.mp4");
    await sharp({
      create: { width: 360, height: 640, channels: 3, background: "#172554" },
    })
      .png()
      .toFile(firstImage);
    await sharp({
      create: { width: 640, height: 360, channels: 3, background: "#7c2d12" },
    })
      .png()
      .toFile(secondImage);
    await execa("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      narration,
    ]);

    const renderer = new FfmpegVideoRenderer({
      ffmpegPath: "ffmpeg",
      ffprobePath: "ffprobe",
      width: 360,
      height: 640,
      framesPerSecond: 24,
      backgroundMusicVolume: 0.1,
    });
    const artifact = await renderer.renderShort({
      scenes: [
        { imagePath: firstImage, durationSeconds: 1 },
        { imagePath: secondImage, durationSeconds: 1 },
      ],
      narrationPath: narration,
      outputPath: output,
    });

    expect(artifact.width).toBe(360);
    expect(artifact.height).toBe(640);
    expect(artifact.videoCodec).toBe("h264");
    expect(artifact.audioCodec).toBe("aac");
    expect(artifact.durationSeconds).toBeGreaterThanOrEqual(1.9);
    expect(artifact.durationSeconds).toBeLessThanOrEqual(2.1);
  });
});
