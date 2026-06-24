import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BedDouble, Calendar, CalendarSync, ChartBar, FileText, Home, Lock, LogOut, MapPin, Settings, ShieldAlert, Smartphone, Sparkles, Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { planAllows, type Plan } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Overview", icon: Home },
  { to: "/properties", label: "Properties", icon: BedDouble },
  { to: "/reservations", label: "Reservations", icon: Calendar },
  { to: "/tours", label: "Tours", icon: MapPin },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/team", label: "Team", icon: Users },
  { to: "/analytics", label: "Analytics", icon: ChartBar, feature: "analytics.basic" as const },
  { to: "/sync", label: "Calendar Sync", icon: CalendarSync },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert },
  { to: "/mpesa", label: "M-PESA", icon: Smartphone },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;


export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchCtx = useServerFn(getWorkspaceContext);
  const { data } = useQuery({
    queryKey: ["workspace-context"],
    queryFn: () => fetchCtx(),
  });

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid min-h-screen grid-cols-[16rem_1fr] bg-background">
      <aside className="flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">HostPulse</span>
        </div>

        <div className="border-b border-sidebar-border px-5 py-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p>
          <p className="mt-1 truncate font-medium">{data?.currentOrg?.name ?? "Loading…"}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {data?.currentOrg?.plan ?? "starter"} plan · {data?.currentOrg?.role}
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            const plan = (data?.currentOrg?.plan ?? null) as Plan | null;
            const locked = "feature" in item && !planAllows(plan, item.feature);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {locked && <Lock className="h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/20 text-sm font-semibold text-accent-foreground">
              {(data?.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{data?.profile?.full_name ?? "—"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="overflow-auto">{children}</main>
    </div>
  );
}
