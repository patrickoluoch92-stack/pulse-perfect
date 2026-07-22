import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import {
  listMyNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export function NotificationBell({ className }: { className?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const countFn = useServerFn(getUnreadNotificationCount);
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const countQ = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => countFn(),
    refetchInterval: 60_000,
  });
  const listQ = useQuery({
    queryKey: ["notif-list"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });
  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });

  const unread = countQ.data?.count ?? 0;
  const items = (listQ.data ?? []) as any[];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className={cn("relative", className)}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAll.mutate()}
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {listQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const unreadItem = !n.read_at;
                const content = (
                  <div className={cn("space-y-1 p-3 text-sm", unreadItem && "bg-accent/30")}>
                    <p className="font-medium leading-tight">{n.title}</p>
                    {n.body && (
                      <p className="whitespace-pre-wrap text-muted-foreground">{n.body}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link_url ? (
                      <Link
                        to={n.link_url}
                        onClick={() => {
                          if (unreadItem) markOne.mutate(n.id);
                          setOpen(false);
                        }}
                        className="block hover:bg-muted/60"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => unreadItem && markOne.mutate(n.id)}
                        className="block w-full text-left hover:bg-muted/60"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
