import { KeyRoundIcon, ShieldCheckIcon, UsersRoundIcon } from "lucide-react";

import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/hooks/use-dashboard";
import { formatDateTime, formatLabel, truncateIdentifier } from "@/lib/format";

export function AccountsPage() {
  const { overview, loading } = useDashboard();

  return (
    <>
      <PageHeader
        eyebrow="Identities"
        title="Accounts"
        description="Publishing identities and reusable authentication state, without exposing any stored credential values."
        actions={
          overview === null ? undefined : (
            <Badge variant="outline" className="h-7 px-3">
              <ShieldCheckIcon data-icon="inline-start" />
              {overview.counts.connectedAccounts} of {overview.counts.accounts}{" "}
              connected
            </Badge>
          )
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : overview !== null && overview.accounts.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {overview.accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted font-heading text-sm font-semibold uppercase text-muted-foreground">
                  {account.platform.slice(0, 2)}
                </span>
                <CardTitle>{account.displayName ?? account.nickname}</CardTitle>
                <CardDescription>
                  {formatLabel(account.platform)}
                </CardDescription>
                <CardAction>
                  <StatusBadge
                    label={account.connectionState}
                    state={account.connectionState}
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <Metadata label="Niche" value={account.niche} />
                  <Metadata label="Language" value={account.language} />
                  <Metadata
                    label="Expires"
                    value={formatDateTime(account.expiresAt)}
                  />
                  <Metadata
                    label="Account ID"
                    value={truncateIdentifier(account.id)}
                  />
                </dl>
              </CardContent>
              <CardFooter className="gap-2 text-xs text-muted-foreground">
                <KeyRoundIcon className="size-3.5" />
                Credentials remain in the macOS Keychain
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UsersRoundIcon}
          title="No publishing channels yet"
          description="Channels are optional. Your AI provider is enough to create and save content; connect publishing identities only when you are ready to automate delivery."
        />
      )}
    </>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-mono text-xs text-foreground">
        {value}
      </dd>
    </div>
  );
}
