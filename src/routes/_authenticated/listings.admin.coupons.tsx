import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ticket, Plus, Trash2 } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import { adminListCoupons, adminUpsertCoupon, adminDeleteCoupon } from "@/lib/coupons.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState, EmptyState } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/listings/admin/coupons")({
  head: () => ({
    meta: authPageMeta({
      title: "Coupons",
      description: "Create and manage platform-wide discount codes.",
    }),
  }),
  component: CouponsAdmin,
});

function CouponsAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCoupons);
  const upsertFn = useServerFn(adminUpsertCoupon);
  const deleteFn = useServerFn(adminDeleteCoupon);

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);

  const list = useQuery({ queryKey: ["coupons"], queryFn: () => listFn() });

  const upsert = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          code,
          description: description || undefined,
          discountType,
          discountValue: Number(discountValue),
          currency: "KES",
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          expiresAt: expiresAt || undefined,
          active,
        },
      }),
    onSuccess: () => {
      toast.success("Coupon saved");
      setOpen(false);
      setCode("");
      setDescription("");
      setDiscountValue("10");
      setMaxRedemptions("");
      setExpiresAt("");
      qc.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Ticket className="h-6 w-6" /> Coupons
          </h1>
          <p className="text-sm text-muted-foreground">Discount codes usable at checkout.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> New coupon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create coupon</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SUMMER25"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed (KES)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Value</Label>
                  <Input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Max redemptions</Label>
                  <Input
                    type="number"
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <Label>Expires</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => upsert.mutate()} disabled={!code || upsert.isPending}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border bg-card">
        {list.isLoading && <LoadingState />}
        {!list.isLoading && list.data?.rows?.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={Ticket}
              title="No coupons yet"
              description="Create a discount code to reward guests or run promotions."
            />
          </div>
        )}
        <ul className="divide-y">
          {list.data?.rows?.map((c: any) => (
            <li key={c.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{c.code}</span>
                  <Badge variant={c.active ? "default" : "outline"}>
                    {c.active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="secondary">
                    {c.discount_type === "percent"
                      ? `${c.discount_value}% off`
                      : `KES ${c.discount_value} off`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Redemptions: {c.redemptions_count}
                  {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                  {c.expires_at ? ` · Expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                </p>
                {c.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete coupon ${c.code}`}
                onClick={() => del.mutate(c.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
