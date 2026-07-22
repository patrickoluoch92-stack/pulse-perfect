// Lightweight performance profiling using PerformanceObserver + Web Vitals proxies.
// No external deps. Reports Core Web Vitals (LCP, CLS, INP, FCP, TTFB) to
// `/api/public/web-vitals` (best-effort, fire-and-forget) and console.debug.

type Metric = {
  name: "LCP" | "CLS" | "INP" | "FCP" | "TTFB";
  value: number;
  id: string;
  rating?: "good" | "needs-improvement" | "poor";
  navigationType?: string;
};

const THRESHOLDS: Record<Metric["name"], [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

function rate(name: Metric["name"], value: number): Metric["rating"] {
  const [g, p] = THRESHOLDS[name];
  return value <= g ? "good" : value <= p ? "needs-improvement" : "poor";
}

function send(metric: Metric) {
  try {
    const body = JSON.stringify({ ...metric, url: location.pathname, ts: Date.now() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/public/web-vitals",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      fetch("/api/public/web-vitals", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "content-type": "application/json" },
      }).catch(() => {});
    }

    if (import.meta.env.DEV)
      console.debug("[perf]", metric.name, Math.round(metric.value), metric.rating);
  } catch {
    /* ignore */
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function initWebVitals() {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

  // TTFB + FCP via Navigation/Paint entries.
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav)
      send({
        name: "TTFB",
        value: nav.responseStart,
        id: uid(),
        rating: rate("TTFB", nav.responseStart),
      });
  } catch {}

  const observe = (type: string, cb: (entries: PerformanceEntry[]) => void) => {
    try {
      const obs = new PerformanceObserver((list) => cb(list.getEntries()));
      obs.observe({ type, buffered: true } as PerformanceObserverInit);
    } catch {}
  };

  observe("paint", (entries) => {
    for (const e of entries) {
      if (e.name === "first-contentful-paint") {
        send({ name: "FCP", value: e.startTime, id: uid(), rating: rate("FCP", e.startTime) });
      }
    }
  });

  let lcpValue = 0;
  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
    lcpValue = last.startTime;
  });

  let clsValue = 0;
  observe("layout-shift", (entries) => {
    for (const e of entries as Array<
      PerformanceEntry & { value: number; hadRecentInput: boolean }
    >) {
      if (!e.hadRecentInput) clsValue += e.value;
    }
  });

  let inpValue = 0;
  observe("event", (entries) => {
    for (const e of entries as Array<
      PerformanceEntry & { duration: number; interactionId?: number }
    >) {
      if (e.interactionId && e.duration > inpValue) inpValue = e.duration;
    }
  });

  const flush = () => {
    if (lcpValue) send({ name: "LCP", value: lcpValue, id: uid(), rating: rate("LCP", lcpValue) });
    send({ name: "CLS", value: clsValue, id: uid(), rating: rate("CLS", clsValue) });
    if (inpValue) send({ name: "INP", value: inpValue, id: uid(), rating: rate("INP", inpValue) });
  };

  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  addEventListener("pagehide", flush);
}
