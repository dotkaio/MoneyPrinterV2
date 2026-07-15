import {
  ActivityIcon,
  CalendarClockIcon,
  FolderOpenIcon,
  GaugeIcon,
  KeyRoundIcon,
  ServerCogIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { useProviders } from "@/hooks/use-providers";
import { isHostedWebApp } from "@/lib/runtime";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const allNavigationItems = [
  { label: "Create", path: "/create", icon: SparklesIcon },
  { label: "Library", path: "/library", icon: FolderOpenIcon },
  { label: "Overview", path: "/", icon: GaugeIcon },
  { label: "Accounts", path: "/accounts", icon: UsersRoundIcon },
  { label: "Activity", path: "/activity", icon: ActivityIcon },
  { label: "Schedules", path: "/schedules", icon: CalendarClockIcon },
  { label: "AI providers", path: "/providers", icon: KeyRoundIcon },
  { label: "System", path: "/system", icon: ServerCogIcon },
] as const;

export const navigationItems = isHostedWebApp
  ? allNavigationItems.filter((item) =>
      ["/create", "/library", "/", "/providers", "/system"].includes(item.path),
    )
  : allNavigationItems;

export function AppSidebar() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const { activeProvider } = useProviders();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="MoneyPrinter">
              <Link to="/" onClick={() => setOpenMobile(false)}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  MP
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">MoneyPrinter</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Content studio
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const active =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link to={item.path} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div>
                <span className="relative flex size-8 items-center justify-center">
                  <span className="size-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/10" />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {activeProvider?.name ?? "Provider needed"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {activeProvider?.model ?? "Connect an API key"}
                  </span>
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {isHostedWebApp ? "Browser" : "Local"}
                </Badge>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
