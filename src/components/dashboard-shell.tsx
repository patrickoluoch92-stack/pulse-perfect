import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BedDouble, Bot, Brain, Bug, Calendar, CalendarSync, ChartBar, ChevronDown, Compass, Coins, CreditCard, FileText, Gauge, Home, Landmark, Lock, LogOut, MapPin, Menu, Plug, Rocket, Route as RouteIcon, Settings, ShieldAlert, Smartphone, Sparkles, Sprout, Store, Ticket, TrendingUp, Users, Wallet, Wrench, X,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { planAllows, type Plan } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { usePermissions, type Permission } from "@/hooks/use-permissions";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  feature?: "analytics.basic";
  permission?: Permission;
};

type NavGroup = {
  id: string;
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
};



const groups: NavGroup[] = [
  {
    id: "operate",
    label: "Operate",
    items: [
      { to: "/dashboard", label: "Overview", icon: Home },
      { to: "/properties", label: "Properties", icon: BedDouble },
      { to: "/reservations", label: "Reservations", icon: Calendar, permission: "bookings.read" },
      { to: "/housekeeping", label: "Housekeeping", icon: Sprout },
      { to: "/maintenance", label: "Maintenance", icon: Wrench },
      { to: "/tours", label: "Tours", icon: MapPin },
      { to: "/sync", label: "Calendar Sync", icon: CalendarSync, permission: "availability.write" },
      { to: "/incidents", label: "Incidents", icon: ShieldAlert },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    items: [
      { to: "/listings", label: "Listings", icon: Store },
      { to: "/onboarding", label: "List a property", icon: Rocket },
      { to: "/listings/partners", label: "Partner Sync", icon: Plug },
      { to: "/bookings", label: "My Bookings", icon: Ticket },
      { to: "/wishlist", label: "Wishlist", icon: Sparkles },
    ],
  },
  {
    id: "ai",
    label: "AI Studio",
    items: [
      { to: "/ai-command", label: "AI Command", icon: Brain },
      { to: "/planner", label: "Planner AI", icon: RouteIcon },
      { to: "/concierge", label: "Concierge", icon: Bot },
      { to: "/revenue", label: "Revenue AI", icon: TrendingUp, permission: "pricing.write" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/invoices", label: "Invoices", icon: FileText, permission: "finance.read" },
      { to: "/wallet", label: "Wallet & Payouts", icon: Wallet, permission: "finance.read" },
      { to: "/mpesa", label: "M-PESA", icon: Smartphone, permission: "finance.read" },
      { to: "/analytics", label: "Analytics", icon: ChartBar, feature: "analytics.basic", permission: "reports.read" },
      { to: "/subscription", label: "Subscription", icon: CreditCard },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { to: "/team", label: "Members", icon: Users, permission: "team.invite" },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "admin",
    label: "Platform Admin",
    adminOnly: true,
    items: [
      { to: "/admin/executive", label: "Executive HQ", icon: Gauge },
      { to: "/admin/finance", label: "Finance Admin", icon: Landmark },
      { to: "/admin/commissions", label: "Commissions", icon: Coins },
      { to: "/admin/plans", label: "Plan Admin", icon: Lock },
      { to: "/admin/fraud", label: "Fraud & Compliance", icon: ShieldAlert },
      { to: "/admin/cms", label: "CMS", icon: FileText },
      { to: "/admin/devops", label: "DevOps", icon: Bug },
      { to: "/listings/admin/discovery", label: "Discovery AI", icon: Compass },
      { to: "/listings/admin/coupons", label: "Coupons", icon: Ticket },
    ],
  },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchCtx = useServerFn(getWorkspaceContext);
  const { data } = useQuery({
    queryKey: ["workspace-context"],
    queryFn: () => fetchCtx(),
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, true])),
  );

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isAdmin = data?.isPlatformAdmin ?? false;
  const plan = (data?.currentOrg?.plan ?? null) as Plan | null;
  const { can, isLoading: permsLoading } = usePermissions();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  function toggleGroup(id: string) {
    setOpenGroups((s) => ({ ...s, [id]: !s[id] }));
  }

  const visibleGroups = groups
    .filter((g) => !g.adminOnly || isAdmin)
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => !it.permission || permsLoading || can(it.permission)),
    }))
    .filter((g) => g.items.length > 0);

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-5">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">HostPulse</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="shrink-0 border-b border-sidebar-border px-5 py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p>
        <p className="mt-1 truncate font-medium">{data?.currentOrg?.name ?? "Loading…"}</p>
        <p className="text-xs capitalize text-muted-foreground">
          {data?.currentOrg?.plan ?? "starter"} plan · {data?.currentOrg?.role}
          {isAdmin && <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">admin</span>}
        </p>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-4 overflow-y-auto p-3">
        {visibleGroups.map((group) => {
          const open = openGroups[group.id] ?? true;
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground"
                aria-expanded={open}
                aria-controls={`nav-group-${group.id}`}
              >
                <span>{group.label}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", open ? "rotate-0" : "-rotate-90")} aria-hidden />
              </button>
              {open && (
                <ul id={`nav-group-${group.id}`} className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const active = pathname === item.to || pathname.startsWith(item.to + "/");
                    const Icon = item.icon;
                    const locked = "feature" in item && item.feature && !planAllows(plan, item.feature);
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="h-4 w-4" aria-hidden />
                            {item.label}
                          </span>
                          {locked && <Lock className="h-3 w-3 opacity-60" aria-label="Upgrade required" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
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
  );

  return (
    <div className="flex min-h-dvh bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">HostPulse</span>
        </Link>
        <div className="w-9" />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:h-dvh lg:sticky lg:top-0">{sidebar}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-x-hidden pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
