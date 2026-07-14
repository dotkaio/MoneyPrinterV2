export interface TextGenerationRequest {
  prompt: string;
  system?: string;
  model?: string;
  responseSchema?: Readonly<Record<string, unknown>>;
  temperature?: number;
}

export interface TextGenerationResult {
  text: string;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
}

export interface TextGenerator {
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
  healthCheck(): Promise<string>;
}

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio: string;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: string;
  provider: string;
  model: string;
  durationMs: number;
}

export interface ImageGenerator {
  generate(request: ImageGenerationRequest): Promise<GeneratedImage>;
}

export interface SpeechRequest {
  text: string;
  outputPath: string;
  voice?: string;
}

export interface AudioArtifact {
  path: string;
  provider: string;
}

export interface SpeechSynthesizer {
  synthesize(request: SpeechRequest): Promise<AudioArtifact>;
}

export interface TranscriptionRequest {
  audioPath: string;
  outputPath: string;
  language?: string;
}

export interface SubtitleArtifact {
  path: string;
  provider: string;
  format: "srt";
}

export interface Transcriber {
  transcribe(request: TranscriptionRequest): Promise<SubtitleArtifact>;
}
