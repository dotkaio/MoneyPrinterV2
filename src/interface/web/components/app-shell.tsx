import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { AppSidebar, navigationItems } from "@/components/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useDashboard } from "@/hooks/use-dashboard";
import { useCreations } from "@/hooks/use-creations";
import { useProviders } from "@/hooks/use-providers";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const dashboard = useDashboard();
  const providers = useProviders();
  const creations = useCreations();
  const error = dashboard.error ?? providers.error ?? creations.error;
  const refreshing =
    dashboard.refreshing || providers.refreshing || creations.refreshing;
  const refresh = async (): Promise<void> => {
    await Promise.all([
      dashboard.refresh(),
      providers.refresh(),
      creations.refresh(),
    ]);
  };
  const currentPage =
    navigationItems.find((item) =>
      item.path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.path),
    )?.label ?? "Not found";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{currentPage}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={refreshing ? "animate-spin" : undefined}
            />
            <span className="hidden sm:inline">Refresh data</span>
          </Button>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
          {error !== null && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Unable to load workspace data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
