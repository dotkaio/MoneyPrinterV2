import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse } from "csv-parse/sync";
import { execa } from "execa";
import { z } from "zod";

import type { BusinessLead, BusinessSource } from "../../ports/outreach.js";
import { AppError } from "../../shared/errors.js";

const csvRowsSchema = z.array(
  z.record(z.string(), z.string().nullable().optional()),
);

export interface GoogleMapsBusinessSourceOptions {
  scraperExecutable: string;
  scraperTimeoutMs: number;
  websiteTimeoutMs: number;
  maximumWebsiteBytes: number;
  dataDirectory: string;
}

export class GoogleMapsBusinessSource implements BusinessSource {
  public constructor(
    private readonly options: GoogleMapsBusinessSourceOptions,
  ) {}

  public async discover(
    niche: string,
    limit: number,
  ): Promise<readonly BusinessLead[]> {
    const directory = resolve(
      this.options.dataDirectory,
      "tmp",
      `outreach-${crypto.randomUUID()}`,
    );
    await mkdir(directory, { recursive: true });
    const inputPath = resolve(directory, "niche.txt");
    const outputPath = resolve(directory, "results.csv");
    await writeFile(inputPath, `${niche}\n`, "utf8");

    try {
      const result = await execa(
        this.options.scraperExecutable,
        ["-input", inputPath, "-results", outputPath],
        { reject: false, timeout: this.options.scraperTimeoutMs },
      );
      if (result.exitCode !== 0) {
        throw new AppError(
          result.stderr || "Google Maps scraper failed",
          "GOOGLE_MAPS_SCRAPER_FAILED",
          true,
        );
      }
      const parsed = csvRowsSchema.parse(
        parse(await readFile(outputPath, "utf8"), {
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
        }),
      );
      const leads: BusinessLead[] = [];
      for (const row of parsed) {
        if (leads.length >= limit) {
          break;
        }
        const website = row.website ?? row.web_site ?? row.url;
        if (website === null || website === undefined || website.length === 0) {
          continue;
        }
        const lead = await this.leadFromWebsite(
          row.title ?? row.name ?? row.business_name ?? "Unknown business",
          website,
        );
        if (
          lead !== null &&
          !leads.some((existing) => existing.email === lead.email)
        ) {
          leads.push(lead);
        }
      }
      return leads;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async leadFromWebsite(
    businessName: string,
    websiteUrl: string,
  ): Promise<BusinessLead | null> {
    let url: URL;
    try {
      url = new URL(websiteUrl);
    } catch {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    await this.assertPublicHost(url.hostname);
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(this.options.websiteTimeoutMs),
      headers: { "user-agent": "MoneyPrinterV2/3.0 outreach-discovery" },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }
    const declaredLength = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10,
    );
    if (declaredLength > this.options.maximumWebsiteBytes) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.options.maximumWebsiteBytes) {
      return null;
    }
    const html = new TextDecoder().decode(bytes);
    const email = this.extractEmail(html);
    if (email === null) {
      return null;
    }
    return {
      businessName: businessName.trim(),
      websiteUrl: response.url || url.href,
      domain: new URL(response.url || url.href).hostname.toLowerCase(),
      email,
      source: "google-maps-scraper",
    };
  }

  private extractEmail(html: string): string | null {
    const matches =
      html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) ?? [];
    return (
      matches
        .map((value) => value.toLowerCase())
        .find((value) => !/\.(png|jpg|jpeg|gif|webp|svg)$/u.test(value)) ?? null
    );
  }

  private async assertPublicHost(hostname: string): Promise<void> {
    const addresses =
      isIP(hostname) === 0
        ? await lookup(hostname, { all: true })
        : [{ address: hostname }];
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => this.isPrivateAddress(address))
    ) {
      throw new AppError(
        `Website resolves to a private or invalid address: ${hostname}`,
        "WEBSITE_HOST_BLOCKED",
      );
    }
  }

  private isPrivateAddress(address: string): boolean {
    if (
      address === "::1" ||
      address.startsWith("fc") ||
      address.startsWith("fd")
    ) {
      return true;
    }
    if (address.startsWith("fe80:")) {
      return true;
    }
    const octets = address.split(".").map(Number);
    if (octets.length !== 4) {
      return false;
    }
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 0
    );
  }
}
