import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { execa } from "execa";
import { z } from "zod";

import type {
  ShortRenderRequest,
  VideoArtifact,
  VideoRenderer,
} from "../../ports/media.js";
import { AppError } from "../../shared/errors.js";

const ffprobeSchema = z.object({
  streams: z.array(
    z.object({
      codec_type: z.string(),
      codec_name: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
      duration: z.string().optional(),
    }),
  ),
  format: z.object({ duration: z.string().optional() }),
});

export interface FfmpegVideoRendererOptions {
  ffmpegPath: string;
  ffprobePath: string;
  width: number;
  height: number;
  framesPerSecond: number;
  backgroundMusicVolume: number;
}

export class FfmpegVideoRenderer implements VideoRenderer {
  public constructor(private readonly options: FfmpegVideoRendererOptions) {}

  public async renderShort(
    request: ShortRenderRequest,
  ): Promise<VideoArtifact> {
    if (request.scenes.length === 0) {
      throw new AppError(
        "At least one scene is required",
        "RENDER_SCENES_MISSING",
      );
    }
    if (request.scenes.some((scene) => scene.durationSeconds <= 0)) {
      throw new AppError(
        "Scene durations must be positive",
        "RENDER_DURATION_INVALID",
      );
    }

    await mkdir(dirname(request.outputPath), { recursive: true });
    const concatPath = resolve(
      dirname(request.outputPath),
      `.scenes-${crypto.randomUUID()}.txt`,
    );
    const concat = request.scenes
      .flatMap((scene) => [
        `file '${this.escapeConcatPath(scene.imagePath)}'`,
        `duration ${scene.durationSeconds.toFixed(6)}`,
      ])
      .concat(
        `file '${this.escapeConcatPath(request.scenes.at(-1)?.imagePath ?? "")}'`,
      )
      .join("\n");
    await writeFile(concatPath, `${concat}\n`, "utf8");

    const totalDuration = request.scenes.reduce(
      (sum, scene) => sum + scene.durationSeconds,
      0,
    );
    const videoFilters = [
      `scale=${this.options.width}:${this.options.height}:force_original_aspect_ratio=increase`,
      `crop=${this.options.width}:${this.options.height}`,
      `fps=${this.options.framesPerSecond}`,
      "format=yuv420p",
      ...(request.subtitlesPath === undefined
        ? []
        : [`subtitles='${this.escapeFilterPath(request.subtitlesPath)}'`]),
    ];

    const args = [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-i",
      request.narrationPath,
      ...(request.backgroundMusicPath === undefined
        ? []
        : ["-stream_loop", "-1", "-i", request.backgroundMusicPath]),
      "-vf",
      videoFilters.join(","),
      "-map",
      "0:v:0",
      ...(request.backgroundMusicPath === undefined
        ? ["-map", "1:a:0"]
        : [
            "-filter_complex",
            `[2:a]volume=${this.options.backgroundMusicVolume}[music];[1:a][music]amix=inputs=2:duration=first:dropout_transition=0[mixed]`,
            "-map",
            "[mixed]",
          ]),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(this.options.framesPerSecond),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-t",
      totalDuration.toFixed(6),
      "-movflags",
      "+faststart",
      request.outputPath,
    ];

    try {
      const result = await execa(this.options.ffmpegPath, args, {
        reject: false,
      });
      if (result.exitCode !== 0) {
        throw new AppError(
          result.stderr || "FFmpeg failed",
          "FFMPEG_RENDER_FAILED",
          true,
        );
      }
    } finally {
      await rm(concatPath, { force: true });
    }

    return this.inspect(request.outputPath);
  }

  public async inspect(path: string): Promise<VideoArtifact> {
    const parsed = await this.probe(path);
    const video = parsed.streams.find(
      (stream) => stream.codec_type === "video",
    );
    const audio = parsed.streams.find(
      (stream) => stream.codec_type === "audio",
    );
    if (video === undefined || audio === undefined) {
      throw new AppError(
        "Rendered file must contain video and audio streams",
        "VIDEO_STREAMS_INVALID",
      );
    }
    const duration = this.parseDuration(
      parsed.format.duration ?? video.duration,
    );

    return {
      path,
      width: video.width ?? 0,
      height: video.height ?? 0,
      durationSeconds: duration,
      videoCodec: video.codec_name,
      audioCodec: audio.codec_name,
      provider: "ffmpeg",
    };
  }

  public async duration(path: string): Promise<number> {
    const parsed = await this.probe(path);
    return this.parseDuration(
      parsed.format.duration ??
        parsed.streams.find((stream) => stream.duration !== undefined)
          ?.duration,
    );
  }

  private async probe(path: string): Promise<z.infer<typeof ffprobeSchema>> {
    const result = await execa(
      this.options.ffprobePath,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
      { reject: false },
    );
    if (result.exitCode !== 0) {
      throw new AppError(result.stderr || "ffprobe failed", "FFPROBE_FAILED");
    }
    return ffprobeSchema.parse(JSON.parse(result.stdout) as unknown);
  }

  private parseDuration(value: string | undefined): number {
    const duration = Number.parseFloat(value ?? "0");
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new AppError(
        "Rendered file has an invalid duration",
        "VIDEO_DURATION_INVALID",
      );
    }

    return duration;
  }

  private escapeConcatPath(path: string): string {
    return path.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  }

  private escapeFilterPath(path: string): string {
    return path
      .replaceAll("\\", "/")
      .replaceAll(":", "\\:")
      .replaceAll("'", "\\'")
      .replaceAll(",", "\\,");
  }
}
