import {
  CircleAlertIcon,
  DatabaseIcon,
  FileCogIcon,
  PlayIcon,
  SendIcon,
  ServerCogIcon,
  ShieldIcon,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/use-dashboard";
import { apiRequest } from "@/lib/api";
import { isHostedWebApp } from "@/lib/runtime";
import type { PreflightResult } from "../../dashboard-contract";

export function SystemPage() {
  const { overview, loading } = useDashboard();
  const [preflight, setPreflight] = useState<readonly PreflightResult[] | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPreflight = async (): Promise<void> => {
    setChecking(true);
    try {
      setPreflight(
        await apiRequest<readonly PreflightResult[]>("/api/preflight"),
      );
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Runtime"
        title="System"
        description={
          isHostedWebApp
            ? "Inspect browser storage, external-action safety gates, and provider readiness from one place."
            : "Inspect local paths, external-action safety gates, and provider readiness from one place."
        }
        actions={
          <Button onClick={() => void runPreflight()} disabled={checking}>
            <PlayIcon data-icon="inline-start" />
            {checking ? "Checking…" : "Run preflight"}
          </Button>
        }
      />

      {error !== null && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Preflight failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {isHostedWebApp ? "Browser storage" : "Local storage"}
            </CardTitle>
            <CardDescription>
              {isHostedWebApp
                ? "Workspace state stays on this device and origin."
                : "Runtime state stays within these machine-local paths."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : (
              <>
                <PathRow
                  icon={DatabaseIcon}
                  label={isHostedWebApp ? "Draft storage" : "Database"}
                  value={overview?.databasePath ?? "Unavailable"}
                />
                <Separator />
                <PathRow
                  icon={FileCogIcon}
                  label={isHostedWebApp ? "Provider storage" : "Configuration"}
                  value={overview?.configurationPath ?? "Environment defaults"}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety gates</CardTitle>
            <CardDescription>
              External actions require explicit configuration and remain off by
              default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GateRow
              icon={ShieldIcon}
              label="Live publishing"
              description="Controls external social publishing"
              enabled={overview?.safety.livePublishing ?? false}
            />
            <Separator />
            <GateRow
              icon={SendIcon}
              label="Outreach sending"
              description="Controls external email delivery"
              enabled={overview?.safety.outreachSending ?? false}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System readiness</CardTitle>
          <CardDescription>
            {isHostedWebApp
              ? "Browser security and provider configuration checked on demand."
              : "Local tools, models, and provider configuration checked on demand."}
          </CardDescription>
          {preflight !== null && (
            <CardAction>
              <StatusBadge
                label={`${preflight.filter((result) => result.status === "ok").length} ready`}
                state={
                  preflight.every((result) => result.status === "ok")
                    ? "ok"
                    : "warning"
                }
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {checking ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : preflight === null ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ServerCogIcon className="size-5" />
              </span>
              <p className="font-medium">Ready when you are</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Run preflight for a live workspace and provider check.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preflight.map((result) => (
                <Card key={result.name} size="sm" className="bg-muted/25">
                  <CardHeader>
                    <CardTitle>{result.name}</CardTitle>
                    <CardAction>
                      <StatusBadge label={result.status} />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="text-xs leading-5 text-muted-foreground">
                    {result.detail}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PathRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DatabaseIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function GateRow({
  icon: Icon,
  label,
  description,
  enabled,
}: {
  icon: typeof ShieldIcon;
  label: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <StatusBadge
        label={enabled ? "enabled" : "guarded"}
        state={enabled ? "enabled" : "warning"}
      />
    </div>
  );
}
