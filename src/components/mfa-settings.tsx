import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Smartphone, KeyRound, Trash2 } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/ui/states";

type Factor = {
  id: string;
  factor_type: "totp" | "phone";
  friendly_name?: string | null;
  status: "verified" | "unverified";
};

export function MfaSettings() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  // TOTP enroll state
  const [totpEnroll, setTotpEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");

  // SMS enroll state
  const [phone, setPhone] = useState("");
  const [smsEnroll, setSmsEnroll] = useState<{ factorId: string } | null>(null);
  const [smsCode, setSmsCode] = useState("");

  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    const all: Factor[] = [
      ...(data?.totp ?? []).map((f) => ({ ...f, factor_type: "totp" as const })),
      ...(data?.phone ?? []).map((f) => ({ ...f, factor_type: "phone" as const })),
    ];
    setFactors(all);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function startTotp() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
      });
      if (error) throw error;
      setTotpEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start TOTP enrollment");
    } finally {
      setBusy(false);
    }
  }

  async function verifyTotp() {
    if (!totpEnroll) return;
    setBusy(true);
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: totpEnroll.factorId });
      if (ce) throw ce;
      const { error } = await supabase.auth.mfa.verify({
        factorId: totpEnroll.factorId,
        challengeId: ch.id,
        code: totpCode.trim(),
      });
      if (error) throw error;
      toast.success("Authenticator enabled");
      setTotpEnroll(null);
      setTotpCode("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function startSms() {
    if (!phone.trim()) return toast.error("Enter a phone number in E.164 format");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "phone",
        phone: phone.trim(),
        friendlyName: phone.trim(),
      });
      if (error) throw error;
      setSmsEnroll({ factorId: data.id });
      toast.success("SMS code sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start SMS enrollment");
    } finally {
      setBusy(false);
    }
  }

  async function verifySms() {
    if (!smsEnroll) return;
    setBusy(true);
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: smsEnroll.factorId });
      if (ce) throw ce;
      const { error } = await supabase.auth.mfa.verify({
        factorId: smsEnroll.factorId,
        challengeId: ch.id,
        code: smsCode.trim(),
      });
      if (error) throw error;
      toast.success("Phone factor enabled");
      setSmsEnroll(null);
      setSmsCode("");
      setPhone("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function unenroll(id: string) {
    if (!confirm("Remove this factor?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast.success("Factor removed");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove factor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Two-factor authentication</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Add an authenticator app and/or a phone number for SMS codes.
      </p>

      {loading ? (
        <div className="mt-6"><LoadingState label="Loading factors…" /></div>
      ) : (
        <ul className="mt-6 space-y-2">
          {factors.length === 0 && (
            <li><EmptyState icon={ShieldCheck} title="No factors enrolled yet" description="Add an authenticator app or phone to enable two-factor auth." /></li>
          )}
          {factors.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                {f.factor_type === "totp" ? (
                  <KeyRound className="h-4 w-4" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
                <span className="font-medium">{f.friendly_name || f.factor_type.toUpperCase()}</span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs " +
                    (f.status === "verified"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {f.status}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unenroll(f.id)}
                disabled={busy}
                aria-label="Remove factor"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* TOTP */}
        <div className="rounded-xl border border-border/60 p-4">
          <h3 className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4" /> Authenticator app
          </h3>
          {!totpEnroll ? (
            <Button className="mt-3" onClick={startTotp} disabled={busy} size="sm">
              Add authenticator
            </Button>
          ) : (
            <div className="mt-3 space-y-3">
              <img
                src={totpEnroll.qr}
                alt="Scan with your authenticator app"
                className="h-40 w-40 rounded border border-border/60 bg-white p-2"
              />
              <p className="text-xs text-muted-foreground">
                Secret: <code className="rounded bg-muted px-1">{totpEnroll.secret}</code>
              </p>
              <div className="space-y-1">
                <Label>Enter 6-digit code</Label>
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={verifyTotp} disabled={busy || totpCode.length < 6}>
                  Verify & enable
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTotpEnroll(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* SMS */}
        <div className="rounded-xl border border-border/60 p-4">
          <h3 className="flex items-center gap-2 font-medium">
            <Smartphone className="h-4 w-4" /> SMS (phone)
          </h3>
          {!smsEnroll ? (
            <div className="mt-3 space-y-2">
              <Label>Phone number (E.164)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+15558675309"
              />
              <Button size="sm" onClick={startSms} disabled={busy}>
                Send code
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Label>Enter SMS code</Label>
              <Input
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={verifySms} disabled={busy || smsCode.length < 6}>
                  Verify & enable
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSmsEnroll(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
