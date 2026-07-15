import { CalendarClockIcon, ClockIcon } from "lucide-react";

import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
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
import { formatDateTime, formatLabel } from "@/lib/format";

export function SchedulesPage() {
  const { overview, loading } = useDashboard();
  const schedules = overview?.schedules ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title="Schedules"
        description="Recurring workflows managed by the durable local scheduler and worker."
      />

      {loading ? (
        <DashboardSkeleton />
      ) : schedules.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recurring workflows</CardTitle>
            <CardDescription>
              {overview?.counts.schedules ?? 0} enabled of {schedules.length}{" "}
              configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expression</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead className="pr-4 text-right">Next run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="pl-4">
                      <p className="font-medium">{schedule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatLabel(schedule.jobType)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={schedule.enabled ? "enabled" : "disabled"}
                        state={schedule.enabled ? "enabled" : "disabled"}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {schedule.cronExpression}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {schedule.timezone}
                    </TableCell>
                    <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                      {formatDateTime(schedule.nextRunAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={CalendarClockIcon}
          title="No schedules"
          description="Recurring workflows will appear here with their expression, status, and next run time."
        />
      )}

      {!loading && schedules.length > 0 && (
        <Card size="sm">
          <CardContent className="flex items-center gap-3 text-xs text-muted-foreground">
            <ClockIcon className="size-4" />
            Times are shown in your browser locale; each schedule still executes
            in its configured timezone.
          </CardContent>
        </Card>
      )}
    </>
  );
}
