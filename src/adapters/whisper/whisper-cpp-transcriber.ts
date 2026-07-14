import { dirname, extname } from "node:path";
import { mkdir, rename } from "node:fs/promises";

import { execa } from "execa";

import type {
  SubtitleArtifact,
  Transcriber,
  TranscriptionRequest,
} from "../../ports/generation.js";
import { AppError } from "../../shared/errors.js";

export interface WhisperCppTranscriberOptions {
  executable: string;
  modelPath: string;
}

export class WhisperCppTranscriber implements Transcriber {
  public constructor(private readonly options: WhisperCppTranscriberOptions) {}

  public async transcribe(
    request: TranscriptionRequest,
  ): Promise<SubtitleArtifact> {
    if (this.options.modelPath.length === 0) {
      throw new AppError(
        "whisper.cpp model path is not configured",
        "WHISPER_MODEL_MISSING",
      );
    }

    await mkdir(dirname(request.outputPath), { recursive: true });
    const outputBase = request.outputPath.slice(
      0,
      -extname(request.outputPath).length,
    );
    const result = await execa(
      this.options.executable,
      [
        "-m",
        this.options.modelPath,
        "-f",
        request.audioPath,
        "-osrt",
        "-of",
        outputBase,
        ...(request.language === undefined ? [] : ["-l", request.language]),
      ],
      { reject: false },
    );
    if (result.exitCode !== 0) {
      throw new AppError(
        result.stderr || "whisper.cpp failed",
        "WHISPER_FAILED",
        true,
      );
    }
    const generatedPath = `${outputBase}.srt`;
    if (generatedPath !== request.outputPath) {
      await rename(generatedPath, request.outputPath);
    }
    return { path: request.outputPath, provider: "whisper.cpp", format: "srt" };
  }
}
