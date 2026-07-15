import {
  ActivityIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  SparklesIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { useDashboard } from "@/hooks/use-dashboard";
import { formatDateTime, formatLabel } from "@/lib/format";
import { isHostedWebApp } from "@/lib/runtime";

const metricIcons = [
  SparklesIcon,
  UsersRoundIcon,
  ActivityIcon,
  CalendarClockIcon,
] as const;

export function OverviewPage() {
  const { overview, loading } = useDashboard();

  const metrics = overview
    ? isHostedWebApp
      ? [
          {
            label: "Creations",
            value: overview.counts.creations,
            detail: "Saved in this browser",
          },
          {
            label: "Provider",
            value: overview.activeProvider === null ? 0 : 1,
            detail: overview.activeProvider?.kind ?? "Not connected",
          },
          {
            label: "Storage",
            value: "Local",
            detail: "This browser and device",
          },
          {
            label: "External actions",
            value: "Off",
            detail: "Publishing stays guarded",
          },
        ]
      : [
          {
            label: "Creations",
            value: overview.counts.creations,
            detail: "Saved in your library",
          },
          {
            label: "Channels",
            value: overview.counts.accounts,
            detail: `${overview.counts.connectedAccounts} connected`,
          },
          {
            label: "Active jobs",
            value: overview.counts.activeJobs,
            detail: "Queued or running",
          },
          {
            label: "Schedules",
            value: overview.counts.schedules,
            detail: "Currently enabled",
          },
        ]
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description={
          isHostedWebApp
            ? "A live view of your browser-local content studio, connected provider, and saved drafts."
            : "A live view of your content studio, connected provider, publishing channels, and guarded automation."
        }
      />

      <Card className="relative overflow-hidden bg-primary text-primary-foreground ring-0">
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full border border-primary-foreground/15" />
        <div className="pointer-events-none absolute -top-12 -right-4 size-48 rounded-full border border-primary-foreground/10" />
        <CardHeader className="relative max-w-3xl gap-3 py-4 sm:py-8">
          <Badge className="bg-primary-foreground/10 text-primary-foreground">
            <ShieldCheckIcon data-icon="inline-start" />
            {isHostedWebApp
              ? "Browser-local workspace"
              : "Local-first operations"}
          </Badge>
          <CardTitle className="text-2xl font-semibold tracking-tight sm:text-4xl">
            From idea to finished draft in one{" "}
            {isHostedWebApp ? "private workspace" : "local workspace"}.
          </CardTitle>
          <CardDescription className="max-w-2xl leading-6 text-primary-foreground/70">
            Create with the AI provider you already pay for, keep every result
            organized, and{" "}
            {isHostedWebApp
              ? "leave publishing safely outside the web runtime"
              : "connect publishing channels only when you are ready"}
            .
          </CardDescription>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button variant="secondary" size="lg" asChild>
              <Link to="/create">
                <SparklesIcon data-icon="inline-start" />
                Create content
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link to="/library">Open library</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative flex flex-wrap items-center gap-3 border-t border-primary-foreground/10 pt-4 text-xs text-primary-foreground/70">
          <StatusBadge
            label={overview?.activeProvider?.kind ?? "provider loading"}
            state={overview?.activeProvider === null ? "warning" : "enabled"}
          />
          <span>
            {overview === null
              ? "Reading local state…"
              : `${overview.activeProvider?.model ?? "No active model"} · Updated ${formatDateTime(overview.generatedAt)}`}
          </span>
        </CardContent>
      </Card>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => {
            const Icon = metricIcons[index] ?? ActivityIcon;
            return (
              <Card key={metric.label}>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    {metric.label}
                  </CardTitle>
                  <CardAction className="text-muted-foreground">
                    <Icon className="size-4" />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-3xl font-semibold tracking-tight">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {metric.detail}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              {isHostedWebApp ? "Private by design" : "Recent activity"}
            </CardTitle>
            <CardDescription>
              {isHostedWebApp
                ? "The hosted app keeps durable data on your device."
                : "The latest durable jobs handled by the local worker."}
            </CardDescription>
            {!isHostedWebApp && (
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/activity">
                    View all
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="space-y-1">
            {isHostedWebApp ? (
              <div className="space-y-4 py-1 text-sm text-muted-foreground">
                <p>
                  API keys and generated drafts are saved only in this browser,
                  under this site&apos;s local storage.
                </p>
                <Separator />
                <p>
                  Keys are sent over HTTPS only when verifying a provider or
                  generating content, then discarded by the function.
                </p>
                <Separator />
                <p>
                  Clearing site data removes the browser workspace, so copy out
                  any drafts you want to keep permanently.
                </p>
              </div>
            ) : (
              overview?.jobs.slice(0, 5).map((job, index) => (
                <div key={job.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center gap-3 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ActivityIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {formatLabel(job.type)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Attempt {job.attemptCount} of {job.maximumAttempts}
                      </p>
                    </div>
                    <StatusBadge label={job.state} />
                  </div>
                </div>
              ))
            )}
            {!isHostedWebApp &&
              overview !== null &&
              overview.jobs.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No job activity yet.
                </p>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety gates</CardTitle>
            <CardDescription>
              External actions remain explicit and guarded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SafetyRow
              label="Live publishing"
              enabled={overview?.safety.livePublishing ?? false}
            />
            <Separator />
            <SafetyRow
              label="Outreach sending"
              enabled={overview?.safety.outreachSending ?? false}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SafetyRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {enabled ? "External actions allowed" : "External actions blocked"}
        </p>
      </div>
      <StatusBadge
        label={enabled ? "enabled" : "guarded"}
        state={enabled ? "enabled" : "warning"}
      />
    </div>
  );
}
