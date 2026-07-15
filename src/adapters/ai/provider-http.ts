import { AppError } from "../../shared/errors.js";

export async function readProviderResponse(
  response: Response,
  provider: string,
): Promise<unknown> {
  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch (error) {
      throw new AppError(
        `${provider} returned an invalid JSON response`,
        "AI_PROVIDER_RESPONSE_INVALID",
        response.status >= 500,
        { cause: error },
      );
    }
  }
  if (!response.ok) {
    const detail = providerErrorMessage(body);
    throw new AppError(
      detail ?? `${provider} returned HTTP ${response.status}`,
      "AI_PROVIDER_REQUEST_FAILED",
      response.status === 408 ||
        response.status === 409 ||
        response.status === 429 ||
        response.status >= 500,
    );
  }
  return body;
}

export function providerUrl(baseUrl: string, path: string): URL {
  return new URL(path.replace(/^\//u, ""), `${baseUrl.replace(/\/$/u, "")}/`);
}

function providerErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return null;
  }
  const error = body.error;
  if (typeof error === "string") {
    return error.slice(0, 1000);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message.slice(0, 1000);
  }
  return null;
}
