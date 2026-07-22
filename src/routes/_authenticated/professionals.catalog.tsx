import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Package, Wrench, Images, Plus, Trash2, ArrowLeft } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import {
  getMyProfessionalWorkspace,
  upsertService,
  deleteService,
  upsertPackage,
  deletePackage,
  upsertPortfolioItem,
  deletePortfolioItem,
} from "@/lib/professionals.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/professionals/catalog")({
  head: () => ({
    meta: authPageMeta({
      title: "My services & portfolio",
      description: "Manage the services, packages, and portfolio your clients see.",
    }),
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const fetchWorkspace = useServerFn(getMyProfessionalWorkspace);
  const q = useQuery({ queryKey: ["pro-workspace"], queryFn: () => fetchWorkspace() });

  if (q.isLoading) return <LoadingState label="Loading your workspace…" />;
  if (!q.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState
          title="No professional profile yet"
          description="Register as a professional to add services, packages, and a portfolio."
          action={
            <Link to="/professionals/register">
              <Button>Register as professional</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { professional, services, packages, portfolio } = q.data as any;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/professionals/dashboard"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold">{professional.business_name}</h1>
          <div className="text-sm text-muted-foreground">
            Status: <Badge variant="secondary">{professional.status}</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">
            <Wrench className="mr-1 h-4 w-4" /> Services
          </TabsTrigger>
          <TabsTrigger value="packages">
            <Package className="mr-1 h-4 w-4" /> Packages
          </TabsTrigger>
          <TabsTrigger value="portfolio">
            <Images className="mr-1 h-4 w-4" /> Portfolio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <ServicesEditor professionalId={professional.id} initial={services} />
        </TabsContent>
        <TabsContent value="packages" className="space-y-4">
          <PackagesEditor professionalId={professional.id} initial={packages} />
        </TabsContent>
        <TabsContent value="portfolio" className="space-y-4">
          <PortfolioEditor professionalId={professional.id} initial={portfolio} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ServicesEditor({ professionalId, initial }: { professionalId: string; initial: any[] }) {
  const save = useServerFn(upsertService);
  const del = useServerFn(deleteService);
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    pricing_type: "flat",
    base_price: "" as string,
  });

  async function add() {
    if (!draft.title.trim()) return;
    try {
      await save({
        data: {
          professional_id: professionalId,
          title: draft.title.trim(),
          description: draft.description || null,
          pricing_type: draft.pricing_type as any,
          base_price: draft.base_price ? Number(draft.base_price) : null,
          active: true,
        },
      });
      toast.success("Service added");
      setDraft({ title: "", description: "", pricing_type: "flat", base_price: "" });
      qc.invalidateQueries({ queryKey: ["pro-workspace"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this service?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["pro-workspace"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add a service</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Title (e.g. Wedding photography)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <div className="flex gap-2">
            <Select
              value={draft.pricing_type}
              onValueChange={(v) => setDraft({ ...draft, pricing_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat rate</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="starting_from">Starting from</SelectItem>
                <SelectItem value="quote">Custom quote</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Price (KES)"
              value={draft.base_price}
              onChange={(e) => setDraft({ ...draft, base_price: e.target.value })}
            />
          </div>
          <Textarea
            className="sm:col-span-2"
            rows={2}
            placeholder="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Button onClick={add}>
              <Plus className="mr-1 h-4 w-4" /> Add service
            </Button>
          </div>
        </CardContent>
      </Card>

      {initial.length === 0 ? (
        <EmptyState title="No services yet" description="Add the services clients can book." />
      ) : (
        initial.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <div className="font-medium">{s.title}</div>
                <div className="text-sm text-muted-foreground">
                  {s.pricing_type} ·{" "}
                  {s.base_price ? `KES ${Number(s.base_price).toLocaleString()}` : "quote"}
                </div>
                {s.description && <p className="mt-1 text-sm">{s.description}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}

function PackagesEditor({ professionalId, initial }: { professionalId: string; initial: any[] }) {
  const save = useServerFn(upsertPackage);
  const del = useServerFn(deletePackage);
  const qc = useQueryClient();
  const [d, setD] = useState({
    name: "",
    description: "",
    price: "" as string,
    duration_label: "",
    inclusions: "",
  });

  async function add() {
    if (!d.name.trim() || !d.price) return;
    try {
      await save({
        data: {
          professional_id: professionalId,
          name: d.name.trim(),
          description: d.description || null,
          price: Number(d.price),
          duration_label: d.duration_label || null,
          inclusions: d.inclusions
            ? d.inclusions
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            : null,
          active: true,
        },
      });
      toast.success("Package added");
      setD({ name: "", description: "", price: "", duration_label: "", inclusions: "" });
      qc.invalidateQueries({ queryKey: ["pro-workspace"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this package?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["pro-workspace"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">New package</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Package name (e.g. Gold wedding)"
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Price (KES)"
            value={d.price}
            onChange={(e) => setD({ ...d, price: e.target.value })}
          />
          <Input
            placeholder="Duration label (e.g. Full day)"
            value={d.duration_label}
            onChange={(e) => setD({ ...d, duration_label: e.target.value })}
          />
          <Textarea
            className="sm:col-span-2"
            rows={2}
            placeholder="Description"
            value={d.description}
            onChange={(e) => setD({ ...d, description: e.target.value })}
          />
          <Textarea
            className="sm:col-span-2"
            rows={3}
            placeholder="Inclusions (one per line)"
            value={d.inclusions}
            onChange={(e) => setD({ ...d, inclusions: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Button onClick={add}>
              <Plus className="mr-1 h-4 w-4" /> Add package
            </Button>
          </div>
        </CardContent>
      </Card>

      {initial.length === 0 ? (
        <EmptyState
          title="No packages"
          description="Bundle your services into ready-to-book packages."
        />
      ) : (
        initial.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <div className="font-medium">
                  {p.name}{" "}
                  <span className="text-sm text-muted-foreground">
                    · KES {Number(p.price).toLocaleString()}
                  </span>
                </div>
                {p.duration_label && (
                  <div className="text-sm text-muted-foreground">{p.duration_label}</div>
                )}
                {p.description && <p className="mt-1 text-sm">{p.description}</p>}
                {Array.isArray(p.inclusions) && p.inclusions.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                    {p.inclusions.map((it: string, i: number) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}

function PortfolioEditor({ professionalId, initial }: { professionalId: string; initial: any[] }) {
  const save = useServerFn(upsertPortfolioItem);
  const del = useServerFn(deletePortfolioItem);
  const qc = useQueryClient();
  const [d, setD] = useState({ item_type: "photo", title: "", description: "", media_url: "" });

  async function add() {
    if (!d.media_url.trim()) {
      toast.error("Add a media URL");
      return;
    }
    try {
      await save({
        data: {
          professional_id: professionalId,
          item_type: d.item_type as any,
          title: d.title || null,
          description: d.description || null,
          media_url: d.media_url.trim(),
        },
      });
      toast.success("Portfolio item added");
      setD({ item_type: "photo", title: "", description: "", media_url: "" });
      qc.invalidateQueries({ queryKey: ["pro-workspace"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this item?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["pro-workspace"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add portfolio item</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Select value={d.item_type} onValueChange={(v) => setD({ ...d, item_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="certificate">Certificate</SelectItem>
              <SelectItem value="license">License</SelectItem>
              <SelectItem value="award">Award</SelectItem>
              <SelectItem value="before_after">Before / after</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Title (optional)"
            value={d.title}
            onChange={(e) => setD({ ...d, title: e.target.value })}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Media URL (https://…)"
            value={d.media_url}
            onChange={(e) => setD({ ...d, media_url: e.target.value })}
          />
          <Textarea
            className="sm:col-span-2"
            rows={2}
            placeholder="Description"
            value={d.description}
            onChange={(e) => setD({ ...d, description: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Button onClick={add}>
              <Plus className="mr-1 h-4 w-4" /> Add item
            </Button>
          </div>
        </CardContent>
      </Card>

      {initial.length === 0 ? (
        <EmptyState
          title="No portfolio yet"
          description="Showcase past work with photos, videos, or certificates."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {initial.map((it) => (
            <Card key={it.id}>
              <CardContent className="p-3">
                {it.media_url && it.item_type !== "video" && (
                  <img
                    src={it.media_url}
                    alt={it.title ?? ""}
                    className="mb-2 h-40 w-full rounded object-cover"
                    loading="lazy"
                  />
                )}
                {it.media_url && it.item_type === "video" && (
                  <a
                    href={it.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-2 block text-sm text-primary underline"
                  >
                    Open video
                  </a>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="secondary">{it.item_type}</Badge>
                    {it.title && <div className="mt-1 font-medium">{it.title}</div>}
                    {it.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{it.description}</p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
