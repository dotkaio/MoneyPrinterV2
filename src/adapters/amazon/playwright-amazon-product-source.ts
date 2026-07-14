import { firefox } from "playwright";

import type { ProductDetails, ProductSource } from "../../ports/outreach.js";
import { parseAmazonProduct } from "./amazon-product-parser.js";

export interface PlaywrightAmazonProductSourceOptions {
  headless: boolean;
  timeoutMs?: number;
}

export class PlaywrightAmazonProductSource implements ProductSource {
  public constructor(
    private readonly options: PlaywrightAmazonProductSourceOptions,
  ) {}

  public async fetchProduct(url: string): Promise<ProductDetails> {
    const browser = await firefox.launch({ headless: this.options.headless });
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.options.timeoutMs ?? 60_000,
      });
      return parseAmazonProduct(await page.content(), page.url());
    } finally {
      await browser.close();
    }
  }
}
