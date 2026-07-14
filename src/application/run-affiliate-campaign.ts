import type {
  Account,
  AffiliateProduct,
  ContentItem,
} from "../domain/model.js";
import type {
  AffiliateRepository,
  ContentRepository,
} from "../infrastructure/database/repositories.js";
import type { TextGenerator } from "../ports/generation.js";
import type { ProductSource } from "../ports/outreach.js";
import { AppError, errorMessage } from "../shared/errors.js";

export interface AffiliateCampaignResult {
  product: AffiliateProduct;
  content: ContentItem;
}

export class RunAffiliateCampaign {
  public constructor(
    private readonly products: AffiliateRepository,
    private readonly content: ContentRepository,
    private readonly productSource: ProductSource,
    private readonly textGenerator: TextGenerator,
  ) {}

  public async execute(
    product: AffiliateProduct,
    account: Account,
  ): Promise<AffiliateCampaignResult> {
    if (account.platform !== "twitter" || product.accountId !== account.id) {
      throw new AppError(
        "Affiliate product must be linked to the selected Twitter account",
        "AFFILIATE_ACCOUNT_MISMATCH",
      );
    }
    let content = this.content.create(account.id, "affiliate-pitch");
    content = this.content.update(content.id, { state: "generating" });
    try {
      const details = await this.productSource.fetchProduct(product.sourceUrl);
      const updatedProduct = this.products.updateDetails(
        product.id,
        details.title,
        details.features,
      );
      const maximumCopyLength = 280 - product.affiliateUrl.length - 1;
      if (maximumCopyLength < 20) {
        throw new AppError(
          "Affiliate URL is too long for a Twitter post",
          "AFFILIATE_URL_TOO_LONG",
        );
      }
      const generated = await this.textGenerator.generate({
        system:
          "Write a useful, honest affiliate product recommendation. Return only the post copy and do not invent product claims.",
        prompt: [
          `Product: ${details.title}`,
          `Features: ${details.features.join("; ")}`,
          `Price: ${details.price ?? "unknown"}`,
          `Language: ${account.language}`,
          `Maximum copy length excluding the link: ${maximumCopyLength}`,
          "Do not include a URL; it will be appended exactly.",
        ].join("\n"),
        temperature: 0.6,
      });
      const copy = this.limitCopy(generated.text.trim(), maximumCopyLength);
      const pitchText = `${copy} ${product.affiliateUrl}`;
      content = this.content.update(content.id, {
        state: "ready",
        topic: details.title,
        script: pitchText,
        metadata: {
          pitchText,
          affiliateProductId: product.id,
          canonicalUrl: details.canonicalUrl,
          affiliateUrl: product.affiliateUrl,
          price: details.price,
          features: details.features,
        },
      });
      return { product: updatedProduct, content };
    } catch (error) {
      this.content.update(content.id, {
        state: "failed",
        errorCode:
          error instanceof AppError ? error.code : "AFFILIATE_CAMPAIGN_FAILED",
        errorMessage: errorMessage(error),
      });
      throw error;
    }
  }

  private limitCopy(copy: string, maximumLength: number): string {
    if (copy.length <= maximumLength) {
      return copy;
    }
    return `${copy
      .slice(0, maximumLength - 3)
      .replace(/\s+\S*$/u, "")
      .trimEnd()}...`;
  }
}
