import { describe, expect, it } from "vitest";

import { parseAmazonProduct } from "../src/adapters/amazon/amazon-product-parser.js";

describe("parseAmazonProduct", () => {
  it("extracts stable product fields from an HTML fixture", () => {
    const product = parseAmazonProduct(
      `
        <html><head><link rel="canonical" href="https://www.amazon.com/dp/ABC123"></head>
        <body>
          <span id="productTitle">  Fixture Telescope  </span>
          <div id="feature-bullets"><ul>
            <li><span class="a-list-item">Portable tripod</span></li>
            <li><span class="a-list-item">Two eyepieces</span></li>
          </ul></div>
          <span class="a-price"><span class="a-offscreen">$99.00</span></span>
        </body></html>
      `,
      "https://www.amazon.com/example",
    );

    expect(product).toEqual({
      sourceUrl: "https://www.amazon.com/example",
      canonicalUrl: "https://www.amazon.com/dp/ABC123",
      title: "Fixture Telescope",
      features: ["Portable tripod", "Two eyepieces"],
      price: "$99.00",
    });
  });

  it("rejects block pages without a title", () => {
    expect(() =>
      parseAmazonProduct("<html>blocked</html>", "https://amazon.com"),
    ).toThrow(/product title/u);
  });
});
