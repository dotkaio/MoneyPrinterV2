import { load } from "cheerio";

import type { ProductDetails } from "../../ports/outreach.js";
import { AppError } from "../../shared/errors.js";

export function parseAmazonProduct(
  html: string,
  sourceUrl: string,
): ProductDetails {
  const $ = load(html);
  const title = $("#productTitle").text().replaceAll(/\s+/gu, " ").trim();
  if (title.length === 0) {
    throw new AppError(
      "Amazon page did not contain a product title; it may be blocked or unsupported",
      "AMAZON_PRODUCT_TITLE_MISSING",
      true,
    );
  }
  const features = $("#feature-bullets li span.a-list-item")
    .toArray()
    .map((element) => $(element).text().replaceAll(/\s+/gu, " ").trim())
    .filter((feature) => feature.length > 0);
  const canonicalHref = $('link[rel="canonical"]').attr("href");
  const canonicalUrl =
    canonicalHref === undefined
      ? sourceUrl
      : new URL(canonicalHref, sourceUrl).href;
  const price =
    $(".a-price .a-offscreen").first().text().trim() ||
    $("#priceblock_ourprice, #priceblock_dealprice").first().text().trim() ||
    null;

  return { sourceUrl, canonicalUrl, title, features, price };
}
