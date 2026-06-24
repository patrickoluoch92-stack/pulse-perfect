import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  listPropertyReviews,
  submitReview,
  deleteReview,
} from "@/lib/marketplace-extra.functions";

function StarBar({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            size={size}
            className={
              n <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            }
          />
        </button>
      ))}
    </div>
  );
}

export function PropertyReviews({
  propertyId,
  ratingAvg,
  ratingCount,
}: {
  propertyId: string;
  ratingAvg: number | null;
  ratingCount: number | null;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listPropertyReviews);
  const create = useServerFn(submitReview);
  const remove = useServerFn(deleteReview);

  const { data: reviews = [] } = useQuery({
    queryKey: ["mkt-reviews", propertyId],
    queryFn: () => list({ data: { propertyId } }),
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useState(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    return 0;
  });

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Please sign in to leave a review.");
      return create({
        data: {
          propertyId,
          reviewerName: name || user.user.email?.split("@")[0] || "Guest",
          rating,
          title: title || undefined,
          body,
        },
      });
    },
    onSuccess: () => {
      toast.success("Review posted");
      setShowForm(false);
      setBody("");
      setTitle("");
      qc.invalidateQueries({ queryKey: ["mkt-reviews", propertyId] });
      qc.invalidateQueries({ queryKey: ["mkt-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Review removed");
      qc.invalidateQueries({ queryKey: ["mkt-reviews", propertyId] });
      qc.invalidateQueries({ queryKey: ["mkt-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Guest reviews</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <StarBar value={Math.round(Number(ratingAvg) || 0)} size={14} />
            <span>
              {Number(ratingAvg ?? 0).toFixed(1)} · {ratingCount ?? 0} review{ratingCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Write a review"}
        </Button>
      </div>

      {showForm && (
        <Card className="mt-4 p-4 space-y-3">
          <div>
            <Label>Your rating</Label>
            <div className="mt-1">
              <StarBar value={rating} onChange={setRating} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rv-name">Display name</Label>
              <Input id="rv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane M." />
            </div>
            <div>
              <Label htmlFor="rv-title">Title (optional)</Label>
              <Input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lovely beachside getaway" />
            </div>
          </div>
          <div>
            <Label htmlFor="rv-body">Your review</Label>
            <Textarea
              id="rv-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you enjoy? Any tips for future guests?"
              rows={4}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => submit.mutate()}
              disabled={submit.isPending || body.length < 10}
            >
              {submit.isPending ? "Posting…" : "Post review"}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-6 space-y-4">
        {reviews.length === 0 && (
          <p className="text-sm text-muted-foreground">No reviews yet. Be the first.</p>
        )}
        {reviews.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <StarBar value={r.rating} size={14} />
                  <span className="text-sm font-medium">{r.reviewer_name}</span>
                </div>
                {r.title && <p className="mt-1 font-semibold">{r.title}</p>}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{r.body}</p>
            {currentUserId === r.reviewer_id && (
              <div className="mt-2 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => del.mutate(r.id)}
                  disabled={del.isPending}
                >
                  Delete
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
