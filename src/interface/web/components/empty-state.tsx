import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-60 flex-col items-center justify-center text-center">
        <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
        <h2 className="font-medium">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
        {action !== undefined && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}
