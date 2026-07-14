import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

import { execa } from "execa";

import type {
  AudioArtifact,
  SpeechRequest,
  SpeechSynthesizer,
} from "../../ports/generation.js";
import { AppError } from "../../shared/errors.js";

export interface PiperSpeechSynthesizerOptions {
  executable: string;
  modelPath: string;
}

export class PiperSpeechSynthesizer implements SpeechSynthesizer {
  public constructor(private readonly options: PiperSpeechSynthesizerOptions) {}

  public async synthesize(request: SpeechRequest): Promise<AudioArtifact> {
    if (this.options.modelPath.length === 0) {
      throw new AppError(
        "Piper model path is not configured",
        "PIPER_MODEL_MISSING",
      );
    }

    await mkdir(dirname(request.outputPath), { recursive: true });
    const result = await execa(
      this.options.executable,
      ["--model", this.options.modelPath, "--output_file", request.outputPath],
      { input: request.text, reject: false },
    );
    if (result.exitCode !== 0) {
      throw new AppError(
        result.stderr || "Piper synthesis failed",
        "PIPER_FAILED",
        true,
      );
    }
    return { path: request.outputPath, provider: "piper" };
  }
}
