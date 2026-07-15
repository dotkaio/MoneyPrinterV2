import { CircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const successfulStates = new Set(["connected", "enabled", "ok", "succeeded"]);
const dangerousStates = new Set(["error", "expired", "failed", "failure"]);
const pendingStates = new Set(["queued", "retrying", "running", "warning"]);

export function StatusBadge({
  label,
  state = label,
}: {
  label: string;
  state?: string;
}) {
  const normalized = state.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 capitalize",
        successfulStates.has(normalized) &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        dangerousStates.has(normalized) &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        pendingStates.has(normalized) &&
          "border-amber-500/20 bg-amber-500/10 text-amber-300",
      )}
    >
      <CircleIcon className="size-1.5 fill-current" />
      {label.replaceAll("-", " ")}
    </Badge>
  );
}
