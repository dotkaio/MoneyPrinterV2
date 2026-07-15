import { browserApiRequest } from "@/lib/browser-api";
import { networkApiRequest } from "@/lib/network-api";
import { isHostedWebApp } from "@/lib/runtime";

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (isHostedWebApp && path !== "/api/provider") {
    return browserApiRequest<T>(path, init);
  }
  return networkApiRequest<T>(path, init);
}
