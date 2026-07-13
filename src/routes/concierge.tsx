import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { askConcierge } from "@/lib/concierge.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sparkles, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/concierge")({
  head: () => ({
    meta: [
      { title: "AI Travel Concierge — HostPulse" },
      { name: "description", content: "Plan your Kenya trip with the HostPulse AI travel concierge. Get accommodation, itinerary, and destination suggestions grounded in real listings." },
      { property: "og:title", content: "AI Travel Concierge — HostPulse" },
      { property: "og:description", content: "AI travel planning for East Africa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConciergePage,
});

type Msg = { role: "user" | "assistant"; content: string };

function ConciergePage() {
  const ask = useServerFn(askConcierge);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Habari! I'm the HostPulse travel concierge. Where are you thinking of going, and when?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next.slice(-12) } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply || "…" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            HostPulse
          </Link>
          <Link to="/discover" className="text-sm text-muted-foreground hover:underline">
            Browse discovery
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">AI Travel Concierge</h1>
        <p className="text-sm text-muted-foreground">
          Ask about destinations, itineraries, or accommodation in Kenya. I only recommend from the
          HostPulse verified index — no fabricated prices or availability.
        </p>

        <Card className="flex h-[60vh] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground" : "mr-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2"}
              >
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && <div className="mr-auto rounded-2xl bg-muted px-4 py-2 text-sm">Thinking…</div>}
          </div>
          <div className="flex gap-2 border-t p-3">
            <Input
              placeholder="e.g. Family beach stay in Diani next month, mid-range"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={loading}
            />
            <Button onClick={send} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
