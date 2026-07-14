export interface ProductDetails {
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  features: readonly string[];
  price: string | null;
}

export interface ProductSource {
  fetchProduct(url: string): Promise<ProductDetails>;
}

export interface BusinessLead {
  businessName: string;
  websiteUrl: string;
  domain: string;
  email: string;
  source: string;
}

export interface BusinessSource {
  discover(niche: string, limit: number): Promise<readonly BusinessLead[]>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}

export interface EmailDelivery {
  messageId: string;
  provider: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailDelivery>;
}
