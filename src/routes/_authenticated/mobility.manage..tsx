
// ---------------------------------------------------------------------------
// REVIEWS (provider moderation)
// ---------------------------------------------------------------------------
function ReviewsTab({ providerId, vehicleId }: { providerId: string; vehicleId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listMobilityProviderReviews);
  const moderate = useServerFn(moderateMobilityReview);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const q = useQuery({
    queryKey: ["mobility-reviews-mod", providerId, vehicleId, status],
    queryFn: () => list({ data: { providerId, vehicleId, status } as any }),
    enabled: !!providerId,
  });
  const [responses, setResponses] = useState<Record<string, string>>({});
  const invalidate = () => qc.invalidateQueries({ queryKey: ["mobility-reviews-mod"] });
  const rows: any[] = (q.data as any)?.reviews ?? (q.data as any) ?? [];

  const act = (id: string, action: "approve" | "reject", providerResponse?: string, reason?: string) =>
    moderate({ data: { id, action, providerResponse, reason } as any })
      .then(() => { toast.success(action === "approve" ? "Approved" : "Rejected"); invalidate(); })
      .catch((e: any) => toast.error(e?.message ?? "Failed"));

  return (
    <Card><CardHeader><CardTitle>Guest reviews</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)} className="capitalize">{s}</Button>
        ))}
      </div>
      {q.isLoading ? <LoadingState label="Loading reviews…" /> :
        rows.length === 0 ? <EmptyState title="No reviews" description="Guest reviews will appear here for moderation." /> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 font-medium">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i < Number(r.rating ?? 0) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                  ))}
                </div>
                <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.title && <div className="font-medium">{r.title}</div>}
              {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
              {r.provider_response && (
                <div className="rounded bg-muted p-2 text-xs"><span className="font-medium">Your reply:</span> {r.provider_response}</div>
              )}
              {r.status === "pending" && (
                <div className="space-y-2">
                  <Textarea rows={2} placeholder="Optional provider response…" value={responses[r.id] ?? ""} onChange={(e) => setResponses({ ...responses, [r.id]: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => act(r.id, "approve", responses[r.id])}><Check className="mr-1 h-4 w-4" /> Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const reason = prompt("Reason for rejection?") ?? undefined;
                      act(r.id, "reject", undefined, reason);
                    }}><X className="mr-1 h-4 w-4" /> Reject</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
}
