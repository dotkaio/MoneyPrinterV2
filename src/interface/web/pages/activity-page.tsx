import {
  ActivityIcon,
  CircleCheckIcon,
  Clock3Icon,
  LoaderIcon,
} from "lucide-react";

import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboard } from "@/hooks/use-dashboard";
import { formatDateTime, formatLabel, truncateIdentifier } from "@/lib/format";

export function ActivityPage() {
  const { overview, loading } = useDashboard();
  const jobs = overview?.jobs ?? [];
  const queued = jobs.filter((job) => job.state === "queued").length;
  const running = jobs.filter((job) => job.state === "running").length;
  const succeeded = jobs.filter((job) => job.state === "succeeded").length;

  return (
    <>
      <PageHeader
        eyebrow="Durable work"
        title="Activity"
        description="Inspect recent queued, running, retried, and completed jobs handled by the local worker."
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Queued"
            value={queued}
            detail="Waiting for a worker"
            icon={Clock3Icon}
          />
          <SummaryCard
            label="Running"
            value={running}
            detail="Executing now"
            icon={LoaderIcon}
          />
          <SummaryCard
            label="Succeeded"
            value={succeeded}
            detail="Within this recent window"
            icon={CircleCheckIcon}
          />
        </div>
      )}

      {jobs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
            <CardDescription>
              The latest {jobs.length} durable operations, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Run at</TableHead>
                  <TableHead className="pr-4 text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="pl-4">
                      <div className="max-w-64">
                        <p className="truncate font-medium">
                          {formatLabel(job.type)}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {truncateIdentifier(job.id)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={job.state} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {job.attemptCount} / {job.maximumAttempts}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(job.runAt)}
                    </TableCell>
                    <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                      {formatDateTime(job.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        !loading && (
          <EmptyState
            icon={ActivityIcon}
            title="No job activity"
            description="Queued and completed worker jobs will appear here as workflows begin running."
          />
        )
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof ActivityIcon;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <CardAction className="text-muted-foreground">
          <Icon className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
