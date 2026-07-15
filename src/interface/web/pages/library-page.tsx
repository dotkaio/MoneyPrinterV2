import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  FolderOpenIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
import { useCreations } from "@/hooks/use-creations";
import { formatDateTime, formatLabel } from "@/lib/format";
import { isHostedWebApp } from "@/lib/runtime";
import { cn } from "@/lib/utils";

export function LibraryPage() {
  const { creations, loading } = useCreations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const selected =
    creations.find((creation) => creation.id === selectedId) ??
    creations[0] ??
    null;

  const copyDraft = async (): Promise<void> => {
    if (selected === null) {
      return;
    }
    await navigator.clipboard.writeText(selected.script);
    setCopied(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Local workspace"
        title="Library"
        description={`Every generated draft stays ${isHostedWebApp ? "in this browser" : "on this Mac"} with its creative brief, provider, and model metadata.`}
        actions={
          <Button asChild>
            <Link to="/create">
              <SparklesIcon data-icon="inline-start" />
              New content
            </Link>
          </Button>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : creations.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="Your library is empty"
          description="Generate your first piece of content and it will be saved here automatically."
          action={
            <Button asChild>
              <Link to="/create">
                Create content
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <Card>
            <CardHeader>
              <CardTitle>Saved drafts</CardTitle>
              <CardDescription>{creations.length} local items</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {creations.map((creation) => (
                <button
                  key={creation.id}
                  type="button"
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected?.id === creation.id &&
                      "border-foreground bg-muted/60",
                  )}
                  onClick={() => {
                    setSelectedId(creation.id);
                    setCopied(false);
                  }}
                >
                  <span className="flex items-center justify-between gap-3">
                    <Badge variant="secondary">
                      {formatLabel(creation.format)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(creation.createdAt)}
                    </span>
                  </span>
                  <span className="mt-2 block truncate text-sm font-medium">
                    {creation.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {creation.topic}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          {selected !== null && (
            <Card>
              <CardHeader className="border-b pb-4">
                <Badge variant="secondary" className="mb-2">
                  {formatLabel(selected.format)}
                </Badge>
                <CardTitle className="text-xl">{selected.title}</CardTitle>
                <CardDescription>{selected.hook}</CardDescription>
                <CardAction>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyDraft()}
                  >
                    {copied ? (
                      <CheckIcon data-icon="inline-start" />
                    ) : (
                      <CopyIcon data-icon="inline-start" />
                    )}
                    {copied ? "Copied" : "Copy draft"}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl bg-muted/50 p-4 text-sm leading-7 whitespace-pre-wrap">
                  {selected.script}
                </div>
                <Separator />
                <div>
                  <h3 className="mb-2 text-sm font-medium">Caption</h3>
                  <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                    {selected.caption}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.hashtags.map((hashtag) => (
                    <Badge key={hashtag} variant="outline">
                      #{hashtag}
                    </Badge>
                  ))}
                </div>
                <Separator />
                <dl className="grid gap-4 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Provider</dt>
                    <dd className="mt-1 font-medium">
                      {formatLabel(selected.providerKind)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Model</dt>
                    <dd className="mt-1 truncate font-mono">
                      {selected.model}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Generated</dt>
                    <dd className="mt-1">
                      {Math.round(selected.durationMs)}ms
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
