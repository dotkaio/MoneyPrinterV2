import { FfmpegVideoRenderer } from "../adapters/ffmpeg/ffmpeg-video-renderer.js";
import { GeminiImageGenerator } from "../adapters/gemini/gemini-image-generator.js";
import { OllamaTextGenerator } from "../adapters/ollama/ollama-text-generator.js";
import { PiperSpeechSynthesizer } from "../adapters/piper/piper-speech-synthesizer.js";
import { WhisperCppTranscriber } from "../adapters/whisper/whisper-cpp-transcriber.js";
import type { Runtime } from "../runtime.js";
import { GenerateYouTubeShort } from "./generate-youtube-short.js";

export function createYouTubeGenerator(runtime: Runtime): GenerateYouTubeShort {
  const config = runtime.loadedConfig.config;
  const transcription = config.providers.transcription;

  return new GenerateYouTubeShort(
    {
      content: runtime.content,
      artifactStore: runtime.artifactStore,
      textGenerator: new OllamaTextGenerator({
        baseUrl: config.providers.llm.baseUrl,
        model: config.providers.llm.model,
      }),
      imageGenerator: new GeminiImageGenerator({
        baseUrl: config.providers.image.baseUrl,
        model: config.providers.image.model,
        apiKey: process.env[config.providers.image.apiKeyEnv] ?? "",
      }),
      speechSynthesizer: new PiperSpeechSynthesizer({
        executable: config.providers.tts.executable,
        modelPath: config.providers.tts.modelPath,
      }),
      ...(transcription.modelPath.length > 0
        ? {
            transcriber: new WhisperCppTranscriber({
              executable: transcription.executable,
              modelPath: transcription.modelPath,
            }),
          }
        : {}),
      renderer: new FfmpegVideoRenderer({
        ffmpegPath: config.media.ffmpegPath,
        ffprobePath: config.media.ffprobePath,
        width: config.media.width,
        height: config.media.height,
        framesPerSecond: config.media.framesPerSecond,
        backgroundMusicVolume: config.media.backgroundMusicVolume,
      }),
    },
    {
      minimumScenes: config.media.minimumScenes,
      maximumScenes: config.media.maximumScenes,
      width: config.media.width,
      height: config.media.height,
      aspectRatio: config.providers.image.aspectRatio,
    },
  );
}
