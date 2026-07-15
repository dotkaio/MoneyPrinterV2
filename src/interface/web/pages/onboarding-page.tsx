import {
  CheckIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";

import { ProviderSetupForm } from "@/components/provider-setup-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isHostedWebApp } from "@/lib/runtime";

export function OnboardingPage() {
  const benefits = isHostedWebApp
    ? [
        "Generate polished content without installing anything",
        "Keep keys, settings, and drafts in this browser",
        "Use your own provider account with no MoneyPrinter subscription",
      ]
    : [
        "Generate polished content without a CLI setup",
        "Keep drafts, provider settings, and activity on this Mac",
        "Add publishing accounts only when you are ready",
      ];

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_35%),radial-gradient(circle_at_82%_70%,color-mix(in_oklab,var(--muted-foreground)_8%,transparent),transparent_34%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              MP
            </span>
            <div>
              <p className="font-semibold">MoneyPrinter</p>
              <p className="text-xs text-muted-foreground">
                {isHostedWebApp ? "Web studio" : "Desktop studio"}
              </p>
            </div>
          </div>
          <Badge variant="outline">
            <LockKeyholeIcon data-icon="inline-start" />
            {isHostedWebApp ? "Browser-local" : "Local-first"}
          </Badge>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <section className="max-w-xl">
            <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <WandSparklesIcon className="size-5" />
            </span>
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Your content engine starts here
            </p>
            <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Connect one key. Start creating.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
              Choose the AI provider you already use. MoneyPrinter verifies the
              key, stores it{" "}
              {isHostedWebApp ? "only in this browser" : "securely"}, and opens
              a complete local content workspace—no environment files or
              terminal setup.
            </p>
            <ul className="mt-8 space-y-3">
              {benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <CheckIcon className="size-3" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </section>

          <Card className="border-foreground/10 bg-card/95 shadow-2xl shadow-foreground/5 backdrop-blur">
            <CardHeader className="border-b pb-5">
              <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <KeyRoundIcon className="size-4" />
              </span>
              <CardTitle className="text-xl">Connect an AI provider</CardTitle>
              <CardDescription>
                Pick a provider, select a model, and paste your API key.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ProviderSetupForm />
            </CardContent>
          </Card>
        </div>

        <footer className="flex items-center gap-2 border-t py-4 text-xs text-muted-foreground">
          <SparklesIcon className="size-3.5" />
          {isHostedWebApp
            ? "Generation uses your provider account. The key is never stored by Vercel; publishing remains disabled in the web app."
            : "Generation uses your provider account. Publishing remains off until you explicitly enable it."}
        </footer>
      </div>
    </main>
  );
}
