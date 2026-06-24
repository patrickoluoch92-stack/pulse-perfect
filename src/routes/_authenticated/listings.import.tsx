import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";

import { authPageMeta } from "@/lib/route-meta";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { bulkImportProperties } from "@/lib/marketplace-ops.functions";
import { listCounties } from "@/lib/marketplace.functions";
import { PROPERTY_CATEGORIES } from "@/lib/marketplace-constants";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/listings/import")({
  head: () => ({
    meta: authPageMeta({ title: "Import listings", description: "Bulk import marketplace listings from CSV." }),
  }),
  component: ImportPage,
});

const HEADERS = [
  "name", "category", "countyCode", "town", "description",
  "amenities", "pricePerNight", "currency",
  "latitude", "longitude", "googleMapsUrl",
  "contactEmail", "contactPhone", "contactWhatsapp", "availability",
];

const SAMPLE = `name,category,countyCode,town,description,amenities,pricePerNight,currency,latitude,longitude,googleMapsUrl,contactEmail,contactPhone,contactWhatsapp,availability
"Mara Sunset Camp",camp,KE-NRK,"Maasai Mara","Tented camp on the Mara river with daily game drives.","Wi-Fi|Restaurant|Game drives",18500,KES,-1.5061,35.1432,,bookings@example.com,+254700000000,+254700000000,available
"Diani Beach Villa",villa,KE-KWL,"Diani","Private beachfront villa with chef and pool.","Wi-Fi|Swimming pool|Beach access",42000,KES,-4.3000,39.5833,,villa@example.com,+254711111111,+254711111111,available`;

// Minimal CSV parser supporting quoted fields and embedded commas/newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { cur.push(field); field = ""; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (field !== "" || cur.length > 0) { cur.push(field); rows.push(cur); cur = []; field = ""; }
      // skip \r\n
      if (c === '\r' && text[i + 1] === '\n') i++;
      i++; continue;
    }
    field += c; i++;
  }
  if (field !== "" || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toRowObject(headers: string[], row: string[]) {
  const out: Record<string, string> = {};
  headers.forEach((h, idx) => { out[h] = (row[idx] ?? "").trim(); });
  return out;
}

function coerceRow(r: Record<string, string>) {
  return {
    name: r.name,
    category: r.category,
    countyCode: r.countyCode,
    town: r.town,
    description: r.description,
    amenities: r.amenities ? r.amenities.split("|").map((s) => s.trim()).filter(Boolean) : [],
    pricePerNight: r.pricePerNight ? Number(r.pricePerNight) : null,
    currency: r.currency || "KES",
    latitude: r.latitude ? Number(r.latitude) : null,
    longitude: r.longitude ? Number(r.longitude) : null,
    googleMapsUrl: r.googleMapsUrl || null,
    contactEmail: r.contactEmail || null,
    contactPhone: r.contactPhone || null,
    contactWhatsapp: r.contactWhatsapp || null,
    availability: r.availability || "available",
  };
}

function ImportPage() {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getWorkspaceContext);
  const importFn = useServerFn(bulkImportProperties);
  const countiesFn = useServerFn(listCounties);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => ctxFn() });
  const counties = useQuery({ queryKey: ["mkt-counties"], queryFn: () => countiesFn() });
  const orgId = ctx.data?.currentOrg?.id;

  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<{ imported: number; total: number; errors: { row: number; message: string }[] } | null>(null);

  const parsed = useMemo(() => {
    if (!csvText.trim()) return { rows: [] as any[], errors: [] as string[] };
    try {
      const all = parseCsv(csvText);
      if (all.length === 0) return { rows: [], errors: ["No rows found"] };
      const headers = all[0].map((h) => h.trim());
      const missing = HEADERS.filter((h) => !headers.includes(h) && ["name","category","countyCode","town","description"].includes(h));
      if (missing.length > 0) return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`] };
      const rows = all.slice(1).map((r) => coerceRow(toRowObject(headers, r)));
      return { rows, errors: [] };
    } catch (e: any) {
      return { rows: [], errors: [e.message ?? "Could not parse CSV"] };
    }
  }, [csvText]);

  const run = useMutation({
    mutationFn: () => importFn({ data: { orgId: orgId!, rows: parsed.rows as any } }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["mkt-my-listings", orgId] });
      if (r.errors.length === 0) toast.success(`Imported ${r.imported} listings`);
      else toast.warning(`Imported ${r.imported} of ${r.total} — see details below`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onFile(file: File) {
    file.text().then(setCsvText);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "marketplace-listings-sample.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <Link to="/listings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> All listings
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Bulk import listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a CSV with up to 200 properties. Listings are created as drafts; submit them for review when ready.
          </p>
        </div>

        <section className="space-y-3 rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">CSV input</h2>
            <Button variant="outline" size="sm" onClick={downloadSample}>
              <Download className="mr-2 h-4 w-4" /> Download sample
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Required columns</p>
              <code className="block break-words">name, category, countyCode, town, description</code>
            </div>
            <div>
              <p className="font-medium text-foreground">Optional columns</p>
              <code className="block break-words">amenities (pipe-separated), pricePerNight, currency, latitude, longitude, googleMapsUrl, contactEmail, contactPhone, contactWhatsapp, availability</code>
            </div>
          </div>
          <div className="rounded-md bg-muted/30 p-3 text-xs">
            <p><strong>Category</strong> — one of: {PROPERTY_CATEGORIES.map((c) => c.value).join(", ")}</p>
            <p className="mt-1"><strong>County code</strong> — e.g. {counties.data?.slice(0, 4).map((c) => c.code).join(", ") || "KE-NRB, KE-MSA…"}</p>
          </div>

          <label className="inline-flex">
            <Button asChild variant="outline" size="sm">
              <span>
                <Upload className="mr-2 h-4 w-4" /> Upload CSV file
                <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </span>
            </Button>
          </label>

          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="…or paste CSV here"
            rows={12}
            className="font-mono text-xs"
          />

          {parsed.errors.length > 0 && (
            <p className="text-sm text-red-600">{parsed.errors.join("; ")}</p>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {parsed.rows.length > 0 ? `${parsed.rows.length} rows ready to import.` : "Add some rows to enable import."}
            </p>
            <Button
              onClick={() => run.mutate()}
              disabled={!orgId || parsed.rows.length === 0 || run.isPending}
            >
              {run.isPending ? "Importing…" : `Import ${parsed.rows.length || ""} listings`}
            </Button>
          </div>
        </section>

        {result && (
          <section className="rounded-xl border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Imported {result.imported} of {result.total}
            </h2>
            {result.errors.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <AlertCircle className="h-4 w-4" /> {result.errors.length} row(s) failed
                </p>
                <ul className="space-y-1 text-xs">
                  {result.errors.map((e) => (
                    <li key={e.row} className="rounded bg-red-50 px-2 py-1 text-red-700">
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
