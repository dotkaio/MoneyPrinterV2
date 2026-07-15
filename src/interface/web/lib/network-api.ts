interface ApiErrorPayload {
  error?: string;
  code?: string;
}

export async function networkApiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers,
  });
  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new Error(
      payload.error ?? `Request failed with HTTP ${response.status}`,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    const value = (await response.json()) as unknown;
    if (typeof value === "object" && value !== null) {
      return {
        ...("error" in value && typeof value.error === "string"
          ? { error: value.error }
          : {}),
        ...("code" in value && typeof value.code === "string"
          ? { code: value.code }
          : {}),
      };
    }
  } catch {
    return {};
  }
  return {};
}
