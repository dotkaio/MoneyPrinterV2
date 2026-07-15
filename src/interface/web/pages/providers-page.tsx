import {
  KeyRoundIcon,
  Loader2Icon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ProviderSetupForm } from "@/components/provider-setup-form";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProviders } from "@/hooks/use-providers";
import { isHostedWebApp } from "@/lib/runtime";

export function ProvidersPage() {
  const { activeProvider, disconnect } = useProviders();
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const removeProvider = async (): Promise<void> => {
    if (activeProvider === null) {
      return;
    }
    setRemoving(true);
    setRemoveError(null);
    try {
      await disconnect(activeProvider.kind);
    } catch (cause) {
      setRemoveError(cause instanceof Error ? cause.message : String(cause));
      setRemoving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="AI runtime"
        title="Providers"
        description={
          isHostedWebApp
            ? "Connect or switch the model provider used for new content. Keys stay in this browser and are never persisted by Vercel."
            : "Connect or switch the model provider used for new content. Keys never enter the browser bundle or local database."
        }
        actions={
          activeProvider === null ? undefined : (
            <Badge variant="outline" className="h-7 px-3">
              <ShieldCheckIcon data-icon="inline-start" />
              {isHostedWebApp ? "Browser-local" : "Keychain protected"}
            </Badge>
          )
        }
      />

      {activeProvider !== null && (
        <Card size="sm">
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <KeyRoundIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{activeProvider.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {activeProvider.model}
              </p>
            </div>
            <StatusBadge label="active" state="enabled" />
          </CardContent>
          {confirmingRemoval && (
            <CardFooter className="flex flex-wrap items-center gap-2 border-t">
              <p className="mr-auto text-xs text-muted-foreground">
                This removes the saved key from{" "}
                {isHostedWebApp ? "this browser" : "Keychain"}. Your library
                stays intact.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removing}
                onClick={() => setConfirmingRemoval(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={removing}
                onClick={() => void removeProvider()}
              >
                {removing ? (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <Trash2Icon data-icon="inline-start" />
                )}
                {removing ? "Removing…" : "Remove provider"}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {removeError !== null && (
        <Alert variant="destructive">
          <KeyRoundIcon />
          <AlertTitle>Could not remove provider</AlertTitle>
          <AlertDescription>{removeError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Provider connection</CardTitle>
          <CardDescription>
            Reconnect with a new key, change models, or activate a previously
            connected provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProviderSetupForm submitLabel="Save provider" />
        </CardContent>
        {activeProvider !== null && !confirmingRemoval && (
          <CardFooter className="justify-end border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setConfirmingRemoval(true)}
            >
              <Trash2Icon data-icon="inline-start" />
              Remove active provider
            </Button>
          </CardFooter>
        )}
      </Card>
    </>
  );
}
