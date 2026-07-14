export interface ShortScene {
  imagePath: string;
  durationSeconds: number;
}

export interface ShortRenderRequest {
  scenes: readonly ShortScene[];
  narrationPath: string;
  subtitlesPath?: string;
  backgroundMusicPath?: string;
  outputPath: string;
}

export interface VideoArtifact {
  path: string;
  width: number;
  height: number;
  durationSeconds: number;
  videoCodec: string;
  audioCodec: string;
  provider: string;
}

export interface VideoRenderer {
  renderShort(request: ShortRenderRequest): Promise<VideoArtifact>;
  inspect(path: string): Promise<VideoArtifact>;
  duration(path: string): Promise<number>;
}
