import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProviders } from "@/hooks/use-providers";
import { OnboardingPage } from "@/pages/onboarding-page";

const CreatePage = lazy(() =>
  import("@/pages/create-page").then((module) => ({
    default: module.CreatePage,
  })),
);
const LibraryPage = lazy(() =>
  import("@/pages/library-page").then((module) => ({
    default: module.LibraryPage,
  })),
);
const ProvidersPage = lazy(() =>
  import("@/pages/providers-page").then((module) => ({
    default: module.ProvidersPage,
  })),
);

const OverviewPage = lazy(() =>
  import("@/pages/overview-page").then((module) => ({
    default: module.OverviewPage,
  })),
);
const AccountsPage = lazy(() =>
  import("@/pages/accounts-page").then((module) => ({
    default: module.AccountsPage,
  })),
);
const ActivityPage = lazy(() =>
  import("@/pages/activity-page").then((module) => ({
    default: module.ActivityPage,
  })),
);
const SchedulesPage = lazy(() =>
  import("@/pages/schedules-page").then((module) => ({
    default: module.SchedulesPage,
  })),
);
const SystemPage = lazy(() =>
  import("@/pages/system-page").then((module) => ({
    default: module.SystemPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found-page").then((module) => ({
    default: module.NotFoundPage,
  })),
);

export function App() {
  const { activeProvider, loading } = useProviders();

  return (
    <BrowserRouter>
      <TooltipProvider>
        {loading ? (
          <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-5xl">
              <DashboardSkeleton />
            </div>
          </div>
        ) : activeProvider === null ? (
          <OnboardingPage />
        ) : (
          <AppShell>
            <Suspense fallback={<DashboardSkeleton />}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/create" element={<CreatePage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/schedules" element={<SchedulesPage />} />
                <Route path="/providers" element={<ProvidersPage />} />
                <Route path="/system" element={<SystemPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </AppShell>
        )}
      </TooltipProvider>
    </BrowserRouter>
  );
}
