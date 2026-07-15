import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockKeyholeIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProviders } from "@/hooks/use-providers";
import { isHostedWebApp } from "@/lib/runtime";
import type { AiProviderConnectionDto } from "../../dashboard-contract";

interface ProviderSetupFormProps {
  submitLabel?: string;
  onConnected?: (provider: AiProviderConnectionDto) => void;
}

export function ProviderSetupForm({
  submitLabel = "Connect and continue",
  onConnected,
}: ProviderSetupFormProps) {
  const {
    providers,
    activeProvider,
    error: providerError,
    connect,
  } = useProviders();
  const initialProvider = activeProvider ?? providers[0] ?? null;
  const [selectedKind, setSelectedKind] = useState<
    AiProviderConnectionDto["kind"]
  >(initialProvider?.kind ?? "openai");
  const initialized = useRef(initialProvider !== null);
  const selectedProvider =
    providers.find((provider) => provider.kind === selectedKind) ??
    initialProvider;
  const [model, setModel] = useState(
    initialProvider?.model ?? initialProvider?.defaultModel ?? "",
  );
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const freeProviders = providers.filter(
    (provider) => provider.access === "free-tier",
  );
  const paidProviders = providers.filter(
    (provider) => provider.access === "paid",
  );

  useEffect(() => {
    if (initialized.current || providers.length === 0) {
      return;
    }
    const provider = activeProvider ?? providers[0];
    if (provider !== undefined) {
      setSelectedKind(provider.kind);
      setModel(provider.model || provider.defaultModel);
      initialized.current = true;
    }
  }, [activeProvider, providers]);

  const selectProvider = (provider: AiProviderConnectionDto): void => {
    setSelectedKind(provider.kind);
    setModel(provider.model || provider.defaultModel);
    setApiKey("");
    setSubmitError(null);
  };

  const submit = async (): Promise<void> => {
    if (selectedProvider === null) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const connected = await connect({
        kind: selectedProvider.kind,
        model,
        ...(apiKey.trim().length === 0 ? {} : { apiKey: apiKey.trim() }),
      });
      setApiKey("");
      onConnected?.(connected);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Choose your provider</legend>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <label className="space-y-2 text-sm font-medium">
            <span>Provider</span>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={selectedProvider?.kind ?? ""}
              disabled={providers.length === 0}
              onChange={(event) => {
                const provider = providers.find(
                  (candidate) => candidate.kind === event.target.value,
                );
                if (provider !== undefined) {
                  selectProvider(provider);
                }
              }}
            >
              {providers.length === 0 && (
                <option value="">Loading providers…</option>
              )}
              {freeProviders.length > 0 && (
                <optgroup label="Free tier available">
                  {freeProviders.map((provider) => (
                    <option key={provider.kind} value={provider.kind}>
                      {provider.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {paidProviders.length > 0 && (
                <optgroup label="Usage-based providers">
                  {paidProviders.map((provider) => (
                    <option key={provider.kind} value={provider.kind}>
                      {provider.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          {selectedProvider !== null && (
            <div className="flex items-start gap-3 rounded-xl border bg-muted/35 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
                {selectedProvider.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {selectedProvider.name}
                  </span>
                  <Badge variant="outline">
                    {selectedProvider.access === "free-tier"
                      ? "Free tier"
                      : "Usage-based"}
                  </Badge>
                  {selectedProvider.connected && (
                    <Badge variant="outline">
                      <CheckCircle2Icon data-icon="inline-start" />
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {selectedProvider.description} {selectedProvider.accessNote}
                </p>
              </div>
            </div>
          )}
        </div>
      </fieldset>

      {selectedProvider !== null && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            <span>Model</span>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {selectedProvider.models.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span className="flex items-center justify-between gap-3">
              API key
              <a
                className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
                href={selectedProvider.keyUrl}
                target="_blank"
                rel="noreferrer"
              >
                Get a key
                <ArrowUpRightIcon className="size-3" />
              </a>
            </span>
            <span className="relative block">
              <Input
                className="h-9 pr-10 font-mono"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                placeholder={
                  selectedProvider.connected
                    ? "Leave blank to keep the saved key"
                    : selectedProvider.keyPlaceholder
                }
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                required={!selectedProvider.connected}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Hide API key" : "Show API key"}
                onClick={() => setShowKey((visible) => !visible)}
              >
                {showKey ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </span>
          </label>
        </div>
      )}

      {(submitError ?? providerError) !== null && (
        <Alert variant="destructive">
          <KeyRoundIcon />
          <AlertTitle>Provider connection failed</AlertTitle>
          <AlertDescription>{submitError ?? providerError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LockKeyholeIcon className="size-4" />
          {isHostedWebApp
            ? "The key is verified securely and saved only in this browser."
            : "The key is verified server-side and stored in macOS Keychain."}
        </div>
        <Button
          type="submit"
          className="sm:ml-auto"
          disabled={submitting || selectedProvider === null}
        >
          {submitting ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <KeyRoundIcon data-icon="inline-start" />
          )}
          {submitting
            ? "Verifying…"
            : selectedProvider?.connected && apiKey.length === 0
              ? "Use this provider"
              : submitLabel}
        </Button>
      </div>
    </form>
  );
}
