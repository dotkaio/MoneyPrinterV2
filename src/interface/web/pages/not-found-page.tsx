import { CompassIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function NotFoundPage() {
  return (
    <>
      <PageHeader
        eyebrow="404"
        title="Page not found"
        description="This local interface route does not exist."
      />
      <Card>
        <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
          <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CompassIcon className="size-5" />
          </span>
          <p className="font-medium">Return to the control center</p>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Use the sidebar or jump back to the overview.
          </p>
          <Button asChild>
            <Link to="/">Go to overview</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
