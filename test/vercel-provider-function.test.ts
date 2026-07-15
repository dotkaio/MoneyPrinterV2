import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../api/provider.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Vercel provider function", () => {
  it("rejects cross-origin credential requests", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      providerRequest(
        {
          action: "verify",
          kind: "openai",
          apiKey: "fixture-secret-key",
          model: "fixture-model",
        },
        "https://malicious.example",
      ),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies a key without returning or retaining it", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      providerRequest({
        action: "verify",
        kind: "openai",
        apiKey: "fixture-secret-key",
        model: "fixture-model",
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toContain("verified");
    expect(body).not.toContain("fixture-secret-key");
  });

  it("returns a complete credential-safe creation", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  title: "A useful title",
                  hook: "Start with the surprising part.",
                  script: "A polished script with useful structure.",
                  caption: "A ready-to-publish caption.",
                  hashtags: ["#useful", "fixture"],
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 21, output_tokens: 34 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      providerRequest({
        action: "generate",
        kind: "openai",
        apiKey: "fixture-secret-key",
        model: "fixture-model",
        input: {
          format: "short-video",
          topic: "Browser-local content tools",
          audience: "Creative teams",
          tone: "Direct",
          language: "English",
        },
      }),
    );
    const body = await response.text();
    const creation = JSON.parse(body) as {
      title: string;
      hashtags: readonly string[];
    };

    expect(response.status).toBe(201);
    expect(creation).toMatchObject({
      title: "A useful title",
      hashtags: ["useful", "fixture"],
    });
    expect(body).not.toContain("fixture-secret-key");
  });
});

function providerRequest(body: unknown, origin = productionOrigin): Request {
  return new Request(`${productionOrigin}/api/provider`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify(body),
  });
}

const productionOrigin = "https://themoneymaker.vercel.app";
