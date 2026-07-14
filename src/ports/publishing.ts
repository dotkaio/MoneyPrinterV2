export interface VideoPublishRequest {
  accountId: string;
  videoPath: string;
  title: string;
  description: string;
  privacyStatus: "private" | "unlisted" | "public";
  idempotencyKey: string;
}

export interface PublishedVideo {
  platformItemId: string;
  publicUrl: string | null;
  privacyStatus: string;
  provider: string;
}

export interface VideoPublisher {
  publish(request: VideoPublishRequest): Promise<PublishedVideo>;
}

export interface SocialPostRequest {
  accountId: string;
  text: string;
  idempotencyKey: string;
}

export interface PublishedPost {
  platformItemId: string;
  publicUrl: string | null;
  provider: string;
}

export interface SocialPublisher {
  publish(request: SocialPostRequest): Promise<PublishedPost>;
}
