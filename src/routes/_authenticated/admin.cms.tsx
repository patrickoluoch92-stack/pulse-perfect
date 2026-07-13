import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, MapPin, Compass, Star } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import { adminCmsOverview } from "@/lib/admin-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/admin/cms")({
  head: () => ({ meta: authPageMeta({
    title: "Content management",
    description: "Counties, discovery sources, reviews, and promo content.",
  }) }),
  component: CmsPage,
});

function CmsPage() {
  const fetchFn = useServerFn(adminCmsOverview);
  const { data, isLoading } = useQuery({ queryKey: ["admin-cms"], queryFn: () => fetchFn() });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><FileText className="h-6 w-6" /> Content management</h1>
        <p className="text-sm text-muted-foreground">Counties, discovery sources, reviews, and promo content.</p>
      </header>

      {isLoading && <LoadingState />}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Counties</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data?.counties.length ?? 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Discovery sources</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data?.sources.length ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">{(data?.sources ?? []).filter((x: any) => x.active).length} active</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Discovered pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-amber-500">{data?.discovery.pending ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data?.discovery.published ?? 0} published</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active coupons</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{(data?.coupons ?? []).filter((c: any) => c.active).length}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Compass className="h-4 w-4" /> Discovery sources</CardTitle>
            <Button asChild size="sm" variant="outline"><Link to="/listings/admin/discovery">Manage</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y max-h-96 overflow-auto">
              {(data?.sources ?? []).map((src: any) => (
                <li key={src.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="font-medium">{src.name}</span>
                    <Badge variant="outline" className="ml-2 text-xs">{src.kind}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {src.active ? "active" : "paused"} · {src.last_run_at ? new Date(src.last_run_at).toLocaleDateString() : "never"}
                  </span>
                </li>
              ))}
              {(data?.sources ?? []).length === 0 && !isLoading && <li className="p-4"><EmptyState title="No sources configured" description="Add a discovery source to start crawling listings." /></li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Counties</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y max-h-96 overflow-auto">
              {(data?.counties ?? []).map((c: any) => (
                <li key={c.id} className="flex items-center justify-between p-3 text-sm">
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.slug}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-4 w-4" /> Recent reviews</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {(data?.recentReviews ?? []).slice(0, 10).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between p-3 text-sm">
                <span>★ {Number(r.rating).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </li>
            ))}
            {(data?.recentReviews ?? []).length === 0 && <li className="p-4 text-sm text-muted-foreground">No reviews.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
